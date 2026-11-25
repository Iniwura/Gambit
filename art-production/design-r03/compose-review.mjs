#!/usr/bin/env node
// Offline design review, NOT game implementation. No network, wallet, or gameplay writes.
// node compose-review.mjs <generated-svg-dir> <render-plate-dir> <output.html> [plate-map.json]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ui=path.resolve(process.argv[2]||path.join(here,'review'));
const plates=path.resolve(process.argv[3]||path.join(here,'../../previews/v003'));
const dest=path.resolve(process.argv[4]||path.join(ui,'design-review.html'));
const mapping=process.argv[5]?JSON.parse(fs.readFileSync(path.resolve(process.argv[5]),'utf8')):{};
const spec=JSON.parse(fs.readFileSync(path.join(ui,'index.json'),'utf8'));
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const encode=(f,t)=>'data:'+t+';base64,'+fs.readFileSync(f).toString('base64');
const missing=new Set(),resolved=new Map();
const scenes=spec.screens.map(s=>{
 let art=resolved.get(s.asset);
 if(art===undefined){
  const p=path.resolve(plates,mapping[s.asset]||s.asset);
  const ext=path.extname(p).toLowerCase();
  art=fs.existsSync(p)&&mime[ext]?encode(p,mime[ext]):null;
  resolved.set(s.asset,art);
  if(!art)missing.add(s.asset);
 }
 return {...s,hasArt:!!art,overlayData:encode(path.join(ui,s.overlay),'image/svg+xml')};
});
const assets=Object.fromEntries(resolved);
const allIds=new Set(scenes.map(s=>s.id));
const H={};
const spot=(id,x,y,w,h,to,label)=>{if(!allIds.has(id)||!allIds.has(to))throw Error('Unknown screen: '+id+' / '+to);(H[id]??=[]).push({x,y,w,h,to,label})};
const d=(id,to,x=1240,y=785,w=328,h=62,label='Continue')=>spot(id,x,y,w,h,to,label);
spot('01-boot',0,0,1600,900,'02-command','Continue to title');
['04-lobby','03-first-run','18-blacksite','23-commander'].forEach((id,i)=>spot('02-command',64,269+i*62,350,53,id,['Play Arena','Tactical Academy','Blacksite','Commander'][i]));
spot('02-command',48,790,132,48,'24-settings','Settings');
spot('03-first-run',860,720,570,44,'17-training','Try an opening');
spot('03-first-run',1248,796,240,43,'17-training','Skip hints');
d('04-lobby','05-invite',1042,712,494,58,'Create match');d('04-lobby','25-recovery',1042,782,494,44,'Join / resume');
d('05-invite','06-squad',1042,712,494,58,'Copy invitation / continue');d('05-invite','25-recovery',1042,782,494,44,'Recover match');
d('06-squad','07-deployment',1240,804,328,55,'Begin planning');
d('07-deployment','08-planning',614,695,372,58,'Plan round');d('07-deployment','08-planning',614,766,372,48,'Skip intro');
d('08-planning','09-gambit',1086,728,110,44,'Activate GAMBIT');d('08-planning','10-wallet',1254,810,314,62,'Encrypt & review');
d('09-gambit','08-planning',970,728,110,44,'Deactivate GAMBIT');d('09-gambit','10-wallet',1254,810,314,62,'Encrypt & review');
d('10-wallet','11-encryption',526,641,548,55,'Review confirmation (visual only)');d('10-wallet','08-planning',526,706,548,39,'Back');
d('11-encryption','12-waiting',1230,742,338,52,'Preview sealed waiting state');d('11-encryption','08-planning',1230,805,338,45,'Cancel safely');
d('12-waiting','02-command',1230,742,338,52,'Return to command');d('12-waiting','13-resolve',1230,805,338,45,'Preview both sealed');
d('13-resolve','13b-finalize',1230,742,338,52,'Preview resolution review');d('13-resolve','02-command',1230,805,338,45,'Return to command');
d('13b-finalize','14-round-result',1230,742,338,52,'Preview finalization');d('13b-finalize','02-command',1230,805,338,45,'Return to command');
d('14-round-result','08-planning',1240,797,328,58,'Next round layout');
['15-debrief','15b-defeat','15c-draw'].forEach(id=>{
 d(id,'16-proof',870,718,320,52,'View verified record layout');
 d(id,'04-lobby',1204,718,364,52,'Play again');d(id,'02-command',1204,782,364,44,'Return to command');
});
d('16-proof','23-commander',1030,752,324,50,'Back');
d('17-training','17b-training-result',1254,810,314,62,'Preview local result');
d('17b-training-result','17-training',1210,780,358,62,'Play again');
d('18-blacksite','20b-local-vault',1042,712,494,58,'Local practice');d('18-blacksite','19-warden',1042,782,494,44,'Competitive setup study');
d('19-warden','20-operative',1224,785,344,60,'Preview operative invitation');
d('20-operative','21-vault-processing',1240,783,328,62,'Preview attempt review');
d('20b-local-vault','22-vault-debrief',1240,783,328,62,'Preview local result');
d('21-vault-processing','22-vault-debrief',1228,780,340,60,'Preview verified result');
d('22-vault-debrief','23-commander',614,695,372,58,'View result layout');d('22-vault-debrief','02-command',614,766,372,48,'Return to command');
d('22b-vault-locked','20b-local-vault',614,695,372,58,'Retry practice');d('22b-vault-locked','02-command',614,766,372,48,'Return to command');
d('23-commander','16-proof',442,780,326,48,'Inspect record');d('23-commander','02-command',1220,784,348,51,'Return to command');
d('23b-empty-profile','04-lobby',1224,786,344,55,'Enter Arena');
d('24-settings','08-planning',526,641,548,55,'Resume');d('24-settings','02-command',526,706,548,39,'Return to command');
d('25-recovery','12-waiting',1042,712,494,58,'Recover public state layout');d('25-recovery','02-command',1042,782,494,44,'Return to command');
d('25b-wrong-chain','25-recovery',526,641,548,55,'Check network layout');d('25b-wrong-chain','04-lobby',526,706,548,39,'Back');
d('25c-rejected','10-wallet',526,641,548,55,'Return to review');d('25c-rejected','08-planning',526,706,548,39,'Back');
d('25d-unknown','25-recovery',526,641,548,55,'Check public state');d('25d-unknown','02-command',526,706,548,39,'Return to command');
d('25e-expired','02-command',614,695,372,58,'Return to command');d('25e-expired','16-proof',614,766,372,48,'Public record layout');
d('25f-asset-error','01-boot',614,640,372,60,'Retry asset loading layout');
['m02-planning','m05-training','m06-blacksite','m07-commander'].forEach((id,i)=>spot('m01-command',24,360+i*62,342,53,id,['Arena','Academy','Blacksite','Commander'][i]));
spot('m02-planning',16,768,358,56,'m03-review','Encrypt & review');spot('m03-review',32,667,326,56,'m04-wait','Preview pending state');spot('m03-review',32,730,326,44,'m02-planning','Back');
spot('m04-wait',16,714,358,51,'m02-planning','Next state');spot('m04-wait',16,773,358,51,'m01-command','Return to command');
spot('m05-training',16,768,358,56,'17b-training-result','Preview training debrief');spot('m06-blacksite',16,768,358,56,'21-vault-processing','Preview attempt processing');
spot('m07-commander',16,717,358,48,'16-proof','Record layout');spot('m07-commander',16,774,358,50,'m01-command','Return to command');spot('l01-planning',582,331,250,44,'m03-review','Wallet layout');
const data=JSON.stringify({scenes,assets,hotspots:H,missing:[...missing]}).replace(/</g,'\\u003c');
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GAMBIT R03 — Design Review</title><style>'+
':root{color-scheme:dark;font:14px system-ui;background:#10161b;color:#eee9d9}*{box-sizing:border-box}body{margin:0;display:grid;grid-template-rows:auto 1fr auto;height:100dvh;overflow:hidden}header,footer{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#182127;border-bottom:1px solid #45565d}header strong{color:#e7cc82;white-space:nowrap}header small{color:#b3c0bd}button,select{font:inherit;background:#222d33;color:#eee9d9;border:1px solid #45565d;padding:8px 10px}button:focus-visible,select:focus-visible,.hot:focus-visible{outline:2px solid #e7cc82;outline-offset:2px}select{flex:1;min-width:0}main{display:flex;min-height:0;min-width:0;align-items:center;justify-content:center;padding:12px;overflow:hidden}.stage{position:relative;overflow:hidden;flex:none;background:#182127;box-shadow:0 12px 60px #0009}.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}.stage .plate{object-fit:cover}.empty{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:8px;color:#b3c0bd;font:13px monospace}.empty strong{color:#e7cc82}.hot{position:absolute;cursor:pointer;background:transparent;border:0;padding:0}.show-hot .hot{background:#e7cc8220;outline:1px dashed #e7cc82}footer{border-top:1px solid #45565d;border-bottom:0;justify-content:space-between;color:#b3c0bd;font-size:12px}footer span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alert{color:#ef9b88}@media(max-width:700px){header small,footer span:last-child,#full{display:none}header,footer{padding:8px;gap:6px}header strong{font-size:12px}main{padding:6px}}'+
'</style><header><strong>GAMBIT / R03</strong><small>DESIGN REVIEW — NOT A PLAYABLE GAME</small><select aria-label="Screen" id="screen"></select><button id="prev" aria-label="Previous screen">‹</button><button id="next" aria-label="Next screen">›</button><button id="hints">Hotspots</button><button id="full">Fullscreen</button></header><main id="main"><div id="stage" class="stage"></div></main><footer><span id="status"></span><span>Sample UI data · No transactions · Design not approved</span></footer><script type="application/json" id="data">'+data+'</script><script>'+
'const D=JSON.parse(document.getElementById("data").textContent),S=D.scenes,$=id=>document.getElementById(id),stage=$("stage"),main=$("main"),select=$("screen");let i=0;for(const s of S){const o=document.createElement("option");o.value=s.id;o.textContent=s.id+" — "+s.name;select.append(o)}function size(){const s=S[i],r=Math.min(main.clientWidth/s.width,main.clientHeight/s.height)*.98;stage.style.width=(s.width*r)+"px";stage.style.height=(s.height*r)+"px"}function go(id){const j=S.findIndex(s=>s.id===id);if(j<0)return;i=j;const s=S[i];select.value=s.id;stage.replaceChildren();if(s.hasArt){const img=document.createElement("img");img.className="plate";img.alt="Blender art plate: "+s.asset;img.src=D.assets[s.asset];stage.append(img)}else{const e=document.createElement("div");e.className="empty";const b=document.createElement("strong");b.textContent="BLENDER PLATE REQUIRED";const t=document.createElement("span");t.textContent=s.asset;e.append(b,t);stage.append(e)}const overlay=document.createElement("img");overlay.alt=s.name+" — design overlay";overlay.src=s.overlayData;stage.append(overlay);for(const h of D.hotspots[s.id]||[]){const b=document.createElement("button");b.className="hot";b.title=h.label;b.setAttribute("aria-label",h.label);Object.assign(b.style,{left:100*h.x/s.width+"%",top:100*h.y/s.height+"%",width:100*h.w/s.width+"%",height:100*h.h/s.height+"%"});b.onclick=()=>go(h.to);stage.append(b)}$("status").className=s.hasArt?"":"alert";$("status").textContent=(i+1)+" / "+S.length+" · "+s.name+" · "+(s.hasArt?"Art plate present":"Missing "+s.asset)+" · "+D.missing.length+" missing plate(s)";size()}select.onchange=()=>go(select.value);$("prev").onclick=()=>go(S[(i+S.length-1)%S.length].id);$("next").onclick=()=>go(S[(i+1)%S.length].id);$("hints").onclick=()=>stage.classList.toggle("show-hot");$("full").onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else main.requestFullscreen?.()};window.addEventListener("resize",size);document.addEventListener("fullscreenchange",size);document.addEventListener("keydown",e=>{if(["INPUT","SELECT","TEXTAREA","BUTTON"].includes(document.activeElement?.tagName))return;if(e.key==="ArrowRight")$("next").click();if(e.key==="ArrowLeft")$("prev").click()});go(S[0].id)</script></html>';
fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);
console.log('Design-only review: '+dest+'\\n'+scenes.length+' screens, '+(assets?Object.keys(assets).length:0)+' unique art slots, '+missing.size+' missing.\\n'+[...missing].join('\\n'));
