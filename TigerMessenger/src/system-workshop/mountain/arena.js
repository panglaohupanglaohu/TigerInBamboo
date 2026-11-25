/**
 * R26 地形线第一个擂台（Guide §1.4 创新 3）：固定种子的测试岛 + 一组和输入参数无关的指标 + 固定比较规则。
 * 纯数据（Node / Worker 共用）。登记表：src/scene-authoring/catalog/arena/terrain.json（每一代的成绩）。
 *
 * 指标（都只看产出的高度场 h 与原高 h0、掩码，不看任何能力参数）：
 *   mid      中等坡占比  自由陆地格里坡度 14°–55° 的比例（与 verify.shapeStats 同一定义）            越高越好
 *   cliff    竖崖占比    自由陆地格里坡度 > 62° 的比例（同上）                                      越低越好
 *   drain    排水率      自由陆地格沿 D8 最陡下降（严格下降）一路走，能走到海（无地形 / ≤ 海面）或网格边的比例；
 *                       停在陆地上的洼地或平台 = 排不出去（方台顶、闭合洼地都算）                   越高越好
 *   hardEdge 硬边位移    紧贴保护区（建筑 / 轨道 / 海岸带）的第一圈自由格，与相邻保护格的高差相对原样变了多少（米，均值）：
 *                       |(h[a] − h[b]) − (h0[a] − h0[b])|；保护区原样不动，所以这是「硬边被推开 / 起台阶」的量  越低越好
 * 比较规则（写死，不按结果调）：新一代对上一代必须「不差且至少一项更好」——
 *   mid ≥ 上一代 − 0.005，cliff ≤ 上一代 + 0.005，drain ≥ 上一代 − 0.005，hardEdge ≤ 上一代 + 0.05 m；
 *   并且至少一项好过上一代超过同样的容差。任何一项退步超过容差 = 没赢。
 */
import { runPlan, protectMask, SEA, MOUNTAIN_CAPABILITIES } from './capabilities.js?v=mountain-r26t';
import { shapeStats } from './verify.js?v=mountain-r25';
import { rng32 } from './evolve.js?v=evolve-r25';

export const ARENA_VERSION = 1;
export const ARENA_SEED = 20261123;
export const ARENA_TOLERANCE = { mid: 0.005, cliff: 0.005, drain: 0.005, hardEdge: 0.05 };
export const ARENA_BETTER = { mid: 'higher', cliff: 'lower', drain: 'higher', hardEdge: 'lower' };
export const ARENA_LABELS = { mid: '中等坡占比', cliff: '竖崖占比', drain: '排水率', hardEdge: '硬边位移（米）' };

/** 固定种子测试岛：101×101 格、3 米一格（和高山圣城采样同尺寸）；6 米一级的方台阶岛 + 一片城（建筑）+ 一条轨道。 */
export function arenaIsland(seed = ARENA_SEED) {
  const n = 101, step = 3, c = 50, r = rng32(seed), G = 9, grid = Array.from({ length: G * G }, () => r()), grid2 = Array.from({ length: G * G }, () => r());
  const noise = (g, i, j) => { const x = i / (n - 1) * (G - 1), z = j / (n - 1) * (G - 1), x0 = Math.min(G - 2, Math.floor(x)), z0 = Math.min(G - 2, Math.floor(z)), fx = x - x0, fz = z - z0;
    const v = (a, b) => g[b * G + a]; return v(x0, z0) * (1 - fx) * (1 - fz) + v(x0 + 1, z0) * fx * (1 - fz) + v(x0, z0 + 1) * (1 - fx) * fz + v(x0 + 1, z0 + 1) * fx * fz; };
  const h = [], cls = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = Math.hypot(i - c, j - c) * step, R = 118 + (noise(grid, i, j) - 0.5) * 44;
    let v; if (d > R + 9) v = null; else if (d > R) v = -1; else { const base = Math.min(54, (R - d) * 0.62 * (0.55 + 0.9 * noise(grid2, i, j))); v = Math.floor(base / 6) * 6 + 2; }
    h.push(v);
    const town = Math.hypot(i - (c + 13), j - (c - 9)) < 7, rail = j === c + 17 && i > c - 36 && i < c + 30;
    cls.push(v != null && v > SEA && town ? 1 : v != null && v > SEA && rail ? 2 : 0);
  }
  return { n, step, h, cls, railY: [] };
}

/** 擂台上的各代（地形线 · 山形管线）。上一代 = mountain.rolling 出现之前的管线（2026-11-22 之前：隆起 → 侵蚀 → 岩屑坡 → 着色）。 */
export const ARENA_GENERATIONS = [
  { id: 'terrain.mountain.g1', label: '上一代：隆起 + 侵蚀 + 岩屑坡', steps: ['mountain.protect', 'mountain.massif', 'mountain.erode', 'mountain.talus', 'mountain.lowpoly'] },
  { id: 'terrain.mountain.g2', label: '这一代：+ 连绵圆润（mountain.rolling）', steps: ['mountain.protect', 'mountain.massif', 'mountain.erode', 'mountain.rolling', 'mountain.talus', 'mountain.lowpoly'] },
];

/** 四项指标（只看产出）。field = 原始采样（h0），plan = 产出（plan.h、plan.protect）。 */
export function terrainMetrics(field, plan) {
  const { n, step } = field, N = n * n, h0 = field.h, h = plan.h, land = (q) => h0[q] != null && h0[q] > SEA;
  const F = { n, N, step, cls: field.cls, land: Uint8Array.from({ length: N }, (_, q) => (land(q) ? 1 : 0)) }, P = plan.protect || { band: 6, railBand: 8 }, { keep } = protectMask(F, P.band, P.railBand);
  const free = (q) => !keep[q] && land(q), s = shapeStats(h, n, step, free);
  // 排水率：D8 严格下降；出口 = 无地形 / ≤ 海面 / 网格边
  const out = new Int8Array(N).fill(-1), next = new Int32Array(N).fill(-1);
  const dirs = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i; if (h[q] == null || h[q] <= SEA) { out[q] = 1; continue; } if (i === 0 || j === 0 || i === n - 1 || j === n - 1) { out[q] = 1; continue; }
    let best = 0, to = -1; for (const [a, b, w] of dirs) { const p = (j + b) * n + i + a, hp = h[p] == null ? -Infinity : h[p], g = (h[q] - hp) / w; if (g > best + 1e-12) { best = g; to = p; } }
    if (to < 0) out[q] = 0; else next[q] = to;
  }
  const resolve = (q) => { const path = []; while (out[q] < 0) { path.push(q); q = next[q]; } for (const p of path) out[p] = out[q]; return out[q]; };
  let cells = 0, drained = 0; for (let q = 0; q < N; q++) if (free(q)) { cells++; if (resolve(q) === 1) drained++; }
  // 硬边位移：自由格 a 与 4 邻保护陆地格 b
  let pairs = 0, shift = 0;
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const a = j * n + i; if (!free(a) || h[a] == null) continue;
    for (const b of [a - 1, a + 1, a - n, a + n]) { if (!keep[b] || !land(b) || h[b] == null) continue; pairs++; shift += Math.abs((h[a] - h[b]) - (h0[a] - h0[b])); } }
  const r4 = (v) => Math.round(v * 10000) / 10000;
  return { mid: r4(s.mid), cliff: r4(s.cliff), drain: r4(cells ? drained / cells : 0), hardEdge: r4(pairs ? shift / pairs : 0), cells, edgePairs: pairs, prominence: r4(s.prominence), top: r4(s.top) };
}

/** 在擂台上跑一代（默认参数），返回指标 */
export function runArenaGeneration(gen, field = arenaIsland()) {
  const site = { field: structuredClone(field) };
  runPlan(site, gen.steps.map((id) => ({ id })));
  return { id: gen.id, label: gen.label, steps: gen.steps, metrics: terrainMetrics(field, site.plan), plan: site.plan };
}

/** 比较规则（见文件头）。返回每项判定与总判定，文字直接写进页面和测试信息。 */
export function compareGenerations(prev, cur, tol = ARENA_TOLERANCE) {
  const rows = Object.keys(ARENA_BETTER).map((k) => {
    const d = ARENA_BETTER[k] === 'higher' ? cur[k] - prev[k] : prev[k] - cur[k];   // d > 0 = 这一代更好
    return { key: k, label: ARENA_LABELS[k], prev: prev[k], cur: cur[k], better: ARENA_BETTER[k], gain: Math.round(d * 10000) / 10000, verdict: d > tol[k] ? 'better' : d < -tol[k] ? 'worse' : 'same' };
  });
  const worse = rows.filter((r) => r.verdict === 'worse'), better = rows.filter((r) => r.verdict === 'better'), beats = !worse.length && better.length > 0;
  const text = beats ? `赢了：${better.map((r) => r.label).join('、')}更好，其余不差` : worse.length ? `没赢：${worse.map((r) => `${r.label} ${r.prev} → ${r.cur}`).join('、')}退步` : '没赢：四项都和上一代持平（在容差内）';
  return { beats, rows, text };
}
export const arenaStepsKnown = () => ARENA_GENERATIONS.every((g) => g.steps.every((id) => MOUNTAIN_CAPABILITIES.some((c) => c.meta.id === id)));
