/**
 * CLEAR-TEXT REFERENCE MODEL (NOT ENCRYPTION). Purpose: parity oracle for FHE
 * confrontation logic, deterministic visual gameplay, repeatable tests.
 * Actions: 0=STRIKE, 1=GUARD, 2=FLANK.
 * Counter rule checks opponent's secret PRIMARY order. Both branches calculate
 * simultaneously from the same pair of original primary orders.
 */
export const ACTIONS=['STRIKE','GUARD','FLANK'];
export const STRATEGIES=[
  {base:0,trigger:0,response:1},
  {base:2,trigger:1,response:2},
  {base:1,trigger:2,response:0},
  {base:0,trigger:2,response:1},
  {base:2,trigger:0,response:1},
  {base:1,trigger:0,response:2},
  {base:0,trigger:1,response:2},
  {base:2,trigger:2,response:0},
];
const validAction=x=>Number.isInteger(x)&&x>=0&&x<3;
export function validatePlan(p){
  if(!p||!validAction(p.base)||!validAction(p.trigger)||!validAction(p.response))throw new Error('Invalid tactic: use actions 0, 1 or 2');
  return {base:p.base,trigger:p.trigger,response:p.response};
}
export function effectiveActions(planA,planB){
  const a=validatePlan(planA),b=validatePlan(planB);
  return {a:b.base===a.trigger?a.response:a.base, b:a.base===b.trigger?b.response:b.base,
          aTriggered:b.base===a.trigger,bTriggered:a.base===b.trigger};
}
export function resolveEncounter(planA,planB){
  const e=effectiveActions(planA,planB);
  const outcome=e.a===e.b?0:((e.a===0&&e.b===2)||(e.a===1&&e.b===0)||(e.a===2&&e.b===1))?1:2;
  return {...e,outcome}; // 0 draw, 1 challenger, 2 sentinel
}
// Repeatable pseudo-RNG for local practice only. NEVER onchain randomness.
export function nextRandom(s){let v=(s>>>0)||0x9e3779b9;v^=v<<13;v^=v>>>17;v^=v<<5;return v>>>0;}
export function makeMatch(seed=0x16fa31){return {seed:seed>>>0,round:0,scoreA:0,scoreB:0,control:0,history:[],finished:false,winner:null};}
export function enemyPlanFor(match){
  let seed=nextRandom(match.seed ^ Math.imul(match.round+1,0x9e3779b1));
  const p=STRATEGIES[seed%STRATEGIES.length];
  return {...p};
}
export function commitTurn(match,plan){
  if(match.finished)throw Error('Match finished');
  validatePlan(plan);
  const enemy=enemyPlanFor(match),result=resolveEncounter(plan,enemy);
  const next={...match,round:match.round+1,history:match.history.slice(),scoreA:match.scoreA,scoreB:match.scoreB,control:match.control};
  if(result.outcome===1){next.scoreA+=2;next.control=Math.min(3,next.control+1)}
  else if(result.outcome===2){next.scoreB+=2;next.control=Math.max(-3,next.control-1)}
  else {next.scoreA++;next.scoreB++}
  const event={round:next.round,player:result.a,enemy:result.b,playerCounter:result.aTriggered,
    outcome:result.outcome,scoreA:next.scoreA,scoreB:next.scoreB,control:next.control};
  next.history.push(event);
  next.finished=next.round>=5 || next.control===3 || next.control===-3;
  if(next.finished){next.winner=next.scoreA>next.scoreB?1:next.scoreB>next.scoreA?2:0}
  return {match:next,event,opponentPrivatePlan:enemy};
}
export function verifyTranscript(seed,plans,publicEvents){
  if(!Array.isArray(plans)||!Array.isArray(publicEvents)||plans.length!==publicEvents.length)return false;
  try{let m=makeMatch(seed);for(let i=0;i<plans.length;i++){const x=commitTurn(m,plans[i]);if(JSON.stringify(x.event)!==JSON.stringify(publicEvents[i]))return false;m=x.match;}return true;}catch{return false}
}
