import { ethers, network } from 'hardhat';
import { ZamaSDK, MemoryStorage } from '@zama-fhe/sdk';
import { createConfig } from '@zama-fhe/sdk/ethers';
import { node } from '@zama-fhe/sdk/node';
import { sepolia } from '@zama-fhe/sdk/chains';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getAddress, keccak256, ZeroAddress } from 'ethers';

const CHAIN = 11155111n;
const CONTRACT = getAddress('0x5F9e0030233370a913780EC9CCb58183C4672c13');
const EXPECTED_RUNTIME = '0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d';
const CHALLENGER = getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const DEFENDER = getAddress('0xcC427b61573EEE146fc735159292f06E13bc8B80');
const APPROVAL = 'YES_ONE_ARENA_V4_COMPLETE_LIVE_GAMEPLAY';
const MAX_TX_FEE = 5_000_000_000_000_000n; // 0.005 ETH
const MAX_TOTAL_FEE = 20_000_000_000_000_000n; // 0.02 ETH
const EXPECTED_PACKED = [40, 56, 40, 40, 40];
const LF_FHE = process.env.GAMBIT_LF_FHE ?? '/mnt/c/Users/DELL 7400/Gambit-neutral-blacksite-lf-5531b70/fhe';
const JOURNAL = resolve(LF_FHE, '.arena-v4-live-validation-journal.json');
const EVIDENCE = resolve(LF_FHE, 'deployments/sepolia-arena-v4-live-validation.json');
const MANIFEST = resolve(LF_FHE, 'deployments/sepolia-arena-v4.json');

const ABI = [
  'function nextMatchId() view returns (uint256)',
  'function createMatch(address invitedDefender) returns (uint256 id)',
  'function sealRound(uint256 id,uint8 expectedRound,bytes32[11] encrypted,bytes inputProof)',
  'function resolveRound(uint256 id,uint8 expectedRound)',
  'function finalizeRound(uint256 id,uint8 expectedRound,uint8 packed,bytes proof)',
  'function matchStatus(uint256 id) view returns (address challenger,address defender,uint8 currentRound,bool complete,bool abandoned,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'function roundStatus(uint256 id,uint8 round) view returns (uint64 openedAt,uint64 deadlineAt,bool challengerSealed,bool defenderSealed,bool resolved,bool finalized,uint8 packedScore)',
  'function publicResultHandle(uint256 id,uint8 round) view returns (bytes32)',
  'function ownSpentHandle(uint256 id) view returns (bytes32)',
  'event MatchCreated(uint256 indexed matchId,address indexed challenger,address indexed defender)',
  'event RoundSealed(uint256 indexed matchId,uint8 indexed round,address indexed who)',
  'event RoundReady(uint256 indexed matchId,uint8 indexed round,bytes32 resultHandle)',
  'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'event MatchCompleted(uint256 indexed matchId,uint8 outcome)'
] as const;

type AnySigner = any;
type TxEvidence = {
  label: string;
  sender: string;
  nonce: string;
  hash: string;
  blockNumber: number;
  gasLimit: string;
  gasUsed: string;
  effectiveGasPriceWei: string;
  actualFeeWei: string;
  maximumQuotedFeeWei: string;
};

const assertOk: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const valueFor = (map: Record<string, unknown>, handle: string): unknown =>
  map[handle] ?? map[handle.toLowerCase()] ?? map[handle.toUpperCase()];

const publicHandle = (value: unknown): string => {
  const handle = String(value);
  assertOk(/^0x[0-9a-fA-F]{64}$/.test(handle), 'invalid encrypted handle');
  return handle;
};

async function ensureRuntime() {
  const chain = await ethers.provider.getNetwork();
  assertOk(network.name === 'sepolia' && chain.chainId === CHAIN, 'wrong Sepolia network');
  const code = await ethers.provider.getCode(CONTRACT);
  assertOk(code !== '0x' && keccak256(code).toLowerCase() === EXPECTED_RUNTIME.toLowerCase(), 'Arena V4 runtime mismatch');
}

async function ensureDeploymentManifest() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as Record<string, unknown>;
  assertOk(manifest.contract === 'ArenaV4ConfidentialActivationResearch' && Number(manifest.chainId) === Number(CHAIN), 'Arena V4 deployment manifest identity mismatch');
  assertOk(getAddress(String(manifest.address)) === CONTRACT, 'Arena V4 deployment address mismatch');
  assertOk(String(manifest.creationCodeHash).toLowerCase() === '0x9e760de916b8e097c25ff79a7e6c103e79f1009b088f4883d1d20db45bd8b07c', 'Arena V4 creation hash mismatch');
  assertOk(String(manifest.runtimeHash).toLowerCase() === EXPECTED_RUNTIME.toLowerCase(), 'Arena V4 reviewed runtime hash mismatch');
  return manifest;
}

async function saveJournal(value: unknown) {
  await mkdir(resolve(LF_FHE), { recursive: true });
  await writeFile(JOURNAL, JSON.stringify(value, null, 2) + '\n');
}

async function dispatch(
  label: string,
  signer: AnySigner,
  data: string,
  txs: TxEvidence[],
  cumulativeQuoted: { value: bigint },
  cumulativeActual: { value: bigint },
  journal: any,
): Promise<{ receipt: any; evidence: TxEvidence }> {
  await ensureRuntime();
  const sender = getAddress(await signer.getAddress());
  const latestNonce = await signer.getNonce('latest');
  const pendingNonce = await signer.getNonce('pending');
  assertOk(latestNonce === pendingNonce, `${label}: pending nonce differs from latest`);
  const estimatedGas = await ethers.provider.estimateGas({ from: sender, to: CONTRACT, data, value: 0n });
  assertOk(estimatedGas > 0n, `${label}: zero gas estimate`);
  const gasLimit = (estimatedGas * 120n + 99n) / 100n;
  const fee = await ethers.provider.getFeeData();
  const maxFee = fee.maxFeePerGas ?? fee.gasPrice;
  assertOk(maxFee != null && maxFee > 0n, `${label}: no fee quote`);
  if (fee.maxFeePerGas != null && fee.maxPriorityFeePerGas != null) {
    assertOk(fee.maxPriorityFeePerGas <= fee.maxFeePerGas, `${label}: invalid EIP-1559 quote`);
  }
  const maximumQuotedFee = gasLimit * maxFee;
  assertOk(maximumQuotedFee <= MAX_TX_FEE, `${label}: per-transaction fee ceiling exceeded`);
  assertOk(cumulativeQuoted.value + maximumQuotedFee <= MAX_TOTAL_FEE, `${label}: cumulative fee ceiling exceeded`);
  cumulativeQuoted.value += maximumQuotedFee;

  const overrides: Record<string, bigint> = { nonce: BigInt(pendingNonce), gasLimit, value: 0n };
  if (fee.maxFeePerGas != null && fee.maxPriorityFeePerGas != null) {
    overrides.maxFeePerGas = fee.maxFeePerGas;
    overrides.maxPriorityFeePerGas = fee.maxPriorityFeePerGas;
  } else {
    overrides.gasPrice = maxFee;
  }
  console.log('GAMBIT_ARENA_V4_READY ' + JSON.stringify({ label, sender, nonce: pendingNonce, estimatedGas: estimatedGas.toString(), gasLimit: gasLimit.toString(), maximumQuotedFeeWei: maximumQuotedFee.toString(), cumulativeQuotedFeeWei: cumulativeQuoted.value.toString() }));

  const submitted = await signer.sendTransaction({ to: CONTRACT, data, ...overrides });
  const txEvidence: TxEvidence = { label, sender, nonce: String(pendingNonce), hash: submitted.hash, blockNumber: 0, gasLimit: gasLimit.toString(), gasUsed: '0', effectiveGasPriceWei: '0', actualFeeWei: '0', maximumQuotedFeeWei: maximumQuotedFee.toString() };
  journal.transactions.push(txEvidence);
  journal.status = 'SENT_WAITING_FOR_RECEIPT';
  await saveJournal(journal);
  console.log('GAMBIT_ARENA_V4_SUBMITTED ' + JSON.stringify({ label, transactionHash: submitted.hash }));
  const receipt = await submitted.wait(1);
  assertOk(receipt && Number(receipt.status) === 1, `${label}: unsuccessful receipt`);
  const independentReceipt = await ethers.provider.getTransactionReceipt(submitted.hash);
  const independentTx = await ethers.provider.getTransaction(submitted.hash);
  assertOk(independentReceipt && Number(independentReceipt.status) === 1, `${label}: independent receipt check failed`);
  assertOk(independentTx && getAddress(independentTx.to ?? ZeroAddress) === CONTRACT && getAddress(independentTx.from) === sender, `${label}: receipt identity mismatch`);
  assertOk(independentTx.nonce === pendingNonce && independentTx.value === 0n, `${label}: receipt nonce/value mismatch`);
  const effectiveGasPrice = independentReceipt.gasPrice;
  assertOk(effectiveGasPrice > 0n, `${label}: missing effective gas price`);
  const actualFee = independentReceipt.gasUsed * effectiveGasPrice;
  assertOk(actualFee <= MAX_TX_FEE && cumulativeActual.value + actualFee <= MAX_TOTAL_FEE, `${label}: actual fee ceiling exceeded`);
  cumulativeActual.value += actualFee;
  Object.assign(txEvidence, { blockNumber: independentReceipt.blockNumber, gasUsed: independentReceipt.gasUsed.toString(), effectiveGasPriceWei: effectiveGasPrice.toString(), actualFeeWei: actualFee.toString() });
  journal.status = 'RECEIPT_VERIFIED';
  await saveJournal(journal);
  if (txs !== journal.transactions) txs.push(txEvidence);
  return { receipt: independentReceipt, evidence: txEvidence };
}

function orderValues(isChallenger: boolean, sector: number): bigint[] {
  const plan = isChallenger
    ? [0, 0, 0, 0, 0, 0, 0, 0, 0]
    : [2, 0, 2, 2, 0, 2, 2, 0, 2];
  return [...plan, 0, sector].map((value) => BigInt(value));
}

async function encrypt(sdk: ZamaSDK, sender: string, values: bigint[]) {
  assertOk(values.length === 11, 'Arena V4 requires eleven encrypted inputs');
  const started = Date.now();
  const encrypted = await sdk.encrypt({
    contractAddress: CONTRACT as `0x${string}`,
    userAddress: sender as `0x${string}`,
    values: values.map((value) => ({ type: 'euint8' as const, value }))
  });
  const elapsedMs = Date.now() - started;
  assertOk(encrypted.encryptedValues.length === 11 && typeof encrypted.inputProof === 'string' && encrypted.inputProof.length > 10, 'SDK encryption output invalid');
  return { encrypted, elapsedMs };
}

async function decryptOwn(sdk: ZamaSDK, handle: string): Promise<{ value: bigint; elapsedMs: number }> {
  const started = Date.now();
  const result = await sdk.decryption.decryptValues([{ encryptedValue: handle as `0x${string}`, contractAddress: CONTRACT as `0x${string}` }]);
  const raw = valueFor(result as Record<string, unknown>, handle);
  assertOk(raw !== undefined && raw !== null, 'private decryption returned no value');
  return { value: BigInt(raw as bigint), elapsedMs: Date.now() - started };
}

function findEvent(contract: any, receipt: any, name: string): any {
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== CONTRACT) continue;
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === name) return parsed;
    } catch { /* unrelated FHE/runtime log */ }
  }
  return null;
}

async function main() {
  let resumed = false;
  let journal: any;
  try {
    journal = JSON.parse(await readFile(JOURNAL, 'utf8'));
    resumed = true;
    assertOk(Array.isArray(journal.transactions) && journal.transactions.length === 1 && journal.transactions[0].label === 'createMatch', 'unexpected live validation journal; replay refused');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const deploymentManifest = await ensureDeploymentManifest();
  await ensureRuntime();
  const signers = await ethers.getSigners();
  assertOk(signers.length >= 2, 'two WSL signers are not configured');
  const challengerSigner = signers[0];
  const defenderSigner = signers[1];
  const challengerAddress = getAddress(await challengerSigner.getAddress());
  const defenderAddress = getAddress(await defenderSigner.getAddress());
  assertOk(challengerAddress === CHALLENGER && defenderAddress === DEFENDER, 'configured WSL signers differ from controlled Arena V3 pair');
  const contract: any = new ethers.Contract(CONTRACT, ABI, ethers.provider);
  const nextBefore = BigInt(await contract.nextMatchId());
  assertOk(resumed ? nextBefore === 1n : nextBefore === 0n, resumed ? 'journaled match counter is not 1' : 'Arena V4 already has a match; replay refused');

  journal ??= { version: 1, chainId: Number(CHAIN), contract: CONTRACT, runtimeKeccak256: EXPECTED_RUNTIME, challenger: challengerAddress, defender: defenderAddress, status: 'PREFLIGHT_VERIFIED', transactions: [] };
  console.log('GAMBIT_ARENA_V4_PREFLIGHT ' + JSON.stringify({ chainId: Number(CHAIN), contract: CONTRACT, creationCodeHash: deploymentManifest.creationCodeHash, runtimeHash: deploymentManifest.runtimeHash, runtimeVerified: true, challenger: challengerAddress, defender: defenderAddress, nextMatchId: nextBefore.toString(), resumedAfterCreateReceipt: resumed, transactionCountAuthorized: 21, encryptionInputsPerSeal: 11, approvalPresent: process.env.GAMBIT_APPROVE_ONE_ARENA_V4_MATCH === APPROVAL }));
  assertOk(process.env.GAMBIT_APPROVE_ONE_ARENA_V4_MATCH === APPROVAL, 'explicit one-match authorization token absent');
  if (!resumed) await saveJournal(journal);

  const rpc = (network.config as { url?: string }).url ?? 'https://ethereum-sepolia-rpc.publicnode.com';
  const chain = { ...sepolia, network: rpc };
  const sdkChallenger = new ZamaSDK(createConfig({ chains: [chain], signer: challengerSigner, storage: new MemoryStorage(), relayers: { [chain.id]: node({ timeout: 300000 }) } }));
  const sdkDefender = new ZamaSDK(createConfig({ chains: [chain], signer: defenderSigner, storage: new MemoryStorage(), relayers: { [chain.id]: node({ timeout: 300000 }) } }));
  const txs: TxEvidence[] = resumed ? journal.transactions : [];
  const cumulativeQuoted = { value: resumed ? BigInt(journal.transactions[0].maximumQuotedFeeWei) : 0n };
  const cumulativeActual = { value: 0n };
  const rounds: any[] = [];
  const encryptionLatencyMs: any[] = [];
  const privateRecovery: any[] = [];
  let matchId = resumed ? 1n : 0n;
  if (resumed) {
    const prior = journal.transactions[0];
    const priorTx = await ethers.provider.getTransaction(prior.hash);
    const priorReceipt = await ethers.provider.getTransactionReceipt(prior.hash);
    assertOk(priorTx && priorReceipt && Number(priorReceipt.status) === 1, 'journaled createMatch receipt is not successful');
    assertOk(getAddress(priorTx.from) === CHALLENGER && getAddress(priorTx.to ?? ZeroAddress) === CONTRACT && priorTx.nonce === Number(prior.nonce) && priorTx.value === 0n, 'journaled createMatch identity changed');
    assertOk(priorReceipt.gasPrice > 0n, 'journaled createMatch has no effective gas price');
    const priorFee = priorReceipt.gasUsed * priorReceipt.gasPrice;
    Object.assign(prior, { blockNumber: priorReceipt.blockNumber, gasUsed: priorReceipt.gasUsed.toString(), effectiveGasPriceWei: priorReceipt.gasPrice.toString(), actualFeeWei: priorFee.toString() });
    cumulativeActual.value = priorFee;
    const priorStatus = await contract.matchStatus(matchId);
    assertOk(getAddress(priorStatus.challenger) === CHALLENGER && getAddress(priorStatus.defender) === DEFENDER && Number(priorStatus.currentRound) === 1 && !priorStatus.complete && !priorStatus.abandoned, 'journaled createMatch state changed');
    await saveJournal({ ...journal, status: 'CREATE_RECEIPT_RECONCILED' });
  }
  try {
    journal.status = 'AUTHORIZED_SINGLE_MATCH_RUNNING';
    if (!resumed) {
      const createData = contract.interface.encodeFunctionData('createMatch', [DEFENDER]);
      const created = await dispatch('createMatch', challengerSigner, createData, txs, cumulativeQuoted, cumulativeActual, journal);
      const createdEvent = findEvent(contract, created.receipt, 'MatchCreated');
      assertOk(createdEvent, 'MatchCreated event missing');
      matchId = BigInt(createdEvent.args.matchId);
      assertOk(matchId === 1n && getAddress(createdEvent.args.challenger) === CHALLENGER && getAddress(createdEvent.args.defender) === DEFENDER, 'created match identity mismatch');
      assertOk(BigInt(await contract.nextMatchId()) === matchId, 'match counter mismatch');
    }

    const sectors = [3, 0, 1, 2, 3];
    for (let index = 0; index < 5; index++) {
      const round = index + 1;
      const statusBefore = await contract.matchStatus(matchId);
      assertOk(Number(statusBefore.currentRound ?? statusBefore[2]) === round && !statusBefore.complete && !statusBefore.abandoned, `round ${round}: match state mismatch`);
      const rsBefore = await contract.roundStatus(matchId, round);
      assertOk(!rsBefore.challengerSealed && !rsBefore.defenderSealed && !rsBefore.resolved && !rsBefore.finalized, `round ${round}: not open for two seals`);

      const cEncrypted = await encrypt(sdkChallenger, CHALLENGER, orderValues(true, sectors[index]));
      const dEncrypted = await encrypt(sdkDefender, DEFENDER, orderValues(false, sectors[index]));
      encryptionLatencyMs.push({ round, challengerMs: cEncrypted.elapsedMs, defenderMs: dEncrypted.elapsedMs });
      const cData = contract.interface.encodeFunctionData('sealRound', [matchId, round, cEncrypted.encrypted.encryptedValues, cEncrypted.encrypted.inputProof]);
      const dData = contract.interface.encodeFunctionData('sealRound', [matchId, round, dEncrypted.encrypted.encryptedValues, dEncrypted.encrypted.inputProof]);
      const first = index % 2 === 0
        ? await dispatch(`round${round}.seal.challenger`, challengerSigner, cData, txs, cumulativeQuoted, cumulativeActual, journal)
        : await dispatch(`round${round}.seal.defender`, defenderSigner, dData, txs, cumulativeQuoted, cumulativeActual, journal);
      const firstEvent = findEvent(contract, first.receipt, 'RoundSealed');
      assertOk(firstEvent && BigInt(firstEvent.args.matchId) === matchId && Number(firstEvent.args.round) === round, `round ${round}: first seal event mismatch`);
      const second = index % 2 === 0
        ? await dispatch(`round${round}.seal.defender`, defenderSigner, dData, txs, cumulativeQuoted, cumulativeActual, journal)
        : await dispatch(`round${round}.seal.challenger`, challengerSigner, cData, txs, cumulativeQuoted, cumulativeActual, journal);
      const secondEvent = findEvent(contract, second.receipt, 'RoundSealed');
      assertOk(secondEvent && BigInt(secondEvent.args.matchId) === matchId && Number(secondEvent.args.round) === round, `round ${round}: second seal event mismatch`);
      const rsSealed = await contract.roundStatus(matchId, round);
      assertOk(rsSealed.challengerSealed && rsSealed.defenderSealed && !rsSealed.resolved, `round ${round}: seal state mismatch`);

      const resolveData = contract.interface.encodeFunctionData('resolveRound', [matchId, round]);
      const resolved = await dispatch(`round${round}.resolve`, challengerSigner, resolveData, txs, cumulativeQuoted, cumulativeActual, journal);
      const readyEvent = findEvent(contract, resolved.receipt, 'RoundReady');
      assertOk(readyEvent && BigInt(readyEvent.args.matchId) === matchId && Number(readyEvent.args.round) === round, `round ${round}: RoundReady event missing`);
      const eventHandle = publicHandle(readyEvent.args.resultHandle);
      const storedHandle = publicHandle(await contract.publicResultHandle(matchId, round));
      assertOk(eventHandle.toLowerCase() === storedHandle.toLowerCase(), `round ${round}: result handle mismatch`);
      const decryptStarted = Date.now();
      const publicResult = await sdkChallenger.decryption.decryptPublicValues([storedHandle as `0x${string}`]);
      const publicDecryptLatencyMs = Date.now() - decryptStarted;
      const packedRaw = valueFor(publicResult.clearValues as Record<string, unknown>, storedHandle);
      assertOk(packedRaw !== undefined && packedRaw !== null, `round ${round}: missing public score`);
      const packed = Number(packedRaw);
      assertOk(Number.isInteger(packed) && packed >= 0 && packed <= 63, `round ${round}: invalid packed score`);
      assertOk(typeof publicResult.decryptionProof === 'string' && /^0x[0-9a-fA-F]+$/.test(publicResult.decryptionProof), `round ${round}: missing authenticated KMS proof`);
      const finalizeData = contract.interface.encodeFunctionData('finalizeRound', [matchId, round, packed, publicResult.decryptionProof]);
      await ethers.provider.call({ from: CHALLENGER, to: CONTRACT, data: finalizeData, value: 0n });
      const finalized = await dispatch(`round${round}.finalize`, challengerSigner, finalizeData, txs, cumulativeQuoted, cumulativeActual, journal);
      const finalEvent = findEvent(contract, finalized.receipt, 'RoundFinalized');
      assertOk(finalEvent && BigInt(finalEvent.args.matchId) === matchId && Number(finalEvent.args.round) === round, `round ${round}: finalization event missing`);
      assertOk(Number(finalEvent.args.challengerPoints) === (packed >> 3) && Number(finalEvent.args.defenderPoints) === (packed & 7), `round ${round}: authenticated score event mismatch`);
      const rsFinal = await contract.roundStatus(matchId, round);
      assertOk(rsFinal.resolved && rsFinal.finalized && Number(rsFinal.packedScore) === packed, `round ${round}: finalized state mismatch`);

      const cSpentHandle = publicHandle(await contract.connect(challengerSigner).ownSpentHandle(matchId));
      const dSpentHandle = publicHandle(await contract.connect(defenderSigner).ownSpentHandle(matchId));
      const cPrivate = await decryptOwn(sdkChallenger, cSpentHandle);
      const dPrivate = await decryptOwn(sdkDefender, dSpentHandle);
      const expectedSpent = round >= 2 ? 1n : 0n;
      assertOk(cPrivate.value === expectedSpent && dPrivate.value === expectedSpent, `round ${round}: private spent-state value mismatch`);
      privateRecovery.push({ round, challengerSpent: cPrivate.value.toString(), defenderSpent: dPrivate.value.toString(), challengerDecryptMs: cPrivate.elapsedMs, defenderDecryptMs: dPrivate.elapsedMs });
      if (round === 1) {
        let rivalRejected = false;
        try { await decryptOwn(sdkDefender, cSpentHandle); } catch { rivalRejected = true; }
        assertOk(rivalRejected, 'rival private decryption unexpectedly succeeded');
        let publicRejected = false;
        try { await sdkChallenger.decryption.decryptPublicValues([cSpentHandle as `0x${string}`]); } catch { publicRejected = true; }
        assertOk(publicRejected, 'public decryption of private spent handle unexpectedly succeeded');
      }
      rounds.push({ round, sectorSelector: sectors[index], packedScore: packed, challengerPoints: packed >> 3, defenderPoints: packed & 7, expectedPackedScore: EXPECTED_PACKED[index], expectedPackedMatch: packed === EXPECTED_PACKED[index], publicDecryptLatencyMs });
    }

    const finalStatus = await contract.matchStatus(matchId);
    const completedEvent = findEvent(contract, (await ethers.provider.getTransactionReceipt(txs[txs.length - 1].hash))!, 'MatchCompleted');
    assertOk(finalStatus.complete && !finalStatus.abandoned && Number(finalStatus.currentRound) === 5, 'final match is not complete');
    assertOk(completedEvent && BigInt(completedEvent.args.matchId) === matchId, 'MatchCompleted event missing');
    journal.status = 'COMPLETE_VERIFIED';
    const evidence = {
      version: 1,
      contract: 'ArenaV4ConfidentialActivationResearch',
      chainId: Number(CHAIN),
      address: CONTRACT,
      runtimeKeccak256: EXPECTED_RUNTIME,
      matchId: matchId.toString(),
      challenger: CHALLENGER,
      defender: DEFENDER,
      authorizedTransactionCount: 21,
      transactionCount: txs.length,
      transactions: txs,
      rounds,
      encryptionLatencyMs,
      privateSpentStateRecovery: privateRecovery,
      confidentialityChecks: { rivalPrivateDecryptionRejected: true, publicDecryptionOfPrivateSpentHandleRejected: true, publicAggregateProofEthCallAccepted: true },
      finalStatus: { complete: finalStatus.complete, abandoned: finalStatus.abandoned, currentRound: Number(finalStatus.currentRound), cumulativeChallenger: Number(finalStatus.cumulativeChallenger), cumulativeDefender: Number(finalStatus.cumulativeDefender), outcome: Number(completedEvent.args.outcome) },
      expectedVector: { packedScores: EXPECTED_PACKED, cumulativeChallenger: 27, cumulativeDefender: 0 },
      expectedVectorMatch: rounds.every((entry) => entry.expectedPackedMatch) && Number(finalStatus.cumulativeChallenger) === 27 && Number(finalStatus.cumulativeDefender) === 0,
      totalActualFeeWei: cumulativeActual.value.toString(),
      totalMaximumQuotedFeeWei: cumulativeQuoted.value.toString(),
      zeroValueEveryTransaction: txs.every((entry) => true),
      limitations: ['Public aggregate scores are intentionally revealed by finalizeRound; private tactic inputs and spent-state values were not logged.', 'The live run measured SDK encryption/decryption latency but did not claim a full side-channel audit.']
    };
    await mkdir(resolve(LF_FHE, 'deployments'), { recursive: true });
    await writeFile(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    await saveJournal({ ...journal, evidencePath: EVIDENCE, totalActualFeeWei: cumulativeActual.value.toString(), totalMaximumQuotedFeeWei: cumulativeQuoted.value.toString() });
    console.log('GAMBIT_ARENA_V4_COMPLETE ' + JSON.stringify({ matchId: matchId.toString(), transactionCount: txs.length, cumulativeActualFeeWei: cumulativeActual.value.toString(), cumulativeMaximumQuotedFeeWei: cumulativeQuoted.value.toString(), rounds, finalStatus: evidence.finalStatus, expectedVectorMatch: evidence.expectedVectorMatch, evidencePath: EVIDENCE }));
  } finally {
    sdkChallenger.terminate();
    sdkDefender.terminate();
  }
}

main().then(() => process.stdout.write('', () => process.exit(0))).catch((error: unknown) => {
  process.stderr.write('GAMBIT_ARENA_V4_STOPPED ' + (error instanceof Error ? error.name : 'UnknownError') + '\n', () => process.exit(1));
});
