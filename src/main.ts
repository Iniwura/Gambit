import Phaser from 'phaser';
import {makeSquadMatch,commitSquadTurn,startingSquadPlans,SQUAD_ROLES,FORMATIONS} from './squad.mjs';
import {createMobileDeck} from './mobile-deck';
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
type Plan={base:number,trigger:number,response:number};
type PracticeReport={round:number,heading:string,scoreline:string,note:string,lanes:Array<{lane:number,leftRole:string,rightRole:string,verdict:string,outcome:number}>};
type VerifiedDuel={challengeId:bigint,outcome:0|1|2,explorerUrl:string,authenticated:true};
let lastSelectedPlan:Plan={...startingSquadPlans()[0]};
let practiceSessionCount=0;
type Actor={shell:Phaser.GameObjects.Container,origin:{x:number,y:number}};
const names=['STRIKE','GUARD','FLANK'];
const mobileDeck=createMobileDeck();
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
    this.match=makeSquadMatch(practiceSeed);
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
    this.battleReport=undefined;
    this.lastDebrief=null;
    const gameplayState=document.getElementById('game-state');
    if(gameplayState){
      delete gameplayState.dataset.lastLaneCount;
      delete gameplayState.dataset.lastRoleEffects;
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
    this.intro();
    this.keyboardListener=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement)return;
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
      const command=(e as CustomEvent<{action:string,role?:number,formation?:number,field?:Field,value?:number}>).detail;
      if(!command)return;
      if(command.action==='role'&&typeof command.role==='number')this.selectRole(command.role);
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
    if(!this.active||this.busy||this.finished||this.watchingVerifiedDuel)
      throw Error('Enter active local practice to configure your complete squad.');
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
    mobileDeck.sync({selectedRole:this.selectedRole,formation:this.formation,plan:this.plan,phase,report:this.lastDebrief});
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
    this.text(1240,34,'VIOLET SQUAD',19,'#ffa1d8',true).setDepth(2000);
    const shadow=this.add.rectangle(720,121,690,47,0x090d1a,.8).setStrokeStyle(1,0x49678f,.55).setDepth(1900);
    this.notice=this.text(720,107,'Command three fighters. Win the reactor.',20,'#fff0b5',true).setOrigin(.5,0).setDepth(2000);
    this.hint=this.text(720,154,'Select each fighter. Give them a move and a conditional counter.',15,'#d7e7ff').setOrigin(.5,0).setDepth(2000);
  }

  private button(x:number,y:number,w:number,h:number,title:string,cb:()=>void,accent=C.cyan){
    const c=this.add.container(x,y).setDepth(3000);
    const rect=this.add.rectangle(0,0,w,h,0x17263f,1).setStrokeStyle(2,0x57698f,.7);
    const label=this.text(0,0,title,15,C.white,true).setOrigin(.5);
    c.add([rect,label]);c.setSize(w,h);c.setInteractive(new Phaser.Geom.Rectangle(-w/2,-h/2,w,h),Phaser.Geom.Rectangle.Contains);
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
    this.roleHint=this.text(55,620,'',15,'#ffe1a7',true).setDepth(2600);
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
  }
  private choose(field:Field,index:number){
    if(!this.active||this.busy||this.finished)return;
    this.plan[field]=index;
    lastSelectedPlan={...this.plan};
    this.refresh();
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
    const index=outcome===2?defenderIndex:challengerIndex;
    const tint=outcome===1?C.cyan:outcome===2?C.pink:C.gold;
    const winnerX=outcome===1?640:outcome===2?800:720;
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
      // The winning fighter reacts; a draw cannot imply a victor.
      const actor=this.actors[outcome===2?defenderIndex+3:challengerIndex].shell;
      this.tweens.add({targets:actor,scaleX:1.13,scaleY:1.13,duration:155,
        yoyo:true,hold:90,ease:'Sine.easeOut'});
    }
  }

  private intro(){
    this.active=false;
    const overlay=this.add.container(0,0).setDepth(7000);
    overlay.add(this.add.rectangle(W/2,H/2,W,H,0x050912,.82));
    const panel=this.add.rectangle(W/2,H/2,650,320,0x15213a,.99).setStrokeStyle(3,C.cyan,.8);
    overlay.add(panel);
    overlay.add(this.text(W/2,270,'GAMBIT',63,C.white,true).setOrigin(.5));
    overlay.add(this.text(W/2,345,'THREE FIGHTERS. THREE SECRET STRATEGIES.',20,'#9feefc',true).setOrigin(.5));
    overlay.add(this.text(W/2,393,'Program your fighters. Choose a formation. Outsmart their deployment.',16,C.white).setOrigin(.5));
    overlay.add(this.text(W/2,427,'LOCAL PRACTICE ONLY  •  NO WALLET OR ENCRYPTION',13,'#a9b8d7',true).setOrigin(.5));
    const bg=this.add.rectangle(W/2,496,280,57,0x0d6179).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    overlay.add([bg,this.text(W/2,496,'ENTER ARENA',20,C.white,true).setOrigin(.5)]);
    const begin=()=>{
      if(this.active)return;
      overlay.destroy(true);
      this.active=true;
      this.writeState('ready');
      window.removeEventListener('keydown',enterKey);
      window.removeEventListener('gambit:mobile-control',touchStart);
    };
    const touchStart=(e:Event)=>{
      if((e as CustomEvent<{action?:string}>).detail?.action==='start')begin();
    };
    window.addEventListener('gambit:mobile-control',touchStart);
    const enterKey=(e:KeyboardEvent)=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();begin();}};
    bg.on('pointerdown',begin);
    window.addEventListener('keydown',enterKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      window.removeEventListener('keydown',enterKey);
      window.removeEventListener('gambit:mobile-control',touchStart);
    });
  }

  private lockPlan(){
    if(!this.active||this.busy||this.finished||this.watchingVerifiedDuel)return;
    let resolved;
    try{resolved=commitSquadTurn(this.match,this.squadPlans,this.formation);}
    catch{
      this.notice.setText('Check all three fighter plans before locking.');
      return;
    }
    this.busy=true;
    this.match=resolved.match;
    const event=resolved.event;
    this.lastDebrief=null;
    this.battleReport?.setVisible(false);
    this.writeState('resolving');
    const stateEl=document.getElementById('game-state');
    if(stateEl){
      stateEl.dataset.lastLaneCount=String(event.lanes.length);
      stateEl.dataset.enemyFormation=FORMATIONS[event.formationB].name;
    }
    this.notice.setText('Resolving all three tactical duels…');
    this.hint.setText('Every fighter executes its own independent conditional plan.');
    const lanesY=[286,414,543];
    for(let i=0;i<3;i++){
      const lane=event.lanes[i];
      const ally=this.actors[lane.challengerIndex],enemy=this.actors[lane.defenderIndex+3],y=lanesY[i];
      this.tweens.add({targets:ally.shell,x:640,y,duration:390+i*75,ease:'Sine.easeOut'});
      this.tweens.add({targets:enemy.shell,x:800,y,duration:390+i*75,ease:'Sine.easeOut'});
    }
    this.time.delayedCall(640,()=>{
      if(this.watchingVerifiedDuel)return;
      for(let i=0;i<3;i++){
        const lane=event.lanes[i],outcome=lane.outcome;
        this.playRoleEffect(lane.challengerIndex,lane.defenderIndex,outcome,lanesY[i]);
        const verdict=this.text(720,lanesY[i]-58,
          lane.role+' vs '+lane.enemyRole+' · '+(outcome===1?'CYAN':outcome===2?'VIOLET':'DRAW'),14,C.white,true)
          .setOrigin(.5).setDepth(2000);
        this.tweens.add({targets:verdict,alpha:0,y:lanesY[i]-83,duration:1100,onComplete:()=>verdict.destroy()});
      }
      const stateEl=document.getElementById('game-state');
      if(stateEl)stateEl.dataset.lastRoleEffects='3';
      this.cameras.main.shake(140,.0015);
      this.notice.setText(event.pointsA>event.pointsB?'REACTOR ADVANTAGE · '+event.pointsA+' POINTS':
        event.pointsB>event.pointsA?'ENEMY PRESSURE · REPROGRAM YOUR SQUAD':'STALEMATE · ADAPT YOUR SQUAD');
      const marked=event.bonusesA.mark?'SCOUT MARK +1 · ':'';
      const blocked=event.bonusesA.blocked?'SHIELD -1 BONUS · ':'';
      const breach=event.bonusesA.breach?'STRIKER BREACH +1 · ':'';
      this.hint.setText((marked+breach+blocked)||'THREE FIGHTERS ENGAGED · '+event.pointsA+' : '+event.pointsB);
    });
    this.time.delayedCall(1400,()=>{
      if(this.watchingVerifiedDuel)return;
      for(let i=0;i<this.actors.length;i++){
        const unit=this.actors[i];
        const assignedLane=i<3?FORMATIONS[this.formation].slots.indexOf(i):-1;
        const y=assignedLane<0?unit.origin.y:[299,407,515][assignedLane];
        this.tweens.add({targets:unit.shell,x:unit.origin.x,y,duration:400});
      }
    });
    this.time.delayedCall(1950,()=>{
      if(this.watchingVerifiedDuel)return;
      this.busy=false;
      this.lastDebrief=buildPracticeDebrief(event);
      this.showBattleReport(this.lastDebrief);
      this.refresh();
      if(this.match.finished)this.gameOver();
      else{
        this.notice.setText('ROUND '+(this.match.round+1)+' · EDIT EACH FIGHTER BEFORE LOCKING');
        this.hint.setText('Enemy adjusts to recent lane losses. Predict the next counter.');
        this.writeState('ready');
      }
      this.syncMobileDeck();
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
    const overlay=this.add.container(0,0).setDepth(7200);
    overlay.add(this.add.rectangle(W/2,H/2,W,H,0x070b17,.77));
    overlay.add(this.add.rectangle(W/2,H/2,650,328,0x16213a).setStrokeStyle(3,this.match.winner===1?C.cyan:C.pink,.85));
    overlay.add(this.text(W/2,310,result,59,this.match.winner===1?'#88f7fb':'#ffc3df',true).setOrigin(.5));
    overlay.add(this.text(W/2,385,this.match.scoreA+' — '+this.match.scoreB,31,'#ffe6ba',true).setOrigin(.5));
    overlay.add(this.text(W/2,426,'New opponent pattern. Reprogram your squad.',17,C.white).setOrigin(.5));
    const retry=this.add.rectangle(W/2,498,275,56,0x19677b).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    overlay.add([retry,this.text(W/2,498,'REMATCH ↻',20,C.white,true).setOrigin(.5)]);
    retry.on('pointerdown',()=>this.scene.restart());
  }
}

const game=new Phaser.Game({
  type:Phaser.AUTO,parent:'app',width:W,height:H,backgroundColor:'#060b16',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  render:{antialias:true,pixelArt:false},scene:[GambitArena]
});
function fail(message:string){const box=document.getElementById('error');if(box){box.style.display='block';box.textContent='GAMBIT could not start: '+message;}}
window.addEventListener('error',(event)=>fail(event.message));
window.addEventListener('unhandledrejection',(event)=>fail(String(event.reason)));
// Onchain controls are mounted only AFTER a real Sepolia contract address is
// configured. Local practice never creates a pretend wallet or fake receipt.
const configuredAddress=import.meta.env.VITE_GAMBIT_CONTRACT_ADDRESS;
if(typeof configuredAddress==='string'&&/^0x[a-fA-F0-9]{40}$/.test(configuredAddress)){
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
const squadAddress=import.meta.env.VITE_GAMBIT_SQUAD_CONTRACT_ADDRESS;
const squadHash=import.meta.env.VITE_GAMBIT_SQUAD_RUNTIME_HASH;
if(typeof squadAddress==='string'&&/^0x[a-fA-F0-9]{40}$/.test(squadAddress)
  &&typeof squadHash==='string'&&/^0x[a-fA-F0-9]{64}$/.test(squadHash)){
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
