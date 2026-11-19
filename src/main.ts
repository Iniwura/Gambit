import Phaser from 'phaser';
import { ACTIONS, commitTurn, makeMatch, validatePlan } from './engine.mjs';
import { ARENA_ROUTES } from './layout.mjs';

/**
 * GAMBIT's actual Phaser gameplay entrypoint.
 * MODE: OFFLINE PRACTICE. The strategy engine is CLEAR TEXT in this build.
 * This file NEVER claims to encrypt strategies or generate chain receipts.
 * Gameplay and visual presentation are intentionally decoupled.
 */
const W=1440,H=810;
const C={bg:0x070d1b,ink:0x111b30,wall:0x26304c,cyan:0x58e4f3,pink:0xfa69ae,gold:0xffcb62,muted:'#a8b9d2',white:'#eff8ff'};
const ROLES=['SCOUT','GUARDIAN','STRIKER','CIPHER','ASSASSIN','TITAN'];
const FORMATIONS=[{x:288,y:299},{x:244,y:407},{x:303,y:515},{x:1138,y:299},{x:1181,y:407},{x:1120,y:515}];
type Field='base'|'trigger'|'response';
type Plan={base:number,trigger:number,response:number};
type VerifiedDuel={challengeId:bigint,outcome:0|1|2,explorerUrl:string,authenticated:true};
let lastSelectedPlan:Plan={base:0,trigger:0,response:1};
type Actor={shell:Phaser.GameObjects.Container,origin:{x:number,y:number}};
const names=['STRIKE','GUARD','FLANK'];
class GambitArena extends Phaser.Scene {
  private match=makeMatch(1102);
  private plan:Plan={base:0,trigger:0,response:1};
  private busy=false;
  private finished=false;
  private active=false;
  private actors:Actor[]=[];
  private round!:Phaser.GameObjects.Text;
  private scoreboard!:Phaser.GameObjects.Text;
  private notice!:Phaser.GameObjects.Text;
  private hint!:Phaser.GameObjects.Text;
  private choices:Record<Field,Phaser.GameObjects.Rectangle[]>={base:[],trigger:[],response:[]};
  private shade?:Phaser.GameObjects.Container;
  private buttons:Phaser.GameObjects.Container[]=[];
  private keyboardListener?: (e:KeyboardEvent)=>void;
  private watchingVerifiedDuel=false;
  constructor(){super('GambitArena');}

  create(){
    // Phaser Scene.restart() reuses this class instance. All mutable gameplay
    // state and GameObject references MUST be reset on every create().
    this.match=makeMatch(1102);
    this.plan={base:0,trigger:0,response:1};
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
      const groups:Record<Field,string[]>={base:['1','2','3'],trigger:['q','w','e'],response:['a','s','d']};
      for(const f of Object.keys(groups) as Field[]){const n=groups[f].indexOf(key);if(n>=0)this.choose(f,n);}
      if(key==='enter'||key===' '){e.preventDefault();this.lockPlan();}
    };
    window.addEventListener('keydown',this.keyboardListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      if(this.keyboardListener)window.removeEventListener('keydown',this.keyboardListener);
      this.game.events.off('gambit:verified-duel',this.showVerifiedDuel,this);
    });
    this.game.events.on('gambit:verified-duel',this.showVerifiedDuel,this);
  }

  private writeState(phase:string){
    const el=document.getElementById('game-state');
    if(!el)return;
    el.dataset.phase=phase;
    el.dataset.round=String(this.match.round);
    el.dataset.finished=String(this.finished);
    el.dataset.scoreA=String(this.match.scoreA);
    el.dataset.scoreB=String(this.match.scoreB);
    el.textContent=phase==='finished'
      ? 'Match complete. '+(this.match.winner===1?'Victory':this.match.winner===2?'Defeat':'Draw')
      : 'GAMBIT '+phase+', round '+(this.match.round+1);
  }

  private text(x:number,y:number,s:string,px=16,color=C.white,bold=false) {
    return this.add.text(x,y,s,{fontFamily:'Arial, sans-serif',fontSize:px+'px',fontStyle:bold?'bold':'normal',color,
      stroke:'#070a17',strokeThickness:px>26?2:0});
  }

  private drawWorld(){
    const g=this.add.graphics();
    g.fillStyle(0x0b1126).fillRect(0,0,W,H);
    // Distinct tactical rooms and navigable-looking approaches are the goal.
    const rooms=[
      [52,90,390,212,0x182c41],[999,90,389,212,0x241d3d],
      [53,315,390,236,0x142339],[999,315,389,236,0x291c38],
      [57,565,386,105,0x1a2031],[995,565,390,105,0x26203a]];
    for(const [x,y,w,h,color] of rooms){
      g.fillStyle(Number(color)).fillRoundedRect(Number(x),Number(y),Number(w),Number(h),21);
      g.lineStyle(5,C.wall,1).strokeRoundedRect(Number(x),Number(y),Number(w),Number(h),21);
    }
    for(let i=0;i<9;i++){
      g.lineStyle(2,0x364664,.23);
      g.lineBetween(0,87+i*70,W,87+i*70);
    }
    // Three purposeful lanes with obstacles and line-of-sight cover.
    for(const y of [230,415,592]){
      g.fillStyle(0x15233b).fillRoundedRect(440,y-50,560,100,22);
      g.lineStyle(2,0x587393,.35).strokeRoundedRect(440,y-50,560,100,22);
      for(let x=475;x<995;x+=64){g.lineStyle(2,0x55729a,.12).lineBetween(x,y-46,x,y+46);}
    }
    const props=[
      [164,191,110,48],[1180,191,110,48],
      [113,608,92,45],[1230,607,92,45],
      [492,297,79,56],[942,297,79,56],
      [491,516,79,56],[940,516,79,56]];
    for(const [x,y,w,h] of props){
      g.fillStyle(0x303b58).fillRoundedRect(x,y,w,h,7);
      g.lineStyle(3,0x7898b4,.5).strokeRoundedRect(x,y,w,h,7);
    }
    // The reactor is a readable objective, not just decoration.
    g.fillStyle(0x151b31).fillCircle(W/2,414,114);
    g.lineStyle(18,C.gold,.31).strokeCircle(W/2,414,101);
    g.lineStyle(5,C.gold,.75).strokeCircle(W/2,414,83);
    g.fillStyle(0xc77831).fillCircle(W/2,414,53);
    g.fillStyle(0xffdf85).fillCircle(W/2,414,31);
    const glow=this.add.circle(W/2,414,79,C.gold,.10).setDepth(5);
    this.tweens.add({targets:glow,scale:1.30,alpha:.35,yoyo:true,repeat:-1,duration:1350});
    this.text(154,104,'HYDROPONICS',17,'#7bdce3',true);
    this.text(1108,104,'COMMAND',17,'#e5a5fc',true);
    this.text(154,330,'CYAN ENTRY',17,'#79e6f7',true);
    this.text(1113,330,'VIOLET ENTRY',17,'#f6a1d1',true);
    this.text(152,576,'CARGO',17,C.muted,true);
    this.text(1127,576,'FABRICATION',17,C.muted,true);
    this.text(720,543,'REACTOR',16,'#ffe4a7',true).setOrigin(.5);
    // Simplified local-engine zones. No claim of free roaming or collisions.
    for(const [i,y] of [230,414,592].entries()){
      const hit=this.add.circle(720,y,i===1?79:48,C.cyan,.001).setInteractive({useHandCursor:true});
      hit.on('pointerdown',()=>this.choose('base',i===1?0:i===0?1:2));
    }
  }

  private drawFighters(){
    for(let i=0;i<6;i++){
      const pos=FORMATIONS[i],color=i<3?C.cyan:C.pink;
      const unit=this.add.container(pos.x,pos.y).setDepth(1200);
      const ring=this.add.ellipse(0,35,78,23,color,.16).setStrokeStyle(3,color,.8);
      const body=this.add.ellipse(0,0,56,65,i<3?0x2a6c89:0x8e315f,1).setStrokeStyle(3,color,.92);
      const helm=this.add.ellipse(0,-21,58,48,i===1?0x6b913c:i===4?0x5a2d8a:0x3f5579,1).setStrokeStyle(2,0xeeeeee,.4);
      const eyes=this.add.rectangle(1,-22,31,12,i<3?0x9fffff:0xffc9ec,1);
      const marker=this.text(0,53,ROLES[i],12,i<3?'#9cf8ff':'#ffb4df',true).setOrigin(.5);
      unit.add([ring,body,helm,eyes,marker]);
      this.actors.push({shell:unit,origin:{...pos}});
      this.tweens.add({targets:unit,angle:i%2?2:-2,duration:950+i*40,yoyo:true,repeat:-1});
    }
  }

  private drawHUD(){
    const h=this.add.rectangle(W/2,45,W,90,0x070c1a,.94).setDepth(1900);
    h.setStrokeStyle(2,0x475b80,.65);
    this.text(30,18,'GAMBIT',35,C.white,true).setDepth(2000);
    this.text(31,60,'SOLO PRACTICE  ·  NOT ENCRYPTED',13,'#a2cce2',true).setDepth(2000);
    this.round=this.text(720,19,'ROUND 1 / 5',23,C.white,true).setOrigin(.5,0).setDepth(2000);
    this.scoreboard=this.text(720,51,'0 : 0',24,'#ffe3a7',true).setOrigin(.5,0).setDepth(2000);
    this.text(1240,34,'VIOLET SQUAD',19,'#ffa1d8',true).setDepth(2000);
    const shadow=this.add.rectangle(720,121,690,47,0x090d1a,.8).setStrokeStyle(1,0x49678f,.55).setDepth(1900);
    this.notice=this.text(720,107,'Capture the reactor by outsmarting the opposing squad',20,'#fff0b5',true).setOrigin(.5,0).setDepth(2000);
    this.hint=this.text(720,154,'Pick your first move, predict the enemy move, then set your response',15,'#d7e7ff').setOrigin(.5,0).setDepth(2000);
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

  private choose(field:Field,index:number){
    if(!this.active||this.busy||this.finished)return;
    this.plan[field]=index;lastSelectedPlan={...this.plan};this.refresh();
  }
  private refresh(){
    this.round.setText('ROUND '+Math.min(this.match.round+1,5)+' / 5');
    this.scoreboard.setText(this.match.scoreA+' : '+this.match.scoreB);
    const fields:Field[]=['base','trigger','response'];
    fields.forEach((field,i)=>this.choices[field].forEach((rect,j)=>{
      const active=this.plan[field]===j;
      rect.setFillStyle(active?i===0?0x20687a:i===1?0x665128:0x69355b:0x17263f);
      rect.setStrokeStyle(active?3:1,active?i===0?C.cyan:i===1?C.gold:C.pink:0x53698b,active?1:.65);
    }));
  }

  private intro(){
    this.active=false;
    const overlay=this.add.container(0,0).setDepth(7000);
    overlay.add(this.add.rectangle(W/2,H/2,W,H,0x050912,.82));
    const panel=this.add.rectangle(W/2,H/2,650,320,0x15213a,.99).setStrokeStyle(3,C.cyan,.8);
    overlay.add(panel);
    overlay.add(this.text(W/2,270,'GAMBIT',63,C.white,true).setOrigin(.5));
    overlay.add(this.text(W/2,345,'ONE PLAN. THREE MOVES. UNLIMITED MIND GAMES.',20,'#9feefc',true).setOrigin(.5));
    overlay.add(this.text(W/2,393,'Choose your opening, predict theirs, program your counter.',17,C.white).setOrigin(.5));
    overlay.add(this.text(W/2,427,'LOCAL PRACTICE ONLY  •  NO WALLET OR ENCRYPTION',13,'#a9b8d7',true).setOrigin(.5));
    const bg=this.add.rectangle(W/2,496,280,57,0x0d6179).setStrokeStyle(2,C.cyan).setInteractive({useHandCursor:true});
    overlay.add([bg,this.text(W/2,496,'ENTER ARENA',20,C.white,true).setOrigin(.5)]);
    const begin=()=>{overlay.destroy(true);this.active=true;this.writeState('ready');window.removeEventListener('keydown',enterKey);};
    const enterKey=(e:KeyboardEvent)=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();begin();}};
    bg.on('pointerdown',begin);
    window.addEventListener('keydown',enterKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>window.removeEventListener('keydown',enterKey));
  }

  private lockPlan(){
    if(!this.active||this.busy||this.finished||this.watchingVerifiedDuel)return;
    let res:any;
    try{res=commitTurn(this.match,validatePlan(this.plan));}
    catch(err){this.notice.setText('That plan is not valid. Choose again.');return;}
    this.busy=true;this.match=res.match;this.writeState('resolving');
    const event=res.event;
    this.notice.setText('Resolving confrontation…');
    this.hint.setText('Local simulator resolving a deterministic match');
    const a=this.actors[event.player],b=this.actors[event.enemy+3];
    const y=event.player===1?230:event.player===2?592:414;
    const otherY=event.enemy===1?230:event.enemy===2?592:414;
    this.tweens.add({targets:a.shell,x:645,y,duration:370,ease:'Sine.easeOut'});
    this.tweens.add({targets:b.shell,x:790,y:otherY,duration:370,ease:'Sine.easeOut'});
    this.time.delayedCall(530,()=>{
      if(this.watchingVerifiedDuel)return;
      const color=event.outcome===1?C.cyan:event.outcome===2?C.pink:C.gold;
      const impact=this.add.circle(720,(y+otherY)/2,32,color,.3).setStrokeStyle(5,color).setDepth(1900);
      this.tweens.add({targets:impact,alpha:0,scale:4,duration:560,onComplete:()=>impact.destroy()});
      this.cameras.main.shake(130,.002);
      this.notice.setText(event.outcome===1?'OUTPLAYED · REACTOR ADVANTAGE':
        event.outcome===2?'COUNTERED · REPLAN':'STALEMATE · TRY A NEW COUNTER');
    });
    this.time.delayedCall(1230,()=>{
      if(this.watchingVerifiedDuel)return;
      for(const unit of [a,b])this.tweens.add({targets:unit.shell,x:unit.origin.x,y:unit.origin.y,duration:380});
    });
    this.time.delayedCall(1670,()=>{
      if(this.watchingVerifiedDuel)return;
      this.busy=false;this.refresh();
      if(this.match.finished)this.gameOver();
      else {this.hint.setText('Watch the score. Change your plan and lock the next round.');this.writeState('ready');}
    });
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
      const isChallenger=i<3;
      this.tweens.add({targets:actor.shell,
        x:isChallenger?565+(i*31):874-((i-3)*31),
        y:290+(i%3)*105,duration:550+i*65,ease:'Sine.easeOut'});
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
    overlay.add(this.text(W/2,426,'Rewrite your gambit and challenge again.',17,C.white).setOrigin(.5));
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

export default game;
