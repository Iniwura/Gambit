import {ethers,network} from 'hardhat';
import {ZamaSDK,memoryStorage} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {node} from '@zama-fhe/sdk/node';
import {sepolia} from '@zama-fhe/sdk/chains';
import {VoidSigner,Interface,getAddress,keccak256} from 'ethers';
import manifest from '../deployments/sepolia-squad.json';

/**
 * Read-only public KMS readiness + authentic EVM eth_call proof simulation.
 *
 * No signing key: uses an ethers VoidSigner, which CANNOT send transactions.
 * Never invokes contract.finalizeDuel from a signer or broadcasts anything.
 * No private strategies decrypted; only the intentionally public aggregate
 * encrypted-result handle is passed to the official Zama SDK.
 */
const CONTRACT=getAddress('0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134');
const CHALLENGER=getAddress('0x70d086988706e4f27A53c484570B2a41897dcDD5');
const ABI=new Interface([
  'function duelStatus(uint256) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function publicResultHandle(uint256) view returns(bytes32)',
  'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)'
]);
const valueFor=(map:Record<string,unknown>,handle:string):unknown=>
  map?.[handle]??map?.[handle.toLowerCase()]??map?.[handle.toUpperCase()];
const check=(ok:boolean,message:string)=>{if(!ok)throw Error('GAMBIT_KMS_PREFLIGHT '+message)};

async function main(){
  const net=await ethers.provider.getNetwork();
  check(network.name==='sepolia'&&net.chainId===11155111n,'unexpected network');
  check(manifest.chainId===11155111&&manifest.contract==='SquadGambit'&&
    getAddress(manifest.contractAddress)===CONTRACT,'unexpected deployed contract');
  const code=await ethers.provider.getCode(CONTRACT);
  check(code!=='0x'&&keccak256(code).toLowerCase()===
    manifest.runtimeKeccak256.toLowerCase(),'runtime fingerprint');
  const read=async(name:'duelStatus'|'publicResultHandle')=>{
    const data=ABI.encodeFunctionData(name,[1n]);
    return ABI.decodeFunctionResult(name,await ethers.provider.call({
      to:CONTRACT,data
    }));
  };
  const state=await read('duelStatus');
  check(state.submitted===true&&state.resolved===true&&
    state.finalized===false&&state.expired===false&&
    BigInt(state.squadId)===1n&&getAddress(state.challenger)===CHALLENGER,
    'duel is not ready for public decryption');
  const handle=String((await read('publicResultHandle'))[0]);
  check(/^0x[0-9a-fA-F]{64}$/.test(handle),'invalid result handle');
  const rpc=(network.config as {url?:string}).url??
    'https://ethereum-sepolia-rpc.publicnode.com';
  const chain={...sepolia,network:rpc};
  const sdk=new ZamaSDK(createConfig({
    chains:[chain],
    signer:new VoidSigner(CHALLENGER,ethers.provider),
    storage:memoryStorage,
    relayers:{[chain.id]:node({timeout:180000})}
  }));
  const start=Date.now();
  try{
    console.log('GAMBIT_KMS_PUBLIC_STAGE REQUESTING_READONLY_PUBLIC_DECRYPTION');
    const proof=await sdk.decryption.decryptPublicValues([handle as `0x${string}`]);
    const raw=valueFor(proof.clearValues,handle);
    check(raw!==undefined&&raw!==null,'missing public aggregate');
    const packed=Number(raw);
    const challengerPoints=packed>>3,defenderPoints=packed&7;
    check(Number.isInteger(packed)&&packed>=0&&packed<=255&&
      challengerPoints<=5&&defenderPoints<=5,'invalid packed aggregate');
    check(typeof proof.decryptionProof==='string'&&
      /^0x([a-fA-F0-9]{2})+$/.test(proof.decryptionProof),
      'missing public KMS proof');

    // Simulate the *exact* proof acceptance onchain. eth_call does not sign,
    // transfer ETH, store a score, or change duel state.
    const data=ABI.encodeFunctionData('finalizeDuel',[
      1n,packed,proof.decryptionProof
    ]);
    console.log('GAMBIT_KMS_PUBLIC_STAGE SIMULATING_FINALIZATION_VIA_ETH_CALL');
    await ethers.provider.call({from:CHALLENGER,to:CONTRACT,data,value:0n});
    const post=await read('duelStatus');
    check(post.resolved===true&&post.finalized===false,
      'public eth_call unexpectedly changed onchain state');
    console.log('GAMBIT_DUEL1_PUBLIC_KMS_READONLY '+JSON.stringify({
      chainId:11155111,contractAddress:CONTRACT,duelId:'1',
      publicHandle:handle,publicKmsProofPresent:true,
      onchainProofSimulation:'PASSED',
      packedAggregate:packed,
      challengerPoints,defenderPoints,
      outcome:challengerPoints===defenderPoints?'DRAW':
        challengerPoints>defenderPoints?'CHALLENGER':'DEFENDER',
      elapsedMs:Date.now()-start,
      liveHcuMeasured:false,
      scope:'READONLY public decrypt and eth_call, no authorized finalization',
      walletConnected:false,signatureMade:false,transactionSent:false
    }));
  }finally{sdk.terminate()}
}
main().then(()=>process.stdout.write('',()=>process.exit(0)))
  .catch(error=>{
    // Never echo raw KMS errors: they may embed URL credentials/proof data.
    process.stderr.write('GAMBIT_DUEL1_PUBLIC_KMS_STOPPED '+
      (error instanceof Error?error.name:'UnknownError')+'\n',
      ()=>process.exit(1));
  });
