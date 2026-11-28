import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_V3_ROUND_POLICY_VERSION,ARENA_V3_MAX_ROUND_SECONDS,
  evaluateArenaV3RoundStatus
} from '../src/research/arena-v3-round-policy.mjs';
const A='0x'+'1'.repeat(40);
const B='0x'+'2'.repeat(40);
const base={
  mode:'arena-v3-public-round-research',version:1,
  chainId:11155111,matchId:'research-protocol-one',round:1,
  challenger:A,defender:B,openedAt:1000,deadlineAt:2000,
  seals:{challenger:null,defender:null},
  resolved:false,finalized:false,finalScore:null
};
const state=(changes={})=>({...base,...changes});
const submitted=(side,at)=>({[side]:{at}});
const get=(s,now)=>evaluateArenaV3RoundStatus(s,now);

test('v3 candidate deadline is inclusive and cannot create an automatic victory',()=>{
  assert.equal(ARENA_V3_ROUND_POLICY_VERSION,1);
  assert.equal(ARENA_V3_MAX_ROUND_SECONDS,86400);
  assert.equal(get(state(),1000).status,'WAITING_FOR_BOTH');
  assert.equal(get(state(),2000).status,'WAITING_FOR_BOTH');
  const after=get(state(),2001);
  assert.equal(after.status,'EXPIRED_UNSCORED');
  assert.equal(after.action,'REQUEST_CANCEL_OR_NEW_MATCH');
  assert.equal(after.scored,false);
  assert.equal(after.score,null);
  assert.equal('winner' in after,false);
  assert.equal('autoTx' in after,false);
});
test('single player sealed on time waits and never receives a timeout award',()=>{
  const one=state({seals:{challenger:{at:1800},defender:null}});
  const before=get(one,1900),after=get(one,2001);
  assert.equal(before.status,'WAITING_FOR_OPPONENT');
  assert.deepEqual(before.sealed,{challenger:true,defender:false});
  assert.equal(after.status,'EXPIRED_UNSCORED');
  assert.equal(after.score,null);
  assert.equal(after.scored,false);
  assert.throws(()=>get(one,1799),/future seal/);
});
test('both submitted before deadline remain eligible for resolution after it',()=>{
  const both=state({seals:{challenger:{at:1999},defender:{at:2000}}});
  const onTime=get(both,2000),later=get(both,8000);
  assert.equal(onTime.status,'READY_TO_RESOLVE');
  assert.equal(later.status,'READY_TO_RESOLVE');
  assert.equal(later.action,'RESOLVE_WITH_EXPLICIT_APPROVAL');
  assert.equal(later.scored,false);
  assert.equal(later.score,null);
});
test('resolved is not finality; only an explicitly finalized bounded aggregate scores',()=>{
  const seals={challenger:{at:1400},defender:{at:1500}};
  const wait=get(state({seals,resolved:true}),3000);
  assert.equal(wait.status,'AWAITING_SIGNED_PROOF');
  assert.equal(wait.scored,false);
  assert.equal(wait.score,null);
  const final=get(state({seals,resolved:true,finalized:true,finalScore:{
    challenger:4,defender:2,packed:34,outcome:1
  }}),3000);
  assert.equal(final.status,'FINALIZED');
  assert.equal(final.scored,true);
  assert.deepEqual(final.score,{challenger:4,defender:2,packed:34,outcome:1});
  assert.ok(Object.isFrozen(final));
  assert.ok(Object.isFrozen(final.sealed));
  assert.ok(Object.isFrozen(final.score));
});
test('missing submitted input, forged scores and contradictory state fail closed',()=>{
  const seals={challenger:{at:1400},defender:{at:1500}};
  const bad=[
    state({resolved:true}),
    state({finalized:true}),
    state({finalScore:{challenger:1,defender:0,packed:8,outcome:1}}),
    state({seals,finalized:true}),
    state({seals,resolved:true,finalized:true,finalScore:null}),
    state({seals,resolved:true,finalized:true,finalScore:{
      challenger:8,defender:0,packed:64,outcome:1
    }}),
    state({seals,resolved:true,finalized:true,finalScore:{
      challenger:2,defender:3,packed:19,outcome:1
    }}),
    state({seals,resolved:true,finalized:true,finalScore:{
      challenger:2,defender:3,packed:1,outcome:2
    }})
  ];
  for(const x of bad)assert.throws(()=>get(x,3000),/ARENA_V3_POLICY_INVALID/);
});
test('invalid player identities, round, clocks and late seals cannot be accepted',()=>{
  const bad=[
    state({challenger:B}),state({defender:'0x'+'0'.repeat(40)}),
    state({round:0}),state({round:6}),state({chainId:1}),
    state({matchId:'onchain-real'}),state({version:2}),
    state({deadlineAt:1000}),state({deadlineAt:1000+86401}),
    state({openedAt:-1}),state({seals:{challenger:{at:2001},defender:null}}),
    state({seals:{challenger:{at:999},defender:null}})
  ];
  for(const x of bad)assert.throws(()=>get(x,3000),/ARENA_V3_POLICY_INVALID/);
  assert.throws(()=>get(state(),999),/ARENA_V3_POLICY_INVALID/);
  assert.throws(()=>get(state(),NaN),/ARENA_V3_POLICY_INVALID/);
});
test('allowlisted public output never leaks tactics or private sector wagers',()=>{
  const specimen=state({seals:{challenger:{at:1200,secretPlan:'NEVER'},defender:null},
    hidden:{plans:[0,1,2],sector:1,wallet:'secret'},ciphertext:'secret'});
  const publicView=get(specimen,1500);
  const json=JSON.stringify(publicView);
  for(const secret of ['secret','ciphertext','plans','sector','wallet','private','hidden'])
    assert.equal(json.includes(secret),false,secret+' leaked into public snapshot');
  assert.deepEqual(Object.keys(publicView).sort(),[
    'mode','version','matchId','round','chainId','openedAt','deadlineAt',
    'sealed','status','action','scored','score'
  ].sort());
});
test('policy labels all five rounds without granting scores from expiry',()=>{
  for(let round=1;round<=5;round++){
    const stalled=get(state({round}),2001);
    assert.equal(stalled.round,round);
    assert.equal(stalled.status,'EXPIRED_UNSCORED');
    assert.equal(stalled.score,null);
    assert.equal(stalled.scored,false);
  }
  console.log('GAMBIT_ARENA_V3_RECOVERY_RESEARCH '+JSON.stringify({
    rounds:5,fullMatchDeployed:false,policy:'read-only research',
    expiryAwards:0,autoTransactions:0,privateTacticsExposed:false
  }));
});
