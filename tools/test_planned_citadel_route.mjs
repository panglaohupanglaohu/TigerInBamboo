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
const { latLonToDir } = await import("../TigerMessenger/src/world/sphereMath.js");
const { citadelRangeLiftDir, citadelWalkLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");

const R = 160;

// Let's test a planned route at Citadel:
// Approaches from East Sea:
// (12, 78) -> (17, 60) -> (18.5, 46) (East harbor approach viaduct)
// (18.2, 38) (Ridge East Portal entry)
// (17.8, 32) (Ridge West Portal exit) -> length ~ 16m!
// (18.5, 26) (Citadel Front Harbor Station - seaside viaduct overlooking quay and castle)
// (16.5, 18) (Leaving Front Harbor southwest onto ocean viaduct)
// (10, 14) (Sweeping arc over open sea)
// ...

const candidateCitadelPoints = [
  latLonToDir(12, 78).multiplyScalar(R + 0.3),   // 东海引桥
  latLonToDir(16, 62).multiplyScalar(R + 0.3),   // 圣城东海进港引桥
  latLonToDir(18.2, 48).multiplyScalar(R + 0.3), // 圣城东外海高架
  latLonToDir(18.5, 38.5).multiplyScalar(R + 0.5), // 崖口涵洞东门（穿南岬角短涵洞）
  latLonToDir(18.2, 32.5).multiplyScalar(R + 0.5), // 崖口涵洞西门（破洞而出，面朝前港）
  latLonToDir(19.5, 24.5).multiplyScalar(R + 0.6), // 高山圣城前港车站（崖前海景站台，平视港口与城堡）
  latLonToDir(17.5, 16.0).multiplyScalar(R + 0.3), // 离港西南高架
  latLonToDir(11.0, 11.0).multiplyScalar(R + 0.3), // 西南大洋平缓钝角转弯
];

console.log("=== Checking waypoints corner angles ===");
let minCorner = 180;
for (let i = 1; i < candidateCitadelPoints.length - 1; i++) {
  const v1 = candidateCitadelPoints[i].clone().sub(candidateCitadelPoints[i-1]).normalize();
  const v2 = candidateCitadelPoints[i+1].clone().sub(candidateCitadelPoints[i]).normalize();
  const dot = THREE.MathUtils.clamp(v1.dot(v2), -1, 1);
  const defl = Math.acos(dot) * 180 / Math.PI;
  const corner = 180 - defl;
  if (corner < minCorner) minCorner = corner;
  console.log(`[${i}]: deflection=${defl.toFixed(1)}°, corner=${corner.toFixed(1)}°`);
}
console.log(`Min corner: ${minCorner.toFixed(1)}°`);

// Now let's test a CatmullRom through this and measure underground length
const curve = new THREE.CatmullRomCurve3(candidateCitadelPoints, false, "centripetal", 0.5);
const L = curve.getLength();
console.log(`Route segment length: ${L.toFixed(1)}m`);
let undergroundCount = 0;
let maxUnderground = 0;
const N = 200;
let tunnelStart = -1, tunnelEnd = -1;
for (let i = 0; i <= N; i++) {
  const p = curve.getPoint(i / N);
  const dir = p.clone().normalize();
  const cit = Math.max(citadelRangeLiftDir(dir), citadelWalkLiftDir ? citadelWalkLiftDir(dir) : 0);
  const trackH = p.length() - R;
  const diff = cit - trackH;
  if (diff > 0.08) {
    undergroundCount++;
    if (tunnelStart < 0) tunnelStart = i;
    tunnelEnd = i;
    if (diff > maxUnderground) maxUnderground = diff;
  }
}
const tunnelLength = tunnelStart >= 0 ? ((tunnelEnd - tunnelStart) / N) * L : 0;
console.log(`Underground tunnel length: ${tunnelLength.toFixed(1)}m (Previous was 86m!)`);
console.log(`Max underground depth: ${maxUnderground.toFixed(2)}m (Previous was 8.93m!)`);

