/***** NIVEL 3 — SYNC/BEAM (24 pasos), bucles fijos 6× y 4× *****/

const CONFIG = {
  targetSteps: 24,
  inventoryDefaults: { loops: 2, syncs: 4, beams: 4 },
  msPerStepDefault: 220,
  nextLevelUrl: 'intronivel4.html',
};

const T_LOOP='loop', T_SYNC='sync', T_BEAM='beam';

/* ===== Helpers ===== */
const $ =(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function msPerStep(){ const v=parseInt($('#speed')?.value||'',10); return Number.isNaN(v)?CONFIG.msPerStepDefault:Math.max(60,v); }
function showToast(msg, ok=false){
  const t=document.createElement('div'); t.className='toast'+(ok?' toast--success':''); t.textContent=msg;
  document.body.appendChild(t); requestAnimationFrame(()=>t.classList.add('is-visible'));
  setTimeout(()=>{ t.classList.remove('is-visible'); setTimeout(()=>t.remove(),220); }, 1600);
}
function setPanelToken(e, type, n){
  try{ e.dataTransfer.setData('text/plain', n?`panel:${type}:${n}`:`panel:${type}`); }catch{}
  e.dataTransfer.effectAllowed='copy';
}
function parseToken(str){
  const [from,type,maybeN] = String(str||'').split(':');
  return { from, type, n: maybeN?parseInt(maybeN,10):undefined };
}

/* ===== DOM ===== */
const wsEl   = $('#workspace');
const panelEl= $('#blocks-panel');
const boardEl= $('#board');

const runBtn   = $('#btn-run');
const clearBtn = $('#btn-clear');
const resetBtn = $('#btn-reset');

const countLoopsEl = $('#count-loops');
const countSyncEl  = $('#count-sync');
const countBeamEl  = $('#count-beam');
const planNowEl    = $('#plan-now');
const planTargetEl = $('#plan-target');
const targetXEl    = $('#targetX');

/* ===== Inventario ===== */
let inv = {
  loops: parseInt(countLoopsEl?.textContent||'',10),
  syncs: parseInt(countSyncEl ?.textContent||'',10),
  beams: parseInt(countBeamEl ?.textContent||'',10),
};
if (Number.isNaN(inv.loops)) inv.loops = CONFIG.inventoryDefaults.loops;
if (Number.isNaN(inv.syncs)) inv.syncs = CONFIG.inventoryDefaults.syncs;
if (Number.isNaN(inv.beams)) inv.beams = CONFIG.inventoryDefaults.beams;

/* ===== Tablero ===== */
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

/* ===== Programa (lectura y validación) ===== */
const loopDrop = (loopEl)=> loopEl.querySelector('.dropzone');
function rootLoops(){ return [...wsEl.children].filter(el=>el.dataset?.type===T_LOOP); }
function rootSingles(){ return $$('#workspace > .root-rail [data-type="sync"], #workspace > .root-rail [data-type="beam"]'); }

function flattenSequence(){
  const seq=[];
  rootSingles().forEach(a=> seq.push(a.dataset.type));
  rootLoops().forEach(loop=>{
    const reps = parseInt(loop.querySelector('.loop-n')?.textContent||'0',10) || 0;
    const inside = [...loopDrop(loop).querySelectorAll('[data-type="sync"],[data-type="beam"]')].map(n=>n.dataset.type);
    for(let i=0;i<reps;i++) seq.push(...inside);
  });
  return seq;
}
const countOf=(arr,t)=>arr.filter(x=>x===t).length;

function checkConstraints(){
  const errors=[];
  const loops=rootLoops();
  const seq=flattenSequence();

  if (loops.length!==2) errors.push(`Debés usar exactamente 2 ciclos (tenés ${loops.length}).`);
  const ns = loops.map(l=>parseInt(l.querySelector('.loop-n')?.textContent||'0',10)||0).sort((a,b)=>a-b);
  if (!(ns.length===2 && ns[0]===4 && ns[1]===6)) errors.push('Los ciclos deben ser exactamente uno de 6× y otro de 4×.');

  let empties=0; const contribs=[];
  loops.forEach(l=>{
    const reps = parseInt(l.querySelector('.loop-n')?.textContent||'0',10)||0;
    const insideEls = loopDrop(l)?.querySelectorAll('[data-type="sync"],[data-type="beam"]')||[];
    const inside = [...insideEls].map(n=>n.dataset.type);
    if (inside.length===0) empties++;
    if (!inside.includes(T_SYNC) || !inside.includes(T_BEAM)) errors.push('Cada ciclo debe incluir al menos 1 SYNC y 1 BEAM.');
    contribs.push(reps * inside.length);
  });
  if (empties>0) errors.push(`⚠ Hay ${empties} ciclo(s) vacío(s).`);
  if (contribs.length===2 && contribs[0]===contribs[1]) errors.push(`Los dos ciclos no pueden sumar lo mismo (ahora: ${contribs[0]} y ${contribs[1]}).`);

  if (rootSingles().length<1) errors.push('Necesitás al menos 1 acción fuera de los ciclos.');

  for (let i=1;i<seq.length;i++){
    if (seq[i]===seq[i-1]){ errors.push('La secuencia debe alternar SYNC/BEAM.'); break; }
  }
  const cS=countOf(seq,T_SYNC), cB=countOf(seq,T_BEAM);
  if (cS!==cB) errors.push(`Secuencia desbalanceada: SYNC=${cS} vs BEAM=${cB}.`);
  if (seq.length!==CONFIG.targetSteps) errors.push(`Total actual: ${seq.length}. El objetivo es ${CONFIG.targetSteps}.`);

  return { errors, seq };
}

/* ===== UI plan/stock ===== */
function refreshPlanAndRunButton(){
  const n=flattenSequence().length;
  planNowEl && (planNowEl.textContent = `${n}/${CONFIG.targetSteps}`);
  runBtn && (runBtn.disabled = (rootLoops().length===0 && rootSingles().length===0));
}
function refreshInventoryUI(){
  countLoopsEl && (countLoopsEl.textContent = String(inv.loops));
  countSyncEl && (countSyncEl.textContent = String(inv.syncs));
  countBeamEl && (countBeamEl.textContent = String(inv.beams));
  const noMoreLoops = inv.loops<=0 || rootLoops().length>=2;
  panelEl?.querySelectorAll('.block.loop').forEach(el=> el.classList.toggle('disabled', noMoreLoops));
  panelEl?.querySelector('.block.simple.sync')?.classList.toggle('disabled', inv.syncs<=0);
  panelEl?.querySelector('.block.simple.beam')?.classList.toggle('disabled', inv.beams<=0);
}

/* ===== Fábricas + drag de colocados ===== */
let dragEl = null;

function makeMiniButton(txt,title,cb){
  const b=document.createElement('button'); b.className='btn-mini btn-remove';
  b.type='button'; b.title=title; b.textContent=txt; b.addEventListener('click',cb); return b;
}
function makePlacedDraggable(el){
  if (el.dataset.movable) return;
  el.dataset.movable='1';
  el.setAttribute('draggable','true');
  el.addEventListener('dragstart', e=>{
    dragEl = el;
    const n = el.dataset.type===T_LOOP ? (el.dataset.n || '') : '';
    try{ e.dataTransfer.setData('text/plain', `ws:${el.dataset.type}:${n}`); }catch{}
    e.dataTransfer.effectAllowed='move';
  });
  el.addEventListener('dragend', ()=>{ dragEl=null; });
}

function createSimple(type,labelClass,text){
  const item=document.createElement('div');
  item.className=`block simple ${labelClass} placed`; item.dataset.type=type;
  const label=document.createElement('span'); label.className='label'; label.textContent=text;
  const ctrl=document.createElement('div'); ctrl.className='controls';
  ctrl.append(makeMiniButton('✖','Eliminar',()=>{ item.remove();
    if (type===T_SYNC) inv.syncs++; else inv.beams++;
    refreshInventoryUI(); refreshPlanAndRunButton();
  }));
  item.append(label,ctrl);
  makePlacedDraggable(item);
  return item;
}
const createSyncBlock = ()=> createSimple(T_SYNC,'sync','SYNC');
const createBeamBlock = ()=> createSimple(T_BEAM,'beam','BEAM');

function createLoopBlock(fixedN){
  const loop=document.createElement('div'); loop.className='block loop placed'; loop.dataset.type=T_LOOP;
  loop.dataset.n = String(fixedN); // 🔧 conservar N del bucle

  const head=document.createElement('div'); head.className='loop-head';
  const nEl=document.createElement('span'); nEl.className='loop-n'; nEl.textContent=String(fixedN);
  head.append('Repetir ', nEl, '×');

  const dz=document.createElement('div'); dz.className='dropzone';
  wireDropzone(dz,false); // interna

  const btnX=makeMiniButton('✖','Eliminar ciclo',()=>{
    dz.querySelectorAll('[data-type="sync"]').forEach(()=>inv.syncs++);
    dz.querySelectorAll('[data-type="beam"]').forEach(()=>inv.beams++);
    loop.remove(); inv.loops++; refreshInventoryUI(); refreshPlanAndRunButton();
  });

  loop.append(head,dz,btnX);
  makePlacedDraggable(loop);
  return loop;
}

/* ===== Rieles en root ===== */
function ensureRootRails(){
  if (!wsEl) return;
  if (!wsEl.querySelector('.root-rail[data-rail="top"]')){
    const top=document.createElement('div'); top.className='dropzone root-rail'; top.dataset.rail='top';
    top.innerHTML='<div class="rail-hint">Soltá SYNC/BEAM sueltos aquí</div>';
    wsEl.insertBefore(top, wsEl.firstChild); wireDropzone(top,true);
  }
  if (!wsEl.querySelector('.root-rail[data-rail="bottom"]')){
    const bot=document.createElement('div'); bot.className='dropzone root-rail'; bot.dataset.rail='bottom';
    bot.innerHTML='<div class="rail-hint">…o acá abajo</div>';
    wsEl.appendChild(bot); wireDropzone(bot,true);
  }
}

/* ===== DnD: panel ===== */
function wirePanel(){
  if (!panelEl) return;
  panelEl.querySelectorAll('.block[draggable="true"]').forEach(b=>{
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('dragstart', (e)=>{
      const el = e.currentTarget;
      const type = el.dataset.type;
      if ([T_LOOP,T_SYNC,T_BEAM].indexOf(type)<0){ e.preventDefault(); return; }

      if (type===T_LOOP){
        if (inv.loops<=0 || rootLoops().length>=2){ e.preventDefault(); return; }
        const n = parseInt(el.getAttribute('data-n'),10);
        if (n!==6 && n!==4){ e.preventDefault(); return; }
        setPanelToken(e, T_LOOP, n);
      } else if (type===T_SYNC){
        if (inv.syncs<=0){ e.preventDefault(); return; }
        setPanelToken(e, T_SYNC);
      } else if (type===T_BEAM){
        if (inv.beams<=0){ e.preventDefault(); return; }
        setPanelToken(e, T_BEAM);
      }
    });
  });
}
wirePanel();

/* ===== DnD: dropzones (rieles + internas) ===== */
function wireDropzone(dz, isRail){
  if (!dz || dz.dataset.wired) return; dz.dataset.wired='1';

  dz.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); dz.classList.add('is-hover'); });
  dz.addEventListener('dragleave', ()=> dz.classList.remove('is-hover'));
  dz.addEventListener('dragenter', ()=>{ try{ dz.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});}catch{} });

  dz.addEventListener('drop', e=>{
    e.preventDefault(); e.stopPropagation(); dz.classList.remove('is-hover');

    const tok = parseToken(e.dataTransfer.getData('text/plain'));
    const { from, type, n } = tok;

    // mover ya colocado (desde workspace)
    if (from==='ws' && dragEl){
      if (isRail){
        if (dragEl.dataset.type===T_LOOP){
          const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
          wsEl.insertBefore(dragEl, railBottom);
        } else {
          dz.appendChild(dragEl);
        }
      } else {
        if (dragEl.dataset.type===T_SYNC || dragEl.dataset.type===T_BEAM) dz.appendChild(dragEl);
      }
      dragEl=null; refreshPlanAndRunButton(); return;
    }

    // crear desde panel
    if (from!=='panel') return;

    if (type===T_LOOP){
      if (!isRail) return; // los loops no van dentro de dropzones internas
      if (inv.loops<=0 || rootLoops().length>=2) return;
      if (n!==6 && n!==4) return;
      const loop = createLoopBlock(n);
      const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
      wsEl.insertBefore(loop, railBottom);
      inv.loops--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }

    if (type===T_SYNC && inv.syncs>0){
      dz.appendChild(createSyncBlock()); inv.syncs--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }
    if (type===T_BEAM && inv.beams>0){
      dz.appendChild(createBeamBlock()); inv.beams--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }
  });
}

/* ===== Workspace (fallback al soltar “al vacío”) ===== */
wsEl.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); });
wsEl.addEventListener('drop', e=>{
  e.preventDefault(); e.stopPropagation();
  const tok = parseToken(e.dataTransfer.getData('text/plain'));
  const { from, type, n } = tok;

  if (from==='ws' && dragEl){
    if (dragEl.dataset.type===T_LOOP){
      const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
      wsEl.insertBefore(dragEl, railBottom);
    } else {
      const railTop = wsEl.querySelector('.root-rail[data-rail="top"]');
      (railTop || wsEl).appendChild(dragEl);
    }
    dragEl=null; refreshPlanAndRunButton(); return;
  }

  if (from==='panel'){
    if (type===T_LOOP){
      if (inv.loops<=0 || rootLoops().length>=2) return;
      if (n!==6 && n!==4) return;
      const loop=createLoopBlock(n);
      const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
      wsEl.insertBefore(loop, railBottom);
      inv.loops--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }
    if (type===T_SYNC){
      if (inv.syncs<=0) return;
      const railTop = wsEl.querySelector('.root-rail[data-rail="top"]');
      (railTop || wsEl).appendChild(createSyncBlock());
      inv.syncs--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }
    if (type===T_BEAM){
      if (inv.beams<=0) return;
      const railTop = wsEl.querySelector('.root-rail[data-rail="top"]');
      (railTop || wsEl).appendChild(createBeamBlock());
      inv.beams--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
    }
  }
});

/* ===== Simulación ===== */
function simulateSequence(seq){
  return new Promise(async (resolve)=>{
    const {satA,satB,wave,progress}=ensureBoard();
    const stepMs=msPerStep(); if (progress) progress.style.width='0%';
    for (let i=0;i<seq.length;i++){
      if (seq[i]===T_SYNC){
        satA?.classList.add('synced'); satB?.classList.add('synced');
        setTimeout(()=>{ satA?.classList.remove('synced'); satB?.classList.remove('synced'); }, Math.min(220,stepMs));
      } else {
        wave?.classList.remove('beam'); void wave?.offsetWidth; wave?.classList.add('beam');
      }
      if (progress) progress.style.width=`${Math.round(((i+1)/seq.length)*100)}%`;
      await sleep(stepMs);
    }
    resolve();
  });
}

/* ===== Botones ===== */
let running=false;
async function runProgram(){
  if (running) return; running=true; runBtn && (runBtn.disabled=true);
  const {errors, seq}=checkConstraints();
  if (seq.length>0) await simulateSequence(seq);
  if (errors.length){
    alert('🛰️ Error de patrón\n\n• '+errors.join('\n• '));
  } else {
    showToast('🏆 ¡Satélites sincronizados! Los gatitos llegan en 4K.', true);
    try{ localStorage.setItem('nivel3Complete','true'); }catch{}
    if (CONFIG.nextLevelUrl) setTimeout(()=>location.assign(CONFIG.nextLevelUrl),500);
  }
  running=false; runBtn && (runBtn.disabled=false);
}
runBtn?.addEventListener('click', runProgram);

clearBtn?.addEventListener('click', ()=>{
  $$('#workspace [data-type="sync"]').forEach(()=>inv.syncs++);
  $$('#workspace [data-type="beam"]').forEach(()=>inv.beams++);
  $$('#workspace .block.placed').forEach(el=>el.remove());
  inv.loops = CONFIG.inventoryDefaults.loops;
  refreshInventoryUI(); refreshPlanAndRunButton();
  const {progress}=ensureBoard(); if (progress) progress.style.width='0%';
});
resetBtn?.addEventListener('click', ()=>{
  $$('#workspace .block.placed').forEach(el=>el.remove());
  inv = { ...CONFIG.inventoryDefaults };
  refreshInventoryUI(); refreshPlanAndRunButton();
  const {progress}=ensureBoard(); if (progress) progress.style.width='0%';
});

/* ===== INIT ===== */
(function init(){
  targetXEl    && (targetXEl.textContent    = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  ensureRootRails(); ensureBoard(); refreshInventoryUI(); refreshPlanAndRunButton();
  wirePanel();
  console.log('[nivel3] ready');
})();

/* ===== AUTOSCROLL EN DRAG (viewport + contenedores) ===== */
(() => {
  const MARGIN = 80;      // px desde el borde de la ventana para empezar a auto-scrollear
  const SPEED  = 20;      // px por tick
  const ZONE_MARGIN = 40; // margen dentro del workspace/panel para auto-scroll interno
  let rafId = null;

  function scrollViewportIfNeeded(e){
    const doc = document.scrollingElement || document.documentElement;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = e.clientX, y = e.clientY;

    if (y < MARGIN)                doc.scrollTop  -= SPEED;
    else if (y > vh - MARGIN)      doc.scrollTop  += SPEED;

    if (x < MARGIN)                doc.scrollLeft -= SPEED;
    else if (x > vw - MARGIN)      doc.scrollLeft += SPEED;
  }

  function scrollContainerIfNeeded(container, e){
    if (!container) return;
    const r = container.getBoundingClientRect();
    const y = e.clientY, x = e.clientX;

    if (y < r.top + ZONE_MARGIN)            container.scrollTop  -= SPEED;
    else if (y > r.bottom - ZONE_MARGIN)    container.scrollTop  += SPEED;

    if (x < r.left + ZONE_MARGIN)           container.scrollLeft -= SPEED;
    else if (x > r.right - ZONE_MARGIN)     container.scrollLeft += SPEED;
  }

  function onGlobalDragOver(e){
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      scrollViewportIfNeeded(e);
      scrollContainerIfNeeded(document.getElementById('workspace'), e);
      scrollContainerIfNeeded(document.getElementById('blocks-panel'), e);
    });
  }

  function stopAutoScroll(){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  document.addEventListener('dragover', onGlobalDragOver, { passive: true });
  document.addEventListener('drop',      stopAutoScroll,   { passive: true });
  document.addEventListener('dragend',   stopAutoScroll,   { passive: true });
})();
