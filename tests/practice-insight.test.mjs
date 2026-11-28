import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticeInsight} from '../src/practice-insight.mjs';
import {
  makeSquadMatch,startingSquadPlans,commitSquadTurn,enemySquadFor,
  enemyFormationFor,resolvePositionedSquadTurn,FORMATIONS
} from '../src/squad.mjs';

test('practice coach explains a conditional counter that ACTUALLY executed',()=>{
  const ally={base:0,trigger:2,response:1}; // STRIKE, vs FLANK use GUARD
  const bot={base:2,trigger:1,response:2}; // FLANK, no reaction to STRIKE
  const coach=buildPracticeInsight([ally,ally,ally],[bot,bot,bot],0,0);
  assert.equal(coach.practiceOnly,true);
  assert.equal(coach.lanes.length,3);
  assert.equal(coach.lanes[0].ownCounterActivated,true);
  assert.equal(coach.lanes[0].ownAction,'GUARD');
  assert.equal(coach.lanes[0].enemyAction,'FLANK');
  assert.equal(coach.lanes[0].outcome,2);
  assert.match(coach.headline,/SCOUT COUNTER: GUARD lost to FLANK/);
  assert.match(coach.tip,/STRIKE would beat that FLANK/);
});

test('training is truthful for each role and each of nine formations',()=>{
  for(let seed=0;seed<50;seed++){
    const state=makeSquadMatch(seed);
    const ally=startingSquadPlans();
    const bot=enemySquadFor(state);
    for(let a=0;a<FORMATIONS.length;a++)for(let b=0;b<FORMATIONS.length;b++){
      const coach=buildPracticeInsight(ally,bot,a,b);
      const result=resolvePositionedSquadTurn(ally,bot,a,b);
      assert.deepEqual(coach.lanes.map(l=>l.outcome),result.lanes.map(l=>l.outcome));
      assert.deepEqual(coach.lanes.map(l=>l.role.toUpperCase()),result.lanes.map(l=>l.role));
      assert.deepEqual(coach.lanes.map(l=>l.opponentRole.toUpperCase()),result.lanes.map(l=>l.enemyRole));
      assert.ok(coach.lanes.every(l=>['STRIKE','GUARD','FLANK'].includes(l.ownAction)));
      assert.ok(coach.lanes.every(l=>['STRIKE','GUARD','FLANK'].includes(l.enemyAction)));
    }
  }
});

test('local private training evidence cannot contaminate public transcript',()=>{
  for(let seed=0;seed<40;seed++){
    const state=makeSquadMatch(seed);
    const ally=startingSquadPlans();
    const bot=enemySquadFor(state),opponentFormation=enemyFormationFor(state);
    const training=buildPracticeInsight(ally,bot,seed%3,opponentFormation);
    const {match,event}=commitSquadTurn(state,ally,seed%3);
    assert.deepEqual(training.lanes.map(l=>l.outcome),event.lanes.map(l=>l.outcome));
    for(const property of ['ownAction','enemyAction','ownCounterActivated','private','base','trigger','response']){
      assert.equal(JSON.stringify({match,event}).includes(property),false,
        'training detail '+property+' must not reach event or replay history');
    }
    assert.equal(Object.hasOwn(event,'training'),false);
    assert.equal(Object.hasOwn(match,'training'),false);
    assert.equal(state.history.length,0,'simulation must not mutate prior match');
  }
});

test('invalid squads and formations fail closed instead of offering false instruction',()=>{
  const ally=startingSquadPlans();
  assert.throws(()=>buildPracticeInsight(ally.slice(1),ally,0,0),/exactly three/);
  assert.throws(()=>buildPracticeInsight(ally,ally,3,0),/Invalid squad formation/);
  assert.throws(()=>buildPracticeInsight(ally,ally,0,NaN),/Invalid squad formation/);
  assert.throws(()=>buildPracticeInsight(ally,[{base:7,trigger:0,response:1},...ally.slice(1)],0,0),/Invalid tactic/);
});
