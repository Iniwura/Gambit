import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSquadMatch,startingSquadPlans,commitSquadTurn} from '../src/squad.mjs';
import {buildPracticeMatchDebrief} from '../src/practice-match-debrief.mjs';
import {createFullMatchCoach,advanceFullMatchCoach,fullMatchPresentation} from '../src/training/full-match.mjs';

function harness(){
  let game=makeSquadMatch(1102,'reactive');
  const plans=startingSquadPlans();
  plans[2]={base:2,trigger:0,response:1};
  const first=commitSquadTurn(game,plans,2);
  game=first.match;
  let coach=createFullMatchCoach({round:game.round,lanes:3,
    scoreline:game.scoreA+' : '+game.scoreB});
  function teach(event){coach=advanceFullMatchCoach(coach,event);return coach}
  function commit(formation){
    const next=commitSquadTurn(game,plans,formation);
    game=next.match;
    teach({type:'commit',round:game.round,formation,plans:plans.map(x=>({...x}))});
    return next;
  }
  function settle(next){
    teach({type:'settled',round:game.round,lanes:next.event.lanes.length,
      scoreline:game.scoreA+' : '+game.scoreB,finished:game.finished,
      bonusA:next.event.bonusesA,bonusB:next.event.bonusesB,
      debrief:game.finished?buildPracticeMatchDebrief(game):null});
  }
  return {teach,commit,settle,plans,get game(){return game},get coach(){return coach}};
}

test('five-round Academy consumes actual local turns and canonical match debrief',()=>{
  const h=harness();
  assert.equal(h.coach.step,'r2-role');
  const t=h.teach;
  t({type:'role',role:0});
  h.plans[0]={base:0,trigger:1,response:2};
  for(const [field,index] of [['base',0],['trigger',1],['response',2]])
    t({type:'choose',role:0,field,index});
  assert.equal(h.coach.step,'r2-commit');
  let turn=h.commit(2);
  assert.equal(h.coach.step,'r2-settle');
  h.settle(turn);
  assert.equal(h.coach.step,'r3-role');
  t({type:'role',role:1});
  h.plans[1]={base:1,trigger:2,response:0};
  for(const [field,index] of [['base',1],['trigger',2],['response',0]])
    t({type:'choose',role:1,field,index});
  turn=h.commit(2);h.settle(turn);
  assert.equal(h.coach.step,'r4-formation');
  t({type:'formation',index:0});
  turn=h.commit(0);h.settle(turn);
  assert.equal(h.coach.step,'r5-scout');
  for(const [role,base] of [[0,2],[1,0],[2,1]]){
    t({type:'role',role});
    h.plans[role].base=base;
    t({type:'choose',role,field:'base',index:base});
  }
  assert.equal(h.coach.step,'r5-commit');
  turn=h.commit(0);h.settle(turn);
  assert.equal(h.game.round,5);
  assert.equal(h.game.finished,true);
  assert.equal(h.coach.step,'complete');
  assert.equal(h.coach.completed,true);
  assert.equal(h.coach.receipts.length,5);
  assert.equal(h.coach.debrief.scoreline,h.game.scoreA+' : '+h.game.scoreB);
  assert.deepEqual(h.coach.debrief,buildPracticeMatchDebrief(h.game));
  assert.deepEqual(h.coach.receipts.map(r=>r.round),[1,2,3,4,5]);
  assert.equal(fullMatchPresentation(h.coach).completed,true);
  assert.equal(h.coach.mode,'gambit-full-match-academy');
  assert.equal('wallet' in h.coach,false);
  assert.equal('onchainWin' in h.coach,false);
});

test('early commit creates a fail-closed recovery state, never free lesson credit',()=>{
  const h=harness();
  h.teach({type:'role',role:0});
  const turn=h.commit(2);
  assert.equal(h.coach.missed,true);
  assert.equal(h.coach.step,'recovery');
  const snapshot=h.coach;
  h.settle(turn);
  assert.equal(h.coach,snapshot);
  assert.equal(h.coach.completed,false);
  assert.match(fullMatchPresentation(h.coach).instruction,/before its required real inputs/);
});

test('duplicate accepted commit cannot revoke a pending real settlement',()=>{
  const h=harness(),t=h.teach;
  t({type:'role',role:0});
  h.plans[0]={base:0,trigger:1,response:2};
  for(const [field,index] of [['base',0],['trigger',1],['response',2]])
    t({type:'choose',role:0,field,index});
  const turn=h.commit(2);
  assert.equal(h.coach.step,'r2-settle');
  const before=h.coach;
  t({type:'commit',round:2,formation:2,plans:h.plans});
  assert.equal(h.coach,before,'at-most-once progression despite duplicate event');
  h.settle(turn);
  assert.equal(h.coach.step,'r3-role');
});

test('changed committed commands fail closed even after correct teaching clicks',()=>{
  const h=harness(),t=h.teach;
  t({type:'role',role:0});
  for(const [field,index] of [['base',0],['trigger',1],['response',2]])
    t({type:'choose',role:0,field,index});
  assert.equal(h.coach.step,'r2-commit');
  h.plans[0].base=2;
  h.commit(2);
  assert.equal(h.coach.step,'recovery');
  assert.equal(h.coach.completed,false);
});

test('invalid, premature, duplicate or other-round reports cannot advance',()=>{
  const h=harness();
  const start=h.coach;
  const misplaced={type:'settled',round:2,lanes:3,scoreline:'8 : 9',finished:false};
  assert.equal(h.teach(misplaced),start);
  assert.equal(h.teach({type:'role',role:1}),start);
  assert.throws(()=>h.teach({type:'choose',role:7,field:'base',index:0}),
    /TRAINING_FULL_INVALID/);
  assert.throws(()=>h.teach({type:'commit',round:2,formation:2,plans:[{}]}),
    /TRAINING_FULL_INVALID/);
  assert.throws(()=>createFullMatchCoach({round:0,lanes:3,scoreline:'0 : 0'}));
  assert.throws(()=>h.teach({type:'settled',round:2,lanes:1,scoreline:'0 : 0',finished:false}));
  assert.equal(h.coach,start);
});

test('final graduation rejects a fake or inconsistent game-over debrief',()=>{
  const h=harness(),t=h.teach;
  t({type:'role',role:0});
  h.plans[0]={base:0,trigger:1,response:2};
  for(const [field,index] of [['base',0],['trigger',1],['response',2]])
    t({type:'choose',role:0,field,index});
  let turn=h.commit(2);h.settle(turn);
  t({type:'role',role:1});
  h.plans[1]={base:1,trigger:2,response:0};
  for(const [field,index] of [['base',1],['trigger',2],['response',0]])
    t({type:'choose',role:1,field,index});
  turn=h.commit(2);h.settle(turn);
  t({type:'formation',index:0});
  turn=h.commit(0);h.settle(turn);
  for(const [role,base] of [[0,2],[1,0],[2,1]]){
    t({type:'role',role});h.plans[role].base=base;
    t({type:'choose',role,field:'base',index:base});
  }
  turn=h.commit(0);
  const validDebrief=buildPracticeMatchDebrief(h.game);
  t({type:'settled',round:5,lanes:3,
    scoreline:h.game.scoreA+' : '+h.game.scoreB,finished:true,
    debrief:{...validDebrief,winner:(validDebrief.winner+1)%3}});
  assert.equal(h.coach.missed,true);
  assert.equal(h.coach.completed,false);
});
