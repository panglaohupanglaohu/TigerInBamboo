/**
 * patch-blend.js — src/patchblend.js 的无缝 patch 混合，改读共享 World 的岸线。
 *
 * 1781405550061687016 "I've got seamless patch blending! Some of the patches are projected (like the grass and
 *   the water) and some are manually UV-mapped (like the shoreline). With some good textures and some height
 *   based blending this is gonna be great."
 *
 * 移植的机制：
 *   - patch = { mapping:'project'|'uv', coverage, heightAt, color }；重叠区按 patch 高度排序只混前两名，
 *     权重 smoothstep(0.5 + (h1-h2)/(2·band))（原版 'height' 模式）；'hard' / 'alpha' 作对照基线。
 *   - 草/水是世界 XZ 投影（跨格连续）；岸带是手工 UV：u = 沿真实岸线环（core/shore-loops.js）的弧长，
 *     v = 到岸线的有符号距离。v 必须进图案（原版坑②：否则花纹沿法线恒定→海胆放射纹）。
 *   - 岸带覆盖用有符号距离（世界单位）而不是海拔差（原版坑①：缓坡处带宽暴涨）。
 *   - seamStats / edgeJump / abModes 原样迁移，量「接缝看不看得见」与「过渡带里细节还剩多少」。
 * 读取共享 World（isLand / ground / grid.pts）与 cellIndex，不另建世界；World.version 用于失效判断。
 * 「高度混合」里 land 的 patch 高度 = 到岸距离 + 地表层高 × landLift —— 原文说高度混合是后续设想，这里是本地选择。
 * 未做：接进 terrainmesh/View 的实景着色（另一会话持有）；没有原作手绘贴图，三种 patch 纹样是程序化替身。
 */
import { traceShoreLoops } from '../core/shore-loops.js';
import { buildCellIndex, decorateCells } from '../core/spatial.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const t = a + (b - a) * fx, u = c + (d - c) * fx; return t + (u - t) * fy;
}

/** 岸线环 → 带弧长的线段表（land 在左）。 */
export function shoreArcs(world) {
  const loops = traceShoreLoops(world.cells, (c) => world.isLand(c));
  const segs = [];
  loops.forEach((loop, li) => {
    let s = 0;
    for (const e of loop) { const len = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z); segs.push({ loop: li, ax: e.a.x, az: e.a.z, bx: e.b.x, bz: e.b.z, nx: e.nx, nz: e.nz, s0: s, len }); s += len; }
    for (const g of segs) if (g.loop === li) g.perimeter = s;
  });
  return { loops: loops.length, segs };
}

/**
 * 在共享 World 上栅格化 patch 输入：每纹素 land/sd（到岸有符号距离，陆正水负）/u（沿岸弧长）/ground。
 */
export function buildPatchField(world, { res = .1, index = null, pad = 1.5 } = {}) {
  if (!world?.grid || !Array.isArray(world.cells)) throw new TypeError('shared World required');
  if (!Number.isFinite(res) || res <= 0 || !Number.isFinite(pad) || pad < 0) throw new RangeError('patch field options');
  if (world.cells.some((c) => !Number.isFinite(c.minX))) decorateCells(world.grid);
  const idx = index ?? buildCellIndex(world.grid), arcs = shoreArcs(world);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of world.cells) if (world.isLand(c)) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
  if (!Number.isFinite(minX)) return null;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const w = Math.ceil((maxX - minX) / res), h = Math.ceil((maxZ - minZ) / res);
  if (w * h > 400000 || w * h * Math.max(1, arcs.segs.length) > 4e8) throw new RangeError('patch field budget');
  const land = new Uint8Array(w * h), SD = new Float32Array(w * h), U = new Float32Array(w * h), loop = new Int16Array(w * h), ground = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = minX + (x + .5) * res, pz = minZ + (y + .5) * res, i = y * w + x, c = idx.cellAt(px, pz);
    const isLand = !!c && world.isLand(c); land[i] = isLand ? 1 : 0; ground[i] = c ? world.ground(c) : 0;
    let best = Infinity, bu = 0, bl = -1;
    for (const g of arcs.segs) {
      const dx = g.bx - g.ax, dz = g.bz - g.az, t = g.len > 0 ? clamp01(((px - g.ax) * dx + (pz - g.az) * dz) / (g.len * g.len)) : 0;
      const d = Math.hypot(px - g.ax - dx * t, pz - g.az - dz * t);
      if (d < best) { best = d; bu = g.s0 + t * g.len; bl = g.loop; }
    }
    SD[i] = (isLand ? 1 : -1) * (Number.isFinite(best) ? best : 1e3); U[i] = bu; loop[i] = bl;
  }
  return { w, h, res, minX, minZ, land, SD, U, loop, ground, loops: arcs.loops, segs: arcs.segs, version: world.version };
}

/* 三种 patch 纹样（程序化替身；坐标单位 = 世界单位）。 */
export function grassColor(x, z, seed = 7) {
  let c = mix3([.45, .62, .34], [.38, .55, .29], vnoise(x * .45, z * .45, seed + 3));
  const s = .7, gx = Math.floor(x / s), gz = Math.floor(z / s);
  const px = (gx + .5 + (hash2(gx, gz, seed + 5) - .5) * .25) * s, pz = (gz + .5 + (hash2(gx, gz, seed + 6) - .5) * .25) * s;
  const d = Math.hypot(x - px, z - pz); if (d < .2) c = mix3(c, [.34, .50, .26], .55 * (1 - d / .2));
  return c;
}
export function waterColor(x, z) {
  const u = (x + z) / .6, v = (x - z) / .8; let c = [.36, .55, .72];
  if (Math.abs(u - Math.round(u)) < .07) c = mix3(c, [.47, .66, .80], .8);
  if (Math.abs(v - Math.round(v)) < .05) c = mix3(c, [.32, .50, .68], .7);
  return c;
}
/** 手工 UV 岸带：u 弧长决定等距白点，v（0=水侧,1=陆侧）决定深浅与白点所在的带。 */
export function shoreColor(u, v, sd, { dotSpacing = .4 } = {}) {
  let c = mix3([.84, .66, .52], [.94, .80, .64], v);
  const dot = Math.abs(u / dotSpacing - Math.round(u / dotSpacing));
  if (dot < .2 && v < .35 && v > .04) c = mix3(c, [.97, .97, .95], .9);
  if (Math.abs(sd + .06) < .035) c = mix3(c, [.76, .57, .44], .3);
  return c;
}

export function makePatches({ shoreHalf = .45, lip = .1, landLift = 0, seed = 7, dotSpacing = .4 } = {}) {
  if (![shoreHalf, lip, landLift].every(Number.isFinite) || shoreHalf <= 0 || lip < 0) throw new RangeError('patch options');
  return [
    { id: 0, name: 'water', mapping: 'project', coverage: (f, i) => f.SD[i] < 0, heightAt: () => 0, color: (x, z) => waterColor(x, z) },
    { id: 1, name: 'shore', mapping: 'uv', coverage: (f, i) => Math.abs(f.SD[i]) <= shoreHalf,
      heightAt: (f, i) => f.SD[i] + lip * (Math.cos(Math.PI * .5 * clamp01(Math.abs(f.SD[i]) / shoreHalf)) ** 2 - .5),
      color: (x, z, f, i) => shoreColor(f.U[i], clamp01(f.SD[i] / shoreHalf * .5 + .5), f.SD[i], { dotSpacing }) },
    { id: 2, name: 'land', mapping: 'project', coverage: (f, i) => f.SD[i] > 0, heightAt: (f, i) => f.SD[i] + f.ground[i] * landLift, color: (x, z) => grassColor(x, z, seed) },
  ];
}

/** mode: 'hard' 最高者硬切 / 'alpha' 覆盖平均 / 'height' 前两名按高度差 smoothstep（原文做法）。 */
export function renderPatches(field, patches, mode = 'height', { band = .1 } = {}) {
  if (!['hard', 'alpha', 'height'].includes(mode) || !Number.isFinite(band) || band <= 0) throw new RangeError('patch render mode');
  const { w, h, res, minX, minZ } = field, data = new Uint8ClampedArray(w * h * 4), ids = new Int8Array(w * h), soft = new Uint8Array(w * h);
  const covHist = { 1: 0, 2: 0, 3: 0 }, cov = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, px = minX + (x + .5) * res, pz = minZ + (y + .5) * res;
    cov.length = 0;
    for (const p of patches) if (p.coverage(field, i)) cov.push({ p, hh: p.heightAt(field, i), c: p.color(px, pz, field, i) });
    if (!cov.length) { const p = patches[field.SD[i] > 0 ? 2 : 0]; cov.push({ p, hh: 0, c: p.color(px, pz, field, i) }); }
    covHist[Math.min(3, cov.length)]++;
    let c, top;
    if (mode === 'alpha') { c = [0, 0, 0]; for (const q of cov) for (let k = 0; k < 3; k++) c[k] += q.c[k] / cov.length; cov.sort((a, b) => b.hh - a.hh); top = cov[0]; }
    else {
      cov.sort((a, b) => b.hh - a.hh); top = cov[0]; c = top.c;
      if (mode === 'height' && cov.length > 1) {
        const w1 = smooth(clamp01(.5 + (cov[0].hh - cov[1].hh) / (2 * band)));
        c = mix3(cov[1].c, cov[0].c, w1); if (w1 < .5) top = cov[1];
        const t = Math.min(w1, 1 - w1); if (t > .1) soft[i] = 1;
      }
    }
    ids[i] = top.p.id; const o = i * 4; data[o] = c[0] * 255; data[o + 1] = c[1] * 255; data[o + 2] = c[2] * 255; data[o + 3] = 255;
  }
  return { data, ids, w, h, covHist, soft };
}

const luma = (d, i) => (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255;
/** 原版 seamStats：边界 ±r 像素带的平均梯度 vs 远离边界的内部梯度；softMeanPx = 过渡带宽。 */
export function seamStats(img, { r = 5, innerGap = 12 } = {}) {
  const { data, ids, w, h } = img, isEdge = new Uint8Array(w * h); let edgeCount = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, id = ids[i]; if (ids[i + 1] !== id || ids[i - 1] !== id || ids[i + w] !== id || ids[i - w] !== id) { isEdge[i] = 1; edgeCount++; } }
  const dilate = (src, rad) => { let a = src, b = new Uint8Array(w * h); for (let k = 0; k < rad; k++) { for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; b[i] = a[i] || a[i + 1] || a[i - 1] || a[i + w] || a[i - w] ? 1 : 0; } [a, b] = [b, a]; } return a; };
  const band = dilate(isEdge, r), excl = dilate(isEdge, innerGap);
  const grad = (i) => Math.hypot(luma(data, i + 1) - luma(data, i - 1), luma(data, i + w) - luma(data, i - w)) * .5;
  let bS = 0, bN = 0, iS = 0, iN = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (band[i]) { bS += grad(i); bN++; } else if (!excl[i]) { iS += grad(i); iN++; } }
  const gradBand = bN ? bS / bN : 0, gradInner = iN ? iS / iN : 0; let softN = 0; for (const s of img.soft) softN += s;
  return { edgePx: edgeCount, bandPx: bN, bandShare: +(bN / (w * h) * 100).toFixed(2), gradBand: +gradBand.toFixed(4), gradInner: +gradInner.toFixed(4), ratio: +(gradInner > 0 ? gradBand / gradInner : 0).toFixed(2), softMeanPx: +(edgeCount ? softN / edgeCount : 0).toFixed(1) };
}
/** 原版 edgeJump：跨 patch 边界一像素的亮度跳跃。 */
export function edgeJump(img) {
  const { data, ids, w, h } = img; let sum = 0, n = 0, max = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; for (const j of [i + 1, i + w]) { if (ids[j] === ids[i]) continue; const d = Math.abs(luma(data, j) - luma(data, i)); sum += d; n++; if (d > max) max = d; } }
  return { n, meanJump: +(n ? sum / n : 0).toFixed(4), maxJump: +max.toFixed(4) };
}
/** 原版 abModes：同一共享 World 上三种合成并列。 */
export function abModes(field, patches = makePatches(), opts = {}) {
  const out = {};
  for (const mode of ['hard', 'alpha', 'height']) { const img = renderPatches(field, patches, mode, opts); out[mode] = { seam: seamStats(img), jump: edgeJump(img), covHist: img.covHist }; }
  const base = out.hard.seam.gradBand || 1;
  for (const k of Object.keys(out)) { out[k].detailKeptPct = +(out[k].seam.gradBand / base * 100).toFixed(0); out[k].jumpCutPct = +((1 - out[k].jump.meanJump / (out.hard.jump.meanJump || 1)) * 100).toFixed(0); }
  return out;
}
