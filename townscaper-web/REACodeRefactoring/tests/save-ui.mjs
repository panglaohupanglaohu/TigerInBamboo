// save.js 可选尾段 4（1198957499027795969 残差）：工具/色槽/镜头/选中态/撤销栈入档。
// 验收：往返逐位一致（saveMeta 回落 canonical）、旧串照读不误判、坏输入原子拒收、
// 新串喂旧解码器按「多余数据」拒收（内置旧尾链模拟器复刻 ≤5 位全零补尾判据）。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
import { World, MAX_LEVEL } from '../src/core/world.js';
import { PALETTES } from '../src/core/palette.js';
import { encodeWorld, decodeWorld } from '../src/world/save.js';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const TAU = Math.PI * 2;
function pack(parts) { const b = parts.map(([v, n]) => v.toString(2).padStart(n, '0')).join(''); return b.match(/.{1,6}/g).map((x) => alphabet[parseInt(x.padEnd(6, '0'), 2)]).join(''); }
// 8 格空岛的 v5 体素段：一条空游程记 [0,1][7,5][0,1]
const emptyVoxels = (scene = 0) => [[5, 3], [scene, 2], [1, 6], [0, 1], [7, 5], [0, 1]];
const make = (n) => { const w = new World({ radius: 1, cells: Array.from({ length: n }, (_, id) => ({ id, edgeNeighbors: [] })) }); w.palette = PALETTES.town; return w; };

/** 旧解码器尾链模拟器：读头 + 体素游程 + [流向][嵌入][meta] 三段标志，再按「≤5 位全零补尾」判据；返回 true=照收 / false=拒收。 */
function oldDecoderAccepts(str, n) {
  const bits = [];
  for (const ch of str) { const v = alphabet.indexOf(ch); for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1); }
  let p = 0;
  const read = (k) => { if (p + k > bits.length) return -1; let v = 0; for (let i = 0; i < k; i++) v = (v << 1) | bits[p++]; return v; };
  if (read(3) !== 5) return false;
  read(2); read(6);
  const river = new Uint8Array(n);
  for (let i = 0; i < n;) {
    if (read(1)) { read(MAX_LEVEL); read(MAX_LEVEL); read(5); river[i] = read(1); }
    let run = 0, more = 1;
    while (more) { run += read(5) + 1; more = read(1); }
    for (let k = 0; k < run; k++, i++) river[i] = river[i];
  }
  let padFrom = p;
  if (bits[p++] === 1) { for (let i = 0; i < n; i++) if (river[i]) read(3); padFrom = p; }
  if (bits[p++] === 1) {
    const W = Math.max(1, Math.ceil(Math.log2(n + 1))), count = read(W);
    for (let k = 0; k < count; k++) { read(W); read(6); read(2); read(6); }
    padFrom = p;
  }
  if (bits[p++] === 1) {
    if (read(3) !== 0) return false;
    if (read(1)) { const m = read(2); if (m === 0) { const c = read(5); for (let k = 0; k < c; k++) read(24); } }
    if (read(1)) { read(2); read(3); read(5); if (read(1)) { read(1); read(1); read(5); read(5); read(9); } }
    padFrom = p;
  }
  return bits.length - padFrom <= 5 && !bits.slice(padFrom).some(Boolean);
}

const snap = (w) => ({ solid: w.solid.slice(), rock: w.rock.slice(), color: w.color.slice(), river: w.river.slice(), spliced: null });
const CAM = { target: [1.23, -0.55, 33.7], yaw: 2.5, pitch: 0.62, distance: 30 };
const qCam = { target: CAM.target.map((v) => Math.round(v * 20) / 20), yaw: Math.round(CAM.yaw * 2048 / TAU) * TAU / 2048, pitch: Math.round(CAM.pitch * 255 / 1.6) * 1.6 / 255, distance: Math.round(CAM.distance * 10) / 10 };
const UI = { tool: 'paint', colorIndex: 4, camera: CAM, selection: [5, 0, 2], history: null };

/* ---- 1. 全字段 UI 段往返逐位一致：tool/colorIndex/camera/selection/history 全回 -------- */
{
  const a = make(8);
  a.solid[2] = 3; a.color[2] = 4; a.solid[5] = 1; a.color[5] = 0; a.rock[1] = 3; a.solid[1] = 3;
  const s0 = make(8); s0.solid[0] = 2; s0.color[0] = 1;                       // 撤销条目 0 的岛
  const s1 = make(8); s1.solid[0] = 2; s1.color[0] = 1; s1.solid[4] = 5; s1.color[4] = 3; s1.rock[1] = 3; s1.solid[1] = 3;
  const s1s = snap(s1); s1s.spliced = [[1, { inset: 0.2, stories: 2, sink: 0.1 }]];
  const meta = { palette: true, state: { timeOfDay: 'dusk' }, ui: { ...UI, history: { undo: [{ snapshot: snap(s0), selection: [0] }, { snapshot: s1s, selection: [1, 4] }], undoTruncated: true, redo: [{ snapshot: snap(s0) }], redoTruncated: false } } };
  const code = encodeWorld(a, 'town', meta);
  const b = make(8);
  assert.equal(decodeWorld(code, b), 'town');
  assert.deepEqual(b.snapshot().solid, a.snapshot().solid);
  const ui = b.saveMeta.ui;
  assert.equal(ui.tool, 'paint'); assert.equal(ui.colorIndex, 4);
  assert.deepEqual(ui.camera, qCam, '镜头量化值还原');
  assert.deepEqual(ui.selection, [0, 2, 5], '选中态升序还原');
  assert.equal(ui.history.undo.length, 2); assert.equal(ui.history.undoTruncated, true);
  assert.equal(ui.history.redo.length, 1); assert.equal(ui.history.redoTruncated, false);
  assert.deepEqual([...ui.history.undo[0].snapshot.solid], [...s0.solid]);
  assert.deepEqual(ui.history.undo[0].selection, [0]);
  assert.deepEqual(ui.history.undo[1].snapshot.spliced, [[1, { inset: 0.2, stories: 2, sink: 0.1 }]]);
  // 入档条目可直接喂 world.restore（撤销语义）
  b.restore(ui.history.undo[1].snapshot);
  assert.equal(b.splicedHouses.get(1).stories, 2); assert.equal(b.solid[4], 5);
  const b2 = make(8); decodeWorld(code, b2);
  assert.equal(encodeWorld(b2, 'town'), code, 'saveMeta 回落再编码逐位一致');
  assert.equal(encodeWorld(b2, 'town', meta), code, '显式同参再编码逐位一致');
}

/* ---- 2. ui-only：meta 三子段全缺席时 meta 标志 0 + UI 标志 1 ---------------------------- */
{
  const a = make(8); a.solid[3] = 2; a.color[3] = 1;
  const code = encodeWorld(a, 'town', { ui: { tool: 'select', colorIndex: 2, selection: [3, 1] } });
  const b = make(8); b.palette = PALETTES.pastel; b.flatRoofs = true;
  decodeWorld(code, b);
  assert.deepEqual(b.saveMeta, { palette: false, state: null, ui: { tool: 'select', colorIndex: 2, selection: [1, 3] } });
  assert.equal(b.palette, PALETTES.pastel, 'ui-only 串不动调色板');
  assert.equal(b.flatRoofs, true, 'ui-only 串不动世界开关');
  assert.equal(encodeWorld(b, 'town'), code, 'ui-only 串再编码逐位一致');
}

/* ---- 3. 旧串照读不误判：无 UI 段 → saveMeta.ui 空，串逐位回去 --------------------------- */
{
  const a = make(8); a.solid[3] = 7; a.rock[3] = 3; a.color[3] = 7;
  const legacy = encodeWorld(a, 'terrain', null);
  const metaOnly = encodeWorld(a, 'terrain', { palette: true });
  const b = make(8);
  decodeWorld(legacy, b);
  assert.equal(b.saveMeta, null, '旧串解出空 saveMeta');
  decodeWorld(metaOnly, b);
  assert.equal(b.saveMeta.ui, null, 'meta 串没有 ui 段');
  assert.equal(encodeWorld(b, 'terrain'), metaOnly, 'meta 串再编码逐位一致');
}

/* ---- 4. 版本互喂：新串喂旧解码器拒收、旧串喂旧解码器照收、UI 是追加尾段 ------------------ */
{
  const a = make(8); a.solid[1] = 1; a.color[1] = 0;
  const legacy = encodeWorld(a, 'town', null);
  const metaCode = encodeWorld(a, 'town', { palette: true, state: { timeOfDay: 'night' } });
  const uiOnly = encodeWorld(a, 'town', { ui: { tool: 'erase' } });
  const both = encodeWorld(a, 'town', { palette: true, ui: { tool: 'erase', colorIndex: 1 } });
  assert.equal(oldDecoderAccepts(legacy, 8), true, '旧解码器照收旧串');
  assert.equal(oldDecoderAccepts(metaCode, 8), true, '旧解码器照收 meta 串');
  assert.equal(oldDecoderAccepts(uiOnly, 8), false, '旧解码器按多余数据拒收 ui-only 串');
  assert.equal(oldDecoderAccepts(both, 8), false, '旧解码器按多余数据拒收 meta+ui 串');
}

/* ---- 5. 坏输入原子拒收：快照/版本/调色板/saveMeta 全不动 ---------------------------------- */
{
  const a = make(8); a.solid[0] = 1;
  const code = encodeWorld(a, 'town', { ui: UI });
  const b = make(8);
  const untouched = () => { const s = b.snapshot(), v = b.version, pal = b.palette, meta = b.saveMeta; return () => { assert.deepEqual(b.snapshot(), s); assert.equal(b.version, v); assert.equal(b.palette, pal); assert.equal(b.saveMeta, meta); }; };
  const uiTail = (parts) => pack([...emptyVoxels(), [0, 1], [0, 1], [0, 1], [1, 1], ...parts]);   // flow0 splice0 meta0 ui1
  const cases = [
    ['截断', code.slice(0, -2)],
    ['尾随', code + '1'],
    ['工具无效', uiTail([[7, 3], [0, 5], [0, 1], [0, 1], [0, 1]])],
    ['色槽越界', uiTail([[0, 3], [31, 5], [0, 1], [0, 1], [0, 1]])],
    ['镜头截半', uiTail([[0, 3], [0, 5], [1, 1], [0x1000, 14]]).slice(0, -1)],
    ['选中态数零', uiTail([[0, 3], [0, 5], [0, 1], [1, 1], [0, 4], [0, 1]])],
    ['选中态降序', uiTail([[0, 3], [0, 5], [0, 1], [1, 1], [2, 4], [3, 4], [1, 4], [0, 1]])],
    ['撤销数超限', uiTail([[0, 3], [0, 5], [0, 1], [0, 1], [1, 1], [9, 4], [0, 1]])],
    ['条目色槽越界', uiTail([[0, 3], [0, 5], [0, 1], [0, 1], [1, 1], [1, 4], [0, 1], [1, 1], [0, 12], [0, 12], [20, 5], [0, 1], [0, 5], [0, 1], [0, 1], [6, 5], [0, 1], [0, 1], [0, 1], [0, 4], [0, 1]])],
    ['条目选中降序', uiTail([[0, 3], [0, 5], [0, 1], [0, 1], [1, 1], [1, 4], [0, 1], [0, 1], [7, 5], [0, 1], [0, 1], [1, 1], [2, 4], [5, 4], [2, 4], [0, 4], [0, 1]])],
  ];
  for (const [name, input] of cases) { const chk = untouched(); assert.throws(() => decodeWorld(input, b), null, name); chk(); }
  // 编码侧参数越界也在写串前拒绝
  const w = make(8);
  assert.throws(() => encodeWorld(w, 'town', { ui: { tool: 'bogus' } }), /工具/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { colorIndex: 15 } }), /色槽序号/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { camera: { target: [0, 0, 0], yaw: 0, pitch: 2.0, distance: 30 } } }), /俯仰/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { camera: { target: [0, 0, 999], yaw: 0, pitch: 0.5, distance: 30 } } }), /目标/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { camera: { target: [0, 0, 0], yaw: 0, pitch: 0.5, distance: 200 } } }), /距离/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { selection: [99] } }), /格号/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { history: { undo: Array(9).fill({ snapshot: snap(w) }) } } }), /条目数/);
  assert.throws(() => encodeWorld(w, 'town', { ui: { history: { undo: [{ snapshot: { solid: new Uint16Array(4) } }] } } }), /快照/);
}

/* ---- 6. 三段 + UI 四段尾链共存：flow + spliced + meta + ui 全部往返 ---------------------- */
{
  const { spliceHouse, toggleSplice } = await import('../src/build/splice.js');
  const { generateTerrain } = await import('../src/terrain/generate.js');
  const w = new F.World(F.grid('quad')); w.palette = PALETTES.town;
  generateTerrain(w, { seed: 19, rivers: 2 });
  w.grid.radius = 14;
  assert.ok(w.riverFlow, 'fixture 地形应有河道流向');
  const ok = w.cells.filter((c) => spliceHouse(Object.create(w), c.id).ok).slice(0, 2);
  for (const c of ok) assert.equal(toggleSplice(w, c), true);
  const h0 = snap(w);
  const meta = { palette: true, state: { timeOfDay: 'bn', bnTheme: 'winter' }, ui: { tool: 'splice', colorIndex: 6, camera: CAM, selection: ok.map((c) => c.id), history: { undo: [{ snapshot: h0 }], undoTruncated: false, redo: [], redoTruncated: false } } };
  const code = encodeWorld(w, 'terrain', meta);
  const b = new F.World(w.grid);
  assert.equal(decodeWorld(code, b), 'terrain');
  assert.deepEqual(b.snapshot(), w.snapshot());
  assert.deepEqual([...b.splicedHouses].sort((x, y) => x[0] - y[0]), [...w.splicedHouses].sort((x, y) => x[0] - y[0]));
  const ui = b.saveMeta.ui;
  assert.equal(ui.tool, 'splice'); assert.equal(ui.colorIndex, 6);
  assert.deepEqual(ui.selection, ok.map((c) => c.id).sort((x, y) => x - y));
  assert.equal(ui.history.undo.length, 1);
  assert.deepEqual(ui.history.undo[0].snapshot.solid.length, w.solid.length);
  assert.equal(encodeWorld(b, 'terrain'), code, '四段齐全再编码逐位一致');
}

console.log('PASS save ui tail: tool/colorIndex/camera/selection/undo+redo roundtrip bitwise, legacy reads clean, forged inputs rejected atomically, old-decoder tail check rejects new strings');
