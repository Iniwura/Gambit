/**
 * GAMBIT v3 — two-person LOCAL HOTSEAT controller, never network multiplayer.
 *
 * This app-level reducer wraps the real five-round v3 research domain; it
 * never invents scores, silently submits for the opponent or issues a wallet
 * action. UI must render publicArenaHotseat only, not this PRIVATE state.
 * Pending cleartext plans in memory are NOT cryptographic confidentiality.
 */
import {
  makeArenaV3ResearchMatch,submitArenaV3ResearchOrder,
  settleArenaV3ResearchRound,publicArenaV3Snapshot
} from '../research/arena-v3-match.mjs';

export const ARENA_HOTSEAT_VERSION=1;
const PHASES=['briefing','planning','handoff','ready-to-resolve','review','complete'];
const SIDES=['challenger','defender'];
const check=(ok,msg)=>{if(!ok)throw Error('ARENA_HOTSEAT_INVALID '+msg)};
const snapshot=(data)=>Object.freeze(data);
function validate(session){
  check(session&&typeof session==='object'&&!Array.isArray(session)
    &&session.version===ARENA_HOTSEAT_VERSION
    &&session.mode==='arena-v3-local-hotseat'
    &&PHASES.includes(session.phase)
    &&SIDES.includes(session.side)
    &&session.match&&typeof session.match==='object','session');
  const match=publicArenaV3Snapshot(session.match); // delegate domain validation
  check(match.mode==='arena-v3-aggregate-research','domain');
  if(session.phase==='briefing'){
    check(match.round===1&&match.status==='planning'&&match.history.length===0
      &&session.side==='challenger','briefing');
  }
  if(session.phase==='handoff')check(
    match.status==='planning'&&session.side==='defender'
    &&session.match.pending.challenger!==null
    &&session.match.pending.defender===null,'handoff');
  if(session.phase==='ready-to-resolve')check(match.status==='ready-to-settle','ready');
  if(session.phase==='review')check(match.status==='planning'
    &&match.history.length>=1&&match.history.length<5,'review');
  if(session.phase==='complete')check(match.status==='finished'
    &&match.history.length===5,'complete');
  if(session.phase==='planning')check(match.status==='planning','planning');
  return match;
}
export function createArenaHotseatSession(id){
  return snapshot({mode:'arena-v3-local-hotseat',version:ARENA_HOTSEAT_VERSION,
    phase:'briefing',side:'challenger',match:makeArenaV3ResearchMatch(id)});
}
/**
 * Public UI state intentionally excludes every plan, formation and target,
 * including when the previous player has sealed or a match is fully over.
 */
export function publicArenaHotseat(session){
  const match=validate(session);
  return Object.freeze({
    mode:'arena-v3-hotseat-view',version:ARENA_HOTSEAT_VERSION,
    phase:session.phase,side:session.side,match,
    // These flags are PUBLIC in the v3 contract candidate; sector never is.
    usedGambit:Object.freeze({
      challenger:session.match.usedGambit.challenger,
      defender:session.match.usedGambit.defender
    })
  });
}
export function advanceArenaHotseat(session,event){
  validate(session);
  check(event&&typeof event==='object'&&!Array.isArray(event)&&
    typeof event.type==='string','event');
  if(event.type==='START'){
    check(Object.keys(event).length===1&&session.phase==='briefing','START');
    return snapshot({...session,phase:'planning'});
  }
  if(event.type==='SUBMIT'){
    check(Object.keys(event).length===2&&session.phase==='planning','SUBMIT');
    const next=submitArenaV3ResearchOrder(session.match,session.side,event.order);
    if(next.status==='ready-to-settle')
      return snapshot({...session,match:next,phase:'ready-to-resolve'});
    return snapshot({...session,match:next,side:'defender',phase:'handoff'});
  }
  if(event.type==='ACCEPT_HANDOFF'){
    check(Object.keys(event).length===1&&session.phase==='handoff','ACCEPT_HANDOFF');
    return snapshot({...session,phase:'planning'});
  }
  if(event.type==='RESOLVE'){
    check(Object.keys(event).length===1&&session.phase==='ready-to-resolve','RESOLVE');
    const settled=settleArenaV3ResearchRound(session.match);
    return snapshot({...session,match:settled,
      phase:settled.status==='finished'?'complete':'review',
      side:'challenger'});
  }
  if(event.type==='NEXT_ROUND'){
    check(Object.keys(event).length===1&&session.phase==='review','NEXT_ROUND');
    return snapshot({...session,phase:'planning',side:'challenger'});
  }
  throw Error('ARENA_HOTSEAT_INVALID unavailable action');
}
