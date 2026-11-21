import {createSquadSepoliaClient,type FighterPlan,type SquadResult} from './squad-sepolia';
import {readVerifiedSquadPublic} from './squad-public-reader';
import {squadInvitationLink,squadPublicResultLink} from './squad-links.mjs';
import {discoverInjectedWallets} from './wallet-discovery.mjs';

type Client=Awaited<ReturnType<typeof createSquadSepoliaClient>>;
type SquadDraft={plans:FighterPlan[],formation:number};
type Action=()=>Promise<void>;

/**
 * Versioned v2 experimental wallet controls. They mount ONLY with BOTH a
 * Sepolia address and deployed-runtime fingerprint. No mock or fallback
 * onchain receipts. No automatic wallet connection or signatures.
 */
export function mountSquadSepoliaPanel(
  address:string,hash:string,readDraft:()=>SquadDraft,
  onVerified?:(result:SquadResult)=>void
){
  if(document.getElementById('gambit-squad-launch'))return;
  if(!/^0x[a-fA-F0-9]{40}$/.test(address)||!/^0x[a-fA-F0-9]{64}$/.test(hash))return;
  let client:Client|null=null;
  let busy=false;
  let lastResult:SquadResult|null=null;
  // Browser extensions can race to own window.ethereum. Select the explicit
  // EIP-6963 provider and keep it pinned for the whole match session.
  const walletDiscovery=discoverInjectedWallets(window);
  let connectedProvider:{
    request:(args:{method:string,params?:unknown[]})=>Promise<unknown>;
    on?:(type:string,callback:(value:unknown)=>void)=>void;
    removeListener?:(type:string,callback:(value:unknown)=>void)=>void
  }|null=null;
  let currentWalletListener:((value:unknown)=>void)|null=null;

  const button=(label:string,id:string,fn:Action):HTMLButtonElement=>{
    const node=document.createElement('button');
    node.type='button';node.id=id;node.textContent=label;
    node.addEventListener('click',()=>{
      if(busy)return;
      setBusy(true);
      // Call directly within the user gesture. Wallet extensions may reject
      // delayed account requests after a synthetic/microtask-only click.
      try{
        Promise.resolve(fn()).catch(error=>{
          setStatus('Cannot continue: '+(error instanceof Error?error.message:String(error)));
        }).finally(()=>setBusy(false));
      }catch(error){
        setStatus('Cannot continue: '+(error instanceof Error?error.message:String(error)));
        setBusy(false);
      }
    });
    node.style.cssText='width:100%;min-height:45px;margin-top:8px;border:1px solid #4f748c;' +
      'border-radius:9px;background:#193e59;color:#e9f8ff;padding:10px 12px;font:650 13px system-ui';
    return node;
  };
  const textbox=(label:string,id:string,placeholder:string)=>{
    const wrap=document.createElement('label');
    wrap.textContent=label;wrap.htmlFor=id;wrap.style.cssText='display:block;margin-top:13px;font:650 12px system-ui';
    const input=document.createElement('input');
    input.type='text';input.id=id;input.placeholder=placeholder;input.autocomplete='off';
    input.style.cssText='width:100%;margin-top:6px;min-height:44px;border:1px solid #52758e;' +
      'border-radius:9px;background:#0a1425;color:white;padding:10px;font:13px system-ui';
    return {wrap,input};
  };
  const positiveId=(value:string,label:string):bigint=>{
    if(!/^[1-9][0-9]*$/.test(value.trim()))throw Error(label+' must be a positive integer.');
    return BigInt(value.trim());
  };
  const launch=document.createElement('button');
  launch.id='gambit-squad-launch';launch.type='button';
  launch.setAttribute('aria-haspopup','dialog');
  launch.textContent='ENCRYPTED SQUAD LAB';
  launch.style.cssText='position:fixed;top:9px;right:12px;z-index:10010;border-radius:10px;' +
    'border:1px solid #ffbd69;background:#2a3043;color:#fff;padding:10px 14px;font:750 12px system-ui';
  const mobileLaunch=document.createElement('button');
  mobileLaunch.type='button';mobileLaunch.id='gambit-squad-mobile-launch';
  mobileLaunch.className='gambit-mobile-chain-launch';
  mobileLaunch.textContent='ENCRYPTED';
  mobileLaunch.setAttribute('aria-haspopup','dialog');
  document.querySelector('#gambit-mobile-deck .gambit-mobile-head')?.append(mobileLaunch);

  const dialog=document.createElement('section');
  dialog.id='gambit-squad-dialog';dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','gambit-squad-title');
  dialog.hidden=true;
  dialog.style.cssText='position:fixed;inset:0;z-index:10014;background:#020713ec;' +
    'display:none;align-items:center;justify-content:center;padding:12px';
  const card=document.createElement('section');
  card.style.cssText='width:min(560px,100%);max-height:92dvh;overflow-y:auto;background:#0e1c2e;' +
    'border:1px solid #6887a7;border-radius:16px;padding:20px;color:#ecf7ff;' +
    'box-shadow:0 24px 80px #000b;font:14px/1.45 system-ui';
  const heading=document.createElement('header');
  heading.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';
  const title=document.createElement('h2');
  title.id='gambit-squad-title';title.textContent='Encrypted Squad · Sepolia';
  title.style.cssText='margin:0;font-size:22px;letter-spacing:-.02em';
  const close=document.createElement('button');
  close.type='button';close.textContent='Close';
  close.style.cssText='padding:8px 12px;border:1px solid #647a95;border-radius:8px;' +
    'background:#17253c;color:#fff';
  heading.append(title,close);
  const caution=document.createElement('p');
  caution.textContent='EXPERIMENTAL 3v3 encrypted duel. Ten private inputs per squad. '+
    'Invite exactly one other Sepolia wallet. Every transaction requires a separate wallet signature. '+
    'The signed public result reveals ONLY total scores, never individual fighter outcomes.';
  caution.style.cssText='color:#bbd2e3;font-size:12px';
  const identity=document.createElement('p');identity.textContent='Wallet not connected';
  identity.style.cssText='color:#91ecf8;font-size:12px;overflow-wrap:anywhere';
  const status=document.createElement('p');status.id='gambit-squad-status';status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');status.textContent='Choose a wallet and connect. No transaction is needed.';
  status.style.cssText='padding:11px;background:#192e46;border:1px solid #426985;' +
    'border-radius:8px;overflow-wrap:anywhere;margin:9px 0 14px';
  const walletLabel=document.createElement('label');
  walletLabel.htmlFor='gambit-squad-wallet-choice';
  walletLabel.textContent='Browser wallet';
  walletLabel.style.cssText='display:block;margin:10px 0 5px;font:650 12px system-ui';
  const walletChoice=document.createElement('select');
  walletChoice.id='gambit-squad-wallet-choice';
  walletChoice.setAttribute('aria-label','Select an Ethereum browser wallet');
  walletChoice.style.cssText='width:100%;min-height:44px;border:1px solid #52758e;' +
    'border-radius:8px;background:#101b2e;color:white;padding:8px 10px';
  const syncWalletChoices=()=>{
    const previous=walletChoice.value;
    const entries=walletDiscovery.list();
    walletChoice.replaceChildren();
    if(!entries.length){
      const option=document.createElement('option');
      option.value='';option.textContent='No Ethereum wallet detected';
      walletChoice.append(option);
      return;
    }
    for(const entry of entries){
      const option=document.createElement('option');
      option.value=entry.id;option.textContent=entry.label;
      walletChoice.append(option);
    }
    const selected=entries.find(x=>x.id===previous)||
      entries.find(x=>/metamask/i.test(x.label))||entries[0];
    walletChoice.value=selected.id;
  };
  walletDiscovery.subscribe(syncWalletChoices);
  walletDiscovery.refresh();
  syncWalletChoices();
  const result=document.createElement('p');result.id='gambit-squad-receipt';
  result.style.cssText='font-size:13px;color:#cfedff;overflow-wrap:anywhere';

  const invited=textbox('Invite this challenger wallet','gambit-squad-invite','0x... different address');
  const squad=textbox('Squad ID (seal, invite or recovery)','gambit-squad-id','e.g. 1');
  const duel=textbox('Duel ID (submit, resolve or continue)','gambit-duel-id','e.g. 1');
  const invitedId=new URLSearchParams(window.location.search).get('squad');
  const isInvitedLink=Boolean(invitedId&&/^[1-9][0-9]{0,77}$/.test(invitedId));
  if(isInvitedLink&&invitedId)squad.input.value=invitedId;
  // An invite URL is a CHALLENGER journey. Avoid displaying the owner's
  // create-a-new-squad actions or asking the challenger for the owner address.
  if(isInvitedLink){
    title.textContent='Encrypted Squad · Invitation';
    caution.textContent='Accept the one-use encrypted invitation as the invited wallet. '+
      'Opening starts a 24-hour deadline for your encrypted squad submission. '+
      'No transaction happens until you explicitly approve it in your wallet.';
    invited.wrap.hidden=true;invited.wrap.style.display='none';invited.input.hidden=true;
    squad.wrap.textContent='Invited Squad ID';
  }
  // A shared read-only result link can prefill the canonical duel ID. It
  // must never start RPC, connect a wallet, or present an unverified result.
  const publicId=new URLSearchParams(window.location.search).get('duel');
  if(publicId&&/^[1-9][0-9]{0,17}$/.test(publicId))duel.input.value=publicId;

  function requireClient():Client{if(!client)throw Error('Connect and verify Sepolia wallet first.');return client;}
  function setStatus(message:string){
    status.textContent=message;
    // Connection errors must be visible beside the Connect control, not
    // hidden a full panel-scroll below it as before.
    status.scrollIntoView({block:'nearest'});
  }
  async function copyOrDisplay(label:string,url:string){
    try{
      await navigator.clipboard.writeText(url);
      setStatus(label+' copied. The link contains only the public chain ID.');
    }catch{
      setStatus('Copy '+label+' manually: '+url);
    }
  }
  function setBusy(value:boolean){
    busy=value;
    for(const item of allActions)item.disabled=value;
    close.disabled=value;launch.disabled=value;mobileLaunch.disabled=value;
    shareResult.disabled=value||!lastResult;
  }
  const invalidate=()=>{
    client=null;lastResult=null;watch.disabled=true;shareResult.disabled=true;
    identity.textContent='Wallet changed. Reconnect required.';
    setStatus('Wallet account, extension or network changed. Reconnect before any action.');
  };
  const unbindWallet=()=>{
    if(connectedProvider&&currentWalletListener){
      connectedProvider.removeListener?.('accountsChanged',currentWalletListener);
      connectedProvider.removeListener?.('chainChanged',currentWalletListener);
    }
    connectedProvider=null;currentWalletListener=null;
  };
  walletChoice.addEventListener('change',()=>{
    unbindWallet();
    invalidate();
  });
  const connect=button('1 · Connect + verify deployed contract','gambit-squad-connect',async()=>{
    walletDiscovery.refresh();
    syncWalletChoices();
    const selected=walletDiscovery.list().find(x=>x.id===walletChoice.value);
    if(!selected)throw Error('No Ethereum wallet found. Unlock MetaMask, refresh the page and try again.');
    setStatus('Connecting to '+selected.label+'… Check the wallet extension popup if prompted.');
    // Do not replace the previous connection on a failed attempt.
    const next=await createSquadSepoliaClient(address,hash,selected.provider);
    unbindWallet();
    const provider=selected.provider;
    connectedProvider=provider;
    currentWalletListener=invalidate;
    provider.on?.('accountsChanged',currentWalletListener);
    provider.on?.('chainChanged',currentWalletListener);
    client=next;
    identity.textContent='Connected '+next.userAddress+' · Ethereum Sepolia · '+selected.label;
    lastResult=null;
    if(isInvitedLink){
      const id=positiveId(squad.input.value,'Invited squad ID');
      const state=await next.readSquad(id);
      if(state.allowedOpponent.toLowerCase()!==next.userAddress.toLowerCase()){
        setStatus('Wallet and contract verified, but this wallet is not the invited challenger. No transaction sent.');
      }else if(state.claimed){
        // A consumed one-use invite may have been opened just before a
        // stale wallet RPC produced a false "recovery mismatch". Recover
        // the canonical duel via a READ-ONLY call; never prompt to reopen.
        try{
          const recovered=await next.recoverDuelId(id);
          if(recovered===null)
            setStatus('Squad #'+id+' is already claimed. The RPC may be behind. '+
              'Do not open again; inspect the opening transaction and recover the duel ID.');
          else{
            duel.input.value=String(recovered);
            setStatus('Duel #'+recovered+' was already opened onchain for Squad #'+id+
              '. Do NOT open again. You can prepare encrypted plans; submitting requires a separate approval.');
          }
        }catch{
          setStatus('Squad #'+id+' is already claimed. Read-only recovery is temporarily inconsistent. '+
            'Do not open again; check the transaction receipt before any further action.');
        }
      }else if(!state.active){
        setStatus('Squad #'+id+' is inactive. No transaction sent.');
      }else{
        setStatus('Verified: this wallet is invited to Squad #'+id+'. '+
          'Opening consumes the invitation and starts a 24-hour submission deadline. No transaction sent.');
      }
    }else{
      setStatus('Wallet connected and SquadGambit contract fingerprint verified. No transaction sent.');
    }
  });
  const seal=button('2 · Encrypt and seal my three fighter plans','gambit-squad-seal',async()=>{
    const c=requireClient();
    const draft=readDraft(); // Snapshot at user click, never a stale signed tactic.
    setStatus('Preparing ten encrypted Zama inputs. Confirm sealing in your wallet.');
    const x=await c.sealSquad(invited.input.value,draft.plans,draft.formation);
    squad.input.value=String(x.squadId);
    setStatus('Squad #'+x.squadId+' sealed. Tx: '+x.transactionHash);
  });
  const shareInvite=button('Copy squad invitation link','gambit-squad-share-invite',async()=>{
    const c=requireClient(),id=positiveId(squad.input.value,'Squad ID');
    // No unverified invitations: validate actual onchain ownership and
    // one-use availability before presenting the shareable public ID.
    const state=await c.readSquad(id);
    if(state.owner!==c.userAddress||!state.active||state.claimed)
      throw Error('Only the owner can share an active, unused Sepolia squad.');
    await copyOrDisplay('Squad invitation link',squadInvitationLink(window.location.href,id));
  });
  const open=button(isInvitedLink?'Open invited squad · 1 transaction':
    '3 · Open invitation as challenger','gambit-squad-open',async()=>{
    const c=requireClient(),s=positiveId(squad.input.value,'Squad ID');
    setStatus('Checking one-use invitation and capped gas quote. '+
      'Your wallet must separately approve this Sepolia transaction.');
    const x=await c.openDuel(s);
    duel.input.value=String(x.duelId);
    setStatus(x.canonicalStateVerified
      ?'Duel #'+x.duelId+' confirmed onchain. Tx: '+x.transactionHash+
        '. Prepare and separately authorize encrypted submission within 24 hours. DO NOT reopen.'
      :'Duel #'+x.duelId+' has a successful receipt and authenticated DuelOpened event. Tx: '+
        x.transactionHash+'. Wallet RPC state is lagging: DO NOT retry. Use read-only recovery or inspect Etherscan.');
  });
  const openExplainer=document.createElement('p');
  openExplainer.id='gambit-squad-open-details';
  openExplainer.textContent='One-use invitation · maximum transaction fee 200,000,000 Sepolia wei '+
    '(0.0000000002 ETH). You must approve the wallet prompt. '+
    'No auto-retries or follow-up transactions.';
  openExplainer.style.cssText='font:12px/1.5 system-ui;color:#aec5da;margin:7px 0 9px';
  const recover=button('Recover duel from squad ID (read only)','gambit-squad-recover',async()=>{
    const c=requireClient(),s=positiveId(squad.input.value,'Squad ID');
    const id=await c.recoverDuelId(s);
    if(id===null){setStatus('No duel has been opened for squad #'+s+'.');return;}
    duel.input.value=String(id);
    setStatus('Recovered duel #'+id+' from canonical squad contract state.');
  });
  const publicInspect=button('View finalized score · no wallet','gambit-squad-public-inspect',async()=>{
    const id=positiveId(duel.input.value,'Duel ID');
    setStatus('Checking public Sepolia chain ID, exact contract runtime and finalized duel state…');
    const verified=await readVerifiedSquadPublic(id,address,hash);
    squad.input.value=String(verified.squadId);
    showResult(verified);
  });
  const inspect=button('Inspect duel stage (read only)','gambit-squad-inspect',async()=>{
    const c=requireClient(),id=positiveId(duel.input.value,'Duel ID');
    const x=await c.nextDuelStep(id);
    setStatus('Duel #'+id+' is '+x.step.toUpperCase()+
      '. State is read from Sepolia, not local memory.');
    if(x.step==='verified')showResult(await c.verifiedResult(id));
  });
  const submit=button('4 · Encrypt and submit my squad','gambit-squad-submit',async()=>{
    const c=requireClient(),id=positiveId(duel.input.value,'Duel ID');
    const draft=readDraft();
    setStatus('Encrypting ten inputs. Confirm submission in your wallet.');
    const x=await c.submitDuel(id,draft.plans,draft.formation);
    setStatus('Duel #'+id+' submitted onchain. Tx: '+x.transactionHash);
  });
  const resolve=button('5 · Resolve encrypted match (one transaction)','gambit-squad-resolve',async()=>{
    const c=requireClient(),id=positiveId(duel.input.value,'Duel ID');
    setStatus('Confirm ONE resolution transaction in your wallet. '+
      'This does not authorize score finalization.');
    const x=await c.resolveDuel(id);
    setStatus('Duel #'+id+' resolved. Tx: '+x.transactionHash+
      '. Finalizing the KMS-signed score requires a separate action.');
  });
  const finalize=button('6 · Verify KMS score + finalize (one transaction)','gambit-squad-finalize',async()=>{
    const c=requireClient(),id=positiveId(duel.input.value,'Duel ID');
    setStatus('Fetching the public KMS proof. Confirm ONE finalization transaction '+
      'in your wallet after proof verification.');
    showResult(await c.finalizeDuel(id));
  });
  const watch=document.createElement('button');watch.id='gambit-squad-watch';
  watch.type='button';watch.textContent='VIEW AUTHENTICATED REACTOR RESULT';
  watch.hidden=!onVerified;watch.disabled=true;
  watch.style.cssText='width:100%;min-height:46px;margin-top:12px;background:#1e5c6b;' +
    'color:#fff;border:1px solid #79e9ed;border-radius:9px;font:750 13px system-ui';
  watch.addEventListener('click',()=>{
    if(busy||!lastResult||!onVerified)return;
    dialog.hidden=true;setVisibility();
    onVerified(lastResult);
  });
  const shareResult=button('Copy public verified result link','gambit-squad-share-result',async()=>{
    if(!lastResult)throw Error('A real finalized onchain score must be verified before sharing.');
    await copyOrDisplay('Verified score link',
      squadPublicResultLink(window.location.href,lastResult.duelId));
  });
  shareResult.disabled=true;
  const allActions=[connect,seal,shareInvite,open,recover,publicInspect,inspect,submit,resolve,finalize,shareResult];
  function showResult(proof:SquadResult){
    if(proof.authenticated!==true)throw Error('Unauthenticated result rejected.');
    lastResult=proof;
    watch.disabled=false;shareResult.disabled=false;
    setStatus('Signed public result finalized on Sepolia. Only aggregate totals are visible.');
    result.replaceChildren();
    const label=document.createElement('strong');
    label.textContent='CYAN '+proof.pointsChallenger+' : '+proof.pointsDefender+
      ' VIOLET · '+(proof.outcome===1?'CYAN WINS':proof.outcome===2?'VIOLET WINS':'DRAW');
    const anchor=document.createElement('a');
    anchor.href=proof.explorerUrl;anchor.target='_blank';anchor.rel='noopener noreferrer';
    anchor.textContent='View independently inspectable Sepolia evidence';
    anchor.style.cssText='display:block;color:#7de7f4;margin-top:8px';
    result.append(label,anchor);
  }

  // Keep the most important status and wallet choice within view when the
  // user clicks Connect. The same live status receives every later error.
  if(isInvitedLink){
    seal.hidden=true;
    shareInvite.hidden=true;
  }
  card.append(heading,caution,identity,walletLabel,walletChoice,connect,status,
    invited.wrap,invited.input,seal,squad.wrap,squad.input,
    shareInvite,open,openExplainer,recover,duel.wrap,duel.input,
    publicInspect,inspect,submit,resolve,finalize,result,shareResult,watch);
  dialog.append(card);document.body.append(launch,dialog);
  const setVisibility=()=>{dialog.style.display=dialog.hidden?'none':'flex';};
  const openDialog=()=>{if(busy)return;dialog.hidden=false;setVisibility();close.focus();};
  launch.addEventListener('click',openDialog);
  mobileLaunch.addEventListener('click',openDialog);
  close.addEventListener('click',()=>{if(busy)return;dialog.hidden=true;setVisibility();});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!busy&&dialog.hidden===false){dialog.hidden=true;setVisibility();}
  });
  setVisibility();

  // The selected provider (not whichever extension wins window.ethereum)
  // is the only source of wallet identity and change notifications.
}
