// tools/test_voxel_bounce.mjs — V5-K5 单次色彩反弹纯逻辑单元验收（voxelBounce.js 不依赖 three/DOM）
// 运行：node tools/test_voxel_bounce.mjs
// 覆盖：能量注入（太阳/emissive）/ 单次六邻域传播 / clamp / 与 AO 同 dirty 调度 /
//       彩墙染色有界且随距离衰减 / 识别色硬上限 / 门控全分支 / dedupe 上报 / 同 seed 确定性
import assert from "node:assert/strict";

const volMod = await import(
  new URL("../TigerMessenger/src/render/ao/voxelVolume.js", import.meta.url).href
);
const bounceMod = await import(
  new URL("../TigerMessenger/src/render/ao/voxelBounce.js", import.meta.url).href
);
const limitsMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingBounce.js", import.meta.url).href
);

const {
  createVoxelVolume,
  rasterizeTriangles,
  computeScalarAo,
  createDirtyTracker,
  fnv1a,
} = volMod;
const {
  VOXEL_BOUNCE_VERSION,
  BOUNCE_ENERGY_LIMITS,
  BOUNCE_GPU_BUDGET_MS,
  createBounceGrid,
  getBounceVoxel,
  injectSunEnergy,
  injectEmissiveEnergy,
  propagateBounceOnce,
  computeVoxelBounce,
  composeBounceTint,
  applyBounceTint,
  evaluateBounceGate,
  createBounceGateReporter,
} = bounceMod;
const { BOUNCE_LIMITS } = limitsMod;

let assertions = 0;
function a(cond, msg) {
  assertions++;
  assert.ok(cond, msg);
}
function eq(x, y, msg) {
  assertions++;
  assert.equal(x, y, msg);
}
function deepEq(x, y, msg) {
  assertions++;
  assert.deepEqual(x, y, msg);
}
function near(x, y, eps, msg) {
  assertions++;
  assert.ok(Math.abs(x - y) <= eps, `${msg}（|${x}-${y}|>${eps}）`);
}

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// 盒体六个面（12 三角形）；与 test_voxel_ao.mjs 同一 helper
function boxTriangles(cx, cy, cz, hx, hy, hz) {
  const x0 = cx - hx, x1 = cx + hx;
  const y0 = cy - hy, y1 = cy + hy;
  const z0 = cz - hz, z1 = cz + hz;
  const v = (x, y, z) => [x, y, z];
  const quads = [
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)],
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)],
    [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)],
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)],
  ];
  const out = [];
  for (const q of quads) {
    out.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  return new Float32Array(out);
}

const MAX_E = BOUNCE_ENERGY_LIMITS.maxVoxelEnergy; // 0.18
const SUN_SCALE = BOUNCE_ENERGY_LIMITS.sunInjectScale; // 0.12
const EM_SCALE = BOUNCE_ENERGY_LIMITS.emissiveInjectScale; // 0.12
const TRANSFER = BOUNCE_ENERGY_LIMITS.transferPerFace; // 0.1

ok("能量上限复用 BOUNCE_LIMITS 量级", () => {
  eq(MAX_E, BOUNCE_LIMITS.maxIntensity, "maxVoxelEnergy 应等于 BOUNCE_LIMITS.maxIntensity");
  eq(BOUNCE_ENERGY_LIMITS.maxTintMix, BOUNCE_LIMITS.maxMix, "maxTintMix 应等于 BOUNCE_LIMITS.maxMix");
  a(TRANSFER * 6 < 1, "六面总转出必须 < 1（能量衰减）");
  eq(VOXEL_BOUNCE_VERSION, "voxel-bounce-v1");
});

ok("bounce 网格复用 AO 体素体积：同一坐标系、无第二套世界坐标", () => {
  const vol = createVoxelVolume({ origin: [1, 2, 3], dims: [8, 6, 4], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  eq(grid.volume, vol, "grid.volume 必须是同一个 voxelVolume 引用");
  eq(grid.dims, vol.dims, "dims 必须共享同一引用，不可能与 AO 漂移");
  eq(grid.radiance.length, 8 * 6 * 4 * 3);
  eq(grid.scratch.length, 8 * 6 * 4 * 3);
  // 线性排布与 atlas 同序：voxel (2,3,1) → index*3
  eq(vol.index(2, 3, 1) * 3, ((1 * 6 + 3) * 8 + 2) * 3);
  // 越界读取安全返回零
  deepEq(getBounceVoxel(grid, -1, 0, 0), [0, 0, 0]);
  deepEq(getBounceVoxel(grid, 99, 0, 0), [0, 0, 0]);
});

ok("太阳注入：面朝太阳的实心面把能量注入相邻空格；实心格恒不存能量", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 8, 16], voxelSize: 0.5 });
  rasterizeTriangles(vol, boxTriangles(4, 0.25, 4, 4, 0.25, 4)); // 地板 y∈[0,0.5] → 体素 y=0 实心
  const grid = createBounceGrid(vol);
  // 正午太阳：direction 指向太阳（正上方）
  const n = injectSunEnergy(grid, { direction: [0, 1, 0], color: "#FF0000", intensity: 1.5 });
  a(n > 0, "应有空格被注入");
  // 地板表面 y=0 / y=0.5 使体素 y=0、y=1 均为贴面实心；y=2 是贴面空格
  const [r, g, b] = getBounceVoxel(grid, 8, 2, 8); // 地板顶面相邻空格
  near(r, 1.5 * SUN_SCALE, 1e-6, "顶面注入量 = intensity × sunScale");
  near(g, 0, 1e-6, "纯红太阳不应有绿分量");
  near(b, 0, 1e-6, "纯红太阳不应有蓝分量");
  // 实心格（地板体素 y=0、y=1）不存能量
  deepEq(getBounceVoxel(grid, 8, 0, 8), [0, 0, 0], "实心格必须保持 0（只反射）");
  deepEq(getBounceVoxel(grid, 8, 1, 8), [0, 0, 0], "贴面实心格必须保持 0（只反射）");
  // 不贴面的空格（高空）无能量
  deepEq(getBounceVoxel(grid, 8, 6, 8), [0, 0, 0], "不贴实心面的空格不应被注入");
});

ok("太阳注入按面朝向加权：背光面不注入，斜照弱于正照", () => {
  // 悬空板 y∈[2.1,2.6]（避开体素边界：底面落在体素 y=4 内部，y=3 保持为空）；太阳在正下方 → 只照底面
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 12, 16], voxelSize: 0.5 });
  rasterizeTriangles(vol, boxTriangles(4, 2.35, 4, 4, 0.25, 4));
  const grid = createBounceGrid(vol);
  injectSunEnergy(grid, { direction: [0, -1, 0], color: "#FFFFFF", intensity: 1 });
  a(getBounceVoxel(grid, 8, 3, 8)[0] > 0, "板底面相邻空格应被注入");
  deepEq(getBounceVoxel(grid, 8, 6, 8), [0, 0, 0], "板顶面上方背光空格，不应被注入");
  // 斜照 45°：facing=cos45≈0.707，弱于正照
  const grid2 = createBounceGrid(vol);
  injectSunEnergy(grid2, { direction: [0, -1, 1], color: "#FFFFFF", intensity: 1 });
  const flat = getBounceVoxel(grid, 8, 3, 8)[0];
  const tilted = getBounceVoxel(grid2, 8, 3, 8)[0];
  near(tilted / flat, Math.SQRT1_2, 1e-6, "斜照注入应按 dot(faceN,toSun) 衰减");
  // 非法输入不崩溃不注入
  eq(injectSunEnergy(grid2, { direction: [0, 0, 0], color: "#FFF", intensity: 1 }), 0);
  eq(injectSunEnergy(grid2, null), 0);
});

ok("emissive 注入：世界 AABB 走同一坐标系；实心格跳过", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [9, 9, 9], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  // 体素 (4,4,4) 中心世界 = (2.25,2.25,2.25)
  const n = injectEmissiveEnergy(grid, [
    { min: [2.1, 2.1, 2.1], max: [2.4, 2.4, 2.4], color: "#00FF00", intensity: 1 },
  ]);
  eq(n, 1, "单格盒应只注入 1 个体素");
  const [r, g, b] = getBounceVoxel(grid, 4, 4, 4);
  near(g, EM_SCALE, 1e-6, "emissive 注入量 = intensity × emissiveScale");
  near(r, 0, 1e-9);
  near(b, 0, 1e-9);
  // 与体积不相交的盒 → 0
  eq(injectEmissiveEnergy(grid, [{ min: [100, 0, 0], max: [101, 1, 1], color: "#FFF", intensity: 1 }]), 0);
  // 覆盖实心格的盒：实心格不存能量
  vol.occupancy[vol.index(4, 4, 5)] = 1;
  injectEmissiveEnergy(grid, [
    { min: [2.1, 2.1, 2.6], max: [2.4, 2.4, 2.9], color: "#FF0000", intensity: 1 },
  ]);
  deepEq(getBounceVoxel(grid, 4, 4, 5), [0, 0, 0], "实心格即使被 emissive 盒覆盖也不存能量");
});

ok("单次传播：恰好一跳，距离 2 的体素本轮为 0（结构上不存在无界迭代）", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [9, 9, 9], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  injectEmissiveEnergy(grid, [
    { min: [2.1, 2.1, 2.1], max: [2.4, 2.4, 2.4], color: "#FFFFFF", intensity: 1 },
  ]);
  propagateBounceOnce(grid);
  near(getBounceVoxel(grid, 4, 4, 4)[0], EM_SCALE, 1e-6, "源格保留自身能量");
  for (const [x, y, z] of [[5, 4, 4], [3, 4, 4], [4, 5, 4], [4, 3, 4], [4, 4, 5], [4, 4, 3]]) {
    near(getBounceVoxel(grid, x, y, z)[0], EM_SCALE * TRANSFER, 1e-9,
      `六邻域 (${x},${y},${z}) 应得 transferPerFace 份额`);
  }
  // 距离 2 与对角：本轮严格为 0 —— 快照读/单轮写，不存在循环累积
  eq(getBounceVoxel(grid, 6, 4, 4)[0], 0, "距离 2 的体素单次传播后必须为 0");
  eq(getBounceVoxel(grid, 5, 5, 4)[0], 0, "对角体素单次传播后必须为 0");
  // 再跑一轮才会前进一格 → 每轮 = 恰好一跳（非迭代收敛）
  propagateBounceOnce(grid);
  near(getBounceVoxel(grid, 6, 4, 4)[0], EM_SCALE * TRANSFER * TRANSFER, 1e-9,
    "第二轮才把能量推到距离 2，证明每轮只有一跳");
});

ok("clamp：极端注入被钳到 maxVoxelEnergy，传播后仍不越界", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [9, 9, 9], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  injectEmissiveEnergy(grid, [
    { min: [2.1, 2.1, 2.1], max: [2.4, 2.4, 2.4], color: "#FFFFFF", intensity: 1e9 },
  ]);
  near(getBounceVoxel(grid, 4, 4, 4)[0], MAX_E, 1e-6, "注入必须被 clamp 到 maxVoxelEnergy");
  propagateBounceOnce(grid);
  let peak = 0;
  for (let i = 0; i < grid.radiance.length; i++) peak = Math.max(peak, grid.radiance[i]);
  a(peak <= MAX_E + 1e-6, `传播后全网格单通道峰值 ${peak} 不得超过 ${MAX_E}`);
  // 太阳极端强度同样被 clamp
  const vol2 = createVoxelVolume({ origin: [0, 0, 0], dims: [8, 4, 8], voxelSize: 0.5 });
  rasterizeTriangles(vol2, boxTriangles(2, 0.25, 2, 2, 0.25, 2));
  const grid2 = createBounceGrid(vol2);
  injectSunEnergy(grid2, { direction: [0, 1, 0], color: "#FFFFFF", intensity: 1e9 });
  near(getBounceVoxel(grid2, 4, 2, 4)[0], MAX_E, 1e-6, "太阳注入同样被 clamp");
});

ok("与 AO 同 dirty 调度：同一 tracker/region，重算范围一致、区域外逐字节不变", () => {
  const sun = { direction: [0, 1, 0], color: "#FF6030", intensity: 2 };
  // 全量基线：两个盒子
  const volFull = createVoxelVolume({ origin: [0, 0, 0], dims: [12, 12, 12], voxelSize: 0.5 });
  const box1 = boxTriangles(1.0, 1.0, 1.0, 0.25, 0.25, 0.25); // 体素 1..2
  const box2 = boxTriangles(4.25, 4.25, 4.25, 0.5, 0.5, 0.5); // 体素 7..9
  const all = new Float32Array(box1.length + box2.length);
  all.set(box1, 0);
  all.set(box2, box1.length);
  rasterizeTriangles(volFull, all);
  computeScalarAo(volFull, { radius: 4 });
  const gridFull = createBounceGrid(volFull);
  computeVoxelBounce(gridFull, { sun });

  // 局部路径：先有 box1，标脏后追加 box2，同一 region 喂给 AO 与 bounce
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [12, 12, 12], voxelSize: 0.5 });
  rasterizeTriangles(vol, box1);
  computeScalarAo(vol, { radius: 4 });
  const grid = createBounceGrid(vol);
  computeVoxelBounce(grid, { sun });
  const aoBefore = vol.ao.slice();
  const radBefore = grid.radiance.slice();

  rasterizeTriangles(vol, box2, { zRange: [3, 11], append: true }); // 只改 dirty 切片
  const tracker = createDirtyTracker({ expand: 4 }); // ← 就是 voxelVolume 的 dirty tracker
  tracker.markVoxelRange(vol, [7, 7, 7], [9, 9, 9]);
  const region = tracker.consume();
  deepEq(region.min, [3, 3, 3]);
  deepEq(region.max, [11, 11, 11]);
  const zRange = [region.min[2], region.max[2]];
  computeScalarAo(vol, { radius: 4, zRange }); // AO 用同一 region
  const stats = computeVoxelBounce(grid, { sun, zRange }); // bounce 用同一 region
  deepEq([stats.range.z0, stats.range.z1], zRange, "bounce 重算 zRange 必须与 AO 完全一致");
  eq(stats.range.x0, 0);
  eq(stats.range.x1, 11, "x 恒全宽，与 computeScalarAo 同约定");

  // 区域外（z 0..2）：AO 与 bounce 均逐字节不变
  const rowLen = 12 * 12;
  for (let i = 0; i < 3 * rowLen; i++) {
    eq(vol.ao[i], aoBefore[i], `z<3 的 AO 不应被改动（byte ${i}）`);
  }
  for (let i = 0; i < 3 * rowLen * 3; i++) {
    eq(grid.radiance[i], radBefore[i], `z<3 的 radiance 不应被改动（float ${i}）`);
  }
  // 区域内（远离边界一行，z 4..10）：AO 与 bounce 都与全量重算逐点一致
  for (let z = 4; z <= 10; z++) {
    for (let i = z * rowLen; i < (z + 1) * rowLen; i++) {
      eq(vol.ao[i], volFull.ao[i], `区域内 AO 应与全量一致（byte ${i}）`);
    }
    for (let i = z * rowLen * 3; i < (z + 1) * rowLen * 3; i++) {
      eq(grid.radiance[i], gridFull.radiance[i], `区域内 radiance 应与全量一致（float ${i}）`);
    }
  }
});

ok("彩墙染白墙：染色有界、随距离衰减", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [12, 6, 12], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  // 红色彩墙：x=0 一列发光（世界盒 x∈[0,0.4]）
  computeVoxelBounce(grid, {
    emissives: [{ min: [0, 0, 0], max: [0.4, 3, 6], color: "#FF0000", intensity: 2 }],
  });
  const t0 = composeBounceTint(grid, 0, 2, 2); // 贴墙
  const t1 = composeBounceTint(grid, 1, 2, 2); // 距 1 格
  const t2 = composeBounceTint(grid, 2, 2, 2); // 距 2 格
  const t4 = composeBounceTint(grid, 4, 2, 2); // 距 4 格（超出单次传播范围）
  eq(t0.color, "#FF0000", "贴墙染色色相应为纯红");
  a(t0.mix > 0 && t0.mix <= BOUNCE_LIMITS.maxMix, `贴墙 mix=${t0.mix} 必须有界`);
  a(t0.mix > t1.mix, `染色应随距离衰减：${t0.mix} > ${t1.mix}`);
  a(t1.mix > t2.mix, `染色应随距离衰减：${t1.mix} > ${t2.mix}`);
  eq(t4.mix, 0, "单次传播范围之外不应有染色");
  // 白墙仍白：应用染色后绿/蓝通道保留 ≥ 65%
  const tinted = applyBounceTint("#FFFFFF", t0);
  const gb = parseInt(tinted.slice(3, 5), 16);
  a(gb >= Math.floor((1 - BOUNCE_LIMITS.maxMix) * 255), `白墙 G 通道 ${gb} 保留不足`);
});

ok("识别色硬上限：极端注入下 mix 永不超 maxMix，蓝队色仍主导", () => {
  const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [10, 10, 10], voxelSize: 0.5 });
  const grid = createBounceGrid(vol);
  computeVoxelBounce(grid, {
    emissives: [{ min: [0, 0, 0], max: [3, 3, 3], color: "#FF0000", intensity: 1e6 }],
  });
  const tint = composeBounceTint(grid, 2, 2, 2);
  a(tint.mix <= BOUNCE_LIMITS.maxMix, `极端注入 mix=${tint.mix} 必须 ≤ ${BOUNCE_LIMITS.maxMix}`);
  // 蓝队识别色 #1445FF 被红墙染色后，蓝通道仍明显主导
  const out = applyBounceTint("#1445FF", tint);
  const r = parseInt(out.slice(1, 3), 16);
  const b = parseInt(out.slice(5, 7), 16);
  a(b >= Math.floor((1 - BOUNCE_LIMITS.maxMix) * 255), `蓝通道 ${b} 保留不足（硬上限失效）`);
  a(b > r, `染色后蓝(${b})仍须主导红(${r})，识别色不可被覆盖`);
  // applyBounceTint 对越界 mix 输入也再保险 clamp
  const forced = applyBounceTint("#1445FF", { color: "#FF0000", mix: 99 });
  eq(forced, out, "越界 mix 输入必须被 clamp 到同一结果");
  // 空能量 → 零染色、原色不变
  eq(composeBounceTint(grid, 9, 9, 9).mix, 0);
  eq(applyBounceTint("#1445FF", null), "#1445FF");
});

ok("门控：六个回退分支 + 放行分支 + 固定优先级", () => {
  const good = {
    quality: "high",
    flags: { voxelBounceV1: true },
    capability: { fp16RenderTarget: true },
    gpuHeadroomMs: 5,
    atlasOk: true,
    contextLost: false,
  };
  const on = evaluateBounceGate(good);
  eq(on.enabled, true, "全部满足应放行");
  eq(on.reason.code, "enabled");

  eq(evaluateBounceGate({ ...good, contextLost: true }).reason.code, "context-lost");
  eq(evaluateBounceGate({ ...good, atlasOk: false }).reason.code, "atlas-failed");
  eq(evaluateBounceGate({ ...good, quality: "medium" }).reason.code, "quality-tier");
  eq(evaluateBounceGate({ ...good, quality: "low" }).reason.code, "quality-tier");
  eq(evaluateBounceGate({ ...good, flags: { voxelBounceV1: false } }).reason.code, "flag-off");
  eq(evaluateBounceGate({ ...good, flags: false }).reason.code, "flag-off", "布尔 flag 形式也应支持");
  eq(evaluateBounceGate({ ...good, flags: true }).enabled, true, "布尔 flag=true 应放行");
  eq(evaluateBounceGate({ ...good, capability: null }).reason.code, "no-capability");
  eq(evaluateBounceGate({ ...good, gpuHeadroomMs: BOUNCE_GPU_BUDGET_MS - 0.01 }).reason.code, "over-budget");
  eq(evaluateBounceGate({ ...good, gpuHeadroomMs: undefined }).reason.code, "over-budget",
    "缺失余量数据按 0 处理 → 超预算回退");
  // 每个回退分支 enabled 均为 false
  for (const bad of [
    { contextLost: true }, { atlasOk: false }, { quality: "low" },
    { flags: false }, { capability: null }, { gpuHeadroomMs: 0 },
  ]) {
    eq(evaluateBounceGate({ ...good, ...bad }).enabled, false, `回退分支 ${JSON.stringify(bad)} 不得放行`);
  }
  // 固定优先级：多个失败同时存在 → 按固定顺序取第一个（确定性）
  eq(evaluateBounceGate({ ...good, contextLost: true, quality: "low", flags: false }).reason.code,
    "context-lost", "context-lost 优先级最高");
  eq(evaluateBounceGate({ ...good, quality: "low", flags: false, gpuHeadroomMs: 0 }).reason.code,
    "quality-tier", "quality-tier 优先于 flag-off/over-budget");
  eq(evaluateBounceGate({ ...good, capability: null, gpuHeadroomMs: 0 }).reason.code,
    "no-capability", "no-capability 优先于 over-budget");
  // 非法 quality 名按默认档（medium）解析 → 不放行
  eq(evaluateBounceGate({ ...good, quality: "ultra" }).reason.code, "quality-tier");
  // 结果冻结（可序列化、不可变）
  a(Object.isFrozen(on) && Object.isFrozen(on.reason), "门控结果应冻结");
});

ok("门控上报 dedupe：同一 reason 只报一次，可注入 warn 计数", () => {
  const warnings = [];
  const reporter = createBounceGateReporter({ warn: (m) => warnings.push(m) });
  const off = evaluateBounceGate({ quality: "low" }); // flag-off? 先 quality-tier
  eq(off.reason.code, "quality-tier");
  eq(reporter.report(off), true, "首次应上报");
  eq(reporter.report(off), false, "同 code 第二次应 dedupe");
  eq(reporter.report(off), false);
  eq(warnings.length, 1, "同一 reason 只报一次");
  a(warnings[0].includes("quality-tier"), "告警文本应含结构化 code");
  // 不同 code → 再报一次
  reporter.report(evaluateBounceGate({ quality: "high", flags: true, capability: 1, gpuHeadroomMs: 9, atlasOk: false }));
  eq(warnings.length, 2);
  // 放行不上报
  eq(reporter.report(evaluateBounceGate({
    quality: "high", flags: true, capability: 1, gpuHeadroomMs: 9, atlasOk: true, contextLost: false,
  })), false);
  eq(warnings.length, 2);
  deepEq(reporter.seen(), ["quality-tier", "atlas-failed"]);
  reporter.reset();
  eq(reporter.report(off), true, "reset 后允许重新上报");
  eq(warnings.length, 3);
});

ok("确定性：同输入两次完整重算 radiance 逐位一致（fnv1a 同 hash）", () => {
  const build = () => {
    const vol = createVoxelVolume({ origin: [0, 0, 0], dims: [16, 12, 16], voxelSize: 0.5 });
    const floor = boxTriangles(4, 0.25, 4, 4, 0.25, 4);
    const tower = boxTriangles(6, 2, 6, 0.5, 1.5, 0.5);
    const all = new Float32Array(floor.length + tower.length);
    all.set(floor, 0);
    all.set(tower, floor.length);
    rasterizeTriangles(vol, all);
    const grid = createBounceGrid(vol);
    computeVoxelBounce(grid, {
      sun: { direction: [0.6, 0.72, 0.35], color: "#FFE2B9", intensity: 1.35 },
      emissives: [
        { min: [2.5, 0.5, 2.5], max: [3.5, 1.0, 3.5], color: "#FF8030", intensity: 3 },
        { min: [5.0, 3.5, 5.0], max: [5.5, 4.0, 5.5], color: "#30C0FF", intensity: 2 },
      ],
    });
    return fnv1a(new Uint8Array(grid.radiance.buffer));
  };
  const h1 = build();
  const h2 = build();
  eq(h1, h2, "同输入必须生成逐位一致的 radiance hash");
  a(/^[0-9a-f]{8}$/.test(h1), "hash 格式应为 8 位 hex");
});

console.log(`\n✅ V5-K5 voxel bounce assertions=${assertions}`);
