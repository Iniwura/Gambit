import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SQUAD_ROLES,startingSquadPlans,validateSquadPlans,makeSquadMatch,
  enemySquadFor,scoreSquadOutcomes,resolveSquadTurn,
  commitSquadTurn,verifySquadTranscript,FORMATIONS,validateFormation,
  resolvePositionedSquadTurn,enemyFormationFor
} from '../src/squad.mjs';

test('three independent mutable role plans with validated actions',()=>{
  assert.deepEqual(SQUAD_ROLES,['SCOUT','GUARDIAN','STRIKER']);
  const original=startingSquadPlans();
  const copy=startingSquadPlans();
  original[0].base=0;
  assert.notDeepEqual(copy,original);
  assert.equal(validateSquadPlans(copy).length,3);
  assert.throws(()=>validateSquadPlans([copy[0]]),/exactly three/);
  assert.throws(()=>validateSquadPlans([{base:10,trigger:1,response:2},copy[1],copy[2]]),/Invalid tactic/);
});

test('SCOUT mark adds pressure only when STRIKER wins',()=>{
  const marked=scoreSquadOutcomes([1,0,1]);
  assert.equal(marked.challenger.total,4); // 2 basic + breach + mark
  assert.equal(marked.challenger.mark,1);
  const scoutAlone=scoreSquadOutcomes([1,0,2]);
  assert.equal(scoutAlone.challenger.total,1);
  assert.equal(scoutAlone.challenger.mark,0);
});

test('GUARDIAN protection cancels one enemy breach bonus but not base score',()=>{
  const protectedTeam=scoreSquadOutcomes([1,2,1]);
  assert.deepEqual(protectedTeam.challenger,{total:3,base:2,breach:1,mark:1,blocked:1,bonus:1});
  assert.equal(scoreSquadOutcomes([0,2,1]).challenger.total,1);
  assert.equal(scoreSquadOutcomes([1,1,1]).challenger.total,5);
});

test('every one of 27 lane-result patterns preserves team-swap symmetry',()=>{
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++){
    const r=[a,b,c];
    const swapped=r.map(v=>v===0?0:3-v);
    const left=scoreSquadOutcomes(r);
    const right=scoreSquadOutcomes(swapped);
    assert.equal(left.challenger.total,right.defender.total);
    assert.equal(left.defender.total,right.challenger.total);
    assert.ok(left.challenger.total>=0&&left.challenger.total<=5);
    assert.ok(left.defender.total>=0&&left.defender.total<=5);
  }
  assert.throws(()=>scoreSquadOutcomes([1,2,7]),/valid squad results/);
});

test('all 729 pairs work as role-specific hidden conditional tactics',()=>{
  const plans=[];
  for(let a=0;a<3;a++)for(let t=0;t<3;t++)for(let r=0;r<3;r++)
    plans.push({base:a,trigger:t,response:r});
  for(const a of plans)for(const b of plans){
    const result=resolveSquadTurn([a,a,a],[b,b,b]);
    const reverse=resolveSquadTurn([b,b,b],[a,a,a]);
    assert.deepEqual(result.lanes.map(l=>l.outcome),
      reverse.lanes.map(l=>l.outcome===0?0:3-l.outcome));
    assert.equal(result.pointsA,reverse.pointsB);
    assert.equal(result.pointsB,reverse.pointsA);
  }
});

test('each role matters to the outcome, not simply its sprite',()=>{
  const win={base:0,trigger:1,response:0};
  const lose={base:2,trigger:1,response:2};
  const enemy={base:2,trigger:1,response:2};
  // A STRIKE vs a FLANK wins, no triggers.
  const strong=resolveSquadTurn([win,win,win],[enemy,enemy,enemy]);
  assert.equal(strong.pointsA,5);
  const noScout=resolveSquadTurn([lose,win,win],[enemy,enemy,enemy]);
  assert.ok(noScout.pointsA<strong.pointsA,'Scout marking changes reactor pressure');
  const noStriker=resolveSquadTurn([win,win,lose],[enemy,enemy,enemy]);
  assert.ok(noStriker.pointsA<strong.pointsA,'Striker breach changes reactor pressure');
  const defenderGuardian=resolveSquadTurn([win,lose,win],[enemy,enemy,enemy]);
  assert.ok(defenderGuardian.pointsA<strong.pointsA,'Guardian changes the opposing breakthrough');
});

test('a full five-round game is deterministic with bounded control and scores',()=>{
  for(let seed=0;seed<100;seed++){
    let state=makeSquadMatch(seed),plans=[],events=[];
    while(!state.finished){
      const p=startingSquadPlans();
      p[state.round%3].base=(state.round+seed)%3;
      const out=commitSquadTurn(state,p);
      plans.push(p);
      events.push(out.event);
      assert.ok(out.event.lanes.every(l=>['role','enemyRole','challengerIndex','defenderIndex','outcome']
        .every(key=>Object.hasOwn(l,key))));
      assert.equal(out.event.lanes.length,3);
      assert.ok(out.match.round>state.round&&out.match.round<=5);
      assert.ok(Math.abs(out.match.control)<=3);
      assert.ok(out.match.scoreA>=state.scoreA&&out.match.scoreB>=state.scoreB);
      state=out.match;
    }
    assert.ok(state.winner===0||state.winner===1||state.winner===2);
    assert.ok(verifySquadTranscript(seed,plans,events));
    events[0]={...events[0],pointsA:999};
    assert.equal(verifySquadTranscript(seed,plans,events),false,'modified transcript rejected');
    assert.throws(()=>commitSquadTurn(state,startingSquadPlans()),/not active/);
  }
});

test('same seed and round return the same bot plans with no public plaintext leak',()=>{
  const state=makeSquadMatch(1102);
  assert.deepEqual(enemySquadFor(state),enemySquadFor(state));
  const snapshot=JSON.stringify(state);
  const result=commitSquadTurn(state,startingSquadPlans());
  assert.equal(JSON.stringify(state),snapshot,'original state must not be mutated');
  assert.equal(JSON.stringify(result.event).includes('trigger'),false);
  assert.equal(JSON.stringify(result.event).includes('response'),false);
  assert.equal(JSON.stringify(result.event).includes('enemyPlan'),false);
});

test('practice AI adapts to public lane results without accessing player orders',()=>{
  const original=makeSquadMatch(919),round=1;
  const baseline={...original,round,history:[{lanes:[
    {role:'SCOUT',outcome:0},{role:'GUARDIAN',outcome:0},{role:'STRIKER',outcome:0}
  ]}]};
  const sawLoss={...original,round,history:[{lanes:[
    {role:'SCOUT',outcome:1},{role:'GUARDIAN',outcome:0},{role:'STRIKER',outcome:0}
  ]}]};
  const prev=enemySquadFor(baseline);
  const adapted=enemySquadFor(sawLoss);
  assert.notDeepEqual(adapted[0],prev[0],'losing Scout lane changes Scout bot plan');
  assert.deepEqual(adapted[1],prev[1],'Guardian bot sees identical public result');
  assert.deepEqual(adapted[2],prev[2],'Striker bot sees identical public result');
  assert.deepEqual(adapted,enemySquadFor(sawLoss),'adaptation is deterministic');
});

test('formations are valid permutations; all sides have same tactical choices',()=>{
  assert.deepEqual(FORMATIONS.map(x=>x.name),['HOLD','PIVOT','FEINT']);
  for(const f of FORMATIONS)assert.deepEqual([...f.slots].sort(),[0,1,2]);
  for(const invalid of [-1,3,1.1,NaN,'1',undefined])
    assert.throws(()=>validateFormation(invalid),/Invalid squad formation/);
});

test('repositioning truly changes opponent matchup and reactor outcome',()=>{
  const always=base=>({base,trigger:0,response:base});
  const a=[always(0),always(1),always(2)];
  const b=[always(2),always(0),always(1)];
  const hold=resolvePositionedSquadTurn(a,b,0,0);
  const pivot=resolvePositionedSquadTurn(a,b,1,0);
  assert.equal(hold.pointsA,5);
  assert.equal(hold.pointsB,0);
  assert.ok(pivot.pointsA<hold.pointsA,'position changes actual combat score');
  assert.ok(pivot.lanes.some(l=>l.role!==l.enemyRole),'different roles face each other');
  assert.equal(pivot.lanes[0].role,'GUARDIAN');
  assert.equal(pivot.lanes[0].enemyRole,'SCOUT');
});

test('all 9 formation pairings preserve score symmetry across 729 tactical matchups',()=>{
  const strategies=[];
  for(let a=0;a<3;a++)for(let t=0;t<3;t++)for(let r=0;r<3;r++)
    strategies.push({base:a,trigger:t,response:r});
  for(let af=0;af<3;af++)for(let bf=0;bf<3;bf++){
    for(const a of strategies)for(const b of strategies){
      const lhs=resolvePositionedSquadTurn([a,a,a],[b,b,b],af,bf);
      const rhs=resolvePositionedSquadTurn([b,b,b],[a,a,a],bf,af);
      assert.equal(lhs.pointsA,rhs.pointsB);
      assert.equal(lhs.pointsB,rhs.pointsA);
      assert.ok(lhs.pointsA<=5 && lhs.pointsB<=5);
    }
  }
});

test('formation replay validates source and rejects tampered formation or score',()=>{
  let match=makeSquadMatch(1447),plans=[],events=[];
  for(let round=0;round<5&&!match.finished;round++){
    const formation=round%3,selected=startingSquadPlans();
    const next=commitSquadTurn(match,selected,formation);
    plans.push({plans:selected,formation});
    events.push(next.event);
    match=next.match;
  }
  assert.ok(verifySquadTranscript(1447,plans,events));
  const edited=plans.map(x=>({...x}));
  edited[0]={...edited[0],formation:(edited[0].formation+1)%3};
  assert.equal(verifySquadTranscript(1447,edited,events),false);
  assert.deepEqual(enemyFormationFor(makeSquadMatch(100)),enemyFormationFor(makeSquadMatch(100)));
});

test('bot learning follows defender ROLE across formation changes, never previous lane',()=>{
  const source=makeSquadMatch(20261119);
  const rotated=[
    {role:'GUARDIAN',enemyRole:'STRIKER',defenderIndex:2,outcome:0},
    {role:'STRIKER',enemyRole:'SCOUT',defenderIndex:0,outcome:1},
    {role:'SCOUT',enemyRole:'GUARDIAN',defenderIndex:1,outcome:0}
  ];
  const unchanged=rotated.map(l=>({...l,outcome:0}));
  const stateWithScoutLoss={...source,round:1,history:[{lanes:rotated,formationA:1,formationB:2}]};
  const stateWithoutLoss={...source,round:1,history:[{lanes:unchanged,formationA:1,formationB:2}]};
  const a=enemySquadFor(stateWithScoutLoss),b=enemySquadFor(stateWithoutLoss);
  assert.notDeepEqual(a[0],b[0],'Scout bot adapts to its own lane-two loss');
  assert.deepEqual(a[1],b[1],'Guardian bot must not adapt from another role loss');
  assert.deepEqual(a[2],b[2],'Striker bot must not adapt from another role loss');
  assert.deepEqual(a,enemySquadFor(stateWithScoutLoss),'deterministic role adaptation');
});
