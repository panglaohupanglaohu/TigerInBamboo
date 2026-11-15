/**
 * field-surface-c04.js — 第 56 批 C04：818857408848130048 / 832633189277409280 的剩余机制。
 *
 * field-surface.js 已有：占位场 → 模糊 → surface nets 等值面，按 2D 区块缩没 / 抬升 / 重长。
 * 这里补片子里另外看得到、旧页没做的四样（纯数据，不依赖 three）：
 *   ① 分层：地形走等值面（圆角），房子是独立硬边几何（坡屋顶 / 烟囱 / 门），与地形同一个区块时间窗一起缩、抬、换
 *      （832633189277409280：房子屋脊、门洞清晰可辨，地形却是黏土圆角 → 两套几何）。
 *   ② 过渡碎块变暗：818 帧 0013–0043、832 帧 0082–0086 正在换形态的块明显比成品暗
 *      → 顶点按所在区块的过渡进度给一个暗度（0 = 成品色，1 = 最暗）。
 *   ③ 带状水线：沿水面高度那一层等值面的**外侧等距**画一圈白带（不是旧页的落地格边折线）
 *      → 水面层二维距离场，带 = offset ≤ d ≤ offset + width。
 *   ④ 倒影：页面用镜像几何做真平面反射（水面 y = 常数，镜像 = 关于该平面翻转）；这里给翻转矩阵。
 * 原工具的精确参数不可知，数值是本地选择；结构按片子能看到的现象。
 */
import { chunkPlan, sampleField } from './field-surface.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

/** 一个区块在进度 t 的状态，公式与 field-surface.js morphField 逐项相同（房子据此与地形同步）。 */
export function chunkPhase(c, t, { lift = 3, floor = 0.16 } = {}) {
  if (!c || !Number.isFinite(t)) throw new RangeError('Invalid chunk phase');
  const w = clamp01((t - c.delay) / c.dur), e = smoothstep(w), arc = 4 * w * (1 - w);
  const fromSide = e < 0.5, s = fromSide ? 1 - 2 * w : 2 * w - 1;
  return { w, up: Math.round(lift * arc), fromSide, s, visible: s >= floor, moving: w > 0 && w < 1 };
}

/** 地形盒 + 房子一起做区块计划：房子作为 1×1×1 的"代表盒"进 bucket，取回时按 id 认领。 */
export function layeredPlan(from, to, opts = {}) {
  const tag = (houses, side) => houses.map((h, i) => ({ x: h.x, y: h.y, z: h.z, w: 1, h: 1, d: 1, house: { ...h, id: side + i } }));
  const plan = chunkPlan([...from.terrain, ...tag(from.houses ?? [], 'a')], [...to.terrain, ...tag(to.houses ?? [], 'b')], opts);
  for (const c of plan) {
    c.fromHouses = c.from.filter((b) => b.house).map((b) => b.house);
    c.toHouses = c.to.filter((b) => b.house).map((b) => b.house);
    c.from = c.from.filter((b) => !b.house);
    c.to = c.to.filter((b) => !b.house);
  }
  return plan;
}

/** 进度 t 时所有房子的摆放：区块同一时间窗，缩放 s、抬升 up（格），不可见的不返回。 */
export function housesAt(plan, t, opts = {}) {
  const out = [];
  for (const c of plan) {
    const p = chunkPhase(c, t, opts);
    if (!p.visible) continue;
    for (const h of p.fromSide ? c.fromHouses : c.toHouses) out.push({ ...h, s: p.s, up: p.up, moving: p.moving, chunk: c.key });
  }
  return out;
}

/** 顶点暗度：区块正在换形态（0<w<1）时按"离成品多远"变暗，抬得越高越暗。坐标是场取样点坐标（盒格 +1）。 */
export function transitionDarkness(plan, t, positions, { chunk = 3, lift = 3, floor = 0.16 } = {}) {
  if (!(positions?.length % 3 === 0)) throw new RangeError('Invalid positions');
  const byKey = new Map(plan.map((c) => [c.key, c]));
  const out = new Float32Array(positions.length / 3);
  for (let v = 0; v < out.length; v++) {
    const x = positions[v * 3] - 1, z = positions[v * 3 + 2] - 1;
    const c = byKey.get(Math.floor(x / chunk) + ',' + Math.floor(z / chunk));
    if (!c) continue;
    const p = chunkPhase(c, t, { lift, floor });
    if (!p.moving) continue;
    out[v] = clamp01(.35 + .65 * (1 - p.s) + .15 * p.up / Math.max(1, lift));
  }
  return out;
}

/**
 * 水面那一层的二维外距离（单位：格）。res 倍细分采样场在 y = level 处的值，≥ iso 为陆。
 * 返回 {w, h, res, dist: Float32Array}；陆地内部 dist = 0。两遍 8 邻 chamfer（近似欧氏，误差 < 8%）。
 */
export function waterlineDistance(field, level, { iso = .5, res = 4, span = 0 } = {}) {
  if (!Number.isFinite(level) || !Number.isInteger(res) || res < 1 || res > 16 || !(span >= 0 && span <= 8)) throw new RangeError('Invalid waterline options');
  // span > 0：取 level..level+span 各层的最大值 = 岸边那段崖壁从上往下看的外轮廓（黏土圆角的底边会往里收，只看水面一层白带会藏在崖下）
  const at = (x, z) => { let v = 0; for (let y = level; y <= level + span + 1e-9; y += .5) v = Math.max(v, sampleField(field, x, y, z)); return v; };
  const w = (field.nx - 1) * res + 1, h = (field.nz - 1) * res + 1, dist = new Float32Array(w * h);
  const INF = 1e9;
  for (let k = 0; k < h; k++) for (let i = 0; i < w; i++) dist[k * w + i] = at(i / res, k / res) >= iso ? 0 : INF;
  const a = 1 / res, d = Math.SQRT2 / res;
  for (let k = 0; k < h; k++) for (let i = 0; i < w; i++) {
    let v = dist[k * w + i];
    if (i > 0) v = Math.min(v, dist[k * w + i - 1] + a);
    if (k > 0) { v = Math.min(v, dist[(k - 1) * w + i] + a); if (i > 0) v = Math.min(v, dist[(k - 1) * w + i - 1] + d); if (i < w - 1) v = Math.min(v, dist[(k - 1) * w + i + 1] + d); }
    dist[k * w + i] = v;
  }
  for (let k = h - 1; k >= 0; k--) for (let i = w - 1; i >= 0; i--) {
    let v = dist[k * w + i];
    if (i < w - 1) v = Math.min(v, dist[k * w + i + 1] + a);
    if (k < h - 1) { v = Math.min(v, dist[(k + 1) * w + i] + a); if (i < w - 1) v = Math.min(v, dist[(k + 1) * w + i + 1] + d); if (i > 0) v = Math.min(v, dist[(k + 1) * w + i - 1] + d); }
    dist[k * w + i] = v;
  }
  return { w, h, res, dist };
}

/** 带状水线的 alpha 图（RGBA8，白色）：offset ≤ d ≤ offset+width 不透明，两侧 soft 格软边。 */
export function waterlineBand(distInfo, { offset = .45, width = .55, soft = .18 } = {}) {
  const { w, h, dist } = distInfo, rgba = new Uint8Array(w * h * 4);
  let covered = 0;
  for (let p = 0; p < w * h; p++) {
    const d = dist[p];
    const a = d <= 0 || d > 1e8 ? 0 : smoothstep((d - offset + soft) / soft) * (1 - smoothstep((d - offset - width) / soft));
    rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = Math.round(255 * a);
    if (a > .5) covered++;
  }
  return { rgba, covered };
}

/** 关于水平面 y = h 的镜像矩阵（列主序 4×4，three.js Matrix4.fromArray 可直接用）。 */
export function mirrorMatrixY(h) {
  if (!Number.isFinite(h)) throw new RangeError('Invalid mirror height');
  return [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * h, 0, 1];
}

/**
 * 硬边房子几何（坡屋顶 + 烟囱 + 门洞面），三角形列表，坐标是格（x,z 为房基最小角，y 为房基底）。
 * 832633189277409280 frame 0000：白房子人字屋顶、屋脊、烟囱、门洞清楚 —— 这一半不进等值面。
 */
export function houseTriangles({ w = 2, d = 2, wall = 1.2, roof = .9, chimney = true, door = true } = {}) {
  const tris = [], dark = [];
  const quad = (a, b, c, e, isDark = false) => { tris.push(a, b, c, a, c, e); dark.push(isDark, isDark); };
  const tri = (a, b, c) => { tris.push(a, b, c); dark.push(false); };
  const P = (x, y, z) => [x, y, z];
  // 墙（四面，逆时针朝外）
  quad(P(0, 0, 0), P(w, 0, 0), P(w, wall, 0), P(0, wall, 0));
  quad(P(w, 0, d), P(0, 0, d), P(0, wall, d), P(w, wall, d));
  quad(P(0, 0, d), P(0, 0, 0), P(0, wall, 0), P(0, wall, d));
  quad(P(w, 0, 0), P(w, 0, d), P(w, wall, d), P(w, wall, 0));
  // 人字屋顶：屋脊沿 x，山墙在 x=0 / x=w，出檐 .12
  const o = .12, rh = wall + roof;
  quad(P(-o, wall - .06, -o), P(w + o, wall - .06, -o), P(w + o, rh, d / 2), P(-o, rh, d / 2));
  quad(P(w + o, wall - .06, d + o), P(-o, wall - .06, d + o), P(-o, rh, d / 2), P(w + o, rh, d / 2));
  tri(P(0, wall, 0), P(0, rh, d / 2), P(0, wall, d)); tris.splice(tris.length - 3, 3, P(0, wall, d), P(0, rh, d / 2), P(0, wall, 0));
  tri(P(w, wall, 0), P(w, rh, d / 2), P(w, wall, d));
  if (chimney) { const cx = w * .72, cz = d * .25, s = .22, top = rh + .25, bot = wall + roof * .4;
    quad(P(cx, bot, cz), P(cx + s, bot, cz), P(cx + s, top, cz), P(cx, top, cz));
    quad(P(cx + s, bot, cz + s), P(cx, bot, cz + s), P(cx, top, cz + s), P(cx + s, top, cz + s));
    quad(P(cx, bot, cz + s), P(cx, bot, cz), P(cx, top, cz), P(cx, top, cz + s));
    quad(P(cx + s, bot, cz), P(cx + s, bot, cz + s), P(cx + s, top, cz + s), P(cx + s, top, cz));
    quad(P(cx, top, cz), P(cx + s, top, cz), P(cx + s, top, cz + s), P(cx, top, cz + s)); }
  if (door) { const dx = w * .5 - .2, e = -.012; quad(P(dx, 0, e), P(dx + .4, 0, e), P(dx + .4, .7, e), P(dx, .7, e), true); }
  return { tris, dark };
}

/** 形态：地形盒（进等值面）+ 房子（硬边，不进场）。坐标与 field-surface.html 的 A/B 同一套格。 */
export const LAYERED_SHAPES = {
  A: {
    terrain: [
      { x: 4, y: 0, z: 4, w: 16, h: 6, d: 16 }, { x: 7, y: 6, z: 7, w: 6, h: 3, d: 6 }, { x: 8, y: 9, z: 8, w: 4, h: 5, d: 4 },
      { x: 15, y: 6, z: 9, w: 3, h: 4, d: 3 }, { x: 2, y: 0, z: 12, w: 4, h: 3, d: 6 },
    ],
    houses: [{ x: 15, y: 6, z: 14, w: 3, d: 2 }, { x: 6, y: 6, z: 16, w: 2, d: 2 }, { x: 15, y: 10, z: 9, w: 2, d: 2 }],
  },
  B: {
    terrain: [
      { x: 8, y: 0, z: 6, w: 14, h: 4, d: 9 }, { x: 11, y: 4, z: 8, w: 5, h: 7, d: 5 }, { x: 12, y: 11, z: 9, w: 3, h: 4, d: 3 },
      { x: 17, y: 4, z: 7, w: 3, h: 8, d: 3 }, { x: 4, y: 0, z: 9, w: 5, h: 2, d: 5 },
    ],
    houses: [{ x: 18, y: 4, z: 12, w: 3, d: 2 }, { x: 9, y: 4, z: 12, w: 2, d: 2 }, { x: 5, y: 2, z: 10, w: 2, d: 2 }],
  },
};
