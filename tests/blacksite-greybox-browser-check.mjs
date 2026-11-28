import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ROOT='http://127.0.0.1:4173';

async function runScenario(label,viewport){
  const context=await browser.newContext({
    viewport,hasTouch:viewport.width<700,isMobile:viewport.width<700
  });
  try{
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    assert.equal(response.status(),200,label+' game must load');
    await page.locator('#game-state[data-phase="intro"]').waitFor({
      timeout:20000
    });
    // Both launchers exist, but only the in-flow touch control is clickable
    // on mobile. Never force-click through a wallet-control overlay.
    const launch=page.locator(viewport.width<700
      ?'#gambit-blacksite-mobile-open':'#gambit-blacksite-open');
    await launch.waitFor({state:'visible'});
    assert.match(await launch.textContent(),/BLACKSITE.*LOCAL/);
    const initialPracticeSeed=await page.locator('#game-state')
      .getAttribute('data-practice-seed');
    await launch.click();
    const overlay=page.locator('#gambit-blacksite-overlay');
    assert.equal(await overlay.isVisible(),true);
    assert.equal(await launch.getAttribute('aria-expanded'),'true');
    assert.equal(await overlay.getAttribute('data-phase'),'briefing');
    assert.equal(await overlay.getAttribute('data-scene'),'blacksite-training');
    if(viewport.width<700){
      assert.equal(await page.locator('#gambit-blacksite-open').isVisible(),false,
        'fixed desktop BLACKSITE launcher must not collide with mobile wallet controls');
      assert.equal(await page.locator('#gambit-chain-launch').isVisible(),true,
        'legacy Sepolia access must remain available while Arena is active');
    }
    assert.match(await overlay.textContent(),/NOT ENCRYPTED/);
    assert.match(await overlay.textContent(),/NO WALLET/);
    // Confidential BLACKSITE is a separate opt-in research panel, not local
    // guesses or wallet signing. Inspect an already authorized fixture wallet.
    await page.evaluate(()=>{
      const listeners=new Map(),calls=[];
      let account='0x'+'1'.repeat(40);
      const wallet={async request({method}){calls.push(method);if(method==='eth_chainId')return '0xaa36a7';if(method==='eth_accounts')return [account];throw Error('unexpected wallet action '+method);},
        on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
        removeListener(event,fn){listeners.get(event)?.delete(fn);}};
      Object.defineProperty(window,'ethereum',{value:wallet,configurable:true});
      window.__blacksiteConfidentialFixture={calls,changeAccount(){account='0x'+'2'.repeat(40);for(const fn of listeners.get('accountsChanged')??[])fn([account]);}};
    });
    const confidential=page.locator('#gambit-blacksite-confidential');
    await confidential.locator(':scope > summary').click();
    await confidential.locator('[data-action="find"]').click();
    await confidential.locator('[data-field="wallet"]').selectOption({index:1});
    await confidential.locator('[data-action="inspect"]').click();
    await confidential.getByText(/Sepolia account: 0x1111111111111111111111111111111111111111/).waitFor();
    assert.equal(await confidential.locator('[data-field="action"]').inputValue(),'OPEN_MISSION');
    assert.equal(await confidential.locator('[data-action="send"]').isDisabled(),true);
    await confidential.locator('[data-field="record"]').fill('1');
    assert.equal(await confidential.locator('[data-action="prepare"]').isDisabled(),true);
    await page.evaluate(()=>window.__blacksiteConfidentialFixture.changeAccount());
    assert.equal(await confidential.locator('[data-action="prepare"]').isDisabled(),true);
    assert.ok((await page.evaluate(()=>window.__blacksiteConfidentialFixture.calls)).every(m=>m==='eth_chainId'||m==='eth_accounts'));
    await confidential.locator(':scope > summary').click();
    console.log('GAMBIT_NEUTRAL_BLACKSITE_PREPARATION_BROWSER '+JSON.stringify({viewport:label,accountInspection:true,unreadMissionBlocked:true,accountChangeInvalidated:true,signatures:0,writes:0}));
    // The advanced rehearsal uses the actual neutral four-attempt rules.
    // Four PROBE submissions always lock, even if a guess happens to be exact.
    const rehearsal=page.locator('#gambit-neutral-practice');
    await rehearsal.locator('summary').click();
    await rehearsal.locator('[data-np-action="start"]').click();
    assert.equal(await rehearsal.locator('[data-field="glyphs"] select').count(),5);
    for(let i=1;i<=4;i++){
      await rehearsal.locator('[data-np-action="attempt"]').click();
      assert.equal(await rehearsal.locator('[data-field="history"] li').count(),i);
      assert.equal(await rehearsal.locator('[data-field="heat"]').textContent(),'Heat '+i);
      assert.equal(await rehearsal.locator('[data-field="remaining"]').textContent(),(4-i)+' attempts left');
    }
    assert.match(await rehearsal.locator('[data-field="message"]').textContent(),/Vault locked/);
    assert.equal(await rehearsal.locator('[data-field="planner"]').isVisible(),false);
    assert.equal(await rehearsal.locator('[data-field="score"]').textContent(),'Score 0');
    await rehearsal.locator('[data-np-action="start"]').click();
    assert.equal(await rehearsal.locator('[data-field="history"] li').count(),0);
    assert.equal(await rehearsal.locator('[data-field="heat"]').textContent(),'Heat 0');
    await rehearsal.locator('summary').click();
    assert.equal(await overlay.getAttribute('data-phase'),'briefing','rehearsal must not change introductory mission');
    console.log('GAMBIT_NEUTRAL_REHEARSAL_BROWSER '+JSON.stringify({viewport:label,attempts:4,heat:4,locked:true,restart:true,introPreserved:true,walletCalls:0}));
    await page.locator('#gambit-blacksite-begin').click();
    assert.equal(await overlay.getAttribute('data-phase'),'active');
    assert.equal(await overlay.getAttribute('data-remaining'),'5');
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro',
      'mission input must not launch or advance underlying Phaser practice');

    async function guess(values){
      for(let i=0;i<4;i++){
        await page.locator('#gambit-blacksite-glyph-'+i)
          .selectOption(String(values[i]));
      }
      await page.locator('#gambit-blacksite-submit').click();
      return overlay.getAttribute('data-phase');
    }
    let current=await guess([0,0,0,0]);
    assert.ok(['active','breached'].includes(current));
    assert.equal(await overlay.getAttribute('data-round'),'1');
    assert.equal(await page.locator('#gambit-blacksite-history li').count(),1);
    const firstHistory=await page.locator('#gambit-blacksite-history').textContent();
    assert.match(firstHistory,/0 0 0 0/);
    assert.match(firstHistory,/EXACT/);
    assert.match(firstHistory,/MISPLACED/);
    if(current==='active'){
      await guess([0,0,0,0]);
      assert.equal(await overlay.getAttribute('data-round'),'1',
        'duplicate attempt must not consume an extra turn');
      assert.match(await page.locator('#gambit-blacksite-message').textContent(),
        /Repeated guesses/);
    }
    await page.locator('#gambit-blacksite-back').click();
    assert.equal(await overlay.isVisible(),false);
    assert.equal(await overlay.getAttribute('data-scene'),'home');
    assert.equal(await launch.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),
      initialPracticeSeed,'leave/reopen must not reset Arena');
    await launch.click();
    assert.equal(await overlay.getAttribute('data-round'),'1',
      'local mission must survive closing without refresh');
    assert.equal(await overlay.getAttribute('data-scene'),'blacksite-training');
    assert.equal(await page.locator('#gambit-blacksite-history li').count(),1);
    // The first guess has a 1/256 probability of immediate victory.
    // Both authentic winning and losing flows are valid and must be tested
    // without depending on hidden random server/browser test data.
    const alternatives=[[0,0,0,1],[0,0,1,0],[0,1,0,0],[1,0,0,0]];
    for(const values of alternatives){
      current=await overlay.getAttribute('data-phase');
      if(current!=='active')break;
      current=await guess(values);
    }
    const terminal=await overlay.getAttribute('data-phase');
    assert.ok(['breached','locked'].includes(terminal),
      'real submitted attempts must reach a terminal result');
    const rounds=Number(await overlay.getAttribute('data-round'));
    assert.ok(rounds>=1&&rounds<=5);
    assert.equal(await page.locator('#gambit-blacksite-history li').count(),rounds);
    assert.equal(await page.locator('#gambit-blacksite-active').isVisible(),false,
      'terminal mission must not leave a new submission active');
    await page.locator('#gambit-blacksite-debrief-button').click();
    assert.equal(await overlay.getAttribute('data-phase'),'debrief');
    assert.equal(await page.locator('#gambit-blacksite-review').isVisible(),true);
    await page.locator('#gambit-blacksite-retry').click();
    assert.equal(await overlay.getAttribute('data-phase'),'briefing');
    assert.equal(await overlay.getAttribute('data-round'),'0');
    assert.equal(await overlay.getAttribute('data-remaining'),'5');
    assert.equal(await page.locator('#gambit-blacksite-history li').count(),0);
    assert.equal(await page.locator('#gambit-blacksite-empty').isVisible(),true);
    await page.locator('#gambit-blacksite-back').click();
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),
      initialPracticeSeed);
    assert.deepEqual(errors,[],label+' browser must not have uncaught exceptions');
    console.log('GAMBIT_BLACKSITE_GREYBOX_BROWSER '+JSON.stringify({
      viewport:label,start:'briefing',mission:'actual local guesses',
      finalState:terminal,attempts:rounds,duplicateRejected:true,
      resumeOnReopen:true,retryResets:true,arenaStatePreserved:true,
      phantomOnchainClaims:false,walletActions:0,errors:0
    }));
  }finally{
    await context.close();
  }
}
try{
  await runScenario('desktop',{width:1280,height:850});
  await runScenario('mobile',{width:390,height:844});
}finally{await browser.close()}
