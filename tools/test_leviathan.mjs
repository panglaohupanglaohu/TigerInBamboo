// 太古浮岛白鲸验收：
//  - 鲸体非等比拉伸锁死 (4.5,1.3,2.2)、背顶切平 Y=6、地壳板 25×14 平躺
//  - 20 枚藤壶 + 26 株灌木围墙 + Y 字尾鳍 rotation.x=0.6
//  - 苔庭整组移上鲸背：全部直系子级落入地壳板投影区、随鲸呼吸起伏
//  - 描边（addOutline）覆盖鲸体/板/尾鳍/灌木/藤壶
// 运行：node tools/test_leviathan.mjs
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
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
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
const {
  buildEcoLeviathanIsland,
  LEVIATHAN_PLATE_Y,
  LEVIATHAN_GARDEN_SCALE,
} = await import(new URL("src/assets/leviathanIsland.js", BASE).href);
const { saihojiGardenScene } = await import(new URL("src/scenes/saihojiGarden.js", BASE).href);
const { SAIHOJI_HUB, latLonToGardenDir } = await import(new URL("src/world/saihoji.js", BASE).href);

const R = WORLD_RADIUS;
let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};
const outlineCount = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (o.userData?.isOutline) n++;
  });
  return n;
};

console.log("[1] 鲸体资产：拉伸锁死 · 切平 · 尾鳍 · 藤壶 · 灌木 · 描边");
{
  const scene = new THREE.Scene();
  // minR/maxR 拉开 + basePos 在 maxR：升空态检验规格锁死值
  const { group, update } = buildEcoLeviathanIsland({
    seed: 9901,
    basePos: new THREE.Vector3(0, 10, 0),
    minR: -5,
    maxR: 10,
  });
  scene.add(group);
  assert.equal(group.name, "leviathanGroup");
  const body = group.getObjectByName("leviathan-body");
  assert(body, "鲸体必须存在");
  assert.deepEqual(
    [body.scale.x, body.scale.y, body.scale.z],
    [4.5, 1.3, 2.2],
    "非等比拉伸参数锁死 (4.5,1.3,2.2)"
  );
  assert(Math.abs(body.scale.y * 8 + body.position.y - LEVIATHAN_PLATE_Y) < 0.1,
    "背顶必须切平在地壳板 Y");
  const plate = group.getObjectByName("leviathan-crust-plate");
  assert(plate, "地壳板必须存在");
  const island = group.getObjectByName("leviathan-island");
  assert(island, "苔庭岛组必须存在");
  assert(Math.abs(island.position.y - LEVIATHAN_PLATE_Y) < 1e-6, "岛面 Y 锁死 6.08");
  assert(Math.abs(plate.position.y) < 1e-6, "地壳板贴岛面原点");
  assert.deepEqual(
    [plate.geometry.parameters.width, plate.geometry.parameters.height],
    [25, 14],
    "地壳板 25×14 锁死"
  );
  const flukes = group.getObjectByName("leviathan-flukes");
  assert(flukes, "尾鳍组必须存在");
  assert(Math.abs(flukes.rotation.x - 0.6) < 1e-9, "尾鳍 rotation.x=0.6（35° 微翘）锁死");
  assert(flukes.getObjectByName("leviathan-fluke-L") && flukes.getObjectByName("leviathan-fluke-R"),
    "Y 字双片尾鳍必须存在");
  let barnacles = 0;
  let shrubs = 0;
  group.traverse((o) => {
    if (o.name === "leviathan-barnacle") barnacles++;
    if (o.name === "leviathan-shrub-ring") shrubs++;
  });
  assert.equal(barnacles, 20, `藤壶 ${barnacles} ≠ 20`);
  assert.equal(shrubs, 26, `灌木围墙 ${shrubs} ≠ 26`);
  const outlines = outlineCount(group);
  assert(outlines >= 1 + 20 + 26 + 1 + 2, `描边数 ${outlines} 不足`);
  // 呼吸缓动：位置必须随时间起伏（沿 up 分量）
  const y0 = group.position.clone();
  update(0, 1.3);
  assert(group.position.distanceTo(y0) > 0.01, "呼吸缓动必须推动鲸体");
  ok(`藤壶 20 · 灌木 26 · 描边 ${outlines} · 呼吸位移生效`);
}

console.log("[2] 苔庭上鲸背：六景落入地壳板投影 · 松树随鲸起伏");
{
  const scene = new THREE.Scene();
  const handle = saihojiGardenScene.load({ scene, planetRadius: R, options: {} });
  const group = handle.group;
  assert.equal(group.name, "leviathanGroup");
  scene.add(group);
  group.updateMatrixWorld(true);
  // 六景内容（古松/石组）必须都落在鲸背地壳板投影区内
  // （whale-local |x|≤12.5+ 余量、|z|≤7+ 余量、y ≥ 地壳板）
  const inv = group.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  let zones = 0;
  let pines = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  const maxExtent = { x: 0, z: 0 };
  const garden = group.getObjectByName("SaihojiSixScenes");
  assert(garden, "苔庭组必须挂入鲸体");
  for (const child of garden.children) {
    if (!child.name?.startsWith?.("Saihoji:")) continue;
    zones++;
    let hasPine = false;
    child.traverse((o) => {
      if (o.userData?.assetType === "colossalVernacularTree" || o.userData?.pineRole) {
        pines++;
        hasPine = true;
        o.updateWorldMatrix(true, false);
        o.getWorldPosition(world).applyMatrix4(inv);
        maxExtent.x = Math.max(maxExtent.x, Math.abs(world.x));
        maxExtent.z = Math.max(maxExtent.z, Math.abs(world.z));
        minY = Math.min(minY, world.y);
        maxY = Math.max(maxY, world.y);
        assert(world.y > LEVIATHAN_PLATE_Y - 0.3, `景区 ${child.name} 松树不得陷进地壳板`);
      }
    });
    assert(hasPine, `景区 ${child.name} 应有古松`);
  }
  assert.equal(zones, 6, `六景 ${zones} ≠ 6`);
  assert(maxExtent.x <= 13.2 && maxExtent.z <= 8.0,
    `松树投影 (${maxExtent.x.toFixed(1)}, ${maxExtent.z.toFixed(1)}) 超出地壳板`);
  assert(pines >= 20, `古松 ${pines} 不足`);
  // 呼吸联动：苔庭子级随鲸移动
  const child = garden.children.find((c) => c.name?.startsWith?.("Saihoji:"));
  const before = child.getWorldPosition(new THREE.Vector3());
  handle.update(0, 2.0);
  group.updateMatrixWorld(true);
  const after = child.getWorldPosition(new THREE.Vector3());
  assert(before.distanceTo(after) > 0.01, "苔庭必须随鲸呼吸同步起伏");
  // 球面下陷补偿：各景区松树不得比中枢低太多（sag 已补回）
  assert(maxY - minY < 1.6, `松树高差 ${(maxY - minY).toFixed(2)} 过大（sag 补偿失效）`);
  ok(`六景 6 · 古松 ${pines} · 投影 ${maxExtent.x.toFixed(1)}×${maxExtent.z.toFixed(1)} · 呼吸联动`);
}

console.log("[3] 藏地/升空状态机：平时只见苔庭 · 扫描灯艇掠过才升空");
{
  const scene = new THREE.Scene();
  const handle = saihojiGardenScene.load({ scene, planetRadius: R, options: {} });
  const group = handle.group;
  scene.add(group);
  group.updateMatrixWorld(true);
  const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
  const plate = group.getObjectByName("leviathan-crust-plate");
  const body = group.getObjectByName("leviathan-body");
  const flukes = group.getObjectByName("leviathan-flukes");
  const tailRoot = group.getObjectByName("leviathan-tail-root");
  const plateWorldY = () => {
    group.updateMatrixWorld(true);
    return plate.getWorldPosition(new THREE.Vector3()).dot(hubDir);
  };
  // 初始藏地：地壳板贴球面（≈R+0.3）、鲸身全部入地、尾鳍收起
  handle.update(0, 0);
  assert(Math.abs(plateWorldY() - (R + 0.3)) < 0.6, `藏地时板高 ${(plateWorldY() - R).toFixed(2)} 应≈0.3`);
  {
    group.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(body);
    const top = bb.max.dot(hubDir);
    assert(top < R - 0.5, `藏地时鲸身必须全部入地（背顶 ${(top - R).toFixed(1)}）`);
  }
  assert(flukes.rotation.x < 0.1, `藏地时尾鳍应收起（rotation.x=${flukes.rotation.x.toFixed(2)}）`);
  assert(tailRoot.position.y < -1.5, `藏地时尾柄应贴地收起（y=${tailRoot.position.y.toFixed(2)}）`);
  ok(`藏地：板高 +${(plateWorldY() - R).toFixed(2)} · 鲸身全入地 · 尾鳍收起 · 只见苔庭`);
  // 扫描灯艇接近 → 升空（编队组不动，读 userData._patrolCenter）
  const squad = new THREE.Group();
  squad.name = "moebius-aircraft-squad";
  const eastOf = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
  squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R).addScaledVector(eastOf, 20);
  scene.add(squad);
  for (let i = 0; i < 120; i++) handle.update(0.5, 0);
  assert(plateWorldY() > R + 18, `升空后板高 ${(plateWorldY() - R).toFixed(1)} 应≈+30`);
  assert(Math.abs(flukes.rotation.x - 0.6) < 0.03,
    `升空后尾鳍应扬起 35°（rotation.x=${flukes.rotation.x.toFixed(2)}）`);
  assert(tailRoot.position.y > 3.3, `升空后尾柄应回位（y=${tailRoot.position.y.toFixed(2)}）`);
  ok(`升空：板高 +${(plateWorldY() - R).toFixed(1)} · 尾鳍 35° 扬起`);
  // 扫描灯艇远去 → 故事线锁定升空（鲸起后不随灯艇离场降藏；降藏由箭伤触发）
  squad.userData._patrolCenter = hubDir
    .clone()
    .multiplyScalar(R)
    .addScaledVector(eastOf, 400);
  for (let i = 0; i < 120; i++) handle.update(0.5, 0);
  assert(plateWorldY() > R + 18, "鲸起故事线锁定：灯艇远去仍应保持升空");
  assert(flukes.rotation.x > 0.5, "故事线锁定期间尾鳍保持扬起");
  ok("故事线锁定：灯艇远去 → 苔庭鲸保持升空");
}

console.log("[4] 扫描吸食感：松树波动 + 树叶螺旋升空被吸进灯艇");
{
  const scene = new THREE.Scene();
  const handle = saihojiGardenScene.load({ scene, planetRadius: R, options: {} });
  scene.add(handle.group);
  const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
  const eastOf = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
  // 扫描灯艇悬停苔庭旁（升空触发圈内）
  const squad = new THREE.Group();
  squad.name = "moebius-aircraft-squad";
  squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R + 20).addScaledVector(eastOf, 24);
  scene.add(squad);
  handle.update(0, 0);
  const garden = handle.group.getObjectByName("SaihojiSixScenes");
  // 松树基础姿态快照
  const pineBases = new Map();
  garden.traverse((o) => {
    if (o.userData?._swayBase) pineBases.set(o, o.userData._swayBase.clone());
  });
  assert(pineBases.size >= 20, `古松 ${pineBases.size} 株不足`);
  // 扫描进行 1 秒（岛面尚低于灯艇，树叶应开始释放）
  for (let i = 0; i < 24; i++) handle.update(1 / 24, i / 24);
  let swayed = 0;
  for (const [pine, base] of pineBases) {
    if (pine.quaternion.angleTo(base) > 0.002) swayed++;
  }
  assert(swayed >= 10, `波动松树 ${swayed} 株不足`);
  const leafGroup = scene.getObjectByName("saihoji-scan-leaves");
  assert(leafGroup, "叶池必须存在");
  const visibleLeaves = () =>
    leafGroup.children.filter((l) => l.visible && l.userData.life > 0);
  const before = visibleLeaves();
  assert(before.length > 0, "扫描时必须有树叶被吸起");
  // 树叶向灯艇收拢：3 帧后与灯艇的距离应明显减小
  const target = squad.userData._patrolCenter;
  const d0 = Math.min(...before.map((l) => l.position.distanceTo(target)));
  for (let i = 0; i < 6; i++) handle.update(1 / 24, 1 + i / 24);
  const d1 = Math.min(...visibleLeaves().map((l) => l.position.distanceTo(target)));
  assert(d1 < d0 - 0.5, `树叶应被吸向灯艇（d0=${d0.toFixed(1)} → d1=${d1.toFixed(1)}）`);
  ok(`波动 ${swayed}/${pineBases.size} 株 · 升空叶 ${before.length} 片 · 收拢 ${d0.toFixed(1)}→${d1.toFixed(1)}`);
}

console.log("[5] 升空落雨：苔庭水沿鲸身滑落、如雨下坠，只在上升时");
{
  const scene = new THREE.Scene();
  const handle = saihojiGardenScene.load({ scene, planetRadius: R, options: {} });
  scene.add(handle.group);
  const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
  const eastOf = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
  const squad = new THREE.Group();
  squad.name = "moebius-aircraft-squad";
  squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R + 20).addScaledVector(eastOf, 24);
  scene.add(squad);
  handle.update(0, 0);
  const rainGroup = handle.group.getObjectByName("leviathan-rain");
  assert(rainGroup, "雨滴池必须存在");
  const visibleRain = () => rainGroup.children.filter((d) => d.visible);
  assert(visibleRain().length === 0, "静止藏地时不得落雨");
  // 上升至中段（t01≈0.6，发射峰值）：雨滴出现且在下坠
  for (let i = 0; i < 8; i++) handle.update(0.5, 0);
  const mid = visibleRain();
  assert(mid.length >= 20, `上升中段雨滴 ${mid.length} 不足`);
  const falling = mid.filter((d) => d.userData.phase === 1);
  assert(falling.length > 0, "应有脱离体表下坠的雨滴");
  assert(falling.every((d) => d.userData.vel.y < 0), "下坠雨滴垂直速度必须向下");
  const t0 = falling[0];
  const y0 = t0.position.y;
  const life0 = t0.userData.life;
  for (let i = 0; i < 3; i++) handle.update(0.15, 0);
  if (t0.visible && t0.userData.life > life0) {
    assert(t0.position.y < y0, `雨滴应下坠（y ${y0.toFixed(2)} → ${t0.position.y.toFixed(2)}）`);
  }
  ok(`上升中段雨滴 ${mid.length} 片（下坠 ${falling.length}）· 全部向下`);
  // 升到顶：发射停止，残雨落尽
  for (let i = 0; i < 130; i++) handle.update(0.5, 0);
  assert(visibleRain().length === 0, "升到顶后雨应落尽");
  // 灯艇远去：发射停止，残雨落尽（故事线锁定升空，不降藏也不落雨）
  squad.userData._patrolCenter = hubDir
    .clone()
    .multiplyScalar(R)
    .addScaledVector(eastOf, 400);
  for (let i = 0; i < 40; i++) handle.update(0.5, 0);
  assert(visibleRain().length === 0, "灯艇远去后不得再落雨");
  ok("升顶雨尽 · 灯艇远去无雨");
}

console.log("[6] 苔庭鲸故事线：鲸起锁定 → 羽箭攒射 → 鲸回原位 → 终扫 → 复位");
{
  const scene = new THREE.Scene();
  const handle = saihojiGardenScene.load({ scene, planetRadius: R, options: {} });
  scene.add(handle.group);
  const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
  const eastOf = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
  const squad = new THREE.Group();
  squad.name = "moebius-aircraft-squad";
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R + 20).addScaledVector(eastOf, 24);
  scene.add(squad);
  handle.update(0, 0);
  const plate = handle.group.getObjectByName("leviathan-crust-plate");
  const plateY = () => {
    handle.group.updateMatrixWorld(true);
    return plate.getWorldPosition(new THREE.Vector3()).dot(hubDir);
  };
  const setNear = () => {
    squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R + 20).addScaledVector(eastOf, 24);
  };
  const setFar = () => {
    squad.userData._patrolCenter = hubDir.clone().multiplyScalar(R).addScaledVector(eastOf, 400);
  };
  // 0→1：扫描升空并锁定
  for (let i = 0; i < 60; i++) handle.update(0.5, 0);
  assert.equal(handle.getStoryPhase(), 1, "鲸升到顶应进入故事线锁定");
  assert(plateY() > R + 18, "鲸应升空");
  // 灯艇远去 → 保持升空（故事线以鲸为主）
  setFar();
  for (let i = 0; i < 30; i++) handle.update(0.5, 0);
  assert(plateY() > R + 18, "故事线锁定：灯艇离场不降藏");
  // 羽箭攒射（50 箭）→ 升空能力不足 → 鲸恢复原位
  squad.userData.members[0].userData.arrowHits = 50;
  squad.userData.members[0].userData.woundHeightMul = 0.5;
  for (let i = 0; i < 60; i++) handle.update(0.5, 0);
  assert.equal(handle.getStoryPhase(), 2, "箭伤后进入收束阶段");
  assert(Math.abs(plateY() - (R + 0.3)) < 0.6, "鲸应恢复原位");
  // 收束：机队离开 → 终扫一次 → 再离开 → 中箭清零、故事复位
  for (let i = 0; i < 10; i++) handle.update(0.5, 0);
  setNear();
  for (let i = 0; i < 10; i++) handle.update(0.5, 0);
  assert.equal(handle.getStoryPhase(), 2, "终扫期间仍处收束");
  assert(Math.abs(plateY() - (R + 0.3)) < 0.6, "终扫不得再升鲸");
  setFar();
  for (let i = 0; i < 10; i++) handle.update(0.5, 0);
  assert.equal(handle.getStoryPhase(), 0, "终扫结束后故事复位");
  assert.equal(squad.userData.members[0].userData.arrowHits, 0, "中箭计数应清零（升空能力恢复）");
  // 模拟机队侧缓动：中箭清零后升空能力逐渐恢复（updateAircraftHover 每帧上修 woundHeightMul）
  squad.userData.members[0].userData.woundHeightMul = 1;
  // 新一轮：再次扫描 → 鲸再升
  setNear();
  for (let i = 0; i < 60; i++) handle.update(0.5, 0);
  assert.equal(handle.getStoryPhase(), 1, "新一轮扫描应再次进入故事线");
  assert(plateY() > R + 18, "新一轮扫描应再次升鲸");
  ok("鲸起锁定 · 箭伤降鲸 · 终扫收束 · 痊愈复位 · 新一轮循环");
}

console.log(`\n结果：${pass} 项断言 · 6 组验收通过`);
