/**
 * campaignmap.js — 战役地图的节点图生成器：撒点 → 裁边 → 随机游走成主线 → 支线 → 补点。
 *
 * 原文 ①（x.com/OskSta/status/1042732450730913793, 2018-09-20）
 *   "The graph generator I ended up using for the Bad North campaign maps:
 *    1. Create nodes of varying sizes and spread them out
 *    2. Cull nodes outside bounds
 *    3. Do a random walk from start to finish
 *    4. Do some more random walks
 *    5. Pick some more random nodes"
 *
 * 原文 ②（x.com/OskSta/status/1078792665980915714, 2018-12-28）
 *   "friday night campaign map node graffing"
 *
 * 画面（抽帧 tmp/cap/1042…/f03.png，420×280 原尺寸）：
 *   · **白色的空心圆环**，直径 8~26px 不等 —— 环就是节点，环径就是节点大小；
 *   · 它们只落在**一条水平带**里（y 占画面 1/3 高），带外左右两端还散着几个
 *     —— 那正是「先到处撒、再按 bounds 裁掉」留下的痕迹；
 *   · 背景 #33353a，上面压着**方格纸网格**（每隔 ~64px 一根，alpha ≈ 0.05）；
 *   · 圆环彼此**不重叠**，间距至少一个环径，说明撒点是带最小间距的（拒绝采样）。
 *  画面（tmp/cap/1078…/f02.png，同尺寸）：
 *   · 同一条带里，圆环被**上了色**：洋红/粉、绿、蓝、紫；连线把它们串成一条
 *     **从左到右的折线链**，链上节点之间是三角化的密集边；
 *   · 左上角还孤着一小簇没连上的环 —— 第 5 步「再随便挑几个节点」的产物；
 *   · 有些段没有连线只留环，说明「节点」和「已进图的节点」是两种状态。
 *
 * 机制要点（不猜，按原文五步各对应一个函数）：
 *   1）scatter()   —— 全画布撒点，环径 jitter，环与环之间留 0.22 倍半径的缝；
 *   2）cull()      —— 用一条波状的带子当 bounds，带外的一律丢掉（但保留记录，能画出来）；
 *   3）walkPath()  —— 从最左节点走到最右节点，每步在 linkDist 内选「离终点最近 + 随机抖动」
 *                    的未访问邻居。**游走 = 保证连通**，这就是 917405214638006273
 *                    说的 navigable 启发式的图论版本：路径不是搜出来的，是长出来的；
 *   4）branches()  —— 从主线上再随机走几条短支线；
 *   5）extras()    —— 剩下没进图的节点里随便挑几个当「可选小岛」。
 *
 * 为什么不用 Delaunay：原文说的是「graph generator」，不是「mesh」。连线只要
 * 「相邻够近」即可，所以用 kNN（每点最多 3 条、长度 < linkDist）就够，而且
 * 这样「某段没连上」也能自然出现，正好对上画面里那些孤环。
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 波状的水平带：campaign 地图就是沿着这条带铺开的。 */
function bandHalfAt(x, bandHalf, seed) {
  return bandHalf * (0.78 + 0.22 * Math.sin(x * 0.007 + seed * 0.7) + 0.08 * Math.sin(x * 0.021 + seed));
}

/**
 * 第 1 步：撒点。全画布随机，拒绝采样保证环与环之间留缝。
 * 环径 4~14（画面上直径 8~28），偏小居多 —— 用 pow(rnd,2) 压出长尾。
 */
export function scatter({ w, h, seed = 7, tries = 1400, gap = 1.22 }) {
  const rnd = mulberry32(seed);
  const nodes = [];
  let attempts = 0;
  for (let i = 0; i < tries; i++) {
    attempts++;
    const r = 4 + Math.pow(rnd(), 2) * 10;
    const x = 26 + r * 0.5 + rnd() * (w - 52 - r);
    const y = 26 + r * 0.5 + rnd() * (h - 52 - r);
    let ok = true;
    for (let k = 0; k < nodes.length; k++) {
      const o = nodes[k];
      const dx = o.x - x, dy = o.y - y;
      if (dx * dx + dy * dy < Math.pow((o.r + r) * gap, 2)) { ok = false; break; }
    }
    if (ok) nodes.push({ x, y, r, id: nodes.length });
  }
  return { nodes, attempts };
}

/** 第 2 步：按 bounds 裁。带外的记进 dropped，画面上仍然可见（淡环）。 */
export function cull(nodes, { h, bandHalf, seed = 7 }) {
  const cy = h * 0.5;
  const kept = [], dropped = [];
  for (const n of nodes) {
    const half = bandHalfAt(n.x, bandHalf, seed);
    if (Math.abs(n.y - cy) < half - n.r * 0.5) kept.push(n);
    else dropped.push(n);
  }
  return { kept, dropped, cy, bandHalfAt: (x) => bandHalfAt(x, bandHalf, seed) };
}

/** 裸 kNN 连边：每点最多 k 条、长度 < linkDist。返回去重后的边表。 */
export function knnEdges(nodes, { k = 3, linkDist = 64 } = {}) {
  const edges = [];
  const seen = new Set();
  const push = (a, b) => {
    const key = a < b ? a + '-' + b : b + '-' + a;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };
  for (let i = 0; i < nodes.length; i++) {
    const cand = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d = Math.hypot(dx, dy);
      if (d < linkDist) cand.push([d, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let t = 0; t < Math.min(k, cand.length); t++) push(i, cand[t][1]);
  }
  return edges;
}

function adjacency(n, edges) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return adj;
}

/**
 * 第 3 步：从最左走到最右。每步在邻接表里挑「离终点最近 + rnd*jitter」的未访问点。
 * 不后退（除非走不动），走不动就记一次 stuck —— 这个数字是诚实的验收指标：
 * 一条能玩的战役图不该 stuck。
 */
export function walkPath(nodes, adj, { seed = 11, jitter = 34 } = {}) {
  const rnd = mulberry32(seed);
  let start = 0, finish = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].x < nodes[start].x) start = i;
    if (nodes[i].x > nodes[finish].x) finish = i;
  }
  const path = [start];
  const used = new Set([start]);
  let cur = start, stuck = 0, guard = 0;
  while (cur !== finish && guard++ < nodes.length * 3) {
    const f = nodes[finish], c = nodes[cur];
    const cand = adj[cur]
      .filter((j) => !used.has(j))
      .map((j) => {
        const dFinish = Math.hypot(nodes[j].x - f.x, nodes[j].y - f.y);
        // 往回走要加价：战役图是「往右推进」的，允许绕但不喜欢倒退
        const back = Math.max(0, c.x - nodes[j].x) * 1.6;
        return [dFinish + back + rnd() * jitter, j];
      })
      .sort((a, b) => a[0] - b[0]);
    let next = cand.length ? cand[0][1] : -1;
    if (next < 0) {
      // 走不动了：允许跳一格（真实地图里这一段就是「需要坐船」的地方）
      stuck++;
      let best = -1, bestD = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        if (used.has(j)) continue;
        const d = Math.hypot(nodes[j].x - c.x, nodes[j].y - c.y);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best < 0) break;
      next = best;
    }
    path.push(next);
    used.add(next);
    cur = next;
  }
  const pts = path.map((i) => nodes[i]);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const straight = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
  return { path, used, stuck, len, straight, detour: straight > 0 ? len / straight : 0, reachedFinish: cur === finish };
}

/** 第 4 步：从主线上的点再随机岔几根短支线。 */
export function branches(nodes, adj, used, { seed = 13, count = 4, steps = 5 } = {}) {
  const rnd = mulberry32(seed);
  const out = [];
  const taken = new Set(used);
  const roots = [...used];
  for (let b = 0; b < count && roots.length; b++) {
    let cur = roots[Math.floor(rnd() * roots.length)];
    const chain = [cur];
    const n = 2 + Math.floor(rnd() * steps);
    for (let s = 0; s < n; s++) {
      const opts = adj[cur].filter((j) => !taken.has(j));
      if (!opts.length) break;
      cur = opts[Math.floor(rnd() * opts.length)];
      taken.add(cur);
      chain.push(cur);
    }
    if (chain.length > 1) out.push(chain);
  }
  return { branches: out, used: taken };
}

/** 第 5 步：从还没进图的节点里随便挑几个当可选小岛。 */
export function extras(nodes, taken, { seed = 17, count = 9 } = {}) {
  const rnd = mulberry32(seed);
  const free = nodes.map((_, i) => i).filter((i) => !taken.has(i));
  const out = [];
  for (let i = 0; i < count && free.length; i++) {
    const k = Math.floor(rnd() * free.length);
    out.push(free.splice(k, 1)[0]);
  }
  return out;
}

export function generate({ w = 1280, h = 800, seed = 7, tries = 1500, bandHalf = 0.17, linkDist = 66, k = 3 } = {}) {
  const s1 = scatter({ w, h, seed, tries });
  const c = cull(s1.nodes, { h, bandHalf, seed });
  // 洗牌让节点 id 与「撒点顺序」脱钩，避免路径偏爱左上角
  const kept = c.kept;
  const edges = knnEdges(kept, { k, linkDist });
  const adj = adjacency(kept.length, edges);
  const walk = walkPath(kept, adj, { seed: seed + 101 });
  const br = branches(kept, adj, walk.used, { seed: seed + 202, count: 4, steps: 5 });
  const ex = extras(kept, br.used, { seed: seed + 303, count: 9 });
  const stats = {
    scattered: s1.nodes.length,
    attempts: s1.attempts,
    dropped: c.dropped.length,
    kept: kept.length,
    edges: edges.length,
    pathNodes: walk.path.length,
    stuck: walk.stuck,
    reachedFinish: walk.reachedFinish,
    pathLen: Math.round(walk.len),
    straight: Math.round(walk.straight),
    detour: +walk.detour.toFixed(2),
    branchNodes: br.branches.reduce((a, b) => a + b.length, 0),
    extras: ex.length,
  };
  return { w, h, kept, dropped: c.dropped, cy: c.cy, bandHalfAt: c.bandHalfAt, edges, adj, walk, branches: br.branches, extras: ex, stats };
}

/* ---------------------------------------------------------------- 绘制 ---- */

const HUE = [322, 148, 208, 268, 96, 42]; // 洋红 / 绿 / 蓝 / 紫 / 黄绿 / 橙

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} st generate() 的结果
 * @param {{step:number, showCulled:boolean, mode:'debug'|'final'}} opt
 *   step 0 撒点 / 1 裁边 / 2 连边 / 3 主线 / 4 支线 / 5 补点（=final）
 */
export function draw(ctx, st, { step = 5, showCulled = true, mode = 'final' } = {}) {
  const { w, h } = st;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = mode === 'debug' ? '#33353a' : '#2b2b33';
  ctx.fillRect(0, 0, w, h);

  // 方格纸背景（画面里每 ~64px 一根）
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 64) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += 64) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();

  // 带子边界（只有前两步才画：它是 bounds 的可视化）
  if (step <= 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = st.cy - st.bandHalfAt(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 8) {
      const y = st.cy + st.bandHalfAt(x);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 被裁掉的点：淡环 + 一道斜杠，证明它们确实是被 bounds 丢掉的
  if (showCulled && step <= 1) {
    ctx.lineWidth = 1;
    for (const n of st.dropped) {
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(n.x - n.r * 0.7, n.y - n.r * 0.7);
      ctx.lineTo(n.x + n.r * 0.7, n.y + n.r * 0.7);
      ctx.stroke();
    }
  }

  const inPath = new Set(st.walk.path);
  const inBranch = new Set(st.branches.flat());
  const inExtra = new Set(st.extras);
  const pathEdge = new Set();
  for (let i = 1; i < st.walk.path.length; i++) {
    const a = st.walk.path[i - 1], b = st.walk.path[i];
    pathEdge.add(a < b ? a + '-' + b : b + '-' + a);
  }

  // 边
  if (step >= 2) {
    for (const [a, b] of st.edges) {
      const A = st.kept[a], B = st.kept[b];
      const onPath = step >= 3 && pathEdge.has(a < b ? a + '-' + b : b + '-' + a);
      ctx.strokeStyle = onPath ? 'rgba(190,255,205,0.9)' : 'rgba(226,232,240,0.26)';
      ctx.lineWidth = onPath ? 1.7 : 1;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    }
  }

  // 节点：环，环径 = 节点大小
  for (let i = 0; i < st.kept.length; i++) {
    const n = st.kept[i];
    const isPath = step >= 3 && inPath.has(i);
    const isBr = step >= 4 && inBranch.has(i) && !isPath;
    const isEx = step >= 5 && inExtra.has(i);
    let color = mode === 'debug' || step < 3 ? 'rgba(240,244,248,0.92)' : 'rgba(228,232,240,0.42)';
    if (isPath) color = mode === 'debug' ? '#eef2f6' : 'hsl(' + HUE[(i * 5 + 1) % HUE.length] + ',78%,74%)';
    else if (isBr) color = 'hsl(' + HUE[(i + 2) % HUE.length] + ',70%,70%)';
    else if (isEx) color = 'rgba(255,220,150,0.6)';
    ctx.strokeStyle = color;
    ctx.lineWidth = isPath ? 1.9 : 1.3;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.stroke();
    if (isPath) { // 小实心点，标出「已进图」
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    if (isEx) { // 可选小岛：环外再套一圈虚线
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(255,220,150,0.35)';
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
