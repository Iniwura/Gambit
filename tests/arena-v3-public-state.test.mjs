import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeArenaV3ResearchMatch,commitArenaV3ResearchRound,
  projectArenaV3PublicMatchState
} from '../src/research/arena-v3-rules.mjs';
import {startingSquadPlans} from '../src/squad.mjs';
import {nextRandom} from '../src/engine.mjs';

const order=(plans,formation=0,gambitRole=null)=>({plans,formation,gambitRole});

test('every adaptive player receives public, immutable, score-consistent history without hidden formations or wager choices',()=>{
  let seed=94852;
  for(let repetition=0;repetition<240;repetition++){
    let match=makeArenaV3ResearchMatch();
    const empty=projectArenaV3PublicMatchState(match);
    assert.deepEqual(empty,{
      round:0,scoreA:0,scoreB:0,finished:false,winner:null,
      nextChargedSector:0,history:[]
    });
    for(let round=0;round<5;round++){
      const first=startingSquadPlans(),second=startingSquadPlans();
      for(const roles of [first,second])for(const role of roles){
        seed=nextRandom(seed);role.base=seed%3;
        seed=nextRandom(seed);role.trigger=seed%3;
        seed=nextRandom(seed);role.response=seed%3;
      }
      const aOrder=order(first,(round+repetition)%3,round===repetition%5?round%3:null);
      const bOrder=order(second,(round+repetition+1)%3,round===(repetition+1)%5?(round+1)%3:null);
      const result=commitArenaV3ResearchRound(match,aOrder,bOrder);
      const projected=projectArenaV3PublicMatchState(result.match);
      assert.equal(projected.round,round+1);
      assert.equal(projected.scoreA,result.match.scoreA);
      assert.equal(projected.scoreB,result.match.scoreB);
      assert.equal(projected.nextChargedSector,round===4?null:(round+1)%3);
      assert.equal(projected.finished,round===4);
      assert.equal(projected.history.length,round+1);
      assert.equal(Object.isFrozen(projected),true);
      assert.equal(Object.isFrozen(projected.history),true);
      assert.ok(projected.history.every(Object.isFrozen));
      const json=JSON.stringify(projected);
      for(const keyword of ['gambitRole','spentA','spentB','debug',
        'formation','challengerIndex','defenderIndex','trigger','response','base'])
        assert.equal(json.includes(keyword),false,
          keyword+' is not public strategy evidence');
      const hostile={...result.match,
        privateSessionKey:'NEVER_LEAK',
        history:result.match.history.map(evt=>({
          ...evt,unsafePrivateFormation:2,
          debug:{...evt.debug,secretPlan:'NO_COPY'}
        }))
      };
      assert.equal(JSON.stringify(projectArenaV3PublicMatchState(hostile)),json,
        'the public projection must be an explicit allowlist and stable under private state injection');
      match=result.match;
    }
    assert.throws(()=>commitArenaV3ResearchRound(match,
      order(startingSquadPlans()),order(startingSquadPlans())),/not accepting/);
  }
});

test('forged adaptive public history and premature winner statements fail closed',()=>{
  const plans=startingSquadPlans();
  const initial=makeArenaV3ResearchMatch();
  const one=commitArenaV3ResearchRound(initial,order(plans,0,0),order(plans,0,null)).match;
  const bad=[
    {...one,round:2},
    {...one,finished:true},
    {...one,winner:1},
    {...one,scoreA:one.scoreA+1},
    {...one,history:[{...one.history[0],pointsA:11}]},
    {...one,history:[{...one.history[0],round:5}]},
    {...one,history:[{...one.history[0],scoreB:one.scoreB+1}]},
    {...one,history:[]}
  ];
  for(const edited of bad)assert.throws(()=>projectArenaV3PublicMatchState(edited));
});
