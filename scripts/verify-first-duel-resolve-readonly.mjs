/**
 * Read-only, receipt-first evidence verifier for GAMBIT's first genuinely
 * encrypted Duel #1 resolution. The expected hash is a user-visible claim
 * until independently matched against public Sepolia receipt, calldata,
 * runtime, DuelReady event, canonical onchain result handle and state.
 *
 * No signer, balance lookup, private inputs, decryption or transaction.
 */
import {Interface,JsonRpcProvider,getAddress,keccak256,formatEther}
  from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FIRST_SUBMIT} from './verify-first-duel-submit-readonly.mjs';

export const FIRST_RESOLVE=Object.freeze({
  transactionHash:'0xe91ba8ba3af4ce9666871752974b5b2168f4ccac4a6a8157df93d27fe79696ac',
  chainId:11155111,duelId:1n,squadId:1n,
  challenger:FIRST_SUBMIT.challenger,
  openingBlock:FIRST_SUBMIT.openerBlock,
  submissionTransactionHash:FIRST_SUBMIT.transactionHash,
  maxApprovedResolveFeeWei:500000000n
});
const ABI=new Interface([
  'function resolveDuel(uint256 duelId)',
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function publicResultHandle(uint256 id) view returns(bytes32)',
  'function duelForSquad(uint256 id) view returns(uint256)',
  'event DuelReady(uint256 indexed duelId,bytes32 resultHandle)'
]);
const ensure=(condition,message)=>{
  if(!condition)throw Error('GAMBIT_RESOLVE_READONLY_INVALID '+message);
};
const same=(a,b)=>getAddress(a)===getAddress(b);
async function callAt(provider,contract,block,fn,args=[]){
  const data=ABI.encodeFunctionData(fn,args);
  const raw=await provider.call({to:contract,data,blockTag:block});
  return ABI.decodeFunctionResult(fn,raw);
}

export async function verifyFirstResolution(provider,manifest,expected=FIRST_RESOLVE){
  ensure(manifest?.chainId===expected.chainId&&manifest.contract==='SquadGambit',
    'manifest or network setup');
  ensure(/^0x[0-9a-fA-F]{64}$/.test(expected.transactionHash),'transaction hash syntax');
  ensure(BigInt(await provider.send('eth_chainId',[]))===11155111n,'chain id');
  const address=getAddress(manifest.contractAddress);
  const [receipt,tx,latest]=await Promise.all([
    provider.getTransactionReceipt(expected.transactionHash),
    provider.getTransaction(expected.transactionHash),
    provider.getBlock('latest')
  ]);
  ensure(receipt&&tx&&latest,'missing canonical tx, receipt or head');
  ensure(receipt.status===1,'transaction reverted');
  ensure(tx.hash.toLowerCase()===expected.transactionHash.toLowerCase()&&
    receipt.hash.toLowerCase()===expected.transactionHash.toLowerCase(),'hash mismatch');
  ensure(tx.blockHash===receipt.blockHash&&
    receipt.blockNumber>=expected.openingBlock&&
    receipt.blockNumber<=latest.number,'wrong canonical block');
  ensure(same(tx.to,address)&&same(receipt.to,address),'wrong contract address');
  ensure(same(tx.from,expected.challenger)&&same(receipt.from,expected.challenger),
    'wrong sender');
  ensure(tx.value===0n,'ETH transferred');
  const parsed=ABI.parseTransaction({data:tx.data,value:tx.value});
  ensure(parsed?.name==='resolveDuel'&&
    BigInt(parsed.args.duelId)===expected.duelId,'wrong method or duel');
  const runtime=await provider.getCode(address,receipt.blockNumber);
  ensure(runtime!=='0x'&&(runtime.length-2)/2===manifest.runtimeBytes&&
    keccak256(runtime).toLowerCase()===manifest.runtimeKeccak256.toLowerCase(),
    'wrong contract runtime');
  const events=receipt.logs.filter(log=>{
    if(!same(log.address,address))return false;
    try{return ABI.parseLog(log)?.name==='DuelReady'}
    catch{return false}
  });
  ensure(events.length===1,'not exactly one DuelReady event in receipt');
  const event=ABI.parseLog(events[0]);
  ensure(event&&BigInt(event.args.duelId)===expected.duelId,'wrong DuelReady identity');
  const handle=event.args.resultHandle;
  ensure(/^0x[0-9a-fA-F]{64}$/.test(handle)&&
    !/^0x0{64}$/i.test(handle),'missing encrypted result handle');

  const [stored,resultHandle,linked]=await Promise.all([
    callAt(provider,address,receipt.blockNumber,'duelStatus',[expected.duelId]),
    callAt(provider,address,receipt.blockNumber,'publicResultHandle',[expected.duelId]),
    callAt(provider,address,receipt.blockNumber,'duelForSquad',[expected.squadId])
  ]);
  ensure(BigInt(stored.squadId)===expected.squadId&&
    same(stored.challenger,expected.challenger)&&
    stored.submitted===true&&stored.resolved===true&&stored.expired===false,
    'resolution not persisted at mined block');
  ensure(String(resultHandle[0]).toLowerCase()===handle.toLowerCase(),
    'onchain handle mismatch');
  ensure(BigInt(linked[0])===expected.duelId,'one-time squad index mismatch');

  const allEvents=await provider.getLogs({
    address,fromBlock:expected.openingBlock,toBlock:latest.number,
    topics:ABI.encodeFilterTopics('DuelReady',[expected.duelId])
  });
  ensure(allEvents.length===1&&
    allEvents[0].transactionHash.toLowerCase()===expected.transactionHash.toLowerCase(),
    'duplicate or missing DuelReady event');
  const [live,liveHandle,block]=await Promise.all([
    callAt(provider,address,latest.number,'duelStatus',[expected.duelId]),
    callAt(provider,address,latest.number,'publicResultHandle',[expected.duelId]),
    provider.getBlock(receipt.blockNumber)
  ]);
  ensure(block&&live.submitted===true&&live.resolved===true&&live.expired===false,
    'contradictory current onchain status');
  ensure(String(liveHandle[0]).toLowerCase()===handle.toLowerCase(),
    'public handle changed');
  ensure(receipt.gasUsed>0n&&receipt.gasPrice>0n,
    'invalid receipt gas accounting');
  const fee=receipt.gasUsed*receipt.gasPrice;
  return Object.freeze({
    scope:'INDEPENDENT PUBLIC READ ONLY; NO KMS DECRYPTION',
    chainId:11155111,contractAddress:address,duelId:'1',squadId:'1',
    resolutionTransactionHash:expected.transactionHash,
    receiptStatus:'SUCCESS',receiptBlock:receipt.blockNumber,
    receiptTimeUtc:new Date(block.timestamp*1000).toISOString(),
    latestBlock:latest.number,
    sender:getAddress(expected.challenger),
    resultHandle:handle,
    eventAndRuntimeVerified:true,canonicalResultHandleVerified:true,
    singleDuelReadyEventVerified:true,
    submitted:Boolean(live.submitted),
    resolved:Boolean(live.resolved),
    finalized:Boolean(live.finalized),
    gasUsed:receipt.gasUsed.toString(),
    actualFeeWei:fee.toString(),actualFeeSepoliaETH:formatEther(fee),
    withinStated500mWeiSafetyCeiling:fee<=expected.maxApprovedResolveFeeWei,
    next:live.finalized?'ALREADY_FINALIZED':'KMS_PROOF_AND_SEPARATE_FINALIZE',
    signatureMade:false,transactionSent:false,walletConnected:false
  });
}
async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  const provider=new JsonRpcProvider(
    process.env.GAMBIT_SEPOLIA_RPC_READONLY||'https://ethereum-sepolia-rpc.publicnode.com',
    11155111,{staticNetwork:true}
  );
  try{
    console.log('GAMBIT_DUEL1_RESOLUTION_READONLY '+JSON.stringify(
      await verifyFirstResolution(provider,manifest)));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    console.error('GAMBIT_DUEL1_RESOLUTION_READONLY_STOPPED '+
      (error instanceof Error?error.message.split('\n')[0]:'unknown'));
    process.exitCode=1;
  });
