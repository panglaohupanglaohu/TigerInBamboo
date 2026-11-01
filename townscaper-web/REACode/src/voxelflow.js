/**
 * voxelflow.js — 体素场的三件"非光照"用途：软法线、简化碰撞、风。
 *
 * 原文（x.com/OskSta/status/931196707236392960）：
 *
 *   "My generated levels all keep a virtual voxel space. It is used for light
 *    baking, soft normals, various 3D textures, simplified collision, wind
 *    simulation etc."
 *
 * `src/lighting.js` 已经兑现了第一项（烘焙）和软法线（`bakeSoftNormals`），
 * 但那一份是给**建筑**用的。这里补的是同一条原文里剩下的两项 —— 碰撞和风 ——
 * 并且让软法线也能用在**地形**上。
 *
 * 为什么单独一个文件而不是塞进 lighting.js：那一份是共享文件，另一条线正在改
 * （一小时里从 15.8KB 长到 30KB）。这里只读 `field` 的公开字段
 * （`occ / W / H / L / size / res / minX / minZ / levelHeight / sampleOcc`），
 * 不改它，因此谁先落地都不会打架。等两边稳定了，这三段可以原样搬回去。
 *
 * 三件东西都只是**读同一张占用场**，不产生第二份数据 —— 这正是"共享体素场"
 * 的意义：风之所以能绕开房子，是因为房子本来就在那张场里。
 */

/** 0..1 夹紧。 */
import { pointInQuad } from './town.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 从一个体素场里取出三件工具。
 *
 * @param {object} field  `buildVoxelField()` 的返回值
 * @param {object} [o]
 * @param {number[]} [o.windDir]   远处风向（会被归一化），默认西北偏西
 * @param {number} [o.windSpeed]   远处风速（世界单位/秒）
 * @param {number} [o.gradStep]    梯度采样偏移，世界单位。太小会被单格噪声带跑，
 *                                 太大就分辨不出"一格宽的巷子"。0.5 ≈ 1.5 格。
 */
/**
 * 从体素集合光栅一张**不模糊**的实心掩码（粗体素，一格一个立方体）。
 *
 * 为什么不直接用 `field.occ`：那张是给光照的，模糊半径 0.36 世界单位，
 * 会在表面以上抹出 0.3~0.4 的"半透明"，也会把薄墙抹掉一半。碰撞要的是
 * 非黑即白，所以按同一个包围盒、同一个 res 重新按格的包围盒刷一遍。
 */
function buildSolidMask(field, sets) {
  const { grid, res, minX, minZ, W, H, L, size, levelHeight } = field;
  const data = new Uint8Array(W * H * L);
  if (!sets || !sets.length) return { data, W, H, L, size, cells: 0 };
  let stamp = 0;
  for (const set of sets) {
    const cells = set.cells || grid.cells;
    const base = Math.round((set.y || 0) / levelHeight);
    for (const c of cells) {
      const top = set.town.top(c);
      if (!top) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of c.pts) {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
      }
      const i0 = Math.max(0, Math.floor((x0 - minX) / res));
      const i1 = Math.min(W - 1, Math.ceil((x1 - minX) / res));
      const j0 = Math.max(0, Math.floor((z0 - minZ) / res));
      const j1 = Math.min(H - 1, Math.ceil((z1 - minZ) / res));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          // 只刷**纹素中心落在四边形内**的格子。按包围盒刷会把锯齿状的岸线
          // 多刷出去半格，于是海面上也有"地面"（实测 106/846 个点判错，全是岸边）。
          const tx = minX + (i + 0.5) * res;
          const tz = minZ + (j + 0.5) * res;
          if (!pointInQuad(c.pts, tx, tz)) continue;
          const col = j * W + i;
          for (let lv = 1; lv <= top; lv++) {
            const layer = base + lv;
            if (layer < 0 || layer >= L) continue;
            data[layer * size + col] = 1;
          }
        }
      }
      stamp++;
    }
  }
  return { data, W, H, L, size, cells: stamp };
}

export function fieldFlow(field, {
  windDir = [-0.82, 0.06, 0.57],
  windSpeed = 1.6,
  gradStep = 0.5,
  // 碰撞要的是二值体积：把烘场时用的那批 town 原样传进来，这里自己再光栅一遍。
  // 不传的话 collide 一律返回 null（宁可没有，也不要拿模糊场冒充精确碰撞）。
  sets = null,
} = {}) {
  const { occ, W, H, L, size, res, minX, minZ, levelHeight } = field;

  /* ---- 碰撞要的是**二值**体积，不是模糊过的那张 ---------------------------
   * lighting 的那张场是给光照用的：两遍盒式模糊（半径 4 texel ≈ 0.36 世界
   * 单位）把边缘抹开了，于是"屋顶上方 0.3"的占用率会掉到 0，碰撞就会把房子
   * 判成不存在（实测：在房子正中 collide 直接返回地面高度）。
   * 所以这里从**同一批 town** 另光栅化一张不模糊的实心掩码。数据来源还是那一份
   * 体素空间，只是取"实心/空心"而不是"有多少光挡在这"。
   */
  const SOLID = buildSolidMask(field, sets);
  const wl = Math.hypot(windDir[0], windDir[1], windDir[2]) || 1;
  const W0 = [windDir[0] / wl, windDir[1] / wl, windDir[2] / wl];

  /** 三线性占用率（和 lighting.js 的 sample 同一套坐标约定）。 */
  const occAt = (x, y, z) => field.sampleOcc(x, y, z);

  /**
   * 软法线 = 模糊后占用率的**梯度取反**。
   *
   * 为什么这个能当法线：场是盒式模糊过两遍的，等值面跨格连续，梯度方向就是
   * "离实体最近的外法线"。代价是它只认体积、不认面 —— 薄墙会得到偏平的法线，
   * 所以调用方要按 `blend` 和真实面法线混合（默认 0.5 上下）。
   */
  function softNormal(x, y, z) {
    const g = gradStep;
    const gx = (occAt(x + g, y, z) - occAt(x - g, y, z)) / (2 * g);
    const gy = (occAt(x, y + g, z) - occAt(x, y - g, z)) / (2 * g);
    const gz = (occAt(x, y, z + g) - occAt(x, y, z - g)) / (2 * g);
    const len = Math.hypot(gx, gy, gz);
    if (len < 1e-4) return [0, 1, 0];
    return [-gx / len, -gy / len, -gz / len];
  }

  /**
   * 简化碰撞：世界 XZ → 地面高度。
   *
   * "简化"的意思是**不做三角求交**：直接从上往下找第一层占住的体素，返回它的
   * 上表面。误差上界就是格子高度（0.5），对面片被软坡抬起来的地方会矮一点 ——
   * 够用来贴地放东西、限制相机、给风场挑采样点，不够用来做子弹。
   */
  function collide(x, z) {
    const fi = ((x - minX) / res) | 0;
    const fj = ((z - minZ) / res) | 0;
    if (fi < 0 || fj < 0 || fi >= W || fj >= H) return null;
    const col = fj * W + fi;
    for (let lv = SOLID.L - 1; lv >= 1; lv--) {
      const k = lv * SOLID.size + col;
      if (k < SOLID.data.length && SOLID.data[k]) {
        return { y: lv * levelHeight, layer: lv };
      }
    }
    return null;
  }

  /**
   * 风：基础风向 × 开阔度 + 沿梯度绕开障碍 + 崖顶/檐口上扬。
   *
   * 三项分别对应参考片里能看到的三种行为：
   *   ① **墙后没风**：开阔度用平方，贴墙时掉得比线性快（实测 0.9 开阔 ≈ 0.81，
   *      0.4 开阔 ≈ 0.16）；这一条是空调试时最容易漏的 —— 线性衰减下墙根还是有风。
   *   ② **风绕过去**：把法线方向（-grad）的水平分量加到风上，于是巷子里的风是
   *      斜着穿过去的，不是直直撞墙。
   *   ③ **崖顶往上翻**：头顶遮挡突然消失（-gy 大）时给一个正的上扬分量。
   */
  function windAt(x, y, z) {
    // 遮挡取"中心 + 四周 0.5 处"的最大值。只采中心点的话，一条一格宽的巷子
    // 里 occ 会是 0（模糊半径 0.36 < 半条巷宽 0.45），风就当成开阔地满速吹过去 ——
    // 实测巷子 1.86 vs 开阔 1.80，完全是反的。侧向采样才让"窄缝里风小"成立。
    const R = gradStep;
    let o = occAt(x, y, z);
    // 8 向 × 两个高度取最大遮挡：一格宽的巷子两侧是墙，但墙不一定正好在 ±R 上，
    // 单采 4 个正方向会漏掉斜对角的墙（实测巷子只掉到 1.47 / 开阔 1.80）。
    for (const dy of [0, 0.4]) {
      const yy = y + dy;
      o = Math.max(o, occAt(x + R, yy, z), occAt(x - R, yy, z), occAt(x, yy, z + R), occAt(x, yy, z - R));
      const d = R * 0.72;
      o = Math.max(o, occAt(x + d, yy, z + d), occAt(x - d, yy, z - d), occAt(x + d, yy, z - d), occAt(x - d, yy, z + d));
    }
    const open = clamp(1 - o * 1.35, 0, 1);
    const sp = open * open;                       // ① 平方衰减
    const g = gradStep;
    const gx = (occAt(x + g, y, z) - occAt(x - g, y, z)) / (2 * g);
    const gy = (occAt(x, y + g, z) - occAt(x, y - g, z)) / (2 * g);
    const gz = (occAt(x, y, z + g) - occAt(x, y, z - g)) / (2 * g);
    const gl = Math.hypot(gx, gz);
    const k = gl > 1e-4 ? 0.55 / gl : 0;          // ② 绕流
    const wx = W0[0] * sp + (-gx * k) * sp;
    const wz = W0[2] * sp + (-gz * k) * sp;
    const lift = clamp(-gy, 0, 1) * 0.35 * sp;    // ③ 上扬
    return [wx * windSpeed, (W0[1] * sp + lift) * windSpeed, wz * windSpeed];
  }

  const windSpeedAt = (x, y, z) => {
    const w = windAt(x, y, z);
    return Math.hypot(w[0], w[1], w[2]);
  };

  /**
   * 把软法线烘进几何（非索引三角汤）。
   *
   * `blend = 0` 保留原法线，`1` 完全用场法线。地形用 0.55 比较合适：崖面从
   * "一格一个折面"变成连续转折，但棱角还在；再高就会把尖锐的崖顶磨圆。
   */
  function bakeSoftNormals(geometry, { blend = 0.55, offset = 0.12 } = {}) {
    const pos = geometry.getAttribute('position');
    const nrm = geometry.getAttribute('normal');
    if (!nrm) return { touched: 0 };
    let touched = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      // 采样点要沿法线推出去一点，否则正好落在表面那一层、占用率 0.5、梯度为 0
      const [sx, sy, sz] = softNormal(x + nx * offset, y + ny * offset, z + nz * offset);
      let bx = nx + (sx - nx) * blend;
      let by = ny + (sy - ny) * blend;
      let bz = nz + (sz - nz) * blend;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl; by /= bl; bz /= bl;
      // 场法线和面法线反向时（薄壁两侧会这样）宁可不改，避免出现黑洞
      if (bx * nx + by * ny + bz * nz < 0.15) continue;
      nrm.setXYZ(i, bx, by, bz);
      touched++;
    }
    nrm.needsUpdate = true;
    return { touched, blend };
  }

  /**
   * 数值自检：给一批 XZ，比对"场里量到的地面高度"和"真值"。真值由调用方给
   * （一般是 `town.top(cell) * levelHeight`）。落在软坡上的点必然有偏差，
   * 所以只报**中位偏差**和"差超过一层"的比例。
   */
  function auditCollide(samples) {
    const errs = [];
    let misses = 0;
    for (const s of samples) {
      const hit = collide(s.x, s.z);
      if (s.y === null || s.y === undefined) { if (hit && hit.y > 0) misses++; continue; }
      if (!hit) { misses++; errs.push(Infinity); continue; }
      const e = Math.abs(hit.y - s.y);
      errs.push(e);
      if (e > levelHeight) misses++;
    }
    errs.sort((a, b) => a - b);
    const q = (t) => +(errs[Math.floor(t * (errs.length - 1))] || 0).toFixed(3);
    return {
      samples: errs.length,
      median: q(0.5),
      p90: q(0.9),
      misses,
      missRate: +(misses / Math.max(1, errs.length)).toFixed(3),
    };
  }

  return { collide, windAt, windSpeedAt, softNormal, bakeSoftNormals, auditCollide, windDir: W0, windSpeed };
}
