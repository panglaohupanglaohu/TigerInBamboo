/**
 * 战役工坊：管线作用在实景的 Bad North 战斗舞台上（十二门徒 / 苔庭 / 高山圣城 / 书店镇）。
 *   扫描 = battle.probe：实景采样出战斗舞台（陆地格 / 台地 / 小屋），不交战；
 *   改造 Worker 在采样报告上算作战计划（舞台尺度 / 守军布防 / 登陆波次）；
 *   验证 Worker 独立检查计划；预览 = battle.preview：真在实景里开战；
 *   放弃 = battle.revert 停战拆台；写入 = battle.commit：计划存本机，下次进游戏自动部署。
 * R33–R36：侧栏加导航块（原版当裁判的现算对照、三个导航能力的扫描结果、导航实况），见 battle/nav-panel.js。
 */
import { describeBattleCapabilities } from './battle/capabilities.js?v=contract-r2';
import { mountNavPanel } from './battle/nav-panel.js?v=nav-r1';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r2';
import { mountDefaultsControl } from './defaults-ui.js?v=defaults-r2';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };

export function mountBattleWorkshop({ host, sideHost, request, openSource, status, sceneId, sceneLabel }) {
  const caps = describeBattleCapabilities();
  const root = el('div', undefined, 'battle-side');
  const info = el('p', '扫描后这里显示实景战斗舞台的采样结果。', 'muted'), live = el('p', '', 'muted');
  root.append(el('h4', '战斗舞台'), info, live);
  const navPanel = mountNavPanel(root, { caps });
  const liveTick = async () => { try { const s = await request('battle.state'); navPanel.onState(s); if (s?.stage) live.textContent = s.running ? `实况：第 ${s.wave} 波 · 维京人 ${s.vikings} · 守军 ${s.defenders} · 小屋 ${s.houses - s.housesLost}/${s.houses}` : '实况：舞台已采样，尚未交战'; } catch {} };
  const timer = setInterval(liveTick, 3000);

  const view = mountTierWorkshop({
    host, sideHost, tier: 'battle', sideTier: 'battle', storageKey: 'battle', caps, openSource, status, autoPreload: true, sceneLabel: () => (typeof sceneLabel === 'function' ? sceneLabel() : '') || '',
    domains: [{ id: 'battle', name: '战役部署' }],
    intro: '战役管线：在实景里部署 Bad North 玩法层（采样真实地形 → REA 网格 → 长船登陆 / 守军 / 小屋攻防）。预览真开战，写入后下次进游戏自动部署。',
    goalHint: '例如：开战、增援守军、波次加密',
    scopeText: () => (sceneLabel?.() || '') + ' · 战斗舞台',
    agentConfig: {
      experienceKey: 'battle',
      transformUrl: new URL('./battle/transform-worker.js?v=nav-r1', import.meta.url), verifyUrl: new URL('./battle/verify-worker.js?v=nav-r1', import.meta.url),
      sceneId,
      hooks: {
        input: async () => {
          // 游戏 main.js 在全部场景加载完后才挂 __tm.scene/camera（top-level await）；
          // 场景刚切换时 probe 会报「游戏场景尚未就绪」——轮询等就绪而不是立刻判死。
          const deadline = Date.now() + 240000;
          let r;
          for (;;) {
            r = await request('battle.probe', { id: sceneId?.() }).catch((e) => ({ ok: false, reason: e.message }));
            if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break;
            await new Promise((res) => setTimeout(res, 3000));
          }
          if (!r.ok) throw Error(r.reason || '场景不支持战役部署');
          return { scene: { id: r.id, label: r.label }, ...r.site };
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ site, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: async (c) => { const r = await request('battle.preview', { id: sceneId?.(), plan: c.run.plan }); liveTick(); return r; },
        compare: (c, on) => request('battle.compare', { on }),
        revert: () => request('battle.revert'),
        commit: (c) => request('battle.commit', { id: sceneId?.(), plan: c.run.plan }),
      },
    },
    preview: { root, onScan: (s) => { navPanel.onScan(s); const m = s.matches.find((x) => x.id === 'battle.stage'); const t = m?.targets?.[0]; info.textContent = t ? `舞台采样：${t.reason}` : '舞台采样：无可用陆地'; }, scanNote: () => '' },
    actions: { commitLabel: '✓ 采用战役', committed: () => '战役已采用：战斗继续在实景进行；作战计划已存本机，下次进游戏自动部署。' },
  });
  // R-A2 管线级「设为默认」：登记进共享 defaults；设 = 与「采用战役」同一条 battle.commit（写 tm.battle.adopted.v1:<场景>，下次进游戏自动部署）；撤 = battle.unadopt。
  mountDefaultsControl({
    host: root, scene: sceneId || (() => 'apostles'), layer: 'battle',
    nameOf: (id) => caps.find((c) => c.id === id)?.name || id,
    getPlan: () => { const c = view.agent.current(); return c && c.verification?.status !== 'fail' ? { capabilityId: 'battle.pipeline', planId: c.id, plan: null, note: (c.goal || '') + ' · ' + (c.steps || []).map((s) => s.id).join('→') } : null; },
    onSet: async () => { await view.agent.commit(); return { capabilityId: 'battle.pipeline' }; },
    onClear: () => request('battle.unadopt', { id: sceneId?.() }),
  });
  return { ...view, dispose: () => clearInterval(timer) };
}
