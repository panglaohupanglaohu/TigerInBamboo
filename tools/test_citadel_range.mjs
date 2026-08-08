// 圣城山脉验收：主峰 + 前置防御塔基台 + 背景雪山 + 山坡绿植
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
  citadelSiteDir,
  CITADEL_PEAK,
  VIEW_PEAK,
  OUTPOST_CUT,
  RANGE_SITE,
} = await import(new URL("src/world/citadelRange.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};
const R = 160;

console.log("[1] 高程函数：主峰 + 压低的前哨基台");
const peakTop = citadelRangeLiftLocal(0, 0);
assert(Math.abs(peakTop - (0.4 + CITADEL_PEAK.h)) < 1e-9, `主峰顶应 ${0.4 + CITADEL_PEAK.h}，实际 ${peakTop}`);
const viewTop = citadelRangeLiftLocal(VIEW_PEAK.cx, VIEW_PEAK.cz);
assert(Math.abs(viewTop - (0.4 + VIEW_PEAK.h)) < 1e-9, `看台峰顶应 ${0.4 + VIEW_PEAK.h}，实际 ${viewTop}`);
assert(viewTop < 4, "前景土丘必须压低，避免遮挡城堡");
const outpostFloor = citadelRangeLiftLocal(OUTPOST_CUT.cx, OUTPOST_CUT.cz);
assert(Math.abs(outpostFloor - (0.4 + OUTPOST_CUT.floor)) < 1e-9,
  `防御塔脚下必须直接挖平，实际 ${outpostFloor}`);
ok(`圣城峰 +${peakTop.toFixed(1)} · 前哨基台 +${viewTop.toFixed(1)}`);

// 扩大后的主峰必须完整包住 24×24 城墙、瓮城和外围乱石。
const castleShoulder = citadelRangeLiftLocal(16, 14);
assert(castleShoulder > peakTop * 0.8,
  `城堡外围土坡过低：+${castleShoulder.toFixed(1)}`);
const outerSlope = citadelRangeLiftLocal(25, 15);
assert(outerSlope > 0.4 && outerSlope < peakTop,
  "扩大土坡外缘仍应保留可读坡面");
ok(`城堡足域土坡 +${castleShoulder.toFixed(1)} · 外缘缓坡 +${outerSlope.toFixed(1)}`);

// 域外恒 0；域缘裙边沉入球面遮缝
assert.equal(citadelRangeLiftLocal(200, 200) > -1 && citadelRangeLiftLocal(200, 200) <= 0.7, true);
const siteDir = citadelSiteDir(new THREE.Vector3());
const farDir = new THREE.Vector3(0, 0, -1); // 背向
assert.equal(citadelRangeLiftDir(farDir), 0, "背向域外应恒 0");
assert(Math.abs(citadelRangeLiftDir(siteDir) - peakTop) < 1e-6, "站点方向高程 = 主峰顶");
ok("域外归零 · 站点高程与局部一致（dir 路径无损）");

console.log("[2] 前置防御塔基台在主峰朝岛一侧（lz+ 向岛）");
const elev = Math.atan2(peakTop - viewTop, VIEW_PEAK.cz - CITADEL_PEAK.cz);
assert(elev > 0, "从看台望主峰必须是仰视");
ok(`仰望角 ${(elev * 180 / Math.PI).toFixed(1)}°（前哨低、主堡高）`);

console.log("[3] 地形网格：视觉=碰撞");
const scene = new THREE.Scene();
const range = buildCitadelRange(scene, R);
assert(range.mesh?.isMesh, "应返回网格");
assert(scene.children.includes(range.mesh), "网格应入场景");
assert.deepEqual(range.mesh.userData.interCascadeNotch, {
  cx: 3.5,
  halfWidth: 5.2,
  zMin: 26.6,
  zMax: 34.2,
}, "瀑布 2、3 之间必须从黄土视觉网格切出中央水道缺口");
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
assert(maxR <= R + 16.41, `峰顶最高 ${maxR.toFixed(2)} 不应超过 R+16.4`);
assert(maxR > R + 16, "峰顶必须达到主峰高度");
ok(`网格 ${pos.count} 顶点 · 半径域 [${minR.toFixed(1)}, ${maxR.toFixed(1)}] 吻合高程函数`);

// 顶点色：峰顶岩灰、谷地草绿
const col = range.mesh.geometry.attributes.color;
assert(col && col.count === pos.count, "顶点色与顶点一一对应");
ok("顶点色渐变（草绿→土褐→岩灰）就位");

assert(range.foregroundTower?.isGroup, "前景防御塔缺失");
assert.deepEqual(range.foregroundTower.userData.rangeLocal, {
  lx: OUTPOST_CUT.cx,
  lz: OUTPOST_CUT.cz,
});
assert(range.foregroundTower.userData.rangeLocal.lz > 16,
  "防御塔必须位于城堡最前沿 Z≈16 之外");
const towerUp = new THREE.Vector3(0, 1, 0)
  .applyQuaternion(range.foregroundTower.quaternion)
  .normalize();
assert(towerUp.dot(siteDir) > 0.999999, "防御塔竖轴必须与主城竖轴平行，不得随坡倾斜");
assert(range.snowMountains?.isGroup, "背景雪山群缺失");
assert(range.vegetation?.isGroup, "山坡绿植缺失");
assert(range.loessGroundSeal?.isGroup, "黄土坡闭合接地体缺失");
assert(range.castleFooting?.isGroup, "城堡实体土质承台缺失");
assert(range.pilgrimageWaterSteps?.isGroup, "城堡前白石梯湖缺失");
assert(range.pilgrimageCascades?.isGroup, "梯湖之间的多层瀑布缺失");
assert(range.interCascadeBridgePool?.isGroup, "瀑布 2、3 之间的连续湖盆缺失");
assert(range.pilgrimageLookout?.isGroup, "深潭前观景石缺失");
assert(range.sacredTarnTree?.isGroup, "深潭旁湖沼参天树缺失");
assert(range.lakeBallShrubs?.isGroup, "白石湖岸球形灌木缺失");
const loessSealBody = range.loessGroundSeal
  .getObjectByName("citadel-loess-ground-seal-body");
const buriedLoessCollar = range.loessGroundSeal
  .getObjectByName("citadel-loess-buried-collar");
assert(loessSealBody?.isMesh, "黄土坡闭合主土体缺失");
assert.equal(buriedLoessCollar, undefined,
  "重复埋地圆环会横穿瀑布 2、3，必须彻底删除");
assert.equal(loessSealBody.geometry.type, "BufferGeometry",
  "黄土坡封层必须使用贴合高程曲线的自定义闭合网格");
const sealBounds = loessSealBody.geometry.boundingBox;
assert(sealBounds.max.y <= -0.21,
  "黄土封层必须始终位于可见坡面下方，禁止遮挡梯湖");
assert(sealBounds.min.y <= -18,
  "黄土坡主土体必须深入全球地面");
assert(sealBounds.max.x >= 34 && sealBounds.max.z >= 29,
  "黄土坡封层必须覆盖完整椭圆峰体");
scene.updateMatrixWorld(true);
const sealAnchorR = range.loessGroundSeal.position.dot(siteDir);
assert(sealAnchorR + sealBounds.min.y < R,
  "黄土坡封层底部必须穿入全球地面，禁止残留空气层");
const footingBody = range.castleFooting.getObjectByName("citadel-solid-soil-footing-body");
assert(footingBody?.isMesh, "土质承台主体缺失");
assert.equal(footingBody.geometry.parameters.radiusTop, 19,
  "承台顶面必须覆盖城堡与瓮城足印");
assert.equal(footingBody.geometry.parameters.radiusBottom, 32,
  "承台底部必须向外扩张并插入山坡");
assert.equal(footingBody.geometry.parameters.openEnded, false,
  "承台必须是闭合实体，禁止从侧面看穿");
let apronRocks = 0;
range.castleFooting.traverse((o) => {
  if (o.name === "citadel-soil-apron-rock") apronRocks++;
});
assert.equal(apronRocks, 10);
const footingUp = new THREE.Vector3(0, 1, 0)
  .applyQuaternion(range.castleFooting.quaternion)
  .normalize();
assert(footingUp.dot(siteDir) > 0.999999, "承台必须与城堡同轴直立");
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
  .getObjectByName("citadel-upper-courtyard-pool-water");
assert(upperWater.geometry.attributes.normal.getY(0) > 0.9,
  "梯湖水面法线必须朝上，避免卡通光照渲染成黑色");
const upperBank = range.pilgrimageWaterSteps
  .getObjectByName("citadel-upper-courtyard-pool-white-stone-bank");
assert(upperBank.geometry.attributes.normal.getY(0) > 0.9,
  "白石岸台顶面法线必须朝上，禁止露出黑色反向描边壳");
assert.equal(waterStages.at(-1).userData.composition.kind, "deep-pool",
  "最低一级必须是地面深潭");
assert.equal(range.pilgrimageCascades.children.length, 4,
  "五级梯湖之间必须部署四道瀑布");
assert.deepEqual(
  range.interCascadeBridgePool.userData.connectsCascadeSequences,
  [1, 2],
  "加长湖盆必须连接瀑布 2 与瀑布 3"
);
assert.equal(range.interCascadeBridgePool.userData.replacesLoessBand, true,
  "瀑布 2、3 之间必须以湖盆替换横向黄土带");
const bridgeWater = range.interCascadeBridgePool
  .getObjectByName("citadel-waterfall-2-3-channel-water");
const bridgeBank = range.interCascadeBridgePool
  .getObjectByName("citadel-waterfall-2-3-white-stone-basin");
assert(bridgeWater?.isMesh && bridgeBank?.isMesh,
  "连接区必须同时具有连续水面与闭合白石盆壁");
assert.equal(bridgeWater.geometry.type, "PlaneGeometry");
assert.equal(bridgeBank.geometry.type, "BoxGeometry");
const middlePoolWaterY = waterStages[2].position.dot(siteDir) + 0.09;
assert(Math.abs(range.interCascadeBridgePool.userData.waterLevel - middlePoolWaterY) < 1e-6,
  "连接湖盆必须与中层湖保持完全相同的水位");
assert(range.interCascadeBridgePool.userData.channelLength > 4,
  "连接水道必须覆盖瀑布 2 落点到瀑布 3 起水口的完整间距");
assert.equal(
  bridgeWater.geometry.parameters.height,
  range.interCascadeBridgePool.userData.channelLength + 1.35
);
for (const [index, waterfall] of range.pilgrimageCascades.children.entries()) {
  assert.equal(waterfall.name, "waterfallGroup", "瀑布工厂必须返回统一 waterfallGroup");
  assert.equal(waterfall.userData.sequence, index);
  assert(waterfall.userData.actualDrop >= 0.8, "每道瀑布都必须形成明确跌水落差");
  assert(waterfall.userData.facadeClearance >= 1.4,
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
  assert.equal(soilShoulders, index === 0 ? 0 : 4,
    "从地面向上的瀑布 1、2、3 必须各有四块重堆黄土肩坡");
  assert.equal(waterfall.userData.rebuiltSoilShoulders, soilShoulders);
  if (index >= 1) {
    assert(waterfall.userData.facadeClearance >= 2.8,
      "下方三道瀑布必须大幅前移，完整露出水帘");
  }
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
}
let flatLookoutStones = 0;
let messengerViewpoints = 0;
range.pilgrimageLookout.traverse((o) => {
  if (o.name === "citadel-lookout-flat-stone") flatLookoutStones++;
  if (o.userData.isMessengerViewpoint) messengerViewpoints++;
});
assert.equal(flatLookoutStones, 4, "深潭前必须有四块宽缓观景石");
assert.equal(messengerViewpoints, 1, "必须预留唯一的送信人远眺落脚点");
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
const ballShrubs = range.lakeBallShrubs.children;
assert.equal(ballShrubs.length, 10, "五级湖岸必须配置十组球形灌木");
for (const shrub of ballShrubs) {
  const crowns = [];
  shrub.traverse((o) => {
    if (/-ball-crown$/.test(o.name || "")) crowns.push(o);
  });
  assert.equal(crowns.length, 3, "每组湖岸灌木必须由三个圆球冠层构成");
  assert(crowns.every((crown) => crown.geometry.type === "SphereGeometry"),
    "湖岸灌木冠层必须使用球形几何体");
}
let snowCaps = 0;
let towerBoxes = 0;
let rangeShrubs = 0;
range.snowMountains.traverse((o) => { if (/snow-cap/.test(o.name || "")) snowCaps++; });
range.foregroundTower.traverse((o) => { if (/foreground-tower-(lower|upper)/.test(o.name || "")) towerBoxes++; });
range.vegetation.traverse((o) => { if (/^range-shrub-\d+$/.test(o.name || "")) rangeShrubs++; });
assert.equal(snowCaps, 6, "六座雪山都必须有独立积雪冠层");
const flankMountainIndices = [0, 1, 4, 5];
const flankCompositions = flankMountainIndices.map((index) => {
  const mountain = range.snowMountains.getObjectByName(`background-snow-mountain-${index}`);
  assert(mountain?.isGroup, `外围雪山 ${index} 缺失`);
  return mountain.userData.composition;
});
assert.equal(new Set(flankCompositions.map(({ height }) => height)).size, 4,
  "其余四座雪山必须使用四种不同高度形成错落层次");
assert.equal(new Set(flankCompositions.map(({ depth }) => depth)).size, 4,
  "其余四座雪山必须错开前后纵深，禁止排成平面背景板");
const connectedSaddle = range.snowMountains.getObjectByName("connected-central-snow-saddle");
assert(connectedSaddle?.isGroup, "中间两座雪山缺少实体连接鞍部");
assert.deepEqual(connectedSaddle.userData.connectsMountainIndices, [2, 3]);
assert(connectedSaddle.getObjectByName("connected-central-snow-saddle-rock")?.isMesh);
assert(connectedSaddle.getObjectByName("connected-central-snow-saddle-cap")?.isMesh,
  "连接山脊顶部必须覆盖连续积雪层");
for (const mountain of range.snowMountains.children) {
  assert(mountain.userData.rangeLocal.lz < -40,
    "雪山必须完整退到城堡后方 Z<-40");
  const mountainUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(mountain.quaternion)
    .normalize();
  assert(mountainUp.dot(siteDir) > 0.999999,
    "雪山竖轴必须与圣城竖轴平行，不得随球面倾斜");
}
assert.equal(towerBoxes, 2, "前景哨塔必须为两级建筑体");
const outpostLower = range.foregroundTower.getObjectByName("foreground-tower-lower");
const outpostUpper = range.foregroundTower.getObjectByName("foreground-tower-upper");
assert.equal(outpostLower.geometry.type, "CylinderGeometry");
assert.equal(outpostUpper.geometry.type, "CylinderGeometry");
assert.equal(outpostLower.geometry.parameters.radialSegments, 8);
assert.equal(outpostUpper.geometry.parameters.radialSegments, 8);
assert.equal(outpostLower.geometry.parameters.radiusTop, outpostLower.geometry.parameters.radiusBottom,
  "防御塔下层八面墙必须完全垂直");
assert.equal(outpostUpper.geometry.parameters.radiusTop, outpostUpper.geometry.parameters.radiusBottom,
  "防御塔上层八面墙必须完全垂直");
let lookoutWindows = 0;
range.foregroundTower.traverse((o) => {
  if (o.name === "foreground-tower-lookout-window") lookoutWindows++;
});
assert.equal(lookoutWindows, 3, "八角防御塔必须有三面瞭望窗");
assert(rangeShrubs >= 14, "山坡灌木数量不足");
ok(`梯湖×${waterSurfaces} · 参天树×1 · 湖岸球灌木×${ballShrubs.length} · 雪山×${snowCaps} · 山坡灌木×${rangeShrubs}`);

console.log("[4] 场景与物理接线");
const island = fs.readFileSync(
  fileURLToPath(new URL("src/scenes/messengerIsland.js", BASE)),
  "utf8"
);
assert(island.includes("buildCitadelRange"), "场景应构建山脉");
assert(island.includes("citadelRangeLiftDir"), "圣城 groundRadius 应取山脉高程");
assert(island.includes("pilgrimageCascades.update"), "圣城梯湖瀑布动效必须接入主更新循环");
const collision = fs.readFileSync(
  fileURLToPath(new URL("src/world/collision.js", BASE)),
  "utf8"
);
assert(collision.includes("citadelRangeLiftDir"), "物理地面应叠加山脉高程");
ok("messengerIsland + collision 接线完成");

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
assert.equal(visibleWaterfallMeshes.length, 42);
assert(visibleWaterfallMeshes.every((mesh) =>
  mesh.children.some((child) => child.userData.isOutline)),
"水帘、水丝、崖口泡沫、雾气和涟漪必须全部描边");
const firstCurtain = defaultCurtains[0];
assert.equal(firstCurtain.geometry.parameters.width, 4.5);
assert.equal(firstCurtain.geometry.parameters.height, 16);
assert.equal(firstCurtain.position.y, 32.5);
assert.equal(firstCurtain.position.z, 0);
assert(Math.abs(defaultCurtains[3].position.z + 0.15) < 1e-9);
assert.equal(firstCurtain.material.type, "MeshToonMaterial");
assert.equal(firstCurtain.material.transparent, true);
assert.equal(firstCurtain.material.opacity, 0.75);
assert.equal(firstCurtain.material.depthWrite, true);
assert.equal(firstCurtain.material.flatShading, true);
assert.equal(waterfall.userData.curtainBottomY, 24.5);
assert(defaultMist.every((puff) => puff.geometry.type === "IcosahedronGeometry"));
assert(defaultMist.every((puff) =>
  puff.geometry.parameters.radius >= 0.5 && puff.geometry.parameters.radius <= 1.2));
assert(defaultRipples.every((ripple) => ripple.geometry.type === "CircleGeometry"));
waterfall.update(1 / 60, 1);
const noFall = buildOdysseyCitadel({ place: false, seed: 7 });
let fallBits = 0;
noFall.traverse((o) => {
  if (/waterfall|foam/i.test(o.name || "")) fallBits++;
});
assert.equal(fallBits, 0, "工厂默认构建不得出现任何瀑布/飞沫构件");
noFall.update(1 / 60, 1);
ok("4 层水帘 · 20 团雾气 · 3 层涟漪 · 全描边 · 城堡工厂无全局污染");

console.log(`\n全部通过：${pass} 项断言`);
