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
 *
 * 第 183 轮补齐上面这条 + 环机位：
 *   - `cavityCells` / `interiorFaces` / `INTERIOR_TONE`：房间与拱洞的**墙**（+x/+z 面，
 *     沿法线穿空气后撞到实体 = 对面有墙），按原片 0110–0130 帧取样的暖玫瑰色画；
 *     机位在外时被前面挡住，只有透过门洞才看得见，`?interior=0` 关档；
 *   - `rotateY` + `isoProject(...,{azimuth})`：正交环绕机位（片子里机位绕 Y 转、竖直棱恒竖），
 *     `?azim=<度>` / 页面方位角滑杆；
 *   - `windowSlot` / `windowStats`：逐格外墙的**内凹窗槽**（frame-0116 每格一个，非贴图）。
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

/**
 * 绕 Y 轴的方位角旋转（度）。azimuth=0 就是原来的固定机位（等价 45° 等轴测），
 * 加它是为了对上 794993371261665280 / 797844857821732864 的**环绕镜头**：
 * 片子里机位沿竖直轴绕塔转（相邻帧看到的外墙面在变），但**竖直棱始终是竖的**
 * —— frame-0116 的右轮廓在 253 行内水平漂移 <1px（斜率 −0.0024）→ 是正交环绕，
 * 不是透视推轨。旧 note 写的「缺真三维环绕镜头（本仓等轴测无透视环绕）」前半句对、
 * 后半句错：原片本身没有透视收聚，缺的只是方位角这一个自由度。
 */
export function rotateY(x, z, azimuthDeg) {
  if (!Number.isFinite(azimuthDeg)) throw new RangeError('Invalid azimuth');
  const a = (azimuthDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [x * c - z * s, x * s + z * c];
}

/** 等轴测投影：sx=(X−Z)·cos30·s，sy=(X+Z)·tilt·s − y·s；[X,Z]=rotY(x,z,azimuth) */
export function isoProject(v, { scale = 1, tilt = 0.5, azimuth = 0 } = {}) {
  if (!Number.isFinite(scale) || !Number.isFinite(tilt)) throw new RangeError('Invalid iso projection');
  const [X, Z] = rotateY(v.x, v.z, azimuth);
  return [(X - Z) * 0.8660254037844386 * scale, (X + Z) * tilt * scale - v.y * scale];
}

/** 画家序：越远越先画。等轴测下深度 = X+y+Z（X/Z 已按方位角旋转） */
export function depthOf(v, { azimuth = 0 } = {}) {
  const [X, Z] = rotateY(v.x, v.z, azimuth);
  return X + v.y + Z;
}

/**
 * 立方体的面，返回投影后的多边形点列。
 * 默认给三个可见面（顶 / +x 右 / +z 左）；back=true 再给三个背面
 * （−x / −z / 底）—— 内腔玫瑰墙画的就是 −x / −z 这两个面，透过门洞才看得见。
 */
export function cubeFaces(v, { scale = 1, tilt = 0.5, azimuth = 0, back = false } = {}) {
  const P = (x, y, z) => isoProject({ x, y, z }, { scale, tilt, azimuth });
  const { x, y, z } = v, X = x + 1, Y = y + 1, Z = z + 1;
  const faces = {
    top: [P(x, Y, z), P(X, Y, z), P(X, Y, Z), P(x, Y, Z)],
    right: [P(X, y, z), P(X, Y, z), P(X, Y, Z), P(X, y, Z)],
    left: [P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)],
  };
  if (back) {
    faces.backX = [P(x, y, z), P(x, Y, z), P(x, Y, Z), P(x, y, Z)];
    faces.backZ = [P(x, y, z), P(X, y, z), P(X, y, Z), P(x, y, Z)];
    faces.bottom = [P(x, y, z), P(X, y, z), P(X, y, Z), P(x, y, Z)];
  }
  return faces;
}

/**
 * 内腔格：占位表里**被实体完全围住**的空格（从包围盒边界泛洪也到不了的格）。
 * 片子 794993371261665280 的 0110–0130 帧把镜头塞进门洞，看到的内壁就是这些腔的壁。
 */
export function cavityCells(voxels) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of list) {
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  // 包围盒外扩一格，从角落泛洪：能到达的空格 = 外部
  const outside = new Set();
  const start = key(x0 - 1, y0 - 1, z0 - 1);
  const stack = [[x0 - 1, y0 - 1, z0 - 1]];
  outside.add(start);
  while (stack.length) {
    const [x, y, z] = stack.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < x0 - 1 || nx > x1 + 1 || ny < y0 - 1 || ny > y1 + 1 || nz < z0 - 1 || nz > z1 + 1) continue;
      const kk = key(nx, ny, nz);
      if (solid.has(kk) || outside.has(kk)) continue;
      outside.add(kk); stack.push([nx, ny, nz]);
    }
  }
  const cavity = new Set();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const kk = key(x, y, z);
    if (!solid.has(kk) && !outside.has(kk)) cavity.add(kk);
  }
  return cavity;
}

/** 内腔玫瑰色：按原片 0110–0130 帧的内壁取样（H≈355°、S≈20%、V≈84%） */
export const INTERIOR_TONE = '#e3cad7';

/**
 * 第 186 轮：室内光的**进深渐变**（797844857821732864 的 0116 大拱洞：洞口一侧墙近白粉、
 * 往里越深越压成暗玫瑰）。原片是「环境光从洞口灌进去、越深只剩反弹光」，
 * 所以同一面墙的颜色只由它面前那格空气**离最近洞口多少格**决定，与面向无关。
 *
 * 口径：`airDepths` 从「包围盒外的空气」泛洪，格子的 depth = 到最近外部空气的步数（洞口那格 = 1）。
 * 进深 t = 1 − exp(−depth/ref)（ref=9 格 ≈ 演示塔单间进深；取 6 时最浅的内墙面只有 t=0.49，
 * "洞口浅、深处暗"读不出来），色 = NEAR→DEEP 线性插值，
 * 中进深正好落在原片实测的 INTERIOR_TONE（H355 S20 V84）上。
 */
export const INTERIOR_TONE_NEAR = '#f2e4e9';
export const INTERIOR_TONE_DEEP = '#b891a3';

/** 空格的进深：到「与外部空气相邻」的步数。返回 Map<'x,y,z', depth>（只含能通到外面的空气）。 */
export function airDepths(voxels) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of list) {
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  const lo = [x0 - 1, y0 - 1, z0 - 1], hi = [x1 + 1, y1 + 1, z1 + 1];
  const depth = new Map();
  const q = [];
  // 种子 = 包围盒边界上的空格（这些格直接贴着外部空气，depth=0）
  for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
    const onEdge = x === lo[0] || x === hi[0] || y === lo[1] || y === hi[1] || z === lo[2] || z === hi[2];
    if (!onEdge) continue;
    const kk = key(x, y, z);
    if (solid.has(kk) || depth.has(kk)) continue;
    depth.set(kk, 0); q.push([x, y, z]);
  }
  for (let i = 0; i < q.length; i++) {
    const [x, y, z] = q[i], d = depth.get(key(x, y, z));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < lo[0] || nx > hi[0] || ny < lo[1] || ny > hi[1] || nz < lo[2] || nz > hi[2]) continue;
      const kk = key(nx, ny, nz);
      if (solid.has(kk) || depth.has(kk)) continue;
      depth.set(kk, d + 1); q.push([nx, ny, nz]);
    }
  }
  return depth;
}

/** 进深 → 颜色。depth 为「面前那格空气」的进深；ref 是渐变尺度（格）。 */
export function interiorTone(depth, { ref = 9 } = {}) {
  if (!Number.isFinite(depth)) throw new RangeError('Invalid interior depth');
  if (!(Number.isFinite(ref) && ref > 0)) throw new RangeError('Invalid interior tone ref');
  const t = depth <= 0 ? 0 : 1 - Math.exp(-depth / ref);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r0, g0, b0] = hex(INTERIOR_TONE_NEAR), [r1, g1, b1] = hex(INTERIOR_TONE_DEEP);
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const to2 = (n) => n.toString(16).padStart(2, '0');
  return { depth, t, hex: '#' + to2(mix(r0, r1)) + to2(mix(g0, g1)) + to2(mix(b0, b1)) };
}

/**
 * 内腔墙（可见面那一侧）：格子的 **+x（right）/ +z（left）面**，当它沿法线方向
 * 「先过空气、再撞上实体」时，这个面就是**房间的墙**——机位在外时被前面挡住，
 * 只有透过门洞才看得见，所以给它上暖玫瑰色就等价于原片里的室内反射光，
 * 不会污染外立面（外立面朝天空，法线方向撞不到东西）。
 *
 * 判据：沿面法线逐格步进，穿过 ≥1 格空气后在 reach 格内撞到实体 → 记为内墙面。
 * 为什么不用「封闭腔 / 凹龛」：片子里镜头是**穿门洞进到房间里**的，房间通着门洞，
 * 泛洪能到 → 不是封闭腔；而本仓的演示体量是一整间大开间，中心格六面全空 →
 * 也够不上「≥4 面被围」。两种几何判据都留不住房间，只有「对面有墙」这个射线判据站得住。
 * （第 183 轮第一版画的是背面（−x/−z），永远背对机位，内腔开/关像素差 5px = 没画。）
 * 返回 Map<'x,y,z,axis', depth>，axis ∈ {'x','z'}；depth = 该面面前那格空气的进深 + 1
 * （第 186 轮补：值由 true 改成进深数字，`has`/`size` 语义不变，页面用它做进深渐变）。
 */
export function interiorFaces(voxels, { reach = 16 } = {}) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  if (!Number.isInteger(reach) || reach < 1) throw new RangeError('Invalid reach');
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  const air = airDepths(list);
  const out = new Map();
  for (const v of list) {
    for (const axis of ['x', 'z']) {
      let steps = 0, hit = false;
      for (let d = 1; d <= reach; d++) {
        const kk = axis === 'x' ? key(v.x + d, v.y, v.z) : key(v.x, v.y, v.z + d);
        if (solid.has(kk)) { hit = steps >= 1; break; }
        steps++;
      }
      if (hit) {
        const front = axis === 'x' ? key(v.x + 1, v.y, v.z) : key(v.x, v.y, v.z + 1);
        const depth = air.has(front) ? air.get(front) + 1 : reach;
        out.set(key(v.x, v.y, v.z) + ',' + axis, depth);
      }
    }
  }
  return out;
}

/**
 * 逐格窗洞：原片每一格外墙上都有一个**内凹的小竖槽**（frame-0116 放大可见，格面中央偏上）。
 * 不是贴图：是同一格外壳上的一小块凹面，凹进去的面比外面暗（背光 + 自遮蔽）。
 * 这里只给「有窗/无窗 + 槽在格面上的归一化矩形」，画由页面按面的双线性插值完成。
 * 定种子 → 同一格永远同一结果，可回放。
 */
export function windowSlot(v, { seed = 23, density = 0.82 } = {}) {
  if (!Number.isFinite(seed) || !(density >= 0 && density <= 1)) throw new RangeError('Invalid window slot params');
  const h = hash01(((v.x & 1023) << 20) ^ ((v.y & 1023) << 10) ^ (v.z & 1023), seed);
  const jitter = hash01(((v.z & 1023) << 20) ^ ((v.x & 1023) << 10) ^ (v.y & 1023), seed + 7);
  const on = h < density;
  const w = 0.30 + 0.10 * jitter;                     // 槽宽（格面归一化）
  const hh = 0.34 + 0.14 * (1 - jitter);              // 槽高
  const u0 = 0.5 - w / 2, v0 = 0.46 - hh / 2;         // 居中，略偏上（原片窗在格面中上部）
  return { on, u0, u1: u0 + w, v0, v1: v0 + hh };
}

/** 窗洞统计：外壳格数 / 有窗格数 / 面数（每格算右+左两面） */
export function windowStats(voxels, { seed = 23, density = 0.82 } = {}) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  let cells = 0, withWindow = 0;
  for (const v of list) {
    if (v.y === 0) continue;                            // 底板不算外墙
    cells++;
    if (windowSlot(v, { seed, density }).on) withWindow++;
  }
  return { cells, withWindow, rate: cells ? withWindow / cells : 0, faces: withWindow * 2 };
}

/**
 * 屋顶小件（第 186 轮，797844857821732864 frame-0116 的 4× 裁切逐个数出来）：
 *   ① **细天线** —— 屋脊上 1–2 根细竖杆，长短不一（4× 里能同时看到 6–8 根，最高的约 1.3 格）；
 *   ② **圆盘** —— 左塔上部外墙上挂一个正圆盘（面朝外、不是屋顶上的锅）；
 *   ③ **栏杆** —— 每段屋顶沿口都有小竖齿（密排短柱，不是连续扶手）；
 *   ④ **露台小树** —— 中层露台上一棵「三球叠起来」的小树，底下有个方形花池。
 * 四件都按「格子 + 定种子散列」生成，所以可复现；位置一律落在**屋顶格**（上方无实体）或它朝外的立面上。
 */
export function roofProps(voxels, { seed = 31, antennaRate = 0.06, maxDishes = 2, maxTrees = 2, minY = 2, postGap = 0.25 } = {}) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  if (!(antennaRate >= 0 && antennaRate <= 1)) throw new RangeError('Invalid antenna rate');
  if (!(postGap > 0.1)) throw new RangeError('Invalid post gap');
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  const isEmpty = (x, y, z) => !solid.has(key(x, y, z));
  const roofs = list.filter((v) => v.y >= minY && isEmpty(v.x, v.y + 1, v.z));
  if (roofs.length === 0) return { props: [], counts: { antenna: 0, dish: 0, rail: 0, tree: 0 }, roofs: 0, maxY: 0 };
  const roofSet = new Set(roofs.map((v) => key(v.x, v.y, v.z)));
  const covered = (v) => {
    let n = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (roofSet.has(key(v.x + dx, v.y, v.z + dz))) n++;
    }
    return n;
  };
  const h = (v, salt) => hash01(((v.x & 1023) << 20) ^ ((v.y & 1023) << 10) ^ (v.z & 1023), seed + salt);
  const maxY = Math.max(...list.map((v) => v.y));
  const props = [];

  // ① 露台小树：最平（8 邻全是屋顶）且靠上的几格，彼此至少隔 2.5 格
  const flat = roofs.filter((v) => covered(v) >= 7).sort((a, b) => (b.y - a.y) || (h(a, 3) - h(b, 3)));
  const trees = [];
  for (const v of flat) {
    if (trees.length >= maxTrees) break;
    if (trees.some((t) => Math.hypot(t.x - v.x, t.z - v.z) < 2.5 && Math.abs(t.y - v.y) < 2)) continue;
    trees.push(v);
  }
  for (const v of trees) {
    props.push({ kind: 'tree', x: v.x + 0.5, y: v.y + 1, z: v.z + 0.5, cell: { x: v.x, y: v.y, z: v.z }, s: 0.86 + 0.18 * h(v, 5), seed: h(v, 6) });
  }

  // ② 天线：屋面散点，避开树与碟；长短由散列定（0.55–1.35 格），部分成对
  const nearTree = (v) => trees.some((t) => Math.hypot(t.x - v.x, t.z - v.z) < 1.2 && t.y === v.y);
  const masts = roofs
    .filter((v) => h(v, 1) < antennaRate && !nearTree(v))
    .sort((a, b) => (b.y - a.y) || (h(a, 2) - h(b, 2)))
    .slice(0, 9);
  for (const v of masts) {
    const r1 = h(v, 7), r2 = h(v, 8);
    const base = { kind: 'antenna', x: v.x + 0.22 + 0.56 * r1, y: v.y + 1, z: v.z + 0.22 + 0.56 * r2, cell: { x: v.x, y: v.y, z: v.z }, h: 0.55 + 0.80 * h(v, 9), w: 0.045 };
    props.push(base);
    if (h(v, 10) > 0.62) props.push({ ...base, kind: 'antenna', x: base.x + 0.14, z: base.z + 0.09, h: base.h * 0.72 });
  }

  // ③ 圆盘：上部外墙（+x / +z 面朝外），面心挂在 y+0.62 处
  const dishes = [];
  const dishCand = roofs
    // 圆盘要挂在**一段墙面**上：至少 2 个屋顶邻格（单根柱子顶上挂锅是笑话）
    .filter((v) => v.y >= maxY - 6 && covered(v) >= 2
      && (isEmpty(v.x + 1, v.y, v.z) || isEmpty(v.x, v.y, v.z + 1)))
    .sort((a, b) => (b.y - a.y) || (h(a, 11) - h(b, 11)));
  for (const v of dishCand) {
    if (dishes.length >= maxDishes) break;
    if (dishes.some((d) => Math.hypot(d.cell.x - v.x, d.cell.z - v.z) < 3)) continue;
    const useX = isEmpty(v.x + 1, v.y, v.z);
    dishes.push({
      kind: 'dish', cell: { x: v.x, y: v.y, z: v.z }, axis: useX ? 'x' : 'z',
      x: useX ? v.x + 1 : v.x + 0.5, y: v.y + 0.62, z: useX ? v.z + 0.5 : v.z + 1,
      r: 0.24 + 0.10 * h(v, 12),
    });
  }
  props.push(...dishes);

  // ④ 栏杆：每段屋顶沿口密排小竖齿（沿边每 postGap 一格一根）
  for (const v of roofs) {
    for (const [dx, dz, axis] of [[1, 0, 'z'], [-1, 0, 'z'], [0, 1, 'x'], [0, -1, 'x']]) {
      if (!isEmpty(v.x + dx, v.y, v.z + dz)) continue;
      const along = axis === 'x' ? v.x : v.z;
      for (let t = 0.1; t <= 0.951; t += postGap) {
        const hp = 0.13 + 0.06 * hash01((((v.x & 1023) << 20) ^ ((v.z & 1023) << 10) ^ Math.round(t * 100)) | 0, seed + 13);
        props.push(axis === 'x'
          ? { kind: 'rail', x: along + t, y: v.y + 1, z: dz > 0 ? v.z + 1 : v.z, h: hp, w: 0.05, cell: { x: v.x, y: v.y, z: v.z } }
          : { kind: 'rail', x: dx > 0 ? v.x + 1 : v.x, y: v.y + 1, z: along + t, h: hp, w: 0.05, cell: { x: v.x, y: v.y, z: v.z } });
      }
    }
  }
  const counts = { antenna: 0, dish: 0, rail: 0, tree: 0 };
  for (const p of props) counts[p.kind]++;
  return { props, counts, roofs: roofs.length, maxY, terrace: flat.length, trees: trees.length };
}

/** 统计：给页面/测试用（件数 + 每件的基格是否屋顶格） */
export function propStats(voxels, { seed = 31, antennaRate = 0.06, maxDishes = 2, maxTrees = 2, minY = 2, postGap = 0.25 } = {}) {
  const r = roofProps(voxels, { seed, antennaRate, maxDishes, maxTrees, minY, postGap });
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  let floating = 0;
  for (const p of r.props) {
    const c = p.cell || { x: Math.floor(p.x), y: Math.floor(p.y) - 1, z: Math.floor(p.z) };
    if (!solid.has(key(c.x, c.y, c.z))) floating++;
    else if (solid.has(key(c.x, c.y + 1, c.z)) && p.kind !== 'dish') floating++;  // 上面还压着实体 → 被埋
  }
  return { ...r.counts, props: r.props.length, roofs: r.roofs, terrace: r.terrace, trees: r.trees, floating };
}

/**
 * 基座广场小树（第 187 轮，`794993371261665280` 的 frame-0060 / frame-0150 原尺寸）：
 * 片子里的树**不在屋顶/露台**（r183 记的「露台灌木/花盆」是误判，4× 与 1× 逐帧都没有），
 * 而是沿塔基在**底板广场上排成一列**：7–9 棵、树冠等大、间距 1–2 格，脚下各有一圈方形花池，
 * 花池之间是草地色带。树形与 `roofProps` 的 `tree` 同一套（三球叠起来）。
 * 落点判据：底板格（y === plateY）、上方一格为空、且离塔身占地（y > plateY 的实体）至少 `clear` 格。
 */
export function groundPlants(voxels, { seed = 41, plateY = 0, count = 9, gap = 1.7, clear = 1.45 } = {}) {
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  if (!Array.isArray(list) || list.length === 0) throw new RangeError('Invalid voxel list');
  if (!Number.isFinite(count) || count < 0) throw new RangeError('Invalid plant count');
  if (!(gap > 0.5)) throw new RangeError('Invalid plant gap');
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  const above = list.filter((v) => v.y > plateY);
  if (above.length === 0) return { plants: [], counts: { tree: 0 }, plateCells: 0, candidates: 0 };
  const h = (v, salt) => hash01(((v.x & 1023) << 20) ^ (v.y & 1023) << 10 ^ (v.z & 1023), seed + salt);
  // 底板格 → 上方空、且离任何上层实体格 ≥ clear（离墙根留一点，树冠不穿墙）
  const plate = list.filter((v) => v.y === plateY && !solid.has(key(v.x, v.y + 1, v.z)));
  const distToBody = (v) => {
    let best = Infinity;
    for (const s of above) {
      const dx = Math.max(0, Math.abs(s.x - v.x) - 0.5), dz = Math.max(0, Math.abs(s.z - v.z) - 0.5);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  };
  const cand = plate
    .map((v) => ({ v, d: distToBody(v) }))
    .filter((c) => c.d >= clear)
    .sort((a, b) => (a.d - b.d) || (h(a.v, 1) - h(b.v, 1)));
  const plants = [];
  for (const c of cand) {
    if (plants.length >= count) break;
    if (plants.some((p) => Math.hypot(p.cell.x - c.v.x, p.cell.z - c.v.z) < gap)) continue;
    plants.push({
      kind: 'tree', x: c.v.x + 0.5, y: c.v.y + 1, z: c.v.z + 0.5,
      // 树比屋顶灌木大：片子里基座树约 1.5–2 格高（frame-0060 里 27px/格、树 55px）
      cell: { x: c.v.x, y: c.v.y, z: c.v.z }, s: 1.55 + 0.30 * h(c.v, 2), seed: h(c.v, 3),
      bed: true,                                  // 脚下方形花池（原片每棵都有）
    });
  }
  return { plants, counts: { tree: plants.length }, plateCells: plate.length, candidates: cand.length };
}

/** 小树统计：件数 + 基格是否底板格 + 上方是否被压（给页面/测试） */
export function plantStats(voxels, opts = {}) {
  const r = groundPlants(voxels, opts);
  const list = voxels instanceof Map ? [...voxels.values()] : voxels;
  const solid = new Set(list.map((v) => key(v.x, v.y, v.z)));
  let buried = 0, floating = 0;
  for (const p of r.plants) {
    if (solid.has(key(p.cell.x, p.cell.y + 1, p.cell.z))) buried++;
    if (!solid.has(key(p.cell.x, p.cell.y, p.cell.z))) floating++;
  }
  return { ...r.counts, plants: r.plants.length, plateCells: r.plateCells, candidates: r.candidates, buried, floating };
}

/** 统计：给页面和测试用的三态计数 */
export function phaseCounts(state) {
  return { hidden: state.hidden, points: state.points.length, ghost: state.ghost.length, solid: state.solid.length, phase: state.phase };
}
