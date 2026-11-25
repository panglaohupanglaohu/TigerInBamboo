// pipeline-model 的 10 个 live/editor 能力（voxel 层）实景端到端：
//   莫西斯湖真实场景 → 管线 apply 把配方设置真实下发到 stage.feature（waves/reflection/time/
//   outline/grid/vegetation/birds/fog/snow/fire）→ plugin.settings() 回读真实开关态断言翻转 →
//   capture 编码往返 + cap.preview/revert 体素链路（terrain.preserve/building.edit 的编辑器数据通路）
//   → 截图 → baseline 还原。不碰本机存档。
// 运行：cd TigerMessenger && $NODE tests/morris-live-browser.mjs   （需要 8931 服务，约 1–2 分钟）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(HERE, '..', 'artifacts', 'morris-live-e2e', 'run-' + Date.now());
fs.mkdirSync(out, { recursive: true });

const NODES = ['terrain.preserve', 'building.edit', 'water.surface', 'light.time', 'world.ink',
  'vegetation.layers', 'animals.birds', 'weather.atmosphere', 'effects.fire', 'life.layers']
  .map((id) => ({ id, enabled: true }));
const recipe = (settings) => ({ version: 1, scene: 'morris-lake', goal: 'live 控件实景验收', nodes: NODES, settings });
const OFF = { waves: false, reflection: false, time: 'dusk', outline: false, grid: true, vegetation: false, birds: false, fog: true, snow: true, fire: false };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const report = { scene: 'morris-lake', capabilities: [], errors: [], steps: {}, pass: false };
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
const gameCmd = (action, payload = {}) => page.evaluate(([a, pl]) => new Promise((res) => {
  const id = Math.random().toString(36).slice(2);
  const h = (e) => { if (e.data?.type === 'tm.pipeline.reply' && e.data.id === id) { removeEventListener('message', h); res(e.data.error ? { error: e.data.error } : e.data.result); } };
  addEventListener('message', h);
  document.querySelector('iframe').contentWindow.postMessage({ type: 'tm.pipeline.command', id, action: a, payload: pl }, location.origin);
  setTimeout(() => res({ timeout: true }), 30000);
}), [action, payload]);
const gameShot = async (n) => page.locator('#game').screenshot({ path: path.join(out, n + '.png') });
const fail = (m) => { report.failure = m; throw Error(m); };

try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((s) => [...document.querySelectorAll('#scene option')].some((o) => o.value === s), 'morris-lake', { timeout: 90000 });
  await page.locator('#scene').selectOption('morris-lake');
  // 带参重载游戏 iframe：morrisInk=1 解锁描线开关（默认关时 outline 只能 false）、
  // morrisWinter=0 解除冬季锁（默认冬季把 fog/snow 锁成常开，关不了）——双向翻转才是真实开关证据
  await page.evaluate(() => {
    const url = new URL('index.html', location.href);
    for (const [k, v] of Object.entries({ dev: '1', authoringEmbed: '1', authoringRevision: 'edit-r2', citadelRuntime: '1', morrisInk: '1', morrisWinter: '0' })) url.searchParams.set(k, v);
    document.querySelector('#game').src = url.href;
  });
  await page.waitForTimeout(2500);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  report.steps.mount = 'ok';

  // 编辑器数据通路：capture（encode+settings 快照）→ cap.preview 载回（decode+load）→ revert
  const cap = await gameCmd('capture', recipe({}));
  if (!cap?.snapshot?.data || !cap.snapshot.settings) fail('capture 没拿到世界编码/设置：' + JSON.stringify(cap));
  const pv0 = await gameCmd('cap.preview', { data: cap.snapshot.data, layers: [] });
  if (pv0?.showing !== 'candidate') fail('capture 数据 preview 失败：' + JSON.stringify(pv0));
  const rv = await gameCmd('cap.revert');
  report.steps.editorPath = { encode: cap.snapshot.data.length, preview: pv0.showing, reverted: rv?.reverted === true };
  if (rv?.reverted !== true) fail('revert 失败');

  // live 控件全量下发 + 回读真实 stage 态
  const applied = await gameCmd('apply', recipe(OFF));
  if (applied?.error) fail('apply 失败：' + applied.error);
  const s = applied.settings || {};
  report.steps.applied = s;
  const checks = {
    'water.surface': s.waves === false && s.reflection === false,
    'light.time': s.time === 'dusk',
    'world.ink': s.outline === false && s.grid === true,
    'vegetation.layers': s.vegetation === false,
    'animals.birds': s.birds === false,
    'weather.atmosphere': s.fog === true && s.snow === true,
    'effects.fire': s.fire === false,
    'life.layers': s.vegetation === false && s.birds === false,
  };
  report.steps.checks = checks;
  await page.waitForTimeout(1200);
  await gameShot('1-dusk-fog-snow-no-birds');

  // 反向全量翻转验证不是一次性假读数
  const back = await gameCmd('apply', recipe({ waves: true, reflection: true, time: 'night', outline: true, grid: false, vegetation: true, birds: true, fog: false, snow: false, fire: true }));
  const b = back?.settings || {};
  report.steps.flipBack = b;
  if (!(b.waves === true && b.reflection === true && b.birds === true && b.vegetation === true && b.time === 'night' && b.outline === true && b.grid === false && b.fog === false && b.snow === false && b.fire === true)) fail('回读态没真翻转：' + JSON.stringify(b));
  await page.waitForTimeout(800);
  await gameShot('2-night-clear-birds');

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) fail('live 控件回读不符：' + failed.join(','));
  // 编辑器两能力：capture→preview→revert 链路实测通过即登记
  report.capabilities = ['terrain.preserve', 'building.edit', ...Object.keys(checks)];
  const base = await gameCmd('baseline');
  report.steps.baseline = base?.settings;
  report.pass = !report.errors.length;
} catch (e) {
  report.pass = false; report.failure = report.failure || e.stack || String(e);
  try { await gameCmd('baseline'); } catch {}
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
}
console.log(report.pass ? 'PASS' : 'FAIL', out, '| caps:', report.capabilities.join(','), '|', report.failure || '');
process.exit(report.pass ? 0 : 1);
