// =====================================================================
// 固定容量灯池验收（2026-09-02）：
//   · 场景可见灯数恒定 = capacity（灯数变化会触发 Three 全材质重编译）；
//   · 被接管的真实点光永久 visible=false，仅作数据源；
//   · 池灯追随「亮且近」的逻辑灯，随相机移动改选；
//   · 空槽 intensity=0 但仍 visible=true；
//   · dispose 还原所有被接管灯的原始 visible。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createLightPool } = await import(new URL("src/render/lighting/lightPool.js", BASE).href);

const countVisibleLights = (scene) => {
  let n = 0;
  scene.traverse((o) => { if (o.isLight && o.visible) n++; });
  return n;
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 0, 0);

// 20 盏灯排成一条线：距离越远越次要
const lamps = [];
for (let i = 0; i < 20; i++) {
  const lamp = new THREE.PointLight(0xffaa00, 1, 8, 2);
  lamp.position.set(0, 0, (i + 1) * 10);
  lamp.name = `lamp-${i}`;
  scene.add(lamp);
  lamps.push(lamp);
}
const preHidden = new THREE.PointLight(0xff0000, 2, 5, 2);
preHidden.visible = false; // 别人主动隐藏的灯，dispose 后必须还是隐藏
scene.add(preHidden);

const pool = createLightPool({ scene, getCamera: () => camera, capacity: 4, interval: 0 });

// 1. 接管：真实灯全部隐藏，只剩 capacity 盏池灯可见
assert.equal(pool.adoptedCount, 20, "原本就隐藏的灯不参与竞选");
assert.equal(countVisibleLights(scene), 4, "可见灯数应等于 capacity");
assert.ok(lamps.every((l) => l.visible === false), "被接管的真实灯必须隐藏");

// 2. 池灯落到最近的 4 盏灯位置上
pool.update(1);
assert.equal(pool.activeCount, 4);
const poolLights = [];
scene.traverse((o) => { if (o.userData.isLightPool) poolLights.push(o); });
const zs = poolLights.map((l) => l.position.z).sort((a, b) => a - b);
assert.deepEqual(zs, [10, 20, 30, 40], "应选中最近的 4 盏灯");

// 3. 相机移动后改选，且可见灯数不变（不变才不会重编译）
camera.position.set(0, 0, 200);
pool.update(1);
assert.equal(countVisibleLights(scene), 4, "改选后可见灯数必须恒定");
const zs2 = poolLights.map((l) => l.position.z).sort((a, b) => a - b);
assert.deepEqual(zs2, [170, 180, 190, 200], "应改选相机附近的灯");

// 4. 亮度优先于距离：远处一盏超亮灯应挤掉近处暗灯
lamps[19].intensity = 500; // z=200，就在相机上；把它挪远再加亮
lamps[19].position.set(0, 0, 400);
pool.update(1);
assert.ok(
  poolLights.some((l) => l.position.z === 400),
  "超亮的远灯应入选（评分 = intensity / (1 + d²)）",
);

// 5. 逻辑灯全灭时：空槽 intensity=0 但仍 visible=true
for (const lamp of lamps) lamp.intensity = 0;
pool.update(1);
assert.equal(pool.activeCount, 0, "无可用灯时活跃数为 0");
assert.equal(countVisibleLights(scene), 4, "空槽仍须 visible=true，否则灯数变化触发重编译");
assert.ok(poolLights.every((l) => l.intensity === 0), "空槽强度应为 0");

// 6. 运行时开关：关掉后还原真实灯并撤下池灯，重开后恢复接管
for (const lamp of lamps) lamp.intensity = 1;
pool.setEnabled(false);
assert.equal(pool.enabled, false);
assert.equal(countVisibleLights(scene), 20, "关掉后应回到原始 20 盏真实灯");
assert.equal(preHidden.visible, false, "关掉后不得点亮原本隐藏的灯");
pool.setEnabled(true);
assert.equal(countVisibleLights(scene), 4, "重开后应回到 capacity 盏");

// 7. dispose 还原原始可见性
pool.dispose();
assert.ok(lamps.every((l) => l.visible === true), "dispose 应还原被接管灯");
assert.equal(preHidden.visible, false, "原本就隐藏的灯不得被点亮");
assert.equal(countVisibleLights(scene), 20, "池灯应已移出场景");

// 8. 接线检查：main.js 必须逐帧驱动，且与 idleLightCulling 二选一
const mainSrc = fs.readFileSync(fileURLToPath(new URL("../TigerMessenger/src/main.js", import.meta.url)), "utf8");
assert.match(mainSrc, /lightPool\?\.update\(dt\)/, "main.js 未逐帧更新灯池");
assert.match(mainSrc, /const idleLightCulling = lightPool \|\|/, "两者会争抢 visible，必须互斥");

console.log("✅ test_light_pool");
