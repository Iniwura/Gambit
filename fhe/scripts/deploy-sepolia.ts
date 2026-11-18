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
  console.log('Deploying SealedGambit on Sepolia from',wallet.address,'balanceWei',balance.toString());
  const factory=await ethers.getContractFactory('SealedGambit',wallet);
  const contract=await factory.deploy();
  const tx=contract.deploymentTransaction();
  if(!tx)throw Error('Deployment transaction missing');
  await contract.waitForDeployment();
  const address=await contract.getAddress();
  const receipt=await ethers.provider.getTransactionReceipt(tx.hash);
  if(!receipt||receipt.status!==1n&&receipt.status!==1)throw Error('Deployment receipt unavailable or reverted');
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
