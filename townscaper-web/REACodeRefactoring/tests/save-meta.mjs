// save.js 可选尾段 3（1198957499027795969 残差）：自定义调色板 + 玩法/天气状态入档。
// 验收：往返逐位一致（saveMeta 回落 canonical）、旧串照读不误判、坏输入原子拒收、
// 三段尾链（flow+spliced+meta）共存、世界开关/调色板直接回写 world、视图侧字段走 world.saveMeta。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
import { World } from '../src/core/world.js';
import { PALETTES } from '../src/core/palette.js';
import { encodeWorld, decodeWorld } from '../src/world/save.js';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
function pack(parts) { const b = parts.map(([v, n]) => v.toString(2).padStart(n, '0')).join(''); return b.match(/.{1,6}/g).map((x) => alphabet[parseInt(x.padEnd(6, '0'), 2)]).join(''); }
// 8 格空岛的 v5 体素段：一条空游程记 [0,1][7,5][0,1]
const emptyVoxels = (scene = 0) => [[5, 3], [scene, 2], [1, 6], [0, 1], [7, 5], [0, 1]];
const make = (n) => { const w = new World({ radius: 1, cells: Array.from({ length: n }, (_, id) => ({ id, edgeNeighbors: [] })) }); w.palette = PALETTES.town; return w; };
const WEATHER = { snow: true, fog: true, fogOpacity: .45, fogSpeed: 1.3, windDeg: 270 };
const META = { palette: true, state: { timeOfDay: 'dusk', bnTheme: 'winter', weather: WEATHER } };

/* ---- 1. 自定义调色板 + 全字段状态：往返逐位一致，回写 world.palette/开关 ------------------ */
{
  const a = make(8);
  a.palette = { name: '自定义', colors: ['#112233', '#a4b5c6', '#ff0080', '#0a0b0c', '#deadbf'] };
  a.solid[2] = 3; a.color[2] = 4; a.solid[5] = 1; a.color[5] = 0;
  a.flatRoofs = true; a.canalBridges = true;
  const code = encodeWorld(a, 'badnorth', META);
  const b = make(8);
  assert.equal(decodeWorld(code, b), 'badnorth');
  assert.deepEqual(b.palette.colors, a.palette.colors, '自定义调色板逐色还原');
  assert.deepEqual(b.snapshot(), a.snapshot());
  assert.equal(b.flatRoofs, true); assert.equal(b.canalBridges, true); assert.equal(b.yardWalls, false);
  assert.deepEqual(b.saveMeta, { palette: true, state: { timeOfDay: 'dusk', bnTheme: 'winter', weather: WEATHER }, ui: null });
  assert.equal(encodeWorld(b, 'badnorth'), code, 'saveMeta 回落再编码逐位一致');
  assert.equal(encodeWorld(b, 'badnorth', META), code, '显式同参再编码逐位一致');
  // meta-only 尾段不会被读成 spliced/flow
  assert.equal(b.splicedHouses, null); assert.equal(b.riverFlow, undefined);
}

/* ---- 2. 预设调色板写序号：还原的是预设对象本身 ------------------------------------------- */
{
  const a = make(4); a.palette = PALETTES.dusk; a.solid[0] = 1; a.color[0] = 3;
  const code = encodeWorld(a, 'town', { palette: true });
  const b = make(4);
  decodeWorld(code, b);
  assert.equal(b.palette, PALETTES.dusk, '预设序号解回预设对象');
  assert.deepEqual(b.saveMeta, { palette: true, state: null, ui: null });
  assert.equal(encodeWorld(b, 'town'), code);
}

/* ---- 3. 色槽上限按解后生效调色板验：大自定义调色板放宽、小调色板拒绝 ---------------------- */
{
  const a = make(8);
  a.palette = { name: 'big', colors: Array.from({ length: 20 }, (_, i) => '#' + (0x100000 + i * 7).toString(16).padStart(6, '0')) };
  a.solid[1] = 1; a.color[1] = 18;   // 槽位 18 超出 b 当前的 15 色 town
  const code = encodeWorld(a, 'town', { palette: true });
  const b = make(8);                 // b.palette = PALETTES.town，只有 15 色
  decodeWorld(code, b);              // meta 带来的 20 色放行槽位 18
  assert.equal(b.color[1], 18); assert.equal(b.palette.colors.length, 20);
  // 同一段体素、不带调色板 → 槽位 18 超 15 色，拒收且不动岛
  const c = make(8);                 // 仍是 15 色 town
  const voxelOnly = encodeWorld(a, 'town', null);
  const before = c.snapshot(), v = c.version;
  assert.throws(() => decodeWorld(voxelOnly, c), /墙色色槽/);
  assert.deepEqual(c.snapshot(), before); assert.equal(c.version, v);
  // 体素槽位超出存档自带调色板 → 拒收（空岛 8 格 + 格0 用槽位5、存档只带 3 色）
  const slotTooHigh = pack([[5, 3], [0, 2], [1, 6], [1, 1], [1, 12], [0, 12], [6, 5], [0, 1], [0, 5], [0, 1], [0, 1], [6, 5], [0, 1],
    [0, 1], [0, 1], [1, 1], [0, 3], [1, 1], [0, 2], [3, 5], [0x112233, 24], [0x445566, 24], [0x778899, 24], [0, 1]]);
  assert.throws(() => decodeWorld(slotTooHigh, make(8)), /墙色色槽/);
  // 色数 0 的调色板段拒收
  assert.throws(() => decodeWorld(pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [1, 1], [0, 2], [0, 5], [0, 1]]), make(8)), /调色板色数/);
}

/* ---- 4. 旧串照读不误判：无 meta → saveMeta null、palette/开关不动 -------------------------- */
{
  const a = make(8); a.solid[3] = 7; a.rock[3] = 3; a.color[3] = 7;
  const legacy = encodeWorld(a, 'terrain', null);      // 显式不要尾段 = 旧格式
  const b = make(8); b.palette = PALETTES.pastel; b.flatRoofs = true;
  decodeWorld(legacy, b);
  assert.equal(b.saveMeta, null, '旧串解出空 saveMeta');
  assert.equal(b.palette, PALETTES.pastel, '存档没带调色板就保留现有');
  assert.equal(b.flatRoofs, true, '存档没带开关就保留现有');
  assert.equal(encodeWorld(b, 'terrain'), legacy, '旧串再编码逐位一致');
  // 先导入 meta 串、再导入旧串：saveMeta 复位，不残留上次导入状态
  const m = make(8); m.palette = PALETTES.dusk;
  decodeWorld(encodeWorld(m, 'town', META), b);
  assert.ok(b.saveMeta);
  const flagBefore = b.flatRoofs;   // meta 状态段已按串回写（m 没开 → false）
  decodeWorld(legacy, b);
  assert.equal(b.saveMeta, null); assert.equal(b.flatRoofs, flagBefore, '旧串不动世界开关');
  // 手工拼的最小 v5（无任何尾段）也读出 saveMeta null
  const c = make(8); decodeWorld(pack(emptyVoxels()), c); assert.equal(c.saveMeta, null);
}

/* ---- 5. 三段尾链共存：flow + spliced + meta 全部往返 ------------------------------------- */
{
  const { spliceHouse, toggleSplice } = await import('../src/build/splice.js');
  const { generateTerrain } = await import('../src/terrain/generate.js');
  const w = new F.World(F.grid('quad')); w.palette = PALETTES.town;
  generateTerrain(w, { seed: 19, rivers: 2 });
  w.grid.radius = 14;
  assert.ok(w.riverFlow, 'fixture 地形应有河道流向');
  const ok = w.cells.filter((c) => spliceHouse(Object.create(w), c.id).ok).slice(0, 3);
  for (const c of ok) assert.equal(toggleSplice(w, c), true);
  w.yardWalls = true;
  const code = encodeWorld(w, 'terrain', META);
  const b = new F.World(w.grid);
  assert.equal(decodeWorld(code, b), 'terrain');
  assert.deepEqual(b.snapshot(), w.snapshot());
  assert.deepEqual([...b.splicedHouses].sort((x, y) => x[0] - y[0]), [...w.splicedHouses].sort((x, y) => x[0] - y[0]));
  for (let i = 0; i < b.cells.length; i++) assert.equal(b.riverFlow.flowTo[i], w.river[i] ? w.riverFlow.flowTo[i] : -1);
  assert.equal(b.palette, PALETTES.town);
  assert.equal(b.yardWalls, true); assert.equal(b.flatRoofs, false);
  assert.deepEqual(b.saveMeta.state.weather, WEATHER);
  assert.equal(encodeWorld(b, 'terrain'), code, '三段齐全再编码逐位一致');
}

/* ---- 6. 坏输入原子拒收：快照/版本/调色板/saveMeta 全不动 ---------------------------------- */
{
  const a = make(8); a.palette = PALETTES.pastel;
  const code = encodeWorld(a, 'town', META);
  const b = make(8);
  const untouched = () => { const s = b.snapshot(), v = b.version, pal = b.palette, meta = b.saveMeta; return () => { assert.deepEqual(b.snapshot(), s); assert.equal(b.version, v); assert.equal(b.palette, pal); assert.equal(b.saveMeta, meta); }; };
  const cases = [
    ['截断', code.slice(0, -2)],
    ['尾随', code + '1'],
    ['metaVer≠0', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [1, 3], [0, 1], [0, 1]])],
    ['空扩展段', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [0, 1], [0, 1]])],
    ['雾浓度越界', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [0, 1], [1, 1], [0, 2], [0, 3], [0, 5], [1, 1], [0, 1], [0, 1], [25, 5], [10, 5], [200, 9]])],
    ['风向越界', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [0, 1], [1, 1], [0, 2], [0, 3], [0, 5], [1, 1], [0, 1], [0, 1], [10, 5], [10, 5], [400, 9]])],
    ['色数为零', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [1, 1], [0, 2], [0, 5], [0, 1]])],
    ['meta 截半', pack([...emptyVoxels(), [0, 1], [0, 1], [1, 1], [0, 3], [1, 1], [0, 2], [3, 5]]).slice(0, -1)],
  ];
  for (const [name, input] of cases) { const chk = untouched(); assert.throws(() => decodeWorld(input, b), null, name); chk(); }
  // 编码侧参数越界也在写串前拒绝
  assert.throws(() => encodeWorld(a, 'town', { state: { timeOfDay: 'bogus' } }), /光照时段/);
  assert.throws(() => encodeWorld(a, 'town', { state: { bnTheme: 'bogus' } }), /北境主题/);
  assert.throws(() => encodeWorld(a, 'town', { state: { weather: { fogOpacity: 1.5, fogSpeed: 0, windDeg: 0 } } }), /雾浓度/);
  assert.throws(() => encodeWorld(a, 'town', { state: { weather: { fogOpacity: 0, fogSpeed: 9, windDeg: 0 } } }), /雾流速/);
  assert.throws(() => encodeWorld(a, 'town', { state: { weather: { fogOpacity: 0, fogSpeed: 0, windDeg: 400 } } }), /风向/);
  const badPal = make(8); badPal.palette = { colors: ['#xyz123'] };
  assert.throws(() => encodeWorld(badPal, 'town', { palette: true }), /调色板颜色/);
  badPal.palette = { colors: Array(32).fill('#ffffff') };
  assert.throws(() => encodeWorld(badPal, 'town', { palette: true }), /调色板色数/);
  const noPal = make(8); noPal.palette = null;
  assert.throws(() => encodeWorld(noPal, 'town', { palette: true }), /调色板色数/);
  // reset 清掉 decode 落的 saveMeta（防止陈旧状态回流编码）
  decodeWorld(code, b); assert.ok(b.saveMeta); b.reset(); assert.equal(b.saveMeta, null);
}

console.log('PASS save meta tail: custom/preset palette + timeOfDay/bnTheme/flags/weather roundtrip bitwise, legacy reads clean, forged inputs rejected atomically, 3-section chain coexists');
