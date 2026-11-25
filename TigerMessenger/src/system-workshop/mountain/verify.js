/** 山形管线 · 独立验证（纯数据）。不信任改造 Worker 的中间状态：只拿原始采样 field 和产出 plan 重算。 */
import { protectMask, SEA } from './capabilities.js?v=mountain-r26t';
import { auditGround } from './ground.js?v=ground-r25';
/** 山形指标：自由陆地上的坡度分布与峰高。平顶 / 竖崖多 = 方台；中等坡多、有主峰 = 山。 */
export function shapeStats(h, n, step, mask) {
  let cnt = 0, flat = 0, mid = 0, cliff = 0, top = -Infinity; const hs = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const q = j * n + i; if (!mask(q)) continue; const v = [h[q - 1], h[q + 1], h[q - n], h[q + n]]; if (v.some((x) => x == null) || h[q] == null) continue;
    const s = Math.atan(Math.hypot((v[1] - v[0]) / (2 * step), (v[3] - v[2]) / (2 * step))) * 180 / Math.PI;
    cnt++; if (s < 6) flat++; else if (s > 62) cliff++; else if (s >= 14 && s <= 55) mid++; hs.push(h[q]); top = Math.max(top, h[q]);
  }
  hs.sort((a, b) => a - b); const med = hs.length ? hs[hs.length >> 1] : 0;
  return { cells: cnt, flat: cnt ? flat / cnt : 0, mid: cnt ? mid / cnt : 0, cliff: cnt ? cliff / cnt : 0, top: cnt ? top : 0, prominence: cnt ? top - med : 0 };
}
export function verifyMountain(field, plan, { steps = [] } = {}) {
  const checks = [], add = (id, name, status, detail, blame) => checks.push({ id, name, status, detail, blame: blame || [] });
  const fin = (extra = {}) => { const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass'; return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' '), ...extra }; };
  const N = field?.n * field?.n;
  if (!field || !plan || !Array.isArray(plan.h) || plan.h.length !== N) { add('plan', '山形计划', 'fail', '没有与采样网格一致的山形计划', steps.map((s) => s.id)); return fin(); }
  const { n, step } = field, h0 = field.h, h = plan.h, land = (q) => h0[q] != null && h0[q] > SEA;
  const F = { n, N, step, cls: field.cls, land: Uint8Array.from({ length: N }, (_, q) => (land(q) ? 1 : 0)) }, P = plan.protect || { band: 6, railBand: 8 }, { keep, railDist } = protectMask(F, P.band, P.railBand);
  let worst = 0, flips = 0, railDiff = 0, railCells = 0, wall = 0, wallAt = 0, nan = 0;
  for (let q = 0; q < N; q++) {
    if ((h[q] == null) !== (h0[q] == null)) { nan++; continue; } if (h[q] == null) continue;
    if (keep[q]) worst = Math.max(worst, Math.abs(h[q] - h0[q]));
    if (land(q) !== (h[q] > SEA)) flips++;
    if (field.cls[q] === 2) { railCells++; railDiff = Math.max(railDiff, Math.abs(h[q] - h0[q])); }
    else if (railDist[q] < 24) { const over = h[q] - h0[q] - 1.6 * railDist[q]; if (over > wall) { wall = over; wallAt = q; } }
  }
  add('protected', '建筑与保护带不动', worst <= 0.011 && !nan ? 'pass' : 'fail', `保护区最大高差 ${worst.toFixed(2)} m${nan ? ` · ${nan} 格地形有无被改` : ''}`, ['mountain.protect']);
  add('rail', '轨道净空保留', railDiff <= 0.011 && wall <= 0.5 ? 'pass' : 'fail', `轨道 ${railCells} 格下方地形高差 ${railDiff.toFixed(2)} m · 轨旁 24 m 内新增山体超出 1.6 坡比包络 ${wall.toFixed(1)} m`, ['mountain.protect', 'mountain.massif']);
  add('shore', '海岸线不变', flips === 0 ? 'pass' : 'fail', flips ? `${flips} 格陆地 / 海发生翻转` : '陆地与海的格子没有翻转', ['mountain.talus', 'mountain.erode']);
  const free = (q) => !keep[q], before = shapeStats(h0, n, step, free), after = shapeStats(h, n, step, free), pc = (v) => Math.round(v * 100) + '%';
  add('peak', '有主峰', after.prominence >= 14 ? 'pass' : after.prominence >= 8 ? 'warn' : 'fail', `峰顶高出可塑陆地中位 ${after.prominence.toFixed(1)} m（原 ${before.prominence.toFixed(1)} m）· 最高 ${after.top.toFixed(1)} m`, ['mountain.massif']);
  add('slopes', '山坡而非方台', after.mid >= 0.45 && after.flat <= 0.3 ? 'pass' : after.mid >= 0.3 ? 'warn' : 'fail', `中等坡 ${pc(after.mid)}（原 ${pc(before.mid)}）· 平顶 ${pc(after.flat)}（原 ${pc(before.flat)}）`, ['mountain.massif', 'mountain.talus']);
  add('cliffs', '竖崖占比', after.cliff <= 0.12 ? 'pass' : after.cliff <= 0.2 ? 'warn' : 'fail', `>62° 竖崖 ${pc(after.cliff)}（原 ${pc(before.cliff)}）`, ['mountain.talus']);
  const tris = (n - 1) * (n - 1) * 2; add('budget', '面数预算', tris <= 90000 ? 'pass' : 'warn', `${tris} 个三角面（low poly 预算 9 万）`, ['mountain.lowpoly']);
  add('surface', '着色数据完整', plan.mat?.length === tris && plan.shade?.length === tris ? 'pass' : 'fail', plan.mat?.length === tris ? '每个三角面都有材质与烘焙明暗' : '材质 / 明暗数组与面数不一致', ['mountain.lowpoly']);
  // R25 玩家地面：碰撞用的地面高度查询从山形计划重建（mountain/ground.js），与画面同一张三角面；轨道 / 保护区处地面 = 原高
  const { checks: gc, audit: G } = verifyGround(field, plan, { keep }); checks.push(...gc);
  return fin({ metrics: { before, after, ground: G } });
}

/**
 * R25 玩家地面复检。ground 缺省 = 从 plan 重建（mountain/ground.js）；传入别的 ground（例如游戏里正在用的那一份、或故意弄坏的）就审它。
 * 地面必须与画面同一张三角面（重心差 ≤ 0.01 m、没有洞），轨道 / 保护区处地面 = 原高（≤ 0.011 m）——否则 fail。
 * 「山上能走」只给 warn：坡度 ≤ 45° 的自由陆地 ≥ 70%，且最大连通片 ≥ 60%。
 */
export function verifyGround(field, plan, { ground, keep } = {}) {
  if (!keep) { const n = field.n, N = n * n, F = { n, N, step: field.step, cls: field.cls, land: Uint8Array.from({ length: N }, (_, q) => (field.h[q] != null && field.h[q] > SEA ? 1 : 0)) }, P = plan.protect || { band: 6, railBand: 8 }; keep = protectMask(F, P.band, P.railBand).keep; }
  const G = auditGround(field, plan, { keep, ground }), pc = (v) => Math.round(v * 100) + '%';
  const checks = [
    { id: 'ground', name: '玩家地面与山形一致', status: G.holes === 0 && G.maxErr <= 0.01 && G.railDiff <= 0.011 && G.keepDiff <= 0.011 ? 'pass' : 'fail',
      detail: `${G.tris} 个三角重心复查：地面与画面最大差 ${G.maxErr.toFixed(3)} m · 洞 ${G.holes} 个 · 轨道 ${G.railCells} 格地面高差 ${G.railDiff.toFixed(2)} m · 保护区 ${G.keepCells} 格 ${G.keepDiff.toFixed(2)} m`, blame: ['mountain.lowpoly', 'mountain.protect'] },
    { id: 'walk', name: '山上能走', status: G.walkShare >= 0.7 && G.walkConnected >= 0.6 ? 'pass' : 'warn',
      detail: `自由陆地 ≤${G.maxSlope}° 可走坡 ${pc(G.walkShare)} · 最大连通片 ${pc(G.walkConnected)}`, blame: ['mountain.talus', 'mountain.rolling'] },
  ];
  return { checks, audit: G, status: checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass' };
}
