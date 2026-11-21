import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSquadOutcomes} from '../src/squad.mjs';
import {scoreGambitCommitment} from '../src/research/gambit-commitment-v0.mjs';

const reference=outcomes=>{
  const scores=scoreSquadOutcomes(outcomes);
  return {lanes:outcomes.map(outcome=>({outcome})),
    pointsA:scores.challenger.total,pointsB:scores.defender.total};
};

test('GAMBIT candidate has a bounded, meaningful win/loss downside',()=>{
  const base=reference([1,2,0]);
  assert.deepEqual(scoreGambitCommitment(base),{
    pointsA:base.pointsA,pointsB:base.pointsB,
    packed:base.pointsA*8+base.pointsB,
    outcome:base.pointsA===base.pointsB?0:
      base.pointsA>base.pointsB?1:2});
  const win=scoreGambitCommitment(base,0,null);
  const loss=scoreGambitCommitment(base,1,null);
  const draw=scoreGambitCommitment(base,2,null);
  assert.equal(win.pointsA,Math.min(7,base.pointsA+2));
  assert.equal(loss.pointsA,Math.max(0,base.pointsA-1));
  assert.equal(draw.pointsA,Math.max(0,base.pointsA-1));
  assert.ok(win.pointsA>loss.pointsA,'commitment must create upside and downside');
  assert.deepEqual(Object.keys(win),['pointsA','pointsB','packed','outcome'],
    'only aggregate scoring may leave this pure candidate');
  assert.ok(Object.isFrozen(win));
  assert.equal(JSON.stringify(win).includes('sector'),false);
  assert.equal(JSON.stringify(win).includes('lane'),false);
});

test('all 27 lane configurations × 16 stake combinations are bounded and team-symmetric',()=>{
  let cases=0;
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++){
    const outcome=[a,b,c],original=reference(outcome);
    const swapped=reference(outcome.map(x=>x===0?0:3-x));
    for(const challenger of [null,0,1,2])for(const defender of [null,0,1,2]){
      const x=scoreGambitCommitment(original,challenger,defender);
      const y=scoreGambitCommitment(swapped,defender,challenger);
      assert.equal(x.pointsA,y.pointsB);
      assert.equal(x.pointsB,y.pointsA);
      assert.equal(x.outcome,y.outcome===0?0:3-y.outcome);
      assert.equal(x.packed,x.pointsA*8+x.pointsB);
      assert.ok(x.pointsA>=0&&x.pointsA<=7);
      assert.ok(x.pointsB>=0&&x.pointsB<=7);
      cases++;
    }
  }
  assert.equal(cases,432);
});

test('malformed sectors, rogue scores and unearned private output are rejected',()=>{
  const base=reference([1,1,2]);
  for(const stake of [-1,3,4,'0',0.5,NaN,{}])
    assert.throws(()=>scoreGambitCommitment(base,stake,null),
      /GAMBIT stake/);
  for(const malformed of [
    null,{}, {lanes:[],pointsA:1,pointsB:0},
    {lanes:[{outcome:1},{outcome:1},{outcome:3}],pointsA:1,pointsB:0},
    {...base,pointsA:6},{...base,pointsB:-1},
    {...base,pointsA:1.5},{...base,lanes:[{},...base.lanes.slice(1)]}
  ])assert.throws(()=>scoreGambitCommitment(malformed),/valid local reference/);
  const untouched=JSON.stringify(base);
  scoreGambitCommitment(base,0,1);
  assert.equal(JSON.stringify(base),untouched,'candidate must not mutate reference');
});

test('candidate does not change existing v2 local or onchain scoring rules',()=>{
  const base=reference([1,1,1]);
  assert.equal(base.pointsA,5);
  const speculative=scoreGambitCommitment(base,0,null);
  assert.equal(speculative.pointsA,7);
  assert.equal(speculative.packed,56);
  assert.notEqual(speculative.pointsA,base.pointsA);
  // This is a *research variant*, not an allowed score in deployed v2.
  assert.equal(speculative.pointsA>5,true);
  console.log('GAMBIT_COMMITMENT_RESEARCH '+JSON.stringify({
    referenceMode:'LOCAL_ONLY',
    separateV3ContractRequired:true,
    publicOutput:'aggregate-only',
    stake: 'one private sector per player; once-per-match NOT implemented',
    fairnessBound:'432 exhaustive symmetric cases; no human validation',
    liveProtocolModified:false
  }));
});
