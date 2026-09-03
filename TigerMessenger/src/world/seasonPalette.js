// =====================================================================
// 季相色板：构建期使用，运行时不改 —— 逐帧成本为 0。
//
// 刻意不 import three：色彩运算是纯数值，保持本文件为纯数据层，
// 既可在 Node 单测，也不阻碍将来整体移进 procgen/。
// 色彩在 sRGB 分量空间插值，与仓库里其它色板一律用 hex 字面量的写法一致。
// =====================================================================

import { seasonAtLatitude, latitudeOf } from "./seasonBands.js";

export const SEASON_PALETTE_SCHEMA_VERSION = 1;

export const SEASON_PALETTE = Object.freeze({
  winter: Object.freeze({ foliage: 0xb9c7c9, ground: 0x8fa39b, tintStrength: 0.72 }),
  autumn: Object.freeze({ foliage: 0xd08a3c, ground: 0x9a8552, tintStrength: 0.62 }),
  summer: Object.freeze({ foliage: 0x5f9e5c, ground: 0x6d8f65, tintStrength: 0.3 }),
  spring: Object.freeze({ foliage: 0x8fc46a, ground: 0x7fa86a, tintStrength: 0.45 }),
});

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function lerpHex(aHex, bHex, t) {
  const k = Math.max(0, Math.min(1, t));
  const ar = (aHex >> 16) & 0xff;
  const ag = (aHex >> 8) & 0xff;
  const ab = aHex & 0xff;
  const br = (bHex >> 16) & 0xff;
  const bg = (bHex >> 8) & 0xff;
  const bb = bHex & 0xff;
  return (
    (clamp255(ar + (br - ar) * k) << 16) |
    (clamp255(ag + (bg - ag) * k) << 8) |
    clamp255(ab + (bb - ab) * k)
  );
}

/**
 * 把基色按该位置的季相染色。构建期调用一次，结果烘进材质。
 * @param {number} baseHex 原始色（中性/夏季色）
 * @param {{x:number,y:number,z:number}|null} pos 物体【自己的】世界坐标，不是玩家的
 * @param {"foliage"|"ground"} channel
 * @returns {number} 染色后 hex；pos 为空时原样返回 baseHex
 */
export function seasonTint(baseHex, pos, channel = "foliage") {
  if (!pos) return baseHex;
  const { name, next, blend } = seasonAtLatitude(latitudeOf(pos));
  const cur = SEASON_PALETTE[name];
  const nxt = SEASON_PALETTE[next];
  if (!cur || !nxt) return baseHex;
  const target = blend > 0.001 ? lerpHex(cur[channel], nxt[channel], blend) : cur[channel];
  const strength = cur.tintStrength * (1 - blend) + nxt.tintStrength * blend;
  return lerpHex(baseHex, target, strength);
}

/**
 * 把染色结果量化到 step 级，让邻近区块落到同一个 hex —— 这样 C3 的材质缓存
 * 才能继续共享材质，季相不会把 draw call 顶上去。
 */
export function quantizeHex(hex, step = 16) {
  const q = (v) => clamp255(Math.round(v / step) * step);
  return (q((hex >> 16) & 0xff) << 16) | (q((hex >> 8) & 0xff) << 8) | q(hex & 0xff);
}
