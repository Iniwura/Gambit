import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_DUEL_FINALIZE_FEE_WEI,boundDuelFinalizeFee}
  from '../src/chain/duel-finalize-fee.mjs';

test('finalization fee cap is distinct, explicit, and buffered',()=>{
  assert.equal(MAX_DUEL_FINALIZE_FEE_WEI,500000000n);
  const q=boundDuelFinalizeFee(100001n,32n);
  assert.equal(q.gasLimit,120002n);
  assert.equal(q.maximumQuotedFeeWei,3840064n);
  assert.equal(q.maximumWei,500000000n);
});
test('dangerous or over-cap quotes are rejected before wallet request',()=>{
  for(const args of [
    [100001n,5000n],[0n,32n],[-1n,32n],
    [100001n,0n],[100001n,-1n],[100001n,32n,0n],
    [100001n,32n,500000001n],[100001,32n]
  ])assert.throws(()=>boundDuelFinalizeFee(...args));
});
test('finalization uses KMS proof, estimates exact call, and never auto-retries or resolves',()=>{
  const s=readFileSync(new URL('../src/chain/squad-sepolia.ts',import.meta.url),'utf8');
  const a=s.indexOf('  async function finalizeDuel(');
  const b=s.indexOf('  return {contractAddress,userAddress,',a);
  assert.ok(a>=0&&b>a);
  const body=s.slice(a,b);
  assert.match(body,/sdk\.decryption\.decryptPublicValues/);
  assert.match(body,/boundDuelFinalizeFee\(estimate,freshPrice,MAX_DUEL_FINALIZE_FEE_WEI\)/);
  assert.match(body,/provider\.estimateGas/);
  assert.match(body,/getCode\(contractAddress\)/);
  assert.match(body,/currentHandle\.toLowerCase\(\)!==handle\.toLowerCase\(\)/);
  assert.match(body,/maxPriorityFeePerGas/);
  assert.equal((body.match(/txSucceeded\(\(\)=>contract\.finalizeDuel\(/g)||[]).length,1);
  assert.doesNotMatch(body,/\.resolveDuel\(|\.submitDuel\(|\.openDuel\(|\.sealSquad\(/);
  assert.match(body,/DuelFinalized/);
  assert.match(body,/blockTag:tx\.receipt\.blockNumber/);
});
test('UI discloses independent finalization fee cap and no automatic retry',()=>{
  const s=readFileSync(new URL('../src/chain/squad-panel.ts',import.meta.url),'utf8');
  assert.match(s,/gambit-squad-finalize-details/);
  assert.match(s,/Finalization is a NEW, separately approved Sepolia transaction/);
  assert.match(s,/Maximum possible fee 500,000,000 wei/);
  assert.match(s,/No auto-retries or additional writes/);
  assert.match(s,/Do NOT finalize again/);
});
