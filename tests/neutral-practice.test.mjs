import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeutralPractice} from '../src/blacksite/neutral-practice.mjs';
test('practice mirrors neutral route-specific feedback, heat, scoring and terminal state',()=>{
 const p=createNeutralPractice('local-test',[0,1,2,3,0]);
 const first=p.submit([0,1,2,3,0],'STEALTH');
 assert.equal(first.status,'ACTIVE');assert.equal(first.heat,0);assert.equal(first.history[0].exact,5);assert.equal(first.history[0].misplaced,null);
 const second=p.submit([0,1,2,0,3],'PROBE');
 assert.equal(second.history[1].exact,3);assert.equal(second.history[1].misplaced,2);assert.equal(second.heat,1);
 const win=p.submit([0,1,2,3,0],'BREACH');
 assert.equal(win.status,'BREACHED');assert.equal(win.score,60);assert.equal(win.heat,3);assert.equal(win.remaining,1);
 assert.equal(win.eligibleForVerifiedProgression,false);
 assert.throws(()=>p.submit([0,1,2,3,0],'BREACH'),/attempt unavailable/);
});
test('four failed attempts lock the vault, repeated guesses and route changes consume turns',()=>{
 const p=createNeutralPractice('local-test',[1,1,1,1,1]);
 for(const route of ['PROBE','PROBE','STEALTH','BREACH'])p.submit([0,0,0,0,0],route);
 const v=p.view();assert.equal(v.status,'LOCKED');assert.equal(v.remaining,0);assert.equal(v.score,0);assert.equal(v.heat,4);
 assert.throws(()=>p.submit([1,1,1,1,1],'BREACH'),/attempt unavailable/);
});
test('invalid inputs do not consume attempts and secret cannot be read from public snapshots',()=>{
 const secret=[1,2,3,0,1],p=createNeutralPractice('local-test',secret);
 secret.fill(0);assert.throws(()=>p.submit(Array(5),'PROBE'),/five valid/);
 assert.throws(()=>p.submit([0,1,2,3,4],'PROBE'),/five valid/);
 assert.throws(()=>p.submit([0,1,2,3,0],'UNKNOWN'),/approach/);
 assert.equal(p.view().attemptsUsed,0);
 const guess=[1,2,3,0,1],v=p.submit(guess,'BREACH');guess.fill(0);
 assert.equal(v.status,'BREACHED');assert.equal(v.score,80);
 assert.deepEqual(v.history[0].guess,[1,2,3,0,1]);
 for(const name of ['secret','packet','proof','privateKey'])assert.equal(Object.hasOwn(v,name),false);
 assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.history)&&Object.isFrozen(v.history[0].guess));
});
