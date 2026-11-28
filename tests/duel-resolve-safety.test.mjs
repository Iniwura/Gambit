import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_DUEL_RESOLVE_FEE_WEI,boundDuelResolveFee}
  from '../src/chain/duel-resolve-fee.mjs';

test('live resolution estimate is buffered and bounded independently of submission',()=>{
  assert.equal(MAX_DUEL_RESOLVE_FEE_WEI,500000000n);
  const q=boundDuelResolveFee(3084819n,28n);
  assert.equal(q.gasLimit,3701783n);
  assert.equal(q.maximumQuotedFeeWei,103649924n);
  assert.equal(q.maximumWei,MAX_DUEL_RESOLVE_FEE_WEI);
});
test('resolution rejects stale, unbounded or over-ceiling gas before signing',()=>{
  for(const args of [
    [3084819n,136n],[3084819n,0n],[0n,28n],[-1n,28n],
    [3084819n,28n,0n],[3084819n,28n,500000001n],
    [3084819,28n],[3084819n,'28']
  ])assert.throws(()=>boundDuelResolveFee(...args));
});
test('one-time resolution uses new live estimate, rechecks state and receipt-first recovery',()=>{
  const s=readFileSync(new URL('../src/chain/squad-sepolia.ts',import.meta.url),'utf8');
  const a=s.indexOf('  async function resolveDuel(');
  const b=s.indexOf('  async function finalizeDuel(',a);
  assert.ok(a>=0&&b>a);
  const resolve=s.slice(a,b);
  assert.match(resolve,/boundDuelResolveFee\(estimate,freshPrice,MAX_DUEL_RESOLVE_FEE_WEI\)/);
  assert.match(resolve,/\.estimateGas\(/);
  assert.match(resolve,/\.getFeeData\(/);
  assert.match(resolve,/maxPriorityFeePerGas/);
  assert.match(resolve,/getCode\(contractAddress\)/);
  assert.equal((resolve.match(/txSucceeded\(\(\)=>contract\.resolveDuel\(/g)||[]).length,1);
  assert.match(resolve,/receiptVerified:true as const,canonicalStateVerified/);
  assert.doesNotMatch(resolve,/\.finalizeDuel\(|\.submitDuel\(|\.sealSquad\(|\.openDuel\(/);
});
test('UI makes resolution a distinct capped and independently approved action',()=>{
  const s=readFileSync(new URL('../src/chain/squad-panel.ts',import.meta.url),'utf8');
  assert.match(s,/gambit-squad-resolve-details/);
  assert.match(s,/Maximum transaction fee 500,000,000 Sepolia wei/);
  assert.match(s,/No auto-retries or automatic finalization/);
  assert.match(s,/Do NOT resolve again/);
});
