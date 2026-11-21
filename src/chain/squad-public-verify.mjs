/**
 * Public, wallet-free verifier for finalized SquadGambit duels.
 * This is a pure fail-closed check over onchain contract state. It never
 * decrypts a secret, infers per-fighter outcomes or accesses local practice.
 *
 * Live transport must independently check Sepolia and exact runtime hash.
 */
import {
  decodePackedSquadScore,squadDuelStep,validateSquadStatus
} from './squad-lifecycle.mjs';

const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  a.toLowerCase()===b.toLowerCase();

export function verifyFinalizedSquadSnapshot(duelId,duel,squad,linkedDuelId){
  if(typeof duelId!=='bigint'||duelId<=0n)
    throw Error('Duel ID must be a positive integer.');
  if(!duel||!squad||typeof linkedDuelId!=='bigint')
    throw Error('Incomplete public SquadGambit state.');
  if(squadDuelStep(duel,duel.challenger)!=='verified')
    throw Error('Duel is not finalized with a public KMS-verified score.');
  validateSquadStatus(squad);
  if(!squad.claimed||!same(squad.allowedOpponent,duel.challenger)
      ||linkedDuelId!==duelId)
    throw Error('Squad invitation and finalized duel identities do not match.');
  const score=decodePackedSquadScore(duel.packedScore);
  return Object.freeze({
    squadId:duel.squadId,duelId,
    pointsChallenger:score.challenger,
    pointsDefender:score.defender,
    outcome:score.outcome
  });
}
