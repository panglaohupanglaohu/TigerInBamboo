/**
 * app.js — 入口：建网格和世界、切场景、输入、撤销、存档、学习面板。
 *
 * 对应原作 Placemaker.Maker：每一笔拖动是一条 Action，撤销 / 重做走同一个快照路径。
 */

import * as THREE from 'three';
import { buildQuadGrid, buildMixedGrid } from '../core/grid.js';
import { decorateCells, buildCellIndex } from '../core/spatial.js';
import { World, MAX_LEVEL } from '../core/world.js';
import { PALETTES } from '../core/palette.js';
import { View } from './view.js';
import { SCENES, buildScene } from './scenes.js';
import { applyBadNorthTheme } from '../badnorth/theme.js';
import { Battle } from '../badnorth/battle.js';
import { encodeWorld, decodeWorld, peekGridRadius } from './save.js';
import { mountLearnPanel } from '../ui/learnpanel.js';
import { mountWalkthrough } from '../ui/walkthrough.js';

// 两种网格（共用全部管线）：
//   quad   Townscaper：三角点阵 → 合并 → 细分 → 松弛，全是四边形（1147881669350891521）
//   mixed  第三个项目：三角点阵 → 合并 → 不细分 → 松弛，三角格 + 方格（1447494168448753667）
const GRIDS = {
  quad: { name: '四边形', note: 'Townscaper', build: () => buildQuadGrid({ radius: 14, hexSize: 1.0 }), radius: 14 },
  mixed: { name: '三角 + 方格', note: '第三个项目', build: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }), radius: 22 },
};
const LEVEL = 0.5;           // 一层的高度

const canvas = document.getElementById('view');
const paletteEl = document.getElementById('palette');
const toolsEl = document.getElementById('tools');
const toastEl = document.getElementById('toast');
const helpEl = document.getElementById('helpcard');
const sceneEl = document.getElementById('scenes');

const params0 = new URLSearchParams(location.search);
let gridKind = GRIDS[params0.get('grid')] ? params0.get('grid') : 'quad';
// 分享链接里没写 ?grid= 时，按存档头里的网格半径判断
if (!params0.get('grid') && location.hash.length > 1) {
  const r = peekGridRadius(decodeURIComponent(location.hash.slice(1)));
  for (const [k, g] of Object.entries(GRIDS)) if (g.radius === r) gridKind = k;
}
const grid = decorateCells(GRIDS[gridKind].build());
const index = buildCellIndex(grid);
const world = new World(grid);
world.palette = PALETTES.town;
const view = new View(canvas, world, grid, index, { levelHeight: LEVEL });

let scene = 'town';
let seed = 7;
let tool = 'build';
let colorIndex = 0;
let paletteName = 'town';
const undoStack = [], redoStack = [];

/* ---- 界面 ---------------------------------------------------------------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 1700);
}

function buildPalette() {
  paletteEl.replaceChildren();
  world.palette.colors.forEach((hex, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === colorIndex ? ' active' : '');
    b.style.background = hex;
    b.title = `颜色 ${i + 1}`;
    // 选色只选颜色：建造继续建造（用这个颜色），刷色继续刷色；只有拆除会切回建造
    b.onclick = () => { colorIndex = i; if (tool === 'erase') setTool('build'); refreshPalette(); };
    paletteEl.appendChild(b);
  });
}
const refreshPalette = () => [...paletteEl.children].forEach((el, i) => el.classList.toggle('active', i === colorIndex));

function setTool(t) {
  tool = t;
  for (const b of toolsEl.querySelectorAll('.tool[data-tool]')) b.classList.toggle('active', b.dataset.tool === t);
  canvas.style.cursor = t === 'erase' ? 'not-allowed' : 'crosshair';
}

function buildSceneBar() {
  sceneEl.replaceChildren();
  // 网格切换（换网格要重建世界：带着场景名重新载入页面）
  const gsw = document.createElement('div');
  gsw.className = 'gridswitch';
  for (const [k, g] of Object.entries(GRIDS)) {
    const b = document.createElement('button');
    b.className = k === gridKind ? 'active' : '';
    b.textContent = g.name;
    b.title = `${g.note} 的网格`;
    b.onclick = () => { if (k !== gridKind) location.href = `${location.pathname}?grid=${k}&scene=${scene}`; };
    gsw.appendChild(b);
  }
  sceneEl.appendChild(gsw);
  const wb = document.createElement('button');
  wb.className = 'scene walkbtn';
  wb.innerHTML = '<b>▶ 完整管线示例</b><small>一步加一层，12 步</small>';
  wb.onclick = () => walk.open();
  sceneEl.appendChild(wb);
  for (const [k, s] of Object.entries(SCENES)) {
    const b = document.createElement('button');
    b.className = 'scene' + (k === scene ? ' active' : '');
    b.innerHTML = `<b>${s.name}</b><small>${s.note}</small>`;
    b.onclick = () => loadScene(k, true);
    sceneEl.appendChild(b);
  }
}

function loadScene(name, record) {
  if (record) pushUndo(world.snapshot());
  sceneStart = undoStack.length;
  scene = name;
  buildScene(world, name, seed);
  view.changed();
  view.frameTown();
  buildSceneBar();
  setTimeout(syncBadNorth, 0);   // 在学习面板按场景重置图层之后再套北境
  scheduleHash();
  window.dispatchEvent(new CustomEvent('scenechange', { detail: name }));
}

/* ---- 撤销 ---------------------------------------------------------------- */
function pushUndo(s) {
  undoStack.push(s);
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  refreshUndo();
}
function refreshUndo() {
  document.getElementById('undo').disabled = !undoStack.length;
  document.getElementById('redo').disabled = !redoStack.length;
}
/* 回放（1260586697538113537 "I can use the undo/redo stack for snappier and more directed building footage"）：
 * 从这个场景载入后的第一步开始，按撤销栈一步一步重放到当前状态；每一步照常触发弹出动画、水花、音效。 */
let sceneStart = 0, replaying = false;
async function replay() {
  if (replaying) return;
  const frames = undoStack.slice(sceneStart).concat([world.snapshot()]);
  if (frames.length < 2) { toast('先盖几块再回放'); return; }
  replaying = true;
  toast(`回放 ${frames.length - 1} 步`);
  for (const f of frames) { world.restore(f); view.changed(); await new Promise((r) => setTimeout(r, 380)); }
  replaying = false;
}

function undo() { if (!undoStack.length) return; redoStack.push(world.snapshot()); world.restore(undoStack.pop()); view.changed(); refreshUndo(); scheduleHash(); }
function redo() { if (!redoStack.length) return; undoStack.push(world.snapshot()); world.restore(redoStack.pop()); view.changed(); refreshUndo(); scheduleHash(); }

/* ---- 编辑 ---------------------------------------------------------------- */
let stroke = null;
function beginStroke() { stroke = { snap: world.snapshot(), edits: new Set(), changed: false }; }
function endStroke() { if (stroke?.changed) { pushUndo(stroke.snap); scheduleHash(); } stroke = null; }

function applyAt(hit, t) {
  if (!hit || !stroke) return;
  const cell = hit.cell;
  const key = `${cell.id}:${t}`;
  if (stroke.edits.has(key)) return;
  const top = world.top(cell);
  const level = Math.max(1, Math.min(MAX_LEVEL, hit.level || top || 1));
  if (t === 'build') {
    // 点到的那层是空的就填它（拱、悬空），否则往上叠一层；新方块用当前颜色
    const target = !world.isSolid(cell, level) ? level : Math.min(MAX_LEVEL, top + 1);
    if (target < 1 || world.isSolid(cell, target)) return;
    world.setSolid(cell, target, true);
    if (target >= 2 || world.ground(cell) > 0) world.color[cell.id] = colorIndex;
  } else if (t === 'erase') {
    // 只扣掉一个体素：上面的留着，由钢架 / 拱托住；地形也能挖
    const target = world.isSolid(cell, level) ? level : top;
    if (!target) return;
    world.setSolid(cell, target, false);
    if (!world.ground(cell)) world.river[cell.id] = 0;
  } else {
    if (world.color[cell.id] === colorIndex) return;
    world.color[cell.id] = colorIndex;
    world.touch();
  }
  stroke.edits.add(key);
  stroke.changed = true;
  view.changed();
}

/* ---- 指针 ---------------------------------------------------------------- */
const pointers = new Map();
let mode = null, lastX = 0, lastY = 0, rightStart = null, pinch = 0;
const ndc = (e) => {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
};
const pickAt = (e) => view.pick(...ndc(e));
const activeTool = (e) => (e.shiftKey ? (tool === 'build' ? 'erase' : tool) : tool);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, e);
  lastX = e.clientX; lastY = e.clientY;
  if (pointers.size === 2) {
    mode = 'orbit';
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    return;
  }
  if (e.button === 2) { mode = 'right'; rightStart = { x: e.clientX, y: e.clientY }; return; }
  if (e.button === 1 || (e.button === 0 && e.altKey)) { mode = 'pan'; return; }
  if (scene === 'badnorth' && e.button === 0 && battle.onPointer(pickAt(e))) { mode = null; return; }
  mode = 'stroke';
  beginStroke();
  applyAt(pickAt(e), activeTool(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (mode === 'right') {
    if (Math.hypot(e.clientX - rightStart.x, e.clientY - rightStart.y) <= 4) return;
    mode = 'orbit';
  }
  if (mode === 'orbit') {
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch > 0) { view.distance = clamp((view.distance * pinch) / Math.max(d, 1), 6, 90); pinch = d; view.updateCamera(); }
      return;
    }
    view.yaw -= dx * 0.006;
    view.pitch = clamp(view.pitch + dy * 0.005, 0.1, 1.45);
    view.updateCamera();
    return;
  }
  if (mode === 'pan') {
    const s = view.distance * 0.0016;
    view.target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(view.camera.matrixWorld, 0), -dx * s);
    view.target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(view.camera.matrixWorld, 2), dy * s * 0.9);
    view.updateCamera();
    return;
  }
  const hit = pickAt(e);
  if (mode === 'stroke') applyAt(hit, activeTool(e));
  view.updateHover(hit, mode === 'stroke' ? activeTool(e) : tool);
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (mode === 'right') {
    const hit = pickAt(e);
    if (hit && hit.level) { beginStroke(); applyAt(hit, 'erase'); endStroke(); }
  } else if (mode === 'stroke') endStroke();
  if (pointers.size === 0) mode = null;
  pinch = 0;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!mode) view.updateHover(null, tool); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.0011), 6, 90);
  view.updateCamera();
}, { passive: false });

/* ---- 键盘 ---------------------------------------------------------------- */
const TIMES = ['day', 'dusk', 'night'];
const TIME_NAMES = { day: '白天', dusk: '黄昏', night: '夜晚' };
function cycleTime() {
  const next = TIMES[(TIMES.indexOf(view.timeOfDay) + 1) % TIMES.length];
  view.setTimeOfDay(next);
  toast(`光照：${TIME_NAMES[next]}`);
}
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (scene === 'badnorth' && k === ' ') { e.preventDefault(); battle.togglePause(); return; }
  if (scene === 'badnorth' && k >= '1' && k <= '6') { const names = ['summer', 'dawn', 'rain', 'dusk', 'night', 'autumn']; applyBadNorthTheme(view, names[+k - 1]); toast('北境 · ' + names[+k - 1]); return; }
  if (k >= '1' && k <= '9') { colorIndex = Number(k) - 1; refreshPalette(); if (tool === 'erase') setTool('build'); return; }
  if (k === 'b') setTool('build');
  else if (k === 'e') setTool('erase');
  else if (k === 'p') setTool('paint');
  else if (k === 'z') undo();
  else if (k === 'y') redo();
  else if (k === 'n') cycleTime();
  else if (k === 'r') { seed = (Math.random() * 1e6) | 0; loadScene(scene, true); toast('换了一个种子'); }
  else if (k === 'c') { pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); }
  else if (k === 't') loadScene('town', true);
  else if (k === 'g') loadScene('terrain', true);
  else if (k === 'f') loadScene('fusion', true);
  else if (k === 'h' || k === '?') helpEl.classList.toggle('hidden');
});

/* ---- 地址栏存档 ------------------------------------------------------------ */
function scheduleHash() {
  clearTimeout(scheduleHash.t);
  scheduleHash.t = setTimeout(() => {
    try { history.replaceState(null, '', location.pathname + location.search + '#' + encodeWorld(world, scene)); } catch { /* 忽略 */ }
  }, 350);
}

/* ---- 北境（Bad North）：主题 + 玩法层 ------------------------------------- */
const battle = new Battle(view);
view.onFrame = (dt) => battle.update(dt);
let bnOn = false;
function syncBadNorth() {
  if (scene === 'badnorth') {
    applyBadNorthTheme(view, 'summer');
    // 北境没有云、海鸥、观光船、彩旗绳（官网截图里都没有）
    for (const k of ['clouds', 'birds', 'boats', 'wires', 'flags', 'butterflies']) view.setDebug(k, false);
    // 等植被 / 导航刷新完（view 里是 450 ms 的防抖）再开局
    setTimeout(() => { if (scene === 'badnorth') battle.start(world); }, 600);
    bnOn = true;
  } else if (bnOn) {
    battle.stop();
    applyBadNorthTheme(view, null);
    for (const k of ['birds', 'boats', 'wires', 'flags', 'butterflies']) view.setDebug(k, true);
    bnOn = false;
  }
}

/* ---- 启动 ---------------------------------------------------------------- */
const params = new URLSearchParams(location.search);
let restored = false;
if (location.hash.length > 1) {
  try { scene = decodeWorld(decodeURIComponent(location.hash.slice(1)), world); restored = true; } catch (err) { console.warn('存档读取失败：', err.message); }
}
if (!restored) { scene = SCENES[params.get('scene')] ? params.get('scene') : 'town'; buildScene(world, scene, seed); }
view.changed();
view.frameTown();
buildPalette();
setTimeout(syncBadNorth, 50);
buildSceneBar();
setTool('build');
refreshUndo();

document.getElementById('undo').onclick = undo;
document.getElementById('redo').onclick = redo;
document.getElementById('replay').onclick = replay;
document.getElementById('exportobj').onclick = async () => { const { downloadOBJ } = await import('../tools/objexport.js'); downloadOBJ(view.worldMesh.geometry, `town-${Date.now() % 1e6}.obj`); };
document.getElementById('demo').onclick = () => { seed = (Math.random() * 1e6) | 0; loadScene(scene, true); toast(`新的${SCENES[scene].name}`); };
document.getElementById('clear').onclick = () => { pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); toast('已清空'); };
document.getElementById('share').onclick = async () => {
  const code = encodeWorld(world, scene);
  const url = `${location.origin}${location.pathname}?grid=${gridKind}#${code}`;
  try { await navigator.clipboard.writeText(url); toast(`分享链接已复制（${code.length} 字符）`); } catch { toast('复制失败，链接已写入地址栏'); }
  history.replaceState(null, '', '#' + code);
};
document.getElementById('help').onclick = () => helpEl.classList.toggle('hidden');
document.getElementById('helpclose').onclick = () => helpEl.classList.add('hidden');
document.getElementById('timeofday').onclick = cycleTime;
const PALETTE_ORDER = ['town', 'pastel', 'dusk'];
document.getElementById('palettestyle').onclick = () => {
  paletteName = PALETTE_ORDER[(PALETTE_ORDER.indexOf(paletteName) + 1) % PALETTE_ORDER.length];
  world.palette = PALETTES[paletteName];
  view.changed();
  buildPalette();
  toast(`配色：${world.palette.name}`);
};
addEventListener('resize', () => view.resize());

let last = performance.now();
requestAnimationFrame(function frame(now) {
  view.render(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
});

mountLearnPanel(view, world, { getScene: () => scene, loadScene: (s) => loadScene(s, true) });
const walk = mountWalkthrough({
  view, world,
  // 示例里换场景不进撤销栈；同一个种子 → 地形几步和融合几步是同一座岛
  loadSceneQuiet: (s) => { seed = 7; buildScene(world, s, seed); view.changed(); view.frameTown(); scene = 'fusion'; buildSceneBar(); },
  getGridKind: () => gridKind,
  onExit: () => { scene = 'fusion'; buildSceneBar(); scheduleHash(); },
});
if (params.get('walk')) walk.open();
window.rea = { world, grid, gridKind, view, walk, get battle() { return battle; }, loadScene: (s) => loadScene(s, true), get scene() { return scene; }, encodeWorld, decodeWorld };
