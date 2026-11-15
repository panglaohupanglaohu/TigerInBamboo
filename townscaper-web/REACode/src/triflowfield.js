/**
 * triflowfield.js — 三角网格上的流场（流场 = 每格一条指向下一格的向量）
 *
 * 帖子 ID：972829402873716737（fx / nav）
 * 原文引文：
 *   "If you're heading to GDC, come see my microtalk about the triangular flow
 *    fields we use for pathfinding and combat"
 *
 * 画面依据（tmp/cap/972829402873716737/f02.png、f05.png）：等距小岛上，青色那簇线与粉色那簇线
 * 各自从一堆单位出发、**平滑弯曲**地流向自己的旗子，分支很多，没有一条是沿方格轴向走的直角折线。
 * 这正是"流场画在三角网格上"的可见后果：方格流场的方向只能取 8 个轴向，三角网格里
 * 由"从共享边中点走出当前三角形"给出连续方向。
 *
 * 为什么这么做（而不是照抄某个实现）：原文只有一句话，没有公式。所以这里只钉两件能测的事：
 *   1) 场本身：以目标三角形为源做 Dijkstra，每个三角形记"该从哪条边出去"，
 *      方向 = 指向那条边中点的单位向量（这就是 combat 里每帧取一次、所有单位共享的那张表）。
 *   2) 与方格版的差别：同一片陆地、同一个目标，方格 8 邻接梯度下降 vs 三角网格中点穿越，
 *      量路径长度/拐弯次数/方向分辨率。方向分辨率是三角网格真正的收益。
 *
 * 与 townscaper 原版的差别（如实标注）：没有做"父指针继承 + 局部重算"那套增量更新，
 * 每帧整场重算（本实验网格小，Dijkstra 一次 <10ms）；三角形是"方格按 (i+j)%2 翻对角线"
 * 得到的直角三角形网格，不是正三角网格 —— 正三角网格只改邻接关系，不改下面的结论。
 */

export const CFG = {
  C: 26,            // 列（格）
  R: 20,            // 行
  CELL: 34,         // 世界尺寸/格
  WATER: -0.15,     // 陆地阈值（归一化高度）
  SLOW: 2.2,        // 坡度惩罚系数（越大越不愿爬坡）
  JIT: 0.24,        // 顶点抖动量（格宽的比例）——真实网格不是正格
};

// ---------- 地形 ----------
function hash(i, j, s = 0) {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function heightAt(i, j) {
  const x = i / CFG.C, y = j / CFG.R;
  let h = 0.62 * Math.sin(x * 4.1 + 0.7) * Math.cos(y * 3.4 - 0.4)
        + 0.26 * Math.sin(x * 7.9 - 1.1) * Math.sin(y * 6.2 + 0.9)
        + 0.12 * Math.cos(x * 13.3 + y * 11.7);
  // 径向收边：靠边落水，做成一座岛
  const dx = x - 0.5, dy = y - 0.5;
  const rr = Math.sqrt(dx * dx * 1.06 + dy * dy * 1.32) * 2;
  h -= 0.55 * Math.pow(Math.max(0, rr - 0.42), 1.6) * 2.2;
  return h;
}

// ---------- 三角网格 ----------
export function buildMesh() {
  const { C, R } = CFG;
  const V = [];                       // 顶点：{i,j,x,y,h,id}
  const vid = (i, j) => i * (R + 1) + j;
  for (let i = 0; i <= C; i++) {
    for (let j = 0; j <= R; j++) {
      // 顶点抖动：真实网格不是正格；抖动只挪位置，不改拓扑，所以邻接/边表都不用改
      const jx = (hash(i, j, 11) - 0.5) * 2 * CFG.JIT * CFG.CELL;
      const jy = (hash(i, j, 23) - 0.5) * 2 * CFG.JIT * CFG.CELL;
      V.push({ id: vid(i, j), i, j, x: i * CFG.CELL + jx, y: j * CFG.CELL + jy, h: heightAt(i, j) });
    }
  }
  const tris = [];
  const cellLand = (i, j) => heightAt(i, j) > CFG.WATER;
  for (let i = 0; i < C; i++) {
    for (let j = 0; j < R; j++) {
      // 四个角都要在陆地，整块格子才进网格（边缘三角形交给邻格补）
      if (!(cellLand(i, j) && cellLand(i + 1, j) && cellLand(i + 1, j + 1) && cellLand(i, j + 1))) continue;
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      if ((i + j) % 2 === 0) {
        tris.push({ v: [a, b, c] });
        tris.push({ v: [a, c, d] });
      } else {
        tris.push({ v: [a, b, d] });
        tris.push({ v: [b, c, d] });
      }
    }
  }
  // 去重（两格共用的三角形不会重复出现，这里只按顶点组合保险去一次）
  const seen = new Set();
  const T = [];
  for (const t of tris) {
    const k = [...t.v].sort((p, q) => p - q).join('_');
    if (seen.has(k)) continue;
    seen.add(k);
    T.push({ id: T.length, v: t.v });
  }
  // 边表
  const edges = new Map();            // key -> {a,b,tris:[]}
  const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  for (const t of T) {
    t.centroid = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3];
      const kk = key(a, b);
      let e = edges.get(kk);
      if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), tris: [] }; edges.set(kk, e); }
      e.tris.push(t.id);
      t.centroid[0] += V[a].x / 3; t.centroid[1] += V[a].y / 3; t.centroid[2] += V[a].h / 3;
      t.e = t.e || [];
      t.e.push(kk);
    }
    t.h = t.centroid[2];
  }
  for (const e of edges.values()) {
    e.mid = [(V[e.a].x + V[e.b].x) / 2, (V[e.a].y + V[e.b].y) / 2, (V[e.a].h + V[e.b].h) / 2];
    e.len = Math.hypot(V[e.a].x - V[e.b].x, V[e.a].y - V[e.b].y);
  }
  // 顶点价数
  const deg = new Map();
  for (const e of edges.values()) {
    deg.set(e.a, (deg.get(e.a) || 0) + 1);
    deg.set(e.b, (deg.get(e.b) || 0) + 1);
  }
  return { V, T, edges, deg };
}

// ---------- 流场：Dijkstra，每格记"从哪条边出去" ----------
export function buildField(M, goalTri) {
  const { T, edges } = M;
  const dist = new Float64Array(T.length).fill(Infinity);
  const exitEdge = new Array(T.length).fill(null);   // 该三角形要穿过的那条边
  const exitTo = new Int32Array(T.length).fill(-1);  // 穿过那条边到达的三角形
  dist[goalTri] = 0;
  const pq = [[0, goalTri]];
  const push = (d, i) => {
    pq.push([d, i]);
    let k = pq.length - 1;
    while (k > 1 && pq[k >> 1][0] > pq[k][0]) { const t = pq[k]; pq[k] = pq[k >> 1]; pq[k >> 1] = t; k >>= 1; }
  };
  const pop = () => {
    const top = pq[1], last = pq.pop();
    if (pq.length > 1) {
      pq[1] = last;
      let k = 1;
      for (;;) {
        let s = k, l = k * 2, r = l + 1;
        if (l < pq.length && pq[l][0] < pq[s][0]) s = l;
        if (r < pq.length && pq[r][0] < pq[s][0]) s = r;
        if (s === k) break;
        const t = pq[k]; pq[k] = pq[s]; pq[s] = t; k = s;
      }
    }
    return top;
  };
  pq.unshift(null); // 1-based
  const final = new Uint8Array(T.length);
  while (pq.length > 1) {
    const [d, t] = pop();
    if (final[t]) continue;
    final[t] = 1;
    for (const kk of T[t].e) {
      const e = edges.get(kk);
      if (e.tris.length !== 2) continue;
      const nb = e.tris[0] === t ? e.tris[1] : e.tris[0];
      if (final[nb]) continue;
      // 穿过这条边的代价：两个格心到边中点的距离 / 速度（坡度越陡越慢）
      const dh = Math.abs(T[nb].h - T[t].h);
      const step = Math.hypot(T[nb].centroid[0] - T[t].centroid[0], T[nb].centroid[1] - T[t].centroid[1]);
      const speed = 1 / (1 + CFG.SLOW * dh);
      const nd = d + step / speed + 0.001;
      if (nd < dist[nb]) {
        dist[nb] = nd;
        exitEdge[nb] = kk;      // 从 nb 出去要穿过这条边
        exitTo[nb] = t;
        push(nd, nb);
      }
    }
  }
  // 每个三角形的方向 = 指向"出口边中点"的单位向量
  const dir = new Float32Array(T.length * 2);
  let reached = 0;
  for (let i = 0; i < T.length; i++) {
    if (dist[i] === Infinity) continue;
    reached++;
    if (i === goalTri || !exitEdge[i]) { dir[i * 2] = dir[i * 2 + 1] = 0; continue; }
    const m = edges.get(exitEdge[i]).mid;
    let dx = m[0] - T[i].centroid[0], dy = m[1] - T[i].centroid[1];
    const L = Math.hypot(dx, dy) || 1;
    dir[i * 2] = dx / L; dir[i * 2 + 1] = dy / L;
  }
  return { dist, exitEdge, exitTo, dir, reached, goalTri };
}

export function triAt(M, x, y) {
  // 点在不在这块三角形里（用三顶点重心坐标）
  const { V, T } = M;
  for (const t of T) {
    const [a, b, c] = t.v.map((k) => V[k]);
    const s = (p, q, r) => (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y);
    const d1 = s({ x, y }, a, b), d2 = s({ x, y }, b, c), d3 = s({ x, y }, c, a);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return t.id;
  }
  return -1;
}

// ---------- 路径：从起点格心出发，逐边穿到中点，直到目标 ----------
export function tracePath(M, F, startTri) {
  const pts = [];
  let t = startTri, guard = 0;
  pts.push([M.T[t].centroid[0], M.T[t].centroid[1]]);
  while (t !== F.goalTri && guard++ < 4000) {
    const kk = F.exitEdge[t];
    if (!kk) break;
    const e = M.edges.get(kk);
    pts.push([e.mid[0], e.mid[1]]);
    t = F.exitTo[t];
    if (t < 0) break;
  }
  pts.push([M.T[F.goalTri].centroid[0], M.T[F.goalTri].centroid[1]]);
  return pts;
}

// ---------- 漏斗（string pulling）：把逐边中点的锯齿路径拉成绷紧的绳子 ----------
// 逐边中点路径的代价就是"每穿一条边就拐一次"，实测比直线长 23.6%、拐 21 次；原片里那簇线是光滑的，
// 因为实现会把"穿哪条边"（portal）当约束、在里面求最短绳。这里补的就是这一步。
export function portals(M, F, startTri) {
  const P = [];
  let t = startTri, guard = 0;
  P.push([M.T[t].centroid, M.T[t].centroid]);
  while (t !== F.goalTri && guard++ < 4000) {
    const kk = F.exitEdge[t];
    if (!kk) break;
    const e = M.edges.get(kk);
    const A = [M.V[e.a].x, M.V[e.a].y], B = [M.V[e.b].x, M.V[e.b].y];
    // 行进方向的左手/右手：用"从当前格心指向下一格心"的叉积定序
    const nx = F.exitTo[t];
    const c0 = M.T[t].centroid, c1 = M.T[nx].centroid;
    const cr = (B[0] - A[0]) * (c1[1] - c0[1]) - (B[1] - A[1]) * (c1[0] - c0[0]);
    P.push(cr > 0 ? [A, B] : [B, A]);
    t = nx;
    if (t < 0) break;
  }
  const g = M.T[F.goalTri].centroid;
  P.push([[g[0], g[1]], [g[0], g[1]]]);
  return P;
}

export function funnel(P) {
  const A = 0, B = 1;
  // 注意手性：Mononen 版 triarea2(a,b,c) = (c−a) × (b−a)，与 (b−a)×(c−a) 差一个负号，
  // 下面四个判据的方向全由这个符号定 —— 写成反的会把每个 portal 都当成转角输出，
  // 实测路径长度直接翻到 2.19×（锯齿版才 1.24×），一眼就能看出来。
  const tri = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const out = [];
  let apex = P[0][0], left = P[0][0], right = P[0][0];
  let apexI = 0, leftI = 0, rightI = 0;
  out.push([apex[0], apex[1]]);
  for (let i = 1; i < P.length; i++) {
    const L = P[i][A], R = P[i][B];
    // 收右边界
    if (tri(apex, right, R) <= 0) {
      if (eq(apex, right) || tri(apex, left, R) > 0) { right = R; rightI = i; }
      else {
        out.push([left[0], left[1]]); apex = left; apexI = leftI;
        left = apex; right = apex; leftI = apexI; rightI = apexI;
        i = apexI; continue;
      }
    }
    // 收左边界
    if (tri(apex, left, L) >= 0) {
      if (eq(apex, left) || tri(apex, right, L) < 0) { left = L; leftI = i; }
      else {
        out.push([right[0], right[1]]); apex = right; apexI = rightI;
        left = apex; right = apex; leftI = apexI; rightI = apexI;
        i = apexI; continue;
      }
    }
  }
  out.push([P[P.length - 1][A][0], P[P.length - 1][A][1]]);
  return out;
}


// ---------- 对照：方格梯度下降（4 邻接=经典方格流场，8 邻接=已经给方格加了斜向） ----------
export function squareField(goalCell, diag = true) {
  const { C, R } = CFG;
  const N = C * R;
  const land = new Uint8Array(N);
  for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
    land[i * R + j] = (heightAt(i, j) > CFG.WATER && heightAt(i + 1, j) > CFG.WATER &&
      heightAt(i + 1, j + 1) > CFG.WATER && heightAt(i, j + 1) > CFG.WATER) ? 1 : 0;
  }
  const dist = new Float64Array(N).fill(Infinity);
  const NB = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
                  : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dist[goalCell] = 0;
  const q = [[0, goalCell]];
  const done = new Uint8Array(N);
  for (;;) {
    let best = -1, bd = Infinity;
    for (let k = 0; k < q.length; k++) if (!done[q[k][1]] && q[k][0] < bd) { bd = q[k][0]; best = k; }
    if (best < 0) break;
    const [, c] = q[best]; q.splice(best, 1);
    done[c] = 1;
    const ci = Math.floor(c / R), cj = c % R;
    for (const [di, dj] of NB) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= C || nj >= R) continue;
      const n = ni * R + nj;
      if (!land[n] || done[n]) continue;
      const dh = Math.abs(heightAt(ni + 0.5, nj + 0.5) - heightAt(ci + 0.5, cj + 0.5));
      const nd = bd + Math.hypot(di, dj) * (1 + CFG.SLOW * dh);
      if (nd < dist[n]) { dist[n] = nd; q.push([nd, n]); }
    }
  }
  return { land, dist, goalCell, N, diag, NB };
}

export function traceSquarePath(S, startCell) {
  const { R } = CFG;
  const pts = [];
  let c = startCell, guard = 0;
  while (c !== S.goalCell && guard++ < 4000) {
    const ci = Math.floor(c / R), cj = c % R;
    pts.push([(ci + 0.5) * CFG.CELL, (cj + 0.5) * CFG.CELL]);
    let bn = -1, bd = S.dist[c];
    for (const [di, dj] of S.NB) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= CFG.C || nj >= CFG.R) continue;
      const n = ni * R + nj;
      if (S.dist[n] < bd) { bd = S.dist[n]; bn = n; }
    }
    if (bn < 0) break;
    c = bn;
  }
  pts.push([(Math.floor(S.goalCell / R) + 0.5) * CFG.CELL, (S.goalCell % R + 0.5) * CFG.CELL]);
  return pts;
}

// ---------- 流线（贴着场从任意点走到目标，就是原片那一簇弯线） ----------
export function streamlines(M, F, count = 90, seed = 3) {
  const out = [];
  const T = M.T;
  for (let s = 0; s < count && out.length < count; s++) {
    const idx = Math.floor(hash(s, 17, seed) * T.length);
    if (F.dist[idx] === Infinity) continue;
    const line = [[T[idx].centroid[0], T[idx].centroid[1]]];
    let t = idx, guard = 0;
    while (t !== F.goalTri && guard++ < 600) {
      const kk = F.exitEdge[t];
      if (!kk) break;
      const e = M.edges.get(kk);
      line.push([e.mid[0], e.mid[1]]);
      t = F.exitTo[t];
      if (t < 0) break;
    }
    if (line.length > 3) out.push(line);
  }
  return out;
}

// ---------- 量：路径长度 / 拐弯 / 方向分辨率 ----------
const PL = (pts) => {
  let L = 0;
  for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  return L;
};
const BENDS = (pts, th = 5) => {
  let n = 0;
  for (let k = 2; k < pts.length; k++) {
    const a = Math.atan2(pts[k - 1][1] - pts[k - 2][1], pts[k - 1][0] - pts[k - 2][0]);
    const b = Math.atan2(pts[k][1] - pts[k - 1][1], pts[k][0] - pts[k - 1][0]);
    let d = Math.abs(((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d * 180 / Math.PI > th) n++;
  }
  return n;
};
const STRAIGHT = (pts) => Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);

export function measure() {
  const M = buildMesh();
  // 目标：岛中心偏右（原片里旗子在右下那块台地上），起点：左上台地
  const goalTri = triAt(M, CFG.CELL * CFG.C * 0.63, CFG.CELL * CFG.R * 0.58);
  const startTri = triAt(M, CFG.CELL * CFG.C * 0.30, CFG.CELL * CFG.R * 0.42);
  const F = buildField(M, goalTri);
  const pts = tracePath(M, F, startTri);
  const L = PL(pts), S = STRAIGHT(pts);
  const sm = funnel(portals(M, F, startTri));
  const smL = PL(sm);

  // 方向分辨率：场上所有非零方向的"不同角度"个数（0.5° 桶）
  const angs = new Set();
  let nz = 0;
  for (let i = 0; i < M.T.length; i++) {
    const dx = F.dir[i * 2], dy = F.dir[i * 2 + 1];
    if (!dx && !dy) continue;
    nz++;
    angs.add(Math.round(Math.atan2(dy, dx) * 180 / Math.PI * 2) / 2);
  }

  // 方格对照（8 邻接 = 已经给方格补了斜向；4 邻接 = 经典方格流场）
  const gc = Math.floor(CFG.C * 0.63) * CFG.R + Math.floor(CFG.R * 0.58);
  const sc = Math.floor(CFG.C * 0.30) * CFG.R + Math.floor(CFG.R * 0.42);
  const SQ = squareField(gc, true);
  const sqPts = traceSquarePath(SQ, sc);
  const sqL = PL(sqPts), sqS = STRAIGHT(sqPts);
  const SQ4 = squareField(gc, false);
  const sq4Pts = traceSquarePath(SQ4, sc);
  const sq4L = PL(sq4Pts);
  const sqAng = new Set();
  for (let n = 0; n < SQ.N; n++) {
    if (SQ.dist[n] === Infinity) continue;
    const ci = Math.floor(n / CFG.R), cj = n % CFG.R;
    let bn = -1, bd = SQ.dist[n];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= CFG.C || nj >= CFG.R) continue;
      const m = ni * CFG.R + nj;
      if (SQ.dist[m] < bd) { bd = SQ.dist[m]; bn = m; }
    }
    if (bn < 0) continue;
    const d = Math.atan2((bn % CFG.R) - cj, Math.floor(bn / CFG.R) - ci);
    sqAng.add(Math.round(d * 180 / Math.PI * 2) / 2);
  }

  // 网格自检
  let boundaryEdges = 0, shared = 0;
  for (const e of M.edges.values()) { if (e.tris.length === 1) boundaryEdges++; else if (e.tris.length === 2) shared++; }
  let d6 = 0, dOther = 0;
  for (const [, d] of M.deg) { if (d === 6) d6++; else dOther++; }
  const triLand = M.T.length;
  const sqLand = SQ.land.reduce((a, b) => a + b, 0);

  // 方向误差：每格"场给的方向"与"格心直指目标"的夹角。方格只能取 8 个轴向，
  // 所以误差被锁在 0~22.5°；三角网格的出口边中点连续可动，误差小一个量级。
  const g = M.T[goalTri].centroid;
  let eTriSum = 0, eTriN = 0;
  for (let i = 0; i < M.T.length; i++) {
    const dx = F.dir[i * 2], dy = F.dir[i * 2 + 1];
    if (!dx && !dy) continue;
    const tx = g[0] - M.T[i].centroid[0], ty = g[1] - M.T[i].centroid[1];
    const c = (dx * tx + dy * ty) / (Math.hypot(dx, dy) * Math.hypot(tx, ty) || 1);
    eTriSum += Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; eTriN++;
  }
  let eSqSum = 0, eSqN = 0;
  const gx = (Math.floor(CFG.C * 0.63) + 0.5) * CFG.CELL, gy = (Math.floor(CFG.R * 0.58) + 0.5) * CFG.CELL;
  for (let n = 0; n < SQ.N; n++) {
    if (SQ.dist[n] === Infinity) continue;
    const ci = Math.floor(n / CFG.R), cj = n % CFG.R;
    let bn = -1, bd = SQ.dist[n];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= CFG.C || nj >= CFG.R) continue;
      const m2 = ni * CFG.R + nj;
      if (SQ.dist[m2] < bd) { bd = SQ.dist[m2]; bn = m2; }
    }
    if (bn < 0) continue;
    const cx = (ci + 0.5) * CFG.CELL, cy = (cj + 0.5) * CFG.CELL;
    const dx = (Math.floor(bn / CFG.R) + 0.5) * CFG.CELL - cx, dy = (bn % CFG.R + 0.5) * CFG.CELL - cy;
    const tx = gx - cx, ty = gy - cy;
    const c = (dx * tx + dy * ty) / (Math.hypot(dx, dy) * Math.hypot(tx, ty) || 1);
    eSqSum += Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; eSqN++;
  }

  return {
    eTri: eTriSum / Math.max(1, eTriN), eSq: eSqSum / Math.max(1, eSqN),
    tri: triLand, vert: M.V.length, edge: M.edges.size, boundaryEdges, shared, d6, dOther,
    reached: F.reached, unreachable: triLand - F.reached,
    dirs: angs.size, nz, sqDirs: sqAng.size,
    pathLen: L, straight: S, ratio: L / S, bends: BENDS(pts), steps: pts.length - 2,
    smLen: smL, smRatio: smL / S, smBends: BENDS(sm), smSteps: sm.length - 1,
    sqLen: sqL, sqStraight: sqS, sqRatio: sqL / sqS, sqBends: BENDS(sqPts), sqLand,
    sq4Len: sq4L, sq4Ratio: sq4L / sqS, sq4Bends: BENDS(sq4Pts),
    startTri, goalTri, gc, sc,
  };
}

export { PL, BENDS, STRAIGHT, hash };
