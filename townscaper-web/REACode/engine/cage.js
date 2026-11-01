/**
 * cage.js — 用"笼子"把格子拉歪，让崖面不那么规整。
 *
 * 原文（x.com/OskSta/status/1579478470098243584, 2022-10-10）：
 *
 *   "To make the cliffs look more organic, I'm doing some pretty radical cage
 *    deformation on the cells."
 *
 * 画面（24 帧，全是白线框）：
 *   · 每个台地外面罩着一个**盒子状的笼子**（上下两个四边形 + 四条竖棱）；
 *   · 笼子的面在动：有的往里收、有的往外顶，竖棱跟着弯；
 *   · 台地本体跟着笼子一起变 —— 崖面从"竖直的墙"变成"上宽下窄 / 中间鼓"；
 *   · 笼子变形的幅度和格子高度相关：矮台地几乎不动，高崖扭得最厉害。
 *
 * 为什么不能直接"给顶点加噪声"：格子是**共享顶点**的，逐格加噪声会在相邻格
 * 之间撕开缝（我们的 mesher 每格独立建面，缝会直接变成一条黑线）。所以这里
 * 的位移场只依赖**顶点的基准坐标**（`p.bx/p.bz`），共享同一个顶点的格子拿到
 * 完全相同的位移 —— 这就是"笼子"在数学上的样子：顶点是一组把手，笼面是把手
 * 之间的插值。
 *
 * 为什么幅度要跟高度走：原文的高崖扭得最凶。这里用 `1 + h * lift` 做权重，
 * 于是 1 级台阶只挪一点点，7 级崖壁挪得最多 —— 和画面一致。
 *
 * 纯数据（不 import three）。
 */

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
}

/**
 * 对整张网格做笼形变形（就地修改 `cell.pts[].x/z` 与 `cell.cx/cz`）。
 *
 * @param {object} grid
 * @param {object} town 只读，用来取每格高度
 * @param {object} opts
 *   amount  基础位移（世界单位）
 *   freq    噪声频率（每世界单位几个周期）；越小越"大团"
 *   lift    高度权重（高崖扭得更多）
 *   seed
 * @returns {{moved:number, maxShift:number, byHeight:object}}
 */
export function deformCages(grid, town, { amount = 0.10, freq = 0.42, lift = 0.22, seed = 3 } = {}) {
  const cells = grid.cells;

  // 两遍。第一遍收集"每个顶点被最高的那个格子顶到多高"：
  // 一个顶点被 4 个格子共享，高度可能差好几级；如果按"第一个碰到的格子"算权重，
  // 同一根崖棱会被不同高度的相邻格拉出两种幅度，边缘就出现台阶状的折痕。
  const vmax = new Map();
  for (const cell of cells) {
    const h = Math.max(0, town.top(cell));
    for (const p of cell.pts) {
      const key = p.bx.toFixed(3) + ',' + p.bz.toFixed(3);
      const cur = vmax.get(key);
      if (cur === undefined || h > cur) vmax.set(key, h);
    }
  }

  let moved = 0, maxShift = 0;
  const byHeight = {};

  for (const cell of cells) {
    const h = Math.max(0, town.top(cell));
    for (const p of cell.pts) {
      const key = p.bx.toFixed(3) + ',' + p.bz.toFixed(3);
      const hv = vmax.get(key) || h;
      // 位移只依赖基准坐标 → 共享顶点的格子拿到同一个位移，不会裂缝
      const n1 = valueNoise(p.bx * freq + 11.3, p.bz * freq - 4.7, seed) - 0.5;
      const n2 = valueNoise(p.bx * freq - 7.1, p.bz * freq + 19.2, seed + 91) - 0.5;
      // 二级高频：让崖面有"手捏过"的小起伏，而不是整片平移
      const fine = valueNoise(p.bx * freq * 3.1, p.bz * freq * 3.1, seed + 133) - 0.5;
      const k = amount * (1 + Math.max(0, hv - 1) * lift);
      p.ox = (n1 * 2 + fine * 0.6) * k;
      p.oz = (n2 * 2 + fine * 0.6) * k;
      p.x = p.bx + p.ox;
      p.z = p.bz + p.oz;
      const s2 = Math.hypot(p.ox, p.oz);
      if (s2 > maxShift) maxShift = s2;
      moved++;
    }
    cell.cx = (cell.pts[0].x + cell.pts[2].x) * 0.5;
    cell.cz = (cell.pts[0].z + cell.pts[2].z) * 0.5;
    // 包围盒必须重算：边缘场 / 光照栅格 / 面阴影都靠它
    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    for (const p of cell.pts) {
      if (p.x < mnX) mnX = p.x;
      if (p.x > mxX) mxX = p.x;
      if (p.z < mnZ) mnZ = p.z;
      if (p.z > mxZ) mxZ = p.z;
    }
    cell.minX = mnX; cell.maxX = mxX; cell.minZ = mnZ; cell.maxZ = mxZ;
    const bucket = h <= 1 ? '1' : h <= 3 ? '2-3' : h <= 5 ? '4-5' : '6+';
    byHeight[bucket] = (byHeight[bucket] || 0) + 1;
  }

  return { moved, maxShift: +maxShift.toFixed(4), byHeight, vertices: vmax.size };
}

/** 恢复：把顶点放回基准位置（`R` 换岛之前的对照实验要用）。 */
export function resetCages(grid) {
  for (const cell of grid.cells) {
    for (const p of cell.pts) { p.ox = 0; p.oz = 0; p.x = p.bx; p.z = p.bz; }
    cell.cx = (cell.pts[0].x + cell.pts[2].x) * 0.5;
    cell.cz = (cell.pts[0].z + cell.pts[2].z) * 0.5;
    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    for (const p of cell.pts) {
      if (p.x < mnX) mnX = p.x;
      if (p.x > mxX) mxX = p.x;
      if (p.z < mnZ) mnZ = p.z;
      if (p.z > mxZ) mxZ = p.z;
    }
    cell.minX = mnX; cell.maxX = mxX; cell.minZ = mnZ; cell.maxZ = mxZ;
  }
}
