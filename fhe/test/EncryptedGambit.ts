/**
 * CANDIDATE Hardhat FHEVM tests — AUTHORING ONLY; not compiled or executed.
 * Verify against the current official Zama FHEVM template in a connected environment.
 */
import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';

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
});
