/**
 * terrain-strokes-c09.js — 第 56 批 C09-D：把「地形管线实际输出的几何」变成线稿笔画。
 *
 * 1447483550257799171 / 1579474420749725696：彩色岛 ↔ 白线逐笔累积成岛轮廓，线就是岛本身的崖壁/台地边。
 * 1579478470098243584：线框阶段画的是格笼（cell cage）——每层切面的形变多边形 + 角点竖向笼边。
 *
 *   surfaceSegments(world.terrainSurface)  terrainmesh 记录的真实墙四边形 + 顶面扇形外边 → 线段
 *   cageSegments(world, shape)              shape.at 连续切面的格笼（竖边按分数层采样，看得出弯曲）
 *   terrainStrokes(...)                     线段去重 + 串成折线（一笔 = 一条连续线）
 *
 * 纯函数：只读 World / terrainSurface / shape，不改任何东西。
 */

import { chainSegments, dedupeSegments } from '../core/stroke-reveal-c09.js';

/** terrainSurface（world.terrainCollide 时由 terrainmesh 记录）→ 3D 线段。 */
export function surfaceSegments(surface, { strata = true, verticals = true, rims = true } = {}) {
  if (!surface?.walls || !surface?.tops) throw new RangeError('surfaceSegments needs World.terrainSurface');
  const segs = [];
  for (const w of surface.walls) {
    const [A, B, C, D] = w.q;
    if (verticals) { segs.push([A, D]); segs.push([B, C]); }
    if (strata) { segs.push([A, B]); segs.push([D, C]); }
  }
  if (rims) for (const t of surface.tops) segs.push([t.t[1], t.t[2]]);   // 扇形外边 = 格边
  return dedupeSegments(segs.map((s) => [s[0].slice(), s[1].slice()]));
}

/** 格笼线段：每个岩石格每个切面的形变多边形 + 每个角点的竖向笼边（每层 sub 段，分数层采样）。 */
export function cageSegments(world, shape, { L = 0.5, sub = 3, minLevel = 1 } = {}) {
  const segs = [];
  for (const c of world.cells) {
    const g = world.ground(c);
    if (g < minLevel) continue;
    for (let s = 0; s <= g; s++) {
      const ring = c.pts.map((p) => shape.at(p, s));
      for (let i = 0; i < c.n; i++) {
        const a = ring[i], b = ring[(i + 1) % c.n];
        segs.push([[a[0], s * L, a[1]], [b[0], s * L, b[1]]]);
      }
    }
    for (const p of c.pts) {
      for (let k = 0; k < g * sub; k++) {
        const s0 = k / sub, s1 = (k + 1) / sub;
        const a = shape.at(p, s0), b = shape.at(p, s1);
        segs.push([[a[0], s0 * L, a[1]], [b[0], s1 * L, b[1]]]);
      }
    }
  }
  return dedupeSegments(segs);
}

/** 线段 → 笔画（折线）。maxPoints 限制单笔长度，避免一笔画完整座岛。 */
export function terrainStrokes(segs, { maxPoints = 24 } = {}) {
  return chainSegments(segs, { maxPoints });
}

/** 包围盒（取景 / 测试用）。 */
export function strokeBounds(strokes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const s of strokes) for (const p of s) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return { lo, hi };
}
