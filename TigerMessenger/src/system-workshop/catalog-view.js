/**
 * catalog-view.js — 系统目录在各层管线里的显示：每个分区一条泳道。
 *   ⚙ 能力代码（可执行，改造 Worker 跑）→ 重构版已实现 → 重构版部分 → 原版占位（只有 REACode 实现）→ 参考
 * 目录由 tools/refactor/build-system-catalog.mjs 生成；重构推进后重跑脚本，占位节点原地升级。
 */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
export const EXEC = {
  code: ['⚙', '能力代码', '可执行：super agent 直接在副本上跑'],
  refactored: ['●', '重构版', 'REACodeRefactoring 已实现，待封装成能力代码'],
  partial: ['◐', '重构部分', 'REACodeRefactoring 部分实现'],
  original: ['○', '原版占位', '只有重构前 REACode 的实现；重构完成后替换'],
  reference: ['·', '参考', '只作学习参考'],
};
let cache = null;
// 扫描结果存在本机（比随包的目录新时优先用），刷新页面后仍是最新一次扫描
const SCAN_KEY = 'tm.system-catalog.scan.v1';
const readScan = () => { try { return JSON.parse(localStorage.getItem(SCAN_KEY) || 'null'); } catch { return null; } };
export function loadCatalog() {
  cache ||= fetch(new URL('../scene-authoring/catalog/system-catalog.json', import.meta.url), { cache: 'no-store' }).then((r) => { if (!r.ok) throw Error('系统目录读取失败 HTTP ' + r.status); return r.json(); })
    .then((base) => { const sc = readScan(); return sc?.generatedAt > base.generatedAt ? sc : base; });
  return cache;
}
const listeners = new Set();
/** 目录被重新扫描后通知（左栏、各层管线的泳道都跟着刷新） */
export const onCatalogChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const WEB = new URL('../../../townscaper-web/', import.meta.url);
async function loadLearn(rel) {
  const r = await fetch(new URL(rel, WEB), { cache: 'no-store' });
  if (!r.ok) throw Error(rel + ' 读取失败 HTTP ' + r.status);
  const w = {}; new Function('window', await r.text())(w); return w;
}
/**
 * 扫描能力库：直接读学习工坊的数据（REACode 原版 + REACodeRefactoring 重构版 learn 数据、重构审计、能力代码注册表），
 * 重新构建目录 —— 与 tools/refactor/build-system-catalog.mjs 同一套规则（catalog-build.js）。
 * 返回新目录、新增的能力代码描述，以及和扫描前相比的变化。
 */
export async function scanCatalog() {
  const before = await loadCatalog().catch(() => null);
  // 原版 REACode 冻结不改：读不到原目录时用随包快照（tools/refactor/build-system-catalog.mjs 生成）
  const origLearn = () => loadLearn('REACode/learn/data.js').catch(() => fetch(new URL('../scene-authoring/catalog/reacode-learn.json', import.meta.url), { cache: 'no-store' }).then((r) => { if (!r.ok) throw Error('原版学习记录读取失败（REACode 目录与快照都不可用）'); return r.json(); }));
  const [{ buildCatalog }, o, rw] = await Promise.all([import('./catalog-build.js?v=' + Date.now()), origLearn(), loadLearn('REACodeRefactoring/learn/data.js')]);
  let refStatus = {}; try { refStatus = (await loadLearn('REACodeRefactoring/learn/refactoring-status.js')).REFACTOR_STATUS || {}; } catch {}
  // 注册表加时间戳重新加载：新加的能力文件会被读到；已加载过的能力文件改了内容要刷新页面才生效
  const reg = await import(new URL('REACodeRefactoring/src/capabilities/registry.js?scan=' + Date.now(), WEB).href);
  const codeCaps = reg.describeCapabilities();
  const catalog = buildCatalog({ orig: o.LEARN, ref: rw.LEARN, refStatus, codeCaps });
  const ids = (c) => { const m = new Map(); for (const w of c?.workshops || []) for (const d of w.domains) for (const n of d.nodes) if (!m.has(n.id) || n.exec === 'code') m.set(n.id, n.exec); return m; };
  const a = ids(before), b = ids(catalog), rank = ['reference', 'original', 'partial', 'refactored', 'code'];
  const diff = { added: [], upgraded: [], total: b.size, code: codeCaps.length, codeBefore: before?.sources?.codeCapabilities ?? null };
  for (const [id, ex] of b) { if (!a.has(id)) diff.added.push(id); else if (rank.indexOf(ex) > rank.indexOf(a.get(id))) diff.upgraded.push({ id, from: a.get(id), to: ex }); }
  try { localStorage.setItem(SCAN_KEY, JSON.stringify(catalog)); } catch { /* 存不下就只在本次页面里生效 */ }
  cache = Promise.resolve(catalog);
  for (const fn of listeners) try { fn(catalog); } catch (e) { console.warn(e); }
  return { catalog, codeCaps, diff };
}
const fileLink = (where, base) => {
  const m = (where || '').match(/(?:^|[\s/（(、])((?:src|engine|tools|learn)\/[\w./-]+\.(?:js|mjs|glsl|html))/);
  return m ? { path: m[1], href: base + m[1] } : null;
};
export function renderNodeDetail(host, node, { openSource } = {}) {
  host.replaceChildren();
  const [icon, label, hint] = EXEC[node.exec];
  host.append(el('small', node.id + ' · ' + node.date), el('h3', node.title), el('span', icon + ' ' + label, 'tag exec-' + node.exec), el('p', hint, 'muted'), el('p', node.text));
  const row = (title, o, base) => {
    if (!o) return; const d = el('div', undefined, 'catalog-where'); d.append(el('b', title + ' · ' + o.label));
    if (o.where) d.append(el('code', o.where.slice(0, 260)));
    const f = fileLink(o.where, base); if (f) { const a = el('a', '打开 ' + f.path + ' ↗'); a.href = f.href; a.target = '_blank'; d.append(a); }
    if (o.audit) d.append(el('p', '重构审计：' + String(o.audit).slice(0, 200), 'muted'));
    host.append(d);
  };
  row('重构版 REACodeRefactoring', node.refactored, new URL('../../../townscaper-web/REACodeRefactoring/', import.meta.url).href);
  row('重构前 REACode（占位来源）', node.original, new URL('../../../townscaper-web/REACode/', import.meta.url).href);
  if (node.code?.length) host.append(el('p', '能力代码：' + node.code.join('、')));
  if (openSource) { const b = el('button', '在学习工坊查看这条视频 →'); b.onclick = () => openSource(node.id); host.append(b); }
}
/**
 * @param caps   本层可执行能力（meta，含 domain / params）
 * @param nodes  本层管线 [{id, enabled, params}]
 */
export function renderLanes(host, workshop, { caps = [], nodes = [], onToggle, onParam, onOpen, compact = false, exp } = {}) {
  host.replaceChildren();
  workshop.domains.forEach((d, i) => {
    const lane = el('section', undefined, 'tier-lane'), head = el('header');
    const mine = caps.filter((c) => c.domain === d.id);
    head.append(el('b', String(i + 1).padStart(2, '0') + ' / ' + d.name));
    const counts = el('span', undefined, 'lane-counts');
    if (mine.length) counts.append(el('i', '⚙ ' + mine.length, 'exec-code'));
    for (const k of ['refactored', 'partial', 'original']) if (d.counts[k]) { const s = el('i', EXEC[k][0] + ' ' + d.counts[k], 'exec-' + k); s.title = EXEC[k][1]; counts.append(s); }
    head.append(counts); lane.append(head);
    const body = el('div', undefined, 'lane-body');
    for (const cap of mine) {
      const n = nodes.find((x) => x.id === cap.id), card = el('article', undefined, 'tier-node' + (n?.enabled ? ' on' : ''));
      const top = el('label', undefined, 'tier-node-head'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!n?.enabled; cb.onchange = () => onToggle?.(cap, cb.checked);
      top.append(cb, el('strong', '⚙ ' + cap.name)); card.append(top);
      if (!compact) {
        card.append(el('p', cap.does));
        for (const [k, def] of Object.entries(cap.params || {})) {
          const lab = el('label', undefined, 'tier-param'), v = n?.params?.[k] ?? def.default;
          const inp = el('input'); if (def.type === 'bool') { inp.type = 'checkbox'; inp.checked = !!v; inp.onchange = () => onParam?.(cap, k, inp.checked); }
          else { inp.type = 'range'; inp.min = def.min; inp.max = def.max; inp.step = def.step; inp.value = v; const out = el('output', String(v)); inp.oninput = () => (out.textContent = inp.value); inp.onchange = () => onParam?.(cap, k, +inp.value); lab.append(el('span', def.label), inp, out); card.append(lab); continue; }
          lab.append(el('span', def.label), inp); card.append(lab);
        }
        const e = exp?.(cap.id); if (e?.runs) card.append(el('small', `经验：预览 ${e.runs} 次 · 通过 ${e.passed} · 写入 ${e.committed}${e.lastFailure ? ' · 上次失败：' + e.lastFailure.slice(0, 40) : ''}`, 'muted'));
      }
      body.append(card);
    }
    const chips = el('div', undefined, 'lane-chips'), LIMIT = compact ? 4 : 10;
    const add = (list) => { for (const node of list) { const c = el('button', EXEC[node.exec][0] + ' ' + node.title.slice(0, compact ? 16 : 26), 'chip exec-' + node.exec); c.title = EXEC[node.exec][1] + ' · ' + node.id + '\n' + node.title; c.onclick = () => onOpen?.(node); chips.append(c); } };
    add(d.nodes.slice(0, LIMIT));
    if (d.nodes.length > LIMIT) { const more = el('button', `+${d.nodes.length - LIMIT} 更多`, 'chip more'); more.onclick = () => { more.remove(); add(d.nodes.slice(LIMIT)); }; chips.append(more); }
    if (!d.nodes.length && !mine.length) chips.append(el('span', '学习库里还没有这一分区的方法', 'muted'));
    body.append(chips); lane.append(body); host.append(lane);
  });
}
