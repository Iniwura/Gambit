/**
 * BLACKSITE / Vault Cipher — LOCAL REFERENCE RULES ONLY.
 *
 * Research prototype for a second FHE use case: a permanently hidden vault
 * code and deliberately limited aggregate codebreaking hints. Not onchain,
 * not encrypted, not imported into production UI. This pure engine allows
 * mathematical tests BEFORE any new Solidity contract or visual work.
 *
 * The hidden secret is present in local state for training; NEVER store such
 * a field as cleartext in the intended onchain protocol or analytics.
 */
export const VAULT_CODE_LENGTH=4;
export const VAULT_SYMBOLS=4;
export const VAULT_STANDARD_ATTEMPTS=5;

export function validateVaultCode(code){
  if(!Array.isArray(code)||code.length!==VAULT_CODE_LENGTH||
     code.some(v=>!Number.isInteger(v)||v<0||v>=VAULT_SYMBOLS))
    throw Error('Vault code requires exactly four symbols, each 0–3.');
  return code.slice();
}

/** Exact positions + correct-but-misplaced symbols, accounting for repeats. */
export function scoreVaultGuess(secret,guess){
  const code=validateVaultCode(secret),attempt=validateVaultCode(guess);
  let exact=0,common=0;
  const secretCounts=new Array(VAULT_SYMBOLS).fill(0);
  const guessCounts=new Array(VAULT_SYMBOLS).fill(0);
  for(let i=0;i<VAULT_CODE_LENGTH;i++){
    if(code[i]===attempt[i])exact++;
    secretCounts[code[i]]++;guessCounts[attempt[i]]++;
  }
  for(let symbol=0;symbol<VAULT_SYMBOLS;symbol++)
    common+=Math.min(secretCounts[symbol],guessCounts[symbol]);
  return Object.freeze({exact,misplaced:common-exact});
}

export function allVaultCodes(){
  const all=[];
  for(let n=0;n<VAULT_SYMBOLS**VAULT_CODE_LENGTH;n++){
    const code=[];
    let value=n;
    for(let i=0;i<VAULT_CODE_LENGTH;i++){
      code.push(value%VAULT_SYMBOLS);
      value=Math.floor(value/VAULT_SYMBOLS);
    }
    all.push(code.reverse());
  }
  return all;
}

/** Independent deduction engine, using public hint evidence only. */
export function vaultCandidates(publicHistory){
  if(!Array.isArray(publicHistory))throw Error('Vault feedback history required.');
  const seen=new Set();
  let candidates=allVaultCodes();
  for(const item of publicHistory){
    if(!item||typeof item!=='object')throw Error('Malformed vault clue.');
    const guess=validateVaultCode(item.guess);
    if(!Number.isInteger(item.exact)||!Number.isInteger(item.misplaced)||
       item.exact<0||item.misplaced<0||
       item.exact+item.misplaced>VAULT_CODE_LENGTH)
      throw Error('Invalid aggregate vault clue.');
    const key=guess.join('');
    if(seen.has(key))throw Error('Duplicate vault clue attempt.');
    seen.add(key);
    candidates=candidates.filter(secret=>{
      const clue=scoreVaultGuess(secret,guess);
      return clue.exact===item.exact&&clue.misplaced===item.misplaced;
    });
    if(candidates.length===0)throw Error('Contradictory vault feedback.');
  }
  return candidates;
}

export function makeVaultTraining(secret,maxAttempts=VAULT_STANDARD_ATTEMPTS){
  if(!Number.isInteger(maxAttempts)||maxAttempts<4||maxAttempts>6)
    throw Error('Vault attempt budget must be between four and six.');
  return {mode:'blacksite-training',secret:validateVaultCode(secret),
    maxAttempts,round:0,status:'active',history:[]};
}

/** Privacy boundary: only explicitly allowed evidence, never the secret. */
export function publicVaultTrainingState(state){
  if(!state||state.mode!=='blacksite-training'||
     !['active','breached','locked'].includes(state.status)||
     !Number.isInteger(state.round)||state.round<0||
     !Number.isInteger(state.maxAttempts)||
     !Array.isArray(state.history)||state.history.length!==state.round)
    throw Error('Invalid vault training state.');
  return Object.freeze({round:state.round,remaining:state.maxAttempts-state.round,
    status:state.status,history:state.history.map(item=>
      Object.freeze({...item,guess:Object.freeze(item.guess.slice())}))});
}

export function submitVaultTrainingGuess(state,guess){
  if(!state||state.mode!=='blacksite-training'||state.status!=='active'||
     !Array.isArray(state.history)||state.history.length!==state.round||
     !Number.isInteger(state.round)||!Number.isInteger(state.maxAttempts)||
     state.round>=state.maxAttempts)
    throw Error('Vault mission is not accepting guesses.');
  const normalized=validateVaultCode(guess),key=normalized.join('');
  if(state.history.some(event=>event.guess.join('')===key))
    throw Error('Repeated guesses do not reveal new intelligence.');
  const clue=scoreVaultGuess(state.secret,normalized);
  const nextRound=state.round+1;
  const status=clue.exact===VAULT_CODE_LENGTH?'breached':
    nextRound>=state.maxAttempts?'locked':'active';
  const event=Object.freeze({round:nextRound,guess:Object.freeze(normalized),
    exact:clue.exact,misplaced:clue.misplaced,status,
    remaining:state.maxAttempts-nextRound});
  const next={...state,round:nextRound,status,
    // Only public feedback enters history. The secret remains private.
    history:[...state.history,event]};
  return {state:next,event};
}
