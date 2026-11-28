import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticeDebrief} from '../src/tactical-report.mjs';
import {commitSquadTurn,makeSquadMatch,startingSquadPlans} from '../src/squad.mjs';

test('practice debrief describes real public role matchups after PIVOT',()=>{
  const e=commitSquadTurn(makeSquadMatch(1102),startingSquadPlans(),1).event;
  const report=buildPracticeDebrief(e);
  assert.equal(report.round,1);
  assert.ok(report.heading.includes('PIVOT'));
  assert.ok(report.scoreline.includes('CYAN +'+e.pointsA));
  assert.ok(report.scoreline.includes('VIOLET +'+e.pointsB));
  assert.equal(report.lanes.length,3);
  assert.deepEqual(report.lanes.map(l=>l.leftRole),['GUARDIAN','STRIKER','SCOUT']);
  for(const [i,l] of report.lanes.entries()){
    assert.equal(l.verdict,['DRAW','CYAN','VIOLET'][e.lanes[i].outcome]);
    assert.equal(l.rightRole,e.lanes[i].enemyRole);
  }
});

test('a debrief cannot accidentally publish a strategy by spreading opaque event objects',()=>{
  const e=commitSquadTurn(makeSquadMatch(1602),startingSquadPlans(),2).event;
  const dirty={...e,secretOpponentPlans:[{base:1,trigger:2,response:0}],
    lanes:e.lanes.map(l=>({...l,privateStrategy:'LEAK-ME'}))};
  const report=buildPracticeDebrief(dirty);
  assert.ok(!JSON.stringify(report).includes('LEAK-ME'));
  assert.ok(!JSON.stringify(report).includes('secretOpponentPlans'));
  assert.ok(!JSON.stringify(report).includes('trigger'));
  assert.ok(!JSON.stringify(report).includes('response'));
  assert.ok(report.lanes.every(l=>Object.keys(l).sort().join(',')===
    'lane,leftRole,outcome,rightRole,verdict'));
});

test('malformed result / counterfeit lane permutation is rejected',()=>{
  const e=commitSquadTurn(makeSquadMatch(1802),startingSquadPlans(),1).event;
  assert.throws(()=>buildPracticeDebrief({...e,pointsA:100}),/Invalid public/);
  assert.throws(()=>buildPracticeDebrief({...e,formationB:10}),/Invalid squad/);
  const lanes=e.lanes.map(l=>({...l}));
  lanes[0].defenderIndex=(lanes[0].defenderIndex+1)%3;
  assert.throws(()=>buildPracticeDebrief({...e,lanes}),/Lane roles/);
});
