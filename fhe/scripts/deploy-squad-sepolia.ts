import {ethers,network} from 'hardhat';
import {formatEther,getAddress,keccak256} from 'ethers';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/**
 * This is a separate UNDEPLOYED SquadGambit release gate.
 * Default invocation is READ ONLY. No wallet is funded, connected or signed
 * by this script without explicit testnet-only flag + public signer match
 * + user-specified maximum fee that also fits a hard emergency ceiling.
 * Existing v1 SealedGambit is never modified.
 */
const CHAIN=11155111n;
const HARD_CEILING=2000000000000000n; // 0.002 Sepolia ETH: upper refusal cap
const AUTH='YES_SEPOLIA_SQUAD_DEPLOY_ONCE';

async function main(){
  const chain=(await ethers.provider.getNetwork()).chainId;
  if(network.name!=='sepolia'||chain!==CHAIN)
    throw Error('Squad deployment restricted to Ethereum Sepolia chain 11155111');
  const [signer]=await ethers.getSigners();
  if(!signer){
    console.log('SQUAD_DEPLOY_PREFLIGHT '+JSON.stringify({
      network:'Sepolia',chainId:Number(CHAIN),publicSigner:'NOT_CONFIGURED',transactionSent:false
    }));
    return;
  }
  const wallet=getAddress(await signer.getAddress());
  const factory=await ethers.getContractFactory('SquadGambit',signer);
  const payload=await factory.getDeployTransaction();
  if(!payload.data)throw Error('Compiled SquadGambit creation bytecode unavailable');
  const balance=await ethers.provider.getBalance(wallet);
  let estimated:bigint|null=null,maxFeePerGas:bigint|null=null,maxCost:bigint|null=null;
  try{
    estimated=await ethers.provider.estimateGas({from:wallet,data:payload.data,value:0n});
    const quote=await ethers.provider.getFeeData();
    maxFeePerGas=quote.maxFeePerGas??quote.gasPrice;
    if(maxFeePerGas&&maxFeePerGas>0n)
      maxCost=((estimated*120n+99n)/100n)*maxFeePerGas;
  }catch{
    // Missing estimation is NOT permission to deploy with a guessed gas cap.
  }
  console.log('SQUAD_DEPLOY_PREFLIGHT '+JSON.stringify({
    network:'Ethereum Sepolia',chainId:Number(chain),publicSigner:wallet,
    estimatedEvmGas:estimated?.toString()??null,
    maxQuotedCostWei:maxCost?.toString()??null,
    maxQuotedCostSepoliaETH:maxCost===null?null:formatEther(maxCost),
    walletBalanceSepoliaETH:formatEther(balance),
    HCU:'NOT MEASURED: separate Zama FHE per-transaction budget applies',
    transactionSent:false
  }));

  if(process.env.GAMBIT_APPROVE_SQUAD_DEPLOY!==AUTH){
    console.log('READ ONLY: separate explicit squad deployment approval not supplied.');
    return;
  }

  const expected=process.env.GAMBIT_EXPECTED_SQUAD_DEPLOYER;
  if(!expected||getAddress(expected)!==wallet)
    throw Error('Wrong squad deployer wallet; public expected signer mismatch');
  const allowance=process.env.GAMBIT_MAX_SQUAD_DEPLOY_FEE_WEI;
  if(!allowance||!/^[1-9][0-9]*$/.test(allowance))
    throw Error('Explicit maximum testnet deployment fee in wei is required');
  const cap=BigInt(allowance);
  if(cap>HARD_CEILING)
    throw Error('User budget exceeds hard 0.002 Sepolia ETH emergency ceiling');
  if(maxCost===null||!estimated||!maxFeePerGas||maxCost<=0n)
    throw Error('No fresh deployment gas quote: refusing transaction');
  if(maxCost>cap||maxCost>balance)
    throw Error('Buffered maximum gas fee exceeds approved budget or balance');

  // Recheck chain/signature identity immediately before the ONE deployment.
  if((await ethers.provider.getNetwork()).chainId!==CHAIN||
      getAddress(await signer.getAddress())!==wallet)
    throw Error('Network or account changed after preflight');
  const marginGas=(estimated*120n+99n)/100n;
  const freshQuote=await ethers.provider.getFeeData();
  const freshMaxPerGas=freshQuote.maxFeePerGas??freshQuote.gasPrice;
  if(!freshMaxPerGas||freshMaxPerGas<=0n)
    throw Error('No fresh transaction fee parameters before signing');
  const latestMax=marginGas*freshMaxPerGas;
  if(latestMax>cap||latestMax>balance||latestMax>HARD_CEILING)
    throw Error('Latest transaction fee exceeds explicit approval, wallet balance or hard ceiling');
  const txOptions:Record<string,bigint>={gasLimit:marginGas};
  if(freshQuote.maxFeePerGas!==null&&freshQuote.maxPriorityFeePerGas!==null){
    if(freshQuote.maxPriorityFeePerGas>freshQuote.maxFeePerGas)
      throw Error('Inconsistent EIP-1559 fee quote');
    txOptions.maxFeePerGas=freshQuote.maxFeePerGas;
    txOptions.maxPriorityFeePerGas=freshQuote.maxPriorityFeePerGas;
  }else{
    txOptions.gasPrice=freshMaxPerGas;
  }
  const transaction=await factory.deploy(txOptions);
  const tx=transaction.deploymentTransaction();
  if(!tx)throw Error('Deployment transaction missing');
  await transaction.waitForDeployment();
  const receipt=await ethers.provider.getTransactionReceipt(tx.hash);
  const address=getAddress(await transaction.getAddress());
  const runtime=await ethers.provider.getCode(address);
  if(!receipt||receipt.status!==1||runtime==='0x')
    throw Error('Squad deploy receipt or runtime verification failed');
  const manifest={
    chainId:11155111,contract:'SquadGambit',contractAddress:address,
    deployer:wallet,txHash:tx.hash,blockNumber:receipt.blockNumber,
    runtimeKeccak256:keccak256(runtime),
    runtimeBytes:(runtime.length-2)/2,
    actualGasUsed:receipt.gasUsed.toString(),
    approvedMaximumCostWei:cap.toString(),
    maximumQuotedTransactionCostWei:latestMax.toString(),
    explorer:'https://sepolia.etherscan.io/tx/'+tx.hash,
    testStatus:'DEPLOYED ONLY — no signed encrypted two-wallet match',
    note:'Do not claim testnet FHE viability until separate live 10-input and KMS proof validation'
  };
  await mkdir(resolve(process.cwd(),'deployments'),{recursive:true});
  await writeFile(resolve(process.cwd(),'deployments/sepolia-squad.json'),
    JSON.stringify(manifest,null,2)+'\n',{flag:'w'});
  console.log('SQUAD_DEPLOYED_SEPOLIA '+JSON.stringify(manifest));
}
main().catch(error=>{
  // Never output full RPC / provider details, private keys or proof material.
  console.error('Squad deployment stopped safely:',error instanceof Error?error.name:'Error');
  process.exitCode=1;
});
