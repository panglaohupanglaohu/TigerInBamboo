// Townscaper 编辑器栅格模型与城镇装配验收：
//   levelsToGrid / gridToLevels 往返恒等 · setCell/clearCell 驱动规则重生 ·
//   buildCitadelTownAssembly 与编辑器共用同一材质/规则路径 · 描边后补全
// 运行：node tools/test_town_grid.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64;
  el.height = 64;
  el.getContext = () => ({
    canvas: el,
    fillRect() {},
    clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {},
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  CITADEL_TOWN_SPEC,
  levelsToGrid,
  gridToLevels,
  setCell,
  clearCell,
} = await import(new URL("src/world/citadelTown.js", BASE).href);
const { buildCitadelTownAssembly, applyInkOutlines, CITADEL } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const { buildOdysseyCitadel, rebuildCitadelTown } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const specFilled = CITADEL_TOWN_SPEC.levels.reduce(
  (sum, rows) => sum + rows.reduce((s, row) => s + [...row].filter((c) => c !== ".").length, 0),
  0
);

console.log("[1] levelsToGrid / gridToLevels 往返恒等");
{
  const grid = levelsToGrid(CITADEL_TOWN_SPEC.levels);
  assert.equal(grid.size, specFilled, "栅格必须恰好容纳全部填充格");
  const roundTrip = gridToLevels(grid);
  assert.deepEqual(roundTrip, CITADEL_TOWN_SPEC.levels, "ASCII → 栅格 → ASCII 必须恒等");
  // JSON 可序列化往返（编辑器导出/导入与 localStorage 的存储形态）
  const revived = levelsToGrid(JSON.parse(JSON.stringify(gridToLevels(grid))));
  assert.deepEqual([...revived.entries()].sort(), [...grid.entries()].sort());
  ok(`SPEC ${specFilled} 格 · 往返恒等 · JSON 可序列化`);
}

console.log("[2] 空栅格与边界");
{
  const empty = new Map();
  assert.deepEqual(gridToLevels(empty), [["."]], "空栅格输出 1×1 全空单层");
  setCell(empty, 0, 0, 0, "W");
  assert.deepEqual(gridToLevels(empty), [["W"]]);
  setCell(empty, 0, 0, 0, ".");
  assert.equal(empty.size, 0, "setCell 写入 '.' 等价于删除");
  clearCell(empty, 9, 9, 9);
  assert.equal(empty.size, 0, "删除不存在的格是安全空操作");
  ok("空栅格 1×1 · setCell('.') = 删除 · clearCell 幂等");
}

console.log("[3] setCell 驱动规则重生：加块 → 体块 +1、穹顶规则不破");
{
  const grid = levelsToGrid(CITADEL_TOWN_SPEC.levels);
  // 顶层（Level 6）3×3 屋顶旁加一格：屋顶区扩大但仍为同一连通组 → 仍一座穹顶
  setCell(grid, 1, 6, 3, "W");
  const spec = { ...CITADEL_TOWN_SPEC, levels: gridToLevels(grid) };
  const { stats } = buildCitadelTownAssembly(spec);
  assert.equal(stats.cellCount, specFilled + 1);
  assert.equal(stats.domeCount, 1, "屋顶区扩大后穹顶仍只出一座");
  ok(`体块 ${specFilled}→${specFilled + 1} · 穹顶仍 ×1`);
}

console.log("[4] clearCell 驱动规则重生：挖空成悬空 → 出拱");
{
  // 最小场景：底层两根柱，上层三连梁 → 中梁悬空且左右有支撑 → 拱 ×1
  const grid = new Map();
  setCell(grid, 0, 0, 0, "W");
  setCell(grid, 2, 0, 0, "W");
  setCell(grid, 0, 1, 0, "W");
  setCell(grid, 1, 1, 0, "W");
  setCell(grid, 2, 1, 0, "W");
  const spec = { cellSize: 2.0, cellHeight: 2.0, levels: gridToLevels(grid) };
  const { stats } = buildCitadelTownAssembly(spec);
  assert.equal(stats.cellCount, 5);
  assert.equal(stats.archCount, 1, "悬空中梁必须出拱");
  clearCell(grid, 1, 1, 0);
  const tornDown = buildCitadelTownAssembly({ ...spec, levels: gridToLevels(grid) });
  assert.equal(tornDown.stats.archCount, 0, "拆掉中梁后拱消失");
  assert.equal(tornDown.stats.cellCount, 4);
  ok("最小场景拱 ×1 · 拆除后拱归零");
}

console.log("[5] buildCitadelTownAssembly：编辑器/主场景同路径 + 描边补全");
{
  const { group, levels, stats } = buildCitadelTownAssembly(CITADEL_TOWN_SPEC);
  assert.equal(group.name, "citadel-town-assembly");
  assert.equal(levels.length, CITADEL_TOWN_SPEC.levels.length);
  for (const level of levels) {
    assert.equal(level.position.y, CITADEL.townBaseY, "各 level 必须抬放到台地顶面");
  }
  assert.equal(stats.cellCount, specFilled);
  assert.equal(stats.domeCount, 1);
  assert(stats.gate, "默认布局必须带正门");

  const outlined = applyInkOutlines(group);
  let visible = 0;
  let withOutline = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) {
      visible++;
      if (o.children.some((c) => c.userData.isOutline)) withOutline++;
    }
  });
  assert.equal(outlined, visible, "描边计数必须等于可见网格数");
  assert.equal(withOutline, visible, "每个可见网格必须有反向壳墨线");
  ok(`${visible}/${visible} 网格描边 · level×${levels.length} · 基座 Y=${CITADEL.townBaseY}`);
}

console.log("[6] buildOdysseyCitadel：spec 覆盖（编辑器存档布局）");
{
  const grid = levelsToGrid(CITADEL_TOWN_SPEC.levels);
  clearCell(grid, 2, 6, 2); // 挖掉顶层 3×3 的一角
  const spec = { ...CITADEL_TOWN_SPEC, levels: gridToLevels(grid) };
  const citadel = buildOdysseyCitadel({ place: false, seed: 7, spec });
  assert.equal(citadel.userData.townStats.cellCount, specFilled - 1);
  assert.equal(citadel.userData.townSpec, spec, "userData.townSpec 必须是覆盖布局");
  ok(`覆盖布局生效 · 体块 ${specFilled - 1}`);
}

console.log("[7] rebuildCitadelTown：游戏内热重建（断崖/地势不动）");
{
  const citadel = buildOdysseyCitadel({ place: false, seed: 7 });
  const layers = citadel.userData.layers;
  const layer1ChildrenBefore = layers[1].children.length;

  const grid = levelsToGrid(CITADEL_TOWN_SPEC.levels);
  setCell(grid, 1, 6, 3, "W"); // 顶层屋顶旁加一格
  const spec = { ...CITADEL_TOWN_SPEC, levels: gridToLevels(grid) };
  const stats = rebuildCitadelTown(citadel, spec);
  assert.equal(stats.cellCount, specFilled + 1);
  assert.equal(citadel.userData.townStats.cellCount, specFilled + 1, "userData 同步更新");
  assert.equal(citadel.userData.townSpec, spec);

  // 旧小镇组全部替换：物理层里恰有 7 个新 town-level 组
  let townLevelCount = 0;
  for (const layer of layers) {
    for (const child of layer.children) {
      if (child.name?.startsWith("town-level-")) townLevelCount++;
    }
  }
  assert.equal(townLevelCount, CITADEL_TOWN_SPEC.levels.length);
  // 断崖基岩完好（Layer 0 不动）
  assert(layers[0].children.some((o) => o.name === "primordial-cliff-rock-0"));
  assert.equal(layers[1].children.length, layer1ChildrenBefore, "Layer 1 组数复原");

  // 新小镇全网格描边
  let visible = 0;
  let withOutline = 0;
  citadel.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && o.name.startsWith("town-")) {
      visible++;
      if (o.children.some((c) => c.userData.isOutline)) withOutline++;
    }
  });
  assert.equal(withOutline, visible, "热重建后小镇网格必须全描边");
  // 再拆一格 → 拱规则即时重生（挖掉门洞上方的实心格不产生新拱，只减体块）
  clearCell(grid, 1, 6, 3);
  const stats2 = rebuildCitadelTown(citadel, { ...spec, levels: gridToLevels(grid) });
  assert.equal(stats2.cellCount, specFilled);
  ok(`热重建 ${specFilled}→${specFilled + 1}→${specFilled} · 基岩完好 · ${visible}/${visible} 描边`);
}

console.log(`\n全部通过：${pass} 组验收`);
