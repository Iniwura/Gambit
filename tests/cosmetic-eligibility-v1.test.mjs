import test from 'node:test';
import assert from 'node:assert/strict';
import {cosmeticEligibility as derive} from '../src/research/cosmetic-eligibility-v1.mjs';
const empty={matches:0,wins:0,losses:0,draws:0,distinctOpponents:0};
const none={arenaCompletions:0,academyCompletions:0,vaultBreaches:0};
test('local mastery cannot unlock a competitive cosmetic; incomplete missions do not qualify',()=>{
 const all=derive({arenaCompletions:100,academyCompletions:10,vaultBreaches:100},empty);
 assert.equal(all.localOnly.length,3);assert.equal(all.verifiedOnly.length,0);
 assert.equal(all.verifiedBlacksite.length,0);assert.equal(all.affectsGameplay,false);
});
test('competitive cosmetic milestone counts distinct completed rivals and can roll back on revalidation',()=>{
 const v={matches:5,wins:1,losses:4,draws:0,distinctOpponents:1};
 assert.equal(derive(none,v).verifiedOnly.length,2);
 assert.equal(derive(none,{...v,distinctOpponents:5}).verifiedOnly.length,3);
 assert.equal(derive(none,empty).verifiedOnly.length,0);
 assert.throws(()=>derive(none,{...v,wins:5}),/INVALID/);
 assert.throws(()=>derive(none,{...v,distinctOpponents:6}),/INVALID/);
 assert.throws(()=>derive({...none,academyCompletions:-1},empty),/INVALID/);
});
