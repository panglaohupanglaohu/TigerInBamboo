/**
 * sphere-world.js — 球面 World：网格生成、球面坐标编辑、保存恢复。
 *
 *   1768627849529893109 队列残差：「补球面 World 的网格生成与编辑/保存恢复接线」。
 *
 * 分工（与 world-sphere.js / planet-town.js）：
 *   world-sphere.js 只给贴片映射（点/姿态/岸线），不管网格从哪来、点击怎么落格、存档怎么写。
 *   planet-town.js 的 planetWorld 让 World 跑在整球对偶柱群上（五/六边形、无界、无 patch）。
 *   本文件补贴片口径缺的三件事，把 world-sphere.js 的映射接到 World 的日常用法上：
 *
 *   1. 网格生成 sphereGrid()：patch + 网格参数一次产出带真 cell 拓扑的球面格——拓扑来自
 *      grid.js 生成器（共享角点对象 + edgeNeighbors/edgeTwins 半边），不是只摆姿态；
 *      角点经同一映射贴球后逐位一致 ⇒ 接缝按构造闭合。每格附 pos/pts3/pose 供渲染与岸线。
 *   2. 编辑 spherePick/sphereApply/sphereEdit：球面 3D 点 → unmapPoint → cellAt 落格，
 *      build/erase/raise/dig/level/paint 与 world/app.js applyAt 同语义（加点/删点/改层）。
 *   3. 保存恢复 encode/decodeSphereWorld：与 world/save.js 同风格（64 字符表 + 游程位流），
 *      版本/mode/网格参数/patch 指纹都在头部，恢复进既有球面 World（对应 decodeWorld 模型）。
 *
 * 纯函数、确定性；不含 THREE，不含渲染。
 */

import { buildQuadGrid, buildSquareGrid, buildHexGrid, buildMixedGrid } from '../core/grid.js';
import { World, MAX_LEVEL } from '../core/world.js';
import { decorateCells, buildCellIndex } from '../core/spatial.js';
import { makeSpherePatch, mapCell, unmapPoint } from './world-sphere.js';

export const MODES = ['sphere', 'bend'];

const GRID_BUILDERS = {
  quad:   ({ radius, cellSize, seed }) => buildQuadGrid({ radius, hexSize: cellSize, seed }),
  square: ({ radius, cellSize }) => buildSquareGrid({ radius, cellSize }),
  hex:    ({ radius, cellSize }) => buildHexGrid({ radius, cellSize }),
  mixed:  ({ radius, cellSize, seed }) => buildMixedGrid({ radius, hexSize: cellSize, seed }),
};
export const SPHERE_GRID_KINDS = Object.keys(GRID_BUILDERS);

function checkMode(mode) {
  if (!MODES.includes(mode)) throw new RangeError('Invalid sphere map mode');
}

/**
 * 球面格生成。返回的就是 grid.js 的网格对象（cells/verts/vertexCells + 半边邻接），
 * 每格再附：pos（格心 3D）、pts3（角点 3D，与 pts 对齐）、pose（中心姿态）、sigma/inRange。
 * grid.coverage = { total, inRange, maxSigma } —— 贴片超过对蹠折叠的格如实报数。
 */
export function sphereGrid(patch, { kind = 'quad', radius = 8, cellSize = 1, seed = 1337, mode = 'sphere', y = 0 } = {}) {
  const build = GRID_BUILDERS[kind];
  if (!build) throw new RangeError('Invalid sphere grid kind');
  checkMode(mode);
  const grid = build({ radius, cellSize, seed });
  let inRange = 0, maxSigma = 0;
  for (const cell of grid.cells) {
    const m = mapCell(patch, cell, { mode, y });
    cell.pos = m.pose.position;
    cell.pose = m.pose;
    cell.pts3 = m.pts;
    cell.sigma = m.pose.sigma;
    cell.inRange = m.pose.inRange;
    if (m.pose.inRange) inRange++;
    maxSigma = Math.max(maxSigma, m.pose.sigma);
  }
  grid.sphere = { mode, y, kind, radius, cellSize, seed };
  grid.coverage = { total: grid.cells.length, inRange, maxSigma };
  return grid;
}

/**
 * 球面 World 上下文：{ patch, grid, world, index, mode, levelHeight, spec }。
 * index 是平面 XZ 落格索引（spatial.js 同一套）；spec = 网格参数（存档指纹用）。
 */
export function makeSphereWorld(patch, { kind = 'quad', radius = 8, cellSize = 1, seed = 1337, mode = 'sphere', y = 0, levelHeight = 1 } = {}) {
  if (!patch || !patch.anchor) throw new TypeError('makeSphereWorld needs a makeSpherePatch() patch');
  checkMode(mode);
  if (!(levelHeight > 0) || !Number.isFinite(levelHeight)) throw new RangeError('Invalid level height');
  const grid = sphereGrid(patch, { kind, radius, cellSize, seed, mode, y });
  const world = new World(grid);
  const index = buildCellIndex(decorateCells(grid));
  return { patch, grid, world, index, mode, levelHeight, spec: { kind, radius, cellSize, seed } };
}

/** 便捷版：参数直出 patch + World（等价 makeSpherePatch + makeSphereWorld）。 */
export function buildSphereWorld(params = {}, opts = {}) {
  return makeSphereWorld(makeSpherePatch(params), opts);
}

/**
 * 球面拾取：3D 点 → unmapPoint → 平面落格。
 * 返回 { cell, x, z, y, sigma, level }；贴不到格（贴片外/对蹠折叠）返回 null。
 * level = floor(y/levelHeight)+1 —— 球面上点到哪层就算哪层（与平面 hit.level 同语义）。
 */
export function spherePick(ctx, pos, { mode = ctx.mode } = {}) {
  const u = unmapPoint(ctx.patch, pos, { mode });
  if (!u.inRange) return null;
  const cell = ctx.index.cellAt(u.x, u.z);
  if (!cell) return null;
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(u.y / ctx.levelHeight) + 1));
  return { cell, x: u.x, z: u.z, y: u.y, sigma: u.sigma, level };
}

/**
 * 球面编辑。tool 与 world/app.js applyAt 同语义：
 *   'build'  点到的层空就填它，否则往柱顶叠一层；color ≥ 0 时新块上色（与地面 app 一致：lv≥2 或有地才上）
 *   'erase'  扣掉点到的实心层（上面的由钢架/拱托住），点空层则扣柱顶；地形挖穿后清河道
 *   'raise'  柱顶加一层岩石（地形抬升）
 *   'dig'    扣柱顶一层（地形下挖）
 *   'level'  整列填到 opts.level 层（改层；rock=true 时整列算地形）
 *   'paint'  整格换墙色（opts.color）
 * 返回 { cell, changed, target }；hit 为 null 时返回 null（点空 = 无操作）。
 */
export function sphereApply(ctx, hit, tool, { color = -1, level = null, rock = false } = {}) {
  if (!hit?.cell) return null;
  const { world } = ctx, cell = hit.cell;
  const top = world.top(cell);
  if (tool === 'level') {
    if (level === null || !Number.isInteger(level) || level < 0 || level > MAX_LEVEL) throw new RangeError('Invalid level target');
    if (top === level && world.isRock(cell, Math.max(1, top)) === (rock && level > 0)) return { cell, changed: false, target: top };
    world.fill(cell, level, { rock });
    return { cell, changed: true, target: level };
  }
  const lv = Math.max(1, Math.min(MAX_LEVEL, hit.level || top || 1));
  if (tool === 'build') {
    const target = !world.isSolid(cell, lv) ? lv : Math.min(MAX_LEVEL, top + 1);
    if (target < 1 || world.isSolid(cell, target)) return { cell, changed: false, target: lv };
    world.setSolid(cell, target, true, { rock });
    if (color >= 0 && (target >= 2 || world.ground(cell) > 0)) world.color[cell.id] = color;
    return { cell, changed: true, target };
  }
  if (tool === 'erase') {
    const target = world.isSolid(cell, lv) ? lv : top;
    if (!target) return { cell, changed: false, target: 0 };
    world.setSolid(cell, target, false);
    if (!world.ground(cell)) world.river[cell.id] = 0;
    return { cell, changed: true, target };
  }
  if (tool === 'raise') {
    if (top >= MAX_LEVEL) return { cell, changed: false, target: top };
    world.setSolid(cell, top + 1, true, { rock: true });
    return { cell, changed: true, target: top + 1 };
  }
  if (tool === 'dig') {
    if (!top) return { cell, changed: false, target: 0 };
    world.setSolid(cell, top, false);
    return { cell, changed: true, target: top };
  }
  if (tool === 'paint') {
    if (!Number.isInteger(color) || color < 0 || color >= (world.palette?.colors.length ?? 15)) throw new RangeError('Invalid wall color');
    if (world.color[cell.id] === color) return { cell, changed: false, target: lv };
    world.color[cell.id] = color;
    world.touch();
    return { cell, changed: true, target: lv };
  }
  throw new RangeError('Invalid sphere edit tool');
}

/** 拾取 + 编辑一步：spherePick(pos) → sphereApply(hit)。点空返回 null。 */
export function sphereEdit(ctx, pos, tool, opts = {}) {
  const { mode, ...rest } = opts;
  return sphereApply(ctx, spherePick(ctx, pos, { mode }), tool, rest);
}

/* ---- 保存恢复（与 world/save.js 同风格：64 字符表位流 + 游程记录） ------------------------ */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));
const SPHERE_SAVE_VERSION = 1;

/** patch 指纹：R/center/up/e1/e2 的 float32 位折叠成 24b——验证存档贴的是同一片球面。 */
function patchFingerprint(patch) {
  const f = new Float32Array([patch.R, ...patch.center, ...patch.up, ...patch.e1, ...patch.e2]);
  const u = new Uint32Array(f.buffer);
  let h = 0x9e3779b9;
  for (const v of u) { h = Math.imul(h ^ v, 0x85ebca6b) >>> 0; h = ((h << 13) | (h >>> 19)) >>> 0; }
  return h & 0xffffff;
}

/**
 * 存档格式：[3b 版本=1][1b mode][2b 网格 kind][8b 半径][12b cellSize×100][24b seed][24b patch 指纹]
 * 然后游程记录（与 save.js v5 逐字段相同）：[1b 非空][12b solid][12b rock][5b 颜色+1][1b 河道]
 *   [5b 游程-1][1b 继续]…。存档不自含 patch——恢复需要同一个球面 World（decodeWorld 模型）。
 */
export function encodeSphereWorld(ctx) {
  const { patch, world, mode, spec } = ctx;
  if (!(spec.radius >= 0 && spec.radius <= 255) || !(spec.cellSize > 0 && spec.cellSize <= 40.95)) throw new Error('网格参数超出存档范围');
  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(SPHERE_SAVE_VERSION, 3);
  push(MODES.indexOf(mode), 1);
  push(SPHERE_GRID_KINDS.indexOf(spec.kind), 2);
  push(spec.radius, 8);
  push(Math.round(spec.cellSize * 100), 12);
  push(spec.seed >>> 0 & 0xffffff, 24);
  push(patchFingerprint(patch), 24);
  const n = world.solid.length;
  const key = (i) => `${world.solid[i]},${world.rock[i]},${world.color[i]},${world.river[i]}`;
  for (let i = 0; i < n;) {
    let run = 1;
    while (i + run < n && key(i + run) === key(i)) run++;
    const s = world.solid[i], r = world.rock[i], c = world.color[i], river = world.river[i];
    if ((s & ~((1 << MAX_LEVEL) - 1)) || (r & ~s) || c < -1 || c > 30 || c >= (world.palette?.colors.length ?? 15) || river > 1) throw new Error('无效的体素或墙色色槽');
    if (s === 0 && r === 0 && c === -1 && river === 0) push(0, 1);
    else {
      push(1, 1);
      push(s, MAX_LEVEL);
      push(r, MAX_LEVEL);
      push(c + 1, 5);
      push(river, 1);
    }
    for (let left = run; left > 0;) {
      const chunk = Math.min(32, left);
      push(chunk - 1, 5);
      left -= chunk;
      push(left > 0 ? 1 : 0, 1);
    }
    i += run;
  }
  let out = '';
  for (let i = 0; i < bits.length; i += 6) {
    let v = 0;
    for (let b = 0; b < 6; b++) v = (v << 1) | (bits[i + b] ?? 0);
    out += ALPHABET[v];
  }
  return out;
}

/**
 * 恢复进既有球面 World：头部逐项校验（版本/mode/kind/半径/尺寸/种子/patch 指纹），
 * 校验全过才解码进 scratch 数组再 world.restore——坏存档不动活的岛。
 * 返回网格 spec（与 decodeWorld 返回 scene 对应）。
 */
export function decodeSphereWorld(str, ctx) {
  if (typeof str !== 'string') throw new Error('存档必须是字符串');
  const { patch, world, mode, spec } = ctx;
  str = str.trim();
  const n = world.solid.length;
  if (str.length > Math.ceil((74 + n * 43) / 6)) throw new Error('存档过长');
  const bits = [];
  for (const ch of str) {
    const v = INDEX.get(ch);
    if (v === undefined) throw new Error(`未知字符 "${ch}"`);
    for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1);
  }
  let p = 0;
  const read = (m) => {
    if (p + m > bits.length) throw new Error('存档被截断');
    let v = 0;
    for (let i = 0; i < m; i++) v = (v << 1) | bits[p++];
    return v;
  };
  if (read(3) !== SPHERE_SAVE_VERSION) throw new Error('存档版本不对（需要球面 v1）');
  if (read(1) !== MODES.indexOf(mode)) throw new Error('贴球模式不一致');
  const kind = SPHERE_GRID_KINDS[read(2)];
  if (kind !== spec.kind) throw new Error('网格类型不一致');
  if (read(8) !== spec.radius) throw new Error('网格半径不一致');
  if (Math.abs(read(12) / 100 - spec.cellSize) > 1e-9) throw new Error('格子尺寸不一致');
  if (read(24) !== (spec.seed >>> 0 & 0xffffff)) throw new Error('网格种子不一致');
  if (read(24) !== patchFingerprint(patch)) throw new Error('球面贴片不一致');
  const next = { solid: new Uint16Array(n), rock: new Uint16Array(n), color: new Int8Array(n).fill(-1), river: new Uint8Array(n) };
  for (let i = 0; i < n;) {
    let s = 0, r = 0, c = -1, rv = 0;
    if (read(1)) { s = read(MAX_LEVEL); r = read(MAX_LEVEL); c = read(5) - 1; rv = read(1); }
    if ((r & ~s) !== 0 || c >= (world.palette?.colors.length ?? 15)) throw new Error('无效的体素或墙色色槽');
    let run = 0;
    for (let more = 1; more;) {
      run += read(5) + 1;
      if (run > n - i) throw new Error('游程超出网格');
      more = read(1);
    }
    for (let k = 0; k < run; k++, i++) { next.solid[i] = s; next.rock[i] = r; next.color[i] = c; next.river[i] = rv; }
  }
  // 编码器最多补 5 个零位；拒绝尾巴数据。
  if (bits.length - p > 5 || bits.slice(p).some(Boolean)) throw new Error('存档有多余数据');
  world.restore(next);
  return spec;
}
