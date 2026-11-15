/**
 * multitile-iso.js — 多格 tile 楼的等轴测画法（Canvas 2D，不依赖 WebGL），供 multitile.html 与测试共用。
 * 每个外露体素面画成一个四边形，四个顶点的明暗来自 voxelFaceAO（顶点体素 AO），面内按 2×2 细分做双线性近似；
 * 画家算法：按 (x + z) − y 由远到近。upto = 只画 trace 前 n 步坍缩出的实心体素（回放「长出来」）。
 */
import { voxelFaceAO } from './multitile-wfc.js';

const TONE = { 2: [0.93, 0.95, 0.9], 0: [0.86, 0.8, 0.86], 1: [0.78, 0.84, 0.82], 4: [0.8, 0.88, 0.84], 5: [0.84, 0.78, 0.84], 3: [0.6, 0.6, 0.6] };

export function isoProject(x, y, z, s = 18, ox = 0, oy = 0) {
  return [ox + (x - z) * s * 0.866, oy + (x + z) * s * 0.5 - y * s];
}

/** res 可以是 solveMultitile 结果；upto 截断 trace（null = 全部）；ao 开关。返回画了几个面。 */
export function drawMultitileIso(ctx, res, { upto = null, ao = true, s = 18, ox = 0, oy = 0, aoStrength = 0.55 } = {}) {
  let view = res;
  if (upto != null) {
    const keep = new Uint8Array(res.solid.length);
    for (let k = 0; k < Math.min(upto, res.trace.length); k++) {
      const pt = res.parts[res.trace[k].part];
      if (pt.solid) keep[res.trace[k].cell] = 1;
    }
    view = { ...res, solid: keep };
  }
  const faces = voxelFaceAO(view).filter((f) => f.d === 0 || f.d === 2 || f.d === 4);   // 等轴测只看得到 +x、+y、+z 三面
  faces.sort((a, b) => (a.x + a.z - a.y) - (b.x + b.z - b.y) || a.d - b.d);
  for (const f of faces) {
    const n = f.d === 0 ? [1, 0, 0] : f.d === 2 ? [0, 1, 0] : [0, 0, 1];
    const base = [f.x + (n[0] > 0 ? 1 : 0), f.y + (n[1] > 0 ? 1 : 0), f.z + (n[2] > 0 ? 1 : 0)];
    const [A, B] = f.axes;
    // 面的四角（与 ao 顺序一致：(-,-),(+,-),(+,+),(-,+)，坐标取 0/1）
    const corner = (u, v) => [base[0] + A[0] * u + B[0] * v, base[1] + A[1] * u + B[1] * v, base[2] + A[2] * u + B[2] * v];
    const tone = TONE[f.d];
    const aoAt = (u, v) => { const [a, b, c, d] = f.ao; return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * u * v + d * (1 - u) * v; };
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const u0 = i / 2, v0 = j / 2, u1 = u0 + 0.5, v1 = v0 + 0.5, k = ao ? 1 - aoStrength * (1 - aoAt(u0 + 0.25, v0 + 0.25)) : 1;
      ctx.fillStyle = `rgb(${Math.round(255 * tone[0] * k)},${Math.round(255 * tone[1] * k)},${Math.round(255 * tone[2] * k)})`;
      ctx.beginPath();
      for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) { const p = isoProject(...corner(u, v), s, ox, oy); ctx.lineTo(p[0], p[1]); }
      ctx.closePath(); ctx.fill();
    }
  }
  return faces.length;
}
