import './greybox.css';
import {
  createBlacksiteLocalMission,beginBlacksiteLocalMission,
  guessBlacksiteLocalMission,debriefBlacksiteLocalMission,
  restartBlacksiteLocalMission,publicBlacksiteLocalMission
} from './mission.mjs';
import {createGameShell,transitionGameShell}
  from '../architecture/game-shell.mjs';

/**
 * Phase 2 functional greybox. This is REAL wallet-free local training,
 * but NOT a confidential onchain BLACKSITE mission. No graphics production.
 *
 * DOM surface is separate from Phaser so keyboard/touch accessibility and
 * error states can be tested before final character/mission art begins.
 * Never inject secret codes into HTML, logs or public state attributes.
 */
type Mission=ReturnType<typeof createBlacksiteLocalMission>;
type PublicMission=ReturnType<typeof publicBlacksiteLocalMission>;
type Action='begin'|'guess'|'debrief'|'retry'|'back';

function newLocalSecret():number[]{
  // Random local practice scenarios only, NOT secret generation for FHE.
  const bytes=window.crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes,value=>value%4);
}
function newLocalMissionId():string{
  const value=window.crypto.getRandomValues(new Uint32Array(1))[0];
  return 'local-'+Date.now().toString(36)+'-'+value.toString(36);
}
function control<T extends HTMLElement>(root:ParentNode,id:string):T{
  const found=root.querySelector<T>('#'+id);
  if(!found)throw Error('BLACKSITE functional control missing: '+id);
  return found;
}
function makeParagraph(value:string,tag:'li'|'span'='li'):HTMLElement{
  const p=document.createElement(tag);
  p.textContent=value;
  return p;
}

export function mountBlacksiteGreybox():void{
  if(document.getElementById('gambit-blacksite-open'))return;
  const launch=document.createElement('button');
  launch.type='button';
  launch.id='gambit-blacksite-open';
  launch.textContent='BLACKSITE · LOCAL MISSION';
  launch.setAttribute('aria-haspopup','dialog');
  launch.setAttribute('aria-expanded','false');
  launch.setAttribute('aria-controls','gambit-blacksite-dialog');

  const backdrop=document.createElement('div');
  backdrop.id='gambit-blacksite-overlay';
  backdrop.hidden=true;
  backdrop.dataset.phase='closed';
  backdrop.innerHTML=`
    <section id="gambit-blacksite-dialog" role="dialog" aria-modal="true"
      aria-labelledby="gambit-blacksite-title" tabindex="-1">
      <header class="gb-head">
        <div>
          <strong id="gambit-blacksite-title">BLACKSITE</strong>
          <p>LOCAL CODEBREAKER · NOT ENCRYPTED · NO WALLET</p>
        </div>
        <button id="gambit-blacksite-back" type="button" data-action="back"
          aria-label="Return to Arena without ending the mission">RETURN TO ARENA</button>
      </header>
      <p id="gambit-blacksite-help">
        Four ordered glyphs, each 0–3. Duplicates are allowed. You have five guesses.
        Exact means the correct glyph in the correct slot. Misplaced means a correct
        glyph in a different slot. This is transparent local practice, NOT FHE.
      </p>
      <div class="gb-status">
        <span id="gambit-blacksite-phase">BRIEFING</span>
        <span id="gambit-blacksite-attempts">5 ATTEMPTS LEFT</span>
      </div>
      <p id="gambit-blacksite-message" role="status" aria-live="polite"></p>
      <div id="gambit-blacksite-briefing">
        <h2>BREACH THE PRACTICE VAULT</h2>
        <p>Use the clue after each attempt to narrow down the hidden code.
          The game checks your actual sequence. You cannot replay a guess for another clue.</p>
        <button id="gambit-blacksite-begin" type="button" data-action="begin">
          START LOCAL MISSION
        </button>
      </div>
      <div id="gambit-blacksite-active" hidden>
        <h2>PROGRAM YOUR ATTEMPT</h2>
        <form id="gambit-blacksite-guess-form">
          <fieldset>
            <legend>Choose four code glyphs</legend>
            <div class="gb-glyphs">
              <label>GLYPH 1 <select id="gambit-blacksite-glyph-0" aria-label="Glyph 1">
                <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
              </select></label>
              <label>GLYPH 2 <select id="gambit-blacksite-glyph-1" aria-label="Glyph 2">
                <option value="0">0</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option>
              </select></label>
              <label>GLYPH 3 <select id="gambit-blacksite-glyph-2" aria-label="Glyph 3">
                <option value="0">0</option><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option>
              </select></label>
              <label>GLYPH 4 <select id="gambit-blacksite-glyph-3" aria-label="Glyph 4">
                <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option>
              </select></label>
            </div>
          </fieldset>
          <button id="gambit-blacksite-submit" type="submit">SUBMIT ATTEMPT</button>
        </form>
      </div>
      <div id="gambit-blacksite-terminal" hidden>
        <h2 id="gambit-blacksite-result">MISSION COMPLETE</h2>
        <p id="gambit-blacksite-result-description"></p>
        <button id="gambit-blacksite-debrief-button" type="button" data-action="debrief">
          VIEW MISSION DEBRIEF
        </button>
      </div>
      <div id="gambit-blacksite-debrief" hidden>
        <h2>MISSION DEBRIEF</h2>
        <p id="gambit-blacksite-review"></p>
        <button id="gambit-blacksite-retry" type="button" data-action="retry">
          NEW LOCAL MISSION
        </button>
      </div>
      <section class="gb-evidence" aria-labelledby="gambit-blacksite-history-title">
        <h2 id="gambit-blacksite-history-title">ATTEMPT HISTORY</h2>
        <ol id="gambit-blacksite-history"></ol>
        <p id="gambit-blacksite-empty">No attempts yet.</p>
      </section>
      <footer>LOCAL GREYBOX · NO CHAIN CALLS · NO ENCRYPTED PROOF OR PLAYER RANK</footer>
    </section>`;
  document.body.append(launch,backdrop);

  let mission:Mission|null=null;
  let shell=createGameShell();
  let message='Choose Start to begin local training.';
  let previousFocus:HTMLElement|null=null;
  let priorInert:Array<{element:HTMLElement,inert:boolean}>=[];
  const dialog=control<HTMLElement>(backdrop,'gambit-blacksite-dialog');
  const form=control<HTMLFormElement>(backdrop,'gambit-blacksite-guess-form');
  const section=(name:string)=>control<HTMLElement>(backdrop,'gambit-blacksite-'+name);
  const onAction=(name:Action)=>{
    try{
      if(name==='back'){close();return}
      if(!mission)throw Error('Start a local mission first.');
      if(name==='begin'){
        mission=beginBlacksiteLocalMission(mission);
        message='Mission active. Enter a code, then submit one attempt.';
      }else if(name==='guess'){
        const guess=[0,1,2,3].map(index=>{
          const select=control<HTMLSelectElement>(backdrop,
            'gambit-blacksite-glyph-'+index);
          return Number(select.value);
        });
        const result=guessBlacksiteLocalMission(mission,guess);
        mission=result.state;
        message=result.event.status==='breached'
          ?'Breach confirmed by the local training rules.'
          :result.event.status==='locked'
            ?'Five attempts consumed. Local vault locked.'
            :result.event.exact+' exact, '+result.event.misplaced+
              ' misplaced. '+result.event.remaining+' attempts remain.';
      }else if(name==='debrief'){
        mission=debriefBlacksiteLocalMission(mission);
        message='Review the recorded clues, or begin a fresh mission.';
      }else if(name==='retry'){
        mission=restartBlacksiteLocalMission(
          mission,newLocalMissionId(),newLocalSecret());
        message='New local vault created. Start when ready.';
      }
    }catch(error){
      message=error instanceof Error?error.message:'Local mission rejected the action.';
    }
    render();
  };
  function render(){
    if(!mission)return;
    const current=publicBlacksiteLocalMission(mission) as PublicMission;
    backdrop.dataset.phase=current.phase;
    backdrop.dataset.round=String(current.round);
    backdrop.dataset.remaining=String(current.remaining);
    section('phase').textContent=current.phase.toUpperCase();
    section('attempts').textContent=current.remaining+' ATTEMPTS LEFT';
    section('message').textContent=message;
    section('briefing').hidden=current.phase!=='briefing';
    section('active').hidden=current.phase!=='active';
    section('terminal').hidden=!['breached','locked'].includes(current.phase);
    section('debrief').hidden=current.phase!=='debrief';
    const breached=current.outcome==='breached';
    section('result').textContent=breached?'VAULT BREACHED':'VAULT LOCKED';
    section('result-description').textContent=breached
      ?'Your submitted code matched all four glyphs. This is a local training result only.'
      :'The five-attempt budget was exhausted. This is a local training result only.';
    section('review').textContent=breached
      ?'Success after '+current.round+' recorded '+(current.round===1?'attempt':'attempts')+'. Local practice has no public ranking.'
      :'No successful code within five attempts. Review the exact and misplaced counts, then start a new local vault.';
    const history=control<HTMLOListElement>(backdrop,'gambit-blacksite-history');
    const empty=section('empty');
    empty.hidden=current.history.length!==0;
    history.replaceChildren(...current.history.map((event:{round:number,guess:number[],exact:number,misplaced:number})=>
      makeParagraph('Attempt '+event.round+' · '+event.guess.join(' ')+' · '+
        event.exact+' EXACT · '+event.misplaced+' MISPLACED')));
    // Never render mission.secret or any hidden code; the public mission
    // snapshot is the ONLY data source for this page.
  }
  function open(){
    if(!backdrop.hidden)return;
    if(document.getElementById('gambit-squad-dialog')?.getAttribute('aria-hidden')==='false')
      return; // Never put a practice overlay over a connected wallet dialog.
    previousFocus=document.activeElement instanceof HTMLElement?
      document.activeElement:null;
    if(!mission){
      mission=createBlacksiteLocalMission(newLocalMissionId(),newLocalSecret());
    }
    priorInert=[];
    for(const id of ['app','gambit-mobile-deck','gambit-squad-launch']){
      const element=document.getElementById(id);
      if(element instanceof HTMLElement){
        priorInert.push({element,inert:element.inert});
        element.inert=true;
      }
    }
    // Mode is enabled only as LOCAL TRAINING by the shared shell.
    // The planned competitive BLACKSITE mission remains unavailable.
    shell=transitionGameShell(shell,{type:'OPEN',scene:'blacksite-training'});
    backdrop.dataset.scene=shell.scene;
    document.body.dataset.gambitFeatureOverlay='blacksite';
    backdrop.hidden=false;
    launch.setAttribute('aria-expanded','true');
    render();
    const first=currentFirstAction();
    first.focus();
  }
  function currentFirstAction():HTMLElement{
    if(mission?.phase==='active')return control<HTMLElement>(backdrop,
      'gambit-blacksite-glyph-0');
    if(mission?.phase==='debrief')return control<HTMLElement>(backdrop,
      'gambit-blacksite-retry');
    if(mission?.phase==='breached'||mission?.phase==='locked')
      return control<HTMLElement>(backdrop,'gambit-blacksite-debrief-button');
    return control<HTMLElement>(backdrop,'gambit-blacksite-begin');
  }
  function close(){
    if(backdrop.hidden)return;
    backdrop.hidden=true;
    backdrop.dataset.phase='closed';
    shell=transitionGameShell(shell,{type:'BACK'});
    backdrop.dataset.scene=shell.scene;
    delete document.body.dataset.gambitFeatureOverlay;
    launch.setAttribute('aria-expanded','false');
    for(const {element,inert} of priorInert)element.inert=inert;
    priorInert=[];
    (previousFocus?.isConnected?previousFocus:launch)?.focus();
    // Session's actual training state remains in memory for reopening.
    // A browser refresh starts a new local mission by design.
  }
  launch.addEventListener('click',open);
  backdrop.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-action]');
    if(!button)return;
    onAction(button.dataset.action as Action);
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    onAction('guess');
  });
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([hidden]),select:not([disabled])'))
      .filter(node=>node.offsetParent!==null);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  });
}
