import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_COACH_STEPS,createTrainingCoach,advanceTrainingCoach,
  trainingCoachPresentation
} from '../src/training/coach.mjs';

const enter={type:'enter',phase:'ready'};
const striker={type:'role',role:2};
const opening={type:'choose',field:'base',role:2,index:2};
const trigger={type:'choose',field:'trigger',role:2,index:0};
const counter={type:'choose',field:'response',role:2,index:1};
const formation={type:'formation',index:2};
const commit={type:'commit',round:1,formation:2,
  striker:{base:2,trigger:0,response:1}};
const settle={type:'settled',round:1,lanes:3,scoreline:'2 : 1'};
const progression=[enter,striker,opening,trigger,counter,formation,commit,settle];

test('coach only advances through eight REAL local practice actions',()=>{
  let state=createTrainingCoach('intro');
  assert.equal(state.step,'enter');
  assert.equal(state.index,0);
  assert.equal(state.completed,false);
  for(const [index,event] of progression.entries()){
    const previous=state;
    state=advanceTrainingCoach(previous,event);
    assert.equal(state.index,index+1,'advance one step for action '+event.type);
    assert.equal(previous.index,index,'previous snapshot must remain immutable');
    assert.ok(Object.isFrozen(previous));
    assert.equal(state.completed,index===7);
  }
  assert.equal(state.step,'complete');
  assert.deepEqual(state.settled,{round:1,scoreline:'2 : 1',lanes:3});
  assert.equal(state.committedRound,1);
  assert.ok(Object.isFrozen(state.settled));
  assert.equal(trainingCoachPresentation(state).completed,true);
  assert.equal(trainingCoachPresentation(state).total,TRAINING_COACH_STEPS.length);
});

test('wrong fighter, wrong tactic or premature lock cannot skip the lesson',()=>{
  let s=advanceTrainingCoach(createTrainingCoach(),enter);
  for(const premature of [commit,settle,formation,opening,trigger,counter,
    {type:'role',role:1}])
    assert.equal(advanceTrainingCoach(s,premature),s);
  s=advanceTrainingCoach(s,striker);
  assert.equal(s.step,'opening');
  assert.equal(advanceTrainingCoach(s,{...opening,index:0}),s);
  s=advanceTrainingCoach(s,opening);
  assert.equal(advanceTrainingCoach(s,counter),s);
  s=advanceTrainingCoach(s,trigger);
  assert.equal(advanceTrainingCoach(s,{...counter,role:1}),s);
  s=advanceTrainingCoach(s,counter);
  assert.equal(advanceTrainingCoach(s,commit),s);
  s=advanceTrainingCoach(s,formation);
  assert.equal(s.step,'commit');
  assert.equal(advanceTrainingCoach(s,{...commit,formation:1}),s,
    'wrong actual formation cannot complete the coached exercise');
  assert.equal(advanceTrainingCoach(s,{...commit,
    striker:{base:0,trigger:0,response:1}}),s,
    'changing the Striker opening after guidance cannot earn completion');
  s=advanceTrainingCoach(s,commit);
  assert.equal(s.step,'settled');
  assert.equal(advanceTrainingCoach(s,{...settle,round:2}),s,
    'another round cannot verify the committed lesson');
  assert.equal(advanceTrainingCoach(s,settle).step,'complete');
});

test('ready-phase entry starts at role choice and reset returns to first step',()=>{
  const ready=createTrainingCoach('ready');
  assert.equal(ready.step,'role');
  assert.equal(advanceTrainingCoach(ready,enter),ready);
  let s=advanceTrainingCoach(ready,striker);
  s=advanceTrainingCoach(s,{type:'reset',phase:'intro'});
  assert.equal(s.step,'enter');
  assert.equal(s.index,0);
  assert.equal(s.committedRound,null);
  assert.equal(s.settled,null);
});

test('malformed event cannot report fake match mastery or alter canonical state',()=>{
  const initial=createTrainingCoach();
  const invalid=[null,{},[],{type:'onchain'},{type:'role',role:4},
    {type:'role',role:'2'},{type:'choose',role:2,field:'secret',index:0},
    {type:'formation',index:NaN},{type:'commit',round:0},
    {type:'commit',round:1,formation:2,striker:null},
    {type:'settled',round:1,lanes:2,scoreline:'2 : 1'},
    {type:'settled',round:1,lanes:3,scoreline:'WIN'},
    {type:'reset',phase:'chain-verified'}];
  for(const event of invalid)
    assert.throws(()=>advanceTrainingCoach(initial,event),
      /TRAINING_GUIDE_INVALID/);
  assert.equal(initial.step,'enter');
  assert.throws(()=>createTrainingCoach('chain-verified'));
  assert.throws(()=>advanceTrainingCoach({...initial,index:99},enter));
  assert.throws(()=>advanceTrainingCoach({...initial,step:'complete'},enter));
});

test('completed coach cannot mint chain wins or award repeat progression',()=>{
  let state=createTrainingCoach();
  for(const event of progression)state=advanceTrainingCoach(state,event);
  for(const event of [enter,striker,opening,trigger,counter,formation,commit,settle])
    assert.equal(advanceTrainingCoach(state,event),state);
  assert.equal('winner' in state,false);
  assert.equal('wallet' in state,false);
  assert.equal('rank' in state,false);
  assert.equal('proof' in state,false);
  const view=trainingCoachPresentation(state);
  assert.match(view.instruction,/actual public practice round/);
  assert.doesNotMatch(JSON.stringify(state),/encrypted|contract|transaction|wallet/i);
});
