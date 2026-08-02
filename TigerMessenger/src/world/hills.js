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

// 土丘定义：flatX / flatZ / 半径 r / 峰高 peak。
// 两条山脊：北脊包住驿站方向（峰 2.0，替代旧高台地标），东西两列沿岛缘展开。
const HILL_DEFS = [
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
];

const ISLAND_FLAT_R = 18; // 主岛平面足迹半径（platforms.js 主岛 size 18）
export const ISLAND_BASE_LIFT = 0.6; // 岛面厚度（原平台顶高）

// 山区包围盒（网格覆盖范围，含裙边余量）
const GRID_MIN_X = -11.5;
const GRID_MAX_X = 12.5;
const GRID_MIN_Z = -15.5;
const GRID_MAX_Z = 9.0;
const GRID_STEP = 0.7; // 平面网格间距

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

/** 地面真实抬升：岛内 = 岛面 0.6 + 丘高；岛外 = 0（星球裸面） */
export function groundLiftAt(x, z) {
  if (Math.hypot(x, z) > ISLAND_FLAT_R) return 0;
  return ISLAND_BASE_LIFT + hillHeightAt(x, z);
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
      const lift = ISLAND_BASE_LIFT + hillHeightAt(x, z);
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

  return { mesh };
}
