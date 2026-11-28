/** Real browser read-only acceptance against the two public Sepolia RPCs.
 * This test makes no wallet request, signs nothing and sends no transaction.
 * Only the two pinned read-only endpoints may be contacted.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ROOT='http://127.0.0.1:4173';
const RPC=new Set(['https://ethereum-sepolia-rpc.publicnode.com','https://gateway.tenderly.co']);
const READ=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getCode','eth_call']);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,hasTouch:label==='mobile',isMobile:label==='mobile'});
  try{
   const requests=[],forbidden=[],errors=[];
   await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===ROOT){await route.continue();return;}
    if(!RPC.has(url.origin)){await route.abort();return;}
    if(request.method()==='OPTIONS'){await route.continue();return;}
    const data=request.postDataJSON(),rows=Array.isArray(data)?data:[data];
    if(request.method()!=='POST'||rows.some(r=>!READ.has(r?.method))){forbidden.push(...rows.map(r=>r?.method));await route.abort();return;}
    requests.push(...rows.map(r=>({origin:url.origin,method:r.method})));await route.continue();
   });
   const page=await ctx.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    const calls=[];Object.defineProperty(window,'ethereum',{value:{request({method}){calls.push(method);throw Error('No wallet calls permitted');}},configurable:true});window.__debriefWalletCalls=calls;
   });
   await page.goto(ROOT,{waitUntil:'networkidle',timeout:45000});
   await page.locator('#game-state[data-phase="intro"]').waitFor({timeout:20000});
   for(const mode of ['arena','blacksite']){
    const prefix=mode==='arena'?'gambit-arena-hotseat':'gambit-blacksite';
    const before=requests.length;
    await page.locator('#'+prefix+(label==='mobile'?'-mobile-open':'-open')).click();
    const section=page.locator('#'+prefix+'-research-debrief');
    assert.equal(await section.locator('ol li').count(),0);
    assert.equal(requests.length,before,'no RPC before explicit verify');
    await section.locator('button').click();
    await section.getByText('Both providers agree on the finalized public state.').waitFor({timeout:35000});
    const rows=await section.locator('ol li').allTextContents();
    assert.equal(rows.length,mode==='arena'?7:6);
    assert.match(rows[0],mode==='arena'?/Final score: 27 – 0/:/BREACHED · score 35 · heat 5/);
    assert.match(rows.at(-1),/Verified at blocks \d+ \/ \d+/);
    assert.equal(new Set(requests.slice(before).map(r=>r.origin)).size,2);
    await page.locator('#'+prefix+(mode==='arena'?'-close':'-back')).click();
    await section.locator('ol li').first().waitFor({state:'detached'});
    console.log('GAMBIT_LIVE_DEBRIEF_BROWSER '+JSON.stringify({mode,viewport:label,providers:2,terminalState:rows[0],walletCalls:0,writes:0}));
   }
   assert.deepEqual(forbidden,[]);assert.deepEqual(await page.evaluate(()=>window.__debriefWalletCalls),[]);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
}finally{await browser.close();}
