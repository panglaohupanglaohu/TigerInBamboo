// 太古高山圣城要塞验收（主建筑重构版）：三层马斯塔巴内缩 · 垛口 · 双联拱窗
// 黄金瓜棱穹顶（鼓座+1.25 拉伸）· 避雷针 · 双层宣礼塔 · 红砖角楼
// 水墨描边全覆盖 · 全 MeshToonMaterial（SwiftShader 无头安全）· 瀑布已彻底移除
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
const { buildOdysseyCitadel, CITADEL } = await import(
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

console.log("[1] 统一 castleContainer + 五层物理层级");
assert.equal(citadel.name, "castleContainer");
assert.equal(citadel.userData.kind, "odyssey-citadel");
assert.equal(citadel.userData.layers.length, 5);
for (let i = 0; i < 5; i++) {
  const layer = byName(citadel, `citadel-layer-${i}`);
  assert(layer?.isGroup, `Layer ${i} Group 缺失`);
  assert.equal(layer.userData.layerIndex, i);
}
const mainCastle = byName(citadel, "odyssey-citadel-five-layer-assembly");
assert.deepEqual(mainCastle.scale.toArray(), [0.5, 0.5, 0.5]);
assert.equal(mainCastle.position.y, 12);
ok("单一容器返回 · Layer 0–4 独立 Group · 主城整体缩放至 1/2");

console.log("[1b] 外围五级等高线与完全暴露的折返石阶");
const outerTerrain = byName(citadel, "citadel-outer-terrain-system");
assert(outerTerrain?.isGroup, "外围地势系统缺失");
assert.equal(outerTerrain.parent, citadel, "外围系统必须是 castleContainer 的全尺寸直属子组");
assert.equal(mainCastle.parent, citadel, "半尺寸主城必须与外围地势互为兄弟组");
const contourSteps = allByName(outerTerrain, "contour-step-").filter((x) => x.isMesh);
assert.equal(contourSteps.length, 5);
for (let i = 0; i < contourSteps.length; i++) {
  const shelf = contourSteps[i];
  const expectedRadius = 24 * 0.9 ** i;
  assert.equal(shelf.geometry.type, "CylinderGeometry");
  assert.equal(shelf.geometry.parameters.height, 2);
  assert.equal(shelf.geometry.parameters.radialSegments, 12);
  assert(Math.abs(shelf.geometry.parameters.radiusTop - expectedRadius) < 1e-9);
  assert(Math.abs(shelf.geometry.parameters.radiusBottom - expectedRadius) < 1e-9);
  assert.equal(shelf.position.y, 3 + i * 2);
  assert.equal(shelf.material.color.getHex(), 0x555555);
}
assert.equal(allByName(outerTerrain, "ring-").length, 0, "砖红色环墙与卫楼必须完全移除");
assert.equal(outerTerrain.userData.rampartSegmentCount, 0);
assert.equal(outerTerrain.userData.watchtowerCount, 0);
const pilgrimageSteps = allByName(outerTerrain, "pilgrimage-step-").filter((x) => x.isMesh);
assert.equal(pilgrimageSteps.length, 32);
assert.equal(pilgrimageSteps[0].position.y, 12);
assert.equal(pilgrimageSteps.at(-1).position.y, 21);
assert.equal(outerTerrain.userData.rampTurnCount, 2);
ok("等高线×5 · 红砖防线×0 · 32级双折返朝圣阶无遮拦暴露");

console.log("[2] Layer 0：七块低面二十面体断崖");
const rocks = allByName(citadel, "primordial-cliff-rock-");
assert.equal(rocks.length, 7);
for (const rock of rocks) {
  assert.equal(rock.geometry.type, "IcosahedronGeometry");
  assert.equal(rock.geometry.parameters.radius, 6.5);
  assert.equal(rock.geometry.parameters.detail, 0);
  assert(rock.scale.x >= 1 && rock.scale.x < 1.4);
  assert(rock.scale.y >= 0.8 && rock.scale.y < 1.1);
  assert(rock.scale.z >= 1 && rock.scale.z < 1.4);
  assert(rock.position.y >= 3.6 && rock.position.y <= 4.4);
  assert.equal(rock.material.color.getHex(), 0x4a4a4a);
}
ok("IcosahedronGeometry(6.5, 0) ×7 · 非等比缩放与 Y 轴偏转");

console.log("[3] Layer 1：24×12×24 要塞、百枚城垛与木门廊");
const base = byName(citadel, "mega-bastion-box");
assert.deepEqual(
  [base.geometry.parameters.width, base.geometry.parameters.height, base.geometry.parameters.depth],
  [24, 12, 24]
);
assert.deepEqual(base.position.toArray(), [0, 10, 0]);
assert.equal(base.material.color.getHex(), 0xe5eff2);
const crenels = allByName(citadel, "bastion-crenel");
assert(crenels.length >= 96, `一圈城垛应 ≥96，实际 ${crenels.length}`);
for (const c of crenels) {
  assert.deepEqual(
    [c.geometry.parameters.width, c.geometry.parameters.height, c.geometry.parameters.depth],
    [0.5, 1.4, 0.5]
  );
  assert(Math.abs(c.position.y - 16.7) < 1e-9);
}
assert.deepEqual(byName(citadel, "gate-recess").position.toArray(), [0, 6.85, 14.826]);
assert(byName(citadel, "lower-ceremonial-gatehouse"));
const barbicanTowers = [
  byName(citadel, "barbican-left-tower"),
  byName(citadel, "barbican-right-tower"),
];
for (const tower of barbicanTowers) {
  assert(tower, "瓮城前突塔缺失");
  assert.equal(tower.geometry.parameters.radialSegments, 8);
  assert.equal(tower.geometry.parameters.radiusTop, tower.geometry.parameters.radiusBottom,
    "瓮城塔八面墙必须垂直，不允许锥台收分");
}
assert.equal(allByName(citadel, "barbican-golden-cap").length, 2);
assert.equal(allByName(citadel, "barbican-lookout-window").length, 2);
assert.equal(allByName(citadel, "bastion-weathered-course").length, 0);
assert(allByName(citadel, "bastion-vertical-pilaster").length >= 18);
const columns = allByName(citadel, "portico-column");
assert.equal(columns.length, 2);
for (const column of columns) {
  assert.equal(column.geometry.parameters.radialSegments, 5);
  assert.equal(column.material.color.getHex(), 0x8b5a2b);
}
const pediment = byName(citadel, "inverted-portico-pediment");
assert.equal(pediment.geometry.parameters.radius, 2.2);
assert.equal(pediment.geometry.parameters.radialSegments, 4);
assert.equal(pediment.geometry.parameters.openEnded, true);
assert.equal(pediment.rotation.x, Math.PI);
ok(`主墙锁尺 · 城垛×${crenels.length} · 五棱木柱×2 · 倒四棱锥山花`);

console.log("[4] Layer 2：30% 内缩大厅、半六棱凸窗与收尖双联拱");
const hall = byName(citadel, "grand-hall");
assert.deepEqual(
  [hall.geometry.parameters.width, hall.geometry.parameters.height, hall.geometry.parameters.depth],
  [16, 10, 16]
);
assert.deepEqual(hall.position.toArray(), [0, 21, -4]);
assert.equal(hall.position.z - hall.geometry.parameters.depth / 2, -12);
assert.equal(base.position.z - base.geometry.parameters.depth / 2, -12);
const bays = allByName(citadel, "ribbed-bay");
assert.equal(bays.length, 2);
assert.deepEqual(bays.map((b) => b.position.x), [-6, 6]);
for (const bay of bays) {
  assert.equal(bay.geometry.parameters.radiusTop, 1.2);
  assert.equal(bay.geometry.parameters.radiusBottom, 1.2);
  assert.equal(bay.geometry.parameters.height, 8);
  assert.equal(bay.geometry.parameters.radialSegments, 6);
  assert.equal(bay.geometry.parameters.thetaLength, Math.PI);
  assert.equal(bay.geometry.parameters.openEnded, false);
}
const arches = allByName(citadel, "bifora-arch").concat(allByName(citadel, "bay-bifora-arch"));
assert.equal(arches.length, 20);
assert.equal(arches[0].geometry.parameters.width, 0.4);
assert.equal(arches[0].geometry.parameters.height, 1.5);
assert.equal(arches[0].geometry.parameters.depth, 0.05);
assert.equal(arches[0].material.color.getHex(), 0x2a2b2d);
const secondary = byName(citadel, "secondary-golden-dome");
assert.deepEqual(secondary.position.toArray(), [6.5, 5, 6.5]);
assert.equal(byName(citadel, "secondary-dome-cap").geometry.parameters.radius, 2.2);
ok("16×10×16 后壁齐平 · 凸窗×2 · 双联拱×10 · 右前副金穹");

console.log("[5] Layer 3：9×8×9 圣堂与锁死红砖长方体角楼");
const sanctuary = byName(citadel, "holy-sanctuary");
assert.deepEqual(
  [sanctuary.geometry.parameters.width, sanctuary.geometry.parameters.height, sanctuary.geometry.parameters.depth],
  [9, 8, 9]
);
assert.deepEqual(sanctuary.position.toArray(), [0, 30, -7.5]);
assert.equal(sanctuary.position.z - sanctuary.geometry.parameters.depth / 2, -12);
assert.equal(allByName(citadel, "sanctuary-slit").length, 10);
const brick = byName(citadel, "brick-bastion");
assert.deepEqual(
  [brick.geometry.parameters.width, brick.geometry.parameters.height, brick.geometry.parameters.depth],
  [4.5, 16, 4.5]
);
assert.deepEqual(brick.position.toArray(), [9, 16, 5]);
assert.equal(brick.material.color.getHex(), 0xd6d8d4);
assert(byName(citadel, "bastion-high-window"));
assert(allByName(citadel, "brick-bastion-crenel").length >= 20);
assert.equal(allByName(citadel, "minaret-").filter((x) => x.isGroup).length, 2);
const leftDefense = byName(citadel, "left-octagonal-defense-tower");
assert(leftDefense?.isGroup, "城堡左侧八角防御塔缺失");
assert.equal(byName(citadel, "left-defense-tower-shaft").geometry.parameters.radialSegments, 8);
assert.equal(allByName(citadel, "left-defense-lookout-window").length, 3);
assert.equal(byName(citadel, "left-defense-tower-ivory-cap").material.color.getHex(), 0xe6e3d7);
assert(byName(citadel, "front-chapel"));
assert(byName(citadel, "stepped-upper-gallery"));
assert(byName(citadel, "left-upper-keep"));
assert(allByName(citadel, "citadel-shrub-").filter((x) => x.isGroup).length >= 6);
assert.equal(allByName(citadel, "citadel-wall-vine-").length, 0,
  "城堡墙面藤蔓必须彻底移除");
const roundTopiaries = allByName(citadel, "citadel-round-topiary-").filter((x) => x.isGroup);
assert.equal(roundTopiaries.length, 11, "城堡露台必须配置十一组圆球小绿植");
for (const topiary of roundTopiaries) {
  const crown = allByName(topiary, `${topiary.name}-round-crown`)[0];
  assert.equal(crown?.geometry.type, "SphereGeometry", "城堡小绿植必须使用圆球冠层");
}
ok("圣堂后壁 -12 对齐 · 三座错位附殿 · 墙面无藤蔓 · 圆球绿植×11");

console.log("[6] Layer 4：三阶黄金洋葱穹顶与 2× 玩家避雷针");
const crown = byName(citadel, "royal-dome-crown");
assert.deepEqual(crown.position.toArray(), [0, 34, -7.5]);
const dome = byName(citadel, "main-onion-dome");
const dp = dome.geometry.parameters;
assert.equal(dp.radius, 3.5);
assert.equal(dp.widthSegments, 16);
assert.equal(dp.heightSegments, 12);
assert.equal(dp.thetaLength, Math.PI / 2);
assert.deepEqual(dome.scale.toArray(), [1, 1.35, 1]);
assert.equal(dome.material.color.getHex(), 0xe6e3d7);
assert.equal(allByName(citadel, "main-dome-rib").length, 10);
assert.equal(allByName(citadel, "main-dome-rotunda-column").length, 12);
const gradient = dome.material.gradientMap;
assert(gradient?.isDataTexture);
assert.equal(gradient.image.width, 3);
assert.equal(gradient.minFilter, THREE.NearestFilter);
assert.equal(gradient.magFilter, THREE.NearestFilter);
const finial = byName(citadel, "needle-finial");
assert.equal(finial.geometry.parameters.height, PLAYER_HEIGHT * 2);
assert.equal(finial.geometry.parameters.radiusTop * 2, 0.05);
assert.equal(finial.position.y - finial.geometry.parameters.height / 2, 41.12);
assert.equal(finial.material.color.getHex(), 0x2a2b2d);
ok("12 柱采光鼓座 · 半球 Y×1.35 · 10 道瓜棱 · 3 像素阶梯");

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

console.log("[8] 半尺寸主城、全尺寸外围地势、静态更新契约与半径 160 峰顶定位");
citadel.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(citadel);
const totalHeight = bounds.max.y - bounds.min.y;
assert(totalHeight > 31 && totalHeight < 34, `缩放后总高应在 31–34，实际 ${totalHeight.toFixed(2)}`);
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

console.log(`\n全部通过：${pass} 组验收`);
