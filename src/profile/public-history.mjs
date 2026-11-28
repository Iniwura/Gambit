/**
 * GAMBIT Commander Profile — OPT-IN, READ-ONLY VERIFIED HISTORY LOADER.
 *
 * Caller supplies a wallet address. The user never connects/signs with a
 * browser wallet and no private tactics, keys or proof bytes are stored.
 * This module accepts ONLY approved SquadGambit deployment events, verifies
 * each candidate's canonical finalization receipt independently, and labels
 * an unfinished scan as INCOMPLETE rather than claiming a complete rank.
 *
 * Public RPC is a trust assumption: it can omit events. Even COMPLETE means
 * 'this RPC's scanned, confirmed deployment logs', not Ethereum light-client
 * consensus. Callers must show this boundary to players.
 */
import {getAddress,keccak256} from 'ethers';
import {discoverApprovedFinalizedDuels}
  from './approved-event-discovery.mjs';
import {verifyArenaProfileRecord,deriveCommanderArenaProfile}
  from './verified-arena-record.mjs';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA as PIN}
  from './trusted-deployments.mjs';

const MAX_PAGES=16;
const MAX_CANDIDATES=100;
const HASH=/^0x[0-9a-fA-F]{64}$/;
function assert(ok,message){
  if(!ok)throw Error('PROFILE_PUBLIC_HISTORY_INVALID '+message);
}
function checkAbort(signal){
  if(signal?.aborted){
    const error=new Error('Public match lookup cancelled.');
    error.name='AbortError';
    throw error;
  }
}
/**
 * @param {object} provider ethers JsonRpcProvider (no signer)
 * @param {string} playerAddress opt-in public Ethereum address
 * @param {object} opts {signal?,maxPages?,onProgress?}
 */
export async function loadApprovedCommanderPublicHistory(
  provider,playerAddress,opts={}
){
  assert(opts&&typeof opts==='object'&&!Array.isArray(opts),
    'invalid options');
  let wallet;
  try{wallet=getAddress(playerAddress)}catch{
    throw Error('PROFILE_PUBLIC_HISTORY_INVALID enter a valid wallet address');
  }
  const maxPages=opts.maxPages??12;
  assert(Number.isSafeInteger(maxPages)&&maxPages>0&&
    maxPages<=MAX_PAGES,'maximum page count');
  assert(opts.onProgress===undefined||typeof opts.onProgress==='function',
    'progress callback');
  const signal=opts.signal;
  checkAbort(signal);
  // Even an empty history must originate from the APPROVED contract runtime.
  // Otherwise an RPC pointed at a fake contract could return no events and
  // our UI would incorrectly say "no matching games".
  assert(BigInt(await provider.send('eth_chainId',[]))===
    BigInt(PIN.chainId),'wrong chain');
  checkAbort(signal);
  const code=await provider.getCode(PIN.contractAddress);
  assert(code&&code!=='0x'&&HASH.test(PIN.runtimeHash)&&
    keccak256(code).toLowerCase()===PIN.runtimeHash.toLowerCase(),
    'approved contract runtime mismatch');
  let cursor=null,complete=false,pages=0;
  const seen=new Map();
  const trusted=[];
  let confirmedThrough=null;
  for(let i=0;i<maxPages;i++){
    checkAbort(signal);
    const page=await discoverApprovedFinalizedDuels(provider,{
      cursor,maxBlocks:1200
    });
    checkAbort(signal);
    assert(page.authority==='UNVERIFIED_CANDIDATES_ONLY'&&
      page.contractAddress===PIN.contractAddress&&
      page.chainId===PIN.chainId,'untrusted discovery page');
    for(const candidate of page.candidates){
      checkAbort(signal);
      const key=candidate.duelId;
      assert(!seen.has(key),'duplicate duel across discovery pages');
      seen.set(key,candidate);
      assert(seen.size<=MAX_CANDIDATES,'too many matches to verify in one lookup');
      // NEVER award a win directly from a discovered event.
      const record=await verifyArenaProfileRecord(
        provider,BigInt(key),PIN);
      checkAbort(signal);
      assert(record.transactionHash.toLowerCase()===candidate.transactionHash&&
        record.blockHash.toLowerCase()===candidate.blockHash&&
        record.blockNumber===candidate.blockNumber,
        'discovery disagrees with independently verified finalization');
      const owner=record.challenger.toLowerCase()===wallet.toLowerCase()||
        record.defender.toLowerCase()===wallet.toLowerCase();
      if(owner)trusted.push(record);
    }
    pages++;
    cursor=page.nextCursor;
    confirmedThrough=page.confirmedThrough;
    if(opts.onProgress){
      opts.onProgress(Object.freeze({
        pagesScanned:pages,candidatesChecked:seen.size,
        playerRecordsVerified:trusted.length,
        lastScannedBlock:page.scannedTo,
        completed:page.complete
      }));
    }
    if(page.complete){complete=true;break}
  }
  checkAbort(signal);
  const profile=deriveCommanderArenaProfile(wallet,trusted);
  return Object.freeze({
    version:1,
    mode:'approved-gambit-public-profile',
    status:complete?'COMPLETE_RPC_SCAN':'PARTIAL_RPC_SCAN',
    source:'read-only-canonical-Sepolia',
    wallet,chainId:PIN.chainId,contractAddress:PIN.contractAddress,
    pagesScanned:pages,candidatesChecked:seen.size,
    confirmedThrough,
    fullHistoryObserved:complete,
    rpcAbsenceIsNotCryptographicProof:true,
    matches:profile.matches,wins:profile.wins,
    losses:profile.losses,draws:profile.draws,
    verifiedHistory:Object.freeze([...profile.verifiedHistory]),
    walletConnected:false,signatureMade:false,transactionSent:false
  });
}
