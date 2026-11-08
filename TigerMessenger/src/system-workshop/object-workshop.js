/**
 * 物件工坊：管线作用在当前场景的物件布局上（人物也是物件；目前可编辑的是莫西斯湖合批植物）。
 * 改造 Worker 在布局副本上算出每个物件的新增量，验证 Worker 检查，实景预览走 bridge 的 objects.preview；
 * 写入 = 进入物件编辑记录（一步撤销，随场景草稿 / 定稿保存）。
 */
import { describeObjectCapabilities } from './object/capabilities.js';
import { mountTierWorkshop } from './tier-workshop.js?v=sys-r11';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const KIND = { 'plane-tree': '悬铃树', cypress: '柏树', hollyhock: '蜀葵花丛' };

export function mountObjectWorkshop({ host, sideHost, request, openSource, status }) {
  const caps = describeObjectCapabilities();
  const root = el('div', undefined, 'object-preview'), info = el('p', '等待游戏连接后扫描当前场景的可编辑物件。', 'muted');
  root.append(info);
  // 作用范围：在实景里点选物件 → 这个物件 / 同类物件；不选 = 整个场景
  let selected = window.__tmSelectedObject || null, mode = selected && !selected.editable ? 'all' : 'kind';
  const scopeBar = el('div', undefined, 'object-scope');
  const kindName = (k) => KIND[k] || k;
  const scopeLabel = () => !selected ? '整个场景（在实景中点选物件可缩小范围）' : mode === 'one' ? `选中的「${selected.name}」` : mode === 'kind' ? `所有${kindName(selected.kind)}` : '整个场景';
  function renderScopeBar() {
    scopeBar.replaceChildren();
    const pickB = el('button', '在实景中点选物件'); pickB.type = 'button'; pickB.onclick = () => request('objects.picking', { enabled: true }).catch((e) => view.setNote(e.message));
    scopeBar.append(pickB);
    if (selected) for (const [m, t] of [['one', '只改它'], ['kind', '同类物件'], ['all', '整个场景']]) { const b = el('button', t, mode === m ? 'on' : ''); b.type = 'button'; b.onclick = () => { mode = m; changed(); }; scopeBar.append(b); }
    if (selected) { const c = el('button', '清除选择'); c.type = 'button'; c.onclick = () => { selected = null; window.__tmSelectedObject = null; changed(); request('objects.clear').catch(() => {}); }; scopeBar.append(c); }
  }
  const changed = () => { renderScopeBar(); view.renderScope(); view.scan(); };
  window.addEventListener('message', (e) => { if (e.origin !== location.origin || e.data?.type !== 'tm.scene-object.selected' || !e.data.row?.id) return; selected = e.data.row; mode = selected.editable ? 'kind' : 'all'; if (!selected.editable) view.setNote(`「${selected.name}」属于合并网格，物件管线暂不能改它；范围按整个场景。`); changed(); });
  const inScope = (r) => !selected || mode === 'all' || (mode === 'one' ? r.id === selected.id : r.kind === selected.kind);
  const view = mountTierWorkshop({
    host, sideHost, tier: 'object', caps, openSource, status,
    intro: '物件管线作用在实景里的物件上（人物也是物件；目前可编辑的是莫西斯湖的合批植物）。候选直接在实景里预览；手工改过的物件默认不动。',
    goalHint: '例如：悬铃树太整齐，大小和朝向自然一点，别挤在一起',
    scopeText: scopeLabel,
    agentConfig: {
      transformUrl: new URL('./object/transform-worker.js', import.meta.url), verifyUrl: new URL('./object/verify-worker.js', import.meta.url),
      hooks: {
        input: async () => (await request('objects.layout')).rows.map((r) => ({ ...r, outOfScope: !inScope(r) })),
        scanMsg: (layout) => ({ layout }),
        runMsg: (layout, steps) => ({ layout, steps }),
        verifyMsg: (layout, scan, run) => ({ layout, edits: run.edits, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),  // 用改造 Worker 实际采用的参数（含默认值）验证
        preview: async (c) => request('objects.preview', { edits: c.run.edits }),
        compare: (c, on) => request('objects.preview.compare', { on }),
        revert: () => request('objects.preview.revert'),
        commit: () => request('objects.preview.commit'),
      },
    },
    preview: { root, onScan: () => {}, scanNote: (s) => { const by = {}; for (const m of s.matches) if (m.id !== 'object.spacing-relax') for (const t of m.targets) by[t.id] = Math.max(by[t.id] || 0, t.count); const text = Object.entries(by).map(([k, n]) => kindName(k) + ' ' + n).join('、'); info.textContent = '范围内可批量编辑的物件：' + (text || '无（未命名网格按结构件处理，批量能力不动；可在对象目录里单独编辑）'); return ''; } },
    actions: { commitLabel: '✓ 写入物件', committed: (r) => `已写入 ${r.committed} 个物件（物件编辑里一步可撤销；保存场景草稿时一并保存）。`, locate: (ids) => request('objects.select', { id: ids[0] }).catch(() => {}) },
  });
  host.querySelector('.tier-head')?.prepend(scopeBar);
  renderScopeBar();
  return view;
}
