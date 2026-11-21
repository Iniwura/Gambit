import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_DUEL_SUBMIT_FEE_WEI,boundDuelSubmitFee}
  from '../src/chain/duel-submit-fee.mjs';

test('bounded real-encrypted 10-input submission quote is under explicit 500m wei ceiling',()=>{
  assert.equal(MAX_DUEL_SUBMIT_FEE_WEI,500000000n);
  const q=boundDuelSubmitFee(4143028n,42n);
  assert.equal(q.gasLimit,4971634n);
  assert.equal(q.maximumFeeWei,208808628n);
  assert.equal(q.approvedMaximumWei,MAX_DUEL_SUBMIT_FEE_WEI);
});

test('gas cap fail-closed at 500m wei including buffered limit',()=>{
  for(const args of [
    [4143028n,101n], // buffered fee > cap
    [4143028n,0n],[0n,42n],[-1n,42n],
    [4143028n,42n,0n],
    [4143028n,42n,500000001n],
    [4143028,42n],[4143028n,'42']
  ])assert.throws(()=>boundDuelSubmitFee(...args));
});

test('openDuel and submitDuel preserve confirmed receipt despite stale wallet RPC',()=>{
  const s=readFileSync(new URL('../src/chain/squad-sepolia.ts',import.meta.url),'utf8');
  const opening=s.slice(s.indexOf('  async function openDuel('),s.indexOf('  async function recoverDuelId('));
  const submission=s.slice(s.indexOf('  async function submitDuel('),s.indexOf('  async function verifiedResult('));
  assert.ok(opening.includes('txSucceeded(()=>contract.openDuel(squadId,overrides))'));
  assert.match(opening,/receiptVerified:true as const,canonicalStateVerified/);
  assert.doesNotMatch(opening,/throw Error\('Recovered duel identity mismatch/);
  assert.match(submission,/boundDuelSubmitFee\(estimate,freshPrice,MAX_DUEL_SUBMIT_FEE_WEI\)/);
  assert.match(submission,/maxPriorityFeePerGas/);
  assert.match(submission,/receiptVerified:true as const,canonicalStateVerified/);
  assert.equal((submission.match(/txSucceeded\(\(\)=>contract\.submitDuel\(/g)||[]).length,1);
  assert.doesNotMatch(submission,/\.getBalance\(|eth_getBalance|\.openDuel\(|\.resolveDuel\(|\.finalizeDuel\(/);
});

test('invitation recovery and submission remain explicitly separated in UI',()=>{
  const s=readFileSync(new URL('../src/chain/squad-panel.ts',import.meta.url),'utf8');
  assert.match(s,/if\(state\.claimed\)/);
  assert.match(s,/next\.recoverDuelId\(id\)/);
  assert.match(s,/DO NOT reopen/);
  assert.match(s,/500,000,000 Sepolia wei/);
  assert.match(s,/No auto-retries/);
});
