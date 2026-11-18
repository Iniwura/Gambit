/**
 * CANDIDATE Hardhat FHEVM tests — AUTHORING ONLY; not compiled or executed.
 * Verify against the current official Zama FHEVM template in a connected environment.
 */
import { expect } from 'chai';
import { ethers, fhevm, network } from 'hardhat';

const STRIKE=0, GUARD=1, FLANK=2;
const P={base:STRIKE,trigger:FLANK,response:GUARD};

async function submit(contract:any, signer:any, id:bigint, plan:{base:number,trigger:number,response:number}){
  const input=fhevm.createEncryptedInput(await contract.getAddress(),await signer.getAddress());
  input.add8(plan.base);input.add8(plan.trigger);input.add8(plan.response);
  const cipher=await input.encrypt();
  return contract.connect(signer).commitPlan(
    id,cipher.handles[0],cipher.handles[1],cipher.handles[2],cipher.inputProof
  );
}

describe('EncryptedGambit',function(){
  async function fixture(){
    const [alice,bob,eve]=await ethers.getSigners();
    const factory=await ethers.getContractFactory('EncryptedGambit');
    const contract=await factory.deploy();await contract.waitForDeployment();
    await (await contract.connect(alice).open(await bob.getAddress())).wait();
    return {contract,alice,bob,eve};
  }
  it('does not permit an outsider to submit a strategy',async function(){
    const {contract,eve}=await fixture();
    await expect(submit(contract,eve,1n,P)).to.be.revertedWith('Not a participant');
  });
  it('requires two unique participants, then exposes only a result handle',async function(){
    const {contract,alice,bob}=await fixture();
    await (await submit(contract,alice,1n,{base:STRIKE,trigger:GUARD,response:FLANK})).wait();
    await expect(submit(contract,alice,1n,P)).to.be.revertedWith('Already committed');
    await expect(contract.resolve(1n)).to.be.revertedWith('Missing plan');
    await (await submit(contract,bob,1n,{base:FLANK,trigger:STRIKE,response:GUARD})).wait();
    await expect(contract.resolve(1n)).to.emit(contract,'OutcomeReady');
    const s=await contract.status(1n);
    expect(s.aCommitted).to.equal(true);
    expect(s.bCommitted).to.equal(true);
    expect(s.resolved).to.equal(true);
    expect(s.finalized).to.equal(false);
  });

  async function fullResolution(
    alicePlan:{base:number,trigger:number,response:number},
    bobPlan:{base:number,trigger:number,response:number},
  ) {
    const {contract,alice,bob}=await fixture();
    await (await submit(contract,alice,1n,alicePlan)).wait();
    await (await submit(contract,bob,1n,bobPlan)).wait();
    const receipt=await (await contract.resolve(1n)).wait();
    const event=receipt!.logs.flatMap((log:any)=>{
      try { const x=contract.interface.parseLog(log); return x?.name==='OutcomeReady'?[x]:[]; }
      catch { return []; }
    })[0];
    expect(event,'OutcomeReady event must be emitted').to.exist;
    const handle=event!.args.encryptedOutcomeHandle as string;
    const decrypted=await fhevm.publicDecrypt([handle]);
    const actual=Number(decrypted.clearValues[handle as `0x${string}`]);
    const a=bobPlan.base===alicePlan.trigger?alicePlan.response:alicePlan.base;
    const b=alicePlan.base===bobPlan.trigger?bobPlan.response:bobPlan.base;
    const expected=a===b?0:((a===0&&b===2)||(a===1&&b===0)||(a===2&&b===1))?1:2;
    expect(actual,'FHE result must match deterministic reference').to.equal(expected);
    expect(decrypted.decryptionProof).to.be.a('string').and.not.equal('0x');
    return {contract,actual,decrypted};
  }

  it('authenticates an onchain public result, rejects tampering and rejects replay',async function(){
    if(!fhevm.isMock)this.skip();
    const {contract,actual,decrypted}=await fullResolution(
      {base:0,trigger:1,response:2},
      {base:2,trigger:0,response:1}
    );
    await expect(contract.finalize(1n,(actual+1)%3,decrypted.decryptionProof)).to.be.reverted;
    const before=await contract.status(1n);
    expect(before.finalized).to.equal(false);
    await expect(contract.finalize(1n,actual,'0x1234')).to.be.reverted;
    await expect(contract.finalize(1n,actual,decrypted.decryptionProof))
      .to.emit(contract,'OutcomeFinalized');
    const after=await contract.status(1n);
    expect(after.finalized).to.equal(true);
    expect(Number(after.publicOutcome)).to.equal(actual);
    await expect(contract.finalize(1n,actual,decrypted.decryptionProof)).to.be.reverted;
    await expect(contract.resolve(1n)).to.be.reverted;
  });

  it('matches cleartext tactics for all 9 base-action pairings under FHE',async function(){
    if(!fhevm.isMock)this.skip();
    for(let a=0;a<3;a++)for(let b=0;b<3;b++){
      const pa={base:a,trigger:(b+1)%3,response:(a+2)%3};
      const pb={base:b,trigger:(a+2)%3,response:(b+1)%3};
      const result=await fullResolution(pa,pb);
      await (await result.contract.finalize(1n,result.actual,result.decrypted.decryptionProof)).wait();
    }
  });

  it('cannot resolve missing commitments; expires stalled challenges',async function(){
    if(!fhevm.isMock)this.skip();
    const {contract,alice}=await fixture();
    await (await submit(contract,alice,1n,P)).wait();
    await expect(contract.resolve(1n)).to.be.revertedWith('Missing plan');
    await expect(contract.expireUncommitted(1n)).to.be.revertedWith('Still active');
    await network.provider.send('evm_increaseTime',[86402]);
    await network.provider.send('evm_mine');
    await expect(contract.expireUncommitted(1n)).to.emit(contract,'ConfrontationExpired');
    await expect(contract.resolve(1n)).to.be.revertedWith('Closed');
    const s=await contract.status(1n);
    expect(s.expired).to.equal(true);
  });

});
