import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, TEAMS, ARENA_ROUTES, ROOMS, routeForAction } from '../src/layout.mjs';
test('map uses 16:9 game world',()=>{assert.deepEqual(WORLD,{width:1536,height:864});});
test('three clear, unique tactical routes',()=>{
 assert.equal(ARENA_ROUTES.length,3);
 assert.equal(new Set(ARENA_ROUTES.map(x=>x.id)).size,3);
 assert.equal(new Set(ARENA_ROUTES.map(x=>x.action)).size,3);
 assert.ok(ARENA_ROUTES[1].hotspot.y<ARENA_ROUTES[0].hotspot.y);
 assert.ok(ARENA_ROUTES[2].hotspot.y>ARENA_ROUTES[0].hotspot.y);
});
test('each route is reachable and balanced between sides',()=>{
 for(const r of ARENA_ROUTES){
  for(const point of [r.hotspot,r.cyan,r.magenta,r.effect]){
   assert.ok(point.x>100&&point.x<WORLD.width-100);
   assert.ok(point.y>170&&point.y<WORLD.height-140);
  }
  assert.ok(r.cyan.x<r.magenta.x);
  assert.ok(Math.abs((768-r.cyan.x)-(r.magenta.x-768))<=3);
  assert.equal(routeForAction(r.action),r);
 }
});
test('spawn squads are on distinct sides of arena',()=>{
 assert.equal(TEAMS.cyan.length,3);assert.equal(TEAMS.magenta.length,3);
 assert.ok(TEAMS.cyan.every(p=>p.x<500));
 assert.ok(TEAMS.magenta.every(p=>p.x>1000));
});
test('environment contains four distinct non-combat rooms',()=>{
 assert.equal(ROOMS.length,4);assert.equal(new Set(ROOMS.map(x=>x.id)).size,4);
});
test('reject invalid route actions',()=>{
 for(const val of [-1,3,1.2,'0',null])assert.throws(()=>routeForAction(val));
});
