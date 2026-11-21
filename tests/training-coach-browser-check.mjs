import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ROOT='http://127.0.0.1:4173';

async function scenario(viewport,label){
  const context=await browser.newContext({
    viewport,isMobile:viewport.width<700,hasTouch:viewport.width<700
  });
  try{
    const page=await context.newPage();
    const exceptions=[];
    page.on('pageerror',e=>exceptions.push(e.message));
    const res=await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    assert.equal(res.status(),200);
    await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
    const initialSeed=await page.locator('#game-state').getAttribute('data-practice-seed');
    const coachOpen=page.locator(viewport.width<700
      ?'#gambit-training-mobile-open':'#gambit-training-open');
    assert.equal(await coachOpen.isVisible(),true,'real visible Academy launcher');
    await coachOpen.click();
    const panel=page.locator('#gambit-training-panel');
    assert.equal(await panel.isVisible(),true);
    assert.equal(await panel.getAttribute('data-guide-step'),'enter');
    assert.match(await panel.textContent(),/LOCAL PRACTICE ONLY/);
    assert.equal(await page.locator('#game-state').getAttribute('data-round'),'0',
      'opening tutor must not run a simulated turn');

    if(viewport.width<700){
      await page.locator('#gambit-mobile-enter').click();
    }else{
      const canvas=await page.locator('canvas').boundingBox();
      assert.ok(canvas);
      await page.mouse.click(canvas.x+canvas.width/2,
        canvas.y+canvas.height*(518/810));
    }
    await page.locator('#game-state[data-phase="ready"]').waitFor({timeout:8000});
    assert.equal(await panel.getAttribute('data-guide-step'),'role');
    // Wrong-but-valid actual command must not progress the tutorial.
    if(viewport.width<700){
      await page.locator('.gambit-mobile-role').nth(1).click();
    }else{
      await page.keyboard.press('5');
    }
    assert.equal(await panel.getAttribute('data-guide-step'),'role');
    assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),
      'GUARDIAN','wrong tutorial role still updates real Phaser rules');

    async function action(desktop,mobileButton){
      if(viewport.width<700)await mobileButton.click();
      else await page.keyboard.press(desktop);
    }
    await action('6',page.locator('.gambit-mobile-role').nth(2));
    assert.equal(await panel.getAttribute('data-guide-step'),'opening');
    await action('3',page.locator('.gambit-mobile-action-group').nth(0)
      .locator('button').nth(2));
    assert.equal(await panel.getAttribute('data-guide-step'),'trigger');
    await action('q',page.locator('.gambit-mobile-action-group').nth(1)
      .locator('button').nth(0));
    assert.equal(await panel.getAttribute('data-guide-step'),'counter');
    await action('s',page.locator('.gambit-mobile-action-group').nth(2)
      .locator('button').nth(1));
    assert.equal(await panel.getAttribute('data-guide-step'),'formation');
    await action('9',page.locator('.gambit-mobile-formation').nth(2));
    assert.equal(await panel.getAttribute('data-guide-step'),'commit');
    assert.equal(await page.locator('#game-state').getAttribute('data-formation'),'FEINT');
    assert.equal(await page.locator('#game-state').getAttribute('data-selected-role'),'STRIKER');
    assert.equal(await page.locator('#game-state').getAttribute('data-selected-base'),'2');
    assert.equal(await page.locator('#game-state').getAttribute('data-selected-trigger'),'0');
    assert.equal(await page.locator('#game-state').getAttribute('data-selected-response'),'1');
    assert.equal(await page.locator('#game-state').getAttribute('data-round'),'0');
    assert.equal(await panel.getAttribute('data-guide-completed'),'false');
    // ONLY NOW perform the real 3-lane local simulation.
    await action('Enter',page.locator('#gambit-mobile-lock'));
    await page.locator('#game-state[data-phase="resolving"]').waitFor({timeout:8000});
    assert.equal(await panel.getAttribute('data-guide-step'),'settled');
    assert.equal(await panel.getAttribute('data-guide-completed'),'false',
      'a committed but unresolved turn is not completed training');
    await page.locator('#game-state[data-phase="ready"]').waitFor({timeout:30000});
    assert.equal(await panel.getAttribute('data-guide-step'),'complete');
    assert.equal(await panel.getAttribute('data-guide-completed'),'true');
    assert.match(await page.locator('#gambit-training-result').textContent(),
      /Real round 1 · reactor score \d+ : \d+ · 3 resolved lanes/);
    const scoreA=await page.locator('#game-state').getAttribute('data-score-a');
    const scoreB=await page.locator('#game-state').getAttribute('data-score-b');
    assert.ok(Number.isSafeInteger(Number(scoreA))&&Number.isSafeInteger(Number(scoreB)));
    assert.match(await page.locator('#gambit-training-result').textContent(),
      new RegExp('reactor score '+scoreA+' : '+scoreB));
    assert.equal(await page.locator('#game-state').getAttribute('data-round'),'1');
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),initialSeed);
    await page.locator('#gambit-training-close').click();
    assert.equal(await panel.isVisible(),false);
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'ready');
    assert.equal(await page.locator('#game-state').getAttribute('data-round'),'1');
    assert.deepEqual(exceptions,[]);
    console.log('GAMBIT_TRAINING_COACH_BROWSER '+JSON.stringify({
      viewport:label,stages:9,realRole:'STRIKER',
      realConditionalOrder:'FLANK-if-STRIKE-then-GUARD',
      realFormation:'FEINT',actualRound:1,
      publicLocalScore:scoreA+' : '+scoreB,
      skippedSteps:false,scriptedWin:false,walletActions:0,
      arenaPreserved:true,errors:0
    }));
  }finally{await context.close()}
}
try{
  await scenario({width:1280,height:850},'desktop');
  await scenario({width:390,height:844},'mobile');
}finally{await browser.close()}
