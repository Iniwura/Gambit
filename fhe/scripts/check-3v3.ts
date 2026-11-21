import {ethers,network} from 'hardhat';
import {formatEther} from 'ethers';

async function main(){
  const chain=await ethers.provider.getNetwork();
  if(network.name!=='sepolia'||chain.chainId!==11155111n)throw Error('Only Ethereum Sepolia (11155111) is allowed');
  const factory=await ethers.getContractFactory('EncryptedGambit3v3');
  const deployment=await factory.getDeployTransaction();
  if(!deployment.data)throw Error('Missing compiled 3v3 creation bytecode');
  const from='0x0000000000000000000000000000000000000001';
  const gas=await ethers.provider.estimateGas({from,data:deployment.data,value:0n});
  const fee=await ethers.provider.getFeeData();
  const maxFee=fee.maxFeePerGas??fee.gasPrice??null;
  const quoted=maxFee===null?null:gas*maxFee;
  console.log(JSON.stringify({
    network:'Ethereum Sepolia',chainId:Number(chain.chainId),contract:'EncryptedGambit3v3',
    creationBytecodeBytes:(deployment.data.length-2)/2,
    estimatedGas:gas.toString(),maxFeePerGasWei:maxFee?.toString()??null,
    estimatedMaxFeeInSepoliaETH:quoted===null?null:formatEther(quoted),
    transactionSent:false
  },null,2));
}
main().catch(error=>{console.error('3v3 preflight stopped:',error instanceof Error?error.name:'UnknownError');process.exitCode=1;});
