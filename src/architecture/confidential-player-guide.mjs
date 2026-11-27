/** Player-language presentation of the already authenticated public snapshot.
 * This is NOT an authorization decision, proof verifier, or inference about
 * private tactics. It deliberately does not consume a secret result handle.
 */
const TERMINAL=new Set(['COMPLETE','ABANDONED_UNSCORED','TECHNICAL_ABORT_UNSCORED','BREACHED','LOCKED','EXPIRED','TECHNICAL_ABORT']);
const action=(id,label,button)=>Object.freeze({id,label,button});
const A=Object.freeze({
 CREATE_MATCH:action('CREATE_MATCH','Invite a commander','Review invitation'),
 OPEN_MISSION:action('OPEN_MISSION','Enter BLACKSITE','Review mission entry'),
 SEAL_ROUND:action('SEAL_ROUND','Lock secret orders','Encrypt & review orders'),
 SUBMIT_ATTEMPT:action('SUBMIT_ATTEMPT','Test a code','Encrypt & review attempt'),
 RESOLVE_ROUND:action('RESOLVE_ROUND','Resolve combat','Review resolution'),
 RESOLVE_ATTEMPT:action('RESOLVE_ATTEMPT','Resolve attempt','Review resolution'),
 FINALIZE_ROUND:action('FINALIZE_ROUND','Authenticate score','Retrieve proof & review'),
 FINALIZE_ATTEMPT:action('FINALIZE_ATTEMPT','Authenticate clues','Retrieve proof & review'),
 EXPIRE_INCOMPLETE:action('EXPIRE_INCOMPLETE','Close incomplete match','Review closure'),
 EXPIRE_MISSION:action('EXPIRE_MISSION','Close expired mission','Review closure'),
 ABORT_UNSETTLED:action('ABORT_UNSETTLED','Close failed settlement','Review closure')
});
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const out=(heading,detail,next=null,deadline=null,terminal=false)=>Object.freeze({heading,detail,next,deadline,terminal});
const time=(kind,at)=>Number.isSafeInteger(at)&&at>0?Object.freeze({kind,at}):null;
export function confidentialPlayerGuide(mode,actor,view,recordEntered=false){
 if(mode!=='arena'&&mode!=='blacksite')throw Error('Unknown confidential mode');
 if(!actor)return out('Choose your wallet','Select a wallet and check its Sepolia account.');
 if(!view)return recordEntered?out('Recover a record','Read its current onchain state before choosing an action.'):
  mode==='arena'?out('Invite a commander','Create a five-round match for a distinct opponent, or enter an existing match ID.',A.CREATE_MATCH):
  out('Enter BLACKSITE','Open a confidential five-glyph mission, or recover an active mission.',A.OPEN_MISSION);
 const terminal=TERMINAL.has(view.status);
 if(mode==='arena'){
  const side=same(actor,view.challenger)?'challenger':same(actor,view.defender)?'defender':null;
  const r=view.rounds?.at(-1);
  if(!r)return out('State unavailable','Refresh the match.');
  if(view.status==='COMPLETE'){
   const winner=view.cumulative.challenger===view.cumulative.defender?null:view.cumulative.challenger>view.cumulative.defender?'challenger':'defender';
   return out(!winner?'Draw':side?(side===winner?'Victory':'Defeat'):(winner==='challenger'?'Challenger won':'Defender won'),'Five rounds finalized. Only aggregate scores are public.',null,null,true);
  }
  if(terminal)return out('Match closed','No winner was awarded for this incomplete settlement.',null,null,true);
  if(!side)return out('Spectating','Only invited commanders can submit orders or advance this match.');
  if(view.status==='WAITING_FOR_BOTH'||view.status==='WAITING_FOR_OPPONENT'){
   const deadline=time('Order deadline',r.deadlineAt);
   if(r[side+'Sealed'])return out('Orders locked','Wait for the other commander, then refresh. Your orders remain encrypted.',null,deadline);
   return out('Plan your squad','Choose openings, contingencies and a formation. You can request GAMBIT on one visual sector.',A.SEAL_ROUND,deadline);
  }
  if(view.status==='READY_TO_RESOLVE')return out('Both commanders ready','Resolve the encrypted orders; no score is final yet.',A.RESOLVE_ROUND,time('Settlement deadline',r.deadlineAt+86400));
  if(view.status==='AWAITING_PROOF')return out('Combat resolved','Authenticate the public aggregate score before advancing.',A.FINALIZE_ROUND,time('Settlement deadline',r.deadlineAt+86400));
  if(view.status==='EXPIRED_INCOMPLETE_NOT_CLOSED')return out('Order deadline passed','Close the incomplete match without a winner.',A.EXPIRE_INCOMPLETE);
  if(view.status==='RECOVERY_EXPIRED_NOT_CLOSED')return out('Settlement deadline passed','Close the failed settlement without a winner.',A.ABORT_UNSETTLED);
 }else{
  if(terminal){
   const heading={BREACHED:'Vault breached',LOCKED:'Vault locked',EXPIRED:'Mission expired',TECHNICAL_ABORT:'Settlement failed'}[view.status];
   return out(heading,view.status==='BREACHED'?'Exact breach authenticated. Final score and heat are recorded.':'Mission closed. No successful breach was awarded.',null,null,true);
  }
  if(!same(actor,view.operative))return out('Spectating','Only the operative can submit an attempt or advance this mission.');
  if(view.status==='ACCEPTING_ATTEMPT')return out('Choose your next code','Use finalized clues to narrow five glyphs. Only an exact BREACH opens the vault.',A.SUBMIT_ATTEMPT,time('Attempt deadline',view.deadlineAt));
  if(view.status==='SEALED')return out('Attempt locked','Resolve the encrypted guess to compute its feedback.',A.RESOLVE_ATTEMPT,time('Settlement deadline',view.recoveryDeadlineAt));
  if(view.status==='AWAITING_PROOF')return out('Clues ready','Authenticate the route-specific clues before planning another attempt.',A.FINALIZE_ATTEMPT,time('Settlement deadline',view.recoveryDeadlineAt));
  if(view.status==='EXPIRED_NOT_CLOSED')return out('Attempt deadline passed','Close the expired mission without a breach.',A.EXPIRE_MISSION);
  if(view.status==='RECOVERY_EXPIRED_NOT_CLOSED')return out('Settlement deadline passed','Close the failed settlement without a breach.',A.ABORT_UNSETTLED);
 }
 return out('State unavailable','Refresh before continuing.');
}
export const CONFIDENTIAL_BRIEF=Object.freeze({
 arena:Object.freeze({goal:'Win the most reactor pressure over five rounds.',rules:Object.freeze(['Strike beats Flank; Guard beats Strike; Flank beats Guard.','Trigger checks the rival opening; response replaces your opening if it matches.','Formation rotates the three fighters across the sectors.','Scout supports a winning Striker; a winning opposing Guardian reduces that bonus.','GAMBIT: one effective activation per match. Win its sector for +2; otherwise lose 1 point (minimum zero). Later requests are ignored. Only aggregate scores are revealed.'])}),
 blacksite:Object.freeze({goal:'Breach a five-glyph vault in four attempts.',rules:Object.freeze(['Each glyph is 0–3. Exact means correct glyph in the correct position.','STEALTH: exact count, no heat.','PROBE: exact and misplaced counts, +1 heat.','BREACH: exact count, +2 heat. Only five exact on BREACH succeeds.','Successful score = 100 − 10 × heat − 5 × earlier attempts, minimum zero.'])})
});
