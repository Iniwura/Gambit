import {artifacts,ethers,network} from 'hardhat';
import {getAddress,getCreateAddress,keccak256,formatEther} from 'ethers';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

/**
 * One-shot Arena V4 research deployment guard. Run from fhe/ with the
 * reproducible LF checkout. The default path is read-only; the explicit
 * approval token is required for the single dispatch path.
 *
 * Never export wallet credentials. A journal is reserved before send and is
 * never cleared after an ambiguous provider failure; do not retry from it.
 */
const CHAIN=11155111n;
const SOURCE_COMMIT='a3a1df073a6881c8a08e74954b601b863f2b4969';
const CREATION='0x9e760de916b8e097c25ff79a7e6c103e79f1009b088f4883d1d20db45bd8b07c';
const RUNTIME='0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d';
const FROM=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const MAX_TOTAL_FEE=5_000_000_000_000_000n;
const GAS_MARGIN_BPS=12_000n;
const APPROVAL='YES_ONE_ARENA_V4_SEPOLIA_DEPLOYMENT';
const JOURNAL=resolve(process.cwd(),'.arena-v4-sepolia-deployment-attempt.json');
const MANIFEST=resolve(process.cwd(),'deployments/sepolia-arena-v4.json');
let stage='startup';
const ceilMargin=(estimate:bigint)=>(estimate*GAS_MARGIN_BPS+9_999n)/10_000n;
function check(ok:boolean,reason:string){if(!ok)throw Error(reason);}
function decimal(name:string,allowZero=false){
 const value=process.env[name];
 const pattern=allowZero?/^[0-9]+$/:/^[1-9][0-9]*$/;
 check(!!value&&pattern.test(value),name+' required');
 return BigInt(value!);
}
async function main(){
 stage='read-only';
 const p=ethers.provider;
 check(network.name==='sepolia'&&(await p.getNetwork()).chainId===CHAIN,'wrong network');
 const artifact=await artifacts.readArtifact('ArenaV4ConfidentialActivationResearch');
 check(keccak256(artifact.bytecode)===CREATION,'reviewed creation bytecode changed');
 check(keccak256(artifact.deployedBytecode)===RUNTIME,'reviewed runtime bytecode changed');
 check(artifact.bytecode!=='0x'&&artifact.deployedBytecode!=='0x','missing bytecode');
 const head=await p.getBlock('latest');
 check(!!head?.hash,'missing reference block');
 const request={from:FROM,data:artifact.bytecode,value:0n};
 const estimate=await p.estimateGas(request);
 check(estimate>0n,'empty gas estimate');
 const gasLimit=ceilMargin(estimate);
 check(gasLimit>estimate,'gas safety margin missing');
 check(gasLimit<=4_294_967_295n&&gasLimit<head!.gasLimit,'gas limit exceeds protocol/block capacity');
 const simulated=await p.call({...request,gasLimit,blockTag:head!.number});
 check(keccak256(simulated)===RUNTIME,'constructor simulation runtime changed');
 check((await p.getBlock(head!.number))?.hash===head!.hash,'reference block changed');
 const fees=await p.getFeeData();
 const maxFee=fees.maxFeePerGas,priority=fees.maxPriorityFeePerGas;
 check(maxFee!==null&&priority!==null&&maxFee>0n&&priority>=0n&&priority<=maxFee,'invalid EIP-1559 quote');
 const maximum=gasLimit*maxFee!;
 const balance=await p.getBalance(FROM);
 const nonce=await p.getTransactionCount(FROM,'pending');
 const confirmedNonce=await p.getTransactionCount(FROM,'latest');
 const predicted=getCreateAddress({from:FROM,nonce});
 const predictedEmpty=await p.getCode(predicted)==='0x';
 check(nonce===confirmedNonce,'pending transaction exists');
 check(predictedEmpty,'predicted deployment address occupied');
 console.log('ARENA_V4_DEPLOY_READONLY '+JSON.stringify({
  sourceCommit:SOURCE_COMMIT,chainId:Number(CHAIN),from:FROM,
  creationCodeHash:CREATION,expectedRuntimeHash:RUNTIME,
  estimatedGas:estimate.toString(),gasMarginBps:GAS_MARGIN_BPS.toString(),
  gasLimit:gasLimit.toString(),maxFeePerGasWei:maxFee!.toString(),
  maxPriorityFeePerGasWei:priority!.toString(),maximumFeeWei:maximum.toString(),
  maximumFeeSepoliaETH:formatEther(maximum),authorizedMaximumFeeWei:MAX_TOTAL_FEE.toString(),
  balanceWei:balance.toString(),balanceSufficient:balance>=maximum,
  nonce,confirmedNonce,predictedAddress:predicted,predictedEmpty,
  referenceBlock:head!.number,referenceBlockHash:head!.hash,transactionSent:false
 }));
 const authorization=process.env.GAMBIT_APPROVE_ARENA_V4_DEPLOY;
 if(process.env.CI||process.env.GITHUB_ACTIONS||authorization!==APPROVAL)return;
 stage='authorization';
 stage='budget';
 const budget=decimal('GAMBIT_MAX_ARENA_V4_DEPLOY_FEE_WEI');
 check(budget<=MAX_TOTAL_FEE,'approved fee budget exceeds hard ceiling');
 stage='deployer';
 const expected=process.env.GAMBIT_EXPECTED_ARENA_V4_DEPLOYER;
 check(!!expected&&getAddress(expected!)===FROM,'approved deployer mismatch');
 stage='nonce';
 const approvedNonce=decimal('GAMBIT_EXPECTED_ARENA_V4_DEPLOY_NONCE',true);
 check(BigInt(nonce)===approvedNonce,'approved nonce changed');
 const [signer]=await ethers.getSigners();
 stage='signer';
 check(!!signer&&getAddress(await signer.getAddress())===FROM,'approved local signer unavailable');
 // Fresh account, block, estimate and fee review immediately before the one send.
 stage='fresh-revalidation';
 const freshHead=await p.getBlock('latest');
 check(!!freshHead?.hash,'missing fresh reference block');
 const freshEstimate=await p.estimateGas(request);
 const freshGasLimit=ceilMargin(freshEstimate);
 const freshSimulated=await p.call({...request,gasLimit:freshGasLimit},freshHead!.number);
 check(keccak256(freshSimulated)===RUNTIME,'fresh constructor simulation runtime changed');
 const freshFees=await p.getFeeData();
 const dispatchMaxFee=freshFees.maxFeePerGas,dispatchPriority=freshFees.maxPriorityFeePerGas;
 check(dispatchMaxFee!==null&&dispatchPriority!==null&&dispatchMaxFee>0n&&dispatchPriority>=0n&&dispatchPriority<=dispatchMaxFee,'fresh EIP-1559 quote unavailable');
 const dispatchNonce=await p.getTransactionCount(FROM,'pending');
 const latestNonce=await p.getTransactionCount(FROM,'latest');
 const dispatchPredicted=getCreateAddress({from:FROM,nonce:dispatchNonce});
 check(BigInt(dispatchNonce)===approvedNonce&&BigInt(latestNonce)===approvedNonce,'fresh approved nonce changed');
 check(await p.getNetwork().then(n=>n.chainId===CHAIN),'fresh chain changed');
 check(await p.getCode(dispatchPredicted)==='0x','fresh predicted address occupied');
 const dispatchMaximum=freshGasLimit*dispatchMaxFee!;
 check(dispatchMaximum<=budget&&dispatchMaximum<=MAX_TOTAL_FEE,'fresh fee exceeds authorization');
 check(await p.getBalance(FROM)>=dispatchMaximum,'insufficient balance for authorized maximum');
 try{await readFile(MANIFEST);throw Error('V4 deployment manifest already exists');}
 catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const record={state:'DISPATCH_RESERVED',sourceCommit:SOURCE_COMMIT,chainId:Number(CHAIN),
  from:FROM,nonce:dispatchNonce,creationCodeHash:CREATION,expectedRuntimeHash:RUNTIME,
  predicted:dispatchPredicted,estimatedGas:freshEstimate.toString(),gasMarginBps:GAS_MARGIN_BPS.toString(),
  gasLimit:freshGasLimit.toString(),valueWei:'0',maxFeePerGasWei:dispatchMaxFee!.toString(),
  maxPriorityFeePerGasWei:dispatchPriority!.toString(),maximumFeeWei:dispatchMaximum.toString(),
  approvedBudgetWei:budget.toString()};
 stage='journal';
 await writeFile(JOURNAL,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
 // Exactly one send. Any failure after this line is uncertain and must not retry.
 stage='dispatch';
 const sent=await signer!.sendTransaction({chainId:CHAIN,type:2,nonce:dispatchNonce,
  data:artifact.bytecode,value:0n,gasLimit:freshGasLimit,
  maxFeePerGas:dispatchMaxFee!,maxPriorityFeePerGas:dispatchPriority!});
 await writeFile(JOURNAL,JSON.stringify({...record,state:'HASH_RECEIVED',transactionHash:sent.hash},null,2)+'\n',{mode:0o600});
 console.log('ARENA_V4_DEPLOY_HASH '+sent.hash);
 stage='receipt';
 const receipt=await sent.wait(3);
 check(!!receipt&&receipt.status===1,'receipt not verified; reconcile hash without retry');
 check(receipt!.contractAddress!==null&&getAddress(receipt!.contractAddress)===dispatchPredicted,'deployment address mismatch');
 const actual=receipt!.gasUsed*receipt!.gasPrice;
 check(actual<=dispatchMaximum&&actual<=budget,'actual fee exceeds authorization');
 check((await p.getBlock(receipt!.blockNumber))?.hash===receipt!.blockHash,'receipt block not canonical');
 const historical=await p.getCode(dispatchPredicted,receipt!.blockNumber);
 const current=await p.getCode(dispatchPredicted);
 check(keccak256(historical)===RUNTIME&&keccak256(current)===RUNTIME,'deployed runtime mismatch');
 const manifest={contract:'ArenaV4ConfidentialActivationResearch',version:1,sourceCommit:SOURCE_COMMIT,
  chainId:Number(CHAIN),address:dispatchPredicted,runtimeHash:RUNTIME,creationCodeHash:CREATION,
  deployer:FROM,transactionHash:sent.hash,blockNumber:receipt!.blockNumber,blockHash:receipt!.blockHash,
  estimatedGas:freshEstimate.toString(),gasLimit:freshGasLimit.toString(),gasUsed:receipt!.gasUsed.toString(),
  maxFeePerGasWei:dispatchMaxFee!.toString(),maxPriorityFeePerGasWei:dispatchPriority!.toString(),
  actualFeeWei:actual.toString(),valueWei:'0',status:'DEPLOYMENT_ONLY_LIVE_GAMEPLAY_UNVERIFIED'};
 await mkdir(resolve(process.cwd(),'deployments'),{recursive:true});
 await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await writeFile(JOURNAL,JSON.stringify({...record,state:'RECEIPT_VERIFIED',transactionHash:sent.hash,
  blockNumber:receipt!.blockNumber,blockHash:receipt!.blockHash,gasUsed:receipt!.gasUsed.toString(),actualFeeWei:actual.toString()},null,2)+'\n',{mode:0o600});
 console.log('ARENA_V4_DEPLOYED '+JSON.stringify(manifest));
}
main().catch(e=>{console.error('ARENA_V4_DEPLOY_STOPPED',stage,e instanceof Error?e.name:'Error');process.exitCode=1;});
