/***** NIVEL 1 — Sandbox con animación y mejor drop-in
 * Edición:
 *  - En root: se aceptan loops y giros sueltos (right).
 *  - En loop: solo giros (right), se puede reordenar y poner varios.
 *  - Inventario: 2 loops + 10 giros (ajustable).
 * Ejecución:
 *  - SIEMPRE corre. Muestra resultado correcto/incorrecto.
 *  - La “manija de velocidad” controla el tiempo por paso (ms).
 * Visual:
 *  - Tablero con órbita: cada “right” avanza un segmento del círculo.
 *  - Si total=20 termina justo en el planeta; si no, queda desfasado.
 *****/

/* --------- CONFIG --------- */
const CONFIG = {
  targetSteps: 20,
  inventory: { loops: 2, rights: 10 },
  board: { size: 260, radius: 100 } // px
};

/* --------- DOM --------- */
const wsEl       = document.getElementById('workspace');
const runBtn     = document.getElementById('btn-run');
const clearBtn   = document.getElementById('btn-clear');
const resetBtn   = document.getElementById('btn-reset');
const speedInput = document.getElementById('speed');

const countSimpleEl = document.getElementById('count-simple');
const countLoopsEl  = document.getElementById('count-loops');
const planNowEl     = document.getElementById('plan-now');
const planTargetEl  = document.getElementById('plan-target');
const targetXEl     = document.getElementById('targetX');

const boardEl = document.getElementById('board');

/* --------- Inventario --------- */
let inv = { loops: CONFIG.inventory.loops, rights: CONFIG.inventory.rights };

/* ==================== TABLERO / ÓRBITA ==================== */
let shipEl, planetEl, orbitEl;
function setupBoard(){
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'orbit-wrap';
  wrap.style.width = wrap.style.height = CONFIG.board.size + 'px';

  orbitEl = document.createElement('div');
  orbitEl.className = 'orbit-track';
  orbitEl.style.width = orbitEl.style.height = (CONFIG.board.radius*2) + 'px';

  planetEl = document.createElement('div');
  planetEl.className = 'planet';
  planetEl.textContent = '🪐';

  shipEl = document.createElement('div');
  shipEl.className = 'ship';
  shipEl.textContent = '🚀';

  wrap.append(orbitEl, planetEl, shipEl);
  boardEl.appendChild(wrap);

  resetShip();
}

function resetShip(){
  if (!shipEl) return;
  // arranca apuntando “a la derecha” en ángulo 0
  shipAngle = 0;
  drawShip(shipAngle);
}

let shipAngle = 0; // grados (0..360)
function drawShip(angleDeg){
  const r = CONFIG.board.radius;
  const cx = CONFIG.board.size/2;
  const cy = CONFIG.board.size/2;

  // colocamos el cohete sobre la circunferencia
  const rad = angleDeg * Math.PI/180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  shipEl.style.left = (x - 12) + 'px';
  shipEl.style.top  = (y - 12) + 'px';
  shipEl.style.transform = `rotate(${angleDeg+90}deg)`; // que "mire" tangencialmente
}

/* ==================== PROGRAMA / SERIALIZACIÓN ==================== */
function readProgram(zone){
  const steps = [];
  [...zone.children].forEach(el=>{
    const t = el.dataset.type;
    if (!t) return;
    if (t === 'loop'){
      const n = parseInt(el.querySelector('.loop-n').textContent,10) || 0;
      const inner = el.querySelector('.inner-drop');
      steps.push({ type:'loop', n, body: readProgram(inner) });
    } else if (t === 'right'){
      steps.push({ type:'right' });
    }
  });
  return steps;
}

function expandedCount(list){
  let c = 0;
  for (const step of list){
    if (step.type === 'loop') c += step.n * expandedCount(step.body);
    else if (step.type === 'right') c += 1;
  }
  return c;
}

// lista plana de 'right' expandida (para animar paso a paso)
function flatten(list){
  const out = [];
  for (const step of list){
    if (step.type === 'loop'){
      for (let i=0;i<step.n;i++) out.push(...flatten(step.body));
    } else if (step.type === 'right'){
      out.push('right');
    }
  }
  return out;
}

/* ==================== INVENTARIO / UI ==================== */
function refreshPlanUI(){
  const prog = readProgram(wsEl);
  const now  = expandedCount(prog);
  planNowEl && (planNowEl.textContent = String(now));

  // sandbox: siempre habilitado
  runBtn.disabled = false;
  runBtn.title = 'Podés ejecutar incluso con errores';
}
function refreshInventoryUI(){
  countLoopsEl.textContent  = String(inv.loops);
  countSimpleEl.textContent = String(inv.rights);

  const loopTpl  = document.querySelector('#blocks-panel .block.loop');
  const rightTpl = document.querySelector('#blocks-panel .block.simple[data-type="right"]');

  loopTpl  && loopTpl.classList.toggle('disabled', inv.loops <= 0 || getLoops().length >= 2);
  rightTpl && rightTpl.classList.toggle('disabled', inv.rights <= 0);

  // si quedaron en el HTML blocks no válidos, apagarlos
  document.querySelector('#blocks-panel .block.simple[data-type="move"]')?.classList.add('disabled');
  document.querySelector('#blocks-panel .block.simple[data-type="left"]')?.classList.add('disabled');
}

function refundBlock(el){
  const t = el.dataset.type;
  if (t === 'loop'){
    inv.loops++;
    refundChildren(el.querySelector('.inner-drop'));
  } else if (t === 'right'){
    inv.rights++;
  }
  refreshInventoryUI();
}
function refundChildren(zone){
  if (!zone) return;
  [...zone.children].forEach(child=>{
    refundBlock(child);
    child.remove();
  });
}

/* ==================== BLOQUES ==================== */
function mini(txt, title, onClick){
  const b = document.createElement('button');
  b.className = 'btn-mini';
  b.textContent = txt;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}
function createLoopBlock(){
  const container = document.createElement('div');
  container.className = 'program-block loop-block';
  container.dataset.type = 'loop';

  const head = document.createElement('div');
  head.className = 'loop-header';

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = 'Repetir';

  const n = document.createElement('span');
  n.className = 'loop-n';
  n.textContent = '10';
  n.title = 'Click para cambiar (0–20)';
  n.addEventListener('click', ()=>{
    const val = prompt('¿Cuántas repeticiones? (0-20)', n.textContent);
    const k = Math.max(0, Math.min(20, parseInt(val||n.textContent,10)));
    n.textContent = String(isNaN(k)?0:k);
    refreshPlanUI();
  });

  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.append(
    mini('✖','Eliminar', ()=>{ refundBlock(container); container.remove(); refreshPlanUI(); })
  );

  head.append(lbl, n, document.createTextNode('×'), controls);

  const inner = document.createElement('div');
  inner.className = 'inner-drop dropzone';

  container.append(head, inner);
  return container;
}

function createRightBlock(){
  const item = document.createElement('div');
  item.className = 'program-block';
  item.dataset.type = 'right';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = 'Girar Derecha (Vuelta)';

  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.append(
    mini('✖','Eliminar', ()=>{ refundBlock(item); item.remove(); refreshPlanUI(); })
  );

  item.append(label, controls);
  return item;
}

/* ==================== DRAG & DROP (mejor inserción con placeholder) ==================== */
const getLoops = () => [...wsEl.children].filter(el => el.dataset.type === 'loop');
const loopInner = (loopEl)=> loopEl.querySelector('.inner-drop');

const SIMPLE_TYPES = new Set(['right']);
const ROOT_TYPES   = new Set(['right','loop']);

let ghost; // placeholder visual
function ensureGhost(){
  if (!ghost){
    ghost = document.createElement('div');
    ghost.className = 'ghost-slot';
  }
  return ghost;
}

function closestChildIndex(zone, mouseY){
  // devuelve índice donde insertar según posición vertical
  const children = [...zone.children].filter(n=>n!==ghost);
  for (let i=0;i<children.length;i++){
    const r = children[i].getBoundingClientRect();
    const mid = r.top + r.height/2;
    if (mouseY < mid) return i;
  }
  return children.length;
}

/* drag desde panel */
document.querySelectorAll('#blocks-panel .block').forEach(el=>{
  el.addEventListener('dragstart', e=>{
    const type = el.dataset.type;
    if (!ROOT_TYPES.has(type)){ e.preventDefault(); return; }
    if (type==='loop' && inv.loops<=0) { e.preventDefault(); return; }
    if (type==='right'&& inv.rights<=0) { e.preventDefault(); return; }

    e.dataTransfer.setData('source', 'panel');
    e.dataTransfer.setData('block-type', type);
    e.dataTransfer.effectAllowed='copy';
  });
});

/* delegación global */
function zoneFromEventTarget(target){
  return target.closest?.('.inner-drop, .root-drop') || null;
}

document.addEventListener('dragover', e=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  e.preventDefault();
  e.dataTransfer.dropEffect='copy';

  // sólo mostrar ghost donde tiene sentido
  const isRoot = zone.classList.contains('root-drop');
  const isInner= zone.classList.contains('inner-drop');
  const type = e.dataTransfer.getData('block-type');

  if ((isRoot && ROOT_TYPES.has(type)) || (isInner && SIMPLE_TYPES.has(type))){
    const g = ensureGhost();
    const idx = closestChildIndex(zone, e.clientY);
    if (g.parentElement !== zone) zone.appendChild(g);
    zone.insertBefore(g, zone.children[idx] || null);
  }
}, true);

document.addEventListener('dragleave', e=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  // si salimos del contenedor, ocultar ghost
  setTimeout(()=>{
    if (ghost && ghost.parentElement && !zone.contains(document.elementFromPoint(e.clientX, e.clientY))){
      ghost.remove();
    }
  }, 0);
}, true);

document.addEventListener('drop', e=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  e.preventDefault();

  const src  = e.dataTransfer.getData('source');
  const type = e.dataTransfer.getData('block-type');
  if (src !== 'panel' || !type) return;

  const isRoot = zone.classList.contains('root-drop');
  const isInner= zone.classList.contains('inner-drop');

  if (isRoot && ROOT_TYPES.has(type)){
    if (type==='loop'){
      if (inv.loops<=0 || getLoops().length>=2) return;
      const el = createLoopBlock();
      zone.insertBefore(el, (ghost && ghost.parentElement===zone)? ghost : null);
      inv.loops--;
    } else if (type==='right'){
      if (inv.rights<=0) return;
      const el = createRightBlock();
      zone.insertBefore(el, (ghost && ghost.parentElement===zone)? ghost : null);
      inv.rights--;
    }
  } else if (isInner && SIMPLE_TYPES.has(type)){
    if (type==='right' && inv.rights>0){
      const el = createRightBlock();
      zone.insertBefore(el, (ghost && ghost.parentElement===zone)? ghost : null);
      inv.rights--;
    }
  }

  ghost?.remove();
  refreshInventoryUI();
  refreshPlanUI();
}, true);

/* ==================== EJECUCIÓN / ANIMACIÓN ==================== */
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function runProgram(){
  const prog   = readProgram(wsEl);
  const flat   = flatten(prog);
  const total  = flat.length;
  const delay  = parseInt(speedInput?.value || '200',10);

  // una vuelta = 360/CONFIG.targetSteps grados (segmento pedagógico)
  const stepDeg = 360 / CONFIG.targetSteps;

  // reset visual
  resetShip();

  for (let i=0;i<flat.length;i++){
    // cada 'right' avanza un segmento
    shipAngle = (shipAngle + stepDeg) % 360;
    drawShip(shipAngle);
    await sleep(delay);
  }

  // feedback (pero nunca bloqueamos la ejecución)
  const loops = getLoops();
  const empties = loops.filter(l => loopInner(l).children.length===0).length;

  if (loops.length!==2){
    alert(`⚠ Tenés ${loops.length} ciclo(s). Resultado: ${total} vuelta(s).`);
  } else if (empties>0){
    alert(`💀 Hay ${empties} ciclo(s) vacío(s): emiten señal de brain rot. Resultado: ${total} vuelta(s).`);
  } else if (total !== CONFIG.targetSteps){
    alert(`❌ Hiciste ${total} vuelta(s) en lugar de ${CONFIG.targetSteps}.`);
  } else {
    alert('🏆 ¡Exacto! Órbita de 20 completada.');
  }
}

/* ==================== BOTONES ==================== */
runBtn?.addEventListener('click', runProgram);
clearBtn?.addEventListener('click', ()=>{
  refundChildren(wsEl);
  wsEl.innerHTML='';
  refreshPlanUI();
  resetShip();
});
resetBtn?.addEventListener('click', ()=>{
  refundChildren(wsEl);
  wsEl.innerHTML='';
  inv = { loops: CONFIG.inventory.loops, rights: CONFIG.inventory.rights };
  refreshInventoryUI();
  refreshPlanUI();
  resetShip();
});

/* ==================== INIT ==================== */
(function init(){
  targetXEl    && (targetXEl.textContent    = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  refreshInventoryUI();
  refreshPlanUI();
  setupBoard();
})();
