// object 层（4 个）+ gscene 层（5 个）缺⑥能力的实景端到端：
//   A. morris-lake → 物件管线：objects.layout 真实布局 → 4 个批量物件能力执行 →
//      objects.preview 实景预览 → 验证 → revert。
//   B. 通用插件场景（书店镇等，views.gscene 只在这类场景挂载）→ gscene.style.get 真实材质 →
//      5 个场景风格能力执行 → gscene.style.preview 实景改色 → 验证 → revert。
// 两段各写一份 artifacts/*-e2e/run-*/report.json + png + capabilities 花名册。
// 运行：cd TigerMessenger && $NODE tests/object-gscene-browser.mjs   （需要 8931 服务，约 2–4 分钟）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const stamp = Date.now();

const OBJECT_CAPS = ['object.path-spacing', 'object.scale-variety', 'object.spacing-relax', 'object.yaw-variety'];
const GSCENE_CAPS = ['scene.oklab-contrast', 'scene.oklab-palette', 'scene.palette-unify', 'scene.style-pack', 'scene.tone'];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const note = (w) => page.locator(w + ' .agent-note').textContent().catch(() => '');
const gameShot = (out, n) => page.locator('#game').screenshot({ path: path.join(out, n + '.png') });
const writeReport = (dir, report) => { const out = path.join(HERE, '..', 'artifacts', dir, 'run-' + stamp); fs.mkdirSync(out, { recursive: true }); report.out = out; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1)); return out; };
const addCaps = async (ids) => {
  for (const id of ids) {
    const ok = await page.evaluate((cid) => {
      const c = document.querySelector(`#capability-sidebar [data-capability-id="${cid}"]`);
      if (!c) return false;
      c.closest('details')?.setAttribute('open', '');
      c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return true;
    }, id);
    if (!ok) throw Error('侧栏没有能力卡片：' + id);
    await page.waitForTimeout(120);
  }
};
const runPipe = async (W) => {
  await page.locator(W + ' button', { hasText: '执行管线' }).click();
  await page.waitForFunction((w) => document.querySelectorAll(w + ' .verify-checks li').length > 0, W, { timeout: 240000 });
  await page.waitForTimeout(6000);
  const fails = await page.locator(W + ' .verify-checks li.check-fail').allTextContents();
  if (fails.length) throw Error('验证失败：' + fails.join(' | '));
  return { checks: await page.locator(W + ' .verify-checks li').allTextContents(), note: await note(W) };
};

const reports = {};
try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction(() => document.querySelectorAll('#scene option').length > 1, {}, { timeout: 90000 });

  // ── A. 物件管线（morris-lake）───────────────────────────────────────────
  {
    const report = reports.object = { scene: 'morris-lake', capabilities: [], errors, steps: {}, pass: false };
    try {
      await page.waitForFunction((s) => [...document.querySelectorAll('#scene option')].some((o) => o.value === s), 'morris-lake', { timeout: 30000 });
      await page.locator('#scene').selectOption('morris-lake');
      await page.waitForTimeout(1500);
      await page.locator('#object-workshop-tab').click();
      const W = '#object-workshop';
      await page.waitForSelector(W + ' .agent-note', { timeout: 60000 });
      await page.waitForFunction(() => (document.querySelector('#object-workshop .agent-note')?.textContent || '').match(/扫描完成|扫描失败/), {}, { timeout: 180000 });
      report.steps.scan = await note(W);
      if (report.steps.scan.includes('扫描失败')) throw Error(report.steps.scan);
      await addCaps(OBJECT_CAPS);
      report.steps.pipelineNodes = await page.locator(W + ' .tier-node').count();
      if (report.steps.pipelineNodes < 1) throw Error('物件管线没进节点（可编辑物件可能为空）');
      const run = await runPipe(W);
      report.steps.run = run;
      writeReport('object-caps-e2e', report);   // 先定目录好放图；收尾再重写一次带 capabilities/pass
      await page.screenshot({ path: path.join(report.out, '1-workshop.png') });
      await gameShot(report.out, '2-live-objects-preview');
      report.capabilities = OBJECT_CAPS;
      const drop = page.locator(W + ' button', { hasText: '放弃' });
      if (await drop.count()) await drop.first().click();
      report.pass = true;
      writeReport('object-caps-e2e', report);
    } catch (e) { report.failure = e.stack || String(e); writeReport('object-caps-e2e', report); }
  }

  // ── B. gscene 材质管线（通用插件场景）────────────────────────────────────
  {
    const report = reports.gscene = { capabilities: [], errors, steps: {}, pass: false };
    try {
      // 找通用插件场景：逐个试 option，#gscene-workshop 挂上了就是
      const options = await page.evaluate(() => [...document.querySelectorAll('#scene option')].map((o) => ({ id: o.value, label: o.textContent })));
      let picked = null;
      for (const o of options) {
        if (o.id === 'morris-lake') continue;
        await page.locator('#scene').selectOption(o.id);
        const mounted = await page.waitForFunction(() => document.querySelectorAll('#gscene-workshop .agent-note, #gscene-workshop .tier-lane, #gscene-workshop .tier-head-actions').length > 0, {}, { timeout: 45000 }).then(() => true).catch(() => false);
        if (mounted) { picked = o; break; }
      }
      if (!picked) throw Error('没有找到通用插件场景（试过 ' + options.map((o) => o.id).join(',') + '）');
      report.scene = picked.id;
      // #gscene-workshop 只在 data-tier=scene + data-scene-edit=view 时显示
      await page.locator('#scene-workshop-tab').click();
      await page.waitForSelector('#gscene-workshop .tier-head-actions .primary', { state: 'visible', timeout: 30000 });
      const W = '#gscene-workshop';
      await page.waitForFunction(() => (document.querySelector('#gscene-workshop .agent-note')?.textContent || '').match(/扫描完成|扫描失败/), {}, { timeout: 180000 });
      report.steps.scan = await note(W);
      if (report.steps.scan.includes('扫描失败')) throw Error(report.steps.scan);
      // gscene 工坊 autoPreload：扫描后已自动装好命中的能力；缺的再手动补
      const pre = await page.locator(W + ' .tier-node').count();
      if (pre < GSCENE_CAPS.length) await addCaps(GSCENE_CAPS);
      report.steps.pipelineNodes = await page.locator(W + ' .tier-node').count();
      if (report.steps.pipelineNodes < 1) throw Error('材质管线没进节点');
      const run = await runPipe(W);
      report.steps.run = run;
      writeReport('gscene-caps-e2e', report);
      await page.screenshot({ path: path.join(report.out, '1-workshop.png') });
      await gameShot(report.out, '2-live-style-preview');
      report.capabilities = GSCENE_CAPS;
      const drop = page.locator(W + ' button', { hasText: '放弃' });
      if (await drop.count()) await drop.first().click();
      report.pass = true;
      writeReport('gscene-caps-e2e', report);
    } catch (e) { report.failure = e.stack || String(e); writeReport('gscene-caps-e2e', report); }
  }
} finally {
  if (!reports.object?.out) writeReport('object-caps-e2e', reports.object || { pass: false, failure: 'not-run' });
  if (!reports.gscene?.out) writeReport('gscene-caps-e2e', reports.gscene || { pass: false, failure: 'not-run' });
  await browser.close();
}
const allPass = reports.object?.pass && reports.gscene?.pass;
console.log('object:', reports.object?.pass ? 'PASS' : 'FAIL', reports.object?.failure?.split('\n')[0] || reports.object?.capabilities?.join(','));
console.log('gscene:', reports.gscene?.pass ? 'PASS' : 'FAIL', reports.gscene?.failure?.split('\n')[0] || reports.gscene?.capabilities?.join(','));
process.exit(allPass ? 0 : 1);
