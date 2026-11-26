import test from 'node:test';
import assert from 'node:assert/strict';
import {runReadOnlyProviderPolicy as run,canRetryHistoricalRead as retry} from '../scripts/readonly-provider-policy.mjs';
test('only explicit pruned historical RPC error permits full fresh read on next provider',()=>{
 const called=[];
 const result=run((endpoint,i)=>{called.push(endpoint);return i===0?{status:1,output:'error: pruned history unavailable'}:{status:0,output:'verified'}});
 assert.deepEqual(result,{ok:true,attempts:2});assert.equal(called.length,2);
});
test('evidence errors, unknown failures and explicit provider override fail closed',()=>{
 for(const output of ['Wrong chain','Missing canonical event','Do not claim full history','timeout','PROFILE_EVIDENCE_INVALID pruned history unavailable']){
  assert.deepEqual(run(()=>({status:1,output})),{ok:false,attempts:1});
 }
 assert.deepEqual(run(()=>({status:1,output:'pruned history unavailable'}),'explicit'),{ok:false,attempts:1});
 assert.deepEqual(run(()=>({status:1,output:'pruned history unavailable'})),{ok:false,attempts:3});
 assert.equal(retry('pruned history unavailable'),true);
});
