/**
 * capability-tree.js — 能力树：把两个代码目录合成一棵树。
 *
 *   REACode            广度：作者做过的东西几乎都在，但没重构，可能带瑕疵
 *   REACodeRefactoring 深度：重构过、有测试，但只覆盖其中一部分
 *
 * 结构（借用四种成熟做法，各管一件事）：
 *   科技树（前置解锁）      根 → 枝 → 能力线，线与线之间是「先有谁才能做谁」（lineage.requires）
 *   成熟度阶梯（TRL 式）    每条线的层级：仅来源 → 已学习 → 部分实现 → 代码完成 → 可执行 → 采用过
 *                          （能力级的九级成熟度在 capability-maturity.js，由 build-capability-maturity.mjs 按证据文件判定，R23）
 *   演化轴（Wardley 式）    每条线沿作者时间线的代际 A → A+ → A++（lineage.generations）
 *   双源对账（知识图谱式）  每个原版文件对到重构落点：已嫁接 / 接口没带全 / 只在原版（野枝）
 *
 * 由此算出三样可以直接行动的东西：
 *   嫁接队列   只在 REACode、或接口没带全的原版文件，按「系统多需要它」排序 —— 下一步该重构谁
 *   解锁前沿   前置都已可执行、自己还不能执行的能力线 —— 最容易长出新可执行能力的位置
 *   目标路径   一个游戏目标（例如「圣城山形」）要用到哪些可执行能力、各自来自两库的哪些文件
 *
 * 只做归类与排序，不提升任何验收状态。输入全部来自 buildCapabilityLineage 与源码扫描。
 */
export const BRANCHES = [
  { id: 'space', name: '空间基座', does: '网格、约束、球面：所有东西落在哪', lines: ['grid', 'wfc', 'sphere', 'tools'] },
  { id: 'land', name: '地貌', does: '山、岸、岩层、水往哪流', lines: ['terrain', 'shore', 'sediment', 'water-effects'] },
  { id: 'build', name: '构筑', does: '房子、街巷、墙面', lines: ['building', 'hallway'] },
  { id: 'render', name: '光影与画面', does: '怎么被看见', lines: ['light', 'shadows', 'reflection', 'lines', 'palette', 'atlas', 'camera'] },
  { id: 'life', name: '生命与天气', does: '会动的东西', lines: ['plants', 'animals', 'wind', 'smoke', 'fire'] },
  { id: 'play', name: '玩法', does: '走、打、赢', lines: ['navigation', 'combat', 'projectiles', 'campaign'] },
  { id: 'express', name: '表达', does: '界面与装饰', lines: ['ui-decoration'] },
];
export const GRAFT_FORMULA = '嫁接分 = 只在原版(+6) + 没带过来的接口数(每个+1，≤6) + 依赖本线的能力线(每条+2) + 本线还不能执行(+3) + 有目标正在用本线(+4)';
const short = (n) => String(n || '').split(/[：:]/)[0];
const repoOf = (p) => (/REACodeRefactoring\//.test(p) ? 'refactored' : /REACode\//.test(p) ? 'original' : 'system');

export function buildCapabilityTree(lineage, { alignment = [], executables = [], jev = null } = {}) {
  const align = new Map(alignment.map((a) => [a.source, a])), byLine = new Map(lineage.lines.filter((l) => l.kind === 'line').map((l) => [l.id, l]));
  const jevRows = Object.entries(jev?.assignments || {}).filter(([, v]) => v.accepted && byLine.has(v.line));
  // 目标：带 line + sources 的可执行能力按 domain 成组（系统工坊里一条专用管线 = 一个游戏目标）
  const goalsBy = new Map();
  for (const e of executables) if (e.line && e.sources && e.domain) { if (!goalsBy.has(e.domain)) goalsBy.set(e.domain, []); goalsBy.get(e.domain).push(e); }
  const GOAL_NAME = { mountain: '圣城山形：有山的模样', battle: '场景战役：Bad North 玩法层' };
  const goals = [...goalsBy].map(([domain, caps]) => ({
    id: domain, name: GOAL_NAME[domain] || domain, tier: caps[0].tier,
    needs: caps.map((c) => ({ id: c.id, name: c.name, does: c.does, line: c.line, lineName: short(byLine.get(c.line)?.name), requires: c.requires || [], executable: true,
      sources: [...(c.sources || []).map((p) => [p, true]), ...(c.ideas || []).map((p) => [p, false])].map(([p, used]) => ({ path: p.replace(/^townscaper-web\/(REACodeRefactoring|REACode)\//, ''), repo: repoOf(p), used })) })),
  }));
  for (const g of goals) { const all = g.needs.flatMap((n) => n.sources); g.lines = [...new Set(g.needs.map((n) => n.line))]; g.called = all.filter((s) => s.used).length; g.fromOriginal = all.filter((s) => s.repo === 'original').length; g.fromRefactored = all.filter((s) => s.repo === 'refactored').length; }
  const goalLines = new Set(goals.flatMap((g) => g.lines));

  const nodes = new Map();
  for (const [id, l] of byLine) {
    const originals = l.originals.map((o) => ({ ...o, by: 'lineage' })), modules = l.modules.map((p) => ({ path: p, by: 'lineage' }));
    for (const [key, v] of jevRows) if (v.line === id) { if (key.startsWith('o:')) originals.push({ source: key.slice(2), status: align.get(key.slice(2))?.status || 'requires-parity-review', by: 'jev', confidence: v.confidence }); else modules.push({ path: key.slice(2), by: 'jev', confidence: v.confidence }); }
    const leaves = originals.map((o) => { const a = align.get(o.source), unmatched = a?.unmatchedExports?.length || 0, wild = o.status === 'missing-target';
      return { source: o.source, by: o.by, state: wild ? 'wild' : o.status === 'scoped-verified' ? 'verified' : unmatched ? 'partial' : 'grafted', unmatched, unmatchedExports: (a?.unmatchedExports || []).slice(0, 8), targets: (a?.targets || []).filter((t) => t.exists).map((t) => t.path).slice(0, 4), gap: a?.gap || '' }; });
    const execs = [...new Set([...l.executables, ...executables.filter((e) => e.line === id).map((e) => e.id)])];
    const count = (s) => leaves.filter((x) => x.state === s).length;
    nodes.set(id, { id, name: short(l.name), question: l.question || '', from: l.from, level: l.level, generations: l.generations.length, frontier: l.frontier >= 0 ? l.generations[l.frontier].label : null,
      target: l.target ? { label: l.target.label, mode: l.target.mode } : null, requires: (l.requires || []).map((r) => r.id || r.line || r).filter((x) => byLine.has(x)), requiredBy: (l.requiredBy || []).map((r) => r.id || r.line || r).filter((x) => byLine.has(x)),
      breadth: leaves.length, depth: modules.length, executables: execs, wild: count('wild'), partial: count('partial'), grafted: count('grafted') + count('verified'), unmatched: leaves.reduce((s, x) => s + x.unmatched, 0),
      jev: leaves.filter((x) => x.by === 'jev').length + modules.filter((x) => x.by === 'jev').length, leaves, modules, inGoal: goalLines.has(id),
      state: execs.length ? 'fruit' : l.level >= 3 ? 'bud' : l.level >= 2 ? 'growing' : 'seed' });
  }
  const placed = new Set(BRANCHES.flatMap((b) => b.lines)), rest = [...nodes.keys()].filter((id) => !placed.has(id));
  const branches = [...BRANCHES, ...(rest.length ? [{ id: 'other', name: '未分枝', does: '新出现的能力线', lines: rest }] : [])].map((b) => {
    const lines = b.lines.map((id) => nodes.get(id)).filter(Boolean), sum = (k) => lines.reduce((s, n) => s + (Array.isArray(n[k]) ? n[k].length : n[k]), 0);
    return { ...b, lines: lines.map((n) => n.id), breadth: sum('breadth'), depth: sum('depth'), executables: sum('executables'), wild: sum('wild'), partial: sum('partial') };
  }).filter((b) => b.lines.length);
  // 嫁接队列
  const grafts = [];
  for (const n of nodes.values()) for (const leaf of n.leaves) {
    if (leaf.state !== 'wild' && leaf.state !== 'partial') continue; if (/\.html$/.test(leaf.source) && leaf.state !== 'wild') continue;
    const score = (leaf.state === 'wild' ? 6 : 0) + Math.min(6, leaf.unmatched) + 2 * n.requiredBy.length + (n.executables.length ? 0 : 3) + (n.inGoal ? 4 : 0);
    grafts.push({ source: leaf.source, line: n.id, lineName: n.name, state: leaf.state, unmatched: leaf.unmatched, unmatchedExports: leaf.unmatchedExports, targets: leaf.targets, score,
      why: [leaf.state === 'wild' ? '只在原版，重构库没有落点' : `${leaf.unmatched} 个接口没带过来`, n.requiredBy.length ? `${n.requiredBy.length} 条线依赖「${n.name}」` : '', n.executables.length ? '' : '本线还不能执行', n.inGoal ? '有目标正在用本线' : ''].filter(Boolean).join(' · ') });
  }
  grafts.sort((a, b) => b.score - a.score || a.source.localeCompare(b.source)); grafts.forEach((g, i) => { g.rank = i + 1; });
  // 解锁前沿
  const frontier = [...nodes.values()].filter((n) => !n.executables.length && n.requires.every((r) => nodes.get(r)?.executables.length)).map((n) => ({ id: n.id, name: n.name, level: n.level, requires: n.requires, requiredBy: n.requiredBy.length, depth: n.depth }))
    .sort((a, b) => b.requiredBy - a.requiredBy || b.level - a.level);
  const all = [...nodes.values()], total = (k) => all.reduce((s, n) => s + (Array.isArray(n[k]) ? n[k].length : n[k]), 0);
  const unplaced = { originals: Math.max(0, (lineage.originals?.unclassified?.length || 0) - jevRows.filter(([k]) => k.startsWith('o:')).length), modules: Math.max(0, (lineage.unownedModules?.length || 0) - jevRows.filter(([k]) => k.startsWith('m:')).length) };
  return { schemaVersion: 1, branches, nodes: Object.fromEntries(nodes), grafts, graftFormula: GRAFT_FORMULA, frontier, goals,
    // executables = 按线求和（一个能力归几条线就算几次）；executablesUnique = 按能力 ID 去重（R23 统一口径，对外用这个）；executablesLinked = 至少归到一条线的去重数
    summary: { branches: branches.length, lines: all.length, breadth: total('breadth'), depth: total('depth'), executables: total('executables'), executablesUnique: new Set([...executables.map((e) => e.id), ...all.flatMap((n) => n.executables)]).size, executablesLinked: new Set(all.flatMap((n) => n.executables)).size, wild: total('wild'), partial: total('partial'), grafted: total('grafted'), unmatched: total('unmatched'),
      fruit: all.filter((n) => n.state === 'fruit').length, jevPlaced: jevRows.length, jevAnswered: jev?.answered || 0, unplaced, goals: goals.length },
    limits: ['「已嫁接」只表示原版文件有重构落点且导出名都对得上，不代表行为等价（仍是待逐项核对）。', 'JEV 归线只看路径 / 导出 / 文件头文字，置信度低于 0.85 的不归线。', '目标路径里「调用」是能力代码真正 import 的库模块；「出处」是两库里的同类实现，只作方法参考，没有被调用。'] };
}
