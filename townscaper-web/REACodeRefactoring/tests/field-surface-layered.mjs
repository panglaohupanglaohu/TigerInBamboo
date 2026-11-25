// 分层混合独立用例（832633189277409280 / 818857408848130048，r56 C04 机制的独立验证）：
//   地形 = 占位场 → 模糊 → 等值面（圆角黏土）；房子 = 独立硬边几何，不进场，
//   与地形同一区块时间窗缩没/抬升/重长，且房基着座在地形体上。
import assert from 'node:assert/strict';
import {
  makeField, rasterizeBoxes, blurField, morphField, surfaceNets, meshVolume,
  edgeManifold, normalTiltShare,
} from '../src/core/field-surface.js';
import {
  layeredPlan, housesAt, chunkPhase, houseTriangles, houseSupport, LAYERED_SHAPES,
} from '../src/core/field-surface-c04.js';

const DIMS = [34, 22, 34], OPTS = { chunk: 3, seed: 3, dur: .45, gap: .5 }, LIFT = 5;
const asBoxes = (s) => [...s.terrain, ...s.houses.map((h) => ({ x: h.x, y: h.y, z: h.z, w: h.w, h: 2, d: h.d }))];
const meshAt = (plan, t) => {
  const f = makeField(DIMS);
  morphField(f, plan, t, { lift: LIFT });
  blurField(f, { passes: 2, radius: 1 });
  return { f, m: surfaceNets(f) };
};

// 1. 层分离：房子不进占位场；静止态（t=0/1）层化计划的地形场与「只写地形盒」逐体素一致
{
  const plan = layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS);
  assert.ok(plan.every((c) => c.from.every((b) => !b.house) && c.to.every((b) => !b.house)), '房子混进了地形盒');
  const nA = plan.reduce((n, c) => n + c.fromHouses.length, 0), nB = plan.reduce((n, c) => n + c.toHouses.length, 0);
  assert.equal(nA, LAYERED_SHAPES.A.houses.length); assert.equal(nB, LAYERED_SHAPES.B.houses.length);
  // 静止态区块延迟无关：两端各自等同单一形态，地形场必须与纯地形盒逐体素一致
  const refPlan = layeredPlan({ terrain: LAYERED_SHAPES.A.terrain }, { terrain: LAYERED_SHAPES.B.terrain }, OPTS);
  for (const t of [0, 1]) {
    const { f } = meshAt(plan, t), { f: ref } = meshAt(refPlan, t);
    assert.deepEqual([...f.data], [...ref.data], `t=${t} 有房子的计划改变了地形占位场`);
  }
  // 房子按盒原点归桶，可以落在没有地形盒的区块 → 那些区块是新增房窗；
  // 延迟由 key 序号的定种子散列给出（新增 key 会让后续延迟换档，这是既有语义），只要求确定且在 [0,gap)
  assert.ok(plan.every((c) => c.delay >= 0 && c.delay < OPTS.gap), '区块延迟越界');
  assert.deepEqual(plan.map((c) => c.delay), layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS).map((c) => c.delay), '区块延迟不确定');
  assert.ok(plan.some((c) => (c.fromHouses.length || c.toHouses.length) && !c.from.length && !c.to.length), '应存在只有房子的区块窗');
  console.log('✓ 层分离：房子不进占位场，静止态地形场逐体素一致，房窗独立且延迟确定');
}

// 2. 体素一致性 + 分层确实改变结果：房子若被塞进同一模糊场会熔进地形（旧行为对照）
{
  const plan = layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS);
  const flat = layeredPlan({ terrain: asBoxes(LAYERED_SHAPES.A) }, { terrain: asBoxes(LAYERED_SHAPES.B) }, OPTS);
  for (const t of [0, 1]) {
    const a = meshAt(plan, t).m, b = meshAt(flat, t).m;
    assert.notDeepEqual([...a.positions], [...b.positions], `t=${t} 层化与否应得到不同等值面`);
    const man = edgeManifold(a);
    assert.equal(man.openEdges + man.nonManifold, 0, `t=${t} 层化地形面不闭合`);
    assert.ok(meshVolume(a) > 0, `t=${t} 法向朝外`);
    // 无房计划与有房计划的地形面逐顶点一致（再次确认房子不污染等值面）
    const tOnly = layeredPlan({ terrain: LAYERED_SHAPES[t ? 'B' : 'A'].terrain }, { terrain: LAYERED_SHAPES[t ? 'B' : 'A'].terrain }, OPTS);
    const ref = meshAt(tOnly, t).m;
    assert.deepEqual([...a.positions], [...ref.positions], `t=${t} 房子污染了地形等值面`);
    assert.deepEqual([...a.quads], [...ref.quads]);
  }
  console.log('✓ 体素一致性：等值面只含地形体素；熔化对照产生不同面且层化面闭合');
}

// 3. 确定性：同输入两次跑，占位场/网格/房子摆位逐字节一致
{
  const plan = layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS);
  const run = (t) => {
    const { m } = meshAt(plan, t);
    return { pos: [...m.positions], nor: [...m.normals], q: [...m.quads], houses: housesAt(plan, t, { lift: LIFT }) };
  };
  for (const t of [0, .42, 1]) assert.deepEqual(run(t), run(t), `t=${t} 结果不确定`);
  assert.deepEqual(layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS).map((c) => [c.key, c.delay]), plan.map((c) => [c.key, c.delay]), '区块计划不确定');
  console.log('✓ 确定性：网格与房子摆位逐字节可复现');
}

// 4. 硬边 vs 圆角：房子的非屋顶面法线全部轴对齐（逐面恒定 = 硬棱），地形斜法线占大头（黏土圆角）
{
  const { tris } = houseTriangles({ w: 2, d: 2 });   // tris = 点数组，每 3 点一个三角
  let axis = 0, tilted = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n); assert.ok(l > 1e-9, `第 ${i / 3} 个三角退化`);
    const m = Math.max(...n.map((x) => Math.abs(x))) / l;
    if (m > 1 - 1e-9) axis++; else tilted++;
  }
  const total = tris.length / 3;
  assert.equal(tilted, 4, `只有人字屋顶 2 片坡面 = 4 个斜法线三角，实测 ${tilted}`);
  assert.equal(axis, total - 4, '墙/山墙/烟囱/门法线必须严格轴对齐');
  const { m } = meshAt(layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS), 0);
  assert.ok(normalTiltShare(m, 20) > .3, `地形模糊后斜法线应占大头，实测 ${normalTiltShare(m, 20).toFixed(3)}`);
  console.log(`✓ 硬边/圆角分层：房子 ${axis}/${total} 面轴对齐 + 4 面屋顶坡；地形斜法线占比 ${normalTiltShare(m, 20).toFixed(3)}`);
}

// 5. 着座：两形态全部成品房都坐在地形体上；悬空/被埋是缺陷信号且能抓到
{
  const plan = layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS);
  for (const t of [0, 1]) {
    const { f } = meshAt(plan, t);
    const s = houseSupport(f, housesAt(plan, t, { lift: LIFT }));
    assert.equal(s.seated, s.perHouse.length, `t=${t} 有 ${s.floating} 栋悬空 / ${s.buried} 栋被埋：${JSON.stringify(s.perHouse.filter((p) => p.state !== 'seated'))}`);
  }
  const { f } = meshAt(plan, 0);
  const bad = houseSupport(f, [{ x: 15, y: 10, z: 9, w: 2, d: 2 }, { x: 9, y: 4, z: 12, w: 2, d: 2 }, { x: 0, y: 20, z: 0, w: 2, d: 2 }]);
  assert.equal(bad.floating + bad.buried >= 2, true, '旧摆位/造的高空房应报缺陷');
  console.log(`✓ 着座：两形态 ${LAYERED_SHAPES.A.houses.length}+${LAYERED_SHAPES.B.houses.length} 栋全 seated，悬空/被埋能被探出`);
}

// 6. 同步：过渡中段房子随区块缩没/抬升，相位公式与 morphField 同源
{
  const plan = layeredPlan(LAYERED_SHAPES.A, LAYERED_SHAPES.B, OPTS);
  const mid = housesAt(plan, .5, { lift: LIFT });
  assert.ok(mid.some((h) => h.moving), 't=.5 应有正在换形态的房子');
  for (const h of mid) {
    const c = plan.find((p) => p.key === h.chunk), p = chunkPhase(c, .5, { lift: LIFT });
    assert.equal(h.s, p.s); assert.equal(h.up, p.up);
  }
  assert.equal(housesAt(plan, 0, { lift: LIFT }).length, LAYERED_SHAPES.A.houses.length);
  assert.equal(housesAt(plan, 1, { lift: LIFT }).length, LAYERED_SHAPES.B.houses.length);
  console.log('✓ 同步：房子与地形同一区块时间窗，相位逐项一致');
}

console.log('field-surface-layered PASS');
