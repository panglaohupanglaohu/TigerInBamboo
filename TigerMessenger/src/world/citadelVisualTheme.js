// =====================================================================
//  高山城堡整体配色 V3 · 语义主题模块（PLAN.md 第七章 7.3/7.4/7.5）
//  纯数据与纯函数：不 import Three.js，方便 Node 桩环境单测。
//  色彩空间约定：token 一律为 sRGB `#RRGGBB`；消费方用 THREE.Color.setHex()
//  走 r172 默认 ColorManagement（sRGB→Linear 工作空间→sRGB 输出）只转换一次，
//  禁止在 token 之上再手动 convertSRGBToLinear（即"重复转换"）。
//  开关：?citadelPaletteV3=1（core/params.js），关闭=旧色板逐字节保留。
//  与 Grok V4 的 src/world/citadel/visualTheme.js 无关：那是鲜艳墙 V4 管线，
//  本模块服务旧运行时（odysseyCitadel/citadelRange/harbor/phalanx 等）。
// =====================================================================

// ---------- 7.3 语义色板（46 项） ----------
export const CITADEL_V3_TOKENS = Object.freeze({
  // 城堡、台地与构件（13）
  castleWallChalk: "#E7ECE7", // 主墙 38%，高明度粉白石基底
  castleWallMist: "#B9C9C7", // 雾蓝灰墙 20%
  castleWallSage: "#A7BE9C", // 鼠尾草绿墙 17%
  castleWallSand: "#D8C6A6", // 暖砂墙 13%，门口与交通节点附近
  castleWallBlush: "#D7A0A0", // 灰粉墙 8%，只作建筑焦点
  castleWallAccent: "#8FAEB5", // 冷蓝焦点 4%，高塔/桥头，不大面积铺满
  castleRoof: "#C98778", // 主屋顶，灰鲑陶瓦
  castleRoofShade: "#9D6866", // 屋脊、背光瓦与旧化边缘
  castleTrim: "#46545D", // 檐口、栏杆、支架、描边；避免纯黑
  castleWindow: "#294452", // 窗洞和门洞（夜间亮窗另走发光 token）
  castleGateFocus: "#EEE2CB", // 正门、阶梯出口和战术瓶颈的暖粉白
  castlePlaza: "#A9B2AB", // 台面铺装与公共石材
  castleBalconyTiles: Object.freeze(["#C89082", "#7FA6AC", "#B4A06B", "#7FA98C"]), // 阳台花砖四釉色
  // 船只（8）
  shipEnemyHull: "#533842", // 敌方战船主船体，暗酒紫而非鲜红
  shipEnemyHullShade: "#2E3338", // 船底、船舱和剪影暗面
  shipEnemyBand: "#8D4B52", // 少量舷带；≤船体可见面 12%
  shipDefenderHull: "#496A73", // 守方/民用船深雾蓝绿
  shipDeckWood: "#756052", // 甲板和桨，压低偏黄木色
  shipSailBone: "#D8D5C8", // 风化骨白帆
  shipRope: "#746B60", // 绳索与支索
  shipMetal: "#A58A57", // 撞角和小面积金属
  // 士兵与战斗反馈（12）
  unitDefenderMain: "#416F91", // 守军蓝，躯干/盾面主色
  unitDefenderShade: "#29445B", // 守军裙甲、盾脐和背光面
  unitAttackerMain: "#593B47", // 攻方暗酒紫，与敌船同族但更易读
  unitAttackerShade: "#2D353B", // 敌军暗甲和夜间剪影
  unitMetal: "#C5B37E", // 低光泽黄铜头盔/盾边
  unitSteel: "#BAC4C6", // 枪尖、箭头，小面积高明度
  unitSkin: "#C99570", // 降饱和皮肤
  unitTorch: "#FFB347", // 火焰核心；夜间唯一持续暖高亮
  unitTorchHalo: "#E67A3C", // 火炬外焰与点光
  battleBloodFresh: "#A9283C", // 新鲜血迹，最高饱和反馈色
  battleBloodDry: "#672F3A", // 干涸旧血迹
  battleFire: "#E85D3F", // 建筑燃烧红橙，不用于常规服装
  // 环境（13）
  envSkyTop: "#8EADB0", // 白天雾蓝天顶
  envSkyHorizon: "#B8C6C4", // 高明度灰青地平线
  envFog: "#A9B9B8", // 与水天同族
  envWater: "#6F9EA4", // 湖泊、运河、港口主水色
  envWaterDeep: "#527A82", // 深潭与背光水面
  envFoam: "#DDE6E2", // 瀑布、水沫和岸线
  envGrass: "#88A779", // 台地草地主色
  envGrassLight: "#A8C394", // 日照草地和高台边缘
  envDryGrass: "#C4B487", // 晚季/受损台面
  envCliff: "#D6DEDA", // 粉白崖壁和城堡基岩
  envCliffShade: "#AABAB6", // 洞口、悬崖底和接触阴影
  envFoliageDark: "#486858", // 树冠暗部
  envFoliageLight: "#719175", // 树冠亮部
});

export const CITADEL_V3_TOKEN_COUNT = 46;

// ---------- 7.4 墙色权重与色相环相邻关系 ----------
export const CITADEL_V3_WALL_WEIGHTS = Object.freeze([
  ["castleWallChalk", 0.38],
  ["castleWallMist", 0.2],
  ["castleWallSage", 0.17],
  ["castleWallSand", 0.13],
  ["castleWallBlush", 0.08],
  ["castleWallAccent", 0.04],
]);

// 色相环相邻辅色候选（手工按 token 色相排序的邻接表）
export const CITADEL_V3_WALL_NEIGHBORS = Object.freeze({
  castleWallChalk: ["castleWallMist", "castleWallSand"],
  castleWallMist: ["castleWallChalk", "castleWallAccent"],
  castleWallSage: ["castleWallChalk", "castleWallSand"],
  castleWallSand: ["castleWallSage", "castleWallBlush"],
  castleWallBlush: ["castleWallSand"],
  castleWallAccent: ["castleWallMist"],
});

// ---------- 7.5 时间与天气 grade（token → grade → 最终色，禁止逐帧累乘） ----------
export const CITADEL_V3_GRADES = Object.freeze({
  clear: Object.freeze({ satMul: 1.0, lift: 0, charSatMul: 1.05, tint: null, tintMix: 0 }),
  sunset: Object.freeze({ satMul: 1.0, lift: 0, charSatMul: 1.0, tint: "#C87669", tintMix: 0.22 }),
  rain: Object.freeze({ satMul: 0.82, lift: -0.06, charSatMul: 0.92, tint: null, tintMix: 0 }),
  // 雪天：环境向冷白提亮 12~18%（取 15%）、降饱和；角色保留 88%
  snow: Object.freeze({ satMul: 0.8, lift: 0.15, charSatMul: 0.88, tint: "#EEF3F2", tintMix: 0.1 }),
  // 深夜：天空/雾直接切换；城墙保留冷月明度（整体压暗由光照负责，不做大幅 lift）
  night: Object.freeze({
    satMul: 0.9,
    lift: -0.05,
    charSatMul: 0.9,
    tint: "#2B3D4D",
    tintMix: 0.2,
    overrides: Object.freeze({
      envSkyTop: "#1E2D3D",
      envSkyHorizon: "#2B3D4D",
      envFog: "#2B3D4D",
    }),
  }),
});

// ---------- 7.4.5 材质参数 ----------
export const CITADEL_V3_MATERIALS = Object.freeze({
  wall: Object.freeze({ roughness: 0.88, metalness: 0 }),
  cloth: Object.freeze({ roughness: 0.92, metalness: 0 }),
  wood: Object.freeze({ roughness: 0.86, metalness: 0 }),
  brass: Object.freeze({ roughness: 0.65, metalness: 0.22 }),
  water: Object.freeze({ transparent: true }), // 水体单独透明材质，不走 toon 混合
});

// ---------- 颜色工具（自包含，可 toString 注入） ----------
export function v3HexToRgb(hex) {
  const s = String(hex).replace(/^#/, "");
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

export function v3RgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function srgbToLinear1(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb1(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function v3RgbToLab(r, g, b) {
  const rl = srgbToLinear1(r / 255);
  const gl = srgbToLinear1(g / 255);
  const bl = srgbToLinear1(b / 255);
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function v3LabToRgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const x = finv(fx) * 0.95047;
  const y = finv(fy);
  const z = finv(fz) * 1.08883;
  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return {
    r: Math.max(0, Math.min(255, Math.round(linearToSrgb1(Math.max(0, rl)) * 255))),
    g: Math.max(0, Math.min(255, Math.round(linearToSrgb1(Math.max(0, gl)) * 255))),
    b: Math.max(0, Math.min(255, Math.round(linearToSrgb1(Math.max(0, bl)) * 255))),
  };
}

function rgbToHsl1(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const l = (hi + lo) / 2;
  if (hi === lo) return { h: 0, s: 0, l };
  const d = hi - lo;
  const s = l > 0.5 ? d / (2 - hi - lo) : d / (hi + lo);
  let h;
  if (hi === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (hi === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb1(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(conv(h + 1 / 3) * 255),
    g: Math.round(conv(h) * 255),
    b: Math.round(conv(h - 1 / 3) * 255),
  };
}

// ---------- 稳定 hash（FNV-1a 32bit） ----------
export function v3HashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------- 7.4.2 建筑簇配色：稳定 hash 选主色 + 相邻辅色 ----------
export function resolveClusterWallColors(clusterId) {
  const h = v3HashString(`cluster:${clusterId}`);
  let r = (h % 10000) / 10000;
  let acc = 0;
  let main = CITADEL_V3_WALL_WEIGHTS[0][0];
  for (const [token, weight] of CITADEL_V3_WALL_WEIGHTS) {
    acc += weight;
    if (r <= acc) {
      main = token;
      break;
    }
  }
  const neighbors = CITADEL_V3_WALL_NEIGHBORS[main];
  const accent = neighbors[(h >>> 11) % neighbors.length];
  return Object.freeze({ main, accent });
}

// ---------- 7.4.4 明度抖动：仅 L*，默认限 ±2.5 ----------
export function jitterLStar(hex, delta) {
  const d = Math.max(-2.5, Math.min(2.5, delta));
  const { r, g, b } = v3HexToRgb(hex);
  const lab = v3RgbToLab(r, g, b);
  const out = v3LabToRgb(Math.max(0, Math.min(100, lab.L + d)), lab.a, lab.b);
  return v3RgbToHex(out);
}

// 由抖动键派生 ±2.5 内的确定抖动量
export function jitterForKey(key) {
  const h = v3HashString(`jitter:${key}`);
  return ((h % 500) / 500 - 0.5) * 5; // [-2.5, +2.5)
}

// ---------- 7.4.3 路线导向明度：面向动线提亮 3~5%，背面压暗 2~4% ----------
export function routeLightness(hex, facing) {
  const delta = facing === "route" ? 4 : facing === "back" ? -3 : 0;
  const { r, g, b } = v3HexToRgb(hex);
  const lab = v3RgbToLab(r, g, b);
  const out = v3LabToRgb(Math.max(0, Math.min(100, lab.L + delta)), lab.a, lab.b);
  return v3RgbToHex(out);
}

// ---------- 7.5 grade 应用（纯函数；torch 不参与全局降饱和） ----------
export function applyV3Grade(hex, gradeName, opts) {
  const grade = CITADEL_V3_GRADES[gradeName] || CITADEL_V3_GRADES.clear;
  const o = opts || {};
  // override 为终态色（如深夜天空 #1E2D3D），直接返回、不再叠 grade
  if (grade.overrides && o.token && grade.overrides[o.token]) {
    return grade.overrides[o.token];
  }
  let { r, g, b } = v3HexToRgb(hex);
  // 饱和度/明度：HSL 域。角色用 charSatMul；火炬不降饱和。
  const satMul = o.torch ? 1 : o.character ? grade.charSatMul : grade.satMul;
  const lift = o.character ? grade.lift * 0.5 : grade.lift;
  const hsl = rgbToHsl1(r, g, b);
  hsl.s = Math.max(0, Math.min(1, hsl.s * satMul));
  hsl.l = Math.max(0, Math.min(1, hsl.l + lift));
  ({ r, g, b } = hslToRgb1(hsl.h, hsl.s, hsl.l));
  // tint（落日灰鲑 / 雪天冷白 / 深夜蓝灰）：角色减半
  if (grade.tint && grade.tintMix > 0) {
    const mix = o.character ? grade.tintMix * 0.5 : grade.tintMix;
    const t = v3HexToRgb(grade.tint);
    r = r * (1 - mix) + t.r * mix;
    g = g * (1 - mix) + t.g * mix;
    b = b * (1 - mix) + t.b * mix;
  }
  return v3RgbToHex({ r, g, b });
}

// ---------- 主入口：token → grade → 最终 sRGB hex ----------
// context: { grade?: "clear"|"sunset"|"rain"|"snow"|"night", character?: bool,
//            torch?: bool, facing?: "route"|"back"|"normal", jitterKey?: string }
export function v3TokenHex(token, context) {
  const c = context || {};
  let hex = CITADEL_V3_TOKENS[token];
  if (typeof hex !== "string") throw new Error(`未知 V3 token: ${token}`);
  if (c.facing && c.facing !== "normal") hex = routeLightness(hex, c.facing);
  if (c.jitterKey != null) hex = jitterLStar(hex, jitterForKey(c.jitterKey));
  return applyV3Grade(hex, c.grade || "clear", { token, character: c.character, torch: c.torch });
}

// ---------- 完整性工具 ----------
export function listV3Tokens() {
  return Object.keys(CITADEL_V3_TOKENS);
}

export function isValidV3Hex(value) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

// ---------- 消费侧适配：数字 hex 与同型方案对象 ----------
export function v3HexInt(hex) {
  return parseInt(String(hex).replace(/^#/, ""), 16);
}

export function v3TokenInt(token, context) {
  return v3HexInt(v3TokenHex(token, context));
}

/**
 * 高山圣城墙色 15 色板（替代 TOWNSCAPER_HIGHLAND_PALETTE 的逐格糖果彩虹）。
 * 15 个字符位按 38/20/17/13/8/4 权重静态映射到 6 个墙 token，
 * 每位再叠加字符键派生的 L*±2.5 抖动（不碰色相/饱和度）。
 * C2 簇配色落地后，单格颜色改由 resolveClusterWallColors 决定，
 * 本表仍作为无簇信息时的兜底。
 */
export function v3HighlandWallPalette() {
  const chars = "0123456789ABCDE";
  // 权重 ≈ 38/20/17/13/8/4 → 15 格：chalk×5 mist×3 sage×3 sand×2 blush×1 accent×1
  const assignment = [
    "castleWallChalk",
    "castleWallMist",
    "castleWallSage",
    "castleWallChalk",
    "castleWallSand",
    "castleWallMist",
    "castleWallChalk",
    "castleWallSage",
    "castleWallChalk",
    "castleWallSand",
    "castleWallMist",
    "castleWallSage",
    "castleWallChalk",
    "castleWallBlush",
    "castleWallAccent",
  ];
  const names = {
    castleWallChalk: "粉笔白",
    castleWallMist: "雾蓝灰",
    castleWallSage: "鼠尾草",
    castleWallSand: "暖砂",
    castleWallBlush: "灰粉",
    castleWallAccent: "冷蓝",
  };
  return Object.freeze(
    chars.split("").map((char, i) => {
      const token = assignment[i];
      return Object.freeze({
        name: names[token],
        char,
        color: v3TokenInt(token, { jitterKey: `wall-${char}` }),
      });
    })
  );
}

/** 正门色（V3）：castleGateFocus 暖粉白。 */
export function v3HighlandGateColor() {
  return v3TokenInt("castleGateFocus");
}

/**
 * HIGHLAND_TOWNSCAPER 同键同型替代（数字 hex），全部取自语义 token。
 * 保持键名与数组长度一致，applyTownscaperCanalMaterials 无需分支。
 */
export function v3HighlandScheme() {
  const t = (token, ctx) => v3TokenInt(token, ctx);
  return {
    roofTile: t("castleRoof"),
    roofVariants: Object.freeze([
      t("castleRoof", { jitterKey: "roof-0" }),
      t("castleRoofShade"),
      t("castleRoof", { jitterKey: "roof-2" }),
      t("castleRoofShade", { jitterKey: "roof-3" }),
    ]),
    trim: t("castleTrim"),
    iron: t("castleTrim", { facing: "back" }),
    wood: t("shipDeckWood"),
    ink: t("castleWindow"),
    dome: t("castleRoof"),
    stone: t("castleGateFocus"),
    seawall: t("castlePlaza", { facing: "back" }),
    plaza: t("castlePlaza"),
    contour: t("castlePlaza", { jitterKey: "contour" }),
    pilgrimageStone: t("castlePlaza", { facing: "route" }),
    water: t("envWater"),
    foliageDark: t("envFoliageDark"),
    foliageLight: t("envFoliageLight"),
    windowDark: t("castleWindow"),
    crenel: t("castleWallChalk"),
    balconyTileVariants: Object.freeze(CITADEL_V3_TOKENS.castleBalconyTiles.map(v3HexInt)),
    foundationVariants: Object.freeze([
      t("castlePlaza"),
      t("envCliffShade"),
      t("castleWallMist", { facing: "back" }),
    ]),
    fenceVariants: Object.freeze([
      t("castleTrim"),
      t("castleTrim", { facing: "back" }),
      t("shipDeckWood"),
      t("shipRope"),
    ]),
  };
}
