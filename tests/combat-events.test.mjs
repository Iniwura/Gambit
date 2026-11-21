import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startingSquadPlans,resolvePositionedSquadTurn,FORMATIONS
} from '../src/squad.mjs';
import {practiceCombatScript,encryptedCombatScript} from '../src/combat-events.mjs';

const tactical=(base)=>({base,trigger:base,response:base});

test('practice fight events preserve all three genuine lane outcomes and only public tactical feedback',()=>{
  for(let af=0;af<FORMATIONS.length;af++)for(let bf=0;bf<FORMATIONS.length;bf++){
    const a=[tactical(0),tactical(1),tactical(2)];
    const b=[tactical(2),tactical(0),tactical(1)];
    const event=resolvePositionedSquadTurn(a,b,af,bf);
    const dirty={...event,
      privateOpponentPlans:[{base:1,trigger:0,response:2}],
      lanes:event.lanes.map(l=>({...l,privateTactic:'NO_LEAK'}))};
    const script=practiceCombatScript(dirty);
    assert.equal(script.mode,'local-practice');
    assert.equal(script.beats.length,6);
    assert.equal(script.beats[0].kind,'squad-deploy');
    assert.equal(script.beats[0].formationA,af);
    assert.equal(script.beats[0].formationB,bf);
    const engagements=script.beats.filter(x=>x.kind==='lane-engagement');
    assert.equal(engagements.length,3);
    assert.deepEqual(engagements.map(x=>x.outcome),event.lanes.map(x=>x.outcome));
    assert.equal(script.beats[4].challenger,event.pointsA);
    assert.equal(script.beats[4].defender,event.pointsB);
    const json=JSON.stringify(script);
    for(const forbidden of ['privateOpponentPlans','privateTactic','NO_LEAK','trigger','response'])
      assert.equal(json.includes(forbidden),false);
    assert.equal(Object.isFrozen(script),true);
    assert.equal(Object.isFrozen(script.beats),true);
    assert.ok(script.beats.every(Object.isFrozen));
  }
});

test('encrypted fight animation envelope has no lane winners, formations or guessed private tactics',()=>{
  const score={pointsChallenger:3,pointsDefender:1,outcome:1,
    authenticated:true,evidence:'contract-state',
    lanes:[{role:'SCOUT',outcome:1}],formationA:2,
    enemySecret:'THIS_DOES_NOT_BELONG_HERE',trigger:1,response:0};
  const script=encryptedCombatScript(score);
  assert.equal(script.mode,'encrypted-aggregate-only');
  assert.deepEqual(script.beats,[
    {kind:'sealed-squad-standoff',fightersPerSide:3},
    {kind:'reactor-score',challenger:3,defender:1},
    {kind:'encounter-verdict',outcome:1}
  ]);
  const text=JSON.stringify(script);
  for(const forbidden of ['SCOUT','lane','formation','trigger','response','enemySecret','THIS_DOES_NOT_BELONG_HERE'])
    assert.equal(text.includes(forbidden),false);
  assert.equal(Object.isFrozen(script.beats),true);
  assert.ok(script.beats.every(Object.isFrozen));
  for(const invalid of [
    {pointsChallenger:6,pointsDefender:0,outcome:1},
    {pointsChallenger:5,pointsDefender:3,outcome:0},
    {pointsChallenger:0,pointsDefender:5,outcome:1},
    {pointsChallenger:-1,pointsDefender:2,outcome:2},
    {pointsChallenger:'5',pointsDefender:0,outcome:1}
  ])assert.throws(()=>encryptedCombatScript(invalid));
});

test('semantic animation script cannot create a fake role-level witness from only a final score',()=>{
  const authentic=encryptedCombatScript({pointsChallenger:5,pointsDefender:0,outcome:1});
  assert.equal(authentic.beats.some(x=>x.kind==='lane-engagement'),false);
  assert.equal(authentic.beats.some(x=>x.kind==='squad-deploy'),false);
  assert.equal(authentic.beats[0].kind,'sealed-squad-standoff');
  assert.equal(authentic.beats[2].outcome,1);
  assert.throws(()=>practiceCombatScript({pointsA:5,pointsB:0,lanes:[]}),/complete local practice/);
  const event=resolvePositionedSquadTurn(startingSquadPlans(),startingSquadPlans(),0,0);
  const duplicate={...event,lanes:event.lanes.map(x=>({...x}))};
  duplicate.lanes[1].challengerIndex=duplicate.lanes[0].challengerIndex;
  assert.throws(()=>practiceCombatScript(duplicate),/duplicated/);
});
