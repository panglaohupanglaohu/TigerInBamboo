// R46：地貌管线六个可执行能力（软坡 / 硬崖 / 河谷 / 悬垂 / 薄台攀爬 / 三遍）——§5.3 meta、真 import 的库模块、match、执行 + 独立验证、
//   确定性、破坏判失败、PipeLineEngine 适配器、R22 自动预装、接线（谱系 collectExecutables / worker-host / studio / pipeline.html / 桥接）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-pipeline.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { describeReliefCapabilities, matchAll, runPlan, RELIEF_CAPABILITIES, RELIEF_ORDER, lockOf } from '../src/system-workshop/relief/capabilities.js';
import { verifyRelief } from '../src/system-workshop/relief/verify.js';
import { arenaSite, reliefMetrics, pitIds } from '../src/system-workshop/terrain/arena-generic.js';
import { createWorkerEngine } from '../src/pipeline-engine/worker-adapters.js';
import { executionContext } from '../src/pipeline-engine/PipeLineEngine.js';
import { planPreload } from '../src/system-workshop/auto-preload.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ALL = RELIEF_ORDER.map((id) => ({ id }));
const caps = describeReliefCapabilities();
const land = (v) => Number.isFinite(v) && v > 0;
const runAll = () => { const s = arenaSite(); const rep = runPlan(s, ALL); return { s, rep }; };

test('§5.3 meta：id / name / domain / line=terrain / requires / modules，modules 是 run 真正 import 的库模块', () => {
  const src = read('../src/system-workshop/relief/capabilities.js');
  assert.deepEqual(caps.map((c) => c.id), RELIEF_ORDER);
  for (const c of caps) {
    for (const k of ['id', 'name', 'domain', 'line']) assert.ok(typeof c[k] === 'string' && c[k], c.id + ' 缺 ' + k);
    assert.equal(c.line, 'terrain'); assert.equal(c.domain, 'relief'); assert.ok(Array.isArray(c.requires)); assert.equal(c.executable, true);
    assert.ok(c.modules.length, c.id + ' 没有 modules');
    for (const m of c.modules) { assert.ok(fs.existsSync(new URL('../../townscaper-web/REACodeRefactoring/' + m, import.meta.url)), m); }
    // 第一条模块必须是 capabilities.js 里直接 import 的（其余可以是它的下层依赖，例如 river-valley → river-network / depression-fill）
    assert.ok(src.includes(`REACodeRefactoring/${c.modules[0]}'`), '声明了但没有 import：' + c.modules[0]);
    assert.ok(c.learn?.length, c.id + ' 没挂来源帖子');
  }
  assert.deepEqual(caps.find((c) => c.id === 'relief.ledge').learn, ['781957658597269506'], '薄台攀爬挂补学 #7 那条来源');
});
test('擂台岛：固定种子同一座岛，有城（cls 1）和轨道（cls 2）', () => {
  const a = arenaSite(), b = arenaSite();
  assert.deepEqual(a, b); assert.equal(a.n, 61); assert.ok(a.cls.includes(1) && a.cls.includes(2));
  assert.ok(a.h.filter(land).length > 1000, '陆地够大');
});
test('match：六个能力都能作用于擂台岛；坏采样不抛错', () => {
  assert.deepEqual(matchAll(arenaSite()).map((m) => [m.id, m.count]), RELIEF_ORDER.map((id) => [id, 1]));
  assert.ok(matchAll({ ok: false }).every((m) => m.count === 0));
});
test('执行 + 独立验证：完整山体（软坡 + 硬崖 + 河谷 + 悬垂 + 梯子 + 等高线），不写存档，复算通过', () => {
  const { s, rep } = runAll();
  assert.deepEqual(rep.map((r) => [r.id, r.status]), RELIEF_ORDER.map((id) => [id, 'applied']));
  const p = s.plan; assert.equal(p.persist, false); assert.deepEqual(p.applied, RELIEF_ORDER);
  assert.ok(p.valley.river.length > 0, '有河'); assert.ok(p.lips.length > 0, '有岩檐（悬垂）'); assert.ok(p.ladders.length > 0, '有梯子'); assert.ok(p.contours.segs.length > 0, '有等高线');
  const v = verifyRelief(arenaSite(), p, { steps: rep, scene: 'arena' });
  const fails = v.checks.filter((c) => c.status === 'fail'); assert.equal(fails.length, 0, JSON.stringify(fails));
  const c = Object.fromEntries(v.checks.map((x) => [x.id, x.status]));
  for (const id of ['scene', 'persist', 'steps', 'protect', 'coast', 'drain', 'river', 'lips', 'ladders', 'contours']) assert.equal(c[id], 'pass', id);
  const m = reliefMetrics({ n: s.n, cell: s.cell, h: p.h, base: s.h, cls: s.cls, lips: p.lips, ladders: p.ladders });
  // 保护环（cls≠0 外扩 1 圈）一格不动是硬保证：环内原始微坑管线无权抬，只要求可改陆地没有坑
  const lock = lockOf(s), pits = pitIds(p.h, s.n);
  assert.ok(pits.every((id) => lock[id]), `可改区还有排不出去的坑：${JSON.stringify(pits.filter((id) => !lock[id]))}`);
  assert.equal(m.hardEdge, 0, '保护格及外扩一圈不动 → 硬边位移 0');
});
test('确定性：同输入同结果；步骤乱序按固定顺序算，报告按声明顺序；requires 不满足就跳过', () => {
  const a = arenaSite(), b = arenaSite(), c = arenaSite(); runPlan(a, ALL); runPlan(b, ALL); const rc = runPlan(c, [...ALL].reverse());
  assert.deepEqual(a.plan, b.plan); assert.deepEqual(a.plan, c.plan); assert.deepEqual(rc.map((r) => r.id), [...RELIEF_ORDER].reverse());
  const d = arenaSite(), rd = runPlan(d, [{ id: 'relief.overhang' }]);
  assert.equal(rd[0].status, 'no-target'); assert.match(rd[0].changed[0], /缺前置能力/); assert.equal(d.plan.lips.length, 0);
});
test('保护：建筑 / 轨道及外扩 1 圈一格不动；海陆不变', () => {
  const { s } = runAll(), lock = lockOf(s);
  for (let k = 0; k < s.h.length; k++) { if (lock[k] && land(s.h[k])) assert.equal(s.plan.h[k], s.h[k], '保护格被改：' + k); assert.equal(land(s.h[k]), land(s.plan.h[k]), '海陆变了：' + k); }
});
test('破坏判失败：改保护格 / 把陆地变海 / 挖坑 / 岩檐悬空错位 / 梯子够不着 / 等高线不在格边 / 打开持久化 / 换场景 / 步骤对不上', () => {
  const { s, rep } = runAll(), good = s.plan, site = arenaSite(), lock = lockOf(site);
  const bad = (mut, steps = rep, scene = 'arena') => { const p = structuredClone(good); mut(p); return verifyRelief(site, p, { steps, scene }); };
  const failed = (v, id) => v.checks.find((x) => x.id === id)?.status === 'fail' && v.status === 'fail';
  const lk = lock.findIndex((v, k) => v && land(site.h[k])), free = good.h.findIndex((v, k) => land(v) && !lock[k] && !good.valley.river.includes(k));
  assert.ok(failed(bad((p) => { p.h[lk] += 3; }), 'protect'));
  assert.ok(failed(bad((p) => { p.h[free] = null; }), 'coast'));
  assert.ok(failed(bad((p) => { const k = good.valley.river.reduce((a, b) => (good.h[b] > good.h[a] ? b : a)); p.h[k] = 0.4; }), 'drain'), '最上游的河格挖成深坑（仍是陆地）');
  assert.ok(failed(bad((p) => { p.lips[0].bottom = p.lips[0].under - 1; }), 'lips'));
  assert.ok(failed(bad((p) => { p.ladders[0].L = p.ladders[0].drop; }), 'ladders'), '把层高当梯长（原版指出的错）要判失败');
  assert.ok(failed(bad((p) => { p.contours.segs[0][0] += 0.5; }), 'contours'));
  assert.ok(failed(bad((p) => { p.persist = true; }), 'persist'));
  assert.ok(failed(bad(() => {}, rep, 'old-port'), 'scene'));
  assert.ok(failed(bad(() => {}, [{ id: 'relief.soft' }]), 'steps'));
});
test('PipeLineEngine 适配器：relief 走真实能力库，输入不被改，回执齐全', async () => {
  const e = await createWorkerEngine('relief'), input = arenaSite(), before = structuredClone(input);
  const cat = e.catalog(); assert.deepEqual(cat.map((c) => c.id), RELIEF_ORDER); assert.ok(cat.every((c) => c.implementation.startsWith('src/system-workshop/relief/capabilities.js#')));
  const sc = await e.scan(input); assert.equal(sc.matches.length, 6);
  const out = await e.run(input, ALL, { context: executionContext('relief', 'arena') });
  assert.deepEqual(input, before); assert.deepEqual(out.plan.applied, RELIEF_ORDER); assert.equal(out.engine.name, 'PipeLineEngine'); assert.equal(out.engine.context.sceneId, 'arena');
});
test('R22 自动预装：扫描后六个能力都进管线；清空过的不再自动填', () => {
  const scan = { matches: matchAll(arenaSite()) };
  assert.deepEqual(planPreload({ nodes: [] }, scan, caps).ids, RELIEF_ORDER);
  assert.equal(planPreload({ nodes: [], preloadDismissed: true }, scan, caps).reason, 'dismissed');
});
test('接线：能力树（collectExecutables）/ Worker / 左栏 / 管线页 / 桥接命令都登记了，版本号已加', async () => {
  const { collectExecutables } = await import('../tools/refactor/build-capability-lineage.mjs');
  const ex = collectExecutables().filter((c) => c.id.startsWith('relief.')); assert.deepEqual(ex.map((c) => [c.id, c.tier, c.line]), RELIEF_ORDER.map((id) => [id, 'scene', 'terrain']));
  const studio = read('../src/scene-authoring/studio.js'), html = read('../pipeline.html'), bridge = read('../src/scene-authoring/pipeline-bridge.js'), host = read('../src/pipeline-engine/worker-host.js'), adapters = read('../src/pipeline-engine/worker-adapters.js');
  assert.ok(adapters.includes("kind==='relief'") && adapters.includes('relief/capabilities.js?v=relief-r2'));
  // 共享文件的缓存串取「最后改动它的批次」：worker-adapters 现为 light-r65（lightlife 适配器），studio.js 现为 light-r70；relief 自身接线现为 relief-r2
  assert.ok(host.includes("kind==='relief'") && /worker-adapters\.js\?v=[\w-]+/.test(host), 'worker-host 要带版本号引入 worker-adapters');
  assert.ok(read('../src/system-workshop/relief/transform-worker.js').includes('worker-host.js?v=relief-r1'));
  assert.ok(studio.includes('relief-workshop.js?v=relief-r2') && studio.includes("reliefCaps.map(c=>({...c,name:c.name+'（地貌管线）'"), 'studio.js 挂载与左栏');
  assert.ok(/relief\\\.\(probe\|preview\)/.test(studio), 'probe / preview 走 90 秒超时');
  assert.ok(html.includes('id="relief-workshop"')); assert.ok(/studio\.js\?v=[\w-]+"/.test(html), 'studio.js 改了，pipeline.html 的版本号要加');
  for (const cmd of ['relief.probe', 'relief.preview', 'relief.compare', 'relief.revert', 'relief.state', 'relief.view']) assert.ok(bridge.includes(`case '${cmd}'`), cmd);
  assert.equal(RELIEF_CAPABILITIES.length, 6);
});
