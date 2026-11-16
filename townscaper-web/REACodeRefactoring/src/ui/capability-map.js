/**
 * capability-map.js — 能力地图：一屏看清「能力之间怎么连、每条线到了哪一代、某个场景差在哪、下一步做什么」。
 *
 *   上：一句话的目标栏  ——  我想改善 [场景] 的 [能力线]
 *   左：能力网（节点 = 能力线，节点里的一串圆点 = 它的各代，箭头 = 前置）
 *   右：抽屉  ——  没选能力线时给「先做这三件事」，选了以后给这条线的代际、下一步和这个场景在这条线上的差距
 *
 * 只显示计算结果（core/capability-lineage.js）。明细（队列全表、闭环、执行经验）在「队列与闭环」页。
 */
import { buildCapabilityLineage, describeDirection } from '../core/capability-lineage.js';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const svg = (tag, attrs = {}, text) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
const short = (name) => name.split(/[：:]/)[0];
const CODE = { complete: ['done', '代码完成'], building: ['part', '部分实现'], learning: ['none', '只学习'] };
const SCENE = { 'in-scene': ['done', '在用 · 与库一致'], stale: ['stale', '在用 · 旧副本'], 'not-wired': ['part', '库里有 · 没接'], 'no-code': ['none', '库里没有代码'] };
const TIER = { planet: '球系统', scene: '场景', object: '物件' };

export function renderCapabilityMap(host, { evolution, modules = [], executables = [], experience = {}, demand = [], alignment = [], consumers = [], consumer: initialConsumer = '', line: initialLine = null, onFocus, onUse, onDetail, onState } = {}) {
  const lineage = buildCapabilityLineage(evolution, { modules, executables, experience, demand, alignment, consumers });
  const byLine = new Map(lineage.lines.map((l) => [l.id, l])), execById = new Map(lineage.executables.map((x) => [x.id, x])), queueById = new Map(lineage.queue.map((q) => [q.id, q]));
  let scene = lineage.consumers.some((c) => c.id === initialConsumer) ? initialConsumer : '', selected = byLine.get(initialLine)?.kind === 'line' ? initialLine : null;
  if (!document.getElementById('capability-map-css')) { const css = el('link'); css.id = 'capability-map-css'; css.rel = 'stylesheet'; css.href = new URL('./capability-map.css', import.meta.url); document.head.append(css); }
  const root = el('section', undefined, 'cmap'); root.dataset.mapLines = lineage.net.nodes.length; host.append(root);

  // ── 目标栏 ────────────────────────────────────────────────────────────────
  const bar = el('header', undefined, 'cmap-bar'), ask = el('div', undefined, 'cmap-ask');
  const sceneSel = el('select'), lineSel = el('select'); sceneSel.setAttribute('aria-label', '场景'); lineSel.setAttribute('aria-label', '能力线');
  { const o = el('option', '整个能力库'); o.value = ''; sceneSel.append(o); for (const c of lineage.consumers) { const x = el('option', c.name); x.value = c.id; sceneSel.append(x); } }
  { const o = el('option', '全部能力'); o.value = ''; lineSel.append(o); for (const n of [...lineage.net.nodes].sort((a, b) => (a.from || '').localeCompare(b.from || ''))) { const x = el('option', short(n.name)); x.value = n.id; lineSel.append(x); } }
  ask.append(el('span', '我想改善'), sceneSel, el('span', '的'), lineSel);
  const pills = el('div', undefined, 'cmap-pills'); bar.append(ask, pills); root.append(bar);
  const body = el('div', undefined, 'cmap-body'), canvas = el('div', undefined, 'cmap-canvas'), panel = el('aside', undefined, 'cmap-panel'); panel.setAttribute('aria-label', '能力详情'); body.append(canvas, panel); root.append(body);
  sceneSel.onchange = () => { scene = sceneSel.value; draw(); }; lineSel.onchange = () => { selected = lineSel.value || null; draw(); };
  const diag = () => lineage.consumers.find((c) => c.id === scene) || null;
  const pick = (id) => { selected = selected === id ? null : id; draw(); };

  // ── 能力网 ────────────────────────────────────────────────────────────────
  function drawNet() {
    canvas.replaceChildren(); const d = diag(), rowOf = new Map((d?.lines || []).map((r) => [r.line, r]));
    const NW = 168, NH = 54, CG = 200, RG = 70, PX = 18, PY = 34, linked = lineage.net.nodes.filter((n) => !n.isolated), cols = new Map();
    for (const n of [...linked].sort((a, b) => (a.from || '').localeCompare(b.from || ''))) { if (!cols.has(n.layer)) cols.set(n.layer, []); cols.get(n.layer).push(n); }
    const layers = [...cols.keys()].sort((a, b) => a - b), pos = new Map(); let rows = 0;
    layers.forEach((layer, ci) => { const list = cols.get(layer); rows = Math.max(rows, list.length); list.forEach((n, i) => pos.set(n.id, { x: PX + ci * CG, y: PY + i * RG })); });
    for (const [layer, list] of cols) { const off = (rows - list.length) * RG / 2; for (const n of list) pos.get(n.id).y += off; }   // 每列垂直居中
    const W = PX * 2 + (layers.length - 1) * CG + NW, H = PY + rows * RG + 6;
    const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cmap-net', role: 'img', 'aria-label': '能力网' });
    const defs = svg('defs'), mk = svg('marker', { id: 'cmap-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto' }); mk.append(svg('path', { d: 'M0 .8L7 4L0 7.2Z', class: 'cmap-arrowhead' })); defs.append(mk); g.append(defs);
    g.append(svg('text', { x: PX, y: 16, class: 'cmap-axis' }, '基础能力'), svg('text', { x: W - PX, y: 16, class: 'cmap-axis', 'text-anchor': 'end' }, '建立在前面能力之上 →'));
    for (const e of lineage.net.edges) { const a = pos.get(e.from), b = pos.get(e.to); const hot = e.from === selected || e.to === selected; if (!a || !b || (!hot && (!e.main || b.x <= a.x))) continue;   // 平时只画主要的、向右的前置；选中节点时画它的全部
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, back = x2 <= x1 + 8, dx = back ? 70 : Math.max(36, (x2 - x1) * 0.45);
      g.append(svg('path', { d: back ? `M${a.x + NW / 2} ${a.y + NH}C${a.x + NW / 2} ${a.y + NH + dx},${b.x + NW / 2} ${b.y + NH + dx},${b.x + NW / 2} ${b.y + NH + 2}` : `M${x1} ${y1}C${x1 + dx} ${y1},${x2 - dx} ${y2},${x2 - 3} ${y2}`, class: 'cmap-edge' + (e.from === selected || e.to === selected ? ' on' : selected ? ' off' : ''), 'marker-end': 'url(#cmap-arrow)' })); }
    const node = (n, p, parent) => { const row = rowOf.get(n.id), gens = row ? row.generations : n.generations, G = svg('g', { class: 'cmap-node' + (n.id === selected ? ' selected' : '') + (d && !row ? ' unused' : ''), transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'data-map-line': n.id, 'aria-label': n.name, 'aria-pressed': String(n.id === selected) });
      G.append(svg('rect', { width: NW, height: NH, rx: 12, class: 'cmap-box' }), svg('text', { x: 14, y: 22, class: 'cmap-name' }, short(n.name)));
      if (n.executables) G.append(svg('text', { x: NW - 12, y: 22, class: 'cmap-exec', 'text-anchor': 'end' }, '⚙ ' + n.executables));
      const step = Math.min(18, (NW - 28) / Math.max(1, gens.length - 1 || 1)), x0 = 14 + 4, y = 39;
      if (gens.length > 1) G.append(svg('line', { x1: x0, x2: x0 + step * (gens.length - 1), y1: y, y2: y, class: 'cmap-rail' }));
      gens.forEach((gen, i) => { const kind = row ? SCENE[gen.state][0] : CODE[gen.state][0]; G.append(svg('circle', { cx: x0 + i * step, cy: y, r: 4.4, class: 'cmap-dot s-' + kind }));
        if (!row && i === n.frontier) G.append(svg('circle', { cx: x0 + i * step, cy: y, r: 7.4, class: 'cmap-ring here' })); if (!row && i === n.target) G.append(svg('circle', { cx: x0 + i * step, cy: y, r: 7.4, class: 'cmap-ring next' })); });
      G.onclick = () => pick(n.id); G.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(n.id); } }; parent.append(G); };
    for (const n of linked) node(n, pos.get(n.id), g);
    canvas.append(g);
    // 与其他线没有前置关系的能力线：单独一排，不参与连线
    const loose = lineage.net.nodes.filter((n) => n.isolated).sort((a, b) => (a.from || '').localeCompare(b.from || ''));
    if (loose.length) { const per = Math.max(1, Math.floor((W - PX * 2 + 14) / (NW + 14))), rowsL = Math.ceil(loose.length / per), HL = 26 + rowsL * (NH + 14);
      const s2 = svg('svg', { viewBox: `0 0 ${W} ${HL}`, class: 'cmap-net cmap-loose', role: 'img', 'aria-label': '独立能力线' }); s2.append(svg('text', { x: PX, y: 14, class: 'cmap-axis' }, '独立能力 · 与其他线没有前置关系'));
      loose.forEach((n, i) => node(n, { x: PX + (i % per) * (NW + 14), y: 24 + Math.floor(i / per) * (NH + 14) }, s2)); canvas.append(s2); }
    const legend = el('div', undefined, 'cmap-legend'); for (const [kind, name] of d ? Object.values(SCENE) : Object.values(CODE)) { const i = el('span'), dot = el('i', undefined, 's-' + kind); i.append(dot, name); legend.append(i); }
    if (!d) { const a = el('span'), r1 = el('i', undefined, 'ring here'); a.append(r1, '代码到这一代'); const b = el('span'), r2 = el('i', undefined, 'ring next'); b.append(r2, '下一步'); legend.append(a, b); }
    canvas.append(legend);
  }

  // ── 抽屉 ─────────────────────────────────────────────────────────────────
  const action = (text, fn, cls) => { const b = el('button', text, cls); b.type = 'button'; b.onclick = fn; return b; };
  const todo = (n, title, sub, fn) => { const b = el('button', undefined, 'cmap-todo'); b.type = 'button'; b.append(el('i', String(n)), el('b', title)); if (sub) b.append(el('span', sub)); b.onclick = fn; return b; };
  function drawOverview() {
    const d = diag(), L = lineage.loop;
    panel.append(el('small', d ? '场景' : '能力库', 'cmap-eyebrow'), el('h2', d ? d.name : '整个能力库'));
    const nums = el('div', undefined, 'cmap-nums'); const num = (v, label, kind) => { const x = el('div', undefined, 'k-' + kind); x.append(el('b', String(v)), el('span', label)); nums.append(x); };
    if (d) { num(d.counts.different || 0, '模块是旧副本', 'stale'); num(d.counts.wire, '代际库里有、没接', 'part'); num(d.counts.learn, '缺口库里也没学完', 'none'); }
    else { num(L.executables, '项能力可执行', 'done'); num(L.adapt, '条线有代码、不能执行', 'part'); num(L.gaps, '个缺口没学完', 'none'); }
    panel.append(nums);
    if (d) panel.append(el('p', `实际用到 ${d.counts.modules} 个能力库模块，分布在 ${d.counts.lines} 条能力线上。地图上变淡的是这个场景没用到的能力。`, 'cmap-dim'));
    else panel.append(el('p', `${L.lines} 条能力线、${L.generations} 代，来自 ${L.sources} 条作者视频。点一个节点看它的代际和下一步；选一个场景看它差在哪里。`, 'cmap-dim'));
    for (const n of d?.notes || []) { const q = el('blockquote', n.text); q.dataset.mapNote = d.id; panel.append(el('h3', `已做过的对照 · ${n.date}`), q); }
    panel.append(el('h3', '先做这三件事'));
    const list = el('div', undefined, 'cmap-todos'); let i = 0;
    if (d) { const first = (kind) => d.guide.find((g) => g.kind === kind);   // 每一类最相关的一条：没学完的 → 没接的 → 旧副本
      for (const [kind, verb] of [['learn', '补学'], ['wire', '接入'], ['sync', '对照后再决定是否同步']]) { const g = first(kind); if (g) list.append(todo(++i, g.title, verb + (g.detail?.[0] ? ' · ' + String(g.detail[0]).slice(0, 60) : ''), () => pick(g.line))); } }
    else for (const q of lineage.queue.slice(0, 3)) list.append(todo(++i, `${short(q.lineName)} ${q.generation}`, q.gap || q.title, () => pick(q.line)));
    if (!i) list.append(el('p', '没有待办。', 'cmap-dim')); panel.append(list);
    if (onDetail) panel.append(action('队列、闭环与执行经验的全部明细 →', () => onDetail(), 'cmap-link'));
  }
  function drawLine(l) {
    const d = diag(), row = d?.lines.find((r) => r.line === l.id) || null;
    const head = el('div', undefined, 'cmap-panel-head'); head.append(el('small', `${(l.from || '').slice(0, 4)} – ${(l.to || '').slice(0, 4)} · ${l.generations.length} 代`, 'cmap-eyebrow'), action('×', () => pick(l.id), 'cmap-close')); head.lastChild.setAttribute('aria-label', '关闭'); panel.append(head);
    panel.append(el('h2', short(l.name)), el('p', l.name.includes('：') ? l.name.split('：')[1] : l.question, 'cmap-dim'));
    const dir = el('p', describeDirection(l, lineage), 'cmap-direction'); dir.dataset.mapDirection = l.id; panel.append(dir);
    // 代际：竖排
    const steps = el('ol', undefined, 'cmap-steps');
    for (const g of l.generations) { const sg = row?.generations[g.index], kind = sg ? SCENE[sg.state] : CODE[g.state], li = el('li', undefined, 's-' + kind[0]); li.dataset.generation = g.label;
      const top = el('div', undefined, 'cmap-step-top'); top.append(el('b', g.label), el('time', (g.from || '').slice(0, 4)), el('span', kind[1], 'cmap-state'));
      if (g.index === l.frontier) top.append(el('span', '代码到这里', 'tag here')); if (l.target?.generation === g.index) top.append(el('span', '下一步', 'tag next')); li.append(top, el('p', g.title));
      const more = el('details'); more.append(el('summary', `${g.members.length} 条来源${g.gaps.length ? ' · ' + g.gaps.length + ' 个缺口' : ''}`));
      more.ontoggle = () => { if (!more.open || more.dataset.filled) return; more.dataset.filled = '1'; for (const m of g.members) { const r = el('div', undefined, 'cmap-member'); r.append(el('time', m.date), el('span', m.title)); if (onFocus) r.append(action('来源 →', () => onFocus(m.id), 'cmap-link')); more.append(r); } };
      li.append(more); steps.append(li); }
    panel.append(steps);
    if (l.target) { const q = queueById.get(l.target.clip), box = el('section', undefined, 'cmap-next'); box.append(el('h3', `下一步 · ${l.target.label}${q ? '　队列第 ' + q.rank + ' 位' : ''}`));
      if (q?.gap) box.append(el('p', q.gap)); if (q?.nextAction) box.append(el('p', '怎么补：' + q.nextAction, 'cmap-dim')); if (onFocus) box.append(action('看来源、笔记和代码位置 →', () => onFocus(l.target.clip), 'cmap-link')); panel.append(box); }
    if (row) { const sec = el('section', undefined, 'cmap-scene'); sec.dataset.mapSceneLine = l.id; sec.append(el('h3', `${d.name} 在这条线上`));
      if (row.stale.length) { sec.append(el('h4', `旧副本 · ${row.stale.length}`)); for (const m of row.stale) sec.append(el('code', `${m.path.replace('src/', '')}　${m.bytes} → 库 ${m.libraryBytes} 字节`)); sec.append(el('p', '换成库的现行版本前先做同机位对照：新版本不一定更好看。', 'cmap-dim')); }
      const unwired = row.generations.filter((g) => g.state === 'not-wired' && g.codeState !== 'learning'); if (unwired.length) { sec.append(el('h4', `库里有、场景没接 · ${unwired.length} 代`)); for (const g of unwired) sec.append(el('code', `${g.label}　${g.missing.map((p) => p.replace('src/', '')).join('  ')}`)); }
      if (!row.stale.length && !unwired.length) sec.append(el('p', '这条线上场景用的模块与库一致。', 'cmap-dim')); panel.append(sec); }
    else if (d) panel.append(el('p', `${d.name} 没有用到这条能力线的模块。`, 'cmap-dim'));
    const ex = l.executables.map((id) => execById.get(id)).filter(Boolean);
    if (ex.length) { const sec = el('section'); sec.append(el('h3', '已能执行')); const chips = el('div', undefined, 'cmap-chips'); for (const x of ex) { const b = action('⚙ ' + x.name, () => onUse?.(x), 'cmap-chip exec'); b.title = (TIER[x.tier] || x.tier) + '管线' + (onUse ? ' · 点击加入' : ''); b.disabled = !onUse; chips.append(b); } sec.append(chips); panel.append(sec); }
    else if (l.frontier >= 0) panel.append(el('p', '代码已有，但还没有封装成可执行能力，不能放进管线。', 'cmap-dim'));
    if (l.requires.length || l.requiredBy.length) { const sec = el('section'); sec.append(el('h3', '相邻能力')); const chips = el('div', undefined, 'cmap-chips');
      for (const r of l.requires.slice(0, 5)) chips.append(action('← ' + short(byLine.get(r.id).name), () => pick(r.id), 'cmap-chip')); for (const r of l.requiredBy.slice(0, 5)) chips.append(action(short(byLine.get(r.id).name) + ' →', () => pick(r.id), 'cmap-chip after')); sec.append(chips, el('small', '← 它依赖的　　依赖它的 →', 'cmap-dim')); panel.append(sec); }
  }
  function draw() {
    sceneSel.value = scene; lineSel.value = selected || ''; root.dataset.mapScene = scene; root.dataset.mapLine = selected || '';
    pills.replaceChildren(); const d = diag(), L = lineage.loop;
    for (const [v, label, kind] of d ? [[d.counts.different || 0, '旧副本', 'stale'], [d.counts.wire, '没接', 'part'], [d.counts.learn, '没学完', 'none']] : [[L.executables, '可执行', 'done'], [L.adapt, '待封装', 'part'], [L.gaps, '缺口', 'none']]) { const p = el('span', undefined, 'k-' + kind); p.append(el('b', String(v)), label); pills.append(p); }
    drawNet(); panel.replaceChildren(); panel.scrollTop = 0; const l = selected && byLine.get(selected); if (l) drawLine(l); else drawOverview();
    onState?.({ line: selected, consumer: scene });
  }
  draw();
  return { lineage, select: (id) => { selected = id; draw(); }, setScene: (id) => { scene = id; draw(); } };
}
