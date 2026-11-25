/**
 * auto-assemble-panel.js — 系统工坊页上的「按目标自动拼管线 · 能力契约」面板（R51 契约总览、R52 生成的检查、R53 自动拼管线、R60 两段连跑）。
 * 只在页面上拼计划、显示推理；「装进各层管线」调各层工坊的 add（换掉这几层原来的节点，可「撤销装入」恢复）；
 * 「两段连跑」= 装进去 → 山形执行并预览 → 建筑重新扫描（读到山形候选的高度）→ 建筑执行并预览。不点采用，不写任何默认。
 */
import { validateContracts, contractLine, RESOURCES, PRESERVES, LAYER_NAMES, SCENE_LAYERS } from './contracts.js?v=contract-r1';
import { checksFromPreserves } from './contract-verify.js?v=contract-r1';
import { assemblePipeline, layersForScene, assemblySummary } from './auto-assemble.js?v=assemble-r1';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const CSS = `
#auto-assemble{border:1px solid var(--line,#ddd);border-radius:8px;padding:8px 12px;margin:8px 0;background:var(--panel,#fff)}
#auto-assemble>summary{cursor:pointer;font-weight:600}
#auto-assemble .aa-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}
#auto-assemble .aa-row input{flex:1 1 320px;min-width:200px}
#auto-assemble .aa-stages{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin:6px 0;padding:0;list-style:none}
#auto-assemble .aa-stage{border:1px solid var(--line,#ddd);border-radius:6px;padding:4px 8px;min-width:180px}
#auto-assemble .aa-stage b{display:block;font-size:12px}
#auto-assemble .aa-stage ol{margin:2px 0;padding-left:18px;font-size:12px}
#auto-assemble .aa-arrow{align-self:center;font-size:18px;color:var(--muted)}
#auto-assemble .aa-why{font-size:11px;color:var(--muted)}
#auto-assemble .aa-reasoning{font-size:12px;margin:4px 0;padding-left:18px}
#auto-assemble .aa-reasoning li[data-kind=order]{font-weight:600}
#auto-assemble .aa-reasoning li[data-kind=unmet]{color:#b03a2e}
#auto-assemble table{font-size:11px;border-collapse:collapse;width:100%}
#auto-assemble td,#auto-assemble th{border-bottom:1px solid var(--line,#eee);padding:2px 4px;text-align:left;vertical-align:top}
#auto-assemble .src-meta{color:#2e7d32}#auto-assemble .src-overlay{color:#a66d00}#auto-assemble .src-none{color:#b03a2e}
#auto-assemble .aa-chain{font-size:12px;margin:4px 0}
`;

export function ensureAssembleHost(doc = document) {
  if (!doc.getElementById('auto-assemble-css')) { const st = doc.createElement('style'); st.id = 'auto-assemble-css'; st.textContent = CSS; doc.head.append(st); }
  let h = doc.getElementById('auto-assemble');
  if (!h) { h = doc.createElement('details'); h.id = 'auto-assemble'; h.open = true; const region = doc.querySelector('.pipe-region'); if (region) region.before(h); else doc.body.prepend(h); }
  return h;
}

/**
 * getLayers() → [{ id, name, caps }]（所有已登记的层，含建筑层）；getViews() → studio 的 views（mountain / building / battle / fx …）；
 * scenes() → 场景下拉的选项 [{ id, label }]。
 */
export function mountAutoAssemblePanel({ getLayers, getViews, request, status = () => {}, sceneId = () => globalThis.__tmCurrentScene, scenes = () => [] }) {
  const host = ensureAssembleHost(); host.textContent = '';
  host.append(el('summary', '按目标自动拼管线 · 能力契约（创新 2）'));
  const row = el('div', undefined, 'aa-row'), goal = el('input'), scene = el('select'), run = el('button', '按目标自动拼管线', 'primary'), apply = el('button', '装进各层管线'), undo = el('button', '撤销装入'), chain = el('button', '两段连跑（地形 → 建筑）');
  goal.id = 'assemble-goal'; goal.placeholder = '例如：在山上建一片带路的建筑群 / 主峰更高 / 战役镜头'; goal.value = '在山上建一片带路的建筑群';
  scene.id = 'assemble-scene'; run.id = 'assemble-run'; apply.id = 'assemble-apply'; undo.id = 'assemble-undo'; chain.id = 'assemble-chain';
  for (const b of [run, apply, undo, chain]) b.type = 'button';
  apply.disabled = true; undo.disabled = true;
  row.append(goal, scene, run, apply, undo, chain);
  const result = el('div'); result.id = 'assemble-result';
  const chainOut = el('p', '', 'aa-chain'); chainOut.id = 'assemble-chain-note';
  const contracts = el('details'); contracts.id = 'contract-panel';
  host.append(row, result, chainOut, contracts);
  let last = null, backup = null;

  const fillScenes = () => {
    const cur = scene.value || sceneId() || 'citadel', list = scenes().filter((s) => SCENE_LAYERS[s.id]);
    const opts = list.length ? list : Object.keys(SCENE_LAYERS).map((id) => ({ id, label: id }));
    scene.textContent = ''; for (const s of opts) { const o = el('option', s.label || s.id); o.value = s.id; scene.append(o); }
    scene.value = opts.some((s) => s.id === cur) ? cur : opts[0]?.id || '';
  };
  // R51 / R52 契约总览：每个能力一行（契约 / 来源 / 生成的检查）
  function renderContracts() {
    const layers = getLayers().filter((L) => (L.caps || []).length), v = validateContracts(layers);
    host.dataset.contracts = JSON.stringify({ total: v.total, declared: v.declared, fromMeta: v.fromMeta, fromOverlay: v.fromOverlay, missing: v.missing.length, missingIds: v.missing, errors: v.errors, errorIds: [...new Set(v.problems.filter((p) => p.level === 'error').map((p) => p.id))], warnings: v.warnings });
    contracts.textContent = '';
    contracts.append(el('summary', `能力契约：${v.declared} / ${v.total} 个能力有契约（meta ${v.fromMeta} · 过渡表 ${v.fromOverlay}）· 错误 ${v.errors} · 提醒 ${v.warnings}`));
    const t = el('table'), head = el('tr'); for (const h of ['层', '能力', '契约（读 · 写 · 不动）', '来源', '验证会自动查']) head.append(el('th', h)); t.append(head);
    for (const c of v.contracts) {
      const tr = el('tr'); tr.dataset.cap = c.id;
      tr.append(el('td', LAYER_NAMES[c.layer] || c.layer), el('td', `${c.name}（${c.id}）`), el('td', c.source === 'none' ? '—' : contractLine(c)));
      const src = el('td', { meta: 'meta', overlay: '过渡表', none: '没有' }[c.source], 'src-' + c.source); tr.append(src);
      tr.append(el('td', checksFromPreserves(c.preserves).map((x) => x.name + (x.generic ? '' : '（本层自查）')).join('、') || '—'));
      t.append(tr);
    }
    contracts.append(t);
    if (v.problems.length) { const ul = el('ul', undefined, 'aa-reasoning'); for (const p of v.problems.slice(0, 40)) { const li = el('li', `${p.level === 'error' ? '✗' : '!'} ${p.id}：${p.text}`); li.dataset.kind = p.level === 'error' ? 'unmet' : 'warn'; ul.append(li); } contracts.append(ul); }
    return v;
  }
  // R53 拼管线并显示推理
  function doAssemble() {
    const sid = scene.value || sceneId(), layers = layersForScene(sid, getLayers()), views = getViews();
    const scans = {}, pipes = {}; for (const L of layers) { const v = views[L.id]; if (v?.agent?.lastScan) scans[L.id] = v.agent.lastScan(); if (v?.pipeline) pipes[L.id] = v.pipeline; }
    last = assemblePipeline({ goal: goal.value, sceneId: sid, layers, scans, pipes });
    host.dataset.assembly = JSON.stringify({ mode: last.mode, ok: last.ok, scene: sid, steps: last.steps.map((s) => s.id), stages: last.stages.map((s) => ({ layer: s.layer, ids: s.ids })), unmet: last.unmet.length, links: last.links.length, reasoning: last.reasoning.length });
    result.textContent = '';
    result.append(el('h4', assemblySummary(last)));
    if (!layers.length) result.append(el('p', `场景 ${sid} 还没有能拼的层。`, 'muted'));
    const stages = el('ul', undefined, 'aa-stages');
    last.stages.forEach((s, i) => {
      if (i) stages.append(el('li', '→', 'aa-arrow'));
      const li = el('li', undefined, 'aa-stage'); li.dataset.layer = s.layer; li.append(el('b', `第 ${i + 1} 段 · ${s.name}`));
      const ol = el('ol'); for (const id of s.ids) { const st = last.steps.find((x) => x.id === id), item = el('li', st.name); item.dataset.cap = id; item.append(el('div', st.why.join('；') + (st.warn ? '；⚠ ' + st.warn : ''), 'aa-why')); ol.append(item); }
      li.append(ol); stages.append(li);
    });
    result.append(stages);
    const rs = el('ul', undefined, 'aa-reasoning'); rs.id = 'assemble-reasoning';
    for (const r of last.reasoning) { const li = el('li', r.text); li.dataset.kind = r.kind; rs.append(li); }
    result.append(el('h5', '为什么是这几步（契约链接）'), rs);
    apply.disabled = !last.steps.length;
    status('自动拼管线：' + assemblySummary(last));
    return last;
  }
  // 装进各层管线（换掉这几层原来的节点，留一份备份）
  function doApply() {
    if (!last?.steps.length) return { ok: false, reason: '先拼管线' };
    const views = getViews(), missing = [...new Set(last.stages.map((s) => s.layer))].filter((l) => !views[l]);
    if (missing.length) { const t = `这几层的工坊还没挂上：${missing.map((l) => LAYER_NAMES[l] || l).join('、')}（先在「当前场景」里切到 ${scene.value}）`; chainOut.textContent = t; return { ok: false, reason: t }; }
    backup = {}; let added = 0;
    for (const L of new Set(last.stages.map((s) => s.layer))) {
      const v = views[L], pipe = v.pipeline; backup[L] = JSON.parse(JSON.stringify(pipe.nodes || []));
      pipe.nodes = (pipe.nodes || []).filter((n) => n.pending); delete pipe.preloadDismissed; pipe.assembled = { goal: goal.value, at: Date.now(), ids: last.steps.filter((s) => s.layer === L).map((s) => s.id) };
      for (const s of last.steps.filter((x) => x.layer === L)) if (v.add(s.id, {}, { quiet: true })) added++;
      v.setNote?.(`已按目标「${goal.value}」装进 ${pipe.assembled.ids.length} 个能力（自动拼管线；原来的节点可在上方「撤销装入」恢复）。`);
    }
    undo.disabled = false; host.dataset.applied = JSON.stringify({ added, layers: Object.keys(backup) });
    chainOut.textContent = `已装进 ${added} 个能力：${last.stages.map((s) => s.name + ' ' + s.ids.length).join(' → ')}。`;
    return { ok: true, added };
  }
  function doUndo() {
    if (!backup) return; const views = getViews();
    for (const [L, nodes] of Object.entries(backup)) { const v = views[L]; if (!v) continue; v.pipeline.nodes = nodes; delete v.pipeline.assembled; const first = nodes.find((n) => !n.pending && n.enabled !== false); if (first) v.add(first.id, first.params || {}, { quiet: true }); else v.setGoal?.(v.pipeline.goal || ''); }
    backup = null; undo.disabled = true; chainOut.textContent = '已恢复装入前的各层管线。'; delete host.dataset.applied;
  }
  // R60 两段连跑：地形 → 建筑
  async function doChain() {
    const t0 = Date.now(), log = (m) => { chainOut.textContent = m; status(m); }, rep = { started: t0, steps: [] };
    try {
      if ((scene.value || sceneId()) !== 'citadel') scene.value = 'citadel';
      if (sceneId() !== 'citadel') throw Error('两段连跑在高山圣城上：先在「当前场景」里选高山圣城');
      const r = doAssemble(); const layersIn = r.stages.map((s) => s.layer);
      if (!layersIn.includes('mountain') || !layersIn.includes('building')) throw Error('目标没拼出「山形 → 建筑」两段（' + assemblySummary(r) + '）：目标里要同时有山和建筑，例如「在山上建一片带路的建筑群」');
      if (layersIn.indexOf('mountain') > layersIn.indexOf('building')) throw Error('契约排序异常：建筑排在了山形前面');
      const a = doApply(); if (!a.ok) throw Error(a.reason);
      const views = getViews();
      const before = views.mountain.agent.current()?.id || null;
      log('第 1 段 · 山形：执行管线并预览…'); await views.mountain.generate();
      const mc = views.mountain.agent.current(); if (!mc || mc.id === before) throw Error('山形管线没有产出新候选（看山形面板里的提示）'); rep.steps.push({ layer: 'mountain', status: mc?.verification?.status || null, previewed: !!mc?.previewed });
      if (!mc?.previewed || mc.verification?.status === 'fail') throw Error('山形候选没出来或验证未通过：' + (mc?.verification?.summary || '无候选'));
      log('第 2 段 · 建筑：重新扫描（读山形候选的高度）…'); await views.building.scan();
      const bBefore = views.building.agent.current()?.id || null;
      log('第 2 段 · 建筑：执行管线并预览…'); await views.building.generate();
      const bc = views.building.agent.current(); if (!bc || bc.id === bBefore) throw Error('建筑管线没有产出新候选（看建筑面板里的提示）');
      const st = await request('building.state'); rep.steps.push({ layer: 'building', status: bc?.verification?.status || null, previewed: !!bc?.previewed, terrain: st.terrain, buildings: st.buildings });
      rep.ok = !!bc?.previewed && bc.verification?.status !== 'fail' && st.terrain === 'mountain-candidate' && st.buildings > 0;
      rep.ms = Date.now() - t0; host.dataset.chain = JSON.stringify(rep);
      log(rep.ok ? `两段连跑完成（${Math.round(rep.ms / 1000)} s）：山形候选 ${rep.steps[0].status} → 建筑群 ${st.buildings} 栋 ${rep.steps[1].status}，建筑站在山形候选上。都只是候选：不采用就不会留下。` : `两段连跑没走完：建筑 ${rep.steps[1]?.status || '?'}，地形来源 ${st.terrain}，${st.buildings} 栋。`);
    } catch (e) { rep.ok = false; rep.error = e.message; rep.ms = Date.now() - t0; host.dataset.chain = JSON.stringify(rep); log('两段连跑失败：' + e.message); }
    return rep;
  }
  run.onclick = (e) => { e.stopPropagation(); doAssemble(); };
  apply.onclick = (e) => { e.stopPropagation(); doApply(); };
  undo.onclick = (e) => { e.stopPropagation(); doUndo(); };
  chain.onclick = (e) => { e.stopPropagation(); chain.disabled = true; doChain().finally(() => { chain.disabled = false; }); };
  fillScenes(); renderContracts();
  return { refresh: () => { fillScenes(); renderContracts(); }, assemble: doAssemble, apply: doApply, chain: doChain, last: () => last, resources: RESOURCES, preserves: PRESERVES };
}
