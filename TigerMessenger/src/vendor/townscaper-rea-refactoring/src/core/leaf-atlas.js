/**
 * 1241046107125399552「I moved my plants to a 32² corner on the 128² texture I'm
 * using for everything else」— 植物搬进全城共用 128² 图集的右下 32² 角落。
 *
 * 布局与叶纹的唯一来源是 core/town-skin.js（全城 TownColor 图集）：
 *   PLANT_RECT = {x:96,y:96,w:32,h:32} —— 右下 32² 角，与原版裁判一致
 *   （REACode src/texelsnap.js bakeAtlas：x0 = y0 = size − corner = 96）。
 * 叶纹是本地程序化近似，不是原作手绘素材；角外 alpha 保持 0，本模块不画其余
 * 60 个色格。原作植物素材与更多植物种类仍待迁移（见 learn 条目卡点）。
 *
 * sharedLeafAtlas() 是全场景共享单例：整个进程一份图集数据，所有
 * Vegetation 实例 / 灌木 / 树冠共用（见 life/leaf-surface.js 的纹理单例）。
 */
import { SKIN_SIZE, PLANT_RECT, writePlantCorner } from './town-skin.js';
import { skipTexel } from './texel-skip.js';

/** 图集尺寸 / 植物保留区（与 town-skin.js 同一份常量，防止两处布局漂移）。 */
export const LEAF_ATLAS_SIZE = SKIN_SIZE;
export const LEAF_CORNER = PLANT_RECT;

/** 建独立叶图集：128² RGBA，只有右下 32² 植物角被写入（其余槽位 alpha = 0）。 */
export function buildLeafAtlas() {
  const data = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  writePlantCorner(data, SKIN_SIZE);
  return { size: SKIN_SIZE, rect: { ...PLANT_RECT }, data };
}

/** 全场景共享单例：返回同一对象，调用方不得改 data。 */
let shared = null;
export function sharedLeafAtlas() {
  if (!shared) shared = buildLeafAtlas();
  return shared;
}

/**
 * 球面方向 → 32² 角内 uv（u,v ∈ [0,1]）。
 * 经度绕物体系数坐标，镜头 / 实例移动时贴图不游走。
 */
export function sphereLeafUV(x, y, z) {
  const l = Math.hypot(x, y, z); if (!Number.isFinite(l) || l === 0) throw new RangeError('finite nonzero direction required');
  return [.5 + Math.atan2(z, x) / (2 * Math.PI), .5 + Math.asin(Math.max(-1, Math.min(1, y / l))) / Math.PI];
}

/** 双线性取图集像素（texel 中心在整数 + 0.5，与 GLSL LinearFilter 同口径）。 */
function bilinear(data, size, x, y) {
  const fx = x - .5, fy = y - .5;
  const x0 = Math.max(0, Math.min(size - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(size - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
  const at = (xx, yy) => data[((yy * size + xx) * 4)];
  return at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty) + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
}

/**
 * leafPattern GLSL 的 CPU 镜像：u,v ∈ [0,1]（角内）→ 0..1。
 * 连续 texel 采样：skipTexel 是分段连续的 UV 重映射（每 2 texel 一条线），
 * 采样坐标不取整、走双线性，不是最近邻点采样；导数 fw 大时淡出到 .5。
 */
export function leafPatternCPU(data, u, v, fw = 1) {
  const fwx = Array.isArray(fw) ? fw[0] : fw, fwy = Array.isArray(fw) ? fw[1] : fw;
  const W = PLANT_RECT.w, L = PLANT_RECT.w - .5;
  const qx = Math.min(L, Math.max(.5, skipTexel(u * W, fwx)));
  const qy = Math.min(L, Math.max(.5, skipTexel(v * W, fwy)));
  const value = bilinear(data, SKIN_SIZE, PLANT_RECT.x + qx, PLANT_RECT.y + qy) / 255;
  const t = Math.max(0, Math.min(1, Math.max(fwx, fwy) - 1));   // smoothstep(1,2,fw)
  return value + (.5 - value) * t * t * (3 - 2 * t);
}
