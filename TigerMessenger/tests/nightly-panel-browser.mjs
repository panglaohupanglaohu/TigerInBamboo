// R40 端到端：管线页「夜间晨报」面板（src/scene-authoring/nightly-panel.js 读 artifacts/nightly/latest.json）。
//   同一个隔离上下文开三页：A 拦截 latest.json 回 404 → 面板降级成一行提示（含 run-nightly.mjs）；
//   B 拦截回一份固定晨报 → 面板显示日期、「新增能力 2」「线升级 1」、单元 9/10 · 1 红，点「明细」列出新增能力与红的测试，链接指向 morning-report.md；
//   C 不拦截 → 读真实文件（Kiro 跑过 run-nightly.mjs 才有），有就 ready、没有就 missing，两种都记下来。
//   截图：A-missing.png、B-ready.png、B-detail.png、C-real.png（只截面板 + 整页各一张）。不写任何数据。
// 运行：cd TigerMessenger && $NODE tests/nightly-panel-browser.mjs   （需要 8931 服务）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/nightly-panel-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, capabilities: [], steps: {}, errors: [], pass: false };
const expect = (c, m) => { if (!c) throw Error(m); };
const FIXTURE = { schemaVersion: 1, date: '2026-11-24', generatedAt: '2026-11-24T03:00:00.000Z', dir: 'artifacts/nightly/2026-11-24', report: 'artifacts/nightly/2026-11-24/morning-report.md', json: 'artifacts/nightly/2026-11-24/morning-report.json',
  headline: { newCapabilities: 2, lineUp: 1, lineDown: 0, better: 1, worse: 1, first: false },
  newCapabilities: [{ id: 'fx.fire', name: '小屋点火', line: 'fire', label: 'L5（缺 ④）' }, { id: 'fx.hallway', name: '涂鸦走廊样板', line: 'hallway', label: 'L5（缺 ④）' }],
  lineChanges: [{ line: 'fire', name: '火焰', from: 0, to: 5, up: true }], metricDeltas: [{ goal: 'fx', name: '走廊板覆盖率', from: 1, to: 0.95, better: false }],
  tests: { drift: { tests: 22, pass: 22, fail: 0, failures: [] }, unit: { tests: 10, pass: 9, fail: 1, failures: ['某个红了的用例'] } },
  tree: { lines: 27, fruit: 27, frontier: [] }, steps: [{ id: 'r5', label: '⑤', status: 'pass' }], goals: [{ id: 'fx', name: 'fx', status: 'run', verify: 'pass' }, { id: 'gscene', name: 'gscene', status: 'NOT_RUN', verify: null }] };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const panel = (p) => p.evaluate(() => { const h = document.getElementById('nightly-report'); return h ? { state: h.dataset.state, date: h.dataset.date || null, text: h.textContent, height: Math.round(h.getBoundingClientRect().height), href: h.querySelector('a')?.getAttribute('href') || null, items: [...h.querySelectorAll('li')].map((li) => li.textContent) } : null; });
async function open(name, route) {
  const p = await ctx.newPage(); p.on('pageerror', (e) => report.errors.push(name + ' pageerror: ' + e.message));
  if (route) await p.route('**/artifacts/nightly/latest.json*', route);
  await p.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await p.waitForFunction(() => ['ready', 'missing', 'error'].includes(document.getElementById('nightly-report')?.dataset.state), {}, { timeout: 60000 });
  await p.waitForTimeout(500); return p;
}
try {
  const A = await open('A', (r) => r.fulfill({ status: 404, body: 'not found' }));
  report.steps.A = await panel(A); await A.locator('#nightly-report').screenshot({ path: path.join(out, 'A-missing.png') });
  expect(report.steps.A.state === 'missing' && /run-nightly\.mjs/.test(report.steps.A.text), '404 时没降级：' + JSON.stringify(report.steps.A));
  const B = await open('B', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }));
  report.steps.B = await panel(B); await B.locator('#nightly-report').screenshot({ path: path.join(out, 'B-ready.png') }); await B.screenshot({ path: path.join(out, 'B-page.png') });
  expect(report.steps.B.state === 'ready' && report.steps.B.date === '2026-11-24', '固定晨报没显示：' + JSON.stringify(report.steps.B));
  for (const s of ['新增能力 2', '线升级 1', '单元 9/10 · 1 红', '⚙ 27/27 线 · 前沿 0']) expect(report.steps.B.text.includes(s), '面板缺「' + s + '」：' + report.steps.B.text);
  expect(report.steps.B.href === FIXTURE.report, '晨报链接不对：' + report.steps.B.href);
  await B.locator('#nightly-report button', { hasText: '明细' }).click(); await B.waitForTimeout(300);
  report.steps.Bdetail = await panel(B); await B.locator('#nightly-report').screenshot({ path: path.join(out, 'B-detail.png') });
  expect(report.steps.Bdetail.items.some((x) => /fx\.fire/.test(x)) && report.steps.Bdetail.items.some((x) => /红：某个红了的用例/.test(x)), '明细缺内容：' + report.steps.Bdetail.items.join(' | '));
  const C = await open('C', null);
  report.steps.C = await panel(C); await C.locator('#nightly-report').screenshot({ path: path.join(out, 'C-real.png') }); await C.screenshot({ path: path.join(out, 'C-page.png') });
  expect(['ready', 'missing'].includes(report.steps.C.state), '真实文件状态异常：' + report.steps.C.state);
  report.steps.realLatest = fs.existsSync(path.resolve(here, '../artifacts/nightly/latest.json'));
  if (report.steps.realLatest) expect(report.steps.C.state === 'ready', 'latest.json 存在但面板没读出来');
  report.pass = report.errors.filter((e) => /pageerror/.test(e)).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1500); }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
await ctx.close(); await browser.close(); process.exit(report.pass ? 0 : 1);
