// R103 端到端：光影与生命管线在真实场景（苔庭 moss）扫→预装→执行→实景预览。
//   新开隔离浏览器 → pipeline.html#scene → 选 moss → #lightlife-workshop 自动挂载+扫描（lightlife.probe 实景采样）→ R22 自动预装
//   → ▶ 执行管线 → 候选验证没有 ✗ → lightlife.state 报 previewing + 生命图层（风/烟/动物）→ 同机位截图与原样不同
//   → 「对照原样」→「放弃」后预览清空。report.capabilities 写九个能力 ID（成熟度 ⑥ 认 pass+截图）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger && $NODE tests/lightlife-browser.mjs   （需要 8931 服务；SCENE=old-port 可换）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), SCENE = process.env.SCENE || 'moss';
const out = path.resolve(here, `../artifacts/lightlife-${SCENE}-e2e/run-` + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, scene: SCENE, steps: {}, errors: [], pass: false,
  capabilities: ['scene.town-graph', 'scene.plateau-diag', 'light.voxel-ao', 'light.bounce', 'light.megatex', 'life.plant-atlas', 'life.wind', 'life.smoke', 'life.animals'] };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
const W = '#lightlife-workshop';
const note = () => page.locator(W + ' .agent-note').textContent().catch(() => '');
const gameCmd = (action, payload = {}) => page.evaluate(([a, pl]) => new Promise((res) => {
  const id = Math.random().toString(36).slice(2);
  const h = (e) => { if (e.data?.type === 'tm.pipeline.reply' && e.data.id === id) { removeEventListener('message', h); res(e.data.error ? { error: e.data.error } : e.data.result); } };
  addEventListener('message', h);
  document.querySelector('iframe').contentWindow.postMessage({ type: 'tm.pipeline.command', id, action: a, payload: pl }, location.origin);
  setTimeout(() => res({ timeout: true }), 30000);
}), [action, payload]);
const gameShot = async (n) => { const p = path.join(out, n + '.png'); await page.locator('#game').screenshot({ path: p }); return fs.readFileSync(p); };
try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((s) => [...document.querySelectorAll('#scene option')].some((o) => o.value === s), SCENE, { timeout: 90000 });
  await page.locator('#scene').selectOption(SCENE);
  const frame0 = page.frames().find((f) => f.url().includes('index.html'));
  await frame0.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  await page.waitForFunction((W) => document.querySelector(W + ' .tier-lane'), W, { timeout: 90000 });
  report.steps.mount = 'ok';
  // lightlife 工坊不自动扫：点 ⟳ 扫描（probe 内部会轮询「场景尚未就绪」最多 240s）
  await page.locator(W + ' button', { hasText: '扫描' }).first().click();
  await page.waitForFunction((W) => /扫描完成|扫描失败|没有可作用/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 300000 });
  report.steps.scan = await note();
  if ((report.steps.scan || '').includes('扫描失败')) throw Error('probe scan failed: ' + report.steps.scan);
  report.steps.probe = await gameCmd('lightlife.probe', { id: SCENE });
  report.steps.pipelineNodes = await page.locator(W + ' .tier-node').count();
  await page.screenshot({ path: path.join(out, '1-pipeline.png') });
  await gameShot('2-original');
  const shotOriginal = fs.readFileSync(path.join(out, '2-original.png'));
  await page.locator(W + ' .tier-head-actions .primary').click();
  await page.waitForFunction((W) => { const r = document.querySelector(W + ' .agent-result h4'); return r && /候选/.test(r.textContent); }, W, { timeout: 300000 });
  report.steps.candidate = await page.locator(W + ' .agent-result h4').textContent();
  report.steps.checks = await page.locator(W + ' .verify-checks li').allTextContents();
  report.steps.fails = await page.locator(W + ' .verify-checks li.check-fail').allTextContents();
  await page.waitForTimeout(2000);
  report.steps.liveState = await gameCmd('lightlife.state');
  await gameShot('3-candidate');
  const shotCand = fs.readFileSync(path.join(out, '3-candidate.png'));
  report.steps.shotDiffers = !shotCand.equals(shotOriginal);
  await page.screenshot({ path: path.join(out, '4-panel-candidate.png') });
  // 对照原样 → 看候选 → 放弃
  await page.locator(W + ' button', { hasText: '对照原样' }).click();
  await page.waitForTimeout(800);
  report.steps.compare = await gameCmd('lightlife.state');
  await page.locator(W + ' button', { hasText: '看候选' }).click();
  await page.waitForTimeout(800);
  await page.locator(W + ' button', { hasText: '放弃' }).click();
  await page.waitForTimeout(1000);
  report.steps.reverted = await gameCmd('lightlife.state');
  const live = report.steps.liveState || {};
  report.pass = !!(report.steps.pipelineNodes >= 6 && report.steps.fails.length === 0 && live.previewing === true
    && (live.life || []).length >= 2 && report.steps.shotDiffers
    && report.steps.compare?.comparing === true && report.steps.reverted?.previewing === false
    && report.errors.filter((e) => e.startsWith('pageerror')).length === 0);
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1200);
  try { await page.screenshot({ path: path.join(out, 'fail-page.png') }); } catch {}
} finally { await ctx.close(); await browser.close(); }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, nodes: report.steps.pipelineNodes, life: report.steps.liveState?.life, out }, null, 1));
process.exit(report.pass ? 0 : 1);
