/**
 * atlas-c09.js — 第 56 批 C09-A：矩形树打包的"手臂"可视化、3D 树展开、底-左候选顺序（共享 Atlas 不改）。
 *
 * 1765115069837221962 "visualizing the recursive tree parsing as it adds new rects. Note that when the board is
 *   more fragmented the arm tends to have more fingers."
 *   画面（2D）：深紫底板，已放的块是灰调彩色；每次尝试放一块时，一条青色折线从树根出发、沿树往下走到碰撞
 *   查询碰到的叶子（分叉处长出"手指"），黄框 = 这次候选位置。板子从左下角往上、往右填。
 * 1764958522398146667 "A cute binary tree rect packer. Generating the placement attempts is kinda brute force …
 *   then it's using the tree properly for fast collision checks."
 *   画面：先 2D 填，之后镜头倾斜成 3D —— 每层树节点框按深度一层层叠在板子上方（根在最上），白色树枝把父节点
 *   中心连到子节点中心，最底下是彩色已放块；黄框是当前候选。
 *
 * 本文件只读共享 Atlas（root 节点、canPlace/allocateAt 的 lastTrace、rects()），不改它的切分与放置规则：
 *   treeLayers()      — 显式栈遍历整棵树：节点框 + 深度 + 父子树枝（3D 展开图的数据）。
 *   armFromTrace()    — 把一次碰撞查询的 trace（含 parent 下标）变成"手臂"折线：父中心→子中心，先横后竖；
 *                       fingers = 这次查询真正走到的叶子数（与 atlas.recursiveFill 的 treeFingers 同口径）。
 *   placeBottomLeft() — 候选 = 板角 + 已放块的角（+ 有界随机点），按 (y, x) 从下到上、从左到右排序后逐个
 *                       用树做碰撞查询（canPlace，带 trace），第一个通过的 allocateAt 落位（可跨叶，存活槽不动）。
 *   project3D()       — 3D 展开图的正交投影（yaw 绕竖轴、pitch 俯仰），供画布直接画线。
 * y 轴约定：atlas y=0 视为板子"底边"，页面画布把它画在下方。
 */
function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export { lcg as atlasRng };

/** 整棵树的节点（显式栈，不递归）。返回 {nodes:[{x,y,w,h,depth,leaf,used,parent}], branches:[[parentIdx, childIdx]], maxDepth}。 */
export function treeLayers(atlas) {
  const nodes = [], branches = [], stack = [[atlas.root, 0, -1]]; let maxDepth = 0;
  while (stack.length) {
    const [n, d, p] = stack.pop(), i = nodes.length;
    nodes.push({ x: n.x, y: n.y, w: n.w, h: n.h, depth: d, leaf: !n.a, used: !!n.used, parent: p });
    if (p >= 0) branches.push([p, i]);
    maxDepth = Math.max(maxDepth, d);
    if (n.a) stack.push([n.b, d + 1, i], [n.a, d + 1, i]);
  }
  return { nodes, branches, maxDepth };
}

/**
 * 一次碰撞查询（atlas.canPlace/allocateAt 的 lastTrace）→ 手臂。trace 事件 {x,y,w,h,depth,parent,decision}，
 * decision ∈ outside|branch|used|free。只沿与查询框相交的节点走（outside 的不画，那是被树剪掉的枝）。
 * 返回 {segments:[[x0,y0,x1,y1]], fingers, reach, pruned}：fingers = 走到的叶子数，pruned = 被包围盒剪掉的子树数。
 */
export function armFromTrace(trace, query = null) {
  const segments = []; let fingers = 0, pruned = 0, reach = 0;
  const c = (e) => [e.x + e.w / 2, e.y + e.h / 2];
  trace.forEach((e) => {
    if (e.decision === 'outside') { pruned++; return; }
    if (e.decision === 'free' || e.decision === 'used') {
      fingers++; reach = Math.max(reach, e.depth);
      if (query) {   // 指尖：叶子中心 → 叶子与查询框重叠部分的中心（手指伸进黄框）
        const x0 = Math.max(e.x, query.x), x1 = Math.min(e.x + e.w, query.x + query.w), y0 = Math.max(e.y, query.y), y1 = Math.min(e.y + e.h, query.y + query.h);
        const [lx, ly] = c(e), tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
        segments.push([lx, ly, tx, ly], [tx, ly, tx, ty]);
      }
    }
    if (e.parent < 0) return;
    const p = trace[e.parent], [px, py] = c(p), [cx, cy] = c(e);
    segments.push([px, py, cx, py], [cx, py, cx, cy]);       // 先横后竖：原片青线是直角折线
  });
  return { segments, fingers, reach, pruned };
}

/** 底-左候选顺序放置。返回 {slot, tried, trace, arm} 或 slot=null（trace 为最后一次失败查询）。 */
export function placeBottomLeft(atlas, w, h, { rng = Math.random, attempts = 24 } = {}) {
  const W = atlas.width, H = atlas.height, cand = [[0, 0], [W - w, 0], [0, H - h], [W - w, H - h]];
  for (const r of atlas.rects()) cand.push([r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w - w, r.y + r.h], [r.x + r.w, r.y + r.h - h], [r.x - w, r.y]);
  for (let i = 0; i < attempts; i++) cand.push([Math.floor(rng() * Math.max(1, W - w + 1)), Math.floor(rng() * Math.max(1, H - h + 1))]);
  const seen = new Set(), list = cand.filter(([x, y]) => x >= 0 && y >= 0 && x <= W - w && y <= H - h && !seen.has(x + ',' + y) && seen.add(x + ',' + y));
  list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  let tried = 0, trace = [], last = null;
  for (const [x, y] of list) {
    tried++;
    if (!atlas.canPlace(x, y, w, h, { trace: true })) { trace = atlas.lastTrace; last = { x, y, w, h }; continue; }
    const slot = atlas.allocateAt(x, y, w, h, { trace: true });
    trace = atlas.lastTrace;
    return { slot, tried, trace, arm: armFromTrace(trace, { x, y, w, h }), x, y };
  }
  return { slot: null, tried, trace, arm: armFromTrace(trace, last) };
}

/** 3D 展开图投影：点 (x, y 板面, z 高度) → 画布 [u, v]。yaw/pitch 弧度；cx/cy 是板子中心。 */
export function project3D(x, y, z, { yaw = 0, pitch = 0, cx = 0, cy = 0, scale = 1, ox = 0, oy = 0 } = {}) {
  const dx = x - cx, dy = y - cy, c = Math.cos(yaw), s = Math.sin(yaw);
  const rx = dx * c - dy * s, ry = dx * s + dy * c;     // 绕竖轴转
  // 画布 y 向下：板面 y 越大越靠上（乘 sin pitch，透视缩短），高度 z 越大越靠上（乘 cos pitch）。pitch=π/2 正俯视，0 侧视
  const u = rx, v = -(ry * Math.sin(pitch) + z * Math.cos(pitch));
  return [ox + u * scale, oy + v * scale];
}

/**
 * 跑一段确定性的增删序列（页面与测试共用）：先加满，再按 removeEvery 删。每步记录 fingers 与碎片度。
 * sizes：随机 16 的倍数（1–6 格）。返回 {log, live}；log 项 {op, ok, fingers, freeLeaves, fill}。
 */
export function runPackSequence(atlas, { steps = 120, seed = 7, removeAfter = 1e9, removeEvery = 3, unit = 16, maxUnits = 6 } = {}) {
  const rng = lcg(seed), live = [], log = [];
  for (let k = 0; k < steps; k++) {
    if (k >= removeAfter && live.length && k % removeEvery === 0) {
      const i = Math.floor(rng() * live.length); atlas.free(live[i]); live.splice(i, 1);
      const r = atlas.report(); log.push({ op: 'remove', ok: true, fingers: 0, freeLeaves: r.freeLeaves, fill: r.fill }); continue;
    }
    const w = unit * (1 + Math.floor(rng() * rng() * maxUnits)), h = unit * (1 + Math.floor(rng() * rng() * maxUnits));
    const res = placeBottomLeft(atlas, w, h, { rng, attempts: 16 });
    if (res.slot) live.push(res.slot);
    const r = atlas.report(); log.push({ op: 'add', ok: !!res.slot, w, h, fingers: res.arm.fingers, pruned: res.arm.pruned, tried: res.tried, freeLeaves: r.freeLeaves, fill: r.fill, trace: res.trace });
  }
  return { log, live };
}
