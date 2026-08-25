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

// ---------- 4. 台地保持/放大时不误裁暴露环带格 ----------
// 承重语义（odysseyCitadel.js citadelTerrainPointSupported，HEAD 已提交的
// 既有设计）：格子必须坐在「暴露台面环带」上，innerR ≤ r ≤ outerR
// （innerR = 更高一层台地半径）。默认布局里本就有被更高台地埋住
// （r < innerR）或悬出外缘（r > outerR）的格，trim 会清理它们——
// 因此「contour 不变 → trimmed===0」不成立；本步刻画裁剪边界：
// 被裁格必须全部落在环带之外，仍处环带上的格 0 误裁，裁后无越界格。
{
  // 统计被裁格去向：buried=被更高台地埋住、overhang=悬出外缘、wrong=仍在环带却被裁
  const classifyTrimmed = (beforeGrids, afterGrids, normalized) => {
    let buried = 0, overhang = 0, wrong = 0;
    beforeGrids.forEach((beforeGrid, ti) => {
      const afterGrid = afterGrids[ti];
      const innerR = ti === 0 ? 0 : normalized.terraces[ti - 1].radius;
      const outerR = normalized.terraces[ti].radius;
      for (const key of beforeGrid.keys()) {
        if (afterGrid.has(key)) continue; // 保留
        const [ix, , iz] = key.split(",").map(Number);
        const c = citadelGridCellCenter(ix, 0, iz);
        const r = Math.hypot(c.x, c.z);
        if (r < innerR - 0.15) buried++;
        else if (r > outerR + 0.15) overhang++;
        else wrong++;
      }
    });
    return { buried, overhang, wrong };
  };
  const gridsOf = (spec) => spec.terraces.map((t) => levelsToGrid(t.levels));
  const countUnsupported = (spec, normalized) => {
    let n = 0;
    spec.terraces.forEach((terrace, ti) => {
      for (const key of levelsToGrid(terrace.levels).keys()) {
        const [ix, , iz] = key.split(",").map(Number);
        const c = citadelGridCellCenter(ix, 0, iz);
        if (!citadelTerrainCellSupported(normalized, c.x, c.z, ti, CITADEL_TOWN_SPEC.cellSize * 0.5)) n++;
      }
    });
    return n;
  };

  // 4a. contour 保持不变（编辑器没动滑杆）：只许清掉被埋/悬空格，环带格 0 误裁
  const citadel = buildOdysseyCitadel({ seed: 20260808, planetRadius: R, place: false });
  const keepContour = citadel.userData.contourSpec;
  const normalizedKeep = normalizeCitadelTerrain(keepContour);
  const keepBefore = gridsOf(citadel.userData.townSpec);
  const keepTrim = trimCitadelTownToTerrain(citadel, keepContour);
  const keepCls = classifyTrimmed(keepBefore, gridsOf(citadel.userData.townSpec), normalizedKeep);
  assert.equal(
    keepTrim.trimmed,
    keepCls.buried + keepCls.overhang + keepCls.wrong,
    "裁剪计数应与快照差集一致"
  );
  assert.equal(keepCls.wrong, 0, `保持 contour 时不应误裁暴露环带格（实际 ${keepCls.wrong}）`);
  assert.equal(
    countUnsupported(citadel.userData.townSpec, normalizedKeep), 0,
    "保持 contour 裁剪后不应有越界格"
  );
  ok(`保持 contour：仅清理 ${keepCls.buried} 被埋格 + ${keepCls.overhang} 悬空格，环带格 0 误裁`);

  // 4b. 台地放大：暴露环带外移会埋住低台地外圈格，裁掉是预期；
  //     被裁格必须全部被埋住（网格最大半径 33.9 < 36.15，故无悬空格）
  const wide = buildOdysseyCitadel({ seed: 20260808, planetRadius: R, place: false });
  const wideContour = {
    terraces: [24, 27, 30, 33, 36].map((radius) => ({ radius, height: 2 })),
    cascadeEnabled: false,
  };
  const normalizedWide = normalizeCitadelTerrain(wideContour);
  const wideBefore = gridsOf(wide.userData.townSpec);
  rebuildCitadelTerrain(wide, wideContour);
  const trim = trimCitadelTownToTerrain(wide, wideContour);
  const wideCls = classifyTrimmed(wideBefore, gridsOf(wide.userData.townSpec), normalizedWide);
  assert(trim.trimmed > keepTrim.trimmed, "放大台地应额外埋住并裁掉更多外圈格");
  assert.equal(wideCls.overhang, 0, `放大后不应有悬出外缘的格被裁（实际 ${wideCls.overhang}）`);
  assert.equal(wideCls.wrong, 0, `暴露环带格不应被误裁（实际 ${wideCls.wrong}）`);
  assert.equal(
    countUnsupported(wide.userData.townSpec, normalizedWide), 0,
    "放大裁剪后不应有越界格"
  );
  ok(`台地放大：仅裁被埋住的 ${wideCls.buried} 格，暴露环带 0 误裁`);
}

console.log(`\n结果：${pass} 项断言通过`);
process.exit(0);
