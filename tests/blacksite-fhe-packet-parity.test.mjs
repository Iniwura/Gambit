import test from 'node:test';
import assert from 'node:assert/strict';
import {allVaultCodes,scoreVaultGuess} from '../src/research/blacksite-cipher.mjs';

// Cleartext mirror of corrected Solidity circuit, not a test of FHE execution.
function circuitMirror(secret,guess) {
  const exact=secret.reduce((n,v,i)=>n+Number(v===guess[i]),0);
  let matched=0;
  for(let glyph=0;glyph<4;glyph++){
    const a=secret.reduce((n,v)=>n+Number(v===glyph),0);
    const b=guess.reduce((n,v)=>n+Number(v===glyph),0);
    matched+=a<b?a:b;
  }
  return {exact,misplaced:matched-exact};
}
// Independent positional elimination, then consume matching occurrences.
function oracle(secret,guess){
  let exact=0;const remaining=[],unmatched=[];
  for(let i=0;i<4;i++){
    if(secret[i]===guess[i])exact++;
    else {remaining.push(secret[i]);unmatched.push(guess[i]);}
  }
  let misplaced=0;
  for(const v of unmatched){
    const i=remaining.indexOf(v);
    if(i>=0){remaining.splice(i,1);misplaced++;}
  }
  return {exact,misplaced};
}
function decode(p){
  if(p>=0&&p<=4)return {approach:0,exact:p};
  if(p>=16&&p<=48){
    const exact=(p-16)>>3,misplaced=(p-16)&7;
    if(exact<=4&&misplaced<=4&&exact+misplaced<=4)return {approach:1,exact,misplaced};
  }
  if(p>=64&&p<=68)return {approach:2,exact:p-64};
  throw Error('invalid packet');
}
test('all 65,536 ordered Blacksite pairs: multiplicity parity and disjoint packets',()=>{
  const codes=allVaultCodes(),packets=new Map();let count=0,oldFailures=0;
  for(const secret of codes)for(const guess of codes){
    const expected=oracle(secret,guess);
    assert.deepEqual(circuitMirror(secret,guess),expected);
    assert.deepEqual(scoreVaultGuess(secret,guess),expected);
    const {exact,misplaced}=expected;
    if(secret.filter(v=>guess.includes(v)).length-exact!==misplaced)oldFailures++;
    const fixtures=[
      [exact,{approach:0,exact}],
      [16+8*exact+misplaced,{approach:1,exact,misplaced}],
      [64+exact,{approach:2,exact}]
    ];
    for(const [packet,value] of fixtures){
      assert.deepEqual(decode(packet),value);
      const canonical=JSON.stringify(value);
      assert.equal(packets.get(packet)??canonical,canonical);
      packets.set(packet,canonical);
    }
    count++;
  }
  assert.equal(count,65536);
  assert.equal(oldFailures,30072);
  assert.equal(packets.size,24);
  assert.deepEqual(decode(48),{approach:1,exact:4,misplaced:0});
  assert.deepEqual(decode(64),{approach:2,exact:0});
  for(const p of [5,15,21,39,47,49,52,63,69,255])assert.throws(()=>decode(p));
});
