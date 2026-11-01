import { Town } from './town.js';

/**
 * looptown.js — "完美环"：闭合的圈为什么能让房子飘起来。
 *
 * 1313837640366596096  "I just pushed an update to Townscaper. You can now build flying
 *   towns (if you find any of the perfect loops I've scattered across the grid)"
 *
 * ---- 画面观察（24 帧，512²；岛在半空，下面是细长的腿） ----
 *   · 整座城**离开水面**，靠一圈圈细腿（钢架）撑住，腿的粗细和格子宽度一个量级；
 *   · 腿只在"没有依托的柱子"下面出现，有依托的柱脚是干净的；
 *   · 水面上有圆形波纹（frame 9–13），说明腿一直延伸到水下 —— 所以腿是
 *     "从柱底画到海平面"，不是"画到看不见为止"；
 *   · frame 1 有一块半透明的幽灵房子：放置预览，落地前那一瞬。
 *
 * ---- 这个文件做什么 ----
 * 不造"飞到天上"的动画（那是引擎的事），而是把**判定**做出来并量化：
 *   1. `findEnclosed()` —— 第 L 层上被实心格子完全围住的空区（= 一个闭合的圈）
 *   2. `analyse()`      —— 每根柱子：贴地 / 靠邻居 / 靠"环" / 都没靠上（要腿）
 *   3. 两条规则的差 —— 没有环的时候要多少腿、总长多少；有环时省掉多少
 *
 * 这就是那条帖子里 "if you find any of the perfect loops" 的算术版本：
 * 环不是美术，它是**支撑关系的豁免权**。
 */

/** 先把"第 level 层上实心"的集合取出来。 */
function solidAt(town, grid, level) {
  const set = new Uint8Array(grid.cells.length);
  for (const cell of grid.cells) if (town.isSolid(cell, level)) set[cell.id] = 1;
  return set;
}

/**
 * 第 level 层上被完全围住的空区。
 *
 * 做法：从"网格边缘上的空格"开始泛洪，泛洪不到的空格就是被围住的。
 * 判"边缘"用 edgeNeighbors 里 -1（网格外）的格子 —— 不是用包围盒，
 * 因为这块网格是个不规则六边形，包围盒四角其实在网格外。
 */
export function findEnclosed(town, grid, level) {
  const solid = solidAt(town, grid, level);
  const n = grid.cells.length;
  const outside = new Uint8Array(n);
  const stack = [];
  for (const cell of grid.cells) {
    if (solid[cell.id]) continue;
    const nbr = cell.edgeNeighbors || cell.nbr;
    let rim = false;
    for (let i = 0; i < nbr.length; i++) if (nbr[i] < 0 || nbr[i] === undefined) { rim = true; break; }
    if (rim) { outside[cell.id] = 1; stack.push(cell.id); }
  }
  while (stack.length) {
    const id = stack.pop();
    const nbr = grid.cells[id].edgeNeighbors || grid.cells[id].nbr;
    for (let i = 0; i < nbr.length; i++) {
      const j = nbr[i];
      if (j < 0 || j === undefined) continue;
      if (solid[j] || outside[j]) continue;
      outside[j] = 1;
      stack.push(j);
    }
  }
  // 没被泛洪到 = 被围住；再按连通性切成一个个"环"
  const seen = new Uint8Array(n);
  const regions = [];
  for (const cell of grid.cells) {
    const id = cell.id;
    if (solid[id] || outside[id] || seen[id]) continue;
    const region = [];
    const q = [id];
    seen[id] = 1;
    while (q.length) {
      const k = q.pop();
      region.push(k);
      const nbr = grid.cells[k].edgeNeighbors || grid.cells[k].nbr;
      for (let i = 0; i < nbr.length; i++) {
        const j = nbr[i];
        if (j < 0 || j === undefined) continue;
        if (solid[j] || outside[j] || seen[j]) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    regions.push(region);
  }
  return { regions, solid, outside };
}

/**
 * 支撑分析：把"有靠"拆成两件事 —— **贴地** 和 **成环**。
 *
 * 一条柱子有靠，当且仅当：
 *   1. 它所在的连通块挨着地（有一根 bottom === 1），或者
 *   2. 这个连通块**是个环**：它在某一层上围出了一块空洞（`findEnclosed()` 找到的空区），
 *      而且这块空洞四周的实心格子全在这个块里。
 *
 * 第 2 条要说清楚：原文只说"找到散落在网格里的完美环就能建飞行城"，没讲实现。
 * 我先把"环"读成**邻接图里的圈**（cycle rank ≥ 1），实测发现这个判据是错的：
 * 两格厚的一条 C 形悬臂，cycle rank 还有 18（因为任意 2×2 的格子就自带一个 4 圈），
 * 它照样该掉下去。改成"**必须是空心的**"之后才分得开：整圈 = 1 个空洞 → 豁免；
 * 缺口 = 0 个空洞 → 要腿。这条判据的代价是：实心的一坨（哪怕连接得很密）永远不能飞，
 * 而片子里飞的确实都是空心的环，所以对得上。
 */
export function analyse(town, grid, { loopRule = true, maxLevel = 8 } = {}) {
  const t0 = performance.now();
  const cells = grid.cells;
  const n = cells.length;
  const bottoms = new Int16Array(n);
  const tops = new Int16Array(n);
  for (const c of cells) {
    bottoms[c.id] = town.bottom(c);
    tops[c.id] = town.top(c);
  }

  // 1) 柱子连通块（只认边相邻）
  const comp = new Int32Array(n).fill(-1);
  const comps = [];
  const seen = new Uint8Array(n);
  for (const c of cells) {
    if (!tops[c.id] || seen[c.id]) continue;
    const members = [];
    const q = [c.id];
    seen[c.id] = 1;
    while (q.length) {
      const id = q.pop();
      members.push(id);
      const nbr = cells[id].edgeNeighbors || cells[id].nbr;
      for (let i = 0; i < nbr.length; i++) {
        const j = nbr[i];
        if (j < 0 || j === undefined || seen[j] || !tops[j]) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    const id = comps.length;
    let grounded = false;
    for (const m of members) {
      comp[m] = id;
      if (bottoms[m] === 1) grounded = true;
    }
    comps.push({ id, members, grounded, hollow: 0, loopLevels: [] });
  }

  // 2) 每一层的空洞 → 归给"唯一围住它的那个连通块"
  if (loopRule) {
    for (let lv = 1; lv <= maxLevel; lv++) {
      const { regions } = findEnclosed(town, grid, lv);
      for (const region of regions) {
        const owners = new Set();
        for (const id of region) {
          const nbr = cells[id].edgeNeighbors || cells[id].nbr;
          for (let i = 0; i < nbr.length; i++) {
            const j = nbr[i];
            if (j < 0 || j === undefined) continue;
            if (comp[j] >= 0 && town.isSolid(cells[j], lv)) owners.add(comp[j]);
          }
        }
        if (owners.size === 1) {
          const k = comps[[...owners][0]];
          k.hollow++;
          k.loopLevels.push({ level: lv, cells: region.length });
        }
      }
    }
  }

  // 3) 没挨地的块：空心的免腿，其他的在最低那批柱子下落腿
  let legs = 0;
  let legLength = 0;
  let legsWithoutRule = 0;
  let floatingComps = 0;
  let loopComps = 0;
  const legCells = [];
  const floating = [];
  for (const k of comps) {
    if (k.grounded) continue;
    floatingComps++;
    const cyclic = loopRule && k.hollow > 0;
    if (cyclic) loopComps++;
    floating.push({ cells: k.members.length, hollow: k.hollow, loops: k.loopLevels });
    let lowest = Infinity;
    for (const m of k.members) lowest = Math.min(lowest, bottoms[m]);
    const feet = k.members.filter((m) => bottoms[m] === lowest);
    legsWithoutRule += feet.length;
    if (cyclic) continue;
    legs += feet.length;
    for (const m of feet) {
      legCells.push({ cell: m, length: bottoms[m] - 1 });
      legLength += bottoms[m] - 1;
    }
  }

  return {
    columns: comps.reduce((s, k) => s + k.members.length, 0),
    components: comps.length,
    groundedComps: comps.length - floatingComps,
    floatingComps,
    loopComps,
    floating,
    legs,
    legsWithoutRule,
    legLength,
    legsSaved: legsWithoutRule - legs,
    legCells,
    ms: performance.now() - t0,
  };
}

/**
 * 演示用的镇子：**离开地面的**一圈 / 一段。
 *
 * 共同点：所有柱子都只填在第 3 层，底下什么都没有 → 整坨不挨地。
 *   gap=false → 一整圈 ：cycle rank ≥ 1 → 有环 → 不用腿（"飞"）
 *   gap=true  → 一个缺口 ：退化成一条悬臂，rank = 0 → 要腿
 * 差多少腿，就是"perfect loop"换成结构语言之后的价值。
 */
export function makeDemoTown(grid, { gap = false, level = 3, inner = 1.15, outer = 2.1 } = {}) {
  const town = new Town(grid);
  const ring = [];
  for (const c of grid.cells) {
    const d = Math.hypot(c.cx, c.cz);
    if (d >= inner && d <= outer) ring.push(c);
  }
  let gapCells = [];
  if (gap) {
    // 缺口要**整片切开**：只抠掉一格的话，这圈有两格厚，剩下的部分仍然带环
    // （第一版只抠一格 → 缺口那组 cycle rank 还是 24，等于没切断）
    gapCells = ring.filter((c) => {
      const a = Math.atan2(c.cz, c.cx);
      return Math.abs(a) < 0.42;
    });
  }
  // 只填**第 level 层**（fill() 会从 1 填到 level，那就有地面支撑了，
  // 第一版就是这么写的，结果 floatingComps 恒为 0）
  const cut = new Set(gapCells.map((c) => c.id));
  for (const c of ring) if (!cut.has(c.id)) town.setSolid(c, level, true);
  return { town, ring, gapCells, level };
}

/** 一键体检：整圈 vs 缺口，各跑一遍（规则开 / 关）。 */
export function audit({ grid, level = 3 } = {}) {
  const closedDemo = makeDemoTown(grid, { gap: false, level });
  const closed = analyse(closedDemo.town, grid, { loopRule: true });
  const closedNoRule = analyse(closedDemo.town, grid, { loopRule: false });

  const openDemo = makeDemoTown(grid, { gap: true, level });
  const open = analyse(openDemo.town, grid, { loopRule: true });

  const enclosed = findEnclosed(closedDemo.town, grid, level);

  return {
    ring: closedDemo.ring.length,
    level,
    closed: { comps: closed.floatingComps, loops: closed.loopComps, legs: closed.legs, legLength: closed.legLength, hollow: closed.floating.map((f) => f.hollow) },
    closedNoRule: { legs: closedNoRule.legs, legLength: closedNoRule.legLength },
    open: { comps: open.floatingComps, loops: open.loopComps, legs: open.legs, legLength: open.legLength, hollow: open.floating.map((f) => f.hollow) },
    // 另一种读法：这一圈在第 level-1 层上围出了几块空区、共多少格
    enclosedRegions: enclosed.regions.length,
    enclosedCells: enclosed.regions.reduce((s, r) => s + r.length, 0),
    ms: closed.ms + closedNoRule.ms + open.ms,
  };
}
