import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {verifyFirstResolution,FIRST_RESOLVE}
  from '../scripts/verify-first-duel-resolve-readonly.mjs';
const A='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const I=new Interface([
 'function resolveDuel(uint256)',
 'function duelStatus(uint256) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
 'function publicResultHandle(uint256) view returns(bytes32)',
 'function duelForSquad(uint256) view returns(uint256)',
 'event DuelReady(uint256 indexed duelId,bytes32 resultHandle)'
]);
function fixture(){
 const runtime='0x60016003';
 const handle='0x'+'56'.repeat(32);
 const manifest={chainId:11155111,contract:'SquadGambit',contractAddress:A,
  runtimeBytes:(runtime.length-2)/2,runtimeKeccak256:keccak256(runtime)};
 const blockHash='0x'+'99'.repeat(32);
 const event=I.encodeEventLog(I.getEvent('DuelReady'),[1n,handle]);
 const log={address:A,...event,transactionHash:FIRST_RESOLVE.transactionHash};
 const tx={hash:FIRST_RESOLVE.transactionHash,blockHash,
  from:FIRST_RESOLVE.challenger,to:A,value:0n,
  data:I.encodeFunctionData('resolveDuel',[1n])};
 const receipt={hash:FIRST_RESOLVE.transactionHash,status:1,blockHash,blockNumber:12182300,
  from:FIRST_RESOLVE.challenger,to:A,gasUsed:2800000n,gasPrice:25n,logs:[log]};
 const state={submitted:true,resolved:true,finalized:false,expired:false};
 const calls=[];
 const provider={
  async send(m){calls.push(m);if(m==='eth_chainId')return '0xaa36a7';throw Error('unexpected method')},
  async getTransactionReceipt(){return receipt},
  async getTransaction(){return tx},
  async getBlock(block){return block==='latest'?{number:12182400,timestamp:1795279000}:
   {number:12182300,timestamp:1795278500}},
  async getCode(){return runtime},
  async call({data}){
   const fn=I.parseTransaction({data}).name;calls.push(fn);
   if(fn==='duelStatus')return I.encodeFunctionResult(fn,[
    1n,FIRST_RESOLVE.challenger,state.submitted,state.resolved,
    state.finalized,state.expired,0,1795266468]);
   if(fn==='publicResultHandle')return I.encodeFunctionResult(fn,[handle]);
   if(fn==='duelForSquad')return I.encodeFunctionResult(fn,[1n]);
   throw Error('unexpected view');
  },
  async getLogs(){return [log]}
 };
 return {manifest,provider,state,receipt,tx,calls,log};
}
test('authenticates exact resolved duel and canonical public handle without a signer',async()=>{
 const x=fixture();
 const result=await verifyFirstResolution(x.provider,x.manifest);
 assert.equal(result.receiptStatus,'SUCCESS');
 assert.equal(result.resolved,true);
 assert.equal(result.finalized,false);
 assert.equal(result.next,'KMS_PROOF_AND_SEPARATE_FINALIZE');
 assert.equal(result.actualFeeWei,'70000000');
 assert.equal(result.withinStated500mWeiSafetyCeiling,true);
 assert.equal(result.transactionSent,false);
 assert.ok(!x.calls.includes('eth_sendTransaction'));
});
test('invalid sender, zero ETH condition, wrong selector and revert are refused',async()=>{
 const a=fixture();a.tx.from='0x7d567Fa1d5fe35737BbF045f47667e13298Ee176';
 await assert.rejects(verifyFirstResolution(a.provider,a.manifest),/wrong sender/);
 const b=fixture();b.tx.value=1n;
 await assert.rejects(verifyFirstResolution(b.provider,b.manifest),/ETH transferred/);
 const c=fixture();c.tx.data='0x12345678';
 await assert.rejects(verifyFirstResolution(c.provider,c.manifest),/wrong method/);
 const d=fixture();d.receipt.status=0;
 await assert.rejects(verifyFirstResolution(d.provider,d.manifest),/reverted/);
});
test('rejects forged or duplicate event and incorrect runtime',async()=>{
 const a=fixture();a.receipt.logs=[];
 await assert.rejects(verifyFirstResolution(a.provider,a.manifest),/DuelReady event/);
 const b=fixture();b.provider.getLogs=async()=>[b.log,b.log];
 await assert.rejects(verifyFirstResolution(b.provider,b.manifest),/duplicate or missing/);
 const c=fixture();c.manifest.runtimeBytes=12;
 await assert.rejects(verifyFirstResolution(c.provider,c.manifest),/runtime/);
});
test('onchain state must have submitted and resolved without expiry',async()=>{
 const a=fixture();a.state.resolved=false;
 await assert.rejects(verifyFirstResolution(a.provider,a.manifest),/not persisted/);
 const b=fixture();b.state.expired=true;
 await assert.rejects(verifyFirstResolution(b.provider,b.manifest),/not persisted/);
});
