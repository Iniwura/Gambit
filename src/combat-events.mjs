/**
 * COMBAT SEMANTIC EVENT SCHEMA — NO RENDERING AND NO WALLET.
 *
 * A fight's choreography must be driven by evidence it may lawfully reveal.
 * Local practice may expose observed lane/role outcomes. A finalized FHE
 * duel may show ONLY aggregate authenticated score and generic squad-level
 * spectacle; no individual tactics, positions, lane winners or "counters".
 *
 * These projectors DO NOT cryptographically authenticate any data. The caller
 * must supply practice engine output or a contract-state-verified FHE result.
 */
import {SQUAD_ROLES,validateFormation} from './squad.mjs';
import {decodePackedSquadScore} from './chain/squad-lifecycle.mjs';

const isScore=x=>Number.isInteger(x)&&x>=0&&x<=5;
function freezeScript(mode,beats){
  return Object.freeze({mode,beats:Object.freeze(beats.map(b=>Object.freeze(b)))});
}

/**
 * Project an authoritative local practice event into renderable beats.
 * This accepts cleartext lane information ONLY in LOCAL practice mode.
 */
export function practiceCombatScript(event){
  if(!event||typeof event!=='object'||
     !Array.isArray(event.lanes)||event.lanes.length!==3||
     !isScore(event.pointsA)||!isScore(event.pointsB))
    throw Error('Expected a complete local practice battle event.');
  const formationA=validateFormation(event.formationA);
  const formationB=validateFormation(event.formationB);
  const challenger=new Set(),defender=new Set();
  const engagements=event.lanes.map((lane,i)=>{
    if(!lane||!Number.isInteger(lane.challengerIndex)||
       !Number.isInteger(lane.defenderIndex)||
       lane.challengerIndex<0||lane.challengerIndex>2||
       lane.defenderIndex<0||lane.defenderIndex>2||
       ![0,1,2].includes(lane.outcome)||
       challenger.has(lane.challengerIndex)||
       defender.has(lane.defenderIndex))
      throw Error('Invalid or duplicated practice fighter engagement.');
    challenger.add(lane.challengerIndex);
    defender.add(lane.defenderIndex);
    return {kind:'lane-engagement',lane:i,
      challengerRole:SQUAD_ROLES[lane.challengerIndex],
      defenderRole:SQUAD_ROLES[lane.defenderIndex],
      outcome:lane.outcome};
  });
  return freezeScript('local-practice',[
    {kind:'squad-deploy',formationA,formationB},
    ...engagements,
    {kind:'reactor-score',challenger:event.pointsA,defender:event.pointsB},
    {kind:'encounter-verdict',outcome:event.pointsA===event.pointsB?0:
      event.pointsA>event.pointsB?1:2}
  ]);
}

/**
 * Safe public animation envelope for a *previously verified* v2 FHE score.
 * No actor, formation or lane detail is selected from the secret outcome.
 * Renderers can add camera work, particle motion and sound to these generic
 * beats but must NOT infer hidden tactical facts.
 */
export function encryptedCombatScript(result){
  if(!result||typeof result!=='object'||
     !Number.isInteger(result.pointsChallenger)||
     !Number.isInteger(result.pointsDefender)||
     ![0,1,2].includes(result.outcome))
    throw Error('Verified aggregate squad score required.');
  const score=decodePackedSquadScore(
    result.pointsChallenger*8+result.pointsDefender);
  if(score.challenger!==result.pointsChallenger||
     score.defender!==result.pointsDefender||
     score.outcome!==result.outcome)
    throw Error('Contradictory aggregate squad outcome.');
  return freezeScript('encrypted-aggregate-only',[
    {kind:'sealed-squad-standoff',fightersPerSide:3},
    {kind:'reactor-score',challenger:score.challenger,defender:score.defender},
    {kind:'encounter-verdict',outcome:score.outcome}
  ]);
}
