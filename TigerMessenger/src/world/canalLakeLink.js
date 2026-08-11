// =====================================================================
//  运河 ↔ 水晶城大湖 · 落差互联（Canal–Lake Lock Link）
//
//  星海运河环线以「高架水渠」姿态横跨水晶城大湖上空：湖面沉在峡谷底，
//  与运河水面相差约 14 个世界单位。本模块在运河进出湖盘的两个交点上
//  利用落差实现互联互通：
//    - 进口（入湖）：阶梯瀑布船道 —— 运河水沿七级白石槽跌落湖面，
//      巡游战船顺梯级滑降入湖；
//    - 出口（归运河）：升船机 —— 双石塔 + 吊厢把游湖归来的战船
//      整厢抬升回运河水位，配重块反向起落。
//  巡游战船经 boat.userData.lakeLinkStep 钩子接管：
//    运河巡航 → 梯道下行 → 环湖巡航 → 升船机抬升 → 驶回运河，闭环通航。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { createCanalWaterMaterial } from "./canalSystem.js";
import { updateWarshipOars } from "../assets/harbor.js";

const DRAFT = 0.12; // 与 canalBoats DRAFT_LIFT 一致
const NSTEPS = 7; // 瀑布船道梯级数
const STEP_LEN = 2.7; // 每级沿程长度
const TOTAL_LEN = NSTEPS * STEP_LEN; // 梯道沿程总长
const EDGE_MARGIN = 0.012; // 交点略外扩，结构落在湖岸一侧
const CRUISE_SPEED = 4.2; // 环湖巡航线速度
const DOWN_DUR = 7.0; // 梯道下行耗时
const LIFT_DUR = 7.0; // 升船机抬升耗时
const EXIT_DUR = 3.2; // 升顶后驶回运河耗时
const CAISSON_GAP = 0.82; // 吊厢原点半径 → 船吃水半径 的差值
const EXIT_ARC_LEN = 6.0; // 驶回运河的过渡弧长

/* ---------- 小工具 ---------- */
const smoothstep = (x) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (x) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dirK = new THREE.Vector3();
const _fwdK = new THREE.Vector3();
const _zK = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();

/** 基架四元数（与 canalBoats placeOnCurve 约定一致：makeBasis(fwd, up, fwd×up)） */
function basisQuat(fwd, up, out) {
  _zK.crossVectors(fwd, up);
  _m4.makeBasis(fwd, up, _zK);
  return out.setFromRotationMatrix(_m4);
}

/** 绕轴 axis 把 from 转到 to 的有向角（(-π, π]） */
function signedAngleAround(from, to, axis) {
  _v1.copy(from).addScaledVector(axis, -from.dot(axis)).normalize();
  _v2.copy(to).addScaledVector(axis, -to.dot(axis)).normalize();
  _v3.crossVectors(_v1, _v2);
  return Math.atan2(axis.dot(_v3), _v1.dot(_v2));
}

let _foamTex = null;
/** 白色径向辉光贴图（水雾/浪花） */
function foamTexture() {
  if (_foamTex) return _foamTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(230,244,255,0.42)");
  g.addColorStop(1, "rgba(230,244,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _foamTex = new THREE.CanvasTexture(c);
  return _foamTex;
}

function foamSprite(scale, opacity) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: foamTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
  sp.scale.setScalar(scale);
  return sp;
}

/** 运河—大湖落差互联；交点求解失败时返回 null（调用方可 ?. 安全调用） */
export function buildCanalLakeLink(scene, canal, sea, opts = {}) {
  if (!canal?.curve || !sea?.centerDir || !Number.isFinite(sea.surfaceR)) {
    return null;
  }
  const R = canal.planetRadius;
  const curve = canal.curve;
  const waterR = canal.waterR;
  const centerDir = sea.centerDir.clone().normalize();
  const edgeAng = sea.angR + EDGE_MARGIN;

  /* ---------- 求运河曲线进出湖盘的两个交点 ---------- */
  const SCAN = 1024;
  const ins = new Array(SCAN);
  for (let i = 0; i < SCAN; i++) {
    curve.getPointAt(i / SCAN, _v1);
    ins[i] = _v1.normalize().angleTo(centerDir) < edgeAng;
  }
  // 最长连续 inside 段（防曲线多次擦边）
  let bestLen = 0;
  let bestStart = -1;
  for (let start = 0; start < SCAN; start++) {
    if (!ins[start] || ins[(start - 1 + SCAN) % SCAN]) continue;
    let len = 0;
    while (len < SCAN && ins[(start + len) % SCAN]) len++;
    if (len > bestLen) {
      bestLen = len;
      bestStart = start;
    }
  }
  if (bestStart < 0 || bestLen < 8) return null;
  const uEntry = (bestStart / SCAN) % 1;
  const uExit = ((bestStart + bestLen) / SCAN) % 1;

  /* ---------- 交点基架 ---------- */
  const entryDir = curve.getPointAt(uEntry, _v1).clone().normalize();
  const exitDir = curve.getPointAt(uExit, _v1).clone().normalize();
  const tangentAt = (u) => {
    const up = curve.getPointAt(u, _v2).normalize().clone();
    const t = curve.getTangentAt(u, _v3).clone();
    t.addScaledVector(up, -t.dot(up));
    if (t.lengthSq() < 1e-8) t.set(1, 0, 0).addScaledVector(up, -up.x);
    return { up, fwd: t.normalize() };
  };
  const eb = tangentAt(uEntry);
  const xb = tangentAt(uExit);
  const entryFwd = eb.fwd;
  const exitFwd = xb.fwd;
  // 沿曲线前进即向湖心推进的旋转轴（dir 绕它转 = 沿切向前行）
  const axisDown = new THREE.Vector3().crossVectors(entryDir, entryFwd).normalize();
  const axisExit = new THREE.Vector3().crossVectors(exitDir, exitFwd).normalize();

  /* ---------- 环湖巡航参数 ---------- */
  // 巡航方向与入湖航向一致：+φ 方向速度 = centerDir × dir
  const sweepSign =
    Math.sign(entryFwd.dot(new THREE.Vector3().crossVectors(centerDir, entryDir))) || 1;
  let sweepDelta = signedAngleAround(entryDir, exitDir, centerDir);
  while (sweepDelta * sweepSign < 0.4) sweepDelta += sweepSign * Math.PI * 2;

  /* ---------- 落差剖面：七级阶梯（水平段 + 前 38% 缓跌） ---------- */
  const liveDrop = () => waterR - sea.surfaceR; // 落差（relocate 后仍有效）
  function stairRadius(s, drop) {
    const stepDrop = drop / NSTEPS;
    const along = THREE.MathUtils.clamp(s, 0, 1) * TOTAL_LEN;
    const k = Math.min(NSTEPS - 1, Math.floor(along / STEP_LEN));
    const local = along / STEP_LEN - k;
    return waterR - (k + smoothstep(local / 0.38)) * stepDrop;
  }
  /** 梯道上 s 处的单位方向（沿切向前行） */
  function downDir(s, out) {
    return out.copy(entryDir).applyAxisAngle(axisDown, (s * TOTAL_LEN) / R);
  }

  /* ============================================================
   *  结构 1：进口阶梯瀑布船道
   * ============================================================ */
  const linkGroup = new THREE.Group();
  linkGroup.name = "canal-lake-link";
  const cascade = new THREE.Group();
  cascade.name = "lake-cascade-shipway";
  linkGroup.add(cascade);

  const stoneMat = toonMat(0xc2ccd2, { flatShading: true }); // 水晶城白石
  const stoneDark = toonMat(0x5f7078, { flatShading: true });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xeaf6ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const cascadeWaterMat = createCanalWaterMaterial();
  cascadeWaterMat.opacity = 0.78;

  {
    const drop = liveDrop();
    const stepDrop = drop / NSTEPS;
    // 每级槽体 + 两侧墙段（逐段随球面曲率转向）
    for (let k = 0; k < NSTEPS; k++) {
      const arcMid = (k + 0.5) * STEP_LEN;
      downDir(arcMid / TOTAL_LEN, _dirK);
      _fwdK.copy(entryFwd).applyAxisAngle(axisDown, arcMid / R);
      basisQuat(_fwdK, _dirK, _q1);
      const rTop = waterR - k * stepDrop;
      const troughH = stepDrop + 1.6;
      // makeBasis(fwd, up, z)：局部 +X=沿程 / +Y=径向 / +Z=横向
      const trough = new THREE.Mesh(
        new THREE.BoxGeometry(STEP_LEN + 0.55, troughH, 8.8),
        k % 2 ? stoneMat : stoneDark
      );
      trough.quaternion.copy(_q1);
      trough.position.copy(_dirK).multiplyScalar(rTop - 0.14 - troughH / 2);
      trough.castShadow = true;
      trough.receiveShadow = true;
      addOutline(trough, 0.02);
      cascade.add(trough);
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(STEP_LEN + 0.7, troughH + 1.1, 1.25),
          stoneMat
        );
        wall.quaternion.copy(_q1);
        wall.position
          .copy(_dirK)
          .multiplyScalar(rTop - 0.14 - (troughH + 1.1) / 2 + 0.4)
          .addScaledVector(_zK.crossVectors(_fwdK, _dirK), side * 4.85);
        wall.castShadow = true;
        addOutline(wall, 0.02);
        cascade.add(wall);
      }
    }

    // 跌水水面：一条沿阶梯剖面的条带（含伸入运河的接水坡）
    const M = 110;
    const halfW = 3.95;
    const pos = new Float32Array((M + 1) * 2 * 3);
    const APRON = 4.6; // 伸进运河的平接段
    for (let i = 0; i <= M; i++) {
      const s = i / M;
      const arc = -APRON + s * (TOTAL_LEN + APRON);
      const rr =
        arc < 0 ? waterR + 0.05 : stairRadius(arc / TOTAL_LEN, drop) + 0.05;
      downDir(Math.max(0, arc) / TOTAL_LEN, _dirK);
      if (arc < 0) _dirK.copy(entryDir).applyAxisAngle(axisDown, arc / R);
      _fwdK.copy(entryFwd).applyAxisAngle(axisDown, Math.max(0, arc) / R);
      _zK.crossVectors(_fwdK, _dirK);
      const px = _dirK.x * rr, py = _dirK.y * rr, pz = _dirK.z * rr;
      pos[i * 6 + 0] = px - _zK.x * halfW;
      pos[i * 6 + 1] = py - _zK.y * halfW;
      pos[i * 6 + 2] = pz - _zK.z * halfW;
      pos[i * 6 + 3] = px + _zK.x * halfW;
      pos[i * 6 + 4] = py + _zK.y * halfW;
      pos[i * 6 + 5] = pz + _zK.z * halfW;
    }
    const idx = [];
    for (let i = 0; i < M; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const sheetGeo = new THREE.BufferGeometry();
    sheetGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sheetGeo.setIndex(idx);
    sheetGeo.computeVertexNormals();
    const sheet = new THREE.Mesh(sheetGeo, cascadeWaterMat);
    sheet.name = "lake-cascade-water";
    sheet.renderOrder = 3;
    cascade.add(sheet);

    // 落点浪花：湖面白环 + 水雾
    downDir(1, _dirK);
    _fwdK.copy(entryFwd).applyAxisAngle(axisDown, TOTAL_LEN / R);
    _zK.crossVectors(_fwdK, _dirK);
    const splashBase = _dirK.clone().multiplyScalar(sea.surfaceR + 0.09)
      .addScaledVector(_fwdK, 1.6);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 4.6, 24), foamMat);
    // RingGeometry 位于 XY 平面（法线 +Z）：基架 Z 轴恰为径向上，直接对齐
    ring.quaternion.copy(basisQuat(_fwdK, _dirK, _q1));
    ring.position.copy(splashBase);
    ring.renderOrder = 4;
    cascade.add(ring);
    const foams = [];
    for (let i = 0; i < 5; i++) {
      const sp = foamSprite(2.2 + (i % 3) * 0.9, 0.5);
      sp.position.copy(splashBase)
        .addScaledVector(_zK, (i - 2) * 1.5)
        .addScaledVector(_dirK, 0.4 + (i % 2) * 0.5);
      sp.userData.phase = i * 1.3;
      cascade.add(sp);
      foams.push(sp);
    }
    cascade.userData.foams = foams;
    cascade.userData.ring = ring;
  }

  /* ============================================================
   *  结构 2：出口升船机（双塔 + 吊厢 + 配重）
   * ============================================================ */
  const lift = new THREE.Group();
  lift.name = "lake-ship-lift";
  linkGroup.add(lift);

  const mechMat = toonMat(0xd8b36a, { flatShading: true }); // 金色机构
  const liftQuat = basisQuat(exitFwd, exitDir, new THREE.Quaternion());
  const midR = (waterR + sea.surfaceR) / 2;
  const dropH = liveDrop();

  // 双塔 + 顶横梁 + 导轨（局部 +X=沿程 / +Y=径向 / +Z=横向）
  for (const side of [-1, 1]) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, dropH + 7.5, 2.6),
      stoneMat
    );
    tower.quaternion.copy(liftQuat);
    tower.position.copy(exitDir).multiplyScalar(midR)
      .addScaledVector(_zK.crossVectors(exitFwd, exitDir), side * 6.1);
    tower.castShadow = true;
    addOutline(tower, 0.024);
    lift.add(tower);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, dropH + 2.5, 0.4), stoneDark);
    rail.quaternion.copy(liftQuat);
    rail.position.copy(exitDir).multiplyScalar(midR)
      .addScaledVector(_v3.crossVectors(exitFwd, exitDir), side * 4.75);
    lift.add(rail);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 15.6), stoneDark);
  beam.quaternion.copy(liftQuat);
  beam.position.copy(exitDir).multiplyScalar(waterR + 5.2);
  beam.castShadow = true;
  addOutline(beam, 0.02);
  lift.add(beam);
  // 卷扬轮：圆柱默认轴 +Y，转到沿横向（局部 Z）
  const drums = [];
  for (const side of [-1, 1]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.1, 10), mechMat);
    drum.quaternion.copy(liftQuat);
    drum.rotateX(Math.PI / 2);
    drum.position.copy(exitDir).multiplyScalar(waterR + 5.2)
      .addScaledVector(_v3.crossVectors(exitFwd, exitDir), side * 3.4);
    lift.add(drum);
    drums.push(drum);
  }

  // 吊厢：石底 + 四壁 + 厢内水面（整体沿径向上行）
  const caisson = new THREE.Group();
  caisson.name = "lake-lift-caisson";
  caisson.quaternion.copy(liftQuat);
  const cFloor = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.8, 10.2), stoneDark);
  caisson.add(cFloor);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14.6, 1.7, 0.55), stoneMat);
    wall.position.set(side * 7.05, 0.85, 0);
    addOutline(wall, 0.016);
    caisson.add(wall);
  }
  for (const end of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 10.2), stoneMat);
    wall.position.set(end * 4.85, 0.85, 0);
    addOutline(wall, 0.016);
    caisson.add(wall);
  }
  const caissonWaterMat = createCanalWaterMaterial();
  caissonWaterMat.opacity = 0.75;
  const cWater = new THREE.Mesh(new THREE.PlaneGeometry(13.7, 9.3), caissonWaterMat);
  cWater.rotation.x = -Math.PI / 2;
  cWater.position.y = 0.7;
  cWater.renderOrder = 3;
  caisson.add(cWater);
  lift.add(caisson);

  // 配重块：与吊厢反向起落
  const weights = [];
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 1.6), mechMat);
    w.quaternion.copy(liftQuat);
    addOutline(w, 0.02);
    lift.add(w);
    weights.push(w);
    w.userData.side = side;
  }
  const caissonBottomR = sea.surfaceR + DRAFT - CAISSON_GAP;
  const caissonTopR = waterR + DRAFT - CAISSON_GAP;

  scene.add(linkGroup);
  linkGroup.userData.kind = "canal-lake-link";
  linkGroup.userData.uEntry = uEntry;
  linkGroup.userData.uExit = uExit;
  linkGroup.userData.drop = dropH;

  /* ============================================================
   *  战船接管：运河巡航 → 梯道下行 → 环湖 → 升船机 → 回运河
   * ============================================================ */
  const boats = []; // 已接管的船
  let caissonR = caissonBottomR;
  const curveLen = curve.getLength();

  const liftOccupied = () =>
    boats.some((b) => b.userData.lakeLinkState?.phase === "lift");

  function nearestU(dirN) {
    let bestU = 0;
    let bestD = Infinity;
    for (let i = 0; i < 256; i++) {
      const u = i / 256;
      curve.getPointAt(u, _v1);
      const d = _v1.normalize().angleTo(dirN);
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }
    return bestU;
  }

  function initState(boat) {
    const dirN = boat.position.clone().normalize();
    const st = { phase: "canal", s: 0, phi: 0 };
    if (dirN.angleTo(centerDir) < sea.angR + 0.03) {
      let raw = signedAngleAround(entryDir, dirN, centerDir);
      while (raw * sweepSign < 0) raw += sweepSign * Math.PI * 2;
      st.phase = "lake";
      st.phi = Math.min(raw * sweepSign, Math.abs(sweepDelta) * 0.98) * sweepSign;
    } else {
      boat.userData.u = nearestU(dirN);
    }
    return st;
  }

  /** 下船吸附回来时的状态重建：在湖里回环湖，否则回运河 */
  function resetFromPosition(boat, st) {
    const dirN = boat.position.clone().normalize();
    if (dirN.angleTo(centerDir) < sea.angR + 0.03) {
      let raw = signedAngleAround(entryDir, dirN, centerDir);
      while (raw * sweepSign < 0) raw += sweepSign * Math.PI * 2;
      st.phase = "lake";
      st.phi = Math.min(raw * sweepSign, Math.abs(sweepDelta) * 0.98) * sweepSign;
      st.s = 0;
    } else {
      st.phase = "canal";
      st.s = 0;
      boat.userData.u = nearestU(dirN);
    }
  }

  const lakeDirAt = (phi, out) => out.copy(entryDir).applyAxisAngle(centerDir, phi);

  function placeOnLake(boat, phi) {
    lakeDirAt(phi, _dirK);
    _v3.crossVectors(centerDir, _dirK).normalize().multiplyScalar(sweepSign);
    _zK.crossVectors(_v3, _dirK);
    _m4.makeBasis(_v3, _dirK, _zK);
    boat.quaternion.setFromRotationMatrix(_m4);
    boat.position.copy(_dirK).multiplyScalar(sea.surfaceR + DRAFT);
  }

  function stepBoat(boat, dt, patrol) {
    const st = boat.userData.lakeLinkState;
    if (!st) return;
    if (boat.userData.needsSnap) {
      resetFromPosition(boat, st);
      boat.userData.needsSnap = false;
    }
    const surfR = sea.surfaceR; // 逐帧读，兼容 relocate
    if (st.phase === "canal") {
      const prevU = boat.userData.u;
      const nextU = prevU + boat.userData.speed * dt;
      const crossed =
        (prevU <= uEntry && uEntry < nextU) ||
        (nextU >= 1 && uEntry < nextU - 1);
      if (crossed) {
        boat.userData.u = uEntry;
        patrol.place(boat, patrol.curve, patrol.waterR, uEntry);
        st.phase = "down";
        st.s = 0;
      } else {
        boat.userData.u = nextU % 1;
        patrol.place(boat, patrol.curve, patrol.waterR, boat.userData.u);
        updateWarshipOars(boat, dt, 0.95);
      }
      return;
    }
    if (st.phase === "down") {
      // 顺梯级滑降：水平推进 + 每级前段缓跌，船体自然俯冲
      st.s += dt / DOWN_DUR;
      const s = Math.min(1, st.s);
      const dir = downDir(s, _dirK);
      _fwdK.copy(entryFwd).applyAxisAngle(axisDown, (s * TOTAL_LEN) / R);
      const rr = stairRadius(s, waterR - surfR) + DRAFT;
      // 数值切向（含跌落俯角）
      downDir(Math.max(0, s - 0.012), _v1).multiplyScalar(
        stairRadius(Math.max(0, s - 0.012), waterR - surfR) + DRAFT
      );
      downDir(Math.min(1, s + 0.012), _v2).multiplyScalar(
        stairRadius(Math.min(1, s + 0.012), waterR - surfR) + DRAFT
      );
      _v3.copy(_v2).sub(_v1).normalize();
      _zK.crossVectors(_v3, dir);
      _m4.makeBasis(_v3, dir, _zK);
      boat.quaternion.setFromRotationMatrix(_m4);
      boat.position.copy(dir).multiplyScalar(rr);
      updateWarshipOars(boat, dt, 0.55);
      if (st.s >= 1) {
        st.phase = "lake";
        st.phi = 0;
      }
      return;
    }
    if (st.phase === "lake") {
      const orbitR = Math.sin(entryDir.angleTo(centerDir)) * surfR;
      const omega = CRUISE_SPEED / Math.max(1, orbitR);
      st.phi += sweepSign * omega * dt;
      const progress = THREE.MathUtils.clamp(st.phi / sweepDelta, 0, 1);
      if (st.phi * sweepSign >= Math.abs(sweepDelta)) {
        // 抵达升船机捕获点
        _m4.makeBasis(exitFwd, exitDir, _v3.crossVectors(exitFwd, exitDir));
        boat.quaternion.setFromRotationMatrix(_m4);
        boat.position.copy(exitDir).multiplyScalar(surfR + DRAFT);
        st.phase = "waitLift";
        st.s = 0;
        return;
      }
      // 末段 12% 向出口方向收拢，消除锥角残差
      const blend = smoothstep((progress - 0.88) / 0.12);
      lakeDirAt(st.phi, _dirK);
      if (blend > 0) _dirK.lerp(exitDir, blend).normalize();
      _v3.crossVectors(centerDir, _dirK).normalize().multiplyScalar(sweepSign);
      _zK.crossVectors(_v3, _dirK);
      _m4.makeBasis(_v3, _dirK, _zK);
      boat.quaternion.setFromRotationMatrix(_m4);
      boat.position
        .copy(_dirK)
        .multiplyScalar(surfR + DRAFT + Math.sin(st.phi * 3.1) * 0.03);
      updateWarshipOars(boat, dt, 1);
      return;
    }
    if (st.phase === "waitLift") {
      // 捕获点前小幅漂等：吊厢被占用或未到底时原地打转
      st.s += dt;
      const free = !liftOccupied() && caissonR < caissonBottomR + 0.6;
      if (free) {
        st.phase = "lift";
        st.s = 0;
        return;
      }
      const wob = Math.sin(st.s * 0.9) * 0.012;
      _v1.copy(exitDir).applyAxisAngle(centerDir, -sweepSign * (0.03 + wob));
      _v3.crossVectors(centerDir, _v1).normalize().multiplyScalar(sweepSign);
      _zK.crossVectors(_v3, _v1);
      _m4.makeBasis(_v3, _v1, _zK);
      boat.quaternion.setFromRotationMatrix(_m4);
      boat.position.copy(_v1).multiplyScalar(surfR + DRAFT);
      updateWarshipOars(boat, dt, 0.18);
      return;
    }
    if (st.phase === "lift") {
      // 整厢抬升：吊厢随船同步上行（link.update 读取船位驱动吊厢）
      st.s += dt / LIFT_DUR;
      const e = easeInOut(Math.min(1, st.s));
      const rr = surfR + DRAFT + (waterR - surfR) * e;
      _v3.crossVectors(exitFwd, exitDir);
      _m4.makeBasis(exitFwd, exitDir, _v3);
      boat.quaternion.setFromRotationMatrix(_m4);
      boat.position.copy(exitDir).multiplyScalar(rr);
      updateWarshipOars(boat, dt, 0.1);
      if (st.s >= 1) {
        st.phase = "exit";
        st.s = 0;
      }
      return;
    }
    if (st.phase === "exit") {
      // 升顶后沿切向驶回运河航道
      st.s += dt / EXIT_DUR;
      const e = smoothstep(Math.min(1, st.s));
      const theta = (e * EXIT_ARC_LEN) / R;
      _dirK.copy(exitDir).applyAxisAngle(axisExit, theta);
      _fwdK.copy(exitFwd).applyAxisAngle(axisExit, theta);
      _zK.crossVectors(_fwdK, _dirK);
      _m4.makeBasis(_fwdK, _dirK, _zK);
      boat.quaternion.setFromRotationMatrix(_m4);
      boat.position.copy(_dirK).multiplyScalar(waterR + DRAFT);
      updateWarshipOars(boat, dt, 0.8);
      if (st.s >= 1) {
        boat.userData.u = (uExit + EXIT_ARC_LEN / curveLen) % 1;
        st.phase = "canal";
        st.s = 0;
      }
      return;
    }
  }

  const api = {
    ok: true,
    group: linkGroup,
    uEntry,
    uExit,

    /** 把巡游战船全部接入落差通航闭环 */
    attachAll(boatList) {
      for (const boat of boatList || []) {
        if (!boat?.userData || boat.userData.lakeLinkStep) continue;
        boat.userData.lakeLinkState = initState(boat);
        boat.userData.lakeLinkStep = (b, dt, patrol) => stepBoat(b, dt, patrol);
        boats.push(boat);
      }
    },

    /** 吊厢/配重/浪花动画 */
    update(dt, t) {
      // 吊厢：有船搭乘则跟随船位；否则缓降回底待命
      const rider = boats.find((b) => b.userData.lakeLinkState?.phase === "lift");
      if (rider) {
        caissonR = rider.position.length() - CAISSON_GAP;
      } else {
        caissonR += THREE.MathUtils.clamp(
          caissonBottomR - caissonR,
          -5.5 * dt,
          5.5 * dt
        );
      }
      caisson.position.copy(exitDir).multiplyScalar(caissonR);
      for (const w of weights) {
        const span = caissonTopR - caissonBottomR;
        const k = (caissonR - caissonBottomR) / Math.max(0.01, span);
        w.position.copy(exitDir).multiplyScalar(caissonTopR + 1.4 - k * span)
          .addScaledVector(_v3.crossVectors(exitFwd, exitDir), w.userData.side * 7.9);
      }
      // 卷扬轮转动（吊厢运动时）
      const moving = rider || Math.abs(caissonR - caissonBottomR) > 0.15;
      if (moving) {
        for (const d of drums) d.rotateY(1.6 * dt);
      }
      // 跌水微光 + 浪花呼吸
      cascadeWaterMat.opacity = 0.74 + 0.07 * Math.sin(t * 2.3);
      caissonWaterMat.opacity = 0.7 + 0.06 * Math.sin(t * 2.1 + 1.2);
      const foams = cascade.userData.foams || [];
      for (const sp of foams) {
        const ph = sp.userData.phase || 0;
        const k = 0.5 + 0.5 * Math.sin(t * 2.6 + ph);
        sp.material.opacity = 0.28 + 0.4 * k;
        sp.scale.setScalar((2.2 + (ph % 1.7)) * (0.85 + 0.3 * k));
      }
      const ring = cascade.userData.ring;
      if (ring) {
        const k = ((t * 0.6) % 1);
        ring.scale.setScalar(0.6 + k * 0.9);
        ring.material.opacity = 0.55 * (1 - k);
      }
    },

    /** 大湖 relocate 后重建结构（交点/落差随湖位变化） */
    rebuild() {
      // 结构随湖盘交点重建：简单做法 = 复位所有船到运河巡航并让外部重建本模块
      for (const boat of boats) {
        const st = boat.userData.lakeLinkState;
        if (st) resetFromPosition(boat, st);
      }
    },
  };
  return api;
}
