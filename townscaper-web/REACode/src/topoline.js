/**
 * topoline.js — 在不规则四边形网格上追"拓扑直线"。
 *
 * 原文（x.com/OskSta/status/1384958097542819845, 2021-04-21）：
 *
 *   "I wrote a script to trace topologically straight lines across the
 *    Townscaper grid. I think I'll use it for a thing in the gamepad controls
 *    and possibly some drag-to-paint mode."
 *
 * 画面（24 帧，青灰底上一张细网格）：
 *   · 一条浅色折线从画面外进来，穿过一格又一格；
 *   · 线在**格子内部永远是直的**——从一条边进，从对边出；
 *   · 所有拐弯都发生在**边上/顶点处**，而且都是 90°，
 *     所以整条线看起来像"一路直走，偶尔直角拐弯"，不是随手画的曲线；
 *   · 线是虚线感（因为每格一段、段与段之间接缝处亮度略降）；
 *   · 画到 4.7s 时线自己拐回来并闭合了一圈。
 *
 * 这就是它的定义：**每格内沿"入射边 → 对边"走**。拐弯不是"改方向"，
 * 而是"换一条对边" —— 于是线在任何一格里的长度恒等于该格的一条中线，
 * 这正好是拖拽涂色要的性质：笔刷一次只涂它真正穿过的格子。
 *
 * 纯数据（不 import three），可直接在 node 里量：见 `stats()`。
 */

/**
 * 走一条拓扑直线。
 *
 * @param {object} grid 四边形网格（cell.pts / cell.edgeNeighbors）
 * @param {object} opts
 *   start      起始格子 id
 *   entryEdge  从这条边"进入"（0..3）；对边是出口
 *   maxCells   最多穿多少格
 *   turnChance 在边界的拐弯概率（0 = 完全直走，1 = 每步都拐）
 *   rng
 * @returns {{cells:number[], points:number[][], turns:number, entry:number}}
 */
export function traceStraightLine(grid, {
  start = 0,
  entryEdge = 0,
  maxCells = 400,
  turnChance = 0.35,
  rng = Math.random,
} = {}) {
  const cells = grid.cells;
  const line = { cells: [], points: [], perCell: [], turns: 0, entry: entryEdge };
  const seen = new Set();

  let id = start;
  let enter = entryEdge;      // 进入当前格用的是哪条边
  let guard = 0;

  while (id >= 0 && guard++ < maxCells) {
    const cell = cells[id];
    if (!cell || seen.has(id)) break;
    seen.add(id);

    // 出口 = 入口的对边。这一句就是"拓扑直线"的全部定义：
    // 在格子内部不做任何方向判断，所以线在格内必然笔直。
    let exit = (enter + 2) % 4;
    const eIn = edgeMid(cell, enter);
    const eOut = edgeMid(cell, exit);
    line.points.push(eIn, [cell.cx, cell.cz], eOut);
    line.cells.push(id);
    // 记下"进哪条边、出哪条边"：渲染时要按这一格自己的高度抬起来画，
    // 所以调用方需要知道每格的两个端点（points 里混了拐弯用的连接点，索引不可靠）
    line.perCell.push({ id, enter, exit });

    // 到边界之后才允许拐弯：把"出口"换成相邻的另一条边。
    // 这就是画面里那些 90° 直角 —— 拐点落在边上，不落在格内。
    let next = cell.edgeNeighbors[exit];
    if (next < 0) break;                    // 走到网格边界，收工
    if (rng() < turnChance) {
      const side = rng() < 0.5 ? (exit + 1) % 4 : (exit + 3) % 4;
      const sideNb = cell.edgeNeighbors[side];
      if (sideNb >= 0) {
        // 拐弯：出边换成侧边，于是下一格的"入口"是那条侧边的对边
        line.turns++;
        const nb = cells[sideNb];
        // 找到 sideNb 上与之共享的那条边
        let nbEdge = -1;
        for (let i = 0; i < 4; i++) if (nb.edgeNeighbors[i] === id) { nbEdge = i; break; }
        if (nbEdge < 0) break;
        line.points.push([nb.cx, nb.cz]);
        id = sideNb;
        enter = nbEdge;
        continue;
      }
    }
    // 直行
    const nb = cells[next];
    let nbEdge = -1;
    for (let i = 0; i < 4; i++) if (nb.edgeNeighbors[i] === id) { nbEdge = i; break; }
    if (nbEdge < 0) break;
    id = next;
    enter = nbEdge;
  }

  return line;
}

/** 格子第 i 条边的中点（世界坐标 xz）。 */
export function edgeMid(cell, i) {
  const a = cell.pts[i];
  const b = cell.pts[(i + 1) % 4];
  return [(a.x + b.x) * 0.5, (a.z + b.z) * 0.5];
}

/**
 * 从若干条线里量"到底有多直"。
 *
 * 三个量：
 *   · cellsPerTurn  平均每拐一次弯穿了多少格（越大越直）
 *   · straightness  格内直线的总长 / 折线总长（1.0 = 完全没有拐弯）
 *   · closure       首尾是否回到起点附近（片子里最后闭合了一圈）
 */
export function stats(lines) {
  let cells = 0, turns = 0, straight = 0, total = 0, closed = 0;
  for (const l of lines) {
    cells += l.cells.length;
    turns += l.turns;
    // 格内段（points 里每 3 个点一段：入边中点→中心→出边中点）
    for (let i = 0; i + 2 < l.points.length; i += 3) {
      const [a, b, c] = [l.points[i], l.points[i + 1], l.points[i + 2]];
      straight += dist(a, b) + dist(b, c);
      total += dist(a, b) + dist(b, c);
      // 段与段之间的"接缝"（出边中点 → 下一格中心）也算进总长，
      // 否则 straightness 会永远等于 1，量不出任何东西
      if (i + 3 < l.points.length) total += dist(c, l.points[i + 3]);
    }
    const p0 = l.points[0], pn = l.points[l.points.length - 1];
    if (p0 && pn && dist(p0, pn) < 1.2) closed++;
  }
  return {
    lines: lines.length,
    cells,
    turns,
    cellsPerTurn: turns ? +(cells / turns).toFixed(2) : cells,
    straightness: total ? +(straight / total).toFixed(3) : 1,
    closed,
  };
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
