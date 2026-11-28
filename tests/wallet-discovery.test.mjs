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

test('wallet metadata is bounded and never exposes provider or arbitrary announcement fields',()=>{
  const browser=new EventTarget();
  const wallet={request:async()=>null};
  browser.addEventListener('eip6963:requestProvider',()=>{
    const event=new Event('eip6963:announceProvider');
    event.detail={info:{name:'  Safe\u0000 Wallet  ',uuid:'u'.repeat(500),secret:'must-not-copy'},
      provider:wallet,privateKey:'must-not-copy'};
    browser.dispatchEvent(event);
  });
  const discovery=discoverInjectedWallets(browser);
  discovery.refresh();
  const metadata=discovery.metadata();
  assert.equal(metadata.length,1);
  assert.equal(metadata[0].label,'Safe Wallet');
  assert.ok(metadata[0].identifier.length<=96);
  assert.deepEqual(Object.keys(metadata[0]).sort(),['id','identifier','label']);
  assert.equal('provider' in metadata[0],false);
  assert.equal('secret' in metadata[0],false);
  discovery.close();
});
