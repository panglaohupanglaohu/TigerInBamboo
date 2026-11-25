/**
 * town-visual.js — 1197909675443916803 那条帖子的可量化参数（裁判对照表 + 纯函数审计）。
 *
 * 原帖（2019-11-22）："Turns out my monitor was too saturated, making me make my
 * colors too dull. This should be better. I've also added some building effects,
 * grass in the gardens, and colored "bounce" "lighting"."
 *   · 饱和度纠偏方向 = 更艳（显示器过饱和 → 颜色调得过灰 → 往回拉）。
 *   · grass in the gardens = 围合的院子整体变草地。
 *   · colored "bounce" "lighting" = 彩色反弹（邻居颜色染到暗部）。
 *
 * 裁判（只读 townscaper-web/REACode）逐项出处：
 *   · src/townmesh.js `STYLE`：roof '#e07a52' / roofAlt '#d96f4a' / roofTrim '#8a3a32'
 *     / lawn '#6f9a5e' / lawnAlt '#679357' / path '#a49c8a' —— core/palette.js 的
 *     BUILD 与它同族（重叠键应逐字节相等）。
 *   · src/colorgamut.js `FEATURES`（HSV 色容体）：roof h[6,22] s[.52,.76] v[.62,.86]、
 *     grass h[78,108] s[.22,.42] v[.55,.78] —— 该文件自述"按片子里画面调的"，
 *     这里当包络参照用，不当唯一真值。
 *   · src/palette.js `PALETTES`：vivid 墙均饱和 ≈0.557（纠偏后的艳板）、
 *     stone ≈0.184（灰白米）——饱和度纠偏的量级参照。
 *   · src/courtyard.js `YARD`：片内实测草地 (86,122,102)、小径 (190,162,148)。
 *   · src/lighting.js `bakeVertexAO`（offset .17 / strength .62 / bounce .42 / airGain 0）
 *     + `diffuseBounce`（passes 3 / gain .9 / stride 3）
 *     + src/townmesh.js 多跳档（passes>1 时 bounce .62、airGain .55——0.42 下只改
 *     1.8% 像素，等于没做）。
 *
 * 本文件只放参数和纯审计函数，不 import three，不碰 World/MeshWriter。
 */

/** 裁判参数表。 */
export const TOWN_VISUAL = {
  /* -- 暖橙屋顶 ----------------------------------------------------------- */
  // 裁判 roof 色容体（colorgamut.js FEATURES.roof，HSV 度/0..1/0..1）
  roofHsv: { h: [6, 22], s: [0.52, 0.76], v: [0.62, 0.86] },
  // 裁判具体取过的屋顶色（palette.js 各板 + engine/roofs.js 默认 + courtyard.js 小屋）
  roofReferee: ['#e2703a', '#cf8672', '#c9693c', '#b4644a', '#c45c4a'],
  // townmesh.js STYLE 的屋顶键——BUILD 重叠键应与它逐字节一致
  styleReferee: {
    roof: '#e07a52', roofAlt: '#d96f4a', roofTrim: '#8a3a32', plaster: '#efe6d4',
    stone: '#8d8f95', stoneDark: '#6d6f76', band: '#7d3836',
    paving: '#5e6168', pavingAlt: '#666970', curb: '#7f828a',
    lawn: '#6f9a5e', lawnAlt: '#679357', path: '#a49c8a',
    tree: '#4e8558', treeLight: '#5f9a63', trunk: '#6e5443',
    steel: '#33373e', frame: '#f6f2e8', glass: '#3d4b58', door: '#5d4a3b',
    chimney: '#e9e1d2', rail: '#2f3238',
  },

  /* -- 多色墙 / 饱和度 ----------------------------------------------------- */
  wallSatReferee: { vividMean: 0.557, stoneMean: 0.184, vividMin: 0.339 },
  wallSatTol: 0.12,          // 本仓 town 板均饱和与 vivid 均值的可接受偏差
  wallMinSat: 0.10,          // 多色墙板：单槽饱和度下限（低于它就是灰板）

  /* -- 庭院草地 ----------------------------------------------------------- */
  // 规则（courtyard.js detectInterior + townmesh.js yard 分支）：
  //   封闭（可达性判不出界/碰不到水）→ 组件内**全部**地面格长草；
  //   矮墙是「分区不封院」——子区照长草；有任一开口的组件一格草都不铺；
  //   片里草地先整片铺上、小径网络随后叠上去（草在小径底下）。
  grassRule: { enclosedOnly: true, subregionsInherit: true, underPath: true },
  grassHsv: { h: [78, 108], s: [0.22, 0.42], v: [0.55, 0.78] },   // colorgamut FEATURES.grass
  grassClipReferee: [86, 122, 102],                              // 片内实测（偏蓝绿）
  pathReferee: '#a49c8a',                                        // townmesh STYLE
  pathClipReferee: [190, 162, 148],                              // 片内实测（暖浅灰 #bea294）

  /* -- 彩色反弹 ----------------------------------------------------------- */
  // 单跳（lighting.js bakeVertexAO 默认）：bake.js 现有 vertex 分支逐式一致。
  bounce: { offset: 0.17, strength: 0.62, bounce: 0.42 },
  // 多跳（townmesh.js bouncePasses>1 档）：扩散参数 + 烘焙档参数。
  bounceMulti: { passes: 3, gain: 0.9, stride: 3, bounce: 0.62, airGain: 0.55 },
};

/* ------------------------------------------------------------ 颜色工具 */

/** '#rrggbb' → HSV（h 度、s/v 0..1）。 */
export function hexToHsv(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return [0, 0, mx];
  let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / mx, mx];
}

/** '#rrggbb' → HSL（h 度、s/l 0..1）。 */
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** 颜色是否落在 HSV 包络 {h:[lo,hi], s:[lo,hi], v:[lo,hi]} 内；misses 记越界的轴。 */
export function inHsvEnvelope(hex, env) {
  const [h, s, v] = hexToHsv(hex);
  const misses = [];
  if (h < env.h[0] || h > env.h[1]) misses.push(`h=${h.toFixed(1)}∉[${env.h}]`);
  if (s < env.s[0] || s > env.s[1]) misses.push(`s=${s.toFixed(3)}∉[${env.s}]`);
  if (v < env.v[0] || v > env.v[1]) misses.push(`v=${v.toFixed(3)}∉[${env.v}]`);
  return { ok: misses.length === 0, h: +h.toFixed(1), s: +s.toFixed(3), v: +v.toFixed(3), misses };
}

/**
 * 墙色板饱和度审计（多色墙判据）：
 *   · 均饱和与裁判 vivid 板（0.557）差 ≤ tol —— 「显示器纠偏后」那档艳度；
 *   · 至少为 stone 灰板（0.184）的两倍 —— 明显多色而不是米灰；
 *   · 每个槽饱和 ≥ floor —— 没有沦为无彩槽。
 */
export function wallPaletteAudit(colors, { referee = TOWN_VISUAL.wallSatReferee, tol = TOWN_VISUAL.wallSatTol, floor = TOWN_VISUAL.wallMinSat } = {}) {
  if (!Array.isArray(colors) || !colors.length) throw new RangeError('wallPaletteAudit: colors');
  const sats = colors.map((c) => hexToHsl(c)[1]);
  const mean = sats.reduce((a, b) => a + b, 0) / sats.length, min = Math.min(...sats);
  return {
    meanSat: +mean.toFixed(3), minSat: +min.toFixed(3), slots: colors.length,
    vsVividMean: +(mean - referee.vividMean).toFixed(3), vsStoneMean: +(mean / referee.stoneMean).toFixed(2),
    ok: Math.abs(mean - referee.vividMean) <= tol && mean >= referee.stoneMean * 2 && min >= floor,
  };
}

/** BUILD 与裁判 townmesh STYLE 的逐键比对（重叠键应相等；only/ missing 单列）。 */
export function styleAudit(build, referee = TOWN_VISUAL.styleReferee) {
  const equal = [], diff = [], onlyBuild = [], missing = [];
  for (const k of Object.keys(build)) {
    if (!(k in referee)) { onlyBuild.push(k); continue; }
    (build[k] === referee[k] ? equal : diff).push(k);
  }
  for (const k of Object.keys(referee)) if (!(k in build)) missing.push(k);
  return { equal, diff, onlyBuild, missing };
}
