/**
 * ARENA v3 — public round/deadline policy RESEARCH ONLY.
 *
 * This is NOT the deployed SquadGambit contract, a settlement authority, a
 * signer or a multi-round FHE result. It accepts a hypothetical trusted public
 * status snapshot and derives read-only labels and next-step guidance.
 *
 * Safeguard: a timed-out or abandoned round NEVER becomes a scored win.
 * Two properly sealed orders may still be resolved after the entry deadline.
 * Future v3 contract must enforce deadlines, identity and proof at the source.
 */
export const ARENA_V3_ROUND_POLICY_VERSION=1;
export const ARENA_V3_MAX_ROUND_SECONDS=86400;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const ZERO='0x0000000000000000000000000000000000000000';
const MATCH_ID=/^research-[a-z0-9-]{1,48}$/;
const isTime=x=>Number.isSafeInteger(x)&&x>=0;
const isScore=x=>Number.isInteger(x)&&x>=0&&x<=7;
function check(ok,reason){if(!ok)throw Error('ARENA_V3_POLICY_INVALID '+reason)}
function address(s){return typeof s==='string'&&ADDRESS.test(s)&&s.toLowerCase()!==ZERO}
function seal(s,openedAt,deadlineAt){
  if(s===null)return null;
  check(s&&typeof s==='object'&&!Array.isArray(s)&&isTime(s.at)&&
    s.at>=openedAt&&s.at<=deadlineAt,'public seal timestamp');
  return Object.freeze({at:s.at});
}
export function evaluateArenaV3RoundStatus(snapshot,nowSeconds){
  check(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)&&
    snapshot.mode==='arena-v3-public-round-research'&&
    snapshot.version===ARENA_V3_ROUND_POLICY_VERSION&&
    MATCH_ID.test(snapshot.matchId)&&
    Number.isInteger(snapshot.round)&&snapshot.round>=1&&snapshot.round<=5&&
    snapshot.chainId===11155111&&
    address(snapshot.challenger)&&address(snapshot.defender)&&
    snapshot.challenger.toLowerCase()!==snapshot.defender.toLowerCase()&&
    isTime(snapshot.openedAt)&&isTime(snapshot.deadlineAt)&&
    snapshot.deadlineAt>snapshot.openedAt&&
    snapshot.deadlineAt-snapshot.openedAt<=ARENA_V3_MAX_ROUND_SECONDS&&
    isTime(nowSeconds)&&nowSeconds>=snapshot.openedAt&&
    snapshot.seals&&typeof snapshot.seals==='object'&&!Array.isArray(snapshot.seals)&&
    typeof snapshot.resolved==='boolean'&&
    typeof snapshot.finalized==='boolean','public round identity, timing or state');
  const challenger=seal(snapshot.seals.challenger,snapshot.openedAt,snapshot.deadlineAt);
  const defender=seal(snapshot.seals.defender,snapshot.openedAt,snapshot.deadlineAt);
  const two=Boolean(challenger&&defender);
  check(!(snapshot.resolved&&!two)&&
    !(snapshot.finalized&&!snapshot.resolved),'contradictory settlement');
  check((!challenger||nowSeconds>=challenger.at)&&
    (!defender||nowSeconds>=defender.at),'snapshot references a future seal');
  const finalScore=snapshot.finalScore;
  if(snapshot.finalized){
    check(finalScore&&typeof finalScore==='object'&&
      isScore(finalScore.challenger)&&isScore(finalScore.defender)&&
      finalScore.packed===finalScore.challenger*8+finalScore.defender&&
      finalScore.outcome===(finalScore.challenger===finalScore.defender?0:
        finalScore.challenger>finalScore.defender?1:2),'invalid final aggregate');
  }else check(finalScore===null,'unfinalized round exposes a final score');
  let status,action;
  if(snapshot.finalized){
    status='FINALIZED';action='NONE';
  }else if(snapshot.resolved){
    status='AWAITING_SIGNED_PROOF';action='WAIT_FOR_PROOF_AND_EXPLICIT_FINALIZATION';
  }else if(two){
    // Both inputs sealed on time. The deadline only closes NEW submissions;
    // a slow proving network must not erase their valid match.
    status='READY_TO_RESOLVE';action='RESOLVE_WITH_EXPLICIT_APPROVAL';
  }else if(nowSeconds>snapshot.deadlineAt){
    status='EXPIRED_UNSCORED';action='REQUEST_CANCEL_OR_NEW_MATCH';
  }else if(challenger||defender){
    status='WAITING_FOR_OPPONENT';action='WAIT_FOR_SECOND_SEAL';
  }else{
    status='WAITING_FOR_BOTH';action='WAIT_FOR_PLAYERS';
  }
  return Object.freeze({
    mode:'arena-v3-public-status-research',
    version:ARENA_V3_ROUND_POLICY_VERSION,
    matchId:snapshot.matchId,round:snapshot.round,
    chainId:snapshot.chainId,
    openedAt:snapshot.openedAt,deadlineAt:snapshot.deadlineAt,
    sealed:Object.freeze({challenger:Boolean(challenger),defender:Boolean(defender)}),
    status,action,
    // No inferred victory, cancellation, wallet activity or onchain finality.
    scored:snapshot.finalized,
    score:snapshot.finalized?Object.freeze({
      challenger:finalScore.challenger,defender:finalScore.defender,
      packed:finalScore.packed,outcome:finalScore.outcome
    }):null
  });
}
