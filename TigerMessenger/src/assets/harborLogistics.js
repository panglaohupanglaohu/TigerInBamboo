// =====================================================================
//  旧港装船物流：纸士兵计数装货 → 满载离港入运河 →
//  城堡雪山附近运河船沿护城河进港继续装船
// =====================================================================
import * as THREE from "three";
import {
  boatCrewCount,
  ensureDeckCargoMarkers,
  updateDeckCargoMarkers,
  updateHarborCrane,
  updateWarshipOars,
} from "./harbor.js";

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

const DRAFT = 0.12;
const DEPART_SEC = 16;
const ARRIVE_SEC = 24;
const CANAL_SCALE = 1.84;
const DOCK_SCALE = 2;

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

  function setLoading(on) {
    for (const s of squads) s.userData.loading = !!on;
  }

  function notifyBoat() {
    onBoatChange?.(activeBoat);
  }

  function onDeliver(n) {
    if (phase !== "loading" || !activeBoat) return;
    // 驾驶中仍可装货，但满载后等下船再离港
    cargo = Math.min(capacity, cargo + Math.max(0, n | 0));
    activeBoat.userData.cargoLoaded = cargo;
    activeBoat.userData.cargoCapacity = capacity;
    updateDeckCargoMarkers(activeBoat, cargo, capacity);
    if (cargo >= capacity) {
      if (activeBoat.userData.piloted) {
        phase = "readyToDepart";
        setLoading(false);
      } else {
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
    if (activeBoat.userData.piloted) {
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
  }

  function bindWorld(ctx = {}) {
    if (ctx.canal) canal = ctx.canal;
    if (ctx.canalBoats) canalBoats = ctx.canalBoats;
    if (ctx.moat) moat = ctx.moat;
    if (ctx.scene) {
      // scene already held
    }
  }

  function setOnBoatChange(fn) {
    onBoatChange = typeof fn === "function" ? fn : null;
  }

  function update(dt, t) {
    const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
    updateHarborCrane(crane, d);

    // 班组动画（含装货计数回调）
    for (const s of squads) s.userData.update?.(t);

    if (phase === "readyToDepart" && activeBoat && !activeBoat.userData.piloted) {
      beginDepart();
    }

    if (phase === "departing" && activeBoat) {
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
    } else if (phase === "loading" && activeBoat) {
      // 泊位微荡 + 停桨
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
