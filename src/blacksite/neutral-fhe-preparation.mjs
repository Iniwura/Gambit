/** Neutral BLACKSITE research SDK preparation; never signs or broadcasts.
 * Caller supplies independently approved manifest and SDK constructed with the
 * read-only wallet facade. SDK output is untrusted until onchain finalization.
 */
import {getAddress,Interface,keccak256,toUtf8Bytes} from 'ethers';
import {arenaV4ReadOnlyWallet,readArenaV4SelectedAccount} from '../arena/v4-fhe-preparation.mjs';
import {normalizeArenaV4FeeQuote} from '../arena/v4-transaction-intent.mjs';
import {readNeutralBlacksiteMission} from './neutral-public-mission-reader.mjs';
import {stageNeutralMissionIntent,revalidateNeutralMissionIntent} from './neutral-mission-intent.mjs';
import {decodeBlacksiteV3Feedback} from '../research/blacksite-v3-rules.mjs';

export const neutralBlacksiteReadOnlyWallet=arenaV4ReadOnlyWallet;
const check=(ok,why)=>{if(!ok)throw Error('NEUTRAL_BLACKSITE_PREP_INVALID '+why)};
const abort=s=>{if(s?.aborted)throw Error('NEUTRAL_BLACKSITE_PREP_ABORTED')};
const hash=/^0x[0-9a-f]{64}$/i;
const handle=x=>typeof x==='string'&&hash.test(x)&&!/^0x0{64}$/i.test(x);
const proof=x=>typeof x==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(x)&&x.length<=32770;
const digest=x=>keccak256(toUtf8Bytes(JSON.stringify(x)));
const routes=['STEALTH','PROBE','BREACH'];
const address=x=>{const a=getAddress(x);check(!/^0x0{40}$/i.test(a),'zero actor');return a};
const stable=({blockTag,blockHash,...state})=>digest(state);
async function actorCheck(wallet,actor,signal){
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
}
export function encodeNeutralBlacksiteAttempt(order){
 check(order&&typeof order==='object'&&Object.keys(order).length===2&&Object.hasOwn(order,'guess')&&Object.hasOwn(order,'route'),'exact attempt order');
 check(Array.isArray(order.guess)&&order.guess.length===5&&order.guess.every(x=>Number.isInteger(x)&&x>=0&&x<4),'five glyphs');
 check(routes.includes(order.route),'valid route');
 return Object.freeze([...order.guess,routes.indexOf(order.route)].map(x=>Object.freeze({type:'euint8',value:BigInt(x)})));
}
async function initial({wallet,provider,manifest,missionId,expectedActor,expectedAttempt,signal}){
 const actor=address(expectedActor);await actorCheck(wallet,actor,signal);
 const view=await readNeutralBlacksiteMission(provider,manifest,missionId,{signal});
 check(view.operative===actor,'not operative');
 check(Number.isInteger(expectedAttempt)&&expectedAttempt>=1&&expectedAttempt<=4&&view.attemptsUsed+1===expectedAttempt,'expected attempt changed');
 return {actor,view};
}
async function fresh(args,actor,before){
 const {wallet,provider,manifest,missionId,signal}=args;
 await actorCheck(wallet,actor,signal);
 const after=await readNeutralBlacksiteMission(provider,manifest,missionId,{signal});
 check(after.blockTag>=before.blockTag&&stable(after)===stable(before),'mission changed during preparation');
 const block=await provider.getBlock(before.blockTag);abort(signal);
 check(block?.hash?.toLowerCase()===before.blockHash.toLowerCase(),'preparation block reorganized');
 await actorCheck(wallet,actor,signal);
 return after;
}
export async function prepareNeutralBlacksiteSeal(args){
 const {actor,view}=await initial(args);
 check(view.status==='ACCEPTING_ATTEMPT'&&!view.pending,'not accepting attempts');
 const values=encodeNeutralBlacksiteAttempt(args.order);abort(args.signal);
 const result=await args.sdk.encrypt({contractAddress:view.contract,userAddress:actor,values:values.map(x=>({...x}))});
 abort(args.signal);
 check(result&&Array.isArray(result.encryptedValues)&&result.encryptedValues.length===6&&result.encryptedValues.every(handle)&&proof(result.inputProof),'SDK must return six ciphertext handles and proof');
 const after=await fresh(args,actor,view);
 const payload=Object.freeze({encryptedHandles:Object.freeze([...result.encryptedValues]),inputProof:result.inputProof});
 const intent=stageNeutralMissionIntent(after,{action:'SUBMIT_ATTEMPT',actor,payload,feeQuote:args.feeQuote});
 return Object.freeze({intent,payload,signed:false,sent:false});
}
export async function prepareNeutralBlacksiteFinalization(args){
 const {actor,view}=await initial(args);
 check(view.status==='AWAITING_PROOF'&&view.pending?.attempt===args.expectedAttempt&&handle(view.resultHandle),'not awaiting public proof');
 abort(args.signal);
 const result=await args.sdk.decryption.decryptPublicValues([view.resultHandle]);abort(args.signal);
 check(result&&result.clearValues&&Object.keys(result.clearValues).length===1&&Object.hasOwn(result.clearValues,view.resultHandle)&&proof(result.decryptionProof),'exact public result handle and proof required');
 const raw=result.clearValues[view.resultHandle];
 check((typeof raw==='bigint'&&raw>=0n&&raw<=69n)||(Number.isInteger(raw)&&raw>=0&&raw<=69),'invalid feedback value');
 const packet=Number(raw);decodeBlacksiteV3Feedback(packet);
 const after=await fresh(args,actor,view);
 const payload=Object.freeze({packet,resultHandle:view.resultHandle,kmsProof:result.decryptionProof});
 const intent=stageNeutralMissionIntent(after,{action:'FINALIZE_ATTEMPT',actor,payload,feeQuote:args.feeQuote});
 return Object.freeze({intent,payload,signed:false,sent:false,authenticated:false});
}
export async function releaseNeutralBlacksitePrepared({wallet,provider,manifest,prepared,approval,signal}){
 const actor=address(prepared.intent.actor);await actorCheck(wallet,actor,signal);
 const proposal=await revalidateNeutralMissionIntent(provider,manifest,prepared.intent,prepared.payload,approval,{signal});
 await actorCheck(wallet,actor,signal);return proposal;
}

const openAbi=new Interface(['function openMission() returns(uint256)','function activeMission(address) view returns(uint256)','function nextMissionId() view returns(uint256)']);
/** Opening is separate from existing-mission actions: no predicted ID or
 * caller-selected secret. Counter/slot are fresh-read anchors, not calldata
 * preconditions; a race before mining remains possible and contract enforces
 * one active mission. Never auto-repeat an ambiguous open transaction.
 */
async function openingState(provider,manifest,actor,signal){
 abort(signal);
 check(manifest?.contract==='NeutralBlacksiteResearch'&&manifest.version===3&&manifest.chainId===11155111&&typeof manifest.runtimeHash==='string'&&hash.test(manifest.runtimeHash),'deployment manifest');
 const contract=address(manifest.address),runtimeHash=manifest.runtimeHash.toLowerCase();
 check(BigInt((await provider.getNetwork()).chainId)===11155111n,'wrong network');
 const blockTag=await provider.getBlockNumber(),first=await provider.getBlock(blockTag);abort(signal);
 check(Number.isSafeInteger(blockTag)&&blockTag>=0&&first&&hash.test(first.hash),'block identity');
 const code=await provider.getCode(contract,blockTag);abort(signal);
 check(typeof code==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(code)&&keccak256(code).toLowerCase()===runtimeHash,'runtime hash mismatch');
 async function read(method,args){abort(signal);const raw=await provider.call({to:contract,blockTag,data:openAbi.encodeFunctionData(method,args)});abort(signal);return openAbi.decodeFunctionResult(method,raw)[0]}
 const slot=await read('activeMission',[actor]);check(slot===0n,'existing active mission; recover it instead');
 const counter=await read('nextMissionId',[]);
 const second=await provider.getBlock(blockTag);abort(signal);
 check(second?.hash?.toLowerCase()===first.hash.toLowerCase(),'block changed during read');
 return {contract,runtimeHash,blockTag,blockHash:first.hash.toLowerCase(),counter:counter.toString()};
}
export async function prepareNeutralBlacksiteOpen({wallet,provider,manifest,expectedActor,feeQuote,signal}){
 const actor=address(expectedActor);await actorCheck(wallet,actor,signal);
 const state=await openingState(provider,manifest,actor,signal);await actorCheck(wallet,actor,signal);
 const fee=normalizeArenaV4FeeQuote(feeQuote);
 const fields={mode:'neutral-blacksite-open-unsigned-research',version:1,chainId:11155111,actor,...state,fee,
  calldataHash:keccak256(openAbi.encodeFunctionData('openMission')),
  consentText:'ONE openMission() on Sepolia, contract '+state.contract+', operative '+actor+', maximum fee '+fee.maximumTotalFeeWei+' wei, zero ETH transfer. No automatic retry.'};
 return Object.freeze({...fields,id:digest(fields)});
}
export async function releaseNeutralBlacksiteOpen({wallet,provider,manifest,intent,approval,signal}){
 check(intent&&intent.mode==='neutral-blacksite-open-unsigned-research','opening intent');
 const {id,...fields}=intent;check(id===digest(fields)&&approval===id,'exact approval fingerprint');
 const actor=address(intent.actor);await actorCheck(wallet,actor,signal);
 const fresh=await openingState(provider,manifest,actor,signal);
 const original=await provider.getBlock(intent.blockTag);abort(signal);
 check(original?.hash?.toLowerCase()===intent.blockHash&&fresh.blockTag>=intent.blockTag,'opening block reorganized');
 check(fresh.contract===intent.contract&&fresh.runtimeHash===intent.runtimeHash&&fresh.counter===intent.counter,'opening state changed');
 const data=openAbi.encodeFunctionData('openMission');
 check(keccak256(data)===intent.calldataHash,'opening calldata changed');
 const fee=normalizeArenaV4FeeQuote(intent.fee);await actorCheck(wallet,actor,signal);
 return Object.freeze({mode:'neutral-blacksite-open-unsigned-proposal',intentId:id,chainId:11155111,from:actor,to:fresh.contract,data,value:0n,
  gasLimit:BigInt(fee.gasLimit),maxFeePerGas:BigInt(fee.maxFeePerGasWei),maxPriorityFeePerGas:BigInt(fee.maxPriorityFeePerGasWei),signed:false,sent:false});
}
