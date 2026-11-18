import assert from 'node:assert/strict';
import {ACTIONS,validatePlan,effectiveActions,resolveEncounter,makeMatch,commitTurn,verifyTranscript,enemyPlanFor,nextRandom} from '../src/engine.mjs';
let cases=0;const check=(name,fn)=>{fn();cases++;console.log('PASS',name)};
check('three allowed actions',()=>assert.deepEqual(ACTIONS,['STRIKE','GUARD','FLANK']));
check('reject invalid hidden inputs',()=>{for(const v of [-1,3,1.1,NaN])assert.throws(()=>validatePlan({base:v,trigger:0,response:1}))});
check('all possible tactics: symmetric private branching',()=>{
 for(let ab=0;ab<3;ab++)for(let at=0;at<3;at++)for(let ar=0;ar<3;ar++)for(let bb=0;bb<3;bb++)for(let bt=0;bt<3;bt++)for(let br=0;br<3;br++){
  const A={base:ab,trigger:at,response:ar},B={base:bb,trigger:bt,response:br};const e=effectiveActions(A,B);
  assert.equal(e.a,bb===at?ar:ab);assert.equal(e.b,ab===bt?br:bb);
 }});
check('cyclic combat balance',()=>{
 for(let a=0;a<3;a++)for(let b=0;b<3;b++){
  const x=resolveEncounter({base:a,trigger:(b+1)%3,response:0},{base:b,trigger:(a+1)%3,response:0});
  const expected=a===b?0:((a===0&&b===2)||(a===1&&b===0)||(a===2&&b===1))?1:2;
  assert.equal(x.outcome,expected)
 }});
check('anti-symmetry across all 729 tactic pairs',()=>{
 for(let ab=0;ab<3;ab++)for(let at=0;at<3;at++)for(let ar=0;ar<3;ar++)for(let bb=0;bb<3;bb++)for(let bt=0;bt<3;bt++)for(let br=0;br<3;br++){
  const A={base:ab,trigger:at,response:ar},B={base:bb,trigger:bt,response:br};const a=resolveEncounter(A,B).outcome,b=resolveEncounter(B,A).outcome;
  assert.equal(a===0?0:3-a,b)
 }});
check('seeded opponent deterministic',()=>{let a=makeMatch(123);assert.deepEqual(enemyPlanFor(a),enemyPlanFor(a));assert.equal(nextRandom(33),nextRandom(33))});
check('score & control bounded',()=>{for(let seed=1;seed<100;seed++){let m=makeMatch(seed);while(!m.finished){const x=commitTurn(m,{base:seed%3,trigger:(seed+1)%3,response:(seed+2)%3});m=x.match;assert.ok(Math.abs(m.control)<=3);assert.ok(m.round<=5);}assert.ok(m.winner!==null)}});
check('replay transcript integrity',()=>{let m=makeMatch(101),plans=[],events=[];while(!m.finished){const p={base:m.round%3,trigger:1,response:2};const x=commitTurn(m,p);plans.push(p);events.push(x.event);m=x.match;}assert.ok(verifyTranscript(101,plans,events));events[0]={...events[0],scoreA:100};assert.ok(!verifyTranscript(101,plans,events))});
check('no private enemy plan in public event',()=>{const e=commitTurn(makeMatch(17),{base:0,trigger:2,response:1}).event;assert.equal(e.opponentPrivatePlan,undefined);assert.equal(e.enemyBase,undefined)});
console.log(`All ${cases} tests passed; exhaustive 729 strategy pairs checked twice.`);
