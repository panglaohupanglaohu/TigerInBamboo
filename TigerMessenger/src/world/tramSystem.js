// =====================================================================
//  基督城有轨电车环形轨道系统
//  平面设计坐标上的平滑环线：不爬坡、不进建筑、无锐角弯
//  CatmullRomCurve3 闭合环；双线四钢轨贴球面；红/蓝电车相向运行
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createChristchurchTram } from "../assets/tram.js";
import { flatToWorld, latLonToDir, quatYToDir } from "./sphereMath.js";
import { groundLiftAt, worldToFlatXZ, ISLAND_BASE_LIFT } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { updateTramSound } from "../audio/sfx.js";
import { LAKE, HARBOR } from "./lake.js";
import { canyonOffsetDir } from "./canyon.js";

const SLEEPER = 0x3e2723;
const RAIL = 0x757575;
const SURFACE_EPS = 0.08;
const BOARDING_RADIUS = 3.6;
const LANE_OFFSET = 0.9; // 两条线路中心距 1.8，车辆交会保留约 0.7 净空
const RAIL_GAUGE_HALF = 0.32;

// 轨道只贴岛面/缓坡，不随山丘抬升（禁止“上山坡”）
const TRACK_LIFT_CAP = ISLAND_BASE_LIFT + 0.1;

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
    { x: -1.8, z: -12.6, r: 3.6 },
    { x: 0.4, z: -12.4, r: 4.0 },
    { x: 2.2, z: -11.2, r: 3.2 },
    { x: -5.2, z: -8.6, r: 3.8 },
    { x: -7.6, z: -5.4, r: 3.4 },
    { x: -6.2, z: 1.6, r: 4.0 },
    { x: 8.8, z: 4.8, r: 3.6 },
    { x: 6.6, z: -7.6, r: 3.2 },
    { x: 4.6, z: -9.8, r: 2.8 },
    { x: 5.8, z: 6.8, r: 3.0 },
    { x: 11.5, z: 5.5, r: 5.5 }, // 书店山 + 建筑体
  ];
  // 圆禁区：月牙湖水域 + 修船厂码头（栈桥/船/吊车）
  const hardCircles = [
    { x: LAKE.x, z: LAKE.z, r: LAKE.pathOuter + 1.4 }, // 湖+小径
    { x: HARBOR.x, z: HARBOR.z, r: HARBOR.clearR }, // 码头整景
  ];
  // 池塘椭圆
  const pond = { x: 0, z: 9.1, rx: 10.5, rz: 5.8 };
  // 出生点净空
  const spawn = { x: 0, z: 6, r: 3.2 };

  let px = x;
  let pz = z;
  for (let iter = 0; iter < 16; iter++) {
    let moved = false;
    for (const h of hills) {
      const dx = px - h.x;
      const dz = pz - h.z;
      const d = Math.hypot(dx, dz);
      if (d < h.r && d > 1e-4) {
        const k = (h.r - d) / d;
        px += dx * k;
        pz += dz * k;
        moved = true;
      } else if (d < 1e-4) {
        px += h.r;
        moved = true;
      }
    }
    // 月牙湖 + 码头：硬推开
    for (const c of hardCircles) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 1e-4) {
        const k = (c.r - d) / d;
        px += dx * k;
        pz += dz * k;
        moved = true;
      } else if (d < 1e-4) {
        // 卡在圆心：默认推向码头南侧外缘（远离栈桥主体）
        px = c.x + 0.2;
        pz = c.z - c.r;
        moved = true;
      }
    }
    // 池塘
    {
      const nx = (px - pond.x) / pond.rx;
      const nz = (pz - pond.z) / pond.rz;
      const d2 = nx * nx + nz * nz;
      if (d2 < 1 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (1.05 - d) / d;
        px += nx * pond.rx * k;
        pz += nz * pond.rz * k;
        moved = true;
      }
    }
    // 出生点
    {
      const dx = px - spawn.x;
      const dz = pz - spawn.z;
      const d = Math.hypot(dx, dz);
      if (d < spawn.r && d > 1e-4) {
        const k = (spawn.r - d) / d;
        px += dx * k;
        pz += dz * k;
        moved = true;
      }
    }
    // 岛缘内略收（轨道主要在岛面走廊 r≈9~14）
    const rr = Math.hypot(px, pz);
    if (rr > 15.5) {
      px *= 15.2 / rr;
      pz *= 15.2 / rr;
      moved = true;
    }
    if (rr < 7.5 && rr > 1e-4) {
      // 不要太贴中心
      px *= 8.0 / rr;
      pz *= 8.0 / rr;
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
    const rx = 11.6 + 0.55 * Math.cos(2 * t);
    const rz = 10.4 + 0.45 * Math.sin(2 * t);
    let x = rx * Math.cos(t) + 0.6;
    let z = rz * Math.sin(t) - 2.2;
    // 东侧外推，书店 (11.5,5.5)
    if (x > 6 && z > 0) {
      x += 1.4;
      z -= 0.9;
    }
    // 东南象限：强制走码头南/外侧（HARBOR 约 9.4,-3.6）
    if (x > 4 && z < 2 && z > -11) {
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
    if (z > 5) z = 5 - (z - 5) * 0.35;
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
  const MAX_TURN_DEG = 55; // 单步转向上限 → 内角 ≥ 125°
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

  // 再滤一遍过近点，避免控制点挤成尖刺
  const pruned = [final[0]];
  for (let i = 1; i < final.length; i++) {
    const a = pruned[pruned.length - 1];
    const b = final[i];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 1.1) pruned.push(b);
  }
  // 闭合间距
  if (pruned.length > 2) {
    const a = pruned[pruned.length - 1];
    const b = pruned[0];
    if (Math.hypot(a.x - b.x, a.z - b.z) < 1.1) pruned.pop();
  }
  return pruned;
}

function surfacePointFromFlat(x, z, R, out = new THREE.Vector3()) {
  const lift = trackLiftAt(x, z);
  return flatToWorld(x, lift + SURFACE_EPS, z, R, out);
}

/** 曲线采样点贴轨面（封顶抬升）；南半球 = 悬空高架（固定半径跨越深渊） */
function surfacePoint(dir, R, out = new THREE.Vector3()) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    return surfacePointFromFlat(flat.x, flat.z, R, out);
  }
  // 南半球（y<0 且无平面归属）：高架桥模式，保持恒定半径直跨大峡谷
  const fixed = dir.y < -0.05 ? R + 0.2 : R + SURFACE_EPS;
  return out.copy(dir).normalize().multiplyScalar(fixed);
}

/** 高架桥墩落点（谷底/裸面） */
function pierFootRadius(dir, R) {
  return R + canyonOffsetDir(dir);
}

/** 基于中心曲线沿球面横向偏移，生成一条完整的平行线路。 */
function buildParallelCurve(centerCurve, offset, R) {
  const points = [];
  const SEG = 240;
  for (let i = 0; i < SEG; i++) {
    const t = i / SEG;
    centerCurve.getPointAt(t, _p);
    surfacePoint(_p, R, _p);
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
    surfacePoint(_p, R, _p);
    curve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _fwd.crossVectors(_right, _up).normalize();
    _m.makeBasis(_right, _up, _fwd);
    const sleeper = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.88, 0.06, 0.24)),
      sleeperMat
    );
    sleeper.quaternion.setFromRotationMatrix(_m);
    sleeper.position.copy(_p);
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  for (const railSide of [-1, 1]) {
    const railPoints = [];
    const SEG = 180;
    for (let i = 0; i < SEG; i++) {
      const t = i / SEG;
      curve.getPointAt(t, _p);
      surfacePoint(_p, R, _p);
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
      new THREE.TubeGeometry(railCurve, 260, 0.035, 5, true),
      railMat
    );
    rail.castShadow = true;
    addOutline(rail, 0.01);
    group.add(rail);
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
 * 构建双线环形轨道 + 红蓝相向电车。
 * @returns {{ group, curve, curves, tram, trams, redTram, blueTram, update, waypointsFlat }}
 */
export function buildChristchurchTramSystem(scene, R = PLANET_RADIUS, opts = {}) {
  const group = new THREE.Group();
  group.name = "christchurch-tram-system";

  const loopFlat = buildSmoothLoopFlat();

  // ---------- 南延：西端离岛 → 跨赤道 → 绕莫比斯主晶塔 → 回北 ----------
  // 保留 Grok 岛内避障环的北弧（营地→书店→码头→西端），
  // 在西端点岔出南半球远足段，闭环回西北角。
  const toWorld = (x, z) => {
    const p = new THREE.Vector3();
    surfacePointFromFlat(x, z, R, p);
    return p;
  };
  let iW = 0;
  let iNW = 0;
  for (let i = 0; i < loopFlat.length; i++) {
    if (loopFlat[i].x < loopFlat[iW].x) iW = i; // 最西
    const dNW = Math.hypot(loopFlat[i].x + 6, loopFlat[i].z - 8);
    const dBest = Math.hypot(loopFlat[iNW].x + 6, loopFlat[iNW].z - 8);
    if (dNW < dBest) iNW = i; // 最贴近西北角 (-6,8)
  }
  const northArc = [];
  for (let i = iNW; ; i = (i + 1) % loopFlat.length) {
    northArc.push(loopFlat[i]);
    if (i === iW) break;
  }
  const southExcursion = [
    latLonToDir(-10, -60).multiplyScalar(R + SURFACE_EPS), // 跨赤道
    latLonToDir(-38, -95).multiplyScalar(R + SURFACE_EPS), // 水晶城东
    latLonToDir(-55, -122).multiplyScalar(R + SURFACE_EPS), // 主晶塔南
    latLonToDir(-38, -140).multiplyScalar(R + SURFACE_EPS), // 水晶城西
    latLonToDir(-12, 165).multiplyScalar(R + SURFACE_EPS), // 回北折返
  ];
  const controls = [
    ...northArc.map(({ x, z }) => toWorld(x, z)),
    ...southExcursion,
  ];

  // centripetal：间距不均时也不过冲/尖角
  const curve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);
  // 中心线两侧各铺一条完整线路（每线 = 枕木 + 两根钢轨）。
  const redCurve = buildParallelCurve(curve, -LANE_OFFSET, R);
  const blueCurve = buildParallelCurve(curve, LANE_OFFSET, R);
  const sleeperMat = toonMat(SLEEPER);
  const railMat = toonMat(RAIL);
  addTrackLane(group, redCurve, R, sleeperMat, railMat);
  addTrackLane(group, blueCurve, R, sleeperMat, railMat);

  // ---------- 悬空高架桥墩（南半球大峡谷段：每 ~3 单位一根灰立柱） ----------
  {
    const pierMat = toonMat(0x8a8f94);
    const count = Math.floor(trackLen / 3);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      curve.getPointAt(t, _p);
      surfacePoint(_p, R, _p); // 南半球 = 固定 40.2 悬空
      if (_p.y > -0.05) continue; // 只在南半球深渊段架桥墩
      _up.copy(_p).normalize();
      const footR = pierFootRadius(_up, R);
      const topR = _p.length();
      const len = topR - footR;
      if (len < 0.6) continue; // 谷缘浅处不需要墩
      const pier = new THREE.Mesh(
        facet(new THREE.BoxGeometry(0.55, len, 0.55)),
        pierMat
      );
      pier.position.copy(_up).multiplyScalar(footR + len / 2);
      pier.quaternion.copy(quatYToDir(_up, new THREE.Quaternion()));
      pier.castShadow = true;
      addOutline(pier, 0.012);
      group.add(pier);
    }
  }

  // ---------- 红 / 蓝双车：同站并排、方向相反 ----------
  const redTram = createChristchurchTram({
    variant: "red",
    routeNumber: "11",
    destination: "CITY TOUR",
  });
  const blueTram = createChristchurchTram({
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
    },
    {
      tram: blueTram,
      curve: blueCurve,
      direction: -1,
      progress: 0,
      trackLen: blueCurve.getLength(),
      beam: makeEnergyBeam(group, 0x8fdcff),
      beamTime: Math.PI * 0.5,
    },
  ];
  const bodyLift = 0.06;

  function update(dt, listenerPosition) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const service of services) {
      service.progress = wrap01(
        service.progress + (service.direction * P.tramSpeed * dt) / service.trackLen
      );
      service.curve.getPointAt(service.progress, _p);
      surfacePoint(_p, R, _p);
      service.curve.getTangentAt(service.progress, _fwd).normalize();
      _fwd.multiplyScalar(service.direction);
      _up.copy(_p).normalize();
      _right.crossVectors(_up, _fwd).normalize();
      _fwd.crossVectors(_right, _up).normalize();
      _m.makeBasis(_right, _up, _fwd);
      _q.setFromRotationMatrix(_m);
      service.tram.quaternion.copy(_q);
      service.tram.rotateY(-Math.PI / 2);
      service.tram.position.copy(_p).addScaledVector(_up, bodyLift);

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
    boardingRadius: BOARDING_RADIUS,
    waypointsFlat: loopFlat,
  };
}
