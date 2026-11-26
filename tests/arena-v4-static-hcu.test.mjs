import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Source-locked operation DAG for the experimental V4 resolveRound circuit.
// Published DEVNET example costs: https://docs.zama.org/protocol/solidity-guides/development-guide/hcu
// Not live HCU telemetry or a side-channel/security proof.
const bytes=readFileSync(new URL('../fhe/contracts/ArenaV4ConfidentialActivationResearch.sol',import.meta.url));
const sha='a2d8f8a902d5df2bd16c0cb233b09124cd70fede';
const costs={eq:55000,lt:59000,and:25000,or:24000,not:2,select:55000,add:88000,sub:91000,shl:32000};
function inventory(){
 const counts=Object.fromEntries(Object.keys(costs).map(k=>[k,0]));
 const op=(name,...inputs)=>{counts[name]++;return costs[name]+Math.max(0,...inputs)};
 const eq=(...x)=>op('eq',...x),and=(...x)=>op('and',...x),or=(...x)=>op('or',...x),not=x=>op('not',x);
 const select=(...x)=>op('select',...x),add=(...x)=>op('add',...x),sub=(...x)=>op('sub',...x);
 const same=eq(0,0),shift=or(or(and(eq(0,0),eq(0,0)),and(eq(0,0),eq(0,0))),and(eq(0,0),eq(0,0)));
 const rotate=()=>select(same,0,select(shift,0,0));
 const A=[],BByA=[];
 for(let i=0;i<3;i++){
  const base=rotate(),trigger=rotate(),response=rotate();
  const a=select(eq(0,base),0,0),b=select(eq(trigger,0),response,base);
  const draw=eq(a,b);
  const win=or(or(and(eq(a,0),eq(b,0)),and(eq(a,0),eq(b,0))),and(eq(a,0),eq(b,0)));
  A.push(win);BByA.push(and(not(draw),not(win)));
 }
 const B=BByA.map((d,i)=>select(same,d,select(shift,BByA[(i+2)%3],BByA[(i+1)%3])));
 const use=()=>{const effective=and(op('lt',0,0),not(0));or(0,effective);return effective};
 function points(own,other,effective){
  let score=0;
  for(const w of own)score=add(score,select(w,0,0));
  let bonus=select(own[2],0,0);
  bonus=add(bonus,select(and(own[0],own[2]),0,0));
  bonus=sub(bonus,select(and(other[1],own[2]),0,0));
  score=add(score,bonus);
  const formation=[eq(0,0),eq(0,0),eq(0,0)],sector=[eq(0,0),eq(0,0),eq(0,0)];
  let hit=eq(0,0);
  for(let role=0;role<3;role++){
   const target=or(or(and(formation[0],sector[role]),and(formation[1],sector[(role+1)%3])),and(formation[2],sector[(role+2)%3]));
   hit=or(hit,and(target,own[role]));
  }
  const success=add(score,0),loss=select(eq(score,0),0,sub(score,0));
  return select(effective,select(hit,success,loss),score);
 }
 const a=points(A,B,use()),b=points(B,A,use()),depth=add(op('shl',a),b);
 const complexity=Object.entries(counts).reduce((s,[k,n])=>s+n*costs[k],0);
 return {counts,complexity,depth};
}
test('V4 encrypted activation resolve operation inventory and critical path',()=>{
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,sha,'V4 source drift: re-review FHE operations and ACL');
 const r=inventory();
 assert.deepEqual(r.counts,{eq:50,lt:2,and:45,or:28,not:8,select:46,add:13,sub:4,shl:1});
 assert.equal(r.complexity,8735016);
 assert.ok(r.depth<5000000);assert.ok(r.complexity<20000000);
 console.log('ARENA_V4_STATIC_HCU '+JSON.stringify({...r,limits:'published devnet examples',liveHcuMeasured:false,liveDepthMeasured:false}));
});
