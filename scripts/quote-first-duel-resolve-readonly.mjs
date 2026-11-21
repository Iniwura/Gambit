/**
 * Read-only live gas preflight for resolving an already-submitted Duel #1.
 * Public network RPC only: no signer, wallet access, broadcasts or decryption.
 * This is not a user transaction authorization or proof of real FHE HCU.
 */
import {Interface,JsonRpcProvider,formatEther} from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FIRST_SUBMIT,verifyFirstSubmission}
  from './verify-first-duel-submit-readonly.mjs';

export async function quoteFirstResolve(provider,manifest){
  const verified=await verifyFirstSubmission(provider,manifest);
  if(verified.next!=='READY_TO_RESOLVE')
    return {state:verified.next,quoted:false,signatureMade:false,transactionSent:false};
  const contract=manifest.contractAddress;
  const iface=new Interface(['function resolveDuel(uint256 duelId)']);
  const calldata=iface.encodeFunctionData('resolveDuel',[FIRST_SUBMIT.duelId]);
  const latest=await provider.getBlock('latest');
  if(!latest)throw Error('Cannot get latest Sepolia block');
  const started=Date.now();
  const estimated=await provider.estimateGas({
    from:FIRST_SUBMIT.challenger,to:contract,data:calldata,value:0n
  });
  if(estimated<=0n)throw Error('Invalid live EVM gas estimate');
  const fees=await provider.getFeeData();
  const price=fees.maxFeePerGas??fees.gasPrice;
  if(!price||price<=0n)throw Error('No live Sepolia fee quote');
  const gasLimit=(estimated*120n+99n)/100n;
  const maximumFee=gasLimit*price;
  const after=await verifyFirstSubmission(provider,manifest);
  if(after.next!=='READY_TO_RESOLVE')
    throw Error('Duel state changed while quoting; no signing authorized');
  return {
    scope:'READ-ONLY CONTRACT GAS QUOTE; LIVE FHE HCU NOT MEASURED',
    chainId:11155111,contractAddress:contract,
    challenger:FIRST_SUBMIT.challenger,duelId:'1',
    latestBlock:latest.number,estimatedGas:estimated.toString(),
    bufferedGasLimit:gasLimit.toString(),
    maxFeePerGasWei:price.toString(),
    maximumQuotedFeeWei:maximumFee.toString(),
    maximumQuotedFeeSepoliaEth:formatEther(maximumFee),
    quoteLatencyMs:Date.now()-started,
    stateBefore:verified.next,stateAfter:after.next,
    authorization:'NONE; requires NEW explicit consent for one resolveDuel(1)',
    walletConnected:false,signatureMade:false,transactionSent:false
  };
}

async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'
  ));
  const provider=new JsonRpcProvider(
    process.env.GAMBIT_SEPOLIA_RPC_READONLY||'https://ethereum-sepolia-rpc.publicnode.com',
    11155111,{staticNetwork:true}
  );
  try{
    console.log('GAMBIT_DUEL1_RESOLVE_UNSIGNED_QUOTE '+JSON.stringify(
      await quoteFirstResolve(provider,manifest)
    ));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    console.error('GAMBIT_DUEL1_RESOLVE_UNSIGNED_QUOTE_STOPPED '+
      (error instanceof Error?error.name:'UnknownError'));
    process.exitCode=1;
  });
