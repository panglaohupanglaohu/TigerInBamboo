/**
 * church-niche-r56.js — 跨两层的教堂高拱龛门（第 56 批 C05·C）。
 *
 * 片子 1275089608758484992（2020-06-22 "... I've been making church doors and ladders"）：0026 帧起，原本单层的
 * 门被换成一个跨两层的高拱龛：墙体被挖开（矩形段 + 半圆拱顶），洞口一圈石框，洞有厚度（两侧和拱腹看得到），
 * 洞内后墙换成另一种颜色（片中为蓝），后墙底部再开一道小拱门，上方一扇圆窗，洞前两级台阶下到码头。
 * 梯子（同帖 ladders）由已有的 core/ladder-profile.js + world/navlayer.js 木梯负责，这里不重复。
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
    drawNiche(w, c, ei, S, { K, wall: wallColor(c), inner: w.c(NICHE_INNER), L });
    log?.push({ cell: cid, edge: ei, house: house[cid], ...S, levels: [2, 3], bottom: S.y, top: S.y + S.height });
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
  // 后墙底部小拱门（带框）
  const dr = Math.min(0.055, rad * 0.45), dh = Math.min(0.24, L * 0.48), ds = y + dh - dr, o = -d + 0.006;
  const dp = (k, r, oo) => { const an = Math.PI - (k * Math.PI) / 8; return P(Math.cos(an) * r, ds + Math.sin(an) * r, oo); };
  w.quad(P(-dr - 0.015, y, o - 0.002), P(dr + 0.015, y, o - 0.002), P(dr + 0.015, ds, o - 0.002), P(-dr - 0.015, ds, o - 0.002), out, K.frame, 1);
  for (let k = 0; k < 8; k++) w.quad(dp(k + 1, dr, o - 0.002), dp(k + 1, dr + 0.015, o - 0.002), dp(k, dr + 0.015, o - 0.002), dp(k, dr, o - 0.002), out, K.frame, 1);
  w.quad(P(-dr, y, o), P(dr, y, o), P(dr, ds, o), P(-dr, ds, o), out, K.door, 1);
  for (let k = 0; k < 8; k++) w.tri(P(0, ds, o), dp(k + 1, dr, o), dp(k, dr, o), out, K.door, 1);
  // 圆窗（玫瑰窗）：门上方
  const wr = Math.min(0.05, rad * 0.4), wy = Math.min(spring, ds + dr + 0.12 + wr);
  for (let k = 0; k < 12; k++) {
    const t0 = (k * 2 * Math.PI) / 12, t1 = ((k + 1) * 2 * Math.PI) / 12, Q = (t, r, oo) => P(Math.cos(t) * r, wy + Math.sin(t) * r, oo);
    w.quad(Q(t0, wr, o), Q(t1, wr, o), Q(t1, wr + 0.012, o), Q(t0, wr + 0.012, o), out, K.frame, 1);
    w.tri(P(0, wy, o + 0.001), Q(t0, wr, o + 0.001), Q(t1, wr, o + 0.001), out, K.glass, 1, 1, 1, 1);
  }
  // 洞前两级台阶（落到码头面 L+.006）
  const base = L + 0.006, steps = 2, rise = (y - base) / steps, run = 0.05, sw = rad + frame + 0.02;
  for (let s = 0; s < steps; s++) {
    const yt = y - s * rise, o0 = s * run, o1 = (s + 1) * run;
    w.quad(P(-sw, yt, o0), P(sw, yt, o0), P(sw, yt, o1), P(-sw, yt, o1), UP, K.stone, 1.05 - s * 0.05);
    w.quad(P(-sw, yt - rise, o1), P(sw, yt - rise, o1), P(sw, yt, o1), P(-sw, yt, o1), out, K.stoneDark, 0.9);
    w.quad(P(-sw, yt - rise, o0), P(-sw, yt - rise, o1), P(-sw, yt, o1), P(-sw, yt, o0), [-ex, 0, -ez], K.stoneDark, 0.8);
    w.quad(P(sw, yt - rise, o1), P(sw, yt - rise, o0), P(sw, yt, o0), P(sw, yt, o1), [ex, 0, ez], K.stoneDark, 0.8);
  }
}
