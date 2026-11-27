import {createNeutralPractice} from './neutral-practice.mjs';
import './neutral-practice.css';
/** Local rehearsal panel; no network or wallet. Existing four-slot
 * introductory tutorial remains separate and unchanged.
 */
export function mountNeutralPractice(){
 const host=document.getElementById('gambit-blacksite-dialog');
 if(!host||document.getElementById('gambit-neutral-practice'))return;
 const panel=document.createElement('details');panel.id='gambit-neutral-practice';
 panel.innerHTML=`<summary>BLACKSITE · Advanced local rehearsal</summary>
 <p>Five glyphs. Four attempts. Choose your approach. Local practice only; not encrypted or ranked.</p>
 <div class="np-stats"><span data-field="remaining">4 attempts</span><span data-field="heat">Heat 0</span><span data-field="score">Score 0</span></div>
 <p role="status" aria-live="polite" data-field="message">Open a practice vault when ready.</p>
 <button type="button" data-action="start">START REHEARSAL</button>
 <div data-field="planner" hidden><fieldset><legend>Enter five glyphs (0–3)</legend><div class="np-glyphs" data-field="glyphs"></div></fieldset>
 <label>Approach <select data-field="route"><option value="STEALTH">STEALTH · exact only · 0 heat</option><option value="PROBE" selected>PROBE · exact + misplaced · +1 heat</option><option value="BREACH">BREACH · opens on 5 exact · +2 heat</option></select></label>
 <button type="button" data-action="attempt">TEST CODE</button></div>
 <ol data-field="history" aria-label="Rehearsal attempt history"></ol>`;
 host.append(panel);
 const field=<T extends HTMLElement>(name:string)=>panel.querySelector<T>('[data-field="'+name+'"]')!;
 const button=(name:string)=>panel.querySelector<HTMLButtonElement>('[data-action="'+name+'"]')!;
 const glyphs=field('glyphs'),selects:HTMLSelectElement[]=[];
 for(let i=0;i<5;i++){
  const label=document.createElement('label');label.textContent='Glyph '+(i+1);
  const select=document.createElement('select');
  for(let n=0;n<4;n++)select.append(new Option(String(n),String(n)));
  select.value=String(i%4);selects.push(select);label.append(select);glyphs.append(label);
 }
 let session:ReturnType<typeof createNeutralPractice>|null=null;
 function render(){
  if(!session)return;
  const state=session.view(),active=state.status==='ACTIVE';
  field('remaining').textContent=state.remaining+' attempts left';
  field('heat').textContent='Heat '+state.heat;
  field('score').textContent='Score '+state.score;
  field('planner').hidden=!active;button('start').hidden=active;
  button('start').textContent='NEW REHEARSAL';
  const last=state.history.at(-1);
  field('message').textContent=state.status==='BREACHED'?'Vault breached. Final score '+state.score+'.':state.status==='LOCKED'?'Vault locked. Four attempts used.':last?last.exact+' exact'+(last.misplaced===null?'':', '+last.misplaced+' misplaced')+'. Use your clues to plan the next move.':'Choose a code and route. Only an exact BREACH opens the vault.';
  field('history').replaceChildren(...state.history.map((r:{attempt:number,guess:readonly number[],route:string,exact:number,misplaced:number|null})=>{
   const item=document.createElement('li');item.textContent=r.attempt+' · '+r.guess.join(' ')+' · '+r.route+' · '+r.exact+' exact'+(r.misplaced===null?'':', '+r.misplaced+' misplaced');return item;
  }));
 }
 button('start').addEventListener('click',()=>{
  if(session?.view().status==='ACTIVE')return;
  const secret=Array.from(window.crypto.getRandomValues(new Uint8Array(5)),n=>n%4);
  const id='practice-'+window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  session=createNeutralPractice(id,secret);
  selects.forEach((s,i)=>s.value=String(i%4));field<HTMLSelectElement>('route').value='PROBE';render();selects[0].focus();
 });
 button('attempt').addEventListener('click',()=>{
  if(!session||session.view().status!=='ACTIVE')return;
  try{session.submit(selects.map(s=>Number(s.value)),field<HTMLSelectElement>('route').value);render();if(session.view().status!=='ACTIVE')button('start').focus();}
  catch{field('message').textContent='Attempt not accepted. Check the five glyphs and approach.';}
 });
}
