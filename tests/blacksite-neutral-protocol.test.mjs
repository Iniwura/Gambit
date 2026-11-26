import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeutralBlacksiteResearchAuthority as make,BLACKSITE_NEUTRAL_RESEARCH_TTL as TTL,BLACKSITE_NEUTRAL_RECOVERY_GRACE as GRACE} from '../src/research/blacksite-neutral-protocol.mjs';
const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),h=n=>'0x'+n.toString(16).padStart(64,'0');
function fixture(){
 let generated=0,resolved=0;const packets=new Map();
 const authority=make({
  generateSecret:ctx=>{assert.equal(ctx.slots,5);assert.equal(ctx.glyphs,4);assert.equal(Object.hasOwn(ctx,'secret'),false);return h(100+ ++generated)},
  resolvePacket:ctx=>{const result=h(1000+ ++resolved);packets.set(result,{id:ctx.id,attempt:ctx.attempt,packet:ctx.guessHandle===h(7)?69:16});return result},
  verifyPacket:ctx=>{const p=packets.get(ctx.resultHandle);return !!p&&p.id===ctx.id&&p.attempt===ctx.attempt&&p.packet===ctx.packet&&ctx.proof==='fixture-proof'}
 });
 return {authority,generated:()=>generated};
}
test('neutral allocation is one live mission per operative, public projection excludes private handles, and no reroll',()=>{
 const f=fixture(),a=f.authority,m=a.create(A,10),b=a.create(B,10);
 assert.notEqual(m.id,b.id);assert.equal(f.generated(),2);assert.equal(a.activeFor(A),m.id);
 assert.throws(()=>a.create(A.toUpperCase().replace('0X','0x'),11),/existing active/);
 assert.equal(f.generated(),2);
 assert.equal(Object.hasOwn(m,'secret'),false);assert.equal(JSON.stringify(m).includes(h(101)),false);
 assert.throws(()=>a.submit(m.id,B,1,h(7),11),/not operative/);
});
test('pending seal survives deadline, expiry cannot erase it, exact proof and attempt binding precede settlement',()=>{
 const {authority:a}=fixture(),m=a.create(A,100),deadline=100+TTL;
 a.submit(m.id,A,1,h(7),deadline);
 assert.throws(()=>a.submit(m.id,A,1,h(8),deadline),/attempt unavailable/);
 assert.throws(()=>a.expire(m.id,deadline+1),/not expirable/);
 const r=a.resolve(m.id,1,deadline+1);
 assert.equal(r.pending.phase,'AWAITING_PROOF');
 assert.equal(JSON.stringify(r).includes(h(7)),false);assert.equal(JSON.stringify(r).includes(h(101)),false);
 assert.throws(()=>a.resolve(m.id,1,deadline+2),/not resolvable/);
 assert.throws(()=>a.finalize(m.id,1,h(99),69,'fixture-proof',deadline+2),/proof context/);
 assert.throws(()=>a.finalize(m.id,2,r.pending.resultHandle,69,'fixture-proof',deadline+2),/proof context/);
 assert.throws(()=>a.finalize(m.id,1,r.pending.resultHandle,68,'fixture-proof',deadline+2),/proof rejected/);
 assert.throws(()=>a.finalize(m.id,1,r.pending.resultHandle,69,'forged',deadline+2),/proof rejected/);
 assert.equal(a.read(m.id).attemptsUsed,0);
 const win=a.finalize(m.id,1,r.pending.resultHandle,69,'fixture-proof',deadline+2);
 assert.equal(win.status,'BREACHED');assert.equal(win.score,80);assert.equal(a.activeFor(A),null);
 assert.throws(()=>a.finalize(m.id,1,r.pending.resultHandle,69,'fixture-proof',deadline+3),/mission closed/);
 assert.notEqual(a.create(A,deadline+3).id,m.id);
});
test('failed late attempt cannot reroll or gain another attempt; expiry stays unscored',()=>{
 const {authority:a}=fixture(),m=a.create(A,1),deadline=1+TTL;
 a.submit(m.id,A,1,h(8),deadline);
 const r=a.resolve(m.id,1,deadline+1);
 const row=a.finalize(m.id,1,r.pending.resultHandle,16,'fixture-proof',deadline+2);
 assert.equal(row.status,'ACTIVE');assert.equal(row.attemptsUsed,1);assert.equal(row.heat,1);
 assert.throws(()=>a.submit(m.id,A,2,h(7),deadline+2),/submission expired/);
 assert.throws(()=>a.create(A,deadline+2),/existing active/);
 const expired=a.expire(m.id,deadline+3);assert.equal(expired.status,'EXPIRED');assert.equal(expired.score,0);
 assert.equal(a.activeFor(A),null);
});
test('four authentic failed attempts lock; old result cannot finalize a new attempt or mission',()=>{
 const {authority:a}=fixture(),m=a.create(A,1);let previous;
 for(let i=1;i<=4;i++){
  a.submit(m.id,A,i,h(8),i*3);
  const r=a.resolve(m.id,i,i*3+1);
  if(previous)assert.throws(()=>a.finalize(m.id,i,previous,16,'fixture-proof',i*3+2),/proof context/);
  previous=r.pending.resultHandle;
  a.finalize(m.id,i,previous,16,'fixture-proof',i*3+2);
 }
 assert.equal(a.read(m.id).status,'LOCKED');assert.equal(a.read(m.id).score,0);
 const next=a.create(A,20);a.submit(next.id,A,1,h(8),21);a.resolve(next.id,1,22);
 assert.throws(()=>a.finalize(next.id,1,previous,16,'fixture-proof',23),/proof context/);
});

test('unresolved seal has a bounded recovery window and technical abort never awards a result',()=>{
 const {authority:a}=fixture(),m=a.create(A,100),deadline=m.deadlineAt,cutoff=m.recoveryDeadlineAt;
 assert.equal(cutoff,deadline+GRACE);
 a.submit(m.id,A,1,h(7),deadline);
 assert.throws(()=>a.abortUnsettled(m.id,cutoff),/not abortable/);
 assert.throws(()=>a.expire(m.id,cutoff+1),/not expirable/);
 assert.throws(()=>a.resolve(m.id,1,cutoff+1),/recovery expired/);
 assert.equal(a.activeFor(A),m.id);
 const aborted=a.abortUnsettled(m.id,cutoff+1);
 assert.equal(aborted.status,'TECHNICAL_ABORT');assert.equal(aborted.score,0);
 assert.equal(aborted.attemptsUsed,0);assert.equal(aborted.pending,null);
 assert.equal(a.activeFor(A),null);
 assert.throws(()=>a.resolve(m.id,1,cutoff+2),/mission closed/);
 assert.notEqual(a.create(A,cutoff+2).id,m.id);
});
test('last valid recovery instant permits authenticated settlement and cannot race with abort',()=>{
 const {authority:a}=fixture(),m=a.create(A,100),cutoff=m.recoveryDeadlineAt;
 a.submit(m.id,A,1,h(7),m.deadlineAt);
 const r=a.resolve(m.id,1,cutoff);
 assert.throws(()=>a.abortUnsettled(m.id,cutoff),/not abortable/);
 const win=a.finalize(m.id,1,r.pending.resultHandle,69,'fixture-proof',cutoff);
 assert.equal(win.status,'BREACHED');assert.equal(win.score,80);
 assert.throws(()=>a.abortUnsettled(m.id,cutoff+1),/mission closed/);
});
test('late proof cannot alter a technical abort; settled history stays intact and handle is reserved',()=>{
 const {authority:a}=fixture(),m=a.create(A,1),cutoff=m.recoveryDeadlineAt;
 a.submit(m.id,A,1,h(8),2);
 const first=a.resolve(m.id,1,3);
 a.finalize(m.id,1,first.pending.resultHandle,16,'fixture-proof',4);
 a.submit(m.id,A,2,h(7),m.deadlineAt);
 const r=a.resolve(m.id,2,cutoff);
 assert.throws(()=>a.finalize(m.id,2,r.pending.resultHandle,69,'fixture-proof',cutoff+1),/recovery expired/);
 const aborted=a.abortUnsettled(m.id,cutoff+1);
 assert.equal(aborted.score,0);assert.equal(aborted.attemptsUsed,1);
 assert.equal(aborted.history.length,1);assert.equal(aborted.heat,1);
 assert.throws(()=>a.finalize(m.id,2,r.pending.resultHandle,69,'fixture-proof',cutoff+2),/mission closed/);
 const next=a.create(A,cutoff+2);
 assert.throws(()=>a.submit(next.id,A,1,r.pending.resultHandle,cutoff+3),/invalid guess domain/);
});
test('technical abort cannot substitute for normal expiry and deadline arithmetic is bounded',()=>{
 const {authority:a}=fixture(),m=a.create(A,1);
 assert.throws(()=>a.abortUnsettled(m.id,m.recoveryDeadlineAt+1),/not abortable/);
 assert.equal(a.expire(m.id,m.deadlineAt+1).status,'EXPIRED');
 assert.throws(()=>a.create(B,Number.MAX_SAFE_INTEGER-TTL-GRACE+1),/deadline/);
});
