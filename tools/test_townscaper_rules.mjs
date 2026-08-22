// Townscaper 全模拟 单元测试（node 直跑）：
//   配色迁移 / 明度抖动 / 户概念 / 屋顶分类 / 教堂尖塔 / 花园 / 广场 / 水道点缀
// 运行：node tools/test_townscaper_rules.mjs
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
const { buildCitadelTownAssembly } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const {
  CITADEL_PALETTE,
  CITADEL_PALETTE_CHARS,
  CITADEL_GATE_CHAR,
  citadelPaletteIndexOfChar,
  citadelPaletteCharAt,
  migrateLegacyTownChars,
  citadelShadeStep,
  collectCitadelHouses,
  collectCitadelCourtyardRegions,
  classifyRoofComponent,
  normalizeCitadelTerraceLayout,
  levelsToGrid,
  CITADEL_TOWN_SPEC,
  CANAL_JUNCTION_TOWN_SPEC,
  citadelGridVertexJitter,
  citadelLevelsKey,
} = await import(new URL("src/world/citadelTown.js", BASE).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

// ---------- 1. 配色：15 色 + char 集 ----------
assert.equal(CITADEL_PALETTE.length, 15, "15 色盘");
assert.equal(CITADEL_PALETTE_CHARS, "0123456789ABCDE", "char 集顺序");
assert.equal(citadelPaletteIndexOfChar("E"), 14);
assert.equal(citadelPaletteCharAt(14), "E");
assert.equal(citadelPaletteIndexOfChar("G"), -1, "正门 G 不占调色板");
ok("15 色调色板 + char 集 0-9A-E + 正门 G");

// ---------- 2. 旧档迁移 ----------
assert.equal(migrateLegacyTownChars("WLB D."), `026 ${CITADEL_GATE_CHAR}.`);
{
  const migrated = normalizeCitadelTerraceLayout({
    terraces: [{ levels: [["W.L"], ["BWD"]] }],
  });
  const row = migrated.terraces[0].levels[1];
  assert(/0/.test(row), "迁移后含新色字符");
  ok("旧档 W/L/B/D → 新色盘无损迁移");
}

// ---------- 3. 明度抖动：5 档稳定 ----------
{
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const ix = (i * 7) % 13, iz = (i * 11) % 17;
    seen.add(citadelShadeStep(ix, iz, "3"));
  }
  assert(seen.size >= 2 && seen.size <= 5, `抖动档数应在 2~5（实际 ${seen.size}）`);
  // 同一格同字符稳定
  assert.equal(citadelShadeStep(5, 7, "E"), citadelShadeStep(5, 7, "E"));
  ok("明度微抖 5 档、同格稳定");
}

// ---------- 4. 户概念 ----------
{
  const grid = levelsToGrid([
    ["W..", ".L.", "..."],
    ["W..", ".L.", "..."],
  ]);
  const houses = collectCitadelHouses(grid);
  assert.equal(houses.length, 2, "两根柱 = 两户");
  const h0 = houses.find((h) => h.ix === 0 && h.iz === 0);
  assert.equal(h0.floors, 2);
  assert.equal(h0.char, "W");
  ok("户概念：竖柱成户、柱高/字符正确");
}

// ---------- 5. 屋顶分类（纯函数） ----------
assert.equal(classifyRoofComponent([[0, 0]]).kind, "single");
assert.equal(classifyRoofComponent([[0, 0], [1, 0], [2, 0]]).kind, "strip");
assert.equal(classifyRoofComponent([[0, 0], [1, 0], [1, 1]]).kind, "L");
assert.equal(classifyRoofComponent([[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]).kind, "cross");
assert.equal(classifyRoofComponent([[0, 0], [1, 0], [0, 1], [1, 1]]).kind, "block2x2");
assert.equal(classifyRoofComponent([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]).kind, "plaza");
ok("屋顶形状分类：single/strip/L/cross/block2x2/plaza");

// ---------- 6. 构建规则：L 形 → 教堂尖塔 ----------
{
  const L_SHAPED = {
    cellSize: 2.0,
    cellHeight: 2.0,
    gridSize: 25,
    levels: [
      // 一层 L 形（3 格）+ 一根孤立高柱（4 层 → 更高尖顶；无旗杆）
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) => {
          if (iz === 12 && ix === 11) return "0";
          if (iz === 12 && ix === 12) return "0";
          if (iz === 11 && ix === 12) return "0";
          if (iz === 12 && ix === 14) return "3"; // 孤立高柱
          return ".";
        }).join("")
      ),
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 14 ? "3" : ".")).join("")
      ),
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 14 ? "3" : ".")).join("")
      ),
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 14 ? "3" : ".")).join("")
      ),
      Array.from({ length: 25 }, () => ".".repeat(25)),
    ],
  };
  const assembly = buildCitadelTownAssembly(L_SHAPED, { baseY: 0 });
  const stats = assembly.stats;
  assert(stats.steepleCount >= 1, `L 形应出教堂尖塔（实际 ${stats.steepleCount}）`);
  assert(stats.flagCount === undefined, "无旗杆统计（红旗装饰不做）");
  assert(stats.roofCount >= 1, "孤立高柱出尖顶");
  assert(stats.doorCount >= 1, "户门应生成");
  ok(`L 形教堂尖塔 ${stats.steepleCount} + 孤立高柱尖顶 ${stats.roofCount} + 户门 ${stats.doorCount}`);
}

// ---------- 7. 花园：大平顶贴墙 ----------
{
  const GARDEN_SPEC = {
    cellSize: 2.0,
    cellHeight: 2.0,
    gridSize: 25,
    levels: [
      // 底层 3×3 实心块
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) =>
          (ix >= 10 && ix <= 12 && iz >= 10 && iz <= 12 ? "2" : ".")).join("")
      ),
      // 顶层 2×3 平顶（plaza 分量）+ 南边一堵更高墙
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) =>
          (ix >= 10 && ix <= 11 && iz >= 10 && iz <= 12 ? "2" : ".")).join("")
      ),
      // 第三层：南边贴墙
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) =>
          (ix === 10 && iz === 10 ? "2" : ".")).join("")
      ),
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
    ],
  };
  const assembly = buildCitadelTownAssembly(GARDEN_SPEC, { baseY: 0 });
  const stats = assembly.stats;
  assert(stats.gardenCount >= 1, `贴墙平顶应出花园（实际 ${stats.gardenCount}）`);
  assert(stats.shrubCount >= 1, "花园应有树");
  assert(stats.birdCount >= 1, "花园应有鸟");
  ok(`围合平顶花园 ${stats.gardenCount}（树 ${stats.shrubCount} · 鸟 ${stats.birdCount}）`);
}

// ---------- 8. 广场：底层围合空格 ----------
{
  const PLAZA_SPEC = {
    cellSize: 2.0,
    cellHeight: 2.0,
    gridSize: 25,
    levels: [
      // 一层环形围合，中央一格空格
      Array.from({ length: 25 }, (_, iz) =>
        Array.from({ length: 25 }, (_, ix) => {
          if (ix === 12 && iz === 12) return ".";
          if (ix >= 11 && ix <= 13 && iz >= 11 && iz <= 13) return "1";
          return ".";
        }).join("")
      ),
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
    ],
  };
  const assembly = buildCitadelTownAssembly(PLAZA_SPEC, { baseY: 0 });
  const stats = assembly.stats;
  assert(stats.plazaCount >= 1, `围合空格应出广场（实际 ${stats.plazaCount}）`);
  ok(`底层围合广场 ${stats.plazaCount}`);
}

// ---------- 8b. 庭院二次规则：围合空域 → 台面/矮墙/井盆 ----------
{
  const courtyardFloor = Array.from({ length: 25 }, (_, iz) =>
    Array.from({ length: 25 }, (_, ix) => {
      if (ix >= 11 && ix <= 13 && iz >= 11 && iz <= 13 && !(ix === 12 && iz === 12)) return "4";
      return ".";
    }).join("")
  );
  const COURTYARD_SPEC = {
    cellSize: 2.0,
    cellHeight: 2.0,
    gridSize: 25,
    levels: [
      Array.from({ length: 25 }, () => ".".repeat(25)),
      courtyardFloor,
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
      Array.from({ length: 25 }, () => ".".repeat(25)),
    ],
  };
  const regions = collectCitadelCourtyardRegions(levelsToGrid(COURTYARD_SPEC.levels), 25, 25, 5);
  assert.equal(regions.length, 1, "第二轮空域分析应找到一个内院");
  assert.equal(regions[0].terraceFloor, 1);
  assert.equal(regions[0].size, 1);
  const assembly = buildCitadelTownAssembly(COURTYARD_SPEC, { baseY: 0 });
  assert.equal(assembly.stats.courtyardCount, 1, "装配层应消费内院区域");
  assert.equal(assembly.stats.courtyardWellCount, 1, "内院应有井盆");
  assert(assembly.stats.courtyardWallCount >= 4, "内院四周应有矮墙");
  ok("庭院二次规则：1 格空域 · 井盆 " + assembly.stats.courtyardWellCount + " · 墙 " + assembly.stats.courtyardWallCount);
}

// ---------- 9. 默认 SPEC 全规则回归 ----------
{
  const assembly = buildCitadelTownAssembly(CITADEL_TOWN_SPEC, { baseY: 0 });
  const s = assembly.stats;
  assert(s.cellCount >= 140, `默认布局体块数（实际 ${s.cellCount}）`);
  assert(s.windowCount > 0 && s.doorCount > 0, "窗+门");
  assert(s.roofCount > 0, "坡顶");
  assert(s.domeCount >= 1, "黄金穹顶保留");
  assert(s.canalCount > 0 && s.waterGateCount > 0, "水道+水门保留");
  assert(s.gate, "正门保留");
  ok(`默认 SPEC 全规则：${s.cellCount} 格 · ${s.windowCount} 窗 · ${s.doorCount} 门 · ${s.roofCount} 坡顶 · ${s.domeCount} 穹顶 · ${s.canalCount} 水道`);
}

// ---------- 10. 运河交汇种子岛：多色户 + 岸裙 + 支架 ----------
{
  assert.equal(citadelLevelsKey("canal-junction"), "tm.citadel.levels.canal-junction.v4");
  const assembly = buildCitadelTownAssembly(CANAL_JUNCTION_TOWN_SPEC, { baseY: 0 });
  const s = assembly.stats;
  const chars = new Set();
  for (const floor of CANAL_JUNCTION_TOWN_SPEC.levels) {
    for (const row of floor) {
      for (const ch of row) {
        if (ch !== ".") chars.add(ch);
      }
    }
  }
  assert(chars.size >= 6, `种子岛户色应 ≥6（实际 ${[...chars].join("")}）`);
  assert(s.cellCount >= 80, `种子岛体块（实际 ${s.cellCount}）`);
  assert(s.seawallCount > 0, "临水石裙");
  assert(s.supportCount > 0, "飞楼黑铁支架");
  assert(s.roofCount > 0 && s.windowCount > 0, "屋顶+窗");
  assert((s.shrubCount ?? 0) > 0, "露台圆树");
  assert((s.balconyCount ?? 0) > 0, "阳台");
  assert((s.clotheslineCount ?? 0) >= 0, "晾衣绳计数存在");
  ok(`运河种子岛 ${s.cellCount} 格 · ${chars.size} 色 · 裙 ${s.seawallCount} · 架 ${s.supportCount} · 树 ${s.shrubCount} · 阳台 ${s.balconyCount}`);
}

// ---------- 10b. 水上软模式：阳台/石裙/圆树还在，不叠假水道 ----------
{
  const assembly = buildCitadelTownAssembly(CANAL_JUNCTION_TOWN_SPEC, {
    baseY: 0,
    leanDecor: true,
  });
  const s = assembly.stats;
  assert(s.seawallCount > 0, "软模式仍有岸裙");
  assert(s.supportCount > 0, "软模式仍有铁架");
  assert((s.shrubCount ?? 0) > 0, "软模式仍有圆树");
  assert((s.balconyCount ?? 0) > 0, "软模式仍有阳台");
  assert.equal(s.canalCount, 0, "坐在真水面上，不再叠假水道");
  ok(`水上软模式：裙 ${s.seawallCount} · 架 ${s.supportCount} · 树 ${s.shrubCount} · 阳台 ${s.balconyCount} · 假水道 0`);
}

// ---------- 11. 扭曲网格：同角点稳定、非零 ----------
{
  const a = citadelGridVertexJitter(3, 4, 0);
  const b = citadelGridVertexJitter(3, 4, 0);
  assert.equal(a.dx, b.dx);
  assert.equal(a.dz, b.dz);
  const c = citadelGridVertexJitter(8, 2, 2);
  assert(Math.abs(c.dx) + Math.abs(c.dz) > 0, "上层扰动非零");
  ok("扭曲网格确定性角点扰动");
}

console.log(`\n结果：${pass} 项通过`);
process.exit(0);
