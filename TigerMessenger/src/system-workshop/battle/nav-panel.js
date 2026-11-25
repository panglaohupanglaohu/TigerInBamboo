/**
 * 战役面板侧栏 · 导航块（R33–R36）。浏览器专用（DOM）。
 *   ① 原版当裁判（创新 1）：在页面里现算 nav-parity（原版 cheesenav / holenav 对 vendor layerednav / BattleNavigation），
 *      表格列出连通块数 / 最大块占比 / 被覆盖节点数，并标出 catalog/parity/navigation.json 有没有登记。
 *   ② 导航能力：扫描后列出三个导航能力在这个舞台上能不能作用（match 的理由）。
 *   ③ 实况：battle.state 里的 navigation（精细门户开没开、洞里多少人、穿墙 / 悬空埋地）。
 */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const PARITY_URL = new URL('../../scene-authoring/catalog/parity/navigation.json', import.meta.url);
const NAV_IDS = ['battle.navFinePortals', 'battle.navTraffic', 'battle.navFooting'];

export function mountNavPanel(root, { caps = [] } = {}) {
  const box = el('section', undefined, 'nav-panel'); box.dataset.state = 'loading';
  const parity = el('div', undefined, 'nav-parity'); parity.dataset.state = 'loading';
  parity.append(el('h4', '导航 · 原版当裁判'), el('p', '正在现算：原版 cheesenav / holenav 对重构版 layerednav（同一座岛）…', 'muted'));
  const capsBox = el('div', undefined, 'nav-caps'); capsBox.append(el('h4', '导航能力'), el('p', '扫描后显示三个导航能力在这个舞台上能不能作用。', 'muted'));
  const live = el('p', '', 'muted nav-live');
  box.append(parity, capsBox, live); root.append(box);

  (async () => {
    try {
      const t0 = performance.now();
      const m = await import('./nav-parity.js?v=nav-r1');
      const doc = m.runNavParity();
      let registered = null;
      try { const r = await fetch(PARITY_URL, { cache: 'no-store' }); if (r.ok) registered = await r.json(); } catch {}
      renderParity(parity, doc, registered, Math.round(performance.now() - t0));
      parity.dataset.state = 'ready'; box.dataset.state = 'ready';
      globalThis.__tmNavParity = { doc, registered: registered ? { verdict: registered.verdict, generatedAt: registered.generatedAt, gaps: registered.gaps, sameAsLive: sameNumbers(doc, registered) } : null };
    } catch (e) {
      parity.dataset.state = 'error'; parity.replaceChildren(el('h4', '导航 · 原版当裁判'), el('p', '现算失败：' + (e?.message || e), 'muted'));
      globalThis.__tmNavParity = { error: String(e?.message || e) };
    }
  })();

  return {
    onScan(s) {
      const rows = NAV_IDS.map((id) => ({ id, cap: caps.find((c) => c.id === id), m: s?.matches?.find((x) => x.id === id) }));
      const ul = el('ul', undefined, 'nav-cap-list');
      for (const r of rows) {
        const li = el('li'); li.dataset.capabilityId = r.id; li.dataset.count = String(r.m?.count || 0);
        li.append(el('b', (r.m?.count ? '✓ ' : '· ') + (r.cap?.name || r.id)), el('small', r.m?.error ? '扫描出错：' + r.m.error : r.m?.count ? r.m.targets?.[0]?.reason || '' : '这个舞台上没有可作用对象'));
        ul.append(li);
      }
      capsBox.replaceChildren(el('h4', '导航能力'), ul);
    },
    onState(st) {
      const n = st?.navigation; if (!n) { live.textContent = ''; return; }
      live.textContent = `导航实况：精细门户${n.finePortals ? '开' : '关'} · 拱洞挖空 ${n.arches}/${n.archCandidates} 列 · 洞里 ${n.unitsUnderCover} 人 · 卡墙 ${n.wallClips} · 大个子 ${n.heavy}` +
        (n.footing ? ` · 悬空 ${n.footing.floating} / 埋地 ${n.footing.buried}` : '') + (n.drawn?.checked ? ` · 洞底画面脚高偏差 ${n.drawn.off}/${n.drawn.checked}` : '');
    },
  };
}

function sameNumbers(doc, reg) {
  try { return JSON.stringify(doc.cases.map((c) => [c.original, c.sameCriteria, c.battleCriteria, c.routes ?? null])) === JSON.stringify(reg.cases.map((c) => [c.original, c.sameCriteria, c.battleCriteria, c.routes ?? null])); } catch { return false; }
}
function renderParity(box, doc, reg, ms) {
  const fmt = (v, m) => (m === 'largestShare' && typeof v === 'number' ? (v * 100).toFixed(1) + '%' : String(v));
  const table = el('table', undefined, 'nav-parity-table');
  const head = el('tr'); for (const h of ['岛', '指标', '原版', '重构·同判据', '重构·战役判据']) head.append(el('th', h)); table.append(head);
  for (const c of doc.cases) for (const m of [{ id: 'components', name: '连通块数' }, { id: 'largestShare', name: '最大块占比' }, { id: 'covered', name: '被覆盖节点数' }]) {
    const tr = el('tr'); tr.dataset.case = c.id; tr.dataset.metric = m.id;
    const o = c.original[m.id], s = c.sameCriteria[m.id], b = c.battleCriteria[m.id];
    tr.append(el('td', c.id === 'cheese' ? '奶酪' : '门洞'), el('td', m.name), el('td', fmt(o, m.id)), el('td', fmt(s, m.id), s === o ? 'eq' : 'ne'), el('td', fmt(b, m.id), b === o ? 'eq' : 'ne'));
    table.append(tr);
  }
  const routes = doc.cases.find((c) => c.routes)?.routes;
  const gaps = doc.diffs.filter((d) => d.kind === 'gap'), design = doc.diffs.filter((d) => d.kind === 'design');
  const verdict = el('p', `同判据${doc.sameCriteriaEqual ? '一致（这两座岛上行为等价）' : '不一致（要查）'} · 缺口 ${gaps.length} 条 · 口径差异 ${design.length} 处 · 现算 ${ms} ms`, 'nav-parity-verdict');
  verdict.dataset.sameEqual = doc.sameCriteriaEqual ? '1' : '0'; verdict.dataset.gaps = String(gaps.length);
  const list = el('ul', undefined, 'nav-parity-gaps');
  for (const g of gaps) { const li = el('li'); li.dataset.diff = g.id; li.append(el('b', g.id), el('small', g.note)); list.append(li); }
  const regLine = el('p', reg ? `已登记：catalog/parity/navigation.json（${reg.generatedAt || '无时间'}，${reg.verdict}${sameNumbers(doc, reg) ? '，与现算一致' : '，与现算不一致：重跑脚本'}）` : '未登记：在 TigerMessenger 目录跑 $NODE tools/refactor/nav-parity.mjs 写入 catalog/parity/，④ 级才会出现', 'muted nav-parity-reg');
  regLine.dataset.registered = reg ? '1' : '0';
  box.replaceChildren(el('h4', '导航 · 原版当裁判'), el('p', '同一座岛：原版 cheesenav / holenav 对重构版 layerednav / BattleNavigation（游戏实际用的 vendor 副本）。', 'muted'), table,
    ...(routes ? [el('p', `门洞路线代价：${routes.differ}/${routes.reachableBoth} 对不同（重构 / 原版 均值 ×${routes.meanRatio}）`, 'muted')] : []), verdict, list, regLine);
}
