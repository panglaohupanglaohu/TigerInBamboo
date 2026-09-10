import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';

const root = new URL('../', import.meta.url);
const base = process.env.STORYBOARD_BASE_URL || 'http://127.0.0.1:8765/TigerMessenger/';
const runId = `world-panel-${Date.now()}`;
const out = new URL(`artifacts/swamp-rescue-level/${runId}/`, root);
await mkdir(out, { recursive: true });
await writeFile(new URL('capture-contract.json', out), JSON.stringify({
  runId, captures: [{ mode: 'desktop', viewport: { width: 1280, height: 900 }, state: 'original-game-workbench-armor-config', screenshot: 'world-armor-config.png' }],
  scope: 'Actual game workbench, no scenario execution or playthrough'
}, null, 2));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const draft = { title: '已有草稿不变', story: '实景工作台测试', shots: [{ id: 'original', title: '原镜头', note: '保留', assets: [] }] };
  await context.addInitScript(value => localStorage.setItem('tm.storyboard.workspace.v1', JSON.stringify(value)), draft);
  await page.goto(`${base}?autostart=1&timeOfDay=0.38`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#storyboard-toggle').waitFor({ timeout: 60000 });
  await page.locator('#storyboard-toggle').click();
  const loaded = page.waitForResponse(response => response.url().endsWith('/godot/data/levels/swamp-rescue-v1.json'));
  await page.locator('#sb-level-config > summary').click();
  const response = await loaded;
  assert.equal(response.status(), 200);
  const served = await response.body();
  const local = await readFile(new URL('godot/data/levels/swamp-rescue-v1.json', root));
  assert.deepEqual(served, local, 'real server serves current configuration');
  await page.getByText('已配置 · 尚未部署到游戏（只读查看）', { exact: true }).waitFor();
  assert.equal(await page.locator('.sb-level-stage').count(), 16);
  const armor = page.locator('.sb-level-stage').filter({ hasText: '镜 07C · 借来的盔甲' });
  await armor.locator('summary').click();
  await armor.evaluate(node => node.scrollIntoView({ block: 'nearest' }));
  assert((await armor.innerText()).includes('防护组件已真实安装'));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tm.storyboard.workspace.v1'))), draft);
  assert.equal(await page.locator('#sb-title').inputValue(), draft.title);
  await page.screenshot({ path: new URL('world-armor-config.png', out).pathname });
  assert.deepEqual(pageErrors, []);
  const report = { passed: true, runId, base, stages: 16, oldDraftPreserved: true, pageErrors,
    configSha256: createHash('sha256').update(served).digest('hex'),
    scope: 'Actual game UI and same-origin data loaded; no combat, capture, retrofit, escort or boarding gameplay claimed.' };
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log('STORYBOARD_WORLD_PANEL_OK', JSON.stringify({ ...report, artifacts: out.pathname }));
} finally {
  await browser.close();
}
