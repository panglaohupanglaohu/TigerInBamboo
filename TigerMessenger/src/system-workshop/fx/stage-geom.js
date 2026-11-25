/**
 * 表现层 · 舞台格网的几何小工具（纯数据，Worker / Node 都能跑）。R37–R39 的火 / 走廊 / 沉积 / 弹道共用。
 * 输入是 battle.probe 的舞台采样 grid：[[x, z, lv, house], …]（x,z = 贴球舞台坐标，lv = 台阶层数，house = 是否小屋格）。
 *   levelHeight  每层多高（舞台单位）：舞台默认 0.5（reaBattleStage.js 的 levelHeight），采样里没写就用 0.5
 *   spacing      相邻格中心距：抽 64 个格子求最近邻再取中位数（格网是 REA 四边形网格，不一定正好 1）
 *   neighbours   空间哈希，找 1.5 × spacing 以内的邻格
 */
export const DEFAULT_LEVEL_HEIGHT = 0.5;
export const levelHeight = (site) => (Number.isFinite(site?.levelHeight) && site.levelHeight > 0 ? site.levelHeight : DEFAULT_LEVEL_HEIGHT);

export function gridOf(site) {
  const g = site?.grid;
  if (!Array.isArray(g) || !g.length) throw Error('采样里没有舞台格网');
  return g;
}

/** 相邻格中心距（中位数）。少于 2 格时返回 1。 */
export function cellSpacing(grid) {
  if (grid.length < 2) return 1;
  const step = Math.max(1, Math.floor(grid.length / 64)), d = [];
  for (let i = 0; i < grid.length; i += step) {
    let best = Infinity;
    for (let j = 0; j < grid.length; j++) if (j !== i) { const v = Math.hypot(grid[i][0] - grid[j][0], grid[i][1] - grid[j][1]); if (v > 1e-6 && v < best) best = v; }
    if (Number.isFinite(best)) d.push(best);
  }
  d.sort((a, b) => a - b);
  return d.length ? d[d.length >> 1] : 1;
}

/** 空间哈希：neighbours(i) → 半径 r 内的其他格下标（按距离升序）。 */
export function makeNeighbourIndex(grid, spacing = cellSpacing(grid), radius = spacing * 1.5) {
  const bin = Math.max(radius, 1e-6), key = (a, b) => a + ',' + b, bins = new Map();
  grid.forEach((c, i) => { const k = key(Math.floor(c[0] / bin), Math.floor(c[1] / bin)); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(i); });
  return {
    spacing, radius,
    neighbours(i) {
      const c = grid[i], bx = Math.floor(c[0] / bin), bz = Math.floor(c[1] / bin), out = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const j of bins.get(key(bx + dx, bz + dz)) || []) {
        if (j === i) continue; const d = Math.hypot(grid[j][0] - c[0], grid[j][1] - c[1]); if (d <= radius && d > 1e-9) out.push([j, d]);
      }
      return out.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    },
  };
}

/** 小屋格（house 标记）按「层高降序、x、z」排好；没有小屋时取最高的若干格（同样排序），保证确定性。 */
export function rankedHosts(grid, want = 8) {
  const ord = (a, b) => b[1][2] - a[1][2] || a[1][0] - b[1][0] || a[1][1] - b[1][1];
  const houses = grid.map((c, i) => [i, c]).filter(([, c]) => c[3]).sort(ord);
  if (houses.length >= want) return { cells: houses.slice(0, want).map(([i]) => i), basis: 'house' };
  const rest = grid.map((c, i) => [i, c]).filter(([, c]) => !c[3] && c[2] > 0).sort(ord);
  return { cells: [...houses, ...rest].slice(0, want).map(([i]) => i), basis: houses.length ? 'house+top' : 'top' };
}

/** 边缘格（岸）：陆地格里邻格不足 3 个（格网外是海）或挨着海格（lv ≤ 0）的。 */
export function edgeCells(grid, index) {
  const out = [];
  for (let i = 0; i < grid.length; i++) { if (!(grid[i][2] > 0)) continue; const nb = index.neighbours(i); if (nb.length < 3 || nb.some((j) => !(grid[j][2] > 0))) out.push(i); }
  return out;
}

export const round = (v, k = 3) => +(+v).toFixed(k);
