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
const { buildOdysseyCitadel } = await import("../TigerMessenger/src/world/odysseyCitadel.js");
const { citadelSiteDir, citadelRangeLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");

const R = 160;
const citadelDir = citadelSiteDir(new THREE.Vector3());
const castle = buildOdysseyCitadel({
  dir: citadelDir,
  groundRadius: R + citadelRangeLiftDir(citadelDir),
  planetRadius: R,
  seed: 20260808,
  latestDesign: true,
});

castle.updateMatrixWorld(true);

function reportObject(name) {
  const obj = castle.getObjectByName(name);
  if (!obj) {
    console.log(`Object ${name}: NOT FOUND`);
    return;
  }
  const pos = new THREE.Vector3();
  obj.getWorldPosition(pos);
  const dir = pos.clone().normalize();
  const lat = Math.asin(dir.y) * 180 / Math.PI;
  const lon = Math.atan2(dir.z, dir.x) * 180 / Math.PI;
  const h = pos.length() - R;
  console.log(`${name}: pos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}), lat=${lat.toFixed(2)}°, lon=${lon.toFixed(2)}°, heightAboveR=${h.toFixed(2)}m`);
}

console.log("=== Citadel Key Landmarks ===");
reportObject("odyssey-citadel");
reportObject("highland-west-city");
reportObject("citadel-trojan-horse");
reportObject("town-terrace-0-level-0");
reportObject("town-terrace-4-level-0");
reportObject("citadel-oskar-grid-mountain-surface");
