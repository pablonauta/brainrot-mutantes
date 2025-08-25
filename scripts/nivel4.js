/***** NIVEL 4 — Brain Rot: bucles {3,4} + patrón interno de 3 acciones *****/

/* ================== CONFIG ================== */
const CONFIG = {
  targetSteps: 36,                 // 3 × 4 × (ANTIROT + SELLAR + FOCO)
  msPerStepDefault: 220,
  nextLevelUrl: '/paginas/final.html',
  allowedLoopSizes: [3, 4],
};

/* ================== DOM ================== */
const wsEl         = document.getElementById('workspace');
const panelEl      = document.getElementById('blocks-panel');
const boardEl      = document.getElementById('board');

const runBtn       = document.getElementById('btn-run');
const clearBtn     = document.getElementById('btn-clear');
const resetBtn     = document.getElementById('btn-reset');
const speedInput   = document.getElementById('speed');

const countLoopsEl = document.getElementById('count-loops');
const countAntiEl  = document.getElementById('count-antirot');
const countSealEl  = document.getElementById('count-seal');
const countFocusEl = document.getElementById('count-focus');

const planNowEl    = document.getElementById('plan-now');
const planTargetEl = document.getElementById('plan-target');
const targetXEl    = document.getElementById('targetX');

/* ================== INVENTARIO ================== */
const INIT_INV = {
  loops: parseInt(countLoopsEl?.textContent || '2', 10) || 2,
  anti:  parseInt(countAntiEl ?.textContent || '1', 10) || 1,
  seal:  parseInt(countSealEl ?.textContent || '1', 10) || 1,
  focus: parseInt(countFocusEl?.textContent || '1', 10) || 1,
};
let inv = { ...INIT_INV };

/* ================== HELPERS UI ================== */
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
function msPerStep(){
  const v = parseInt(speedInput?.value || '', 10);
  return Number.isNaN(v) ? CONFIG.msPerStepDefault : Math.max(60, v);
}
function showToast(msg, ok=false){
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' toast--success' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=> t.classList.add('is-visible'));
  setTimeout(()=>{ t.classList.remove('is-visible'); setTimeout(()=>t.remove(), 180); }, 1500);
}

/* ================== TABLERO (grilla 3×4) ================== */
function cellEl(r, c){
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}
function ensureBoard(){
  if (!boardEl) return;
  boardEl.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (let r=0; r<3; r++){
    for (let c=0; c<4; c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.textContent = '🛰️';
      cell.appendChild(icon);
      grid.appendChild(cell);
    }
  }
  boardEl.appendChild(grid);
}
window.addEventListener('resize', ensureBoard);

/* ================== PROGRAMA ================== */
const T_LOOP='loop', T_ANTI='antirot', T_SEAL='seal', T_FOCUS='focus';

function refreshInventory(){
  countLoopsEl && (countLoopsEl.textContent = String(inv.loops));
  countAntiEl  && (countAntiEl .textContent = String(inv.anti));
  countSealEl  && (countSealEl .textContent = String(inv.seal));
  countFocusEl && (countFocusEl.textContent = String(inv.focus));

  panelEl?.querySelector('[data-type="loop"][data-n="3"]')?.classList.toggle('disabled', inv.loops <= 0);
  panelEl?.querySelector('[data-type="loop"][data-n="4"]')?.classList.toggle('disabled', inv.loops <= 0);
  panelEl?.querySelector('[data-type="antirot"]')?.classList.toggle('disabled', inv.anti  <= 0);
  panelEl?.querySelector('[data-type="seal"]')?.classList.toggle('disabled', inv.seal  <= 0);
  panelEl?.querySelector('[data-type="focus"]')?.classList.toggle('disabled', inv.focus <= 0);
}

function makeMiniX(onClick){
  const b = document.createElement('button');
  b.className = 'btn-mini btn-remove';
  b.textContent = '✖';
  b.title = 'Eliminar';
  b.addEventListener('click', onClick);
  return b;
}

/* ====== DnD para bloques ya colocados ====== */
let draggingEl = null;
function makePlacedDraggable(el){
  if (!el || el.dataset.movable) return;
  el.dataset.movable = '1';
  el.setAttribute('draggable', 'true');
  if (!el.id) el.id = 'blk-' + Math.random().toString(36).slice(2);
  el.addEventListener('dragstart', (e)=>{
    draggingEl = el;
    setPayload(e, { from:'ws', type: el.dataset.type, id: el.id });
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', ()=>{ draggingEl = null; });
}

/* ====== Fábricas ====== */
function createSimple(type, labelText, cls){
  const el = document.createElement('div');
  el.className = `block simple ${cls} placed`;
  el.dataset.type = type;

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = labelText;

  const ctrl = document.createElement('div');
  ctrl.className = 'controls';
  ctrl.appendChild(makeMiniX(()=>{
    el.remove();
    if (type === T_ANTI)  inv.anti++;
    if (type === T_SEAL)  inv.seal++;
    if (type === T_FOCUS) inv.focus++;
    refreshInventory(); refreshPlan();
  }));

  el.append(label, ctrl);
  makePlacedDraggable(el);
  return el;
}
const createAnti  = ()=> createSimple(T_ANTI,  'ANTIROT', 'antirot');
const createSeal  = ()=> createSimple(T_SEAL,  'SELLAR',  'seal');
const createFocus = ()=> createSimple(T_FOCUS, 'FOCO',    'focus');

/* Loop con tamaño fijo dado (3 o 4) */
function createLoop(fixedN){
  const loop = document.createElement('div');
  loop.className = 'block loop placed';
  loop.dataset.type = T_LOOP;
  loop.dataset.n = String(fixedN);

  const head = document.createElement('div');
  head.className = 'loop-head';
  head.innerHTML = `Repetir <span class="loop-n" aria-label="repeticiones">${fixedN}</span>×`;

  const dz = document.createElement('div');
  dz.className = 'dropzone';
  wireDropzone(dz);

  const btnX = makeMiniX(()=>{
    dz.querySelectorAll('[data-type="antirot"]').forEach(()=> inv.anti++);
    dz.querySelectorAll('[data-type="seal"]').forEach(()=> inv.seal++);
    dz.querySelectorAll('[data-type="focus"]').forEach(()=> inv.focus++);
    dz.querySelectorAll('[data-type="loop"]').forEach(()=> inv.loops++);
    loop.remove(); inv.loops++; refreshInventory(); refreshPlan();
  });

  loop.append(head, dz, btnX);
  makePlacedDraggable(loop);
  return loop;
}

/* ========== DnD (panel y workspace) ========== */
function setPayload(e, obj){
  try { e.dataTransfer.setData('application/json', JSON.stringify(obj)); } catch {}
  try { e.dataTransfer.setData('text/plain', obj.type || ''); } catch {}
}
function wirePanel(){
  if (!panelEl) return;
  panelEl.querySelectorAll('.block[data-type]').forEach(b=>{
    if (!b.getAttribute('draggable')) b.setAttribute('draggable', 'true');
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('dragstart', (e)=>{
      const type = b.dataset.type;
      if (type === T_LOOP  && inv.loops <= 0) { e.preventDefault(); return; }
      if (type === T_ANTI  && inv.anti  <= 0) { e.preventDefault(); return; }
      if (type === T_SEAL  && inv.seal  <= 0) { e.preventDefault(); return; }
      if (type === T_FOCUS && inv.focus <= 0) { e.preventDefault(); return; }
      const loopN = b.dataset.n ? parseInt(b.dataset.n,10) : 3;
      setPayload(e, { from:'panel', type, loopN });
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}

/* ====== Target amplio: acepta drop sobre loop-box o workspace ====== */
function resolveDropTargetFromPoint(x, y){
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  // 1) Si es una dropzone, listo
  const dz = el.closest?.('.dropzone');
  if (dz) return dz;

  // 2) Si soltaron sobre la "caja" del loop, redirigí a su .dropzone interna
  const loopBox = el.closest?.('.block.loop');
  if (loopBox) return loopBox.querySelector('.dropzone');

  // 3) Si es cualquier parte del workspace, usá el workspace (raíz)
  if (wsEl && wsEl.contains(el)) return wsEl;

  return null;
}

/* Autoscroll suave del workspace cuando el puntero está cerca de los bordes */
function autoscrollWorkspace(e){
  if (!wsEl) return;
  const rect = wsEl.getBoundingClientRect();
  const t = 60;      // zona sensible en px
  const speed = 18;  // cuánto scrollea por tick

  if (e.clientY < rect.top + t) wsEl.scrollTop -= speed;
  else if (e.clientY > rect.bottom - t) wsEl.scrollTop += speed;
}

/* Delegación global mejorada */
document.addEventListener('dragover', (e)=>{
  const t = resolveDropTargetFromPoint(e.clientX, e.clientY);
  if (!t) return;
  e.preventDefault();
  autoscrollWorkspace(e);

  // feedback visual
  document.querySelectorAll('.dropzone.is-hover, #workspace.is-hover')
    .forEach(n=>n.classList.remove('is-hover'));
  t.classList.add('is-hover');
}, true);

document.addEventListener('drop', (e)=>{
  const t = resolveDropTargetFromPoint(e.clientX, e.clientY);
  if (!t) return;
  e.preventDefault(); e.stopPropagation();

  document.querySelectorAll('.dropzone.is-hover, #workspace.is-hover')
    .forEach(n=>n.classList.remove('is-hover'));

  handleDropOnDropzone(t, parseDnDPayload(e));
}, true);

function loopDepth(el){
  let d = 0, p = el?.parentElement;
  while (p){
    if (p.classList?.contains('block') && p.dataset?.type === T_LOOP) d++;
    p = p.parentElement;
  }
  return d;
}

function parseDnDPayload(e){
  try { return JSON.parse(e.dataTransfer.getData('application/json')||'{}'); }
  catch { return {}; }
}

function handleDropOnDropzone(dz, payload){
  if (!dz) return;
  if (dz.closest && dz.closest('#blocks-panel')) return; // no soltar dentro del panel
  const { from, type } = payload || {};

  // mover dentro del workspace
  if (from === 'ws' && draggingEl){
    if (draggingEl.dataset.type === T_LOOP){
      const parentLoop = dz.closest?.('.block.loop');
      const newDepth = parentLoop ? loopDepth(parentLoop) + 1 : 0;
      if (newDepth >= 2) return; // sólo 2 niveles
    }
    if (draggingEl.contains?.(dz)) return;
    dz.appendChild(draggingEl);
    refreshPlan();
    return;
  }

  // crear desde panel
  if (from !== 'panel') return;

  if (type === T_LOOP){
    const n = payload.loopN ?? 3;
    if (!CONFIG.allowedLoopSizes.includes(n)) return;
    const parentLoop = dz.closest?.('.block.loop');
    if (parentLoop && loopDepth(parentLoop) >= 1) return; // sólo 2 niveles
    if (inv.loops <= 0) return;
    dz.appendChild(createLoop(n)); inv.loops--; refreshInventory(); refreshPlan(); return;
  }
  if (type === T_ANTI){
    if (inv.anti <= 0) return;
    dz.appendChild(createAnti()); inv.anti--; refreshInventory(); refreshPlan(); return;
  }
  if (type === T_SEAL){
    if (inv.seal <= 0) return;
    dz.appendChild(createSeal()); inv.seal--; refreshInventory(); refreshPlan(); return;
  }
  if (type === T_FOCUS){
    if (inv.focus <= 0) return;
    dz.appendChild(createFocus()); inv.focus--; refreshInventory(); refreshPlan(); return;
  }
}

function wireDropzone(dz){
  if (!dz || dz.dataset.wired) return;
  dz.dataset.wired = '1';
  dz.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); });
  dz.addEventListener('dragenter', ()=> dz.classList.add('is-hover'));
  dz.addEventListener('dragleave', ()=> dz.classList.remove('is-hover'));
  dz.addEventListener('drop', e=>{
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('is-hover');
    handleDropOnDropzone(dz, parseDnDPayload(e));
  });
}

wirePanel();

/* ========== Serialización / Plan ========== */
function readProgram(zone){
  const out = [];
  if (!zone) return out;
  [...zone.children].forEach(el=>{
    const t = el.dataset?.type;
    if (!t) return;
    if (t === T_LOOP){
      const n = parseInt(el.dataset.n || el.querySelector('.loop-n')?.textContent || '0', 10) || 0;
      const inner = el.querySelector('.dropzone');
      out.push({ type:T_LOOP, n, body: readProgram(inner) });
    } else if (t === T_ANTI || t === T_SEAL || t === T_FOCUS){
      out.push({ type:t });
    }
  });
  return out;
}

function findNested(prog){
  for (const step of prog){
    if (step.type === T_LOOP){
      const innerLoop = step.body.find(s => s.type === T_LOOP);
      if (innerLoop) return { outer: step, inner: innerLoop };
      const deeper = findNested(step.body);
      if (deeper) return deeper;
    }
  }
  return null;
}

function refreshPlan(){
  const prog = readProgram(wsEl);
  const nested = findNested(prog);
  let total = 0;
  if (nested) total = nested.outer.n * nested.inner.n * 3;
  planNowEl && (planNowEl.textContent = `${total}/${CONFIG.targetSteps}`);
  runBtn && (runBtn.disabled = prog.length === 0);
}

/* ========== Validación ========== */
function multisetEq34(a, b){
  return [a,b].sort().join(',') === CONFIG.allowedLoopSizes.slice().sort().join(',');
}
function checkConstraints(){
  const prog = readProgram(wsEl);
  const nested = findNested(prog);
  if (!nested) return { ok:false, msg:'Usá un bucle anidado: loop → loop.' };

  // Tamaños deben ser 3 y 4 en cualquier orden
  if (!multisetEq34(nested.outer.n, nested.inner.n)){
    return { ok:false, msg:'Los dos bucles deben ser 3 y 4 (en cualquier orden).' };
  }

  // Inner debe ser [ANTIROT, SELLAR, FOCO]
  const seqInner = nested.inner.body.map(s=>s.type);
  if (seqInner.length !== 3 || seqInner[0] !== T_ANTI || seqInner[1] !== T_SEAL || seqInner[2] !== T_FOCUS){
    return { ok:false, msg:'Dentro del loop interno: ANTIROT → SELLAR → FOCO.' };
  }

  const total = nested.outer.n * nested.inner.n * 3;
  if (total !== CONFIG.targetSteps){
    return { ok:false, msg:`Total actual: ${total}. Debe ser ${CONFIG.targetSteps} (= externo × interno × 3).` };
  }
  return { ok:true, nested };
}

/* ========== Simulación ========== */
async function simulate(){
  ensureBoard();
  const rows = 3, cols = 4;
  const stepMs = msPerStep();

  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      const a = cellEl(r,c);
      a?.classList.add('synced');
      a?.querySelector('.icon') && (a.querySelector('.icon').textContent = '🌀');
      await sleep(stepMs * 0.5);

      const s = cellEl(r,c);
      s?.classList.add('beamed');
      s?.querySelector('.icon') && (s.querySelector('.icon').textContent = '🔒');
      await sleep(stepMs * 0.5);

      const f = cellEl(r,c);
      f?.classList.add('focused');
      f?.querySelector('.icon') && (f.querySelector('.icon').textContent = '🎯');
      await sleep(stepMs * 0.5);
    }
  }
}

/* ========== RUN / BOTONES ========== */
let running = false;
async function runProgram(){
  if (running) return;
  running = true; runBtn && (runBtn.disabled = true);

  const check = checkConstraints();
  ensureBoard();

  if (!check.ok){
    await sleep(100);
    alert(`🧠 Patrón incorrecto.\n\n• ${check.msg}\n• Pista: loops {3,4} y, adentro, [ANTIROT, SELLAR, FOCO].`);
  } else {
    await simulate();
    showToast('🏆 Brain Rot purgado: patrón 3×4×3 perfecto.', true);
    try { localStorage.setItem('nivel4Complete','true'); } catch {}
    setTimeout(()=> window.location.href = CONFIG.nextLevelUrl, 1200);
  }

  running = false; runBtn && (runBtn.disabled = false);
}
runBtn?.addEventListener('click', runProgram);

clearBtn?.addEventListener('click', ()=>{
  wsEl?.querySelectorAll('[data-type="antirot"]').forEach(n=>{ n.remove(); inv.anti++; });
  wsEl?.querySelectorAll('[data-type="seal"]').forEach(n=>{ n.remove(); inv.seal++; });
  wsEl?.querySelectorAll('[data-type="focus"]').forEach(n=>{ n.remove(); inv.focus++; });
  wsEl?.querySelectorAll('[data-type="loop"]').forEach(n=>{ n.remove(); inv.loops++; });
  refreshInventory(); refreshPlan(); ensureBoard();
});

resetBtn?.addEventListener('click', ()=>{
  wsEl && (wsEl.innerHTML = '');
  inv = { ...INIT_INV };
  refreshInventory(); refreshPlan(); ensureBoard();
});

/* ================== INIT ================== */
(function init(){
  targetXEl    && (targetXEl.textContent    = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  ensureBoard(); refreshInventory(); refreshPlan(); wirePanel();
})();
