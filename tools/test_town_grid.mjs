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
  resolveCitadelDropTarget,
  normalizeCitadelTerraceLayout,
  citadelGridCellCenter,
} = await import(new URL("src/world/citadelTown.js", BASE).href);
const { buildCitadelTownAssembly, applyInkOutlines, CITADEL } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const { buildOdysseyCitadel, rebuildCitadelTown, terrainSupportLevel } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const {
  citadelEditBaseY,
  citadelEditCellLocalPosition,
  citadelTerrainObjectFromHits,
  raycastCitadelTerraceTop,
} = await import(
  new URL("src/ui/citadelSceneEdit.js", BASE).href
);
const { removeCitadelTerrainObjectPlacement } = await import(
  new URL("src/ui/citadelEditorPanel.js", BASE).href
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

console.log("[2b] 五层台地放置目标：空台面可放、满柱封顶");
{
  const grid = new Map();
  assert.deepEqual(resolveCitadelDropTarget(grid, 12, 12, 0),
    { ix: 12, iy: 0, iz: 12 }, "台地 1 空柱必须能放城堡第 1 层");
  assert.equal(resolveCitadelDropTarget(grid, 12, 12, -1), null,
    "无台地承重面不得悬空放置");
  for (let iy = 0; iy < 4; iy++) setCell(grid, 12, iy, 12, "W");
  assert.deepEqual(resolveCitadelDropTarget(grid, 12, 12, 0),
    { ix: 12, iy: 4, iz: 12 }, "四层柱必须继续叠到城堡第 5 层");
  setCell(grid, 12, 4, 12, "W");
  assert.equal(resolveCitadelDropTarget(grid, 12, 12, 0), null,
    "五层已满的柱位必须封顶，不能误返回已占用顶格");
  ok("台地 1 空面可放 · 五层逐级堆叠 · 满柱封顶");
}

console.log("[2c] 2D 地图、支撑判定与 3D 编辑坐标共用同一原点");
{
  assert.deepEqual(citadelGridCellCenter(12, 0, 12), { x: 0, y: 1, z: 0 },
    "25×25 地图中心格必须严格对应 3D 圣城原点");
  assert.deepEqual(citadelGridCellCenter(18, 0, 12), { x: 12, y: 1, z: 0 },
    "地图横向 6 格必须严格对应 3D 的 12 世界单位");
  const contour = {
    ...CITADEL.contourTerrain,
    terraces: [
      { radius: 12, height: 2 },
      { radius: 16, height: 2 },
      { radius: 20, height: 2 },
      { radius: 24, height: 2 },
      { radius: 28, height: 2 },
    ],
  };
  const citadel = buildOdysseyCitadel({ place: false, seed: 7, contour });
  const edge = citadelGridCellCenter(18, 0, 12);
  const outside = citadelGridCellCenter(19, 0, 12);
  assert.equal(terrainSupportLevel(citadel, edge.x, edge.z, 2, 0), 0,
    "地图显示在 R12 圆内的边缘格必须能在 3D 放置");
  assert.equal(terrainSupportLevel(citadel, outside.x, outside.z, 2, 0), -1,
    "地图显示在 R12 圆外的下一格必须与 3D 一致地禁用");
  ok("中心格零偏移 · R12 边缘格地图/3D 支撑判定一致");
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
  const baseLayout = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC);
  const grid = levelsToGrid(baseLayout.terraces[0].levels);
  const baseCount = grid.size;
  clearCell(grid, 11, 4, 12); // 挖掉台地 1 城堡第 5 层 3×3 的一角
  const spec = normalizeCitadelTerraceLayout({
    terraces: [
      { levels: gridToLevels(grid) },
      ...baseLayout.terraces.slice(1),
    ],
  });
  const citadel = buildOdysseyCitadel({ place: false, seed: 7, spec });
  assert.equal(citadel.userData.townStats.cellCount, baseCount - 1);
  assert.equal(citadel.userData.townSpec.version, 2);
  assert.equal(citadel.userData.townSpec.terraces.length, 5);
  ok(`覆盖布局生效 · 台地×5 · 每台地城堡层×5 · 体块 ${baseCount - 1}`);
}

console.log("[7] rebuildCitadelTown：游戏内热重建（断崖/地势不动）");
{
  const citadel = buildOdysseyCitadel({ place: false, seed: 7 });
  const layers = citadel.userData.layers;
  const layer1ChildrenBefore = layers[1].children.length;

  const baseLayout = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC);
  const grid = levelsToGrid(baseLayout.terraces[0].levels);
  const baseCount = grid.size;
  setCell(grid, 10, 4, 12, "W"); // 台地 1 城堡第 5 层屋顶旁加一格
  const spec = normalizeCitadelTerraceLayout({
    terraces: [{ levels: gridToLevels(grid) }, ...baseLayout.terraces.slice(1)],
  });
  const stats = rebuildCitadelTown(citadel, spec);
  assert.equal(stats.cellCount, baseCount + 1);
  assert.equal(citadel.userData.townStats.cellCount, baseCount + 1, "userData 同步更新");
  assert.equal(citadel.userData.townSpec.version, 2);

  // 旧小镇组全部替换：5 台地 × 5 城堡层
  let townLevelCount = 0;
  for (const layer of layers) {
    for (const child of layer.children) {
      if (child.name?.startsWith("town-terrace-")) townLevelCount++;
    }
  }
  assert.equal(townLevelCount, 25);
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
  clearCell(grid, 10, 4, 12);
  const stats2 = rebuildCitadelTown(citadel, {
    terraces: [{ levels: gridToLevels(grid) }, ...baseLayout.terraces.slice(1)],
  });
  assert.equal(stats2.cellCount, baseCount);
  ok(`热重建 ${baseCount}→${baseCount + 1}→${baseCount} · 基岩完好 · ${visible}/${visible} 描边`);
}

console.log("[8] 清空台地后仍可从空白 3D 台面放置第一个建筑单元");
{
  const emptyFloor = Array.from({ length: 25 }, () => ".".repeat(25));
  const emptyTerrace = {
    levels: Array.from({ length: 5 }, () => [...emptyFloor]),
  };
  const emptyLayout = {
    version: 2,
    gridSize: 25,
    terraces: Array.from({ length: 5 }, () => emptyTerrace),
  };
  const citadel = buildOdysseyCitadel({ place: false, seed: 7, spec: emptyLayout });
  assert.equal(citadel.userData.townStats.cellCount, 0, "五座台地应已全部清空");
  assert.equal(citadelEditBaseY(citadel, 0), citadel.userData.townBaseYs[0],
    "空台地编辑平面必须直接来自台地高程，而非建筑层组");
  const blocker = new THREE.Mesh(
    new THREE.BoxGeometry(20, 2, 20),
    new THREE.MeshBasicMaterial()
  );
  blocker.name = "simulated-old-picking-obstacle";
  blocker.position.y = 20;
  citadel.add(blocker);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 50, 0),
    new THREE.Vector3(0, -1, 0)
  );
  const terraceHit = raycastCitadelTerraceTop(citadel, 0, raycaster);
  assert(terraceHit?.isVector3, "旧装饰物挡在上方时仍必须命中空白台地真实顶面");
  assert(Math.abs(terraceHit.y - (citadel.userData.townBaseYs[0] + 0.06)) < 1e-6,
    "放置射线必须忽略阻碍并落在台地顶面，而不是阻碍物表面");

  const target = resolveCitadelDropTarget(new Map(), 12, 12, 0);
  assert.deepEqual(target, { ix: 12, iy: 0, iz: 12 });
  const expected = citadelEditCellLocalPosition(citadel, 0, target);
  assert(expected?.isVector3 && expected.x === 0 && expected.z === 0,
    "清空后中心格仍必须产生有效 3D 放置坐标");

  const placedGrid = new Map();
  setCell(placedGrid, target.ix, target.iy, target.iz, "W");
  const placedLayout = {
    ...emptyLayout,
    terraces: [
      { levels: Array.from({ length: 5 }, (_, floor) =>
        Array.from({ length: 25 }, (_, iz) => {
          const row = ".".repeat(25).split("");
          if (floor === 0 && iz === 12) row[12] = "W";
          return row.join("");
        })
      ) },
      ...emptyLayout.terraces.slice(1),
    ],
  };
  const stats = rebuildCitadelTown(citadel, placedLayout);
  assert.equal(stats.cellCount, 1, "清空台地后放置首块必须即时生成一个 3D 体块");
  const cell = citadel.getObjectByName("town-cell");
  assert(cell?.userData?.cell?.terraceIndex === 0, "首块必须属于当前台地 1");
  const actual = cell.getWorldPosition(new THREE.Vector3());
  assert(actual.distanceTo(expected) < 1e-6,
    "首块的 3D 坐标必须与地图中心格/幽灵块坐标完全一致");
  ok("清空 → 阻碍物退出拾取 → 空台面命中 → 首块生成 → 地图/3D 一致");
}

console.log("[9] 点击打开搭建菜单不得清空或重建城堡");
{
  // 面板 serializeLayout() 产生的是整个 v2 对象。直接交给热重建器时，
  // 五座台地应完整保留；若误包成旧版 { levels: layout } 则会归零。
  const layout = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC);
  const citadel = buildOdysseyCitadel({ place: false, seed: 7 });
  const before = citadel.userData.townStats.cellCount;
  const stats = rebuildCitadelTown(citadel, layout);
  assert.equal(stats.cellCount, before, "v2 面板布局必须按 terraces 直接重建，不能被清空");

  const mainSource = fs.readFileSync(fileURLToPath(new URL("src/main.js", BASE)), "utf8");
  assert.match(
    mainSource,
    /onApply:\s*\(layout\)\s*=>\s*\{[\s\S]*?rebuildCitadelTown\(messenger\.landmarks\.odysseyCitadel, layout\)/,
    "主程序必须把 v2 layout 直接传给 rebuildCitadelTown"
  );
  const panelSource = fs.readFileSync(
    fileURLToPath(new URL("src/ui/citadelEditorPanel.js", BASE)),
    "utf8"
  );
  const openBody = panelSource.match(/open\(\)\s*\{([\s\S]*?)\n\s*\},\n\s*close\(\)/)?.[1] ?? "";
  assert(!/\n\s*commit\s*\(/.test(openBody), "仅打开搭建菜单不得触发场景重建");
  assert(openBody.includes("hideAbove = false"), "重新打开菜单必须恢复城堡全部楼层可见");
  ok(`打开只显示 UI · v2 布局直传 · 城堡体块保持 ${before}`);
}

console.log("[10] 瞭望塔/参天树支持鸟瞰图与 3D 场景右键删除");
{
  const placements = [
    { id: "tower-a", type: "watchtower", terraceIndex: 0 },
    { id: "tree-b", type: "elderTree", terraceIndex: 1 },
  ];
  const removed = removeCitadelTerrainObjectPlacement(placements, "tree-b");
  assert.equal(removed.removed?.type, "elderTree");
  assert.deepEqual(removed.objects.map((object) => object.id), ["tower-a"]);
  assert.equal(placements.length, 2, "删除 helper 不得原地污染当前存档数组");

  const treeRoot = new THREE.Group();
  treeRoot.userData.terrainObjectId = "tree-b";
  treeRoot.userData.terrainObjectType = "elderTree";
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const outline = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  treeRoot.add(trunk);
  trunk.add(outline);
  const picked = citadelTerrainObjectFromHits([{ object: outline }]);
  assert.equal(picked?.id, "tree-b", "右键命中嵌套网格/描边时必须回溯到地貌对象根组");

  const panelSource = fs.readFileSync(
    fileURLToPath(new URL("src/ui/citadelEditorPanel.js", BASE)),
    "utf8"
  );
  assert.match(panelSource, /terrainMapEl\.addEventListener\("contextmenu"/,
    "鸟瞰台地地图必须接入右键删除");
  const sceneEditSource = fs.readFileSync(
    fileURLToPath(new URL("src/ui/citadelSceneEdit.js", BASE)),
    "utf8"
  );
  assert.match(sceneEditSource, /panel\.deleteTerrainObject\?\.\(terrainObject\.id\)/,
    "3D 右键必须优先删除塔/树，再回落到体块删除");
  ok("不可变删除 · 嵌套网格拾取 · 鸟瞰右键 · 3D 右键");
}

console.log(`\n全部通过：${pass} 组验收`);
