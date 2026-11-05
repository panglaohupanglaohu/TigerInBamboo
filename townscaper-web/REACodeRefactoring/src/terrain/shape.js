/**
 * shape.js — 地形的"形"：把方方正正的体素轮廓变成自然的崖壁和海岸。
 *
 * 依据（原文）：
 *   1670720537662836736 "I smooth my mesh according to an edge type hierarchy. Black is hard,
 *     red is game-tile-border and blue is material-border. Verts only get to pull at equal or
 *     lower order verts, and only along the appropriate edges"
 *   1670725072540106755 no- / dumb- / hierarchical smoothing：层级平滑"preserve the intent of
 *     the input-tiles while smoothing out the jankyness from the weird underlying grid"
 *     （原片依次切换三种模式；代码切面崖顶/崖脚等级为本地近似，非原作全部mesh边类型）
 *   1579478470098243584 "radical cage deformation on the cells" —— 崖壁收分、扭动，不再是直柱
 *
 * 做法：
 *   一个"切面" s = 高度 s·L 处的水平面。每个网格顶点在每个切面上有自己的 (x, z)。
 *   崖壁第 lv 段从切面 lv-1 连到切面 lv；台地顶在切面 top；所以只要大家都用 at(p, s)，网格就是闭合的。
 *
 *   每个切面上给边和顶点分级（数字大 = 级别高 = 更"硬"）：
 *     3 钉住：六边形外圈、房子占的格（建筑是预制 tile，不许动）、轮廓分叉点
 *     2 崖顶线：R_s 的轮廓（R_s = 第 s 层是实心的格子）
 *     1 崖脚线：R_{s+1} 的轮廓（上一段崖壁的脚）
 *     0 内部
 *   顶点只被"同级或更高级"的邻居拉，而且只沿同级的边拉：
 *     轮廓点只沿轮廓走（圆滑成曲线，但不会被内部点拖走），内部点跟着所有邻居走（吸收位移）。
 *   用 Taubin（λ / μ 交替）代替普通拉普拉斯，海岸不会越平滑越缩。
 *
 *   之后做"笼形变形"：轮廓点沿外法线 ——
 *     高处的崖顶略向内收（崖壁下宽上窄），再加一点随高度缓慢变化的噪声（崖壁扭动）。
 *   位移有上限，并对每切面格子面积/边长/三角扇朝向做回退约束；不保证所有3D侧壁互不相交。
 */

import { fbm } from '../core/noise.js';
import {guardDeformation} from '../core/deformation-guard.js';

const DEFAULTS = {
  passes: 10,        // Taubin 对数
  lambda: 0.55,
  mu: -0.58,
  interior: 0.45,    // 内部点每遍向邻居平均移动的比例
  interiorPasses: 4,
  taper: 0.055,      // 每往上一层，崖顶向内收多少
  taperMax: 0.16,
  wobble: 0.09,      // 笼形变形噪声幅度
  guardCells: true,
  minAreaRatio: .3,
  minEdgeRatio: .35,
  minFanRatio: .2,
  maxShift: 0.24,    // 总位移上限
};

const adjacencyCache = new WeakMap();

/**
 * 网格顶点邻接 + 边编号（按网格缓存）：
 *   nbr[v] = 相邻顶点，eid[v] = 对应的边号，cellEdge[c*4+i] = 格子 c 第 i 条边的边号
 */
function adjacency(grid) {
  let adj = adjacencyCache.get(grid);
  if (adj) return adj;
  const n = grid.verts.length;
  const maps = Array.from({ length: n }, () => new Map());
  // 每格的边在 cellEdge 里的起点（格子可以是三角形或四边形）
  const off = new Int32Array(grid.cells.length + 1);
  for (const c of grid.cells) off[c.id + 1] = off[c.id] + c.n;
  const cellEdge = new Int32Array(off[grid.cells.length]);
  let E = 0;
  for (const c of grid.cells) {
    for (let i = 0; i < c.n; i++) {
      const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id;
      let e = maps[a].get(b);
      if (e === undefined) { e = E++; maps[a].set(b, e); maps[b].set(a, e); }
      cellEdge[off[c.id] + i] = e;
    }
  }
  const BX = new Float32Array(n), BZ = new Float32Array(n);
  for (let v = 0; v < n; v++) { BX[v] = grid.verts[v].x; BZ[v] = grid.verts[v].z; }
  adj = {
    E, cellEdge, off, BX, BZ,
    nbr: maps.map((m) => Int32Array.from(m.keys())),
    eid: maps.map((m) => Int32Array.from(m.values())),
  };
  adjacencyCache.set(grid, adj);
  return adj;
}

/**
 * @param {import('../core/world.js').World} world
 * @returns {{ at(p:{id:number,x:number,z:number}, s:number): number[], slices:number, order(vid:number, s:number):number, ms:number, enabled:boolean }}
 */
const lastResult = new WeakMap();   // world → { key, api }：体素没变就直接复用（例如只刷了颜色）

export function shapeTerrain(world, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const t0 = performance.now();
  const grid = world.grid;
  const verts = grid.verts;
  const n = verts.length;
  const { E, cellEdge, off, nbr, eid, BX, BZ } = adjacency(grid);
  // 1670720537662836736: "Black is hard ... only along the appropriate edges".
  // Explicit hard grid-edge endpoints stay at original coordinates on all slices.
  // This is not a classification of original module/material triangle-mesh edges.
  const hardEdges = opts.hardEdges ?? [];
  if (!Array.isArray(hardEdges)) throw new TypeError('hardEdges must be vertex ID pairs');
  const explicitHard = new Set();
  for (const pair of hardEdges) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(id => Number.isInteger(id) && id >= 0 && id < n) ||
        !nbr[pair[0]].includes(pair[1])) throw new RangeError('hardEdges must reference adjacent vertices');
    explicitHard.add(pair[0]); explicitHard.add(pair[1]);
  }

  // 结果只取决于 solid / rock 两个位图和参数
  let h = 2166136261 >>> 0;
  for (let i = 0; i < world.solid.length; i++) h = Math.imul(h ^ (world.solid[i] * 65536 + world.rock[i]), 16777619) >>> 0;
  const key = h + '|' + JSON.stringify(opts);
  const last = lastResult.get(world);
  if (last && last.key === key) { last.api.ms = +(performance.now() - t0).toFixed(1); return last.api; }

  let maxTop = 0;
  for (const c of grid.cells) maxTop = Math.max(maxTop, world.top(c));
  const S = maxTop + 1;                       // 切面 0..maxTop
  const X = new Float32Array(n * S), Z = new Float32Array(n * S);
  const ORD = new Uint8Array(n * S);
  for (let s = 0; s < S; s++) { X.set(BX, s * n); Z.set(BZ, s * n); }

  const api = {
    slices: S,
    continuous: true,
    explicitHardVertices: [...explicitHard].sort((a,b)=>a-b),
    guard: {slices:[],guardedSlices:0,minBlend:1},
    enabled: opts.enabled !== false,
    // 1579478470098243584: "cage deformation on the cells".
    // Local continuous corner sampler between existing slice handles; this does
    // not interpolate the interior of a twisted wall or provide a collision SDF.
    at(p, s) {
      if (!Number.isFinite(s)) throw new RangeError('Invalid cage slice');
      if (!api.enabled) return [p.x, p.z];
      if (!Number.isInteger(p.id) || p.id < 0 || p.id >= n) throw new RangeError('Invalid cage vertex');
      s = Math.max(0, Math.min(S - 1, s));
      const lo=Math.floor(s), hi=Math.ceil(s), t=s-lo, a=lo*n+p.id, b=hi*n+p.id;
      return [X[a]+(X[b]-X[a])*t, Z[a]+(Z[b]-Z[a])*t];
    },
    // Conservative diagnostic rank over the bracketing planes.
    order(vid, s) {
      if (!Number.isInteger(vid) || vid < 0 || vid >= n || !Number.isFinite(s)) throw new RangeError('Invalid cage order query');
      s=Math.max(0,Math.min(S-1,s));
      return Math.max(ORD[Math.floor(s)*n+vid],ORD[Math.ceil(s)*n+vid]);
    },
    ms: 0,
  };
  if (!api.enabled) { lastResult.set(world, { key, api }); return api; }

  // 钉住：外圈格子、有建筑体素的格子（房子是预制 tile，不许动）
  const pinned = new Uint8Array(n);
  for (const id of explicitHard) pinned[id] = 1;
  for (const c of grid.cells) {
    const built = world.solid[c.id] & ~world.rock[c.id];          // 这一列里有建筑体素
    const rim = c.edgeNeighbors.some((e) => e < 0);                // 六边形外圈
    if (built || rim) for (const p of c.pts) pinned[p.id] = 1;
  }

  const solidAt = (c, lv) => c !== null && (lv <= 0 ? true : world.isSolid(c, lv));
  const edgeOrd = new Uint8Array(E);
  const edgeA = new Int32Array(E), edgeB = new Int32Array(E);
  for (const c of grid.cells) for (let i = 0; i < c.n; i++) {
    const e = cellEdge[off[c.id] + i]; edgeA[e] = c.pts[i].id; edgeB[e] = c.pts[(i + 1) % c.n].id;
  }
  const ord = new Uint8Array(n);
  const mark = new Uint32Array(n);
  let stamp = 0;
  const outX = new Float32Array(n), outZ = new Float32Array(n);

  for (let s = 0; s < S; s++) {
    const base = s * n;
    edgeOrd.fill(0);
    ord.fill(0); outX.fill(0); outZ.fill(0);

    // 1. 边分级 + 轮廓外法线
    for (const c of grid.cells) {
      for (let i = 0; i < c.n; i++) {
        const nid = c.edgeNeighbors[i];
        const nb = nid >= 0 ? grid.cells[nid] : null;
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        let k = 0;
        // 崖顶线：c 在 R_s 里、邻居不在
        if (s >= 1 && solidAt(c, s) && !solidAt(nb, s)) k = 2;
        // 崖脚线：c 在 R_{s+1} 里、邻居不在
        else if (solidAt(c, s + 1) && !solidAt(nb, s + 1)) k = 1;
        if (!k) continue;
        const e = cellEdge[off[c.id] + i];
        if (k > edgeOrd[e]) edgeOrd[e] = k;
        // 外法线（从 c 指向邻居）
        let nx = -(b.z - a.z), nz = b.x - a.x;
        if (nx * ((a.x + b.x) / 2 - c.cx) + nz * ((a.z + b.z) / 2 - c.cz) < 0) { nx = -nx; nz = -nz; }
        const l = Math.hypot(nx, nz) || 1;
        outX[a.id] += nx / l; outZ[a.id] += nz / l; outX[b.id] += nx / l; outZ[b.id] += nz / l;
      }
    }
    // 2. 顶点分级 = 相连边的最高级；同级边超过 2 条 = 分叉点 → 钉住
    const deg = new Uint8Array(n);
    for (let e = 0; e < E; e++) {
      const k = edgeOrd[e];
      if (!k) continue;
      const a = edgeA[e], b = edgeB[e];
      if (k > ord[a]) { ord[a] = k; deg[a] = 1; } else if (k === ord[a]) deg[a]++;
      if (k > ord[b]) { ord[b] = k; deg[b] = 1; } else if (k === ord[b]) deg[b]++;
    }
    const curve = [];
    for (let v = 0; v < n; v++) {
      if (pinned[v] || (ord[v] && deg[v] > 2)) ord[v] = 3;
      ORD[base + v] = ord[v];
      if (ord[v] === 1 || ord[v] === 2) curve.push(v);
    }
    if (!curve.length) continue;   // 这个切面没有轮廓（例如整片都是房子）

    // 3. 轮廓点 Taubin：只沿同级边、只被同级或更高级的邻居拉
    // 每个曲线点沿同级边的两个邻居（只算一次）
    const pair = new Int32Array(curve.length * 2).fill(-1);
    curve.forEach((v, j) => {
      const k = ord[v], nb = nbr[v], ed = eid[v];
      let m = 0;
      for (let q = 0; q < nb.length; q++) {
        if (edgeOrd[ed[q]] !== k || ord[nb[q]] < k) continue;
        if (m < 2) pair[j * 2 + m] = nb[q];
        m++;
      }
      if (m !== 2) pair[j * 2] = -1;      // 只处理简单曲线上的点
    });
    const cx = new Float32Array(curve.length), cz = new Float32Array(curve.length);
    const curveStep = (f) => {
      for (let j = 0; j < curve.length; j++) {
        const v = curve[j], u0 = pair[j * 2], u1 = pair[j * 2 + 1];
        cx[j] = X[base + v]; cz[j] = Z[base + v];
        if (u0 < 0) continue;
        cx[j] += f * ((X[base + u0] + X[base + u1]) * 0.5 - X[base + v]);
        cz[j] += f * ((Z[base + u0] + Z[base + u1]) * 0.5 - Z[base + v]);
      }
      for (let j = 0; j < curve.length; j++) { X[base + curve[j]] = cx[j]; Z[base + curve[j]] = cz[j]; }
    };
    for (let it = 0; it < o.passes; it++) { curveStep(o.lambda); curveStep(o.mu); }

    // 4. 笼形变形：沿轮廓外法线收分 + 噪声
    for (const v of curve) {
      const k = ord[v];
      const l = Math.hypot(outX[v], outZ[v]);
      if (l < 1e-6) continue;
      const nx = outX[v] / l, nz = outZ[v] / l;
      const p = verts[v];
      const taper = k === 2 ? -Math.min(o.taperMax, o.taper * s) : 0;
      const wob = (fbm(p.x * 0.55 + 3.1, p.z * 0.55 + s * 0.35, { octaves: 2, freq: 1.2, seed: 41 }) - 0.5) * 2 * o.wobble;
      X[base + v] += nx * (taper + wob);
      Z[base + v] += nz * (taper + wob);
    }

    // 5. 内部点：被所有邻居拉（吸收轮廓的位移，顺便抹掉网格的别扭）
    //    只处理轮廓附近 3 圈以内的内部点 —— 更远的点位移本来就是 0
    stamp++;
    const active = [];
    let frontier = curve;
    for (let ring = 0; ring < 3; ring++) {
      const next = [];
      for (const v of frontier) for (const u of nbr[v]) {
        if (mark[u] === stamp || ord[u] !== 0) continue;
        mark[u] = stamp; active.push(u); next.push(u);
      }
      frontier = next;
    }
    const ax = new Float32Array(active.length), az = new Float32Array(active.length);
    for (let it = 0; it < o.interiorPasses; it++) {
      for (let j = 0; j < active.length; j++) {
        const v = active[j];
        let sx = 0, sz = 0, m = 0;
        for (const u of nbr[v]) { sx += X[base + u] - BX[u]; sz += Z[base + u] - BZ[u]; m++; }
        // 只传递"位移"，不做纯拉普拉斯（否则内部网格会被抹平变形）
        ax[j] = BX[v] + (X[base + v] - BX[v]) * (1 - o.interior) + (sx / m) * o.interior;
        az[j] = BZ[v] + (Z[base + v] - BZ[v]) * (1 - o.interior) + (sz / m) * o.interior;
      }
      for (let j = 0; j < active.length; j++) { X[base + active[j]] = ax[j]; Z[base + active[j]] = az[j]; }
    }

    // 6. 位移上限（只有轮廓点和它附近的点会动）
    for (const list of [curve, active]) for (const v of list) {
      const dx = X[base + v] - BX[v], dz = Z[base + v] - BZ[v];
      const d = Math.hypot(dx, dz);
      if (d > o.maxShift) { X[base + v] = BX[v] + dx / d * o.maxShift; Z[base + v] = BZ[v] + dz / d * o.maxShift; }
    }
    // A displacement bound alone cannot prevent tiny cells/overhangs collapsing.
    // Backtrack this shared slice, keeping all incident polygons stitched.
    if(o.guardCells){
      const occupied=grid.cells.filter(c=>solidAt(c,s)||solidAt(c,s+1));
      const report=guardDeformation(occupied,BX,BZ,X,Z,base,o);
      api.guard.slices.push({slice:s,...report});
      if(report.blend<1)api.guard.guardedSlices++;
      api.guard.minBlend=Math.min(api.guard.minBlend,report.blend);
    }
  }
  api.ms = +(performance.now() - t0).toFixed(1);
  lastResult.set(world, { key, api });
  return api;
}
