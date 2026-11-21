import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {FIRST_SEAL} from '../scripts/verify-first-squad-seal-readonly.mjs';
import {recoverFirstDuelPublic} from '../scripts/recover-first-duel-readonly.mjs';

const CONTRACT='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const ABI=new Interface([
 'function nextDuelId() view returns (uint256)',
 'function squadStatus(uint256 id) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
 'function duelForSquad(uint256 id) view returns (uint256)',
 'function duelStatus(uint256 id) view returns (uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
 'function openDuel(uint256 squadId) returns (uint256 duelId)',
 'event DuelOpened(uint256 indexed duelId,uint256 indexed squadId,address indexed challenger)'
]);
function fixture(opened=true){
  const runtime='0x60016002';
  const manifest={
    chainId:11155111,contract:'SquadGambit',
    contractAddress:CONTRACT,
    runtimeKeccak256:keccak256(runtime),
    runtimeBytes:(runtime.length-2)/2
  };
  const event=ABI.encodeEventLog(ABI.getEvent('DuelOpened'),[1n,1n,FIRST_SEAL.challenger]);
  const transactionHash='0x'+'12'.repeat(32);
  const blockHash='0x'+'ab'.repeat(32);
  const logs=opened?[{
    ...event,transactionHash,blockHash,blockNumber:12182000,
    address:CONTRACT
  }]:[];
  const calls=[];
  const provider={
    async send(method){calls.push(method);if(method==='eth_chainId')return '0xaa36a7';throw Error('unexpected method')},
    async getBlock(){return {number:12182020,timestamp:100050}},
    async getCode(){return runtime},
    async call({data,to,blockTag}){
      assert.equal(to,CONTRACT);
      assert.equal(blockTag,12182020);
      const method=ABI.parseTransaction({data}).name;
      calls.push(method);
      if(method==='squadStatus')
        return ABI.encodeFunctionResult(method,[FIRST_SEAL.owner,FIRST_SEAL.challenger,true,opened]);
      if(method==='duelForSquad')
        return ABI.encodeFunctionResult(method,[opened?1n:0n]);
      if(method==='nextDuelId')
        return ABI.encodeFunctionResult(method,[opened?1n:0n]);
      if(method==='duelStatus')
        return ABI.encodeFunctionResult(method,[1n,FIRST_SEAL.challenger,false,false,false,false,0,100000]);
      throw Error('unexpected view '+method);
    },
    async getLogs(filter){
      assert.equal(filter.address,CONTRACT);
      assert.equal(filter.topics.length,4);
      return logs;
    },
    async getTransactionReceipt(){
      calls.push('receipt');
      return {status:1,from:FIRST_SEAL.challenger,to:CONTRACT,blockHash,
        gasUsed:100000n,gasPrice:30n};
    },
    async getTransaction(){
      calls.push('transaction');
      return {from:FIRST_SEAL.challenger,to:CONTRACT,blockHash,value:0n,
        data:ABI.encodeFunctionData('openDuel',[1n])};
    }
  };
  return {provider,manifest,calls,logs};
}

test('read-only canonical recovery confirms a used invite and actual event+receipt',async()=>{
  const f=fixture(true);
  const result=await recoverFirstDuelPublic(f.provider,f.manifest);
  assert.equal(result.state,'OPENED_ONCHAIN');
  assert.equal(result.duelId,'1');
  assert.equal(result.openDuelTransactionHash,'0x'+'12'.repeat(32));
  assert.equal(result.actualFeeWei,'3000000');
  assert.equal(result.underApprovedOpenCap,true);
  assert.equal(result.submissionWindowOpen,true);
  assert.equal(result.transactionSent,false);
  assert.equal(result.balanceQueried,false);
  assert.ok(f.calls.includes('duelStatus'));
  assert.ok(!f.calls.includes('eth_getBalance'));
});

test('not-opened state is reported as evidence, never sends a transaction',async()=>{
  const f=fixture(false);
  const result=await recoverFirstDuelPublic(f.provider,f.manifest);
  assert.equal(result.state,'NOT_OPENED');
  assert.equal(result.duelId,null);
  assert.equal(result.transactionSent,false);
});

test('fail closed for claimed invitation with no event',async()=>{
  const f=fixture(true);
  f.logs.length=0;
  await assert.rejects(recoverFirstDuelPublic(f.provider,f.manifest),/missing first DuelOpened event/);
});

test('fail closed for altered event identity or wrong receipt sender',async()=>{
  const f=fixture(true);
  const bad=ABI.encodeEventLog(ABI.getEvent('DuelOpened'),[1n,1n,FIRST_SEAL.owner]);
  f.logs[0].topics=bad.topics;
  await assert.rejects(recoverFirstDuelPublic(f.provider,f.manifest),/decoded event/);
  const g=fixture(true);
  g.provider.getTransactionReceipt=async()=>({
    status:1,from:FIRST_SEAL.owner,to:CONTRACT,
    blockHash:g.logs[0].blockHash,gasUsed:100000n,gasPrice:30n
  });
  await assert.rejects(recoverFirstDuelPublic(g.provider,g.manifest),/receipt addresses/);
});

test('fail closed on invalid chain or wrong runtime',async()=>{
  const f=fixture(true);
  f.provider.send=async()=> '0x1';
  await assert.rejects(recoverFirstDuelPublic(f.provider,f.manifest),/network/);
  const g=fixture(true);
  g.manifest.runtimeKeccak256='0x'+'0'.repeat(64);
  await assert.rejects(recoverFirstDuelPublic(g.provider,g.manifest),/contract runtime/);
});
