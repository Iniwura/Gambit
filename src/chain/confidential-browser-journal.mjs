/** Browser-only public dispatch reservation. A shared same-origin Web Lock
 * must surround reserve/update/reconcile. Unsupported storage or locks are
 * deliberate blockers, never a reason to silently fall back to volatile state.
 * All stored fields are public metadata; calldata and secret payloads excluded.
 */
const KEY='gambit.confidential.pending.v1';
const LOCK='gambit.confidential.dispatch.v1';
const HASH=/^0x[0-9a-f]{64}$/i,ADDRESS=/^0x[0-9a-f]{40}$/i;
const DEC=/^(0|[1-9][0-9]*)$/;
const KEYS=['mode','action','actor','contract','runtimeHash','chainId','intentId','defender','calldataHash','id','step','gasLimit','maxFeePerGasWei','maxPriorityFeePerGasWei','maximumFeeWei','observedBlock','observedBlockHash','nonce','state','transactionHash'];
const check=(ok,label)=>{if(!ok)throw Error('CONFIDENTIAL_JOURNAL '+label)};
function validate(r){
 check(r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>KEYS.includes(k)),'unknown fields');
 check(['arena','blacksite'].includes(r.mode)&&typeof r.action==='string'&&/^[A-Z_]{3,30}$/.test(r.action)&&r.chainId===11155111,'identity');
 for(const k of ['actor','contract'])check(ADDRESS.test(r[k]),'address');
 check(r.defender===null||ADDRESS.test(r.defender),'defender');
 for(const k of ['runtimeHash','intentId','calldataHash','observedBlockHash'])check(HASH.test(r[k]),'hash');
 for(const k of ['gasLimit','maxFeePerGasWei','maxPriorityFeePerGasWei','maximumFeeWei'])check(typeof r[k]==='string'&&DEC.test(r[k]),'fee');
 for(const k of ['observedBlock','nonce'])check(Number.isSafeInteger(r[k])&&r[k]>=0,'counter');
 for(const k of ['id','step'])check(r[k]===null||Number.isSafeInteger(r[k])&&r[k]>0,'record index');
 check(r.state==='DISPATCHED_UNKNOWN'&&!Object.hasOwn(r,'transactionHash')||r.state==='HASH_RECEIVED'&&HASH.test(r.transactionHash),'state');
 return Object.freeze({...r});
}
export function createConfidentialBrowserJournal(storage){
 check(storage&&['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'),'persistent storage required');
 function read(){
  const raw=storage.getItem(KEY);if(raw===null)return null;
  return validate(JSON.parse(raw));
 }
 function put(record){const clean=validate(record);storage.setItem(KEY,JSON.stringify(clean));check(JSON.stringify(read())===JSON.stringify(clean),'persistence failed');}
 function reserve(record){check(read()===null&&record.state==='DISPATCHED_UNKNOWN','existing reservation');put(record);}
 function update(record){
  const old=read();check(old?.state==='DISPATCHED_UNKNOWN'&&record.state==='HASH_RECEIVED','missing dispatch reservation');
  const {state,transactionHash,...next}=record,{state:oldState,...before}=old;
  check(JSON.stringify(next)===JSON.stringify(before),'reservation changed');put(record);
 }
 // Intentionally no general clear/reset. Reconcile with canonical receipt first.
 // Call only while holding the same exclusive lock.
 function clearReconciled(receipt){
  const old=read();
  check(old&&['CONFIRMED_ACTION_RECEIPT','CONFIRMED_REVERTED'].includes(receipt?.state)&&HASH.test(receipt.transactionHash)&&(!old.transactionHash||old.transactionHash.toLowerCase()===receipt.transactionHash.toLowerCase()),'receipt reconciliation required');
  check(Number.isSafeInteger(receipt.blockNumber)&&receipt.blockNumber>old.observedBlock&&HASH.test(receipt.blockHash),'receipt identity');
  storage.removeItem(KEY);check(read()===null,'unable to clear reconciled reservation');
 }
 function clearReplacement(receipt){
  const old=read();
  check(old&&receipt?.state==='CONFIRMED_REPLACEMENT'&&HASH.test(receipt.transactionHash)&&(!old.transactionHash||old.transactionHash.toLowerCase()!==receipt.transactionHash.toLowerCase()),'replacement reconciliation required');
  check(receipt.originalIntentId===old.intentId&&receipt.actor===old.actor&&receipt.nonce===old.nonce&&Number.isSafeInteger(receipt.blockNumber)&&receipt.blockNumber>old.observedBlock&&HASH.test(receipt.blockHash),'replacement identity');
  storage.removeItem(KEY);check(read()===null,'unable to clear replacement reservation');
 }
 return Object.freeze({read,reserve,update,clearReconciled,clearReplacement});
}
export function createConfidentialBrowserLock(locks){
 check(locks&&typeof locks.request==='function','exclusive browser lock unavailable');
 return fn=>locks.request(LOCK,{mode:'exclusive'},fn);
}
