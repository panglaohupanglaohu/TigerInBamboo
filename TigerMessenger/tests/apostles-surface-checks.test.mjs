// R29 半透明破面自动检查 + R30 植被 / 岸线白沫跟随新地形（src/world/rea/apostles-surface-checks.js）。合成几何：一块方台（顶面 + 四面墙），
// 正常 / 翻一个面 / 挖一个洞 / 植物悬空或埋入 / 白沫离岸，每种都要被判出来。
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { meshIntegrity, materialAudit, buildSurfaceIndex, plantDeltas, classifyPlants, nearestDistances, classifyFoam, surfaceChecks, compareToBaseline } from '../src/world/rea/apostles-surface-checks.js';

// 封闭方台：x,z ∈ [0,4]，y ∈ [-1,2]（-1 = 压到水线以下的崖脚）。非索引三角，外法线。
function box({ flipTop = false, holeTop = false } = {}) {
  const P = [], N = []; const q = (a, b, c, d, n) => { for (const t of [[a, b, c], [a, c, d]]) for (const v of t) { P.push(...v); N.push(...n); } };
  const y0 = -1, y1 = 2, s = 4;
  // 顶面拆成 4×4 小格，方便挖洞 / 翻面
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (holeTop && i === 1 && j === 1) continue;
    const a = [i, y1, j], b = [i, y1, j + 1], c = [i + 1, y1, j + 1], d = [i + 1, y1, j];
    if (flipTop && i === 2 && j === 2) q(a, d, c, b, [0, 1, 0]); else q(a, b, c, d, [0, 1, 0]);
  }
  // 四面墙按顶面边缘逐段建，边能与顶面焊上
  for (let k = 0; k < 4; k++) {
    q([k, y0, 0], [k + 1, y0, 0], [k + 1, y1, 0], [k, y1, 0], [0, 0, -1]);
    q([s, y0, k], [s, y0, k + 1], [s, y1, k + 1], [s, y1, k], [1, 0, 0]);
    q([k + 1, y0, s], [k, y0, s], [k, y1, s], [k + 1, y1, s], [0, 0, 1]);
    q([0, y0, k + 1], [0, y0, k], [0, y1, k], [0, y1, k + 1], [-1, 0, 0]);
  }
  return { position: Float32Array.from(P), normal: Float32Array.from(N) };
}

test('完整方台：水线以上没有反面三角、没有开口边（崖脚在水下的开口不算）', () => {
  const r = meshIntegrity({ ...box(), waterY: 0 });
  assert.equal(r.inverted, 0); assert.equal(r.openEdges, 0, JSON.stringify(r.openAt)); assert.equal(r.nonFinite, 0); assert.ok(r.considered > 0);
});
test('翻一个顶面三角对：判出反面三角并给出位置', () => {
  const r = meshIntegrity({ ...box({ flipTop: true }), waterY: 0 });
  assert.equal(r.inverted, 2); assert.ok(r.invertedAt[0][0] > 2 && r.invertedAt[0][0] < 3);
});
test('顶面挖一个洞：判出 4 条开口边', () => {
  const r = meshIntegrity({ ...box({ holeTop: true }), waterY: 0 }); assert.equal(r.openEdges, 4);
});
test('非有限坐标判出来', () => {
  const g = box(); g.position[1] = NaN; const r = meshIntegrity({ ...g, waterY: 0 }); assert.ok(r.nonFinite >= 1);
});
test('球面下弯：bend 把顶点加回去再比水线（下弯后 y<0 的顶面仍算水线以上）', () => {
  const g = box(), bend = 0.2; for (let i = 0; i < g.position.length; i += 3) g.position[i + 1] -= bend * (g.position[i] ** 2 + g.position[i + 2] ** 2);
  const withBend = meshIntegrity({ ...g, bend, waterY: 0 }), noBend = meshIntegrity({ ...g, bend: 0, waterY: 0 });
  assert.ok(withBend.considered > noBend.considered);
});
test('材质：岩体半透明判失败；白沫 / 浪 / 悬停框半透明是设计', () => {
  assert.equal(materialAudit([{ name: 'rock', kind: 'rock', transparent: false, opacity: 1 }, { name: 'skirt', kind: 'foam', transparent: true, opacity: 1 }]).status, 'pass');
  const bad = materialAudit([{ name: 'g30-far-mountain', kind: 'rock', transparent: true, opacity: 0.6 }]);
  assert.equal(bad.status, 'fail'); assert.deepEqual(bad.transparentRock, ['g30-far-mountain']);
  assert.equal(materialAudit([{ kind: 'rock', opacity: 1, alphaTest: 0.5 }]).status, 'fail', 'alphaTest 也会挖洞');
  assert.equal(materialAudit([]).status, 'fail', '没有岩体材质 = 没读到岩体');
});

test('R30 植被：贴地 / 悬空 / 埋入 / 脚下没有岩面 四种都分得出', () => {
  const g = box(), surf = buildSurfaceIndex({ position: g.position });
  const pts = [[1.5, 2.02, 1.5], [2.5, 2.9, 2.5], [0.5, 1.0, 3.5], [9, 2, 9]];
  const d = plantDeltas(surf, pts);
  assert.ok(Math.abs(d[0] - 0.02) < 1e-4); assert.ok(Math.abs(d[1] - 0.9) < 1e-4); assert.ok(d[2] < -0.9); assert.equal(d[3], null);
  const c = classifyPlants(d, { scale: 1 }); assert.equal(c.ok, 1); assert.equal(c.floating, 1); assert.equal(c.buried, 1); assert.equal(c.offSurface, 1); assert.equal(c.status, 'fail');
  assert.equal(classifyPlants([0.01, 0.02, -0.1, 0.05], { scale: 2.1 }).status, 'pass');
  assert.equal(classifyPlants([0.01, 0.2], { scale: 2.1 }).floating, 1, 'scale 把局部单位换成米：0.2 × 2.1 = 0.42 米 > 0.35');
});
test('R30 植被：地形变了而植物没跟 → 判出来（软坡把顶面降了 0.5，植物还在旧高度）', () => {
  const g = box(); for (let i = 1; i < g.position.length; i += 3) if (g.position[i] === 2) g.position[i] = 1.5;
  const surf = buildSurfaceIndex({ position: g.position }), old = [];
  for (let i = 0; i < 20; i++) old.push([0.2 + (i % 4) * 0.9, 2.0, 0.2 + Math.floor(i / 4) * 0.7]);
  const c = classifyPlants(plantDeltas(surf, old), { scale: 1 }); assert.equal(c.floating, 20); assert.equal(c.status, 'fail');
});
test('R30 白沫：最近距离与分级；白沫整体离岸 / 水线一半没白沫 都判出来', () => {
  const coast = []; for (let i = 0; i <= 40; i++) coast.push([i * 0.1, 0]);
  const near = coast.map(([x]) => [x, 0.5]);
  const d = nearestDistances(near, coast); assert.ok(d.every((v) => Math.abs(v - 0.5) < 1e-9));
  assert.equal(classifyFoam({ foamToCoast: d, coastToFoam: nearestDistances(coast, near) }, { scale: 2 }).status, 'pass');
  const far = coast.map(([x]) => [x, 4]);
  const r = classifyFoam({ foamToCoast: nearestDistances(far, coast), coastToFoam: nearestDistances(coast, far) }, { scale: 1 }); assert.equal(r.status, 'fail'); assert.equal(r.strayed, 41);
  const half = near.slice(0, 15), h = classifyFoam({ foamToCoast: nearestDistances(half, coast), coastToFoam: nearestDistances(coast, half) }, { scale: 1, near: 0.6 });
  assert.ok(h.uncoveredShare > 0.5); assert.equal(h.status, 'fail');
  assert.equal(nearestDistances([[0, 0]], [[100, 0]], { maxDist: 40 })[0], Infinity);
  assert.equal(classifyFoam({ foamToCoast: [], coastToFoam: [] }).status, 'fail', '没有白沫顶点 = 白沫丢了');
});
test('汇总 checks 与「和 approved 比有没有变差」', () => {
  const checks = surfaceChecks({ materials: materialAudit([{ kind: 'rock', opacity: 1 }]), integrity: meshIntegrity({ ...box(), waterY: 0 }), plants: classifyPlants([0, 0]), foam: classifyFoam({ foamToCoast: [0.1], coastToFoam: [0.1] }) });
  assert.deepEqual(checks.map((c) => [c.id, c.status]), [['material', 'pass'], ['integrity', 'pass'], ['plants', 'pass'], ['foam', 'pass']]);
  const base = { considered: 10000, inverted: 4, openEdges: 30, transparentRock: 0, plantBadShare: 0.02, foamUncoveredShare: 0.05, foamStrayShare: 0.03 };
  assert.deepEqual(compareToBaseline(base, { ...base }), []);
  const worse = compareToBaseline(base, { ...base, inverted: 60, plantBadShare: 0.2, foamUncoveredShare: 0.3, transparentRock: 1 });
  assert.deepEqual(worse.map((w) => w.id).sort(), ['foam', 'inverted', 'material', 'plants']);
  assert.equal(compareToBaseline(null, base)[0].id, 'missing');
});
