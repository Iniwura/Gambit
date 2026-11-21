/**
 * GAMBIT ARENA V3 — RESEARCH-ONLY PERSISTENT MATCH PROTOCOL MODEL
 *
 * IMPORTANT: this is NOT a smart contract, wallet transport, encryption SDK,
 * proof verifier or genuine authenticated online service. It models the
 * protocol state transitions *before* a separately audited Solidity/FHE
 * implementation. No real-world security claim can be derived from it.
 *
 * Features:
 * - precisely five rounds and two distinct fixed participants
 * - independent order commitments with duplicate/replay guards
 * - "ready -> resolving -> awaiting-proof -> next round" transitions
 * - proof verification via REQUIRED injected MOCK verifier for simulations
 * - fail-closed malformed state/proof/score behavior
 * - expiry before both commitments, with NO fabricated winner or refund claim
 * - recovery-friendly public projection with zero private plan fields
 *
 * Secret GAMBIT use flags are deliberately NOT represented as public booleans;
 * a future FHE contract must enforce one-use spend inside encrypted state.
 */

export const PROTOCOL_ROUNDS=5;
export const PROTOCOL_ROUND_DEADLINE=86400n;
export const PROTOCOL_MAX_SCORE=10;
export const PROTOCOL_MAX_MATCH_SCORE=50;
const ZERO='0x'+'0'.repeat(40);
const RE=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const publicAddress=address=>{
  if(typeof address!=='string'||!ADDRESS.test(address)||
     address.toLowerCase()===ZERO)throw Error('Invalid research player address.');
  return address.toLowerCase();
};
const isTime=x=>typeof x==='bigint'&&x>=0n;
const isRoundScore=x=>Number.isInteger(x)&&x>=0&&x<=PROTOCOL_MAX_SCORE;
const handle=x=>{
  if(typeof x!=='string'||!RE.test(x)||/^0x0{64}$/i.test(x))
    throw Error('Invalid ciphertext/result handle fingerprint.');
  return x.toLowerCase();
};
const clone=t=>({
  ...t,players:{...t.players},
  submissions:{...t.submissions},
  spentOrderHandles:[...t.spentOrderHandles],
  previousResultHandles:[...t.previousResultHandles],
  history:t.history.map(x=>({...x}))
});

/**
 * A public "match ID" in this simulator is only a human-legible identifier,
 * not a cryptographic chain domain separator or a deployed contract address.
 */
export function newArenaProtocolResearchMatch(matchId,playerA,playerB,startedAt){
  if(typeof matchId!=='string'||matchId.length<4||
     matchId.length>100||!/^[a-zA-Z0-9:-]+$/.test(matchId))
    throw Error('Invalid research match ID.');
  const a=publicAddress(playerA),b=publicAddress(playerB);
  if(a===b)throw Error('Two distinct participant addresses required.');
  if(!isTime(startedAt))throw Error('Invalid opening timestamp.');
  return {
    protocol:'arena-v3-STATE-MODEL-ONLY',
    matchId,players:{a,b},
    round:1,phase:'collecting',deadlineAt:startedAt+PROTOCOL_ROUND_DEADLINE,
    lastActionAt:startedAt,
    submissions:{a:null,b:null},resultHandle:null,
    spentOrderHandles:[],previousResultHandles:[],
    scoreA:0,scoreB:0,history:[],winner:null,abortReason:null
  };
}

function assertConsistent(state){
  if(!state||state.protocol!=='arena-v3-STATE-MODEL-ONLY'||
     typeof state.matchId!=='string'||!state.players||
     !ADDRESS.test(state.players.a)||!ADDRESS.test(state.players.b)||
     state.players.a===state.players.b||
     !Number.isInteger(state.round)||state.round<1||state.round>6||
     !['collecting','ready','resolving','awaiting-proof','finished','aborted'].includes(state.phase)||
     !isTime(state.deadlineAt)||!isTime(state.lastActionAt)||
     !state.submissions||!Array.isArray(state.history)||
     !Array.isArray(state.spentOrderHandles)||
     !Array.isArray(state.previousResultHandles)||
     !Number.isInteger(state.scoreA)||!Number.isInteger(state.scoreB)||
     state.scoreA<0||state.scoreB<0||
     state.scoreA>PROTOCOL_MAX_MATCH_SCORE||
     state.scoreB>PROTOCOL_MAX_MATCH_SCORE)
    throw Error('Corrupt Arena research protocol state.');
  for(const side of ['a','b']){
    const submission=state.submissions[side];
    if(submission!==null)handle(submission);
  }
  if(state.resultHandle!==null)handle(state.resultHandle);
  const accepted=state.history.length;
  if(accepted!==(state.phase==='finished'?PROTOCOL_ROUNDS:state.round-1))
    throw Error('Contradictory research round history.');
  if(state.phase==='finished'&&state.round!==PROTOCOL_ROUNDS+1)
    throw Error('Finished before five rounds.');
  if(state.phase!=='finished'&&state.round===PROTOCOL_ROUNDS+1)
    throw Error('Match progressed beyond five rounds without completion.');
  if(state.phase==='collecting'&&
      state.submissions.a!==null&&state.submissions.b!==null)
    throw Error('Collecting phase has both submissions.');
  if(['ready','resolving','awaiting-proof'].includes(state.phase)&&
      (state.submissions.a===null||state.submissions.b===null))
    throw Error('Missing both committed orders.');
  if((state.phase==='awaiting-proof')!==(state.resultHandle!==null))
    throw Error('Contradictory KMS proof state.');
  if(['finished','aborted'].includes(state.phase)&&
      (state.submissions.a!==null||state.submissions.b!==null))
    throw Error('Terminal match cannot retain pending commitments.');
  let totalA=0,totalB=0;
  const roundHandles=new Set();
  for(let i=0;i<accepted;i++){
    const row=state.history[i];
    if(!row||row.round!==i+1||
       !isRoundScore(row.pointsA)||!isRoundScore(row.pointsB)||
       typeof row.resultHandle!=='string')
      throw Error('Malformed completed round record.');
    handle(row.resultHandle);
    if(roundHandles.has(row.resultHandle))
      throw Error('Replayed round-result handle.');
    roundHandles.add(row.resultHandle);
    totalA+=row.pointsA;totalB+=row.pointsB;
    if(row.scoreA!==totalA||row.scoreB!==totalB)
      throw Error('Forged cumulative score in protocol history.');
  }
  if(state.scoreA!==totalA||state.scoreB!==totalB||
     state.previousResultHandles.length!==accepted||
     state.previousResultHandles.some((h,i)=>h!==state.history[i].resultHandle))
    throw Error('Protocol match score and proof lineage disagree.');
  if(state.spentOrderHandles.length!==2*accepted)
    throw Error('Previous round order commitments are missing or duplicated.');
  const spent=new Set(state.spentOrderHandles);
  if(spent.size!==state.spentOrderHandles.length)
    throw Error('Replayed encrypted order commitment.');
  for(const old of state.spentOrderHandles)handle(old);
  if(Object.values(state.submissions).some(s=>s!==null&&spent.has(s)))
    throw Error('Encrypted order already used by this match.');
  if(state.submissions.a!==null&&state.submissions.a===state.submissions.b)
    throw Error('Both players cannot reuse the same ciphertext commitment.');
  const expectedWinner=totalA===totalB?0:totalA>totalB?1:2;
  if(state.phase==='finished'&&state.winner!==expectedWinner)
    throw Error('Winner contradicts five-round aggregate score.');
  if(state.phase!=='finished'&&state.winner!==null)
    throw Error('Unverified winner before completion.');
  if((state.phase==='aborted')!==(state.abortReason!==null))
    throw Error('Inconsistent terminal abort status.');
}

export function submitArenaResearchOrder(state,participant,orderHandle,now){
  assertConsistent(state);
  if(state.phase!=='collecting')
    throw Error('This round is not collecting encrypted orders.');
  const caller=publicAddress(participant);
  if(!isTime(now)||now<state.lastActionAt)
    throw Error('Invalid or stale research chain time.');
  if(now>state.deadlineAt)
    throw Error('Round submission deadline has expired.');
  const side=caller===state.players.a?'a':caller===state.players.b?'b':null;
  if(side===null)throw Error('Only invited match participants may submit.');
  if(state.submissions[side]!==null)
    throw Error('This participant already submitted a private order.');
  const encryptedHandle=handle(orderHandle);
  if(state.spentOrderHandles.includes(encryptedHandle)||
     Object.values(state.submissions).includes(encryptedHandle))
    throw Error('Replay or cross-player reuse of a secret order handle.');
  const next=clone(state);
  next.submissions[side]=encryptedHandle;
  next.lastActionAt=now;
  if(next.submissions.a!==null&&next.submissions.b!==null)
    next.phase='ready';
  assertConsistent(next);
  return next;
}

export function beginArenaResearchResolution(state,now){
  assertConsistent(state);
  if(state.phase!=='ready')
    throw Error('Two submitted orders required before encrypted resolution.');
  if(!isTime(now)||now<state.lastActionAt)
    throw Error('Invalid or stale research chain time.');
  const next=clone(state);
  next.phase='resolving';next.lastActionAt=now;
  assertConsistent(next);
  return next;
}

export function recordArenaResearchResultHandle(state,resultHandle,now){
  assertConsistent(state);
  if(state.phase!=='resolving')
    throw Error('No encrypted resolution in progress.');
  if(!isTime(now)||now<state.lastActionAt)
    throw Error('Invalid or stale research chain time.');
  const h=handle(resultHandle);
  if(state.previousResultHandles.includes(h)||
     state.spentOrderHandles.includes(h)||
     Object.values(state.submissions).includes(h))
    throw Error('Replayed or aliased encrypted result handle.');
  const next=clone(state);
  next.resultHandle=h;next.phase='awaiting-proof';next.lastActionAt=now;
  assertConsistent(next);
  return next;
}

/**
 * Provisional signature callback is injected by tests. We REQUIRE a separate
 * verifier, but this JS simulator cannot establish a real Zama KMS signature.
 * Solidity must call FHE.checkSignatures against the exact stored handle.
 * Never import this function as a live wallet or scoring authority.
 */
export function finalizeArenaResearchRound(state,evidence,verifyProof,now){
  assertConsistent(state);
  if(state.phase!=='awaiting-proof')
    throw Error('No resolved encrypted round awaiting KMS proof.');
  if(!isTime(now)||now<state.lastActionAt)
    throw Error('Invalid or stale research chain time.');
  if(!evidence||typeof evidence!=='object'||typeof verifyProof!=='function')
    throw Error('Signed proof evidence and a separate verifier required.');
  const resultHandle=handle(evidence.resultHandle);
  if(resultHandle!==state.resultHandle)
    throw Error('KMS proof refers to a different ciphertext handle.');
  if(evidence.matchId!==state.matchId||evidence.round!==state.round||
     !isRoundScore(evidence.pointsA)||!isRoundScore(evidence.pointsB))
    throw Error('KMS proof context or round score is invalid.');
  // Four-bit team scores: 0..10 each. NOT compatible with v2's score*8.
  const packed=evidence.pointsA*16+evidence.pointsB;
  if(evidence.packedScore!==packed||
     packed<0||packed>255)
    throw Error('Provisional v3 four-bit score packing mismatch.');
  const verificationRequest=Object.freeze({
    matchId:state.matchId,round:state.round,
    resultHandle,packedScore:packed,proof:evidence.proof
  });
  if(verifyProof(verificationRequest)!==true)
    throw Error('Research proof verifier rejected a result.');
  const row={round:state.round,pointsA:evidence.pointsA,
    pointsB:evidence.pointsB,
    scoreA:state.scoreA+evidence.pointsA,
    scoreB:state.scoreB+evidence.pointsB,
    resultHandle};
  const next=clone(state);
  next.history.push(row);
  next.previousResultHandles.push(resultHandle);
  next.spentOrderHandles.push(next.submissions.a,next.submissions.b);
  next.submissions={a:null,b:null};next.resultHandle=null;
  next.lastActionAt=now;
  next.scoreA=row.scoreA;next.scoreB=row.scoreB;
  next.round++;
  if(next.round===PROTOCOL_ROUNDS+1){
    next.phase='finished';
    next.winner=next.scoreA===next.scoreB?0:next.scoreA>next.scoreB?1:2;
  }else{
    next.phase='collecting';
    next.deadlineAt=now+PROTOCOL_ROUND_DEADLINE;
  }
  assertConsistent(next);
  return next;
}

/** Abandon only a never-fully-submitted round; NEVER award a fake victory. */
export function expireArenaResearchRound(state,now){
  assertConsistent(state);
  if(state.phase!=='collecting')
    throw Error('A committed or pending FHE round cannot be cancelled by expiry.');
  if(!isTime(now)||now<=state.deadlineAt||now<state.lastActionAt)
    throw Error('Research round has not expired.');
  const next=clone(state);
  next.phase='aborted';
  next.submissions={a:null,b:null};
  next.abortReason='unsubmitted-round-expired';
  next.lastActionAt=now;
  assertConsistent(next);
  return next;
}

/**
 * Information projected to ANY external observer/automation. All fields
 * below are simulated research evidence, not verified onchain state.
 * No participant order handle, private plan, hidden gambit use or KMS proof.
 */
export function publicArenaResearchProtocolState(state){
  assertConsistent(state);
  return Object.freeze({
    trustLevel:'research-simulation-NOT-ONCHAIN',
    matchId:state.matchId,
    round:state.round,phase:state.phase,
    scoreA:state.scoreA,scoreB:state.scoreB,
    submissions:{a:state.submissions.a!==null,b:state.submissions.b!==null},
    winner:state.winner,abortReason:state.abortReason,
    history:Object.freeze(state.history.map(r=>
      Object.freeze({round:r.round,pointsA:r.pointsA,pointsB:r.pointsB,
        scoreA:r.scoreA,scoreB:r.scoreB})))
  });
}
