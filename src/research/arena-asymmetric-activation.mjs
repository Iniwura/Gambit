import {resolvePositionedSquadTurn} from '../squad.mjs';
import {scoreGambitCommitment} from './gambit-commitment-v0.mjs';
/** Exact integer best-response bounds for asymmetric activation.
 * One round, expected point margin, uniform absolute formations.
 * No claim of five-round equilibrium, human balance or FHE security.
 * Weights quantized to 1e9; all weighted sums remain safe JS integers.
 */
const activeRows=[[12,12,12,0,6342292],[201,201,201,0,24345341],[120,120,120,0,38048343],[201,211,12,2,19756844],[120,22,12,2,47184622],[201,12,120,2,15694405],[22,22,120,2,28654379],[120,100,201,2,39978350],[201,12,201,0,43907064],[12,120,12,1,40724534],[22,120,12,1,48224637],[211,211,12,2,38067102],[120,120,12,2,8495345],[22,211,201,2,78424134],[12,12,100,0,55412999],[211,12,120,1,42086141],[12,201,12,0,14823271],[201,201,12,0,51189254],[12,211,201,2,3032609],[120,22,201,2,50514220],[201,100,12,2,27719346],[100,120,120,1,46386690],[201,211,120,2,26919454],[211,120,201,1,53076569],[12,22,120,2,32005478],[100,12,211,1,26092668],[120,12,12,1,30806080],[201,100,120,0,24364115],[100,201,100,1,23761325],[201,22,201,0,13962389]];
const inactiveRows=[[12,12,12,37037037],[201,201,201,37037037],[120,120,120,37037037],[12,120,12,37037037],[201,12,201,37037037],[12,12,120,37037037],[201,120,12,74074074],[12,201,12,37037037],[201,201,120,74074074],[120,12,12,37037037],[12,120,120,74074074],[201,12,12,37037037],[120,201,12,74074074],[120,12,120,37037037],[120,120,201,74074075],[12,201,201,74074074],[120,201,120,37037037],[120,12,201,37037037],[201,120,201,37037037],[12,12,201,37037037],[201,12,120,37037037]];
const decode=n=>({base:Math.floor(n/100),trigger:Math.floor(n/10)%10,response:n%10});
export function verifyAsymmetricActivation(rivalActive){
 const rows=rivalActive?activeRows:inactiveRows,ownActive=!rivalActive;
 const choices=[];
 for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)for(let response=0;response<3;response++)
  if(base!==response||trigger===0)choices.push({base,trigger,response});
 const rivals=rows.map(r=>({plans:r.slice(0,3).map(decode),role:rivalActive?r[3]:null,weight:r.at(-1)}));
 if(rivals.reduce((s,r)=>s+r.weight,0)!==1000000000||rivals.some(r=>r.weight<=0||!Number.isSafeInteger(r.weight)))throw Error('Bad mixture weights');
 let best=-Infinity,baseChecks=0,n=0;
 for(const a of choices)for(const b of choices)for(const c of choices){
  const sums=ownActive?[0,0,0]:[0];
  for(const rival of rivals)for(let formation=0;formation<3;formation++){
   const base=resolvePositionedSquadTurn([a,b,c],rival.plans,0,formation);baseChecks++;
   const rivalSector=rivalActive?(rival.role-formation+3)%3:null;
   for(let i=0;i<sums.length;i++){
    const result=scoreGambitCommitment(base,ownActive?i:null,rivalSector);
    sums[i]+=rival.weight*(result.pointsA-result.pointsB);
   }
  }
  for(const v of sums){if(!Number.isSafeInteger(v))throw Error('Unsafe integer');best=Math.max(best,v);n++;}
 }
 return {rivalActive,choices:n*3,baseChecks,denominator:3000000000,bestNumerator:best,support:rivals.length};
}
