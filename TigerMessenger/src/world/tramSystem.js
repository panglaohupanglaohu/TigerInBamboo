// =====================================================================
//  基督城有轨电车环形轨道系统
//  平面设计坐标上的平滑环线：不爬坡、不进建筑、无锐角弯
//  CatmullRomCurve3 闭合环；枕木 + 双钢轨贴球面；电车 up=法线、forward=切线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createChristchurchTram } from "../assets/tram.js";
import { flatToWorld } from "./sphereMath.js";
import { groundLiftAt, worldToFlatXZ, ISLAND_BASE_LIFT, hillHeightAt } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { updateTramSound } from "../audio/sfx.js";

const SLEEPER = 0x3e2723;
const RAIL = 0x757575;
const SURFACE_EPS = 0.08;

// 轨道只贴岛面/缓坡，不随山丘抬升（禁止“上山坡”）
const TRACK_LIFT_CAP = ISLAND_BASE_LIFT + 0.1;

const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _tramWorld = new THREE.Vector3();

/** 轨道用地形抬升：封顶，避免爬上书店山/北脊等 */
export function trackLiftAt(x, z) {
  const raw = groundLiftAt(x, z);
  return Math.min(raw, TRACK_LIFT_CAP);
}

/**
 * 选线避障：山丘核、书店、池塘、出生点
 * 迭代推开，保证落在平缓地面走廊。
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
  // 池塘椭圆
  const pond = { x: 0, z: 9.1, rx: 10.5, rz: 5.8 };
  // 出生点净空
  const spawn = { x: 0, z: 6, r: 3.2 };

  let px = x;
  let pz = z;
  for (let iter = 0; iter < 12; iter++) {
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
  // 基础椭圆环（逆时针）：营地南侧 → 东（绕书店南）→ 南 → 西 → 北回
  // 点数多、相邻角自然钝
  const raw = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    // 略扁椭圆，东侧外扩给书店让路、北侧躲开池塘
    const rx = 11.2 + 0.6 * Math.cos(2 * t);
    const rz = 10.0 + 0.4 * Math.sin(2 * t);
    // 圆心略偏南，远离池塘 (0,9)
    let x = rx * Math.cos(t) + 1.2;
    let z = rz * Math.sin(t) - 1.5;
    // 东侧额外外推，书店在 (11.5,5.5)
    if (x > 6 && z > 0) {
      x += 1.2;
      z -= 0.8;
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

/** 曲线采样点贴轨面（封顶抬升） */
function surfacePoint(dir, R, out = new THREE.Vector3()) {
  const flat = worldToFlatXZ(dir, R);
  if (flat) {
    return surfacePointFromFlat(flat.x, flat.z, R, out);
  }
  return out.copy(dir).normalize().multiplyScalar(R + SURFACE_EPS);
}

/**
 * 构建环形轨道 + 电车。
 * @returns {{ group, curve, tram, update, waypointsFlat }}
 */
export function buildChristchurchTramSystem(scene, R = PLANET_RADIUS) {
  const group = new THREE.Group();
  group.name = "christchurch-tram-system";

  const loopFlat = buildSmoothLoopFlat();
  const controls = loopFlat.map(({ x, z }) => {
    const p = new THREE.Vector3();
    surfacePointFromFlat(x, z, R, p);
    return p;
  });

  // centripetal：间距不均时也不过冲/尖角
  const curve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);
  const trackLen = curve.getLength();

  // ---------- 枕木 ----------
  const sleeperMat = toonMat(SLEEPER);
  const count = Math.max(32, Math.floor(trackLen / 1.35));
  for (let i = 0; i < count; i++) {
    const t = i / count;
    curve.getPointAt(t, _p);
    surfacePoint(_p, R, _p);
    // 二次确认：若仍落在高丘上，压回 cap 高度
    const flat = worldToFlatXZ(_p, R);
    if (flat && hillHeightAt(flat.x, flat.z) > 0.35) {
      surfacePointFromFlat(flat.x, flat.z, R, _p);
    }
    const sleeper = new THREE.Mesh(facet(new THREE.BoxGeometry(0.85, 0.06, 0.24)), sleeperMat);
    curve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _fwd.crossVectors(_right, _up).normalize();
    _m.makeBasis(_right, _up, _fwd);
    sleeper.quaternion.setFromRotationMatrix(_m);
    sleeper.position.copy(_p);
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  // ---------- 双钢轨 ----------
  const railMat = toonMat(RAIL);
  for (const side of [-1, 1]) {
    const pts = [];
    const SEG = 120;
    for (let i = 0; i < SEG; i++) {
      const t = i / SEG;
      curve.getPointAt(t, _p);
      surfacePoint(_p, R, _p);
      curve.getTangentAt(t, _fwd).normalize();
      _up.copy(_p).normalize();
      _right.crossVectors(_up, _fwd).normalize();
      pts.push(_p.clone().addScaledVector(_right, side * 0.32).addScaledVector(_up, 0.06));
    }
    const railCurve = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 200, 0.035, 5, true),
      railMat
    );
    rail.castShadow = true;
    addOutline(rail, 0.01);
    group.add(rail);
  }

  // ---------- 电车 ----------
  const tram = createChristchurchTram();
  group.add(tram);

  let progress = 0;
  const bodyLift = 0.06;

  function update(dt, listenerPosition) {
    progress = (progress + (P.tramSpeed * dt) / trackLen) % 1;
    curve.getPointAt(progress, _p);
    surfacePoint(_p, R, _p);
    curve.getTangentAt(progress, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _fwd.crossVectors(_right, _up).normalize();
    _m.makeBasis(_right, _up, _fwd);
    _q.setFromRotationMatrix(_m);
    tram.quaternion.copy(_q);
    tram.rotateY(-Math.PI / 2);
    tram.position.copy(_p).addScaledVector(_up, bodyLift);
    if (listenerPosition) {
      tram.getWorldPosition(_tramWorld);
      updateTramSound(_tramWorld, listenerPosition);
    }
  }

  scene.add(group);
  update(0);
  return { group, curve, tram, update, waypointsFlat: loopFlat };
}
