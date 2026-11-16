/**
 * clay-ao.js — 灰模阶段的**环境光遮蔽**与**软阴影**（1654401054828638214 第 0124–0222 帧）。
 *
 * 片子里网格被抬成 3D 之后先进一段"没有材质的暗灰"：凹槽（中间那条）明显比台顶暗，
 * 台地边缘往下的崖壁的暗是渐变的、不是一刀切 —— 这就是 AO（按周围高差积的遮蔽）
 * 加一层太阳方向的软阴影（被高台挡住的坡面按遮挡比例变暗，而不是二值）。
 *
 * 这里不碰渲染器，只算标量场：
 *   - `vertexAO()`     每个顶点被周围顶点"压住"多少（凹处 0、台顶 1），半径内按距离加权；
 *   - `sunShadow()`    每个顶点沿太阳水平方向走一遍，看有没有更高的地形挡住（返回被挡比例）；
 *   - `shadeFactor()`  两者合成一个 0..1 的明暗系数，供页面按三角形取平均上色。
 *
 * 三个函数都是纯函数、确定性、O(n²)（本页 150 点级别足够）。
 * 关键：**平地上 AO 必须全是 1、阴影必须全是 0**，否则整片会被无故压暗（r101 那种"处处发灰"）。
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 半径内的距离加权高差。凹处被人压住 → 遮蔽大。 */
export function vertexAO(points, heights, { radius = 2.6, strength = 0.62, levels = 6 } = {}) {
  const n = points.length;
  const ao = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    let occ = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = points[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > radius) continue;
      const rise = heights[j] - heights[i];
      if (rise <= 0) continue;
      occ += (rise / levels) * (1 - d / radius);
    }
    ao[i] = clamp01(1 - strength * occ);
  }
  return ao;
}

/**
 * 太阳方向软阴影：从顶点沿 (dx,dz) 每步抬高 tanSun，撞到更高的顶点即被挡。
 * 返回 0..1 的**被挡比例**（不是布尔），所以坡面边缘是渐变的。
 */
export function sunShadow(points, heights, {
  dx = 0.72, dz = -0.69, steps = 14, reach = 0.62, tanSun = 0.55, cell = 1.0,
} = {}) {
  const n = points.length;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const shadow = new Float32Array(n);
  const maxT = reach * Math.max(...heights, 1) * 2.2;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    let blocked = 0, seen = 0;
    for (let s = 1; s <= steps; s++) {
      const t = (s / steps) * maxT;
      const rayH = heights[i] + t * tanSun;
      const px = p.x + ux * t, pz = p.z + uz * t;
      seen++;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const q = points[j];
        if (Math.abs(q.x - px) > cell || Math.abs(q.z - pz) > cell) continue;
        if (heights[j] > rayH + 0.35) { blocked++; break; }
      }
    }
    shadow[i] = seen ? blocked / seen : 0;
  }
  return shadow;
}

/**
 * 合成明暗：AO 先压（凹处更暗），阴影再压一层，最后给一个下限防止全黑。
 * @returns {Float32Array} 0..1，1 = 全亮
 */
export function shadeFactor(ao, shadow, { aoWeight = 0.55, shadowWeight = 0.42, floor = 0.34 } = {}) {
  const n = Math.min(ao.length, shadow.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = (1 - aoWeight + aoWeight * ao[i]) * (1 - shadowWeight * shadow[i]);
    out[i] = Math.max(floor, clamp01(f));
  }
  return out;
}

/** 三角形级别的明暗（三个顶点取平均），页面直接拿来刷 fillStyle。 */
export function triShade(tris, factor) {
  return tris.map((t) => (factor[t[0]] + factor[t[1]] + factor[t[2]]) / 3);
}

/** 一串数的统计（测试与页面读数共用；空数组返回 0，不许 NaN）。 */
export function summarize(values) {
  const arr = Array.from(values);
  if (!arr.length) return { n: 0, min: 0, max: 0, mean: 0, distinct: 0 };
  let min = Infinity, max = -Infinity, sum = 0;
  const set = new Set();
  for (const v of arr) {
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v); max = Math.max(max, v); sum += v;
    set.add(Math.round(v * 1000) / 1000);
  }
  return {
    n: arr.length,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    mean: arr.length ? sum / arr.length : 0,
    distinct: set.size,
  };
}

/** 一步到位：点集 + 高度 → {ao, shadow, factor, stats}。 */
export function bakeClayField(points, heights, opts = {}) {
  const ao = vertexAO(points, heights, opts);
  const shadow = sunShadow(points, heights, opts.sun || {});
  const factor = shadeFactor(ao, shadow, opts.shade || {});
  return {
    ao, shadow, factor,
    stats: { ao: summarize(ao), shadow: summarize(shadow), factor: summarize(factor) },
  };
}
