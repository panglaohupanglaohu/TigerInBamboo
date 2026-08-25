// FlockManager（TigerMessenger Boids 鸟群）无头仿真验证：
// 三大定律 + 高度带锁（35–45）+ 晶塔避障 + 永不穿模 + 相位差扑翅
//
// 运行：node tools/test_flock_boids.mjs
// 说明：src 内为浏览器裸 "three" 导入；本脚本自动在 TigerMessenger/node_modules/
//       下搭一个指向 vendor/ 的解析桥（node_modules 已 gitignore，可随时删除重建）。
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify(
      {
        name: "three",
        version: "0.172.0-local-bridge",
        type: "module",
        main: "../../vendor/three.module.js",
      },
      null,
      2
    )
  );
  console.log("[bootstrap] 已创建 three → vendor 解析桥");
}

// 无头 DOM 桩：equatorialClouds → audio/sfx.js → ui/hud.js 链在模块顶层
// 访问 document/window/localStorage（浏览器全局），Node 下需先打桩再动态 import。
// 与 tools/test_bubble_pod_cannon_bgm.mjs 的既有惯例一致；不改变任何被测逻辑。
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  setAttribute() {},
  addEventListener() {},
});
globalThis.document = {
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  createElement: () => stubEl(),
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
// sfxThunder 风暴期经 window.setTimeout → new Audio()：风暴期落雷路径兜底
globalThis.Audio = class {
  constructor() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
};

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { FlockManager } = await import("../TigerMessenger/src/world/flock.js");
const { AirshipEscortManager } = await import("../TigerMessenger/src/world/airshipEscort.js");
const {
  createDynamicMoebiusClouds,
  updateDynamicMoebiusClouds,
} = await import("../TigerMessenger/src/world/equatorialClouds.js");
const { latLonToDir } = await import("../TigerMessenger/src/world/sphereMath.js");

const R = 40;
const scene = new THREE.Scene();
const canyonDir = latLonToDir(-50, -112, new THREE.Vector3());

// 仿莫比斯塔柱：中心一根高塔 + 两根侧塔（对应 crystals 记录形状）
const grandDir = latLonToDir(-24, -112, new THREE.Vector3());
const sideA = latLonToDir(-38, -100, new THREE.Vector3());
const sideB = latLonToDir(-42, -124, new THREE.Vector3());
const obstacles = [
  { dir: grandDir, root: R, h: 87, r: 6.9 },
  { dir: sideA, root: R, h: 30, r: 3.0 },
  { dir: sideB, root: R, h: 30, r: 3.0 },
];

const flock = new FlockManager(scene, {
  count: 18,
  planetRadius: R,
  centerDir: canyonDir,
  windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), canyonDir).normalize(),
  obstacles,
});

const dt = 1 / 60;
let t = 0;
let minR = Infinity, maxR = -Infinity;
let minPair = Infinity;
let minSp = Infinity, maxSp = -Infinity;
let spreadMax = 0;
let flapLeftSeen = false, flapRightSeen = false;

for (let frame = 0; frame < 1200; frame++) {
  flock.update(dt, t);
  t += dt;
  if (frame < 30) continue; // 跳过出生松弛期

  const centroid = new THREE.Vector3();
  for (const b of flock.birds) centroid.add(b.group.position);
  centroid.divideScalar(flock.birds.length);
  let spread = 0;
  for (const b of flock.birds) {
    const r = b.group.position.length();
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    const sp = b.vel.length();
    minSp = Math.min(minSp, sp);
    maxSp = Math.max(maxSp, sp);
    spread = Math.max(spread, b.group.position.distanceTo(centroid));
    if (b.wingL.rotation.z > 0.3) flapLeftSeen = true;
    if (b.wingR.rotation.z < -0.3) flapRightSeen = true;
  }
  spreadMax = Math.max(spreadMax, spread);
  for (let i = 0; i < flock.birds.length; i++) {
    for (let j = i + 1; j < flock.birds.length; j++) {
      const d = flock.birds[i].group.position.distanceTo(flock.birds[j].group.position);
      minPair = Math.min(minPair, d);
    }
  }
}

// 相位差抽查：同时刻各鸟翼角不应雷同
let phaseSpreadOk = true;
{
  const angles = flock.birds.map((b) => b.wingL.rotation.z);
  const uniq = new Set(angles.map((a) => a.toFixed(4)));
  phaseSpreadOk = uniq.size > flock.birds.length * 0.8;
}

// 避障终态：没有鸟停在塔柱有效半径内
let insideObstacle = 0;
for (const b of flock.birds) {
  for (const o of obstacles) {
    const effR = o.r * 0.6;
    const a = o.dir.clone().multiplyScalar(o.root);
    const rel = b.group.position.clone().sub(a);
    const tAlong = THREE.MathUtils.clamp(rel.dot(o.dir), 0, o.h);
    const closest = o.dir.clone().multiplyScalar(o.root + tAlong);
    if (b.group.position.distanceTo(closest) < effR) insideObstacle++;
  }
}

const bandLo = R + 35, bandHi = R + 45;
const results = [
  ["[峡谷] 高度带约束", minR >= bandLo - 1.3 && maxR <= bandHi + 1.3, `r∈[${minR.toFixed(2)}, ${maxR.toFixed(2)}]（带 ${bandLo}–${bandHi}）`],
  ["[峡谷] 永不穿模（最小间距≥0.7）", minPair >= 0.7, `minPair=${minPair.toFixed(3)}`],
  ["[峡谷] 速度不失速不超速", minSp >= 2.5 && maxSp <= 6.4 * 1.16 + 0.01, `v∈[${minSp.toFixed(2)}, ${maxSp.toFixed(2)}]`],
  ["[峡谷] 抱团（群体展幅有界）", spreadMax < 30, `maxSpread=${spreadMax.toFixed(2)}`],
  ["[峡谷] 双翼反向扑打", flapLeftSeen && flapRightSeen, "左>0.3 / 右<-0.3 均出现"],
  ["[峡谷] 随机相位差", phaseSpreadOk, "同时刻翼角互不相同"],
  ["[峡谷] 晶塔避障（终态无侵入）", insideObstacle === 0, `inside=${insideObstacle}`],
];

// ---------------------------------------------------------------------------
//  第二阶段：AirshipEscortManager（异星滑翔长翼鸟 · 航空艇伴飞）
// ---------------------------------------------------------------------------
console.log("--- AirshipEscortManager ---");

const ship = new THREE.Group(); // 模拟莫比斯航空艇
ship.position.copy(latLonToDir(-35, -105, new THREE.Vector3()).multiplyScalar(R + 20));
scene.add(ship);

const escort = new AirshipEscortManager(scene, ship, { count: 9, obstacles });

let eDistMin = Infinity, eDistMax = -Infinity;
let eHullMin = Infinity; // 与飞艇最小距离（防撞气囊）
let eVertMax = 0; // 圆柱分布：垂直偏移
let ePairMin = Infinity;
let behindSum = 0, behindN = 0; // 尾随性：offset·trailDir
let innerSeen = false, outerSeen = false;
let tt = 0;
const eTrail = new THREE.Vector3();

for (let frame = 0; frame < 1800; frame++) {
  tt += dt;
  // 前 7 秒悬停（稳态结界检查），随后切向巡航 3.5u/s，
  // 并一路爬升到新升限 R+90（越过晶皇塔尖），验证护航队高空跟飞
  if (tt > 7) {
    const rTarget = Math.min(ship.position.length() + 4.0 * dt, R + 90);
    const upS = ship.position.clone().normalize();
    const tang = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), upS).normalize();
    ship.position.addScaledVector(tang, 3.5 * dt).normalize().multiplyScalar(rTarget);
  }
  escort.update(dt, tt);
  if (frame < 90) continue; // 出生松弛期

  const upS = ship.position.clone().normalize();
  for (const b of escort.birds) {
    const off = b.group.position.clone().sub(ship.position);
    const d = off.length();
    eDistMin = Math.min(eDistMin, d);
    eDistMax = Math.max(eDistMax, d);
    eHullMin = Math.min(eHullMin, d);
    eVertMax = Math.max(eVertMax, Math.abs(off.dot(upS)));
  }
  // 尾随性（仅巡航段统计）
  if (tt > 9) {
    const velDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), ship.position.clone().normalize()).normalize();
    eTrail.copy(velDir).negate();
    let s = 0;
    for (const b of escort.birds) {
      s += b.group.position.clone().sub(ship.position).dot(eTrail);
    }
    behindSum += s / escort.birds.length;
    behindN++;
  }
  for (let i = 0; i < escort.birds.length; i++) {
    for (let j = i + 1; j < escort.birds.length; j++) {
      ePairMin = Math.min(
        ePairMin,
        escort.birds[i].group.position.distanceTo(escort.birds[j].group.position)
      );
    }
  }
  for (const b of escort.birds) {
    if (Math.abs(b.innerL.rotation.z) > 0.2) innerSeen = true;
    if (Math.abs(b.outerL.rotation.z) > 0.3) outerSeen = true;
  }
}

// 相位差抽查
let ePhaseOk = true;
{
  const angles = escort.birds.map((b) => b.innerL.rotation.z);
  const uniq = new Set(angles.map((a) => a.toFixed(4)));
  ePhaseOk = uniq.size > escort.birds.length * 0.7;
}

// 避障终态
let eInside = 0;
for (const b of escort.birds) {
  for (const o of obstacles) {
    const effR = o.r * 0.6;
    const a = o.dir.clone().multiplyScalar(o.root);
    const rel = b.group.position.clone().sub(a);
    const tAlong = THREE.MathUtils.clamp(rel.dot(o.dir), 0, o.h);
    const closest = o.dir.clone().multiplyScalar(o.root + tAlong);
    if (b.group.position.distanceTo(closest) < effR) eInside++;
  }
}

results.push(
  ["[护航] 结界下限（防撞气囊 ≥4.5）", eHullMin >= 4.5, `minDist=${eHullMin.toFixed(2)}`],
  ["[护航] 环形结界稳态（主体 6–15）", eDistMax <= 15 + 2.5 && eDistMin >= 6 - 2.5, `d∈[${eDistMin.toFixed(2)}, ${eDistMax.toFixed(2)}]`],
  ["[护航] 圆柱分布（垂直偏移有界）", eVertMax <= 7.5, `maxVert=${eVertMax.toFixed(2)}`],
  ["[护航] 长翼不交叠（间距≥1.0）", ePairMin >= 1.0, `minPair=${ePairMin.toFixed(3)}`],
  ["[护航] 尾随飞艇后方（均值>0）", behindN > 0 && behindSum / behindN > 0, `avgBehind=${(behindSum / Math.max(behindN, 1)).toFixed(2)}`],
  ["[护航] 内外翼两级扑打", innerSeen && outerSeen, "内>0.2 / 外>0.3 均出现"],
  ["[护航] 随机相位差", ePhaseOk, "同时刻内翼角互不相同"],
  ["[护航] 晶塔避障（终态无侵入）", eInside === 0, `inside=${eInside}`]
);

// ---------------------------------------------------------------------------
//  第三阶段：花厅楼顶鸟群（母皇塔尖环绕 · 小空域 homeRadius）
// ---------------------------------------------------------------------------
console.log("--- 花厅楼顶鸟群 ---");

const towerDir = latLonToDir(-24, -112, new THREE.Vector3());
const towerRoot = R - 6.43; // 峡谷第三级台阶（与真实晶皇塔根基一致）
const towerH = 87.15;
const hallObstacles = [{ dir: towerDir, root: towerRoot, h: towerH, r: 6.9 }];
const roofAlt = towerRoot + towerH - R; // 花厅楼顶海拔 ≈ 80.7

const hallFlock = new FlockManager(scene, {
  count: 12,
  planetRadius: R,
  centerDir: towerDir,
  altMin: roofAlt - 2,
  altMax: roofAlt + 18,
  homeRadius: 12,
  windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), towerDir).normalize(),
  obstacles: hallObstacles,
});

const hallHome = towerDir.clone().multiplyScalar(R + roofAlt + 8); // 塔尖上空 8 = 家域中心
let hDistMax = 0, hPairMin = Infinity, hRMin = Infinity, hRMax = -Infinity;
let t3 = 0;
for (let frame = 0; frame < 900; frame++) {
  t3 += dt;
  hallFlock.update(dt, t3);
  if (frame < 60) continue;
  for (const b of hallFlock.birds) {
    hDistMax = Math.max(hDistMax, b.group.position.distanceTo(hallHome));
    const r = b.group.position.length();
    hRMin = Math.min(hRMin, r);
    hRMax = Math.max(hRMax, r);
  }
  for (let i = 0; i < hallFlock.birds.length; i++) {
    for (let j = i + 1; j < hallFlock.birds.length; j++) {
      hPairMin = Math.min(
        hPairMin,
        hallFlock.birds[i].group.position.distanceTo(hallFlock.birds[j].group.position)
      );
    }
  }
}
let hInside = 0;
for (const b of hallFlock.birds) {
  for (const o of hallObstacles) {
    const effR = o.r * 0.6;
    const a = o.dir.clone().multiplyScalar(o.root);
    const rel = b.group.position.clone().sub(a);
    const tAlong = THREE.MathUtils.clamp(rel.dot(o.dir), 0, o.h);
    const closest = o.dir.clone().multiplyScalar(o.root + tAlong);
    if (b.group.position.distanceTo(closest) < effR) hInside++;
  }
}

results.push(
  ["[花厅] 家域紧收（距家≤22）", hDistMax <= 22, `maxHomeDist=${hDistMax.toFixed(2)}`],
  ["[花厅] 楼顶高度带", hRMin >= R + roofAlt - 2 - 1.3 && hRMax <= R + roofAlt + 18 + 1.3, `r∈[${hRMin.toFixed(2)}, ${hRMax.toFixed(2)}]（楼顶 ${ (R + roofAlt).toFixed(1) }）`],
  ["[花厅] 永不穿模（间距≥0.7）", hPairMin >= 0.7, `minPair=${hPairMin.toFixed(3)}`],
  ["[花厅] 晶塔避障（终态无侵入）", hInside === 0, `inside=${hInside}`]
);

// ---------------------------------------------------------------------------
//  第四阶段：城头六组穿行云线 · megaCloudWall（合并几何 / 滚筒涌动 / 天气循环）
//  注：equatorialClouds 已重写（66a1a03）——旧「赤道 24 塔 + 逐球形变 + 龙卷风」
//  行为被刻意替换为「城头单锚 6 组云线 + 整簇运动 + 无龙卷风」，断言随之对齐新契约。
// ---------------------------------------------------------------------------
console.log("--- 城头六组穿行云线 ---");

const cloudScene = new THREE.Scene();
const wall = createDynamicMoebiusClouds(cloudScene, R);
const mockSun = {
  position: new THREE.Vector3(20, 28, 16),
  intensity: 1.6,
  color: new THREE.Color(0xfff1c9),
};
const towers = wall.userData.towers;
const allBlobs = wall.userData.blobs; // = clusters（每簇多 puff 合并成单 Mesh）
const lineGroups = new Set(allBlobs.map((b) => b.userData.lineGroup));
const allOutlined = allBlobs.every((b) =>
  b.children.some((c) => c.userData?.isOutline)
);
const matsOk = allBlobs.every(
  (b) =>
    b.material.isMeshToonMaterial &&
    b.material.gradientMap?.image?.width === 3
);
// 合并索引网格：每簇 9–14 颗 puff（Icosahedron detail 3），合并后仍索引共享
const PUFF_VERTS = new THREE.IcosahedronGeometry(1, 3).attributes.position.count;
const puffCounts = allBlobs.map(
  (b) => b.geometry.attributes.position.count / PUFF_VERTS
);
const mergedOk = allBlobs.every(
  (b, i) =>
    b.geometry.index !== null && Number.isInteger(puffCounts[i])
);
// 整簇运动：滚筒翻滚 + 传送带穿行 + 微呼吸（不碰顶点拓扑）
updateDynamicMoebiusClouds(wall, 0.5, mockSun);
const snapPos = allBlobs.map((b) => b.position.x);
const snapRot = allBlobs.map((b) => b.rotation.x);
updateDynamicMoebiusClouds(wall, 0.9, mockSun);
let paradeOk = true;
let rollOk = true;
let loopBoundOk = true;
let breathBounded = true;
for (let bi = 0; bi < allBlobs.length; bi++) {
  const b = allBlobs[bi];
  if (Math.abs(b.position.x - snapPos[bi]) < 1e-4) paradeOk = false;
  if (Math.abs(b.rotation.x - snapRot[bi]) < 1e-4) rollOk = false;
  const xMin = b.userData.paradeMin;
  const span = b.userData.paradeSpan;
  if (!(b.position.x >= xMin - 1e-6 && b.position.x <= xMin + span + 1e-6)) {
    loopBoundOk = false;
  }
  const s = b.userData.stretch;
  const k = s ? b.scale.x / s.x : b.scale.x;
  if (k < 0.94 || k > 1.06) breathBounded = false;
}
// 云底雨带：嵌套 LineSegments，随时间倾泻（位置变化）
const rain = wall.userData.rain;
const rainOk =
  !!rain &&
  rain.isLineSegments &&
  rain.geometry.attributes.position.count === 1100 * 2;
const rainArr0 = rain ? rain.geometry.attributes.position.array.slice() : null;
updateDynamicMoebiusClouds(wall, 1.7, mockSun);
let rainMoved = false;
if (rainArr0 && rain) {
  const arr = rain.geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i++) {
    if (Math.abs(arr[i] - rainArr0[i]) > 1e-4) {
      rainMoved = true;
      break;
    }
  }
}
// 闪电频闪状态机 + 天气相位机存在
const stormStateOk =
  !!wall.userData.storm &&
  typeof wall.userData.storm.next === "number" &&
  wall.userData.weather?.phase === "clear";

// ---- 天气循环 + 龙卷风已关闭 ----
// 续跑 50s：晴朗必在 19–29s 内转入聚云（dark 上升）；全程不得出现龙卷风
let weatherLeftClear = false;
let darkMax = 0;
let torMaxActive = 0;
let torT = 1.7; // 接前面已推进到的时刻
for (let f = 0; f < 1500; f++) {
  torT += 1 / 30;
  updateDynamicMoebiusClouds(wall, torT, mockSun);
  const w = wall.userData.weather;
  if (w.phase !== "clear") weatherLeftClear = true;
  darkMax = Math.max(darkMax, w.dark);
  torMaxActive = Math.max(torMaxActive, wall.userData.tornadoes.length);
}

results.push(
  ["[云线] 挂载全局场景（equatorialClouds）", wall.name === "equatorialClouds" && cloudScene.children.includes(wall) && !!wall.userData.megaCloudWall, `name=${wall.name}`],
  ["[云线] 城头单锚点（cloud-crown-line）", towers.length === 1 && towers[0].name === "cloud-crown-line" && towers[0].position.length() > R, `towers=${towers.length} r=${towers[0]?.position.length().toFixed(1)}`],
  ["[云线] 6 组 × 12 簇穿行云线", allBlobs.length === 72 && lineGroups.size === 6, `clusters=${allBlobs.length} groups=${lineGroups.size}`],
  ["[云线] 每簇 9–14 puff 合并", puffCounts.every((c) => c >= 9 && c <= 14), `puffs∈[${Math.min(...puffCounts)}, ${Math.max(...puffCounts)}]`],
  ["[云线] 合并索引网格", mergedOk, `${allBlobs.length} 簇全部索引化`],
  ["[云线] 全网格 addOutline 墨线", allOutlined, `${allBlobs.length} 簇全部带描边`],
  ["[云线] Toon 材质 + 3 阶 gradientMap", matsOk, "材质规格一致"],
  ["[云线] 传送带穿行逐簇生效", paradeOk, "帧间 position.x 全簇变化"],
  ["[云线] 穿行位置约束在环路内", loopBoundOk, "x ∈ [xMin, xMin+span]"],
  ["[云线] 滚筒翻滚逐簇生效", rollOk, "帧间 rotation.x 全簇变化"],
  ["[云线] 呼吸幅度有界", breathBounded, "scale k ∈ [0.94, 1.06]"],
  ["[云线] 云底嵌套雨带（1100 丝）", rainOk, "LineSegments × 1100"],
  ["[云线] 雨带随时间倾泻", rainMoved, "位置帧间变化"],
  ["[云线] 闪电频闪 + 天气相位机", stormStateOk, "storm.next 已调度 · 起始晴朗"],
  ["[云线] 50s 内晴朗转入聚云（dark 上升）", weatherLeftClear && darkMax > 0.3, `phase=${wall.userData.weather.phase} darkMax=${darkMax.toFixed(2)}`],
  ["[云线] 龙卷风已关闭（全程 0 个）", torMaxActive === 0, `max=${torMaxActive}`]
);

// ---------------------------------------------------------------------------
//  第五阶段：厚涂苔丘草地（地形起伏 / 苔藓堆叠 / 描边 / 安全距离）
// ---------------------------------------------------------------------------
console.log("--- 厚涂苔丘草地 ---");

const { buildImpastoMossyGround } = await import(
  "../TigerMessenger/src/world/mossyGround.js"
);
const mossObstaclePos = new THREE.Vector3(5, R, 0);
const moss = buildImpastoMossyGround({
  dir: new THREE.Vector3(0, 1, 0), // 北极：局部系 = 世界系平移，便于断言
  planetRadius: R,
  seed: 4242,
  avoidWorld: [{ position: mossObstaclePos, radius: 2 }],
});
moss.updateWorldMatrix(true, true);
const mossBlobs = moss.children.filter((c) => c.userData?.isMoss);
const terrainMesh = moss.children.find((c) => c.name === "mossy-terrain");
let mossYMin = Infinity;
let mossYMax = -Infinity;
{
  const tp = terrainMesh.geometry.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    mossYMin = Math.min(mossYMin, tp.getY(i));
    mossYMax = Math.max(mossYMax, tp.getY(i));
  }
}
const mossOutlined = mossBlobs.every((b) =>
  b.children.some((c) => c.userData?.isOutline)
);
const mossMatsOk = mossBlobs.every(
  (b) => b.material.isMeshToonMaterial && b.material.flatShading === true
);
// 安全距离：苔藓块世界坐标与障碍体 ≥ r + minDistance(4)
let mossAvoidOk = true;
const _mp = new THREE.Vector3();
for (const b of mossBlobs) {
  b.getWorldPosition(_mp);
  if (_mp.distanceTo(mossObstaclePos) < 2 + 4 - 0.05) {
    mossAvoidOk = false;
    break;
  }
}

results.push(
  ["[苔丘] 组名 mossyGround", moss.name === "mossyGround", `name=${moss.name}`],
  ["[苔丘] 苔藓块 80–100 颗", moss.userData.mossCount >= 80 && moss.userData.mossCount <= 100 && mossBlobs.length === moss.userData.mossCount, `count=${moss.userData.mossCount}`],
  ["[苔丘] 地形隆起 2–4.6 且贴球弯曲", mossYMax >= 2 && mossYMax <= 5 && mossYMin <= -1.5, `y∈[${mossYMin.toFixed(2)}, ${mossYMax.toFixed(2)}]`],
  ["[苔丘] 谷底不陷入地下", mossYMin >= -6.5, `minY=${mossYMin.toFixed(2)}`],
  ["[苔丘] 全苔藓块 addOutline", mossOutlined, `${mossBlobs.length} 颗全部带描边`],
  ["[苔丘] Toon(flatShading) 材质", mossMatsOk, "三色插画绿共享材质"],
  ["[苔丘] 安全距离 ≥ r+4", mossAvoidOk, "障碍 (5,R,0) r=2"]
);

let pass = true;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) pass = false;
}
console.log(pass ? "ALL_PASS" : "HAS_FAILURES");
process.exit(pass ? 0 : 1);
