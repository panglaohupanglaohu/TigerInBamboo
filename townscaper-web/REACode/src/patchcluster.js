/**
 * patchcluster.js — 无限网格怎么做到「各块补丁自己松弛，接缝却一条缝都没有」。
 *
 * 帖子 ID：1332410042784641026（2020-11-27，Townscaper）
 *   "How the infinite grid is relaxed and kept seamless: The grid is made of
 *    Patches. Adjacent triplets form Clusters. Clusters and Patches are relaxed
 *    independently. Each Vert is a triangular interpolation its representation
 *    in the closest 2 Clusters and the Patch wherein it sits."
 *   画面（6 帧，512²，青绿底）：几块**四边形网格补丁**像花瓣一样拼在一起，
 *   每块补丁内部是近乎正方形的格子，补丁与补丁之间在**交点处**留着一圈
 *   看得见的缝（先放下的那块补丁里已经摆了一栋房子）。补丁边缘一圈顶点的
 *   位置明显没有对齐——这就是「各自松弛、接缝靠插值补回来」的那张图。
 *
 * 帖子 ID：1151770831619534848（2019-07-18，Townscaper）
 *   "I figured out how to make do with relaxation clusters of 3 instead of 7,
 *    which means I have to generate fewer unrelaxed patches before I can start
 *    relaxing, which makes it faster. Note also that the black and the white
 *    grid are *dual* to each other."
 *   画面（6 帧，420×420，灰底）：同一块六边形补丁上**黑白两层网格叠着**，
 *   两层的交点是对方的格子中心；帧推进时两层一起松弛，格子在变方正。
 *
 * 为什么这么做：
 *   无限网格不能在整张图上迭代松弛（图无限大）。能做的只有：按需生成一小块
 *   补丁、各自松弛、再把边界顶点用插值拉回一致。三条路只有一条能同时满足
 *   「无接缝」和「格子仍然方正」：
 *     ① raw       —— 每块补丁用自己的顶点副本 → 缝最大，格子最方；
 *     ② consensus —— 共享顶点直接取所有副本平均 → 缝为 0，但边缘格被平均值
 *                    拽歪（平均出来的位置不满足任何一块补丁的方形目标）；
 *     ③ blend     —— 顶点位置 = 三块补丁各自表示的**重心（三角）插值**，
 *                    权重由顶点基准位置在「三块补丁质心三角形」里的重心坐标给出。
 *                    权重只依赖基准位置，所有副本算出来同一个值 → 缝严格为 0，
 *                    而边缘格仍然被自己那块补丁的方形目标约束住。
 *
 * 与原帖的一处偏差（写清楚，不假装等价）：
 *   原版补丁格是三角形/六边形，一个交点周围正好 3 块补丁，所以「离它最近的
 *   2 个 cluster + 它所在的那块 patch」是唯一的。本实验用四边形补丁格，一个
 *   交点周围是 4 块，三元组的取法本身不唯一 —— 这里取「基准位置最近的 3 块
 *   补丁质心」，落在这 3 块之外的副本权重记 0。结论（插值消缝、方形不塌）
 *   只依赖「权重是基准位置的连续函数」，不依赖三元组具体怎么挑。
 */

const HASH = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

export const CFG = {
  PW: 7,          // 每块补丁的格数（宽）
  PH: 7,          // 每块补丁的格数（高）
  PX: 3,          // 补丁阵列
  PY: 3,
  S: 24,          // 基准格边长（像素）
  JIT: 0.30,      // 基准顶点的抖动（×S）
  ITER: 90,       // 每块补丁独立松弛的迭代数
  K: 0.34,        // 每轮向「最佳拟合正方形」靠拢的比例
};

const key = (i, j, a, b) => i + ',' + j + ',' + a + ',' + b;

/** 补丁 (i,j) 内的全部格子：[[k00,k10,k11,k01], …]，按行优先 */
function patchCells(i, j) {
  const out = [];
  for (let b = 0; b < CFG.PH; b++)
    for (let a = 0; a < CFG.PW; a++)
      out.push([key(i, j, a, b), key(i, j, a + 1, b), key(i, j, a + 1, b + 1), key(i, j, a, b + 1)]);
  return out;
}

/** 最佳拟合正方形：保留质心与平均边长，把两个平均边方向正交化 */
function fitSquare(p) {
  const cx = (p[0].x + p[1].x + p[2].x + p[3].x) / 4;
  const cy = (p[0].y + p[1].y + p[2].y + p[3].y) / 4;
  let v1x = ((p[1].x - p[0].x) + (p[2].x - p[3].x)) / 2;
  let v1y = ((p[1].y - p[0].y) + (p[2].y - p[3].y)) / 2;
  let v2x = ((p[3].x - p[0].x) + (p[2].x - p[1].x)) / 2;
  let v2y = ((p[3].y - p[0].y) + (p[2].y - p[1].y)) / 2;
  const L1 = Math.hypot(v1x, v1y) || 1, L2 = Math.hypot(v2x, v2y) || 1;
  const s = (L1 + L2) / 2;
  const u1x = v1x / L1, u1y = v1y / L1;
  // u2 = u1 旋转 ±90°，取与 v2 同侧的那个
  const sign = (v2x * -u1y + v2y * u1x) >= 0 ? 1 : -1;
  const u2x = -u1y * sign, u2y = u1x * sign;
  const h = s / 2;
  return [
    { x: cx - u1x * h - u2x * h, y: cy - u1y * h - u2y * h },
    { x: cx + u1x * h - u2x * h, y: cy + u1y * h - u2y * h },
    { x: cx + u1x * h + u2x * h, y: cy + u1y * h + u2y * h },
    { x: cx - u1x * h + u2x * h, y: cy - u1y * h + u2y * h },
  ];
}

export function build() {
  const { PW, PH, PX, PY, S, JIT } = CFG;
  const GW = PW * PX, GH = PH * PY;

  // 基准顶点（全局）：格点 + 确定性抖动。所有补丁的副本都从这里出发。
  const base = new Map();
  for (let gy = 0; gy <= GH; gy++)
    for (let gx = 0; gx <= GW; gx++) {
      const jx = (HASH(gx, gy) - 0.5) * 2 * JIT * S;
      const jy = (HASH(gx + 7717, gy + 3313) - 0.5) * 2 * JIT * S;
      base.set(gx + ',' + gy, { x: gx * S + jx, y: gy * S + jy, gx, gy });
    }

  // 每块补丁各自一套顶点副本（key 含补丁号 → 同一个全局点有最多 4 份）
  const copies = new Map();
  const patches = [];
  for (let j = 0; j < PY; j++)
    for (let i = 0; i < PX; i++) {
      const p = { i, j, cells: patchCells(i, j), ids: [] };
      for (let b = 0; b <= PH; b++)
        for (let a = 0; a <= PW; a++) {
          const k = key(i, j, a, b);
          const g = base.get((i * PW + a) + ',' + (j * PH + b));
          copies.set(k, { x: g.x, y: g.y, gx: g.gx, gy: g.gy });
          p.ids.push(k);
        }
      patches.push(p);
    }

  // 每块补丁独立松弛：只挪自己的副本，边界一份也不共享
  for (const p of patches) {
    for (let it = 0; it < CFG.ITER; it++) {
      for (const c of p.cells) {
        const q = c.map((k) => copies.get(k));
        const ideal = fitSquare(q);
        for (let n = 0; n < 4; n++) {
          const v = q[n];
          v.x += (ideal[n].x - v.x) * CFG.K;
          v.y += (ideal[n].y - v.y) * CFG.K;
        }
      }
    }
  }

  // 全局顶点 → 它有哪些副本（按补丁质心排序用得到）
  const verts = new Map();   // "gx,gy" -> { gx, gy, keys:[], patches:[] }
  for (const p of patches)
    for (const k of p.ids) {
      const c = copies.get(k);
      const gk = c.gx + ',' + c.gy;
      let v = verts.get(gk);
      if (!v) { v = { gx: c.gx, gy: c.gy, keys: [], ps: [], bx: c.x, by: c.y }; verts.set(gk, v); }
      v.keys.push(k); v.ps.push(p);
    }

  // 补丁质心（用于「三块最近补丁」与重心坐标）
  const cents = patches.map((p) => {
    let sx = 0, sy = 0;
    for (const k of p.ids) { const c = copies.get(k); sx += c.x; sy += c.y; }
    return { i: p.i, j: p.j, x: sx / p.ids.length, y: sy / p.ids.length };
  });

  // 基准位置（未松弛的格点）×，用来算重心坐标：必须用**基准**而不是松弛后位置，
  // 否则权重会依赖副本 → 缝又回来了。
  const basePos = (v) => ({ x: v.gx * S, y: v.gy * S });

  const bary = (pt, tri) => {
    const [A, B, C] = tri;
    const d = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(d) < 1e-9) return [1 / 3, 1 / 3, 1 / 3];
    const w0 = ((B.y - C.y) * (pt.x - C.x) + (C.x - B.x) * (pt.y - C.y)) / d;
    const w1 = ((C.y - A.y) * (pt.x - C.x) + (A.x - C.x) * (pt.y - C.y)) / d;
    const w2 = 1 - w0 - w1;
    return [Math.max(0, w0), Math.max(0, w1), Math.max(0, w2)];
  };

  const nearest3 = (pt) => {
    const arr = cents.map((c) => ({ c, d: (c.x - pt.x) ** 2 + (c.y - pt.y) ** 2 }));
    arr.sort((p, q) => p.d - q.d);
    return [arr[0].c, arr[1].c, arr[2].c];
  };

  return { base, copies, patches, verts, cents, basePos, bary, nearest3 };
}

/** 三种模式下的顶点位置表：patchKey -> {x,y}（raw 时每块补丁用自己的副本） */
export function solve(mode) {
  const M = build();
  const out = new Map();          // 顶点 key -> {x,y}
  const rep = new Map();          // "gx,gy" -> {consensus:{x,y}, blend:{x,y}}
  const { copies, verts } = M;

  for (const [gk, v] of verts) {
    const cs = v.keys.map((k) => copies.get(k));
    const ax = cs.reduce((s, c) => s + c.x, 0) / cs.length;
    const ay = cs.reduce((s, c) => s + c.y, 0) / cs.length;
    rep.set(gk, { consensus: { x: ax, y: ay } });

    if (cs.length === 1) { rep.get(gk).blend = { x: ax, y: ay }; continue; }
    const pt = M.basePos(v);
    const tri = M.nearest3(pt);
    const w = M.bary(pt, tri);
    let sx = 0, sy = 0, sw = 0;
    for (let n = 0; n < 3; n++) {
      const p = tri[n];
      // 这块补丁在这个顶点上有没有副本？没有就跳过（三元组里可能不含它）
      const k = v.keys.find((kk) => {
        const c = copies.get(kk);
        return c.gx === v.gx && c.gy === v.gy && kk.startsWith(p.i + ',' + p.j + ',');
      });
      if (!k || w[n] <= 0) continue;
      const c = copies.get(k);
      sx += c.x * w[n]; sy += c.y * w[n]; sw += w[n];
    }
    rep.get(gk).blend = sw > 1e-9 ? { x: sx / sw, y: sy / sw } : { x: ax, y: ay };
  }

  // 每个补丁的格子用它该用的坐标
  for (const p of M.patches)
    for (const k of p.ids) {
      const c = copies.get(k);
      const gk = c.gx + ',' + c.gy;
      if (mode === 'raw') out.set(k, { x: c.x, y: c.y });
      else if (mode === 'consensus') out.set(k, rep.get(gk).consensus);
      else out.set(k, rep.get(gk).blend);
    }
  return { M, pos: out, rep };
}

/** 度量：缝宽（同一条共享边两侧副本的错开）+ 格子方正度 + 面积漂移 */
export function measure(mode) {
  const { M, pos } = solve(mode);
  const { copies, verts, patches } = M;

  // ① 缝宽：对每个被 ≥2 块补丁共享的顶点，取各副本之间的距离（最大值 = 缺口）
  let seamVerts = 0, gapSum = 0, gapMax = 0;
  for (const [gk, v] of verts) {
    if (v.keys.length < 2) continue;
    seamVerts++;
    let mn = Infinity, mx = -Infinity;
    for (const k of v.keys) {
      const p = pos.get(k);
      const d = Math.hypot(p.x - 0, p.y - 0);
      void d;
      mn = Math.min(mn, p.x); mx = Math.max(mx, p.x);
    }
    // 用两两距离更直观
    let g = 0;
    for (let a = 0; a < v.keys.length; a++)
      for (let b = a + 1; b < v.keys.length; b++) {
        const pa = pos.get(v.keys[a]), pb = pos.get(v.keys[b]);
        g = Math.max(g, Math.hypot(pa.x - pb.x, pa.y - pb.y));
      }
    gapSum += g; gapMax = Math.max(gapMax, g);
  }

  // ② 方正度：每个格子四个内角与 90° 的偏差
  const devs = [];
  let areaSum = 0, areaN = 0;
  for (const p of patches)
    for (const c of p.cells) {
      const q = c.map((k) => pos.get(k));
      for (let n = 0; n < 4; n++) {
        const a = q[n], b = q[(n + 1) % 4], d = q[(n + 3) % 4];
        const v1x = b.x - a.x, v1y = b.y - a.y, v2x = d.x - a.x, v2y = d.y - a.y;
        const ang = Math.abs(Math.atan2(v1y, v1x) - Math.atan2(v2y, v2x));
        const deg = ang > Math.PI ? 2 * Math.PI - ang : ang;
        devs.push(Math.abs(90 - deg * 180 / Math.PI));
      }
      // 面积漂移（相对基准格面积 S²）
      let ar = 0;
      for (let n = 0; n < 4; n++) {
        const a = q[n], b = q[(n + 1) % 4];
        ar += a.x * b.y - b.x * a.y;
      }
      areaSum += Math.abs(ar / 2) / (CFG.S * CFG.S); areaN++;
    }

  devs.sort((a, b) => a - b);
  const mean = devs.reduce((s, d) => s + d, 0) / devs.length;
  const p95 = devs[Math.floor(devs.length * 0.95)];

  return {
    mode,
    seamVerts,
    gapMean: seamVerts ? gapSum / seamVerts : 0,
    gapMax,
    devMean: mean,
    devP95: p95,
    areaMean: areaSum / areaN,
    cells: areaN,
    patches: patches.length,
  };
}

/** 对偶网格核对：四边形的对偶是「格子中心成顶点」，V/F 互换、E 不变 */
export function dualCheck() {
  const W = CFG.PW, H = CFG.PH;
  const V = (W + 1) * (H + 1), F = W * H;
  const E = W * (H + 1) + H * (W + 1);       // 横边 + 竖边（含边界）
  return { single: { V, E, F, euler: V - E + F }, dual: { V: F, E, F: V, euler: F - E + V } };
}

/** 「三元组 vs 七元组」的补丁生成量：松弛一个交点要先有它周围那圈补丁 */
export function clusterCost() {
  const tri = 3;          // 一个交点周围 3 块补丁（三角/六边补丁格）
  const hept = 7;         // 用「中心 + 6 环」当 cluster 时，要先落下 7 块
  return { tri, hept, ratio: hept / tri, patchesPerCellTri: tri, patchesPerCellHept: hept };
}
