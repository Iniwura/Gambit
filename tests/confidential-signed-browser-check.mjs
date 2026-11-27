/** Real Chromium UI with synthetic injected wallet and synthetic RPC receipts.
 * ALL external network is intercepted. No actual signing/broadcast.
 * Run only against isolated localhost Vite with confidential writes enabled.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Interface,keccak256,toQuantity} from 'ethers';
import {chromium} from 'playwright';
import {RESEARCH_DEBRIEF_PINS} from '../src/architecture/research-debrief.mjs';
const ROOT='http://127.0.0.1:4177';
const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),TX='0x'+'3'.repeat(64),H='0x'+'4'.repeat(64),M='0x'+'5'.repeat(64);
const KEY='gambit.confidential.pending.v1';
const codeByMode={};
for(const mode of ['arena','blacksite']){
 const pin=RESEARCH_DEBRIEF_PINS[mode],name=pin.contract;
 const artifact=JSON.parse(await readFile(new URL('../fhe/artifacts/contracts/'+name+'.sol/'+name+'.json',import.meta.url),'utf8'));
 assert.equal(keccak256(artifact.deployedBytecode),pin.runtimeHash);
 codeByMode[mode]={code:artifact.deployedBytecode,abi:artifact.abi};
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  for(const mode of ['arena','blacksite']){
   const ctx=await browser.newContext({viewport,hasTouch:label==='mobile',isMobile:label==='mobile'});
   try{
    const pin=RESEARCH_DEBRIEF_PINS[mode],artifact=codeByMode[mode],abi=new Interface(artifact.abi);
    let submitted=null;const external=[],errors=[];
    // Recovery provider responds with Ethereum JSON-RPC formatted fixture.
    const block=(n)=>({number:toQuantity(n),hash:n===43?M:H,parentHash:H,timestamp:'0x186a1',nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x3b9aca00',gasUsed:'0x16e360',miner:A,extraData:'0x',transactions:[],baseFeePerGas:'0x13'});
    const rpc=(method,params)=>{
     if(method==='eth_chainId')return '0xaa36a7';
     if(method==='eth_blockNumber')return '0x2d';
     if(method==='eth_getBlockByNumber')return block(params[0]==='latest'?45:Number(BigInt(params[0])));
     if(method==='eth_getCode')return artifact.code;
     if(method==='eth_getTransactionByHash'){
      assert.ok(submitted);return {hash:TX,from:A,to:pin.address,nonce:'0x7',gas:submitted.gas,gasPrice:'0x14',maxFeePerGas:submitted.maxFeePerGas,maxPriorityFeePerGas:submitted.maxPriorityFeePerGas,value:'0x0',input:submitted.data,chainId:'0xaa36a7',type:'0x2',blockNumber:'0x2b',blockHash:M,transactionIndex:'0x0',accessList:[],v:'0x0',r:'0x'+'1'.padStart(64,'0'),s:'0x'+'2'.padStart(64,'0')};
     }
     if(method==='eth_getTransactionReceipt'){
      assert.ok(submitted);
      const ev=mode==='arena'?abi.encodeEventLog(abi.getEvent('MatchCreated'),[2n,A,B]):abi.encodeEventLog(abi.getEvent('MissionOpened'),[2n,A]);
      return {transactionHash:TX,transactionIndex:'0x0',blockHash:M,blockNumber:'0x2b',from:A,to:pin.address,contractAddress:null,status:'0x1',type:'0x2',gasUsed:'0x16e360',cumulativeGasUsed:'0x16e360',effectiveGasPrice:'0x14',logsBloom:'0x'+'0'.repeat(512),logs:[{...ev,address:pin.address,blockHash:M,blockNumber:'0x2b',transactionHash:TX,transactionIndex:'0x0',logIndex:'0x0',removed:false}]};
     }
     throw Error('unhandled recovery RPC '+method);
    };
    await ctx.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.origin===ROOT){await route.continue();return;}
     external.push(url.origin);
     if(!['https://ethereum-sepolia-rpc.publicnode.com','https://gateway.tenderly.co'].includes(url.origin)){await route.abort();return;}
     const request=route.request();
     const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
     if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
     assert.equal(request.method(),'POST');
     const body=request.postDataJSON(),respond=x=>({jsonrpc:'2.0',id:x.id,result:rpc(x.method,x.params??[])});
     await route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(Array.isArray(body)?body.map(respond):respond(body))});
    });
    const page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__fixtureDispatch',p=>{assert.equal(submitted,null,'no second dispatch');submitted=p;return TX;});
    const counter=abi.encodeFunctionResult(mode==='arena'?'nextMatchId':'nextMissionId',[1n]),slot=mode==='blacksite'?abi.encodeFunctionResult('activeMission',[0n]):null;
    const selectors={counter:abi.getFunction(mode==='arena'?'nextMatchId':'nextMissionId').selector,slot:mode==='blacksite'?abi.getFunction('activeMission').selector:null};
    await page.addInitScript(({A,H,code,counter,slot,selectors,KEY})=>{
     const calls=[],listeners=new Map();
     const block={number:'0x2a',hash:H,parentHash:H,timestamp:'0x186a1',nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x3b9aca00',gasUsed:'0x0',miner:A,extraData:'0x',transactions:[],baseFeePerGas:'0x13'};
     const wallet={async request({method,params=[]}){
      calls.push(method);
      switch(method){
       case 'eth_chainId':return '0xaa36a7';
       case 'eth_accounts':return [A];
       case 'eth_blockNumber':return '0x2a';
       case 'eth_getBlockByNumber':return block;
       case 'eth_getCode':return code;
       case 'eth_call':{const selector=params[0].data.slice(0,10);if(selector===selectors.counter)return counter;if(selector===selectors.slot)return slot;throw Error('unexpected selector '+selector);}
       case 'eth_estimateGas':return '0x16e360';
       case 'eth_gasPrice':return '0x28';
       case 'eth_maxPriorityFeePerGas':return '0x2';
       case 'eth_getBalance':return '0x16345785d8a0000';
       case 'eth_getTransactionCount':return '0x7';
       case 'eth_sendTransaction':{
        const r=JSON.parse(localStorage.getItem(KEY));
        if(r?.state!=='DISPATCHED_UNKNOWN')throw Error('reservation absent before dispatch');
        return window.__fixtureDispatch(params[0]);
       }
       default:throw Error('unexpected wallet RPC '+method);
      }
     },on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},removeListener(event,fn){listeners.get(event)?.delete(fn)}};
     Object.defineProperty(window,'ethereum',{value:wallet,configurable:true});window.__walletCalls=calls;
    },{A,H,code:artifact.code,counter,slot,selectors,KEY});
    async function open(){
     await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
     await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
     const prefix=mode==='arena'?'gambit-arena-hotseat':'gambit-blacksite';
     await page.locator('#'+prefix+(label==='mobile'?'-mobile-open':'-open')).click();
     const panel=page.locator('#'+prefix+'-confidential');await panel.locator('summary').click();return panel;
    }
    let panel=await open();
    const field=n=>panel.locator('[data-field="'+n+'"]'),button=n=>panel.locator('[data-action="'+n+'"]');
    await button('find').click();await field('wallet').selectOption({index:1});await button('inspect').click();
    await panel.getByText(/Sepolia account: 0x1111111111111111111111111111111111111111/).waitFor();
    if(mode==='arena')await field('defender').fill(B);
    await button('prepare').click();
    await panel.getByText('Review the exact action before opening your wallet.').waitFor({timeout:45000});
    assert.equal(submitted,null);assert.equal(await button('send').isEnabled(),true);
    assert.match(await field('consent').textContent(),/zero ETH transfer|transfer 0 ETH/i);
    await button('send').click();
    await panel.getByText('Transaction submitted. Verify its receipt before another action.').waitFor({timeout:45000});
    assert.equal(abi.parseTransaction({data:submitted.data}).name,mode==='arena'?'createMatch':'openMission');
    assert.equal(submitted.value,'0x0');assert.equal(submitted.from,A);assert.equal(submitted.to,pin.address);
    const pending=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
    assert.equal(pending.state,'HASH_RECEIVED');assert.equal(pending.transactionHash,TX);
    for(const forbidden of ['payload','data','inputProof','privateKey','guess','plans'])assert.equal(Object.hasOwn(pending,forbidden),false);
    assert.equal((await page.evaluate(()=>window.__walletCalls)).filter(x=>x==='eth_sendTransaction').length,1);
    // Reload while pending; no further write; two synthetic provider replies.
    panel=await open();await panel.getByText(/HASH_RECEIVED/).waitFor();
    assert.equal(await button('send').isDisabled(),true);assert.equal(await field('hash').inputValue(),TX);
    await button('reconcile').click();
    await panel.getByText('Both providers reconciled the receipt. Read current state before another action.').waitFor({timeout:45000});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),null);
    assert.equal(await field('record').inputValue(),'2');
    assert.equal(await button('prepare').isDisabled(),true);
    assert.equal((await page.evaluate(()=>window.__walletCalls)).filter(x=>x==='eth_sendTransaction').length,0);
    assert.ok(external.includes('https://ethereum-sepolia-rpc.publicnode.com')&&external.includes('https://gateway.tenderly.co'));
    assert.deepEqual(errors,[]);
    console.log('GAMBIT_CONFIDENTIAL_SIGNED_BROWSER_FIXTURE '+JSON.stringify({mode,viewport:label,syntheticWalletCalls:1,reviewBeforeDispatch:true,reloadRecovery:true,twoProviderFixtures:true,realTransactions:0}));
   }finally{await ctx.close();}
  }
 }
}finally{await browser.close();}
