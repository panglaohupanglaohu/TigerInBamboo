/**
 * recent-additions.js — R24「最近新增」栏（纯逻辑，Node 测试与浏览器共用）。
 * 管线页顶部一条：最近加入的可执行能力 —— 名字、能力线、哪天加的（写明日期依据）、在哪些场景能跑、九级成熟度（R23）。
 * 数据：catalog/capability-maturity.json（脚本给的级别与加入日期）+ 页面上已登记的能力（meta）+ 本机执行经验（tm.capability.experience.v2）。
 * 点一行 → 去能跑它的地方：战役 / 山形 / 表现层用 R21 直达页签（#battle / #mountain / #fx），其余去对应工坊并切到能跑的场景。
 *
 * 加入日期的依据（不编日期）：
 *   meta          能力 meta.added 写明
 *   workshop-log  工坊日志里最早提到这个能力 ID 的那一段的日期
 *   first-seen    成熟度脚本第一次见到它的那天
 *   experience-first-run  本机第一次执行它（只是上限：实际加入不晚于这天）
 *   file-mtime    登记文件最后修改时间（只是上限）
 *   unknown       没有依据（成熟度数据缺失、本机也没跑过）
 * 两个「上限」都有时取更早的那个。
 */
import { FOCUS_LAYERS } from './layer-focus.js?v=focus-r1';

export const SCENE_NAMES = Object.freeze({ apostles: '十二门徒', moss: '苔庭', citadel: '高山圣城', bookshop: '书店镇', 'morris-lake': '莫西斯湖' });
export const BASIS_LABEL = Object.freeze({
  meta: '能力登记写明', 'workshop-log': '工坊日志首次提到', 'first-seen': '脚本首次见到', 'experience-first-run': '本机首次执行（上限）',
  'file-mtime': '登记文件修改时间（上限）', unknown: '日期未知',
});
const UPPER_BOUND = new Set(['file-mtime', 'experience-first-run', 'unknown']);
const day = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null);

/** 一个能力在哪些场景能跑（按它所在的工坊层） */
export function scenesFor(layer) {
  if (layer === 'battle' || layer === 'fx') return FOCUS_LAYERS[layer].scenes.map((id) => ({ id, label: SCENE_NAMES[id] || id }));
  if (layer === 'mountain') return FOCUS_LAYERS.mountain.scenes.map((id) => ({ id, label: SCENE_NAMES[id] || id }));
  if (layer === 'gscene') return [{ id: 'bookshop', label: '通用插件场景（书店镇等）' }];
  if (layer === 'voxel') return [{ id: 'morris-lake', label: SCENE_NAMES['morris-lake'] }];
  if (layer === 'planet') return [{ id: 'planet', label: '整颗星球（球系统）' }];
  if (layer === 'object') return [{ id: '*', label: '任一场景的物件' }];
  return [];
}

/** 点了去哪：页签按钮 id、地址栏 hash、要不要切场景（直达层由 R21 的 ensureFocusScene 自己切） */
export function targetFor(layer) {
  if (layer === 'battle' || layer === 'mountain' || layer === 'fx') return { tab: layer + '-focus-tab', hash: '#' + layer, focus: layer, scene: null, label: FOCUS_LAYERS[layer].title };
  if (layer === 'gscene') return { tab: 'scene-workshop-tab', hash: '#scene', focus: null, scene: 'bookshop', label: '场景管线 · 通用场景' };
  if (layer === 'planet') return { tab: 'planet-workshop-tab', hash: '#planet', focus: null, scene: null, label: '球系统管线' };
  if (layer === 'object') return { tab: 'object-workshop-tab', hash: '#object', focus: null, scene: null, label: '物件管线' };
  return { tab: 'scene-workshop-tab', hash: '#scene', focus: null, scene: 'morris-lake', label: '场景管线' };
}

/** 本机经验：这个能力（或它所在的任一步）第一次 / 最近一次执行、次数、通过、采用 */
export function experienceOf(id, rows = []) {
  const has = (r) => r && (r.capabilityId === id || (Array.isArray(r.steps) && r.steps.some((s) => s?.id === id)));
  const runs = rows.filter((r) => has(r) && (r.outcome || 'previewed') === 'previewed');
  const ats = runs.map((r) => +r.at).filter(Number.isFinite);
  return { runs: runs.length, passed: runs.filter((r) => r.verify === 'pass' || r.verify === 'warn').length, committed: rows.filter((r) => has(r) && r.outcome === 'committed').length,
    firstAt: ats.length ? Math.min(...ats) : null, lastAt: ats.length ? Math.max(...ats) : null };
}

/**
 * @param maturity  capability-maturity.json（可以是 null：只用页面上的能力，日期写未知）
 * @param live      页面上已登记的能力 [{ id, name, layer, line? }]（maturity 里没有的也列出来）
 * @param experienceRows  readRows() 的结果
 * @returns { rows, total, source: 'maturity' | 'live-only', note }
 */
export function buildRecentAdditions({ maturity = null, live = [], experienceRows = [], limit = 8 } = {}) {
  const byId = new Map();
  for (const r of Array.isArray(maturity?.rows) ? maturity.rows : []) byId.set(r.id, { ...r });
  for (const c of live) if (c?.id && !byId.has(c.id)) byId.set(c.id, { id: c.id, name: c.name, layer: c.layer, line: c.line || null, lineName: c.lineName || null, level: null, label: '未评级', added: { date: null, basis: 'unknown' } });
  const rows = [];
  for (const r of byId.values()) {
    const exp = experienceOf(r.id, experienceRows);
    let date = r.added?.date || null, basis = r.added?.basis || 'unknown';
    const firstRun = day(exp.firstAt);
    if (firstRun && UPPER_BOUND.has(basis) && (!date || firstRun < date)) { date = firstRun; basis = 'experience-first-run'; }
    const name = live.find((c) => c.id === r.id)?.name || r.name || r.id;
    rows.push({ id: r.id, name, layer: r.layer || 'voxel', line: r.line || null, lineName: r.lineName || r.line || '未归线',
      date, basis, basisLabel: BASIS_LABEL[basis] || basis, scenes: scenesFor(r.layer), target: targetFor(r.layer),
      level: Number.isFinite(r.level) ? r.level : null, levelLabel: r.label || '未评级', missing: r.missing || [],
      runs: exp.runs, passed: exp.passed, committed: exp.committed, lastRunAt: exp.lastAt });
  }
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (UPPER_BOUND.has(a.basis) - UPPER_BOUND.has(b.basis)) || a.id.localeCompare(b.id));
  const shown = rows.slice(0, Math.max(0, limit));
  const source = Array.isArray(maturity?.rows) ? 'maturity' : 'live-only';
  const upper = shown.filter((r) => UPPER_BOUND.has(r.basis)).length;
  return { rows: shown, all: rows, total: rows.length, source,
    note: source === 'live-only' ? '成熟度数据未生成：只列页面上已登记的能力，日期未知。在 TigerMessenger 目录跑 build-capability-maturity.mjs 后刷新。'
      : upper ? `其中 ${upper} 项的日期只是上限（登记文件修改时间或本机首次执行），不是确切加入日。` : '日期依据逐项写在括号里。' };
}
