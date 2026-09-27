
import assert from "node:assert/strict";

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
  removeItem: () => {}
};

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { buildOdysseyCitadel } = await import("../TigerMessenger/src/world/odysseyCitadel.js");
const { citadelSiteDir, citadelRangeLiftDir, citadelWalkLiftDir } = await import("../TigerMessenger/src/world/citadelRange.js");
const { carveCitadelMountainForTram } = await import("../TigerMessenger/src/scenes/messenger/loadCitadel.js");
const { latLonToDir } = await import("../TigerMessenger/src/world/sphereMath.js");
const { groundLiftAt, worldToFlatXZ, ISLAND_BASE_LIFT } = await import("../TigerMessenger/src/world/hills.js");
const { CANYON, canyonOffsetDir, canyonOffsetDirSmooth } = await import("../TigerMessenger/src/world/canyon.js");
const { toonMat, addOutline } = await import("../TigerMessenger/src/assets/toon.js");
const { facet } = await import("../TigerMessenger/src/assets/lowPoly.js");

const R = 160;
const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _tmpNorm = new THREE.Vector3();

const WORLD_LAYOUT_SCALE = 4.0;
const SURFACE_EPS = 0.08;
const VIADUCT_HEIGHT = 0.3;
const ISLAND_EDGE_DIST = 19.5;

function smooth01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function groundRadiusAt(dir, R) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) return R + groundLiftAt(flat.x, flat.z);
  _tmpNorm.copy(dir).normalize();
  const cit = typeof citadelRangeLiftDir === "function" ? Math.max(citadelRangeLiftDir(_tmpNorm), citadelWalkLiftDir?.(_tmpNorm) || 0) : 0;
  if (cit > 0.05) return R + cit;
  return R + canyonOffsetDir(_tmpNorm);
}

const TRACK_LIFT_CAP = ISLAND_BASE_LIFT + 0.1;
function trackSurfaceRadiusAt(dir, R) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    const dist = Math.hypot(flat.x, flat.z);
    const ground = Math.min(groundLiftAt(flat.x, flat.z), TRACK_LIFT_CAP);
    const w = smooth01((dist - ISLAND_EDGE_DIST) / 2.2);
    const edgeLevel = ISLAND_BASE_LIFT + SURFACE_EPS;
    return R + Math.max(
      ground + SURFACE_EPS,
      THREE.MathUtils.lerp(edgeLevel, VIADUCT_HEIGHT, w)
    );
  }
  const drop = canyonOffsetDirSmooth(dir);
  return R + Math.min(VIADUCT_HEIGHT, drop + 3.55);
}

function surfacePoint(dir, R, out = new THREE.Vector3()) {
  const authoredRadius = dir.length();
  out.copy(dir).normalize();
  const radius = Math.max(authoredRadius, trackSurfaceRadiusAt(out, R));
  return out.multiplyScalar(radius);
}

function trackFloorRadiusAt(dir, R) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    const dist = Math.hypot(flat.x, flat.z);
    const w = smooth01((dist - ISLAND_EDGE_DIST) / 2.2);
    return R + THREE.MathUtils.lerp(SURFACE_EPS, VIADUCT_HEIGHT, w);
  }
  const drop = canyonOffsetDirSmooth(dir);
  return R + Math.min(VIADUCT_HEIGHT, drop + 3.55);
}

function surfacePointFromFlat(x, z, R, out) {
  const rFlat = Math.hypot(x, z);
  const ang = rFlat / R;
  const y = R * Math.cos(ang);
  const horiz = R * Math.sin(ang);
  const factor = rFlat < 1e-6 ? 0 : horiz / rFlat;
  out.set(x * factor, y, z * factor).normalize();
  const radius = R + groundLiftAt(x, z) + SURFACE_EPS;
  out.multiplyScalar(radius);
  return out;
}

const toWorld = (x, z) => {
  const p = new THREE.Vector3();
  surfacePointFromFlat(x, z, R, p);
  return p;
};

const islandRideFlat = [
  [-12.0, 6.5],
  [-13.0, 2.0],
  [-12.4, -2.5],
  [-11.0, -7.0],
  [-9.5, -11.0],
  [-5.5, -16.5],
].map(([x, z]) => ({ x: x * WORLD_LAYOUT_SCALE, z: z * WORLD_LAYOUT_SCALE }));

const islandApproachFlat = [
  [-7.6, 25.9],
  [-8.9, 20.1],
  [-10.2, 14.3],
  [-11.1, 10.4],
].map(([x, z]) => ({ x: x * WORLD_LAYOUT_SCALE, z: z * WORLD_LAYOUT_SCALE }));

function buildMoebiusCitySCurve(R) {
  const center = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const worldNorth = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(worldNorth, center).normalize();
  const north = new THREE.Vector3().crossVectors(center, east).normalize();

  const localToPoint = (x, z, h) => {
    const d = Math.hypot(x, z);
    const dir = d < 1e-6
      ? center.clone()
      : center
          .clone()
          .multiplyScalar(Math.cos(d))
          .addScaledVector(east, (x / d) * Math.sin(d))
          .addScaledVector(north, (z / d) * Math.sin(d))
          .normalize();
    return dir.multiplyScalar(R + h);
  };

  const WAYPOINTS = [
    [-0.78, 0.36, 0.3],
    [-0.58, 0.32, 0.5],
    [-0.36, 0.3, 2.0],
    [-0.08, 0.15, 4.2],
    [0.22, -0.05, 6.2],
    [0.4, -0.26, 7.0],
    [0.58, -0.34, 7.0],
    [0.78, -0.34, 6.2],
    [0.96, -0.27, 4.5],
    [1.12, -0.14, 2.6],
    [1.28, -0.07, 0.9],
  ];
  return WAYPOINTS.map(([x, z, h]) => localToPoint(x, z, h));
}

export function testCandidateCitadelRoute(name, middleWaypoints) {
  const controls = [
    ...islandRideFlat.map(({ x, z }) => toWorld(x, z)),
    latLonToDir(-10, -60).multiplyScalar(R + 0.3),
    ...buildMoebiusCitySCurve(R),
    latLonToDir(-12, 165).multiplyScalar(R + 0.3),
    latLonToDir(-2, 130).multiplyScalar(R + 0.3),
    latLonToDir(12, 78).multiplyScalar(R + 0.3),
    ...middleWaypoints,
    latLonToDir(18, 15).multiplyScalar(R + 0.3),
    latLonToDir(11, 11).multiplyScalar(R + 0.3),
    latLonToDir(3, 14).multiplyScalar(R + 0.3),
    latLonToDir(-3, 24).multiplyScalar(R + 0.3),
    latLonToDir(-6, 38).multiplyScalar(R + 0.3),
    latLonToDir(-4, 54).multiplyScalar(R + 0.3),
    latLonToDir(2, 68).multiplyScalar(R + 0.3),
    latLonToDir(12, 82).multiplyScalar(R + 0.3),
    latLonToDir(26, 94).multiplyScalar(R + 0.3),
    latLonToDir(42, 102).multiplyScalar(R + 0.3),
    ...islandApproachFlat.map(({ x, z }) => toWorld(x, z)),
  ];

  const initialCurve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);
  const RESAMPLE = 720;
  const projected = [];
  for (let i = 0; i < RESAMPLE; i++) {
    initialCurve.getPointAt(i / RESAMPLE, _p);
    projected.push(surfacePoint(_p, R, new THREE.Vector3()));
  }
  for (let pass = 0; pass < 3; pass++) {
    const src = projected.map((v) => v.clone());
    for (let i = 0; i < RESAMPLE; i++) {
      const a = src[(i - 1 + RESAMPLE) % RESAMPLE];
      const b = src[i];
      const c = src[(i + 1) % RESAMPLE];
      projected[i].set(
        (a.x + 2 * b.x + c.x) / 4,
        (a.y + 2 * b.y + c.y) / 4,
        (a.z + 2 * b.z + c.z) / 4
      );
    }
  }
  for (let i = 0; i < RESAMPLE; i++) {
    const len = projected[i].length();
    const floor = trackFloorRadiusAt(projected[i], R);
    if (len < floor) projected[i].multiplyScalar(floor / len);
  }
  const curve = new THREE.CatmullRomCurve3(projected, true, "centripetal", 0.5);
  const L = curve.getLength();

  // 1. Culvert extraction
  const flags = new Array(RESAMPLE).fill(false);
  for (let i = 0; i < RESAMPLE; i++) {
    const t = i / RESAMPLE;
    curve.getPointAt(t, _p);
    const terrR = groundRadiusAt(_p, R);
    const trackR = _p.length();
    if (terrR - trackR > 0.08) flags[i] = true;
  }
  const expanded = [...flags];
  const MARGIN = 4;
  for (let i = 0; i < RESAMPLE; i++) {
    if (flags[i]) {
      for (let d = -MARGIN; d <= MARGIN; d++) expanded[(i + d + RESAMPLE) % RESAMPLE] = true;
    }
  }
  let firstFalse = -1;
  for (let i = 0; i < RESAMPLE; i++) {
    if (!expanded[i]) { firstFalse = i; break; }
  }
  const runs = [];
  let inRun = false, start = 0;
  for (let offset = 0; offset < RESAMPLE; offset++) {
    const idx = (firstFalse + offset) % RESAMPLE;
    if (expanded[idx]) {
      if (!inRun) { inRun = true; start = idx; }
    } else {
      if (inRun) {
        inRun = false;
        const end = (idx - 1 + RESAMPLE) % RESAMPLE;
        runs.push({ start, end });
      }
    }
  }
  if (inRun) runs.push({ start, end: (firstFalse - 1 + RESAMPLE) % RESAMPLE });

  // 2. Corner angles check
  const stepDist = 2.0;
  const chordDist = 6.0;
  const steps = Math.floor(L / stepDist);
  let minAngle = 180, rightCount = 0, acuteCount = 0;
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
    if (cornerAngle < minAngle) minAngle = cornerAngle;
    if (cornerAngle <= 100) rightCount++;
    if (cornerAngle < 85) acuteCount++;
  }

  // 3. Mountain Carving Check
  const citadelDir = citadelSiteDir(new THREE.Vector3());
  const castle = buildOdysseyCitadel({
    dir: citadelDir,
    groundRadius: R + citadelRangeLiftDir(citadelDir),
    planetRadius: R,
    seed: 20260808,
    latestDesign: true,
  });
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

  console.log(`=== Candidate: ${name} ===`);
  console.log(`  Culverts count: ${runs.length} (Expected 2)`);
  runs.forEach((r, idx) => {
    const ptCount = (r.end - r.start + RESAMPLE) % RESAMPLE + 1;
    const len = ptCount / RESAMPLE * L;
    let lamps = 0;
    for (let sIdx = 3; sIdx < ptCount - 3; sIdx += 6) lamps += 2;
    console.log(`    Culvert ${idx}: samples=${ptCount}, length=~${len.toFixed(1)}m, lamps=${lamps}`);
  });
  console.log(`  Min angle: ${minAngle.toFixed(1)}° (Expected >= 135°)`);
  console.log(`  Right angles: ${rightCount} (Expected 0)`);
  console.log(`  Acute angles: ${acuteCount} (Expected 0)`);
  console.log(`  Intruding mountain vertices: ${intrudingCount} (Expected 0)`);

  return { runs, minAngle, rightCount, acuteCount, intrudingCount, curve };
}
