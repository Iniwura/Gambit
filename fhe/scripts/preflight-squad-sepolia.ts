import {artifacts,ethers,network} from 'hardhat';
import {getAddress,formatEther} from 'ethers';

/**
 * Public-RPC-only quote for the UNDEPLOYED SquadGambit creation bytecode.
 * No getSigners(), no mnemonic, no wallet connection and NO transaction.
 * EVM gas fees are NOT Zama FHE Homomorphic Complexity Units (HCU).
 */
async function main(){
  const net=await ethers.provider.getNetwork();
  if(network.name!=='sepolia'||net.chainId!==11155111n)
    throw Error('Only read-only Ethereum Sepolia 11155111 is supported');
  const owner=getAddress(process.env.GAMBIT_PUBLIC_PREFLIGHT_FROM||
    '0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
  const artifact=await artifacts.readArtifact('SquadGambit');
  if(artifact.contractName!=='SquadGambit'||!artifact.bytecode.startsWith('0x'))
    throw Error('Squad candidate not compiled');
  const quote=await ethers.provider.getFeeData();
  const fee=quote.maxFeePerGas??quote.gasPrice;
  let estimated:bigint|null=null,estimateStatus='confirmed';
  try{
    estimated=await ethers.provider.estimateGas({
      from:owner,data:artifact.bytecode,value:0n
    });
  }catch{
    estimateStatus='unavailable (RPC/revert/balance); no fee assumption';
  }
  const buffered=estimated===null?null:(estimated*120n+99n)/100n;
  const feeCeiling=fee===null||buffered===null?null:fee*buffered;
  const result={
    scope:'UNSIGNED, PUBLIC-RPC ONLY, NO TESTNET WRITE',
    chainId:11155111,referenceFromPublicAddress:owner,
    creationBytes:(artifact.bytecode.length-2)/2,
    compiledRuntimeBytes:(artifact.deployedBytecode.length-2)/2,
    estimatedEvmGas:estimated?.toString()??null,
    estimateStatus,maxQuotedFeePerGasWei:fee?.toString()??null,
    bufferedMaximumFeeWei:feeCeiling?.toString()??null,
    bufferedMaximumFeeSepoliaETH:feeCeiling===null?null:formatEther(feeCeiling),
    ZamaHCU:'NOT MEASURED',transactionSent:false,
    warning:'EVM estimate is not proof of HCU budget, relayer compatibility, latency or affordability'
  };
  console.log('SQUAD_PUBLIC_SEPOLIA_PREFLIGHT '+JSON.stringify(result));
}
main().catch(error=>{
  // Do not print RPC URLs, request payloads, credentials or provider stacks.
  console.error('Read-only squad preflight unavailable:',error instanceof Error?error.name:'Error');
  process.exitCode=1;
});
