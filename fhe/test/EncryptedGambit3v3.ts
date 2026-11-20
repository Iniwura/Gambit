import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

type Plan={base:number,trigger:number,response:number};
type Squad=[Plan,Plan,Plan];

async function encrypt(contract:any,signer:any,squad:Squad){
  const input=fhevm.createEncryptedInput(await contract.getAddress(),await signer.getAddress());
  for(const plan of squad){ input.add8(plan.base); input.add8(plan.trigger); input.add8(plan.response); }
  return input.encrypt();
}

async function commit(contract:any,signer:any,id:bigint,squad:Squad){
  const x=await encrypt(contract,signer,squad);
  return contract.connect(signer).commitSquad(id,
    [x.handles[0],x.handles[3],x.handles[6]],
    [x.handles[1],x.handles[4],x.handles[7]],
    [x.handles[2],x.handles[5],x.handles[8]],x.inputProof);
}

function laneOutcome(a:Plan,b:Plan){
  const actualA=b.base===a.trigger?a.response:a.base;
  const actualB=a.base===b.trigger?b.response:b.base;
  if(actualA===actualB)return 0;
  return ((actualA===0&&actualB===2)||(actualA===1&&actualB===0)||(actualA===2&&actualB===1))?1:2;
}

describe('EncryptedGambit3v3',function(){
  async function fixture(){
    if(!fhevm.isMock)this.skip();
    const [alice,bob,outsider]=await ethers.getSigners();
    const factory=await ethers.getContractFactory('EncryptedGambit3v3');
    const contract:any=await factory.deploy(); await contract.waitForDeployment();
    return {contract,alice,bob,outsider};
  }

  it('resolves three independent encrypted lanes to one aggregate outcome',async function(){
    const {contract,alice,bob}=await fixture();
    const challenger:Squad=[
      {base:0,trigger:2,response:1},{base:1,trigger:0,response:2},{base:2,trigger:1,response:0}
    ];
    const opponent:Squad=[
      {base:2,trigger:1,response:0},{base:0,trigger:2,response:1},{base:1,trigger:0,response:2}
    ];
    await (await contract.connect(alice).open(await bob.getAddress())).wait();
    await (await commit(contract,alice,1n,challenger)).wait();
    await (await commit(contract,bob,1n,opponent)).wait();
    const ready=await (await contract.resolve(1n)).wait();
    const event=ready!.logs.map((log:any)=>{try{return contract.interface.parseLog(log);}catch{return null;}})
      .find((parsed:any)=>parsed?.name==='OutcomeReady');
    expect(event,'OutcomeReady is required').to.exist;
    const handle=event.args.encryptedOutcomeHandle as string;
    const decrypted=await fhevm.publicDecrypt([handle]);
    const lanes=challenger.map((plan,i)=>laneOutcome(plan,opponent[i]));
    const challengerWins=lanes.filter(x=>x===1).length;
    const opponentWins=lanes.filter(x=>x===2).length;
    const expected=challengerWins===opponentWins?0:challengerWins>opponentWins?1:2;
    const actual=Number(decrypted.clearValues[handle]);
    expect(actual).to.equal(expected);
    await expect(contract.finalize(1n,actual,decrypted.decryptionProof)).to.emit(contract,'MatchFinalized');
    const status=await contract.status(1n);
    expect(status.finalized).to.equal(true); expect(Number(status.publicOutcome)).to.equal(expected);
  });

  it('keeps participation, replay, expiry, and proof checks fail-closed',async function(){
    const {contract,alice,bob,outsider}=await fixture();
    const squad:Squad=[
      {base:0,trigger:1,response:2},{base:1,trigger:2,response:0},{base:2,trigger:0,response:1}
    ];
    await (await contract.connect(alice).open(await bob.getAddress())).wait();
    await expect(commit(contract,outsider,1n,squad)).to.be.revertedWith('Not a participant');
    await (await commit(contract,alice,1n,squad)).wait();
    await expect(commit(contract,alice,1n,squad)).to.be.revertedWith('Already committed');
    await expect(contract.resolve(1n)).to.be.revertedWith('Missing squad');
    await (await commit(contract,bob,1n,squad)).wait();
    const receipt=await (await contract.resolve(1n)).wait();
    const event=receipt!.logs.map((log:any)=>{try{return contract.interface.parseLog(log);}catch{return null;}})
      .find((parsed:any)=>parsed?.name==='OutcomeReady');
    const handle=event.args.encryptedOutcomeHandle as string;
    const decrypted=await fhevm.publicDecrypt([handle]);
    const actual=Number(decrypted.clearValues[handle]);
    await expect(contract.finalize(1n,(actual+1)%3,decrypted.decryptionProof)).to.be.reverted;
    await expect(contract.finalize(1n,0,'0x1234')).to.be.reverted;
    await (await contract.finalize(1n,actual,decrypted.decryptionProof)).wait();
    await expect(contract.finalize(1n,0,decrypted.decryptionProof)).to.be.revertedWith('Not finalizable');
    await (await contract.connect(alice).open(await bob.getAddress())).wait();
    await expect(contract.expireUncommitted(2n)).to.be.revertedWith('Still active');
    await network.provider.send('evm_increaseTime',[86401]); await network.provider.send('evm_mine');
    await expect(contract.expireUncommitted(2n)).to.emit(contract,'MatchExpired');
    await expect(contract.resolve(2n)).to.be.revertedWith('Closed');
  });
});
