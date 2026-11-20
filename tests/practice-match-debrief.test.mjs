import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSquadMatch,startingSquadPlans,commitSquadTurn} from '../src/squad.mjs';
import {buildPracticeMatchDebrief} from '../src/practice-match-debrief.mjs';

test('every finished practice match earns a grounded role-by-role replay recommendation',()=>{
  for(const style of ['steady','reactive','volatile'])for(let seed=0;seed<75;seed++){
    let match=makeSquadMatch(seed,style);
    assert.throws(()=>buildPracticeMatchDebrief(match),/completed/);
    while(!match.finished)
      match=commitSquadTurn(match,startingSquadPlans(),(seed+match.round)%3).match;
    const report=buildPracticeMatchDebrief(match);
    assert.equal(report.winner,match.winner);
    assert.equal(report.scoreline,match.scoreA+' : '+match.scoreB);
    assert.equal(report.stats.length,3);
    assert.ok(report.stats.every(s=>s.wins+s.losses+s.draws===match.round));
    assert.match(report.highlight,/STANDOUT|BALANCED/);
    assert.match(report.adjustment,/REPROGRAM|formation|counters/);
    assert.equal(Object.isFrozen(report),true);
    assert.equal(Object.isFrozen(report.stats[0]),true);
  }
});

test('rejects impossible scores, winner mismatch and forged/duplicate role lanes',()=>{
  let m=makeSquadMatch(123);
  while(!m.finished)m=commitSquadTurn(m,startingSquadPlans()).match;
  assert.throws(()=>buildPracticeMatchDebrief({...m,winner:3}),/completed/);
  assert.throws(()=>buildPracticeMatchDebrief({...m,round:0}),/completed/);
  assert.throws(()=>buildPracticeMatchDebrief({...m,scoreA:-1}),/completed/);
  assert.throws(()=>buildPracticeMatchDebrief({...m,scoreA:m.scoreB+100,winner:2}),/completed/);
  const history=m.history.map(e=>({...e,lanes:e.lanes.map(l=>({...l}))}));
  history[0].lanes[1].challengerIndex=history[0].lanes[0].challengerIndex;
  assert.throws(()=>buildPracticeMatchDebrief({...m,history}),/Invalid practice match/);
});

test('match debrief never copies attacker or defender private tactics into public game UI',()=>{
  let match=makeSquadMatch(211);
  while(!match.finished)match=commitSquadTurn(match,startingSquadPlans()).match;
  const dirty={...match,privateOpponentPlans:[{base:1,trigger:2,response:0}],
    history:match.history.map(e=>({
      ...e,
      hiddenStrategy:'DO_NOT_LEAK',
      lanes:e.lanes.map(l=>({...l,secretTactic:'DO_NOT_LEAK'}))
    }))};
  const report=buildPracticeMatchDebrief(dirty);
  const output=JSON.stringify(report);
  for(const word of ['DO_NOT_LEAK','privateOpponentPlans','hiddenStrategy','secretTactic','trigger','response'])
    assert.equal(output.includes(word),false);
});
