import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUAD_INPUT_COUNT,SQUAD_EXPIRY_SECONDS,encodeSquadInputs,
  decodePackedSquadScore,validateSquadStatus,canOpenSquad,squadDuelStep
} from '../src/chain/squad-lifecycle.mjs';
const a='0x1111111111111111111111111111111111111111';
const b='0x'+'2'.repeat(40);
const c='0x3333333333333333333333333333333333333333';
const open={squadId:1n,challenger:b,openedAt:100n,
  submitted:false,resolved:false,finalized:false,expired:false,packedScore:0n};

test('exactly ten encrypted values, ordered nine role tactics then private formation',()=>{
  const plans=[{base:0,trigger:1,response:2},{base:1,trigger:0,response:2},{base:2,trigger:1,response:0}];
  const encoded=encodeSquadInputs(plans,2);
  assert.equal(encoded.length,SQUAD_INPUT_COUNT);
  assert.deepEqual(encoded,[0n,1n,2n,1n,0n,2n,2n,1n,0n,2n]);
  for(const x of [-1,3,NaN,1.5,'1',undefined])
    assert.throws(()=>encodeSquadInputs(plans,x),/Squad formation/);
  assert.throws(()=>encodeSquadInputs(plans.slice(0,2),0),/three encrypted/);
  const changed=plans.map(p=>({...p}));
  changed[1].trigger=10;
  assert.throws(()=>encodeSquadInputs(changed,1),/Invalid trigger/);
});

test('all valid packed scores decode to bounded winner without exposing lanes',()=>{
  for(let p=0;p<=255;p++){
    const valid=(p>>3)<=5&&(p&7)<=5;
    if(!valid){assert.throws(()=>decodePackedSquadScore(p),/Impossible/);continue;}
    const d=decodePackedSquadScore(BigInt(p));
    assert.equal(d.packed,p);
    assert.ok(d.challenger>=0&&d.challenger<=5);
    assert.ok(d.defender>=0&&d.defender<=5);
    assert.equal(d.outcome,d.challenger===d.defender?0:d.challenger>d.defender?1:2);
    assert.deepEqual(Object.keys(d),['packed','challenger','defender','outcome']);
  }
  for(const v of [-1,256,NaN,10.25,'4',undefined])
    assert.throws(()=>decodePackedSquadScore(v),/Invalid packed/);
});

test('only invited challenger can open an unclaimed squad',()=>{
  const s={owner:a,allowedOpponent:b,active:true,claimed:false};
  assert.equal(validateSquadStatus(s),'inviting');
  assert.equal(canOpenSquad(s,b),true);
  assert.equal(canOpenSquad(s,b.toUpperCase().replace('0X','0x')),true);
  assert.equal(canOpenSquad(s,a),false);
  assert.equal(canOpenSquad(s,c),false);
  assert.equal(canOpenSquad({...s,claimed:true},b),false);
  assert.equal(validateSquadStatus({...s,active:false}),'closed');
  assert.throws(()=>validateSquadStatus({...s,owner:b}),/Invalid or unknown/);
  assert.throws(()=>validateSquadStatus({...s,allowedOpponent:'0x2222222'}),/Invalid or unknown/);
});

test('state driven recovery and chain-timestamp expiry, with no fabricated completion',()=>{
  assert.equal(squadDuelStep(open,b,100n),'submit');
  assert.equal(squadDuelStep(open,b,100n+SQUAD_EXPIRY_SECONDS),'submit');
  assert.equal(squadDuelStep(open,b,100n+SQUAD_EXPIRY_SECONDS+1n),'expired');
  assert.throws(()=>squadDuelStep(open,a,100n),/Only the invited/);
  assert.equal(squadDuelStep({...open,submitted:true},a),'resolve');
  assert.equal(squadDuelStep({...open,submitted:true,resolved:true},a),'finalize');
  assert.equal(squadDuelStep({...open,submitted:true,resolved:true,finalized:true,packedScore:40n},a),'verified');
  assert.equal(squadDuelStep({...open,expired:true},a),'expired');
  assert.throws(()=>squadDuelStep({...open,finalized:true},a),/Contradictory/);
  assert.throws(()=>squadDuelStep({...open,submitted:true,expired:true},b),/Contradictory/);
  assert.throws(()=>squadDuelStep({...open,submitted:true,resolved:true,finalized:true,packedScore:255n},b),/Impossible/);
  assert.throws(()=>squadDuelStep({...open,openedAt:0n},b),/Unknown/);
});
