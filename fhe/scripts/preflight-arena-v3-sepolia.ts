import {artifacts,ethers,network} from 'hardhat';
import {formatEther,keccak256,getAddress} from 'ethers';

/** No signer, keys, deployment or write. EVM quote only, not live FHE HCU. */
async function main(){
  const provider=ethers.provider;
  if(network.name!=='sepolia'||(await provider.getNetwork()).chainId!==11155111n)
    throw Error('Sepolia only');
  const artifact=await artifacts.readArtifact('ArenaV3Research');
  if(artifact.contractName!=='ArenaV3Research'||artifact.bytecode==='0x')
    throw Error('Missing compiled v3 candidate');
  const iface=new ethers.Interface(artifact.abi);
  for(const name of ['sealRound','resolveRound','finalizeRound','expireIncomplete']){
    const fn=iface.getFunction(name);
    if(fn?.inputs[1]?.name!=='expectedRound'||fn.inputs[1].type!=='uint8')
      throw Error('Refusing obsolete round-unbound ABI');
  }
  // Previously published deployer address, not a credential or private key.
  const from=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
  const transactionGasCap=16_777_216n; // EIP-7825, active on Sepolia.
  const request={from,data:artifact.bytecode,value:0n,gasLimit:transactionGasCap};
  const latest=await provider.getBlock('latest'),fees=await provider.getFeeData();
  let primary:bigint|null=null,independent:bigint|null=null;
  try{primary=await provider.estimateGas(request);}catch{/* Unknown, never guess. */}
  try{
    const response=await fetch('https://sepolia.drpc.org',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_estimateGas',
        params:[{from,data:artifact.bytecode,value:'0x0',gas:'0x1000000'}]}),
      signal:AbortSignal.timeout(15000)
    });
    if(response.ok){
      const json=await response.json() as {result?:string};
      if(typeof json.result==='string'&&/^0x[0-9a-f]+$/i.test(json.result))
        independent=BigInt(json.result);
    }
  }catch{/* No fabricated fallback. */}
  const maxFee=fees.maxFeePerGas,priority=fees.maxPriorityFeePerGas;
  const maxEstimate=primary!==null&&independent!==null?
    (primary>independent?primary:independent):null;
  const agreement=primary!==null&&independent!==null&&primary>0n&&independent>0n&&
    primary<=independent*2n&&independent<=primary*2n;
  const buffered=maxEstimate===null?null:(maxEstimate*120n+99n)/100n;
  const bounded=agreement&&buffered!==null&&buffered<=transactionGasCap&&latest!==null&&buffered*100n<latest.gasLimit*90n&&
    maxFee!==null&&priority!==null&&maxFee>0n&&priority>=0n&&priority<=maxFee;
  const cap=bounded&&buffered!==null&&maxFee!==null?buffered*maxFee:null;
  console.log('GAMBIT_ARENA_V3_PUBLIC_PREFLIGHT '+JSON.stringify({
    scope:'READ ONLY — not deployment authorization',
    chainId:11155111,publicReferenceFrom:from,
    creationCodeHash:keccak256(artifact.bytecode),
    compiledRuntimeTemplateHash:keccak256(artifact.deployedBytecode),
    compiledRuntimeTemplateBytes:(artifact.deployedBytecode.length-2)/2,
    note:'Runtime template hash is NOT the deployed runtime fingerprint; verify actual deployed bytes separately.',
    observedBlock:latest?.number??null,
    eip7825TransactionGasCap:transactionGasCap.toString(),
    primaryEstimateAboveTransactionCap:primary!==null&&primary>transactionGasCap,
    independentEstimateAboveTransactionCap:independent!==null&&independent>transactionGasCap,
    bufferedEstimateAboveTransactionCap:buffered!==null&&buffered>transactionGasCap,
    primaryEstimate:primary?.toString()??null,
    independentEstimate:independent?.toString()??null,
    estimatesAgreeWithin2x:agreement,
    boundedDeploymentEvmQuote:bounded,
    bufferedGasLimit:bounded?buffered?.toString():null,
    maxFeePerGasWei:bounded?maxFee?.toString():null,
    maxPriorityFeePerGasWei:bounded?priority?.toString():null,
    maximumFeeWei:cap?.toString()??null,
    maximumFeeSepoliaETH:cap===null?null:formatEther(cap),
    liveHcuMeasured:false,liveDepthMeasured:false,
    transactionSent:false,signatureRequested:false,
    deployAuthorized:false
  }));
}
main().catch(e=>{
  console.error('GAMBIT_ARENA_V3_PUBLIC_PREFLIGHT_UNAVAILABLE',
    e instanceof Error?e.name:'Error');process.exitCode=1;
});
