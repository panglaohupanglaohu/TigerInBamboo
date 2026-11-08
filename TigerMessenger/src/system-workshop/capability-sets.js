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
    { id: 'preset:planet-detail', name: '精细地表', desc: '提高地表分辨率 + 增加切图', items: [{ id: 'planet.surface-detail', params: { resolution: 32 } }, { id: 'planet.chart-split', params: { charts: 8 } }] },
  ],
  scene: [
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
