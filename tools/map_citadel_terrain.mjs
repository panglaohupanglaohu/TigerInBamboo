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
const { citadelRangeLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");

console.log("=== Citadel Terrain Contour Map ===");
// Lat: from 14 to 34 (step 2)
// Lon: from 16 to 56 (step 4)
console.log("Lat \\ Lon | " + Array.from({length: 11}, (_, i) => (16 + i * 4).toString().padStart(5)).join(" "));
console.log("-".repeat(75));

for (let lat = 34; lat >= 14; lat -= 2) {
  let row = `${lat.toString().padStart(3)}°     | `;
  for (let lon = 16; lon <= 56; lon += 4) {
    const dir = latLonToDir(lat, lon);
    const lift = citadelRangeLiftDir(dir);
    row += lift.toFixed(1).padStart(5) + " ";
  }
  console.log(row);
}

