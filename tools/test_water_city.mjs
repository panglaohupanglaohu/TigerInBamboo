// 峡谷水城（Water City）验收：
//  - 湖岸数学：水面下沉 24 → 湖岸角距 = 0.85·(1-3/7) ≈ 0.4857
//  - 建筑抬根：被淹丘顶之上 → 塔底抬到水面+净空；未淹行为与旧版一致
//  - 大湖水盘：贴水面球（半径 R-24）、角半径 0.75 覆盖城区足迹 0.7286
//  - fixedLevel：relocate 只移湖心不改水位
//  - 运河-大湖落差互联：edgeAng/cruiseAng 参数生效（交点落在湖岸内侧）
// 运行：node tools/test_water_city.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
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
const stubCtx = () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
  putImageData() {},
  fillRect() {},
  createRadialGradient: () => ({ addColorStop() {} }),
});
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  getContext: () => stubCtx(),
});
globalThis.document = {
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { WORLD_RADIUS } = await import(new URL("src/world/worldScale.js", BASE).href);
const { latLonToDir } = await import(new URL("src/world/sphereMath.js", BASE).href);
const {
  WATER_CITY_WATER_DROP,
  WATER_CITY_ANG_R,
  waterCityShoreAng,
  waterCityCanalWaypointDir,
  createCitySeaLake,
} = await import(new URL("src/world/citySeaLake.js", BASE).href);
const {
  buildMoebiusCrystalMetropolis,
  buildingPlacementOnTerrain,
} = await import(new URL("src/world/moebiusCity.js", BASE).href);
const { buildCanalLakeLink } = await import(new URL("src/world/canalLakeLink.js", BASE).href);
const { CANYON } = await import(new URL("src/world/canyon.js", BASE).href);

const R = WORLD_RADIUS;
let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 湖岸数学：水面下沉 24 → 第 2/3 阶地边界");
{
  const shore = waterCityShoreAng(WATER_CITY_WATER_DROP);
  const expect = CANYON.rim * (1 - 3 / CANYON.steps);
  assert(Math.abs(shore - expect) < 1e-9, `湖岸角距 ${shore} ≠ ${expect}`);
  // 水位必须在第 3 阶地（-25.7）之上、第 2 阶地（-17.1）之下
  const step = CANYON.depth / CANYON.steps;
  assert(WATER_CITY_WATER_DROP > 2 * step && WATER_CITY_WATER_DROP < 3 * step,
    "水位 24 必须落在第 2/3 阶地之间");
  // 湖盘角半径必须覆盖城区足迹
  const footprint = Math.min(CANYON.rim - 0.08, CANYON.rim * (1 - 5 / CANYON.steps) * 3);
  assert(WATER_CITY_ANG_R > footprint, `angR ${WATER_CITY_ANG_R} 未覆盖城区足迹 ${footprint}`);
  ok(`岸角 ${shore.toFixed(4)} · 足迹 ${footprint.toFixed(4)} < angR ${WATER_CITY_ANG_R}`);
}

console.log("[2] 建筑抬根：被淹丘顶 → 塔底抬到水面+净空；未淹行为与旧版一致");
{
  const towerDir = latLonToDir(-24, -112, new THREE.Vector3()); // 母塔（第 3 阶地）
  const dry = buildingPlacementOnTerrain(towerDir, 3.4, R, { hall: true, meshBottomLocal: -0.06 });
  const wet = buildingPlacementOnTerrain(towerDir, 3.4, R, {
    hall: true,
    meshBottomLocal: -0.06,
    waterLevel: R - WATER_CITY_WATER_DROP,
  });
  // 未淹参照：waterLevel=-Infinity 与不传完全一致
  const ref = buildingPlacementOnTerrain(towerDir, 3.4, R, {
    hall: true,
    meshBottomLocal: -0.06,
    waterLevel: -Infinity,
  });
  assert.equal(ref.root, dry.root, "waterLevel=-Infinity 必须等价于不传");
  assert(wet.submerged === true, "母塔丘顶应低于水位（被淹）");
  assert(Math.abs(wet.root - (R - WATER_CITY_WATER_DROP + wet.clearance - (-0.06))) < 1e-9,
    "被淹塔底必须抬到水面 + 净空");
  assert(wet.root > dry.root, "被淹塔 root 必须高于未淹 root");
  // 干燥环带（第 2 阶地，d≈0.55）不受水位影响
  const ridgeDir = latLonToDir(
    CANYON.lat + (0.55 * 180) / Math.PI,
    CANYON.lon,
    new THREE.Vector3()
  );
  const ridgeDry = buildingPlacementOnTerrain(ridgeDir, 2.0, R, { waterLevel: R - WATER_CITY_WATER_DROP });
  assert(ridgeDry.submerged === false, "第 2 阶地塔必须保持干燥");
  ok(`被淹 root ${wet.root.toFixed(2)} · 干燥环带不抬`);
}

console.log("[3] 全城装配：水线石台数量 = 被淹晶塔数量");
{
  const scene = new THREE.Scene();
  const city = buildMoebiusCrystalMetropolis(scene, R, {});
  city.group.updateMatrixWorld(true);
  let platCount = 0;
  const instMeshes = [];
  city.group.traverse((o) => {
    if (o.isInstancedMesh && o.name === "moebius-waterline-platforms") platCount = o.count;
    if (o.isInstancedMesh && o.name === "moebius-crystal-instances") instMeshes.push(o);
  });
  const waterLevel = R - WATER_CITY_WATER_DROP;
  // 从实例矩阵统计被淹晶塔（root ≈ 水位 + 0.15）与总晶塔数
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let totalCrystals = 0;
  let submergedCrystals = 0;
  for (const inst of instMeshes) {
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      m.decompose(p, q, s);
      totalCrystals++;
      if (p.length() - waterLevel < 0.5) submergedCrystals++;
      assert(p.length() >= waterLevel + 0.14, `晶塔底 ${p.length().toFixed(2)} 不得低于水面`);
      assert(p.length() + s.y < R + 0.3, `晶塔顶越过轨道净空（${(p.length() + s.y).toFixed(2)}）`);
    }
  }
  assert(totalCrystals >= 3, "城区应装配实例化晶体");
  assert(submergedCrystals >= 1, "至少一座晶塔被淹（城区被水面覆盖）");
  assert.equal(platCount, submergedCrystals, `水线石台 ${platCount} ≠ 被淹晶塔 ${submergedCrystals}`);
  // 花厅塔：母塔立湖心绿岛（干燥），金鳞双塔自水中拔起（被淹抬根）
  let hallLifted = 0;
  let hallDry = 0;
  for (const c of city.crystals) {
    if (c.hall) {
      if (c.root - waterLevel < 1.2) hallLifted++;
      else hallDry++;
    }
  }
  assert(hallLifted >= 2, `金鳞双塔应自水中拔起（被淹 ${hallLifted}）`);
  assert(hallDry >= 1, "母塔应立在湖心绿岛之上（干燥）");
  ok(`晶塔 ${submergedCrystals}/${totalCrystals} 被淹 · 石台 ${platCount} · 花厅 ${hallLifted} 水 / ${hallDry} 岛`);
}

console.log("[4] 大湖水盘：贴水面球 · 覆盖城区 · fixedLevel 只移湖心");
{
  const scene = new THREE.Scene();
  const centerDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const sea = createCitySeaLake(scene, R, {
    seed: 5521,
    centerDir,
    baseRadius: R - WATER_CITY_WATER_DROP - 0.14,
    angR: WATER_CITY_ANG_R,
    fixedLevel: true,
  });
  assert(Math.abs(sea.surfaceR - (R - WATER_CITY_WATER_DROP)) < 1e-6,
    `水面 ${sea.surfaceR} ≠ R-24`);
  assert(sea.rFlat > 0 && Math.abs(sea.rFlat - sea.surfaceR * Math.sin(sea.angR)) < 1e-6,
    "盘半径必须按水面球计算");
  // 城区最远点（足迹边缘）必须在水盘内
  const edge = centerDir
    .clone()
    .multiplyScalar(Math.cos(0.7286))
    .addScaledVector(
      new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centerDir).normalize(),
      Math.sin(0.7286)
    )
    .normalize()
    .multiplyScalar(R);
  assert(sea.containsWorldPos(edge), "城区足迹边缘必须在水盘内");
  assert(sea.containsWorldPos(centerDir.clone().multiplyScalar(R)), "湖心在水盘内");
  // 潜水判定：水面半径 R-24，湖心下方即水下
  const diver = centerDir.clone().multiplyScalar(R - 24 - 4);
  assert(sea.diveDepthAt(diver) > 0, "湖内水下点必须判定为已潜入");
  const above = centerDir.clone().multiplyScalar(R - 24 + 2);
  assert(sea.diveDepthAt(above) < 0, "水面上方不得判定为潜入");
  // fixedLevel：搬到别处后水位不变
  const before = sea.surfaceR;
  sea.relocate(latLonToDir(10, 40, new THREE.Vector3()), R - 10);
  assert(Math.abs(sea.surfaceR - before) < 1e-6, "fixedLevel 搬迁不得改变水位");
  sea.relocate(sea.defaultCenterDir);
  assert(Math.abs(sea.surfaceR - before) < 1e-6, "复位后水位仍须恒定");
  ok(`surfaceR ${sea.surfaceR.toFixed(2)} · rFlat ${sea.rFlat.toFixed(1)} · fixedLevel 恒定`);
}

console.log("[5] 水晶城运河航点：避开三座花厅塔与母塔岛丘");
{
  const centerDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centerDir).normalize();
  const north = new THREE.Vector3().crossVectors(centerDir, east).normalize();
  const hallDirs = [-0.35, 1.15, 2.45].map((a) => {
    const lx = Math.cos(a) * 0.437;
    const lz = Math.sin(a) * 0.437;
    const d = Math.hypot(lx, lz);
    return centerDir
      .clone()
      .multiplyScalar(Math.cos(d))
      .addScaledVector(east, (lx / d) * Math.sin(d))
      .addScaledVector(north, (lz / d) * Math.sin(d))
      .normalize();
  });
  const wp = waterCityCanalWaypointDir();
  assert(Math.abs(wp.angleTo(centerDir) - 0.2) < 1e-6, `航点角距 ${wp.angleTo(centerDir)} ≠ 0.2`);
  const minHall = Math.min(...hallDirs.map((h) => wp.angleTo(h)));
  assert(minHall >= 0.19, `航点距最近花厅塔 ${minHall.toFixed(3)} rad < 0.19`);
  ok(`航点角距 0.2 · 距最近塔 ${minHall.toFixed(3)} rad`);
}

console.log("[6] 运河-大湖落差互联：edgeAng/cruiseAng 交点落在湖岸内侧");
{
  const scene = new THREE.Scene();
  const centerDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  // 伪运河曲线：绕湖心一圈、角距 0.3~0.7 起伏，保证与湖岸两次相交
  const pts = [];
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centerDir).normalize();
  const north = new THREE.Vector3().crossVectors(centerDir, east).normalize();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const d = 0.3 + 0.4 * Math.abs(Math.sin(a));
    pts.push(
      centerDir
        .clone()
        .multiplyScalar(Math.cos(d))
        .addScaledVector(east, Math.cos(a) * Math.sin(d))
        .addScaledVector(north, Math.sin(a) * Math.sin(d))
        .normalize()
        .multiplyScalar(R + 0.05)
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
  const canal = { curve, planetRadius: R, waterR: R + 0.67, bedR: R + 0.05 };
  const sea = {
    centerDir: centerDir.clone(),
    surfaceR: R - WATER_CITY_WATER_DROP,
    angR: WATER_CITY_ANG_R,
  };
  const link = buildCanalLakeLink(scene, canal, sea, {
    edgeAng: waterCityShoreAng(WATER_CITY_WATER_DROP) - 0.02,
    cruiseAng: 0.2,
  });
  assert(link?.ok, "落差互联必须建成");
  const eDir = curve.getPointAt(link.uEntry, new THREE.Vector3()).normalize();
  const xDir = curve.getPointAt(link.uExit, new THREE.Vector3()).normalize();
  const shore = waterCityShoreAng(WATER_CITY_WATER_DROP);
  for (const [name, d] of [["入湖", eDir], ["出湖", xDir]]) {
    const ang = d.angleTo(centerDir);
    assert(ang <= shore + 0.05 && ang >= shore - 0.06,
      `${name}点角距 ${ang.toFixed(3)} 应贴近湖岸 ${shore.toFixed(3)}`);
  }
  ok(`梯道入湖 ${eDir.angleTo(centerDir).toFixed(3)} · 升船机出湖 ${xDir.angleTo(centerDir).toFixed(3)} rad`);
}

console.log(`\n结果：${pass}/6 组验收通过`);
