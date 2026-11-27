/**
 * 光影与生命工坊（R65–R70，Guide §10「R61–R70 光影与生命」）：任何场景都出现在系统工坊「场景管线」页，与战役 / 表现层并列。
 *   管线：8 个可执行能力（体素图 · 遮蔽 · 彩色反弹 · 大纹理 · 植物图集 · 风 · 烟 · 动物），扫描后自动预装（R22），▶ 一键执行。
 *   扫描 = lightlife.probe 的实景采样（规则网格：高度 / 建筑 / 顶面色 + 植物清单）；预览 = 克隆几何改顶点色 + 生命图层；对照 / 放弃 = 回原样。
 *   「✓ 登记为候选」只进经验记录（tier-agent），不写 localStorage / 存档、不设默认；采用走管线上的通用采用环（catalog/defaults.json，另一位同事在做）。
 *   侧栏：采样信息、大纹理缩略图、全场景共用的植物图集（本场景用到的格子描黄）、多种子分布面板（R62，tier-workshop 按登记表自动挂，输入 = 当前采样）。
 *   「之前 / 之后 · 同机位对照」用 tier-workshop 侧栏里通用的那一块（before-after-panel.js，R70，任何层都有）；这里只多给四个固定机位按钮。
 */
import { describeLightLifeCapabilities } from './lightlife/capabilities.js?v=light-r66';
import { sharedPlantAtlas } from './lightlife/plant-atlas.js?v=light-r67';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r2';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
function ensureCss() { if (document.getElementById('lightlife-css')) return; const l = document.createElement('link'); l.id = 'lightlife-css'; l.rel = 'stylesheet'; l.href = new URL('./lightlife.css?v=light-r70', import.meta.url).href; document.head.append(l); }

export function mountLightLifeWorkshop({ host, sideHost, request, openSource, status = () => {}, sceneId = () => globalThis.__tmCurrentScene, sceneLabel = () => '' }) {
  ensureCss();
  const caps = describeLightLifeCapabilities();
  let lastSite = null, lastPlan = null;
  const root = el('div', undefined, 'll-side'), info = el('p', '先扫描：把当前场景采成虚拟体素空间。', 'muted'), canv = el('div', undefined, 'll-canvases');
  const megaCv = el('canvas'), plantCv = el('canvas'); megaCv.width = megaCv.height = 64; plantCv.width = plantCv.height = 128; megaCv.id = 'lightlife-megatex'; plantCv.id = 'lightlife-plants';
  const f1 = el('figure'), f2 = el('figure'); f1.append(megaCv, el('figcaption', '大纹理（缩略）')); f2.append(plantCv, el('figcaption', '共用植物图集'));
  canv.append(f1, f2); root.append(el('h4', '光影与生命'), info, canv);
  function drawMega() {
    const g = megaCv.getContext('2d'), p = lastPlan?.megatex?.preview; g.fillStyle = '#2a3238'; g.fillRect(0, 0, 64, 64); if (!p) return;
    const img = g.createImageData(p.w, p.h); for (let k = 0; k < p.w * p.h; k++) { img.data[k * 4] = p.rgb[k * 3]; img.data[k * 4 + 1] = p.rgb[k * 3 + 1]; img.data[k * 4 + 2] = p.rgb[k * 3 + 2]; img.data[k * 4 + 3] = 255; } g.putImageData(img, 0, 0);
  }
  function drawPlants() {
    const A = sharedPlantAtlas(), g = plantCv.getContext('2d'), k = 128 / A.size, used = new Set(lastPlan?.plants?.used || []);
    g.fillStyle = '#2a3238'; g.fillRect(0, 0, 128, 128);
    for (const s of A.slots) { if (s.missing) continue; g.fillStyle = s.col; g.fillRect(s.x * k, s.y * k, s.w * k, s.h * k); if (used.has(s.key)) { g.strokeStyle = '#f2c94c'; g.lineWidth = 2; g.strokeRect(s.x * k + 1, s.y * k + 1, s.w * k - 2, s.h * k - 2); } }
    plantCv.title = `共用图集 ${A.hash}：${A.slots.map((s) => s.name + (used.has(s.key) ? '（本场景）' : '')).join('、')}`;
  }
  drawPlants();

  // 固定机位（光影与生命自己的四个机位，按场景半径算）：先摆好机位，再用侧栏通用的「之前 / 之后 · 同机位对照」拍
  const poses = el('div', undefined, 'gscene-actions'); poses.id = 'lightlife-poses';
  const mk = (t, fn) => { const b = el('button', t, 'small'); b.type = 'button'; b.onclick = () => fn().catch((e) => status(e.message)); return b; };
  for (const [p, name] of [['front', '正面'], ['side', '侧面'], ['top', '俯视'], ['oblique', '斜后']]) { const b = mk('机位·' + name, async () => { const r = await request('lightlife.camera', { pose: p, id: sceneId() }); if (!r.ok) status(r.reason); }); b.dataset.pose = p; poses.append(b); }
  poses.append(mk('放开机位', async () => { await request('lightlife.camera', { pose: 'free' }); }));
  root.append(el('small', '固定机位（之前 / 之后同一组）：', 'muted'), poses);

  const view = mountTierWorkshop({
    host, sideHost, tier: 'lightlife', sideTier: 'lightlife', storageKey: 'lightlife', caps, openSource, status, autoPreload: true,
    sceneLabel: () => sceneLabel() || '', domains: [{ id: 'lightlife', name: '光影与生命（体素图 → 遮蔽 → 反弹 → 大纹理 → 植物 → 风 → 烟 → 动物）' }],
    seedReport: { layer: 'lightlife', input: () => lastSite },
    intro: '光影与生命管线：整个场景一份虚拟体素空间，遮蔽、彩色反弹、大纹理、植物图集、风、烟、小动物都读它。实景预览只换顶点色、加一层可撤的生命图层。',
    goalHint: '例如：墙脚和巷子暗一点，墙缝里泛邻居的颜色，加点炊烟和小动物',
    scopeText: () => (sceneLabel() || sceneId() || '当前场景') + ' · 全部地形与建筑网格',
    agentConfig: {
      experienceKey: 'lightlife',
      transformUrl: new URL('./lightlife/transform-worker.js?v=light-r65', import.meta.url), verifyUrl: new URL('./lightlife/verify-worker.js?v=light-r66', import.meta.url),
      timeouts: { run: { idle: 45000, total: 180000 }, verify: { idle: 45000, total: 120000 } },
      hooks: {
        sceneId,
        input: async () => {
          const deadline = Date.now() + 240000; let r;
          for (;;) { r = await request('lightlife.probe', { id: sceneId() }).catch((e) => ({ ok: false, reason: e.message })); if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break; await new Promise((res) => setTimeout(res, 3000)); }
          if (!r.ok) throw Error(r.reason || '这个场景还不能采样');
          lastSite = r.site; const i = r.info;
          info.textContent = `${r.label}：${i.n}×${i.n} 格（半径 ${Math.round(i.half)} m）· 陆地 ${i.land} · 建筑 ${i.build} · 网格 ${i.meshes} 个 · 植被 ${i.veg} 个（${i.flora} 种）· ${i.tris} 三角${i.clipped ? '（超出上限，后面的没采）' : ''} · ${i.ms} ms`;
          info.dataset.land = String(i.land); return lastSite;
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ site, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: async (c) => { lastPlan = c.run.plan; drawMega(); drawPlants(); return request('lightlife.preview', { id: sceneId(), plan: c.run.plan }); },
        compare: (c, on) => request('lightlife.compare', { on }),
        revert: () => request('lightlife.revert'),
        commit: async (c) => ({ ok: true, candidate: c.id, steps: c.report.map((r) => r.id), note: '只登记为候选（经验记录里有这一条）；采用 / 设为默认走管线上的通用采用环（catalog/defaults.json）' }),
      },
    },
    preview: { root, onScan: () => { drawPlants(); }, scanNote: () => '' },
    actions: { commitLabel: '✓ 登记为候选', committed: () => '已登记为候选（不写存档、不设默认）；采用走管线上的通用采用环。' },
  });
  return { ...view, drawCompare: () => {}, get lastPlan() { return lastPlan; }, get lastSite() { return lastSite; } };
}
