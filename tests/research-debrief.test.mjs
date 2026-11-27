import test from 'node:test';
import assert from 'node:assert/strict';
import {RESEARCH_DEBRIEF_PINS,corroborateResearchDebrief,loadResearchDebrief} from '../src/architecture/research-debrief.mjs';
const blockHash='0x'+'a'.repeat(64);
const common=mode=>({chainId:11155111,contract:RESEARCH_DEBRIEF_PINS[mode].address,runtimeHash:RESEARCH_DEBRIEF_PINS[mode].runtimeHash,blockTag:12222550,blockHash});
const arena=()=>({...common('arena'),matchId:1,complete:true,abandoned:false,currentRound:5,winner:1,cumulative:{challenger:27,defender:0},rounds:[5,7,5,5,5].map((challenger,i)=>({round:i+1,resolved:true,finalized:true,score:{challenger,defender:0}})),privateSpentState:'do-not-project'});
const mission=()=>({...common('blacksite'),missionId:1,status:'BREACHED',score:35,heat:5,attemptsUsed:4,history:[{attempt:1,route:'PROBE',exact:3,misplaced:0},{attempt:2,route:'PROBE',exact:0,misplaced:1},{attempt:3,route:'PROBE',exact:3,misplaced:1},{attempt:4,route:'BREACH',exact:5,misplaced:null}],privateGuess:'do-not-project'});
test('terminal public arena debrief is explicit, immutable and excludes private metadata',()=>{
 const a=arena(),b=arena();b.blockTag++;
 const result=corroborateResearchDebrief('arena',[a,b]);
 assert.equal(result.challenger,27);assert.equal(result.defender,0);assert.equal(result.rows.length,5);
 assert.equal(result.eligibleForVerifiedProgression,false);assert.equal(result.authority,'CORROBORATED_PUBLIC_STATE');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.rows)&&Object.isFrozen(result.rows[0]));
 assert.equal(Object.hasOwn(result,'privateSpentState'),false);
});
test('terminal mission debrief preserves route-specific clues without guess data',()=>{
 const result=corroborateResearchDebrief('blacksite',[mission(),mission()]);
 assert.equal(result.score,35);assert.equal(result.heat,5);assert.equal(result.rows[3].misplaced,null);
 assert.equal(Object.hasOwn(result,'privateGuess'),false);assert.equal(result.eligibleForVerifiedProgression,false);
});
test('rejects incomplete, wrong deployment, disagreement and missing second snapshot',()=>{
 const a=arena(),b=arena();b.complete=false;
 assert.throws(()=>corroborateResearchDebrief('arena',[a,b]),/not terminal/);
 b.complete=true;b.runtimeHash='0x'+'b'.repeat(64);
 assert.throws(()=>corroborateResearchDebrief('arena',[a,b]),/deployment mismatch/);
 const m=mission(),n=mission();n.score=36;
 assert.throws(()=>corroborateResearchDebrief('blacksite',[m,n]),/provider disagreement/);
 assert.throws(()=>corroborateResearchDebrief('arena',[a]),/two snapshots/);
 assert.throws(()=>corroborateResearchDebrief('constructor',[a,a]),/unknown mode/);
});
test('rejects invalid provider count and never falls back to a single provider',async()=>{
 const p={};
 await assert.rejects(loadResearchDebrief('arena',[p,p]),/independent provider/);
 await assert.rejects(loadResearchDebrief('blacksite',[p]),/independent provider/);
 await assert.rejects(loadResearchDebrief('arena',[p,{}]),/read-only provider/);
});
