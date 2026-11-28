/**
 * GAMBIT commitment RESEARCH candidate v0, not shipped gameplay.
 *
 * Each player MAY risk exactly one private chosen reactor sector in a
 * future multi-round game. A correct sector prediction adds two reactor
 * pressure; losing or drawing on it loses one available pressure
 * (clamped at zero). A player may use it at most once over a future
 * match, enforced by a separate proposed match state machine.
 *
 * This function runs ONLY on LOCAL CLEARTEXT reference outcomes. It cannot
 * claim onchain support, multi-round finality or privacy by itself.
 * Callers MUST NOT expose `lanes`, selected sectors or other secret plans
 * when rendering a real encrypted match. The output is aggregate-only.
 *
 * 0..5 existing per-round scores + max 2 = 0..7: pack into 3 bits/team
 * for a proposed v3 scoring format (NOT compatible with deployed v2's
 * 0..5 score validation).
 */
function stakeSector(sector){
  if(sector===null)return null;
  if(!Number.isInteger(sector)||sector<0||sector>2)
    throw Error('GAMBIT stake must target one of three reactor sectors or be unused');
  return sector;
}
export function scoreGambitCommitment(reference,challengerStake=null,defenderStake=null){
  if(!reference||typeof reference!=='object'||!Array.isArray(reference.lanes)||
    reference.lanes.length!==3||
    reference.lanes.some(lane=>!lane||!Number.isInteger(lane.outcome)||
      lane.outcome<0||lane.outcome>2)||
    !Number.isInteger(reference.pointsA)||reference.pointsA<0||reference.pointsA>5||
    !Number.isInteger(reference.pointsB)||reference.pointsB<0||reference.pointsB>5)
    throw Error('GAMBIT candidate requires valid local reference round');
  const a=stakeSector(challengerStake),b=stakeSector(defenderStake);
  const modifier=(sector,team)=>sector===null?0:
    reference.lanes[sector].outcome===team?2:-1;
  const pointsA=Math.max(0,Math.min(7,reference.pointsA+modifier(a,1)));
  const pointsB=Math.max(0,Math.min(7,reference.pointsB+modifier(b,2)));
  return Object.freeze({
    pointsA,pointsB,packed:pointsA*8+pointsB,
    outcome:pointsA===pointsB?0:pointsA>pointsB?1:2
  });
}
