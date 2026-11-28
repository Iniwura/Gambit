import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlacksiteLocalMission,beginBlacksiteLocalMission,
  guessBlacksiteLocalMission,debriefBlacksiteLocalMission,
  restartBlacksiteLocalMission,publicBlacksiteLocalMission
} from '../src/blacksite/mission.mjs';
import {allVaultCodes} from '../src/research/blacksite-cipher.mjs';

test('BLACKSITE local mission: briefing → active → breach → debrief → fresh mission',()=>{
  const secret=[2,1,3,0];
  const briefing=createBlacksiteLocalMission('local-mission-1',secret);
  assert.equal(briefing.phase,'briefing');
  assert.equal(briefing.remaining,5);
  assert.throws(()=>guessBlacksiteLocalMission(briefing,[2,1,3,0]),/not accepting/);
  const active=beginBlacksiteLocalMission(briefing);
  const {state:win,event}=guessBlacksiteLocalMission(active,[2,1,3,0]);
  assert.equal(win.phase,'breached');
  assert.equal(win.outcome,'breached');
  assert.equal(event.exact,4);
  assert.equal(event.remaining,4);
  assert.equal(win.remaining,4);
  assert.equal(briefing.phase,'briefing');
  assert.equal(active.phase,'active');
  assert.throws(()=>guessBlacksiteLocalMission(win,[2,1,3,0]),/not accepting/);
  assert.throws(()=>debriefBlacksiteLocalMission(active),/terminal/);
  const debrief=debriefBlacksiteLocalMission(win);
  assert.equal(debrief.phase,'debrief');
  assert.equal(debrief.outcome,'breached');
  assert.throws(()=>restartBlacksiteLocalMission(debrief,'local-mission-1',[0,1,2,3]),/distinct/);
  const fresh=restartBlacksiteLocalMission(debrief,'local-mission-2',[0,1,2,3]);
  assert.equal(fresh.phase,'briefing');
  assert.equal(fresh.round,0);
  assert.equal(fresh.history.length,0);
  assert.equal(fresh.outcome,null);
});

test('five distinct failures lock the vault, no sixth guess, and preserve chronology',()=>{
  const start=beginBlacksiteLocalMission(createBlacksiteLocalMission(
    'local-five-failures',[3,3,3,3]));
  const guesses=[[0,0,0,0],[0,0,0,1],[0,0,1,0],[0,1,0,0],[1,0,0,0]];
  let state=start;
  for(let i=0;i<5;i++){
    const previous=state;
    const next=guessBlacksiteLocalMission(state,guesses[i]);
    assert.equal(next.event.round,i+1);
    assert.equal(next.event.remaining,4-i);
    state=next.state;
    assert.equal(state.round,i+1);
    assert.equal(state.phase,i===4?'locked':'active');
    assert.equal(state.history.length,i+1);
    assert.equal(previous.history.length,i,'history must be immutable');
  }
  assert.equal(state.outcome,'locked');
  assert.equal(publicBlacksiteLocalMission(state).outcome,'locked');
  assert.throws(()=>guessBlacksiteLocalMission(state,[3,3,3,3]),/not accepting/);
  const fresh=restartBlacksiteLocalMission(state,'local-retry-new',[1,1,1,1]);
  assert.equal(fresh.remaining,5);
  assert.equal(fresh.phase,'briefing');
  assert.throws(()=>guessBlacksiteLocalMission(state,[1,1,1,1]),/not accepting/);
});

test('duplicate guesses and malformed input are refused without state mutation',()=>{
  const state=beginBlacksiteLocalMission(createBlacksiteLocalMission(
    'local-input-guard',[3,3,0,0]));
  for(const bad of [[],[1,2,3],[4,0,0,0],['1',0,0,0],{},null])
    assert.throws(()=>guessBlacksiteLocalMission(state,bad));
  const first=guessBlacksiteLocalMission(state,[0,0,0,0]);
  assert.throws(()=>guessBlacksiteLocalMission(first.state,[0,0,0,0]),/Repeated/);
  assert.equal(first.state.history.length,1);
  assert.equal(state.history.length,0);
  for(const bad of ['battle-1','local-','local-A','local-evil?x',null])
    assert.throws(()=>createBlacksiteLocalMission(bad,[1,0,0,0]));
});

test('local cleartext hidden code never appears in public events/snapshots',()=>{
  const secret=[3,0,2,1];
  const briefing=createBlacksiteLocalMission('local-redacted-example',secret);
  const started=beginBlacksiteLocalMission(briefing);
  const guess=guessBlacksiteLocalMission(started,[0,0,0,0]);
  secret[0]=0; // caller mutation cannot affect private training state
  const leakedNames=['secret','privateKey','hiddenHazard','ciphertext'];
  for(const item of [briefing,started,guess.state,guess.event,
    publicBlacksiteLocalMission(guess.state)]){
    const keys=JSON.stringify(item);
    for(const key of leakedNames)assert.equal(keys.includes(key),false);
    assert.ok(Object.isFrozen(item));
  }
  assert.equal(JSON.stringify(guess.state).includes('"secret"'),false);
  assert.equal(guess.state.history[0].exact,1,
    'first local guess has one exact position in original secret');
  assert.equal(guess.state.history[0].misplaced,0);
  assert.ok(Object.isFrozen(guess.state.history));
  assert.ok(Object.isFrozen(guess.state.history[0]));
  assert.deepEqual(Object.keys(publicBlacksiteLocalMission(guess.state)).sort(),
    ['history','missionId','mode','outcome','phase','remaining','round','version']);
});

test('forged snapshots cannot gain mission controls or leak local secrets',()=>{
  const a=createBlacksiteLocalMission('local-forgery',[0,1,2,3]);
  const b=beginBlacksiteLocalMission(a);
  for(const forged of [
    {...b},Object.freeze({...b,phase:'breached'}),
    {...b,history:[{guess:[0,1,2,3],exact:4}]},
    structuredClone(publicBlacksiteLocalMission(b)),
    null,
    {mode:'blacksite-local-mission',version:1,missionId:'local-forgery',phase:'active'}
  ]){
    assert.throws(()=>guessBlacksiteLocalMission(forged,[0,1,2,3]));
    assert.throws(()=>publicBlacksiteLocalMission(forged));
  }
});

test('all 256 local secrets can be won by the correct answer, with no chain calls',()=>{
  let verified=0;
  for(const secret of allVaultCodes()){
    const state=beginBlacksiteLocalMission(createBlacksiteLocalMission(
      'local-exhaustive-'+verified,secret));
    const outcome=guessBlacksiteLocalMission(state,secret);
    assert.equal(outcome.state.phase,'breached');
    assert.equal(outcome.event.exact,4);
    assert.equal(outcome.event.misplaced,0);
    assert.equal(outcome.state.history.length,1);
    verified++;
  }
  assert.equal(verified,256);
  console.log('GAMBIT_BLACKSITE_MISSION_CONTRACT '+JSON.stringify({
    mode:'LOCAL_HEADLESS_ONLY',secretsChecked:256,attemptBudget:5,
    privateTrainingCodeExcludedFromState:true,
    encryptedContract:'NOT BUILT',gameUI:'NOT BUILT',walletCalls:0
  }));
});
