// voxel/registry 层缺⑥能力的实景端到端：
//   莫西斯湖（唯一挂 capability-runtime 的场景）→ 页面内用 vendor 原代码雕一座合成小镇
//   （岩盘高台 + 穿台高墙 + 双塔 + 海岸楼群 + 铺地内院 + 岩塔）→ cap.preview 载入真实场景
//   → voxel 改造 Worker（PipeLineEngine + 能力库 registry 原代码）scan/run 真跑 13 个能力 →
//   cap.preview 再挂候选体素 + layer3d 显示层 → 截图 → 对照 → revert（不写本机存档）。
// 报告写 capabilities 花名册（只记真实 applied / 显示层真挂上的能力）。
// 运行：cd TigerMessenger && $NODE tests/voxel-caps-browser.mjs   （需要 8931 服务，约 2–4 分钟）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(HERE, '..', 'artifacts', 'voxel-morris-e2e', 'run-' + Date.now());
fs.mkdirSync(out, { recursive: true });

const SCENE = 'morris-lake';
const GEOMETRY_STEPS = [
  { id: 'terrain.arch', params: { count: 1 } },
  { id: 'terrain.overhang', params: { count: 1 } },
  { id: 'terrain.seastack', params: { count: 1 } },
  { id: 'terrain.tunnel', params: { count: 1 } },
  { id: 'terrain.ledge', params: { count: 1 } },
  { id: 'build.lighthouse', params: { count: 1, height: 7 } },
  { id: 'build.assembly', params: { count: 1 } },
];
const LAYER_STEPS = [
  { id: 'terrain.shrub-texture' }, { id: 'water.volume' }, { id: 'build.lighthouse-light' },
  { id: 'effects.smoke' }, { id: 'grid.contours' }, { id: 'world.openness' },
];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const report = { scene: SCENE, capabilities: [], errors: [], steps: {}, pass: false };
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
const gameCmd = (action, payload = {}) => page.evaluate(([a, pl]) => new Promise((res) => {
  const id = Math.random().toString(36).slice(2);
  const h = (e) => { if (e.data?.type === 'tm.pipeline.reply' && e.data.id === id) { removeEventListener('message', h); res(e.data.error ? { error: e.data.error } : e.data.result); } };
  addEventListener('message', h);
  document.querySelector('iframe').contentWindow.postMessage({ type: 'tm.pipeline.command', id, action: a, payload: pl }, location.origin);
  setTimeout(() => res({ timeout: true }), 60000);
}), [action, payload]);
const gameShot = async (n) => page.locator('#game').screenshot({ path: path.join(out, n + '.png') });
const fail = (m) => { report.failure = m; throw Error(m); };

try {
  await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((s) => [...document.querySelectorAll('#scene option')].some((o) => o.value === s), SCENE, { timeout: 90000 });
  await page.locator('#scene').selectOption(SCENE);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  report.steps.mount = 'ok';

  // 雕合成小镇（vendor 原代码，和 morris 同一套 buildQuadGrid/World/encodeWorld）
  const town = await frame.evaluate(async () => {
    const V = '/townscaper-web/REACodeRefactoring/src/';
    const [{ buildQuadGrid }, { decorateCells }, { World }, { encodeWorld }, { setVoxel }] = await Promise.all([
      import(V + 'core/grid.js'), import(V + 'core/spatial.js'), import(V + 'core/world.js'), import(V + 'world/save.js'), import(V + 'capabilities/ops.js')]);
    const grid = decorateCells(buildQuadGrid({ radius: 28, hexSize: 1 }));
    const w = new World(grid);
    const near = (x, z) => grid.cells.reduce((b, c) => { const d = (c.cx - x) ** 2 + (c.cz - z) ** 2; return d < b.d ? { c, d } : b; }, { d: 1e9 }).c;
    const set = (c, h, rock) => { for (let lv = 1; lv <= h; lv++) setVoxel(w, c.id, lv, true, { rock }); };
    // 西侧岩盘 r≤7、h5 全岩（崖顶悬垂 + 薄檐 + 隧道的料）
    for (const c of grid.cells) if (Math.hypot(c.cx + 8, c.cz) <= 7) set(c, 5, true);
    // 一堵穿盘的南北向岩墙 h7（隧道：两端同 5 层、中间岩体高 2 层）
    for (const c of grid.cells) if (Math.abs(c.cx + 10) <= 0.55 && Math.hypot(c.cx + 8, c.cz) <= 6.5) set(c, 7, true);
    // 两座 h8 岩塔隔一格（石拱）
    for (const [x, z] of [[-5.6, 3.2], [-3.4, 3.2]]) set(near(x, z), 8, true);
    // 东侧镇子：铺地内院（r≤2.5 只铺第 1 层非岩）+ 楼群环（r2.5–4.5 非岩 h2–3）
    for (const c of grid.cells) {
      const r = Math.hypot(c.cx - 6, c.cz);
      if (r <= 2.5) setVoxel(w, c.id, 1, true, { rock: false });
      else if (r <= 4.5) set(c, 2 + (c.id % 2), false);
    }
    // 镇中心一根 h6 岩塔（薄檐要的高壁）
    set(near(3.4, 0), 6, true);
    const solid = w.solid.reduce((n, m) => n + (m ? 1 : 0), 0);
    return { data: encodeWorld(w, 'town'), cells: grid.cells.length, solid };
  });
  report.steps.town = { cells: town.cells, solid: town.solid };
  if (town.solid < 50) fail('合成小镇没建起来：' + JSON.stringify(town));

  // 载入真实场景预览（不写本机存档；baseline 由 cap.preview 自己留）
  const pv0 = await gameCmd('cap.preview', { data: town.data, layers: [] });
  if (pv0?.showing !== 'candidate') fail('小镇预览失败：' + JSON.stringify(pv0));
  await page.waitForTimeout(1500);
  await gameShot('1-synthetic-town-live');

  // Worker 真跑（allowed 全放行：合成世界无保护区）
  const allowed = new Array(town.cells).fill(1);
  const run = await page.evaluate(async ([data, allowed, steps]) => {
    const w = new Worker('/TigerMessenger/src/scene-authoring/agent/transform-worker.js', { type: 'module' });
    const call = (msg) => new Promise((res, rej) => {
      const job = Math.random().toString(36).slice(2);
      w.onmessage = ({ data: m }) => { if (m.heartbeat || m.job !== job) return; m.ok ? res(m.result) : rej(Error(m.error)); };
      w.onerror = (e) => rej(Error(e.message));
      w.postMessage({ job, ...msg });
      setTimeout(() => rej(Error('worker timeout')), 240000);
    });
    const scan = await call({ type: 'scan', data, allowed, context: { tier: 'scene', sceneId: 'morris-lake' } });
    const result = await call({ type: 'run', data, allowed, steps, context: { tier: 'scene', sceneId: 'morris-lake' } });
    w.terminate();
    return { scan, result };
  }, [town.data, allowed, [...GEOMETRY_STEPS, ...LAYER_STEPS]]);
  report.steps.scan = Object.fromEntries(run.scan.matches.map((m) => [m.id, m.error ? 'ERR:' + m.error : (m.count ?? 0)]));
  report.steps.run = run.result.report;
  const applied = run.result.report.filter((r) => r.status === 'applied').map((r) => r.id);
  const layersWanted = run.result.report.filter((r) => r.status === 'layer' && r.layer3d).map((r) => r.layer3d);
  if (!applied.length) fail('没有几何能力真正落地：' + JSON.stringify(report.steps.scan));
  if (!run.result.data || run.result.data === town.data) fail('候选编码与原世界相同');
  report.steps.applied = applied; report.steps.layers = layersWanted;

  // 候选 + 全部显示层挂进实景
  const pv = await gameCmd('cap.preview', { data: run.result.data, layers: layersWanted });
  if (pv?.error) fail('cap.preview 失败：' + pv.error);
  if (pv?.showing !== 'candidate') fail('预览没进入候选态：' + JSON.stringify(pv));
  report.steps.preview = pv;
  await page.waitForTimeout(1500);
  await gameShot('2-candidate-layers');
  await gameCmd('cap.show', { which: 'baseline' });
  await page.waitForTimeout(800);
  await gameShot('3-baseline');
  await gameCmd('cap.show', { which: 'candidate' });
  await page.waitForTimeout(500);

  const layerOk = new Set((pv.layers || []).filter((l) => l.count > 0).map((l) => l.name));
  const layerCapOf = { shrubtex: 'terrain.shrub-texture', watervol: 'water.volume', lighthouse: 'build.lighthouse-light', smoke: 'effects.smoke', contours: 'grid.contours', rayvis: 'world.openness' };
  report.capabilities = [...applied, ...[...layerOk].map((n) => layerCapOf[n]).filter(Boolean)];
  report.steps.layerCounts = pv.layers;
  await gameCmd('cap.revert');
  const back = await gameCmd('cap.state');
  report.steps.reverted = back.previewing === false;
  if (!report.steps.reverted) fail('revert 后还在预览态');
  report.pass = !report.errors.length;
} catch (e) {
  report.pass = false; report.failure = report.failure || e.stack || String(e);
  try { await gameCmd('cap.revert'); } catch {}
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
}
console.log(report.pass ? 'PASS' : 'FAIL', out, '| caps:', report.capabilities.join(','), '|', report.failure || '');
process.exit(report.pass ? 0 : 1);
