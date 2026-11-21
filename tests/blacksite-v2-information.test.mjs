import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkBlacksiteV2Opening}
  from '../src/research/blacksite-v2-information.mjs';

test('exact first-action information benchmark audits all 7776 secrets',()=>{
  const measured=benchmarkBlacksiteV2Opening();
  assert.equal(measured.codeSpace,7776);
  assert.equal(measured.scope,'EXACT_LOCAL_RESEARCH_NO_FHE');
  for(const name of ['guess','scan','scanPlusGuess','twoGuesses']){
    const outcome=measured[name];
    assert.ok(outcome.buckets>=2);
    assert.ok(outcome.buckets<=7776);
    assert.ok(outcome.expectedRemaining>=1);
    assert.ok(outcome.expectedRemaining<=7776);
    assert.ok(outcome.worstCaseRemaining>=outcome.expectedRemaining);
    assert.ok(outcome.meanPublicInformationBits>=0);
    assert.ok(outcome.meanPublicInformationBits<Math.log2(7776));
    assert.ok(Object.isFrozen(outcome));
  }
  assert.ok(measured.twoGuesses.expectedRemaining<=
    measured.guess.expectedRemaining,
    'two independent chosen guesses refine the opening partition');
  assert.equal(measured.secondGuessExample.length,5);
  assert.ok(measured.scanPlusGuess.expectedRemaining<=
    measured.guess.expectedRemaining,
    'two actions cannot provide less partition information than one');
  assert.ok(measured.scanPlusGuess.expectedRemaining<=
    measured.scan.expectedRemaining);
  // A numeric fact, not a presumption: a useful clue must reduce candidates.
  assert.ok(measured.scan.expectedRemaining<7776);
  assert.ok(measured.guess.expectedRemaining<7776);
  assert.equal(measured.fairnessProven,false);
  assert.equal(measured.optimalPlayerStrategyProven,false);
  assert.equal(measured.chainTransactionSent,false);
  console.log('GAMBIT_BLACKSITE_V2_EXACT_INFORMATION '+
    JSON.stringify(measured));
});
