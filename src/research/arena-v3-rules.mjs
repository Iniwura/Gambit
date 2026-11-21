/**
 * GAMBIT / Arena v3 gameplay RESEARCH ONLY.
 *
 * Strictly cleartext deterministic two-human rules prototype. This is NOT the
 * deployed SquadGambit protocol, FHE execution, a wallet client, an encrypted
 * duel, or code that should be imported into player-facing live online UI.
 *
 * Hypotheses under test:
 *  1. A public charged sector makes the actual sector assignment matter.
 *  2. One secret, once-per-match two-point wager per side adds a mind game
 *     without unbounded luck or automatic advantage.
 *  3. Five COMPLETE rounds earn a cumulative score, with a single winner rule.
 */
import {
  resolvePositionedSquadTurn,validateFormation,validateSquadPlans
} from '../squad.mjs';

export const ARENA_V3_ROUNDS=5;
export const GAMBIT_WAGER_POINTS=2;
export const ARENA_V3_MAX_ROUND_SCORE=10;
export const ARENA_V3_MAX_MATCH_SCORE=ARENA_V3_ROUNDS*ARENA_V3_MAX_ROUND_SCORE;

/** Fixed, public, predictable environment; no seeded or private random gate. */
export function chargedSectorForRound(round){
  if(!Number.isInteger(round)||round<0||round>=ARENA_V3_ROUNDS)
    throw Error('Arena v3 round must be 0–4.');
  return round%3;
}

export function validateArenaV3Order(order){
  if(!order||typeof order!=='object')
    throw Error('Complete Arena v3 secret squad order required.');
  const plans=validateSquadPlans(order.plans);
  const formation=validateFormation(order.formation);
  const gambitRole=order.gambitRole===null?null:order.gambitRole;
  if(gambitRole!==null&&
      (!Number.isInteger(gambitRole)||gambitRole<0||gambitRole>2))
    throw Error('GAMBIT must target a fighter role 0–2 or be unused (null).');
  return {plans,formation,gambitRole};
}

/**
 * Pure reference oracle. An authenticated FHE v3 would require different
 * packed-score encoding (each side can score 0–10, requiring FOUR bits each)
 * and its own separately audited encrypted matching implementation.
 *
 * This intentionally calls the existing symmetric v2 reference engine for
 * all role-based points. New rules add only one public-sector premium and
 * conditional risk pressure, so v2 parity remains directly testable.
 *
 * output.debug is cleartext research-only and must never be given to a public
 * onchain reporter. See projectArenaV3PublicResult() for strict allowlist.
 */
export function resolveArenaV3ResearchRound(orderA,orderB,round){
  const A=validateArenaV3Order(orderA),B=validateArenaV3Order(orderB);
  const chargedSector=chargedSectorForRound(round);
  const base=resolvePositionedSquadTurn(A.plans,B.plans,A.formation,B.formation);
  const aWins=base.lanes.filter(l=>l.outcome===1).length;
  const bWins=base.lanes.filter(l=>l.outcome===2).length;
  // The old Scout/Guardian/Striker bonuses remain role-based. One public
  // sector contributes an *additional* base point if the side wins it.
  let pointsA=base.pointsA+(base.lanes[chargedSector].outcome===1?1:0);
  let pointsB=base.pointsB+(base.lanes[chargedSector].outcome===2?1:0);
  const pressureA=pointsA,pressureB=pointsB;

  // Secret GAMBIT: choose ONE fighter to risk on this encounter; if that
  // fighter wins, collect +2. If they lose, the opponent collects +2.
  // Draw: wager is spent with no bonus. In a five-round match, each player
  // may stake exactly once, enforced by the match state below.
  const applyWager=(side,role)=>{
    if(role===null)return;
    const lane=base.lanes.find(l=>
      (side===1?l.challengerIndex:l.defenderIndex)===role);
    if(!lane)throw Error('Internal GAMBIT fighter pairing mismatch.');
    if(lane.outcome===0)return;
    const paidTo=lane.outcome===side?side:(side===1?2:1);
    if(paidTo===1)pointsA+=GAMBIT_WAGER_POINTS;
    else pointsB+=GAMBIT_WAGER_POINTS;
  };
  applyWager(1,A.gambitRole);
  applyWager(2,B.gambitRole);

  if(!Number.isInteger(pointsA)||!Number.isInteger(pointsB)||
     pointsA<0||pointsB<0||
     pointsA>ARENA_V3_MAX_ROUND_SCORE||
     pointsB>ARENA_V3_MAX_ROUND_SCORE)
    throw Error('Research rule result outside intended 4-bit team range.');
  return {
    chargedSector,pointsA,pointsB,
    // This debug evidence must stay in research and test scopes.
    debug:Object.freeze({lanes:base.lanes,basePointsA:base.pointsA,
      basePointsB:base.pointsB,
      aWins,bWins,pressureA,pressureB,
      gambitRoleA:A.gambitRole,gambitRoleB:B.gambitRole,
      formationA:A.formation,formationB:B.formation})
  };
}

export function makeArenaV3ResearchMatch(){
  return {mode:'arena-v3-cleartext-research',round:0,
    scoreA:0,scoreB:0,spentA:false,spentB:false,
    finished:false,winner:null,history:[]};
}

export function commitArenaV3ResearchRound(match,orderA,orderB){
  if(!match||match.mode!=='arena-v3-cleartext-research'||
     !Number.isInteger(match.round)||match.round<0||
     match.round>=ARENA_V3_ROUNDS||match.finished||
     !Number.isInteger(match.scoreA)||!Number.isInteger(match.scoreB)||
     typeof match.spentA!=='boolean'||typeof match.spentB!=='boolean'||
     !Array.isArray(match.history)||match.history.length!==match.round)
    throw Error('Arena v3 research match is not accepting another round.');
  // Protect our *local* reducer from accidentally consuming a truncated or
  // contradictory research transcript. This is NOT an authenticity check:
  // only a versioned onchain state machine can enforce one-use spends against
  // hostile transaction submitters.
  projectArenaV3PublicMatchState(match);
  for(const historical of match.history){
    if(!historical.debug||
       !Object.hasOwn(historical.debug,'gambitRoleA')||
       !Object.hasOwn(historical.debug,'gambitRoleB'))
      throw Error('Incomplete private research commitment history.');
  }
  if(match.spentA!==match.history.some(r=>r.debug.gambitRoleA!==null)||
     match.spentB!==match.history.some(r=>r.debug.gambitRoleB!==null))
    throw Error('Research GAMBIT spend marker and transcript disagree.');
  const A=validateArenaV3Order(orderA),B=validateArenaV3Order(orderB);
  if((match.spentA&&A.gambitRole!==null)||(match.spentB&&B.gambitRole!==null))
    throw Error('Each commander may play their secret GAMBIT only once.');
  const resolution=resolveArenaV3ResearchRound(A,B,match.round);
  const nextRound=match.round+1;
  const scoreA=match.scoreA+resolution.pointsA;
  const scoreB=match.scoreB+resolution.pointsB;
  const finished=nextRound===ARENA_V3_ROUNDS;
  const next={
    ...match,round:nextRound,scoreA,scoreB,
    spentA:match.spentA||A.gambitRole!==null,
    spentB:match.spentB||B.gambitRole!==null,
    finished,winner:finished?(scoreA===scoreB?0:scoreA>scoreB?1:2):null,
    history:[...match.history,{round:nextRound,...resolution,
      scoreA,scoreB}]
  };
  if(scoreA>ARENA_V3_MAX_MATCH_SCORE||scoreB>ARENA_V3_MAX_MATCH_SCORE)
    throw Error('Cumulative Arena v3 score exceeds match-bound.');
  return {match:next,round:next.history[next.history.length-1]};
}

/**
 * Clear public evidence projection for future v3 protocol design. It can be
 * applied to an AUTHENTICATED result by its caller; it does not authenticate
 * a local simulation by itself. No plans, formations, lane outcomes, gambit
 * target, debug history or private information are forwarded.
 */
export function projectArenaV3PublicRoundResult(source){
  if(!source||typeof source!=='object'||
     !Number.isInteger(source.round)||source.round<1||
     source.round>ARENA_V3_ROUNDS||
     !Number.isInteger(source.chargedSector)||
     source.chargedSector!==chargedSectorForRound(source.round-1)||
     !Number.isInteger(source.pointsA)||!Number.isInteger(source.pointsB)||
     source.pointsA<0||source.pointsB<0||
     source.pointsA>ARENA_V3_MAX_ROUND_SCORE||
     source.pointsB>ARENA_V3_MAX_ROUND_SCORE||
     !Number.isInteger(source.scoreA)||!Number.isInteger(source.scoreB)||
     source.scoreA<0||source.scoreB<0||
     source.scoreA>ARENA_V3_MAX_MATCH_SCORE||
     source.scoreB>ARENA_V3_MAX_MATCH_SCORE||
     source.scoreA<source.pointsA||source.scoreB<source.pointsB)
    throw Error('Invalid public Arena v3 round evidence.');
  return Object.freeze({
    round:source.round,chargedSector:source.chargedSector,
    pointsA:source.pointsA,pointsB:source.pointsB,
    scoreA:source.scoreA,scoreB:source.scoreB
  });
}


/**
 * The ONLY state an independent strategy bot / spectator / public client may
 * observe between research rounds. Never hand match.history directly to a
 * policy: research history holds debug lane results and secret GAMBIT roles.
 *
 * This is a disclosure projection, not a substitute for onchain proof.
 */
export function projectArenaV3PublicMatchState(match){
  if(!match||match.mode!=='arena-v3-cleartext-research'||
     !Number.isInteger(match.round)||match.round<0||
     match.round>ARENA_V3_ROUNDS||
     typeof match.finished!=='boolean'||
     match.finished!==(match.round===ARENA_V3_ROUNDS)||
     !Array.isArray(match.history)||match.history.length!==match.round||
     !Number.isInteger(match.scoreA)||!Number.isInteger(match.scoreB)||
     match.scoreA<0||match.scoreB<0||
     match.scoreA>ARENA_V3_MAX_MATCH_SCORE||
     match.scoreB>ARENA_V3_MAX_MATCH_SCORE||
     match.winner!==(match.finished?
       match.scoreA===match.scoreB?0:match.scoreA>match.scoreB?1:2:null))
    throw Error('Contradictory Arena v3 match state.');
  const publicHistory=match.history.map((event,index)=>{
    if(event.round!==index+1)
      throw Error('Arena v3 public history is out of sequence.');
    return projectArenaV3PublicRoundResult(event);
  });
  let sumA=0,sumB=0;
  for(const event of publicHistory){
    sumA+=event.pointsA;sumB+=event.pointsB;
    if(sumA!==event.scoreA||sumB!==event.scoreB)
      throw Error('Arena v3 public match cumulative score mismatch.');
  }
  if(sumA!==match.scoreA||sumB!==match.scoreB)
    throw Error('Arena v3 public match total does not match its history.');
  return Object.freeze({
    round:match.round,
    scoreA:match.scoreA,scoreB:match.scoreB,
    finished:match.finished,winner:match.winner,
    nextChargedSector:match.finished?null:chargedSectorForRound(match.round),
    history:Object.freeze(publicHistory)
  });
}
