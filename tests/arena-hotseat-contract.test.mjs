import test from 'node:test';
import assert from 'node:assert/strict';
import {startingSquadPlans} from '../src/squad.mjs';
import {
  ARENA_HOTSEAT_VERSION,createArenaHotseatSession,
  advanceArenaHotseat,publicArenaHotseat
} from '../src/arena/hotseat-controller.mjs';

const plan=(formation=0,stakeSector=null)=>({
  plans:startingSquadPlans(),formation,stakeSector
});
const act=(s,type,extras={})=>advanceArenaHotseat(s,{type,...extras});
const start=id=>act(createArenaHotseatSession(id),'START');

test('hotseat plays five real rounds without auto-submitting either player or fake score',()=>{
  let s=start('research-hotseat-five-rounds');
  assert.equal(ARENA_HOTSEAT_VERSION,1);
  assert.equal(s.phase,'planning');
  for(let round=1;round<=5;round++){
    assert.equal(s.match.round,round);
    assert.equal(s.side,'challenger');
    s=act(s,'SUBMIT',{order:plan(round%3,round===2?1:null)});
    assert.equal(s.phase,'handoff');
    assert.equal(s.side,'defender');
    assert.equal(s.match.pending.defender,null,'defender must submit their own plan');
    assert.throws(()=>act(s,'RESOLVE'),/ARENA_HOTSEAT_INVALID/);
    s=act(s,'ACCEPT_HANDOFF');
    assert.equal(s.phase,'planning');
    s=act(s,'SUBMIT',{order:plan((round+1)%3,round===4?2:null)});
    assert.equal(s.phase,'ready-to-resolve');
    assert.equal(s.match.status,'ready-to-settle');
    s=act(s,'RESOLVE');
    assert.equal(s.match.history.length,round);
    assert.equal(s.match.history.at(-1).round,round);
    assert.ok(s.match.history.at(-1).packed<=63);
    assert.equal(s.match.scoreA,s.match.history.reduce((v,h)=>v+h.pointsA,0));
    assert.equal(s.match.scoreB,s.match.history.reduce((v,h)=>v+h.pointsB,0));
    assert.equal(s.phase,round===5?'complete':'review');
    if(round<5)s=act(s,'NEXT_ROUND');
  }
  assert.ok([0,1,2].includes(s.match.winner));
  assert.equal(s.match.finished,undefined,'v3 domain uses finished status only');
  assert.equal(s.match.status,'finished');
  assert.equal(s.match.round,5);
  assert.equal(publicArenaHotseat(s).match.history.length,5);
  assert.throws(()=>act(s,'NEXT_ROUND'),/ARENA_HOTSEAT_INVALID/);
  assert.throws(()=>act(s,'SUBMIT',{order:plan()}),/ARENA_HOTSEAT_INVALID/);
});

test('no secret order, formation or sector appears in any public UI snapshot',()=>{
  let s=createArenaHotseatSession('research-hotseat-no-leaks');
  const states=[s];
  s=act(s,'START');states.push(s);
  s=act(s,'SUBMIT',{order:plan(2,1)});states.push(s);
  s=act(s,'ACCEPT_HANDOFF');states.push(s);
  s=act(s,'SUBMIT',{order:plan(1,0)});states.push(s);
  s=act(s,'RESOLVE');states.push(s);
  for(const state of states){
    const pub=publicArenaHotseat(state);
    const encoded=JSON.stringify(pub);
    assert.equal(Object.hasOwn(pub,'pending'),false);
    assert.equal(Object.hasOwn(pub,'plans'),false);
    for(const secret of ['stakeSector','plans','formation','trigger','response',
      'base','pending','private','ciphertext','wallet','proof','roleIndex']){
      assert.equal(encoded.includes('"'+secret+'"'),false,'public field '+secret);
    }
    assert.ok(Object.isFrozen(pub));
    assert.ok(Object.isFrozen(pub.usedGambit));
    assert.ok(Object.isFrozen(pub.match));
    assert.equal(pub.mode,'arena-v3-hotseat-view');
  }
  assert.deepEqual(publicArenaHotseat(states[2]).usedGambit,
    {challenger:true,defender:false},'activation is explicitly public in v3');
});

test('invalid handoffs, duplicate commits and forged settlement actions fail closed',()=>{
  const s=createArenaHotseatSession('research-hotseat-invalid');
  for(const type of ['RESOLVE','NEXT_ROUND','SUBMIT','ACCEPT_HANDOFF','SIGN','SEND'])
    assert.throws(()=>act(s,type,{order:plan()}),/ARENA_HOTSEAT_INVALID/);
  const planning=act(s,'START');
  assert.throws(()=>act(planning,'START'),/ARENA_HOTSEAT_INVALID/);
  assert.throws(()=>act(planning,'RESOLVE'),/ARENA_HOTSEAT_INVALID/);
  const handed=act(planning,'SUBMIT',{order:plan(1,2)});
  assert.throws(()=>act(handed,'SUBMIT',{order:plan()}),/ARENA_HOTSEAT_INVALID/);
  assert.throws(()=>act(handed,'NEXT_ROUND'),/ARENA_HOTSEAT_INVALID/);
  const defender=act(handed,'ACCEPT_HANDOFF');
  assert.throws(()=>act(defender,'ACCEPT_HANDOFF'),/ARENA_HOTSEAT_INVALID/);
  const ready=act(defender,'SUBMIT',{order:plan(0)});
  assert.throws(()=>act(ready,'SUBMIT',{order:plan()}),/ARENA_HOTSEAT_INVALID/);
  const review=act(ready,'RESOLVE');
  assert.throws(()=>act(review,'RESOLVE'),/ARENA_HOTSEAT_INVALID/);
  const next=act(review,'NEXT_ROUND');
  assert.equal(next.phase,'planning');
  assert.equal(next.match.round,2);
  assert.equal(publicArenaHotseat(next).usedGambit.challenger,true);
  assert.throws(()=>act(next,'SUBMIT',{order:plan(2,0)}),/once-per-match/);
});

test('invalid data, unknown actions and extra payloads cannot mutate match state',()=>{
  const s=start('research-hotseat-validation');
  for(const event of [null,{},[],{type:'START'},{type:'SUBMIT'},
    {type:'SUBMIT',order:plan(),transaction:'0x123'},
    {type:'SIGN'},{type:'SEND_TRANSACTION',proof:'fake'},
    {type:'SUBMIT',order:{plans:[],formation:0,stakeSector:0}},
    {type:'SUBMIT',order:plan(4,0)}
  ])assert.throws(()=>advanceArenaHotseat(s,event));
  assert.equal(s.match.history.length,0);
  assert.equal(s.match.pending.challenger,null);
});

test('old snapshots never mutate when next participant edits',()=>{
  const first=start('research-hotseat-immutable');
  const order=plan(2,0);
  const handed=act(first,'SUBMIT',{order});
  order.plans[0].base=0;
  assert.notEqual(handed.match.pending.challenger.plans[0].base,0);
  const next=act(handed,'ACCEPT_HANDOFF');
  assert.equal(first.phase,'planning');
  assert.equal(first.match.pending.challenger,null);
  assert.equal(handed.phase,'handoff');
  assert.ok(Object.isFrozen(handed));
  assert.ok(Object.isFrozen(handed.match));
  assert.ok(Object.isFrozen(handed.match.pending.challenger.plans[0]));
  assert.equal(next.match,handed.match,'handoff does not change domain state');
});

test('fresh hotseat match cannot be misrepresented as deployed signed game',()=>{
  const view=publicArenaHotseat(createArenaHotseatSession('research-local-only'));
  assert.equal(view.mode,'arena-v3-hotseat-view');
  assert.equal(view.match.mode,'arena-v3-aggregate-research');
  assert.equal(view.match.status,'planning');
  assert.equal('chainId' in view,false);
  assert.equal('verified' in view,false);
  assert.equal('transactionHash' in view,false);
  assert.equal('contract' in view,false);
  assert.equal(view.match.history.length,0);
  console.log('GAMBIT_ARENA_HOTSEAT_PURE '+JSON.stringify({
    local:true,rounds:5,privacy:'same-device UI handoff only',
    encrypted:false,wallets:0,txs:0,onchainReceipts:0,scriptedWins:0
  }));
});
