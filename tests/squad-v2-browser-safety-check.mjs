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
  assert.equal(await noWallet.locator('#gambit-chain-launch').count(),0,
    'never mount obsolete one-fighter wallet UI alongside configured 3v3 squad UI');
  assert.equal(await noWallet.locator('#gambit-squad-dialog').isVisible(),false,
    'v2 wallet controls start closed and inert');
  assert.equal(await noWallet.locator('#game-state').getAttribute('data-phase'),'intro');
  await noWallet.locator('#gambit-squad-launch').click();
  assert.equal(await noWallet.locator('#gambit-squad-dialog').isVisible(),true);
  assert.equal(await noWallet.locator('#gambit-squad-public-inspect').count(),1,
    'judges must be able to inspect finalized scores without a wallet');
  assert.equal(await noWallet.locator('#gambit-squad-share-invite').count(),1);
  assert.equal(await noWallet.locator('#gambit-squad-share-result').isDisabled(),true,
    'never share a result before it is truly finalized onchain');
  await noWallet.locator('#gambit-squad-id').fill('19');
  await noWallet.locator('#gambit-squad-share-invite').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/Connect and verify Sepolia wallet first/})
    .waitFor({timeout:6000});
  assert.equal(await noWallet.locator('#gambit-squad-share-result').isDisabled(),true,
    'inert unverified link actions must not unlock the result viewer');
  await noWallet.locator('#gambit-duel-id').fill('not-a-valid-id');
  await noWallet.locator('#gambit-squad-public-inspect').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/Duel ID must be a positive integer/}).waitFor({timeout:6000});
  assert.equal(await noWallet.locator('#gambit-squad-watch').isDisabled(),true,
    'invalid spectator ID cannot fabricate an authenticated result');
  assert.equal(await noWallet.locator('#gambit-squad-resolve').count(),1,
    'encrypted resolution must be one independent transaction action');
  assert.equal(await noWallet.locator('#gambit-squad-finalize').count(),1,
    'signed score finalization needs a separate action');
  await noWallet.locator('#gambit-squad-seal').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/Connect and verify Sepolia wallet first/}).waitFor({timeout:6000});
  await noWallet.locator('#gambit-squad-connect').click();
  await noWallet.locator('#gambit-squad-status')
    .filter({hasText:/No Ethereum wallet found/}).waitFor({timeout:10000});
  const connectionButton=await noWallet.locator('#gambit-squad-connect').boundingBox();
  const connectionStatus=await noWallet.locator('#gambit-squad-status').boundingBox();
  assert.ok(connectionButton&&connectionStatus &&
    connectionStatus.y>connectionButton.y &&
    connectionStatus.y-connectionButton.y<130,
    'wallet connect errors must be immediately visible below the button, not below the panel fold');
  assert.equal(await noWallet.locator('#gambit-squad-wallet-choice').inputValue(),'');
  assert.equal(await noWallet.locator('#gambit-squad-watch').isDisabled(),true);
  assert.equal(await noWallet.locator('#game-state').getAttribute('data-phase'),'intro');
  assert.deepEqual(errs,[],'negative test must not crash page');
  await noWallet.close();

  // A real invitation link must present the CHALLENGER task, not owner
  // controls for creating a duplicate squad. Nothing is signed on page load.
  const invitePage=await browser.newPage({viewport:{width:1280,height:800}});
  const inviteErrors=[];invitePage.on('pageerror',e=>inviteErrors.push(e.message));
  await invitePage.goto(configured+'?squad=1',{waitUntil:'networkidle',timeout:35000});
  await invitePage.locator('#gambit-squad-launch').click();
  assert.equal(await invitePage.locator('#gambit-squad-id').inputValue(),'1');
  assert.equal(await invitePage.locator('#gambit-squad-seal').isVisible(),false,
    'challenger must not be prompted to create a new sealed squad');
  assert.equal(await invitePage.locator('#gambit-squad-share-invite').isVisible(),false,
    'owner-only share control must be hidden from invitees');
  assert.equal(await invitePage.locator('#gambit-squad-invite').isVisible(),false,
    'challenger must not be asked to fill the invitee address');
  assert.equal(await invitePage.locator('label[for="gambit-squad-invite"]').isVisible(),false,
    'challenger must not see an orphan owner-only field label');
  assert.match(await invitePage.locator('#gambit-squad-open-details').textContent(),
    /200,000,000 Sepolia wei/);
  assert.match(await invitePage.locator('#gambit-squad-open').textContent(),/Open invited squad/);
  await invitePage.locator('#gambit-squad-open').click();
  await invitePage.locator('#gambit-squad-status')
    .filter({hasText:/Connect and verify Sepolia wallet first/}).waitFor({timeout:6000});
  assert.deepEqual(inviteErrors,[],'opening an unsigned invitation page cannot crash the game');
  await invitePage.close();

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
  await wrongNetwork.locator('#gambit-squad-mobile-launch').waitFor({state:'visible',timeout:25000});
  assert.equal(await wrongNetwork.locator('#gambit-squad-launch').isVisible(),false,
    'mobile game view must never be covered by a fixed wallet lab button');
  await wrongNetwork.locator('#gambit-squad-mobile-launch').click();
  await wrongNetwork.locator('#gambit-squad-connect').click();
  await wrongNetwork.locator('#gambit-squad-status')
    .filter({hasText:/Switch your wallet to Ethereum Sepolia/}).waitFor({timeout:12000});
  assert.equal(await wrongNetwork.evaluate(()=>window.__squadSafetySent),false,
    'misconfigured mainnet wallet cannot sign or transmit');
  assert.equal(await wrongNetwork.locator('#gambit-squad-watch').isDisabled(),true);
  assert.deepEqual(mobileErrors,[],'wrong-network refusal must not crash page');
  await wrongNetwork.close();

  // Multi-wallet regression: the injected global wallet reports MAINNET,
  // while MetaMask is announced via EIP-6963. The game must select MetaMask,
  // never whichever extension won the window.ethereum race.
  const multiWallet=await browser.newPage({viewport:{width:1280,height:820}});
  await multiWallet.addInitScript(()=>{
    window.__gambitWalletCalls={global:[],meta:[],sent:false};
    const globalWallet={request:async({method})=>{
      window.__gambitWalletCalls.global.push(method);
      if(method==='eth_chainId')return '0x1';
      if(method==='eth_sendTransaction'){window.__gambitWalletCalls.sent=true;throw Error('NO_TX');}
      throw Error('Unexpected legacy wallet method '+method);
    }};
    const metaMask={
      isMetaMask:true,
      request:async({method})=>{
        window.__gambitWalletCalls.meta.push(method);
        if(method==='eth_chainId')return '0xaa36a7';
        if(method==='eth_requestAccounts'||method==='eth_accounts')
          return ['0x70d086988706e4f27A53c484570B2a41897dcDD5'];
        if(method==='eth_getCode')return '0x';
        if(method==='eth_sendTransaction'){window.__gambitWalletCalls.sent=true;throw Error('NO_TX');}
        throw Error('Unexpected MetaMask wallet method '+method);
      }
    };
    window.ethereum=globalWallet;
    window.addEventListener('eip6963:requestProvider',()=>{
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{
        detail:{info:{uuid:'gambit-metamask-test',name:'MetaMask',rdns:'io.metamask'},provider:metaMask}
      }));
    });
  });
  const multiErrors=[];multiWallet.on('pageerror',e=>multiErrors.push(e.message));
  await multiWallet.goto(configured,{waitUntil:'networkidle',timeout:35000});
  await multiWallet.locator('#gambit-squad-launch').click();
  await multiWallet.locator('#gambit-squad-wallet-choice')
    .locator('option',{hasText:'MetaMask'}).waitFor({state:'attached',timeout:6000});
  assert.equal(await multiWallet.locator('#gambit-squad-wallet-choice option:checked').textContent(),'MetaMask');
  await multiWallet.locator('#gambit-squad-connect').click();
  await multiWallet.locator('#gambit-squad-status')
    .filter({hasText:/runtime fingerprint mismatch/i}).waitFor({timeout:15000});
  const calls=await multiWallet.evaluate(()=>window.__gambitWalletCalls);
  assert.ok(calls.meta.includes('eth_chainId'),'the chosen MetaMask provider must be consulted');
  assert.equal(calls.global.length,0,'legacy global provider must not override chosen MetaMask');
  assert.equal(calls.sent,false,'failed runtime verification cannot send a transaction');
  assert.deepEqual(multiErrors,[],'multi-wallet path should not crash the page');
  await multiWallet.close();

  console.log('PASS v2 UI wallet errors visible, EIP-6963 MetaMask selected; no-wallet/wrong-network blocked without signatures');
}finally{await browser.close();}
