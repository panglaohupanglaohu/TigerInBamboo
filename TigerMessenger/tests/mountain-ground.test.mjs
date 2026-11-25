// R25 采用山形后重建玩家地面：地面高度查询与画面同一张三角面；轨道净空 / 建筑高差复检仍为 0；坏地面必须判失败。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/mountain-ground.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { createHeightfieldGround, auditGround, cellTris } from '../src/system-workshop/mountain/ground.js';
import { verifyMountain, verifyGround } from '../src/system-workshop/mountain/verify.js';
import { runPlan, MOUNTAIN_CAPABILITIES, protectMask, SEA } from '../src/system-workshop/mountain/capabilities.js';
import { rng32 } from '../src/system-workshop/mountain/evolve.js';
// 合成场地：方台阶岛 + 一座城 + 一条轨道（与 mountain-evolve.test 同形）
const field = () => { const n = 81, h = [], cls = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(i - 40, j - 40); h.push(d > 36 ? null : d > 33 ? -1 : Math.floor((36 - d) / 6) * 6 + 2); cls.push(Math.hypot(i - 50, j - 50) < 5 ? 1 : j === 30 && i > 10 && i < 70 ? 2 : 0); } return { n, step: 3, h, cls, railY: [] }; };
const all = MOUNTAIN_CAPABILITIES.map((c) => ({ id: c.meta.id }));
const build = () => { const f = field(), site = { field: structuredClone(f) }; const rep = runPlan(site, all); return { f, plan: site.plan, rep }; };
const keepOf = (f, plan) => { const n = f.n, N = n * n; return protectMask({ n, N, step: f.step, cls: f.cls, land: Uint8Array.from({ length: N }, (_, q) => (f.h[q] != null && f.h[q] > SEA ? 1 : 0)) }, plan.protect.band, plan.protect.railBand).keep; };

test('三角剖分与实景网格 / lowpoly 同一规则：(i+j) 奇偶决定对角线', () => {
  assert.deepEqual(cellTris(5, 0, 0), [[0, 5, 6], [0, 6, 1]]);
  assert.deepEqual(cellTris(5, 1, 0), [[1, 6, 2], [2, 6, 7]]);
  const src = fs.readFileSync(new URL('../src/world/rea/mountainCandidate.js', import.meta.url), 'utf8');
  // 实景 buildMesh：奇格 (i,j)(i,j+1)(i+1,j) = a,d,b 与 (i+1,j)(i,j+1)(i+1,j+1) = b,d,e；偶格 a,d,e 与 a,e,b
  assert.ok(src.includes('const flip = (i + j) & 1, tri = flip ? [[i, j], [i, j + 1], [i + 1, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]]'), '实景 buildMesh 的三角剖分变了，地面会和画面不一致');
});

test('通过：新山形的地面与画面一致、没有洞，轨道 / 保护区地面 = 原高', () => {
  const { f, plan, rep } = build(), A = auditGround(f, plan, { keep: keepOf(f, plan) });
  assert.ok(A.tris > 7000, '三角数 ' + A.tris); // 81 格合成岛实测 7816（陆地+海环有限格 ×2），阈值只挡空地面/半幅网格
  assert.equal(A.holes, 0, '地面有洞');
  assert.ok(A.maxErr <= 1e-6, '地面与画面最大差 ' + A.maxErr);
  assert.ok(A.railCells > 30, '轨道格 ' + A.railCells); assert.ok(A.railDiff <= 0.011, '轨道地面高差 ' + A.railDiff);
  assert.ok(A.keepCells > 50, '保护区格 ' + A.keepCells); assert.ok(A.keepDiff <= 0.011, '保护区地面高差 ' + A.keepDiff);
  const v = verifyMountain(f, plan, { steps: rep }), c = Object.fromEntries(v.checks.map((x) => [x.id, x]));
  assert.equal(c.ground?.status, 'pass', c.ground?.detail); assert.ok(['pass', 'warn'].includes(c.walk?.status), '缺「山上能走」检查');
  assert.ok(v.metrics.ground && v.metrics.ground.holes === 0);
  console.log('[R25] ' + c.ground.detail + ' | ' + c.walk.detail);
});

test('网格节点处地面 = 节点高度；网格外 / 没有地形处返回 null（交回原地面链）', () => {
  const { plan } = build(), g = createHeightfieldGround(plan), n = plan.n;
  for (const q of [40 * n + 40, 20 * n + 33, 55 * n + 47]) { const [x, z] = g.nodeXZ(q); assert.ok(Math.abs(g.heightAt(x, z) - plan.h[q]) < 1e-6, '节点 ' + q); }
  assert.equal(g.heightAt(1e4, 0), null); assert.equal(g.heightAt(NaN, 0), null);
  const [x0, z0] = g.nodeXZ(0); assert.equal(g.heightAt(x0 + 0.5, z0 + 0.5), null, '角上没有地形的格应返回 null');
  assert.throws(() => createHeightfieldGround({ n: 3, step: 1, h: [1, 2] }), /山形计划/);
});

test('确定性：同一计划两次重建，任意点地面高度完全相同；两次跑管线结果相同', () => {
  const a = build(), b = build(), ga = createHeightfieldGround(a.plan), gb = createHeightfieldGround(b.plan), r = rng32(9), H = ga.half;
  assert.deepEqual(a.plan.h, b.plan.h);
  for (let k = 0; k < 2000; k++) { const x = (r() * 2 - 1) * H, z = (r() * 2 - 1) * H; assert.equal(ga.heightAt(x, z), gb.heightAt(x, z)); }
});

test('坏地面判失败：对角线反了 / 挖了洞 / 轨道处被抬高', () => {
  const { f, plan } = build(), keep = keepOf(f, plan), real = createHeightfieldGround(plan);
  const flipped = verifyGround(f, plan, { keep, ground: createHeightfieldGround(plan, { flip: true }) });
  assert.equal(flipped.status, 'fail', '对角线反过来的地面（碰撞和画面不是同一张面）应判失败：' + flipped.checks[0].detail);
  const holed = { ...real, heightAt: (x, z) => (Math.hypot(x - 10, z + 10) < 12 ? null : real.heightAt(x, z)) };
  const h1 = verifyGround(f, plan, { keep, ground: holed }); assert.equal(h1.status, 'fail'); assert.ok(h1.audit.holes > 0);
  const railNode = f.cls.findIndex((c) => c === 2), [rx, rz] = real.nodeXZ(railNode);
  const lifted = { ...real, heightAt: (x, z) => { const y = real.heightAt(x, z); return y != null && Math.hypot(x - rx, z - rz) < 4 ? y + 1 : y; } };
  const l1 = verifyGround(f, plan, { keep, ground: lifted }); assert.equal(l1.checks[0].status, 'fail'); assert.ok(l1.audit.railDiff >= 0.9, '轨道地面高差 ' + l1.audit.railDiff);
});

test('游戏接线：玩家地面链最后一道接新山形；工坊桥与 main.js 引用同一份山形模块', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), bridge = fs.readFileSync(new URL('../src/scene-authoring/pipeline-bridge.js', import.meta.url), 'utf8');
  assert.match(main, /return mountainGroundOverride\(position, targetCityPlayerNavigation\?\.ground\(position\)/);
  assert.match(main, /function mountainGroundOverride\(position, base\)/);
  const spec = (s) => [...s.matchAll(/world\/rea\/mountainCandidate\.js(\?v=[\w.-]+)?'/g)].map((m) => m[1] || '');
  const all = [...spec(main), ...spec(bridge)]; assert.ok(all.length >= 7, '引用数 ' + all.length);
  assert.equal(new Set(all).size, 1, '?v 不一致会加载两份模块（两份 cur 状态，自动部署与工坊互相看不见）：' + [...new Set(all)].join(' / '));
  for (const a of ['mountain.walk', 'mountain.camera', 'mountain.palette', 'mountain.current', 'mountain.unadopt', 'mountain.adopted']) assert.ok(bridge.includes(`case '${a}'`), '桥缺命令 ' + a);
});
