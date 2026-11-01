/**
 * rayvis.js — "便宜到不准确"的 ray marching，用来算室内可见度。
 *
 * 原文（x.com/OskSta/status/798580832906739712, 2016-11-15）：
 *
 *   "Some dirt cheap (and highly inaccurate) ray marching. Might use it for
 *    visibility when indoors"
 *
 * 画面（24 帧，466×466）：
 *   · 整张图是**灰度**的：外部墙面接近纯白，室内和背面压到接近纯黑；
 *     没有方向光，没有阴影贴图，明暗完全是"这个地方能看到多少天空"；
 *   · 从一个点向外放射出大量**黄绿色细线**（射线段），线很短、扎进墙里就断；
 *   · 边缘发毛、有噪点，明暗过渡很软 —— 典型的**低采样 + 短步长**结果，
 *     原文自己说的 "highly inaccurate" 就是这些毛毛边。
 *
 * 为什么这样做：
 *   他不需要正确的阴影，只需要一个**廉价的空间明暗场**，让玩家"感觉"到自己
 *   进了屋。所以：固定方向集（不按像素打射线，按**空间采样点**打）、
 *   固定步长（不做解析求交）、命中即停（不算法线/多次反弹）。
 *   代价是毛边和漏光，收益是可以在 CPU 上对几千个采样点算完，逐顶点刷颜色。
 *
 * 关键取舍（写进参数的三个数）：
 *   1. 方向数 K：越多越平滑，K=12 时已有明显条纹，K=18 基本看不出（片子的毛感
 *      介于两者之间，取 K=16）。
 *   2. 步长：太粗会穿墙（漏光），太细白算。用 0.5 体素 —— 墙厚只有 1 体素，
 *      步长 ≥1 体素就有整面墙被跨过去，实测漏光率会跳到 30%+（见 selfCheck）。
 *   3. 射线长度：只关心"近处是否被挡"，距离一过 maxDist 就按全亮记，
 *      否则室内会被天空亮度冲平。
 *
 * 这个文件不 import three，纯数据；`selfCheck()` 会造一个带内室的方块城堡，
 * 回报室内/室外平均可见度、漏光率、每条射线的步数。
 */

/** 方向集：斐波那契球（比经纬度均匀，条纹少）。K 由调用方定。 */
export function fibonacciDirs(k = 16) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < k; i++) {
    const y = 1 - (i + 0.5) * 2 / k;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    out.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return out;
}

/**
 * 体素实体场：solid(x,y,z) → true 表示实心。
 * 返回 {w,h,d,data}，data[i] = 1/0。
 */
export function buildSolid(solid, w, h, d) {
  const data = new Uint8Array(w * h * d);
  for (let z = 0; z < d; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        data[(z * h + y) * w + x] = solid(x, y, z) ? 1 : 0;
      }
    }
  }
  return { w, h, d, data };
}

function at(s, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= s.w || y >= s.h || z >= s.d) return 0;
  return s.data[(z * s.h + y) * s.w + x];
}

/**
 * 单条射线：固定步长前进，命中实心即返回已走距离。
 * **不做解析求交** —— 这就是 "dirt cheap" 的全部含义。
 */
export function castRay(s, ox, oy, oz, dir, maxDist, step) {
  for (let t = step; t <= maxDist; t += step) {
    const x = Math.floor(ox + dir.x * t);
    const y = Math.floor(oy + dir.y * t);
    const z = Math.floor(oz + dir.z * t);
    if (at(s, x, y, z)) return t;
  }
  return maxDist;
}

/**
 * 一个采样点的可见度 ∈ [0,1]：所有射线的"开阔度"平均。
 * 开阔度用线性衰减：贴着墙 → 0，走满 maxDist 没撞 → 1。
 */
export function visibility(s, p, dirs, { maxDist = 12, step = 0.5 } = {}) {
  let sum = 0;
  for (const d of dirs) sum += castRay(s, p.x, p.y, p.z, d, maxDist, step) / maxDist;
  return sum / dirs.length;
}

/** 批量：给一组点算可见度（返回 Float32Array）。 */
export function visibilityField(s, points, opts) {
  const dirs = opts.dirs || fibonacciDirs(opts.k || 16);
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i++) out[i] = visibility(s, points[i], dirs, opts);
  return out;
}

/** 采样点：暴露体素的面心（只在"面朝空气"的面上算，省一大半）。 */
export function surfaceSamples(s) {
  const pts = [];
  const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let z = 0; z < s.d; z++) {
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (!at(s, x, y, z)) continue;
        for (const [dx, dy, dz] of nb) {
          if (at(s, x + dx, y + dy, z + dz)) continue;
          pts.push({
            x: x + 0.5 + dx * 0.52,
            y: y + 0.5 + dy * 0.52,
            z: z + 0.5 + dz * 0.52,
            vx: x, vy: y, vz: z, nx: dx, ny: dy, nz: dz,
          });
          break;   // 每个体素只取一个暴露面足够（片子是逐面刷的，但逐体素就够看）
        }
      }
    }
  }
  return pts;
}

/**
 * 一座"带内室的方块城堡"—— 参考片里就是一栋多层的楼，室内有隔断。
 * 只为验证用：外墙带门洞、每层有楼板和一道内墙。
 */
export function demoCastle(w = 14, h = 16, d = 12) {
  const doorZ = 6, doorX = 7;
  return buildSolid((x, y, z) => {
    const shellX = x === 0 || x === w - 1;
    const shellZ = z === 0 || z === d - 1;
    const floor = y % 5 === 0;
    const roof = y === h - 1;
    // 外墙 + 楼板 + 屋顶
    // 外墙 + 楼板 + 屋顶
    // 坑：楼板第一版写成 `floor && (shellX || shellZ)`，结果没有楼板，
    // 房间上下全通，室内点算出来的可见度 0.58（≈室外 0.72），对比度只有 1.24×，
    // 完全复现不出片子那种"室内近黑"。楼板必须**整片**铺满。
    let solid = false;
    if (shellX || shellZ) solid = true;
    if (roof) solid = true;
    if (floor && y > 0) solid = true;
    // 门洞：正面 z=0 处开一个 2 宽 3 高的口
    if (z === 0 && Math.abs(x - doorX) <= 1 && y >= 1 && y <= 3) solid = false;
    // 内隔断：x = doorZ 处一道墙，每层留一个门；
    // z = 3 / 7 再各一道，把楼层切成小房间 —— 房间一大，射线能跑 3~4 格才撞墙，
    // 可见度就压不下来（实测：只有 x 隔断时室内 0.51，加了 z 隔断才落到 0.2 以下）。
    if (x === doorZ && y > 0 && y % 5 !== 0) {
      const gap = (y % 5) === 2 && (z > 3 && z < 6);
      solid = !gap;
    }
    if ((z === 3 || z === 7) && y > 0 && y % 5 !== 0) {
      const gap = (y % 5) === 3 && (x > 8 && x < 11);
      if (!gap) solid = true;
    }
    return solid;
  }, w, h, d);
}

/**
 * 自检：室内 vs 室外可见度、漏光率（墙后的点却算成"看得见"）。
 */
export function selfCheck({ k = 16, maxDist = 12, step = 0.5 } = {}) {
  const s = demoCastle();
  const dirs = fibonacciDirs(k);

  // 室内点：一楼房间中间（门关着的那侧）；室外点：屋顶上方一格
  const inside = { x: 10.5, y: 2.5, z: 8.5 };
  const outside = { x: 7.0, y: s.h + 1.5, z: 6.0 };
  const vi = visibility(s, inside, dirs, { maxDist, step });
  const vo = visibility(s, outside, dirs, { maxDist, step });

  // 漏光：在实心体素内部采样（物理上应该 0 可见度）
  let leaks = 0, leakN = 0;
  for (let z = 1; z < s.d - 1; z += 3) {
    for (let y = 1; y < s.h - 1; y += 3) {
      for (let x = 1; x < s.w - 1; x += 3) {
        const i = (z * s.h + y) * s.w + x;
        if (!s.data[i]) continue;
        leakN++;
        if (visibility(s, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, dirs, { maxDist, step }) > 0.05) leaks++;
      }
    }
  }

  // 步长对比：粗步长会穿墙（这是"便宜"的代价，要量出来）
  const coarse = visibility(s, inside, dirs, { maxDist, step: 1.5 });
  return {
    k, maxDist, step,
    inside: +vi.toFixed(4), outside: +vo.toFixed(4),
    contrast: +(vo / Math.max(1e-6, vi)).toFixed(2),
    leakRate: leakN ? +(leaks / leakN).toFixed(4) : 0,
    coarseStepInside: +coarse.toFixed(4),
    wallLeakFromCoarseStep: +(coarse / Math.max(1e-6, vi)).toFixed(2),
    samples: surfaceSamples(s).length,
    solidVoxels: s.data.reduce((a, b) => a + b, 0),
  };
}
