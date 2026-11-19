import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

type Plan={base:number,trigger:number,response:number};
const W:Plan={base:0,trigger:1,response:0};
const L:Plan={base:2,trigger:1,response:2};
async function encrypt(contract:any,signer:any,plans:Plan[]){
  const input=fhevm.createEncryptedInput(await contract.getAddress(),await signer.getAddress());
  for(const p of plans){input.add8(p.base);input.add8(p.trigger);input.add8(p.response);}
  const c=await input.encrypt();
  expect(c.handles.length).to.equal(9);
  return c;
}
async function sealed(contract:any,owner:any,allowed:any,plans:Plan[]){
  const c=await encrypt(contract,owner,plans);
  return contract.connect(owner).sealSquad(await allowed.getAddress(),c.handles,c.inputProof);
}
async function submitted(contract:any,challenger:any,duelId:bigint,plans:Plan[]){
  const c=await encrypt(contract,challenger,plans);
  return contract.connect(challenger).submitDuel(duelId,c.handles,c.inputProof);
}
describe('SquadGambit — EXPERIMENTAL encrypted three-role engine',function(){
  async function fixture(){
    if(!fhevm.isMock)this.skip();
    const [defender,challenger,outsider]=await ethers.getSigners();
    const f=await ethers.getContractFactory('SquadGambit');
    const c:any=await f.deploy();await c.waitForDeployment();
    return {c,defender,challenger,outsider};
  }

  it('runs 3 independent FHE duels with authenticated aggregate score and no plaintext strategy getter',async function(){
    const {c,defender,challenger,outsider}=await fixture();
    await expect(sealed(c,defender,challenger,[L,L,L])).to.emit(c,'SquadSealed');
    const s=await c.squadStatus(1n);
    expect(s.owner).to.equal(await defender.getAddress());
    expect(s.allowedOpponent).to.equal(await challenger.getAddress());
    await expect(c.connect(defender).openDuel(1n)).to.be.revertedWith('Not invited challenger');
    await expect(c.connect(outsider).openDuel(1n)).to.be.revertedWith('Not invited challenger');
    await expect(c.connect(challenger).openDuel(1n)).to.emit(c,'DuelOpened');
    await expect(c.connect(challenger).openDuel(1n)).to.be.revertedWith('Unavailable squad');
    await expect(submitted(c,outsider,1n,[W,W,W])).to.be.revertedWith('Not challenger');
    await (await submitted(c,challenger,1n,[W,W,W])).wait();
    await expect(submitted(c,challenger,1n,[W,W,W])).to.be.revertedWith('Already submitted');
    await expect(c.resolveDuel(1n)).to.emit(c,'DuelReady');
    const handle=await c.publicResultHandle(1n);
    const recovered=await fhevm.publicDecrypt([handle]);
    const packed=Number(recovered.clearValues[handle]);
    // Challenger wins Scout, Guardian and Striker. 3 base + 1 breach + 1 mark = 5.
    expect(packed).to.equal(40); // 5*8+0
    expect(recovered.decryptionProof).to.be.a('string').and.not.equal('0x');
    await expect(c.finalizeDuel(1n,packed+1,recovered.decryptionProof)).to.be.reverted;
    await expect(c.finalizeDuel(1n,packed,'0x0123')).to.be.reverted;
    await expect(c.connect(outsider).finalizeDuel(1n,packed,recovered.decryptionProof))
      .to.emit(c,'DuelFinalized').withArgs(1n,5,0,1);
    const status=await c.duelStatus(1n);
    expect(status.finalized).to.equal(true);
    expect(status.packedScore).to.equal(40);
    await expect(c.finalizeDuel(1n,packed,recovered.decryptionProof)).to.be.revertedWith('Not finalizable');
    await expect(c.resolveDuel(1n)).to.be.revertedWith('Not resolvable');
  });

  it('guardian can block breach points and a sealed squad cannot be queried repeatedly',async function(){
    const {c,defender,challenger}=await fixture();
    // Defender wins Guardian (GUARD > STRIKE), challenger wins Scout and Striker.
    const defenderPlans=[L,{base:1,trigger:2,response:1},L];
    const challengerPlans=[W,{base:0,trigger:2,response:0},W];
    await (await sealed(c,defender,challenger,defenderPlans)).wait();
    await (await c.connect(challenger).openDuel(1n)).wait();
    await (await submitted(c,challenger,1n,challengerPlans)).wait();
    await (await c.resolveDuel(1n)).wait();
    const h=await c.publicResultHandle(1n),decrypted=await fhevm.publicDecrypt([h]);
    // Challenger 2 base wins + (breach 1 + mark 1 - guardian block 1) = 3
    // Defender one guardian lane win = 1
    expect(Number(decrypted.clearValues[h])).to.equal(25); // 3*8+1
  });

  it('expires unused private challenge and never resets policy to re-query',async function(){
    const {c,defender,challenger}=await fixture();
    await (await sealed(c,defender,challenger,[L,L,L])).wait();
    await (await c.connect(challenger).openDuel(1n)).wait();
    await expect(c.expireUnsubmitted(1n)).to.be.revertedWith('Still active');
    await network.provider.send('evm_increaseTime',[86401]);
    await network.provider.send('evm_mine');
    await expect(c.expireUnsubmitted(1n)).to.emit(c,'DuelExpired');
    expect((await c.squadStatus(1n)).claimed).to.equal(true);
    await expect(c.connect(challenger).openDuel(1n)).to.be.revertedWith('Unavailable squad');
    await expect(c.resolveDuel(1n)).to.be.revertedWith('Not resolvable');
  });
});
