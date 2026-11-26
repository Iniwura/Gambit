/**
 * Proposed cosmetic eligibility contract, architecture-only.
 * The verified argument MUST come from a fresh branded-history profile reducer.
 * This helper itself is not a trust verifier, reward service, or minting authority.
 * Local counters are device-local/unranked, never eligible for competitive cosmetics.
 * No unlock modifies stats, tactics, score, secrecy, or access to core gameplay.
 */
const ids=(set)=>Object.freeze(set);
const count=n=>Number.isSafeInteger(n)&&n>=0;
export function cosmeticEligibility(local,verified){
 if(!local||!verified||!['arenaCompletions','academyCompletions','vaultBreaches'].every(k=>count(local[k]))||
    !['matches','wins','losses','draws','distinctOpponents'].every(k=>count(verified[k]))||
    verified.wins+verified.losses+verified.draws!==verified.matches||
    verified.distinctOpponents>verified.matches)throw Error('INVALID_COSMETIC_ELIGIBILITY');
 const practice=[],competitive=[];
 if(local.academyCompletions>=1)practice.push('ACADEMY_TRAINED_INSIGNIA');
 if(local.arenaCompletions>=1)practice.push('PRACTICE_OPERATOR_BANNER');
 if(local.vaultBreaches>=1)practice.push('TRAINING_VAULT_BADGE');
 if(verified.matches>=1)competitive.push('AUTHENTICATED_OPERATOR_INSIGNIA');
 if(verified.wins>=1)competitive.push('ARENA_VICTOR_BANNER');
 if(verified.distinctOpponents>=5)competitive.push('FIVE_RIVAL_MEDAL');
 // Blacksite verified rewards withheld until a neutral-source deployed mission
 // and approved receipt verifier exist. No cross-track transfer or leaderboard.
 return Object.freeze({version:1,localOnly:ids(practice),verifiedOnly:ids(competitive),
  verifiedBlacksite:ids([]),affectsGameplay:false});
}
