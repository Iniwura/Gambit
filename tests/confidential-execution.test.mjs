import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {prepareArenaV4Create,releaseArenaV4Create} from '../src/arena/v4-create-intent.mjs';
import {createConfidentialBrowserJournal,createConfidentialBrowserLock} from '../src/chain/confidential-browser-journal.mjs';
import {createConfidentialExecution,reconcileConfidentialAction} from '../src/chain/confidential-execution.mjs';
import {RESEARCH_DEBRIEF_PINS} from '../src/architecture/research-debrief.mjs';
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),C='0x'+'3'.repeat(40),H='0x'+'4'.repeat(64),H2='0x'+'5'.repeat(64);
const fee={gasLimit:'1000000',maxFeePerGasWei:'1000',maxPriorityFeePerGasWei:'2',maximumTotalFeeWei:'1000000000'};
function fixture(){
 const code='0x6000',manifest={contract:'ArenaV4ConfidentialActivationResearch',version:4,chainId:11155111,address:C,runtimeHash:keccak256(code)};
 const abi=new Interface(['function nextMatchId() view returns(uint256)','function createMatch(address invitedDefender) returns(uint256)']);
 const state={counter:4n,account:A,chain:11155111,code,hash:H,writes:0};
 const provider={async getNetwork(){return {chainId:BigInt(state.chain)}},async getBlockNumber(){return 42},async getBlock(){return {hash:state.hash}},async getCode(){return state.code},async call(tx){assert.equal(tx.to,C);assert.equal(tx.blockTag,42);assert.equal(abi.parseTransaction({data:tx.data}).name,'nextMatchId');return abi.encodeFunctionResult('nextMatchId',[state.counter]);}};
 const wallet={async request({method}){if(method==='eth_accounts')return [state.account];if(method==='eth_chainId')return '0xaa36a7';state.writes++;throw Error('unexpected write')}};
 const args={wallet,provider,manifest,expectedActor:A,defender:B,feeQuote:fee};
 return {state,provider,wallet,args,abi,manifest};
}
test('V4 invitation creation binds exact participants, counter and fee, without signing',async()=>{
 const f=fixture(),intent=await prepareArenaV4Create(f.args);
 const tx=await releaseArenaV4Create({...f.args,intent,approval:intent.id});
 assert.equal(tx.signed,false);assert.equal(tx.sent,false);assert.equal(tx.value,0n);
 assert.equal(f.abi.parseTransaction({data:tx.data}).args[0],B);assert.equal(f.state.writes,0);
 assert.equal(intent.counter,'4');assert.equal(Object.isFrozen(intent),true);
 await assert.rejects(releaseArenaV4Create({...f.args,intent,approval:H2}),/exact approval/);
 f.state.counter++;await assert.rejects(releaseArenaV4Create({...f.args,intent,approval:intent.id}),/creation context changed/);
});
test('V4 invitation refuses self invitation, stale wallet and runtime',async()=>{
 const f=fixture();await assert.rejects(prepareArenaV4Create({...f.args,defender:A}),/distinct participants/);
 f.state.account=B;await assert.rejects(prepareArenaV4Create(f.args),/wallet changed/);
 f.state.account=A;f.state.code='0x6001';await assert.rejects(prepareArenaV4Create(f.args),/runtime mismatch/);
});
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
const record=()=>({mode:'arena',action:'CREATE_MATCH',actor:A,contract:RESEARCH_DEBRIEF_PINS.arena.address,runtimeHash:RESEARCH_DEBRIEF_PINS.arena.runtimeHash,chainId:11155111,intentId:H,defender:B,calldataHash:H,id:null,step:null,gasLimit:'1000000',maxFeePerGasWei:'1000',maxPriorityFeePerGasWei:'2',maximumFeeWei:'1000000000',observedBlock:42,observedBlockHash:H,nonce:1,state:'DISPATCHED_UNKNOWN'});
test('durable reservation survives recreated journal, refuses duplicate and private fields',()=>{
 const store=storage(),journal=createConfidentialBrowserJournal(store),r=record();
 assert.equal(journal.read(),null);journal.reserve(r);
 const another=createConfidentialBrowserJournal(store);assert.deepEqual(another.read(),r);
 assert.throws(()=>another.reserve(r),/existing reservation/);
 assert.throws(()=>another.update({...r,nonce:2,state:'HASH_RECEIVED',transactionHash:H2}),/reservation changed/);
 journal.update({...r,state:'HASH_RECEIVED',transactionHash:H2});
 assert.equal(another.read().transactionHash,H2);
 assert.throws(()=>another.clearReconciled({state:'UNCONFIRMED',transactionHash:H2}),/reconciliation/);
 assert.throws(()=>another.clearReconciled({state:'CONFIRMED_ACTION_RECEIPT',transactionHash:H,blockNumber:43,blockHash:H}),/reconciliation/);
 another.clearReconciled({state:'CONFIRMED_ACTION_RECEIPT',transactionHash:H2,blockNumber:43,blockHash:H});
 assert.equal(journal.read(),null);
 assert.throws(()=>journal.reserve({...r,inputProof:'private'}),/unknown fields/);
});
test('corrupt or unavailable storage and unsupported cross-tab locks fail closed',async()=>{
 const s=storage();s.getItem=()=>'{';
 assert.throws(()=>createConfidentialBrowserJournal(s).read());
 assert.throws(()=>createConfidentialBrowserLock(null),/exclusive/);
 const lock=createConfidentialBrowserLock({request:(name,opts,fn)=>{assert.equal(opts.mode,'exclusive');return fn();}});
 assert.equal(await lock(()=>42),42);
 const bad=storage();bad.setItem=()=>{};
 assert.throws(()=>createConfidentialBrowserJournal(bad).reserve(record()),/persistence failed/);
});
test('execution rejects a forged deployment and unresolved public reservation without wallet invocation',async()=>{
 const f=fixture(),intent=await prepareArenaV4Create(f.args);
 const journal=createConfidentialBrowserJournal(storage());
 const session=createConfidentialExecution({mode:'arena',wallet:f.wallet,provider:f.provider,journal,lock:fn=>fn()});
 await assert.rejects(session.submit({intent,approval:intent.id}),/pinned review/);
 const pinned=Object.freeze({...intent,contract:RESEARCH_DEBRIEF_PINS.arena.address,runtimeHash:RESEARCH_DEBRIEF_PINS.arena.runtimeHash});
 journal.reserve(record());
 await assert.rejects(session.submit({intent:pinned,approval:pinned.id}),/reconcile first/);
 assert.equal(f.state.writes,0);
});
test('read-only recovery retains pending records and rejects wrong hash/chain',async()=>{
 const r={...record(),state:'HASH_RECEIVED',transactionHash:H2};
 const p={getNetwork:async()=>({chainId:11155111n}),getTransaction:async()=>null,getTransactionReceipt:async()=>null};
 assert.equal((await reconcileConfidentialAction(p,r,H2)).state,'UNCONFIRMED');
 await assert.rejects(reconcileConfidentialAction(p,r,H),/journal deployment/);
 p.getNetwork=async()=>({chainId:1n});await assert.rejects(reconcileConfidentialAction(p,r,H2),/wrong chain/);
});

import {quoteConfidentialAction} from '../src/architecture/confidential-action-controller.mjs';
test('dynamic fee review uses actual calldata and refuses over-budget quotes',async()=>{
 const tx={from:A,to:C,data:'0x1234',value:0n,chainId:11155111,signed:false,sent:false};
 let price=40n,estimate=2000000n,balance=1000000000000n;
 const provider={async estimateGas(request){assert.deepEqual(request,{from:A,to:C,data:'0x1234',value:0n});return estimate;},async getFeeData(){return {maxFeePerGas:price,maxPriorityFeePerGas:2n}},async getBalance(){return balance}};
 const q=await quoteConfidentialAction(provider,tx,'5000000000000000');
 assert.equal(q.gasLimit,'2500000');assert.equal(q.maxFeePerGasWei,'40');assert.ok(Object.isFrozen(q));
 price=50n;assert.equal((await quoteConfidentialAction(provider,tx,'5000000000000000')).maxFeePerGasWei,'50');
 await assert.rejects(quoteConfidentialAction(provider,tx,'100'),/fee exceeds/);
 await assert.rejects(quoteConfidentialAction(provider,{...tx,value:1n},'5000000000000000'),/quote scope/);
 await assert.rejects(quoteConfidentialAction(provider,tx,'5000000000000001'),/quote scope/);
 balance=1n;await assert.rejects(quoteConfidentialAction(provider,tx,'5000000000000000'),/insufficient balance/);
 balance=1000000000000n;estimate=16777216n;await assert.rejects(quoteConfidentialAction(provider,tx,'5000000000000000'),/fee quote/);
});

import {reconcileConfidentialReplacement} from '../src/chain/confidential-execution.mjs';
test('replacement recovery proves same nonce consumed and never treats original action as cancellation',async()=>{
 const r={...record(),state:'HASH_RECEIVED',transactionHash:H};
 const tx={hash:H2,from:A,to:A,chainId:11155111n,value:0n,nonce:r.nonce,data:'0x',blockNumber:43,blockHash:H2};
 const receipt={hash:H2,from:A,status:1,blockNumber:43,blockHash:H2};
 let head=45,nonce=2;
 const p={getNetwork:async()=>({chainId:11155111n}),getTransaction:async()=>tx,getTransactionReceipt:async()=>receipt,getBlock:async n=>({hash:n===42?H:H2}),getBlockNumber:async()=>head,getTransactionCount:async()=>nonce};
 const verified=await reconcileConfidentialReplacement(p,r,H2);
 assert.equal(verified.state,'CONFIRMED_REPLACEMENT');
 assert.equal(verified.originalIntentId,r.intentId);
 const j=createConfidentialBrowserJournal(storage());j.reserve(record());j.update(r);
 assert.throws(()=>j.clearReplacement({...verified,nonce:99}),/replacement identity/);
 head=44;assert.equal((await reconcileConfidentialReplacement(p,r,H2)).state,'UNCONFIRMED');
 head=45;nonce=1;await assert.rejects(reconcileConfidentialReplacement(p,r,H2),/nonce not consumed/);
 nonce=2;tx.nonce=2;await assert.rejects(reconcileConfidentialReplacement(p,r,H2),/sender or nonce/);
 tx.nonce=1;tx.to=r.contract;tx.data='0x1234';
 await assert.rejects(reconcileConfidentialReplacement(p,{...r,calldataHash:keccak256(tx.data)},H2),/original action/);
 j.clearReplacement(verified);assert.equal(j.read(),null);
});
