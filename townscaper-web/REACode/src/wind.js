/**
 * wind.js — 一张"到处都能查"的风场，给旗子、草、烟用。
 *
 * 原文（x.com/OskSta/status/926903893866541057, 2017-11-04）：
 *
 *   "Here is what my wind vectors look like. They can be used by all kinds of
 *    systems, including shaders"
 *
 * 画面（24 帧）：灰白岛上罩着一层短线段，每段是一个采样点上的风向/风速；
 * 山顶的线段更长、更竖直，崖脚几乎贴着地面打转；岛外海面上的线段方向一致。
 *
 * 接着（x.com/OskSta/status/926890207298899969）：
 *
 *   "Not really. I build a custom mesh for the flag using a bezier curve along
 *    virtual wind particles"
 *
 * 所以风场不是装饰：旗子的形状是"沿被风吹走的虚拟粒子拟合出的贝塞尔曲线"。
 * 两条合起来的意思很明确 —— **风向由场决定，形状由粒子轨迹决定**，
 * 而不是"给旗子加一个 sin 摆动"。
 *
 * 这里的场是解析的（不存栅格）：
 *   · 主方向 u；
 *   · 地形抬升项：越高、越靠近崖顶，风越往上掀（画面里山顶线段更竖直）；
 *   · 两个低频扰动项：让相邻采样点之间有相干的变化，而不是纯随机。
 *
 * 纯数据（不 import three），可在 node 里量。
 */

/**
 * @param {object} opts
 *   dir     主风向（会被归一化）
 *   lift    地形抬升权重
 *   swirl   低频扰动幅度
 *   seed
 */
export function makeWindField({ dir = [0.86, 0.12, 0.5], lift = 0.55, swirl = 0.42, seed = 7 } = {}) {
  const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const ux = dir[0] / L, uy = dir[1] / L, uz = dir[2] / L;
  let s = (seed | 0) || 1;
  const ph = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffff) / 0xffff * Math.PI * 2; };
  const p1 = ph(), p2 = ph(), p3 = ph();

  /**
   * @param {number} x,y,z 世界坐标
   * @param {number} groundY 该点脚下的地面高度（用来算"离地多高"）
   */
  function at(x, y, z, groundY = 0) {
    const h = Math.max(0, y - groundY);
    // 地形抬升：离地越高越往上掀，山顶线段因此更竖直（对应画面）
    const up = lift * Math.min(1, h / 3.5);
    // 两个低频扰动：频率刻意不同且不成整数比，避免出现可见的网格
    const a = Math.sin(x * 0.31 + z * 0.22 + p1) * 0.5 + Math.sin(x * 0.13 - z * 0.17 + p2) * 0.5;
    const b = Math.cos(x * 0.27 - z * 0.19 + p3) * 0.5 + Math.cos(x * 0.11 + z * 0.23 + p1) * 0.5;
    const vx = ux + a * swirl * 0.6;
    const vy = uy + up + (a + b) * 0.12;
    const vz = uz + b * swirl * 0.6;
    const l = Math.hypot(vx, vy, vz) || 1;
    // 速度归一化到 0.55~1.25：旗子在不同位置摆幅不同，但不会出现"没风"的地方
    const speed = 0.55 + 0.7 * Math.min(1, Math.abs(a * 0.5 + b * 0.5) + up);
    return [vx / l * speed, vy / l * speed, vz / l * speed];
  }

  /** 固定步长积分一个"虚拟风粒子"，返回轨迹（旗子要靠它拟合曲线）。 */
  function trace(x, y, z, { steps = 12, dt = 0.09, groundY = 0 } = {}) {
    const pts = [[x, y, z]];
    let px = x, py = y, pz = z;
    for (let i = 0; i < steps; i++) {
      const [vx, vy, vz] = at(px, py, pz, groundY);
      px += vx * dt; py += vy * dt; pz += vz * dt;
      // 不许穿地：粒子被地面挡住就贴地滑
      if (py < groundY + 0.02) py = groundY + 0.02;
      pts.push([px, py, pz]);
    }
    return pts;
  }

  return { at, trace, dir: [ux, uy, uz] };
}

/**
 * Catmull-Rom 采样一条过点曲线（原文说的 bezier，用的是同一类插值；
 * 这里用 CR 是因为它**必过控制点**，粒子轨迹就是控制点，不需要额外调柄）。
 */
export function sampleCurve(pts, t) {
  const n = pts.length;
  if (n === 0) return [0, 0, 0];
  if (n === 1) return pts[0].slice();
  const f = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const s = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const t2 = s * s, t3 = t2 * s;
    out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return out;
}

/** 量化：一张风场在岛上的速度分布，用来确认"没有死区、山顶更竖直"。 */
export function windStats(field, town, grid, { samples = 400 } = {}) {
  const cells = grid.cells.filter((c) => town.top(c) > 0);
  if (!cells.length) return null;
  let upness = 0, speed = 0, n = 0, minS = Infinity, maxS = 0;
  for (let i = 0; i < samples; i++) {
    const c = cells[(i * 7919) % cells.length];
    const gy = town.top(c) * 0.42;
    const [vx, vy, vz] = field.at(c.cx, gy + 1.2, c.cz, gy);
    const s = Math.hypot(vx, vy, vz);
    upness += Math.abs(vy) / (s || 1);
    speed += s; n++;
    minS = Math.min(minS, s); maxS = Math.max(maxS, s);
  }
  return {
    samples: n,
    meanSpeed: +(speed / n).toFixed(3),
    minSpeed: +minS.toFixed(3),
    maxSpeed: +maxS.toFixed(3),
    meanUpness: +(upness / n).toFixed(3),
  };
}
