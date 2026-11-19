import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
try {
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const r=await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle',timeout:35000});
  assert.equal(r.status(),200);
  await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
  const deck=page.locator('#gambit-mobile-deck');
  assert.equal(await deck.isVisible(),true,'real mobile command deck required');
  await page.locator('#gambit-mobile-enter').click();
  await page.locator('#game-state[data-phase="ready"]').waitFor({timeout:8000});
  const role=deck.locator('.gambit-mobile-role');
  assert.equal(await role.count(),3);
  await role.nth(1).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),'GUARDIAN');
  await deck.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(0).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-base'),'0');
  await role.nth(0).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),'SCOUT');
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-base'),'2');
  await page.locator('#gambit-mobile-lock').click();
  await page.locator('#game-state[data-phase="resolving"]').waitFor({timeout:6000});
  assert.equal(await page.locator('#game-state').getAttribute('data-last-lane-count'),'3');
  assert.equal(await page.locator('#gambit-mobile-lock').isDisabled(),true);
  await page.waitForFunction(()=>{
    const phase=document.getElementById('game-state')?.dataset.phase;
    return phase==='ready'||phase==='finished';
  },null,{timeout:25000});
  assert.deepEqual(errors,[],'mobile command deck should have no uncaught JS errors');
  console.log('PASS mobile: enter arena, choose a role, edit its independent plan and lock 3 duels');
} finally {await ctx.close();await browser.close();}
