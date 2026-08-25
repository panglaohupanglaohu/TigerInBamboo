// tools/test_lighting_surface_contract.mjs — V5 光照 K6 表面只读接口契约（TODO 565/566）
// 运行：node tools/test_lighting_surface_contract.mjs
// 覆盖：
//  1) createSurfaceLightingQuery 对 provider 只读（Proxy 写计数 = 0）；
//  2) current-mesh adapter 与 procgen SurfaceProvider 在同一 fixture 上 parity；
//  3) V4/procgen 接口未就绪时 adapter 独立可用（本文件零 import 依赖）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const iface = await import(
  new URL("../TigerMessenger/src/render/lighting/surfaceLightingInterface.js", import.meta.url).href
);
const bridge = await import(
  new URL("../TigerMessenger/src/procgen/bridge/surfaceProvider.js", import.meta.url).href
);
const {
  createSurfaceLightingQuery,
  createCurrentMeshSurfaceAdapter,
  SURFACE_QUERY_KIND,
  SURFACE_ADAPTER_KIND,
  OCCUPANCY_SHELL_RADIUS,
} = iface;
const { createSurfaceProviderFromIndexedMesh } = bridge;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// ---------- fixture：单位盒（12 三角形），semantic 恒 7 ----------
function boxMeshDesc(cx = 0, cy = 0, cz = 0, h = 1) {
  const [x0, y0, z0, x1, y1, z1] = [cx - h, cy - h, cz - h, cx + h, cy + h, cz + h];
  const v = (x, y, z) => [x, y, z];
  const quads = [
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)], // z0
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], // z1
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], // y0
    [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], // y1
    [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)], // x0
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], // x1
  ];
  const positions = [];
  const indices = [];
  for (const [qi, [a, b, c, d]] of quads.entries()) {
    for (const p of [a, b, c, d]) positions.push(...p);
    const o = qi * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const semantics = Array.from({ length: positions.length / 3 }, () => 7);
  return { positions, indices, semantics };
}

const fixture = boxMeshDesc();
const samplePoints = [
  [0, 0, 1], // 面上（occupied）
  [0, 0, 1.2], // 壳内（0.2 <= 0.3，occupied）
  [0, 0, 5], // 远处（空）
  [0.3, -0.7, 0.9], // 盒内近面
  [1.25, 0.5, 0.5], // +x 面壳内（0.25）
  [-2, 0, 0], // -x 面外侧（空）
  [0.2, 1.31, 0.4], // +y 面壳外（0.31，空）
  [0.9, 0.9, 0.9], // 角内侧
];

// ---------- 1) 接口只读性（TODO 565） ----------

ok("createSurfaceLightingQuery 对 provider 只读：Proxy 写计数 = 0", () => {
  const provider = createSurfaceProviderFromIndexedMesh(fixture, { idPrefix: "mc", chunkId: "t" });
  let writes = 0;
  const counting = new Proxy(provider, {
    set() { writes++; return true; },
    deleteProperty() { writes++; return true; },
    defineProperty() { writes++; return true; },
    setPrototypeOf() { writes++; return true; },
  });
  const q = createSurfaceLightingQuery(counting);
  assert.equal(q.kind, SURFACE_QUERY_KIND);
  for (const p of samplePoints) {
    q.nearestSurface(p);
    q.occupancyAt(p);
    q.materialTokenAt(p);
    q.surfaceNormalAt(p);
  }
  assert.equal(writes, 0, "query 不得对 provider 做任何写操作");
});

ok("query 只暴露只读方法；非法 provider / 非法点被拒", () => {
  const q = createSurfaceLightingQuery(createSurfaceProviderFromIndexedMesh(fixture));
  assert.ok(Object.isFrozen(q));
  for (const m of ["nearestSurface", "occupancyAt", "materialTokenAt", "surfaceNormalAt"]) {
    assert.equal(typeof q[m], "function");
  }
  assert.throws(() => createSurfaceLightingQuery({}), /missing required method/);
  assert.throws(() => q.occupancyAt([0, Number.NaN, 0]), /finite/);
  assert.throws(() => createSurfaceLightingQuery(createSurfaceProviderFromIndexedMesh(fixture), { shellRadius: 0 }), /shellRadius/);
});

ok("occupancy 语义：壳半径内 occupied，壳外空", () => {
  const q = createSurfaceLightingQuery(createSurfaceProviderFromIndexedMesh(fixture));
  assert.equal(q.occupancyAt([0, 0, 1]).occupied, true);
  assert.equal(q.occupancyAt([0, 0, 1 + OCCUPANCY_SHELL_RADIUS * 0.5]).occupied, true);
  assert.equal(q.occupancyAt([0, 0, 5]).occupied, false);
  assert.equal(q.materialTokenAt([0, 0, 1.1]).token, "material:7");
  const n = q.surfaceNormalAt([0, 0, 1.1]).normal;
  assert.ok(Math.abs(n[2] - 1) < 1e-9 && Math.abs(n[0]) < 1e-9, `+z 面法线应朝 +z，得 ${n}`);
});

// ---------- 2) adapter 与 provider parity（TODO 566） ----------

ok("parity：adapter 与 procgen SurfaceProvider 同 fixture 结果一致", () => {
  const providerQ = createSurfaceLightingQuery(
    createSurfaceProviderFromIndexedMesh(fixture, { idPrefix: "mc", chunkId: "p" })
  );
  const adapterQ = createSurfaceLightingQuery(createCurrentMeshSurfaceAdapter([fixture]));
  let maxDistanceDiff = 0;
  let maxNormalDiff = 0;
  for (const p of samplePoints) {
    const po = providerQ.occupancyAt(p);
    const ao = adapterQ.occupancyAt(p);
    assert.equal(po.occupied, ao.occupied, `occupied 分歧 @${p}`);
    maxDistanceDiff = Math.max(maxDistanceDiff, Math.abs(po.distance - ao.distance));
    const pn = providerQ.surfaceNormalAt(p).normal;
    const an = adapterQ.surfaceNormalAt(p).normal;
    maxNormalDiff = Math.max(maxNormalDiff, Math.hypot(pn[0] - an[0], pn[1] - an[1], pn[2] - an[2]));
    assert.equal(providerQ.materialTokenAt(p).token, adapterQ.materialTokenAt(p).token, `token 分歧 @${p}`);
    assert.equal(providerQ.nearestSurface(p).triangle, adapterQ.nearestSurface(p).triangle, `最近面分歧 @${p}`);
  }
  // 同算法同数据：差异为 0；留 1e-9 余量只为浮点求和顺序的防御
  assert.ok(maxDistanceDiff <= 1e-9, `distance 最大差 ${maxDistanceDiff}`);
  assert.ok(maxNormalDiff <= 1e-9, `normal 最大差 ${maxNormalDiff}`);
  console.log(`  · parity max|Δdistance|=${maxDistanceDiff} max|Δnormal|=${maxNormalDiff}（同算法同数据，差异为 0）`);
});

// ---------- 3) 接口未就绪时 adapter 独立可用（TODO 566） ----------

ok("adapter 独立可用：接口文件零 import（不依赖 procgen/three）", () => {
  const src = readFileSync(
    new URL("../TigerMessenger/src/render/lighting/surfaceLightingInterface.js", import.meta.url),
    "utf8"
  );
  const importLines = src.split("\n").filter((l) => /^\s*import\s/m.test(l) || /^\s*export\s+.*\sfrom\s/m.test(l));
  assert.deepEqual(importLines, [], `surfaceLightingInterface.js 不应有 import/export-from，得：${importLines}`);
  // 只用 adapter 完成完整查询链路（本段不触碰 provider）
  const adapter = createCurrentMeshSurfaceAdapter([boxMeshDesc(10, 0, 0, 2)]);
  assert.equal(adapter.kind, SURFACE_ADAPTER_KIND);
  const q = createSurfaceLightingQuery(adapter);
  assert.equal(q.occupancyAt([10, 0, 2.1]).occupied, true);
  assert.equal(q.occupancyAt([0, 0, 0]).occupied, false);
  assert.equal(q.materialTokenAt([10, 0, 2.1]).token, "material:7");
});

ok("adapter 输入校验：空表/缺字段/索引越界/语义长度不符均被拒", () => {
  assert.throws(() => createCurrentMeshSurfaceAdapter([]), /non-empty/);
  assert.throws(() => createCurrentMeshSurfaceAdapter([{ positions: [0, 0, 0] }]), /positions\/indices required/);
  assert.throws(
    () => createCurrentMeshSurfaceAdapter([{ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 9] }]),
    /out of range/
  );
  assert.throws(
    () =>
      createCurrentMeshSurfaceAdapter([
        { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], semantics: [1, 2] },
      ]),
    /semantics length/
  );
});

ok("adapter 多 mesh 合并 + 确定性：同输入两次构建输出一致", () => {
  const desc = [boxMeshDesc(0, 0, 0, 1), boxMeshDesc(5, 0, 0, 1)];
  const q1 = createSurfaceLightingQuery(createCurrentMeshSurfaceAdapter(desc));
  const q2 = createSurfaceLightingQuery(createCurrentMeshSurfaceAdapter(desc));
  assert.equal(q1.nearestSurface([4.9, 0, 0]).triangle !== null, true);
  for (const p of samplePoints) {
    assert.deepEqual(q1.occupancyAt(p), q2.occupancyAt(p));
    assert.deepEqual(q1.surfaceNormalAt(p), q2.surfaceNormalAt(p));
  }
  // 多 mesh 语义混合：第二个盒 semantic 改 9，token 应各自命中
  const desc2 = [boxMeshDesc(0, 0, 0, 1), { ...boxMeshDesc(5, 0, 0, 1), semantics: Array.from({ length: 24 }, () => 9) }];
  const q3 = createSurfaceLightingQuery(createCurrentMeshSurfaceAdapter(desc2));
  assert.equal(q3.materialTokenAt([0, 0, 1.1]).token, "material:7");
  assert.equal(q3.materialTokenAt([5, 0, 1.1]).token, "material:9");
});

console.log(`✅ V5 K6 surface lighting contract assertions groups=${passed}`);
