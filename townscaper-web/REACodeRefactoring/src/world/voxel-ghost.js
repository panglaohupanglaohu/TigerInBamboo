/**
 * voxel-ghost.js — 体素化「幽灵预览 → 逐格实体化」。
 *
 * 依据：
 *   794993371261665280（158 帧，2016-11-05，左下角始终有 "Go!" 按钮）：
 *     灰色底板上先浮起一片**黄色小点**充满整个将要建成的体量，同一批位置随后变成**细线立方框**，
 *     再按**自下而上**逐格变成实体方块；建成后绕着塔慢转一圈。画面里始终能同时看到三种状态
 *     （已实心 / 线框 / 黄点），说明不是三段切换，而是每格各有自己的时间线。
 *   797844857821732864（117 帧，2016-11-13，同一工具）：先出现一根**竖直的点柱**（塔的中轴，从底板长到顶），
 *     再整栋逐格实体化；等价机制，只是点的出现顺序不同（先竖后横）。
 *
 * 所以本模块拆成三件事：
 *   1. rasterizeBoxes()：把盒子集合体素化（去重、可只留壳），等价于"把模型采样成目标格"；
 *   2. voxelOrder()：装配顺序（scan 自下而上 / radial 由中轴向外 / shuffle 固定种子打乱）；
 *   3. previewState()：给定进度 t，返回每格当前状态（hidden → point → ghost → solid）。
 *      三条时间线错开：点最早、线框稍后、实体化最晚且严格按装配序排列 → 已实心的格恒为装配序前缀。
 */

/** 体素键（整数坐标，避免浮点键） */
const key = (x, y, z) => x + ',' + y + ',' + z;

/** 固定种子整数散列 → [0,1)。用于"点/线框出现时机"的抖动，保证可复现 */
export function hash01(i, seed = 0) {
  if (!Number.isInteger(i) || !Number.isFinite(seed)) throw new RangeError('Invalid hash input');
  let h = (i | 0) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * 盒子集合 → 体素占位表。boxes: [{x,y,z,w,h,d,hollow?}]
 * hollow: 只留外壳格（== 视频里"空心中庭"的塔身）。
 * 重叠盒取并集（同一格只算一次），返回 Map<key,{x,y,z}>。
 */
export function rasterizeBoxes(boxes) {
  if (!Array.isArray(boxes) || boxes.length === 0) throw new RangeError('Invalid voxel boxes');
  const out = new Map();
  for (const b of boxes) {
    const x = b.x ?? 0, y = b.y ?? 0, z = b.z ?? 0;
    const { w, h, d } = b;
    for (const v of [x, y, z, w, h, d]) if (!Number.isInteger(v)) throw new RangeError('Invalid box extent');
    if (w < 1 || h < 1 || d < 1) throw new RangeError('Invalid box size');
    const shell = b.hollow === true;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) {
      if (shell && i > 0 && i < w - 1 && j > 0 && j < h - 1 && k > 0 && k < d - 1) continue;
      const vx = x + i, vy = y + j, vz = z + k, kk = key(vx, vy, vz);
      if (!out.has(kk)) out.set(kk, { x: vx, y: vy, z: vz });
    }
  }
  return out;
}

/**
 * 任意三角网格 → 体素占位表（奇偶射线法，沿 +x 从格心打射线）。
 * tris: [[[x,y,z],[x,y,z],[x,y,z]], …]，世界坐标。**水密网格**才保证内外判定正确，
 * 空腔自然保留（从外面数一遍是奇数、跨过空腔边界再变偶数）——对应片子里塔身中庭是空的。
 * 这是 rasterizeBoxes 的通用版：盒子只是"轴对齐水密网格"的特例。
 */
export function rasterizeMesh(tris, { cell = 1, maxCells = 400000 } = {}) {
  if (!Array.isArray(tris) || tris.length === 0) throw new RangeError('Invalid mesh triangles');
  if (!(Number.isFinite(cell) && cell > 0)) throw new RangeError('Invalid voxel cell size');
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) {
    if (!Array.isArray(t) || t.length !== 3) throw new RangeError('Invalid triangle');
    for (const p of t) {
      if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) throw new RangeError('Invalid triangle vertex');
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
    }
  }
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / cell)));
  if (n[0] * n[1] * n[2] > maxCells) throw new RangeError(`Mesh too fine for voxelization: ${n[0] * n[1] * n[2]} cells`);
  const out = new Map();
  for (let i = 0; i < n[0]; i++) {
    const px = lo[0] + (i + 0.5) * cell;
    for (let j = 0; j < n[1]; j++) {
      const py = lo[1] + (j + 0.5) * cell;
      for (let k = 0; k < n[2]; k++) {
        const pz = lo[2] + (k + 0.5) * cell;
        // 收集格心正前方的所有交点 x，**去重后**数个数。
        // 不去重会踩经典坑：格心正对两个三角的公共边时，同一条边被两个面各记一次 →
        // 交点成对出现、奇偶翻成偶数，内部格被判成外部（实测 2³ 立方只剩 4 格）。
        const xs = [];
        for (const [A, B, C] of tris) {
          // 只看 yz 平面的重心坐标，再算交点的 x
          const d = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
          if (Math.abs(d) < 1e-12) continue;                        // 与射线平行的面片
          const u = ((py - A[1]) * (C[2] - A[2]) - (pz - A[2]) * (C[1] - A[1])) / d;
          if (u < 0 || u > 1) continue;
          const v = ((B[1] - A[1]) * (pz - A[2]) - (B[2] - A[2]) * (py - A[1])) / d;
          if (v < 0 || u + v > 1) continue;
          const hitX = A[0] + u * (B[0] - A[0]) + v * (C[0] - A[0]);
          if (hitX > px) xs.push(hitX);
        }
        if (xs.length === 0) continue;
        xs.sort((a, b) => a - b);
        let crossings = 1;
        for (let q = 1; q < xs.length; q++) if (xs[q] - xs[q - 1] > cell * 1e-6) crossings++;
        if (crossings % 2 === 1) out.set(key(i, j, k), { x: i, y: j, z: k });
      }
    }
  }
  return out;
}

/**
 * 逐层材质色板。第 97 轮按原片**逐段色相**重标（794993371261665280，158 帧 508×506）：
 *   外表面（frame-0060 / frame-0150）沿高度每 25px 的**圆均值色相**：
 *     0060: 154 170 189 191 189 190 194 208 205 199 194 191 181 166 156 157 （度）
 *     0150: 155 170 187 190 189 189 197 207 200 202 197 185 174 157 160
 *     饱和度中位**恒 12–15%**、明度 56–73% —— 是**连续漂移**，不是六个离散色档；
 *     塔身中段偏青（≈190–207°）、上下两端偏绿（≈155–170°）。
 *   内部机位（frame-0120，镜头进到塔内）才看得到暖色：中段 H≈355°、S 20%（玫瑰墙面），上下仍是绿/黄绿。
 * 所以旧色板（粉/紫/青绿/灰蓝六种明显不同色）**把颜色多样性说过头了**：外表面实测是
 * 「同一灰青底 + 极弱色相漂移」。这里换成实测色相族（H 156–204°、S 12–16%、V 79–84%，略高于成片
 * 因为材质色还要过光照与雾），色槽机制（每 bandHeight 层换一档）不变。
 * 仍缺：内部玫瑰墙（H≈355°）没建模 —— 那是「进塔后镜头内侧」，不是外表面的层带。
 */
export const LAYER_PALETTE = ['#b4d1c5', '#b0cfc8', '#b8d4d4', '#abc5cc', '#abbdc9', '#bcd6d2'];

/**
 * 逐层材质分组：按 y 每 bandHeight 层取一个色槽（循环用色板），返回每格的色槽号 + 各槽计数。
 * 原片里相邻层带是**成段换色**、不是逐层渐变，所以用固定 band 而不是连续插值。
 */
export function layerMaterials(voxels, { palette = LAYER_PALETTE, bandHeight = 3 } = {}) {
  if (!Array.isArray(palette) || palette.length === 0) throw new RangeError('Invalid layer palette');
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  if (!(Number.isFinite(bandHeight) && bandHeight > 0)) throw new RangeError('Invalid band height');
  let lo = Infinity, hi = -Infinity;
  for (const v of list) { lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
  const bands = Math.max(1, Math.ceil((hi - lo + 1) / bandHeight));
  const of = new Map(), counts = new Array(palette.length).fill(0);
  for (const v of list) {
    const b = Math.min(bands - 1, Math.floor((v.y - lo) / bandHeight));
    const idx = b % palette.length;
    of.set(key(v.x, v.y, v.z), idx);
    counts[idx]++;
  }
  return {
    bands, of, counts,
    colorOf: (v) => palette[of.get(key(v.x, v.y, v.z)) ?? 0],
  };
}

/**
 * 中轴竖柱：从底板长到顶的那一列（797844857821732864 开场的竖直点柱）。
 * 取 (x,z) 质心最近的柱、半径 radius 内的所有格，按 y 升序返回。
 */
export function spineColumn(voxels, { radius = 1.5 } = {}) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  if (!(Number.isFinite(radius) && radius > 0)) throw new RangeError('Invalid spine radius');
  let sx = 0, sz = 0;
  for (const v of list) { sx += v.x + 0.5; sz += v.z + 0.5; }
  const cx = sx / list.length, cz = sz / list.length;
  const cells = list
    .filter((v) => Math.hypot(v.x + 0.5 - cx, v.z + 0.5 - cz) <= radius)
    .map((v) => ({ x: v.x, y: v.y, z: v.z }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  return { x: Math.floor(cx), z: Math.floor(cz), cells };
}

/** 占位表 → 有序装配序列 */
export function voxelOrder(voxels, { mode = 'scan', seed = 7 } = {}) {
  if (!['scan', 'radial', 'shuffle', 'spine'].includes(mode)) throw new RangeError('Invalid voxel order mode');
  if (!Number.isFinite(seed)) throw new RangeError('Invalid voxel order seed');
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  let seq = list.map((v) => ({ x: v.x, y: v.y, z: v.z }));
  if (mode === 'spine') {
    // 先把中轴那一列自下而上点完，再从中轴往外——正是 797844857821732864 的"先竖后横"
    const spine = spineColumn(list);
    const ids = new Set(spine.cells.map((v) => key(v.x, v.y, v.z)));
    const rest = seq.filter((v) => !ids.has(key(v.x, v.y, v.z)));
    let sx = 0, sz = 0;
    for (const v of seq) { sx += v.x + 0.5; sz += v.z + 0.5; }
    const cx = sx / seq.length, cz = sz / seq.length;
    const r = (v) => Math.hypot(v.x + 0.5 - cx, v.z + 0.5 - cz);
    rest.sort((a, b) => (r(a) - r(b)) || (a.y - b.y));
    return [...spine.cells, ...rest];
  }
  if (mode === 'scan') {
    // 自下而上、再按 z/x 行内扫：和片子里"塔从底板一格格往上长"一致
    seq.sort((a, b) => (a.y - b.y) || (a.z - b.z) || (a.x - b.x));
  } else if (mode === 'radial') {
    // 由中轴向外：797844857821732864 那根"先竖起来的点柱"就是按离轴距离先排
    let sx = 0, sz = 0;
    for (const v of seq) { sx += v.x; sz += v.z; }
    const cx = sx / seq.length, cz = sz / seq.length;
    const r = (v) => Math.hypot(v.x + 0.5 - cx, v.z + 0.5 - cz);
    seq.sort((a, b) => (r(a) - r(b)) || (a.y - b.y));
  } else {
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(hash01(i, seed) * (i + 1));
      const t = seq[i]; seq[i] = seq[j]; seq[j] = t;
    }
  }
  return seq;
}

/**
 * 进度 t → 每格状态。
 *  - 点：appearAt = 0.02 + 0.12·(? )     （pointMode='scatter' 用定种子散列 → 整片点几乎同时出现，
 *                                          对应 794993371261665280 的 0010 帧；'order' 改用 i/N →
 *                                          点沿装配序一格格长出来；配合 radial 序是从中轴往外一圈圈，
 *                                          近似 797844857821732864 的"先竖后横"，但那一根独占的中轴柱
 *                                          要求模型自带中轴柱，本仓模型没有）
 *  - 线框：ghostAt = 0.16 + 0.20·hash    （点还在，框一格格套在外面，对应 0010→0044 帧）
 *  - 实体：fillAt = 0.28 + 0.72·(i/N)    （严格按装配序，铺满落在 t=1）
 */
export function previewState(order, t, { seed = 11, pointMode = 'scatter' } = {}) {
  if (!Array.isArray(order) || order.length === 0) throw new RangeError('Invalid voxel order');
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new RangeError('Invalid preview progress');
  if (!['scatter', 'order'].includes(pointMode)) throw new RangeError('Invalid point mode');
  const N = order.length, points = [], ghost = [], solid = [];
  let hidden = 0;
  for (let i = 0; i < N; i++) {
    const v = order[i];
    const appearAt = 0.02 + 0.12 * (pointMode === 'order' ? i / N : hash01(i, seed));
    const ghostAt = 0.16 + 0.20 * hash01(i, seed + 101);
    const fillAt = 0.28 + 0.72 * (i / N);
    if (t >= fillAt) solid.push(v);
    else if (t >= ghostAt) ghost.push(v);
    else if (t >= appearAt) points.push(v);
    else hidden++;
  }
  const phase = solid.length === N ? 'done' : solid.length > 0 ? 'fill' : ghost.length + points.length > 0 ? 'scatter' : 'empty';
  return { phase, hidden, points, ghost, solid };
}

/** 等轴测投影：sx=(x−z)·cos30·s，sy=(x+z)·tilt·s − y·s。返回 [sx,sy]（y 向上为负屏幕方向） */
export function isoProject(v, { scale = 1, tilt = 0.5 } = {}) {
  if (!Number.isFinite(scale) || !Number.isFinite(tilt)) throw new RangeError('Invalid iso projection');
  return [(v.x - v.z) * 0.8660254037844386 * scale, (v.x + v.z) * tilt * scale - v.y * scale];
}

/** 画家序：越远越先画。等轴测下深度 = x+y+z */
export function depthOf(v) { return v.x + v.y + v.z; }

/** 立方体的三个可见面（顶 / +x 右 / +z 左），返回投影后的多边形点列 */
export function cubeFaces(v, { scale = 1, tilt = 0.5 } = {}) {
  const P = (x, y, z) => isoProject({ x, y, z }, { scale, tilt });
  const { x, y, z } = v, X = x + 1, Y = y + 1, Z = z + 1;
  return {
    top: [P(x, Y, z), P(X, Y, z), P(X, Y, Z), P(x, Y, Z)],
    right: [P(X, y, z), P(X, Y, z), P(X, Y, Z), P(X, y, Z)],
    left: [P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)],
  };
}

/** 统计：给页面和测试用的三态计数 */
export function phaseCounts(state) {
  return { hidden: state.hidden, points: state.points.length, ghost: state.ghost.length, solid: state.solid.length, phase: state.phase };
}
