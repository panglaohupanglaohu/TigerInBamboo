// R48 / R49 端到端：圣城之外的场景（旧港湾 old-port）用地形管线重做地形——候选，可预览 / 对照 / 拆回，不设默认。
//   新开隔离浏览器 → 直达 pipeline.html?relief=old-port#scene → 面板自己等游戏连上、切到旧港湾、扫描（relief.probe 实景采样）、R22 自动预装 6 个能力
//   → 斜看机位拍原样 → ▶ 执行管线 → 候选验证没有 ✗ → 游戏里真的有 relief-candidate-old-port 网格（实景断言）、原地形被隐藏或叠加模式有说明
//   → 同机位拍候选（与原样截图不能一模一样）+ 俯视 → 「看原样」→「拆掉候选」后游戏里没有候选、原地形全部放回 → 本机存储没写候选 / 默认。
// report.capabilities 写六个能力 ID（成熟度 ⑥ 只认 pass === true 且有截图）。截图要人打开看：重点看岩檐、河谷、梯子、等高线有没有、建筑有没有悬空。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger && $NODE tests/relief-oldport-browser.mjs   （需要 8931 服务；SCENE=moss 可换苔庭）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), SCENE = process.env.SCENE === 'moss' ? 'moss' : 'old-port';
const out = path.resolve(here, `../artifacts/relief-${SCENE}-e2e/run-` + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, scene: SCENE, steps: {}, errors: [], pass: false, capabilities: ['relief.soft', 'relief.cliff', 'relief.valley', 'relief.overhang', 'relief.ledge', 'relief.passes'] };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
const W = '#relief-workshop';
const expect = (c, m) => { if (!c) throw Error(m); };
const note = () => page.locator(W + ' .agent-note').textContent();
const gameShot = async (n) => { const p = path.join(out, n + '.png'); await page.locator('#game').screenshot({ path: p }); return fs.readFileSync(p); };
const panelShot = async (n) => { await page.locator(W).scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(out, n + '.png') }); };
const game = async () => (await page.$('#game')).contentFrame();
const liveState = async () => (await game()).evaluate((id) => { const s = globalThis.__tm?.scene, g = s?.getObjectByName('relief-candidate-' + id); let tris = 0; g?.traverse((o) => { if (o.isMesh) tris += (o.geometry.attributes.position.count / 3) | 0; }); return { group: !!g, visible: !!g?.visible, tris, parts: g ? g.children.map((c) => c.name) : [] }; }, SCENE);
const clickBtn = async (name) => { await page.locator(W).getByRole('button', { name }).first().click(); await page.waitForTimeout(1500); };
const sceneState = () => page.evaluate(() => ({ active: document.getElementById('relief-scene-state')?.dataset.active || null, text: document.getElementById('relief-scene-state')?.textContent || '' }));
const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tm.')).sort());
try {
  await page.goto(`http://localhost:8931/TigerMessenger/pipeline.html?relief=${SCENE}#scene`);
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  report.steps.keysBefore = await keys();
  await page.waitForFunction((W) => document.querySelector(W)?.dataset.direct, W, { timeout: 60000 });
  await page.waitForFunction((W) => /扫描完成|扫描失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 600000 });
  await page.waitForTimeout(1000);
  const pre = { direct: await page.evaluate((W) => document.querySelector(W).dataset.direct, W), scene: await page.evaluate(() => window.__tmCurrentScene), note: await note(), nodes: await page.locator(W + ' .tier-node:not(.pending)').count(), scanned: await page.evaluate((W) => document.querySelector(W).dataset.scanned, W), status: await page.locator('#status').textContent() };
  report.steps.scanned = pre; await panelShot('1-direct-scanned');
  expect(pre.direct === SCENE, '直达没认出场景'); expect(!/扫描失败/.test(pre.note), '扫描失败：' + pre.note + ' / ' + pre.status);
  expect(pre.scanned === SCENE && pre.scene === SCENE, `扫描的不是 ${SCENE}：${pre.scanned} / 当前场景 ${pre.scene}`); expect(pre.nodes === 6, '自动预装节点数 ' + pre.nodes);
  await clickBtn('机位：斜看'); await page.waitForTimeout(2500);
  const shotOriginal = await gameShot('2-original-oblique');
  await page.locator(W + ' .tier-head-actions .primary').click();
  await page.waitForFunction((W) => /候选/.test(document.querySelector(W + ' .agent-result h4')?.textContent || '') || /执行失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 600000 });
  await page.waitForFunction((W) => document.querySelector(W).dataset.gamePreview || /失败/.test(document.querySelector('#status')?.textContent || ''), W, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const cand = await page.evaluate((W) => { const r = document.querySelector(W); return { h4: r.querySelector('.agent-result h4')?.textContent, mode: r.dataset.gamePreview, fails: [...r.querySelectorAll('.agent-result .verify-checks li.check-fail')].map((li) => li.textContent), warns: [...r.querySelectorAll('.agent-result .verify-checks li.check-warn')].map((li) => li.textContent), status: document.getElementById('status')?.textContent }; }, W);
  cand.live = await liveState(); report.steps.candidate = cand;
  expect(/候选/.test(cand.h4 || ''), '没有候选：' + (await note())); expect(cand.fails.length === 0, '验证有失败项：' + cand.fails.join(' | '));
  expect(['replace', 'partial', 'overlay'].includes(cand.mode), '实景预览没贴上：' + cand.status);
  expect(cand.live.group && cand.live.visible && cand.live.tris > (SCENE === 'moss' ? 300 : 500) && cand.live.parts.includes('relief-surface'), '游戏里没有候选网格：' + JSON.stringify(cand.live));
  await clickBtn('机位：斜看'); await page.waitForTimeout(2500);
  const shotCand = await gameShot('3-candidate-oblique');
  expect(!shotCand.equals(shotOriginal), '同机位原样与候选截图一模一样');
  await clickBtn('机位：俯视'); await page.waitForTimeout(2500); await gameShot('4-candidate-top');
  await panelShot('5-panel-candidate');
  await clickBtn('看原样'); await clickBtn('机位：斜看'); await page.waitForTimeout(2000);
  const cmp = { state: await sceneState(), live: await liveState() }; report.steps.compare = cmp; await gameShot('6-compare-original-oblique');
  expect(cmp.state.active === 'original' && cmp.live.group && !cmp.live.visible, '「看原样」没切回原地形：' + JSON.stringify(cmp));
  await clickBtn('看候选'); expect((await sceneState()).active === 'candidate', '「看候选」没切回候选');
  await clickBtn('拆掉候选（回原样）'); await page.waitForTimeout(2000);
  const rev = { state: await sceneState(), live: await liveState() }; report.steps.reverted = rev; await gameShot('7-reverted-oblique');
  expect(rev.state.active === 'none' && !rev.live.group, '拆掉候选后游戏里还有候选：' + JSON.stringify(rev));
  const after = await keys(); report.steps.keysAfter = after;
  const added = after.filter((k) => !report.steps.keysBefore.includes(k));
  expect(added.every((k) => /^tm\.\w+\.pipeline\.v2$/.test(k) || k.startsWith('tm.capability.experience') || k === 'tm.startup.profile.v1'), '多写了本机存储：' + added.join(','));
  expect(!after.some((k) => /relief\.candidate|adopted|default/.test(k) && !report.steps.keysBefore.includes(k)), '写了采用 / 默认 / 候选记录');
  report.pass = report.errors.filter((e) => e.startsWith('pageerror')).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await page.screenshot({ path: path.join(out, 'zz-failure.png') }); } catch {} }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
await browser.close(); process.exit(report.pass ? 0 : 1);
