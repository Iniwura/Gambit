import Phaser from 'phaser';

/**
 * GAMBIT visual direction: a single connected orbital reactor deck.
 * This is original procedural Phaser artwork, not a sprite-sheet from
 * Among Us or a simulated view of encrypted movement.
 *
 * Keep scenery separate from rules so neither battle balance nor
 * verified chain outcomes depends on rendering.
 */
const DECK={
  night:0x070d17,
  abyss:0x030711,
  hull:0x141e2d,
  panel:0x172438,
  panelRaised:0x1b3045,
  seam:0x36506c,
  cyan:0x58e4f3,
  violet:0xfb78b0,
  amber:0xffbf61,
  white:0xe8f7ff
};

export function renderReactorDeck(scene:Phaser.Scene){
  const W=1440,H=810;
  const CY=[282,414,546];
  const textureKey='gambit-orbital-deck-v2';
  if(!scene.textures.exists(textureKey)){
    const g=scene.add.graphics().setDepth(0);

  // Negative space at the edges makes the continuous deck read as a place,
  // rather than disconnected neon boxes or an HTML dashboard.
  g.fillStyle(DECK.abyss,1).fillRect(0,0,W,H);
  for(let i=0;i<100;i++){
    const x=(i*173+41)%W,y=(i*137+29)%H;
    if(y<90||y>678||x<84||x>1356){
      g.fillStyle(i%7===0?0x7fabc4:0x3c516b,i%7===0?.62:.28).fillCircle(x,y,i%13===0?2:1);
    }
  }

  // Three stacked hull/rim layers — the board has physical thickness.
  g.fillStyle(0x02050b,.9).fillRoundedRect(72,196,1296,465,38);
  g.fillStyle(0x26394b,.84).fillRoundedRect(84,177,1272,473,36);
  g.fillStyle(0x0b1321,1).fillRoundedRect(93,183,1254,445,29);
  g.lineStyle(5,0x67859b,.40).strokeRoundedRect(93,183,1254,445,29);
  g.lineStyle(2,0x9bc9db,.17).strokeRoundedRect(108,197,1224,418,26);

  // Cross-deck geometric panels, deliberately restricted to ship flooring.
  for(let row=0;row<13;row++){
    const y=206+row*31;
    for(let col=0;col<35;col++){
      const x=120+col*35;
      if(x>1307)continue;
      const panelColor=(row+col)%5===0?0x21344a:0x152334;
      g.fillStyle(panelColor,.63).fillRoundedRect(x,y,31,27,3);
      g.lineStyle(1,0x465770,.12).strokeRoundedRect(x,y,31,27,3);
    }
  }

  // Side docking assemblies. Thick hardware borders signal cover and walls.
  for(const side of [0,1]){
    const outerX=side===0?108:1086;
    const tint=side===0?DECK.cyan:DECK.violet;
    g.fillStyle(0x0e192b).fillRoundedRect(outerX,211,245,395,20);
    g.lineStyle(4,tint,.23).strokeRoundedRect(outerX,211,245,395,20);
    for(let i=0;i<3;i++){
      const y=237+i*132;
      g.fillStyle(0x26384c,1).fillRoundedRect(outerX+18,y,208,92,15);
      g.fillStyle(0x0b1627,1).fillRoundedRect(outerX+28,y+9,187,74,11);
      g.lineStyle(2,0x4b7591,.45).strokeRoundedRect(outerX+28,y+9,187,74,11);
      g.lineStyle(2,tint,.56).lineBetween(outerX+40,y+75,outerX+197,y+75);
      g.fillStyle(tint,.66).fillCircle(outerX+37,y+14,3);
      g.fillStyle(tint,.66).fillCircle(outerX+198,y+14,3);
    }
  }

  // Three walkable visual lanes — role emphasis, NOT simulated collision.
  // They have no fake waypoint/pathfinding behavior.
  for(let i=0;i<3;i++){
    const y=CY[i];
    g.fillStyle(0x040b17,.78).fillRoundedRect(350,y-47,741,94,12);
    g.fillStyle(i===1?0x1d3044:0x192a3d,.95).fillRoundedRect(360,y-41,721,82,9);
    g.lineStyle(3,0x7994a3,.35).strokeRoundedRect(360,y-41,721,82,9);
    g.lineStyle(2,0x7198a7,.24).lineBetween(373,y,1067,y);
    for(let x=386;x<1067;x+=57){
      g.lineStyle(1,0x91a8b7,.20).lineBetween(x,y-31,x,y+31);
      g.fillStyle(0xa1c6d3,.26).fillCircle(x,y-33,1.3);
      g.fillStyle(0xa1c6d3,.26).fillCircle(x,y+33,1.3);
    }
    g.lineStyle(5,i===0?0x7bb4cd:i===1?0xf6b970:0xa991c3,.24)
      .lineBetween(369,y-38,1069,y-38);
    g.lineStyle(4,i===0?0x7bb4cd:i===1?0xf6b970:0xa991c3,.15)
      .lineBetween(369,y+38,1069,y+38);
  }

  // Power conduits visually unify all three routes to the central reactor.
  for(const x of [609,830]){
    g.lineStyle(27,0x07101f,.95).lineBetween(x,231,x,604);
    g.lineStyle(14,0x2e485b,.95).lineBetween(x,231,x,604);
    g.lineStyle(4,DECK.amber,.22).lineBetween(x,241,x,601);
    for(let i=0;i<10;i++){
      const y=251+i*35;
      g.fillStyle(0xa2bac5,.34).fillRoundedRect(x-16,y,32,5,2);
    }
  }

  // Angled hazard markers where the reactor deck meets its conduits.
  for(const y of [236,587]){
    for(let i=0;i<8;i++){
      const x=642+i*24;
      g.fillStyle(i%2===0?DECK.amber:0x1e2d41,.55);
      g.fillTriangle(x,y,x+16,y,x+8,y+10);
    }
  }

  // Mechanical blocks give foreground elements real apparent depth.
  for(const block of [
    {x:465,y:217},{x:935,y:217},{x:465,y:561},{x:935,y:561}
  ]){
    g.fillStyle(0x050a12,.85).fillRoundedRect(block.x-42,block.y+4,86,39,8);
    g.fillStyle(0x35465c,1).fillRoundedRect(block.x-43,block.y-7,86,38,8);
    g.fillStyle(0x1d2c40,1).fillRoundedRect(block.x-35,block.y-3,70,26,5);
    g.lineStyle(2,0x7a95a8,.43).strokeRoundedRect(block.x-43,block.y-7,86,38,8);
    g.fillStyle(DECK.amber,.47).fillRoundedRect(block.x-18,block.y+7,37,3,2);
  }

  // Central reactor has distinct nested housings and low-frequency lighting.
  g.fillStyle(0x02060c,1).fillCircle(720,414,114);
  g.fillStyle(0x24354b,1).fillCircle(720,414,103);
  g.fillStyle(0x071321,1).fillCircle(720,414,92);
  g.lineStyle(10,DECK.amber,.75).strokeCircle(720,414,95);
  g.lineStyle(3,0xffe4a9,.65).strokeCircle(720,414,78);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    g.lineStyle(4,0xfce3b7,.72).lineBetween(720+Math.cos(a)*86,414+Math.sin(a)*86,
      720+Math.cos(a)*97,414+Math.sin(a)*97);
  }
  g.fillStyle(0x0e2030,1).fillCircle(720,414,62);
  g.lineStyle(3,DECK.amber,.60).strokeCircle(720,414,61);
  g.fillStyle(0xbd742e,.94).fillCircle(720,414,43);
  g.fillStyle(0xffd182,.86).fillCircle(720,414,26);
  g.fillStyle(0xfff6d6,.90).fillCircle(720,414,11);
    // Draw once. Phaser's static Graphics meshes are expensive to
    // re-tessellate every frame; the immutable deck is one WebGL texture.
    g.generateTexture(textureKey,W,H);
    g.destroy();
  }
  scene.add.image(0,0,textureKey).setOrigin(0,0).setDepth(0);
  const reactorGlow=scene.add.circle(720,414,50,DECK.amber,.17).setDepth(3);
  const rim=scene.add.circle(720,414,87,DECK.amber,.001)
    .setStrokeStyle(4,DECK.amber,.56).setDepth(3);
  scene.tweens.add({targets:reactorGlow,scale:1.44,alpha:.04,duration:1700,
    yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
  scene.tweens.add({targets:rim,scale:1.14,alpha:0,duration:1900,
    yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

  const mark=(x:number,y:number,label:string,color:string)=>{
    const t=scene.add.text(x,y,label,{fontFamily:'Arial, sans-serif',
      fontSize:'14px',fontStyle:'bold',color,letterSpacing:1.5})
      .setOrigin(.5).setDepth(6);
    return t;
  };
  mark(453,282,'01  /  SCOUT','#a5c3d5');
  mark(451,414,'02  /  GUARD','#b7cada');
  mark(457,546,'03  /  STRIKE','#b4bfda');
  mark(994,282,'RECON  /  01','#c9aabf');
  mark(996,414,'DEFENSE  /  02','#c9aabf');
  mark(994,546,'ASSAULT  /  03','#c9aabf');

  // Outer side teams are easy to distinguish without UI chrome everywhere.
  const team=(x:number,label:string,tint:number,side:'left'|'right')=>{
    const title=scene.add.text(x,189,label,{
      fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',
      color:side==='left'?'#7cebf3':'#ff9bce',letterSpacing:2
    }).setOrigin(.5).setDepth(6);
    const light=scene.add.rectangle(x,209,151,3,tint,.78).setDepth(6);
    return [title,light];
  };
  team(232,'CYAN / COMMAND',DECK.cyan,'left');
  team(1207,'VIOLET / DEFENSE',DECK.violet,'right');
  return {lanes:CY};
}
