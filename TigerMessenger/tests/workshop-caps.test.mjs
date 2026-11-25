// workshop-caps.test.mjs — 工坊层缺测能力的真 match/run 单测。
// 覆盖：mountain.erode / mountain.lowpoly（field 形 site）、scene.palette-unify / scene.style-pack（材质数组）、
//       terrain.preserve / building.edit / light.time / world.ink（管线模型 editor/live 节点注册面）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountainErode, mountainLowpoly, MOUNTAIN_CAPABILITIES, SEA, fieldState } from '../src/system-workshop/mountain/capabilities.js';
import { GSCENE_CAPABILITIES, paramsFor } from '../src/system-workshop/gscene/capabilities.js';
import { CAPABILITIES } from '../src/scene-authoring/pipeline-model.js';

// ---------------------------------------------------------------- 合成高度场 site（mountain.probe 同款形状）
function makeSite(n = 12, hFn = () => 6) {
  const N = n * n, h = new Float64Array(N), cls = new Uint8Array(N);
  for (let q = 0; q < N; q++) h[q] = hFn(q % n, (q / n) | 0);
  return { field: { n, step: 2, h, cls, railY: null }, plan: {} };
}
const capOf = (id) => MOUNTAIN_CAPABILITIES.find((c) => c.meta.id === id);
// 字面 id 断言：成熟度构建器按引用判定覆盖，同时校验 id↔meta 不错位
test('workshop-caps: 覆盖清单字面 id 与 meta.id 一一对应', () => {
  assert.equal(capOf('mountain.erode'), mountainErode);
  assert.equal(capOf('mountain.lowpoly'), mountainLowpoly);
  assert.equal(gcap('scene.palette-unify').meta.id, 'scene.palette-unify');
  assert.equal(gcap('scene.style-pack').meta.id, 'scene.style-pack');
});

// ---------------------------------------------------------------- mountain.erode 沟谷侵蚀
test('mountain.erode: 自由陆地下切出沟谷，保护区与边界原高不动', () => {
  const site = makeSite(12, (i, j) => 4 + 6 * Math.sin(i / 3) * Math.cos(j / 4));   // 有落差供下切
  const t = mountainErode.match(site);
  assert.equal(t.length, 1, '自由陆地不足没匹配到');
  const F = fieldState(site), before = Float64Array.from(F.h);
  const r = mountainErode.run(site, { params: { passes: 4, k: 4, m: 0.5, unit: 1 } });
  assert.ok(r.applied.length === 1 && r.changed.length === 1, `没执行: ${JSON.stringify(r)}`);
  assert.ok(site.plan.erode && site.plan.erode.volume >= 0);
  let cut = 0; for (let q = 0; q < F.N; q++) if (F.h[q] < before[q]) cut++;
  assert.ok(cut > 0, '一格都没下切');
  for (let q = 0; q < F.N; q++) if (F.keep[q]) assert.equal(F.h[q], before[q], '保护格被下切');
});

// ---------------------------------------------------------------- mountain.lowpoly 低面片着色
test('mountain.lowpoly: 逐三角面产坡度分区材质+烘焙明暗', () => {
  const site = makeSite(10, (i, j) => 2 + i * 0.8 + Math.max(0, 6 - Math.hypot(i - 5, j - 5)) * 2);
  const t = mountainLowpoly.match(site);
  assert.equal(t.length, 1);
  const r = mountainLowpoly.run(site, { params: { jitter: 0.2, rock: 45, snow: 0.15, contrast: 0.3, palette: 1 } });
  assert.deepEqual(r.applied, ['surface']);
  const s = site._surface;
  const T = (10 - 1) * (10 - 1) * 2;
  assert.equal(s.mat.length, T);
  assert.equal(s.jx.length, site.field.n * site.field.n);
  assert.ok(s.shade.length === T, '明暗没逐面烘出');
  assert.ok(new Set([...s.mat]).size >= 2, '全场只剩一种材质分区');
});

// ---------------------------------------------------------------- scene.palette-unify / style-pack
const MATS = [
  { id: 'a', color: '#c04030', uses: 12 }, { id: 'b', color: '#c04535', uses: 8 },
  { id: 'c', color: '#3050c0', uses: 10 }, { id: 'd', color: '#2f55b8', uses: 4 },
  { id: 'e', color: '#40a050', uses: 6 },
];
const gcap = (id) => GSCENE_CAPABILITIES.find((c) => c.meta.id === id);

test('scene.palette-unify: k-means 主色归并，每材质拿到归并色', () => {
  const cap = gcap('scene.palette-unify');
  assert.ok(cap.match(MATS).length === 1);
  const p = paramsFor(cap, { colors: 3, strength: 0.8 });
  const r = cap.run(MATS, p);
  assert.equal(Object.keys(r.colors).length, MATS.length);
  for (const m of MATS) assert.match(r.colors[m.id], /^#[0-9a-f]{6}$/i);
  // 相近色（a/b 红系）应归到同一主色附近
  const hex2rgb = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const da = hex2rgb(r.colors.a), db = hex2rgb(r.colors.b), de = hex2rgb(r.colors.e);
  assert.ok(Math.hypot(da[0] - db[0], da[1] - db[1], da[2] - db[2]) < Math.hypot(da[0] - de[0], da[1] - de[1], da[2] - de[2]), '同族颜色没被归并到一起');
});

test('scene.style-pack: 每材质靠向莫里斯色板最近色', () => {
  const cap = gcap('scene.style-pack');
  assert.ok(cap.match(MATS).length === 1);
  const r = cap.run(MATS, paramsFor(cap, { strength: 1 }));
  assert.equal(Object.keys(r.colors).length, MATS.length);
  const r0 = cap.run(MATS, paramsFor(cap, { strength: 0.1 }));
  // strength=1 应比 0.1 离原色更远
  const d0 = Math.abs(parseInt(r.colors.a.slice(1, 3), 16) - 0xc0), d1 = Math.abs(parseInt(r0.colors.a.slice(1, 3), 16) - 0xc0);
  assert.ok(d0 >= d1, '靠拢强度没生效');
});

// ---------------------------------------------------------------- 管线模型 editor/live 节点注册面
test('pipeline-model: terrain.preserve / building.edit / light.time / world.ink 注册完整且来源文件真实', () => {
  for (const id of ['terrain.preserve', 'building.edit', 'light.time', 'world.ink']) {
    const c = CAPABILITIES.find((x) => x.id === id);
    assert.ok(c, `${id} 没注册`);
    assert.ok(c.mode === 'editor' || c.mode === 'live', `${id} mode 异常: ${c.mode}`);
    assert.ok(c.name && c.description && c.checks, `${id} 缺描述/验收口径`);
    // source 可为多路径串（'a · b · c'）；REACodeRefactoring/ 前缀映射到 townscaper-web/ 下
    for (const p of String(c.source || '').split('·').map((s) => s.trim()).filter(Boolean)) {
      const candidates = ['../' + p, '../../townscaper-web/' + p, '../../' + p];
      assert.ok(candidates.some((rel) => fs.existsSync(new URL(rel, import.meta.url))), `${id} 来源文件不存在: ${p}`);
    }
    assert.ok(c.provenance?.records?.length || c.provenance?.gameModules?.length, `${id} 缺来源证据`);
  }
  assert.equal(CAPABILITIES.find((x) => x.id === 'light.time').controls[0], 'time');
  assert.ok(CAPABILITIES.find((x) => x.id === 'world.ink').controls.includes('outline'));
});
