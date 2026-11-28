import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Interface,keccak256} from 'ethers';
import {verifySquadLiveReadOnly} from '../scripts/verify-squad-readonly.mjs';

const ABI=new Interface([
  'function nextSquadId() view returns (uint256)',
  'function nextDuelId() view returns (uint256)'
]);
const code='0x60016000556002600055';
const from='0x2000000000000000000000000000000000000002';
const address='0x1000000000000000000000000000000000000001';
const txHash='0x'+'aa'.repeat(32);
const manifest={
  chainId:11155111,contract:'SquadGambit',contractAddress:address,
  deployer:from,txHash,blockNumber:42,actualGasUsed:'200000',
  runtimeBytes:(code.length-2)/2,runtimeKeccak256:keccak256(code)
};
function provider(overrides={}){
  const fake={
    send:async()=> '0xaa36a7',
    getTransaction:async()=>({hash:txHash,to:null,from}),
    getTransactionReceipt:async()=>({
      to:null,status:1,from,contractAddress:address,blockNumber:42,
      gasUsed:200000n,gasPrice:19n
    }),
    getCode:async()=>code,
    call:async({data})=>{
      const {name}=ABI.parseTransaction({data});
      return ABI.encodeFunctionResult(name,[name==='nextSquadId'?3n:2n]);
    }
  };
  return {...fake,...overrides};
}
test('public Sepolia verifier confirms receipt, full runtime hash and live counters',async()=>{
  const proof=await verifySquadLiveReadOnly(provider(),manifest);
  assert.equal(proof.chainId,11155111);
  assert.equal(proof.actualDeploymentFeeWei,'3800000');
  assert.equal(proof.nextSquadId,'3');
  assert.equal(proof.nextDuelId,'2');
  assert.equal(proof.transactionSent,false);
  assert.equal(proof.liveHcuMeasured,false);
});
test('wrong network is refused before any code inspection',async()=>{
  await assert.rejects(verifySquadLiveReadOnly(provider({send:async()=> '0x1'}),manifest),/not Ethereum Sepolia/);
});
test('missing or unsuccessful contract receipt is refused',async()=>{
  await assert.rejects(verifySquadLiveReadOnly(provider({getTransactionReceipt:async()=> null}),manifest),/unavailable/);
  await assert.rejects(verifySquadLiveReadOnly(provider({getTransactionReceipt:async()=>({
    to:null,status:0,from,contractAddress:address,blockNumber:42,
    gasUsed:200000n,gasPrice:19n
  })}),manifest),/not a successful/);
});
test('wrong deployed runtime fingerprint is refused',async()=>{
  await assert.rejects(verifySquadLiveReadOnly(provider({getCode:async()=> '0x6000600055'}),manifest),/length differs/);
  const other='0x60016000556002600056';
  await assert.rejects(verifySquadLiveReadOnly(provider({getCode:async()=> other}),manifest),/hash mismatches/);
});
test('wrong deployer or receipt gas is refused',async()=>{
  const wrong='0x3000000000000000000000000000000000000003';
  await assert.rejects(verifySquadLiveReadOnly(provider({getTransaction:async()=>({
    hash:txHash,to:null,from:wrong
  })}),manifest),/sender mismatches/);
  await assert.rejects(verifySquadLiveReadOnly(provider({getTransactionReceipt:async()=>({
    to:null,status:1,from,contractAddress:address,blockNumber:42,
    gasUsed:199999n,gasPrice:19n
  })}),manifest),/gas differs/);
});
test('no fake contract creation or incorrect chain manifest accepted',async()=>{
  await assert.rejects(verifySquadLiveReadOnly(provider({
    getTransaction:async()=>({hash:txHash,to:address,from})
  }),manifest),/not a successful contract creation/);
  await assert.rejects(verifySquadLiveReadOnly(provider(),{...manifest,chainId:1}),/Unexpected SquadGambit/);
});
