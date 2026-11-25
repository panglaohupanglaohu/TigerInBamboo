/**
 * nightly-lib.mjs —— 夜间重建（Guide §1.4 创新 8，R40 第一版）的纯逻辑：步骤编排、TAP 解析、快照对比、晨报渲染。
 * 不起进程、不读写文件（那些在 run-nightly.mjs）；tests/nightly.test.mjs 直接测这里。
 *
 * 步骤顺序（与 Guide §5.1 / §5.2 一致，注意工作目录）：
 *   drift  §5.1 四个漂移测试                         仓库根     node --test …
 *   ①     build_reacode_file_status.py              仓库根     python3（环境变量 NODE_PATH_BIN = node）
 *   ②③④  build-system-catalog / scan-code-library / scan-scene-consumers   TigerMessenger
 *   jev    jev-classify-tree.py（--no-jev 跳过）       仓库根     python3；按 §5.4 跑完要重做 ⑤⑥，所以排在 ⑤ 之前
 *   ⑤     build-capability-lineage                  TigerMessenger
 *   goals  每条目标路径在 Node 里各跑一次（进程内）；纯数据的层（fx / battle / mountain）用合成场地跑，别的记 NOT_RUN；
 *          验证检查上的 metric 写 catalog/verification-metrics.json，供 ⑥ 算指标差距分（创新 5）
 *   ⑥     export-learn-queue                        TigerMessenger
 *   ⑦     build-capability-maturity                 TigerMessenger
 *   unit   test_workshops.py 单元清单里的全部测试     仓库根     node --test …
 */
export const DRIFT_TESTS = ['reacode-file-status', 'capability-tree', 'capability-lineage', 'capability-evolution'].map((n) => `TigerMessenger/tests/${n}.test.mjs`);

export function planSteps({ node = 'node', python = 'python3', noJev = false, skipRecompute = false, skipDrift = false, skipTests = false, unitFiles = [] } = {}) {
  const env = { NODE_PATH_BIN: node }, S = [];
  const push = (id, label, cwd, cmd, args, extra = {}) => S.push({ id, label, cwd, cmd, args, ...extra });
  if (!skipDrift) push('drift', '§5.1 漂移检查（4 个测试）', 'root', node, ['--test', '--test-reporter=tap', ...DRIFT_TESTS], { tap: true });
  if (!skipRecompute) {
    push('r1', '① 原版逐文件状态', 'root', python, ['TigerMessenger/tools/scene-authoring/build_reacode_file_status.py'], { env });
    push('r2', '② 系统目录', 'tm', node, ['tools/refactor/build-system-catalog.mjs', '../townscaper-web/REACode', '../townscaper-web/REACodeRefactoring']);
    push('r3', '③ 重构库扫描', 'tm', node, ['tools/refactor/scan-code-library.mjs']);
    push('r4', '④ 场景依赖扫描', 'tm', node, ['tools/refactor/scan-scene-consumers.mjs']);
  }
  if (!noJev) push('jev', 'JEV 归线（§5.4）', 'root', python, ['TigerMessenger/tools/refactor/jev-classify-tree.py'], { env, optional: true });
  else S.push({ id: 'jev', label: 'JEV 归线（§5.4）', skipped: '--no-jev' });
  if (!skipRecompute) push('r5', '⑤ 能力谱系', 'tm', node, ['tools/refactor/build-capability-lineage.mjs']);
  S.push({ id: 'goals', label: '目标路径各跑一次（Node，进程内）', inProcess: true });
  if (!skipRecompute) {
    push('r6', '⑥ 补学队列（含指标差距分）', 'tm', node, ['tools/refactor/export-learn-queue.mjs']);
    push('r7', '⑦ 九级成熟度', 'tm', node, ['tools/refactor/build-capability-maturity.mjs']);
  }
  if (!skipTests && unitFiles.length) push('unit', '单元测试（test_workshops.py 清单）', 'root', node, ['--test', '--test-reporter=tap', ...unitFiles], { tap: true });
  return S;
}

/** test_workshops.py 里单元清单的名字 → 测试文件路径（相对仓库根）。 */
export function unitTestList(pyText = '') {
  const m = /\[f'TigerMessenger\/tests\/\{n\}\.test\.mjs' for n in \[([^\]]*)\]\]/.exec(pyText);
  return m ? [...m[1].matchAll(/'([\w.-]+)'/g)].map((x) => `TigerMessenger/tests/${x[1]}.test.mjs`) : [];
}

/** node --test 的 TAP 输出 → { tests, pass, fail, skipped, failures }（只认汇总行与 not ok 行）。 */
export function parseTap(text = '') {
  const num = (k) => { const m = new RegExp('^# ' + k + ' (\\d+)', 'm').exec(text); return m ? +m[1] : null; };
  const failures = [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
  return { tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), failures: [...new Set(failures)].slice(0, 50) };
}

/** 夜间用的合成场地（与 tests/fixtures/fx-stage.mjs、battle-pipeline / capability-tree 测试同形）：只说明「这条路径在固定输入上还跑得通、数没变坏」，不是实景。 */
export function syntheticStage() {
  const grid = [], H = new Set(['0,0', '-3,2', '2,-4', '5,1']);
  for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
    const r = Math.hypot(i, j); if (r > 12) continue;
    let lv = r > 10.5 ? 0 : Math.min(6, 1 + Math.floor((10.5 - r) / 1.8)); if (lv > 0 && i >= 3 && r < 8) lv += 2;
    grid.push([i, j, lv, lv > 0 && H.has(i + ',' + j) ? 1 : 0]);
  }
  return { scene: { id: 'nightly', label: '合成舞台' }, meshes: 1, cells: grid.length, scale: 5, gridRadius: 12, unitHeight: 1.7, levelHeight: 0.5, plateauRaised: 0,
    land: grid.filter((c) => c[2] > 0).length, maxLevel: Math.max(...grid.map((c) => c[2])), houses: grid.filter((c) => c[3]).length, grid };
}
export function syntheticField() {
  const n = 81, h = [], cls = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(i - 40, j - 40); h.push(d > 36 ? null : d > 33 ? -1 : Math.floor((36 - d) / 6) * 6 + 2); cls.push(Math.hypot(i - 50, j - 50) < 5 ? 1 : j === 30 && i > 10 && i < 70 ? 2 : 0); }
  return { n, step: 3, h, cls, railY: [] };
}

/** 验证结果 → 指标行：检查项上的 metric（带阈值，能算差距分）+ verify.metrics 里的数（只做昨今对比）。 */
export function metricsFromVerify(goal, verify, lineOf = () => null, scene = '合成舞台') {
  const rows = [];
  for (const c of verify?.checks || []) if (c.metric && Number.isFinite(+c.metric.value)) {
    const cap = c.blame?.[0] || null;
    rows.push({ key: `${goal}:${c.id}`, goal, check: c.id, capability: cap, line: lineOf(cap), name: c.metric.name, value: +c.metric.value, threshold: c.metric.threshold, direction: c.metric.direction, unit: c.metric.unit || '', status: c.status, scene, source: 'nightly' });
  }
  const walk = (o, pre) => { for (const [k, v] of Object.entries(o || {})) { if (typeof v === 'number' && Number.isFinite(v)) rows.push({ key: `${goal}:${pre}${k}`, goal, name: pre + k, value: v, scene, source: 'nightly', untracked: true }); else if (v && typeof v === 'object' && !Array.isArray(v) && pre.split('.').length < 3) walk(v, pre + k + '.'); } };
  if (verify?.metrics && typeof verify.metrics === 'object') walk(verify.metrics, 'metrics.');
  return rows;
}

const byId = (rows = []) => new Map(rows.map((r) => [r.id, r]));
/** 今天的快照对昨天的：新增能力、能力线升级 / 降级、指标变好 / 变差、测试红绿翻转、前沿与 ⚙ 数。prev 为空时全部算「首次」。 */
export function diffSnapshots(prev, cur) {
  const P = byId(prev?.capabilities), C = byId(cur?.capabilities);
  const newCapabilities = prev ? (cur.capabilities || []).filter((c) => !P.has(c.id)) : [];
  const removedCapabilities = prev ? (prev.capabilities || []).filter((c) => !C.has(c.id)) : [];
  const lineChanges = [];
  for (const [line, row] of Object.entries(cur?.lines || {})) { const was = prev?.lines?.[line]; if (was && was.level !== row.level) lineChanges.push({ line, name: row.name || line, from: was.level, to: row.level, up: row.level > was.level }); }
  const capabilityLevelChanges = [];
  for (const c of cur?.capabilities || []) { const p = P.get(c.id); if (p && p.level !== c.level) capabilityLevelChanges.push({ id: c.id, from: p.level, to: c.level, up: c.level > p.level }); }
  const PM = new Map((prev?.metrics || []).map((m) => [m.key, m])), metricDeltas = [];
  for (const m of cur?.metrics || []) {
    const p = PM.get(m.key); if (!p || !Number.isFinite(p.value) || p.value === m.value) continue;
    const delta = +(m.value - p.value).toFixed(6), better = m.direction === 'max' ? delta < 0 : m.direction === 'min' ? delta > 0 : null;
    metricDeltas.push({ key: m.key, goal: m.goal, name: m.name, scene: m.scene, from: p.value, to: m.value, delta, better, threshold: m.threshold ?? null, direction: m.direction || null });
  }
  metricDeltas.sort((a, b) => (a.better === b.better ? Math.abs(b.delta) - Math.abs(a.delta) : a.better === false ? -1 : 1));
  const tf = (k) => { const a = new Set(prev?.tests?.[k]?.failures || []), b = new Set(cur?.tests?.[k]?.failures || []); return { red: [...b].filter((x) => !a.has(x)), green: prev ? [...a].filter((x) => !b.has(x)) : [] }; };
  const stepFlips = (cur?.steps || []).filter((s) => { const p = (prev?.steps || []).find((x) => x.id === s.id); return p && p.status !== s.status; }).map((s) => ({ id: s.id, from: (prev.steps.find((x) => x.id === s.id) || {}).status, to: s.status }));
  return { first: !prev, prevDate: prev?.date || null, newCapabilities, removedCapabilities, lineChanges, capabilityLevelChanges, metricDeltas, testFlips: { drift: tf('drift'), unit: tf('unit') }, stepFlips,
    frontier: { from: prev?.tree?.frontier ?? null, to: cur?.tree?.frontier ?? null }, fruit: { from: prev?.tree?.fruit ?? null, to: cur?.tree?.fruit ?? null } };
}

const tapLine = (t) => (!t ? 'NOT_RUN' : t.fail == null ? '没读到汇总行' : `${t.pass}/${t.tests} 通过${t.fail ? `，${t.fail} 红` : ''}`);
const lvl = (n) => (n == null ? '—' : 'L' + n);
/** 一页晨报（Markdown）。 */
export function renderMorningReport(snap, diff) {
  const o = [];
  const red = (snap.tests?.unit?.fail || 0) + (snap.tests?.drift?.fail || 0), failedSteps = snap.steps.filter((s) => s.status === 'fail');
  o.push(`# 夜间重建晨报 · ${snap.date}`, '', `> 由 \`TigerMessenger/tools/nightly/run-nightly.mjs\` 生成（${snap.generatedAt}）。对比基准：${diff.first ? '没有昨天的快照，本次是首次' : diff.prevDate}。`, '');
  o.push(`**一句话**：新增能力 ${diff.newCapabilities.length} 个 · 能力线升级 ${diff.lineChanges.filter((x) => x.up).length} 条、降级 ${diff.lineChanges.filter((x) => !x.up).length} 条 · 指标变好 ${diff.metricDeltas.filter((x) => x.better === true).length} / 变差 ${diff.metricDeltas.filter((x) => x.better === false).length} · 测试 ${red ? red + ' 红' : '全绿'} · 步骤失败 ${failedSteps.length} · ⚙ ${snap.tree?.fruit ?? '—'}/${snap.tree?.lines ?? '—'} 条线，解锁前沿 ${snap.tree?.frontier?.length ?? '—'}。`, '');
  o.push('## 新增能力', '');
  if (diff.first) o.push(`首次运行，没有昨天可比；今天共 ${snap.capabilities.length} 个可执行能力（脚本口径，按 ID 去重）。`);
  else if (!diff.newCapabilities.length) o.push('没有新增。');
  else for (const c of diff.newCapabilities) o.push(`- \`${c.id}\` ${c.name || ''} —— 线 ${c.line || '未归线'} · ${c.label || lvl(c.level)}`);
  if (diff.removedCapabilities.length) o.push('', '消失的能力：' + diff.removedCapabilities.map((c) => '`' + c.id + '`').join('、'));
  o.push('', '## 哪条线升级（九级成熟度，取线上最高级）', '');
  if (!diff.lineChanges.length) o.push(diff.first ? '首次运行，没有可比的级别。' : '没有能力线的最高级变化。');
  else for (const x of diff.lineChanges) o.push(`- ${x.up ? '↑' : '↓'} ${x.name}：${lvl(x.from)} → ${lvl(x.to)}`);
  if (diff.capabilityLevelChanges.length) o.push('', '能力级别变化：' + diff.capabilityLevelChanges.slice(0, 12).map((x) => `\`${x.id}\` ${lvl(x.from)}→${lvl(x.to)}`).join('、'));
  o.push('', '## 场景候选变好 / 变差（目标路径各跑一次）', '');
  o.push('| 目标路径 | 状态 | 验证 | 说明 |', '|---|---|---|---|');
  for (const g of snap.goals || []) o.push(`| ${g.name || g.id} | ${g.status} | ${g.verify?.status || '—'} | ${(g.reason || g.verify?.summary || '').replace(/\|/g, '／').slice(0, 120)} |`);
  o.push('');
  if (!diff.metricDeltas.length) o.push(diff.first ? '首次运行，指标没有昨天可比。' : '指标与昨天相同。');
  else for (const d of diff.metricDeltas.slice(0, 12)) o.push(`- ${d.better === true ? '变好' : d.better === false ? '变差' : '变化'}：${d.goal} · ${d.name}（${d.scene}）${d.from} → ${d.to}${d.threshold != null ? `（阈值 ${d.direction === 'max' ? '≤' : '≥'} ${d.threshold}）` : ''}`);
  const over = (snap.metrics || []).filter((m) => m.gapScore > 0);
  if (over.length) o.push('', '离阈值近或已越线（已换算成补学队列加分）：' + over.slice(0, 8).map((m) => `${m.name} ${m.value}（阈值 ${m.threshold}，+${m.gapScore}）`).join('；'));
  o.push('', '> 目标路径在 Node 里用合成场地跑（固定输入，看「还跑得通、数没变坏」）；要实景的层记 NOT_RUN，实景证据看端到端 report.json。', '');
  o.push('## 场景覆盖（vendor 副本 vs 最新库）', '');
  if (!(snap.scenes || []).length) o.push('没读到 scene-consumers.json。');
  else {
    o.push('| 场景 | 模块 | 一致 | 差异 | 库里没有 | 建议目标路径 | 差异文件 |', '|---|---|---|---|---|---|---|');
    for (const c of snap.scenes) o.push(`| ${c.name} | ${c.counts.modules} | ${c.counts.identical} | ${c.counts.different} | ${c.counts.absent} | ${(c.suggestedGoals || []).join('、') || '—'} | ${(c.different || []).map((p) => '`' + p.split('/').pop() + '`').join('、').slice(0, 140) || '—'} |`);
  }
  o.push('');
  o.push('## 测试红绿', '');
  o.push(`- 漂移检查（§5.1）：${tapLine(snap.tests?.drift)}${diff.testFlips.drift.red.length ? '；新红：' + diff.testFlips.drift.red.join('、') : ''}${diff.testFlips.drift.green.length ? '；转绿：' + diff.testFlips.drift.green.join('、') : ''}`);
  o.push(`- 单元测试：${tapLine(snap.tests?.unit)}${diff.testFlips.unit.red.length ? '；新红：' + diff.testFlips.unit.red.slice(0, 10).join('、') : ''}${diff.testFlips.unit.green.length ? '；转绿：' + diff.testFlips.unit.green.slice(0, 10).join('、') : ''}`);
  if ((snap.tests?.unit?.failures || []).length) o.push(`- 现在红的：${snap.tests.unit.failures.slice(0, 10).join('、')}`);
  o.push('- 浏览器端到端：夜间不跑（要 8931 服务和真实浏览器），最近一次结果：' + ((snap.e2e || []).length ? snap.e2e.slice(0, 10).map((e) => `${e.dir} ${e.pass ? '✓' : '✗'}`).join(' · ') : '没有 report.json'));
  o.push('', '## 步骤', '', '| 步骤 | 状态 | 用时 | 备注 |', '|---|---|---|---|');
  for (const s of snap.steps) o.push(`| ${s.label} | ${s.status} | ${s.ms != null ? (s.ms / 1000).toFixed(1) + 's' : '—'} | ${(s.note || '').replace(/\|/g, '／').slice(0, 100)} |`);
  o.push('', '## 补学队列队首', '');
  for (const q of snap.learnQueue?.head || []) o.push(`- #${q.rank} ${q.score} ${q.lineName || q.line}·${q.generation || ''}${q.metricGap ? `（指标差距 +${q.metricGap.score}：${q.metricGap.name}）` : ''}`);
  if (!(snap.learnQueue?.head || []).length) o.push('没读到 learn-queue.json。');
  o.push('', `证据：本目录 \`snapshot.json\`（今天的全量快照）、\`morning-report.json\`（本页的数据）、\`logs/\`（每步的输出尾部）。昨天 → 今天的对比按 \`artifacts/nightly/<日期>/snapshot.json\`。`);
  return o.join('\n') + '\n';
}

/** latest.json：管线页「夜间晨报」面板读它（小，只放摘要）。 */
export function latestPointer(snap, diff, dir) {
  return { schemaVersion: 1, date: snap.date, generatedAt: snap.generatedAt, dir, report: dir + '/morning-report.md', json: dir + '/morning-report.json',
    headline: { newCapabilities: diff.newCapabilities.length, lineUp: diff.lineChanges.filter((x) => x.up).length, lineDown: diff.lineChanges.filter((x) => !x.up).length, better: diff.metricDeltas.filter((x) => x.better === true).length, worse: diff.metricDeltas.filter((x) => x.better === false).length, first: diff.first },
    newCapabilities: diff.newCapabilities.slice(0, 8).map((c) => ({ id: c.id, name: c.name, line: c.line, label: c.label })),
    lineChanges: diff.lineChanges.slice(0, 8), metricDeltas: diff.metricDeltas.slice(0, 6),
    tests: { drift: snap.tests?.drift || null, unit: snap.tests?.unit ? { tests: snap.tests.unit.tests, pass: snap.tests.unit.pass, fail: snap.tests.unit.fail, failures: (snap.tests.unit.failures || []).slice(0, 6) } : null },
    tree: snap.tree || null, steps: snap.steps.map((s) => ({ id: s.id, label: s.label, status: s.status })), goals: (snap.goals || []).map((g) => ({ id: g.id, name: g.name, status: g.status, verify: g.verify?.status || null })) };
}
