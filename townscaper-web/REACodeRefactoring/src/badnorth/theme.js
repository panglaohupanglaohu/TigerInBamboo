/**
 * theme.js — Bad North 的画面风格，套在共享管线上（地形 / 建筑 / 海 / 天）。
 *
 * 来源：REACode/engine/badnorth.html 的 PAL（从 badnorth.com 官方 1920×1080 截图 k-means + 定点取色量出来的），
 * 和 REACode/BADNORTH-REA.md 的六条结论。这里只搬"结论"，实现换成共享系统：
 *   (1) 没有地平线：海的远处颜色 = 背景色 = 天的地平线色；四角比中心亮（径向压暗 → CSS 晕影）
 *   (2) 叠层岩板：共享地形本来就是偶数层台阶 + 沉积线
 *   (3) 崖面偏紫：受光 #a89aa2 / #9d8e97，暗部 #8b797e / #705a67
 *   (4) 草面：橄榄 #a9ac83 / 暗 #6f7150（叶丛 / 笔触交给植被管线）
 *   (5) 岸线跟着环境色走：夏季鲑鱼粉 #d9a79e、晨雾青 #a8e0e8（这里改岸浪颜色）
 *   (6) 岛下紫色倒影 #6d687e
 * 官网截图文件名里还有 rain / dusk / night / autumn —— 这几套是在 summer / dawn 实测值上推的，标"推断"。
 */

import { TERRAIN, BUILD } from '../core/palette.js';

export const BN_PAL = {
  summer: { name: '夏（实测）', sky: '#a6afb2', skyTop: '#c1c1c1', sea: ['#b7babc', '#8fa0a7'], cliff: ['#a89aa2', '#9d8e97', '#8b797e', '#705a67'], grass: ['#a9ac83', '#6f7150'], sand: '#dfd4c3', shore: '#d9a79e', wall: '#f3efe4', roof: '#b9c79c', reflect: '#6d687e' },
  dawn: { name: '晨（实测）', sky: '#a79da0', skyTop: '#b3a9a4', sea: ['#b2a8a8', '#9a8f95'], cliff: ['#d0a3a4', '#c08d92', '#a8707a', '#8a5560'], grass: ['#a8a08c', '#7d7563'], sand: '#d8c8bd', shore: '#a8e0e8', wall: '#f0e6dc', roof: '#a9a68f', reflect: '#6f6478' },
  rain: { name: '雨（推断）', sky: '#c9ccc4', skyTop: '#dcdcd4', sea: ['#c4c7bf', '#a4aba6'], cliff: ['#b9b8b4', '#a8a6a3', '#8e8b8b', '#6e6a6e'], grass: ['#7f8a6c', '#556048'], sand: '#cfc8b8', shore: '#eef0e6', wall: '#ecebe4', roof: '#8e9a7a', reflect: '#6a6a70' },
  dusk: { name: '黄昏（推断）', sky: '#b49a96', skyTop: '#c7a99b', sea: ['#b7a09c', '#8f7f86'], cliff: ['#d4a38d', '#bf8d80', '#9a6c6c', '#6f4f5c'], grass: ['#b0a070', '#7a6b4c'], sand: '#e2c7ae', shore: '#f3c49a', wall: '#f6e2cc', roof: '#b9a77a', reflect: '#5f4c5c' },
  night: { name: '夜（推断）', sky: '#4a5566', skyTop: '#5a6576', sea: ['#4d5868', '#3a4454'], cliff: ['#7d8098', '#6c6e88', '#565771', '#3f3f58'], grass: ['#5d6a62', '#404a46'], sand: '#8d8c94', shore: '#9fc6d6', wall: '#c9cbd8', roof: '#6f7a72', reflect: '#2e3344' },
  autumn: { name: '秋（推断）', sky: '#b8b2a2', skyTop: '#cbc4b2', sea: ['#b4b0a3', '#949488'], cliff: ['#b3a29c', '#a28f8c', '#8a7676', '#6b5860'], grass: ['#c09a58', '#86683c'], sand: '#dccbb0', shore: '#e9b88f', wall: '#f2eadc', roof: '#b0864e', reflect: '#665a62' },
};

const saved = { TERRAIN: { ...TERRAIN }, BUILD: { ...BUILD } };
let overlay = null;

/** 套用 / 取消（name = null）。改的是共享调色板对象本身，所以之后的重建都会用新颜色。 */
export function applyBadNorthTheme(view, name) {
  if (!name) {
    Object.assign(TERRAIN, saved.TERRAIN);
    Object.assign(BUILD, saved.BUILD);
    overlay?.remove(); overlay = null;
    view.bnTheme = null;
    view.setTimeOfDay(view.timeOfDay === 'bn' ? 'day' : view.timeOfDay);
    view.worldMesh.invalidate();
    return;
  }
  const P = BN_PAL[name];
  Object.assign(TERRAIN, {
    rock: P.cliff[1], rockShade: P.cliff[2], rockPale: P.cliff[0], rockDark: P.cliff[3], strata: P.cliff[3],
    sand: P.sand, sandBright: P.sand, moss: P.grass[0], mossDeep: P.grass[0], grass: P.grass[0], grassDeep: P.grass[1],
    lip: P.sand, river: P.sea[1], riverBank: P.sand,
  });
  Object.assign(BUILD, { roof: P.roof, roofAlt: P.roof, roofTrim: P.grass[1], plaster: P.wall, chimney: P.wall });
  view.bnTheme = P;
  // 天、海：远处的海 = 背景色 = 地平线色（1）
  view.scene.background.set(P.sky);
  view.atmosphere?.setFogColor(P.sky);
  view.waterUniforms.uShallow.value.set(P.sea[0]);
  view.waterUniforms.uDeep.value.set(P.sea[1]);
  view.waterUniforms.uSky.value.set(P.sky);
  if (view.waterUniforms.uFar) view.waterUniforms.uFar.value.set(6, 34);   // 更快溶进背景
  view.setShoreColor?.(P.shore);
  view.timeOfDay = 'bn';
  // 四角比中心亮：CSS 径向晕影（反向：中心压暗 14%）
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;';
    document.body.appendChild(overlay);
  }
  overlay.style.background = `radial-gradient(ellipse at 50% 52%, rgba(40,40,55,.12) 0%, rgba(40,40,55,.05) 38%, rgba(255,255,255,0) 62%), linear-gradient(${P.skyTop}00, ${P.skyTop}22)`;
  view.worldMesh.invalidate();
}
