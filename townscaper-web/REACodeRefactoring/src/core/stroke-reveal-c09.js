/**
 * stroke-reveal-c09.js — 第 56 批 C09-D：把 stroke-reveal.js 的「错峰 + 按弧长裁剪」扩到
 *   ① 3D 折线（地形管线输出的崖壁/台地边线，1447483550257799171、1579474420749725696、1579478470098243584）；
 *   ② 多图层时间轴 + 每轮换岛（1448039167057879048「nice timing and visualization」：
 *      三角剖分帐篷 → 点阵 → 逐笔线稿 → 线网 → 等高线 → 着色，4 轮、每轮一座新岛）。
 *
 * 排期仍然由共享的 createStrokeReveal 做（不改它）：3D 折线先「摊平」成 1D 弧长折线交给它排期，
 * 拿回每笔的进度后再在 3D 里按弧长裁剪。
 */

import { createStrokeReveal } from './stroke-reveal.js';

const dist = (a, b) => {
  let s = 0;
  for (let k = 0; k < a.length; k++) { const d = b[k] - a[k]; s += d * d; }
  return Math.sqrt(s);
};

/** 任意维折线弧长。 */
export function polylineLengthN(points) {
  let t = 0;
  for (let i = 1; i < points.length; i++) t += dist(points[i - 1], points[i]);
  return t;
}

/** 任意维折线取前 length（末端插值）。 */
export function trimPolylineN(points, length) {
  if (!points.length || !(length > 0)) return [];
  const out = [points[0].slice()];
  let remain = length;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], seg = dist(a, b);
    if (seg === 0) continue;
    if (remain >= seg) { out.push(b.slice()); remain -= seg; continue; }
    const f = remain / seg;
    out.push(a.map((v, k) => v + (b[k] - v) * f));
    return out;
  }
  return out;
}

/**
 * 3D（或任意维）逐笔描出：返回与 createStrokeReveal 相同的接口，sampleAt 给出 3D 点。
 */
export function createStrokeReveal3D({ strokes, ...opts }) {
  const kept = [];
  for (const s of strokes) {
    const pts = [];
    for (const p of s) { if (!pts.length || dist(pts[pts.length - 1], p) > 1e-12) pts.push(p.slice()); }
    if (pts.length >= 2 && polylineLengthN(pts) > 0) kept.push(pts);
  }
  if (!kept.length) throw new RangeError('no drawable 3D stroke');
  // 摊平：x = 累计弧长 → 共享排期器看到的长度与 3D 弧长完全一致
  const flat = kept.map((pts) => { let acc = 0; return pts.map((p, i) => { if (i) acc += dist(pts[i - 1], p); return [acc, 0]; }); });
  const rv = createStrokeReveal({ strokes: flat, ...opts });
  const lens = kept.map(polylineLengthN);
  return {
    endTime: rv.endTime,
    duration: rv.duration,
    totalLength: rv.totalLength,
    strokeCount: rv.strokeCount,
    plan: rv.plan,
    statsAt: rv.statsAt,
    sampleAt(t) {
      return rv.sampleAt(t).map((s) => ({
        index: s.index, order: s.order, progress: s.progress,
        points: s.progress >= 1 ? kept[s.index].map((p) => p.slice()) : trimPolylineN(kept[s.index], lens[s.index] * s.progress),
      })).filter((s) => s.points.length >= 2);
    },
  };
}

/**
 * 线段集合 → 折线：共享端点（量化到 eps）的线段贪心串起来。
 * 线稿里「一笔」就是一条连着画下去的线，不是孤立的短边。
 */
export function chainSegments(segs, { eps = 1e-4, maxPoints = 64 } = {}) {
  const key = (p) => p.map((v) => Math.round(v / eps)).join(',');
  const at = new Map();
  segs.forEach((s, i) => {
    for (const end of [0, 1]) { const k = key(s[end]); let a = at.get(k); if (!a) at.set(k, a = []); a.push(i); }
  });
  const used = new Uint8Array(segs.length);
  const out = [];
  const extend = (line) => {
    for (;;) {
      if (line.length >= maxPoints) return;
      const tail = line[line.length - 1];
      const next = (at.get(key(tail)) ?? []).find((j) => !used[j]);
      if (next === undefined) return;
      used[next] = 1;
      const s = segs[next];
      line.push((key(s[0]) === key(tail) ? s[1] : s[0]).slice());
    }
  };
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i][0].slice(), segs[i][1].slice()];
    extend(line);
    line.reverse();
    extend(line);
    out.push(line);
  }
  return out;
}

/** 线段去重（无向，端点量化）。 */
export function dedupeSegments(segs, eps = 1e-4) {
  const key = (p) => p.map((v) => Math.round(v / eps)).join(',');
  const seen = new Set(), out = [];
  for (const s of segs) {
    const a = key(s[0]), b = key(s[1]);
    if (a === b) continue;
    const k = a < b ? a + '|' + b : b + '|' + a;
    if (seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out;
}

/**
 * 多图层时间轴：layers = [{name, duration}]，按顺序一层层播，播完一轮换下一轮（rounds 轮，循环）。
 * at(t) → { round, layer, index, local, norm, roundTime, loop }
 */
export function createLayerTimeline(layers, { rounds = 4, loop = true } = {}) {
  if (!Array.isArray(layers) || !layers.length) throw new RangeError('layers required');
  let acc = 0;
  const segs = layers.map((l, i) => {
    if (!(l.duration > 0)) throw new RangeError('layer duration must be > 0: ' + l.name);
    const s = { name: l.name, index: i, start: acc, end: acc + l.duration, duration: l.duration };
    acc += l.duration;
    return s;
  });
  const roundLength = acc;
  const total = roundLength * rounds;
  return {
    layers: segs, roundLength, total, rounds,
    at(t) {
      let time = Number.isFinite(t) ? Math.max(0, t) : 0;
      if (loop) time %= total; else time = Math.min(time, total - 1e-9);
      const round = Math.min(rounds - 1, Math.floor(time / roundLength));
      const rt = time - round * roundLength;
      const seg = segs.find((s) => rt < s.end) ?? segs[segs.length - 1];
      const local = rt - seg.start;
      return { round, layer: seg.name, index: seg.index, local, norm: Math.min(1, local / seg.duration), roundTime: rt, time };
    },
    /** 第 round 轮第 layer 层的开始时刻（截图 / 测试定格用）。 */
    timeOf(round, layer, norm = 0) {
      const seg = segs.find((s) => s.name === layer);
      if (!seg) throw new RangeError('unknown layer ' + layer);
      return round * roundLength + seg.start + seg.duration * Math.max(0, Math.min(1, norm));
    },
  };
}

/** 每轮一座岛：轮次 → 种子（确定性，相邻轮必不同）。 */
export function roundSeed(base, round) {
  return ((base | 0) * 7919 + round * 104729 + 13) % 99991 + 1;
}
