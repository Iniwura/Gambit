import './greybox.css';
import {JsonRpcProvider,getAddress} from 'ethers';
import {createGameShell,transitionGameShell}
  from '../architecture/game-shell.mjs';
import {loadApprovedCommanderPublicHistory}
  from './public-history.mjs';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA as PIN}
  from './trusted-deployments.mjs';

/**
 * Phase 2: opt-in public RECORD viewer.
 * Not the final persistent Commander Profile / leaderboard.
 * No eth_requestAccounts, signer, transaction or browser storage.
 */
type VerifiedRow={
  duelId:string,transactionHash:string,blockNumber:number,
  challenger:string,defender:string,
  pointsChallenger:number,pointsDefender:number,outcome:number
};
type PublicView={
  status:string,wallet:string,matches:number,wins:number,losses:number,
  draws:number,pagesScanned:number,candidatesChecked:number,
  verifiedHistory:VerifiedRow[],fullHistoryObserved:boolean
};
type Loading={pagesScanned:number,candidatesChecked:number,playerRecordsVerified:number,
  completed:boolean,lastScannedBlock:number|null};
const RPC='https://ethereum-sepolia-rpc.publicnode.com';
function byId<T extends HTMLElement>(root:ParentNode,id:string):T{
  const element=root.querySelector<T>('#'+id);
  if(!element)throw Error('Commander public reader control missing: '+id);
  return element;
}
function setText(root:ParentNode,id:string,value:string){
  byId<HTMLElement>(root,id).textContent=value;
}
export function mountCommanderPublicViewer():void{
  if(document.getElementById('gambit-profile-open'))return;
  const launch=document.createElement('button');
  launch.id='gambit-profile-open';
  launch.type='button';
  launch.textContent='COMMANDER · PUBLIC RECORDS';
  launch.setAttribute('aria-haspopup','dialog');
  launch.setAttribute('aria-controls','gambit-profile-dialog');
  launch.setAttribute('aria-expanded','false');
  const mobileLaunch=launch.cloneNode(false) as HTMLButtonElement;
  mobileLaunch.id='gambit-profile-mobile-open';
  mobileLaunch.textContent='COMMANDER · PUBLIC RECORDS';
  const backdrop=document.createElement('div');
  backdrop.id='gambit-profile-overlay';
  backdrop.hidden=true;
  backdrop.dataset.phase='closed';
  backdrop.innerHTML=`
    <section id="gambit-profile-dialog" role="dialog" aria-modal="true"
      aria-labelledby="gambit-profile-heading" tabindex="-1">
      <header class="gp-head">
        <div><strong id="gambit-profile-heading">COMMANDER RECORDS</strong>
        <p>READ-ONLY ETHEREUM SEPOLIA · NO WALLET OR SIGNING</p></div>
        <button id="gambit-profile-close" type="button">RETURN TO ARENA</button>
      </header>
      <p>This viewer checks authentic GAMBIT match finalizations for one public
        wallet address. It does not create an account, connect a wallet or
        publish private fighter plans. Nothing is stored in this browser.</p>
      <form id="gambit-profile-form">
        <label for="gambit-profile-address">PUBLIC ETHEREUM ADDRESS</label>
        <input id="gambit-profile-address" type="text"
          inputmode="text" autocomplete="off" autocapitalize="off"
          spellcheck="false" placeholder="0x...40 hexadecimal characters"
          aria-describedby="gambit-profile-consent" maxlength="42" required/>
        <p id="gambit-profile-consent">Look up an address only if you intend to
          view its public match history. This reveals no private tactics.
          A single public RPC is not a full Ethereum light-client audit.</p>
        <button id="gambit-profile-submit" type="submit">VERIFY PUBLIC HISTORY</button>
      </form>
      <p id="gambit-profile-status" role="status" aria-live="polite">
        Enter a public address to begin a read-only lookup.</p>
      <section id="gambit-profile-results" hidden>
        <p id="gambit-profile-scan-status"></p>
        <div class="gp-stat-row">
          <div><span>VERIFIED MATCHES</span><strong id="gambit-profile-matches">0</strong></div>
          <div><span>WINS</span><strong id="gambit-profile-wins">0</strong></div>
          <div><span>LOSSES</span><strong id="gambit-profile-losses">0</strong></div>
          <div><span>DRAWS</span><strong id="gambit-profile-draws">0</strong></div>
        </div>
        <h2>AUTHENTICATED FINALIZATIONS</h2>
        <ol id="gambit-profile-history"></ol>
        <p id="gambit-profile-empty" hidden>No matching finalized matches found
          in the confirmed log range scanned by this RPC.</p>
      </section>
      <p class="gp-boundary">NOT A PERSISTENT COMMANDER PROFILE OR RANKING.
        History is reverified on each request. No achievements are inferred
        from local TRAINING or BLACKSITE missions.</p>
    </section>`;
  document.body.append(launch,backdrop);
  const mobileHead=document.querySelector('#gambit-blacksite-mobile-open');
  if(mobileHead)mobileHead.after(mobileLaunch);
  else document.querySelector('#gambit-mobile-deck .gambit-mobile-head')
    ?.after(mobileLaunch);
  const form=byId<HTMLFormElement>(backdrop,'gambit-profile-form');
  const address=byId<HTMLInputElement>(backdrop,'gambit-profile-address');
  const submit=byId<HTMLButtonElement>(backdrop,'gambit-profile-submit');
  const dialog=byId<HTMLElement>(backdrop,'gambit-profile-dialog');
  const results=byId<HTMLElement>(backdrop,'gambit-profile-results');
  const history=byId<HTMLOListElement>(backdrop,'gambit-profile-history');
  let shell=createGameShell();
  let epoch=0;
  let controller:AbortController|null=null;
  let provider:JsonRpcProvider|null=null;
  let focusBefore:HTMLElement|null=null;
  let priorInert:Array<{element:HTMLElement,inert:boolean}>=[];
  const setPhase=(phase:string,message:string)=>{
    backdrop.dataset.phase=phase;
    setText(backdrop,'gambit-profile-status',message);
  };
  function reset(){
    results.hidden=true;
    history.replaceChildren();
    setText(backdrop,'gambit-profile-scan-status','');
    setPhase('ready','Enter a public address to begin a read-only lookup.');
  }
  function stop(){
    epoch++;
    controller?.abort();
    controller=null;
    provider?.destroy();
    provider=null;
    submit.disabled=false;
  }
  function close(){
    if(backdrop.hidden)return;
    stop();
    backdrop.hidden=true;
    backdrop.dataset.phase='closed';
    shell=transitionGameShell(shell,{type:'BACK'});
    backdrop.dataset.scene=shell.scene;
    delete document.body.dataset.gambitFeatureOverlay;
    launch.setAttribute('aria-expanded','false');
    mobileLaunch.setAttribute('aria-expanded','false');
    for(const {element,inert} of priorInert)element.inert=inert;
    priorInert=[];
    address.value=''; // do not retain wallet addresses after closing
    reset();
    (focusBefore?.isConnected?focusBefore:launch)?.focus();
  }
  function open(){
    if(!backdrop.hidden)return;
    if(document.body.dataset.gambitFeatureOverlay||
       document.getElementById('gambit-squad-dialog')?.hidden===false||
       document.getElementById('gambit-chain-dialog')?.hidden===false)
      return;
    focusBefore=document.activeElement instanceof HTMLElement?
      document.activeElement:null;
    shell=transitionGameShell(shell,{type:'OPEN',scene:'profile-readonly'});
    backdrop.dataset.scene=shell.scene;
    priorInert=[];
    for(const id of ['app','gambit-mobile-deck','gambit-squad-launch',
      'gambit-chain-launch','gambit-blacksite-open']){
      const el=document.getElementById(id);
      if(el instanceof HTMLElement){
        priorInert.push({element:el,inert:el.inert});
        el.inert=true;
      }
    }
    backdrop.hidden=false;
    document.body.dataset.gambitFeatureOverlay='profile';
    launch.setAttribute('aria-expanded','true');
    mobileLaunch.setAttribute('aria-expanded','true');
    reset();
    address.focus();
  }
  function display(view:PublicView){
    results.hidden=false;
    setText(backdrop,'gambit-profile-matches',String(view.matches));
    setText(backdrop,'gambit-profile-wins',String(view.wins));
    setText(backdrop,'gambit-profile-losses',String(view.losses));
    setText(backdrop,'gambit-profile-draws',String(view.draws));
    setText(backdrop,'gambit-profile-scan-status',
      (view.fullHistoryObserved?
       'Complete scan of this RPC’s confirmed deployment logs.':
       'PARTIAL scan only. More older/newer matches may exist.')+
       ' '+view.pagesScanned+' pages scanned; '+view.candidatesChecked+
       ' candidate finalizations independently verified.');
    history.replaceChildren();
    for(const event of view.verifiedHistory){
      const li=document.createElement('li');
      const score=document.createElement('strong');
      score.textContent='Duel #'+event.duelId+' · '+
        event.pointsChallenger+' : '+event.pointsDefender;
      const link=document.createElement('a');
      link.textContent='View verified transaction';
      link.href='https://sepolia.etherscan.io/tx/'+event.transactionHash;
      link.rel='noopener noreferrer';
      link.target='_blank';
      li.append(score,link);
      history.append(li);
    }
    byId<HTMLElement>(backdrop,'gambit-profile-empty').hidden=
      view.matches!==0;
  }
  async function inspect(){
    stop();
    reset();
    let wallet:string;
    try{wallet=getAddress(address.value.trim());}
    catch{
      setPhase('invalid','Enter a valid 0x Ethereum wallet address (40 hexadecimal characters).');
      return;
    }
    const myEpoch=epoch;
    const signalController=new AbortController();
    controller=signalController;
    provider=new JsonRpcProvider(RPC,PIN.chainId,{staticNetwork:true});
    const readProvider=provider;
    submit.disabled=true;
    setPhase('loading','Checking the approved contract and canonical Sepolia logs…');
    try{
      const view=await loadApprovedCommanderPublicHistory(readProvider,wallet,{
        signal:signalController.signal,maxPages:12,
        onProgress:(progress:Loading)=>{
          if(epoch!==myEpoch||backdrop.hidden)return;
          setText(backdrop,'gambit-profile-status',
            'Read-only scan: '+progress.pagesScanned+' pages · '+
            progress.candidatesChecked+' candidate receipts checked · '+
            progress.playerRecordsVerified+' verified for the selected wallet.');
        }
      }) as PublicView;
      if(epoch!==myEpoch||backdrop.hidden)return;
      display(view);
      setPhase(view.fullHistoryObserved?'verified':'partial',
        view.fullHistoryObserved?
          'Verified public results from the approved contract.':
          'Partial history only. The confirmed scan was incomplete; totals are lower bounds.');
    }catch(error){
      if(epoch!==myEpoch||backdrop.hidden)return;
      results.hidden=true;
      const reason=error instanceof Error?error.message:'Unexpected public RPC error';
      setPhase('error','Verification unavailable. No win or empty profile has been claimed. '+reason);
    }finally{
      if(epoch===myEpoch){
        submit.disabled=false;
        controller=null;
        provider=null;
      }
      readProvider.destroy();
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    void inspect();
  });
  byId<HTMLButtonElement>(backdrop,'gambit-profile-close')
    .addEventListener('click',close);
  launch.addEventListener('click',open);
  mobileLaunch.addEventListener('click',open);
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if(event.key!=='Tab')return;
    const tabbables=Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),a[href]'))
      .filter(el=>el.offsetParent!==null);
    if(!tabbables.length)return;
    const first=tabbables[0],last=tabbables.at(-1)!;
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  });
}
