import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

type Plan={base:number,trigger:number,response:number};
async function encrypt(contract:any,signer:any,p:Plan){
  const input=fhevm.createEncryptedInput(await contract.getAddress(),await signer.getAddress());
  input.add8(p.base);input.add8(p.trigger);input.add8(p.response);
  return input.encrypt();
}
async function seal(contract:any,signer:any,p:Plan){
  const x=await encrypt(contract,signer,p);
  await (await contract.connect(signer).seal(x.handles[0],x.handles[1],x.handles[2],x.inputProof)).wait();
}
async function submit(contract:any,signer:any,id:bigint,p:Plan){
  const x=await encrypt(contract,signer,p);
  return contract.connect(signer).submit(id,x.handles[0],x.handles[1],x.handles[2],x.inputProof);
}
async function prove(contract:any,id:bigint,challengerPlan:Plan,defenderPlan:Plan){
  const receipt=await (await contract.resolve(id)).wait();
  const ready=receipt!.logs.flatMap((log:any)=>{
    try{const x=contract.interface.parseLog(log);return x?.name==='ChallengeReady'?[x]:[];}
    catch{return [];}
  })[0];
  expect(ready,'ChallengeReady is required').to.exist;
  const handle=ready!.args.resultHandle as string;
  const res=await fhevm.publicDecrypt([handle]);
  const a=challengerPlan.base===defenderPlan.trigger?defenderPlan.response:defenderPlan.base;
  const b=defenderPlan.base===challengerPlan.trigger?challengerPlan.response:challengerPlan.base;
  // a is defender action, b is challenger action
  const expected=b===a?0:((b===0&&a===2)||(b===1&&a===0)||(b===2&&a===1))?1:2;
  const actual=Number(res.clearValues[handle as `0x${string}`]);
  expect(actual,'FHE must match the deterministic duel').to.equal(expected);
  return {actual,proof:res.decryptionProof,handle};
}

describe('SealedGambit — reusable confidential defender',function(){
  async function fixture(){
    if(!fhevm.isMock)this.skip();
    const [owner,alice,bob,outsider]=await ethers.getSigners();
    const f=await ethers.getContractFactory('SealedGambit');
    const contract=await f.deploy();await contract.waitForDeployment();
    return {contract,owner,alice,bob,outsider};
  }

  it('seals a policy without exposing plaintext and rejects self-challenges',async function(){
    const {contract,owner,alice}=await fixture();
    const policy={base:0,trigger:1,response:2};
    await seal(contract,owner,policy);
    const s=await contract.policyStatus(1n);
    expect(s.owner).to.equal(await owner.getAddress());
    expect(s.active).to.equal(true);
    expect(Number(s.completions)).to.equal(0);
    await expect(contract.connect(owner).openChallenge(1n)).to.be.revertedWith('Cannot challenge self');
    await expect(contract.connect(alice).openChallenge(1n)).to.emit(contract,'ChallengeOpened');
  });

  it('reuses the SAME encrypted defender strategy for two signed offline challenges',async function(){
    const {contract,owner,alice,bob,outsider}=await fixture();
    const defender={base:2,trigger:0,response:1};
    await seal(contract,owner,defender);
    // From here forward the defender sends ZERO transactions.
    const variants=[
      {signer:alice,plan:{base:0,trigger:1,response:2}},
      {signer:bob,plan:{base:1,trigger:2,response:0}}
    ];
    for(let i=0;i<variants.length;i++){
      const v=variants[i],id=BigInt(i+1);
      await (await contract.connect(v.signer).openChallenge(1n)).wait();
      await expect(submit(contract,outsider,id,v.plan)).to.be.revertedWith('Not challenger');
      await (await submit(contract,v.signer,id,v.plan)).wait();
      await expect(submit(contract,v.signer,id,v.plan)).to.be.revertedWith('Already submitted');
      const {actual,proof}=await prove(contract,id,v.plan,defender);
      await expect(contract.finalize(id,(actual+1)%3,proof)).to.be.reverted;
      await expect(contract.finalize(id,actual,'0x4321')).to.be.reverted;
      await expect(contract.connect(outsider).finalize(id,actual,proof)).to.emit(contract,'ChallengeFinalized');
      await expect(contract.finalize(id,actual,proof)).to.be.revertedWith('Not finalizable');
      const s=await contract.challengeStatus(id);
      expect(s.finalized).to.equal(true);
      expect(Number(s.finalOutcome)).to.equal(actual);
    }
    const s=await contract.policyStatus(1n);
    expect(Number(s.completions)).to.equal(2);
  });

  it('owner closing stops new challenges without invalidating committed ones',async function(){
    const {contract,owner,alice}=await fixture();
    const d={base:0,trigger:0,response:1},p={base:1,trigger:1,response:2};
    await seal(contract,owner,d);
    await (await contract.connect(alice).openChallenge(1n)).wait();
    await (await submit(contract,alice,1n,p)).wait();
    await expect(contract.connect(alice).closePolicy(1n)).to.be.revertedWith('Not owner');
    await (await contract.connect(owner).closePolicy(1n)).wait();
    await expect(contract.connect(alice).openChallenge(1n)).to.be.revertedWith('Unavailable policy');
    const res=await prove(contract,1n,p,d);
    await (await contract.finalize(1n,res.actual,res.proof)).wait();
    expect((await contract.challengeStatus(1n)).finalized).to.equal(true);
  });

  it('expires unsubmitted challenges without leaking or changing defender strategy',async function(){
    const {contract,owner,alice}=await fixture();
    await seal(contract,owner,{base:2,trigger:1,response:0});
    await (await contract.connect(alice).openChallenge(1n)).wait();
    await expect(contract.expireUnsubmitted(1n)).to.be.revertedWith('Still active');
    await network.provider.send('evm_increaseTime',[86401]);
    await network.provider.send('evm_mine');
    await expect(contract.expireUnsubmitted(1n)).to.emit(contract,'ChallengeExpired');
    await expect(contract.resolve(1n)).to.be.revertedWith('Not resolvable');
    expect((await contract.challengeStatus(1n)).expired).to.equal(true);
  });
});
