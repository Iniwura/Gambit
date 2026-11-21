import Phaser from 'phaser';
import {makeSquadMatch,commitSquadTurn,startingSquadPlans,SQUAD_ROLES,FORMATIONS,PRACTICE_STYLES,enemySquadFor,enemyFormationFor} from './squad.mjs';
import {buildPracticeInsight} from './practice-insight.mjs';
import {buildPracticeMatchDebrief} from './practice-match-debrief.mjs';
import {createMobileDeck} from './mobile-deck';
import {mountBlacksiteGreybox} from './blacksite/greybox';
import {mountCommanderPublicViewer} from './profile/greybox';
import {mountTrainingCoach} from './training/coach-ui';
import {buildPracticeDebrief} from './tactical-report.mjs';
import {renderReactorDeck} from './visual/arena';
import {makeFighter} from './visual/characters';
import type {SquadResult,FighterPlan} from './chain/squad-sepolia';

/**
 * GAMBIT's actual Phaser gameplay entrypoint.
 * MODE: OFFLINE three-role squad practice. The strategy engine is CLEAR TEXT.
 * The current deployed Sepolia contract accepts ONE plan only: never
 * mistake the full-squad practice game for a verified encrypted 3v3 match.
 * Gameplay and visual presentation are intentionally decoupled.
 */
const W=1440,H=810;
const C={cyan:0x58e4f3,pink:0xfa69ae,gold:0xffcb62,white:'#eff8ff'};
const SPAWN_POSITIONS=[{x:288,y:299},{x:244,y:407},{x:303,y:515},{x:1138,y:299},{x:1181,y:407},{x:1120,y:515}];
type Field='base'|'trigger'|'response';
type PracticeStyle='steady'|'reactive'|'volatile';
type Plan={base:number,trigger:number,response:number};
type PracticeReport={round:number,heading:string,scoreline:string,note:string,lanes:Array<{lane:number,leftRole:string,rightRole:string,verdict:string,outcome:number}>};
type VerifiedDuel={challengeId:bigint,outcome:0|1|2,explorerUrl:string,authenticated:true};
let lastSelectedPlan:Plan={...startingSquadPlans()[0]};
let practiceSessionCount=0;
let selectedPracticeStyle:PracticeStyle='reactive';
type Actor={shell:Phaser.GameObjects.Container,origin:{x:number,y:number}};
const names=['STRIKE','GUARD','FLANK'];
const mobileDeck=createMobileDeck();
// Observations ONLY: the trainer never commands combat, wallet or scoring.
function emitLocalPractice(detail:Record<string,string|number>){
  window.dispatchEvent(new CustomEvent('gambit:practice-event',{detail}));
}
class GambitArena extends Phaser.Scene {
  private match=makeSquadMatch(1102);
  private squadPlans:Plan[]=startingSquadPlans();
  private selectedRole=0;
  private formation=0;
  private plan:Plan=this.squadPlans[0];
  private busy=false;
  private finished=false;
  private active=false;
  private actors:Actor[]=[];
  private round!:Phaser.GameObjects.Text;
  private scoreboard!:Phaser.GameObjects.Text;
  private notice!:Phaser.GameObjects.Text;
  private hint!:Phaser.GameObjects.Text;
  private choices:Record<Field,Phaser.GameObjects.Rectangle[]>={base:[],trigger:[],response:[]};
  private roleButtons:Phaser.GameObjects.Rectangle[]=[];
  private roleHint!:Phaser.GameObjects.Text;
  private formationButtons:Phaser.GameObjects.Rectangle[]=[];
  private styleButtons:Phaser.GameObjects.Rectangle[]=[];
  private battleReport?:Phaser.GameObjects.Container;
  private lastDebrief:PracticeReport|null=null;
  private buttons:Phaser.GameObjects.Container[]=[];
  private keyboardListener?: (e:KeyboardEvent)=>void;
  private watchingVerifiedDuel=false;
  constructor(){super('GambitArena');}

  create(){
    // Phaser Scene.restart() reuses this class instance. All mutable gameplay
    // state and GameObject references MUST be reset on every create().
    // A fresh local opponent scenario on rematch: no wallet, signing,
    // nondeterministic onchain behavior or fake opponent session.
    const practiceSeed=(1102+Math.imul(practiceSessionCount++,0x9e3779b1))>>>0;
    this.match=makeSquadMatch(practiceSeed,selectedPracticeStyle);
    this.squadPlans=startingSquadPlans();
    this.selectedRole=0;
    this.formation=0;
    this.plan=this.squadPlans[0];
    lastSelectedPlan={...this.plan};
    this.busy=false;
    this.finished=false;
    this.active=false;
    this.watchingVerifiedDuel=false;
    const mode=document.getElementById('status');
    if(mode)mode.textContent='LOCAL PRACTICE · NOT ENCRYPTED';
    this.actors=[];
    this.buttons=[];
    this.choices={base:[],trigger:[],response:[]};
    this.roleButtons=[];
    this.formationButtons=[];
    this.styleButtons=[];
    this.battleReport=undefined;
    this.lastDebrief=null;
    const gameplayState=document.getElementById('game-state');
    if(gameplayState){
      delete gameplayState.dataset.lastLaneCount;
      delete gameplayState.dataset.roleEffectStarts;
      delete gameplayState.dataset.lastRoleEffects;
      delete gameplayState.dataset.activeLane;
      delete gameplayState.dataset.lastLaneOrder;
      delete gameplayState.dataset.enemyFormation;
      delete gameplayState.dataset.reportRound;
      delete gameplayState.dataset.challengeId;
      delete gameplayState.dataset.outcome;
    }
    this.cameras.main.setBackgroundColor('#060b16');
    this.drawWorld();
    this.drawFighters();
    this.drawHUD();
    this.drawControls();
    this.refresh();
    this.writeState('intro');
    emitLocalPractice({type:'reset',phase:'intro'});
    this.intro();
    this.keyboardListener=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement)return;
      if(document.body.dataset.gambitFeatureOverlay)return;
      if(!this.active||this.busy||this.finished)return;
      const key=e.key.toLowerCase();
      if(['4','5','6'].includes(key)){this.selectRole(Number(key)-4);return;}
      if(['7','8','9'].includes(key)){this.selectFormation(Number(key)-7);return;}
      const groups:Record<Field,string[]>={base:['1','2','3'],trigger:['q','w','e'],response:['a','s','d']};
      for(const f of Object.keys(groups) as Field[]){const n=groups[f].indexOf(key);if(n>=0)this.choose(f,n);}
      if(key==='enter'||key===' '){e.preventDefault();this.lockPlan();}
    };
    window.addEventListener('keydown',this.keyboardListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      if(this.keyboardListener)window.removeEventListener('keydown',this.keyboardListener);
      this.game.events.off('gambit:verified-duel',this.showVerifiedDuel,this);
      this.game.events.off('gambit:verified-squad',this.showVerifiedSquad,this);
    });
    this.game.events.on('gambit:verified-duel',this.showVerifiedDuel,this);
    this.game.events.on('gambit:verified-squad',this.showVerifiedSquad,this);
    const touchCommand=(e:Event)=>{
      const command=(e as CustomEvent<{action:string,role?:number,formation?:number,field?:Field,value?:number,style?:PracticeStyle}>).detail;
      if(!command||document.body.dataset.gambitFeatureOverlay)return;
      if(command.action==='style'&&typeof command.style==='string')this.selectPracticeStyle(command.style);
      else if(command.action==='role'&&typeof command.role==='number')this.selectRole(command.role);
      else if(command.action==='formation'&&typeof command.formation==='number')this.selectFormation(command.formation);
      else if(command.action==='choose'&&command.field&&typeof command.value==='number')
        this.choose(command.field,command.value);
      else if(command.action==='lock')this.lockPlan();
      else if(command.action==='rematch'&&this.finished)this.scene.restart();
    };
    window.addEventListener('gambit:mobile-control',touchCommand);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>
      window.removeEventListener('gambit:mobile-control',touchCommand));
    this.syncMobileDeck();
  }

  /**
   * Capture a validated snapshot for the separately configured v2 panel.
   * This does NOT transmit plans or request a wallet signature.
   */
  public squadSnapshot():{plans:FighterPlan[],formation:number}{
    if(this.busy||this.watchingVerifiedDuel||(!this.active&&!this.finished))
      throw Error('Enter practice to choose your squad before sealing it on Sepolia.');
    return {
      plans:this.squadPlans.map(p=>({
        base:p.base as 0|1|2,trigger:p.trigger as 0|1|2,
        response:p.response as 0|1|2
      })),
      formation:this.formation
    };
  }

  private syncMobileDeck(){
    const phase=this.watchingVerifiedDuel?'chain':this.finished?'finished':
      this.busy?'resolving':this.active?'ready':'intro';
    mobileDeck.sync({selectedRole:this.selectedRole,formation:this.formation,plan:this.plan,plans:this.squadPlans,phase,report:this.lastDebrief,style:this.match.style,summary:this.finished?buildPracticeMatchDebrief(this.match):null});
  }

  private writeState(phase:string){
    const el=document.getElementById('game-state');
    if(!el)return;
    el.dataset.phase=phase;
    el.dataset.round=String(this.match.round);
    el.dataset.finished=String(this.finished);
    el.dataset.scoreA=String(this.match.scoreA);
    el.dataset.scoreB=String(this.match.scoreB);
    el.dataset.practiceMode='three-role-squad';
    el.dataset.opponentStyle=this.match.style;
    el.dataset.practiceSeed=String(this.match.seed);
    if(this.lastDebrief)el.dataset.reportRound=String(this.lastDebrief.round);
    else delete el.dataset.reportRound;
    el.dataset.fighterPlans=String(this.squadPlans.length);
    el.dataset.selectedRole=SQUAD_ROLES[this.selectedRole];
    el.dataset.formation=FORMATIONS[this.formation].name;
    el.dataset.selectedBase=String(this.plan.base);
    el.dataset.selectedTrigger=String(this.plan.trigger);
    el.dataset.selectedResponse=String(this.plan.response);
    el.textContent=phase==='finished'
      ? 'Match complete. '+(this.match.winner===1?'Victory':this.match.winner===2?'Defeat':'Draw')
      : 'GAMBIT '+phase+', round '+(this.match.round+1);
    this.syncMobileDeck();
  }

  private text(x:number,y:number,s:string,px=16,color=C.white,bold=false) {
    return this.add.text(x,y,s,{fontFamily:'Arial, sans-serif',fontSize:px+'px',fontStyle:bold?'bold':'normal',color,
      stroke:'#070a17',strokeThickness:px>26?2:0});
  }

  private drawWorld(){
    renderReactorDeck(this);
  }

  private drawFighters(){
    for(let i=0;i<6;i++){
      const pos=SPAWN_POSITIONS[i];
      const unit=makeFighter(this,i,pos.x,pos.y);
      if(i<3)unit.on('pointerdown',()=>{
        if(this.active&&!this.busy&&!this.finished)this.selectRole(i);
      });
      this.actors.push({shell:unit,origin:{...pos}});
      // Characters do not idle-tween x/y: their combat approach uses those
      // coordinates and must never fight another overlapping tween.
    }
  }

  private drawHUD(){
    const h=this.add.rectangle(W/2,45,W,90,0x070c1a,.94).setDepth(1900);
    h.setStrokeStyle(2,0x475b80,.65);
    this.text(30,18,'GAMBIT',35,C.white,true).setDepth(2000);
    this.text(31,60,'3V3 SQUAD PRACTICE  ·  NOT ENCRYPTED',13,'#a2cce2',true).setDepth(2000);
    this.round=this.text(720,19,'ROUND 1 / 5',23,C.white,true).setOrigin(.5,0).setDepth(2000);
    this.scoreboard=this.text(720,51,'0 : 0',24,'#ffe3a7',true).setOrigin(.5,0).setDepth(2000);
    // Arena already labels the defending team. Avoid overlapping the two wallet-lab controls.
    const shadow=this.add.rectangle(720,121,690,47,0x090d1a,.8).setStrokeStyle(1,0x49678f,.55).setDepth(1900);
    this.notice=this.text(720,107,'Command three fighters. Win the reactor.',20,'#fff0b5',true).setOrigin(.5,0).setDepth(2000);
    this.hint=this.text(720,154,'Select each fighter. Give them a move and a conditional counter.',15,'#d7e7ff').setOrigin(.5,0).setDepth(2000);
  }

  private button(x:number,y:number,w:number,h:number,title:string,cb:()=>void,accent=C.cyan){
    const c=this.add.container(x,y).setDepth(3000);
    const rect=this.add.rectangle(0,0,w,h,0x17263f,1).setStrokeStyle(2,0x57698f,.7);
    const label=this.text(0,0,title,15,C.white,true).setOrigin(.5);
    c.add([rect,label]);rect.setData('tacticLabel',label);c.setSize(w,h);c.setInteractive(new Phaser.Geom.Rectangle(-w/2,-h/2,w,h),Phaser.Geom.Rectangle.Contains);
    c.on('pointerdown',()=>{if(this.active&&!this.busy&&!this.finished)cb();});
    c.on('pointerover',()=>rect.setStrokeStyle(3,accent,1));
    c.on('pointerout',()=>rect.setStrokeStyle(2,0x57698f,.7));
    this.buttons.push(c);
    return rect;
  }
  private drawControls(){
    this.text(55,599,'SELECT FIGHTER · 4 / 5 / 6',14,'#a9e9f4',true).setDepth(2600);
    const roles=['SCOUT · MARK','GUARDIAN · SHIELD','STRIKER · BREACH'];
    for(let i=0;i<roles.length;i++){
      const rect=this.button(165+i*305,653,276,44,roles[i],()=>this.selectRole(i),C.gold);
      this.roleButtons.push(rect);
    }
    // Role abilities are already named on the three large buttons. Keep this
    // text object for state refresh without duplicating/cropping a second label.
    this.roleHint=this.text(55,620,'',15,'#ffe1a7',true).setVisible(false);
    this.text(984,598,'SQUAD DEPLOYMENT · 7 / 8 / 9',14,'#a9e9f4',true).setDepth(2600);
    for(let i=0;i<FORMATIONS.length;i++){
      const rect=this.button(1025+i*140,653,130,44,FORMATIONS[i].name,()=>this.selectFormation(i),C.gold);
      this.formationButtons.push(rect);
    }
    const b=this.add.graphics().setDepth(2300);
    b.fillStyle(0x071021,.97).fillRoundedRect(17,681,W-34,117,17);
    b.lineStyle(2,0x536d92,.65).strokeRoundedRect(17,681,W-34,117,17);
    const field:Field[]=['base','trigger','response'];
    const groups=[{x:50,title:'OPENING MOVE',opts:names},
      {x:410,title:'IF ENEMY CHOOSES',opts:names},{x:795,title:'COUNTER WITH',opts:names}];
    for(let col=0;col<3;col++){
      const row=groups[col];
      this.text(row.x,690,row.title,13,'#b9d2e8',true).setDepth(2600);
      for(let n=0;n<3;n++){
        const rect=this.button(row.x+58+n*105,755,98,54,row.opts[n],()=>this.choose(field[col],n),col===0?C.cyan:col===1?C.gold:C.pink);
        this.choices[field[col]].push(rect);
      }
    }
    const button=this.button(1261,754,285,64,'LOCK GAMBIT →',()=>this.lockPlan(),C.gold);
    button.setFillStyle(0x18495f,1).setStrokeStyle(3,C.cyan,1);
  }

  private selectRole(index:number){
    if(!this.active||this.busy||this.finished||index<0||index>2)return;
    this.selectedRole=index;
    this.plan=this.squadPlans[index];
    lastSelectedPlan={...this.plan};
    this.refresh();
    emitLocalPractice({type:'role',role:index});
  }
  private selectFormation(index:number){
    if(!this.active||this.busy||this.finished||!Number.isInteger(index)||index<0||index>=FORMATIONS.length)return;
    this.formation=index;
    const homeY=[299,407,515];
    for(let role=0;role<3;role++){
      const lane=FORMATIONS[index].slots.indexOf(role);
      this.tweens.killTweensOf(this.actors[role].shell);
      this.tweens.add({targets:this.actors[role].shell,y:homeY[lane],duration:270,ease:'Sine.easeInOut'});
    }
    this.refresh();
    emitLocalPractice({type:'formation',index});
  }
  private choose(field:Field,index:number){
    if(!this.active||this.busy||this.finished)return;
    this.plan[field]=index;
    lastSelectedPlan={...this.plan};
    this.refresh();
    emitLocalPractice({type:'choose',field,index,role:this.selectedRole});
  }
  private refresh(){
    this.round.setText('ROUND '+Math.min(this.match.round+1,5)+' / 5');
    this.scoreboard.setText(this.match.scoreA+' : '+this.match.scoreB);
    const roleDescriptions=[
      'SCOUT: mark a winning Striker',
      'GUARDIAN: block enemy breach',
      'STRIKER: bonus reactor pressure'
    ];
    this.roleHint.setText(roleDescriptions[this.selectedRole]);
    const stateEl=document.getElementById('game-state');
    if(stateEl){
      stateEl.dataset.selectedRole=SQUAD_ROLES[this.selectedRole];
      stateEl.dataset.selectedBase=String(this.plan.base);
      stateEl.dataset.selectedTrigger=String(this.plan.trigger);
      stateEl.dataset.selectedResponse=String(this.plan.response);
    }
    this.roleButtons.forEach((rect,i)=>{
      const label=rect.getData('tacticLabel') as Phaser.GameObjects.Text | undefined;
      if(label)label.setText(SQUAD_ROLES[i]+'  ·  '+names[this.squadPlans[i].base]);
      const active=i===this.selectedRole;
      rect.setFillStyle(active?0x155b6e:0x17263f,1);
      rect.setStrokeStyle(active?3:1,active?C.gold:0x53698b,active?1:.7);
    });
    this.formationButtons.forEach((rect,i)=>{
      const active=i===this.formation;
      rect.setFillStyle(active?0x5d4027:0x17263f,1);
      rect.setStrokeStyle(active?3:1,active?C.gold:0x53698b,active?1:.7);
    });
    const stateEl2=document.getElementById('game-state');
    if(stateEl2)stateEl2.dataset.formation=FORMATIONS[this.formation].name;
    this.actors.forEach((actor,i)=>{
      // Highlight the selected allied fighter; enemy portraits stay separate.
      if(i<3){
        actor.shell.setAlpha(i===this.selectedRole?1:.77);
        const selector=actor.shell.getByName('selection-ring') as Phaser.GameObjects.Ellipse | null;
        if(selector)selector.setAlpha(i===this.selectedRole?1:.30);
      }
    });
    const fields:Field[]=['base','trigger','response'];
    fields.forEach((field,i)=>this.choices[field].forEach((rect,j)=>{
      const active=this.plan[field]===j;
      rect.setFillStyle(active?i===0?0x20687a:i===1?0x665128:0x69355b:0x17263f);
      rect.setStrokeStyle(active?3:1,active?i===0?C.cyan:i===1?C.gold:C.pink:0x53698b,active?1:.65);
    }));
    this.syncMobileDeck();
  }


  /**
   * Role-specific Phaser choreography in LOCAL PRACTICE. Animation reads
   * ONLY the public lane outcome, never an opponent's private tactic.
   * It must not be reused to reconstruct secret onchain actions.
   */
  /**
   * Persistent after-action intelligence, drawn with Phaser in SOLO PRACTICE.
   * Only observed role matchups and points are shown. This is deliberately
   * never called by the authenticated onchain single-duel rendering path.
   */
  private showBattleReport(report:PracticeReport){
    this.battleReport?.destroy(true);
    const band=this.add.container(720,213).setDepth(2090);
    band.add(this.add.rectangle(0,0,665,84,0x09172b,.94).setStrokeStyle(2,0x53728a,.8));
    band.add(this.text(-317,-32,report.heading,13,'#b2cfdf',true).setOrigin(0,.5));
    band.add(this.text(317,-32,report.scoreline,13,'#ffe3ac',true).setOrigin(1,.5));
    report.lanes.forEach((lane,i)=>{
      const x=(i-1)*211;
      const accent=lane.outcome===1?C.cyan:lane.outcome===2?C.pink:C.gold;
      band.add(this.add.rectangle(x,0,202,28,0x15263a,.96).setStrokeStyle(1,accent,.88));
      band.add(this.text(x,0,
        lane.leftRole+' / '+lane.rightRole+'  '+lane.verdict,11,C.white,true).setOrigin(.5));
    });
    band.add(this.text(0,31,report.note,11,'#b9d3dd',true).setOrigin(.5));
    this.battleReport=band;
  }

  private playRoleEffect(challengerIndex:number,defenderIndex:number,outcome:number,y:number){
    const stateEl=document.getElementById('game-state');
    if(stateEl)stateEl.dataset.roleEffectStarts=String(
      Number(stateEl.dataset.roleEffectStarts||'0')+1
    );
    const index=outcome===2?defenderIndex:challengerIndex;
    const tint=outcome===1?C.cyan:outcome===2?C.pink:C.gold;
    const winnerX=outcome===1?585:outcome===2?855:720;
    const effectDepth=1850;

    // Outcome halo: a consistent visual language for all fighter classes.
    const halo=this.add.circle(winnerX,y,20,tint,.07).setDepth(effectDepth);
    halo.setStrokeStyle(5,tint,.95);
    this.tweens.add({targets:halo,scale:3.9,alpha:0,duration:730,ease:'Sine.easeOut',
      onComplete:()=>halo.destroy()});

    if(index===0){
      // SCOUT: radar acquisition and marked vulnerability.
      for(let ring=0;ring<3;ring++){
        const scan=this.add.circle(winnerX,y,18+ring*11,tint,.015).setDepth(effectDepth);
        scan.setStrokeStyle(2.5,tint,.85);
        scan.setAlpha(.82);
        this.tweens.add({targets:scan,scale:2.3,alpha:0,delay:ring*125,duration:650,
          onComplete:()=>scan.destroy()});
      }
      const marker=this.add.circle(winnerX,y,7,C.gold,.9).setDepth(effectDepth+1);
      this.tweens.add({targets:marker,scale:0,alpha:0,delay:250,duration:400,
        onComplete:()=>marker.destroy()});
    }else if(index===1){
      // GUARDIAN: defensive barrier and a brief impact ripple.
      const barrier=this.add.ellipse(winnerX,y-6,98,127,tint,.08).setDepth(effectDepth);
      barrier.setStrokeStyle(5,tint,.96);
      const core=this.add.ellipse(winnerX,y-6,70,102,0xffffff,.035).setDepth(effectDepth);
      core.setStrokeStyle(2,0xffffff,.4);
      this.tweens.add({targets:[barrier,core],scaleX:1.36,scaleY:1.13,alpha:0,
        duration:800,ease:'Sine.easeOut',onComplete:()=>{barrier.destroy();core.destroy();}});
    }else{
      // STRIKER: three staggered energy slashes across the clash point.
      for(let slash=0;slash<3;slash++){
        const blade=this.add.rectangle(700+slash*20,y-20+slash*19,120,8,tint,.9)
          .setDepth(effectDepth+1).setRotation(-.60);
        this.tweens.add({targets:blade,x:blade.x+74,alpha:0,scaleX:1.35,
          delay:slash*83,duration:480,ease:'Sine.easeOut',
          onComplete:()=>blade.destroy()});
      }
    }

    if(outcome!==0){
      // Keep this response tied ONLY to a visible LOCAL PRACTICE lane win:
      // winner presses forward; loser recoils. Both return before next round.
      const actor=this.actors[outcome===2?defenderIndex+3:challengerIndex].shell;
      const loser=this.actors[outcome===1?defenderIndex+3:challengerIndex].shell;
      this.tweens.add({targets:actor,scaleX:1.09,scaleY:1.09,
        duration:145,yoyo:true,hold:75,ease:'Sine.easeOut'});
      this.tweens.add({targets:loser,
        x:loser.x+(outcome===1?26:-26),
        angle:outcome===1?7:-7,
        alpha:.66,duration:135,yoyo:true,hold:130,ease:'Sine.easeOut',
        onComplete:()=>loser.setAngle(0)});
    }
  }

  private selectPracticeStyle(style:PracticeStyle){
    if(this.active||this.busy||this.finished||this.watchingVerifiedDuel||
       !PRACTICE_STYLES.includes(style))return;
    selectedPracticeStyle=style;
    this.match={...this.match,style};
    this.styleButtons.forEach((rect,index)=>{
      const selected=PRACTICE_STYLES[index]===style;
      rect.setFillStyle(selected?0x176077:0x17283d,1);
      rect.setStrokeStyle(selected?3:1,selected?C.cyan:0x52738e,1);
    });
    this.writeState('intro');
  }

  private intro(){
    this.active=false;
    const overlay=this.add.container(0,0).setDepth(7000);
    overlay.add(this.add.rectangle(W/2,H/2,W,H,0x050912,.82));
    const panel=this.add.rectangle(W/2,H/2,760,495,0x15213a,.99).setStrokeStyle(3,C.cyan,.8);
    overlay.add(panel);
    overlay.add(this.text(W/2,248,'GAMBIT',59,C.white,true).setOrigin(.5));
    overlay.add(this.text(W/2,309,'OUTSMART THREE ENEMY FIGHTERS.',21,'#9feefc',true).setOrigin(.5));
    overlay.add(this.text(W/2,348,'Program each fighter. Choose formation. Command the reactor.',16,C.white).setOrigin(.5));
    overlay.add(this.text(W/2,382,'LOCAL PRACTICE · NO WALLET OR ENCRYPTION',12,'#a9b8d7',true).setOrigin(.5));
    overlay.add(this.text(W/2,408,'CHOOSE YOUR OPPONENT',12,'#bdd6e7',true).setOrigin(.5));
    const styleLabels=['STEADY','REACTIVE','VOLATILE'];
    for(let i=0;i<PRACTICE_STYLES.length;i++){
      const x=517+i*203,style=PRACTICE_STYLES[i] as PracticeStyle;
      const active=style===selectedPracticeStyle;
      const rect=this.add.rectangle(x,447,186,40,active?0x176077:0x17283d)
        .setStrokeStyle(active?3:1,active?C.cyan:0x52738e)
        .setInteractive({useHandCursor:true});
      rect.on('pointerdown',()=>this.selectPracticeStyle(style));
      this.styleButtons.push(rect);
      overlay.add([rect,this.text(x,447,styleLabels[i],14,C.white,true).setOrigin(.5)]);
    }
    const bg=this.add.rectangle(W/2,518,280,57,0x0d6179).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    overlay.add([bg,this.text(W/2,518,'ENTER ARENA',20,C.white,true).setOrigin(.5)]);
    // A first-time judge can watch a REAL signed match without learning
    // wallet stages or seeing a fake local round. The public reader checks
    // chain ID, runtime hash, one-use link and finalized aggregate on demand.
    const watchBg=this.add.rectangle(W/2,581,345,44,0x1c334a,.99)
      .setStrokeStyle(1,C.gold,.92).setInteractive({useHandCursor:true});
    const watchText=this.text(W/2,581,'WATCH VERIFIED DUEL #1 · NO WALLET',14,C.white,true).setOrigin(.5);
    const proofStatus=this.text(W/2,628,'',12,'#c4d8ea').setOrigin(.5);
    overlay.add([watchBg,watchText,proofStatus]);
    let proofLoading=false;
    const begin=()=>{
      if(this.active||proofLoading||document.body.dataset.gambitFeatureOverlay)return;
      overlay.destroy(true);
      this.active=true;
      this.writeState('ready');
      emitLocalPractice({type:'enter',phase:'ready'});
      window.removeEventListener('keydown',enterKey);
      window.removeEventListener('gambit:mobile-control',touchStart);
    };
    const touchStart=(e:Event)=>{
      if(document.body.dataset.gambitFeatureOverlay)return;
      if((e as CustomEvent<{action?:string}>).detail?.action==='start')begin();
    };
    window.addEventListener('gambit:mobile-control',touchStart);
    const enterKey=(e:KeyboardEvent)=>{
      if(document.body.dataset.gambitFeatureOverlay)return;
      if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();begin();}
    };
    bg.on('pointerdown',begin);
    watchBg.on('pointerdown',()=>{
      if(this.active||proofLoading||document.body.dataset.gambitFeatureOverlay)return;
      proofLoading=true;
      proofStatus.setText('Checking the real Sepolia result…');
      const address=import.meta.env.VITE_GAMBIT_SQUAD_CONTRACT_ADDRESS;
      const hash=import.meta.env.VITE_GAMBIT_SQUAD_RUNTIME_HASH;
      if(typeof address!=='string'||typeof hash!=='string'){
        proofStatus.setText('Verified match unavailable in this build.');
        proofLoading=false;
        return;
      }
      void import('./chain/squad-public-reader')
        .then(({readVerifiedSquadPublic})=>readVerifiedSquadPublic(1n,address,hash))
        .then(verified=>{
          window.removeEventListener('keydown',enterKey);
          window.removeEventListener('gambit:mobile-control',touchStart);
          overlay.destroy(true);
          this.showVerifiedSquad(verified);
        })
        .catch(()=>{
          // Never animate or claim a score until canonical verification works.
          proofStatus.setText('Result lookup unavailable. Try again or enter Practice.');
          proofLoading=false;
        });
    });
    window.addEventListener('keydown',enterKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      window.removeEventListener('keydown',enterKey);
      window.removeEventListener('gambit:mobile-control',touchStart);
    });
  }

  private lockPlan(){
    if(!this.active||this.busy||this.finished||this.watchingVerifiedDuel)return;
    let resolved:ReturnType<typeof commitSquadTurn>;
    let insight:ReturnType<typeof buildPracticeInsight>;
    try{
      // Local simulator only: explain one genuinely executed tactic AFTER
      // resolution. Never reuse an AI cleartext trace for encrypted matches.
      insight=buildPracticeInsight(this.squadPlans,enemySquadFor(this.match),
        this.formation,enemyFormationFor(this.match));
      resolved=commitSquadTurn(this.match,this.squadPlans,this.formation);
      // Teaching cannot affect authoritative scores, role outcomes or winner.
      if(insight.lanes.some((lane,i)=>lane.outcome!==resolved.event.lanes[i].outcome))
        throw Error('Practice insight does not match simulated encounter');
    }catch{
      this.notice.setText('Check all three fighter plans before locking.');
      return;
    }
    this.busy=true;
    this.match=resolved.match;
    const event=resolved.event;
    this.lastDebrief=null;
    this.battleReport?.setVisible(false);
    this.writeState('resolving');
    emitLocalPractice({type:'commit',round:this.match.round});
    const stateEl=document.getElementById('game-state');
    if(stateEl){
      stateEl.dataset.lastLaneCount=String(event.lanes.length);
      stateEl.dataset.enemyFormation=FORMATIONS[event.formationB].name;
    }
    this.notice.setText('Resolving all three tactical duels…');
    this.hint.setText('Every fighter executes its own independent conditional plan.');
    // Readable three-lane staging: keep the bottom fighter name above controls,
    // and give both teams sufficient space away from the reactor center.
    const lanesY=[280,406,526];
    for(let i=0;i<3;i++){
      const lane=event.lanes[i];
      const ally=this.actors[lane.challengerIndex],enemy=this.actors[lane.defenderIndex+3],y=lanesY[i];
      this.tweens.add({targets:ally.shell,x:585,y,scale:0.82,delay:i*155,
        duration:385,ease:'Sine.easeOut'});
      this.tweens.add({targets:enemy.shell,x:855,y,scale:0.82,delay:i*155,
        duration:385,ease:'Sine.easeOut'});
    }
    // Stage outcomes one by one. Game logic remains committed atomically;
    // only public LOCAL PRACTICE results are presented. No lane information
    // is inferred or animated for Zama onchain verified results.
    for(let i=0;i<3;i++){
      this.time.delayedCall(650+i*480,()=>{
        if(this.watchingVerifiedDuel)return;
        const lane=event.lanes[i],outcome=lane.outcome,y=lanesY[i];
        const color=outcome===1?C.cyan:outcome===2?C.pink:C.gold;
        const line=this.add.rectangle(720,y,532,96,color,.065).setDepth(1100)
          .setStrokeStyle(2,color,.83);
        this.tweens.add({targets:line,alpha:0,delay:210,duration:510,
          onComplete:()=>line.destroy()});
        this.playRoleEffect(lane.challengerIndex,lane.defenderIndex,outcome,y);
        const label=outcome===1?'CYAN WINS':outcome===2?'VIOLET WINS':'DRAW';
        const verdict=this.text(720,y-55,
          (i+1)+' / 3   '+lane.role+' vs '+lane.enemyRole+'   ·   '+label,
          13,C.white,true).setOrigin(.5).setDepth(2000);
        this.tweens.add({targets:verdict,alpha:0,y:y-77,delay:285,duration:730,
          onComplete:()=>verdict.destroy()});
        const trace=insight.lanes[i];
        this.hint.setText('LANE '+(i+1)+' · '+trace.role.toUpperCase()+' '+
          (trace.ownCounterActivated?'COUNTER ACTIVATED':'OPENING ORDER EXECUTED'));
        const stateEl=document.getElementById('game-state');
        if(stateEl){
          stateEl.dataset.activeLane=String(i+1);
          stateEl.dataset.lastLaneOrder=(stateEl.dataset.lastLaneOrder||'')+String(i+1);
          if(i===2)stateEl.dataset.lastRoleEffects='3';
        }
        if(i===2){
          // A short visible pulse connects the 3 lane wins to the reactor
          // objective. It represents this LOCAL round's public scores only.
          const advantage=event.pointsA-event.pointsB;
          const pulseColor=advantage>0?C.cyan:advantage<0?C.pink:C.gold;
          const pulse=this.add.circle(720,414,78,pulseColor,.06)
            .setStrokeStyle(5,pulseColor,.9).setDepth(1140);
          this.tweens.add({targets:pulse,scale:1.95,alpha:0,
            duration:850,ease:'Sine.easeOut',onComplete:()=>pulse.destroy()});
          const pressure=this.text(720,414,
            'REACTOR   +'+event.pointsA+'   /   +'+event.pointsB,
            18,C.white,true).setOrigin(.5).setDepth(2080);
          this.tweens.add({targets:pressure,alpha:0,y:394,delay:300,
            duration:650,onComplete:()=>pressure.destroy()});
          this.cameras.main.shake(115,.0013);
          this.notice.setText(event.pointsA>event.pointsB?
            'REACTOR ADVANTAGE · +'+event.pointsA+' PRESSURE':
            event.pointsB>event.pointsA?
            'ENEMY PRESSURE · +'+event.pointsB+' AGAINST YOU':
            'REACTOR STALEMATE · TRY A DIFFERENT DEPLOYMENT');
        }
      });
    }
    this.time.delayedCall(2000,()=>{
      if(this.watchingVerifiedDuel)return;
      for(let i=0;i<this.actors.length;i++){
        const unit=this.actors[i];
        const assignedLane=i<3?FORMATIONS[this.formation].slots.indexOf(i):-1;
        const y=assignedLane<0?unit.origin.y:[299,407,515][assignedLane];
        this.tweens.add({targets:unit.shell,x:unit.origin.x,y,scale:1,angle:0,duration:400});
      }
    });
    this.time.delayedCall(2680,()=>{
      if(this.watchingVerifiedDuel)return;
      this.busy=false;
      this.lastDebrief={...buildPracticeDebrief(event),note:insight.headline};
      this.showBattleReport(this.lastDebrief);
      const laneState=document.getElementById('game-state');
      if(laneState)delete laneState.dataset.activeLane;
      this.refresh();
      if(this.match.finished)this.gameOver();
      else{
        this.notice.setText('ROUND '+(this.match.round+1)+' · EDIT EACH FIGHTER BEFORE LOCKING');
        this.hint.setText(insight.tip);
        this.writeState('ready');
      }
      this.syncMobileDeck();
      if(this.lastDebrief)emitLocalPractice({
        type:'settled',round:this.lastDebrief.round,
        scoreline:this.lastDebrief.scoreline,lanes:this.lastDebrief.lanes.length
      });
    });
  }

  /**
   * Authenticated v2 onchain presentation. This renderer ONLY displays
   * contract-finalized aggregate reactor totals. Per-role strategies,
   * formations and lane wins remain hidden by the actual FHE protocol.
   */
  private showVerifiedSquad(receipt:SquadResult){
    if(!receipt||receipt.authenticated!==true||
       typeof receipt.squadId!=='bigint'||receipt.squadId<=0n||
       typeof receipt.duelId!=='bigint'||receipt.duelId<=0n||
       !Number.isInteger(receipt.pointsChallenger)||receipt.pointsChallenger<0||receipt.pointsChallenger>5||
       !Number.isInteger(receipt.pointsDefender)||receipt.pointsDefender<0||receipt.pointsDefender>5||
       ![0,1,2].includes(receipt.outcome)||
       (receipt.outcome!==(
         receipt.pointsChallenger===receipt.pointsDefender?0:
         receipt.pointsChallenger>receipt.pointsDefender?1:2
       ))||
       !/^https:\/\/sepolia\.etherscan\.io\/(tx|address)\/0x[0-9a-fA-F]+$/.test(receipt.explorerUrl))return;
    if(this.watchingVerifiedDuel)return;
    this.watchingVerifiedDuel=true;
    this.active=false;
    this.busy=true;
    this.lastDebrief=null;
    this.battleReport?.setVisible(false);
    const status=document.getElementById('status');
    if(status)status.textContent='SEPOLIA · FHE SQUAD TOTALS VERIFIED';
    const phase=document.getElementById('game-state');
    if(phase){
      phase.dataset.phase='chain-verified-squad';
      phase.dataset.squadId=String(receipt.squadId);
      phase.dataset.duelId=String(receipt.duelId);
      phase.dataset.scoreA=String(receipt.pointsChallenger);
      phase.dataset.scoreB=String(receipt.pointsDefender);
      delete phase.dataset.reportRound;
      phase.textContent='Authenticated encrypted squad duel '+receipt.duelId;
    }
    this.round.setText('ENCRYPTED SQUAD #'+receipt.squadId);
    this.scoreboard.setText(receipt.pointsChallenger+' : '+receipt.pointsDefender);
    this.notice.setText('KMS-SIGNED SQUAD RESULT · VERIFIED ON SEPOLIA');
    this.hint.setText('Individual fighter outcomes and formations remain encrypted.');
    // No per-fighter winner animation: those details are NOT public.
    this.actors.forEach(actor=>actor.shell.setAlpha(.20));
    const score=receipt.pointsChallenger+'  :  '+receipt.pointsDefender;
    const winner=receipt.outcome===1?'CYAN REACTOR ADVANTAGE':
      receipt.outcome===2?'VIOLET REACTOR ADVANTAGE':'REACTOR STALEMATE';
    const tint=receipt.outcome===1?C.cyan:receipt.outcome===2?C.pink:C.gold;
    const veil=this.add.rectangle(W/2,H/2,W,H,0x050c17,.81);
    const panel=this.add.rectangle(W/2,H/2,845,365,0x102238,.99).setStrokeStyle(3,tint,.92);
    const top=this.text(W/2,279,'ZAMA · ENCRYPTED SQUAD PROOF',20,'#bce4f2',true).setOrigin(.5);
    const total=this.text(W/2,356,score,70,C.white,true).setOrigin(.5);
    const verdict=this.text(W/2,415,winner,18,'#d5ebfa',true).setOrigin(.5);
    const foot=this.text(W/2,456,'THREE PRIVATE ORDERS PER SIDE · SCORES VERIFIED ONCHAIN',
      13,'#b4c9d9',true).setOrigin(.5);
    const evidence=this.add.rectangle(W/2-159,521,285,52,0x184e63).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    const practice=this.add.rectangle(W/2+159,521,285,52,0x2b3b54).setStrokeStyle(2,0x7999b4).setInteractive({useHandCursor:true});
    const view=this.text(W/2-159,521,'VIEW PUBLIC EVIDENCE',16,C.white,true).setOrigin(.5);
    const restart=this.text(W/2+159,521,'RETURN TO PRACTICE',16,C.white,true).setOrigin(.5);
    this.add.container(0,0,[veil,panel,top,total,verdict,foot,evidence,practice,view,restart]).setDepth(9000);
    evidence.on('pointerdown',()=>window.open(receipt.explorerUrl,'_blank','noopener,noreferrer'));
    practice.on('pointerdown',()=>this.scene.restart());
    this.syncMobileDeck();
  }

  /**
   * Single onchain duel presentation. There is intentionally NO simulated
   * five-round scoreboard and NO animation before verified final contract
   * state is returned by the wallet client. Do not infer unrevealed plans.
   */
  private showVerifiedDuel(receipt:VerifiedDuel){
    if(!receipt||receipt.authenticated!==true||
       typeof receipt.challengeId!=='bigint'||receipt.challengeId<=0n||
       ![0,1,2].includes(receipt.outcome)||
       !/^https:\/\/sepolia\.etherscan\.io\/(tx|address)\/0x[0-9a-fA-F]+$/.test(receipt.explorerUrl))return;
    if(this.watchingVerifiedDuel)return;
    this.watchingVerifiedDuel=true;
    this.active=false;
    this.busy=true;
    this.lastDebrief=null;
    this.battleReport?.setVisible(false);
    this.syncMobileDeck();
    const mode=document.getElementById('status');
    if(mode)mode.textContent='SEPOLIA · AUTHENTICATED RESULT';
    const phase=document.getElementById('game-state');
    if(phase){
      phase.dataset.phase='chain-verified';
      phase.dataset.challengeId=String(receipt.challengeId);
      phase.dataset.outcome=String(receipt.outcome);
      phase.textContent='Sepolia verified challenge '+receipt.challengeId;
    }
    this.round.setText('VERIFIED DUEL #'+receipt.challengeId);
    this.scoreboard.setText(receipt.outcome===1?'1 : 0':receipt.outcome===2?'0 : 1':'0 : 0');
    this.notice.setText('VERIFIED ON SEPOLIA · ENCRYPTED PLANS NEVER REVEALED');
    this.hint.setText('One signed duel outcome. This is not yet a full five-round onchain match.');
    // The motion reflects ONLY the public outcome; it does not reconstruct
    // the secret moves, counters or traits of either player.
    this.actors.forEach((actor,i)=>{
      // The deployed FHE contract verifies only one tactic per side.
      // Animate a single command duel, not a fabricated 3v3 chain battle.
      if(i!==0&&i!==3){actor.shell.setAlpha(.2);return;}
      this.tweens.add({targets:actor.shell,
        x:i===0?645:795,y:414,duration:550,ease:'Sine.easeOut'});
    });
    const win=receipt.outcome===1?'CHALLENGER WINS':receipt.outcome===2?'DEFENDER WINS':'DRAW';
    const accent=receipt.outcome===1?C.cyan:receipt.outcome===2?C.pink:C.gold;
    const curtain=this.add.rectangle(W/2,H/2,W,H,0x050912,.70);
    const card=this.add.rectangle(W/2,H/2,800,360,0x111e35,.98).setStrokeStyle(3,accent,.95);
    const heading=this.text(W/2,294,'ONCHAIN VERIFIED',24,'#a6d3ec',true).setOrigin(.5);
    const verdict=this.text(W/2,367,win,53,C.white,true).setOrigin(.5);
    const proof=this.text(W/2,430,'ZAMA FHE · PUBLIC RESULT PROOF · SEPOLIA',17,'#d5e8ff',true).setOrigin(.5);
    const see=this.add.rectangle(W/2-158,518,280,55,0x1d536d).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    const back=this.add.rectangle(W/2+158,518,280,55,0x303953).setStrokeStyle(2,0x9db1d7).setInteractive({useHandCursor:true});
    const seeLabel=this.text(W/2-158,518,'VIEW ONCHAIN EVIDENCE',17,C.white,true).setOrigin(.5);
    const backLabel=this.text(W/2+158,518,'BACK TO PRACTICE',17,C.white,true).setOrigin(.5);
    const overlay=this.add.container(0,0,[curtain,card,heading,verdict,proof,see,back,seeLabel,backLabel]).setDepth(9000);
    overlay.setAlpha(0);
    this.tweens.add({targets:overlay,alpha:1,delay:620,duration:420});
    see.on('pointerdown',()=>window.open(receipt.explorerUrl,'_blank','noopener,noreferrer'));
    back.on('pointerdown',()=>this.scene.restart());
  }
  private gameOver(){
    this.finished=true;this.active=false;this.writeState('finished');
    const result=this.match.winner===0?'DRAW':this.match.winner===1?'VICTORY':'DEFEAT';
    const summary=buildPracticeMatchDebrief(this.match);
    const overlay=this.add.container(0,0).setDepth(7200);
    overlay.add(this.add.rectangle(W/2,H/2,W,H,0x070b17,.79));
    overlay.add(this.add.rectangle(W/2,H/2,780,392,0x16213a)
      .setStrokeStyle(3,this.match.winner===1?C.cyan:this.match.winner===2?C.pink:C.gold,.87));
    overlay.add(this.text(W/2,274,result,55,
      this.match.winner===1?'#88f7fb':this.match.winner===2?'#ffc3df':'#ffe1a5',true).setOrigin(.5));
    overlay.add(this.text(W/2,343,summary.scoreline,36,'#ffe6ba',true).setOrigin(.5));
    overlay.add(this.text(W/2,406,summary.highlight,18,'#d7f0ff',true).setOrigin(.5));
    overlay.add(this.text(W/2,444,summary.adjustment,15,'#a9cddd').setOrigin(.5));
    const retry=this.add.rectangle(W/2,518,285,58,0x19677b)
      .setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    overlay.add([retry,this.text(W/2,518,'PLAY REMATCH ↻',20,C.white,true).setOrigin(.5)]);
    retry.on('pointerdown',()=>this.scene.restart());
  }
}

// BLACKSITE is a real playable LOCAL training greybox, separate from the
// Phaser Arena and real onchain squad panel. It never connects a wallet.
mountBlacksiteGreybox();

mountCommanderPublicViewer();
mountTrainingCoach();

const game=new Phaser.Game({
  type:Phaser.AUTO,parent:'app',width:W,height:H,backgroundColor:'#060b16',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  render:{antialias:true,pixelArt:false},scene:[GambitArena]
});
function fail(message:string){const box=document.getElementById('error');if(box){box.style.display='block';box.textContent='GAMBIT could not start: '+message;}}
window.addEventListener('error',(event)=>fail(event.message));
window.addEventListener('unhandledrejection',(event)=>fail(String(event.reason)));
// Prefer the full 3v3 client over the legacy one-fighter lab. If a preview
// mistakenly configures both, we deliberately mount only v2, avoiding two
// competing wallet prompts and overlapping buttons. v2 is still versioned
// and requires both exact deployment coordinates and runtime fingerprint.
const squadAddress=import.meta.env.VITE_GAMBIT_SQUAD_CONTRACT_ADDRESS;
const squadHash=import.meta.env.VITE_GAMBIT_SQUAD_RUNTIME_HASH;
const squadConfigured=typeof squadAddress==='string'&&/^0x[a-fA-F0-9]{40}$/.test(squadAddress)
  &&typeof squadHash==='string'&&/^0x[a-fA-F0-9]{64}$/.test(squadHash);
// Onchain controls are mounted only AFTER a real Sepolia contract address is
// configured. Local practice never creates a pretend wallet or fake receipt.
const configuredAddress=import.meta.env.VITE_GAMBIT_CONTRACT_ADDRESS;
if(!squadConfigured&&typeof configuredAddress==='string'&&/^0x[a-fA-F0-9]{40}$/.test(configuredAddress)){
  void import('./chain/panel').then(({mountSepoliaPanel})=>{
    mountSepoliaPanel(configuredAddress,()=>({
      base:lastSelectedPlan.base as 0|1|2,
      trigger:lastSelectedPlan.trigger as 0|1|2,
      response:lastSelectedPlan.response as 0|1|2
    }),receipt=>game.events.emit('gambit:verified-duel',receipt));
  }).catch(error=>{
    const e=document.getElementById('error');
    if(e){e.textContent='Unable to initialize Sepolia wallet controls: '+String(error);e.style.display='block';}
  });
}

// Squad v2 remains invisible until a REAL Sepolia deployment is configured
// together with its independently verified runtime code hash. Never reuse
// the old one-fighter contract address for a confidential 3v3 session.
if(squadConfigured){
  void import('./chain/squad-panel').then(({mountSquadSepoliaPanel})=>{
    mountSquadSepoliaPanel(squadAddress,squadHash,
      ()=>((game.scene.getScene('GambitArena') as GambitArena).squadSnapshot()),
      receipt=>game.events.emit('gambit:verified-squad',receipt));
  }).catch(error=>{
    const alert=document.getElementById('error');
    if(alert){alert.style.display='block';alert.textContent='Encrypted squad panel unavailable: '+String(error);}
  });
}

export default game;
