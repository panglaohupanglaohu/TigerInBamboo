/**
 * 1448039167057879048 / 1447483550257799171: staged pen-draw reveal.
 *
 * 原片里岛屿生成的"可视化"不是淡入，而是**一笔一笔描出来**：黑底上白线从零散几段
 * 逐步累积成整张等高线图，画完停一会再换下一座岛。也就是说每条笔画有自己的开始
 * 时刻（错峰）和自己画完的耗时（与长度相关），全部在总时长内收尾。
 *
 * 本模块只做这件事的**排期 + 按弧长裁剪**，不碰渲染：
 *   - 每条折线算累计弧长；
 *   - 按 `stagger` 错峰分配起始延迟，按长度权重分配单笔耗时；
 *   - 任意时刻 t 给出每条折线"已画出的那一段"（末端按弧长插值，不跳格）。
 *
 * 纯函数 + 确定性（`order:'random'` 也是固定种子的洗牌），方便 node 测试。
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function normalizePoints(points) {
  if (!Array.isArray(points)) throw new TypeError('stroke points must be an array');
  const out = [];
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2) throw new TypeError('stroke point must be [x,y]');
    const x = Number(p[0]), y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('stroke point must be finite');
    const last = out[out.length - 1];
    if (last && last[0] === x && last[1] === y) continue; // 去掉重复点，避免零长段
    out.push([x, y]);
  }
  return out;
}

export function polylineLength(points) {
  const pts = normalizePoints(points);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return total;
}

/**
 * 从头开始取折线的前 `length` 段。末端落在某一段内部时按比例插值，
 * 这样逐帧推进看起来才是"笔在纸上走"，而不是整段跳出来。
 */
export function trimPolyline(points, length) {
  const pts = normalizePoints(points);
  if (pts.length === 0 || !(length > 0)) return [];
  if (pts.length === 1) return [pts[0].slice()];
  const out = [pts[0].slice()];
  let remain = length;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg === 0) continue;
    if (remain >= seg) {
      out.push(b.slice());
      remain -= seg;
    } else {
      const f = remain / seg;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      return out;
    }
  }
  return out;
}

function seededOrder(n, seed) {
  // mulberry32，固定种子 → 固定顺序（原片每座岛的重画顺序都不同，但不能每帧都变）
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }
  return idx;
}

const EASE = {
  linear: (v) => v,
  smooth: (v) => v * v * (3 - 2 * v),
  out: (v) => 1 - (1 - v) * (1 - v),
};

/**
 * @param {object} opts
 * @param {Array<Array<[number,number]>>} opts.strokes 折线集合
 * @param {number} [opts.duration=4] 总时长（与时间单位同量纲，一般是秒）
 * @param {number} [opts.stagger=0.55] 起始延迟占整段的比例；1 = 一直有新笔画开始
 * @param {'document'|'random'|'longest'|'shortest'} [opts.order='random']
 * @param {number} [opts.seed=1] order:'random' 的种子
 * @param {boolean} [opts.lengthWeighted=true] 长笔画给更长耗时
 * @param {'linear'|'smooth'|'out'} [opts.ease='smooth']
 */
export function createStrokeReveal({
  strokes,
  duration = 4,
  stagger = 0.55,
  order = 'random',
  seed = 1,
  lengthWeighted = true,
  ease = 'smooth',
} = {}) {
  if (!Array.isArray(strokes)) throw new TypeError('strokes must be an array');
  if (!(duration > 0)) throw new RangeError('duration must be positive');
  if (!(stagger >= 0 && stagger < 1)) throw new RangeError('stagger must be in [0,1)');
  if (!EASE[ease]) throw new RangeError('unknown ease: ' + ease);

  const kept = [];
  for (const raw of strokes) {
    const pts = normalizePoints(raw);
    if (pts.length < 2) continue; // 单点/空笔画不参与描线
    const len = polylineLength(pts);
    if (len <= 0) continue;
    kept.push({ points: pts, length: len });
  }
  if (kept.length === 0) throw new RangeError('no drawable stroke (need 2+ distinct points each)');

  const n = kept.length;
  const maxLen = kept.reduce((m, s) => Math.max(m, s.length), 0);
  const totalLength = kept.reduce((sum, s) => sum + s.length, 0);

  let seq;
  if (order === 'document') seq = kept.map((_, i) => i);
  else if (order === 'longest') seq = kept.map((_, i) => i).sort((a, b) => kept[b].length - kept[a].length);
  else if (order === 'shortest') seq = kept.map((_, i) => i).sort((a, b) => kept[a].length - kept[b].length);
  else if (order === 'random') seq = seededOrder(n, seed);
  else throw new RangeError('unknown order: ' + order);

  const startSpread = duration * stagger;
  const spanBudget = duration - startSpread;
  const easeFn = EASE[ease];

  const plan = new Array(n);
  seq.forEach((strokeIndex, k) => {
    const s = kept[strokeIndex];
    const delay = n === 1 ? 0 : (k / (n - 1)) * startSpread;
    const weight = lengthWeighted ? 0.5 + 0.5 * (s.length / maxLen) : 1;
    const span = Math.min(spanBudget * weight, duration - delay);
    plan[strokeIndex] = {
      points: s.points,
      length: s.length,
      order: k,
      delay,
      span: Math.max(span, 1e-6),
      end: delay + Math.max(span, 1e-6),
    };
  });

  const endTime = plan.reduce((m, s) => Math.max(m, s.end), 0);

  function progressOf(stroke, t) {
    if (!(t > 0)) return 0;
    return clamp01(easeFn(clamp01((t - stroke.delay) / stroke.span)));
  }

  function statsAt(t) {
    const time = Number.isFinite(t) ? Math.max(0, t) : 0;
    let started = 0, finished = 0, drawnLength = 0;
    for (const s of plan) {
      const p = progressOf(s, time);
      if (time >= s.delay) started++;
      if (p >= 1) finished++;
      drawnLength += s.length * p;
    }
    return {
      time,
      strokes: plan.length,
      started,
      finished,
      drawnLength,
      totalLength,
      ratio: totalLength > 0 ? drawnLength / totalLength : 0,
      done: finished === plan.length,
    };
  }

  function sampleAt(t) {
    const time = Number.isFinite(t) ? Math.max(0, t) : 0;
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const s = plan[i];
      if (time < s.delay) continue;
      const p = progressOf(s, time);
      const points = p >= 1 ? s.points.map((q) => q.slice()) : trimPolyline(s.points, s.length * p);
      if (points.length < 2) continue;
      out.push({ index: i, order: s.order, progress: p, points });
    }
    return out;
  }

  return {
    duration,
    endTime,
    totalLength,
    strokeCount: plan.length,
    plan,
    progressOf: (t) => (Number.isFinite(t) ? Math.max(0, t) : 0) / endTime,
    statsAt,
    sampleAt,
  };
}
