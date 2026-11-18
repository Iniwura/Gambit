/**
 * GAMBIT — spatial stage specification.
 * These coordinates refer to the original 1536 × 864 illustrated world.
 * Routes map opening tactics to meaningful arena spaces for the LOCAL practice scene.
 * They are not yet proof of encrypted spatial logic.
 */
export const WORLD = Object.freeze({width:1536,height:864});
export const TEAMS = Object.freeze({
  cyan: Object.freeze([{x:377,y:328},{x:343,y:449},{x:408,y:568}]),
  magenta: Object.freeze([{x:1160,y:326},{x:1194,y:449},{x:1128,y:567}]),
});
export const ARENA_ROUTES = Object.freeze([
  Object.freeze({id:'reactor',name:'REACTOR',action:0,subtitle:'Direct contest',color:0xffc45d,
    hotspot:{x:768,y:430,r:68},cyan:{x:688,y:433},magenta:{x:847,y:433},effect:{x:769,y:431}}),
  Object.freeze({id:'skybridge',name:'UPPER DECK',action:1,subtitle:'Protected approach',color:0x57e9f4,
    hotspot:{x:768,y:259,r:57},cyan:{x:697,y:273},magenta:{x:836,y:273},effect:{x:768,y:271}}),
  Object.freeze({id:'service',name:'SERVICE BAY',action:2,subtitle:'Side-route pressure',color:0xd88cff,
    hotspot:{x:768,y:655,r:59},cyan:{x:697,y:639},magenta:{x:836,y:639},effect:{x:768,y:639}}),
]);
export const ROOMS = Object.freeze([
  Object.freeze({id:'greenhouse',name:'HYDROPONICS',x:356,y:158}),
  Object.freeze({id:'surveillance',name:'OBSERVATION',x:1184,y:157}),
  Object.freeze({id:'cargo',name:'CARGO',x:334,y:673}),
  Object.freeze({id:'fabrication',name:'FABRICATION',x:1210,y:671}),
]);
export function routeForAction(action){
  if(!Number.isInteger(action)||action<0||action>=ARENA_ROUTES.length)throw new RangeError('Invalid arena action');
  return ARENA_ROUTES[action];
}
