/**
 * BLACKSITE PHASE 1: actual headless, LOCAL-ONLY mission controller.
 *
 * Rules come from the independently tested four-glyph research engine.
 * Five bounded attempts, honest Mastermind-style feedback, explicit
 * briefing/active/terminal/debrief states, and a fresh-ID retry.
 *
 * IMPORTANT: no Zama FHE, onchain secret, contract or playable UI yet.
 * This local practice module is NOT a secure cryptographic puzzle.
 * Private cleartext training data are held in a module-local WeakMap,
 * outside ALL exported state and event objects. That prevents accidental
 * JSON/logging disclosures; it does NOT turn client memory into secrecy.
 */
import {
  makeVaultTraining,submitVaultTrainingGuess,publicVaultTrainingState,
  VAULT_STANDARD_ATTEMPTS
} from '../research/blacksite-cipher.mjs';

export const BLACKSITE_LOCAL_MISSION_VERSION=1;
const SECRET_STATE=new WeakMap();
const RE=/^local-[a-z0-9][a-z0-9-]{1,47}$/;
const P=['briefing','active','breached','locked','debrief'];
function gate(state){
  if(!state||typeof state!=='object'||!SECRET_STATE.has(state)||
    state.mode!=='blacksite-local-mission'||
    state.version!==BLACKSITE_LOCAL_MISSION_VERSION||
    !RE.test(state.missionId)||!P.includes(state.phase))
    throw Error('Unknown, forged or unsupported BLACKSITE local mission');
  return SECRET_STATE.get(state);
}
function view(missionId,phase,training,outcome=null){
  const pub=publicVaultTrainingState(training);
  const status=Object.freeze({
    mode:'blacksite-local-mission',
    version:BLACKSITE_LOCAL_MISSION_VERSION,
    missionId,
    phase,
    round:pub.round,
    remaining:pub.remaining,
    maxAttempts:VAULT_STANDARD_ATTEMPTS,
    outcome,
    history:pub.history
  });
  SECRET_STATE.set(status,training);
  return status;
}
export function createBlacksiteLocalMission(missionId,secret){
  if(typeof missionId!=='string'||!RE.test(missionId))
    throw Error('BLACKSITE local mission ID must begin with local-');
  const training=makeVaultTraining(secret,VAULT_STANDARD_ATTEMPTS);
  return view(missionId,'briefing',training);
}
export function beginBlacksiteLocalMission(state){
  const training=gate(state);
  if(state.phase!=='briefing'||training.round!==0)
    throw Error('BLACKSITE mission is not at briefing');
  return view(state.missionId,'active',training);
}
export function guessBlacksiteLocalMission(state,guess){
  const training=gate(state);
  if(state.phase!=='active'||training.status!=='active')
    throw Error('BLACKSITE mission is not accepting attempts');
  const {state:next,event}=submitVaultTrainingGuess(training,guess);
  const phase=next.status==='active'?'active':
    next.status==='breached'?'breached':'locked';
  return Object.freeze({
    state:view(state.missionId,phase,next,
      next.status==='active'?null:next.status),
    event:Object.freeze({
      round:event.round,guess:event.guess,
      exact:event.exact,misplaced:event.misplaced,
      remaining:event.remaining,status:event.status
    })
  });
}
export function debriefBlacksiteLocalMission(state){
  const training=gate(state);
  if(!['breached','locked'].includes(state.phase))
    throw Error('BLACKSITE mission must be terminal before debrief');
  return view(state.missionId,'debrief',training,state.phase);
}
export function restartBlacksiteLocalMission(state,newMissionId,newSecret){
  gate(state);
  if(!['breached','locked','debrief'].includes(state.phase))
    throw Error('BLACKSITE mission cannot restart while active');
  if(newMissionId===state.missionId)
    throw Error('BLACKSITE retry needs a distinct new mission ID');
  return createBlacksiteLocalMission(newMissionId,newSecret);
}
export function publicBlacksiteLocalMission(state){
  gate(state);
  const pub=publicVaultTrainingState(SECRET_STATE.get(state));
  return Object.freeze({
    mode:'blacksite-local-training-public',
    version:BLACKSITE_LOCAL_MISSION_VERSION,
    missionId:state.missionId,phase:state.phase,
    round:pub.round,remaining:pub.remaining,
    outcome:state.outcome,
    history:pub.history
  });
}
