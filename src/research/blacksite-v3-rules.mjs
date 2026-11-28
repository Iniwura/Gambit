/**
 * BLACKSITE competitive candidate v3 — cleartext architecture oracle ONLY.
 * No encryption, KMS proof, authentication, wallet or deployment.
 * Five slots, four symbols, four attempts. Route labels match the existing candidate.
 * Only a correct BREACH wins; a correct STEALTH/PROBE still consumes an attempt.
 */
export const BLACKSITE_V3=Object.freeze({slots:5,glyphs:4,attempts:4,routes:Object.freeze(['STEALTH','PROBE','BREACH'])});
const fail=(ok,msg)=>{if(!ok)throw Error('BLACKSITE_V3_INVALID '+msg)};
const code=x=>{fail(Array.isArray(x)&&x.length===5&&x.every(n=>Number.isInteger(n)&&n>=0&&n<4),'five glyphs');return x};
export function blacksiteV3Feedback(secret,guess,route){
 const a=code(secret),b=code(guess);
 fail(BLACKSITE_V3.routes.includes(route),'approach');
 let exact=0;const ac=[0,0,0,0],bc=[0,0,0,0];
 for(let i=0;i<5;i++){exact+=+(a[i]===b[i]);ac[a[i]]++;bc[b[i]]++;}
 const misplaced=ac.reduce((s,n,i)=>s+Math.min(n,bc[i]),0)-exact;
 return route==='STEALTH'?exact:route==='PROBE'?16+8*exact+misplaced:64+exact;
}
export function decodeBlacksiteV3Feedback(packet){
 fail(Number.isInteger(packet),'packet');
 let route,exact,misplaced=null;
 if(packet>=0&&packet<=5){route='STEALTH';exact=packet;}
 else if(packet>=16&&packet<=56){route='PROBE';exact=Math.floor((packet-16)/8);misplaced=(packet-16)%8;
  fail(exact+misplaced<=5&&!(exact===4&&misplaced===1),'impossible probe counts');
 }else if(packet>=64&&packet<=69){route='BREACH';exact=packet-64;}
 else fail(false,'packet range');
 return Object.freeze({route,exact,misplaced});
}
function projectHistory(history){
 let heat=0,status='ACTIVE',score=0;
 fail(Array.isArray(history)&&history.length<=4,'history');
 for(const row of history){
  fail(status==='ACTIVE','history after terminal');
  const f=decodeBlacksiteV3Feedback(row.packet);
  heat+=f.route==='PROBE'?1:f.route==='BREACH'?2:0;
  if(f.route==='BREACH'&&f.exact===5){status='BREACHED';score=Math.max(0,100-heat*10-(row.attempt-1)*5);}
  else if(row.attempt===4)status='LOCKED';
 }
 return {heat,status,score};
}
function validate(state){
 fail(state&&state.version===3&&state.mode==='LOCAL_BLACKSITE_V3_RESEARCH'&&typeof state.id==='string'&&/^[a-z0-9-]{1,64}$/.test(state.id),'state identity');
 fail(Array.isArray(state.history)&&state.history.every((r,i)=>r&&r.attempt===i+1),'attempt sequence');
 const p=projectHistory(state.history);
 fail(state.heat===p.heat&&state.score===p.score&&state.status===p.status,'inconsistent history');
 return p;
}
export function newBlacksiteV3Research(id){
 const state=Object.freeze({version:3,mode:'LOCAL_BLACKSITE_V3_RESEARCH',id,history:Object.freeze([]),heat:0,score:0,status:'ACTIVE'});
 validate(state);return state;
}
// The packet argument is synthetic local evidence. A real contract MUST bind
// an authentic proof to the exact mission/attempt/result handle before scoring.
export function settleBlacksiteV3Research(state,attempt,packet){
 validate(state);fail(state.status==='ACTIVE'&&attempt===state.history.length+1&&attempt<=4,'attempt unavailable');
 decodeBlacksiteV3Feedback(packet);
 const history=Object.freeze([...state.history,Object.freeze({attempt,packet})]);
 const next=Object.freeze({...state,history,...projectHistory(history)});validate(next);return next;
}
export function publicBlacksiteV3Research(state){
 validate(state);
 return Object.freeze({mode:state.mode,id:state.id,attemptsUsed:state.history.length,heat:state.heat,score:state.score,status:state.status,history:Object.freeze(state.history.map(r=>Object.freeze({attempt:r.attempt,...decodeBlacksiteV3Feedback(r.packet)})))});
}
