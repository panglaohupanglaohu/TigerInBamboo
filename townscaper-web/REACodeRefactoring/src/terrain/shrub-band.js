/**
 * shrub-band.js — 第 99 轮 · 1707497006640365880 / 1707490932017279035 灌木「逐三角带宽」。
 *
 * 原文（1707490932017279035）："They are of course 100% texture, painted onto a fairly low, poly mesh."
 * 原片逐帧（600 帧片 sheet-00…05 + 257 帧片 3 张，第 84–98 轮反复量过）：
 *   · 灌木带是**沿崖边的一条着色**，宽度在同一格的不同边上明显不同 —— 落在同一栋台地上，
 *     一条边是 3–4px 的宽带（P90），紧挨着的另一条边只有 2–3px 的发丝（P50），比值约 1.5–1.9×；
 *   · 这种「一段一段的宽窄」**沿一条边是常数**（低模块面贴图，不是逐像素噪声）：在 4× 裁切上，
 *     一条边的外沿是同一个值，走到下一个三角才换档 —— 所以它不是平滑噪声能做出来的。
 *
 * 旧实现只有两级来源：① 每格每边按落差四档缩放（terrainmesh 的 `centreFor`）② 着色器里
 *   `bfbm(w.xz*1.1)` 那条**平滑**低频噪声。两者都给不出「同落差的两条边宽度差 1.5×，且各自沿边恒定」。
 *
 * 这里补第三级：**每个顶面三角一个带宽倍率**（同一格的第 i 条边 = 第 i 个三角），由
 *   hash(格 id, 边号, 层号) 决定 —— 确定性、可复现、不依赖噪声频率。
 * 写进顶点属性 aBand（三个顶点同值 → 插值后沿三角恒定），着色器 `width *= vBand`。
 *
 * 标定区间：原片 P50 2–3px / P90 3–4px → 倍率跨度取 0.70–1.36（=1.94×，覆盖实测 1.5–1.9× 的上沿）。
 * 不开时不写属性（aBand=1），画面与旧版逐位相同；`world.shrubBandPerEdge = false` 可显式关掉做对照。
 */
import { hash01 } from '../core/noise.js';

export const SHRUB_BAND = Object.freeze({ min: 0.70, max: 1.36, seed: 0x5b17 });

/** 同一格第 i 条边（= 第 i 个顶面三角）的带宽倍率。确定性：同 (格, 边, 层) 永远同值。 */
export function shrubBandMul(cellId, edge, level, cfg = SHRUB_BAND) {
  const key = (Math.imul(cellId | 0, 131) ^ Math.imul(edge | 0, 7919) ^ Math.imul(level | 0, 104729)) ^ cfg.seed;
  return cfg.min + (cfg.max - cfg.min) * hash01(key);
}

/** 倍率跨度（测试断言用）：同落差两条边的最大宽度比。 */
export const SHRUB_BAND_SPREAD = SHRUB_BAND.max / SHRUB_BAND.min;
