/** Offline integration against exact compiled production bytecode.
 * All wallet/provider/receipt data are synthetic fixtures, never Sepolia writes.
 * Run after npm run build:contract-artifact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Interface,keccak256} from 'ethers';
import {RESEARCH_DEBRIEF_PINS} from '../src/architecture/research-debrief.mjs';
import {prepareConfidentialAction} from '../src/architecture/confidential-action-controller.mjs';
import {createConfidentialExecution,reconcileConfidentialAction} from '../src/chain/confidential-execution.mjs';
import {createConfidentialBrowserJournal} from '../src/chain/confidential-browser-journal.mjs';
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),TX='0x'+'3'.repeat(64),H='0x'+'4'.repeat(64),M='0x'+'5'.repeat(64);
const budget='5000000000000000';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
async function fixture(mode){
 const pin=RESEARCH_DEBRIEF_PINS[mode],name=pin.contract;
 const artifact=JSON.parse(await readFile(new URL('../fhe/artifacts/contracts/'+name+'.sol/'+name+'.json',import.meta.url),'utf8'));
 const code=artifact.deployedBytecode;assert.equal(keccak256(code),pin.runtimeHash,'compiled runtime must match live pin');
 const abi=new Interface(artifact.abi);
 const state={head:42,nonce:7,counter:1n,slot:0n,account:A,requests:[],tx:null,receipt:null,failSend:false,failStore:false,wrongEvent:false};
 const provider={
  async getNetwork(){return {chainId:11155111n}},
  async getBlockNumber(){return state.head},
  async getBlock(n){return {hash:n===43?M:H,timestamp:100001}},
  async getCode(to){assert.equal(to,pin.address);return code},
  async call(request){assert.equal(request.to,pin.address);const p=abi.parseTransaction({data:request.data});
   if(p.name==='nextMatchId'||p.name==='nextMissionId')return abi.encodeFunctionResult(p.name,[state.counter]);
   if(p.name==='activeMission')return abi.encodeFunctionResult(p.name,[state.slot]);
   throw Error('unexpected fixture read '+p.name);
  },
  async estimateGas(request){assert.equal(request.to,pin.address);assert.equal(request.value,0n);return 1500000n},
  async getFeeData(){return {maxFeePerGas:40n,maxPriorityFeePerGas:2n}},
  async getBalance(){return 100000000000000000n},
  async getTransactionCount(){return state.nonce},
  async getTransaction(h){assert.equal(h,TX);return state.tx},
  async getTransactionReceipt(h){assert.equal(h,TX);return state.receipt}
 };
 const store=storage(),journal=createConfidentialBrowserJournal(store);
 const wallet={async request({method,params}){
  state.requests.push(method);
  if(method==='eth_chainId')return '0xaa36a7';
  if(method==='eth_accounts')return [state.account];
  assert.equal(method,'eth_sendTransaction');
  assert.equal(journal.read()?.state,'DISPATCHED_UNKNOWN','durable reservation before wallet');
  assert.equal(params.length,1);const p=params[0],parsed=abi.parseTransaction({data:p.data});
  assert.equal(p.from,A);assert.equal(p.to,pin.address);assert.equal(p.value,'0x0');assert.equal(BigInt(p.nonce),7n);
  assert.equal(parsed.name,mode==='arena'?'createMatch':'openMission');
  if(mode==='arena')assert.equal(parsed.args[0],B);
  const event=mode==='arena'?abi.encodeEventLog(abi.getEvent('MatchCreated'),[2n,A,state.wrongEvent?A:B]):abi.encodeEventLog(abi.getEvent('MissionOpened'),[2n,state.wrongEvent?B:A]);
  state.tx={hash:TX,from:A,to:pin.address,chainId:11155111n,value:0n,nonce:7,type:2,data:p.data,gasLimit:BigInt(p.gas),maxFeePerGas:BigInt(p.maxFeePerGas),maxPriorityFeePerGas:BigInt(p.maxPriorityFeePerGas),blockNumber:43,blockHash:M};
  state.receipt={hash:TX,from:A,to:pin.address,status:1,blockNumber:43,blockHash:M,gasUsed:1500000n,gasPrice:20n,logs:[{...event,address:pin.address,transactionHash:TX,blockNumber:43,blockHash:M,removed:false}]};
  state.head=45;state.nonce++;
  if(state.failSend)throw Error('synthetic transport loss after dispatch');
  return TX;
 }};
 const args={mode,action:mode==='arena'?'CREATE_MATCH':'OPEN_MISSION',wallet,provider,expectedActor:A,defender:B,maximumFeeWei:budget};
 const session=()=>createConfidentialExecution({mode,wallet,provider,journal,lock:fn=>fn()});
 return {state,provider,wallet,store,journal,args,session};
}
for(const mode of ['arena','blacksite']){
 test(mode+' exact pinned runtime: prepare, single dispatch, recover canonical receipt and clear',async()=>{
  const f=await fixture(mode),p=await prepareConfidentialAction(f.args);
  assert.equal(p.signed,false);assert.equal(p.sent,false);
  assert.equal(p.intent.fee.gasLimit,'1875000');
  assert.equal(f.state.requests.filter(x=>x==='eth_sendTransaction').length,0);
  const s=f.session();
  await assert.rejects(s.submit({intent:p.intent,payload:p.payload,approval:H}),/one fresh approval/);
  const result=await s.submit({intent:p.intent,payload:p.payload,approval:p.intent.id});
  assert.equal(result.state,'HASH_RECEIVED');assert.equal(result.transactionHash,TX);
  assert.equal(f.state.requests.filter(x=>x==='eth_sendTransaction').length,1);
  await assert.rejects(s.submit({intent:p.intent,payload:p.payload,approval:p.intent.id}),/one fresh approval/);
  const restored=createConfidentialBrowserJournal(f.store);
  assert.equal(restored.read().transactionHash,TX);
  f.state.head=44;assert.equal((await reconcileConfidentialAction(f.provider,restored.read(),TX)).state,'UNCONFIRMED');
  f.state.head=45;const receipt=await reconcileConfidentialAction(f.provider,restored.read(),TX);
  assert.equal(receipt.state,'CONFIRMED_ACTION_RECEIPT');assert.equal(receipt.id,2);assert.equal(receipt.actualFeeWei,'30000000');
  restored.clearReconciled(receipt);assert.equal(f.journal.read(),null);
 });
 test(mode+' ambiguous dispatch is recoverable without a repeated wallet call',async()=>{
  const f=await fixture(mode),p=await prepareConfidentialAction(f.args);f.state.failSend=true;
  const result=await f.session().submit({intent:p.intent,payload:p.payload,approval:p.intent.id});
  assert.equal(result.state,'DISPATCHED_UNKNOWN');assert.equal(f.journal.read().state,'DISPATCHED_UNKNOWN');
  await assert.rejects(f.session().submit({intent:p.intent,payload:p.payload,approval:p.intent.id}),/reconcile first/);
  const r=await reconcileConfidentialAction(f.provider,f.journal.read(),TX);assert.equal(r.state,'CONFIRMED_ACTION_RECEIPT');
  assert.equal(f.state.requests.filter(x=>x==='eth_sendTransaction').length,1);
 });
 test(mode+' receipt with wrong participants cannot clear reservation',async()=>{
  const f=await fixture(mode),p=await prepareConfidentialAction(f.args);f.state.wrongEvent=true;
  await f.session().submit({intent:p.intent,payload:p.payload,approval:p.intent.id});
  await assert.rejects(reconcileConfidentialAction(f.provider,f.journal.read(),TX),/event/);
  assert.equal(f.journal.read().state,'HASH_RECEIVED');
 });
}
test('creation review refuses changed counter before wallet request',async()=>{
 const f=await fixture('arena'),p=await prepareConfidentialAction(f.args);f.state.counter++;
 await assert.rejects(f.session().submit({intent:p.intent,payload:p.payload,approval:p.intent.id}),/creation context changed/);
 assert.equal(f.state.requests.filter(x=>x==='eth_sendTransaction').length,0);assert.equal(f.journal.read(),null);
});
