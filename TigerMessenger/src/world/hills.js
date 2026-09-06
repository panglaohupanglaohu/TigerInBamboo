/**
 * hills.js —— 连绵小土坡：把原灰色浮空平台改成从岛面隆起的连续山丘。
 *
 * 设计原则：视觉与碰撞共用同一个高度场 groundLiftAt(x,z)，
 * 所有"种"在山区的资产（古松/花草/岩石）都以它为落地高度，杜绝穿模。
 *
 * 坐标：所有丘体定义在"平面坐标"（flat x,z，见 sphereMath.flatXZToLatLon）。
 */
import * as THREE from "three";
import { latLonToDir, flatToWorld } from "./sphereMath.js";
import { WORLD_SCALE } from "./worldScale.js";
import { islandLiftFor } from "./seaLevel.js";

// 土丘的 x/z/r 是世界布局量；peak/lift/depth 是玩家局部高度，保持不变。
// 土丘定义：flatX / flatZ / 半径 r / 峰高 peak。
// 两条山脊：北脊包住驿站方向（峰 2.0，替代旧高台地标），东西两列沿岛缘展开。
const HILL_DEFS_BASE = [
  // —— 北脊（驿站山，连续重叠的三丘）
  { x: -1.8, z: -12.6, r: 3.0, peak: 1.15 },
  { x: 0.4, z: -12.4, r: 3.4, peak: 2.0 },
  { x: 2.2, z: -11.2, r: 2.6, peak: 1.0 },
  // —— 西北列（原岩石链位置）
  { x: -5.2, z: -8.6, r: 3.2, peak: 1.5 },
  { x: -7.6, z: -5.4, r: 2.8, peak: 0.9 },
  // —— 西坡（与游戏区衔接的缓丘，可作眺望台）
  { x: -6.2, z: 1.6, r: 3.4, peak: 1.2 },
  // —— 东坡（原孤独高台位置）
  { x: 8.8, z: 4.8, r: 3.0, peak: 1.3 },
  // —— 东北矮丘（衔接湖与北脊，避开湖岸步道）
  { x: 6.6, z: -7.6, r: 2.6, peak: 0.8 },
  { x: 4.6, z: -9.8, r: 2.2, peak: 0.6 },
  // —— 东南微丘（和缓草丘，远观层次；避开出生点与湖岸）
  { x: 5.8, z: 6.8, r: 2.4, peak: 0.45 },
  // —— 书店山坡（Hard To Find Bookshop，主岛东侧可见）
  { x: 11.5, z: 5.5, r: 5.6, peak: 2.2 },

  // ================= 地标连接走廊（2026-09-05） =================
  // 主人要求「地标与地标之间用山脉与森林连接」。这一批是主岛内部的两条山脊：
  //   走廊 A：出发营地 (-17, 9) → 书店镇 (11.5, 5.5)
  //   走廊 B：书店镇 (11.5, 5.5) → 月亮湖 (4, -1)
  // 森林部分见 CORRIDOR_FOREST_PATH（供 nature.js 沿脊撒树）。
  //
  // ⚠️ 两条硬避让，别照直线连：
  //  ① **池塘**（心 (0, 9.1)、半轴 9.2×4.9）：营地→书店的直线在 x=0 处 z≈6.9，
  //     正落在池内。所以走廊 A 一律走**池南**，即 tramSystem 注释里那个
  //     「池塘与西坡丘之间的针眼」。每个丘心都验过 ((x/9.2)²+((z-9.1)/4.9)² > 1)。
  //  ② **月亮湖**（心 (4, -1)、rOuter 3.5）：丘心到湖心距离必须 > 3.5，
  //     否则山会长进湖里。(1.5,1.2) 与 (6.0,0.2) 的初稿都因此挪过位。
  //
  // 峰高压在 0.8–1.1：既能读出「山脊连着两地」，又低于轨面净空口径
  // （carveHillsForTrack 的 capLift 0.62 会把压到轨道走廊里的部分削平，
  // 所以走廊与电车相交处不会穿车体）。

  // —— 走廊 A：营地 → 书店（绕池南；西段接已有的西坡丘 (-6.2, 1.6)）
  { x: -13.0, z: 5.5, r: 3.0, peak: 0.9 },
  { x: -9.5, z: 2.8, r: 2.8, peak: 1.0 },
  { x: -2.5, z: 0.8, r: 3.0, peak: 1.1 },
  { x: 1.5, z: 2.2, r: 2.8, peak: 0.95 },
  { x: 5.0, z: 3.0, r: 2.6, peak: 1.0 },

  // —— 走廊 B：书店 → 月亮湖（东段接已有的东坡丘 (8.8, 4.8)）
  { x: 8.5, z: 2.0, r: 2.4, peak: 1.0 },
  { x: 7.5, z: 1.0, r: 2.2, peak: 0.8 },
];

/**
 * 走廊中心线（平面设计坐标，未乘 WORLD_SCALE）。
 * 供 `nature.js` 沿线撒树成林带 —— 森林与山脊共用同一条路径，
 * 免得「山在这、树在那」。端点是地标本体，中间点与上面的走廊丘心对齐。
 */
export const CORRIDOR_FOREST_PATH = Object.freeze([
  Object.freeze({
    id: "camp-bookshop",
    name: "营地—书店 山脊林道",
    points: Object.freeze([
      Object.freeze({ x: -17.0, z: 9.0 }), // 出发营地
      Object.freeze({ x: -13.0, z: 5.5 }),
      Object.freeze({ x: -9.5, z: 2.8 }),
      Object.freeze({ x: -6.2, z: 1.6 }), // 已有西坡丘
      Object.freeze({ x: -2.5, z: 0.8 }),
      Object.freeze({ x: 1.5, z: 2.2 }),
      Object.freeze({ x: 5.0, z: 3.0 }),
      Object.freeze({ x: 8.8, z: 4.8 }), // 已有东坡丘
      Object.freeze({ x: 11.5, z: 5.5 }), // 书店镇
    ]),
  }),
  Object.freeze({
    id: "bookshop-moon",
    name: "书店—月亮湖 林带",
    points: Object.freeze([
      Object.freeze({ x: 11.5, z: 5.5 }), // 书店镇
      Object.freeze({ x: 8.5, z: 2.0 }),
      Object.freeze({ x: 7.5, z: 1.0 }),
      Object.freeze({ x: 4.0, z: -1.0 }), // 月亮湖
    ]),
  }),
]);

const HILL_DEFS = HILL_DEFS_BASE.map((def) => ({
  ...def,
  x: def.x * WORLD_SCALE,
  z: def.z * WORLD_SCALE,
  r: def.r * WORLD_SCALE,
}));

export const ISLAND_FLAT_R = 18 * WORLD_SCALE; // 主岛平面足迹
export const ISLAND_BASE_LIFT = 0.6; // 岛面厚度（原平台顶高）
export const BOOKSHOP_TOWN = Object.freeze({
  x: 11.5 * WORLD_SCALE,
  z: 5.5 * WORLD_SCALE,
  r: 8.4 * WORLD_SCALE,
});
/** 书店镇相对海面的台地抬升：让镇子成为高出海洋的丘岛，而不是贴在水线上。 */
export const BOOKSHOP_OCEAN_ISLAND_LIFT = 3.2;

function bookshopIslandLift(x, z) {
  const d = Math.hypot(x - BOOKSHOP_TOWN.x, z - BOOKSHOP_TOWN.z);
  if (d >= BOOKSHOP_TOWN.r) return 0;
  const t = 1 - d / BOOKSHOP_TOWN.r;
  const s = t * t * (3 - 2 * t);
  return BOOKSHOP_OCEAN_ISLAND_LIFT * s;
}

/**
 * 出发营地海湾台地（2026-09-05）。
 *
 * 营地锚点在平面 (-17, 9) → 世界 (-68, 36)，`hypot = 76.95 > ISLAND_FLAT_R = 72`
 * —— **它在主岛足迹之外**，于是 `groundLiftAt` 只返回 `town`（那里为 0），
 * 营地锚点落在 r = R，比海面低 `SEA_LEVEL = 0.5`。
 * 出发营地是玩家出生点、也是 Tier0 地标，沉在水下违反主人的硬约束
 * 「除水晶城和湖沼外，其余地标必须在海面之上」。
 *
 * 这是「岛台抬升」（方案 B）的第一个应用点。抬升量**相对海面基线派生**
 * （`islandLiftFor`），不再像 `BOOKSHOP_OCEAN_ISLAND_LIFT = 3.2` 那样写死数字
 * —— 当年那个写死的补丁只救了一个镇，营地就是这么被漏掉的。
 *
 * 剖面沿用书店镇同一条 smoothstep：湾心足量抬升、湾缘平滑归零，
 * 这样营地的「草坡→沙滩→浅海阶梯」多层海岸线仍然能斜插入海。
 */
export const CAMP_COVE = Object.freeze({
  x: -17 * WORLD_SCALE,
  z: 9 * WORLD_SCALE,
  r: 9.5 * WORLD_SCALE,
});
/** 湾心目标净空：高出海面 0.45（与主岛地面 +0.10 相比留更厚余量，营地是出生点） */
export const CAMP_OCEAN_ISLAND_LIFT = islandLiftFor(0, 0.45);

function campIslandLift(x, z) {
  const d = Math.hypot(x - CAMP_COVE.x, z - CAMP_COVE.z);
  if (d >= CAMP_COVE.r) return 0;
  const t = 1 - d / CAMP_COVE.r;
  const s = t * t * (3 - 2 * t);
  return CAMP_OCEAN_ISLAND_LIFT * s;
}

// 起始庭园的池水不是贴在岛面上的透明平板，而是球面岛上的一个浅盆。
// 这些参数同时供地形、平台壳体、碰撞和水面使用，避免四套坐标各算各的。
export const POND_CENTER_X = 0;
export const POND_CENTER_Z = 9.1 * WORLD_SCALE;
export const POND_RADIUS_X = 9.2 * WORLD_SCALE;
export const POND_RADIUS_Z = 4.9 * WORLD_SCALE;
export const POND_DEPTH = 0.48;

/** 池塘位置的下挖量（椭圆边缘为 0，中心最深）。 */
export function pondDepressionAt(x, z) {
  const nx = (x - POND_CENTER_X) / POND_RADIUS_X;
  const nz = (z - POND_CENTER_Z) / POND_RADIUS_Z;
  const d2 = nx * nx + nz * nz;
  if (d2 >= 1) return 0;
  const rim = 1 - d2;
  // 中心较平、岸边柔和收口，避免出现硬切圆洞。
  return -POND_DEPTH * rim * (0.72 + 0.28 * rim);
}

// 山区包围盒（网格覆盖范围，含裙边余量）
const GRID_MIN_X = -11.5 * WORLD_SCALE;
const GRID_MAX_X = 16.5 * WORLD_SCALE;
const GRID_MIN_Z = -15.5 * WORLD_SCALE;
const GRID_MAX_Z = 12.5 * WORLD_SCALE;
const GRID_STEP = 0.7 * WORLD_SCALE; // 保持网格细分密度，随布局覆盖扩大

/** 所有土丘在该点的联合抬升（余弦剖面，多丘取 max，保证连绵无叠加尖峰） */
export function hillHeightAt(x, z) {
  let h = 0;
  for (const def of HILL_DEFS) {
    const d = Math.hypot(x - def.x, z - def.z);
    if (d < def.r) {
      const c = def.peak * 0.5 * (1 + Math.cos((Math.PI * d) / def.r));
      if (c > h) h = c;
    }
  }
  return h;
}

/** 地面真实抬升：岛内 = 岛面 + 丘高 + 池盆下挖 + 书店镇海岛台地；岛外 = 0 */
/**
 * 岛外台地合计：书店镇 + 出发营地海湾。
 * 二者都在 ISLAND_FLAT_R 之外，靠自带台地浮出海面；取 max 而非相加，
 * 避免两片台地万一重叠时叠出尖峰（与 hillHeightAt 的多丘取 max 同一口径）。
 */
function offIslandLift(x, z) {
  return Math.max(bookshopIslandLift(x, z), campIslandLift(x, z));
}

export function groundLiftAt(x, z) {
  const off = offIslandLift(x, z);
  if (Math.hypot(x, z) > ISLAND_FLAT_R) return off;
  return ISLAND_BASE_LIFT + hillHeightAt(x, z) + pondDepressionAt(x, z) + off;
}

/**
 * 沿电车轨道走廊压平丘陵：轨道在岛面保持平铺（不爬山），
 * 若走廊上山体高于轨道会穿轨/穿车体，故把走廊内顶点降到 capLift。
 * 只改视觉网格（groundLiftAt 不变）；走廊内树/石由 settle pass 重新落地。
 * @param {THREE.Mesh} hillsMesh buildHills 返回的主网格
 * @param {THREE.Curve[]} trackCurves 电车曲线数组（中心线 + 双线，世界坐标）
 * @param {number} R 星球半径
 * @param {number} [capLift=0.62] 压平目标高度（低于轨面 0.78，留枕木净空）
 */
export function carveHillsForTrack(hillsMesh, trackCurves, R, capLift = 0.62) {
  if (!hillsMesh || !trackCurves?.length) return;
  const pts = [];
  for (const curve of trackCurves) {
    for (const p of curve.getPoints(160)) {
      const f = worldToFlatXZ(p, R);
      if (f) pts.push(f);
    }
  }
  if (!pts.length) return;
  const nx = Math.round((GRID_MAX_X - GRID_MIN_X) / GRID_STEP) + 1;
  const nz = Math.round((GRID_MAX_Z - GRID_MIN_Z) / GRID_STEP) + 1;
  const pos = hillsMesh.geometry.attributes.position;
  const tmp = new THREE.Vector3();
  // 全压平半径：车道中心 ±0.9 + 车体半宽 ~1.3 + 余量；车体底角不得压山
  const CORRIDOR_R = 4.4 * WORLD_SCALE;
  const FADE_R = 6.0 * WORLD_SCALE; // 过渡带外缘，平滑接回原山体
  let vi = 0;
  let changed = false;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++, vi++) {
      const x = GRID_MIN_X + ix * GRID_STEP;
      const z = GRID_MIN_Z + iz * GRID_STEP;
      const lift = groundLiftAt(x, z);
      if (lift <= capLift + 1e-3) continue;
      let dMin = Infinity;
      for (const p of pts) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx > FADE_R || dx < -FADE_R || dz > FADE_R || dz < -FADE_R) continue;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < dMin) dMin = d;
      }
      if (dMin >= FADE_R) continue;
      const t = THREE.MathUtils.clamp((dMin - CORRIDOR_R) / (FADE_R - CORRIDOR_R), 0, 1);
      const w = t * t * (3 - 2 * t); // smoothstep：走廊心 = 全压平，过渡缘 = 不变
      const newLift = THREE.MathUtils.lerp(capLift, lift, w);
      flatToWorld(x, newLift, z, R, tmp);
      pos.setXYZ(vi, tmp.x, tmp.y, tmp.z);
      changed = true;
    }
  }
  if (changed) {
    pos.needsUpdate = true;
    hillsMesh.geometry.computeVertexNormals();
  }
}

// —— 世界坐标 → 山区平面坐标（半球守卫：只在小岛所在半球有意义，防对跖幽灵吸附）
// 与 flatXZToLatLon/latLonToDir 的经纬度约定互为逆变换（角度单位为度）。
const _islandDir = latLonToDir(90, 0);
const _tmpDir = new THREE.Vector3();

export function worldToFlatXZ(pos, R) {
  _tmpDir.copy(pos).normalize();
  if (_tmpDir.dot(_islandDir) < 0.64) return null; // 距岛心超过约 50° 不在山区
  const latDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(_tmpDir.y, -1, 1)));
  const theta = THREE.MathUtils.degToRad(90 - latDeg); // 距北极弧度 = 平面距离 / R
  const phi = Math.atan2(_tmpDir.z, _tmpDir.x); // 与 latLonToDir 一致
  return { x: Math.cos(phi) * theta * R, z: Math.sin(phi) * theta * R };
}

/**
 * 构建山区网格：单个合并高度场（视觉=碰撞，连绵无接缝），
 * 顶点色从草绿渐变到土褐，模拟草坡与坡顶露土。
 */
export function buildHills(scene, R) {
  const nx = Math.round((GRID_MAX_X - GRID_MIN_X) / GRID_STEP) + 1;
  const nz = Math.round((GRID_MAX_Z - GRID_MIN_Z) / GRID_STEP) + 1;
  const vertexCount = nx * nz;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const tmp = new THREE.Vector3();
  const grass = new THREE.Color(0x55875f); // 与岛面同色的沉绿
  const soil = new THREE.Color(0x8a7a56); // 坡顶土褐
  const mix = new THREE.Color();

  let vi = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++, vi++) {
      const x = GRID_MIN_X + ix * GRID_STEP;
      const z = GRID_MIN_Z + iz * GRID_STEP;
      const lift = groundLiftAt(x, z);
      flatToWorld(x, lift, z, R, tmp);
      positions[vi * 3 + 0] = tmp.x;
      positions[vi * 3 + 1] = tmp.y;
      positions[vi * 3 + 2] = tmp.z;
      // 高度 0（岛面）→ 草绿；≥1.2 → 土褐
      const t = THREE.MathUtils.clamp((lift - ISLAND_BASE_LIFT) / 1.2, 0, 1);
      mix.copy(grass).lerp(soil, t);
      colors[vi * 3 + 0] = mix.r;
      colors[vi * 3 + 1] = mix.g;
      colors[vi * 3 + 2] = mix.b;
    }
  }

  const indices = [];
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "hills";
  scene.add(mesh);

  // 高度场原先只有顶面，远处观看时边界会变成一条悬空薄片。
  // 给四条边补向外摊开的土坡，向星球表面收口；不再生成垂直黑色裙墙。
  const skirtPositions = [];
  const skirtIndices = [];
  let skirtVertex = 0;
  const skirtBottomHeight = 0.04;
  const skirtRampWidth = 4.5;
  const edgePoint = (ix, iz) => ({
    x: GRID_MIN_X + ix * GRID_STEP,
    z: GRID_MIN_Z + iz * GRID_STEP,
    index: iz * nx + ix,
  });
  const addSkirtEdge = (edge, side) => {
    const isHorizontal = side === "north" || side === "south";
    const outerMin = isHorizontal ? GRID_MIN_X - skirtRampWidth : GRID_MIN_Z - skirtRampWidth;
    const outerSpan = isHorizontal
      ? (GRID_MAX_X - GRID_MIN_X) + skirtRampWidth * 2
      : (GRID_MAX_Z - GRID_MIN_Z) + skirtRampWidth * 2;
    const outerFixed = side === "north"
      ? GRID_MIN_Z - skirtRampWidth
      : side === "south"
        ? GRID_MAX_Z + skirtRampWidth
        : side === "west"
          ? GRID_MIN_X - skirtRampWidth
          : GRID_MAX_X + skirtRampWidth;
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i];
      const b = edge[i + 1];
      const ai = a.index * 3;
      const bi = b.index * 3;
      // 顶边复用高度场已计算出的世界坐标；底边落回球面地表。
      skirtPositions.push(
        positions[ai], positions[ai + 1], positions[ai + 2],
        positions[bi], positions[bi + 1], positions[bi + 2],
      );
      const outerA = outerMin + (i / (edge.length - 1)) * outerSpan;
      const outerB = outerMin + ((i + 1) / (edge.length - 1)) * outerSpan;
      const bottomA = isHorizontal
        ? { x: outerA, z: outerFixed }
        : { x: outerFixed, z: outerA };
      const bottomB = isHorizontal
        ? { x: outerB, z: outerFixed }
        : { x: outerFixed, z: outerB };
      flatToWorld(bottomA.x, skirtBottomHeight, bottomA.z, R, tmp);
      skirtPositions.push(tmp.x, tmp.y, tmp.z);
      flatToWorld(bottomB.x, skirtBottomHeight, bottomB.z, R, tmp);
      skirtPositions.push(tmp.x, tmp.y, tmp.z);
      skirtIndices.push(
        skirtVertex, skirtVertex + 2, skirtVertex + 1,
        skirtVertex + 1, skirtVertex + 2, skirtVertex + 3,
      );
      skirtVertex += 4;
    }
  };

  const northEdge = [];
  const southEdge = [];
  const westEdge = [];
  const eastEdge = [];
  for (let ix = 0; ix < nx; ix++) {
    northEdge.push(edgePoint(ix, 0));
    southEdge.push(edgePoint(ix, nz - 1));
  }
  for (let iz = 0; iz < nz; iz++) {
    westEdge.push(edgePoint(0, iz));
    eastEdge.push(edgePoint(nx - 1, iz));
  }
  addSkirtEdge(northEdge, "north");
  addSkirtEdge(southEdge, "south");
  addSkirtEdge(westEdge, "west");
  addSkirtEdge(eastEdge, "east");

  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute("position", new THREE.Float32BufferAttribute(skirtPositions, 3));
  skirtGeometry.setIndex(skirtIndices);
  skirtGeometry.computeVertexNormals();
  const skirt = new THREE.Mesh(
    skirtGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x75664b,
      roughness: 0.96,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  skirt.name = "hills-closed-skirt";
  scene.add(skirt);

  return { mesh, skirt };
}
