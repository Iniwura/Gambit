import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePositionedSquadTurn} from '../src/squad.mjs';
import {scoreGambitCommitment} from '../src/research/gambit-commitment-v0.mjs';

// All 27 possible lane outcomes are realizable with constant tactics for
// every formation pair. This is outcome SUPPORT, not a probability model.
// An observer knows their own formation/effective stake and both scores,
// but not rival formation, tactics or effective stake. Additional private
// information could narrow support; this is not a privacy proof.
test('aggregate scores sometimes prove rival effective activation even without a public activation flag',()=>{
 const plan=base=>({base,trigger:0,response:base});
 const results=[];
 for(const own of [null,0,1,2]){
  const buckets=new Map();
  for(let af=0;af<3;af++)for(let bf=0;bf<3;bf++)for(let n=0;n<27;n++){
   const lane=[n%3,Math.floor(n/3)%3,Math.floor(n/9)%3];
   const defender=[];
   for(let l=0;l<3;l++)defender[(l+bf)%3]=plan([0,2,1][lane[l]]);
   const base=resolvePositionedSquadTurn([plan(0),plan(0),plan(0)],defender,af,bf);
   assert.deepEqual(base.lanes.map(l=>l.outcome),lane);
   for(const rival of [null,0,1,2]){
    const {pointsA:a,pointsB:b}=scoreGambitCommitment(base,own,rival);
    const k=af+':'+a+':'+b,bit=rival===null?1:2;
    buckets.set(k,(buckets.get(k)||0)|bit);
   }
  }
  const counts=[1,2,3].map(bit=>[...buckets.values()].filter(x=>x===bit).length);
  results.push(counts);
  assert.ok([...buckets].every(([k,bit])=>Number(k.split(':')[2])<6||bit===2));
  if(own===null){
   assert.equal(buckets.get('0:0:7'),2);
   assert.equal(buckets.get('0:3:1'),1);
   assert.equal(buckets.get('0:0:0'),3);
  }
 }
 assert.deepEqual(results,[[9,27,54],[13,33,52],[13,33,52],[13,33,52]]);
 console.log('ARENA_EFFECTIVE_ACTIVATION_SUPPORT '+JSON.stringify({columns:['inactiveOnly','activeOnly','bothPossible'],results,probabilityModel:false,privacyProof:false}));
});
