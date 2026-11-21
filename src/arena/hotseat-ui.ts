import './hotseat.css';
import {startingSquadPlans,SQUAD_ROLES} from '../squad.mjs';
import {
  createArenaHotseatSession,advanceArenaHotseat,publicArenaHotseat
} from './hotseat-controller.mjs';
import {createGameShell,transitionGameShell}
  from '../architecture/game-shell.mjs';

/**
 * Functional LOCAL two-commander hotseat greybox. No network, wallet or FHE.
 *
 * Both participants enter actual independent squad orders on one device.
 * The controller computes scores with the pure v3 research rules only after
 * both participants explicitly submit. The UI NEVER renders the private
 * pending match or source plans; it renders the allowlisted public view.
 *
 * This is same-device handoff privacy, NOT cryptographic secrecy. An owner
 * of this device can inspect cleartext JS memory with developer tools.
 */
type Stage=ReturnType<typeof publicArenaHotseat>;
type Order={
  plans:Array<{base:number,trigger:number,response:number}>,
  formation:number,stakeSector:number|null
};
const ACTIONS=['STRIKE','GUARD','FLANK'];
const FORMATIONS=['HOLD','PIVOT','FEINT'];
function byId<T extends HTMLElement>(root:ParentNode,id:string):T{
  const el=root.querySelector<T>('#'+id);
  if(!el)throw Error('Arena hotseat control unavailable: '+id);
  return el;
}
function newMatchId():string{
  const random=window.crypto.getRandomValues(new Uint32Array(1))[0];
  return 'research-hotseat-'+Date.now().toString(36)+'-'+random.toString(36);
}
function makeSelect(id:string,options:readonly string[],value:number):HTMLSelectElement{
  const select=document.createElement('select');
  select.id=id;
  for(const [index,name] of options.entries()){
    const option=document.createElement('option');
    option.value=String(index);
    option.textContent=name;
    select.append(option);
  }
  select.value=String(value);
  return select;
}
function lineFor(event:{round:number,pointsA:number,pointsB:number,
  cumulativeA:number,cumulativeB:number}):string{
  return 'ROUND '+event.round+' · Challenger '+event.pointsA+
    ' : '+event.pointsB+' Defender · Match '+event.cumulativeA+
    ' : '+event.cumulativeB;
}
export function mountArenaHotseatLab():void{
  if(document.getElementById('gambit-arena-hotseat-open'))return;
  const launch=document.createElement('button');
  launch.id='gambit-arena-hotseat-open';
  launch.type='button';
  launch.textContent='ARENA · LOCAL HOTSEAT';
  launch.setAttribute('aria-haspopup','dialog');
  launch.setAttribute('aria-controls','gambit-arena-hotseat-dialog');
  launch.setAttribute('aria-expanded','false');
  const mobileLaunch=launch.cloneNode(false) as HTMLButtonElement;
  mobileLaunch.id='gambit-arena-hotseat-mobile-open';
  const overlay=document.createElement('div');
  overlay.id='gambit-arena-hotseat-overlay';
  overlay.hidden=true;
  overlay.dataset.phase='closed';
  overlay.innerHTML=[
    '<section id="gambit-arena-hotseat-dialog" role="dialog" aria-modal="true" ',
      'aria-labelledby="gambit-arena-hotseat-heading" tabindex="-1">',
      '<header class="ga-head"><div>',
        '<strong id="gambit-arena-hotseat-heading">ARENA · TWO-COMMANDER LAB</strong>',
        '<p>LOCAL HOTSEAT · CLEAR TEXT IN MEMORY · NO WALLET · NOT ONLINE PVP</p>',
      '</div><button type="button" id="gambit-arena-hotseat-close">RETURN TO GAME</button></header>',
      '<p id="gambit-arena-hotseat-boundary" class="ga-boundary">',
        'Two people share this device. Orders are hidden from the next player in ',
        'the interface after locking, but are NOT encrypted or protected from ',
        'browser developer tools. Closing retains this match in this tab; ',
        'refreshing discards it. No blockchain results or achievements.</p>',
      '<section class="ga-score" aria-label="Local score">',
        '<div><span>ROUND</span><strong id="gambit-arena-hotseat-round">1 / 5</strong></div>',
        '<div><span>CHALLENGER</span><strong id="gambit-arena-hotseat-score-a">0</strong></div>',
        '<div><span>DEFENDER</span><strong id="gambit-arena-hotseat-score-b">0</strong></div>',
      '</section>',
      '<p id="gambit-arena-hotseat-status" role="status" aria-live="polite"></p>',
      '<section id="gambit-arena-hotseat-briefing">',
        '<h2>Learn the competitive turn loop</h2>',
        '<p>Program three fighters independently. The first person locks a plan, ',
        'hands over the device, and the second person makes their own decision. ',
        'Settle the real reference round, review the score, and adapt through ',
        'five rounds. Your first optional GAMBIT increases risk; it can be used ',
        'only once per player for the whole match.</p>',
        '<button type="button" id="gambit-arena-hotseat-start">START LOCAL MATCH</button>',
      '</section>',
      '<form id="gambit-arena-hotseat-form" hidden>',
        '<h2 id="gambit-arena-hotseat-player-heading">CHALLENGER PLANNING</h2>',
        '<label for="gambit-arena-hotseat-formation">FORMATION</label>',
        '<select id="gambit-arena-hotseat-formation"></select>',
        '<div id="gambit-arena-hotseat-roles" class="ga-roles"></div>',
        '<label for="gambit-arena-hotseat-stake">ONCE-PER-MATCH GAMBIT</label>',
        '<select id="gambit-arena-hotseat-stake"></select>',
        '<p class="ga-footnote">Your chosen visual lane will get +2 points if ',
          'you win it, or lose 1 point if you do not. No automatic win is possible.',
          ' Once locked, you cannot edit or inspect this plan in the interface.</p>',
        '<button type="submit" id="gambit-arena-hotseat-submit">LOCK THIS SQUAD</button>',
      '</form>',
      '<section id="gambit-arena-hotseat-handoff" hidden>',
        '<h2>PASS THE DEVICE</h2>',
        '<p>The challenger submitted. Their private plan has been removed from ',
        'the interface. Only the defender should continue now.</p>',
        '<button type="button" id="gambit-arena-hotseat-accept">I AM THE DEFENDER · CONTINUE</button>',
      '</section>',
      '<section id="gambit-arena-hotseat-ready" hidden>',
        '<h2>BOTH SQUADS LOCKED</h2>',
        '<p>Both real local plans were accepted. Neither side can resubmit. ',
          'The local reference engine will now resolve this round. ',
          'This is not an FHE proof or blockchain transaction.</p>',
        '<button type="button" id="gambit-arena-hotseat-resolve">RESOLVE LOCAL ROUND</button>',
      '</section>',
      '<section id="gambit-arena-hotseat-review" hidden>',
        '<h2 id="gambit-arena-hotseat-review-heading">ROUND SETTLED</h2>',
        '<p id="gambit-arena-hotseat-last-score"></p>',
        '<button type="button" id="gambit-arena-hotseat-next">NEXT ROUND</button>',
      '</section>',
      '<section id="gambit-arena-hotseat-complete" hidden>',
        '<h2>FIVE ROUNDS COMPLETE</h2>',
        '<p id="gambit-arena-hotseat-final"></p>',
        '<p>No local result is ranked, verified on Sepolia or saved as an achievement.</p>',
        '<button type="button" id="gambit-arena-hotseat-rematch">NEW LOCAL MATCH</button>',
      '</section>',
      '<ol id="gambit-arena-hotseat-history" aria-label="Public aggregate rounds"></ol>',
      '<button type="button" id="gambit-arena-hotseat-discard">',
        'DISCARD CURRENT LOCAL MATCH</button>',
      '<p class="ga-footnote">Only the public aggregate is shown after settlement. ',
      'Individual lane results, target sectors and committed tactics are not ',
      'displayed. The onchain Arena v3 remains unbuilt.</p>',
    '</section>'
  ].join('');
  document.body.append(launch,overlay);
  const anchor=document.getElementById('gambit-training-mobile-open') ??
    document.getElementById('gambit-profile-mobile-open') ??
    document.querySelector('#gambit-mobile-deck .gambit-mobile-head');
  anchor?.after(mobileLaunch);
  const dialog=byId<HTMLElement>(overlay,'gambit-arena-hotseat-dialog');
  const form=byId<HTMLFormElement>(overlay,'gambit-arena-hotseat-form');
  const roles=byId<HTMLElement>(overlay,'gambit-arena-hotseat-roles');
  const formation=byId<HTMLSelectElement>(overlay,'gambit-arena-hotseat-formation');
  const stake=byId<HTMLSelectElement>(overlay,'gambit-arena-hotseat-stake');
  const discard=byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-discard');
  let shell=createGameShell();
  let session=createArenaHotseatSession(newMatchId());
  let focusBefore:HTMLElement|null=null;
  let priorInert:Array<{node:HTMLElement,inert:boolean}>=[];
  let discardArmed=false;

  function status(text:string){
    byId<HTMLElement>(overlay,'gambit-arena-hotseat-status').textContent=text;
  }
  function editor(){
    // Reset references to all prior private orders before a new player's turn.
    // The submitted plan is NOT persisted to HTML or browser storage.
    roles.replaceChildren();
    formation.replaceChildren();
    stake.replaceChildren();
    const defaults=startingSquadPlans();
    FORMATIONS.forEach((name,value)=>{
      const opt=document.createElement('option');opt.value=String(value);
      opt.textContent=name;formation.append(opt);
    });
    for(const [role,name] of SQUAD_ROLES.entries()){
      const fieldset=document.createElement('fieldset');
      const legend=document.createElement('legend');legend.textContent=name;
      fieldset.append(legend);
      for(const field of ['base','trigger','response'] as const){
        const id='gambit-arena-hotseat-r'+role+'-'+field;
        const label=document.createElement('label');
        label.textContent=field.toUpperCase();
        label.htmlFor=id;
        const select=makeSelect(id,ACTIONS,defaults[role][field]);
        select.dataset.role=String(role);select.dataset.field=field;
        fieldset.append(label,select);
      }
      roles.append(fieldset);
    }
    const none=document.createElement('option');none.value='none';
    none.textContent='SAVE GAMBIT FOR LATER';stake.append(none);
    const used=session.match.usedGambit[session.side];
    if(!used){
      for(let i=0;i<3;i++){
        const opt=document.createElement('option');opt.value=String(i);
        opt.textContent='RISK VISUAL LANE '+(i+1);
        stake.append(opt);
      }
    }
    stake.value='none';
    stake.disabled=used;
    const heading=byId<HTMLElement>(overlay,'gambit-arena-hotseat-player-heading');
    heading.textContent=(session.side==='challenger'?'CHALLENGER':'DEFENDER')+
      ' · ROUND '+session.match.round;
    byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-submit').textContent=
      'LOCK '+session.side.toUpperCase()+' SQUAD';
  }
  function render(){
    const view:Stage=publicArenaHotseat(session);
    overlay.dataset.phase=view.phase;
    overlay.dataset.round=String(view.match.round);
    byId<HTMLElement>(overlay,'gambit-arena-hotseat-round').textContent=
      view.match.round+' / 5';
    byId<HTMLElement>(overlay,'gambit-arena-hotseat-score-a').textContent=
      String(view.match.scoreA);
    byId<HTMLElement>(overlay,'gambit-arena-hotseat-score-b').textContent=
      String(view.match.scoreB);
    const sections={
      briefing:'gambit-arena-hotseat-briefing',
      planning:'gambit-arena-hotseat-form',
      handoff:'gambit-arena-hotseat-handoff',
      'ready-to-resolve':'gambit-arena-hotseat-ready',
      review:'gambit-arena-hotseat-review',
      complete:'gambit-arena-hotseat-complete'
    };
    // Remove any previous participant's editable DOM before handoff.
    roles.replaceChildren();
    formation.replaceChildren();
    stake.replaceChildren();
    for(const [phase,id] of Object.entries(sections))
      byId<HTMLElement>(overlay,id).hidden=view.phase!==phase;
    if(view.phase==='planning')editor();
    const messages:Record<Stage['phase'],string>={
      briefing:'Local research only. Start when both commanders share the device.',
      planning:(view.side==='challenger'?'Player 1':'Player 2')+
        ' is entering an original three-role squad order. No wallet is involved.',
      handoff:'Challenger plan locked. Defender must explicitly accept the handoff.',
      'ready-to-resolve':'Both plans locked. A player must explicitly resolve the local turn.',
      review:'Real local rules resolved this round. Review before continuing.',
      complete:'Five authentic local rounds completed. This result is NOT onchain.'
    };
    status(messages[view.phase]);
    const list=byId<HTMLOListElement>(overlay,'gambit-arena-hotseat-history');
    list.replaceChildren();
    for(const entry of view.match.history){
      const li=document.createElement('li');
      li.textContent=lineFor(entry);list.append(li);
    }
    if(view.match.history.length){
      const last=view.match.history.at(-1);
      if(last)byId<HTMLElement>(overlay,'gambit-arena-hotseat-last-score')
        .textContent=lineFor(last);
    }
    if(view.phase==='complete'){
      const outcome=view.match.winner===0?'DRAW':
        view.match.winner===1?'CHALLENGER WON':'DEFENDER WON';
      byId<HTMLElement>(overlay,'gambit-arena-hotseat-final').textContent=
        'LOCAL '+outcome+' · '+view.match.scoreA+' : '+view.match.scoreB+
        ' after five rounds. No win was scripted or saved.';
    }
    discard.hidden=view.phase==='briefing'||view.phase==='complete';
    discardArmed=false;
    discard.textContent='DISCARD CURRENT LOCAL MATCH';
  }
  function next(type:string,extra?:{order:Order}){
    try{
      session=advanceArenaHotseat(session,extra?{type,...extra}:{type});
      render();
      // Do not expose the prior participant's plan during the handoff.
      if(session.phase==='planning')
        byId<HTMLSelectElement>(overlay,'gambit-arena-hotseat-formation').focus();
      else dialog.focus();
    }catch{
      status('That action was refused by the local match rules. Check the current turn.');
    }
  }
  function submit(event:SubmitEvent){
    event.preventDefault();
    if(session.phase!=='planning')return;
    try{
      const plans:Array<{base:number,trigger:number,response:number}>=[];
      for(let role=0;role<3;role++){
        const read=(field:'base'|'trigger'|'response')=>Number(
          byId<HTMLSelectElement>(roles,'gambit-arena-hotseat-r'+role+'-'+field).value);
        plans.push({base:read('base'),trigger:read('trigger'),response:read('response')});
      }
      const stakeSector=stake.value==='none'?null:Number(stake.value);
      // Snap data from DOM only at explicit lock; no logs, URL, storage.
      next('SUBMIT',{order:{plans,formation:Number(formation.value),stakeSector}});
    }catch{
      status('Unable to accept this squad. Review every fighter and try again.');
    }
  }
  function close(){
    if(overlay.hidden)return;
    overlay.hidden=true;overlay.dataset.phase='closed';
    shell=transitionGameShell(shell,{type:'BACK'});
    delete document.body.dataset.gambitFeatureOverlay;
    for(const {node,inert} of priorInert)node.inert=inert;
    priorInert=[];
    launch.setAttribute('aria-expanded','false');
    mobileLaunch.setAttribute('aria-expanded','false');
    (focusBefore?.isConnected?focusBefore:launch)?.focus();
  }
  function open(){
    if(!overlay.hidden)return;
    if(document.body.dataset.gambitFeatureOverlay||
      document.getElementById('gambit-squad-dialog')?.hidden===false||
      document.getElementById('gambit-chain-dialog')?.hidden===false)return;
    focusBefore=document.activeElement instanceof HTMLElement?
      document.activeElement:null;
    shell=transitionGameShell(shell,{type:'OPEN',scene:'arena-v3-hotseat'});
    priorInert=[];
    for(const id of ['app','gambit-mobile-deck','gambit-squad-launch',
      'gambit-chain-launch','gambit-blacksite-open','gambit-profile-open',
      'gambit-training-open']){
      const node=document.getElementById(id);
      if(node instanceof HTMLElement){
        priorInert.push({node,inert:node.inert});
        node.inert=true;
      }
    }
    document.body.dataset.gambitFeatureOverlay='arena-hotseat-local';
    launch.setAttribute('aria-expanded','true');
    mobileLaunch.setAttribute('aria-expanded','true');
    overlay.hidden=false;
    render();
    dialog.focus();
  }
  form.addEventListener('submit',submit);
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-start')
    .addEventListener('click',()=>next('START'));
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-accept')
    .addEventListener('click',()=>next('ACCEPT_HANDOFF'));
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-resolve')
    .addEventListener('click',()=>next('RESOLVE'));
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-next')
    .addEventListener('click',()=>next('NEXT_ROUND'));
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-rematch')
    .addEventListener('click',()=>{
      session=createArenaHotseatSession(newMatchId());render();dialog.focus();
    });
  discard.addEventListener('click',()=>{
    if(!discardArmed){
      discardArmed=true;
      discard.textContent='CONFIRM DISCARD AND LOSE ALL FIVE-ROUND PROGRESS';
      status('Press CONFIRM DISCARD again to erase this local-only match.');
      return;
    }
    session=createArenaHotseatSession(newMatchId());render();dialog.focus();
  });
  byId<HTMLButtonElement>(overlay,'gambit-arena-hotseat-close')
    .addEventListener('click',close);
  for(const button of [launch,mobileLaunch])
    button.addEventListener('click',open);
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),select:not([disabled]),a[href],input:not([disabled])'
    )).filter(node=>node.getClientRects().length>0&&!node.closest('[hidden]'));
    if(focusable.length===0)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  });
  render();
}
