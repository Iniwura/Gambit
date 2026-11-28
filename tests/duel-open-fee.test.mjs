import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_DUEL_OPEN_FEE_WEI,boundDuelOpenFee}
  from '../src/chain/duel-open-fee.mjs';

test('one-use browser challenge is fee-capped before a wallet prompt',()=>{
  assert.equal(MAX_DUEL_OPEN_FEE_WEI,200000000n);
  const result=boundDuelOpenFee(477824n,36n);
  assert.equal(result.gasLimit,573389n);
  assert.equal(result.maxQuotedFeeWei,20642004n);
  assert.equal(result.maximumFeeWei,MAX_DUEL_OPEN_FEE_WEI);
});

test('reject stale, invalid or too-expensive challenge fee requests',()=>{
  for(const args of [
    [0n,36n],[-1n,36n],[477824n,0n],
    [477824n,-20n],[10000000n,36n],
    [477824n,36n,200000001n],
    [477824n,36n,0n],
    [477824,36n],
    [477824n,NaN]
  ])
    assert.throws(()=>boundDuelOpenFee(...args));
});

test('published wallet openDuel flow retains explicit one-use and fee gates',()=>{
  const source=readFileSync(new URL('../src/chain/squad-sepolia.ts',import.meta.url),'utf8');
  const open=source.slice(source.indexOf('  async function openDuel('),source.indexOf('  async function recoverDuelId('));
  assert.ok(open.startsWith('  async function openDuel('));
  assert.match(open,/boundDuelOpenFee\(estimated,/g);
  assert.match(open,/duelForSquad\(squadId\)/g);
  assert.match(open,/getCode\(contractAddress\)/);
  assert.match(open,/nextDuelId\(\)/);
  assert.match(open,/canOpenSquad\(again,userAddress\)/);
  assert.match(open,/await assertWalletStable\(\)/);
  assert.match(open,/contract\.openDuel\(squadId,overrides\)/);
  assert.doesNotMatch(open,/getBalance\(|eth_getBalance|contract\.submitDuel\(/);
  assert.equal((open.match(/contract\.openDuel\(squadId,overrides\)/g)||[]).length,1);
});
