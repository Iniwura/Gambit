/** V4 match creation — independently pinned, unsigned invitation review.
 * No signer, transaction, guessed ID or automatic retry.
 */
import {Interface,getAddress,keccak256,toUtf8Bytes} from 'ethers';
import {readArenaV4SelectedAccount} from './v4-fhe-preparation.mjs';
import {normalizeArenaV4FeeQuote} from './v4-transaction-intent.mjs';
const abi=new Interface(['function createMatch(address invitedDefender) returns(uint256)','function nextMatchId() view returns(uint256)']);
const check=(ok,why)=>{if(!ok)throw Error('ARENA_V4_CREATE '+why)};
const hash=/^0x[0-9a-f]{64}$/i;
const digest=x=>keccak256(toUtf8Bytes(JSON.stringify(x)));
const abort=s=>check(!s?.aborted,'cancelled');
const addr=x=>{const a=getAddress(x);check(!/^0x0{40}$/i.test(a),'zero address');return a};
async function state(provider,manifest,signal){
 abort(signal);
 check(manifest?.contract==='ArenaV4ConfidentialActivationResearch'&&manifest.version===4&&manifest.chainId===11155111&&hash.test(manifest.runtimeHash),'manifest');
 const contract=addr(manifest.address),runtimeHash=manifest.runtimeHash.toLowerCase();
 check(BigInt((await provider.getNetwork()).chainId)===11155111n,'wrong network');
 const blockTag=await provider.getBlockNumber(),block=await provider.getBlock(blockTag);abort(signal);
 check(Number.isSafeInteger(blockTag)&&blockTag>=0&&hash.test(block?.hash),'block identity');
 const code=await provider.getCode(contract,blockTag);abort(signal);
 check(typeof code==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(code)&&keccak256(code)===runtimeHash,'runtime mismatch');
 const raw=await provider.call({to:contract,blockTag,data:abi.encodeFunctionData('nextMatchId')});abort(signal);
 const counter=abi.decodeFunctionResult('nextMatchId',raw)[0];
 check(counter>=0n,'counter');
 check((await provider.getBlock(blockTag))?.hash?.toLowerCase()===block.hash.toLowerCase(),'block reorganized');abort(signal);
 return {contract,runtimeHash,blockTag,blockHash:block.hash.toLowerCase(),counter:String(counter)};
}
export async function prepareArenaV4Create({wallet,provider,manifest,expectedActor,defender,feeQuote,signal}){
 const actor=addr(expectedActor),opponent=addr(defender);check(actor!==opponent,'distinct participants');
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');
 const view=await state(provider,manifest,signal);
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');
 const fee=normalizeArenaV4FeeQuote(feeQuote),data=abi.encodeFunctionData('createMatch',[opponent]);
 const fields={mode:'arena-v4-create-unsigned-research',action:'CREATE_MATCH',version:1,chainId:11155111,actor,defender:opponent,...view,fee,calldataHash:keccak256(data),
 consentText:'ONE createMatch on Sepolia, challenger '+actor+', defender '+opponent+', contract '+view.contract+', maximum fee '+fee.maximumTotalFeeWei+' wei, zero ETH transfer.'};
 return Object.freeze({...fields,id:digest(fields)});
}
export async function releaseArenaV4Create({wallet,provider,manifest,intent,approval,signal}){
 check(intent?.mode==='arena-v4-create-unsigned-research'&&intent.action==='CREATE_MATCH','creation intent');
 const {id,...fields}=intent;check(hash.test(id)&&digest(fields)===id&&approval===id,'exact approval');
 const actor=addr(intent.actor),opponent=addr(intent.defender);check(actor!==opponent,'distinct participants');
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');
 const fresh=await state(provider,manifest,signal);
 const original=await provider.getBlock(intent.blockTag);abort(signal);
 check(original?.hash?.toLowerCase()===intent.blockHash&&fresh.blockTag>=intent.blockTag,'creation block reorganized');
 check(fresh.contract===intent.contract&&fresh.runtimeHash===intent.runtimeHash&&fresh.counter===intent.counter,'creation context changed');
 const data=abi.encodeFunctionData('createMatch',[opponent]);check(keccak256(data)===intent.calldataHash,'calldata changed');
 const fee=normalizeArenaV4FeeQuote(intent.fee);
 check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet changed');
 return Object.freeze({mode:'arena-v4-create-unsigned-proposal',intentId:id,chainId:11155111,from:actor,to:fresh.contract,data,value:0n,gasLimit:BigInt(fee.gasLimit),maxFeePerGas:BigInt(fee.maxFeePerGasWei),maxPriorityFeePerGas:BigInt(fee.maxPriorityFeePerGasWei),signed:false,sent:false});
}
