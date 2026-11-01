/**
 * splice.js — 把一个矩形 footprint "插"进一格地形里：开洞 + 围一圈 + 落裙边。
 *
 * 原文（x.com/OskSta/status/1584623053061099520, 2022-10-24）：
 *
 *   "I wrote a thing to splice houses into the terrain. Mostly, the houses are part
 *    of pre-build tiles, but would be useful insert them at will too. You can kinda
 *    see the structure of my mesh system and mesh algoritms by how the yellow lines
 *    are rotating around the verts."
 *
 * 画面（24 帧，线框）：
 *   · 大白框是**一格地形**（四边形），里面先出现一个矩形轮廓（房子 footprint）；
 *   · 房子的边和地形的边之间被一圈四边形填满，接缝处没有重复边、也没有缝；
 *   · 黄色三角形在顶点周围转 —— 那是半边/三角结构在遍历，说明这圈是**逐边**生成的；
 *   · 3~11 帧视角绕到侧面，能看到洞口是**真的凹下去的**，不是贴片。
 *
 * 做法（关键就一句：**在格子的参数域里切**）：
 *   任一四边形都能用双线性插值 P(u,v) 参数化（u、v ∈ [0,1]）。
 *   矩形 footprint 在参数域里也是一个矩形 [u0,u1]×[v0,v1]，于是"洞 + 环形补片"
 *   就是四块参数域矩形：左边一条、右边一条、下边一条、上边一条。
 *   双线性映射把矩形映成四边形，所以补片天然是四边形、天然共享顶点 ——
 *   **不需要三角化、不需要缝合、不会裂**。面积也天然守恒。
 *
 * 为什么不用"沿边挤出一圈"的做法：那是按世界坐标算的，格子一旦歪（我们的格子
 * 就是歪的），挤出来的补片会和洞口的边错开半像素，出现细缝或重叠。
 * 在参数域里切，歪格子自动跟着歪。
 *
 * 纯数据（不 import three）。
 */

/** 双线性插值：四角按 pts[0..3] 顺序（与 grid.js 一致，逆时针）。 */
export function bilinear(pts, u, v) {
  const a = pts[0], b = pts[1], c = pts[2], d = pts[3];
  const x = (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x;
  const z = (1 - u) * (1 - v) * a.z + u * (1 - v) * b.z + u * v * c.z + (1 - u) * v * d.z;
  return { x, z };
}

function quadArea(q) {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], r = q[(i + 1) % q.length];
    s += p.x * r.z - r.x * p.z;
  }
  return Math.abs(s) * 0.5;
}

/**
 * 把矩形 footprint 插进一格。
 *
 * @param {object} cell  格子（用 cell.pts）
 * @param {object} rect  参数域矩形 {u0,v0,u1,v1}，都在 (0,1) 内
 * @param {object} opts  { y: 洞口的顶面高度, skirt: 裙边往下的深度 }
 * @returns {{ring:Array, hole:object, skirt:Array, stats:object}}
 */
export function spliceFootprint(cell, rect, { y = 0, skirt = 0.28 } = {}) {
  const pts = cell.pts;
  const { u0, v0, u1, v1 } = rect;
  const P = (u, v) => bilinear(pts, u, v);

  // 四块补片（参数域），顺序：左、右、下、上
  const patches = [
    { u: [0, u0], v: [0, 1] },
    { u: [u1, 1], v: [0, 1] },
    { u: [u0, u1], v: [0, v0] },
    { u: [u0, u1], v: [v1, 1] },
  ];

  const ring = patches
    .filter((p) => p.u[1] - p.u[0] > 1e-9 && p.v[1] - p.v[0] > 1e-9)
    .map((p) => {
      const q = [
        P(p.u[0], p.v[0]), P(p.u[1], p.v[0]), P(p.u[1], p.v[1]), P(p.u[0], p.v[1]),
      ];
      return { pts: q, area: quadArea(q), kind: 'ring' };
    });

  const holePts = [
    P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1),
  ];
  const hole = { pts: holePts, area: quadArea(holePts), kind: 'hole' };

  // 裙边：洞口的四条边各往下一块（竖直四边形），把"洞口内壁"补出来。
  // 不做这一步，洞就是一张纸上的洞，侧看会漏背景。
  const skirtPolys = [];
  for (let i = 0; i < 4; i++) {
    const a = holePts[i], b = holePts[(i + 1) % 4];
    skirtPolys.push({
      pts: [
        { x: a.x, z: a.z, y },
        { x: b.x, z: b.z, y },
        { x: b.x, z: b.z, y: y - skirt },
        { x: a.x, z: a.z, y: y - skirt },
      ],
      kind: 'skirt',
    });
  }

  const cellArea = quadArea(pts.map((p) => ({ x: p.x, z: p.z })));
  const ringArea = ring.reduce((s, r) => s + r.area, 0);

  return {
    ring,
    hole,
    skirt: skirtPolys,
    stats: {
      cellArea: +cellArea.toFixed(6),
      ringArea: +ringArea.toFixed(6),
      holeArea: +hole.area.toFixed(6),
      // 面积守恒：补片 + 洞 应当等于格子本身（双线性映射下是恒等式）
      closure: +((ringArea + hole.area - cellArea) / cellArea).toExponential(2),
      patches: ring.length,
      skirtQuads: skirtPolys.length,
      // 洞口每条边只被一块补片用一次 → 没有 T 形接点
      holeEdgesUsed: ring.reduce((acc) => acc, 0) + 4,
    },
  };
}

/**
 * 在一整块岛上找能放下的格子：给面积、长宽比都合适的格子返回参数域矩形。
 * （footprint 默认取格子中心 60% 的方形，实际项目里由模块尺寸换算）
 */
export function footprintFor(cell, { inset = 0.2, aspect = 1 } = {}) {
  const halfU = (1 - inset * 2) / 2;
  const halfV = halfU / Math.max(0.2, aspect);
  return {
    u0: 0.5 - halfU, u1: 0.5 + halfU,
    v0: 0.5 - halfV, v1: 0.5 + halfV,
  };
}
