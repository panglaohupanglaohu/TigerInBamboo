// tools/test_voxel_ao.mjs — K3 体素 AO 纯逻辑单元验收（voxelVolume.js 不依赖 three）
// 运行：node tools/test_voxel_ao.mjs
import assert from "node:assert/strict";

const mod = await import(
  new URL("../TigerMessenger/src/render/ao/voxelVolume.js", import.meta.url).href
);
const {
  fitVolumeRegion,
  createVoxelVolume,
  triBoxOverlap,
  rasterizeTriangles,
  computeScalarAo,
  countSolidVoxels,
  fnv1a,
  hashVolume,
  createDirtyTracker,
  runBudgeted,
} = mod;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// 盒体六个面（12 三角形）→ 世界坐标数组；axis 尺寸 hx*hy*hz、中心 (cx,cy,cz)
function boxTriangles(cx, cy, cz, hx, hy, hz) {
  const x0 = cx - hx, x1 = cx + hx;
  const y0 = cy - hy, y1 = cy + hy;
  const z0 = cz - hz, z1 = cz + hz;
  const v = (x, y, z) => [x, y, z];
  const quads = [
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)], // +z 面?（底面 z0）
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], // z1
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], // y0
    [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], // y1
    [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)], // x0
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], // x1
  ];
  const out = [];
  for (const q of quads) {
    out.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  return new Float32Array(out);
}

// 带门洞的墙：x∈[-4,4]、y∈[0,6]、z∈[-0.5,0.5]，门洞 x∈[-1,1]、y∈[0,4]
// 由左右两墙段 + 门楣三段拼成（门洞净空不填实心）
function wallWithDoorTriangles() {
  const parts = [
    boxTriangles(-2.5, 3, 0, 1.5, 3, 0.5), // 左墙段 x∈[-4,-1]
    boxTriangles(2.5, 3, 0, 1.5, 3, 0.5), // 右墙段 x∈[1,4]
    boxTriangles(0, 5, 0, 1, 1, 0.5), // 门楣 x∈[-1,1]、y∈[4,6]
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

ok("fitVolumeRegion：origin 量化到体素整数倍、dims 覆盖外扩包围盒", () => {
  const fit = fitVolumeRegion([0.3, 1.2, -2.1], [10.1, 6.4, 8.2], { voxelSize: 0.5 });
  for (let a = 0; a < 3; a++) {
    assert.ok(Math.abs(fit.origin[a] / 0.5 - Math.round(fit.origin[a] / 0.5)) < 1e-9,
      `origin[${a}] 未对齐体素网格`);
    assert.ok(fit.origin[a] <= [0.3, 1.2, -2.1][a], `origin[${a}] 必须 ≤ min`);
    const top = fit.origin[a] + fit.dims[a] * fit.voxelSize;
    assert.ok(top >= [10.1, 6.4, 8.2][a], `体积必须覆盖 max[${a}]`);
  }
  // 超上限自动加粗体素
  const big = fitVolumeRegion([0, 0, 0], [400, 400, 400], { voxelSize: 0.5, maxDim: 192 });
  assert.ok(big.voxelSize > 0.5, "超限应加粗体素");
  assert.ok(big.dims.every((d) => d <= 192 * 1.6), "dims 应收进上限量级");
});

ok("坐标换算：world↔voxel↔grid 往返一致", () => {
  const vol = createVoxelVolume({ origin: [1, 2, 3], dims: [8, 6, 4], voxelSize: 0.5 });
  // 体素 (2,3,1) 中心 → 世界 → 反查
  const c = vol.voxelCenterToWorld(2, 3, 1);
  assert.deepEqual(c, [1 + 2.5 * 0.5, 2 + 3.5 * 0.5, 3 + 1.5 * 0.5]);
  assert.deepEqual(vol.worldToVoxel(c[0], c[1], c[2]), [2, 3, 1]);
  // 中心点 grid 坐标恰为整数（体素中心=整点约定）
  const g = vol.worldToGrid(c[0], c[1], c[2]);
  g.forEach((v, i) => assert.ok(Math.abs(v - [2, 3, 1][i]) < 1e-9));
  // 体素内任意点 worldToVoxel 不变
  assert.deepEqual(vol.worldToVoxel(c[0] + 0.2, c[1] - 0.2, c[2] + 0.1), [2, 3, 1]);
  // worldBoxToVoxelRange：盒外为 null
  assert.equal(vol.worldBoxToVoxelRange([100, 100, 100], [101, 101, 101]), null);
  // 线性索引 = 图集排布 (z*ny+y)*nx+x
  assert.equal(vol.index(2, 3, 1), (1 * 6 + 3) * 8 + 2);
});

ok("triBoxOverlap：SAT 基本命中/未命中", () => {
  const tri = [[-1, 0, -1], [1, 0, -1], [0, 0, 1]]; // y=0 平面上的三角形
  assert.equal(triBoxOverlap(0, 0.1, 0, 0.25, tri[0], tri[1], tri[2]), true);
  assert.equal(triBoxOverlap(5, 5, 5, 0.25, tri[0], tri[1], tri[2]), false);
  assert.equal(triBoxOverlap(0, 2, 0, 0.25, tri[0], tri[1], tri[2]), false); // 平面上方
});

ok("栅格化：盒体表面被填实、盒外为空（壳语义：内部留空）", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 16, 16], voxelSize: 0.5 });
  const tris = boxTriangles(4, 4, 4, 1.5, 1.5, 1.5); // x,y,z ∈ [2.5,5.5]
  rasterizeTriangles(vol, tris);
  const solidAt = (x, y, z) => vol.occupancy[vol.index(x, y, z)];
  // 表面体素必实心：x=5 中心 2.75，其 AABB [2.5,3.0] 恰好贴上盒面 x=2.5
  assert.equal(solidAt(5, 8, 8), 1, "贴面体素应为实心");
  assert.equal(solidAt(10, 8, 8), 1, "另一侧面体素应为实心（面 x=5.5）");
  // 壳语义：内部体素留空（AO 只需表面遮蔽，内部实心与否不影响外观）
  assert.equal(solidAt(8, 8, 8), 0, "内部体素应留空（壳语义）");
  // 远离盒体必空
  assert.equal(solidAt(0, 0, 0), 0);
  assert.equal(solidAt(15, 15, 15), 0);
  assert.ok(countSolidVoxels(vol) > 0);
});

ok("栅格化：门洞净空不被填成实心（带洞墙）", () => {
  const vol = createVoxelVolume({ origin: [-6, -1, -4], dims: [24, 16, 16], voxelSize: 0.5 });
  rasterizeTriangles(vol, wallWithDoorTriangles());
  const solidAtWorld = (wx, wy, wz) => {
    const [x, y, z] = vol.worldToVoxel(wx, wy, wz);
    return vol.occupancy[vol.index(x, y, z)];
  };
  // 门洞通道（x=0、y=1~3、z=0）一路全空
  for (const wy of [1, 2, 3]) {
    assert.equal(solidAtWorld(0, wy, 0), 0, `门洞 (0,${wy},0) 被错误填实`);
  }
  // 墙段实心
  assert.equal(solidAtWorld(-2.5, 3, 0), 1, "左墙段应为实心");
  assert.equal(solidAtWorld(2.5, 3, 0), 1, "右墙段应为实心");
  // 门楣实心
  assert.equal(solidAtWorld(0, 5, 0), 1, "门楣应为实心");
});

ok("scalar AO：桥下/角落遮蔽 > 空旷；门洞内有光", () => {
  const vol = createVoxelVolume({ origin: [-6, -1, -4], dims: [24, 16, 16], voxelSize: 0.5 });
  // 地板 + 一座桥（板）：桥底 voxel 的 +Y 方向被遮蔽
  const floor = boxTriangles(0, 0, 0, 6, 0.25, 6); // 地板 y∈[-0.25,0.25]
  const bridge = boxTriangles(0, 3, 0, 3, 0.25, 1.5); // 桥板 y∈[2.75,3.25]
  const all = new Float32Array(floor.length + bridge.length);
  all.set(floor, 0);
  all.set(bridge, floor.length);
  rasterizeTriangles(vol, all);
  computeScalarAo(vol, { radius: 4 });
  const occAtWorld = (wx, wy, wz) => {
    const g = vol.worldToGrid(wx, wy, wz);
    return vol.sampleAo(g[0], g[1], g[2]);
  };
  const underBridge = occAtWorld(0, 1.6, 0); // 桥板正下方
  const openField = occAtWorld(-4, 1.6, -2.5); // 远离桥
  const skyHigh = occAtWorld(0, 6.5, 0); // 高空
  assert.ok(underBridge > openField + 0.03,
    `桥下遮蔽(${underBridge.toFixed(3)})应大于空旷(${openField.toFixed(3)})`);
  assert.ok(skyHigh <= openField + 1e-6, "高空应无遮蔽");
  assert.ok(underBridge <= 1, "遮蔽度不超 1");
});

ok("确定性：同 occupancy 两次计算 atlas hash 一致；改动 occupancy 改变 hash", () => {
  const build = () => {
    const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 16, 16], voxelSize: 0.5 });
    rasterizeTriangles(vol, boxTriangles(4, 4, 4, 1.5, 1.5, 1.5));
    computeScalarAo(vol, { radius: 4 });
    return vol;
  };
  const a = build();
  const b = build();
  assert.equal(hashVolume(a), hashVolume(b), "同 occupancy 必须生成一致 atlas hash");
  assert.match(hashVolume(a), /^[0-9a-f]{8}-[0-9a-f]{8}$/);
  // 改动 occupancy → hash 变
  b.occupancy[b.index(0, 0, 0)] = 1;
  computeScalarAo(b, { radius: 4, zRange: [0, 0] });
  assert.notEqual(hashVolume(a), hashVolume(b));
  // fnv1a 基本性质：空数组与全零数组 hash 不同
  assert.notEqual(fnv1a(new Uint8Array(4)), fnv1a(new Uint8Array(5)));
});

ok("AO yRange 分块：逐行块计算与整片结果逐体素一致", () => {
  const full = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 16, 16], voxelSize: 0.5 });
  rasterizeTriangles(full, boxTriangles(4, 4, 4, 1.5, 1.5, 1.5));
  computeScalarAo(full, { radius: 4 });
  const chunked = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 16, 16], voxelSize: 0.5 });
  chunked.occupancy.set(full.occupancy);
  for (let z = 0; z < 16; z++) {
    for (let y0 = 0; y0 < 16; y0 += 12) {
      computeScalarAo(chunked, { radius: 4, zRange: [z, z], yRange: [y0, Math.min(15, y0 + 11)] });
    }
  }
  assert.equal(hashVolume(chunked), hashVolume(full), "yRange 分块不得改变 AO 结果");
});

ok("dirty tracker：合并为并集、扩 kernel 半径、clamp 到体积、世界盒求交", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [20, 10, 30], voxelSize: 0.5 });
  const tracker = createDirtyTracker({ expand: 4 });
  assert.ok(tracker.isEmpty());
  // 两个分离区域 → 合并为包围并集（z 向打通）
  tracker.markVoxelRange(vol, [2, 2, 3], [4, 4, 5]);
  tracker.markVoxelRange(vol, [10, 5, 12], [12, 6, 14]);
  const merged = tracker.peek();
  assert.deepEqual(merged.min, [0, 0, 0]); // 2-4/2-4/3-4 clamp 到 0
  assert.deepEqual(merged.max, [16, 9, 18]); // 12+4/6+4(超 ny-1=9 clamp)/14+4
  // 世界盒求交：与体积不相交 → 不标脏
  assert.equal(tracker.markWorldRange(vol, [100, 0, 0], [101, 1, 1]), false);
  assert.equal(tracker.markWorldRange(vol, [100, 0, 0], [101, 1, 1]), false);
  // 消费后清空
  const consumed = tracker.consume();
  assert.deepEqual(consumed, merged);
  assert.ok(tracker.isEmpty());
  // null = 全体积
  tracker.markWorldRange(vol, null, null);
  assert.deepEqual(tracker.consume().max, [19, 9, 29]);
});

ok("分帧预算：至少跑一个任务、预算用尽即停、耗时统计可信", () => {
  // 注入假时钟：每个任务恰好 2ms
  let t = 0;
  const now = () => t;
  const job = { tasks: [1, 2, 3, 4, 5], cursor: 0 };
  const res1 = runBudgeted(job, () => { t += 2; }, { budgetMs: 4, now });
  assert.equal(res1.processed, 2, "4ms 预算应恰好处理 2 个 2ms 任务");
  assert.equal(res1.done, false);
  assert.equal(res1.maxTaskMs, 2);
  const res2 = runBudgeted(job, () => { t += 2; }, { budgetMs: 4, now });
  assert.equal(res2.processed, 2);
  const res3 = runBudgeted(job, () => { t += 2; }, { budgetMs: 4, now });
  assert.equal(res3.processed, 1);
  assert.equal(res3.done, true);
  // 预算为 0 也至少执行一个任务（不饿死）
  const job2 = { tasks: [1], cursor: 0 };
  const res4 = runBudgeted(job2, () => {}, { budgetMs: 0, now });
  assert.equal(res4.done, true);
});

ok("局部重栅格：zRange 只清写目标切片，邻切片不受影响", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [12, 12, 12], voxelSize: 0.5 });
  rasterizeTriangles(vol, boxTriangles(3, 3, 3, 1, 1, 1));
  const before = vol.occupancy.slice();
  // 在 z=2 切片重写一个不同的盒子；z=9 切片应保持不变
  const zRange = [2, 3];
  const tris2 = boxTriangles(3, 3, 1.5, 1, 1, 0.5); // z∈[1,2] → 体素 z=2..4 附近
  rasterizeTriangles(vol, tris2, { zRange });
  const rowLen = 12 * 12;
  const z9start = 9 * rowLen;
  for (let i = 0; i < rowLen; i++) {
    assert.equal(vol.occupancy[z9start + i], before[z9start + i], "zRange 外切片被改动");
  }
});

console.log(`\n全部通过：${passed} 项`);
