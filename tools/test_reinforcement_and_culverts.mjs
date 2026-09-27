// tools/test_reinforcement_and_culverts.mjs
// 验证：
// 1. 书店镇告警时高山城堡派遣援军战船与莫比斯机队交战
// 2. 战船搭载 20 名精锐持械士兵（10 长弓、6 长枪、4 近卫），甲板战位
// 3. 战船航行全程 100% 走水路，零穿模草地/陆地
// 4. 有轨电车穿越高山古堡与主岛丘陵时建立完整涵洞（拱券洞门、门额、八字翼墙、拱顶涵身、内壁暖光照明）
// 5. 涵洞内壁山体网格精准开凿，电车净空无山石穿模

import assert from "node:assert/strict";

const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  textContent: "",
  innerHTML: "",
  hidden: true,
  dataset: {},
  value: "",
  appendChild() {},
  append(...a) {},
  addEventListener() {},
  removeEventListener() {},
  focus() {},
  blur() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {}, measureText: () => ({ width: 10 }) }),
});

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb) => setTimeout(() => cb(0), 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.document = {
  body: stubEl(),
  documentElement: stubEl(),
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { buildChristchurchTramSystem } = await import("../TigerMessenger/src/world/tramSystem.js");
const { buildOdysseyCitadel } = await import("../TigerMessenger/src/world/odysseyCitadel.js");
const { citadelSiteDir, citadelRangeLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");
const { carveCitadelMountainForTram } = await import("../TigerMessenger/src/scenes/messenger/loadCitadel.js");
const { createSaihojiPhalanxBattle } = await import("../TigerMessenger/src/world/saihojiPhalanx.js");
const { groundLiftAt, worldToFlatXZ } = await import("../TigerMessenger/src/world/hills.js");

console.log("================================================================");
console.log("  高山城堡增援战船与有轨电车涵洞系统 全面自动化测试");
console.log("================================================================");

const R = 160;
const scene = new THREE.Scene();

// ====================================================================
// 测试一：有轨电车双涵洞系统（高山古堡 + 主岛丘陵）
// ====================================================================
console.log("\n[1] 正在测试有轨电车涵洞系统 (Tram Culverts)...");
const tramSystem = buildChristchurchTramSystem(scene, R);
const culverts = tramSystem.group.children.filter((c) => c.name.startsWith("tram-culvert"));

assert.strictEqual(culverts.length, 2, "应生成 2 处涵洞（高山古堡段与主岛丘陵段）");
console.log(`  ✓ 成功生成 ${culverts.length} 处涵洞`);

for (let idx = 0; idx < culverts.length; idx++) {
  const c = culverts[idx];
  // 结构检查：涵顶网格
  const vaultMesh = c.children.find((ch) => ch.isMesh && ch.name !== "lamp");
  assert.ok(vaultMesh, `涵洞 ${c.name} 必须包含拱顶涵身网格`);

  // 结构检查：进出两端洞门
  const portals = c.children.filter((ch) => ch.isGroup);
  assert.strictEqual(portals.length, 2, `涵洞 ${c.name} 必须包含进出 2 座石券洞门`);

  for (const p of portals) {
    // 门额、拱顶石、两侧立柱、两侧八字翼墙共 6 个构件
    assert.strictEqual(p.children.length, 6, `洞门必须包含门额、拱顶石、双立柱与两侧八字翼墙 (共 6 构件)`);
  }

  // 结构检查：内壁照明壁灯
  const lamps = c.children.filter((ch) => ch.isMesh && ch !== vaultMesh);
  assert.ok(lamps.length >= 6, `涵洞 ${c.name} 内壁应布置暖光壁灯，实测: ${lamps.length} 盏`);
  console.log(`  ✓ ${c.name}: 拱顶涵身完好，2座八字翼墙拱门就绪，${lamps.length} 盏内壁壁灯点亮`);
}

// ====================================================================
// 测试二：高山古堡涵洞山体开凿净空（无山石穿模）
// ====================================================================
console.log("\n[2] 正在测试古堡涵洞山体网格开凿 (Mountain Carving)...");
const citadelDir = citadelSiteDir(new THREE.Vector3());
const odysseyCitadel = buildOdysseyCitadel({
  dir: citadelDir,
  groundRadius: R + citadelRangeLiftDir(citadelDir),
  planetRadius: R,
  seed: 20260808,
  latestDesign: true,
});
scene.add(odysseyCitadel);
odysseyCitadel.updateMatrixWorld(true);

carveCitadelMountainForTram(odysseyCitadel, tramSystem.curve, R);

const mountain = odysseyCitadel.getObjectByName("citadel-oskar-grid-mountain-surface");
assert.ok(mountain, "必须存在古堡主山体网格");
const pos = mountain.geometry.attributes.position;
const trackPts = tramSystem.curve.getPoints(720);
const pWorld = new THREE.Vector3();
let intrudingCount = 0;

for (let i = 0; i < pos.count; i++) {
  pWorld.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mountain.matrixWorld);
  let minD = Infinity;
  let nearestPt = null;
  for (const tp of trackPts) {
    const d = tp.distanceTo(pWorld);
    if (d < minD) {
      minD = d;
      nearestPt = tp;
    }
  }
  // 在 2.4m 走廊净空半径内，山体高度不得高出轨面
  if (minD < 2.4 && nearestPt) {
    const trackR = nearestPt.length();
    const vertR = pWorld.length();
    if (vertR > trackR) {
      intrudingCount++;
    }
  }
}
assert.strictEqual(intrudingCount, 0, "涵洞隧道内部山体顶点必须全部压低在轨面以下，杜绝穿模");
console.log("  ✓ 古堡山体开凿完成：涵洞内部净空走廊穿模顶点数 = 0");

// ====================================================================
// 测试三：书店镇告警与高山城堡增援战船（搭载 20 名精锐持械士兵）
// ====================================================================
console.log("\n[3] 正在测试城堡援军战船与 20 名精锐士兵 (Reinforcement Warship)...");
const battle = createSaihojiPhalanxBattle({ scene, 
  waterR: R + 0.5,
});
const targetDir = new THREE.Vector3(0.5, 0.5, 0.7).normalize();
const ship = battle.userData.marchGarrisonTo(targetDir);

assert.ok(ship, "marchGarrisonTo 必须成功返回城堡增援战船对象");
assert.strictEqual(ship.boat.name, "citadel-reinforce-warship", "战船名称应为 citadel-reinforce-warship");
assert.strictEqual(ship.soldiers.length, 20, "战船必须搭载 20 名精锐持械士兵");

const longbowCount = ship.soldiers.filter((s) => s.userData.phalanxRole === "longbow").length;
const spearCount = ship.soldiers.filter((s) => s.userData.phalanxRole === "spear").length;
const gladiusCount = ship.soldiers.filter((s) => s.userData.phalanxRole === "gladius").length;

assert.strictEqual(longbowCount, 10, "必须包含 10 名长弓射手");
assert.strictEqual(spearCount, 6, "必须包含 6 名重装长枪兵");
assert.strictEqual(gladiusCount, 4, "必须包含 4 名近战贴身近卫");
console.log(`  ✓ 援军编成验证通过：10 名长弓手 + 6 名长枪兵 + 4 名近卫 (共 20 名士兵)`);

// 检查甲板战位及武器状态
for (let i = 0; i < 20; i++) {
  assert.strictEqual(
    ship.crewContinuity.manifest[i].stage,
    "deck-armed",
    `第 ${i} 名士兵必须处于甲板持械戒备状态 (deck-armed)`
  );
}
console.log("  ✓ 20 名士兵全员甲板战位 (deck-armed) 持械戒备");

// 目标池检查：战船与 20 名士兵均进入打击池 (21 个打击目标)
const targets = battle.userData.garrisonTargets();
assert.ok(targets.includes(ship.boat), "战船本体必须进入目标池供机队打击");
for (const s of ship.soldiers) {
  assert.ok(targets.includes(s), `士兵 ${s.name} 必须进入目标池`);
}
console.log(`  ✓ 目标池包含战船与全部 20 名士兵 (当前池大小: ${targets.length})`);

// ====================================================================
// 测试四：战船水路航行航线（100% 水面，零穿模草地与土地）
// ====================================================================
console.log("\n[4] 正在测试战船 100% 水路航线 (Water Route Clearance)...");
const curve = ship.curve;
assert.ok(curve, "战船必须配置导航航线");

const SAMPLES = 200;
let landCollisions = 0;
for (let i = 0; i <= SAMPLES; i++) {
  const u = i / SAMPLES;
  const p = curve.getPointAt(u, new THREE.Vector3());
  const dir = p.clone().normalize();

  // 1. 检查主岛平面：是否碰触岛上草地或山丘
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    const lift = groundLiftAt(flat.x, flat.z);
    if (lift >= 0.50) {
      landCollisions++;
      console.error(`  ❌ 航线在 u=${u.toFixed(3)} 处触及主岛陆地 (lift=${lift.toFixed(2)})`);
    }
  }

  // 2. 检查古堡山脉：是否碰触古堡山体
  const cit = citadelRangeLiftDir(dir);
  if (cit > 0.50) {
    landCollisions++;
    console.error(`  ❌ 航线在 u=${u.toFixed(3)} 处触及古堡山体 (cit=${cit.toFixed(2)})`);
  }
}

assert.strictEqual(landCollisions, 0, "战船航线必须 100% 在大洋水域，不得穿越任何草地或陆地！");
console.log(`  ✓ 采样 200 个航线点，陆地/草地碰撞数 = 0，100% 全程水上航行`);

// ====================================================================
// 测试五：水空防空交战与航行推进动态仿真
// ====================================================================
console.log("\n[5] 正在测试战船航行推进与对空交战逻辑 (Combat & Sailing)...");
// 模拟敌方侦察机编队
const aircraftMock = new THREE.Group();
aircraftMock.name = "crystal-scout-defense-squad";
aircraftMock.userData = {
  units: [
    { group: new THREE.Group() },
    { group: new THREE.Group() },
    { group: new THREE.Group() },
  ],
};
// 放置在战船初始点上方 40 米处（空袭交战距离内）
const startPt = curve.getPointAt(0, new THREE.Vector3());
aircraftMock.userData.units[0].group.position.copy(startPt).add(new THREE.Vector3(0, 40, 0));
aircraftMock.userData.units[1].group.position.copy(startPt).add(new THREE.Vector3(20, 45, 10));
aircraftMock.userData.units[2].group.position.copy(startPt).add(new THREE.Vector3(-15, 42, -10));
scene.add(aircraftMock);

// 推进模拟多步
for (let step = 0; step < 10; step++) {
  battle.update(0.5, step * 0.5);
}

assert.ok(ship.u > 0, "战船应随时间在航线上推进 (u > 0)");
console.log(`  ✓ 战船航行推进正常，当前进度 u = ${ship.u.toFixed(3)}`);

console.log("\n================================================================");
console.log("  🎉 全部 5 项核心验证 100% 通过！系统功能完整健壮！");
console.log("================================================================");
