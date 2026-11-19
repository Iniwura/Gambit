/**
 * Post-round practice debrief from observed PUBLIC encounter results only.
 * Onchain SquadGambit intentionally reveals ONLY aggregate scores.
 * Never reuse this role-by-role debrief for an encrypted onchain match.
 */
import {FORMATIONS,validateFormation} from './squad.mjs';

const ROLE_LABELS=['SCOUT','GUARDIAN','STRIKER'];
const VERDICTS=['DRAW','CYAN','VIOLET'];

export function buildPracticeDebrief(event){
  if(!event||!Number.isInteger(event.round)||event.round<1||event.round>5
      ||!Number.isInteger(event.pointsA)||event.pointsA<0||event.pointsA>5
      ||!Number.isInteger(event.pointsB)||event.pointsB<0||event.pointsB>5
      ||!Array.isArray(event.lanes)||event.lanes.length!==3)
    throw Error('Invalid public practice round');
  const fa=validateFormation(event.formationA);
  const fb=validateFormation(event.formationB);
  const lanes=event.lanes.map((lane,index)=>{
    if(!lane||!Number.isInteger(lane.challengerIndex)||lane.challengerIndex<0||lane.challengerIndex>2
        ||!Number.isInteger(lane.defenderIndex)||lane.defenderIndex<0||lane.defenderIndex>2
        ||!Number.isInteger(lane.outcome)||lane.outcome<0||lane.outcome>2)
      throw Error('Invalid public lane result');
    if(FORMATIONS[fa].slots[index]!==lane.challengerIndex
        ||FORMATIONS[fb].slots[index]!==lane.defenderIndex)
      throw Error('Lane roles do not match public formations');
    return {
      lane:index+1,
      leftRole:ROLE_LABELS[lane.challengerIndex],
      rightRole:ROLE_LABELS[lane.defenderIndex],
      outcome:lane.outcome,
      verdict:VERDICTS[lane.outcome]
    };
  });
  const bA=event.bonusesA,bB=event.bonusesB;
  if(!bA||!bB)throw Error('Missing public reactor bonuses');
  let note='REPROGRAM YOUR THREE FIGHTERS FOR THE NEXT ENGAGEMENT';
  if(bB.blocked)note='YOUR GUARDIAN STOPPED ONE ENEMY BREACH BONUS';
  else if(bA.blocked)note='ENEMY GUARDIAN STOPPED YOUR BREACH BONUS';
  else if(bA.mark)note='SCOUT + STRIKER CREATED EXTRA REACTOR PRESSURE';
  else if(bB.mark)note='ENEMY SCOUT + STRIKER COMBINED FOR EXTRA PRESSURE';
  else if(bA.breach)note='STRIKER BROKE THROUGH FOR BONUS PRESSURE';
  return {
    round:event.round,
    heading:'ROUND '+event.round+'  ·  '+FORMATIONS[fa].name+' vs '+FORMATIONS[fb].name,
    scoreline:'CYAN +'+event.pointsA+'  /  VIOLET +'+event.pointsB,
    note,lanes
  };
}
