import { createRequire } from "module";
import * as THREE from "../TigerMessenger/vendor/three.module.js";
import { latLonToDir } from "../TigerMessenger/src/world/sphereMath.js";

// node 直跑需要 DOM 桩：运河水面 bump 贴图（getWaterBumpTexture）用 canvas 2D 生成，
// 与 test_citadel_range.mjs / test_townscaper_support.mjs 同一套空桩。
if (!globalThis.document) {
  const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
  globalThis.document = { getElementById: el, querySelector: el, createElement: el };
  globalThis.document.createElement = (tag) => {
    if (tag === "canvas") {
      const ctx2d = new Proxy({}, {
        get(t, k) {
          if (k === "canvas") return { width: 256, height: 256 };
          if (k === "createLinearGradient" || k === "createRadialGradient") {
            return () => ({ addColorStop() {} });
          }
          if (k === "measureText") return () => ({ width: 0 });
          if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
          if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
          return typeof k === "string" ? () => {} : undefined;
        },
      });
      return { width: 256, height: 256, getContext: () => ctx2d };
    }
    return el();
  };
}

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
assert(scene.getObjectByName("canal-wall-L") && scene.getObjectByName("canal-wall-R"), "左右立壁存在");
assert(scene.getObjectByName("canal-lip-L") && scene.getObjectByName("canal-lip-R"), "两岸土埂存在");

// 地面沟：河床应略高于实心球面（可见），不是埋进球心
let allOnSurface = true;
let minR = Infinity, maxR = -Infinity;
for (const p of canal.curve.getPoints(200)) {
  const r = p.length();
  minR = Math.min(minR, r);
  maxR = Math.max(maxR, r);
  // 河床曲线应贴近地表（R ~ R+0.2），绝不深埋
  if (r < R - 0.01 || r > R + 1.0) allOnSurface = false;
}
assert(allOnSurface, `河床贴地（minR=${minR.toFixed(2)}, maxR=${maxR.toFixed(2)}, R=${R}）`);
assert(canal.bedR > R, `河床半径 bedR=${canal.bedR.toFixed(3)} > R（略抬防遮挡）`);
assert(canal.waterR > canal.bedR, `水面高于河床（waterR=${canal.waterR.toFixed(3)} > bedR）`);
assert(canal.lipR > canal.waterR, `岸顶高于水面（lipR=${canal.lipR.toFixed(3)}）`);
assert(Math.abs(canal.depth - CANAL_DEPTH) < 1e-6, `沟深 = CANAL_DEPTH(${CANAL_DEPTH})`);
assert(canal.depth < 2.5, `沟深是地面浅沟而非地下隧道（depth=${canal.depth}）`);

// 水面几何有足够顶点
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
