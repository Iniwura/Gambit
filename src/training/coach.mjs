/**
 * GAMBIT TRAINING — first-round local practice mission (pure reducer).
 *
 * A guide is NOT a match engine. It observes real player actions accepted
 * by Phaser, advances only on a specifically required action, and waits for
 * the actual three-lane report from commitSquadTurn. It cannot award a win,
 * alter tactics, read an encrypted plan, trigger a wallet or persist data.
 */
export const TRAINING_COACH_VERSION=1;
export const TRAINING_COACH_STEPS=Object.freeze([
  Object.freeze({id:'enter',title:'Enter the Arena',
    instruction:'Choose a bot and enter LOCAL PRACTICE. This is not encrypted.',
    desktop:'Click ENTER ARENA',mobile:'Tap ENTER ARENA'}),
  Object.freeze({id:'role',title:'Command the Striker',
    instruction:'Select STRIKER. This role can earn extra reactor pressure when it wins.',
    desktop:'Press 6',mobile:'Tap STRIKER'}),
  Object.freeze({id:'opening',title:'Choose an opening',
    instruction:'For STRIKER, choose FLANK. FLANK beats GUARD in a direct clash.',
    desktop:'Press 3',mobile:'Tap FLANK under OPEN WITH'}),
  Object.freeze({id:'trigger',title:'Set an enemy trigger',
    instruction:'Watch for an enemy STRIKE. A conditional counter activates only if this trigger matches.',
    desktop:'Press Q',mobile:'Tap STRIKE under IF ENEMY OPENS WITH'}),
  Object.freeze({id:'counter',title:'Program a counter',
    instruction:'Respond to that STRIKE with GUARD. GUARD beats STRIKE in a direct clash.',
    desktop:'Press S',mobile:'Tap GUARD under THEN COUNTER WITH'}),
  Object.freeze({id:'formation',title:'Deploy the squad',
    instruction:'Choose FEINT. Formation changes who meets whom; all three fighters keep independent plans.',
    desktop:'Press 9',mobile:'Tap FEINT'}),
  Object.freeze({id:'commit',title:'Lock the squad',
    instruction:'Commit one actual LOCAL PRACTICE round. The deterministic bot will answer your three plans.',
    desktop:'Press ENTER',mobile:'Tap LOCK ALL THREE TACTICS'}),
  Object.freeze({id:'settled',title:'Watch the encounter',
    instruction:'Wait for all three lane outcomes and the real after-action report. The result is not predetermined.',
    desktop:'Watch the round resolve',mobile:'Watch the round resolve'}),
  Object.freeze({id:'complete',title:'First round complete',
    instruction:'Your actual public practice round has been recorded. Review the lanes and continue playing.',
    desktop:'Continue the practice match',mobile:'Continue the practice match'})
]);
const VALID_TYPES=Object.freeze([
  'enter','role','choose','formation','commit','settled','reset'
]);
const PHASES=Object.freeze(['intro','ready']);
function check(ok,msg){if(!ok)throw Error('TRAINING_GUIDE_INVALID '+msg)}
function snapshot(index,startedIn,settled=null){
  return Object.freeze({
    mode:'gambit-training-guide',version:TRAINING_COACH_VERSION,
    step:TRAINING_COACH_STEPS[index].id,index,
    completed:index===TRAINING_COACH_STEPS.length-1,
    startedIn,
    settled: settled?Object.freeze({...settled}):null
  });
}
function valid(state){
  check(state&&typeof state==='object'&&!Array.isArray(state)&&
    state.mode==='gambit-training-guide'&&
    state.version===TRAINING_COACH_VERSION&&
    Number.isInteger(state.index)&&state.index>=0&&
    state.index<TRAINING_COACH_STEPS.length&&
    TRAINING_COACH_STEPS[state.index].id===state.step&&
    PHASES.includes(state.startedIn),'unrecognized state');
}
export function createTrainingCoach(phase='intro'){
  check(PHASES.includes(phase),'initial practice phase');
  return snapshot(phase==='ready'?1:0,phase);
}
export function advanceTrainingCoach(state,event){
  valid(state);
  check(event&&typeof event==='object'&&!Array.isArray(event)&&
    VALID_TYPES.includes(event.type),'event');
  // The current UI will never convert an invalid command into a real event.
  // Malformed events are rejected even when for a different step.
  switch(event.type){
    case 'enter':
      check(event.phase==='ready','accepted practice entry');
      break;
    case 'role':
      check(Number.isInteger(event.role)&&event.role>=0&&event.role<=2,
        'role index');
      break;
    case 'choose':
      check(['base','trigger','response'].includes(event.field)&&
        Number.isInteger(event.index)&&event.index>=0&&event.index<=2&&
        Number.isInteger(event.role)&&event.role>=0&&event.role<=2,
        'squad command');
      break;
    case 'formation':
      check(Number.isInteger(event.index)&&event.index>=0&&event.index<=2,
        'formation');
      break;
    case 'commit':
      check(Number.isInteger(event.round)&&event.round>=1&&event.round<=5,
        'actual committed round');
      break;
    case 'settled':
      check(Number.isInteger(event.round)&&event.round>=1&&event.round<=5&&
        event.lanes===3&&typeof event.scoreline==='string'&&
        /^\d{1,2} : \d{1,2}$/.test(event.scoreline),
        'actual three-lane public report');
      break;
    case 'reset':
      check(event.phase==='intro','actual scene restart');
      return snapshot(0,'intro');
  }
  if(state.completed)return state;
  const step=state.step;
  const accepted=step==='enter'&&event.type==='enter'||
    step==='role'&&event.type==='role'&&event.role===2||
    step==='opening'&&event.type==='choose'&&
      event.role===2&&event.field==='base'&&event.index===2||
    step==='trigger'&&event.type==='choose'&&
      event.role===2&&event.field==='trigger'&&event.index===0||
    step==='counter'&&event.type==='choose'&&
      event.role===2&&event.field==='response'&&event.index===1||
    step==='formation'&&event.type==='formation'&&event.index===2||
    step==='commit'&&event.type==='commit'&&event.round>=1||
    step==='settled'&&event.type==='settled'&&event.round>=1;
  if(!accepted)return state;
  if(step==='settled')
    return snapshot(state.index+1,state.startedIn,
      {round:event.round,scoreline:event.scoreline,lanes:event.lanes});
  // Committing a turn carries a real round index; store it internally in the
  // guide snapshot so a different round cannot satisfy the settle stage.
  if(step==='commit')
    return Object.freeze({...snapshot(state.index+1,state.startedIn),
      committedRound:event.round});
  if(step==='formation'&&event.type==='formation')
    return snapshot(state.index+1,state.startedIn);
  return snapshot(state.index+1,state.startedIn);
}
export function trainingCoachPresentation(state){
  valid(state);
  const step=TRAINING_COACH_STEPS[state.index];
  return Object.freeze({
    ...step,stepNumber:state.index+1,
    total:TRAINING_COACH_STEPS.length,
    completed:state.completed,
    settled:state.settled
  });
}
