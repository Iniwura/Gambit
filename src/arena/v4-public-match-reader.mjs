/**
 * GAMBIT Arena v4 — READ ONLY research contract public-state reader.
 *
 * No deployment is supplied by default. Caller MUST supply the independently
 * approved immutable deployment manifest. This module
 * validates public RPC facts against THAT manifest, but cannot establish
 * that an arbitrary caller-provided manifest is trustworthy.
 *
 * Not a signer, private-plan adapter, ranked history indexer or KMS client.
 */
import {Interface,getAddress,keccak256} from 'ethers';

export const ARENA_V4_PUBLIC_READER_VERSION=4;
export const ARENA_V4_READ_ONLY_ABI=Object.freeze([
  'function matchStatus(uint256 id) view returns(address challenger,address defender,uint8 currentRound,bool complete,bool abandoned,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'function roundStatus(uint256 id,uint8 round) view returns(uint64 openedAt,uint64 deadlineAt,bool challengerSealed,bool defenderSealed,bool resolved,bool finalized,uint8 packedScore)',
  'function publicResultHandle(uint256 id,uint8 round) view returns(bytes32)'
]);
const ABI=new Interface(ARENA_V4_READ_ONLY_ABI);
const ONE_DAY=86400;
const RECOVERY_GRACE=86400;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ZERO='0x0000000000000000000000000000000000000000';
function check(value,label){
  if(!value)throw Error('ARENA_V4_READ_INVALID '+label);
}
function num(value,label){
  const n=typeof value==='bigint'?Number(value):value;
  check(Number.isSafeInteger(n)&&n>=0,label);
  return n;
}
function address(value,label){
  let normalized;
  try{normalized=getAddress(value);}catch{throw Error('ARENA_V4_READ_INVALID '+label);}
  check(normalized.toLowerCase()!==ZERO,label);
  return normalized;
}
function abort(signal){
  if(signal?.aborted)throw Error('ARENA_V4_READ_ABORTED');
}
function manifestOf(value){
  check(value&&typeof value==='object'&&!Array.isArray(value)&&
    value.contract==='ArenaV4ConfidentialActivationResearch'&&value.chainId===11155111&&
    value.version===4&&typeof value.address==='string'&&
    typeof value.runtimeHash==='string'&&HASH.test(value.runtimeHash),
    'deployment manifest');
  return Object.freeze({
    contract:value.contract,chainId:value.chainId,version:value.version,
    address:address(value.address,'contract address'),
    runtimeHash:value.runtimeHash.toLowerCase()
  });
}
async function read(provider,manifest,blockTag,method,args,signal){
  abort(signal);
  const tx={to:manifest.address,data:ABI.encodeFunctionData(method,args),blockTag};
  // Only Ethereum eth_call. No provider.getSigner, wallet, or sendTransaction.
  const result=await provider.call(tx);
  abort(signal);
  try{return ABI.decodeFunctionResult(method,result);}
  catch{throw Error('ARENA_V4_READ_INVALID '+method+' ABI response');}
}
function snapshot(value){return Object.freeze(value);}
function normalizeRound(result,index,timestamp){
  const openedAt=num(result.openedAt,'round openedAt');
  const deadlineAt=num(result.deadlineAt,'round deadlineAt');
  check(openedAt>0&&openedAt<=timestamp&&deadlineAt-openedAt===ONE_DAY,
    'round time bounds');
  const sealedA=result.challengerSealed, sealedB=result.defenderSealed;
  const resolved=result.resolved, finalized=result.finalized;
  check(typeof sealedA==='boolean'&&typeof sealedB==='boolean'&&
    typeof resolved==='boolean'&&typeof finalized==='boolean',
    'round submitted and finality flags');
  check(!resolved||(sealedA&&sealedB),'resolved without both submissions');
  check(!finalized||resolved,'finalized without resolution');
  const packed=num(result.packedScore,'packed score');
  const a=packed>>3,b=packed&7;
  check(packed<=63&&a<=7&&b<=7,'bounded v3 packed score');
  check(finalized||packed===0,'unfinalized round has a score');
  return snapshot({
    round:index,openedAt,deadlineAt,
    challengerSealed:sealedA,defenderSealed:sealedB,
    resolved,finalized,
    // Unfinalized: score is ALWAYS null even if the default packed slot is 0.
    score:finalized?snapshot({challenger:a,defender:b,
      packed,outcome:a===b?0:a>b?1:2}):null
  });
}
/**
 * @param {object} provider ethers-compatible read-only provider
 * @param {object} providedManifest immutable, externally approved deployment
 * @param {number|bigint} matchId actual onchain ID; no local synthetic IDs
 * @param {object} options {signal?} no auto-retry/signer hooks
 */
export async function readArenaV4PublicMatch(provider,providedManifest,matchId,options={}){
  check(provider&&typeof provider.getNetwork==='function'&&
    typeof provider.getCode==='function'&&
    typeof provider.getBlockNumber==='function'&&
    typeof provider.getBlock==='function'&&
    typeof provider.call==='function','read-only provider');
  const trusted=manifestOf(providedManifest);
  const id=num(matchId,'match ID');
  check(id>=1&&Number.isSafeInteger(id),'match ID');
  check(options&&typeof options==='object'&&!Array.isArray(options),
    'reader options');
  const signal=options.signal;
  abort(signal);
  const network=await provider.getNetwork();
  abort(signal);
  check(num(network?.chainId,'provider chain ID')===trusted.chainId,
    'wrong network');
  const blockTag=num(await provider.getBlockNumber(),'block tag');
  const first=await provider.getBlock(blockTag);
  abort(signal);
  check(first&&HASH.test(first.hash)&&Number.isSafeInteger(first.timestamp)&&
    first.timestamp>0,'canonical block identity');
  const code=await provider.getCode(trusted.address,blockTag);
  abort(signal);
  check(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&
    code!=='0x','nonempty contract runtime');
  check(keccak256(code).toLowerCase()===trusted.runtimeHash,'runtime hash mismatch');

  const raw=await read(provider,trusted,blockTag,'matchStatus',[id],signal);
  const challenger=address(raw.challenger,'challenger');
  const defender=address(raw.defender,'defender');
  check(challenger.toLowerCase()!==defender.toLowerCase(),
    'self match');
  const currentRound=num(raw.currentRound,'current round');
  check(currentRound>=1&&currentRound<=5,'current round range');
  const complete=raw.complete,abandoned=raw.abandoned;
  check(typeof complete==='boolean'&&typeof abandoned==='boolean'&&
    !(complete&&abandoned),'terminal state');
  const totalA=num(raw.cumulativeChallenger,'cumulative challenger');
  const totalB=num(raw.cumulativeDefender,'cumulative defender');
  check(totalA<=35&&totalB<=35,'cumulative score bounds');
  const rounds=[];
  let sumA=0,sumB=0;
  for(let round=1;round<=currentRound;round++){
    const row=await read(provider,trusted,blockTag,'roundStatus',[id,round],signal);
    const normalized=normalizeRound(row,round,first.timestamp);
    const historical=round<currentRound;
    check(!historical||normalized.finalized,'unfinalized historical round');
    if(normalized.finalized){
      sumA+=normalized.score.challenger;sumB+=normalized.score.defender;
    }
    rounds.push(normalized);
  }
  check(sumA===totalA&&sumB===totalB,'cumulative score mismatch');
  const current=rounds.at(-1);
  const bothSealed=current.challengerSealed&&current.defenderSealed;
  const recoveryExpired=first.timestamp>current.deadlineAt+RECOVERY_GRACE;
  check(current&&(!current.finalized||complete),
    'current finalized without completed match');
  if(complete)check(currentRound===5&&rounds.length===5&&
    rounds.every(r=>r.finalized)&&!abandoned,'premature match victory');
  if(abandoned)check(!current.finalized&&(bothSealed?recoveryExpired:
    !current.resolved&&first.timestamp>current.deadlineAt),'invalid abandoned state');

  let status='WAITING_FOR_BOTH';
  if(complete)status='COMPLETE';
  else if(abandoned)status=bothSealed?'TECHNICAL_ABORT_UNSCORED':'ABANDONED_UNSCORED';
  else if(bothSealed&&recoveryExpired)status='RECOVERY_EXPIRED_NOT_CLOSED';
  else if(current.resolved)status='AWAITING_PROOF';
  else if(current.challengerSealed&&current.defenderSealed)
    status='READY_TO_RESOLVE';
  else if(first.timestamp>current.deadlineAt)
    status='EXPIRED_INCOMPLETE_NOT_CLOSED';
  else if(current.challengerSealed||current.defenderSealed)
    status='WAITING_FOR_OPPONENT';
  let resultHandle=null;
  if(status==='AWAITING_PROOF'){
    const handle=await read(provider,trusted,blockTag,'publicResultHandle',
      [id,currentRound],signal);
    check(HASH.test(handle[0])&&!/^0x0{64}$/i.test(handle[0]),
      'missing public KMS result handle');
    resultHandle=handle[0];
  }
  const second=await provider.getBlock(blockTag);
  abort(signal);
  check(second&&second.hash?.toLowerCase()===first.hash.toLowerCase(),
    'block changed during read');
  return snapshot({
    mode:'arena-v4-readonly-research',
    version:ARENA_V4_PUBLIC_READER_VERSION,
    // Manifest is supplied by caller, not a built-in approved deployment.
    trustBoundary:'caller-manifest-must-be-independently-approved',
    chainId:trusted.chainId,contract:trusted.address,
    runtimeHash:trusted.runtimeHash,
    blockTag,blockHash:first.hash,
    matchId:id,challenger,defender,currentRound,
    complete,abandoned,status,
    activationVisibility:'confidential',
    cumulative:snapshot({challenger:totalA,defender:totalB}),
    winner:complete?(totalA===totalB?0:totalA>totalB?1:2):null,
    resultHandle,rounds:Object.freeze(rounds)
  });
}
