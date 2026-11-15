// 第 56 批 C05：1371460793032716290 Palette.png 热重载（core/palette-image.js + world/palette-png.js）。
// 用真实 PNG 文件（tools/palette-png.py 写的 16×2 RGB8）+ node 内置 zlib 解码，watcher 注入 fetch/decode/schedule。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES } from '../src/core/palette.js';
import { paletteRowsFromPixels, paletteFromImageRows, encodePaletteImage, pixelsDigest, changedSlots } from '../src/core/palette-image.js';
import { watchPalettePng } from '../src/world/palette-png.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 最小 PNG 解码（8 位 RGB/RGBA，filter 0/1/2 足够本工具输出；其它 filter 直接报错）
function decodePng(buf) {
  let o = 8, w, h, ct, idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); }
  const ch = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * 4), stride = w * ch;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) { const a = i >= ch ? cur[i - ch] : 0; cur[i] = (line[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? prev[i] : NaN)) & 255; if (f > 2) throw Error('filter'); }
    for (let x = 0; x < w; x++) { for (let k = 0; k < 3; k++) out[(y * w + x) * 4 + k] = cur[x * ch + k]; out[(y * w + x) * 4 + 3] = ch === 4 ? cur[x * ch + 3] : 255; }
    prev = cur; }
  return { width: w, height: h, pixels: out };
}

const dir = mkdtempSync(join(tmpdir(), 'palpng-'));
const png = (mode) => { const p = join(dir, mode + '.png'); execFileSync('python3', [join(root, 'tools/palette-png.py'), mode, p]); return readFileSync(p); };

// 1) 文件尺寸与片子一致：16×2 RGB8 = 96 字节像素
const base = png('base'), img = decodePng(base);
assert.equal(img.width, 16); assert.equal(img.height, 2); assert.equal(img.width * img.height * 3, 96);
const rows = paletteRowsFromPixels(img.pixels, img.width, img.height);
assert.deepEqual(rows[1].slice(0, 15), PALETTES.town.colors, '下行 = 小镇墙色');
// 2) 行 → 私有色槽：不改共享预设；16 列多出的一列忽略；窄图沿用原色；行号越界退到最后一行
const town0 = [...PALETTES.town.colors];
const pale = decodePng(png('pale')), paleRows = paletteRowsFromPixels(pale.pixels, 16, 2);
const p1 = paletteFromImageRows(PALETTES.town, paleRows);
assert.deepEqual(PALETTES.town.colors, town0, '预设不被改');
assert.deepEqual(p1.colors, paleRows[1].slice(0, 15));
assert.equal(changedSlots(town0, p1.colors).length, 15, '全涂浅 → 15 槽都变');
const narrow = paletteFromImageRows(PALETTES.town, [paleRows[1].slice(0, 4)], { wallRow: 5 });
assert.deepEqual(narrow.colors.slice(0, 4), paleRows[1].slice(0, 4)); assert.deepEqual(narrow.colors.slice(4), town0.slice(4));
assert.throws(() => paletteRowsFromPixels(new Uint8Array(10), 16, 2), RangeError);
// 3) 反向导出再读回：逐槽一致
const enc = encodePaletteImage(p1);
assert.deepEqual(paletteRowsFromPixels(enc.pixels, enc.width, enc.height)[1].slice(0, 15), p1.colors);
// 4) watcher：同内容重复保存不重烘；内容变才 apply；坏文件计错误但不停；stop 后不再轮询
let file = base, applied = [], queue = [], colors = [...town0];
const w = watchPalettePng('x.png', (row) => { colors = row.slice(0, 15); applied.push(row.slice(0, 15)); }, {
  getColors: () => colors, fetchBytes: async () => file, decode: async (b) => decodePng(Buffer.from(b)),
  schedule: (fn) => { queue.push(fn); return queue.length; }, cancel: () => {},
});
await w.ready; assert.equal(applied.length, 1); assert.equal(w.state.lastChanged.length, 0, '首读与当前相同');
await w.pollNow(); assert.equal(applied.length, 1, '同内容不重复应用');
file = png('half'); await w.pollNow(); assert.equal(applied.length, 2); assert.deepEqual(w.state.lastChanged, [1, 3, 5, 7, 9, 11, 13], '隔一槽涂浅 → 奇数槽变');
file = Buffer.from('not a png'); await w.pollNow(); assert.equal(w.state.errors, 1); assert.equal(applied.length, 2);
file = pale ? png('pale') : null; await w.pollNow(); assert.equal(applied.length, 3); assert.deepEqual(colors, p1.colors);
w.stop(); const n = queue.length; await w.pollNow(); assert.equal(queue.length, n, 'stop 后不再排程');
assert.notEqual(pixelsDigest(png('base')), pixelsDigest(png('pale')));
console.log(`PASS palette-png r56: 16×2 RGB8(96B) 下行=墙色槽；预设不变；16列/窄图/越界行；导出读回一致；热重载只在内容变时应用（${applied.length} 次，含隔槽 7 槽变化），坏文件计错不中断，stop 生效`);
