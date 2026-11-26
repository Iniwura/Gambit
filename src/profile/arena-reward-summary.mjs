/**
 * Stage 1 reward accounting. Input MUST already have passed the canonical
 * history verifier and its private brand check. This helper does not authenticate
 * receipts or make unverified JSON eligible for real rewards.
 */
export function summarizeCanonicalArenaRecords(records,wallet){
 const fail=(ok,why)=>{if(!ok)throw Error('COMMANDER_PROFILE_INVALID '+why)};
 fail(Array.isArray(records)&&typeof wallet==='string','record summary input');
 const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x);
 const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
 fail(address(wallet),'summary wallet');
 const player=wallet.toLowerCase(),byId=new Map();
 for(const r of records){
  fail(r&&r.chainId===11155111&&address(r.contractAddress)&&hash(r.runtimeHash)&&
    typeof r.matchId==='string'&&/^[1-9][0-9]*$/.test(r.matchId)&&hash(r.creationTransaction)&&
    Number.isSafeInteger(r.creationBlock)&&r.creationBlock>0&&address(r.challenger)&&address(r.defender),
    'canonical record identity');
  const a=r.challenger.toLowerCase(),b=r.defender.toLowerCase();
  fail(a!==b&&(a===player||b===player),'record participants');
  fail(typeof r.complete==='boolean'&&typeof r.abandoned==='boolean'&&!(r.complete&&r.abandoned)&&
    Number.isInteger(r.currentRound)&&r.currentRound>=1&&r.currentRound<=5&&Array.isArray(r.rounds),
    'record terminal state');
  fail(r.complete?(r.currentRound===5&&r.rounds.length===5&&[0,1,2].includes(r.winner)):r.winner===null,
    'record winner state');
  const key=[r.chainId,r.contractAddress.toLowerCase(),r.matchId].join(':');
  // Only allowlist canonical public fields. Compare normalized snapshots;
  // never resolve conflicting evidence by taking the higher score.
  const identity=JSON.stringify([r.runtimeHash.toLowerCase(),r.creationTransaction.toLowerCase(),
    r.creationBlock,a,b,r.currentRound,r.status,r.complete,r.abandoned,r.winner,
    r.cumulative?.challenger,r.cumulative?.defender,
    r.rounds.map(x=>[x.round,x.challengerPoints,x.defenderPoints,x.cumulativeChallenger,x.cumulativeDefender])]);
  if(byId.has(key)){fail(byId.get(key).identity===identity,'conflicting duplicate match');continue;}
  byId.set(key,{identity,record:r});
 }
 const unique=[...byId.values()].map(x=>x.record).sort((a,b)=>a.creationBlock-b.creationBlock|| (BigInt(a.matchId)<BigInt(b.matchId)?-1:BigInt(a.matchId)>BigInt(b.matchId)?1:0));
 const completed=unique.filter(r=>r.complete),abandoned=unique.filter(r=>r.abandoned);
 const won=r=>r.winner===(r.challenger.toLowerCase()===player?1:2);
 const wins=completed.filter(won).length,draws=completed.filter(r=>r.winner===0).length,losses=completed.length-wins-draws;
 const xp=completed.length*50+wins*100;
 const achievements=[];
 const award=(id,title,r)=>achievements.push(Object.freeze({id,title,evidence:r.creationTransaction,block:r.creationBlock}));
 if(completed.length){award('ARENA_FIRST_MATCH','First authenticated Arena match',completed[0]);award('ARENA_FIVE_ROUND','Five-round operator',completed[0]);}
 if(wins)award('ARENA_VICTORY','Arena victor',completed.find(won));
 return Object.freeze({matches:completed.length,observedMatches:unique.length,activeMatches:unique.length-completed.length-abandoned.length,abandonedMatches:abandoned.length,wins,losses,draws,xp,level:1+Math.floor(xp/100),achievements:Object.freeze(achievements),verifiedHistory:Object.freeze(unique)});
}
