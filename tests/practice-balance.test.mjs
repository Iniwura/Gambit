import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSquadMatch,commitSquadTurn,startingSquadPlans,PRACTICE_STYLES
} from '../src/squad.mjs';

/**
 * A reproducible balance probe, not a claim that a bot is an unbiased human.
 * Tests 6 meaningful plans against all three local opponent styles.
 * It never touches onchain secrets or treats cleartext bots as FHE opponents.
 */
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
