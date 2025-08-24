/***** NIVEL 3 — SYNC/BEAM (24 pasos), DnD robusto, alternancia y balance, validación por aporte, board de satélites *****/

/* ---------------- CONFIG ---------------- */
const CONFIG = {
  targetSteps: 24,
  // Pocas acciones sueltas para “forzar” usar ciclos
  inventoryDefaults: { loops: 2, syncs: 4, beams: 4 },
  msPerStepDefault: 220,
  nextLevelUrl: '/nivel4.html' // opcional
};

/* -------------- Helpers UI -------------- */
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function showToast(msg, type='info', ms=1800){
  const t = document.createElement('div');
  t.className = 'toast '+(type==='success'?'toast--success':'');
  t.textContent = msg; document.body.appendChild(t);
  requestAnimationFrame(()=> t.classList.add('is-visible'));
  setTimeout(()=>{ t.classList.remove('is-visible'); setTimeout(()=>t.remove(),220); }, ms);
}
const absurdos = [
  "🛰️ El satélite se puso a mirar su propia antena. No hay gatos para nadie.",
  "🛰️ El operador dijo «sync» y el satélite entendió «siesta».",
  "🛰️ Tu coreografía orbital activó el Modo Gato Invisible.",
  "🛰️ La Tierra pidió replay… pero no hay señal. 🐱❌"
];

/* ---------------- DOM ---------------- */
const wsEl = document.getElementById('workspace');
const runBtn = document.getElementById('btn-run');
const clearBtn = document.getElementById('btn-clear');
const resetBtn = document.getElementById('btn-reset');
const speedInput = document.getElementById('speed');

const countSyncEl = document.getElementById('count-sync');
const countBeamEl = document.getElementById('count-beam');
const countLoopsEl = document.getElementById('count-loops');
const planNowEl = document.getElementById('plan-now');
const planTargetEl = document.getElementById('plan-target');
const targetXEl = document.getElementById('targetX');

const panelEl = document.getElementById('blocks-panel');
const boardEl = document.getElementById('board');

/* -------------- Inventario -------------- */
let inv = {
  loops: parseInt(countLoopsEl?.textContent || '', 10),
  syncs: parseInt(countSyncEl?.textContent || '', 10),
  beams: parseInt(countBeamEl?.textContent || '', 10),
};
if (Number.isNaN(inv.loops)) inv.loops = CONFIG.inventoryDefaults.loops;
if (Number.isNaN(inv.syncs)) inv.syncs = CONFIG.inventoryDefaults.syncs;
if (Number.isNaN(inv.beams)) inv.beams = CONFIG.inventoryDefaults.beams;

/* -------------- Board (satélites) -------------- */
function ensureBoard(){
  if (!boardEl) return null;
  if (!boardEl.querySelector('.constellation')){
    boardEl.innerHTML = `
      <div class="sky"></div>
      <div class="constellation">
        <div class="sats">
          <div class="sat a">🛰️</div>
          <div class="sat b">🛰️</div>
          <div class="wave"></div>
        </div>
        <div class="timeline"><div class="progress"></div></div>
      </div>`;
  }
  return {
    satA: boardEl.querySelector('.sat.a'),
    satB: boardEl.querySelector('.sat.b'),
    wave: boardEl.querySelector('.wave'),
    progress: boardEl.querySelector('.progress')
  };
}
ensureBoard();

function msPerStep(){
  const v=parseInt(speedInput?.value||'',10);
  return Number.isNaN(v) ? CONFIG.msPerStepDefault : Math.max(60,v);
}

/* -------------- Tipos y helpers de programa -------------- */
const T_LOOP='loop', T_SYNC='sync', T_BEAM='beam';

const rootChildren = ()=>[...wsEl.children];
const rootLoops = ()=>rootChildren().filter(el => (el.dataset?.type||'')===T_LOOP);
const rootActions = ()=>[...wsEl.querySelectorAll('[data-type="sync"],[data-type="beam"]')].filter(el=>!el.closest('.block.loop'));
const loopDrop = (loopEl)=> loopEl.querySelector('.dropzone');

function flattenProgram(){
  const out = [];
  rootActions().forEach(a=> out.push(a.dataset.type));
  rootLoops().forEach(loop=>{
    const reps = parseInt(loop.querySelector('.loop-n')?.textContent||'0',10) || 0;
    const inside = [...loopDrop(loop).querySelectorAll('[data-type="sync"],[data-type="beam"]')].map(n=>n.dataset.type);
    for(let i=0;i<reps;i++) out.push(...inside);
  });
  return out;
}
const countOf = (arr,t) => arr.filter(x=>x===t).length;

/* -------------- Validaciones -------------- */
function checkConstraints(){
  const errors = [];
  const loops = rootLoops();
  const seq = flattenProgram();

  // 2 loops exactos
  if (loops.length !== 2) errors.push(`Debés usar exactamente 2 ciclos (tenés ${loops.length}).`);

  // Cada loop debe tener SYNC y BEAM dentro
  let empties=0;
  const contribs=[];
  loops.forEach(l=>{
    const reps=parseInt(l.querySelector('.loop-n')?.textContent||'0',10)||0;
    const insideEls = loopDrop(l)?.querySelectorAll('[data-type="sync"],[data-type="beam"]') || [];
    const inside = [...insideEls].map(n=>n.dataset.type);
    if (inside.length===0) empties++;
    if (!inside.includes(T_SYNC) || !inside.includes(T_BEAM)){
      errors.push('Cada ciclo debe incluir al menos 1 SYNC y 1 BEAM.');
    }
    contribs.push(reps * inside.length);
  });
  if (empties>0) errors.push(`⚠ Hay ${empties} ciclo(s) vacío(s).`);

  // Aportes distintos
  if (contribs.length===2 && contribs[0]===contribs[1]){
    errors.push(`Los dos ciclos no pueden sumar lo mismo (ahora: ${contribs[0]} y ${contribs[1]}).`);
  }

  // Al menos 1 acción fuera de ciclos
  if (rootActions().length < 1) errors.push('Necesitás al menos 1 acción fuera de los ciclos.');

  // Alternancia
  for(let i=1;i<seq.length;i++){
    if (seq[i]===seq[i-1]){
      errors.push('La secuencia debe alternar SYNC/BEAM (no repitas dos iguales seguidas).');
      break;
    }
  }

  // Balance
  if (countOf(seq,T_SYNC) !== countOf(seq,T_BEAM)){
    errors.push(`Secuencia desbalanceada: SYNC=${countOf(seq,T_SYNC)} vs BEAM=${countOf(seq,T_BEAM)}.`);
  }

  // Total
  if (seq.length !== CONFIG.targetSteps){
    errors.push(`Total actual: ${seq.length}. El objetivo es ${CONFIG.targetSteps}.`);
  }

  return { errors, seq, contribs };
}

/* -------------- UI plan & stock -------------- */
function refreshPlanAndRunButton(){
  const n = flattenProgram().length;
  planNowEl && (planNowEl.textContent = `${n}/${CONFIG.targetSteps}`);
  const hasSomething = rootLoops().length>0 || rootActions().length>0;
  runBtn && (runBtn.disabled = !hasSomething);
}
function refreshInventoryUI(){
  countLoopsEl && (countLoopsEl.textContent = String(inv.loops));
  countSyncEl && (countSyncEl.textContent = String(inv.syncs));
  countBeamEl && (countBeamEl.textContent = String(inv.beams));
  panelEl?.querySelector('.block.loop')?.classList.toggle('disabled', inv.loops<=0 || rootLoops().length>=2);
  panelEl?.querySelector('.block.simple.sync')?.classList.toggle('disabled', inv.syncs<=0);
  panelEl?.querySelector('.block.simple.beam')?.classList.toggle('disabled', inv.beams<=0);
}

/* -------------- Crear bloques -------------- */
function miniButton(txt,title,cb){
  const b=document.createElement('button'); b.className='btn-mini btn-remove';
  b.type='button'; b.title=title; b.textContent=txt; b.addEventListener('click',cb); return b;
}
function createSimple(type,labelClass,text){
  const item=document.createElement('div');
  item.className=`block simple ${labelClass} placed`; item.dataset.type=type;
  const label=document.createElement('span'); label.className='label'; label.textContent=text;
  const ctrl=document.createElement('div'); ctrl.className='controls';
  ctrl.append(miniButton('✖','Eliminar',()=>{ item.remove();
    if (type===T_SYNC) inv.syncs++; else inv.beams++;
    refreshInventoryUI(); refreshPlanAndRunButton();
  }));
  item.append(label,ctrl); return item;
}
const createSyncBlock = ()=> createSimple(T_SYNC,'sync','SYNC');
const createBeamBlock = ()=> createSimple(T_BEAM,'beam','BEAM');

function createLoopBlock(){
  const loop=document.createElement('div'); loop.className='block loop placed'; loop.dataset.type=T_LOOP;
  const head=document.createElement('div'); head.className='loop-head';
  head.append('Repetir ');
  const nEl=document.createElement('span'); nEl.className='loop-n'; nEl.textContent='3'; nEl.title='Click para cambiar (1–20)';
  head.append(nEl,'×');
  head.addEventListener('click',e=>{
    const t=e.target.closest('.loop-n'); if(!t) return;
    const val=parseInt(prompt('Repeticiones (1–20):',t.textContent)||t.textContent,10);
    const nn=Math.min(20,Math.max(1,isNaN(val)?1:val)); t.textContent=String(nn); refreshPlanAndRunButton();
  });
  const dz=document.createElement('div'); dz.className='dropzone';
  wireInnerDropzone(dz); wireLoopContainer(loop);
  const btnX=miniButton('✖','Eliminar ciclo',()=>{
    const inside=dz.querySelectorAll('[data-type="sync"],[data-type="beam"]').length;
    // devolvemos unidades según tipos
    dz.querySelectorAll('[data-type="sync"]').forEach(()=>inv.syncs++);
    dz.querySelectorAll('[data-type="beam"]').forEach(()=>inv.beams++);
    loop.remove(); inv.loops++; refreshInventoryUI(); refreshPlanAndRunButton();
  });
  loop.append(head,dz,btnX); return loop;
}

/* -------------- Rieles root (suelto) -------------- */
function ensureRootRails(){
  if(!wsEl) return;
  if(!wsEl.querySelector('.root-rail[data-rail="top"]')){
    const top=document.createElement('div'); top.className='dropzone root-rail'; top.dataset.rail='top';
    top.innerHTML='<div class="rail-hint">Soltá SYNC/BEAM sueltos aquí</div>'; wsEl.insertBefore(top,wsEl.firstChild);
    wireRootRail(top);
  }
  if(!wsEl.querySelector('.root-rail[data-rail="bottom"]')){
    const bot=document.createElement('div'); bot.className='dropzone root-rail'; bot.dataset.rail='bottom';
    bot.innerHTML='<div class="rail-hint">…o acá abajo</div>'; wsEl.appendChild(bot); wireRootRail(bot);
  }
}
function wireRootRail(rail){
  if(!rail || rail.dataset.wired) return; rail.dataset.wired='1';
  rail.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  rail.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();
    let p={}; try{p=JSON.parse(e.dataTransfer.getData('application/json')||'{}');}catch{}
    const {from,type}=p||{}; if(from!=='panel') return;
    if(type===T_SYNC && inv.syncs>0){ rail.appendChild(createSyncBlock()); inv.syncs--; }
    else if(type===T_BEAM && inv.beams>0){ rail.appendChild(createBeamBlock()); inv.beams--; }
    refreshInventoryUI(); refreshPlanAndRunButton();
  });
}

/* -------------- Drag & Drop -------------- */
function setPayload(e,obj){
  try{e.dataTransfer.setData('application/json',JSON.stringify(obj));}catch{}
  try{e.dataTransfer.setData('text/plain',obj.type||'');}catch{}
}
function wirePanelDrag(){
  if(!panelEl) return;
  panelEl.querySelectorAll('.block[draggable="true"]').forEach(b=>{
    if(b.dataset.wired) return; b.dataset.wired='1';
    b.addEventListener('dragstart',e=>{
      const type=(b.dataset.type||''); 
      if([T_LOOP,T_SYNC,T_BEAM].indexOf(type)<0){ e.preventDefault(); return; }
      if(type===T_LOOP && inv.loops<=0){ e.preventDefault(); return; }
      if(type===T_SYNC && inv.syncs<=0){ e.preventDefault(); return; }
      if(type===T_BEAM && inv.beams<=0){ e.preventDefault(); return; }
      setPayload(e,{from:'panel',type}); e.dataTransfer.effectAllowed='copy';
    });
  });
}
wirePanelDrag();

function isInnerZone(target){ const dz=target.closest('.dropzone'); return !!dz && !dz.classList.contains('root-drop'); }
function beforeRailBottomOrEnd(node){
  const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
  if (railBottom) wsEl.insertBefore(node, railBottom); else wsEl.appendChild(node);
}

wsEl.addEventListener('dragover',e=>{ if(isInnerZone(e.target)) return; e.preventDefault(); e.stopPropagation(); });
wsEl.addEventListener('drop',e=>{
  if(isInnerZone(e.target)) return; e.preventDefault(); e.stopPropagation();
  let p={}; try{p=JSON.parse(e.dataTransfer.getData('application/json')||'{}');}catch{}
  const {from,type}=p||{}; if(from!=='panel') return;

  if(type===T_LOOP){
    if(inv.loops<=0 || rootLoops().length>=2) return;
    const loop=createLoopBlock();
    const overLoop=e.target.closest('.block.loop');
    if(overLoop){
      const r=overLoop.getBoundingClientRect(); const after=(e.clientY>r.top+r.height/2);
      wsEl.insertBefore(loop, after?overLoop.nextSibling:overLoop);
    }else beforeRailBottomOrEnd(loop);
    inv.loops--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
  }
  if(type===T_SYNC && inv.syncs>0){
    beforeRailBottomOrEnd(createSyncBlock()); inv.syncs--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
  }
  if(type===T_BEAM && inv.beams>0){
    beforeRailBottomOrEnd(createBeamBlock()); inv.beams--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
  }
});

function wireInnerDropzone(dz){
  if(!dz || dz.dataset.wired) return; dz.dataset.wired='1';
  dz.addEventListener('dragover',e=>{ e.preventDefault(); e.stopPropagation(); });
  dz.addEventListener('drop',e=>{
    e.preventDefault(); e.stopPropagation();
    let p={}; try{p=JSON.parse(e.dataTransfer.getData('application/json')||'{}');}catch{}
    const {from,type}=p||{}; if(from!=='panel') return;
    if(type===T_SYNC && inv.syncs>0){ dz.appendChild(createSyncBlock()); inv.syncs--; }
    else if(type===T_BEAM && inv.beams>0){ dz.appendChild(createBeamBlock()); inv.beams--; }
    refreshInventoryUI(); refreshPlanAndRunButton();
  });
}
function wireLoopContainer(loop){
  if(!loop || loop.dataset.loopWired) return; loop.dataset.loopWired='1';
  loop.addEventListener('dragover',e=>{ e.preventDefault(); });
  loop.addEventListener('drop',e=>{
    let p={}; try{p=JSON.parse(e.dataTransfer.getData('application/json')||'{}');}catch{}
    const {from,type}=p||{}; if(from!=='panel') return;
    e.preventDefault(); e.stopPropagation();
    const dz=loopDrop(loop); if(!dz) return;
    if(type===T_SYNC && inv.syncs>0){ dz.appendChild(createSyncBlock()); inv.syncs--; }
    else if(type===T_BEAM && inv.beams>0){ dz.appendChild(createBeamBlock()); inv.beams--; }
    refreshInventoryUI(); refreshPlanAndRunButton();
  });
}
wsEl.querySelectorAll('.block.loop').forEach(loop=>{ wireInnerDropzone(loopDrop(loop)); wireLoopContainer(loop); });

/* -------------- Simulación -------------- */
function simulateSequence(seq){
  return new Promise(async (resolve)=>{
    const {satA,satB,wave,progress} = ensureBoard();
    const stepMs = msPerStep();
    progress.style.width = '0%';
    for(let i=0;i<seq.length;i++){
      const t = seq[i];
      // feedback visual
      if (t===T_SYNC){
        satA.classList.add('synced'); satB.classList.add('synced');
        setTimeout(()=>{satA.classList.remove('synced'); satB.classList.remove('synced');}, Math.min(220,stepMs));
      } else { // BEAM
        wave.classList.remove('beam'); // reinicia anim
        // force reflow
        void wave.offsetWidth;
        wave.classList.add('beam');
      }
      progress.style.width = `${Math.round(((i+1)/seq.length)*100)}%`;
      await sleep(stepMs);
    }
    resolve();
  });
}

/* -------------- RUN -------------- */
let running=false;
async function runProgram(){
  if(running) return; running=true; runBtn && (runBtn.disabled=true);

  const {errors, seq} = checkConstraints();

  // simulá lo que haya (aunque esté mal) para feedback inmediato
  if (seq.length>0) await simulateSequence(seq);

  if (errors.length){
    alert(`${absurdos[Math.floor(Math.random()*absurdos.length)]}\n\n• ${errors.join('\n• ')}`);
  }else{
    showToast('🏆 ¡Satélites sincronizados! Los gatitos llegan en 4K.', 'success', 1700);
    try{ localStorage.setItem('nivel3Complete','true'); }catch{}
    if (CONFIG.nextLevelUrl) setTimeout(()=> window.location.assign(CONFIG.nextLevelUrl), 500);
  }

  running=false; runBtn && (runBtn.disabled=false);
}

/* -------------- Botonera -------------- */
runBtn?.addEventListener('click', runProgram);
clearBtn?.addEventListener('click', ()=>{
  rootActions().forEach(a=>{
    if (a.dataset.type===T_SYNC) inv.syncs++; else inv.beams++;
    a.remove();
  });
  rootLoops().forEach(loop=>{
    loop.querySelectorAll('[data-type="sync"]').forEach(()=>inv.syncs++);
    loop.querySelectorAll('[data-type="beam"]').forEach(()=>inv.beams++);
    loop.remove(); inv.loops++;
  });
  refreshInventoryUI(); refreshPlanAndRunButton();
  const {progress} = ensureBoard(); if (progress) progress.style.width='0%';
});
resetBtn?.addEventListener('click', ()=>{
  rootActions().forEach(a=>a.remove());
  rootLoops().forEach(loop=>loop.remove());
  inv = { ...CONFIG.inventoryDefaults };
  refreshInventoryUI(); refreshPlanAndRunButton();
  const {progress} = ensureBoard(); if (progress) progress.style.width='0%';
});

/* -------------- INIT -------------- */
(function init(){
  targetXEl && (targetXEl.textContent = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  ensureBoard(); ensureRootRails(); refreshInventoryUI(); refreshPlanAndRunButton();
})();
