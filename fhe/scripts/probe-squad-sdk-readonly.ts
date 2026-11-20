import {ethers,network} from 'hardhat';
import {ZamaSDK,memoryStorage} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {node} from '@zama-fhe/sdk/node';
import {sepolia} from '@zama-fhe/sdk/chains';
import {VoidSigner,keccak256,getAddress} from 'ethers';
import manifest from '../deployments/sepolia-squad.json';

/**
 * Read-only live Zama SDK compatibility probe using PUBLIC synthetic inputs.
 * The Ethers VoidSigner possesses no keys and cannot sign transactions.
 * No contract writes, wallet requests, KMS decryptions or secrets.
 */
async function main(){
  const net=await ethers.provider.getNetwork();
  if(net.chainId!==11155111n||network.name!=='sepolia')
    throw Error('Refusing SDK probe outside Ethereum Sepolia.');
  const address=getAddress(manifest.contractAddress);
  const userAddress=getAddress(manifest.deployer);
  if(manifest.chainId!==11155111||manifest.contract!=='SquadGambit')
    throw Error('Wrong deployed SquadGambit manifest.');
  const code=await ethers.provider.getCode(address);
  if(code==='0x'||keccak256(code).toLowerCase()!==manifest.runtimeKeccak256.toLowerCase())
    throw Error('Live SquadGambit runtime fingerprint mismatch.');

  // This signer is intentionally unable to provide any signature.
  const signer=new VoidSigner(userAddress,ethers.provider);
  const rpc=(network.config as {url?:string}).url??'https://ethereum-sepolia-rpc.publicnode.com';
  const chain={...sepolia,network:rpc};
  const sdk=new ZamaSDK(createConfig({
    chains:[chain],signer,storage:memoryStorage,
    relayers:{[chain.id]:node({timeout:180000})}
  }));
  const started=Date.now();
  try{
    const synthetic=[0n,1n,2n,1n,0n,2n,2n,1n,0n,1n];
    const encrypted=await sdk.encrypt({
      contractAddress:address as `0x${string}`,
      userAddress:userAddress as `0x${string}`,
      values:synthetic.map(value=>({type:'euint8' as const,value}))
    });
    if(encrypted.encryptedValues.length!==10||
       typeof encrypted.inputProof!=='string'||
       encrypted.inputProof.length<10)
      throw Error('Live SDK did not produce exactly ten encrypted inputs and an input proof.');
    console.log('GAMBIT_SQUAD_SDK_READONLY '+JSON.stringify({
      chainId:11155111,contractAddress:address,
      identity:'public deployer address only; signer is VoidSigner',
      syntheticInputs:10,encryptedHandles:encrypted.encryptedValues.length,
      inputProofPresent:true,latencyMs:Date.now()-started,
      signed:false,transactionSent:false,
      scope:'SDK ENCRYPTION + PUBLIC RELAYER; NO CONTRACT INPUT ACCEPTANCE OR LIVE HCU'
    }));
  }finally{
    sdk.terminate();
  }
}
// Explicitly end this one-off CLI after the result is flushed. The Zama
// WASM/relayer transport can retain background handles even after terminate(),
// so process.exitCode alone leaves Hardhat's Node runner alive in CI.
main().then(()=>{
  process.stdout.write('',()=>process.exit(0));
}).catch(error=>{
  // Never print raw RPC errors: they can embed credential-bearing URLs.
  const label='GAMBIT_SQUAD_SDK_READONLY_FAILED '+
    (error instanceof Error?error.name:'UnknownError')+'\n';
  process.stderr.write(label,()=>process.exit(1));
});
