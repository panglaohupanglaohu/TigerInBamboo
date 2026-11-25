/**
 * plant-atlas.js — 植物图集全场景共用（R67，Guide §10 R61–R70）。纯数据（Node / Worker 共用）。
 * 一张 512² 的精灵图集（重构库 life/sprite-pack-c09.js 的 SpritePackPlan → core/atlas.js 的 Atlas.place，同一个种子 = 同一张版面），
 * 装下所有场景会用到的植物种类（重构库 core/level-flora.js 的 LEVEL_SPECIES 8 种 + 场景里另有的树 / 花 / 芦苇 / 竹 4 种）。
 * 所有场景读的是同一张图集（同一个 hash）：每个场景只登记自己用到哪几个分配区，不再各自烘一张。
 *   树类（conifer / puff）给 2×2 四个视角的分配区（1593215065423245313「a few views of the same mesh」），草类一个视角。
 * 场景里的植物网格名 → 种类：FLORA_ALIASES（正则，认不出的记 unmapped，覆盖率如实报，不硬塞）。
 * 只是「同一张图集 + 每个场景的映射」这份数据；游戏里的植物材质还没有换成读这张图集（实景预览只登记 globalThis.__tmSharedPlantAtlas）。
 */
import { SpritePackPlan } from '../../../../townscaper-web/REACodeRefactoring/src/life/sprite-pack-c09.js';
import { LEVEL_SPECIES } from '../../../../townscaper-web/REACodeRefactoring/src/core/level-flora.js';

export const PLANT_ATLAS_VERSION = 1;
export const EXTRA_SPECIES = Object.freeze({
  tree: Object.freeze({ name: '阔叶树', shape: 'puff', col: '#4f8a4a' }), flower: Object.freeze({ name: '花丛', shape: 'dots', col: '#e9a6b8' }),
  reed: Object.freeze({ name: '芦苇', shape: 'blade', col: '#9caa62' }), bamboo: Object.freeze({ name: '竹', shape: 'blade', col: '#6f9a4e' }),
});
export const SHARED_FLORA = Object.freeze([...Object.entries(LEVEL_SPECIES), ...Object.entries(EXTRA_SPECIES)].map(([key, s]) => Object.freeze({ key, name: s.name, shape: s.shape, col: s.col })));
const PX = { conifer: 96, puff: 80, fan: 56, blade: 48, dots: 40, tuft: 40 };
const VIEWS = { conifer: 4, puff: 4 };
export const FLORA_ALIASES = Object.freeze([
  [/pine|conifer|cypress|fir|spruce|松|柏|杉/i, 'pine'], [/bamboo|竹/i, 'bamboo'], [/reed|rush|芦|苇/i, 'reed'], [/fern|蕨/i, 'fern'],
  [/heather|石南/i, 'heather'], [/clover|三叶/i, 'clover'], [/flower|blossom|rose|tulip|花/i, 'flower'], [/shrub|bush|hedge|灌/i, 'shrub'],
  [/tallgrass|tall-grass|高草/i, 'tallgrass'], [/meadow|grass|tuft|lawn|草/i, 'meadow'], [/moss|lichen|苔/i, 'rock'],
  [/tree|canopy|leaf|leaves|foliage|oak|plane|maple|willow|birch|树/i, 'tree'],
]);
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };

let cached = null;
/** 全场景共用的那一张图集（只算一次）：{ size, pad, slots:[{ key, name, shape, x, y, w, h, views, cells }], hash, ok }。 */
export function sharedPlantAtlas() {
  if (cached) return cached;
  const plan = new SpritePackPlan(512, { pad: 4, seed: 1 }), slots = [];
  for (const s of SHARED_FLORA) {
    const e = plan.add(PX[s.shape] || 48, { views: VIEWS[s.shape] || 1, kind: s.key });
    slots.push(e ? { key: s.key, name: s.name, shape: s.shape, col: s.col, x: e.slot.x, y: e.slot.y, w: e.slot.w, h: e.slot.h, views: e.views, cells: plan.cells(e) } : { key: s.key, name: s.name, shape: s.shape, col: s.col, missing: true });
  }
  const body = JSON.stringify(slots.map(({ key, x, y, w, h, views }) => [key, x, y, w, h, views]));
  cached = Object.freeze({ version: PLANT_ATLAS_VERSION, size: plan.size, pad: plan.pad, slots, hash: fnv(body), ok: plan.check() && slots.every((x) => !x.missing) });
  return cached;
}
/** 网格名 / 种类名 → 共享图集里的种类 key（认不出返回 null）。 */
export function speciesOf(name) {
  const s = String(name || ''); if (SHARED_FLORA.some((f) => f.key === s)) return s;
  for (const [re, key] of FLORA_ALIASES) if (re.test(s)) return key;
  return null;
}
/** 一个场景的植物清单 { 名字: 株数 } → 用到共享图集的哪几格、覆盖率（认出来的株数占比）。 */
export function plantAtlasForScene(flora = {}) {
  const A = sharedPlantAtlas(), mapped = {}, unmapped = {};
  let total = 0, ok = 0;
  for (const [name, count] of Object.entries(flora || {})) {
    const c = Math.max(0, Math.round(Number(count) || 0)); if (!c) continue; total += c;
    const k = speciesOf(name); if (k) { mapped[k] = (mapped[k] || 0) + c; ok += c; } else unmapped[name] = (unmapped[name] || 0) + c;
  }
  const used = Object.keys(mapped).sort();
  return { atlasHash: A.hash, size: A.size, shared: A.slots.length, used, mapped, unmapped, instances: total, coverage: total ? Math.round(ok / total * 10000) / 10000 : 0,
    slots: A.slots.filter((s) => used.includes(s.key)).map(({ key, x, y, w, h, views }) => ({ key, x, y, w, h, views })) };
}
