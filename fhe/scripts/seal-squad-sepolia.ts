import { ethers, network } from 'hardhat';
import { ZamaSDK, memoryStorage } from '@zama-fhe/sdk';
import { createConfig } from '@zama-fhe/sdk/ethers';
import { node } from '@zama-fhe/sdk/node';
import { sepolia } from '@zama-fhe/sdk/chains';
import { formatEther, getAddress, keccak256, ZeroAddress } from 'ethers';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import deployment from '../deployments/sepolia-squad.json';

/**
 * First live TEN-INPUT SquadGambit v2 seal.
 * Default: read-only preflight, with NO key material or SDK ciphertext logged.
 * Only signs with the existing local Hardhat signer after a deliberately scoped
 * flag, an exact pre-transaction squad ID, a different invited wallet, and a
 * bounded live quote. One call submits at most ONE transaction.
 */
const CHAIN = 11155111n;
const MAX_FEE_WEI = 500000000000000n; // hard cap: 0.0005 Sepolia ETH
const APPROVAL = 'YES_SEPOLIA_SQUAD_SEAL_ONCE';
const SYNTHETIC_SQUAD = [0n, 1n, 2n, 1n, 0n, 2n, 2n, 1n, 0n, 1n] as const;

async function main() {
  const connected = await ethers.provider.getNetwork();
  if (network.name !== 'sepolia' || connected.chainId !== CHAIN) {
    throw Error('Only Ethereum Sepolia, chain 11155111, is permitted');
  }
  if (deployment.contract !== 'SquadGambit' || deployment.chainId !== Number(CHAIN)) {
    throw Error('Not a versioned SquadGambit v2 deployment manifest');
  }

  const address = getAddress(deployment.contractAddress);
  const expectedOwner = getAddress(deployment.deployer);
  const runtime = await ethers.provider.getCode(address);
  if (runtime === '0x' ||
      (runtime.length - 2) / 2 !== deployment.runtimeBytes ||
      keccak256(runtime).toLowerCase() !== deployment.runtimeKeccak256.toLowerCase()) {
    throw Error('Deployed SquadGambit v2 runtime mismatch');
  }

  const contract: any = await ethers.getContractAt('SquadGambit', address);
  const currentId = BigInt(await contract.nextSquadId());
  const currentDuelId = BigInt(await contract.nextDuelId());
  const [signer] = await ethers.getSigners();
  const signerAddress = signer ? getAddress(await signer.getAddress()) : null;
  const signerBalance = signerAddress
    ? formatEther(await ethers.provider.getBalance(signerAddress))
    : null;

  console.log('GAMBIT_SQUAD_SEAL_PREFLIGHT ' + JSON.stringify({
    chainId: Number(CHAIN),
    contractAddress: address,
    contractRuntimeVerified: true,
    signerAddress: signerAddress ?? 'NOT_CONFIGURED',
    signerBalanceSepoliaETH: signerBalance,
    nextSquadId: (currentId + 1n).toString(),
    nextDuelId: (currentDuelId + 1n).toString(),
    encryptedInputCount: 10,
    testVector: 'SYNTHETIC_PUBLIC_KNOWN_INPUTS',
    maximumTransactionFeeWei: MAX_FEE_WEI.toString(),
    transactionSent: false
  }));

  if (process.env.GAMBIT_APPROVE_ONE_SQUAD_SEAL !== APPROVAL) {
    console.log('READ ONLY: explicit SquadGambit v2 seal flag is absent.');
    return;
  }
  if (!signer || signerAddress !== expectedOwner) {
    throw Error('Existing approved deployer signer is missing or differs');
  }

  const inviteeRaw = process.env.GAMBIT_SQUAD_CHALLENGER_ADDRESS;
  if (!inviteeRaw) throw Error('A distinct public challenger wallet address is required');
  const challenger = getAddress(inviteeRaw);
  if (challenger === signerAddress || challenger === ZeroAddress) {
    throw Error('Challenger must be a distinct nonzero wallet');
  }

  const expectedOwnerRaw = process.env.GAMBIT_EXPECTED_SQUAD_SEAL_SIGNER;
  if (!expectedOwnerRaw || getAddress(expectedOwnerRaw) !== expectedOwner) {
    throw Error('Explicitly approved public owner address is missing or wrong');
  }
  const approvedCapRaw = process.env.GAMBIT_MAX_SQUAD_SEAL_FEE_WEI;
  if (!approvedCapRaw || !/^[1-9][0-9]*$/.test(approvedCapRaw)) {
    throw Error('A fresh explicit maximum transaction fee in wei is required');
  }
  const approvedMaxFeeWei = BigInt(approvedCapRaw);
  if (approvedMaxFeeWei > MAX_FEE_WEI) {
    throw Error('Approved fee cap exceeds the 0.0005 Sepolia ETH hard limit');
  }

  const expectedNextRaw = process.env.GAMBIT_EXPECTED_NEXT_SQUAD_ID;
  if (!expectedNextRaw || !/^[1-9][0-9]*$/.test(expectedNextRaw) ||
      BigInt(expectedNextRaw) !== currentId + 1n) {
    throw Error('Expected next squad ID is missing or already consumed; no replay allowed');
  }

  const rpc = (network.config as { url?: string }).url
    ?? 'https://ethereum-sepolia-rpc.publicnode.com';
  const chain = { ...sepolia, network: rpc };
  const sdk = new ZamaSDK(createConfig({
    chains: [chain],
    signer,
    storage: memoryStorage,
    relayers: { [chain.id]: node({ timeout: 300000 }) }
  }));

  try {
    const encrypted = await sdk.encrypt({
      contractAddress: address as `0x${string}`,
      userAddress: signerAddress as `0x${string}`,
      values: SYNTHETIC_SQUAD.map(value => ({ type: 'euint8' as const, value }))
    });
    if (encrypted.encryptedValues.length !== 10 ||
        typeof encrypted.inputProof !== 'string' || encrypted.inputProof.length < 10) {
      throw Error('Live SDK did not produce exactly ten ciphertexts and a valid-looking proof');
    }

    const args = [challenger, encrypted.encryptedValues, encrypted.inputProof] as const;
    const txData = contract.interface.encodeFunctionData('sealSquad', args);
    const estimated = await ethers.provider.estimateGas({
      from: signerAddress, to: address, data: txData, value: 0n
    });
    if (estimated <= 0n) throw Error('Cannot estimate squad seal transaction');
    const gasLimit = (estimated * 120n + 99n) / 100n;
    const quote = await ethers.provider.getFeeData();
    let maxPerGas = quote.maxFeePerGas ?? quote.gasPrice;
    if (!maxPerGas || maxPerGas <= 0n) throw Error('Gas fee quote unavailable');
    let currentBalance = await ethers.provider.getBalance(signerAddress);
    if (gasLimit * maxPerGas > approvedMaxFeeWei || gasLimit * maxPerGas > currentBalance) {
      throw Error('Estimated maximum fee exceeds the explicitly approved cap or wallet balance');
    }

    // Reject another actor's prior seal / a network switch / stale deployed code.
    if ((await ethers.provider.getNetwork()).chainId !== CHAIN ||
        getAddress(await signer.getAddress()) !== expectedOwner ||
        BigInt(await contract.nextSquadId()) !== currentId ||
        keccak256(await ethers.provider.getCode(address)).toLowerCase()
          !== deployment.runtimeKeccak256.toLowerCase()) {
      throw Error('Changed network, signer, deployed runtime or squad counter');
    }

    const fresh = await ethers.provider.getFeeData();
    maxPerGas = fresh.maxFeePerGas ?? fresh.gasPrice;
    currentBalance = await ethers.provider.getBalance(signerAddress);
    if (!maxPerGas || maxPerGas <= 0n ||
        gasLimit * maxPerGas > approvedMaxFeeWei ||
        gasLimit * maxPerGas > currentBalance) {
      throw Error('Fee quote drifted beyond the hard cap; no signature');
    }
    const overrides: Record<string, bigint> = { gasLimit };
    if (fresh.maxFeePerGas != null && fresh.maxPriorityFeePerGas != null) {
      if (fresh.maxPriorityFeePerGas > fresh.maxFeePerGas) {
        throw Error('Invalid priority fee quote');
      }
      overrides.maxFeePerGas = fresh.maxFeePerGas;
      overrides.maxPriorityFeePerGas = fresh.maxPriorityFeePerGas;
    } else {
      overrides.gasPrice = maxPerGas;
    }

    console.log('GAMBIT_SQUAD_SEAL_READY ' + JSON.stringify({
      chainId: Number(CHAIN), contract: address, sender: signerAddress,
      invitedChallenger: challenger, expectedSquadId: expectedNextRaw,
      encryptedInputs: 10, estimatedGas: estimated.toString(),
      maximumQuotedFeeWei: (gasLimit * maxPerGas).toString(),
      userApprovedFeeCapWei: approvedMaxFeeWei.toString(),
      inputSecretsOrProofLogged: false
    }));

    // The only write in this script. No retries or automatic next lifecycle step.
    const submitted = await contract.sealSquad(...args, overrides);
    // Emit the public tx ID before confirmation so a lost receipt is recoverable.
    console.log('GAMBIT_SQUAD_SEAL_SUBMITTED '+JSON.stringify({transactionHash:submitted.hash,transactionSent:true,confirmed:false}));
    const receipt = await submitted.wait(1);
    if (!receipt || Number(receipt.status) !== 1) throw Error('Squad seal receipt not successful');

    let event: any = null;
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== address) continue;
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'SquadSealed') { event = parsed; break; }
      } catch { /* ignore unrelated logs */ }
    }
    if (!event) throw Error('SquadSealed event not found');
    const squadId = BigInt(event.args.squadId);
    const status = await contract.squadStatus(squadId);
    if (squadId !== currentId + 1n ||
        getAddress(event.args.owner) !== signerAddress ||
        getAddress(event.args.allowedOpponent) !== challenger ||
        getAddress(status.owner) !== signerAddress ||
        getAddress(status.allowedOpponent) !== challenger ||
        !status.active || status.claimed ||
        BigInt(await contract.nextSquadId()) !== squadId) {
      throw Error('Receipt succeeded but canonical sealed squad state differs');
    }

    const evidence = {
      contract: 'SquadGambit', version: 2,
      chainId: Number(CHAIN), address, sender: signerAddress,
      invitedChallenger: challenger, squadId: squadId.toString(),
      transactionHash: submitted.hash, blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorer: 'https://sepolia.etherscan.io/tx/' + submitted.hash,
      inputCount: 10, syntheticValuesPubliclyKnown: true,
      note: 'Real onchain input acceptance only; no open/submit/resolve/KMS/finalize has happened'
    };
    await mkdir(resolve(process.cwd(), 'deployments'), { recursive: true });
    await writeFile(resolve(process.cwd(), 'deployments/sepolia-squad-seal-proof.json'),
      JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log('GAMBIT_SQUAD_SEAL_CONFIRMED ' + JSON.stringify(evidence));
  } finally {
    sdk.terminate();
  }
}

// The SDK's background WASM/relayer handles can remain open after terminate().
 // End this single-command CLI only after all output is flushed.
main().then(()=>{
  process.stdout.write('',()=>process.exit(0));
}).catch(error=>{
  // Never stringify credential-bearing provider / SDK exception details.
  process.stderr.write('GAMBIT_SQUAD_SEAL_STOPPED '+
    (error instanceof Error ? error.name : 'UnknownError')+'\n',()=>process.exit(1));
});
