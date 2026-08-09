// 太古高山圣城验收（Townscaper 规则生成版）：逐层 ASCII 单元格地图驱动，
// 体块/穹顶/城垛/拱窗/悬空拱/塔楼金顶/屋顶花园/棕色正门全部由邻接规则生成。
// 水墨描边全覆盖 · 全 MeshToonMaterial（SwiftShader 无头安全）
// 运行：node tools/test_odyssey_citadel.mjs
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
  buildOdysseyCitadel,
  citadelCurvatureDrop,
  CITADEL,
  rebuildCitadelTerrain,
  rebuildCitadelTerrainObjects,
  terrainSupportLevel,
  citadelTerraceMetrics,
  normalizeCitadelTerrain,
  CITADEL_MIN_TERRACE_HEIGHT,
  normalizeCitadelTerrainObjects,
  citadelTerrainPointSupported,
} = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const { PLAYER_HEIGHT } = await import(new URL("src/core/constants.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};
const byName = (root, name) => {
  let hit = null;
  root.traverse((o) => {
    if (o.name === name) hit = o;
  });
  return hit;
};
const allByName = (root, prefix) => {
  const out = [];
  root.traverse((o) => {
    if (o.name?.startsWith(prefix)) out.push(o);
  });
  return out;
};

const citadel = buildOdysseyCitadel({ place: false, seed: 7 });

console.log("[1] 统一 castleContainer + 五层物理层级 + 小镇装配");
assert.equal(citadel.name, "castleContainer");
assert.equal(citadel.userData.kind, "odyssey-citadel");
assert.equal(citadel.userData.layers.length, 5);
for (let i = 0; i < 5; i++) {
  const layer = byName(citadel, `citadel-layer-${i}`);
  assert(layer?.isGroup, `Layer ${i} Group 缺失`);
  assert.equal(layer.userData.layerIndex, i);
}
const mainCastle = byName(citadel, "odyssey-citadel-five-layer-assembly");
assert.deepEqual(mainCastle.scale.toArray(), [1, 1, 1], "规则小镇按最终尺寸生成，不再整体缩放");
assert.equal(mainCastle.position.y, 0);
const townSpec = citadel.userData.townSpec;
const townStats = citadel.userData.townStats;
assert.equal(townSpec?.terraces?.length, 5, "必须提供五座台地的城堡布局");
let specFilled = 0;
for (const terrace of townSpec.terraces) {
  assert.equal(terrace.levels.length, 5, "每座台地必须恰有五层城堡编辑层");
  for (const rows of terrace.levels) {
    for (const row of rows) specFilled += [...row].filter((ch) => ch !== ".").length;
  }
}
assert.equal(townStats.cellCount, specFilled, "体块数必须等于 ASCII 地图填充格数");
assert.equal(allByName(citadel, "town-terrace-").filter((x) => x.isGroup).length, 25);
assert.equal(CITADEL.townBaseY, 11.94, "小镇基座咬入顶层台地（Y=12）0.06");
ok(`单一容器 · 台地×5 · 每台地城堡层×5 · ASCII ${specFilled} 格全部成块`);

console.log("[1b] 外围五级台地（瀑布缺口）与折返石阶");
const outerTerrain = byName(citadel, "citadel-outer-terrain-system");
assert(outerTerrain?.isGroup, "外围地势系统缺失");
assert.equal(outerTerrain.parent, citadel, "外围系统必须是 castleContainer 的全尺寸直属子组");
assert.equal(outerTerrain.userData.terrainLayerCount, 5,
  "地貌层级必须严格锁死为五层");
assert.equal(outerTerrain.userData.exclusiveTerrainLayers, true,
  "五层台地必须是唯一可见的地貌分层来源");
assert.equal(mainCastle.parent, citadel, "缩放主城必须与外围地势互为兄弟组");
const contourShelves = [];
const defaultMetrics = citadelTerraceMetrics(CITADEL.contourTerrain);
for (let i = 0; i < 5; i++) {
  const shelf = byName(outerTerrain, `contour-step-${i}`);
  assert(shelf?.isMesh, `台地 ${i} 缺失`);
  contourShelves.push(shelf);
  const expectedRadius = CITADEL.contourTerrain.terraces[i].radius;
  assert.equal(shelf.userData.contourIndex, i);
  assert.equal(shelf.userData.isCitadelTerrace, true,
    `台地 ${i + 1} 必须标记为可拾取承重面`);
  assert.equal(shelf.userData.contourRadius, expectedRadius);
  assert.equal(shelf.material.color.getHex(), 0xcfc49a, "台地必须为浅色黄土，弃用深灰");
  if (i > 0) {
    // 台地 2–5：环形扇区开槽露出默认层间瀑布 + 实心核托住高层
    assert.equal(shelf.geometry.type, "ExtrudeGeometry", `台地 ${i} 必须为开槽环形扇区`);
    assert.equal(shelf.position.y, defaultMetrics[i].bottom);
    const core = byName(outerTerrain, `contour-step-${i}-core`);
    assert(core?.isMesh, `台地 ${i} 实心核缺失`);
    assert.equal(core.geometry.parameters.radiusTop, defaultMetrics[i - 1].radius);
  } else {
    // 台地 1 是鸟瞰第一层、最高完整圆柱
    assert.equal(shelf.geometry.type, "CylinderGeometry");
    assert.equal(shelf.geometry.parameters.radiusTop, expectedRadius);
    assert.equal(shelf.position.y, 11);
    assert.equal(shelf.userData.isHighestTerrace, true);
  }
}
assert.equal(outerTerrain.userData.waterfallNotchLayers, 4, "台地 2–5 必须保留默认层间瀑布缺口");
assert.equal(allByName(outerTerrain, "ring-").length, 0, "砖红色环墙与卫楼必须完全移除");
assert.equal(outerTerrain.userData.rampartSegmentCount, 0);
assert.equal(outerTerrain.userData.watchtowerCount, 0);
const pilgrimageSteps = allByName(outerTerrain, "pilgrimage-step-").filter((x) => x.isMesh);
assert.equal(pilgrimageSteps.length, outerTerrain.userData.pilgrimageStepCount);
assert.equal(outerTerrain.userData.pilgrimageFlightCount, 5, "每层台地必须各有一段梯段");
assert.equal(outerTerrain.userData.rampTurnCount, 4, "五段梯段四次折返，不得直上直下");
for (let i = 0; i < 5; i++) {
  assert(byName(outerTerrain, `pilgrimage-landing-${i}`)?.isMesh, `台地 ${i} 梯口平台缺失`);
}
const firstStep = byName(outerTerrain, "pilgrimage-step-0");
const lastStep = byName(outerTerrain, `pilgrimage-step-${pilgrimageSteps.length - 1}`);
assert(firstStep.position.y < 1.0, `梯段必须从山脚坡面起步，实际 Y=${firstStep.position.y}`);
assert(
  Math.abs(lastStep.position.y - 12.02) < 1e-9,
  `顶端平桥必须抵达顶层台面（门廊门槛），实际 Y=${lastStep.position.y}`
);
assert(Math.hypot(lastStep.position.x, lastStep.position.z - 9.05) < 1e-9,
  "平桥门槛条必须停在棕色正门门廊柱前");
ok(`等高台地×5（前四层开槽露瀑）· ${pilgrimageSteps.length} 级五段折返石阶直抵正门`);

console.log("[2] Layer 0：七块低面二十面体断崖（环抱小镇基座）");
const rocks = allByName(citadel, "primordial-cliff-rock-");
assert.equal(rocks.length, 7);
for (const rock of rocks) {
  assert.equal(rock.geometry.type, "IcosahedronGeometry");
  assert.equal(rock.geometry.parameters.radius, 2.3);
  assert.equal(rock.geometry.parameters.detail, 0);
  assert(rock.scale.x >= 1 && rock.scale.x < 1.4);
  assert(rock.scale.y >= 0.8 && rock.scale.y < 1.1);
  assert(rock.scale.z >= 1 && rock.scale.z < 1.4);
  assert(rock.position.y >= 10.8 && rock.position.y <= 11.6);
  assert.equal(rock.material.color.getHex(), 0xcfc5a2);
}
ok("IcosahedronGeometry(2.3, 0) ×7 · 非等比缩放与 Y 轴偏转");

console.log("[3] Townscaper 规则：体块配色 · 穹顶 · 塔楼金顶 · 悬空拱 · 正门");
const cells = allByName(citadel, "town-cell").filter((x) => x.isMesh);
assert.equal(cells.length, townStats.cellCount, "每个填充格必须各有一个体块");
const cellColors = { W: 0xe5eff2, L: 0xd9cfac, B: 0xcaa88c, D: 0xe5eff2 };
for (const cell of cells) {
  assert.equal(
    cell.material.color.getHex(),
    cellColors[cell.userData.cell.char],
    `单元格字符 ${cell.userData.cell.char} 配色错误`
  );
}
// 穹顶规则：3×3 屋顶矩形中心出黄金穹顶（默认布局 1 座主穹顶 + 避雷针）
const domes = allByName(citadel, "town-dome").filter((x) => x.isGroup);
assert.equal(domes.length, townStats.domeCount);
assert.equal(townStats.domeCount, 1, "默认布局应只有顶层 3×3 屋顶出一座主穹顶");
assert(Math.abs(domes[0].position.x) < 1e-9, "主穹顶必须位于 3×3 屋顶中心 x=0");
// 穹顶 z = cz(iz) ：3×3 屋顶在 iz=5，cz = (5-(9-1)/2)*2 = 2（网格局部坐标）
assert.equal(domes[0].position.z, 2, "主穹顶 z = cz(5) = 2（3×3 屋顶中心行）");
assert.equal(domes[0].position.y, 5 * 2, "五层制主穹顶必须落在城堡第 5 层屋面");
assert(byName(domes[0], "town-dome-cap"), "穹顶必须有黄金半球帽");
const finial = byName(citadel, "town-dome-finial");
assert.equal(finial.geometry.parameters.height, PLAYER_HEIGHT * 2, "避雷针 = 2× 玩家身高");
// 塔楼规则：1×1 竖向连续 ≥3 层且顶部四邻皆空 → 金顶（默认四角塔 ×4）
const towerCaps = allByName(citadel, "town-tower-cap");
assert.equal(towerCaps.length, 4);
const capXZ = towerCaps.map((c) => [c.position.x, c.position.z].map(Math.sign).join(",")).sort();
assert.deepEqual(capXZ, ["-1,-1", "-1,1", "1,-1", "1,1"], "四座金顶必须落在四角塔");
// 悬空拱规则：正门上方豁口 1 道 + 第 5 列水道上方悬空跨格 7 道
assert.equal(townStats.archCount, 8);
assert.equal(allByName(citadel, "town-arch").filter((x) => x.isMesh).length, 8);
const gateArch = allByName(citadel, "town-arch").find(
  (a) => Math.abs(a.position.x) < 1e-9
);
assert(gateArch?.isMesh, "正门上方豁口必须出拱");
assert(gateArch.position.z + CITADEL.townOffsetZ > 5, "拱必须横跨正门上方豁口");
const canalArches = allByName(citadel, "town-arch").filter(
  (a) => Math.abs(a.position.x - 4) < 1e-9
);
assert.equal(canalArches.length, 7, "水道上方每个悬空跨格各出一道拱");
// 拱窗与城垛：规则计数与网格实例一致
assert.equal(allByName(citadel, "town-window").filter((x) => x.isMesh).length, townStats.windowCount);
assert(townStats.windowCount > 100, "暴露立面必须普遍出拱窗");
assert.equal(allByName(citadel, "town-crenel").filter((x) => x.isMesh).length, townStats.crenelCount);
assert(townStats.crenelCount > 60, "高处檐口必须普遍出城垛");
// 围栏：低层（≤2 层）开阔平台边缘出立柱+横杆（每边 2 柱 1 杆）
assert(townStats.fenceCount > 0, "基座露台边缘必须出围栏");
assert.equal(
  allByName(citadel, "town-fence").filter((x) => x.isMesh).length,
  townStats.fenceCount * 3,
  "每段围栏 = 2 立柱 + 1 横杆"
);
// 坡屋顶：离墙附屋 1×3 条状屋顶出人字坡（瓦红）
assert.equal(townStats.roofCount, 3, "附屋条状屋顶必须出人字坡顶");
assert.equal(allByName(citadel, "town-roof").filter((x) => x.isMesh).length, 3);
for (const roof of allByName(citadel, "town-roof")) {
  assert.equal(roof.material.color.getHex(), 0xb4694e, "坡顶必须为瓦红色");
}
// 水道：第 5 列暗渠 7 格 + 后排水巷 3 格；水面 + 夹道拱形水门
assert.equal(townStats.canalCount, 10, "水道 = 第 5 列暗渠 7 格 + 后排水巷 3 格");
assert.equal(
  allByName(citadel, "town-canal-water").filter((x) => x.isMesh).length,
  townStats.canalCount
);
assert.equal(townStats.waterGateCount, 20, "夹道立面底层必须出拱形水门");
assert.equal(
  allByName(citadel, "town-watergate").filter((x) => x.isMesh).length,
  townStats.waterGateCount
);
// 正门：棕色双开门 + 木门廊，位于前排中央、朝向 +z
assert(townStats.gate, "必须存在 D 正门格");
assert.equal(townStats.gate.x, 0);
assert.equal(townStats.gate.z + CITADEL.townOffsetZ, 9,
  "门脸经 townOffsetZ 补偿后必须在前排 z=9（与石阶平桥门槛条 z=9.05 相接）");
const gateDoors = allByName(citadel, "town-gate-door");
assert.equal(gateDoors.length, 2);
for (const door of gateDoors) {
  assert.equal(door.material.color.getHex(), 0x8b5a2b, "正门必须为棕色木门");
}
assert.equal(allByName(citadel, "town-gate-portico-column").length, 2);
assert(byName(citadel, "town-gate-portico-pediment"));
// 屋顶花园：贴墙屋面格出绿植（统计与实例一致）
assert.equal(
  allByName(citadel, "town-shrub-").filter((x) => x.isGroup).length,
  townStats.shrubCount
);
ok(`体块×${townStats.cellCount} · 穹顶×${townStats.domeCount} · 塔顶×4 · 坡顶×${townStats.roofCount} · 拱×${townStats.archCount} · 拱窗×${townStats.windowCount} · 城垛×${townStats.crenelCount} · 围栏×${townStats.fenceCount} · 水道×${townStats.canalCount} · 水门×${townStats.waterGateCount}`);

console.log("[4] 旧手工体量必须彻底移除");
for (const stale of [
  "mega-bastion-box",
  "grand-hall",
  "holy-sanctuary",
  "royal-dome-crown",
  "brick-bastion",
  "minaret-left",
  "needle-finial",
]) {
  assert(!byName(citadel, stale), `旧手工构件残留：${stale}`);
}
assert.equal(allByName(citadel, "bastion-crenel").length, 0);
assert.equal(allByName(citadel, "bifora-arch").length, 0);
ok("手工要塞/大厅/圣堂/旧穹顶全部移除，只保留规则生成体量");

console.log("[7] 全网格反向壳墨线 + 全 Toon/flatShading/零透射");
let surfaceCount = 0;
let outlineMisses = 0;
let materialFailures = 0;
citadel.traverse((object) => {
  if (!object.isMesh || object.userData.isOutline) return;
  surfaceCount++;
  const outline = object.children.find((child) => child.userData?.isOutline);
  if (!outline || !outline.material.isMeshBasicMaterial || outline.material.side !== THREE.BackSide) {
    outlineMisses++;
  }
  if (
    !object.material.isMeshToonMaterial ||
    object.material.flatShading !== true ||
    object.material.isMeshPhysicalMaterial ||
    object.material.transmission > 0
  ) {
    materialFailures++;
  }
});
assert.equal(outlineMisses, 0);
assert.equal(materialFailures, 0);
assert.equal(surfaceCount, citadel.userData.outlinedSurfaceCount);
ok(`${surfaceCount}/${surfaceCount} 可见网格描边 · 全 Toon flatShading`);

console.log("[8] 规则小镇、五层贴地台地、静态更新契约与半径 160 定位");
citadel.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(citadel);
const totalHeight = bounds.max.y - bounds.min.y;
assert(totalHeight > 27 && totalHeight < 30, `五层制规则小镇总高应在 27–30，实际 ${totalHeight.toFixed(2)}`);
for (let i = 0; i < 60; i++) citadel.update(1 / 60, i / 60);
const { citadelRangeLiftDir, citadelSiteDir } = await import(
  new URL("src/world/citadelRange.js", BASE).href
);
const radius = 160;
const siteDir = citadelSiteDir(new THREE.Vector3());
const groundRadius = radius + citadelRangeLiftDir(siteDir);
const placed = buildOdysseyCitadel({ dir: siteDir, groundRadius, planetRadius: radius, seed: 7 });
const placedMetrics = citadelTerraceMetrics(placed.userData.contourSpec);
const curvatureDrop = citadelCurvatureDrop(groundRadius, placed.userData.contourSpec);
assert.equal(CITADEL.groundEmbed, 2, "第五层局部底面仍从 Y=2 开始");
assert(curvatureDrop > 1.7 && curvatureDrop < 1.9,
  `半径 160 / 台地 R24 的球面弦高应约 1.8，实际 ${curvatureDrop}`);
assert(Math.abs(
  placed.position.length() - (groundRadius - CITADEL.groundEmbed - curvatureDrop)
) < 1e-6, "城堡容器必须额外下降球面弦高");
assert(Math.abs(
  placed.position.length() + placedMetrics[4].bottom - (groundRadius - curvatureDrop)
) < 1e-6, "最低台地中心必须埋入地面，消除外缘悬空");
placed.updateMatrixWorld(true);
const outerGroundPoint = placed.localToWorld(new THREE.Vector3(
  placedMetrics[4].radius,
  placedMetrics[4].bottom,
  0
));
assert(Math.abs(outerGroundPoint.length() - groundRadius) < 1e-6,
  "最低第五层台地最外缘必须按球面曲率与地面精确相接");
assert(Math.abs(groundRadius - (radius + 0.4)) < 1e-6,
  "旧 +16 黄土主峰删除后只能保留 +0.4 地表接缝基线");
ok(`总高 ${totalHeight.toFixed(1)} · 曲率下沉 ${curvatureDrop.toFixed(2)} · 外缘贴地 R${groundRadius.toFixed(1)}`);

const widerContour = {
  ...placed.userData.contourSpec,
  terraces: placed.userData.contourSpec.terraces.map((entry, index) => ({
    ...entry,
    radius: entry.radius + index * 0.8,
  })),
};
rebuildCitadelTerrain(placed, widerContour);
const widerMetrics = citadelTerraceMetrics(placed.userData.contourSpec);
const widerDrop = citadelCurvatureDrop(groundRadius, placed.userData.contourSpec);
assert(widerDrop > curvatureDrop, "扩大台地后应自动增加曲率下沉量");
placed.updateMatrixWorld(true);
const widerOuterPoint = placed.localToWorld(new THREE.Vector3(
  widerMetrics[4].radius,
  widerMetrics[4].bottom,
  0
));
assert(Math.abs(widerOuterPoint.length() - groundRadius) < 1e-6,
  "热编辑台地半径后，外缘仍必须自动重算并贴住球面");
ok(`台地热编辑后曲率下沉自动更新 ${curvatureDrop.toFixed(2)}→${widerDrop.toFixed(2)}`);

console.log("[9] 场景接线 + 纯白 AmbientLight 1.4");
const island = fs.readFileSync(fileURLToPath(new URL("src/scenes/messengerIsland.js", BASE)), "utf8");
assert(island.includes("buildOdysseyCitadel"));
assert(island.includes("odysseyCitadel.update"));
assert(island.includes("citadelRangeLiftDir"));
const environment = fs.readFileSync(fileURLToPath(new URL("src/world/environment.js", BASE)), "utf8");
assert(/AmbientLight\(0xffffff,\s*P\.ambientIntensity\s*\?\?\s*1\.4\)/.test(environment));
const params = fs.readFileSync(fileURLToPath(new URL("src/core/params.js", BASE)), "utf8");
assert(/ambientIntensity:\s*1\.4/.test(params));
ok("主场景完成接线 · 环境光 #FFFFFF / 1.4");

console.log("[10] 地形编辑器：台地参数热重建 + 土坡支撑探测");
const newContour = {
  ...CITADEL.contourTerrain,
  terraces: [
    { radius: 14, height: 3.0 },   // 台地 1：最高
    { radius: 17.5, height: 2.5 },
    { radius: 21, height: 2.0 },
    { radius: 24.5, height: 1.5 },
    { radius: 28, height: 1.2 },   // 台地 5：最低
  ],
};
const normalizedNewContour = normalizeCitadelTerrain(newContour);
const terrain2 = rebuildCitadelTerrain(citadel, newContour);
assert(terrain2?.isGroup, "地形热重建必须返回新外围地势系统");
assert.equal(citadel.userData.outerTerrainSystem, terrain2, "容器必须换挂新地势");
const editedMetrics = citadelTerraceMetrics(normalizedNewContour);
const expectBaseY = editedMetrics[0].top - 0.06;
assert(Math.abs(citadel.userData.townBaseY - expectBaseY) < 1e-9, "townBaseY 必须跟随新台地");
for (let terraceIndex = 0; terraceIndex < 5; terraceIndex++) {
  const level = byName(citadel, `town-terrace-${terraceIndex}-level-0`);
  assert(Math.abs(level.position.y - (editedMetrics[terraceIndex].top - 0.06)) < 1e-9,
    `台地 ${terraceIndex + 1} 城堡基座必须跟随本台地顶面`);
  const shelf = byName(terrain2, `contour-step-${terraceIndex}`);
  assert.equal(shelf.userData.contourRadius, normalizedNewContour.terraces[terraceIndex].radius);
  assert.equal(shelf.userData.terraceHeight, normalizedNewContour.terraces[terraceIndex].height);
}
for (let terraceIndex = 0; terraceIndex < editedMetrics.length - 1; terraceIndex++) {
  const worldHeightDifference = editedMetrics[terraceIndex].top
    - editedMetrics[terraceIndex + 1].top;
  assert(worldHeightDifference >= CITADEL_MIN_TERRACE_HEIGHT,
    `台地 ${terraceIndex + 1}/${terraceIndex + 2} 的建筑基准高差必须至少一层`);
  const upperBuildingBase = byName(citadel, `town-terrace-${terraceIndex}-level-0`).position.y;
  const lowerBuildingBase = byName(citadel, `town-terrace-${terraceIndex + 1}-level-0`).position.y;
  assert(upperBuildingBase - lowerBuildingBase >= CITADEL_MIN_TERRACE_HEIGHT,
    "同一城堡层放到相邻台地后，世界高度必须天然错开至少一层");
}
assert.equal(byName(terrain2, "contour-step-0").userData.isHighestTerrace, true,
  "鸟瞰第一层必须是最高台地");
assert.equal(terrain2.userData.pilgrimageStepCount > 0, true, "石阶必须随地形重建");
assert.equal(terrain2.userData.pilgrimageFlightCount, 5, "默认楼梯必须连接地面与五座台地");
assert.equal(terrain2.userData.waterfallNotchLayers, 4, "四个层间瀑布缺口必须默认保留");
// 支撑探测按当前台地独立判定：五层台地各取一个可见落点，必须全部可建。
const phiOk = 2.5;
for (let terraceIndex = 0; terraceIndex < editedMetrics.length; terraceIndex++) {
  const outer = editedMetrics[terraceIndex].radius;
  const inner = terraceIndex === 0 ? 0 : editedMetrics[terraceIndex - 1].radius;
  const radius = terraceIndex === 0 ? outer * 0.45 : (inner + outer) * 0.5;
  const support = terrainSupportLevel(
    citadel,
    radius * Math.sin(phiOk),
    radius * Math.cos(phiOk),
    2,
    terraceIndex
  );
  assert.equal(support, 0,
    `台地 ${terraceIndex + 1} 可见台面必须允许城堡第 1 层落地，实际 ${support}`);
}
assert.equal(terrainSupportLevel(citadel, 200, 200, 2), -1, "远处无土坡支撑必须返回 -1");
assert.equal(terrainSupportLevel(citadel, 16 * Math.sin(phiOk), 16 * Math.cos(phiOk), 2, 1), 0,
  "台地 2 的可见环带必须允许其城堡第 1 层落地");
assert.equal(terrainSupportLevel(citadel, 16 * Math.sin(phiOk), 16 * Math.cos(phiOk), 2, 0), -1,
  "台地 2 环带不得误写进台地 1 城堡");
assert.equal(terrainSupportLevel(citadel, 26 * Math.sin(phiOk), 26 * Math.cos(phiOk), 2, 4), 0,
  "台地 5 外环必须允许独立五层城堡");
// 默认瀑布缺口内没有承重面。
const phiNotch = 0.17; // 缺口中心方位角
const rNotch = 16;
const nxNotch = rNotch * Math.sin(phiNotch);
const nzNotch = rNotch * Math.cos(phiNotch);
assert.equal(terrainSupportLevel(citadel, nxNotch, nzNotch, 2, 1), -1,
  "缺口扇区内柱位无承重，必须返回 -1");
// 恢复默认参数：可逆
rebuildCitadelTerrain(citadel, CITADEL.contourTerrain);
assert(Math.abs(citadel.userData.townBaseY - CITADEL.townBaseY) < 1e-9, "重置后基座必须复原");
ok("台地参数热重建 · 镇体基座跟随顶层台面 · 土坡支撑探测（中心可放/远处不可放）");

console.log("[11] 地貌对象：瞭望塔 + 参天树放置、描边、存档归一化与贴地热重建");
const terrainObjectSpec = [
  { id: "tower-a", type: "watchtower", terraceIndex: 0, x: -5, z: 0, yaw: 0.2, scale: 0.42 },
  { id: "tree-a", type: "elderTree", terraceIndex: 0, x: 5, z: 0, yaw: -0.1, scale: 0.45 },
];
assert.equal(normalizeCitadelTerrainObjects(terrainObjectSpec).length, 2);
assert.equal(citadelTerrainPointSupported(CITADEL.contourTerrain, -5, 0, 0), true);
const objectCitadel = buildOdysseyCitadel({
  place: false,
  seed: 7,
  terrainObjects: terrainObjectSpec,
});
const objectGroup = objectCitadel.userData.terrainObjects;
assert.equal(objectGroup?.name, "citadel-terrain-objects");
assert.equal(objectGroup.children.length, 2, "必须生成一座瞭望塔和一棵参天树");
const placedTower = objectGroup.getObjectByName("citadel-terrain-object-tower-a");
const placedTree = objectGroup.getObjectByName("citadel-terrain-object-tree-a");
assert(placedTower?.getObjectByName("watchtower-lookout-window"), "瞭望塔必须带瞭望窗口");
assert.equal(placedTree?.getObjectsByProperty("name", "citadel-elder-tree-crown").length, 8,
  "参天树必须具有八团低多边形云冠");
const objectTopY = citadelTerraceMetrics(CITADEL.contourTerrain)[0].top;
assert.equal(placedTower.position.y, objectTopY);
assert.equal(placedTree.position.y, objectTopY);
let terrainObjectMeshes = 0;
let terrainObjectOutlined = 0;
objectGroup.traverse((object) => {
  if (!object.isMesh || object.userData.isOutline) return;
  terrainObjectMeshes++;
  if (object.children.some((child) => child.userData.isOutline)) terrainObjectOutlined++;
});
assert.equal(terrainObjectOutlined, terrainObjectMeshes, "两个地貌对象的全部网格都必须带墨线");
const tallerContour = {
  ...CITADEL.contourTerrain,
  terraces: CITADEL.contourTerrain.terraces.map((entry, index) => ({
    ...entry,
    height: index === 0 ? 4 : 2,
  })),
};
rebuildCitadelTerrain(objectCitadel, tallerContour);
const rebuiltObjects = objectCitadel.userData.terrainObjects;
assert.equal(rebuiltObjects.children.length, 2);
assert.equal(
  rebuiltObjects.getObjectByName("citadel-terrain-object-tower-a").position.y,
  citadelTerraceMetrics(tallerContour)[0].top,
  "修改台地层高后瞭望塔必须重新贴到台面"
);
const onlyTree = rebuildCitadelTerrainObjects(objectCitadel, [terrainObjectSpec[1]]);
assert.equal(onlyTree.children.length, 1, "删除工具必须能热重建为仅保留参天树");
ok(`瞭望塔×1 · 参天树×1 · 网格描边 ${terrainObjectMeshes}/${terrainObjectMeshes} · 台地变高自动贴地`);

console.log(`\n全部通过：${pass} 组验收`);
