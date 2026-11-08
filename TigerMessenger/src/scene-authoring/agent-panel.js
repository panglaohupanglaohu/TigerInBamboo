/**
 * agent-panel.js — 场景工坊右栏「Router / 改造 Worker / 验证 Worker / Watchdog」面板，
 * 以及代码能力节点的检视器（能作用的物件、参数、来源视频、经验）。
 */
import { createAgent, experienceFor, readExperience } from './agent/orchestrator.js?v=cap-r1';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const btn = (text, fn, cls) => { const b = el('button', text, cls); b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
const ICON = { pass: '✓', warn: '!', fail: '✗' };

export function mountAgentPanel({ host, request, getRecipe, capabilities, onInsert, status, openSource, onScanned = () => {}, onExperience = () => {} }) {
  let scan = null, focusCells = null, busy = false, events = [];
  const agent = createAgent({ request, onEvent: (e) => { events.push(e); if (events.length > 40) events.shift(); if (e.type === 'experience') onExperience(); renderTimeline(); } });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'tm.cap.picked') return;
    if (e.data.error) { setNote(e.data.error); return; }
    focusCells = e.data.cells; setNote(`已选范围：以格子 ${e.data.cell} 为中心的 ${focusCells.length} 格。扫描与执行只作用于这里。`); render(); doScan();
  });

  const root = el('section', undefined, 'agent-panel');
  root.innerHTML = '';
  host.prepend(root);
  const head = el('div', undefined, 'agent-head');
  head.append(el('small', 'SUPER AGENT · 本机执行'), el('h3', 'Router → 改造 Worker → 验证 Worker'));
  const scope = el('div', undefined, 'agent-scope');
  const note = el('p', '先扫描：能力库逐个在当前场景上匹配能作用的物件。', 'agent-note');
  const setNote = (t) => { note.textContent = t; };
  const routeBox = el('div', undefined, 'agent-route');
  const actions = el('div', undefined, 'agent-actions');
  const result = el('div', undefined, 'agent-result');
  const timeline = el('ol', undefined, 'agent-timeline');
  const expBox = el('p', '', 'agent-exp');
  root.append(head, scope, note, routeBox, actions, result, el('h4', 'Watchdog · 任务与恢复'), timeline, expBox);

  async function doScan() {
    if (busy) return; busy = true; render();
    try { scan = await agent.scan({ focusCells }); onScanned(scan); const total = scan.matches.reduce((a, m) => a + m.count, 0); setNote(`扫描完成：${scan.matches.filter((m) => m.count).length} / ${scan.matches.length} 个能力能作用于${focusCells ? '所选范围' : '当前场景'}，共 ${total} 处物件。`); await renderRoute(); }
    catch (e) { setNote('扫描失败：' + e.message); }
    finally { busy = false; render(); }
  }
  async function renderRoute() {
    routeBox.replaceChildren();
    if (!scan) return;
    const recipe = getRecipe();
    const enabled = recipe.nodes.filter((n) => n.enabled && capabilities.find((c) => c.id === n.id)?.code).map((n) => n.id);
    const plan = await agent.route(recipe.goal, scan.matches, enabled);
    const title = el('h4', 'Router · 按改造方向建议');
    routeBox.append(title);
    const missing = plan.filter((p) => !recipe.nodes.some((n) => n.id === p.id));
    if (!plan.length) routeBox.append(el('p', '改造方向里没有命中能力关键词（如：拱、隧道、灯塔、石柱、浅水、烟）。也可以直接在左侧能力库加入代码能力。', 'muted'));
    for (const p of plan) {
      const cap = capabilities.find((c) => c.id === p.id), row = el('div', undefined, 'route-row');
      row.append(el('span', `${cap?.name || p.id} · ${p.matches} 处`), el('small', p.why));
      if (missing.includes(p)) row.append(btn('加入管线', () => { onInsert(cap); renderRoute(); }));
      else row.append(el('small', '已在管线', 'muted'));
      routeBox.append(row);
    }
  }
  function steps() {
    const recipe = getRecipe();
    return recipe.nodes.filter((n) => n.enabled && capabilities.find((c) => c.id === n.id)?.code).map((n) => ({ id: n.id, params: n.params || {} }));
  }
  async function generate() {
    const s = steps();
    if (!s.length) { setNote('管线里没有启用的代码能力节点（⚙ / ◍）。先扫描，按 Router 建议加入，或从左侧能力库加入。'); return; }
    busy = true; render(); setNote('改造 Worker 执行中：' + s.map((x) => capabilities.find((c) => c.id === x.id)?.name).join(' → '));
    try { const c = await agent.generate({ steps: s, goal: getRecipe().goal, focusCells }); renderResult(c); setNote(c.verification.status === 'fail' ? '候选验证未通过：可以看候选、调整参数后重试，或放弃。' : '候选已在实景中预览。确认前不会写入你的场景。'); status('候选已预览（未写入存档）：' + c.verification.summary); }
    catch (e) { setNote('执行失败：' + e.message); result.replaceChildren(); }
    finally { busy = false; render(); }
  }
  function renderResult(c) {
    result.replaceChildren();
    if (!c) return;
    result.append(el('h4', '候选 · ' + (c.verification.status === 'fail' ? '验证未通过' : c.verification.status === 'warn' ? '通过（需留意）' : '验证通过')));
    const ul = el('ul', undefined, 'step-report');
    for (const r of c.report) {
      const cap = capabilities.find((x) => x.id === r.id), li = el('li');
      const text = r.status === 'applied' ? `${cap?.name}：执行 ${r.applied.length} 处` : r.status === 'layer' ? `${cap?.name}：加显示层` : r.status === 'no-target' ? `${cap?.name}：没有可作用的物件，跳过` : `${cap?.name || r.id}：${r.error || r.status}`;
      li.append(el('span', text));
      if (r.reasons?.length) li.append(el('small', r.reasons.join('；')));
      if (r.focus?.length) li.append(btn('定位', () => agent.highlight(r.focus)));
      ul.append(li);
    }
    result.append(ul);
    const checks = el('ul', undefined, 'verify-report');
    for (const k of c.verification.checks) { const li = el('li', undefined, 'check-' + k.status); li.append(el('b', ICON[k.status] + ' ' + k.name), el('span', k.detail)); checks.append(li); }
    result.append(el('h4', '验证 Worker'), checks);
    const row = el('div', undefined, 'agent-actions');
    row.append(btn('看原始', async () => { await agent.show('baseline'); setNote('正在显示原始场景（候选保留）。'); }), btn('看候选', async () => { await agent.show('candidate'); setNote('正在显示候选。'); }));
    const commit = btn('写入当前场景', async () => {
      if (!confirm('把候选写入当前湖上场景（本机工作区）？\n写入后可在原编辑器里「撤销」回到之前。')) return;
      try { await agent.commit(); renderResult(null); setNote('已写入当前场景；原编辑器撤销可回退。定稿请在「草稿与定稿」里完成。'); status('候选已写入工作区（可撤销）。'); }
      catch (e) { setNote(e.message); }
    }, 'primary');
    commit.disabled = c.verification.status === 'fail';
    const draft = btn('存为草稿', () => {
      const detail = {}; window.dispatchEvent(new CustomEvent('tm.experiment.save-current', { detail }));
      if (detail.error || !detail.row) { setNote('草稿保存失败：' + (detail.error || '版本服务未就绪')); return; }
      agent.noteOutcome('draft'); setNote('候选已存为草稿 ' + detail.row.id.slice(0, 8) + '（实验面板里可恢复 / 定稿）。');
    });
    draft.disabled = c.verification.status === 'fail';
    row.append(commit, draft, btn('放弃', async () => { await agent.discard(); renderResult(null); setNote('已放弃候选，场景回到原样。'); }));
    result.append(row);
  }
  function renderTimeline() {
    timeline.replaceChildren();
    const names = { scan: '扫描', scanned: '扫描完成', transform: '改造 Worker 开始', verify: '验证 Worker 开始', preview: '实景预览', review: '等你决定', committed: '已写入', idle: '空闲' };
    for (const e of events.slice(-10)) {
      const t = new Date(e.at).toLocaleTimeString();
      const text = e.type === 'job' ? `${e.name} · ${{ running: '开始', done: '完成', failed: '失败', timeout: '超时（已终止并重建）', crashed: '崩溃（已重建）' }[e.state] || e.state}${e.ms ? ' · ' + e.ms + 'ms' : ''}`
        : e.type === 'beat' ? `${e.name} · ${e.stage}` : e.type === 'recover' ? `Watchdog 恢复：${e.why}，已重试` : e.type === 'phase' ? names[e.phase] || e.phase : e.type === 'experience' ? '经验已记录' : e.type;
      timeline.append(el('li', `${t}  ${text}`, e.type === 'recover' || e.state === 'failed' || e.state === 'timeout' ? 'bad' : ''));
    }
    const rows = readExperience();
    expBox.textContent = rows.length ? `经验沉淀：本机 ${rows.filter((r) => r.outcome === 'previewed').length} 次执行，${rows.filter((r) => r.outcome === 'committed').length} 次写入，${rows.filter((r) => r.outcome === 'discarded').length} 次放弃。` : '经验沉淀：还没有执行记录。';
  }
  function render() {
    scope.replaceChildren();
    scope.append(el('span', focusCells ? `范围：所选 ${focusCells.length} 格` : '范围：整个场景'));
    scope.append(btn('在实景中点选范围', async () => { try { await request('cap.pick', { enabled: true }); setNote('请在实景中单击一栋楼或一块地（拖动不算）。'); } catch (e) { setNote(e.message); } }));
    if (focusCells) scope.append(btn('整个场景', () => { focusCells = null; request('cap.highlight', { cells: [] }).catch(() => {}); render(); doScan(); }));
    actions.replaceChildren(btn(busy ? '执行中…' : '⟳ 扫描场景能力', doScan), btn('⚙ 生成候选', generate, 'primary'));
    for (const b of actions.querySelectorAll('button')) b.disabled = busy;
    renderTimeline();
  }
  render();

  /** 代码能力节点的检视器内容 */
  function inspect(cap, node, panel, onParams) {
    const meta = cap.codeMeta || {};
    panel.append(el('p', '作用对象：' + (meta.targets || '—'), 'muted'));
    const m = scan?.matches.find((x) => x.id === cap.id);
    const box = el('section', undefined, 'cap-matches');
    box.append(el('h3', m ? `能作用的物件 · ${m.count}` : '能作用的物件'));
    if (!m) box.append(el('p', '在右下「扫描场景能力」后显示。', 'muted'));
    else if (!m.count) box.append(el('p', '当前' + (focusCells ? '所选范围' : '场景') + '里没有符合条件的物件。', 'muted'));
    else for (const t of m.targets.slice(0, 8)) { const row = el('div', undefined, 'match-row'); row.append(el('span', t.reason), btn('定位', () => agent.highlight(t.cells.concat(t.ends || [])))); box.append(row); }
    panel.append(box);
    for (const [k, p] of Object.entries(meta.params || {})) {
      const label = el('label', p.label, 'control'), input = el('input');
      input.type = 'number'; input.min = p.min; input.max = p.max; input.step = 1; input.value = node.params?.[k] ?? p.default;
      input.onchange = () => onParams(k, Math.max(p.min, Math.min(p.max, Math.round(+input.value || p.default))));
      label.append(input); panel.append(label);
    }
    if (meta.sources?.length) {
      const s = el('div', undefined, 'cap-sources'); s.append(el('small', '来源视频（学习工坊）'));
      for (const id of meta.sources) s.append(btn(id, () => openSource(id)));
      panel.append(s);
    }
    const x = experienceFor(cap.id);
    panel.append(el('p', x.runs ? `经验：执行 ${x.runs} 次，真正改动 ${x.applied} 次，验证通过 ${x.passed} 次、不通过 ${x.failed} 次，写入 ${x.committed} 次。${x.lastFailure ? '最近失败：' + x.lastFailure : ''}` : '经验：还没有在本场景执行过。', 'agent-exp'));
  }
  return { agent, inspect, scan: doScan, get lastScan() { return scan; } };
}
