/**
 * GAMBIT live v2 inspection, entirely public and read-only.
 * No signer, private key, wallet connection, FHE input, or transaction.
 * Throws on ANY disagreement between immutable deploy evidence and public RPC.
 */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {JsonRpcProvider, Interface, formatEther, getAddress, keccak256} from 'ethers';

const ABI=new Interface([
  'function nextSquadId() view returns (uint256)',
  'function nextDuelId() view returns (uint256)'
]);
const CHAIN=11155111n;

function requireMatch(actual,expected,label){
  if(String(actual).toLowerCase()!==String(expected).toLowerCase())
    throw Error(label+' mismatches the approved SquadGambit deployment manifest.');
}

export async function verifySquadLiveReadOnly(provider,manifest){
  if(manifest?.contract!=='SquadGambit'||manifest.chainId!==Number(CHAIN))
    throw Error('Unexpected SquadGambit deployment manifest/chain.');
  const address=getAddress(manifest.contractAddress);
  const deployer=getAddress(manifest.deployer);
  if(!/^0x[a-fA-F0-9]{64}$/.test(manifest.txHash)||
     !/^0x[a-fA-F0-9]{64}$/.test(manifest.runtimeKeccak256))
    throw Error('Invalid public deployment evidence.');

  const reportedChain=await provider.send('eth_chainId',[]);
  if(typeof reportedChain!=='string'||BigInt(reportedChain)!==CHAIN)
    throw Error('Read-only RPC is not Ethereum Sepolia 11155111.');

  const [transaction,receipt,code]=await Promise.all([
    provider.getTransaction(manifest.txHash),
    provider.getTransactionReceipt(manifest.txHash),
    provider.getCode(address)
  ]);
  if(!transaction||!receipt||code==='0x'||!code)
    throw Error('Sepolia transaction, receipt, or runtime bytecode is unavailable.');
  if(transaction.to!==null||receipt.to!==null||receipt.status!==1)
    throw Error('Deployment transaction was not a successful contract creation.');
  requireMatch(transaction.hash,manifest.txHash,'Deployment tx hash');
  requireMatch(transaction.from,deployer,'Transaction sender');
  requireMatch(receipt.from,deployer,'Receipt sender');
  requireMatch(receipt.contractAddress,address,'Created contract');
  if(receipt.blockNumber!==manifest.blockNumber)
    throw Error('Deployment receipt block differs from manifest.');
  if(receipt.gasUsed.toString()!==manifest.actualGasUsed)
    throw Error('Deployment receipt gas differs from manifest.');
  const actualBytes=(code.length-2)/2;
  if(actualBytes!==manifest.runtimeBytes)
    throw Error('Deployed runtime length differs from manifest.');
  const actualHash=keccak256(code);
  requireMatch(actualHash,manifest.runtimeKeccak256,'Deployed runtime hash');

  const counterCall=async name=>{
    const result=await provider.call({to:address,data:ABI.encodeFunctionData(name,[])});
    const decoded=ABI.decodeFunctionResult(name,result);
    return BigInt(decoded[0]);
  };
  const [squadCount,duelCount]=await Promise.all([
    counterCall('nextSquadId'),counterCall('nextDuelId')
  ]);

  const feeWei=receipt.gasPrice===null||receipt.gasPrice===undefined
    ?null:receipt.gasUsed*receipt.gasPrice;
  return {
    scope:'UNSIGNED READ-ONLY PUBLIC-RPC; NO WALLET / NO TRANSACTION',
    network:'Ethereum Sepolia',chainId:Number(CHAIN),
    contract:'SquadGambit',contractAddress:address,publicDeployer:deployer,
    deploymentTx:manifest.txHash,blockNumber:receipt.blockNumber,
    runtimeBytes:actualBytes,runtimeKeccak256:actualHash,
    gasUsed:receipt.gasUsed.toString(),
    actualDeploymentFeeWei:feeWei?.toString()??null,
    actualDeploymentFeeSepoliaETH:feeWei===null?null:formatEther(feeWei),
    nextSquadId:squadCount.toString(),nextDuelId:duelCount.toString(),
    noEncryptedMatchProven:true,liveHcuMeasured:false,transactionSent:false
  };
}

async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  // Public RPC only. Optional private provider URL may be supplied by operator,
  // but is NEVER included in output, errors, repository, or test evidence.
  const rpc=process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com';
  const provider=new JsonRpcProvider(rpc);
  try{
    console.log('SQUAD_LIVE_READONLY '+JSON.stringify(
      await verifySquadLiveReadOnly(provider,manifest)));
  }finally{provider.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    console.error('SQUAD_LIVE_READONLY_FAILED '+(error instanceof Error?error.message:'Unknown error'));
    process.exitCode=1;
  });
}
