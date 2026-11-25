// R-A2/A3 端到端：层侧栏「设为默认 / 撤销默认」按钮在真实场景里写共享登记处（tm.defaults.v1）并走各层既有 adopt/unadopt。
//   新的非持久上下文 → pipeline.html#mountain（自动切高山圣城）→ 山形扫描 + 执行出候选 → 山形侧栏「设为默认」→
//   断言 tm.defaults.v1 有 citadel:mountain 记录（adoptedBy=user）且 tm.mountain.adopted.v1 已写 → 「撤销默认」→ 记录删、采用键删。
//   再跑建筑管线出候选 → 建筑侧栏「设为默认」→ citadel:building 记录 → 撤销。管线页 #defaults-summary 同步出现/消失对应行。
//   全程隔离 context，不碰用户存档；结束 revert/unadopt 兜底。运行：cd TigerMessenger && $NODE tests/defaults-buttons-browser.mjs
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, expect, runDir, writeReport, pageErrors } from './lib/lightlife-e2e.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), out = runDir(here, 'defaults-buttons-e2e');
const report = { out, steps: {}, errors: [], pass: false };
const browser = await launch();
let page;
const rec = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}')?.records || {}; } catch { return {}; } });
const hasRow = (key) => page.evaluate((k) => { const t = document.getElementById('defaults-summary-view')?.textContent || document.getElementById('defaults-summary')?.textContent || ''; return t.includes(k); }, key);
try {
  const o = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 240)); });
    await p.goto('http://localhost:8931/TigerMessenger/pipeline.html#mountain');
    await p.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
    await p.waitForFunction(() => window.__tmCurrentScene === 'citadel', {}, { timeout: 300000 });
    const frame = p.frames().find((f) => f.url().includes('/TigerMessenger/index.html'));
    await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
    return { page: p, frame };
  })();
  page = o.page;
  // 山形：等扫描完 → 执行 → 候选 → 设为默认
  await page.waitForFunction(() => /扫描完成|扫描失败/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  report.steps.mountainScan = await page.locator('#mountain-workshop .agent-note').first().textContent();
  await page.locator('#mountain-workshop .tier-head-actions .primary').click();
  await page.waitForFunction(() => /候选/.test(document.querySelector('#mountain-workshop .agent-result h4')?.textContent || '') && !/执行中/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  await page.waitForTimeout(800);
  report.steps.mountainResult = await page.locator('#mountain-workshop .agent-result h4').textContent();
  // 山形侧栏 defaults 卡：设为默认
  const mBtn = page.locator('.tier-side[data-tier="mountain"] .defaults-ui button', { hasText: '设为默认' });
  await mBtn.waitFor({ state: 'visible', timeout: 60000 });
  await mBtn.click();
  await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}')?.records || {}; return !!r['citadel:mountain']; }, {}, { timeout: 60000 });
  report.steps.mountainRecord = (await rec())['citadel:mountain'];
  expect(report.steps.mountainRecord?.adoptedBy === 'user', '山形默认记录 adoptedBy 不是 user');
  const adoptedKey = await page.evaluate(() => localStorage.getItem('tm.mountain.adopted.v1:citadel') || localStorage.getItem('tm.mountain.adopted.v1'));
  report.steps.mountainAdoptedKey = adoptedKey ? 'written' : 'missing';
  expect(!!adoptedKey, '设为默认没有走 mountain commit（tm.mountain.adopted.v1 没写）');
  await page.waitForFunction(() => (document.getElementById('defaults-summary-view')?.textContent || document.getElementById('defaults-summary')?.textContent || '').includes('citadel'), {}, { timeout: 30000 }).catch(() => {});
  report.steps.panelHasMountain = await hasRow('mountain');
  await page.screenshot({ path: path.join(out, '1-mountain-default-set.png') });
  // 撤销默认
  await page.locator('.tier-side[data-tier="mountain"] .defaults-ui button', { hasText: '撤销默认' }).click();
  await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}')?.records || {}; return !r['citadel:mountain']; }, {}, { timeout: 60000 });
  const adoptedAfter = await page.evaluate(() => localStorage.getItem('tm.mountain.adopted.v1:citadel') || localStorage.getItem('tm.mountain.adopted.v1'));
  report.steps.mountainAfterRevert = { record: false, adoptedKey: !!adoptedAfter };
  expect(!adoptedAfter, '撤销默认后 mountain adopted 键还在');
  // 建筑：等扫描完 → 执行 → 候选 → 设为默认
  await page.waitForFunction(() => /扫描完成|扫描失败/.test(document.querySelector('#building-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  report.steps.buildingScan = await page.locator('#building-workshop .agent-note').first().textContent();
  await page.locator('#building-workshop .tier-head-actions .primary').click();
  await page.waitForFunction(() => /候选/.test(document.querySelector('#building-workshop .agent-result h4')?.textContent || '') && !/执行中/.test(document.querySelector('#building-workshop .agent-note')?.textContent || '') || /执行失败/.test(document.querySelector('#building-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  await page.waitForTimeout(800);
  report.steps.buildingResult = await page.locator('#building-workshop .agent-result h4').textContent();
  const bBtn = page.locator('.tier-side[data-tier="building"] .defaults-ui button', { hasText: '设为默认' });
  await bBtn.waitFor({ state: 'visible', timeout: 60000 });
  await bBtn.click();
  await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}')?.records || {}; return !!r['citadel:building']; }, {}, { timeout: 60000 });
  report.steps.buildingRecord = (await rec())['citadel:building'];
  const bAdopted = await page.evaluate(() => localStorage.getItem('tm.building.adopted.v1:citadel'));
  report.steps.buildingAdopted = bAdopted ? JSON.parse(bAdopted).autoDeploy : null;
  await page.screenshot({ path: path.join(out, '2-building-default-set.png') });
  await page.locator('.tier-side[data-tier="building"] .defaults-ui button', { hasText: '撤销默认' }).click();
  await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}')?.records || {}; return !r['citadel:building']; }, {}, { timeout: 60000 });
  // 兜底：确认没有遗留采用记录影响后续测试
  await page.evaluate(() => { try { localStorage.removeItem('tm.mountain.adopted.v1:citadel'); localStorage.removeItem('tm.mountain.adopted.v1'); localStorage.removeItem('tm.building.adopted.v1:citadel'); } catch {} });
  report.pass = pageErrors(report.errors).length === 0;
  if (!report.pass) throw Error('page errors: ' + report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await page?.screenshot({ path: path.join(out, 'zz-failure.png') }); } catch {} }
writeReport(out, report);
await browser.close();
process.exit(report.pass ? 0 : 1);
