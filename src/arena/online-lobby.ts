import {BrowserProvider} from 'ethers';
import {discoverInjectedWallets} from '../chain/wallet-discovery.mjs';
import {arenaV3ReadOnlyWallet,readArenaV3SelectedAccount} from './fhe-preparation.mjs';
import {recoverArenaV3Invitation} from './invitation.mjs';

/**
 * A reviewed release must replace this null with the actual audited,
 * round-bound v3 deployment record. NEVER resolve a manifest from URL,
 * wallet metadata, user input, localStorage or a Vite environment variable.
 */
type Manifest={contract:'ArenaV3Research',version:1,chainId:11155111,
  address:string,runtimeHash:string};
function approvedDeployment():Manifest|null{return null;}
type Wallet={request:(args:{method:string,params?:unknown})=>Promise<unknown>,
  on?:(event:string,fn:()=>void)=>unknown,
  removeListener?:(event:string,fn:()=>void)=>unknown};

export function mountArenaV3Lobby(root:HTMLElement){
  const details=document.createElement('details');
  details.id='gambit-arena-online-lobby';
  details.innerHTML=[
    '<summary>ONLINE ARENA · WALLET & INVITATION</summary>',
    '<p id="gambit-arena-online-deployment">NOT DEPLOYED · Live Arena v3 is locked.</p>',
    '<label for="gambit-arena-online-wallet">Browser wallet</label>',
    '<select id="gambit-arena-online-wallet"><option value="">Choose wallet</option></select>',
    '<button type="button" id="gambit-arena-online-refresh">FIND WALLETS</button>',
    '<button type="button" id="gambit-arena-online-inspect" disabled>CHECK ACCOUNT</button>',
    '<p id="gambit-arena-online-status" role="status" aria-live="polite">Choose a wallet to check its already authorized Sepolia account. No permission or signature request.</p>',
    '<label for="gambit-arena-online-invite">Invitation token</label>',
    '<input id="gambit-arena-online-invite" type="text" autocomplete="off" spellcheck="false" maxlength="76" disabled>',
    '<button type="button" id="gambit-arena-online-recover" disabled>RECOVER MATCH</button>',
    '<section id="gambit-arena-online-match" aria-live="polite" hidden></section>'
  ].join('');
  root.append(details);
  function get<T extends HTMLElement>(id:string):T{
    const el=details.querySelector<T>('#gambit-arena-online-'+id);
    if(!el)throw Error('Arena lobby control unavailable');return el;
  }
  const select=get<HTMLSelectElement>('wallet'),inspect=get<HTMLButtonElement>('inspect');
  const invite=get<HTMLInputElement>('invite'),recover=get<HTMLButtonElement>('recover');
  const output=get<HTMLElement>('match'),status=get<HTMLElement>('status');
  const manifest=approvedDeployment();
  let discovery:ReturnType<typeof discoverInjectedWallets>|null=null;
  let selected:Wallet|null=null,actor:string|null=null,revision=0;
  let controller:AbortController|null=null;
  function invalidate(message:string){
    revision++;controller?.abort();controller=null;actor=null;
    invite.disabled=true;recover.disabled=true;output.hidden=true;output.replaceChildren();
    status.textContent=message;inspect.disabled=!selected;
  }
  const changed=()=>invalidate('Wallet account or network changed. Check the selected wallet again.');
  function detach(){
    selected?.removeListener?.('accountsChanged',changed);
    selected?.removeListener?.('chainChanged',changed);
    selected?.removeListener?.('disconnect',changed);
    selected=null;
  }
  function setWallet(){
    detach();selected=discovery?.list().find(w=>w.id===select.value)?.provider??null;
    invalidate(selected?'Check the selected wallet’s existing authorization.':'Choose a browser wallet.');
    selected?.on?.('accountsChanged',changed);
    selected?.on?.('chainChanged',changed);
    selected?.on?.('disconnect',changed);
  }
  function renderWallets(){
    const previous=select.value;
    select.replaceChildren();
    const empty=document.createElement('option');empty.value='';empty.textContent='Choose wallet';
    select.append(empty);
    for(const w of discovery?.list()??[]){
      const option=document.createElement('option');option.value=w.id;option.textContent=w.label;
      select.append(option);
    }
    if(Array.from(select.options).some(o=>o.value===previous))select.value=previous;
    else{select.value='';setWallet();}
  }
  function startDiscovery(){
    if(!discovery){
      discovery=discoverInjectedWallets(window);
      discovery.subscribe(renderWallets);
    }
    discovery.refresh();renderWallets();
    if(select.options.length===1)status.textContent='No injected browser wallet found.';
  }
  function stop(){
    detach();discovery?.close();discovery=null;select.replaceChildren();
    invite.value='';invalidate('Choose a wallet to check its existing authorization.');
    details.open=false;
  }
  details.addEventListener('toggle',()=>{if(details.open)startDiscovery();else stop();});
  get<HTMLButtonElement>('refresh').addEventListener('click',startDiscovery);
  select.addEventListener('change',setWallet);
  inspect.addEventListener('click',async()=>{
    if(!selected)return;
    const wallet=selected,id=++revision;
    controller?.abort();controller=new AbortController();
    const signal=controller.signal;
    inspect.disabled=true;actor=null;invite.disabled=true;recover.disabled=true;
    status.textContent='Checking wallet network and previously authorized account…';
    try{
      const account=await readArenaV3SelectedAccount(wallet,signal);
      if(id!==revision||signal.aborted)return;
      actor=account;
      status.textContent='Sepolia account: '+actor+
        (manifest?' · Ready to inspect a confirmed invitation.':' · No approved v3 deployment. Live actions locked.');
      invite.disabled=!manifest;recover.disabled=!manifest;
    }catch{
      if(id===revision&&!signal.aborted)
        status.textContent='No authorized Sepolia account. Connect to this site in your wallet and select Sepolia, then check again.';
    }finally{if(id===revision)inspect.disabled=!selected;}
  });
  recover.addEventListener('click',async()=>{
    if(!selected||!actor||!manifest)return;
    const wallet=selected,expected=actor,id=++revision;
    controller?.abort();controller=new AbortController();const signal=controller.signal;
    recover.disabled=true;output.hidden=true;output.replaceChildren();
    status.textContent='Checking confirmed creation receipt and current match…';
    try{
      if(await readArenaV3SelectedAccount(wallet,signal)!==expected)throw Error('account changed');
      const provider=new BrowserProvider(arenaV3ReadOnlyWallet(wallet) as any);
      const invitation=await recoverArenaV3Invitation(provider,manifest,invite.value,expected,{signal});
      if(await readArenaV3SelectedAccount(wallet,signal)!==expected)throw Error('account changed');
      if(id!==revision||signal.aborted)return;
      const heading=document.createElement('h2');heading.textContent='MATCH '+invitation.matchId;
      const info=document.createElement('p');
      info.textContent=invitation.seat+' · Round '+invitation.view.currentRound+' / 5 · '+
        invitation.view.status+' · '+invitation.view.cumulative.challenger+' : '+invitation.view.cumulative.defender;
      output.append(heading,info);output.hidden=false;
      status.textContent='Confirmed creation receipt and public match state. Wallet actions are not enabled.';
    }catch{
      if(id===revision&&!signal.aborted)status.textContent='Invitation could not be verified. No action was sent.';
    }finally{if(id===revision)recover.disabled=false;}
  });
  if(manifest)get<HTMLElement>('deployment').textContent='Pinned Sepolia deployment · read-only invitation recovery.';
  return {reset:stop};
}
