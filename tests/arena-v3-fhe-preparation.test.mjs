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
const HANDLE='0x'+'8'.repeat(64);
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
      if(p.name==='publicResultHandle')return READ.encodeFunctionResult('publicResultHandle',[HANDLE]);
      throw Error('Unexpected read');
    },
    getSigner(){f.calls.signer++;throw Error('No signing');},
    sendTransaction(){f.calls.send++;throw Error('No sending');}
  };
}

import {arenaV3ReadOnlyWallet,readArenaV3SelectedAccount,encodeArenaV3EncryptedOrder,
  prepareArenaV3Seal,prepareArenaV3Finalization,releaseArenaV3Prepared}
  from '../src/arena/fhe-preparation.mjs';
const handles=Array.from({length:11},(_,i)=>'0x'+(i+1).toString(16).padStart(64,'0'));
const order=()=>({plans:[
  {base:0,trigger:1,response:2},{base:1,trigger:2,response:0},
  {base:2,trigger:0,response:1}],formation:2,stakeSector:1});
function context(){
  const f=fixture(),p=provider(f),w={account:A,chain:'0xaa36a7',calls:[]};
  const wallet={async request(args){
    w.calls.push(args.method);
    if(args.method==='eth_chainId')return w.chain;
    if(args.method==='eth_accounts')return w.account?[w.account]:[];
    throw Error('Unexpected wallet RPC '+args.method);
  }};
  let calls=0,proofCalls=0;
  const sdk={
    async encrypt(req){calls++;assert.equal(req.contractAddress,CONTRACT);
      assert.equal(req.userAddress,A);assert.equal(req.values.length,11);
      assert.deepEqual(req.values.map(x=>x.value),[0n,1n,2n,1n,2n,0n,2n,0n,1n,2n,1n]);
      assert.ok(req.values.every(v=>v.type==='euint8'));
      return {encryptedValues:handles,inputProof:'0x1234'};
    },
    decryption:{async decryptPublicValues(h){proofCalls++;
      assert.deepEqual(h,[HANDLE]);return {clearValues:{[HANDLE]:41n},decryptionProof:'0x5678'};}}
  };
  return {f,w,p,wallet,sdk,counts:()=>({calls,proofCalls}),
    args:()=>({wallet,provider:p,manifest:MANIFEST,sdk,matchId:7,
      expectedActor:A,expectedRound:1,order:order(),feeQuote:fee()})};
}
test('eleven input order is exact and inactive GAMBIT uses a placeholder without activating',()=>{
  const a=encodeArenaV3EncryptedOrder(order());
  assert.equal(a.values.length,11);assert.equal(a.values[10].value,1n);assert.equal(a.useGambit,true);
  const b=encodeArenaV3EncryptedOrder({...order(),stakeSector:null});
  assert.equal(b.values[10].value,0n);assert.equal(b.useGambit,false);
  assert.throws(()=>encodeArenaV3EncryptedOrder({...order(),stakeSector:3}),/optional visual sector/);
  assert.throws(()=>encodeArenaV3EncryptedOrder({...order(),unexpected:true}),/exact order/);
  assert.throws(()=>encodeArenaV3EncryptedOrder({...order(),plans:[]}),/three/);
});
test('read-only wallet facade refuses signing, sends, account requests and network switching',async()=>{
  const c=context(),w=arenaV3ReadOnlyWallet(c.wallet);
  assert.equal(await readArenaV3SelectedAccount(w),A);
  for(const method of ['eth_requestAccounts','eth_sendTransaction','eth_sign','personal_sign',
    'eth_signTypedData_v4','wallet_switchEthereumChain','wallet_addEthereumChain','unknown'])
    assert.throws(()=>w.request({method}),/not read-only/);
  assert.deepEqual(c.w.calls,['eth_chainId','eth_accounts']);
});
test('valid SDK encryption candidate releases only exact round-bound unsigned calldata',async()=>{
  const c=context(),prepared=await prepareArenaV3Seal(c.args());
  assert.equal(prepared.intent.round,1);assert.equal(prepared.intent.version,2);
  assert.equal(prepared.signed,false);assert.equal(prepared.sent,false);
  assert.deepEqual(prepared.payload.encryptedHandles,handles);
  assert.equal(Object.hasOwn(prepared,'order'),false);
  const tx=await releaseArenaV3Prepared({...c.args(),prepared,approval:prepared.intent.id});
  assert.equal(tx.signed,false);assert.equal(tx.sent,false);assert.equal(tx.value,0n);
  assert.equal(c.counts().calls,1);
  assert.ok(c.w.calls.every(m=>m==='eth_chainId'||m==='eth_accounts'));
});
test('wrong account, network, invited seat, expected round and spent stake block before encryption',async()=>{
  const c=context();
  c.w.chain='0x1';await assert.rejects(prepareArenaV3Seal(c.args()),/Sepolia/);
  c.w.chain='0xaa36a7';c.w.account=B;await assert.rejects(prepareArenaV3Seal(c.args()),/account changed/);
  c.w.account=A;await assert.rejects(prepareArenaV3Seal({...c.args(),expectedRound:2}),/expected round/);
  c.f.match.challenger=C;await assert.rejects(prepareArenaV3Seal(c.args()),/not an invited/);
  c.f.match.challenger=A;c.f.match.challengerGambitSpent=true;
  await assert.rejects(prepareArenaV3Seal(c.args()),/GAMBIT already spent/);
  c.f.match.challengerGambitSpent=false;c.f.rounds[0].challengerSealed=true;
  await assert.rejects(prepareArenaV3Seal(c.args()),/not accepting/);
  assert.equal(c.counts().calls,0);
});
test('account or match change during SDK encryption invalidates the preparation',async()=>{
  const c=context();
  c.sdk.encrypt=async()=>{c.w.account=B;return {encryptedValues:handles,inputProof:'0x1234'};};
  await assert.rejects(prepareArenaV3Seal(c.args()),/account changed/);
  c.w.account=A;c.sdk.encrypt=async()=>{c.f.rounds[0].defenderSealed=true;return {encryptedValues:handles,inputProof:'0x1234'};};
  await assert.rejects(prepareArenaV3Seal(c.args()),/match changed during preparation/);
});
test('SDK malformed ciphertext, zero handles, invalid proofs or abort never produce intent',async()=>{
  const c=context();
  for(const result of [{encryptedValues:handles.slice(1),inputProof:'0x1234'},
    {encryptedValues:handles,inputProof:'0x'},{encryptedValues:['0x'+'0'.repeat(64),...handles.slice(1)],inputProof:'0x1234'}]){
    c.sdk.encrypt=async()=>result;
    await assert.rejects(prepareArenaV3Seal(c.args()),/eleven ciphertext/);
  }
  const controller=new AbortController();controller.abort();
  await assert.rejects(prepareArenaV3Seal({...c.args(),signal:controller.signal}),/ABORTED/);
});
function ready(c){
  Object.assign(c.f.rounds[0],{challengerSealed:true,defenderSealed:true,resolved:true});
}
test('KMS preparation requests exact public handle and bounded score, not verified outcome',async()=>{
  const c=context();ready(c);
  const prepared=await prepareArenaV3Finalization(c.args());
  assert.equal(prepared.authenticated,false);assert.equal(prepared.payload.packedScore,41);
  assert.equal(prepared.payload.resultHandle,HANDLE);
  assert.equal(prepared.payload.kmsDecryptionProof,'0x5678');
  const tx=await releaseArenaV3Prepared({...c.args(),prepared,approval:prepared.intent.id});
  assert.equal(tx.sent,false);assert.equal(tx.action,'FINALIZE_ROUND');
  assert.equal(c.counts().proofCalls,1);
});
test('wrong proof handle, out-of-range score, proof missing and state change are refused',async()=>{
  const c=context();ready(c);
  for(const result of [{clearValues:{['0x'+'9'.repeat(64)]:41n},decryptionProof:'0x1234'},
    {clearValues:{[HANDLE]:41n},decryptionProof:'0x'}]){
    c.sdk.decryption.decryptPublicValues=async()=>result;
    await assert.rejects(prepareArenaV3Finalization(c.args()),/missing exact result handle/);
  }
  c.sdk.decryption.decryptPublicValues=async()=>({clearValues:{[HANDLE]:64n},decryptionProof:'0x1234'});
  await assert.rejects(prepareArenaV3Finalization(c.args()),/invalid v3 public aggregate/);
  c.sdk.decryption.decryptPublicValues=async()=>{c.w.account=B;return {clearValues:{[HANDLE]:41n},decryptionProof:'0x1234'};};
  await assert.rejects(prepareArenaV3Finalization(c.args()),/account changed/);
});
test('change selected account after preparation prevents releasing unsigned calldata',async()=>{
  const c=context(),prepared=await prepareArenaV3Seal(c.args());
  c.w.account=B;
  await assert.rejects(releaseArenaV3Prepared({...c.args(),prepared,approval:prepared.intent.id}),/account changed/);
});
