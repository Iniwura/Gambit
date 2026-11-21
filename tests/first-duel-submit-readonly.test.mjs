import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {verifyFirstSubmission,FIRST_SUBMIT}
  from '../scripts/verify-first-duel-submit-readonly.mjs';
const ADDRESS='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const ABI=new Interface([
 'function submitDuel(uint256 duelId,bytes32[10] encryptedPlans,bytes inputProof)',
 'function duelStatus(uint256) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
 'function squadStatus(uint256) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
 'function duelForSquad(uint256) view returns(uint256)',
 'event DuelSubmitted(uint256 indexed duelId)'
]);
function fixture(){
  const runtime='0x60016002';
  const manifest={
    chainId:11155111,contract:'SquadGambit',contractAddress:ADDRESS,
    runtimeKeccak256:keccak256(runtime),runtimeBytes:(runtime.length-2)/2
  };
  const expected=FIRST_SUBMIT;
  const blockHash='0x'+'b3'.repeat(32);
  const blockNumber=12182500;
  const event=ABI.encodeEventLog(ABI.getEvent('DuelSubmitted'),[1n]);
  const log={...event,address:ADDRESS,transactionHash:expected.transactionHash};
  const data=ABI.encodeFunctionData('submitDuel',[
    1n,Array.from({length:10},(_,i)=>'0x'+(i+1).toString(16).padStart(64,'0')),'0x1234'
  ]);
  const calls=[];
  const transaction={hash:expected.transactionHash,
    from:expected.challenger,to:ADDRESS,blockHash,value:0n,data};
  const receipt={hash:expected.transactionHash,status:1,blockNumber,blockHash,
    from:expected.challenger,to:ADDRESS,gasUsed:4142942n,gasPrice:32n,logs:[log]};
  const options={submitted:true,resolved:false,finalized:false,expired:false};
  const provider={
    async send(method){calls.push(method);return method==='eth_chainId'?'0xaa36a7':null},
    async getTransactionReceipt(){return receipt},
    async getTransaction(){return transaction},
    async getBlock(which){return which==='latest'
      ?{number:12182600,timestamp:1795290200}
      :{number:blockNumber,timestamp:1795289800}},
    async getCode(){return runtime},
    async call({data,blockTag}){
      calls.push('read:'+blockTag);
      const method=ABI.parseTransaction({data}).name;
      if(method==='duelStatus')return ABI.encodeFunctionResult(method,[
        1n,expected.challenger,options.submitted,options.resolved,
        options.finalized,options.expired,0,1795266468
      ]);
      if(method==='squadStatus')return ABI.encodeFunctionResult(method,[
        expected.defender,expected.challenger,true,true
      ]);
      if(method==='duelForSquad')return ABI.encodeFunctionResult(method,[1n]);
      throw Error('unexpected public read '+method);
    },
    async getLogs(){return [log]}
  };
  return {provider,manifest,expected,transaction,receipt,options,calls,log};
}
test('confirmed 10 encrypted handles, exact calldata, receipt, unique event and stored state',async()=>{
  const x=fixture();
  const result=await verifyFirstSubmission(x.provider,x.manifest);
  assert.equal(result.receiptStatus,'SUCCESS');
  assert.equal(result.tenEncryptedHandlesVerified,true);
  assert.equal(result.nonEmptyInputProofVerified,true);
  assert.equal(result.exclusiveDuelSubmittedEventVerified,true);
  assert.equal(result.canonicalStoredStateVerified,true);
  assert.equal(result.next,'READY_TO_RESOLVE');
  assert.equal(result.actualFeeWei,(4142942n*32n).toString());
  assert.equal(result.withinOriginalFeeCap,true);
  assert.equal(result.transactionSent,false);
  assert.ok(!x.calls.includes('eth_sendTransaction'));
});
test('wrong transaction method, challenger or input count fails closed',async()=>{
  const a=fixture();a.transaction.data='0x12345678';
  await assert.rejects(verifyFirstSubmission(a.provider,a.manifest),/wrong function/);
  const b=fixture();b.transaction.from=b.expected.defender;
  await assert.rejects(verifyFirstSubmission(b.provider,b.manifest),/wrong challenger/);
  const c=fixture();c.transaction.value=1n;
  await assert.rejects(verifyFirstSubmission(c.provider,c.manifest),/nonzero ETH/);
});
test('receipt, runtime and canonical event mismatches fail closed',async()=>{
  const a=fixture();a.receipt.status=0;
  await assert.rejects(verifyFirstSubmission(a.provider,a.manifest),/receipt reverted/);
  const b=fixture();b.manifest.runtimeKeccak256='0x'+'0'.repeat(64);
  await assert.rejects(verifyFirstSubmission(b.provider,b.manifest),/runtime fingerprint/);
  const c=fixture();c.receipt.logs=[];
  await assert.rejects(verifyFirstSubmission(c.provider,c.manifest),/DuelSubmitted event/);
  const d=fixture();d.provider.getLogs=async()=>[d.log,d.log];
  await assert.rejects(verifyFirstSubmission(d.provider,d.manifest),/extra\/missing submission/);
});
test('duel storage must be submitted and not expired',async()=>{
  const a=fixture();a.options.submitted=false;
  await assert.rejects(verifyFirstSubmission(a.provider,a.manifest),/submission not reflected/);
  const b=fixture();b.options.expired=true;
  await assert.rejects(verifyFirstSubmission(b.provider,b.manifest),/submission not reflected/);
});
