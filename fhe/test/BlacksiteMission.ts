import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

type Code=[number,number,number,number];
const CODE:Code=[0,1,2,3];

async function encryptCode(contract:any,signer:any,code:Code){
  const input=fhevm.createEncryptedInput(
    await contract.getAddress(),await signer.getAddress());
  for(const value of code)input.add8(value);
  const payload=await input.encrypt();
  expect(payload.handles).to.have.length(4);
  return payload;
}

async function encryptAttempt(contract:any,signer:any,guess:Code,approach:number){
  const input=fhevm.createEncryptedInput(
    await contract.getAddress(),await signer.getAddress());
  for(const value of guess)input.add8(value);
  input.add8(approach);
  const payload=await input.encrypt();
  expect(payload.handles).to.have.length(5);
  return payload;
}

async function open(contract:any,warden:any,operative:any,code:Code=CODE){
  const payload=await encryptCode(contract,warden,code);
  await expect(contract.connect(warden).openMission(
    await operative.getAddress(),payload.handles,payload.inputProof
  )).to.emit(contract,'MissionOpened');
}

async function submit(
  contract:any,operative:any,guess:Code,approach:number,attempt=1
){
  const payload=await encryptAttempt(contract,operative,guess,approach);
  await expect(contract.connect(operative).submitAttempt(
    1n,attempt,payload.handles.slice(0,4),payload.handles[4],payload.inputProof
  )).to.emit(contract,'AttemptSubmitted');
}

async function feedback(contract:any,attempt:number){
  const handle=await contract.feedbackHandle(1n,attempt);
  const decrypted=await fhevm.publicDecrypt([handle]);
  return {handle,proof:decrypted.decryptionProof,
    value:Number(decrypted.clearValues[handle])};
}

describe('BlacksiteMission — encrypted competitive mission (MOCK ONLY)',function(){
  this.timeout(300000);

  async function fixture(code:Code=CODE){
    if(!fhevm.isMock)this.skip();
    const [warden,operative,outsider]=await ethers.getSigners();
    const factory=await ethers.getContractFactory('BlacksiteMission');
    const contract:any=await factory.deploy();
    await contract.waitForDeployment();
    await open(contract,warden,operative,code);
    return {contract,warden,operative,outsider};
  }

  it('keeps the vault and approaches encrypted while a real strategy completes',async()=>{
    const {contract,warden,operative,outsider}=await fixture();
    await submit(contract,operative,[0,0,0,0],0,1);
    await expect(contract.connect(outsider).resolveAttempt(1n,1))
      .to.emit(contract,'AttemptReady');
    const one=await feedback(contract,1);
    expect(one.value).to.equal(1); // STEALTH: one exact position only.
    await expect(contract.connect(outsider).finalizeAttempt(
      1n,1,one.value,one.proof
    )).to.emit(contract,'AttemptFinalized');

    await submit(contract,operative,[0,1,3,2],1,2);
    await contract.resolveAttempt(1n,2);
    const two=await feedback(contract,2);
    expect(two.value).to.equal(34); // PROBE: 16 + (2 exact, 2 misplaced).
    await contract.finalizeAttempt(1n,2,two.value,two.proof);

    await submit(contract,operative,[0,1,2,0],2,3);
    await contract.resolveAttempt(1n,3);
    const three=await feedback(contract,3);
    expect(three.value).to.equal(67); // BREACH progress: 64 + 3 exact.
    await contract.finalizeAttempt(1n,3,three.value,three.proof);

    await submit(contract,operative,CODE,2,4);
    await contract.resolveAttempt(1n,4);
    const four=await feedback(contract,4);
    expect(four.value).to.equal(68); // BREACH: exact four.
    await expect(contract.finalizeAttempt(1n,4,four.value,four.proof))
      .to.emit(contract,'MissionCompleted').withArgs(1n,1,35,5);

    const status=await contract.missionStatus(1n);
    expect(status.attemptsUsed).to.equal(4);
    expect(status.heat).to.equal(5);
    expect(status.score).to.equal(35);
    expect(status.outcome).to.equal(1);
    await expect(contract.feedbackHandle(1n,4)).to.be.revertedWith('Feedback unavailable');
    const names=contract.interface.fragments.map((f:any)=>f.name).filter(Boolean);
    for(const leaked of ['vaultCode','getVaultCode','guess','getGuess','approach'])
      expect(names).not.to.include(leaked);
    console.log('GAMBIT_BLACKSITE_FHE_MISSION '+JSON.stringify({
      network:'Hardhat FHE mock',attempts:4,routeTradeoff:true,
      exactFeedbackHiddenUntilKmsProof:true,heat:5,score:35,
      deployedToSepolia:false,walletTransactions:0
    }));
  });

  it('rejects forged, stale, duplicate and unauthorized mission actions',async()=>{
    const {contract,warden,operative,outsider}=await fixture();
    const unauthorized=await encryptAttempt(contract,operative,[0,0,0,0],1);
    await expect(contract.connect(outsider).submitAttempt(
      1n,1,unauthorized.handles.slice(0,4),unauthorized.handles[4],
      unauthorized.inputProof
    )).to.be.revertedWith('Not operative');
    const payload=await encryptAttempt(contract,operative,[0,0,0,0],1);
    await expect(contract.connect(operative).submitAttempt(
      1n,2,payload.handles.slice(0,4),payload.handles[4],payload.inputProof
    )).to.be.revertedWith('Unexpected attempt');
    await contract.connect(operative).submitAttempt(
      1n,1,payload.handles.slice(0,4),payload.handles[4],payload.inputProof
    );
    await expect(contract.submitAttempt(
      1n,1,payload.handles.slice(0,4),payload.handles[4],payload.inputProof
    )).to.be.revertedWith('Not operative');
    await expect(contract.resolveAttempt(1n,2)).to.be.revertedWith('Unexpected attempt');
    await contract.resolveAttempt(1n,1);
    const result=await feedback(contract,1);
    await expect(contract.finalizeAttempt(1n,1,68,result.proof)).to.be.reverted;
    await expect(contract.finalizeAttempt(1n,1,result.value,'0x1234')).to.be.reverted;
    await contract.finalizeAttempt(1n,1,result.value,result.proof);
    await expect(contract.resolveAttempt(1n,1)).to.be.revertedWith('Unexpected attempt');
    await expect(contract.finalizeAttempt(1n,1,result.value,result.proof))
      .to.be.revertedWith('Unexpected attempt');
    expect((await contract.missionStatus(1n)).attemptsUsed).to.equal(1);
    expect((await contract.missionStatus(1n)).outcome).to.equal(0);
    void warden;
  });

  it('enforces the five-attempt boundary and never awards a timeout victory',async()=>{
    const {contract,operative}=await fixture();
    for(let attempt=1;attempt<=5;attempt++){
      await submit(contract,operative,[0,0,0,0],1,attempt);
      await contract.resolveAttempt(1n,attempt);
      const result=await feedback(contract,attempt);
      expect(result.value).to.equal(24); // Probe: 16 + one exact (8).
      await contract.finalizeAttempt(1n,attempt,result.value,result.proof);
    }
    const status=await contract.missionStatus(1n);
    expect(status.attemptsUsed).to.equal(5);
    expect(status.outcome).to.equal(2);
    expect(status.score).to.equal(0);
    expect(status.heat).to.equal(5);
    await expect(submit(contract,operative,[0,1,2,3],2,6))
      .to.be.revertedWith('Mission closed');
  });

  it('separates a perfect PROBE from a zero-match BREACH and charges correct heat',async()=>{
    const {contract,operative}=await fixture([0,0,0,0]);
    await submit(contract,operative,[0,0,0,0],1,1);
    await contract.resolveAttempt(1n,1);
    const probe=await feedback(contract,1);
    expect(probe.value).to.equal(48);
    await expect(contract.finalizeAttempt(1n,1,64,probe.proof)).to.be.reverted;
    await contract.finalizeAttempt(1n,1,probe.value,probe.proof);
    let status=await contract.missionStatus(1n);
    expect(status.heat).to.equal(1);
    expect(status.outcome).to.equal(0);
    await submit(contract,operative,[1,1,1,1],2,2);
    await contract.resolveAttempt(1n,2);
    const breach=await feedback(contract,2);
    expect(breach.value).to.equal(64);
    await contract.finalizeAttempt(1n,2,breach.value,breach.proof);
    status=await contract.missionStatus(1n);
    expect(status.heat).to.equal(3);
    expect(status.outcome).to.equal(0);
  });

  it('matches multiplicity-aware clues across repeated glyph fixtures',async()=>{
    const {contract,warden,operative}=await fixture();
    const cases:{secret:Code;guess:Code;exact:number;misplaced:number}[]=[
      {secret:[0,0,0,1],guess:[0,1,2,3],exact:1,misplaced:1},
      {secret:[0,1,2,3],guess:[0,0,0,1],exact:1,misplaced:1},
      {secret:[0,0,1,1],guess:[1,1,0,0],exact:0,misplaced:4},
      {secret:[2,2,2,2],guess:[2,0,1,3],exact:1,misplaced:0},
      {secret:[2,2,3,3],guess:[2,3,3,3],exact:3,misplaced:0},
      {secret:[3,3,3,3],guess:[0,0,0,0],exact:0,misplaced:0},
      {secret:[1,1,2,2],guess:[1,1,2,2],exact:4,misplaced:0}
    ];
    for(const [index,c] of cases.entries()){
      const id=BigInt(index+2);
      await open(contract,warden,operative,c.secret);
      const guess=await encryptAttempt(contract,operative,c.guess,1);
      await contract.connect(operative).submitAttempt(
        id,1,guess.handles.slice(0,4),guess.handles[4],guess.inputProof);
      await contract.resolveAttempt(id,1);
      const handle=await contract.feedbackHandle(id,1);
      const clear=await fhevm.publicDecrypt([handle]);
      const value=Number(clear.clearValues[handle]);
      expect(value).to.equal(16+8*c.exact+c.misplaced);
      await contract.finalizeAttempt(id,1,value,clear.decryptionProof);
      const state=await contract.missionStatus(id);
      expect(state.heat).to.equal(1);
      expect(state.outcome).to.equal(0);
    }
  });

  it('supports all distinct four-glyph codes without plaintext code reads',async()=>{
    const {contract,warden,operative}=await fixture();
    const codes:Code[]=[
      [0,1,2,3],[0,1,3,2],[0,2,1,3],[0,2,3,1],
      [0,3,1,2],[0,3,2,1],[1,0,2,3],[1,0,3,2],
      [1,2,0,3],[1,2,3,0],[1,3,0,2],[1,3,2,0],
      [2,0,1,3],[2,0,3,1],[2,1,0,3],[2,1,3,0],
      [2,3,0,1],[2,3,1,0],[3,0,1,2],[3,0,2,1],
      [3,1,0,2],[3,1,2,0],[3,2,0,1],[3,2,1,0]
    ];
    // Create an independent mission for each code, then breach it in one
    // encrypted attempt. The test checks the FHE path, not a cleartext oracle.
    for(const [index,code] of codes.entries()){
      const payload=await encryptCode(contract,warden,code);
      await contract.connect(warden).openMission(
        await operative.getAddress(),payload.handles,payload.inputProof);
      const id=BigInt(index+2);
      const guess=await encryptAttempt(contract,operative,code,2);
      await contract.connect(operative).submitAttempt(
        id,1,guess.handles.slice(0,4),guess.handles[4],guess.inputProof);
      await contract.resolveAttempt(id,1);
      const handle=await contract.feedbackHandle(id,1);
      const clear=await fhevm.publicDecrypt([handle]);
      const value=Number(clear.clearValues[handle]);
      expect(value).to.equal(68);
      await contract.finalizeAttempt(id,1,value,clear.decryptionProof);
      expect((await contract.missionStatus(id)).outcome).to.equal(1);
    }
    console.log('GAMBIT_BLACKSITE_CODESPACE_AUDIT '+JSON.stringify({
      distinctCodes:codes.length,encryptedInputsPerMission:9,
      plaintextCodeReads:0,liveDeployment:false
    }));
  });
});
