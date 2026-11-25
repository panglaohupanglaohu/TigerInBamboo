// R23 九级成熟度：纯级别逻辑（capability-maturity.js）+ 证据校验器（build-capability-maturity.mjs 的 makeVerifier）+ 界面接线静态检查。
// 本文件只用 demo.* 假 ID；生成器把本文件排除在 ⑤ 单测证据之外，不会给真能力「自证」。
// 浏览器端到端见 capability-maturity-browser.mjs。
import { test } from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { decideMaturity, maturityLabel, summarizeMaturity, lineMaturity, buildCountTable, COUNT_DEFINITIONS, MATURITY_LEVELS } from '../../townscaper-web/REACodeRefactoring/src/core/capability-maturity.js';
import { makeVerifier, logSections, firstLogMention, unitTestFiles, OUTPUT } from '../tools/refactor/build-capability-maturity.mjs';

const TM = new URL('..', import.meta.url).pathname, REPO = path.resolve(TM, '..');
const read = (p) => fs.readFileSync(path.join(TM, p), 'utf8');
const all = Object.fromEntries(MATURITY_LEVELS.map((L) => [L.n, `ev/${L.n}.txt`]));

test('maturity: 九级都有证据 → L9，没有缺口', () => {
  const m = decideMaturity(all);
  assert.equal(m.level, 9); assert.equal(m.strictLevel, 9); assert.deepEqual(m.missing, []); assert.equal(m.label, 'L9');
  assert.deepEqual(m.reached, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('maturity: 缺 ④ 照写 —— ①②③⑤⑥ → L6（缺 ④），连续级只到 3', () => {
  const m = decideMaturity({ 1: 'a', 2: 'b', 3: 'c', 5: 'e', 6: 'f' });
  assert.equal(m.level, 6); assert.equal(m.strictLevel, 3); assert.deepEqual(m.missing, [4]); assert.equal(m.label, 'L6（缺 ④）');
  const g = decideMaturity({ 3: 'c', 5: 'e' });
  assert.equal(g.level, 5); assert.equal(g.strictLevel, 0); assert.deepEqual(g.missing, [1, 2, 4]); assert.equal(g.label, 'L5（缺 ①②④）');
});

test('maturity: 没有证据 → L0；只认路径，true / 空串 / 对象 / 越界级都不算', () => {
  assert.equal(decideMaturity({}).level, 0); assert.equal(decideMaturity({}).label, 'L0（无证据）');
  const m = decideMaturity({ 1: true, 2: '', 3: { path: 'x' }, 4: '  ', 5: 'true', 6: null, 10: 'z', 0: 'z', x: 'z' });
  assert.equal(m.level, 0); assert.deepEqual(m.reached, []);
  assert.equal(decideMaturity({ '2': 'p' }).level, 2, '数字字符串键也认');
  assert.equal(maturityLabel({ level: 7, missing: [4] }), 'L7（缺 ④）');
});

test('maturity: 每个达到的级都带一条证据路径', () => {
  const m = decideMaturity({ 1: 'a', 3: 'c', 6: 'f' });
  for (const n of m.reached) assert.ok(typeof m.evidence[n] === 'string' && m.evidence[n].length, '级 ' + n + ' 没有证据');
  assert.deepEqual(Object.keys(m.evidence).map(Number), m.reached);
});

test('maturity: 证据校验不过（文件删了 / 被改了）→ 那一级掉下去', () => {
  const bad = new Set(['ev/6.txt']);
  const m = decideMaturity({ 1: 'ev/1.txt', 2: 'ev/2.txt', 3: 'ev/3.txt', 5: 'ev/5.txt', 6: 'ev/6.txt' }, { verify: (p) => !bad.has(p) });
  assert.equal(m.level, 5); assert.ok(!m.reached.includes(6)); assert.equal(m.evidence[6], undefined);
  const thrower = decideMaturity({ 1: 'a', 2: 'b' }, { verify: (p) => { if (p === 'b') throw Error('坏'); return true; } });
  assert.equal(thrower.level, 1, 'verify 抛错按不成立算');
  const notStrictTrue = decideMaturity({ 1: 'a' }, { verify: () => 'yes' });
  assert.equal(notStrictTrue.level, 0, 'verify 必须严格返回 true');
});

test('maturity: 分布合计等于能力数，谁都没到的级单独列出', () => {
  const rows = [decideMaturity({ 1: 'a', 2: 'b', 3: 'c', 5: 'e', 6: 'f' }), decideMaturity({ 3: 'c', 5: 'e' }), decideMaturity({})].map((r, i) => ({ id: 'demo.' + i, ...r }));
  const d = summarizeMaturity(rows);
  assert.equal(d.total, 3); assert.equal(Object.values(d.byLevel).reduce((a, b) => a + b, 0), 3);
  assert.equal(d.byLevel[6], 1); assert.equal(d.byLevel[5], 1); assert.equal(d.byLevel[0], 1);
  assert.deepEqual(d.missingEverywhere, [4, 7, 8, 9]); assert.match(d.note, /④/);
  assert.equal(d.reachedBy[3], 2); assert.equal(d.gapRows[4], 2);
  const lm = lineMaturity(rows); assert.equal(lm.level, 6); assert.equal(lm.by, 'demo.0'); assert.equal(lm.label, 'L6（缺 ④）'); assert.equal(lm.count, 3);
  assert.equal(lineMaturity([]), null);
});

test('maturity: 统一计数表 —— 五个口径都写明来源代码，唯一对外数字是去重数', () => {
  const ids = COUNT_DEFINITIONS.map((d) => d.id);
  assert.deepEqual(ids, ['sidebar', 'lineage', 'tree-script', 'tree-page', 'unique']);
  for (const d of COUNT_DEFINITIONS) { assert.ok(d.basis.length > 20, d.id); assert.match(d.code, /\.(js|mjs)/, d.id); }
  assert.deepEqual(COUNT_DEFINITIONS.filter((d) => d.primary).map((d) => d.id), ['unique']);
  assert.deepEqual(Object.fromEntries(COUNT_DEFINITIONS.filter((d) => d.seen != null).map((d) => [d.id, d.seen])), { sidebar: 39, lineage: 55, 'tree-script': 64, 'tree-page': 105 });
  const t = buildCountTable({ sidebar: 39, unique: 70, lineage: NaN });
  assert.equal(t.find((r) => r.id === 'sidebar').value, 39); assert.equal(t.find((r) => r.id === 'lineage').value, null, '算不出的不编数');
});

test('maturity 证据校验器：文件、锚点、json 内容都要对，改一处就不成立', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-maturity-'));
  const w = (p, t) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), t); };
  w('learn/data.js', 'window.LEARN=[{id:"1234567890123456789"}]');
  w('lib/mod.js', 'export const x = 1;');
  w('tests/a.test.mjs', "assert.ok(run('demo.alpha'))");
  w('cat/parity/demo.alpha.json', JSON.stringify({ capability: 'demo.alpha', verdict: 'diff-registered' }));
  w('art/x-e2e/run-1/report.json', JSON.stringify({ pass: true })); w('art/x-e2e/run-1/a.png', 'png');
  w('art/y-e2e/run-2/report.json', JSON.stringify({ pass: true, capabilities: ['demo.beta'] })); w('art/y-e2e/run-2/a.png', 'png');
  w('cat/arena/demo.alpha.json', JSON.stringify({ capability: 'demo.alpha', pass: true }));
  w('cat/adoptions.json', JSON.stringify({ adoptions: [{ capability: 'demo.alpha', by: 'user' }, { capability: 'demo.beta', by: 'script' }] }));
  w('cat/defaults.json', JSON.stringify({ defaults: [{ capability: 'demo.alpha', evidence: 'lib/mod.js#x' }, { capability: 'demo.beta', evidence: 'lib/nope.js' }] }));
  const v = makeVerifier(root);
  assert.equal(v('learn/data.js#1234567890123456789', 1), true); assert.equal(v('learn/data.js#9999999999999999999', 1), false);
  assert.equal(v('lib/mod.js', 3), true); assert.equal(v('lib/gone.js', 3), false); assert.equal(v('../etc/passwd', 3), false); assert.equal(v('/etc/hosts', 3), false);
  assert.equal(v('cat/parity/demo.alpha.json#demo.alpha', 4), true); assert.equal(v('cat/parity/demo.alpha.json#demo.beta', 4), false);
  assert.equal(v('tests/a.test.mjs#demo.alpha', 5), true); assert.equal(v('tests/a.test.mjs#demo.alph', 5), false, '要以引号写出完整 ID');
  assert.equal(v('art/x-e2e/run-1/report.json#demo.alpha', 6), true);
  assert.equal(v('art/y-e2e/run-2/report.json#demo.alpha', 6), false, 'report.capabilities 写了就只认写明的'); assert.equal(v('art/y-e2e/run-2/report.json#demo.beta', 6), true);
  assert.equal(v('cat/arena/demo.alpha.json#demo.alpha', 7), true);
  assert.equal(v('cat/adoptions.json#demo.alpha', 8), true); assert.equal(v('cat/adoptions.json#demo.beta', 8), false, '只认用户采用');
  assert.equal(v('cat/defaults.json#demo.alpha', 9), true); assert.equal(v('cat/defaults.json#demo.beta', 9), false, '默认启用的代码位置必须存在');
  const ev = { 1: 'learn/data.js#1234567890123456789', 3: 'lib/mod.js', 5: 'tests/a.test.mjs#demo.alpha', 6: 'art/x-e2e/run-1/report.json#demo.alpha' };
  assert.equal(decideMaturity(ev, { verify: makeVerifier(root) }).level, 6, '篡改前');
  // 篡改：改坏 parity verdict、报告改成 pass:false、删截图、删测试里的 ID（之后用新的校验器，避免读到缓存）
  w('cat/parity/demo.alpha.json', JSON.stringify({ capability: 'demo.alpha', verdict: 'looks-fine' }));
  w('art/x-e2e/run-1/report.json', JSON.stringify({ pass: false })); fs.rmSync(path.join(root, 'art/y-e2e/run-2/a.png'));
  w('tests/a.test.mjs', 'assert.ok(true)');
  const v2 = makeVerifier(root);
  assert.equal(v2('cat/parity/demo.alpha.json#demo.alpha', 4), false); assert.equal(v2('art/x-e2e/run-1/report.json#demo.alpha', 6), false);
  assert.equal(v2('art/y-e2e/run-2/report.json#demo.beta', 6), false, '没有截图就不算 ⑥'); assert.equal(v2('tests/a.test.mjs#demo.alpha', 5), false);
  assert.equal(decideMaturity(ev, { verify: v2 }).level, 3, '篡改后 ⑤⑥ 掉下去');
  fs.rmSync(root, { recursive: true, force: true });
});

test('maturity 加入日期：日志按带点 ID 找最早一段，普通词不匹配', () => {
  const s = logSections('# x\n## 2026-11-20 晚：R10\n做了 demo.alpha 和 waves\n## 2026-11-18：R5\n先提到 `demo.alpha`\n## 无日期\ndemo.beta\n## 2026-11-21\ndemo.alphabet 不是它\n');
  assert.equal(s.length, 4); assert.equal(firstLogMention('demo.alpha', s).date, '2026-11-18');
  assert.equal(firstLogMention('demo.beta', s), null, '没日期的段不算'); assert.equal(firstLogMention('waves', s), null, '不带点的 ID 不查日志');
  assert.equal(firstLogMention('demo.alph', s), null);
});

test('maturity: ⑤ 的测试清单来自 test_workshops.py，并排除本轮自己的测试', () => {
  const t = unitTestFiles(REPO);
  assert.match(t.basis, /单元清单/); assert.ok(t.files.some((f) => f.endsWith('capability-tree.test.mjs')));
  assert.ok(!t.files.some((f) => /capability-maturity\.test|recent-additions\.test/.test(f)));
});

test('maturity: 生成的 json（若已生成）每个达到的级都有证据且证据现在仍成立', (t) => {
  const file = path.join(REPO, OUTPUT);
  if (!fs.existsSync(file)) { t.skip('capability-maturity.json 还没生成（先跑 build-capability-maturity.mjs）'); return; }
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), v = makeVerifier(REPO);
  assert.ok(j.rows.length > 0); assert.equal(new Set(j.rows.map((r) => r.id)).size, j.rows.length, '行按 ID 去重');
  assert.equal(j.counts.find((c) => c.id === 'unique').value, j.rows.length);
  for (const r of j.rows) {
    for (const n of r.reached) assert.ok(v(r.evidence[n], n), `${r.id} 级 ${n} 证据失效：${r.evidence[n]}`);
    assert.equal(r.level, r.reached.length ? Math.max(...r.reached) : 0, r.id);
    assert.ok(r.added && r.added.basis, r.id + ' 缺加入日期依据');
  }
  assert.equal(Object.values(j.distribution.byLevel).reduce((a, b) => a + b, 0), j.rows.length);
});

test('maturity 界面接线：能力树按级显示、左栏带徽章并写口径、缺数据时降级', () => {
  const ui = fs.readFileSync(path.join(REPO, 'townscaper-web/REACodeRefactoring/src/ui/capability-tree.js'), 'utf8');
  assert.match(ui, /maturity = null/); assert.match(ui, /ctree-mat/); assert.match(ui, /ctree-matdist/); assert.match(ui, /成熟度数据未生成/); assert.match(ui, /executablesUnique/);
  assert.match(fs.readFileSync(path.join(REPO, 'townscaper-web/REACodeRefactoring/src/core/capability-tree.js'), 'utf8'), /executablesUnique:/);
  const lw = read('src/scene-authoring/learning-workshop.js');
  assert.match(lw, /catalog\/capability-maturity\.json/); assert.match(lw, /maturity:treeMaturity/); assert.match(lw, /ui\/capability-tree\.js\?v=maturity-r1/);
  const sb = read('src/system-workshop/capability-sidebar.js');
  assert.match(sb, /catalog\/capability-maturity\.json/); assert.match(sb, /cap-mat/); assert.match(sb, /全系统去重/); assert.match(sb, /成熟度数据未生成/);
  assert.ok(!/textContent = `可执行 \$\{/.test(sb), '左栏不能再是裸的「可执行 N」');
  const studio = read('src/scene-authoring/studio.js');
  assert.match(studio, /capability-sidebar\.js\?v=cap-detail-r1/); assert.match(studio, /learning-workshop\.js\?v=maturity-r5/);
  assert.ok(!read('pipeline.html').includes('studio.js?v=lineage-r8'), 'studio.js 改了，pipeline.html 版本号要加');
  assert.match(read('src/scene-authoring/studio.css'), /\.cap-mat\{/);
  assert.match(read('tools/scene-authoring/test_workshops.py'), /'capability-maturity'/);
  const guide = read('docs/CAPABILITY_PIPELINE_GUIDE.md'), g52 = guide.slice(guide.indexOf('### 5.2'), guide.indexOf('### 5.3'));
  assert.ok(g52.includes('export-learn-queue.mjs') && g52.indexOf('build-capability-maturity.mjs') > g52.indexOf('export-learn-queue.mjs'), 'Guide §5.2 第 ⑦ 步在 export-learn-queue 之后');
});
