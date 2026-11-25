// R37–R40 表现层实景端到端的公共部分（不是测试文件本身）：新开隔离浏览器 → pipeline.html#fx（直达表现层，场景跑不了会自动切到十二门徒）
// → 等游戏连上、扫描完、R22 自动预装 → ▶ 执行管线 → 等候选（预览钩子会顺带发 fx.preview 与 fx.live.preview）。
// 只用全新的非持久上下文，从不碰用户的浏览器资料；不点「采用」以外的东西，采用也只写本机草稿（测试上下文里的 localStorage，关掉即没）。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
export const W = '#fx-workshop';
export const FX_SCENES = ['apostles', 'moss', 'citadel', 'bookshop'];
export const expect = (c, m) => { if (!c) throw Error(m); };

export async function openFx(name, { capabilities = [] } = {}) {
  const out = path.resolve(here, `../artifacts/${name}/run-${Date.now()}`); fs.mkdirSync(out, { recursive: true });
  const report = { out, capabilities, steps: {}, errors: [], pass: false };
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
  const shot = (n, opt = {}) => page.screenshot({ path: path.join(out, n + '.png'), ...opt });
  const gameCmd = (action, payload = {}, timeout = 30000) => page.evaluate(([a, pl, to]) => new Promise((res) => { const id = Math.random().toString(36).slice(2); const h = (e) => { if (e.data?.type === 'tm.pipeline.reply' && e.data.id === id) { removeEventListener('message', h); res(e.data.error ? { error: e.data.error } : e.data.result); } }; addEventListener('message', h); document.querySelector('iframe').contentWindow.postMessage({ type: 'tm.pipeline.command', id, action: a, payload: pl }, location.origin); setTimeout(() => res({ timeout: true }), to); }), [action, payload, timeout]);
  const note = () => page.locator(W + ' .agent-note').textContent();
  const finish = async () => {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out, capabilities }, null, 1));
    await ctx.close().catch(() => {}); await browser.close().catch(() => {}); process.exit(report.pass ? 0 : 1);
  };
  return { page, ctx, browser, out, report, shot, gameCmd, note, finish };
}

/** 进表现层、等扫描与自动预装、▶ 执行到出候选。返回候选时的验证列表与实景状态。 */
export async function runFxPipeline(t, { needNodes = [] } = {}) {
  const { page, report, shot, gameCmd, note } = t;
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#fx');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((s) => document.body.dataset.layerFocus === 'fx' && s.includes(window.__tmCurrentScene), FX_SCENES, { timeout: 120000 });
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  await frame.waitForFunction(() => !!globalThis.__tm?.scene && !!globalThis.__tm?.camera, {}, { timeout: 300000 });
  await page.waitForFunction((W) => document.querySelector(W + ' .tier-lane'), W, { timeout: 120000 });
  await page.waitForFunction((W) => /扫描完成|扫描失败|没有可作用/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 240000 });
  report.steps.scene = await page.evaluate(() => window.__tmCurrentScene);
  report.steps.scan = await note(); expect(!/扫描失败/.test(report.steps.scan), '扫描失败：' + report.steps.scan);
  await page.waitForTimeout(800);
  report.steps.nodes = await page.locator(W + ' .tier-node[data-node-id]').evaluateAll((els) => els.map((e) => e.dataset.nodeId));
  await shot('0-preloaded');
  for (const id of needNodes) expect(report.steps.nodes.includes(id), `自动预装里没有 ${id}（现有 ${report.steps.nodes.join(',')}）——可能是这个场景扫描时它没有可作用对象`);
  await page.locator(W + ' .tier-head-actions .primary').click();
  await page.waitForFunction((W) => /候选/.test(document.querySelector(W + ' .agent-result h4')?.textContent || '') || /执行失败/.test(document.querySelector(W + ' .agent-note')?.textContent || ''), W, { timeout: 300000 });
  report.steps.candidate = await page.locator(W + ' .agent-result h4').textContent().catch(() => null);
  report.steps.checks = await page.locator(W + ' .verify-checks li').allTextContents();
  expect(report.steps.candidate && /候选/.test(report.steps.candidate), '没有候选：' + (await note()));
  await page.waitForFunction(() => /实景能力/.test(document.getElementById('fx-live-note')?.textContent || '') && !/执行后放进场景/.test(document.getElementById('fx-live-note')?.textContent || ''), {}, { timeout: 60000 });
  report.steps.liveNote = await page.locator('#fx-live-note').textContent();
  await page.waitForTimeout(2500);   // 让火粒子 / 箭点跑几秒
  report.steps.live = await gameCmd('fx.live.state');
  return { frame };
}

/** 对准某一层拍特写（游戏 iframe 区域），拍完还原镜头。 */
export async function closeUp(t, layer, file) {
  const r = await t.gameCmd('fx.live.focus', { layer });
  t.report.steps['focus-' + layer] = r;
  await t.page.waitForTimeout(1500);
  const box = await t.page.locator('iframe').first().boundingBox();
  await t.shot(file, box ? { clip: box } : {});
  t.report.steps['restore-' + layer] = await t.gameCmd('fx.camera.stop');
  return r;
}
