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
  const { group, update } = buildEcoLeviathanIsland({ seed: 9901 });
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
  assert(Math.abs(plate.position.y - LEVIATHAN_PLATE_Y) < 1e-6, "地壳板 Y 锁死 6.08");
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

console.log(`\n结果：${pass}/2 组验收通过`);
