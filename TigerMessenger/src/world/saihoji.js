// =====================================================================
//  西芳寺 · 苔海六景
//  不把庭园摊成两个半球，而是把石组、枯瀑、苔海和留白拆成六座环绕主岛的球面景区。
//  每座景区使用确定性构图；随机仅用于石面和苔斑细节。
// =====================================================================
import * as THREE from "three";
import { facet } from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { toonMat, addOutline, INK_COLOR } from "../assets/toon.js";
import { PLANET_RADIUS } from "./planet.js";

const MOSS_COLORS = Object.freeze([0x3e704f, 0x477f58, 0x548c60, 0x5c9767]);
const STONE_COLORS = Object.freeze([0x706b61, 0x625f58, 0x4f514b]);
const SAND_COLOR = 0xc8bea8;
const PATH_COLOR = 0x8e887d;
const HEAVY_INK = 0.022;
const _yUp = new THREE.Vector3(0, 1, 0);
const _base = new THREE.Vector3();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/** 固定的“苔海六景”：半径为各景区需要留出的球面距离（世界单位）。 */
export const SAIHOJI_ZONES = Object.freeze([
  // 六景从全球散点收拢到信使主岛北半球外围，成为同一座球形庭园的环形游线。
  { id: "moss-entry", name: "入口苔径", lat: 58, lon: -150, radius: 5.5, heading: -0.25, path: [-0.2, -2.4] },
  { id: "master-stones", name: "主石之庭", lat: 54, lon: -90, radius: 7.5, heading: 0.35, path: [-3.6, -1.8] },
  { id: "dry-cascade", name: "枯瀑之庭", lat: 52, lon: -30, radius: 7.0, heading: -0.2, path: [3.35, 0.2] },
  { id: "moss-islands", name: "苔海岛群", lat: 52, lon: 30, radius: 8.5, heading: 0.5, path: [0.2, 4.1] },
  { id: "empty-court", name: "空庭", lat: 54, lon: 90, radius: 9.0, heading: -0.45, path: [-3.2, -1.7] },
  { id: "return-view", name: "回望石组", lat: 58, lon: 150, radius: 7.0, heading: 0.2, path: [0.1, -3.35] },
]);

export const SAIHOJI_MIN_DISTANCE = 5;

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function latLonToGardenDir(latDeg, lonDeg, out = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return out.set(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
}

/** 兼容旧调试接口：Phi/Theta → 球面方向。 */
export function phiThetaToDir(phi, theta, out = new THREE.Vector3()) {
  const sp = Math.sin(phi);
  return out.set(sp * Math.cos(theta), Math.cos(phi), sp * Math.sin(theta));
}

/** 兼容旧调试接口：把对象以 Phi/Theta 贴到球面。 */
export function placeByPhiTheta(obj, phi, theta, radius = PLANET_RADIUS, lift = 0) {
  phiThetaToDir(phi, theta, _dir);
  return placeOnDirection(obj, _dir, radius, lift);
}

function placeOnDirection(obj, direction, radius, lift = 0, yaw = 0) {
  _dir.copy(direction).normalize();
  obj.position.copy(_dir).multiplyScalar(radius + lift);
  _quat.setFromUnitVectors(_yUp, _dir);
  obj.quaternion.copy(_quat);
  if (yaw) obj.rotateY(yaw);
  return obj;
}

/**
 * 景区局部米制坐标 → 球面位置。
 * x 为东西向、z 为南北向；归一化投影保证每个物件都真正贴球面。
 */
function directionAtLocal(zone, x, z, radius, out = new THREE.Vector3()) {
  latLonToGardenDir(zone.lat, zone.lon, _base);
  _east.crossVectors(_yUp, _base).normalize();
  _north.crossVectors(_base, _east).normalize();
  return out
    .copy(_base)
    .addScaledVector(_east, x / radius)
    .addScaledVector(_north, z / radius)
    .normalize();
}

function placeAtLocal(obj, zone, x, z, radius, lift = 0, yaw = 0) {
  directionAtLocal(zone, x, z, radius, _dir);
  return placeOnDirection(obj, _dir, radius, lift, zone.heading + yaw);
}

function angularDistanceMeters(aLat, aLon, bLat, bLon, radius = PLANET_RADIUS) {
  const a = latLonToGardenDir(aLat, aLon, new THREE.Vector3());
  const b = latLonToGardenDir(bLat, bLon, new THREE.Vector3());
  return a.angleTo(b) * radius;
}

/** 给其他随机场景使用：命中六景预留区时必须重新采样。 */
export function isInsideSaihojiReserve(lat, lon, padding = 1.5) {
  return SAIHOJI_ZONES.some(
    (zone) => angularDistanceMeters(lat, lon, zone.lat, zone.lon) < zone.radius + padding
  );
}

function pushCollider(colliders, obj, radiusOverride) {
  const radius = radiusOverride ?? obj.userData.collideRadius ?? 0;
  if (radius < 0.15) return;
  colliders.push({ position: obj.position.clone(), radius });
}

function makeIrregularPatch(rnd, rx, rz, color, segments = 12) {
  const vertices = [0, 0.015, 0];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const jitter = 0.82 + rnd() * 0.3;
    vertices.push(
      Math.cos(a) * rx * jitter,
      0.005 + rnd() * 0.022,
      Math.sin(a) * rz * jitter
    );
  }
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, ((i + 1) % segments) + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, toonMat(color, { side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.userData.kind = color === SAND_COLOR ? "drySand" : "mossPatch";
  mesh.userData.collideRadius = 0;
  return mesh;
}

function createGardenStone(style, height, rnd, colorIndex = 0) {
  const geometry = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geometry.attributes.position;
  const cache = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, 0.78 + rnd() * 0.42);
    v.multiplyScalar(cache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  const proportions = {
    standing: [0.62, 1.0, 0.58],
    attendant: [0.78, 0.72, 0.68],
    reclining: [1.3, 0.42, 0.78],
    bridge: [1.6, 0.28, 0.56],
    cascade: [1.0, 0.5, 0.86],
    seat: [1.35, 0.3, 1.0],
  }[style] || [0.8, 0.7, 0.7];

  const mesh = new THREE.Mesh(
    facet(geometry),
    toonMat(STONE_COLORS[colorIndex % STONE_COLORS.length])
  );
  mesh.scale.set(proportions[0] * height, proportions[1] * height, proportions[2] * height);
  mesh.position.y = proportions[1] * height * 0.48;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, HEAVY_INK, INK_COLOR, 0.045);

  const group = new THREE.Group();
  group.add(mesh);
  group.userData.kind = `gardenStone:${style}`;
  group.userData.collideRadius = Math.max(proportions[0], proportions[2]) * height * 0.46;
  return group;
}

function createStoneStep(rnd, scale = 1) {
  const mesh = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 7)),
    toonMat(PATH_COLOR)
  );
  mesh.scale.set(scale * (0.82 + rnd() * 0.24), 1, scale * (0.68 + rnd() * 0.22));
  mesh.position.y = 0.05;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.009, INK_COLOR, 0.035);
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.kind = "stoneStep";
  group.userData.collideRadius = 0;
  return group;
}

const STONE_LAYOUTS = Object.freeze({
  "moss-entry": [
    { x: -2.7, z: -0.8, style: "standing", h: 1.45, yaw: 0.15 },
    { x: 2.45, z: 1.0, style: "attendant", h: 1.25, yaw: -0.35 },
  ],
  "master-stones": [
    { x: 0, z: 0.2, style: "standing", h: 3.0, yaw: -0.15 },
    { x: -1.65, z: -0.55, style: "attendant", h: 1.7, yaw: 0.42 },
    { x: 1.45, z: 0.75, style: "reclining", h: 1.5, yaw: -0.3 },
    { x: -0.35, z: 2.0, style: "attendant", h: 1.2, yaw: 0.1 },
    { x: 2.65, z: -1.25, style: "reclining", h: 0.95, yaw: 0.55 },
  ],
  "dry-cascade": [
    { x: -0.15, z: 3.0, style: "standing", h: 2.15, yaw: 0.05, lift: 0.2 },
    { x: -0.75, z: 1.55, style: "cascade", h: 1.35, yaw: -0.2, lift: 0.14 },
    { x: 0.5, z: 0.15, style: "cascade", h: 1.25, yaw: 0.28, lift: 0.09 },
    { x: -0.25, z: -1.35, style: "bridge", h: 1.15, yaw: -0.1, lift: 0.04 },
    { x: 1.15, z: -2.65, style: "reclining", h: 1.05, yaw: 0.45 },
  ],
  "moss-islands": [
    { x: -3.2, z: 1.2, style: "standing", h: 1.8, yaw: -0.2 },
    { x: -2.1, z: 0.35, style: "attendant", h: 1.15, yaw: 0.35 },
    { x: -3.65, z: -0.45, style: "reclining", h: 0.9, yaw: -0.5 },
    { x: 0.25, z: -1.4, style: "standing", h: 2.2, yaw: 0.18 },
    { x: 1.35, z: -0.65, style: "attendant", h: 1.25, yaw: -0.4 },
    { x: -0.65, z: -2.45, style: "reclining", h: 0.95, yaw: 0.28 },
    { x: 3.25, z: 1.8, style: "standing", h: 1.45, yaw: -0.12 },
    { x: 4.1, z: 0.9, style: "attendant", h: 1.0, yaw: 0.5 },
    { x: 2.55, z: 0.35, style: "bridge", h: 0.9, yaw: -0.35 },
  ],
  "empty-court": [
    { x: 0.7, z: 0.4, style: "seat", h: 1.0, yaw: -0.18 },
  ],
  "return-view": [
    { x: -2.8, z: 0.8, style: "reclining", h: 1.25, yaw: 0.3 },
    { x: -1.25, z: -0.2, style: "attendant", h: 1.55, yaw: -0.2 },
    { x: 0.25, z: 0.25, style: "standing", h: 2.2, yaw: 0.1 },
    { x: 1.75, z: -0.5, style: "attendant", h: 1.35, yaw: 0.4 },
    { x: 3.0, z: 0.65, style: "reclining", h: 1.0, yaw: -0.45 },
  ],
});

const PINE_LAYOUTS = Object.freeze({
  "moss-entry": [
    { x: -4.2, z: 2.4, scale: 1.02, yaw: 0.35, seed: 811 },
  ],
  "master-stones": [
    { x: 4.4, z: 2.8, scale: 1.1, yaw: -0.5, seed: 1229 },
  ],
  "moss-islands": [
    { x: -5.15, z: -2.8, scale: 0.9, yaw: 0.2, seed: 1997 },
    { x: 4.7, z: -2.45, scale: 0.82, yaw: -0.4, seed: 2153 },
  ],
  "empty-court": [
    { x: -5.1, z: 2.9, scale: 1.08, yaw: 0.5, seed: 3011 },
  ],
});

function addZoneMoss(root, zone, count, radius, rnd) {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * zone.radius * 0.88;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const rx = 0.48 + rnd() * 0.52;
    const rz = 0.45 + rnd() * 0.5;
    const patch = makeIrregularPatch(
      rnd,
      rx,
      rz,
      MOSS_COLORS[(rnd() * MOSS_COLORS.length) | 0],
      12
    );
    placeAtLocal(patch, zone, x, z, radius, 0.025, rnd() * Math.PI);
    root.add(patch);
    placed++;
  }
  return placed;
}

function addDryCascadeSand(root, zone, radius, rnd) {
  const ribbon = [
    { x: 0.2, z: 2.5, rx: 1.15, rz: 1.35 },
    { x: -0.15, z: 0.65, rx: 1.35, rz: 1.4 },
    { x: 0.35, z: -1.25, rx: 1.5, rz: 1.3 },
    { x: 0.8, z: -2.85, rx: 1.7, rz: 1.0 },
  ];
  for (const p of ribbon) {
    const sand = makeIrregularPatch(rnd, p.rx, p.rz, SAND_COLOR, 12);
    placeAtLocal(sand, zone, p.x, p.z, radius, 0.045, -0.08);
    root.add(sand);
  }
}

/** 石底苔裙：双圈极扁苔斑，模糊石地交界（六景统一） */
function addStoneMossSkirt(root, zone, cx, cz, radius, rnd, ringR = 0.9) {
  const colors = MOSS_COLORS;
  for (const ring of [
    { r: ringR, n: 8 },
    { r: ringR * 0.55, n: 5 },
  ]) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + rnd() * 0.25;
      const d = ring.r * (0.75 + rnd() * 0.35);
      const patch = makeIrregularPatch(
        rnd,
        0.28 + rnd() * 0.22,
        0.22 + rnd() * 0.16,
        colors[(rnd() * colors.length) | 0],
        10
      );
      placeAtLocal(
        patch,
        zone,
        cx + Math.cos(a) * d,
        cz + Math.sin(a) * d,
        radius,
        0.02 + rnd() * 0.015,
        rnd() * Math.PI
      );
      root.add(patch);
    }
  }
}

/** 主石脚嵌小石：垂直层叠（基座 → 中垫 → 主体） */
function addNestedFooting(root, zone, spec, radius, rnd) {
  const tiers = [
    { dx: -0.35, dz: 0.2, h: spec.h * 0.28, style: "attendant" },
    { dx: 0.4, dz: -0.15, h: spec.h * 0.22, style: "reclining" },
  ];
  for (const t of tiers) {
    const foot = createGardenStone(t.style, Math.max(0.45, t.h), rnd, 3);
    placeAtLocal(
      foot,
      zone,
      spec.x + t.dx,
      spec.z + t.dz,
      radius,
      (spec.lift ?? 0) * 0.4,
      (spec.yaw ?? 0) + (rnd() - 0.5) * 0.4
    );
    root.add(foot);
  }
}

/** 枯瀑阶梯唇：浅蓝薄块沿石组落差排列 */
function addDryCascadeTiers(root, zone, radius, rnd) {
  const waterMat = toonMat(0x9fd8e8, {
    transparent: true,
    opacity: 0.82,
    emissive: 0x2a5a68,
    emissiveIntensity: 0.22,
  });
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const lip = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.55 - t * 0.12, 0.045, 0.7 - t * 0.08)),
      waterMat
    );
    const g = new THREE.Group();
    g.add(lip);
    placeAtLocal(g, zone, -0.1 + t * 0.15, 2.4 - i * 1.05, radius, 0.12 + (1 - t) * 0.35, -0.1);
    root.add(g);
  }
  void rnd;
}

function slerpDirection(a, b, t, out = new THREE.Vector3()) {
  const omega = a.angleTo(b);
  if (omega < 1e-5) return out.copy(a);
  const sinOmega = Math.sin(omega);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
    .addScaledVector(b, Math.sin(t * omega) / sinOmega)
    .normalize();
}

function addPilgrimagePath(root, radius, rnd) {
  const directions = SAIHOJI_ZONES.map((zone) =>
    directionAtLocal(zone, zone.path?.[0] ?? 0, zone.path?.[1] ?? 0, radius, new THREE.Vector3())
  );
  const route = [];
  for (let segment = 0; segment < directions.length - 1; segment++) {
    const a = directions[segment];
    const b = directions[segment + 1];
    const arcLength = a.angleTo(b) * radius;
    const steps = Math.max(8, Math.floor(arcLength / 1.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const dir = slerpDirection(a, b, t, new THREE.Vector3());
      const step = createStoneStep(rnd, i % 3 === 0 ? 0.86 : 1);
      placeOnDirection(step, dir, radius, 0.04, (rnd() - 0.5) * 0.35);
      root.add(step);
      route.push(step);
    }
  }
  return route;
}

/**
 * 在二次元球形世界中建立“苔海六景”。
 * @returns {{group:THREE.Group,colliders:object[],landmarks:object,placed:THREE.Vector3[],mossCount:number}}
 */
export function buildSaihojiPlanet(scene, opts = {}) {
  const radius = opts.radius ?? PLANET_RADIUS;
  const rnd = lcg(opts.seed ?? 884);
  const mossTarget = Math.max(72, opts.mossCount ?? 132);
  void opts.rockCount; // 保留旧调用兼容；六景石组数量由构图固定。

  const root = new THREE.Group();
  root.name = "SaihojiSixScenes";
  const colliders = [];
  const placed = [];
  const zones = {};
  let mossCount = 0;

  if (opts.planet?.isMesh) paintPlanetMossSea(opts.planet);

  const totalArea = SAIHOJI_ZONES.reduce((sum, zone) => sum + zone.radius * zone.radius, 0);
  for (let zi = 0; zi < SAIHOJI_ZONES.length; zi++) {
    const zone = SAIHOJI_ZONES[zi];
    const group = new THREE.Group();
    group.name = `Saihoji:${zone.name}`;
    root.add(group);
    zones[zone.id] = {
      definition: zone,
      group,
      stones: [],
      pines: [],
      pathDirection: directionAtLocal(
        zone,
        zone.path?.[0] ?? 0,
        zone.path?.[1] ?? 0,
        radius,
        new THREE.Vector3()
      ),
    };

    const share = (zone.radius * zone.radius) / totalArea;
    const count = Math.max(10, Math.round(mossTarget * share));
    mossCount += addZoneMoss(group, zone, count, radius, rnd);
    if (zone.id === "dry-cascade") addDryCascadeSand(group, zone, radius, rnd);

    const stones = STONE_LAYOUTS[zone.id] || [];
    for (let i = 0; i < stones.length; i++) {
      const spec = stones[i];
      const stone = createGardenStone(spec.style, spec.h, rnd, zi + i);
      placeAtLocal(stone, zone, spec.x, spec.z, radius, spec.lift ?? 0, spec.yaw ?? 0);
      group.add(stone);
      zones[zone.id].stones.push(stone);
      placed.push(stone.position.clone());
      pushCollider(colliders, stone);
      // 垂直层叠语言：石底苔裙 + 主石脚嵌小石（与起始庭园洪隐山一致）
      addStoneMossSkirt(group, zone, spec.x, spec.z, radius, rnd, 0.55 + spec.h * 0.22);
      if (spec.style === "standing" || spec.style === "cascade") {
        addNestedFooting(group, zone, spec, radius, rnd);
      }
    }

    const pines = PINE_LAYOUTS[zone.id] || [];
    for (const spec of pines) {
      const pine = createAncientPineTree(spec.seed);
      pine.scale.multiplyScalar(spec.scale);
      placeAtLocal(pine, zone, spec.x, spec.z, radius, 0, spec.yaw);
      group.add(pine);
      zones[zone.id].pines.push(pine);
      placed.push(pine.position.clone());
      pushCollider(colliders, pine, 0.72 * spec.scale);
      addStoneMossSkirt(group, zone, spec.x, spec.z, radius, rnd, 0.85 * spec.scale);
    }

    if (zone.id === "moss-entry") {
      for (let i = 0; i < 7; i++) {
        const step = createStoneStep(rnd, 0.95);
        placeAtLocal(step, zone, -1.7 + i * 0.58, -2.8 + i * 0.75, radius, 0.04, i * 0.08);
        group.add(step);
      }
    }

    // 枯瀑之庭：补阶梯式浅蓝跌水唇（垂直层叠）
    if (zone.id === "dry-cascade") {
      addDryCascadeTiers(group, zone, radius, rnd);
    }
  }

  const route = addPilgrimagePath(root, radius, rnd);
  scene.add(root);

  return {
    group: root,
    colliders,
    landmarks: { zones, route, reservedCaps: SAIHOJI_ZONES },
    placed,
    mossCount,
  };
}

/** 整颗星球保持苔海基底；用宽色阶制造截图参考中的青绿卡通块面。 */
export function paintPlanetMossSea(planetMesh) {
  const geometry = planetMesh.geometry;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x315b43);
  const mid = new THREE.Color(0x4d9b69);
  const light = new THREE.Color(0x58aa72);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const band = Math.sin(x * 0.13 + z * 0.09) * 0.5 + 0.5;
    color.copy(dark).lerp(mid, 0.38 + band * 0.38);
    if (y > 8) color.lerp(light, Math.min(0.25, (y - 8) / 100));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  planetMesh.material = toonMat(0xffffff, { vertexColors: true });
  planetMesh.material.needsUpdate = true;
}

/** 旧名称保留给外部调试脚本，但不再把南半球刷成白砂。 */
export function paintPlanetHemispheres(planetMesh) {
  paintPlanetMossSea(planetMesh);
}
