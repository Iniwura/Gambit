import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {FIRST_SEAL} from '../scripts/verify-first-squad-seal-readonly.mjs';
import {quoteFirstDuelOpen} from '../scripts/quote-first-duel-open-readonly.mjs';

const CONTRACT='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const ABI=new Interface([
 'function squadStatus(uint256 id) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
 'function duelForSquad(uint256 squadId) view returns (uint256)',
 'function nextDuelId() view returns (uint256)',
 'function openDuel(uint256 squadId) returns (uint256 duelId)'
]);
const mock=(overrides={})=>{
 const code='0x600150';
 const manifest={
  contract:'SquadGambit',chainId:11155111,contractAddress:CONTRACT,
  runtimeBytes:(code.length-2)/2,runtimeKeccak256:keccak256(code)
 };
 const captured={estimate:null};
 const provider={
  async send(){return '0xaa36a7'},
  async getCode(){return code},
  async call({data,to}){
   assert.equal(to,CONTRACT);
   const p=ABI.parseTransaction({data});
   if(p.name==='squadStatus')
    return ABI.encodeFunctionResult('squadStatus',[
     FIRST_SEAL.owner,FIRST_SEAL.challenger,true,false
    ]);
   if(p.name==='duelForSquad')
    return ABI.encodeFunctionResult('duelForSquad',[0n]);
   if(p.name==='nextDuelId')
    return ABI.encodeFunctionResult('nextDuelId',[0n]);
   throw Error('Unexpected public call');
  },
  async estimateGas(tx){captured.estimate=tx;return 130000n},
  async getFeeData(){return {maxFeePerGas:30n,gasPrice:null}}
 };
 Object.assign(provider,overrides);
 return {manifest,provider,captured};
};

test('read-only first duel quote uses invited second public address and transacts nothing',async()=>{
 const {manifest,provider,captured}=mock();
 const result=await quoteFirstDuelOpen(provider,manifest);
 assert.equal(result.squadId,'1');
 assert.equal(result.expectedNextDuelId,'1');
 assert.equal(result.challenger,FIRST_SEAL.challenger);
 assert.equal(result.estimatedGas,'130000');
 assert.equal(result.bufferedGasLimit,'156000');
 assert.equal(result.maximumQuotedFeeWei,'4680000');
 assert.equal(result.balanceChecked,false);
 assert.equal(result.transactionSigned,false);
 assert.equal(result.transactionSent,false);
 assert.equal(captured.estimate.from,FIRST_SEAL.challenger);
 assert.equal(captured.estimate.to,CONTRACT);
 assert.equal(captured.estimate.value,0n);
 const parsed=ABI.parseTransaction({data:captured.estimate.data});
 assert.equal(parsed.name,'openDuel');
 assert.equal(parsed.args[0],1n);
});

test('read-only quote rejects consumed, uninvited, wrong chain and changed contract',async()=>{
 for(const change of [
  x=>{x.provider.send=async()=> '0x1'},
  x=>{x.provider.call=async()=>ABI.encodeFunctionResult('squadStatus',[
    FIRST_SEAL.owner,FIRST_SEAL.challenger,true,true
   ])},
  x=>{x.manifest.runtimeKeccak256='0x'+'a'.repeat(64)},
  x=>{x.provider.estimateGas=async()=>{throw Error('No gas estimate available')}},
  x=>{x.provider.getFeeData=async()=>({maxFeePerGas:null,gasPrice:null})}
 ]){
  const x=mock();change(x);
  await assert.rejects(quoteFirstDuelOpen(x.provider,x.manifest));
 }
});
