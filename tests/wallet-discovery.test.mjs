import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverInjectedWallets} from '../src/chain/wallet-discovery.mjs';

test('EIP-6963 discovers MetaMask even when another extension owns window.ethereum',()=>{
  const browser=new EventTarget();
  const globalWallet={request:async()=> '0x1'};
  const metaMask={isMetaMask:true,request:async()=> '0xaa36a7'};
  browser.ethereum=globalWallet;
  browser.addEventListener('eip6963:requestProvider',()=>{
    const event=new Event('eip6963:announceProvider');
    event.detail={info:{name:'MetaMask',uuid:'gambit-metamask-test'},provider:metaMask};
    browser.dispatchEvent(event);
  });
  const discovery=discoverInjectedWallets(browser);
  const wallets=discovery.refresh();
  assert.equal(wallets.length,2);
  assert.equal(wallets[0].provider,globalWallet);
  assert.ok(wallets.some(wallet=>wallet.label==='MetaMask'&&wallet.provider===metaMask));
  assert.ok(wallets.every(wallet=>wallet.provider&&typeof wallet.provider.request==='function'));
  assert.equal(discovery.refresh().length,2,'repeat announcements must not duplicate wallets');
  discovery.close();
});

test('legacy array of injected providers dedupes EIP-6963 announcements by actual provider',()=>{
  const browser=new EventTarget();
  const meta={isMetaMask:true,request:async()=>null};
  const alt={request:async()=>null};
  browser.ethereum={providers:[alt,meta]};
  const discovery=discoverInjectedWallets(browser);
  assert.equal(discovery.list().length,2);
  const event=new Event('eip6963:announceProvider');
  event.detail={info:{uuid:'one',name:'MetaMask'},provider:meta};
  browser.dispatchEvent(event);
  const wallets=discovery.list();
  assert.equal(wallets.length,2);
  assert.equal(wallets.find(x=>x.provider===meta).label,'MetaMask');
  discovery.close();
});

test('malformed EIP-6963 data is ignored and wallet discovery never requests accounts',()=>{
  const browser=new EventTarget();
  let requests=0;
  const wallet={request:async()=>{requests++;}};
  browser.ethereum=wallet;
  const discovery=discoverInjectedWallets(browser);
  const bad=new Event('eip6963:announceProvider');
  bad.detail={info:{name:'Fake Wallet'},provider:{notAProvider:true}};
  browser.dispatchEvent(bad);
  assert.equal(discovery.refresh().length,1);
  assert.equal(requests,0,'discovery is inert; only the user Connect button may request accounts');
  discovery.close();
});
