// r56 C08 · 1670790425232175108「my generator also output pure triangle/hex and square grids, to illustrate
// why I'm going for my mixed approach」— 原片（0200–0299）是在纯六边形格上生成的整座岛（黄色台地 +
// 六边形格线），与三角/方格/混合同一条生成管线。这里把共享 grid.js 已有的纯格型接到主场景：
// index.html?grid=hex|square|tri&scene=terrain（app.js 只加一行挂钩，默认 quad/mixed 不变）。
import { buildHexGrid, buildSquareGrid, buildMixedGrid } from './grid.js';

export const PURE_GRIDS = {
  hex: { name: '纯六边形', note: '1670790425232175108 对照', build: () => buildHexGrid({ radius: 9, cellSize: 1.15 }), radius: 109 },
  square: { name: '纯方格', note: '1670790425232175108 对照', build: () => buildSquareGrid({ radius: 15, cellSize: 1.1 }), radius: 115 },
  tri: { name: '纯三角', note: '1670790425232175108 对照', build: () => buildMixedGrid({ radius: 18, hexSize: .8, mergeRate: 0, seed: 5 }), radius: 118 },
};

/** 统计：格型 / 每格边数分布（页面与测试共用） */
export function gridKindSummary(grid) {
  const n = {}; for (const c of grid.cells) n[c.n] = (n[c.n] || 0) + 1;
  return { cells: grid.cells.length, sides: n };
}
