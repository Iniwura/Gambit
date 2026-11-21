import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHELL_VERSION,PLATFORM_PILLARS,GAME_SCENES,
  createGameShell,gameSceneAvailability,transitionGameShell
} from '../src/architecture/game-shell.mjs';

test('master scope retains all four pillars without falsely enabling unfinished product',()=>{
  assert.deepEqual(PLATFORM_PILLARS,['arena','blacksite','training','profile']);
  const all=gameSceneAvailability();
  assert.deepEqual(new Set(all.map(x=>x.id)),new Set(Object.keys(GAME_SCENES)));
  for(const id of ['home','training','arena-spectate','arena-wallet-lab']){
    const entry=all.find(x=>x.id===id);
    assert.equal(entry.available,true,id);
  }
  for(const id of ['arena-competitive','blacksite-mission','commander-profile']){
    const entry=all.find(x=>x.id===id);
    assert.equal(entry.available,false,id);
    assert.equal(entry.authority,'not-implemented');
    assert.match(entry.description,/not|do not/i);
  }
  assert.equal(all.find(x=>x.id==='blacksite-mission').available,false,
    'headless BLACKSITE research engine is NOT a playable mission');
});

test('navigation transitions are immutable, deterministic, bounded and reversible',()=>{
  const initial=createGameShell();
  assert.equal(initial.version,SHELL_VERSION);
  assert.equal(initial.scene,'home');
  assert.ok(Object.isFrozen(initial)&&Object.isFrozen(initial.history));
  const training=transitionGameShell(initial,{type:'OPEN',scene:'training'});
  assert.equal(training.scene,'training');
  assert.deepEqual(training.history,['home']);
  assert.equal(initial.scene,'home','prior snapshot never mutated');
  assert.equal(transitionGameShell(training,{type:'OPEN',scene:'training'}),training);
  const spectator=transitionGameShell(training,{type:'OPEN',scene:'arena-spectate'});
  assert.equal(spectator.scene,'arena-spectate');
  assert.deepEqual(spectator.history,['home','training']);
  assert.deepEqual(transitionGameShell(spectator,{type:'BACK'}),training);
  assert.deepEqual(transitionGameShell(spectator,{type:'HOME'}),initial);
  assert.throws(()=>transitionGameShell(initial,{type:'BACK'}),/No earlier/);
});

test('unimplemented modes fail closed without mutating the current game',()=>{
  const state=createGameShell();
  for(const scene of ['arena-competitive','blacksite-mission','commander-profile']){
    assert.throws(()=>transitionGameShell(state,{type:'OPEN',scene}),
      /NOT_IMPLEMENTED/);
    assert.deepEqual(state,createGameShell());
  }
  for(const action of [
    {type:'OPEN',scene:'blacksite-training'},
    {type:'OPEN',scene:'__proto__'},
    {type:'OPEN',scene:'toString'},
    {type:'OPEN',scene:undefined},
    {type:'OPEN',scene:'training',privatePlan:'secret'},
    {type:'BACK',proof:'forged'},
    {type:'HOME',walletAddress:'hidden'},
    {type:'SIGN'},
    {},
    null
  ])assert.throws(()=>transitionGameShell(state,action));
});

test('state tampering, prototype tricks and unavailable history cannot bypass gates',()=>{
  const clean=createGameShell();
  for(const bad of [
    {...clean,scene:'blacksite-mission'},
    {...clean,scene:'commander-profile'},
    {...clean,history:['arena-competitive']},
    {...clean,version:2},
    {...clean,history:new Array(33).fill('home')},
    {...clean,privateKey:'not allowed'},
    {...clean,scene:'__proto__'},
    {...clean,history:'home'},
    undefined
  ])assert.throws(()=>transitionGameShell(bad,{type:'OPEN',scene:'training'}));
  const state=transitionGameShell(clean,{type:'OPEN',scene:'arena-spectate'});
  const json=JSON.stringify(state);
  assert.equal(json.includes('private'),false);
  assert.equal(json.includes('proof'),false);
  assert.equal(json.includes('wallet'),false);
  assert.equal(json.includes('cipher'),false);
});

test('headless shell has no browser, wallet, RPC, or transaction side effects',()=>{
  const s=createGameShell();
  for(const scene of ['training','arena-wallet-lab','arena-spectate']){
    const next=transitionGameShell(s,{type:'OPEN',scene});
    assert.equal(next.scene,scene);
  }
  // This architecture contract ONLY permits navigation, not signing.
  assert.equal(typeof transitionGameShell(s,{type:'HOME'}).then,'undefined');
  assert.throws(()=>transitionGameShell(s,{type:'SEND_TRANSACTION'}));
});
