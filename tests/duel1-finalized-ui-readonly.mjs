/**
 * Real browser recovery of a finalized GAMBIT duel without any wallet.
 * User's previous screen incorrectly claimed the onchain result differed
 * from the signed KMS proof, even though the canonical event and score match.
 *
 * Only fetches public chain state; never requests/sends/signs a transaction.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__gambitWalletRequests=[];
    // The test has NO injected wallet. An unrequested wallet API must never
    // become a prerequisite for the authenticated public scoreboard.
  });
  await page.goto('http://127.0.0.1:4177/?squad=1&duel=1',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  await page.locator('#gambit-squad-launch').waitFor({state:'visible',timeout:30000});
  await page.locator('#gambit-squad-launch').click();
  assert.equal(await page.locator('#gambit-duel-id').inputValue(),'1');
  const recover=page.locator('#gambit-squad-public-inspect');
  assert.equal(await recover.isVisible(),true);
  assert.match(await recover.textContent(),/Recover verified match result/);
  assert.equal(await page.locator('#gambit-squad-confirmed-score').isHidden(),true);
  await recover.click();
  await page.locator('#gambit-squad-confirmed-scoreline')
    .filter({hasText:'CYAN 0 : 1 VIOLET · VIOLET WINS'})
    .waitFor({timeout:50000});
  assert.equal(await page.locator('#gambit-squad-confirmed-score').isVisible(),true);
  assert.match(await page.locator('#gambit-squad-title').textContent(),/Duel #1 · Finalized/);
  assert.equal(await page.locator('#gambit-squad-workflow').isHidden(),true,
    'a finalized duel must not invite another signing or setup action');
  assert.equal(await page.locator('#gambit-squad-verified-actions').isVisible(),true,
    'show the spectator result and public evidence instead of obsolete controls');
  assert.equal(await page.locator('#gambit-squad-public-inspect').isHidden(),true,
    'the recovery action is no longer needed after canonical verification');
  assert.equal(await page.locator('#gambit-squad-watch').isVisible(),true);
  assert.equal(await page.locator('#gambit-squad-watch').isEnabled(),true);
  assert.equal(await page.locator('#gambit-squad-share-result').isEnabled(),true);
  await page.locator('#gambit-squad-share-result').click();
  await page.locator('#gambit-squad-share-feedback').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#gambit-squad-share-feedback').textContent(),
    /Verified score link copied|Copy Verified score link manually/,
    'result link confirmation must remain visible after obsolete workflow is hidden');
  assert.equal(await page.locator('#gambit-squad-wallet-choice').inputValue(),'');
  await page.locator('#gambit-squad-watch').click();
  await page.locator('#game-state[data-phase="chain-verified-squad"]')
    .waitFor({timeout:15000});
  assert.deepEqual(errors,[],'public verification must not crash the browser');
  console.log('GAMBIT_DUEL1_BROWSER_FINAL_RESULT_READONLY '+JSON.stringify({
    duelId:1,score:'0:1',winner:'VIOLET',
    canonicalPublicResult:true,verifiedReactorVisible:true,
    walletConnected:false,signatureMade:false,transactionSent:false
  }));
  await page.close();
}finally{await browser.close();}
