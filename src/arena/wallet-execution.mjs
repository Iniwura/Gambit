/**
 * Arena v3 single-action wallet boundary. NOT mounted in the game until a
 * separately reviewed v3 deployment is pinned. No automatic retries,
 * account request, chain switch, deployment or multi-transaction sequence.
 *
 * A callback's approval fingerprint is not cryptographic human consent.
 * The UI must obtain a deliberate genuine user click and show the wallet's
 * confirmation screen. Once eth_sendTransaction is invoked, cancellation
 * or a transport failure does not prove a transaction was not broadcast.
 */
import {Interface,getAddress,keccak256,toQuantity} from 'ethers';
import {revalidateArenaV3Create,ARENA_V3_INVITATION_ABI} from './invitation.mjs';
import {revalidateArenaV3UnsignedTransaction,ARENA_V3_WRITE_ABI} from './transaction-intent.mjs';
import {readArenaV3SelectedAccount} from './fhe-preparation.mjs';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const check=(ok,label)=>{if(!ok)throw Error('ARENA_V3_EXEC_INVALID '+label);};
const ABI=new Interface([...ARENA_V3_INVITATION_ABI,...ARENA_V3_WRITE_ABI,
  'event RoundSealed(uint256 indexed matchId,uint8 indexed round,address indexed who)',
  'event RoundReady(uint256 indexed matchId,uint8 indexed round,bytes32 resultHandle)',
  'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'event MatchAbandonedUnscored(uint256 indexed matchId,uint8 indexed round)'
]);
const events=Object.freeze({
  CREATE_MATCH:'MatchCreated',SEAL_ROUND:'RoundSealed',RESOLVE_ROUND:'RoundReady',
  FINALIZE_ROUND:'RoundFinalized',EXPIRE_INCOMPLETE:'MatchAbandonedUnscored'
});
const methods=Object.freeze({
  CREATE_MATCH:'createMatch',SEAL_ROUND:'sealRound',RESOLVE_ROUND:'resolveRound',
  FINALIZE_ROUND:'finalizeRound',EXPIRE_INCOMPLETE:'expireIncomplete'
});
function hash(x){check(typeof x==='string'&&HASH.test(x),'expected transaction/block hash');return x.toLowerCase();}
function address(x){return getAddress(x);}
function safeInt(x){check(Number.isSafeInteger(x)&&x>=0,'invalid block');return x;}
function abort(signal){if(signal?.aborted)throw Error('ARENA_V3_EXEC_ABORTED');}
function canonicalIntent(intent){
  check(intent&&Object.hasOwn(events,intent.action)&&typeof intent.actor==='string'&&
    HASH.test(intent.id)&&HASH.test(intent.calldataHash)&&intent.chainId===11155111,
    'reviewed intent');
  return intent;
}
function verifyProposal(proposal,intent){
  check(proposal&&proposal.intentId===intent.id&&proposal.action===intent.action&&
    proposal.signed===false&&proposal.sent===false&&proposal.chainId===11155111&&
    proposal.value===0n&&address(proposal.from)===address(intent.actor)&&
    address(proposal.to)===address(intent.contract)&&
    keccak256(proposal.data)===intent.calldataHash,'proposal differs from reviewed intent');
  const gas=BigInt(intent.fee.gasLimit),price=BigInt(intent.fee.maxFeePerGasWei);
  const priority=BigInt(intent.fee.maxPriorityFeePerGasWei);
  check(proposal.gasLimit===gas&&proposal.maxFeePerGas===price&&
    proposal.maxPriorityFeePerGas===priority&&gas*price<=BigInt(intent.fee.maximumTotalFeeWei),
    'proposal exceeds or changes reviewed fee');
  const parsed=ABI.parseTransaction({data:proposal.data});
  check(parsed?.name===methods[intent.action],'unexpected method');
  if(intent.action==='CREATE_MATCH')
    check(address(parsed.args[0])===address(intent.defender),'wrong invited defender');
  else check(parsed.args[0]===BigInt(intent.matchId)&&parsed.args[1]===BigInt(intent.round),
    'wrong match or expected round');
}
function publicRecord(intent,state,extra={}){
  return Object.freeze({intentId:intent.id,action:intent.action,actor:intent.actor,
    contract:intent.contract,chainId:intent.chainId,state,...extra});
}
/**
 * Exactly one wallet invocation per session/intent. Session is volatile:
 * app reload does NOT establish durable replay protection. The UI must retain
 * the public transaction hash and reconcile uncertain submissions before
 * another approval. CREATE_MATCH is non-idempotent; never infer retry safety.
 *
 * This is a standalone integration component, not a live mounted control.
 */
export function createArenaV3ExecutionSession({wallet,provider,manifest}){
  check(wallet&&typeof wallet.request==='function'&&provider&&manifest,
    'explicit selected wallet and independently pinned manifest required');
  const records=new Map();
  let locked=false,uncertain=false;
  async function submit({intent,payload,approval,signal}){
    canonicalIntent(intent);
    check(!locked&&!uncertain&&!records.has(intent.id),'session busy, consumed or uncertain; reconcile first');
    check(approval===intent.id,'exact explicit review required');
    // Synchronous reservation before any await blocks concurrent clicks.
    locked=true;
    let dispatched=false;
    try{
      abort(signal);
      check(await readArenaV3SelectedAccount(wallet,signal)===address(intent.actor),'selected account changed');
      const proposal=intent.action==='CREATE_MATCH'?
        await revalidateArenaV3Create(provider,manifest,intent,approval,{signal}):
        await revalidateArenaV3UnsignedTransaction(provider,manifest,intent,payload,approval,{signal});
      verifyProposal(proposal,intent);
      const exact={from:proposal.from,to:proposal.to,data:proposal.data,value:'0x0',
        chainId:toQuantity(11155111),gas:toQuantity(proposal.gasLimit),
        maxFeePerGas:toQuantity(proposal.maxFeePerGas),
        maxPriorityFeePerGas:toQuantity(proposal.maxPriorityFeePerGas),type:'0x2'};
      // Re-simulate the exact request and reject an insufficient reviewed gas
      // limit. Simulation is advisory; execution may still revert.
      const estimate=await provider.estimateGas({from:proposal.from,to:proposal.to,
        data:proposal.data,value:0n});
      abort(signal);
      check(typeof estimate==='bigint'&&estimate>0n&&estimate<=proposal.gasLimit,
        'reviewed gas limit no longer covers estimate');
      check(await readArenaV3SelectedAccount(wallet,signal)===address(intent.actor),'selected account changed');
      abort(signal);
      records.set(intent.id,publicRecord(intent,'DISPATCHED_UNKNOWN'));
      dispatched=true;
      // The ONLY write RPC. The selected wallet still requires human approval.
      const result=await wallet.request({method:'eth_sendTransaction',params:[exact]});
      const txHash=hash(result);
      const pending=publicRecord(intent,'HASH_RECEIVED',{transactionHash:txHash});
      records.set(intent.id,pending);
      return pending;
    }catch(error){
      if(dispatched){
        // Even error 4001 does not establish absence of a broadcast from a
        // dishonest provider. Do not reopen the retry path automatically.
        uncertain=true;
        return records.get(intent.id);
      }
      throw error;
    }finally{locked=false;}
  }
  return Object.freeze({submit,record:id=>records.get(id)??null,
    isLocked:()=>locked||uncertain});
}
/**
 * Reconcile only a known hash. Checks direct transaction, exact calldata,
 * fee caps, canonical receipt and exact action event. Does not use a wallet,
 * resubmit, poll, claim independent RPC truth or manufacture ranked results.
 * Public state must still be read separately before rendering a new round.
 */
export async function recoverArenaV3ActionReceipt(provider,manifest,intent,transactionHash,{signal}={}){
  canonicalIntent(intent);
  const txHash=hash(transactionHash);
  abort(signal);
  check(manifest?.contract==='ArenaV3Research'&&manifest.version===1&&
    manifest.chainId===11155111&&address(manifest.address)===address(intent.contract)&&
    hash(manifest.runtimeHash)===hash(intent.runtimeHash),'manifest does not match review');
  check((await provider.getNetwork()).chainId===11155111n,'wrong network');
  const tx=await provider.getTransaction(txHash),receipt=await provider.getTransactionReceipt(txHash);
  abort(signal);
  if(!tx||!receipt)return publicRecord(intent,'UNCONFIRMED',{transactionHash:txHash});
  check(hash(tx.hash)===txHash&&hash(receipt.hash)===txHash&&
    address(tx.from)===address(intent.actor)&&address(receipt.from)===address(intent.actor)&&
    address(tx.to)===address(intent.contract)&&address(receipt.to)===address(intent.contract)&&
    tx.chainId===11155111n&&tx.value===0n&&keccak256(tx.data)===intent.calldataHash,
    'transaction differs from reviewed request');
  const gas=BigInt(intent.fee.gasLimit),price=BigInt(intent.fee.maxFeePerGasWei);
  const priority=BigInt(intent.fee.maxPriorityFeePerGasWei);
  check(tx.type===2&&typeof tx.gasLimit==='bigint'&&tx.gasLimit<=gas&&
    typeof tx.maxFeePerGas==='bigint'&&tx.maxFeePerGas<=price&&
    typeof tx.maxPriorityFeePerGas==='bigint'&&tx.maxPriorityFeePerGas<=priority&&
    tx.gasLimit*tx.maxFeePerGas<=BigInt(intent.fee.maximumTotalFeeWei),
    'mined transaction fee exceeds review');
  const number=safeInt(receipt.blockNumber),blockHash=hash(receipt.blockHash);
  check(tx.blockNumber===number&&hash(tx.blockHash)===blockHash,'receipt block identity');
  const block=await provider.getBlock(number),height=safeInt(await provider.getBlockNumber());
  check(block&&hash(block.hash)===blockHash,'receipt reorg');
  if(height-number<2)return publicRecord(intent,'UNCONFIRMED',{transactionHash:txHash});
  const code=await provider.getCode(intent.contract,number);
  check(typeof code==='string'&&code!=='0x'&&keccak256(code)===hash(intent.runtimeHash),
    'historical runtime mismatch');
  check(typeof receipt.gasUsed==='bigint'&&receipt.gasUsed>=0n&&receipt.gasUsed<=tx.gasLimit&&
    typeof receipt.gasPrice==='bigint'&&receipt.gasPrice>=0n&&receipt.gasPrice<=tx.maxFeePerGas&&
    receipt.gasUsed*receipt.gasPrice<=BigInt(intent.fee.maximumTotalFeeWei),'actual fee exceeds review');
  check(receipt.status===0||receipt.status===1,'unknown receipt status');
  const last=await provider.getBlock(number);abort(signal);
  check(last&&hash(last.hash)===blockHash,'receipt reorg during check');
  if(receipt.status===0)return publicRecord(intent,'CONFIRMED_REVERTED',{
    transactionHash:txHash,blockNumber:number,blockHash});
  const topic=ABI.getEvent(events[intent.action]).topicHash.toLowerCase();
  const logs=receipt.logs.filter(l=>l.address?.toLowerCase()===intent.contract.toLowerCase()&&
    l.topics?.[0]?.toLowerCase()===topic);
  check(logs.length===1,'missing or duplicate exact action event');
  const log=logs[0];
  check(log.removed!==true&&hash(log.transactionHash)===txHash&&
    hash(log.blockHash)===blockHash&&log.blockNumber===number,'event identity');
  const decoded=ABI.decodeEventLog(events[intent.action],log.data,log.topics);
  const args=ABI.parseTransaction({data:tx.data}).args;
  const id=Number(decoded.matchId);
  check(Number.isSafeInteger(id)&&id>0,'event match ID');
  const fields={transactionHash:txHash,blockNumber:number,blockHash,matchId:id};
  if(intent.action==='CREATE_MATCH'){
    check(address(decoded.challenger)===address(intent.actor)&&
      address(decoded.defender)===address(intent.defender),'created participant mismatch');
  }else{
    check(id===intent.matchId&&Number(decoded.round)===intent.round,'event round mismatch');
    fields.round=intent.round;
    if(intent.action==='SEAL_ROUND')check(address(decoded.who)===address(intent.actor),'seal actor mismatch');
    if(intent.action==='RESOLVE_ROUND'){
      check(HASH.test(decoded.resultHandle)&&!/^0x0{64}$/i.test(decoded.resultHandle),'invalid result handle');
      fields.resultHandle=decoded.resultHandle;
    }
    if(intent.action==='FINALIZE_ROUND'){
      const packed=Number(args[2]);
      check(Number(decoded.challengerPoints)===(packed>>3)&&
        Number(decoded.defenderPoints)===(packed&7),'finalized score differs from reviewed calldata');
    }
  }
  return publicRecord(intent,'CONFIRMED_ACTION_RECEIPT',fields);
}
