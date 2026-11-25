/**
 * parity-cases.js — 地貌枝六条能力线的原版对照（R42–R45）。每条：同一个种子 / 同一份输入，原版 REACode 跑一遍，重构库跑一遍，
 * 把两边的输出整理成同一个形状交给 parity.js 比较。原版只 import 不改（REACode 只读）。
 * 登记表在 TigerMessenger/src/scene-authoring/catalog/parity/<能力ID>.json；跑法见 tools/refactor/record-relief-evidence.mjs。
 */
import { fingerprint } from './parity.js';

const ORIG = '../../../../townscaper-web/REACode/';
const LIB = '../../../../townscaper-web/REACodeRefactoring/src/';
const imp = (p) => import(new URL(p, import.meta.url).href);
const arr = (a) => Array.from(a, (v) => +v);
export const PARITY_SEEDS = Object.freeze([7, 20261123]);

/** 悬垂：体素岛（buildTerrain）+ 网格化（buildMesh）+ 统计（measure），两个种子 */
async function overhangRun() {
  const [O, R] = await Promise.all([imp(ORIG + 'src/overhangterrain.js'), imp(LIB + 'terrain/overhang-terrain.js')]);
  const pack = (M, seed) => {
    const T = M.buildTerrain(seed), mesh = M.buildMesh(T);
    return { dims: [M.NX, M.NY, M.NZ, M.WATER], top: arr(T.top), voxels: T.vox.reduce((s, v) => s + v, 0), voxFp: fingerprint(T.vox),
      tunnel: { ...T.tunnel }, stack: { ...T.stack }, mesh: { faces: mesh.faces, byDir: [...mesh.byDir], soffitFaces: mesh.soffitFaces, soffitAboveWater: mesh.soffitAboveWater, posFp: fingerprint(mesh.positions), colFp: fingerprint(mesh.colors) },
      measure: M.measure(T), step6: fingerprint(M.heightField(seed, { step: 6 }).h) };
  };
  const out = (M) => Object.fromEntries(PARITY_SEEDS.map((s) => ['seed' + s, pack(M, s)]));
  return { original: out(O), refactored: out(R) };
}
/** 软坡：陡崖省掩码（sharpMaskFor 与原版 heightField.sharp 同一套噪声 + 分位）、缓坡省保留连续原值 */
async function softRun() {
  const [O, R] = await Promise.all([imp(ORIG + 'src/overhangterrain.js'), imp(LIB + 'terrain/overhang-terrain.js')]);
  const o = {}, r = {};
  for (const s of PARITY_SEEDS) {
    const F = O.heightField(s);
    o['seed' + s] = { sharp: arr(F.sharp), softRaw: arr(F.raw) };
    r['seed' + s] = { sharp: arr(R.sharpMaskFor(O.NX, s)), softRaw: arr(R.softenField(arr(F.raw), O.NX, null, { passes: 0 })) };
  }
  return { original: o, refactored: r };
}
/** 硬崖：陡崖省按 step 取整后的混合高度（原版 heightField.h）= 重构 mixSoftSharp(原值, 掩码, step) */
async function cliffRun() {
  const [O, R] = await Promise.all([imp(ORIG + 'src/overhangterrain.js'), imp(LIB + 'terrain/overhang-terrain.js')]);
  const o = {}, r = {};
  for (const s of PARITY_SEEDS) for (const step of [9, 6]) {
    const F = O.heightField(s, { step });
    o[`seed${s}-step${step}`] = arr(F.h);
    r[`seed${s}-step${step}`] = arr(R.mixSoftSharp(arr(F.raw), F.sharp, step, { minLand: -Infinity }));
  }
  return { original: o, refactored: r };
}
/** 三遍（等高线 / 线框 / 成图）：同一座台地岛 */
async function passesRun() {
  const [O, R, OC, RC] = await Promise.all([imp(ORIG + 'src/islandpasses.js'), imp(LIB + 'terrain/island-passes.js'), imp(ORIG + 'src/terracecliff.js'), imp(LIB + 'terrain/terrace-field.js')]);
  const pack = (M, C, h) => ({ grid: h.map((row) => arr(row)), measure: M.measure.length ? M.measure(h) : M.measure(), segs: M.contourSegs(h).length, ringSizes: M.traceRings(M.contourSegs(h)).map((x) => x.size).sort((a, b) => b - a),
    wire: M.wireSegs(h).length, shore: M.shoreSegs(h).length, interp09: M.interpContour(h, 0.9).length, levelOf: [-1, 0, 0.35, 0.36, 0.9, 1.35, 2.2].map((z) => M.levelOf(z)),
    terrace: { smooth: C.measure('smooth'), terrace: C.measure('terrace') } });
  return { original: pack(O, OC, O.grid()), refactored: pack(R, RC, R.grid()) };
}
/**
 * 测试岛（整数层）：圆锥 + 哈希起伏，峰高 > 3（generate.js carveRivers 只从 > 3 层的格起源）。
 * 最高格再抬成比四邻都高 2 层的孤峰：原版 engine/rivers.js 的 DFS 没把源头放进 seen（瑕疵），
 * 源头要是只比邻格高 1 层，原版会走回源头、和重构版走出不同的河；孤峰让「回到源头」在两边都不可能，比的就是同一个 DFS。
 */
export function riverIsland(n = 40, seed = 20261123, hash) {
  const lv = new Array(n * n), c = (n - 1) / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot(i - c, j - c) / (n * 0.46);
    lv[j * n + i] = r >= 1 ? 0 : Math.max(0, Math.round(9 * (1 - r) + 2.4 * (hash(i, j, seed) - 0.5)));
  }
  let top = 0; for (let k = 1; k < n * n; k++) if (lv[k] > lv[top]) top = k;
  const ti = top % n, tj = (top - ti) / n; let nbMax = 0;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) nbMax = Math.max(nbMax, lv[(tj + dj) * n + ti + di] || 0);
  lv[top] = Math.max(lv[top], nbMax + 2);
  return lv;
}
/** 河谷：① 开河（原版 engine/rivers.js vs 重构 terrain/generate.js，同一张整数层岛、同一个种子）② 填洼（原版 src/depfill.js vs 重构 terrain/depfill-grid.js → core/depression-fill.js） */
async function valleyRun() {
  const [OR, G, RV, OD, RD, OT] = await Promise.all([imp(ORIG + 'engine/rivers.js'), imp(LIB + 'terrain/generate.js'), imp(LIB + 'terrain/river-valley.js'), imp(ORIG + 'src/depfill.js'), imp(LIB + 'terrain/depfill-grid.js'), imp(LIB + 'terrain/overhang-terrain.js')]);
  const n = 40, levels = riverIsland(n, 20261123, OT.hash), opts = { seed: 11, count: 1, maxSteps: 4000, depth: 2 };
  // 原版：quad grid + town（top / fill / version / colors）
  const oCells = RV.gridCells(n), oLv = levels.slice(), town = { top: (c) => oLv[c.id], fill: (c, l) => { oLv[c.id] = l; }, version: 0, colors: new Array(n * n).fill(0) };
  const oRes = OR.carveRivers(town, { cells: oCells }, opts);
  OR.paintRivers(town, { cells: oCells }, oRes.cells, 2);
  const oPath = oRes.paths[0] || [], oCore = oPath.filter((id) => levels[id] > 0);
  // 重构：最小 World
  const world = RV.gridWorld(n, levels), rCells = G.carveRivers(world, opts);
  const rPath = world.riverFlow.paths[0] || [], rCore = rPath.slice(1);
  RV.paintRivers(world, rCells, 2);
  const river = (o) => ({ dfsCore: o.core, mouths: o.mouths, cells: [...o.cells].sort((a, b) => a - b), levels: o.levels, painted: o.painted });
  const o = river({ core: oCore, mouths: oRes.mouths, cells: oRes.cells, levels: oLv, painted: town.colors.filter((v) => v === 2).length });
  const r = river({ core: rCore, mouths: world.riverFlow.mouths, cells: rCells, levels: Array.from(world.levels), painted: world.river.reduce((s, v) => s + v, 0) });
  // 填洼
  const dm = (M) => { const m = M.measure(7); const p = (x) => ({ minima: x.minima, drainPct: +x.drain.pct.toFixed(3), lift: { raised: x.lift.raised, lake: x.lift.lake, mean: +x.lift.mean.toFixed(4), max: +x.lift.max.toFixed(4) }, steps: x.steps, land: x.land });
    return { H: m.H.map((row) => arr(row)), raw: p(m.raw), naive: p(m.naive), flood: p(m.flood), PF: m.PF.map((row) => arr(row)), lakeCells: m.lakes.reduce((s, l) => s + (l.area ?? l.cells?.length ?? 0), 0), lakes: m.lakes.length }; };
  return { original: { rivers: o, depfill: dm(OD) }, refactored: { rivers: r, depfill: dm(RD) } };
}
/** 薄台与攀爬：原版三把梯子 */
async function ledgeRun() {
  const [O, R] = await Promise.all([imp(ORIG + 'src/terraceladder.js'), imp(LIB + 'terrain/terrace-ladder.js')]);
  const pack = (M) => ({ measure: M.measure(), ladders: M.ladders().map((l) => ({ id: l.id, L: l.L, angle: l.angle, foot: l.foot, lip: l.lip, head: l.head, rungs: l.rungs.length, footErr: l.footErr, lipDist: l.lipDist, shortGap: l.shortGap })), topZ: [0, 1, 2, 3].map((k) => M.topZ(k)) });
  return { original: pack(O), refactored: pack(R) };
}

export const PARITY_CASES = Object.freeze([
  { id: 'relief.soft', line: 'terrain', original: 'townscaper-web/REACode/src/overhangterrain.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js'],
    inputs: { seeds: PARITY_SEEDS, grid: '56×56', compare: '陡崖省掩码 sharp；缓坡省连续原值（passes = 0）' }, tol: 0, run: softRun },
  { id: 'relief.cliff', line: 'terrain', original: 'townscaper-web/REACode/src/overhangterrain.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js'],
    inputs: { seeds: PARITY_SEEDS, steps: [9, 6], compare: '陡崖省取整后的混合高度' }, tol: 1e-4, run: cliffRun },
  { id: 'relief.overhang', line: 'terrain', original: 'townscaper-web/REACode/src/overhangterrain.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js'],
    inputs: { seeds: PARITY_SEEDS, compare: '体素岛顶面 / 体素指纹 / 海蚀洞 / 石柱 / 网格面数与朝下面 / measure' }, tol: 0, run: overhangRun },
  { id: 'relief.passes', line: 'terrain', original: 'townscaper-web/REACode/src/islandpasses.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/island-passes.js', 'townscaper-web/REACodeRefactoring/src/terrain/terrace-field.js'],
    inputs: { grid: 'terracecliff heights(terrace) 34×34', compare: '等高线段 / 环 / 线框 / 岸线 / 插值对照 / measure' }, tol: 0, run: passesRun },
  { id: 'relief.valley', line: 'terrain', original: 'townscaper-web/REACode/engine/rivers.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/generate.js', 'townscaper-web/REACodeRefactoring/src/terrain/river-valley.js', 'townscaper-web/REACodeRefactoring/src/terrain/depfill-grid.js', 'townscaper-web/REACodeRefactoring/src/core/depression-fill.js'],
    alsoOriginal: ['townscaper-web/REACode/src/depfill.js'],
    inputs: { rivers: { grid: '40×40 整数层测试岛 riverIsland(40, 20261123)', seed: 11, count: 1, depth: 2 }, depfill: { seed: 7, grid: '64×64' } },
    tol: { default: 0, 'depfill.PF*': 0.02, 'depfill.flood.lift.mean': 0.02, 'depfill.flood.lift.max': 0.02 }, run: valleyRun },
  { id: 'relief.ledge', line: 'terrain', original: 'townscaper-web/REACode/src/terraceladder.js', refactored: ['townscaper-web/REACodeRefactoring/src/terrain/terrace-ladder.js'],
    inputs: { cfg: '原版 CFG：H 1、三处崖面 run 0.22 / 0.40 / 0.62' }, tol: 0, run: ledgeRun },
]);
export const caseById = (id) => PARITY_CASES.find((c) => c.id === id) || null;
