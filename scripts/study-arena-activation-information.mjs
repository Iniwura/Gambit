// Deterministic cleartext sensitivity study of deployed v3 scoring.
// Not live FHE, equilibrium, human behavior, or full five-round strategy.
// 21 canonical plans retain original base and omit redundant trigger variants.
// Two equally weighted activation states; shared or independently drawn
// 48-order pools. Exact best response to the assumed known finite pools.
// Rival stake target is sampled, not revealed to responding policy.
function study(seed,correlated=false){
 const plans=[];
 for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)for(let response=0;response<3;response++){
  if(response===base&&trigger!==0)continue;
  plans.push({base,trigger,response});
 }
 const win=plans.map(a=>plans.map(b=>{const x=a.trigger===b.base?a.response:a.base,y=b.trigger===a.base?b.response:b.base;return x===y?0:(x-y+3)%3===1?1:2;}));
 let rng=seed;
 const rand=n=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)%n;};
 const generate=()=>Array.from({length:48},()=>({p:[rand(21),rand(21),rand(21)],f:rand(3),stake:rand(3)}));
 const offPool=generate(),onPool=correlated?generate():offPool;
 const pressure=(wins,opp)=>wins[0]+wins[1]+wins[2]+wins[2]+(wins[0]&wins[2])-(wins[2]&opp[1]);
 const totals=(p,f,pool,active)=>{
  const out=[0,0,0,0];
  for(const rival of pool){
   const A=[0,0,0],B=[0,0,0],lanes=[];
   for(let l=0;l<3;l++){const i=(l+f)%3,j=(l+rival.f)%3,o=win[p[i]][rival.p[j]];lanes.push(o);A[i]=+(o===1);B[j]=+(o===2);}
   const pa=pressure(A,B),pb=pressure(B,A),pbOn=active?Math.max(0,pb+(lanes[rival.stake]===2?2:-1)):pb;
   for(let k=0;k<4;k++)out[k]+=(k===0?pa:Math.max(0,pa+(lanes[k-1]===1?2:-1)))-pbOn;
  }
  return out;
 };
 let best=[-Infinity,-Infinity],blind=-Infinity,evaluated=0,withoutStake=[-Infinity,-Infinity,-Infinity];
 for(let a=0;a<21;a++)for(let b=0;b<21;b++)for(let c=0;c<21;c++)for(let f=0;f<3;f++){
  const p=[a,b,c],off=totals(p,f,offPool,false),on=totals(p,f,onPool,true);
  for(let k=0;k<4;k++){best[0]=Math.max(best[0],off[k]);best[1]=Math.max(best[1],on[k]);blind=Math.max(blind,off[k]+on[k]);evaluated++;}
  withoutStake[0]=Math.max(withoutStake[0],off[0]);withoutStake[1]=Math.max(withoutStake[1],on[0]);withoutStake[2]=Math.max(withoutStake[2],off[0]+on[0]);
 }
 return {seed,correlated,ownOrders:evaluated,rivalPoolPerState:48,pairings:evaluated*96,blindMargin:blind/96,informedMargin:(best[0]+best[1])/96,informationValue:(best[0]+best[1]-blind)/96,informationValueOwnGambitSpent:(withoutStake[0]+withoutStake[1]-withoutStake[2])/96};
}
const results=[];
for(const seed of [0x6a6d6269,1234567,0xdeadbeef])
 for(const correlated of [false,true])results.push(study(seed,correlated));
console.log(JSON.stringify(results,null,2));
