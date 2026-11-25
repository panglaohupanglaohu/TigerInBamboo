/**
 * R25 山形 → 玩家地面（纯数据：Node / Worker / 游戏共用）。
 * 从山形计划（plan.h + 顶点抖动 plan.jx / plan.jz）建一张与实景 low poly 网格「逐三角一致」的地面高度查询：
 *   heightAt(x, z) → y（离海面高度，米）；x, z 是贴球图表的舞台坐标（米，原点在场景中心，x = i·step − half）。
 *   没有地形（海 / 网格外 / 角点缺高度的格）返回 null，交回给原来的地面链。
 * 三角剖分与 world/rea/mountainCandidate.js buildMesh、mountain/capabilities.js mountainLowpoly 完全相同：
 *   (i + j) 奇 → [a,d,b] [b,d,e]；偶 → [a,d,e] [a,e,b]（a = j·n+i，b = a+1，d = a+n，e = d+1）。
 * 抖动最多 0.45 格，所以一个点可能落在相邻格的三角里：查询时看所在格和周围 8 格。
 */
export const GROUND_VERSION = 1;
export function cellTris(n, i, j, parity = 0) { const a = j * n + i, b = a + 1, d = a + n, e = d + 1; return (i + j + parity) & 1 ? [[a, d, b], [b, d, e]] : [[a, d, e], [a, e, b]]; }
const fin = (v) => v != null && Number.isFinite(v);

/** @param plan { n, step, h[], jx?[], jz?[] }  @param opts { half?, flip? }（flip 只给测试用：故意把对角线反过来，模拟「碰撞与画面不一致」的坏地面） */
export function createHeightfieldGround(plan, { half, flip = false } = {}) {
  const n = plan?.n, step = plan?.step, h = plan?.h;
  if (!(n > 1) || !(step > 0) || !Array.isArray(h) && !ArrayBuffer.isView(h) || h.length !== n * n) throw new TypeError('山形计划缺少 n / step / h');
  const H = half ?? (n - 1) * step / 2, jx = plan.jx, jz = plan.jz;
  const vx = (q) => (q % n) * step - H + (jx?.[q] || 0), vz = (q) => ((q / n) | 0) * step - H + (jz?.[q] || 0);
  const tris = (i, j) => cellTris(n, i, j, flip ? 1 : 0);
  let queries = 0, hits = 0;
  function heightAt(x, z) {
    queries++;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const fi = (x + H) / step, fj = (z + H) / step, i0 = Math.floor(fi), j0 = Math.floor(fj);
    for (let dj = 0; dj <= 2; dj++) for (let di = 0; di <= 2; di++) {
      // 先看自己所在的格（di = dj = 0 → 偏移 0），再看周围
      const i = i0 + [0, -1, 1][di], j = j0 + [0, -1, 1][dj];
      if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) continue;
      const a = j * n + i; if (!fin(h[a]) || !fin(h[a + 1]) || !fin(h[a + n]) || !fin(h[a + n + 1])) continue;
      for (const [p, q, r] of tris(i, j)) {
        const ax = vx(p), az = vz(p), bx = vx(q), bz = vz(q), cx = vx(r), cz = vz(r);
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
        hits++; return l1 * h[p] + l2 * h[q] + l3 * h[r];
      }
    }
    return null;
  }
  /** 网格节点 q 在舞台上的（抖动后）位置 */
  const nodeXZ = (q) => [vx(q), vz(q)];
  return { version: GROUND_VERSION, n, step, half: H, heightAt, nodeXZ, stats: () => ({ queries, hits }) };
}

/**
 * 地面审计（独立重算，不信任任何缓存）：
 *   ① 每个完整格的每个三角，重心处 heightAt 必须等于三个顶点高度的平均（碰撞与画面同一张面）；
 *   ② 完整格重心查不到地面 = 洞（玩家会掉下去）；
 *   ③ 轨道格 / 保护区节点处的地面高度必须等于原高 h0（轨道净空、建筑高差复检）；
 *   ④ 可走坡：自由陆地三角里坡度 ≤ maxSlope 的占比，以及其中最大连通片的占比（玩家能不能在山上走开）。
 * keep：保护区掩码（与 verify 同一个 protectMask 结果），可省略（省略时只做 ①②）。
 */
export function auditGround(field, plan, { ground, keep = null, maxSlope = 45 } = {}) {
  const n = plan.n, step = plan.step, h = plan.h, h0 = field.h, cls = field.cls, g = ground || createHeightfieldGround(plan);
  let tris = 0, maxErr = 0, holes = 0, railCells = 0, railDiff = 0, keepDiff = 0, keepCells = 0;
  const T = (n - 1) * (n - 1) * 2, walk = new Uint8Array(T), freeTri = new Uint8Array(T); let free = 0, walkable = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i; if (!fin(h[a]) || !fin(h[a + 1]) || !fin(h[a + n]) || !fin(h[a + n + 1])) continue;
    cellTris(n, i, j).forEach((tri, k) => {
      const t = (j * (n - 1) + i) * 2 + k, P = tri.map((q) => [...g.nodeXZ(q), h[q]]);
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cz = (P[0][1] + P[1][1] + P[2][1]) / 3, want = (P[0][2] + P[1][2] + P[2][2]) / 3, got = g.heightAt(cx, cz);
      tris++; if (got == null) holes++; else maxErr = Math.max(maxErr, Math.abs(got - want));
      const isFree = tri.every((q) => h0[q] != null && h0[q] > 0.3 && cls[q] === 0 && (!keep || !keep[q]));
      if (isFree) {
        freeTri[t] = 1; free++;
        const ux = P[1][0] - P[0][0], uy = P[1][2] - P[0][2], uz = P[1][1] - P[0][1], wx = P[2][0] - P[0][0], wy = P[2][2] - P[0][2], wz = P[2][1] - P[0][1];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, s = Math.acos(Math.min(1, Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1))) * 180 / Math.PI;
        if (s <= maxSlope) { walk[t] = 1; walkable++; }
      }
    });
  }
  for (let q = 0; q < n * n; q++) {
    if (!fin(h[q]) || !fin(h0[q])) continue;
    const isRail = cls[q] === 2, isKeep = keep ? keep[q] && h0[q] > 0.3 : cls[q] === 1; if (!isRail && !isKeep) continue;
    const [x, z] = g.nodeXZ(q), y = g.heightAt(x, z); if (y == null) continue;
    if (isRail) { railCells++; railDiff = Math.max(railDiff, Math.abs(y - h0[q])); } else { keepCells++; keepDiff = Math.max(keepDiff, Math.abs(y - h0[q])); }
  }
  // 可走三角的最大连通片（三角邻接：同格两三角 + 四邻格）
  let biggest = 0; const seen = new Uint8Array(T), stack = [];
  for (let t0 = 0; t0 < T; t0++) {
    if (!walk[t0] || seen[t0]) continue; let size = 0; seen[t0] = 1; stack.push(t0);
    while (stack.length) { const t = stack.pop(); size++; const c = t >> 1, i = c % (n - 1), j = (c / (n - 1)) | 0;
      for (const nb of [t ^ 1, ...[[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < n - 1 && y < n - 1).flatMap(([x, y]) => [(y * (n - 1) + x) * 2, (y * (n - 1) + x) * 2 + 1])])
        if (walk[nb] && !seen[nb]) { seen[nb] = 1; stack.push(nb); } }
    biggest = Math.max(biggest, size);
  }
  return { tris, maxErr, holes, railCells, railDiff, keepCells, keepDiff, freeTris: free, walkShare: free ? walkable / free : 0, walkConnected: free ? biggest / free : 0, maxSlope };
}
