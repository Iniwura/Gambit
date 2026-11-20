import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
await fs.mkdir('browser-evidence',{recursive:true});

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
  const styles=deck.locator('.gambit-mobile-style');
  assert.equal(await styles.count(),3,'all three local bot styles must be touch accessible');
  await styles.nth(0).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-opponent-style'),'steady');
  assert.equal(await styles.nth(0).getAttribute('aria-pressed'),'true');
  await page.locator('#gambit-mobile-enter').click();
  await page.locator('#game-state[data-phase="ready"]').waitFor({timeout:8000});
  const role=deck.locator('.gambit-mobile-role');
  assert.equal(await role.count(),3);
  await role.nth(1).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),'GUARDIAN');
  await deck.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(0).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-base'),'0');
  assert.match(await role.nth(1).textContent(),/GUARDIAN.*STRIKE/,
    'all saved squad openings should remain visible without reselecting');
  await role.nth(0).click();
  assert.match(await role.nth(0).textContent(),/SCOUT.*FLANK/);
  await page.screenshot({path:'browser-evidence/mobile-command-deck.png'});
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),'SCOUT');
  assert.equal(await page.locator('#game-state').getAttribute('data-selected-base'),'2');
  const formations=deck.locator('.gambit-mobile-formation');
  assert.equal(await formations.count(),3);
  await formations.nth(2).click();
  assert.equal(await page.locator('#game-state').getAttribute('data-formation'),'FEINT');
  assert.equal(await formations.nth(2).getAttribute('aria-pressed'),'true');
  await page.locator('#gambit-mobile-lock').click();
  await page.locator('#game-state[data-phase="resolving"]').waitFor({timeout:6000});
  assert.equal(await page.locator('#game-state').getAttribute('data-last-lane-count'),'3');
  assert.equal(await page.locator('#gambit-mobile-lock').isDisabled(),true);
  await page.waitForFunction(()=>{
    const phase=document.getElementById('game-state')?.dataset.phase;
    return phase==='ready'||phase==='finished';
  },null,{timeout:25000});
  const report=page.locator('#gambit-mobile-report');
  assert.equal(await report.isVisible(),true,'after-action public round report must be visible');
  assert.match(await report.textContent(),/ROUND 1/);
  assert.equal(await report.locator('.gambit-mobile-report-lane').count(),3);
  assert.deepEqual(errors,[],'mobile command deck should have no uncaught JS errors');
  console.log('PASS mobile: enter arena, choose a role, edit its independent plan and lock 3 duels');
} finally {await ctx.close();await browser.close();}
