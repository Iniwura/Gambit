/** Undeployed neutral BLACKSITE candidate read adapter.
 * Runtime pinning validates a caller-supplied manifest, not its authority.
 * No wallet, write, decryption, ranking, or verified reward integration.
 */
import {Interface,getAddress,keccak256} from 'ethers';
import {newBlacksiteV3Research,settleBlacksiteV3Research,publicBlacksiteV3Research} from '../research/blacksite-v3-rules.mjs';

export const NEUTRAL_BLACKSITE_READ_ABI=Object.freeze([
 'function missionStatus(uint256 id) view returns(address operative,uint64 openedAt,uint64 deadlineAt,uint64 recoveryDeadlineAt,uint8 attemptsUsed,uint8 heat,uint8 score,uint8 outcome)',
 'function attemptStatus(uint256 id,uint8 attempt) view returns(bool submitted,bool resolved,bool finalized,uint8 publicFeedback)',
 'function feedbackHandle(uint256 id,uint8 attempt) view returns(bytes32)',
 'function activeMission(address operative) view returns(uint256)'
]);
const abi=new Interface(NEUTRAL_BLACKSITE_READ_ABI);
const hash=/^0x[0-9a-f]{64}$/i;
const require=(ok,why)=>{if(!ok)throw Error('NEUTRAL_BLACKSITE_READ_INVALID '+why)};
function n(value,label){const number=Number(value);require((typeof value==='number'||typeof value==='bigint')&&Number.isSafeInteger(number)&&number>=0,label);return number;}
function address(value,label){let result;try{result=getAddress(value)}catch{throw Error('NEUTRAL_BLACKSITE_READ_INVALID '+label)}
 require(!/^0x0{40}$/i.test(result),label);return result;}
function abort(signal){if(signal?.aborted)throw Error('NEUTRAL_BLACKSITE_READ_ABORTED')}
/**
 * Strict assertion for the immediate post-transition terminal snapshot.
 * The contract clears activeMission when a mission becomes terminal; this is
 * intentionally stricter than the historical reader below, which permits a
 * later mission to occupy the slot after the terminal mission is recorded.
 */
export function neutralBlacksiteTerminalActiveSlotMatches(missionId,outcome,activeMission){
 const id=Number(missionId),result=Number(outcome),slot=Number(activeMission);
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(result)||result<0||
   !Number.isSafeInteger(slot)||slot<0)return false;
 return result===0?slot===id:slot===0;
}
export async function readNeutralBlacksiteMission(provider,manifest,missionId,options={}){
 require(provider&&['getNetwork','getBlockNumber','getBlock','getCode','call'].every(k=>typeof provider[k]==='function'),'read-only provider');
 require(manifest&&manifest.contract==='NeutralBlacksiteResearch'&&manifest.version===3&&manifest.chainId===11155111&&hash.test(manifest.runtimeHash),'deployment manifest');
 const contract=address(manifest.address,'contract');
 const runtimeHash=manifest.runtimeHash.toLowerCase();
 const id=n(missionId,'mission id');require(id>0,'mission id');
 require(options&&typeof options==='object'&&Object.keys(options).every(k=>k==='signal'),'options');
 const signal=options.signal;abort(signal);
 require(n((await provider.getNetwork()).chainId,'chain')===11155111,'wrong network');
 const blockTag=n(await provider.getBlockNumber(),'block');
 const first=await provider.getBlock(blockTag);abort(signal);
 require(first&&hash.test(first.hash)&&Number.isSafeInteger(first.timestamp)&&first.timestamp>0,'block identity');
 const code=await provider.getCode(contract,blockTag);abort(signal);
 require(typeof code==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(code)&&keccak256(code).toLowerCase()===runtimeHash,'runtime hash mismatch');
 async function read(method,args){
  abort(signal);const raw=await provider.call({to:contract,data:abi.encodeFunctionData(method,args),blockTag});abort(signal);
  try{return abi.decodeFunctionResult(method,raw)}catch{throw Error('NEUTRAL_BLACKSITE_READ_INVALID '+method+' ABI')}
 }
 const m=await read('missionStatus',[id]);
 const operative=address(m.operative,'operative');
 const openedAt=n(m.openedAt,'opened'),deadlineAt=n(m.deadlineAt,'deadline'),recoveryDeadlineAt=n(m.recoveryDeadlineAt,'recovery');
 require(openedAt>0&&openedAt<=first.timestamp&&deadlineAt-openedAt===86400&&recoveryDeadlineAt-deadlineAt===86400,'mission times');
 const attemptsUsed=n(m.attemptsUsed,'attempt count'),outcome=n(m.outcome,'outcome');
 require(attemptsUsed<=4&&outcome<=4,'mission bounds');
 const slot=n((await read('activeMission',[operative]))[0],'active slot');
 require(outcome===0?slot===id:slot!==id,'active slot mismatch');
 let rules=newBlacksiteV3Research('chain-'+id),pending=null;
 for(let attempt=1;attempt<=4;attempt++){
  const row=await read('attemptStatus',[id,attempt]);
  const {submitted,resolved,finalized}=row;
  const packet=n(row.publicFeedback,'packet');
  require(!resolved||submitted,'resolution without submission');
  require(!finalized||resolved,'finalization without resolution');
  require(finalized||packet===0,'unfinalized feedback');
  if(attempt<=attemptsUsed){
   require(finalized,'missing settled attempt');
   rules=settleBlacksiteV3Research(rules,attempt,packet);
  }else if(attempt===attemptsUsed+1){
   require(!finalized,'unexpected finalized attempt');
   if(submitted)pending={attempt,phase:resolved?'AWAITING_PROOF':'SEALED'};
  }else require(!submitted&&!resolved&&!finalized,'future attempt populated');
 }
 const history=publicBlacksiteV3Research(rules);
 require(n(m.heat,'heat')===history.heat&&n(m.score,'score')===history.score,'score or heat mismatch');
 if(outcome===1||outcome===2)require(!pending&&history.status===(outcome===1?'BREACHED':'LOCKED'),'terminal outcome mismatch');
 else require(history.status==='ACTIVE','premature terminal history');
 if(outcome===3)require(!pending&&first.timestamp>deadlineAt,'invalid expiry');
 if(outcome===4)require(pending&&first.timestamp>recoveryDeadlineAt,'invalid technical abort');
 let status='ACCEPTING_ATTEMPT',resultHandle=null;
 if(outcome)status=['','BREACHED','LOCKED','EXPIRED','TECHNICAL_ABORT'][outcome];
 else if(pending&&first.timestamp>recoveryDeadlineAt)status='RECOVERY_EXPIRED_NOT_CLOSED';
 else if(pending)status=pending.phase;
 else if(first.timestamp>deadlineAt)status='EXPIRED_NOT_CLOSED';
 if(status==='AWAITING_PROOF'){
  const value=(await read('feedbackHandle',[id,pending.attempt]))[0];
  require(hash.test(value)&&!/^0x0{64}$/i.test(value),'missing public result handle');resultHandle=value;
 }
 const second=await provider.getBlock(blockTag);abort(signal);
 require(second&&second.hash?.toLowerCase()===first.hash.toLowerCase(),'block changed during read');
 return Object.freeze({mode:'neutral-blacksite-readonly-research',version:3,
  trustBoundary:'caller-manifest-must-be-independently-approved',
  chainId:11155111,contract,runtimeHash,blockTag,blockHash:first.hash,missionId:id,operative,
  openedAt,deadlineAt,recoveryDeadlineAt,attemptsUsed,heat:history.heat,score:history.score,
  status,history:history.history,pending:outcome?null:pending?Object.freeze(pending):null,resultHandle,
  eligibleForVerifiedProgression:false});
}
