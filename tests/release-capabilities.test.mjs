import test from 'node:test';
import assert from 'node:assert/strict';
import {RELEASE_CAPABILITIES,getReleaseCapability,requirePlayableCapability} from '../src/architecture/release-capabilities.mjs';
test('release capability policy retains four pillars and distinct rulesets',()=>{
 const all=Object.values(RELEASE_CAPABILITIES);
 assert.deepEqual([...new Set(all.map(x=>x.pillar))].sort(),['arena','blacksite','profile','training']);
 assert.ok(Object.isFrozen(RELEASE_CAPABILITIES)&&all.every(Object.isFrozen));
 assert.equal(getReleaseCapability('blacksite-tutorial').ruleset,'blacksite-four-slot');
 assert.equal(getReleaseCapability('blacksite-neutral').ruleset,'blacksite-neutral-five-slot');
 assert.equal(getReleaseCapability('arena-v4').ruleset,'arena-v4');
});
test('research or planned capabilities cannot be opened or mistaken for live modes',()=>{
 for(const id of ['arena-v4','blacksite-authored','blacksite-neutral','commander-cosmetics','commander-ranked']){
  assert.equal(getReleaseCapability(id).available,false);
  assert.throws(()=>requirePlayableCapability(id),/UNAVAILABLE/);
 }
 for(const id of ['__proto__','constructor','toString','unknown',null])
  assert.throws(()=>getReleaseCapability(id),/UNKNOWN/);
});
test('only experimental signed V3 lobby can stage an explicitly approved write; navigation is not approval',()=>{
 const writable=Object.values(RELEASE_CAPABILITIES).filter(x=>x.explicitWriteApproval);
 assert.deepEqual(writable.map(x=>x.id),['arena-v3-lobby']);
 assert.equal(requirePlayableCapability('arena-v3-lobby').authority,'SIGNED_SEPOLIA');
 assert.equal(requirePlayableCapability('arena-v3-spectate').authority,'VERIFIED_PUBLIC_SEPOLIA');
 assert.equal(requirePlayableCapability('commander').authority,'VERIFIED_PUBLIC_SEPOLIA');
 for(const id of ['arena-practice','arena-hotseat','blacksite-tutorial','academy']){
  const c=requirePlayableCapability(id);assert.equal(c.authority,'LOCAL_CLEAR_TEXT');assert.equal(c.explicitWriteApproval,false);
 }
});

test('live validated modes stay unavailable for writes while public debriefs are enabled',()=>{
 for(const id of ['arena-v4','blacksite-neutral'])assert.equal(getReleaseCapability(id).maturity,'LIVE_VALIDATED_NOT_INTEGRATED');
 for(const id of ['arena-v4-debrief','blacksite-neutral-debrief']){
 const c=requirePlayableCapability(id);assert.equal(c.maturity,'READ_ONLY');assert.equal(c.authority,'VERIFIED_PUBLIC_SEPOLIA');assert.equal(c.explicitWriteApproval,false);
 }
});
