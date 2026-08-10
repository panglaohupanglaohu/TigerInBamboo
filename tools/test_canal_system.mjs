import { createRequire } from "module";
import * as THREE from "../TigerMessenger/vendor/three.module.js";
import { latLonToDir } from "../TigerMessenger/src/world/sphereMath.js";
import { CANAL_DEPTH, buildWorldCanal } from "../TigerMessenger/src/world/canalSystem.js";
import { PLANET_RADIUS } from "../TigerMessenger/src/world/planet.js";

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log("  ok -", msg); }
  else { fail++; console.log("  FAIL -", msg); }
};

const R = PLANET_RADIUS;
const scene = new THREE.Scene();
// 模拟各场景方向（与 messengerIsland 相近的锚点）
const anchors = [
  latLonToDir(24.1, 36.05),  // 高山圣城
  latLonToDir(-24, -112),     // 白鲸海湖/水晶城
  latLonToDir(-50, -112),     // 叹息之门/峡谷
  latLonToDir(58, -150),      // 西芳寺苔庭
];
const canal = buildWorldCanal(scene, R, { anchors, names: ["圣城", "海湖", "门", "苔庭"] });

assert(canal.group?.isGroup, "运河组存在");
assert(canal.group.name === "world-canal", "运河组命名");
assert(canal.curve && typeof canal.curve.getPointAt === "function", "闭合路径曲线存在");
assert(canal.curve.closed === true, "路径是闭合环");
assert(canal.curve.getPoints(64).length > 30, "路径采样点充足");
assert(canal.sinks.length === anchors.length, `登岸湾数量 = 场景数(${anchors.length})`);
assert(scene.getObjectByName("canal-water"), "运河水面存在");
assert(scene.getObjectByName("canal-bed"), "运河河床存在");
assert(scene.getObjectByName("canal-banks"), "运河堤壁存在");

// 路径必须沉到地表以下（径向 < R）
let allSunk = true;
let minR = Infinity, maxR = -Infinity;
for (const p of canal.curve.getPoints(200)) {
  const r = p.length();
  minR = Math.min(minR, r);
  maxR = Math.max(maxR, r);
  if (r >= R - 0.01) allSunk = false;
}
assert(allSunk, `整条运河沉到地表以下（maxR=${maxR.toFixed(2)} < R=${R}）`);
assert(minR > R - CANAL_DEPTH - 3, `河道不深过河床+余量（minR=${minR.toFixed(2)}）`);

// 水面在河床上方（比河床径向高 WATER_LIFT）
const water = scene.getObjectByName("canal-water");
assert(water?.geometry?.attributes?.position?.count > 100, "水面几何有足够顶点");

// 运河穿过各场景方向（锚点附近有采样点）
let allNear = true;
for (const s of canal.sinks) {
  const d = s.dir.clone().normalize().angleTo(canal.curve.getPointAt(s.u).normalize());
  if (d > 0.5) { allNear = false; console.log("  (near far: ", d.toFixed(3), ")"); }
}
assert(allNear, "运河经过各场景锚点附近");

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
