// =====================================================================
//  老虎起始视角：苔海六景式小庭园
//  不是一张背景贴图，而是一组贴合主岛球面的可读 3D 景物：
//  前景池水、苔岩岛、右侧瀑布、左侧红叶、后方竹林与一株古松。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { placeObjectOnSphere } from "./sphereMath.js";
import {
  groundLiftAt,
  POND_CENTER_X,
  POND_CENTER_Z,
} from "./hills.js";

const UP = new THREE.Vector3(0, 1, 0);

function segment(group, a, b, r0, r1, material, outline = 0.012) {
  const delta = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(r1, r0, delta.length(), 7)),
    material,
  );
  mesh.position.copy(a).addScaledVector(delta, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  mesh.castShadow = true;
  addOutline(mesh, outline, 0x21352c, 0.04);
  group.add(mesh);
  return mesh;
}

function rock(material = toonMat(0x3a4542), scale = 1) {
  const mesh = new THREE.Mesh(
    facet(new THREE.IcosahedronGeometry(0.62, 1)),
    material,
  );
  mesh.scale.set(1.2 * scale, 0.75 * scale, 0.95 * scale);
  mesh.rotation.set(0.05, scale * 0.7, -0.08);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.014, 0x25302c, 0.05);
  return mesh;
}

function mossPatch(x, y, z, rx, rz, color = 0x5f9a50) {
  const patch = new THREE.Mesh(
    facet(new THREE.IcosahedronGeometry(0.5, 1)),
    toonMat(color),
  );
  patch.position.set(x, y, z);
  patch.scale.set(rx, 0.075, rz);
  patch.rotation.y = (x * 1.7 + z * 0.9) % Math.PI;
  patch.castShadow = true;
  return patch;
}

const POND_SCALE = 1.55;
// 水面高于池底、低于池岸；两者之间留出可读的水盆深度。
const POND_WATER_LIFT = 0.3;

function pondSurfaceY(x, z, baseR, waterR) {
  const tangentSq = x * x + z * z;
  return Math.sqrt(Math.max(0.05, waterR * waterR - tangentSq)) - baseR;
}

function createPond(planetRadius) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  // ShapeGeometry 默认在 XY 平面；翻转到 XZ 后，使用 -z 让局部 z 与平面设计坐标同向。
  // 反射到局部 XZ 后反转顶点顺序，保持水面法线朝上。
  const points = [
    [-5.8, -0.4], [-4.2, -2.4], [-1.0, -3.0], [2.5, -2.65],
    [5.9, -1.15], [5.4, 1.35], [3.15, 2.55], [-0.7, 2.8],
    [-4.2, 2.1], [-5.9, 0.8],
  ].map(([x, z]) => [x * POND_SCALE, -z * POND_SCALE]).reverse();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const baseHeight = groundLiftAt(POND_CENTER_X, POND_CENTER_Z) + 0.02;
  const baseR = planetRadius + baseHeight;
  const waterR = planetRadius + POND_WATER_LIFT;
  const waterGeometry = new THREE.ShapeGeometry(shape);
  const waterPositions = waterGeometry.getAttribute("position");
  // 将水面弯成与球面同心的等高面。否则平面水板在池岸处会因球面曲率悬空。
  for (let i = 0; i < waterPositions.count; i++) {
    const x = waterPositions.getX(i);
    const z = -waterPositions.getY(i);
    waterPositions.setZ(i, pondSurfaceY(x, z, baseR, waterR));
  }
  waterPositions.needsUpdate = true;
  waterGeometry.computeVertexNormals();
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x3c7770,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  group.add(water);

  const ripples = [];
  for (const [rawX, rawZ, rawR] of [[-3.4, -0.45, 0.9], [-0.8, 1.15, 1.15], [2.5, -0.8, 0.75], [4.1, 1.0, 0.52]]) {
    const x = rawX * POND_SCALE;
    const z = rawZ * POND_SCALE;
    const r = rawR * POND_SCALE;
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.48, r * 0.53, 24),
      new THREE.MeshBasicMaterial({ color: 0xb7eee0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(x, pondSurfaceY(x, z, baseR, waterR) + 0.012, z);
    group.add(ripple);
    ripples.push({ mesh: ripple, base: r, phase: x * 0.4 + z });
  }
  return { group, ripples };
}

function createMossIsland() {
  const group = new THREE.Group();
  const darkRock = toonMat(0x35403e);
  for (const [x, y, z, s] of [[-1.65, 0.28, -0.2, 1.25], [-0.35, 0.22, 0.05, 1.45], [1.0, 0.3, -0.2, 1.2], [1.75, 0.18, 0.55, 0.82], [-0.9, 0.15, 0.85, 0.8]]) {
    const r = rock(darkRock, s);
    r.position.set(x, y, z);
    group.add(r);
  }
  for (const [x, y, z, rx, rz, c] of [
    [-1.0, 0.82, 0.05, 1.35, 0.72, 0x6b9f4d],
    [0.75, 0.75, -0.18, 1.2, 0.68, 0x79a956],
    [1.25, 0.55, 0.5, 0.8, 0.45, 0x4c8246],
  ]) group.add(mossPatch(x, y, z, rx, rz, c));
  return group;
}

function createMaple() {
  const group = new THREE.Group();
  const bark = toonMat(0x554338);
  const leaves = [toonMat(0xd64d35), toonMat(0xe8713e), toonMat(0xb93632), toonMat(0xe38e42)];
  const trunk = [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.12, 0.8, 0.03),
    new THREE.Vector3(0.2, 1.55, 0.02), new THREE.Vector3(-0.08, 2.28, 0.08),
    new THREE.Vector3(0.16, 3.0, 0.04),
  ];
  for (let i = 0; i < trunk.length - 1; i++) segment(group, trunk[i], trunk[i + 1], 0.16 - i * 0.025, 0.13 - i * 0.023, bark, 0.01);
  const arms = [
    [2, -1.15, 0.23, -0.1], [2, 1.2, 0.2, 0.12], [3, -1.0, 0.38, 0.02],
    [3, 1.35, 0.28, -0.12], [4, -0.75, 0.25, 0], [4, 0.72, 0.32, 0.1],
  ];
  for (let i = 0; i < arms.length; i++) {
    const [at, dx, rise, dz] = arms[i];
    const start = trunk[at];
    const end = start.clone().add(new THREE.Vector3(dx, rise, dz));
    segment(group, start, end, 0.08, 0.025, bark, 0.008);
    const crown = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.55, 1)), leaves[i % leaves.length]);
    crown.position.copy(end).add(new THREE.Vector3(dx > 0 ? 0.2 : -0.2, 0.16, 0));
    crown.scale.set(1.35, 0.72, 0.9);
    crown.rotation.set(0.1, i * 0.65, -0.1);
    crown.castShadow = true;
    addOutline(crown, 0.012, 0x563328, 0.045);
    group.add(crown);
  }
  const crown = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.7, 1)), leaves[1]);
  crown.position.set(0.08, 3.28, 0.02);
  crown.scale.set(1.55, 0.82, 1.05);
  crown.castShadow = true;
  addOutline(crown, 0.012, 0x563328, 0.045);
  group.add(crown);
  group.scale.setScalar(1.18);
  group.userData.collideRadius = 0.55;
  return group;
}

/**
 * 竹竿（狩野山乐《竹虎图》笔法）：分段竹节 + 深浅交错 + 节环凸起
 */
function bambooCulm(h, matA, matB, nodeMat) {
  const g = new THREE.Group();
  const segs = Math.max(5, Math.round(h / 0.75));
  const segH = h / segs;
  for (let i = 0; i < segs; i++) {
    const r = 0.075 * (1 - (i / segs) * 0.25);
    const seg = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(r * 0.96, r, segH * 0.96, 6)),
      i % 2 ? matA : matB
    );
    seg.position.y = segH * (i + 0.5);
    seg.castShadow = true;
    addOutline(seg, 0.006, 0x244b35, 0.03);
    g.add(seg);
    // 竹节环（比竿身略凸，深色）
    const node = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.05, 6)),
      nodeMat
    );
    node.position.y = segH * (i + 1);
    g.add(node);
  }
  return g;
}

/**
 * 竹叶簇（"介"字撇叶）：5 片狭长尖叶自一点向下扇形散开
 */
function bladeCluster(x, y, z, mat, yaw = 0) {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const blade = new THREE.Mesh(facet(new THREE.ConeGeometry(0.05, 0.55, 3)), mat);
    blade.scale.set(1, 1, 0.32); // 压扁成叶片
    blade.rotation.set(0.5 + k * 0.28, yaw + k * 0.9, Math.PI * 0.9 + (k - 2) * 0.22);
    blade.position.set(
      x + Math.sin(k * 1.3) * 0.15,
      y - 0.1 - (k % 2) * 0.05,
      z + Math.cos(k * 1.1) * 0.13
    );
    blade.castShadow = true;
    g.add(blade);
  }
  return g;
}

/**
 * 竹林背景墙（《竹虎图》参考）：竹节分明的竹竿 12 竿/簇、双排错位，
 * 高 6.2~8.4（玩家 3.6~4.9 倍），顶部两层"介"字撇叶簇。
 */
function createBambooWallCluster(seedOffset = 0) {
  const group = new THREE.Group();
  const green = toonMat(0x3e7954);
  const greenDark = toonMat(0x356b49);
  const node = toonMat(0x2a5a3c);
  const leaf = toonMat(0x2f6b4a);

  const stems = [];
  for (let i = 0; i < 12; i++) {
    const row = i % 2;
    stems.push([
      -1.6 + (i / 11) * 3.2 + ((i * 37 + seedOffset) % 10) * 0.03,
      6.2 + ((i * 53 + seedOffset * 7) % 22) * 0.1,
      row ? 0.32 : -0.28,
      ((i % 3) - 1) * 0.05,
    ]);
  }
  for (let i = 0; i < stems.length; i++) {
    const [x, h, z, lean] = stems[i];
    const culm = bambooCulm(h, i % 2 ? green : greenDark, green, node);
    culm.position.set(x, 0, z);
    culm.rotation.z = lean;
    group.add(culm);
    // 顶部两层"介"字叶簇
    group.add(bladeCluster(x + lean * h * 0.6, h * 0.94, z, leaf, i * 0.7));
    group.add(bladeCluster(x + lean * h * 0.5, h * 0.78, z + 0.06, leaf, i * 1.3 + 0.4));
  }
  return group;
}

/**
 * 洪隐山石壁（mountainGroup）：嵌套大小 Box/Icosahedron 向上堆叠，
 * 右侧高耸山体（≈ 玩家 3.3 倍），石阶留有跌水与青苔的落点。
 */
function boxRock(material, sx, sy, sz) {
  const mesh = new THREE.Mesh(facet(new THREE.BoxGeometry(sx, sy, sz)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.016, 0x25302c, 0.05);
  return mesh;
}

function createMountainWall() {
  const mountainGroup = new THREE.Group();
  mountainGroup.name = "hongyin-mountain";
  const dark = toonMat(0x2b3a38);
  const dark2 = toonMat(0x35443f);

  // 基座层：四块错落大岩（大小不一、前后咬合）
  const base = [
    [-1.3, 0.55, 0.3, 1.9], [0.4, 0.5, -0.35, 2.2],
    [1.7, 0.45, 0.35, 1.6], [-0.35, 0.5, 1.0, 1.5],
  ];
  for (const [x, y, z, s] of base) {
    const r = rock(dark, s);
    r.position.set(x, y, z);
    mountainGroup.add(r);
  }
  // 中层：三块收拢（一块方岩嵌缝）
  const mid = [
    [-0.7, 1.95, 0.15, 1.5, "ico"], [0.85, 1.85, -0.25, 1.3, "ico"],
    [0.05, 2.1, 0.55, 1.0, "box"],
  ];
  for (const [x, y, z, s, kind] of mid) {
    const r = kind === "box" ? boxRock(dark2, 1.1 * s, 1.4 * s, 0.9 * s) : rock(dark, s);
    r.position.set(x, y, z);
    if (kind === "box") r.rotation.set(0.06, 0.5, -0.08);
    mountainGroup.add(r);
  }
  // 顶部：两块方岩叠出山脊（最高 ~5.6 ≈ 玩家 3.3 倍）
  const top = [
    [0.15, 3.15, 0.05, 1.05, "ico"], [-0.25, 4.05, 0.0, 0.8, "box"],
    [0.3, 4.75, 0.1, 0.6, "box"], [0.1, 5.3, 0.05, 0.42, "box"],
  ];
  for (const [x, y, z, s, kind] of top) {
    const r = kind === "box" ? boxRock(dark2, 1.0 * s, 1.5 * s, 0.85 * s) : rock(dark, s);
    r.position.set(x, y, z);
    if (kind === "box") r.rotation.set(-0.05, 0.35 + s, 0.06);
    mountainGroup.add(r);
  }
  return mountainGroup;
}

/**
 * 叠水：沿山壁层层级级向下的阶梯状浅蓝扁平色块（枯山水跌水）。
 * 每层 = 台面水唇（横）+ 跌落面（竖），末端没入池面泡沫。
 */
function createCascade() {
  const group = new THREE.Group();
  const waterMat = toonMat(0x9fd8e8, {
    transparent: true,
    opacity: 0.9,
    emissive: 0x2a5a68,
    emissiveIntensity: 0.28,
  });
  const streams = [];
  // 实机微调：6 层、层距略紧、向池心探出更均匀（跌水节奏更可读）
  const TIERS = 6;
  for (let i = 0; i < TIERS; i++) {
    const t = i / (TIERS - 1);
    const y = 4.05 - i * 0.68;
    const x = 2.05 - i * 0.08;
    const z = 0.42 - i * 0.22;
    const w = 0.86 - t * 0.22;
    // 台面水唇（薄平块）
    const lip = new THREE.Mesh(facet(new THREE.BoxGeometry(0.46, 0.05, w)), waterMat);
    lip.position.set(x, y, z);
    lip.castShadow = false;
    group.add(lip);
    // 跌落面（竖扁块，微前倾）
    const fallH = 0.62 + (1 - t) * 0.12;
    const fall = new THREE.Mesh(facet(new THREE.BoxGeometry(0.055, fallH, w * 0.8)), waterMat);
    fall.position.set(x + 0.2, y - fallH * 0.52, z + 0.08);
    fall.rotation.z = -0.1;
    group.add(fall);
    streams.push({ mesh: fall, baseY: fall.position.y, phase: i * 0.95 });
  }
  // 池面泡沫：末端更密、略大
  const foam = [];
  for (const [x, z, s] of [
    [2.15, -0.55, 0.42],
    [2.5, -0.9, 0.34],
    [1.9, -0.3, 0.28],
    [2.35, -1.15, 0.26],
  ]) {
    const f = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.28, 1)), toonMat(0xd0efe3));
    f.position.set(x, 0.28, z);
    f.scale.set(s * 1.65, s * 0.42, s);
    group.add(f);
    foam.push({ mesh: f, phase: x * 2.1 });
  }
  return { group, streams, foam };
}

/** 青苔裹石：沿岩石底缘撒一圈极扁翠绿多边形，模糊石与地的交界 */
function addMossRing(group, cx, cz, ringR, count, lift = 0.06) {
  // 双圈：外圈略大 + 内圈贴根，节奏更密、色阶更丰
  const rings = [
    { r: ringR, n: count, lift: lift },
    { r: ringR * 0.62, n: Math.max(4, (count * 0.55) | 0), lift: lift + 0.02 },
  ];
  let k = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++, k++) {
      const a = (i / ring.n) * Math.PI * 2 + (k % 3) * 0.18 + ring.r * 0.4;
      const rr = ring.r * (0.82 + ((k * 37) % 10) / 35);
      const p = mossPatch(
        cx + Math.cos(a) * rr,
        ring.lift + ((k * 13) % 5) * 0.01,
        cz + Math.sin(a) * rr,
        0.42 + ((k * 7) % 5) * 0.12,
        0.3 + ((k * 11) % 5) * 0.08,
        MOSS_RING_COLORS[k % MOSS_RING_COLORS.length]
      );
      group.add(p);
    }
  }
}
const MOSS_RING_COLORS = [0x4e8849, 0x5c994e, 0x6fae56, 0x3f7a44, 0x569a52, 0x487a40];

/** 截图 1 的可重复景观单元：横向古松 + 苔岩 + 踏石小径。 */
function createPineRockVignette(seed, scale = 1) {
  const group = new THREE.Group();
  const pine = createAncientPineTree(seed);
  pine.scale.multiplyScalar(scale);
  pine.position.set(0, 0, 0);
  group.add(pine);

  const stones = [
    [-1.35, 0.26, 0.28, 1.15], [-0.35, 0.2, 0.7, 0.85],
    [1.05, 0.18, 0.35, 0.72], [1.72, 0.16, -0.22, 0.62],
  ];
  for (const [x, y, z, s] of stones) {
    const boulder = rock(toonMat(0x4a4d46), s * scale);
    boulder.position.set(x * scale, y * scale, z * scale);
    group.add(boulder);
  }

  // 斜向踏石串，采用截图 1 的“从石组伸向远处”的节奏。
  const pathMat = toonMat(0x8c887a);
  for (let i = 0; i < 6; i++) {
    const step = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 7)),
      pathMat,
    );
    step.position.set((2.05 + i * 0.68) * scale, 0.055 * scale, (0.55 + i * 0.4) * scale);
    step.scale.set(1.0 * scale, 1, 0.78 * scale);
    step.rotation.y = -0.18 + i * 0.06;
    step.castShadow = true;
    step.receiveShadow = true;
    addOutline(step, 0.009, 0x343d37, 0.035);
    group.add(step);
  }
  for (const [x, z, rx, rz] of [[-0.2, 0.5, 1.1, 0.6], [1.0, -0.18, 0.9, 0.45]]) {
    group.add(mossPatch(x * scale, 0.05 * scale, z * scale, rx * scale, rz * scale, 0x5f9552));
  }
  return group;
}

function addPineRockVignettes(root, planetRadius, colliders) {
  const placements = [
    [-10.2, -7.2, 0.98, 4301, 0.18],
    [9.8, -7.6, 0.84, 4311, -0.38],
    [10.2, 5.4, 0.8, 4321, 0.42],
    [-8.8, 2.0, 0.74, 4331, -0.2],
  ];
  for (const [x, z, scale, seed, yaw] of placements) {
    const vignette = createPineRockVignette(seed, scale);
    placeObjectOnSphere(vignette, x, z, groundLiftAt(x, z), planetRadius);
    vignette.rotateY(yaw);
    root.add(vignette);
    const center = new THREE.Vector3();
    vignette.getWorldPosition(center);
    colliders.push({ position: center, radius: 0.85 * scale });
  }
}

/**
 * 固定在出生点前方的园景构图。平面坐标仍使用主岛的 x/z，
 * 由 placeObjectOnSphere 贴到球面，因此镜头旋转时不会像贴纸一样脱离地面。
 */
export function createStartGardenVista(scene, planetRadius) {
  const root = new THREE.Group();
  root.name = "tiger-start-garden-vista";
  const colliders = [];
  const pond = createPond(planetRadius);
  // 水盆中心与 hills/platforms 的下挖中心完全一致。
  placeObjectOnSphere(
    pond.group,
    POND_CENTER_X,
    POND_CENTER_Z,
    groundLiftAt(POND_CENTER_X, POND_CENTER_Z) + 0.02,
    planetRadius,
  );
  root.add(pond.group);

  const island = createMossIsland();
  placeObjectOnSphere(island, 0.9, 9.1, groundLiftAt(0.9, 9.1) + 0.06, planetRadius);
  root.add(island);

  // 洪隐山石壁（画面右侧）+ 沿壁叠水 + 底缘苔环
  const mountain = createMountainWall();
  placeObjectOnSphere(mountain, -5.4, 9.6, groundLiftAt(-5.4, 9.6) + 0.02, planetRadius);
  addMossRing(mountain, 0.2, 0.35, 2.45, 16, 0.05); // 青苔裹石：双圈更密
  root.add(mountain);

  const cascade = createCascade();
  // 叠水挂在山壁朝池一侧，与 mountain 同位放置（局部坐标一致）
  placeObjectOnSphere(cascade.group, -5.4, 9.6, groundLiftAt(-5.4, 9.6) + 0.02, planetRadius);
  root.add(cascade.group);

  // 石缝生树：红叶斜插在山脚岩缝中（倾斜生长）
  const maple = createMaple();
  placeObjectOnSphere(maple, -3.3, 10.4, groundLiftAt(-3.3, 10.4) - 0.12, planetRadius);
  maple.rotateY(-0.35);
  maple.rotateZ(0.24); // 斜插入缝，顽强生长
  addMossRing(maple, 0, 0, 0.95, 10, 0.04); // 树根苔环
  root.add(maple);

  // 房屋（flat 坐标 12.4,7.2）右侧的红叶树：与房屋保持可读间距，
  // 不再放在旧的左侧位置，避免镜头里树冠遮住门廊。
  const mapleLeft = createMaple();
  placeObjectOnSphere(mapleLeft, 15.1, 5.4, groundLiftAt(15.1, 5.4), planetRadius);
  mapleLeft.rotateY(-0.28);
  addMossRing(mapleLeft, 0, 0, 0.95, 10, 0.04);
  root.add(mapleLeft);

  // 竹林背景墙：最深处的竖向屏障（高低错落、密集成簇）
  const bambooA = createBambooWallCluster(3);
  placeObjectOnSphere(bambooA, -3.4, 16.2, groundLiftAt(-3.4, 16.2), planetRadius);
  bambooA.rotateY(0.18);
  root.add(bambooA);
  const bambooB = createBambooWallCluster(11);
  placeObjectOnSphere(bambooB, 2.6, 16.8, groundLiftAt(2.6, 16.8), planetRadius);
  bambooB.rotateY(-0.22);
  root.add(bambooB);

  const rearMoss = new THREE.Group();
  for (const [x, z, rx, rz, color] of [
    [-4.9, 12.1, 1.35, 0.58, 0x4e8849], [-2.9, 15.2, 1.15, 0.52, 0x76a857],
    [3.0, 15.8, 1.5, 0.64, 0x4e8849], [4.5, 12.4, 1.2, 0.46, 0x659b4e],
    [-1.5, 11.3, 1.0, 0.5, 0x5c994e],
  ]) {
    const patch = mossPatch(x, 0.06, z - 13.5, rx, rz, color);
    rearMoss.add(patch);
  }
  placeObjectOnSphere(rearMoss, 0, 9.1, groundLiftAt(0, 9.1) + 0.04, planetRadius);
  root.add(rearMoss);

  // 主岛四处再铺开同一套“古松—苔岩—踏石”景观，形成西芳寺式重复节奏。
  addPineRockVignettes(root, planetRadius, colliders);

  scene.add(root);
  return { group: root, pond, waterfall: cascade, mountain, colliders };
}

export function updateStartGardenVista(vista, t) {
  if (!vista) return;
  for (const ripple of vista.pond.ripples) {
    const wave = 1 + 0.07 * Math.sin(t * 0.65 + ripple.phase);
    ripple.mesh.scale.setScalar(wave);
    ripple.mesh.material.opacity = 0.13 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.45 + ripple.phase));
  }
  // 跌水节奏略放缓，避免“频闪感”
  for (const stream of vista.waterfall.streams) {
    stream.mesh.position.y = stream.baseY + 0.038 * Math.sin(t * 1.65 + stream.phase);
    stream.mesh.scale.x = 1 + 0.07 * Math.sin(t * 1.4 + stream.phase);
  }
  for (const foam of vista.waterfall.foam) {
    foam.mesh.position.y = 0.18 + 0.03 * Math.sin(t * 1.9 + foam.phase);
  }
}
