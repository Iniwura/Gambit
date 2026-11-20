/**
 * PRACTICE-ONLY tactical insight.
 *
 * The local AI is a cleartext simulator: its plan is available to this
 * function after each turn. Never emit this trace in public event/history,
 * persist it as match state, or use it for an onchain player.
 *
 * Enemy next-round tactics are adaptive; tips describe LAST ROUND only.
 */
import {ACTIONS,resolveEncounter} from './engine.mjs';
import {FORMATIONS,validateFormation,validateSquadPlans} from './squad.mjs';

const ROLE_NAMES=['Scout','Guardian','Striker'];
const WINNERS=['drew with','beat','lost to'];
const COUNTER_TO=[1,2,0]; // GUARD > STRIKE, FLANK > GUARD, STRIKE > FLANK

export function buildPracticeInsight(ownPlans,simulatedBotPlans,ownFormation,botFormation){
  const own=validateSquadPlans(ownPlans);
  const bot=validateSquadPlans(simulatedBotPlans);
  const aSlots=FORMATIONS[validateFormation(ownFormation)].slots;
  const bSlots=FORMATIONS[validateFormation(botFormation)].slots;
  const lanes=aSlots.map((role,lane)=>{
    const opponent=bSlots[lane];
    const encounter=resolveEncounter(own[role],bot[opponent]);
    return {
      role:ROLE_NAMES[role],
      opponentRole:ROLE_NAMES[opponent],
      ownAction:ACTIONS[encounter.a],
      enemyAction:ACTIONS[encounter.b],
      ownCounterActivated:encounter.aTriggered,
      outcome:encounter.outcome
    };
  });
  // Failed activated counters are the most useful lesson, then successful
  // counters, then lost openings, then a standard lane. No AI oracle: this
  // is the result of a FINISHED simulated practice round.
  const rank=l=>l.ownCounterActivated
    ? l.outcome===2?0:l.outcome===1?1:2
    : l.outcome===2?3:l.outcome===0?4:5;
  const chosen=lanes.reduce((best,l)=>rank(l)<rank(best)?l:best,lanes[0]);
  const action=chosen.ownCounterActivated?'counter':'opening';
  const headline=chosen.role.toUpperCase()+' '+action.toUpperCase()+': '+
    chosen.ownAction+' '+WINNERS[chosen.outcome]+' '+chosen.enemyAction;
  const tip=chosen.outcome===2
    ? ACTIONS[COUNTER_TO[ACTIONS.indexOf(chosen.enemyAction)]]+
      ' would beat that '+chosen.enemyAction+' in a direct clash. The AI adapts.'
    : chosen.ownCounterActivated
      ? chosen.role+' counter activated. Consider when the opponent may adapt.'
      : 'This round used your '+chosen.role+' opening. Review the other roles.';
  return {practiceOnly:true,lanes,headline,tip};
}
