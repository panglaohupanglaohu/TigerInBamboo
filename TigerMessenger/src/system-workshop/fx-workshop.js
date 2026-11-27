/**
 * 表现层工坊：管线作用在战斗舞台采样的格网上（与战役工坊同一扫描，不交战）。
 *   扫描 = battle.probe 的舞台格网；改造 Worker 真实调用学习库模块：
 *     战役图分区与前线 / 环绕镜头路径 / Kelvin 船尾迹 / 镜像装饰面板 / 节点图回放；
 *   验证 Worker 独立重算（前线净空、角速度、夹角、镜像、图可复算）；
 *   预览 = 同画布画候选（分区色块+前线+镜头+尾迹），对照切回原图；采用存本机草稿。
 *   R37–R39：火（橙）/ 走廊样板（紫框 + 下方展开面条）/ 崖面层带（褐）/ 弹道（黄）也画进画布，并经 fx.live.preview 放进实景
 *   （world/rea/fxLive.js：life/effects.js 火粒子、build/doodle-hallway.js 样板、层带面片、弹道线）。
 *   R40：「✈ 镜头飞一圈」= fx.camera 的路径真实驱动游戏镜头；「■ 停止并还原镜头」/ 回退 还原进入前的镜头。
 */
import { describeFxCapabilities } from './fx/capabilities.js?v=fx-meta-r1';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r2';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const ZCOL = ['#7f9bb3', '#8fae7f', '#c2a06b', '#b58a9a', '#9a90c8', '#7fb3a5'];
const sea = '#0f1420', landC = '#26303c', houseC = '#e0b84a', frontC = '#e8625a', camC = '#5ad1e8', wakeC = 'rgba(220,235,255,.75)';
const sedC = '#b08a5a', arrowC = '#f2c14e', hallC = '#c07ad8';
const HALL_TINTS = ['#d9c7a3', '#a9c4b5', '#d8a9a0', '#b7b2d6', '#e2cf8f', '#9fb8cf'];

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
  // R39 崖面层带：每面崖画一小段褐色短线（沿崖边）
  if (candidate && plan?.sediment?.faces?.length) {
    ctx.strokeStyle = sedC; ctx.lineWidth = 2; const h = (plan.sediment.half || 0.5) * sc;
    for (const f of plan.sediment.faces) { const [a, b] = P(f.x, f.z); ctx.beginPath(); ctx.moveTo(a + f.dz * h, b - f.dx * h); ctx.lineTo(a - f.dz * h, b + f.dx * h); ctx.stroke(); }
  }
  // R39 弹道：俯视投影 + 落点
  if (candidate && plan?.projectiles?.shots?.length) {
    ctx.strokeStyle = arrowC; ctx.fillStyle = arrowC; ctx.lineWidth = 1.2;
    for (const s of plan.projectiles.shots) { ctx.beginPath(); s.path.forEach((q, i) => { const [a, b] = P(q[0], q[2]); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); const [a, b] = P(s.b[0], s.b[2]); ctx.fillRect(a - 1.5, b - 1.5, 3, 3); }
  }
  // R38 走廊样板落点
  if (candidate && plan?.hallway?.host) { const [a, b] = P(plan.hallway.host.x, plan.hallway.host.z); ctx.strokeStyle = hallC; ctx.lineWidth = 2; ctx.strokeRect(a - cell, b - cell, cell * 2, cell * 2); }
  // R37 火：点火处画一团橙色光晕
  if (candidate && plan?.fire?.sources?.length) {
    for (const s of plan.fire.sources) { const [a, b] = P(s.x, s.z), r = Math.max(5, cell * 1.4), gr = ctx.createRadialGradient(a, b, 0, a, b, r); gr.addColorStop(0, 'rgba(255,220,130,1)'); gr.addColorStop(0.45, 'rgba(255,122,47,.85)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); }
  }
}

/** R38：走廊展开面条（沿墙长度 s 横排，每块板按底色、门洞涂深）。 */
function drawHallStrip(cv, h) {
  const w = 220, ht = 46; cv.width = w; cv.height = ht; const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, ht);
  if (!h?.panels?.length) { cv.style.display = 'none'; return; }
  cv.style.display = ''; const k = w / (h.S || 1);
  ctx.fillStyle = '#2a2622'; ctx.fillRect(0, 0, w, ht);
  for (const p of h.panels) { ctx.fillStyle = HALL_TINTS[(p.tint || 0) % HALL_TINTS.length]; ctx.fillRect(p.s0 * k, 2, Math.max(1, (p.s1 - p.s0) * k), ht - 4); ctx.fillStyle = 'rgba(30,28,26,.55)'; for (let i = 0; i < Math.min(p.motifs, 40); i++) { const x = p.s0 * k + ((i * 0.618) % 1) * (p.s1 - p.s0) * k, y = 4 + ((i * 0.381) % 1) * (ht - 14); ctx.fillRect(x, y, 2, 2); } }
  if (h.door) { ctx.fillStyle = '#1e1c1a'; const dh = Math.min(ht - 4, (h.door.top / (h.V || 1)) * ht); ctx.fillRect(h.door.s0 * k, ht - 2 - dh, (h.door.s1 - h.door.s0) * k, dh); }
  ctx.fillStyle = '#f2f4f1'; ctx.fillRect((h.wallA || 0) * k, 0, 1, ht);
}

/** 节点回放：把 plan.replay（NodeGraph 执行序 + 末节点逐帧输出）画成小图。 */
function drawReplay(cv, r) {
  const w = 220; cv.width = w; const ctx = cv.getContext('2d');
  if (!r?.nodes?.length) { cv.style.display = 'none'; cv.height = 1; ctx.clearRect(0, 0, w, 1); return; }
  cv.style.display = ''; const rowH = 22, cols = Math.min(r.nodes.length, 6), rows = Math.ceil(r.nodes.length / 6);
  const cellW = w / cols; cv.height = rows * rowH + 30;
  ctx.clearRect(0, 0, w, cv.height);
  r.nodes.forEach((id, i) => {
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * rowH;
    ctx.fillStyle = i === r.nodes.length - 1 ? '#3c5a4a' : '#2a3140'; ctx.strokeStyle = '#566a80';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cellW - 6, rowH - 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dfe8f0'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(id, x + cellW / 2 - 1, y + rowH / 2 + 1);
    if (i < r.nodes.length - 1) { ctx.strokeStyle = '#8fa2b8'; ctx.beginPath(); const nx = (i % cols === cols - 1) ? 2 : x + cellW - 4, ny = (i % cols === cols - 1) ? y + rowH + 2 : y + rowH / 2; ctx.moveTo(x + cellW - 2, y + rowH / 2); ctx.lineTo(nx + 2, ny); ctx.stroke(); }
  });
  const ty = rows * rowH + 12;
  ctx.fillStyle = '#9fb0c4'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`执行 ${r.ticks} 帧 · ${r.edges} 边 · ${r.stable ? '✓ 输出收敛' : '! 输出未收敛'}`, 2, ty);
  ctx.fillText(`末节点输出 ${r.trace?.map((v) => +v?.toFixed?.(2) ?? v).join(' → ') || '—'}`, 2, ty + 12);
}

export function mountFxWorkshop({ host, sideHost, request, openSource, status, sceneId, sceneLabel }) {
  const caps = describeFxCapabilities();
  const root = el('div', undefined, 'battle-side fx-side'), info = el('p', '扫描后这里显示舞台格网与候选图。', 'muted'), cv = el('canvas', '', 'fx-map');
  cv.style.cssText = 'width:100%;border-radius:6px;margin-top:6px';
  const note = el('p', '', 'muted');
  const hall = el('canvas', '', 'fx-hall-strip'); hall.style.cssText = 'width:100%;border-radius:4px;margin-top:4px;display:none'; hall.title = '走廊展开面（R38）：两面墙沿墙展开，白线 = 转角，深色 = 门洞';
  const replayTitle = el('p', '管线回放（fx.replay）：', 'muted fx-replay-title'); replayTitle.style.cssText = 'display:none;margin-top:6px';
  const replayCv = el('canvas', '', 'fx-replay-map'); replayCv.style.cssText = 'width:100%;border-radius:4px;display:none'; replayCv.title = 'fx.replay：当前管线步骤串成节点图并真执行，末节点逐帧输出';
  const liveNote = el('p', '实景能力（火 / 走廊 / 层带 / 弹道 / 尾迹泡沫）：执行后放进场景。', 'muted fx-live-note'); liveNote.id = 'fx-live-note';
  const camRow = el('div', undefined, 'fx-cam-row'); camRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
  const flyBtn = el('button', '✈ 镜头飞一圈'), stopBtn = el('button', '■ 停止并还原镜头'), camNote = el('p', 'fx.camera 的路径可以真实驱动游戏镜头：先 ▶ 执行出候选。', 'muted fx-cam-note');
  flyBtn.id = 'fx-camera-fly'; stopBtn.id = 'fx-camera-stop'; camNote.id = 'fx-camera-note'; flyBtn.type = stopBtn.type = 'button'; flyBtn.disabled = true;
  camRow.append(flyBtn, stopBtn);
  root.append(el('h4', '表现层'), info, cv, hall, replayTitle, replayCv, note, liveNote, camRow, camNote);
  let lastSite = null, lastPlan = null, camTimer = 0;
  const camPoll = () => { clearInterval(camTimer); camTimer = setInterval(async () => { const st = await request('fx.camera.state').catch(() => null); if (!st) return; camNote.textContent = st.flying ? `飞行中 ${Math.round(st.u * 100)}% · 镜头扫过 ${Math.round(Math.abs(st.sweep))}°（路径 ${Math.round(Math.abs(st.expected || 0))}°）` : st.done ? `飞完一圈：镜头扫过 ${Math.round(Math.abs(st.sweep))}°；点「停止并还原镜头」回到原机位` : camNote.textContent; if (!st.flying) clearInterval(camTimer); }, 400); };
  flyBtn.onclick = async () => { if (!lastPlan?.camera) return; const r = await request('fx.camera.fly', { id: sceneId?.(), plan: { camera: lastPlan.camera } }).catch((e) => ({ ok: false, reason: e.message })); if (!r?.ok) { camNote.textContent = '镜头飞行失败：' + (r?.reason || '未知'); return; } camNote.textContent = `起飞：${r.seconds}s · ${r.points} 个路径点 · 预期扫过 ${Math.round(Math.abs(r.expectedSweep))}°`; camPoll(); };
  stopBtn.onclick = async () => { clearInterval(camTimer); const r = await request('fx.camera.stop').catch((e) => ({ ok: false, reason: e.message })); camNote.textContent = r?.restored ? `已还原进入前的镜头（位置偏差 ${r.delta}）` : r?.ok ? '镜头没有被接管，无需还原' : '还原失败：' + (r?.reason || ''); };
  const view = mountTierWorkshop({
    host, sideHost, tier: 'fx', sideTier: 'fx', storageKey: 'fx', caps, openSource, status, autoPreload: true, sceneLabel: () => (typeof sceneLabel === 'function' ? sceneLabel() : '') || '',
    domains: [{ id: 'fx', name: '表现层' }],
    intro: '表现层管线：舞台格网 → 战役分区与前线 → 环绕镜头 → 船尾迹 → 装饰面板 → 小屋点火 → 走廊样板 → 崖面层带 → 箭雨弹道 → 回放图。复用战役扫描，不交战；候选画在同画布上并放进实景（火真的烧、镜头能飞一圈），采用只存本机草稿。',
    goalHint: '例如：画出岛屿分区与前线、绕场镜头路径',
    scopeText: () => (sceneLabel?.() || '') + ' · 舞台',
    agentConfig: {
      experienceKey: 'fx',
      transformUrl: new URL('./fx/transform-worker.js?v=fxe-r1', import.meta.url), verifyUrl: new URL('./fx/verify-worker.js?v=fxe-r1', import.meta.url),
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
        preview: async (c) => {
          lastPlan = c.run.plan; drawMap(cv, lastSite, c.run.plan, true); drawHallStrip(hall, c.run.plan?.hallway); flyBtn.disabled = !lastPlan?.camera?.path?.length;
          replayTitle.style.display = lastPlan?.replay ? '' : 'none'; drawReplay(replayCv, lastPlan?.replay);
          const r = await request('fx.preview', { id: sceneId?.(), plan: c.run.plan }).catch((e) => ({ ok: false, reason: e.message }));
          note.textContent = r.ok ? `候选（画布 + 实景叠加：${r.drawn}）` : '候选：分区色块 · 红线=前线 · 青线=镜头 · 白带=尾迹 · 橙=火 · 黄=弹道 · 褐=崖面层带 · 紫框=走廊样板（实景叠加未开：' + (r.reason || '') + '）';
          const lv = await request('fx.live.preview', { id: sceneId?.(), plan: c.run.plan }).catch((e) => ({ ok: false, reason: e.message }));
          const errs = lv?.errors && Object.keys(lv.errors).length ? '（出错：' + Object.entries(lv.errors).map(([k, v]) => k + ' ' + v).join('；') + '）' : '';
          liveNote.textContent = lv?.ok ? `实景能力：${lv.drawn}${errs}` : '实景能力没放进场景：' + (lv?.reason || '未知');
          if (lastPlan?.camera) camNote.textContent = '候选里有镜头路径：点「✈ 镜头飞一圈」让游戏镜头沿青线飞。';
          return { ok: true };
        },
        compare: (c, on) => { drawMap(cv, lastSite, on ? null : c.run.plan, !on); request('fx.compare', { on }).catch(() => {}); request('fx.live.compare', { on }).catch(() => {}); return Promise.resolve({ ok: true }); },
        revert: () => { if (lastSite) drawMap(cv, lastSite, null, false); drawHallStrip(hall, null); replayTitle.style.display = 'none'; drawReplay(replayCv, null); clearInterval(camTimer); lastPlan = null; flyBtn.disabled = true; request('fx.revert').catch(() => {}); request('fx.live.revert').then((r) => { liveNote.textContent = '实景能力已撤下' + (r?.camera?.restored ? '，镜头已还原' : ''); }).catch(() => {}); return Promise.resolve({ ok: true }); },
        commit: (c) => {
          const key = `tm.fx.plan.v1:${sceneId?.() || 'scene'}`;
          try { localStorage.setItem(key, JSON.stringify({ plan: c.run.plan, verify: c.verification?.status, at: Date.now() })); } catch {}
          request('fx.live.commit', { id: sceneId?.(), plan: c.run.plan }).catch(() => {});
          return Promise.resolve({ ok: true, note: `表现层草稿已存本机 ${key}（实景能力另存 tm.fx.live.v1:${sceneId?.() || 'scene'}；不改存档、不设默认）` });
        },
      },
    },
    preview: { root, scanNote: () => '' },
    actions: { commitLabel: '✓ 存为本机草稿', committed: (r) => r?.note || '草稿已存。' },
  });
  return view;
}
