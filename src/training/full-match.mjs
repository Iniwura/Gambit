/**
 * Optional five-round Academy continuation, observing the REAL local Phaser
 * match. Never calls a scorer, writes match state, or processes onchain data.
 * Round 1 is performed by coach.mjs. This reducer validates rounds 2–5.
 */
export const FULL_MATCH_COACH_VERSION=1;
export const FULL_MATCH_STEPS=Object.freeze([
  ['r2-role','Round 2 · Scout','Select SCOUT. Its wins can mark a weak spot when your Striker also wins.','Press 4','Tap SCOUT'],
  ['r2-base','Program Scout opening','Choose a SCOUT opening move. This is an independent fighter plan.','Press 1, 2 or 3','Choose an opening move'],
  ['r2-trigger','Program Scout trigger','Choose which enemy opening activates your Scout counter.','Press Q, W or E','Choose an enemy trigger'],
  ['r2-response','Program Scout counter','Choose the response Scout uses if its trigger matches.','Press A, S or D','Choose a counter move'],
  ['r2-commit','Lock Round 2','Commit a real squad round with the Scout commands you programmed.','Press ENTER','Tap LOCK ALL THREE TACTICS'],
  ['r2-settle','Inspect Scout pressure','Let all three lanes finish. Any Scout synergy comes from actual scoring only.','Watch the encounter','Watch the encounter'],
  ['r3-role','Round 3 · Guardian','Select GUARDIAN. It can block an opposing Striker bonus if Guardian wins.','Press 5','Tap GUARDIAN'],
  ['r3-base','Program Guardian opening','Set the Guardian opening independently.','Press 1, 2 or 3','Choose an opening move'],
  ['r3-trigger','Program Guardian trigger','Choose the enemy opening that should activate its response.','Press Q, W or E','Choose an enemy trigger'],
  ['r3-response','Program Guardian counter','Program the conditional Guardian response.','Press A, S or D','Choose a counter move'],
  ['r3-commit','Lock Round 3','Commit the actual round with the Guardian instructions you selected.','Press ENTER','Tap LOCK ALL THREE TACTICS'],
  ['r3-settle','Inspect Guardian denial','Read the real three-lane results. A blocked bonus exists only if the scorer reports one.','Watch the encounter','Watch the encounter'],
  ['r4-formation','Round 4 · Reposition','Select a different formation from the one you committed in Round 3.','Press 7, 8 or 9','Choose a different formation'],
  ['r4-commit','Lock Round 4','Commit the changed formation. It changes matchups, not the underlying fighter plans.','Press ENTER','Tap LOCK ALL THREE TACTICS'],
  ['r4-settle','Read the new matchups','Inspect each real lane. A different formation does not prove it caused a victory.','Watch the encounter','Watch the encounter'],
  ['r5-scout','Round 5 · Take command','Independently program SCOUT: select it and set an opening move.','Press 4, then 1/2/3','Select SCOUT and choose opening'],
  ['r5-guardian','Program Guardian','Now select GUARDIAN and set its own opening move.','Press 5, then 1/2/3','Select GUARDIAN and choose opening'],
  ['r5-striker','Program Striker','Select STRIKER and set its own opening move. No prescribed winning tactic.','Press 6, then 1/2/3','Select STRIKER and choose opening'],
  ['r5-commit','Lock final round','Commit all three independent plans. Match result is not predetermined.','Press ENTER','Tap LOCK ALL THREE TACTICS'],
  ['r5-settle','Read the final match','Wait for the actual game-over result and canonical five-round role debrief.','Watch match completion','Watch match completion'],
  ['complete','Five rounds reviewed','You completed five real local practice rounds. Review the real match result below.','Replay or return to Arena','Replay or return to Arena']
].map(([id,title,instruction,desktop,mobile])=>Object.freeze({id,title,instruction,desktop,mobile})));
const validPlan=p=>p&&['base','trigger','response'].every(k=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<=2);
const validScore=s=>typeof s==='string'&&/^\d{1,2} : \d{1,2}$/.test(s);
const scoreParts=s=>s.split(' : ').map(Number);
function check(ok,label){if(!ok)throw Error('TRAINING_FULL_INVALID '+label)}
function freezeState(s){
  const receipts=Object.freeze(s.receipts.map(e=>Object.freeze({...e,
    bonusA:e.bonusA?Object.freeze({...e.bonusA}):null,
    bonusB:e.bonusB?Object.freeze({...e.bonusB}):null
  })));
  const debrief=s.debrief?Object.freeze({...s.debrief,
    stats:Object.freeze(s.debrief.stats.map(x=>Object.freeze({...x})))
  }):null;
  return Object.freeze({...s,edits:Object.freeze(s.edits.map(e=>Object.freeze({...e}))),
    receipts,debrief});
}
export function createFullMatchCoach(first){
  check(first&&first.round===1&&first.lanes===3&&validScore(first.scoreline)&&
    scoreParts(first.scoreline).every(x=>x>=0&&x<=5),
    'actual completed first round required');
  return freezeState({mode:'gambit-full-match-academy',version:FULL_MATCH_COACH_VERSION,
    index:0,step:FULL_MATCH_STEPS[0].id,completed:false,missed:false,
    committedRound:null,formation:2,selectedFormation:null,selectedRole:null,
    edits:[{},{},{}],receipts:[{round:1,scoreline:first.scoreline,lanes:3}],
    scoreline:first.scoreline,debrief:null});
}
function advance(s,opts={}){
  const index=opts.index??s.index+1;
  return freezeState({...s,...opts,index,step:FULL_MATCH_STEPS[index]?.id??'recovery',
    completed:index===FULL_MATCH_STEPS.length-1,missed:false});
}
function miss(s,why){
  return freezeState({...s,step:'recovery',missed:true,completed:false,reason:why});
}
export function advanceFullMatchCoach(s,e){
  check(s&&s.mode==='gambit-full-match-academy'&&s.version===1&&
    Number.isInteger(s.index)&&s.index>=0&&s.index<FULL_MATCH_STEPS.length&&
    (s.step===FULL_MATCH_STEPS[s.index].id||s.step==='recovery')&&
    Array.isArray(s.edits)&&s.edits.length===3&&
    Array.isArray(s.receipts)&&s.receipts.length>=1&&s.receipts.length<=5,
    'state');
  check(e&&typeof e==='object'&&!Array.isArray(e),'event object');
  check(['role','choose','formation','commit','settled'].includes(e.type),'event type');
  if(e.type==='role')check(Number.isInteger(e.role)&&e.role>=0&&e.role<=2,'role');
  if(e.type==='choose')check(Number.isInteger(e.role)&&e.role>=0&&e.role<=2&&
    ['base','trigger','response'].includes(e.field)&&
    Number.isInteger(e.index)&&e.index>=0&&e.index<=2,'choose');
  if(e.type==='formation')check(Number.isInteger(e.index)&&e.index>=0&&e.index<=2,'formation');
  if(e.type==='commit')check(Number.isInteger(e.round)&&e.round>=1&&e.round<=5&&
    Number.isInteger(e.formation)&&e.formation>=0&&e.formation<=2&&
    Array.isArray(e.plans)&&e.plans.length===3&&e.plans.every(validPlan),'commit');
  if(e.type==='settled')check(Number.isInteger(e.round)&&e.round>=1&&e.round<=5&&
    e.lanes===3&&validScore(e.scoreline)&&typeof e.finished==='boolean','settled');
  if(s.missed||s.completed)return s;
  const id=s.step;
  const target=Number(id.slice(1,2));
  // A browser or event bridge may deliver the SAME accepted commit twice.
  // While awaiting its actual settlement, ignore duplicates; never revoke
  // already valid learning evidence or count an extra round.
  if(e.type==='commit'&&e.round===s.committedRound&&id==='r'+target+'-settle')return s;
  if(e.type==='commit'&&e.round===target&&id!=='r'+target+'-commit')
    return miss(s,'This round was committed before its required real inputs. Finish the match and start a fresh Academy.');
  if(id==='r2-role'||id==='r3-role'){
    if(e.type!=='role'||e.role!==(target===2?0:1))return s;
    return advance(s,{selectedRole:e.role,edits:[{},{},{}]});
  }
  const singleFields={'r2-base':[0,'base'],'r2-trigger':[0,'trigger'],
    'r2-response':[0,'response'],'r3-base':[1,'base'],
    'r3-trigger':[1,'trigger'],'r3-response':[1,'response'],
    'r5-scout':[0,'base'],'r5-guardian':[1,'base'],'r5-striker':[2,'base']};
  if(Object.hasOwn(singleFields,id)){
    const [role,field]=singleFields[id];
    if(e.type==='role')return freezeState({...s,selectedRole:e.role});
    if(e.type!=='choose'||e.role!==role||e.field!==field||
      s.selectedRole!==role)return s;
    const edits=s.edits.map((p,i)=>i===role?{...p,[field]:e.index}:p);
    return advance(s,{edits,selectedRole:e.role});
  }
  if(id==='r4-formation'){
    if(e.type!=='formation'||e.index===s.formation)return s;
    return advance(s,{selectedFormation:e.index});
  }
  if(id==='r2-commit'||id==='r3-commit'||id==='r4-commit'||id==='r5-commit'){
    if(e.type!=='commit')return s;
    if(e.round!==target)return s;
    const required=target===2?[[0,['base','trigger','response']]]:
      target===3?[[1,['base','trigger','response']]]:
      target===5?[[0,['base']],[1,['base']],[2,['base']]]:[];
    const matched=required.every(([role,fields])=>
      fields.every(field=>s.edits[role][field]===e.plans[role][field]));
    if(!matched||target===4&&e.formation!==s.selectedFormation)
      return miss(s,'Committed tactics did not match the Academy exercise. The round cannot be undone.');
    return advance(s,{committedRound:target,formation:e.formation});
  }
  if(id==='r2-settle'||id==='r3-settle'||id==='r4-settle'||id==='r5-settle'){
    if(e.type!=='settled'||e.round!==s.committedRound)return s;
    const completedMatch=target===5;
    if(e.finished!==completedMatch)return miss(s,'Unexpected match-completion status.');
    const [a,b]=scoreParts(e.scoreline),[pa,pb]=scoreParts(s.scoreline);
    if(a<pa||b<pb||a-pa>5||b-pb>5)
      return miss(s,'Cumulative practice score changed outside one legal local round.');
    if(completedMatch){
      const d=e.debrief;
      if(!d||d.scoreline!==e.scoreline||
        d.winner!==(a===b?0:a>b?1:2)||
        !Array.isArray(d.stats)||d.stats.length!==3||
        d.stats.some((x,i)=>!x||x.role!==['SCOUT','GUARDIAN','STRIKER'][i]||
          !Number.isInteger(x.wins)||x.wins<0||
          !Number.isInteger(x.losses)||x.losses<0||
          !Number.isInteger(x.draws)||x.draws<0||
          x.wins+x.losses+x.draws!==5))
        return miss(s,'Final canonical local match debrief was missing or inconsistent.');
    }
    const receipt={round:target,scoreline:e.scoreline,lanes:3,
      bonusA:e.bonusA??null,bonusB:e.bonusB??null};
    const receipts=[...s.receipts,receipt];
    return advance(s,{scoreline:e.scoreline,receipts,committedRound:null,
      edits:[{},{},{}],debrief:completedMatch?e.debrief:null,
      selectedFormation:null,selectedRole:null});
  }
  return s;
}
export function fullMatchPresentation(s){
  check(s&&s.mode==='gambit-full-match-academy','presentation state');
  if(s.missed)return Object.freeze({id:'recovery',title:'Lesson needs a fresh match',
    instruction:s.reason,desktop:'Finish or restart the match',mobile:'Finish or restart the match',
    stepNumber:s.index+1,total:FULL_MATCH_STEPS.length,completed:false,
    scoreline:s.scoreline,receipts:s.receipts,debrief:null});
  return Object.freeze({...FULL_MATCH_STEPS[s.index],stepNumber:s.index+1,
    total:FULL_MATCH_STEPS.length,completed:s.completed,scoreline:s.scoreline,
    receipts:s.receipts,debrief:s.debrief});
}
