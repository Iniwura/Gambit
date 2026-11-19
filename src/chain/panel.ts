import {createGambitSepoliaClient,type Plan} from './sepolia';

type Client=Awaited<ReturnType<typeof createGambitSepoliaClient>>;
type Action=()=>Promise<void>;

function asPositiveId(raw:string,name:string):bigint{
  const s=raw.trim();
  if(!/^[1-9][0-9]*$/.test(s))throw Error(name+' must be a positive integer.');
  return BigInt(s);
}
function textNode(tag:'h2'|'p'|'label'|'div',content:string):HTMLElement{
  const e=document.createElement(tag);e.textContent=content;return e;
}

/**
 * Real, opt-in Sepolia controller. It is never mounted without a configured
 * contract address. No fake receipts or simulated wallet interactions.
 */
export function mountSepoliaPanel(address:string,getPlan:()=>Plan){
  if(document.getElementById('gambit-chain-launch'))return;
  if(!/^0x[a-fA-F0-9]{40}$/.test(address))return;

  let client:Client|null=null;
  let busy=false;
  let challengeId:bigint|null=null;
  function button(text:string,handler:Action,id:string):HTMLButtonElement{
    const b=document.createElement('button');
    b.type='button';b.id=id;b.textContent=text;
    b.addEventListener('click',()=>{
      if(busy)return;
      setBusy(true);
      Promise.resolve().then(handler).catch(error=>{
        setStatus('Action failed: '+(error instanceof Error?error.message:String(error)));
      }).finally(()=>setBusy(false));
    });
    return b;
  }
  const launch=document.createElement('button');
  launch.id='gambit-chain-launch';
  launch.textContent='SEPOLIA CHALLENGES';
  launch.type='button';
  launch.setAttribute('aria-haspopup','dialog');
  launch.style.cssText='position:fixed;top:9px;right:12px;z-index:10010;background:#142844;border:1px solid #58e4f3;border-radius:11px;color:white;padding:11px 17px;font-weight:750;cursor:pointer;';
  const overlay=document.createElement('section');
  overlay.id='gambit-chain-dialog';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','gambit-chain-title');
  overlay.hidden=true;
  overlay.style.cssText='position:fixed;inset:0;z-index:10011;background:#030712e8;display:flex;justify-content:center;align-items:center;padding:12px;';

  const card=document.createElement('div');
  card.style.cssText='width:min(550px,100%);max-height:94vh;overflow:auto;background:#101c33;border:1px solid #52729a;border-radius:18px;color:#e9f7ff;padding:24px;font:15px/1.5 system-ui,sans-serif;box-shadow:0 20px 80px #000a';
  const header=document.createElement('div');header.style.cssText='display:flex;gap:12px;justify-content:space-between;align-items:center';
  const title=textNode('h2','GAMBIT · Real Sepolia');
  title.id='gambit-chain-title';title.style.cssText='margin:0;font-size:23px';
  const close=document.createElement('button');close.type='button';close.textContent='Close';
  close.style.cssText='border:1px solid #536987;border-radius:8px;background:transparent;color:#e2f3ff;padding:8px 12px';
  close.addEventListener('click',()=>{if(!busy)overlay.hidden=true;});
  header.append(title,close);card.append(header);
  const caution=textNode('p','Real Sepolia wallet signatures. Your sealed plan stays encrypted. Keep the challenge ID to recover after a rejected signature, network interruption, or reload.');
  caution.style.cssText='color:#bbd1e5;font-size:13px';card.append(caution);
  const account=textNode('p','Not connected');account.style.cssText='font-weight:700;color:#89edf7';card.append(account);
  const connect=button('Connect Sepolia wallet',async()=>{client=await createGambitSepoliaClient(address);account.textContent='Connected: '+client.userAddress;setStatus('Wallet verified on Sepolia.');},'gambit-chain-connect');
  const seal=button('Seal my currently selected tactic',async()=>{
    const c=requireClient();
    setStatus('Encrypting and sealing your hidden fighter strategy…');
    const {policyId,transactionHash}=await c.sealPolicy(getPlan());
    policyInput.value=String(policyId);
    setStatus('Policy #'+policyId+' sealed onchain: '+transactionHash);
  },'gambit-chain-seal');
  const policyLabel=textNode('label','Opponent policy ID');policyLabel.setAttribute('for','gambit-policy-id');
  const policyInput=document.createElement('input');
  policyInput.id='gambit-policy-id';policyInput.type='text';policyInput.inputMode='numeric';
  policyInput.placeholder='e.g. 1';policyInput.autocomplete='off';
  const challenge=button('Challenge and resolve',async()=>{
    const c=requireClient(),policyId=asPositiveId(policyInput.value,'Policy ID');
    setStatus('Opening challenge against policy #'+policyId+'…');
    const opened=await c.openChallenge(policyId);
    challengeId=opened.challengeId;
    challengeInput.value=String(challengeId);
    setStatus('Challenge #'+challengeId+' created. Encrypting your plan…');
    await c.submitChallenge(challengeId,getPlan());
    setStatus('Encrypted plan submitted. Calculating FHE outcome and fetching KMS proof…');
    showResult(await c.resolveAndFinalize(challengeId));
  },'gambit-chain-challenge');
  const challengeLabel=textNode('label','Continue an existing challenge ID');
  challengeLabel.setAttribute('for','gambit-challenge-id');
  const challengeInput=document.createElement('input');challengeInput.id='gambit-challenge-id';
  challengeInput.type='text';challengeInput.inputMode='numeric';challengeInput.placeholder='Resume after interrupted decryption';
  const resume=button('Continue challenge',async()=>{
    const c=requireClient();
    challengeId=asPositiveId(challengeInput.value,'Challenge ID');
    setStatus('Reading the authoritative Sepolia challenge status…');
    showResult(await c.resumeChallenge(challengeId,getPlan(),setStatus));
  },'gambit-chain-resume');
  const status=textNode('p','No transactions sent.');status.id='gambit-chain-status';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.style.cssText='padding:12px;background:#1b304d;border-radius:10px;overflow-wrap:anywhere;min-height:52px';
  const result=document.createElement('div');result.id='gambit-chain-receipt';
  result.style.cssText='overflow-wrap:anywhere;color:#bdf6ff;font-size:13px';
  const controls=[connect,seal,challenge,resume];
  const styleControls=(el:HTMLElement)=>{
    el.style.cssText='width:100%;margin-top:8px;min-height:40px;padding:9px 12px;border:1px solid #567d9b;border-radius:9px;background:#19415f;color:#e7faff;font-size:14px';
  };
  for(const e of [...controls,policyInput,challengeInput])styleControls(e);
  policyLabel.style.display='block';policyLabel.style.marginTop='15px';
  challengeLabel.style.display='block';challengeLabel.style.marginTop='15px';
  card.append(connect,seal,policyLabel,policyInput,challenge,challengeLabel,challengeInput,resume,status,result);
  overlay.append(card);document.body.append(launch,overlay);
  // A hidden dialog must be truly non-interactive.
  const setVisibility=()=>{overlay.style.display=overlay.hidden?'none':'flex';};
  const open=()=>{overlay.hidden=false;setVisibility();close.focus();};
  launch.addEventListener('click',open);
  close.addEventListener('click',()=>setVisibility());
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){overlay.hidden=true;setVisibility();}});
  setVisibility();

  // Provider changes invalidate the account and every pending write.
  const wallet=(window as unknown as {ethereum?:{
    on?:(event:string,listener:(value:unknown)=>void)=>void
  }}).ethereum;
  const disconnect=()=>{
    client=null;
    account.textContent='Not connected';
    setStatus('Wallet or network changed. Reconnect to continue safely.');
  };
  wallet?.on?.('accountsChanged',disconnect);
  wallet?.on?.('chainChanged',disconnect);

  function requireClient(){
    if(!client)throw Error('Connect a Sepolia wallet first.');
    return client;
  }
  function setStatus(message:string){status.textContent=message;}
  function showResult(receipt:{outcome:number,challengeId:bigint,explorerUrl:string,authenticated:true,evidence:'transaction'|'contract-state'}){
    if(receipt.authenticated!==true)throw Error('Unauthenticated game result refused.');
    setStatus('VERIFIED ON SEPOLIA · '+(receipt.outcome===1?'Challenger wins':receipt.outcome===2?'Defender wins':'Draw'));
    result.replaceChildren();
    const link=document.createElement('a');link.textContent=receipt.evidence==='transaction'
      ?'View verified match transaction on Sepolia Etherscan'
      :'Inspect finalized game contract on Sepolia Etherscan';
    link.href=receipt.explorerUrl;link.target='_blank';link.rel='noopener noreferrer';
    link.style.color='#7ce7f7';result.append(link);
  }
  function setBusy(next:boolean){
    busy=next;
    for(const b of controls)b.disabled=next;
    close.disabled=next;
    launch.disabled=next;
  }
}
