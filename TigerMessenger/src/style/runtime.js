/**
 * style/runtime.js — 场景的风格运行时（第 4、5 步）：风格包 + 本场景覆盖 → 材质角色、墙面色槽、建筑固定色。
 *   install 时套用风格包（数值 = 原样时外观不变）；
 *   preview(覆盖) 只改实景不保存；save() 写本机覆盖；compare(true) 临时回到原始参数对照。
 * 覆盖格式：{ walls?: [15 色], build?: {roof: '#..', ...}, roles?: { 角色: {color?, roughness?, colorMap?} } }
 */
import { applyStylePack, listStyleRoles, exportStyleBase } from './materials.js';
import { packForScene } from './packs/index.js';

const merge = (pack, o = {}) => ({
  ...pack,
  town: { walls: o.walls || pack.town?.walls, build: { ...(pack.town?.build || {}), ...(o.build || {}) } },
  roles: { ...pack.roles, ...Object.fromEntries(Object.entries(o.roles || {}).map(([k, v]) => [k, { ...(pack.roles[k] || {}), ...v, colorMap: v.colorMap ? { ...(pack.roles[k]?.colorMap || {}), ...v.colorMap } : pack.roles[k]?.colorMap }])) },
});

export function installSceneStyle({ sceneId, world, BUILD, rebuild, storage = localStorage }) {
  const pack = packForScene(sceneId);
  if (!pack) return null;
  const KEY = 'tm.style.overrides.v1:' + sceneId;
  const originalBuild = { ...BUILD }, originalPalette = world.palette;
  let saved = {};
  try { saved = JSON.parse(storage.getItem(KEY) || '{}'); } catch { saved = {}; }
  let current = saved, comparing = false;

  function apply(over, { original = false } = {}) {
    const p = original ? null : merge(pack, over);
    applyStylePack(p);
    Object.assign(BUILD, original ? originalBuild : { ...originalBuild, ...p.town.build });
    world.palette = original ? originalPalette : { name: pack.name, colors: [...p.town.walls] };
    world.touch?.();
    rebuild();
  }
  apply(current);

  const state = () => ({
    pack: { id: pack.id, name: pack.name, refs: pack.refs }, base: { walls: pack.town.walls, build: pack.town.build, roles: pack.roles },
    overrides: current, saved, dirty: JSON.stringify(current) !== JSON.stringify(saved), comparing,
    live: listStyleRoles(), materialBase: exportStyleBase(),
  });
  return {
    pack,
    state,
    preview(over) { current = over || {}; comparing = false; apply(current); return state(); },
    compare(on) { comparing = !!on; apply(current, { original: comparing }); return state(); },
    save() { saved = current; try { storage.setItem(KEY, JSON.stringify(saved)); } catch { throw Error('本机存储写入失败'); } return state(); },
    revert() { current = saved; comparing = false; apply(current); return state(); },
    reset() { current = {}; comparing = false; apply(current); return state(); },
    /** 草稿 / 定稿用 */
    snapshot: () => structuredClone(saved),
    restore(o = {}) { saved = current = o; try { storage.setItem(KEY, JSON.stringify(saved)); } catch {} apply(current); return state(); },
  };
}
