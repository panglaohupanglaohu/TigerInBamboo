/**
 * defaultsHook.js — R-A4 通用场景加载钩子（用户 2026-11-23 决定：「游戏只加一个通用加载钩子：进场景时读这份登记，
 * 套用各层已有的预览和采用函数。不再为某一个场景写碰撞、贴地这类专门修补」）。
 *
 * 读 tm.defaults.v1（src/system-workshop/defaults.js）里当前场景的记录，逐条交给 APPLY 表里的层处理函数。
 * 每层的「采用」仍归各层自己的模块（mountainCandidate / buildingCandidate 的 adopted.v1 记录 + 预览函数），
 * 本钩子只做登记→层记录的一致性核对与调度，不复制各层逻辑：
 *   mountain  → 核对 tm.mountain.adopted.v1:<场景> 在不在；在 = 交给已有的 autoDeployAdoptedMountain（main.js 已挂），
 *               不在 = 如实报 missing-layer-record（登记了默认但层记录丢了，要回工坊重采用）。
 *   building  → 核对 tm.building.adopted.v1:<场景>；在 = adopted-no-autodeploy（P-R57-01 未决定，不自动摆）；
 *               不在 = missing-layer-record。
 *   其他层    → no-apply-semantics（登记可以有，但这一层还没有「默认进游戏」的语义，如实写出）。
 *   R-A5      → status!=='active' 的记录（pending-* 待决定登记）→ skipped-pending，不检查不应用。
 * 结果写 globalThis.__tmDefaultsHook，桥接命令 defaults.state / defaults.apply 可查可重跑。不写任何存档。
 */
import { listDefaults } from '../../system-workshop/defaults.js?v=defaults-r2';

export const DEFAULTS_HOOK_VERSION = 1;

/** 层 → { check(sceneId) → 'ok'|'missing', note }；check 里只读各层自己的采用记录，不改任何东西。 */
export function layerCheck(layer, sceneId, storage) {
  try {
    const ls = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const get = (k) => { try { return JSON.parse(ls?.getItem(k) || 'null'); } catch { return null; } };
    if (layer === 'mountain') {
      const rec = get(`tm.mountain.adopted.v1:${sceneId}`);
      return rec ? { state: 'ok', note: '山形采用记录在：由 autoDeployAdoptedMountain 按指纹核对后自动换上' } : { state: 'missing-layer-record', note: '默认登记在，但 tm.mountain.adopted.v1 记录不在——回山形工坊重新执行并采用' };
    }
    if (layer === 'building') {
      const rec = get(`tm.building.adopted.v1:${sceneId}`);
      if (!rec) return { state: 'missing-layer-record', note: '默认登记在，但 tm.building.adopted.v1 记录不在——回建筑工坊重新执行并采用' };
      return rec.autoDeploy === true
        ? { state: 'ok', note: '建筑采用记录开了自动摆上：autoDeployAdoptedBuilding 按指纹核对后摆上（P-R57-01 已决定）' }
        : { state: 'adopted-no-autodeploy', note: '建筑采用记录在；自动摆上没开（P-R57-01 选了手动或还没决定），进游戏不自动换' };
    }
    if (layer === 'battle') {
      const rec = get(`tm.battle.adopted.v1:${sceneId}`);
      return rec ? { state: 'ok', note: '战役采用记录在：adoptedBattles 下次进游戏自动部署' } : { state: 'missing-layer-record', note: '默认登记在，但 tm.battle.adopted.v1 记录不在——回战役工坊重新执行并采用' };
    }
    return { state: 'no-apply-semantics', note: '这一层还没有「默认进游戏」的语义：登记保留，套用方式待该层补上' };
  } catch (e) { return { state: 'error', note: '读取层记录失败：' + (e?.message || e) }; }
}

/** 纯逻辑：给一张 defaults 记录表算每层的处理结果（可注入 check 便于测试）。
 *  R-A5：status !== 'active' 的记录（pending-user / pending-measurement 待决定登记）直接 skipped-pending，
 *  绝不进 check / 不当可应用默认。 */
export function planHook(records, sceneId, check = layerCheck) {
  const results = {};
  for (const [layer, rec] of Object.entries(records || {})) {
    const base = { capabilityId: rec?.capabilityId ?? null, adoptedBy: rec?.adoptedBy ?? 'user', at: rec?.at ?? null };
    if (rec?.status && rec.status !== 'active') {
      results[layer] = { ...base, state: 'skipped-pending', pendingRef: rec.pendingRef ?? null,
        note: `登记状态 ${rec.status}${rec.pendingRef ? '（' + rec.pendingRef + '）' : ''}：待决定 / 待实测，不作为可应用默认` };
      continue;
    }
    results[layer] = { ...base, ...check(layer, sceneId) };
  }
  return results;
}

/**
 * 进场景后调用：读本场景全部默认记录 → 逐层核对 → 写 __tmDefaultsHook。
 * sceneId = 游戏侧场景 id（'citadel' / 'old-port' / 'apostles' / 'crystal' / 'moss'…）。
 */
export function applyDefaultsForScene(sceneId, { storage, check } = {}) {
  const st = (globalThis.__tmDefaultsHook = { version: DEFAULTS_HOOK_VERSION, scene: sceneId, at: new Date().toISOString(), status: 'idle', results: {} });
  if (!sceneId) { st.status = 'no-scene'; return st; }
  let records;
  try { records = listDefaults(storage || localStorage, sceneId); } catch (e) { st.status = 'error'; st.reason = '读 tm.defaults.v1 失败：' + (e?.message || e); return st; }
  const ls = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  st.results = planHook(records, sceneId, (layer, sc) => (check ? check(layer, sc) : layerCheck(layer, sc, ls)));
  const states = Object.values(st.results).map((r) => r.state);
  st.status = !states.length ? 'empty'
    : states.every((s) => s === 'skipped-pending') ? 'pending-only'   // R-A5：全是待决定登记，没有可应用默认
    : states.includes('missing-layer-record') ? 'incomplete'
    : states.every((s) => s === 'ok' || s === 'adopted-no-autodeploy') ? 'applied' : 'partial';
  return st;
}
