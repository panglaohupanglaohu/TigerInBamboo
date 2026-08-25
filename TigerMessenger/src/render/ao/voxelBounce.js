// =====================================================================
//  K5 · 高画质单次色彩反弹 —— 纯数据核心（不 import three，可 Node 单测）
//
//  范围与诚实声明：
//  - 本文件只产出体素 radiance 数据与门控决策；**采样侧（shader 注入 /
//    材质染色 uniform）尚未接线**，GPU 集成不在本任务内。
//  - 坐标系完全复用 voxelVolume：bounce 网格挂在 createVoxelVolume 产物上，
//    origin / dims / voxelSize / index / occupancy 全部共享，不建立第二套
//    世界坐标。dirty 调度复用 voxelVolume 的 createDirtyTracker：同一个
//    region 同时喂给 computeScalarAo 与 computeVoxelBounce（二者都接受
//    zRange / yRange）。
//
//  模型（刻意保守，绝不做无界迭代 / 实时路径追踪）：
//  1. 注入：太阳直射（direction = 指向太阳的世界方向，同 lightingTheme
//     sunDir 约定）照到的实心格，把能量按面朝向 dot(faceN, toSun) 注入相邻
//     空格；少量大面积 emissive 盒直接向盒内空格注入。实心格恒不存能量，
//     只充当反射面。
//  2. 单次反弹：恰好一轮固定六邻域传播——从快照读、向结果写，无反馈回路，
//     无收敛循环；每面 transferPerFace=0.1，总转出 6×0.1=0.6 < 1，能量
//     单调有界。注意：propagate 跨行读快照，同一 dirty region 每帧只应整段
//     传播一次（zRange 交给调度器，yRange 不再细分传播）。
//  3. clamp：每通道 ≤ maxVoxelEnergy（= BOUNCE_LIMITS.maxIntensity），
//     染色 mix ≤ maxTintMix（= BOUNCE_LIMITS.maxMix）——对士兵皮肤 / 盾牌 /
//     敌我识别色的染色量有硬上限。
// =====================================================================

import { AO_DIRS } from "./voxelVolume.js";
import { BOUNCE_LIMITS } from "../lighting/lightingBounce.js";
import { resolveLightingQuality } from "../lighting/lightingQuality.js";

export const VOXEL_BOUNCE_VERSION = "voxel-bounce-v1";

// 能量上限复用 BOUNCE_LIMITS 量级：radiance 单通道硬顶 = bounce 强度上限，
// 染色混合比硬顶 = bounce mix 上限。识别色保护由这两个常数保证。
export const BOUNCE_ENERGY_LIMITS = Object.freeze({
  maxVoxelEnergy: BOUNCE_LIMITS.maxIntensity, // 0.18 / 通道
  maxTintMix: BOUNCE_LIMITS.maxMix, // 0.35
  sunInjectScale: 0.12, // 太阳强度 1.5 → 0.18，恰好在 clamp 量级
  emissiveInjectScale: 0.12,
  transferPerFace: 0.1, // 六邻域每面转出 10%，总量 0.6 < 1（衰减）
});

// GPU 预算门槛：与 K7 达标线「V5 光照 GPU 增量 ≤ 2ms」同量级
export const BOUNCE_GPU_BUDGET_MS = 2.0;

export const BOUNCE_GATE_CODES = Object.freeze([
  "context-lost",
  "atlas-failed",
  "quality-tier",
  "flag-off",
  "no-capability",
  "over-budget",
  "enabled",
]);

// ---------------------------------------------------------------------
//  小工具
// ---------------------------------------------------------------------

function hexToRgb01(hex) {
  const s = String(hex ?? "#FFFFFF").replace(/^#/, "");
  const c = (i) => {
    const v = parseInt(s.slice(i, i + 2), 16);
    return Number.isFinite(v) ? v / 255 : 0;
  };
  return [c(0), c(2), c(4)];
}

function rgb01ToHex([r, g, b]) {
  const c = (v) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

// 与 computeScalarAo 同约定：zRange 限切片、yRange 限行块、x 恒全宽
function resolveRange(volume, opts = {}) {
  const [nx, ny, nz] = volume.dims;
  return {
    x0: 0,
    x1: nx - 1,
    y0: opts.yRange ? Math.max(0, opts.yRange[0]) : 0,
    y1: opts.yRange ? Math.min(ny - 1, opts.yRange[1]) : ny - 1,
    z0: opts.zRange ? Math.max(0, opts.zRange[0]) : 0,
    z1: opts.zRange ? Math.min(nz - 1, opts.zRange[1]) : nz - 1,
  };
}

function clampChannel(v) {
  const m = BOUNCE_ENERGY_LIMITS.maxVoxelEnergy;
  return v > m ? m : v;
}

// ---------------------------------------------------------------------
//  bounce 网格：挂在既有 voxelVolume 上（共享 occupancy / 坐标换算）
// ---------------------------------------------------------------------

/**
 * @param {object} volume createVoxelVolume 产物（AO 同一份体素体积）
 * @returns bounce 网格 { volume, dims, radiance, scratch }
 *   radiance: Float32Array(nx*ny*nz*3)，线性排布 = volume.index*3（与 atlas
 *   同序）；只有空格存能量，实心格恒为 0。scratch 为传播快照缓冲。
 */
export function createBounceGrid(volume) {
  const [nx, ny, nz] = volume.dims;
  const count = nx * ny * nz;
  return {
    version: VOXEL_BOUNCE_VERSION,
    volume, // 复用 AO 体积：origin/dims/voxelSize/occupancy 同源
    dims: volume.dims, // 同一引用，不可能与 AO 漂移
    radiance: new Float32Array(count * 3),
    scratch: new Float32Array(count * 3),
  };
}

/** 读单格 radiance（越界 / 实心 → [0,0,0]） */
export function getBounceVoxel(grid, x, y, z) {
  const { volume, radiance } = grid;
  if (!volume.inBounds(x, y, z)) return [0, 0, 0];
  const idx = volume.index(x, y, z);
  if (volume.occupancy[idx]) return [0, 0, 0];
  const o = idx * 3;
  return [radiance[o], radiance[o + 1], radiance[o + 2]];
}

// ---------------------------------------------------------------------
//  能量注入（写入 radiance，逐格 clamp）
// ---------------------------------------------------------------------

/**
 * 太阳直射注入：遍历范围内空格，对每个六邻域方向，若该方向反侧邻居为实心
 * 且面朝太阳（dot(faceNormal, toSun) > 0），向本格注入 sun 色能量。
 * 固定 AO_DIRS 顺序、无随机数 → 确定性。
 * @returns {number} 获得能量的体素数
 */
export function injectSunEnergy(grid, sun, opts = {}) {
  const { volume, radiance } = grid;
  const range = resolveRange(volume, opts);
  const dir = sun?.direction;
  const intensity = Math.max(0, Number(sun?.intensity) || 0);
  if (!dir || intensity <= 0) return 0;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 0)) return 0;
  const toSun = [dir[0] / len, dir[1] / len, dir[2] / len]; // 指向太阳
  const col = hexToRgb01(sun.color);
  const base = intensity * BOUNCE_ENERGY_LIMITS.sunInjectScale;
  let injected = 0;
  for (let z = range.z0; z <= range.z1; z++) {
    for (let y = range.y0; y <= range.y1; y++) {
      for (let x = range.x0; x <= range.x1; x++) {
        const idx = volume.index(x, y, z);
        if (volume.occupancy[idx]) continue; // 实心格不存能量
        let r = 0;
        let g = 0;
        let b = 0;
        for (let d = 0; d < 6; d++) {
          const dv = AO_DIRS[d];
          const sx = x - dv[0];
          const sy = y - dv[1];
          const sz = z - dv[2];
          if (!volume.inBounds(sx, sy, sz)) continue;
          if (!volume.occupancy[volume.index(sx, sy, sz)]) continue;
          // 面法线 = dv（由实心邻居指向本格）；面朝太阳才受光
          const facing = dv[0] * toSun[0] + dv[1] * toSun[1] + dv[2] * toSun[2];
          if (facing <= 0) continue;
          const e = base * facing;
          r += col[0] * e;
          g += col[1] * e;
          b += col[2] * e;
        }
        if (r > 0 || g > 0 || b > 0) {
          const o = idx * 3;
          radiance[o] = clampChannel(radiance[o] + r);
          radiance[o + 1] = clampChannel(radiance[o + 1] + g);
          radiance[o + 2] = clampChannel(radiance[o + 2] + b);
          injected++;
        }
      }
    }
  }
  return injected;
}

/**
 * emissive 盒注入：emissives = [{ min:[wx,wy,wz], max:[wx,wy,wz], color, intensity }]
 * 世界坐标 AABB（走 volume.worldBoxToVoxelRange，与 AO 同一坐标系）；
 * 盒内实心格跳过（不存能量）。
 * @returns {number} 获得能量的体素数
 */
export function injectEmissiveEnergy(grid, emissives, opts = {}) {
  const { volume, radiance } = grid;
  const range = resolveRange(volume, opts);
  let injected = 0;
  for (const em of emissives ?? []) {
    const e = Math.max(0, Number(em?.intensity) || 0) * BOUNCE_ENERGY_LIMITS.emissiveInjectScale;
    if (e <= 0 || !em?.min || !em?.max) continue;
    const r = volume.worldBoxToVoxelRange(em.min, em.max);
    if (!r) continue; // 与体积不相交
    const col = hexToRgb01(em.color);
    const x0 = Math.max(range.x0, r.min[0]);
    const x1 = Math.min(range.x1, r.max[0]);
    const y0 = Math.max(range.y0, r.min[1]);
    const y1 = Math.min(range.y1, r.max[1]);
    const z0 = Math.max(range.z0, r.min[2]);
    const z1 = Math.min(range.z1, r.max[2]);
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = volume.index(x, y, z);
          if (volume.occupancy[idx]) continue; // 实心格不存能量
          const o = idx * 3;
          radiance[o] = clampChannel(radiance[o] + col[0] * e);
          radiance[o + 1] = clampChannel(radiance[o + 1] + col[1] * e);
          radiance[o + 2] = clampChannel(radiance[o + 2] + col[2] * e);
          injected++;
        }
      }
    }
  }
  return injected;
}

// ---------------------------------------------------------------------
//  单次六邻域反弹（一轮，快照读 → 写出，无反馈回路）
// ---------------------------------------------------------------------

/**
 * 恰好一轮传播：out = in + Σ_6neighbors in × transferPerFace，逐格 clamp。
 * 实心格与越界邻居不贡献（越界 = 天空，能量散失）。只写范围内体素；
 * 读的是调用时刻的全网格快照——同一 dirty region 每帧整段调用一次，
 * 不要再按 yRange 细分传播（细分会读到已更新行，结果与整段不同）。
 * @returns {number} 能量发生变化的体素数
 */
export function propagateBounceOnce(grid, opts = {}) {
  const { volume, radiance, scratch } = grid;
  const range = resolveRange(volume, opts);
  const t = BOUNCE_ENERGY_LIMITS.transferPerFace;
  scratch.set(radiance); // 快照：本轮只读 scratch、只写 radiance
  let updated = 0;
  for (let z = range.z0; z <= range.z1; z++) {
    for (let y = range.y0; y <= range.y1; y++) {
      for (let x = range.x0; x <= range.x1; x++) {
        const idx = volume.index(x, y, z);
        const o = idx * 3;
        if (volume.occupancy[idx]) {
          radiance[o] = 0; // 实心格恒不存能量
          radiance[o + 1] = 0;
          radiance[o + 2] = 0;
          continue;
        }
        let r = scratch[o];
        let g = scratch[o + 1];
        let b = scratch[o + 2];
        for (let d = 0; d < 6; d++) {
          const dv = AO_DIRS[d];
          const nx2 = x + dv[0];
          const ny2 = y + dv[1];
          const nz2 = z + dv[2];
          if (!volume.inBounds(nx2, ny2, nz2)) continue; // 天空：能量散失
          const nidx = volume.index(nx2, ny2, nz2);
          if (volume.occupancy[nidx]) continue; // 实心不存能量
          const no = nidx * 3;
          r += scratch[no] * t;
          g += scratch[no + 1] * t;
          b += scratch[no + 2] * t;
        }
        r = clampChannel(r);
        g = clampChannel(g);
        b = clampChannel(b);
        if (r !== radiance[o] || g !== radiance[o + 1] || b !== radiance[o + 2]) updated++;
        radiance[o] = r;
        radiance[o + 1] = g;
        radiance[o + 2] = b;
      }
    }
  }
  return updated;
}

/**
 * 一轮完整 bounce 重算：清 range → 太阳注入 → emissive 注入 → 单次传播。
 * 与 computeScalarAo 接受同一 { zRange, yRange }，同一 dirty region 直接复用。
 */
export function computeVoxelBounce(grid, opts = {}) {
  const { volume, radiance } = grid;
  const range = resolveRange(volume, opts);
  // 清目标区（与 rasterizeTriangles 清目标切片同语义：重算从干净状态开始）
  for (let z = range.z0; z <= range.z1; z++) {
    for (let y = range.y0; y <= range.y1; y++) {
      const start = (volume.index(range.x0, y, z)) * 3;
      const end = (volume.index(range.x1, y, z) + 1) * 3;
      radiance.fill(0, start, end);
    }
  }
  const injectedSun = opts.sun ? injectSunEnergy(grid, opts.sun, opts) : 0;
  const injectedEmissive = opts.emissives ? injectEmissiveEnergy(grid, opts.emissives, opts) : 0;
  const propagated = propagateBounceOnce(grid, opts);
  return Object.freeze({
    range: Object.freeze(range),
    injectedSun,
    injectedEmissive,
    propagated,
  });
}

// ---------------------------------------------------------------------
//  克制的色彩联系：radiance → 有界染色（采样侧 shader 尚未接线，此为数据层约定）
// ---------------------------------------------------------------------

/**
 * 单格染色描述：color = radiance 归一化方向（色相），mix = 饱和度 × maxTintMix，
 * 硬顶 BOUNCE_LIMITS.maxTintMix——对白墙克制、对识别色有硬上限。
 */
export function composeBounceTint(grid, x, y, z) {
  const [r, g, b] = getBounceVoxel(grid, x, y, z);
  const peak = Math.max(r, g, b);
  if (!(peak > 0)) return Object.freeze({ color: "#FFFFFF", mix: 0 });
  const saturation = Math.min(1, peak / BOUNCE_ENERGY_LIMITS.maxVoxelEnergy);
  const mix = Math.min(BOUNCE_ENERGY_LIMITS.maxTintMix, saturation * BOUNCE_ENERGY_LIMITS.maxTintMix);
  return Object.freeze({ color: rgb01ToHex([r / peak, g / peak, b / peak]), mix });
}

/** 把 tint 应用到 albedo 色上；mix 再保险 clamp 到 maxTintMix。 */
export function applyBounceTint(baseHex, tint) {
  const base = hexToRgb01(baseHex);
  if (!tint || !(tint.mix > 0)) return rgb01ToHex(base);
  const mix = Math.min(BOUNCE_ENERGY_LIMITS.maxTintMix, Math.max(0, tint.mix));
  const t = hexToRgb01(tint.color);
  return rgb01ToHex([
    base[0] + (t[0] - base[0]) * mix,
    base[1] + (t[1] - base[1]) * mix,
    base[2] + (t[2] - base[2]) * mix,
  ]);
}

// ---------------------------------------------------------------------
//  能力门控：任一前置失败一律回退 AO-only（enabled=false + 结构化 reason）
// ---------------------------------------------------------------------

/**
 * @param {object} input
 *   { quality: "low"|"medium"|"high"（非法值按默认档解析）,
 *     flags: boolean | { voxelBounceV1: boolean },
 *     capability: 渲染侧能力探测结果（truthy = 具备）,
 *     gpuHeadroomMs: 当前 GPU 余量（缺失/非有限数按 0 处理 → 超预算）,
 *     atlasOk: AO atlas 是否分配成功（false → 失败）,
 *     contextLost: WebGL context 是否已丢失 }
 * @returns {{ enabled:boolean, reason:{ code:string, detail:string } }}
 *   检查顺序固定（确定性）：context-lost → atlas-failed → quality-tier →
 *   flag-off → no-capability → over-budget → enabled。
 */
export function evaluateBounceGate(input = {}) {
  const fail = (code, detail) =>
    Object.freeze({ enabled: false, reason: Object.freeze({ code, detail }) });

  if (input.contextLost) {
    return fail("context-lost", "WebGL context 已丢失，回退 AO-only");
  }
  if (input.atlasOk === false) {
    return fail("atlas-failed", "AO atlas 分配失败，回退 AO-only");
  }
  const tier = resolveLightingQuality(input.quality);
  if (!tier.allowsBounce) {
    return fail("quality-tier", `lightingQuality=${tier.name} 不允许 bounce（仅 high）`);
  }
  const flags = input.flags;
  const flagOn = typeof flags === "boolean" ? flags : flags?.voxelBounceV1 === true;
  if (!flagOn) {
    return fail("flag-off", "voxelBounceV1 开关未开启");
  }
  if (!input.capability) {
    return fail("no-capability", "缺少体素 bounce 所需 GPU 能力");
  }
  const headroom = Number(input.gpuHeadroomMs);
  if (!Number.isFinite(headroom) || headroom < BOUNCE_GPU_BUDGET_MS) {
    return fail(
      "over-budget",
      `GPU 余量不足：headroom=${Number.isFinite(headroom) ? headroom.toFixed(2) : "n/a"}ms < ${BOUNCE_GPU_BUDGET_MS}ms`
    );
  }
  return Object.freeze({
    enabled: true,
    reason: Object.freeze({ code: "enabled", detail: `quality=${tier.name}` }),
  });
}

/**
 * 门控原因上报器：同一 reason code 只 warn 一次（dedupe），避免刷屏。
 * warn 可注入（测试计数用），缺省 console.warn。
 * @returns {{ report(result):boolean 本次是否实际告警, seen():string[], reset():void }}
 */
export function createBounceGateReporter({ warn } = {}) {
  const log = typeof warn === "function" ? warn : (msg) => console.warn(msg);
  const seen = new Set();
  return {
    report(result) {
      if (!result || result.enabled) return false;
      const code = result.reason?.code ?? "unknown";
      if (seen.has(code)) return false;
      seen.add(code);
      log(`[voxelBounce] bounce 禁用，回退 AO-only：${code} — ${result.reason?.detail ?? ""}`);
      return true;
    },
    seen: () => [...seen],
    reset: () => seen.clear(),
  };
}
