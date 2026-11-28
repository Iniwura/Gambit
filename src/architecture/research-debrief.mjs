/** Source-pinned, opt-in read-only debriefs for the two completed research runs.
 * No wallet, proof retrieval, private state, rewards or transaction authority.
 * Manifest schema version and reader ruleset version are distinct for V4.
 */
import {readArenaV4PublicMatch} from '../arena/v4-public-match-reader.mjs';
import {readNeutralBlacksiteMission} from '../blacksite/neutral-public-mission-reader.mjs';

const arena=Object.freeze({contract:'ArenaV4ConfidentialActivationResearch',version:4,chainId:11155111,address:'0x5F9e0030233370a913780EC9CCb58183C4672c13',runtimeHash:'0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d'});
const blacksite=Object.freeze({contract:'NeutralBlacksiteResearch',version:3,chainId:11155111,address:'0x33c062aebeB425b53A25E0b370732Cee5f7F97F9',runtimeHash:'0x8b17d9514b5cce1220afc3428b5a51fd93198786f501755aa10d9d540572665e'});
export const RESEARCH_DEBRIEF_PINS=Object.freeze({arena,blacksite});
export const RESEARCH_DEBRIEF_RPC=Object.freeze(['https://ethereum-sepolia-rpc.publicnode.com','https://gateway.tenderly.co/public/sepolia']);
const operative='0x7d567fa1d5fe35737bbf045f47667e13298ee176';
const defender='0xcc427b61573eee146fc735159292f06e13bc8b80';
const check=(ok,msg)=>{if(!ok)throw Error('RESEARCH_DEBRIEF '+msg)};
const int=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
function project(mode,s){
 const pin=RESEARCH_DEBRIEF_PINS[mode];
 check(s.chainId===pin.chainId&&s.contract.toLowerCase()===pin.address.toLowerCase()&&s.runtimeHash===pin.runtimeHash,'deployment mismatch');
 if(mode==='arena'){
  check(s.matchId===1&&s.complete&&!s.abandoned&&s.currentRound===5&&s.rounds.length===5,'match not terminal');
  check(s.challenger?.toLowerCase()===operative&&s.defender?.toLowerCase()===defender,'participant mismatch');
  const rows=s.rounds.map((r,i)=>{
   check(r.round===i+1&&r.finalized&&r.resolved&&r.score&&int(r.score.challenger,7)&&int(r.score.defender,7),'round mismatch');
   return Object.freeze({round:r.round,challenger:r.score.challenger,defender:r.score.defender});
  });
  const a=rows.reduce((n,r)=>n+r.challenger,0),b=rows.reduce((n,r)=>n+r.defender,0);
  check(a===s.cumulative.challenger&&b===s.cumulative.defender&&s.winner===(a===b?0:a>b?1:2),'score mismatch');
  return Object.freeze({mode,id:1,status:'COMPLETE',challenger:a,defender:b,winner:s.winner,rows:Object.freeze(rows)});
 }
 check(s.missionId===1&&['BREACHED','LOCKED','EXPIRED','TECHNICAL_ABORT'].includes(s.status)&&s.history.length===s.attemptsUsed&&int(s.attemptsUsed,4)&&int(s.heat,8)&&int(s.score,100),'mission not terminal');
 check(s.operative?.toLowerCase()===operative,'operative mismatch');
 const rows=s.history.map((r,i)=>{
  check(r.attempt===i+1&&['STEALTH','PROBE','BREACH'].includes(r.route)&&int(r.exact,5)&&(r.misplaced===null||int(r.misplaced,5)),'feedback mismatch');
  return Object.freeze({attempt:r.attempt,route:r.route,exact:r.exact,misplaced:r.misplaced});
 });
 return Object.freeze({mode,id:1,status:s.status,score:s.score,heat:s.heat,rows:Object.freeze(rows)});
}
/** Both providers must independently validate their canonical block and agree
 * on immutable terminal public state. No single-provider or cached fallback.
 * This is state corroboration, not an independent light-client proof.
 */
export async function loadResearchDebrief(mode,providers,options={}){
 check(mode==='arena'||mode==='blacksite','unknown mode');
 check(Array.isArray(providers)&&providers.length===2&&providers[0]!==providers[1],'two independent provider instances required');
 const reader=mode==='arena'?readArenaV4PublicMatch:readNeutralBlacksiteMission;
 const snapshots=await Promise.all(providers.map(p=>reader(p,RESEARCH_DEBRIEF_PINS[mode],1,options)));
 check(!options.signal?.aborted,'cancelled');
 return corroborateResearchDebrief(mode,snapshots);
}
export function corroborateResearchDebrief(mode,snapshots){
 check(mode==='arena'||mode==='blacksite','unknown mode');
 check(Array.isArray(snapshots)&&snapshots.length===2,'two snapshots required');
 const results=snapshots.map(s=>project(mode,s));
 check(JSON.stringify(results[0])===JSON.stringify(results[1]),'provider disagreement');
 const blocks=snapshots.map(s=>{check(Number.isSafeInteger(s.blockTag)&&s.blockTag>0&&/^0x[0-9a-f]{64}$/i.test(s.blockHash),'block identity');return Object.freeze({number:s.blockTag,hash:s.blockHash})});
 check(blocks[0].number!==blocks[1].number||blocks[0].hash.toLowerCase()===blocks[1].hash.toLowerCase(),'same-block fork disagreement');
 return Object.freeze({...results[0],authority:'CORROBORATED_PUBLIC_STATE',blocks:Object.freeze(blocks),eligibleForVerifiedProgression:false});
}
