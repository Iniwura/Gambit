/** Local-only rehearsal of the exact neutral BLACKSITE rules.
 * Secret remains closure-local; device owner can inspect JS memory.
 * No wallet, chain, proof, persistence or verified progression.
 */
import {blacksiteV3Feedback,newBlacksiteV3Research,settleBlacksiteV3Research,publicBlacksiteV3Research} from '../research/blacksite-v3-rules.mjs';
const check=(ok,why)=>{if(!ok)throw Error('NEUTRAL_PRACTICE '+why)};
function code(value){
 check(Array.isArray(value)&&value.length===5&&Array.from(value).every(n=>Number.isInteger(n)&&n>=0&&n<4),'five valid glyphs required');
 return Object.freeze([...value]);
}
export function createNeutralPractice(id,secret){
 const hidden=code(secret);
 let rules=newBlacksiteV3Research(id);
 let guesses=[];
 function view(){
  const p=publicBlacksiteV3Research(rules);
  return Object.freeze({mode:'LOCAL_NEUTRAL_PRACTICE',id:p.id,status:p.status,attemptsUsed:p.attemptsUsed,remaining:4-p.attemptsUsed,heat:p.heat,score:p.score,history:Object.freeze(p.history.map((r,i)=>Object.freeze({...r,guess:guesses[i]}))),eligibleForVerifiedProgression:false});
 }
 function submit(guess,route){
  const value=code(guess);
  // Exact repeated attempts are allowed onchain. Rehearsal follows the same
  // rules, including consuming a turn to change route on the same guess.
  const packet=blacksiteV3Feedback(hidden,value,route);
  const next=settleBlacksiteV3Research(rules,rules.history.length+1,packet);
  guesses=[...guesses,value];rules=next;return view();
 }
 return Object.freeze({view,submit});
}
