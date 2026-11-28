/**
 * GAMBIT Commander Profile — read-only VERIFIED PUBLIC Arena evidence boundary.
 *
 * A profile win cannot be created from submitted JSON, local practice,
 * wallet UI text or a pending transaction. Only a record independently
 * checked against the Sepolia contract runtime, canonical receipt,
 * DuelFinalized event, transaction calldata/proof and current onchain
 * linked squad/duel state is branded as a profile record.
 *
 * Uses no signer, private tactic, wallet connection or transaction. The
 * minimum confirmation count reduces reorg risk, but is not a guarantee
 * of irrevocable finality. Reverify records after long disconnects.
 */
import {Interface,getAddress,keccak256} from 'ethers';
import {verifyFinalizedSquadSnapshot} from '../chain/squad-public-verify.mjs';
import {approveGambitProfileDeployment} from './trusted-deployments.mjs';

const ABI=new Interface([
  'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)',
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns(uint256)',
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
const TRUSTED_BRAND=new WeakSet();
const RESEARCH_BRAND=new WeakSet();
const HEX32=/^0x[0-9a-fA-F]{64}$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  getAddress(a)===getAddress(b);
const check=(ok,message)=>{if(!ok)throw Error('PROFILE_EVIDENCE_INVALID '+message);};
const uint=(x)=>typeof x==='bigint'&&x>0n&&x<(1n<<256n);
const hash=(v)=>typeof v==='string'&&HEX32.test(v);
const normHash=v=>v.toLowerCase();
const readAt=async(provider,address,block,method,args)=>{
  const data=ABI.encodeFunctionData(method,args);
  return ABI.decodeFunctionResult(method,
    await provider.call({to:address,data,blockTag:block}));
};
/**
 * @param {object} provider ethers JsonRpcProvider or test-compatible
 *   read-only provider; never a signer or a browser wallet.
 * @param {bigint} duelId positive onchain duel ID.
 * @param {object} config {contractAddress,runtimeHash,fromBlock,minimumConfirmations?}
 */
async function verifyArenaProfileRecordInternal(provider,duelId,config,brand){
  check(uint(duelId),'duel ID');
  check(config&&typeof config==='object'&&hash(config.runtimeHash),
    'pinned runtime hash');
  check(Number.isSafeInteger(config.fromBlock)&&config.fromBlock>=0,
    'verified deployment start block');
  const confirmations=config.minimumConfirmations??12;
  check(Number.isSafeInteger(confirmations)&&confirmations>=12&&
    confirmations<=5000,'minimum confirmations');
  const address=getAddress(config.contractAddress);
  check(address!=='0x0000000000000000000000000000000000000000',
    'contract address');
  check(BigInt(await provider.send('eth_chainId',[]))===11155111n,
    'Ethereum Sepolia network');
  const head=await provider.getBlock('latest');
  check(head&&Number.isSafeInteger(head.number)&&
    head.number>=config.fromBlock&&hash(head.hash),
    'latest canonical block');
  // Pin every read to the same candidate head. The final head-hash
  // confirmation below fails closed if this block is reorganized.
  const code=await provider.getCode(address,head.number);
  check(code&&code!=='0x'&&normHash(keccak256(code))===
    normHash(config.runtimeHash),'contract runtime fingerprint');

  // Real RPC providers may cap eth_getLogs windows; use bounded, sequential
  // queries to avoid silently ignoring older matches.
  const topics=ABI.encodeFilterTopics('DuelFinalized',[duelId]);
  const found=[];
  for(let from=config.fromBlock;from<=head.number;from+=1900){
    const to=Math.min(from+1899,head.number);
    const part=await provider.getLogs({
      address,fromBlock:from,toBlock:to,topics
    });
    check(Array.isArray(part),'public event lookup');
    found.push(...part);
    check(found.length<=1,'duplicate public finalizations');
  }
  check(found.length===1,'missing canonical DuelFinalized event');
  const eventLog=found[0];
  const parsed=ABI.parseLog(eventLog);
  check(parsed?.name==='DuelFinalized'&&BigInt(parsed.args.duelId)===duelId,
    'event identity');
  const [receipt,tx,eventBlock]=await Promise.all([
    provider.getTransactionReceipt(eventLog.transactionHash),
    provider.getTransaction(eventLog.transactionHash),
    provider.getBlock(eventLog.blockNumber)
  ]);
  check(receipt&&tx&&eventBlock&&receipt.status===1&&
    hash(eventBlock.hash)&&eventBlock.hash===receipt.blockHash,
    'missing/reverted/orphaned finalization block');
  check(eventLog.blockHash===receipt.blockHash&&
    tx.blockHash===receipt.blockHash&&
    receipt.blockNumber===eventLog.blockNumber&&
    receipt.blockNumber<=head.number,'noncanonical receipt');
  check(hash(receipt.blockHash)&&hash(receipt.hash)&&
    normHash(receipt.hash)===normHash(eventLog.transactionHash)&&
    normHash(tx.hash)===normHash(eventLog.transactionHash),
    'transaction identity');
  check(same(tx.to,address)&&same(receipt.to,address)&&
    tx.value===0n,'wrong destination or transferred ETH');
  check(head.number-receipt.blockNumber+1>=confirmations,
    'not enough canonical confirmations');
  const call=ABI.parseTransaction({data:tx.data,value:tx.value});
  check(call?.name==='finalizeDuel'&&BigInt(call.args.duelId)===duelId,
    'wrong calldata selector or duel');
  check(typeof call.args.proof==='string'&&
    /^0x([0-9a-fA-F]{2})+$/.test(call.args.proof),
    'missing signed KMS proof');
  const packed=Number(call.args.packedScore);
  const pointsChallenger=Number(parsed.args.pointsChallenger);
  const pointsDefender=Number(parsed.args.pointsDefender);
  const outcome=Number(parsed.args.outcome);
  check(pointsChallenger>=0&&pointsChallenger<=5&&
    pointsDefender>=0&&pointsDefender<=5&&
    packed===pointsChallenger*8+pointsDefender&&
    outcome===(pointsChallenger===pointsDefender?0:
      pointsChallenger>pointsDefender?1:2),
    'calldata/event aggregate mismatch');
  const events=receipt.logs.filter(log=>{
    if(!same(log.address,address))return false;
    try{return ABI.parseLog(log)?.name==='DuelFinalized'}catch{return false}
  });
  check(events.length===1&&
    normHash(events[0].transactionHash)===normHash(eventLog.transactionHash),
    'event not unique in canonical receipt');
  // Canonical receipt + event is proof of the mined finalization; current
  // views establish that its score and participants still agree. Historical
  // eth_call at the receipt block is intentionally NOT required: many public
  // Sepolia RPCs do not provide archival state. This avoids a false negative
  // without trusting an arbitrary score or skipping receipt/event checks.
  const duelNow=await readAt(provider,address,head.number,'duelStatus',[duelId]);
  const [squadNow,linkedNow]=await Promise.all([
    readAt(provider,address,head.number,'squadStatus',[duelNow.squadId]),
    readAt(provider,address,head.number,'duelForSquad',[duelNow.squadId])
  ]);
  const snapshot=verifyFinalizedSquadSnapshot(
    duelId,{
      squadId:BigInt(duelNow.squadId),
      challenger:duelNow.challenger,
      submitted:Boolean(duelNow.submitted),
      resolved:Boolean(duelNow.resolved),
      finalized:Boolean(duelNow.finalized),
      expired:Boolean(duelNow.expired),
      packedScore:BigInt(duelNow.packedScore),
      openedAt:BigInt(duelNow.openedAt)
    },{
      owner:squadNow.owner,
      allowedOpponent:squadNow.allowedOpponent,
      active:Boolean(squadNow.active),
      claimed:Boolean(squadNow.claimed)
    },BigInt(linkedNow[0]));
  check(snapshot.pointsChallenger===pointsChallenger&&
    snapshot.pointsDefender===pointsDefender&&snapshot.outcome===outcome,
    'canonical state and event disagree');
  const reconfirmedHead=await provider.getBlock(head.number);
  check(reconfirmedHead&&reconfirmedHead.hash===head.hash,
    'head changed during Profile evidence check (possible reorg)');
  const record=Object.freeze({
    version:1,chainId:11155111,
    contractAddress:address,runtimeHash:normHash(config.runtimeHash),
    squadId:snapshot.squadId.toString(),duelId:duelId.toString(),
    transactionHash:receipt.hash,blockNumber:receipt.blockNumber,
    blockHash:receipt.blockHash,
    defender:getAddress(squadNow.owner),
    challenger:getAddress(duelNow.challenger),
    pointsChallenger,pointsDefender,outcome,
    confirmations:head.number-receipt.blockNumber+1,
    evidence:'canonical-sepolia-receipt'
  });
  brand.add(record);
  return record;
}
/**
 * Production path: only pre-approved immutable GAMBIT deployments.
 * Callers cannot self-certify a new contract by supplying its own bytecode
 * hash. New deployments require an explicit reviewed registry change.
 */
export async function verifyArenaProfileRecord(provider,duelId,config){
  const approved=approveGambitProfileDeployment(config);
  return verifyArenaProfileRecordInternal(
    provider,duelId,approved,TRUSTED_BRAND);
}
/**
 * Headless unit-test/research path ONLY. Does not mint an eligible
 * commander leaderboard/win record; never use for a user-facing profile.
 */
export async function verifyResearchArenaProfileRecord(provider,duelId,config){
  return verifyArenaProfileRecordInternal(
    provider,duelId,config,RESEARCH_BRAND);
}
/**
 * Aggregate ONLY branded records generated by verifyArenaProfileRecord.
 * Re-verify the canonical chain before reuse after reorg/network errors.
 * No source in localStorage or caller JSON is accepted as profile wins.
 */
function deriveCommanderArenaProfileInternal(walletAddress,records,brand,source){
  const wallet=getAddress(walletAddress);
  check(Array.isArray(records)&&records.length<=1000,'record collection');
  const unique=new Map();
  for(const item of records){
    check(item&&typeof item==='object'&&brand.has(item),
      'unverified or fabricated Arena record');
    check(same(item.challenger,wallet)||same(item.defender,wallet),
      'record not owned by player');
    const key=item.chainId+':'+item.contractAddress+':'+item.duelId;
    const prior=unique.get(key);
    if(prior){
      check(prior.transactionHash.toLowerCase()===
        item.transactionHash.toLowerCase()&&
        prior.blockHash.toLowerCase()===item.blockHash.toLowerCase(),
        'conflicting duel finalization or reorg');
    }else unique.set(key,item);
  }
  const history=[...unique.values()]
    .sort((a,b)=>a.blockNumber-b.blockNumber||
      a.duelId.localeCompare(b.duelId));
  let won=0,lost=0,drawn=0;
  for(const event of history){
    const playerIsChallenger=same(event.challenger,wallet);
    const sideWon=event.outcome===(playerIsChallenger?1:2);
    if(event.outcome===0)drawn++;
    else if(sideWon)won++;
    else lost++;
  }
  return Object.freeze({
    version:1,chainId:11155111,wallet,
    source,
    matches:history.length,wins:won,losses:lost,draws:drawn,
    verifiedHistory:Object.freeze(history)
  });
}
export function deriveCommanderArenaProfile(walletAddress,records){
  return deriveCommanderArenaProfileInternal(
    walletAddress,records,TRUSTED_BRAND,
    'approved-gambit-canonical-sepolia-evidence');
}
/**
 * Isolated mocks/research stats. Does not imply an approved contract,
 * a real wallet result, a rank, achievements or a playable Profile.
 */
export function deriveResearchArenaProfile(walletAddress,records){
  return deriveCommanderArenaProfileInternal(
    walletAddress,records,RESEARCH_BRAND,
    'LOCAL_MOCK_RESEARCH_NOT_PLAYER_EVIDENCE');
}
