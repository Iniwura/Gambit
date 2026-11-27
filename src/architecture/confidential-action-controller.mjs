/** Preparation controller: encrypt once, derive a quote from exact calldata,
 * then rebuild the public intent with the actual bounded quote. No signer,
 * storage, account authorization or transaction dispatch.
 */
import {getAddress,keccak256} from 'ethers';
import {RESEARCH_DEBRIEF_PINS} from './research-debrief.mjs';
import {readArenaV4PublicMatch} from '../arena/v4-public-match-reader.mjs';
import {readNeutralBlacksiteMission} from '../blacksite/neutral-public-mission-reader.mjs';
import {prepareArenaV4Create,releaseArenaV4Create} from '../arena/v4-create-intent.mjs';
import {prepareArenaV4Seal,prepareArenaV4Finalization,releaseArenaV4Prepared,readArenaV4SelectedAccount} from '../arena/v4-fhe-preparation.mjs';
import {stageArenaV4TransactionIntent} from '../arena/v4-transaction-intent.mjs';
import {prepareNeutralBlacksiteOpen,releaseNeutralBlacksiteOpen,prepareNeutralBlacksiteSeal,prepareNeutralBlacksiteFinalization,releaseNeutralBlacksitePrepared} from '../blacksite/neutral-fhe-preparation.mjs';
import {stageNeutralMissionIntent} from '../blacksite/neutral-mission-intent.mjs';
const CAP=5_000_000_000_000_000n,GAS=16_777_216n;
const check=(ok,label)=>{if(!ok)throw Error('CONFIDENTIAL_PREP '+label)};
const abort=signal=>check(!signal?.aborted,'cancelled');
// Internal placeholder used ONLY to encode and validate calldata without
// generating a second encryption. Never display or dispatch this quote.
const INTERNAL=Object.freeze({gasLimit:String(GAS),maxFeePerGasWei:'1',maxPriorityFeePerGasWei:'0',maximumTotalFeeWei:String(GAS)});
export async function quoteConfidentialAction(provider,tx,maximumFeeWei,signal){
 check(typeof maximumFeeWei==='string'&&/^[1-9][0-9]*$/.test(maximumFeeWei),'explicit fee budget');
 const budget=BigInt(maximumFeeWei);
 check(budget<=CAP&&tx.value===0n&&tx.chainId===11155111&&tx.signed===false&&tx.sent===false,'quote scope');
 abort(signal);
 const estimate=await provider.estimateGas({from:tx.from,to:tx.to,data:tx.data,value:0n});
 const fees=await provider.getFeeData();abort(signal);
 check(typeof estimate==='bigint'&&estimate>0n,'gas estimate');
 const limit=(estimate*125n+99n)/100n;
 const price=fees.maxFeePerGas,priority=fees.maxPriorityFeePerGas;
 check(limit<=GAS&&typeof price==='bigint'&&price>0n&&typeof priority==='bigint'&&priority>=0n&&priority<=price,'fee quote');
 check(limit*price<=budget,'fee exceeds explicit budget');
 check(await provider.getBalance(tx.from)>=limit*price,'insufficient balance');abort(signal);
 return Object.freeze({gasLimit:String(limit),maxFeePerGasWei:String(price),maxPriorityFeePerGasWei:String(priority),maximumTotalFeeWei:String(budget)});
}
/** Supported creation/existing-state paths are separately checked. The
 * caller supplies a selected wallet, read-only provider and SDK session.
 * Returned private payload must remain in volatile memory only.
 */
export async function prepareConfidentialAction(args){
 const {mode,action,wallet,provider,sdk,expectedActor,signal,maximumFeeWei}=args;
 check(mode==='arena'||mode==='blacksite','unknown mode');
 const manifest=RESEARCH_DEBRIEF_PINS[mode],actor=getAddress(expectedActor);
 const common={wallet,provider,manifest,expectedActor:actor,signal};
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');
 const create=mode==='arena'&&action==='CREATE_MATCH',open=mode==='blacksite'&&action==='OPEN_MISSION';
 const base={...common,feeQuote:INTERNAL};
 let prepared,proposal;
 if(create||open){
  const initial=create?await prepareArenaV4Create({...base,defender:args.defender}):await prepareNeutralBlacksiteOpen(base);
  prepared={intent:initial,payload:Object.freeze({})};
  proposal=create?await releaseArenaV4Create({...common,intent:initial,approval:initial.id}):await releaseNeutralBlacksiteOpen({...common,intent:initial,approval:initial.id});
 }else if(mode==='arena'){
  const view=await readArenaV4PublicMatch(provider,manifest,args.id,{signal});
  check(view.currentRound===args.step,'round changed');
  if(action==='SEAL_ROUND')prepared=await prepareArenaV4Seal({...base,sdk,matchId:args.id,expectedRound:args.step,order:args.order});
  else if(action==='FINALIZE_ROUND')prepared=await prepareArenaV4Finalization({...base,sdk,matchId:args.id,expectedRound:args.step});
  else prepared={intent:stageArenaV4TransactionIntent(view,{action,actor,payload:{},feeQuote:INTERNAL}),payload:Object.freeze({})};
  proposal=await releaseArenaV4Prepared({...common,prepared,approval:prepared.intent.id});
 }else{
  const view=await readNeutralBlacksiteMission(provider,manifest,args.id,{signal});
  check(view.attemptsUsed+1===args.step,'attempt changed');
  if(action==='SUBMIT_ATTEMPT')prepared=await prepareNeutralBlacksiteSeal({...base,sdk,missionId:args.id,expectedAttempt:args.step,order:args.order});
  else if(action==='FINALIZE_ATTEMPT')prepared=await prepareNeutralBlacksiteFinalization({...base,sdk,missionId:args.id,expectedAttempt:args.step});
  else prepared={intent:stageNeutralMissionIntent(view,{action,actor,payload:{},feeQuote:INTERNAL}),payload:Object.freeze({})};
  proposal=await releaseNeutralBlacksitePrepared({...common,prepared,approval:prepared.intent.id});
 }
 const feeQuote=await quoteConfidentialAction(provider,proposal,maximumFeeWei,signal);
 let intent;
 if(create||open){
  intent=create?await prepareArenaV4Create({...common,defender:args.defender,feeQuote}):await prepareNeutralBlacksiteOpen({...common,feeQuote});
  check(intent.counter===prepared.intent.counter,'creation state changed');
 }else if(mode==='arena'){
  const fresh=await readArenaV4PublicMatch(provider,manifest,args.id,{signal});
  intent=stageArenaV4TransactionIntent(fresh,{action,actor,payload:prepared.payload,feeQuote});
 }else{
  const fresh=await readNeutralBlacksiteMission(provider,manifest,args.id,{signal});
  intent=stageNeutralMissionIntent(fresh,{action,actor,payload:prepared.payload,feeQuote});
 }
 check(intent.calldataHash===prepared.intent.calldataHash&&intent.calldataHash===keccak256(proposal.data)&&intent.stateFingerprint===prepared.intent.stateFingerprint,'review context changed');
 const originalBlock=prepared.intent.observedBlock??prepared.intent.blockTag,originalHash=prepared.intent.observedBlockHash??prepared.intent.blockHash;
 check((await provider.getBlock(originalBlock))?.hash?.toLowerCase()===originalHash.toLowerCase(),'review block reorganized');
 check((intent.observedBlock??intent.blockTag)>=originalBlock,'head moved backward');
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');abort(signal);
 return Object.freeze({intent,payload:prepared.payload,signed:false,sent:false});
}
