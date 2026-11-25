/**
 * 表现层工坊：管线作用在战斗舞台采样的格网上（与战役工坊同一扫描，不交战）。
 *   扫描 = battle.probe 的舞台格网；改造 Worker 真实调用学习库模块：
 *     战役图分区与前线 / 环绕镜头路径 / Kelvin 船尾迹 / 镜像装饰面板 / 节点图回放；
 *   验证 Worker 独立重算（前线净空、角速度、夹角、镜像、图可复算）；
 *   预览 = 同画布画候选（分区色块+前线+镜头+尾迹），对照切回原图；采用存本机草稿。
 */
import { describeFxCapabilities } from './fx/capabilities.js?v=fx-r1';
import { mountTierWorkshop } from './tier-workshop.js?v=engine-r1';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const ZCOL = ['#7f9bb3', '#8fae7f', '#c2a06b', '#b58a9a', '#9a90c8', '#7fb3a5'];
const sea = '#0f1420', landC = '#26303c', houseC = '#e0b84a', frontC = '#e8625a', camC = '#5ad1e8', wakeC = 'rgba(220,235,255,.75)';

function drawMap(cv, site, plan, candidate) {
  const g = site.grid || []; if (!g.length) return;
  const s = 220; cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d'); ctx.fillStyle = sea; ctx.fillRect(0, 0, s, s);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const c of g) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); z0 = Math.min(z0, c[1]); z1 = Math.max(z1, c[1]); }
  const pad = 6, sc = Math.min((s - pad * 2) / Math.max(1, x1 - x0), (s - pad * 2) / Math.max(1, z1 - z0));
  const P = (x, z) => [pad + (x - x0) * sc + (s - pad * 2 - (x1 - x0) * sc) / 2, pad + (z - z0) * sc + (s - pad * 2 - (z1 - z0) * sc) / 2];
  const cell = Math.max(2, (site.scale || 5) * sc * 0.9);
  g.forEach((c, i) => {
    const [a, b] = P(c[0], c[1]);
    ctx.fillStyle = c[3] ? houseC : candidate && plan?.campaign ? ZCOL[(plan.campaign.zones?.[i] ?? i) % ZCOL.length] : landC;
    ctx.fillRect(a - cell / 2, b - cell / 2, cell, cell);
  });
  if (candidate && plan?.campaign?.frontier?.length > 1) {
    ctx.strokeStyle = frontC; ctx.lineWidth = 2; ctx.beginPath();
    plan.campaign.frontier.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
  }
  if (candidate && plan?.camera?.path?.length > 1) {
    ctx.strokeStyle = camC; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath();
    plan.camera.path.forEach((p, i) => { const [a, b] = P(p.x, p.z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); ctx.setLineDash([]);
    const f = plan.camera.path[0], [a, b] = P(f.x, f.z); ctx.fillStyle = camC; ctx.beginPath(); ctx.arc(a, b, 3, 0, 7); ctx.fill();
  }
  if (candidate && plan?.wake?.points?.length) {
    ctx.strokeStyle = wakeC; ctx.lineWidth = 1;
    for (const p of plan.wake.points) {
      const a = P(p.l[0], p.l[1]), b2 = P(p.r[0], p.r[1]);
      ctx.globalAlpha = Math.max(0.15, 1 - p.age / 10); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (plan.wake.track) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); const [a, b] = P(...plan.wake.track[0]), [c2, d] = P(...plan.wake.track[1]); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); }
  }
}

export function mountFxWorkshop({ host, sideHost, request, openSource, status, sceneId, sceneLabel }) {
  const caps = describeFxCapabilities();
  const root = el('div', undefined, 'battle-side fx-side'), info = el('p', '扫描后这里显示舞台格网与候选图。', 'muted'), cv = el('canvas', '', 'fx-map');
  cv.style.cssText = 'width:100%;border-radius:6px;margin-top:6px';
  const note = el('p', '', 'muted');
  root.append(el('h4', '表现层'), info, cv, note);
  let lastSite = null;
  const view = mountTierWorkshop({
    host, sideHost, tier: 'fx', sideTier: 'fx', storageKey: 'fx', caps, openSource, status,
    domains: [{ id: 'fx', name: '表现层' }],
    intro: '表现层管线：舞台格网 → 战役分区与前线 → 环绕镜头 → 船尾迹 → 装饰面板 → 回放图。复用战役扫描，不交战；候选画在同画布上，采用存本机草稿。',
    goalHint: '例如：画出岛屿分区与前线、绕场镜头路径',
    scopeText: () => (sceneLabel?.() || '') + ' · 舞台',
    agentConfig: {
      experienceKey: 'fx',
      transformUrl: new URL('./fx/transform-worker.js?v=fx-r1', import.meta.url), verifyUrl: new URL('./fx/verify-worker.js?v=fx-r1', import.meta.url),
      sceneId,
      hooks: {
        input: async () => {
          const deadline = Date.now() + 240000; let r;
          for (;;) { r = await request('battle.probe', { id: sceneId?.() }).catch((e) => ({ ok: false, reason: e.message })); if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break; await new Promise((res) => setTimeout(res, 3000)); }
          if (!r.ok) throw Error(r.reason || '场景不支持表现层管线（需要可交战的舞台）');
          lastSite = { scene: { id: r.id, label: r.label }, ...r.site };
          info.textContent = `舞台格网 ${r.site.grid?.length || r.site.land} 格 · 最高 ${r.site.maxLevel} 层 · 小屋 ${r.site.houses}`;
          drawMap(cv, lastSite, null, false);
          return lastSite;
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site: { ...site, pipelineSteps: steps.map((s) => s.id) }, steps }),
        verifyMsg: (site, scan, run) => ({ site, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: async (c) => { drawMap(cv, lastSite, c.run.plan, true); const r = await request('fx.preview', { id: sceneId?.(), plan: c.run.plan }).catch((e) => ({ ok: false, reason: e.message })); note.textContent = r.ok ? `候选（画布 + 实景叠加：${r.drawn}）` : '候选：分区色块 · 红线=前线 · 青线=镜头 · 白带=尾迹（实景叠加未开：' + (r.reason || '') + '）'; return { ok: true }; },
        compare: (c, on) => { drawMap(cv, lastSite, on ? null : c.run.plan, !on); request('fx.compare', { on }).catch(() => {}); return Promise.resolve({ ok: true }); },
        revert: () => { if (lastSite) drawMap(cv, lastSite, null, false); request('fx.revert').catch(() => {}); return Promise.resolve({ ok: true }); },
        commit: (c) => {
          const key = `tm.fx.plan.v1:${sceneId?.() || 'scene'}`;
          try { localStorage.setItem(key, JSON.stringify({ plan: c.run.plan, verify: c.verification?.status, at: Date.now() })); } catch {}
          return Promise.resolve({ ok: true, note: `表现层草稿已存本机 ${key}` });
        },
      },
    },
    preview: { root, scanNote: () => '' },
    actions: { commitLabel: '✓ 存为本机草稿', committed: (r) => r?.note || '草稿已存。' },
  });
  return view;
}
