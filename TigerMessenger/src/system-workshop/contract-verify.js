/**
 * contract-verify.js — R52 验证检查项从契约的 preserves 自动生成（Guide 创新 2：「验证 Worker 的检查项直接从『保证不动什么』生成，不会漏」）。
 * 纯函数，Worker 安全。各层 verify.js 调 verifyPreserves(契约里的 preserves 并集, ctx) 拿到通用检查，再加本层自己的检查。
 *
 * ctx（缺哪项就只做能做的；一项数据都没有的检查给 warn「没有可比数据」，绝不给 pass）：
 *   field    改造前的高度场 { n, step, h[n*n], cls[n*n]（0 地形 1 建筑 2 轨道）, sea? }
 *   after    { h?: 改造后的高度（与 field.h 等长），footprint?: { building:[采样格下标], road:[采样格下标] } }
 *   band / railBand  建筑保护带 / 轨道保护带（米），默认 4 / 6
 *   sceneId  场景 id；storageWrites 改造过程声明写过的本机存储键（Worker 里没有 localStorage，通常为空）
 */
import { PRESERVES } from './contracts.js?v=contract-r1';

export const PROTECTED_STORAGE = [/^tm\.crystalCity\.layout/, /^tm\.citadel/, /^tm\.morris/, /^tm\.lake/, /^tm\.scene\.save/, /^tm\.save/];
const LAKE_SCENES = new Set(['morris-lake', 'morris', 'lake']);

function chamfer(n, step, isSrc) {
  const d = new Float64Array(n * n).fill(Infinity);
  for (let q = 0; q < n * n; q++) if (isSrc(q)) d[q] = 0;
  const pass = (i, j, a, b, w) => { const x = i + a, z = j + b; if (x >= 0 && z >= 0 && x < n && z < n) { const v = d[z * n + x] + w * step; if (v < d[j * n + i]) d[j * n + i] = v; } };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pass(i, j, -1, 0, 1); pass(i, j, 0, -1, 1); pass(i, j, -1, -1, 1.414); pass(i, j, 1, -1, 1.414); }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { pass(i, j, 1, 0, 1); pass(i, j, 0, 1, 1); pass(i, j, 1, 1, 1.414); pass(i, j, -1, 1, 1.414); }
  return d;
}
const fin = (v) => v != null && Number.isFinite(v);
const okField = (f) => f && Number.isInteger(f.n) && f.h?.length === f.n * f.n && f.cls?.length === f.n * f.n;

/** 一组格子里：落进去的建筑 / 路 采样格数、高度改了的格数（|Δh| > 0.01 m）。 */
function inspect(ctx, inZone) {
  const { field, after } = ctx, N = field.n * field.n, fp = after?.footprint, hasH = Array.isArray(after?.h) || ArrayBuffer.isView(after?.h);
  let zone = 0, hit = 0, moved = 0, maxD = 0;
  for (let q = 0; q < N; q++) if (inZone(q)) { zone++; if (hasH && fin(field.h[q])) { const d = Math.abs((after.h[q] ?? field.h[q]) - field.h[q]); if (d > 0.01) { moved++; maxD = Math.max(maxD, d); } } }
  if (fp) for (const q of [...(fp.building || []), ...(fp.road || [])]) if (inZone(q)) hit++;
  return { zone, hit, moved, maxD, hasH, hasFp: !!fp };
}
function zoneCheck(ctx, inZone, what) {
  if (!okField(ctx.field)) return { status: 'warn', detail: '没有高度场，无法检查' };
  const r = inspect(ctx, inZone);
  if (!r.hasH && !r.hasFp) return { status: 'warn', detail: '没有可比数据（候选既没改高度也没有足迹）' };
  const bad = [];
  if (r.hit) bad.push(`候选落进${what} ${r.hit} 个采样格`);
  if (r.moved) bad.push(`${what}里 ${r.moved} 格高度变了（最大 ${r.maxD.toFixed(2)} m）`);
  return bad.length ? { status: 'fail', detail: bad.join('；') } : { status: 'pass', detail: `${what} ${r.zone} 格：${r.hasFp ? '无落点' : ''}${r.hasFp && r.hasH ? '、' : ''}${r.hasH ? '高度不变' : ''}` };
}

/** 每个保护项一个检查器。返回 { status, detail }。 */
export const PRESERVE_CHECKS = Object.freeze({
  userBuildings: (ctx) => zoneCheck(ctx, (q) => ctx.field.cls[q] === 1, '已有建筑格'),
  buildingBuffer: (ctx) => { if (!okField(ctx.field)) return { status: 'warn', detail: '没有高度场，无法检查' }; const band = ctx.band ?? 4, d = (ctx._dB ||= chamfer(ctx.field.n, ctx.field.step, (q) => ctx.field.cls[q] === 1)); return zoneCheck(ctx, (q) => d[q] < band, `建筑保护带（${band} m）`); },
  railClearance: (ctx) => { if (!okField(ctx.field)) return { status: 'warn', detail: '没有高度场，无法检查' }; const band = ctx.railBand ?? 6, d = (ctx._dR ||= chamfer(ctx.field.n, ctx.field.step, (q) => ctx.field.cls[q] === 2)); return zoneCheck(ctx, (q) => d[q] < band, `轨道净空（${band} m）`); },
  coastline: (ctx) => {
    if (!okField(ctx.field)) return { status: 'warn', detail: '没有高度场，无法检查' };
    const { field, after } = ctx, sea = field.sea ?? 0.3, N = field.n * field.n, land = (v) => fin(v) && v > sea; let flips = 0, onSea = 0;
    const hasH = Array.isArray(after?.h) || ArrayBuffer.isView(after?.h), fp = after?.footprint;
    if (!hasH && !fp) return { status: 'warn', detail: '没有可比数据' };
    if (hasH) for (let q = 0; q < N; q++) if (land(field.h[q]) !== land(after.h[q] ?? field.h[q])) flips++;
    if (fp) for (const q of [...(fp.building || []), ...(fp.road || [])]) if (!land(field.h[q])) onSea++;
    return flips || onSea ? { status: 'fail', detail: [flips && `${flips} 格陆 / 海翻转`, onSea && `${onSea} 个落点在海上`].filter(Boolean).join('；') } : { status: 'pass', detail: `海平面 ${sea} m：陆 / 海不变${fp ? '，落点都在陆上' : ''}` };
  },
  userSaves: (ctx) => {
    const w = (ctx.storageWrites || []).filter((k) => PROTECTED_STORAGE.some((re) => re.test(k)));
    if (w.length) return { status: 'fail', detail: '写了用户存档：' + w.join('、') };
    return { status: 'pass', detail: (ctx.storageWrites || []).length ? `只写了 ${ctx.storageWrites.join('、')}` : '改造 / 验证都在 Worker 里（没有 localStorage），不写存档；采用只写候选记录' };
  },
  lakeBuildings: (ctx) => {
    const fp = ctx.after?.footprint, n = fp ? (fp.building || []).length + (fp.road || []).length : 0;
    if (LAKE_SCENES.has(String(ctx.sceneId || ''))) return n ? { status: 'fail', detail: `在莫西斯湖上放了 ${n} 个落点` } : { status: 'pass', detail: '莫西斯湖：没有落点' };
    return { status: 'pass', detail: `场景 ${ctx.sceneId || '?'} 不是莫西斯湖` };
  },
  originalTerrain: (ctx) => {
    const hasH = Array.isArray(ctx.after?.h) || ArrayBuffer.isView(ctx.after?.h);
    return hasH ? { status: 'warn', detail: '候选给出了新地形高度：原地形网格只能隐藏、放弃时恢复，由预览层保证（本检查不能代替实景对照）' } : { status: 'pass', detail: '候选不改地形高度' };
  },
  sceneAnchors: (ctx) => {
    const anchors = ctx.after?.anchors || ctx.anchors, sea = ctx.seaLevel ?? ctx.after?.seaLevel ?? ctx.sea;
    if (!Array.isArray(anchors) || !anchors.length) return { status: 'warn', detail: '没有场景锚点数据' };
    if (!fin(sea)) return { status: 'warn', detail: '没有海平面数据，无法判断锚点是否被淹' };
    const drowned = anchors.filter((a) => a && a.water !== true && fin(a.height ?? a.y ?? a.h) && (a.height ?? a.y ?? a.h) <= sea);
    return drowned.length ? { status: 'fail', detail: `场景锚点被海淹没：${drowned.map((a) => a.id || a.name || JSON.stringify(a)).slice(0, 4).join('、')}${drowned.length > 4 ? ` 等 ${drowned.length} 个` : ''}（海平面 ${sea}）` } : { status: 'pass', detail: `${anchors.length} 个场景锚点都在海平面 ${sea} 之上` };
  },
  lockedObjects: (ctx) => {
    const moved = ctx.lockedMoved ?? ctx.after?.lockedMoved;
    if (fin(moved)) return moved > 0 ? { status: 'fail', detail: `${moved} 个手工锁定物件被移动` } : { status: 'pass', detail: '手工锁定物件都没动' };
    const before = ctx.objects || ctx.before?.objects, after = ctx.after?.objects;
    if (Array.isArray(before) && Array.isArray(after)) {
      const b = new Map(before.map((o) => [o.id, o])), bad = after.filter((o) => b.has(o.id) && b.get(o.id).locked && (o.x !== b.get(o.id).x || o.z !== b.get(o.id).z || o.y !== b.get(o.id).y)).length;
      if (bad) return { status: 'fail', detail: `${bad} 个手工锁定物件被移动` };
      return { status: 'pass', detail: '手工锁定物件位置不变' };
    }
    return { status: 'warn', detail: '没有锁定物件的前后对比数据' };
  },
});

/** 契约 preserves → 生成的检查清单（页面显示「会查什么」用，不跑检查）。 */
export function checksFromPreserves(preserves) {
  return [...new Set(preserves || [])].map((k) => ({ id: 'preserve.' + k, key: k, name: PRESERVES[k] || k, generic: !!PRESERVE_CHECKS[k] }));
}

/** 跑检查。blameOf(key) → 该保护项该怪哪些能力（契约里声明了它的能力 id）。 */
export function verifyPreserves(preserves, ctx = {}, { blameOf = () => [] } = {}) {
  const c = { ...ctx };
  return checksFromPreserves(preserves).map((x) => {
    let r;
    if (!x.generic) r = { status: 'warn', detail: '通用验证器没有这一项的检查器，需要本层 verify 自己查' };
    else { try { r = PRESERVE_CHECKS[x.key](c); } catch (e) { r = { status: 'fail', detail: '检查出错：' + e.message }; } }
    return { id: x.id, name: '契约 · ' + x.name, status: r.status, detail: r.detail, blame: r.status === 'fail' ? blameOf(x.key) : [], generated: true };
  });
}

/** 一组步骤的 preserves 并集与「该怪谁」。contracts = contractOf 的结果数组。 */
export function preservesOfSteps(contracts, stepIds) {
  const set = new Set(stepIds), keys = new Set(), who = new Map();
  for (const c of contracts) if (set.has(c.id)) for (const p of c.preserves) { keys.add(p); if (!who.has(p)) who.set(p, []); who.get(p).push(c.id); }
  return { preserves: [...keys], blameOf: (k) => who.get(k) || [] };
}
