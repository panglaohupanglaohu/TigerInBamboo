// R31 端到端：十二门徒地形管线（apostles.soft / apostles.palette）在系统工坊里看得见、自动预装、一键执行、预览真的换了外观、放弃能回去。
//   新隔离上下文（不写任何开关）→ pipeline.html#scene → 选十二门徒 → 十二门徒地形面板出现、左栏能找到两个能力 →
//   扫描后自动预装 2 个节点 → 点 ▶ 执行管线 → 候选验证（不是 ✗）→ 游戏 iframe 带 ?apostlesLook=soft,palette 重载，实景外观 = palette+soft →
//   点「放弃」→ 回到默认 soft（2026-11-25 定案）。全程断言 localStorage 里 tm.apostles.look.v1 / tm.apostles.look.choice.v1 都没被写（不改默认）。
//   截图 artifacts/apostles-terrain-pipeline-e2e/run-*/：1-mounted.png、2-preloaded.png、3-candidate.png、4-reverted.png。
// 运行：cd TigerMessenger && $NODE tests/apostles-terrain-pipeline-browser.mjs   （需要 8931 服务；一次预览要重载游戏，整段约 5–10 分钟）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, BASE, waitApostlesStable, expect } from './lib/apostles-e2e.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/apostles-terrain-pipeline-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, capabilities: ['apostles.soft', 'apostles.palette'], steps: {}, errors: [], pass: false };
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
const W = '#apostles-terrain-workshop', shot = (n) => page.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
const note = () => page.locator(W + ' .agent-note').textContent();
const storage = () => page.evaluate(() => ({ look: localStorage.getItem('tm.apostles.look.v1'), choice: localStorage.getItem('tm.apostles.look.choice.v1') }));
const liveLook = () => page.evaluate(() => document.querySelector('.apt-side p[data-look]')?.dataset.look || null);
try {
  await page.goto(BASE + 'pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#scene option')].some((o) => o.value === 'apostles'), {}, { timeout: 90000 });
  await page.locator('#scene').selectOption('apostles');
  await page.waitForFunction((W) => document.querySelector(W + ' .tier-lane') && getComputedStyle(document.querySelector(W)).display !== 'none', W, { timeout: 180000 });
  const mounted = await page.evaluate((W) => { const el = document.querySelector(W); return { height: Math.round(el.getBoundingClientRect().height), sidebarSoft: (document.getElementById('capability-sidebar')?.textContent || '').includes('十二门徒软坡'), sidebarPalette: (document.getElementById('capability-sidebar')?.textContent || '').includes('十二门徒库地形色'), compare: !!document.querySelector('#apostles-compare'), cards: [...document.querySelectorAll('#apostles-compare .apt-card')].map((c) => c.dataset.scheme), sceneApostles: document.body.dataset.sceneApostles }; }, W);
  report.steps.mounted = mounted; await page.locator(W).scrollIntoViewIfNeeded(); await shot('1-mounted');
  expect(mounted.height >= 300, '十二门徒地形面板太矮：' + mounted.height); expect(mounted.sceneApostles === '1', 'body[data-scene-apostles] 没设');
  expect(mounted.sidebarSoft && mounted.sidebarPalette, '左栏能力库里找不到「十二门徒软坡」「十二门徒库地形色」');
  expect(mounted.compare && mounted.cards.join() === 'approved,soft,soft+palette', '三套对照卡片不全：' + mounted.cards);
  await page.waitForFunction((W) => /扫描完成|扫描失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 360000 });
  await page.waitForTimeout(800);
  const pre = { note: await note(), nodes: await page.locator(W + ' .tier-node:not(.pending)').count(), names: await page.locator(W + ' .tier-node:not(.pending) strong').allTextContents(), live: await liveLook() };
  report.steps.preloaded = pre; await shot('2-preloaded');
  expect(!/扫描失败/.test(pre.note), '扫描失败：' + pre.note); expect(pre.nodes === 2, '自动预装节点数 ' + pre.nodes); expect(/自动预装/.test(pre.note), '提示里没有「自动预装」：' + pre.note);
  expect(pre.live === 'soft', '没带开关时实景应是默认 soft，读到 ' + pre.live);
  report.steps.storageBefore = await storage();
  await page.locator(W + ' .tier-head-actions .primary').click();
  await page.waitForFunction((W) => /候选/.test(document.querySelector(W + ' .agent-result h4')?.textContent || '') || /执行失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 900000 });
  // 预览会重载游戏：等实景外观变成 palette+soft（工坊侧栏 data-look），再用 stable-wait 直接在游戏里确认
  await page.waitForFunction(() => document.querySelector('.apt-side p[data-look]')?.dataset.look === 'palette+soft' || /执行失败/.test(document.querySelector('#apostles-terrain-workshop .agent-note')?.textContent || ''), {}, { timeout: 900000 });
  const w = await waitApostlesStable(page, { need: 3 });
  const cand = { h4: await page.locator(W + ' .agent-result h4').textContent().catch(() => null), note: await note(), checks: await page.locator(W + ' .agent-result .verify-checks li').allTextContents(), live: await liveLook(), stable: { ok: w.ok, look: w.sample?.look, count: w.sample?.count }, iframe: await page.locator('#game').getAttribute('src'), storage: await storage() };
  report.steps.candidate = cand; await page.locator('#game').scrollIntoViewIfNeeded(); await shot('3-candidate');
  expect(cand.h4 && /候选/.test(cand.h4) && !/未通过/.test(cand.h4), '候选没出来或验证未通过：' + cand.h4 + ' / ' + cand.note);
  expect(w.ok && w.sample.look === 'palette+soft', '预览后游戏里的外观不是 palette+soft：' + JSON.stringify(cand.stable));
  expect(/apostlesLook=soft(%2C|,)palette/.test(cand.iframe || ''), 'iframe 没带 ?apostlesLook=soft,palette：' + cand.iframe);
  expect(!cand.storage.look && !cand.storage.choice, '预览写了 localStorage：' + JSON.stringify(cand.storage));
  await page.locator(W + ' .agent-actions button', { hasText: '放弃' }).click();
  await page.waitForFunction(() => document.querySelector('.apt-side p[data-look]')?.dataset.look === 'soft', {}, { timeout: 900000 });
  const back = await waitApostlesStable(page, { need: 3 });
  report.steps.reverted = { live: await liveLook(), stable: { ok: back.ok, look: back.sample?.look }, storage: await storage(), note: await note() };
  await shot('4-reverted');
  expect(back.ok && back.sample.look === 'soft', '放弃后没回到默认 soft'); expect(!report.steps.reverted.storage.look && !report.steps.reverted.storage.choice, '放弃后 localStorage 被写了');
  report.pass = !report.errors.some((e) => e.startsWith('pageerror'));
  if (!report.pass) throw Error('页面错误：' + report.errors.filter((e) => e.startsWith('pageerror')).join(' | '));
} catch (e) { report.failure = e.message; try { await shot('zz-failure'); } catch {} }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
await browser.close(); process.exit(report.pass ? 0 : 1);
