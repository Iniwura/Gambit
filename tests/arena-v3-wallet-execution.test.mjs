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
    async getCode(a,n){assert.equal(a,CONTRACT);return n===f.created?f.historicalCode:f.code;},
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

import {createArenaV3ExecutionSession,recoverArenaV3ActionReceipt} from '../src/arena/wallet-execution.mjs';
import {stageArenaV3TransactionIntent,ARENA_V3_WRITE_ABI} from '../src/arena/transaction-intent.mjs';
import {readArenaV3PublicMatch} from '../src/arena/public-match-reader.mjs';

const WRITE=new Interface([...ARENA_V3_WRITE_ABI,
  'event RoundSealed(uint256 indexed matchId,uint8 indexed round,address indexed who)',
  'event RoundReady(uint256 indexed matchId,uint8 indexed round,bytes32 resultHandle)',
  'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'event MatchAbandonedUnscored(uint256 indexed matchId,uint8 indexed round)'
]);
const ctx=()=>{
  const f=fixture(),p=provider(f);
  let account=A,chain='0xaa36a7',requests=[],sendResult=TX,throws=false,estimate=100000n;
  p.estimateGas=async()=>estimate;
  const wallet={async request(args){
    requests.push(args);
    if(args.method==='eth_accounts')return [account];
    if(args.method==='eth_chainId')return chain;
    if(args.method==='eth_sendTransaction'){
      if(throws)throw Error('ambiguous transport');
      return sendResult;
    }
    throw Error('unexpected RPC');
  }};
  Object.assign(f.tx,{type:2,gasLimit:300000n,maxFeePerGas:2000000000n,maxPriorityFeePerGas:100000000n});
  Object.assign(f.receipt,{gasUsed:100000n,gasPrice:1000000000n});
  return {f,p,wallet,requests,sends:()=>requests.filter(x=>x.method==='eth_sendTransaction'),
    setAccount:a=>{account=a;},setChain:c=>{chain=c;},setEstimate:e=>{estimate=e;},
    ambiguous:()=>{throws=true;},badHash:()=>{sendResult='bad';},
    session:()=>createArenaV3ExecutionSession({wallet,provider:p,manifest:MANIFEST}),
    intent:()=>stageArenaV3Create(p,MANIFEST,request())};
};
test('exact selected wallet action executes at most once in fixture, with bounded calldata and fees',async()=>{
  const c=ctx(),i=await c.intent(),s=c.session();
  const pending=await s.submit({intent:i,approval:i.id});
  assert.equal(pending.state,'HASH_RECEIVED');assert.equal(pending.transactionHash,TX);
  assert.equal(c.sends().length,1);
  const [tx]=c.sends()[0].params;
  assert.equal(tx.from,A);assert.equal(tx.to,CONTRACT);assert.equal(tx.value,'0x0');
  assert.equal(BigInt(tx.chainId),11155111n);assert.equal(tx.type,'0x2');
  assert.equal(BigInt(tx.gas),300000n);assert.equal(BigInt(tx.maxFeePerGas),2000000000n);
  assert.equal(INVITE.decodeFunctionData('createMatch',tx.data)[0],B);
  assert.equal(s.isLocked(),true);assert.equal(s.record(i.id),pending);
  await assert.rejects(s.submit({intent:i,approval:i.id}),/consumed/);
  const next=await stageArenaV3Create(c.p,MANIFEST,{...request(),defender:C});
  await assert.rejects(s.submit({intent:next,approval:next.id}),/consumed/);
  assert.equal(c.sends().length,1);
});
test('concurrent explicit approvals cannot launch a second wallet prompt',async()=>{
  const c=ctx(),i=await c.intent(),s=c.session();
  const first=s.submit({intent:i,approval:i.id});
  await assert.rejects(s.submit({intent:i,approval:i.id}),/session busy/);
  assert.equal((await first).state,'HASH_RECEIVED');assert.equal(c.sends().length,1);
});
test('invalid review, account, network, and estimate fail before wallet dispatch',async()=>{
  const c=ctx(),i=await c.intent(),s=c.session();
  await assert.rejects(s.submit({intent:i,approval:'wrong'}),/exact explicit review/);
  await assert.rejects(s.submit({intent:{...i},approval:i.id}),/immutable/);
  c.setAccount(B);await assert.rejects(s.submit({intent:i,approval:i.id}),/account changed/);
  c.setAccount(A);c.setChain('0x1');await assert.rejects(s.submit({intent:i,approval:i.id}),/Sepolia/);
  c.setChain('0xaa36a7');c.setEstimate(300001n);
  await assert.rejects(s.submit({intent:i,approval:i.id}),/gas limit/);
  assert.equal(c.sends().length,0);
});
test('ambiguous wallet error or invalid hash consumes session without claiming failure or retrying',async()=>{
  for(const fail of ['ambiguous','badHash']){
    const c=ctx(),i=await c.intent(),s=c.session();c[fail]();
    const result=await s.submit({intent:i,approval:i.id});
    assert.equal(result.state,'DISPATCHED_UNKNOWN');assert.equal(result.transactionHash,undefined);
    await assert.rejects(s.submit({intent:i,approval:i.id}),/consumed/);
    assert.equal(c.sends().length,1);
  }
});
function mine(c){
  c.f.created=104;c.f.height=106;
  for(const o of [c.f.tx,c.f.receipt,...c.f.receipt.logs]){
    o.blockNumber=104;o.blockHash=blockHash(104);
  }
}
test('creation receipt requires exact calldata, participants, fee, block and unique canonical event',async()=>{
  const c=ctx(),i=await c.intent();
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/predates reviewed action/);
  mine(c);
  const done=await recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX);
  assert.equal(done.state,'CONFIRMED_ACTION_RECEIPT');assert.equal(done.matchId,7);
  assert.equal(done.transactionHash,TX);assert.equal(c.sends().length,0);
  const log=c.f.receipt.logs[0];
  c.f.receipt.logs=[log,log];
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/duplicate exact/);
  c.f.receipt.logs=[log];c.f.tx.maxFeePerGas=2000000001n;
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/fee exceeds/);
  c.f.tx.maxFeePerGas=2000000000n;c.f.tx.data=INVITE.encodeFunctionData('createMatch',[C]);
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/differs from reviewed/);
  c.f.tx.data=INVITE.encodeFunctionData('createMatch',[B]);c.f.badBlocks.add(104);
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/receipt reorg/);
});
test('pending and reverted receipt are never success',async()=>{
  const c=ctx(),i=await c.intent();
  mine(c);c.f.height=105;
  assert.equal((await recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX)).state,'UNCONFIRMED');
  c.f.height=106;c.f.receipt.status=0;c.f.receipt.logs=[];
  assert.equal((await recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX)).state,'CONFIRMED_REVERTED');
  assert.equal(c.sends().length,0);
});
test('round receipt is bound to exact match, expected round, and seal actor',async()=>{
  const c=ctx();
  const view=await readArenaV3PublicMatch(c.p,MANIFEST,7);
  const payload={encryptedHandles:Array.from({length:11},(_,i)=>'0x'+(i+1).toString(16).padStart(64,'0')),
    inputProof:'0x1234',useGambit:false};
  const i=stageArenaV3TransactionIntent(view,{action:'SEAL_ROUND',actor:A,payload,feeQuote:fee()});
  const s=c.session(),pending=await s.submit({intent:i,payload,approval:i.id});
  assert.equal(pending.state,'HASH_RECEIVED');
  const tx=c.sends()[0].params[0];c.f.tx.data=tx.data;
  const event=WRITE.encodeEventLog(WRITE.getEvent('RoundSealed'),[7,1,A]);
  Object.assign(c.f.receipt.logs[0],event);
  mine(c);
  const confirmed=await recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX);
  assert.equal(confirmed.round,1);assert.equal(confirmed.matchId,7);
  Object.assign(c.f.receipt.logs[0],WRITE.encodeEventLog(WRITE.getEvent('RoundSealed'),[7,2,A]));
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/round mismatch/);
  Object.assign(c.f.receipt.logs[0],WRITE.encodeEventLog(WRITE.getEvent('RoundSealed'),[7,1,B]));
  await assert.rejects(recoverArenaV3ActionReceipt(c.p,MANIFEST,i,TX),/seal actor mismatch/);
});
