// =====================================================================
//  莫比斯水晶异星大都会（南半球 · 史诗级重构）
//  - InstancedMesh 三倍巨型晶体群（4/5/6 段三桶，合并 Draw Call）
//  - 3 座三倍中央母皇塔做地平线风暴中心
//  - 三倍占地疏散布局，同时给 8 字高架留出完整净空
//  - 根部金黄能量海（万家灯火，冷暖对冲）
//  - 实例化水墨描边（BackSide 法线外扩，共用实例矩阵）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createDetailedMoebiusTower } from "../assets/moebiusTower.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { CANYON, canyonOffsetDir } from "./canyon.js";

const GOLD = 0xffd700; // 能量海金
const CITY_ENTRY_DROP = CANYON.depth / CANYON.steps;
const CITY_APPROACH_DISTANCE_MULTIPLIER = 5;
const CITY_BUILDING_SCALE = 3;
// 原城市只占峡谷第五级以内；线性半径扩大 3 倍，而非把楼继续挤在谷心。
const ORIGINAL_CITY_RADIUS =
  CANYON.rim * (1 - CITY_APPROACH_DISTANCE_MULTIPLIER / CANYON.steps);
export const CITY_FOOTPRINT_RADIUS = Math.min(
  CANYON.rim - 0.08,
  ORIGINAL_CITY_RADIUS * 3
);

/**
 * 玻璃材质（性能修复版）：原 transmission 0.92 物理透射会触发
 * three.js 每帧「全场景二次渲染到透射缓冲」，直视水晶城时帧率
 * 46.9 → 10.8 fps（最坏帧 475ms 卡死）。改为透明 + clearcoat 高光 +
 * 自发光的手绘风玻璃，观感接近、成本只剩一次正向渲染。
 */
function crystalPhysical(color = 0xd6eaf8, emissive = 0x1f3a4b) {
  return new THREE.MeshPhysicalMaterial({
    transmission: 0,
    opacity: 0.7,
    transparent: true,
    roughness: 0.06,
    metalness: 0.0,
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    flatShading: true,
    depthWrite: false,
  });
}

/** 中央母体晶皇塔（电车绕行地标 + 能量束目标） */
export const GRAND_CRYSTAL = Object.freeze({
  lat: -24,
  lon: CANYON.lon,
  h: 29.05 * CITY_BUILDING_SCALE,
  r: 2.2 * CITY_BUILDING_SCALE,
});

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 实例化描边材质（BackSide + 法线外扩，唐伯虎笔意墨线） */
function outlineMatInstanced(thickness) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x211e19,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
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

  const cityCenterDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const cityEast = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), cityCenterDir)
    .normalize();
  const cityNorth = new THREE.Vector3().crossVectors(cityCenterDir, cityEast).normalize();
  const grandDir = latLonToDir(GRAND_CRYSTAL.lat, GRAND_CRYSTAL.lon, new THREE.Vector3());
  const _dir = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _tiltQ = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _e = new THREE.Euler();
  const _facing = new THREE.Vector3();
  const _basisX = new THREE.Vector3();

  /** 峡谷谷心的切平面坐标 → 球面方向（x=东西，z=南北；单位为弧度）。 */
  function cityDirFromLocal(x, z, out = new THREE.Vector3()) {
    const d = Math.hypot(x, z);
    if (d < 1e-6) return out.copy(cityCenterDir);
    return out
      .copy(cityCenterDir)
      .multiplyScalar(Math.cos(d))
      .addScaledVector(cityEast, (x / d) * Math.sin(d))
      .addScaledVector(cityNorth, (z / d) * Math.sin(d))
      .normalize();
  }

  /**
   * 三倍占地城市覆盖峡谷第一层以下；谷缘之外仍保持完全无建筑。
   * 进城方向的长距离空桥由 trackClear 继续保持净空。
   */
  function insideCanyon(dir, minDrop = CITY_ENTRY_DROP) {
    return canyonOffsetDir(dir) <= -minDrop + 1e-5;
  }

  function trackClear(dir, minAngle = 0.19) {
    if (!trackCurve) return true;
    for (let i = 0; i <= 320; i++) {
      trackCurve.getPointAt(i / 320, _pos);
      if (_pos.angleTo(dir) < minAngle) return false;
    }
    return true;
  }

  // 带花厅塔只保留 3 座（性能）：1 座母皇主塔 + 2 座沿轨金鳞塔。
  // 移除西北侧母皇塔（贴轨道左侧、遮挡视线且占地），保留主地标。
  const grandSites = [
    { dir: grandDir.clone(), scale: 1, seed: 701 },
  ];
  // 金鳞沿轨塔：从 S 型轨道城市段取样，向两侧垂直偏移 ~0.24 rad，交替分列高架两旁。
  // （轨道改线后塔位自动跟随，避免固定坐标挡路/穿模）
  function computeTracksideGoldSites() {
    if (!trackCurve) return [];
    const ts = [];
    for (let i = 0; i < 720; i++) {
      const t = i / 720;
      trackCurve.getPointAt(t, _pos);
      _dir.copy(_pos).normalize();
      if (_dir.angleTo(cityCenterDir) < 0.55) ts.push(t);
    }
    if (ts.length < 8) return [];
    const sites = [];
    // 2 座均匀分列：前段放一侧、后段放另一侧，形成左右交替；
    // 目标点若被净空过滤，在附近微调位置直至落位，保证不被吞掉。
    const targets = [
      { f: 0.2, side: -1 }, // 前段 → 右侧
      { f: 0.7, side: 1 }, // 后段 → 左侧
    ];
    for (let k = 0; k < targets.length; k++) {
      const preferSide = targets[k].side;
      let placed = false;
      for (const df of [0, -0.03, 0.03, -0.06, 0.06, -0.1, 0.1]) {
        for (const side of [preferSide, -preferSide]) {
          const idx = Math.floor(
            ts.length * THREE.MathUtils.clamp(targets[k].f + df, 0.02, 0.98)
          );
          const t = ts[idx];
          trackCurve.getPointAt(t, _pos);
          trackCurve.getTangentAt(t, _facing);
          _dir.copy(_pos).normalize();
          // 轨道横向（切平面内垂直于切线）
          _basisX.crossVectors(_dir, _facing).normalize();
          const siteDir = _dir.clone().addScaledVector(_basisX, side * 0.245).normalize();
          // 不落在母皇塔脚下（塔身约 0.17 rad，0.22 仍有余量）
          if (grandSites.some((gs) => siteDir.angleTo(gs.dir) < 0.22)) continue;
          if (!trackClear(siteDir, 0.15)) continue;
          sites.push({ dir: siteDir, seed: 4107 + k * 31 });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    return sites;
  }
  const tracksideGoldSites = computeTracksideGoldSites();
  const reservedLandmarkDirs = [
    ...grandSites.map((site) => site.dir),
    ...tracksideGoldSites.map((site) => site.dir),
  ];

  // ---------- 1. 实例化三倍晶体巨构群（错落非等比缩放） ----------
  // 水晶建筑再减半（32→16，性能）；约 55% 向轨道靠拢（沿街峡谷感），
  // 净空按底径换算，保证与轨道/地标/彼此都不重叠。
  const TOTAL = 16;
  const buckets = { 4: [], 5: [], 6: [] };
  const placedDirs = [];
  const placedBuildings = [];
  // 轨道城市段采样（方向 + 横向右向量），供“向轨道靠拢”布点
  const trackCitySamples = [];
  if (trackCurve) {
    for (let i = 0; i < 720; i++) {
      const t = i / 720;
      trackCurve.getPointAt(t, _pos);
      _dir.copy(_pos).normalize();
      if (_dir.angleTo(cityCenterDir) < 0.55) {
        trackCurve.getTangentAt(t, _facing);
        trackCitySamples.push({
          dir: _dir.clone(),
          right: new THREE.Vector3().crossVectors(_dir, _facing).normalize(),
        });
      }
    }
  }
  let attempts = 0;
  while (placedDirs.length < TOTAL && attempts < TOTAL * 180) {
    attempts++;
    const r = (0.45 + rnd() * 0.9) * CITY_BUILDING_SCALE;
    // 不重叠轨道的最小角距：塔底半径 + 桥面半宽(1.7) + 余量(0.6)，按 R 换算
    const minAngle = (r + 2.3) / R;
    let dir;
    if (trackCitySamples.length && rnd() < 0.55) {
      // 向轨道靠拢：取轨道城市段一点，向一侧偏移「净空 + 少量随机」后落定
      const tp = trackCitySamples[(rnd() * trackCitySamples.length) | 0];
      const side = rnd() < 0.5 ? 1 : -1;
      const off = minAngle + 0.02 + rnd() * 0.06;
      dir = tp.dir.clone().addScaledVector(tp.right, side * off).normalize();
    } else {
      const a = rnd() * Math.PI * 2;
      const cityRadius = Math.sqrt(rnd()) * CITY_FOOTPRINT_RADIUS;
      dir = cityDirFromLocal(
        Math.cos(a) * cityRadius,
        Math.sin(a) * cityRadius,
        new THREE.Vector3()
      );
    }
    const canyonDrop = canyonOffsetDir(dir);
    if (!insideCanyon(dir)) continue;
    const centrality = 1 - cityCenterDir.angleTo(dir) / CITY_FOOTPRINT_RADIUS;
    const h =
      (4.8 + Math.max(0, centrality) * 7.5) *
      (0.75 + rnd() * 0.5) *
      CITY_BUILDING_SCALE;
    // 地标净空：塔身 0.17 rad + 自身底径，避免与地标重叠
    if (reservedLandmarkDirs.some((reserved) => dir.angleTo(reserved) < 0.17 + r / R)) continue;
    // 按建筑实际底径做球面间距检测，避免“三倍建筑”彼此堆成一堵墙。
    const root = R + canyonDrop;
    const tooClose = placedBuildings.some((other) => {
      // 塔身向上快速收尖，底座允许轻微错叠；视觉中心仍保持明显分离。
      const needed =
        ((r + other.r + 0.2) * 0.42) / Math.max(24, Math.min(root, other.root));
      return dir.angleTo(other.dir) < needed;
    });
    if (tooClose) continue;
    // 不重叠轨道：按底径换算净空（塔顶再高也只与轨道保持水平间隔）
    if (!trackClear(dir, minAngle)) continue;
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
    placedBuildings.push({ dir: dir.clone(), r, root });
  }

  for (const seg of [4, 5, 6]) {
    const list = buckets[seg];
    if (!list.length) continue;
    const geo = facet(new THREE.CylinderGeometry(0.12, 1, 1, seg));
    geo.translate(0, 0.5, 0); // 底部原点（实例矩阵缩放为最终尺寸）
    const mat = crystalPhysical(); // 玻璃折射
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    // 透明体必须用极细壳线；过厚反向壳会被玻璃透射成“灰色钢筋”。
    const outInst = new THREE.InstancedMesh(geo, outlineMatInstanced(0.012), list.length);
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

  /** 把复合塔扎进峡谷地表，并让 local +Z 朝指定方向。 */
  function placeDetailedTower(tower, dir, facing = null) {
    const rootR = R + canyonOffsetDir(dir);
    tower.position.copy(dir).multiplyScalar(rootR);
    if (facing) {
      _facing.copy(facing).addScaledVector(dir, -facing.dot(dir));
      if (_facing.lengthSq() > 1e-6) {
        _facing.normalize();
        _basisX.crossVectors(dir, _facing).normalize();
        _m.makeBasis(_basisX, dir, _facing);
        tower.quaternion.setFromRotationMatrix(_m);
      } else {
        tower.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
      }
    } else {
      tower.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
    }
    group.add(tower);
    return rootR;
  }

  // ---------- 2. 三座母皇塔移到 8 字线路外侧，形成分散的城市地标 ----------
  const crystals = [];
  for (const gd of grandSites) {
    const dir = gd.dir;
    const tower = createDetailedMoebiusTower({
      stages: 3,
      balcony: true,
      goldScales: true,
      seed: gd.seed,
    });
    tower.name = "moebius-grand-community-tower";
    tower.scale.setScalar(gd.scale * CITY_BUILDING_SCALE);
    tower.rotateY((gd.seed % 11) * 0.19);
    const root = placeDetailedTower(tower, dir);
    const h = tower.userData.height * gd.scale * CITY_BUILDING_SCALE;
    crystals.push({
      group: tower,
      dir: dir.clone(),
      h,
      r: 2.3 * gd.scale * CITY_BUILDING_SCALE,
      root,
    });
  }

  // ---------- 2b. 8 字两叶外侧的金鳞建筑：分列高架两旁，位置固定且预留净空 ----------
  const corridorTowers = [];
  for (const [siteIndex, site] of tracksideGoldSites.entries()) {
    if (trackCurve && !trackClear(site.dir, 0.15)) continue;
    const scale = 0.45 * CITY_BUILDING_SCALE;
    const tower = createDetailedMoebiusTower({
      stages: siteIndex === 1 ? 3 : 2,
      balcony: true,
      goldScales: true,
      seed: site.seed,
    });
    tower.scale.setScalar(scale);
    tower.name = siteIndex === 1
      ? "moebius-trackside-gold-right"
      : "moebius-trackside-gold-left";
    _facing.copy(cityCenterDir).sub(site.dir);
    const root = placeDetailedTower(tower, site.dir, _facing);
    const h = tower.userData.height * scale;
    const record = { group: tower, dir: site.dir.clone(), h, r: 2.2 * scale, root };
    corridorTowers.push(record);
    crystals.push(record);
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
    let dir = null;
    for (let attempt = 0; attempt < 24 && !dir; attempt++) {
      let candidate;
      if (rnd() < 0.78 && seaSpots.length) {
        // 晶体根部附近，但扰动后仍必须留在峡谷内。
        candidate = seaSpots[(rnd() * seaSpots.length) | 0].clone();
        candidate.x += (rnd() - 0.5) * 0.045;
        candidate.y += (rnd() - 0.5) * 0.025;
        candidate.z += (rnd() - 0.5) * 0.045;
        candidate.normalize();
      } else {
        candidate = latLonToDir(
          CANYON.lat + (rnd() - 0.5) * 64,
          CANYON.lon + (rnd() - 0.5) * 90,
          new THREE.Vector3()
        );
      }
      if (insideCanyon(candidate)) dir = candidate;
    }
    if (!dir) dir = grandDir.clone();
    _pos.copy(dir).multiplyScalar(R + 0.06 + canyonOffsetDir(dir));
    _quat.copy(quatYToDir(dir, new THREE.Quaternion()));
    const s = 0.4 + rnd() * 1.1;
    _scl.set(s, 1, s);
    _m.compose(_pos, _quat, _scl);
    sea.setMatrixAt(i, _m);
  }
  sea.instanceMatrix.needsUpdate = true;
  group.add(sea);

  // ---------- 4. 花厅塔群之间的鸟群（穿梭霓虹穹顶走廊） ----------
  const birdFlocks = createMoebiusHallBirdFlocks(group, crystals, rnd);

  group.userData.cityFootprintAngularRadius = CITY_FOOTPRINT_RADIUS;
  group.userData.backgroundBuildingCount = placedDirs.length;
  group.userData.birdFlocks = birdFlocks;
  scene.add(group);
  const grandTop = grandDir
    .clone()
    .multiplyScalar(crystals[0].root + crystals[0].h * 0.96);
  return {
    group,
    crystals,
    corridorTowers,
    grand: crystals[0],
    grandTop,
    birdFlocks,
    /**
     * @param {number} dt
     * @param {number} t
     * @param {{ escortTram?: import("three").Object3D|null }} [opts]
     */
    update(dt, t, opts = {}) {
      birdFlocks.update(dt, t, opts);
    },
  };
}

// ---------------------------------------------------------------------------
//  花厅之间鸟群：低多边剪影，沿塔间航线穿梭
// ---------------------------------------------------------------------------

/**
 * @param {THREE.Group} parent
 * @param {{ group: THREE.Object3D, dir: THREE.Vector3, h: number, root: number }[]} crystals
 * @param {() => number} rnd
 */
function createMoebiusHallBirdFlocks(parent, crystals, rnd) {
  const root = new THREE.Group();
  root.name = "moebius-hall-birds";
  parent.add(root);

  // 花厅巡航：深色剪影；送别伴飞：更大更亮，车窗易见
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0x2a3540,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x1e2830,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const farewellWingMat = new THREE.MeshBasicMaterial({
    color: 0x1a2430,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const farewellBodyMat = new THREE.MeshBasicMaterial({
    color: 0x0f161c,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  function makeBird(scale = 1, farewell = false) {
    const bird = new THREE.Group();
    bird.name = farewell ? "moebius-bird-farewell" : "moebius-bird";
    const wm = farewell ? farewellWingMat : wingMat;
    const bm = farewell ? farewellBodyMat : bodyMat;
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * scale, 0.14 * scale), wm);
    wingL.position.set(-0.28 * scale, 0, 0);
    wingL.rotation.z = 0.38;
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * scale, 0.14 * scale), wm);
    wingR.position.set(0.28 * scale, 0, 0);
    wingR.rotation.z = -0.38;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 5, 4), bm);
    body.scale.set(1.4, 0.7, 0.7);
    bird.add(wingL, wingR, body);
    bird.userData.wingL = wingL;
    bird.userData.wingR = wingR;
    bird.userData.baseScale = scale;
    bird.userData.farewellOnly = farewell;
    return bird;
  }

  // 航点：各花厅塔「中层～上层」世界位置（霓虹穹顶高度带）
  /** @type {THREE.Vector3[]} */
  const halls = [];
  for (const c of crystals) {
    if (!c?.dir || !Number.isFinite(c.root) || !Number.isFinite(c.h)) continue;
    const up = c.dir.clone().normalize();
    // 两层高度：约 1/3、2/3 塔高（对应花厅错落层）
    for (const frac of [0.32, 0.55, 0.72]) {
      halls.push(up.clone().multiplyScalar(c.root + c.h * frac));
    }
  }
  // 若塔少，补谷心上空漫游点
  if (halls.length < 4) {
    const mid = crystals[0]?.dir?.clone().normalize() || new THREE.Vector3(0, -1, 0);
    const r0 = crystals[0]?.root || 40;
    halls.push(mid.clone().multiplyScalar(r0 + 12));
    halls.push(mid.clone().multiplyScalar(r0 + 18));
  }

  const _pos = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _tramPos = new THREE.Vector3();
  const _tramFwd = new THREE.Vector3();
  const _escortPos = new THREE.Vector3();
  const _patrolPos = new THREE.Vector3();
  const _patrolTan = new THREE.Vector3();
  const _patrolUp = new THREE.Vector3();
  const _patrolRight = new THREE.Vector3();
  /** 0=花厅巡航 · 1=电车伴飞（平滑过渡） */
  let escortBlend = 0;

  /**
   * 在闭合折线航点上按参数 u∈[0,1) 采样位置与切线
   * @param {THREE.Vector3[]} pts
   * @param {number} u
   * @param {THREE.Vector3} outPos
   * @param {THREE.Vector3} outTan
   */
  function sampleLoop(pts, u, outPos, outTan) {
    const n = pts.length;
    if (n === 0) {
      outPos.set(0, 0, 0);
      outTan.set(1, 0, 0);
      return;
    }
    if (n === 1) {
      outPos.copy(pts[0]);
      outTan.set(1, 0, 0);
      return;
    }
    const seg = ((u % 1) + 1) % 1;
    const f = seg * n;
    const i0 = Math.floor(f) % n;
    const i1 = (i0 + 1) % n;
    const local = f - Math.floor(f);
    const s = local * local * (3 - 2 * local);
    outPos.lerpVectors(pts[i0], pts[i1], s);
    outTan.subVectors(pts[i1], pts[i0]);
    if (outTan.lengthSq() < 1e-8) outTan.set(1, 0, 0);
    else outTan.normalize();
  }

  /** @type {{ birds: THREE.Group[], path: THREE.Vector3[], speed: number, phase: number }[]} */
  const flocks = [];
  const flockCount = Math.min(6, Math.max(3, (crystals.length * 1.2) | 0));

  for (let f = 0; f < flockCount; f++) {
    // 每群选 3～4 个花厅航点构成闭合航线
    const path = [];
    const pickN = 3 + ((rnd() * 2) | 0);
    let idx = (rnd() * halls.length) | 0;
    for (let k = 0; k < pickN; k++) {
      path.push(halls[idx % halls.length].clone());
      idx += 1 + ((rnd() * Math.max(1, (halls.length / pickN) | 0)) | 0);
    }
    // 相对质心外推，航线走在塔间走廊而非穿心
    const centroid = new THREE.Vector3();
    for (const p of path) centroid.add(p);
    centroid.multiplyScalar(1 / path.length);
    for (const p of path) p.lerp(centroid, -0.14);

    const flockG = new THREE.Group();
    flockG.name = `moebius-bird-flock-${f}`;
    root.add(flockG);

    const birdN = 5 + ((rnd() * 5) | 0);
    /** @type {THREE.Group[]} */
    const birds = [];
    for (let b = 0; b < birdN; b++) {
      const sc = 0.9 + rnd() * 0.65;
      const bird = makeBird(sc);
      bird.userData.lane = (b - (birdN - 1) * 0.5) * (0.65 + rnd() * 0.3);
      bird.userData.lag = rnd() * 0.09;
      bird.userData.bob = rnd() * Math.PI * 2;
      bird.userData.flapSpeed = 9 + rnd() * 5;
      flockG.add(bird);
      birds.push(bird);
    }

    flocks.push({
      birds,
      path,
      speed: 0.032 + rnd() * 0.03,
      phase: rnd(),
      escortOnly: false,
    });
  }

  // 专属送别编队：更大只数，平时藏在城缘，离城时贴车
  {
    const path = halls.slice(0, Math.min(4, halls.length)).map((p) => p.clone());
    if (path.length < 2 && halls[0]) {
      path.push(halls[0].clone().add(new THREE.Vector3(2, 2, 0)));
    }
    const flockG = new THREE.Group();
    flockG.name = "moebius-bird-flock-farewell";
    root.add(flockG);
    const birds = [];
    const birdN = 14;
    for (let b = 0; b < birdN; b++) {
      const sc = 1.6 + rnd() * 0.9;
      const bird = makeBird(sc, true);
      bird.userData.lane = (b - (birdN - 1) * 0.5) * 0.85;
      bird.userData.lag = rnd() * 0.12;
      bird.userData.bob = rnd() * Math.PI * 2;
      bird.userData.flapSpeed = 11 + rnd() * 4;
      bird.visible = false;
      flockG.add(bird);
      birds.push(bird);
    }
    flocks.push({
      birds,
      path: path.length ? path : halls.slice(0, 1),
      speed: 0.04,
      phase: rnd(),
      escortOnly: true,
    });
  }

  /**
   * @param {number} dt
   * @param {number} t
   * @param {{ escortTram?: import("three").Object3D|null }} [opts]
   *   escortTram：离城送别目标电车
   */
  function update(dt, t, opts = {}) {
    const escortTram = opts.escortTram || null;
    const wantEscort = !!escortTram;
    // 快速融入（~0.8s），散开稍慢
    const blendRate = wantEscort ? 2.2 : 0.7;
    const targetBlend = wantEscort ? 1 : 0;
    escortBlend += (targetBlend - escortBlend) * Math.min(1, (dt || 1 / 60) * blendRate);
    if (Math.abs(escortBlend - targetBlend) < 0.002) escortBlend = targetBlend;

    let hasTram = false;
    if (escortTram && escortBlend > 0.02) {
      escortTram.getWorldPosition(_tramPos);
      _tramFwd.set(1, 0, 0).applyQuaternion(escortTram.quaternion);
      _up.copy(_tramPos).normalize();
      _tramFwd.addScaledVector(_up, -_tramFwd.dot(_up));
      if (_tramFwd.lengthSq() < 1e-8) _tramFwd.set(0, 0, 1).addScaledVector(_up, -_up.z);
      _tramFwd.normalize();
      _right.crossVectors(_up, _tramFwd).normalize();
      // 右舷归一化失败时兜底
      if (_right.lengthSq() < 1e-8) _right.set(0, 0, 1);
      else _right.normalize();
      hasTram = true;
    }

    let birdGlobal = 0;
    for (const flock of flocks) {
      const escortOnly = !!flock.escortOnly;
      // 专属送别队：只在伴飞时显示
      if (escortOnly) {
        const show = escortBlend > 0.05;
        for (const bird of flock.birds) bird.visible = show;
        if (!show) {
          birdGlobal += flock.birds.length;
          continue;
        }
      }

      const u0 = (flock.phase + t * flock.speed) % 1;
      for (const bird of flock.birds) {
        const u = (u0 - (bird.userData.lag || 0) + 1) % 1;
        // ---- 花厅巡航位 ----
        if (flock.path?.length) {
          sampleLoop(flock.path, u, _patrolPos, _patrolTan);
        } else {
          _patrolPos.copy(_tramPos);
          _patrolTan.copy(_tramFwd);
        }
        _patrolUp.copy(_patrolPos).normalize();
        _patrolTan.addScaledVector(_patrolUp, -_patrolTan.dot(_patrolUp));
        if (_patrolTan.lengthSq() < 1e-8) _patrolTan.set(1, 0, 0);
        else _patrolTan.normalize();
        _patrolRight.crossVectors(_patrolUp, _patrolTan).normalize();
        {
          const lane = bird.userData.lane || 0;
          const bob =
            Math.sin(t * 2.2 + bird.userData.bob) * 0.45 +
            Math.sin(t * 5.1 + lane) * 0.18;
          _patrolPos
            .addScaledVector(_patrolRight, lane)
            .addScaledVector(_patrolUp, bob + Math.abs(lane) * 0.12);
        }

        // ---- 电车伴飞：大编队侧上方（城市尺度可见）----
        if (hasTram) {
          const i = birdGlobal;
          const side = i % 2 === 0 ? 1 : -1;
          const row = (i / 2) | 0;
          const orbit = t * 1.35 + bird.userData.bob;
          // 车身尺度约数米～十余米，编队拉开
          const sideDist = 5.5 + row * 1.1 + Math.sin(orbit) * 0.8;
          const upDist = 3.8 + (row % 4) * 0.9 + Math.sin(orbit * 1.3) * 0.55;
          const backDist = -0.5 - row * 1.15 - (bird.userData.lag || 0) * 10;
          _escortPos
            .copy(_tramPos)
            .addScaledVector(_right, side * sideDist)
            .addScaledVector(_up, upDist)
            .addScaledVector(_tramFwd, backDist);
        } else {
          _escortPos.copy(_patrolPos);
        }

        const k = escortOnly
          ? escortBlend
          : escortBlend * escortBlend * (3 - 2 * escortBlend);
        bird.position.lerpVectors(_patrolPos, _escortPos, k);

        // 送别时放大，车窗更明显
        const sc = (bird.userData.baseScale || 1) * (1 + k * 1.35);
        bird.scale.setScalar(sc);

        if (k > 0.35 && hasTram) {
          _target.copy(bird.position).add(_tramFwd);
          bird.up.copy(_up);
        } else {
          _target.copy(bird.position).add(_patrolTan);
          bird.up.copy(_patrolUp);
        }
        bird.lookAt(_target);

        const flapMul = 1 + k * 0.85;
        const flap =
          Math.sin(t * bird.userData.flapSpeed * flapMul + bird.userData.bob) * (0.55 + k * 0.2);
        if (bird.userData.wingL) bird.userData.wingL.rotation.z = 0.38 + flap;
        if (bird.userData.wingR) bird.userData.wingR.rotation.z = -0.38 - flap;

        birdGlobal++;
      }
    }
  }

  return {
    group: root,
    flocks,
    update,
  };
}

/** 旧名兼容 */
export const buildMoebiusCity = buildMoebiusCrystalMetropolis;
