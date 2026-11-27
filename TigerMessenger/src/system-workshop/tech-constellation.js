// 交互式能力星图：枝（列）→ 能力线（节点），requires 依赖画成曲线；悬停高亮上下游，点击同步下方能力树抽屉
import {buildCapabilityLineage} from '../../../townscaper-web/REACodeRefactoring/src/core/capability-lineage.js';
import {buildCapabilityTree} from '../../../townscaper-web/REACodeRefactoring/src/core/capability-tree.js?v=maturity-r1';
const NS = 'http://www.w3.org/2000/svg', sv = (t, a = {}) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
const STATE = {fruit: ['可执行', '#16a34a'], bud: ['成形', '#2f8fd8'], growing: ['生长中', '#d97706'], seed: ['种子', '#94a3b8']};

export function renderTechConstellation(host, args, {onPick} = {}) {
  let tree;
  try { tree = buildCapabilityTree(buildCapabilityLineage(args.evolution, args), args); } catch (e) { return null; }
  const branches = tree.branches, nodes = tree.nodes, colW = 150, rowH = 60, top = 54;
  const W = Math.max(760, branches.length * colW + 40), H = top + Math.max(...branches.map(b => b.lines.length)) * rowH + 30;
  const pos = new Map(); branches.forEach((b, i) => b.lines.forEach((id, j) => pos.set(id, [30 + i * colW + colW / 2, top + j * rowH + 20])));
  const box = document.createElement('section'); box.className = 'tc-box';
  const head = document.createElement('div'); head.className = 'tc-head';
  head.innerHTML = `<b>✦ 能力星图</b><span>${pos.size} 条能力线 · 悬停看上下游依赖 · 点击在下方树中展开</span>`;
  const legend = document.createElement('span'); legend.className = 'tc-legend';
  for (const [k, [n, c]] of Object.entries(STATE)) legend.insertAdjacentHTML('beforeend', `<i style="--c:${c}"></i>${n}`);
  head.append(legend);
  const svg = sv('svg', {viewBox: `0 0 ${W} ${H}`, class: 'tc-svg'}), gE = sv('g'), gN = sv('g');
  branches.forEach((b, i) => {
    const x = 30 + i * colW + colW / 2;
    svg.append(sv('rect', {x: x - colW / 2 + 6, y: 8, width: colW - 12, height: H - 16, rx: 14, class: 'tc-col'}));
    const t = sv('text', {x, y: 32, class: 'tc-branch', 'text-anchor': 'middle'}); t.textContent = b.name; svg.append(t);
  });
  const edges = [];
  for (const [id, n] of Object.entries(nodes)) for (const r of n.requires || []) {
    if (!pos.has(r) || !pos.has(id)) continue;
    const [x1, y1] = pos.get(r), [x2, y2] = pos.get(id), dx = Math.max(40, Math.abs(x2 - x1) / 2);
    const p = sv('path', {d: `M${x1},${y1} C${x1 + (x2 >= x1 ? dx : -dx)},${y1} ${x2 - (x2 >= x1 ? dx : -dx)},${y2} ${x2},${y2}`, class: 'tc-edge'});
    p.dataset.from = r; p.dataset.to = id; gE.append(p); edges.push(p);
  }
  const gs = new Map();
  for (const [id, [x, y]] of pos) {
    const n = nodes[id], [label, c] = STATE[n.state] || STATE.seed, r = 7 + Math.min(9, Math.sqrt(n.breadth + n.depth) * 1.6);
    const g = sv('g', {class: 'tc-node', transform: `translate(${x},${y})`, tabindex: 0}); g.style.setProperty('--c', c); g.dataset.line = id;
    const ex = n.executables?.length || 0, frac = Math.min(1, (n.grafted + ex) / Math.max(1, n.breadth + n.depth));
    g.append(sv('circle', {r: r + 4, class: 'tc-halo'}), sv('circle', {r, class: 'tc-core'}));
    const ring = sv('circle', {r: r + 4, class: 'tc-ring', 'stroke-dasharray': `${2 * Math.PI * (r + 4) * frac} 999`, transform: 'rotate(-90)'}); g.append(ring);
    const t = sv('text', {y: r + 14, 'text-anchor': 'middle', class: 'tc-name'}); t.textContent = n.name.length > 9 ? n.name.slice(0, 9) + '…' : n.name; g.append(t);
    const tip = sv('title'); tip.textContent = `${n.name} · ${label} · L${n.level}\n原版 ${n.breadth} | 重构 ${n.depth} | 可执行 ${ex}\n依赖 ${n.requires.length} · 被依赖 ${n.requiredBy.length}`; g.append(tip);
    g.onmouseenter = g.onfocus = () => light(id); g.onmouseleave = g.onblur = () => light(null);
    g.onclick = () => { for (const x of gs.values()) x.classList.toggle('picked', x === g); onPick?.(id); };
    gN.append(g); gs.set(id, g);
  }
  function light(id) {
    svg.classList.toggle('tc-hover', !!id); if (!id) { for (const x of [...edges, ...gs.values()]) x.classList.remove('up', 'down', 'me'); return; }
    const up = new Set(), down = new Set(), walk = (s, k, set) => { for (const x of nodes[s]?.[k] || []) if (!set.has(x)) { set.add(x); walk(x, k, set); } };
    walk(id, 'requires', up); walk(id, 'requiredBy', down);
    for (const [k, g] of gs) { g.classList.toggle('me', k === id); g.classList.toggle('up', up.has(k)); g.classList.toggle('down', down.has(k)); }
    for (const e of edges) { e.classList.toggle('up', (up.has(e.dataset.from) || e.dataset.from === id) && (up.has(e.dataset.to) || e.dataset.to === id)); e.classList.toggle('down', (down.has(e.dataset.to)) && (down.has(e.dataset.from) || e.dataset.from === id)); }
  }
  svg.append(gE, gN); const scroll = document.createElement('div'); scroll.className = 'tc-scroll'; scroll.append(svg);
  box.append(head, scroll); host.prepend(box); return box;
}
