import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTOCOL_ROUNDS,PROTOCOL_ROUND_DEADLINE,PROTOCOL_MAX_MATCH_SCORE,
  newArenaProtocolResearchMatch,submitArenaResearchOrder,
  beginArenaResearchResolution,recordArenaResearchResultHandle,
  finalizeArenaResearchRound,expireArenaResearchRound,
  publicArenaResearchProtocolState
} from '../src/research/arena-v3-protocol.mjs';
import {resolveArenaV3ResearchRound} from '../src/research/arena-v3-rules.mjs';
import {startingSquadPlans} from '../src/squad.mjs';

const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),OUT='0x'+'c'.repeat(40);
const h=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const id='gambit-v3-research-001';
const mockProof=({matchId,round,resultHandle,packedScore})=>
  'OFFLINE-MOCK-ONLY:'+matchId+':'+round+':'+resultHandle+':'+packedScore;
const fakeVerifier=request=>request.proof===mockProof(request);
const evidence=(matchId,round,resultHandle,pointsA,pointsB)=>({
  matchId,round,resultHandle,pointsA,pointsB,
  packedScore:16*pointsA+pointsB,
  proof:mockProof({matchId,round,resultHandle,packedScore:16*pointsA+pointsB})
});
function readyRound(state,round,now=0n){
  let m=submitArenaResearchOrder(state,A,h(100+round),now);
  m=submitArenaResearchOrder(m,B,h(200+round),now);
  m=beginArenaResearchResolution(m,now);
  return recordArenaResearchResultHandle(m,h(300+round),now);
}

test('persistent research protocol needs distinct participants, stable domain and explicit time',()=>{
  const game=newArenaProtocolResearchMatch(id,A,B,10n);
  assert.equal(game.phase,'collecting');
  assert.equal(game.round,1);
  assert.equal(game.deadlineAt,10n+PROTOCOL_ROUND_DEADLINE);
  assert.equal(game.winner,null);
  assert.equal(game.scoreA,0);
  assert.equal(game.scoreB,0);
  for(const pair of [[A,A],[A,A.toUpperCase().replace('0X','0x')],[A,'0x'+'0'.repeat(40)]])
    assert.throws(()=>newArenaProtocolResearchMatch(id,pair[0],pair[1]),/distinct|Invalid/);
  for(const bad of ['', 'https://bad/path', 'x', 'a'.repeat(101)])
    assert.throws(()=>newArenaProtocolResearchMatch(bad,A,B),/match ID/);
  for(const bad of [-1n,-1,NaN,undefined,'0'])
    assert.throws(()=>newArenaProtocolResearchMatch(id,A,B,bad),/timestamp/);
});

test('only distinct authorized sides can commit; no duplicate, cross-side reuse or outdated chain time',()=>{
  let m=newArenaProtocolResearchMatch(id,A,B,100n);
  assert.throws(()=>submitArenaResearchOrder(m,OUT,h(1),100n),/invited/);
  assert.throws(()=>submitArenaResearchOrder(m,A,h(1),99n),/stale/);
  assert.throws(()=>submitArenaResearchOrder(m,A,h(1),100n+PROTOCOL_ROUND_DEADLINE+1n),
    /deadline/);
  assert.throws(()=>submitArenaResearchOrder(m,A,'0x1234',100n),/handle/);
  assert.throws(()=>submitArenaResearchOrder(m,A,h(0),100n),/handle/);
  const original=structuredClone(m);
  m=submitArenaResearchOrder(m,A,h(1),100n);
  assert.deepEqual(original,newArenaProtocolResearchMatch(id,A,B,100n));
  assert.equal(m.phase,'collecting');
  assert.deepEqual(publicArenaResearchProtocolState(m).submissions,{a:true,b:false});
  assert.throws(()=>submitArenaResearchOrder(m,A,h(2),100n),/already/);
  assert.throws(()=>submitArenaResearchOrder(m,B,h(1),100n),/reuse/);
  m=submitArenaResearchOrder(m,B,h(2),101n);
  assert.equal(m.phase,'ready');
  assert.deepEqual(publicArenaResearchProtocolState(m).submissions,{a:true,b:true});
  assert.throws(()=>submitArenaResearchOrder(m,A,h(3),101n),/not collecting/);
});

test('resolution requires two orders and public-handle recording is one-shot and cannot replay previous rounds',()=>{
  const created=newArenaProtocolResearchMatch(id,A,B,0n);
  assert.throws(()=>beginArenaResearchResolution(created,0n),/Two submitted/);
  let current=readyRound(created,1);
  assert.equal(current.phase,'awaiting-proof');
  assert.equal(publicArenaResearchProtocolState(current).phase,'awaiting-proof');
  assert.throws(()=>recordArenaResearchResultHandle(current,h(3),0n),/No encrypted resolution/);
  assert.throws(()=>beginArenaResearchResolution(current,0n),/Two submitted/);
  assert.throws(()=>finalizeArenaResearchRound(current,
    evidence(id,1,h(999),5,4),fakeVerifier,0n),/different ciphertext/);
  current=finalizeArenaResearchRound(current,evidence(id,1,h(301),5,4),fakeVerifier,1n);
  assert.equal(current.round,2);
  assert.equal(current.phase,'collecting');
  assert.equal(current.history.length,1);
  assert.equal(current.spentOrderHandles.length,2);
  assert.equal(current.previousResultHandles.length,1);
  assert.throws(()=>submitArenaResearchOrder(current,A,h(101),2n),/Replay/);
  let second=submitArenaResearchOrder(current,A,h(102),2n);
  second=submitArenaResearchOrder(second,B,h(202),2n);
  second=beginArenaResearchResolution(second,2n);
  assert.throws(()=>recordArenaResearchResultHandle(second,h(301),2n),/Replayed/);
  assert.throws(()=>recordArenaResearchResultHandle(second,h(102),2n),/Replayed/);
});

test('fail-closed independent verifier: wrong score, stale proof, wrong round, forged bool and repeat finalization',()=>{
  const pending=readyRound(newArenaProtocolResearchMatch(id,A,B,0n),1);
  const good=evidence(id,1,h(301),4,6);
  const errors=[
    [{...good,matchId:'other'},fakeVerifier,/context/],
    [{...good,round:2},fakeVerifier,/context/],
    [{...good,pointsA:11,packedScore:182},fakeVerifier,/context/],
    [{...good,pointsB:-1,packedScore:63},fakeVerifier,/context/],
    [{...good,packedScore:good.packedScore+1},fakeVerifier,/packing/],
    [{...good,proof:'FORGED',verified:true},fakeVerifier,/rejected/],
    [good,()=>false,/rejected/],
    [good,null,/verifier/]
  ];
  for(const [bad,verifier,regex] of errors){
    assert.throws(()=>finalizeArenaResearchRound(pending,bad,verifier,0n),regex);
    assert.equal(pending.phase,'awaiting-proof','bad proof must not advance');
  }
  const finalized=finalizeArenaResearchRound(pending,good,fakeVerifier,0n);
  assert.equal(finalized.scoreA,4);
  assert.equal(finalized.scoreB,6);
  assert.throws(()=>finalizeArenaResearchRound(finalized,good,fakeVerifier,1n),
    /No resolved/);
  assert.deepEqual(publicArenaResearchProtocolState(finalized).history,[
    {round:1,pointsA:4,pointsB:6,scoreA:4,scoreB:6}
  ]);
});

test('timeout cannot create fabricated winners or cancel after encrypted commitments are both present',()=>{
  const created=newArenaProtocolResearchMatch(id,A,B,10n);
  assert.throws(()=>expireArenaResearchRound(created,10n+PROTOCOL_ROUND_DEADLINE),
    /not expired/);
  const incomplete=submitArenaResearchOrder(created,A,h(101),10n);
  const aborted=expireArenaResearchRound(incomplete,10n+PROTOCOL_ROUND_DEADLINE+1n);
  assert.equal(aborted.phase,'aborted');
  assert.equal(aborted.winner,null);
  assert.equal(aborted.abortReason,'unsubmitted-round-expired');
  assert.deepEqual(publicArenaResearchProtocolState(aborted).submissions,{a:false,b:false});
  assert.throws(()=>submitArenaResearchOrder(aborted,B,h(202),10n+PROTOCOL_ROUND_DEADLINE+2n),
    /not collecting/);
  const committed=submitArenaResearchOrder(incomplete,B,h(201),10n);
  assert.throws(()=>expireArenaResearchRound(committed,10n+PROTOCOL_ROUND_DEADLINE+1n),
    /cannot be cancelled/);
  const resolving=beginArenaResearchResolution(committed,10n);
  assert.throws(()=>expireArenaResearchRound(resolving,10n+PROTOCOL_ROUND_DEADLINE+1n),
    /cannot be cancelled/);
  const proven=recordArenaResearchResultHandle(resolving,h(301),10n);
  assert.throws(()=>expireArenaResearchRound(proven,10n+PROTOCOL_ROUND_DEADLINE+1n),
    /cannot be cancelled/);
  assert.equal(proven.phase,'awaiting-proof');
});

test('five complete rounds from real deterministic rules preserve scoring and recovery, with no onchain claim',()=>{
  for(let seed=0;seed<110;seed++){
    let match=newArenaProtocolResearchMatch(id,A,B,0n);
    let timestamp=1n;
    const originalId=match.matchId;
    for(let round=1;round<=PROTOCOL_ROUNDS;round++){
      const plansA=startingSquadPlans();
      const plansB=startingSquadPlans();
      for(let role=0;role<3;role++){
        plansA[role].base=(plansA[role].base+round+seed+role)%3;
        plansB[role].base=(plansB[role].base+round+seed+2*role)%3;
      }
      const rules=resolveArenaV3ResearchRound(
        {plans:plansA,formation:(round+seed)%3,gambitRole:round===1?2:null},
        {plans:plansB,formation:(round+seed+1)%3,gambitRole:round===2?1:null},
        round-1
      );
      const payload=evidence(originalId,round,h(300+round),rules.pointsA,rules.pointsB);
      match=readyRound(match,round,timestamp);
      const original=structuredClone(match);
      match=finalizeArenaResearchRound(match,payload,fakeVerifier,timestamp);
      assert.equal(original.phase,'awaiting-proof');
      assert.equal(match.history.length,round);
      assert.equal(match.round,round+1);
      assert.equal(match.phase,round===5?'finished':'collecting');
      assert.equal(match.winner,round===5?
        match.scoreA===match.scoreB?0:match.scoreA>match.scoreB?1:2:null);
      const publicly=publicArenaResearchProtocolState(match);
      const injected={...match,
        secretOrders:'INTERNAL_ONLY',
        history:match.history.map(row=>({...row,hiddenGambit:{role:2,secret:'NEVER_LEAK'}}))
      };
      assert.deepEqual(publicArenaResearchProtocolState(injected),publicly);
      const exposed=JSON.stringify(publicly);
      for(const keyword of ['secret','ciphertext','resultHandle','gambitRole','proof',
        'spentOrderHandles','INTERNAL_ONLY','NEVER_LEAK','private'])
        assert.equal(exposed.includes(keyword),false,
          'public research summary leaked '+keyword);
      timestamp++;
    }
    assert.equal(match.history.length,5);
    assert.ok(match.scoreA<=PROTOCOL_MAX_MATCH_SCORE);
    assert.ok(match.scoreB<=PROTOCOL_MAX_MATCH_SCORE);
    assert.throws(()=>submitArenaResearchOrder(match,A,h(900),timestamp),
      /not collecting/);
    assert.throws(()=>expireArenaResearchRound(match,timestamp+1000000n),
      /cannot be cancelled/);
  }
});

test('protocol rejects corrupted history, wiped spend markers and forged final scores before accepting new actions',()=>{
  const first=readyRound(newArenaProtocolResearchMatch(id,A,B,0n),1);
  const next=finalizeArenaResearchRound(first,evidence(id,1,h(301),3,2),fakeVerifier,1n);
  const bad=[
    {...next,scoreA:5},
    {...next,history:[{...next.history[0],pointsA:4}]},
    {...next,previousResultHandles:[]},
    {...next,spentOrderHandles:[h(101)]},
    {...next,spentOrderHandles:[h(101),h(101)]},
    {...next,submissions:{a:h(101),b:null}},
    {...next,resultHandle:h(101)},
    {...next,phase:'awaiting-proof'},
    {...next,winner:1},
    {...next,round:6}
  ];
  for(const forged of bad){
    assert.throws(()=>publicArenaResearchProtocolState(forged));
    assert.throws(()=>submitArenaResearchOrder(forged,A,h(102),2n));
  }
  assert.equal(submitArenaResearchOrder(next,A,h(102),2n).round,2);
});

test('cross-domain handle replay is rejected after finality and public submission flags are immutable',()=>{
  const first=readyRound(newArenaProtocolResearchMatch(id,A,B,0n),1);
  const next=finalizeArenaResearchRound(first,evidence(id,1,h(301),3,2),fakeVerifier,1n);
  assert.throws(()=>submitArenaResearchOrder(next,A,h(301),2n),/Replay/);
  const corrupted={...next,submissions:{a:h(301),b:null}};
  assert.throws(()=>publicArenaResearchProtocolState(corrupted),/already used/);
  const forged={...next,spentOrderHandles:[h(301),h(201)]};
  assert.throws(()=>publicArenaResearchProtocolState(forged),/domains overlap/);
  const projected=publicArenaResearchProtocolState(next);
  assert.equal(Object.isFrozen(projected),true);
  assert.equal(Object.isFrozen(projected.submissions),true);
  assert.equal(Object.isFrozen(projected.history),true);
  assert.throws(()=>{projected.submissions.a=true},TypeError);
  assert.deepEqual(publicArenaResearchProtocolState(next).submissions,{a:false,b:false});
});
