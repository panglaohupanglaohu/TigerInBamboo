// 水晶城建筑落地验收：建筑站在绿色山丘顶面之上，不得被绿丘/邻阶掩埋
// 运行：node tools/test_moebius_city_ground.mjs
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
const { latLonToDir } = await import(new URL("src/world/sphereMath.js", BASE).href);
const {
  GRAND_CRYSTAL,
  buildMoebiusCrystalMetropolis,
  buildingPlacementOnTerrain,
} = await import(new URL("src/world/moebiusCity.js", BASE).href);

const R = WORLD_RADIUS;
let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 花厅塔参数：丘顶之上 · 更大净空");
const grandDir = latLonToDir(GRAND_CRYSTAL.lat, GRAND_CRYSTAL.lon, new THREE.Vector3());
const place = buildingPlacementOnTerrain(grandDir, GRAND_CRYSTAL.r * 1.15, R, {
  hall: true,
  meshBottomLocal: -0.06,
});
assert(place.hall === true);
assert(place.hillHeight <= 3.6 + 1e-9, `花厅丘高封顶，实际 ${place.hillHeight}`);
assert(place.clearance >= 0.5, "花厅净空须 ≥0.55");
assert(place.root > place.hillCrest, "塔底必须高于丘顶");
// 真实网格底 = root + meshBottomLocal ≥ hillCrest + clearance
const meshBottom = place.root + (-0.06);
assert(meshBottom >= place.hillCrest + place.clearance - 1e-6, "真实塔脚须在丘顶净空之上");
ok(
  `丘高 ${place.hillHeight.toFixed(2)} · 丘顶 ${place.hillCrest.toFixed(2)} · root ${place.root.toFixed(2)} · 脚底 ${meshBottom.toFixed(2)}`
);

console.log("[2] 全城装配：花厅塔网格底不得埋入绿丘");
const scene = new THREE.Scene();
// 简易轨道，逼出沿轨金鳞花厅塔
const pts = [];
for (let i = 0; i <= 24; i++) {
  const t = i / 24;
  const lat = (-48 + t * 40) * (Math.PI / 180);
  const lon = -112 * (Math.PI / 180);
  pts.push(
    new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    ).multiplyScalar(R)
  );
}
const curve = new THREE.CatmullRomCurve3(pts);
const city = buildMoebiusCrystalMetropolis(scene, R, { trackCurve: curve });
city.group.updateMatrixWorld(true);
const halls = city.crystals.filter((c) => c.group?.userData?.bioLayers?.length);
assert(halls.length >= 1, "至少一座花厅塔");
const terraces = [];
city.group.traverse((o) => {
  if (o.name === "moebius-hall-hill-terrace") terraces.push(o);
});
assert(terraces.length >= halls.length, `花厅丘顶圆台 ${terraces.length} < 花厅塔 ${halls.length}`);
for (const c of halls) {
  let minAlong = Infinity;
  c.group.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const wp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += Math.max(1, (pos.count / 30) | 0)) {
      wp.fromBufferAttribute(pos, i);
      o.localToWorld(wp);
      minAlong = Math.min(minAlong, wp.dot(c.dir));
    }
  });
  const p = buildingPlacementOnTerrain(c.dir, c.r * 1.15, R, { hall: true });
  assert(
    minAlong >= p.hillCrest + 0.35,
    `${c.group.name} 仍埋丘内 底=${minAlong.toFixed(2)} 丘顶=${p.hillCrest.toFixed(2)}`
  );
}
ok(`花厅塔×${halls.length} · 丘顶圆台×${terraces.length} · 全员塔脚在丘顶之上`);

console.log(`\n全部通过：${pass} 组验收`);
