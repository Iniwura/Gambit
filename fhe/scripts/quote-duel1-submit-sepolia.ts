import { ethers, network } from 'hardhat';
import { ZamaSDK, memoryStorage } from '@zama-fhe/sdk';
import { createConfig } from '@zama-fhe/sdk/ethers';
import { node } from '@zama-fhe/sdk/node';
import { sepolia } from '@zama-fhe/sdk/chains';
import { VoidSigner, getAddress, keccak256, formatEther } from 'ethers';
import deployment from '../deployments/sepolia-squad.json';

/**
 * UNSIGNED ten-input challenger submission fee quote for an ALREADY-open duel.
 * Uses synthetic public tactics and ethers VoidSigner. NEVER reads balances
 * or secrets, signs, sends, submits, resolves, finalizes, or grants approval.
 */
const CHAIN=11155111n;
const OWNER=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const CHALLENGER=getAddress('0x70d086988706e4f27A53c484570B2a41897dcDD5');
const D=1n;
const SYNTHETIC=[2n,0n,1n,1n,2n,0n,0n,1n,2n,2n] as const;

let quoteStage='initial';
function reportStage(stage:string){
  quoteStage=stage;
  // Non-sensitive markers: no ciphertext, wallet identity secrets or RPC URLs.
  console.log('GAMBIT_DUEL1_UNSIGNED_STAGE '+stage);
}

async function main(){
  reportStage('NETWORK_AND_RUNTIME');
  // Intentional no-wallet scope: no approval flag is ever valid here.
  if(process.env.GAMBIT_APPROVE_ONE_SQUAD_SEAL||
     process.env.GAMBIT_APPROVE_DUEL_SUBMIT){
    throw Error('Remove signing approval flags; this is an UNSIGNED quote only.');
  }
  const n=await ethers.provider.getNetwork();
  if(network.name!=='sepolia'||n.chainId!==CHAIN||deployment.chainId!==11155111||
     deployment.contract!=='SquadGambit'||getAddress(deployment.deployer)!==OWNER)
    throw Error('Unexpected network, owner, or deployment manifest');
  const address=getAddress(deployment.contractAddress);
  const code=await ethers.provider.getCode(address);
  if(code==='0x'||(code.length-2)/2!==deployment.runtimeBytes||
     keccak256(code).toLowerCase()!==deployment.runtimeKeccak256.toLowerCase())
    throw Error('Pinned SquadGambit runtime mismatch');

  const contract:any=await ethers.getContractAt('SquadGambit',address);
  async function pending(){
    const [squad,duel,linked,count,latest]=await Promise.all([
      contract.squadStatus(D),contract.duelStatus(D),
      contract.duelForSquad(D),contract.nextDuelId(),
      ethers.provider.getBlock('latest')
    ]);
    if(!latest||!squad.active||!squad.claimed||
       getAddress(squad.owner)!==OWNER||
       getAddress(squad.allowedOpponent)!==CHALLENGER||
       BigInt(duel.squadId)!==D||getAddress(duel.challenger)!==CHALLENGER||
       !duel.openedAt||BigInt(linked)!==D||BigInt(count)<D||
       duel.submitted||duel.resolved||duel.finalized||duel.expired)
      throw Error('First duel is not open and awaiting the expected challenger submission');
    const deadline=BigInt(duel.openedAt)+86400n;
    if(BigInt(latest.timestamp)>deadline)
      throw Error('Submission deadline already passed');
    return {deadline,latestBlock:latest.number};
  }
  reportStage('CANONICAL_DUEL_STATE');
  const state=await pending();
  const rpc=(network.config as {url?:string}).url??
    'https://ethereum-sepolia-rpc.publicnode.com';
  const chain={...sepolia,network:rpc};
  const sdk=new ZamaSDK(createConfig({
    chains:[chain],
    signer:new VoidSigner(CHALLENGER,ethers.provider),
    storage:memoryStorage,
    relayers:{[chain.id]:node({timeout:180000})}
  }));
  const start=Date.now();
  try{
    reportStage('ZAMA_TEN_INPUT_ENCRYPTION');
    const encrypted=await sdk.encrypt({
      contractAddress:address as `0x${string}`,
      userAddress:CHALLENGER as `0x${string}`,
      values:SYNTHETIC.map(value=>({type:'euint8' as const,value}))
    });
    if(encrypted.encryptedValues.length!==10||
       typeof encrypted.inputProof!=='string'||encrypted.inputProof.length<10)
      throw Error('Expected ten encrypted inputs and a valid synthetic input proof');
    const atEncryption=Date.now();
    const data=contract.interface.encodeFunctionData('submitDuel',[
      D,encrypted.encryptedValues,encrypted.inputProof
    ]);
    reportStage('EXACT_CALL_GAS_ESTIMATE');
    const gas=await ethers.provider.estimateGas({
      from:CHALLENGER,to:address,data,value:0n
    });
    if(gas<=0n)throw Error('Live unsigned submission gas estimation failed');
    const gasLimit=(gas*120n+99n)/100n;
    reportStage('FRESH_PUBLIC_FEE_QUOTE');
    const fees=await ethers.provider.getFeeData();
    const maxPerGas=fees.maxFeePerGas??fees.gasPrice;
    if(!maxPerGas||maxPerGas<=0n)
      throw Error('Live Sepolia gas quote unavailable');
    const maxFee=gasLimit*maxPerGas;
    reportStage('FINAL_CANONICAL_STATE_RECHECK');
    const finalState=await pending();
    if(finalState.deadline!==state.deadline||
       keccak256(await ethers.provider.getCode(address)).toLowerCase()!==
         deployment.runtimeKeccak256.toLowerCase())
      throw Error('Submission state/runtime changed during unsigned encryption');
    reportStage('COMPLETE');
    console.log('GAMBIT_DUEL1_SUBMIT_UNSIGNED_QUOTE '+JSON.stringify({
      scope:'TEN SYNTHETIC PUBLIC INPUTS, VOID SIGNER, ESTIMATE ONLY',
      chainId:11155111,contract:address,owner:OWNER,challenger:CHALLENGER,
      squadId:'1',duelId:'1',inputCount:encrypted.encryptedValues.length,
      estimatedGas:gas.toString(),bufferedGasLimit:gasLimit.toString(),
      maxQuotedFeePerGasWei:maxPerGas.toString(),
      maximumQuotedFeeWei:maxFee.toString(),
      maximumQuotedFeeSepoliaETH:formatEther(maxFee),
      lastBlock:finalState.latestBlock,
      deadlineUnixSeconds:state.deadline.toString(),
      deadlineUtc:new Date(Number(state.deadline)*1000).toISOString(),
      sdkEncryptionLatencyMs:atEncryption-start,
      fullQuoteLatencyMs:Date.now()-start,
      balanceQueried:false,walletConnected:false,signatureMade:false,
      transactionSent:false,hcuMeasured:false,
      caveat:'No approval. The real player must separately approve exactly one freshly quoted submission transaction, with an explicit fee ceiling, before sending.'
    }));
  }finally{sdk.terminate()}
}
main().then(()=>process.stdout.write('',()=>process.exit(0)))
  .catch(error=>{
    process.stderr.write('GAMBIT_DUEL1_SUBMIT_UNSIGNED_QUOTE_STOPPED stage='+quoteStage+' code='+
      (error instanceof Error?error.name:'UnknownError')+'\n',
      ()=>process.exit(1));
  });
