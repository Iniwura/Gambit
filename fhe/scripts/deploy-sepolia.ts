import {ethers,network} from 'hardhat';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Testnet-only. Never accepts a known seed phrase or publishes private keys. */
async function main(){
  const actual=(await ethers.provider.getNetwork()).chainId;
  if(network.name!=='sepolia'||actual!==11155111n){
    throw new Error('Refusing deployment: required --network sepolia (chain 11155111)');
  }
  const signers=await ethers.getSigners();
  if(signers.length===0)throw new Error(
    'No Sepolia signer configured. Set private MNEMONIC in Hardhat vars, not in the repository.'
  );
  const wallet=signers[0];
  const balance=await ethers.provider.getBalance(wallet.address);
  if(balance===0n)throw new Error('Signer has no Sepolia test ETH. Deployment not attempted.');
  const factory=await ethers.getContractFactory('SealedGambit',wallet);
  const draft=await factory.getDeployTransaction();
  if(!draft.data)throw Error('Compiled contract deployment bytecode missing');
  // Use the exact compiled creation calldata, account and current provider fee
  // quote. Never rely on an older read-only preflight's low gas price.
  const estimatedGas=await ethers.provider.estimateGas({from:wallet.address,data:draft.data,value:0n});
  const gasLimit=(estimatedGas*120n+99n)/100n; // 20% execution margin.
  const fee=await ethers.provider.getFeeData();
  const maxFeePerGas=fee.maxFeePerGas??fee.gasPrice;
  if(maxFeePerGas===null||maxFeePerGas<=0n)throw Error('No current gas-fee quote; no transaction sent');
  const maximumCost=gasLimit*maxFeePerGas;
  // Bound this ONE testnet deployment even if RPC fees spike.
  const MAX_TESTNET_DEPLOYMENT_FEE_WEI=500000000000000n; // 0.0005 Sepolia ETH
  if(maximumCost>balance)throw Error('Wallet balance cannot cover buffered maximum fee; no transaction sent');
  if(maximumCost>MAX_TESTNET_DEPLOYMENT_FEE_WEI)
    throw Error('Maximum quoted deployment fee exceeds 0.0005 Sepolia ETH test budget; no transaction sent');
  console.log('Sepolia deployment preflight',JSON.stringify({
    chainId:Number(actual),deployer:wallet.address,
    estimatedGas:estimatedGas.toString(),gasLimit:gasLimit.toString(),
    maxFeePerGasWei:maxFeePerGas.toString(),
    maximumCostWei:maximumCost.toString(),
    availableWei:balance.toString(),
    transactionSent:false
  }));
  const transactionOptions:Record<string,bigint>={gasLimit};
  if(fee.maxFeePerGas!==null&&fee.maxPriorityFeePerGas!==null){
    transactionOptions.maxFeePerGas=fee.maxFeePerGas;
    transactionOptions.maxPriorityFeePerGas=fee.maxPriorityFeePerGas;
  }else{transactionOptions.gasPrice=maxFeePerGas;}
  const contract=await factory.deploy(transactionOptions);
  const tx=contract.deploymentTransaction();
  if(!tx)throw Error('Deployment transaction missing');
  await contract.waitForDeployment();
  const address=await contract.getAddress();
  const receipt=await ethers.provider.getTransactionReceipt(tx.hash);
  if(!receipt||receipt.status!==1)throw Error('Deployment receipt unavailable or reverted');
  if((await ethers.provider.getCode(address))==='0x')throw Error('Missing deployed bytecode');
  const manifest={
    chainId:11155111,
    contract:'SealedGambit',
    address,
    deployer:wallet.address,
    transactionHash:tx.hash,
    blockNumber:Number(receipt.blockNumber),
    explorerUrl:`https://sepolia.etherscan.io/tx/${tx.hash}`,
    deployedAt:new Date().toISOString(),
    status:'deployed-not-yet-matched',
    note:'Deployment alone is NOT proof of an encrypted live match.'
  };
  const dir=resolve(process.cwd(),'deployments');
  await mkdir(dir,{recursive:true});
  const path=resolve(dir,'sepolia.json');
  await writeFile(path,JSON.stringify(manifest,null,2)+'\n',{flag:'w'});
  console.log(JSON.stringify(manifest,null,2));
}
main().catch(error=>{console.error('Deployment aborted:',error instanceof Error?error.message:String(error));process.exitCode=1;});
