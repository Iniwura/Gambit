import './coach.css';
import {
  createTrainingCoach,advanceTrainingCoach,trainingCoachPresentation
} from './coach.mjs';

/**
 * Optional Academy walk-through of one REAL offline, three-lane practice
 * round. It observes verified Phaser practice transitions only. No calls to
 * the squad rule engine, wallet, public RPC or storage are made here.
 */
type CoachState=ReturnType<typeof createTrainingCoach>;
type PracticeEvent={
  type:string,phase?:string,role?:number,field?:string,index?:number,
  round?:number,lanes?:number,scoreline?:string
};
function get<T extends HTMLElement>(root:ParentNode,id:string):T{
  const element=root.querySelector<T>('#'+id);
  if(!element)throw Error('Training guide control missing: '+id);
  return element;
}
export function mountTrainingCoach():void{
  if(document.getElementById('gambit-training-open'))return;
  const launch=document.createElement('button');
  launch.id='gambit-training-open';
  launch.type='button';
  launch.textContent='TRAINING · GUIDED ROUND';
  launch.setAttribute('aria-expanded','false');
  launch.setAttribute('aria-controls','gambit-training-panel');

  const mobileLaunch=launch.cloneNode(false) as HTMLButtonElement;
  mobileLaunch.id='gambit-training-mobile-open';
  mobileLaunch.textContent='TRAINING · GUIDED ROUND';

  const panel=document.createElement('section');
  panel.id='gambit-training-panel';
  panel.setAttribute('aria-labelledby','gambit-training-title');
  panel.setAttribute('aria-label','Optional real practice tutorial');
  panel.hidden=true;
  panel.dataset.guideStep='closed';
  panel.dataset.guideCompleted='false';
  panel.innerHTML=`
    <div class="gt-head">
      <div><strong id="gambit-training-title">TACTICAL ACADEMY</strong>
        <small>LOCAL PRACTICE ONLY · NO WALLET</small></div>
      <button id="gambit-training-close" type="button">END GUIDE</button>
    </div>
    <div class="gt-progress"><span id="gambit-training-step-count">STEP 1 / 9</span>
      <span id="gambit-training-state">IN PROGRESS</span></div>
    <h2 id="gambit-training-step-title"></h2>
    <p id="gambit-training-instruction"></p>
    <p id="gambit-training-device-hint"></p>
    <p id="gambit-training-result" hidden></p>
    <small id="gambit-training-boundary">Your decisions run in the existing
      3v3 local practice match. The bot result is not scripted and no
      encrypted opponent tactics are shown.</small>`;
  document.body.append(launch,panel);
  const mobileHead=document.querySelector('#gambit-profile-mobile-open') ??
    document.querySelector('#gambit-blacksite-mobile-open') ??
    document.querySelector('#gambit-mobile-deck .gambit-mobile-head');
  mobileHead?.after(mobileLaunch);

  let state:CoachState|null=null;
  let pausedReason='';
  const isMobile=()=>window.matchMedia('(max-width:700px)').matches;
  function relocate(){
    if(isMobile()&&mobileLaunch.isConnected)
      mobileLaunch.after(panel);
    else document.body.append(panel);
  }
  function render(){
    relocate();
    if(!state){
      panel.dataset.guideStep='unavailable';
      panel.dataset.guideCompleted='false';
      get<HTMLElement>(panel,'gambit-training-step-title').textContent=
        'Practice needs to be ready';
      get<HTMLElement>(panel,'gambit-training-instruction').textContent=
        pausedReason||'Open local practice before launching a guide.';
      get<HTMLElement>(panel,'gambit-training-device-hint').textContent='';
      get<HTMLElement>(panel,'gambit-training-result').hidden=true;
      get<HTMLElement>(panel,'gambit-training-step-count').textContent='NOT STARTED';
      get<HTMLElement>(panel,'gambit-training-state').textContent='LOCAL ONLY';
      return;
    }
    const view=trainingCoachPresentation(state);
    panel.dataset.guideStep=view.id;
    panel.dataset.guideIndex=String(state.index);
    panel.dataset.guideCompleted=String(view.completed);
    get<HTMLElement>(panel,'gambit-training-step-count').textContent=
      'STEP '+view.stepNumber+' / '+view.total;
    get<HTMLElement>(panel,'gambit-training-state').textContent=
      view.completed?'FIRST ROUND VERIFIED':'LOCAL PRACTICE';
    get<HTMLElement>(panel,'gambit-training-step-title').textContent=view.title;
    get<HTMLElement>(panel,'gambit-training-instruction').textContent=view.instruction;
    get<HTMLElement>(panel,'gambit-training-device-hint').textContent=
      (isMobile()?view.mobile:view.desktop);
    const summary=get<HTMLElement>(panel,'gambit-training-result');
    summary.hidden=!view.completed;
    if(view.completed&&view.settled){
      summary.textContent='Real round '+view.settled.round+
        ' · reactor score '+view.settled.scoreline+
        ' · '+view.settled.lanes+' resolved lanes. No tutorial win was invented.';
    }else summary.textContent='';
  }
  function open(){
    if(!panel.hidden)return;
    if(document.body.dataset.gambitFeatureOverlay||
       document.getElementById('gambit-squad-dialog')?.hidden===false||
       document.getElementById('gambit-chain-dialog')?.hidden===false)
      return;
    const phase=document.getElementById('game-state')?.dataset.phase;
    if(phase==='intro'||phase==='ready'){
      state=createTrainingCoach(phase);
      pausedReason='';
    }else{
      state=null;
      pausedReason='Wait for an active local practice round, or start a new rematch.';
    }
    panel.hidden=false;
    launch.setAttribute('aria-expanded','true');
    mobileLaunch.setAttribute('aria-expanded','true');
    render();
  }
  function close(){
    if(panel.hidden)return;
    panel.hidden=true;
    panel.dataset.guideStep='closed';
    panel.dataset.guideCompleted='false';
    state=null;
    launch.setAttribute('aria-expanded','false');
    mobileLaunch.setAttribute('aria-expanded','false');
    (isMobile()?mobileLaunch:launch).focus();
  }
  launch.addEventListener('click',open);
  mobileLaunch.addEventListener('click',open);
  get<HTMLButtonElement>(panel,'gambit-training-close')
    .addEventListener('click',close);
  window.addEventListener('resize',()=>{
    if(!panel.hidden)render();
  });
  window.addEventListener('gambit:practice-event',event=>{
    if(panel.hidden||!state)return;
    const detail=(event as CustomEvent<PracticeEvent>).detail;
    if(!detail)return;
    if(detail.type==='onchain'){close();return;}
    try{
      state=advanceTrainingCoach(state,detail);
      render();
    }catch(error){
      // Never rewrite the game state, pretend the lesson advanced or reveal
      // private actions when a malformed event reaches this observer.
      pausedReason=error instanceof Error?error.message:'Unrecognized practice event';
      get<HTMLElement>(panel,'gambit-training-device-hint').textContent=
        'Guide event rejected. The underlying game remains unchanged.';
    }
  });
}
