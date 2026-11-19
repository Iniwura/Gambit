import Phaser from 'phaser';

/** Entirely original geometric suit designs made from Phaser GameObjects.
 * Built in one Graphics object per fighter for stable real-time rendering.
 * Temporary art until approved hand-painted sprite sheets are prepared.
 */
const COLORS={
  cyan:{outer:0x163c55,armor:0x2f7590,edge:0x77f1ff,glass:0x78f2ff,shadow:0x071c2c},
  violet:{outer:0x4e254b,armor:0x9b4a79,edge:0xffa7d0,glass:0xffb7e6,shadow:0x260b23}
};
const ROLES=['SCOUT','GUARDIAN','STRIKER'];
export function makeFighter(scene:Phaser.Scene,index:number,x:number,y:number){
  const enemy=index>=3;
  const role=index%3;
  const palette=enemy?COLORS.violet:COLORS.cyan;
  const group=scene.add.container(x,y).setDepth(1200);
  const shadow=scene.add.ellipse(0,42,86,19,0x000000,.55);
  const ground=scene.add.ellipse(0,41,88,26,palette.edge,.035)
    .setStrokeStyle(2,palette.edge,.65).setName('selection-ring');
  const g=scene.add.graphics();

  // Boots, legs and shadow edges: silhouette reads at gameplay scale.
  for(const sign of [-1,1]){
    g.fillStyle(0x081624,1).fillRoundedRect(sign<0?-22:7,19,17,30,6);
    g.fillStyle(palette.armor,1).fillRoundedRect(sign<0?-20:9,18,13,25,5);
    g.fillStyle(palette.edge,.52).fillRoundedRect(sign<0?-20:9,39,13,4,2);
  }

  // Backpack and role-specific external silhouette.
  g.fillStyle(0x081422,1).fillRoundedRect(-34,-16,68,56,11);
  g.fillStyle(palette.outer,1).fillRoundedRect(-31,-13,62,51,10);
  g.lineStyle(2,palette.edge,.72).strokeRoundedRect(-31,-13,62,51,10);
  if(role===0){
    // Scout: thin forward antenna and compact pressure suit.
    g.lineStyle(3,palette.edge,.85).lineBetween(24,-43,35,-64);
    g.fillStyle(0xeafaff,.94).fillCircle(35,-64,4);
    g.fillStyle(0x172d3a,1).fillRoundedRect(-33,-9,11,22,4);
  }else if(role===1){
    // Guardian: massive twin shoulder armor, reinforced chest.
    for(const sign of [-1,1]){
      const px=sign<0?-39:24;
      g.fillStyle(palette.armor,1).fillRoundedRect(px,-17,16,38,7);
      g.lineStyle(2,palette.edge,.85).strokeRoundedRect(px,-17,16,38,7);
    }
  }else{
    // Striker: angled flared plating reads as an assault silhouette.
    g.fillStyle(palette.armor,1).fillTriangle(-34,-23,-47,-34,-32,7);
    g.fillStyle(palette.armor,1).fillTriangle(34,-23,47,-34,32,7);
    g.lineStyle(2,palette.edge,.64).lineBetween(-45,-30,-34,-5);
    g.lineStyle(2,palette.edge,.64).lineBetween(45,-30,34,-5);
  }

  // Independent chest, arms and polished highlight.
  const chestWidth=role===1?50:role===0?39:45;
  g.fillStyle(palette.armor,1).fillRoundedRect(-chestWidth/2,-16,chestWidth,48,10);
  g.lineStyle(2,palette.edge,.86).strokeRoundedRect(-chestWidth/2,-16,chestWidth,48,10);
  g.fillStyle(0x142a3d,.96).fillRoundedRect(-15,-8,30,25,6);
  g.lineStyle(1,0xe7f7ff,.5).strokeRoundedRect(-15,-8,30,25,6);
  if(role===0){
    g.fillStyle(palette.glass,.85).fillTriangle(-7,5,0,-3,7,5);
    g.fillStyle(0xeefaff,.7).fillCircle(0,7,3);
  }else if(role===1){
    g.fillStyle(palette.edge,.7).fillRoundedRect(-4,-4,8,19,3);
    g.fillStyle(palette.edge,.7).fillRoundedRect(-10,2,20,7,2);
  }else{
    g.fillStyle(palette.glass,.87).fillTriangle(-9,-3,11,0,-5,14);
    g.fillStyle(0xeaf8ff,.58).fillCircle(0,6,3);
  }

  // Arms, elbow bearings and wrist tools.
  for(const sign of [-1,1]){
    const px=sign<0?-36:22;
    g.fillStyle(palette.outer,1).fillRoundedRect(px,-12,15,35,6);
    g.lineStyle(1.5,palette.edge,.67).strokeRoundedRect(px,-12,15,35,6);
    g.fillStyle(palette.glass,.38).fillRoundedRect(px+3,13,9,7,3);
  }

  // Helmet: character-first design, not the old ellipse-over-ellipse placeholder.
  g.fillStyle(0x060f1c,.96).fillRoundedRect(-29,-53,58,47,17);
  g.fillStyle(palette.outer,1).fillRoundedRect(-26,-52,52,44,15);
  g.lineStyle(3,palette.edge,.9).strokeRoundedRect(-26,-52,52,44,15);
  g.fillStyle(0x091e30,1).fillRoundedRect(-21,-42,42,24,9);
  g.fillStyle(palette.glass,.82).fillRoundedRect(-18,-40,36,19,8);
  g.fillStyle(0xdbffff,.76).fillRoundedRect(-13,-38,19,4,2);
  g.fillStyle(0x142a44,.53).fillRoundedRect(5,-33,10,10,3);
  g.lineStyle(2,0xffffff,.18).lineBetween(-16,-14,13,-14);
  for(const px of [-22,22]){
    g.fillStyle(0xdce9f4,.75).fillCircle(px,-20,2);
  }

  const light=scene.add.circle(0,-36,3,palette.edge,.80);
  const tag=scene.add.text(0,65,ROLES[role],{
    fontFamily:'Arial, sans-serif',fontStyle:'bold',fontSize:'13px',
    color:enemy?'#ffb6db':'#b0f6ff',letterSpacing:1.7,
    stroke:'#04101c',strokeThickness:3
  }).setOrigin(.5);
  group.add([shadow,ground,g,light,tag]);
  // Idle light breathes without conflicting with combat movement tweens.
  scene.tweens.add({targets:light,alpha:.2,duration:950+role*170,
    yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
  group.setSize(96,134);
  if(!enemy)group.setInteractive(new Phaser.Geom.Rectangle(-48,-70,96,134),Phaser.Geom.Rectangle.Contains);
  return group;
}
