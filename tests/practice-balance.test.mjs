import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSquadMatch,commitSquadTurn,startingSquadPlans,PRACTICE_STYLES,BALANCED_OPPONENT_PLANS
} from '../src/squad.mjs';
import {resolveEncounter} from '../src/engine.mjs';

/**
 * A reproducible balance probe, not a claim that a bot is an unbiased human.
 * Tests 6 meaningful plans against all three local opponent styles.
 * It never touches onchain secrets or treats cleartext bots as FHE opponents.
 */
test('minimax bot mix has no positive expected one-lane payoff for any of 27 legal conditional plans',()=>{
  assert.equal(BALANCED_OPPONENT_PLANS.length,9);
  const distinct=new Set(BALANCED_OPPONENT_PLANS.map(x=>JSON.stringify(x)));
  assert.equal(distinct.size,6);
  const margins=[];
  for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)
    for(let response=0;response<3;response++){
      const plan={base,trigger,response};
      const margin=BALANCED_OPPONENT_PLANS.reduce((total,bot)=>{
        const {outcome}=resolveEncounter(plan,bot);
        return total+(outcome===1?1:outcome===2?-1:0);
      },0);
      assert.ok(margin<=0,'a fixed plan beats minimax bot: '+JSON.stringify(plan));
      margins.push(margin);
    }
  assert.equal(margins.length,27);
  assert.equal(Math.max(...margins),0);
  assert.equal(Math.min(...margins),-6);
});

const CASES=[
  {name:'STRIKE + FLANK COUNTER',play:()=>Array.from({length:3},()=>
    ({base:0,trigger:1,response:2})),formation:()=>0},
  {name:'GUARD + STRIKE COUNTER',play:()=>Array.from({length:3},()=>
    ({base:1,trigger:2,response:0})),formation:()=>0},
  {name:'FLANK + GUARD COUNTER',play:()=>Array.from({length:3},()=>
    ({base:2,trigger:0,response:1})),formation:()=>0},
  {name:'ROLE-SPECIALIST',play:()=>startingSquadPlans(),formation:()=>0},
  {name:'ROTATING ORDERS',play:round=>Array.from({length:3},(_,i)=>({
    base:(round+i)%3,trigger:(round+i+1)%3,response:(round+i+2)%3
  })),formation:()=>0},
  {name:'ADAPTIVE FORMATION',play:()=>startingSquadPlans(),formation:(round,seed)=>(round+seed)%3}
];
test('1800 deterministic playthroughs quantify actual choice impact and expose obvious balance risks',()=>{
  const rows=[];
  const seeds=100;
  for(const style of PRACTICE_STYLES)for(const strategy of CASES){
    let win=0,loss=0,draw=0,pressure=0,rounds=0;
    for(let seed=0;seed<seeds;seed++){
      let match=makeSquadMatch(seed,style);
      while(!match.finished){
        const p=strategy.play(match.round,seed),formation=strategy.formation(match.round,seed);
        const step=commitSquadTurn(match,p,formation);
        match=step.match;
      }
      rounds+=match.round;
      pressure+=match.scoreA-match.scoreB;
      if(match.winner===1)win++;
      else if(match.winner===2)loss++;
      else draw++;
    }
    assert.equal(win+loss+draw,seeds);
    rows.push({opponent:style,playerPlan:strategy.name,
      wins:win,losses:loss,draws:draw,
      avgRounds:Number((rounds/seeds).toFixed(2)),
      avgPressureDelta:Number((pressure/seeds).toFixed(2))});
  }
  assert.equal(rows.length,PRACTICE_STYLES.length*CASES.length);
  // This is a regression guard for the 20 Nov exploit: pure counter spam
  // previously won all 100 sampled games against both adaptive bot styles.
  for(const row of rows.filter(r=>r.opponent!=='steady'&&
      ['STRIKE + FLANK COUNTER','GUARD + STRIKE COUNTER','FLANK + GUARD COUNTER'].includes(r.playerPlan))){
    assert.ok(row.wins<90,
      'single tactic dominates adaptive bot >90% of sampled matches: '+JSON.stringify(row));
  }
  assert.ok(new Set(rows.map(r=>r.avgPressureDelta)).size>5,
    'a tactical game should have measurably different outcomes for distinct plans');
  console.log('GAMBIT_PRACTICE_BALANCE_AUDIT '+JSON.stringify({
    designScope:'CLEAR-TEXT PRACTICE BOT ONLY',
    seedsPerStrategy:seeds,
    seededPlaythroughs:rows.length*seeds,
    doesNotProveHumanCompetitiveBalance:true,
    results:rows
  }));
});
