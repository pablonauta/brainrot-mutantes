/***** NIVEL 1 — JS (19 vueltas en inventario, DnD robusto, rieles para sueltas, validación por aporte de cada ciclo, órbita centrada, salto a nivel 2) *****/

/* ---------------------- CONFIG ---------------------- */
const CONFIG = {
  targetSteps: 20,
  // Stock por defecto: 2 ciclos y SOLO 19 vueltas (obliga a usar bucles)
  inventoryDefaults: { loops: 2, turns: 19 },
  orbitMsPerTurnDefault: 250,
  nextLevelUrl: '/paginas/intronivel2.html'   // ← cambiá la ruta si tu Nivel 2 vive en otro lado
};

/* ---------------------- DOM ---------------------- */
const wsEl        = document.getElementById('workspace'); // root-drop
const runBtn      = document.getElementById('btn-run');
const clearBtn    = document.getElementById('btn-clear');
const resetBtn    = document.getElementById('btn-reset');
const speedInput  = document.getElementById('speed');

const countTurnsEl = document.getElementById('count-simple'); // “Instrucciones (Vuelta) restantes”
const countLoopsEl = document.getElementById('count-loops');  // “Ciclos restantes”
const planNowEl    = document.getElementById('plan-now');
const planTargetEl = document.getElementById('plan-target');
const targetXEl    = document.getElementById('targetX');

const panelEl     = document.getElementById('blocks-panel');
const boardEl     = document.getElementById('board');

/* ---------------------- Inventario ---------------------- */
let inv = {
  loops: parseInt(countLoopsEl?.textContent || '', 10),
  turns: parseInt(countTurnsEl?.textContent || '', 10)
};
if (Number.isNaN(inv.loops)) inv.loops = CONFIG.inventoryDefaults.loops;
if (Number.isNaN(inv.turns)) inv.turns = CONFIG.inventoryDefaults.turns;
// Forzamos el mínimo de este nivel (19 vueltas)
inv.turns = Math.max(inv.turns, CONFIG.inventoryDefaults.turns);

/* ============================================================
   TABLERO (planeta centrado + órbita + nave)
   ============================================================ */
function ensureBoard() {
  if (!boardEl) return null;
  if (!boardEl.querySelector('.planet'))  boardEl.insertAdjacentHTML('beforeend', '<div class="planet"></div>');
  if (!boardEl.querySelector('.orbit'))   boardEl.insertAdjacentHTML('beforeend', '<div class="orbit"></div>');
  if (!boardEl.querySelector('.orbiter')) boardEl.insertAdjacentHTML('beforeend', '<div class="orbiter"><div class="ship"></div></div>');
  const orb = boardEl.querySelector('.orbiter');
  if (orb) orb.style.transform = 'translate(-50%,-50%) rotate(0deg)'; // centrado + rotación
  return orb;
}
ensureBoard();

let currentAngle = 0;
function msPerTurn() {
  const v = parseInt(speedInput?.value || '', 10);
  return Number.isNaN(v) ? CONFIG.orbitMsPerTurnDefault : Math.max(60, v);
}
function simulate(turns) {
  const orbiter = ensureBoard();
  if (!orbiter || turns <= 0) return;

  const startAngle = currentAngle;
  const endAngle   = startAngle + 360 * turns;
  const duration   = msPerTurn() * turns;

  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const t = Math.min(1, (ts - start) / duration);
    const u = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easing
    const ang = startAngle + (endAngle - startAngle) * u;
    orbiter.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
    currentAngle = ang;
    if (t < 1) requestAnimationFrame(step);
    else currentAngle = endAngle % 360;
  }
  requestAnimationFrame(step);
}

/* ============================================================
   UTILIDADES DE PROGRAMA
   ============================================================ */
const TYPE_LOOP = 'loop';
const TYPE_TURN = 'turn';

const rootChildren = () => [...wsEl.children];
const rootLoops    = () => rootChildren().filter(el => (el.dataset?.type || '').toLowerCase() === TYPE_LOOP);

// Todas las “Vueltas” que NO están dentro de un loop (incluye rieles)
function rootTurns() {
  return [...wsEl.querySelectorAll('[data-type="turn"]')].filter(el => !el.closest('.block.loop'));
}
const loopDrop = (loopEl) => loopEl.querySelector('.dropzone');

function totalTurns() {
  // total = vueltas sueltas en root + sum(reps * vueltas_inside) por cada loop
  let total = rootTurns().length;
  rootLoops().forEach(loop => {
    const reps = parseInt(loop.querySelector('.loop-n')?.textContent || '0', 10) || 0;
    const inside = (loopDrop(loop)?.querySelectorAll(`[data-type="${TYPE_TURN}"]`)?.length) || 0;
    if (inside > 0) total += reps * inside;
  });
  return total;
}

// Reglas del nivel (valida por "aporte" de cada ciclo)
function checkConstraints() {
  const errors = [];
  const loops = rootLoops();
  const turnsOutside = rootTurns().length;

  // 1) exactamente 2 bucles
  if (loops.length !== 2) {
    errors.push(`Debés usar exactamente 2 ciclos (tenés ${loops.length}).`);
  }

  // 2) cada bucle con al menos 1 “Vuelta” adentro
  let empties = 0;
  const stats = [];
  loops.forEach(l => {
    const reps = parseInt(l.querySelector('.loop-n')?.textContent || '0', 10) || 0;
    const inside = loopDrop(l)?.querySelectorAll(`[data-type="${TYPE_TURN}"]`)?.length || 0;
    const contrib = reps * inside; // ← aporte real del ciclo
    stats.push({ reps, inside, contrib });
    if (inside === 0) empties++;
  });
  if (empties > 0) {
    errors.push(`⚠ Hay ${empties} ciclo(s) vacío(s): emiten ondas negativas que fortalecen a los brain rot.`);
  }

  // 3) los aportes de los dos ciclos deben ser distintos
  if (stats.length === 2) {
    const [a, b] = stats;
    if (a.contrib === b.contrib) {
      errors.push(`Los dos ciclos no pueden sumar lo mismo (ahora: ${a.contrib} y ${b.contrib}). Cambiá las repeticiones o la cantidad de “Vueltas” dentro.`);
    }
  }

  // 4) al menos 1 vuelta suelta en raíz
  if (turnsOutside < 1) errors.push(`Necesitás al menos 1 “Vuelta” fuera de los ciclos (en el área de Programa).`);

  // 5) total = 20
  const total = totalTurns();
  if (total !== CONFIG.targetSteps) errors.push(`Total actual: ${total}. El objetivo es ${CONFIG.targetSteps}.`);

  return errors;
}

function refreshPlanAndRunButton() {
  const now = totalTurns();
  if (planNowEl) planNowEl.textContent = String(now);
  // Se puede ejecutar si hay algo (para ver mensajes y aprender)
  const hasSomething = rootLoops().length > 0 || rootTurns().length > 0;
  if (runBtn) runBtn.disabled = !hasSomething;
}

function refreshInventoryUI() {
  if (countLoopsEl) countLoopsEl.textContent = String(inv.loops);
  if (countTurnsEl) countTurnsEl.textContent = String(inv.turns);
  panelEl?.querySelector('.block.loop')?.classList.toggle('disabled', inv.loops <= 0 || rootLoops().length >= 2);
  panelEl?.querySelector('.block.simple[data-type="turn"]')?.classList.toggle('disabled', inv.turns <= 0);
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

function createTurnBlock() {
  const item = document.createElement('div');
  item.className = 'block simple placed';
  item.dataset.type = TYPE_TURN;

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = 'Dar una vuelta al planeta';

  const ctrl = document.createElement('div');
  ctrl.className = 'controls';
  ctrl.append(makeMiniButton('✖', 'Eliminar', () => {
    item.remove();
    inv.turns++;
    refreshInventoryUI();
    refreshPlanAndRunButton();
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
  nEl.className = 'loop-n';
  nEl.textContent = '3';
  nEl.title = 'Click para cambiar (1–20)';
  head.append(nEl, '×');

  head.addEventListener('click', (e) => {
    const t = e.target.closest('.loop-n');
    if (!t) return;
    const val = parseInt(prompt('Repeticiones (1–20):', t.textContent) || t.textContent, 10);
    const nn = Math.min(20, Math.max(1, isNaN(val) ? 1 : val));
    t.textContent = String(nn);
    refreshPlanAndRunButton();
  });

  const btnX = makeMiniButton('✖', 'Eliminar ciclo', () => {
    // devolver TODAS las “Vueltas” internas al inventario
    const numInside = (dz.querySelectorAll(`[data-type="${TYPE_TURN}"]`)?.length) || 0;
    inv.turns += numInside;
    loop.remove();
    inv.loops++;
    refreshInventoryUI();
    refreshPlanAndRunButton();
  });

  const dz = document.createElement('div');
  dz.className = 'dropzone';
  wireInnerDropzone(dz);   // acepta múltiples vueltas
  wireLoopContainer(loop); // drop en cualquier parte del loop → enruta a su dropzone

  loop.append(head, dz, btnX);
  return loop;
}

/* ============================================================
   RIELES DE ROOT PARA “VUELTAS” SUELTAS
   ============================================================ */
function ensureRootRails() {
  if (!wsEl) return;
  // rail superior
  if (!wsEl.querySelector('.root-rail[data-rail="top"]')) {
    const top = document.createElement('div');
    top.className = 'dropzone root-rail';
    top.dataset.rail = 'top';
    top.innerHTML = '<div class="rail-hint">Soltá una “Vuelta” suelta aquí</div>';
    wsEl.insertBefore(top, wsEl.firstChild);
    wireRootRail(top, 'top');
  }
  // rail inferior
  if (!wsEl.querySelector('.root-rail[data-rail="bottom"]')) {
    const bottom = document.createElement('div');
    bottom.className = 'dropzone root-rail';
    bottom.dataset.rail = 'bottom';
    bottom.innerHTML = '<div class="rail-hint">…o acá abajo</div>';
    wsEl.appendChild(bottom);
    wireRootRail(bottom, 'bottom');
  }
}

function wireRootRail(rail, pos) {
  if (!rail || rail.dataset.wired) return;
  rail.dataset.wired = '1';

  rail.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  rail.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let payload = {};
    try { payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}'); } catch {}
    const { from, type } = payload || {};
    if (from !== 'panel') return;
    if (type !== TYPE_TURN) return;
    if (inv.turns <= 0) return;

    const turn = createTurnBlock();
    rail.appendChild(turn);  // apila DENTRO del riel
    inv.turns--;
    refreshInventoryUI();
    refreshPlanAndRunButton();
  });
}

/* ============================================================
   DRAG & DROP (application/json) + Fix doble drop
   ============================================================ */
function setPayload(e, obj) {
  try { e.dataTransfer.setData('application/json', JSON.stringify(obj)); } catch {}
  try { e.dataTransfer.setData('text/plain', obj.type || ''); } catch {}
}

/* Panel: dragstart */
function wirePanelDrag() {
  if (!panelEl) return;
  panelEl.querySelectorAll('.block[draggable="true"]').forEach(b => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('dragstart', (e) => {
      const type = (b.dataset.type || '').toLowerCase();
      if (type !== TYPE_LOOP && type !== TYPE_TURN) { e.preventDefault(); return; }
      if (type === TYPE_LOOP && inv.loops <= 0) { e.preventDefault(); return; }
      if (type === TYPE_TURN && inv.turns <= 0) { e.preventDefault(); return; }
      setPayload(e, { from: 'panel', type });
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}
wirePanelDrag();

/* --- Helpers --- */
function isInnerZone(target) {
  const dz = target.closest('.dropzone');
  // Es inner si es .dropzone y NO tiene la clase root-drop
  return !!dz && !dz.classList.contains('root-drop');
}
// Insertar antes del rail inferior (si existe) o al final
function beforeRailBottomOrEnd(node) {
  const railBottom = wsEl.querySelector('.root-rail[data-rail="bottom"]');
  if (railBottom) wsEl.insertBefore(node, railBottom);
  else wsEl.appendChild(node);
}

/* Root (workspace): permite soltar un 2º ciclo encima del 1º y sigue aceptando “Vueltas” sueltas */
wsEl.addEventListener('dragover', (e) => {
  if (isInnerZone(e.target)) return;   // las dropzones internas se manejan solas
  e.preventDefault();
  e.stopPropagation();
});

wsEl.addEventListener('drop', (e) => {
  if (isInnerZone(e.target)) return;   // evita doble drop con inner zones
  e.preventDefault();
  e.stopPropagation();

  let payload = {};
  try { payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}'); } catch {}
  const { from, type } = payload || {};
  if (from !== 'panel') return;

  if (type === TYPE_LOOP) {
    if (inv.loops <= 0) return;
    if (rootLoops().length >= 2) return;

    const loop = createLoopBlock();

    // Si estamos sobre un loop existente, decidir antes/después según mitad del bloque
    const overLoop = e.target.closest('.block.loop');
    if (overLoop) {
      const r = overLoop.getBoundingClientRect();
      const after = (e.clientY > r.top + r.height / 2);
      wsEl.insertBefore(loop, after ? overLoop.nextSibling : overLoop);
    } else {
      beforeRailBottomOrEnd(loop);
    }

    inv.loops--;
    refreshInventoryUI();
    refreshPlanAndRunButton();
    return;
  }

  if (type === TYPE_TURN) {
    if (inv.turns <= 0) return;
    const turn = createTurnBlock();
    beforeRailBottomOrEnd(turn); // apilá sueltas al final (antes del rail bottom)
    inv.turns--;
    refreshInventoryUI();
    refreshPlanAndRunButton();
    return;
  }
});

/* Drop dentro de la dropzone del loop: múltiples “Vueltas” y sin burbujeo */
function wireInnerDropzone(dz) {
  if (!dz || dz.dataset.wired) return;
  dz.dataset.wired = '1';

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation(); // clave para evitar que el root se entere
  });

  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation(); // clave

    let payload = {};
    try { payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}'); } catch {}
    const { from, type } = payload || {};
    if (from !== 'panel') return;
    if (type !== TYPE_TURN) return;
    if (inv.turns <= 0) return;

    const turn = createTurnBlock();
    dz.appendChild(turn);     // múltiples dentro del loop
    inv.turns--;
    refreshInventoryUI();
    refreshPlanAndRunButton();
  });
}

/* Contenedor del loop: SOLO maneja “Vueltas”.
   Si se suelta un LOOP encima, deja que burbujee al root (para insertar 2º ciclo). */
function wireLoopContainer(loop) {
  if (!loop || loop.dataset.loopWired) return;
  loop.dataset.loopWired = '1';

  // No frenamos la burbuja en dragover (root también decide)
  loop.addEventListener('dragover', (e) => {
    e.preventDefault();
    // ¡sin stopPropagation!
  });

  loop.addEventListener('drop', (e) => {
    let payload = {};
    try { payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}'); } catch {}
    const { from, type } = payload || {};

    // Si no es turno, dejamos que el root lo maneje (no prevenimos ni paramos)
    if (from !== 'panel' || type !== TYPE_TURN) return;

    // Es una “Vuelta”: ahora sí manejamos acá y frenamos
    e.preventDefault();
    e.stopPropagation();

    if (inv.turns <= 0) return;
    const dz = loopDrop(loop);
    if (!dz) return;

    const turn = createTurnBlock();
    dz.appendChild(turn);     // múltiples
    inv.turns--;
    refreshInventoryUI();
    refreshPlanAndRunButton();
  });
}

/* Cablear loops preexistentes (si hubiera) */
wsEl.querySelectorAll('.block.loop').forEach(loop => {
  wireInnerDropzone(loopDrop(loop));
  wireLoopContainer(loop);
});

/* ============================================================
   RUN con diagnóstico (reglas) + salto a Nivel 2 (tras animación)
   ============================================================ */
function runProgram() {
  const total = totalTurns();

  // Lanzamos la animación si hay vueltas
  if (total > 0) simulate(total);

  // Validar reglas
  const errors = checkConstraints();
  if (errors.length) {
    // Si no cumple, mostramos diagnóstico inmediatamente (como antes)
    alert(errors.join('\n'));
    return;
  }

  // ✅ Éxito: esperamos a que termine la animación antes de alert + redirect
  const animMs = msPerTurn() * total;
  setTimeout(() => {
    alert('🏆 ¡Exacto! Órbita de 20 lograda. Pasás al Nivel 2…');
    try { localStorage.setItem('nivel1Complete', 'true'); } catch {}
    // pequeño colchón para que el usuario perciba el final antes de saltar
    setTimeout(() => { window.location.assign(CONFIG.nextLevelUrl); }, 450);
  }, Math.max(0, animMs + 120)); // +120ms de margen por seguridad
}

/* ============================================================
   BOTONERA
   ============================================================ */
runBtn?.addEventListener('click', runProgram);

clearBtn?.addEventListener('click', () => {
  // Devolver bloques al stock (NO borra los rieles)
  rootTurns().forEach(t => { t.remove(); inv.turns++; });
  rootLoops().forEach(loop => {
    const inside = loopDrop(loop)?.querySelectorAll(`[data-type="${TYPE_TURN}"]`)?.length || 0;
    inv.turns += inside; // devolver todas las internas
    loop.remove();
    inv.loops++;
  });
  refreshInventoryUI();
  refreshPlanAndRunButton();
  // reset visual
  currentAngle = 0;
  const orbiter = ensureBoard();
  if (orbiter) orbiter.style.transform = 'translate(-50%,-50%) rotate(0deg)';
});

resetBtn?.addEventListener('click', () => {
  // limpiar programa y restaurar inventario por defecto (NO borra los rieles)
  rootTurns().forEach(t => t.remove());
  rootLoops().forEach(loop => loop.remove());
  inv = { ...CONFIG.inventoryDefaults };
  refreshInventoryUI();
  refreshPlanAndRunButton();
  currentAngle = 0;
  const orbiter = ensureBoard();
  if (orbiter) orbiter.style.transform = 'translate(-50%,-50%) rotate(0deg)';
});

/* ============================================================
   INIT
   ============================================================ */
(function init() {
  if (targetXEl)    targetXEl.textContent    = String(CONFIG.targetSteps);
  if (planTargetEl) planTargetEl.textContent = String(CONFIG.targetSteps);
  ensureRootRails();          // rieles de root para vueltas sueltas
  refreshInventoryUI();
  refreshPlanAndRunButton();
})();
