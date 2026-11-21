import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Regression checks for the separately approved single-seal CLI.
 * Static tests defend permission/fee boundaries and absence of explicit
 * account balance queries. Runtime FHE mock/TypeScript/build CI still required.
 */
const script=readFileSync(
  new URL('../fhe/scripts/seal-squad-sepolia.ts',import.meta.url),'utf8'
);

test('single-seal CLI avoids explicit account balance lookups',()=>{
  assert.doesNotMatch(script,/\.getBalance\s*\(/);
  assert.doesNotMatch(script,/eth_getBalance/);
  assert.doesNotMatch(script,/signerBalance|challengerBalance|currentBalance/);
  assert.match(script,/explicitBalanceQueriesPerformed:\s*false/);
});

test('single-seal CLI preserves exact one-time approval scope and fee cap',()=>{
  assert.match(script,/CHAIN\s*=\s*11155111n/);
  assert.match(script,/APPROVAL\s*=\s*'YES_SEPOLIA_SQUAD_SEAL_ONCE'/);
  assert.match(script,/process\.env\.GAMBIT_APPROVE_ONE_SQUAD_SEAL\s*!==\s*APPROVAL/);
  assert.match(script,/process\.env\.GAMBIT_EXPECTED_SQUAD_SEAL_SIGNER/);
  assert.match(script,/process\.env\.GAMBIT_MAX_SQUAD_SEAL_FEE_WEI/);
  assert.match(script,/process\.env\.GAMBIT_EXPECTED_NEXT_SQUAD_ID/);
  assert.match(script,/approvedMaxFeeWei\s*>\s*MAX_FEE_WEI/);
  assert.match(script,/gasLimit\s*\*\s*maxPerGas\s*>\s*approvedMaxFeeWei/g);
  assert.match(script,/BigInt\(await contract\.nextSquadId\(\)\)\s*!==\s*currentId/);
  assert.match(script,/keccak256\(await ethers\.provider\.getCode\(address\)\)/);
  assert.match(script,/submitted\.wait\(1\)/);
  assert.match(script,/transactionHash:\s*submitted\.hash/);
});

test('script has exactly one broadcast call and never approves another gameplay stage',()=>{
  assert.equal((script.match(/await contract\.sealSquad\(/g)||[]).length,1);
  assert.doesNotMatch(script,/contract\.(?:openDuel|submitDuel|resolveDuel|finalizeDuel)\(/);
  assert.match(script,/FHE|ZamaSDK/);
  assert.match(script,/contractRuntimeVerified:\s*true/);
});
