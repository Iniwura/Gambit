import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCommanderIdentity,saveCommanderIdentity,loadCommanderIdentity,
  commanderIdentityStorageKey,deriveCommanderProfile
} from '../src/profile/commander-profile.mjs';

const WALLET='0xEa0C73e7a8D7149e641805e7Eb4eC0D4195C403C';
function storage(){
  const values=new Map();
  return {
    values,
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value))
  };
}

test('Commander identity persists only public address and call sign',()=>{
  const store=storage();
  const identity=createCommanderIdentity(WALLET,{callSign:'NIGHT SHIFT',createdAt:1700000000000});
  const saved=saveCommanderIdentity(store,identity);
  assert.deepEqual(loadCommanderIdentity(store,WALLET),saved);
  assert.equal(store.values.size,1);
  const raw=[...store.values.values()][0];
  assert.equal(raw.includes('mnemonic'),false);
  assert.equal(raw.includes('privateKey'),false);
  assert.equal(raw.includes('ciphertext'),false);
  assert.equal(commanderIdentityStorageKey(WALLET).startsWith('gambit.commander.identity.v1:'),true);
});

test('identity storage fails closed on wrong wallet, malformed JSON and invalid call signs',()=>{
  const store=storage();
  const identity=createCommanderIdentity(WALLET,{createdAt:1700000000000});
  saveCommanderIdentity(store,identity);
  assert.equal(loadCommanderIdentity(store,'0xC3e1CE842aDB49FC7B3e0fA5Cc6A0684fFd5D0c2'),null);
  store.values.set(commanderIdentityStorageKey(WALLET),'not-json');
  assert.equal(loadCommanderIdentity(store,WALLET),null);
  assert.throws(()=>createCommanderIdentity(WALLET,{callSign:'contains.secret'}),/call sign/);
});

test('Commander progression rejects local practice, JSON copies and unapproved history',()=>{
  const identity=createCommanderIdentity(WALLET,{createdAt:1700000000000});
  const fake={
    evidence:'canonical-sepolia-arena-v3-match',matchId:'1',
    challenger:WALLET,defender:'0xC3e1CE842aDB49FC7B3e0fA5Cc6A0684fFd5D0c2',
    creationTransaction:'0x'+'11'.repeat(32),creationBlock:12200000,
    currentRound:5,complete:true,winner:1,rounds:[]
  };
  for(const history of [
    {authority:'LOCAL_PRACTICE',matches:[fake]},
    {authority:'APPROVED_ARENA_V3_CANONICAL',matches:[fake]},
    {authority:'APPROVED_ARENA_V3_CANONICAL',matches:[JSON.parse(JSON.stringify(fake))]}
  ])assert.throws(()=>deriveCommanderProfile(identity,history),/COMMANDER_PROFILE_INVALID/);
});
