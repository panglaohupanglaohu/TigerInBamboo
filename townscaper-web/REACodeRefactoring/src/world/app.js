/**
 * app.js — 入口：建网格和世界、切场景、输入、撤销、存档、学习面板。
 *
 * 对应原作 Placemaker.Maker：每一笔拖动是一条 Action，撤销 / 重做走同一个快照路径。
 */

import * as THREE from 'three';
import { buildQuadGrid, buildMixedGrid } from '../core/grid.js';
import { decorateCells, buildCellIndex } from '../core/spatial.js';
import { World, MAX_LEVEL } from '../core/world.js';
import { PALETTES, withPaletteColors } from '../core/palette.js';
import { View } from './view.js';
import { SCENES, buildScene } from './scenes.js';
import { applyBadNorthTheme } from '../badnorth/theme.js';
import { Battle } from '../badnorth/battle.js';
import { encodeWorld, decodeWorld, peekGridRadius } from './save.js';
import { mountLearnPanel } from '../ui/learnpanel.js';
import { replaySnapshots, replayDelay } from '../core/snapshot-replay.js';
import { mountEnvironmentPanel } from '../ui/environment-panel.js';
import { mountWalkthrough } from '../ui/walkthrough.js';
import { toggleSplice } from '../build/splice.js';

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
if (['hex', 'square', 'tri'].includes(params0.get('grid'))) Object.assign(GRIDS, (await import('../core/grid-kinds-c08.js')).PURE_GRIDS);   // r56 C08: pure grid kinds (1670790425232175108), default off
let gridKind = GRIDS[params0.get('grid')] ? params0.get('grid') : 'quad';
// 分享链接里没写 ?grid= 时，按存档头里的网格半径判断
if (!params0.get('grid') && location.hash.length > 1) {
  try {
    const r = peekGridRadius(decodeURIComponent(location.hash.slice(1)));
    for (const [k, g] of Object.entries(GRIDS)) if (g.radius === r) gridKind = k;
  } catch (err) { console.warn('分享链接头读取失败：', err.message); }
}
// r56 C06：1301816247479345152 在生成网格上随机撒手工模板补丁（?gems=N，默认关；core/grid-gems-c06.js）
const grid = decorateCells(params0.get('gems') ? (await import('../core/grid-gems-c06.js')).sprinkleGems(GRIDS[gridKind].build(), { count: Math.min(12, Number(params0.get('gems')) || 4), seed: Number(params0.get('gemSeed')) || 11 }) : GRIDS[gridKind].build());
const index = buildCellIndex(grid);
const world = new World(grid);
world.palette = PALETTES.town;
const view = new View(canvas, world, grid, index, { levelHeight: LEVEL });
// 逐帧覆盖验收入口：浏览器测试要能直接开关调试层（flow / flowunit 等）并读回统计，
// 不用去点面板里的复选框。只读句柄，不改变任何默认行为。
globalThis.reaView = view;

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
  if (replaying) return;
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
  if (undoStack.length > 60) { undoStack.shift(); sceneStart = Math.max(0, sceneStart - 1); }
  redoStack.length = 0;
  refreshUndo();
}
function refreshUndo() {
  document.getElementById('undo').disabled = !undoStack.length;
  document.getElementById('redo').disabled = !redoStack.length;
}
/* 1260586697538113537: history footage. Snapshot timing is local; not recovered
 * per-action animation/splash metadata. Keep history intact and support cancellation. */
let sceneStart = 0, replaying = false, replayAbort = null;
async function replay() {
  if (replaying) { replayAbort.abort(); return; }
  endStroke();
  const frames = undoStack.slice(sceneStart).concat([world.snapshot()]);
  if (frames.length < 2) { toast('先盖几块再回放'); return; }
  clearTimeout(scheduleHash.t);
  replaying = true; replayAbort = new AbortController(); mode = null; pointers.clear();
  const button = document.getElementById('replay');
  button.textContent = '■'; button.title = '停止回放并恢复（Esc）';
  toast(`回放 ${frames.length - 1} 步 · 再次点击停止`);
  try {
    await replaySnapshots(world, frames, { apply: () => view.changed(), wait: signal => replayDelay(+(params.get('replayMs') ?? 380) || 380, signal), signal: replayAbort.signal });
  } catch (err) { console.error('回放失败', err); toast('回放失败，已恢复当前岛'); }
  finally {
    replaying = false; replayAbort = null; button.textContent = '⟲';
    button.title = '回放建造过程'; refreshUndo(); scheduleHash();
  }
}

function undo() { if (replaying || !undoStack.length) return; redoStack.push(world.snapshot()); world.restore(undoStack.pop()); view.changed(); refreshUndo(); scheduleHash(); }
function redo() { if (replaying || !redoStack.length) return; undoStack.push(world.snapshot()); world.restore(redoStack.pop()); view.changed(); refreshUndo(); scheduleHash(); }

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
  } else if (t === 'splice') {
    // 1584623053061099520 嵌入房子工具（?tool=splice 或 I 键）：点裸露岩顶嵌入 / 再点移除；走同一快照撤销栈与存档尾段
    if (!toggleSplice(world, cell)) return;
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
  if (replaying) return;
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
  if (replaying) { if (e.key === 'Escape') replayAbort.abort(); return; }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target.isContentEditable) return;
  const k = e.key.toLowerCase();
  if (scene === 'badnorth' && k === ' ') { e.preventDefault(); battle.togglePause(); return; }
  if (scene === 'badnorth' && k >= '1' && k <= '6') { const names = ['summer', 'dawn', 'rain', 'dusk', 'night', 'autumn']; applyBadNorthTheme(view, names[+k - 1]); toast('北境 · ' + names[+k - 1]); return; }
  if (k >= '1' && k <= '9') { colorIndex = Number(k) - 1; refreshPalette(); if (tool === 'erase') setTool('build'); return; }
  if (k === 'b') setTool('build');
  else if (k === 'e') setTool('erase');
  else if (k === 'p') setTool('paint');
  else if (k === 'i') { setTool('splice'); toast('嵌入房子：点裸露岩顶嵌入 / 再点移除'); }
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
view.battle = battle;
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
setTool(params.get('tool') === 'splice' ? 'splice' : 'build');
refreshUndo();

document.getElementById('undo').onclick = undo;
document.getElementById('redo').onclick = redo;
document.getElementById('replay').onclick = replay;
document.getElementById('exportobj').onclick = async () => { const { downloadOBJ } = await import('../tools/objexport.js'); downloadOBJ(view.worldMesh.geometry, `town-${Date.now() % 1e6}.obj`); };
document.getElementById('demo').onclick = () => { if (replaying) return; seed = (Math.random() * 1e6) | 0; loadScene(scene, true); toast(`新的${SCENES[scene].name}`); };
document.getElementById('clear').onclick = () => { if (replaying) return; pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); toast('已清空'); };
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
  if (replaying) return;
  paletteName = PALETTE_ORDER[(PALETTE_ORDER.indexOf(paletteName) + 1) % PALETTE_ORDER.length];
  world.palette = PALETTES[paletteName];
  view.changed();
  buildPalette();
  toast(`配色：${world.palette.name}`);
};
addEventListener('resize', () => view.resize());

let last = performance.now();
requestAnimationFrame(function frame(now) {
  view.render(Math.max(0, Math.min(0.05, (now - last) / 1000)));
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
const setWallPalette=(colors)=>{if(replaying)return;world.palette=withPaletteColors(world.palette,colors);view.changed();buildPalette();};
window.rea = { world, grid, gridKind, view, walk, setWallPalette, get battle() { return battle; }, loadScene: (s) => loadScene(s, true), get scene() { return scene; }, get replaying() { return replaying; }, encodeWorld, decodeWorld };

mountEnvironmentPanel(view, { getScene: () => scene });
// 第 56 批 C03 · 807256278154301441 便宜的群体寻路（紫色螃蟹点沿屋顶/台阶成群走）：默认关，?crabs=1 打开
// 第 56 批 C03 · 793545297376972801 多格 WFC 解写进共享 World（外观交给共享建筑管线）：默认关，?multitile=<种子> 打开
if (params.get('multitile')) import('../build/multitile-world.js').then((m) => { window.rea.multitile = m.buildMultitileTower(world, index, { seed: Number(params.get('multitile')) || 3, size: [5, Number(params.get('mth')) || 8, 5] }); view.changed(); });
if (params.get('crabs')) import('../life/crab-swarm.js').then((m) => { window.rea.crabs = m.attachCrabSwarm(view, world); });
// 1246074663546916873 道具出现/消失弹簧动画（world/prop-anim-layer.js）：默认关，?propanim=1 打开
if (params.get('propanim')) import('./prop-anim-layer.js').then((m) => { window.rea.propAnim = m.attachPropAnim(view, world); });
// r56 C05·C：1205422438437273601 门窗模板挖洞（?punch=1）；1275089608758484992 教堂高拱龛（?churchDoors=1）；806904557502464000 运河拱桥（?canalBridges=1）——默认全关
if (params.get('punch')) import('../render/opening-punch-layer.js').then((m) => { window.rea.punch = m.attachOpeningPunch(view); });
for (const f of ['churchDoors', 'canalBridges']) if (params.get(f)) { world[f] = true; world.touch(); view.worldMesh?.invalidate?.(); }
// 1371460793032716290 Palette.png 热重载（world/palette-png.js，C05 r56）：默认关，?palettePng=[url] 打开，下行 = 墙色槽
if (params.get('palettePng') !== null) import('./palette-png.js').then((m) => { window.rea.palettePng = m.watchPalettePng(params.get('palettePng') || 'palettes/Palette.png', (row) => setWallPalette(world.palette.colors.map((c, i) => row[i] ?? c)), { getColors: () => world.palette.colors, wallRow: +(params.get('paletteRow') ?? 1) }); });
// r56 C05·D：1257213678056857600/1189902695303458816 钢架（?steelFrame=1）；1238474550511308800 后院矮墙拱门（?yardWalls=1）；1246074663546916873 后院真树出现/消失（?yardanim=1）——默认全关
for (const f of ['steelFrame', 'yardWalls']) if (params.get(f)) { world[f] = true; world.touch(); view.worldMesh?.invalidate?.(); }
if (params.get('yardanim')) import('./prop-anim-yard-r56.js').then((m) => { window.rea.yardAnim = m.attachYardPropAnim(view, world); });
// r56 C06：图标工具条/倾斜菜单/实时存档串（?gameui=1）+ 拓扑直线手柄光标/连刷（?topoline=1）——ui/game-ui-c06.js，默认关
if (params.get('gameui') || params.get('topoline')) import('../ui/game-ui-c06.js').then((m) => { window.rea.gameUI = m.mountGameUI({ world, grid, view, setTool, undo, redo, pushUndo, encodeWorld, decodeWorld, getScene: () => scene, scheduleHash }, { toolbar: !!params.get('gameui'), menu: !!params.get('gameui'), savestring: !!params.get('gameui'), topoline: !!params.get('topoline') }); });
// r56 C06：1313837640366596096 完美环飞岛（?flying=1，默认关）：环内整列体素抬高 + 细腿 + 外沿小构件——world/flying-town-c06.js
if (params.get('flying')) import('./flying-town-c06.js').then((m) => { window.rea.flying = m.attachFlyingTown(view, world, grid, { lift: Number(params.get('lift')) || 3, loop: Number(params.get('loop')) || 0 }); });
// r56 C10：1849732997945110651 全局水面泡沫遮罩（?c10=foammask）+ 1664565063552847873 绕岛染料流（?c10=fluid）——world/view-c10.js，默认关
if (params.get('c10')) import('./view-c10.js').then((m) => { window.rea.c10 = m.installC10(view, params.get('c10')); });

// Keep HUD edits out of the read-only playback; the same button stops it.
document.getElementById('hud').addEventListener('click', e => {
  if (replaying && !e.target.closest('#replay, [data-command="replay"]')) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
