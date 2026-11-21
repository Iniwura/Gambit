import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAULT_CODE_LENGTH,VAULT_SYMBOLS,VAULT_STANDARD_ATTEMPTS,
  validateVaultCode,scoreVaultGuess,allVaultCodes,vaultCandidates,
  makeVaultTraining,submitVaultTrainingGuess,publicVaultTrainingState
} from '../src/research/blacksite-cipher.mjs';

test('BLACKSITE cipher defines 256 unique, valid four-glyph secrets and impartial repeat-aware feedback',()=>{
  assert.equal(VAULT_CODE_LENGTH,4);
  assert.equal(VAULT_SYMBOLS,4);
  assert.equal(VAULT_STANDARD_ATTEMPTS,5);
  const codes=allVaultCodes();
  assert.equal(codes.length,256);
  assert.equal(new Set(codes.map(c=>c.join(''))).size,256);
  assert.deepEqual(scoreVaultGuess([0,0,1,1],[0,1,0,2]),{exact:1,misplaced:2});
  assert.deepEqual(scoreVaultGuess([0,0,0,0],[0,1,1,1]),{exact:1,misplaced:0});
  for(const c of codes)assert.deepEqual(validateVaultCode(c),c);
  for(const bad of [undefined,null,{},[0,1,2],[0,1,2,4],[0,1,2,NaN],[0,1,2,1.1],[0,1,2,'1']])
    assert.throws(()=>validateVaultCode(bad),/four symbols/);
  for(const secret of codes)for(const guess of codes){
    const x=scoreVaultGuess(secret,guess);
    assert.ok(x.exact>=0&&x.exact<=4);
    assert.ok(x.misplaced>=0&&x.exact+x.misplaced<=4);
    const reverse=scoreVaultGuess(guess,secret);
    assert.deepEqual(x,reverse,'Mastermind-style feedback should be symmetric');
    assert.equal(x.exact===4,secret.every((v,i)=>v===guess[i]));
  }
});

test('training mission is immutable by convention, enforces budget, refuses duplicates and redacts private state',()=>{
  const secret=[3,3,3,3];
  const game=makeVaultTraining(secret);
  secret[0]=0; // constructor must not alias the caller's mutable secret.
  assert.deepEqual(game.secret,[3,3,3,3]);
  const snap=publicVaultTrainingState(game);
  assert.deepEqual(Object.keys(snap),['round','remaining','status','history']);
  assert.equal(JSON.stringify(snap).includes('secret'),false);
  assert.equal(snap.remaining,5);
  assert.throws(()=>makeVaultTraining([0,0,0,0],3),/attempt budget/);
  assert.throws(()=>makeVaultTraining([0,0,0,0],7),/attempt budget/);
  const guesses=[[0,0,0,0],[0,0,0,1],[0,0,1,0],[0,1,0,0],[1,0,0,0]];
  let current=game;
  for(let i=0;i<guesses.length;i++){
    const before=JSON.stringify(current);
    const {state,event}=submitVaultTrainingGuess(current,guesses[i]);
    assert.equal(JSON.stringify(current),before,'no in-place mutation');
    assert.equal(event.round,i+1);
    assert.equal(event.remaining,4-i);
    assert.equal(event.status,i===4?'locked':'active');
    assert.equal(Object.hasOwn(event,'secret'),false);
    assert.equal(Object.hasOwn(event,'hiddenHazard'),false);
    current=state;
    if(i===0)assert.throws(()=>submitVaultTrainingGuess(current,guesses[i]),/Repeated/);
  }
  assert.equal(current.status,'locked');
  assert.equal(publicVaultTrainingState(current).history.length,5);
  assert.throws(()=>submitVaultTrainingGuess(current,[3,3,3,3]),/not accepting/);

  const win=submitVaultTrainingGuess(makeVaultTraining([2,1,3,0]),[2,1,3,0]);
  assert.equal(win.state.status,'breached');
  assert.deepEqual({exact:win.event.exact,misplaced:win.event.misplaced},{exact:4,misplaced:0});
  assert.throws(()=>submitVaultTrainingGuess(win.state,[1,1,1,1]),/not accepting/);

  const hostile={...win.state,history:[{...win.event,secret:[2,1,3,0],privateKey:'no'}]};
  const publicOnly=publicVaultTrainingState(hostile);
  const json=JSON.stringify(publicOnly);
  assert.equal(json.includes('privateKey'),false);
  assert.equal(json.includes('secret'),false);
  assert.equal(json.includes('hiddenHazard'),false);
  assert.equal(Object.isFrozen(publicOnly.history),true);
});

test('deduction never eliminates the real code; corrupt, duplicate or impossible hints fail closed',()=>{
  for(const secret of allVaultCodes()){
    const mission=makeVaultTraining(secret);
    const first=submitVaultTrainingGuess(mission,[0,1,2,3]);
    const second=first.state.status==='active'
      ?submitVaultTrainingGuess(first.state,[3,2,1,0]):null;
    const seen=second?second.state.history:first.state.history;
    const possible=vaultCandidates(seen);
    assert.ok(possible.some(code=>code.every((v,i)=>v===secret[i])));
    assert.equal(new Set(possible.map(c=>c.join(''))).size,possible.length);
  }
  assert.equal(vaultCandidates([]).length,256);
  assert.throws(()=>vaultCandidates([{guess:[0,0,0,0],exact:4,misplaced:1}]),/Invalid aggregate/);
  assert.throws(()=>vaultCandidates([{guess:[0,0,0,0],exact:0,misplaced:0},
    {guess:[0,0,0,0],exact:0,misplaced:0}]),/Duplicate/);
  assert.throws(()=>vaultCandidates([{guess:[0,0,0,0],exact:4,misplaced:0},
    {guess:[1,1,1,1],exact:4,misplaced:0}]),/Contradictory/);
});

/**
 * Exhaustive mathematical feasibility: a deterministic minimax solver finds
 * every 4-glyph/4-symbol code in at most 4 queries when it can see honest
 * exact+misplaced feedback. Human 4-guess mastery is NOT implied.
 *
 * This proves the side quest is a deduction game, not a coin-flip guessing
 * challenge; it does NOT test encryption, an onchain oracle, UX or HCU.
 */
test('an ideal deductive player can solve all 256 possible vault secrets within four feedback rounds',()=>{
  const codes=allVaultCodes(),N=codes.length;
  const hints=new Uint8Array(N*N);
  for(let secret=0;secret<N;secret++)for(let guess=0;guess<N;guess++){
    const clue=scoreVaultGuess(codes[secret],codes[guess]);
    hints[secret*N+guess]=clue.exact*5+clue.misplaced;
  }
  const cachedChoice=new Map();
  function bestNext(candidates){
    const key=candidates.join(',');
    if(cachedChoice.has(key))return cachedChoice.get(key);
    if(candidates.length===1)return candidates[0];
    const eligible=new Set(candidates);
    let chosen=-1,worstBest=Infinity,chosenNotCandidate=true;
    for(let guess=0;guess<N;guess++){
      const partitions=new Uint16Array(25);
      let worst=0;
      for(const secret of candidates){
        const size=++partitions[hints[secret*N+guess]];
        if(size>worst)worst=size;
        if(worst>worstBest)break;
      }
      if(worst<worstBest||
         (worst===worstBest&&eligible.has(guess)&&chosenNotCandidate)){
        chosen=guess;worstBest=worst;chosenNotCandidate=!eligible.has(guess);
      }
    }
    cachedChoice.set(key,chosen);
    return chosen;
  }
  const attemptsHistogram=new Map();
  for(let secret=0;secret<N;secret++){
    let possible=Array.from({length:N},(_,i)=>i),solved=false;
    for(let attempt=1;attempt<=4;attempt++){
      const guess=bestNext(possible);
      assert.notEqual(guess,-1);
      const hint=hints[secret*N+guess];
      if(hint===20){
        attemptsHistogram.set(attempt,(attemptsHistogram.get(attempt)||0)+1);
        solved=true;
        break;
      }
      possible=possible.filter(candidate=>hints[candidate*N+guess]===hint);
      assert.ok(possible.includes(secret));
    }
    assert.ok(solved,'deduction failed to solve code '+secret+' within four rounds');
  }
  assert.equal([...attemptsHistogram.values()].reduce((a,b)=>a+b,0),256);
  console.log('BLACKSITE_REFERENCE_DEDUCTION_AUDIT '+JSON.stringify({
    secretsExhaustivelyChecked:256,
    solver:'offline deterministic minimax; reference only',
    maxSolverGuesses:Math.max(...attemptsHistogram.keys()),
    distribution:Object.fromEntries(attemptsHistogram),
    encryptedOnchainImplementation:'NOT BUILT',
    realHumanSkill:'NOT TESTED'
  }));
});
