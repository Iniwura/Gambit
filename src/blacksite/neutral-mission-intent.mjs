/** Research-only unsigned transaction boundary for an existing neutral mission.
 * No default deployment, signer, auto retry or wallet. An intent is not consent:
 * only the app's real user gesture and wallet can authorize a write.
 */
import {Interface,getAddress,keccak256,toUtf8Bytes} from 'ethers';
import {readNeutralBlacksiteMission} from './neutral-public-mission-reader.mjs';
import {decodeBlacksiteV3Feedback} from '../research/blacksite-v3-rules.mjs';
import {normalizeArenaV4FeeQuote} from '../arena/v4-transaction-intent.mjs';
export const NEUTRAL_MISSION_WRITE_ABI=Object.freeze([
 'function submitAttempt(uint256 id,uint8 expected,bytes32[5] encryptedGuess,bytes32 encryptedApproach,bytes inputProof)',
 'function resolveAttempt(uint256 id,uint8 expected)',
 'function finalizeAttempt(uint256 id,uint8 expected,uint8 packet,bytes proof)',
 'function expireMission(uint256 id)',
 'function abortUnsettled(uint256 id)'
]);
const abi=new Interface(NEUTRAL_MISSION_WRITE_ABI),hash=/^0x[0-9a-f]{64}$/i;
const check=(ok,label)=>{if(!ok)throw Error('NEUTRAL_MISSION_INTENT_INVALID '+label)};
const digest=x=>keccak256(toUtf8Bytes(JSON.stringify(x)));
function exact(value,keys){check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'exact fields')}
function handle(x){check(typeof x==='string'&&hash.test(x)&&!/^0x0{64}$/i.test(x),'ciphertext handle');return x}
function proof(x){check(typeof x==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(x)&&x.length<=32770,'proof bytes');return x}
function anchor(view){
 check(view&&view.mode==='neutral-blacksite-readonly-research'&&view.version===3&&view.chainId===11155111&&view.eligibleForVerifiedProgression===false&&
  view.trustBoundary==='caller-manifest-must-be-independently-approved'&&hash.test(view.runtimeHash)&&hash.test(view.blockHash)&&
  Number.isSafeInteger(view.missionId)&&view.missionId>0&&Number.isSafeInteger(view.attemptsUsed)&&view.attemptsUsed>=0&&view.attemptsUsed<=4&&
  Number.isSafeInteger(view.blockTag)&&view.blockTag>=0,'research view');
 const {blockTag,blockHash,...publicState}=view;
 return digest(publicState);
}
function encode(view,action,actor,payload){
 check(getAddress(view.operative)===actor,'only operative may initiate from this client');
 const id=view.missionId,a=view.attemptsUsed+1;
 if(action==='SUBMIT_ATTEMPT'){
  exact(payload,['encryptedHandles','inputProof']);
  check(view.status==='ACCEPTING_ATTEMPT'&&a<=4&&!view.pending,'not accepting attempts');
  check(Array.isArray(payload.encryptedHandles)&&payload.encryptedHandles.length===6,'six encrypted inputs');
  const h=payload.encryptedHandles.map(handle);
  return ['submitAttempt',[id,a,h.slice(0,5),h[5],proof(payload.inputProof)]];
 }
 if(action==='FINALIZE_ATTEMPT'){
  exact(payload,['packet','resultHandle','kmsProof']);
  check(view.status==='AWAITING_PROOF'&&view.pending?.attempt===a&&handle(payload.resultHandle).toLowerCase()===view.resultHandle?.toLowerCase(),'wrong pending proof context');
  decodeBlacksiteV3Feedback(payload.packet);
  return ['finalizeAttempt',[id,a,payload.packet,proof(payload.kmsProof)]];
 }
 exact(payload,[]);
 if(action==='RESOLVE_ATTEMPT'){check(view.status==='SEALED'&&view.pending?.attempt===a,'not sealed');return ['resolveAttempt',[id,a]];}
 if(action==='EXPIRE_MISSION'){check(view.status==='EXPIRED_NOT_CLOSED'&&!view.pending,'not expired');return ['expireMission',[id]];}
 if(action==='ABORT_UNSETTLED'){check(view.status==='RECOVERY_EXPIRED_NOT_CLOSED'&&view.pending?.attempt===a,'not overdue');return ['abortUnsettled',[id]];}
 throw Error('NEUTRAL_MISSION_INTENT_INVALID unknown action');
}
export function stageNeutralMissionIntent(view,request){
 exact(request,['action','actor','payload','feeQuote']);
 const stateFingerprint=anchor(view),actor=getAddress(request.actor),fee=normalizeArenaV4FeeQuote(request.feeQuote);
 const [method,args]=encode(view,request.action,actor,request.payload);
 const data=abi.encodeFunctionData(method,args);
 const fields={mode:'neutral-mission-unsigned-intent-research',version:1,action:request.action,actor,chainId:11155111,
  contract:getAddress(view.contract),runtimeHash:view.runtimeHash.toLowerCase(),missionId:view.missionId,attempt:view.attemptsUsed+1,
  observedBlock:view.blockTag,observedBlockHash:view.blockHash.toLowerCase(),stateFingerprint,calldataHash:keccak256(data),fee,
  consentText:'ONE TRANSACTION ONLY: '+method+' on Sepolia (11155111), contract '+view.contract+', operative '+actor+
   ', mission '+view.missionId+', maximum total fee '+fee.maximumTotalFeeWei+' wei, transfer 0 ETH.'};
 return Object.freeze({...fields,id:digest(fields)});
}
export async function revalidateNeutralMissionIntent(provider,manifest,intent,payload,consentFingerprint,options={}){
 check(intent&&typeof intent==='object','intent');
 const {id,...fields}=intent;
 check(hash.test(id)&&id===digest(fields)&&consentFingerprint===id,'exact approval fingerprint');
 const fresh=await readNeutralBlacksiteMission(provider,manifest,intent.missionId,options);
 check(fresh.blockTag>=intent.observedBlock,'head moved backward');
 const original=await provider.getBlock(intent.observedBlock);
 check(original?.hash?.toLowerCase()===intent.observedBlockHash,'staged block reorganized');
 if(options.signal?.aborted)throw Error('NEUTRAL_MISSION_INTENT_ABORTED');
 check(anchor(fresh)===intent.stateFingerprint,'mission state changed');
 const regenerated=stageNeutralMissionIntent(fresh,{action:intent.action,actor:intent.actor,payload,feeQuote:intent.fee});
 check(regenerated.calldataHash===intent.calldataHash&&regenerated.contract===intent.contract&&regenerated.runtimeHash===intent.runtimeHash,'calldata or deployment changed');
 const [method,args]=encode(fresh,intent.action,intent.actor,payload);
 return Object.freeze({mode:'neutral-mission-unsigned-proposal',intentId:id,chainId:11155111,from:intent.actor,to:intent.contract,
  value:0n,gasLimit:BigInt(intent.fee.gasLimit),maxFeePerGas:BigInt(intent.fee.maxFeePerGasWei),maxPriorityFeePerGas:BigInt(intent.fee.maxPriorityFeePerGasWei),
  data:abi.encodeFunctionData(method,args),signed:false,sent:false});
}
