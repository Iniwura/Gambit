import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V2_CODE_SPACE,V2_ACTION_BUDGET,V2_GUESS_BUDGET,V2_SCAN_BUDGET,
  V2_CLASSES,allV2Codes,scoreV2Guess,scoreV2ClassScan,
  candidateV2Codes,evaluateV2ResearchAction,validateV2Code
} from '../src/research/blacksite-v2-feasibility.mjs';

const key=v=>v.join(',');

test('new puzzle has 7776 bounded codes, not the solvable 256-code training vault',()=>{
  const all=allV2Codes();
  assert.equal(V2_CODE_SPACE,7776);
  assert.equal(all.length,7776);
  assert.equal(new Set(all.map(key)).size,7776);
  assert.deepEqual(all[0],[0,0,0,0,0]);
  assert.deepEqual(all.at(-1),[5,5,5,5,5]);
  assert.equal(V2_ACTION_BUDGET,6);
  assert.equal(V2_GUESS_BUDGET,5);
  assert.equal(V2_SCAN_BUDGET,2);
  assert.equal(Object.keys(V2_CLASSES).length,3);
  assert.equal(Math.log2(V2_CODE_SPACE)>12,true);
  assert.equal(Math.log2(V2_CODE_SPACE)<13,true);
  assert.deepEqual(candidateV2Codes([]).length,7776);
  assert.ok(Object.isFrozen(all));
  assert.ok(Object.isFrozen(all[0]));
});

test('duplicate symbols and asymmetric position information are handled exactly',()=>{
  assert.deepEqual(scoreV2Guess([1,1,2,3,4],[1,2,1,4,3]),
    {exact:1,misplaced:4});
  assert.deepEqual(scoreV2Guess([0,0,0,0,0],[1,1,1,1,1]),
    {exact:0,misplaced:0});
  assert.deepEqual(scoreV2Guess([0,0,0,0,0],[0,0,0,0,0]),
    {exact:5,misplaced:0});
  for(const secret of [
    [0,0,0,0,0],[5,5,5,5,5],[0,1,2,3,4],[5,4,3,2,1]
  ]){
    const sum=Object.keys(V2_CLASSES)
      .reduce((n,name)=>n+scoreV2ClassScan(secret,name),0);
    assert.equal(sum,5,'three class scans partition five secret glyphs');
  }
});

test('scanning improves aggregate intelligence but sacrifices a turn',()=>{
  const code=[0,1,2,3,4];
  let state=evaluateV2ResearchAction(code,[],{
    type:'scan',className:'reactor'
  });
  assert.equal(state.status,'active');
  assert.equal(state.evidence.count,2);
  assert.ok(state.candidateCount<7776);
  assert.equal(state.history.length,1);
  const countAfterFirst=state.candidateCount;
  state=evaluateV2ResearchAction(code,state.history,{
    type:'guess',guess:[0,0,0,0,0]
  });
  assert.ok(state.candidateCount<countAfterFirst);
  assert.equal(state.evidence.exact,1);
  assert.equal(state.evidence.misplaced,0);
  assert.deepEqual(Object.keys(state.evidence).sort(),
    ['exact','guess','misplaced','type']);
  assert.equal(JSON.stringify(state.evidence).includes('secret'),false);
  assert.equal(JSON.stringify(state.evidence).includes('sector'),false);
  assert.ok(Object.isFrozen(state.evidence));
  assert.ok(Object.isFrozen(state.history));
});

test('actions terminate cleanly at a win or six-action budget, with no fabricated win',()=>{
  const code=[5,4,3,2,1];
  const success=evaluateV2ResearchAction(code,[],{
    type:'guess',guess:code
  });
  assert.equal(success.status,'breached');
  assert.equal(success.candidateCount,1);
  let state={status:'active',history:[]};
  for(const guess of [
    [0,0,0,0,0],[0,0,0,0,1],[0,0,0,1,0],
    [0,0,1,0,0],[0,1,0,0,0]
  ])state=evaluateV2ResearchAction([5,5,5,5,5],
    state.history,{type:'guess',guess});
  assert.equal(state.status,'active');
  state=evaluateV2ResearchAction([5,5,5,5,5],
    state.history,{type:'scan',className:'reactor'});
  assert.equal(state.status,'locked');
  assert.equal(state.history.length,6);
  assert.throws(()=>evaluateV2ResearchAction([5,5,5,5,5],
    state.history,{type:'guess',guess:[5,5,5,5,5]}),
  /budget exhausted/);
});

test('scan and guess caps, duplicate clues and contradictions fail closed',()=>{
  const code=[5,5,0,0,1];
  const scan=(className)=>({type:'scan',className});
  const first=evaluateV2ResearchAction(code,[],scan('reactor'));
  assert.throws(()=>evaluateV2ResearchAction(
    code,first.history,scan('reactor')),/Repeated intelligence scan/);
  const second=evaluateV2ResearchAction(code,first.history,scan('transit'));
  assert.throws(()=>evaluateV2ResearchAction(
    code,second.history,scan('security')),/action limits exceeded/);
  const guess=[0,0,0,0,0];
  const afterGuess=evaluateV2ResearchAction(code,[],{type:'guess',guess});
  assert.throws(()=>evaluateV2ResearchAction(code,afterGuess.history,{
    type:'guess',guess}),/Repeated vault guess/);
  assert.throws(()=>candidateV2Codes([{type:'scan',className:'reactor',count:99}]),
    /Invalid BLACKSITE v2 scan count/);
  assert.throws(()=>candidateV2Codes([{type:'guess',guess,exact:5,misplaced:1}]),
    /Invalid BLACKSITE v2 score/);
  assert.throws(()=>candidateV2Codes([
    {type:'scan',className:'reactor',count:0},
    {type:'scan',className:'reactor',count:5}
  ]));
  for(const invalid of [
    [],[0,0,0,0],[0,0,0,0,6],[0,0,0,'1',1],null,{}
  ])assert.throws(()=>validateV2Code(invalid));
});

test('independent candidate filter always retains the true code after legal hints',()=>{
  const samples=allV2Codes().filter((_,i)=>i%193===0);
  assert.ok(samples.length>=40);
  for(const secret of samples){
    let state=evaluateV2ResearchAction(secret,[],{
      type:'scan',className:'security'
    });
    const sampleGuess=[1,0,2,5,4];
    state=evaluateV2ResearchAction(secret,state.history,{
      type:'guess',guess:sampleGuess
    });
    const candidates=candidateV2Codes(state.history);
    assert.ok(candidates.some(x=>key(x)===key(secret)));
    assert.ok(candidates.length<=V2_CODE_SPACE);
    assert.equal(state.candidateCount,candidates.length);
  }
  console.log('GAMBIT_BLACKSITE_V2_RESEARCH '+JSON.stringify({
    codeSpace:7776,entropyBitsApprox:12.925,
    actionBudget:6,guesses:5,optionalScans:2,
    actualFHE:false,competitiveFairnessProven:false,
    secretRevealed:false,
    noWalletTransactions:true
  }));
});
