/**
 * tileforce.js — 强制某个"模块"出现：先造出它需要的那一小块网格。
 *
 * 1751932427272909032  "I can now force specific modules to appear. To do this I
 *   first generate the specific bit of grid they need. A large module like this
 *   would be highly unlikely to appear by chance on a random grid."
 *
 * 片子最后 3 帧（3.74s / 3.76s / 3.89s）就是这个操作本身：画面切成纯网格俯视图，
 * 一块由 4 个四边形 + 3 个三角形组成的小 patch 被慢慢点亮 —— 那就是"the specific
 * bit of grid"。前面 20 帧是结果：一块多格房子正好压在那一小块上。
 *
 * 对偶问题（1670794261669769217 "sometimes you build a cool tile and it wont show
 * up in forever, since it's conditions are so specific"）是同一件事的另一面：
 * 条件越具体，随机网格里碰到的概率越低。所以这个文件做两件事：
 *
 *   1. `findPatch()`      —— 在已有网格里找符合模块邻接/形状要求的 patch（够用就直接用）
 *   2. `synthesizePatch()`—— 找不到就"造那小块网格"：按模块的邻接关系在平面上铺出来，
 *                            共享边用同一对顶点对象，所以它是一块闭合的合法网格，不是贴图
 *   3. `auditRarity()`    —— 量"靠运气碰到"的概率随模块格数怎么掉（k=3..8）
 *
 * 模块的形状标签只有一条：每格是几边形（3 = 三角形，4 = 四边形）。这正好是
 * 1751932427272909032 那帧 patch 里出现的两种格子。
 */
import { buildQuadGrid } from './quadgrid.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ekey = (a, b) => (a < b ? a + ':' + b : b + ':' + a);

/**
 * 把 quadgrid 的四边形网格按比例切成"四边形 + 三角形"混合网格，并重建邻接。
 *
 * 诚实说明：这是**近似**。原文的混合网格是 tile set 自带的（1579483114178768898
 * "one of the house tiles even cover both a square tile AND a triangular tile"），
 * 我们这里只是把一部分四边形沿对角线切开，得到"三角形挨着四边形、共用顶点、
 * 没有 T 型接点"的同形拓扑 —— 和 `src/halfedge.js` 的 splitToMixed 同一个思路，
 * 但这里必须同时重建 edgeNeighbors（半边那份是丢弃拓扑的自检用）。
 */
export function buildMixedGrid({ radius = 12, hexSize = 1, seed = 1337, triShare = 0.34 } = {}) {
  const base = buildQuadGrid({ radius, hexSize, seed });
  const rnd = mulberry32(seed * 7919 + 13);
  const cells = [];
  for (const c of base.cells) {
    const p = c.pts;
    if (p.length === 4 && rnd() < triShare) {
      // 随机挑一条对角线；两个三角形按逆时针顺序给出
      if (rnd() < 0.5) {
        cells.push(shape([p[0], p[1], p[2]]), shape([p[0], p[2], p[3]]));
      } else {
        cells.push(shape([p[1], p[2], p[3]]), shape([p[1], p[3], p[0]]));
      }
    } else {
      cells.push(shape(p.slice()));
    }
  }
  return finishGrid(cells, base.verts);
}

function shape(pts) {
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.x;
    cz += p.z;
  }
  return { pts, cx: cx / pts.length, cz: cz / pts.length, nbr: new Array(pts.length).fill(-1) };
}

/** 由"多边形列表 + 共享顶点"重建邻接（按边键配对，只认恰好两面共享的边）。 */
function finishGrid(cells, verts) {
  for (const c of cells) c.id = cells.indexOf(c);
  const edgeMap = new Map();
  for (const c of cells) {
    const n = c.pts.length;
    for (let i = 0; i < n; i++) {
      const k = ekey(c.pts[i].id, c.pts[(i + 1) % n].id);
      const list = edgeMap.get(k);
      if (list) list.push([c.id, i]);
      else edgeMap.set(k, [[c.id, i]]);
    }
  }
  for (const list of edgeMap.values()) {
    if (list.length !== 2) continue;
    const [[a, ia], [b, ib]] = list;
    cells[a].nbr[ia] = b;
    cells[b].nbr[ib] = a;
  }
  const bySides = { 3: 0, 4: 0, other: 0 };
  for (const c of cells) {
    if (c.pts.length === 3) bySides[3]++;
    else if (c.pts.length === 4) bySides[4]++;
    else bySides.other++;
  }
  return {
    cells,
    verts: verts || dedupeVerts(cells),
    count: cells.length,
    sides: bySides,
    edges: edgeMap.size,
  };
}

function dedupeVerts(cells) {
  const m = new Map();
  for (const c of cells) for (const p of c.pts) m.set(p.id, p);
  return [...m.values()];
}

/* ------------------------------------------------------------------ 模块 */

const isAdj = (grid, a, b) => grid.cells[a].nbr.includes(b);

/**
 * 从网格里抠出一个 k 格的连通块当"模块"样本，并把它抽象成
 * `{ n, sides:[...], adj:[[...],...], root }`（只留形状 + 邻接，坐标丢掉）。
 *
 * root 取"边数最多的一格 + 平局取 id 最小"，这样同一形状的规范化结果稳定。
 */
export function clusterModule(grid, startId, k, rnd) {
  const picked = [startId];
  const used = new Set([startId]);
  while (picked.length < k) {
    const frontier = [];
    for (const id of picked) for (const nb of grid.cells[id].nbr) if (nb >= 0 && !used.has(nb)) frontier.push(nb);
    if (!frontier.length) break;
    const next = frontier[Math.floor(rnd() * frontier.length) % frontier.length];
    picked.push(next);
    used.add(next);
  }
  return moduleFromCells(grid, picked);
}

export function moduleFromCells(grid, ids) {
  const n = ids.length;
  const sides = ids.map((id) => grid.cells[id].pts.length);
  const adj = ids.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && isAdj(grid, ids[i], ids[j])) adj[i].push(j);
    }
  }
  return { n, sides, adj, root: pickRoot(sides, adj) };
}

function pickRoot(sides, adj) {
  let best = 0;
  for (let i = 1; i < sides.length; i++) {
    if (adj[i].length > adj[best].length) best = i;
    else if (adj[i].length === adj[best].length && sides[i] > sides[best]) best = i;
  }
  return best;
}

/** 形状签名：只由"边数多重集 + 邻接结构"决定，用于判断两份模块是不是同一种形状。 */
export function moduleSignature(mod) {
  const { n, sides, adj, root } = mod;
  const seen = new Array(n).fill(-1);
  const order = [];
  const q = [root];
  seen[root] = 0;
  while (q.length) {
    const i = q.shift();
    order.push(i);
    for (const j of adj[i]) if (seen[j] < 0) { seen[j] = order.length; q.push(j); }
  }
  const labels = order.map((i) => sides[i]);
  const links = [];
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      if (adj[order[a]].includes(order[b])) links.push(a + '-' + b);
    }
  }
  return labels.join(',') + '|' + links.join(',');
}

/* -------------------------------------------------------------- 找 patch */

/**
 * 诱导子图同构：模块的每一格必须落在一个"边数相同、且邻接关系完全一致"的格子上。
 * 这里坚持**诱导**（模块里不相邻的两格，在网格里也不许相邻），因为多出来的一条相邻边
 * 就意味着一块两格之间的墙，房子会长错。
 */
export function findPatch(grid, mod, { limit = 6, maxTests = 250000 } = {}) {
  const t0 = performance.now();
  const cells = grid.cells;
  const { n, sides, adj, root } = mod;
  // 以 root 为起点做 BFS，保证每次扩展都有一个已映射的邻居
  const order = [];
  const seen = new Array(n).fill(false);
  const q = [root];
  seen[root] = true;
  while (q.length) {
    const i = q.shift();
    order.push(i);
    for (const j of adj[i]) if (!seen[j]) { seen[j] = true; q.push(j); }
  }
  const parentOf = new Array(n).fill(-1);
  for (let t = 1; t < order.length; t++) {
    const i = order[t];
    parentOf[i] = adj[i].find((j) => order.indexOf(j) < t && order.indexOf(j) >= 0);
  }

  const map = new Array(n).fill(-1);
  const used = new Set();
  const matches = [];
  let tests = 0;
  let pruned = 0;
  let hitCap = false;

  const fits = (mi, ci) => {
    if (cells[ci].pts.length !== sides[mi]) return false;
    if (used.has(ci)) return false;
    for (let mj = 0; mj < n; mj++) {
      const gi = map[mj];
      if (gi < 0) continue;
      const want = adj[mi].includes(mj);
      const has = isAdj(grid, ci, gi);
      if (want !== has) return false; // 诱导检查：多一条边也不行
    }
    return true;
  };

  const rec = (t) => {
    if (hitCap) return;
    if (t === order.length) {
      matches.push(map.slice());
      if (matches.length >= limit) hitCap = true;
      return;
    }
    const mi = order[t];
    const pm = parentOf[mi];
    const cands = pm < 0
      ? cells.map((_, i) => i)
      : cells[map[pm]].nbr.filter((x) => x >= 0);
    for (const ci of cands) {
      if (++tests > maxTests) { hitCap = true; return; }
      if (!fits(mi, ci)) { pruned++; continue; }
      map[mi] = ci;
      used.add(ci);
      rec(t + 1);
      used.delete(ci);
      map[mi] = -1;
      if (hitCap) return;
    }
  };
  rec(0);

  return {
    matches,
    tests,
    pruned,
    capped: hitCap,
    ms: performance.now() - t0,
    order,
  };
}

/** 只数出现次数（用来量稀有度），不保存 patch 内容。 */
export function countOccurrences(grid, mod, { cap = 400, maxTests = 400000 } = {}) {
  const r = findPatch(grid, mod, { limit: cap, maxTests });
  return { count: r.matches.length, capped: r.capped, ms: r.ms, tests: r.tests };
}

/* ------------------------------------------------------------ 造那块网格 */

/**
 * "generate the specific bit of grid they need"：
 * 按模块的 BFS 顺序把格子一个个贴在父格的一条空闲边上铺出来。
 *
 * 每格都是"站在共享边 ab 上、边数 = sides[i]"的凸多边形，且 ab 复用的是**同一对顶点对象**
 * —— 所以拼出来的是一块闭合网格（可以直接交给 Town/TownMesh 当岛用），不是一堆重叠面片。
 * 父格选哪条空闲边：取"外侧最空"的那条（离已有格子质心最远），减少兄弟格互相压到的概率。
 */
export function synthesizePatch(mod, { side = 1 } = {}) {
  const t0 = performance.now();
  const { n, sides, adj, root } = mod;
  const order = [];
  const seen = new Array(n).fill(false);
  const q = [root];
  seen[root] = true;
  while (q.length) {
    const i = q.shift();
    order.push(i);
    for (const j of adj[i]) if (!seen[j]) { seen[j] = true; q.push(j); }
  }
  const parentOf = new Array(n).fill(-1);
  for (let t = 1; t < order.length; t++) {
    const i = order[t];
    parentOf[i] = adj[i].find((j) => order.indexOf(j) < t);
  }

  const V = [];
  const mkVert = (x, z) => {
    for (const v of V) if (Math.hypot(v.x - x, v.z - z) < 1e-6 * side) return v;
    const v = { id: V.length, x, z };
    V.push(v);
    return v;
  };
  const poly = (pts) => {
    let cx = 0;
    let cz = 0;
    for (const p of pts) { cx += p.x; cz += p.z; }
    const c = shape(pts);
    c.cx = cx / pts.length;
    c.cz = cz / pts.length;
    return c;
  };

  // root：正 n 边形
  const n0 = sides[root];
  const R = side / (2 * Math.sin(Math.PI / n0));
  const rootPts = [];
  for (let i = 0; i < n0; i++) {
    const a = (i / n0) * Math.PI * 2 - Math.PI / 2;
    rootPts.push(mkVert(Math.cos(a) * R, Math.sin(a) * R));
  }
  const out = new Array(n).fill(null);
  out[root] = poly(rootPts);

  for (let t = 1; t < order.length; t++) {
    const i = order[t];
    const p = out[parentOf[i]];
    const pn = p.pts.length;
    // 选父格的一条还没被占用的边（另一端没有邻居多边形）
    let bestEdge = -1;
    let bestScore = -Infinity;
    for (let e = 0; e < pn; e++) {
      const mid = { x: (p.pts[e].x + p.pts[(e + 1) % pn].x) / 2, z: (p.pts[e].z + p.pts[(e + 1) % pn].z) / 2 };
      let free = true;
      for (const c of out) {
        if (!c || c === p) continue;
        for (let k = 0; k < c.pts.length; k++) {
          const a = c.pts[k];
          const b = c.pts[(k + 1) % c.pts.length];
          if ((a === p.pts[e] && b === p.pts[(e + 1) % pn]) || (b === p.pts[e] && a === p.pts[(e + 1) % pn])) free = false;
        }
      }
      if (!free) continue;
      // 外侧：边中点相对父格质心的方向
      const score = Math.hypot(mid.x - p.cx, mid.z - p.cz);
      if (score > bestScore) { bestScore = score; bestEdge = e; }
    }
    if (bestEdge < 0) bestEdge = t % pn;
    out[i] = standOnEdge(p, bestEdge, sides[i], side, mkVert);
  }

  const cells = out.filter(Boolean);
  const grid = finishGrid(cells, V);
  // 重叠体检：一格质心落进另一格里就算压到了
  let overlaps = 0;
  for (const a of cells) {
    for (const b of cells) {
      if (a === b) continue;
      if (pointInPoly(b.pts, a.cx, a.cz)) overlaps++;
    }
  }
  return {
    grid,
    cells: cells.length,
    verts: V.length,
    overlaps,
    ms: performance.now() - t0,
    order,
  };
}

/** 在父格的边 e 上"立"一个新多边形：共享边复用同一对顶点，其余顶点落在该边的外侧圆弧上。 */
function standOnEdge(parent, e, n, side, mkVert) {
  const pn = parent.pts.length;
  const A = parent.pts[e];
  const B = parent.pts[(e + 1) % pn];
  const L = Math.hypot(B.x - A.x, B.z - A.z) || side;
  if (n === 2) return { pts: [B, A], cx: (A.x + B.x) / 2, cz: (A.z + B.z) / 2 };
  const R = L / (2 * Math.sin(Math.PI / n));
  const d = R * Math.cos(Math.PI / n);
  const mx = (A.x + B.x) / 2;
  const mz = (A.z + B.z) / 2;
  // 外侧法线（远离父格质心）
  let nx = mx - parent.cx;
  let nz = mz - parent.cz;
  const len = Math.hypot(nx, nz) || 1;
  nx /= len;
  nz /= len;
  const ox = mx + nx * d;
  const oz = mz + nz * d;
  const aA = Math.atan2(A.z - oz, A.x - ox);
  const aB = Math.atan2(B.z - oz, B.x - ox);
  // 从 B 沿哪个方向绕到 A：取"第二点离父格更远"的那个方向
  const step = (Math.PI * 2) / n;
  let dir = 1;
  const tryPoint = (sgn) => {
    const a = aB + sgn * step;
    return { x: ox + Math.cos(a) * R, z: oz + Math.sin(a) * R };
  };
  const p1 = tryPoint(1);
  const p2 = tryPoint(-1);
  const dist = (pt) => Math.hypot(pt.x - parent.cx, pt.z - parent.cz);
  if (dist(p2) > dist(p1)) dir = -1;
  const pts = [A, B];
  for (let j = 1; j < n - 1; j++) {
    const a = aB + dir * step * j;
    const x = ox + Math.cos(a) * R;
    const z = oz + Math.sin(a) * R;
    pts.push(mkVert(x, z));
  }
  const c = shape(pts);
  return c;
}

function pointInPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ 体检 */

/**
 * 稀有度曲线：同一个形状，在**另一张**随机网格里能碰到几次。
 *
 * 做法：从网格 A 抠 k 格连通块 → 抽象成形状 → 在网格 B 里数同构出现次数（封顶 400）。
 * 这就是 1751932427272909032 说"a large module would be highly unlikely to appear by
 * chance"的量化版；也是 1670794261669769217 "wont show up in forever" 的成因。
 */
export function auditRarity({ ks = [4, 6, 8, 10, 12], trials = 6, seed = 20261101, radius = 11, cap = 5000 } = {}) {
  const rnd = mulberry32(seed);
  const gridA = buildMixedGrid({ radius, seed: seed + 1 });
  const gridB = buildMixedGrid({ radius, seed: seed + 2 });
  const rows = [];
  for (const k of ks) {
    let found = 0;
    let capped = 0;
    let ms = 0;
    let nonzero = 0;
    let shapes = 0;
    for (let t = 0; t < trials; t++) {
      const start = Math.floor(rnd() * gridA.count);
      const mod = clusterModule(gridA, start, k, rnd);
      if (mod.n < k) continue;
      shapes++;
      const r = countOccurrences(gridB, mod, { cap });
      found += r.count;
      if (r.capped) capped++;
      if (r.count > 0) nonzero++;
      ms += r.ms;
    }
    rows.push({
      k,
      shapes,
      meanHits: shapes ? found / shapes : 0,
      hitShare: shapes ? nonzero / shapes : 0,
      capped,
      msPerMatch: shapes ? ms / shapes : 0,
    });
  }
  // 指定形状：成环 = 每格恰好两个邻居（中间围一个洞）。这是手写模块的常态，
  // 也是"随机网格里几乎不可能自己长出来"的那一类 —— 上表和它一比就看出差别在哪。
  const specified = RINGS.map((ring) => {
    const r = findPatch(gridB, ring.mod, { limit: cap, maxTests: 3000000 });
    return { name: ring.name, n: ring.mod.n, sides: ring.mod.sides, hits: r.matches.length, tests: r.tests, ms: r.ms };
  });
  return { gridA: summarise(gridA), gridB: summarise(gridB), rows, specified };
}

/** 手写的"成环"模块：n 格首尾相接，形状标签按 triPattern 交替。 */
export function ringModule(n, triPattern = 0b101010) {
  const sides = [];
  for (let i = 0; i < n; i++) sides.push((triPattern >> i) & 1 ? 3 : 4);
  const adj = [];
  for (let i = 0; i < n; i++) adj.push([(i + 1) % n, (i + n - 1) % n]);
  return { n, sides, adj, root: 0 };
}

const RINGS = [
  { name: 'ring5', mod: ringModule(5) },
  { name: 'ring6', mod: ringModule(6) },
];

function summarise(g) {
  return { cells: g.count, tris: g.sides[3], quads: g.sides[4], edges: g.edges };
}

/** 页面/自检用的一键体检。 */
export function audit(opts = {}) {
  const grid = buildMixedGrid({ radius: opts.radius || 11, seed: opts.seed || 20261101 });
  const rnd = mulberry32((opts.seed || 20261101) + 99);
  // 一个"大模块"：从网格里抠 7 格
  const mod = clusterModule(grid, Math.floor(rnd() * grid.count), opts.k || 7, rnd);
  const found = findPatch(grid, mod, { limit: 6 });
  const synth = synthesizePatch(mod);
  const rarity = auditRarity(opts);
  return {
    grid: summarise(grid),
    module: { n: mod.n, sides: mod.sides, signature: moduleSignature(mod) },
    found: {
      matches: found.matches.length,
      capped: found.capped,
      tests: found.tests,
      ms: found.ms,
    },
    synth: {
      cells: synth.cells,
      verts: synth.verts,
      overlaps: synth.overlaps,
      ms: synth.ms,
    },
    rarity: rarity.rows,
  };
}
