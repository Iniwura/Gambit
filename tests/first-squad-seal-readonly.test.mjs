import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {FIRST_SEAL,verifyFirstSquadSealReadOnly}
  from '../scripts/verify-first-squad-seal-readonly.mjs';

const ABI=new Interface([
 'function sealSquad(address allowedOpponent,bytes32[10] encryptedPlans,bytes inputProof) returns (uint256)',
 'function squadStatus(uint256) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
 'function nextSquadId() view returns (uint256)',
 'event SquadSealed(uint256 indexed squadId,address indexed owner,address indexed allowedOpponent)'
]);
const CONTRACT='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
function mock(){
  const code='0x60006000556002';
  const proof=ABI.encodeEventLog(ABI.getEvent('SquadSealed'),[
    FIRST_SEAL.squadId,FIRST_SEAL.owner,FIRST_SEAL.challenger
  ]);
  const data=ABI.encodeFunctionData('sealSquad',[
    FIRST_SEAL.challenger,
    Array.from({length:10},(_,i)=>'0x'+(i+1).toString(16).padStart(64,'0')),
    '0xabcd'
  ]);
  const manifest={
    chainId:FIRST_SEAL.chainId,
    contract:'SquadGambit',deployer:FIRST_SEAL.owner,
    contractAddress:CONTRACT,runtimeKeccak256:keccak256(code),
    runtimeBytes:(code.length-2)/2
  };
  const tx={
    from:FIRST_SEAL.owner,to:CONTRACT,hash:FIRST_SEAL.transactionHash,
    value:0n,data
  };
  const receipt={
    hash:FIRST_SEAL.transactionHash,from:FIRST_SEAL.owner,to:CONTRACT,
    status:1,blockNumber:FIRST_SEAL.block,
    gasUsed:FIRST_SEAL.gasUsed,gasPrice:FIRST_SEAL.gasPriceWei,
    logs:[{address:CONTRACT,...proof}]
  };
  const provider={
    async send(){return '0xaa36a7'},
    async getTransaction(){return tx},
    async getTransactionReceipt(){return receipt},
    async getCode(){return code},
    async call({data:raw,to}){
      assert.equal(to,CONTRACT);
      const parsed=ABI.parseTransaction({data:raw});
      if(parsed.name==='squadStatus')
        return ABI.encodeFunctionResult('squadStatus',[
          FIRST_SEAL.owner,FIRST_SEAL.challenger,true,false
        ]);
      if(parsed.name==='nextSquadId')
        return ABI.encodeFunctionResult('nextSquadId',[1n]);
      throw Error('Unexpected public mock call');
    }
  };
  return {provider,manifest,tx,receipt,code};
}

test('offline witness: exact public Sepolia receipt, SquadSealed event, code and state match',async()=>{
  const {provider,manifest}=mock();
  const output=await verifyFirstSquadSealReadOnly(provider,manifest);
  assert.equal(output.squadId,'1');
  assert.equal(output.claimed,false);
  assert.equal(output.encryptedSquadAccepted,true);
  assert.equal(output.kmsProofVerified,false);
  assert.equal(output.transactionSent,false);
  assert.equal(output.balanceChecked,false);
  assert.equal(output.actualFeeWei,'74851940');
});

test('offline adversarial witness: unauthorized sender and opponent are rejected',async()=>{
  const a=mock();
  a.tx.from='0x0000000000000000000000000000000000000001';
  await assert.rejects(verifyFirstSquadSealReadOnly(a.provider,a.manifest),/sender/);
  const b=mock();
  b.receipt.logs[0].topics[3]='0x'+'0'.repeat(63)+'1';
  await assert.rejects(verifyFirstSquadSealReadOnly(b.provider,b.manifest),/challenger in event/);
});

test('offline adversarial witness: altered gas, nonzero ETH value, missing event or runtime are rejected',async()=>{
  for(const mutate of [
    x=>{x.tx.value=1n},
    x=>{x.receipt.gasUsed+=1n},
    x=>{x.receipt.status=0},
    x=>{x.receipt.logs=[]},
    x=>{x.manifest.runtimeKeccak256='0x'+'0'.repeat(64)}
  ]){
    const x=mock();mutate(x);
    await assert.rejects(verifyFirstSquadSealReadOnly(x.provider,x.manifest));
  }
});

test('offline adversarial witness: invalid chain, selector and stale storage are rejected',async()=>{
  const x=mock();
  x.provider.send=async()=> '0x1';
  await assert.rejects(verifyFirstSquadSealReadOnly(x.provider,x.manifest),/chain/);

  const y=mock();
  y.tx.data='0x12345678';
  await assert.rejects(verifyFirstSquadSealReadOnly(y.provider,y.manifest),/function selector/);

  const z=mock();
  z.provider.call=async()=>ABI.encodeFunctionResult('squadStatus',[
    FIRST_SEAL.owner,FIRST_SEAL.challenger,false,false
  ]);
  await assert.rejects(verifyFirstSquadSealReadOnly(z.provider,z.manifest));
});
