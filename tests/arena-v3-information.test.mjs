import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveArenaV3ResearchRound} from '../src/research/arena-v3-rules.mjs';
import {resolvePositionedSquadTurn,startingSquadPlans} from '../src/squad.mjs';

const all=[];
for(let base=0;base<3;base++)for(let trigger=0;trigger<3;trigger++)
  for(let response=0;response<3;response++)
    all.push({base,trigger,response});
const policyKey=p=>[0,1,2].map(enemyBase=>
  enemyBase===p.trigger?p.response:p.base).join('');
const unique=[...new Map(all.map(p=>[policyKey(p),p])).values()];
const entropy=hist=>{
  const total=[...hist.values()].reduce((a,b)=>a+b,0);
  return [...hist.values()].reduce((s,n)=>{
    const p=n/total;return s-p*Math.log2(p);
  },0);
};

/**
 * Single-query aggregate-score leakage research, NOT a formal security claim.
 * Public results reveal intentional information by design. We quantify the
 * effect of v3's public charged-sector premium and confidential wager.
 *
 * Uniform secret orders and equally common formations are unrealistic player
 * assumptions. This audit must not be cited as security proof, resistance to
 * adaptive inference, or proof that an onchain commit-hiding protocol exists.
 */
test('v3 charged sectors and optional concealed wager have an explicitly measured aggregate information budget',()=>{
  assert.equal(unique.length,21);
  const fixedChallenger=startingSquadPlans(),base=new Map(),sector=new Map(),wager=new Map();
  const bump=(map,key)=>map.set(key,(map.get(key)||0)+1);
  const challenger={plans:fixedChallenger,formation:0,gambitRole:null};
  let sampled=0,secretStakeNoticeable=0,choices=0,actualGambitScoreDistinct=0;
  for(const p0 of unique)for(const p1 of unique)for(const p2 of unique)
    for(let df=0;df<3;df++){
      const defender=[p0,p1,p2];
      const v2=resolvePositionedSquadTurn(fixedChallenger,defender,0,df);
      bump(base,v2.pointsA+':'+v2.pointsB);
      const basic=resolveArenaV3ResearchRound(challenger,{
        plans:defender,formation:df,gambitRole:null
      },0);
      bump(sector,basic.pointsA+':'+basic.pointsB);
      const noWagerScore=basic.pointsA+':'+basic.pointsB;
      for(const gambleRole of [null,0,1,2]){
        const v3=resolveArenaV3ResearchRound(challenger,{
          plans:defender,formation:df,gambitRole:gambleRole
        },0);
        bump(wager,v3.pointsA+':'+v3.pointsB);
        choices++;
        if(gambleRole!==null&&
           v3.pointsA+':'+v3.pointsB!==noWagerScore)
          actualGambitScoreDistinct++;
        // Scores >=7 on either side cannot occur without a wager in the
        // currently proposed v3 scoring formula, partially leaking its use.
        if(v3.pointsA>6||v3.pointsB>6)secretStakeNoticeable++;
      }
      sampled++;
    }
  assert.equal(sampled,21**3*3);
  assert.equal(choices,sampled*4);
  assert.equal([...base.values()].reduce((s,n)=>s+n,0),sampled);
  assert.equal([...sector.values()].reduce((s,n)=>s+n,0),sampled);
  assert.equal([...wager.values()].reduce((s,n)=>s+n,0),choices);
  const result={
    model:'one public score / fixed challenger; independent uniform defender behavior classes and formation',
    uniqueDefenderConfigurations:sampled,
    publishedScoreBuckets:{
      deployedV2Reference:base.size,
      v3WithoutWager:sector.size,
      v3DefenderWagerUniformAmongNoneOrThreeRoles:wager.size
    },
    entropyBits:{
      deployedV2Reference:Number(entropy(base).toFixed(3)),
      v3WithoutWager:Number(entropy(sector).toFixed(3)),
      v3DefenderWagerUnknown:Number(entropy(wager).toFixed(3))
    },
    speculativeGambitScoreDifferentRate:Number(
      (actualGambitScoreDistinct/(sampled*3)).toFixed(4)),
    highScoreMayRevealWagerRate:Number((secretStakeNoticeable/choices).toFixed(4)),
    canHideWagerAfterResult:false,
    repeatedQuerySafetyProven:false,
    actualFheProtocolImplemented:false
  };
  assert.ok(result.entropyBits.v3WithoutWager>0);
  assert.ok(result.entropyBits.v3DefenderWagerUnknown>0);
  assert.ok(result.publishedScoreBuckets.v3WithoutWager>10);
  assert.ok(actualGambitScoreDistinct>0);
  console.log('GAMBIT_V3_AGGREGATE_INFORMATION_STUDY '+JSON.stringify(result));
});
