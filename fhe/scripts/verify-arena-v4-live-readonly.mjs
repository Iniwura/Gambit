import { readFile, writeFile } from 'node:fs/promises';
import { JsonRpcProvider, Interface, getAddress, keccak256 } from 'ethers';

const CHAIN = 11155111n;
const CONTRACT = getAddress('0x5F9e0030233370a913780EC9CCb58183C4672c13');
const RUNTIME = '0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d';
const CHALLENGER = getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const DEFENDER = getAddress('0xcC427b61573EEE146fc735159292f06E13bc8B80');
const MAX_TX_FEE = 5_000_000_000_000_000n;
const MAX_TOTAL_FEE = 20_000_000_000_000_000n;
const JOURNAL = './.arena-v4-live-validation-journal.json';
const EVIDENCE = './deployments/sepolia-arena-v4-live-validation.json';
const iface = new Interface([
  'function nextMatchId() view returns (uint256)',
  'function createMatch(address invitedDefender) returns (uint256)',
  'function sealRound(uint256 id,uint8 expectedRound,bytes32[11] encrypted,bytes inputProof)',
  'function resolveRound(uint256 id,uint8 expectedRound)',
  'function finalizeRound(uint256 id,uint8 expectedRound,uint8 packed,bytes proof)',
  'function matchStatus(uint256 id) view returns (address,address,uint8,bool,bool,uint16,uint16)',
  'function roundStatus(uint256 id,uint8 round) view returns (uint64,uint64,bool,bool,bool,bool,uint8)',
  'function publicResultHandle(uint256 id,uint8 round) view returns (bytes32)',
  'event MatchCreated(uint256 indexed matchId,address indexed challenger,address indexed defender)',
  'event RoundSealed(uint256 indexed matchId,uint8 indexed round,address indexed who)',
  'event RoundReady(uint256 indexed matchId,uint8 indexed round,bytes32 resultHandle)',
  'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'event MatchCompleted(uint256 indexed matchId,uint8 outcome)'
]);
const providers = [
  ['PublicNode', 'https://ethereum-sepolia-rpc.publicnode.com'],
  ['Tenderly', 'https://gateway.tenderly.co/public/sepolia'],
  ['ethPandaOps', 'https://rpc.sepolia.ethpandaops.io']
];

const check = (condition, message) => { if (!condition) throw new Error(message); };
const eventFrom = (receipt, name) => receipt.logs.filter(log => getAddress(log.address) === CONTRACT).map((log) => {
  try { return iface.parseLog({ topics: log.topics, data: log.data }); } catch { return null; }
}).filter(Boolean).find((event) => event.name === name);

function expectedSender(label) {
  return label.includes('.defender') ? DEFENDER : CHALLENGER;
}

function expectedFunction(label) {
  if (label === 'createMatch') return 'createMatch';
  if (label.includes('.seal.')) return 'sealRound';
  if (label.includes('.resolve')) return 'resolveRound';
  if (label.includes('.finalize')) return 'finalizeRound';
  throw new Error(`unknown label ${label}`);
}

async function main() {
  const journal = JSON.parse(await readFile(JOURNAL, 'utf8'));
  const evidence = JSON.parse(await readFile(EVIDENCE, 'utf8'));
  const unique = [...new Map(journal.transactions.map((entry) => [entry.hash, entry])).values()];
  check(journal.transactions.length === 21 && unique.length === 21, `expected exactly 21 distinct transactions, found ${unique.length}`);
  const expectedLabels = ['createMatch', ...Array.from({length:5}, (_,i) => {const r=i+1;return [`round${r}.seal.challenger`,`round${r}.seal.defender`,`round${r}.resolve`,`round${r}.finalize`];}).flat()];
  check(new Set(unique.map(x=>x.label)).size===21 && expectedLabels.every(label=>unique.some(x=>x.label===label)), 'unexpected action set');
  check(unique[0].label === 'createMatch', 'creation is not first');
  const canonicalTransactions = [];
  let canonicalTotalFee = 0n;
  let canonicalQuotedFee = 0n;
  const providerSummaries = [];

  for (const [name, url] of providers) {
    const provider = new JsonRpcProvider(url, Number(CHAIN), { staticNetwork: true });
    const expectedNonce = new Map([[CHALLENGER, 1808], [DEFENDER, 30]]);
    check(BigInt(await provider.send('eth_chainId', [])) === CHAIN, `${name}: wrong chain`);
    let cumulativeA=0, cumulativeB=0;
    const code = await provider.getCode(CONTRACT);
    check(keccak256(code).toLowerCase() === RUNTIME.toLowerCase(), `${name}: runtime mismatch`);
    const providerTxs = [];
    let providerTotalFee = 0n;
    for (const entry of unique) {
      const tx = await provider.getTransaction(entry.hash);
      const receipt = await provider.getTransactionReceipt(entry.hash);
      check(tx && receipt && receipt.status === 1, `${name}: missing or failed ${entry.label}`);
      const sender = expectedSender(entry.label);
      check(getAddress(tx.from) === sender && tx.to !== null && getAddress(tx.to) === CONTRACT && tx.value === 0n, `${name}: ${entry.label} identity/value mismatch`);
      check(tx.nonce === expectedNonce.get(sender), `${name}: ${entry.label} nonce mismatch`);
      expectedNonce.set(sender, tx.nonce + 1);
      const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
      check(parsed?.name === expectedFunction(entry.label), `${name}: ${entry.label} calldata selector mismatch (${parsed?.name ?? 'none'} ${tx.data.slice(0, 10)} expected ${iface.getFunction(expectedFunction(entry.label))?.selector ?? 'none'})`);
      if (parsed.name !== 'createMatch') {
        check(BigInt(parsed.args[0]) === 1n && Number(parsed.args[1]) === Number(entry.label.match(/round(\d+)/)?.[1]), `${name}: ${entry.label} calldata state mismatch`);
      } else {
        check(getAddress(parsed.args[0]) === DEFENDER, `${name}: createMatch opponent mismatch`);
      }
      const block = await provider.getBlock(receipt.blockNumber);
      check(block && block.hash === receipt.blockHash, `${name}: ${entry.label} non-canonical block`);
      check(tx.hash.toLowerCase()===entry.hash.toLowerCase() && receipt.hash.toLowerCase()===entry.hash.toLowerCase(), `${name}: transaction/receipt hash mismatch`);
      const fee = receipt.gasUsed * receipt.gasPrice;
      check(tx.maxFeePerGas!==null && tx.gasLimit*tx.maxFeePerGas===BigInt(entry.maximumQuotedFeeWei) && fee<=BigInt(entry.maximumQuotedFeeWei) && BigInt(entry.maximumQuotedFeeWei)<=MAX_TX_FEE, `${name}: ${entry.label} signed fee ceiling mismatch`);
      providerTotalFee += fee;
      const txRecord = { label: entry.label, sender, nonce: String(tx.nonce), hash: entry.hash, blockNumber: receipt.blockNumber, gasLimit: tx.gasLimit.toString(), gasUsed: receipt.gasUsed.toString(), effectiveGasPriceWei: receipt.gasPrice.toString(), actualFeeWei: fee.toString(), maximumQuotedFeeWei: entry.maximumQuotedFeeWei };
      providerTxs.push(txRecord);
      if (name === 'PublicNode') {
        canonicalTransactions.push(txRecord);
        canonicalTotalFee += fee;
        canonicalQuotedFee += BigInt(entry.maximumQuotedFeeWei);
      }
      if (entry.label === 'createMatch') {
        const event = eventFrom(receipt, 'MatchCreated');
        check(event && BigInt(event.args.matchId) === 1n && getAddress(event.args.challenger) === CHALLENGER && getAddress(event.args.defender) === DEFENDER, `${name}: MatchCreated mismatch`);
      } else if (entry.label.includes('.seal.')) {
        const event = eventFrom(receipt, 'RoundSealed');
        check(event && BigInt(event.args.matchId) === 1n && Number(event.args.round)===Number(parsed.args[1]) && getAddress(event.args.who) === sender, `${name}: RoundSealed mismatch`);
      } else if (entry.label.includes('.resolve')) {
        const event=eventFrom(receipt,'RoundReady');
        check(event?.args.matchId===1n && Number(event.args.round)===Number(parsed.args[1]), `${name}: RoundReady mismatch`);
      } else {
        const event=eventFrom(receipt,'RoundFinalized'), round=Number(parsed.args[1]), packed=Number(parsed.args[2]);
        const a=packed>>3,b=packed&7;
        cumulativeA+=a;cumulativeB+=b;
        check(event?.args.matchId===1n && Number(event.args.round)===round && Number(event.args.challengerPoints)===a && Number(event.args.defenderPoints)===b && Number(event.args.cumulativeChallenger)===cumulativeA && Number(event.args.cumulativeDefender)===cumulativeB, `${name}: RoundFinalized mismatch`);
        if(round===5){const complete=eventFrom(receipt,'MatchCompleted');check(complete?.args.matchId===1n && Number(complete.args.outcome)===(cumulativeA===cumulativeB?0:cumulativeA>cumulativeB?1:2), `${name}: MatchCompleted mismatch`);}
      }
    }
    check(providerTotalFee === canonicalTotalFee || name === 'PublicNode', `${name}: fee total differs from PublicNode`);
    const nextMatchId = BigInt(iface.decodeFunctionResult('nextMatchId', await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('nextMatchId', []) }))[0]);
    const match = iface.decodeFunctionResult('matchStatus', await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('matchStatus', [1n]) }));
    check(nextMatchId === 1n && getAddress(match[0]) === CHALLENGER && getAddress(match[1]) === DEFENDER && Number(match[2]) === 5 && match[3] === true && match[4] === false, `${name}: final match state mismatch`);
    const rounds = [];
    for (let round = 1; round <= 5; round++) {
      const status = iface.decodeFunctionResult('roundStatus', await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('roundStatus', [1n, round]) }));
      check(status[2] && status[3] && status[4] && status[5], `${name}: round ${round} not fully settled`);
      rounds.push({ round, resolved: status[4], finalized: status[5], packedScore: Number(status[6]) });
    }
    check(Number(match[5])===cumulativeA&&Number(match[6])===cumulativeB && rounds.every((r,i)=>r.packedScore===[40,56,40,40,40][i]), `${name}: score vector mismatch`);
    if(name!=='PublicNode')check(JSON.stringify(providerTxs)===JSON.stringify(canonicalTransactions), `${name}: per-transaction evidence differs`);
    providerSummaries.push({ provider: name, runtimeVerified: true, transactionCount: providerTxs.length, totalActualFeeWei: providerTotalFee.toString(), finalMatch: { complete: match[3], abandoned: match[4], cumulativeChallenger: Number(match[5]), cumulativeDefender: Number(match[6]) }, rounds });
  }

  check(canonicalTransactions.length === 21 && canonicalTotalFee <= MAX_TOTAL_FEE && canonicalQuotedFee <= MAX_TOTAL_FEE, 'fee or transaction count ceiling failed');
  const final = providerSummaries[0].finalMatch;
  check(final.cumulativeChallenger === 27 && final.cumulativeDefender === 0, 'final aggregate score mismatch');
  check(providerSummaries[0].rounds.map((round) => round.packedScore).join(',') === '40,56,40,40,40', 'round score vector mismatch');
  const corrected = { ...evidence, transactionCount: 21, transactions: canonicalTransactions, totalActualFeeWei: canonicalTotalFee.toString(), totalMaximumQuotedFeeWei: canonicalQuotedFee.toString(), independentVerification: { providers: providerSummaries, runtimeHash: RUNTIME, receiptsAndCalldataVerified: true, canonicalBlocksVerified: true, zeroValueEveryTransaction: true, uniqueTransactionCount: 21, finalScoresVerified: true } };
  await writeFile(EVIDENCE, JSON.stringify(corrected, null, 2) + '\n');
  await writeFile(JOURNAL, JSON.stringify({ ...journal, status: 'COMPLETE_VERIFIED', transactionCount: 21, transactions: canonicalTransactions, totalActualFeeWei: canonicalTotalFee.toString(), totalMaximumQuotedFeeWei: canonicalQuotedFee.toString() }, null, 2) + '\n');
  console.log(JSON.stringify({ independentVerification: corrected.independentVerification, totalActualFeeWei: corrected.totalActualFeeWei, evidencePath: EVIDENCE }, null, 2));
}

main().catch((error) => {
  const detail = error instanceof AggregateError
    ? error.errors.map((item) => item instanceof Error ? item.name : 'UnknownError').join(',')
    : error instanceof Error ? error.name : 'UnknownError';
  console.error('ARENA_V4_VERIFY_STOPPED', detail, error instanceof Error ? error.message : '');
  process.exitCode = 1;
});
