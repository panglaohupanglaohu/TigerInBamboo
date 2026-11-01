/**
 * palette.js — 所有颜色在这里。
 *
 * 注意：three r160 的 new THREE.Color('#hex') 已经转到线性空间，
 * 不要再调用 convertSRGBToLinear()（旧代码转了两次，画面只剩 37% 亮度）。
 */

/** 墙面调色板：15 个色槽（对应原作 VoxelType 的 15 个颜色）。 */
export const PALETTES = {
  town: {
    name: '小镇',
    colors: ['#dd6a5f', '#eec463', '#85b780', '#6f9dc6', '#ac91c9', '#e8a377', '#c2ab8b', '#ecdfc4',
      '#8b9fa6', '#cf5348', '#dd9057', '#d3b96b', '#63a291', '#9dbdd7', '#cf9ab5'],
  },
  pastel: {
    name: '粉彩',
    colors: ['#eda1a1', '#f3d5a5', '#b8dcc4', '#a9c8e8', '#c9b6e4', '#f0b7a4', '#dcc7b0', '#f7ecdc',
      '#b9c4c6', '#d98f8f', '#e8b98d', '#f0dfae', '#a8cfba', '#9bb9dd', '#bfaede'],
  },
  dusk: {
    name: '暮色',
    colors: ['#cf6a58', '#dcae63', '#5d8f7f', '#57799f', '#8a74a6', '#c07d63', '#a9907a', '#e2d5bf',
      '#728388', '#b95147', '#c47a52', '#cbb072', '#5d8a7d', '#6484a5', '#93789f'],
  },
};

/** 建筑固定色（1197909675443916803：屋顶永远陶土色，调色板只上墙）。 */
export const BUILD = {
  roof: '#e07a52', roofAlt: '#d96f4a', roofTrim: '#8a3a32', plaster: '#efe6d4',
  stone: '#8d8f95', stoneDark: '#6d6f76', band: '#7d3836',
  paving: '#5e6168', pavingAlt: '#666970',
  lawn: '#6f9a5e', lawnAlt: '#679357', tree: '#4e8558', treeLight: '#5f9a63', trunk: '#6e5443',
  steel: '#33373e', frame: '#f6f2e8', glass: '#3d4b58', door: '#5d4a3b', chimney: '#e9e1d2', rail: '#2f3238',
};

/** 地形色（取自台地岛参考片：岩、沙、苔，暖色崖顶亮边）。 */
export const TERRAIN = {
  rock: '#a7a49d', rockShade: '#96938d', rockPale: '#bbb5a6', rockDark: '#85837e', strata: '#7d7a74',
  sand: '#c9b691', sandBright: '#ded0ae', moss: '#8d8f62', mossDeep: '#7e8155', grass: '#86a160', grassDeep: '#6f8f55',
  lip: '#e3b67e', river: '#5d9fae', riverBank: '#b9ad8c',
};
