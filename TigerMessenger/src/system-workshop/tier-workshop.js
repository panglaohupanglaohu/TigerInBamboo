/**
 * tier-workshop.js — 一层工坊的通用界面：管线泳道（代码能力 + 目录占位）+ super agent 面板 + 节点详情。
 * 球系统工坊、物件工坊都用它；层的差异由 agent hooks 与 preview 组件提供。
 */
import { loadCatalog, onCatalogChange, renderNodeDetail, EXEC } from './catalog-view.js?v=sys-r11';
import { makeDropZone } from './capability-sidebar.js?v=sys-r11';
import { saveSet } from './capability-sets.js?v=sys-r4';
import { createTierAgent } from './tier-agent.js';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const btn = (text, fn, cls) => { const b = el('button', text, cls); b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
const ICON = { pass: '✓', warn: '!', fail: '✗' };

export function mountTierWorkshop({ host, sideHost, tier, sideTier = tier, storageKey, caps, agentConfig, preview, openSource, status = () => {}, intro = '', goalHint = '', actions = {}, scopeText = () => '' }) {
  // 管线 = 拖进来的可执行节点（顺序按分区泳道）；只放能执行的能力，占位方法留在左栏能力库
  const KEY = `tm.${storageKey || tier}.pipeline.v2`;
  let pipe; try { pipe = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  pipe ||= { goal: '', nodes: [] };
  // 待完成节点（pending）：集合里还没做好的能力，整组拖入时一起进管线，执行时跳过；能力代码做好后自动转成可执行节点
  pipe.nodes = pipe.nodes.filter((n) => n.pending || caps.some((c) => c.id === n.id));
  for (const n of pipe.nodes) if (n.pending && caps.some((c) => c.id === n.id)) { delete n.pending; n.enabled = true; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pipe)); } catch {} };
  let workshop = null, busy = false, events = [];

  const agent = createTierAgent({ tier, capabilities: caps, ...agentConfig, onEvent: (e) => { events.push(e); if (events.length > 50) events.shift(); renderTimeline(); if (e.type === 'experience') renderPipeline(); } });

  host.classList.add('tier-workshop');
  const left = el('div', undefined, 'tier-main'), right = el('aside', undefined, 'tier-agent agent-panel');
  const head = el('div', undefined, 'tier-head'), goal = el('input'); goal.placeholder = goalHint; goal.value = pipe.goal; goal.setAttribute('aria-label', '改造方向');
  goal.onchange = () => { pipe.goal = goal.value; save(); renderRoute(); };
  const scanB = btn('⟳ 扫描', () => doScan()), genB = btn('▶ 执行管线', () => generate(), 'primary');
  const goalRow = el('label', undefined, 'goal'); goalRow.append('改造方向', goal);
  const scope = el('span', '', 'tier-scope'); scope.title = intro;
  head.append(scope, goalRow, el('div', undefined, 'tier-head-actions'));
  head.lastChild.append(scanB, genB);
  const renderScope = () => { scope.textContent = '作用范围：' + (scopeText() || '—'); };
  const lanes = el('div', undefined, 'tier-lanes'), detail = el('section', undefined, 'tier-detail');
  detail.append(el('p', '点左栏能力库里的条目看来源：⚙ 可执行，可拖进管线；● ◐ ○ 是学习库里这一层的方法（重构版 / 部分 / 原版占位），封装成能力代码后才能进管线。', 'muted'));
  makeDropZone(lanes, { tier, canAccept: (d) => caps.some((c) => c.id === d.id), accept: (id, params) => add(id, params, { quiet: true }), acceptPending: (it) => addPending(it), onReject: (m) => setNote(m), onSet: (r) => addedSet(r),
    laneCheck: (e, d) => {
      const lane = e.target.closest?.('.tier-lane'); if (!lane || !workshop) return { ok: true, lane };
      const dom = workshop.domains.find((x) => x.id === lane.dataset.domain); if (!dom) return { ok: true, lane };
      const ids = d.set ? d.set.map((x) => x.id) : [d.id], mine = ids.map((id) => caps.find((c) => c.id === id)).filter(Boolean);
      if (d.set) return { ok: true, lane, note: `能力集合「${d.name}」：整组进管线，每个能力进到它所属的分区泳道；${mine.length} 个可执行${ids.length > mine.length ? `，${ids.length - mine.length} 个还没做好（标为待完成，执行时跳过）` : ''}。` };
      if (!mine.length) return { ok: false, lane, note: '这不是本条管线能执行的能力。' };
      if (mine[0].domain === dom.id) return { ok: true, lane };
      const home = workshop.domains.find((x) => x.id === mine[0].domain)?.name || mine[0].domain;
      const nCode = caps.filter((c) => c.domain === dom.id).length;
      return { ok: false, lane, note: nCode ? `「${mine[0].name}」属于「${home}」分区，请拖到「${home}」泳道。` : `「${dom.name}」分区还没有可执行的能力（学习库里 ${dom.counts.refactored + dom.counts.partial + dom.counts.original} 个方法还在占位，重构并封装成能力代码后才能拖入）；「${mine[0].name}」请拖到「${home}」泳道。` };
    } });
  left.append(head, lanes);
  // 预览与来源详情放在实景浏览器旁边（同一个实景窗口下方的侧栏），只在本管线激活时显示
  const side = el('div', undefined, 'tier-side'); side.dataset.tier = sideTier;
  side.append(el('p', intro, 'muted'), preview?.root || el('div'), detail);
  (sideHost || left).append(side);

  const note = el('p', '先扫描：在当前' + ({ planet: '星球', object: '场景物件', scene: '场景材质' }[tier] || '对象') + '上逐个匹配能力。', 'agent-note');
  const routeBox = el('div', undefined, 'agent-route'), result = el('div', undefined, 'agent-result'), act = el('div', undefined, 'agent-actions');
  const timeline = el('ol', undefined, 'agent-timeline');
  const h = el('div', undefined, 'agent-head'); h.append(el('small', 'SUPER AGENT · ' + ({ planet: '球系统', object: '物件', scene: '场景' }[tier] || tier)), el('h3', 'Router → 改造 → 验证'));
  const wd = el('details', undefined, 'tier-watchdog'); wd.append(el('summary', 'Watchdog · 任务与恢复'), timeline);
  right.append(h, note, act, result, routeBox, wd);
  host.append(left, right);
  const setNote = (t) => { note.textContent = t; };

  // 待完成节点放进哪条泳道：先看它自带的分区，再按能力 id 前缀猜，猜不到就放到最后的「待完成」泳道
  const PREFIX = { terrain: ['terrain'], water: ['water'], build: ['building'], building: ['building'], effects: ['atmosphere', 'weather'], light: ['light', 'atmosphere'], world: ['style'], weather: ['weather', 'atmosphere'], vehicle: ['vehicle'], camera: ['camera'] };
  const domainOf = (n) => {
    const c = caps.find((x) => x.id === n.id); if (c) return c.domain;
    if (!workshop) return null; const has = (d) => d && workshop.domains.some((x) => x.id === d);
    if (has(n.domain)) return n.domain;
    for (const d of workshop.domains) if (d.nodes?.some((x) => x.id === n.id)) return d.id;
    return (PREFIX[String(n.id).split('.')[0]] || []).find(has) || null;
  };
  const order = (n) => { const d = domainOf(n); const i = workshop ? workshop.domains.findIndex((x) => x.id === d) : 0; return i < 0 ? 999 : i; };
  const sorted = () => [...pipe.nodes].sort((a, b) => order(a) - order(b));
  function addPending(it) {
    if (caps.some((c) => c.id === it.id)) return add(it.id, it.params || {}, { quiet: true });
    if (!pipe.nodes.some((x) => x.id === it.id)) pipe.nodes.push({ id: it.id, pending: true, enabled: false, name: it.name || it.id, domain: it.domain || null, params: { ...(it.params || {}) } });
    save(); renderPipeline(); return true;
  }
  function add(id, params = {}, { quiet = false } = {}) {
    const cap = caps.find((c) => c.id === id); if (!cap) { setNote(`「${id}」在这一层还没有执行适配，管线里只放能执行的节点。`); return false; }
    const n = pipe.nodes.find((x) => x.id === id);
    if (n) { delete n.pending; n.enabled = true; n.params = { ...n.params, ...params }; } else pipe.nodes.push({ id, enabled: true, params: { ...params } });
    save(); renderPipeline(); renderRoute(); if (!quiet) setNote(`已加入管线：${cap.name}`); return true;
  }
  const addedSet = (r) => setNote(`能力集合「${r.name}」整组进管线：${r.added} 个可执行${r.pending?.length ? `；${r.pending.length} 个还没做好（${r.pending.slice(0, 3).map((x) => String(x).length > 14 ? String(x).slice(0, 14) + '…' : x).join('、')}${r.pending.length > 3 ? ' 等' : ''}），已标为待完成，执行时跳过` : ''}${r.skipped?.length ? `；${r.skipped.length} 个没放进来` : ''}。${r.added ? '可以直接 ▶ 执行管线，先跑做好的能力。' : '这组暂时没有能执行的能力，做好后会自动变成可执行节点。'}`);
  function addSet(set, name) { let added = 0; const pending = []; for (const it of set) { if (caps.some((c) => c.id === it.id)) { add(it.id, it.params || {}, { quiet: true }); added++; } else { addPending(it); pending.push(it.name || it.id); } } addedSet({ name, added, pending }); }
  function renderPipeline() {
    lanes.replaceChildren();
    if (!workshop) return;
    const head = el('div', undefined, 'tier-pipe-head');
    const nPend = pipe.nodes.filter((n) => n.pending).length;
    head.append(el('b', `管线 · ${pipe.nodes.filter((n) => n.enabled && !n.pending).length} 个节点可执行${nPend ? ` · ${nPend} 个待完成` : ''}`), el('small', '从左栏拖入 ⚙ 能力或 ▣ 能力集合；执行顺序按分区从上到下', 'muted'));
    if (pipe.nodes.length) {
      head.append(btn('存为能力集合', () => { const s2 = saveSet(tier, pipe.goal ? pipe.goal.slice(0, 16) : '', sorted().filter((n) => n.enabled || n.pending).map((n) => n.pending ? { id: n.id, name: n.name, domain: n.domain, params: { ...n.params } } : { id: n.id, params: { ...n.params } })); setNote(`已存为能力集合「${s2.name}」，在左栏能力集合里，可整组拖入。`); }, 'small'));
      head.append(btn('清空管线', () => { pipe.nodes = []; save(); renderPipeline(); renderRoute(); }, 'small'));
    }
    lanes.append(head);
    const pendingCard = (n) => {
      const card = el('article', undefined, 'tier-node pending'), top = el('div', undefined, 'tier-node-head');
      const rm = el('button', '✕', 'node-remove'); rm.type = 'button'; rm.title = '移出管线'; rm.onclick = () => { pipe.nodes = pipe.nodes.filter((x) => x !== n); save(); renderPipeline(); renderRoute(); };
      const name = String(n.name || n.id); top.append(el('span', '待完成', 'pending-tag'), el('strong', '○ ' + (name.length > 40 ? name.slice(0, 40) + '…' : name)), rm);
      card.title = name + '\n还没有执行适配：执行管线时跳过，先跑其他做好的能力；能力代码做好后自动变成可执行节点。';
      card.append(top); return card;
    };
    const lanesFor = workshop.domains.map((d) => d.id);
    const orphan = sorted().filter((n) => n.pending && !lanesFor.includes(domainOf(n)));
    workshop.domains.forEach((d, i) => {
      const rows = sorted().filter((n) => domainOf(n) === d.id);
      const lane = el('section', undefined, 'tier-lane' + (rows.length ? '' : ' empty')), h = el('header'); lane.dataset.domain = d.id;
      h.append(el('b', String(i + 1).padStart(2, '0') + ' / ' + d.name));
      const counts = el('span', undefined, 'lane-counts');
      const nCode = caps.filter((c) => c.domain === d.id).length;
      if (nCode) counts.append(el('i', '⚙' + nCode, 'exec-code'));
      const ph = d.counts.refactored + d.counts.partial + d.counts.original;
      if (ph) { const x = el('i', '○' + ph, 'exec-original'); x.title = `学习库里这一分区还有 ${ph} 个方法（${EXEC.refactored[1]} ${d.counts.refactored} · ${EXEC.partial[1]} ${d.counts.partial} · ${EXEC.original[1]} ${d.counts.original}），见左栏`; counts.append(x); }
      h.append(counts); lane.append(h);
      const body = el('div', undefined, 'lane-body');
      for (const n of rows) {
        if (n.pending) { body.append(pendingCard(n)); continue; }
        const cap = caps.find((c) => c.id === n.id), card = el('article', undefined, 'tier-node' + (n.enabled ? ' on' : ''));
        const top = el('div', undefined, 'tier-node-head'), cb = el('input'); cb.type = 'checkbox'; cb.checked = n.enabled; cb.title = '启用 / 停用';
        cb.onchange = () => { n.enabled = cb.checked; save(); renderPipeline(); renderRoute(); };
        const rm = el('button', '✕', 'node-remove'); rm.type = 'button'; rm.title = '移出管线'; rm.onclick = () => { pipe.nodes = pipe.nodes.filter((x) => x !== n); save(); renderPipeline(); renderRoute(); };
        top.append(cb, el('strong', '⚙ ' + cap.name), rm); card.append(top, el('p', cap.does));
        for (const [k, def] of Object.entries(cap.params || {})) {
          const lab = el('label', undefined, 'tier-param'), v = n.params?.[k] ?? def.default, inp = el('input');
          if (def.type === 'bool') { inp.type = 'checkbox'; inp.checked = !!v; inp.onchange = () => { n.params = { ...n.params, [k]: inp.checked }; save(); }; lab.append(el('span', def.label), inp); }
          else { inp.type = 'range'; inp.min = def.min; inp.max = def.max; inp.step = def.step; inp.value = v; const out = el('output', String(v)); inp.oninput = () => (out.textContent = inp.value); inp.onchange = () => { n.params = { ...n.params, [k]: +inp.value }; save(); }; lab.append(el('span', def.label), inp, out); }
          card.append(lab);
        }
        const e = agent.experience.summary(cap.id); if (e.runs) card.append(el('small', `经验：预览 ${e.runs} · 通过 ${e.passed} · 写入 ${e.committed}${e.lastFailure ? ' · 上次失败：' + e.lastFailure.slice(0, 40) : ''}`, 'muted'));
        body.append(card);
      }
      if (!rows.length) body.append(el('span', '拖入能力', 'drop-hint'));
      lane.append(body); lanes.append(lane);
    });
    if (orphan.length) {
      const lane = el('section', undefined, 'tier-lane pending-lane'), h = el('header'), body = el('div', undefined, 'lane-body');
      h.append(el('b', '待完成 · 还没归入分区'), el('small', '执行时跳过', 'muted')); for (const n of orphan) body.append(pendingCard(n));
      lane.append(h, body); lanes.append(lane);
    }
  }
  function renderRoute() {
    routeBox.replaceChildren();
    const scan = agent.lastScan(); if (!scan) return;
    routeBox.append(el('h4', 'Router · 按改造方向建议'));
    const plan = agent.route(pipe.goal, pipe.nodes.filter((n) => n.enabled && !n.pending).map((n) => n.id));
    for (const m of scan.matches) if (!m.count) routeBox.append(el('p', `${caps.find((c) => c.id === m.id)?.name}：当前没有可作用的对象`, 'muted'));
    if (!plan.length) routeBox.append(el('p', '改造方向没有命中能力关键词；也可以直接在泳道里勾选能力。', 'muted'));
    for (const p of plan) {
      const cap = caps.find((c) => c.id === p.id), row = el('div', undefined, 'route-row'), n = pipe.nodes.find((x) => x.id === p.id);
      row.append(el('span', `${cap.name} · ${p.matches}`), el('small', p.why));
      row.append(n?.enabled ? el('small', '已在管线', 'muted') : btn('加入管线', () => add(p.id)));
      routeBox.append(row);
    }
  }
  function renderTimeline() {
    timeline.replaceChildren();
    for (const e of events.slice(-14)) {
      const t = e.type === 'job' ? `${e.name} ${({ running: '开始', done: '完成', failed: '失败', crashed: '崩溃→重建', timeout: '超时→重建' })[e.state] || e.state}${e.ms ? ' ' + e.ms + 'ms' : ''}`
        : e.type === 'beat' ? `♥ ${e.name}：${e.stage}` : e.type === 'recover' ? `Watchdog 恢复 ${e.name}：${e.why}，已重试` : e.type === 'phase' ? `阶段 → ${e.phase}${e.status ? '（' + e.status + '）' : ''}` : e.type === 'experience' ? `经验 +1：${e.row.outcome}` : e.type;
      timeline.append(el('li', t, e.state === 'failed' || e.state === 'timeout' || e.type === 'recover' ? 'bad' : ''));
    }
    timeline.scrollTop = timeline.scrollHeight;
  }
  function renderActions() {
    act.replaceChildren();
    const c = agent.current();
    scanB.disabled = genB.disabled = busy;
    if (!c) return;
    let comparing = false;
    const cmp = btn('对照原样', async () => { comparing = !comparing; await agent.compare(comparing); cmp.textContent = comparing ? '看候选' : '对照原样'; });
    const commit = btn(actions.commitLabel || '✓ 写入', async () => { try { const r = await agent.commit(); setNote(actions.committed?.(r) || '已写入。'); status(actions.committed?.(r) || '已写入'); result.replaceChildren(); renderActions(); doScan(); } catch (e) { setNote(e.message); } }, 'primary');
    commit.disabled = c.verification.status === 'fail';
    act.append(cmp, commit);
    if (actions.draft) act.append(btn('存草稿', async () => { try { const r = await agent.draft(); setNote(actions.drafted?.(r) || '已存草稿。'); } catch (e) { setNote(e.message); } }));
    act.append(btn('放弃', async () => { await agent.discard(); result.replaceChildren(); setNote('已放弃候选，已恢复原样。'); renderActions(); }));
    for (const b of actions.extra?.(c, { setNote, rerender: renderActions }) || []) act.append(b);
  }
  function renderResult(c) {
    result.replaceChildren();
    const v = c.verification;
    result.append(el('h4', '候选 · ' + (v.status === 'fail' ? '验证未通过' : v.status === 'warn' ? '通过（需留意）' : '验证通过')));
    const ul = el('ul', undefined, 'step-report');
    for (const r of c.report) { const cap = caps.find((x) => x.id === r.id), li = el('li'); li.append(el('span', `${cap?.name || r.id}：${r.status === 'applied' ? '执行' : r.status === 'no-target' ? '没有可作用对象，跳过' : r.status}${r.count ? ' ' + r.count + ' 个' : ''}`)); if (r.changed?.length) li.append(el('small', r.changed.join('；'))); if (r.focus?.length && actions.locate) li.append(btn('定位', () => actions.locate(r.focus))); ul.append(li); }
    result.append(ul);
    const checks = el('ul', undefined, 'verify-checks');
    for (const k of v.checks) { const li = el('li', undefined, 'check-' + k.status); li.append(el('b', ICON[k.status] + ' ' + k.name), el('small', k.detail)); checks.append(li); }
    result.append(checks);
  }
  async function doScan() {
    if (busy) return; busy = true; renderActions(); setNote('扫描中…');
    try { const s = await agent.scan(); preview?.onScan?.(s); const n = s.matches.filter((m) => m.count).length; setNote(`扫描完成：${n} / ${s.matches.length} 个能力能作用。${preview?.scanNote?.(s) || ''}`); renderRoute(); }
    catch (e) { setNote('扫描失败：' + e.message); }
    finally { busy = false; renderActions(); }
  }
  async function generate() {
    const steps = sorted().filter((n) => n.enabled && !n.pending && caps.some((c) => c.id === n.id)).map((n) => ({ id: n.id, params: n.params || {} }));
    const waiting = pipe.nodes.filter((n) => n.pending), skipNote = waiting.length ? `（跳过 ${waiting.length} 个待完成能力）` : '';
    if (!steps.length) { setNote(waiting.length ? `管线里只有待完成的能力（${waiting.length} 个），还没有能执行的节点；再拖入 ⚙ 能力后执行。` : '管线是空的：从左栏把 ⚙ 能力拖进来，或扫描后按 Router 建议加入。'); return; }
    busy = true; renderActions(); setNote('改造 Worker 执行中：' + steps.map((s) => caps.find((c) => c.id === s.id).name).join(' → ') + skipNote);
    try { const c = await agent.generate({ steps, goal: pipe.goal }); renderResult(c); setNote((c.verification.status === 'fail' ? '候选验证未通过：不能写入。调整参数后重试，或放弃。' : '候选已预览。确认前不会写入。') + skipNote); status(tier + ' 候选：' + c.verification.summary); }
    catch (e) { setNote('执行失败：' + e.message); }
    finally { busy = false; renderActions(); }
  }
  onCatalogChange((cat) => { workshop = cat.workshops.find((w) => w.id === tier); renderPipeline(); });
  loadCatalog().then((cat) => { workshop = cat.workshops.find((w) => w.id === tier); renderPipeline(); }).catch((e) => { lanes.textContent = e.message; });
  renderActions(); renderScope();
  return { agent, scan: doScan, generate, add, addSet, addPending, renderScope, setNote, btn, showDetail: (node) => { renderNodeDetail(detail, node, { openSource }); detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, get pipeline() { return pipe; }, setGoal(g) { pipe.goal = goal.value = g; save(); renderRoute(); } };
}
