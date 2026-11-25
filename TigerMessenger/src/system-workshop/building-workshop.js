/**
 * 建筑工坊（R56–R59）：管线作用在实景高度场上（高山圣城、水晶城）。
 *   扫描 = building.probe：实景采成高度网格 + 已有建筑 / 轨道掩码（圣城上若山形候选正在预览，用候选高度 —— 「地形 → 建筑」两段）；
 *   改造 Worker 用重构库 prefab-socket.js（多格 prefab / socket + core/wfc.js 联合 WFC）算建筑群；
 *   验证 Worker 独立重算：validateLayout + 契约 preserves 生成的检查（R52）；
 *   预览 = building.preview：加一组独立网格（整体放置）；换种子再跑 = 整体替换（R59）；撤回 = 删掉这组网格；
 *   采用只记 tm.building.adopted.v1:<场景>，不改已有建筑、不写存档，进游戏不自动换（P-R57-01 待用户决定）。
 * 侧栏：多格 prefab 目录（R54，足迹 + 门 socket 图）、联合 WFC 平面图（R55，线框平面图，不是最终效果）、契约生成的检查（R52）、整体替换 / 撤回 / 机位（R59）。
 */
import { describeBuildingCapabilities } from './building/capabilities.js?v=building-r2';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r1';
import { mountDefaultsControl } from './defaults-ui.js?v=defaults-r2';
import { contractOf, contractLine } from './contracts.js?v=contract-r1';
import { checksFromPreserves } from './contract-verify.js?v=contract-r1';
import { PREFAB_LIBRARY, DIRS, REASON } from '../../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const SVG = 'http://www.w3.org/2000/svg', sv = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const CSS = `
#building-workshop{display:none}
body[data-tier=scene][data-scene-edit=view][data-scene-building="1"] #building-workshop{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;margin-top:16px;min-height:420px}
body[data-layer-focus=mountain][data-scene-building="1"] #building-workshop{display:grid!important;grid-template-columns:minmax(0,1fr) 300px;gap:16px;margin-top:16px;min-height:420px}
body[data-layer-focus=battle] #building-workshop,body[data-layer-focus=fx] #building-workshop{display:none!important}
body[data-tier=scene][data-scene-edit=view] .tier-side[data-tier=building]{display:block}
#building-workshop:empty::before{content:'建筑管线正在挂载：等游戏连接并切到高山圣城或水晶城…';grid-column:1/-1;align-self:center;justify-self:center;color:var(--muted);font-size:13px}
.building-side svg{width:100%;height:auto;background:var(--panel-2,#f6f3ee);border-radius:6px;margin:4px 0}
.building-side .prefab-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.building-side .prefab-grid figure{margin:0;text-align:center;font-size:11px}
.building-side .bld-actions{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.building-side .bld-checks{font-size:11px;margin:4px 0 0;padding-left:16px}
.building-side .bld-legend{font-size:11px;color:var(--muted)}
`;
export function ensureBuildingPane(doc = document) {
  if (!doc.getElementById('building-workshop-css')) { const st = doc.createElement('style'); st.id = 'building-workshop-css'; st.textContent = CSS; doc.head.append(st); }
  let h = doc.getElementById('building-workshop');
  if (!h) { h = doc.createElement('div'); h.id = 'building-workshop'; h.className = 'tier-pane'; h.setAttribute('aria-label', '建筑管线'); const after = doc.getElementById('mountain-workshop') || doc.querySelector('.tier-pane'); if (after) after.after(h); else doc.body.append(h); }
  return h;
}

/** R54：一个 prefab 的足迹 + 门 socket 小图。 */
function prefabSvg(p) {
  const xs = p.cells.map((c) => c[0]), ys = p.cells.map((c) => c[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1, S = 14;
  const s = sv('svg', { viewBox: `-4 -4 ${w * S + 8} ${h * S + 8}`, 'data-prefab': p.id });
  p.cells.forEach(([x, y], i) => s.append(sv('rect', { x: (x - x0) * S, y: (y - y0) * S, width: S - 1, height: S - 1, fill: i === p.tower ? '#b5523b' : '#d8c3a0', stroke: '#7a6b48', 'stroke-width': 0.8 })));
  const [dp, de] = p.door, [cx, cy] = p.cells[dp], [dx, dy] = DIRS[de];
  s.append(sv('rect', { x: (cx - x0) * S + S / 2 - 2.5 + dx * (S / 2 - 1), y: (cy - y0) * S + S / 2 - 2.5 + dy * (S / 2 - 1), width: 5, height: 5, fill: '#4a3a2a', 'data-socket': 'door' }));
  return s;
}
/** R55：联合 WFC 解出的平面图（窗口内：保护原因底色 / 建筑 / 路 / 门）。线框平面图，不是最终效果。 */
const REASON_FILL = { 0: '#eef3e6', 1: '#c9c2d9', 2: '#e6d3a0', 3: '#cfe3f0', 4: '#e0d6cc', 5: '#eeeeee' };
const PREFAB_FILL = { cottage: '#e8b07a', hall: '#d98d5f', lhouse: '#c46f4a', chapel: '#8f5fa8', manor: '#6b8f4a' };
function layoutSvg(layout, reasonAt) {
  const { i0, j0, w, h } = layout.window, S = 10, s = sv('svg', { viewBox: `0 0 ${w * S} ${h * S}`, id: 'building-layout-svg', 'data-buildings': layout.placements.length, 'data-roads': layout.roads.length });
  for (let J = j0; J < j0 + h; J++) for (let I = i0; I < i0 + w; I++) s.append(sv('rect', { x: (I - i0) * S, y: (J - j0) * S, width: S, height: S, fill: REASON_FILL[reasonAt?.(I, J) ?? 0], stroke: '#fff', 'stroke-width': 0.3 }));
  for (const r of layout.roads) { const [I, J] = r.cell, cx = (I - i0) * S + S / 2, cy = (J - j0) * S + S / 2; s.append(sv('circle', { cx, cy, r: 1.6, fill: '#8a7f6c' })); for (let e = 0; e < 4; e++) if ((r.mask >> e) & 1) s.append(sv('line', { x1: cx, y1: cy, x2: cx + DIRS[e][0] * S / 2, y2: cy + DIRS[e][1] * S / 2, stroke: '#8a7f6c', 'stroke-width': 2.4, 'stroke-linecap': 'round' })); }
  for (const p of layout.placements) {
    const g = sv('g', { 'data-prefab': p.prefab, 'data-n': p.n });
    for (const [I, J] of p.cells) g.append(sv('rect', { x: (I - i0) * S + 0.6, y: (J - j0) * S + 0.6, width: S - 1.2, height: S - 1.2, fill: PREFAB_FILL[p.prefab] || '#c46f4a', stroke: '#5a4030', 'stroke-width': 0.6 }));
    const [I, J] = p.door.cell, [dx, dy] = DIRS[p.door.dir]; g.append(sv('rect', { x: (I - i0) * S + S / 2 - 1.5 + dx * (S / 2 - 1), y: (J - j0) * S + S / 2 - 1.5 + dy * (S / 2 - 1), width: 3, height: 3, fill: '#2b1d12' }));
    s.append(g);
  }
  return s;
}

export function mountBuildingWorkshop({ host, sideHost, request, openSource, status, sceneId, sceneLabel }) {
  ensureBuildingPane();
  const caps = describeBuildingCapabilities();
  const root = el('div', undefined, 'battle-side building-side'), info = el('p', '扫描后这里显示实景采样与地形来源。', 'muted'), terrainNote = el('p', '', 'muted');
  root.id = 'building-side';
  // R54 prefab 目录
  const cat = el('div'), grid = el('div', undefined, 'prefab-grid');
  for (const p of PREFAB_LIBRARY) { const f = el('figure'); f.append(prefabSvg(p), el('figcaption', `${p.name} · ${p.cells.length} 格`)); grid.append(f); }
  cat.append(el('h5', '多格 prefab 目录（每种 × 4 朝向；深色小方块 = 门 socket）'), grid);
  // R55 平面图
  const plan = el('div'); plan.id = 'building-plan'; plan.append(el('h5', '联合 WFC 平面图'), el('p', '执行管线后显示：建筑（按 prefab 着色）、路、门；底色 = 为什么不能建。线框平面图，不是最终效果。', 'muted bld-legend'));
  // R52 契约生成的检查
  const contract = el('details'); contract.append(el('summary', '契约 → 验证会查什么'));
  const ul = el('ul', undefined, 'bld-checks');
  for (const c of caps) { const k = contractOf(c, 'building'); const li = el('li'); li.append(el('b', c.name + '：'), document.createTextNode(contractLine(k) + '。查：' + checksFromPreserves(k.preserves).map((x) => x.name).join('、'))); ul.append(li); }
  contract.append(ul);
  // R59 整体替换 / 撤回 / 机位
  const acts = el('div', undefined, 'bld-actions'), out = el('p', '', 'muted'); out.id = 'building-action-note';
  const mk = (id, text, fn) => { const b = el('button', text, 'small'); b.type = 'button'; b.id = id; b.onclick = async (e) => { e.stopPropagation(); try { out.textContent = await fn(); } catch (err) { out.textContent = text + '失败：' + err.message; } }; acts.append(b); return b; };
  root.append(el('h4', '建筑'), info, terrainNote, cat, plan, contract, el('h5', '整体放置 / 替换 / 撤回'), acts, out);
  let view = null, lastLayout = null;
  const seedOf = () => view?.pipeline?.nodes?.find((n) => n.id === 'building.joint-wfc')?.params?.seed ?? caps.find((c) => c.id === 'building.joint-wfc').params.seed.default;
  mk('building-replace', '换一组（整体替换）', async () => { if (!view) return '工坊还没挂好'; const s = (Number(seedOf()) % 999) + 1; view.add('building.joint-wfc', { seed: s }, { quiet: true }); await view.generate(); const st = await request('building.state'); root.dataset.state = JSON.stringify(st); return `已用种子 ${s} 重新解一组：${st.buildings} 栋（旧的一组已整体撤掉）。`; });
  mk('building-revert', '撤回建筑群', async () => { const r = await request('building.revert'); const st = await request('building.state'); root.dataset.state = JSON.stringify(st); return r.reverted ? '已撤回：候选建筑群整组删掉，场景原样（已有建筑本来就没动）。' : '没有正在预览的建筑群。'; });
  mk('building-unadopt', '撤销采用记录', async () => { const r = await request('building.unadopt', { id: sceneId?.() }); return r.removed ? `已删除采用记录 ${r.key}，并撤回预览。` : '本场景没有建筑采用记录。'; });
  mk('building-cam-oblique', '斜俯机位', async () => { const r = await request('building.camera', { view: 'oblique' }); return r.ok ? '镜头对准建筑群窗口（斜俯）。' : r.reason; });
  mk('building-cam-top', '俯视机位', async () => { const r = await request('building.camera', { view: 'top' }); return r.ok ? '镜头对准建筑群窗口（俯视）。' : r.reason; });
  mk('building-cam-free', '还原镜头', async () => { await request('building.camera', { view: 'free' }); return '镜头控制已还原。'; });
  let lastField = null;
  view = mountTierWorkshop({
    host, sideHost, tier: 'building', sideTier: 'building', storageKey: 'building', caps, openSource, status, autoPreload: true, sceneLabel: () => (typeof sceneLabel === 'function' ? sceneLabel() : '') || '',
    domains: [{ id: 'building', name: '建筑构筑' }],
    intro: '建筑管线：实景高度场 → 选址（老城保护带 / 轨道净空 / 海 / 坡度）→ 多格 prefab 目录 → 联合 WFC 摆建筑群（prefab + 路 + 空地一次解）。候选是一组独立网格，已有建筑与存档不动；放弃 / 撤回即删掉。',
    goalHint: '例如：在山上建一片带路的房子、要礼拜堂和大宅',
    scopeText: () => (sceneLabel?.() || '') + ' · 建筑',
    agentConfig: {
      experienceKey: 'building',
      transformUrl: new URL('./building/transform-worker.js?v=building-r1', import.meta.url), verifyUrl: new URL('./building/verify-worker.js?v=building-r1', import.meta.url),
      sceneId,
      hooks: {
        input: async () => {
          const deadline = Date.now() + 240000; let r;
          for (;;) { r = await request('building.probe', { id: sceneId?.() }).catch((e) => ({ ok: false, reason: e.message })); if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break; await new Promise((res) => setTimeout(res, 3000)); }
          if (!r.ok) throw Error(r.reason || '场景不支持建筑管线');
          info.textContent = `采样 ${r.site.n}×${r.site.n} 格（${r.site.step} m）· 陆地 ${r.site.land} · 可改 ${r.site.free} · 已有建筑 ${r.site.structureCells} · 轨道 ${r.site.railCells} 格 · 最高 ${r.site.top} m`;
          terrainNote.textContent = (r.terrain === 'mountain-candidate' ? '地形来源：山形候选（两段管线：先山形、再建筑）。' : '地形来源：原地形。') + (r.site.notes || []).join('；');
          root.dataset.terrain = r.terrain; lastField = r.field;
          return { scene: { id: r.id, label: r.label }, field: r.field, terrain: r.terrain, mountainSig: r.mountainSig };
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ field: site.field, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })), sceneId: site.scene?.id }),
        preview: async (c) => {
          const layout = c.run.plan?.layout; lastLayout = layout || null;
          plan.querySelector('svg')?.remove();
          if (!layout) { plan.dataset.empty = '1'; return { ok: false, skipped: true, reason: c.run.plan?.solve?.reason || '没有建筑群' }; }
          delete plan.dataset.empty;
          // 底色：在页面上按同一采样重算保护原因（只用于显示）
          let reasonAt = null; try { const { latticeFromField } = await import('../../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js'); const L = latticeFromField(lastField || c.input.field, layout.params); reasonAt = (I, J) => L.reason[J * L.W + I]; } catch {}
          plan.append(layoutSvg(layout, reasonAt));
          const r = await request('building.preview', { id: sceneId?.(), layout });
          root.dataset.state = JSON.stringify(await request('building.state').catch(() => ({})));
          return r;
        },
        compare: (c, on) => request('building.compare', { on }),
        revert: () => request('building.revert'),
        commit: (c) => request('building.commit', { id: sceneId?.(), layout: c.run.plan.layout }),
      },
    },
    preview: { root, scanNote: () => '' },
    actions: { commitLabel: '✓ 采用建筑群（只记候选）', committed: (r) => r?.note || '建筑群已记下采用。' },
  });
  view.lastLayout = () => lastLayout;
  view.legend = REASON;
  // R-A2 管线级「设为默认」：设 = 与「采用建筑群」同一条 commit（写 tm.building.adopted.v1:<场景>）；撤 = building.unadopt。
  mountDefaultsControl({
    host: root, scene: sceneId?.() || 'citadel', layer: 'building',
    nameOf: (id) => caps.find((c) => c.id === id)?.name || id,
    getPlan: () => { const c = view.agent.current(); const lay = c?.run?.plan?.layout; return c && c.verification?.status !== 'fail' && lay ? { capabilityId: 'building.pipeline', planId: c.id, plan: null, note: (c.goal || '') + ' · ' + lay.placements.length + ' 栋' } : null; },
    onSet: async () => { await view.agent.commit(); return { capabilityId: 'building.pipeline' }; },
    onClear: () => request('building.unadopt', { id: sceneId?.() }),
  });
  return view;
}
