/**
 * voxelao.js — 五档 AO 的同一份"体素事实"：平涂 / 上向法线 / 顶点体素 AO /
 * 方向性 AO。原文那条推文本身就是一条**对比序列**。
 *
 * 原文（x.com/OskSta/status/793557992931266561, 2016-11-01）：
 *
 *   "flat -> up normal -> vertex voxel AO -> SSAO -> directional AO
 *    (With textures and baked vertex colors, I could get rid of the SSAO)"
 *
 * 画面（4 帧，每帧差 1 秒，就是四次切换）：
 *   ① 纯白模，几乎没有明暗 —— flat；
 *   ② 出现极软的上下渐变，凹处略暗 —— up normal；
 *   ③ 拱洞下方、墙脚、平台之间的窄缝明显变暗，但**没有方向性** —— vertex voxel AO；
 *   ④ 同一个拱，朝左的面偏粉、朝右的面偏绿，暗部带方向色 —— directional AO
 *      （他最后留下的是这一档 + 顶点色，把 SSAO 去掉）。
 *
 * 为什么"方向性 AO"值得单独一档：顶点 AO 只知道"这里被挡住多少"，
 * 不知道"被哪边挡住"。而在崖壁/街谷里，挡光的方向决定了这一面该偏冷还是偏暖。
 * 所以方向性 AO 是**六个标量**（±X/±Y/±Z 各一个），不是一个标量。
 *
 * 本文件只做纯计算：给一张体素高度场，算每个面的四种着色量。
 */

/**
 * @param {object} town 体素场（town.top(cell)）
 * @param {object} grid
 * @returns {{height:Int16Array, at:Function, faceShading:Function, stats:Function}}
 */
export function buildVoxelAO(town, grid) {
  const cells = grid.cells;
  const height = new Int16Array(cells.length);
  for (let i = 0; i < cells.length; i++) height[i] = Math.max(0, town.top(cells[i]));

  // 六个方向的邻居高度：用来判断"这个方向有没有东西挡着"
  const dirOffsets = [
    ['+x', 1, 0], ['-x', -1, 0], ['+z', 0, 1], ['-z', 0, -1],
  ];
  const neighbourHeight = (cell, dx, dz) => {
    for (let e = 0; e < 4; e++) {
      const nid = cell.edgeNeighbors[e];
      if (nid < 0) continue;
      const nc = cells[nid];
      // 用连线方向判断是不是"那一侧"的邻居（不规则格子上不能靠索引顺序）
      const vx = nc.cx - cell.cx, vz = nc.cz - cell.cz;
      const l = Math.hypot(vx, vz) || 1;
      if ((vx / l) * dx + (vz / l) * dz > 0.55) return height[nid];
    }
    return 0;
  };

  /**
   * 一个面的四种量。dir = 'top' | '+x' | '-x' | '+z' | '-z'
   * @returns {{flat:number, upNormal:number, ao:number, dirAo:number[], tint:string}}
   */
  function faceShading(cell, dir) {
    const h = height[cell.id];
    const nb = dirOffsets.map(([name, dx, dz]) => ({ name, dx, dz, h: neighbourHeight(cell, dx, dz) }));
    if (dir === 'top') {
      // 顶面：四个水平方向里有几个比自己高 → 越凹越暗
      let blocked = 0, wsum = 0;
      for (const n of nb) {
        const d = Math.max(0, n.h - h);
        const w = 1 / (1 + d * 0.8);
        blocked += (d > 0 ? 1 : 0) * w;
        wsum += w;
      }
      const ao = 1 - 0.30 * (blocked / Math.max(1e-6, wsum));
      // 方向性：把"哪边高"摊到 X/Z 两个轴上，返回带符号的量
      const px = Math.max(0, nb[0].h - h), nx = Math.max(0, nb[1].h - h);
      const pz = Math.max(0, nb[2].h - h), nz = Math.max(0, nb[3].h - h);
      const k = 1 / (1 + Math.max(px, nx, pz, nz, 1));
      return { flat: 1, upNormal: 0.86 + 0.14 * 1, ao, dirAo: [(px - nx) * k, 1, (pz - nz) * k] };
    }
    // 侧面：先看正对自己的那个邻居有多高（把自己埋住 = 很暗），
    // 再看两侧的邻居（形成街谷的话两侧都挡光）
    const rec = nb.find((n) => n.name === dir);
    const front = rec ? Math.max(0, rec.h - h) : 0;
    let side = 0;
    for (const n of nb) if (n.name !== dir && n.name !== opposite(dir)) side = Math.max(side, Math.max(0, n.h - h));
    const ao = 1 - 0.34 * Math.min(1, front * 0.5) - 0.14 * Math.min(1, side * 0.5);
    // 侧面朝上的分量越多越亮（这一步就是"up normal"那档）
    const upNormal = 0.55 + 0.25 * (dir === 'top' ? 1 : 0);
    const sign = dir[0] === '+' ? 1 : -1;
    const along = dir[1] === 'x' ? [sign, 0, 0] : [0, 0, sign];
    return { flat: 1, upNormal, ao, dirAo: along };
  }

  function opposite(dir) {
    return dir[0] === '+' ? '-' + dir[1] : '+' + dir[1];
  }

  /** 统计：把四种着色量在一整座岛上的分布摊开，用来证明它们确实不同。 */
  function stats() {
    const modes = { flat: [], upNormal: [], ao: [], dirAo: [] };
    for (const cell of cells) {
      if (height[cell.id] <= 0) continue;
      const t = faceShading(cell, 'top');
      modes.flat.push(t.flat);
      modes.upNormal.push(t.upNormal);
      modes.ao.push(t.ao);
      modes.dirAo.push(Math.hypot(t.dirAo[0], t.dirAo[2]));
      for (const d of ['+x', '-x', '+z', '-z']) {
        const f = faceShading(cell, d);
        modes.ao.push(f.ao);
        modes.upNormal.push(f.upNormal);
      }
    }
    const st = (arr) => {
      const a = arr.slice().sort((x, y) => x - y);
      return { mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3), p05: +a[(a.length * 0.05) | 0].toFixed(3), p95: +a[(a.length * 0.95) | 0].toFixed(3) };
    };
    return { flat: st(modes.flat), upNormal: st(modes.upNormal), ao: st(modes.ao), dirAo: st(modes.dirAo) };
  }

  return { height, faceShading, stats, at: (id) => height[id] };
}
