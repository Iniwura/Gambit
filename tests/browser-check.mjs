import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ROOT='http://127.0.0.1:4173';
await fs.mkdir('browser-evidence',{recursive:true});
let passed=0;
async function runCase(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width<600,hasTouch:viewport.width<600});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const response=await page.goto(ROOT,{waitUntil:'networkidle',timeout:35000});
  assert.equal(response.status(),200,'game page should load');
  const canvas=page.locator('canvas');
  await canvas.waitFor({state:'visible'});
  await page.locator('#game-state[data-phase="intro"]').waitFor({state:"attached",timeout:15000});
  assert.equal(await page.locator('#status').textContent(),'LOCAL PRACTICE · NOT ENCRYPTED');
  await page.screenshot({path:'browser-evidence/'+label+'-intro.png'});
  // Exercise the real visible entry control on both viewport sizes.
  const startBounds=await canvas.boundingBox();
  await page.mouse.click(startBounds.x+startBounds.width/2,startBounds.y+startBounds.height*(496/810));
  try{
    await page.locator('#game-state[data-phase="ready"]').waitFor({state:"attached",timeout:8000});
  }catch(error){
    console.log('ENTRY DEBUG',JSON.stringify({
      phase:await page.locator('#game-state').getAttribute('data-phase'),
      errors,canvas:startBounds,
      status:await page.locator('#game-state').textContent()
    }));
    throw error;
  }
  // Capture the actual playable frame, without intro or result overlays.
  // A green CI run does not establish art quality; reviewers need this image.
  await page.screenshot({path:'browser-evidence/'+label+'-arena-ready.png'});
  for(let turn=0;turn<5;turn++){
    const phase=await page.locator('#game-state').getAttribute('data-phase');
    if(phase==='finished')break;
    if(viewport.width>600){
      await page.keyboard.press(String(turn%3+1));
      await page.keyboard.press(['q','w','e'][turn%3]);
      await page.keyboard.press(['a','s','d'][(turn+1)%3]);
      await page.keyboard.press('Enter');
    }else{
      const r=await canvas.boundingBox();
      // Choose a tactical lane and commit with large touch target.
      await page.mouse.click(r.x+r.width*((108+turn%3*105)/1440),r.y+r.height*(755/810));
      await page.mouse.click(r.x+r.width*(1261/1440),r.y+r.height*(754/810));
    }
    await page.locator('#game-state[data-phase="resolving"]').waitFor({state:"attached",timeout:5000});
    try{
      // CI hosts may throttle the Phaser animation clock under contention.
      // This still requires the real state transition, never a forced result.
      await page.waitForFunction(()=>{
        const p=document.getElementById('game-state')?.dataset.phase;
        return p==='ready'||p==='finished';
      },null,{timeout:25000});
    }catch(error){
      const state=await page.locator('#game-state').evaluate(el=>({...el.dataset,text:el.textContent}));
      console.error('ROUND STALL DIAGNOSTIC',JSON.stringify({label,turn,state,errors}));
      await page.screenshot({path:'browser-evidence/'+label+'-stalled-round-'+turn+'.png'});
      throw error;
    }
    if(turn===0)await page.screenshot({path:'browser-evidence/'+label+'-after-first-round.png'});
  }
  const phase=await page.locator('#game-state').getAttribute('data-phase');
  assert.equal(phase,'finished','match should complete within 5 rounds');
  const rounds=Number(await page.locator('#game-state').getAttribute('data-round'));
  assert.ok(rounds>=3&&rounds<=5,'round count must be bounded');
  await page.screenshot({path:'browser-evidence/'+label+'-finished.png'});
  const seedBefore=await page.locator('#game-state').getAttribute('data-practice-seed');
  const r=await canvas.boundingBox();
  await page.mouse.click(r.x+r.width/2,r.y+r.height*(498/810));
  await page.locator('#game-state[data-phase="intro"][data-round="0"]').waitFor({state:"attached",timeout:5000});
  const seedAfter=await page.locator('#game-state').getAttribute('data-practice-seed');
  assert.notEqual(seedAfter,seedBefore,'rematch loads a different local bot scenario');
  assert.equal(errors.length,0,'no uncaught browser errors: '+errors.join(' / '));
  console.log('PASS '+label+' · complete match in '+rounds+' rounds, rematch reset, no errors');
  passed++;
  await context.close();
}
try{
  await runCase('desktop',{width:1440,height:900});
  await runCase('mobile',{width:390,height:844});
  console.log('GAMBIT browser pass: '+passed+' viewports');
}finally{await browser.close();}
