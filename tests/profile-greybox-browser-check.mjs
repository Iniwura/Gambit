import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ROOT='http://127.0.0.1:4173';
async function verify(viewport,label){
  const context=await browser.newContext({
    viewport,hasTouch:viewport.width<700,isMobile:viewport.width<700
  });
  try{
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const result=await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    assert.equal(result.status(),200);
    await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
    const launcher=page.locator(viewport.width<700
      ?'#gambit-profile-mobile-open':'#gambit-profile-open');
    assert.equal(await launcher.isVisible(),true,'profile must have a real entry');
    const arenaSeed=await page.locator('#game-state').getAttribute('data-practice-seed');
    await launcher.click();
    const overlay=page.locator('#gambit-profile-overlay');
    assert.equal(await overlay.isVisible(),true);
    assert.equal(await overlay.getAttribute('data-scene'),'profile-readonly');
    assert.equal(await overlay.getAttribute('data-phase'),'ready');
    assert.equal(await page.locator('#gambit-profile-results').isVisible(),false,
      'must not show fabricated wins before lookup');
    assert.match(await overlay.textContent(),/NO WALLET OR SIGNING/);
    const input=page.locator('#gambit-profile-address');
    assert.equal(await input.isFocused(),true,'open dialog focuses opt-in input');
    const submit=page.locator('#gambit-profile-submit');
    await input.fill('not-a-wallet');
    await submit.click();
    assert.equal(await overlay.getAttribute('data-phase'),'invalid');
    assert.match(await page.locator('#gambit-profile-status').textContent(),
      /valid 0x Ethereum wallet/);
    assert.equal(await page.locator('#gambit-profile-results').isVisible(),false);
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),arenaSeed);
    // The modal must not permit stacking another game mode or wallet dialog.
    assert.equal(await page.evaluate(()=>
      document.body.dataset.gambitFeatureOverlay),'profile');
    await page.locator('#gambit-profile-close').click();
    assert.equal(await overlay.isVisible(),false);
    assert.equal(await overlay.getAttribute('data-scene'),'home');
    assert.equal(await page.evaluate(()=>
      document.body.dataset.gambitFeatureOverlay),undefined);
    assert.equal(await input.inputValue(),'','no wallet address retained on close');
    assert.equal(await launcher.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    await launcher.click();
    assert.equal(await overlay.isVisible(),true);
    assert.equal(await overlay.getAttribute('data-phase'),'ready');
    await page.keyboard.press('Escape');
    assert.equal(await overlay.isVisible(),false);
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),
      arenaSeed,'closing profile must preserve unfinished practice state');
    assert.deepEqual(errors,[],'no uncaught page errors');
    console.log('GAMBIT_PROFILE_GREYBOX_BROWSER '+JSON.stringify({
      viewport:label,entry:'real touch/desktop button',
      optInRequired:true,invalidAddressRejected:true,
      noFakeWins:true,closeClearsAddress:true,escapeCloses:true,
      gameShellRestored:true,arenaStatePreserved:true,
      walletConnections:0,transactions:0,errors:0,
      realPositiveVerification:'separate no-wallet Sepolia CLI workflow'
    }));
  }finally{await context.close()}
}
try{
  await verify({width:1280,height:850},'desktop');
  await verify({width:390,height:844},'mobile');
}finally{await browser.close()}
