import './confidential-controls.css';
import {BrowserProvider,JsonRpcProvider,formatEther,parseEther,Interface} from 'ethers';
import {discoverInjectedWallets} from '../chain/wallet-discovery.mjs';
import {createArenaV3SdkSession} from '../arena/sdk-session';
import {arenaV4ReadOnlyWallet,readArenaV4SelectedAccount} from '../arena/v4-fhe-preparation.mjs';
import {readArenaV4PublicMatch} from '../arena/v4-public-match-reader.mjs';
import {readNeutralBlacksiteMission} from '../blacksite/neutral-public-mission-reader.mjs';
import {prepareConfidentialAction} from './confidential-action-controller.mjs';
import {RESEARCH_DEBRIEF_PINS,RESEARCH_DEBRIEF_RPC} from './research-debrief.mjs';
import {createConfidentialExecution,reconcileConfidentialAction} from '../chain/confidential-execution.mjs';
import {createConfidentialBrowserJournal,createConfidentialBrowserLock} from '../chain/confidential-browser-journal.mjs';
type Mode='arena'|'blacksite';
type Wallet={request:(args:{method:string,params?:unknown})=>Promise<unknown>,on?:(event:string,fn:()=>void)=>unknown,removeListener?:(event:string,fn:()=>void)=>unknown};
type Prepared=Awaited<ReturnType<typeof prepareConfidentialAction>>;
type ArenaView={currentRound:number,challenger:string,defender:string,status:string,cumulative:{challenger:number,defender:number},rounds:readonly {round:number,challengerSealed:boolean,defenderSealed:boolean,finalized:boolean,score:{challenger:number,defender:number}|null}[]};
type MissionView={operative:string,status:string,attemptsUsed:number,heat:number,score:number,history:readonly {attempt:number,route:string,exact:number,misplaced:number|null}[]};
type View=ArenaView|MissionView;
const ACTIONS=['STRIKE','GUARD','FLANK'],ROLES=['Scout','Guardian','Striker'];
const activeABI=new Interface(['function activeMission(address) view returns(uint256)']);
/** Greybox candidate. Explicit build opt-in is necessary for wallet dispatch
 * while browser acceptance is pending. Preparation is always unsigned.
 */
const SIGNING_ENABLED=import.meta.env.VITE_GAMBIT_CONFIDENTIAL_WRITES==='true';
export function mountConfidentialControls(){
 for(const mode of ['arena','blacksite'] as const)mount(mode);
}
function mount(mode:Mode){
 const prefix=mode==='arena'?'gambit-arena-hotseat':'gambit-blacksite',id=prefix+'-confidential';
 const parentOverlay=document.getElementById(prefix+'-overlay'),host=document.getElementById(prefix+'-dialog');
 if(!parentOverlay||!host||document.getElementById(id))return;
 const overlay:HTMLElement=parentOverlay;
 const panel=document.createElement('details');panel.id=id;
 const summary=document.createElement('summary');summary.textContent=mode==='arena'?'Arena V4 · Confidential match':'BLACKSITE · Confidential mission';
 panel.append(summary);
 const content=document.createElement('section');
 content.innerHTML=`
 <p>Sepolia research mode · ${SIGNING_ENABLED?'explicit wallet approval per action':'unsigned preparation only; signing awaits browser acceptance'}</p>
 <label>Browser wallet <select data-field="wallet"><option value="">Choose wallet</option></select></label>
 <button type="button" data-action="find">FIND WALLETS</button>
 <button type="button" data-action="connect">AUTHORIZE SELECTED WALLET</button>
 <button type="button" data-action="inspect">CHECK ACCOUNT</button>
 <p data-field="status" role="status" aria-live="polite">Choose a wallet to begin.</p>
 <label>${mode==='arena'?'Match':'Mission'} ID <input data-field="record" type="number" min="1" step="1" inputmode="numeric"></label>
 <button type="button" data-action="read">READ CURRENT STATE</button>
 ${mode==='blacksite'?'<button type="button" data-action="recover-active">RECOVER ACTIVE MISSION</button>':'<label>Invited defender <input data-field="defender" autocomplete="off" spellcheck="false" maxlength="42"></label>'}
 <p data-field="view" role="status" aria-live="polite"></p>
 <ol data-field="history" aria-label="Finalized public results"></ol>
 <button type="button" data-action="new-record" hidden>START ANOTHER ${mode==='arena'?'MATCH':'MISSION'}</button>
 <label>Maximum transaction fee (Sepolia ETH) <input data-field="budget" type="text" inputmode="decimal" value="0.005"></label>
 <label>Action <select data-field="action"></select></label>
 <div data-field="planner"></div>
 <button type="button" data-action="prepare">PREPARE EXACT TRANSACTION</button>
 <section data-field="review" hidden><h3>Transaction review</h3><p data-field="consent"></p>
 <button type="button" data-action="send">OPEN WALLET AND SUBMIT ONCE</button>
 <button type="button" data-action="discard">DISCARD REVIEW</button></section>
 <section><h3>Pending transaction recovery</h3><p data-field="pending" role="status"></p>
 <label>Transaction hash (if known) <input data-field="hash" autocomplete="off" spellcheck="false" maxlength="66"></label>
 <button type="button" data-action="reconcile">CHECK RECEIPT WITH TWO PROVIDERS</button></section>`;
 panel.append(content);host.append(panel);
 function field<T extends HTMLElement>(name:string){const node=content.querySelector<T>('[data-field="'+name+'"]');if(!node)throw Error('Missing confidential field');return node;}
 function btn(name:string){return content.querySelector<HTMLButtonElement>('[data-action="'+name+'"]');}
 const walletSelect=field<HTMLSelectElement>('wallet'),record=field<HTMLInputElement>('record'),action=field<HTMLSelectElement>('action'),planner=field<HTMLElement>('planner'),review=field<HTMLElement>('review'),status=field<HTMLElement>('status'),pendingText=field<HTMLElement>('pending');
 let discovery:ReturnType<typeof discoverInjectedWallets>|null=null,selected:Wallet|null=null,actor:string|null=null,provider:BrowserProvider|null=null,view:View|null=null,prepared:Prepared|null=null,sdk:Awaited<ReturnType<typeof createArenaV3SdkSession>>|null=null;
 let revision=0,busy=false,controller:AbortController|null=null;
 const journal=()=>createConfidentialBrowserJournal(window.localStorage);
 const lock=()=>createConfidentialBrowserLock(navigator.locks);
 function report(s:string){status.textContent=s;}
 function clearReview(){prepared=null;review.hidden=true;field('consent').textContent='';}
 function clearPlans(){planner.replaceChildren();}
 function clearView(){view=null;field('view').textContent='';field('history').replaceChildren();const next=btn('new-record');if(next)next.hidden=true;renderActions();}
 function cancel(){
  revision++;controller?.abort();controller=null;busy=false;clearReview();clearPlans();
  provider?.destroy();provider=null;sdk?.provider.destroy();sdk=null;actor=null;clearView();
 }
 const changed=()=>{cancel();report('Account or network changed. Check the selected wallet again.');syncPending();};
 function detach(){for(const name of ['accountsChanged','chainChanged','disconnect'])selected?.removeListener?.(name,changed);selected=null;}
 function selectWallet(){
  detach();cancel();selected=discovery?.list().find(w=>w.id===walletSelect.value)?.provider??null;
  for(const name of ['accountsChanged','chainChanged','disconnect'])selected?.on?.(name,changed);
  report(selected?'Check the selected Sepolia account.':'Choose a wallet.');
 }
 function renderWallets(){
  const old=walletSelect.value;walletSelect.replaceChildren(new Option('Choose wallet',''));
  for(const w of discovery?.list()??[])walletSelect.append(new Option(w.label,w.id));
  if(Array.from(walletSelect.options).some(o=>o.value===old))walletSelect.value=old;
  else selectWallet();
 }
 function find(){if(!discovery){discovery=discoverInjectedWallets(window);discovery.subscribe(renderWallets);}discovery.refresh();renderWallets();}
 function syncPending(){
  try{const p=journal().read();pendingText.textContent=p?p.state+' · '+p.mode+' · '+p.action:'No pending transaction.';
   if(p?.transactionHash)field<HTMLInputElement>('hash').value=p.transactionHash;
   const send=btn('send');if(send)send.disabled=!SIGNING_ENABLED||!!p;
  }catch{pendingText.textContent='Recovery storage is unavailable or invalid. Signing is blocked.';const send=btn('send');if(send)send.disabled=true;}
 }
 function renderActions(){
  const choices:[string,string][]=[];
  if(actor){
   if(!view&&!record.value.trim())choices.push(mode==='arena'?['CREATE_MATCH','Create match']:['OPEN_MISSION','Open mission']);
   else if(view&&'currentRound' in view){
    const r=view.rounds.at(-1),side=view.challenger===actor?'challenger':view.defender===actor?'defender':null;
    if(side&&r){
     if(['WAITING_FOR_BOTH','WAITING_FOR_OPPONENT'].includes(view.status)&&!r[side==='challenger'?'challengerSealed':'defenderSealed'])choices.push(['SEAL_ROUND','Encrypt and seal orders']);
     if(view.status==='READY_TO_RESOLVE')choices.push(['RESOLVE_ROUND','Resolve round']);
     if(view.status==='AWAITING_PROOF')choices.push(['FINALIZE_ROUND','Authenticate and finalize']);
     if(view.status==='EXPIRED_INCOMPLETE_NOT_CLOSED')choices.push(['EXPIRE_INCOMPLETE','Close incomplete match']);
     if(view.status==='RECOVERY_EXPIRED_NOT_CLOSED')choices.push(['ABORT_UNSETTLED','Close failed settlement']);
    }
   }else if(view&&'operative' in view&&view.operative===actor){
    const map:Record<string,[string,string]>={ACCEPTING_ATTEMPT:['SUBMIT_ATTEMPT','Encrypt attempt'],SEALED:['RESOLVE_ATTEMPT','Resolve attempt'],AWAITING_PROOF:['FINALIZE_ATTEMPT','Authenticate and finalize'],EXPIRED_NOT_CLOSED:['EXPIRE_MISSION','Close expired mission'],RECOVERY_EXPIRED_NOT_CLOSED:['ABORT_UNSETTLED','Close failed settlement']};
    if(map[view.status])choices.push(map[view.status]);
   }
  }
  action.replaceChildren(...(choices.length?choices.map(([v,t])=>new Option(t,v)):[new Option('No available action','')]));
  const prepare=btn('prepare');if(prepare)prepare.disabled=!choices.length;
  renderPlanner();
 }
 function selector(label:string,values:string[],name:string){
  const l=document.createElement('label');l.textContent=label+' ';
  const s=document.createElement('select');s.dataset.order=name;values.forEach((v,i)=>s.append(new Option(v,String(i))));l.append(s);planner.append(l);
 }
 function renderPlanner(){
  clearPlans();
  if(action.value==='SEAL_ROUND'){
   for(let i=0;i<3;i++){selector(ROLES[i]+' opening',ACTIONS,'base'+i);selector(ROLES[i]+' trigger',ACTIONS,'trigger'+i);selector(ROLES[i]+' response',ACTIONS,'response'+i);}
   selector('Formation',['HOLD','PIVOT','FEINT'],'formation');selector('GAMBIT request',['None','Sector 1','Sector 2','Sector 3'],'stake');
  }else if(action.value==='SUBMIT_ATTEMPT'){
   for(let i=0;i<5;i++)selector('Glyph '+(i+1),['0','1','2','3'],'glyph'+i);
   selector('Approach',['STEALTH','PROBE','BREACH'],'route');
  }
 }
 function order(){
  const read=(name:string)=>Number(planner.querySelector<HTMLSelectElement>('[data-order="'+name+'"]')?.value);
  if(action.value==='SEAL_ROUND')return {plans:ROLES.map((_,i)=>({base:read('base'+i),trigger:read('trigger'+i),response:read('response'+i)})),formation:read('formation'),stakeSector:read('stake')===0?null:read('stake')-1};
  if(action.value==='SUBMIT_ATTEMPT')return {guess:Array.from({length:5},(_,i)=>read('glyph'+i)),route:['STEALTH','PROBE','BREACH'][read('route')]};
  return undefined;
 }
 async function run(work:(signal:AbortSignal,epoch:number)=>Promise<void>){
  if(busy||overlay.hidden||!panel.open)return;busy=true;controller=new AbortController();const epoch=revision,signal=controller.signal;
  try{await work(signal,epoch);}
  catch{if(epoch===revision&&!signal.aborted)report('Action could not be verified. Check wallet, network, current state and fee. Inspect pending recovery before retrying.');}
  finally{if(epoch===revision){busy=false;controller=null;syncPending();}}
 }
 const current=(epoch:number,signal:AbortSignal)=>epoch===revision&&!signal.aborted&&!overlay.hidden&&panel.open;
 async function inspect(signal:AbortSignal,epoch:number){
  if(!selected)throw Error('Choose wallet');const a=await readArenaV4SelectedAccount(selected,signal);
  if(!current(epoch,signal))return;
  provider?.destroy();sdk?.provider.destroy();provider=new BrowserProvider(arenaV4ReadOnlyWallet(selected) as any);actor=a;sdk=null;clearReview();clearView();report('Sepolia account: '+a);
 }
 async function readState(signal:AbortSignal,epoch:number){
  if(!provider||!actor)throw Error('Check account');const n=Number(record.value);
  if(!Number.isSafeInteger(n)||n<=0)throw Error('Record ID');
  clearReview();clearView();
  const fresh=(mode==='arena'?await readArenaV4PublicMatch(provider,RESEARCH_DEBRIEF_PINS.arena,n,{signal}):await readNeutralBlacksiteMission(provider,RESEARCH_DEBRIEF_PINS.blacksite,n,{signal})) as View;
  if(!current(epoch,signal))return;
  view=fresh;clearReview();renderActions();
  field('view').textContent='currentRound' in fresh?'Round '+fresh.currentRound+' / 5 · '+fresh.status+' · '+fresh.cumulative.challenger+' : '+fresh.cumulative.defender:fresh.status+' · '+fresh.attemptsUsed+' / 4 attempts · heat '+fresh.heat+' · score '+fresh.score;
  const rows='currentRound' in fresh?fresh.rounds.filter(r=>r.finalized&&r.score).map(r=>'Round '+r.round+' · '+r.score!.challenger+' : '+r.score!.defender):fresh.history.map(r=>'Attempt '+r.attempt+' · '+r.route+' · '+r.exact+' exact'+(r.misplaced===null?'':' · '+r.misplaced+' misplaced'));
  field('history').replaceChildren(...rows.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const next=btn('new-record');if(next)next.hidden=!['COMPLETE','ABANDONED_UNSCORED','TECHNICAL_ABORT_UNSCORED','BREACHED','LOCKED','EXPIRED','TECHNICAL_ABORT'].includes(fresh.status);
 }
 walletSelect.addEventListener('change',selectWallet);
 action.addEventListener('change',()=>{clearReview();renderPlanner();});
 record.addEventListener('input',()=>{clearReview();clearView();});
 content.addEventListener('input',e=>{if(e.target!==record&&e.target!==walletSelect)clearReview();});
 // Inputs edited while encryption or preparation runs invalidate the result.
 content.addEventListener('input',()=>{if(busy){revision++;controller?.abort();controller=null;busy=false;clearReview();}});
 action.addEventListener('change',()=>{if(busy){revision++;controller?.abort();controller=null;busy=false;clearReview();}});
 btn('find')?.addEventListener('click',find);
 btn('connect')?.addEventListener('click',()=>void run(async(signal,epoch)=>{if(!selected)throw Error('Choose wallet');await selected.request({method:'eth_requestAccounts'});if(current(epoch,signal))await inspect(signal,epoch);}));
 btn('inspect')?.addEventListener('click',()=>void run(inspect));
 btn('read')?.addEventListener('click',()=>void run(readState));
 btn('new-record')?.addEventListener('click',()=>{if(busy)return;record.value='';clearReview();clearView();report('Choose a new action. The previous finalized record remains onchain.');});
 btn('recover-active')?.addEventListener('click',()=>void run(async(signal,epoch)=>{
  if(!provider||!actor)throw Error('Check account');const data=activeABI.encodeFunctionData('activeMission',[actor]),raw=await provider.call({to:RESEARCH_DEBRIEF_PINS.blacksite.address,data});
  const n=activeABI.decodeFunctionResult('activeMission',raw)[0];if(!current(epoch,signal))return;
  if(n===0n){record.value='';clearView();report('No active mission.');return;}record.value=String(n);await readState(signal,epoch);
 }));
 btn('prepare')?.addEventListener('click',()=>void run(async(signal,epoch)=>{
  if(!selected||!actor||!provider||!action.value||journal().read())throw Error('Check account and pending state');
  clearReview();const chosen=action.value,plan=order(),step=view?('currentRound' in view?view.currentRound:view.attemptsUsed+1):undefined;
  const args={mode,action:chosen,wallet:selected,provider,expectedActor:actor,signal,maximumFeeWei:parseEther(field<HTMLInputElement>('budget').value).toString(),id:view?Number(record.value):undefined,step,order:plan,defender:mode==='arena'?field<HTMLInputElement>('defender').value:undefined};
  report('Preparing exact transaction. Encryption can take time.');
  if(['SEAL_ROUND','FINALIZE_ROUND','SUBMIT_ATTEMPT','FINALIZE_ATTEMPT'].includes(chosen)&&!sdk){
   const session=await createArenaV3SdkSession(selected,signal);
   if(!current(epoch,signal)){session.provider.destroy();return;}
   sdk=session;
  }
  const p=await prepareConfidentialAction({...args,sdk:sdk?.sdk});
  if(!current(epoch,signal))return;
  clearPlans();prepared=p;review.hidden=false;
  field('consent').textContent=p.intent.consentText+' Quoted maximum fee: '+formatEther(BigInt(p.intent.fee.gasLimit)*BigInt(p.intent.fee.maxFeePerGasWei))+' ETH.';
  report(SIGNING_ENABLED?'Review the exact action before opening your wallet.':'Unsigned preparation succeeded. Signing is disabled in this build.');
 }));
 btn('discard')?.addEventListener('click',()=>{clearReview();renderPlanner();report('Review discarded.');});
 btn('send')?.addEventListener('click',()=>void run(async(signal,epoch)=>{
  if(!SIGNING_ENABLED||!prepared||!selected||!provider)throw Error('No reviewed transaction');
  const p=prepared;clearReview();const execution=createConfidentialExecution({mode,wallet:selected,provider,journal:journal(),lock:lock()});
  const result=await execution.submit({intent:p.intent,payload:p.payload,approval:p.intent.id,signal});
  if(!current(epoch,signal))return;
  if(result&&'transactionHash' in result&&typeof result.transactionHash==='string')field<HTMLInputElement>('hash').value=result.transactionHash;
  report(result?.state==='HASH_RECEIVED'?'Transaction submitted. Verify its receipt before another action.':'Wallet outcome uncertain. Do not repeat; recover the transaction hash.');
 }));
 btn('reconcile')?.addEventListener('click',()=>void run(async(signal,epoch)=>{
  const j=journal(),exclusive=lock();const hash=field<HTMLInputElement>('hash').value.trim();
  await exclusive(async()=>{
   const p=j.read();if(!p)throw Error('No pending transaction');const readers=RESEARCH_DEBRIEF_RPC.map(url=>new JsonRpcProvider(url));
   try{
    const results=await Promise.all(readers.map(reader=>reconcileConfidentialAction(reader,p,hash,{signal})));
    if(!current(epoch,signal))return;
    if(results.some(r=>r.state==='UNCONFIRMED')){report('Receipt is not confirmed by both providers. No new action allowed.');return;}
    if(JSON.stringify(results[0])!==JSON.stringify(results[1]))throw Error('Provider disagreement');
    const verified=results[0];j.clearReconciled(verified);
    if(p.mode===mode){if('id' in verified&&verified.id)record.value=String(verified.id);clearReview();clearView();}
    report(verified.state==='CONFIRMED_REVERTED'?'Both providers confirmed the transaction reverted. Read current state before another action.':'Both providers reconciled the receipt. Read current state before another action.');
   }finally{readers.forEach(reader=>reader.destroy());}
  });
 }));
 function close(){detach();discovery?.close();discovery=null;cancel();walletSelect.replaceChildren(new Option('Choose wallet',''));record.value='';if(mode==='arena')field<HTMLInputElement>('defender').value='';field<HTMLInputElement>('hash').value='';panel.open=false;report('Choose a wallet to begin.');}
 new MutationObserver(()=>{if(overlay.hidden)close();}).observe(overlay,{attributes:true,attributeFilter:['hidden']});
 panel.addEventListener('toggle',()=>{if(panel.open){syncPending();renderActions();}else if(!overlay.hidden){clearReview();clearPlans();revision++;controller?.abort();controller=null;busy=false;}});
 renderActions();syncPending();
}
