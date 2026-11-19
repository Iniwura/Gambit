/**
 * GAMBIT's new three-role SOLO-PRACTICE rules engine.
 *
 * This is a separate cleartext prototype, not the deployed SealedGambit FHE
 * protocol. Every unit gets its OWN conditional order. The public event
 * contains only role outcomes and objective pressure, not either plan.
 */
import {STRATEGIES, validatePlan, resolveEncounter, nextRandom} from './engine.mjs';

export const SQUAD_ROLES = Object.freeze(['SCOUT','GUARDIAN','STRIKER']);
const STARTING_PLANS = Object.freeze([
  Object.freeze({base:2,trigger:0,response:1}), // Scout: flank, shield vs strike
  Object.freeze({base:1,trigger:2,response:0}), // Guardian: guard, punish flank
  Object.freeze({base:0,trigger:1,response:2})  // Striker: strike, flank vs guard
]);

export function startingSquadPlans() {
  return STARTING_PLANS.map(p=>({...p}));
}

export function validateSquadPlans(plans) {
  if(!Array.isArray(plans)||plans.length!==3)throw Error('Squad must have exactly three independent plans.');
  return plans.map(validatePlan);
}

export function makeSquadMatch(seed=0x16fa31) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid practice seed');
  return {mode:'local-squad',seed:seed>>>0,round:0,scoreA:0,scoreB:0,control:0,
    history:[],finished:false,winner:null};
}

export function enemySquadFor(match) {
  if(!match||match.mode!=='local-squad'||!Number.isInteger(match.round))
    throw Error('Invalid squad match');
  const s=nextRandom((match.seed ^ Math.imul(match.round+1,0x9e3779b1))>>>0);
  // Deterministic and match-specific; not a secret-bearing contract opponent.
  return SQUAD_ROLES.map((_,index)=>{
    const mix=nextRandom((s ^ Math.imul(index+1,0x85ebca6b))>>>0);
    return {...STRATEGIES[mix%STRATEGIES.length]};
  });
}

/**
 * All lane outcomes are publicly visible: 0 draw, 1 challenger, 2 defender.
 * Winning any lane gives one reactor point.
 * Striker wins add one breach point. A winning allied Scout marks an extra
 * weak spot (+1) but a victorious opposing Guardian blocks ONE bonus point.
 * Guardian cannot block the base point; a draw grants nothing.
 *
 * This scoring is symmetric when teams are swapped, bounded, deterministic,
 * and the 3 roles are not merely visual labels.
 */
export function scoreSquadOutcomes(outcomes) {
  if(!Array.isArray(outcomes)||outcomes.length!==3||
      outcomes.some(o=>!Number.isInteger(o)||o<0||o>2))
    throw Error('Three valid squad results are required.');
  const pressure=side=>{
    const wins=outcomes.filter(o=>o===side).length;
    const strikeWin=outcomes[2]===side;
    const mark=strikeWin&&outcomes[0]===side?1:0;
    const breach=strikeWin?1:0;
    const other=side===1?2:1;
    const blocked=strikeWin&&outcomes[1]===other?1:0;
    const bonus=Math.max(0,breach+mark-blocked);
    return {total:wins+bonus,base:wins,breach,mark,blocked,bonus};
  };
  return {challenger:pressure(1),defender:pressure(2)};
}

export function resolveSquadTurn(challengerPlans,defenderPlans) {
  const a=validateSquadPlans(challengerPlans);
  const b=validateSquadPlans(defenderPlans);
  const outcomes=a.map((p,index)=>resolveEncounter(p,b[index]).outcome);
  const scored=scoreSquadOutcomes(outcomes);
  return {lanes:outcomes.map((outcome,index)=>({role:SQUAD_ROLES[index],outcome})),
    pointsA:scored.challenger.total,pointsB:scored.defender.total,
    bonusesA:{breach:scored.challenger.breach,mark:scored.challenger.mark,blocked:scored.challenger.blocked},
    bonusesB:{breach:scored.defender.breach,mark:scored.defender.mark,blocked:scored.defender.blocked}};
}

export function commitSquadTurn(match,challengerPlans) {
  if(!match||match.mode!=='local-squad'||match.finished||!Number.isInteger(match.round)||
     match.round<0||match.round>=5) throw Error('Squad match is not active.');
  const plans=validateSquadPlans(challengerPlans);
  const opponent=enemySquadFor(match);
  const results=resolveSquadTurn(plans,opponent);
  const delta=Math.sign(results.pointsA-results.pointsB);
  const control=Math.max(-3,Math.min(3,match.control+delta));
  const next={
    ...match,round:match.round+1,scoreA:match.scoreA+results.pointsA,
    scoreB:match.scoreB+results.pointsB,control,
    history:match.history.slice()
  };
  const event={round:next.round,...results,scoreA:next.scoreA,scoreB:next.scoreB,control};
  next.history.push(event);
  next.finished=next.round>=5||Math.abs(control)===3;
  if(next.finished)
    next.winner=next.scoreA>next.scoreB?1:next.scoreB>next.scoreA?2:0;
  return {match:next,event};
}

export function verifySquadTranscript(seed,plansByTurn,publicEvents) {
  if(!Array.isArray(plansByTurn)||!Array.isArray(publicEvents)||
     plansByTurn.length!==publicEvents.length)return false;
  try {
    let state=makeSquadMatch(seed);
    for(let i=0;i<plansByTurn.length;i++){
      const turn=commitSquadTurn(state,plansByTurn[i]);
      if(JSON.stringify(turn.event)!==JSON.stringify(publicEvents[i]))return false;
      state=turn.match;
    }
    return true;
  } catch {return false;}
}
