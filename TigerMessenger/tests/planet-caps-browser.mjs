// planet 层 22 个能力的实景端到端（球系统管线 · 莫西斯湖所在星球）：
//   真实游戏连接 → iframe 带 planetOskarV1=1 开 V8 星球栈 → 球系统管线扫描 →
//   22 个能力逐个双击进管线 → ▶ 执行管线（真实 transform/verify Worker）→
//   预览钩子把海面样式（sea.preview）和天气/光照样式（weather.preview）直接叠到真实场景，
//   工坊内建检查读 sea.state / weather.state / sea.cost 实测回读 →
//   配方键能力（seed/seaLevel/subdivision/chartLimit/resolution）用游戏自带 ?planetPreview=
//   机制重载 iframe 真渲染候选星球 → 截图 → 恢复。
// 报告写 capabilities 花名册（22 个 planet.*）。
// 运行：cd TigerMessenger && $NODE tests/planet-caps-browser.mjs   （需要 8931 服务，约 3–6 分钟，含两次游戏重载）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(HERE, '..', 'artifacts', 'planet-caps-e2e', 'run-' + Date.now());
fs.mkdirSync(out, { recursive: true });

const W = '#planet-workshop';
const CAPS = [
  'planet.sea-level', 'planet.reseed', 'planet.surface-detail', 'planet.chart-split', 'planet.grid-subdivision',
  'planet.sea-shore-field', 'planet.sea-tint', 'planet.sea-foam', 'planet.sea-waves', 'planet.sea-reflection',
  'planet.weather-kind', 'planet.weather-wind', 'planet.weather-clouds', 'planet.weather-snow-cover', 'planet.weather-fog',
  'planet.light-time', 'planet.light-sun-shadow', 'planet.light-ambient-bounce', 'planet.light-ao',
  'planet.light-ink-rim', 'planet.light-rock', 'planet.light-view-grade',
];
const RECIPE_KEYS = ['seed', 'subdivision', 'chartLimit', 'resolution', 'seaLevel'];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const report = { scene: 'morris-lake', capabilities: [], errors: [], steps: {}, pass: false };
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
const gameShot = async (n) => page.locator('#game').screenshot({ path: path.join(out, n + '.png') });
const fail = (m) => { report.failure = m; throw Error(m); };
const gameUrl = (extra = {}) => page.evaluate((ex) => {
  const url = new URL('index.html', location.href);
  for (const [k, v] of Object.entries({ dev: '1', authoringEmbed: '1', authoringRevision: 'edit-r2', citadelRuntime: '1', ...ex })) url.searchParams.set(k, v);
  return url.href;
}, extra);
const reloadGame = async (extra) => {   // 同 studio.js：先卸到空白页给 WebGL 场景一拍清理，连续直换实测崩过渲染进程
  const u = await gameUrl(extra);
  await page.evaluate(() => { document.querySelector('#game').src = 'about:blank'; });
  await page.waitForTimeout(1500);
  await page.evaluate((url) => { document.querySelector('#game').src = url; }, u);
};
const waitGame = async () => {
  await page.waitForTimeout(2500);
  const f = page.frames().find((f) => f.url().includes('index.html'));
  await f.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 120000 });
  return f;
};

try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });

  // V8 地形栈（planetOskarV1/planetTerrainV1）实测与 citadel 启动地形绑定冲突
  // （CROSSING_STARTUP_CITY_TERRAIN_BINDING_STALE）——默认游戏的 planetPreview 只在
  // 水面+云层上见效，工坊自己也这么写。如实走默认栈。
  // 先做配方键实景预览（游戏自带 ?planetPreview= 机制），趁场景干净时重载——
  // 实测「管线叠满 overlay 后再重载」会崩渲染进程。
  let frame = page.frames().find((f) => f.url().includes('index.html'));
  await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  const pw = await frame.evaluate(() => globalThis.__tmPlanetWorkshop && { ok: globalThis.__tmPlanetWorkshop.ok, layers: globalThis.__tmPlanetWorkshop.layers, recipe: globalThis.__tmPlanetWorkshop.gameRecipe });
  report.steps.planet = pw;
  if (!pw?.ok) fail('星球运行时没起来：' + JSON.stringify(pw));

  const preview = await frame.evaluate(async () => {
    const m = await import('/TigerMessenger/src/system-workshop/planet/capabilities.js');
    const game = globalThis.__tmPlanetWorkshop.gameRecipe;
    let r = { ...game };
    for (const id of ['planet.sea-level', 'planet.reseed', 'planet.surface-detail', 'planet.chart-split', 'planet.grid-subdivision']) {
      const cap = m.PLANET_CAPABILITIES.find((c) => c.meta.id === id);
      const params = {}; for (const [k, d] of Object.entries(cap.meta.params)) params[k] = d.default;
      r = m.cleanRecipe(cap.run(r, params));
    }
    const out = {}; for (const k of ['seed', 'subdivision', 'chartLimit', 'resolution', 'seaLevel']) if (r[k] !== game[k]) out[k] = r[k];
    return out;
  });
  report.steps.recipePreview = preview;
  if (!Object.keys(preview).length) fail('配方键能力和游戏配方没有差异');
  // 独立标签页跑配方键预览（同 ?planetPreview= 机制/同游戏代码；管线页内 iframe 换址实测崩渲染进程）
  const solo = await browser.newPage();
  try {
    await solo.goto(await gameUrl({ planetPreview: JSON.stringify(preview) }));
    await solo.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
    const pw2 = await solo.evaluate(() => ({ preview: globalThis.__tmPlanetWorkshop?.previewOverride, recipe: globalThis.__tmPlanetWorkshop?.recipe, layers: globalThis.__tmPlanetWorkshop?.layers }));
    report.steps.previewApplied = pw2;
    if (!pw2.preview || pw2.preview.seed !== preview.seed) fail('planetPreview 没生效：' + JSON.stringify(pw2));
    await solo.waitForTimeout(4000);
    await solo.screenshot({ path: path.join(out, '1-candidate-planet-preview.png') });
  } finally { await solo.close(); }
  frame = page.frames().find((f) => f.url().includes('index.html'));

  // 切球系统管线页（自动扫描）
  await page.locator('#planet-workshop-tab').click();
  await page.waitForSelector(W + ' .agent-note', { timeout: 30000 });
  await page.waitForFunction(() => (document.querySelector('#planet-workshop .agent-note')?.textContent || '').includes('扫描完成'), {}, { timeout: 120000 });
  report.steps.scan = await page.locator(W + ' .agent-note').textContent();

  // 22 个能力双击进管线（侧栏 dblclick → onActivate → dropInto('planet') → views.planet.add；
  // 卡片在收起的 details 分组里，先展开再派发等效双击）
  for (const id of CAPS) {
    const added = await page.evaluate((cid) => {
      const c = document.querySelector(`#capability-sidebar [data-capability-id="${cid}"]`);
      if (!c) return 'no-card';
      c.closest('details')?.setAttribute('open', '');
      c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return 'ok';
    }, id);
    if (added !== 'ok') fail('侧栏没有这个能力卡片：' + id);
    await page.waitForTimeout(120);
  }
  report.steps.pipelineNodes = await page.locator(W + ' .tier-node').count();
  if (report.steps.pipelineNodes < CAPS.length) fail('管线只进了 ' + report.steps.pipelineNodes + ' / ' + CAPS.length + ' 个节点');

  await page.locator(W + ' button', { hasText: '执行管线' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#planet-workshop .verify-checks li').length > 0, {}, { timeout: 240000 });
  // sea/weather 实景叠加 + 检查（工坊 preview 钩子自己发 sea.preview / weather.preview / weather.state / sea.cost）
  await page.waitForTimeout(20000);
  report.steps.checks = await page.locator(W + ' .verify-checks li').allTextContents();
  report.steps.fails = await page.locator(W + ' .verify-checks li.check-fail').allTextContents();
  report.steps.note = await page.locator(W + ' .agent-note').textContent();
  await page.screenshot({ path: path.join(out, '2-workshop-candidate.png') });
  await gameShot('3-live-sea-weather-overlay');
  if (report.steps.fails.length) fail('实景验证有失败项：' + report.steps.fails.join(' | '));

  // 恢复：工坊放弃候选（sea.revert / weather.revert + 清候选）
  const drop = page.locator(W + ' button', { hasText: '放弃' });
  if (await drop.count()) await drop.first().click();
  report.capabilities = CAPS;
  report.pass = !report.errors.length;
} catch (e) {
  report.pass = false; report.failure = report.failure || e.stack || String(e);
  try { await reloadGame({}); } catch {}
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
}
console.log(report.pass ? 'PASS' : 'FAIL', out, '| caps:', report.capabilities.join(','), '|', report.failure || '');
process.exit(report.pass ? 0 : 1);
