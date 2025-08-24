/***** NIVEL 1 — Órbita de 20 (brain rots si no llegás) *****
 * Reglas:
 * - En root: SOLO loops (máx 2).
 * - Dentro de cada loop: SOLO 1 instrucción "Girar Derecha" (= Vuelta).
 * - Meta: EXACTAMENTE 20 vueltas (sumando repeticiones).
 ************************************************************/

/* --------- CONFIG --------- */
const CONFIG = {
  targetSteps: 20,
  inventory: { loops: 2, rights: 2 } // 2 loops + 2 vueltas (1 por loop)
};

/* --------- DOM --------- */
const wsEl       = document.getElementById('workspace');
const runBtn     = document.getElementById('btn-run');
const clearBtn   = document.getElementById('btn-clear');
const resetBtn   = document.getElementById('btn-reset');
const speedInput = document.getElementById('speed');

const countSimpleEl = document.getElementById('count-simple'); // mostramos rights como “simples”
const countLoopsEl  = document.getElementById('count-loops');
const planNowEl     = document.getElementById('plan-now');
const planTargetEl  = document.getElementById('plan-target');
const targetXEl     = document.getElementById('targetX');

/* --------- Inventario --------- */
let inv = { loops: CONFIG.inventory.loops, rights: CONFIG.inventory.rights };

/* --------- Panel: bloqueá lo que no va en este nivel --------- */
(function lockInvalidPanelBlocks(){
  const move = document.querySelector('#blocks-panel .block.simple[data-type="move"]');
  const left = document.querySelector('#blocks-panel .block.simple[data-type="left"]');
  [move, left].forEach(el => el && el.classList.add('disabled')); // sin pointer-events:none
})();

/* --------- Drag desde el panel --------- */
document.querySelectorAll('#blocks-panel .block').forEach(el=>{
  el.addEventListener('dragstart', e=>{
    const type = el.dataset.type;
    // inválidos para este nivel
    if (type === 'move' || type === 'left') { e.preventDefault(); return; }
    // stock
    if (type === 'loop'  && inv.loops  <= 0) { e.preventDefault(); return; }
    if (type === 'right' && inv.rights <= 0) { e.preventDefault(); return; }

    e.dataTransfer.setData('source', 'panel');
    e.dataTransfer.setData('block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  });
});

/* ====== DROP GLOBAL con delegación (inner dinámicos incluidos) ====== */
function zoneFromEventTarget(target){
  return target.closest?.('.inner-drop, .root-drop') || null;
}

document.addEventListener('dragenter', (e)=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  zone.classList.add('dz-hover');
}, true);

document.addEventListener('dragleave', (e)=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  setTimeout(()=> zone.classList.remove('dz-hover'), 40);
}, true);

document.addEventListener('dragover', (e)=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}, true);

document.addEventListener('drop', (e)=>{
  const zone = zoneFromEventTarget(e.target);
  if (!zone) return;
  e.preventDefault();

  const src  = e.dataTransfer.getData('source');
  const type = e.dataTransfer.getData('block-type');
  if (src !== 'panel' || !type) return;

  // ROOT: solo loops
  if (zone.classList.contains('root-drop')){
    if (type !== 'loop' || inv.loops <= 0) return;
    const loopEl = createLoopBlock();
    zone.appendChild(loopEl);
    inv.loops--;
    refreshInventoryUI();
    refreshPlanUI();
    return;
  }

  // INNER: solo right (1 por loop)
  if (zone.classList.contains('inner-drop')){
    if (type !== 'right' || inv.rights <= 0) return;
    if ([...zone.children].some(c => c.dataset.type === 'right')) return;
    const rightEl = createRightBlock();
    zone.appendChild(rightEl);
    inv.rights--;
    refreshInventoryUI();
    refreshPlanUI();
    return;
  }
}, true);

/* --------- Crear bloques --------- */
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

  // Cabecera
  const head = document.createElement('div');
  head.className = 'loop-header';

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = 'Repetir';

  const n = document.createElement('span');
  n.className = 'loop-n';
  n.textContent = '10'; // 10+10=20 (amigable)
  n.title = 'Click para cambiar (1–20)';
  n.addEventListener('click', ()=>{
    const val = prompt('¿Cuántas repeticiones? (1-20)', n.textContent);
    const k = Math.max(1, Math.min(20, parseInt(val||n.textContent,10)));
    n.textContent = String(k);
    refreshPlanUI();
  });

  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.append(
    mini('↑','Subir', ()=> container.previousElementSibling?.before(container)),
    mini('↓','Bajar', ()=> container.nextElementSibling?.after(container)),
    mini('✖','Eliminar', ()=> { refundBlock(container); container.remove(); refreshPlanUI(); })
  );

  head.append(lbl, n, document.createTextNode('×'), controls);

  // Zona interna (solo “right”)
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
    mini('✖','Eliminar', ()=> { refundBlock(item); item.remove(); refreshPlanUI(); })
  );

  item.append(label, controls);
  return item;
}

/* --------- Inventario / Devoluciones --------- */
function refundBlock(el){
  const t = el.dataset.type;
  if (t === 'loop'){
    inv.loops++;
    const inner = el.querySelector('.inner-drop');
    refundChildren(inner);
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

/* --------- Serializador & contador --------- */
function readProgram(zone){
  const steps = [];
  [...zone.children].forEach(el=>{
    const t = el.dataset.type;
    if (!t) return;
    if (t==='loop'){
      const n = parseInt(el.querySelector('.loop-n').textContent,10) || 1;
      const inner = el.querySelector('.inner-drop');
      steps.push({type:'loop', n, body: readProgram(inner)});
    } else if (t==='right'){
      steps.push({type:'right'});
    }
  });
  return steps;
}
function expandedCount(list){
  let c = 0;
  for (const step of list){
    if (step.type==='loop') c += step.n * expandedCount(step.body);
    else if (step.type==='right') c += 1;
  }
  return c;
}

/* --------- UI plan / inventario --------- */
function refreshPlanUI(){
  const prog = readProgram(wsEl);
  const now  = expandedCount(prog);
  planNowEl && (planNowEl.textContent = String(now));

  if (runBtn){
    const ok = now === CONFIG.targetSteps;
    runBtn.disabled = !ok;
    runBtn.title = ok ? 'Listo para ejecutar' : `Debés llegar a ${CONFIG.targetSteps} vueltas`;
  }
}
function refreshInventoryUI(){
  countLoopsEl  && (countLoopsEl.textContent  = String(inv.loops));
  countSimpleEl && (countSimpleEl.textContent = String(inv.rights));

  const loopTpl  = document.querySelector('#blocks-panel .block.loop');
  const rightTpl = document.querySelector('#blocks-panel .block.simple[data-type="right"]');
  const moveTpl  = document.querySelector('#blocks-panel .block.simple[data-type="move"]');
  const leftTpl  = document.querySelector('#blocks-panel .block.simple[data-type="left"]');

  loopTpl  && loopTpl.classList.toggle('disabled',  inv.loops  <= 0);
  rightTpl && rightTpl.classList.toggle('disabled', inv.rights <= 0);
  // Siempre deshabilitados en este nivel:
  moveTpl  && moveTpl.classList.add('disabled');
  leftTpl  && leftTpl.classList.add('disabled');
}

/* --------- “Ejecución” + Brain Rots --------- */
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function brainRotEffect(){
  document.body.classList.add('brainrot');
  setTimeout(()=> document.body.classList.remove('brainrot'), 1200);
}

async function runProgram(prog){
  const now = expandedCount(prog);

  // Validaciones pedagógicas del Nivel 1
  const rootLoops = [...wsEl.children].filter(c=>c.dataset.type==='loop');
  const twoLoops  = rootLoops.length === 2;
  const eachHasOneRight = twoLoops && rootLoops.every(loopEl => {
    const body = readProgram(loopEl.querySelector('.inner-drop'));
    return body.filter(s=>s.type==='right').length === 1;
  });

  if (!(now === CONFIG.targetSteps && twoLoops && eachHasOneRight)){
    brainRotEffect();
    const msgA = now !== CONFIG.targetSteps
      ? `Tu programa ejecuta ${now} vueltas, pero la meta es ${CONFIG.targetSteps}.`
      : '';
    const msgB = !twoLoops ? 'Debés usar exactamente 2 ciclos en el Programa.' : '';
    const msgC = twoLoops && !eachHasOneRight ? 'Cada ciclo debe contener exactamente 1 “Vuelta”.' : '';
    alert(`💀 Brain Rots: ${[msgA,msgB,msgC].filter(Boolean).join(' ')}`);
    return;
  }

  await sleep(parseInt(speedInput?.value || '200',10));
  alert('🏆 ¡Órbita de 20 completada! El planeta está a salvo.');
}

/* --------- Botones --------- */
runBtn?.addEventListener('click', async ()=>{
  const program = readProgram(wsEl);
  if (!program.length){
    brainRotEffect();
    alert('Agregá 2 ciclos al Programa y poné 1 “Vuelta” dentro de cada uno.');
    return;
  }
  await runProgram(program);
});
clearBtn?.addEventListener('click', ()=>{
  refundChildren(wsEl);
  wsEl.innerHTML='';
  refreshPlanUI();
});
resetBtn?.addEventListener('click', ()=>{
  refundChildren(wsEl);
  wsEl.innerHTML='';
  inv = { loops: CONFIG.inventory.loops, rights: CONFIG.inventory.rights };
  refreshInventoryUI();
  refreshPlanUI();
});

/* --------- Init --------- */
(function init(){
  targetXEl    && (targetXEl.textContent    = String(CONFIG.targetSteps));
  planTargetEl && (planTargetEl.textContent = String(CONFIG.targetSteps));
  refreshInventoryUI();
  refreshPlanUI();
})();
