/**
 * GAMBIT Phase 1: pure game-shell navigation contract.
 *
 * This is NOT a UI, matchmaking, profile database, or BLACKSITE game.
 * All adapters remain separate. Every action is side-effect-free and the
 * feature manifest fails closed for unimplemented product pillars.
 *
 * The renderer may render only enabled scenes. A scene does not gain
 * implementation status simply because it is named in the master plan.
 */
export const SHELL_VERSION=1;
export const GAME_SCENES=Object.freeze({
  home:Object.freeze({label:'GAMBIT',pillar:'platform',available:true,
    authority:'none',description:'Public game entry and navigation'}),
  training:Object.freeze({label:'Training',pillar:'training',available:true,
    authority:'local-practice',description:'Five-round cleartext squad practice'}),
  'blacksite-training':Object.freeze({label:'BLACKSITE Local Training',
    pillar:'blacksite',available:true,authority:'local-training',
    description:'Playable four-glyph local deduction mission, five attempts, no FHE'}),
  'arena-spectate':Object.freeze({label:'Verified Arena Result',pillar:'arena',
    available:true,authority:'verified-public-sepolia',
    description:'Public read-only score; no wallet and no secret lane outcomes'}),
  'arena-wallet-lab':Object.freeze({label:'Arena Wallet Lab',pillar:'arena',
    available:true,authority:'signed-sepolia-actions',
    description:'Experimental explicit-action squad challenge flows'}),
  'arena-competitive':Object.freeze({label:'Competitive Arena',pillar:'arena',
    available:false,authority:'not-implemented',
    description:'Full multi-round match lobby, strategy and rematch system not built'}),
  'blacksite-mission':Object.freeze({label:'BLACKSITE',pillar:'blacksite',
    available:false,authority:'not-implemented',
    description:'Encrypted competitive BLACKSITE mission and contract are not implemented'}),
  'commander-profile':Object.freeze({label:'Commander Profile',pillar:'profile',
    available:false,authority:'not-implemented',
    description:'Verified history and persistent player progression not implemented'})
});
export const PLATFORM_PILLARS=Object.freeze(['arena','blacksite','training','profile']);
const SCENE_KEYS=Object.keys(GAME_SCENES);
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function exactKeys(value,expected,label){
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('Invalid '+label);
  const keys=Object.keys(value);
  if(keys.length!==expected.length||keys.some(k=>!expected.includes(k)))
    throw Error('Invalid '+label+' fields');
}
function validateScreen(screen){
  if(typeof screen!=='string'||!hasOwn(GAME_SCENES,screen))
    throw Error('Unknown GAMBIT game scene');
  return GAME_SCENES[screen];
}
function validState(state){
  exactKeys(state,['version','scene','history'],'game shell state');
  if(state.version!==SHELL_VERSION)throw Error('Unsupported game shell version');
  const current=validateScreen(state.scene);
  if(!current.available)throw Error('State contains unavailable scene');
  if(!Array.isArray(state.history)||state.history.length>32)
    throw Error('Invalid navigation history');
  for(const prior of state.history){
    const entry=validateScreen(prior);
    if(!entry.available)throw Error('Navigation history contains unavailable scene');
  }
  return state;
}
function snapshot(scene,history){
  return Object.freeze({version:SHELL_VERSION,scene,
    history:Object.freeze([...history])});
}
export function createGameShell(){
  return snapshot('home',[]);
}
export function gameSceneAvailability(){
  return Object.freeze(SCENE_KEYS.map(scene=>Object.freeze({id:scene,...GAME_SCENES[scene]})));
}
export function transitionGameShell(state,event){
  validState(state);
  if(!event||typeof event!=='object'||Array.isArray(event))
    throw Error('Invalid game shell action');
  if(event.type==='OPEN'){
    exactKeys(event,['type','scene'],'OPEN action');
    const target=validateScreen(event.scene);
    if(!target.available)
      throw Error('NOT_IMPLEMENTED: '+target.label+'. '+target.description);
    if(state.scene===event.scene)return state;
    if(state.history.length>=32)throw Error('Navigation history limit reached');
    return snapshot(event.scene,[...state.history,state.scene]);
  }
  if(event.type==='BACK'){
    exactKeys(event,['type'],'BACK action');
    if(state.history.length===0)throw Error('No earlier game scene');
    const history=state.history.slice(0,-1);
    return snapshot(state.history[state.history.length-1],history);
  }
  if(event.type==='HOME'){
    exactKeys(event,['type'],'HOME action');
    return snapshot('home',[]);
  }
  throw Error('Unknown game shell action');
}
