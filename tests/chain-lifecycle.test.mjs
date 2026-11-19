import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeStep } from '../src/chain/lifecycle.mjs';

const ALICE = '0x1111111111111111111111111111111111111111';
const BOB = '0x2222222222222222222222222222222222222222';
const initial = {policyId:1n,challenger:ALICE,submitted:false,resolved:false,finalized:false,expired:false,finalOutcome:0};
const state = overrides => ({...initial,...overrides});

test('fresh challenge only allows its opening wallet to submit',()=>{
  assert.equal(challengeStep(initial,ALICE),'submit');
  assert.equal(challengeStep(initial,ALICE.toUpperCase().replace('0X','0x')),'submit');
  assert.throws(()=>challengeStep(initial,BOB),/wallet that opened/);
});
test('committed challenge resumes computation without duplicate ciphertext',()=>{
  assert.equal(challengeStep(state({submitted:true}),BOB),'resolve');
});
test('resolved challenge resumes signed KMS finalization without re-resolving',()=>{
  assert.equal(challengeStep(state({submitted:true,resolved:true}),BOB),'finalize');
});
test('finalized challenge reads existing immutable onchain outcome',()=>{
  assert.equal(challengeStep(state({submitted:true,resolved:true,finalized:true,finalOutcome:2}),BOB),'verified');
});
test('expired challenge always fails closed',()=>{
  assert.throws(()=>challengeStep(state({expired:true}),ALICE),/expired/);
  assert.throws(()=>challengeStep(state({submitted:true,expired:true}),ALICE),/expired/);
});
test('unknown challenge and zero-owner placeholder never become valid',()=>{
  assert.throws(()=>challengeStep(state({policyId:0n}),ALICE),/Unknown challenge/);
  assert.throws(()=>challengeStep(state({challenger:'0x0000000000000000000000000000000000000000'}),ALICE),/Unknown challenge/);
  assert.throws(()=>challengeStep(null,ALICE),/Unknown challenge/);
});
