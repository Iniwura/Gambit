import {newBlacksiteV3Research,settleBlacksiteV3Research,publicBlacksiteV3Research,decodeBlacksiteV3Feedback} from './blacksite-v3-rules.mjs';

/**
 * Neutral Blacksite protocol ARCHITECTURE MODEL, not FHE or a deployed service.
 * The injected authority stands for future contract-only encrypted randomness,
 * deterministic resolution and authenticated proof verification. The caller
 * cannot choose a secret, replace a live mission, or set a public result.
 * This closure is NOT a security boundary in an untrusted browser.
 */
const fail=(ok,msg)=>{if(!ok)throw Error('BLACKSITE_NEUTRAL_INVALID '+msg)};
const address=x=>{fail(typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x)&&!/^0x0{40}$/i.test(x),'operative');return x.toLowerCase()};
const handle=x=>{fail(typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x)&&!/^0x0{64}$/i.test(x),'handle');return x.toLowerCase()};
const time=x=>{fail(Number.isSafeInteger(x)&&x>=0,'time');return x};
export const BLACKSITE_NEUTRAL_RESEARCH_TTL=86400;
// Bounded permissionless recovery window after the submission deadline.
export const BLACKSITE_NEUTRAL_RECOVERY_GRACE=86400;
export function createNeutralBlacksiteResearchAuthority(adapter){
 fail(adapter&&['generateSecret','resolvePacket','verifyPacket'].every(k=>typeof adapter[k]==='function'),'injected simulator authority');
 const {generateSecret,resolvePacket,verifyPacket}=adapter;
 const missions=new Map(),active=new Map(),resultHandles=new Set(),secretHandles=new Set();
 let nextId=1;
 function load(id,now){
  const mission=missions.get(id);fail(mission,'unknown mission');
  if(now!==undefined)fail(time(now)>=mission.lastAt,'stale time');
  return mission;
 }
 function live(id,now){const m=load(id,now);fail(m.status==='ACTIVE','mission closed');return m;}
 function snapshot(m){
  const r=publicBlacksiteV3Research(m.rules);
  return Object.freeze({mode:'NEUTRAL_BLACKSITE_RESEARCH_ONLY',version:3,id:m.id,operative:m.operative,
   createdAt:m.createdAt,deadlineAt:m.deadlineAt,recoveryDeadlineAt:m.recoveryDeadlineAt,status:m.status,attemptsUsed:r.attemptsUsed,
   heat:r.heat,score:r.score,history:r.history,
   pending:m.pending?Object.freeze({attempt:m.pending.attempt,phase:m.pending.result?'AWAITING_PROOF':'SEALED',
     resultHandle:m.pending.result??null}):null});
 }
 function create(operative,now){
  const player=address(operative);time(now);
  fail(!active.has(player),'existing active mission');
  const id='neutral-'+nextId;fail(Number.isSafeInteger(now+BLACKSITE_NEUTRAL_RESEARCH_TTL+BLACKSITE_NEUTRAL_RECOVERY_GRACE),'deadline');
  const secret=handle(generateSecret(Object.freeze({id,operative:player,slots:5,glyphs:4})));
  fail(!secretHandles.has(secret)&&!resultHandles.has(secret),'secret handle already allocated');
  const m={id,operative:player,secret,rules:newBlacksiteV3Research(id),createdAt:now,
   deadlineAt:now+BLACKSITE_NEUTRAL_RESEARCH_TTL,recoveryDeadlineAt:now+BLACKSITE_NEUTRAL_RESEARCH_TTL+BLACKSITE_NEUTRAL_RECOVERY_GRACE,lastAt:now,status:'ACTIVE',pending:null};
  secretHandles.add(secret);nextId++;missions.set(id,m);active.set(player,id);return snapshot(m);
 }
 function submit(id,operative,attempt,guessHandle,now){
  const m=live(id,now);fail(address(operative)===m.operative,'not operative');
  fail(now<=m.deadlineAt,'submission expired');
  fail(!m.pending&&attempt===m.rules.history.length+1&&attempt<=4,'attempt unavailable');
  const guess=handle(guessHandle);fail(!secretHandles.has(guess)&&!resultHandles.has(guess),'invalid guess domain');
  m.pending={attempt,guess,result:null};m.lastAt=now;return snapshot(m);
 }
 function resolve(id,attempt,now){
  const m=live(id,now);fail(now<=m.recoveryDeadlineAt,'recovery expired');
  fail(m.pending&&m.pending.attempt===attempt&&!m.pending.result,'not resolvable');
  const result=handle(resolvePacket(Object.freeze({id,operative:m.operative,attempt,secretHandle:m.secret,guessHandle:m.pending.guess})));
  fail(!resultHandles.has(result)&&!secretHandles.has(result)&&result!==m.pending.guess,'reused result handle');
  resultHandles.add(result);m.pending.result=result;m.lastAt=now;return snapshot(m);
 }
 function finalize(id,attempt,resultHandle,packet,proof,now){
  const m=live(id,now);fail(now<=m.recoveryDeadlineAt,'recovery expired');
  const result=handle(resultHandle);
  fail(m.pending&&m.pending.attempt===attempt&&m.pending.result===result,'proof context');
  decodeBlacksiteV3Feedback(packet);
  fail(verifyPacket(Object.freeze({id,operative:m.operative,attempt,resultHandle:result,packet,proof}))===true,'proof rejected');
  const rules=settleBlacksiteV3Research(m.rules,attempt,packet);
  m.rules=rules;m.status=rules.status;m.pending=null;m.lastAt=now;
  if(m.status!=='ACTIVE')active.delete(m.operative);
  return snapshot(m);
 }
 function expire(id,now){
  const m=live(id,now);fail(now>m.deadlineAt&&!m.pending,'not expirable');
  m.status='EXPIRED';m.lastAt=now;active.delete(m.operative);return snapshot(m);
 }
 // A pending attempt is never erased by ordinary expiry. After the hard
 // recovery deadline, a permissionless technical abort releases the operative
 // without a score, win or loss. Reserved handles remain permanently consumed.
 function abortUnsettled(id,now){
  const m=live(id,now);fail(now>m.recoveryDeadlineAt&&m.pending,'not abortable');
  m.status='TECHNICAL_ABORT';m.pending=null;m.lastAt=now;active.delete(m.operative);return snapshot(m);
 }
 return Object.freeze({create,submit,resolve,finalize,expire,abortUnsettled,read:id=>snapshot(load(id)),
   activeFor:operative=>active.get(address(operative))??null});
}
