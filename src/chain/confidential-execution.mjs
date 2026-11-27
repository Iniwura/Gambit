/** Shared one-action boundary for the pinned confidential research deployments.
 * No wallet discovery, account request, auto-send, auto-retry or private storage.
 * A real UI must supply a deliberate consent gesture and an exclusive lock
 * (e.g. Web Locks across tabs). A persistent reservation is mandatory before
 * eth_sendTransaction. An ambiguous response stays blocked until reconciled.
 */
import {Interface,getAddress,keccak256,toQuantity} from 'ethers';
import {RESEARCH_DEBRIEF_PINS} from '../architecture/research-debrief.mjs';
import {readArenaV4SelectedAccount} from '../arena/v4-fhe-preparation.mjs';
import {revalidateArenaV4UnsignedTransaction,ARENA_V4_WRITE_ABI} from '../arena/v4-transaction-intent.mjs';
import {revalidateNeutralMissionIntent,NEUTRAL_MISSION_WRITE_ABI} from '../blacksite/neutral-mission-intent.mjs';
import {releaseNeutralBlacksiteOpen} from '../blacksite/neutral-fhe-preparation.mjs';
const HASH=/^0x[0-9a-f]{64}$/i;
const check=(ok,reason)=>{if(!ok)throw Error('CONFIDENTIAL_EXEC '+reason)};
const hash=x=>{check(typeof x==='string'&&HASH.test(x),'hash');return x.toLowerCase()};
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const abort=signal=>check(!signal?.aborted,'cancelled');
const CHAIN=11155111;
const MAX_FEE=5_000_000_000_000_000n;
const ABI=new Interface([...ARENA_V4_WRITE_ABI,...NEUTRAL_MISSION_WRITE_ABI.filter(x=>!x.includes('abortUnsettled(uint256 id)')),
 'function abortUnsettled(uint256 id)',
 'function openMission() returns(uint256)',
 'event RoundSealed(uint256 indexed matchId,uint8 indexed round,address indexed who)',
 'event RoundReady(uint256 indexed matchId,uint8 indexed round,bytes32 resultHandle)',
 'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
 'event MatchAbandonedUnscored(uint256 indexed matchId,uint8 indexed round)',
 'event MatchTechnicalAbort(uint256 indexed matchId,uint8 indexed round)',
 'event MissionOpened(uint256 indexed missionId,address indexed operative)',
 'event AttemptSubmitted(uint256 indexed missionId,uint8 indexed attempt)',
 'event AttemptReady(uint256 indexed missionId,uint8 indexed attempt,bytes32 feedbackHandle)',
 'event AttemptFinalized(uint256 indexed missionId,uint8 indexed attempt,uint8 publicFeedback,uint8 heat,uint8 score)',
 'event MissionExpired(uint256 indexed missionId)',
 'event MissionTechnicalAbort(uint256 indexed missionId,uint8 pendingAttempt)']);
const ACTIONS=Object.freeze({
 arena:Object.freeze({SEAL_ROUND:['sealRound','RoundSealed'],RESOLVE_ROUND:['resolveRound','RoundReady'],FINALIZE_ROUND:['finalizeRound','RoundFinalized'],EXPIRE_INCOMPLETE:['expireIncomplete','MatchAbandonedUnscored'],ABORT_UNSETTLED:['abortUnsettled','MatchTechnicalAbort']}),
 blacksite:Object.freeze({OPEN_MISSION:['openMission','MissionOpened'],SUBMIT_ATTEMPT:['submitAttempt','AttemptSubmitted'],RESOLVE_ATTEMPT:['resolveAttempt','AttemptReady'],FINALIZE_ATTEMPT:['finalizeAttempt','AttemptFinalized'],EXPIRE_MISSION:['expireMission','MissionExpired'],ABORT_UNSETTLED:['abortUnsettled','MissionTechnicalAbort']})
});
function reviewed(mode,intent){
 check(Object.hasOwn(ACTIONS,mode),'mode');
 const pin=RESEARCH_DEBRIEF_PINS[mode],action=intent.action??(mode==='blacksite'&&intent.mode==='neutral-blacksite-open-unsigned-research'?'OPEN_MISSION':null);
 check(Object.hasOwn(ACTIONS[mode],action)&&intent.chainId===CHAIN&&eq(intent.contract,pin.address)&&eq(intent.runtimeHash,pin.runtimeHash),'pinned review');
 check(Object.isFrozen(intent)&&Object.isFrozen(intent.fee),'immutable review');
 const actor=getAddress(intent.actor),gas=BigInt(intent.fee.gasLimit),price=BigInt(intent.fee.maxFeePerGasWei),priority=BigInt(intent.fee.maxPriorityFeePerGasWei),budget=BigInt(intent.fee.maximumTotalFeeWei);
 check(gas>=21000n&&gas<=16_777_216n&&price>0n&&priority>=0n&&priority<=price&&gas*price<=budget&&budget<=MAX_FEE,'fee boundary');
 const id=action==='OPEN_MISSION'?null:mode==='arena'?intent.matchId:intent.missionId;
 const step=action==='OPEN_MISSION'?null:mode==='arena'?intent.round:intent.attempt;
 check(id===null||(Number.isSafeInteger(id)&&id>0),'record id');
 check(step===null||(Number.isInteger(step)&&step>=1&&step<=(mode==='arena'?5:4)),'round/attempt');
 return Object.freeze({mode,action,actor,contract:pin.address,runtimeHash:pin.runtimeHash,chainId:CHAIN,intentId:hash(intent.id),calldataHash:hash(intent.calldataHash),id,step,gasLimit:String(gas),maxFeePerGasWei:String(price),maxPriorityFeePerGasWei:String(priority),maximumFeeWei:String(budget),observedBlock:intent.observedBlock??intent.blockTag,observedBlockHash:hash(intent.observedBlockHash??intent.blockHash)});
}
function verifyProposal(r,p){
 check(p.intentId===r.intentId&&p.chainId===CHAIN&&p.signed===false&&p.sent===false&&p.value===0n&&eq(p.from,r.actor)&&eq(p.to,r.contract)&&hash(keccak256(p.data))===r.calldataHash,'proposal identity');
 check(p.gasLimit===BigInt(r.gasLimit)&&p.maxFeePerGas===BigInt(r.maxFeePerGasWei)&&p.maxPriorityFeePerGas===BigInt(r.maxPriorityFeePerGasWei),'proposal fee changed');
 check(ABI.parseTransaction({data:p.data})?.name===ACTIONS[r.mode][r.action][0],'method mismatch');
}
/** journal.read(), journal.reserve(record), journal.update(record) must be
 * durable and fail closed. lock(fn) must provide exclusive same-origin access.
 * No private payload/calldata is written to the journal.
 */
export function createConfidentialExecution({mode,wallet,provider,journal,lock}){
 check(wallet&&provider&&journal&&typeof lock==='function','execution dependencies');
 let used=false,busy=false;
 async function submit({intent,payload={},approval,signal}){
  const record=reviewed(mode,intent);
  check(!busy&&!used&&approval===record.intentId,'one fresh approval required');
  busy=true;
  try{return await lock(async()=>{
   check(!used&&!journal.read(),'pending or ambiguous action; reconcile first');
   abort(signal);
   check(await readArenaV4SelectedAccount(wallet,signal)===record.actor,'wallet account changed');
   const manifest=RESEARCH_DEBRIEF_PINS[mode];
   const proposal=mode==='arena'?await revalidateArenaV4UnsignedTransaction(provider,manifest,intent,payload,approval,{signal}):
    record.action==='OPEN_MISSION'?await releaseNeutralBlacksiteOpen({wallet,provider,manifest,intent,approval,signal}):
    await revalidateNeutralMissionIntent(provider,manifest,intent,payload,approval,{signal});
   verifyProposal(record,proposal);
   const estimate=await provider.estimateGas({from:proposal.from,to:proposal.to,data:proposal.data,value:0n});
   check(typeof estimate==='bigint'&&estimate>0n&&estimate<=proposal.gasLimit,'gas review stale');
   const nonce=await provider.getTransactionCount(record.actor,'pending');
   check(Number.isSafeInteger(nonce)&&nonce>=0&&nonce===await provider.getTransactionCount(record.actor,'latest'),'pending nonce');
   check(await provider.getBalance(record.actor)>=proposal.gasLimit*proposal.maxFeePerGas,'insufficient balance');
   check(await readArenaV4SelectedAccount(wallet,signal)===record.actor,'wallet changed');abort(signal);
   const reserved=Object.freeze({...record,nonce,state:'DISPATCHED_UNKNOWN'});
   journal.reserve(reserved);used=true;
   let result;
   try{
    result=await wallet.request({method:'eth_sendTransaction',params:[{from:record.actor,to:record.contract,data:proposal.data,value:'0x0',chainId:toQuantity(CHAIN),nonce:toQuantity(nonce),gas:toQuantity(proposal.gasLimit),maxFeePerGas:toQuantity(proposal.maxFeePerGas),maxPriorityFeePerGas:toQuantity(proposal.maxPriorityFeePerGas),type:'0x2'}]});
    const pending=Object.freeze({...reserved,state:'HASH_RECEIVED',transactionHash:hash(result)});
    journal.update(pending);return pending;
   }catch{return reserved;}
  });}finally{busy=false;}
 }
 return Object.freeze({submit,isConsumed:()=>used});
}
/** Read-only reconciliation of a durable public reservation and a known hash.
 * No polling, signer, automatic journal clearing or claims about rewards.
 */
export async function reconcileConfidentialAction(provider,r,transactionHash,{signal}={}){
 check(r&&Object.hasOwn(ACTIONS,r.mode)&&Object.hasOwn(ACTIONS[r.mode],r.action),'journal action');
 const pin=RESEARCH_DEBRIEF_PINS[r.mode],txHash=hash(transactionHash);
 check(r.chainId===CHAIN&&eq(r.contract,pin.address)&&eq(r.runtimeHash,pin.runtimeHash)&&(!r.transactionHash||eq(r.transactionHash,txHash)),'journal deployment/hash');
 abort(signal);check(BigInt((await provider.getNetwork()).chainId)===11155111n,'wrong chain');
 const [tx,receipt]=await Promise.all([provider.getTransaction(txHash),provider.getTransactionReceipt(txHash)]);abort(signal);
 if(!tx||!receipt)return Object.freeze({state:'UNCONFIRMED',transactionHash:txHash});
 check(eq(tx.hash,txHash)&&eq(receipt.hash,txHash)&&eq(tx.from,r.actor)&&eq(receipt.from,r.actor)&&eq(tx.to,r.contract)&&eq(receipt.to,r.contract)&&tx.chainId===11155111n&&tx.value===0n&&tx.nonce===r.nonce&&hash(keccak256(tx.data))===hash(r.calldataHash),'receipt transaction mismatch');
 check(tx.type===2&&typeof tx.maxFeePerGas==='bigint'&&typeof tx.maxPriorityFeePerGas==='bigint'&&tx.gasLimit<=BigInt(r.gasLimit)&&tx.maxFeePerGas<=BigInt(r.maxFeePerGasWei)&&tx.maxPriorityFeePerGas<=BigInt(r.maxPriorityFeePerGasWei)&&tx.gasLimit*tx.maxFeePerGas<=BigInt(r.maximumFeeWei),'signed fee mismatch');
 const block=receipt.blockNumber;
 check(Number.isSafeInteger(block)&&block>r.observedBlock&&tx.blockNumber===block&&eq(tx.blockHash,receipt.blockHash),'receipt block');
 const [origin,canonical,head,code]=await Promise.all([provider.getBlock(r.observedBlock),provider.getBlock(block),provider.getBlockNumber(),provider.getCode(r.contract,block)]);abort(signal);
 check(eq(origin?.hash,r.observedBlockHash)&&eq(canonical?.hash,receipt.blockHash)&&eq(keccak256(code),pin.runtimeHash),'canonical/runtime mismatch');
 check(receipt.gasUsed<=tx.gasLimit&&receipt.gasPrice<=tx.maxFeePerGas&&receipt.gasUsed*receipt.gasPrice<=BigInt(r.maximumFeeWei),'actual fee mismatch');
 if(head-block<2)return Object.freeze({state:'UNCONFIRMED',transactionHash:txHash});
 check(receipt.status===0||receipt.status===1,'receipt status');
 let id=r.id;
 if(receipt.status===1){
  const [method,eventName]=ACTIONS[r.mode][r.action],parsed=ABI.parseTransaction({data:tx.data});
  check(parsed?.name===method,'method mismatch');
  const event=ABI.getEvent(eventName);
  const logs=receipt.logs.filter(l=>eq(l.address,r.contract)&&eq(l.topics?.[0],event.topicHash));
  check(logs.length===1,'exact event required');
  const log=logs[0];check(!log.removed&&eq(log.transactionHash,txHash)&&eq(log.blockHash,receipt.blockHash)&&log.blockNumber===block,'event identity');
  const args=ABI.decodeEventLog(eventName,log.data,log.topics);
  if(r.action==='OPEN_MISSION'){id=Number(args.missionId);check(Number.isSafeInteger(id)&&id>0&&eq(args.operative,r.actor),'opening event');}
  else {
   check(Number(args.matchId??args.missionId)===r.id&&Number(parsed.args[0])===r.id,'event id');
   if(r.action!=='EXPIRE_MISSION')check(Number(args.round??args.attempt??args.pendingAttempt)===r.step,'event step');
   if(r.action==='SEAL_ROUND')check(eq(args.who,r.actor),'seal actor');
   if(r.action==='FINALIZE_ROUND'){const packed=Number(parsed.args[2]);check(Number(args.challengerPoints)===(packed>>3)&&Number(args.defenderPoints)===(packed&7),'score mismatch');}
   if(r.action==='FINALIZE_ATTEMPT')check(Number(args.publicFeedback)===Number(parsed.args[2]),'feedback mismatch');
  }
 }
 abort(signal);check(eq((await provider.getBlock(block))?.hash,receipt.blockHash),'receipt reorg');
 return Object.freeze({state:receipt.status===1?'CONFIRMED_ACTION_RECEIPT':'CONFIRMED_REVERTED',transactionHash:txHash,blockNumber:block,blockHash:receipt.blockHash,id,actualFeeWei:String(receipt.gasUsed*receipt.gasPrice)});
}
