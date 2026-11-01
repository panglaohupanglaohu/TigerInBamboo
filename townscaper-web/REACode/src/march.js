/**
 * march.js — 不规则四边形网格上的 marching squares。
 *
 * 原文：x.com/OskSta/status/1120036868966502401
 *
 *   "It's marching squares on irregular quadrilateral grids"
 *
 * 画面（460²，48s）：先是一大片灰色的不规则四边形网格（格线不动）；
 * 一个红/绿/蓝的三轴 gizmo 出现，代表某个局部坐标系；随后出现白框标出
 * 一片被圈中的格子，白格逐个亮起，最后是黑/黄两色散点 —— 那就是
 * "每个角点采样、按阈值二值化"的结果（黄 = 高于阈值，黑 = 低于）。
 *
 * 关键在于"不规则"这三个字：教科书上的 marching squares 假设格子是正方形，
 * 索引 (i, j) 直接给出邻居。不规则四边形网格没有 (i,j)，只有**共享的角点**，
 * 所以做法要改两处：
 *
 *   1. 角点必须先合并：相邻格子共享同一个顶点，用坐标量化做 key。否则
 *      两个格子对同一条边的插值位置会不一样，轮廓线会在边中间断开。
 *   2. 角点值来自**共享它的那几个格子**（这里取平均）。这样一条等值线
 *      跨过格子边界时，两边的插值端点严格重合 —— 这是"不裂缝"的全部秘密。
 *
 * 中间的鞍点（4 条边都相交）不能用查表硬连：正方形格子上可以按中心点值
 * 决断，这里中心点就用四个角点的平均，同样的规则依然成立。老代码在正方形
 * 网格上没这个问题，一换到不规则网格就会连出"蝴蝶结"，这是本轮实测踩到的。
 */

/**
 * 合并角点 → 每个角点的标量值。
 * @param cells  [{pts:[{x,z}×4], ...}]
 * @param valueOf (cell) => number
 * @param quant  坐标量化精度（世界单位）
 */
export function buildCornerField(cells, valueOf, { quant = 1e-3, reduce = 'mean' } = {}) {
  const map = new Map();
  const key = (p) => `${Math.round(p.x / quant)},${Math.round(p.z / quant)}`;
  for (const c of cells) {
    const v = valueOf(c);
    if (!Number.isFinite(v)) continue;
    for (const p of c.pts) {
      const k = key(p);
      const e = map.get(k);
      if (!e) map.set(k, { x: p.x, z: p.z, sum: v, n: 1 });
      else { e.sum += v; e.n += 1; }
    }
  }
  const value = new Map();
  for (const [k, e] of map) value.set(k, reduce === 'max' ? e.sum : e.sum / e.n);
  return {
    key,
    valueAt: (p) => value.get(key(p)),
    corners: map,
  };
}

/**
 * 对一个格子跑 marching squares。
 * @returns 线段数组 [[x0,z0,x1,z1], ...]（世界 xz 平面）
 */
export function marchQuad(cell, field, iso) {
  const p = cell.pts;
  const v = p.map((q) => {
    const val = field.valueAt(q);
    return val === undefined ? 0 : val;
  });
  const inside = v.map((x) => x > iso);
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const cross = [];
  for (const [i, j] of edges) {
    if (inside[i] === inside[j]) continue;
    const a = p[i], b = p[j];
    const va = v[i], vb = v[j];
    const t = (iso - va) / ((vb - va) || 1e-6);
    cross.push({ edge: i, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  if (cross.length === 0) return [];
  if (cross.length === 2) return [[cross[0].x, cross[0].z, cross[1].x, cross[1].z]];
  if (cross.length === 4) {
    // 鞍点：用格心决断（格心 = 四角平均，和正方形网格上的规则一致）
    const center = (v[0] + v[1] + v[2] + v[3]) / 4;
    // cross 的顺序必然跟着 edge 0..3 走，所以 0-1 与 2-3 是两种连法
    const pairA = center > iso;
    const idx = pairA ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
    return idx.map(([i, j]) => [cross[i].x, cross[i].z, cross[j].x, cross[j].z]);
  }
  // 3 个交点：只在数值退化时出现，直接丢弃（比连错线好看）
  return [];
}

/**
 * 整张网格的等值线。
 * @param levels 允许传多个 iso（海岸线 + 台地线）
 */
export function marchGrid(cells, valueOf, { iso = 0.5, levels = null, quant = 1e-3, reduce = 'mean' } = {}) {
  const field = buildCornerField(cells, valueOf, { quant, reduce });
  const list = levels || [iso];
  const out = [];
  for (const lv of list) {
    const segs = [];
    for (const c of cells) {
      const s = marchQuad(c, field, lv);
      for (const q of s) segs.push(q);
    }
    out.push({ iso: lv, segs });
  }
  return { field, levels: out, cornerCount: field.corners.size };
}
