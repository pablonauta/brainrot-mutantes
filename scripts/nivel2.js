/***** NIVEL 2 — Mover adelante (18 pasos), DnD robusto, rieles para sueltas, validación por aporte, animación de abajo→arriba *****/

/* ---------------------- CONFIG ---------------------- */
const CONFIG = {
  targetSteps: 18,
  inventoryDefaults: { loops: 2, moves: 19 },   // obliga a usar ciclos
  msPerStepDefault: 250,
  hoverGap: 28,
  nextLevelUrl: 'intronivel3.html'                  // opcional
};
const MOVE_LABEL = 'Subir 1';


/* ---------------------- Helpers UI ---------------------- */
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function showToast(msg, type='info', ms=2200){
  const t = document.createElement('div');
  t.className = 'toast ' + (type==='success' ? 'toast--success' : type==='error' ? 'toast--error' : 'toast--info');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=> t.classList.add('is-visible'));
  setTimeout(()=>{
    t.classList.remove('is-visible');
    setTimeout(()=> t.remove(), 220);
  }, ms);
}

function randomPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* --------- Frases y helpers de diagnóstico (desglose) ---------- */
const ABSURDOS = [
  "🪨 El asteroide intentó bailar Gangnam Style, pero te vio y activó el modo «Paso del Pingüino Sin Rodillas».",
  "🪨 PSY te escribió: «Oppa... ¿Gangnam qué?». El asteroide no aprueba tu coreografía espacial.",
  "🪨 La NASA llamó: quieren estudiar cómo lograste NO moverte en un vacío sin fricción.",
  "🪨 Los Brain Rot subieron el volumen y te marcaron el paso. Spoiler: no era el correcto.",
  "🪨 El DJ apagó la consola. Dijo que tu coreo rompía la gravedad… pero mal."
];

function getBreakdown(){
  const singles = rootMoves().length;
  const loops = rootLoops().map((l, idx)=>{
    const reps   = parseInt(l.querySelector('.loop-n')?.textContent || '0', 10) || 0;
    const inside = loopDrop(l)?.querySelectorAll('[data-type="move"]')?.length || 0;
    return { index: idx+1, reps, inside, contrib: reps * inside };
  });
  const total = singles + loops.reduce((s,x)=>s+x.contrib, 0);
  return { singles, loops, total };
}

function buildFailMessage(errors){
  const head = randomPick(ABSURDOS);
  const { singles, loops, total } = getBreakdown();
  const breakdownLines = [
    `Total de "Mover adelante": ${total} / ${CONFIG.targetSteps}`,
    `• Sueltas (fuera de ciclos): ${singles}`,
    ...loops.map(l => `• Ciclo ${l.index}: ${l.inside}× dentro × ${l.reps} rep = ${l.contrib}`)
  ];
  return `${head}\n\n${breakdownLines.join('\n')}\n\nDetalles del desastre:\n• ${errors.join('\n• ')}`;
}

/* ---------------------- DOM ---------------------- */
const wsEl        = document.getElementById('workspace');
const runBtn      = document.getElementById('btn-run');
const clearBtn    = document.getElementById('btn-clear');
const resetBtn    = document.getElementById('btn-reset');
const speedInput  = document.getElementById('speed');

const countMovesEl = document.getElementById('count-simple');
const countLoopsEl = document.getElementById('count-loops');
const planNowEl    = document.getElementById('plan-now');
const planTargetEl = document.getElementById('plan-target');
const targetXEl    = document.getElementById('targetX');

const panelEl     = document.getElementById('blocks-panel');
const boardEl     = document.getElementById('board');

/* ---------------------- Inventario ---------------------- */
let inv = {
  loops: parseInt(countLoopsEl?.textContent || '', 10),
  moves: parseInt(countMovesEl?.textContent || '', 10)
};
if (Number.isNaN(inv.loops)) inv.loops = CONFIG.inventoryDefaults.loops;
if (Number.isNaN(inv.moves)) inv.moves = CONFIG.inventoryDefaults.moves;
inv.moves = Math.max(inv.moves, CONFIG.inventoryDefaults.moves);

/* ============================================================
   TABLERO
   ============================================================ */
function ensureBoard() {
  if (!boardEl) return null;
  if (!boardEl.querySelector('.field'))   boardEl.insertAdjacentHTML('beforeend', '<div class="field"></div>');
  const field = boardEl.querySelector('.field');
  if (!field.querySelector('.track'))     field.insertAdjacentHTML('beforeend', '<div class="track"></div>');
  if (!field.querySelector('.asteroid'))  field.insertAdjacentHTML('beforeend', '<div class="asteroid">🪨</div>');
  if (!field.querySelector('.mover'))     field.insertAdjacentHTML('beforeend', '<div class="mover"><div class="ship">🚀</div></div>');
  return {
    field,
    track: field.querySelector('.track'),
    asteroid: field.querySelector('.asteroid'),
    mover: field.querySelector('.mover'),
    ship: field.querySelector('.ship')
  };
}
ensureBoard();

function msPerStep() {
  const v = parseInt(speedInput?.value || '', 10);
  return Number.isNaN(v) ? CONFIG.msPerStepDefault : Math.max(60, v);
}

/* Coordenadas RELATIVAS A LA PISTA (top = 0) */
function getCoords() {
  const { track, asteroid, mover } = ensureBoard();
  const t = track.getBoundingClientRect();
  const a = asteroid.getBoundingClientRect();

  const shipH = 36;                   // alto visual aprox del emoji 🚀
  const startY  = t.height - shipH;   // fondo de la pista
  const astTopInTrack = a.top - t.top;
  const targetY = Math.max(astTopInTrack - CONFIG.hoverGap, 0);

  // Y actual (translateY) respecto al top de la pista
  const style  = getComputedStyle(mover);
  const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform);
  const currentY = matrix.m42 || 0;

  return { mover, targetY, startY, currentY };
}

/* Ahora la nave arranca ABAJO y sube */
function resetMover() {
  const { mover, startY } = getCoords();
  mover.style.transform = `translate(-50%, ${startY}px)`;
  const ship = mover.querySelector('.ship'); ship?.classList.remove('pause');
}

/* Simula #steps mapeado linealmente: devuelve Promise y resuelve al terminar */
function simulate(steps) {
  return new Promise((resolve)=>{
    const { mover, startY, targetY } = getCoords();
    const ratio = Math.max(0, steps) / CONFIG.targetSteps;

    const endY = startY - ratio * (startY - targetY);  // endY <= startY (sube)
    const start = startY;
    const delta = endY - start;                         // negativo

    const duration = Math.max(120, msPerStep() * Math.max(1, steps));
    let t0 = null;

    function step(ts) {
      if (!t0) t0 = ts;
      const t = Math.min(1, (ts - t0) / duration);
      const u = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;     // easing
      const y = start + delta * u;
      mover.style.transform = `translate(-50%, ${y}px)`;

      if (t < 1) requestAnimationFrame(step);
      else {
        const { targetY: tY } = getCoords(); // por si redimensionaron
        const nearTarget = Math.abs(y - tY) < 1 && steps === CONFIG.targetSteps;
        const ship = mover.querySelector('.ship');
        if (ship) ship.classList.toggle('pause', !nearTarget);
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

/* ============================================================
   UTILIDADES DE PROGRAMA (mismo patrón que nivel 1)
   ============================================================ */
const TYPE_LOOP = 'loop';
const TYPE_MOVE = 'move';

const rootChildren = () => [...wsEl.children];
const rootLoops    = () => rootChildren().filter(el => (el.dataset?.type || '').toLowerCase() === TYPE_LOOP);
function rootMoves(){ return [...wsEl.querySelectorAll('[data-type="move"]')].filter(el => !el.closest('.block.loop')); }
const loopDrop = (loopEl) => loopEl.querySelector('.dropzone');

function totalMoves() {
  let total = rootMoves().length; // sueltas
  rootLoops().forEach(loop => {
    const reps   = parseInt(loop.querySelector('.loop-n')?.textContent || '0', 10) || 0;
    const inside = (loopDrop(loop)?.querySelectorAll(`[data-type="${TYPE_MOVE}"]`)?.length) || 0;
    if (inside > 0) total += reps * inside;
  });
  return total;
}

function checkConstraints() {
  const errors = [];
  const loops = rootLoops();
  const movesOutside = rootMoves().length;

  if (loops.length !== 2) errors.push(`Debés usar exactamente 2 ciclos (tenés ${loops.length}).`);

  let empties = 0; const stats = [];
  loops.forEach(l => {
    const reps   = parseInt(l.querySelector('.loop-n')?.textContent || '0', 10) || 0;
    const inside = loopDrop(l)?.querySelectorAll(`[data-type="${TYPE_MOVE}"]`)?.length || 0;
    const contrib = reps * inside;
    stats.push({ reps, inside, contrib });
    if (inside === 0) empties++;
  });
  if (empties > 0) errors.push(`⚠ Hay ${empties} ciclo(s) vacío(s). Emiten ondas negativas al ritmo de PSY.`);

  if (stats.length === 2 && stats[0].contrib === stats[1].contrib) {
    errors.push(`Los dos ciclos no pueden sumar lo mismo (ahora: ${stats[0].contrib} y ${stats[1].contrib}). Cambiá repeticiones o cantidad de “Mover” adentro.`);
  }

  if (movesOutside < 1) errors.push(`Necesitás al menos 1 “Mover” fuera de los ciclos (en el área de Programa).`);

  const total = totalMoves();
  if (total !== CONFIG.targetSteps) errors.push(`Total de "Mover adelante": ${total} / ${CONFIG.targetSteps}`);

  return errors;
}

function refreshPlanAndRunButton() {
  const now = totalMoves();
  planNowEl && (planNowEl.textContent = `${now}/${CONFIG.targetSteps}`);
  const hasSomething = rootLoops().length > 0 || rootMoves().length > 0;
  runBtn && (runBtn.disabled = !hasSomething);
}
function refreshInventoryUI() {
  countLoopsEl && (countLoopsEl.textContent = String(inv.loops));
  countMovesEl && (countMovesEl.textContent = String(inv.moves));
  panelEl?.querySelector('.block.loop')?.classList.toggle('disabled', inv.loops <= 0 || rootLoops().length >= 2);
  panelEl?.querySelector('.block.simple[data-type="move"]')?.classList.toggle('disabled', inv.moves <= 0);
}

/* ============================================================
   FABRICACIÓN DE BLOQUES
   ============================================================ */
function makeMiniButton(txt, title, onClick) {
  const b = document.createElement('button');
  b.className = 'btn-mini btn-remove';
  b.type = 'button';
  b.title = title;
  b.textContent = txt;
  b.addEventListener('click', onClick);
  return b;
}
function createMoveBlock() {
  const item = document.createElement('div');
  item.className = 'block simple placed';
  item.dataset.type = TYPE_MOVE;

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = MOVE_LABEL;   // ← antes: 'Mover adelante'

  const ctrl = document.createElement('div');
  ctrl.className = 'controls';
  ctrl.append(makeMiniButton('✖', 'Eliminar', () => {
    item.remove(); inv.moves++; refreshInventoryUI(); refreshPlanAndRunButton();
  }));

  item.append(label, ctrl);
  return item;
}
function createLoopBlock() {
  const loop = document.createElement('div');
  loop.className = 'block loop placed';
  loop.dataset.type = TYPE_LOOP;

  const head = document.createElement('div');
  head.className = 'loop-head';
  head.append('Repetir ');
  const nEl = document.createElement('span');
  nEl.className = 'loop-n'; nEl.textContent = '3';
  nEl.title = 'Click para cambiar (1–20)';
  head.append(nEl, '×');

  head.addEventListener('click', (e) => {
    const t = e.target.closest('.loop-n'); if (!t) return;
    const val = parseInt(prompt('Repeticiones (1–20):', t.textContent) || t.textContent, 10);
    const nn  = Math.min(20, Math.max(1, isNaN(val) ? 1 : val));
    t.textContent = String(nn);
    refreshPlanAndRunButton();
  });

  const btnX = makeMiniButton('✖', 'Eliminar ciclo', () => {
    const numInside = (dz.querySelectorAll(`[data-type="${TYPE_MOVE}"]`)?.length) || 0;
    inv.moves += numInside; loop.remove(); inv.loops++; refreshInventoryUI(); refreshPlanAndRunButton();
  });

  const dz = document.createElement('div');
  dz.className = 'dropzone';
  wireInnerDropzone(dz);
  wireLoopContainer(loop);

  loop.append(head, dz, btnX);
  return loop;
}

/* ============================================================
   RIELES EN ROOT
   ============================================================ */
function ensureRootRails() {
  if (!wsEl) return;
  if (!wsEl.querySelector('.root-rail[data-rail="top"]')) {
    const top = document.createElement('div');
    top.className = 'dropzone root-rail'; top.dataset.rail='top';
    top.innerHTML = '<div class="rail-hint">Soltá un “Mover” suelto aquí</div>';
    wsEl.insertBefore(top, wsEl.firstChild); wireRootRail(top);
  }
  if (!wsEl.querySelector('.root-rail[data-rail="bottom"]')) {
    const bot = document.createElement('div');
    bot.className = 'dropzone root-rail'; bot.dataset.rail='bottom';
    bot.innerHTML = '<div class="rail-hint">…o acá abajo</div>';
    wsEl.appendChild(bot); wireRootRail(bot);
  }
}
function wireRootRail(rail){
  if (!rail || rail.dataset.wired) return;
  rail.dataset.wired = '1';
  rail.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); });
  rail.addEventListener('drop', e=>{
    e.preventDefault(); e.stopPropagation();
    let payload={}; try{ payload=JSON.parse(e.dataTransfer.getData('application/json')||'{}'); }catch{}
    const {from,type}=payload||{};
    if (from!=='panel' || type!==TYPE_MOVE || inv.moves<=0) return;
    rail.appendChild(createMoveBlock()); inv.moves--; refreshInventoryUI(); refreshPlanAndRunButton();
  });
}

/* ============================================================
   DRAG & DROP
   ============================================================ */
function setPayload(e,obj){
  try{ e.dataTransfer.setData('application/json', JSON.stringify(obj)); }catch{}
  try{ e.dataTransfer.setData('text/plain', obj.type||''); }catch{}
}
function wirePanelDrag(){
  if (!panelEl) return;
  panelEl.querySelectorAll('.block[draggable="true"]').forEach(b=>{
    if (b.dataset.wired) return;
    b.dataset.wired='1';
    b.addEventListener('dragstart', e=>{
      const type=(b.dataset.type||'').toLowerCase();
      if (type!=='loop' && type!=='move'){ e.preventDefault(); return; }
      if (type==='loop' && inv.loops<=0){ e.preventDefault(); return; }
      if (type==='move' && inv.moves<=0){ e.preventDefault(); return; }
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

wsEl.addEventListener('dragover', e=>{ if (isInnerZone(e.target)) return; e.preventDefault(); e.stopPropagation(); });
wsEl.addEventListener('drop', e=>{
  if (isInnerZone(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  let payload={}; try{ payload=JSON.parse(e.dataTransfer.getData('application/json')||'{}'); }catch{}
  const {from,type}=payload||{}; if (from!=='panel') return;

  if (type==='loop'){
    if (inv.loops<=0 || rootLoops().length>=2) return;
    const loop=createLoopBlock();
    const overLoop=e.target.closest('.block.loop');
    if (overLoop){
      const r=overLoop.getBoundingClientRect(); const after=(e.clientY>r.top+r.height/2);
      wsEl.insertBefore(loop, after?overLoop.nextSibling:overLoop);
    } else { beforeRailBottomOrEnd(loop); }
    inv.loops--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
  }
  if (type==='move'){
    if (inv.moves<=0) return;
    beforeRailBottomOrEnd(createMoveBlock());
    inv.moves--; refreshInventoryUI(); refreshPlanAndRunButton(); return;
  }
});

function wireInnerDropzone(dz){
  if (!dz || dz.dataset.wired) return; dz.dataset.wired='1';
  dz.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); });
  dz.addEventListener('drop', e=>{
    e.preventDefault(); e.stopPropagation();
    let payload={}; try{ payload=JSON.parse(e.dataTransfer.getData('application/json')||'{}'); }catch{}
    const {from,type}=payload||{};
    if (from!=='panel' || type!=='move' || inv.moves<=0) return;
    dz.appendChild(createMoveBlock()); inv.moves--; refreshInventoryUI(); refreshPlanAndRunButton();
  });
}
function wireLoopContainer(loop){
  if (!loop || loop.dataset.loopWired) return; loop.dataset.loopWired='1';
  loop.addEventListener('dragover', e=>{ e.preventDefault(); /* sin stopPropagation */ });
  loop.addEventListener('drop', e=>{
    let payload={}; try{ payload=JSON.parse(e.dataTransfer.getData('application/json')||'{}'); }catch{}
    const {from,type}=payload||{};
    if (from!=='panel' || type!=='move') return;      // deja burbujear los LOOP
    e.preventDefault(); e.stopPropagation();
    if (inv.moves<=0) return;
    const dz=loopDrop(loop); if (!dz) return;
    dz.appendChild(createMoveBlock()); inv.moves--; refreshInventoryUI(); refreshPlanAndRunButton();
  });
}
wsEl.querySelectorAll('.block.loop').forEach(loop=>{ wireInnerDropzone(loopDrop(loop)); wireLoopContainer(loop); });

/* ============================================================
   RUN + validación + (opcional) salto de nivel
   ============================================================ */
let running = false;
async function runProgram(){
  if (running) return;
  running = true;
  if (runBtn) runBtn.disabled = true;

  const total = totalMoves();

  // Siempre reseteamos a abajo de la pista antes de animar
  resetMover();

  // Animá primero (si hay pasos) — si total=0, no hay animación
  if (total > 0) {
    await simulate(total);
  }

  // Validación de reglas
  const errors = checkConstraints();
  if (errors.length){
    alert(buildFailMessage(errors));   // ← ahora muestra “Total de Mover adelante” + desglose
  } else {
    showToast('🏆 ¡Exacto! Llegaste justo arriba del asteroide.', 'success', 1600);
    try { localStorage.setItem('nivel2Complete','true'); } catch {}
    // Pequeña pausa para ver el final antes de saltar
    await sleep(1000);
    if (CONFIG.nextLevelUrl) window.location.assign(CONFIG.nextLevelUrl);
  }

  running = false;
  if (runBtn) runBtn.disabled = false;
}

/* ============================================================
   Botonera
   ============================================================ */
runBtn?.addEventListener('click', runProgram);
clearBtn?.addEventListener('click', ()=>{
  rootMoves().forEach(m=>{ m.remove(); inv.moves++; });
  rootLoops().forEach(loop=>{
    const inside = loopDrop(loop)?.querySelectorAll('[data-type="move"]')?.length || 0;
    inv.moves += inside; loop.remove(); inv.loops++;
  });
  refreshInventoryUI(); refreshPlanAndRunButton(); resetMover();
});
resetBtn?.addEventListener('click', ()=>{
  rootMoves().forEach(m=>m.remove());
  rootLoops().forEach(loop=>loop.remove());
  inv = { ...CONFIG.inventoryDefaults };
  refreshInventoryUI(); refreshPlanAndRunButton(); resetMover();
});

/* ============================================================
   INIT
   ============================================================ */
(function init(){
  targetXEl    && (targetXEl.textContent    = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  ensureBoard(); ensureRootRails();
  refreshInventoryUI(); refreshPlanAndRunButton();
  resetMover(); // arrancá con la nave abajo de la pista
})();
