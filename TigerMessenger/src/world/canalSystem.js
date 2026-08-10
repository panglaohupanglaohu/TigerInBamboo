// =====================================================================
//  星海运河环线（World Canal Loop）
//  一条闭合的、沉到球面地表以下的运河，连通主要场景：
//  - 路径：CatmullRom 闭合样条，控制点取各场景方向（稍曲折，绕开正对）
//  - 沉挖：整条河道沿星球径向下挖到 R - CANAL_DEPTH（不在地面上）
//  - 本体：扫掠带状几何（水面 + 两侧堤壁 + 河床），随球面曲率逐点倾斜
//  - 每个场景处留一个可停靠的浅湾/登岸段（low-lift 平台）
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { PLANET_RADIUS } from "./planet.js";

// 运河挖深（径向向球心，世界单位）：河道沉到地表以下
export const CANAL_DEPTH = 5.5;
// 水面相对河床的抬升
const WATER_LIFT = 1.6;
// 运河半宽
const CANAL_HALF_WIDTH = 1.9;
// 堤壁高度（从水面向上到岸边地表）
const BANK_HEIGHT = CANAL_DEPTH - WATER_LIFT + 0.2;
// 场景登岸浅湾半径
const DOCK_RADIUS = 2.6;

const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * 在 [a, b] 大圆弧之间插入 k 个曲折中间点，用于让运河在场景间绕行。
 * 沿大圆 slerp 后，再在切向平面内左右微偏，形成"S"形曲折。
 * @param {THREE.Vector3} a 起点（单位方向或世界位）
 * @param {THREE.Vector3} b 终点
 * @param {number} k 插入点数
 * @param {number} wiggle 横向摆动幅度（弧度）
 * @param {number} r 径向半径（球面 R）
 */
export function insertWindingPoints(a, b, k, wiggle, r, out) {
  const ad = a.clone().normalize();
  const bd = b.clone().normalize();
  const omega = Math.acos(THREE.MathUtils.clamp(ad.dot(bd), -1, 1));
  for (let i = 1; i <= k; i++) {
    const t = i / (k + 1);
    // 球面线性插值（大圆弧）
    const dir = ad.clone().lerp(bd, t).normalize();
    // 在切向平面内左右摆动，制造曲折
    _fwd.copy(bd).sub(ad).normalize();
    _right.crossVectors(dir, _fwd).normalize();
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0).subScalar(dir.dot(_right) * dir.x).normalize();
    const sway = Math.sin(t * Math.PI) * wiggle;
    dir.addScaledVector(_right, sway).normalize();
    out.push(dir.multiplyScalar(r));
  }
}

/**
 * 构建星海运河。
 * @param {THREE.Scene} scene
 * @param {number} planetRadius 星球半径
 * @param {object} opts
 * @param {Array<THREE.Vector3>} opts.anchors 各场景锚点方向/位置（World 或单位 dir）
 * @param {number} [opts.depth=CANAL_DEPTH] 挖深
 * @returns {{ group:THREE.Group, curve:THREE.CatmullRomCurve3, sinks:Array<{dir:THREE.Vector3, u:number}> }}
 */
export function buildWorldCanal(scene, planetRadius = PLANET_RADIUS, opts = {}) {
  const depth = opts.depth ?? CANAL_DEPTH;
  const r0 = planetRadius - depth; // 河床径向半径
  const waterR = r0 + WATER_LIFT; // 水面径向半径

  const anchors = (opts.anchors || []).map((a) => a.clone().normalize());

  // ---- 组装控制点：每个场景锚点 + 场景间曲折中间点 ----
  const controls = [];
  const count = anchors.length;
  for (let i = 0; i < count; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % count];
    controls.push(a.clone().multiplyScalar(r0));
    // 场景间插入 3 个曲折点，摆动幅度随间距变化
    const dist = a.angleTo(b);
    const wiggle = THREE.MathUtils.clamp(dist * 0.16, 0.015, 0.11);
    insertWindingPoints(a, b, 3, wiggle, r0, controls);
  }

  // ---- 初始 CatmullRom 闭合样条 ----
  const rawCurve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);

  // ---- 高密度重采样 + 沿径向投影回河床半径（贴合球面曲率，避免直角插值深入球心） ----
  const N = 1400;
  const projected = [];
  for (let i = 0; i < N; i++) {
    rawCurve.getPointAt(i / N, _p);
    projected.push(_p.clone().normalize().multiplyScalar(r0));
  }
  // 轻量滑动平均抹平折角，随后再次投影回球面 r0
  for (let pass = 0; pass < 2; pass++) {
    const src = projected.map((v) => v.clone());
    for (let i = 0; i < N; i++) {
      const a = src[(i - 1 + N) % N];
      const b = src[i];
      const c = src[(i + 1) % N];
      projected[i]
        .set((a.x + 2 * b.x + c.x) / 4, (a.y + 2 * b.y + c.y) / 4, (a.z + 2 * b.z + c.z) / 4)
        .normalize()
        .multiplyScalar(r0);
    }
  }
  // 最终贴合球面的闭合曲线
  const curve = new THREE.CatmullRomCurve3(projected, true, "centripetal", 0.5);

  // ---- 采样：每个采样点沿径向投影回河床半径，并构造局部基 ----
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) % 1;
    curve.getPointAt(t, _p);
    _fwd.copy(curve.getTangentAt(t)).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    // 贴合河床半径（沿径向投影，保证曲率）
    const p = _up.clone().multiplyScalar(r0);
    samples.push({
      p,
      up: _up.clone(),
      right: _right.clone(),
      fwd: _fwd.clone(),
      t,
    });
  }

  // ---- 扫掠带状几何（河床 + 水面 + 两侧堤壁） ----
  function sweepRibbon(samplesArr, baseOffset, upOffset, width, mat, doubleSide) {
    const n = samplesArr.length;
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
      const s = samplesArr[i];
      write(i * 12 + 0, s, -half, baseOffset + upOffset);
      write(i * 12 + 3, s, half, baseOffset + upOffset);
      write(i * 12 + 6, s, -half, baseOffset);
      write(i * 12 + 9, s, half, baseOffset);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      idx.push(a, b, a + 1, a + 1, b, b + 1); // 顶面
      idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // 底面
      idx.push(a, a + 2, b, a + 2, b + 2, b); // 左壁
      idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // 右壁
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

  const group = new THREE.Group();
  group.name = "world-canal";

  // 河床（暗色泥土）
  const bedMat = toonMat(0x3a2f26, { flatShading: true });
  const bed = sweepRibbon(samples, 0, 0, CANAL_HALF_WIDTH * 2, bedMat, true);
  bed.name = "canal-bed";
  group.add(bed);

  // 水面（半透明水，贴水面上抬 WATER_LIFT）
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a6a88,
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const water = sweepRibbon(samples, WATER_LIFT, 0, CANAL_HALF_WIDTH * 2, waterMat, true);
  water.name = "canal-water";
  water.renderOrder = 2;
  group.add(water);

  // 两侧堤壁（从水面向上到岸边）
  const bankMat = toonMat(0x6b563f, { flatShading: true });
  const bankTop = BANK_HEIGHT;
  const bank = sweepRibbon(samples, WATER_LIFT, bankTop, CANAL_HALF_WIDTH * 2, bankMat, true);
  bank.name = "canal-banks";
  group.add(bank);

  scene.add(group);

  // 各场景登岸浅湾信息（供 nav/marker 使用）
  const sinks = anchors.map((dir, i) => {
    // 找曲线在锚点附近最近采样点 t
    let bestT = 0;
    let bestD = Infinity;
    for (let s = 0; s < samples.length; s++) {
      const d = samples[s].p.clone().normalize().angleTo(dir);
      if (d < bestD) {
        bestD = d;
        bestT = samples[s].t;
      }
    }
    return { dir, u: bestT, name: opts.names?.[i] };
  });

  return { group, curve, sinks, planetRadius, waterR };
}
