import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {ARENA_V3_READ_ONLY_ABI} from '../src/arena/public-match-reader.mjs';
import {
  ARENA_V3_INVITATION_ABI,stageArenaV3Create,revalidateArenaV3Create,
  arenaV3InviteToken,parseArenaV3InviteToken,recoverArenaV3Invitation
} from '../src/arena/invitation.mjs';

const INVITE=new Interface(ARENA_V3_INVITATION_ABI);
const READ=new Interface(ARENA_V3_READ_ONLY_ABI);
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),C='0x'+'3'.repeat(40),
  CONTRACT='0x'+'4'.repeat(40);
const CODE='0x6080604052600080fd', TX='0x'+'5'.repeat(64);
const blockHash=n=>'0x'+n.toString(16).padStart(64,'0');
const MANIFEST=Object.freeze({version:1,contract:'ArenaV3Research',chainId:11155111,
  address:CONTRACT,runtimeHash:keccak256(CODE)});
const fee=()=>({gasLimit:'300000',maxFeePerGasWei:'2000000000',
  maxPriorityFeePerGasWei:'100000000',maximumTotalFeeWei:'600000000000000'});
const token=arenaV3InviteToken(TX);
const request=()=>({actor:A,defender:B,feeQuote:fee()});
function fixture(){
  const emitted=INVITE.encodeEventLog(INVITE.getEvent('MatchCreated'),[7,A,B]);
  return {height:103,created:100,counter:8,chain:11155111,code:CODE,
    historicalCode:CODE,badBlocks:new Set(),calls:{signer:0,send:0},
    tx:{hash:TX,from:A,to:CONTRACT,chainId:11155111n,value:0n,
      blockNumber:100,blockHash:blockHash(100),
      data:INVITE.encodeFunctionData('createMatch',[B])},
    receipt:{hash:TX,from:A,to:CONTRACT,status:1,blockNumber:100,
      blockHash:blockHash(100),logs:[{...emitted,address:CONTRACT,removed:false,
        transactionHash:TX,blockNumber:100,blockHash:blockHash(100)}]},
    match:{challenger:A,defender:B,currentRound:1,complete:false,
      abandoned:false,challengerGambitSpent:false,defenderGambitSpent:false,
      cumulativeChallenger:0,cumulativeDefender:0},
    rounds:[{openedAt:100000,deadlineAt:186400,challengerSealed:false,
      defenderSealed:false,resolved:false,finalized:false,packedScore:0}]};
}
function provider(f){
  return {
    async getNetwork(){return {chainId:BigInt(f.chain)};},
    async getBlockNumber(){return f.height;},
    async getBlock(n){
      if(n>f.height)return null;
      return {hash:f.badBlocks.has(n)?blockHash(n+10000):blockHash(n),
        timestamp:100000+(n-100)*12};
    },
    async getCode(a,n){assert.equal(a,CONTRACT);return n===100?f.historicalCode:f.code;},
    async getTransaction(h){assert.equal(h,TX);return f.tx;},
    async getTransactionReceipt(h){assert.equal(h,TX);return f.receipt;},
    async call(tx){
      assert.equal(tx.to,CONTRACT);assert.ok(Number.isSafeInteger(tx.blockTag));
      let decoded;
      try{decoded=INVITE.parseTransaction({data:tx.data});}catch{}
      if(decoded?.name==='nextMatchId')
        return INVITE.encodeFunctionResult('nextMatchId',[f.counter]);
      const p=READ.parseTransaction({data:tx.data});
      if(p.name==='matchStatus'){
        assert.equal(p.args[0],7n);
        const s=f.match;
        return READ.encodeFunctionResult('matchStatus',[s.challenger,s.defender,
          s.currentRound,s.complete,s.abandoned,s.challengerGambitSpent,
          s.defenderGambitSpent,s.cumulativeChallenger,s.cumulativeDefender]);
      }
      if(p.name==='roundStatus'){
        assert.equal(p.args[0],7n);
        const s=f.rounds[Number(p.args[1])-1];
        return READ.encodeFunctionResult('roundStatus',[s.openedAt,s.deadlineAt,
          s.challengerSealed,s.defenderSealed,s.resolved,s.finalized,s.packedScore]);
      }
      throw Error('Unexpected read');
    },
    getSigner(){f.calls.signer++;throw Error('No signing');},
    sendTransaction(){f.calls.send++;throw Error('No sending');}
  };
}
const stage=(f,req=request())=>stageArenaV3Create(provider(f),MANIFEST,req);
const recover=(f,who=B,t=token)=>recoverArenaV3Invitation(provider(f),MANIFEST,t,who);
test('create review binds public participant, contract, zero value and exact fee budget',async()=>{
  const f=fixture(),i=await stage(f);
  assert.equal(i.actor,A);assert.equal(i.defender,B);
  assert.equal(i.observedCounter,8);assert.equal(i.chainId,11155111);
  assert.match(i.consentText,/defender has not accepted yet/);
  assert.match(i.consentText,/0.0006 ETH/);
  assert.equal(Object.hasOwn(i,'data'),false);
  assert.equal(Object.hasOwn(i,'expectedMatchId'),false);
  assert.ok(Object.isFrozen(i)&&Object.isFrozen(i.fee));
  const p=await revalidateArenaV3Create(provider(f),MANIFEST,i,i.id);
  assert.equal(p.expectedMatchId,null);assert.equal(p.value,0n);
  assert.equal(p.from,A);assert.equal(p.to,CONTRACT);
  assert.equal(p.signed,false);assert.equal(p.sent,false);
  assert.equal(INVITE.decodeFunctionData('createMatch',p.data)[0],B);
  assert.equal(p.gasLimit*p.maxFeePerGas,600000000000000n);
  assert.deepEqual(f.calls,{signer:0,send:0});
});
test('concurrent creators may advance counter; expected match ID is never predicted',async()=>{
  const f=fixture(),i=await stage(f);
  f.height=104;f.counter=11;
  const p=await revalidateArenaV3Create(provider(f),MANIFEST,i,i.id);
  assert.equal(p.expectedMatchId,null);
  f.counter=3;
  await assert.rejects(revalidateArenaV3Create(provider(f),MANIFEST,i,i.id),/stale or reorganized/);
});
test('wrong approval, tampered invitation text, fee or actor cannot release proposal',async()=>{
  const f=fixture(),i=await stage(f);
  for(const changed of [
    {...i,actor:C},{...i,defender:C},{...i,consentText:'free'},
    {...i,fee:{...i.fee,maximumTotalFeeWei:'1000000000000000000'}},
    {...i,observedCounter:7}
  ])await assert.rejects(revalidateArenaV3Create(provider(f),MANIFEST,changed,i.id),/changed intent/);
  await assert.rejects(revalidateArenaV3Create(provider(f),MANIFEST,i,'no'),/missing exact approval/);
  f.badBlocks.add(103);f.height=104;
  await assert.rejects(revalidateArenaV3Create(provider(f),MANIFEST,i,i.id),/reorganized/);
});
test('invalid creation and unknown deployment fail closed before wallet access',async()=>{
  const f=fixture();
  for(const req of [
    {...request(),actor:B},{...request(),defender:'0x'+'0'.repeat(40)},
    {...request(),value:1},{...request(),feeQuote:{...fee(),maximumTotalFeeWei:'1'}}
  ])await assert.rejects(stage(f,req),/ARENA_V3_/);
  await assert.rejects(stageArenaV3Create(provider(f),null,request()),/manifest/);
  f.chain=1;await assert.rejects(stage(f),/wrong chain/);
  f.chain=11155111;f.code='0x00';await assert.rejects(stage(f),/runtime mismatch/);
  assert.deepEqual(f.calls,{signer:0,send:0});
});
test('invitation token is only canonical public transaction hash, never arbitrary deployment or authority',()=>{
  assert.equal(parseArenaV3InviteToken(token),TX);
  assert.equal(arenaV3InviteToken(TX.toUpperCase().replace('0X','0x')),token);
  for(const bad of ['',TX,'https://evil.example/?tx='+TX,token+'?address='+CONTRACT,
    token+'#attacker','research-hotseat-1','gambit-v3:0x1234',token+' '])
    assert.throws(()=>parseArenaV3InviteToken(bad),/invitation token/);
});
test('actual creation event gives match id to both exact seats, no wallet-control or acceptance claim',async()=>{
  const f=fixture(),d=await recover(f,B),a=await recover(f,A);
  assert.equal(d.matchId,7);assert.equal(a.matchId,7);
  assert.equal(d.seat,'defender');assert.equal(a.seat,'challenger');
  assert.equal(d.transactionHash,TX);assert.equal(d.createdBlock,100);
  assert.equal(d.challenger,A);assert.equal(d.defender,B);
  assert.equal(d.walletControlVerified,false);
  assert.equal(d.defenderAcceptanceVerified,false);
  assert.equal(d.view.status,'WAITING_FOR_BOTH');
  assert.equal(d.view.winner,null);
  assert.deepEqual(f.calls,{signer:0,send:0});
  console.log('GAMBIT_ARENA_V3_INVITE_RESEARCH '+JSON.stringify({
    confirmedReceiptFixture:true,exactCreationCalldata:true,uniqueEvent:true,
    historicalRuntime:true,matchIdFromReceipt:7,concurrentCounterSafe:true,
    seatBound:true,walletControlVerified:false,liveV3Deployment:false,txBroadcast:false
  }));
});
test('nonparticipant, unconfirmed, pending, failed or mismatched direct transaction rejected',async()=>{
  await assert.rejects(recover(fixture(),C),/not invited/);
  const f=fixture();
  f.height=101;await assert.rejects(recover(f),/three confirmations/);
  f.height=103;f.receipt.status=0;await assert.rejects(recover(f),/direct successful/);
  f.receipt.status=1;f.tx.to=C;await assert.rejects(recover(f),/direct successful/);
  f.tx.to=CONTRACT;f.tx.value=1n;await assert.rejects(recover(f),/direct successful/);
  f.tx.value=0n;f.tx.data=INVITE.encodeFunctionData('nextMatchId');
  await assert.rejects(recover(f),/exact creation method/);
  f.tx.data=INVITE.encodeFunctionData('createMatch',[B])+'00';
  await assert.rejects(recover(f),/exact creation arguments/);
  f.tx=null;await assert.rejects(recover(f),/direct successful/);
});
test('forged event, duplicate event, wrong historical code and block reorg rejected',async()=>{
  const f=fixture(),original=f.receipt.logs[0];
  f.receipt.logs=[];await assert.rejects(recover(f),/unique MatchCreated/);
  f.receipt.logs=[original,original];await assert.rejects(recover(f),/unique MatchCreated/);
  f.receipt.logs=[{...original,address:C}];await assert.rejects(recover(f),/unique MatchCreated/);
  f.receipt.logs=[{...original,removed:true}];await assert.rejects(recover(f),/canonical event/);
  f.receipt.logs=[{...original,transactionHash:blockHash(999)}];
  await assert.rejects(recover(f),/canonical event/);
  const different=INVITE.encodeEventLog(INVITE.getEvent('MatchCreated'),[7,A,C]);
  f.receipt.logs=[{...original,...different}];
  await assert.rejects(recover(f),/creation event participants/);
  f.receipt.logs=[original];f.historicalCode='0x12';
  await assert.rejects(recover(f),/runtime mismatch/);
  f.historicalCode=CODE;f.badBlocks.add(100);
  await assert.rejects(recover(f),/receipt block reorganized/);
});
test('historical invitation cannot be joined if current canonical public match contradicts it',async()=>{
  const f=fixture();f.match.defender=C;
  await assert.rejects(recover(f),/receipt and current match disagree/);
  f.match.defender=B;f.rounds[0].openedAt=99999;f.rounds[0].deadlineAt=186399;
  await assert.rejects(recover(f),/receipt and current match disagree/);
  f.rounds[0].openedAt=100000;f.rounds[0].deadlineAt=186400;
  f.counter=6;await assert.rejects(recover(f),/creation event participants or counter/);
});
test('expired invitation recovers as expired, not a win or falsely accepted seat',async()=>{
  const f=fixture();f.height=7400;
  const d=await recover(f);
  assert.equal(d.view.status,'EXPIRED_INCOMPLETE_NOT_CLOSED');
  assert.equal(d.view.winner,null);
  assert.equal(d.defenderAcceptanceVerified,false);
});
test('abort fails without signer or transaction',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();
  await assert.rejects(recoverArenaV3Invitation(provider(f),MANIFEST,token,B,
    {signal:controller.signal}),/ARENA_V3_INVITE_ABORTED/);
  assert.deepEqual(f.calls,{signer:0,send:0});
});
