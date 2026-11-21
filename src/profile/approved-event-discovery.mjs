/**
 * GAMBIT Commander Profile — BOUNDED PUBLIC LOG DISCOVERY.
 *
 * Discover candidate duel IDs only from the immutable approved contract,
 * with canonical block hash checks and a cursor that fails closed on reorg.
 *
 * CRITICAL: candidates are NOT player records or verified victories. Every
 * discovered ID must separately pass verifyArenaProfileRecord() against
 * its canonical receipt, finalization proof and live contract state.
 *
 * No wallet, no signer, no transactions, no address profiling by default.
 */
import {Interface,getAddress} from 'ethers';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA} from './trusted-deployments.mjs';

const EVENT=new Interface([
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
]);
const PIN=TRUSTED_SQUAD_GAMBIT_SEPOLIA;
const BLOCKS_PER_QUERY=450;
const MAX_SCAN_BLOCKS=1800;
const MAX_CANDIDATES=100;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const requireValid=(ok,msg)=>{
  if(!ok)throw Error('PROFILE_DISCOVERY_INVALID '+msg);
};
const sameHash=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  a.toLowerCase()===b.toLowerCase();

/**
 * @param {object} provider read-only ethers-like JsonRpcProvider
 * @param {object} options {cursor?,maxBlocks?}; cursor is untrusted
 */
export async function discoverApprovedFinalizedDuels(provider,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))
    throw Error('PROFILE_DISCOVERY_INVALID options');
  const maxBlocks=options.maxBlocks??1200;
  requireValid(Number.isSafeInteger(maxBlocks)&&maxBlocks>=1&&
    maxBlocks<=MAX_SCAN_BLOCKS,'maximum scan window');
  const cursor=options.cursor??null;
  if(cursor!==null){
    requireValid(cursor&&typeof cursor==='object'&&!Array.isArray(cursor)&&
      Object.keys(cursor).sort().join(',')==='blockHash,lastBlock,version'&&
      cursor.version===1&&Number.isSafeInteger(cursor.lastBlock)&&
      cursor.lastBlock>=PIN.fromBlock-1&&HASH.test(cursor.blockHash),
      'cursor schema');
  }
  requireValid(BigInt(await provider.send('eth_chainId',[]))===BigInt(PIN.chainId),
    'wrong network');
  const head=await provider.getBlock('latest');
  requireValid(head&&Number.isSafeInteger(head.number)&&HASH.test(head.hash),
    'canonical head unavailable');
  const safeHead=head.number-(PIN.minimumConfirmations-1);
  if(cursor){
    requireValid(cursor.lastBlock<=safeHead,'cursor ahead of confirmed head');
    const checkpoint=await provider.getBlock(cursor.lastBlock);
    requireValid(checkpoint&&sameHash(checkpoint.hash,cursor.blockHash),
      'stale or reorged cursor block');
  }
  const from=cursor?cursor.lastBlock+1:PIN.fromBlock;
  const to=Math.min(safeHead,from+maxBlocks-1);
  const list=[];
  if(to>=from){
    const topics=EVENT.encodeFilterTopics('DuelFinalized',[]);
    for(let first=from;first<=to;first+=BLOCKS_PER_QUERY){
      const last=Math.min(first+BLOCKS_PER_QUERY-1,to);
      const logs=await provider.getLogs({
        address:PIN.contractAddress,fromBlock:first,toBlock:last,topics
      });
      requireValid(Array.isArray(logs)&&logs.length<=MAX_CANDIDATES,
        'malformed or oversized RPC event batch');
      for(const log of logs){
        requireValid(log&&getAddress(log.address)===PIN.contractAddress&&
          Number.isSafeInteger(log.blockNumber)&&
          log.blockNumber>=first&&log.blockNumber<=last&&
          HASH.test(log.blockHash)&&HASH.test(log.transactionHash),
          'untrusted event locator');
        let parsed;
        try{parsed=EVENT.parseLog(log)}catch{}
        requireValid(parsed?.name==='DuelFinalized'&&
          parsed.args.duelId>0n,'invalid finalization event');
        const mined=await provider.getBlock(log.blockNumber);
        requireValid(mined&&sameHash(mined.hash,log.blockHash),
          'orphaned event in scanned block');
        list.push({
          duelId:parsed.args.duelId.toString(),
          transactionHash:log.transactionHash.toLowerCase(),
          blockNumber:log.blockNumber,blockHash:log.blockHash.toLowerCase()
        });
        requireValid(list.length<=MAX_CANDIDATES,
          'too many events for one bounded discovery page');
      }
    }
  }
  const seen=new Set();
  for(const event of list){
    requireValid(!seen.has(event.duelId),'duplicate duel ID in discovery');
    seen.add(event.duelId);
  }
  list.sort((a,b)=>a.blockNumber-b.blockNumber||
    BigInt(a.duelId)<BigInt(b.duelId)?-1:BigInt(a.duelId)>BigInt(b.duelId)?1:0);
  const checkpointBlock=to>=from?to:cursor?.lastBlock??null;
  let nextCursor=cursor;
  if(checkpointBlock!==null&&to>=from){
    const checkBlock=await provider.getBlock(checkpointBlock);
    requireValid(checkBlock&&HASH.test(checkBlock.hash),
      'cursor checkpoint not available');
    nextCursor=Object.freeze({
      version:1,lastBlock:checkpointBlock,
      blockHash:checkBlock.hash.toLowerCase()
    });
  }
  const newHead=await provider.getBlock(head.number);
  requireValid(newHead&&sameHash(newHead.hash,head.hash),
    'chain head changed during discovery');
  if(nextCursor){
    const stillCanonical=await provider.getBlock(nextCursor.lastBlock);
    requireValid(stillCanonical&&sameHash(stillCanonical.hash,nextCursor.blockHash),
      'cursor changed before returning');
  }
  return Object.freeze({
    mode:'APPROVED_GAMBIT_EVENT_DISCOVERY',
    authority:'UNVERIFIED_CANDIDATES_ONLY',
    chainId:PIN.chainId,contractAddress:PIN.contractAddress,
    deploymentBlock:PIN.fromBlock,confirmedThrough:safeHead,
    scannedFrom:to>=from?from:null,scannedTo:to>=from?to:null,
    complete:to>=safeHead,nextCursor,
    candidates:Object.freeze(list.map(x=>Object.freeze(x))),
    walletConnected:false,signatureMade:false,transactionSent:false
  });
}
