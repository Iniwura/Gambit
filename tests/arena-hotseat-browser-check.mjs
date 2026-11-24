import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const ROOT='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function play(viewport,name){
  const context=await browser.newContext({
    viewport,hasTouch:viewport.width<700,isMobile:viewport.width<700
  });
  try{
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const response=await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    assert.equal(response.status(),200);
    await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
    const arenaSeed=await page.locator('#game-state').getAttribute('data-practice-seed');
    const launcher=page.locator(viewport.width<700?
      '#gambit-arena-hotseat-mobile-open':'#gambit-arena-hotseat-open');
    assert.equal(await launcher.isVisible(),true,'real reachable local hotseat launcher');
    await launcher.click();
    const overlay=page.locator('#gambit-arena-hotseat-overlay');
    assert.equal(await overlay.isVisible(),true);
    assert.equal(await overlay.getAttribute('data-phase'),'briefing');
    assert.equal(await launcher.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('body').getAttribute('data-gambit-feature-overlay'),
      'arena-hotseat-local');
    assert.match(await page.locator('#gambit-arena-hotseat-dialog').textContent(),
      /CLEAR TEXT IN MEMORY.*NO WALLET.*NOT ONLINE PVP/s);
    assert.match(await page.locator('#gambit-arena-hotseat-boundary').textContent(),
      /NOT encrypted/);
    assert.equal(await page.locator('#gambit-arena-hotseat-history li').count(),0);
    // A selected, previously authorized fixture wallet can be inspected,
    // but no approved v3 deployment exists. The browser must not sign,
    // request accounts, call the relayer, or unlock invitation recovery.
    await page.evaluate(()=>{
      const listeners=new Map(),calls=[];
      let chain='0xaa36a7',account='0x'+'1'.repeat(40);
      const wallet={
        async request({method}){
          calls.push(method);
          if(method==='eth_chainId')return chain;
          if(method==='eth_accounts')return [account];
          throw Error('Unexpected wallet method: '+method);
        },
        on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
        removeListener(event,fn){listeners.get(event)?.delete(fn);}
      };
      Object.defineProperty(window,'ethereum',{value:wallet,configurable:true});
      window.__arenaLobbyFixture={calls,changeAccount(){
        account='0x'+'2'.repeat(40);
        for(const fn of listeners.get('accountsChanged')??[])fn([account]);
      },changeChain(){chain='0x1';for(const fn of listeners.get('chainChanged')??[])fn(chain);}};
    });
    const lobby=page.locator('#gambit-arena-online-lobby');
    await lobby.locator('summary').click();
    await page.locator('#gambit-arena-online-wallet option').nth(1).waitFor();
    await page.locator('#gambit-arena-online-wallet').selectOption({index:1});
    await page.locator('#gambit-arena-online-inspect').click();
    await page.getByText('Sepolia account: 0x'+'1'.repeat(40)+' · No approved v3 deployment. Live actions locked.',{exact:true}).waitFor();
    assert.equal(await page.locator('#gambit-arena-online-recover').isDisabled(),true);
    await page.evaluate(()=>window.__arenaLobbyFixture.changeAccount());
    assert.match(await page.locator('#gambit-arena-online-status').textContent(),/changed/);
    await page.locator('#gambit-arena-online-inspect').click();
    await page.getByText('Sepolia account: 0x'+'2'.repeat(40)+' · No approved v3 deployment. Live actions locked.',{exact:true}).waitFor();
    await page.evaluate(()=>window.__arenaLobbyFixture.changeChain());
    await page.locator('#gambit-arena-online-inspect').click();
    await page.getByText('No authorized Sepolia account.',{exact:false}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__arenaLobbyFixture.calls),
      ['eth_chainId','eth_accounts','eth_chainId','eth_accounts','eth_chainId']);
    await lobby.locator('summary').click();
    assert.equal(await lobby.getAttribute('open'),null);
    console.log('GAMBIT_ARENA_V3_LOBBY_BROWSER '+JSON.stringify({
      viewport:name,selectedWalletRead:true,accountChangeInvalidated:true,
      wrongChainRejected:true,inviteDisabledWithoutPin:true,accountPrompts:0,signatures:0,writes:0
    }));
    await page.locator('#gambit-arena-hotseat-start').click();

    let lastA=0,lastB=0;
    for(let round=1;round<=5;round++){
      const get=()=>overlay.getAttribute('data-phase');
      assert.equal(await get(),'planning','challenger must plan round '+round);
      assert.equal(await overlay.getAttribute('data-round'),String(round));
      assert.match(await page.locator('#gambit-arena-hotseat-player-heading').textContent(),
        /CHALLENGER/);
      await page.locator('#gambit-arena-hotseat-formation').selectOption(String(round%3));
      await page.locator('#gambit-arena-hotseat-r0-base').selectOption(String(round%3));
      await page.locator('#gambit-arena-hotseat-r1-trigger').selectOption(String((round+1)%3));
      if(round===1)await page.locator('#gambit-arena-hotseat-stake').selectOption('0');
      else assert.equal(await page.locator('#gambit-arena-hotseat-stake').isDisabled(),
        true,'one-use challenger GAMBIT must be spent');
      await page.locator('#gambit-arena-hotseat-submit').click();
      assert.equal(await get(),'handoff');
      assert.equal(await page.locator('#gambit-arena-hotseat-form select[data-role]').count(),0,
        'private plan controls must be destroyed before handing device over');
      assert.equal(await page.locator('#gambit-arena-hotseat-history li').count(),round-1,
        'no round can score from a single player submission');
      assert.equal(Number(await page.locator('#gambit-arena-hotseat-score-a').textContent()),lastA);
      if(round===1){
        // Closing/reopening within tab must preserve the submitted sealed
        // order but never display its previous cleartext planner controls.
        await page.locator('#gambit-arena-hotseat-close').click();
        assert.equal(await overlay.isVisible(),false);
        assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),
          arenaSeed);
        assert.equal(await page.locator('body').getAttribute('data-gambit-feature-overlay'),null);
        await launcher.click();
        assert.equal(await get(),'handoff');
        assert.equal(await page.locator('#gambit-arena-hotseat-form select[data-role]').count(),0);
      }
      await page.locator('#gambit-arena-hotseat-accept').click();
      assert.equal(await get(),'planning');
      assert.match(await page.locator('#gambit-arena-hotseat-player-heading').textContent(),
        /DEFENDER/);
      // Second person chooses a different independently accepted order.
      await page.locator('#gambit-arena-hotseat-formation')
        .selectOption(String((round+1)%3));
      await page.locator('#gambit-arena-hotseat-r2-base')
        .selectOption(String((round+2)%3));
      await page.locator('#gambit-arena-hotseat-r0-response')
        .selectOption(String((round+1)%3));
      if(round===2)await page.locator('#gambit-arena-hotseat-stake').selectOption('1');
      if(round>=3)assert.equal(await page.locator('#gambit-arena-hotseat-stake').isDisabled(),
        true,'defender GAMBIT is also once-per-match');
      await page.locator('#gambit-arena-hotseat-submit').click();
      assert.equal(await get(),'ready-to-resolve');
      assert.equal(await page.locator('#gambit-arena-hotseat-form select[data-role]').count(),0);
      assert.equal(await page.locator('#gambit-arena-hotseat-history li').count(),round-1);
      await page.locator('#gambit-arena-hotseat-resolve').click();
      assert.equal(await get(),round===5?'complete':'review');
      assert.equal(await page.locator('#gambit-arena-hotseat-history li').count(),round);
      const cumulativeA=Number(await page.locator('#gambit-arena-hotseat-score-a').textContent());
      const cumulativeB=Number(await page.locator('#gambit-arena-hotseat-score-b').textContent());
      assert.ok(cumulativeA>=lastA && cumulativeA<=lastA+7);
      assert.ok(cumulativeB>=lastB && cumulativeB<=lastB+7);
      assert.match(await page.locator('#gambit-arena-hotseat-history li').last().textContent(),
        new RegExp('ROUND '+round+' .*Match '+cumulativeA+' : '+cumulativeB));
      lastA=cumulativeA;lastB=cumulativeB;
      if(round<5)await page.locator('#gambit-arena-hotseat-next').click();
    }

    assert.match(await page.locator('#gambit-arena-hotseat-final').textContent(),
      new RegExp('LOCAL (DRAW|CHALLENGER WON|DEFENDER WON).*'+lastA+' : '+lastB));
    const fullText=await page.locator('#gambit-arena-hotseat-complete').textContent();
    assert.match(fullText,/No local result is ranked/);
    assert.equal(await page.locator('#game-state').getAttribute('data-phase'),'intro');
    assert.equal(await page.locator('#game-state').getAttribute('data-practice-seed'),arenaSeed,
      'hotseat must not advance or reset the separate Phaser Academy game');

    await page.keyboard.press('Escape');
    assert.equal(await overlay.isVisible(),false);
    await launcher.click();
    assert.equal(await overlay.getAttribute('data-phase'),'complete',
      'close/reopen preserves the actual completed local match in this tab');
    await page.locator('#gambit-arena-hotseat-rematch').click();
    assert.equal(await overlay.getAttribute('data-phase'),'briefing');
    assert.equal(await page.locator('#gambit-arena-hotseat-history li').count(),0);
    assert.equal(await page.locator('#gambit-arena-hotseat-score-a').textContent(),'0');
    assert.equal(await page.locator('#gambit-arena-hotseat-score-b').textContent(),'0');
    await page.locator('#gambit-arena-hotseat-close').click();
    assert.deepEqual(errors,[],'no uncaught errors in hotseat browser');
    console.log('GAMBIT_ARENA_HOTSEAT_BROWSER '+JSON.stringify({
      viewport:name,rounds:5,realLocalRounds:5,
      twoSeparateSubmittedOrdersEachRound:true,
      challengerGambitOnce:true,defenderGambitOnce:true,
      handoffClearsPrivateDom:true,closeReopenResume:true,
      finalScore:lastA+' : '+lastB,scriptedWins:0,
      walletTransactions:0,fheClaims:0,
      arenaSeedUnchanged:true,errors:0
    }));
  }finally{await context.close();}
}
async function tablet(width){
  const context=await browser.newContext({viewport:{width,height:850}});
  try{
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
    await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
    const launcher=page.locator('#gambit-arena-hotseat-open');
    assert.equal(await launcher.isVisible(),true);
    const box=await launcher.boundingBox();
    assert.ok(box&&box.x>=0&&box.x+box.width<=width,'hotseat launcher fits viewport');
    const hit=await page.evaluate(({x,y})=>
      document.elementFromPoint(x,y)?.closest('button')?.id??null,
      {x:box.x+box.width/2,y:box.y+box.height/2});
    assert.equal(hit,'gambit-arena-hotseat-open','hotseat launcher must not be occluded');
    await launcher.click();
    assert.equal(await page.locator('#gambit-arena-hotseat-overlay').isVisible(),true);
    await page.locator('#gambit-arena-hotseat-close').click();
    assert.deepEqual(errors,[]);
    console.log('GAMBIT_ARENA_HOTSEAT_TABLET '+JSON.stringify({
      width,hitTargetClear:true,openedAndClosed:true,pageErrors:0
    }));
  }finally{await context.close();}
}
try{
  await play({width:1280,height:850},'desktop');
  await play({width:390,height:844},'mobile');
  await tablet(820);
  await tablet(710);
}finally{await browser.close();}
