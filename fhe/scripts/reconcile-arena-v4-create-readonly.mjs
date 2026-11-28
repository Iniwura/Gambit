import { JsonRpcProvider, Interface, getAddress, keccak256 } from 'ethers';

const CHAIN = 11155111n;
const CONTRACT = getAddress('0x5F9e0030233370a913780EC9CCb58183C4672c13');
const TX_HASH = '0x5e43b8e64167a317beb68edd41b573bd32143930da25ae2db440813f1d92e3ca';
const SENDER = getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const RUNTIME = '0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d';
const iface = new Interface([
  'function nextMatchId() view returns (uint256)',
  'function matchStatus(uint256 id) view returns (address,address,uint8,bool,bool,uint16,uint16)',
  'event MatchCreated(uint256 indexed matchId,address indexed challenger,address indexed defender)'
]);
const providers = [
  ['PublicNode', 'https://ethereum-sepolia-rpc.publicnode.com'],
  ['Tenderly', 'https://gateway.tenderly.co/public/sepolia'],
  ['ethPandaOps', 'https://rpc.sepolia.ethpandaops.io']
];

async function main() {
  const results = [];
  for (const [name, url] of providers) {
    const provider = new JsonRpcProvider(url, Number(CHAIN), { staticNetwork: true });
    const net = await provider.getNetwork();
    if (net.chainId !== CHAIN) throw new Error(`${name}: wrong chain`);
    const code = await provider.getCode(CONTRACT);
    if (keccak256(code).toLowerCase() !== RUNTIME.toLowerCase()) throw new Error(`${name}: runtime mismatch`);
    const tx = await provider.getTransaction(TX_HASH);
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (!tx || !receipt || receipt.status !== 1) throw new Error(`${name}: missing or failed receipt`);
    if (getAddress(tx.from) !== SENDER || getAddress(tx.to ?? CONTRACT) !== CONTRACT || tx.nonce !== 1808 || tx.value !== 0n) throw new Error(`${name}: transaction identity mismatch`);
    const matchCreated = receipt.logs.map((log) => {
      try { return iface.parseLog({ topics: log.topics, data: log.data }); } catch { return null; }
    }).find((event) => event?.name === 'MatchCreated');
    const nextMatchId = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('nextMatchId', []) });
    const matchStatus = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('matchStatus', [1n]) });
    const decodedStatus = iface.decodeFunctionResult('matchStatus', matchStatus);
    results.push({
      provider: name,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      from: tx.from,
      to: tx.to,
      nonce: tx.nonce,
      valueWei: tx.value.toString(),
      gasLimit: tx.gasLimit.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPriceWei: receipt.gasPrice.toString(),
      actualFeeWei: (receipt.gasUsed * receipt.gasPrice).toString(),
      matchCreated: matchCreated ? { matchId: matchCreated.args.matchId.toString(), challenger: matchCreated.args.challenger, defender: matchCreated.args.defender } : null,
      nextMatchId: BigInt(iface.decodeFunctionResult('nextMatchId', nextMatchId)[0]).toString(),
      matchStatus: { challenger: getAddress(decodedStatus[0]), defender: getAddress(decodedStatus[1]), currentRound: Number(decodedStatus[2]), complete: decodedStatus[3], abandoned: decodedStatus[4], cumulativeChallenger: Number(decodedStatus[5]), cumulativeDefender: Number(decodedStatus[6]) }
    });
  }
  console.log(JSON.stringify({ independentReceiptVerification: results }, null, 2));
}

main().catch((error) => { console.error('RECONCILE_STOPPED', error instanceof Error ? error.name : 'UnknownError'); process.exitCode = 1; });
