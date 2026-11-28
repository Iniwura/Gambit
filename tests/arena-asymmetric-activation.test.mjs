import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAsymmetricActivation} from '../src/research/arena-asymmetric-activation.mjs';
test('integer certificate bounds asymmetric activation expected margin across every fixed choice',()=>{
 assert.deepEqual(verifyAsymmetricActivation(false),{"rivalActive":false,"choices":83349,"baseChecks":583443,"denominator":3000000000,"bestNumerator":888888900,"support":21});
 assert.deepEqual(verifyAsymmetricActivation(true),{"rivalActive":true,"choices":27783,"baseChecks":833490,"denominator":3000000000,"bestNumerator":-888888745,"support":30});
});
