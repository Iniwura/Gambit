import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Strictly negative-path QA with either synthetic or real verified v2
// deployment settings. No funded wallet, no signing, no onchain match claim.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const baseline='http://127.0.0.1:4173';
const configured=process.env.GAMBIT_SQUAD_UI_URL??'http://127.0.0.1:4175';
try{
  const no=await browser.newPage({viewport:{width:1280,height:800}});
  await no.goto(baseline,{waitUntil:'networkidle',timeout:35000});
  await no.locator('#game-state[data-phase="intro"]').waitFor({timeout:15000});
  assert.equal(await no.locator('#gambit-squad-launch').count(),0,
    'v2 wallet UI is entirely absent without BOTH verified deployment settings');
  await no.close();

  const noWallet=await browser.newPage({viewport:{width:1280,height:800}});
  const errs=[];
  noWallet.on('pageerror',error=>errs.push(error.message));
  await noWallet.goto(configured,{waitUntil:'networkidle',timeout:35000});
  await noWallet.locator('#gambit-squad-launch').waitFor({state:'visible',timeout:25000});
  assert.equal(await noWallet.locator('#gambit-squad-dialog').isVisible(),false,
    'v2 wallet controls start closed and inert');
  assert.equal(await noWallet.locator('#game-state').getAttribute('data-phase'),'intro');
  await noWallet.locator('#gambit-squad-launch').click();
  assert.equal(await noWallet.locator('#gambit-squad-dialog').isVisible(),true);
  await noWallet.locator('#gambit-squad-seal').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/Connect and verify Sepolia wallet first/}).waitFor({timeout:6000});
  await noWallet.locator('#gambit-squad-connect').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/browser Ethereum wallet is required/}).waitFor({timeout:10000});
  assert.equal(await noWallet.locator('#gambit-squad-watch').isDisabled(),true);
  assert.equal(await noWallet.locator('#game-state').getAttribute('data-phase'),'intro');
  assert.deepEqual(errs,[],'negative test must not crash page');
  await noWallet.close();

  const wrongNetwork=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await wrongNetwork.addInitScript(()=>{
    window.__squadSafetySent=false;
    window.ethereum={
      request:async({method})=>{
        if(method==='eth_chainId')return '0x1';
        if(method==='eth_accounts'||method==='eth_requestAccounts')
          return ['0x1000000000000000000000000000000000000001'];
        if(method==='eth_sendTransaction'){
          window.__squadSafetySent=true;
          throw Error('UNSAFE_MAINNET_TRANSACTION');
        }
        throw Error('Unexpected wallet request '+method);
      }
    };
  });
  const mobileErrors=[];wrongNetwork.on('pageerror',e=>mobileErrors.push(e.message));
  await wrongNetwork.goto(configured,{waitUntil:'networkidle',timeout:35000});
  await wrongNetwork.locator('#gambit-squad-launch').waitFor({state:'visible',timeout:25000});
  await wrongNetwork.locator('#gambit-squad-launch').click();
  await wrongNetwork.locator('#gambit-squad-connect').click();
  await wrongNetwork.locator('#gambit-squad-status')
    .filter({hasText:/Switch your wallet to Ethereum Sepolia/}).waitFor({timeout:12000});
  assert.equal(await wrongNetwork.evaluate(()=>window.__squadSafetySent),false,
    'misconfigured mainnet wallet cannot sign or transmit');
  assert.equal(await wrongNetwork.locator('#gambit-squad-watch').isDisabled(),true);
  assert.deepEqual(mobileErrors,[],'wrong-network refusal must not crash page');
  await wrongNetwork.close();

  console.log('PASS v2 UI gated, inert without deployment settings, no-wallet/wrong-network fail closed');
}finally{await browser.close();}
