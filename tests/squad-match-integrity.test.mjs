import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSquadMatch,enemySquadFor,commitSquadTurn,verifySquadTranscript,
  startingSquadPlans,PRACTICE_STYLES
} from '../src/squad.mjs';
import {resolveEncounter} from '../src/engine.mjs';

const ALL_PLANS=[];
for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)
  for(let response=0;response<3;response++)ALL_PLANS.push({base,trigger,response});

function knownCounterPlan(against,wantedOutcome){
  const plan=ALL_PLANS.find(p=>resolveEncounter(p,against).outcome===wantedOutcome);
  assert.ok(plan,'independent rules engine must allow strategic counterplay');
  return plan;
}

test('reactor momentum reaching +3 cannot terminate a five-round score-based match',()=>{
  // Purpose-built fixture knows a Steady bot's fixed, public-practice-only
  // plans. Never infer an encrypted human opponent's submitted plans.
  let match=makeSquadMatch(389,'steady');
  const opponent=enemySquadFor(match);
  const player=opponent.map(p=>knownCounterPlan(p,1));
  const events=[];
  for(let n=0;n<5;n++){
    const step=commitSquadTurn(match,player,0);
    match=step.match;events.push(step.event);
    assert.equal(match.finished,n===4,'all five rounds must be playable');
    assert.equal(match.winner,n===4?1:null);
    assert.equal(match.round,n+1);
    if(n===2)assert.equal(match.control,3,'control is capped at +3 after three wins');
  }
  assert.equal(match.history.length,5);
  assert.equal(match.winner,1);
  assert.equal(match.scoreA,events.reduce((s,e)=>s+e.pointsA,0));
  assert.equal(match.scoreB,events.reduce((s,e)=>s+e.pointsB,0));
  assert.ok(verifySquadTranscript(389,Array(5).fill(player),events,'steady'));
  assert.throws(()=>commitSquadTurn(match,player,0),/not active/);
});

test('reactor momentum reaching -3 cannot terminate a five-round score-based match',()=>{
  let match=makeSquadMatch(389,'steady');
  const opponent=enemySquadFor(match);
  const player=opponent.map(p=>knownCounterPlan(p,2));
  for(let n=0;n<5;n++){
    const out=commitSquadTurn(match,player,0);
    match=out.match;
    if(n===2)assert.equal(match.control,-3);
    assert.equal(match.finished,n===4);
  }
  assert.equal(match.winner,2);
  assert.ok(match.scoreA<match.scoreB);
});

test('winner always agrees with final cumulative scoreline across styles and formations',()=>{
  for(const style of PRACTICE_STYLES){
    for(let seed=0;seed<300;seed++){
      let match=makeSquadMatch(seed,style);
      const publicEvents=[];
      const inputs=[];
      for(let round=0;round<5;round++){
        const squad=startingSquadPlans();
        // Deterministic variety: independently rotate each role's whole plan,
        // not a fake oracle that reads the opposing current hidden plans.
        for(let role=0;role<3;role++){
          squad[role].base=(squad[role].base+seed+round+role)%3;
          squad[role].trigger=(squad[role].trigger+round)%3;
          squad[role].response=(squad[role].response+seed+role)%3;
        }
        const formation=(seed+round)%3;
        const out=commitSquadTurn(match,squad,formation);
        assert.equal(out.match.round,round+1);
        assert.equal(out.match.finished,round===4);
        if(round<4)assert.equal(out.match.winner,null);
        match=out.match;
        publicEvents.push(out.event);
        inputs.push({plans:squad,formation});
      }
      assert.equal(match.scoreA,publicEvents.reduce((s,e)=>s+e.pointsA,0));
      assert.equal(match.scoreB,publicEvents.reduce((s,e)=>s+e.pointsB,0));
      const expected=match.scoreA>match.scoreB?1:match.scoreA<match.scoreB?2:0;
      assert.equal(match.winner,expected,
        'a winning side must not contradict its displayed reactor points');
      assert.equal(match.round,5);
      assert.ok(verifySquadTranscript(seed,inputs,publicEvents,style));
      assert.throws(()=>commitSquadTurn(match,startingSquadPlans()),/not active/);
    }
  }
});
