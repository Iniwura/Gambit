/**
 * Independent, STRICTLY READ-ONLY verification of the first encrypted
 * challenger submission in the live SquadGambit 3v3 protocol.
 *
 * Fixed public tx hash comes from the user's screenshot; it is a hypothesis
 * until the public RPC independently confirms sender, function, event,
 * receipt, runtime hash and state. Never reads a private key or wallet.
 * Never prints strategy ciphertext or inputProof contents.
 */
import {Interface,JsonRpcProvider,getAddress,keccak256,formatEther}
  from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const FIRST_SUBMIT=Object.freeze({
  transactionHash:'0x00562be6f918e33a5781ce9c2ff9bcb4516d4c5e6d5a8cb25e485a17ddf2a8d4',
  chainId:11155111,
  squadId:1n,duelId:1n,
  openerBlock:12182024,
  challenger:'0x70d086988706e4f27A53c484570B2a41897dcDD5',
  defender:'0x7d567Fa1d5fe35737BbF045f47667e13298Ee176',
  approvedSubmitFeeCapWei:500000000n
});
const ABI=new Interface([
 'function submitDuel(uint256 duelId,bytes32[10] encryptedPlans,bytes inputProof)',
 'function resolveDuel(uint256 duelId)',
 'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
 'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
 'function duelForSquad(uint256 id) view returns(uint256)',
 'event DuelSubmitted(uint256 indexed duelId)'
]);
const check=(bool,reason)=>{if(!bool)throw Error('GAMBIT_DUEL1_SUBMIT_INVALID '+reason)};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  getAddress(a)===getAddress(b);
async function read(provider,address,block,fn,args=[]){
  const calldata=ABI.encodeFunctionData(fn,args);
  const raw=await provider.call({to:address,data:calldata,blockTag:block});
  return ABI.decodeFunctionResult(fn,raw);
}

export async function verifyFirstSubmission(provider,manifest,expected=FIRST_SUBMIT){
  check(manifest?.chainId===11155111&&manifest.contract==='SquadGambit','manifest');
  check(/^0x[0-9a-fA-F]{64}$/.test(expected.transactionHash),'hash format');
  const address=getAddress(manifest.contractAddress);
  check(BigInt(await provider.send('eth_chainId',[]))===11155111n,'chain');
  const [receipt,tx,latest]=await Promise.all([
    provider.getTransactionReceipt(expected.transactionHash),
    provider.getTransaction(expected.transactionHash),
    provider.getBlock('latest')
  ]);
  check(receipt&&tx&&latest,'canonical transaction/receipt/latest block unavailable');
  check(receipt.hash.toLowerCase()===expected.transactionHash.toLowerCase()&&
    tx.hash.toLowerCase()===expected.transactionHash.toLowerCase(),'transaction hash');
  check(receipt.status===1,'receipt reverted');
  check(receipt.blockNumber>=expected.openerBlock&&receipt.blockNumber<=latest.number,
    'receipt block out of range');
  check(tx.blockHash===receipt.blockHash,'transaction/receipt block mismatch');
  check(same(receipt.to,address)&&same(tx.to,address),'wrong recipient');
  check(same(receipt.from,expected.challenger)&&same(tx.from,expected.challenger),
    'wrong challenger');
  check(tx.value===0n,'nonzero ETH transferred');
  const code=await provider.getCode(address,receipt.blockNumber);
  check(code!=='0x'&&
    keccak256(code).toLowerCase()===manifest.runtimeKeccak256.toLowerCase()&&
    (code.length-2)/2===manifest.runtimeBytes,'runtime fingerprint');
  const call=ABI.parseTransaction({data:tx.data,value:tx.value});
  check(call?.name==='submitDuel','wrong function');
  check(BigInt(call.args.duelId)===expected.duelId,'wrong submitted duel');
  const inputs=call.args.encryptedPlans;
  check(inputs&&inputs.length===10&&inputs.every(x=>/^0x[0-9a-fA-F]{64}$/.test(x)),
    'incomplete encrypted inputs');
  check(/^0x([0-9a-fA-F]{2})+$/.test(call.args.inputProof),
    'empty or invalid encrypted input proof');
  const matching=receipt.logs.filter(log=>{
    if(!same(log.address,address))return false;
    try{return ABI.parseLog({topics:log.topics,data:log.data})?.name==='DuelSubmitted'}
    catch{return false}
  });
  check(matching.length===1,'expected exactly one DuelSubmitted event in this receipt');
  const event=ABI.parseLog(matching[0]);
  check(BigInt(event.args.duelId)===expected.duelId,'wrong event duel');

  const [duel,squad,linked]=await Promise.all([
    read(provider,address,receipt.blockNumber,'duelStatus',[expected.duelId]),
    read(provider,address,receipt.blockNumber,'squadStatus',[expected.squadId]),
    read(provider,address,receipt.blockNumber,'duelForSquad',[expected.squadId])
  ]);
  check(BigInt(duel.squadId)===expected.squadId&&
    same(duel.challenger,expected.challenger),'wrong recorded duel');
  check(duel.submitted===true&&duel.expired===false,'submission not reflected in receipt block');
  check(same(squad.owner,expected.defender)&&
    same(squad.allowedOpponent,expected.challenger)&&squad.claimed===true,
    'squad identity or claim mismatch');
  check(BigInt(linked[0])===expected.duelId,'canonical one-use duel index');

  const allEvents=await provider.getLogs({
    address,fromBlock:expected.openerBlock,toBlock:latest.number,
    topics:[ABI.getEvent('DuelSubmitted').topicHash,
      ABI.encodeFilterTopics('DuelSubmitted',[expected.duelId])[1]]
  });
  check(allEvents.length===1 &&
    allEvents[0].transactionHash.toLowerCase()===expected.transactionHash.toLowerCase(),
    'unexpected extra/missing submission event');

  const [live,block]=await Promise.all([
    read(provider,address,latest.number,'duelStatus',[expected.duelId]),
    provider.getBlock(receipt.blockNumber)
  ]);
  check(block&&live.submitted===true&&live.expired===false,'stale or contradictory live state');
  const actualFeeWei=receipt.gasUsed*receipt.gasPrice;
  const next=live.finalized?'ALREADY_FINALIZED':live.resolved?'READY_TO_FINALIZE':'READY_TO_RESOLVE';
  return Object.freeze({
    chainId:expected.chainId,
    contractAddress:address,
    transactionHash:expected.transactionHash,
    receiptStatus:'SUCCESS',
    receiptBlock:receipt.blockNumber,
    receiptBlockTimeUtc:new Date(block.timestamp*1000).toISOString(),
    latestBlock:latest.number,
    challenger:getAddress(expected.challenger),
    squadId:expected.squadId.toString(),
    duelId:expected.duelId.toString(),
    tenEncryptedHandlesVerified:true,
    nonEmptyInputProofVerified:true,
    exclusiveDuelSubmittedEventVerified:true,
    contractRuntimeVerified:true,
    canonicalStoredStateVerified:true,
    latestSubmitted:Boolean(live.submitted),
    latestResolved:Boolean(live.resolved),
    latestFinalized:Boolean(live.finalized),
    gasUsed:receipt.gasUsed.toString(),
    actualFeeWei:actualFeeWei.toString(),
    actualFeeSepoliaETH:formatEther(actualFeeWei),
    withinOriginalFeeCap:actualFeeWei<=expected.approvedSubmitFeeCapWei,
    next,
    walletConnected:false,signatureMade:false,transactionSent:false
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
    console.log('GAMBIT_DUEL1_SUBMIT_READONLY '+JSON.stringify(
      await verifyFirstSubmission(provider,manifest)
    ));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    // Do not log tx calldata, proof bytes or credential-bearing RPC URLs.
    console.error('GAMBIT_DUEL1_SUBMIT_READONLY_STOPPED '+
      (error instanceof Error?error.message.split('\n')[0]:'Unknown error'));
    process.exitCode=1;
  });
