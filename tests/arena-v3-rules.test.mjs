import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_V3_ROUNDS,GAMBIT_WAGER_POINTS,ARENA_V3_MAX_ROUND_SCORE,
  validateArenaV3Order,chargedSectorForRound,resolveArenaV3ResearchRound,
  makeArenaV3ResearchMatch,commitArenaV3ResearchRound,
  projectArenaV3PublicRoundResult
} from '../src/research/arena-v3-rules.mjs';
import {resolvePositionedSquadTurn,startingSquadPlans} from '../src/squad.mjs';
import {nextRandom} from '../src/engine.mjs';

const always=base=>({base,trigger:base,response:base});
const order=(plans,formation=0,gambitRole=null)=>({plans,formation,gambitRole});
const allPlans=[];
for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)
  for(let response=0;response<3;response++)
    allPlans.push({base,trigger,response});

test('validates every research commitment before gameplay: exactly three tactics, formation and optional role',()=>{
  const valid=order(startingSquadPlans(),2,0);
  assert.deepEqual(validateArenaV3Order(valid),valid);
  assert.throws(()=>validateArenaV3Order(null),/Complete/);
  assert.throws(()=>validateArenaV3Order({...valid,gambitRole:undefined}),/GAMBIT/);
  assert.throws(()=>validateArenaV3Order({...valid,gambitRole:3}),/GAMBIT/);
  assert.throws(()=>validateArenaV3Order({...valid,formation:3}),/formation/);
  assert.throws(()=>validateArenaV3Order({...valid,plans:valid.plans.slice(1)}),/exactly three/);
  assert.deepEqual(Array.from({length:5},(_,i)=>chargedSectorForRound(i)),[0,1,2,0,1]);
  for(const bad of [-1,5,1.5,NaN,'1'])assert.throws(()=>chargedSectorForRound(bad),/0–4/);
});

test('new sector-stakes formula exactly preserves deployed-v2 reference scoring except for ONE public sector point',()=>{
  for(const a of allPlans)for(const b of allPlans)
    for(let af=0;af<3;af++)for(let bf=0;bf<3;bf++)
      for(let round=0;round<3;round++){
        const A=[a,a,a],B=[b,b,b];
        const prior=resolvePositionedSquadTurn(A,B,af,bf);
        const current=resolveArenaV3ResearchRound(order(A,af),order(B,bf),round);
        const charge=prior.lanes[round].outcome;
        assert.equal(current.pointsA,prior.pointsA+(charge===1?1:0));
        assert.equal(current.pointsB,prior.pointsB+(charge===2?1:0));
        assert.equal(current.debug.basePointsA,prior.pointsA);
        assert.equal(current.debug.basePointsB,prior.pointsB);
        assert.equal(current.chargedSector,round);
      }
});

test('once-per-match GAMBIT is zero-sum risk pressure on a selected fighter, never arbitrary damage',()=>{
  const win=[always(0),always(0),always(0)],lose=[always(2),always(2),always(2)];
  const winBase=resolveArenaV3ResearchRound(order(win),order(lose),0);
  const placed=resolveArenaV3ResearchRound(order(win,0,0),order(lose),0);
  assert.equal(placed.pointsA,winBase.pointsA+GAMBIT_WAGER_POINTS);
  assert.equal(placed.pointsB,winBase.pointsB);
  const wrong=resolveArenaV3ResearchRound(order(lose,0,0),order(win),0);
  const wrongBase=resolveArenaV3ResearchRound(order(lose),order(win),0);
  assert.equal(wrong.pointsB,wrongBase.pointsB+GAMBIT_WAGER_POINTS);
  assert.equal(wrong.pointsA,wrongBase.pointsA);
  const draw=resolveArenaV3ResearchRound(order(win,0,0),order(win),0);
  const noStake=resolveArenaV3ResearchRound(order(win),order(win),0);
  assert.equal(draw.pointsA,noStake.pointsA);
  assert.equal(draw.pointsB,noStake.pointsB);
  const double=resolveArenaV3ResearchRound(order(win,0,0),order(lose,0,0),0);
  assert.equal(double.pointsA,winBase.pointsA+2*GAMBIT_WAGER_POINTS);
  assert.equal(double.pointsB,winBase.pointsB);
  assert.equal(ARENA_V3_MAX_ROUND_SCORE,10);
});

test('swapping two commanders preserves team symmetry despite charged sectors and independent wagers',()=>{
  let seed=981;
  for(let i=0;i<18000;i++){
    const sample=()=>{seed=nextRandom(seed);return seed};
    const a=Array.from({length:3},()=>allPlans[sample()%27]);
    const b=Array.from({length:3},()=>allPlans[sample()%27]);
    const af=sample()%3,bf=sample()%3,round=sample()%5;
    const ga=[null,0,1,2][sample()%4],gb=[null,0,1,2][sample()%4];
    const lhs=resolveArenaV3ResearchRound(order(a,af,ga),order(b,bf,gb),round);
    const rhs=resolveArenaV3ResearchRound(order(b,bf,gb),order(a,af,ga),round);
    assert.equal(lhs.pointsA,rhs.pointsB);
    assert.equal(lhs.pointsB,rhs.pointsA);
    assert.ok(lhs.pointsA>=0&&lhs.pointsA<=10);
    assert.ok(lhs.pointsB>=0&&lhs.pointsB<=10);
    assert.ok(lhs.pointsA*16+lhs.pointsB<=255,
      'v3 can pack only in an independently audited FOUR-BIT per side schema');
  }
});

test('public charged sectors produce real rotation decisions, not a cosmetically labeled arena',()=>{
  let changed=0,compared=0;
  let seed=16541;
  for(let i=0;i<400;i++){
    const sample=()=>{seed=nextRandom(seed);return seed};
    const a=Array.from({length:3},()=>allPlans[sample()%27]);
    const b=Array.from({length:3},()=>allPlans[sample()%27]);
    for(let round=0;round<3;round++)
      for(let af=0;af<3;af++)for(let bf=0;bf<3;bf++){
        const old=resolveArenaV3ResearchRound(order(a,af),order(b,bf),round);
        const shared=resolveArenaV3ResearchRound(order(a,(af+1)%3),
          order(b,(bf+1)%3),round);
        compared++;
        if(old.pointsA!==shared.pointsA||old.pointsB!==shared.pointsB)
          changed++;
      }
  }
  assert.ok(changed>compared*.08,
    'public sector premium must make a nontrivial share of absolute rotation choices meaningful');
  console.log('ARENA_V3_SECTOR_CHOICE_STUDY '+JSON.stringify({
    compared,changed,rate:Number((changed/compared).toFixed(4)),
    originalProtocolChanged:false,uiChanged:false
  }));
});

test('two-human five-round research match enforces strict single-use wager, full rounds and final score victory',()=>{
  for(let seed=0;seed<400;seed++){
    let match=makeArenaV3ResearchMatch();
    const publicHistory=[];
    const gambitRoundA=seed%5,gambitRoundB=(seed+2)%5;
    for(let round=0;round<5;round++){
      const a=startingSquadPlans();
      const b=startingSquadPlans();
      for(let role=0;role<3;role++){
        a[role].base=(a[role].base+seed+round+role)%3;
        b[role].base=(b[role].base+seed+2*round+role)%3;
      }
      const aOrder=order(a,(seed+round)%3,
        round===gambitRoundA?(seed+round)%3:null);
      const bOrder=order(b,(seed+round+1)%3,
        round===gambitRoundB?(seed+round+1)%3:null);
      const out=commitArenaV3ResearchRound(match,aOrder,bOrder);
      assert.equal(out.match.round,round+1);
      assert.equal(out.match.finished,round===4);
      assert.equal(out.match.winner,round===4?
        out.match.scoreA===out.match.scoreB?0:out.match.scoreA>out.match.scoreB?1:2:null);
      assert.ok(out.match.scoreA>=match.scoreA);
      assert.ok(out.match.scoreB>=match.scoreB);
      if(match.spentA)assert.equal(aOrder.gambitRole,null);
      if(match.spentB)assert.equal(bOrder.gambitRole,null);
      publicHistory.push(projectArenaV3PublicRoundResult(out.round));
      assert.equal(publicHistory.at(-1).chargedSector,round%3);
      const json=JSON.stringify(publicHistory.at(-1));
      for(const forbidden of ['debug','gambitRole','formation','lanes','trigger','response','secret'])
        assert.equal(json.includes(forbidden),false);
      match=out.match;
    }
    assert.equal(match.history.length,5);
    assert.ok(match.spentA&&match.spentB);
    assert.equal(match.scoreA,publicHistory.reduce((s,r)=>s+r.pointsA,0));
    assert.equal(match.scoreB,publicHistory.reduce((s,r)=>s+r.pointsB,0));
    assert.throws(()=>commitArenaV3ResearchRound(match,order(startingSquadPlans()),
      order(startingSquadPlans())),/not accepting/);
  }
  let initial=makeArenaV3ResearchMatch();
  const plans=startingSquadPlans();
  initial=commitArenaV3ResearchRound(initial,order(plans,0,0),order(plans)).match;
  assert.throws(()=>commitArenaV3ResearchRound(initial,order(plans,0,1),order(plans)),
    /only once/);
  assert.throws(()=>commitArenaV3ResearchRound(initial,order(plans),order(plans,0,3)),
    /GAMBIT/);
});

test('research public projection is strict allowlist and fails closed for impossible scores',()=>{
  const source={
    round:1,chargedSector:0,pointsA:5,pointsB:2,scoreA:5,scoreB:2,
    secretOrder:'SHOULD_NOT_LEAK',
    hiddenGambitRole:2,enemyPrivateFormation:1,
    debug:{lanes:[{role:'SCOUT',outcome:1}],privateTactics:'DO_NOT_COPY'}
  };
  const snap=projectArenaV3PublicRoundResult(source);
  assert.deepEqual(snap,{round:1,chargedSector:0,
    pointsA:5,pointsB:2,scoreA:5,scoreB:2});
  assert.equal(Object.isFrozen(snap),true);
  for(const bad of [
    {...source,round:0}, {...source,round:6},
    {...source,chargedSector:1},
    {...source,pointsA:11},{...source,pointsB:-1},
    {...source,scoreA:4},{...source,scoreB:1},
    {...source,scoreA:51},{...source,pointsA:'5'}
  ])assert.throws(()=>projectArenaV3PublicRoundResult(bad));
});
