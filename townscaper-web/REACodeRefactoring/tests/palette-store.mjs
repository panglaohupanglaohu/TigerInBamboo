// 1200520827898343425 收口：常用墙色存档（core/palette-store.js）的纯函数验收。
// 片中只有「改一个色槽 → 用该槽的体素同帧换色」，没有 UI/存档画面；持久化按本仓口径落到 localStorage schema。
import assert from 'node:assert/strict';
import { PALETTES } from '../src/core/palette.js';
import { STORE_KEY, STORE_VERSION, encodePaletteRecord, decodePaletteRecord, sameWallColors } from '../src/core/palette-store.js';

const town = [...PALETTES.town.colors];
const before = JSON.parse(JSON.stringify(PALETTES));

// 1. 往返：15 槽逐字保留、grid/savedAt 保留、base 与预设都不被改
const custom = town.map((c, i) => (i % 3 === 0 ? '#808080' : c));
const rec = encodePaletteRecord(custom, { base: PALETTES.town, grid: 'mixed', savedAt: 1712345678901 });
assert.equal(rec.v, STORE_VERSION);
assert.deepEqual(rec.colors, custom);
const back = decodePaletteRecord(JSON.stringify(rec), PALETTES.town);
assert.deepEqual(back, { colors: custom, grid: 'mixed', savedAt: 1712345678901 });
assert.equal(STORE_KEY, 'rea.wallPalette.v1');

// 2. 返回的是副本：改结果不动记录、不动预设
back.colors[0] = '#000000';
assert.equal(rec.colors[0], '#808080');
assert.deepEqual(PALETTES, before, '预设被就地污染');
assert.deepEqual(PALETTES.town.colors, town);

// 3. 没有存档 ≠ 坏存档
for (const empty of [null, undefined, '']) assert.equal(decodePaletteRecord(empty, PALETTES.town), null);

// 4. 坏存档一律拒绝（RangeError，不是静默降级）
const bad = [
  ['不是 JSON', '{oops', /不是 JSON/],
  ['数组', '[]', /不是对象/],
  ['版本不认', JSON.stringify({ v: 2, colors: town }), /版本 2 不认/],
  ['缺版本', JSON.stringify({ colors: town }), /版本 undefined 不认/],
  ['槽数少一个', JSON.stringify({ v: 1, colors: town.slice(1) }), /slots/],
  ['槽数多一个', JSON.stringify({ v: 1, colors: [...town, '#ffffff'] }), /slots/],
  ['非 #rrggbb', JSON.stringify({ v: 1, colors: town.map((c, i) => (i ? c : 'red')) }), /slots/],
  ['三位缩写', JSON.stringify({ v: 1, colors: town.map((c, i) => (i ? c : '#fff')) }), /slots/],
  ['不是数组', JSON.stringify({ v: 1, colors: 'dd6a5f' }), /slots/],
  ['grid 不是字符串', JSON.stringify({ v: 1, colors: town, grid: 3 }), /grid/],
];
for (const [name, raw, re] of bad) assert.throws(() => decodePaletteRecord(raw, PALETTES.town), re, name);

// 5. 编码侧同样把关（页面每敲一个色值都会走这里）
assert.throws(() => encodePaletteRecord(town.slice(0, 14), { base: PALETTES.town }), /slots/);
assert.throws(() => encodePaletteRecord(null, { base: PALETTES.town }), /slots/);
assert.throws(() => encodePaletteRecord(town, {}), /base/);
assert.throws(() => decodePaletteRecord('{"v":1,"colors":[]}', null), /base/);

// 6. grid / savedAt 缺省：null，不编造
const sparse = decodePaletteRecord(JSON.stringify({ v: 1, colors: town }), PALETTES.town);
assert.deepEqual(sparse, { colors: town, grid: null, savedAt: null });

// 7. 逐槽比较：大小写无关、改一槽即 false、非法值抛错
assert.equal(sameWallColors(town, town.map((c) => c.toUpperCase()), PALETTES.town), true);
assert.equal(sameWallColors(town, custom, PALETTES.town), false);
assert.throws(() => sameWallColors(town, town.slice(1), PALETTES.town), /slots/);

// 8. 存档长度（= 写进 localStorage 的字节数）
const bytes = JSON.stringify(encodePaletteRecord(custom, { base: PALETTES.town, grid: 'mixed', savedAt: 1 })).length;
console.log(`PASS palette-store: 15 槽往返逐字一致、预设零污染、空存档 null、${bad.length} 类坏存档全 RangeError、长度 ${bytes}B`);
