/**
 * region-boundary.js — 格集合 → 沿格边的区域边界环（1120036868966502401）
 *
 * 逐帧（703 帧，第 44 轮判读纠正）：不规则网格（四边形 + 三角）编辑视图里，红色边界线**严格落在格边上**、在格角直角 / 折角转弯，
 *   有闭环、有开放端（碰到可视范围边）、有支线（两块区域只在一个角相接时的「捏点」）；单格整格黄色高亮；
 *   不是穿过格心的平滑等值线（那是 core/contour.js 的 marching squares，只覆盖了「共享边交点」这一层子问题）。
 * 做法：
 *   1) 边界段 = 一侧在集合内、另一侧不在（或在网格外）的格边；格边端点用格点 id（共享顶点）；
 *   2) 以顶点为结点串链：度 2 的顶点直接连，度 ≠ 2 的顶点（捏点 / 开放端）是链的断点；
 *   3) 回到起点 = 闭环；端点奇数度 = 开放端；两个捏点之间 = pinched 段（仍属闭合边界）。includeBorder=false 时网格外边不算边界 → 碰到网格外沿就是开放端（片中可视范围边）。
 * 只读 cells（pts 带 id、edgeNeighbors），不依赖 three；overlay 由 world/contour-overlay.js 画。
 */
export function regionBoundary(cells, inSet, { includeBorder = true } = {}) {
  const segs = [], byVertex = new Map(), pos = new Map();
  for (const c of cells) {
    if (!inSet(c)) continue;
    for (let i = 0; i < c.n; i++) {
      const nid = c.edgeNeighbors[i];
      if (nid >= 0 && inSet(cells[nid])) continue;
      if (nid < 0 && !includeBorder) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const s = { a: a.id, b: b.id, cell: c.id, edge: i, outside: nid };
      segs.push(s); pos.set(a.id, a); pos.set(b.id, b);
      for (const v of [a.id, b.id]) { if (!byVertex.has(v)) byVertex.set(v, []); byVertex.get(v).push(segs.length - 1); }
    }
  }
  const used = new Uint8Array(segs.length), loops = [], open = [], pinched = [];
  const branch = [...byVertex].filter(([, l]) => l.length > 2).map(([v]) => v);
  const ends = [...byVertex].filter(([, l]) => l.length !== 2).map(([v]) => v);
  const walk = (start, first) => {
    const chain = [start]; let v = start, si = first;
    while (si != null && !used[si]) {
      used[si] = 1; const s = segs[si]; v = s.a === v ? s.b : s.a; chain.push(v);
      const nx = byVertex.get(v).filter((k) => !used[k]);
      if (byVertex.get(v).length !== 2 || !nx.length) break;
      si = nx[0];
    }
    return chain;
  };
  // 先从断点出发走开放链 / 捏点之间的链
  const deg = (v) => byVertex.get(v).length;
  for (const v of ends) for (const si of byVertex.get(v)) if (!used[si]) { const ch = walk(v, si), a = ch[0], b = ch[ch.length - 1]; (a === b ? loops : deg(a) % 2 || deg(b) % 2 ? open : pinched).push(ch); }
  // 剩下的都是纯闭环
  for (let i = 0; i < segs.length; i++) if (!used[i]) { const s = segs[i]; const ch = walk(s.a, i); loops.push(ch); }
  // open = 真开放端（端点奇数度：碰到不画的外沿）；pinched = 两个捏点之间的一段（属于闭合边界，只是在捏点断开）
  return { segments: segs, loops, open, pinched, branch, point: (id) => pos.get(id) };
}

/** 整格高亮：返回格的多边形顶点（世界 x,z），给 overlay 画填充。 */
export const cellOutline = (cell) => cell.pts.map((p) => [p.x, p.z]);
