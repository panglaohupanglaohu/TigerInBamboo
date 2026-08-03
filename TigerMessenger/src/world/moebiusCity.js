// =====================================================================
//  莫比斯水晶异星大都会（南半球 · 史诗级重构）
//  - InstancedMesh 千座晶体丛林（4/5/6 段三桶，合并 Draw Call）
//  - 3 座中央母皇塔（玩家 15~20 倍）做地平线风暴中心
//  - 高度/密度向母塔聚集（8× → 3× 梯度退化到赤道）
//  - 根部金黄能量海（万家灯火，冷暖对冲）
//  - 实例化水墨描边（BackSide 法线外扩，共用实例矩阵）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { canyonOffsetDir } from "./canyon.js";

const ICE = 0xbee5ef; // 冰川蓝自发光
const GOLD = 0xffd700; // 能量海金
const CRYSTAL_GOLD = 0xf39c12; // 母皇塔明黄

/** 玻璃物理材质（主人指定参数：透射 0.9 / ior 1.7 / 壁厚 2.0） */
function crystalPhysical(color = 0xd6eaf8, emissive = 0x1f3a4b) {
  return new THREE.MeshPhysicalMaterial({
    transmission: 0.9, // 玻璃清透
    opacity: 1.0,
    transparent: true,
    roughness: 0.05, // 极度光滑
    metalness: 0.1,
    ior: 1.7, // 高折射率
    thickness: 2.0, // 三维壁厚感
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0.55,
  });
}

/** 中央母体晶皇塔（电车绕行地标 + 能量束目标） */
export const GRAND_CRYSTAL = Object.freeze({ lat: -46, lon: -115, h: 30, r: 2.2 });

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 实例化描边材质（BackSide + 法线外扩，唐伯虎笔意墨线） */
function outlineMatInstanced(thickness) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x211e19, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tfloat tmHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
\ttransformed += normal * (${thickness.toFixed(4)} * (0.6 + 0.8 * tmHash));`
    );
  };
  return mat;
}

/**
 * 构建莫比斯水晶大都会。
 * @param {THREE.CatmullRomCurve3} [trackCurve] 轨道让行走廊
 */
export function buildMoebiusCrystalMetropolis(scene, R, { trackCurve } = {}) {
  const rnd = lcg(20260803);
  const group = new THREE.Group();
  group.name = "moebius-metropolis";

  const grandDir = latLonToDir(GRAND_CRYSTAL.lat, GRAND_CRYSTAL.lon, new THREE.Vector3());
  const _dir = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _tiltQ = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _e = new THREE.Euler();

  function trackClear(dir) {
    if (!trackCurve) return true;
    for (let i = 0; i <= 60; i++) {
      trackCurve.getPointAt(i / 60, _pos);
      if (_pos.angleTo(dir) < 0.085) return false;
    }
    return true;
  }

  // ---------- 1. 实例化晶体丛林（500~1000，错落非等比缩放） ----------
  const TOTAL = 840;
  const buckets = { 4: [], 5: [], 6: [] };
  const placedDirs = [];
  let attempts = 0;
  while (placedDirs.length < TOTAL && attempts < TOTAL * 12) {
    attempts++;
    const lat = -14 - rnd() * 70;
    const lon = rnd() * 360 - 180;
    const dir = latLonToDir(lat, lon, new THREE.Vector3());
    const dC = dir.angleTo(grandDir); // 距母塔角距（rad）
    // 密度向母塔聚集，向赤道退化
    const density = Math.max(0.1, 1 - dC / 1.35);
    if (rnd() > density) continue;
    // 高度梯队：近母塔 ~8× 玩家，远 ~3×
    let h = (5.1 + Math.max(0, 1 - dC / 1.35) * 8.5) * (0.75 + rnd() * 0.5);
    const r = 0.45 + rnd() * 0.9;
    // 扎根谷底/峭壁：叠加峡谷沉降
    const root = R + canyonOffsetDir(dir);
    // 高架桥走廊：贴近线路的晶体削顶让行（不穿越桥面 40.2）
    if (!trackClear(dir)) {
      h = Math.min(h, Math.max(2.5, R + 0.2 - root - 0.6));
    }
    const seg = 4 + ((rnd() * 3) | 0); // 4~6 段生硬棱角
    buckets[seg].push({
      dir: dir.clone(),
      h,
      r,
      root,
      tx: (rnd() - 0.5) * 0.22, // 顶部斜切/凌乱生长
      tz: (rnd() - 0.5) * 0.22,
    });
    placedDirs.push(dir.clone());
  }

  for (const seg of [4, 5, 6]) {
    const list = buckets[seg];
    if (!list.length) continue;
    const geo = facet(new THREE.CylinderGeometry(0.12, 1, 1, seg));
    geo.translate(0, 0.5, 0); // 底部原点（实例矩阵缩放为最终尺寸）
    const mat = crystalPhysical(); // 玻璃折射
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const outInst = new THREE.InstancedMesh(geo, outlineMatInstanced(0.035), list.length);
    list.forEach((c, i) => {
      _pos.copy(c.dir).multiplyScalar(c.root);
      _quat.copy(quatYToDir(c.dir, new THREE.Quaternion()));
      _tiltQ.setFromEuler(_e.set(c.tx, 0, c.tz));
      _quat.multiply(_tiltQ);
      _scl.set(c.r, c.h, c.r);
      _m.compose(_pos, _quat, _scl);
      inst.setMatrixAt(i, _m);
      outInst.setMatrixAt(i, _m);
    });
    inst.castShadow = true;
    inst.instanceMatrix.needsUpdate = true;
    outInst.instanceMatrix.needsUpdate = true;
    group.add(inst, outInst);
  }

  // ---------- 2. 中央母皇塔 ×3（15~20 倍玩家，地平线风暴中心） ----------
  const grands = [
    { lat: GRAND_CRYSTAL.lat, lon: GRAND_CRYSTAL.lon, h: GRAND_CRYSTAL.h, r: GRAND_CRYSTAL.r },
    { lat: -52, lon: -100, h: 26, r: 1.8 },
    { lat: -40, lon: -128, h: 27, r: 1.9 },
  ];
  const crystals = [];
  for (const gd of grands) {
    const dir = latLonToDir(gd.lat, gd.lon, new THREE.Vector3());
    const geo = facet(new THREE.CylinderGeometry(gd.r * 0.14, gd.r, gd.h, 6));
    geo.translate(0, gd.h / 2, 0);
    const mesh = new THREE.Mesh(
      geo,
      crystalPhysical(0xf7c95e, 0x5a3a10) // 母皇塔：金珀玻璃
    );
    mesh.castShadow = true;
    addOutline(mesh, 0.06);
    const g = new THREE.Group();
    g.add(mesh);
    g.position.copy(dir).multiplyScalar(R + canyonOffsetDir(dir)); // 扎根谷底
    g.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
    g.rotateZ(0.08); // 斜指天外
    group.add(g);
    crystals.push({ group: g, dir: dir.clone(), h: gd.h, r: gd.r });
  }

  // ---------- 3. 金黄能量海（晶体根部 + 城市地表万家灯火） ----------
  const SEA = 420;
  const seaGeo = new THREE.CircleGeometry(0.5, 6);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0.55,
  });
  const sea = new THREE.InstancedMesh(seaGeo, seaMat, SEA);
  const seaSpots = [...placedDirs, ...crystals.map((c) => c.dir)];
  for (let i = 0; i < SEA; i++) {
    let dir;
    if (rnd() < 0.7 && seaSpots.length) {
      // 晶体根部附近
      dir = seaSpots[(rnd() * seaSpots.length) | 0].clone();
      dir.x += (rnd() - 0.5) * 0.06;
      dir.y += (rnd() - 0.5) * 0.03;
      dir.z += (rnd() - 0.5) * 0.06;
      dir.normalize();
    } else {
      dir = latLonToDir(-16 - rnd() * 66, rnd() * 360 - 180, new THREE.Vector3());
    }
    _pos.copy(dir).multiplyScalar(R + 0.06 + canyonOffsetDir(dir));
    _quat.copy(quatYToDir(dir, new THREE.Quaternion()));
    const s = 0.4 + rnd() * 1.1;
    _scl.set(s, 1, s);
    _m.compose(_pos, _quat, _scl);
    sea.setMatrixAt(i, _m);
  }
  sea.instanceMatrix.needsUpdate = true;
  group.add(sea);

  scene.add(group);
  const grandTop = grandDir.clone().multiplyScalar(R + GRAND_CRYSTAL.h * 0.92);
  return { group, crystals, grand: crystals[0], grandTop };
}

/** 旧名兼容 */
export const buildMoebiusCity = buildMoebiusCrystalMetropolis;
