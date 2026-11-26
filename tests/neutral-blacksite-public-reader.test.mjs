import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {NEUTRAL_BLACKSITE_READ_ABI,readNeutralBlacksiteMission} from '../src/blacksite/neutral-public-mission-reader.mjs';
const abi=new Interface(NEUTRAL_BLACKSITE_READ_ABI);
const A='0x'+'1'.repeat(40),C='0x'+'2'.repeat(40),H='0x'+'3'.repeat(64),B='0x'+'4'.repeat(64),CODE='0x6000';
const manifest={contract:'NeutralBlacksiteResearch',version:3,chainId:11155111,address:C,runtimeHash:keccak256(CODE)};
const empty=()=>[false,false,false,0];
function fixture(){
 const f={chain:11155111,code:CODE,time:100001,slot:7,state:[A,100000,186400,272800,0,0,0,0],
 rows:Array.from({length:4},empty),handle:H,reorg:false,reads:[],blockReads:0};
 const provider={
  async getNetwork(){return {chainId:BigInt(f.chain)}},
  async getBlockNumber(){return 42},
  async getBlock(n){assert.equal(n,42);return {hash:f.reorg&&++f.blockReads>1?H:B,timestamp:f.time}},
  async getCode(address,n){assert.equal(address,C);assert.equal(n,42);return f.code},
  async call(tx){
   assert.equal(tx.to,C);assert.equal(tx.blockTag,42);
   const p=abi.parseTransaction({data:tx.data});f.reads.push(p.name);
   if(p.name==='activeMission'){assert.equal(p.args[0],A);return abi.encodeFunctionResult(p.name,[f.slot]);}
   assert.equal(p.args[0],7n);
   if(p.name==='missionStatus')return abi.encodeFunctionResult(p.name,f.state);
   if(p.name==='attemptStatus')return abi.encodeFunctionResult(p.name,f.rows[Number(p.args[1])-1]);
   if(p.name==='feedbackHandle')return abi.encodeFunctionResult(p.name,[f.handle]);
   throw Error('unexpected read');
  },
  getSigner(){throw Error('no signer')},sendTransaction(){throw Error('no send')}
 };
 return {f,provider,read:(opts={})=>readNeutralBlacksiteMission(provider,manifest,7,opts)};
}
test('neutral reader reports allocation, seal and proof phases without publishing secrets or granting rewards',async()=>{
 const c=fixture();let s=await c.read();
 assert.equal(s.status,'ACCEPTING_ATTEMPT');assert.equal(s.pending,null);
 c.f.rows[0]=[true,false,false,0];s=await c.read();assert.equal(s.status,'SEALED');assert.equal(s.resultHandle,null);
 c.f.rows[0]=[true,true,false,0];s=await c.read();assert.equal(s.status,'AWAITING_PROOF');assert.equal(s.resultHandle,H);
 assert.equal(s.eligibleForVerifiedProgression,false);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.pending));
 assert.equal(s.trustBoundary,'caller-manifest-must-be-independently-approved');
 for(const forbidden of ['vaultCode','guess','privateKey','proof'])assert.equal(Object.hasOwn(s,forbidden),false);
});
test('canonical feedback replay verifies heat, score and terminal breach, but no verified reward',async()=>{
 const c=fixture();
 c.f.rows[0]=[true,true,true,34];c.f.rows[1]=[true,true,true,69];
 c.f.state=[A,100000,186400,272800,2,3,65,1];c.f.slot=0;
 const s=await c.read();assert.equal(s.status,'BREACHED');assert.equal(s.score,65);
 assert.deepEqual(s.history.map(x=>x.route),['PROBE','BREACH']);
 assert.equal(s.eligibleForVerifiedProgression,false);
 c.f.state[6]=66;await assert.rejects(c.read(),/score or heat mismatch/);
});
test('four failures lock the mission and another active mission does not invalidate history',async()=>{
 const c=fixture();c.f.rows=Array.from({length:4},()=>[true,true,true,0]);
 c.f.state=[A,100000,186400,272800,4,0,0,2];c.f.slot=8;
 assert.equal((await c.read()).status,'LOCKED');
 c.f.state[7]=0;c.f.slot=7;await assert.rejects(c.read(),/premature terminal history/);
});
test('inclusive submission and recovery boundaries distinguish expiry and technical abort',async()=>{
 const c=fixture();c.f.time=186400;assert.equal((await c.read()).status,'ACCEPTING_ATTEMPT');
 c.f.time++;assert.equal((await c.read()).status,'EXPIRED_NOT_CLOSED');
 c.f.state[7]=3;c.f.slot=0;assert.equal((await c.read()).status,'EXPIRED');
 c.f.state[7]=0;c.f.slot=7;c.f.rows[0]=[true,true,false,0];
 c.f.time=272800;assert.equal((await c.read()).status,'AWAITING_PROOF');
 c.f.time++;const s=await c.read();assert.equal(s.status,'RECOVERY_EXPIRED_NOT_CLOSED');assert.equal(s.resultHandle,null);
 c.f.state[7]=4;c.f.slot=0;assert.equal((await c.read()).status,'TECHNICAL_ABORT');assert.equal((await c.read()).pending,null);
 c.f.time--;await assert.rejects(c.read(),/invalid technical abort/);
});
test('rejects wrong network, runtime, block reorg, cancelled read and absent manifest',async()=>{
 const c=fixture();c.f.chain=1;await assert.rejects(c.read(),/wrong network/);c.f.chain=11155111;
 c.f.code='0x6001';await assert.rejects(c.read(),/runtime hash mismatch/);c.f.code=CODE;
 c.f.reorg=true;await assert.rejects(c.read(),/block changed/);c.f.reorg=false;
 const controller=new AbortController();controller.abort();await assert.rejects(c.read({signal:controller.signal}),/ABORTED/);
 await assert.rejects(readNeutralBlacksiteMission(c.provider,null,7),/deployment manifest/);
});
test('rejects inconsistent slot, impossible packets, future actions and unfinalized score',async()=>{
 const c=fixture();c.f.slot=0;await assert.rejects(c.read(),/active slot mismatch/);c.f.slot=7;
 c.f.rows[1]=[true,false,false,0];await assert.rejects(c.read(),/future attempt populated/);c.f.rows[1]=empty();
 c.f.rows[0]=[true,true,false,34];await assert.rejects(c.read(),/unfinalized feedback/);
 c.f.rows[0]=[false,true,false,0];await assert.rejects(c.read(),/resolution without submission/);
 c.f.rows[0]=[true,true,true,49];c.f.state[4]=1;c.f.state[5]=1;await assert.rejects(c.read(),/impossible probe counts/);
 c.f.rows[0]=[true,true,false,0];c.f.state[4]=0;c.f.state[5]=0;c.f.handle='0x'+'0'.repeat(64);
 await assert.rejects(c.read(),/missing public result handle/);
});

import {NEUTRAL_MISSION_WRITE_ABI,stageNeutralMissionIntent,revalidateNeutralMissionIntent} from '../src/blacksite/neutral-mission-intent.mjs';
const write=new Interface(NEUTRAL_MISSION_WRITE_ABI);
const fee={gasLimit:'300000',maxFeePerGasWei:'2000000000',maxPriorityFeePerGasWei:'100000000',maximumTotalFeeWei:'600000000000000'};
const request=(action,payload={})=>({action,actor:A,payload,feeQuote:fee});
const sealed={encryptedHandles:Array.from({length:6},(_,i)=>'0x'+(i+1).toString(16).padStart(64,'0')),inputProof:'0x1234'};
test('neutral mission exact six-input seal and explicit approval release only unsigned calldata',async()=>{
 const c=fixture(),s=await c.read(),intent=stageNeutralMissionIntent(s,request('SUBMIT_ATTEMPT',sealed));
 assert.equal(Object.hasOwn(intent,'encryptedHandles'),false);assert.equal(Object.hasOwn(intent,'inputProof'),false);
 const tx=await revalidateNeutralMissionIntent(c.provider,manifest,intent,sealed,intent.id);
 const parsed=write.parseTransaction({data:tx.data});
 assert.equal(parsed.name,'submitAttempt');assert.equal(parsed.args[0],7n);assert.equal(parsed.args[1],1n);
 assert.deepEqual([...parsed.args[2]],sealed.encryptedHandles.slice(0,5));assert.equal(parsed.args[3],sealed.encryptedHandles[5]);
 assert.equal(tx.signed,false);assert.equal(tx.sent,false);assert.equal(tx.value,0n);
 await assert.rejects(revalidateNeutralMissionIntent(c.provider,manifest,intent,sealed,H),/exact approval/);
 await assert.rejects(revalidateNeutralMissionIntent(c.provider,manifest,intent,{...sealed,inputProof:'0xabcd'},intent.id),/calldata or deployment changed/);
 c.f.rows[0]=[true,false,false,0];
 await assert.rejects(revalidateNeutralMissionIntent(c.provider,manifest,intent,sealed,intent.id),/mission state changed/);
});
test('neutral mission consent is operative-bound, fee-bounded and rejects plaintext or malformed encrypted payloads',async()=>{
 const c=fixture(),s=await c.read();
 assert.throws(()=>stageNeutralMissionIntent(s,{...request('SUBMIT_ATTEMPT',sealed),actor:C}),/only operative/);
 assert.throws(()=>stageNeutralMissionIntent(s,request('SUBMIT_ATTEMPT',{...sealed,guess:[0,0,0,0,0]})),/exact fields/);
 assert.throws(()=>stageNeutralMissionIntent(s,request('SUBMIT_ATTEMPT',{...sealed,encryptedHandles:sealed.encryptedHandles.slice(0,5)})),/six encrypted/);
 assert.throws(()=>stageNeutralMissionIntent(s,{...request('SUBMIT_ATTEMPT',sealed),feeQuote:{...fee,maximumTotalFeeWei:'1'}}),/budget/);
});
test('neutral mission exact resolve, finalize, expiry and abort intents follow public state and never award rewards',async()=>{
 const c=fixture();c.f.rows[0]=[true,false,false,0];
 let s=await c.read(),i=stageNeutralMissionIntent(s,request('RESOLVE_ATTEMPT'));
 let tx=await revalidateNeutralMissionIntent(c.provider,manifest,i,{},i.id);
 assert.equal(write.parseTransaction({data:tx.data}).name,'resolveAttempt');
 c.f.rows[0]=[true,true,false,0];s=await c.read();
 const p={packet:34,resultHandle:H,kmsProof:'0x1234'};
 assert.throws(()=>stageNeutralMissionIntent(s,request('FINALIZE_ATTEMPT',{...p,resultHandle:B})),/wrong pending proof/);
 i=stageNeutralMissionIntent(s,request('FINALIZE_ATTEMPT',p));
 tx=await revalidateNeutralMissionIntent(c.provider,manifest,i,p,i.id);
 assert.equal(write.parseTransaction({data:tx.data}).name,'finalizeAttempt');
 c.f.time=272801;s=await c.read();
 assert.throws(()=>stageNeutralMissionIntent(s,request('FINALIZE_ATTEMPT',p)),/wrong pending proof/);
 i=stageNeutralMissionIntent(s,request('ABORT_UNSETTLED'));tx=await revalidateNeutralMissionIntent(c.provider,manifest,i,{},i.id);
 assert.equal(write.parseTransaction({data:tx.data}).name,'abortUnsettled');
 c.f.rows[0]=empty();s=await c.read();i=stageNeutralMissionIntent(s,request('EXPIRE_MISSION'));
 tx=await revalidateNeutralMissionIntent(c.provider,manifest,i,{},i.id);assert.equal(write.parseTransaction({data:tx.data}).name,'expireMission');
 assert.equal(s.eligibleForVerifiedProgression,false);
});
