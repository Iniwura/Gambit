import {BrowserProvider,Interface} from 'ethers';
import {discoverInjectedWallets} from '../chain/wallet-discovery.mjs';
import {startingSquadPlans} from '../squad.mjs';
import {approvedArenaV3Deployment} from './approved-deployment.mjs';
import {createArenaV3SdkSession} from './sdk-session';
import {
  arenaV3ReadOnlyWallet,readArenaV3SelectedAccount,prepareArenaV3Seal,
  prepareArenaV3Finalization
} from './fhe-preparation.mjs';
import {
  ARENA_V3_INVITATION_ABI,arenaV3InviteToken,recoverArenaV3Invitation,
  stageArenaV3Create
} from './invitation.mjs';
import {readArenaV3PublicMatch} from './public-match-reader.mjs';
import {
  MAX_ARENA_V3_GAS_LIMIT,stageArenaV3TransactionIntent
} from './transaction-intent.mjs';
import {
  createArenaV3ExecutionSession,recoverArenaV3ActionReceipt
} from './wallet-execution.mjs';

type Manifest=ReturnType<typeof approvedArenaV3Deployment>;
type Wallet={request:(args:{method:string,params?:unknown})=>Promise<unknown>,
  on?:(event:string,fn:()=>void)=>unknown,
  removeListener?:(event:string,fn:()=>void)=>unknown};
type Intent=Record<string,any>;
type Prepared={intent:Intent,payload:Record<string,any>};
type Pending={kind:'CREATE'|'ACTION',hash:string,token?:string,
  intent?:Intent,matchId?:number};

const MAXIMUM_TOTAL_FEE_WEI='1000000000';
const PENDING_KEY='gambit.arena.v3.pending';
const ACTIONS=Object.freeze(['STRIKE','GUARD','FLANK']);
const FORMATIONS=Object.freeze(['HOLD','PIVOT','FEINT']);
const manifest:Manifest=approvedArenaV3Deployment();

function errorText(error:unknown):string{
  const message=error instanceof Error?error.message:'';
  if(/Sepolia|chain|network/i.test(message))
    return 'wallet network verification failed';
  if(/account|wallet|provider/i.test(message))
    return 'wallet account verification failed';
  if(/stale|reorg|reorganiz/i.test(message))
    return 'public match state changed; refresh before continuing';
  if(/fee|gas|estimate/i.test(message))
    return 'fresh gas or fee quote unavailable';
  // Provider errors can contain RPC URLs, request payloads or credentials.
  return 'operation failed; no transaction was sent';
}
function addressEquals(a:string|null,b:string|null):boolean{
  return Boolean(a&&b&&a.toLowerCase()===b.toLowerCase());
}
function readPending():Pending|null{
  try{
    const raw=sessionStorage.getItem(PENDING_KEY);
    if(!raw)return null;
    const value=JSON.parse(raw) as Pending;
    if(!value||!['CREATE','ACTION'].includes(value.kind)||
      !/^0x[0-9a-fA-F]{64}$/.test(value.hash))return null;
    return value;
  }catch{return null;}
}
function writePending(value:Pending):void{
  try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(value));}catch{/* volatile storage */}
}
function clearPending():void{
  try{sessionStorage.removeItem(PENDING_KEY);}catch{/* volatile storage */}
}

/**
 * Live Arena v3 lobby. The deployment is immutable and application-pinned;
 * all writes still require a fresh public review followed by a wallet review.
 * Encrypted plans, SDK proofs and wallet credentials never enter storage.
 */
export function mountArenaV3Lobby(root:HTMLElement){
  const details=document.createElement('details');
  details.id='gambit-arena-online-lobby';
  details.innerHTML=[
    '<summary>ONLINE ARENA · LIVE SEPOLIA</summary>',
    '<p id="gambit-arena-online-deployment">Pinned ArenaV3Research · Sepolia · ',
      manifest.address,'</p>',
    '<label for="gambit-arena-online-wallet">Browser wallet</label>',
    '<select id="gambit-arena-online-wallet"><option value="">Choose wallet</option></select>',
    '<button type="button" id="gambit-arena-online-refresh">FIND WALLETS</button>',
    '<button type="button" id="gambit-arena-online-inspect" disabled>CHECK ACCOUNT</button>',
    '<p id="gambit-arena-online-status" role="status" aria-live="polite">',
      'Choose a wallet to check its already authorized Sepolia account. ',
      'No permission or signature request.</p>',
    '<section class="gambit-arena-online-create">',
      '<h2>Create a match</h2>',
      '<label for="gambit-arena-online-defender">Invited defender address</label>',
      '<input id="gambit-arena-online-defender" type="text" inputmode="text" ',
        'autocomplete="off" spellcheck="false" placeholder="0x…" disabled>',
      '<button type="button" id="gambit-arena-online-create-stage" disabled>',
        'REVIEW MATCH INVITATION</button>',
    '</section>',
    '<section class="gambit-arena-online-recovery">',
      '<h2>Recover a match</h2>',
      '<label for="gambit-arena-online-invite">Invitation token</label>',
      '<input id="gambit-arena-online-invite" type="text" autocomplete="off" ',
        'spellcheck="false" maxlength="76" disabled>',
      '<button type="button" id="gambit-arena-online-recover" disabled>',
        'RECOVER MATCH</button>',
      '<button type="button" id="gambit-arena-online-copy" disabled>',
        'COPY INVITATION</button>',
    '</section>',
    '<section id="gambit-arena-online-review" class="gambit-arena-online-review" hidden>',
      '<h2>Transaction review</h2>',
      '<p id="gambit-arena-online-review-summary"></p>',
      '<dl id="gambit-arena-online-review-details"></dl>',
      '<p class="gambit-arena-online-warning">',
        'This is the exact public review. The next button opens the selected wallet. ',
        'Approve only the matching transaction in that wallet.</p>',
      '<button type="button" id="gambit-arena-online-review-submit">',
        'OPEN WALLET REVIEW &amp; SUBMIT</button>',
      '<button type="button" id="gambit-arena-online-review-cancel">KEEP MATCH OPEN</button>',
    '</section>',
    '<section id="gambit-arena-online-pending" class="gambit-arena-online-pending" hidden>',
      '<h2>Pending transaction</h2>',
      '<p id="gambit-arena-online-pending-text"></p>',
      '<button type="button" id="gambit-arena-online-pending-check">',
        'CHECK RECEIPT</button>',
    '</section>',
    '<section id="gambit-arena-online-match" hidden>',
      '<h2 id="gambit-arena-online-match-heading"></h2>',
      '<p id="gambit-arena-online-match-state"></p>',
      '<p id="gambit-arena-online-match-score"></p>',
      '<button type="button" id="gambit-arena-online-refresh-match">REFRESH MATCH</button>',
      '<div id="gambit-arena-online-match-actions"></div>',
      '<section id="gambit-arena-online-planner" hidden>',
        '<h3>Encrypted tactical planning</h3>',
        '<p>Plans are encrypted with the verified FHE SDK before the wallet sees ',
          'the transaction. The public review contains no cleartext tactics.</p>',
        '<label for="gambit-arena-online-formation">Formation</label>',
        '<select id="gambit-arena-online-formation"></select>',
        '<div id="gambit-arena-online-plans" class="gambit-arena-online-plans"></div>',
        '<label for="gambit-arena-online-stake">Once-per-match GAMBIT</label>',
        '<select id="gambit-arena-online-stake"></select>',
        '<button type="button" id="gambit-arena-online-seal-stage">',
          'ENCRYPT &amp; REVIEW SEAL</button>',
      '</section>',
      '<p id="gambit-arena-online-match-history" class="gambit-arena-online-history"></p>',
    '</section>'
  ].join('');
  root.append(details);

  function get<T extends HTMLElement>(id:string):T{
    const el=details.querySelector<T>('#gambit-arena-online-'+id);
    if(!el)throw Error('Arena lobby control unavailable: '+id);
    return el;
  }
  const select=get<HTMLSelectElement>('wallet');
  const inspect=get<HTMLButtonElement>('inspect');
  const status=get<HTMLElement>('status');
  const defender=get<HTMLInputElement>('defender');
  const createStage=get<HTMLButtonElement>('create-stage');
  const invite=get<HTMLInputElement>('invite');
  const recover=get<HTMLButtonElement>('recover');
  const copy=get<HTMLButtonElement>('copy');
  const review=get<HTMLElement>('review');
  const reviewSummary=get<HTMLElement>('review-summary');
  const reviewDetails=get<HTMLElement>('review-details');
  const reviewSubmit=get<HTMLButtonElement>('review-submit');
  const reviewCancel=get<HTMLButtonElement>('review-cancel');
  const pendingPanel=get<HTMLElement>('pending');
  const pendingText=get<HTMLElement>('pending-text');
  const pendingCheck=get<HTMLButtonElement>('pending-check');
  const match=get<HTMLElement>('match');
  const matchHeading=get<HTMLElement>('match-heading');
  const matchState=get<HTMLElement>('match-state');
  const matchScore=get<HTMLElement>('match-score');
  const refreshMatch=get<HTMLButtonElement>('refresh-match');
  const matchActions=get<HTMLElement>('match-actions');
  const planner=get<HTMLElement>('planner');
  const formation=get<HTMLSelectElement>('formation');
  const plans=get<HTMLElement>('plans');
  const stake=get<HTMLSelectElement>('stake');
  const sealStage=get<HTMLButtonElement>('seal-stage');
  const history=get<HTMLElement>('match-history');

  let discovery:ReturnType<typeof discoverInjectedWallets>|null=null;
  let selected:Wallet|null=null;
  let actor:string|null=null;
  let provider:BrowserProvider|null=null;
  let activeMatchId:number|null=null;
  let activeView:any=null;
  let controller:AbortController|null=null;
  let revision=0;
  let reviewData:Prepared|null=null;
  let reviewEstimate:string|null=null;
  let pending:Pending|null=readPending();

  function setStatus(message:string):void{status.textContent=message;}
  function invalidate(message:string):void{
    revision++;
    controller?.abort();controller=null;
    actor=null;provider=null;activeMatchId=null;activeView=null;reviewData=null;
    reviewEstimate=null;
    review.hidden=true;pendingPanel.hidden=!pending;pendingCheck.disabled=!pending;
    match.hidden=true;planner.hidden=true;
    defender.disabled=true;createStage.disabled=true;invite.disabled=true;recover.disabled=true;
    copy.disabled=true;inspect.disabled=!selected;
    setStatus(message);
  }
  const changed=()=>invalidate('Wallet account or network changed. Check the selected wallet again.');
  function detach():void{
    selected?.removeListener?.('accountsChanged',changed);
    selected?.removeListener?.('chainChanged',changed);
    selected?.removeListener?.('disconnect',changed);
    selected=null;
  }
  function setWallet():void{
    detach();
    selected=discovery?.list().find(w=>w.id===select.value)?.provider??null;
    invalidate(selected?'Check the selected wallet’s existing authorization.':'Choose a browser wallet.');
    selected?.on?.('accountsChanged',changed);
    selected?.on?.('chainChanged',changed);
  }
  function renderWallets():void{
    const previous=select.value;
    select.replaceChildren();
    const empty=document.createElement('option');empty.value='';empty.textContent='Choose wallet';
    select.append(empty);
    for(const w of discovery?.list()??[]){
      const option=document.createElement('option');option.value=w.id;option.textContent=w.label;
      select.append(option);
    }
    if(Array.from(select.options).some(option=>option.value===previous))select.value=previous;
    else{select.value='';setWallet();}
  }
  function startDiscovery():void{
    if(!discovery){
      discovery=discoverInjectedWallets(window);
      discovery.subscribe(renderWallets);
    }
    discovery.refresh();renderWallets();
    if(select.options.length===1)setStatus('No injected browser wallet found.');
  }
  function stop():void{
    detach();discovery?.close();discovery=null;select.replaceChildren();
    invalidate('Choose a wallet to check its existing authorization.');
    details.open=false;
  }
  function currentProvider():BrowserProvider{
    if(!provider||!selected||!actor)throw Error('Check an authorized Sepolia account first');
    return provider;
  }
  async function feeQuote(){
    const fees=await currentProvider().getFeeData();
    if(fees.maxFeePerGas===null||fees.maxPriorityFeePerGas===null)
      throw Error('Sepolia did not provide an EIP-1559 fee quote');
    return {gasLimit:MAX_ARENA_V3_GAS_LIMIT.toString(),
      maxFeePerGasWei:fees.maxFeePerGas.toString(),
      maxPriorityFeePerGasWei:fees.maxPriorityFeePerGas.toString(),
      maximumTotalFeeWei:MAXIMUM_TOTAL_FEE_WEI};
  }
  async function run(label:string,work:(signal:AbortSignal)=>Promise<void>,
    failurePrefix='No transaction sent. '):Promise<void>{
    const id=++revision;controller?.abort();
    const current=new AbortController();controller=current;
    setStatus(label);
    try{await work(current.signal);}
    catch(error){if(id===revision&&!current.signal.aborted)setStatus(failurePrefix+errorText(error));}
    finally{if(id===revision&&controller===current)controller=null;}
  }
  function renderReview():void{
    const intent=reviewData?.intent;
    review.hidden=!intent;
    if(!intent)return;
    reviewSummary.textContent=intent.summary||
      (intent.action==='CREATE_MATCH'?'Create one match for invited defender '+intent.defender:
        intent.consentText);
    reviewDetails.replaceChildren();
    const fields:[string,string][]=[
      ['Chain','Ethereum Sepolia (11155111)'],['Contract',intent.contract],
      ['From',intent.actor],
      ['Value','0 ETH'],['Calldata hash',intent.calldataHash],['Gas limit',intent.fee.gasLimit],
      ['Max fee / gas',intent.fee.maxFeePerGasWei+' wei'],
      ['Priority fee',intent.fee.maxPriorityFeePerGasWei+' wei'],
      ['Maximum fee',intent.fee.maximumTotalFeeWei+' wei']
    ];
    if(intent.defender)fields.splice(3,0,['Defender',String(intent.defender)]);
    if(reviewEstimate)fields.splice(4,0,['Fresh gas estimate',reviewEstimate]);
    for(const [label,value] of fields){
      const term=document.createElement('dt');term.textContent=label;
      const detail=document.createElement('dd');detail.textContent=value;
      reviewDetails.append(term,detail);
    }
  }
  function renderPending():void{
    pendingPanel.hidden=!pending;
    pendingCheck.disabled=!pending;
    if(!pending)return;
    pendingText.textContent=pending.kind==='CREATE'?
      'Match creation was submitted. Recover the invitation after three confirmations. '+pending.hash:
      'A match action is pending or uncertain. Reconcile this exact hash before any new review. '+pending.hash;
  }
  function renderPlanner():void{
    formation.replaceChildren();
    FORMATIONS.forEach((name,index)=>{
      const option=document.createElement('option');option.value=String(index);option.textContent=name;
      formation.append(option);
    });
    formation.value='0';plans.replaceChildren();
    const defaults=startingSquadPlans();
    for(let role=0;role<3;role++){
      const fieldset=document.createElement('fieldset');
      const legend=document.createElement('legend');legend.textContent=['SCOUT','GUARDIAN','STRIKER'][role];
      fieldset.append(legend);
      for(const field of ['base','trigger','response'] as const){
        const label=document.createElement('label');label.textContent=field.toUpperCase();
        const input=document.createElement('select');input.dataset.role=String(role);input.dataset.field=field;
        for(const [index,name] of ACTIONS.entries()){
          const option=document.createElement('option');option.value=String(index);option.textContent=name;
          input.append(option);
        }
        input.value=String(defaults[role][field]);label.append(input);fieldset.append(label);
      }
      plans.append(fieldset);
    }
    stake.replaceChildren();
    const none=document.createElement('option');none.value='none';none.textContent='SAVE GAMBIT FOR LATER';stake.append(none);
    const side=activeView&&actor&&addressEquals(actor,activeView.challenger)?'challenger':'defender';
    if(activeView&&!activeView.usedGambit[side])for(let index=0;index<3;index++){
      const option=document.createElement('option');option.value=String(index);
      option.textContent='RISK VISUAL LANE '+(index+1);stake.append(option);
    }
    stake.value='none';
  }
  function renderMatch():void{
    renderPending();match.hidden=!activeView;
    if(!activeView)return;
    const side=actor&&addressEquals(actor,activeView.challenger)?'challenger':'defender';
    const round=activeView.rounds.at(-1);
    matchHeading.textContent='MATCH '+activeView.matchId+' · '+side.toUpperCase();
    matchState.textContent='ROUND '+activeView.currentRound+' / 5 · '+activeView.status;
    matchScore.textContent='SCORE · '+activeView.cumulative.challenger+' : '+activeView.cumulative.defender;
    history.textContent=activeView.rounds.map((row:any)=>row.finalized?
      'Round '+row.round+': '+row.score.challenger+' : '+row.score.defender:'Round '+row.round+': pending').join(' · ');
    matchActions.replaceChildren();planner.hidden=true;
    const action=(label:string,fn:()=>void)=>{
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',fn);matchActions.append(button);
    };
    if(activeView.status==='WAITING_FOR_BOTH'||activeView.status==='WAITING_FOR_OPPONENT'){
      if(!round[side+'Sealed'])action('PLAN & REVIEW ENCRYPTED ORDER',()=>showPlanner());
      else{const wait=document.createElement('p');wait.textContent='Your order is sealed. Waiting for the opponent.';matchActions.append(wait);}
    }
    if(activeView.status==='READY_TO_RESOLVE')action('REVIEW ROUND RESOLUTION',()=>{void stageResolve();});
    if(activeView.status==='AWAITING_PROOF')action('PREPARE KMS PROOF REVIEW',()=>{void stageFinalize();});
    if(activeView.status==='EXPIRED_INCOMPLETE_NOT_CLOSED')action('REVIEW CLOSE WITHOUT SCORE',()=>{void stageExpire();});
    if(activeView.status==='COMPLETE'){
      const done=document.createElement('p');done.textContent='Five rounds finalized. Match complete.';matchActions.append(done);
    }
  }
  async function refreshActiveMatch(signal?:AbortSignal):Promise<void>{
    if(activeMatchId===null)return;
    const view=await readArenaV3PublicMatch(currentProvider(),manifest,activeMatchId,{signal});
    activeView=view;renderMatch();
  }
  async function recoverInvitation(token:string,signal:AbortSignal):Promise<void>{
    if(!actor)throw Error('Check the wallet account first');
    const invitation=await recoverArenaV3Invitation(currentProvider(),manifest,token,actor,{signal});
    activeMatchId=invitation.matchId;activeView=invitation.view;invite.value=token;
    invite.disabled=false;recover.disabled=false;copy.disabled=false;
    renderMatch();setStatus('Confirmed match '+invitation.matchId+' at three confirmations.');
  }
  function showPlanner():void{
    if(!activeView||!actor)return;
    renderPlanner();planner.hidden=false;sealStage.focus();
  }
  function collectOrder(){
    const values=Array.from(plans.querySelectorAll<HTMLSelectElement>('select'));
    const result=startingSquadPlans();
    for(const input of values){
      const role=Number(input.dataset.role),field=input.dataset.field as 'base'|'trigger'|'response';
      result[role][field]=Number(input.value) as 0|1|2;
    }
    return {plans:result,formation:Number(formation.value),
      stakeSector:stake.value==='none'?null:Number(stake.value)};
  }
  async function stageSeal():Promise<void>{
    if(!activeView||activeMatchId===null||!actor||!selected)return;
    await run('Encrypting the current round for review…',async signal=>{
      const sdkSession=await createArenaV3SdkSession(selected!,signal);
      const prepared=await prepareArenaV3Seal({wallet:selected!,provider:currentProvider(),
        manifest,sdk:sdkSession.sdk,matchId:activeMatchId,expectedActor:actor!,
        expectedRound:activeView.currentRound,order:collectOrder(),feeQuote:await feeQuote(),signal});
      reviewEstimate=null;reviewData=prepared;renderReview();planner.hidden=true;
      setStatus('Encrypted order prepared. Review the exact public transaction before opening the wallet.');
    });
  }
  async function stageResolve():Promise<void>{
    if(!activeView||activeMatchId===null||!actor)return;
    const matchId=activeMatchId;
    await run('Preparing the current round resolution for review…',async signal=>{
      const fresh=await readArenaV3PublicMatch(currentProvider(),manifest,matchId,{signal});
      activeView=fresh;renderMatch();
      reviewEstimate=null;reviewData={intent:stageArenaV3TransactionIntent(fresh,{action:'RESOLVE_ROUND',actor,
        payload:{},feeQuote:await feeQuote()}),payload:{}};
      renderReview();setStatus('Resolution prepared. Review the exact public transaction before opening the wallet.');
    });
  }
  async function stageFinalize():Promise<void>{
    if(!activeView||activeMatchId===null||!actor||!selected)return;
    await run('Requesting the exact public result handle from the KMS SDK…',async signal=>{
      const sdkSession=await createArenaV3SdkSession(selected!,signal);
      const prepared=await prepareArenaV3Finalization({wallet:selected!,provider:currentProvider(),
        manifest,sdk:sdkSession.sdk,matchId:activeMatchId,expectedActor:actor!,
        expectedRound:activeView.currentRound,feeQuote:await feeQuote(),signal});
      reviewEstimate=null;reviewData=prepared;renderReview();
      setStatus('KMS proof prepared. Review the proposed score and exact transaction before opening the wallet.');
    });
  }
  async function stageExpire():Promise<void>{
    if(!activeView||activeMatchId===null||!actor)return;
    const matchId=activeMatchId;
    await run('Preparing the expired-round close for review…',async signal=>{
      const fresh=await readArenaV3PublicMatch(currentProvider(),manifest,matchId,{signal});
      activeView=fresh;renderMatch();
      reviewEstimate=null;reviewData={intent:stageArenaV3TransactionIntent(fresh,{action:'EXPIRE_INCOMPLETE',actor,
        payload:{},feeQuote:await feeQuote()}),payload:{}};
      renderReview();setStatus('Expiry prepared. Review the exact public transaction before opening the wallet.');
    });
  }
  async function submitReview():Promise<void>{
    if(!reviewData||!selected||!provider)return;
    const staged=reviewData;reviewSubmit.disabled=true;reviewCancel.disabled=true;
    await run('Rechecking the match and opening the selected wallet review…',async signal=>{
      const session=createArenaV3ExecutionSession({wallet:selected!,provider:provider!,manifest});
      const result=await session.submit({intent:staged.intent,payload:staged.payload,
        approval:staged.intent.id,signal});
      const hash=result.transactionHash;
      if(!hash){
        clearPending();pending=null;reviewData=null;reviewEstimate=null;renderReview();
        throw Error('Wallet submission is uncertain; no transaction hash was returned. Do not retry automatically.');
      }
      if(staged.intent.action==='CREATE_MATCH'){
        const token=arenaV3InviteToken(hash);
        pending={kind:'CREATE',hash,token};writePending(pending);invite.value=token;
        reviewData=null;reviewEstimate=null;renderReview();renderPending();copy.disabled=false;
        setStatus('Match creation submitted once. Share the invitation token and recover after three confirmations.');
      }else{
        pending={kind:'ACTION',hash,intent:staged.intent,matchId:activeMatchId??undefined};
        writePending(pending);reviewData=null;reviewEstimate=null;renderReview();renderPending();
        setStatus('Action submitted once. Reconcile the exact receipt before reviewing another action.');
      }
    });
    reviewSubmit.disabled=false;reviewCancel.disabled=false;
  }
  async function checkPending():Promise<void>{
    if(!pending||!actor)return;
    const record=pending;
    await run('Reconciling the exact pending transaction…',async signal=>{
      if(record.kind==='CREATE'){
        if(!record.token)throw Error('Pending creation has no invitation token');
        await recoverInvitation(record.token,signal);
        clearPending();pending=null;renderPending();
        setStatus('Creation receipt verified at three confirmations.');
        return;
      }
      if(!record.intent)throw Error('Pending action review is incomplete');
      const result=await recoverArenaV3ActionReceipt(currentProvider(),manifest,record.intent,
        record.hash,{signal});
      if(result.state==='UNCONFIRMED'){
        setStatus('Receipt is not yet at three confirmations. Check again later; no retry was sent.');
        return;
      }
      if(result.state==='CONFIRMED_REVERTED')throw Error('The reviewed action reverted. No retry was sent.');
      clearPending();pending=null;renderPending();
      await refreshActiveMatch(signal);
      setStatus('Action receipt verified at three confirmations and match state refreshed.');
    });
  }
  details.addEventListener('toggle',()=>{if(details.open)startDiscovery();else stop();});
  get<HTMLButtonElement>('refresh').addEventListener('click',startDiscovery);
  select.addEventListener('change',setWallet);
  inspect.addEventListener('click',async()=>{
    if(!selected)return;
    await run('Checking wallet network and previously authorized account…',async signal=>{
      const account=await readArenaV3SelectedAccount(selected!,signal);
      actor=account;provider=new BrowserProvider(arenaV3ReadOnlyWallet(selected!) as any);
      if(pending?.kind==='CREATE'&&pending.token)invite.value=pending.token;
      defender.disabled=false;createStage.disabled=false;invite.disabled=false;recover.disabled=false;
      copy.disabled=!invite.value;pendingCheck.disabled=!pending;
      setStatus('Sepolia account: '+account+' · Verified ArenaV3Research is pinned.');
      renderPending();
    },'No authorized Sepolia account. ');
  });
  createStage.addEventListener('click',async()=>{
    if(!actor)return;
    await run('Reading the live deployment and staging match creation…',async signal=>{
      const invitedDefender=defender.value.trim();
      const quote=await feeQuote();
      const data=new Interface(ARENA_V3_INVITATION_ABI).encodeFunctionData(
        'createMatch',[invitedDefender]);
      const estimate=await currentProvider().estimateGas({from:actor!,to:manifest.address,
        data,value:0n});
      if(estimate<=0n||estimate>MAX_ARENA_V3_GAS_LIMIT)
        throw Error('Fresh creation estimate exceeds the reviewed gas bound');
      const intent=await stageArenaV3Create(currentProvider(),manifest,{actor,
        defender:invitedDefender,feeQuote:{...quote,gasLimit:estimate.toString()}},{signal});
      reviewEstimate=estimate.toString();reviewData={intent,payload:{}};renderReview();
      setStatus('Match creation prepared. Review the exact public transaction before opening the wallet.');
    });
  });
  recover.addEventListener('click',async()=>{
    if(!invite.value.trim())return;
    await run('Checking the creation receipt and current match state…',signal=>
      recoverInvitation(invite.value.trim(),signal));
  });
  copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(invite.value);setStatus('Invitation token copied.');}
    catch{setStatus('Clipboard unavailable. Select and copy the invitation token manually.');}
  });
  reviewSubmit.addEventListener('click',()=>{void submitReview();});
  reviewCancel.addEventListener('click',()=>{reviewData=null;reviewEstimate=null;renderReview();setStatus('Transaction review cancelled. No wallet request was made.');});
  pendingCheck.addEventListener('click',()=>{void checkPending();});
  refreshMatch.addEventListener('click',()=>{void run('Refreshing public match state…',signal=>refreshActiveMatch(signal));});
  sealStage.addEventListener('click',()=>{void stageSeal();});
  if(pending)renderPending();
  return {reset:stop};
}
