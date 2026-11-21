import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {
  verifyArenaProfileRecord,deriveCommanderArenaProfile
} from '../src/profile/verified-arena-record.mjs';

const CONTRACT='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const RUNTIME='0x60016003';
const EVENT_ABI=new Interface([
  'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)',
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns(uint256)',
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
function fixture(duel=7n,packed=1,transaction='0x'+'ab'.repeat(32)){
  const blockHash='0x'+'cd'.repeat(32),block=120;
  const challenger=packed>>3,defender=packed&7;
  const outcome=challenger===defender?0:challenger>defender?1:2;
  const encoded=EVENT_ABI.encodeEventLog(EVENT_ABI.getEvent('DuelFinalized'),[
    duel,challenger,defender,outcome
  ]);
  const log={
    ...encoded,address:CONTRACT,transactionHash:transaction,
    blockNumber:block,blockHash
  };
  const tx={
    hash:transaction,to:CONTRACT,from:B,value:0n,blockHash,
    data:EVENT_ABI.encodeFunctionData('finalizeDuel',[duel,packed,'0x112233'])
  };
  const receipt={
    hash:transaction,to:CONTRACT,from:B,blockHash,blockNumber:block,
    status:1,logs:[log]
  };
  const options={
    contractAddress:CONTRACT,runtimeHash:keccak256(RUNTIME),
    fromBlock:100,minimumConfirmations:12
  };
  const flags={chainId:'0xaa36a7',head:150,code:RUNTIME,
    storedPacked:packed,claimed:true,submitted:true,finalized:true,
    wrongLink:false,logCopies:1};
  const methods=[];
  const provider={
    async send(method){methods.push(method);
      assert.equal(method,'eth_chainId');return flags.chainId;},
    async getBlock(tag){return tag==='latest'?{number:flags.head}:
      {number:block,timestamp:1795279000};},
    async getCode(){return flags.code;},
    async getLogs(query){methods.push('eth_getLogs');
      return query.fromBlock<=block&&query.toBlock>=block
        ?Array.from({length:flags.logCopies},()=>log):[];},
    async getTransactionReceipt(){return receipt;},
    async getTransaction(){return tx;},
    async call({data}){
      const {name}=EVENT_ABI.parseTransaction({data});
      methods.push(name);
      if(name==='duelStatus')return EVENT_ABI.encodeFunctionResult(name,[
        3n,B,flags.submitted,true,flags.finalized,false,flags.storedPacked,
        100000n
      ]);
      if(name==='squadStatus')return EVENT_ABI.encodeFunctionResult(name,[
        A,B,true,flags.claimed
      ]);
      if(name==='duelForSquad')return EVENT_ABI.encodeFunctionResult(name,[
        flags.wrongLink?8n:duel
      ]);
      throw Error('Unrecognized view');
    }
  };
  return {provider,options,flags,tx,receipt,log,methods};
}

test('authentic receipt is the only provenance capable of generating Commander Profile record',async()=>{
  const x=fixture();
  const record=await verifyArenaProfileRecord(x.provider,7n,x.options);
  assert.equal(record.chainId,11155111);
  assert.equal(record.duelId,'7');
  assert.equal(record.squadId,'3');
  assert.equal(record.outcome,2);
  assert.equal(record.pointsChallenger,0);
  assert.equal(record.pointsDefender,1);
  assert.equal(record.evidence,'canonical-sepolia-receipt');
  assert.equal(Object.isFrozen(record),true);
  const commander=deriveCommanderArenaProfile(A,[record,record]);
  assert.equal(commander.matches,1,'repeated identical receipt must not count twice');
  assert.equal(commander.wins,1);
  assert.equal(commander.losses,0);
  assert.equal(commander.draws,0);
  const challenger=deriveCommanderArenaProfile(B,[record]);
  assert.equal(challenger.matches,1);
  assert.equal(challenger.losses,1);
  assert.deepEqual(x.methods.filter(m=>m==='eth_sendTransaction'),[]);
  for(const privateField of ['privatePlan','encryptedPlans','inputProof','decryptionProof']){
    assert.equal(JSON.stringify(commander).includes(privateField),false);
    assert.equal(JSON.stringify(record).includes(privateField),false);
  }
});

test('Commander Profile excludes unverified JSON, foreign wallets and forged wins',async()=>{
  const x=fixture();
  const genuine=await verifyArenaProfileRecord(x.provider,7n,x.options);
  assert.throws(()=>deriveCommanderArenaProfile(A,[{...genuine,pointsDefender:5}]),
    /unverified or fabricated/);
  assert.throws(()=>deriveCommanderArenaProfile(A,[JSON.parse(JSON.stringify(genuine))]),
    /unverified or fabricated/);
  assert.throws(()=>deriveCommanderArenaProfile(
    '0x3333333333333333333333333333333333333333',[genuine]),
  /not owned/);
  assert.deepEqual(deriveCommanderArenaProfile(A,[]).verifiedHistory,[]);
  assert.equal(deriveCommanderArenaProfile(A,[]).wins,0);
});

test('three independent authentic results yield nonfabricated win/loss/draw totals',async()=>{
  const f1=fixture(7n,1,'0x'+'ab'.repeat(32));
  const f2=fixture(8n,8,'0x'+'bc'.repeat(32));
  const f3=fixture(9n,0,'0x'+'de'.repeat(32));
  const records=await Promise.all([
    verifyArenaProfileRecord(f1.provider,7n,f1.options),
    verifyArenaProfileRecord(f2.provider,8n,f2.options),
    verifyArenaProfileRecord(f3.provider,9n,f3.options)
  ]);
  const a=deriveCommanderArenaProfile(A,[...records,records[0]]);
  assert.deepEqual({
    matches:a.matches,wins:a.wins,losses:a.losses,draws:a.draws
  },{matches:3,wins:1,losses:1,draws:1});
  assert.equal(a.verifiedHistory.length,3);
});

test('fail closed on wrong chain, runtime, reorg, unconfirmed and missing event',async()=>{
  for(const mutate of [
    x=>{x.flags.chainId='0x1';},
    x=>{x.flags.code='0x1234';},
    x=>{x.flags.head=122;},
    x=>{x.receipt.status=0;},
    x=>{x.tx.blockHash='0x'+'dd'.repeat(32);},
    x=>{x.tx.data='0x12345678';},
    x=>{x.flags.logCopies=0;},
    x=>{x.flags.logCopies=2;},
    x=>{x.flags.finalized=false;},
    x=>{x.flags.storedPacked=5;},
    x=>{x.flags.claimed=false;},
    x=>{x.flags.wrongLink=true;},
    x=>{x.tx.value=1n;}
  ]){
    const x=fixture();
    mutate(x);
    await assert.rejects(
      verifyArenaProfileRecord(x.provider,7n,x.options));
  }
  const x=fixture();
  await assert.rejects(
    verifyArenaProfileRecord(x.provider,0n,x.options),/duel ID/);
  await assert.rejects(
    verifyArenaProfileRecord(x.provider,7n,{...x.options,minimumConfirmations:0}),
    /minimum confirmations/);
});

test('every profile record is consent-neutral read-only and canonically deduplicated',async()=>{
  const x=fixture();
  const record=await verifyArenaProfileRecord(x.provider,7n,x.options);
  assert.equal(record.confirmations,31);
  assert.ok(x.methods.includes('eth_getLogs'));
  assert.ok(x.methods.includes('duelStatus'));
  assert.ok(x.methods.includes('squadStatus'));
  assert.ok(x.methods.includes('duelForSquad'));
  for(const name of ['eth_sendTransaction','eth_requestAccounts','personal_sign',
    'wallet_switchEthereumChain'])
    assert.equal(x.methods.includes(name),false);
  console.log('GAMBIT_PROFILE_EVIDENCE_CONTRACT '+JSON.stringify({
    source:'read-only canonical public receipt',
    profileRecords:1,confirmsMin:12,
    fakeLocalWinsAccepted:false,chainTransactions:0,
    claim:'architecture contract only, no live player profile UI'
  }));
});
