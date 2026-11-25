/**
 * capability-sidebar.js — 系统工坊左栏：三个工坊共用的能力库。
 *   ⚙ 可执行能力（能力代码 / 场景现有能力）：可拖进当前工坊的管线，管线里的每个节点都能执行
 *   ● ◐ ○ 学习库方法（重构版 / 部分 / 原版占位）：只在库里占位、标来源；封装成能力代码后才可拖入
 * 同一条学习方法会出现在多个工坊（方法复用，作用范围不同）；「全部工坊」可以看到它在哪几层。
 */
import { loadCatalog, scanCatalog, EXEC } from './catalog-view.js?v=code-r2';
import { listSets, removeSet } from './capability-sets.js?v=sys-r4';
import { usageFor } from './capability-usage.js?v=sys-r15';
import { buildCapabilityLineage, describeDirection } from '../../../townscaper-web/REACodeRefactoring/src/core/capability-lineage.js';

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
  // 能力库的两种看法：能力线（按作者发布时间排成 A → A+ → …，默认）/ 工坊分区（按场景层与目录）
  const VIEW_KEY = 'tm.capability.view.v1';
  let view = 'lineage'; try { if (localStorage.getItem(VIEW_KEY) === 'domain') view = 'domain'; } catch {}
  let lineageCache = null;
  host.replaceChildren();
  const head = el('div', undefined, 'section-title'); head.append(el('h2', '能力库'), el('span', '', 'cap-count'));
  const learnRoute = el('button', '需求组合与源码缺口 → 学习工坊');learnRoute.onclick=()=>window.dispatchEvent(new Event('tm.learning.roadmap'));host.append(learnRoute);
  const hint = el('p', '⚙ 可执行能力可拖入管线；◆ 已有代码来自重构库实际模块；执行适配与源码存在分开核验。', 'muted');
  const views = el('div', undefined, 'cap-scope cap-view');
  const v1 = el('button', '能力线 · 时间'), v2 = el('button', '工坊分区');
  v1.title = '按作者发布时间把能力排成 A → A+ → …：系统到了哪一代、下一步补什么'; v2.title = '按场景层 / 目录分区列出能力与源码模块';
  for (const [b, v] of [[v1, 'lineage'], [v2, 'domain']]) { b.type = 'button'; b.onclick = () => { view = v; try { localStorage.setItem(VIEW_KEY, v); } catch {} render(); }; views.append(b); }
  // 扫描能力库：把学习工坊（REACodeRefactoring）新重构的方法、新封装的能力代码同步进来
  const scanB = el('button', '⟳ 扫描能力库', 'cap-scan'); scanB.type = 'button';
  scanB.title = '扫描 REACodeRefactoring 实际模块、导出、依赖及原版迁移落点';
  const scanNote = el('p', '', 'cap-scan-note muted'); scanNote.hidden = true;
  scanB.onclick = async () => {
    scanB.disabled = true; scanB.textContent = '扫描中…'; scanNote.hidden = false; scanNote.textContent = '正在扫描重构代码与依赖…';
    try {
      const { catalog: c, codeCaps, diff } = await scanCatalog();
      catalog = c; await onScan?.(codeCaps); render();
      const up = diff.upgraded.length ? `；${diff.upgraded.length} 个升级（${diff.upgraded.filter((u) => u.to === 'code').length} 个变成 ⚙ 可执行）` : '';
      scanNote.textContent = `扫描完成（${diff.scanMode==='live-filesystem'?'实际文件':'生成快照，后端扫描接口尚未启用'}）：重构源码 ${diff.sourceModules} 个模块，执行注册入口 ${diff.code} 个${diff.codeBefore != null && diff.code !== diff.codeBefore ? `（原来 ${diff.codeBefore} 个）` : ''}；新增 ${diff.added.length} 个${up}。${!diff.added.length && !diff.upgraded.length ? '没有新变化。' : ''}`;
    } catch (e) { scanNote.textContent = '扫描失败：' + e.message; }
    scanB.disabled = false; scanB.textContent = '⟳ 扫描能力库';
  };
  head.append(scanB);
  const search = el('input'); search.placeholder = '搜索能力、源码路径、导出接口'; search.setAttribute('aria-label', '搜索能力');
  const scopes = el('div', undefined, 'cap-scope');
  const b1 = el('button', '本工坊'), b2 = el('button', '全部工坊');
  for (const [b, s] of [[b1, 'tier'], [b2, 'all']]) { b.type = 'button'; b.onclick = () => { scope = s; render(); }; scopes.append(b); }
  const list = el('div', undefined, 'cap-list');
  host.append(head, hint, scanNote, search, views, scopes, list);
  search.oninput = () => { query = search.value.trim().toLowerCase(); render(); };

  // 归属：默认按目录 / 能力代码自动划分；作者可以调配到其他工坊，或标成公用（三个工坊都列出）
  const OWN_KEY = 'tm.capability.ownership.v1';
  let own = {}; try { own = JSON.parse(localStorage.getItem(OWN_KEY) || '{}'); } catch {}
  const saveOwn = () => { try { localStorage.setItem(OWN_KEY, JSON.stringify(own)); } catch {} };
  let expanded = null;
  const groupsFor = (tier) => [...(tier === 'scene' ? sceneLayers.map((l) => [l.id, l.name]) : (catalog?.workshops.find((w) => w.id === tier)?.domains.map((d) => [d.id, d.name]) || [])), ['_moved', '调配进来的能力']];
  function originItems(tier) {
    const out = [];
    // 学习条目已经被某个 ⚙ 能力实现（能力 meta.learn 里写了它的来源 ID）：不再单列成「待完成」占位，算在那个能力名下
    const covered = new Set();
    for (const t of ['planet', 'scene', 'object']) for (const c of sources[t]?.() || []) for (const id of c.learn || []) covered.add(String(id));
    for (const c of sources[tier]?.() || []) out.push({ key: tier + ':' + c.id, tier, id: c.id, name: c.name, desc: (c.does || c.description || '') + (c.learn?.length ? `（实现学习条目 ${c.learn.join('、')}）` : ''), group: tier === 'scene' ? c.group : c.domain, exec: 'code', runnable: true, cap: c });
    const w = catalog?.workshops.find((x) => x.id === tier), seen = new Set();
    for (const d of w?.domains || []) for (const n of d.nodes) if (n.exec !== 'code' && !seen.has(n.id) && !covered.has(String(n.id))) { seen.add(n.id); out.push({ key: tier + ':' + n.id, tier, id: n.id, name: n.title, desc: n.text, group: tier === 'scene' ? SCENE_GROUP[d.id] || 'world' : d.id, exec: n.exec, runnable: false, node: n }); }
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
    c.dataset.capabilityId=item.id;
    const adapters=item.runnable?[]:['planet','scene','object'].flatMap(t=>(sources[t]?.()||[]).filter(cap=>(cap.related||[]).includes(item.id)||(item.node?.module?.adapters||[]).some(a=>a.id===cap.id&&a.tier===t)).map(cap=>({cap,tier:t})));
    c.title = item.runnable ? '拖进管线，或双击加入' : label + '：展开查看源码接口与依赖';
    const t = el('div', undefined, 'cap-item-head'); t.append(el('span', icon, 'cap-icon'), el('b', item.name), helpBadge(item));
    if (item.shared) t.append(el('small', '公用', 'cap-tier'));
    else if (showTier || item.group === '_moved') t.append(el('small', '来自' + TIER_NAME[item.tier].replace('工坊', ''), 'cap-tier'));
    c.append(t);
    if(adapters.length)c.append(el('small','已有局部执行接口 '+adapters.length+' 项 · 展开选择','muted'));
    if (expanded === item.id) {
      if (item.desc) c.append(el('p', item.desc.slice(0, 160)));
      for(const {cap,tier} of adapters){const button=el('button','加入已适配部分：'+cap.name);button.type='button';button.onclick=e=>{e.stopPropagation();onActivate?.({tier,id:cap.id,name:cap.name,into:tier});};c.append(button,el('small',cap.does||cap.description||'局部适配，来源完整迁移仍待完成','muted'));}
      if(item.node?.module){const a=el('a','查看实际源码 ↗');a.href=new URL('../../../townscaper-web/REACodeRefactoring/'+item.node.module.path,import.meta.url);a.target='_blank';a.onclick=e=>e.stopPropagation();c.append(a,el('code',item.node.module.exports.join(', ')||'入口模块'));}
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
  // ── 能力线视图：同一份作者时间线算出的代际，和学习工坊「能力成长」页是同一个模型 ─────────────
  const openLearning = (detail) => window.dispatchEvent(new CustomEvent('tm.learning.lineage', { detail }));
  function lineageModel() {
    if (!catalog?.evolution?.events) return null;
    const executables = ['planet', 'scene', 'object'].flatMap((t) => (sources[t]?.() || []).map((c) => ({ id: c.id, name: c.name, tier: t, learn: c.learn, related: c.related, clips: c.clips, modules: c.modules })));
    const key = catalog.snapshotId + '|' + executables.map((x) => x.id).join(',');
    if (lineageCache?.key !== key) { try { lineageCache = { key, model: buildCapabilityLineage(catalog.evolution, { modules: catalog.modules, alignment: catalog.alignment, executables }) }; } catch (e) { console.warn('能力线计算失败', e); lineageCache = { key, model: null }; } }
    return lineageCache.model;
  }
  function renderLineage(tier) {
    const model = lineageModel();
    if (!model) { list.append(el('p', '能力线需要作者时间线资料：点「扫描能力库」后重试，或切到「工坊分区」。', 'muted')); return; }
    const tiers = scope === 'all' ? ['planet', 'scene', 'object'] : [tier], items = new Map();
    for (const t of tiers) for (const it of itemsFor(t)) if (it.runnable && !items.has(it.id)) items.set(it.id, it);
    const short = (n) => n.split(/[：:]/)[0], byLine = new Map(model.lines.map((l) => [l.id, l])), queue = new Map(model.queue.map((q) => [q.id, q]));
    const lines = model.lines.filter((l) => l.kind === 'line').sort((a, b) => (a.from || '').localeCompare(b.from || ''));
    const note = el('p', `${lines.length} 条能力线 · 按作者发布时间排列 · 补学队列 ${model.queue.length}`, 'muted cap-lineage-note'); list.append(note);
    const all = el('button', '能力成长与闭环总览 → 学习工坊', 'cap-lineage-open'); all.type = 'button'; all.onclick = () => openLearning({}); list.append(all);
    for (const t of tiers) renderSets(t);
    let shown = 0, placed = new Set();
    for (const l of lines) {
      const mine = l.executables.map((id) => items.get(id)).filter(Boolean);
      const hay = (l.name + ' ' + l.question + ' ' + l.modules.join(' ') + ' ' + mine.map((i) => i.name + ' ' + i.id).join(' ')).toLowerCase();
      if (query && !hay.includes(query)) continue;
      const d = el('details', undefined, 'cap-line'); d.dataset.line = l.id; d.open = !!query || expandedLine === l.id;
      d.ontoggle = () => { if (d.open) expandedLine = l.id; else if (expandedLine === l.id) expandedLine = null; };
      const at = l.frontier >= 0 ? l.generations[l.frontier].label : '—', last = l.generations.at(-1)?.label || '—';
      const s = el('summary'); s.append(el('span', (l.from || '').slice(0, 4), 'cap-line-year'), el('b', short(l.name)), el('small', `${at} / ${last}${mine.length ? ' · ⚙ ' + mine.length : ''}`)); d.append(s);
      const rail = el('div', undefined, 'cap-line-rail');
      for (const g of l.generations) { const c = el('span', g.label, 'gen state-' + g.state + (g.index === l.frontier ? ' here' : '') + (l.target?.generation === g.index ? ' next' : '')); c.title = `${g.from} · ${g.projectLabel}\n${g.title}\n${({ complete: '完成 · 无缺口', building: '部分实现', learning: '已学习 · 无完成代码' })[g.state]}${g.gaps.length ? ' · 缺口 ' + g.gaps.length : ''}`; rail.append(c); }
      d.append(rail, el('p', describeDirection(l, model), 'cap-line-direction'));
      for (const it of mine) { d.append(card(it, scope === 'all')); placed.add(it.id); }
      if (!mine.length) d.append(el('small', l.executables.length ? '这条线的可执行能力在其他工坊（切到「全部工坊」查看）。' : l.frontier >= 0 ? '代码已有，尚未封装成可执行能力：还不能拖进管线。' : '还没有完成的代码。', 'muted'));
      if (l.requires.length) d.append(el('small', '前置：' + l.requires.slice(0, 4).map((r) => short(byLine.get(r.id).name)).join(' · '), 'muted'));
      if (l.target) { const q = queue.get(l.target.clip); const b = el('button', `${l.target.mode === 'advance' ? '下一步' : '回补'} ${l.target.label}${q ? ' · 队列 #' + q.rank : ''} → 学习工坊`, 'cap-line-next'); b.type = 'button'; b.title = q ? q.title + (q.gap ? '\n缺口：' + q.gap : '') : ''; b.onclick = (e) => { e.stopPropagation(); openLearning({ line: l.id }); }; d.append(b); }
      list.append(d); shown++;
    }
    const rest = [...items.values()].filter((it) => !placed.has(it.id) && !model.executables.find((x) => x.id === it.id)?.lines.length && (!query || (it.name + ' ' + it.desc + ' ' + it.id).toLowerCase().includes(query)));
    if (rest.length) { const d = el('details', undefined, 'cap-line'); d.open = !!query; const s = el('summary'); s.append(el('span', '—', 'cap-line-year'), el('b', '未关联能力线'), el('small', '⚙ ' + rest.length)); d.append(s, el('small', '这些能力能执行，但没有登记来源帖子或源码模块，暂时排不进时间线。', 'muted')); for (const it of rest) d.append(card(it, scope === 'all')); list.append(d); }
    head.querySelector('.cap-count').textContent = `可执行 ${items.size} · 能力线 ${shown}`;
  }
  // 能力集合：整组拖进管线，快速搭管线（两种视图都显示）
  function renderSets(t) {
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
  }
  let expandedLine = null;
  function render() {
    const tier = getTier();
    b1.classList.toggle('on', scope === 'tier'); b2.classList.toggle('on', scope === 'all');
    v1.classList.toggle('on', view === 'lineage'); v2.classList.toggle('on', view === 'domain');
    b1.textContent = '本工坊 · ' + (TIER_NAME[tier] || '').replace('工坊', '');
    list.replaceChildren(); list.dataset.view = view;
    if (view === 'lineage') { renderLineage(tier); return; }
    if(catalog?.combinations?.length){const section=el('details');section.open=!!query;section.append(el('summary','源码能力组合 · '+catalog.combinations.length));for(const combo of catalog.combinations){if(query&&!JSON.stringify(combo).toLowerCase().includes(query))continue;const d=el('details');d.append(el('summary',combo.name+' · '+combo.moduleOrder.length+' 模块'),el('p',combo.goal),el('small','依赖已组合；场景与Worker执行适配需逐项验证。','muted'));for(const p of combo.moduleOrder){const a=el('a',p);a.href=new URL('../../../townscaper-web/REACodeRefactoring/'+p,import.meta.url);a.target='_blank';const row=el('div');row.append(a);d.append(row);}section.append(d);}list.append(section);}
    const tiers = scope === 'all' ? ['planet', 'scene', 'object'] : [tier];
    let shown = 0, runnable = 0;
    for (const t of tiers) {
      const items = itemsFor(t).filter((i) => !query || (i.name + ' ' + i.desc + ' ' + i.id).toLowerCase().includes(query));
      if (scope === 'all') list.append(el('h3', TIER_NAME[t], 'cap-tier-title'));
      renderSets(t);
      for (const [gid, gname] of groupsFor(t)) {
        const rows = items.filter((i) => i.group === gid).sort((a, b) => b.runnable - a.runnable);
        if (!rows.length) continue;
        const d = el('details'); d.open = rows.some((r) => r.runnable) || !!query;
        const s = el('summary'); s.append(el('span', gname), el('small', `⚙ ${rows.filter((r) => r.runnable).length} · 代码 ${rows.filter((r) => !r.runnable).length}`));
        const runnableRows = rows.filter((r) => r.runnable);
        { s.draggable = runnableRows.length>0; s.title = `把「${gname}」分区整组拖进管线：${runnableRows.length} 个 ⚙ 能力可执行${rows.length > runnableRows.length ? `，${rows.length - runnableRows.length} 个源码模块独立查看` : ''}`;
          s.ondragstart = (e) => { window.__tmDrag = { tier: t, name: gname, set: runnableRows.map((r) => ({ id: r.id, name: r.name, domain: r.cap?.domain || r.node?.domain || r.group })) }; e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(window.__tmDrag)); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('cap-dragging'); hideUsage(); };
          s.ondragend = () => { document.body.classList.remove('cap-dragging'); window.__tmDrag = null; }; }
        d.append(s); for (const r of rows.slice(0, query ? 60 : 40)) d.append(card(r, scope === 'all'));
        list.append(d); shown += rows.length; runnable += rows.filter((r) => r.runnable).length;
      }
    }
    head.querySelector('.cap-count').textContent = `可执行 ${runnable} · 已有代码 ${shown-runnable}`;
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
