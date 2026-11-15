/**
 * uv-charts.js — 三角网 → UV 图块 → 径向大小排序的无重叠排布。
 *
 * 1478114309263839244 "I quite like how the radial (instead of directional) size-sorting looks.
 *   Gonna make for some visually pleasing textures with that big coherent chunk in the middle."
 *   画面（346 帧复核）：上方是不规则三角网图块的展平图，最大一块在正中，小块环绕；
 *   下方同一座岛形模型贴着棋盘格。由棋盘模型推断它是 UV 组织 —— 分片 / 参数化 / 装箱的
 *   具体算法原片未给出，这里是本地实现，不冒充原作：
 *     1. 分片：沿共享边洪泛，法线与种子法线夹角 ≤ maxAngle 才并入；投影后翻面的三角另起一片。
 *     2. 参数化：每片沿平均法线做正交投影（等距，棋盘格不拉伸只在斜面压缩 ≤ 1/cos(maxAngle)）。
 *     3. 径向排布：按面积从大到小；最大一片放中心，其余按"离中心的距离"从近到远试候选位置
 *        （螺旋环 × 4 个 90° 旋转），用栅格占用 + 精确三角形相交检查保证不重叠、留 gap。
 * 纯数据，不 import three；输入是三角形汤（MeshWriter.pos 那种）或带索引的网格。
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

/** 三角形汤 → 焊接后的 {positions:[[x,y,z]], triangles:[[i,j,k]]}（按坐标量化合并，丢掉零面积三角）。 */
export function weldSoup(pos, { quantum = 1e-5 } = {}) {
  if (!pos || pos.length % 9 !== 0) throw new RangeError('triangle soup length must be a multiple of 9');
  const positions = [], key = new Map(), triangles = [];
  const id = (x, y, z) => {
    if (![x, y, z].every(Number.isFinite)) throw new RangeError('finite positions required');
    const k = Math.round(x / quantum) + ',' + Math.round(y / quantum) + ',' + Math.round(z / quantum);
    let i = key.get(k); if (i === undefined) { i = positions.length; positions.push([x, y, z]); key.set(k, i); } return i;
  };
  for (let t = 0; t < pos.length; t += 9) {
    const tri = [id(pos[t], pos[t + 1], pos[t + 2]), id(pos[t + 3], pos[t + 4], pos[t + 5]), id(pos[t + 6], pos[t + 7], pos[t + 8])];
    if (new Set(tri).size < 3) continue;
    const n = cross(sub(positions[tri[1]], positions[tri[0]]), sub(positions[tri[2]], positions[tri[0]]));
    if (Math.hypot(...n) < 1e-12) continue;
    triangles.push(tri);
  }
  return { positions, triangles };
}

/** 分片 + 正交投影参数化。返回 charts: [{triangles:[triId], normal, uv: Map(triId → [[u,v]×3]), area}]。 */
export function buildCharts({ positions, triangles }, { maxAngle = 40 } = {}) {
  if (!Array.isArray(positions) || !Array.isArray(triangles)) throw new TypeError('mesh required');
  if (!(maxAngle > 0 && maxAngle < 90)) throw new RangeError('maxAngle must be in (0, 90)');
  const cosMax = Math.cos(maxAngle * Math.PI / 180), T = triangles.length;
  const normals = triangles.map(([a, b, c]) => norm(cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]))));
  const areas = triangles.map(([a, b, c]) => Math.hypot(...cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]))) / 2);
  const edgeTris = new Map();
  triangles.forEach((t, i) => { for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3], e = a < b ? a + ':' + b : b + ':' + a; if (!edgeTris.has(e)) edgeTris.set(e, []); edgeTris.get(e).push(i); } });
  const owner = new Int32Array(T).fill(-1), charts = [];
  const basis = (n) => { const h = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0], u = norm(cross(h, n)); return [u, cross(n, u)]; };
  const project = (tri, [u, v]) => tri.map((i) => [dot(positions[i], u), dot(positions[i], v)]);
  const signed = (p) => (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
  // 大三角先当种子：大片先成形，碎片留到最后（也是"中间一大块"的来源）。
  const order = [...triangles.keys()].sort((a, b) => areas[b] - areas[a] || a - b);
  for (const seed of order) {
    if (owner[seed] >= 0) continue;
    const id = charts.length, n0 = normals[seed], B = basis(n0), members = [seed], uv = new Map([[seed, project(triangles[seed], B)]]);
    owner[seed] = id;
    for (let q = 0; q < members.length; q++) {
      const t = triangles[members[q]];
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], e = a < b ? a + ':' + b : b + ':' + a;
        for (const o of edgeTris.get(e)) {
          if (owner[o] >= 0 || dot(normals[o], n0) < cosMax) continue;
          const p = project(triangles[o], B); if (signed(p) <= 1e-14) continue; // 投影翻面/退化：留给别的片
          owner[o] = id; members.push(o); uv.set(o, p);
        }
      }
    }
    charts.push({ id, triangles: members, normal: n0, uv, area: members.reduce((s, i) => s + areas[i], 0) });
  }
  // 片内投影仍可能自交（凹形曲面绕回来）：精确检查，自交的片拆成单三角片。
  const out = [];
  for (const c of charts) {
    if (chartSelfOverlaps(c)) for (const t of c.triangles) out.push({ id: 0, triangles: [t], normal: normals[t], uv: new Map([[t, c.uv.get(t)]]), area: areas[t] });
    else out.push(c);
  }
  out.forEach((c, i) => { c.id = i; });
  return { charts: out, owner: out.reduce((m, c) => { for (const t of c.triangles) m[t] = c.id; return m; }, new Int32Array(T)), maxAngle };
}

function triOverlap(A, B, eps = 1e-9) {
  // 2D SAT on two triangles; touching (≤ eps) is not overlap.
  for (const P of [A, B]) for (let i = 0; i < 3; i++) {
    const p = P[i], q = P[(i + 1) % 3], nx = -(q[1] - p[1]), ny = q[0] - p[0], l = Math.hypot(nx, ny);
    if (!l) continue;
    const pa = A.map((v) => (v[0] * nx + v[1] * ny) / l), pb = B.map((v) => (v[0] * nx + v[1] * ny) / l);
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= eps) return false;
  }
  return true;
}
function chartSelfOverlaps(c) {
  const tris = c.triangles.map((t) => c.uv.get(t));
  if (tris.length < 2 || tris.length > 4000) return false;
  const box = tris.map((t) => [Math.min(...t.map((p) => p[0])), Math.min(...t.map((p) => p[1])), Math.max(...t.map((p) => p[0])), Math.max(...t.map((p) => p[1]))]);
  for (let i = 0; i < tris.length; i++) for (let j = 0; j < i; j++) {
    if (box[i][2] <= box[j][0] || box[j][2] <= box[i][0] || box[i][3] <= box[j][1] || box[j][3] <= box[i][1]) continue;
    if (triOverlap(tris[i], tris[j])) return true;
  }
  return false;
}

/**
 * 径向大小排序排布。charts 来自 buildCharts（会被读不会被改）。
 * cell：占用栅格边长（世界单位）；gap：图块之间至少空几格。
 * 返回 placements: [{chart, rotation(0..3), offset:[x,y], center:[x,y], distance}]、
 * uv(triId) → 归一化到 [0,1]² 的三个 UV、以及 bounds/fill 统计。
 */
export function radialChartPack(charts, { cell = 0.25, gap = 1, maxRings = 400, footprint: fpMode = 'bbox' } = {}) {
  if (fpMode !== 'bbox' && fpMode !== 'raster') throw new RangeError("footprint must be 'bbox' or 'raster'");
  if (!Array.isArray(charts) || !charts.length) throw new RangeError('charts required');
  if (!(cell > 0) || !Number.isInteger(gap) || gap < 0 || !Number.isInteger(maxRings) || maxRings < 1) throw new RangeError('invalid pack options');
  const rot = (p, r) => r === 0 ? p : r === 1 ? [-p[1], p[0]] : r === 2 ? [-p[0], -p[1]] : [p[1], -p[0]];
  const occupied = new Set(), placedTris = [], B = 1 << 20, key = (x, y) => (x + B) * 2 * B + (y + B);
  // Conservative footprint: grid cells of every triangle's bounding box, dilated by gap, computed once
  // per rotation in a snapped local frame; candidates shift it by whole cells.
  // r55 'raster': a cell is occupied only if a triangle actually touches it (triangle/box SAT), then
  // dilated by gap — instead of each triangle's whole bounding box. Same no-overlap guarantee
  // (conservative cover), far less wasted space between slanted chart edges → higher fill.
  const triTouchesCell = (t, x, y) => {
    const bx0 = x * cell, by0 = y * cell, bx1 = bx0 + cell, by1 = by0 + cell, eps = 1e-12;
    if (Math.max(...t.map((p) => p[0])) < bx0 - eps || Math.min(...t.map((p) => p[0])) > bx1 + eps || Math.max(...t.map((p) => p[1])) < by0 - eps || Math.min(...t.map((p) => p[1])) > by1 + eps) return false;
    const box = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
    for (let i = 0; i < 3; i++) {
      const p = t[i], q = t[(i + 1) % 3], nx = -(q[1] - p[1]), ny = q[0] - p[0];
      const pt = t.map((v) => v[0] * nx + v[1] * ny), pb = box.map((v) => v[0] * nx + v[1] * ny);
      if (Math.max(...pb) < Math.min(...pt) - eps || Math.min(...pb) > Math.max(...pt) + eps) return false;
    }
    return true;
  };
  const footprint = fpMode === 'raster' ? (tris) => {
    const core = new Map(), cells = new Map();
    for (const t of tris) {
      const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
      for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) if (triTouchesCell(t, x, y)) core.set(key(x, y), [x, y]);
    }
    for (const [x, y] of core.values()) for (let dx = -gap; dx <= gap; dx++) for (let dy = -gap; dy <= gap; dy++) cells.set(key(x + dx, y + dy), [x + dx, y + dy]);
    return [...cells.values()];
  } : (tris) => {
    const cells = new Map();
    for (const t of tris) {
      const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
      const x0 = Math.floor(Math.min(...xs) / cell) - gap, x1 = Math.floor(Math.max(...xs) / cell) + gap;
      const y0 = Math.floor(Math.min(...ys) / cell) - gap, y1 = Math.floor(Math.max(...ys) / cell) + gap;
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.set(key(x, y), [x, y]);
    }
    return [...cells.values()];
  };
  const order = [...charts].sort((a, b) => b.area - a.area || a.id - b.id), placements = [];
  const ringCache = [];
  const ringCands = (ring) => {
    if (ringCache[ring]) return ringCache[ring];
    const cands = [];
    if (ring === 0) cands.push([0, 0]); else for (let i = -ring; i <= ring; i++) { cands.push([i, -ring], [i, ring]); if (i > -ring && i < ring) cands.push([-ring, i], [ring, i]); }
    cands.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    return (ringCache[ring] = cands);
  };
  const offsets = [...ringCands(0)]; let offRing = 0, scanStart = 0;
  for (const c of order) {
    const base = c.triangles.map((t) => c.uv.get(t)), options = [];
    for (let r = 0; r < 4; r++) {
      const tris = base.map((t) => t.map((p) => rot(p, r)));
      const pts = tris.flat();
      let cx = Math.round(pts.reduce((s, p) => s + p[0], 0) / pts.length / cell) * cell, cy = Math.round(pts.reduce((s, p) => s + p[1], 0) / pts.length / cell) * cell;
      if (fpMode === 'raster') {
        // Anchor the local frame on the touched cell nearest the centroid, so local cell (0,0) is
        // always part of the footprint: an occupied offset cell then rules the offset out for every
        // chart, which lets the scan below skip the solid core once instead of per chart.
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        let bestD = Infinity, ax = 0, ay = 0;
        for (const t of tris) { const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]); for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) { const d = Math.hypot((x + .5) * cell - mx, (y + .5) * cell - my); if (d < bestD && triTouchesCell(t, x, y)) { bestD = d; ax = x; ay = y; } } }
        cx = ax * cell; cy = ay * cell;
      }
      const local = tris.map((t) => t.map((p) => [p[0] - cx, p[1] - cy]));
      options.push({ r, local, cells: footprint(local) });
    }
    // Rings first, rotations second: the nearest free spot wins whichever 90° turn it needs.
    let best = null;
    if (fpMode === 'raster') {
      for (let i = scanStart; !best; i++) {
        while (i >= offsets.length) { if (++offRing > maxRings) break; offsets.push(...ringCands(offRing)); }
        if (i >= offsets.length) break;
        const [gx, gy] = offsets[i];
        if (occupied.has(key(gx, gy))) { if (i === scanStart) scanStart++; continue; }
        for (const o of options) { let free = true; for (const [x, y] of o.cells) if (occupied.has(key(x + gx, y + gy))) { free = false; break; } if (free) { best = { o, gx, gy }; break; } }
      }
    } else for (let ring = 0; ring <= maxRings && !best; ring++) for (const [gx, gy] of ringCands(ring)) {
      for (const o of options) { let free = true; for (const [x, y] of o.cells) if (occupied.has(key(x + gx, y + gy))) { free = false; break; } if (free) { best = { o, gx, gy }; break; } }
      if (best) break;
    }
    if (!best) throw new RangeError('radial pack ran out of rings');
    const { o, gx, gy } = best, ox = gx * cell, oy = gy * cell;
    for (const [x, y] of o.cells) occupied.add(key(x + gx, y + gy));
    const moved = o.local.map((t) => t.map((p) => [p[0] + ox, p[1] + oy]));
    for (const t of moved) placedTris.push({ chart: c.id, t });
    placements.push({ chart: c.id, area: c.area, rotation: o.r, offset: [ox, oy], distance: Math.hypot(ox, oy), tris: moved, triIds: c.triangles });
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, used = 0;
  for (const { t } of placedTris) { for (const p of t) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); } used += Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])) / 2; }
  const side = Math.max(maxX - minX, maxY - minY) || 1, uvOf = new Map();
  for (const p of placements) p.triIds.forEach((id, i) => uvOf.set(id, p.tris[i].map(([x, y]) => [(x - minX) / side, (y - minY) / side])));
  return {
    placements: placements.map(({ tris, triIds, ...rest }) => rest),
    uv: (triId) => uvOf.get(triId),
    bounds: { minX, minY, maxX, maxY, side }, fill: used / (side * side), texelScale: 1 / side,
    _placedTris: placedTris,
  };
}

/** 精确复核：不同图块的三角形在 UV 上两两不重叠（包围盒剪枝 + SAT）。返回重叠对数。 */
export function countChartOverlaps(pack) {
  const T = pack._placedTris, box = T.map(({ t }) => [Math.min(...t.map((p) => p[0])), Math.min(...t.map((p) => p[1])), Math.max(...t.map((p) => p[0])), Math.max(...t.map((p) => p[1]))]);
  const idx = [...T.keys()].sort((a, b) => box[a][0] - box[b][0]);
  let overlaps = 0;
  for (let ii = 0; ii < idx.length; ii++) {
    const i = idx[ii];
    for (let jj = ii + 1; jj < idx.length; jj++) {
      const j = idx[jj]; if (box[j][0] >= box[i][2]) break;
      if (T[i].chart === T[j].chart || box[i][3] <= box[j][1] || box[j][3] <= box[i][1]) continue;
      if (triOverlap(T[i].t, T[j].t)) overlaps++;
    }
  }
  return overlaps;
}
