import { ethers, network } from "hardhat";
import { ZamaSDK, memoryStorage } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/ethers";
import { node } from "@zama-fhe/sdk/node";
import { sepolia } from "@zama-fhe/sdk/chains";
import { formatEther, getAddress } from "ethers";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import deployment from "../deployments/sepolia.json";

/**
 * FIRST PUBLIC SEP0LIA FHE INTEGRATION TEST — NOT A GAME RELEASE.
 * A known, synthetic policy is used to test encryption and contract acceptance.
 * No secrets are read, printed or exported; signing is through Hardhat's own
 * configured signer. This script REFUSES transactions without a fresh
 * explicit approval flag, and caps the maximum gas fee.
 */

const CHAIN_ID = 11155111n;
const EXPECTED_DEPLOYER = "0x7d567Fa1d5fe35737BbF045f47667e13298Ee176";
const CONTRACT_ADDRESS = "0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0";
const MAX_TEST_FEE_WEI = 500000000000000n; // 0.0005 Sepolia test ETH
const DEMO_POLICY = { base: 0n, trigger: 1n, response: 2n } as const;

async function main() {
  const chain = await ethers.provider.getNetwork();
  if (network.name !== "sepolia" || chain.chainId !== CHAIN_ID) {
    throw new Error("Only Ethereum Sepolia (11155111) is permitted");
  }
  if (getAddress(deployment.contractAddress) !== getAddress(CONTRACT_ADDRESS)
    || deployment.chainId !== Number(CHAIN_ID)) {
    throw new Error("Deployment manifest mismatch");
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No local Sepolia signer configured");
  const owner = getAddress(await signer.getAddress());
  if (owner !== getAddress(EXPECTED_DEPLOYER)) {
    throw new Error("Wrong wallet. Use the previously approved public Sepolia address");
  }

  if ((await ethers.provider.getCode(CONTRACT_ADDRESS)) === "0x") {
    throw new Error("SealedGambit has no code on Sepolia");
  }
  const contract: any = await ethers.getContractAt("SealedGambit", CONTRACT_ADDRESS, signer);
  const balance = await ethers.provider.getBalance(owner);
  const before = await contract.nextPolicyId();

  console.log(JSON.stringify({
    phase: "READ_ONLY_PREFLIGHT",
    chainId: Number(chain.chainId),
    publicWallet: owner,
    contract: CONTRACT_ADDRESS,
    balanceSepoliaETH: formatEther(balance),
    existingPolicyCount: before.toString(),
    transactionSent: false
  }));

  if (process.env.GAMBIT_APPROVE_ONE_SEAL !== "YES_SEPOLIA_TEST_ONLY") {
    console.log("No signing authorization flag set. Stopping before SDK encryption or transactions.");
    return;
  }

  const sdk = new ZamaSDK(createConfig({
    chains: [sepolia],
    signer,
    storage: memoryStorage,
    relayers: { [sepolia.id]: node({ timeout: 300000 }) }
  }));

  console.log("Encrypting synthetic test policy using Zama SDK node transport...");
  const encrypted = await sdk.encrypt({
    contractAddress: CONTRACT_ADDRESS,
    userAddress: owner as `0x${string}`,
    values: [
      { type: "euint8", value: DEMO_POLICY.base },
      { type: "euint8", value: DEMO_POLICY.trigger },
      { type: "euint8", value: DEMO_POLICY.response }
    ]
  });
  if (encrypted.encryptedValues.length !== 3 || encrypted.inputProof.length < 10) {
    throw new Error("SDK returned incomplete encrypted input/proof");
  }

  const args = [
    encrypted.encryptedValues[0],
    encrypted.encryptedValues[1],
    encrypted.encryptedValues[2],
    encrypted.inputProof
  ] as const;

  // Re-estimate onchain with the exact ciphertext and authenticated proof.
  const data = contract.interface.encodeFunctionData("seal", args);
  const estimatedGas = await ethers.provider.estimateGas({
    from: owner, to: CONTRACT_ADDRESS, data, value: 0n
  });
  const gasLimit = (estimatedGas * 120n + 99n) / 100n;
  const fee = await ethers.provider.getFeeData();
  const maxFeePerGas = fee.maxFeePerGas ?? fee.gasPrice;
  if (!maxFeePerGas || maxFeePerGas <= 0n) throw new Error("Gas quote unavailable");
  const maxCost = gasLimit * maxFeePerGas;
  if (maxCost > balance || maxCost > MAX_TEST_FEE_WEI) {
    throw new Error("Insufficient test ETH or 0.0005 Sepolia ETH safety cap exceeded");
  }

  console.log(JSON.stringify({
    phase: "APPROVED_TEST_POLICY_READY",
    chainId: Number(chain.chainId),
    signer: owner,
    destination: CONTRACT_ADDRESS,
    estimatedGas: estimatedGas.toString(),
    maxFeeWei: maxCost.toString(),
    dataContainsOnlyEncryptedValuesAndProof: true,
    syntheticPolicyIsPublicTestVector: true
  }));

  const options: Record<string,bigint> = { gasLimit };
  if (fee.maxFeePerGas !== null && fee.maxPriorityFeePerGas !== null) {
    options.maxFeePerGas = fee.maxFeePerGas;
    options.maxPriorityFeePerGas = fee.maxPriorityFeePerGas;
  } else {
    options.gasPrice = maxFeePerGas;
  }
  const tx = await contract.seal(...args, options);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("Seal transaction reverted");

  const event = receipt.logs.flatMap((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === "PolicySealed" ? [parsed] : [];
    } catch { return []; }
  })[0];
  if (!event) throw new Error("PolicySealed event missing from successful receipt");

  const policyId = BigInt(event.args.policyId);
  const state = await contract.policyStatus(policyId);
  if (getAddress(state.owner) !== owner || !state.active) {
    throw new Error("Onchain owner/active policy validation failed");
  }
  if ((await contract.nextPolicyId()) !== before + 1n) {
    throw new Error("Unexpected onchain policy counter change");
  }

  const proof = {
    chainId: 11155111,
    contract: CONTRACT_ADDRESS,
    owner,
    policyId: policyId.toString(),
    transactionHash: tx.hash,
    block: receipt.blockNumber,
    receiptStatus: receipt.status,
    explorerUrl: "https://sepolia.etherscan.io/tx/" + tx.hash,
    type: "known-synthetic-encrypted-input-test",
    warning: "The test strategy is public; this is not a privacy or game-balance demonstration"
  };
  await mkdir(resolve(process.cwd(), "deployments"), { recursive: true });
  await writeFile(resolve(process.cwd(), "deployments/sepolia-seal-proof.json"),
    JSON.stringify(proof, null, 2) + "\n", { flag: "w" });
  console.log("CONFIRMED_SEPOLIA_POLICY " + JSON.stringify(proof));
}

main().catch((_error:unknown) => {
  // Do not stringify RPC/SDK errors which can include account configuration,
  // proof contents or credential-bearing endpoints.
  console.error("Sealed-policy test halted. Inspect the local Codex error without sharing secrets.");
  process.exitCode = 1;
});
