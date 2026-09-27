import {factoryFreightStops, factoryFreightEntry} from './bookshopLoadingYards.js';
// =====================================================================
//  基督城有轨电车环形轨道系统
//  平面设计坐标上的平滑环线：不爬坡、不进建筑、无锐角弯
//  CatmullRomCurve3 闭合环；双线四钢轨贴球面；红/蓝电车相向运行
// =====================================================================
import * as THREE from "three";
import {gateThirtyRound} from "./gateTargetThirty.js";
import {mergeStaticGroup} from "./geometryMerge.js";
import {citadelCoastalTramPoints, citadelCoastalTramEnabled, inCitadelTramTunnel} from "./citadel/coastalTramRoute.js";
import {addCitadelCoastalTramStructures, inCitadelCoastalWindow} from "./citadel/coastalTramStructures.js";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createFreightVehicle, FREIGHT_PITCH, FREIGHT_WAGONS } from "../assets/freightTrain.js";
import { flatToWorld, latLonToDir, quatYToDir } from "./sphereMath.js";
import { groundLiftAt, worldToFlatXZ, ISLAND_BASE_LIFT } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { updateTramSound } from "../audio/sfx.js";
import { LAKE, HARBOR } from "./lake.js";
import { CANYON, canyonOffsetDir, canyonOffsetDirSmooth } from "./canyon.js";
import { citadelRangeLiftDir, citadelWalkLiftDir } from "./citadelRange.js";
import { WORLD_SCALE } from "./worldScale.js";

const WORLD_LAYOUT_SCALE = WORLD_SCALE;

const SLEEPER = 0x3e2723;
const RAIL = 0x757575;
const SURFACE_EPS = 0.08;
const BOARDING_RADIUS = 3.6;
const LANE_OFFSET = 0.9; // 两条线路中心距 1.8，车辆交会保留约 0.7 净空
const RAIL_GAUGE_HALF = 0.32;

// 轨道只贴岛面/缓坡，不随山丘抬升（禁止“上山坡”）
const TRACK_LIFT_CAP = ISLAND_BASE_LIFT + 0.1;
const BOOKSHOP_HILL_DIR = new THREE.Vector3(-47, 152, 27).normalize();

const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _tramWorld = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/** 轨道用地形抬升：封顶，避免爬上书店山/北脊等 */
export function trackLiftAt(x, z) {
  const raw = groundLiftAt(x, z);
  return Math.min(raw, TRACK_LIFT_CAP);
}

/**
 * 选线避障：山丘核、书店、池塘、出生点、月牙湖、修船厂码头
 * 迭代推开，保证落在平缓地面走廊、不穿模码头。
 */
function clearForTrack(x, z) {
  // 山丘：与 HILL_DEFS 对齐（hills.js），核半径略放大作禁区
  const hills = [
    { x: -1.8 * WORLD_LAYOUT_SCALE, z: -12.6 * WORLD_LAYOUT_SCALE, r: 3.6 * WORLD_LAYOUT_SCALE },
    { x: 0.4 * WORLD_LAYOUT_SCALE, z: -12.4 * WORLD_LAYOUT_SCALE, r: 4.0 * WORLD_LAYOUT_SCALE },
    { x: 2.2 * WORLD_LAYOUT_SCALE, z: -11.2 * WORLD_LAYOUT_SCALE, r: 3.2 * WORLD_LAYOUT_SCALE },
    { x: -5.2 * WORLD_LAYOUT_SCALE, z: -8.6 * WORLD_LAYOUT_SCALE, r: 3.8 * WORLD_LAYOUT_SCALE },
    { x: -7.6 * WORLD_LAYOUT_SCALE, z: -5.4 * WORLD_LAYOUT_SCALE, r: 3.4 * WORLD_LAYOUT_SCALE },
    { x: -6.2 * WORLD_LAYOUT_SCALE, z: 1.6 * WORLD_LAYOUT_SCALE, r: 4.0 * WORLD_LAYOUT_SCALE },
    { x: 8.8 * WORLD_LAYOUT_SCALE, z: 4.8 * WORLD_LAYOUT_SCALE, r: 3.6 * WORLD_LAYOUT_SCALE },
    { x: 6.6 * WORLD_LAYOUT_SCALE, z: -7.6 * WORLD_LAYOUT_SCALE, r: 3.2 * WORLD_LAYOUT_SCALE },
    { x: 4.6 * WORLD_LAYOUT_SCALE, z: -9.8 * WORLD_LAYOUT_SCALE, r: 2.8 * WORLD_LAYOUT_SCALE },
    { x: 5.8 * WORLD_LAYOUT_SCALE, z: 6.8 * WORLD_LAYOUT_SCALE, r: 3.0 * WORLD_LAYOUT_SCALE },
    { x: 11.5 * WORLD_LAYOUT_SCALE, z: 5.5 * WORLD_LAYOUT_SCALE, r: 5.5 * WORLD_LAYOUT_SCALE },
    { x: -18.1 * WORLD_LAYOUT_SCALE, z: 6.2 * WORLD_LAYOUT_SCALE, r: 3.6 * WORLD_LAYOUT_SCALE },
  ];
  // 圆禁区：月牙湖水域 + 修船厂码头（栈桥/船/吊车）
  const hardCircles = [
    { x: LAKE.x, z: LAKE.z, r: LAKE.pathOuter + 1.4 }, // 湖+小径
    { x: HARBOR.x, z: HARBOR.z, r: HARBOR.clearR }, // 码头整景
  ];
  // 池塘椭圆
  const pond = { x: 0, z: 9.1 * WORLD_LAYOUT_SCALE, rx: 10.5 * WORLD_LAYOUT_SCALE, rz: 5.8 * WORLD_LAYOUT_SCALE };
  // 出生点净空
  const spawn = { x: 0, z: 6 * WORLD_LAYOUT_SCALE, r: 3.2 };

  let px = x;
  let pz = z;
  // 软排斥：禁区内满推、缓冲区渐变到 0——平衡点落在光滑的等距偏移线上，
  // 不会像硬钳位那样在边界处形成固定尖角。
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    const softPush = (cx, cz, r, margin) => {
      const dx = px - cx;
      const dz = pz - cz;
      const d = Math.hypot(dx, dz) || 1e-4;
      const lim = r + margin;
      if (d < lim) {
        const w = d < r ? 1 : 1 - (d - r) / margin;
        const k = ((lim - d) / d) * 0.28 * w;
        px += dx * k;
        pz += dz * k;
        moved = true;
      }
    };
    for (const h of hills) softPush(h.x, h.z, h.r, 1.2);
    // 月牙湖 + 码头（硬景，缓冲区略大）
    for (const c of hardCircles) softPush(c.x, c.z, c.r, 1.3);
    // 池塘（椭圆 → 归一化圆处理）
    {
      const nx = (px - pond.x) / pond.rx;
      const nz = (pz - pond.z) / pond.rz;
      const d = Math.hypot(nx, nz) || 1e-6;
      const lim = 1.0 + 0.16;
      if (d < lim) {
        const w = d < 1 ? 1 : 1 - (d - 1) / 0.16;
        const k = ((lim - d) / d) * 0.28 * w;
        px += nx * pond.rx * k;
        pz += nz * pond.rz * k;
        moved = true;
      }
    }
    softPush(spawn.x, spawn.z, spawn.r, 0.9);
    // 岛缘环带（软收束，轨道主要在岛面走廊 r≈9~14）
    const rr = Math.hypot(px, pz) || 1e-4;
    if (rr > 15.2 * WORLD_LAYOUT_SCALE) {
      const k = ((rr - 15.2 * WORLD_LAYOUT_SCALE) / rr) * 0.3;
      px -= px * k;
      pz -= pz * k;
      moved = true;
    }
    if (rr < 8.2 * WORLD_LAYOUT_SCALE) {
      const k = ((8.2 * WORLD_LAYOUT_SCALE - rr) / rr) * 0.3;
      px += px * k;
      pz += pz * k;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

/**
 * 生成平滑环路控制点（平面坐标）
 * 密集采样 + 避障 + 再做角点平滑，保证无锐角
 */
function buildSmoothLoopFlat() {
  // 基础椭圆环（逆时针）：营地 → 东绕书店 → 南绕码头外侧 → 西 → 北回
  // 故意从月牙湖/修船厂南侧外缘走，避免穿栈桥与渔船
  const raw = [];
  const N = 32;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    // 略扁椭圆；圆心偏西南，给东南码头让出走廊
    const rx = (11.6 + 0.55 * Math.cos(2 * t)) * WORLD_LAYOUT_SCALE;
    const rz = (10.4 + 0.45 * Math.sin(2 * t)) * WORLD_LAYOUT_SCALE;
    let x = rx * Math.cos(t) + 0.6 * WORLD_LAYOUT_SCALE;
    let z = rz * Math.sin(t) - 2.2 * WORLD_LAYOUT_SCALE;
    // 东侧外推，书店 (11.5,5.5)
    if (x > 6 * WORLD_LAYOUT_SCALE && z > 0) {
      x += 1.4 * WORLD_LAYOUT_SCALE;
      z -= 0.9 * WORLD_LAYOUT_SCALE;
    }
    // 东南象限：强制走码头南/外侧
    if (x > 4 * WORLD_LAYOUT_SCALE && z < 2 * WORLD_LAYOUT_SCALE && z > -11 * WORLD_LAYOUT_SCALE) {
      const dx = x - HARBOR.x;
      const dz = z - HARBOR.z;
      const d = Math.hypot(dx, dz);
      if (d < HARBOR.clearR + 2.5) {
        // 优先推向南侧外缘，其次东侧
        const preferSouth = z > HARBOR.z - 1.5;
        if (preferSouth) {
          x = HARBOR.x + Math.max(dx, 0.5);
          z = HARBOR.z - (HARBOR.clearR + 1.2);
        } else {
          const k = (HARBOR.clearR + 1.4) / Math.max(d, 1e-3);
          x = HARBOR.x + dx * k;
          z = HARBOR.z + dz * k;
        }
      }
    }
    // 月牙湖：环线不进湖面
    {
      const dx = x - LAKE.x;
      const dz = z - LAKE.z;
      const d = Math.hypot(dx, dz);
      const lakeR = LAKE.pathOuter + 1.6;
      if (d < lakeR) {
        const k = lakeR / Math.max(d, 1e-3);
        x = LAKE.x + dx * k;
        z = LAKE.z + dz * k;
      }
    }
    // 北侧（z 大）再压南，远离池
    if (z > 5 * WORLD_LAYOUT_SCALE) z = 5 * WORLD_LAYOUT_SCALE - (z - 5 * WORLD_LAYOUT_SCALE) * 0.35;
    const c = clearForTrack(x, z);
    raw.push(c);
  }

  // 二次平滑：相邻三点做轻微切角（再避障）
  const smooth = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[(i - 1 + raw.length) % raw.length];
    const b = raw[i];
    const c = raw[(i + 1) % raw.length];
    const x = b.x * 0.5 + a.x * 0.25 + c.x * 0.25;
    const z = b.z * 0.5 + a.z * 0.25 + c.z * 0.25;
    smooth.push(clearForTrack(x, z));
  }

  // 验证并修正锐角：若转弯过急，在中点插入过渡点
  const MAX_TURN_DEG = 28; // 单步转向上限 → 内角 ≥ 152°（电车钝角弯）
  const final = [];
  for (let i = 0; i < smooth.length; i++) {
    const prev = smooth[(i - 1 + smooth.length) % smooth.length];
    const cur = smooth[i];
    const next = smooth[(i + 1) % smooth.length];
    const v1x = cur.x - prev.x;
    const v1z = cur.z - prev.z;
    const v2x = next.x - cur.x;
    const v2z = next.z - cur.z;
    const l1 = Math.hypot(v1x, v1z) || 1;
    const l2 = Math.hypot(v2x, v2z) || 1;
    const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
    const ang = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
    const turnDeg = THREE.MathUtils.radToDeg(ang);
    if (turnDeg > MAX_TURN_DEG) {
      // 插入两个过渡点摊平转角
      final.push(clearForTrack(prev.x * 0.35 + cur.x * 0.65, prev.z * 0.35 + cur.z * 0.65));
      final.push(cur);
      final.push(clearForTrack(cur.x * 0.65 + next.x * 0.35, cur.z * 0.65 + next.z * 0.35));
    } else {
      final.push(cur);
    }
  }

  // —— 密集环交替「轻平滑 → 避障 → 均匀化」：不塌缩、不入障、无锐角 ——
  // 关键在「均匀化」：每轮重采样回等弧长间距，打断“硬推挤→间距不均→平滑聚簇”的反馈。
  const DENSE = 256;
  const mkCurve = (pts) =>
    new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p.x, 0, p.z)),
      true,
      "centripetal",
      0.5
    );
  const sampleRing = (curve, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = curve.getPointAt(i / n);
      out.push({ x: p.x, z: p.z });
    }
    return out;
  };
  let ring = sampleRing(mkCurve(final), DENSE);
  for (let round = 0; round < 4; round++) {
    // 轻平滑 2 轮（下陷量小，随后避障推挤也小，不会聚簇）
    for (let s = 0; s < 2; s++) {
      const src = ring.map((p) => ({ ...p }));
      for (let i = 0; i < DENSE; i++) {
        const a = src[(i - 1 + DENSE) % DENSE];
        const b = src[i];
        const c = src[(i + 1) % DENSE];
        ring[i] = {
          x: (a.x + 2 * b.x + c.x) / 4,
          z: (a.z + 2 * b.z + c.z) / 4,
        };
      }
    }
    for (let i = 0; i < DENSE; i++) ring[i] = clearForTrack(ring[i].x, ring[i].z);
    ring = sampleRing(mkCurve(ring), DENSE); // 均匀化：消除间距堆积
  }
  return sampleRing(mkCurve(ring), 64);
}

function surfacePointFromFlat(x, z, R, out = new THREE.Vector3()) {
  const lift = trackLiftAt(x, z);
  return flatToWorld(x, lift + SURFACE_EPS, z, R, out);
}

const VIADUCT_HEIGHT = 0.3; // 高架恒高（裸面之上）
const ISLAND_EDGE_DIST = 18 * WORLD_LAYOUT_SCALE; // 主岛平面足迹半径（与 hills.groundLiftAt 一致）

function smooth01(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 轨面目标半径：单一连续函数，杜绝“岛面平铺 / 南半球高架”分段硬切换。
 * 岛上贴地；岛缘外 18→20.2 从岛缘地面平滑缓降到高架高度（不降入岛体）；
 * 南半球高架恒高，峡谷深处随阶梯谷底保持净空（min 门限保证谷缘不被迫抬升）。
 */
function trackSurfaceRadiusAt(dir, R) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    const dist = Math.hypot(flat.x, flat.z);
    // 书店镇东侧小丘只高出轨面约 1 米：放开抬升上限让轨道翻坡而过，不再生成隧道（用户 2026-09-24）
    const overHill = dir.clone().normalize().angleTo(BOOKSHOP_HILL_DIR) * R < 48;
    const ground = overHill ? groundLiftAt(flat.x, flat.z) + 0.15 : Math.min(groundLiftAt(flat.x, flat.z), TRACK_LIFT_CAP);
    const w = smooth01((dist - ISLAND_EDGE_DIST) / 2.2);
    const edgeLevel = ISLAND_BASE_LIFT + SURFACE_EPS;
    return R + Math.max(
      ground + SURFACE_EPS,
      THREE.MathUtils.lerp(edgeLevel, VIADUCT_HEIGHT, w)
    );
  }
  // 净空 = 连续谷底 + 3.55（2.35 净空 + 1.2 阶梯量化余量）：
  // 连续版谷底与真实阶梯地形最大偏差约 1.07，加余量后全程仍在真实地面之上，
  // 且函数本身连续——既不被阶梯边界甩出台阶，也不会穿地。
  // min 门限保证谷缘不被迫抬升。（立柱脚仍用阶梯版 groundRadiusAt 落到真实地形）
  const drop = canyonOffsetDirSmooth(dir);
  return R + Math.min(VIADUCT_HEIGHT, drop + 3.55);
}

const _tmpNorm = new THREE.Vector3();

/** 立柱/桥面判定用地面半径（岛上=地面，城堡=高山，岛外=裸面/阶梯谷底） */
function groundRadiusAt(dir, R) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) return R + groundLiftAt(flat.x, flat.z);
  _tmpNorm.copy(dir).normalize();
  const cit = typeof citadelRangeLiftDir === "function" ? Math.max(citadelRangeLiftDir(_tmpNorm), citadelWalkLiftDir?.(_tmpNorm) || 0) : 0;
  if (cit > 0.05) return R + cit;
  return R + canyonOffsetDir(_tmpNorm);
}

/** 曲线采样点贴轨面：原始 authored 半径与连续目标半径取较大值 */
function surfacePoint(dir, R, out = new THREE.Vector3()) {
  const authoredRadius = dir.length();
  out.copy(dir).normalize();
  const radius = Math.max(authoredRadius, trackSurfaceRadiusAt(out, R));
  return out.multiplyScalar(radius);
}

/**
 * 平滑下界（供二次钳制）：岛面只保底（authored 已贴地形，不再强加凹凸目标），
 * 岛缘斜坡与峡谷净空为连续函数——避免 max() 在平滑曲线与起伏地形间产生摆动折角。
 */
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

/** 基于中心曲线沿球面横向偏移，生成一条完整的平行线路（输入曲线已投影，不再二次投影）。 */
function buildParallelCurve(centerCurve, offset, R) {
  const points = [];
  const SEG = 420;
  for (let i = 0; i < SEG; i++) {
    const t = i / SEG;
    centerCurve.getPointAt(t, _p);
    centerCurve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    const radius = _p.length();
    points.push(
      _p.clone().addScaledVector(_right, offset).normalize().multiplyScalar(radius)
    );
  }
  return new THREE.CatmullRomCurve3(points, true, "centripetal", 0.5);
}

function addTrackLane(group, curve, R, sleeperMat, railMat) {
  const trackLen = curve.getLength();
  const sleeperCount = Math.max(32, Math.floor(trackLen / 1.35));
  for (let i = 0; i < sleeperCount; i++) {
    const t = i / sleeperCount;
    curve.getPointAt(t, _p);
    curve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    // 保留 8 字升降轨道的真实三维切线，以正交化后的法线作为车体 Up。
    _up.crossVectors(_fwd, _right).normalize();
    _m.makeBasis(_right, _up, _fwd);
    const sleeper = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.88, 0.06, 0.24)),
      sleeperMat
    );
    sleeper.name="tram-static-sleeper";
    sleeper.quaternion.setFromRotationMatrix(_m);
    sleeper.position.copy(_p);
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  for (const railSide of [-1, 1]) {
    const railPoints = [];
    const SEG = 360;
    for (let i = 0; i < SEG; i++) {
      const t = i / SEG;
      curve.getPointAt(t, _p);
      curve.getTangentAt(t, _fwd).normalize();
      _up.copy(_p).normalize();
      _right.crossVectors(_up, _fwd).normalize();
      const radius = _p.length();
      railPoints.push(
        _p.clone()
          .addScaledVector(_right, railSide * RAIL_GAUGE_HALF)
          .normalize()
          .multiplyScalar(radius + 0.06)
      );
    }
    const railCurve = new THREE.CatmullRomCurve3(railPoints, true, "centripetal", 0.5);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 520, 0.035, 5, true),
      railMat
    );
    rail.castShadow = true;
    addOutline(rail, 0.01);
    group.add(rail);
  }
}

/** 沿曲线扫掠一条连续带状体（桥面/侧梁）：随坡度倾斜、无箱体拼接台阶。 */
function sweepTrackRibbon(samples, width, topOffset, bottomOffset, lateral, mat) {
  const n = samples.length;
  const half = width / 2;
  const positions = new Float32Array(n * 4 * 3);
  const v = new THREE.Vector3();
  const write = (idx, s, side, upOff) => {
    v.copy(s.p).addScaledVector(s.right, side).addScaledVector(s.up, upOff);
    positions[idx] = v.x;
    positions[idx + 1] = v.y;
    positions[idx + 2] = v.z;
  };
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    write(i * 12 + 0, s, lateral - half, topOffset);    // topL
    write(i * 12 + 3, s, lateral + half, topOffset);    // topR
    write(i * 12 + 6, s, lateral - half, bottomOffset); // botL
    write(i * 12 + 9, s, lateral + half, bottomOffset); // botR
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1);              // 顶面
    idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);  // 底面
    idx.push(a, a + 2, b, a + 2, b + 2, b);              // 左壁
    idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);  // 右壁
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 连续高架桥面 + 双侧梁：覆盖岛缘→跨洋→峡谷→水晶城 8 字→回岛的全程高架段。
 * 一整条扫掠带状几何（非箱体段拼接），随坡度倾斜，彻底消除段间台阶。
 */
function addViaductDeck(group, curve, R, allSegments=false) {
  const deckMat = toonMat(0x66717c, { flatShading: true, side: THREE.DoubleSide });
  const girderMat = toonMat(0x39434d, { flatShading: true, side: THREE.DoubleSide });
  const trackLen = curve.getLength();
  const N = Math.max(240, Math.floor(trackLen / 0.6));
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) % 1;
    curve.getPointAt(t, _p);
    curve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _up.crossVectors(_fwd, _right).normalize();
    samples.push({
      p: _p.clone(),
      right: _right.clone(),
      up: _up.clone(),
      elevated: _p.length() - groundRadiusAt(_p, R) > 0.15,
    });
  }
  // 岛面贴地段是唯一非高架连续弧；旋转数组后取唯一的高架连续段
  const groundIdx = samples.findIndex((s) => !s.elevated);
  if (groundIdx < 0) return null;
  const ordered = [...samples.slice(groundIdx + 1), ...samples.slice(0, groundIdx + 1)];
  let run = [];
  const runs=[];
  for (const s of ordered) {
    if (!s.elevated) {
      if (run.length) {
        if(!allSegments)break;
        runs.push(run);run=[];
      }
      continue;
    }
    run.push(s);
  }
  if(run.length)runs.push(run);
  if(!runs.some(r=>r.length>=2))return null;
  const viaduct = new THREE.Group();
  viaduct.name = "moebius-city-viaduct";
  for(const run of runs){
  if(run.length<2)continue;
  const deck = sweepTrackRibbon(run, 3.35, -0.06, -0.24, 0, deckMat);
  addOutline(deck, 0.012);
  viaduct.add(deck);
  for (const side of [-1.58, 1.58]) {
    const girder = sweepTrackRibbon(run, 0.12, -0.24, -0.7, side, girderMat);
    addOutline(girder, 0.01);
    viaduct.add(girder);
  }
  }
  group.add(viaduct);
  return viaduct;
}

/**
 * 2026-09-18 涵洞系统（主人）：有轨电车穿行高山古堡山体与主岛丘陵时，
 * 为其建立完整的双向石券涵洞（含进出拱券门额、八字翼墙、连续拱顶涵身与内壁暖光照明）。
 */
function addTramCulverts(group, curve, R) {
  const N = 720;
  const flags = new Array(N).fill(false);
  const forced = new Array(N).fill(false);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    curve.getPointAt(t, _p);
    const terrR = groundRadiusAt(_p, R);
    const trackR = _p.length();
    if (terrR - trackR > 0.08) {
      flags[i] = true;
    }
    // 圣城新城山体隧道（用户 2026-09-24）：山体为网格而非解析地形，按区域强制成洞
    if (citadelCoastalTramEnabled() && inCitadelTramTunnel(_p)) { flags[i] = true; forced[i] = true; }
  }

  // 余量外扩 4 个采样点（约 9 米），确保洞门稳健立于山体外侧坡面
  const expanded = [...flags];
  const MARGIN = 4;
  for (let i = 0; i < N; i++) {
    // 强制段（圣城新城隧道）按实测覆土定界，不再外扩，洞门贴崖脚、洞壳不伸出山体
    if (flags[i] && !forced[i]) {
      for (let d = -MARGIN; d <= MARGIN; d++) {
        expanded[(i + d + N) % N] = true;
      }
    }
  }

  let firstFalse = -1;
  for (let i = 0; i < N; i++) {
    if (!expanded[i]) { firstFalse = i; break; }
  }
  if (firstFalse < 0) return;

  const runs = [];
  let inRun = false;
  let start = 0;
  for (let offset = 0; offset < N; offset++) {
    const idx = (firstFalse + offset) % N;
    if (expanded[idx]) {
      if (!inRun) {
        inRun = true;
        start = idx;
      }
    } else {
      if (inRun) {
        inRun = false;
        const end = (idx - 1 + N) % N;
        runs.push({ start, end });
      }
    }
  }
  if (inRun) {
    const end = (firstFalse - 1 + N) % N;
    runs.push({ start, end });
  }

  if (!runs.length) return;

  // 2026-09-18 主人（建筑业界规律）：涵洞只在轨道真正穿越足够厚的山体处才有意义。
  // 过滤：①覆盖段弧长 ≥ 30 单位（N=720 全环采样，1 点 ≈ 2 单位）
  //      ②段内最大埋深 ≥ 1.0 单位（浅皮土丘不配涵洞，避免"孤门立平地"）
  var minRunLen = 0, minRunIdx = -1;
  for (var r = 0; r < runs.length; r++) {
    var len = (runs[r].end - runs[r].start + N) % N + 1;
    if (minRunIdx < 0 || len > (runs[minRunIdx].end - runs[minRunIdx].start + N) % N + 1) minRunIdx = r;
  }
  var depthOf = function (idx) {
    var p2 = curve.getPointAt(idx / N, new THREE.Vector3());
    return groundRadiusAt(p2, R) - p2.length();
  };
  var kept = [];
  for (var r = 0; r < runs.length; r++) {
    var g = runs[r];
    var len = (g.end - g.start + N) % N + 1;
    var maxDepth = 0;
    for (var k = 0; k <= len; k++) {
      var dd = depthOf((g.start + k) % N);
      if (dd > maxDepth) maxDepth = dd;
    }
    let isForced = false;
    for (let k = 0; k < len && !isForced; k++) isForced = forced[(g.start + k) % N];
    if (isForced || (len >= 15 && maxDepth >= 0.85)) kept.push(g);
    else console.log("[tram] 涵洞跳过：覆盖段 " + len + " 点、最大埋深 " + maxDepth.toFixed(2) + " 不足");
  }
  runs.length = 0;
  for (var k = 0; k < kept.length; k++) runs.push(kept[k]);
  if (!runs.length) return;

  const stoneMat = toonMat(0x565c64, { flatShading: true, side: THREE.DoubleSide });
  const trimMat = toonMat(0x3e434a, { flatShading: true });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd175 });

  const PROFILE = [
    // 外拱形轮廓（外壁厚约 0.45m）
    [-2.75, -0.25],
    [-2.75, 2.15],
    [-1.9, 3.55],
    [0, 4.38],
    [1.9, 3.55],
    [2.75, 2.15],
    [2.75, -0.25],
    // 内拱形轮廓（内净空高 3.8m，宽 4.5m，完全包络双轨与电车）
    [2.25, -0.05],
    [2.25, 2.0],
    [1.55, 3.1],
    [0, 3.75],
    [-1.55, 3.1],
    [-2.25, 2.0],
    [-2.25, -0.05],
  ];
  const M = PROFILE.length;

  for (let runIdx = 0; runIdx < runs.length; runIdx++) {
    const { start: runStart, end: runEnd } = runs[runIdx];
    const ptCount = (runEnd - runStart + N) % N + 1;
    if (ptCount < 4) continue;

    const samples = [];
    for (let k = 0; k < ptCount; k++) {
      const idx = (runStart + k) % N;
      const t = idx / N;
      curve.getPointAt(t, _p);
      curve.getTangentAt(t, _fwd).normalize();
      _up.copy(_p).normalize();
      _right.crossVectors(_up, _fwd).normalize();
      _up.crossVectors(_fwd, _right).normalize();
      samples.push({
        p: _p.clone(),
        fwd: _fwd.clone(),
        up: _up.clone(),
        right: _right.clone(),
      });
    }

    const culvertGroup = new THREE.Group();
    culvertGroup.name = `tram-culvert-${runIdx}`;

    // 1. 扫掠拱顶涵身 (Tunnel Vault Tube)
    const posArr = new Float32Array(samples.length * M * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      for (let j = 0; j < M; j++) {
        const [lx, ly] = PROFILE[j];
        v.copy(s.p).addScaledVector(s.right, lx).addScaledVector(s.up, ly);
        const pIdx = (i * M + j) * 3;
        posArr[pIdx] = v.x;
        posArr[pIdx + 1] = v.y;
        posArr[pIdx + 2] = v.z;
      }
    }
    const idxArr = [];
    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = 0; j < M; j++) {
        const nextJ = (j + 1) % M;
        const a = i * M + j;
        const b = (i + 1) * M + j;
        const c = (i + 1) * M + nextJ;
        const d = i * M + nextJ;
        idxArr.push(a, b, d);
        idxArr.push(b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    const vaultMesh = new THREE.Mesh(geo, stoneMat);
    vaultMesh.castShadow = true;
    vaultMesh.receiveShadow = true;
    addOutline(vaultMesh, 0.015);
    culvertGroup.add(vaultMesh);

    // 2. 涵洞进出洞门（拱门、门额、八字挡土翼墙）
    function buildPortal(sample, fwdSign) {
      const portal = new THREE.Group();
      portal.position.copy(sample.p);
      const fwd = sample.fwd.clone().multiplyScalar(fwdSign);
      const up = sample.up.clone();
      const right = sample.right.clone().multiplyScalar(fwdSign);
      const m = new THREE.Matrix4().makeBasis(right, up, fwd);
      portal.quaternion.setFromRotationMatrix(m);

      // 洞顶压顶石/门额
      const cornice = new THREE.Mesh(facet(new THREE.BoxGeometry(6.6, 0.7, 1.2)), trimMat);
      cornice.position.set(0, 4.65, 0);
      cornice.castShadow = true;
      addOutline(cornice, 0.012);
      portal.add(cornice);

      // 拱顶石 (Keystone)
      const keystone = new THREE.Mesh(facet(new THREE.BoxGeometry(0.72, 0.95, 1.35)), trimMat);
      keystone.position.set(0, 4.18, 0.1);
      keystone.castShadow = true;
      addOutline(keystone, 0.012);
      portal.add(keystone);

      // 洞门两侧立柱券石
      const leftPost = new THREE.Mesh(facet(new THREE.BoxGeometry(0.75, 4.4, 1.05)), stoneMat);
      leftPost.position.set(-2.6, 2.2, 0);
      const rightPost = new THREE.Mesh(facet(new THREE.BoxGeometry(0.75, 4.4, 1.05)), stoneMat);
      rightPost.position.set(2.6, 2.2, 0);
      portal.add(leftPost, rightPost);

      // 两侧八字翼墙（向外喇叭张开 28°，深深插入山体斜坡）
      const leftWing = new THREE.Mesh(facet(new THREE.BoxGeometry(0.55, 3.9, 3.4)), stoneMat);
      leftWing.position.set(-3.6, 1.95, -1.3);
      leftWing.rotation.y = THREE.MathUtils.degToRad(-28);
      const rightWing = new THREE.Mesh(facet(new THREE.BoxGeometry(0.55, 3.9, 3.4)), stoneMat);
      rightWing.position.set(3.6, 1.95, -1.3);
      rightWing.rotation.y = THREE.MathUtils.degToRad(28);
      portal.add(leftWing, rightWing);

      return portal;
    }

    culvertGroup.add(buildPortal(samples[0], 1));
    culvertGroup.add(buildPortal(samples[samples.length - 1], -1));

    // 3. 涵洞内壁照明（每隔约 6 个采样点布设暖光壁灯）
    const lampGeo = new THREE.SphereGeometry(0.14, 6, 4);
    for (let sIdx = 3; sIdx < samples.length - 3; sIdx += 6) {
      const s = samples[sIdx];
      for (const side of [-2.15, 2.15]) {
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.copy(s.p).addScaledVector(s.right, side).addScaledVector(s.up, 1.8);
        culvertGroup.add(lamp);
      }
    }

    group.add(culvertGroup);
  }
}

function makeEnergyBeam(group, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const beam = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 })
  );
  beam.frustumCulled = false;
  group.add(beam);
  return beam;
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

/**
 * 莫比斯水晶城高架 S 型穿城线（替代旧 8 字盘旋线）。
 * NW 侧（G 引桥）接入 → 两个连续缓弯（全部钝角，单弯 ≤ 26°）穿城 → E 侧（K 回岛）接出；
 * 高度从谷缘 0.3 平滑爬升到约半楼高（≈7）巡航平视花厅，再缓降回谷缘。
 * 不再盘旋下降/上升；建筑侧另有 trackClear 净空保证不穿楼。
 */
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
    // authored 高度原样保留；谷底净空由最终统一投影（surfacePoint）兜底。
    return dir.multiplyScalar(R + h);
  };

  // [x(东), z(北), 高度(相对 R)]：相邻段转弯角全部 ≤ 26°（内角 ≥ 154°）
  // 走向：NW 侧（G 引桥 local 155.6°）进 → S 形穿城 → E 侧（K 回岛 local -2.5°）出
  const WAYPOINTS = [
    [-0.78, 0.36, 0.3], // 远入口（对齐 G 引桥方向）
    [-0.58, 0.32, 0.5],
    [-0.36, 0.3, 2.0], // 进入城市，开始爬升
    [-0.08, 0.15, 4.2],
    [0.22, -0.05, 6.2], // S 第一弯（左）
    [0.4, -0.26, 7.0], // 半楼高巡航（平视沿轨塔花厅）
    [0.58, -0.34, 7.0],
    [0.78, -0.34, 6.2], // S 第二弯（右）
    [0.96, -0.27, 4.5],
    [1.12, -0.14, 2.6],
    [1.28, -0.07, 0.9], // 远出口（对齐 K 回岛方向）
  ];
  return WAYPOINTS.map(([x, z, h]) => localToPoint(x, z, h));
}

/**
 * 构建双线环形轨道 + 红蓝相向电车。
 * @returns {{ group, curve, curves, tram, trams, redTram, blueTram, update, waypointsFlat }}
 */
export function buildChristchurchTramSystem(scene, R = PLANET_RADIUS, opts = {}) {
  const group = new THREE.Group();
  group.name = "christchurch-tram-system";

  const loopFlat = buildSmoothLoopFlat(); // 仅作 waypointsFlat 展示用（行驶段见下方手工排布）

  // ---------- 南延：西海岸离岛 → 跨赤道 → 高架 S 型穿城 → 回北 ----------
  // 岛段用手工排布的西海岸平缓弧：池塘(0,9.1)与山丘(-6.2,1.6)之间只剩“针眼”，
  // 任何环线穿越都必然产生尖角，故行驶段绕开——全部走开敞西海岸与水面，
  // 去程/回程接驳均在开敞水面与岸线切线对齐，杜绝锐角与穿水/穿营地。
  const toWorld = (x, z) => {
    const p = new THREE.Vector3();
    surfacePointFromFlat(x, z, R, p);
    return p;
  };
  // 岛内行驶段：NW 岸 → 西海岸平缓南下 → SW 离岸（全部钝角缓弯）
  const islandRideFlat = [
    [-12.0, 6.5],
    [-13.0, 2.0],
    [-12.4, -2.5],
    [-11.0, -7.0],
    [-9.5, -11.0],
    [-5.5, -16.5],
  ].map(([x, z]) => ({ x: x * WORLD_LAYOUT_SCALE, z: z * WORLD_LAYOUT_SCALE }));
  // 回程：K → 池塘西北缘外开敞水面 → 与 W0 处岸线切线对齐
  const islandApproachFlat = [
    [-7.6, 25.9],
    [-8.9, 20.1],
    [-10.2, 14.3],
    [-11.1, 10.4],
  ].map(([x, z]) => ({ x: x * WORLD_LAYOUT_SCALE, z: z * WORLD_LAYOUT_SCALE }));
  const controls = [
    ...islandRideFlat.map(({ x, z }) => toWorld(x, z)),
    latLonToDir(-10, -60).multiplyScalar(R + 0.3), // G 跨赤道，进入长距离悬空引桥
    ...buildMoebiusCitySCurve(R), // H-I-J：高架 S 型穿城（钝角缓弯，半楼高巡航）
    ...factoryFreightEntry(R),
    ...factoryFreightStops(R).flatMap(stop=>stop.points),
    latLonToDir(-12, 165).multiplyScalar(R + 0.3), // K 回北折返
    // 2026-09-18 东海北延：K → 越赤道东行 → 高山古堡前港（车站）→ 折向西南
    // 接回近岛段。全程深水高架（桥面/桥墩系统自动覆盖），古堡前港站
    // (26.5N, 42E) 距古堡山体前港 ~16 单位，电车在港前高架停靠。
    latLonToDir(-2, 130).multiplyScalar(R + 0.3), // K→NE 北上
    ...(citadelCoastalTramEnabled() ? [] : [latLonToDir(12, 78).multiplyScalar(R + 0.3)]), // Coastal route approaches from open eastern sea.
    ...(citadelCoastalTramEnabled()
      ? citadelCoastalTramPoints(R)
      : [latLonToDir(24, 56).multiplyScalar(R + 0.3),
         latLonToDir(26.5, 42).multiplyScalar(R + 0.55),
         latLonToDir(24, 28).multiplyScalar(R + 0.3)]),
    ...(citadelCoastalTramEnabled() ? [] : [latLonToDir(18, 15).multiplyScalar(R + 0.3)]), // Legacy return; coastal candidate uses its longer transition.
    ...(citadelCoastalTramEnabled() ? [] : [latLonToDir(11, 11).multiplyScalar(R+.3)]), // 西南大洋平缓钝角转弯
    ...(citadelCoastalTramEnabled() ? [] : [latLonToDir(3,14).multiplyScalar(R+.3)]),  // 南向大洋顺滑过渡
    ...(citadelCoastalTramEnabled() ? [] : [latLonToDir(-3,24).multiplyScalar(R+.3)]), // 东南深水开敞航段
    latLonToDir(-6, 38).multiplyScalar(R + 0.3), // 转向东行
    latLonToDir(-4, 54).multiplyScalar(R + 0.3), // 东偏北深水段
    latLonToDir(2, 68).multiplyScalar(R + 0.3),  // 东北开敞海域钝角缓弯
    latLonToDir(12, 82).multiplyScalar(R + 0.3), // 东北深水进岛引桥
    latLonToDir(26, 94).multiplyScalar(R + 0.3), // 近岛东北深水段
    latLonToDir(42, 102).multiplyScalar(R + 0.3), // 对齐回程开敞水面
    ...islandApproachFlat.map(({ x, z }) => toWorld(x, z)), // K→W0：切线对齐
  ];

  // —— 一次性投影 + 平滑：之后枕木/钢轨/桥面/立柱/车辆统一用最终曲线，不再二次投影 ——
  // 这正是“断开/台阶”的根因修复：所有几何共用同一条连续轨面。
  const initialCurve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);
  const RESAMPLE = 720;
  const projected = [];
  for (let i = 0; i < RESAMPLE; i++) {
    initialCurve.getPointAt(i / RESAMPLE, _p);
    projected.push(surfacePoint(_p, R, new THREE.Vector3()));
  }
  // 轻量滑动平均（3 轮 (1,2,1)/4），抹平残余折角；窗口远小于 S 弯尺度，不动大结构
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
  // 平滑后只做“平滑下界”钳制（岛缘斜坡/峡谷净空），不再重贴凹凸地形，避免摆动折角
  for (let i = 0; i < RESAMPLE; i++) {
    const len = projected[i].length();
    const floor = trackFloorRadiusAt(projected[i], R);
    if (len < floor) projected[i].multiplyScalar(floor / len);
  }
  // Gate viaduct: raise the shared rail/vehicle curve above the actual ocean.
  // Fixed geographic direction survives arc-length reparameterization.
  const gateDirection = new THREE.Vector3(23.134897, -71.740187, -141.426689).normalize();
  for (const point of projected) {
    const direction = point.clone().normalize();
    const distance = direction.angleTo(gateDirection) * R;
    const blend = 1 - smooth01((distance - 145) / 65);
    if (blend > 0) {
      const floor = R + 9.5; // Level viaduct across the canyon, not a ramp following its waterfall.
      point.setLength(Math.max(point.length(), THREE.MathUtils.lerp(point.length(), floor, blend)));
    }
  }
  // centripetal：间距不均时也不过冲/尖角
  const curve = new THREE.CatmullRomCurve3(projected, true, "centripetal", 0.5);
  const trackLen = curve.getLength();
  // 中心线两侧各铺一条完整线路（每线 = 枕木 + 两根钢轨）。
  const redCurve = buildParallelCurve(curve, -LANE_OFFSET, R);
  const blueCurve = buildParallelCurve(curve, LANE_OFFSET, R);
  const sleeperMat = toonMat(SLEEPER);
  const railMat = toonMat(RAIL);
  const priorRailCompile=railMat.onBeforeCompile;
  railMat.onBeforeCompile=shader=>{
    priorRailCompile?.(shader);
    shader.uniforms.gateRailDirection={value:gateDirection};
    shader.uniforms.gateRailSand={value:new THREE.Color(0xc4a273)};
    shader.vertexShader='varying vec3 railWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrailWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 railWorld; uniform vec3 gateRailDirection; uniform vec3 gateRailSand;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat gateTint=smoothstep(.92,.985,dot(normalize(railWorld),gateRailDirection));diffuseColor.rgb=mix(diffuseColor.rgb,gateRailSand,gateTint);');
  };
  railMat.customProgramCacheKey=()=> 'gate-warm-sand-rail-v1';
  addTrackLane(group, redCurve, R, sleeperMat, railMat);
  addTrackLane(group, blueCurve, R, sleeperMat, railMat);
  addViaductDeck(group, curve, R, citadelCoastalTramEnabled());
  addTramCulverts(group, curve, R);
  const coastalCitadel = citadelCoastalTramEnabled();
  // 圣城临海段：石墩石拱桥、栏杆、路灯与两站（替代下方通用细立柱）
  if (coastalCitadel) {
    addCitadelCoastalTramStructures(group, curve, R, groundRadiusAt);
    // 圣城新城隧道：外壳/洞门换成与连拱桥同色的米白石，读作城墙基座而非深灰管道
    const cream = toonMat(0xd9ceb6, { flatShading: true, side: THREE.DoubleSide });
    const creamTrim = toonMat(0xb9ad94, { flatShading: true });
    const _c = new THREE.Vector3();
    for (const culvert of group.children.filter((c) => /^tram-culvert-/.test(c.name))) {
      culvert.updateMatrixWorld(true);
      new THREE.Box3().setFromObject(culvert).getCenter(_c);
      if (!inCitadelTramTunnel(_c)) continue;
      culvert.traverse((o) => {
        if (!o.isMesh || o.userData.isOutline || o.material?.isMeshBasicMaterial) return;
        o.material = o.material?.color?.getHex?.() === 0x3e434a ? creamTrim : cream;
      });
    }
  }

  // ---------- 高架立柱：桥面下方每 ~2 单位一根，落到真实地面/阶梯谷底 ----------
  {
    const pierMat = toonMat(0x8a8f94);
    const count = Math.floor(trackLen / 2);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      curve.getPointAt(t, _p);
      _up.copy(_p).normalize();
      // The gate arcade supports this span; avoid duplicate generic columns in its openings.
      if(gateThirtyRound()>=16 && Math.acos(THREE.MathUtils.clamp(_up.dot(gateDirection),-1,1))*R<25)continue;
      const footR = groundRadiusAt(_up, R);
      const topR = _p.length() - 0.45; // 顶到桥面/梁底
      const len = topR - footR;
      if (len < 0.5) continue; // 贴地段与低堤段不需要墩
      if (coastalCitadel && inCitadelCoastalWindow(_p)) continue; // 圣城段用石墩
      const pier = new THREE.Mesh(
        facet(new THREE.BoxGeometry(0.55, len, 0.55)),
        pierMat
      );
      pier.name="tram-static-pier";
      pier.position.copy(_up).multiplyScalar(footR + len / 2);
      pier.quaternion.copy(quatYToDir(_up, new THREE.Quaternion()));
      pier.castShadow = true;
      addOutline(pier, 0.012);
      group.add(pier);
    }
  }

  // Spatial batches retain local frustum culling; rolling stock and collision routes are untouched.
  const staticBuckets=new Map();
  for(const mesh of [...group.children])if(/^tram-static-(sleeper|pier)$/.test(mesh.name)){
    const p=mesh.position,key=[p.x,p.y,p.z].map(v=>Math.floor(v/36)).join(':');
    let bucket=staticBuckets.get(key);if(!bucket){bucket=new THREE.Group();bucket.name='tram-static-sector';group.add(bucket);staticBuckets.set(key,bucket);}bucket.add(mesh);
  }
  for(const bucket of staticBuckets.values())mergeStaticGroup(bucket);

  // ---------- 红 / 蓝双车：同站并排、方向相反 ----------
  const redTram = createFreightVehicle({
    variant: "red",
    routeNumber: "11",
    destination: "CITY TOUR",
  });
  const blueTram = createFreightVehicle({
    variant: "blue",
    routeNumber: "12",
    destination: "COAST LINE",
  });
  group.add(redTram, blueTram);

  // ---------- 集电弓能量束（两车进入南半球时分别连接太空水环） ----------
  const beamTarget = (opts.beamTarget || new THREE.Vector3(40, 85, -70)).clone();
  const services = [
    {
      tram: redTram,
      curve: redCurve,
      direction: 1,
      progress: 0,
      trackLen: redCurve.getLength(),
      beam: makeEnergyBeam(group, 0xffb6a8),
      beamTime: 0,
      /** 是否进过峡谷（用于离城送别） */
      visitedCanyon: false,
      farewellActive: false,
      farewellDone: false,
      farewellT: 0,
    },
    {
      tram: blueTram,
      curve: blueCurve,
      direction: -1,
      progress: 0,
      trackLen: blueCurve.getLength(),
      beam: makeEnergyBeam(group, 0x8fdcff),
      beamTime: Math.PI * 0.5,
      visitedCanyon: false,
      farewellActive: false,
      farewellDone: false,
      farewellT: 0,
    },
  ];
  for (const service of services) {
    service.wagons = Array.from({length:FREIGHT_WAGONS},(_,wagon)=>{
      const car=createFreightVehicle({variant:service.tram.userData.variant,wagon});group.add(car);return car;
    });
    service.tram.userData.freightWagons=service.wagons;
    service.couplers=service.wagons.map(()=>{
      const link=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,6),new THREE.MeshStandardMaterial({color:0x303638}));group.add(link);return link;
    });
  }
  const linkA=new THREE.Vector3(),linkB=new THREE.Vector3(),linkDir=new THREE.Vector3();
  function placeVehicle(vehicle,service,progress){
    service.curve.getPointAt(wrap01(progress),_p);
    service.curve.getTangentAt(wrap01(progress),_fwd).normalize().multiplyScalar(service.direction);
    _up.copy(_p).normalize();_right.crossVectors(_up,_fwd).normalize();_up.crossVectors(_fwd,_right).normalize();
    _m.makeBasis(_right,_up,_fwd);vehicle.quaternion.setFromRotationMatrix(_m);vehicle.rotateY(-Math.PI/2);
    vehicle.position.copy(_p).addScaledVector(_up,.12);
  }
  for(const service of services){
    service.loadingStops=factoryFreightStops(R).map(stop=>{
      let best=Infinity,progress=0;for(let i=0;i<4096;i++){const u=i/4096,dist=service.curve.getPointAt(u).distanceToSquared(stop.center);if(dist<best){best=dist;progress=u;}}
      // Locomotive pulls half the consist past the middle of the receiving row.
      return {name:stop.name,progress:wrap01(progress+service.direction*FREIGHT_PITCH*4/service.trackLen)};
    });service.dwell=0;service.lastStop=null;
  }
  // 车体抬升：车底最低件相对轨面留净空，防岛面/草坡缘剃车底（原 0.06 会擦地）
  const bodyLift = 0.12;
  /** 离城送别最短/最长时长（秒）；BGM 未结束时会延长到 BGM 完 */
  const FAREWELL_MIN = 12;
  const FAREWELL_MAX = 48;

  // ---------- 峡谷进谷进度采样（供进谷前 10s BGM）----------
  // drop < CANYON_ENTRY_DROP 视为「已进入峡谷」
  const CANYON_ENTRY_DROP = -0.85;
  const CANYON_SAMPLE_N = 256;
  for (const service of services) {
    /** @type {boolean[]} */
    const inCanyon = new Array(CANYON_SAMPLE_N);
    for (let i = 0; i < CANYON_SAMPLE_N; i++) {
      const t = i / CANYON_SAMPLE_N;
      service.curve.getPointAt(t, _p);
      _up.copy(_p).normalize();
      inCanyon[i] = canyonOffsetDirSmooth(_up) < CANYON_ENTRY_DROP;
    }
    service.canyonMask = inCanyon;
    service.tram.userData.tramServiceId = service.tram.userData.variant || "tram";
    service.tram.userData.getCanyonAudioCue = () => getCanyonAudioCueForService(service);
  }

  /**
   * 沿行驶方向找「下一次进入峡谷」的弧长秒数。
   * 已在谷内：secondsToEntry = 0, inCanyon = true
   */
  function getCanyonAudioCueForService(service) {
    const mask = service.canyonMask;
    const n = mask.length;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(service.progress * n) % n));
    const inCanyon = !!mask[idx];
    if (inCanyon) {
      return { inCanyon: true, secondsToEntry: 0, progress: service.progress };
    }
    // 沿 direction 向前找第一个 inCanyon 样本
    const dir = service.direction >= 0 ? 1 : -1;
    let steps = 0;
    for (let s = 1; s <= n; s++) {
      const j = (idx + dir * s + n * 8) % n;
      if (mask[j]) {
        steps = s;
        break;
      }
    }
    if (steps <= 0) {
      // 整圈无峡谷（理论不应发生）
      return { inCanyon: false, secondsToEntry: Infinity, progress: service.progress };
    }
    const frac = steps / n;
    const dist = frac * service.trackLen;
    const speed = Math.max(0.05, P.tramSpeed);
    return {
      inCanyon: false,
      secondsToEntry: dist / speed,
      progress: service.progress,
    };
  }

  function getCanyonAudioCue(tram) {
    if (!tram) return null;
    for (const service of services) {
      if (service.tram === tram) return getCanyonAudioCueForService(service);
    }
    // 回退：最近车
    return getCanyonAudioCueForService(services[0]);
  }

  function update(dt, listenerPosition) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const service of services) {
      if(service.dwell>0){service.dwell=Math.max(0,service.dwell-dt);}else{
        const step=Math.max(0,P.tramSpeed*dt/service.trackLen);
        const stop=service.loadingStops.find(s=>s.name!==service.lastStop && wrap01((s.progress-service.progress)*service.direction)<=step);
        if(stop){service.progress=stop.progress;service.dwell=12;service.lastStop=stop.name;}else service.progress=wrap01(service.progress+service.direction*step);
      }
      service.tram.userData.loadingDwell=service.dwell;
      service.tram.userData.loadingStops=service.loadingStops;
      placeVehicle(service.tram,service,service.progress);
      service.tram.userData.trackProgress=service.progress;
      let previous=service.tram;
      service.wagons.forEach((car,i)=>{
        placeVehicle(car,service,service.progress-service.direction*(i+1)*FREIGHT_PITCH/service.trackLen);
        linkA.set(-1.98,.36,0).applyQuaternion(previous.quaternion).add(previous.position);
        linkB.set(1.98,.36,0).applyQuaternion(car.quaternion).add(car.position);
        const link=service.couplers[i];linkDir.subVectors(linkB,linkA);link.position.copy(linkA).add(linkB).multiplyScalar(.5);
        link.scale.y=linkDir.length();link.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),linkDir.normalize());
        previous=car;
      });

      // ---- 离城送别状态机（与是否乘车无关；红车优先可见）----
      {
        const cue = getCanyonAudioCueForService(service);
        if (cue.inCanyon) {
          service.visitedCanyon = true;
          service.farewellDone = false;
          service.farewellActive = false;
          service.farewellT = 0;
        } else if (service.visitedCanyon && !service.farewellActive && !service.farewellDone) {
          // 刚驶出峡谷：开启送别窗口
          service.farewellActive = true;
          service.farewellT = 0;
        }
        if (service.farewellActive) {
          service.farewellT += dt;
          service.tram.userData.farewellActive = true;
          service.tram.userData.farewellT = service.farewellT;
        } else {
          service.tram.userData.farewellActive = false;
        }
      }

      service.beamTime += dt;
      if (service.tram.position.y < 0) {
        _tmp.set(-0.5, 1.9, 0)
          .applyQuaternion(service.tram.quaternion)
          .add(service.tram.position);
        service.beam.geometry.setFromPoints([_tmp, beamTarget]);
        service.beam.material.opacity = 0.42 + 0.22 * Math.sin(service.beamTime * 5);
      } else {
        service.beam.material.opacity = Math.max(0, service.beam.material.opacity - dt * 2);
      }

      if (listenerPosition) {
        service.tram.getWorldPosition(_tramWorld);
        const distance = _tramWorld.distanceTo(listenerPosition);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = service.tram;
        }
      }
    }

    if (listenerPosition && nearest) {
      nearest.getWorldPosition(_tramWorld);
      updateTramSound(_tramWorld, listenerPosition);
    }
  }

  function getNearestTram(position) {
    if (!position) return redTram;
    let nearest = redTram;
    let best = Infinity;
    for (const service of services) {
      service.tram.getWorldPosition(_tramWorld);
      const distance = _tramWorld.distanceTo(position);
      if (distance < best) {
        best = distance;
        nearest = service.tram;
      }
    }
    return nearest;
  }

  /** 两辆车都可搭乘；以最近车辆做距离判定。 */
  function isNearTram(position, radius = BOARDING_RADIUS) {
    if (!position) return false;
    getNearestTram(position).getWorldPosition(_tramWorld);
    return _tramWorld.distanceTo(position) <= radius;
  }

  /**
   * 离城送别伴飞目标电车。
   * - 不依赖是否乘车：红车驶出峡谷即触发
   * - bgmHold=true（BGM 仍在播/收尾）时尽量延长到 BGM 结束
   * - 优先红色电车
   * @param {{ bgmHold?: boolean }} [opts]
   * @returns {import("three").Object3D|null}
   */
  function getFarewellEscortTram(opts = {}) {
    const bgmHold = !!opts.bgmHold;
    /** @type {typeof services[0]|null} */
    let pick = null;
    for (const service of services) {
      if (!service.farewellActive) continue;

      let end = false;
      if (service.farewellT >= FAREWELL_MAX) end = true;
      else if (bgmHold) {
        // BGM 仍在：一直伴飞到 MAX
        end = false;
      } else if (service.farewellT >= FAREWELL_MIN + 4) {
        // BGM 已停：最短时长后再留 4s 余韵
        end = true;
      }

      if (end) {
        service.farewellActive = false;
        service.farewellDone = true;
        service.tram.userData.farewellActive = false;
        continue;
      }

      // 优先红车
      if (!pick || service.tram.userData?.variant === "red") pick = service;
    }
    return pick?.tram ?? null;
  }

  scene.add(group);
  update(0);
  return {
    group,
    curve,
    curves: { red: redCurve, blue: blueCurve },
    tram: redTram,
    trams: [redTram, blueTram],
    redTram,
    blueTram,
    update,
    getNearestTram,
    isNearTram,
    /** 进谷音频：{ inCanyon, secondsToEntry } */
    getCanyonAudioCue,
    /** 离城送别伴飞电车（红车优先） */
    getFarewellEscortTram,
    boardingRadius: BOARDING_RADIUS,
    waypointsFlat: loopFlat,
  };
}
