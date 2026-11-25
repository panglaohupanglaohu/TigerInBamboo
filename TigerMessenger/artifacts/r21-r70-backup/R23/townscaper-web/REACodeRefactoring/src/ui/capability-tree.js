/**
 * capability-tree.js（界面）— 能力树：REACode（广度）与 REACodeRefactoring（深度）合成一棵树。
 * 一屏三块：目标路径（一个游戏目标用到哪些能力、来自两库哪里）· 树（枝 → 能力线，双条 = 原版文件 | 重构模块）· 下一步（嫁接队列 / 解锁前沿）。
 * 只显示 core/capability-tree.js 的计算结果。
 */
import { buildCapabilityLineage, LEVELS } from '../core/capability-lineage.js';
import { buildCapabilityTree } from '../core/capability-tree.js';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const STATE = { wild: '只在原版', partial: '接口没带全', grafted: '已有重构落点', verified: '已验证交付' };

export function renderCapabilityTree(host, { evolution, modules = [], executables = [], experience = {}, demand = [], alignment = [], consumers = [], jev = null, line: initial = null, onUse = null, onUseGoal = null, onOpenLine = null, onState = null } = {}) {
  const lineage = buildCapabilityLineage(evolution, { modules, executables, experience, demand, alignment, consumers }), tree = buildCapabilityTree(lineage, { alignment, executables, jev }), S = tree.summary;
  if (!document.getElementById('capability-tree-css')) { const css = el('link'); css.id = 'capability-tree-css'; css.rel = 'stylesheet'; css.href = new URL('./capability-tree.css', import.meta.url); document.head.append(css); }
  const shell = el('section', undefined, 'ctree'); shell.dataset.treeLines = S.lines; shell.dataset.treeBreadth = S.breadth; shell.dataset.treeDepth = S.depth; shell.dataset.treeGrafts = tree.grafts.length; shell.dataset.treeGoals = S.goals;
  let selected = tree.nodes[initial] ? initial : null;
  // 顶栏
  const top = el('header', undefined, 'ctree-top'), pills = el('div', undefined, 'ctree-pills');
  top.append(el('h2', '能力树'), el('p', 'REACode 给广度，REACodeRefactoring 给深度：每条能力线左边是原版文件，右边是重构模块。', 'ctree-dim'));
  for (const [n, label, cls] of [[S.breadth, '原版文件', 'k-orig'], [S.depth, '重构模块', 'k-ref'], [S.executables, '可执行', 'k-exec'], [S.wild, '只在原版', 'k-wild'], [S.partial, '接口没带全', 'k-part']]) { const s = el('span', undefined, cls); s.append(el('b', String(n)), document.createTextNode(label)); pills.append(s); }
  top.append(pills); shell.append(top);
  // 目标路径
  for (const g of tree.goals) {
    const card = el('section', undefined, 'ctree-goal'); card.dataset.goal = g.id;
    const h = el('div', undefined, 'ctree-goal-head'); h.append(el('small', '目标路径'), el('b', g.name), el('span', `${g.needs.length} 个可执行能力 · 调用重构库 ${g.called} 个模块 · 方法出处：重构库 ${g.fromRefactored - g.needs.flatMap((n) => n.sources).filter((s) => s.used && s.repo === 'refactored').length} / 原版 ${g.fromOriginal}`, 'ctree-dim'));
    if (onUseGoal) { const b = el('button', '在系统工坊执行这条路径 →', 'ctree-go'); b.onclick = () => onUseGoal(g); h.append(b); }
    const chain = el('ol', undefined, 'ctree-chain');
    for (const n of g.needs) { const li = el('li'); li.title = n.does; li.append(el('b', '⚙ ' + n.name), el('small', n.lineName + '线'));
      const src = el('div', undefined, 'ctree-src'); for (const s of n.sources) src.append(el('i', (s.used ? '调用 ' : '出处 ') + s.path.split('/').pop(), `r-${s.repo}${s.used ? ' used' : ''}`)); if (!n.sources.some((s) => s.used)) src.append(el('i', '本能力自带实现', 'r-system used'));
      li.append(src); li.onclick = () => select(n.line); chain.append(li); }
    card.append(h, chain); shell.append(card);
  }
  // 树
  const body = el('div', undefined, 'ctree-body'), canopy = el('div', undefined, 'ctree-canopy'), drawer = el('aside', undefined, 'ctree-drawer');
  const max = Math.max(1, ...Object.values(tree.nodes).map((n) => Math.max(n.breadth, n.depth)));
  const rows = new Map();
  for (const b of tree.branches) {
    const col = el('section', undefined, 'ctree-branch'); col.dataset.branch = b.id;
    const bh = el('header'); bh.append(el('b', b.name), el('small', b.does), el('span', `原版 ${b.breadth} · 重构 ${b.depth} · ⚙ ${b.executables}`, 'ctree-dim')); col.append(bh);
    for (const id of b.lines) {
      const n = tree.nodes[id], row = el('button', undefined, `ctree-line s-${n.state}${n.inGoal ? ' in-goal' : ''}`); row.type = 'button'; row.dataset.line = id;
      row.title = `${n.name}：${LEVELS[n.level]?.name || ''}${n.frontier ? ' · 代码到 ' + n.frontier : ''}\n原版文件 ${n.breadth}（只在原版 ${n.wild}，接口没带全 ${n.partial}）· 重构模块 ${n.depth} · 可执行 ${n.executables.length}`;
      const name = el('span', undefined, 'ctree-name'); name.append(el('i', LEVELS[n.level]?.mark || '·'), el('b', n.name)); if (n.executables.length) name.append(el('em', '⚙' + n.executables.length));
      const bars = el('span', undefined, 'ctree-bars'), o = el('span', undefined, 'bar-o'), r = el('span', undefined, 'bar-r');
      const ow = el('i', undefined, 'wild'), op = el('i', undefined, 'part'), og = el('i', undefined, 'ok'); ow.style.width = n.wild / max * 100 + '%'; op.style.width = n.partial / max * 100 + '%'; og.style.width = n.grafted / max * 100 + '%'; o.append(og, op, ow);
      const rw = el('i'); rw.style.width = n.depth / max * 100 + '%'; r.append(rw); bars.append(o, el('span', `${n.breadth}｜${n.depth}`, 'bar-n'), r);
      row.append(name, bars); row.onclick = () => select(id); rows.set(id, row); col.append(row);
    }
    canopy.append(col);
  }
  const legend = el('p', undefined, 'ctree-legend'); legend.append(el('span', '左：原版文件', 'l-o'), el('span', '已有落点', 'l-ok'), el('span', '接口没带全', 'l-part'), el('span', '只在原版', 'l-wild'), el('span', '右：重构模块', 'l-r'), el('span', LEVELS.map((l) => `${l.mark} ${l.name}`).join('  '), 'ctree-dim'));
  const left = el('div', undefined, 'ctree-left'); left.append(canopy, legend);
  // 下一步
  const next = el('div', undefined, 'ctree-next'), gq = el('section'), fr = el('section');
  gq.append(el('h3', `嫁接队列 · ${tree.grafts.length}`), el('p', '原版里有、重构库还没带全的文件，按系统多需要它排序。', 'ctree-dim'));
  const gl = el('ol'); for (const g of tree.grafts.slice(0, 8)) { const li = el('li'); li.append(el('b', g.source), el('small', `→ ${g.lineName} · ${g.why}`)); if (g.unmatchedExports.length) li.title = '没带过来的接口：' + g.unmatchedExports.join('、'); li.onclick = () => select(g.line); gl.append(li); } gq.append(gl, el('small', tree.graftFormula, 'ctree-dim'));
  fr.append(el('h3', `解锁前沿 · ${tree.frontier.length}`), el('p', '前置都已可执行、自己还不能执行的能力线：封装一项就多一条可用的线。', 'ctree-dim'));
  const fl = el('ol'); for (const f of tree.frontier.slice(0, 8)) { const li = el('li'); li.append(el('b', f.name), el('small', `${LEVELS[f.level]?.name} · 重构模块 ${f.depth}${f.requiredBy ? ` · ${f.requiredBy} 条线等它` : ''}`)); li.onclick = () => select(f.id); fl.append(li); } fr.append(fl);
  next.append(gq, fr); left.append(next);
  body.append(left, drawer); shell.append(body);
  const foot = el('p', `归线：${S.jevPlaced} 个文件由 JEV 按文字证据归线（${S.jevAnswered} 个里置信度 ≥ 0.85 的）；还有原版 ${S.unplaced.originals} 个、重构模块 ${S.unplaced.modules} 个未归线。${tree.limits[0]}`, 'ctree-dim ctree-foot'); shell.append(foot);

  function drawDrawer() {
    drawer.replaceChildren();
    if (!selected) { drawer.append(el('small', '怎么读'), el('h3', '点一条能力线'), el('p', '看它在两个代码目录里各有什么：哪些原版文件已经有重构落点，哪些接口没带过来，哪些只在原版。', 'ctree-dim'));
      const ul = el('ul', undefined, 'ctree-read'); for (const t of ['目标路径：做一件事要串起哪些可执行能力', '嫁接队列：下一步该把原版的哪个文件重构进来', '解锁前沿：封装哪条线最快多出可执行能力']) ul.append(el('li', t)); drawer.append(ul); return; }
    const n = tree.nodes[selected];
    drawer.append(el('small', `${LEVELS[n.level]?.mark} ${LEVELS[n.level]?.name} · ${n.generations} 代${n.frontier ? ' · 代码到 ' + n.frontier : ''}`), el('h3', n.name)); if (n.question) drawer.append(el('p', n.question, 'ctree-dim'));
    const nums = el('div', undefined, 'ctree-nums'); for (const [v, k] of [[n.breadth, '原版文件'], [n.depth, '重构模块'], [n.executables.length, '可执行']]) { const d = el('div'); d.append(el('b', String(v)), el('span', k)); nums.append(d); } drawer.append(nums);
    if (n.requires.length) drawer.append(el('p', '前置：' + n.requires.map((r) => tree.nodes[r]?.name).join(' → '), 'ctree-dim'));
    if (n.executables.length) { drawer.append(el('h4', '可执行能力')); const box = el('div', undefined, 'ctree-exec'); for (const id of n.executables) { const e = executables.find((x) => x.id === id), b = el('button', '⚙ ' + (e?.name || id)); b.type = 'button'; b.title = e?.does || ''; if (onUse && e) b.onclick = () => onUse({ tier: e.tier, id: e.id, name: e.name }); else b.disabled = true; box.append(b); } drawer.append(box); }
    for (const st of ['wild', 'partial', 'grafted', 'verified']) { const list = n.leaves.filter((x) => x.state === st); if (!list.length) continue;
      const d = el('details'); d.open = st === 'wild' || st === 'partial'; d.className = 'leaf-' + st; d.append(el('summary', `${STATE[st]} · ${list.length}`));
      for (const x of list.slice(0, 30)) { const p = el('p'); p.append(el('code', x.source)); if (x.unmatched) p.append(el('small', `缺 ${x.unmatched}：${x.unmatchedExports.slice(0, 4).join('、')}${x.unmatched > 4 ? '…' : ''}`)); else if (x.targets.length) p.append(el('small', '→ ' + x.targets.slice(0, 2).join('、'))); if (x.by === 'jev') p.append(el('em', 'JEV 归线')); d.append(p); }
      drawer.append(d); }
    if (onOpenLine) { const b = el('button', '看这条线的代际与下一步 →', 'ctree-go'); b.type = 'button'; b.onclick = () => onOpenLine(n.id); drawer.append(b); }
  }
  function select(id) { selected = selected === id ? null : id; for (const [k, r] of rows) r.classList.toggle('selected', k === selected); drawDrawer(); onState?.({ line: selected }); }
  for (const [k, r] of rows) r.classList.toggle('selected', k === selected); drawDrawer();
  host.replaceChildren(shell);
  return { tree, lineage };
}
