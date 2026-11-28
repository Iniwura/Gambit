import {artifacts,ethers,network} from 'hardhat';
import {formatEther,keccak256,getAddress,toQuantity} from 'ethers';

/** Public RPC only. No signer, keys, deployment, transaction or state override.
 * Simulate the exact constructor at one canonical block on independent
 * endpoints; a successful simulation is NOT deployment or live FHE proof.
 */
// Glamsterdam is active on Sepolia. EIP-8037 separates execution gas
// (EIP-7825 cap) from state gas (included in total tx.gas).
// See https://eips.ethereum.org/EIPS/eip-8037 and
// https://blog.ethereum.org/2026/09/17/glamsterdam-testnet-announcement
const EXECUTION_CAP=16_777_216n;
const TOTAL_PROTOCOL_CAP=4_294_967_295n;
// Explicit project ceiling for this read-only simulation, NOT permission
// to spend. Upper read-only simulation ceiling, not a proposed spending limit.
const TEST_GAS=48_000_000n;
const STATE_GAS_PER_CODE_BYTE=1_530n;
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
  for(const candidate of ['NeutralBlacksiteResearch','ArenaV4ConfidentialActivationResearch'] as const){
    try{await preflight(candidate);}catch(e){console.error('GAMBIT_RESEARCH_PREFLIGHT_UNAVAILABLE '+candidate,e instanceof Error?e.name:'Error');process.exitCode=1;}
  }
}
async function preflight(candidate:'NeutralBlacksiteResearch'|'ArenaV4ConfidentialActivationResearch'){
  const provider=ethers.provider;
  if(network.name!=='sepolia'||(await provider.getNetwork()).chainId!==11155111n)
    throw Error('Sepolia only');
  const artifact=await artifacts.readArtifact(candidate);
  if(artifact.contractName!==candidate||artifact.bytecode==='0x'||artifact.deployedBytecode==='0x')
    throw Error('Missing compiled research candidate');
  const iface=new ethers.Interface(artifact.abi);
  const expected = candidate==='NeutralBlacksiteResearch' ? [
    'openMission()','submitAttempt(uint256,uint8,bytes32[5],bytes32,bytes)',
    'resolveAttempt(uint256,uint8)','finalizeAttempt(uint256,uint8,uint8,bytes)',
    'expireMission(uint256)','abortUnsettled(uint256)'
  ] : [
    'createMatch(address)','sealRound(uint256,uint8,bytes32[11],bytes)',
    'resolveRound(uint256,uint8)','finalizeRound(uint256,uint8,uint8,bytes)',
    'expireIncomplete(uint256,uint8)','abortUnsettled(uint256,uint8)'
  ];
  for(const signature of expected){
    if(iface.getFunction(signature)?.format('sighash')!==signature)
      throw Error('Unexpected candidate ABI: '+signature);
  }
  const creationBytes=(artifact.bytecode.length-2)/2;
  const runtimeBytes=(artifact.deployedBytecode.length-2)/2;
  if(creationBytes>49152||runtimeBytes>24576)throw Error('Creation/runtime size limit exceeded');
  const from=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
  const latest=await provider.getBlock('latest');
  if(!latest||latest.number<3)throw Error('Missing reference head');
  // Small lag allows independent providers to reach the same block.
  const reference=await provider.getBlock(latest.number-2);
  if(!reference||!reference.hash)throw Error('Missing reference block');
  const tag=toQuantity(reference.number),expectedHash=reference.hash.toLowerCase();
  const fees=await provider.getFeeData();
  const runtime=artifact.deployedBytecode.toLowerCase();
  const simulationGas=TEST_GAS<reference.gasLimit*85n/100n?TEST_GAS:reference.gasLimit*85n/100n;
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
    const tx={from,data:artifact.bytecode,value:'0x0',gas:toQuantity(simulationGas)};
    // A tiny constructor returning one STOP opcode tests whether this
    // endpoint supports contract-creation eth_call at the chosen block.
    const control={from,data:'0x6001600c60003960016000f300',value:'0x0',gas:'0x100000'};
    const [estimate,sim,baseline]=await Promise.all([
      rpc(url,'eth_estimateGas',[tx,tag]),
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
    .filter((x):x is bigint=>x!==null&&x>0n&&x<=simulationGas);
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
    buffered<=simulationGas&&buffered<=TOTAL_PROTOCOL_CAP&&buffered*100n<reference.gasLimit*90n&&
    maxFee!==null&&priority!==null&&maxFee>0n&&priority>=0n&&priority<=maxFee;
  const cap=bounded&&buffered!==null&&maxFee!==null?buffered*maxFee:null;
  const balance=await provider.getBalance(from,reference.number);
  const finalBlock=await provider.getBlock(reference.number);
  const stillCanonical=canonical&&finalBlock?.hash?.toLowerCase()===expectedHash;
  const usableQuote=bounded&&stillCanonical;
  console.log('GAMBIT_RESEARCH_PUBLIC_PREFLIGHT '+JSON.stringify({
    scope:'READ ONLY — no deployment authorization',
    candidate,chainId:11155111,publicReferenceFrom:from,creationBytes,
    referenceBalanceWei:balance.toString(),referenceBalanceCoversQuote:usableQuote&&cap!==null&&balance>=cap,
    creationCodeHash:keccak256(artifact.bytecode),
    compiledRuntimeTemplateHash:keccak256(artifact.deployedBytecode),
    compiledRuntimeTemplateBytes:(artifact.deployedBytecode.length-2)/2,
    referenceBlock:reference.number,referenceBlockHash:expectedHash,
    referenceBlockStillCanonical:stillCanonical,referenceBlockGasLimit:reference.gasLimit.toString(),
    gasModel:'Glamsterdam EIP-8037 execution + state gas',
    eip7825ExecutionGasCap:EXECUTION_CAP.toString(),
    eip8037TotalTransactionGasCap:TOTAL_PROTOCOL_CAP.toString(),
    codeDepositStateGasOnly:(BigInt((artifact.deployedBytecode.length-2)/2)*STATE_GAS_PER_CODE_BYTE).toString(),
    simulationGasLimit:simulationGas.toString(),
    endpointChecks:checks,independentExactRuntimeSimulations:trusted.length,
    estimatesAgreeWithin2x:agrees,boundedDeploymentEvmQuote:usableQuote,
    bufferedGasLimit:usableQuote?buffered?.toString():null,
    maxFeePerGasWei:usableQuote?maxFee?.toString():null,
    maxPriorityFeePerGasWei:usableQuote?priority?.toString():null,
    maximumFeeWei:usableQuote?cap?.toString()??null:null,
    maximumFeeSepoliaETH:!usableQuote||cap===null?null:formatEther(cap),
    caveat:'Constructor eth_call is simulation, not deployed runtime, receipt, HCU, separate execution-gas measurement or transaction inclusion evidence.',
    liveHcuMeasured:false,liveDepthMeasured:false,
    transactionSent:false,signatureRequested:false,deployAuthorized:false
  }));
}
main().catch(e=>{
  console.error('GAMBIT_RESEARCH_PUBLIC_PREFLIGHT_UNAVAILABLE',
    e instanceof Error?e.name:'Error');process.exitCode=1;
});
