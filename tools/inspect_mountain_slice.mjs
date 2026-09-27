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
const { buildChristchurchTramSystem } = await import("../TigerMessenger/src/world/tramSystem.js");

const R = 160;
const scene = new THREE.Scene();
const sys = buildChristchurchTramSystem(scene, R);
const curve = sys.curve;

console.log("=== Sampling tram curve through Citadel region ===");
// Let's sample the curve where it interacts with Citadel
const N = 720;
for (let i = 0; i < N; i++) {
  const u = i / N;
  const p = curve.getPointAt(u);
  const dir = p.clone().normalize();
  const cit = Math.max(citadelRangeLiftDir(dir), citadelWalkLiftDir?.(dir) || 0);
  if (cit > 0.05) {
    const trackH = p.length() - R;
    const underground = cit - trackH;
    const lat = Math.asin(dir.y) * 180 / Math.PI;
    const lon = Math.atan2(dir.z, dir.x) * 180 / Math.PI;
    console.log(`u=${u.toFixed(3)}: lat=${lat.toFixed(1)}° lon=${lon.toFixed(1)}° | groundLift=${cit.toFixed(2)}m, trackLift=${trackH.toFixed(2)}m | underground=${underground.toFixed(2)}m`);
  }
}
