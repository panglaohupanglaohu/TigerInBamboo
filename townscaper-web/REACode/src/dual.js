/**
 * dual.js — 顶点格：把"每个格子的中心"围成"每个顶点的多边形"。
 *
 * 原文（x.com/OskSta/status/959752525867036672, 2018-02-03）：
 *
 *   "A great unexpected joy in this project has been writing my own navmesh. It's
 *    an oddly relaxing job full of small and approachable math-puzzles. Here you
 *    see some pulsating vertex cells; a dual to the triangular grid and a
 *    suitable place to start with foliage placement."
 *
 * 画面（13 帧）：岛上罩着一层半透明白色"圆瓣"，每一瓣是一个顶点周围的多边形，
 * 贴在台地上、按台地起伏，彼此不留缝；瓣的边缘柔和，整体像一层膜。
 *
 * 两个要点：
 *   ① 这是**对偶**：原网格的顶点 → 新网格的面；原网格的面（格子）→ 新网格的顶点。
 *      所以"顶点格"的多边形 = 该顶点周围**所有格子中心的连线**（按角度排序）。
 *      排序必须按绕顶点的角度，不能按 cell id —— 否则多边形自交，面积算错。
 *   ② 它是"放植被的合适起点"：顶点格是**凸的、大小均匀、无缝铺满**，
 *      每个格子里放一丛草/一棵灌木，密度天然均匀，也不会重叠（`props.js`
 *      那种暴力试放的问题就是重叠判定，对偶格把它变成"一瓣一株"）。
 *
 * 纯数据（不 import three）。
 */

/**
 * @param {object} grid 四边形网格
 * @param {object} town 可选：给了就只统计陆地（top>0）的顶点格
 * @returns {{cells:Array, stats:object}}
 */
export function dualCells(grid, town = null) {
  const byVert = new Map();

  for (const cell of grid.cells) {
    if (town && town.top(cell) <= 0) continue;
    for (const p of cell.pts) {
      const key = p.bx.toFixed(3) + ',' + p.bz.toFixed(3);
      let rec = byVert.get(key);
      if (!rec) { rec = { x: p.bx, z: p.bz, ids: new Set() }; byVert.set(key, rec); }
      rec.ids.add(cell.id);
    }
  }

  const out = [];
  for (const rec of byVert.values()) {
    if (rec.ids.size < 3) continue;          // 边界顶点只有 1~2 个格子，围不成面
    const cells = [...rec.ids].map((id) => grid.cells[id]);
    // 按绕顶点的角度排序：这是唯一正确的绕序（按 id 排会自交）
    const sorted = cells
      .map((c) => ({ c, a: Math.atan2(c.cz - rec.z, c.cx - rec.x) }))
      .sort((p, q) => p.a - q.a)
      .map((p) => p.c);

    const poly = sorted.map((c) => [c.cx, c.cz]);
    let area = 0, cx = 0, cz = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const cross = x0 * z1 - x1 * z0;
      area += cross;
      cx += (x0 + x1) * cross;
      cz += (z0 + z1) * cross;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-7) continue;
    cx /= 6 * area;
    cz /= 6 * area;
    out.push({
      vx: rec.x, vz: rec.z,
      ids: sorted.map((c) => c.id),
      poly,
      area: Math.abs(area),
      signedArea: area,
      cx, cz,
    });
  }

  const areas = out.map((d) => d.area).sort((a, b) => a - b);
  const median = areas[areas.length >> 1] || 1;
  return {
    cells: out,
    stats: {
      count: out.length,
      // 顶点格的大小很齐：面积 p10/p90 相对中位数的偏差就是"齐不齐"的量化
      medianArea: +median.toFixed(5),
      p10: +(areas[Math.floor(areas.length * 0.1)] || 0).toFixed(5),
      p90: +(areas[Math.floor(areas.length * 0.9)] || 0).toFixed(5),
      // 一瓣周围有几个格子 —— 六边形排布的规则值是 6，我们的不规则网格会散开
      valence: out.reduce((acc, d) => {
        const k = d.ids.length;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

/**
 * 从顶点格里挑"放植被"的位置：面积够大、且不贴悬崖边。
 * @param {object} dual dualCells() 的结果
 * @param {object} town
 * @param {object} opts { minArea, spacing, rng, limit }
 */
export function pickFoliageSites(dual, town, grid, { minAreaRatio = 0.55, spacing = 1.6, limit = 60, rng = Math.random } = {}) {
  const median = dual.stats.medianArea;
  const chosen = [];
  const order = [...dual.cells].sort((a, b) => b.area - a.area);
  for (const d of order) {
    if (chosen.length >= limit) break;
    if (d.area < median * minAreaRatio) continue;
    if (chosen.some((c) => (c.cx - d.cx) ** 2 + (c.cz - d.cz) ** 2 < spacing * spacing)) continue;
    // 高度取周围格子里最高的那个：植被要站在台地上，不能挂在崖面上
    let top = 0;
    for (const id of d.ids) {
      const c = grid.cells[id];
      if (c) top = Math.max(top, town.top(c));
    }
    if (top <= 0) continue;
    chosen.push({ ...d, top });
  }
  return chosen;
}
