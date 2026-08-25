// =====================================================================
//  K3 · Townscaper 式动态体素 AO —— 纯逻辑核心（不 import three，可 Node 单测）
//
//  坐标约定（world ↔ voxel ↔ slice-atlas）：
//  - world：世界坐标（浮点）。体积原点 origin = 体素 (0,0,0) 的最小角世界坐标。
//  - voxel：整数体素坐标 (x,y,z)；体素中心世界坐标 = origin + (v + 0.5) * voxelSize。
//    grid 连续坐标 g = (p - origin)/voxelSize - 0.5（整数点 = 体素中心，供三线性插值）。
//  - slice-atlas：2D 图集宽 = nx、高 = ny*nz；z 切片占行区间 [z*ny, (z+1)*ny)。
//    线性索引 idx = (z*ny + y)*nx + x —— occupancy / ao / atlas 共用同一排布，
//    因此 ao 数组本体即图集数据，且一段连续 z 切片 = 一段连续内存（局部上传友好）。
//  边界行为：越界体素视为空（天空）；着色器在边缘 fadeVoxels 内淡出到无 AO，
//    避免体积边缘出现切片接缝/硬切。
//
//  确定性：栅格化与 AO 采样方向/顺序全部固定（6 轴 ±X±Y±Z 依次、半径 R 步进），
//  同一份 occupancy 必生成一致的 atlas hash（FNV-1a）。
// =====================================================================

export const VOXEL_AO_VERSION = "voxel-ao-v1";

// AO 采样方向：固定 6 轴、固定顺序（确定性要求）
export const AO_DIRS = Object.freeze([
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]);

// ---------------------------------------------------------------------
//  体积范围拟合：世界包围盒 → 外扩 → 量化 origin → 体素数封顶
// ---------------------------------------------------------------------

/**
 * @param {[number,number,number]} min 世界包围盒最小角
 * @param {[number,number,number]} max 世界包围盒最大角
 * @param {object} opts { voxelSize=0.5, expandRatio=0.2, padVoxels=8,
 *                        maxDim=192, maxAtlasHeight=7800 }
 * @returns {{ origin:number[], dims:number[], voxelSize:number }}
 */
export function fitVolumeRegion(min, max, opts = {}) {
  let voxelSize = opts.voxelSize ?? 0.5;
  const expandRatio = opts.expandRatio ?? 0.2;
  const padVoxels = opts.padVoxels ?? 8; // ≥ AO 半径，边缘 AO 才不被截断
  const maxDim = opts.maxDim ?? 192;
  const maxAtlasHeight = opts.maxAtlasHeight ?? 7800; // 留余量给 8192 纹理上限

  for (let attempt = 0; attempt < 6; attempt++) {
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const pad = padVoxels * voxelSize;
    // 各轴外扩 20%（至少 pad），origin 向下量化到体素整数倍（世界网格对齐，移动稳定）
    const origin = [0, 1, 2].map((a) => {
      const e = Math.max(size[a] * expandRatio * 0.5, pad);
      return Math.floor((min[a] - e) / voxelSize) * voxelSize;
    });
    const dims = [0, 1, 2].map((a) => {
      const e = Math.max(size[a] * expandRatio * 0.5, pad);
      const top = Math.ceil((max[a] + e) / voxelSize) * voxelSize;
      return Math.max(1, Math.round((top - origin[a]) / voxelSize));
    });
    const tooBig =
      dims.some((d) => d > maxDim) || dims[1] * dims[2] > maxAtlasHeight;
    if (!tooBig) return { origin, dims, voxelSize };
    voxelSize *= 1.5; // 超上限：体素变粗重试（垂直样片优先保住 0.5）
  }
  // 兜底：以最后一次尝试为准（调用方负责接受更粗的体素）
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const pad = padVoxels * voxelSize;
  const origin = [0, 1, 2].map((a) =>
    Math.floor((min[a] - Math.max(size[a] * expandRatio * 0.5, pad)) / voxelSize) * voxelSize
  );
  const dims = [0, 1, 2].map((a) =>
    Math.max(1, Math.ceil((size[a] + 2 * pad) / voxelSize))
  );
  return { origin, dims, voxelSize };
}

// ---------------------------------------------------------------------
//  体素体积
// ---------------------------------------------------------------------

export function createVoxelVolume({ origin, dims, voxelSize }) {
  const [nx, ny, nz] = dims;
  const count = nx * ny * nz;
  const volume = {
    origin: [...origin],
    dims: [nx, ny, nz],
    voxelSize,
    occupancy: new Uint8Array(count), // 1=实心 0=空
    ao: new Uint8Array(count), // 0..255 遮蔽度（0=全开敞；ao 数组即 slice-atlas 数据）
    solidVoxels: 0,
  };

  /** 线性索引（= 图集像素序：x 列、(z*ny+y) 行） */
  volume.index = (x, y, z) => (z * ny + y) * nx + x;
  volume.inBounds = (x, y, z) =>
    x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz;

  /** 世界坐标 → 包含它的体素整数坐标 */
  volume.worldToVoxel = (px, py, pz) => [
    Math.floor((px - origin[0]) / voxelSize),
    Math.floor((py - origin[1]) / voxelSize),
    Math.floor((pz - origin[2]) / voxelSize),
  ];

  /** 世界坐标 → grid 连续坐标（整数点 = 体素中心，三线性插值用） */
  volume.worldToGrid = (px, py, pz) => [
    (px - origin[0]) / voxelSize - 0.5,
    (py - origin[1]) / voxelSize - 0.5,
    (pz - origin[2]) / voxelSize - 0.5,
  ];

  /** 体素中心 → 世界坐标 */
  volume.voxelCenterToWorld = (x, y, z) => [
    origin[0] + (x + 0.5) * voxelSize,
    origin[1] + (y + 0.5) * voxelSize,
    origin[2] + (z + 0.5) * voxelSize,
  ];

  /** 世界包围盒 → 体素范围（clamp 到体积内）；不相交返回 null */
  volume.worldBoxToVoxelRange = (min, max) => {
    const lo = volume.worldToVoxel(min[0], min[1], min[2]);
    const hi = volume.worldToVoxel(max[0], max[1], max[2]);
    const r = {
      min: [0, 1, 2].map((a) => Math.max(0, lo[a])),
      max: [0, 1, 2].map((a) => Math.min(dims[a] - 1, hi[a])),
    };
    if (r.min.some((v, a) => v > r.max[a])) return null;
    return r;
  };

  /**
   * CPU 侧 AO 三线性采样（调试探针 / 单测用；与着色器同一约定）。
   * g 为 grid 连续坐标（见 worldToGrid）；越界 clamp 到边缘体素。
   */
  volume.sampleAo = (gx, gy, gz) => {
    const bx = Math.floor(gx);
    const by = Math.floor(gy);
    const bz = Math.floor(gz);
    const fx = gx - bx;
    const fy = gy - by;
    const fz = gz - bz;
    const cx = (v) => Math.min(nx - 1, Math.max(0, v));
    const cy = (v) => Math.min(ny - 1, Math.max(0, v));
    const cz = (v) => Math.min(nz - 1, Math.max(0, v));
    const f = (x, y, z) => volume.ao[volume.index(cx(x), cy(y), cz(z))] / 255;
    const c00 = f(bx, by, bz) * (1 - fx) + f(bx + 1, by, bz) * fx;
    const c10 = f(bx, by + 1, bz) * (1 - fx) + f(bx + 1, by + 1, bz) * fx;
    const c01 = f(bx, by, bz + 1) * (1 - fx) + f(bx + 1, by, bz + 1) * fx;
    const c11 = f(bx, by + 1, bz + 1) * (1 - fx) + f(bx + 1, by + 1, bz + 1) * fx;
    const c0 = c00 * (1 - fy) + c10 * fy;
    const c1 = c01 * (1 - fy) + c11 * fy;
    return c0 * (1 - fz) + c1 * fz;
  };

  return volume;
}

// ---------------------------------------------------------------------
//  三角形-AABB 相交（Akenine-Möller SAT；低模场景足够，门洞自然留空）
// ---------------------------------------------------------------------

/** 以 (cx,cy,cz) 为中心、半长 h 的 AABB 与三角形 (v0,v1,v2) 是否相交 */
export function triBoxOverlap(cx, cy, cz, h, v0, v1, v2) {
  // 平移到盒心为原点
  const a0 = v0[0] - cx, a1 = v0[1] - cy, a2 = v0[2] - cz;
  const b0 = v1[0] - cx, b1 = v1[1] - cy, b2 = v1[2] - cz;
  const c0 = v2[0] - cx, c1 = v2[1] - cy, c2 = v2[2] - cz;

  // 9 个边叉积轴（分离轴测试）
  const e0 = [b0 - a0, b1 - a1, b2 - a2];
  const e1 = [c0 - b0, c1 - b1, c2 - b2];
  const e2 = [a0 - c0, a1 - c1, a2 - c2];
  const axes = [
    // e0 × {X,Y,Z}
    [0, -e0[2], e0[1]], [e0[2], 0, -e0[0]], [-e0[1], e0[0], 0],
    // e1 × {X,Y,Z}
    [0, -e1[2], e1[1]], [e1[2], 0, -e1[0]], [-e1[1], e1[0], 0],
    // e2 × {X,Y,Z}
    [0, -e2[2], e2[1]], [e2[2], 0, -e2[0]], [-e2[1], e2[0], 0],
  ];
  for (let i = 0; i < 9; i++) {
    const ax = axes[i];
    const p0 = a0 * ax[0] + a1 * ax[1] + a2 * ax[2];
    const p1 = b0 * ax[0] + b1 * ax[1] + b2 * ax[2];
    const p2 = c0 * ax[0] + c1 * ax[1] + c2 * ax[2];
    const mn = Math.min(p0, p1, p2);
    const mx = Math.max(p0, p1, p2);
    const r = h * (Math.abs(ax[0]) + Math.abs(ax[1]) + Math.abs(ax[2]));
    if (mn > r || mx < -r) return false;
  }

  // 3 个坐标轴（三角形顶点投影区间 vs 盒半长）
  for (let a = 0; a < 3; a++) {
    const q0 = a === 0 ? a0 : a === 1 ? a1 : a2;
    const q1 = a === 0 ? b0 : a === 1 ? b1 : b2;
    const q2 = a === 0 ? c0 : a === 1 ? c1 : c2;
    if (Math.min(q0, q1, q2) > h || Math.max(q0, q1, q2) < -h) return false;
  }

  // 三角形平面：平面法线与盒的相交测试
  const nx = e0[1] * e1[2] - e0[2] * e1[1];
  const ny = e0[2] * e1[0] - e0[0] * e1[2];
  const nz = e0[0] * e1[1] - e0[1] * e1[0];
  const d = -(nx * a0 + ny * a1 + nz * a2);
  const r = h * (Math.abs(nx) + Math.abs(ny) + Math.abs(nz));
  if (Math.abs(d) > r) return false;
  return true;
}

/**
 * 栅格化：把世界空间三角形写入 occupancy。
 * @param {object} volume createVoxelVolume 产物
 * @param {Float32Array|number[]} positions 世界坐标三角形顶点（xyz 连续，每 9 个数一个三角形）
 * @param {object} opts { zRange?: [z0,z1] 只写这些切片（dirty 局部重栅格）；append?: 不清除目标区；
 *                        triIndices?: Int32Array 只处理这些三角形（z 切片预分桶） }
 * @returns {number} 实际参与测试的三角形数
 */
export function rasterizeTriangles(volume, positions, opts = {}) {
  const { dims, voxelSize, origin } = volume;
  const [nx, ny, nz] = dims;
  const half = voxelSize * 0.5;
  const z0 = opts.zRange ? opts.zRange[0] : 0;
  const z1 = opts.zRange ? opts.zRange[1] : nz - 1;

  // 目标切片先清零（除非 append）
  if (!opts.append) {
    const rowStart = z0 * ny * nx;
    const rowEnd = (z1 + 1) * ny * nx;
    volume.occupancy.fill(0, rowStart, rowEnd);
  }

  let tested = 0;
  const v0 = [0, 0, 0], v1 = [0, 0, 0], v2 = [0, 0, 0];
  const triCount = opts.triIndices
    ? opts.triIndices.length
    : Math.floor(positions.length / 9);
  for (let t = 0; t < triCount; t++) {
    const o = (opts.triIndices ? opts.triIndices[t] : t) * 9;
    for (let k = 0; k < 3; k++) {
      v0[k] = positions[o + k];
      v1[k] = positions[o + 3 + k];
      v2[k] = positions[o + 6 + k];
    }
    // 世界 AABB → 体素候选范围（clamp 到目标切片）。
    // lo 用 ceil-1 而非 floor：wmin 恰落在体素边界时，相邻体素的封闭盒也与三角形相触。
    const wmin = [Math.min(v0[0], v1[0], v2[0]), Math.min(v0[1], v1[1], v2[1]), Math.min(v0[2], v1[2], v2[2])];
    const wmax = [Math.max(v0[0], v1[0], v2[0]), Math.max(v0[1], v1[1], v2[1]), Math.max(v0[2], v1[2], v2[2])];
    const lo = [0, 1, 2].map((a) => Math.ceil((wmin[a] - origin[a]) / voxelSize) - 1);
    const hi = volume.worldToVoxel(wmax[0], wmax[1], wmax[2]);
    const x0 = Math.max(0, lo[0]), x1 = Math.min(nx - 1, hi[0]);
    const y0 = Math.max(0, lo[1]), y1 = Math.min(ny - 1, hi[1]);
    const zz0 = Math.max(z0, lo[2]), zz1 = Math.min(z1, hi[2]);
    if (x0 > x1 || y0 > y1 || zz0 > zz1) continue;
    tested++;
    for (let z = zz0; z <= zz1; z++) {
      const cz = origin[2] + (z + 0.5) * voxelSize;
      for (let y = y0; y <= y1; y++) {
        const cy = origin[1] + (y + 0.5) * voxelSize;
        for (let x = x0; x <= x1; x++) {
          const cx = origin[0] + (x + 0.5) * voxelSize;
          if (triBoxOverlap(cx, cy, cz, half, v0, v1, v2)) {
            volume.occupancy[volume.index(x, y, z)] = 1;
          }
        }
      }
    }
  }
  return tested;
}

/** 重新统计实心体素数（调试信息用） */
export function countSolidVoxels(volume) {
  let n = 0;
  const occ = volume.occupancy;
  for (let i = 0; i < occ.length; i++) if (occ[i]) n++;
  volume.solidVoxels = n;
  return n;
}

// ---------------------------------------------------------------------
//  scalar AO：固定 6 轴方向 × 半径 R 步进（确定性）
//  occ_dir = (R - s + 1)/R（s = 命中步数，未命中 = 0）；体素遮蔽 = 6 方向均值
// ---------------------------------------------------------------------

export function computeScalarAo(volume, opts = {}) {
  const R = opts.radius ?? 4;
  const [nx, ny, nz] = volume.dims;
  const z0 = opts.zRange ? Math.max(0, opts.zRange[0]) : 0;
  const z1 = opts.zRange ? Math.min(nz - 1, opts.zRange[1]) : nz - 1;
  // yRange：分帧预算把单切片再按 y 行块细分（每体素只依赖 occupancy，块边界不影响结果）
  const y0 = opts.yRange ? Math.max(0, opts.yRange[0]) : 0;
  const y1 = opts.yRange ? Math.min(ny - 1, opts.yRange[1]) : ny - 1;
  const { occupancy, ao } = volume;
  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < nx; x++) {
        let sum = 0;
        for (let d = 0; d < 6; d++) {
          const dir = AO_DIRS[d];
          for (let s = 1; s <= R; s++) {
            const px = x + dir[0] * s;
            const py = y + dir[1] * s;
            const pz = z + dir[2] * s;
            // 越界 = 天空（开敞），不遮蔽
            if (px < 0 || py < 0 || pz < 0 || px >= nx || py >= ny || pz >= nz) break;
            if (occupancy[(pz * ny + py) * nx + px]) {
              sum += (R - s + 1) / R;
              break;
            }
          }
        }
        ao[(z * ny + y) * nx + x] = Math.round((sum / 6) * 255);
      }
    }
  }
}

// ---------------------------------------------------------------------
//  FNV-1a hash（确定性校验：同 occupancy 必得同 atlas hash）
// ---------------------------------------------------------------------

export function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** occupancy + ao 的复合 hash（atlas 一致性断言用） */
export function hashVolume(volume) {
  return `${fnv1a(volume.occupancy)}-${fnv1a(volume.ao)}`;
}

// ---------------------------------------------------------------------
//  dirty region：合并（并集）+ 扩 kernel 半径 + 供分帧调度的 z 切片任务
// ---------------------------------------------------------------------

export function createDirtyTracker(opts = {}) {
  const expand = opts.expand ?? 4; // AO kernel 半径：AO 依赖 R 邻域，需外扩重算
  let pending = null; // { min:[x,y,z], max:[x,y,z] }（体素坐标，含）

  function merge(range) {
    if (!pending) {
      pending = range;
      return;
    }
    for (let a = 0; a < 3; a++) {
      pending.min[a] = Math.min(pending.min[a], range.min[a]);
      pending.max[a] = Math.max(pending.max[a], range.max[a]);
    }
  }

  return {
    /** 体素范围标记（自动 clamp + 外扩 expand + 与既有 pending 合并） */
    markVoxelRange(volume, min, max) {
      const dims = volume.dims;
      const r = {
        min: [0, 1, 2].map((a) => Math.max(0, min[a] - expand)),
        max: [0, 1, 2].map((a) => Math.min(dims[a] - 1, max[a] + expand)),
      };
      if (r.min.some((v, a) => v > r.max[a])) return false;
      merge(r);
      return true;
    },

    /** 世界包围盒标记（与体积求交；null = 整个体积） */
    markWorldRange(volume, min, max) {
      if (!min || !max) {
        merge({
          min: [0, 0, 0],
          max: volume.dims.map((d) => d - 1),
        });
        return true;
      }
      const r = volume.worldBoxToVoxelRange(min, max);
      if (!r) return false; // 与体积不相交
      return this.markVoxelRange(volume, r.min, r.max);
    },

    /** 取出并清空 pending（交给调度器） */
    consume() {
      const r = pending;
      pending = null;
      return r;
    },
    peek: () => pending,
    isEmpty: () => pending === null,
  };
}

// ---------------------------------------------------------------------
//  分帧预算执行：任一主线程任务片 ≤ budgetMs（now 可注入，便于单测）
// ---------------------------------------------------------------------

/**
 * @param {object} job { tasks: any[], cursor: number }
 * @param {(task:any)=>void} fn 处理单个任务（一个 z 切片）
 * @param {object} opts { budgetMs=4, now=()=>performance.now() 或 Date.now }
 * @returns {{ done:boolean, processed:number, elapsedMs:number, maxTaskMs:number }}
 */
export function runBudgeted(job, fn, opts = {}) {
  const budgetMs = opts.budgetMs ?? 4;
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  let processed = 0;
  let maxTaskMs = 0;
  while (job.cursor < job.tasks.length) {
    // 至少执行一个任务，避免预算过小时饿死
    if (processed > 0 && now() - t0 >= budgetMs) break;
    const s0 = now();
    fn(job.tasks[job.cursor]);
    const s1 = now();
    maxTaskMs = Math.max(maxTaskMs, s1 - s0);
    job.cursor++;
    processed++;
  }
  return {
    done: job.cursor >= job.tasks.length,
    processed,
    elapsedMs: now() - t0,
    maxTaskMs,
  };
}
