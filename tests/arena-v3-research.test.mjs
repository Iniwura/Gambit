import test from 'node:test';
import assert from 'node:assert/strict';
import {startingSquadPlans} from '../src/squad.mjs';
import {
  ARENA_V3_RESEARCH_ROUNDS,
  makeArenaV3ResearchMatch,submitArenaV3ResearchOrder,
  settleArenaV3ResearchRound,publicArenaV3Snapshot
} from '../src/research/arena-v3-match.mjs';

const order=(formation=0,stakeSector=null)=>({
  plans:startingSquadPlans(),formation,stakeSector
});
function submitBoth(state,challenger=order(),defender=order()){
  const next=submitArenaV3ResearchOrder(state,'challenger',challenger);
  const ready=submitArenaV3ResearchOrder(next,'defender',defender);
  assert.equal(ready.status,'ready-to-settle');
  return ready;
}

test('five genuine sequential local research rounds complete once with bounded cumulative score',()=>{
  let state=makeArenaV3ResearchMatch('research-five-rounds');
  assert.equal(ARENA_V3_RESEARCH_ROUNDS,5);
  assert.equal(state.round,1);
  assert.equal(state.status,'planning');
  for(let round=1;round<=5;round++){
    const ready=submitBoth(state,order(round%3),order((round+1)%3));
    const next=settleArenaV3ResearchRound(ready);
    assert.equal(next.history.length,round);
    assert.equal(next.history.at(-1).round,round);
    assert.ok(next.history.at(-1).pointsA>=0);
    assert.ok(next.history.at(-1).pointsA<=7);
    assert.ok(next.history.at(-1).pointsB>=0);
    assert.ok(next.history.at(-1).pointsB<=7);
    assert.equal(next.scoreA,next.history.reduce((n,e)=>n+e.pointsA,0));
    assert.equal(next.scoreB,next.history.reduce((n,e)=>n+e.pointsB,0));
    assert.equal(next.status,round===5?'finished':'planning');
    assert.equal(next.round,round===5?5:round+1);
    assert.deepEqual(next.pending,{challenger:null,defender:null});
    assert.equal(state.history.length,round-1,'old snapshot must be unchanged');
    state=next;
  }
  assert.ok([0,1,2].includes(state.winner));
  assert.equal(state.winner,state.scoreA===state.scoreB?0:
    state.scoreA>state.scoreB?1:2);
  assert.throws(()=>submitArenaV3ResearchOrder(state,'challenger',order()),/Not accepting/);
  assert.throws(()=>settleArenaV3ResearchRound(state),/Both private/);
});

test('cannot settle early, resubmit a player, or forge a stake twice',()=>{
  const fresh=makeArenaV3ResearchMatch('research-duplicate');
  assert.throws(()=>settleArenaV3ResearchRound(fresh),/Both private/);
  const one=submitArenaV3ResearchOrder(fresh,'challenger',order(0,1));
  assert.equal(one.status,'planning');
  assert.equal(one.usedGambit.challenger,true);
  assert.throws(()=>submitArenaV3ResearchOrder(one,'challenger',order()),/Duplicate/);
  const ready=submitArenaV3ResearchOrder(one,'defender',order(2,2));
  const next=settleArenaV3ResearchRound(ready);
  assert.equal(next.usedGambit.challenger,true);
  assert.equal(next.usedGambit.defender,true);
  assert.throws(()=>submitArenaV3ResearchOrder(next,'challenger',order(1,1)),
    /once-per-match/);
  assert.throws(()=>submitArenaV3ResearchOrder(next,'defender',order(1,2)),
    /once-per-match/);
  const continuing=submitBoth(next,order(1),order(2));
  assert.equal(settleArenaV3ResearchRound(continuing).history.length,2);
});

test('public allowlist redacts secret plans, formations and private stakes on every stage',()=>{
  const start=makeArenaV3ResearchMatch('research-private');
  const original=order(2,1);
  const one=submitArenaV3ResearchOrder(start,'challenger',original);
  original.plans[0].base=0;
  assert.notEqual(one.pending.challenger.plans[0].base,0,
    'submitted private plan must be copied before caller mutation');
  const states=[start,one];
  const both=submitArenaV3ResearchOrder(one,'defender',order(1,0));
  states.push(both,settleArenaV3ResearchRound(both));
  for(const state of states){
    const publicOnly=publicArenaV3Snapshot(state);
    const json=JSON.stringify(publicOnly);
    assert.equal(Object.hasOwn(publicOnly,'pending'),false);
    assert.equal(Object.hasOwn(publicOnly,'usedGambit'),false);
    for(const secret of ['plans','formation','stakeSector','private','ciphertext','wallet'])
      assert.equal(json.includes(secret),false,'public state leaked '+secret);
    assert.ok(Object.isFrozen(publicOnly));
    assert.ok(Object.isFrozen(publicOnly.history));
    assert.ok(Object.isFrozen(state));
  }
});

test('invalid player, formation, orders and fabricated match state fail closed',()=>{
  assert.throws(()=>makeArenaV3ResearchMatch('onchain-1'),/research-only/);
  assert.throws(()=>makeArenaV3ResearchMatch('research-'),/research-only/);
  const state=makeArenaV3ResearchMatch('research-invalid');
  for(const side of ['observer','creator','',null])assert.throws(
    ()=>submitArenaV3ResearchOrder(state,side,order()),/Not accepting/);
  for(const invalid of [
    {plans:[],formation:0},
    {plans:startingSquadPlans(),formation:4},
    {plans:startingSquadPlans(),formation:0,stakeSector:-1},
    {plans:startingSquadPlans(),formation:0,stakeSector:3}
  ])assert.throws(()=>submitArenaV3ResearchOrder(state,'challenger',invalid));
  for(const forged of [
    {...state,mode:'onchain'},
    {...state,version:9},
    {...state,round:99},
    {...state,scoreA:100},
    {...state,history:new Array(6).fill({})},
    null
  ])assert.throws(()=>publicArenaV3Snapshot(forged));
});

test('both sides receive symmetrical scores from exchanged hidden plans',()=>{
  const plans=startingSquadPlans();
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    const state=makeArenaV3ResearchMatch('research-symmetry');
    const challenger={plans,formation:a,stakeSector:null};
    const defender={plans,formation:b,stakeSector:null};
    const x=settleArenaV3ResearchRound(submitBoth(state,challenger,defender));
    const y=settleArenaV3ResearchRound(submitBoth(state,defender,challenger));
    assert.equal(x.scoreA,y.scoreB);
    assert.equal(x.scoreB,y.scoreA);
  }
  console.log('GAMBIT_ARENA_V3_HEADLESS '+JSON.stringify({
    rounds:5,privatePlansPerSide:3,
    commitOncePerMatch:'locally enforced research only',
    publicHistory:'aggregate only',
    walletTransactions:0,
    deployedV2Unchanged:true,
    stage:'architecture research, NOT live FHE multiplayer'
  }));
});
