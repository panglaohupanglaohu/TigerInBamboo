/**
 * arena-generic.js — 地形擂台的通用部件（Guide §1.4 创新 3，R41 起每嫁接一条线配一个考场）。纯逻辑，Node / 浏览器 / Worker 共用。
 *
 * 为什么单独写一份：高山圣城的擂台 mountain/arena.js 属于 R25–R28 那一组，本轮还在改，不能动它；这里做一份与具体层无关的，
 * 以后 mountain 层可以改用这份（同一套指标名：中等坡占比、竖崖占比、排水率、硬边位移）。
 *
 * 考场 = 固定种子的测试岛 arenaSite(20261123)：61×61 格、3 m 一格；高度取自悬垂地形的连续原值（overhang-terrain.js heightField，
 * 与原版 overhangterrain 同一套噪声），中间一块 5×7 的「城」（cls 1）+ 一条东西向「轨道」（cls 2）。
 * 指标只看产出的高度场与几何（与能力参数无关）：
 *   midSlope  中等坡占比   自由陆地格里最大四邻坡角在 14°–55° 的比例（软坡的证据）
 *   flat      可站平台占比 坡角 < 5° 的比例（台面的证据）
 *   cliff     竖崖占比     坡角 > 62° 的比例（硬崖的证据；圣城阈值 12% 是提示线，不是擂台规则）
 *   drainage  排水率       陆地格里有不上坡的路能到海 / 网格边的比例（river-valley.js drainShare）
 *   pits      坑           填洼会被抬起的格数（越少越好）
 *   hardEdge  硬边位移     保护格与相邻自由格之间的高差，相对原采样变了多少（米，均值；越小越好）
 *   overhang  悬垂         岩檐檐下面积 / 自由陆地面积
 *   reach     可走连通     最大可走连通片（坡 ≤ 35° + 梯子）占自由陆地比例
 *   climb     崖边攀爬率   2–9 m 的崖边对里，6 步（走一格 / 爬一把梯子）以内能从下面上去的比例
 *   contour   等高线在格边 等高线段落在格边上的比例（三遍那条线的证据；插值等高线 = 0）
 * 判定 judge：每条规则写明「要变好的指标」和「不许变差的指标 + 容差」，先定后量；新一代在所有守护指标上不差于上一代超过容差，
 * 且至少一项要变好的指标好过容差，才算赢。
 */
import { heightField } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js';
import { drainShare, pitCells, gridCells } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/river-valley.js';
import { depressionFill } from '../../../../townscaper-web/REACodeRefactoring/src/core/depression-fill.js';
import { walkComponents, climbShare } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/terrace-ladder.js';

export const ARENA_SEED = 20261123;
export const ARENA_N = 61;
export const ARENA_CELL = 3;
const land = (v) => Number.isFinite(v) && v > 0;

/** 固定种子的测试岛（米制高度 + 城 + 轨道）。同一个 seed 永远给同一座岛。 */
export function arenaSite(seed = ARENA_SEED, { n = ARENA_N, cell = ARENA_CELL } = {}) {
  const F = heightField(seed, { nx: n, ny: n }), h = new Array(n * n), cls = new Array(n * n).fill(0);
  for (let k = 0; k < n * n; k++) h[k] = F.land[k] < 0.12 ? null : +((F.raw[k] - 7.5) * 1.6).toFixed(4);
  const c = Math.floor(n / 2);
  for (let j = c - 2; j <= c + 2; j++) for (let i = c - 9; i <= c - 3; i++) if (land(h[j * n + i])) cls[j * n + i] = 1;        // 城
  for (let i = 0; i < n; i++) { const j = c + 8; if (land(h[j * n + i])) cls[j * n + i] = 2; }                                    // 轨道
  return { ok: true, scene: 'arena', label: `擂台岛 #${seed}`, n, cell, h, cls, seed, source: 'arena' };
}

/** 每格最大四邻坡角（度）；海格 = null */
export function slopeAngles(h, n, cell) {
  const out = new Array(n * n).fill(null);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; if (!land(h[k])) continue;
    let g = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) continue; const v = land(h[b * n + a]) ? h[b * n + a] : 0; g = Math.max(g, Math.abs(h[k] - v)); }
    out[k] = Math.atan(g / cell) * 180 / Math.PI;
  }
  return out;
}

/** 会被填洼抬起的格 id 列表（与 pitCells 同一判据，tol 默认 1e-6）。保护环内的原始微坑也在内，调用方按 lock 过滤。 */
export function pitIds(h, n, { tol = 1e-6 } = {}) {
  const cells = gridCells(n), heights = Float64Array.from(h, (v) => (land(v) ? v : 0));
  const { filled } = depressionFill(cells, heights), out = [];
  for (let id = 0; id < filled.length; id++) if (filled[id] - heights[id] > tol) out.push(id);
  return out;
}

/** 擂台指标（只看产出）。input = { n, cell, h, base?, cls?, lips?, ladders?, contours? } */
export function reliefMetrics({ n, cell = ARENA_CELL, h, base = null, cls = null, lips = [], ladders = [], contours = null }) {
  const H = h.map((v) => (land(v) ? v : NaN)), ang = slopeAngles(H, n, cell);
  let free = 0, mid = 0, flat = 0, cliff = 0;
  for (let k = 0; k < n * n; k++) { if (ang[k] == null || cls?.[k]) continue; free++; const a = ang[k]; if (a >= 14 && a <= 55) mid++; if (a < 5) flat++; if (a > 62) cliff++; }
  let edge = 0, edges = 0;
  if (base && cls) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i; if (!cls[a] || !land(H[a])) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= n || y >= n) continue; const b = y * n + x; if (cls[b] || !land(H[b]) || !land(base[b]) || !land(base[a])) continue; edges++; edge += Math.abs((H[b] - H[a]) - (base[b] - base[a])); }
  }
  const blocked = cls ? Uint8Array.from(cls, (c) => (c ? 1 : 0)) : null, w = walkComponents(H, n, { cell, walkSlope: 35, blocked, links: (ladders || []).map((l) => [l.a, l.b]) });
  const soffit = (lips || []).reduce((s, l) => s + (l.reach || 0) * cell * cell, 0);
  const r4 = (x) => +x.toFixed(4);
  return {
    free, midSlope: free ? r4(mid / free) : 0, flat: free ? r4(flat / free) : 0, cliff: free ? r4(cliff / free) : 0,
    drainage: r4(drainShare(H, n)), pits: pitCells(H, n), hardEdge: edges ? r4(edge / edges) : 0,
    overhang: free ? r4(soffit / (free * cell * cell)) : 0, reach: r4(w.share), climb: r4(climbShare(H, n, { cell, walkSlope: 35, blocked, links: (ladders || []).map((l) => [l.a, l.b]) }).share), contour: contours ? r4(contours.onGrid ?? 0) : 0,
  };
}

/**
 * 判定：rule = { better: [{ key, dir: +1 越大越好 | −1 越小越好, tol }], guard: [{ key, dir, tol }] }。
 * 返回 { pass, rows:[{ key, prev, next, delta, role, ok, better }], why }。
 */
export function judge(prev, next, rule) {
  const rows = [], worse = [], better = [];
  for (const g of rule.guard || []) {
    const d = (next[g.key] - prev[g.key]) * g.dir, ok = d >= -g.tol;
    rows.push({ key: g.key, prev: prev[g.key], next: next[g.key], delta: +(next[g.key] - prev[g.key]).toFixed(4), role: 'guard', tol: g.tol, ok });
    if (!ok) worse.push(g.key);
  }
  for (const b of rule.better || []) {
    const d = (next[b.key] - prev[b.key]) * b.dir, good = d > b.tol;
    rows.push({ key: b.key, prev: prev[b.key], next: next[b.key], delta: +(next[b.key] - prev[b.key]).toFixed(4), role: 'better', tol: b.tol, ok: good || d >= -b.tol, better: good });
    if (good) better.push(b.key);
    else if (d < -b.tol) worse.push(b.key);
  }
  const pass = !worse.length && better.length > 0;
  return { pass, rows, why: pass ? `赢：${better.join('、')} 变好，守护指标都没退步` : worse.length ? `没赢：${worse.join('、')} 退步超过容差` : '没赢：要变好的指标都没好过容差' };
}

export const METRIC_NAMES = Object.freeze({ midSlope: '中等坡占比', flat: '可站平台占比', cliff: '竖崖占比', drainage: '排水率', pits: '坑（格）', hardEdge: '硬边位移（m）', overhang: '悬垂（檐下面积占比）', reach: '最大可走连通', climb: '崖边攀爬率', contour: '等高线在格边' });
