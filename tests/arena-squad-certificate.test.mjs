import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySquadCertificate} from '../src/research/arena-squad-certificate.mjs';

test('coordinated squad mixtures have exact zero maximum expected margin against every legal fixed same-status response',()=>{
 const a=verifySquadCertificate(false),b=verifySquadCertificate(true);
 assert.deepEqual(a,{active:false,choices:27783,baseChecks:944622,denominator:1107,maximum:0,minimum:-4356,zero:324,support:34});
 assert.deepEqual(b,{active:true,choices:83349,baseChecks:1444716,denominator:55566,maximum:0,minimum:-367434,zero:648,support:52});
});
