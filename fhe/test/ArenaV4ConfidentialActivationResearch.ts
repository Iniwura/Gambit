import {expect} from 'chai';
import {ethers,fhevm,network} from 'hardhat';

type Plan={base:number;trigger:number;response:number};
const always=(base:number):Plan=>({base,trigger:0,response:base});
const W=[always(0),always(0),always(0)];
const L=[always(2),always(2),always(2)];

async function seal(c:any,actor:any,plans:Plan[],selector:number,formation=0,round?:number){
  const input=fhevm.createEncryptedInput(await c.getAddress(),await actor.getAddress());
  for(const p of plans){input.add8(p.base);input.add8(p.trigger);input.add8(p.response);}
  input.add8(formation);input.add8(selector);
  const payload=await input.encrypt();
  expect(payload.handles).to.have.length(11);
  return c.connect(actor).sealRound(1n,round??(await c.matchStatus(1n)).currentRound,payload.handles,payload.inputProof);
}

describe('ArenaV4ConfidentialActivationResearch (MOCK ONLY)',function(){
  this.timeout(300000);
  async function fixture(){
    if(!fhevm.isMock)this.skip();
    const [a,b,out]=await ethers.getSigners();
    const f=await ethers.getContractFactory('ArenaV4ConfidentialActivationResearch');
    const c:any=await f.deploy();await c.waitForDeployment();
    await c.connect(a).createMatch(await b.getAddress());
    return {c,a,b,out};
  }
  async function settle(c:any,round:number,expected:number,previousProof?:string){
    const tx=await (await c.resolveRound(1n,round)).wait();
    const handle=await c.publicResultHandle(1n,round);
    const clear=await fhevm.publicDecrypt([handle]);
    const packed=Number(clear.clearValues[handle]);
    expect(packed).to.equal(expected);
    if(previousProof)await expect(c.finalizeRound(1n,round,packed,previousProof)).to.be.reverted;
    await expect(c.finalizeRound(1n,round,packed^1,clear.decryptionProof)).to.be.reverted;
    await expect(c.finalizeRound(1n,round,packed,clear.decryptionProof)).to.emit(c,'RoundFinalized');
    return {proof:clear.decryptionProof,gas:tx.gasUsed.toString()};
  }
  it('five rounds: inactive and invalid selectors do not spend, both effective uses only once',async function(){
    const {c,a,b}=await fixture();
    const selectors=[[3,255],[0,0],[1,1],[2,2],[3,3]];
    const expected=[40,56,40,40,40]; // 5:0, 7:0, then repeats ignored
    let previousProof:string|undefined;
    const gas:string[]=[];
    for(let i=0;i<5;i++){
      const r=i+1;
      // Alternate submission order, including both active in round two.
      if(i%2){await seal(c,b,L,selectors[i][1]);await seal(c,a,W,selectors[i][0]);}
      else{await seal(c,a,W,selectors[i][0]);await seal(c,b,L,selectors[i][1]);}
      const settled=await settle(c,r,expected[i],previousProof);
      previousProof=settled.proof;gas.push(settled.gas);
    }
    const state=await c.matchStatus(1n);
    expect(state.complete).to.equal(true);
    expect(state.cumulativeChallenger).to.equal(27n);
    expect(state.cumulativeDefender).to.equal(0n);
    expect(state.length).to.equal(7);
    const f=c.interface.getFunction('sealRound');
    expect(f.inputs.map((i:any)=>i.type)).to.deep.equal(['uint256','uint8','bytes32[11]','bytes']);
    expect(c.interface.getFunction('matchStatus').outputs.map((o:any)=>o.name)).not.to.include('challengerGambitSpent');
    console.log('GAMBIT_V4_MOCK_RESOLVE_GAS '+JSON.stringify(gas));
  });
  it('failure spends the opportunity even at zero score; later winning request cannot benefit',async function(){
    const {c,a,b}=await fixture();
    await seal(c,a,L,2);await seal(c,b,W,3);
    await settle(c,1,5);
    await seal(c,a,W,0);await seal(c,b,L,3);
    await settle(c,2,40);
    // Defender retains its use from previous inactive selectors.
    await seal(c,a,L,3);await seal(c,b,W,1);
    await settle(c,3,7);
  });
  it('guardrails: outsider, duplicate, stale, unfinished deadline and double resolution',async function(){
    const {c,a,b,out}=await fixture();
    await expect(seal(c,out,W,0)).to.be.revertedWith('Not participant');
    await expect(seal(c,a,W,0,0,2)).to.be.revertedWith('Unexpected round');
    await expect(seal(c,a,W,0)).to.emit(c,'RoundSealed');
    await expect(seal(c,a,W,3)).to.be.revertedWith('Already sealed');
    await expect(c.resolveRound(1n,1)).to.be.revertedWith('Both orders required');
    await seal(c,b,L,3);
    await network.provider.send('evm_increaseTime',[86402]);
    await network.provider.send('evm_mine');
    await expect(c.expireIncomplete(1n,1)).to.be.revertedWith('Both sealed on time');
    await c.resolveRound(1n,1);
    await expect(c.resolveRound(1n,1)).to.be.revertedWith('Already resolved');
    const h=await c.publicResultHandle(1n,1),d=await fhevm.publicDecrypt([h]);
    expect(Number(d.clearValues[h])).to.equal(56);
    await c.finalizeRound(1n,1,56,d.decryptionProof);
    await expect(seal(c,a,W,0,0,1)).to.be.revertedWith('Unexpected round');
  });
  it('recovers only own allowance through user decryption and rejects public or rival decryption',async function(){
    const {c,a,b,out}=await fixture();
    const address=await c.getAddress();
    const read=async(actor:any)=>c.connect(actor).ownSpentHandle(1n);
    const decrypt=async(handle:string,actor:any)=>fhevm.userDecryptEbool(handle,address,actor);
    const reject=async(fn:()=>Promise<any>)=>{
      let rejected=false;
      try{await fn();}catch{rejected=true;}
      expect(rejected).to.equal(true);
    };
    await expect(read(out)).to.be.revertedWith('Not participant');
    expect(await decrypt(await read(a),a)).to.equal(false);
    expect(await decrypt(await read(b),b)).to.equal(false);
    await seal(c,a,W,0);await seal(c,b,L,3);
    await settle(c,1,56);
    const ah=await read(a),bh=await read(b);
    expect(await decrypt(ah,a)).to.equal(true);
    expect(await decrypt(bh,b)).to.equal(false);
    await reject(()=>decrypt(ah,b));
    await reject(()=>decrypt(bh,a));
    await reject(()=>decrypt(ah,out));
    await reject(()=>fhevm.publicDecrypt([ah]));
    await seal(c,a,W,1);await seal(c,b,L,0);
    await settle(c,2,40);
    expect(await decrypt(await read(a),a)).to.equal(true);
    expect(await decrypt(await read(b),b)).to.equal(true);
  });
});
