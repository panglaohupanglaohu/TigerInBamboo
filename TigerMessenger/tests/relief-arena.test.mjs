// R47：代际要过擂台（创新 3）成为制度——地貌枝每个能力在固定种子测试岛上「加这一代 vs 不加」，这一代必须赢；
//   登记过成绩以后，任何改动让任一规则指标比登记的这一代差过容差 → 红。
//   规则先定后量：relief/arena.js ARENA_RULES 与登记表 catalog/arena/<能力ID>.json 里的 rule 必须一字不差（改规则要单独说明）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-arena.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { runArena, ARENA_RULES, regressions, roughness, REGRESSION_TOL } from '../src/system-workshop/relief/arena.js';
import { judge, reliefMetrics, arenaSite, slopeAngles, ARENA_SEED, pitIds } from '../src/system-workshop/terrain/arena-generic.js';
import { RELIEF_ORDER, runPlan, lockOf } from '../src/system-workshop/relief/capabilities.js';

const reg = (id) => JSON.parse(fs.readFileSync(new URL(`../src/scene-authoring/catalog/arena/${id}.json`, import.meta.url), 'utf8'));

test('判定规则：守护指标退步超过容差 → 输；要变好的都没好过容差 → 输；否则赢', () => {
  const rule = { better: [{ key: 'a', dir: 1, tol: 0.01 }], guard: [{ key: 'g', dir: -1, tol: 0.05 }] };
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.52, g: 1.04 }, rule).pass, true);
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.52, g: 1.06 }, rule).pass, false, '守护指标退步 0.06 > 0.05');
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.505, g: 1 }, rule).pass, false, '没好过容差');
  assert.match(judge({ a: 0.5, g: 1 }, { a: 0.4, g: 1 }, rule).why, /退步/);
});
test('指标与参数无关、已知答案：平地坡 0°、一格 3 m 高差 = 45°、保护格两侧整体抬高不算硬边位移', () => {
  const n = 5, flat = new Array(n * n).fill(10);
  assert.ok(slopeAngles(flat, n, 3).every((a) => a === 0));
  const step = flat.map((v, k) => (k % n >= 3 ? 13 : 10)), ang = slopeAngles(step, n, 3);
  assert.ok(Math.abs(ang[2] - 45) < 1e-9);
  const cls = new Array(n * n).fill(0); cls[12] = 1;
  const up = flat.map((v) => v + 4), m = reliefMetrics({ n, cell: 3, h: up, base: flat, cls });
  assert.equal(m.hardEdge, 0, '整体抬 4 m：保护格与邻格的高差没变');
  const bump = flat.slice(); bump[13] = 14; assert.equal(reliefMetrics({ n, cell: 3, h: bump, base: flat, cls }).hardEdge, 1, '一侧邻格抬 4 m → 四条边均值 1 m');
  assert.ok(roughness(flat, n) === 0 && roughness(bump, n) > 0);
});
test('擂台岛与规则登记：每个能力都有规则，登记表的 rule = ARENA_RULES，上一代是排在它前面的能力', () => {
  assert.deepEqual(Object.keys(ARENA_RULES).sort(), [...RELIEF_ORDER].sort());
  for (const id of RELIEF_ORDER) {
    const r = reg(id), pos = RELIEF_ORDER.indexOf(id);
    assert.equal(r.capability, id); assert.equal(r.line, 'terrain'); assert.equal(r.arena.seed, ARENA_SEED);
    assert.deepEqual(r.rule, ARENA_RULES[id], id + '：登记表里的规则和代码不一样');
    assert.equal(r.beat, pos ? RELIEF_ORDER.slice(0, pos).join('+') : 'baseline');
    assert.ok(r.pass === null || typeof r.pass === 'boolean');
  }
});
for (const id of RELIEF_ORDER) {
  test(`擂台 ${id}：这一代必须赢上一代；登记过成绩的，不许比登记的差`, () => {
    const a = runArena(id), b = runArena(id);
    assert.deepEqual(a.next, b.next, '确定性：同种子同结果');
    assert.ok(a.pass, `${id} 没赢：${a.judge.why} ${JSON.stringify(a.judge.rows)}`);
    const r = reg(id);
    if (r.next) {
      const back = regressions(a.next, r.next, ARENA_RULES[id]);
      assert.deepEqual(back, [], `${id} 比登记的这一代退步（容差 ${REGRESSION_TOL}）：${JSON.stringify(back)}`);
      assert.equal(r.pass, true, '登记表记的是没赢：不该挂这一代的名字');
    }
  });
}
test('回归检查自己会红：把登记成绩改好一点，现在的成绩就算退步', () => {
  const a = runArena('relief.valley'), rule = ARENA_RULES['relief.valley'];
  assert.deepEqual(regressions(a.next, a.next, rule), []);
  const better = { ...a.next, drainage: a.next.drainage + 0.01 };
  assert.equal(regressions(a.next, better, rule)[0]?.key, 'drainage');
});
test('完整山体：一条管线跑完，四类特征都在（软坡粗糙度降、有台面、河谷后没坑、有岩檐、有梯子）', () => {
  const site = arenaSite(), base = { ...reliefMetrics({ n: site.n, cell: site.cell, h: site.h, base: site.h, cls: site.cls }), rough: roughness(site.h.map((v) => (v == null ? NaN : v)), site.n, site.cls) };
  const all = runArena('relief.passes'), last = all.next;
  // 「软坡粗糙度降」看软坡那一代自己：整条管线末端有硬崖台阶，拉普拉斯粗糙度本来就比原平地高（登记表 relief.cliff.next.rough=0.6952 为证）
  const softSite = arenaSite(); runPlan(softSite, [{ id: 'relief.soft' }]);
  const softRough = roughness(softSite.plan.h.map((v) => (v == null ? NaN : v)), softSite.n, softSite.cls);
  assert.ok(softRough < base.rough, `软坡 ${softRough} vs 原 ${base.rough}`);
  assert.ok(last.flat > base.flat, '硬崖台面');
  // 保护环内的原始微坑管线无权抬（protect 硬保证），只要求可改陆地没有排不出去的坑
  const lock = lockOf(arenaSite()), pits = pitIds(all.plan.h, all.plan.n);
  assert.ok(pits.every((id) => lock[id]), `可改区还有坑：${JSON.stringify(pits.filter((id) => !lock[id]))}`);
  assert.ok(last.overhang > 0, '悬垂');
  assert.ok(all.plan.valley.river.length > 0 && all.plan.ladders.length > 0, '有河、有梯子');
});
