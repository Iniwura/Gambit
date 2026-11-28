import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {discoverApprovedFinalizedDuels}
  from '../src/profile/approved-event-discovery.mjs';
import {deriveCommanderArenaProfile}
  from '../src/profile/verified-arena-record.mjs';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA as PIN}
  from '../src/profile/trusted-deployments.mjs';

const EVENT=new Interface([
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
const hash=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
function makeLog(duelId,blockNumber,overrides={}){
  const data=EVENT.encodeEventLog(EVENT.getEvent('DuelFinalized'),[
    BigInt(duelId),0,1,2
  ]);
  return {
    ...data,address:PIN.contractAddress,
    blockNumber,blockHash:hash(blockNumber),
    transactionHash:hash(800000+duelId),
    ...overrides
  };
}
function fixture(){
  const logs=[
    makeLog(2,12174900),
    makeLog(1,12174678)
  ];
  const flags={
    chainId:'0xaa36a7',head:12175000,
    logOverride:null,canonical:true,changeHead:false
  };
  const methods=[];
  const provider={
    async send(method){methods.push(method);
      assert.equal(method,'eth_chainId');return flags.chainId;},
    async getBlock(tag){
      methods.push('getBlock');
      if(tag==='latest')return {number:flags.head,hash:hash(flags.head)};
      if(!Number.isSafeInteger(tag))throw Error('unexpected block tag');
      if(flags.changeHead&&tag===flags.head)
        return {number:tag,hash:hash(tag+1)};
      return {number:tag,hash:flags.canonical?hash(tag):hash(tag+1)};
    },
    async getLogs(query){
      methods.push('eth_getLogs');
      assert.equal(query.address,PIN.contractAddress);
      assert.equal(query.toBlock-query.fromBlock<=449,true);
      const candidate=flags.logOverride??logs;
      return candidate.filter(x=>x.blockNumber>=query.fromBlock&&
        x.blockNumber<=query.toBlock);
    }
  };
  return {provider,flags,methods,logs};
}

test('bounded, canonical, cursor-based discovery across real deployment start',async()=>{
  const x=fixture();
  const first=await discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:100
  });
  assert.equal(first.scannedFrom,PIN.fromBlock);
  assert.equal(first.scannedTo,PIN.fromBlock+99);
  assert.equal(first.complete,false);
  assert.equal(first.authority,'UNVERIFIED_CANDIDATES_ONLY');
  assert.deepEqual(first.candidates.map(a=>a.duelId),['1']);
  const second=await discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:100,cursor:first.nextCursor
  });
  assert.equal(second.scannedFrom,first.scannedTo+1);
  assert.deepEqual(second.candidates,[]);
  const third=await discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:180,cursor:second.nextCursor
  });
  assert.equal(third.complete,true);
  assert.deepEqual(third.candidates.map(a=>a.duelId),['2']);
  const done=await discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:100,cursor:third.nextCursor
  });
  assert.equal(done.complete,true);
  assert.deepEqual(done.candidates,[]);
  assert.equal(done.scannedFrom,null);
  assert.equal(x.methods.includes('eth_sendTransaction'),false);
  assert.equal(x.methods.includes('eth_requestAccounts'),false);
  assert.equal(Object.isFrozen(first.candidates[0]),true);
  assert.equal(Object.isFrozen(first.nextCursor),true);
  assert.throws(()=>deriveCommanderArenaProfile(
    '0x1111111111111111111111111111111111111111',
    [first.candidates[0]]),/unverified or fabricated/,
    'public discovery is not a real authenticated victory');
});

test('cursor tampering and orphaned block hashes cannot silently change history',async()=>{
  const x=fixture();
  const result=await discoverApprovedFinalizedDuels(x.provider,{maxBlocks:100});
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    cursor:{...result.nextCursor,blockHash:hash(5)}
  }),/cursor block/);
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    cursor:{...result.nextCursor,version:99}
  }),/cursor schema/);
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    cursor:{...result.nextCursor,extra:'untrusted'}
  }),/cursor schema/);
  x.flags.canonical=false;
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:100
  }),/orphaned event/);
  x.flags.canonical=true;
  x.flags.changeHead=true;
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:100
  }),/chain head changed/);
});

test('wrong chain, counterfeit event, duplicate duel and overloaded RPC fail closed',async()=>{
  for(const makeBad of [
    x=>{x.flags.chainId='0x1';},
    x=>{x.flags.logOverride=[makeLog(1,12174678,{address:
      '0x1111111111111111111111111111111111111111'})];},
    x=>{x.flags.logOverride=[makeLog(1,12174678,{blockHash:hash(3)})];},
    x=>{x.flags.logOverride=[makeLog(1,12174678),makeLog(1,12174678)];},
    x=>{x.flags.logOverride=new Array(101).fill(0).map((_,i)=>
      makeLog(i+1,12174678));},
    x=>{x.flags.logOverride=[makeLog(1,12174678,{topics:[hash(1)]})];}
  ]){
    const x=fixture();makeBad(x);
    await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
      maxBlocks:100
    }));
  }
  const x=fixture();
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:0
  }),/maximum scan/);
  await assert.rejects(discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:999999
  }),/maximum scan/);
});

test('discover only candidates, never private strategy, player history or signed results',async()=>{
  const x=fixture();
  const result=await discoverApprovedFinalizedDuels(x.provider,{
    maxBlocks:1800
  });
  assert.equal(result.complete,true);
  assert.deepEqual(result.candidates.map(v=>v.duelId),['1','2']);
  const serialized=JSON.stringify(result);
  for(const term of ['encryptedPlans','secret','privateTactics',
    'walletAddress','playerWins','verifiedHistory'])
    assert.equal(serialized.includes(term),false);
  assert.equal(result.transactionSent,false);
  assert.equal(result.walletConnected,false);
  assert.equal(result.signatureMade,false);
  console.log('GAMBIT_PROFILE_DISCOVERY_READONLY '+JSON.stringify({
    deployment:PIN.contractAddress,fromBlock:PIN.fromBlock,
    candidateIds:result.candidates.map(x=>x.duelId),
    verifiedProfileWins:0,requiresIndependentReceiptCheck:true,
    defaultReadOnly:true,chainTransactions:0
  }));
});
