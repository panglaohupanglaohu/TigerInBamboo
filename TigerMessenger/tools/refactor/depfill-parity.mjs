#!/usr/bin/env node
/**
 * depfill-parity.mjs — depfill 原版↔重构逐格裁判（R91+ 阶段5：把 relief.valley 的 depfill 对照从 seed 7 扩到多种子）。
 *
 *   cd /Users/panglaohu/Downloads/TigerInBamboo
 *   $NODE TigerMessenger/tools/refactor/depfill-parity.mjs            # seeds 1..10 + 20261123
 *   $NODE TigerMessenger/tools/refactor/depfill-parity.mjs 8 9        # 只跑指定 seed
 *
 * 两边跑同一个 heights(seed) 输入场，逐格比 PF 输出（精确差 + 超容差格），
 * 并对 measure() 汇总口径（minima/drainPct/lift/steps/lakes/lakeCells）逐项对照。
 * 登记口径见 src/scene-authoring/catalog/parity/relief.valley.json：
 *   PF 容差 0.02（原版 EPS=1e-4 链式累加 vs 重构 flat 溢出面）。
 * 本脚本只读不改库代码；差异只报告、定性，不动登记。
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..'); // 工作区根（townscaper-web 在 TigerMessenger 同级）
const ORIG = path.join(ROOT, 'townscaper-web/REACode/src/depfill.js');
const REF = path.join(ROOT, 'townscaper-web/REACodeRefactoring/src/terrain/depfill-grid.js');
const OD = await import(ORIG);
const RD = await import(REF);

const TOL = 0.02; // 与 parity-cases.js relief.valley 的 depfill.PF* 容差一致
const args = process.argv.slice(2).map(Number).filter(Number.isFinite);
const SEEDS = args.length ? args : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20261123];

/** 逐格比较两个 N×N 数组；返回 { first, nDiff, nOver, maxAbs } */
function gridDiff(A, B, tol) {
  const N = A.length;
  let first = null, nDiff = 0, nOver = 0, maxAbs = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = B[y][x] - A[y][x];
    if (d !== 0) { nDiff++; if (!first) first = { x, y, o: A[y][x], r: B[y][x], d }; }
    const a = Math.abs(d);
    if (a > maxAbs) maxAbs = a;
    if (a > tol) nOver++;
  }
  return { first, nDiff, nOver, maxAbs };
}

const rows = [];
for (const seed of SEEDS) {
  const om = OD.measure(seed), rm = RD.measure(seed);
  // 0) 输入场一致性（heights 必须逐值相同，否则不是同一份输入）
  const hDiff = gridDiff(om.H, rm.H, 0);
  // 1) PF 逐格
  const pf = gridDiff(om.PF, rm.PF, TOL);
  // 2) 汇总口径
  const pack = (x) => ({ minima: x.minima, drainPct: +x.drain.pct.toFixed(4), raised: x.lift.raised, lake: x.lift.lake, mean: +x.lift.mean.toFixed(4), max: +x.lift.max.toFixed(4), steps: x.steps, land: x.land });
  const fields = {};
  for (const k of ['raw', 'naive', 'flood']) {
    const a = pack(om[k]), b = pack(rm[k]), dd = {};
    for (const f of Object.keys(a)) if (a[f] !== b[f]) dd[f] = [a[f], b[f]];
    if (Object.keys(dd).length) fields[k] = dd;
  }
  const oLakeCells = om.lakes.reduce((s, l) => s + l.area, 0), rLakeCells = rm.lakes.reduce((s, l) => s + l.area, 0);
  if (om.lakes.length !== rm.lakes.length) fields.lakes = [om.lakes.length, rm.lakes.length];
  if (oLakeCells !== rLakeCells) fields.lakeCells = [oLakeCells, rLakeCells];
  rows.push({ seed, hSame: hDiff.nDiff === 0, pf, fields });
}

let exitBad = 0;
for (const r of rows) {
  const over = r.pf.nOver > 0 || Object.keys(r.fields).length > 0 || !r.hSame;
  if (over) exitBad = 1;
  console.log(`seed ${r.seed}: inputIdentical=${r.hSame} PFdiffCells=${r.pf.nDiff} overTol=${r.pf.nOver} maxAbs=${r.pf.maxAbs.toExponential(2)}` +
    (r.pf.first ? ` first=(${r.pf.first.x},${r.pf.first.y}) o=${r.pf.first.o} r=${r.pf.first.r}` : '') +
    (Object.keys(r.fields).length ? ` fields=${JSON.stringify(r.fields)}` : ''));
}

// 首个超容差分歧的机制定位：列出 first 格在两边 F 中的 8 邻与水位
const worst = rows.find((r) => r.pf.nOver > 0) || rows.find((r) => Object.keys(r.fields).length) || null;
if (worst?.pf?.first) {
  const { seed } = worst, { x, y } = worst.pf.first;
  const om = OD.measure(seed), rm = RD.measure(seed);
  const nb = (F) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    .map(([dx, dy]) => (F[y + dy] || [])[x + dx]);
  console.log(`\n首分歧格 seed ${seed} (${x},${y}): H=${om.H[y][x]} oPF=${om.PF[y][x]} rPF=${rm.PF[y][x]}`);
  console.log('  oPF 8邻:', nb(om.PF).join(', '));
  console.log('  rPF 8邻:', nb(rm.PF).join(', '));
}
process.exit(exitBad);
