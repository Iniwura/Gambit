import test from 'node:test';
import assert from 'node:assert/strict';
import {plans,parity,research} from '../scripts/arena-five-round-model.mjs';
test('fast five-round research model matches deployed-v3 cleartext scoring on 10,000 seeded pairs',()=>{
 assert.equal(plans.length,21);
 assert.equal(parity(),10000);
});
test('fixed seeded opponent model reproduces paired five-round sensitivity result',()=>{
 const r=research(0x6a6d6269,true);
 assert.equal(r.choices,111132);
 assert.equal(r.matches,10000);
 assert.equal(r.blind.wins+r.blind.draws+r.blind.losses,10000);
 assert.equal(r.informed.wins+r.informed.draws+r.informed.losses,10000);
 assert.equal(r.meanMarginGain,0.6591);
});
