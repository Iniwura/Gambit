/**
 * Real SDK preparation path, deliberately WITHOUT signing. The adapter receives
 * an independently pinned deployment and an explicitly selected, already
 * authorized wallet. No account prompt, chain switching or signing RPC.
 *
 * An SDK result is a candidate, not proof of execution. Only contract
 * finalization authenticates the KMS proof and score. No secret is persisted.
 */
import {getAddress} from 'ethers';
import {encodeSquadInputs} from '../chain/squad-lifecycle.mjs';
import {readArenaV4PublicMatch} from './v4-public-match-reader.mjs';
import {stageArenaV4TransactionIntent,revalidateArenaV4UnsignedTransaction}
  from './v4-transaction-intent.mjs';

const HEX32=/^0x[0-9a-fA-F]{64}$/;
const PROOF=/^0x(?:[0-9a-fA-F]{2})+$/;
const check=(ok,label)=>{if(!ok)throw Error('ARENA_V4_PREP_INVALID '+label);};
const abort=signal=>{if(signal?.aborted)throw Error('ARENA_V4_PREP_ABORTED');};
const validProof=x=>typeof x==='string'&&PROOF.test(x)&&x.length<=32770;
const addr=x=>{
  const a=getAddress(x);
  check(a!=='0x'+'0'.repeat(40),'zero account');
  return a;
};
/** No implicit requestAccounts, wallet selection, transaction or signature. */
export async function readArenaV4SelectedAccount(wallet,signal){
  abort(signal);
  const chain=await wallet.request({method:'eth_chainId'});
  abort(signal);
  check(typeof chain==='string'&&/^0x[0-9a-fA-F]+$/.test(chain)&&
    BigInt(chain)===11155111n,'select Ethereum Sepolia');
  const accounts=await wallet.request({method:'eth_accounts'});
  abort(signal);
  check(Array.isArray(accounts)&&typeof accounts[0]==='string','no authorized account');
  return addr(accounts[0]);
}
/**
 * SDK and ethers receive a deliberately read-only EIP-1193 facade. It
 * never forwards unknown methods or requests accounts/signatures.
 */
const READ_RPC=new Set([
  'eth_chainId','eth_accounts','net_version','eth_blockNumber','eth_getBlockByNumber',
  'eth_getBlockByHash','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice',
  'eth_maxPriorityFeePerGas','eth_feeHistory','eth_getBalance','eth_getTransactionCount',
  'eth_getTransactionByHash','eth_getTransactionReceipt','eth_getLogs'
]);
export function arenaV4ReadOnlyWallet(wallet){
  check(wallet&&typeof wallet.request==='function','selected wallet');
  return Object.freeze({
    request(args){
      check(args&&READ_RPC.has(args.method),'RPC method is not read-only');
      return wallet.request(args);
    },
    // SDK lifecycle wiring expects the standard EIP-1193 event surface.
    // Deliberately inert: the Arena session never subscribes to or emits
    // account/network changes through this read-only facade.
    on(){},removeListener(){}
  });
}
export function encodeArenaV4EncryptedOrder(order){
  check(order&&typeof order==='object'&&Object.keys(order).length===3&&
    ['plans','formation','stakeSector'].every(k=>Object.hasOwn(order,k)),'exact order');
  const values=encodeSquadInputs(order.plans,order.formation);
  const sector=order.stakeSector;
  check(sector===null||(Number.isInteger(sector)&&sector>=0&&sector<=2),
    'optional visual sector');
  return Object.freeze({
    values:Object.freeze([...values,BigInt(sector??3)].map(value=>
      Object.freeze({value,type:'euint8'})))
  });
}
function seat(view,actor){
  if(view.challenger===actor)return 'challenger';
  if(view.defender===actor)return 'defender';
  throw Error('ARENA_V4_PREP_INVALID not an invited participant');
}
function sealAllowed(view,actor){
  const side=seat(view,actor),r=view.rounds.at(-1);
  check(['WAITING_FOR_BOTH','WAITING_FOR_OPPONENT'].includes(view.status)&&
    !r[side+'Sealed'],'round is not accepting this player');
}
function proofAllowed(view,actor){
  seat(view,actor);
  check(view.status==='AWAITING_PROOF'&&typeof view.resultHandle==='string'&&
    HEX32.test(view.resultHandle),'round is not awaiting a public proof');
}
function sameState(a,b){
  // The reader returns only allowlisted immutable public data. New blocks
  // without a match change are fine, any relevant public transition is not.
  const stable=({blockTag,blockHash,...publicState})=>JSON.stringify(publicState);
  check(stable(a)===stable(b)&&b.blockTag>=a.blockTag,'match changed during preparation');
}
/**
 * No SDK calls until account and exact current match are checked. The
 * caller creates the SDK with the read-only facade, never a raw provider.
 * Return only opaque encrypted inputs and a public review intent.
 */
export async function prepareArenaV4Seal({
  wallet,provider,manifest,sdk,matchId,expectedActor,expectedRound,order,feeQuote,signal
}){
  const actor=addr(expectedActor);
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  const before=await readArenaV4PublicMatch(provider,manifest,matchId,{signal});
  check(before.currentRound===expectedRound,'expected round changed');
  const input=encodeArenaV4EncryptedOrder(order);
  sealAllowed(before,actor);
  abort(signal);
  const result=await sdk.encrypt({contractAddress:before.contract,userAddress:actor,
    values:input.values.map(v=>({...v}))});
  abort(signal);
  check(result&&Array.isArray(result.encryptedValues)&&result.encryptedValues.length===11&&
    result.encryptedValues.every(h=>typeof h==='string'&&HEX32.test(h)&&!/^0x0{64}$/i.test(h))&&
    validProof(result.inputProof),'SDK did not return eleven ciphertext handles and proof');
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  const after=await readArenaV4PublicMatch(provider,manifest,matchId,{signal});
  sameState(before,after);
  const payload=Object.freeze({encryptedHandles:Object.freeze([...result.encryptedValues]),
    inputProof:result.inputProof});
  const intent=stageArenaV4TransactionIntent(after,{action:'SEAL_ROUND',actor,payload,feeQuote});
  return Object.freeze({intent,payload,signed:false,sent:false});
}
export async function prepareArenaV4Finalization({
  wallet,provider,manifest,sdk,matchId,expectedActor,expectedRound,feeQuote,signal
}){
  const actor=addr(expectedActor);
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  const before=await readArenaV4PublicMatch(provider,manifest,matchId,{signal});
  check(before.currentRound===expectedRound,'expected round changed');
  proofAllowed(before,actor);
  const result=await sdk.decryption.decryptPublicValues([before.resultHandle]);
  abort(signal);
  check(result&&result.clearValues&&Object.hasOwn(result.clearValues,before.resultHandle)&&
    validProof(result.decryptionProof),'missing exact result handle or KMS proof');
  const raw=result.clearValues[before.resultHandle];
  check((typeof raw==='bigint'&&raw>=0n&&raw<=63n)||
    (Number.isInteger(raw)&&raw>=0&&raw<=63),'invalid v4 public aggregate');
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  const after=await readArenaV4PublicMatch(provider,manifest,matchId,{signal});
  sameState(before,after);
  const payload=Object.freeze({packedScore:Number(raw),kmsDecryptionProof:result.decryptionProof,
    resultHandle:before.resultHandle});
  const intent=stageArenaV4TransactionIntent(after,{action:'FINALIZE_ROUND',actor,payload,feeQuote});
  return Object.freeze({intent,payload,signed:false,sent:false,authenticated:false});
}
/** Final preflight only; caller must still obtain a separate genuine user action. */
export async function releaseArenaV4Prepared({wallet,provider,manifest,prepared,approval,signal}){
  const actor=addr(prepared.intent.actor);
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  const proposal=await revalidateArenaV4UnsignedTransaction(provider,manifest,
    prepared.intent,prepared.payload,approval,{signal});
  check(await readArenaV4SelectedAccount(wallet,signal)===actor,'wallet account changed');
  return proposal;
}
