import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const BASE='http://127.0.0.1:4173';
try{
  const page=await browser.newPage({viewport:{width:980,height:800}});
  const errors=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  const response=await page.goto(BASE+'/deploy.html',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.locator('#status') .filter({hasText:/Compiled SealedGambit verified/}).waitFor({timeout:8000});
  assert.equal(await page.locator('#deploy').isDisabled(),true,'deploy disabled without wallet');
  await page.locator('#connect').click();
  await page.locator('#status') .filter({hasText:/No browser wallet found/}).waitFor({timeout:4000});
  assert.equal(await page.locator('#deploy').isDisabled(),true);

  // A malicious wallet on the WRONG network must never authorize deployment.
  await page.addInitScript(()=>{
    (window).ethereum={
      request:async({method})=>{
        if(method==='eth_requestAccounts'||method==='eth_accounts')return ['0x1000000000000000000000000000000000000001'];
        if(method==='eth_chainId')return '0x1';
        if(method==='net_version')return '1';
        if(method==='eth_sendTransaction')throw Error('SENT_TRANSACTION_ON_MAINNET');
        throw Error('Unsupported wallet RPC '+method);
      }
    };
  });
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#status') .filter({hasText:/Compiled SealedGambit verified/}).waitFor({timeout:8000});
  await page.locator('#connect').click();
  await page.locator('#status') .filter({hasText:/Wrong chain/}).waitFor({timeout:7000});
  assert.equal(await page.locator('#deploy').isDisabled(),true);
  assert.equal(errors.length,0,'unexpected errors: '+errors.join(';'));
  console.log('PASS browser deployment helper: exact built bytecode, no-wallet and mainnet refusal');
  await page.close();
}finally{await browser.close();}
