// =====================================================================
//  旧港装船物流：纸士兵计数装货 → 满载离港入运河 →
//  城堡雪山附近运河船沿护城河进港继续装船
//  太鼓敲击期间：进港战船船员下船 → 运河侧 → 台地 5→4→3→2→1 快步巡查
//  （忽聚忽散、1–3 人身距、矛头向前）；鼓声结束原路经运河回港上船
// =====================================================================
import * as THREE from "three";
import {
  boatCrewCount,
  createHarborPatrolSoldier,
  ensureDeckCargoMarkers,
  updateDeckCargoMarkers,
  updateHarborCrane,
  updateWarshipOars,
} from "./harbor.js";
import { isInfiltrationMissionActive } from "../audio/sfx.js";
import { citadelTerraceMetrics } from "../world/odysseyCitadel.js";

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _pt = new THREE.Vector3();
const _pt2 = new THREE.Vector3();
const _local = new THREE.Vector3();
const _da = new THREE.Vector3();
const _db = new THREE.Vector3();

const DRAFT = 0.12;
const DEPART_SEC = 16;
const ARRIVE_SEC = 24;
const CANAL_SCALE = 1.84;
const DOCK_SCALE = 2;
/** 下船巡查人数上限 */
const PATROL_MAX = 16;
/** 纸士兵身位（放大后约 0.55） */
const BODY_LEN = 0.55;
/** 攀登全路径耗时（秒）· 放慢以便看清上城过程 */
const CLIMB_SEC = 90;
/** 回程耗时 · 放慢以便看清回港上船 */
const RETURN_SEC = 80;
/** 忽聚忽散周期（秒） */
const FLOCK_PERIOD = 5.5;
/** 运河水面站立抬升（相对河床采样点，≈水深 + 浅履） */
const CANAL_STAND_LIFT = 0.72;
/** 路径段球面插值密度（越大越贴地、越不易穿山） */
const SURFACE_SEGS = 8;

/**
 * @param {{
 *   harbor: THREE.Group,
 *   boat: THREE.Object3D,
 *   crane: THREE.Object3D,
 *   squads: THREE.Group[],
 *   scene: THREE.Scene,
 * }} opts
 */
export function createHarborLogistics(opts) {
  const harbor = opts.harbor;
  const crane = opts.crane;
  const squads = opts.squads || [];
  const scene = opts.scene;

  const dockLocalPos = opts.boat.position.clone();
  const dockLocalQuat = opts.boat.quaternion.clone();

  /** @type {THREE.Object3D|null} */
  let activeBoat = opts.boat;
  /** @type {'loading'|'readyToDepart'|'departing'|'waiting'|'arriving'} */
  let phase = "loading";
  let cargo = 0;
  let capacity = Math.max(1, boatCrewCount(activeBoat));
  let pathT = 0;
  /** @type {THREE.Vector3[]} */
  let pathPts = [];
  /** @type {THREE.Object3D|null} */
  let transitBoat = null;
  let waitAcc = 0;

  /** @type {null | { curve: THREE.CatmullRomCurve3, waterR: number }} */
  let canal = null;
  /** @type {null | { boats: THREE.Object3D[], nearestU?: Function }} */
  let canalBoats = null;
  /** @type {THREE.Object3D|null} */
  let moat = null;
  /** @type {((b: THREE.Object3D|null) => void)|null} */
  let onBoatChange = null;

  activeBoat.userData.harborDocked = true;
  activeBoat.userData.cargoLoaded = 0;
  activeBoat.userData.cargoCapacity = capacity;
  ensureDeckCargoMarkers(activeBoat);
  updateDeckCargoMarkers(activeBoat, 0, capacity);

  // ---------- 太鼓巡查：下船 → 运河侧 → 台地 5→1 →（鼓停）原路回船 ----------
  /** @type {'idle'|'march'|'return'} */
  let drumPhase = "idle";
  let drumT = 0;
  /** @type {THREE.Group|null} */
  let patrolRoot = null;
  /** @type {THREE.Group[]} */
  let patrolSquad = [];
  /** @type {THREE.Vector3[]} 世界坐标攀登路径（港口→运河→台5…台1） */
  let climbPath = [];
  /** 路径累计长度 */
  let climbLengths = [0];
  let climbTotal = 0;
  /** 队伍前端沿路径距离 */
  let columnFrontDist = 0;
  /** 回程时前端距离（从 climbTotal 减到 0） */
  let returnFrontDist = 0;
  /** 巡查结束后必须先装货再离港 */
  let loadAfterPatrol = false;
  /** @type {THREE.Object3D|null} */
  let citadel = null;
  const deckY = dockLocalPos.y;

  function drumsHoldShips() {
    return isInfiltrationMissionActive();
  }

  function setCrewVisible(boat, visible) {
    const crew = boat?.getObjectByName?.("warship-crew");
    if (crew) crew.visible = !!visible;
  }

  function clearPatrolSquad() {
    for (const s of patrolSquad) {
      s.removeFromParent();
    }
    patrolSquad = [];
    if (patrolRoot) patrolRoot.visible = false;
  }

  function ensurePatrolRoot() {
    if (patrolRoot) return patrolRoot;
    patrolRoot = new THREE.Group();
    patrolRoot.name = "harbor-drum-patrol";
    // 世界空间：要走上台地，不能挂在码头局部
    scene.add(patrolRoot);
    return patrolRoot;
  }

  function boatSideWorld() {
    // 船舷落在码头甲板面上（脚踩港口地面）
    _local.set(dockLocalPos.x - 2.4, deckY + 0.02, dockLocalPos.z);
    return harbor.localToWorld(_local.clone());
  }

  /**
   * 运河水面站立点：曲线采样在河床，沿法线抬到水面之上，士兵走在水面上。
   */
  function canalWaterPointAt(u, out = new THREE.Vector3()) {
    const uu = ((u % 1) + 1) % 1;
    canal.curve.getPointAt(uu, out);
    const bedLen = out.length();
    if (bedLen < 1e-6) return out.set(0, canal.waterR || 160, 0);
    out.multiplyScalar((bedLen + CANAL_STAND_LIFT) / bedLen);
    return out;
  }

  /** 台地前缘（朝港口方向）世界点；index 0=最高台1，4=台5 */
  function terraceFrontWorld(terraceIndex, radiusScale = 0.88) {
    if (!citadel) return null;
    const metrics = citadelTerraceMetrics(citadel.userData?.contourSpec);
    const m = metrics[terraceIndex];
    if (!m) return null;
    citadel.updateMatrixWorld(true);
    harbor.updateMatrixWorld(true);
    const harborW = harbor.getWorldPosition(_v2);
    citadel.worldToLocal(_local.copy(harborW));
    _local.y = 0;
    if (_local.lengthSq() < 1e-6) _local.set(0, 0, 1);
    _local.normalize().multiplyScalar(Math.max(2.4, m.radius * radiusScale));
    _local.y = m.top + 0.14;
    return citadel.localToWorld(_local.clone());
  }

  /**
   * 球面插值两点（沿地表/水面弧，避免弦线穿进星球内部导致看不见）。
   */
  function surfaceLerp(a, b, t, out) {
    const ra = a.length();
    const rb = b.length();
    _da.copy(a).normalize();
    _db.copy(b).normalize();
    let dot = THREE.MathUtils.clamp(_da.dot(_db), -1, 1);
    const omega = Math.acos(dot);
    if (omega < 1e-4) {
      out.copy(a).lerp(b, t);
      return out;
    }
    const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s1 = Math.sin(t * omega) / Math.sin(omega);
    out.copy(_da).multiplyScalar(s0).addScaledVector(_db, s1).normalize();
    out.multiplyScalar(THREE.MathUtils.lerp(ra, rb, t));
    return out;
  }

  /** 把稀疏锚点加密为贴地路径 */
  function densifySurfacePath(anchors) {
    const dense = [];
    if (!anchors.length) return dense;
    dense.push(anchors[0].clone());
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1];
      const b = anchors[i];
      const segs = Math.max(
        2,
        Math.ceil(a.distanceTo(b) / 3.5) // 约每 3.5 单位一个点
      );
      for (let s = 1; s <= segs; s++) {
        surfaceLerp(a, b, s / segs, _pt);
        dense.push(_pt.clone());
      }
    }
    return dense;
  }

  function rebuildClimbPath() {
    const anchors = [];
    harbor.updateMatrixWorld(true);

    // ---- 1) 港口地面：船舷 → 栈桥甲板 → 岸缘（脚踩码头） ----
    anchors.push(boatSideWorld());
    anchors.push(harbor.localToWorld(new THREE.Vector3(1.5, deckY + 0.02, 0.9)));
    anchors.push(harbor.localToWorld(new THREE.Vector3(3.8, deckY + 0.02, 0.2)));
    anchors.push(harbor.localToWorld(new THREE.Vector3(6.2, deckY + 0.02, -0.6)));
    anchors.push(harbor.localToWorld(new THREE.Vector3(8.5, deckY + 0.04, -1.1)));

    // ---- 2) 运河水面：从码头附近沿运河走向城堡（脚踩水面） ----
    if (canal?.curve) {
      const start = anchors[anchors.length - 1];
      const u0 = nearestCanalU(start);
      const citadelAnchor = citadel?.position || moat?.position || start;
      const u1 = nearestCanalU(citadelAnchor);
      let du = u1 - u0;
      while (du > 0.5) du -= 1;
      while (du < -0.5) du += 1;
      // 先过渡到运河水面
      canalWaterPointAt(u0, _v);
      anchors.push(_v.clone());
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const u = u0 + du * (i / steps);
        canalWaterPointAt(u, _v);
        anchors.push(_v.clone());
      }
    }

    // ---- 3) 台地 5→4→3→2→1：外缘登台 → 台面（可见逐层上冲） ----
    if (citadel) {
      for (let ti = 4; ti >= 0; ti--) {
        // 略外侧一点（下一级/坡缘）再上台面，形成“冲上台面”的可见折线
        const outer = terraceFrontWorld(ti, 0.98);
        const onTop = terraceFrontWorld(ti, 0.78);
        if (outer) anchors.push(outer);
        if (onTop) anchors.push(onTop);
      }
    }

    // 贴地加密，避免段间弦线钻进山体
    climbPath = densifySurfacePath(anchors);
    climbLengths = [0];
    for (let i = 1; i < climbPath.length; i++) {
      // 用球面弧长近似
      const a = climbPath[i - 1];
      const b = climbPath[i];
      const ra = (a.length() + b.length()) * 0.5;
      _da.copy(a).normalize();
      _db.copy(b).normalize();
      const ang = Math.acos(THREE.MathUtils.clamp(_da.dot(_db), -1, 1));
      climbLengths.push(climbLengths[i - 1] + Math.max(ang * ra, a.distanceTo(b) * 0.5));
    }
    climbTotal = climbLengths[climbLengths.length - 1] || 1;
  }

  function sampleClimbPath(dist, outPos, outFwd) {
    const d = THREE.MathUtils.clamp(dist, 0, climbTotal);
    if (climbPath.length < 2) {
      outPos.copy(climbPath[0] || _v.set(0, 1, 0));
      outFwd.set(1, 0, 0);
      return;
    }
    let i = 1;
    while (i < climbLengths.length && climbLengths[i] < d) i++;
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(climbPath.length - 1, i);
    const d0 = climbLengths[i0];
    const d1 = climbLengths[i1];
    const t = d1 > d0 + 1e-6 ? (d - d0) / (d1 - d0) : 0;
    // 段内也走球面，防止穿地
    surfaceLerp(climbPath[i0], climbPath[i1], t, outPos);
    if (t < 0.98) {
      surfaceLerp(climbPath[i0], climbPath[i1], Math.min(1, t + 0.04), outFwd);
      outFwd.sub(outPos);
    } else if (i1 + 1 < climbPath.length) {
      outFwd.copy(climbPath[i1 + 1]).sub(climbPath[i1]);
    } else {
      outFwd.copy(climbPath[i1]).sub(climbPath[i0]);
    }
    if (outFwd.lengthSq() < 1e-8) outFwd.set(1, 0, 0);
  }

  /** 局部 +X 朝行进方向，+Y 贴球面法线 */
  function orientSoldier(soldier, dir) {
    _up.copy(soldier.position).normalize();
    _fwd.copy(dir).addScaledVector(_up, -dir.dot(_up));
    if (_fwd.lengthSq() < 1e-8) {
      _fwd.set(1, 0, 0).addScaledVector(_up, -_up.x);
    }
    _fwd.normalize();
    _z.crossVectors(_fwd, _up).normalize();
    _basis.makeBasis(_fwd, _up, _z);
    soldier.quaternion.setFromRotationMatrix(_basis);
  }

  function poseFastMarch(soldier, moving, clock) {
    const parts = soldier.userData.parts;
    if (!parts) return;
    // 快步：高频大步幅
    const step = clock * 16 + (soldier.userData.patrolIndex || 0) * 1.3;
    const swing = moving ? Math.sin(step) * 0.62 : 0;
    parts.legL.rotation.z = swing;
    parts.legR.rotation.z = -swing;
    parts.body.rotation.z = moving ? -0.16 : -0.1;
    // 左火把 / 右持枪前指，仅微振
    parts.armL.rotation.z = -0.55 + (moving ? swing * 0.08 : 0);
    parts.armR.rotation.z = 1.28 - (moving ? Math.abs(swing) * 0.05 : 0);
    if (parts.crate) parts.crate.visible = false;
  }

  /**
   * 忽聚忽散：间距在 1–3 人身之间脉动，并带侧向散开。
   * @returns {{ spacing: number, lateral: number }}
   */
  function flockSpacing(i, n, clock) {
    // 0=聚 1=散
    const pulse = 0.5 + 0.5 * Math.sin((clock * Math.PI * 2) / FLOCK_PERIOD + 0.4);
    const spacingMul = THREE.MathUtils.lerp(1.0, 3.0, pulse);
    const spacing = BODY_LEN * spacingMul;
    // 侧向：聚时贴中线，散时左右拉开
    const rank = i - (n - 1) * 0.5;
    const lateral = rank * BODY_LEN * THREE.MathUtils.lerp(0.15, 0.85, pulse);
    return { spacing, lateral, pulse };
  }

  function placeSoldierOnPath(soldier, pathDist, clock, moving) {
    const i = soldier.userData.patrolIndex || 0;
    const n = soldier.userData.patrolN || 1;
    const { spacing, lateral } = flockSpacing(i, n, clock);
    // 队列：越靠前 pathDist 越大；身后按 spacing 拉开
    const dist = Math.max(0, pathDist - i * spacing);
    sampleClimbPath(dist, _pt, _fwd);
    // 侧向：贴球面切向错开，再投影回同半径壳（防侧移钻地）
    const shellR = _pt.length();
    _up.copy(_pt).normalize();
    _z.crossVectors(_fwd, _up).normalize();
    if (_z.lengthSq() < 1e-8) {
      _z.set(0, 1, 0).cross(_up).normalize();
    }
    _pt.addScaledVector(_z, lateral);
    if (_pt.lengthSq() > 1e-8) _pt.normalize().multiplyScalar(shellR);
    // 微步频起伏（沿法线，始终“站”在壳上）
    _pt.addScaledVector(
      _up,
      Math.abs(Math.sin(clock * 16 + i * 1.1)) * 0.045
    );
    soldier.position.copy(_pt);
    soldier.visible = true;
    orientSoldier(soldier, _fwd);
    poseFastMarch(soldier, moving, clock);
  }

  function spawnDisembark(boat) {
    if (!boat) return;
    rebuildClimbPath();
    if (climbPath.length < 2) {
      console.warn("[harborLogistics] climbPath too short", climbPath.length);
      return;
    }
    const root = ensurePatrolRoot();
    root.visible = true;
    clearPatrolSquad();
    const n = Math.min(PATROL_MAX, Math.max(6, boatCrewCount(boat) || 8));
    for (let i = 0; i < n; i++) {
      const soldier = createHarborPatrolSoldier();
      soldier.userData.patrolIndex = i;
      soldier.userData.patrolN = n;
      soldier.castShadow = true;
      soldier.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      root.add(soldier);
      patrolSquad.push(soldier);
      // 从船舷起排，立刻看得见在港口地面上
      placeSoldierOnPath(soldier, (n - 1 - i) * BODY_LEN * 1.4, 0, false);
    }
    setCrewVisible(boat, false);
    // 巡查期间暂停码头装货；士兵回船后再装
    setLoading(false);
    loadAfterPatrol = true;
    drumPhase = "march";
    drumT = 0;
    // 前端略出列，整队从港口甲板开拔
    columnFrontDist = Math.min(climbTotal * 0.02, (n - 1) * BODY_LEN * 2.2);
  }

  /** 士兵回船完毕：恢复/重新开始装货，装满后再离港 */
  function beginLoadingAfterPatrol() {
    if (!activeBoat) {
      loadAfterPatrol = false;
      return;
    }
    setCrewVisible(activeBoat, true);
    // 回船后重新装货（清空进度，保证能看到完整装货过程）
    cargo = 0;
    capacity = Math.max(1, boatCrewCount(activeBoat) || capacity);
    activeBoat.userData.cargoLoaded = 0;
    activeBoat.userData.cargoCapacity = capacity;
    ensureDeckCargoMarkers(activeBoat);
    updateDeckCargoMarkers(activeBoat, 0, capacity);
    phase = "loading";
    setLoading(true);
    loadAfterPatrol = false;
  }

  function updateDrumPatrol(dt, t) {
    const hold = drumsHoldShips();
    const docked =
      activeBoat &&
      (phase === "loading" || phase === "readyToDepart") &&
      activeBoat.userData.harborDocked;

    if (hold && docked && drumPhase === "idle") {
      spawnDisembark(activeBoat);
    }

    // 鼓声结束 → 原路返回（经运河回港上船）
    if (!hold && drumPhase === "march") {
      drumPhase = "return";
      drumT = 0;
      returnFrontDist = columnFrontDist;
    }

    if (drumPhase === "idle") return;
    if (climbPath.length < 2) {
      rebuildClimbPath();
      if (climbPath.length < 2) return;
    }

    drumT += dt;

    if (drumPhase === "march") {
      // 快步推进到台顶（台5→1）；到顶后钉在终点踏步待命，队形仍忽聚忽散
      const speed = climbTotal / CLIMB_SEC;
      columnFrontDist = Math.min(climbTotal, columnFrontDist + speed * dt);
      const atTop = columnFrontDist >= climbTotal - 0.05;
      if (atTop) columnFrontDist = climbTotal;
      for (const s of patrolSquad) {
        // 到顶仍保持快步踏步感（果断、不停顿发呆）
        placeSoldierOnPath(s, columnFrontDist, t, true);
      }
      return;
    }

    if (drumPhase === "return") {
      const speed = climbTotal / RETURN_SEC;
      returnFrontDist = Math.max(0, returnFrontDist - speed * dt);
      for (const s of patrolSquad) {
        placeSoldierOnPath(s, returnFrontDist, t, returnFrontDist > 0.2);
      }
      // 全队回到起点附近 → 上船
      const n = patrolSquad.length;
      const tailDist = returnFrontDist - (n - 1) * BODY_LEN * 3.0;
      if (returnFrontDist <= 0.15 || tailDist < -BODY_LEN) {
        clearPatrolSquad();
        drumPhase = "idle";
        drumT = 0;
        columnFrontDist = 0;
        returnFrontDist = 0;
        // 回船 → 立刻开始装货（纸士兵往返搬箱），装满再驶离
        beginLoadingAfterPatrol();
      }
    }
  }

  function setLoading(on) {
    for (const s of squads) s.userData.loading = !!on;
  }

  function notifyBoat() {
    onBoatChange?.(activeBoat);
  }

  function onDeliver(n) {
    if (phase !== "loading" || !activeBoat) return;
    // 巡查未结束（人还在岸上）不计入装货
    if (drumPhase !== "idle" || loadAfterPatrol) return;
    // 驾驶中仍可装货，但满载后等下船再离港
    cargo = Math.min(capacity, cargo + Math.max(0, n | 0));
    activeBoat.userData.cargoLoaded = cargo;
    activeBoat.userData.cargoCapacity = capacity;
    updateDeckCargoMarkers(activeBoat, cargo, capacity);
    if (cargo >= capacity) {
      if (activeBoat.userData.piloted || drumsHoldShips() || patrolSquad.length) {
        // 太鼓期间 / 船员未归队：满载也不得离港
        phase = "readyToDepart";
        setLoading(false);
      } else {
        // 装满 → 离港
        beginDepart();
      }
    }
  }

  for (const s of squads) {
    s.userData.onDeliver = onDeliver;
    s.userData.loading = true;
  }

  function waterRadius(pos) {
    if (canal && Number.isFinite(canal.waterR)) return canal.waterR + DRAFT;
    return Math.max(1, pos.length());
  }

  function orientOnSphere(boat, pos, fwdHint) {
    _up.copy(pos).normalize();
    if (fwdHint && fwdHint.lengthSq() > 1e-8) {
      _fwd.copy(fwdHint).addScaledVector(_up, -fwdHint.dot(_up));
    } else {
      _fwd.set(1, 0, 0).applyQuaternion(boat.quaternion);
      _fwd.addScaledVector(_up, -_fwd.dot(_up));
    }
    if (_fwd.lengthSq() < 1e-8) {
      _fwd.set(1, 0, 0).addScaledVector(_up, -_up.x);
    }
    _fwd.normalize();
    _z.crossVectors(_fwd, _up).normalize();
    _basis.makeBasis(_fwd, _up, _z);
    boat.quaternion.setFromRotationMatrix(_basis);
    boat.position.copy(_up).multiplyScalar(waterRadius(pos));
  }

  function nearestCanalU(worldPos) {
    if (!canal?.curve) return 0;
    if (typeof canalBoats?.nearestU === "function") {
      return canalBoats.nearestU(worldPos);
    }
    let bestU = 0;
    let bestD = Infinity;
    const steps = 96;
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      canal.curve.getPointAt(u, _v);
      const d = _v.normalize().angleTo(_v2.copy(worldPos).normalize());
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }
    return bestU;
  }

  function canalPoint(u, out) {
    canal.curve.getPointAt(((u % 1) + 1) % 1, out);
    return out.normalize().multiplyScalar(canal.waterR + DRAFT);
  }

  function moatPoint(angle, out) {
    if (!moat) return out.set(0, 0, 0);
    const spec = moat.userData?.moatSpec || {};
    const midR = spec.midRadius ?? 42;
    const waterY = (spec.waterY ?? 0.55) + 0.08;
    out.set(Math.sin(angle) * midR, waterY, Math.cos(angle) * midR);
    moat.localToWorld(out);
    // 贴到运河/球面水位
    const r = waterRadius(out);
    return out.normalize().multiplyScalar(r);
  }

  function worldToMoatAngle(worldPos) {
    if (!moat) return 0;
    _v.copy(worldPos);
    moat.worldToLocal(_v);
    return Math.atan2(_v.x, _v.z);
  }

  function shortestArc(fromA, toA) {
    let d = toA - fromA;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function buildDepartPath(boat) {
    const pts = [];
    boat.getWorldPosition(_v);
    pts.push(_v.clone());

    // 栈桥外水域（码头局部 +X）
    _v2.set(dockLocalPos.x + 8, dockLocalPos.y, dockLocalPos.z);
    harbor.localToWorld(_v2);
    _v2.normalize().multiplyScalar(waterRadius(_v2));
    pts.push(_v2.clone());

    // 更远外推，再汇入运河最近点
    _v2.set(dockLocalPos.x + 16, dockLocalPos.y, dockLocalPos.z - 2);
    harbor.localToWorld(_v2);
    _v2.normalize().multiplyScalar(waterRadius(_v2));
    pts.push(_v2.clone());

    if (canal?.curve) {
      const u = nearestCanalU(_v2);
      pts.push(canalPoint(u, new THREE.Vector3()));
      // 沿运河再驶一段，表示“进入运河”
      pts.push(canalPoint(u + 0.04, new THREE.Vector3()));
    }
    return pts;
  }

  function buildArrivePath(boat) {
    const pts = [];
    boat.getWorldPosition(_v);
    pts.push(_v.clone());

    // 运河靠近城堡护城河的位置：取 moat 上若干采样点中与运河最近的衔接
    let joinU = nearestCanalU(moat?.position || boat.position);
    if (moat && canal?.curve) {
      let best = Infinity;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        moatPoint(a, _v2);
        const u = nearestCanalU(_v2);
        canalPoint(u, _v);
        const d = _v.distanceToSquared(_v2);
        if (d < best) {
          best = d;
          joinU = u;
        }
      }
      pts.push(canalPoint(joinU, new THREE.Vector3()));
      // 护城河入口
      canalPoint(joinU, _v);
      const enterA = worldToMoatAngle(_v);
      pts.push(moatPoint(enterA, new THREE.Vector3()));

      // 沿护城河弧线驶向港口
      harbor.localToWorld(_v2.copy(dockLocalPos));
      const dockA = worldToMoatAngle(_v2);
      const arc = shortestArc(enterA, dockA);
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const a = enterA + (arc * i) / steps;
        pts.push(moatPoint(a, new THREE.Vector3()));
      }
    }

    // 最终靠泊：码头泊位世界坐标
    harbor.localToWorld(_v2.copy(dockLocalPos));
    _v2.normalize().multiplyScalar(waterRadius(_v2));
    pts.push(_v2.clone());
    return pts;
  }

  function samplePath(pts, k, outPos, outFwd) {
    if (!pts.length) {
      outPos.set(0, 1, 0);
      outFwd.set(1, 0, 0);
      return;
    }
    if (pts.length === 1) {
      outPos.copy(pts[0]);
      outFwd.set(1, 0, 0);
      return;
    }
    const n = pts.length - 1;
    const f = Math.min(1, Math.max(0, k)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    // 球面插值位置
    outPos.copy(pts[i]).lerp(pts[i + 1], t);
    // 切向
    if (t < 0.98 && i + 1 < pts.length) {
      outFwd.copy(pts[Math.min(n, i + 1)]).sub(pts[i]);
    } else if (i > 0) {
      outFwd.copy(pts[i]).sub(pts[i - 1]);
    } else {
      outFwd.copy(pts[1]).sub(pts[0]);
    }
  }

  function beginDepart() {
    if (!activeBoat || (phase !== "loading" && phase !== "readyToDepart")) return;
    // 太鼓敲击 / 潜入任务期间：战船不得驶离港口
    if (drumsHoldShips() || drumPhase !== "idle") {
      phase = "readyToDepart";
      setLoading(false);
      return;
    }
    // 巡查刚结束必须先装货，不能空船/半船就走
    if (loadAfterPatrol) {
      phase = "loading";
      setLoading(true);
      return;
    }
    // 未装满不得离港
    if (cargo < capacity) {
      phase = "loading";
      setLoading(true);
      return;
    }
    if (activeBoat.userData.piloted) {
      phase = "readyToDepart";
      setLoading(false);
      return;
    }
    // 船员仍在岸上巡查时不可离港
    if (patrolSquad.length) {
      phase = "readyToDepart";
      setLoading(false);
      return;
    }
    phase = "departing";
    setLoading(false);
    pathT = 0;
    // 解到场景根，世界坐标离港
    if (activeBoat.parent !== scene) scene.attach(activeBoat);
    activeBoat.userData.harborDocked = false;
    activeBoat.userData.harborMission = { kind: "depart" };
    pathPts = buildDepartPath(activeBoat);
    // 离港途中略缩到运河尺度
    activeBoat.scale.setScalar(DOCK_SCALE);
    setCrewVisible(activeBoat, true);
  }

  function releaseToCanal(boat) {
    if (!boat) return;
    boat.userData.harborMission = null;
    boat.userData.harborDocked = false;
    boat.userData.canalPatrol = true;
    boat.userData.piloted = false;
    boat.userData.needsSnap = true;
    boat.userData.cargoLoaded = capacity; // 满载出航
    boat.scale.setScalar(CANAL_SCALE);
    if (canal?.curve) {
      boat.userData.u = nearestCanalU(boat.position);
      boat.userData.speed = boat.userData.speed || 1 / 180;
    }
    if (canalBoats?.boats && !canalBoats.boats.includes(boat)) {
      canalBoats.boats.push(boat);
    }
    // 满载货箱保留在甲板上驶入运河
  }

  function pickArrivalBoat() {
    if (!canalBoats?.boats?.length) return null;
    // 优先：城堡/护城河附近、未驾驶、无任务的运河船
    const anchor = moat?.position || harbor.position;
    let best = null;
    let bestD = Infinity;
    for (const b of canalBoats.boats) {
      if (!b || b === activeBoat) continue;
      if (b.userData.piloted) continue;
      if (b.userData.harborMission) continue;
      if (b.userData.harborDocked) continue;
      if (!b.userData.canalPatrol && b.parent === harbor) continue;
      const d = b.position.distanceToSquared(anchor);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    // 回退：任意空闲运河船
    if (!best) {
      for (const b of canalBoats.boats) {
        if (!b || b.userData.piloted || b.userData.harborMission || b.userData.harborDocked) continue;
        best = b;
        break;
      }
    }
    return best;
  }

  function requestArrival() {
    const boat = pickArrivalBoat();
    if (!boat) {
      phase = "waiting";
      waitAcc = 0;
      return;
    }
    transitBoat = boat;
    phase = "arriving";
    pathT = 0;
    boat.userData.harborMission = { kind: "arrive" };
    boat.userData.canalPatrol = false; // 暂停巡游，由物流接管
    // 暂停大湖互联状态，避免进港途中被升船机钩子拽走
    if (boat.userData.lakeLinkState) {
      boat.userData.lakeLinkState.phase = "canal";
      boat.userData.lakeLinkState.s = 0;
    }
    // 清空旧货，进港空载
    boat.userData.cargoLoaded = 0;
    ensureDeckCargoMarkers(boat);
    updateDeckCargoMarkers(boat, 0, Math.max(1, boatCrewCount(boat)));
    if (boat.parent !== scene) scene.attach(boat);
    pathPts = buildArrivePath(boat);
    // 进港途中逐渐放大到码头尺度
    boat.scale.setScalar(CANAL_SCALE);
  }

  function finishArrival(boat) {
    if (!boat) return;
    // 挂回码头局部坐标系并钉在泊位
    harbor.attach(boat);
    boat.position.copy(dockLocalPos);
    boat.quaternion.copy(dockLocalQuat);
    boat.scale.setScalar(DOCK_SCALE);
    boat.userData.harborMission = null;
    boat.userData.harborDocked = true;
    boat.userData.canalPatrol = false;
    boat.userData.needsSnap = false;
    capacity = Math.max(1, boatCrewCount(boat));
    cargo = 0;
    boat.userData.cargoLoaded = 0;
    boat.userData.cargoCapacity = capacity;
    ensureDeckCargoMarkers(boat);
    updateDeckCargoMarkers(boat, 0, capacity);
    activeBoat = boat;
    transitBoat = null;
    phase = "loading";
    setLoading(true);
    notifyBoat();
    // 进港时若太鼓仍在敲：船员立刻下船巡查（装货等回船后再做）
    if (drumsHoldShips()) {
      spawnDisembark(boat);
    } else {
      setCrewVisible(boat, true);
      // 正常进港：立刻装货
      phase = "loading";
      setLoading(true);
    }
  }

  function bindWorld(ctx = {}) {
    if (ctx.canal) canal = ctx.canal;
    if (ctx.canalBoats) canalBoats = ctx.canalBoats;
    if (ctx.moat) moat = ctx.moat;
    if (ctx.citadel) citadel = ctx.citadel;
    if (ctx.scene) {
      // scene already held
    }
    // 绑定后重建攀登路径（运河/城堡已就绪）
    rebuildClimbPath();
  }

  function setOnBoatChange(fn) {
    onBoatChange = typeof fn === "function" ? fn : null;
  }

  function update(dt, t) {
    const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
    updateHarborCrane(crane, d);

    // 班组动画（含装货计数回调）
    for (const s of squads) s.userData.update?.(t);

    // 太鼓期间：船员下船巡查；结束后回船；期间不得离港
    updateDrumPatrol(d, t);

    if (
      phase === "readyToDepart" &&
      activeBoat &&
      !activeBoat.userData.piloted &&
      !drumsHoldShips() &&
      drumPhase === "idle" &&
      !loadAfterPatrol &&
      cargo >= capacity &&
      !patrolSquad.length
    ) {
      beginDepart();
    }

    if (phase === "departing" && activeBoat) {
      // 若离港途中潜入任务开始：拉回泊位锁船（鼓声期间不驶离）
      if (drumsHoldShips() && pathT < DEPART_SEC * 0.45) {
        harbor.attach(activeBoat);
        activeBoat.position.copy(dockLocalPos);
        activeBoat.quaternion.copy(dockLocalQuat);
        activeBoat.scale.setScalar(DOCK_SCALE);
        activeBoat.userData.harborMission = null;
        activeBoat.userData.harborDocked = true;
        activeBoat.userData.canalPatrol = false;
        phase = "readyToDepart";
        pathT = 0;
        spawnDisembark(activeBoat);
      } else {
        pathT += d;
        const k = Math.min(1, pathT / DEPART_SEC);
        samplePath(pathPts, k, _v, _v2);
        orientOnSphere(activeBoat, _v, _v2);
        // 离港中平滑缩到运河尺度
        const sc = THREE.MathUtils.lerp(DOCK_SCALE, CANAL_SCALE, Math.min(1, k * 1.2));
        activeBoat.scale.setScalar(sc);
        updateWarshipOars(activeBoat, d, 0.95);
        if (k >= 1) {
          const gone = activeBoat;
          releaseToCanal(gone);
          activeBoat = null;
          cargo = 0;
          notifyBoat();
          requestArrival();
        }
      }
    } else if (phase === "arriving" && transitBoat) {
      pathT += d;
      const k = Math.min(1, pathT / ARRIVE_SEC);
      samplePath(pathPts, k, _v, _v2);
      orientOnSphere(transitBoat, _v, _v2);
      const sc = THREE.MathUtils.lerp(CANAL_SCALE, DOCK_SCALE, Math.min(1, Math.max(0, (k - 0.55) / 0.45)));
      transitBoat.scale.setScalar(sc);
      updateWarshipOars(transitBoat, d, 0.85);
      if (k >= 1) {
        finishArrival(transitBoat);
      }
    } else if (phase === "waiting") {
      waitAcc += d;
      if (waitAcc >= 2.5) {
        waitAcc = 0;
        requestArrival();
      }
    } else if (
      (phase === "loading" || phase === "readyToDepart") &&
      activeBoat
    ) {
      // 泊位微荡 + 停桨（船员下船巡查时甲板上无人划桨）
      if (!activeBoat.userData.piloted && activeBoat.parent === harbor) {
        activeBoat.position.y = dockLocalPos.y + Math.sin(t * 1.1) * 0.02;
        updateWarshipOars(activeBoat, d, 0);
      }
    }
  }

  function getState() {
    return {
      phase,
      cargo,
      capacity,
      boat: activeBoat,
      transitBoat,
      drumPhase,
      patrolCount: patrolSquad.length,
      drumsHold: drumsHoldShips(),
      climbTotal,
      columnFrontDist,
    };
  }

  return {
    update,
    bindWorld,
    setOnBoatChange,
    getState,
    onDeliver,
    /** 测试/调试：强制当前装货数 */
    debugSetCargo(n) {
      if (!activeBoat || phase !== "loading") return;
      cargo = Math.max(0, Math.min(capacity, n | 0));
      activeBoat.userData.cargoLoaded = cargo;
      updateDeckCargoMarkers(activeBoat, cargo, capacity);
      if (cargo >= capacity) beginDepart();
    },
  };
}
