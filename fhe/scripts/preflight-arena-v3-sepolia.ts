import {artifacts,ethers,network} from 'hardhat';
import {formatEther,keccak256,getAddress,toQuantity} from 'ethers';

/** Public RPC only. No signer, keys, deployment, transaction or state override.
 * Simulate the exact constructor at one canonical block on independent
 * endpoints; a successful simulation is NOT deployment or live FHE proof.
 */
const CAP=16_777_216n; // Sepolia EIP-7825
const TEST_GAS=6_000_000n;
const ENDPOINTS=[
  {name:'PublicNode',url:'https://ethereum-sepolia-rpc.publicnode.com'},
  {name:'Tenderly',url:'https://gateway.tenderly.co/public/sepolia'},
  {name:'ethPandaOps',url:'https://rpc.sepolia.ethpandaops.io'}
] as const;
type Reply={result?:unknown,errorCode?:number,httpStatus?:number,transport?:boolean};
async function rpc(url:string,method:string,params:unknown[]):Promise<Reply>{
  try{
    const response=await fetch(url,{method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
      signal:AbortSignal.timeout(12000)});
    if(!response.ok)return {httpStatus:response.status};
    const json=await response.json() as {result?:unknown,error?:{code?:number}};
    if(json.error)return {errorCode:json.error.code};
    return {result:json.result};
  }catch{return {transport:true};}
}
const quantity=(v:unknown):bigint|null=>
  typeof v==='string'&&/^0x[0-9a-f]+$/i.test(v)?BigInt(v):null;
function blockHash(result:unknown):string|null{
  if(result&&typeof result==='object'&&'hash' in result&&typeof result.hash==='string')
    return result.hash.toLowerCase();
  return null;
}
function outcome(reply:Reply){
  return reply.errorCode!==undefined?'rpc_error_'+reply.errorCode:
    reply.httpStatus!==undefined?'http_'+reply.httpStatus:
    reply.transport?'transport_error':reply.result!==undefined?'result':'unavailable';
}
async function main(){
  const provider=ethers.provider;
  if(network.name!=='sepolia'||(await provider.getNetwork()).chainId!==11155111n)
    throw Error('Sepolia only');
  const artifact=await artifacts.readArtifact('ArenaV3Research');
  if(artifact.contractName!=='ArenaV3Research'||artifact.bytecode==='0x'||artifact.deployedBytecode==='0x')
    throw Error('Missing compiled v3 candidate');
  const iface=new ethers.Interface(artifact.abi);
  for(const name of ['sealRound','resolveRound','finalizeRound','expireIncomplete']){
    const fn=iface.getFunction(name);
    if(fn?.inputs[1]?.name!=='expectedRound'||fn.inputs[1].type!=='uint8')
      throw Error('Refusing obsolete round-unbound ABI');
  }
  const from=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
  const latest=await provider.getBlock('latest');
  if(!latest||latest.number<3)throw Error('Missing reference head');
  // Small lag allows independent providers to reach the same block.
  const reference=await provider.getBlock(latest.number-2);
  if(!reference||!reference.hash)throw Error('Missing reference block');
  const tag=toQuantity(reference.number),expectedHash=reference.hash.toLowerCase();
  const fees=await provider.getFeeData();
  const runtime=artifact.deployedBytecode.toLowerCase();
  const checks=await Promise.all(ENDPOINTS.map(async endpoint=>{
    const {name,url}=endpoint;
    const [chain,block]=await Promise.all([
      rpc(url,'eth_chainId',[]),rpc(url,'eth_getBlockByNumber',[tag,false])
    ]);
    const matched=quantity(chain.result)===11155111n&&blockHash(block.result)===expectedHash;
    if(!matched)return {name,matched:false,blockStatus:outcome(block),
      estimate:null,estimateStatus:'not checked',simulationStatus:'not checked',
      controlStatus:'not checked',runtimeMatch:false,returnedRuntimeHash:null,
      blockStillCanonical:false};
    const tx={from,data:artifact.bytecode,value:'0x0',gas:toQuantity(TEST_GAS)};
    // A tiny constructor returning one STOP opcode tests whether this
    // endpoint supports contract-creation eth_call at the chosen block.
    const control={from,data:'0x6001600c60003960016000f300',value:'0x0',gas:'0x100000'};
    const [estimate,sim,baseline]=await Promise.all([
      rpc(url,'eth_estimateGas',[{...tx,gas:toQuantity(CAP)},tag]),
      rpc(url,'eth_call',[tx,tag]),
      rpc(url,'eth_call',[control,tag])
    ]);
    const returned=typeof sim.result==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(sim.result)?
      sim.result.toLowerCase():null;
    const rechecked=await rpc(url,'eth_getBlockByNumber',[tag,false]);
    const canonical=blockHash(rechecked.result)===expectedHash;
    return {name,matched:true,blockStatus:outcome(block),
      estimate:quantity(estimate.result)?.toString()??null,
      estimateStatus:outcome(estimate),simulationStatus:outcome(sim),
      controlStatus:baseline.result==='0x00'?'expected_runtime':outcome(baseline),
      runtimeMatch:canonical&&returned===runtime,
      returnedRuntimeHash:returned?keccak256(returned):null,
      blockStillCanonical:canonical};
  }));
  const trusted=checks.filter(x=>x.matched&&x.blockStillCanonical&&x.runtimeMatch&&
    x.controlStatus==='expected_runtime');
  const usable=trusted.map(x=>x.estimate===null?null:BigInt(x.estimate))
    .filter((x):x is bigint=>x!==null&&x>0n&&x<=TEST_GAS);
  const largest=usable.length?usable.reduce((a,b)=>a>b?a:b):null;
  const smallest=usable.length?usable.reduce((a,b)=>a<b?a:b):null;
  const agrees=usable.length>=2&&largest!==null&&smallest!==null&&largest<=smallest*2n;
  const buffered=largest===null?null:(largest*120n+99n)/100n;
  const maxFee=fees.maxFeePerGas,priority=fees.maxPriorityFeePerGas;
  const again=await provider.getBlock(reference.number);
  const canonical=again?.hash?.toLowerCase()===expectedHash;
  // Exact runtime equality is deliberately strict. If compiled immutables
  // are patched by the constructor, treat mismatch as unresolved and
  // investigate build-info references rather than silently stripping bytes.
  const bounded=canonical&&trusted.length>=2&&agrees&&buffered!==null&&
    buffered<=TEST_GAS&&buffered<=CAP&&buffered*100n<reference.gasLimit*90n&&
    maxFee!==null&&priority!==null&&maxFee>0n&&priority>=0n&&priority<=maxFee;
  const cap=bounded&&buffered!==null&&maxFee!==null?buffered*maxFee:null;
  console.log('GAMBIT_ARENA_V3_PUBLIC_PREFLIGHT '+JSON.stringify({
    scope:'READ ONLY — no deployment authorization',
    chainId:11155111,publicReferenceFrom:from,
    creationCodeHash:keccak256(artifact.bytecode),
    compiledRuntimeTemplateHash:keccak256(artifact.deployedBytecode),
    compiledRuntimeTemplateBytes:(artifact.deployedBytecode.length-2)/2,
    referenceBlock:reference.number,referenceBlockHash:expectedHash,
    referenceBlockStillCanonical:canonical,referenceBlockGasLimit:reference.gasLimit.toString(),
    eip7825TransactionGasCap:CAP.toString(),simulationGasLimit:TEST_GAS.toString(),
    endpointChecks:checks,independentExactRuntimeSimulations:trusted.length,
    estimatesAgreeWithin2x:agrees,boundedDeploymentEvmQuote:bounded,
    bufferedGasLimit:bounded?buffered?.toString():null,
    maxFeePerGasWei:bounded?maxFee?.toString():null,
    maxPriorityFeePerGasWei:bounded?priority?.toString():null,
    maximumFeeWei:cap?.toString()??null,
    maximumFeeSepoliaETH:cap===null?null:formatEther(cap),
    caveat:'Constructor eth_call is simulation, not deployed runtime, receipt, HCU or transaction inclusion evidence.',
    liveHcuMeasured:false,liveDepthMeasured:false,
    transactionSent:false,signatureRequested:false,deployAuthorized:false
  }));
}
main().catch(e=>{
  console.error('GAMBIT_ARENA_V3_PUBLIC_PREFLIGHT_UNAVAILABLE',
    e instanceof Error?e.name:'Error');process.exitCode=1;
});
