/**
 * field-surface.js — 占位场 → 平滑圆角等值面（surface nets）+ 碎块崩解/重组过渡。
 *
 * 依据：
 *   818857408848130048（302 帧 / 8.68 fps / 34.8s，2018-06，扁灰背景无投影）
 *   832633189277409280（192 帧 / 8-9 fps / 22s，同一工具的第二次录屏，带投影、背景偏青）
 *
 *   两条片子是同一个工具：一座白模黏土岛（悬崖台地 + 白房子 + 白灌木）在 5–8 种形态之间循环，
 *   每次切换时整座岛先**碎成悬浮的小块**（多数帧只剩 1–3 块暗色碎片），再重新拼合成另一种形态。
 *   成品表面是**平滑圆角**的：柱子顶端是半球、崖棱是倒角、房子和地形熔在一起（没有任何方格边），
 *   基座水线外侧挂一圈**白色轮廓带**，水面有倒影。
 *
 *   所以机制拆成三件事，本模块只负责前两件（白轮廓带与水线在页面侧用等值线画）：
 *     1. 占位场：整数格点上的占据密度，ramp 进格 → 1、出格 → 0；
 *     2. 模糊 + 等值面：3D 盒式模糊把占据场揉成圆角，iso=0.5 抽等值面（naive surface nets）→
 *        每格一个顶点（12 条棱的交点平均），每条跨等值面的格棱出一个四边形；
 *        法线取场梯度 → 平滑着色，这就是片子里"熔化的黏土"观感；
 *     3. 过渡：按 2D 区块（chunk）分组，每块有自己的时间窗，窗内先**抬升**再落位，
 *        抬到最高点时换形态（from → to）→ 同时能看到"已落位的新块"和"悬在空中的旧块"。
 *
 * 说明：本仓此前只有 2D marching squares（src/core/contour.js），三维等值面一直缺；这个模块补的就是它。
 */

/** 等值面阈值：占据场在 [0,1]，0.5 是实心/空气的分界 */
export const ISO = 0.5;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

/** 固定种子整数散列 → [0,1)（与 voxel-ghost 同法，保证可复现） */
export function hash01(i, seed = 0) {
  if (!Number.isInteger(i) || !Number.isFinite(seed)) throw new RangeError('Invalid hash input');
  let h = (i | 0) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 新建占据场。dims = [nx, ny, nz]（取样点数，格子数是各减一） */
export function makeField(dims, value = 0) {
  if (!Array.isArray(dims) || dims.length !== 3) throw new RangeError('Invalid field dims');
  const [nx, ny, nz] = dims;
  for (const n of dims) if (!Number.isInteger(n) || n < 2) throw new RangeError('Invalid field dims');
  if (!Number.isFinite(value)) throw new RangeError('Invalid field value');
  return { nx, ny, nz, data: new Float32Array(nx * ny * nz).fill(value) };
}

export const fieldIndex = (f, i, j, k) => (k * f.ny + j) * f.nx + i;

export function fieldAt(f, i, j, k) {
  const x = Math.min(f.nx - 1, Math.max(0, i | 0));
  const y = Math.min(f.ny - 1, Math.max(0, j | 0));
  const z = Math.min(f.nz - 1, Math.max(0, k | 0));
  return f.data[fieldIndex(f, x, y, z)];
}

/** 三线性取样（顶点处用，坐标是格点浮点坐标） */
export function sampleField(f, x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = x - x0, ty = y - y0, tz = z - z0;
  const g = (i, j, k) => fieldAt(f, i, j, k);
  const c00 = g(x0, y0, z0) * (1 - tx) + g(x0 + 1, y0, z0) * tx;
  const c10 = g(x0, y0 + 1, z0) * (1 - tx) + g(x0 + 1, y0 + 1, z0) * tx;
  const c01 = g(x0, y0, z0 + 1) * (1 - tx) + g(x0 + 1, y0, z0 + 1) * tx;
  const c11 = g(x0, y0 + 1, z0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1, z0 + 1) * tx;
  const c0 = c00 * (1 - ty) + c10 * ty, c1 = c01 * (1 - ty) + c11 * ty;
  return c0 * (1 - tz) + c1 * tz;
}

/**
 * 盒子集合 → 占据场（并集）。boxes: [{x,y,z,w,h,d}]，整数、格坐标。
 * lift：整体抬升的格数（过渡中"悬空块"用）。
 */
export function rasterizeBoxes(field, boxes, { lift = 0 } = {}) {
  if (!Array.isArray(boxes)) throw new RangeError('Invalid boxes');
  if (!Number.isFinite(lift)) throw new RangeError('Invalid lift');
  const lz = Math.round(lift);
  let written = 0;
  for (const b of boxes) {
    const x = b.x ?? 0, y = b.y ?? 0, z = b.z ?? 0;
    const { w, h, d } = b;
    for (const v of [x, y, z, w, h, d]) if (!Number.isInteger(v)) throw new RangeError('Invalid box extent');
    if (w < 1 || h < 1 || d < 1) throw new RangeError('Invalid box size');
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) {
      // 格 (x,y,z) 的占据写在取样点 (x+1, y+1, z+1)：四周留一圈 0，等值面才不会贴着边界被切掉
      const si = x + i + 1, sj = y + j + lz + 1, sk = z + k + 1;
      if (si < 0 || sj < 0 || sk < 0 || si > field.nx - 1 || sj > field.ny - 1 || sk > field.nz - 1) continue;
      const at = fieldIndex(field, si, sj, sk);
      if (field.data[at] !== 1) { field.data[at] = 1; written++; }
    }
  }
  return written;
}

/** 分离式 3D 盒式模糊（滑窗，边界外按最近点钳住）。radius 步 + passes 次 ≈ 高斯 → 棱角变圆，正是片子里的"黏土" */
export function blurField(field, { passes = 2, radius = 1 } = {}) {
  if (!Number.isInteger(passes) || passes < 0) throw new RangeError('Invalid blur passes');
  if (!Number.isInteger(radius) || radius < 1) throw new RangeError('Invalid blur radius');
  const { nx, ny, nz } = field;
  let src = field.data;
  let dst = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    // x
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      const base = (k * ny + j) * nx;
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        for (let o = -radius; o <= radius; o++) {
          const ii = i + o < 0 ? 0 : i + o > nx - 1 ? nx - 1 : i + o;
          sum += src[base + ii];
        }
        dst[base + i] = sum / (2 * radius + 1);
      }
    }
    const t1 = src; src = dst; dst = t1;
    // y
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        for (let o = -radius; o <= radius; o++) {
          const jj = j + o < 0 ? 0 : j + o > ny - 1 ? ny - 1 : j + o;
          sum += src[(k * ny + jj) * nx + i];
        }
        dst[(k * ny + j) * nx + i] = sum / (2 * radius + 1);
      }
    }
    const t2 = src; src = dst; dst = t2;
    // z
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        for (let o = -radius; o <= radius; o++) {
          const kk = k + o < 0 ? 0 : k + o > nz - 1 ? nz - 1 : k + o;
          sum += src[(kk * ny + j) * nx + i];
        }
        dst[(k * ny + j) * nx + i] = sum / (2 * radius + 1);
      }
    }
    const t3 = src; src = dst; dst = t3;
  }
  field.data = src;
  return field;
}

/**
 * 按 2D 区块分组（x/z 每 chunk 格一块，y 全高），每块给一个时间窗。
 * 返回 [{key, delay, dur, from:[boxes], to:[boxes]}]，delay 在 [0, gap) 内由定种子散列决定，
 * 这样同一帧里有的块还在旧形态（悬空），有的已经落位成新形态 —— 片子里"碎块乱飞"的观感。
 */
export function chunkPlan(fromBoxes, toBoxes, { chunk = 4, seed = 3, dur = 0.55, gap = 0.4 } = {}) {
  if (!Array.isArray(fromBoxes) || !Array.isArray(toBoxes)) throw new RangeError('Invalid chunk boxes');
  if (!Number.isInteger(chunk) || chunk < 1) throw new RangeError('Invalid chunk size');
  if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(gap) || gap < 0) throw new RangeError('Invalid chunk window');
  const bucket = (boxes) => {
    const m = new Map();
    for (const b of boxes) {
      const cx = Math.floor((b.x ?? 0) / chunk), cz = Math.floor((b.z ?? 0) / chunk);
      const k = cx + ',' + cz;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return m;
  };
  const A = bucket(fromBoxes), B = bucket(toBoxes);
  const keys = [...new Set([...A.keys(), ...B.keys()])].sort();
  const plan = keys.map((key, i) => ({
    key,
    delay: gap * hash01(i, seed),
    dur,
    from: A.get(key) || [],
    to: B.get(key) || [],
  }));
  return plan;
}

/** 盒子按比例向自身中心收缩（s=1 原样，s=0 消失）。用于过渡中"块越缩越小直到消失" */
export function shrinkBoxes(boxes, s) {
  if (!Number.isFinite(s)) throw new RangeError('Invalid shrink');
  const k = clamp01(s);
  if (k <= 0) return [];
  const out = [];
  for (const b of boxes) {
    const w = Math.max(1, Math.round(b.w * k)), h = Math.max(1, Math.round(b.h * k)), d = Math.max(1, Math.round(b.d * k));
    out.push({
      x: (b.x ?? 0) + Math.floor((b.w - w) / 2),
      y: (b.y ?? 0) + Math.floor((b.h - h) / 2),
      z: (b.z ?? 0) + Math.floor((b.d - d) / 2),
      w, h, d,
    });
  }
  return out;
}

/**
 * 按进度 t 写出一帧的占据场：每块在自己的窗内先**缩到消失**（旧形态）、同时抬升，
 * 过中点后从零**长出新形态**（新形态）再落位。所以中途整座岛几乎清空、只剩零星悬浮碎块，
 * 正是 818857408848130048 第 17/85 帧、832633189277409280 第 108 帧的样子。
 */
export function morphField(field, plan, t, { lift = 3, floor = 0.16, chunkWrite = rasterizeBoxes } = {}) {
  if (!Array.isArray(plan) || plan.length === 0) throw new RangeError('Invalid morph plan');
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new RangeError('Invalid morph progress');
  if (!Number.isFinite(floor) || floor < 0 || floor > 1) throw new RangeError('Invalid morph floor');
  field.data.fill(0);
  let oldChunks = 0, newChunks = 0, airborne = 0, solid = 0;
  for (const c of plan) {
    const w = clamp01((t - c.delay) / c.dur);
    const e = smoothstep(w);
    const arc = 4 * w * (1 - w);          // 0 → 1 → 0
    const up = Math.round(lift * arc);
    const fromSide = e < 0.5;
    const s = fromSide ? 1 - 2 * w : 2 * w - 1;
    if (fromSide) oldChunks++; else newChunks++;
    if (up > 0) airborne++;
    if (s < floor) continue;              // 这一块此刻在画面里不存在
    const boxes = shrinkBoxes(fromSide ? c.from : c.to, s);
    if (boxes.length) solid += chunkWrite(field, boxes, { lift: up });
  }
  return { oldChunks, newChunks, airborne, solid, mix: oldChunks / plan.length };
}

/** 场梯度（中心差分）→ 朝外法线。实心在场值高，所以朝外是负梯度 */
export function fieldNormal(field, x, y, z) {
  const d = 0.5;
  const gx = sampleField(field, x + d, y, z) - sampleField(field, x - d, y, z);
  const gy = sampleField(field, x, y + d, z) - sampleField(field, x, y - d, z);
  const gz = sampleField(field, x, y, z + d) - sampleField(field, x, y, z - d);
  const len = Math.hypot(gx, gy, gz);
  if (len < 1e-9) return [0, 1, 0];
  return [-gx / len, -gy / len, -gz / len];
}

const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const CELL_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

/**
 * naive surface nets：每格一个顶点（12 条棱交点平均），每条跨等值面的格棱出一个四边形。
 * 返回 {positions: Float32Array(3N), normals: Float32Array(3N), quads: Int32Array(4M)}
 * 顶点坐标是格点单位（1 = 一格），页面直接乘缩放。
 */
export function surfaceNets(field, { iso = ISO } = {}) {
  if (!Number.isFinite(iso)) throw new RangeError('Invalid iso');
  const { nx, ny, nz } = field;
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellIndex = new Int32Array(cnx * cny * cnz).fill(-1);
  const px = [], py = [], pz = [];
  const at = (i, j, k) => fieldIndex(field, i, j, k);
  const d = field.data;
  const vals = new Float64Array(8);

  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const o = CORNERS[c];
      const v = d[at(i + o[0], j + o[1], k + o[2])];
      vals[c] = v;
      if (v >= iso) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of CELL_EDGES) {
      const va = vals[a], vb = vals[b];
      if ((va >= iso) === (vb >= iso)) continue;
      const tt = (iso - va) / (vb - va);
      const ca = CORNERS[a], cb = CORNERS[b];
      sx += ca[0] + tt * (cb[0] - ca[0]);
      sy += ca[1] + tt * (cb[1] - ca[1]);
      sz += ca[2] + tt * (cb[2] - ca[2]);
      n++;
    }
    if (n === 0) continue;
    cellIndex[(k * cny + j) * cnx + i] = px.length;
    px.push(i + sx / n); py.push(j + sy / n); pz.push(k + sz / n);
  }

  const cid = (i, j, k) => cellIndex[(k * cny + j) * cnx + i];
  const quads = [];
  const pushQuad = (a, b, c, e) => { if (a >= 0 && b >= 0 && c >= 0 && e >= 0) quads.push(a, b, c, e); };

  // x 方向格棱：四个环绕格在 (j,k) 平面
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const va = d[at(i, j, k)], vb = d[at(i + 1, j, k)];
    if ((va >= iso) === (vb >= iso)) continue;
    if (va < iso) pushQuad(cid(i, j - 1, k - 1), cid(i, j - 1, k), cid(i, j, k), cid(i, j, k - 1));
    else pushQuad(cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k), cid(i, j - 1, k - 1));
  }
  // y 方向格棱：环绕格在 (i,k) 平面
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const va = d[at(i, j, k)], vb = d[at(i, j + 1, k)];
    if ((va >= iso) === (vb >= iso)) continue;
    if (va < iso) pushQuad(cid(i - 1, j, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k));
    else pushQuad(cid(i - 1, j, k), cid(i, j, k), cid(i, j, k - 1), cid(i - 1, j, k - 1));
  }
  // z 方向格棱：环绕格在 (i,j) 平面
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const va = d[at(i, j, k)], vb = d[at(i, j, k + 1)];
    if ((va >= iso) === (vb >= iso)) continue;
    if (va < iso) pushQuad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k));
    else pushQuad(cid(i - 1, j, k), cid(i, j, k), cid(i, j - 1, k), cid(i - 1, j - 1, k));
  }

  const n = px.length;
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    positions[v * 3] = px[v]; positions[v * 3 + 1] = py[v]; positions[v * 3 + 2] = pz[v];
  }
  // 绕向：surface nets 的顶点是"格子代表点"，可能离真实等值面最多半格，梯度取样会在棱上失准。
  // 所以直接在四边形重心处沿几何法线前后各取一个场值：值更低的一侧才是外侧。
  {
    for (let f = 0; f < quads.length; f += 4) {
      let cx = 0, cy = 0, cz = 0;
      for (let e = 0; e < 4; e++) { const o = quads[f + e] * 3; cx += positions[o]; cy += positions[o + 1]; cz += positions[o + 2]; }
      cx /= 4; cy /= 4; cz /= 4;
      const a = quads[f] * 3, b = quads[f + 1] * 3, c = quads[f + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      let gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const len = Math.hypot(gx, gy, gz);
      if (len < 1e-12) continue;
      gx /= len; gy /= len; gz /= len;
      const step = 0.6;
      const outV = sampleField(field, cx + gx * step, cy + gy * step, cz + gz * step);
      const inV = sampleField(field, cx - gx * step, cy - gy * step, cz - gz * step);
      if (outV > inV) { const t = quads[f + 1]; quads[f + 1] = quads[f + 3]; quads[f + 3] = t; }
    }
  }
  // 法线：按面积加权把面法线累加到顶点，再按边邻接平均两遍 → 平滑着色（片子里整体是哑光黏土，没有硬棱高光）
  for (let f = 0; f < quads.length; f += 4) {
    const a = quads[f] * 3, b = quads[f + 1] * 3, c = quads[f + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    for (let e = 0; e < 4; e++) {
      const o = quads[f + e] * 3;
      normals[o] += gx; normals[o + 1] += gy; normals[o + 2] += gz;
    }
  }
  const normalise = (arr) => {
    for (let i = 0; i < arr.length; i += 3) {
      const l = Math.hypot(arr[i], arr[i + 1], arr[i + 2]);
      if (l < 1e-12) { arr[i] = 0; arr[i + 1] = 1; arr[i + 2] = 0; }
      else { arr[i] /= l; arr[i + 1] /= l; arr[i + 2] /= l; }
    }
  };
  normalise(normals);
  for (let pass = 0; pass < 2; pass++) {
    const sum = new Float32Array(normals.length), cnt = new Float32Array(n);
    for (let f = 0; f < quads.length; f += 4) {
      for (let e = 0; e < 4; e++) {
        const v = quads[f + e], o = v * 3;
        for (let e2 = 0; e2 < 4; e2++) {
          const w = quads[f + e2] * 3;
          sum[o] += normals[w]; sum[o + 1] += normals[w + 1]; sum[o + 2] += normals[w + 2];
          cnt[v]++;
        }
      }
    }
    for (let v = 0; v < n; v++) {
      const o = v * 3;
      if (cnt[v] > 0) { normals[o] = sum[o] / cnt[v]; normals[o + 1] = sum[o + 1] / cnt[v]; normals[o + 2] = sum[o + 2] / cnt[v]; }
    }
    normalise(normals);
  }
  return { positions, normals, quads: Int32Array.from(quads), verts: n, faces: quads.length / 4 };
}

/** 闭合性检查：每条无向边应恰好被两个四边形共用 */
export function edgeManifold(mesh) {
  const seen = new Map();
  const q = mesh.quads;
  for (let f = 0; f < q.length; f += 4) {
    for (let e = 0; e < 4; e++) {
      const a = q[f + e], b = q[f + ((e + 1) % 4)];
      const k = a < b ? a + ':' + b : b + ':' + a;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  let open = 0, nonManifold = 0;
  for (const v of seen.values()) { if (v === 1) open++; else if (v > 2) nonManifold++; }
  return { openEdges: open, nonManifold, edges: seen.size };
}

/** 散度定理估体积（闭合网格才准）；两个三角形都要算，只算一个会少一半 */
export function meshVolume(mesh) {
  const q = mesh.quads, p = mesh.positions;
  const tri = (i0, i1, i2) => {
    const ax = p[i0], ay = p[i0 + 1], az = p[i0 + 2];
    const bx = p[i1], by = p[i1 + 1], bz = p[i1 + 2];
    const cx = p[i2], cy = p[i2 + 1], cz = p[i2 + 2];
    return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  };
  let vol = 0;
  for (let f = 0; f < q.length; f += 4) {
    const a = q[f] * 3, b = q[f + 1] * 3, c = q[f + 2] * 3, d = q[f + 3] * 3;
    vol += tri(a, b, c) + tri(a, c, d);
  }
  return vol / 6;
}

/** 网格包围盒（格坐标） */
export function meshBounds(mesh) {
  const p = mesh.positions;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
    if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
    if (p[i + 2] < z0) z0 = p[i + 2]; if (p[i + 2] > z1) z1 = p[i + 2];
  }
  return { x0, x1, y0, y1, z0, z1 };
}

/**
 * "圆角程度"度量：法线偏离最近主轴超过 deg 度的顶点占比。
 * 硬方盒 = 0（只有三组轴对齐法线）；模糊后再抽面，棱上会出现大量斜法线。
 */
export function normalTiltShare(mesh, deg = 20) {
  const nm = mesh.normals, cos = Math.cos(deg * Math.PI / 180);
  let tilted = 0, n = nm.length / 3;
  for (let i = 0; i < nm.length; i += 3) {
    const m = Math.max(Math.abs(nm[i]), Math.abs(nm[i + 1]), Math.abs(nm[i + 2]));
    if (m < cos) tilted++;
  }
  return n === 0 ? 0 : tilted / n;
}
