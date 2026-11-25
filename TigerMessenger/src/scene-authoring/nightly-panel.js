// R40 管线页「夜间晨报」面板：读 artifacts/nightly/latest.json（tools/nightly/run-nightly.mjs 写的），一行摘要 + 可展开的明细 + 晨报链接。
// 没有晨报 / 读不了时降级成一行提示，不影响页面其他部分。只读，不写任何本机数据。
const URL_LATEST = 'artifacts/nightly/latest.json';
const css = `.nightly-report{margin:0 0 6px;padding:6px 10px;border:1px solid var(--line,#2c3440);border-radius:8px;background:var(--panel,#141a22);font-size:12px;line-height:1.5}
.nightly-report .nr-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.nightly-report .nr-head b{font-size:12.5px}
.nightly-report .nr-chip{padding:0 6px;border-radius:9px;background:rgba(127,155,179,.16);white-space:nowrap}.nightly-report .nr-chip.bad{background:rgba(232,98,90,.22)}.nightly-report .nr-chip.good{background:rgba(143,174,127,.24)}
.nightly-report .nr-more{margin-left:auto}.nightly-report ul{margin:4px 0 0 16px;padding:0}.nightly-report .nr-dim{opacity:.7}.nightly-report a{color:inherit}`;
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
let open = false;

export function summarizeLatest(L) {
  const h = L?.headline || {}, u = L?.tests?.unit, d = L?.tests?.drift, t = L?.tree;
  const chips = [
    [`新增能力 ${h.first ? '（首次）' : h.newCapabilities ?? 0}`, h.newCapabilities ? 'good' : ''],
    [`线升级 ${h.lineUp ?? 0}${h.lineDown ? ` · 降级 ${h.lineDown}` : ''}`, h.lineDown ? 'bad' : h.lineUp ? 'good' : ''],
    [`指标 变好 ${h.better ?? 0} / 变差 ${h.worse ?? 0}`, h.worse ? 'bad' : h.better ? 'good' : ''],
    [u ? `单元 ${u.pass ?? '?'}/${u.tests ?? '?'}${u.fail ? ` · ${u.fail} 红` : ''}` : '单元 NOT_RUN', u?.fail ? 'bad' : u ? 'good' : ''],
    [d ? `漂移 ${d.fail ? d.fail + ' 红' : '绿'}` : '漂移 NOT_RUN', d?.fail ? 'bad' : ''],
    [t ? `⚙ ${t.fruit}/${t.lines} 线 · 前沿 ${t.frontier?.length ?? '?'}` : '能力树 未算', t && t.frontier?.length === 0 && t.fruit === t.lines ? 'good' : ''],
  ];
  const failed = (L?.steps || []).filter((s) => ['fail', 'error', 'BLOCKED'].includes(s.status));
  if (failed.length) chips.push([`失败步骤 ${failed.map((s) => s.id).join('、')}`, 'bad']);
  return chips;
}

function render(host, L) {
  host.replaceChildren(); host.dataset.state = 'ready'; host.dataset.date = L.date || '';
  const head = el('div', undefined, 'nr-head'); head.append(el('b', `夜间晨报 · ${L.date || '日期未知'}`));
  for (const [t, c] of summarizeLatest(L)) head.append(el('span', t, 'nr-chip' + (c ? ' ' + c : '')));
  const a = el('a', '打开晨报'); a.href = L.report || '#'; a.target = '_blank'; a.rel = 'noopener'; head.append(a);
  const more = el('button', open ? '收起' : '明细', 'nr-more'); more.type = 'button'; more.onclick = () => { open = !open; render(host, L); }; head.append(more);
  host.append(head);
  if (!open) return;
  const ul = el('ul');
  for (const c of L.newCapabilities || []) ul.append(el('li', `新增 ${c.id}${c.name ? ' ' + c.name : ''} · 线 ${c.line || '未归线'} · ${c.label || ''}`));
  for (const x of L.lineChanges || []) ul.append(el('li', `${x.up ? '↑' : '↓'} ${x.name || x.line}：L${x.from} → L${x.to}`));
  for (const m of L.metricDeltas || []) ul.append(el('li', `${m.better === true ? '变好' : m.better === false ? '变差' : '变化'}：${m.goal} · ${m.name} ${m.from} → ${m.to}`));
  for (const g of L.goals || []) ul.append(el('li', `目标路径 ${g.name || g.id}：${g.status}${g.verify ? ' · 验证 ' + g.verify : ''}`, g.status === 'NOT_RUN' ? 'nr-dim' : ''));
  for (const f of L.tests?.unit?.failures || []) ul.append(el('li', '红：' + f));
  if (!ul.children.length) ul.append(el('li', '和上一次相比没有变化。', 'nr-dim'));
  host.append(ul, el('small', `生成于 ${L.generatedAt || '?'} · 数据 ${URL_LATEST}`, 'nr-dim'));
}

function degrade(host, state, text) {
  host.replaceChildren(); host.dataset.state = state;
  const head = el('div', undefined, 'nr-head'); head.append(el('b', '夜间晨报'), el('span', text, 'nr-dim')); host.append(head);
}

export async function mountNightlyPanel(host = document.getElementById('nightly-report'), { fetchImpl = globalThis.fetch } = {}) {
  if (!host) return null;
  if (!document.getElementById('nightly-report-css')) { const s = el('style', css); s.id = 'nightly-report-css'; document.head.append(s); }
  let r;
  try { r = await fetchImpl(URL_LATEST + '?t=' + Date.now(), { cache: 'no-store' }); } catch (e) { degrade(host, 'missing', '还没有晨报（读不到 ' + URL_LATEST + '）。在 TigerMessenger 目录运行 $NODE tools/nightly/run-nightly.mjs --no-jev 生成。'); return null; }
  if (!r.ok) { degrade(host, 'missing', `还没有晨报（${r.status}）。在 TigerMessenger 目录运行 $NODE tools/nightly/run-nightly.mjs --no-jev 生成。`); return null; }
  let L; try { L = await r.json(); } catch { degrade(host, 'error', '晨报数据读不了（latest.json 不是合法 JSON）。重跑夜间重建。'); return null; }
  if (!L || typeof L !== 'object' || !L.date) { degrade(host, 'error', '晨报数据缺字段（没有 date）。重跑夜间重建。'); return null; }
  render(host, L); return L;
}

if (typeof document !== 'undefined') { const go = () => mountNightlyPanel().catch((e) => { const h = document.getElementById('nightly-report'); if (h) degrade(h, 'error', '晨报面板出错：' + e.message); }); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }
