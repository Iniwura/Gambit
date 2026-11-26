import {resolvePositionedSquadTurn} from '../squad.mjs';
import {scoreGambitCommitment} from './gambit-commitment-v0.mjs';
// Exact integer certificates for symmetric single-round expected margin.
// Research only. Not human balance, full five-round Nash equilibrium, or live FHE.
// Each strategy samples an absolute formation uniformly; an active stake follows its selected role.
const rows0=[[12,12,12,21],[201,201,201,10],[120,120,120,16],[120,201,120,1],[201,12,201,21],[201,211,12,19],[100,120,120,1],[120,211,201,7],[100,211,201,11],[201,12,120,21],[120,120,12,7],[211,100,201,10],[12,22,120,9],[201,100,12,12],[22,100,201,3],[211,12,12,10],[12,120,201,10],[201,120,120,10],[100,22,201,5],[12,201,201,11],[12,100,120,12],[22,120,12,12],[120,211,120,8],[120,201,12,18],[120,22,201,8],[100,211,120,15],[100,120,12,8],[22,201,120,20],[120,12,201,10],[22,120,201,17],[22,22,12,8],[100,100,12,5],[211,12,120,10],[100,201,12,3]];
const rows1=[[12,12,12,0,452],[201,201,201,0,425],[120,120,120,0,530],[12,22,120,2,261],[12,211,120,2,156],[12,120,201,2,880],[201,211,12,2,156],[201,12,12,0,718],[120,22,201,0,261],[120,120,12,2,1060],[12,201,201,0,788],[120,12,201,2,1084],[120,201,120,0,842],[120,22,12,0,261],[100,201,120,1,210],[201,12,201,0,191],[22,12,201,1,261],[201,201,120,2,527],[12,120,12,0,530],[100,12,120,2,24],[211,120,201,2,156],[211,201,12,2,156],[120,100,120,0,234],[201,120,201,0,320],[22,120,120,1,261],[12,100,12,0,24],[100,120,201,1,234],[12,201,12,0,611],[22,201,12,2,261],[211,201,201,1,156],[100,201,12,1,24],[201,22,120,0,261],[12,12,120,2,904],[201,100,201,0,234],[211,12,12,1,156],[211,120,120,1,156],[12,22,12,0,261],[12,100,120,2,234],[120,201,201,0,533],[120,12,120,0,452],[120,201,12,1,527],[12,201,120,0,323],[100,12,12,1,210],[201,100,12,2,234],[12,100,201,0,210],[120,211,201,2,156],[201,201,12,2,323],[120,100,201,0,24],[211,12,120,1,156],[120,100,12,2,210],[201,120,120,0,643],[201,22,201,0,261]];
const decode=n=>({base:Math.floor(n/100),trigger:Math.floor(n/10)%10,response:n%10});
export function verifySquadCertificate(active){
 const rows=active?rows1:rows0, denominator=active?18522:369;
 const plans=[];
 for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)for(let response=0;response<3;response++)
  if(base!==response||trigger===0)plans.push({base,trigger,response});
 const rivals=rows.map(row=>({plans:row.slice(0,3).map(decode),role:active?row[3]:null,weight:row.at(-1)}));
 if(rivals.some(r=>!Number.isSafeInteger(r.weight)||r.weight<=0)||rivals.reduce((s,r)=>s+r.weight,0)!==denominator)throw Error('Invalid certificate weight');
 let maximum=-Infinity,minimum=Infinity,zero=0,baseChecks=0,choices=0;
 for(const a of plans)for(const b of plans)for(const c of plans){
  const sums=active?[0,0,0]:[0];
  for(const rival of rivals)for(let f=0;f<3;f++){
   const base=resolvePositionedSquadTurn([a,b,c],rival.plans,0,f);baseChecks++;
   const enemy=active?(rival.role-f+3)%3:null;
   for(let k=0;k<sums.length;k++){
    const final=scoreGambitCommitment(base,active?k:null,enemy);
    sums[k]+=rival.weight*(final.pointsA-final.pointsB);
   }
  }
  for(const s of sums){maximum=Math.max(maximum,s);minimum=Math.min(minimum,s);zero+=+(s===0);choices++;}
 }
 // Rotating both formations and stake together preserves each lane's role pairing.
 // The uniform enemy formation distribution makes own HOLD representative of all 3.
 return {active,choices:choices*3,baseChecks,denominator:denominator*3,maximum,minimum,zero:zero*3,support:rivals.length};
}
