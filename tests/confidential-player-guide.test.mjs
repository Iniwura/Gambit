import test from 'node:test';
import assert from 'node:assert/strict';
import {confidentialPlayerGuide,CONFIDENTIAL_BRIEF} from '../src/architecture/confidential-player-guide.mjs';
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),C='0x'+'3'.repeat(40);
const arena=()=>({challenger:A,defender:B,status:'WAITING_FOR_BOTH',currentRound:1,rounds:[{deadlineAt:186400,challengerSealed:false,defenderSealed:false}],cumulative:{challenger:0,defender:0}});
const mission=()=>({operative:A,status:'ACCEPTING_ATTEMPT',deadlineAt:186400,recoveryDeadlineAt:272800});
test('entry guides separate wallet authorization, creation and unread record recovery',()=>{
 for(const mode of ['arena','blacksite']){
  assert.equal(confidentialPlayerGuide(mode,null,null).next,null);
  assert.equal(confidentialPlayerGuide(mode,A,null,true).next,null);
  assert.equal(confidentialPlayerGuide(mode,A,null,false).next.id,mode==='arena'?'CREATE_MATCH':'OPEN_MISSION');
 }
});
test('arena guide follows participant and public seal state; no action for waiting or spectator',()=>{
 const v=arena();
 assert.equal(confidentialPlayerGuide('arena',A,v).next.id,'SEAL_ROUND');
 assert.equal(confidentialPlayerGuide('arena',A,v).deadline.at,186400);
 v.status='WAITING_FOR_OPPONENT';v.rounds[0].challengerSealed=true;
 assert.equal(confidentialPlayerGuide('arena',A,v).next,null);
 assert.equal(confidentialPlayerGuide('arena',B,v).next.id,'SEAL_ROUND');
 assert.equal(confidentialPlayerGuide('arena',C,v).heading,'Spectating');
 v.status='READY_TO_RESOLVE';assert.equal(confidentialPlayerGuide('arena',A,v).next.id,'RESOLVE_ROUND');
 v.status='AWAITING_PROOF';assert.equal(confidentialPlayerGuide('arena',B,v).next.id,'FINALIZE_ROUND');
 assert.equal(confidentialPlayerGuide('arena',B,v).deadline.at,272800);
 v.status='RECOVERY_EXPIRED_NOT_CLOSED';assert.equal(confidentialPlayerGuide('arena',B,v).next.id,'ABORT_UNSETTLED');
});
test('arena terminal outcomes never invent wins or expose private state',()=>{
 const v=arena();v.status='COMPLETE';v.cumulative={challenger:5,defender:7};v.privatePlan='secret';
 assert.equal(confidentialPlayerGuide('arena',A,v).heading,'Defeat');
 assert.equal(confidentialPlayerGuide('arena',B,v).heading,'Victory');
 assert.equal(confidentialPlayerGuide('arena',C,v).heading,'Defender won');
 assert.equal(confidentialPlayerGuide('arena',A,v).next,null);
 assert.equal(Object.hasOwn(confidentialPlayerGuide('arena',A,v),'privatePlan'),false);
 v.cumulative={challenger:7,defender:7};assert.equal(confidentialPlayerGuide('arena',B,v).heading,'Draw');
 v.status='TECHNICAL_ABORT_UNSCORED';assert.equal(confidentialPlayerGuide('arena',A,v).heading,'Match closed');
});
test('BLACKSITE guide covers attempt, settlement, expiry and terminal paths with explicit clues',()=>{
 const v=mission();
 for(const [status,id] of Object.entries({ACCEPTING_ATTEMPT:'SUBMIT_ATTEMPT',SEALED:'RESOLVE_ATTEMPT',AWAITING_PROOF:'FINALIZE_ATTEMPT',EXPIRED_NOT_CLOSED:'EXPIRE_MISSION',RECOVERY_EXPIRED_NOT_CLOSED:'ABORT_UNSETTLED'})){
  v.status=status;assert.equal(confidentialPlayerGuide('blacksite',A,v).next.id,id);
  assert.equal(confidentialPlayerGuide('blacksite',B,v).next,null);
 }
 v.status='BREACHED';assert.equal(confidentialPlayerGuide('blacksite',A,v).heading,'Vault breached');assert.equal(confidentialPlayerGuide('blacksite',A,v).next,null);
 v.status='LOCKED';assert.equal(confidentialPlayerGuide('blacksite',A,v).heading,'Vault locked');
 assert.match(CONFIDENTIAL_BRIEF.blacksite.goal,/five-glyph.*four attempts/);
 assert.ok(CONFIDENTIAL_BRIEF.blacksite.rules.some(x=>x.includes('Only five exact')));
});
