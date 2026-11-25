/**
 * panel-model.js — 地貌管线面板的纯逻辑（R41 / R47 / R49；Node 测试与浏览器共用，不碰 DOM）。
 *   thumbPixels  采样 / 候选 → 俯视晕渲图 RGBA（河蓝、湖浅蓝、岩檐深色、梯子棕、等高线黄、保护格灰）
 *   evidenceRows 对照登记 + 擂台登记 → 每个能力一行（④ 等价 / ⑦ 擂台 现在在哪一步：未登记 / 已登记待实算 / 已实算）
 *   directEntry  网址 ?relief=<场景> → 直达哪个场景（只认 RELIEF 场景表里的 id）
 */
export const RELIEF_IDS = Object.freeze(['relief.soft', 'relief.cliff', 'relief.valley', 'relief.overhang', 'relief.ledge', 'relief.passes']);
export const RELIEF_SCENE_IDS = Object.freeze(['old-port', 'moss']);
export const SCENE_LABEL = Object.freeze({ 'old-port': '旧港湾', moss: '苔庭', arena: '擂台岛' });
const land = (v) => Number.isFinite(v) && v > 0;

export function directEntry(search = '') {
  let q; try { q = new URLSearchParams(search); } catch { return null; }
  const v = q.get('relief'); if (v == null) return null;
  if (v === '' || v === '1') return { scene: 'old-port', mode: 'game' };
  if (v === 'arena') return { scene: 'arena', mode: 'arena' };
  return RELIEF_SCENE_IDS.includes(v) ? { scene: v, mode: 'game' } : null;
}

/** 俯视晕渲：scale 像素 / 格。show = { rivers, lips, ladders, contours } */
export function thumbPixels(site, plan = null, { scale = 3, show = { rivers: true, lips: true, ladders: true, contours: true } } = {}) {
  const n = site.n, W = n * scale, px = new Uint8ClampedArray(W * W * 4), h = (plan ? plan.h : site.h).map((v) => (land(v) ? v : NaN));
  let max = 1; for (const v of h) if (v > max) max = v;
  const riv = new Set(plan?.valley?.river || []), lake = new Set(plan?.valley?.lakes || []);
  const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= W) return; const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, v = h[k]; let rgb;
    if (!land(v)) rgb = [28, 52, 70];
    else {
      const e = land(h[k + 1]) && i + 1 < n ? h[k + 1] : v, s = land(h[k + n]) && j + 1 < n ? h[k + n] : v, lit = Math.max(0.35, Math.min(1.2, 0.85 + (v - e) * 0.08 + (v - s) * 0.08)), t = v / max;
      rgb = [Math.round((96 + 70 * t) * lit), Math.round((130 + 40 * t) * lit), Math.round((72 + 50 * t) * lit)];
      if (site.cls?.[k]) rgb = [150, 146, 136];
      if (show.rivers && lake.has(k)) rgb = [108, 160, 190];
      if (show.rivers && riv.has(k)) rgb = [70, 130, 175];
    }
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) put(i * scale + x, j * scale + y, ...rgb);
  }
  if (plan && show.contours && plan.contours) for (const [x0, y0, x1, y1] of plan.contours.segs) {
    const X0 = x0 * scale, Y0 = y0 * scale, X1 = x1 * scale, Y1 = y1 * scale;
    for (let t = 0; t <= scale; t++) put(Math.round(X0 + (X1 - X0) * t / scale), Math.round(Y0 + (Y1 - Y0) * t / scale), 214, 178, 60);
  }
  if (plan && show.lips) for (const l of plan.lips || []) { const cx = l.i * scale + Math.floor(scale / 2) + l.di * Math.ceil(scale / 2), cy = l.j * scale + Math.floor(scale / 2) + l.dj * Math.ceil(scale / 2); for (let d = -1; d <= 1; d++) put(cx + (l.dj ? d : 0), cy + (l.di ? d : 0), 40, 34, 28); }
  if (plan && show.ladders) for (const l of plan.ladders || []) { const a = [l.a % n, Math.floor(l.a / n)], b = [l.b % n, Math.floor(l.b / n)]; for (let t = 0; t <= 4; t++) put(Math.round((a[0] + (b[0] - a[0]) * t / 4) * scale + scale / 2), Math.round((a[1] + (b[1] - a[1]) * t / 4) * scale + scale / 2), 150, 92, 40); }
  return { width: W, height: W, data: px };
}

/** 每个地貌能力的证据状态。parity / arena：{ [id]: 登记表 JSON 或 null } */
export function evidenceRows(parity = {}, arena = {}, ids = RELIEF_IDS) {
  return ids.map((id) => {
    const p = parity[id], a = arena[id];
    const pState = !p ? 'missing' : p.verdict ? 'measured' : 'registered', aState = !a ? 'missing' : a.pass === true ? 'won' : a.pass === false ? 'lost' : 'registered';
    return { id, parity: pState, parityText: { missing: '没有对照登记', registered: `已登记 ${p?.diffs?.length || 0} 条差异，待实算`, measured: p?.verdict === 'equivalent' ? '行为等价（已实算）' : `差异已登记（已实算，${p?.diffs?.length || 0} 条）` }[pState],
      arena: aState, arenaText: { missing: '没有擂台登记', registered: '规则已登记，待实算', won: `赢了上一代（${a?.beat || '—'}）`, lost: `没赢：${a?.judge?.why || ''}` }[aState],
      original: p?.original || null, level4: pState === 'measured', level7: aState === 'won' };
  });
}
