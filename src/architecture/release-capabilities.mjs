/** Explicit capability map for the engineering branch. This is a policy
 * reference for integration, not the mounted Phaser menu or a deployment oracle.
 * New capabilities must be deliberately enabled after their own acceptance.
 */
const entries=[
 ['arena-practice','arena','LOCAL_CLEAR_TEXT','PLAYABLE','squad-five-round',true,false],
 ['arena-hotseat','arena','LOCAL_CLEAR_TEXT','PLAYABLE','arena-v3-local',true,false],
 ['arena-v3-spectate','arena','VERIFIED_PUBLIC_SEPOLIA','READ_ONLY','arena-v3',true,false],
 ['arena-v3-lobby','arena','SIGNED_SEPOLIA','EXPERIMENTAL','arena-v3',true,true],
 ['arena-v4-debrief','arena','VERIFIED_PUBLIC_SEPOLIA','READ_ONLY','arena-v4',true,false],
 ['arena-v4','arena','RESEARCH_ONLY','LIVE_VALIDATED_NOT_INTEGRATED','arena-v4',false,false],
 ['blacksite-tutorial','blacksite','LOCAL_CLEAR_TEXT','PLAYABLE','blacksite-four-slot',true,false],
 ['blacksite-authored','blacksite','RESEARCH_ONLY','UNDEPLOYED','blacksite-authored-four-slot',false,false],
 ['blacksite-neutral-debrief','blacksite','VERIFIED_PUBLIC_SEPOLIA','READ_ONLY','blacksite-neutral-five-slot',true,false],
 ['blacksite-neutral','blacksite','RESEARCH_ONLY','LIVE_VALIDATED_NOT_INTEGRATED','blacksite-neutral-five-slot',false,false],
 ['academy','training','LOCAL_CLEAR_TEXT','PLAYABLE','academy-five-round',true,false],
 ['commander','profile','VERIFIED_PUBLIC_SEPOLIA','READ_ONLY','commander-v3-history',true,false],
 ['commander-cosmetics','profile','RESEARCH_ONLY','PLANNED_INTEGRATION','cosmetic-eligibility-v1',false,false],
 ['commander-ranked','profile','NONE','PLANNED','unselected',false,false]
];
export const RELEASE_CAPABILITIES=Object.freeze(Object.fromEntries(entries.map(
 ([id,pillar,authority,maturity,ruleset,available,explicitWriteApproval])=>[id,Object.freeze({id,pillar,authority,maturity,ruleset,available,explicitWriteApproval})])));
export function getReleaseCapability(id){
 if(typeof id!=='string'||!Object.hasOwn(RELEASE_CAPABILITIES,id))throw Error('UNKNOWN_GAMBIT_CAPABILITY');
 return RELEASE_CAPABILITIES[id];
}
/** This guard only authorizes navigation intent; never authenticates a score
 * or permits a wallet request. Existing shell is separate until integration. */
export function requirePlayableCapability(id){
 const c=getReleaseCapability(id);
 if(!c.available)throw Error('GAMBIT_CAPABILITY_UNAVAILABLE '+id);
 return c;
}
