/**
 * capability-lineage.js — 能力谱系：把作者时间线（capability-evolution）算成「能力线 → 代际 → 到达位置 → 下一目标」。
 *
 * 输入全部是已有事实，不新增判断来源：
 *   evolution   buildCapabilityEvolution() 的结果（来源、主题、关系、partial 批注、源码落点）
 *   modules     物理源码扫描（路径 + import 依赖），可缺省
 *   executables 已登记的可执行能力（meta/match/run 的只读描述，带来源帖子 ID 或源码模块）
 *   experience  { 能力ID: { runs, passed, failed, committed, lastFailure } }，系统工坊本机执行经验
 *   demand      [{ id, name, clips, reason }]：管线里已经放了、但还不能执行的节点（系统需要而能力库没有）
 *   alignment   原版 REACode 文件 → 重构落点（扫描结果），用于把原版文件归到能力线
 *   consumers   场景消费清单（scan-scene-consumers.mjs）：每个场景实际 import 的模块及其与最新库的差异
 *
 * 输出只是排序与归类，不提升任何验收状态：代码完成 ≠ 可执行 ≠ 已采用。
 */
export const LEVELS = [
  { id: 0, key: 'source', mark: '·', name: '仅有来源' },
  { id: 1, key: 'learned', mark: '○', name: '已学习 · 无代码' },
  { id: 2, key: 'partial', mark: '◐', name: '部分实现' },
  { id: 3, key: 'code', mark: '●', name: '代码完成' },
  { id: 4, key: 'executable', mark: '⚙', name: '可执行能力' },
  { id: 5, key: 'accepted', mark: '★', name: '执行并采用过' },
];
/** 代际跃迁：这些关系表示「后一条比前一条更进一步」。说明 / 复用 / 分支不开新一代。 */
export const STEP_RELATIONS = new Set(['extends', 'improves', 'supersedes', 'adapts', 'revisits']);
const PRIORITY_WEIGHT = { 高: 30, 中: 20, 低: 10, 待复核: 15, 待评估: 15 };
export const SCORE_FORMULA = '得分 = 优先级(高30/中20/低10) + 本线向前的下一步(+6) − 已有更新一代完成代码的非高优先回补(−4) + 是后续版本的前身(每条+3，≤9) + 被其他能力线依赖(每条+2，≤10) + 本线已有可执行能力(+2) + 管线已放入但不能执行(+8) + 执行验证失败(每次+4，≤8)；被后续方案替代的缺口不进队列。';

const genLabel = (k) => (k === 0 ? 'A' : k <= 3 ? 'A' + '+'.repeat(k) : 'A+' + k);
const clipIdsOf = (x) => [...new Set([...(x.learn || []), ...(x.related || []), ...(x.sources || []), ...(x.sourceVideos || []), ...(x.clips || [])].map(String))];

export function buildCapabilityLineage(evolution, { modules = [], executables = [], experience = {}, demand = [], alignment = [], consumers = [] } = {}) {
  if (!Array.isArray(evolution?.events) || !Array.isArray(evolution?.families) || !Array.isArray(evolution?.relations)) throw Error('能力谱系需要演进模型');
  const byId = new Map(evolution.events.map((e) => [e.id, e]));
  const edges = new Map(evolution.relations.map((r) => [r.id, r]));
  const validEdge = (key) => { const r = edges.get(key); return r?.valid ? r : null; };

  // ── 1. 源码归线：模块归给引用它最多的能力线；没有来源的模块按「谁 import 它」推断 ──────────────
  const owner = new Map(), ownerBasis = new Map();
  for (const [path, m] of Object.entries(evolution.moduleIndex || {})) {
    const votes = new Map();
    for (const id of m.clips) for (const f of byId.get(id)?.families || []) if (!f.startsWith('topic:') && f !== 'reference') votes.set(f, (votes.get(f) || 0) + 1);
    const best = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) { owner.set(path, best[0]); ownerBasis.set(path, 'source-clips'); }
  }
  const modByPath = new Map(modules.map((m) => [m.path, m]));
  const importers = new Map();
  for (const m of modules) for (const d of m.dependencies || []) { if (!importers.has(d.path)) importers.set(d.path, []); importers.get(d.path).push(m.path); }
  for (let pass = 0, changed = true; changed && pass < 6; pass++) {
    changed = false;
    for (const m of modules) {
      if (owner.has(m.path)) continue;
      const votes = new Map();
      for (const p of importers.get(m.path) || []) { const o = owner.get(p); if (o) votes.set(o, (votes.get(o) || 0) + 1); }
      const best = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (best) { owner.set(m.path, best[0]); ownerBasis.set(m.path, 'import-inference'); changed = true; }
    }
  }

  // ── 2. 可执行能力 → 来源帖子 / 源码模块 → 能力线 ─────────────────────────────────────
  const execByClip = new Map(), execByLine = new Map(), execRows = [];
  for (const x of executables) {
    const clips = clipIdsOf(x).filter((id) => byId.has(id));
    const lines = new Set();
    for (const id of clips) for (const f of byId.get(id).families) if (!f.startsWith('topic:') && f !== 'reference') lines.add(f);
    for (const p of x.modules || []) if (owner.has(p)) lines.add(owner.get(p));
    const exp = experience[x.id] || null;
    const row = { id: x.id, name: x.name, tier: x.tier || 'scene', clips, modules: x.modules || [], lines: [...lines], experience: exp, accepted: !!exp?.committed, basis: clips.length ? 'source-clips' : (x.modules || []).length ? 'module-owner' : 'unlinked' };
    execRows.push(row);
    for (const id of clips) { if (!execByClip.has(id)) execByClip.set(id, []); execByClip.get(id).push(row); }
    for (const f of lines) { if (!execByLine.has(f)) execByLine.set(f, []); execByLine.get(f).push(row); }
  }
  const demandByClip = new Map();
  for (const d of demand) for (const id of (d.clips || []).map(String)) { if (!demandByClip.has(id)) demandByClip.set(id, []); demandByClip.get(id).push(d); }

  // ── 3. 每条来源的层级 ────────────────────────────────────────────────────────────
  function levelOf(e) {
    if (e.status === 'ref' || e.status === 'na') return null;                       // 参考 / 不适用：不上阶梯
    const code = e.status === 'done' ? 3 : e.status === 'partial' ? (e.modules.length ? 2 : 1) : e.status ? 1 : 0;
    const ex = execByClip.get(e.id) || [];
    return { code, shown: ex.some((x) => x.accepted) ? 5 : ex.length ? 4 : code };
  }
  const supersededBy = (e) => e.outgoing.map(validEdge).filter((r) => r?.type === 'supersedes').map((r) => r.toId);

  // ── 4. 能力线：按发布时间切成代际 ────────────────────────────────────────────────
  const lines = evolution.families.map((f) => {
    const kind = f.id === 'reference' ? 'reference' : f.unreviewed ? 'unreviewed' : 'line';
    const events = f.clips.map((id) => byId.get(id));
    const generations = [], loose = []; let current = null, lastPhase = null;   // loose：没有进入任何一代的参考 / 展示记录
    for (const e of events) {
      const lv = levelOf(e);
      const step = e.incoming.map(validEdge).find((r) => r && STEP_RELATIONS.has(r.type));
      const opens = lv && kind === 'line' && (!current || step || (lastPhase && e.phase !== lastPhase));
      if (opens) {
        current = { index: generations.length, label: genLabel(generations.length), headId: e.id, from: e.date, to: e.date, phase: e.phase, projectLabel: e.projectLabel,
          title: e.methods[0]?.name && e.methods[0].name !== '（无原文）' ? e.methods[0].name : (e.text || e.note || e.id).slice(0, 90),
          via: step ? { type: step.type, label: step.label, reason: step.reason, fromId: step.fromId } : lastPhase && e.phase !== lastPhase ? { type: 'phase', label: '进入新阶段', reason: `作者在 ${e.projectLabel} 阶段再次处理这一问题。`, fromId: null } : null,
          members: [] };
        generations.push(current);
      }
      if (lv) lastPhase = e.phase;
      const member = { id: e.id, date: e.date, phase: e.phase, status: e.status || 'unknown', level: lv?.shown ?? null, codeLevel: lv?.code ?? null, priority: e.completion?.priority || null,
        superseded: supersededBy(e), executables: (execByClip.get(e.id) || []).map((x) => x.id), modules: e.modules, title: (e.methods[0]?.name && e.methods[0].name !== '（无原文）' ? e.methods[0].name : e.text || e.note || e.id).slice(0, 90) };
      if (current) { current.members.push(member); if (e.date) current.to = e.date; } else loose.push(member);
    }
    for (const g of generations) {
      const live = g.members.filter((m) => m.level !== null);
      g.gaps = live.filter((m) => m.status === 'partial' && !m.superseded.length).map((m) => m.id);
      g.level = Math.max(0, ...live.map((m) => m.level));
      g.codeLevel = Math.max(0, ...live.map((m) => m.codeLevel));
      g.state = g.codeLevel >= 3 && !g.gaps.length ? 'complete' : g.codeLevel >= 2 ? 'building' : 'learning';
      g.counts = { done: live.filter((m) => m.status === 'done').length, partial: live.filter((m) => m.status === 'partial').length, reference: g.members.length - live.length };
    }
    const all = [...generations.flatMap((g) => g.members), ...loose];
    // frontier：有完成代码的最新一代；solid：从 A 起连续「完成且无缺口」到第几代（-1 = 连 A 都还有缺口）
    let frontier = -1; generations.forEach((g, i) => { if (g.codeLevel >= 3) frontier = i; });
    const firstOpen = generations.findIndex((g) => g.state !== 'complete'), solid = firstOpen < 0 ? generations.length - 1 : firstOpen - 1;
    // 方向永远向前：先补「已完成的最新一代」之后的缺口（A 已有 A+ 时，不回头把 A 做满）；前面没有缺口了才回补旧代
    const advance = generations.find((g) => g.index > frontier && g.gaps.length), backfillGaps = generations.filter((g) => g.index <= frontier).reduce((n, g) => n + g.gaps.length, 0);
    const targetGen = advance || generations.find((g) => g.gaps.length) || null;
    const rank = (id) => ['高', '中', '低'].indexOf(byId.get(id).completion?.priority) + 1 || 4;
    const targetId = targetGen ? [...targetGen.gaps].sort((a, b) => rank(a) - rank(b) || (byId.get(a).date || '').localeCompare(byId.get(b).date || ''))[0] : null;
    const ex = execByLine.get(f.id) || [];
    const mods = [...owner].filter(([, o]) => o === f.id).map(([p]) => p).sort();
    const line = { id: f.id, name: f.name, kind, question: f.question || '', scope: f.scope || '', recommendation: f.recommendation || '', from: f.from, to: f.to, generations,
      counts: { sources: f.clips.length, done: all.filter((m) => m.status === 'done').length, partial: all.filter((m) => m.status === 'partial').length, gaps: generations.reduce((n, g) => n + g.gaps.length, 0), reference: events.length - all.filter((m) => m.level !== null).length, modules: mods.length, inferredModules: mods.filter((p) => ownerBasis.get(p) === 'import-inference').length },
      modules: mods, executables: ex.map((x) => x.id), frontier, solid, loose,
      target: targetGen ? { generation: targetGen.index, label: targetGen.label, clip: targetId, mode: advance ? 'advance' : 'backfill' } : null, backfillGaps, requires: [], requiredBy: [], related: [], originals: [] };
    line.level = Math.max(0, ...generations.map((g) => g.level));
    return line;
  });
  const lineById = new Map(lines.map((l) => [l.id, l]));

  // ── 5. 组合：能力线之间的前置关系（源码 import 方向 + 有依据的跨线关系） ───────────────────
  const weight = new Map(), bump = (a, b, n = 1) => { if (a === b || !lineById.has(a) || !lineById.has(b)) return; const k = a + '>' + b; weight.set(k, (weight.get(k) || 0) + n); };
  // 装配入口（一个文件 import 十几个模块的场景 / 视图）表示「谁把大家装在一起」，不表示能力之间的先后，不计入前置
  const HUB = 10;
  for (const m of modules) { const a = owner.get(m.path); if (a && (m.dependencies || []).length <= HUB) for (const d of m.dependencies || []) { const b = owner.get(d.path); if (b) bump(a, b); } }
  const crossRelations = [];
  for (const r of evolution.relations) {
    if (!r.valid) continue;
    const A = byId.get(r.fromId).families.filter((f) => lineById.get(f)?.kind === 'line'), B = byId.get(r.toId).families.filter((f) => lineById.get(f)?.kind === 'line');
    for (const a of A) for (const b of B) if (a !== b) { crossRelations.push({ from: a, to: b, type: r.type, label: r.label, fromId: r.fromId, toId: r.toId, reason: r.reason }); if (['combines', 'reuses', 'adapts', 'extends', 'improves'].includes(r.type)) bump(b, a, 2); }
  }
  for (const a of lines) for (const b of lines) {
    if (a === b) continue;
    const ab = weight.get(a.id + '>' + b.id) || 0, ba = weight.get(b.id + '>' + a.id) || 0;
    if (ab >= 2 && ab > ba) { a.requires.push({ id: b.id, weight: ab, back: ba }); b.requiredBy.push({ id: a.id, weight: ab }); }
    else if (ab && ab === ba && a.id < b.id) { a.related.push({ id: b.id, weight: ab }); b.related.push({ id: a.id, weight: ab }); }
  }
  const dated = (a, b) => (lineById.get(a.id ?? a).from || '9999').localeCompare(lineById.get(b.id ?? b).from || '9999');
  for (const l of lines) { l.requires.sort((a, b) => b.weight - a.weight || dated(a, b)); l.requiredBy.sort((a, b) => b.weight - a.weight); }
  // 传递前置：只沿权重 ≥2 的主要依赖走，按能力线诞生时间排（先有的先做）
  function closure(id) {
    const seen = new Set(), walk = (x, depth) => { for (const r of lineById.get(x).requires) if ((depth === 0 || r.weight >= 4) && !seen.has(r.id) && r.id !== id) { seen.add(r.id); if (depth < 2) walk(r.id, depth + 1); } };
    walk(id, 0); return [...seen].sort(dated);
  }
  const dependents = new Map(lines.map((l) => [l.id, 0]));
  const combinations = [];
  for (const l of lines) {
    if (l.kind !== 'line') continue;
    const pre = closure(l.id); for (const p of pre) dependents.set(p, dependents.get(p) + 1);
    const order = [...pre, l.id];
    // steps：本线自己的可执行能力；前置线的可执行能力单列，不混进本线的步骤
    const stepOf = (id) => (execByLine.get(id) || []).map((x) => ({ id: x.id, name: x.name, tier: x.tier, line: id }));
    const uniq = stepOf(l.id), own = new Set(uniq.map((s) => s.id));
    const prerequisiteSteps = pre.map((id) => ({ line: id, steps: stepOf(id).filter((s) => !own.has(s.id)) })).filter((p) => p.steps.length);
    const blocking = order.filter((id) => lineById.get(id).frontier < 0);
    combinations.push({ id: 'lineage:' + l.id, line: l.id, name: l.name.split(/[：:]/)[0] + (pre.length ? ' ← ' + pre.map((p) => lineById.get(p).name.split(/[：:]/)[0]).join(' · ') : ''), order, prerequisites: pre, steps: uniq, prerequisiteSteps,
      readiness: blocking.length ? 'learning' : (execByLine.get(l.id) || []).length ? 'runnable' : 'needs-adapter', blocking,
      note: blocking.length ? '前置能力线还没有完成的代码：' + blocking.map((id) => lineById.get(id).name.split(/[：:]/)[0]).join('、') : (execByLine.get(l.id) || []).length ? '本线已有可执行能力；前置线按顺序排在前面。' : '代码已有，尚未封装成可执行能力（meta / match / run）。' });
  }

  // ── 6. 原版 REACode 文件归线 ─────────────────────────────────────────────────────
  const originals = { total: alignment.length, classified: 0, unclassified: [] };
  for (const row of alignment) {
    const votes = new Map();
    for (const t of row.targets || []) { const o = owner.get(t.path); if (o) votes.set(o, (votes.get(o) || 0) + 2); }
    for (const id of row.clips || []) for (const f of byId.get(String(id))?.families || []) if (lineById.get(f)?.kind === 'line') votes.set(f, (votes.get(f) || 0) + 3);
    const best = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) { lineById.get(best[0]).originals.push({ source: row.source, status: row.status }); originals.classified++; } else originals.unclassified.push({ source: row.source, status: row.status });
  }

  // ── 7. 补学队列：每个缺口算分，说明理由 ────────────────────────────────────────────
  const queue = [];
  for (const l of lines) {
    if (l.kind !== 'line') continue;
    const failures = (execByLine.get(l.id) || []).reduce((n, x) => n + (x.experience?.failed || 0), 0);
    let firstOpen = true;
    for (const g of l.generations) for (const id of g.gaps) {
      const e = byId.get(id), c = e.completion || {}, why = [];
      let score = PRIORITY_WEIGHT[c.priority] ?? 15; why.push('优先级 ' + (c.priority || '待评估'));
      const isTarget = l.target?.clip === id; if (isTarget) { score += 6; why.push(l.target.mode === 'advance' ? '本线向前的下一步' : '本线只剩回补'); }
      else if (g.index < l.frontier && c.priority !== '高') { score -= 4; why.push('已有更新一代的完成代码，回补可后置'); }
      const next = e.outgoing.map(validEdge).filter((r) => r && STEP_RELATIONS.has(r.type)).length; if (next) { score += Math.min(9, next * 3); why.push(`是 ${next} 条后续版本的前身`); }
      const dep = dependents.get(l.id); if (dep) { score += Math.min(10, dep * 2); why.push(`${dep} 条能力线以它为前置`); }
      if (l.executables.length) { score += 2; why.push('本线已有可执行能力在用'); }
      const dm = demandByClip.get(id); if (dm) { score += 8; why.push('管线已放入但不能执行：' + dm.map((d) => d.name).join('、')); }
      if (failures) { score += Math.min(8, failures * 4); why.push(`本线执行验证失败 ${failures} 次`); }
      queue.push({ id, line: l.id, lineName: l.name, generation: g.label, date: e.date, title: (e.methods[0]?.name && e.methods[0].name !== '（无原文）' ? e.methods[0].name : e.text || e.note || id).slice(0, 110), priority: c.priority || '待评估', current: c.current !== false, score, why,
        gap: c.sourceGap || '', nextAction: c.nextAction || '', acceptance: c.acceptance || '', modules: e.modules, isTarget, afterTarget: !firstOpen && !isTarget });
      firstOpen = false;
    }
  }
  queue.sort((a, b) => b.score - a.score || (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id));
  // 同一条来源属于多条能力线时只排一次：留得分最高的那条线，其余记在 alsoIn
  const firstRow = new Map();
  for (let i = 0; i < queue.length; i++) { const q = queue[i], kept = firstRow.get(q.id); if (kept) { kept.alsoIn.push(q.line); queue.splice(i--, 1); } else { q.alsoIn = []; firstRow.set(q.id, q); } }
  queue.forEach((q, i) => { q.rank = i + 1; });

  // ── 8. 适配队列：代码已完成、还没有可执行能力的能力线（学习 → 实现与适配 → 能力库） ─────────
  const adaptQueue = lines.filter((l) => l.kind === 'line' && l.frontier >= 0 && !l.executables.length)
    .map((l) => ({ line: l.id, name: l.name, generation: l.generations[l.frontier].label, doneClips: l.counts.done, modules: l.modules.slice(0, 8), requiredBy: l.requiredBy.length, demanded: l.generations.some((g) => g.members.some((m) => demandByClip.has(m.id))) }))
    .sort((a, b) => b.demanded - a.demanded || b.requiredBy - a.requiredBy || b.doneClips - a.doneClips);
  // 管线需要、但来源已是「代码完成」的条目：缺的是执行适配而不是学习
  const demandRows = demand.map((d) => { const clips = (d.clips || []).map(String).filter((id) => byId.has(id)); return { ...d, clips, lines: [...new Set(clips.flatMap((id) => byId.get(id).families.filter((f) => lineById.get(f)?.kind === 'line')))], needs: clips.some((id) => byId.get(id).status === 'partial') ? 'learning' : clips.length ? 'adapter' : 'source' }; });

  // ── 9. 能力网：能力线为节点、前置为边，按前置深度分层 ──────────────────────────────────
  const real = lines.filter((l) => l.kind === 'line');
  // 层 = 最长前置链；只沿主要前置（权重 ≥2 且占该线最大权重的四成以上）走，遇到环跳过回边
  const layer = new Map(), walking = new Set();
  const main = (l) => { const top = Math.max(0, ...l.requires.map((r) => r.weight)); return l.requires.filter((r) => r.weight >= Math.max(2, top * 0.4)); };
  const depth = (id) => { if (layer.has(id)) return layer.get(id); if (walking.has(id)) return -1; walking.add(id); let d = 0; for (const r of main(lineById.get(id))) { const k = depth(r.id); if (k >= 0) d = Math.max(d, k + 1); } walking.delete(id); layer.set(id, d); return d; };
  for (const l of [...real].sort((a, b) => (a.from || '').localeCompare(b.from || ''))) depth(l.id);
  const net = { nodes: real.map((l) => ({ id: l.id, name: l.name, layer: layer.get(l.id), isolated: !l.requires.length && !l.requiredBy.length, from: l.from, generations: l.generations.map((g) => ({ label: g.label, state: g.state, gaps: g.gaps.length })), frontier: l.frontier, target: l.target?.generation ?? null, executables: l.executables.length, gaps: l.counts.gaps })),
    edges: real.flatMap((l) => { const m = new Set(main(l).map((r) => r.id)); return l.requires.map((r) => ({ from: r.id, to: l.id, weight: r.weight, main: m.has(r.id) })); }) };

  // ── 10. 场景诊断：场景 → 模块 → 能力线 / 代际 → 差在哪里、怎么补 ─────────────────────────
  const genModules = (g) => [...new Set(g.members.flatMap((m) => m.modules))].filter((p) => !modByPath.size || modByPath.has(p));
  const diagnoses = consumers.map((c) => {
    const used = new Map((c.modules || []).map((m) => [m.path, m]));
    const rows = [];
    for (const l of real) {
      const mine = l.modules.filter((p) => used.has(p)); if (!mine.length) continue;
      const stale = mine.filter((p) => used.get(p).state === 'different').map((p) => ({ path: p, bytes: used.get(p).bytes, libraryBytes: used.get(p).libraryBytes, copiedAt: used.get(p).copiedAt, direct: used.get(p).direct }));
      const inGen = new Set();
      const gens = l.generations.map((g) => {
        const mods = genModules(g); mods.forEach((p) => inGen.add(p));
        const hit = mods.filter((p) => used.has(p)), fresh = hit.filter((p) => used.get(p).state !== 'different');
        const state = !mods.length ? 'no-code' : fresh.length ? 'in-scene' : hit.length ? 'stale' : 'not-wired';
        return { index: g.index, label: g.label, from: g.from, title: g.title, headId: g.headId, codeState: g.state, state, used: hit, missing: mods.filter((p) => !used.has(p)) };
      });
      const reached = gens.filter((g) => g.state === 'in-scene' || g.state === 'stale').at(-1) || null;
      const other = l.modules.filter((p) => !used.has(p) && !inGen.has(p));
      rows.push({ line: l.id, name: l.name, modules: mine.length, stale, generations: gens, reached: reached?.label || null, libraryReached: l.frontier >= 0 ? l.generations[l.frontier].label : null, otherUnwired: other,
        learn: queue.filter((q) => q.line === l.id || q.alsoIn.includes(l.id)).slice(0, 3).map((q) => ({ id: q.id, rank: q.rank, generation: q.generation, title: q.title, gap: q.gap, nextAction: q.nextAction })) });
    }
    rows.sort((a, b) => b.modules - a.modules);
    // 引导：先把旧副本同步到库 → 再接库里已有、场景没用的代际 → 最后才是库里也没学到位的缺口
    const guide = [];
    for (const r of rows) if (r.stale.length) guide.push({ kind: 'sync', line: r.line, title: `${r.name.split(/[：:]/)[0]}：${r.stale.length} 个模块是旧副本`, detail: r.stale.map((m) => `${m.path}（${m.bytes} → 库 ${m.libraryBytes} 字节）`), why: '场景用的是分叉的旧版本，库里后来的改动没有进到这个场景。换之前先做同机位对照：新版本不一定更好看。' });
    for (const r of rows) for (const g of r.generations) if (g.state === 'not-wired' && g.codeState !== 'learning') guide.push({ kind: 'wire', line: r.line, generation: g.label, clip: g.headId, title: `${r.name.split(/[：:]/)[0]} ${g.label}（${(g.from || '').slice(0, 4)}）库里有代码，场景没接`, detail: g.missing, why: g.title });
    for (const r of rows) if (r.otherUnwired.length && r.modules >= 2) guide.push({ kind: 'wire', line: r.line, title: `${r.name.split(/[：:]/)[0]}：本线另有 ${r.otherUnwired.length} 个库模块场景没用到`, detail: r.otherUnwired.slice(0, 12), why: '这些模块归在同一条能力线，但没有登记到具体代际；按需要接入。' });
    for (const r of rows) for (const q of r.learn) guide.push({ kind: 'learn', line: r.line, generation: q.generation, clip: q.id, title: `${r.name.split(/[：:]/)[0]} ${q.generation}：库里也还没学到位（队列 #${q.rank}）`, detail: [q.gap || q.title], why: q.nextAction });
    const usedOwned = (c.modules || []).filter((m) => owner.has(m.path)).length;
    return { id: c.id, name: c.name, entries: c.entries || [], notes: c.notes || [], counts: { ...(c.counts || {}), lines: rows.length, ownedModules: usedOwned, sync: guide.filter((g) => g.kind === 'sync').length, wire: guide.filter((g) => g.kind === 'wire').length, learn: guide.filter((g) => g.kind === 'learn').length }, lines: rows, guide };
  });

  const expRows = execRows.filter((x) => x.experience?.runs || x.experience?.committed);
  const loop = {
    sources: evolution.events.length, lines: real.length, generations: real.reduce((n, l) => n + l.generations.length, 0),
    gaps: queue.length, gapRows: real.reduce((n, l) => n + l.counts.gaps, 0), highGaps: queue.filter((q) => q.priority === '高').length, adapt: adaptQueue.length,
    modules: modules.length, ownedModules: modules.filter((m) => owner.has(m.path)).length, inferredModules: [...ownerBasis.values()].filter((b) => b === 'import-inference').length,
    executables: execRows.length, linkedExecutables: execRows.filter((x) => x.lines.length).length, linesWithExecutables: real.filter((l) => l.executables.length).length,
    combinations: combinations.length, runnableCombinations: combinations.filter((c) => c.readiness === 'runnable').length,
    demand: demandRows.length, experienceCaps: expRows.length, runs: expRows.reduce((n, x) => n + (x.experience.runs || 0), 0), failed: expRows.reduce((n, x) => n + (x.experience.failed || 0), 0), committed: expRows.reduce((n, x) => n + (x.experience.committed || 0), 0),
    originals: originals.total, originalsClassified: originals.classified,
  };
  return { schemaVersion: 1, evolutionFingerprint: evolution.fingerprint || null, levels: LEVELS, formula: SCORE_FORMULA, lines, net, consumers: diagnoses, combinations, crossRelations, queue, adaptQueue, demand: demandRows, executables: execRows,
    moduleOwners: Object.fromEntries([...owner].map(([p, o]) => [p, { line: o, basis: ownerBasis.get(p) }])), unownedModules: modules.filter((m) => !owner.has(m.path)).map((m) => m.path), originals, loop,
    limits: ['代际按发布时间、阶段变化与已有依据的关系切分，是学习导航，不是作者唯一的思考路线。', '模块归线来自来源记录或 import 推断；推断归线只用于归类，不代表该模块实现了这条能力线。', '到达位置按原库 done / partial 状态计算；不重新验收，也不因日期更新自动升级。', '组合前置来自源码 import 方向与已有关系，仍需各自的执行适配与独立验证。'] };
}

/** 一句话说明这条线：系统到了哪一代，下一步朝哪走。 */
export function describeDirection(line, lineage) {
  if (line.kind !== 'line') return '参考与展示记录，不设实现目标。';
  if (!line.generations.length) return '只有参考记录，尚未形成可实现的代际。';
  const last = line.generations.at(-1), at = line.frontier >= 0 ? line.generations[line.frontier] : null;
  const head = at ? `代码已到 ${at.label}（${at.from?.slice(0, 4)} · ${at.projectLabel}）` : '还没有完成的代码';
  const exec = line.executables.length ? `，其中 ${line.executables.length} 项已是可执行能力` : at ? '，尚未封装成可执行能力' : '';
  if (!line.target) return `${head}${exec}；${line.generations.length} 代均无未补缺口${line.executables.length ? '' : '，下一步是执行适配'}。`;
  const t = line.generations[line.target.generation], q = lineage?.queue.find((x) => x.id === line.target.clip);
  const back = line.backfillGaps ? `；另有 ${line.backfillGaps} 处旧代回补` : '';
  if (line.target.mode === 'backfill') return `${head}${exec}，已是这条线的最新一代；剩余 ${line.backfillGaps} 处回补，先补 ${t.label}（${t.from?.slice(0, 4)}）${q ? '，队列第 ' + q.rank + ' 位' : ''}。`;
  return `${head}${exec}；向前下一步是 ${t.label}（${t.from?.slice(0, 4)}）${q ? '，队列第 ' + q.rank + ' 位' : ''}，终点 ${last.label}（${last.to?.slice(0, 4)}）${back}。`;
}
