/**
 * GAMBIT Arena v4 — researched, EXPLICIT-APPROVAL UNSIGNED transaction intents.
 *
 * NEVER signs or sends. No default deployed v4 address, signer, wallet,
 * automatic retry, or attempt to interpret ciphertext as cleartext.
 * A caller supplied manifest MUST be independently approved by the app
 * deployment owner; this guard cannot certify manifest authority or prove
 * that a JS-supplied approval came from a human gesture.
 *
 * The real smart contract still enforces all final transaction conditions.
 * A pre-sign fresh read cannot prevent state races before transaction mining.
 */
import {Interface,getAddress,keccak256,toUtf8Bytes,formatEther} from 'ethers';
import {readArenaV4PublicMatch} from './v4-public-match-reader.mjs';

export const ARENA_V4_INTENT_VERSION=2;
export const ARENA_V4_INTENT_ACTIONS=Object.freeze([
  'SEAL_ROUND','RESOLVE_ROUND','FINALIZE_ROUND','EXPIRE_INCOMPLETE'
]);
export const ARENA_V4_WRITE_ABI=Object.freeze([
  'function sealRound(uint256 id,uint8 expectedRound,bytes32[11] encrypted,bytes inputProof)',
  'function resolveRound(uint256 id,uint8 expectedRound)',
  'function finalizeRound(uint256 id,uint8 expectedRound,uint8 packed,bytes proof)',
  'function expireIncomplete(uint256 id,uint8 expectedRound)'
]);
const WRITE_ABI=new Interface(ARENA_V4_WRITE_ABI);
const HASH=/^0x[0-9a-fA-F]{64}$/;
const HEX_BYTES=/^0x(?:[0-9a-fA-F]{2})+$/;
const INTEGER=/^(0|[1-9][0-9]*)$/;
const ZERO='0x0000000000000000000000000000000000000000';
// Conservative application cap for existing-match and creation actions only.
// Under Glamsterdam EIP-8037 the 2^24 cap is on execution gas, NOT total
// execution + state gas. Revisit this project cap after live gameplay
// estimates; deployment has its own independently reviewed budget.
export const MAX_ARENA_V4_GAS_LIMIT=16_777_216n;
const MAX_GAS_LIMIT=MAX_ARENA_V4_GAS_LIMIT;
const check=(condition,reason)=>{
  if(!condition)throw Error('ARENA_V4_INTENT_INVALID '+reason);
};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function exact(object,keys,label){
  check(object&&typeof object==='object'&&!Array.isArray(object)&&
    Object.keys(object).length===keys.length&&
    Object.keys(object).every(key=>keys.includes(key)),label);
}
function addr(value,label){
  let result;
  try{result=getAddress(value);}catch{throw Error('ARENA_V4_INTENT_INVALID '+label);}
  check(result.toLowerCase()!==ZERO,label);
  return result;
}
function positiveDecimal(value,label,allowZero=false){
  check(typeof value==='string'&&INTEGER.test(value),label);
  const n=BigInt(value);
  check(n>0n||(allowZero&&n===0n),label);
  return n;
}
function feeOf(value){
  exact(value,['gasLimit','maxFeePerGasWei','maxPriorityFeePerGasWei',
    'maximumTotalFeeWei'],'exact EIP-1559 fee quote');
  const gas=positiveDecimal(value.gasLimit,'gas limit');
  const cap=positiveDecimal(value.maxFeePerGasWei,'max fee per gas');
  const priority=positiveDecimal(value.maxPriorityFeePerGasWei,
    'max priority fee',true);
  const budget=positiveDecimal(value.maximumTotalFeeWei,'max total fee');
  check(gas>=21000n&&gas<=MAX_GAS_LIMIT,'gas limit bounds');
  check(priority<=cap,'priority fee exceeds max fee');
  check(gas*cap<=budget,'quoted upper bound exceeds consented budget');
  return Object.freeze({
    gasLimit:gas.toString(),maxFeePerGasWei:cap.toString(),
    maxPriorityFeePerGasWei:priority.toString(),
    maximumTotalFeeWei:budget.toString()
  });
}
// Shared by the separate match-creation review guard.
export {feeOf as normalizeArenaV4FeeQuote};
function bytes(value,label,maxBytes){
  check(typeof value==='string'&&HEX_BYTES.test(value)&&
    (value.length-2)/2<=maxBytes,label);
  return value;
}
function score(value){
  check(Number.isInteger(value)&&value>=0&&value<=63,'v4 packed score');
  return value;
}
function snapshotOf(view){
  check(view&&typeof view==='object'&&!Array.isArray(view)&&
    view.mode==='arena-v4-readonly-research'&&view.version===4&&
    view.trustBoundary==='caller-manifest-must-be-independently-approved'&&
    view.chainId===11155111&&typeof view.runtimeHash==='string'&&
    HASH.test(view.runtimeHash)&&typeof view.blockHash==='string'&&
    HASH.test(view.blockHash)&&Number.isSafeInteger(view.blockTag)&&
    view.blockTag>=0&&Number.isSafeInteger(view.matchId)&&
    view.matchId>=1&&Number.isInteger(view.currentRound)&&
    view.currentRound>=1&&view.currentRound<=5&&
    Array.isArray(view.rounds)&&view.rounds.length===view.currentRound&&
    typeof view.status==='string'&&
    view.activationVisibility==='confidential'&&
    view.cumulative&&Number.isInteger(view.cumulative.challenger)&&
    Number.isInteger(view.cumulative.defender),'public v4 state');
  const from=addr(view.challenger,'challenger');
  const to=addr(view.defender,'defender');
  check(from.toLowerCase()!==to.toLowerCase(),'distinct participants');
  const contract=addr(view.contract,'contract');
  const r=view.rounds.at(-1);
  check(r&&r.round===view.currentRound&&
    typeof r.challengerSealed==='boolean'&&
    typeof r.defenderSealed==='boolean'&&
    typeof r.resolved==='boolean'&&typeof r.finalized==='boolean'&&
    Number.isSafeInteger(r.openedAt)&&Number.isSafeInteger(r.deadlineAt),
    'current round');
  check((view.resultHandle===null||HASH.test(view.resultHandle))&&
    typeof view.complete==='boolean'&&typeof view.abandoned==='boolean',
    'public result and terminal flags');
  // Only public facts. No proofs, plans, sector or encrypted handles are
  // serialized into the action identity. A handle is non-secret but is
  // included only as an independently checked fingerprint in this anchor.
  const anchor={
    chainId:view.chainId,contract,runtimeHash:view.runtimeHash.toLowerCase(),
    matchId:view.matchId,currentRound:view.currentRound,
    challenger:from,defender:to,status:view.status,
    complete:view.complete,abandoned:view.abandoned,
    activationVisibility:'confidential',
    cumulative:{challenger:view.cumulative.challenger,
      defender:view.cumulative.defender},
    resultHandle:view.resultHandle?.toLowerCase()??null,
    rounds:view.rounds.map(row=>({
      round:row.round,openedAt:row.openedAt,deadlineAt:row.deadlineAt,
      challengerSealed:row.challengerSealed,
      defenderSealed:row.defenderSealed,resolved:row.resolved,
      finalized:row.finalized,
      score:row.score?{
        challenger:row.score.challenger,defender:row.score.defender,
        packed:row.score.packed,outcome:row.score.outcome
      }:null
    }))
  };
  return {view,anchor,contract,round:r};
}
const hashValue=value=>keccak256(toUtf8Bytes(JSON.stringify(value)));
function encodeAction(action,view,actor,payload){
  const r=view.rounds.at(-1);
  const participant=actor.toLowerCase()===view.challenger.toLowerCase()?
    'challenger':actor.toLowerCase()===view.defender.toLowerCase()?
    'defender':null;
  check(participant!==null,'only an invited match participant may initiate');
  check(!view.complete&&!view.abandoned,'match is closed');
  if(action==='SEAL_ROUND'){
    exact(payload,['encryptedHandles','inputProof'],
      'exact encrypted seal payload');
    check(Array.isArray(payload.encryptedHandles)&&
      payload.encryptedHandles.length===11,'exactly eleven encrypted handles');
    for(const handle of payload.encryptedHandles)
      check(typeof handle==='string'&&HASH.test(handle),
        'encrypted handle bytes32');
    const proof=bytes(payload.inputProof,'encrypted input proof',16_384);
    check(view.status==='WAITING_FOR_BOTH'||view.status==='WAITING_FOR_OPPONENT',
      'round is not accepting orders');
    check(!r[participant+'Sealed'],'participant already sealed');
    return {method:'sealRound',params:[
      view.matchId,view.currentRound,payload.encryptedHandles,proof
    ],label:'Seal private squad as '+participant+' in round '+view.currentRound+
      ' (activation encrypted)',
      note:'GAMBIT activation and target are encrypted. '+
        'The wallet receives ciphertext, not cleartext fighter tactics.'};
  }
  if(action==='RESOLVE_ROUND'){
    exact(payload,[],'empty resolution payload');
    check(view.status==='READY_TO_RESOLVE'&&r.challengerSealed&&
      r.defenderSealed&&!r.resolved,'both on-time orders required');
    return {method:'resolveRound',params:[view.matchId,view.currentRound],
      label:'Resolve round '+view.currentRound,
      note:'Neither a score nor a KMS proof is final yet.'};
  }
  if(action==='FINALIZE_ROUND'){
    exact(payload,['packedScore','kmsDecryptionProof','resultHandle'],
      'signed proof payload');
    const packed=score(payload.packedScore);
    const proof=bytes(payload.kmsDecryptionProof,'KMS proof',16_384);
    check(typeof payload.resultHandle==='string'&&HASH.test(payload.resultHandle),
      'exact stored result handle');
    check(view.status==='AWAITING_PROOF'&&r.resolved&&!r.finalized&&
      view.resultHandle?.toLowerCase()===payload.resultHandle.toLowerCase(),
      'proof is not bound to current live round handle');
    return {method:'finalizeRound',params:[view.matchId,view.currentRound,packed,proof],
      label:'Finalize round '+view.currentRound+' with proposed public score '+
        (packed>>3)+' : '+(packed&7)+' and a KMS proof',
      note:'Only the onchain contract can authenticate the proof and score.'};
  }
  if(action==='EXPIRE_INCOMPLETE'){
    exact(payload,[],'empty expiry payload');
    check(view.status==='EXPIRED_INCOMPLETE_NOT_CLOSED'&&
      (!r.challengerSealed||!r.defenderSealed)&&
      !r.resolved&&!r.finalized,'not an incomplete expired round');
    return {method:'expireIncomplete',params:[view.matchId,view.currentRound],
      label:'Close incomplete match with NO winner',
      note:'Expiry does not award a win or a forfeit to either player.'};
  }
  throw Error('ARENA_V4_INTENT_INVALID unsupported action');
}
function publicFields(intent){
  return {
    mode:intent.mode,version:intent.version,action:intent.action,
    actor:intent.actor,side:intent.side,chainId:intent.chainId,
    contract:intent.contract,runtimeHash:intent.runtimeHash,
    matchId:intent.matchId,round:intent.round,
    observedBlock:intent.observedBlock,observedBlockHash:intent.observedBlockHash,
    stateFingerprint:intent.stateFingerprint,
    calldataHash:intent.calldataHash,fee:intent.fee,
    summary:intent.summary,warning:intent.warning,consentText:intent.consentText
  };
}
function identityOf(fields){return hashValue(fields);}
function validateIntent(intent){
  check(intent&&typeof intent==='object'&&!Array.isArray(intent)&&
    intent.mode==='arena-v4-unsigned-intent-research'&&
    intent.version===ARENA_V4_INTENT_VERSION&&
    ARENA_V4_INTENT_ACTIONS.includes(intent.action)&&
    HASH.test(intent.id)&&HASH.test(intent.calldataHash)&&
    HASH.test(intent.stateFingerprint)&&HASH.test(intent.observedBlockHash)&&
    typeof intent.summary==='string'&&intent.summary.length>0&&
    typeof intent.warning==='string'&&intent.warning.length>0&&
    typeof intent.consentText==='string'&&intent.consentText.length>0,
    'unsigned intent');
  check(identityOf(publicFields(intent))===intent.id,
    'intent mutated after staging');
  check(Number.isInteger(intent.observedBlock)&&intent.observedBlock>=0,
    'observed block');
}
/**
 * Stage ONLY an unsigned public summary with a fingerprint of exact calldata.
 * The returned intent has no calldata, ciphertext, proof or signer reference.
 * This function does not independently authenticate the supplied view.
 */
export function stageArenaV4TransactionIntent(view,request){
  exact(request,['action','actor','payload','feeQuote'],'request');
  check(ARENA_V4_INTENT_ACTIONS.includes(request.action),'unsupported action');
  const {anchor,contract}=snapshotOf(view);
  const actor=addr(request.actor,'actor');
  const fee=feeOf(request.feeQuote);
  const encoded=encodeAction(request.action,view,actor,request.payload);
  const data=WRITE_ABI.encodeFunctionData(encoded.method,encoded.params);
  const side=actor.toLowerCase()===view.challenger.toLowerCase()?
    'challenger':'defender';
  const fields={
    mode:'arena-v4-unsigned-intent-research',version:ARENA_V4_INTENT_VERSION,
    action:request.action,actor,side,chainId:11155111,
    contract,runtimeHash:view.runtimeHash.toLowerCase(),
    matchId:view.matchId,round:view.currentRound,
    observedBlock:view.blockTag,observedBlockHash:view.blockHash.toLowerCase(),
    stateFingerprint:hashValue(anchor),
    calldataHash:keccak256(data),fee,
    summary:encoded.label,warning:encoded.note,
    consentText:'EXPLICIT ONE-TIME APPROVAL REQUIRED. Chain 11155111; '+
      'contract '+contract+'; actor '+actor+'; match '+view.matchId+
      '; '+encoded.label+'; maximum consented EIP-1559 budget '+
      formatEther(BigInt(fee.maximumTotalFeeWei))+' ETH ('+
      fee.maximumTotalFeeWei+' wei), transfer 0 ETH. Confirm the exact '+
      'wallet method and fee before signing.'
  };
  // The approved digest binds public ACTION TEXT as well as calldata,
  // fee, chain, actor, round, runtime and the originally read state.
  const id=identityOf(fields);
  return Object.freeze({...fields,id});
}
/**
 * Re-check a staged intent against a NEW independently read, runtime-pinned
 * public snapshot. This yields an UNSIGNED transaction request ONLY.
 *
 * exactConsentFingerprint must be supplied from a fresh, human-confirmed
 * UI gesture. A bare JS value is not cryptographic proof of human consent;
 * the final wallet screen must independently confirm the exact transaction.
 *
 * This method never calls getSigner, requestAccounts, sendTransaction,
 * signTransaction, wallet RPC or relayer.
 */
export async function revalidateArenaV4UnsignedTransaction(
  provider,independentlyApprovedManifest,intent,payload,
  exactConsentFingerprint,options={}
){
  validateIntent(intent);
  check(exactConsentFingerprint===intent.id,
    'explicit fingerprint not accepted');
  check(options&&typeof options==='object'&&!Array.isArray(options)&&
    Object.keys(options).every(key=>key==='signal'),'reader options');
  const fresh=await readArenaV4PublicMatch(
    provider,independentlyApprovedManifest,intent.matchId,options
  );
  check(fresh.blockTag>=intent.observedBlock,'fresh chain head moved backward');
  const oldBlock=await provider.getBlock(intent.observedBlock);
  if(options.signal?.aborted)throw Error('ARENA_V4_INTENT_ABORTED');
  check(oldBlock&&oldBlock.hash?.toLowerCase()===intent.observedBlockHash,
    'staged block was reorganized');
  const {anchor}=snapshotOf(fresh);
  check(hashValue(anchor)===intent.stateFingerprint,
    'match state changed; new explicit approval required');
  check(fresh.contract.toLowerCase()===intent.contract.toLowerCase()&&
    fresh.runtimeHash.toLowerCase()===intent.runtimeHash&&
    fresh.chainId===intent.chainId&&
    fresh.currentRound===intent.round,'deployment or round changed');
  const regenerated=stageArenaV4TransactionIntent(fresh,{
    action:intent.action,actor:intent.actor,payload,feeQuote:intent.fee
  });
  check(regenerated.calldataHash===intent.calldataHash,
    'ciphertext, KMS proof or calldata changed after approval');
  // The observed block can advance while the match state remains identical.
  // We deliberately compare a stable intent fingerprint instead of requiring
  // a new human click for every empty EVM block.
  const f=intent.fee;
  return Object.freeze({
    mode:'arena-v4-unsigned-transaction-proposal',
    intentId:intent.id,action:intent.action,readAtBlock:fresh.blockTag,
    to:intent.contract,from:intent.actor,chainId:intent.chainId,
    value:0n,
    gasLimit:BigInt(f.gasLimit),
    maxFeePerGas:BigInt(f.maxFeePerGasWei),
    maxPriorityFeePerGas:BigInt(f.maxPriorityFeePerGasWei),
    // Exact calldata must be handed to a wallet ONLY after explicit UI
    // approval. This return value is not a signature or broadcast.
    data:WRITE_ABI.encodeFunctionData(regenerated.action==='SEAL_ROUND'?
      'sealRound':regenerated.action==='RESOLVE_ROUND'?
      'resolveRound':regenerated.action==='FINALIZE_ROUND'?
      'finalizeRound':'expireIncomplete',
      encodeAction(intent.action,fresh,intent.actor,payload).params),
    signed:false,sent:false,
    warning:'UNSIGNED ONLY. A fresh read cannot guarantee transaction inclusion. '+
      'The contract must revalidate the state and KMS proof at execution.'
  });
}
