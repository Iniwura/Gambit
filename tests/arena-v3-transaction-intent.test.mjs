import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {ARENA_V3_READ_ONLY_ABI,readArenaV3PublicMatch}
  from '../src/arena/public-match-reader.mjs';
import {
  ARENA_V3_INTENT_VERSION,ARENA_V3_INTENT_ACTIONS,
  stageArenaV3TransactionIntent,revalidateArenaV3UnsignedTransaction
} from '../src/arena/transaction-intent.mjs';

const READ=new Interface(ARENA_V3_READ_ONLY_ABI);
const WRITE=new Interface([
  'function sealRound(uint256 id,bytes32[11] encrypted,bytes inputProof,bool useGambit)',
  'function resolveRound(uint256 id)',
  'function finalizeRound(uint256 id,uint8 packed,bytes proof)',
  'function expireIncomplete(uint256 id)'
]);
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),C='0x'+'3'.repeat(40);
const CODE='0x6080604052600080fd';
const BLOCK_HASH='0x'+'b'.repeat(64),HAND='0x'+'c'.repeat(64);
const MANIFEST=Object.freeze({contract:'ArenaV3Research',version:1,
  chainId:11155111,address:A,runtimeHash:keccak256(CODE)});
const fee=()=>({
  gasLimit:'2000000',maxFeePerGasWei:'2000000000',
  maxPriorityFeePerGasWei:'100000000',
  maximumTotalFeeWei:'4000000000000000'
});
const encrypted=()=>({
  encryptedHandles:Array.from({length:11},(_,i)=>
    '0x'+(i+1).toString(16).padStart(64,'0')),
  inputProof:'0x1234',useGambit:false
});
const row=(overrides={})=>({
  openedAt:100000,deadlineAt:186400,challengerSealed:false,
  defenderSealed:false,resolved:false,finalized:false,
  packedScore:0,...overrides
});
function fixture(extra={}){
  return {
    height:200,blockHash:BLOCK_HASH,timestamp:150000,runtime:CODE,
    chainId:11155111,handle:HAND,reorg:false,
    state:{
      challenger:A,defender:B,currentRound:1,complete:false,
      abandoned:false,challengerGambitSpent:false,
      defenderGambitSpent:false,cumulativeChallenger:0,cumulativeDefender:0
    },
    rows:[row()],...extra
  };
}
function provider(x){
  const calls={read:0,signer:0,send:0,gas:0};
  return {
    calls,
    async getNetwork(){return {chainId:BigInt(x.chainId)};},
    async getBlockNumber(){return x.height;},
    async getBlock(n){
      if(n===x.height)return {hash:x.blockHash,timestamp:x.timestamp};
      if(n===200)return {hash:x.reorg?'0x'+'d'.repeat(64):
        BLOCK_HASH,timestamp:150000};
      return null;
    },
    async getCode(){return x.runtime;},
    async call(tx){
      calls.read++;
      assert.equal(tx.to,A);
      assert.equal(typeof tx.blockTag,'number');
      const method=READ.parseTransaction({data:tx.data});
      assert.ok(method);
      if(method.name==='matchStatus'){
        const s=x.state;
        return READ.encodeFunctionResult('matchStatus',[
          s.challenger,s.defender,s.currentRound,s.complete,s.abandoned,
          s.challengerGambitSpent,s.defenderGambitSpent,
          s.cumulativeChallenger,s.cumulativeDefender
        ]);
      }
      if(method.name==='roundStatus'){
        const r=x.rows[Number(method.args[1])-1];
        assert.ok(r);
        return READ.encodeFunctionResult('roundStatus',[
          r.openedAt,r.deadlineAt,r.challengerSealed,r.defenderSealed,
          r.resolved,r.finalized,r.packedScore
        ]);
      }
      if(method.name==='publicResultHandle'){
        return READ.encodeFunctionResult('publicResultHandle',[x.handle]);
      }
      throw Error('Forbidden ABI read');
    },
    getSigner(){calls.signer++;throw Error('NO_WALLET_ALLOWED');},
    sendTransaction(){calls.send++;throw Error('NO_SEND_ALLOWED');},
    estimateGas(){calls.gas++;throw Error('NO_NETWORK_QUOTE_ALLOWED');}
  };
}
async function stage(fx,action,actor=A,payload={},quote=fee()){
  const p=provider(fx);
  const view=await readArenaV3PublicMatch(p,MANIFEST,1);
  const intent=stageArenaV3TransactionIntent(view,{
    action,actor,payload,feeQuote:quote
  });
  return {p,intent,view};
}
const release=(p,intent,payload,approval=intent.id)=>
  revalidateArenaV3UnsignedTransaction(p,MANIFEST,intent,payload,approval);
function assertNoSecret(intent,payload){
  const text=JSON.stringify(intent);
  assert.equal(text.includes(payload.inputProof),false,
    'no encrypted proof in human-facing intent');
  for(const h of payload.encryptedHandles)
    assert.equal(text.includes(h),false,
      'no encrypted handle in public staged intent');
  for(const key of ['data','privatePlans','stakeSector','inputProof',
    'kmsDecryptionProof','encryptedHandles'])
    assert.equal(Object.hasOwn(intent,key),false);
  assert.ok(Object.isFrozen(intent));
}
test('intent exposes four explicitly allowlisted v3 writes, no create or generic send',()=>{
  assert.equal(ARENA_V3_INTENT_VERSION,1);
  assert.deepEqual(ARENA_V3_INTENT_ACTIONS,[
    'SEAL_ROUND','RESOLVE_ROUND','FINALIZE_ROUND','EXPIRE_INCOMPLETE'
  ]);
});

test('encrypted squad needs genuine invited player, no prior seal, exact ciphertext and fee cap',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  assertNoSecret(intent,payload);
  assert.equal(intent.action,'SEAL_ROUND');
  assert.equal(intent.side,'challenger');
  assert.equal(intent.matchId,1);
  assert.equal(intent.round,1);
  assert.equal(intent.chainId,11155111);
  assert.match(intent.consentText,/EXPLICIT ONE-TIME APPROVAL REQUIRED/);
  assert.match(intent.consentText,/maximum quoted EIP-1559 fee/);
  assert.equal('signed' in intent,false);
  const proposal=await release(p,intent,payload);
  assert.equal(proposal.signed,false);
  assert.equal(proposal.sent,false);
  assert.equal(proposal.value,0n);
  assert.equal(proposal.gasLimit,2000000n);
  assert.equal(proposal.maxFeePerGas,2000000000n);
  assert.equal(proposal.to,A);
  assert.equal(proposal.from,A);
  assert.equal(proposal.chainId,11155111);
  const decoded=WRITE.parseTransaction({data:proposal.data});
  assert.equal(decoded.name,'sealRound');
  assert.equal(decoded.args[0],1n);
  assert.deepEqual([...decoded.args[1]],payload.encryptedHandles);
  assert.equal(decoded.args[2],payload.inputProof);
  assert.equal(decoded.args[3],false);
  assert.deepEqual(p.calls.signer,0);
  assert.deepEqual(p.calls.send,0);
  assert.deepEqual(p.calls.gas,0);
  console.log('GAMBIT_ARENA_V3_UNSIGNED_SEAL '+JSON.stringify({
    staged:true,freshRead:true,codePin:true,oneTimeHumanUiRequired:true,
    txBroadcast:false,walletPrompts:0,liveDeployment:false
  }));
});

test('cannot bypass explicit authorization or mutate bytes/proof after approval',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  await assert.rejects(release(p,intent,payload,'0x'+'0'.repeat(64)),
    /explicit fingerprint not accepted/);
  const changed={...payload,inputProof:'0xabcd'};
  await assert.rejects(release(p,intent,changed),
    /ciphertext, KMS proof or calldata changed after approval/);
  const mutated=[...payload.encryptedHandles];mutated[4]='0x'+'f'.repeat(64);
  await assert.rejects(release(p,intent,{
    ...payload,encryptedHandles:mutated
  }),/ciphertext, KMS proof or calldata changed after approval/);
  await assert.rejects(release(p,{...intent,actor:B},payload),
    /intent mutated after staging/);
  await assert.rejects(release(p,{...intent,fee:{
    ...intent.fee,maxFeePerGasWei:'9999999999'
  }},payload),/intent mutated after staging/);
  assert.equal(p.calls.send,0);assert.equal(p.calls.signer,0);
});

test('state changes after staging require a NEW explicit action and consent',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  fx.rows[0].challengerSealed=true;
  await assert.rejects(release(p,intent,payload),
    /match state changed/);
  fx.rows[0].challengerSealed=false;
  fx.state.challengerGambitSpent=true;
  await assert.rejects(release(p,intent,payload),
    /match state changed/);
  assert.equal(p.calls.signer,0);assert.equal(p.calls.send,0);
});

test('reject reorg of the originally approved block',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  fx.height=201;
  fx.timestamp=150012;
  fx.blockHash='0x'+'f'.repeat(64);
  fx.reorg=true;
  await assert.rejects(release(p,intent,payload),
    /staged block was reorganized/);
});

test('a later empty block is allowed only if original block is still canonical',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  fx.height=201;fx.timestamp=150012;
  fx.blockHash='0x'+'f'.repeat(64);
  const tx=await release(p,intent,payload);
  assert.equal(tx.readAtBlock,201);
  assert.equal(tx.intentId,intent.id);
});

test('reject absent actor, duplicate seal, spent GAMBIT, wrong moment or extra payload',async()=>{
  const fx=fixture(),payload=encrypted();
  await assert.rejects(stage(fx,'SEAL_ROUND',C,payload),
    /only an invited match participant/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,rawTactic:'GUARD'
  }),/exact encrypted seal payload/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,encryptedHandles:payload.encryptedHandles.slice(0,10)
  }),/exactly eleven encrypted handles/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,encryptedHandles:Array(11).fill('plaintext')
  }),/encrypted handle bytes32/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,inputProof:'plaintext'
  }),/encrypted input proof/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,useGambit:'true'
  }),/public stake decision/);
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,useGambit:true,encryptedHandles:payload.encryptedHandles,
    inputProof:payload.inputProof
  },{...fee(),gasLimit:'500'}),/gas limit bounds/);
  fx.rows[0].challengerSealed=true;
  await assert.rejects(stage(fx,'SEAL_ROUND',A,payload),
    /participant already sealed/);
  fx.rows[0].challengerSealed=false;
  fx.state.challengerGambitSpent=true;
  await assert.rejects(stage(fx,'SEAL_ROUND',A,{
    ...payload,useGambit:true
  }),/once-per-match GAMBIT already used/);
  fx.rows[0].challengerSealed=true;
  fx.rows[0].defenderSealed=true;
  await assert.rejects(stage(fx,'SEAL_ROUND',A,payload),
    /round is not accepting orders|participant already sealed/);
});

test('resolution cannot be created until both accepted encrypted orders are present',async()=>{
  const fx=fixture({rows:[row({challengerSealed:true,defenderSealed:true})]});
  const {p,intent}=await stage(fx,'RESOLVE_ROUND',B,{});
  const tx=await release(p,intent,{});
  assert.equal(WRITE.parseTransaction({data:tx.data}).name,'resolveRound');
  assert.equal(tx.from,B);
  fx.rows[0].defenderSealed=false;
  await assert.rejects(release(p,intent,{}),/match state changed/);
  await assert.rejects(stage(fixture(),'RESOLVE_ROUND',A,{}),
    /both on-time orders required/);
  await assert.rejects(stage(fixture(),'RESOLVE_ROUND',C,{}),
    /only an invited match participant/);
});

test('signed KMS bytes are bound to exactly the current result handle and calldata',async()=>{
  const fx=fixture({rows:[row({
    challengerSealed:true,defenderSealed:true,resolved:true
  })]});
  const payload={packedScore:40,kmsDecryptionProof:'0x1234',resultHandle:HAND};
  const {p,intent}=await stage(fx,'FINALIZE_ROUND',A,payload);
  assert.equal(JSON.stringify(intent).includes('0x1234'),false);
  const tx=await release(p,intent,payload);
  const parsed=WRITE.parseTransaction({data:tx.data});
  assert.equal(parsed.name,'finalizeRound');
  assert.equal(parsed.args[1],40n);
  assert.equal(parsed.args[2],'0x1234');
  await assert.rejects(stage(fx,'FINALIZE_ROUND',A,{
    ...payload,resultHandle:'0x'+'e'.repeat(64)
  }),/proof is not bound to current live round handle/);
  await assert.rejects(stage(fx,'FINALIZE_ROUND',A,{
    ...payload,packedScore:64
  }),/v3 packed score/);
  await assert.rejects(release(p,intent,{
    ...payload,kmsDecryptionProof:'0xabcd'
  }),/ciphertext, KMS proof or calldata changed after approval/);
  assert.equal(tx.sent,false);
});

test('expiry only closes incomplete match; it NEVER creates a win intent',async()=>{
  const fx=fixture({timestamp:200000,rows:[row({challengerSealed:true})]});
  const {p,intent}=await stage(fx,'EXPIRE_INCOMPLETE',B,{});
  const tx=await release(p,intent,{});
  assert.equal(WRITE.parseTransaction({data:tx.data}).name,'expireIncomplete');
  assert.match(intent.summary,/NO winner/);
  await assert.rejects(stage(fixture(),'EXPIRE_INCOMPLETE',A,{}),
    /not an incomplete expired round/);
  fx.rows[0].defenderSealed=true;
  await assert.rejects(release(p,intent,{}),/match state changed/);
});

test('fee caps are strict decimal EIP-1559 bounds; no ETH transfer ever allowed',async()=>{
  const fx=fixture(),payload=encrypted();
  for(const q of [
    {...fee(),gasLimit:'20000000.5'},
    {...fee(),gasLimit:'0'},
    {...fee(),gasLimit:'21000000'},
    {...fee(),maxFeePerGasWei:'1e9'},
    {...fee(),maxFeePerGasWei:'1000'},
    {...fee(),maxPriorityFeePerGasWei:'2000000001'},
    {...fee(),maximumTotalFeeWei:'100'},
    {...fee(),value:'5'},
    {...fee(),maxFeePerGasWei:'-1'}
  ])await assert.rejects(stage(fx,'SEAL_ROUND',A,payload,q),
    /ARENA_V3_INTENT_INVALID/);
  const good=await stage(fx,'SEAL_ROUND',A,payload);
  const tx=await release(good.p,good.intent,payload);
  assert.equal(tx.value,0n);
  assert.equal(tx.gasLimit*tx.maxFeePerGas,
    BigInt(good.intent.fee.maximumTotalFeeWei));
});

test('public research mode does not unlock a wallet, createMatch or network call',async()=>{
  const fx=fixture(),payload=encrypted();
  const {p,intent}=await stage(fx,'SEAL_ROUND',A,payload);
  const before=p.calls.read;
  await assert.rejects(stage(fx,'CREATE_MATCH',A,payload),
    /unsupported action/);
  await assert.rejects(stage(fx,'SEND_TRANSACTION',A,payload),
    /unsupported action/);
  assert.ok(p.calls.read>=before);
  const tx=await release(p,intent,payload);
  assert.equal(tx.signed,false);
  assert.equal(tx.sent,false);
  assert.equal(p.calls.signer,0);
  assert.equal(p.calls.send,0);
  console.log('GAMBIT_ARENA_V3_INTENT_RESEARCH '+JSON.stringify({
    strictCalldataFingerprint:true,chainStateRevalidation:true,
    originBlockReorgCheck:true,gasBudgetRequired:true,
    onchainWrites:0,walletPrompts:0,externalKmsProofVerified:false,
    deployedV3:false,callerManifestIndependentApproval:'REQUIRED'
  }));
});
