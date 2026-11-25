// R41 / R46 / R47 端到端：场景管线页「地貌管线」面板——擂台岛上一键跑完六个能力，原版对照与擂台在本页实算。
//   新开隔离浏览器（不带任何本机存档）→ pipeline.html#scene → 地貌管线面板出现（不依赖当前场景）→ ⟳ 扫描擂台岛 → R22 自动预装 6 个节点
//   → ▶ 执行管线 → 候选（验证没有 ✗）+ 候选缩略图画出来 → 「在本页实算对照」六行都没有登记外差异 → 「在本页跑擂台」六行都赢
//   → 本机只多了管线草稿 tm.relief.pipeline.v2（没点「记为候选」就没有 tm.relief.candidate.v1）。每步截图，人必须打开看。
// 这是面板 / 擂台岛的测试，不是实景：report 不写 capabilities（成熟度 ⑥ 不算它）。实景见 tests/relief-oldport-browser.mjs。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger && $NODE tests/relief-arena-browser.mjs   （需要 8931 服务）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/relief-arena-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, steps: {}, errors: [], pass: false, note: '面板 / 擂台岛端到端（不是实景）；截图要人打开看' };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
const W = '#relief-workshop';
const shot = async (n) => { await page.locator(W).scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(out, n + '.png') }); };
const expect = (c, m) => { if (!c) throw Error(m); };
const note = () => page.locator(W + ' .agent-note').textContent();
const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tm.')).sort());
try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction((W) => { const el = document.querySelector(W); return el && el.querySelector('.tier-lane') && getComputedStyle(el).display !== 'none'; }, W, { timeout: 180000 });
  report.steps.keysBefore = await keys();
  const mounted = await page.evaluate((W) => { const el = document.querySelector(W); return { height: Math.round(el.getBoundingClientRect().height), mode: el.dataset.mode, input: document.getElementById('relief-input')?.value, rows: document.querySelectorAll('#relief-evidence-table tr[data-cap]').length, sidebar: ['软坡（缓坡省连续）', '悬垂（崖顶岩檐）', '薄台与攀爬（崖边梯子）'].map((t) => (document.getElementById('capability-sidebar')?.textContent || '').includes(t)) }; }, W);
  report.steps.mounted = mounted; await shot('1-panel');
  expect(mounted.height >= 300, '地貌管线面板太矮：' + mounted.height); expect(mounted.mode === 'arena' && mounted.input === 'arena', '默认输入应是擂台岛');
  expect(mounted.sidebar.every(Boolean), '左栏能力库里找不到地貌能力：' + JSON.stringify(mounted.sidebar));
  await page.waitForFunction(() => document.querySelectorAll('#relief-evidence-table tr[data-cap]').length === 6, {}, { timeout: 30000 });
  await page.locator(W).getByRole('button', { name: '⟳ 扫描' }).first().click();
  await page.waitForFunction((W) => /扫描完成|扫描失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 180000 });
  await page.waitForTimeout(800);
  const pre = { note: await note(), nodes: await page.locator(W + ' .tier-node:not(.pending)').count(), names: await page.locator(W + ' .tier-node:not(.pending) strong').allTextContents(), scanned: await page.evaluate((W) => document.querySelector(W).dataset.scanned, W) };
  report.steps.preloaded = pre; await shot('2-preloaded');
  expect(!/扫描失败/.test(pre.note), '扫描失败：' + pre.note); expect(pre.nodes === 6, '自动预装节点数 ' + pre.nodes); expect(pre.scanned === 'arena', '扫描的不是擂台岛');
  await page.locator(W + ' .tier-head-actions .primary').click();
  await page.waitForFunction((W) => /候选/.test(document.querySelector(W + ' .agent-result h4')?.textContent || '') || /执行失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 300000 });
  await page.waitForTimeout(1200);
  const cand = await page.evaluate((W) => {
    const root = document.querySelector(W), cv = root.querySelector('canvas[data-thumb=after]'), ctx = cv?.getContext('2d'), d = cv && cv.width ? ctx.getImageData(0, 0, cv.width, cv.height).data : [];
    const colors = new Set(); for (let i = 0; i < d.length; i += 16) colors.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    return { h4: root.querySelector('.agent-result h4')?.textContent, previewed: root.dataset.previewed, fails: [...root.querySelectorAll('.agent-result .verify-checks li.check-fail')].map((li) => li.textContent), checks: [...root.querySelectorAll('.agent-result .verify-checks li')].map((li) => li.className + ' ' + li.textContent.slice(0, 80)), thumbW: cv?.width || 0, thumbColors: colors.size, river: colors.has('70,130,175'), caption: root.querySelector('canvas[data-thumb=after] + figcaption')?.textContent };
  }, W);
  report.steps.candidate = cand; await shot('3-candidate');
  expect(/候选/.test(cand.h4 || ''), '没有候选：' + (await note())); expect(cand.fails.length === 0, '验证有失败项：' + cand.fails.join(' | '));
  expect(cand.previewed === '1' && cand.thumbW > 100 && cand.thumbColors > 20, '候选缩略图没画出来'); expect(cand.river, '候选图上没有河');
  await page.locator('#relief-run-parity').click();
  await page.waitForFunction(() => document.getElementById('relief-evidence')?.dataset.parityRun === '1', {}, { timeout: 240000 });
  const parity = await page.evaluate(() => [...document.querySelectorAll('#relief-evidence-table tr[data-cap]')].map((tr) => ({ id: tr.dataset.cap, registry: tr.children[2].textContent, live: tr.children[3].textContent, cls: tr.children[3].className })));
  report.steps.parity = parity; await shot('4-parity');
  expect(parity.length === 6 && parity.every((r) => r.cls === 'ok'), '对照有登记外差异或出错：' + JSON.stringify(parity.filter((r) => r.cls !== 'ok')));
  await page.locator('#relief-run-arena').click();
  await page.waitForFunction(() => document.getElementById('relief-evidence')?.dataset.arenaRun === '1', {}, { timeout: 240000 });
  const arena = await page.evaluate(() => [...document.querySelectorAll('#relief-evidence-table tr[data-cap]')].map((tr) => ({ id: tr.dataset.cap, live: tr.children[5].textContent, cls: tr.children[5].className })));
  report.steps.arena = arena; await shot('5-arena');
  expect(arena.every((r) => r.cls === 'ok'), '擂台有没赢的：' + JSON.stringify(arena.filter((r) => r.cls !== 'ok')));
  const after = await keys(); report.steps.keysAfter = after;
  const added = after.filter((k) => !report.steps.keysBefore.includes(k));
  expect(added.every((k) => k === 'tm.relief.pipeline.v2' || k.startsWith('tm.capability.experience')), '多写了本机存储：' + added.join(','));
  expect(!after.includes('tm.relief.candidate.v1'), '没点「记为候选」却写了候选记录');
  report.pass = report.errors.filter((e) => e.startsWith('pageerror')).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await shot('zz-failure'); } catch {} }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
await browser.close(); process.exit(report.pass ? 0 : 1);
