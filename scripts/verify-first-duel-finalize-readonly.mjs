/**
 * Strictly read-only search and independent verification of Duel #1's
 * finalization. The UI reported a post-transaction score mismatch, so we
 * MUST inspect public chain receipts before advising any new action.
 *
 * Discover the actual finalization tx by its contract event; do not guess a
 * tx hash from an app message. No wallet, keys, broadcasts or further writes.
 */
import {Interface,JsonRpcProvider,formatEther,getAddress,keccak256}
  from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const CONTRACT='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const CHALLENGER='0x70d086988706e4f27A53c484570B2a41897dcDD5';
const HANDLE='0xfe50295aa5539118cce1125cabe233e9fbb6467ca6ff0000000000aa36a70200';
const START_BLOCK=12182385;
const MAX_FEE_WEI=500000000n;
const KMS_SCORE={packed:1,challenger:0,defender:1,outcome:2};
const ABI=new Interface([
 'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)',
 'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
 'function publicResultHandle(uint256 id) view returns(bytes32)',
 'function duelForSquad(uint256 id) view returns(uint256)',
 'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
const assert=(ok,message)=>{if(!ok)throw Error('GAMBIT_FINALIZE_READONLY_INVALID '+message);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&getAddress(a)===getAddress(b);
async function readAt(provider,address,block,fn,args=[]){
  const data=ABI.encodeFunctionData(fn,args);
  return ABI.decodeFunctionResult(fn,
    await provider.call({to:address,data,blockTag:block}));
}

export async function verifyFirstFinalization(provider,manifest){
  assert(manifest?.chainId===11155111&&manifest.contract==='SquadGambit',
    'manifest');
  assert(getAddress(manifest.contractAddress)===getAddress(CONTRACT),'contract');
  assert(BigInt(await provider.send('eth_chainId',[]))===11155111n,'network');
  const head=await provider.getBlock('latest');
  assert(head&&head.number>=START_BLOCK,'chain head');
  const eventTopic=ABI.encodeFilterTopics('DuelFinalized',[1n]);
  const entries=await provider.getLogs({
    address:CONTRACT,fromBlock:START_BLOCK,toBlock:head.number,topics:eventTopic
  });
  if(entries.length===0){
    const state=await readAt(provider,CONTRACT,head.number,'duelStatus',[1n]);
    assert(state.submitted&&state.resolved&&!state.expired,'invalid live duel state');
    assert(!state.finalized,'finalized state but missing authentic event');
    return {state:'NOT_FINALIZED',latestBlock:head.number,
      confirmedFinalizeTransaction:null,
      instruction:'Do not retry; check Rabby Activity for a pending tx.',
      walletConnected:false,signatureMade:false,transactionSent:false};
  }
  assert(entries.length===1,'duplicate DuelFinalized events');
  const entry=entries[0];
  const event=ABI.parseLog({topics:entry.topics,data:entry.data});
  assert(event?.name==='DuelFinalized'&&BigInt(event.args.duelId)===1n,
    'event type or duel id');
  const [receipt,tx,code,block]=await Promise.all([
    provider.getTransactionReceipt(entry.transactionHash),
    provider.getTransaction(entry.transactionHash),
    provider.getCode(CONTRACT,entry.blockNumber),
    provider.getBlock(entry.blockNumber)
  ]);
  assert(receipt&&tx&&block,'missing transaction, receipt or event block');
  assert(receipt.status===1,'reverted receipt');
  assert(receipt.blockHash===entry.blockHash&&
    receipt.blockNumber===entry.blockNumber&&
    tx.blockHash===entry.blockHash,'noncanonical receipt');
  assert(same(tx.from,CHALLENGER)&&same(receipt.from,CHALLENGER),
    'unexpected signer');
  assert(same(tx.to,CONTRACT)&&same(receipt.to,CONTRACT),'wrong destination');
  assert(tx.value===0n,'nonzero ETH transfer');
  assert(code!=='0x'&&(code.length-2)/2===manifest.runtimeBytes&&
    keccak256(code).toLowerCase()===manifest.runtimeKeccak256.toLowerCase(),
    'runtime fingerprint');
  const call=ABI.parseTransaction({data:tx.data,value:tx.value});
  assert(call?.name==='finalizeDuel'&&BigInt(call.args.duelId)===1n,
    'wrong transaction selector or duel');
  assert(typeof call.args.proof==='string'&&
    /^0x([0-9a-fA-F]{2})+$/.test(call.args.proof),
    'missing KMS signature proof');
  const inReceipt=receipt.logs.filter(log=>{
    if(!same(log.address,CONTRACT))return false;
    try{return ABI.parseLog({topics:log.topics,data:log.data})?.name==='DuelFinalized';}
    catch{return false;}
  });
  assert(inReceipt.length===1&&
    inReceipt[0].transactionHash.toLowerCase()===entry.transactionHash.toLowerCase(),
    'receipt event mismatch');

  const parsedScore=Number(call.args.packedScore);
  const eventScore={
    challenger:Number(event.args.pointsChallenger),
    defender:Number(event.args.pointsDefender),
    outcome:Number(event.args.outcome)
  };
  const expected=KMS_SCORE;
  const expectedOutcome=eventScore.challenger===eventScore.defender?0:
    eventScore.challenger>eventScore.defender?1:2;
  assert(parsedScore===(eventScore.challenger<<3|eventScore.defender)&&
    eventScore.outcome===expectedOutcome,'calldata/event score mismatch');
  const [then,now,handleThen,handleNow,linked]=await Promise.all([
    readAt(provider,CONTRACT,receipt.blockNumber,'duelStatus',[1n]),
    readAt(provider,CONTRACT,head.number,'duelStatus',[1n]),
    readAt(provider,CONTRACT,receipt.blockNumber,'publicResultHandle',[1n]),
    readAt(provider,CONTRACT,head.number,'publicResultHandle',[1n]),
    readAt(provider,CONTRACT,head.number,'duelForSquad',[1n])
  ]);
  assert(then.submitted&&then.resolved&&then.finalized&&!then.expired&&
    now.submitted&&now.resolved&&now.finalized&&!now.expired,
    'finalization missing from receipt block/current state');
  assert(BigInt(then.squadId)===1n&&BigInt(now.squadId)===1n&&
    same(then.challenger,CHALLENGER)&&same(now.challenger,CHALLENGER)&&
    BigInt(linked[0])===1n,'duel identity mismatch');
  assert(Number(then.packedScore)===parsedScore&&
    Number(now.packedScore)===parsedScore,'onchain stored score mismatch');
  assert(String(handleThen[0]).toLowerCase()===HANDLE.toLowerCase()&&
    String(handleNow[0]).toLowerCase()===HANDLE.toLowerCase(),
    'public KMS encrypted handle changed');
  const matchesKms=parsedScore===expected.packed&&
    eventScore.challenger===expected.challenger&&
    eventScore.defender===expected.defender&&
    eventScore.outcome===expected.outcome;
  assert(matchesKms,'genuine chain state disagrees with previously authenticated KMS score');
  const fee=receipt.gasUsed*receipt.gasPrice;
  return {
    state:'FINALIZED_AND_KMS_SCORE_MATCHED',
    chainId:11155111,contractAddress:CONTRACT,
    transactionHash:entry.transactionHash,receiptBlock:receipt.blockNumber,
    receiptTimeUtc:new Date(block.timestamp*1000).toISOString(),
    latestBlock:head.number,
    duelId:'1',squadId:'1',
    canonicalSender:getAddress(tx.from),
    submitted:true,resolved:true,finalized:true,
    storedPackedScore:parsedScore,
    pointsChallenger:eventScore.challenger,
    pointsDefender:eventScore.defender,outcome:eventScore.outcome,
    resultHandle:HANDLE,
    kMSResultMatches:true,
    verifiedReceiptEventRuntime:true,
    nonemptyProofInTransaction:true,
    gasUsed:receipt.gasUsed.toString(),
    actualFeeWei:fee.toString(),
    actualFeeSepoliaEth:formatEther(fee),
    withinSoftwareFeeCeiling:fee<=MAX_FEE_WEI,
    walletConnected:false,signatureMade:false,transactionSent:false
  };
}

async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  const provider=new JsonRpcProvider(
    process.env.GAMBIT_SEPOLIA_RPC_READONLY||'https://ethereum-sepolia-rpc.publicnode.com',
    11155111,{staticNetwork:true}
  );
  try{
    console.log('GAMBIT_DUEL1_FINALIZE_READONLY '+JSON.stringify(
      await verifyFirstFinalization(provider,manifest)
    ));
  }finally{provider.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    console.error('GAMBIT_DUEL1_FINALIZE_READONLY_STOPPED '+
      (error instanceof Error?error.message.split('\n')[0]:'UnknownError'));
    process.exitCode=1;
  });
