import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

/**
 * Actual FHEVM-mock contract tests, NOT Sepolia deployment or an HCU meter.
 * v3 is isolated: these tests must never deploy or mutate live SquadGambit.
 */
type Plan={base:number,trigger:number,response:number};
const always=(base:number):Plan=>({base,trigger:base===0?1:0,response:base});
const A=[always(0),always(1),always(2)];
const B=[always(0),always(1),always(1)];

async function encrypt(c:any,signer:any,plans:Plan[],formation=0,stakeSector=0){
  const input=fhevm.createEncryptedInput(await c.getAddress(),await signer.getAddress());
  for(const p of plans){input.add8(p.base);input.add8(p.trigger);input.add8(p.response);}
  input.add8(formation);
  input.add8(stakeSector);
  const payload=await input.encrypt();
  expect(payload.handles).to.have.length(11);
  return payload;
}
async function submit(c:any,signer:any,plans:Plan[],formation=0,stakeSector=0,useGambit=false){
  const payload=await encrypt(c,signer,plans,formation,stakeSector);
  return c.connect(signer).sealRound(1n,payload.handles,payload.inputProof,useGambit);
}
async function finalize(c:any,expectedPacked:number){
  await expect(c.resolveRound(1n)).to.emit(c,'RoundReady');
  const round=(await c.matchStatus(1n)).currentRound;
  const handle=await c.publicResultHandle(1n,round);
  const decrypted=await fhevm.publicDecrypt([handle]);
  const packed=Number(decrypted.clearValues[handle]);
  expect(packed).to.equal(expectedPacked);
  await expect(c.finalizeRound(1n,packed,decrypted.decryptionProof)).to.emit(c,'RoundFinalized');
  return packed;
}
describe('ArenaV3Research — five-round encrypted FHE lifecycle (MOCK ONLY)',function(){
  this.timeout(300000);

  async function fixture(){
    if(!fhevm.isMock)this.skip();
    const [challenger,defender,outsider]=await ethers.getSigners();
    const f=await ethers.getContractFactory('ArenaV3Research');
    const c:any=await f.deploy();
    await c.waitForDeployment();
    await expect(c.connect(challenger).createMatch(await defender.getAddress()))
      .to.emit(c,'MatchCreated');
    return {c,challenger,defender,outsider};
  }

  it('five fresh independently encrypted rounds, cumulative canonical result, exact proof and no reusable match',async function(){
    const {c,challenger,defender,outsider}=await fixture();
    const w=[always(0),always(0),always(0)];
    const l=[always(2),always(2),always(2)];
    let priorProof:string|null=null;
    for(let round=1;round<=5;round++){
      const status=await c.matchStatus(1n);
      expect(status.currentRound).to.equal(BigInt(round));
      expect(status.complete).to.equal(false);
      await expect(submit(c,challenger,w)).to.emit(c,'RoundSealed');
      await expect(submit(c,challenger,w)).to.be.revertedWith('Already sealed');
      await expect(submit(c,outsider,w)).to.be.revertedWith('Not participant');
      await expect(c.resolveRound(1n)).to.be.revertedWith('Both orders required');
      await expect(submit(c,defender,l)).to.emit(c,'RoundSealed');
      await expect(c.connect(outsider).resolveRound(1n)).to.emit(c,'RoundReady');
      const h=await c.publicResultHandle(1n,round);
      const receipt=await fhevm.publicDecrypt([h]);
      const packed=Number(receipt.clearValues[h]);
      expect(packed).to.equal(40); // 5:0, baseline no GAMBIT.
      if(priorProof!==null){
        // Same PUBLIC score as last round, but a DIFFERENT encrypted handle.
        // A KMS signature from round n-1 cannot finalize round n.
        await expect(c.finalizeRound(1n,packed,priorProof)).to.be.reverted;
      }
      await expect(c.finalizeRound(1n,packed+1,receipt.decryptionProof)).to.be.reverted;
      await expect(c.connect(outsider).finalizeRound(1n,packed,receipt.decryptionProof))
        .to.emit(c,'RoundFinalized');
      const s=await c.matchStatus(1n);
      expect(s.cumulativeChallenger).to.equal(BigInt(5*round));
      expect(s.cumulativeDefender).to.equal(0n);
      const rs=await c.roundStatus(1n,round);
      expect(rs.finalized).to.equal(true);
      expect(rs.packedScore).to.equal(40);
      priorProof=receipt.decryptionProof;
    }
    const final=await c.matchStatus(1n);
    expect(final.complete).to.equal(true);
    expect(final.abandoned).to.equal(false);
    expect(final.cumulativeChallenger).to.equal(25n);
    expect(final.cumulativeDefender).to.equal(0n);
    await expect(c.resolveRound(1n)).to.be.revertedWith('Match closed');
    await expect(submit(c,challenger,w)).to.be.revertedWith('Match closed');
    const names=c.interface.fragments.map((f:any)=>f.name).filter(Boolean);
    for(const leaked of ['readPlans','getFormation','getStakeSector','getTactic']){
      expect(names).not.to.include(leaked);
    }
  });

  it('hidden visual-sector stake follows encrypted formation, not role indices',async function(){
    const {c,challenger,defender}=await fixture();
    // Challenger PIVOT => role 1 on visual lane 0, role 2 on lane 1,
    // role 0 on lane 2. Challenger wins lanes 0/1, loses lane 2.
    // Guardian blocks defender's Striker bonus. Baseline 3:1.
    // Hidden stake on VISUAL lane 0 adds 2 => 5:1 (packed 41).
    await expect(submit(c,challenger,A,1,0,true)).to.emit(c,'RoundSealed');
    await expect(submit(c,defender,B,0,2,false)).to.emit(c,'RoundSealed');
    expect((await c.matchStatus(1n)).challengerGambitSpent).to.equal(true);
    expect((await c.matchStatus(1n)).defenderGambitSpent).to.equal(false);
    await finalize(c,41);
    // Next round cannot repeat the one-use intervention.
    await expect(submit(c,challenger,A,1,1,true)).to.be.revertedWith('GAMBIT already spent');
    await expect(submit(c,challenger,A,1,1,false)).to.emit(c,'RoundSealed');
  });

  it('timeout of one valid submission is unscored, never a free win',async function(){
    const {c,challenger,defender}=await fixture();
    await expect(submit(c,challenger,A)).to.emit(c,'RoundSealed');
    await network.provider.send('evm_increaseTime',[24*3600+2]);
    await network.provider.send('evm_mine');
    await expect(submit(c,defender,B)).to.be.revertedWith('Entry expired');
    await expect(c.expireIncomplete(1n)).to.emit(c,'MatchAbandonedUnscored').withArgs(1n,1);
    const s=await c.matchStatus(1n);
    expect(s.abandoned).to.equal(true);
    expect(s.complete).to.equal(false);
    expect(s.cumulativeChallenger).to.equal(0n);
    expect(s.cumulativeDefender).to.equal(0n);
    await expect(c.expireIncomplete(1n)).to.be.revertedWith('Match closed');
    await expect(c.resolveRound(1n)).to.be.revertedWith('Match closed');
  });

  it('two accepted encrypted seals remain resolvable after deadline',async function(){
    const {c,challenger,defender}=await fixture();
    const w=[always(0),always(0),always(0)];
    const l=[always(2),always(2),always(2)];
    await (await submit(c,challenger,w)).wait();
    await (await submit(c,defender,l)).wait();
    await network.provider.send('evm_increaseTime',[24*3600+2]);
    await network.provider.send('evm_mine');
    await expect(c.expireIncomplete(1n)).to.be.revertedWith('Both sealed on time');
    await finalize(c,40);
    expect((await c.matchStatus(1n)).cumulativeChallenger).to.equal(5n);
  });


  it('measures research contract runtime and transaction GAS on Hardhat mock only',async function(){
    const {c,challenger,defender}=await fixture();
    const w=[always(0),always(0),always(0)];
    const l=[always(2),always(2),always(2)];
    const code=await ethers.provider.getCode(await c.getAddress());
    const created=await c.deploymentTransaction()?.wait();
    const a=await (await submit(c,challenger,w)).wait();
    const b=await (await submit(c,defender,l)).wait();
    const resolved=await (await c.resolveRound(1n)).wait();
    const handle=await c.publicResultHandle(1n,1);
    const decrypted=await fhevm.publicDecrypt([handle]);
    const packed=Number(decrypted.clearValues[handle]);
    expect(packed).to.equal(40);
    const finalized=await (await c.finalizeRound(1n,packed,decrypted.decryptionProof)).wait();
    expect(code).to.match(/^0x[0-9a-f]+$/i);
    expect(created?.gasUsed).to.be.greaterThan(0n);
    for(const tx of [a,b,resolved,finalized])expect(tx?.gasUsed).to.be.greaterThan(0n);
    console.log('GAMBIT_ARENA_V3_MOCK_COST '+JSON.stringify({
      network:'local Hardhat FHE mock only',
      hcu:'NOT MEASURED',
      deployedToSepolia:false,
      runtimeBytes:(code.length-2)/2,
      deployGas:created?.gasUsed.toString(),
      firstSealGas:a?.gasUsed.toString(),
      secondSealGas:b?.gasUsed.toString(),
      resolveGas:resolved?.gasUsed.toString(),
      finalizeGas:finalized?.gasUsed.toString(),
      proofBytes:(decrypted.decryptionProof.length-2)/2,
      encryptedInputsPerPlayerPerRound:11,
      hypotheticalFiveRoundWrites:21
    }));
  });

  it('cannot create self-match, duplicate a sealed round, forge proof or double-resolve',async function(){
    const {c,challenger,defender}=await fixture();
    await expect(c.connect(challenger).createMatch(await challenger.getAddress()))
      .to.be.revertedWith('Invalid opponent');
    await expect(c.connect(challenger).createMatch(ethers.ZeroAddress))
      .to.be.revertedWith('Invalid opponent');
    await expect(c.publicResultHandle(1n,1)).to.be.revertedWith('Result unavailable');
    await expect(c.roundStatus(1n,2)).to.be.revertedWith('Round not opened');
    await (await submit(c,challenger,A,0,1,true)).wait();
    await (await submit(c,defender,B,0,2,true)).wait();
    await expect(c.expireIncomplete(1n)).to.be.revertedWith('Entry still open');
    await expect(c.resolveRound(1n)).to.emit(c,'RoundReady');
    await expect(c.resolveRound(1n)).to.be.revertedWith('Already resolved');
    const h=await c.publicResultHandle(1n,1);
    const proof=await fhevm.publicDecrypt([h]);
    const packed=Number(proof.clearValues[h]);
    await expect(c.finalizeRound(1n,packed,'0x0123')).to.be.reverted;
    await expect(c.finalizeRound(1n,packed+1,proof.decryptionProof)).to.be.reverted;
    await expect(c.finalizeRound(1n,packed,proof.decryptionProof)).to.emit(c,'RoundFinalized');
    await expect(c.finalizeRound(1n,packed,proof.decryptionProof)).to.be.revertedWith('Not finalizable');
    expect((await c.matchStatus(1n)).challengerGambitSpent).to.equal(true);
    expect((await c.matchStatus(1n)).defenderGambitSpent).to.equal(true);
  });
});
