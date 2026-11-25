/**
 * Persistent Commander identity and evidence-derived progression.
 *
 * The durable part is deliberately small: a public wallet address and an
 * optional call sign. History, achievements and progression are recomputed
 * from freshly verified Arena v3 receipts on every load. localStorage is not
 * an authority and cannot mint wins, levels or mission results.
 */
import {getAddress} from 'ethers';
import {isVerifiedArenaV3HistoryRecord} from './arena-v3-history.mjs';

export const COMMANDER_PROFILE_VERSION=1;
const KEY_PREFIX='gambit.commander.identity.v1:';
const CALLSIGN=/^[A-Z0-9][A-Z0-9 _-]{0,23}$/;
const fail=(ok,message)=>{if(!ok)throw Error('COMMANDER_PROFILE_INVALID '+message);};

function address(value){
  try{return getAddress(value)}catch{throw Error('COMMANDER_PROFILE_INVALID wallet address')}
}
function callSign(value){
  const normalized=String(value??'COMMANDER').trim().toUpperCase();
  fail(CALLSIGN.test(normalized),'call sign');
  return normalized;
}
function identityShape(value){
  fail(value&&typeof value==='object'&&!Array.isArray(value),'identity');
  const wallet=address(value.address);
  fail(value.version===COMMANDER_PROFILE_VERSION&&value.chainId===11155111,
    'identity version/network');
  fail(typeof value.createdAt==='number'&&Number.isSafeInteger(value.createdAt)&&
    value.createdAt>0,'identity creation time');
  return Object.freeze({
    version:COMMANDER_PROFILE_VERSION,chainId:11155111,
    address:wallet,callSign:callSign(value.callSign),createdAt:value.createdAt
  });
}

export function commanderIdentityStorageKey(wallet){
  return KEY_PREFIX+address(wallet).toLowerCase();
}

export function createCommanderIdentity(wallet,options={}){
  const createdAt=options.createdAt??Date.now();
  return identityShape({version:COMMANDER_PROFILE_VERSION,chainId:11155111,
    address:wallet,callSign:options.callSign,createdAt});
}

/** Only public identity fields are written; no receipts, ciphertexts or proofs. */
export function saveCommanderIdentity(storage,identity){
  fail(storage&&typeof storage.setItem==='function','storage');
  const safe=identityShape(identity);
  storage.setItem(commanderIdentityStorageKey(safe.address),JSON.stringify(safe));
  return safe;
}

export function loadCommanderIdentity(storage,wallet){
  fail(storage&&typeof storage.getItem==='function','storage');
  const raw=storage.getItem(commanderIdentityStorageKey(wallet));
  if(raw===null)return null;
  try{return identityShape(JSON.parse(raw))}catch{return null}
}

export function publicCommanderIdentity(identity){
  const safe=identityShape(identity);
  return Object.freeze({version:safe.version,chainId:safe.chainId,
    address:safe.address,callSign:safe.callSign,createdAt:safe.createdAt});
}

function owned(record,wallet){
  return record.challenger.toLowerCase()===wallet.toLowerCase()||
    record.defender.toLowerCase()===wallet.toLowerCase();
}
function won(record,wallet){
  if(record.winner===0)return false;
  const challenger=record.challenger.toLowerCase()===wallet.toLowerCase();
  return (challenger&&record.winner===1)||(!challenger&&record.winner===2);
}

/**
 * Derive a Commander view only from branded canonical Arena v3 records.
 * Local training and stored JSON are intentionally ineligible.
 */
export function deriveCommanderProfile(identity,history){
  const safe=identityShape(identity);
  fail(history&&history.authority==='APPROVED_ARENA_V3_CANONICAL',
    'unapproved history authority');
  fail(Array.isArray(history.matches),'history matches');
  const records=history.matches.filter(record=>{
    fail(isVerifiedArenaV3HistoryRecord(record),'unverified Arena v3 record');
    fail(owned(record,safe.address),'history record not owned by commander');
    return true;
  });
  const matches=records.length;
  const wins=records.filter(record=>won(record,safe.address)).length;
  const losses=records.filter(record=>record.winner!==0&&!won(record,safe.address)).length;
  const draws=records.filter(record=>record.winner===0).length;
  const completed=records.filter(record=>record.complete&&record.currentRound===5);
  const achievements=[];
  if(matches>0)achievements.push(Object.freeze({
    id:'ARENA_FIRST_MATCH',title:'First authenticated Arena match',
    evidence:records[0].creationTransaction,block:records[0].creationBlock
  }));
  if(completed.length>0)achievements.push(Object.freeze({
    id:'ARENA_FIVE_ROUND',title:'Five-round operator',
    evidence:completed[0].creationTransaction,block:completed[0].creationBlock
  }));
  if(wins>0)achievements.push(Object.freeze({
    id:'ARENA_VICTORY',title:'Arena victor',
    evidence:records.find(record=>won(record,safe.address)).creationTransaction,
    block:records.find(record=>won(record,safe.address)).creationBlock
  }));
  // BLACKSITE achievements remain absent until a deployed mission receipt is
  // independently approved. Cleartext practice never advances this rank.
  const xp=wins*100+completed.length*50;
  return Object.freeze({
    version:COMMANDER_PROFILE_VERSION,chainId:safe.chainId,
    address:safe.address,callSign:safe.callSign,createdAt:safe.createdAt,
    source:history.fullHistoryObserved?'APPROVED_ARENA_V3_CANONICAL_HISTORY':'PARTIAL_CANONICAL_HISTORY',
    matches,wins,losses,draws,level:1+Math.floor(xp/100),xp,
    achievements:Object.freeze(achievements),
    verifiedHistory:Object.freeze([...records]),
    blacksiteProgress:Object.freeze({verifiedMissions:0,achievements:[]}),
    persistentIdentity:true,historyPersisted:false,
    walletConnected:false,signatureMade:false,transactionSent:false
  });
}
