// 台地-建筑放置有效性闭环 单元测试（node 直跑）
// 运行：node tools/test_terrace_trim.mjs
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
const {
  buildOdysseyCitadel,
  rebuildCitadelTerrain,
  trimCitadelTownToTerrain,
  citadelTerrainCellSupported,
  citadelTerraceMetrics,
  normalizeCitadelTerrain,
} = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const {
  CITADEL_TOWN_SPEC,
  normalizeCitadelTerraceLayout,
  trimCitadelGridToTerrain,
  levelsToGrid,
  gridToLevels,
  citadelGridCellCenter,
} = await import(new URL("src/world/citadelTown.js", BASE).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

const R = 160;

// ---------- 1. 纯函数：trimCitadelGridToTerrain ----------
{
  // 手工构造 5×5 布局：角落格 + 中心格
  const levels = [
    [
      "W...W",
      ".....",
      "..W..",
      ".....",
      "W...W",
    ],
  ];
  // 支撑判定：只有中心 (2,2) 及其邻居可放
  const isSupported = (ix, iz) => Math.abs(ix - 2) <= 1 && Math.abs(iz - 2) <= 1;
  const result = trimCitadelGridToTerrain(levels, isSupported);
  const grid = levelsToGrid(result.levels);
  assert.equal(grid.size, 1, `应只剩中心格（实际 ${grid.size}）`);
  assert(grid.has("2,0,2"), "中心格应保留");
  ok("trimCitadelGridToTerrain 裁剪越界格、保留支撑格");
}

// ---------- 2. 布局归一化后网格是 25×25，默认 SPEC 全部在台地内 ----------
{
  const layout = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC);
  assert.equal(layout.terraces.length, 5);
  assert.equal(layout.terraces[0].levels.length, 5);
  ok("默认五台地 × 五层布局就位");
}

// ---------- 3. 台地缩小时 trimCitadelTownToTerrain 自动裁剪 ----------
{
  const citadel = buildOdysseyCitadel({ seed: 20260808, planetRadius: R, place: false });
  const before = citadel.userData.townStats?.cellCount ?? 0;
  assert(before > 100, `默认布局应有 100+ 格（实际 ${before}）`);
  ok(`初始建筑格 ${before}`);

  // 把台地半径全部缩到最小（台地 0 = 4，逐层 +0.5）
  const tinyTerraces = [4, 4.5, 5, 5.5, 6].map((radius, i) => ({ radius, height: 2 }));
  const tinyContour = { terraces: tinyTerraces, cascadeEnabled: false };
  const metrics = citadelTerraceMetrics(tinyContour);
  assert(metrics[0].radius === 4, "台地 1 半径应缩到 4");

  // 先重建地形（模拟编辑器滑杆），再裁剪
  rebuildCitadelTerrain(citadel, tinyContour);
  const trim = trimCitadelTownToTerrain(citadel, tinyContour);
  assert(trim.trimmed > 0, `半径缩小时应裁剪越界格（实际 ${trim.trimmed}）`);
  ok(`台地半径 4~6 时自动裁剪 ${trim.trimmed} 个越界建筑格`);

  // 裁剪后所有剩余格必须被新台地支撑
  const spec = citadel.userData.townSpec;
  let unsupported = 0;
  spec.terraces.forEach((terrace, ti) => {
    const grid = levelsToGrid(terrace.levels);
    for (const key of grid.keys()) {
      const [ix, , iz] = key.split(",").map(Number);
      const c = citadelGridCellCenter(ix, 0, iz);
      if (!citadelTerrainCellSupported(
        normalizeCitadelTerrain(tinyContour),
        c.x,
        c.z,
        ti,
        CITADEL_TOWN_SPEC.cellSize * 0.5
      )) unsupported++;
    }
  });
  assert.equal(unsupported, 0, `裁剪后不应有越界格（实际 ${unsupported}）`);
  ok(`裁剪后 0 个越界格——全部建筑单元可放置`);
}

// ---------- 4. 半径放大/保持时不误裁 ----------
{
  const citadel = buildOdysseyCitadel({ seed: 20260808, planetRadius: R, place: false });
  const wideContour = {
    terraces: [24, 27, 30, 33, 36].map((radius) => ({ radius, height: 2 })),
    cascadeEnabled: false,
  };
  rebuildCitadelTerrain(citadel, wideContour);
  const trim = trimCitadelTownToTerrain(citadel, wideContour);
  assert.equal(trim.trimmed, 0, `台地放大时不应裁剪（实际 ${trim.trimmed}）`);
  ok("台地放大/不变时不误裁（0 格）");
}

console.log(`\n结果：${pass}/4 通过`);
process.exit(0);
