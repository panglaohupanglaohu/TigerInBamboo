// R31：十二门徒 soft / palette 两个开关做成工坊里的可执行能力（地形线）。合成岛：两块岩体（1 层台阶的缓坡台地 / 2 层起跳的平顶台地）。
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { describeApostlesTerrainCapabilities, matchAll, runPlan, APOSTLES_TERRAIN_CAPABILITIES, softSteps, lookParam, lookId } from '../src/system-workshop/apostles-terrain/capabilities.js';
import { verifyApostlesTerrain } from '../src/system-workshop/apostles-terrain/verify.js';
import { createWorkerEngine } from '../src/pipeline-engine/worker-adapters.js';
import { executionContext } from '../src/pipeline-engine/PipeLineEngine.js';
import { planPreload } from '../src/system-workshop/auto-preload.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
function mass(id, order, step) {
  const n = 24, xz = [], lv = [], edges = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i - 12, z = j - 12, r = Math.hypot(x, z); xz.push(x, z); lv.push(r > 10 ? 0 : step === 1 ? 1 + Math.floor((10 - r) / 1.5) : 1 + 2 * Math.floor((10 - r) / 3)); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n + i; for (const b of [i + 1 < n ? a + 1 : -1, j + 1 < n ? a + n : -1]) if (b >= 0 && lv[a] > 0 && lv[b] > 0) edges.push(a, b); }
  return { id, order, seed: 7300 + order * 101, spire: false, scale: 2.1, xz, lv, edges, colors: { top: '#9fbf55', wall: '#d8d2c2' } };
}
const site = (masses = [mass('front-left', 3, 1), mass('back-right', 1, 2)]) => ({ ok: true, scene: 'apostles', look: { id: 'approved', soft: false, palette: false }, masses });
const BOTH = [{ id: 'apostles.soft' }, { id: 'apostles.palette' }];
const caps = describeApostlesTerrainCapabilities();

test('§5.3 meta：id / name / domain / line=terrain / requires / modules，modules 是 run 真正 import 的库模块', () => {
  const src = read('../src/system-workshop/apostles-terrain/capabilities.js');
  assert.deepEqual(caps.map((c) => c.id), ['apostles.soft', 'apostles.palette']);
  for (const c of caps) {
    for (const k of ['id', 'name', 'domain', 'line']) assert.ok(typeof c[k] === 'string' && c[k], c.id + ' 缺 ' + k);
    assert.equal(c.line, 'terrain'); assert.ok(Array.isArray(c.requires)); assert.ok(c.modules.length, c.id + ' 没有 modules'); assert.equal(c.executable, true);
    for (const m of c.modules) { assert.ok(fs.existsSync(new URL('../../townscaper-web/REACodeRefactoring/' + m, import.meta.url)), m); assert.ok(src.includes(`REACodeRefactoring/${m}'`), '声明了但没有 import：' + m); }
  }
  assert.deepEqual(caps.find((c) => c.id === 'apostles.soft').learn, ['1447488323845509121'], '软坡挂在「软坡与陡崖无缝结合」那条来源上');
});
test('match：两块有陆地、有颜色的岩体都能作用；没有数据的岩体跳过', () => {
  const s = site([...site().masses, { id: 'bay-1', order: 5, missing: '岩体没有 World 数据' }]);
  assert.deepEqual(matchAll(s).map((m) => [m.id, m.count]), [['apostles.soft', 2], ['apostles.palette', 2]]);
});
test('执行 + 独立验证：soft,palette 候选，不写存档，复算一致', () => {
  const s = site(), rep = runPlan(s, BOTH);
  assert.deepEqual(rep.map((r) => [r.id, r.status, r.line]), [['apostles.soft', 'applied', 'terrain'], ['apostles.palette', 'applied', 'terrain']]);
  assert.equal(s.plan.look, 'soft,palette'); assert.equal(s.plan.lookId, 'palette+soft'); assert.equal(s.plan.persist, false);
  const v = verifyApostlesTerrain(site(), s.plan, { steps: rep });
  assert.notEqual(v.status, 'fail', v.summary);
  const c = Object.fromEntries(v.checks.map((x) => [x.id, x.status]));
  for (const id of ['flags', 'steps', 'nosave', 'scope', 'soft-recount', 'palette-recount']) assert.equal(c[id], 'pass', id);
});
test('只开软坡：look=soft；网址参数写法与 APOSTLES_LOOK.id 写法', () => {
  const s = site(); runPlan(s, [{ id: 'apostles.soft' }]); assert.equal(s.plan.look, 'soft'); assert.equal(s.plan.lookId, 'soft');
  assert.equal(lookParam(['palette', 'soft']), 'soft,palette'); assert.equal(lookId(['soft', 'palette']), 'palette+soft'); assert.equal(lookParam([]), 'approved');
});
test('确定性：同输入同结果；步骤乱序也按固定顺序算，报告按声明顺序', () => {
  const a = site(), b = site(), c = site(); runPlan(a, BOTH); runPlan(b, BOTH); const rc = runPlan(c, [...BOTH].reverse());
  assert.deepEqual(a.plan, b.plan); assert.deepEqual(a.plan, c.plan); assert.deepEqual(rc.map((r) => r.id), ['apostles.palette', 'apostles.soft']);
});
test('软坡量得出诊断结论 3：2 层起跳的平顶台地没有可融台阶，1 层台阶的才有', () => {
  const one = softSteps(mass('a', 0, 1)), two = softSteps(mass('b', 1, 2));
  assert.equal(two.soft1, 0); assert.equal(two.sharp1, 0); assert.ok(two.cliff2 > 0);
  assert.equal(one.cliff2, 0); assert.ok(one.soft1 + one.sharp1 > 0); assert.ok(one.softShare >= 0 && one.softShare <= 1); assert.equal(one.soft1 + one.sharp1, mass('a', 0, 1).edges.length / 2 - one.flat, '每条差 1 层的边要么可融要么在陡崖省');
  const s = site([mass('b', 1, 2)]); const rep = runPlan(s, [{ id: 'apostles.soft' }]);
  const v = verifyApostlesTerrain(site([mass('b', 1, 2)]), s.plan, { steps: rep });
  assert.equal(v.checks.find((x) => x.id === 'soft-effect').status, 'warn', '可融台阶太少要提醒「画面会接近现状」');
});
test('破坏判失败：改开关 / 改指标 / 打开持久化 / 夹带岩体数据 / 换场景 / 步骤对不上', () => {
  const base = site(), rep = runPlan(base, BOTH), good = base.plan;
  const bad = (mut, s = site(), steps = rep) => { const p = structuredClone(good); mut(p, s); return verifyApostlesTerrain(s, p, { steps }); };
  const failed = (v, id) => v.checks.find((x) => x.id === id)?.status === 'fail' && v.status === 'fail';
  assert.ok(failed(bad((p) => { p.look = 'soft'; }), 'flags'));
  assert.ok(failed(bad((p) => { p.flags.push('latest'); }), 'flags'));
  assert.ok(failed(bad((p) => { p.metrics.soft.total.soft1 += 3; }), 'soft-recount'));
  assert.ok(failed(bad((p) => { p.metrics.palette.mean += 1; }), 'palette-recount'));
  assert.ok(failed(bad((p) => { p.persist = true; }), 'nosave'));
  assert.ok(failed(bad((p) => { p.world = { cells: [1, 2, 3] }; }), 'nosave'));
  assert.ok(failed(bad((p, s) => { s.scene = 'moss'; }), 'scope'));
  assert.ok(failed(bad(() => {}, site(), [{ id: 'apostles.soft' }]), 'steps'));
});
test('PipeLineEngine 适配器：apostles-terrain 走真实能力库，输入不被改，回执齐全', async () => {
  const e = await createWorkerEngine('apostles-terrain'), input = site(), before = structuredClone(input);
  const cat = e.catalog(); assert.deepEqual(cat.map((c) => c.id), ['apostles.soft', 'apostles.palette']); assert.ok(cat.every((c) => c.implementation.startsWith('src/system-workshop/apostles-terrain/capabilities.js#')));
  const sc = await e.scan(input); assert.deepEqual(sc.matches.map((m) => m.count), [2, 2]);
  const out = await e.run(input, BOTH, { context: executionContext('apostles-terrain', 'apostles') });
  assert.deepEqual(input, before); assert.equal(out.plan.look, 'soft,palette'); assert.equal(out.engine.name, 'PipeLineEngine'); assert.equal(out.engine.context.sceneId, 'apostles');
});
test('R22 自动预装：扫描十二门徒后两个能力都进管线；清空过的不再自动填', () => {
  const scan = { matches: matchAll(site()) };
  assert.deepEqual(planPreload({ nodes: [] }, scan, caps).ids, ['apostles.soft', 'apostles.palette']);
  assert.equal(planPreload({ nodes: [], preloadDismissed: true }, scan, caps).reason, 'dismissed');
});
test('岩体顺序与种子和游戏一致（seed = 7300 + 序号 × 101）', () => {
  const target = read('../src/world/twelveApostlesTarget.js'), block = target.slice(target.indexOf('APOSTLE_MASSES=['), target.indexOf('];', target.indexOf('APOSTLE_MASSES=[')));
  const ids = [...block.matchAll(/id:'([\w-]+)'/g)].map((m) => m[1]);
  const probe = read('../src/world/rea/apostlesLookProbe.js'), order = JSON.parse(probe.match(/APOSTLE_MASS_ORDER = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(order, ids); assert.ok(read('../src/world/apostlesReacode.js').includes('seed=7300+mi*101'));
});
test('接线：能力树 / 左栏 / 管线页 / 桥接命令都登记了', async () => {
  const { collectExecutables } = await import('../tools/refactor/build-capability-lineage.mjs');
  const ex = collectExecutables().filter((c) => c.id.startsWith('apostles.')); assert.deepEqual(ex.map((c) => [c.id, c.tier, c.line]), [['apostles.soft', 'scene', 'terrain'], ['apostles.palette', 'scene', 'terrain']]);
  const studio = read('../src/scene-authoring/studio.js'), html = read('../pipeline.html'), bridge = read('../src/scene-authoring/pipeline-bridge.js'), host = read('../src/pipeline-engine/worker-host.js');
  assert.ok(studio.includes("apostles-terrain-workshop.js?v=contract-r2") && studio.includes('apostlesCaps.map(c=>({...c,name:c.name+\'（十二门徒地形）\''), 'studio.js 挂载与左栏'); // R51 契约迁移把四个 workshop 的 studio import 统一升到 contract-r1
  assert.ok(html.includes('id="apostles-terrain-workshop"')); assert.ok(!/studio\.js\?v=(lineage-r8|maturity-r9|recent-r10)"/.test(html), 'studio.js 改了（R31 接线），pipeline.html 的版本号要加');
  for (const cmd of ['apostles.look.state', 'apostles.look.probe', 'apostles.look.checks', 'apostles.look.view']) assert.ok(bridge.includes(`case '${cmd}'`), cmd);
  assert.ok(host.includes("kind==='apostles-terrain'"));
  assert.equal(APOSTLES_TERRAIN_CAPABILITIES.length, 2);
});
