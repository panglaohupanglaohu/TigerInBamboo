
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, textContent: "", innerHTML: "", hidden: true, dataset: {}, value: "", appendChild() {}, append(...a) {}, addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, querySelector: () => stubEl(), querySelectorAll: () => [], getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {}, measureText: () => ({ width: 10 }) }) });
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: (cb) => setTimeout(() => cb(0), 0), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { body: stubEl(), documentElement: stubEl(), createElement: () => stubEl(), createElementNS: () => stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { buildChristchurchTramSystem } = await import("../TigerMessenger/src/world/temp_tram_system.js");
const { buildOdysseyCitadel } = await import("../TigerMessenger/src/world/odysseyCitadel.js");
const { citadelSiteDir, citadelRangeLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");
const { carveCitadelMountainForTram } = await import("../TigerMessenger/src/scenes/messenger/loadCitadel.js");

const R = 160;
const scene = new THREE.Scene();
const sys = buildChristchurchTramSystem(scene, R);
const culverts = sys.group.children.filter(c => c.name.startsWith("tram-culvert"));
console.log("Culverts count:", culverts.length);
culverts.forEach((c, idx) => {
  const vault = c.children.find(ch => ch.isMesh && ch.geometry.type === "BufferGeometry");
  const lamps = c.children.filter(ch => ch.isMesh && ch.geometry.type === "SphereGeometry");
  const portals = c.children.filter(ch => ch.isGroup);
  console.log(" ", c.name, ": portals=", portals.length, "lamps=", lamps.length, "vault vertices=", vault.geometry.attributes.position.count);
});

// Check min angle
const curve = sys.curve;
const L = curve.getLength();
const stepDist = 2.0;
const chordDist = 6.0;
const steps = Math.floor(L / stepDist);
let minAngle = 180, minPos = null, rightCount = 0, acuteCount = 0;
for (let i = 0; i < steps; i++) {
  const dist = i * stepDist;
  const u = dist / L;
  const uPrev = (((dist - chordDist) % L) + L) % L / L;
  const uNext = ((dist + chordDist) % L) / L;
  const cur = curve.getPointAt(u);
  const prev = curve.getPointAt(uPrev);
  const next = curve.getPointAt(uNext);
  const v1 = cur.clone().sub(prev).normalize();
  const v2 = next.clone().sub(cur).normalize();
  const dot = THREE.MathUtils.clamp(v1.dot(v2), -1, 1);
  const cornerAngle = 180 - Math.acos(dot) * (180 / Math.PI);
  if (cornerAngle < minAngle) { minAngle = cornerAngle; minPos = cur; }
  if (cornerAngle <= 100) rightCount++;
  if (cornerAngle < 85) acuteCount++;
}
const dir = minPos.clone().normalize();
console.log("Min angle:", minAngle.toFixed(1) + "° at lat=" + (Math.asin(dir.y)*180/Math.PI).toFixed(1) + " lon=" + (Math.atan2(dir.z, dir.x)*180/Math.PI).toFixed(1));
console.log("Right angles:", rightCount, "Acute angles:", acuteCount);

// Check mountain carving
const citadelDir = citadelSiteDir(new THREE.Vector3());
const castle = buildOdysseyCitadel({ dir: citadelDir, groundRadius: R + citadelRangeLiftDir(citadelDir), planetRadius: R, seed: 20260808, latestDesign: true });
castle.updateMatrixWorld(true);
carveCitadelMountainForTram(castle, curve, R);
const mountain = castle.getObjectByName("citadel-oskar-grid-mountain-surface");
const pos = mountain.geometry.attributes.position;
const trackPts = curve.getPoints(720);
const pWorld = new THREE.Vector3();
let intrudingCount = 0;
for (let i = 0; i < pos.count; i++) {
  pWorld.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mountain.matrixWorld);
  let minD = Infinity, nearestPt = null;
  for (const tp of trackPts) {
    const d = tp.distanceTo(pWorld);
    if (d < minD) { minD = d; nearestPt = tp; }
  }
  if (minD < 2.4 && nearestPt) {
    if (pWorld.length() > nearestPt.length()) intrudingCount++;
  }
}
console.log("Intruding vertices:", intrudingCount);
