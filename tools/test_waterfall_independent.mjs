// 瀑布独立化（无湖模式）验收：湖开关 + 瀑布独立挂帘 + 放置判定（node 直跑）
// 运行：node tools/test_waterfall_independent.mjs
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
globalThis.document = { getElementById: el, querySelector: el, createElement: el };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.document.createElement = (tag) => {
  if (tag === "canvas") {
    const ctx2d = new Proxy({}, { get(t, k) {
      if (k === "canvas") return { width: 256, height: 256 };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      return typeof k === "string" ? () => {} : undefined;
    }});
    return { width: 256, height: 256, getContext: () => ctx2d };
  }
  return el();
};

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildCitadelRange } = await import(new URL("src/world/citadelRange.js", BASE).href);
const {
  normalizeCitadelTerrain,
  isCitadelCascadePoolsEnabled,
  citadelTerrainPointSupported,
  citadelTerrainCellSupported,
  CITADEL_CASCADE_POOL_SPECS,
} = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { citadelGridCellCenter } = await import(new URL("src/world/citadelTown.js", BASE).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const R = 160;

const contourWithPools = {
  terraces: [15, 18, 21, 24, 27].map((radius) => ({ radius, height: 2 })),
  cascadeEnabled: true,
  cascadePoolsEnabled: true,
};
const contourNoPools = {
  ...contourWithPools,
  cascadePoolsEnabled: false,
};

// ---------- 1. normalize 字段 ----------
assert.equal(isCitadelCascadePoolsEnabled(contourWithPools), true);
assert.equal(isCitadelCascadePoolsEnabled(contourNoPools), false);
assert.equal(normalizeCitadelTerrain(contourNoPools).cascadeEnabled, true, "瀑布总开关保持");
ok("cascadePoolsEnabled 开关归一化（湖关 ≠ 瀑布关）");

// ---------- 2. 构建：湖关 → 湖 0 / 瀑布 4 ----------
{
  const scene = new THREE.Scene();
  const range = buildCitadelRange(scene, R, contourNoPools);
  let pools = 0, falls = 0;
  scene.traverse((o) => {
    if (o.name === "citadel-pilgrimage-water-steps") pools = o.children.length;
    if (o.name === "citadel-pilgrimage-layered-cascades") falls = o.children.length;
  });
  assert.equal(pools, 0, `无湖模式湖应为 0（实际 ${pools}）`);
  assert.equal(falls, 4, `无湖模式瀑布应保留 4 帘（实际 ${falls}）`);
  ok(`无湖模式：湖 0 座 · 瀑布独立挂帘 ${falls} 道`);
  // 瀑布实际落差 = 台地 top 差
  const metrics = normalizeCitadelTerrain(contourNoPools);
  const drops = [];
  scene.traverse((o) => {
    if (o.name === "citadel-pilgrimage-layered-cascades") {
      for (const w of o.children) drops.push(Number(w.userData.actualDrop) || 0);
    }
  });
  drops.sort((a, b) => a - b);
  const expectedDrops = [0, 1, 2, 3].map((i) => metrics.terraces[i].height).sort((a, b) => a - b);
  assert.deepEqual(drops, expectedDrops, `瀑布落差应等于台地 top 差（${drops} vs ${expectedDrops}）`);
  ok("瀑布独立落差 = 相邻台地 top 差（不依赖湖）");
}

// ---------- 3. 湖模式对照：湖 5 / 瀑布 4 ----------
{
  const scene = new THREE.Scene();
  const range = buildCitadelRange(scene, R, contourWithPools);
  let pools = 0, falls = 0;
  scene.traverse((o) => {
    if (o.name === "citadel-pilgrimage-water-steps") pools = o.children.length;
    if (o.name === "citadel-pilgrimage-layered-cascades") falls = o.children.length;
  });
  assert.equal(pools, 5);
  assert.equal(falls, 4);
  ok("湖模式对照：湖 5 座 · 瀑布 4 道（行为不变）");
}

// ---------- 4. 放置判定：湖关 → 湖区也可建（纯环带判定） ----------
{
  // 台地 1 环带 = r ∈ [0, 15]；取池心方向但落在环带内的点 (1.5, 6.0)（r≈6.2）
  const px = 1.5, pz = 6.0;
  const inPools = citadelTerrainPointSupported(contourWithPools, px, pz, 0);
  assert.equal(inPools, true, "湖模式：环带内可建（含湖区放行）");
  const noPools = citadelTerrainPointSupported(contourNoPools, px, pz, 0);
  assert.equal(noPools, true, "无湖模式：同点仍在台地环带内 → 可建");
  // 环带外一点仍不可建
  const outside = citadelTerrainPointSupported(contourNoPools, 20, 0, 0);
  assert.equal(outside, false, "台地外不可建");
  // 池心 (2.2, 15.2) r≈15.36 超出台地 1 半径 15：湖模式由湖区放行，无湖模式应拒绝
  const spec0 = CITADEL_CASCADE_POOL_SPECS[0];
  const poolCenterWith = citadelTerrainPointSupported(contourWithPools, spec0.x, spec0.z, 0);
  assert.equal(poolCenterWith, true, "湖模式：池心越环带仍由湖区放行");
  const poolCenterNo = citadelTerrainPointSupported(contourNoPools, spec0.x, spec0.z, 0);
  assert.equal(poolCenterNo, false, "无湖模式：池心无湖覆盖 → 按环带拒绝（台面边界正确）");
  ok("放置判定：湖关 → 湖区放行撤销，纯环带判定（边界正确）");
}

// ---------- 5. 湖开关与建筑裁剪闭环共存：湖关 + 缩小半径 → 裁剪 ----------
{
  const tiny = {
    terraces: [4, 4.5, 5, 5.5, 6].map((radius) => ({ radius, height: 2 })),
    cascadeEnabled: true,
    cascadePoolsEnabled: false,
  };
  // 池心 (2.2,15.2) 距台地 1 环带中心 15.35 → 半径 4 时越界 → 不可建
  const c = citadelGridCellCenter(12, 0, 12);
  assert.equal(citadelTerrainCellSupported(tiny, c.x, c.z, 0, 1.0), true, "中心格仍可建");
  const edge = citadelTerrainCellSupported(tiny, 6, 0, 0, 1.0);
  assert.equal(edge, false, "极端缩小后边缘格不可建（裁剪触发条件）");
  ok("湖关 + 半径缩小：越界判定正常，闭环①可继续裁剪");
}

console.log(`\n结果：${pass}/5 通过`);
process.exit(0);
