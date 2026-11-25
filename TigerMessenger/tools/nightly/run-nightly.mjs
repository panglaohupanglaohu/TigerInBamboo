#!/usr/bin/env node
/**
 * run-nightly.mjs —— 夜间重建第一版（Guide §1.4 创新 8，§9 E 组 R40）。一条命令跑完：
 *   §5.1 漂移检查 → §5.2 ①–④ → JEV 归线（可 --no-jev）→ ⑤ → 每条目标路径在 Node 里各跑一次（写 verification-metrics.json）
 *   → ⑥ 补学队列（含指标差距分，创新 5）→ ⑦ 九级成熟度 → 单元测试 → 和上一次的快照比 → 一页晨报。
 *
 *   cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger
 *   $NODE tools/nightly/run-nightly.mjs                 全量（要 python3 和 JEV 的网络 / 额度）
 *   $NODE tools/nightly/run-nightly.mjs --no-jev        不跑 JEV 归线（离线、省钱）
 *   其他开关：--skip-drift  --skip-recompute（只跑目标路径 + 测试 + 晨报）  --skip-tests  --date YYYY-MM-DD  --python <python3 路径>
 *
 * 每步按 Guide 的工作目录起子进程：① 与 JEV、测试在仓库根（python3，环境变量 NODE_PATH_BIN = 本 node），②–⑦ 在 TigerMessenger。
 * 本脚本按自己的位置定位两个目录，不依赖当前目录（但按规矩仍在 TigerMessenger 里跑）。
 * 输出（只写这些，外加 §5.2 本来就会写的 catalog / docs）：
 *   artifacts/nightly/<日期>/snapshot.json         今天的全量快照（明天拿它比）
 *   artifacts/nightly/<日期>/morning-report.md     一页晨报：新增能力、哪条线升级、哪个场景候选变好 / 变差、测试红绿
 *   artifacts/nightly/<日期>/morning-report.json   晨报数据（diff + 摘要）
 *   artifacts/nightly/<日期>/logs/<步骤>.log        每步输出的尾部
 *   artifacts/nightly/latest.json                  指向最新一份（管线页「夜间晨报」面板读它）
 *   src/scene-authoring/catalog/verification-metrics.json   目标路径验证指标（⑥ 读它算指标差距分）
 * 不改用户存档、不设默认、不碰湖上建筑；浏览器端到端不在夜间跑（记 NOT_RUN，晨报列出最近一次 report.json）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planSteps, unitTestList, parseTap, syntheticStage, syntheticField, metricsFromVerify, diffSnapshots, renderMorningReport, latestPointer } from './nightly-lib.mjs';
import { metricGap, METRIC_GAP_FORMULA } from '../refactor/metric-gap.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), TM = path.resolve(here, '../..'), ROOT = path.resolve(TM, '..');
const argv = process.argv.slice(2), has = (k) => argv.includes('--' + k), arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const pad = (n) => String(n).padStart(2, '0'), now = new Date();
const date = arg('date') || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('日期格式应为 YYYY-MM-DD：' + date); process.exit(2); }
if (path.basename(process.cwd()) !== 'TigerMessenger') console.warn('提示：Guide 要求在 TigerMessenger 目录里跑；本脚本按自身位置定位目录，输出不会写错地方。');
const NIGHTLY = path.join(TM, 'artifacts/nightly'), outRel = `artifacts/nightly/${date}`, OUT = path.join(TM, outRel);
fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true });
const node = process.execPath, python = arg('python') || process.env.PYTHON || 'python3';
const CATALOG = path.join(TM, 'src/scene-authoring/catalog');
const unitFiles = unitTestList(fs.readFileSync(path.join(TM, 'tools/scene-authoring/test_workshops.py'), 'utf8'));
const steps = planSteps({ node, python, noJev: has('no-jev'), skipRecompute: has('skip-recompute'), skipDrift: has('skip-drift'), skipTests: has('skip-tests'), unitFiles });
const log = (s) => process.stdout.write(s + '\n');

let goals = [], treeSummary = null, metrics = [];
async function runGoals() {
  const { computeLineage, collectExecutables } = await import('../refactor/build-capability-lineage.mjs');
  const { buildCapabilityTree } = await import('../../../townscaper-web/REACodeRefactoring/src/core/capability-tree.js');
  const jev = readJson(path.join(CATALOG, 'capability-tree-jev.json'));
  const { manifest, lineage } = await computeLineage();
  const executables = collectExecutables(), tree = buildCapabilityTree(lineage, { alignment: manifest.alignment, executables, jev });
  treeSummary = { lines: tree.summary.lines, fruit: tree.summary.fruit, frontier: tree.frontier.map((f) => f.id), executablesUnique: tree.summary.executablesUnique, goals: tree.goals.length };
  const lineOf = (id) => executables.find((e) => e.id === id)?.line || null;
  // 纯数据的层在 Node 里用合成场地跑；其余层的扫描要浏览器实景（battle.probe / 体素世界 / 材质表），记 NOT_RUN
  const RUNNERS = {
    fx: async (ids) => { const m = await import('../../src/system-workshop/fx/capabilities.js'), v = await import('../../src/system-workshop/fx/verify.js'), site = syntheticStage(); const report = m.runPlan(site, ids.map((id) => ({ id }))); return { report, verify: v.verifyFx(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) }; },
    battle: async (ids) => {
      const m = await import('../../src/system-workshop/battle/capabilities.js'), v = await import('../../src/system-workshop/battle/verify.js'), nl = await import('../../src/system-workshop/battle/nav-lab.js');
      const site = nl.demoSite(nl.demoNavSample({ gridRadius: 12 })); site.scene = { id: 'nightly', label: '合成舞台（演示岛）' };
      const steps = ids.map((id) => ({ id }));
      if (!steps.some((s) => s.id === 'battle.stage')) steps.unshift({ id: 'battle.stage', params: { scale: 5, gridRadius: 12, unitHeight: 0.34 } });
      const report = m.runPlan(site, steps);
      return { report, verify: v.verifyBattle(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) };
    },
    mountain: async (ids) => { const m = await import('../../src/system-workshop/mountain/capabilities.js'), v = await import('../../src/system-workshop/mountain/verify.js'), f = syntheticField(), site = { field: structuredClone(f) }; const report = m.runPlan(site, ids.map((id) => ({ id }))); return { report, verify: v.verifyMountain(f, site.plan, { steps: report }) }; },
    building: async (ids) => { const m = await import('../../src/system-workshop/building/capabilities.js'), v = await import('../../src/system-workshop/building/verify.js'), f = syntheticField(), site = { field: structuredClone(f), scene: { id: 'nightly', label: '合成舞台' }, terrain: 'original' }; const report = m.runPlan(site, ids.map((id) => ({ id }))); return { report, verify: v.verifyBuilding(f, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) }; },
    'apostles-terrain': async (ids) => {
      const m = await import('../../src/system-workshop/apostles-terrain/capabilities.js'), v = await import('../../src/system-workshop/apostles-terrain/verify.js');
      const lv = [], xz = [], edges = [], idx = new Map(); let vi = 0;
      for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const r = Math.hypot(i, j); if (r > 8) continue; idx.set(i + ',' + j, vi++); lv.push(r > 6.5 ? 0 : Math.min(6, 1 + Math.floor((6.5 - r) / 1.6))); xz.push(i, j); }
      for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) for (const [di, dj] of [[1, 0], [0, 1]]) { const a = idx.get(i + ',' + j), b = idx.get((i + di) + ',' + (j + dj)); if (a != null && b != null) edges.push(a, b); }
      const site = { scene: 'apostles', masses: [{ lv, xz, edges, seed: 7, colors: { top: '#7a9a5a', wall: '#8a7a6a' } }] };
      const report = m.runPlan(site, ids.map((id) => ({ id })));
      return { report, verify: v.verifyApostlesTerrain(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) };
    },
    relief: async (ids) => { const m = await import('../../src/system-workshop/relief/capabilities.js'), v = await import('../../src/system-workshop/relief/verify.js'), f = syntheticField(), site = { ok: true, n: f.n, cell: f.step, h: f.h, cls: f.cls, seed: 7, scene: 'nightly', label: '合成舞台' }; const report = m.runPlan(site, ids.map((id) => ({ id }))); return { report, verify: v.verifyRelief(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) }; },
    lightlife: async (ids) => { const m = await import('../../src/system-workshop/lightlife/capabilities.js'), v = await import('../../src/system-workshop/lightlife/verify.js'), f = syntheticField(), site = { n: f.n, step: f.step, L: 0.5, h: f.h.map((x) => (x == null ? -3 : x)), kind: f.cls.map((c) => (c ? 2 : 1)), scene: { id: 'nightly', label: '合成舞台' } }; const report = m.runPlan(site, ids.map((id) => ({ id }))); return { report, verify: v.verifyLightLife(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) }; },
  };
  goals = []; metrics = [];
  for (const g of tree.goals) {
    const ids = g.needs.map((n) => n.id), row = { id: g.id, name: g.name, needs: ids.length };
    if (!RUNNERS[g.id]) { goals.push({ ...row, status: 'NOT_RUN', reason: '这一层的输入要浏览器实景采样，只能在端到端里跑' }); continue; }
    const t0 = Date.now();
    try {
      const { report, verify } = await RUNNERS[g.id](ids);
      const rows = metricsFromVerify(g.id, verify, lineOf).map((m) => ({ ...m, gapScore: m.untracked ? null : metricGap(m)?.score ?? null }));
      metrics.push(...rows);
      goals.push({ ...row, status: 'run', ms: Date.now() - t0, report: report.map((r) => ({ id: r.id, status: r.status, changed: (r.changed || []).slice(0, 2) })), verify: { status: verify.status, summary: verify.summary || (verify.checks || []).map((c) => `${c.name || c.id}${c.status === 'fail' ? '✗' : c.status === 'warn' ? '!' : '✓'}`).join(' ') }, metrics: rows.length });
    } catch (e) {
      const reason = String(e?.message || e).slice(0, 300);
      goals.push({ ...row, status: /先在实景|NOT_RUN/.test(reason) ? 'NOT_RUN' : 'error', reason });
    }
  }
  const tracked = metrics.filter((m) => !m.untracked && m.line);
  fs.writeFileSync(path.join(CATALOG, 'verification-metrics.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), generator: 'TigerMessenger/tools/nightly/run-nightly.mjs', scene: '合成舞台 / 合成场地（Node，固定输入）', formula: METRIC_GAP_FORMULA, metrics: tracked }, null, 1) + '\n');
  return goals;
}

const results = [], tests = {};
for (const s of steps) {
  if (s.skipped) { results.push({ id: s.id, label: s.label, status: 'skipped', note: s.skipped }); log(`· ${s.label}：跳过（${s.skipped}）`); continue; }
  const t0 = Date.now();
  if (s.inProcess) {
    try { await runGoals(); const run = goals.filter((g) => g.status === 'run').length, err = goals.filter((g) => g.status === 'error'); results.push({ id: s.id, label: s.label, status: err.length ? 'fail' : 'pass', ms: Date.now() - t0, note: `${run}/${goals.length} 条在 Node 里跑了，${goals.filter((g) => g.status === 'NOT_RUN').length} 条 NOT_RUN${err.length ? '，出错：' + err.map((g) => g.id).join('、') : ''}；指标 ${metrics.length} 条` }); }
    catch (e) { results.push({ id: s.id, label: s.label, status: 'fail', ms: Date.now() - t0, note: String(e?.message || e).slice(0, 300) }); }
    log(`· ${s.label}：${results.at(-1).status}（${results.at(-1).note}）`); continue;
  }
  const cwd = s.cwd === 'root' ? ROOT : TM;
  log(`· ${s.label}：${path.relative(ROOT, cwd) || '仓库根'}$ ${[path.basename(s.cmd), ...s.args].join(' ').slice(0, 160)}`);
  const r = spawnSync(s.cmd, s.args, { cwd, env: { ...process.env, ...(s.env || {}) }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 45 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : '');
  fs.writeFileSync(path.join(OUT, 'logs', s.id + '.log'), out.slice(-200000));
  let status = r.error ? (r.error.code === 'ENOENT' ? 'BLOCKED' : 'error') : r.status === 0 ? 'pass' : 'fail';
  const last = out.trim().split('\n').filter(Boolean).slice(-1)[0] || '';
  const row = { id: s.id, label: s.label, status, code: r.status, ms: Date.now() - t0, cwd: path.relative(ROOT, cwd) || '.', cmd: [s.cmd, ...s.args].join(' ').slice(0, 400), note: (r.error ? r.error.message + ' · ' : '') + last.slice(0, 200) };
  if (s.tap) { tests[s.id] = parseTap(r.stdout || ''); const t = tests[s.id]; row.note = t.fail == null ? '没读到 TAP 汇总：' + row.note : `${t.pass}/${t.tests} 通过，${t.fail} 红`; if (status === 'pass' && t.fail) status = row.status = 'fail'; }
  if (s.optional && status !== 'pass') row.note = '（可选步骤，失败不挡后面）' + row.note;
  results.push(row); log(`  → ${row.status} ${(row.ms / 1000).toFixed(1)}s ${row.note.slice(0, 120)}`);
}

// ── 快照 ──
const maturity = readJson(path.join(CATALOG, 'capability-maturity.json'));
let capabilities = [], lines = {};
if (maturity?.rows) { capabilities = maturity.rows.map((r) => ({ id: r.id, name: r.name, line: r.line, level: r.level, label: r.label })); lines = Object.fromEntries(Object.entries(maturity.lines || {}).map(([k, v]) => [k, { name: v.name, level: v.level ?? 0, label: v.label }])); }
else { const { collectExecutables } = await import('../refactor/build-capability-lineage.mjs'); const seen = new Set(); for (const e of collectExecutables()) if (!seen.has(e.id)) { seen.add(e.id); capabilities.push({ id: e.id, name: e.name, line: e.line || null, level: null, label: '成熟度数据未生成' }); } }
const lq = readJson(path.join(CATALOG, 'learn-queue.json'));
const e2e = [];
for (const d of fs.existsSync(path.join(TM, 'artifacts')) ? fs.readdirSync(path.join(TM, 'artifacts')) : []) {
  if (!/-e2e$/.test(d)) continue; const dir = path.join(TM, 'artifacts', d);
  const runs = fs.readdirSync(dir).filter((x) => /^run-/.test(x) && fs.existsSync(path.join(dir, x, 'report.json'))).sort((a, b) => (+a.slice(4) || 0) - (+b.slice(4) || 0));
  if (!runs.length) continue; const rep = readJson(path.join(dir, runs.at(-1), 'report.json')) || {};
  e2e.push({ dir: d, run: runs.at(-1), pass: !!rep.pass, capabilities: rep.capabilities || null });
}
const consumers = readJson(path.join(CATALOG, 'scene-consumers.json'));
// 场景用了哪个模块目录 → 哪条目标路径可能与它有关（保守映射：共享目录 core/world/ui/water 不映射）
const DIR_GOALS = { 'src/badnorth': ['battle'], 'src/build': ['building'], 'src/terrain': ['mountain', 'relief', 'apostles-terrain'], 'src/light': ['lightlife'], 'src/life': ['lightlife'] };
const snap = { schemaVersion: 1, date, generatedAt: new Date().toISOString(), generator: 'TigerMessenger/tools/nightly/run-nightly.mjs', flags: argv, node: process.version,
  steps: results, tests: { drift: tests.drift || null, unit: tests.unit || null }, tree: treeSummary, capabilities, lines, goals, metrics,
  scenes: (consumers?.consumers || []).map((c) => ({ id: c.id, name: c.name, counts: c.counts, different: c.modules.filter((m) => m.state === 'different').map((m) => m.path), absent: c.modules.filter((m) => m.state === 'absent-in-library').map((m) => m.path),
    suggestedGoals: [...new Set(c.modules.flatMap((m) => DIR_GOALS[m.path.split('/').slice(0, 2).join('/')] || []))] })),
  learnQueue: lq ? { generatedAt: lq.generatedAt, metricFormula: lq.metricFormula || null, inputs: lq.inputs, head: (lq.queue || []).slice(0, 6).map((q) => ({ rank: q.rank, score: q.score, line: q.line, lineName: (q.lineName || '').split(/[：:]/)[0], generation: q.generation, title: q.title, metricGap: q.metricGap || null })) } : null, e2e };
const prevDate = fs.existsSync(NIGHTLY) ? fs.readdirSync(NIGHTLY).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < date && fs.existsSync(path.join(NIGHTLY, d, 'snapshot.json'))).sort().at(-1) : null;
const prev = prevDate ? readJson(path.join(NIGHTLY, prevDate, 'snapshot.json')) : null;
const diff = diffSnapshots(prev, snap);
fs.writeFileSync(path.join(OUT, 'snapshot.json'), JSON.stringify(snap, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'morning-report.md'), renderMorningReport(snap, diff));
fs.writeFileSync(path.join(OUT, 'morning-report.json'), JSON.stringify({ schemaVersion: 1, date, prevDate, diff, steps: results, tests: snap.tests, tree: treeSummary, goals }, null, 1) + '\n');
fs.writeFileSync(path.join(NIGHTLY, 'latest.json'), JSON.stringify(latestPointer(snap, diff, outRel), null, 1) + '\n');
const red = (tests.unit?.fail || 0) + (tests.drift?.fail || 0), bad = results.filter((r) => ['fail', 'error', 'BLOCKED'].includes(r.status) && r.id !== 'jev');
log(`晨报：${outRel}/morning-report.md · 新增能力 ${diff.newCapabilities.length} · 线升级 ${diff.lineChanges.filter((x) => x.up).length} · 指标变差 ${diff.metricDeltas.filter((x) => x.better === false).length} · 测试 ${red ? red + ' 红' : '全绿（或未跑）'} · 失败步骤 ${bad.map((r) => r.id).join('、') || '无'}`);
process.exitCode = red || bad.length ? 1 : 0;
