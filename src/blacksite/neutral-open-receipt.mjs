/** Read-only neutral mission opening receipt authentication.
 * A caller-supplied manifest is not an approved deployment by itself.
 * Does not sign, send, recover secrets, or grant progression.
 */
import {Interface,getAddress,keccak256} from 'ethers';
import {readNeutralBlacksiteMission} from './neutral-public-mission-reader.mjs';
const abi=new Interface([
 'function openMission() returns(uint256)',
 'function nextMissionId() view returns(uint256)',
 'event MissionOpened(uint256 indexed missionId,address indexed operative)'
]);
const hash=/^0x[0-9a-f]{64}$/i;
const check=(ok,label)=>{if(!ok)throw Error('NEUTRAL_OPEN_RECEIPT_INVALID '+label)};
const abort=s=>{if(s?.aborted)throw Error('NEUTRAL_OPEN_RECEIPT_ABORTED')};
const addr=x=>{const a=getAddress(x);check(!/^0x0{40}$/i.test(a),'zero address');return a};
const integer=x=>typeof x==='bigint'||Number.isSafeInteger(x);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export async function verifyNeutralOpenReceipt(provider,manifest,txHash,expectedOperative,options={}){
 check(options&&typeof options==='object'&&Object.keys(options).every(k=>k==='signal'),'options');
 const signal=options.signal;abort(signal);
 check(provider&&['getNetwork','getBlockNumber','getBlock','getCode','call','getTransaction','getTransactionReceipt'].every(k=>typeof provider[k]==='function'),'read-only provider');
 check(manifest?.contract==='NeutralBlacksiteResearch'&&manifest.version===3&&manifest.chainId===11155111&&typeof manifest.runtimeHash==='string'&&hash.test(manifest.runtimeHash),'deployment manifest');
 check(typeof txHash==='string'&&hash.test(txHash),'transaction hash');
 const contract=addr(manifest.address),operative=addr(expectedOperative),runtimeHash=manifest.runtimeHash.toLowerCase();
 check(BigInt((await provider.getNetwork()).chainId)===11155111n,'wrong network');abort(signal);
 const [tx,receipt]=await Promise.all([provider.getTransaction(txHash),provider.getTransactionReceipt(txHash)]);abort(signal);
 check(tx&&receipt,'missing transaction or receipt; do not retry automatically');
 check(same(tx.hash,txHash)&&same(receipt.hash,txHash),'transaction identity');
 check(receipt.status===1&&tx.chainId===11155111n&&tx.value===0n,'failed transaction, chain or value');
 check(same(tx.from,operative)&&same(receipt.from,operative)&&same(tx.to,contract)&&same(receipt.to,contract),'operative or destination mismatch');
 check(same(tx.data,abi.encodeFunctionData('openMission')),'not exact opening calldata');
 const block=receipt.blockNumber;
 check(Number.isSafeInteger(block)&&block>=0&&tx.blockNumber===block&&hash.test(receipt.blockHash)&&same(tx.blockHash,receipt.blockHash),'receipt block identity');
 const first=await provider.getBlock(block);abort(signal);
 check(first&&same(first.hash,receipt.blockHash)&&Number.isSafeInteger(first.timestamp)&&first.timestamp>0,'orphaned opening block');
 const code=await provider.getCode(contract,block);abort(signal);
 check(typeof code==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(code)&&keccak256(code).toLowerCase()===runtimeHash,'historical runtime mismatch');
 const topic=abi.getEvent('MissionOpened').topicHash;
 check(Array.isArray(receipt.logs),'receipt logs');
 const logs=receipt.logs.filter(l=>same(l.address,contract)&&same(l.topics?.[0],topic));
 check(logs.length===1,'exactly one opening event required');
 const log=logs[0];
 check(log.removed!==true&&same(log.transactionHash,txHash)&&log.blockNumber===block&&same(log.blockHash,receipt.blockHash),'event identity');
 check(log.topics.length===3&&log.data==='0x','opening event shape');
 const event=abi.parseLog(log);const id=event.args.missionId;
 check(integer(id)&&id>0n&&id<=BigInt(Number.MAX_SAFE_INTEGER)&&same(event.args.operative,operative),'opening event operative or id');
 const counterRaw=await provider.call({to:contract,blockTag:block,data:abi.encodeFunctionData('nextMissionId')});abort(signal);
 check(abi.decodeFunctionResult('nextMissionId',counterRaw)[0]>=id,'opening id exceeds historical counter');
 const view=await readNeutralBlacksiteMission(provider,manifest,id,{signal});
 check(view.blockTag>=block&&view.operative===operative&&view.openedAt===first.timestamp,'opening event/state mismatch');
 const second=await provider.getBlock(block);abort(signal);
 check(second&&same(second.hash,first.hash),'opening block reorganized');
 const current=await provider.getBlock(view.blockTag);abort(signal);
 check(current&&same(current.hash,view.blockHash),'mission snapshot reorganized');
 return Object.freeze({mode:'neutral-open-receipt-research',version:1,chainId:11155111,contract,runtimeHash,operative,missionId:Number(id),
  transactionHash:txHash.toLowerCase(),blockNumber:block,blockHash:receipt.blockHash.toLowerCase(),
  observedConfirmations:view.blockTag-block+1,view,eligibleForVerifiedProgression:false,
  trustBoundary:'caller-manifest-must-be-independently-approved'});
}
