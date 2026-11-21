import { ethers, network } from 'hardhat';
import { ZamaSDK, memoryStorage } from '@zama-fhe/sdk';
import { createConfig } from '@zama-fhe/sdk/ethers';
import { node } from '@zama-fhe/sdk/node';
import { sepolia } from '@zama-fhe/sdk/chains';
import { VoidSigner, getAddress, keccak256, ZeroAddress, formatEther } from 'ethers';
import deployment from '../deployments/sepolia-squad.json';

/**
 * UNSIGNED FHE seal gas/fee quotation for one prospective SquadGambit duel.
 *  - never accesses a mnemonic, wallet, balances or private strategy inputs
 *  - uses VoidSigner and PUBLIC synthetic ten-input tactical data
 *  - never creates a transaction or signature
 *  - never prints raw ciphertext handles, proofs or RPC URLs
 *  - a quote is time-sensitive and NOT authorization to broadcast anything
 */
const CHAIN_ID = 11155111n;
const MAX_SEAL_FEE_WEI = 500000000000000n; // existing separate signer's hard cap
const SYNTHETIC_SQUAD = [0n,1n,2n,1n,0n,2n,2n,1n,0n,1n] as const;

async function main(){
  if(process.env.GAMBIT_APPROVE_ONE_SQUAD_SEAL){
    throw Error('Remove transaction approval flags before running the UNSIGNED quote');
  }
  const networkInfo = await ethers.provider.getNetwork();
  if(network.name!=='sepolia'||networkInfo.chainId!==CHAIN_ID){
    throw Error('Unsigned squad quote supports only Sepolia (11155111)');
  }
  if(deployment.chainId!==Number(CHAIN_ID)||deployment.contract!=='SquadGambit'){
    throw Error('Expected the exact deployed v2 contract manifest');
  }

  const challengerRaw=process.env.GAMBIT_SQUAD_CHALLENGER_ADDRESS;
  if(!challengerRaw)throw Error('Set GAMBIT_SQUAD_CHALLENGER_ADDRESS to the public invited wallet');
  const challenger=getAddress(challengerRaw);
  const owner=getAddress(deployment.deployer);
  if(challenger===owner||challenger===ZeroAddress)
    throw Error('Challenger must be a distinct, nonzero public wallet');

  const contractAddress=getAddress(deployment.contractAddress);
  const bytecode=await ethers.provider.getCode(contractAddress);
  if(bytecode==='0x'||
     (bytecode.length-2)/2!==deployment.runtimeBytes||
     keccak256(bytecode).toLowerCase()!==deployment.runtimeKeccak256.toLowerCase()){
    throw Error('SquadGambit deployed runtime does not match the pinned manifest');
  }

  const contract:any=await ethers.getContractAt('SquadGambit',contractAddress);
  const beforeSquadId=BigInt(await contract.nextSquadId());
  const beforeDuelId=BigInt(await contract.nextDuelId());

  // VoidSigner has no signing implementation and no stored wallet credentials.
  const signer=new VoidSigner(owner,ethers.provider);
  const rpc=(network.config as {url?:string}).url??
    'https://ethereum-sepolia-rpc.publicnode.com';
  const chain={...sepolia,network:rpc};
  const sdk=new ZamaSDK(createConfig({
    chains:[chain],signer,storage:memoryStorage,
    relayers:{[chain.id]:node({timeout:180000})}
  }));

  const started=Date.now();
  try{
    const encrypted=await sdk.encrypt({
      contractAddress:contractAddress as `0x${string}`,
      userAddress:owner as `0x${string}`,
      values:SYNTHETIC_SQUAD.map(value=>({type:'euint8' as const,value}))
    });
    if(encrypted.encryptedValues.length!==10||
       typeof encrypted.inputProof!=='string'||
       encrypted.inputProof.length<10){
      throw Error('SDK did not provide the ten encrypted inputs and proof');
    }

    const txData=contract.interface.encodeFunctionData('sealSquad',[
      challenger,encrypted.encryptedValues,encrypted.inputProof
    ]);
    const gasEstimate=await ethers.provider.estimateGas({
      from:owner,to:contractAddress,data:txData,value:0n
    });
    if(gasEstimate<=0n)throw Error('Public RPC could not estimate the exact sealed call');
    const bufferedGasLimit=(gasEstimate*120n+99n)/100n;
    const fees=await ethers.provider.getFeeData();
    const maximumFeePerGas=fees.maxFeePerGas??fees.gasPrice;
    if(!maximumFeePerGas||maximumFeePerGas<=0n)
      throw Error('Fresh Sepolia gas fee quote was unavailable');
    const quotedMaximumFeeWei=bufferedGasLimit*maximumFeePerGas;

    const afterSquadId=BigInt(await contract.nextSquadId());
    const afterDuelId=BigInt(await contract.nextDuelId());
    if(afterSquadId!==beforeSquadId||afterDuelId!==beforeDuelId||
       (await ethers.provider.getNetwork()).chainId!==CHAIN_ID||
       keccak256(await ethers.provider.getCode(contractAddress)).toLowerCase()!==
         deployment.runtimeKeccak256.toLowerCase()){
      throw Error('Chain state or runtime changed during unsigned estimation');
    }

    console.log('GAMBIT_SQUAD_UNSIGNED_QUOTE '+JSON.stringify({
      scope:'TEN PUBLIC SYNTHETIC INPUTS; VOID SIGNER; ESTIMATE ONLY',
      chainId:Number(CHAIN_ID),contract:contractAddress,
      owner,challenger,
      nextSquadId:(beforeSquadId+1n).toString(),
      nextDuelId:(beforeDuelId+1n).toString(),
      encryptedInputCount:encrypted.encryptedValues.length,
      gasEstimate:gasEstimate.toString(),
      bufferedGasLimit:bufferedGasLimit.toString(),
      quotedMaximumFeePerGasWei:maximumFeePerGas.toString(),
      quotedMaximumFeeWei:quotedMaximumFeeWei.toString(),
      quotedMaximumFeeSepoliaETH:formatEther(quotedMaximumFeeWei),
      underScriptHardCap:quotedMaximumFeeWei<=MAX_SEAL_FEE_WEI,
      scriptHardCapWei:MAX_SEAL_FEE_WEI.toString(),
      sdkEncryptionLatencyMs:Date.now()-started,
      liveHcu:'NOT MEASURED',
      balancesChecked:false,transactionSigned:false,transactionSent:false,
      caveat:'Indicative only; signed ciphertext inputs, gas and network fees must be freshly rechecked before user-approved submission'
    }));
  }finally{
    sdk.terminate();
  }
}

// The live Zama transport may retain background WASM threads after cleanup.
main().then(()=>process.stdout.write('',()=>process.exit(0)))
  .catch(error=>{
    // Never expose provider details, RPC URLs, ciphertexts or credentials.
    process.stderr.write('GAMBIT_SQUAD_UNSIGNED_QUOTE_STOPPED '+
      (error instanceof Error?error.name:'UnknownError')+'\n',
      ()=>process.exit(1));
  });
