// =====================================================================
//  程序化 Low-Poly 资产：树 / 房 / 石 / 花 / 栅栏 / 桥（纯基础几何体）
//  约定：MeshToonMaterial + facet() 平直法线；Group 底部中心在局部 (0,0,0)
// =====================================================================
import * as THREE from "three";

function toonMat(color) {
  return new THREE.MeshToonMaterial({ color });
}

/** 平直化：非索引 + 逐面法线 */
function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

/** 低多边树：圆柱树干 + 三层圆锥树冠（总高约 2.7） */
export function createLowPolyTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 5)),
    toonMat(0x8a5a3a)
  );
  trunk.position.y = 0.4;
  trunk.castShadow = true;
  g.add(trunk);

  const layers = [
    { r: 0.7, h: 1.0, y: 1.1, c: 0x3f8f5a },
    { r: 0.55, h: 0.9, y: 1.7, c: 0x4aa566 },
    { r: 0.38, h: 0.75, y: 2.25, c: 0x5cba72 },
  ];
  for (const { r, h, y, c } of layers) {
    const cone = new THREE.Mesh(facet(new THREE.ConeGeometry(r, h, 6)), toonMat(c));
    cone.position.y = y;
    cone.castShadow = true;
    g.add(cone);
  }
  g.userData.collideRadius = 0.55;
  return g;
}

/** 低多边房子 */
export function createLowPolyHouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.6, 1.0, 1.4)),
    toonMat(0xe8d8b0)
  );
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    facet(new THREE.ConeGeometry(1.25, 0.7, 4)),
    toonMat(0xc45a4a)
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.0 + 0.35;
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.32, 0.52, 0.06)),
    toonMat(0x6a4a3a)
  );
  door.position.set(0, 0.26, 0.71);
  g.add(door);

  const win = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.3, 0.3, 0.05)),
    toonMat(0x9ec5ff)
  );
  win.position.set(0.48, 0.6, 0.71);
  g.add(win);

  const chimney = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.18, 0.45, 0.18)),
    toonMat(0x8a8a96)
  );
  chimney.position.set(0.45, 1.25, 0);
  chimney.castShadow = true;
  g.add(chimney);

  g.userData.collideRadius = 1.1;
  return g;
}

/** 石头：错落球体簇 */
export function createLowPolyRock() {
  const g = new THREE.Group();
  const parts = [
    { r: 0.45, y: 0.35, x: 0, z: 0, c: 0x7a8494 },
    { r: 0.28, y: 0.22, x: 0.28, z: 0.1, c: 0x6a7484 },
    { r: 0.22, y: 0.18, x: -0.22, z: -0.15, c: 0x8a94a4 },
  ];
  for (const p of parts) {
    const m = new THREE.Mesh(
      facet(new THREE.IcosahedronGeometry(p.r, 0)),
      toonMat(p.c)
    );
    m.position.set(p.x, p.y, p.z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.userData.collideRadius = 0.55;
  return g;
}

/** 花草：细茎 + 小花瓣盘 */
export function createLowPolyFlower(hue = 0xff88aa) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4)),
    toonMat(0x3d8f4a)
  );
  stem.position.y = 0.28;
  g.add(stem);

  const bloom = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.16, 6, 4)),
    toonMat(hue)
  );
  bloom.position.y = 0.58;
  bloom.castShadow = true;
  g.add(bloom);

  const leaf = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.12, 0.25, 4)),
    toonMat(0x4aa55a)
  );
  leaf.rotation.z = 0.9;
  leaf.position.set(0.1, 0.25, 0);
  g.add(leaf);

  g.userData.collideRadius = 0.15; // 几乎可穿过
  return g;
}

/** 栅栏段：两柱 + 横梁 */
export function createLowPolyFence() {
  const g = new THREE.Group();
  const mat = toonMat(0x9a7048);
  for (const x of [-0.45, 0.45]) {
    const post = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.1, 0.7, 0.1)),
      mat
    );
    post.position.set(x, 0.35, 0);
    post.castShadow = true;
    g.add(post);
  }
  for (const y of [0.25, 0.5]) {
    const rail = new THREE.Mesh(
      facet(new THREE.BoxGeometry(1.0, 0.08, 0.06)),
      mat
    );
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  g.userData.collideRadius = 0.55;
  return g;
}

/** 小桥：桥面 + 两侧栏 */
export function createLowPolyBridge() {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    facet(new THREE.BoxGeometry(2.4, 0.12, 0.9)),
    toonMat(0xb8956a)
  );
  deck.position.y = 0.35;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // 拱脚
  for (const z of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.2, 0.35, 0.9)),
      toonMat(0x8a7a6a)
    );
    leg.position.set(z, 0.18, 0);
    g.add(leg);
  }

  const railMat = toonMat(0x6a5a4a);
  for (const side of [-0.4, 0.4]) {
    const rail = new THREE.Mesh(
      facet(new THREE.BoxGeometry(2.2, 0.08, 0.06)),
      railMat
    );
    rail.position.set(0, 0.55, side);
    g.add(rail);
  }

  g.userData.collideRadius = 1.2;
  return g;
}

/**
 * 贴球面：position = dir × R，局部 +Y 对齐法线。
 */
export function placeOnSphere(obj, latDeg, lonDeg, radius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const dir = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
  obj.position.copy(dir).multiplyScalar(radius);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return obj;
}

/**
 * 在球面随机撒资产（按纬度带）。
 * @returns {{ meshes: THREE.Object3D[], colliders: { position: THREE.Vector3, radius: number }[] }}
 */
export function scatterOnSphere(scene, planetRadius, opts = {}) {
  const {
    seed = 42,
    trees = 28,
    rocks = 18,
    flowers = 40,
    fences = 8,
    houses = 4,
    bridges = 2,
    // 避开极区出生点：纬度上限（度，90=北极）
    latMax = 72,
    latMin = -40,
  } = opts;

  // 简易 LCG
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const makers = [];
  for (let i = 0; i < trees; i++) makers.push(createLowPolyTree);
  for (let i = 0; i < rocks; i++) makers.push(createLowPolyRock);
  for (let i = 0; i < flowers; i++) {
    makers.push(() =>
      createLowPolyFlower([0xff88aa, 0xffe08a, 0xc9a8ff, 0x9ec5ff][(rnd() * 4) | 0])
    );
  }
  for (let i = 0; i < fences; i++) makers.push(createLowPolyFence);
  for (let i = 0; i < houses; i++) makers.push(createLowPolyHouse);
  for (let i = 0; i < bridges; i++) makers.push(createLowPolyBridge);

  const meshes = [];
  const colliders = [];

  for (const make of makers) {
    const lat = latMin + rnd() * (latMax - latMin);
    const lon = rnd() * 360 - 180;
    // 远离北极出生点（lat>82 跳过）
    if (lat > 82) continue;
    const obj = placeOnSphere(make(), lat, lon, planetRadius);
    // 随机绕法线扭一下
    obj.rotateY(rnd() * Math.PI * 2);
    scene.add(obj);
    meshes.push(obj);
    const cr = obj.userData.collideRadius ?? 0.4;
    if (cr >= 0.25) {
      colliders.push({
        position: obj.position.clone(),
        radius: cr,
      });
    }
  }

  return { meshes, colliders };
}
