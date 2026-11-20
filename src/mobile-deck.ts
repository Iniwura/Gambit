/**
 * Accessible touch command deck for GAMBIT's cleartext SOLO PRACTICE.
 * This UI does not perform wallet signing, encryption, or blockchain writes.
 * It emits intent only; Phaser's authoritative practice scene validates it.
 */
export type MobileField='base'|'trigger'|'response';
export type MobilePlan={base:number,trigger:number,response:number};
export type MobilePhase='intro'|'ready'|'resolving'|'finished'|'chain';
export type MobileReport={round:number,heading:string,scoreline:string,note:string,
  lanes:{leftRole:string,rightRole:string,verdict:string,outcome:number}[]};

const NAMES=['STRIKE','GUARD','FLANK'] as const;
const ROLE_LABELS=['SCOUT','GUARDIAN','STRIKER'] as const;
const FORMATION_NAMES=['HOLD','PIVOT','FEINT'] as const;
const PRACTICE_STYLES=['steady','reactive','volatile'] as const;
const ROLE_HINTS=[
  'Scout marks a winning Striker for +1 pressure.',
  'Guardian blocks one enemy breach bonus.',
  'Striker gets +1 breach pressure when victorious.'
] as const;

function publish(action:string,extras:Record<string,string|number>={}){
  window.dispatchEvent(new CustomEvent('gambit:mobile-control',{detail:{action,...extras}}));
}

function button(label:string,action:()=>void):HTMLButtonElement{
  const b=document.createElement('button');
  b.type='button';
  b.textContent=label;
  b.addEventListener('click',action);
  return b;
}

export function createMobileDeck(){
  const deck=document.createElement('section');
  deck.id='gambit-mobile-deck';
  deck.setAttribute('aria-label','Practice squad command deck');
  const head=document.createElement('header');
  head.className='gambit-mobile-head';
  const title=document.createElement('strong');
  title.textContent='COMMAND DECK';
  const phase=document.createElement('span');
  phase.textContent='SOLO PRACTICE';
  head.append(title,phase);

  const intro=button('ENTER ARENA',()=>publish('start'));
  intro.id='gambit-mobile-enter';
  intro.className='gambit-mobile-primary';

  const styleHeading=document.createElement('div');
  styleHeading.className='gambit-mobile-action-label';
  styleHeading.textContent='CHOOSE YOUR OPPONENT';
  const styleGroup=document.createElement('div');
  styleGroup.className='gambit-mobile-choices';
  styleGroup.setAttribute('role','group');
  styleGroup.setAttribute('aria-label','Practice opponent style');
  const styleButtons=PRACTICE_STYLES.map(style=>{
    const b=button(style.toUpperCase(),()=>publish('style',{style}));
    b.className='gambit-mobile-style';
    b.setAttribute('aria-pressed','false');
    styleGroup.append(b);
    return b;
  });

  const reportPanel=document.createElement('section');
  reportPanel.id='gambit-mobile-report';
  reportPanel.setAttribute('aria-label','Last public practice round');
  reportPanel.setAttribute('aria-live','polite');
  reportPanel.hidden=true;
  const reportTitle=document.createElement('strong');
  reportTitle.className='gambit-mobile-report-heading';
  const reportScores=document.createElement('span');
  reportScores.className='gambit-mobile-report-scores';
  const reportLanes=document.createElement('div');
  reportLanes.className='gambit-mobile-report-lanes';
  const reportNote=document.createElement('small');
  reportNote.className='gambit-mobile-report-note';
  reportPanel.append(reportTitle,reportScores,reportLanes,reportNote);

  const roleGroup=document.createElement('div');
  roleGroup.className='gambit-mobile-role-group';
  roleGroup.setAttribute('role','group');
  roleGroup.setAttribute('aria-label','Choose a fighter');
  const roleButtons=ROLE_LABELS.map((name,i)=>{
    const b=button(name,()=>publish('role',{role:i}));
    b.className='gambit-mobile-role';
    b.setAttribute('aria-pressed','false');
    roleGroup.append(b);
    return b;
  });

  const roleInfo=document.createElement('p');
  roleInfo.id='gambit-mobile-role-info';

  const formationHeading=document.createElement('div');
  formationHeading.className='gambit-mobile-action-label';
  formationHeading.textContent='SQUAD DEPLOYMENT';
  const formationGroup=document.createElement('div');
  formationGroup.className='gambit-mobile-choices';
  formationGroup.setAttribute('role','group');
  formationGroup.setAttribute('aria-label','Choose squad deployment');
  const formationButtons=FORMATION_NAMES.map((name,i)=>{
    const b=button(name,()=>publish('formation',{formation:i}));
    b.className='gambit-mobile-formation';
    b.setAttribute('aria-pressed','false');
    formationGroup.append(b);
    return b;
  });
  const actionButtons:{field:MobileField,buttons:HTMLButtonElement[]}[]=[];
  const commands=document.createElement('div');
  commands.className='gambit-mobile-commands';
  const configs:{field:MobileField,label:string}[]=[
    {field:'base',label:'OPEN WITH'},
    {field:'trigger',label:'IF ENEMY OPENS WITH'},
    {field:'response',label:'THEN COUNTER WITH'}
  ];
  for(const entry of configs){
    const group=document.createElement('div');
    group.className='gambit-mobile-action-group';
    const heading=document.createElement('div');
    heading.className='gambit-mobile-action-label';
    heading.textContent=entry.label;
    const choices=document.createElement('div');
    choices.className='gambit-mobile-choices';
    choices.setAttribute('role','group');
    choices.setAttribute('aria-label',entry.label);
    const buttons=NAMES.map((name,i)=>{
      const b=button(name,()=>publish('choose',{field:entry.field,value:i}));
      b.className='gambit-mobile-choice';
      b.setAttribute('aria-pressed','false');
      choices.append(b);
      return b;
    });
    actionButtons.push({field:entry.field,buttons});
    group.append(heading,choices);
    commands.append(group);
  }

  const lock=button('LOCK ALL THREE TACTICS',()=>publish('lock'));
  lock.id='gambit-mobile-lock';
  lock.className='gambit-mobile-primary';
  const retry=button('PLAY REMATCH',()=>publish('rematch'));
  retry.id='gambit-mobile-rematch';
  retry.className='gambit-mobile-primary';
  const footer=document.createElement('small');
  footer.className='gambit-mobile-footnote';
  footer.textContent='Local practice only. Encrypted online squad battles are still in development.';

  deck.append(head,styleHeading,styleGroup,intro,reportPanel,roleGroup,roleInfo,formationHeading,formationGroup,commands,lock,retry,footer);
  document.body.append(deck);
  function sync(state:{selectedRole:number,formation:number,plan:MobilePlan,phase:MobilePhase,
    report:MobileReport|null,style:string,plans:MobilePlan[]}){
    const {selectedRole,formation,plan,phase:stage,report,style,plans}=state;
    reportPanel.hidden=!report||stage==='intro'||stage==='chain'||stage==='resolving';
    if(report&&!reportPanel.hidden){
      reportTitle.textContent=report.heading;
      reportScores.textContent=report.scoreline;
      reportLanes.replaceChildren(...report.lanes.map(lane=>{
        const entry=document.createElement('span');
        entry.className='gambit-mobile-report-lane';
        entry.dataset.outcome=String(lane.outcome);
        entry.textContent=lane.leftRole+' / '+lane.rightRole+'  '+lane.verdict;
        return entry;
      }));
      reportNote.textContent=report.note;
    }
    const ready=stage==='ready';
    deck.dataset.phase=stage;
    phase.textContent=stage==='resolving'?'RESOLVING ALL THREE':stage==='finished'?'MATCH COMPLETE':
      stage==='chain'?'VERIFIED DUEL':'LOCAL PRACTICE';
    intro.hidden=stage!=='intro';
    styleHeading.hidden=stage!=='intro';
    styleGroup.hidden=stage!=='intro';
    styleButtons.forEach((b,i)=>{
      b.disabled=stage!=='intro';
      b.setAttribute('aria-pressed',String(PRACTICE_STYLES[i]===style));
    });
    retry.hidden=stage!=='finished';
    lock.hidden=stage==='intro'||stage==='finished'||stage==='chain';
    formationHeading.hidden=stage==='intro'||stage==='finished'||stage==='chain';
    formationGroup.hidden=stage==='intro'||stage==='finished'||stage==='chain';
    lock.disabled=!ready;
    for(let i=0;i<roleButtons.length;i++){
      const b=roleButtons[i];
      b.textContent=ROLE_LABELS[i]+' · '+NAMES[plans[i]?.base??0];
      b.disabled=!ready;
      b.setAttribute('aria-pressed',String(i===selectedRole));
    }
    roleInfo.textContent=ROLE_HINTS[selectedRole]??ROLE_HINTS[0];
    formationButtons.forEach((b,i)=>{
      b.disabled=!ready;
      b.setAttribute('aria-pressed',String(formation===i));
    });
    for(const group of actionButtons){
      for(let i=0;i<group.buttons.length;i++){
        const b=group.buttons[i];
        b.disabled=!ready;
        b.setAttribute('aria-pressed',String(plan[group.field]===i));
      }
    }
  }
  return {sync};
}
