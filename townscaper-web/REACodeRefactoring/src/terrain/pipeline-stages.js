/**
 * pipeline-stages.js — 生成管线的**分阶段慢放**执行器。
 *
 * 两段片子讲的是同一件事：
 *   1654401054828638214「An quaint island being procedurally generated」
 *     —— 平铺的三角网一点点长出来 → 网格被抬起成 3D → 只剩灰模/暗面 → 上色 → 着色后的岛。
 *   1670064751181791233「mimic Thread.Sleep() in Burst」
 *     —— 作者的原话是把时间存进 static unsafe NativeArray，主线程写、job 里读，
 *        于是生成过程可以**按固定预算一帧推一点**，慢到能看清每一阶段。
 *
 * 这里把两件事合成一个东西：
 *   - `stagePlan()` 把管线切成一串带时长的段（种子/三角化/抬升/灰模/上色/掩埋）；
 *   - `StageRunner` 每个 tick 只允许推进 budget 毫秒的**管线时间**，
 *     哪怕真实过去 1000ms，也只走 budget —— 这就是"慢放"的实现方式。
 *     时钟是外部注入的共享盒子（对应那条 NativeArray），runner 自己不计时，
 *     所以同一个 runner 既能被 rAF 驱动，也能被测试按固定步长喂。
 *
 * 三角化是真正的 Bowyer–Watson 增量 Delaunay（片子第 0–12s 那一堆连线就是它的边）：
 * 点是按顺序一个个插进去的，所以"露出多少条边"= "插入到第几个点"。
 */

import { fbm, clamp01, makeRng } from '../core/noise.js';

export const STAGES = ['seed', 'triangulate', 'lift', 'clay', 'color', 'bury'];

/** 共享时钟盒子：主线程写、管线读（Thread.Sleep 那条的类比）。 */
export function createSharedClock(start = 0) {
  let t = start;
  return {
    set(v) { t = v; return t; },
    get() { return t; },
    advanceBy(dt) { t += dt; return t; },
  };
}

/** 圆盘内带抖动的点集：jitter=0 时是正三角栅格。 */
export function islandPoints({ count = 160, radius = 10, seed = 7, jitter = 0.55 } = {}) {
  const rng = makeRng(seed);
  const pts = [];
  const ringStep = (radius * 2) / Math.max(2, Math.round(Math.sqrt(count)));
  for (let z = -radius; z <= radius + 1e-9; z += ringStep * 0.87) {
    const rowOffset = Math.round(z / (ringStep * 0.87)) % 2 ? ringStep * 0.5 : 0;
    for (let x = -radius; x <= radius + 1e-9; x += ringStep) {
      const px = x + rowOffset + (rng() - 0.5) * jitter * ringStep;
      const pz = z + (rng() - 0.5) * jitter * ringStep;
      const r = Math.hypot(px, pz);
      if (r > radius) continue;
      const edge = 1 - clamp01((r - radius * 0.72) / (radius * 0.28));
      pts.push({ x: px, z: pz, edge, index: pts.length });
    }
  }
  return pts.slice(0, count);
}

function circumcircle(a, b, c) {
  const ax = a.x, ay = a.z, bx = b.x, by = b.z, cx = c.x, cy = c.z;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const rx = ax - ux, ry = ay - uy;
  return { x: ux, y: uy, r2: rx * rx + ry * ry };
}

/** Bowyer–Watson 增量 Delaunay；返回三角形顶点下标。 */
export function delaunay(points, { onInsert = null } = {}) {
  const n = points.length;
  if (n < 3) return [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 1) * 40;
  const all = points.concat([
    { x: cx - span, z: cz - span }, { x: cx + span, z: cz - span }, { x: cx, z: cz + span },
  ]);
  let tris = [[n, n + 1, n + 2]];
  for (let i = 0; i < n; i++) {
    const p = all[i];
    const bad = [];
    for (const t of tris) {
      const cc = circumcircle(all[t[0]], all[t[1]], all[t[2]]);
      if (!cc) continue;
      const dx = p.x - cc.x, dz = p.z - cc.y;
      if (dx * dx + dz * dz < cc.r2 * (1 - 1e-9)) bad.push(t);
    }
    const count = new Map();
    const edges = [];
    for (const t of bad) {
      for (let e = 0; e < 3; e++) {
        const a = t[e], b = t[(e + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        const seen = count.get(key);
        if (seen) seen.n++;
        else { const rec = { a, b, n: 1 }; count.set(key, rec); edges.push(rec); }
      }
    }
    const badSet = new Set(bad);
    tris = tris.filter((t) => !badSet.has(t));
    for (const e of edges) if (e.n === 1) tris.push([e.a, e.b, i]);
    if (onInsert) onInsert(i, tris.length);
  }
  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

/** 网格体检：边数、边界边、Delaunay 违例、面积。 */
export function meshReport(points, tris) {
  const edgeCount = new Map();
  let area = 0;
  for (const t of tris) {
    const [a, b, c] = t.map((i) => points[i]);
    area += Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
    for (let e = 0; e < 3; e++) {
      const i = t[e], j = t[(e + 1) % 3];
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }
  let boundaryEdges = 0, interiorEdges = 0, nonManifold = 0;
  for (const v of edgeCount.values()) {
    if (v === 1) boundaryEdges++;
    else if (v === 2) interiorEdges++;
    else nonManifold++;
  }
  let violations = 0;
  for (const t of tris) {
    const cc = circumcircle(points[t[0]], points[t[1]], points[t[2]]);
    if (!cc) continue;
    for (let i = 0; i < points.length; i++) {
      if (t.includes(i)) continue;
      const dx = points[i].x - cc.x, dz = points[i].z - cc.y;
      if (dx * dx + dz * dz < cc.r2 * (1 - 1e-7)) { violations++; break; }
    }
  }
  return { tris: tris.length, edges: edgeCount.size, boundaryEdges, interiorEdges, nonManifold, violations, area };
}

/** 每个顶点的高度（层数，0 = 水面）。片子里网格是先平铺、再被抬起来的。 */
export function liftHeights(points, { seed = 7, levels = 6, radius = 10 } = {}) {
  return points.map((p) => {
    const u = p.x / (radius * 2) + 0.5, v = p.z / (radius * 2) + 0.5;
    const r = Math.hypot(p.x, p.z);
    const shore = clamp01((radius - r) / (radius * 0.3));
    let e = fbm(u * 1.9, v * 1.9, { octaves: 3, freq: 2.1, seed });
    e = clamp01(e * 1.35 - 0.18) * shore;
    if (r > radius - 0.9 || e < 0.12) return 0;
    const k = (e - 0.12) / 0.88;
    return Math.max(1, Math.min(levels, Math.round(Math.pow(k, 0.8) * levels)));
  });
}

/** 分阶段时长表；顺序固定在 STAGES。 */
export function stagePlan({ durations = {} } = {}) {
  const base = { seed: 120, triangulate: 2600, lift: 1400, clay: 900, color: 900, bury: 1200 };
  let at = 0;
  return STAGES.map((stage) => {
    const ms = durations[stage] ?? base[stage];
    const seg = { stage, ms, start: at, end: at + ms };
    at += ms;
    return seg;
  });
}

export class StageRunner {
  /**
   * @param {{plan?:object[], clock?:object, budget?:number}} opts
   *   budget = 每个 tick 允许推进的管线毫秒数（慢放倍率的来源）
   */
  constructor({ plan = stagePlan(), clock = createSharedClock(), budget = 16 } = {}) {
    if (!Array.isArray(plan) || plan.length !== STAGES.length) throw new RangeError('stage plan must cover STAGES');
    if (!(budget > 0)) throw new RangeError('budget must be > 0');
    this.plan = plan;
    this.clock = clock;
    this.budget = budget;
    this.elapsed = 0;
    this.ticks = 0;
    this.total = plan[plan.length - 1].end;
  }

  /** 推进一帧；realDt 是真实经过的毫秒，内部按 budget 截断。 */
  advance(realDt = 0) {
    const step = Math.max(0, Math.min(this.budget, Number(realDt) || 0));
    this.elapsed = Math.min(this.total, this.elapsed + step);
    this.ticks++;
    this.clock.set(this.elapsed);
    return this.state;
  }

  /** 直接跳到某阶段结束（页面上的"快进到这一阶段"）。 */
  seek(stage) {
    const seg = this.plan.find((s) => s.stage === stage);
    if (!seg) throw new RangeError(`unknown stage ${stage}`);
    this.elapsed = seg.end;
    this.clock.set(this.elapsed);
    return this.state;
  }

  /**
   * 停在某段的进度上，但仍归属这一段（页面要"显示这一阶段"时用。
   * seek() 落在段末尾 = 下一段的开头，直接拿它画画会画成下一段）。
   */
  seekTo(stage, progress = 1) {
    const seg = this.plan.find((s) => s.stage === stage);
    if (!seg) throw new RangeError(`unknown stage ${stage}`);
    const p = Math.max(0, Math.min(1, progress));
    this.elapsed = Math.min(seg.end - 1, seg.start + seg.ms * p);
    this.clock.set(this.elapsed);
    return this.state;
  }

  get state() {
    const done = this.elapsed >= this.total;
    let seg = this.plan[this.plan.length - 1];
    for (const s of this.plan) if (this.elapsed < s.end) { seg = s; break; }
    const stageProgress = done ? 1 : clamp01((this.elapsed - seg.start) / seg.ms);
    return {
      stage: done ? 'done' : seg.stage,
      index: plan_index(this.plan, seg.stage),
      elapsed: this.elapsed,
      total: this.total,
      progress: this.elapsed / this.total,
      stageProgress,
      done,
      completed: this.plan.filter((s) => this.elapsed >= s.end).map((s) => s.stage),
    };
  }
}

function plan_index(plan, stage) {
  const i = plan.findIndex((s) => s.stage === stage);
  return i < 0 ? plan.length - 1 : i;
}

/**
 * 到当前进度为止"已经插入的点数"——三角化阶段的可见进度。
 * 片子里线是一条条长出来的，就是这个数在涨。
 */
export function revealedPoints(state, total, { seed = 91 } = {}) {
  const seg = state.completed.includes('triangulate') ? 1 : state.stage === 'triangulate' ? state.stageProgress : 0;
  return Math.max(0, Math.min(total, Math.round(seg * total)));
}

/** 供页面/测试用的一步到位装配。 */
export function buildIsland({ count = 160, radius = 10, seed = 7 } = {}) {
  const points = islandPoints({ count, radius, seed });
  const tris = delaunay(points);
  const heights = liftHeights(points, { seed, radius });
  const shuffled = points.map((_, i) => i);
  const rng = makeRng(seed + 17);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { points, tris, heights, order: shuffled, report: meshReport(points, tris) };
}
