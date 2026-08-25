// =====================================================================
//  V5 光照 · 主题表（PLAN.md 第九章 9.11 样片移交基线）
//  纯数据 + 纯函数，不 import Three.js。
//  初值来自已验证样片 oskLightingPrototype.js 的 noon/sunset/night，
//  日出/黎明为项目推导（以真实场景截图校准，不得无证据改大）。
//  太阳方向一律为固定世界方向（按时刻），禁止读取相机位置。
// =====================================================================

// 五关键时刻：黎明 / 日出 / 正午 / 日落 / 深夜
// 字段：sunColor/sunIntensity/sunDir(世界方向,指向太阳) / skyColor/groundColor/hemiIntensity
//       / ambientFloor / background
export const LIGHTING_V5_KEYFRAMES = Object.freeze([
  Object.freeze({
    t: 0.0, // 深夜（跨午夜连续）
    name: "night",
    sunColor: "#8AA8E6",
    sunIntensity: 0.24,
    sunDir: Object.freeze([-0.25, 0.65, 0.7]),
    skyColor: "#263A5A",
    groundColor: "#090C14",
    hemiIntensity: 0.2,
    ambientFloor: 0.03,
    background: "#070A12",
  }),
  Object.freeze({
    t: 0.2, // 黎明前：比深夜略回暖
    name: "predawn",
    sunColor: "#A8B8E0",
    sunIntensity: 0.55,
    sunDir: Object.freeze([-0.05, 0.55, 0.83]),
    skyColor: "#5A6E91",
    groundColor: "#1B2230",
    hemiIntensity: 0.38,
    ambientFloor: 0.07,
    background: "#1A2438",
  }),
  Object.freeze({
    t: 0.28, // 日出（朝霞，对接 dayNight 既有 0xF0A878 系）
    name: "dawn",
    sunColor: "#FFB27A",
    sunIntensity: 1.35,
    sunDir: Object.freeze([0.7, 0.3, -0.64]),
    skyColor: "#F0C8A8",
    groundColor: "#8A705C",
    hemiIntensity: 0.72,
    ambientFloor: 0.16,
    background: "#F2B57E",
  }),
  Object.freeze({
    t: 0.5, // 正午（样片 noon 初值，按 A/B 截断率校准）
    name: "noon",
    sunColor: "#FFE2B9",
    sunIntensity: 1.35,
    sunDir: Object.freeze([0.6, 0.72, 0.35]),
    skyColor: "#D8F2EF",
    groundColor: "#B6A790",
    hemiIntensity: 0.82,
    ambientFloor: 0.2,
    background: "#79C8C1",
  }),
  Object.freeze({
    t: 0.75, // 日落（样片 sunset 初值）
    name: "sunset",
    sunColor: "#FF9B62",
    sunIntensity: 1.5,
    sunDir: Object.freeze([-0.2, 0.38, 0.9]),
    skyColor: "#AAB5CA",
    groundColor: "#8C7164",
    hemiIntensity: 0.76,
    ambientFloor: 0.18,
    background: "#B87982",
  }),
  Object.freeze({
    t: 0.9, // 入夜→深夜过渡末端，与 t:0 深夜同值闭环
    name: "night",
    sunColor: "#8AA8E6",
    sunIntensity: 0.24,
    sunDir: Object.freeze([-0.25, 0.65, 0.7]),
    skyColor: "#263A5A",
    groundColor: "#090C14",
    hemiIntensity: 0.2,
    ambientFloor: 0.03,
    background: "#070A12",
  }),
]);

// ---------- V6-G11 参数包注入 ----------
// 缺省 = 代码内置 LIGHTING_V5_KEYFRAMES，行为与注入前逐位一致。
// 注入源为 versioned presets/grok-vN.json（schema 校验见 presetLoader.js）。
let activeKeyframes = LIGHTING_V5_KEYFRAMES;

/**
 * 注入 versioned 参数包关键帧（presets/grok-vN.json 的 keyframes 数组）。
 * 传 null/undefined 回滚到代码内置 LIGHTING_V5_KEYFRAMES。
 * 纯数据切换，不创建任何 Three 对象。
 */
export function setLightingThemeKeyframes(keyframes) {
  if (keyframes == null) {
    activeKeyframes = LIGHTING_V5_KEYFRAMES;
    return;
  }
  if (!Array.isArray(keyframes) || keyframes.length < 2) {
    throw new TypeError("setLightingThemeKeyframes: 需要长度≥2 的关键帧数组（或 null 回滚）");
  }
  activeKeyframes = keyframes;
}

/** 当前生效的关键帧表（测试/调试只读） */
export function getLightingThemeKeyframes() {
  return activeKeyframes;
}

function hexRgb(hex) {
  const s = String(hex).replace(/^#/, "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function rgbHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

function lerpHex(ha, hb, k) {
  const a = hexRgb(ha);
  const b = hexRgb(hb);
  return rgbHex([lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]);
}

function lerpDir(da, db, k) {
  const v = [lerp(da[0], db[0], k), lerp(da[1], db[1], k), lerp(da[2], db[2], k)];
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * 采样时刻 t（0..1）的光照主题：相邻关键帧线性插值。
 * 输出全部为普通数据（hex 字符串 + 数字 + 数组），不依赖 Three。
 */
export function sampleLightingTheme(t) {
  t = ((t % 1) + 1) % 1;
  const K = activeKeyframes; // 缺省 = LIGHTING_V5_KEYFRAMES，注入后 = 参数包关键帧
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i];
    const b = K[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return {
        name: k < 0.5 ? a.name : b.name,
        sunColor: lerpHex(a.sunColor, b.sunColor, k),
        sunIntensity: lerp(a.sunIntensity, b.sunIntensity, k),
        sunDir: lerpDir(a.sunDir, b.sunDir, k),
        skyColor: lerpHex(a.skyColor, b.skyColor, k),
        groundColor: lerpHex(a.groundColor, b.groundColor, k),
        hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, k),
        ambientFloor: lerp(a.ambientFloor, b.ambientFloor, k),
        background: lerpHex(a.background, b.background, k),
      };
    }
  }
  return sampleLightingTheme(0);
}
