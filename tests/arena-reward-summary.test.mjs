import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCanonicalArenaRecords as summarize} from '../src/profile/arena-reward-summary.mjs';
const a='0x'+'a'.repeat(40),b='0x'+'b'.repeat(40);
function record(id,winner,complete=true,abandoned=false){
 const ap=winner===1?1:0,bp=winner===2?1:0;
 return {chainId:11155111,contractAddress:'0x'+'c'.repeat(40),runtimeHash:'0x'+'d'.repeat(64),
  matchId:String(id),creationTransaction:'0x'+id.toString(16).padStart(64,'0'),creationBlock:100+id,
  challenger:a,defender:b,currentRound:complete?5:1,status:complete?'COMPLETE':abandoned?'ABANDONED_UNSCORED':'COLLECTING',
  complete,abandoned,winner,cumulative:{challenger:complete?5*ap:0,defender:complete?5*bp:0},
  rounds:complete?Array.from({length:5},(_,i)=>({round:i+1,challengerPoints:ap,defenderPoints:bp,cumulativeChallenger:(i+1)*ap,cumulativeDefender:(i+1)*bp})):[]};
}
// The helper is deliberately arithmetic-only. Fixtures here are NOT authenticated history.
test('completed match reward accounting is idempotent and excludes pending/expired records',()=>{
 const w=record(1,1),l=record(2,2),d=record(3,0),p=record(4,null,false),e=record(5,null,false,true);
 const x=summarize([w,{...w},l,d,p,e],a);
 assert.deepEqual([x.matches,x.observedMatches,x.activeMatches,x.abandonedMatches,x.wins,x.losses,x.draws,x.xp,x.level],[3,5,1,1,1,1,1,250,3]);
 assert.equal(x.achievements.length,3);
 assert.equal(x.distinctOpponents,1);
 assert.equal(summarize([w,{...l,defender:'0x'+'e'.repeat(40)}],a).distinctOpponents,2);
 assert.equal(summarize([p,e],a).distinctOpponents,0);
 assert.equal(x.verifiedHistory.length,5);
 assert.equal(summarize([p,e],a).achievements.length,0);
 assert.equal(summarize([p,e],a).xp,0);
 assert.equal(summarize([w],b).losses,1);
 assert.equal(summarize([l,d,p],a).xp,100); // recompute after upstream revalidation drops a record
});
test('conflicting duplicate identity, unrelated wallet and invalid terminal states fail closed',()=>{
 const w=record(1,1);
 assert.throws(()=>summarize([w,{...w,winner:2}],a),/conflicting duplicate/);
 assert.throws(()=>summarize([w],'0x'+'e'.repeat(40)),/participants/);
 assert.throws(()=>summarize([{...w,complete:false}],a),/winner state/);
 assert.throws(()=>summarize([{...w,abandoned:true}],a),/terminal state/);
});
