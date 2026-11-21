/**
 * Finished LOCAL PRACTICE match insight, based on observed public lane
 * outcomes only. This MUST NEVER render a breakdown for FHE onchain games;
 * SquadGambit intentionally only decrypts the aggregate reactor totals.
 */
import {SQUAD_ROLES} from './squad.mjs';

export function buildPracticeMatchDebrief(match){
  if(!match||match.mode!=='local-squad'||!match.finished||
     !Number.isInteger(match.round)||match.round!==5||
     !Array.isArray(match.history)||match.history.length!==match.round||
     !Number.isInteger(match.scoreA)||!Number.isInteger(match.scoreB)||
     match.scoreA<0||match.scoreB<0||
     ![0,1,2].includes(match.winner)||
     match.winner!==(match.scoreA===match.scoreB?0:match.scoreA>match.scoreB?1:2))
    throw Error('Expected a completed, consistent local squad match.');
  const stats=SQUAD_ROLES.map(role=>({role,wins:0,losses:0,draws:0}));
  for(const event of match.history){
    if(!event||!Array.isArray(event.lanes)||event.lanes.length!==3)
      throw Error('Incomplete practice match evidence.');
    const seen=new Set();
    for(const lane of event.lanes){
      if(!lane||!Number.isInteger(lane.challengerIndex)||
         lane.challengerIndex<0||lane.challengerIndex>2||
         ![0,1,2].includes(lane.outcome)||seen.has(lane.challengerIndex))
        throw Error('Invalid practice match role or outcome.');
      seen.add(lane.challengerIndex);
      const role=stats[lane.challengerIndex];
      if(lane.outcome===1)role.wins++;
      else if(lane.outcome===2)role.losses++;
      else role.draws++;
    }
  }
  if(stats.some(stat=>stat.wins+stat.losses+stat.draws!==match.round))
    throw Error('Incomplete practice engagement history.');
  const ranked=[...stats].sort((a,b)=>
    (b.wins-b.losses)-(a.wins-a.losses)||b.wins-a.wins);
  const best=ranked[0];
  const weakest=ranked[ranked.length-1];
  const allEven=stats.every(stat=>stat.wins-stat.losses===best.wins-best.losses);
  const highlight=allEven
    ? 'BALANCED SQUAD · EACH ROLE CONTRIBUTED'
    : 'STANDOUT · '+best.role+' WON '+best.wins+' / '+match.round+' LANES';
  const adjustment=allEven
    ? 'Try a new formation and watch how the matchups change.'
    : weakest.losses>0
      ? 'REPROGRAM '+weakest.role+' · LOST '+weakest.losses+' ENGAGEMENTS'
      : 'Try new counters to exploit different opposing formations.';
  return Object.freeze({
    winner:match.winner,
    scoreline:match.scoreA+' : '+match.scoreB,
    highlight,adjustment,
    stats:stats.map(stat=>Object.freeze(stat))
  });
}
