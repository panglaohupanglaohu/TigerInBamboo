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
const { citadelSiteDir, citadelRangeLiftDir, citadelWalkLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");
const { latLonToDir } = await import("../TigerMessenger/src/world/sphereMath.js");

const R = 160;
const citadelDir = citadelSiteDir(new THREE.Vector3());
const castle = buildOdysseyCitadel({
  dir: citadelDir,
  groundRadius: R + citadelRangeLiftDir(citadelDir),
  planetRadius: R,
  seed: 20260808,
  latestDesign: true,
});

const city = castle.getObjectByName('highland-west-city');
console.log("highland-west-city local pos:", city.position);
const cityWorld = new THREE.Vector3();
city.getWorldPosition(cityWorld);
console.log("highland-west-city world pos:", cityWorld);
const dir = cityWorld.clone().normalize();
const lat = Math.asin(dir.y) * 180 / Math.PI;
const lon = Math.atan2(dir.z, dir.x) * 180 / Math.PI;
console.log(`highland-west-city: lat=${lat.toFixed(2)}°, lon=${lon.toFixed(2)}°`);

// Now let's check the outward normal / seaward direction from the city:
// The city is on the coast. In front of it is the ocean!
// Let's test points offset seaward from the city by 10m, 15m, 20m:
// What direction is seaward?
console.log("\n=== Checking seaward directions from Front Harbor ===");
for (let dLat = -15; dLat <= 5; dLat += 2) {
  for (let dLon = -15; dLon <= 5; dLon += 2) {
    const testLat = lat + dLat;
    const testLon = lon + dLon;
    const p = latLonToDir(testLat, testLon);
    const lift = Math.max(citadelRangeLiftDir(p), citadelWalkLiftDir ? citadelWalkLiftDir(p) : 0);
    if (lift < 0.1) {
      // In open water!
      const dist = p.clone().multiplyScalar(R).distanceTo(cityWorld);
      if (dist >= 10 && dist <= 35) {
        console.log(`Seaward Water: lat=${testLat.toFixed(1)}°, lon=${testLon.toFixed(1)}° | dist to city=${dist.toFixed(1)}m, lift=${lift.toFixed(2)}m`);
      }
    }
  }
}

