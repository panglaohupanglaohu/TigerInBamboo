// R=160 专项几何验收：只读构造，不启动浏览器主循环。
const BASE = "file:///Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/";
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const el = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => el(),
  querySelectorAll: () => [],
});
const canvas = () => {
  const e = el();
  e.width = e.height = 64;
  e.getContext = () => new Proxy({}, { get: (_t, k) =>
    k === "measureText" ? () => ({ width: 6 }) :
    k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) :
    k === "getImageData" || k === "createImageData" ? (_x, _y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w || 1) * (h || 1) * 4)), width: w || 1, height: h || 1 }) :
    () => {} });
  e.toDataURL = () => "";
  return e;
};
globalThis.document = {
  createElement: (t) => String(t).toLowerCase() === "canvas" ? canvas() : el(),
  createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? canvas() : el(),
  getElementById: () => el(),
  querySelector: () => el(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const THREE = await import(BASE + "vendor/three.module.js");
const { BASE_WORLD_RADIUS, WORLD_SCALE, WORLD_RADIUS } = await import(BASE + "src/world/worldScale.js");
const { PLANET_RADIUS } = await import(BASE + "src/world/planet.js");
const { CANYON, canyonOffsetDir } = await import(BASE + "src/world/canyon.js");
const { flatToWorld } = await import(BASE + "src/world/sphereMath.js");
const hills = await import(BASE + "src/world/hills.js");
const { worldToFlatXZ } = hills;
const { buildChristchurchTramSystem } = await import(BASE + "src/world/tramSystem.js");
const { buildAbandonedGate, findGateSeatU, GATE, GATE_DEPTH } = await import(BASE + "src/world/abandonedGate.js");
const { createDynamicMoebiusClouds } = await import(BASE + "src/world/equatorialClouds.js");
const { SWAMP_LOCAL_GROUND_Y, SWAMP_WATER_Y, SWAMP_FLOOR_Y, createMoebiusSwampPlacement } = await import(BASE + "src/world/moebiusSwamp.js");
const { CAMERA_HEIGHT, CAMERA_LOOK_Y } = await import(BASE + "src/core/constants.js");

const R = WORLD_RADIUS;
let failures = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const bad = (message) => { console.log(`  ✗ ${message}`); failures++; };
const assert = (condition, message) => condition ? ok(message) : bad(message);

console.log("[1] 统一世界尺度");
assert(BASE_WORLD_RADIUS === 40 && WORLD_SCALE === 4 && WORLD_RADIUS === 160, "BASE=40 / SCALE=4 / WORLD=160");
assert(PLANET_RADIUS === R, `PLANET_RADIUS=${PLANET_RADIUS}`);
assert(CANYON.depth === 15 * WORLD_SCALE && CANYON.rim === 0.85, "峡谷深度按 WORLD_SCALE 派生，rim 仍为角度量 0.85");
assert(hills.ISLAND_FLAT_R === 18 * WORLD_SCALE, "主岛平面足迹按 WORLD_SCALE 派生");
const roundTrip = worldToFlatXZ(flatToWorld(18 * WORLD_SCALE, 0, 0, R), R);
assert(roundTrip && Math.abs(roundTrip.x - 18 * WORLD_SCALE) < 0.05, "主岛边界平面坐标在目标 R 下保持角覆盖");
assert(Math.abs(2 * CANYON.rim * R - 2 * CANYON.rim * WORLD_RADIUS) < 1e-6, "峡谷世界宽度按目标半径派生");

console.log("[2] 轨道钝角与无折返");
const scene = new THREE.Scene();
const tram = buildChristchurchTramSystem(scene, R, {});
const curve = tram.curve;
const length = curve.getLength();
let maxTurn = 0;
let minForwardDot = 1;
const ta = new THREE.Vector3();
const tb = new THREE.Vector3();
for (let s = 0; s < length; s += 1) {
  const u = ((s / length) % 1 + 1) % 1;
  const un = (((s + 1) / length) % 1 + 1) % 1;
  curve.getTangentAt(u, ta).normalize();
  curve.getTangentAt(un, tb).normalize();
  maxTurn = Math.max(maxTurn, THREE.MathUtils.radToDeg(ta.angleTo(tb)));
  const un6 = (((s + 6) / length) % 1 + 1) % 1;
  curve.getTangentAt(un6, tb).normalize();
  minForwardDot = Math.min(minForwardDot, ta.dot(tb));
}
assert(length > 900, `R=${R} 轨道长度=${length.toFixed(1)}，相对基准世界明显扩大`);
assert(maxTurn <= 28, `单步最大转向=${maxTurn.toFixed(2)}° ≤ 28°`);
assert(minForwardDot > -0.5, `6 单位内无近 180° 掉头（最小切线点积=${minForwardDot.toFixed(3)}）`);

console.log("[3] 城门直穿、无台基、整体下沉");
const gate = buildAbandonedGate({ curve, planetRadius: R });
const seatU = findGateSeatU(curve, R);
assert(Math.abs(gate.userData.anchor.gateU - seatU) < 1e-9, "城门使用真实轨道直段选点");
assert(!gate.children.some((o) => o.name === "gate-lawn"), "无 gate-lawn 水泥台");
const p0 = curve.getPointAt(gate.userData.anchor.gateU, new THREE.Vector3());
const fwd = curve.getTangentAt(gate.userData.anchor.gateU, new THREE.Vector3()).normalize();
const up = p0.clone().normalize();
const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
let gateDev = 0;
for (let d = -GATE_DEPTH / 2; d <= GATE_DEPTH / 2; d += 0.25) {
  const p = curve.getPointAt((((gate.userData.anchor.gateS + d) / length) % 1 + 1) % 1, new THREE.Vector3());
  gateDev = Math.max(gateDev, Math.abs(p.sub(p0).dot(right)));
}
const maxAllowedDev = GATE.passHalf - 1.503 - 0.3;
assert(gateDev <= maxAllowedDev, `门长范围内横向偏离=${gateDev.toFixed(3)} ≤ ${maxAllowedDev.toFixed(2)}`);
assert(gate.userData.sink > 0, `城门整体下沉 sink=${gate.userData.sink.toFixed(2)}`);
const gateHeight = gate.userData.metrics?.totalHeight;
assert(
  Math.abs(gateHeight - (GATE.wallTop + GATE.plinthH)) < 1e-6 &&
    GATE.passHalf * 2 === 6 &&
    gateHeight < WORLD_RADIUS / 2,
  `门总高 ${gateHeight?.toFixed(1)}、净宽 6.0，局部门体未随 R 放大`
);

console.log("[4] 云墙/云盖局部尺寸与锚点");
const clouds = createDynamicMoebiusClouds(scene, R, {
  trackCurve: curve,
  anchorU: seatU,
  crownY: GATE.wallTop,
  spanX: GATE_DEPTH,
});
const towers = clouds.userData.towers || [];
assert(towers.length === 1, "云盖仅生成门顶 1 座六线云塔");
const expectedCloudRadius = R + GATE.wallTop;
let maxRadialError = 0;
for (const tower of towers) {
  const radial = tower.position.dot(up);
  maxRadialError = Math.max(maxRadialError, Math.abs(radial - expectedCloudRadius));
}
const cloudX = new THREE.Vector3(1, 0, 0).applyQuaternion(towers[0].quaternion);
const trackFwd = curve.getTangentAt(seatU, new THREE.Vector3()).normalize();
const trackRight = new THREE.Vector3().crossVectors(up, trackFwd).normalize();
assert(
  maxRadialError < 1 && Math.abs(cloudX.dot(trackRight)) > 0.9,
  `云盖径向半径误差=${maxRadialError.toFixed(2)}、横跨轨道方向一致，保持门顶局部对齐`
);
assert(towers.every((tower) => tower.scale.x < 1.3), "云塔局部 scale 未因世界半径翻倍");

console.log("[5] 湖沼局部基准、玩家局部参数");
assert(SWAMP_LOCAL_GROUND_Y === 40 && SWAMP_WATER_Y === 25 && SWAMP_FLOOR_Y === 10, "湖沼局部 Y=40/25/10 保持，不机械改为 80");
const swamp = createMoebiusSwampPlacement({ scale: 0.5, seed: 7711 });
assert(swamp.userData.inner.position.y === -SWAMP_LOCAL_GROUND_Y, "湖沼包装仍以局部地面基准对齐原点");
assert(swamp.scale.x === 0.5, "湖沼包装 scale=0.5，局部生态资产保持原尺寸");
assert(CAMERA_HEIGHT === 3.2 && CAMERA_LOOK_Y === 1.1, "相机局部高度/观察点未随 R 放大");

console.log(failures === 0 ? "全部通过：R=160 专项断言" : `失败 ${failures} 项`);
if (failures) process.exitCode = 1;
