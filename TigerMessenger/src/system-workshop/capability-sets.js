/**
 * capability-sets.js — 能力集合：一组能力（带参数）整组拖进管线，用来快速搭管线。
 *   预置集合：按工坊给出常用组合（例如「基础球系统」= 球系统全部 ⚙ 能力，默认参数）
 *   我的集合：在管线里点「存为能力集合」，把当前管线（启用的节点 + 参数）存下来，之后整组拖入
 * 只放能执行的能力；集合里某个能力在这一层没有执行适配时，拖入时跳过并提示。
 */
const KEY = 'tm.capability.sets.v1';
export const PRESET_SETS = {
  planet: [
    { id: 'preset:planet-base', name: '基础球系统', desc: '球系统全部 ⚙ 能力，默认参数：网格 → 地形 → 水', items: [
      { id: 'planet.grid-subdivision', params: { level: 1 } }, { id: 'planet.chart-split', params: { charts: 6 } }, { id: 'planet.surface-detail', params: { resolution: 24 } },
      { id: 'planet.reseed', params: { seed: 7 } }, { id: 'planet.sea-level', params: { level: 0.5 } }] },
    { id: 'preset:planet-coast', name: '海岸调整', desc: '重解地形 + 抬高海平面，看海岸线变化', items: [{ id: 'planet.reseed', params: { seed: 7 } }, { id: 'planet.sea-level', params: { level: 0.5 } }] },
    { id: 'preset:planet-sea-morris', name: '海面统一 · 莫西斯湖效果', desc: '全球海面（含高山圣城海湾）换成莫西斯湖的样子：距离场 → 水色 → 白沫光晕 → 外推浪带 → 彩色倒影（莫西斯湖不动）', items: [
      { id: 'planet.sea-shore-field', params: { detail: 2, reach: 64, keepBay: 0 } }, { id: 'planet.sea-tint', params: { light: 1, near: 1.5, far: 26 } }, { id: 'planet.sea-foam', params: { rim: 0.9, halo: 5, haloStrength: 0.5 } },
      { id: 'planet.sea-waves', params: { layers: 3, period: 4.6, reach: 3.2, jitter: 0.6, strength: 0.7 } }, { id: 'planet.sea-reflection', params: { colorMix: 0.5, opacity: 0.82, fade: 0.3, maxMeshes: 220, maxHeight: 12 } }] },
    { id: 'preset:planet-rain', name: '雨天', desc: '下雨（雨丝 + 偶尔闪电，停雨出彩虹）+ 偏大的风 + 灰色淡雾', items: [
      { id: 'planet.weather-kind', params: { kind: 1 } }, { id: 'planet.weather-wind', params: { speed: 1.6, dir: 60 } }, { id: 'planet.weather-clouds', params: { gloom: 0.7, shadow: 0.6 } }, { id: 'planet.weather-fog', params: { density: 0.4, warmth: 0 } }] },
    { id: 'preset:planet-citadel-dusk', name: '圣城蓝调暮色（目标图）', desc: '时刻定在 0.76 并停住 + 微风 + 淡雾：对照 citadel-target-20261024 目标图', items: [
      { id: 'planet.light-time', params: { at: 0.76, speed: 0 } }, { id: 'planet.weather-kind', params: { kind: 0 } }, { id: 'planet.weather-wind', params: { speed: 0.9, dir: 60 } }, { id: 'planet.weather-fog', params: { density: 0.18, warmth: 0.4 } }, { id: 'planet.light-ambient-bounce', params: { ambient: 0.95, bounce: 0.35 } }, { id: 'planet.light-rock', params: { strata: 1, rockCool: 0.6 } }] },
    { id: 'preset:planet-lighting-check', name: '光照检查（只看光照）', desc: '所有常规材质换成浅灰，只看光影：分清是灯光问题还是颜色问题；看完把视图调回 0', items: [
      { id: 'planet.light-view-grade', params: { view: 1, saturation: 1, exposure: 1 } }] },
    { id: 'preset:planet-snow', name: '雪天', desc: '下雪（雪片随风漂）+ 莫西斯湖建筑积雪 + 微风 + 白色淡雾', items: [
      { id: 'planet.weather-kind', params: { kind: 2 } }, { id: 'planet.weather-wind', params: { speed: 0.6, dir: 30 } }, { id: 'planet.weather-clouds', params: { gloom: 0.3, shadow: 0.35 } }, { id: 'planet.weather-snow-cover', params: { amount: 0.85 } }, { id: 'planet.weather-fog', params: { density: 0.3, warmth: 0.8 } }] },
    { id: 'preset:planet-mist', name: '雾天', desc: '晴天无雨，只加一层较浓的冷灰雾', items: [
      { id: 'planet.weather-kind', params: { kind: 0 } }, { id: 'planet.weather-wind', params: { speed: 0.3, dir: 45 } }, { id: 'planet.weather-fog', params: { density: 0.7, warmth: 0.2 } }] },
    { id: 'preset:planet-cloudy', name: '多云', desc: '晴天不下雨，云稍阴、海上有移动的云影', items: [{ id: 'planet.weather-kind', params: { kind: 0 } }, { id: 'planet.weather-wind', params: { speed: 1, dir: 45 } }, { id: 'planet.weather-clouds', params: { gloom: 0.35, shadow: 0.55 } }] },
    { id: 'preset:planet-windy', name: '晴天大风', desc: '晴天，风大：云飘得快', items: [{ id: 'planet.weather-kind', params: { kind: 0 } }, { id: 'planet.weather-wind', params: { speed: 2.6, dir: 90 } }] },
    { id: 'preset:planet-detail', name: '精细地表', desc: '提高地表分辨率 + 增加切图', items: [{ id: 'planet.surface-detail', params: { resolution: 32 } }, { id: 'planet.chart-split', params: { charts: 8 } }] },
  ],
  scene: [
    {id:'preset:scene-perceptual',name:'感知色板与层次',desc:'通用场景材质：感知主色归并 → 明暗层次；保护已保存人工调色，每步限制真实输出色差',items:[{id:'scene.oklab-palette',params:{colors:5,strength:0.5,maxDelta:8}},{id:'scene.oklab-contrast',params:{gain:1.15,maxDelta:8}}]},
    { id: 'preset:scene-terrain', name: '地形雕刻', desc: '石拱 + 崖顶悬垂 + 海中石柱 + 穿山隧道', items: [{ id: 'terrain.arch' }, { id: 'terrain.overhang' }, { id: 'terrain.seastack' }, { id: 'terrain.tunnel' }] },
    { id: 'preset:scene-coast-life', name: '海岸生活', desc: '海边灯塔 + 灯室光束 + 体积浅水 + 炊烟', items: [{ id: 'build.lighthouse' }, { id: 'build.lighthouse-light' }, { id: 'water.volume' }, { id: 'effects.smoke' }] },
  ],
  object: [
    { id: 'preset:object-natural', name: '自然化同类', desc: '同类尺寸变化 + 朝向变化 + 间距松弛', items: [{ id: 'object.scale-variety', params: { amount: 0.15 } }, { id: 'object.yaw-variety', params: { degrees: 90 } }, { id: 'object.spacing-relax', params: { maxMove: 0.35 } }] },
    { id: 'preset:object-relax', name: '只疏散', desc: '只做间距松弛，不改大小和朝向', items: [{ id: 'object.spacing-relax', params: { maxMove: 0.35 } }] },
  ],
};
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export function listSets(tier) { return [...(PRESET_SETS[tier] || []).map((s) => ({ ...s, preset: true })), ...((read()[tier]) || [])]; }
export function saveSet(tier, name, items) {
  const all = read(); all[tier] ||= [];
  const set = { id: 'mine:' + Date.now().toString(36), name: name || '我的集合 ' + (all[tier].length + 1), desc: items.map((x) => x.id.split('.').pop()).join(' + '), items };
  all[tier].push(set); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new Event('tm-capability-sets-changed')); return set;
}
export function removeSet(tier, id) { const all = read(); all[tier] = (all[tier] || []).filter((s) => s.id !== id); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} window.dispatchEvent(new Event('tm-capability-sets-changed')); }
