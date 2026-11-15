/**
 * graph-layout.js — 邻接图的极坐标（同心环）布局。
 *
 * 依据：1490068909042642944「Late night cryptic graph tweet」（427 帧全看）
 *   深底上先浮出一层极坐标参考网（同心环 + 放射线 + 四向十字），
 *   然后节点一颗颗落位、边把它们串起来：整张图是一圈圈同心环，
 *   同一"根分支"的节点占一段连续圆弧、同一种颜色（内圈蓝、外圈紫/绿/黄/橙/青）。
 *   环半径随深度递增，节点多的环被撑大，环与环之间是等距的带。
 *
 * 这里只做布局（几何 + 分组），不画：颜色与线宽由页面决定。
 *
 * API：
 *   adjacencyComponents(ids, neighbors)            → { components, componentOf, sizes, detached }
 *   radialLayout({ ids, neighbors, root, ... })    → { nodes, rings, edges, branches, ... }
 */

function assertGraph(ids, neighbors) {
  if (!Array.isArray(ids) || ids.length === 0) throw new RangeError('ids must be a non-empty array');
  if (new Set(ids).size !== ids.length) throw new RangeError('ids must be unique');
  for (const id of ids) {
    if (!Number.isInteger(id) || id < 0) throw new RangeError('ids must be non-negative integers');
    const nb = neighbors[id];
    if (!Array.isArray(nb)) throw new RangeError(`neighbors[${id}] must be an array`);
    for (const j of nb) if (!Number.isInteger(j) || j < 0) throw new RangeError('neighbor ids must be non-negative integers');
  }
}

/** 无向连通分量（并查集）。只认 ids 集合内部的边，重复边与自环忽略。 */
export function adjacencyComponents(ids, neighbors) {
  assertGraph(ids, neighbors);
  const known = new Map(ids.map((id, i) => [id, i]));
  const parent = ids.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const id of ids) {
    for (const j of new Set(neighbors[id])) {
      if (j === id || !known.has(j)) continue;
      const a = find(known.get(id)), b = find(known.get(j));
      if (a !== b) parent[b] = a;
    }
  }
  const buckets = new Map();
  for (const id of ids) {
    const r = find(known.get(id));
    if (!buckets.has(r)) buckets.set(r, []);
    buckets.get(r).push(id);
  }
  const components = [...buckets.values()].map((m) => m.slice().sort((a, b) => a - b));
  // 大分量在前，同大小按最小 id —— 确定性排序，不依赖 Map 插入顺序
  components.sort((a, b) => b.length - a.length || a[0] - b[0]);
  const componentOf = new Map();
  components.forEach((m, ci) => { for (const id of m) componentOf.set(id, ci); });
  return {
    components,
    componentOf,
    sizes: components.map((m) => m.length),
    detached: components.slice(1).flat(),
  };
}

/**
 * 从 root 做 BFS，把节点排进同心环。
 *
 * 角度分配：同一环内先按"父节点角度"排序（父在同一环时按父序号），再整环等角分布，
 * 最后把整环旋转到第一个节点的父角度上。等角分布 + 按父角度排序，保证每个根分支
 * 在最外圈的投影是一段连续圆弧（就是片子里紫/绿/黄那些色带）。
 *
 * 半径：r_d = max(r_{d-1} + ringGap, k_d * minArc / 2π)，节点多的环自动撑大，不会挤在一起。
 */
export function radialLayout({
  ids, neighbors, root, ringGap = 1, minArc = 0.02, align = 'parent',
} = {}) {
  assertGraph(ids, neighbors);
  if (!Number.isInteger(root) || !ids.includes(root)) throw new RangeError('root must be one of ids');
  if (!Number.isFinite(ringGap) || ringGap <= 0) throw new RangeError('ringGap must be positive');
  if (!Number.isFinite(minArc) || minArc <= 0 || minArc > Math.PI) throw new RangeError('minArc must be in (0, π]');

  const known = new Set(ids);
  const depth = new Map([[root, 0]]);
  const parentOf = new Map([[root, -1]]);
  const branchOf = new Map([[root, -1]]);
  const order = [root];
  const queue = [root];
  for (let h = 0; h < queue.length; h++) {
    const id = queue[h];
    const d = depth.get(id);
    const kids = [...new Set(neighbors[id])]
      .filter((j) => j !== id && known.has(j) && !depth.has(j))
      .sort((a, b) => a - b);
    for (const j of kids) {
      depth.set(j, d + 1);
      parentOf.set(j, id);
      branchOf.set(j, d === 0 ? j : branchOf.get(id));
      order.push(j);
      queue.push(j);
    }
  }
  const reachable = order.slice();
  const unreachable = ids.filter((id) => !depth.has(id)).sort((a, b) => a - b);
  const components = adjacencyComponents(ids, neighbors);

  // 环节点：环内排序依赖父角度，从内往外逐环算
  const ringsMeta = [];
  for (let d = 0; ; d++) {
    const members = reachable.filter((id) => depth.get(id) === d);
    if (!members.length) break;
    ringsMeta.push(members);
  }
  const angleOf = new Map();
  const radiusOf = [];
  const nodes = [];
  let radius = 0;
  ringsMeta.forEach((members, d) => {
    const k = members.length;
    if (d === 0) {
      radius = 0;
      radiusOf.push(0);
      angleOf.set(members[0], 0);
      nodes.push({ id: members[0], depth: 0, ring: 0, slot: 0, angle: 0, x: 0, y: 0, branch: -1, component: components.componentOf.get(members[0]) });
      return;
    }
    const needed = (k * minArc) / (2 * Math.PI);
    radius = Math.max(radius + ringGap, needed);
    radiusOf.push(radius);
    const sorted = members.slice().sort((a, b) => {
      const pa = parentOf.get(a), pb = parentOf.get(b);
      const da = depth.get(pa), db = depth.get(pb);
      const aa = da === d ? null : angleOf.get(pa), ab = db === d ? null : angleOf.get(pb);
      const va = aa === undefined || aa === null ? -1 : aa, vb = ab === undefined || ab === null ? -1 : ab;
      if (va !== vb) return va - vb;
      if (pa !== pb) return pa - pb;
      return a - b;
    });
    // 整环旋转：让第一个节点尽量落在它父节点的角度上
    let rot = 0;
    if (align === 'parent') {
      const first = sorted[0];
      const pa = angleOf.get(parentOf.get(first));
      if (Number.isFinite(pa)) rot = pa - (0.5 * 2 * Math.PI) / k;
    }
    sorted.forEach((id, i) => {
      const angle = rot + (i * 2 * Math.PI) / k;
      angleOf.set(id, angle);
      nodes.push({
        id, depth: d, ring: d, slot: i, angle,
        x: radius * Math.cos(angle), y: radius * Math.sin(angle),
        branch: branchOf.get(id), component: components.componentOf.get(id),
      });
    });
  });

  // 边：每条无向边只留一次；按"深度差"分类（同环 / 相邻环 / 跳环）
  const laidOut = new Set(reachable);
  const edges = [];
  const seen = new Set();
  for (const id of reachable) {
    for (const j of new Set(neighbors[id])) {
      if (j === id || !laidOut.has(j)) continue;
      const a = Math.min(id, j), b = Math.max(id, j), key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dd = Math.abs(depth.get(a) - depth.get(b));
      edges.push({ a, b, depthA: depth.get(a), depthB: depth.get(b), kind: dd === 0 ? 'same' : dd === 1 ? 'adjacent' : 'long' });
    }
  }
  edges.sort((p, q) => p.a - q.a || p.b - q.b);

  // 分支：根的直接孩子各占一段圆弧，带颜色序号
  const branchIds = [...new Set(reachable.map((id) => branchOf.get(id)).filter((b) => b >= 0))].sort((a, b) => a - b);
  const branches = branchIds.map((child, ci) => {
    const members = reachable.filter((id) => branchOf.get(id) === child);
    const angles = members.map((id) => angleOf.get(id));
    return {
      child, color: ci, count: members.length,
      minAngle: Math.min(...angles), maxAngle: Math.max(...angles),
      maxDepth: Math.max(...members.map((id) => depth.get(id))),
    };
  });

  return {
    root,
    nodes: nodes.sort((p, q) => p.id - q.id),
    rings: ringsMeta.map((members, d) => ({
      depth: d, radius: radiusOf[d], count: members.length,
      ids: members.slice().sort((a, b) => a - b),
    })),
    radius,
    maxDepth: ringsMeta.length - 1,
    edges,
    edgeKinds: {
      same: edges.filter((e) => e.kind === 'same').length,
      adjacent: edges.filter((e) => e.kind === 'adjacent').length,
      long: edges.filter((e) => e.kind === 'long').length,
    },
    branches,
    angleOf,
    depthOf: depth,
    parentOf,
    branchOf,
    components,
    unreachable,
    // 度数：节点连了几条边（片子里节点是空心小圈，大小跟度数走）
    degree: new Map(reachable.map((id) => [id, new Set(neighbors[id].filter((j) => laidOut.has(j))).size])),
  };
}
