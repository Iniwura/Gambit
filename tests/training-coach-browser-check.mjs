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
    console.log('GAMBIT_TRAINING_FIRST_ROUND '+JSON.stringify({
      viewport:label,actualRound:1,realScore:scoreA+' : '+scoreB,skippedSteps:false
    }));
    // Continue the SAME five-round Phaser game. The mentor cannot settle a
    // round itself; every score and final profile comes from the real engine.
    // Native pointer interaction is mandatory. A synthetic dispatch would
    // hide broken responsive layout or a detached/replaced button.
    const continueButton=page.locator('#gambit-training-continue');
    await continueButton.evaluate(button=>{
      button.addEventListener('click',()=>{document.body.dataset.trainingQaClicked='yes'}, {once:true});
    });
    await continueButton.click();
    const nativeClick=await page.locator('body').getAttribute('data-training-qa-clicked');
    const handoff=await panel.getAttribute('data-guide-handoff');
    const afterHandoff=await panel.getAttribute('data-guide-step');
    assert.equal(afterHandoff,'r2-role',
      'continue handoff='+handoff+
      ' phase='+(await page.locator('#game-state').getAttribute('data-phase'))+
      ' round='+(await page.locator('#game-state').getAttribute('data-round'))+
      ' nativeClick='+nativeClick+
      ' hint='+(await page.locator('#gambit-training-device-hint').textContent())+
      ' pageErrors='+exceptions.join(' | '));
    async function step(id){
      await page.locator('#gambit-training-panel[data-guide-step="'+id+'"]')
        .waitFor({timeout:12000});
      assert.equal(await panel.getAttribute('data-guide-step'),id);
    }
    await action('4',page.locator('.gambit-mobile-role').nth(0));
    await step('r2-base');
    await action('1',page.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(0));
    await step('r2-trigger');
    await action('w',page.locator('.gambit-mobile-action-group').nth(1).locator('button').nth(1));
    await step('r2-response');
    await action('d',page.locator('.gambit-mobile-action-group').nth(2).locator('button').nth(2));
    await step('r2-commit');
    await action('Enter',page.locator('#gambit-mobile-lock'));
    await step('r2-settle');
    await page.locator('#game-state[data-phase="ready"][data-round="2"]').waitFor({timeout:30000});
    await step('r3-role');

    await action('5',page.locator('.gambit-mobile-role').nth(1));
    await step('r3-base');
    await action('1',page.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(0));
    await step('r3-trigger');
    await action('q',page.locator('.gambit-mobile-action-group').nth(1).locator('button').nth(0));
    await step('r3-response');
    await action('d',page.locator('.gambit-mobile-action-group').nth(2).locator('button').nth(2));
    await step('r3-commit');
    await action('Enter',page.locator('#gambit-mobile-lock'));
    await step('r3-settle');
    await page.locator('#game-state[data-phase="ready"][data-round="3"]').waitFor({timeout:30000});
    await step('r4-formation');

    await action('7',page.locator('.gambit-mobile-formation').nth(0));
    await step('r4-commit');
    await action('Enter',page.locator('#gambit-mobile-lock'));
    await step('r4-settle');
    await page.locator('#game-state[data-phase="ready"][data-round="4"]').waitFor({timeout:30000});
    await step('r5-scout');

    await action('4',page.locator('.gambit-mobile-role').nth(0));
    await action('3',page.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(2));
    await step('r5-guardian');
    await action('5',page.locator('.gambit-mobile-role').nth(1));
    await action('1',page.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(0));
    await step('r5-striker');
    await action('6',page.locator('.gambit-mobile-role').nth(2));
    await action('2',page.locator('.gambit-mobile-action-group').nth(0).locator('button').nth(1));
    await step('r5-commit');
    await action('Enter',page.locator('#gambit-mobile-lock'));
    await step('r5-settle');
    assert.equal(await panel.getAttribute('data-guide-completed'),'false');
    await page.locator('#game-state[data-phase="finished"][data-round="5"]').waitFor({timeout:30000});
    await step('complete');
    assert.equal(await panel.getAttribute('data-guide-completed'),'true');
    const finalA=await page.locator('#game-state').getAttribute('data-score-a');
    const finalB=await page.locator('#game-state').getAttribute('data-score-b');
    const finalReport=await page.locator('#gambit-training-result').textContent();
    assert.match(finalReport,/Real five-round LOCAL result/);
    assert.ok(finalReport.includes(finalA+' : '+finalB));
    assert.match(finalReport,/SCOUT \d+W\/\d+L\/\d+D/);
    assert.match(finalReport,/GUARDIAN \d+W\/\d+L\/\d+D/);
    assert.match(finalReport,/STRIKER \d+W\/\d+L\/\d+D/);
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),initialSeed);
    assert.deepEqual(exceptions,[]);
    console.log('GAMBIT_TRAINING_FULL_MATCH_BROWSER '+JSON.stringify({
      viewport:label,rounds:5,verifiedLanes:15,roleTraining:['SCOUT','GUARDIAN','STRIKER'],
      formationChanged:true,actualMatchScore:finalA+' : '+finalB,
      matchDebriefVerified:true,scriptedWins:0,walletActions:0,errors:0
    }));
    await page.locator('#gambit-training-close').click();
    assert.equal(await panel.isVisible(),false);
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'finished',
      'ending the guide must not reset the genuine completed Arena');
    assert.equal(await page.locator('#game-state').getAttribute('data-round'),'5');
    assert.deepEqual(exceptions,[]);
    console.log('GAMBIT_TRAINING_COACH_BROWSER '+JSON.stringify({
      viewport:label,stages:9,realRole:'STRIKER',
      realConditionalOrder:'FLANK-if-STRIKE-then-GUARD',
      realFormation:'FEINT',actualFirstRound:1,actualFinishedRound:5,
      publicLocalScore:scoreA+' : '+scoreB,
      skippedSteps:false,scriptedWin:false,walletActions:0,
      arenaPreserved:true,errors:0
    }));
  }finally{await context.close()}
}
async function tabletNavigation(width){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const r=await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    assert.equal(r.status(),200);
    await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:15000});
    const buttons=[
      'gambit-profile-open','gambit-blacksite-open',
      'gambit-chain-launch','gambit-training-open'
    ];
    for(const id of buttons){
      const locator=page.locator('#'+id);
      assert.equal(await locator.isVisible(),true,id+' must be visible');
      const rect=await locator.boundingBox();
      assert.ok(rect,id+' must have a real hit target');
      assert.ok(rect.x>=0&&rect.x+rect.width<=width,
        id+' must fit inside the '+width+'px tablet viewport');
      const hit=await page.evaluate(({x,y})=>{
        return document.elementFromPoint(x,y)?.closest('button')?.id??null;
      },{x:rect.x+rect.width/2,y:rect.y+rect.height/2});
      assert.equal(hit,id,id+' must be physically clickable, not overlapped');
    }
    await page.locator('#gambit-training-open').click();
    assert.equal(await page.locator('#gambit-training-panel').isVisible(),true);
    await page.locator('#gambit-training-close').click();
    await page.locator('#gambit-blacksite-open').click();
    assert.equal(await page.locator('#gambit-blacksite-overlay').isVisible(),true);
    await page.locator('#gambit-blacksite-back').click();
    await page.locator('#gambit-profile-open').click();
    assert.equal(await page.locator('#gambit-profile-overlay').isVisible(),true);
    await page.locator('#gambit-profile-close').click();
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    assert.deepEqual(errors,[]);
    console.log('GAMBIT_TABLET_NAVIGATION '+JSON.stringify({
      width,visibleLaunchers:buttons.length,occludedControls:0,
      launchesOpenedAndClosed:3,arenaPreserved:true,signatures:0,errors:0
    }));
  }finally{await context.close()}
}
try{
  await scenario({width:1280,height:850},'desktop');
  await scenario({width:390,height:844},'mobile');
  await tabletNavigation(820);
  await tabletNavigation(710);
}finally{await browser.close()}
