/**
 * capability-sidebar.js — 系统工坊左栏：三个工坊共用的能力库。
 *   ⚙ 可执行能力（能力代码 / 场景现有能力）：可拖进当前工坊的管线，管线里的每个节点都能执行
 *   ● ◐ ○ 学习库方法（重构版 / 部分 / 原版占位）：只在库里占位、标来源；封装成能力代码后才可拖入
 * 同一条学习方法会出现在多个工坊（方法复用，作用范围不同）；「全部工坊」可以看到它在哪几层。
 */
import { loadCatalog, scanCatalog, EXEC } from './catalog-view.js?v=sys-r11';
import { listSets, removeSet } from './capability-sets.js?v=sys-r4';
import { usageFor } from './capability-usage.js?v=sys-r11';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
export const DRAG_TYPE = 'application/x-tm-capability';
// 「?」怎么用：鼠标移到标签上弹出说明（浮在页面最上层，不被侧栏裁掉）
let tip = null;
function showUsage(anchor, item) {
  const u = usageFor(item);
  tip ||= Object.assign(document.createElement('div'), { className: 'cap-usage-tip', role: 'tooltip' });
  if (!tip.isConnected) document.body.append(tip);
  tip.replaceChildren();
  const add = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; tip.append(n); return n; };
  add('b', '怎么用 · ' + item.name);
  add('p', u.what);
  if (u.when) add('p', '什么时候用：' + u.when, 'muted');
  const ol = document.createElement('ol'); for (const st of u.steps || []) { const li = document.createElement('li'); li.textContent = st; ol.append(li); } tip.append(ol);
  if (u.example) { const ex = add('div', '', 'cap-usage-ex'); for (const [k, v] of [['改造方向', u.example.goal], ['参数', u.example.params], ['会看到', u.example.result]]) if (v) { const row = document.createElement('p'); const b = document.createElement('b'); b.textContent = k + '：'; row.append(b, v); ex.append(row); } }
  tip.hidden = false;
  const r = anchor.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
  tip.style.width = w + 'px';
  tip.style.left = Math.min(innerWidth - w - 12, r.right + 10) + 'px';
  const h = tip.offsetHeight; tip.style.top = Math.max(12, Math.min(innerHeight - h - 12, r.top - 20)) + 'px';
}
const hideUsage = () => { if (tip) tip.hidden = true; };
function helpBadge(item) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cap-help'; b.textContent = '?'; b.setAttribute('aria-label', '怎么用：' + item.name);
  b.onmouseenter = b.onfocus = () => showUsage(b, item); b.onmouseleave = b.onblur = hideUsage;
  b.onclick = (e) => { e.stopPropagation(); showUsage(b, item); };
  b.draggable = false; b.onmousedown = (e) => e.stopPropagation();
  return b;
}
const TIER_NAME = { planet: '球系统工坊', scene: '场景工坊', object: '物件工坊' };
const SCENE_GROUP = { style: 'world', terrain: 'terrain', water: 'water', atmosphere: 'light', building: 'building', vehicle: 'vehicles', activity: 'effects', camera: 'world' };

/**
 * @param sources  { planet: () => [{id,name,does,domain}], object: …, scene: () => [{id,name,does,group}] }
 * @param groups   { planet/object: [[id,name]] 来自目录，scene: LAYERS }
 */
export function mountCapabilitySidebar(host, { sources, sceneLayers, getTier, onOpen, onActivate, onScan }) {
  let catalog = null, scope = 'tier', query = '';
  host.replaceChildren();
  const head = el('div', undefined, 'section-title'); head.append(el('h2', '能力库'), el('span', '', 'cap-count'));
  const hint = el('p', '把 ⚙ 能力拖进中间的管线；三个工坊共用这一栏。', 'muted');
  // 扫描能力库：把学习工坊（REACodeRefactoring）新重构的方法、新封装的能力代码同步进来
  const scanB = el('button', '⟳ 扫描能力库', 'cap-scan'); scanB.type = 'button';
  scanB.title = '重新读取学习工坊的数据（REACode / REACodeRefactoring 的学习记录、重构状态、能力代码注册表），把新重构的能力同步进能力库';
  const scanNote = el('p', '', 'cap-scan-note muted'); scanNote.hidden = true;
  scanB.onclick = async () => {
    scanB.disabled = true; scanB.textContent = '扫描中…'; scanNote.hidden = false; scanNote.textContent = '正在读取学习工坊的数据…';
    try {
      const { catalog: c, codeCaps, diff } = await scanCatalog();
      catalog = c; await onScan?.(codeCaps); render();
      const up = diff.upgraded.length ? `；${diff.upgraded.length} 个升级（${diff.upgraded.filter((u) => u.to === 'code').length} 个变成 ⚙ 可执行）` : '';
      scanNote.textContent = `扫描完成：学习库 ${diff.total} 个方法，能力代码 ${diff.code} 个${diff.codeBefore != null && diff.code !== diff.codeBefore ? `（原来 ${diff.codeBefore} 个）` : ''}；新增 ${diff.added.length} 个${up}。${!diff.added.length && !diff.upgraded.length ? '没有新变化。' : ''}`;
    } catch (e) { scanNote.textContent = '扫描失败：' + e.message; }
    scanB.disabled = false; scanB.textContent = '⟳ 扫描能力库';
  };
  head.append(scanB);
  const search = el('input'); search.placeholder = '搜索能力、来源视频 ID'; search.setAttribute('aria-label', '搜索能力');
  const scopes = el('div', undefined, 'cap-scope');
  const b1 = el('button', '本工坊'), b2 = el('button', '全部工坊');
  for (const [b, s] of [[b1, 'tier'], [b2, 'all']]) { b.type = 'button'; b.onclick = () => { scope = s; render(); }; scopes.append(b); }
  const list = el('div', undefined, 'cap-list');
  host.append(head, hint, scanNote, search, scopes, list);
  search.oninput = () => { query = search.value.trim().toLowerCase(); render(); };

  // 归属：默认按目录 / 能力代码自动划分；作者可以调配到其他工坊，或标成公用（三个工坊都列出）
  const OWN_KEY = 'tm.capability.ownership.v1';
  let own = {}; try { own = JSON.parse(localStorage.getItem(OWN_KEY) || '{}'); } catch {}
  const saveOwn = () => { try { localStorage.setItem(OWN_KEY, JSON.stringify(own)); } catch {} };
  let expanded = null;
  const groupsFor = (tier) => [...(tier === 'scene' ? sceneLayers.map((l) => [l.id, l.name]) : (catalog?.workshops.find((w) => w.id === tier)?.domains.map((d) => [d.id, d.name]) || [])), ['_moved', '调配进来的能力']];
  function originItems(tier) {
    const out = [];
    for (const c of sources[tier]?.() || []) out.push({ key: tier + ':' + c.id, tier, id: c.id, name: c.name, desc: c.does || c.description || '', group: tier === 'scene' ? c.group : c.domain, exec: 'code', runnable: true, cap: c });
    const w = catalog?.workshops.find((x) => x.id === tier), seen = new Set();
    for (const d of w?.domains || []) for (const n of d.nodes) if (n.exec !== 'code' && !seen.has(n.id)) { seen.add(n.id); out.push({ key: tier + ':' + n.id, tier, id: n.id, name: n.title, desc: n.text, group: tier === 'scene' ? SCENE_GROUP[d.id] || 'world' : d.id, exec: n.exec, runnable: false, node: n }); }
    return out;
  }
  const ownersOf = (id, origins) => { const o = own[id]; return o === 'shared' ? ['planet', 'scene', 'object'] : Array.isArray(o) && o.length ? o : origins; };
  // 集合里的能力补上名字与分区，未做好的能力进管线时也能放到对应泳道
  function infoOf(id) { for (const t of ['planet', 'scene', 'object']) { const it = originItems(t).find((x) => x.id === id); if (it) return { name: it.name, domain: it.cap?.domain || it.node?.domain || it.group }; } return {}; }
  const withInfo = (items) => items.map((it) => ({ ...infoOf(it.id), ...it }));
  function itemsFor(tier) {
    const all = new Map();
    for (const t of ['planet', 'scene', 'object']) for (const it of originItems(t)) { if (!all.has(it.id)) all.set(it.id, { byTier: {}, origins: [] }); const r = all.get(it.id); r.byTier[t] = it; r.origins.push(t); }
    const out = [];
    for (const [id, r] of all) {
      const owners = ownersOf(id, r.origins); if (!owners.includes(tier)) continue;
      const base = r.byTier[tier] || Object.values(r.byTier)[0];
      out.push({ ...base, tier: r.byTier[tier] ? tier : base.tier, viewTier: tier, group: r.byTier[tier] ? base.group : '_moved', owners, origins: r.origins, shared: own[id] === 'shared', overridden: own[id] !== undefined });
    }
    return out;
  }
  function card(item, showTier) {
    const [icon, label] = EXEC[item.exec];
    const c = el('article', undefined, 'cap-item exec-' + item.exec + (item.runnable ? ' runnable' : '') + (expanded === item.id ? ' open' : ''));
    c.title = item.runnable ? '拖进管线，或双击加入' : label + '：重构并封装成能力代码后才能进入管线';
    const t = el('div', undefined, 'cap-item-head'); t.append(el('span', icon, 'cap-icon'), el('b', item.name), helpBadge(item));
    if (item.shared) t.append(el('small', '公用', 'cap-tier'));
    else if (showTier || item.group === '_moved') t.append(el('small', '来自' + TIER_NAME[item.tier].replace('工坊', ''), 'cap-tier'));
    c.append(t);
    if (expanded === item.id) {
      if (item.desc) c.append(el('p', item.desc.slice(0, 160)));
      if (!item.runnable) c.append(el('small', label + (item.node?.original?.where ? ' · 原版 ' + item.node.original.where.slice(0, 60) : ''), 'muted'));
      const row = el('div', undefined, 'cap-owners'); row.append(el('span', '归属'));
      const setOwn = (v) => { if (v === undefined) delete own[item.id]; else own[item.id] = v; saveOwn(); render(); };
      for (const t2 of ['planet', 'scene', 'object']) {
        const on = item.owners.includes(t2) && !item.shared, b = el('button', TIER_NAME[t2].replace('工坊', '') + (on ? ' ✓' : ''), on ? 'on' : '');
        b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); const cur = new Set(item.shared ? [] : item.owners); cur.has(t2) ? cur.delete(t2) : cur.add(t2); setOwn(cur.size ? [...cur] : undefined); };
        row.append(b);
      }
      const sh = el('button', '公用' + (item.shared ? ' ✓' : ''), 'shared' + (item.shared ? ' on' : '')); sh.type = 'button';
      sh.onclick = (e) => { e.stopPropagation(); setOwn(item.shared ? undefined : 'shared'); }; row.append(sh);
      c.append(row, el('small', (item.overridden ? '作者调配 · ' : '') + '原划分：' + item.origins.map((x) => TIER_NAME[x].replace('工坊', '')).join('、') + '（自动）', 'muted'));
      if (item.overridden) { const r = el('button', '恢复自动划分', 'link'); r.type = 'button'; r.onclick = (e) => { e.stopPropagation(); setOwn(undefined); }; c.append(r); }
    }
    if (item.runnable) {
      c.draggable = true;
      c.ondragstart = (e) => { window.__tmDrag = { tier: item.tier, id: item.id, name: item.name }; e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(window.__tmDrag)); e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('cap-dragging'); hideUsage(); };
      c.ondragend = () => { document.body.classList.remove('cap-dragging'); window.__tmDrag = null; };
      c.ondblclick = () => onActivate?.({ tier: item.tier, id: item.id, name: item.name, into: getTier() });
    }
    c.onclick = () => { expanded = expanded === item.id ? null : item.id; render(); onOpen?.(item); };
    return c;
  }
  function render() {
    const tier = getTier();
    b1.classList.toggle('on', scope === 'tier'); b2.classList.toggle('on', scope === 'all');
    b1.textContent = '本工坊 · ' + (TIER_NAME[tier] || '').replace('工坊', '');
    list.replaceChildren();
    const tiers = scope === 'all' ? ['planet', 'scene', 'object'] : [tier];
    let shown = 0, runnable = 0;
    for (const t of tiers) {
      const items = itemsFor(t).filter((i) => !query || (i.name + ' ' + i.desc + ' ' + i.id).toLowerCase().includes(query));
      if (scope === 'all') list.append(el('h3', TIER_NAME[t], 'cap-tier-title'));
      // 能力集合：整组拖进管线，快速搭管线
      const sets = listSets(t).filter((x) => !query || (x.name + ' ' + x.desc).toLowerCase().includes(query));
      if (sets.length) {
        const d = el('details', undefined, 'cap-sets'); d.open = true;
        const sm = el('summary'); sm.append(el('span', '能力集合'), el('small', '整组拖入管线')); d.append(sm);
        for (const set of sets) {
          const c = el('article', undefined, 'cap-item cap-set runnable');
          const h = el('div', undefined, 'cap-item-head'); h.append(el('span', '▣', 'cap-icon'), el('b', set.name), el('small', set.items.length + ' 个', 'cap-tier'), helpBadge({ id: set.id, name: set.name, desc: set.desc, set: set.items }));
          c.append(h, el('p', set.desc || ''));
          if (!set.preset) { const x = el('button', '删除', 'link'); x.type = 'button'; x.onclick = (e) => { e.stopPropagation(); removeSet(t, set.id); }; c.append(x); }
          c.draggable = true; c.title = '整组拖进管线，或双击加入';
          c.ondragstart = (e) => { window.__tmDrag = { tier: t, name: set.name, set: withInfo(set.items) }; e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(window.__tmDrag)); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('cap-dragging'); hideUsage(); };
          c.ondragend = () => { document.body.classList.remove('cap-dragging'); window.__tmDrag = null; };
          c.ondblclick = () => onActivate?.({ tier: t, name: set.name, set: withInfo(set.items), into: getTier() });
          d.append(c);
        }
        list.append(d);
      }
      for (const [gid, gname] of groupsFor(t)) {
        const rows = items.filter((i) => i.group === gid).sort((a, b) => b.runnable - a.runnable);
        if (!rows.length) continue;
        const d = el('details'); d.open = rows.some((r) => r.runnable) || !!query;
        const s = el('summary'); s.append(el('span', gname), el('small', `⚙ ${rows.filter((r) => r.runnable).length} · 占位 ${rows.filter((r) => !r.runnable).length}`));
        const runnableRows = rows.filter((r) => r.runnable);
        { s.draggable = true; s.title = `把「${gname}」分区整组拖进管线：${runnableRows.length} 个 ⚙ 能力可执行${rows.length > runnableRows.length ? `，${rows.length - runnableRows.length} 个还没做好（进管线标为待完成，执行时跳过）` : ''}`;
          s.ondragstart = (e) => { window.__tmDrag = { tier: t, name: gname, set: rows.map((r) => ({ id: r.id, name: r.name, domain: r.cap?.domain || r.node?.domain || r.group })) }; e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(window.__tmDrag)); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('cap-dragging'); hideUsage(); };
          s.ondragend = () => { document.body.classList.remove('cap-dragging'); window.__tmDrag = null; }; }
        d.append(s); for (const r of rows.slice(0, query ? 60 : 40)) d.append(card(r, scope === 'all'));
        list.append(d); shown += rows.length; runnable += rows.filter((r) => r.runnable).length;
      }
    }
    head.querySelector('.cap-count').textContent = `⚙ ${runnable} / ${shown}`;
  }
  window.addEventListener('tm-capability-sets-changed', () => render());
  loadCatalog().then((c) => { catalog = c; render(); }).catch(() => render());
  render();
  return { render };
}
/** 管线落点：只接受本层可执行能力 */
export function makeDropZone(zone, { tier, accept, acceptPending, canAccept = (d) => d.tier === tier, onReject, onSet, laneCheck }) {
  // acceptPending(item)：集合里还没做好的能力也整体进管线（标为待完成，执行时跳过）；没提供时照旧跳过
  // laneCheck(e, drag) → { ok, note }：鼠标所在泳道能不能接这个能力；不能接就不显示「+」，并说明原因
  let lastNote = '';
  const clearLane = () => zone.querySelectorAll('.drop-no,.drop-yes').forEach((x) => x.classList.remove('drop-no', 'drop-yes'));
  zone.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    const res = laneCheck && window.__tmDrag ? laneCheck(e, window.__tmDrag) : { ok: true };
    clearLane(); res.lane?.classList.add(res.ok ? 'drop-yes' : 'drop-no');
    if (res.note && res.note !== lastNote) { lastNote = res.note; onReject?.(res.note); }
    if (!res.ok) { e.dataTransfer.dropEffect = 'none'; zone.classList.remove('drop-over'); return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drop-over');
  });
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) { zone.classList.remove('drop-over'); clearLane(); lastNote = ''; } });
  zone.addEventListener('drop', () => { clearLane(); lastNote = ''; });
  zone.addEventListener('drop', (e) => {
    zone.classList.remove('drop-over'); document.body.classList.remove('cap-dragging'); window.__tmDrag = null;
    let d; try { d = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)); } catch { return; }
    e.preventDefault();
    if (Array.isArray(d.set)) {
      const ok = [], skip = [];
      for (const it of d.set) (canAccept({ tier: d.tier, id: it.id }) ? ok : skip).push(it);
      for (const it of ok) accept(it.id, it.params || {});
      const pending = acceptPending ? skip.filter((it) => acceptPending(it) !== false) : [];
      onSet?.({ name: d.name, added: ok.length, pending: pending.map((x) => x.name || x.id), skipped: skip.filter((x) => !pending.includes(x)).map((x) => x.name || x.id) });
      return;
    }
    if (!canAccept(d)) { onReject?.(`「${d.name || d.id}」是${TIER_NAME[d.tier]}的能力代码，${TIER_NAME[tier]}这一层还没有它的执行适配，暂不能放进这条管线（管线里只放能执行的节点）。`); return; }
    accept(d.id);
  });
}
