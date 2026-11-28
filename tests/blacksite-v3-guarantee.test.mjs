import test from 'node:test';
import assert from 'node:assert/strict';
import {blacksiteV3Feedback} from '../src/research/blacksite-v3-rules.mjs';
// Worst-case success-only decision tree, using the most informative route.
// Every nonterminal BREACH or STEALTH reveals no more than PROBE. An early
// exact BREACH can be replaced by a PROBE identifying the code, then a final
// BREACH. Thus 3 probes + 1 breach is at least as powerful for guaranteed success.
// All first guesses reduce to multiplicity classes under position/symbol permutation.
test('no four-attempt strategy guarantees a breach for all 1024 candidate secrets',()=>{
 const N=1024,codes=Array.from({length:N},(_,n)=>Array.from({length:5},(_,i)=>(n>>(2*(4-i)))&3));
 const matrix=codes.map(g=>Uint8Array.from(codes,s=>blacksiteV3Feedback(s,g,'PROBE')-16));
 const universe=Array.from({length:N},(_,i)=>i);
 const symbols=new Set(matrix.flatMap(row=>Array.from(row))).size;
 assert.equal(symbols,20);
 const reps=new Map();
 for(let i=0;i<N;i++){const f=[0,0,0,0];for(const g of codes[i])f[g]++;
  const key=f.sort((a,b)=>b-a).join(',');if(!reps.has(key))reps.set(key,i);}
 const cache=new Map();
 function groups(candidates,g){const m=new Map();for(const c of candidates){const p=matrix[g][c];if(!m.has(p))m.set(p,[]);m.get(p).push(c);}return m;}
 function can(candidates,depth){
  if(candidates.length<=1)return true;
  if(depth===0||candidates.length>symbols**depth)return false;
  const key=depth+':'+candidates.join(',');
  if(cache.has(key))return cache.get(key);
  let found=false;
  for(let g=0;g<N;g++){
   const buckets=groups(candidates,g);
   if(depth===1){if(buckets.size===candidates.length){found=true;break;}continue;}
   if([...buckets.values()].some(b=>b.length>symbols**(depth-1)))continue;
   if([...buckets.values()].sort((a,b)=>b.length-a.length).every(b=>can(b,depth-1))){found=true;break;}
  }
  cache.set(key,found);return found;
 }
 assert.equal(reps.size,6);
 const impossible=[];
 for(const [key,g] of reps){
  const failure=[...groups(universe,g)].sort((a,b)=>b[1].length-a[1].length).find(([,b])=>!can(b,2));
  assert.ok(failure,'guaranteed first guess class '+key);
  impossible.push([key,failure[0],failure[1].length]);
 }
 assert.deepEqual(impossible,[['5,0,0,0',8,405],['4,1,0,0',9,184],['3,2,0,0',9,188],['3,1,1,0',10,164],['2,2,1,0',10,192],['2,1,1,1',10,174]]);
});
