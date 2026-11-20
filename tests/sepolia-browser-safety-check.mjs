import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Purely negative-path browser QA. No keys, no funded wallets, no tx signing.
const BASE='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function openPanel(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:35000});
  await page.locator('#gambit-chain-launch').waitFor({state:'visible',timeout:25000});
  assert.equal(await page.locator('#gambit-chain-dialog').isVisible(),false,'real chain controls begin closed');
  await page.locator('#gambit-chain-launch').click();
  assert.equal(await page.locator('#gambit-chain-dialog').isVisible(),true,'dialog opens on demand');
}
try {
  const desktop=await browser.newPage({viewport:{width:1280,height:800}});
  const desktopErrors=[];
  desktop.on('pageerror',e=>desktopErrors.push(e.message));
  await openPanel(desktop);
  await desktop.locator('#gambit-chain-connect').click();
  await desktop.locator('#gambit-chain-status').filter({hasText:/Install or enable an Ethereum wallet/}).waitFor({timeout:12000});
  await desktop.locator('#gambit-policy-id').fill('1');
  await desktop.locator('#gambit-chain-challenge').click();
  await desktop.locator('#gambit-chain-status').filter({hasText:/Connect a Sepolia wallet first/}).waitFor({timeout:5000});
  assert.equal(await desktop.locator('#gambit-chain-watch').isDisabled(),true,'never show verified duel without proof');
  assert.deepEqual(desktopErrors,[],'missing-wallet negative path must not cause unhandled errors');
  await desktop.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobileErrors=[];
  mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mobile.addInitScript(()=>{
    window.__gambitTestSent=false;
    window.ethereum={
      request:async({method})=>{
        if(method==='eth_requestAccounts'||method==='eth_accounts')return ['0x1000000000000000000000000000000000000001'];
        if(method==='eth_chainId')return '0x1';
        if(method==='net_version')return '1';
        if(method==='eth_sendTransaction'){
          window.__gambitTestSent=true;
          throw Error('Wrong-chain transaction attempted');
        }
        throw Error('Unsupported test wallet method: '+method);
      }
    };
  });
  await openPanel(mobile);
  await mobile.locator('#gambit-chain-connect').click();
  await mobile.locator('#gambit-chain-status').filter({hasText:/requires Ethereum Sepolia/}).waitFor({timeout:12000});
  assert.equal(await mobile.evaluate(()=>window.__gambitTestSent),false,'wrong-chain wallet cannot transmit transactions');
  assert.equal(await mobile.locator('#gambit-chain-watch').isDisabled(),true);
  assert.deepEqual(mobileErrors,[],'wrong-chain negative path must not cause unhandled errors');
  await mobile.close();
  console.log('PASS Sepolia browser safety: no-wallet and wrong-chain blocked; no fabricated onchain results');
} finally { await browser.close(); }
