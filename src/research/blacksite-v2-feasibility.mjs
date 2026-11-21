/**
 * BLACKSITE v2 — RESEARCH RULES, not a deployed encrypted mission.
 *
 * The v1 tutorial secret has 4^4=256 choices and is optimally solvable
 * within its five-guess budget. We must not repurpose it as a competitive
 * security promise.
 *
 * This version tests a richer 5-glyph/6-symbol secret (6^5=7776 choices)
 * and a deliberate action economy: 6 TOTAL actions, max 5 code guesses
 * and 2 optional class scans. Each scan yields one aggregate symbol-count
 * hint and costs a real action. Scans may help but are not free.
 *
 * Even this 12.9-bit code is NOT an offline-resistant cryptographic secret.
 * Onchain viability depends on FHE ciphertext, one-use mission identities,
 * enforced attempts, privacy/noise threat model and explicit receipts.
 */
export const V2_LENGTH=5;
export const V2_ALPHABET=6;
export const V2_CODE_SPACE=V2_ALPHABET**V2_LENGTH; // 7776
export const V2_ACTION_BUDGET=6;
export const V2_GUESS_BUDGET=5;
export const V2_SCAN_BUDGET=2;
export const V2_CLASSES=Object.freeze({
  reactor:Object.freeze([0,1]),
  transit:Object.freeze([2,3]),
  security:Object.freeze([4,5])
});
const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isValidSymbol=x=>Number.isInteger(x)&&x>=0&&x<V2_ALPHABET;
export function validateV2Code(code){
  if(!Array.isArray(code)||code.length!==V2_LENGTH||
    code.some(x=>!isValidSymbol(x)))
    throw Error('BLACKSITE v2 code must contain exactly five glyphs 0..5');
  return Object.freeze([...code]);
}
export function allV2Codes(){
  const codes=[];
  for(let n=0;n<V2_CODE_SPACE;n++){
    let v=n;
    const code=new Array(V2_LENGTH);
    for(let i=V2_LENGTH-1;i>=0;i--){
      code[i]=v%V2_ALPHABET;
      v=Math.floor(v/V2_ALPHABET);
    }
    codes.push(Object.freeze(code));
  }
  return Object.freeze(codes);
}
export function scoreV2Guess(secret,guess){
  const a=validateV2Code(secret),b=validateV2Code(guess);
  let exact=0,common=0;
  const countA=new Array(V2_ALPHABET).fill(0);
  const countB=new Array(V2_ALPHABET).fill(0);
  for(let i=0;i<V2_LENGTH;i++){
    if(a[i]===b[i])exact++;
    countA[a[i]]++;countB[b[i]]++;
  }
  for(let n=0;n<V2_ALPHABET;n++)
    common+=Math.min(countA[n],countB[n]);
  return Object.freeze({exact,misplaced:common-exact});
}
export function scoreV2ClassScan(secret,className){
  const code=validateV2Code(secret);
  if(typeof className!=='string'||!has(V2_CLASSES,className))
    throw Error('Unknown BLACKSITE v2 scanner class');
  const set=new Set(V2_CLASSES[className]);
  return code.reduce((n,x)=>n+(set.has(x)?1:0),0);
}
/**
 * Public candidate deduction is a test research tool, not a UI leak.
 * A scan must consume an action, and duplicate scans or guesses are
 * rejected. All externally visible hints are aggregate only.
 */
export function candidateV2Codes(publicTranscript){
  if(!Array.isArray(publicTranscript)||
    publicTranscript.length>V2_ACTION_BUDGET)
    throw Error('Invalid BLACKSITE v2 transcript budget');
  const seenGuesses=new Set(),seenScans=new Set();
  let guessCount=0,scanCount=0;
  let candidates=allV2Codes();
  for(const item of publicTranscript){
    if(!item||typeof item!=='object'||Array.isArray(item))
      throw Error('Malformed BLACKSITE v2 public evidence');
    if(item.type==='guess'){
      guessCount++;
      const code=validateV2Code(item.guess);
      const key=code.join(',');
      if(seenGuesses.has(key))throw Error('Repeated vault guess');
      seenGuesses.add(key);
      const {exact,misplaced}=item;
      if(!Number.isInteger(exact)||!Number.isInteger(misplaced)||
        exact<0||misplaced<0||exact+misplaced>V2_LENGTH)
        throw Error('Invalid BLACKSITE v2 score');
      candidates=candidates.filter(secret=>{
        const hint=scoreV2Guess(secret,code);
        return hint.exact===exact&&hint.misplaced===misplaced;
      });
    }else if(item.type==='scan'){
      scanCount++;
      if(typeof item.className!=='string'||!has(V2_CLASSES,item.className))
        throw Error('Invalid BLACKSITE v2 scan');
      if(seenScans.has(item.className))throw Error('Repeated intelligence scan');
      seenScans.add(item.className);
      if(!Number.isInteger(item.count)||item.count<0||
        item.count>V2_LENGTH)throw Error('Invalid BLACKSITE v2 scan count');
      candidates=candidates.filter(code=>
        scoreV2ClassScan(code,item.className)===item.count);
    }else throw Error('Unknown BLACKSITE v2 action');
    if(guessCount>V2_GUESS_BUDGET||scanCount>V2_SCAN_BUDGET)
      throw Error('BLACKSITE v2 action limits exceeded');
    if(candidates.length===0)
      throw Error('Contradictory BLACKSITE v2 public evidence');
  }
  return candidates;
}
/**
 * Just a local policy evaluator. Do not claim that this produces an
 * authenticated KMS result or prevents caller-side tampering in a browser.
 */
export function evaluateV2ResearchAction(secret,publicTranscript,action){
  const code=validateV2Code(secret);
  const candidates=candidateV2Codes(publicTranscript);
  if(publicTranscript.length>=V2_ACTION_BUDGET)
    throw Error('BLACKSITE v2 research mission action budget exhausted');
  if(!action||typeof action!=='object')
    throw Error('Missing BLACKSITE v2 research action');
  let evidence;
  if(action.type==='guess'){
    const guess=validateV2Code(action.guess);
    const {exact,misplaced}=scoreV2Guess(code,guess);
    evidence=Object.freeze({type:'guess',guess,exact,misplaced});
  }else if(action.type==='scan'){
    const className=action.className;
    evidence=Object.freeze({
      type:'scan',className,
      count:scoreV2ClassScan(code,className)
    });
  }else throw Error('Unknown BLACKSITE v2 research action');
  const history=Object.freeze([...publicTranscript,evidence]);
  // Checking the new transcript also enforces action/scan/guess caps,
  // duplicate actions, impossible hints and terminal contradictions.
  const nextCandidates=candidateV2Codes(history);
  if(!nextCandidates.some(x=>x.every((v,i)=>v===code[i])))
    throw Error('Research candidate filter excluded actual code');
  const breached=evidence.type==='guess'&&evidence.exact===V2_LENGTH;
  const locked=!breached&&history.length>=V2_ACTION_BUDGET;
  return Object.freeze({
    evidence,
    history,
    status:breached?'breached':locked?'locked':'active',
    candidateCount:nextCandidates.length
  });
}
