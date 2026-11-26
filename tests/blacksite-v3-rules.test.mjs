import test from 'node:test';
import assert from 'node:assert/strict';
import {blacksiteV3Feedback as feedback,decodeBlacksiteV3Feedback as decode,newBlacksiteV3Research as make,settleBlacksiteV3Research as settle,publicBlacksiteV3Research as view} from '../src/research/blacksite-v3-rules.mjs';

test('all 1,048,576 five-slot code/guess pairs agree with independent multiset cancellation',()=>{
 const codes=Array.from({length:1024},(_,n)=>Array.from({length:5},(_,i)=>(n>>(2*(4-i)))&3));
 const packets=new Set();
 for(const a of codes)for(const b of codes){
  let exact=0,misplaced=0;const left=[],right=[];
  for(let i=0;i<5;i++)if(a[i]===b[i])exact++;else{left.push(a[i]);right.push(b[i]);}
  for(const x of left){const j=right.indexOf(x);if(j>=0){misplaced++;right.splice(j,1);}}
  const packet=feedback(a,b,'PROBE'),d=decode(packet);packets.add(packet);
  if(d.exact!==exact||d.misplaced!==misplaced||feedback(a,b,'STEALTH')!==exact||feedback(a,b,'BREACH')!==64+exact)throw Error('route feedback mismatch');
 }
 assert.equal(packets.size,20);
 for(let p=16;p<=56;p++){
  if(packets.has(p))assert.doesNotThrow(()=>decode(p));else assert.throws(()=>decode(p));
 }
});
test('correct probe is not a breach; attempt limits, heat, score and recovery reject inconsistent states',()=>{
 let s=make('fixture');s=settle(s,1,56);assert.equal(s.status,'ACTIVE');assert.equal(s.heat,1);
 s=settle(s,2,69);assert.equal(s.status,'BREACHED');assert.equal(s.score,65);
 assert.throws(()=>settle(s,3,69));assert.throws(()=>settle(make('other'),2,0));
 let l=make('lock');for(let i=1;i<=4;i++)l=settle(l,i,0);
 assert.equal(l.status,'LOCKED');assert.equal(l.score,0);assert.throws(()=>settle(l,5,69));
 assert.throws(()=>view({...l,score:100}));assert.throws(()=>view({...s,history:s.history.slice(1)}));
 const projected=view(s);assert.equal(projected.attemptsUsed,2);assert.equal(projected.history[0].route,'PROBE');
 assert.equal('secret' in projected,false);assert.equal('guess' in projected.history[0],false);
 assert.throws(()=>feedback([0],[0],'PROBE'));assert.throws(()=>decode(49));
});
