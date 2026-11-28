// Cleartext research only. This is deployed-v3 scoring (0..7 per side),
// NOT the historical charged-sector 0..10 experiment or live FHE.
import {resolvePositionedSquadTurn} from '../src/squad.mjs';
import {scoreGambitCommitment} from '../src/research/gambit-commitment-v0.mjs';

export const plans=[];
for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)for(let response=0;response<3;response++)
 if(base!==response||trigger===0)plans.push({base,trigger,response});
const outcomes=plans.map(a=>plans.map(b=>{
 const x=a.trigger===b.base?a.response:a.base,y=b.trigger===a.base?b.response:b.base;
 return x===y?0:(x-y+3)%3===1?1:2;
}));
export function rng(s){return n=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)%n;};}
const pressure=(w,o)=>w[0]+w[1]+w[2]+w[2]+w[0]*w[2]-w[2]*o[1];
export function base(p,f,rival){
 const A=[0,0,0],B=[0,0,0],lanes=[];
 for(let l=0;l<3;l++){const a=(l+f)%3,b=(l+rival.f)%3,o=outcomes[p[a]][rival.p[b]];A[a]=+(o===1);B[b]=+(o===2);lanes.push(o);}
 return {pa:pressure(A,B),pb:pressure(B,A),lanes};
}
export const adjusted=(p,l,s,side)=>s===-1?p:Math.max(0,p+(l[s]===side?2:-1));
export function parity(samples=10000,seed=0x51382aa1){
 const random=rng(seed);
 for(let i=0;i<samples;i++){
  const own={p:[random(21),random(21),random(21)],f:random(3),stake:random(4)-1};
  const rival={p:[random(21),random(21),random(21)],f:random(3),stake:random(4)-1};
  const {pa,pb,lanes}=base(own.p,own.f,rival);
  const a=adjusted(pa,lanes,own.stake,1),b=adjusted(pb,lanes,rival.stake,2);
  const canonical=resolvePositionedSquadTurn(own.p.map(x=>plans[x]),rival.p.map(x=>plans[x]),own.f,rival.f);
  const final=scoreGambitCommitment(canonical,own.stake===-1?null:own.stake,rival.stake===-1?null:rival.stake);
  if(pa!==canonical.pointsA||pb!==canonical.pointsB||lanes.some((v,j)=>v!==canonical.lanes[j].outcome)||a!==final.pointsA||b!==final.pointsB)
   throw Error('Canonical scoring parity failed at sample '+i);
 }
 return samples;
}
export function research(seed,correlated,matches=10000){
 const random=rng(seed);
 const generate=()=>Array.from({length:48},()=>({p:[random(21),random(21),random(21)],f:random(3),stake:random(3)}));
 const pools=[generate()];pools.push(correlated?generate():pools[0]);
 // Priors 0,1,1/2,1/3,1/4,1/5. Equal-sized pools.
 const priors=[[0,1],[1,1],[1,2],[1,3],[1,4],[1,5]];
 const best=Array.from({length:2},()=>priors.map(()=>({margin:-Infinity})));
 let choices=0;
 for(let a=0;a<21;a++)for(let b=0;b<21;b++)for(let c=0;c<21;c++)for(let f=0;f<3;f++){
  const p=[a,b,c],sums=[Array(4).fill(0),Array(4).fill(0)];
  for(let bit=0;bit<=1;bit++)for(const rival of pools[bit]){
   const {pa,pb,lanes}=base(p,f,rival);
   const other=adjusted(pb,lanes,bit?rival.stake:-1,2);
   for(let k=0;k<4;k++)sums[bit][k]+=adjusted(pa,lanes,k-1,1)-other;
  }
  for(let k=0;k<4;k++){
   choices++;
   for(let i=0;i<priors.length;i++){
    const [num,den]=priors[i],margin=sums[0][k]*(den-num)+sums[1][k]*num;
    const group=k===0?0:1;
    if(margin>best[group][i].margin)best[group][i]={margin,p,f,stake:k-1};
   }
  }
 }
 const draw=rng(seed^0x539da103);
 const stats=Array.from({length:2},()=>({wins:0,draws:0,losses:0,totalMargin:0}));
 let differences=0,marginGain=0;
 for(let match=0;match<matches;match++){
  const activationRound=1+draw(5);let scores=[0,0],rivalPreviouslySpent=false;
  for(let round=1;round<=5;round++){
   const bit=+(round===activationRound);
   const rival=pools[bit][draw(48)];
   // Both policies know prior public spent status; only informed sees current bit.
   const priorIndex=rivalPreviouslySpent?0:6-round;
   const group=+(round===3); // both responder policies spend on round 3 only
   for(let mode=0;mode<2;mode++){
    const own=best[group][mode?bit:priorIndex];
    const {pa,pb,lanes}=base(own.p,own.f,rival);
    scores[mode]+=adjusted(pa,lanes,own.stake,1)-adjusted(pb,lanes,bit?rival.stake:-1,2);
   }
   rivalPreviouslySpent ||= Boolean(bit);
  }
  for(let mode=0;mode<2;mode++){const s=stats[mode],m=scores[mode];s.totalMargin+=m;if(m>0)s.wins++;else if(m===0)s.draws++;else s.losses++;}
  if(scores[0]!==scores[1])differences++;
  marginGain+=scores[1]-scores[0];
 }
 return {seed,correlated,matches,choices,blind:stats[0],informed:stats[1],differentMatchMargins:differences,meanMarginGain:marginGain/matches};
}
