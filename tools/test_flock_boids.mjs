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
//  第四阶段：赤道动态积雨云墙（焊接几何 / 噪声形变 / 太阳受光 / 描边）
// ---------------------------------------------------------------------------
console.log("--- 赤道动态积雨云墙 ---");

const cloudScene = new THREE.Scene();
const wall = createDynamicMoebiusClouds(cloudScene, R);
const mockSun = {
  position: new THREE.Vector3(20, 28, 16),
  intensity: 1.6,
  color: new THREE.Color(0xfff1c9),
};
const towers = wall.children.filter((c) => c.name === "cloud-tower");
const blobCounts = towers.map((tw) => tw.userData.blobs.length);
const allBlobs = wall.userData.blobs;
const radii = towers.map((tw) => tw.position.length());
const onEquator = towers.every((tw) => Math.abs(tw.position.y) < 1e-6);
const allOutlined = allBlobs.every((b) =>
  b.children.some((c) => c.userData?.isOutline)
);
const matsOk = allBlobs.every(
  (b) =>
    b.material.isMeshToonMaterial &&
    b.material.flatShading === true &&
    b.material.gradientMap?.image?.width === 3
);
// 焊接索引网格：92 唯一顶点（Icosahedron 细分 2 → 180 面，欧拉 V=92）
const weldedOk = allBlobs.every(
  (b) => b.geometry.index !== null && b.geometry.attributes.position.count === 92
);
// 高频流体形变：两个时刻快照逐颗比对（风暴模式全群每帧形变）
updateDynamicMoebiusClouds(wall, 0.5, mockSun);
const snap1 = allBlobs.map((b) => b.geometry.attributes.position.array.slice());
updateDynamicMoebiusClouds(wall, 0.9, mockSun);
let fluidOk = true;
let fluidMax = 0;
let deformMax = 0;
for (let bi = 0; bi < allBlobs.length; bi++) {
  const arr = allBlobs[bi].geometry.attributes.position.array;
  const orig = allBlobs[bi].userData.deform.orig;
  let frameDiff = 0;
  let origDiff = 0;
  for (let i = 0; i < arr.length; i++) {
    frameDiff = Math.max(frameDiff, Math.abs(arr[i] - snap1[bi][i]));
    origDiff = Math.max(origDiff, Math.abs(arr[i] - orig[i]));
  }
  if (frameDiff < 1e-4) fluidOk = false;
  fluidMax = Math.max(fluidMax, frameDiff);
  deformMax = Math.max(deformMax, origDiff);
}
// 形变幅度有界：amp = 0.35·(0.5 + r·0.28)，最大半径 ~5.5 → ≤ ~0.71
let ampBounded = true;
for (const b of allBlobs) {
  if (b.userData.deform.amp > 0.8) ampBounded = false;
}
// 云底雨带：嵌套 LineSegments，随时间倾泻（位置变化）
const rain = wall.userData.rain;
const rainOk =
  !!rain &&
  rain.isLineSegments &&
  rain.geometry.attributes.position.count === 800 * 2;
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
// 闪电频闪状态机存在
const stormStateOk = !!wall.userData.storm && typeof wall.userData.storm.next === "number";

// ---- 龙卷风：随机吹开云墙（概率 1/3）----
// 续跑 ~28s，观测：生成 → 云球外散（吹开）→ 漏斗 → 合拢
let torSeen = false;
let torOpenSeen = false; // 云球被吹离基准位 > 1 单位
let torFunnelSeen = false; // 漏斗挂进云塔
let torCloseSeen = false; // 进入合拢阶段
let torMaxActive = 0;
let torT = 1.7; // 接前面已推进到的时刻
for (let f = 0; f < 840; f++) {
  torT += 1 / 30;
  updateDynamicMoebiusClouds(wall, torT, mockSun);
  const tors = wall.userData.tornadoes;
  torMaxActive = Math.max(torMaxActive, tors.length);
  if (tors.length > 0) torSeen = true;
  for (const tor of tors) {
    if (tor.funnel && tor.funnel.parent === tor.tower) torFunnelSeen = true;
    if (tor.state === "close") torCloseSeen = true;
    if (tor.state === "open" || tor.state === "hold") {
      for (const s of tor.blobStates) {
        if (s.blob.position.distanceTo(s.base) > 1.0) {
          torOpenSeen = true;
          break;
        }
      }
    }
  }
}
// 合拢后云球归位：无活跃龙卷风的云塔，其云球应回到初始堆叠半径范围内
let wallClosedOk = true;
for (const tor of wall.userData.tornadoes) {
  // 收尾仍可能有残留，宽松判断：只要大多数云球未飞远即可
  for (const s of tor.blobStates) {
    if (s.blob.position.distanceTo(s.base) > 12) wallClosedOk = false;
  }
}

results.push(
  ["[云墙] 挂载全局场景（equatorialClouds）", wall.name === "equatorialClouds" && cloudScene.children.includes(wall), `name=${wall.name}`],
  ["[云墙] 赤道环 24 座云塔（每 15°）", towers.length === 24, `towers=${towers.length}`],
  ["[云墙] 单塔 ≥30 颗云球", blobCounts.every((c) => c >= 30 && c <= 42), `count∈[${Math.min(...blobCounts)}, ${Math.max(...blobCounts)}]`],
  ["[云墙] 锚定赤道面（y=0）", onEquator, "全部塔 y=0"],
  ["[云墙] 半径带 45–50（低空 5–10）", radii.every((r) => r >= 45 && r <= 50), `r∈[${Math.min(...radii).toFixed(2)}, ${Math.max(...radii).toFixed(2)}]`],
  ["[云墙] 焊接索引网格（92 顶点/球）", weldedOk, "细分 2 → 92 唯一顶点"],
  ["[云墙] 全网格 addOutline 墨线", allOutlined, `${allBlobs.length} 颗云球全部带描边`],
  ["[云墙] Toon(flatShading)+3 阶 gradientMap", matsOk, "材质规格一致"],
  ["[云墙] 高频流体形变逐颗生效", fluidOk, `帧间maxΔ=${fluidMax.toFixed(4)} 幅值maxΔ=${deformMax.toFixed(4)}`],
  ["[云墙] 形变幅度有界", ampBounded, "amp ≤ 0.8"],
  ["[云墙] 云底嵌套雨带（800 丝）", rainOk, "LineSegments × 800"],
  ["[云墙] 雨带随时间倾泻", rainMoved, "位置帧间变化"],
  ["[云墙] 闪电频闪状态机", stormStateOk, "storm.next 已调度"],
  ["[云墙] 龙卷风随机生成（1/3）", torSeen, `28s 内出现，峰值同屏=${torMaxActive}`],
  ["[云墙] 龙卷风吹开云墙（云球外散）", torOpenSeen, "云球被吹离基准位"],
  ["[云墙] 漏斗挂入云塔", torFunnelSeen, "funnel 作为塔子节点"],
  ["[云墙] 云墙随后合拢", torCloseSeen && wallClosedOk, "close 阶段 + 云球归位"],
  ["[云墙] 同屏龙卷风 ≤3", torMaxActive <= 3, `max=${torMaxActive}`]
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
