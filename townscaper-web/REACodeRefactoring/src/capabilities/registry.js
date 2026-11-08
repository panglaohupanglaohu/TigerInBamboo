/**
 * registry.js — 能力库入口（纯数据：Worker / Node / 浏览器都能 import）。
 *
 * 能力 = 踏踏实实的代码。每个能力：
 *   meta     id、所属场景层、名字、做什么、来源视频 ID、能作用的物件、关键词、参数
 *   match    (world, ctx, params) → 能作用的物件列表 [{ id, cells, focus, score, reason }]
 *   run      (world, { targets, params, ctx }) → { applied }（只有"改体素"的能力有）
 * kind2：'geometry' 改体素（在副本上执行，走验证）；'layer' 只加显示层（layers.js，主线程）。
 *
 * 新学到的能力：写一个模块、导出上面三样，在下面登记，工坊扫描时就能发现并匹配到场景物件。
 */
import { arch, overhang, seastack, tunnel } from './terrain.js';
import { lighthouse } from './build.js';
import { LAYER_CAPS } from './layers-meta.js';
import { pickSpread } from './ops.js';

export const REGISTRY_VERSION = 1;
export const CAPABILITIES = [arch, overhang, seastack, tunnel, lighthouse, ...LAYER_CAPS];
const byId = new Map(CAPABILITIES.map((c) => [c.meta.id, c]));
export const getCapability = (id) => byId.get(id);

/** 只读描述（给工坊 UI）：不含函数，可 JSON 化 */
export function describeCapabilities() {
  return CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true }));
}

const defaults = (meta, params = {}) => Object.fromEntries(Object.entries(meta.params || {}).map(([k, p]) => [k, Math.max(p.min ?? -Infinity, Math.min(p.max ?? Infinity, params[k] ?? p.default))]));

/**
 * 场景扫描：每个能力在当前 World 上能作用到哪些物件。
 * focusCells：用户选中的格子（选中物件时传入）——只保留碰到这些格子的匹配。
 */
export function matchAll(world, ctx = {}, { focusCells = null, limit = 12 } = {}) {
  const focus = focusCells ? new Set(focusCells) : null;
  return CAPABILITIES.map((cap) => {
    let rows = [];
    try { rows = cap.match(world, ctx, defaults(cap.meta)); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; }
    if (focus) rows = rows.filter((r) => r.cells.some((c) => focus.has(c)) || focus.has(r.focus) || (r.ends || []).some((c) => focus.has(c)));
    rows.sort((a, b) => b.score - a.score);
    return { id: cap.meta.id, count: rows.length, targets: rows.slice(0, limit) };
  });
}

/**
 * 执行计划：steps = [{ id, params, targets? }]，按顺序在同一个 World 副本上跑。
 * 没给 targets 时由能力自己匹配，按分数挑 params.count 个、彼此隔开。
 */
export function runPlan(world, steps, ctx = {}, { focusCells = null } = {}) {
  const report = [];
  for (const step of steps) {
    const cap = byId.get(step.id);
    if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = defaults(cap.meta, step.params);
    if (!cap.run) { report.push({ id: step.id, status: 'layer', layer3d: cap.meta.layer3d, params }); continue; }
    let targets = step.targets;
    if (!targets) {
      let rows = cap.match(world, ctx, params);
      if (focusCells) { const f = new Set(focusCells); rows = rows.filter((r) => r.cells.some((c) => f.has(c)) || f.has(r.focus) || (r.ends || []).some((c) => f.has(c))); }
      targets = pickSpread(rows, world.grid.cells, params.count ?? 1);
    }
    const t0 = Date.now();
    const out = cap.run(world, { targets, params, ctx });
    report.push({ id: step.id, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, tried: targets.length, ms: Date.now() - t0, params, layer3d: cap.meta.layer3d,
      reasons: targets.filter((t) => out.applied.includes(t.id)).map((t) => t.reason), focus: targets.filter((t) => out.applied.includes(t.id)).map((t) => t.focus) });
  }
  return report;
}

/**
 * Router：把改造方向（文字）+ 选中物件 映射成计划。确定性规则：关键词命中 + 场景里确实有可作用的物件。
 * 返回 [{ id, score, why, matches }]，由用户在工坊里勾选 / 调整后再执行。
 */
export function routeGoal(goal, matches, { selected = [] } = {}) {
  const text = String(goal || '').toLowerCase();
  const out = [];
  for (const cap of CAPABILITIES) {
    const m = matches.find((x) => x.id === cap.meta.id);
    if (!m || !m.count) continue;
    const hits = cap.meta.keywords.filter((k) => text.includes(k.toLowerCase()));
    const pinned = selected.includes(cap.meta.id);
    if (!hits.length && !pinned) continue;
    out.push({ id: cap.meta.id, score: hits.length * 2 + (pinned ? 5 : 0) + Math.min(1, m.count / 10), why: pinned ? '已在管线中启用' : '改造方向提到「' + hits.join('、') + '」', matches: m.count });
  }
  return out.sort((a, b) => b.score - a.score);
}
