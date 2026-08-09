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
const { buildOdysseyCitadel, CITADEL, rebuildCitadelTerrain, terrainSupportLevel } = await import(
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
assert(townSpec?.levels?.length >= 5, "小镇必须提供逐层 ASCII 布局");
let specFilled = 0;
for (const rows of townSpec.levels) {
  for (const row of rows) specFilled += [...row].filter((ch) => ch !== ".").length;
}
assert.equal(townStats.cellCount, specFilled, "体块数必须等于 ASCII 地图填充格数");
assert.equal(CITADEL.townBaseY, 11.94, "小镇基座咬入顶层台地（Y=12）0.06");
ok(`单一容器 · Layer 0–4 · ASCII 地图 ${specFilled} 格全部成块`);

console.log("[1b] 外围五级台地（瀑布缺口）与折返石阶");
const outerTerrain = byName(citadel, "citadel-outer-terrain-system");
assert(outerTerrain?.isGroup, "外围地势系统缺失");
assert.equal(outerTerrain.parent, citadel, "外围系统必须是 castleContainer 的全尺寸直属子组");
assert.equal(mainCastle.parent, citadel, "缩放主城必须与外围地势互为兄弟组");
const contourShelves = [];
for (let i = 0; i < 5; i++) {
  const shelf = byName(outerTerrain, `contour-step-${i}`);
  assert(shelf?.isMesh, `台地 ${i} 缺失`);
  contourShelves.push(shelf);
  const expectedRadius = 24 * 0.9 ** i;
  assert.equal(shelf.userData.contourIndex, i);
  assert.equal(shelf.userData.contourRadius, expectedRadius);
  assert.equal(shelf.material.color.getHex(), 0xcfc49a, "台地必须为浅色黄土，弃用深灰");
  if (i < 4) {
    // 前四层：环形扇区开槽露出瀑布 + 实心核托住城堡
    assert.equal(shelf.geometry.type, "ExtrudeGeometry", `台地 ${i} 必须为开槽环形扇区`);
    assert.equal(shelf.position.y, 2 + i * 2);
    const core = byName(outerTerrain, `contour-step-${i}-core`);
    assert(core?.isMesh, `台地 ${i} 实心核缺失`);
    assert.equal(core.geometry.parameters.radiusTop, 9);
  } else {
    // 顶层完整圆柱：托住城堡与门廊平桥
    assert.equal(shelf.geometry.type, "CylinderGeometry");
    assert.equal(shelf.geometry.parameters.radiusTop, expectedRadius);
    assert.equal(shelf.position.y, 11);
  }
}
assert.equal(outerTerrain.userData.waterfallNotchLayers, 4, "前四层台地必须开瀑布缺口");
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
assert(Math.hypot(lastStep.position.x, lastStep.position.z - 7.05) < 1e-9,
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
assert(Math.abs(domes[0].position.z + CITADEL.townOffsetZ) < 1e-9,
  "主穹顶经 townOffsetZ 补偿后必须居中于 z=0");
assert.equal(domes[0].position.y, 6 * 2 + 2, "主穹顶落在顶层屋面"); // (by+1)*ch
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
assert.equal(townStats.gate.z + CITADEL.townOffsetZ, 7,
  "门脸经 townOffsetZ 补偿后必须在前排 z=7（与石阶平桥门槛条相接）");
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

console.log("[8] 规则小镇、全尺寸外围地势、静态更新契约与半径 160 峰顶定位");
citadel.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(citadel);
const totalHeight = bounds.max.y - bounds.min.y;
assert(totalHeight > 30 && totalHeight < 35, `规则小镇总高应在 30–35，实际 ${totalHeight.toFixed(2)}`);
for (let i = 0; i < 60; i++) citadel.update(1 / 60, i / 60);
const { citadelRangeLiftDir, citadelSiteDir } = await import(
  new URL("src/world/citadelRange.js", BASE).href
);
const radius = 160;
const siteDir = citadelSiteDir(new THREE.Vector3());
const groundRadius = radius + citadelRangeLiftDir(siteDir);
const placed = buildOdysseyCitadel({ dir: siteDir, groundRadius, planetRadius: radius, seed: 7 });
assert.equal(CITADEL.groundEmbed, 9.25, "城堡整体必须进一步下沉并咬入黄土坡");
assert(Math.abs(placed.position.length() - (groundRadius - CITADEL.groundEmbed)) < 1e-6);
assert(groundRadius > radius + 15);
ok(`总高 ${totalHeight.toFixed(1)} · update 稳定 · 峰顶半径 ${placed.position.length().toFixed(1)}`);

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
const newContour = { ...CITADEL.contourTerrain, layerHeight: 2.4, baseRadius: 28 };
const terrain2 = rebuildCitadelTerrain(citadel, newContour);
assert(terrain2?.isGroup, "地形热重建必须返回新外围地势系统");
assert.equal(citadel.userData.outerTerrainSystem, terrain2, "容器必须换挂新地势");
const expectBaseY = 2 + 2.4 * 5 - 0.06; // 顶层台面 14 咬入 0.06
assert(Math.abs(citadel.userData.townBaseY - expectBaseY) < 1e-9, "townBaseY 必须跟随新台地");
const rebuiltLv0 = byName(citadel, "town-level-0");
assert(Math.abs(rebuiltLv0.position.y - expectBaseY) < 1e-9, "镇体基座必须抬到新顶层台面");
assert.equal(byName(terrain2, "contour-step-0").userData.contourRadius, 28, "台地必须采用新基底半径");
assert.equal(terrain2.userData.pilgrimageStepCount > 0, true, "石阶必须随地形重建");
// 支撑探测：镇中心有顶层台面承重；远处无土坡
const sCenter = terrainSupportLevel(citadel, 0, 0, 2);
assert(sCenter >= 0 && sCenter <= 1, `镇中心必须有台地支撑（0 层附近），实际 ${sCenter}`);
assert.equal(terrainSupportLevel(citadel, 200, 200, 2), -1, "远处无土坡支撑必须返回 -1");
// 恢复默认参数：可逆
rebuildCitadelTerrain(citadel, CITADEL.contourTerrain);
assert(Math.abs(citadel.userData.townBaseY - CITADEL.townBaseY) < 1e-9, "重置后基座必须复原");
ok("台地参数热重建 · 镇体基座跟随顶层台面 · 土坡支撑探测（中心可放/远处不可放）");

console.log(`\n全部通过：${pass} 组验收`);
