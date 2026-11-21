import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveArenaV3ResearchRound,GAMBIT_WAGER_POINTS
} from '../src/research/arena-v3-rules.mjs';
import {BALANCED_OPPONENT_PLANS} from '../src/squad.mjs';
import {resolveEncounter} from '../src/engine.mjs';

const all=[];
for(let a=0;a<3;a++)for(let t=0;t<3;t++)for(let r=0;r<3;r++)
  all.push({base:a,trigger:t,response:r});
const permanent=base=>({base,trigger:base,response:base});
const formationOrder=(bases,formation,stake=null)=>({
  plans:bases.map(permanent),formation,gambitRole:stake
});

test('secret wager is NOT free expected pressure versus a tested minimax one-fighter opponent',()=>{
  let maxTotal=-Infinity,negative=0,balanced=0;
  for(const challenger of all){
    let margin=0;
    for(const opponent of BALANCED_OPPONENT_PLANS){
      const duel=resolveEncounter(challenger,opponent);
      margin+=(duel.outcome===1?GAMBIT_WAGER_POINTS:
        duel.outcome===2?-GAMBIT_WAGER_POINTS:0);
    }
    if(margin<0)negative++;
    else if(margin===0)balanced++;
    assert.ok(margin<=0,
      'fixed strategy must not earn positive wager expectancy against minimax bot: '
      +JSON.stringify(challenger));
    maxTotal=Math.max(maxTotal,margin);
  }
  assert.equal(all.length,27);
  assert.equal(maxTotal,0);
  assert.ok(negative>0&&balanced>0);
  // This isolated one-fighter expected-payoff result is not a 3v3 equilibrium,
  // not real human balance, and not a claim of hidden-order confidentiality.
});

test('all three absolute formations can be strictly best under different tactical contexts',()=>{
  const allTrio=[];
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++)
    allTrio.push([a,b,c]);
  const strictlyOptimal=new Array(3).fill(0),samples=new Array(3).fill(0);
  let meaningful=0,compared=0,distinctBest=0;
  const chargedSector=0; // all rounds rotate symmetrically by sector
  for(const player of allTrio)for(const opponent of allTrio)
    for(let enemyFormation=0;enemyFormation<3;enemyFormation++){
      const evaluations=[0,1,2].map(formation=>{
        const out=resolveArenaV3ResearchRound(
          formationOrder(player,formation),
          formationOrder(opponent,enemyFormation),
          chargedSector
        );
        return out.pointsA-out.pointsB;
      });
      const max=Math.max(...evaluations),min=Math.min(...evaluations);
      compared++;
      if(max>min)meaningful++;
      const winnerFormations=evaluations.map((v,i)=>v===max?i:-1).filter(v=>v>=0);
      for(const i of winnerFormations)samples[i]++;
      if(winnerFormations.length===1){
        strictlyOptimal[winnerFormations[0]]++;
        distinctBest++;
      }
    }
  assert.equal(compared,27*27*3);
  assert.ok(meaningful>compared*.30,
    'at least one formation should change the score in many tested tactical contexts');
  assert.ok(strictlyOptimal.every(v=>v>0),
    'each formation should uniquely outperform the other two somewhere');
  console.log('ARENA_V3_FORMATION_GAME_THEORY '+JSON.stringify({
    comparisons:compared,nontrivialFormationDecisions:meaningful,
    rate:Number((meaningful/compared).toFixed(4)),
    contextDependentStrictBest:strictlyOptimal,
    noUniversalOptimalFormationObserved:strictlyOptimal.every(v=>v>0),
    classSamples:samples,
    liveHumanBalanceProven:false
  }));
});

test('GAMBIT decision carries BOTH upside and downside against the same predictable human tactics',()=>{
  const player=[0,1,2],opponent=[2,0,1],formationA=0,formationB=0,round=0;
  const baseline=resolveArenaV3ResearchRound(
    formationOrder(player,formationA),formationOrder(opponent,formationB),round);
  const outcomes=Array.from({length:3},(_,stake)=>
    resolveArenaV3ResearchRound(
      formationOrder(player,formationA,stake),
      formationOrder(opponent,formationB),round));
  assert.ok(outcomes.some(r=>r.pointsA>baseline.pointsA),
    'some well-targeted wager must add pressure');
  // In this particular controlled matchup all three fighters win. Switch
  // opponent orders to guard all three to prove losing bets punish commander.
  const counter=resolveArenaV3ResearchRound(
    formationOrder([0,0,0],0),
    formationOrder([1,1,1],0),0);
  const risky=resolveArenaV3ResearchRound(
    formationOrder([0,0,0],0,2),
    formationOrder([1,1,1],0),0);
  assert.equal(risky.pointsB,counter.pointsB+GAMBIT_WAGER_POINTS);
  assert.equal(risky.pointsA,counter.pointsA);
});
