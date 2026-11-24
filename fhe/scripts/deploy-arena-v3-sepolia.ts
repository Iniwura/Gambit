import {artifacts,ethers,network} from 'hardhat';
import {getAddress,getCreateAddress,keccak256,formatEther} from 'ethers';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

/**
 * Exact round-bound Arena candidate. DEFAULT is read-only. Run from fhe/.
 * Requires a locally controlled, configured Sepolia signer for a real deploy.
 * Never send a key or mnemonic to CI, a chat or the repository.
 *
 * A persistent local journal is written with exclusive creation BEFORE
 * dispatch. An existing journal stops subsequent deployment attempts,
 * including after a process crash or ambiguous provider response.
 * Use a separate read-only receipt recovery procedure if a hash is known.
 */
const CHAIN=11155111n;
const CREATION='0x9919bf4aa879e48f2f8116e516814402d117fe5c62a1fdd051aa66559671f727';
const RUNTIME='0xf4f31fff6b4ec7f90e573bba95362a49d43ffeb12d971f515cef6301afbde8a9';
const FROM=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const GAS=23_640_479n; // corroborated combined execution + state gas, NOT a protocol execution-gas cap
const FEE_LIMIT=1_000_000_000n; // emergency upper bound; explicit user budget must be <= this
const AUTH='YES_ONE_ARENA_V3_SEPOLIA_DEPLOYMENT';
const JOURNAL=resolve(process.cwd(),'.arena-v3-sepolia-deployment-attempt.json');
const MANIFEST=resolve(process.cwd(),'deployments/sepolia-arena-v3.json');
function approvedDecimal(name:string,allowZero=false){
  const value=process.env[name];
  const pattern=allowZero?/^[0-9]+$/:/^[1-9][0-9]*$/;
  if(!value||!pattern.test(value))throw Error(name+' required');
  return BigInt(value);
}

async function main(){
  const p=ethers.provider;
  if(network.name!=='sepolia'||(await p.getNetwork()).chainId!==CHAIN)
    throw Error('Wrong network');
  const a=await artifacts.readArtifact('ArenaV3Research');
  if(keccak256(a.bytecode)!==CREATION||keccak256(a.deployedBytecode)!==RUNTIME)
    throw Error('Exact reviewed candidate changed; fresh review required');
  const head=await p.getBlock('latest');
  if(!head||!head.hash||head.gasLimit<GAS)throw Error('Cannot establish current block capacity');
  const request={from:FROM,data:a.bytecode,value:0n,gasLimit:GAS};
  const estimate=await p.estimateGas(request);
  if(estimate<=0n||estimate>GAS)throw Error('Fresh estimate exceeds reviewed gas limit');
  const simulated=await p.call({...request,blockTag:head.number});
  if(keccak256(simulated)!==RUNTIME)throw Error('Fresh constructor simulation runtime mismatch');
  if((await p.getBlock(head.number))?.hash!==head.hash)throw Error('Reference block changed');
  const fees=await p.getFeeData(),maxFee=fees.maxFeePerGas,priority=fees.maxPriorityFeePerGas;
  if(maxFee===null||priority===null||maxFee<=0n||priority<0n||priority>maxFee)
    throw Error('No valid EIP-1559 quote');
  const maximum=GAS*maxFee;
  const balance=await p.getBalance(FROM);
  const nonce=await p.getTransactionCount(FROM,'pending');
  console.log('ARENA_V3_DEPLOY_READONLY '+JSON.stringify({
    chainId:Number(CHAIN),from:FROM,creationCodeHash:CREATION,expectedRuntimeHash:RUNTIME,
    estimatedTotalGas:estimate.toString(),gasLimit:GAS.toString(),
    maxFeePerGasWei:maxFee.toString(),maxPriorityFeePerGasWei:priority.toString(),
    maximumFeeWei:maximum.toString(),maximumFeeSepoliaETH:formatEther(maximum),
    balanceSufficient:balance>=maximum,nonce,transactionSent:false
  }));
  if(process.env.GAMBIT_APPROVE_ARENA_V3_DEPLOY!==AUTH)return;
  const approved=process.env.GAMBIT_MAX_ARENA_V3_DEPLOY_FEE_WEI;
  if(!approved||!/^[1-9][0-9]*$/.test(approved))throw Error('Exact user fee budget required');
  const budget=BigInt(approved);
  const approvedNonce=approvedDecimal('GAMBIT_EXPECTED_ARENA_V3_DEPLOY_NONCE');
  const approvedMaxFee=approvedDecimal('GAMBIT_EXPECTED_ARENA_V3_DEPLOY_MAX_FEE_PER_GAS_WEI');
  const approvedPriority=approvedDecimal('GAMBIT_EXPECTED_ARENA_V3_DEPLOY_PRIORITY_FEE_PER_GAS_WEI',true);
  if(budget>FEE_LIMIT||maximum>budget||maximum>balance)throw Error('Fee/balance authorization exceeded');
  if(maxFee!==approvedMaxFee||priority!==approvedPriority)
    throw Error('Approved fee quote changed');
  const expected=process.env.GAMBIT_EXPECTED_ARENA_V3_DEPLOYER;
  if(!expected||getAddress(expected)!==FROM)throw Error('Exact approved deployer required');
  const [signer]=await ethers.getSigners();
  if(!signer||getAddress(await signer.getAddress())!==FROM)throw Error('Approved local signer unavailable');
  if(BigInt(nonce)!==approvedNonce)throw Error('Approved nonce changed');
  const freshPending=await p.getTransactionCount(FROM,'pending');
  const freshLatest=await p.getTransactionCount(FROM,'latest');
  const freshFees=await p.getFeeData();
  if(BigInt(freshPending)!==approvedNonce||BigInt(freshLatest)!==approvedNonce||
    freshFees.maxFeePerGas!==approvedMaxFee||freshFees.maxPriorityFeePerGas!==approvedPriority)
    throw Error('Approved account or fee state changed before dispatch');
  const predicted=getCreateAddress({from:FROM,nonce});
  if((await p.getTransactionCount(FROM,'pending'))!==nonce||
    (await p.getTransactionCount(FROM,'latest'))!==nonce||
    (await p.getNetwork()).chainId!==CHAIN||
    await p.getCode(predicted)!=='0x')throw Error('Account/nonce/chain changed or pending transactions exist');
  // Refuse if this local checkout has already recorded a deployment.
  try{await readFile(MANIFEST);throw Error('Deployment manifest already exists');}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const record={state:'DISPATCH_RESERVED',chainId:Number(CHAIN),from:FROM,nonce,
    creationCodeHash:CREATION,expectedRuntimeHash:RUNTIME,predicted,
    maximumFeeWei:maximum.toString(),approvedBudgetWei:budget.toString()};
  await writeFile(JOURNAL,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  // One send ONLY. After this point any failure is uncertain: keep journal.
  const sent=await signer.sendTransaction({chainId:CHAIN,type:2,nonce,
    data:a.bytecode,value:0n,gasLimit:GAS,maxFeePerGas:maxFee,maxPriorityFeePerGas:priority});
  const dispatched={...record,state:'HASH_RECEIVED',transactionHash:sent.hash};
  await writeFile(JOURNAL,JSON.stringify(dispatched,null,2)+'\n',{mode:0o600});
  console.log('ARENA_V3_DEPLOY_HASH '+sent.hash);
  const receipt=await sent.wait(3);
  if(!receipt||receipt.status!==1||receipt.contractAddress===null||
    getAddress(receipt.contractAddress)!==predicted||
    receipt.gasUsed*receipt.gasPrice>budget||
    (await p.getBlock(receipt.blockNumber))?.hash!==receipt.blockHash)
    throw Error('Receipt not yet verified; reconcile hash without retry');
  const runtime=await p.getCode(predicted,receipt.blockNumber);
  if(keccak256(runtime)!==RUNTIME||keccak256(await p.getCode(predicted))!==RUNTIME)
    throw Error('Deployed runtime does not match simulation');
  const manifest={contract:'ArenaV3Research',version:1,chainId:Number(CHAIN),
    address:predicted,runtimeHash:RUNTIME,creationCodeHash:CREATION,
    deployer:FROM,transactionHash:sent.hash,blockNumber:receipt.blockNumber,
    blockHash:receipt.blockHash,gasUsed:receipt.gasUsed.toString(),
    actualFeeWei:(receipt.gasUsed*receipt.gasPrice).toString(),
    status:'DEPLOYMENT_ONLY_LIVE_GAMEPLAY_UNVERIFIED'};
  await mkdir(resolve(process.cwd(),'deployments'),{recursive:true});
  await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  await writeFile(JOURNAL,JSON.stringify({...dispatched,state:'RECEIPT_VERIFIED'},null,2)+'\n',{mode:0o600});
  console.log('ARENA_V3_DEPLOYED '+JSON.stringify(manifest));
}
main().catch(e=>{
  // Never print credential-bearing provider exceptions. Do not retry.
  console.error('ARENA_V3_DEPLOY_STOPPED',e instanceof Error?e.name:'Error');
  process.exitCode=1;
});
