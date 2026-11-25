/**
 * planet-wfc-c06.js — 第 56 批 C06：球面三角格上的「内容无关」逐块 WFC 拼装。
 *
 * 依据（2016-10-08 三条）：
 *   784847588893814785 "Content-agnostic algorithm for placing tiles. Heavily based on the work of @ExUtumno.
 *                       Basically a Sudoku-solver on steroids."   画面：大平板 + 一片格内细分的碎块堆
 *   784847933686575104 "Currently built for triangular tiles, but would work for squares or voxels too"
 *                       画面：浅灰板面 + 沟槽 + 圆顶，沿前沿一块块铺满球
 *   784848286272327680 "You can fill it with anything"   画面：蓝白蠕虫管，单粒起点 → 前沿外扩铺满，表面有褐绿斑块
 *
 * 机制：球面三角网（buildSphere）的每个三角形 = 一格（3 条边）；瓷砖只是「三条边的插槽标签」，
 * 求解交给共享 core/wfc.js solveWFC（加权熵 + 传播 + 回溯），求解器完全不看内容。
 * 内容（管子 / 板 / 碎块 / 沟槽 / 圆顶）由瓷砖集各自的 build() 在本格三角里生成，按格的局部重心坐标映射到球面。
 * 生长顺序取求解器真实的落定顺序（explain 记录里 decision / left===1 的先后），起点格用 pins 钉住，可指定任意一格。
 * 两级尺度：plates 瓷砖集的碎块区把本格再细分成 s² 个小三角，每个小三角各自随机高度（格内细分）。
 * 生物群系斑块：biome(dir) 低频场给内容换色；plates 用 allowed 把碎块瓷砖限制在一片区域（交给求解器约束）。
 */
import { solveWFC } from '../core/wfc.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const hash01 = (a, b = 0, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** 低频球面场（0..1），给生物群系斑块 / 碎块区用；确定性。 */
export function biomeField([x, y, z], seed = 5) {
  const s = seed * 1.7;
  const v = Math.sin(x * 2.3 + s) * Math.cos(y * 1.9 - s * .6) + Math.sin(z * 2.7 + y * 1.1 + s * .3) * .8 + Math.sin((x - z) * 3.9 + s * 1.3) * .35;
  return Math.min(1, Math.max(0, .5 + v / 4.3));
}

/** 球面三角网 → WFC 用的格（n=3、edgeNeighbors、edgeTwins）。边 k = (tri[k], tri[k+1])。 */
export function sphereTriGrid(sphere) {
  const { pts, tris } = sphere;
  const owner = new Map();
  tris.forEach((t, ti) => { for (let k = 0; k < 3; k++) owner.set(t[k] + ',' + t[(k + 1) % 3], [ti, k]); });
  const cells = tris.map((t, ti) => {
    const edgeNeighbors = [], edgeTwins = [];
    for (let k = 0; k < 3; k++) {
      const o = owner.get(t[(k + 1) % 3] + ',' + t[k]);
      if (!o) throw new Error('sphere triangulation is not closed');
      edgeNeighbors.push(o[0]); edgeTwins.push(o[1]);
    }
    const c = norm(add(add(pts[t[0]], pts[t[1]]), pts[t[2]]));
    return { id: ti, n: 3, edgeNeighbors, edgeTwins, center: c, corners: t.map((i) => pts[i]) };
  });
  return { cells, pts, tris };
}

/* ---------------------------- 瓷砖集（内容无关：求解器只看 edges） ---------------------------- */
const rotations = (s) => [s, s.slice(1) + s[0], s.slice(2) + s.slice(0, 2)];
function tilesFrom(patterns) {
  const out = [], seen = new Set();
  for (const p of patterns) for (const r of rotations(p.key)) {
    const id = (p.variant ? p.variant + ':' : '') + r;
    if (seen.has(id)) continue; seen.add(id);
    out.push({ id, edges: r.split(''), weight: p.weight, variant: p.variant || null });
  }
  return out;
}

export const TILESETS = {
  /** 784848286272327680：管子（1 = 管从这条边穿过）。 */
  tubes: {
    name: '管子', labels: ['0', '1'], bg: '#5a5a32',
    tiles: tilesFrom([{ key: '000', weight: 1.7 }, { key: '100', weight: .3 }, { key: '110', weight: 2.6 }, { key: '111', weight: .45 }]),
  },
  /** 784847588893814785：P 高板 / L 低板 / R 碎块（格内细分）。 */
  plates: {
    name: '板 + 碎块', labels: ['P', 'L', 'R'], bg: '#3b4167',
    tiles: tilesFrom([
      { key: 'PPP', weight: 5 }, { key: 'LLL', weight: 4 }, { key: 'RRR', weight: 5 },
      { key: 'PPL', weight: .5 }, { key: 'PLL', weight: .5 }, { key: 'PPR', weight: .4 }, { key: 'PRR', weight: .4 },
      { key: 'LLR', weight: .4 }, { key: 'LRR', weight: .4 }, { key: 'PLR', weight: .15 }, { key: 'PRL', weight: .15 },
    ]),
  },
  /** 784847933686575104：F 平板 / G 沟槽穿边；平板格另有圆顶变体（同插槽、不同内容）。 */
  tech: {
    name: '板 + 沟槽 + 圆顶', labels: ['F', 'G'], bg: '#5c3460',
    tiles: tilesFrom([{ key: 'FFF', weight: 3 }, { key: 'FFF', variant: 'dome', weight: .5 }, { key: 'GFF', weight: .6 }, { key: 'GGF', weight: 1.1 }, { key: 'GGG', weight: .3 }]),
  },
};

/**
 * 求解：返回 { ok, tiles: Map(cellId → tile), order: [cellId…] (落定先后), root, stats }。
 * root 指定起点格（钉一个非空瓷砖）；allowed 按 biome 限制碎块区（只用于 plates）。
 */
export function solvePlanetTiles(grid, { set = 'tubes', seed = 3, root = 0, biomeSeed = 5, rubbleBand = .5 } = {}) {
  const ts = TILESETS[set];
  if (!ts) throw new RangeError('unknown tileset ' + set);
  if (!Number.isInteger(root) || root < 0 || root >= grid.cells.length) throw new RangeError('invalid root cell');
  const allowed = {};
  if (set === 'plates') {
    // 碎块只出现在一片低频区域里（片中碎块堆集中在同一片），其余格禁止 R 插槽；交给求解器传播。
    const noR = ts.tiles.filter((t) => !t.edges.includes('R')).map((t) => t.id);
    const onlyR = ts.tiles.filter((t) => t.edges.every((e) => e === 'R') || t.edges.includes('R')).map((t) => t.id);
    for (const c of grid.cells) {
      const b = biomeField(c.center, biomeSeed);
      if (b < rubbleBand - .06) allowed[c.id] = noR;
      else if (b > rubbleBand + .1) allowed[c.id] = onlyR;
    }
  }
  const rootTile = { tubes: '110', plates: 'PPP', tech: 'GGF' }[set];
  const pins = { [root]: ts.tiles.find((t) => t.id === rootTile && (!allowed[root] || allowed[root].includes(t.id)))?.id ?? (allowed[root] || ts.tiles.map((t) => t.id))[0] };
  const t0 = Date.now();
  const r = solveWFC(grid, { tiles: ts.tiles, seed, pins, allowed, weighted: true, explain: true, maxSteps: 4e6 });
  const ms = Date.now() - t0;
  const byId = new Map(ts.tiles.map((t) => [String(t.id), t]));
  const tiles = new Map();
  if (r.ok) for (const [id, tid] of Object.entries(r.tiles)) tiles.set(Number(id), byId.get(tid));
  // 落定顺序：钉住的起点 → 求解器记录里每格第一次「定成 1 个」的先后（决策或被传播逼成唯一）
  const order = [root], seen = new Set([root]);
  for (const c of r.causes || []) {
    const done = c.kind === 'decision' || c.kind === 'pin' || c.left === 1;
    if (done && !seen.has(c.cell)) { seen.add(c.cell); order.push(c.cell); }
  }
  const tail = grid.cells.filter((c) => !seen.has(c.id)).length;   // 理论上 0（每格最终都会被记录）
  for (const c of grid.cells) if (!seen.has(c.id)) { seen.add(c.id); order.push(c.id); }
  // 生长连通性：每一格落定时是否已有一个已落定的邻居（前沿生长 = 几乎全部是）
  const placed = new Set(); let attached = 0;
  for (const id of order) { if (placed.size && grid.cells[id].edgeNeighbors.some((n) => placed.has(n))) attached++; placed.add(id); }
  const counts = {};
  for (const t of tiles.values()) counts[t.id] = (counts[t.id] || 0) + 1;
  return { ok: r.ok, reason: r.reason, tiles, order, root, set, stats: { cells: grid.cells.length, decisions: r.decisions, backtracks: r.backtracks, ms, attached, frontierRatio: attached / Math.max(1, order.length - 1), unrecorded: tail, distinctTiles: Object.keys(counts).length, counts } };
}

/** 检查相邻格插槽全部一致（独立于求解器）。 */
export function tileConflicts(grid, tiles) {
  let bad = 0;
  for (const c of grid.cells) {
    const a = tiles.get(c.id);
    for (let k = 0; k < 3; k++) { const b = tiles.get(c.edgeNeighbors[k]); if (!a || !b || a.edges[k] !== b.edges[c.edgeTwins[k]]) bad++; }
  }
  return bad;
}

/* ---------------------------- 内容生成（每格独立，按揭示顺序拼进一个缓冲） ---------------------------- */
const C = {
  tube: [.66, .84, .93], tubeAlt: [.62, .55, .38], tubeMoss: [.47, .55, .33], shellT: [.24, .22, .18],
  plateHi: [.80, .84, .84], plateLo: [.66, .70, .72], rubble: [.42, .44, .48], rubbleHi: [.70, .72, .74], wall: [.36, .38, .44],
  tech: [.84, .82, .84], groove: [.48, .44, .50], dome: [.90, .88, .90], techWall: [.55, .52, .56],
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function emitter() {
  const P = [], N = [], K = [];
  const tri = (a, b, c, col) => {
    let n = cross(sub(b, a), sub(c, a));
    if (dot(n, add(add(a, b), c)) < 0) { const t = b; b = c; c = t; n = mul(n, -1); }   // 球面外向（壳体本身凸）
    n = norm(n);
    for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); K.push(col[0], col[1], col[2]); }
  };
  const triRaw = (a, b, c, col) => { const n = norm(cross(sub(b, a), sub(c, a))); for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); K.push(col[0], col[1], col[2]); } };
  const quadWall = (a0, b0, b1, a1, col) => { triRaw(a0, b0, b1, col); triRaw(a0, b1, a1, col); triRaw(a0, b1, b0, col); triRaw(a0, a1, b1, col); };   // 双面竖墙
  return { P, N, K, tri, triRaw, quadWall, count: () => P.length / 3 };
}

/** 本格重心坐标 → 球面点。 */
const mapper = (cell, R, unit) => (u, v, w, h) => mul(norm(add(add(mul(cell.corners[0], u), mul(cell.corners[1], v)), mul(cell.corners[2], w))), R + h * unit);

/** 把三角细分成 s² 个小三角（重心坐标），返回 [{a,b,c,ctr}] */
function subdivide(s) {
  const out = [], B = (i, j) => [i / s, j / s, (s - i - j) / s];
  for (let i = 0; i < s; i++) for (let j = 0; j < s - i; j++) {
    out.push([B(i, j), B(i + 1, j), B(i, j + 1)]);
    if (i + j < s - 1) out.push([B(i + 1, j), B(i + 1, j + 1), B(i, j + 1)]);
  }
  return out.map((t) => ({ t, ctr: [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3] }));
}
/** 小三角离哪条边最近（边 k = 角 k→角 k+1，其对角是角 k+2：重心坐标第 k+2 个分量越小越靠近边 k）。 */
const nearestEdge = (b) => { let best = 0, bv = Infinity; for (let k = 0; k < 3; k++) { const v = b[(k + 2) % 3]; if (v < bv - 1e-9) { bv = v; best = k; } } return best; };

/** 带高度的细分块：tops + 块间竖墙 + 外沿裙边（前沿断口侧壁）。 */
function prismField(e, cell, P, subs, heightOf, colorOf, wallCol, skirt = 0) {
  const H = subs.map((_, i) => heightOf(i));
  const key = (b) => b.map((x) => Math.round(x * 1e4)).join(',');
  const edgeOwner = new Map();
  subs.forEach((s, i) => {
    const [a, b, c] = s.t;
    e.tri(P(...a, H[i]), P(...b, H[i]), P(...c, H[i]), colorOf(i, H[i]));
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const k1 = key(x) + '|' + key(y), k2 = key(y) + '|' + key(x);
      if (edgeOwner.has(k2)) {
        const j = edgeOwner.get(k2); edgeOwner.delete(k2);
        if (Math.abs(H[i] - H[j]) > 1e-6) { const lo = Math.min(H[i], H[j]), hi = Math.max(H[i], H[j]); e.quadWall(P(...x, lo), P(...y, lo), P(...y, hi), P(...x, hi), wallCol); }
      } else edgeOwner.set(k1, i);
    }
  });
  // 底面（薄壳内壁）：封住块间竖墙，从壳内看是一张平滑内壁（片中镂空处看到的内侧）
  if (skirt > 0) e.tri(P(1, 0, 0, skirt), P(0, 1, 0, skirt), P(0, 0, 1, skirt), wallCol);
  // 剩下没配对的是本格外沿：从块顶落到 skirt 高度（前沿处看得到的断口侧壁，内部被邻格遮住）
  for (const [k, i] of edgeOwner) {
    const [ka, kb] = k.split('|'), x = ka.split(',').map((n) => n / 1e4), y = kb.split(',').map((n) => n / 1e4);
    e.quadWall(P(...x, skirt), P(...y, skirt), P(...y, H[i]), P(...x, H[i]), wallCol);
  }
}

function tubeAlong(e, pts, ups, r, col, ring = 7) {
  const rings = pts.map((p, i) => {
    const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
    const up = norm(sub(ups[i], mul(t, dot(ups[i], t)))), bi = cross(t, up);
    return Array.from({ length: ring }, (_, k) => { const a = (k / ring) * Math.PI * 2; return add(p, add(mul(up, Math.cos(a) * r), mul(bi, Math.sin(a) * r))); });
  });
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < ring; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % ring], c = rings[i + 1][(k + 1) % ring], d = rings[i + 1][k];
    e.triRaw(a, b, c, col); e.triRaw(a, c, d, col);
  }
}
function blob(e, c, up, r, col, seg = 6) {
  const t1 = norm(cross(up, Math.abs(up[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(up, t1);
  const at = (i, j) => { const th = (i / seg) * Math.PI / 2, ph = (j / seg) * Math.PI * 2; return add(c, add(mul(up, Math.sin(th) * r), add(mul(t1, Math.cos(th) * Math.cos(ph) * r), mul(t2, Math.cos(th) * Math.sin(ph) * r)))); };
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { e.triRaw(at(i, j), at(i, j + 1), at(i + 1, j + 1), col); e.triRaw(at(i, j), at(i + 1, j + 1), at(i + 1, j), col); }
}

function buildCell(e, cell, tile, set, { R, unit, biomeSeed }) {
  const P = mapper(cell, R, unit), lab = tile.edges, up = cell.center;
  const mids = [[.5, .5, 0], [0, .5, .5], [.5, 0, .5]];   // 边 k 的中点（重心坐标）
  const ctr = [1 / 3, 1 / 3, 1 / 3];
  const bio = biomeField(cell.center, biomeSeed);
  if (set === 'tubes') {
    const col = bio > .62 ? mix(C.tube, C.tubeAlt, Math.min(1, (bio - .62) * 4)) : bio < .3 ? mix(C.tube, C.tubeMoss, Math.min(1, (.3 - bio) * 4)) : C.tube;
    const on = [0, 1, 2].filter((k) => lab[k] === '1');
    const h = .9, r = .3 * unit * 2.1;
    const path = (a, b) => { const out = []; for (let i = 0; i <= 8; i++) { const s = i / 8, u = (1 - s) * (1 - s), v = 2 * s * (1 - s), w = s * s; out.push([0, 1, 2].map((d) => a[d] * u + ctr[d] * v + b[d] * w)); } return out; };
    const draw = (bs) => tubeAlong(e, bs.map((b) => P(...b, h)), bs.map(() => up), r, col);
    if (on.length === 1) { draw(path(mids[on[0]], ctr).slice(0, 7)); blob(e, P(...ctr.map((x, d) => x * .75 + mids[on[0]][d] * .25), h - .2), up, r * 1.05, col); }
    else if (on.length === 2) draw(path(mids[on[0]], mids[on[1]]));
    else if (on.length === 3) { for (const k of on) draw(path(mids[k], ctr).slice(0, 7)); blob(e, P(...ctr, h - .25), up, r * 1.25, col); }
    return;
  }
  if (set === 'plates') {
    const subs = subdivide(4);
    const hOf = (i) => {
      const l = lab[nearestEdge(subs[i].ctr)];
      if (l === 'P') return 1.6;
      if (l === 'L') return .9;
      return .5 + 1.9 * hash01(cell.id, i, 77);   // 碎块：格内每个小三角独立高度 → 第二级尺度
    };
    prismField(e, cell, P, subs, hOf, (i, h) => { const l = lab[nearestEdge(subs[i].ctr)]; return l === 'R' ? mix(C.rubble, C.rubbleHi, (h - .5) / 1.9) : l === 'P' ? C.plateHi : C.plateLo; }, C.wall, .15);
    return;
  }
  // tech：板面 + 沟槽（连接 G 边中点经格心） + 圆顶变体
  const subs = subdivide(9);
  const g = [0, 1, 2].filter((k) => lab[k] === 'G');
  const segDist = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); return len(sub(p, add(a, mul(ab, t)))); };
  const inGroove = (b) => g.some((k) => segDist(b, mids[k], ctr) < .085);
  prismField(e, cell, P, subs, (i) => inGroove(subs[i].ctr) ? .55 : 1, (i, h) => h < .9 ? C.groove : C.tech, C.techWall, .3);
  if (tile.variant === 'dome') blob(e, P(...ctr, 1), up, unit * 1.1, C.dome, 7);
}

/**
 * 按揭示顺序生成整颗星球的内容几何。返回 { position, normal, color, offsets }：
 * offsets[k] = 前 k 格占用的顶点数 → setDrawRange(0, offsets[k]) 就是「已拼好 k 块」。
 */
export function planetTileGeometry(grid, solved, { R = 4, unit = .16, biomeSeed = 5 } = {}) {
  const e = emitter(), offsets = [0];
  for (const id of solved.order) {
    const t = solved.tiles.get(id);
    if (t) buildCell(e, grid.cells[id], t, solved.set, { R, unit, biomeSeed });
    offsets.push(e.count());
  }
  return { position: e.P, normal: e.N, color: e.K, offsets };
}
