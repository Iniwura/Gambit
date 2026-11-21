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

const ABI=new Interface([
  'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)',
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns(uint256)',
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
const BRAND=new WeakSet();
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
export async function verifyArenaProfileRecord(provider,duelId,config){
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
  const [head,code]=await Promise.all([
    provider.getBlock('latest'),provider.getCode(address)
  ]);
  check(head&&Number.isSafeInteger(head.number)&&
    head.number>=config.fromBlock,'latest canonical block');
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
  check(receipt&&tx&&eventBlock&&receipt.status===1,
    'missing or reverted finalization');
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
  const [duelThen,squadThen,linkedThen,duelNow,squadNow,linkedNow]=
    await Promise.all([
      readAt(provider,address,receipt.blockNumber,'duelStatus',[duelId]),
      // Squad ID comes from the SAME mined block.
      (async()=>{
        const d=await readAt(provider,address,receipt.blockNumber,
          'duelStatus',[duelId]);
        return readAt(provider,address,receipt.blockNumber,'squadStatus',
          [d.squadId]);
      })(),
      (async()=>{
        const d=await readAt(provider,address,receipt.blockNumber,
          'duelStatus',[duelId]);
        return readAt(provider,address,receipt.blockNumber,'duelForSquad',
          [d.squadId]);
      })(),
      readAt(provider,address,head.number,'duelStatus',[duelId]),
      (async()=>{
        const d=await readAt(provider,address,head.number,
          'duelStatus',[duelId]);
        return readAt(provider,address,head.number,'squadStatus',[d.squadId]);
      })(),
      (async()=>{
        const d=await readAt(provider,address,head.number,
          'duelStatus',[duelId]);
        return readAt(provider,address,head.number,'duelForSquad',[d.squadId]);
      })()
    ]);
  const shapeD=d=>({
    squadId:BigInt(d.squadId),challenger:d.challenger,
    submitted:Boolean(d.submitted),resolved:Boolean(d.resolved),
    finalized:Boolean(d.finalized),expired:Boolean(d.expired),
    packedScore:BigInt(d.packedScore),openedAt:BigInt(d.openedAt)
  });
  const shapeS=s=>({
    owner:s.owner,allowedOpponent:s.allowedOpponent,
    active:Boolean(s.active),claimed:Boolean(s.claimed)
  });
  const atReceipt=verifyFinalizedSquadSnapshot(
    duelId,shapeD(duelThen),shapeS(squadThen),BigInt(linkedThen[0]));
  const atHead=verifyFinalizedSquadSnapshot(
    duelId,shapeD(duelNow),shapeS(squadNow),BigInt(linkedNow[0]));
  check(atReceipt.squadId===atHead.squadId&&
    atHead.pointsChallenger===pointsChallenger&&
    atHead.pointsDefender===pointsDefender&&
    atReceipt.pointsChallenger===pointsChallenger&&
    atReceipt.pointsDefender===pointsDefender&&
    atReceipt.outcome===outcome&&atHead.outcome===outcome&&
    same(squadThen.owner,squadNow.owner)&&
    same(duelThen.challenger,duelNow.challenger),
    'canonical state and event disagree');
  const record=Object.freeze({
    version:1,chainId:11155111,
    contractAddress:address,runtimeHash:normHash(config.runtimeHash),
    squadId:atHead.squadId.toString(),duelId:duelId.toString(),
    transactionHash:receipt.hash,blockNumber:receipt.blockNumber,
    blockHash:receipt.blockHash,
    defender:getAddress(squadNow.owner),
    challenger:getAddress(duelNow.challenger),
    pointsChallenger,pointsDefender,outcome,
    confirmations:head.number-receipt.blockNumber+1,
    evidence:'canonical-sepolia-receipt'
  });
  BRAND.add(record);
  return record;
}
/**
 * Aggregate ONLY branded records generated by verifyArenaProfileRecord.
 * Re-verify the canonical chain before reuse after reorg/network errors.
 * No source in localStorage or caller JSON is accepted as profile wins.
 */
export function deriveCommanderArenaProfile(walletAddress,records){
  const wallet=getAddress(walletAddress);
  check(Array.isArray(records)&&records.length<=1000,'record collection');
  const unique=new Map();
  for(const item of records){
    check(item&&typeof item==='object'&&BRAND.has(item),
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
    source:'fresh-independent-public-sepolia-evidence',
    matches:history.length,wins:won,losses:lost,draws:drawn,
    verifiedHistory:Object.freeze(history)
  });
}
