import {JsonRpcProvider} from 'ethers';
import {loadResearchDebrief,RESEARCH_DEBRIEF_RPC} from './research-debrief.mjs';
import {requirePlayableCapability} from './release-capabilities.mjs';

type Mode='arena'|'blacksite';
type Base={blocks:readonly {number:number,hash:string}[]};
type Arena=Base&{mode:'arena',challenger:number,defender:number,rows:readonly {round:number,challenger:number,defender:number}[]};
type Blacksite=Base&{mode:'blacksite',status:string,score:number,heat:number,rows:readonly {attempt:number,route:string,exact:number,misplaced:number|null}[]};
type Result=Arena|Blacksite;

/** An explicit opt-in, read-only debrief inside each existing game overlay.
 * Closing the parent aborts the lookup and clears all displayed evidence.
 * No injected wallet, private handles, rewards, or automatic calls on mount.
 */
export function mountResearchDebriefs(){
 for(const mode of ['arena','blacksite'] as const)mount(mode);
}
function mount(mode:Mode){
 const prefix=mode==='arena'?'gambit-arena-hotseat':'gambit-blacksite';
 const overlay=document.getElementById(prefix+'-overlay');
 const host=document.getElementById(prefix+'-dialog');
 if(!overlay||!host||document.getElementById(prefix+'-research-debrief'))return;
 const section=document.createElement('section');
 section.id=prefix+'-research-debrief';
 section.setAttribute('aria-label',mode==='arena'?'Confidential Arena V4 debrief':'Confidential BLACKSITE debrief');
 const title=document.createElement('h2');
 title.textContent=mode==='arena'?'Arena V4 · Live match debrief':'BLACKSITE · Live mission debrief';
 const boundary=document.createElement('p');
 boundary.textContent='Read-only research run on Sepolia. No wallet, gameplay transaction or rewards.';
 const button=document.createElement('button');
 button.type='button';button.textContent='VERIFY LIVE '+(mode==='arena'?'MATCH':'MISSION')+' #1';
 const status=document.createElement('p');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const details=document.createElement('ol');
 section.append(title,boundary,button,status,details);
 host.append(section);
 let generation=0,controller:AbortController|null=null,providers:JsonRpcProvider[]=[];
 function stop(){
  generation++;controller?.abort();controller=null;
  for(const provider of providers)provider.destroy();
  providers=[];button.disabled=false;
 }
 function reset(){stop();details.replaceChildren();status.textContent='';}
 new MutationObserver(()=>{if(overlay.hidden)reset();}).observe(overlay,{attributes:true,attributeFilter:['hidden']});
 button.addEventListener('click',async()=>{
  if(overlay.hidden||button.disabled)return;
  requirePlayableCapability(mode==='arena'?'arena-v4-debrief':'blacksite-neutral-debrief');
  stop();const run=generation;controller=new AbortController();
  const signal=controller.signal;
  details.replaceChildren();button.disabled=true;
  status.textContent='Checking both public RPC providers…';
  const timeout=window.setTimeout(()=>{if(run===generation){stop();status.textContent='Verification timed out. Select verify to try again.';}},25000);
  try{
   providers=RESEARCH_DEBRIEF_RPC.map(url=>new JsonRpcProvider(url));
   const result=await loadResearchDebrief(mode,providers,{signal}) as Result;
   if(signal.aborted||run!==generation||overlay.hidden)return;
   const lines=result.mode==='arena'
    ? [`Final score: ${result.challenger} – ${result.defender}`,...result.rows.map(r=>`Round ${r.round}: ${r.challenger} – ${r.defender}`)]
    : [`${result.status} · score ${result.score} · heat ${result.heat}`,...result.rows.map(r=>`Attempt ${r.attempt}: ${r.route} · ${r.exact} exact${r.misplaced===null?'':', '+r.misplaced+' misplaced'}`)];
   lines.push('Verified at blocks '+result.blocks.map(b=>b.number).join(' / ')+'.');
   details.replaceChildren(...lines.map(line=>{const item=document.createElement('li');item.textContent=line;return item;}));
   status.textContent='Both providers agree on the finalized public state.';
  }catch{
   if(run===generation&&!signal.aborted&&!overlay.hidden)status.textContent='Unable to corroborate public state. No result shown. Select verify to retry.';
  }finally{
   window.clearTimeout(timeout);
   if(run===generation)stop();
  }
 });
}
