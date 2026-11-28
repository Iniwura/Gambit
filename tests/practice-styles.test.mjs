import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRACTICE_STYLES,makeSquadMatch,startingSquadPlans,
  enemySquadFor,enemyFormationFor,commitSquadTurn,verifySquadTranscript
} from '../src/squad.mjs';

test('practice bots have three explicit reproducible, validated styles',()=>{
  assert.deepEqual(PRACTICE_STYLES,['steady','reactive','volatile']);
  for(const style of PRACTICE_STYLES){
    const a=makeSquadMatch(2749,style),b=makeSquadMatch(2749,style);
    assert.equal(a.style,style);
    assert.deepEqual(enemySquadFor(a),enemySquadFor(b));
    assert.equal(enemyFormationFor(a),enemyFormationFor(b));
  }
  assert.throws(()=>makeSquadMatch(2749,'impossible'),/Invalid practice opponent style/);
});

test('steady bot repeats a learnable pattern rather than silently peeking at player',()=>{
  for(let seed=0;seed<40;seed++){
    const initial=makeSquadMatch(seed,'steady');
    const plans=enemySquadFor(initial);
    assert.equal(enemyFormationFor(initial),0);
    const late={...initial,round:3,history:[{
      formationA:2,
      lanes:[
        {defenderIndex:0,outcome:1},
        {defenderIndex:1,outcome:2},
        {defenderIndex:2,outcome:0}
      ]
    }]};
    assert.deepEqual(enemySquadFor(late),plans);
    assert.equal(enemyFormationFor(late),0);
  }
});

test('reactive and volatile bots differ without reading current private orders',()=>{
  let differences=0;
  for(let seed=0;seed<60;seed++){
    const initial=makeSquadMatch(seed,'reactive');
    const sample={...initial,round:2,history:[{
      formationA:1,lanes:[
        {defenderIndex:0,outcome:1},
        {defenderIndex:1,outcome:2},
        {defenderIndex:2,outcome:1}
      ]
    }]};
    const volatile={...sample,style:'volatile'};
    const withPrivate={...volatile,hiddenCurrentPlans:[{base:0,trigger:0,response:0}]};
    assert.deepEqual(enemySquadFor(volatile),enemySquadFor(withPrivate));
    assert.equal(enemyFormationFor(volatile),enemyFormationFor(withPrivate));
    if(JSON.stringify(enemySquadFor(volatile))!==JSON.stringify(enemySquadFor(sample))
       ||enemyFormationFor(volatile)!==enemyFormationFor(sample))differences++;
  }
  assert.ok(differences>10,'opponent styles must meaningfully change practice matches');
});

test('all bot styles finish with independently replayable, bounded 3v3 results',()=>{
  for(const style of PRACTICE_STYLES)for(let seed=0;seed<30;seed++){
    let state=makeSquadMatch(seed,style);
    const actions=[],events=[];
    while(!state.finished){
      const plans=startingSquadPlans(),formation=(state.round+seed)%3;
      const before=JSON.stringify(state);
      const step=commitSquadTurn(state,plans,formation);
      assert.equal(JSON.stringify(state),before,'immutable game state');
      actions.push({plans,formation});events.push(step.event);
      state=step.match;
    }
    assert.equal(state.style,style);
    assert.equal(verifySquadTranscript(seed,actions,events,style),true);
    assert.ok(state.round<=5 && Math.abs(state.control)<=3);
    assert.equal(events.every(e=>!('privateOrders' in e) && !('enemyPlans' in e)),true);
  }
});
