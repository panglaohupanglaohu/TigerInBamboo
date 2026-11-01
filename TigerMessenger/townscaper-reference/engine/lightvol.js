/**
 * lightvol.js — 6 方向光照体积 + 点光源（低分辨率、明显但可接受）。
 *
 * 两条原文：
 *
 * (1) x.com/OskSta/status/1580845127207387137
 *   "1st texture here is an sdf volume. The distance lives in the alpha, but RG
 *    actually reference UVs in the mega texture! 2nd is a baked 6 directional
 *    light volume, raycast against the sdf, sampling the mega texture using the
 *    UVs where it hits the sdf. 3rd is the lit mega texture"
 *
 * (2) x.com/OskSta/status/1582757294672314368
 *   "I'm seeing if my light volume approach can work with point lights too. The
 *    low resolution is noticeable for sure. Especially when you move em around
 *    like this. But if you keep em big and soft and somewhat still I think it's
 *    gonna be good."
 *
 * 关键是"体积"而不是"贴图"：世界被切成一个粗网格（我们这台机器用 32×16×32，
 * 一格大约 1.2 世界单位），每格存**6 个方向**的可见度，然后顶点去三线性插值。
 * 因为格子粗，插值出来的是大块柔和的光斑，而不是锐利的投影 —— 原文说的
 * "low resolution is noticeable" 就是这件事，而且他说这样反而好看。
 *
 * 画面观察（1582757294672314368）：
 *   · 整个岛被画成一堆小点（那是体积的采样点），橙 = 受光，蓝 = 背光/遮挡
 *   · 点光源附近有一团亮斑，边缘非常软，跨越好几个格子才衰减完
 *   · 点光源移动时亮斑跟着走，但形状**一顿一顿**的（格子边界），这就是低分辨率
 *   · 背光侧不是纯黑，而是蓝灰 —— 环境项还是有的，点光源只是叠加
 *
 * 我们的做法（预算内的等价物）：
 *   1. 静态烘一次 6 方向可见度体积（沿 ±X ±Y ±Z 各打一条射线，撞到体素就衰减）
 *   2. 每个顶点三线性取 6 个值 —— 只做一次，存进 Float32Array（6 × 顶点数）
 *   3. 每帧只算点光源：用顶点存的 6 个方向值按光的方向取加权可见度（免重采样）
 *   4. 结果写回顶点色的乘法因子（保留原调色板）
 */

import * as THREE from 'three';

/** 0..1 的平滑阶跃（和 GLSL 的 smoothstep 同义，用来做 AO 重映射）。 */
function smoothstep01(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function createPointLightVolume({
  town,
  grid,
  geometry,
  levelHeight = 0.42,
  nxy = 32,
  ny = 16,
  radius = 9,
  ambient = 0.62,
  gain = 1.05,
  aoStrength = 0.40,
} = {}) {
  // ---- 1. 包围盒 + 占用栅格 ------------------------------------------
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let maxTop = 1;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
    maxTop = Math.max(maxTop, town.top(c));
  }
  const sizeX = Math.max(1e-3, maxX - minX);
  const sizeZ = Math.max(1e-3, maxZ - minZ);
  const sizeY = Math.max(1e-3, maxTop * levelHeight * 1.25);
  // 三个轴都用同样的**格数**，但格子的世界尺寸不同 —— 这就是"低分辨率"的来源
  const nx = nxy, nz = nxy;
  const cellX = sizeX / nx, cellY = sizeY / ny, cellZ = sizeZ / nz;

  const solid = new Uint8Array(nx * ny * nz);
  const toI = (x, y, z) => (z * ny + y) * nx + x;

  for (const c of grid.cells) {
    const top = town.top(c);
    if (top <= 0) continue;
    // 每个 quad **只占一列**：按格心取一列，而不是把整个包围盒刷进去。
    // 坑：原来用 floor(minX..maxX) 的闭区间刷，一个宽 0.8 的格子在 0.97 宽的
    // 栅格里会刷出 2 列，整个岛在栅格里被"虚胖"了一圈 —— 结果所有竖直面的
    // 顶点被自己外侧的实心格挡住，射线第一步就撞墙，AO 中位数直接是 0。
    const x0 = Math.min(nx - 1, Math.max(0, Math.floor(((c.cx - minX) / sizeX) * nx)));
    const x1 = x0;
    const z0 = Math.min(nz - 1, Math.max(0, Math.floor(((c.cz - minZ) / sizeZ) * nz)));
    const z1 = z0;
    // 实心格只填到顶面**之下**：最后一个实心格的上表面必须 <= 顶面高度。
    // 坑：之前写 floor(top*levelHeight/sizeY*ny) 填充，最后一格被填满，整片
    // 顶面都埋在实心格里 —— 顶点一打射线就被自己这格挡住，AO 全变成 0（实测 mean 0.09）。
    // floor(t/cellY) - 1 保证 (y1+1)*cellY <= t，顶点永远站在实心格之上。
    const y1 = Math.min(ny - 1, Math.max(0, Math.floor((top * levelHeight) / sizeY * ny) - 1));
    const y0 = 0;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) solid[toI(x, y, z)] = 1;
      }
    }
  }

  // ---- 2. 6 方向可见度：沿 ±X ±Y ±Z 打射线 ---------------------------
  // 方向顺序：0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const MAX_STEPS = 14;
  const vol = new Float32Array(nx * ny * nz * 6);

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const base = toI(x, y, z) * 6;
        for (let d = 0; d < 6; d++) {
          const [dx, dy, dz] = DIRS[d];
          let vis = 1;
          for (let s = 1; s <= MAX_STEPS; s++) {
            const px = x + dx * s, py = y + dy * s, pz = z + dz * s;
            if (px < 0 || px >= nx || py < 0 || py >= ny || pz < 0 || pz >= nz) break;
            if (solid[toI(px, py, pz)]) {
              // 越近越黑；用平方衰减让贴近的面明显暗下去
              vis = 1 - Math.pow(1 - s / (MAX_STEPS + 1), 2);
              break;
            }
          }
          vol[base + d] = vis;
        }
      }
    }
  }

  // ---- 3. 每顶点取 6 个方向值（只此一次）-----------------------------
  const posAttr = geometry.getAttribute('position');
  const cnt = posAttr.count;
  const perVert = new Float32Array(cnt * 6);
  const verts = new Float32Array(cnt * 3);

  const sample = (wx, wy, wz, out, o) => {
    const gx = Math.min(nx - 1.001, Math.max(0, ((wx - minX) / sizeX) * nx - 0.5));
    const gy = Math.min(ny - 1.001, Math.max(0, (wy / sizeY) * ny - 0.5));
    const gz = Math.min(nz - 1.001, Math.max(0, ((wz - minZ) / sizeZ) * nz - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
    const fx = gx - x0, fy = gy - y0, fz = gz - z0;
    for (let d = 0; d < 6; d++) {
      const at = (ix, iy, iz) => vol[((iz * ny + iy) * nx + ix) * 6 + d];
      const c00 = at(x0, y0, z0) * (1 - fx) + at(x0 + 1, y0, z0) * fx;
      const c10 = at(x0, y0 + 1, z0) * (1 - fx) + at(x0 + 1, y0 + 1, z0) * fx;
      const c01 = at(x0, y0, z0 + 1) * (1 - fx) + at(x0 + 1, y0, z0 + 1) * fx;
      const c11 = at(x0, y0 + 1, z0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1, z0 + 1) * fx;
      const c0 = c00 * (1 - fy) + c10 * fy;
      const c1 = c01 * (1 - fy) + c11 * fy;
      out[o + d] = c0 * (1 - fz) + c1 * fz;
    }
  };

  for (let i = 0; i < cnt; i++) {
    const wx = posAttr.getX(i), wy = posAttr.getY(i), wz = posAttr.getZ(i);
    verts[i * 3] = wx; verts[i * 3 + 1] = wy; verts[i * 3 + 2] = wz;
    sample(wx, wy, wz, perVert, i * 6);
  }

  // ---- 3.5 半球 AO ------------------------------------------------------
  //
  // 原文（x.com/OskSta/status/1168168400155267072）：
  //   "Got some very basic lighting in there. Since this ain't proper voxels I
  //    had to do a new take on my usual voxel based AO approach"
  //
  // "不是真体素"是关键：他的 AO 不能按体素格子算（我们也没有独立的格子，
  // 顶点是贴在四边形上的散点）。所以这里换成一个**共用同一张占用栅格**的射线做法：
  // 从每个顶点沿自己的法线半球打 14 条短射线，撞到占用格就按"撞得多早"衰减。
  // 这张栅格第 1 步已经烘好了，AO 只是复用它，没有多一遍几何 —— 这就是"新做法"。
  //
  // 画面（1168400155267072 的帧）：几乎是纯白模型，只有**墙脚、屋檐下、下沉
  // 庭院的内壁下部**有极淡的接触暗部，对比度很低（目测 < 12%），没有方向性 ——
  // 所以 AO 只乘在环境项上，且上限压到 0.55。
  // 射线只用 3 步（≈0.9 世界单位 ≈ 一格半）：参考片里的 AO 是**贴脚**的。
  const AO_STEPS = 3;
  // 14 个方向：6 个轴向 + 8 个体对角。轴向管"正对面"，对角管"墙角"，
  // 少了对角就会漏掉两面墙夹出来的那个角（那也是唯一明显变暗的地方）。
  const AO_DIRS = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  ].map((d) => {
    const l = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / l, d[1] / l, d[2] / l];
  });

  // --- AO 专用栅格：比光照体积细 3 倍 -----------------------------------
  //
  // 关键教训：AO **不能**复用光照体积那张 32×32 的栅格。一格宽 0.97 世界单位，
  // 而一个 quad 只有 0.8 宽 —— 半密闭的台地群里，相邻两列几乎必然落进同一格，
  // 于是每个竖直面顶点四周全被填成实心，射线第一步就撞墙，AO 中位数直接是 0
  // （实测 side 分桶 p50=0.000，整片崖面一起变灰绿）。AO 要分辨"一格宽的缝"，
  // 本身就必须比缝更细，所以这里单独烘一张 96×96 的。
  const AO_N = 96;
  const AO_NY = Math.max(16, ny * 2);
  const aoCellX = sizeX / AO_N, aoCellY = sizeY / AO_NY, aoCellZ = sizeZ / AO_N;
  const aoSolid = new Uint8Array(AO_N * AO_N * AO_NY);
  const aoAt = (x, y, z) => (z * AO_NY + y) * AO_N + x;
  for (const c of grid.cells) {
    const top = town.top(c);
    if (top <= 0) continue;
    const gx = Math.min(AO_N - 1, Math.max(0, Math.floor(((c.cx - minX) / sizeX) * AO_N)));
    const gz = Math.min(AO_N - 1, Math.max(0, Math.floor(((c.cz - minZ) / sizeZ) * AO_N)));
    // 同样只填到顶面之下，顶点才不会站在实心格里
    const yTop = Math.min(AO_NY - 1, Math.max(0, Math.floor((top * levelHeight) / sizeY * AO_NY) - 1));
    for (let y = 0; y <= yTop; y++) aoSolid[aoAt(gx, y, gz)] = 1;
  }
  const aoStep = Math.min(aoCellX, aoCellZ);

  const nrmAttr = geometry.getAttribute('normal');
  const aoArr = new Float32Array(cnt);
  let aoMin = 1, aoMax = 0, aoSum = 0;

  for (let i = 0; i < cnt; i++) {
    const wx = verts[i * 3], wy = verts[i * 3 + 1], wz = verts[i * 3 + 2];
    // 坑：这里千万别叫 nx/ny/nz —— 外侧的体积分辨率正好叫这三个名字，
    // 一遮挡，下面算格子下标时用的是法线分量（还带负号），floor 出来是 -1，
    // 直接 break 出界，于是每个顶点的 AO 都算成 1.00（shader 不报错、画面不变，
    // 只有看 stats 才发现）。
    let nnx = 0, nny = 1, nnz = 0;
    if (nrmAttr) {
      nnx = nrmAttr.getX(i); nny = nrmAttr.getY(i); nnz = nrmAttr.getZ(i);
      const l = Math.hypot(nnx, nny, nnz) || 1;
      nnx /= l; nny /= l; nnz /= l;
    }
    let wsum = 0;
    let visSum = 0;
    for (let d = 0; d < AO_DIRS.length; d++) {
      const [dx, dy, dz] = AO_DIRS[d];
      // 余弦权重：只有朝着法线那一侧的射线算数，背面直接跳过
      const w = nnx * dx + nny * dy + nnz * dz;
      if (w <= 0) continue;
      let vis = 1;
      for (let s = 1; s <= AO_STEPS; s++) {
        // 起点沿法线外推 1/3 格：顶点贴在表面上，s=1 时会有半个格子落在
        // 自己脚下那块实体里，AO 会变成整片 0（实测 mean 0.09 → 全黑）
        const px = wx + nnx * aoStep * 0.34 + dx * aoStep * s;
        const py = wy + nny * aoStep * 0.34 + dy * aoStep * s;
        const pz = wz + nnz * aoStep * 0.34 + dz * aoStep * s;
        const gx = Math.floor(((px - minX) / sizeX) * AO_N);
        const gy = Math.floor((py / sizeY) * AO_NY);
        const gz = Math.floor(((pz - minZ) / sizeZ) * AO_N);
        if (gx < 0 || gx >= AO_N || gy < 0 || gy >= AO_NY || gz < 0 || gz >= AO_N) break;
        if (aoSolid[aoAt(gx, gy, gz)]) { vis = (s - 1) / AO_STEPS; break; }
      }
      wsum += w;
      visSum += w * vis;
    }
    const ao = wsum > 1e-6 ? visSum / wsum : 1;
    aoArr[i] = ao;
    aoMin = Math.min(aoMin, ao);
    aoMax = Math.max(aoMax, ao);
    aoSum += ao;
  }
  const aoMean = aoSum / Math.max(1, cnt);

  // ---- 4. 顶点色：留一份底色，之后只做乘法 ---------------------------
  const colorAttr = geometry.getAttribute('color');
  const baseColors = colorAttr ? new Float32Array(colorAttr.array) : null;
  const litColors = colorAttr ? colorAttr.array : null;

  const tmp = new Float32Array(6);
  const lastLightPos = new THREE.Vector3(0, 5, 0);

  /**
   * 重算顶点光照。点光源位置一变就调用一次（原文明说"移动时低分辨率很明显"，
   * 所以这里不省这一步，就是要把那点块状感保留下来）。
   */
  function update(lightPos, lightColor = [1.0, 0.72, 0.42]) {
    if (!litColors) return;
    lastLightPos.copy(lightPos);
    const lx = lightPos.x, ly = lightPos.y, lz = lightPos.z;
    for (let i = 0; i < cnt; i++) {
      const wx = verts[i * 3], wy = verts[i * 3 + 1], wz = verts[i * 3 + 2];
      let dx = lx - wx, dy = ly - wy, dz = lz - wz;
      const dist = Math.hypot(dx, dy, dz) || 1e-3;
      dx /= dist; dy /= dist; dz /= dist;

      // 环境：主要是向上的天空可见度，加一点点四周，再乘半球 AO
      const sky = perVert[i * 6 + 2];
      const side = (perVert[i * 6 + 0] + perVert[i * 6 + 1] + perVert[i * 6 + 4] + perVert[i * 6 + 5]) * 0.25;
      // AO 只吃环境项：点光源的直接光不该被 AO 压（那是阴影的活，这盏灯没有阴影）
      //
      // 重映射是必须的：粗栅格（一格 ≈ 1.2 世界单位）加上"顶点贴在面上"这件事，
      // 会让**可见**的竖直面也拿到 0.3~0.5 的原始 AO；直接乘上去整座岛的崖面
      // 会一起变灰绿（实测 mean 90.9 → 86.2 且色相偏冷）。参考片里 AO 只出现在
      // 墙脚、屋檐下，对比度 < 12%，所以这里先平滑重映射再乘，只留"真角落"。
      const aoR = smoothstep01(0.22, 0.90, aoArr[i]);
      const aoK = 1 - aoStrength * (1 - aoR);
      const amb = (ambient + (1 - ambient) * (sky * 0.72 + side * 0.28)) * aoK;

      // 点光源：用地积里存的 6 个方向值按光方向加权（免二次重采样）。
      // 参考片里那团光的边缘很软 —— 这里用 1/(1+d²) 而不是物理 1/d²，更"平"
      const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
      const vis =
        (dx > 0 ? perVert[i * 6 + 0] : perVert[i * 6 + 1]) * ax +
        (dy > 0 ? perVert[i * 6 + 2] : perVert[i * 6 + 3]) * ay +
        (dz > 0 ? perVert[i * 6 + 4] : perVert[i * 6 + 5]) * az;

      const fall = 1 / (1 + (dist / radius) * (dist / radius) * 2.2);
      const k = Math.min(1.6, fall * vis * gain);

      const b0 = baseColors[i * 3], b1 = baseColors[i * 3 + 1], b2 = baseColors[i * 3 + 2];
      litColors[i * 3 + 0] = b0 * amb * 0.94 + b0 * k * lightColor[0];
      litColors[i * 3 + 1] = b1 * amb * 0.99 + b1 * k * lightColor[1] * 0.95;
      litColors[i * 3 + 2] = b2 * amb * 1.10 + b2 * k * lightColor[2] * 0.90;
    }
    colorAttr.needsUpdate = true;
  }

  return {
    update,
    /** 调试/对照用：改 AO 强度（0 = 只留点光源体积，等于第 4 轮的版本）。 */
    setAO(v) { aoStrength = v; update(lastLightPos); },
    dispose() {
      if (baseColors && litColors) litColors.set(baseColors);
    },
    get stats() {
      return {
        volume: `${nx}×${ny}×${nz}`,
        verts: cnt,
        ao: { min: aoMin, mean: aoMean, max: aoMax, strength: aoStrength },
      };
    },
    _vol: vol,
    _solid: solid,
    _ao: aoArr,
    _grid: { minX, minZ, sizeX, sizeY, sizeZ, nx, ny, nz, cellX, cellY, cellZ, aoN: AO_N, aoNY: AO_NY, aoStep },
    /** 最近的顶点 AO（测试用：给个世界坐标，返回落在同一个格子里的顶点 AO）。 */
    aoNear(x, y, z) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < cnt; i++) {
        const d = (verts[i * 3] - x) ** 2 + (verts[i * 3 + 1] - y) ** 2 + (verts[i * 3 + 2] - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return { ao: aoArr[best], dist: Math.sqrt(bestD), at: [verts[best * 3], verts[best * 3 + 1], verts[best * 3 + 2]] };
    },
    sampleVolume(wx, wy, wz) { sample(wx, wy, wz, tmp, 0); return Array.from(tmp); },
  };
}
