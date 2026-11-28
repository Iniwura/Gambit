import {JsonRpcProvider} from 'ethers';
import {approvedArenaV3Deployment} from '../src/arena/approved-deployment.mjs';
import {loadApprovedArenaV3History} from '../src/profile/arena-v3-history.mjs';
import {createCommanderIdentity,deriveCommanderProfile}
  from '../src/profile/commander-profile.mjs';

const PIN=approvedArenaV3Deployment();
const PLAYER='0xEa0C73e7a8D7149e641805e7Eb4eC0D4195C403C';
const endpoints=[
  ['PublicNode','https://ethereum-sepolia-rpc.publicnode.com'],
  ['ethPandaOps','https://rpc.sepolia.ethpandaops.io'],
  // Tenderly's public Sepolia gateway alias avoids a transient DNS failure on
  // the legacy gateway hostname while remaining the same public provider.
  ['Tenderly','https://sepolia.gateway.tenderly.co']
];
const normalize=history=>history.matches.map(match=>({
  matchId:match.matchId,creationTransaction:match.creationTransaction,
  challenger:match.challenger,defender:match.defender,
  complete:match.complete,status:match.status,currentRound:match.currentRound,
  cumulative:match.cumulative,winner:match.winner,
  rounds:match.rounds
}));
const results=await Promise.all(endpoints.map(async([name,url])=>{
  const provider=new JsonRpcProvider(url,PIN.chainId,{staticNetwork:true});
  const history=await loadApprovedArenaV3History(provider,PLAYER);
  return {name,history};
}));
const baseline=JSON.stringify(normalize(results[0].history));
for(const result of results.slice(1)){
  if(JSON.stringify(normalize(result.history))!==baseline)
    throw Error('ARENA_V3_HISTORY_READONLY provider disagreement: '+result.name);
}
const match=results[0].history.matches.find(item=>item.matchId==='1');
if(!match||!match.complete||match.currentRound!==5||
   match.cumulative.challenger!==6||match.cumulative.defender!==4)
  throw Error('ARENA_V3_HISTORY_READONLY Match #1 evidence incomplete');
const profile=deriveCommanderProfile(
  createCommanderIdentity(PLAYER,{callSign:'CHALLENGER',createdAt:1700000000000}),
  results[0].history
);
console.log('GAMBIT_ARENA_V3_HISTORY_READONLY '+JSON.stringify({
  providers:results.map(item=>item.name),chainId:PIN.chainId,
  contract:PIN.address,runtimeHash:PIN.runtimeHash,
  commander:PLAYER,fullHistoryObserved:results[0].history.fullHistoryObserved,
  matches:normalize(results[0].history),commanderProfile:{
    matches:profile.matches,wins:profile.wins,losses:profile.losses,
    draws:profile.draws,level:profile.level,xp:profile.xp,
    achievements:profile.achievements.map(item=>item.id),
    blacksiteProgress:profile.blacksiteProgress
  }
}));
