/**
 * Public-only post-transaction recovery for GAMBIT's first invited squad.
 * This is deliberately safe to run after a browser reports an error:
 * it never connects to wallets, checks balances, signs, retries, or sends.
 */
import {JsonRpcProvider,Interface,getAddress,keccak256,formatEther,zeroPadValue,toBeHex}
  from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FIRST_SEAL} from './verify-first-squad-seal-readonly.mjs';

const ABI=new Interface([
  'function nextDuelId() view returns (uint256)',
  'function squadStatus(uint256 id) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns (uint256)',
  'function duelStatus(uint256 id) view returns (uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function openDuel(uint256 squadId) returns (uint256 duelId)',
  'event DuelOpened(uint256 indexed duelId,uint256 indexed squadId,address indexed challenger)'
]);
const equal=(a,b)=>getAddress(a)===getAddress(b);
const ensure=(condition,message)=>{
  if(!condition)throw Error('FIRST_DUEL_READONLY_INVALID '+message);
};
const readAt=async(provider,address,block,name,args=[])=>{
  const encoded=ABI.encodeFunctionData(name,args);
  const raw=await provider.call({to:address,data:encoded,blockTag:block});
  return ABI.decodeFunctionResult(name,raw);
};

export async function recoverFirstDuelPublic(provider,manifest,expected=FIRST_SEAL){
  ensure(manifest?.chainId===11155111&&manifest.contract==='SquadGambit','manifest');
  const address=getAddress(manifest.contractAddress);
  ensure(BigInt(await provider.send('eth_chainId',[]))===11155111n,'network');
  const block=await provider.getBlock('latest');
  ensure(block&&block.number>=expected.block,'latest block');
  const runtime=await provider.getCode(address,block.number);
  ensure(runtime!=='0x'&&
    keccak256(runtime).toLowerCase()===manifest.runtimeKeccak256.toLowerCase()&&
    (runtime.length-2)/2===manifest.runtimeBytes,'contract runtime');

  const [squad,index,latestDuelId]=await Promise.all([
    readAt(provider,address,block.number,'squadStatus',[expected.squadId]),
    readAt(provider,address,block.number,'duelForSquad',[expected.squadId]),
    readAt(provider,address,block.number,'nextDuelId')
  ]);
  ensure(equal(squad.owner,expected.owner),'squad owner');
  ensure(equal(squad.allowedOpponent,expected.challenger),'invited wallet');
  ensure(squad.active===true,'squad inactive');
  const indexedDuel=BigInt(index[0]);
  const latestCount=BigInt(latestDuelId[0]);
  ensure(indexedDuel<=latestCount,'duel index greater than counter');

  const topicId=zeroPadValue(toBeHex(1n),32);
  const eventInfo=ABI.getEvent('DuelOpened');
  const entries=await provider.getLogs({
    address,
    fromBlock:expected.block,
    toBlock:block.number,
    topics:[eventInfo.topicHash,topicId,topicId,
      zeroPadValue(expected.challenger,32)]
  });
  ensure(entries.length<=1,'duplicate one-use duel events');

  if(indexedDuel===0n){
    ensure(!squad.claimed&&entries.length===0,'claimed squad but missing duel index');
    return {
      state:'NOT_OPENED',chainId:11155111,squadId:'1',
      openDuelTransactionHash:null,duelId:null,
      claimed:false,submitted:false,
      latestBlock:block.number,
      balanceQueried:false,signed:false,transactionSent:false,
      instruction:'DO NOT RETRY BASED ON THE BROWSER ERROR ALONE; check wallet activity and network receipts first.'
    };
  }
  ensure(indexedDuel===1n&&entries.length===1,'unexpected or missing first DuelOpened event');
  ensure(squad.claimed===true,'squad not claimed');
  const entry=entries[0];
  const decoded=ABI.parseLog({topics:entry.topics,data:entry.data});
  ensure(decoded?.name==='DuelOpened'&&BigInt(decoded.args.duelId)===1n&&
    BigInt(decoded.args.squadId)===1n&&
    equal(decoded.args.challenger,expected.challenger),'decoded event');
  const [receipt,tx,duel]=await Promise.all([
    provider.getTransactionReceipt(entry.transactionHash),
    provider.getTransaction(entry.transactionHash),
    readAt(provider,address,block.number,'duelStatus',[1n])
  ]);
  ensure(receipt&&receipt.status===1&&tx,'successful opening transaction');
  ensure(receipt.blockHash===entry.blockHash&&tx.blockHash===entry.blockHash,'canonical event block');
  ensure(equal(receipt.to,address)&&equal(receipt.from,expected.challenger),'receipt addresses');
  ensure(equal(tx.to,address)&&equal(tx.from,expected.challenger),'sender and contract');
  ensure(tx.value===0n,'ETH transferred');
  const parsed=ABI.parseTransaction({data:tx.data,value:tx.value});
  ensure(parsed?.name==='openDuel'&&BigInt(parsed.args.squadId)===1n,'openDuel(1) selector');
  ensure(BigInt(duel.squadId)===1n&&equal(duel.challenger,expected.challenger),
    'canonical duel identity');
  const openedAt=BigInt(duel.openedAt);
  ensure(openedAt>0n,'missing timestamp');
  const deadline=openedAt+86400n;
  const realFee=receipt.gasUsed*receipt.gasPrice;
  return {
    state:'OPENED_ONCHAIN',chainId:11155111,
    squadId:'1',duelId:'1',
    openDuelTransactionHash:entry.transactionHash,openingBlock:entry.blockNumber,
    owner:getAddress(expected.owner),challenger:getAddress(expected.challenger),
    claimed:true,submitted:Boolean(duel.submitted),
    resolved:Boolean(duel.resolved),finalized:Boolean(duel.finalized),
    expired:Boolean(duel.expired),
    openedAtUnixSeconds:openedAt.toString(),
    submissionDeadlineUnixSeconds:deadline.toString(),
    submissionDeadlineUtc:new Date(Number(deadline)*1000).toISOString(),
    submissionWindowOpen:!duel.submitted&&!duel.expired&&
      BigInt(block.timestamp)<=deadline,
    gasUsed:receipt.gasUsed.toString(),
    actualFeeWei:realFee.toString(),
    actualFeeSepoliaETH:formatEther(realFee),
    underApprovedOpenCap:realFee<=200000000n,
    latestBlock:block.number,
    balanceQueried:false,signed:false,transactionSent:false,
    warning:'The approved one-use opening transaction has been consumed. Do not open again. The 24h challenger submission requires fresh authorization.'
  };
}

async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  const provider=new JsonRpcProvider(process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com');
  try{
    console.log('FIRST_DUEL_PUBLIC_RECOVERY '+
      JSON.stringify(await recoverFirstDuelPublic(provider,manifest)));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    console.error('FIRST_DUEL_PUBLIC_RECOVERY_FAILED '+
      (error instanceof Error?error.message:'unknown'));
    process.exitCode=1;
  });
