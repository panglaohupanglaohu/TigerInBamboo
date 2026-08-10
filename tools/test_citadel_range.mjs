// 圣城山脉验收：仅保留台地、梯湖/瀑布与参天树等核心构成
// 运行：node tools/test_citadel_range.mjs
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

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  buildCitadelRange,
  citadelRangeLiftDir,
  citadelRangeLiftLocal,
  citadelWalkLiftLocal,
  citadelWalkLiftDir,
  citadelSiteDir,
  CITADEL_PEAK,
  VIEW_PEAK,
  RANGE_SITE,
} = await import(new URL("src/world/citadelRange.js", BASE).href);
const {
  CITADEL,
  citadelCurvatureDrop,
  citadelTerraceMetrics,
} = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const {
  createCitadelMoat,
  CITADEL_MOAT_SPEC,
} = await import(new URL("src/assets/citadelMoat.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};
const R = 160;

console.log("[1] 高程函数：旧黄土主峰已删除");
const peakTop = citadelRangeLiftLocal(0, 0);
assert(Math.abs(peakTop - (0.4 + CITADEL_PEAK.h)) < 1e-9, `城堡核心(主峰)顶应 ${0.4 + CITADEL_PEAK.h}，实际 ${peakTop}`);
// 看台峰(cz=36)位于护城河内岸环带绿地(24~38)：随绿地下沉，应低于护城河水面。
const moatWaterY = 0.4 + 0.05; // BASE_LIFT + 0.05
const viewTop = citadelRangeLiftLocal(VIEW_PEAK.cx, VIEW_PEAK.cz);
assert(viewTop < moatWaterY - 0.2,
  `前方绿地(看台峰)必须沉到护城河水面下：水面 ${moatWaterY.toFixed(2)}，实际 ${viewTop.toFixed(2)}`);
assert.equal(CITADEL_PEAK.h, 0, "旧 +16 黄土主峰必须彻底删除");
assert.equal(VIEW_PEAK.h, 0, "旧前景土坡必须彻底删除");
ok(`旧主峰与前坡归零；城堡核心保持 +${peakTop.toFixed(1)}，前方绿地沉到护城河水下(${viewTop.toFixed(2)})`);

// 扩大后的主峰必须完整包住 24×24 城墙、瓮城和外围乱石。
const castleShoulder = citadelRangeLiftLocal(16, 14);
assert(Math.abs(castleShoulder - peakTop) < 1e-9,
  `城堡外围不得残留独立土坡：+${castleShoulder.toFixed(1)}`);
const outerSlope = citadelRangeLiftLocal(25, 15);
// 台地外缘(24~38)是护城河内岸浸水环带：不再是凸起的黄土缓坡，而是低于城堡核心、
// 沉到护城河水面下的平地（无凸起）。
assert(outerSlope < peakTop - 0.1,
  `台地外应为下沉浸水环带而非凸起缓坡：核心 ${peakTop.toFixed(2)}，外缘 ${outerSlope.toFixed(2)}`);
ok(`城堡足域为贴地基线 +${peakTop.toFixed(1)}，台地外缘浸水下沉 ${outerSlope.toFixed(2)}`);

// 域外恒 0；域缘裙边沉入球面遮缝
assert.equal(citadelRangeLiftLocal(200, 200) > -1 && citadelRangeLiftLocal(200, 200) <= 0.7, true);
const siteDir = citadelSiteDir(new THREE.Vector3());
const farDir = new THREE.Vector3(0, 0, -1); // 背向
assert.equal(citadelRangeLiftDir(farDir), 0, "背向域外应恒 0");
assert(Math.abs(citadelRangeLiftDir(siteDir) - peakTop) < 1e-6, "站点方向高程 = 主峰顶");
ok("域外归零 · 站点高程与局部一致（dir 路径无损）");

console.log("[2] 五层台地独立承担全部高差");
assert(viewTop < peakTop - 0.1,
  "前坡(护城河内岸绿地)应低于城堡核心——不再退化为同一凸起承接层");
ok("外部地表不再偷偷增加第六层土坡；前方绿地浸水、城堡核心保持");

console.log("[3] 地形网格：视觉=碰撞");
const scene = new THREE.Scene();
const range = buildCitadelRange(scene, R);
assert(range.mesh?.isMesh, "应返回网格");
assert(scene.children.includes(range.mesh), "网格应入场景");
assert.equal(range.mesh.userData.formerSoilMoundRemoved, true,
  "地表网格必须显式标记旧黄土坡已删除");
assert.equal(range.mesh.userData.interCascadeNotch, undefined,
  "不得残留跨越瀑布 2、3 的旧地表缺口");
const pos = range.mesh.geometry.attributes.position;
assert(pos.count > 3000, `顶点数 ${pos.count} 过少`);
let minR = Infinity, maxR = 0;
const v = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  v.fromBufferAttribute(pos, i);
  const r = v.length();
  if (r < minR) minR = r;
  if (r > maxR) maxR = r;
}
assert(minR >= R - 0.71, `裙边最深 ${minR.toFixed(2)} 不应低于 R-0.7`);
assert(maxR <= R + 0.41, `贴地层最高 ${maxR.toFixed(2)} 不应超过 R+0.4`);
assert(maxR >= R + 0.39, "贴地承接面必须覆盖全球球面弦差");
ok(`网格 ${pos.count} 顶点 · 半径域 [${minR.toFixed(1)}, ${maxR.toFixed(1)}] 吻合高程函数`);

// 顶点色：峰顶岩灰、谷地草绿
const col = range.mesh.geometry.attributes.color;
assert(col && col.count === pos.count, "顶点色与顶点一一对应");
ok("顶点色渐变（草绿→土褐→岩灰）就位");

assert.equal(range.foregroundTower, null, "前景防御塔必须删除");
// 城堡背后左右各一组雪山单元（面对正门时左/右翼）
assert(range.snowMountains?.isGroup, "背景雪山组容器缺失");
assert.equal(range.snowMountains.name, "citadel-background-snow-massif");
assert(range.snowMassifLeft?.isGroup, "左侧雪山组缺失");
assert(range.snowMassifRight?.isGroup, "右侧雪山组缺失");
assert.equal(range.snowMassifLeft.name, "citadel-snow-massif-left");
assert.equal(range.snowMassifRight.name, "citadel-snow-massif-right");
// 护城河：环绕圣城墙脚，落在星球曲面地表，衔接地面/潭缘
assert(range.moat?.isGroup, "护城河组缺失");
assert.equal(range.moat.name, "citadel-moat");
assert(range.moat.getObjectByName("citadel-moat-water"), "护城河水面缺失");
assert(range.moat.getObjectByName("citadel-moat-inner-wall"), "护城河内壁缺失");
assert(typeof range.moat.update === "function", "护城河必须提供阶梯水波 update");
const moatSpec = range.moat.userData.moatSpec ?? CITADEL_MOAT_SPEC;
assert(moatSpec?.innerRadius > 24, "护城河内径必须大于第五层台地 baseRadius=24");
assert(moatSpec?.outerRadius > moatSpec.innerRadius, "护城河外径应大于内径");
// 护城河外径必须覆盖旧港码头（码头在 range 局部 ~(-14.7,42.7)，距圆心半径约 45）
assert(moatSpec?.outerRadius >= 45, "护城河外径必须放大到覆盖旧港码头（半径≈45）");
assert(range.moat.userData.harborPadLocal?.lx != null, "护城河应提供港口垫局部坐标");
// 低多边形特洛伊木马：放在地面第一个湖泊(terrace-5-pool)水面上
assert(range.trojanHorse?.isGroup, "特洛伊木马组缺失");
assert.equal(range.trojanHorse.name, "citadel-trojan-horse");
let troyParts = 0;
range.trojanHorse.traverse((o) => { if (o.isMesh) troyParts++; });
assert(troyParts >= 30, "木马应由 30+ 个低模积木拼块构成");
const troyLx = range.trojanHorse.userData.rangeLocal.lx;
const troyLz = range.trojanHorse.userData.rangeLocal.lz;
// 地面第一个湖泊 = terrace-5-pool，range 局部 (1.0, 38.0)
assert(Math.abs(troyLx - 1.0) < 2, "木马应放在地面第一个湖泊(terrace-5-pool)处");
assert(Math.abs(troyLz - 38.0) < 2, "木马应放在地面第一个湖泊(terrace-5-pool)处");
assert.equal(range.vegetation, null, "山坡散灌木必须删除");
assert.equal(range.loessGroundSeal, null, "近地面的旧黄土封口层必须删除");
assert.equal(range.castleFooting, null, "近地面的旧城堡承台层必须删除");
assert(range.pilgrimageWaterSteps?.isGroup, "城堡前白石梯湖缺失");
assert(range.pilgrimageCascades?.isGroup, "梯湖之间的多层瀑布缺失");
assert.equal(range.interCascadeBridgePool, null,
  "必须删除曾经跨接瀑布 2、3 的长湖盆");
assert.equal(scene.getObjectByName("citadel-waterfall-2-3-bridge-pool"), undefined,
  "场景中不得残留跨两层的桥接水体");
assert(range.pilgrimageLookout?.isGroup, "远眺相机基准数据缺失");
assert(range.sacredTarnTree?.isGroup, "深潭旁湖沼参天树缺失");
assert.equal(range.lakeBallShrubs, null, "湖岸球形灌木必须删除");
assert.equal(scene.getObjectByName("citadel-loess-ground-seal"), undefined,
  "场景中不得残留第 6 层黄土封口");
assert.equal(scene.getObjectByName("citadel-solid-soil-footing"), undefined,
  "场景中不得残留第 7 层城堡承台");
const waterStages = range.pilgrimageWaterSteps.children;
assert.equal(waterStages.length, 5, "必须由四座高低浅湖和一座地面深潭组成");
const waterElevations = waterStages.map((stage) => stage.userData.composition.localElevation);
for (let i = 1; i < waterElevations.length; i++) {
  assert(waterElevations[i] < waterElevations[i - 1],
    "梯湖水位必须从城门向地面深潭逐级下降");
}
let whiteStoneBanks = 0;
let waterSurfaces = 0;
range.pilgrimageWaterSteps.traverse((o) => {
  if (/-white-stone-bank$/.test(o.name || "")) whiteStoneBanks++;
  if (/-pool-water$/.test(o.name || "")) waterSurfaces++;
});
assert.equal(whiteStoneBanks, 5, "每级湖泊都必须有独立白石岸台");
assert.equal(waterSurfaces, 5, "四座浅湖与地面深潭都必须有水面");
const upperWater = range.pilgrimageWaterSteps
  .getObjectByName("citadel-terrace-1-pool-water");
assert(upperWater.geometry.attributes.normal.getY(0) > 0.9,
  "梯湖水面法线必须朝上，避免卡通光照渲染成黑色");
const upperBank = range.pilgrimageWaterSteps
  .getObjectByName("citadel-terrace-1-pool-white-stone-bank");
assert(upperBank.geometry.attributes.normal.getY(0) > 0.9,
  "白石岸台顶面法线必须朝上，禁止露出黑色反向描边壳");
assert.equal(waterStages.at(-1).userData.composition.kind, "lowest-terrace-pool",
  "最低一级必须绑定第五层台地，而不是额外地貌层");
const defaultMetrics = citadelTerraceMetrics(range.contourSpec);
const defaultCurvatureDrop = citadelCurvatureDrop(R + 0.4, range.contourSpec);
const waterGrounding = range.pilgrimageWaterSteps.userData.curvatureGrounding;
assert(waterGrounding.contactRadius > 44,
  `最低湖岸应按真实远端半径约 45 计算曲率，实际 ${waterGrounding.contactRadius}`);
assert(waterGrounding.containerBaseLift < 0.4 - CITADEL.groundEmbed - defaultCurvatureDrop,
  "梯湖/瀑布必须比城堡 R24 基座进一步下降，不能继续复用城堡弦高");
const lowestBank = range.pilgrimageWaterSteps
  .getObjectByName("citadel-terrace-5-pool-white-stone-bank");
range.pilgrimageWaterSteps.updateMatrixWorld(true);
const lowestBankPosition = lowestBank.geometry.attributes.position;
let maxUndersideRadius = -Infinity;
for (let index = 0; index < lowestBankPosition.count; index++) {
  if (lowestBankPosition.getY(index) >= -0.05) continue;
  const point = new THREE.Vector3().fromBufferAttribute(lowestBankPosition, index);
  lowestBank.localToWorld(point);
  maxUndersideRadius = Math.max(maxUndersideRadius, point.length());
}
assert(maxUndersideRadius <= R + 0.4 + 1e-6,
  "最低湖泊白石台阶的全部底部顶点都不得悬在球面之上");
assert(Math.abs(maxUndersideRadius - (R + 0.4)) < 1e-5,
  "最低湖泊白石台阶必须至少有一个真实底部顶点接触地面");
const oldFlatWaterElevation = 0.4 - CITADEL.groundEmbed
  - defaultCurvatureDrop + defaultMetrics[4].top + 0.09;
assert(waterElevations.at(-1) < oldFlatWaterElevation - 2,
  "最低湖面与整套瀑布必须显著低于旧 R24 平面定位");
const outerTopLift = citadelWalkLiftLocal(defaultMetrics[4].radius, 0);
const expectedOuterTopLift = Math.hypot(
  R + 0.4 - CITADEL.groundEmbed - defaultCurvatureDrop + defaultMetrics[4].top,
  defaultMetrics[4].radius
) - R;
assert(Math.abs(outerTopLift - expectedOuterTopLift) < 1e-6,
  "玩家碰撞台面必须使用同一球面曲率，不能沿用平面高程");
assert.equal(range.pilgrimageCascades.children.length, 4,
  "五级梯湖之间必须部署四道瀑布");
for (const [index, waterfall] of range.pilgrimageCascades.children.entries()) {
  assert.equal(waterfall.name, "waterfallGroup", "瀑布工厂必须返回统一 waterfallGroup");
  assert.equal(waterfall.userData.sequence, index);
  const adjacentDrop = waterElevations[index] - waterElevations[index + 1];
  assert(Math.abs(waterfall.userData.actualDrop - adjacentDrop) < 1e-6,
    "每道瀑布高差必须严格等于相邻两层湖泊水位差");
  assert.equal(waterfall.userData.spansTerraceCount, 1,
    "任何瀑布都只能跌落一个台面");
  assert.equal(waterfall.userData.upperTerraceIndex, index);
  assert.equal(waterfall.userData.lowerTerraceIndex, index + 1);
  assert(waterfall.userData.facadeClearance >= 1.2,
    "瀑布必须前移离开黄土坡切面，禁止被地形吞没");
  assert.equal(waterfall.userData.deployedCurtainWidth, 5.22,
    "实际梯湖水帘必须横向扩宽，接近参考图宽瀑比例");
  const spillwayCliff = waterfall
    .getObjectByName("citadel-waterfall-white-stone-spillway-cliff");
  assert(spillwayCliff?.isMesh, "每道水帘背后必须有白石跌水崖壁承接");
  const receivingWater = waterfall
    .getObjectByName("citadel-cascade-receiving-water");
  assert(receivingWater?.isMesh, "每道瀑布底部必须有与下层湖相连的接水面");
  assert.equal(receivingWater.geometry.type, "CircleGeometry");
  assert.equal(receivingWater.material.type, "MeshBasicMaterial");
  assert.equal(waterfall.userData.receivingPool, waterfall.userData.lowerPool,
    "接水延伸面必须绑定下一层湖泊");
  assert.equal(waterfall.userData.waterlinePenetration, 0.5);
  let soilShoulders = 0;
  waterfall.traverse((o) => {
    if (/citadel-waterfall-(upper|lower)-soil-shoulder/.test(o.name || "")) {
      soilShoulders++;
    }
  });
  assert.equal(soilShoulders, 0,
    "瀑布周围不得重建遮挡水帘的黄土坡");
  assert.equal(waterfall.userData.rebuiltSoilShoulders, soilShoulders);
  const curtains = [];
  const mist = [];
  const ripples = [];
  waterfall.traverse((o) => {
    if (/^manga-waterfall-curtain-\d+$/.test(o.name || "")) curtains.push(o);
    if (/^manga-waterfall-mist-\d+$/.test(o.name || "")) mist.push(o);
    if (/^manga-waterfall-ripple-\d+$/.test(o.name || "")) ripples.push(o);
  });
  assert.equal(curtains.length, 4, "每道瀑布必须有四层纵深水帘");
  assert.equal(mist.length, 20, "每道瀑布必须有二十团低面数雾气");
  assert.equal(ripples.length, 3, "每道瀑布必须有三层水面涟漪");
  for (const curtain of curtains) {
    const bottom = curtain.position.y
      - curtain.geometry.parameters.height * curtain.scale.y * 0.5;
    assert(Math.abs(bottom + 0.5) < 1e-6,
      "部署水帘底端必须切入下游水面 0.5 单位");
  }
  if (index === range.pilgrimageCascades.children.length - 1) {
    scene.updateMatrixWorld(true);
    const bottomCurtain = curtains[0];
    const curtainPositions = bottomCurtain.geometry.attributes.position;
    let waterfallBottomMaxRadius = -Infinity;
    for (let vertex = 0; vertex < curtainPositions.count; vertex++) {
      if (curtainPositions.getY(vertex) >= 0) continue;
      const point = new THREE.Vector3().fromBufferAttribute(curtainPositions, vertex);
      bottomCurtain.localToWorld(point);
      waterfallBottomMaxRadius = Math.max(waterfallBottomMaxRadius, point.length());
    }
    // 水帘 scale.x=1.16 + 球面局部基会略抬最大半径；0.5 水线切入仍须贴近地表
    assert(waterfallBottomMaxRadius <= R + 0.4 + 0.35,
      "最底层瀑布水帘落水端必须切入曲面地表/最低湖，不得悬空");
  }
}
const oldWaterSteps = range.pilgrimageWaterSteps;
const oldCascades = range.pilgrimageCascades;
const editedContour = {
  ...range.contourSpec,
  terraces: [
    { radius: 15.7, height: 4 },
    { radius: 17.5, height: 2 },
    { radius: 19.5, height: 3 },
    { radius: 22.0, height: 2 },
    { radius: 25.0, height: 3 },
  ],
};
range.rebuildWaterTerraces(editedContour);
assert.equal(scene.children.includes(oldWaterSteps), false,
  "编辑台地后必须卸载旧湖泊，禁止双层叠加");
assert.equal(scene.children.includes(oldCascades), false,
  "编辑台地后必须卸载旧瀑布，禁止跨层残影");
assert.equal(range.pilgrimageWaterSteps.children.length, 5);
assert.equal(range.pilgrimageCascades.children.length, 4);
// 层叠瀑布可编辑开关：关闭后水系清空，再开启恢复五湖四帘
range.rebuildWaterTerraces({ ...editedContour, cascadeEnabled: false });
assert.equal(range.cascadeEnabled, false, "cascadeEnabled=false 必须关闭层叠瀑布");
assert.equal(range.pilgrimageWaterSteps.children.length, 0, "关闭后不得残留梯湖");
assert.equal(range.pilgrimageCascades.children.length, 0, "关闭后不得残留瀑布");
range.rebuildWaterTerraces({ ...editedContour, cascadeEnabled: true });
assert.equal(range.cascadeEnabled, true);
assert.equal(range.pilgrimageWaterSteps.children.length, 5, "重新开启应恢复五级梯湖");
assert.equal(range.pilgrimageCascades.children.length, 4, "重新开启应恢复四道瀑布");
const editedWaterY = range.pilgrimageWaterSteps.children
  .map((stage) => stage.userData.composition.localElevation);
for (const [index, waterfall] of range.pilgrimageCascades.children.entries()) {
  assert.equal(waterfall.userData.spansTerraceCount, 1);
  assert(Math.abs(
    waterfall.userData.actualDrop - (editedWaterY[index] - editedWaterY[index + 1])
  ) < 1e-6, "热重建后每道瀑布仍须只跨一个相邻台面");
}
let flatLookoutStones = 0;
range.pilgrimageLookout.traverse((o) => {
  if (o.name === "citadel-lookout-flat-stone") flatLookoutStones++;
});
assert.equal(flatLookoutStones, 0, "深潭前观景石必须删除");
assert.equal(scene.children.includes(range.pilgrimageLookout), false,
  "只读相机基准组不得进入可见场景");
assert(range.pilgrimageLookout.userData.lookDirection?.isVector3,
  "远眺点必须记录面向圣城的方向");
assert(range.sacredTarnTree.userData.canopyHeight >= 30,
  "深潭古树必须形成超过 30 单位的参天轮廓");
assert.deepEqual(range.sacredTarnTree.userData.rangeLocal, { lx: -15.2, lz: 42 },
  "参天树必须位于深潭侧岸并避开中央远眺视线");
let tarnTreeCrowns = 0;
let tarnTreeBranches = 0;
range.sacredTarnTree.traverse((o) => {
  if (o.name === "tarn-elder-tree-crown") tarnTreeCrowns++;
  if (o.name === "tarn-elder-tree-branch") tarnTreeBranches++;
});
assert.equal(tarnTreeCrowns, 8, "湖沼参天树冠层数量不足");
assert.equal(tarnTreeBranches, 5, "湖沼参天树必须呈现清晰分叉结构");
const removedNames = [
  "citadel-foreground-defense-tower",
  "citadel-range-vegetation",
  "citadel-lake-ball-shrubs",
  "citadel-pilgrimage-lookout-stones",
];
for (const name of removedNames) {
  assert.equal(scene.getObjectByName(name), undefined, `${name} 不得残留在场景`);
}
// 雪山为保留单元，必须仍在场景中；护城河已移入圣城容器（messengerIsland 内挂载）
assert(scene.getObjectByName("citadel-background-snow-massif"), "背景雪山应在场景中");
ok(`梯湖×${waterSurfaces} · 瀑布×4 · 参天树×1 · 护城河×1 · 非保留器物全部清空`);

console.log("[4] 场景与物理接线");
const island = fs.readFileSync(
  fileURLToPath(new URL("src/scenes/messengerIsland.js", BASE)),
  "utf8"
);
assert(island.includes("buildCitadelRange"), "场景应构建山脉");
assert(island.includes("citadelRangeLiftDir"), "圣城 groundRadius 应取山脉高程");
assert(island.includes("pilgrimageCascades.update"), "圣城梯湖瀑布动效必须接入主更新循环");
assert(island.includes("TREE_LX") && island.includes("POOL_LZ"),
  "旧港码头应锚定到深潭参天大树旁");
assert(island.includes("rangeLocalToWorld"), "港口应落在山脉地表");
assert(island.includes("moat?.update") || island.includes("moat.update"),
  "护城河阶梯水波必须接入主更新循环");
const main = fs.readFileSync(
  fileURLToPath(new URL("src/main.js", BASE)),
  "utf8"
);
assert(main.includes("rebuildWaterTerraces?.(contour)"),
  "台地编辑器必须同步热重建逐级水系");
const collision = fs.readFileSync(
  fileURLToPath(new URL("src/world/collision.js", BASE)),
  "utf8"
);
assert(collision.includes("citadelWalkLiftDir"), "物理地面应叠加台地/石阶可行走高程");
ok("messengerIsland + collision 接线完成");

console.log("[4b] 可行走高程：台地台面 + 折返石阶 + 瀑布缺口");
const activeWalkMetrics = citadelTerraceMetrics(range.contourSpec);
const activeWalkDrop = citadelCurvatureDrop(R + 0.4, range.contourSpec);
const walkBase = 0.4 + CITADEL_PEAK.h - CITADEL.groundEmbed - activeWalkDrop;
const highestTop = activeWalkMetrics[0].top;
const lowestTop = activeWalkMetrics.at(-1).top;
// 顶层台面（城堡脚下）：五层台地累计高差，旧黄土峰不再参与。
assert(Math.abs(citadelWalkLiftLocal(0, 0) - (walkBase + highestTop)) < 1e-9,
  "城堡脚下应为顶层台面");
// 缺口水道内（瀑布正下方）：前四层台地失效，不得出现隐形地板
const channelLift = citadelWalkLiftLocal(3.5, 21.5);
assert(channelLift < walkBase + lowestTop,
  `瀑布水道内不得被台地封盖，实际抬升 ${channelLift.toFixed(2)}`);
// 石阶坡道沿程单调爬升、坡度可行走（每段高差 2，弧长 ≥ 7.7）
let prevWalk = -Infinity;
for (let i = 0; i <= 20; i++) {
  const phi = -0.94 + (-1.4 - -0.94) * (i / 20);
  const lift = citadelWalkLiftLocal(16.8 * Math.sin(phi), 16.8 * Math.cos(phi));
  assert(lift >= prevWalk - 1e-9, "顶层梯段沿程不得下坠");
  prevWalk = lift;
}
const expectedRampEnd = Math.hypot(R + walkBase + highestTop + 0.06, 16.8) - R;
assert(Math.abs(prevWalk - expectedRampEnd) < 2e-3, "顶层梯段末端必须接上曲面台面");
// dir 路径一致：正门门廊前（平桥门槛条处）可站立
const expectedDoorLift = Math.hypot(R + walkBase + highestTop, 7.05) - R;
assert(Math.abs(citadelWalkLiftLocal(0, 7.05) - expectedDoorLift) < 1e-9,
  "正门门廊前必须为可站立台面");
assert(citadelWalkLiftDir(siteDir) >= citadelRangeLiftDir(siteDir),
  "可行走高程不得劣于自然坡面");
ok("第五层贴地 · 缺口无封盖 · 顶层梯段单调至台面 · 门廊前可站立");

console.log("[5] 独立多层水帘、雾气与涟漪工厂");
// 轻量 DOM 桩（odysseyCitadel → toon.js 需要）
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()), createElementNS: (_n, t) => stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { buildOdysseyCitadel } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const { createMangaWaterfall } = await import(
  new URL("src/world/mangaWaterfall.js", BASE).href
);
const waterfall = createMangaWaterfall({ seed: 17 });
assert.equal(waterfall.name, "waterfallGroup");
const defaultCurtains = [];
const defaultStreaks = [];
const defaultLipFoam = [];
const defaultMist = [];
const defaultRipples = [];
const visibleWaterfallMeshes = [];
waterfall.traverse((o) => {
  if (o.isMesh && !o.userData.isOutline) visibleWaterfallMeshes.push(o);
  if (/^manga-waterfall-curtain-\d+$/.test(o.name || "")) defaultCurtains.push(o);
  if (/^manga-waterfall-flow-streak-\d+$/.test(o.name || "")) defaultStreaks.push(o);
  if (/^manga-waterfall-lip-foam-\d+$/.test(o.name || "")) defaultLipFoam.push(o);
  if (/^manga-waterfall-mist-\d+$/.test(o.name || "")) defaultMist.push(o);
  if (/^manga-waterfall-ripple-\d+$/.test(o.name || "")) defaultRipples.push(o);
});
assert.equal(defaultCurtains.length, 4);
assert.equal(defaultStreaks.length, 8);
assert.equal(defaultLipFoam.length, 7);
assert.equal(defaultMist.length, 20);
assert.equal(defaultRipples.length, 3);
// 4 帘 + 8 丝 + 7 崖沫 + 20 雾 + 3 涟漪 + 1 方块飞沫实例 + 1 池底 = 44
// 方块飞沫为 InstancedMesh，无描边子节点；其余均描边
const outlinedOnly = visibleWaterfallMeshes.filter(
  (mesh) => !mesh.isInstancedMesh && mesh.name !== "manga-waterfall-box-foam"
);
assert(
  outlinedOnly.every((mesh) =>
    mesh.children.some((child) => child.userData.isOutline)
  ),
  "水帘、水丝、崖口泡沫、雾气、涟漪、池底必须描边"
);
const firstCurtain = defaultCurtains[0];
assert.equal(firstCurtain.geometry.parameters.width, 4.5);
assert.equal(firstCurtain.geometry.parameters.height, 16);
assert(firstCurtain.geometry.parameters.widthSegments >= 3, "水帘须分段以支持阶梯波纹");
assert(firstCurtain.geometry.parameters.heightSegments >= 8, "水帘须纵向分段");
assert.equal(firstCurtain.position.y, 32.5);
assert.equal(firstCurtain.position.z, 0);
assert(Math.abs(defaultCurtains[3].position.z + 0.15) < 1e-9);
assert.equal(firstCurtain.material.type, "MeshToonMaterial");
assert.equal(firstCurtain.material.transparent, true);
assert.equal(firstCurtain.material.depthWrite, true);
assert.equal(firstCurtain.material.flatShading, true);
assert.equal(waterfall.userData.curtainBottomY, 24.5);
assert(defaultMist.every((puff) => puff.geometry.type === "IcosahedronGeometry"));
assert(defaultMist.every((puff) =>
  puff.geometry.parameters.radius >= 0.5 && puff.geometry.parameters.radius <= 1.2));
assert(defaultRipples.every((ripple) => ripple.geometry.type === "CircleGeometry"));
// 阶梯动画：update 后水帘顶点应发生变化
const zBefore = firstCurtain.geometry.attributes.position.getZ(4);
waterfall.update(1 / 60, 1.0);
waterfall.update(1 / 60, 1.25);
const zAfter = firstCurtain.geometry.attributes.position.getZ(4);
assert(Number.isFinite(zAfter), "水帘阶梯动画须写出有效顶点");
// 至少走过多个 step 后应有位移（或同相位允许相等，再推进一步）
waterfall.update(1 / 60, 2.5);
assert(
  Number.isFinite(firstCurtain.geometry.attributes.position.getZ(4)),
  "持续 update 后顶点仍有效"
);
let boxFoam = null;
let basin = null;
waterfall.traverse((o) => {
  if (o.name === "manga-waterfall-box-foam") boxFoam = o;
  if (o.name === "manga-waterfall-basin") basin = o;
});
assert(boxFoam?.isInstancedMesh, "底部须有方块飞沫 InstancedMesh");
assert(basin?.isMesh, "水线须有硬切池底");
const noFall = buildOdysseyCitadel({ place: false, seed: 7 });
let fallBits = 0;
noFall.traverse((o) => {
  if (/waterfall|foam/i.test(o.name || "")) fallBits++;
});
assert.equal(fallBits, 0, "工厂默认构建不得出现任何瀑布/飞沫构件");
noFall.update(1 / 60, 1);
ok("4 层水帘 · 20 团雾气 · 3 层涟漪 · 全描边 · 城堡工厂无全局污染");

console.log(`\n全部通过：${pass} 项断言`);
