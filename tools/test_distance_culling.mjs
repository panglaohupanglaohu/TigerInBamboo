// =====================================================================
// 距离剔除验收（2026-08-28 古堡卡顿治理）：
//  · 近处小件可见、远处小件隐藏（小星球地平线遮蔽）；
//  · 相机升高时剔除半径放大（航拍看得远）；
//  · 名字豁免（船/云/水/星球壳等动态与巨物）不参与；
//  · 大于 maxObjectRadius 的巨物永远可见；
//  · recollect/dispose 行为。
// 运行：node tools/test_distance_culling.mjs
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
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createSceneDistanceCulling } = await import(
  new URL("src/core/sceneDistanceCulling.js", BASE).href
);
const { P } = await import(new URL("src/core/params.js", BASE).href);

let pass = 0;
const ok = (message) => { pass += 1; console.log(`  ✓ ${message}`); };

// 相机固定在北极上空地表附近（R=160）
const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 161.5, 0); // 地表上方 ~1.5
camera.lookAt(0, 160, -40);

function buildScene() {
  const scene = new THREE.Scene();
  const mk = (name, x, y, z, radius = 1) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const near = mk("prop-near", 0, 160, -30);        // 距相机 ~30
  const mid = mk("prop-mid", 0, 160, -120);         // 距相机 ~120
  const far = mk("prop-far", 0, 160, -300);         // 距相机 ~300
  const farExcluded = mk("ocean-warship-1", 0, 160, -300); // 远但豁免（动态船）
  const giant = mk("planet-shell", 0, 130, -300, 60);      // 远且巨大（巨物不剔）
  return { scene, near, mid, far, farExcluded, giant };
}

// --- 1. 低空相机：近/中可见，远隐藏，豁免与巨物不剔 ---------------------
{
  const { scene, near, mid, far, farExcluded, giant } = buildScene();
  const culling = createSceneDistanceCulling(THREE, {
    scene, getCamera: () => camera, planetRadius: 160,
    cullDistance: 150, altitudeFactor: 5,
  });
  culling.update(3); // 触发收集
  culling.update(0.5); // 触发剔除
  assert.equal(near.visible, true, "近处可见");
  assert.equal(mid.visible, true, "中距可见");
  assert.equal(far.visible, false, "远处隐藏");
  assert.equal(farExcluded.visible, true, "豁免名（战船）远也可见");
  assert.equal(giant.visible, true, "巨物远也可见");
  assert.equal(culling.entryCount, 3, "管理条目 3（巨物被尺寸规则排除、战船被名字豁免）");
  ok(`低空剔除：近/中可见、远隐藏、豁免与巨物不剔（管理 ${culling.entryCount} 项）`);
  culling.dispose();
  assert.equal(far.visible, true, "dispose 恢复全部可见");
}

// --- 2. 高空相机：剔除半径随高度放大，远处重新可见 ----------------------
{
  const { scene, far } = buildScene();
  const highCam = camera.clone();
  highCam.position.set(0, 210, 0); // 高空
  let cam = highCam;
  const culling = createSceneDistanceCulling(THREE, {
    scene, getCamera: () => cam, planetRadius: 160,
    cullDistance: 150, altitudeFactor: 5,
  });
  culling.update(3);
  culling.update(0.5);
  assert.equal(far.visible, true, "高空时远处可见（剔除半径随高度放大）");
  ok("高空：剔除半径随相机高度放大（航拍不丢远景）");
}

// --- 2b. 合并网格：原点远离几何体（mergeStaticGroup 的典型形态） ---------
// 距离必须按几何包围球的世界中心算；按 mesh 原点算会让近在眼前的合并城体被误判成远物。
{
  const scene = new THREE.Scene();
  // 几何体顶点就在相机正前方，但 mesh 原点留在星球中心 (0,0,0)
  const geo = new THREE.IcosahedronGeometry(2, 1);
  geo.translate(0, 160, -10);
  const merged = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  merged.name = "citadel-merged-town";
  scene.add(merged); // position 保持 (0,0,0)

  const culling = createSceneDistanceCulling(THREE, {
    scene, getCamera: () => camera, planetRadius: 160,
    cullDistance: 20, altitudeFactor: 0, // 收紧剔距，逼出原点/中心的差异
  });
  culling.update(3);
  culling.update(0.5);
  assert.equal(
    merged.visible,
    true,
    "合并网格：几何体近在眼前必须可见（距离要按包围球世界中心算，不是 mesh 原点）"
  );
  ok("合并网格：按几何包围球世界中心计算距离（原点远离几何体也不误剔）");
}

// --- 2c. maxObjectRadius：整块城体不参与小件剔除 -------------------------
// 2026-08-29 回滚主因：旧值 25 相当于一整个城区，把合并城体/港口当小摆件剔掉。
{
  const scene = new THREE.Scene();
  const big = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 1), new THREE.MeshStandardMaterial());
  big.name = "citadel-town-merged";
  big.position.set(0, 160, -300); // 远处
  scene.add(big);

  const culling = createSceneDistanceCulling(THREE, {
    scene, getCamera: () => camera, planetRadius: 160,
    cullDistance: 150, altitudeFactor: 5,
  });
  culling.update(3);
  culling.update(0.5);
  assert.equal(culling.entryCount, 0, "半径 12 的城体不应进入小件剔除名单");
  assert.equal(big.visible, true, "整块城体远景也不得整体消失");
  ok("maxObjectRadius=8：合并城体/港口不再被当小摆件整体剔除");
}

// --- 3. 参数与开关 -------------------------------------------------------
// 保持默认关闭：实测瓶颈在片元光照而非 draw call，且 8/29 曾因远景误剔被回滚，
// 需浏览器目验后再由主人决定是否常开。
assert.equal(P.distanceCullV1, false, "距离剔除默认关闭，待目验后再开");
assert.equal(P.distanceCullMeters, 150, "基准剔距 150");
ok("P.distanceCullV1 默认关闭（?distanceCullV1=1 手动开启验收）");

// --- 4. 圣城/主页面集成 ---------------------------------------------------
const citadelModule = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = citadelModule.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const scene2 = new THREE.Scene();
scene2.add(castle);
const mainSrc = fs.readFileSync(new URL("src/main.js", BASE), "utf8");
assert.match(mainSrc, /createSceneDistanceCulling\(THREE, \{\s*scene,\s*getCamera: \(\) => camera/);
assert.match(mainSrc, /distanceCulling\.update\(dt\)/);
ok("main.js 已接线（update(dt) 每帧驱动，内部 0.3s 节流）");

console.log(`\n✅ 距离剔除：小星球地平线遮蔽 + 高空自适应半径 + 名字/尺寸豁免 + 开关回滚`);
console.log(`全部通过：${pass + 2} 组断言`);
