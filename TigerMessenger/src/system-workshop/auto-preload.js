/**
 * auto-preload.js — R22 场景自动预装（纯逻辑，Node 测试与浏览器共用）。Guide 创新 2 的第一步：用能力现有的 match 结果拼管线。
 * 场景层工坊（通用场景 / 山形 / 战役 / 表现层）扫描完后，如果管线里没有可执行节点，就把「在这个场景里有可作用对象」的能力
 * 连同它们的前置（requires）一起放进管线，用户只要点 ▶ 执行管线。
 * 用户手动「清空管线」= 不要自动预装（dismissed），之后不再自动填，只能点「按场景预装」手动恢复。
 */
export function planPreload(pipe, scan, caps, { force = false } = {}) {
  const nodes = pipe?.nodes || [];
  if (!force && pipe?.preloadDismissed) return { ids: [], reason: 'dismissed' };
  if (nodes.some((n) => !n.pending && n.enabled !== false)) return { ids: [], reason: 'has-nodes' };
  if (!Array.isArray(scan?.matches)) return { ids: [], reason: 'no-scan' };
  const byId = new Map(caps.map((c) => [c.id, c]));
  const want = new Set();
  const addWithRequires = (id, seen = new Set()) => {
    if (seen.has(id) || !byId.has(id)) return; seen.add(id);
    for (const r of byId.get(id).requires || []) addWithRequires(r, seen);
    want.add(id);
  };
  for (const m of scan.matches) if (m && m.count > 0) addWithRequires(m.id);
  const ids = caps.map((c) => c.id).filter((id) => want.has(id));   // 保持能力登记顺序（与泳道顺序一致）
  return { ids, reason: ids.length ? 'preload' : 'nothing-matches' };
}

/** 预装后给用户看的一句话。 */
export function preloadNote(ids, caps, sceneLabel) {
  if (!ids.length) return '';
  const names = ids.map((id) => caps.find((c) => c.id === id)?.name || id);
  return `已按${sceneLabel ? '「' + sceneLabel + '」' : '本场景'}自动预装 ${ids.length} 个能力（${names.slice(0, 4).join('、')}${names.length > 4 ? ' 等' : ''}），点 ▶ 执行管线一键跑完整条。`;
}
