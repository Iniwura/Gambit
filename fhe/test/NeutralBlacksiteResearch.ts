import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

describe('NeutralBlacksiteResearch — five encrypted random glyphs (MOCK ONLY)',function(){
 this.timeout(300000);
 async function fixture(){
  const [operative,other,relay]=await ethers.getSigners();
  const c:any=await (await ethers.getContractFactory('NeutralBlacksiteResearch')).deploy();
  await c.waitForDeployment();
  await expect(c.connect(operative).openMission()).to.emit(c,'MissionOpened').withArgs(1n,operative.address);
  return {c,operative,other,relay};
 }
 async function payload(c:any,operative:any,glyph:number,route:number){
  const p=fhevm.createEncryptedInput(await c.getAddress(),operative.address);
  for(let i=0;i<5;i++)p.add8(glyph);
  p.add8(route);
  return p.encrypt();
 }
 async function submit(c:any,operative:any,id:bigint,attempt:number,glyph:number,route:number){
  const p=await payload(c,operative,glyph,route);
  await c.connect(operative).submitAttempt(id,attempt,p.handles.slice(0,5),p.handles[5],p.inputProof);
 }
 async function resolve(c:any,relay:any,id:bigint,attempt:number){
  await c.connect(relay).resolveAttempt(id,attempt);
  const h=await c.feedbackHandle(id,attempt);
  const d=await fhevm.publicDecrypt([h]);
  return {h,value:Number(d.clearValues[h]),proof:d.decryptionProof};
 }
 async function at(t:bigint){await network.provider.send('evm_setNextBlockTimestamp',[Number(t)]);}
 it('neutral allocation and four constant probes partition exactly five random glyphs',async function(){
  if(!fhevm.isMock)this.skip();
  const {c,operative,other,relay}=await fixture();
  expect(await c.activeMission(operative.address)).to.equal(1n);
  await expect(c.connect(operative).openMission()).to.be.revertedWith('Existing active mission');
  await c.connect(other).openMission();
  expect(await c.activeMission(other.address)).to.equal(2n);
  let total=0;
  for(let a=1;a<=4;a++){
   await submit(c,operative,1n,a,a-1,1);
   const r=await resolve(c,relay,1n,a);
   const exact=(r.value-16)>>3,misplaced=(r.value-16)&7;
   expect(exact).to.be.within(0,5);expect(misplaced).to.equal(0);total+=exact;
   await c.connect(relay).finalizeAttempt(1n,a,r.value,r.proof);
  }
  expect(total).to.equal(5);
  const s=await c.missionStatus(1n);
  expect(s.attemptsUsed).to.equal(4);expect(s.heat).to.equal(4);expect(s.score).to.equal(0);expect(s.outcome).to.equal(2);
  expect(await c.activeMission(operative.address)).to.equal(0n);
  expect(await c.activeMission(other.address)).to.equal(2n);
  await expect(c.connect(operative).openMission()).to.emit(c,'MissionOpened').withArgs(3n,operative.address);
  const names=c.interface.fragments.map((f:any)=>f.name).filter(Boolean);
  for(const name of ['vaultCode','guess','getVaultCode','getGuess','setSecret'])expect(names).not.to.include(name);
 });
 it('same encrypted glyph yields consistent route feedback and authentic score',async function(){
  if(!fhevm.isMock)this.skip();
  const {c,operative,relay}=await fixture();
  await submit(c,operative,1n,1,0,0);
  const one=await resolve(c,relay,1n,1);
  expect(one.value).to.be.within(0,5);
  await c.finalizeAttempt(1n,1,one.value,one.proof);
  await submit(c,operative,1n,2,0,1);
  const two=await resolve(c,relay,1n,2);
  expect(two.value).to.equal(16+8*one.value);
  await c.finalizeAttempt(1n,2,two.value,two.proof);
  await submit(c,operative,1n,3,0,2);
  const three=await resolve(c,relay,1n,3);
  expect(three.value).to.equal(64+one.value);
  await c.finalizeAttempt(1n,3,three.value,three.proof);
  const s=await c.missionStatus(1n);
  expect(s.heat).to.equal(3);expect(s.attemptsUsed).to.equal(3);
  expect(s.outcome).to.equal(one.value===5?1:0);
  expect(s.score).to.equal(one.value===5?60:0);
 });
 it('rejects unauthorized, stale, forged and cross-mission proof actions',async function(){
  if(!fhevm.isMock)this.skip();
  const {c,operative,other,relay}=await fixture();
  const p=await payload(c,operative,0,1);
  await expect(c.connect(other).submitAttempt(1n,1,p.handles.slice(0,5),p.handles[5],p.inputProof)).to.be.revertedWith('Not operative');
  await expect(c.connect(operative).submitAttempt(1n,2,p.handles.slice(0,5),p.handles[5],p.inputProof)).to.be.revertedWith('Unexpected attempt');
  await c.connect(operative).submitAttempt(1n,1,p.handles.slice(0,5),p.handles[5],p.inputProof);
  await expect(c.connect(operative).submitAttempt(1n,1,p.handles.slice(0,5),p.handles[5],p.inputProof)).to.be.revertedWith('Already submitted');
  const r=await resolve(c,relay,1n,1);
  await expect(c.finalizeAttempt(1n,1,49,r.proof)).to.be.revertedWith('Invalid probe feedback');
  await expect(c.finalizeAttempt(1n,1,r.value,'0x1234')).to.be.reverted;
  await expect(c.finalizeAttempt(1n,1,r.value===16?24:16,r.proof)).to.be.reverted;
  await c.connect(other).openMission();
  await submit(c,other,2n,1,0,1);
  const second=await resolve(c,relay,2n,1);
  expect(second.h).not.to.equal(r.h);
  await expect(c.finalizeAttempt(2n,1,r.value,r.proof)).to.be.reverted;
  await c.finalizeAttempt(1n,1,r.value,r.proof);
  await expect(c.finalizeAttempt(1n,1,r.value,r.proof)).to.be.revertedWith('Unexpected attempt');
  await c.finalizeAttempt(2n,1,second.value,second.proof);
 });
 it('keeps a pending seal recoverable until inclusive cutoff, then aborts without score',async function(){
  if(!fhevm.isMock)this.skip();
  const {c,operative,relay}=await fixture();
  await submit(c,operative,1n,1,0,1);
  const s=await c.missionStatus(1n);
  await at(s.deadlineAt+1n);
  await expect(c.expireMission(1n)).to.be.revertedWith('Attempt still pending');
  await expect(c.abortUnsettled(1n)).to.be.revertedWith('Recovery still active');
  await at(s.recoveryDeadlineAt);
  const r=await resolve(c,relay,1n,1);
  await at(s.recoveryDeadlineAt+1n);
  await expect(c.finalizeAttempt(1n,1,r.value,r.proof)).to.be.revertedWith('Recovery expired');
  await expect(c.connect(relay).abortUnsettled(1n)).to.emit(c,'MissionTechnicalAbort').withArgs(1n,1);
  const end=await c.missionStatus(1n);
  expect(end.outcome).to.equal(4);expect(end.score).to.equal(0);expect(end.attemptsUsed).to.equal(0);
  expect(await c.activeMission(operative.address)).to.equal(0n);
  await expect(c.finalizeAttempt(1n,1,r.value,r.proof)).to.be.revertedWith('Mission closed');
  await c.connect(operative).openMission();
  expect(await c.activeMission(operative.address)).to.equal(2n);
 });
 it('normal unsealed expiry releases the slot without a win or technical abort',async function(){
  if(!fhevm.isMock)this.skip();
  const {c,operative,relay}=await fixture();
  const s=await c.missionStatus(1n);
  await at(s.recoveryDeadlineAt+1n);
  await expect(c.abortUnsettled(1n)).to.be.revertedWith('No pending attempt');
  await expect(c.connect(relay).expireMission(1n)).to.emit(c,'MissionExpired').withArgs(1n);
  expect((await c.missionStatus(1n)).outcome).to.equal(3);
  expect((await c.missionStatus(1n)).score).to.equal(0);
  expect(await c.activeMission(operative.address)).to.equal(0n);
 });
});
