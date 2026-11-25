/**
 * defaults-ui.js — R-A2/R-A3 管线级「采用 / 设为默认」界面（用户 2026-11-23 决定）。
 *
 * 两个挂载点，都走 defaults.js 的共享登记处（tm.defaults.v1）：
 *   mountDefaultsControl —— 各层工坊侧栏里的一块「当前默认」小卡：显示这一层当前默认是谁定的、
 *     什么时候定的，按钮「设为默认」（把本层刚验证过的计划登记进去）/「撤销默认」（删记录 + 调层自己的 unadopt）。
 *   mountDefaultsSummary —— 管线页顶部「当前默认」栏：列出所有场景 × 层的默认记录，一键撤回。
 *
 * 层与层的差异全部由调用方注入：capabilityName(id) 显示名、getPlan() 拿当前计划、
 * onSet(record) / onClear(record) 由层接到自己的 adopt / unadopt（登记处本身不解释 plan）。
 * 不写场景存档；撤销只删登记 + 调层的撤销函数。
 */
import { getDefault, setDefault, clearDefault, listAll, listDefaults, recordKey } from './defaults.js?v=defaults-r2';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const CSS = `.defaults-ui{border:1px solid var(--line,#d8d3c6);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel,#fbfaf6)}
.defaults-ui h4{margin:0 0 4px}.defaults-ui .du-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0;font-size:13px}
.defaults-ui .du-none{color:#8a8578}.defaults-ui .du-meta{color:#6b6b6b;font-size:12px}
.defaults-ui table{width:100%;border-collapse:collapse;font-size:12px}.defaults-ui td,.defaults-ui th{padding:2px 4px;border-bottom:1px solid var(--line,#e6e1d4);text-align:left}
.defaults-ui button{font-size:12px}`;
function ensureCss() { if (document.getElementById('defaults-ui-css')) return; const s = document.createElement('style'); s.id = 'defaults-ui-css'; s.textContent = CSS; document.head.append(s); }

const fmtTime = (at) => { if (!at) return '时间未知'; const d = new Date(at); return Number.isNaN(d.getTime()) ? String(at) : d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); };
const who = (r) => (r.status && r.status !== 'active') ? '待决定登记' : (r.adoptedBy === 'auto-test' ? '按实测选优代选' : '手动采用');
/**
 * R-A5 pending 记录的状态文案：pending 记录不是「默认」，能力列显示待决定状态而不是能力名。
 * 返回 null = active 记录，照常显示能力名。
 */
export function statusLabel(r) {
  if (!r || !r.status || r.status === 'active') return null;
  if (r.status === 'pending-measurement') return '待实测选出' + (r.pendingRef ? ' · ' + r.pendingRef : '');
  if (r.status === 'pending-user') return '待你决定' + (r.pendingRef ? ' · ' + r.pendingRef : '');
  return '待决定 · ' + r.status;
}
/** UI 用的 storage：优先参数注入；否则浏览器 localStorage；都不可用退化内存表。 */
function uiStorage(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch { /* 沙箱 */ }
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/** 这一层现在默认是谁（纯逻辑，单测用）：返回 { capabilityId, planId, by, at } 或 null。 */
export function currentDefaultView(storage, scene, layer, nameOf = (id) => id) {
  const r = getDefault(storage, scene, layer);
  if (!r) return null;
  return { capabilityId: r.capabilityId, name: nameOf(r.capabilityId), planId: r.planId, by: who(r), at: fmtTime(r.at), status: r.status, pendingRef: r.pendingRef, raw: r };
}

/**
 * 层侧栏的「当前默认」卡。
 * opts: { host, scene, layer, storage?, nameOf?, getPlan?, onSet?, onClear?, setLabel? }
 *   getPlan() → { planId, plan, note? } | null   当前可登记的计划（没有可登记的返回 null，按钮禁用）
 *   onSet(record) / onClear(record) → Promise|void  层自己的 adopt / unadopt；登记在回调成功后写
 */
export function mountDefaultsControl({ host, scene, layer, storage, nameOf = (id) => id, getPlan = () => null, onSet = async () => {}, onClear = async () => {}, setLabel = '设为默认' } = {}) {
  if (!host || !scene || !layer) return null;
  ensureCss();
  // scene 可以是字符串或 () => 当前场景 id（工坊跨场景复用时登记跟着走）。
  const sc = () => (typeof scene === 'function' ? scene() : scene) || '';
  const root = el('section', undefined, 'defaults-ui');
  root.id = `defaults-${sc()}-${layer}`; root.dataset.defaultsScene = sc(); root.dataset.defaultsLayer = layer;
  const head = el('h4', `当前默认 · ${layer}`);
  const line = el('p', '', 'du-none');
  const meta = el('p', '', 'du-meta');
  const row = el('div', undefined, 'du-row');
  const setBtn = el('button', setLabel, 'small'); setBtn.type = 'button'; setBtn.dataset.defaultsSet = `${sc()}:${layer}`;
  const clearBtn = el('button', '撤销默认', 'small'); clearBtn.type = 'button'; clearBtn.dataset.defaultsClear = `${sc()}:${layer}`;
  row.append(setBtn, clearBtn);
  root.append(head, line, meta, row);
  host.append(root);

  const st = uiStorage(storage);

  let lastSig = '';
  function draw() {
    const v = currentDefaultView(st, sc(), layer, nameOf);
    const pending = getPlan();
    const sig = JSON.stringify([v?.raw?.at, v?.raw?.capabilityId, v?.raw?.status, pending?.planId ?? null]);
    if (sig === lastSig) return;
    lastSig = sig;
    if (v) {
      const pend = statusLabel(v.raw);
      line.className = pend ? 'du-pending' : ''; line.textContent = pend ? pend : `默认：${v.name}`;
      meta.textContent = `${v.by} · ${v.at}${v.planId ? ' · 计划 ' + v.planId : ''}`;
      clearBtn.disabled = false;
    } else {
      line.className = 'du-none'; line.textContent = '还没有默认——当前用的是场景原样';
      meta.textContent = '';
      clearBtn.disabled = true;
    }
    setBtn.disabled = !pending;
    setBtn.title = pending ? '' : '先跑出一个通过验证的计划才能设为默认';
  }
  // 候选在别处的 agent 面板里产生，这里没有回调；监听 DOM 变化重画，
  // 让「设为默认」在跑出通过验证的计划后自动可用（debounce，root 卸载后停止）。
  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (scheduled || !root.isConnected) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; if (root.isConnected) draw(); }, 250);
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  setBtn.onclick = async () => {
    const p = getPlan(); if (!p) return;
    setBtn.disabled = true;
    try {
      const rec = await onSet({ capabilityId: p.capabilityId || layer + '.plan', planId: p.planId ?? null, plan: p.plan ?? null, note: p.note ?? '' });
      if (rec !== false) setDefault(st, sc(), layer, { capabilityId: rec?.capabilityId || p.capabilityId || layer + '.plan', planId: rec?.planId ?? p.planId ?? null, plan: rec?.plan ?? p.plan ?? null, adoptedBy: 'user', source: 'workshop', note: rec?.note ?? p.note ?? '' });
      draw();
    } finally { setBtn.disabled = false; draw(); }
  };
  clearBtn.onclick = async () => {
    clearBtn.disabled = true;
    try {
      const r = getDefault(st, sc(), layer);
      await onClear(r);
      clearDefault(st, sc(), layer);
      draw();
    } finally { clearBtn.disabled = false; draw(); }
  };
  draw();
  return { root, refresh: draw, key: () => recordKey(sc(), layer) };
}

/**
 * 管线页「当前默认」总栏：列出所有记录（可按场景过滤），每行一个「撤回」。
 * opts: { host, scene?（不给 = 全部场景）, storage?, nameOf?, onClear?（scene, layer, record）→ Promise|void,
 *         onAction?（scene, layer, record）→ [{label,title?,run()}…] 行内附加操作（如「去处理」「进游戏自动摆上」） }
 */
export function mountDefaultsSummary({ host, scene = null, storage, nameOf = (id) => id, onClear = async () => {}, onAction = null } = {}) {
  if (!host) return null;
  ensureCss();
  const st = uiStorage(storage);
  const root = el('section', undefined, 'defaults-ui');
  root.id = 'defaults-summary-view';
  const head = el('h4', scene ? `当前默认 · ${scene}` : '当前默认');
  const table = el('table');
  root.append(head, table);
  host.append(root);

  async function draw() {
    table.replaceChildren();
    const recs = scene ? listDefaults(st, scene) : listAll(st);
    const entries = scene ? Object.entries(recs).map(([layer, r]) => [`${scene}:${layer}`, layer, r]) : Object.entries(recs).map(([k, r]) => { const i = k.indexOf(':'); return [k, k.slice(i + 1), r]; });
    if (!entries.length) { const tr = el('tr'); const td = el('td', '还没有任何默认记录——各层工坊里「设为默认」后这里会出现。', 'du-none'); td.colSpan = 5; tr.append(td); table.append(tr); return; }
    const hr = el('tr'); for (const h of ['场景', '层', '能力', '谁定的', '时间', '']) hr.append(el('th', h)); table.append(hr);
    for (const [key, layer, r] of entries) {
      const sc = key.slice(0, key.indexOf(':'));
      const tr = el('tr'); tr.dataset.defaultsRow = key;
      const pend = statusLabel(r);
      tr.append(el('td', sc), el('td', layer), el('td', pend || nameOf(r.capabilityId)), el('td', who(r)), el('td', fmtTime(r.at)));
      const td = el('td');
      // 行操作（去处理 / 决定按钮）：pending 行由 onAction 提供，让「待决定」真的能在面板里被处理
      for (const act of (typeof onAction === 'function' ? onAction(sc, layer, r) || [] : [])) {
        const ab = el('button', act.label, 'small'); ab.type = 'button'; if (act.title) ab.title = act.title;
        ab.onclick = async () => { ab.disabled = true; try { await act.run(sc, layer, r); draw(); } finally { ab.disabled = false; } };
        td.append(ab);
      }
      const btn = el('button', '撤回', 'small'); btn.type = 'button';
      // pending 记录的「撤回」= 删除这条待决定登记（不再追踪），语义上没有层 unadopt 可调，onClear 仍会先跑（各层自己判空）。
      if (pend) btn.title = '删除这条待决定登记（不再追踪 ' + (r.pendingRef || '该项') + '）';
      btn.onclick = async () => { btn.disabled = true; try { await onClear(sc, layer, r); clearDefault(st, sc, layer); draw(); } finally { btn.disabled = false; } };
      td.append(btn); tr.append(td);
      table.append(tr);
    }
  }
  draw();
  host.replaceChildren(root);
  return { root, refresh: draw };
}
