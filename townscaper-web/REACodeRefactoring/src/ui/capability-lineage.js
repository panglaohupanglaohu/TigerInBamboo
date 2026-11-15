/**
 * capability-lineage.js（界面）— 学习工坊 ↔ 能力库的闭环总览，8769 学习管线与 8931 学习工坊共用。
 *   闭环图 → 能力成长图（每条能力线按发布时间排开）→ 代际阶梯（A → A+ → …，到了哪一代、下一步是哪一步）
 *   → 组合前置 → 补学队列（算分 + 理由）→ 适配队列 → 执行经验回流
 * 只读取计算结果；所有状态仍以原库 done / partial 与实际执行记录为准。
 */
import { buildCapabilityLineage, describeDirection, LEVELS } from '../core/capability-lineage.js';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const svg = (tag, attrs = {}, text) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
const short = (name) => name.split(/[：:]/)[0];
const LEVEL_COLOR = ['#7d8f94', '#8fa3a8', '#d9a441', '#3f9ca9', '#6fbf73', '#e8c14d'];
const STATE = { complete: '完成 · 无缺口', building: '部分实现', learning: '已学习 · 无完成代码' };
const TIER = { planet: '球系统', scene: '场景', object: '物件' };

export function renderCapabilityLineage(host, { evolution, modules = [], executables = [], experience = {}, demand = [], alignment = [], line: initialLine, onFocus, onUse, onStage, onState, experienceNote } = {}) {
  const lineage = buildCapabilityLineage(evolution, { modules, executables, experience, demand, alignment });
  const lines = lineage.lines.filter((l) => l.kind === 'line'), byLine = new Map(lineage.lines.map((l) => [l.id, l])), execById = new Map(lineage.executables.map((x) => [x.id, x]));
  const queueById = new Map(lineage.queue.map((q) => [q.id, q]));
  let selected = byLine.get(initialLine)?.kind === 'line' ? initialLine : (lineage.queue[0]?.line || lines[0]?.id), queueLimit = 8, queueLine = false;
  if (!document.getElementById('capability-lineage-css')) { const css = el('link'); css.id = 'capability-lineage-css'; css.rel = 'stylesheet'; css.href = new URL('./capability-lineage.css', import.meta.url); document.head.append(css); }
  const shell = el('section', undefined, 'capability-lineage'); shell.dataset.lineageLines = lines.length; shell.dataset.lineageQueue = lineage.queue.length; shell.dataset.lineageFingerprint = lineage.evolutionFingerprint || ''; host.append(shell);
  const L = lineage.loop;
  shell.append(el('small', 'LEARNING ⇄ CAPABILITY LIBRARY', 'lineage-eyebrow'), el('h2', '能力成长 · 学到哪一代，下一步补什么'),
    el('p', '作者先做出 A，再做出 A+。这里把每条能力线按发布时间排成代际，标出系统的代码到了哪一代、哪一代已能执行，再把缺口算成一条有先后的补学队列。', 'lineage-lead'));

  // ── 闭环图 ─────────────────────────────────────────────────────────────────
  const loop = el('div', undefined, 'lineage-loop'); loop.setAttribute('role', 'list'); loop.setAttribute('aria-label', '学习工坊与系统工坊的闭环');
  const sections = {};
  const stages = [
    ['sources', '来源材料', `${L.sources} 条视频来源`, L.originals ? `原版文件 ${L.originalsClassified}/${L.originals} 已归线` : '原片 · REACode · 重构源码', 'chart'],
    ['learning', '学习工坊', `${L.lines} 条能力线 · ${L.generations} 代`, `缺口 ${L.gaps}（高 ${L.highGaps}）`, 'ladder'],
    ['implement', '实现与适配', `补学队列 ${L.gaps}`, `待封装 ${L.adapt} 条线`, 'queue'],
    ['library', '能力库', `⚙ ${L.executables} 项可执行`, `源码 ${L.ownedModules}/${L.modules} 已归线`, 'adapt'],
    ['pipeline', '管线', `${L.runnableCombinations}/${L.combinations} 组合可排`, L.demand ? `${L.demand} 个节点等能力` : '无等待节点', 'combo'],
    ['execute', '调度 · Worker · 验证', `执行 ${L.runs} 次`, `验证失败 ${L.failed}`, 'experience'],
    ['adopt', '实景 · 采用 / 放弃', `采用 ${L.committed} 次`, '可撤销', 'experience'],
  ];
  stages.forEach(([id, name, a, b, target], i) => {
    const node = el('button', undefined, 'lineage-stage'); node.type = 'button'; node.dataset.stage = id; node.setAttribute('role', 'listitem');
    node.append(el('small', String(i + 1).padStart(2, '0')), el('b', name), el('span', a), el('span', b, 'lineage-dim'));
    node.onclick = () => { if (onStage?.(id) === true) return; sections[target]?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    loop.append(node);
  });
  const back = el('div', undefined, 'lineage-return'); back.append(el('b', '↩ 执行经验与问题记录'), el('span', L.failed || L.demand ? `验证失败 ${L.failed} 次、管线等待 ${L.demand} 个节点，已计入补学队列得分` : '验证失败与「管线放了却不能执行」的节点会自动抬高对应缺口的队列位置'));
  shell.append(loop, back);

  // ── 能力成长图 ───────────────────────────────────────────────────────────────
  const chartBox = el('section', undefined, 'lineage-block'); sections.chart = chartBox;
  chartBox.append(el('h3', '能力成长图'), el('p', '一行一条能力线，一个点一条来源，从左到右是作者的发布时间。大点是新一代的起点；▲ 是完成代码所到的最新一代；红圈是这条线向前的下一步。点一行查看它的代际。', 'lineage-dim'));
  const legend = el('div', undefined, 'lineage-legend'); for (const lv of LEVELS.slice(1)) { const i = el('span'); const dot = el('i'); dot.style.background = LEVEL_COLOR[lv.id]; i.append(dot, lv.name); legend.append(i); } { const i = el('span'); const dot = el('i'); dot.className = 'hollow'; i.append(dot, '参考 / 不适用'); legend.append(i); }
  const scroller = el('div', undefined, 'lineage-chart'); chartBox.append(legend, scroller); shell.append(chartBox);
  const ordered = [...lines].sort((a, b) => (a.from || '').localeCompare(b.from || ''));
  const Y0 = 2016, Y1 = 2026, LABEL = 178, W = 1180, ROW = 26, TOP = 26, H = TOP + ordered.length * ROW + 8;
  const xOf = (date) => { const t = date ? (Date.parse(date) - Date.UTC(Y0, 0, 1)) / (Date.UTC(Y1, 0, 1) - Date.UTC(Y0, 0, 1)) : 0; return LABEL + Math.max(0, Math.min(1, t)) * (W - LABEL - 16); };
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '能力线时间图', class: 'lineage-svg' });
  for (let y = Y0; y <= Y1; y++) { const x = xOf(y + '-01-01'); chart.append(svg('line', { x1: x, x2: x, y1: TOP - 6, y2: H - 4, class: 'grid' })); if (y < Y1) chart.append(svg('text', { x: x + 4, y: 12, class: 'year' }, y)); }
  const rowNodes = new Map();
  ordered.forEach((l, i) => {
    const y = TOP + i * ROW + ROW / 2, g = svg('g', { class: 'row', 'data-line': l.id, tabindex: 0, role: 'button', 'aria-label': l.name });
    g.append(svg('rect', { x: 0, y: y - ROW / 2, width: W, height: ROW, class: 'hit' }), svg('text', { x: 8, y: y + 4, class: 'label' }, short(l.name)));
    g.append(svg('text', { x: LABEL - 10, y: y + 4, class: 'count', 'text-anchor': 'end' }, (l.executables.length ? '⚙' + l.executables.length + ' ' : '') + l.generations.length + '代'));
    g.append(svg('line', { x1: xOf(l.from), x2: xOf(l.to), y1: y, y2: y, class: 'span' }));
    for (const m of l.loose) g.append(svg('circle', { cx: xOf(m.date), cy: y, r: 2.6, class: 'ref' }));
    for (const gen of l.generations) for (const m of gen.members) {
      const head = m.id === gen.headId, c = svg('circle', { cx: xOf(m.date), cy: y, r: head ? 6 : 3.4, class: m.level === null ? 'ref' : 'dot' + (head ? ' head' : '') });
      if (m.level !== null) c.setAttribute('fill', LEVEL_COLOR[m.level]);
      c.append(svg('title', {}, `${m.date} · ${gen.label}${head ? '（起点）' : ''} · ${m.level === null ? '参考' : LEVELS[m.level].name}\n${m.title}`)); g.append(c);
      if (l.target?.clip === m.id) g.append(svg('circle', { cx: xOf(m.date), cy: y, r: 9.5, class: 'target' }));
    }
    if (l.frontier >= 0) { const x = xOf(l.generations[l.frontier].from); g.append(svg('path', { d: `M${x - 5} ${y + 12}L${x + 5} ${y + 12}L${x} ${y + 6}Z`, class: 'frontier' })); }
    g.onclick = () => select(l.id); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(l.id); } };
    rowNodes.set(l.id, g); chart.append(g);
  });
  scroller.append(chart);

  // ── 代际阶梯 + 组合 ──────────────────────────────────────────────────────────
  const ladderBox = el('section', undefined, 'lineage-block'); sections.ladder = ladderBox; shell.append(ladderBox);
  const comboBox = el('section', undefined, 'lineage-block'); sections.combo = comboBox; shell.append(comboBox);
  const execButton = (x) => { const b = el('button', `⚙ ${x.name}`, 'lineage-exec'); b.type = 'button'; b.title = `${TIER[x.tier] || x.tier}管线 · ${x.id}`; if (onUse) b.onclick = () => onUse(x); else b.disabled = true; return b; };
  function drawLadder() {
    const l = byLine.get(selected); ladderBox.replaceChildren(); comboBox.replaceChildren(); if (!l) return;
    const pick = el('select'); pick.setAttribute('aria-label', '能力线'); for (const x of ordered) { const o = el('option', `${x.from?.slice(0, 4) || '—'} · ${x.name}`); o.value = x.id; pick.append(o); } pick.value = l.id; pick.onchange = () => select(pick.value);
    const head = el('div', undefined, 'lineage-line-head'); head.append(el('h3', l.name), pick); ladderBox.append(head);
    if (l.question) ladderBox.append(el('p', '要解决的问题：' + l.question));
    const dir = el('p', describeDirection(l, lineage), 'lineage-direction'); dir.dataset.lineageDirection = l.id; ladderBox.append(dir);
    const rail = el('ol', undefined, 'lineage-ladder');
    for (const g of l.generations) {
      const card = el('li', undefined, 'lineage-gen state-' + g.state); card.dataset.generation = g.label;
      if (g.index === l.frontier) card.classList.add('is-frontier'); if (l.target?.generation === g.index) card.classList.add('is-target');
      const top = el('div', undefined, 'lineage-gen-top'); top.append(el('b', g.label), el('time', g.from === g.to ? g.from : `${g.from} → ${g.to}`)); card.append(top);
      card.append(el('small', g.projectLabel));
      if (g.via) { const via = el('p', '↑ ' + g.via.label, 'lineage-via'); via.title = g.via.reason; card.append(via); }
      card.append(el('p', g.title, 'lineage-gen-title'));
      const chips = el('div', undefined, 'lineage-chips'); const st = el('span', LEVELS[g.level].mark + ' ' + STATE[g.state]); st.style.borderColor = LEVEL_COLOR[g.level]; chips.append(st);
      if (g.gaps.length) chips.append(el('span', `缺口 ${g.gaps.length}`, 'warn')); if (g.index === l.frontier) chips.append(el('span', '代码已到这里', 'here')); if (l.target?.generation === g.index) chips.append(el('span', l.target.mode === 'advance' ? '向前的下一步' : '回补', 'next'));
      card.append(chips);
      const d = el('details'); d.open = l.target?.generation === g.index; d.append(el('summary', `${g.members.length} 条来源`));
      for (const m of g.members) {
        const row = el('div', undefined, 'lineage-member'); row.dataset.clip = m.id;
        const dot = el('i'); if (m.level === null) dot.className = 'hollow'; else dot.style.background = LEVEL_COLOR[m.level];
        row.append(dot, el('time', m.date), el('span', m.title));
        const tag = m.level === null ? '参考' : m.status === 'partial' ? `部分 · ${m.priority || '待评估'}${m.superseded.length ? ' · 已被后续替代' : ''}` : LEVELS[m.level].name; row.append(el('small', tag));
        for (const id of m.executables) if (execById.has(id)) row.append(execButton(execById.get(id)));
        if (onFocus) { const b = el('button', '来源与差距 →', 'link'); b.type = 'button'; b.onclick = () => onFocus(m.id); row.append(b); }
        d.append(row);
      }
      card.append(d); rail.append(card);
    }
    ladderBox.append(rail);
    if (l.target) {
      const q = queueById.get(l.target.clip), box = el('aside', undefined, 'lineage-target');
      box.append(el('b', `${l.target.mode === 'advance' ? '向前的下一步' : '回补'} · ${l.target.label}${q ? ' · 队列第 ' + q.rank + ' 位（' + q.score + ' 分）' : ''}`));
      if (q) { box.append(el('p', q.title)); if (q.gap) box.append(el('p', '缺口：' + q.gap)); if (q.nextAction) box.append(el('p', '怎么补：' + q.nextAction)); if (q.acceptance) box.append(el('p', '完成门槛：' + q.acceptance, 'lineage-dim')); box.append(el('small', '排序理由：' + q.why.join('；'))); }
      if (onFocus) { const b = el('button', '打开这条来源的原文、笔记与代码位置 →'); b.type = 'button'; b.onclick = () => onFocus(l.target.clip); box.append(b); }
      ladderBox.append(box);
    } else if (l.generations.length) ladderBox.append(el('p', l.executables.length ? '这条线没有未补缺口，且已有可执行能力。' : '这条线没有未补缺口；下一步是把完成的代码封装成可执行能力（meta / match / run）。', 'lineage-target'));
    if (l.loose.length || l.counts.modules) ladderBox.append(el('small', `源码 ${l.counts.modules} 个模块归在这条线（其中 ${l.counts.inferredModules} 个按 import 推断）· 原版 REACode 文件 ${l.originals.length} 个 · 参考记录 ${l.counts.reference} 条`, 'lineage-dim'));

    // 组合
    const combo = lineage.combinations.find((c) => c.line === l.id);
    comboBox.append(el('h3', '组合 · 这条线和谁一起用'), el('p', '前置来自源码的 import 方向和已有依据的跨线关系：箭头左边的能力线先有、先做。依赖图不是可执行管线，每一步仍要各自的执行适配与验证。', 'lineage-dim'));
    const flow = el('div', undefined, 'lineage-flow');
    const chip = (id, cls) => { const x = byLine.get(id), b = el('button', `${short(x.name)} · ${x.frontier >= 0 ? x.generations[x.frontier].label : '未完成'}${x.executables.length ? ' ⚙' + x.executables.length : ''}`, cls); b.type = 'button'; b.title = describeDirection(x, lineage); b.onclick = () => select(id); return b; };
    for (const id of combo.prerequisites) { flow.append(chip(id, byLine.get(id).frontier < 0 ? 'blocked' : ''), el('span', '→', 'arrow')); }
    flow.append(chip(l.id, 'self')); for (const r of l.requiredBy.slice(0, 6)) flow.append(el('span', '→', 'arrow dim'), chip(r.id, 'after'));
    comboBox.append(flow, el('p', ({ runnable: '可排入管线：', 'needs-adapter': '待封装：', learning: '待补学：' })[combo.readiness] + combo.note, 'lineage-readiness ' + combo.readiness));
    if (combo.steps.length) { const row = el('div', undefined, 'lineage-steps'); row.append(el('small', '这条线已能执行的能力' + (onUse ? ' · 点击加入对应管线' : ''))); for (const s of combo.steps) row.append(execButton(execById.get(s.id))); comboBox.append(row); }
    if (combo.prerequisiteSteps.length) { const d = el('details'); d.append(el('summary', `前置能力线里已能执行的能力 · ${combo.prerequisiteSteps.reduce((n, p) => n + p.steps.length, 0)}`)); for (const p of combo.prerequisiteSteps) { const row = el('div', undefined, 'lineage-steps'); row.append(el('small', short(byLine.get(p.line).name))); for (const s of p.steps) row.append(execButton(execById.get(s.id))); d.append(row); } comboBox.append(d); }
    const cross = lineage.crossRelations.filter((r) => r.from === l.id || r.to === l.id);
    if (cross.length) { const d = el('details'); d.append(el('summary', `有依据的跨线关系 ${cross.length} 条`)); for (const r of cross) { const p = el('p'); p.append(el('b', `${short(byLine.get(r.from).name)} → ${short(byLine.get(r.to).name)} · ${r.label}`), ' ' + r.reason); d.append(p); } comboBox.append(d); }
    for (const [id, g] of rowNodes) g.classList.toggle('selected', id === l.id);
    shell.dataset.lineageLine = l.id; onState?.({ line: l.id });
  }
  function select(id) { if (byLine.get(id)?.kind !== 'line') return; selected = id; drawLadder(); drawQueue(); }

  // ── 补学队列 ────────────────────────────────────────────────────────────────
  const queueBox = el('section', undefined, 'lineage-block'); sections.queue = queueBox; shell.append(queueBox);
  function drawQueue() {
    queueBox.replaceChildren(); const rows = lineage.queue.filter((q) => !queueLine || q.line === selected || q.alsoIn.includes(selected));
    const head = el('div', undefined, 'lineage-line-head'); head.append(el('h3', `补学队列 · ${rows.length} 个缺口`));
    const toggle = el('button', queueLine ? '看全部能力线' : `只看「${short(byLine.get(selected)?.name || '')}」`); toggle.type = 'button'; toggle.onclick = () => { queueLine = !queueLine; queueLimit = 8; drawQueue(); }; head.append(toggle); queueBox.append(head);
    const f = el('details'); f.append(el('summary', '队列怎么算'), el('p', lineage.formula), ...lineage.limits.map((t) => el('p', '· ' + t, 'lineage-dim'))); queueBox.append(f);
    const list = el('ol', undefined, 'lineage-queue');
    for (const q of rows.slice(0, queueLimit)) {
      const li = el('li'); li.dataset.queueClip = q.id; li.dataset.priority = q.priority;
      const top = el('div', undefined, 'lineage-queue-top'); top.append(el('b', '#' + q.rank), el('span', q.score + ' 分', 'score'), el('span', `${short(q.lineName)} · ${q.generation}${q.alsoIn.length ? ' · 也属于 ' + q.alsoIn.map((id) => short(byLine.get(id).name)).join('、') : ''}`, 'where'), el('time', q.date), el('span', '优先级 ' + q.priority, 'prio')); li.append(top);
      li.append(el('p', q.title)); if (q.gap) li.append(el('p', '缺口：' + q.gap, 'lineage-dim')); li.append(el('small', q.why.join('；')));
      const actions = el('div', undefined, 'lineage-actions'); const a = el('button', '看这条线的代际'); a.type = 'button'; a.onclick = () => { select(q.line); ladderBox.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; actions.append(a);
      if (onFocus) { const b = el('button', '来源与差距 →'); b.type = 'button'; b.onclick = () => onFocus(q.id); actions.append(b); } li.append(actions); list.append(li);
    }
    queueBox.append(list);
    if (rows.length > queueLimit) { const more = el('button', `显示更多（${queueLimit} / ${rows.length}）`); more.type = 'button'; more.onclick = () => { queueLimit += 20; drawQueue(); }; queueBox.append(more); }
    if (!rows.length) queueBox.append(el('p', '这条线没有未补缺口。'));
  }

  // ── 适配队列 + 管线需求 ──────────────────────────────────────────────────────
  const adaptBox = el('section', undefined, 'lineage-block'); sections.adapt = adaptBox; shell.append(adaptBox);
  adaptBox.append(el('h3', `适配队列 · ${lineage.adaptQueue.length} 条线代码已有、还不能执行`), el('p', '这些能力线已有完成的代码，但能力库里没有对应的 meta / match / run。封装后才会出现在系统工坊左栏、才能拖进管线。', 'lineage-dim'));
  const adapt = el('div', undefined, 'lineage-adapt');
  for (const a of lineage.adaptQueue) { const b = el('button', undefined, a.demanded ? 'demanded' : ''); b.type = 'button'; b.append(el('b', short(a.name)), el('span', `代码到 ${a.generation} · ${a.doneClips} 条完成${a.requiredBy ? ' · ' + a.requiredBy + ' 条线依赖' : ''}${a.demanded ? ' · 管线在等' : ''}`)); b.onclick = () => { select(a.line); ladderBox.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; adapt.append(b); }
  adaptBox.append(adapt);
  if (lineage.demand.length) { adaptBox.append(el('h4', `管线里等能力的节点 · ${lineage.demand.length}`)); for (const d of lineage.demand) { const p = el('p', undefined, 'lineage-demand'); p.append(el('b', d.name), ` · ${({ learning: '来源只有部分实现：先补学', adapter: '来源代码已完成：缺执行适配', source: '没有关联到来源：先补来源映射' })[d.needs]}${d.lines.length ? ' · ' + d.lines.map((id) => short(byLine.get(id).name)).join('、') : ''}`); if (d.lines[0]) { const b = el('button', '看能力线', 'link'); b.type = 'button'; b.onclick = () => { select(d.lines[0]); ladderBox.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; p.append(b); } adaptBox.append(p); } }
  if (lineage.unownedModules.length || lineage.originals.unclassified.length) { const d = el('details'); d.append(el('summary', `还没归到能力线：源码模块 ${lineage.unownedModules.length} 个 · 原版 REACode 文件 ${lineage.originals.unclassified.length} 个`), el('p', '没有来源记录、也没有被已归线模块 import。先补来源映射，再决定属于哪条线。', 'lineage-dim')); d.append(el('code', lineage.unownedModules.join('  ') || '—')); if (lineage.originals.unclassified.length) d.append(el('code', lineage.originals.unclassified.map((o) => 'REACode/' + o.source).join('  '))); adaptBox.append(d); }

  // ── 执行经验 ────────────────────────────────────────────────────────────────
  const expBox = el('section', undefined, 'lineage-block'); sections.experience = expBox; shell.append(expBox);
  expBox.append(el('h3', '执行经验 → 回到学习'));
  const used = lineage.executables.filter((x) => x.experience?.runs || x.experience?.committed);
  expBox.append(el('p', experienceNote || (used.length ? '系统工坊本机的执行记录：验证失败会抬高所在能力线的缺口得分。' : '还没有执行记录。在系统工坊执行管线后，预览、验证失败与采用会记到这里。'), 'lineage-dim'));
  const table = el('div', undefined, 'lineage-exp'), idle = el('div', undefined, 'lineage-exp'), idleBox = el('details');
  for (const x of lineage.executables) { const e = x.experience || {}, row = el('div', undefined, e.failed ? 'failed' : ''); row.dataset.executable = x.id; row.append(el('b', '⚙ ' + x.name), el('span', TIER[x.tier] || x.tier), el('span', x.lines.length ? x.lines.map((id) => short(byLine.get(id).name)).join('、') : '未关联能力线'), el('span', e.runs ? `执行 ${e.runs} · 通过 ${e.passed || 0} · 失败 ${e.failed || 0} · 采用 ${e.committed || 0}` : '未执行')); if (e.lastFailure) row.append(el('small', '最近失败：' + e.lastFailure)); (e.runs || e.committed ? table : idle).append(row); }
  idleBox.append(el('summary', `还没执行过的可执行能力 · ${idle.children.length}`), idle); expBox.append(table, idleBox);

  drawLadder(); drawQueue();
  return { lineage, select };
}
