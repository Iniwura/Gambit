/**
 * Authenticated read-only Arena v3 history.
 *
 * Discovery is only a candidate source. A candidate becomes Commander
 * evidence only after its creation receipt, canonical MatchCreated event,
 * pinned runtime, all finalized round events and final MatchCompleted event
 * agree with the current public match reader. No browser wallet, signer,
 * storage write or transaction is used here.
 */
import {Interface,getAddress,keccak256} from 'ethers';
import {readArenaV3PublicMatch} from '../arena/public-match-reader.mjs';
import {approvedArenaV3Deployment} from '../arena/approved-deployment.mjs';

const PIN=approvedArenaV3Deployment();
const ABI=new Interface([
  'event MatchCreated(uint256 indexed matchId,address indexed challenger,address indexed defender)',
  'event RoundFinalized(uint256 indexed matchId,uint8 indexed round,uint8 challengerPoints,uint8 defenderPoints,uint16 cumulativeChallenger,uint16 cumulativeDefender)',
  'event MatchCompleted(uint256 indexed matchId,uint8 outcome)'
]);
const MAX_PAGES=32;
const BLOCKS_PER_PAGE=1200;
const MAX_MATCHES=100;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const BRAND=new WeakSet();
const fail=(ok,message)=>{if(!ok)throw Error('ARENA_V3_HISTORY_INVALID '+message);};
const sameHash=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  a.toLowerCase()===b.toLowerCase();
const sameAddress=(a,b)=>{
  try{return getAddress(a)===getAddress(b)}catch{return false}
};
const abort=signal=>{if(signal?.aborted)throw Error('ARENA_V3_HISTORY_ABORTED');};

function checkedWallet(value){
  try{return getAddress(value)}catch{throw Error('ARENA_V3_HISTORY_INVALID wallet')}
}
function checkPin(){
  fail(PIN.contract==='ArenaV3Research'&&PIN.chainId===11155111&&
    Number.isSafeInteger(PIN.deploymentBlock)&&PIN.deploymentBlock>0&&
    HASH.test(PIN.runtimeHash),'approved Arena v3 pin');
}
async function canonicalBlock(provider,number,label){
  const block=await provider.getBlock(number);
  fail(block&&Number.isSafeInteger(block.number)&&block.number===number&&
    HASH.test(block.hash),label+' canonical block');
  return block;
}
function parsed(log,name){
  try{
    const value=ABI.parseLog(log);
    return value?.name===name?value:null;
  }catch{return null}
}
function logsFor(receipt,address,name){
  return receipt.logs.filter(log=>sameAddress(log.address,address)&&parsed(log,name));
}

async function verifyCreation(provider,log,head,wallet,signal){
  const event=parsed(log,'MatchCreated');
  fail(event&&BigInt(event.args.matchId)>0n,'MatchCreated event');
  const matchId=BigInt(event.args.matchId);
  const challenger=getAddress(event.args.challenger);
  const defender=getAddress(event.args.defender);
  fail(challenger!==defender,'self match');
  fail(sameAddress(challenger,wallet)||sameAddress(defender,wallet),
    'match not owned by selected commander');
  const [block,receipt,tx]=await Promise.all([
    canonicalBlock(provider,log.blockNumber,'creation'),
    provider.getTransactionReceipt(log.transactionHash),
    provider.getTransaction(log.transactionHash)
  ]);
  abort(signal);
  fail(receipt&&tx&&receipt.status===1,'creation receipt');
  fail(receipt.blockNumber===log.blockNumber&&sameHash(receipt.blockHash,log.blockHash)&&
    sameHash(tx.blockHash,log.blockHash),'creation canonical identity');
  fail(sameAddress(tx.to,PIN.address)&&sameAddress(receipt.to,PIN.address)&&
    tx.value===0n&&sameAddress(tx.from,challenger),'creation envelope');
  fail(head.number-log.blockNumber+1>=12,'creation confirmations');
  fail(logsFor(receipt,PIN.address,'MatchCreated').length===1,
    'unique MatchCreated receipt event');
  const publicMatch=await readArenaV3PublicMatch(provider,PIN,matchId,{signal});
  fail(sameAddress(publicMatch.challenger,challenger)&&
    sameAddress(publicMatch.defender,defender),'public participants');

  const finalizationLogs=await provider.getLogs({
    address:PIN.address,fromBlock:PIN.deploymentBlock,toBlock:head.number,
    topics:ABI.encodeFilterTopics('RoundFinalized',[matchId])
  });
  abort(signal);
  const rounds=finalizationLogs.map(log=>parsed(log,'RoundFinalized'))
    .filter(Boolean).map(event=>Object.freeze({
      round:Number(event.args.round),
      challengerPoints:Number(event.args.challengerPoints),
      defenderPoints:Number(event.args.defenderPoints),
      cumulativeChallenger:Number(event.args.cumulativeChallenger),
      cumulativeDefender:Number(event.args.cumulativeDefender)
    }));
  const uniqueRounds=new Set(rounds.map(row=>row.round));
  fail(rounds.length===uniqueRounds.size&&rounds.length<=5,'round finalization uniqueness');
  for(const row of rounds){
    fail(row.round>=1&&row.round<=5&&row.challengerPoints<=7&&
      row.defenderPoints<=7&&row.cumulativeChallenger<=35&&
      row.cumulativeDefender<=35,'round bounds');
  }
  if(publicMatch.complete){
    fail(rounds.length===5&&rounds.every(row=>row.round>=1&&row.round<=5),
      'complete match round evidence');
    const byRound=new Map(rounds.map(row=>[row.round,row]));
    for(const row of publicMatch.rounds){
      const eventRow=byRound.get(row.round);
      fail(eventRow&&row.finalized&&row.score&&
        eventRow.challengerPoints===row.score.challenger&&
        eventRow.defenderPoints===row.score.defender&&
        eventRow.cumulativeChallenger===publicMatch.rounds
          .filter(item=>item.round<=row.round)
          .reduce((sum,item)=>sum+(item.score?.challenger??0),0)&&
        eventRow.cumulativeDefender===publicMatch.rounds
          .filter(item=>item.round<=row.round)
          .reduce((sum,item)=>sum+(item.score?.defender??0),0),
        'round event/public score agreement');
    }
  }
  const completedLogs=await provider.getLogs({
    address:PIN.address,fromBlock:PIN.deploymentBlock,toBlock:head.number,
    topics:ABI.encodeFilterTopics('MatchCompleted',[matchId])
  });
  const completions=completedLogs.map(log=>parsed(log,'MatchCompleted')).filter(Boolean);
  if(publicMatch.complete){
    fail(completions.length===1&&
      Number(completions[0].args.outcome)===publicMatch.winner,
      'MatchCompleted evidence');
  }else fail(completions.length===0,'premature MatchCompleted evidence');

  const record=Object.freeze({
    version:1,evidence:'canonical-sepolia-arena-v3-match',
    chainId:PIN.chainId,contractAddress:PIN.address,
    runtimeHash:PIN.runtimeHash,matchId:matchId.toString(),
    creationTransaction:receipt.hash,creationBlock:receipt.blockNumber,
    challenger,defender,currentRound:publicMatch.currentRound,
    status:publicMatch.status,complete:publicMatch.complete,
    abandoned:publicMatch.abandoned,
    cumulative:Object.freeze({...publicMatch.cumulative}),
    winner:publicMatch.winner,
    rounds:Object.freeze(rounds.sort((a,b)=>a.round-b.round))
  });
  BRAND.add(record);
  return record;
}

export function isVerifiedArenaV3HistoryRecord(value){return BRAND.has(value);}

/**
 * Scan only the explicitly approved Arena v3 deployment. This is bounded and
 * read-only; an incomplete scan is never presented as a complete history.
 */
export async function loadApprovedArenaV3History(provider,wallet,options={}){
  checkPin();
  const commander=checkedWallet(wallet);
  fail(provider&&typeof provider.getNetwork==='function'&&
    typeof provider.getBlock==='function'&&typeof provider.getLogs==='function'&&
    typeof provider.getCode==='function','read-only provider');
  const maxPages=options.maxPages??MAX_PAGES;
  fail(Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=MAX_PAGES,'page bound');
  fail(options.onProgress===undefined||typeof options.onProgress==='function',
    'progress callback');
  const onProgress=options.onProgress;
  const signal=options.signal;
  abort(signal);
  const network=await provider.getNetwork();
  fail(BigInt(network.chainId)===11155111n,'Ethereum Sepolia network');
  const head=await provider.getBlock('latest');
  fail(head&&Number.isSafeInteger(head.number)&&HASH.test(head.hash),'latest head');
  const safeHead=head.number-11;
  const code=await provider.getCode(PIN.address,head.number);
  fail(code&&keccak256(code).toLowerCase()===PIN.runtimeHash.toLowerCase(),
    'Arena v3 runtime fingerprint');
  let from=PIN.deploymentBlock;
  const candidates=[];
  let pages=0;
  let complete=false;
  for(;pages<maxPages&&from<=safeHead;pages++){
    const to=Math.min(from+BLOCKS_PER_PAGE-1,safeHead);
    const logs=await provider.getLogs({
      address:PIN.address,fromBlock:from,toBlock:to,
      topics:ABI.encodeFilterTopics('MatchCreated',[])
    });
    abort(signal);
    fail(Array.isArray(logs)&&logs.length<=MAX_MATCHES,'bounded creation logs');
    for(const log of logs){
      const event=parsed(log,'MatchCreated');
      fail(event&&HASH.test(log.blockHash)&&HASH.test(log.transactionHash),
        'creation candidate');
      const participant=sameAddress(event.args.challenger,commander)||
        sameAddress(event.args.defender,commander);
      if(participant)candidates.push(log);
      fail(candidates.length<=MAX_MATCHES,'match history bound');
    }
    onProgress?.(Object.freeze({pagesScanned:pages+1,
      candidatesChecked:candidates.length}));
    from=to+1;
  }
  complete=from>safeHead;
  const seen=new Set();
  const matches=[];
  // New blocks may arrive while the bounded scan runs. Recheck the exact
  // snapshot block that defined the scan instead of rejecting normal chain
  // progress; a changed hash at that block is the reorg condition.
  const currentHead=await provider.getBlock(head.number);
  fail(currentHead&&sameHash(currentHead.hash,head.hash),'scan snapshot reorged');
  for(const log of candidates){
    const event=parsed(log,'MatchCreated');
    const id=event.args.matchId.toString();
    fail(!seen.has(id),'duplicate match candidate');
    seen.add(id);
    matches.push(await verifyCreation(provider,log,head,commander,signal));
  }
  const verified=Object.freeze(matches.sort((a,b)=>a.creationBlock-b.creationBlock));
  return Object.freeze({
    version:1,mode:'approved-arena-v3-commander-history',
    authority:'APPROVED_ARENA_V3_CANONICAL',status:complete?'COMPLETE_RPC_SCAN':'PARTIAL_RPC_SCAN',
    chainId:PIN.chainId,contractAddress:PIN.address,runtimeHash:PIN.runtimeHash,
    commander,pagesScanned:pages,scannedFrom:PIN.deploymentBlock,
    scannedTo:complete?safeHead:from-1,confirmedThrough:safeHead,
    candidatesChecked:candidates.length,
    fullHistoryObserved:complete,matches:verified,
    walletConnected:false,signatureMade:false,transactionSent:false
  });
}
