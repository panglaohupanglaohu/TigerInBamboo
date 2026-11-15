/**
 * color-volume-grid.js — 第 56 批 C11：1710031224838771027「a probably horrible way to author color volumes. The idea is to
 * properly define the whole color possibility space for each feature」。
 *
 * 片子画面（515 帧；sheet-00..05 + 原尺寸 0005/0040/0055/0140/0240/0340/0460）实际是 Unity Inspector「Col Vol Test」：
 *   · 五个特征 Grass / Roof / Cliff / Beach / Flowers，各一行；折叠时只显示该特征的全部颜色拼成的一条色带；
 *   · 展开后 H / S / L 三行，每行「步数 + 最小值 + 双柄范围条 + 最大值」（如 Grass H 5 0.06–0.46、S 3 0.31–0.63、L 3 0.44–0.59）；
 *   · 下面按 H 步数排开 H 个色块，每块是 S×L 的小格；有的格是小黑点 = 被点掉（禁用），点击切换（0140→0240 第 5 块多了一个点）；
 *   · H 范围可跨 0（0.60–1）和整圈（Flowers H 7 0–1：7 个不同色相，0 与 1 不重复）；
 *   · 拖 H 范围时整组色块一起换色相（0040 粉棕→0055 蓝紫）。
 * 色彩空间：片中只写 H/S/L。按色块的色相位置（H=0.16 是橙棕、0.46 是青绿、L 相同的格明度一致）推断更接近 OkHsl，
 * 所以默认 space='okhsl'，并保留 'hsl'（标准 HSL）以便对照——这是推断，不是原作已证。
 * 本模块：离散 H×S×L 网格 + 逐格掩码 + 折叠色带 + 按特征在 World 上取最近的启用格（离散取色，不插值）。
 */
import { okhslToSrgb } from './okhsl.js';
import { classifyWorldFeature } from './color-volume.js';

export const VOLUME_FEATURES = Object.freeze(['Grass', 'Roof', 'Cliff', 'Beach', 'Flowers']);
const hslToRgb = (h, s, l) => { const f = (n) => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; };
const okRange = (r) => Array.isArray(r) && r.length === 2 && r.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);

/** 第 k 个离散值。H 允许 max<min（跨 0）；整圈（跨度 ≥1）时按 k/n 取，避免首尾同色。 */
export function stepValue([a, b], n, k, hue = false) {
  if (n === 1) return hue && b < a ? ((a + b + 1) / 2) % 1 : (a + b) / 2;
  if (!hue) return a + (b - a) * k / (n - 1);
  const end = b < a ? b + 1 : b, span = end - a, full = span >= 1 - 1e-9;
  return (a + span * k / (full ? n : n - 1)) % 1;
}

export function makeVolumeGrid({ name = 'Volume', h = [0, 1], s = [0, 1], l = [0, 1], steps = [3, 3, 3], space = 'okhsl', mask = null } = {}) {
  if (!okRange(h) || !okRange(s) || !okRange(l) || s[1] < s[0] || l[1] < l[0]) throw new RangeError('volume-grid: ranges');
  if (!Array.isArray(steps) || steps.length !== 3 || !steps.every((n) => Number.isInteger(n) && n >= 1 && n <= 16)) throw new RangeError('volume-grid: steps');
  if (space !== 'okhsl' && space !== 'hsl') throw new RangeError('volume-grid: space');
  const total = steps[0] * steps[1] * steps[2];
  const m = mask == null ? new Array(total).fill(true) : [...mask];
  if (m.length !== total || !m.every((x) => typeof x === 'boolean')) throw new RangeError('volume-grid: mask length');
  const conv = space === 'okhsl' ? okhslToSrgb : hslToRgb, cells = [];
  for (let ih = 0; ih < steps[0]; ih++) for (let is = 0; is < steps[1]; is++) for (let il = 0; il < steps[2]; il++) {
    const hsl = [stepValue(h, steps[0], ih, true), stepValue(s, steps[1], is), stepValue(l, steps[2], il)];
    cells.push(Object.freeze({ index: cells.length, ih, is, il, hsl, rgb: conv(...hsl).map((v) => Math.max(0, Math.min(1, v))), on: m[cells.length] }));
  }
  return Object.freeze({ name, h: [...h], s: [...s], l: [...l], steps: [...steps], space, mask: Object.freeze(m), cells: Object.freeze(cells) });
}
export const cellIndex = (g, ih, is, il) => (ih * g.steps[1] + is) * g.steps[2] + il;
/** 点一下：切换某格启用。返回新网格（不可变）。 */
export function toggleCell(g, index) {
  if (!Number.isInteger(index) || index < 0 || index >= g.cells.length) throw new RangeError('volume-grid: cell');
  const mask = [...g.mask]; mask[index] = !mask[index]; return makeVolumeGrid({ ...g, mask });
}
/** 改范围 / 步数：步数变了掩码重置为全开（片中改步数后格子重排）。 */
export function setVolumeRange(g, axis, range, steps = null) {
  if (!['h', 's', 'l'].includes(axis)) throw new RangeError('volume-grid: axis');
  const st = [...g.steps]; if (steps != null) st['hsl'.indexOf(axis)] = steps;
  const same = st.every((n, i) => n === g.steps[i]);
  return makeVolumeGrid({ ...g, [axis]: range, steps: st, mask: same ? g.mask : null });
}
/** 折叠时那一条色带：所有启用格，按 H 块 → S → L 顺序。 */
export const volumeStrip = (g) => g.cells.filter((c) => c.on).map((c) => c.rgb);
/** H 块视图：每块 S×L 的二维表，禁用格为 null（画成小黑点）。 */
export const volumeBlocks = (g) => Array.from({ length: g.steps[0] }, (_, ih) => Array.from({ length: g.steps[1] }, (_, is) => Array.from({ length: g.steps[2] }, (_, il) => { const c = g.cells[cellIndex(g, ih, is, il)]; return c.on ? c : null; })));

/** 连续坐标 (u→H, v→S, w→L ∈[0,1]) → 最近的**启用**格（网格距离），全禁用返回 null。 */
export function nearestCell(g, u, v, w) {
  if (![u, v, w].every(Number.isFinite)) throw new RangeError('volume-grid: coords');
  const q = (x, n) => Math.min(n - 1, Math.max(0, Math.round(Math.max(0, Math.min(1, x)) * (n - 1))));
  const th = q(u, g.steps[0]), ts = q(v, g.steps[1]), tl = q(w, g.steps[2]);
  const direct = g.cells[cellIndex(g, th, ts, tl)]; if (direct.on) return direct;
  let best = null, bd = Infinity;
  for (const c of g.cells) { if (!c.on) continue; const d = (c.ih - th) ** 2 * 4 + (c.is - ts) ** 2 + (c.il - tl) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}

/** 片中五特征的初值（按 0040/0340/0460 读到的数值；Roof/Beach 片中没展开，按折叠色带估）。掩码复现 Grass 第 1 块只剩中格、4/5 块阶梯缺角。 */
export function defaultVolumeGrids(space = 'okhsl') {
  const grass = makeVolumeGrid({ name: 'Grass', h: [0.06, 0.46], s: [0.31, 0.63], l: [0.44, 0.59], steps: [5, 3, 3], space });
  let gm = [...grass.mask];
  for (let is = 0; is < 3; is++) for (let il = 0; il < 3; il++) if (!(is === 1 && il === 1)) gm[cellIndex(grass, 0, is, il)] = false;
  for (const [ih, is, il] of [[3, 0, 0], [3, 0, 1], [3, 1, 0], [4, 0, 0], [4, 0, 1]]) gm[cellIndex(grass, ih, is, il)] = false;
  return {
    Grass: makeVolumeGrid({ ...grass, mask: gm }),
    Roof: makeVolumeGrid({ name: 'Roof', h: [0.06, 0.30], s: [0.45, 0.80], l: [0.45, 0.75], steps: [4, 2, 3], space }),
    Cliff: makeVolumeGrid({ name: 'Cliff', h: [0.17, 0.35], s: [0, 0.52], l: [0.47, 0.79], steps: [4, 3, 3], space }),
    Beach: makeVolumeGrid({ name: 'Beach', h: [0.08, 0.25], s: [0.15, 0.40], l: [0.62, 0.82], steps: [4, 2, 2], space }),
    Flowers: makeVolumeGrid({ name: 'Flowers', h: [0, 1], s: [0.516, 1], l: [0.62, 1], steps: [7, 1, 3], space }),
  };
}

/**
 * World 取色：classifyWorldFeature 给 (feature, u 高度, v 落差, w 变化)；映射 H←w（格间变化）、S←v、L←u，
 * 取该特征网格里最近的启用格。崖壁（walls）统一用 Cliff 网格，按列。返回每格 top/wall sRGB + 用到的格。
 */
export function colorWorldByVolumeGrids(world, grids = defaultVolumeGrids(), opts = {}) {
  const maxLevel = world.cells.reduce((m, c) => Math.max(m, world.top(c)), 1), n = world.cells.length;
  const top = new Float32Array(n * 3), wall = new Float32Array(n * 3), feature = new Array(n).fill(null), used = {}, cellsUsed = {};
  for (const c of world.cells) {
    const k = classifyWorldFeature(world, c, { maxLevel, ...opts }); if (!k) continue;
    const g = grids[k.feature]; if (!g) throw new RangeError('volume-grid: missing ' + k.feature);
    const hit = nearestCell(g, k.w, k.v, k.u); feature[c.id] = k.feature; used[k.feature] = (used[k.feature] || 0) + 1;
    if (hit) { top.set(hit.rgb, c.id * 3); (cellsUsed[k.feature] ??= new Set()).add(hit.index); }
    const wc = nearestCell(grids.Cliff, k.w, 1 - k.u, k.u); if (wc) wall.set(wc.rgb, c.id * 3);
  }
  return { top, wall, feature, used, cellsUsed: Object.fromEntries(Object.entries(cellsUsed).map(([f, s]) => [f, [...s].sort((a, b) => a - b)])), maxLevel };
}
