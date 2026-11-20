import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const root='http://127.0.0.1:4173';
async function selectCanvas(page,x,y){
  const bounds=await page.locator('canvas').boundingBox();
  assert.ok(bounds,'Phaser canvas is required');
  await page.mouse.click(bounds.x+bounds.width*x/1440,bounds.y+bounds.height*y/810);
}
async function run(viewport){
  const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(root,{waitUntil:'networkidle',timeout:35000});
  assert.equal(response.status(),200);
  await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:15000});
  // Player-selected bot personality is a real gameplay option, not decoration.
  await selectCanvas(page,923,447);
  assert.equal(await page.locator('#game-state').getAttribute('data-opponent-style'),'volatile');
  await selectCanvas(page,720,496);
  await page.locator('#game-state[data-phase="ready"]').waitFor({timeout:8000});
  const state=page.locator('#game-state');
  assert.equal(await state.getAttribute('data-practice-mode'),'three-role-squad');
  assert.equal(await state.getAttribute('data-fighter-plans'),'3');
  assert.equal(await state.getAttribute('data-selected-role'),'SCOUT');
  assert.equal(await state.getAttribute('data-selected-base'),'2');
  // Choose Guardian, set its opening move to STRIKE.
  await selectCanvas(page,470,653);
  assert.equal(await state.getAttribute('data-selected-role'),'GUARDIAN');
  assert.equal(await state.getAttribute('data-selected-base'),'1');
  await selectCanvas(page,108,755);
  assert.equal(await state.getAttribute('data-selected-base'),'0');
  // Changing Guardian must not mutate Scout's independent plan.
  await selectCanvas(page,165,653);
  assert.equal(await state.getAttribute('data-selected-role'),'SCOUT');
  assert.equal(await state.getAttribute('data-selected-base'),'2');
  // Change Striker, then come back to Guardian and confirm persistence.
  await selectCanvas(page,775,653);
  assert.equal(await state.getAttribute('data-selected-role'),'STRIKER');
  await selectCanvas(page,318,755);
  assert.equal(await state.getAttribute('data-selected-base'),'2');
  await selectCanvas(page,470,653);
  assert.equal(await state.getAttribute('data-selected-base'),'0');
  await selectCanvas(page,1165,653);
  assert.equal(await state.getAttribute('data-formation'),'PIVOT');
  await selectCanvas(page,1261,754);
  await page.locator('#game-state[data-phase="resolving"]').waitFor({timeout:7000});
  assert.equal(await state.getAttribute('data-last-lane-count'),'3','all three fighters resolved');
  await page.waitForFunction(()=>document.getElementById('game-state')?.dataset.roleEffectStarts==='3',
    null,{timeout:6000});
  await page.waitForFunction(()=>document.getElementById('game-state')?.dataset.lastRoleEffects==='3',
    null,{timeout:6000});
  assert.equal(await state.getAttribute('data-last-lane-order'),'123',
    'all three public practice lane outcomes must animate in order');
  await page.waitForFunction(()=>{
    const phase=document.getElementById('game-state')?.dataset.phase;
    return phase==='ready'||phase==='finished';
  },null,{timeout:25000});
  assert.equal(await state.getAttribute('data-report-round'),'1',
    'post-round Phaser debrief must be created from actual resolution');
  assert.equal(await state.getAttribute('data-active-lane'),null,
    'all temporary combat focus must clear before the next round');
  assert.equal(errors.length,0,'no browser errors: '+errors.join('; '));
  await ctx.close();
  console.log('PASS independent 3-role squad controls and 3-lane resolution at '+viewport.width+'px');
}
try{
  await run({width:1440,height:900});
  await run({width:390,height:844});
}finally{await browser.close();}
