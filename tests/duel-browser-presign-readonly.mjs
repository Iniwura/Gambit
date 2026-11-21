/**
 * Genuine browser Zama SDK / Sepolia pre-sign smoke.
 *
 * Uses the deployed SquadGambit runtime and a public synthetic ten-value
 * challenger plan. No real wallet is connected: an EIP-1193 facade forwards
 * only allowlisted READ methods to a public Sepolia RPC, and rejects ALL
 * signing and transaction methods before they reach the RPC.
 *
 * Passing proves that Chromium reaches the wallet request boundary; it
 * does NOT prove Rabby compatibility, a signed input or a submitted duel.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {JsonRpcProvider} from 'ethers';

const rpc=new JsonRpcProvider(
  process.env.GAMBIT_SEPOLIA_RPC_READONLY||'https://ethereum-sepolia-rpc.publicnode.com',
  11155111,{staticNetwork:true}
);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const allowRead=new Set([
  'eth_chainId','eth_getCode','eth_call','eth_blockNumber',
  'eth_getBlockByNumber','eth_estimateGas','eth_gasPrice',
  'eth_feeHistory','eth_maxPriorityFeePerGas','eth_getTransactionCount'
]);
const ADDRESS='0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134';
const RUNTIME='0x94754bf634ba275b7a2f047483854553cbdfad51b15209477b467220b576f419';
const CHALLENGER='0x70d086988706e4f27A53c484570B2a41897dcDD5';

try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  // This is the ONLY host bridge: methods outside the read allowlist never
  // get forwarded to an RPC, including eth_sendTransaction and signing.
  await page.exposeFunction('__gambitReadOnlyRpc',async ({method,params})=>{
    if(!allowRead.has(method))throw Error('BLOCKED_NONREAD_RPC_METHOD');
    return rpc.send(method,Array.isArray(params)?params:[]);
  });
  await page.addInitScript(challenger=>{
    const requests=[];
    const blocked=[];
    window.__gambitPresign={requests,blocked};
    window.ethereum={
      request:async ({method,params})=>{
        requests.push(method);
        if(method==='eth_requestAccounts'||method==='eth_accounts')return [challenger];
        if(method==='eth_chainId')return '0xaa36a7';
        if(![
          'eth_getCode','eth_call','eth_blockNumber','eth_getBlockByNumber',
          'eth_estimateGas','eth_gasPrice','eth_feeHistory',
          'eth_maxPriorityFeePerGas','eth_getTransactionCount'
        ].includes(method)){
          blocked.push(method);
          throw Error('GAMBIT_TEST_WALLET_BLOCKED_'+method);
        }
        return window.__gambitReadOnlyRpc({method,params});
      },
      on:()=>{},
      removeListener:()=>{}
    };
  },CHALLENGER);
  await page.goto('http://127.0.0.1:4177/',{waitUntil:'domcontentloaded',timeout:45000});
  const result=await page.evaluate(async ({address,runtime})=>{
    const {createSquadSepoliaClient}=await import('/src/chain/squad-sepolia.ts');
    const progress=[];
    const c=await createSquadSepoliaClient(address,runtime,window.ethereum);
    const stage=await c.nextDuelStep(1n);
    if(stage.step!=='submit'){
      return {skipped:true,step:stage.step,requests:window.__gambitPresign.requests,
        blocked:window.__gambitPresign.blocked};
    }
    let error=null;
    const plans=[
      {base:2,trigger:0,response:1},
      {base:1,trigger:2,response:0},
      {base:0,trigger:1,response:2}
    ];
    try{
      await Promise.race([
        c.submitDuel(1n,plans,2,message=>progress.push(message)),
        new Promise((_,reject)=>setTimeout(()=>reject(Error('PRESIGN_TIMEOUT_120S')),120000))
      ]);
    }catch(e){error=e instanceof Error?e.message:String(e);}
    return {skipped:false,error,progress,
      requests:window.__gambitPresign.requests,
      blocked:window.__gambitPresign.blocked};
  },{address:ADDRESS,runtime:RUNTIME});
  if(result.skipped){
    assert.equal(result.blocked.length,0,'expired/finalized duel must never prompt');
    console.log('GAMBIT_BROWSER_PRESIGN_READONLY_SKIPPED '+JSON.stringify({
      reason:'Duel #1 is no longer awaiting submission',step:result.step,
      walletConnected:false,signatureMade:false,transactionSent:false
    }));
  }else{
    assert.match(result.error??'',/GAMBIT_TEST_WALLET_BLOCKED_eth_sendTransaction/,
      'expected one intercepted wallet send AFTER Chromium encryption and live gas quote: '+
      JSON.stringify({error:result.error,progress:result.progress}));
    assert.equal(result.blocked.length,1,'exactly one blocked wallet call');
    assert.equal(result.blocked[0],'eth_sendTransaction');
    assert.match(result.progress.join('\n'),/Encryption completed/);
    assert.match(result.progress.join('\n'),/Ready: requesting exactly one submitDuel\(1\)/);
    assert.ok(!result.requests.includes('personal_sign'));
    console.log('GAMBIT_BROWSER_PRESIGN_READONLY '+JSON.stringify({
      chainId:11155111,contract:ADDRESS,duelId:'1',syntheticInputs:10,
      encryptionAndGasQuote:'COMPLETED_IN_CHROMIUM',
      walletRequestIntercepted:'eth_sendTransaction',
      unsigned:true,signatureMade:false,transactionSent:false,
      progressStages:result.progress.length,blocklistCount:result.blocked.length
    }));
  }
  assert.deepEqual(pageErrors,[],'Chromium must not produce uncaught page errors');
  await page.close();
}finally{
  await browser.close();
  rpc.destroy();
}
