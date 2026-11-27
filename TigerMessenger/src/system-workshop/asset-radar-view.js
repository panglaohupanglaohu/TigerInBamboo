// 智能体资产雷达：资产表 × REACode 发现 → 快速契约重构蓝图（数据：catalog/asset-capability-radar.json）
const SYS = {all:['全部','#0f8b95'],planet:['球系统','#2f8fd8'],scene:['场景系统','#16a34a'],object:['物件系统','#d97706'],multi:['跨系统','#9333ea']};
const NS = 'http://www.w3.org/2000/svg';
const el = (t, txt, c) => { const n = document.createElement(t); if (txt !== undefined) n.textContent = txt; if (c) n.className = c; return n; };
const sv = (t, a = {}) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

export async function loadRadar(url) {
  const r = await fetch(url, {cache: 'no-store'});
  if (!r.ok) throw Error('雷达数据 HTTP ' + r.status);
  return r.json();
}

export function radarChart(matrix, size = 300) {
  const c = size / 2, R = c - 46, n = matrix.length, svg = sv('svg', {viewBox: `0 0 ${size} ${size}`, class: 'ar-chart', role: 'img', 'aria-label': '资产覆盖雷达'});
  const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  for (const f of [.25, .5, .75, 1]) svg.append(sv('polygon', {points: matrix.map((_, i) => pt(i, f).join(',')).join(' '), class: 'ar-ring'}));
  const maxGap = Math.max(1, ...matrix.map(m => m.gapScore || 0));
  const poly = (key, cls) => svg.append(sv('polygon', {points: matrix.map((m, i) => pt(i, Math.max(.06, key(m))).join(',')).join(' '), class: cls}));
  poly(m => (m.coveragePct || 0) / 100, 'ar-cov');
  poly(m => (m.gapScore || 0) / maxGap, 'ar-gap');
  matrix.forEach((m, i) => {
    const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2);
    svg.append(sv('line', {x1: c, y1: c, x2: x, y2: y, class: 'ar-axis'}));
    const dot = sv('circle', {cx: pt(i, (m.gapScore || 0) / maxGap)[0], cy: pt(i, (m.gapScore || 0) / maxGap)[1], r: 4, class: 'ar-dot'});
    const tip = sv('title'); tip.textContent = `${m.category}：资产 ${m.assetCount} · 覆盖 ${m.coveragePct}% · 缺口分 ${m.gapScore} · 策略 ${m.strategy}`; dot.append(tip); svg.append(dot);
    const t = sv('text', {x: lx, y: ly, class: 'ar-label', 'text-anchor': Math.abs(lx - c) < 8 ? 'middle' : lx > c ? 'start' : 'end'}); t.textContent = m.category; svg.append(t);
  });
  return svg;
}

const STRAT = {'refactor-reacode': '从 REACode 快速重构', 'wrap-existing-refactored': '封装已有重构库', 'synthesize-new': '智能体新合成'};

function card(d, {onTree, onWorkshop}) {
  const [name, color] = SYS[d.targetSystem] || SYS.multi, c = el('article', undefined, 'ar-card');
  c.style.setProperty('--sys', color); c.dataset.system = d.targetSystem;
  const head = el('header');
  head.append(el('span', name, 'ar-sys'), el('code', d.source), el('b', d.priorityScore.toFixed(1), 'ar-score'));
  if (d.jev) head.append(el('span', 'JEV ✓', 'ar-jev'));
  const bar = el('div', undefined, 'ar-bar'); bar.style.setProperty('--p', Math.min(100, d.priorityScore / 45 * 100) + '%');
  const meta = el('p', `惠及资产 ${d.benefitingAssets} · 未对齐导出 ${d.unmatchedCount} · 工作量 ${d.blueprint?.effortLabel || '?'}`, 'ar-meta');
  c.append(head, bar, meta);
  if (d.rawRisks?.length) { const r = el('ul', undefined, 'ar-risks'); for (const x of d.rawRisks) r.append(el('li', '⚠ ' + x)); c.append(r); }
  const bp = d.blueprint; if (bp) {
    const steps = el('ol', undefined, 'ar-steps');
    for (const s of bp.steps) { const li = el('li', s.replace(/^\d+\.\s*/, '')); li.onclick = () => { li.classList.toggle('done'); }; steps.append(li); }
    const det = el('details', undefined, 'ar-bp'); det.append(el('summary', '⚡ 四步快速重构蓝图 → ' + bp.targetModule), steps);
    if (bp.exportsToPort?.length) { const ex = el('div', undefined, 'ar-exports'); for (const e of bp.exportsToPort) ex.append(el('code', e)); det.append(ex); }
    c.append(det);
  }
  const act = el('div', undefined, 'ar-actions'), cp = el('button', '⧉ 复制智能体指令', 'primary');
  cp.onclick = async () => { try { await navigator.clipboard.writeText(bp?.agentPrompt || d.source); cp.textContent = '✓ 已复制'; } catch { cp.textContent = '复制失败'; } setTimeout(() => cp.textContent = '⧉ 复制智能体指令', 1600); };
  const tree = el('button', '在能力树定位'); tree.onclick = () => onTree?.(d);
  const ws = el('button', '去 ' + name + ' 工坊 →'); ws.onclick = () => onWorkshop?.(d);
  act.append(cp, tree, ws); c.append(act);
  return c;
}

export function renderAssetRadar(host, data, opts = {}) {
  host.replaceChildren();
  const wrap = el('section', undefined, 'asset-radar'), s = data.summary || {};
  const hero = el('div', undefined, 'ar-hero'), left = el('div', undefined, 'ar-intro');
  left.append(el('small', '✦ 智能体资产雷达 · AGENT ASSET RADAR'), el('h2', data.rubric?.name || '资产驱动能力研判'), el('code', data.rubric?.formula || '', 'ar-formula'));
  const kpis = el('div', undefined, 'ar-kpis');
  for (const [v, l] of [[s.totalAssets, '游戏资产'], [s.reacodeCandidatesScanned, 'REACode 候选扫描'], [s.recommendedDiscoveries, '推荐引入'], [s.jevDiscoveryAccepted, 'JEV 认可'], ['$' + (s.jevCostUsd ?? 0).toFixed(4), 'JEV 成本']]) { const k = el('div', undefined, 'ar-kpi'); k.append(el('b', String(v ?? '–')), el('span', l)); kpis.append(k); }
  const pr = el('ul', undefined, 'ar-principles'); for (const p of data.rubric?.principles || []) pr.append(el('li', p));
  left.append(kpis, pr);
  const chartBox = el('div', undefined, 'ar-chartbox'); chartBox.append(radarChart(data.assetMatrix || []));
  const legend = el('p', undefined, 'ar-legend'); legend.innerHTML = '<i class="cov"></i>能力覆盖率 <i class="gap"></i>资产缺口分（越外越该补）'; chartBox.append(legend);
  hero.append(left, chartBox);
  const matrix = el('div', undefined, 'ar-matrix');
  for (const m of data.assetMatrix || []) { const t = el('div', undefined, 'ar-cell'); t.append(el('b', m.category), el('span', `${m.assetCount} 资产 · 覆盖 ${m.coveragePct}%`), el('em', STRAT[m.strategy] || m.strategy)); t.style.setProperty('--g', Math.min(1, (m.gapScore || 0) / 18)); matrix.append(t); }
  let sys = opts.system || 'all', q = '';
  const bar = el('div', undefined, 'ar-filter'), list = el('div', undefined, 'ar-list'), search = el('input'); search.type = 'search'; search.placeholder = '筛选源码 / 导出名';
  const counts = {all: (data.discoveries || []).length}; for (const d of data.discoveries || []) counts[d.targetSystem] = (counts[d.targetSystem] || 0) + 1;
  const chips = Object.entries(SYS).map(([k, [n, col]]) => { const b = el('button', `${n} ${counts[k] || 0}`, 'ar-chip'); b.style.setProperty('--sys', col); b.onclick = () => { sys = k; draw(); }; bar.append(b); return [k, b]; });
  bar.append(search); search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
  function draw() {
    for (const [k, b] of chips) b.classList.toggle('on', k === sys);
    const rows = (data.discoveries || []).filter(d => (sys === 'all' || d.targetSystem === sys) && (!q || JSON.stringify([d.source, d.unmatchedExports]).toLowerCase().includes(q))).sort((a, b) => b.priorityScore - a.priorityScore);
    list.replaceChildren(...rows.map((d, i) => { const c = card(d, opts); c.style.animationDelay = Math.min(i, 12) * 30 + 'ms'; return c; }));
    if (!rows.length) list.append(el('p', '没有匹配的发现。', 'muted'));
  }
  draw();
  wrap.append(hero, el('h3', '资产类别覆盖矩阵'), matrix, el('h3', 'REACode 新能力发现 · 按优先级'), bar, list);
  host.append(wrap);
}
