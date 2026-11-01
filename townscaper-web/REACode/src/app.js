/**
 * app.js — input, undo/redo, UI glue.
 *
 * Mirrors Placemaker.Maker: every stroke becomes one Action on a bounded list,
 * with undo/redo/clear reusing the same snapshot path (BeginNewAction /
 * EndAction / UndoCommand / RedoCommand / TrimActionList).
 */

import * as THREE from 'three';
import { buildQuadGrid } from './quadgrid.js';
import { Town, decorateCells, buildCellIndex, PALETTES, MAX_HEIGHT } from './town.js';
import { View } from './scene.js';
import { generateDemo } from './demo.js';
import { encodeTown, decodeTown } from './save.js';
import { mountLearnPanel } from './learnpanel.js';

// Hexagon side in triangles; each triangle becomes 3-4 near-square cells.
const GRID_RADIUS = 14;
const HEX_SIZE = 1.0;
const LEVEL_HEIGHT = 0.5;

const canvas = document.getElementById('view');
const paletteEl = document.getElementById('palette');
const toolsEl = document.getElementById('tools');
const toastEl = document.getElementById('toast');
const helpEl = document.getElementById('helpcard');

const grid = decorateCells(buildQuadGrid({ radius: GRID_RADIUS, hexSize: HEX_SIZE }));
const index = buildCellIndex(grid);
const town = new Town(grid);
town.palette = PALETTES.town;

const view = new View(canvas, town, grid, index, { levelHeight: LEVEL_HEIGHT });

/* ------------------------------------------------------------------ state */

let tool = 'build';
let colorIndex = 0;
let paletteName = 'town';

const undoStack = [];
const redoStack = [];
const UNDO_LIMIT = 60;

let strokeSnapshot = null;
let strokeEdits = null;
let strokeChanged = false;

/* -------------------------------------------------------------------- UI */

function buildPalette() {
  paletteEl.replaceChildren();
  town.palette.colors.forEach((hex, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === colorIndex ? ' active' : '');
    b.style.background = hex;
    b.title = `颜色 ${i + 1}`;
    b.addEventListener('click', () => {
      // Picking a colour only picks the colour: build keeps building (with this
      // colour, like the original), paint keeps painting. Only erase is left,
      // because erasing with a colour selected is never what was meant.
      colorIndex = i;
      if (tool === 'erase') setTool('build');
      refreshPaletteSelection();
    });
    paletteEl.appendChild(b);
  });
}

function refreshPaletteSelection() {
  [...paletteEl.children].forEach((el, i) => el.classList.toggle('active', i === colorIndex));
}

function setTool(next) {
  tool = next;
  for (const b of toolsEl.querySelectorAll('.tool[data-tool]')) {
    b.classList.toggle('active', b.dataset.tool === next);
  }
  canvas.style.cursor = next === 'erase' ? 'not-allowed' : 'crosshair';
}

// The tool buttons only had `.active` styling wired up — clicking them did
// nothing, and the only way to switch tools was the B / E / P keys. Delegated
// here so all four (build, erase, paint, line) work by click too.
toolsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.tool[data-tool]');
  if (b) setTool(b.dataset.tool);
});

let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
}

/* ------------------------------------------------------------- undo stack */

function pushUndo(snapshot) {
  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  refreshUndoButtons();
}

function refreshUndoButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(town.snapshot());
  town.restore(undoStack.pop());
  view.changed();
  refreshUndoButtons();
  scheduleHash();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(town.snapshot());
  town.restore(redoStack.pop());
  view.changed();
  refreshUndoButtons();
  scheduleHash();
}

function beginStroke() {
  strokeSnapshot = town.snapshot();
  strokeEdits = new Set();
  strokeChanged = false;
}

function endStroke() {
  if (strokeChanged && strokeSnapshot) {
    pushUndo(strokeSnapshot);
    scheduleHash();
  }
  strokeSnapshot = null;
  strokeEdits = null;
  strokeChanged = false;
}

/* --------------------------------------------------------------- editing */

function applyAt(hit, activeTool) {
  if (!hit) return;
  const cell = hit.cell;
  const key = `${cell.id}:${activeTool}`;
  if (strokeEdits.has(key)) return;

  const top = town.top(cell);
  const level = Math.max(1, Math.min(MAX_HEIGHT, hit.level || top || 1));

  if (activeTool === 'line') {
    // Drag-to-paint along a topologically straight run (1384958097542819845).
    // The run comes from src/trace.js: enter a cell, leave through the edge most
    // parallel to the one you crossed — so the painted band stays straight on an
    // irregular grid instead of following the screen.
    const run = view.runForCell(cell.id);
    if (!run) return;
    let touched = 0;
    for (const id of run.cells) {
      const c = grid.cells[id];
      if (!c || town.top(c) === 0) continue;
      if (town.colors[id] !== colorIndex) { town.setColor(c, colorIndex); touched++; }
      if (town.roofColors[id] !== colorIndex) { town.setRoofColor(c, colorIndex); touched++; }
    }
    if (!touched) return;
    strokeEdits.add(key);
    strokeChanged = true;
    view.changed();
    return;
  }

  if (activeTool === 'build') {
    // Fill the clicked empty level, otherwise stack on top of the column.
    const target = !town.isSolid(cell, level) ? level : Math.min(MAX_HEIGHT, top + 1);
    if (target < 1 || town.isSolid(cell, target)) return;
    town.setSolid(cell, target, true);
    // new blocks take the selected colour (the quay level stays stone)
    if (target >= 2) town.setColor(cell, colorIndex);
  } else if (activeTool === 'erase') {
    // Right-click punches a single cube out; the ones above are left standing
    // and get a steel substructure (or an arch when both sides are supported), which is how arches and stilted towers are
    // made in the original.
    const target = town.isSolid(cell, level) ? level : top;
    if (!target) return;
    town.setSolid(cell, target, false);
  } else {
    // Clicking the top of a column paints its roof, further down paints the
    // wall — same rule as the original, and the reason roofs and walls can
    // differ.
    const onRoof = top > 0 && (hit.level || top) >= top;
    if (onRoof) {
      if (town.roofColors[cell.id] === colorIndex) return;
      town.setRoofColor(cell, colorIndex);
    } else {
      if (town.colors[cell.id] === colorIndex) return;
      town.setColor(cell, colorIndex);
    }
  }

  strokeEdits.add(key);
  strokeChanged = true;
  view.changed();
}

/* ---------------------------------------------------------------- pointer */

const pointers = new Map();
let mode = null;
let lastX = 0;
let lastY = 0;
let rightStart = null;
let pinchStart = 0;

const ndc = (e) => {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
};

function pickAtPointer(e) {
  const [x, y] = ndc(e);
  return view.pick(x, y);
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, e);
  lastX = e.clientX;
  lastY = e.clientY;

  if (pointers.size === 2) {
    // two fingers: orbit + pinch
    mode = 'orbit';
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    return;
  }

  if (e.button === 2) {
    // Decide on release: a click erases one cube, a drag orbits the camera.
    mode = 'right';
    rightStart = { x: e.clientX, y: e.clientY };
    return;
  }
  if (e.button === 1 || (e.button === 0 && e.altKey)) { mode = 'pan'; return; }

  mode = 'stroke';
  beginStroke();
  const active = e.shiftKey ? (tool === 'build' ? 'erase' : tool) : tool;
  applyAt(pickAtPointer(e), active);
});

canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  if (mode === 'right') {
    if (Math.hypot(e.clientX - rightStart.x, e.clientY - rightStart.y) <= 4) return;
    mode = 'orbit';
  }

  if (mode === 'orbit') {
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchStart > 0) {
        view.distance = clamp((view.distance * pinchStart) / Math.max(dist, 1), 8, 90);
        pinchStart = dist;
      }
      return;
    }
    view.yaw -= dx * 0.006;
    view.pitch = clamp(view.pitch + dy * 0.005, 0.1, 1.45);
    view.updateCamera();
    return;
  }

  if (mode === 'pan') {
    const scale = view.distance * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(view.camera.matrixWorld, 0);
    const forward = new THREE.Vector3().setFromMatrixColumn(view.camera.matrixWorld, 2);
    view.target.addScaledVector(right, -dx * scale);
    view.target.addScaledVector(forward, dy * scale * 0.9);
    view.updateCamera();
    return;
  }

  if (mode === 'stroke') {
    const active = e.shiftKey ? (tool === 'build' ? 'erase' : tool) : tool;
    applyAt(pickAtPointer(e), active);
    view.updateHover(pickAtPointer(e), active);
    return;
  }

  view.updateHover(pickAtPointer(e), tool);
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (mode === 'right') {
    // A right click with no drag: remove the cube under the cursor.
    const hit = pickAtPointer(e);
    if (hit && hit.level) {
      beginStroke();
      applyAt(hit, 'erase');
      endStroke();
    }
    mode = null;
  } else if (mode === 'stroke') {
    endStroke();
    if (pointers.size === 0) mode = null;
  }
  if (pointers.size === 0) mode = null;
  pinchStart = 0;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  if (mode === null) view.updateHover(null, tool);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.0011), 8, 90);
  view.updateCamera();
}, { passive: false });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* --------------------------------------------------------------- keyboard */

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '9') {
    colorIndex = Math.min(8, Number(k) - 1);
    refreshPaletteSelection();
    if (tool === 'erase') setTool('build');
    return;
  }
  if (k === 'b') setTool('build');
  else if (k === 'e') setTool('erase');
  else if (k === 'p') setTool('paint');
  else if (k === 'l') setTool('line');
  else if (k === 'z') undo();
  else if (k === 'y') redo();
  else if (k === 'r') { generateDemo(town); view.changed(); pushUndo(town.snapshot()); scheduleHash(); }
  else if (k === 'c') { town.reset(); view.changed(); pushUndo(town.snapshot()); scheduleHash(); }
  else if (k === 'n') cycleTimeOfDay();
  else if (k === 'h' || k === '?') helpEl.classList.toggle('hidden');
});

/* ------------------------------------------------------------------ hash */

let hashTimer = 0;
function scheduleHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try {
      const code = encodeTown(town);
      history.replaceState(null, '', '#' + code);
    } catch {
      /* ignore */
    }
  }, 350);
}

function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return false;
  try {
    decodeTown(decodeURIComponent(raw), town);
    return true;
  } catch (err) {
    console.warn('save string rejected:', err.message);
    return false;
  }
}

/* ------------------------------------------------------------------- boot */

if (!readHash()) generateDemo(town, 20261031, 0);
view.changed();
view.frameTown();
buildPalette();
setTool('build');
refreshUndoButtons();

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);

document.getElementById('demo').addEventListener('click', () => {
  pushUndo(town.snapshot());
  generateDemo(town);
  view.changed();
  view.frameTown();
  scheduleHash();
  toast('已生成示例城镇');
});

document.getElementById('clear').addEventListener('click', () => {
  pushUndo(town.snapshot());
  town.reset();
  view.changed();
  scheduleHash();
  toast('已清空');
});

document.getElementById('share').addEventListener('click', async () => {
  const code = encodeTown(town);
  const url = `${location.origin}${location.pathname}#${code}`;
  try {
    await navigator.clipboard.writeText(url);
    toast(`分享链接已复制（${code.length} 字符）`);
  } catch {
    toast('复制失败，链接已写入地址栏');
  }
  history.replaceState(null, '', '#' + code);
});

document.getElementById('help').addEventListener('click', () => helpEl.classList.toggle('hidden'));
document.getElementById('helpclose').addEventListener('click', () => helpEl.classList.add('hidden'));

const TIMES = ['day', 'dusk', 'night'];
const TIME_NAMES = { day: '白天', dusk: '黄昏', night: '夜晚' };
function cycleTimeOfDay() {
  const next = TIMES[(TIMES.indexOf(view.timeOfDay) + 1) % TIMES.length];
  view.setTimeOfDay(next);
  toast(`光照：${TIME_NAMES[next]}`);
}
document.getElementById('timeofday')?.addEventListener('click', cycleTimeOfDay);

const PALETTE_ORDER = ['town', 'pastel', 'dusk'];
document.getElementById('palettestyle').addEventListener('click', () => {
  const i = PALETTE_ORDER.indexOf(paletteName);
  paletteName = PALETTE_ORDER[(i + 1) % PALETTE_ORDER.length];
  town.palette = PALETTES[paletteName];
  view.townMesh.invalidate();
  view.changed();
  buildPalette();
  toast(`配色：${town.palette.name}`);
});

addEventListener('resize', () => { view.resize(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  view.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expose for debugging / tests
mountLearnPanel(view, town);

window.reaTown = {
  town, grid, view, encodeTown, decodeTown, generateDemo,
  // step-0 half-edge layer (src/halfedge.js) plus its validation counters
  get halfEdge() { return view.halfEdge; },
  get halfEdgeStats() { return view.halfEdgeStats; },
  get halfEdgeArrows() { return view.halfEdgeArrows; },
};
