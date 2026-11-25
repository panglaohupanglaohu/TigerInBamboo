/**
 * 山形工坊：管线作用在实景地形上（高山圣城）。
 *   扫描 = mountain.probe：实景采成高度网格 + 建筑 / 轨道掩码；
 *   改造 Worker 用学习库的地形能力（脊线噪声 / 溪流功率侵蚀 / 休止角 / 烘焙明暗）算山形；
 *   验证 Worker 独立重算：保护区、轨道净空、海岸线、山形指标；
 *   预览 = mountain.preview：隐藏原地形换 low poly 山体；放弃恢复原样；采用存本机。
 */
import { describeMountainCapabilities } from './mountain/capabilities.js?v=mountain-r2';
import { mountTierWorkshop } from './tier-workshop.js?v=engine-r1';
import { mountMountainEvolve } from './mountain-evolve.js?v=evolve-r1';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };

export function mountMountainWorkshop({ host, sideHost, request, openSource, status, sceneId, sceneLabel }) {
  const caps = describeMountainCapabilities();
  mountMountainEvolve({ request, status, sceneId });
  const root = el('div', undefined, 'battle-side mountain-side'), info = el('p', '扫描后这里显示实景地形的采样结果。', 'muted'), shape = el('p', '', 'muted');
  root.append(el('h4', '山形'), info, shape);
  const view = mountTierWorkshop({
    host, sideHost, tier: 'mountain', sideTier: 'mountain', storageKey: 'mountain', caps, openSource, status,
    domains: [{ id: 'mountain', name: '山形构造' }],
    intro: '山形管线：实景地形 → 高度网格 → 保护带 → 山体隆起 → 沟谷侵蚀 → 岩屑坡 → 低面片着色。建筑与轨道不动；预览换掉原地形，放弃即恢复。',
    goalHint: '例如：有山的模样、主峰更高、坡更缓',
    scopeText: () => (sceneLabel?.() || '') + ' · 地形',
    agentConfig: {
      experienceKey: 'mountain',
      transformUrl: new URL('./mountain/transform-worker.js?v=mountain-r2', import.meta.url), verifyUrl: new URL('./mountain/verify-worker.js?v=mountain-r2', import.meta.url),
      sceneId,
      hooks: {
        input: async () => {
          const deadline = Date.now() + 240000; let r;
          for (;;) { r = await request('mountain.probe', { id: sceneId?.() }).catch((e) => ({ ok: false, reason: e.message })); if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break; await new Promise((res) => setTimeout(res, 3000)); }
          if (!r.ok) throw Error(r.reason || '场景不支持山形管线');
          info.textContent = `采样 ${r.site.n}×${r.site.n} 格（${r.site.step} m）· 陆地 ${r.site.land} · 建筑 ${r.site.structureCells} · 轨道 ${r.site.railCells} 格 · 最高 ${r.site.top} m`;
          return { scene: { id: r.id, label: r.label }, field: r.field };
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ field: site.field, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: (c) => { const m = c.verification?.metrics, pc = (v) => Math.round(v * 100) + '%'; if (m) shape.textContent = `山形：中等坡 ${pc(m.before.mid)} → ${pc(m.after.mid)} · 平顶 ${pc(m.before.flat)} → ${pc(m.after.flat)} · 峰高 ${m.before.top.toFixed(0)} → ${m.after.top.toFixed(0)} m`; return request('mountain.preview', { id: sceneId?.(), plan: c.run.plan }); },
        compare: (c, on) => request('mountain.compare', { on }),
        revert: () => request('mountain.revert'),
        commit: (c) => request('mountain.commit', { id: sceneId?.(), plan: c.run.plan }),
      },
    },
    preview: { root, scanNote: () => '' },
    actions: { commitLabel: '✓ 采用山形', committed: (r) => r?.note || '山形已采用。' },
  });
  return view;
}
