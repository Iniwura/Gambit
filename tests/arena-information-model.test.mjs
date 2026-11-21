import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startingSquadPlans,resolvePositionedSquadTurn
} from '../src/squad.mjs';

const configured=[];
for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)
  for(let response=0;response<3;response++)
    configured.push({base,trigger,response});

function effectivePolicy(plan){
  return [0,1,2].map(opponentBase=>
    plan.trigger===opponentBase?plan.response:plan.base).join('');
}

test('conditional tactical choices have 21 unique behaviors, not 27 independent strategies',()=>{
  assert.equal(configured.length,27);
  const byPolicy=new Map();
  for(const plan of configured){
    const fingerprint=effectivePolicy(plan);
    const members=byPolicy.get(fingerprint)||[];
    members.push(plan);byPolicy.set(fingerprint,members);
  }
  assert.equal(byPolicy.size,21);
  assert.equal(configured.length-byPolicy.size,6);
  // Explicit "ignore your trigger / stay committed" choices intentionally
  // share the same effective action regardless of enemy opening move.
  for(const constant of ['000','111','222'])
    assert.equal(byPolicy.get(constant).length,3);
  for(const [fingerprint,members] of byPolicy)
    if(!['000','111','222'].includes(fingerprint))
      assert.equal(members.length,1,'distinct conditional programs should not alias silently');
});

test('aggregate-only FHE output has a measurable but bounded information channel in a modeled single encounter',()=>{
  // This is a noncryptographic, deliberately narrow one-query experiment,
  // NOT a confidentiality proof. It assumes uniformly sampled distinct
  // opponent behavior classes and secret formations. Real people are not
  // uniform and multi-query/collusion attacks have more leakage.
  const unique=[...new Map(configured.map(plan=>[effectivePolicy(plan),plan])).values()];
  assert.equal(unique.length,21);
  const challenger=startingSquadPlans(),histogram=new Map();
  let total=0;
  for(const a of unique)for(const b of unique)for(const c of unique)
    for(let defenderFormation=0;defenderFormation<3;defenderFormation++){
      const out=resolvePositionedSquadTurn(challenger,[a,b,c],0,defenderFormation);
      const publicScore=out.pointsA+':'+out.pointsB;
      histogram.set(publicScore,(histogram.get(publicScore)||0)+1);
      total++;
    }
  assert.equal(total,21**3*3);
  const counts=[...histogram.values()];
  const entropyBits=-counts.reduce((sum,n)=>{
    const p=n/total;
    return sum+p*Math.log2(p);
  },0);
  assert.ok(histogram.size>10&&histogram.size<=36);
  assert.ok(entropyBits>2&&entropyBits<6);
  assert.equal(counts.reduce((s,n)=>s+n,0),total);
  assert.ok(counts.every(n=>n>0));
  // A single aggregate score provides clues about an opponent but does not
  // identify every possible private program in this enumerated model.
  assert.ok(Math.min(...counts)>1);
  console.log('GAMBIT_SINGLE_QUERY_INFORMATION_MODEL '+JSON.stringify({
    uniformDistinctDefenderConfigurations:total,
    distinctPublicAggregateScores:histogram.size,
    maxPossibleScoreBitCapacity:Math.log2(36),
    observedModelEntropyBits:Number(entropyBits.toFixed(3)),
    smallestOutcomeBucket:Math.min(...counts),
    largestOutcomeBucket:Math.max(...counts),
    formalPrivacyProof:false,
    humanBehaviorModel:false,
    repeatedQuerySafetyProven:false
  }));
});
