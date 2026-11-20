import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFinalizedSquadSnapshot} from '../src/chain/squad-public-verify.mjs';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const ID=7n;
const duel={
  squadId:3n,challenger:B,submitted:true,resolved:true,finalized:true,
  expired:false,packedScore:25n,openedAt:100000n
};
const squad={owner:A,allowedOpponent:B,active:true,claimed:true};

test('wallet-free verifier accepts ONLY finalized FHE score from linked invited contract state',()=>{
  const result=verifyFinalizedSquadSnapshot(ID,duel,squad,ID);
  assert.deepEqual(result,{
    squadId:3n,duelId:7n,
    pointsChallenger:3,pointsDefender:1,outcome:1
  });
  assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(Object.keys(result).sort(),[
    'duelId','outcome','pointsChallenger','pointsDefender','squadId'
  ]);
});

test('a pending, expired, counterfeit or replayed duel can never display as verified',()=>{
  const fail=[
    ()=>verifyFinalizedSquadSnapshot(0n,duel,squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,submitted:false},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,resolved:false},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,finalized:false},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,expired:true},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,openedAt:0n},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,squadId:0n},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,packedScore:255n},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,{...duel,challenger:A},squad,ID),
    ()=>verifyFinalizedSquadSnapshot(ID,duel,{...squad,claimed:false},ID),
    ()=>verifyFinalizedSquadSnapshot(ID,duel,{...squad,allowedOpponent:A},ID),
    ()=>verifyFinalizedSquadSnapshot(ID,duel,{...squad,owner:B},ID),
    ()=>verifyFinalizedSquadSnapshot(ID,duel,squad,8n),
    ()=>verifyFinalizedSquadSnapshot(ID,duel,squad,undefined)
  ];
  for(const failure of fail)assert.throws(failure);
});

test('public proof contains aggregate totals only, never opponent plan data',()=>{
  const a=verifyFinalizedSquadSnapshot(ID,{
    ...duel,enemyPrivateTactics:[{base:0,trigger:1,response:2}]
  },{
    ...squad,unsafePrivateFormation:2
  },ID);
  const visible=JSON.stringify(a,(_,value)=>typeof value==='bigint'?String(value):value);
  for(const term of ['enemyPrivateTactics','trigger','response','base','unsafePrivateFormation'])
    assert.equal(visible.includes(term),false);
});
