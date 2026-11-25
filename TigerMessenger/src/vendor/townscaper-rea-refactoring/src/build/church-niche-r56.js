/**
 * church-niche-r56.js — 跨两层的教堂高拱龛门（第 56 批 C05·C）。
 *
 * 片子 1275089608758484992（2020-06-22 "... I've been making church doors and ladders"）：0026 帧起，原本单层的
 * 门被换成一个跨两层的高拱龛：墙体被挖开（矩形段 + 半圆拱顶），洞口一圈石框，洞有厚度（两侧和拱腹看得到），
 * 洞内后墙换成另一种颜色（片中为蓝），后墙上自上而下三处开口：菱形窗、四格方窗、双开门（门顶一道半圆扇窗），
 * 洞前两级台阶下到码头。梯子（同帖 ladders）由已有的 core/ladder-profile.js + world/navlayer.js 木梯负责，这里不重复。
 *
 * 做法：房子原本的门（buildings.js door 表）所在墙边，若第 2、3 层都是本楼、外侧都空、墙够宽 → 改成高拱龛：
 *   - 返回 hole（{t,y,width,height}），buildings.js 两层墙体都交给已有的 wallStrip(hole) 留洞
 *     （wallStrip 会把洞按每层 [yA,yB] 截断，跨两层天然成立）；
 *   - 在 placed 表（门窗放置的同层排斥表）里给 2、3 两层预留洞口半宽 → 原门 / 窗不会再落进龛里；
 *   - 自己画：石框（两侧立框 + 拱圈）、侧壁、拱腹、龛底、后墙（另色）、后墙小拱门、圆窗、洞前两级台阶。
 * 开关 world.churchDoors（默认关）。关时 buildings.js 不调用本模块，几何逐项不变（测试断言）。
 */
import { edgeOut, UP } from '../core/meshwriter.js';

const mix = (a, b, t) => a + (b - a) * t;
export const NICHE_INNER = '#5b86c4';

/** 龛的尺寸（世界单位）。edgeLen 太短返回 null。 */
export function nicheShape(edgeLen, L) {
  const width = Math.min(0.34, edgeLen * 0.6);
  if (width < 0.2) return null;
  const y = L + 0.06, top = 3 * L - 0.08, height = top - y, rad = width / 2;
  return { t: 0.5, y, width, height, rad, spring: top - rad, depth: 0.12, frame: 0.03 };
}

/**
 * 预计算全部龛并画出龛体几何。
 * ctx: { L, K, door: Map(house → {key}), house: Int32Array, placed: Map(lv → [[x,z,hw]]), wallColor(c), log: [] }
 * 返回 Map('cellId:edge' → hole)
 */
export function churchNiches(w, world, ctx) {
  const { L, K, door, house, placed, wallColor, log } = ctx;
  const holes = new Map();
  for (const { key } of door.values()) {
    const [cid, ei] = key.split(':').map(Number), c = world.cells[cid], nb = world.neighbor(c, ei);
    if (!c || !world.isBuilt(c, 2) || !world.isBuilt(c, 3) || (nb && (world.isSolid(nb, 2) || world.isSolid(nb, 3)))) continue;
    const a = c.pts[ei], b = c.pts[(ei + 1) % c.n], len = Math.hypot(b.x - a.x, b.z - a.z);
    const S = nicheShape(len, L);
    if (!S) continue;
    const hole = { t: S.t, y: S.y, width: S.width, height: S.height };
    holes.set(key, hole);
    // 预留：2、3 两层同层排斥（与 tryPlace 同一张表、同一种圆形半宽）
    const mx = mix(a.x, b.x, S.t), mz = mix(a.z, b.z, S.t), hw = S.width / 2 + S.frame;
    for (const lv of [2, 3]) (placed.get(lv) || placed.set(lv, []).get(lv)).push([mx, mz, hw]);
    w.at?.(c);
    const back = drawNiche(w, c, ei, S, { K, wall: wallColor(c), inner: w.c(NICHE_INNER), L });
    log?.push({ cell: cid, edge: ei, house: house[cid], ...S, ...back, levels: [2, 3], bottom: S.y, top: S.y + S.height });
  }
  return holes;
}

function drawNiche(w, c, i, S, { K, wall, inner, L }) {
  const a = c.pts[i], b = c.pts[(i + 1) % c.n], [nx, nz] = edgeOut(c, i), len = Math.hypot(b.x - a.x, b.z - a.z);
  const ex = (b.x - a.x) / len, ez = (b.z - a.z) / len, out = [nx, 0, nz];
  const P = (x, y, o) => [mix(a.x, b.x, S.t + x / len) + nx * o, y, mix(a.z, b.z, S.t + x / len) + nz * o];
  const { rad, spring, depth: d, frame, y } = S, N = 14;
  const reveal = wall.clone().multiplyScalar(0.62);
  const arc = (k, r, o) => { const an = Math.PI - (k * Math.PI) / N; return P(Math.cos(an) * r, spring + Math.sin(an) * r, o); };
  // 石框：两侧立框 + 拱圈
  for (const side of [-1, 1]) {
    const x0 = side * rad, x1 = side * (rad + frame);
    w.quad(P(Math.min(x0, x1), y - 0.02, 0.01), P(Math.max(x0, x1), y - 0.02, 0.01), P(Math.max(x0, x1), spring, 0.01), P(Math.min(x0, x1), spring, 0.01), out, K.frame, 1);
  }
  for (let k = 0; k < N; k++) w.quad(arc(k + 1, rad, 0.01), arc(k + 1, rad + frame, 0.01), arc(k, rad + frame, 0.01), arc(k, rad, 0.01), out, K.frame, k === N / 2 || k === N / 2 - 1 ? 0.9 : 1);
  // 侧壁、龛底
  w.quad(P(-rad, y, 0), P(-rad, y, -d), P(-rad, spring, -d), P(-rad, spring, 0), [ex, 0, ez], reveal, 1);
  w.quad(P(rad, y, 0), P(rad, spring, 0), P(rad, spring, -d), P(rad, y, -d), [-ex, 0, -ez], reveal, 1);
  w.quad(P(-rad, y, 0), P(rad, y, 0), P(rad, y, -d), P(-rad, y, -d), UP, K.stone, 0.85);
  // 拱腹
  for (let k = 0; k < N; k++) {
    const an = Math.PI - ((k + 0.5) * Math.PI) / N;
    w.quad(arc(k, rad, 0), arc(k + 1, rad, 0), arc(k + 1, rad, -d), arc(k, rad, -d), [-Math.cos(an) * ex, -Math.sin(an), -Math.cos(an) * ez], reveal, 0.85);
  }
  // 后墙（另色）：矩形段 + 拱顶扇
  w.quad(P(-rad, y, -d), P(rad, y, -d), P(rad, spring, -d), P(-rad, spring, -d), out, inner, 0.9);
  for (let k = 0; k < N; k++) w.tri(P(0, spring, -d), arc(k + 1, rad, -d), arc(k, rad, -d), out, inner, 0.9);
  // 后墙开口：原片 0120 / 0160 帧逐项对齐 —— 底部是双开门 + 半圆扇窗，中部一扇四格方窗，顶部一枚菱形窗。
  // （旧版是「小拱门 + 圆窗」，三处开口的形制与原片都对不上，2026-11-17 第 117 轮按 3× 放大帧重画。）
  const o = -d + 0.006;
  const R = (xa, ya, xb, yb, oo, col, shade) => w.quad(P(Math.min(xa, xb), ya, oo), P(Math.max(xa, xb), ya, oo), P(Math.max(xa, xb), yb, oo), P(Math.min(xa, xb), yb, oo), out, col, shade);
  const dw = rad * 0.55, dh = Math.min(L * 0.42, (spring - y) * 0.45), ds = y + dh;   // 门洞：y..ds，半宽 dw
  // 门框背板 + 两扇门 + 每扇两道横档（原片门扇是 3 格）
  R(-dw - 0.014, y, dw + 0.014, ds + 0.01, o - 0.003, K.frame, 1);
  for (const s of [-1, 1]) {
    R(Math.min(s * 0.004, s * dw), y + 0.008, Math.max(s * 0.004, s * dw), ds - 0.004, o, K.door, 1);
    for (let k = 1; k < 3; k++) { const yy = y + (dh - 0.012) * k / 3; R(Math.min(s * 0.004, s * dw), yy - 0.0025, Math.max(s * 0.004, s * dw), yy + 0.0025, o + 0.001, K.frame, 0.92); }
  }
  // 扇窗：门顶半圆玻璃 + 外圈石框 + 7 道辐射档
  const arcD = (k, r, oo) => { const an = (k * Math.PI) / 8; return P(Math.cos(an) * r, ds + Math.sin(an) * r, oo); };
  for (let k = 0; k < 8; k++) w.tri(P(0, ds, o), arcD(k, dw, o), arcD(k + 1, dw, o), out, K.glass, 1);
  for (let k = 0; k < 8; k++) w.quad(arcD(k, dw, o + 0.001), arcD(k + 1, dw, o + 0.001), arcD(k + 1, dw + 0.012, o + 0.001), arcD(k, dw + 0.012, o + 0.001), out, K.frame, 1);
  for (let k = 1; k < 8; k++) {
    const an = (k * Math.PI) / 8, ax2 = Math.cos(an) * dw, ay2 = ds + Math.sin(an) * dw, px = -Math.sin(an) * 0.0035, py = Math.cos(an) * 0.0035;
    w.quad(P(px, ds + py, o + 0.002), P(ax2 + px, ay2 + py, o + 0.002), P(ax2 - px, ay2 - py, o + 0.002), P(-px, ds - py, o + 0.002), out, K.frame, 0.95);
  }
  // 中部四格方窗：白框 + 十字档 + 窗台
  const dyTop = spring + rad * 0.3;                       // 菱形窗心（拱顶区）
  const sw = Math.min(rad * 0.36, (dyTop - rad * 0.3 - ds - dw) * 0.28), sy = (ds + dw + dyTop - rad * 0.3) / 2;
  R(-sw - 0.011, sy - sw - 0.011, sw + 0.011, sy + sw + 0.011, o - 0.002, K.frame, 1);
  R(-sw, sy - sw, sw, sy + sw, o, K.glass, 1);
  R(-sw, sy - 0.0035, sw, sy + 0.0035, o + 0.001, K.frame, 0.95);
  R(-0.0035, sy - sw, 0.0035, sy + sw, o + 0.001, K.frame, 0.95);
  R(-sw - 0.014, sy - sw - 0.017, sw + 0.014, sy - sw - 0.008, o + 0.001, K.frame, 0.9);
  // 顶部菱形窗（斜置方形：外白框 + 内玻璃）
  const dd = rad * 0.3;
  const dia = (sc, oo, col, shade) => {
    const r2 = dd * sc;
    w.tri(P(0, dyTop + r2, oo), P(r2, dyTop, oo), P(0, dyTop - r2, oo), out, col, shade);
    w.tri(P(0, dyTop + r2, oo), P(-r2, dyTop, oo), P(0, dyTop - r2, oo), out, col, shade);
  };
  dia(1.3, o - 0.001, K.frame, 1);
  dia(1, o, K.glass, 1);
  // 洞前两级台阶（落到码头面 L+.006）
  const base = L + 0.006, steps = 2, rise = (y - base) / steps, run = 0.05, sw2 = rad + frame + 0.02;
  for (let s = 0; s < steps; s++) {
    const yt = y - s * rise, o0 = s * run, o1 = (s + 1) * run;
    w.quad(P(-sw2, yt, o0), P(sw2, yt, o0), P(sw2, yt, o1), P(-sw2, yt, o1), UP, K.stone, 1.05 - s * 0.05);
    w.quad(P(-sw2, yt - rise, o1), P(sw2, yt - rise, o1), P(sw2, yt, o1), P(-sw2, yt, o1), out, K.stoneDark, 0.9);
    w.quad(P(-sw2, yt - rise, o0), P(-sw2, yt - rise, o1), P(-sw2, yt, o1), P(-sw2, yt, o0), [-ex, 0, -ez], K.stoneDark, 0.8);
    w.quad(P(sw2, yt - rise, o1), P(sw2, yt - rise, o0), P(sw2, yt, o0), P(sw2, yt, o1), [ex, 0, ez], K.stoneDark, 0.8);
  }
  // 后墙开口的可观测量（浏览器验收按这几项对账：位置必须落在龛内、互不重叠、台阶落到码头面）
  return { backWall: { doorFrom: y, doorTo: ds, doorHalf: dw, fanRadius: dw, squareY: sy, squareHalf: sw, diamondY: dyTop, diamondHalf: dd }, steps: { count: steps, rise, run, top: y, base, halfWidth: sw2 } };
}
