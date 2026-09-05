// ============================================================================
//  苔庭之战 · 先锋重甲兵到场—作战—撤离任务状态机（Vanguard Assault）
//  Claude 2026-09-05 · 主人完整剧本（修订版）：
//
//  到场（全员**乘坐**飞行器，绝无人飞在空中）：
//    a) 3 台 GatePodCraft（莫比斯机队伴飞翼）：各索降 2 名 = 6 名，进场时
//       重甲兵就挂在泡机腹下乘机；
//    b) 3 台 gateHaulerCraft（气垫运输艇）：**贴近海面飞行**，与泡机编成战斗
//       序列同飞；到苔庭附近海面停住、**打开后舱门放出重甲兵**（不是索降）。
//  编成：总员 22 = 20 名战斗（2 组 × 10 三三制）+ 2 名看护（留守飞行器旁）。
//    索降 6 + 艇卸 16（三艇 6/6/4）。
//  作战：面对攻击目标；沉重的行走；远距离闪电炮**举枪瞄准**、充电可见、
//    放电折线弧光（2 炮毙命）；近身激光刀**挥刀劈砍**动画（1 刀毙命先破盾）。
//  撤离：三艇飞回滩头贴海放坡，重甲兵**从后舱门走回 gateHaulerCraft 腹内**（不是
//  索降攀绳——主人 2026-09-05 修订），收门贴海离场。
//
//  阶段机：idle → approach → insert → combat → withdraw → extract → done
//  落点铁律：**任何人落地都必须逐人采样苔庭地表（groundHeightAt）**，
//  并在推进期每帧重新贴地——「站在树顶」事故从机制上杜绝复发。
//
//  临时向量纪律：辅助函数用 _c*/_o*/_s*/_w*/_r* 专属组，主流程用 _a*。
// ============================================================================

import * as THREE from "three";
import {
  assignVanguardFireteams,
  updateVanguardAdvance,
  VANGUARD_FORMATION,
} from "./vanguardTrooper.js";
import {
  SOCCO,
  setSoccoRamp,
  soccoRampReady,
  soccoSeatWorldPositions,
  soccoRampFootWorld,
  updateSoccoSeaSkim,
} from "./gateHaulerCraft.js";
import { OFFICIAL_OCEAN_SEA_LEVEL } from "./waterV8/officialOcean.js";
import { setLeviathanStormBgm } from "../audio/sfx.js";

/** 任务节奏常量（全部确定性，无 Math.random）。 */
export const VANGUARD_ASSAULT = Object.freeze({
  /** 索降泡机数 × 每台人数 = 6 */
  pods: 3,
  perPod: 2,
  /** 气垫运输艇数；满载 6/艇，实载 6/6/4（总员 22 的"比 20 多 2 看护"口径） */
  haulers: 3,
  perHauler: 6,
  /** 贴海进场速度（米/秒，沿大圆） */
  approachSpeed: 12,
  /** 泡机战斗序列阵位（相对编队中心：右/上/后，米）——在气垫艇上空两翼护送 */
  podSlots: Object.freeze([
    Object.freeze({ side: -7.0, up: 4.2, back: -6.0 }),
    Object.freeze({ side: 7.0, up: 4.2, back: -6.0 }),
    Object.freeze({ side: 0.0, up: 7.0, back: -13.0 }),
  ]),
  /** 气垫艇楔形阵位（右/上/后）——贴海，"上"只是小的波浪起伏余量 */
  haulerSlots: Object.freeze([
    Object.freeze({ side: -8.0, up: 0.0, back: 0.0 }),
    Object.freeze({ side: 8.0, up: 0.0, back: 0.0 }),
    Object.freeze({ side: 0.0, up: 0.0, back: -9.0 }),
  ]),
  /** 泡机悬停高度（悬停点在苔庭地表之上） */
  podHoverHeight: 9,
  /** 进场时索降兵挂在泡机腹下的绳长 */
  hangLength: 2.4,
  /** 索降：单兵滑降用时 / 人与人错相 */
  rappelTime: 2.2,
  rappelStagger: 0.5,
  /** 尾门全开用时 */
  rampOpenTime: 1.3,
  /** 卸兵：单兵出舱（座位→跳板→岸上）用时 / 错相 */
  exitTime: 2.6,
  exitStagger: 0.45,
  /** 撤离：地面走回滩头集合点的速度（从后舱门走回腹内） */
  withdrawSpeed: 1.6,
  /** 撤离触发：锚点附近存活守军 ≤ 此数，或战斗超时，或本队折损过半 */
  withdrawDefenders: 2,
  withdrawRadius: 26,
  maxCombatTime: 90,
  /** 离场：飞出这段弧长（弧度）后任务结束（泡机归队） */
  extractArc: 0.5,
  /** 巡演循环（主人 2026-09-05）：苔庭之战结束后舰队开赴下一站（湖沼），降落 →
   *  屠杀非保护生物 → 停留 → 上艇离开 → 再赴下一站，周而复始。
   *  白名单（湖沼之虎 / 红狐）永不被选为目标。 */
  tour: Object.freeze({
    enabled: true,
    /** 巡演战场的屠杀停留时长（秒），到点全体上艇离开 */
    holdTime: 30,
  }),
});

const UP_Y = new THREE.Vector3(0, 1, 0);

// 主流程临时向量
const _a1 = new THREE.Vector3();
const _a2 = new THREE.Vector3();
const _a3 = new THREE.Vector3();
const _a4 = new THREE.Vector3();
const _a5 = new THREE.Vector3();
const _aQ = new THREE.Quaternion();
const _aQ2 = new THREE.Quaternion();
// 辅助函数专属临时向量（与主流程隔离，防互踩）
const _c1 = new THREE.Vector3();
const _o1 = new THREE.Vector3();
const _o2 = new THREE.Vector3();
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _sBasis = new THREE.Matrix4();
const _r1 = new THREE.Vector3();
const _w1 = new THREE.Vector3();
const _w2 = new THREE.Vector3();
const _w3 = new THREE.Vector3();
const _wQ = new THREE.Quaternion();
const _wQ2 = new THREE.Quaternion();

/** 确定性哈希 → [0,1)。禁止 Math.random（重放必须一致）。 */
function vaHash(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  // ⚠️ 末次位运算返回**有符号** int32：h ≥ 2^31 时结果为负 → 必须再 >>> 0 回正，
  // 否则返回负值（索引取到 undefined / 命中骰恒真）。
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** from→to 的大圆插值（单位向量 slerp）。 */
function slerpDir(from, to, k, out) {
  _aQ.setFromUnitVectors(from, to);
  _aQ2.identity().slerp(_aQ, Math.max(0, Math.min(1, k)));
  return out.copy(from).applyQuaternion(_aQ2).normalize();
}

/** 站正：局部 +Y 对齐径向 up、面朝切向 fwd。 */
function standPose(tr, up, fwd) {
  _s1.copy(fwd).addScaledVector(up, -fwd.dot(up));
  if (_s1.lengthSq() < 1e-8) _s1.set(0, 0, 1).addScaledVector(up, -up.z);
  _s1.normalize();
  _s2.crossVectors(_s1, up).normalize();
  _sBasis.makeBasis(_s2, up, _s1);
  tr.quaternion.setFromRotationMatrix(_sBasis);
}

/** 绳索：细圆柱，每帧 setRope(from,to)。 */
function makeRope() {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x26262c })
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
function setRope(mesh, from, to) {
  _r1.copy(to).sub(from);
  const len = _r1.length() || 1e-4;
  mesh.position.copy(from).addScaledVector(_r1, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP_Y, _r1.normalize());
  mesh.visible = true;
}

/**
 * 造先锋兵突击任务（3 泡机 + 3 气垫艇）。
 *
 * @param {object} deps
 * @param {THREE.Scene} scene
 * @param {THREE.Group} squad createVanguardSquad 的返回值（22 人）
 * @param {()=>THREE.Object3D[]} [getPods] 3 台伴飞泡机（gate-pod-escort 子节点）
 * @param {()=>THREE.Object3D[]} getHaulers 3 台 SOCCO 气垫运输艇（挂 scene，初始隐藏）
 * @param {()=>THREE.Object3D} [getFleet] 莫比斯 aircraft 机队（舰队模式锚定苔庭上空）
 * @param {number} R 世界半径（球心到海面基准）
 * @param {number} [seaRadius] 海面半径；缺省 R + OFFICIAL_OCEAN_SEA_LEVEL
 * @param {()=>((dir:THREE.Vector3)=>number)|null} [getGroundHeightAt] 苔庭地表采样（懒取）
 * @param {()=>THREE.Object3D[]} [getDefenders] 守军清单（撤离判定 + 推进朝向）
 * @param {()=>((pos:THREE.Vector3)=>void)|null} [getSpawnSmoke] 苔庭烟池（灰烬/麻醉雾复用）
 * @param {()=>(THREE.Vector3|null)} [getTourAnchor] 巡演下一站方向（湖沼）；null = 不巡演
 * @param {()=>THREE.Object3D[]} [getTourTargets] 巡演战场的可打生物（白名单外）
 */
export function createVanguardAssault({
  scene,
  squad,
  getPods = null,
  getHaulers = null,
  getFleet = null,
  R,
  seaRadius = null,
  getGroundHeightAt = null,
  getDefenders = null,
  getSpawnSmoke = null,
  getTourAnchor = null,
  getTourTargets = null,
} = {}) {
  const root = new THREE.Group();
  root.name = "vanguard-assault";
  scene.add(root);

  const seaR = Number.isFinite(seaRadius) ? seaRadius : R + OFFICIAL_OCEAN_SEA_LEVEL;
  const gh = (dir) => {
    const fn = typeof getGroundHeightAt === "function" ? getGroundHeightAt() : null;
    return (fn ? fn(dir) : null) ?? (R + 0.3);
  };

  const st = {
    phase: "idle",
    t: 0,
    hub: new THREE.Vector3(),
    start: new THREE.Vector3(),
    shore: new THREE.Vector3(),
    drops: [],
    beaches: [],
    hovers: [],
    extract: new THREE.Vector3(),
    anchor: new THREE.Vector3(),
    baseRadius: R,
    traveled: 0,
    totalArc: 1e-4,
    combatT: 0,
    extractArc: 0,
    retaliateCd: 0,   // 舰队受击警报节流（箭雨频发，防每帧重装填）
    homeHub: null,    // 回防点（首站中枢 = 苔庭）
    // 优先打击名单：object → 最近一次攻击机队的时间（主人 2026-09-05：
    // 重甲兵要瞄准/面对/近战那些正在打机队的攻击者——红盔弓手或湖沼生物）
    threats: new Map(),
    escortWing: null,
    pods: [],       // {pod, troopers, dropDir, state, ropes, t}
    haulers: [],    // {craft, beachDir, hoverDir, state, ramp, exits, ropes, t}
    aboardCount: 0,
    // 扫描烧灰：combat 期每 scanCd 秒一架 aircraft 光束锁定一名红盔，1.4s 烧成灰烬
    scan: { line: null, aircraft: null, target: null, t: 0, cd: 5 },
    // GatePod 麻醉炮：悬停泡机每 tranqCd 秒向最近红盔发麻醉弹，5 发瘫倒（倒地不动）
    tranq: { shots: [], cd: 2.5, pool: [] },
  };
  // 扫描光束：绿色加色光柱（机队 → 红盔），复用泡机绳索的几何方案
  {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
      new THREE.LineBasicMaterial({ color: 0x39ff9a, transparent: true, opacity: 0, depthWrite: false })
    );
    line.visible = false;
    line.frustumCulled = false;
    st.scan.line = line;
    root.add(line);
  }
  // 麻醉弹池：小蓝发光球（低频发射，8 发够用）
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    st.tranq.pool.push(m);
  }
  const troopersOf = () => squad?.userData?.troopers || [];
  const aliveTroopers = () => troopersOf().filter((tr) => tr.visible && !tr.userData.dead);
  const vanguardAlive = () => troopersOf().filter((tr) => !tr.userData.dead).length;
  const guardsOf = () => troopersOf().filter((tr) => tr.userData.vehicleGuard && !tr.userData.dead);

  /** 泡机/艇追踪目标点（指数趋近），返回是否到位。只用 _c1。 */
  function chaseObj(obj, targetPos, dt, k = 1.4, snapDist = 0.5) {
    if (_c1.copy(obj.position).distanceTo(targetPos) < snapDist) {
      obj.position.copy(targetPos);
      return true;
    }
    obj.position.lerp(targetPos, Math.min(1, dt * k));
    return false;
  }

  /** 机体朝向：局部 +Z 对齐 fwd、+Y 对齐 up。只用 _o1/_o2。 */
  function orientCraft(obj, fwd, up) {
    _o1.copy(fwd).addScaledVector(up, -fwd.dot(up));
    if (_o1.lengthSq() < 1e-8) _o1.set(0, 0, 1);
    _o1.normalize();
    _o2.crossVectors(_o1, up).normalize();
    _sBasis.makeBasis(_o2, up.clone(), _o1);
    obj.quaternion.setFromRotationMatrix(_sBasis);
  }

  /** 让一名士兵沿地表走向目标方向点（逐帧贴地）。只用 _w*。返回是否已到。 */
  function walkOnGround(tr, targetDir, speed, dt) {
    _w1.copy(tr.position).normalize();
    _w2.copy(targetDir).normalize();
    const cosA = Math.max(-1, Math.min(1, _w1.dot(_w2)));
    const remain = Math.acos(cosA);
    if (remain < 0.02) {
      tr.position.copy(_w2).multiplyScalar(gh(_w2));
      return true;
    }
    const step = Math.min(remain, (speed * dt) / Math.max(1e-3, R));
    _wQ.setFromUnitVectors(_w1, _w2);
    _wQ2.identity().slerp(_wQ, step / remain);
    _w1.applyQuaternion(_wQ2).normalize();
    tr.position.copy(_w1).multiplyScalar(gh(_w1));
    _w3.copy(targetDir).normalize();
    standPose(tr, _w1, _w3);
    // 真实人类行走：腿摆 + 手臂反相摆（左臂配右腿），重甲步频低、摆幅大
    const ph = (tr.userData.uid ?? 0) * 0.7;
    const sw = Math.sin(st.t * 2.6 + ph) * 0.32;
    const parts = tr.userData.parts || {};
    if (parts.legL) parts.legL.rotation.x = sw;
    if (parts.legR) parts.legR.rotation.x = -sw;
    if (parts.armL) parts.armL.rotation.x = -sw * 0.55;
    if (parts.armR) parts.armR.rotation.x = sw * 0.55;
    return false;
  }

  /**
   * 舰队随行（主人 2026-09-05）：机队的锁定锚每帧跟随舰队编队中心——
   * 莫比斯 aircraft 飞哪，GatePodCraft 就伴到哪，gateHaulerCraft 随泡机贴海，
   * 重甲兵在载具里跟节奏——完整的海陆空舰队配伍。
   * 只用 _o1/_o2。
   */
  function updateFleetLock(centerDir, hoverRadius) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];
    for (const m of members) {
      if (!m.userData.missionLock) {
        m.userData.missionLock = { active: true, blend: 1, az0: vaHash(m.userData.uid ?? 0, 3) * Math.PI * 2 };
      }
      const ml = m.userData.missionLock;
      ml.active = true;
      if (!(ml.hubDir instanceof THREE.Vector3)) ml.hubDir = new THREE.Vector3();
      ml.hubDir.copy(centerDir);
      ml.hoverRadius = hoverRadius;
      ml.blend = 1; // 已随队形态，不重复过渡
    }
  }

  // ---------------------------------------------------------------- begin --
  /**
   * 开局：鲸起 + 方阵成形后由 saihojiPhalanx 调用。
   * @param {THREE.Vector3} hubDir 苔庭中枢方向（单位向量）
   * @returns {boolean} 是否真的开局（幂等保护）
   */
  function begin(hubDir) {
    if (!squad || !hubDir) return false;
    if (st.phase !== "idle" && st.phase !== "done") return false;
    return setupMission(hubDir, false);
  }

  /**
   * 任务装载（苔庭之战 / 巡演站通用）：算航点、编成载具、复位兵员、锁定舰队。
   * 重入安全：先清上一轮绳索与兵员状态（**阵亡者保持阵亡，不复活**）。
   * @param {THREE.Vector3} centerDir 本站中枢方向（单位向量）
   * @param {boolean} isTour 是否巡演站（战斗目标走 getTourTargets，撤离走 holdTime）
   */
  function setupMission(centerDir, isTour = false) {
    st.isTour = isTour;
    // 清上一轮绳索（防重入累积泄漏）
    st.pods.forEach((p) => p.ropes.forEach((r) => root.remove(r)));
    st.haulers.forEach((h) => h.ropes.forEach((r) => root.remove(r)));
    st.hub.copy(centerDir).normalize();
    // 回防点：首站中枢（苔庭）。舰队在巡演/撤离任何阶段受击，都回防这里开战
    if (!st.homeHub || !isTour) st.homeHub = st.hub.clone();
    const up = st.hub.clone();
    const east = new THREE.Vector3().crossVectors(UP_Y, up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();
    const axis = new THREE.Vector3().crossVectors(UP_Y, up);
    if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
    axis.normalize();
    // 进场起点：从海上 ~49° 外贴海压过来；卸兵滩头：苔庭边缘 ~16° 处
    _aQ.setFromAxisAngle(axis, 0.85);
    st.start.copy(up).applyQuaternion(_aQ).normalize();
    _aQ.setFromAxisAngle(axis, 0.16);
    st.shore.copy(up).applyQuaternion(_aQ).normalize();
    st.totalArc = Math.acos(Math.max(-1, Math.min(1, st.start.dot(st.shore))));
    st.traveled = 0;
    _aQ.setFromAxisAngle(axis, 0.06);
    st.extract.copy(up).applyQuaternion(_aQ).normalize();
    // 球面偏移铁律：**先乘半径再切向平移，最后归一化**。单位向量直接加米数
    // 会被偏移项淹没（9*east > 1*shore），方向直接飞掉——「站树顶」的同族事故。
    // 三台泡机的索降点：苔庭里横排三处
    st.drops = [-8, 0, 8].map((dx, i) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, i === 1 ? 4 : 0).normalize());
    // 三台气垫艇的滩头：苔庭靠海一侧横排三处
    st.beaches = [-9, 0, 9].map((dx) =>
      st.shore.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, -2).normalize());
    // 撤离悬停点：苔庭中枢偏北
    st.hovers = [-6, 6, 0].map((dx) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, 6).normalize());

    // 三三制编组（uid 顺序：0..5 索降、6..21 腹内；20/21 = 看护留守）
    assignVanguardFireteams(squad);
    troopersOf().forEach((tr) => {
      tr.userData.vehicleGuard = (tr.userData.uid ?? 0) >= 20;
    });

    // 泡机编成：uid 0..5 → 3 台 × 各 2 名；脱离机队（保世界变换）
    const pods = (typeof getPods === "function" ? getPods() : []).slice(0, VANGUARD_ASSAULT.pods);
    st.escortWing = pods[0]?.parent && pods[0].parent !== scene ? pods[0].parent : null;
    st.pods = pods.map((pod, i) => {
      if (pod?.parent && pod.parent !== scene) scene.attach(pod);
      const troopers = troopersOf().slice(i * VANGUARD_ASSAULT.perPod, (i + 1) * VANGUARD_ASSAULT.perPod);
      troopers.forEach((tr) => {
        tr.userData.onGround = false;
        tr.userData.aboard = false;
        tr.userData.climbing = false;
      });
      return { pod, troopers, dropDir: st.drops[i % st.drops.length], state: "form", ropes: [makeRope(), makeRope()], t: 0 };
    });
    st.pods.forEach((p) => root.add(p.ropes[0], p.ropes[1]));

    // 气垫艇编成：uid 6..21 贪心装艇（6/6/4）；看护（uid 20/21）在末艇。
    // 泡机缺编时，没分到泡机的兵也改走艇腹（兜底，任务不卡死）
    const podAssigned = new Set();
    st.pods.forEach((p) => p.troopers.forEach((tr) => podAssigned.add(tr)));
    const haulers = (typeof getHaulers === "function" ? getHaulers() : []).slice(0, VANGUARD_ASSAULT.haulers);
    const riders = troopersOf().filter((tr) =>
      (tr.userData.uid ?? 0) >= VANGUARD_ASSAULT.pods * VANGUARD_ASSAULT.perPod || !podAssigned.has(tr));
    st.haulers = haulers.map((craft, i) => {
      if (craft?.parent && craft.parent !== scene) scene.attach(craft);
      const load = riders.slice(i * VANGUARD_ASSAULT.perHauler, (i + 1) * VANGUARD_ASSAULT.perHauler);
      const exits = load.map((tr, j) => ({
        tr, seat: j, t: -j * VANGUARD_ASSAULT.exitStagger, from: null,
        state: "seat", posted: false,
      }));
      exits.forEach((e) => {
        e.tr.userData.onGround = false;
        e.tr.userData.aboard = false;
        e.tr.userData.climbing = false;
        e.tr.visible = false; // 乘在腹内
      });
      return {
        craft, beachDir: st.beaches[i % st.beaches.length], hoverDir: st.hovers[i % st.hovers.length],
        state: "fly", ramp: 0, exits, ropes: [makeRope(), makeRope()], t: 0,
      };
    });
    st.haulers.forEach((h) => root.add(h.ropes[0], h.ropes[1]));
    // 兜底：载具装不下/泡机缺编时，没乘上载具的兵塞进末艇超员位（任务不卡死）
    {
      const loaded = new Set(podAssigned);
      st.haulers.forEach((h) => h.exits.forEach((e) => loaded.add(e.tr)));
      const overflow = troopersOf().filter((tr) => !loaded.has(tr));
      const lastH = st.haulers[st.haulers.length - 1];
      overflow.forEach((tr, j) => {
        if (!lastH) { tr.userData.onGround = true; tr.visible = true; return; }
        lastH.exits.push({ tr, seat: 40 + j, t: 0, from: null, state: "seat", posted: false });
        tr.userData.onGround = false;
        tr.userData.aboard = false;
        tr.visible = false;
      });
    }

    // 编队压到进场起点：艇贴海楔形，泡机在上空两翼
    const fwd = _a4.copy(st.shore).sub(st.start).normalize();
    st.haulers.forEach((h, i) => {
      const slot = VANGUARD_ASSAULT.haulerSlots[i % VANGUARD_ASSAULT.haulerSlots.length];
      h.craft.visible = true;
      h.craft.position.copy(st.start).multiplyScalar(seaR + SOCCO.skimHeight);
      orientCraft(h.craft, fwd, st.start);
      setSoccoRamp(h.craft, 0);
      void slot;
    });

    squad.userData.state = "assault"; // 退出旧的机腹伴飞显示（重甲兵乘艇/乘机）
    squad.visible = true;
    st.aboardCount = 0;
    st.combatT = 0;
    st.phase = "approach";

    // 舰队模式：莫比斯 aircraft 整队飞抵苔庭上空盘旋压阵（庞大舰队一起到场）。
    // 泡机本就是机队伴飞翼——它们就是索降者，不存在"再飞来一组"。
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];
    members.forEach((m, i) => {
      m.userData.missionLock = {
        active: true,
        hubDir: st.hub.clone(),
        hoverRadius: gh(st.hub) + 30,
        az0: vaHash(i * 7 + 3, 11) * Math.PI * 2, // 确定性错相（禁 Math.random）
      };
    });
    // 苔庭之战 BGM：鲸起即触发（Terminator 2 正曲，幂等保活；sfx 内部处理互斥）
    try { setLeviathanStormBgm(true); } catch { /* 音频未就绪时静默 */ }
    return true;
  }

  // ------------------------------------------------------------- approach --
  function updateApproach(dt) {
    st.traveled += (VANGUARD_ASSAULT.approachSpeed * dt) / Math.max(1e-3, R);
    const k = Math.min(1, st.traveled / Math.max(1e-4, st.totalArc));
    slerpDir(st.start, st.shore, k, _a1);                      // 编队中心径向
    slerpDir(st.start, st.shore, Math.min(1, k + 0.01), _a2);  // 前方径向
    _a3.copy(_a2).sub(_a1).normalize();                        // 航向切向
    _a4.crossVectors(_a3, _a1).normalize();                    // 右
    // 海面基准点（主人 2026-09-05：机头太贴海，整体抬 2.5——气垫裙/炮口不擦浪）
    _a5.copy(_a1).multiplyScalar(seaR + SOCCO.skimHeight + 2.5);

    // 气垫艇：贴海楔形（气帘随速度铺开）
    st.haulers.forEach((h, i) => {
      if (!h.craft?.parent) return;
      const slot = VANGUARD_ASSAULT.haulerSlots[i % VANGUARD_ASSAULT.haulerSlots.length];
      _a2.copy(_a5)
        .addScaledVector(_a4, slot.side)
        .addScaledVector(_a3, slot.back)
        .addScaledVector(_a1, SOCCO.skimHeight + Math.sin(st.t * 0.9 + i) * 0.14);
      chaseObj(h.craft, _a2, dt, 1.2, 0.4);
      orientCraft(h.craft, _a3, _a1);
      updateSoccoSeaSkim(h.craft, { t: st.t, speed: 1 });
    });
    // 泡机：上空两翼护送（战斗序列）
    st.pods.forEach((p, i) => {
      if (!p.pod?.parent) return;
      const slot = VANGUARD_ASSAULT.podSlots[i % VANGUARD_ASSAULT.podSlots.length];
      _a2.copy(_a5)
        .addScaledVector(_a4, slot.side)
        .addScaledVector(_a3, slot.back)
        .addScaledVector(_a1, SOCCO.skimHeight + slot.up);
      chaseObj(p.pod, _a2, dt, 1.1, 0.4);
      orientCraft(p.pod, _a3, _a1);
      // 索降兵挂在泡机腹下乘机（轻摆）
      p.troopers.forEach((tr, j) => {
        if (!tr || tr.userData.dead) return;
        _a2.copy(p.pod.position)
          .addScaledVector(_o2.set(0, 1, 0).applyQuaternion(p.pod.quaternion).normalize(),
            -VANGUARD_ASSAULT.hangLength * (0.8 + 0.2 * j));
        _a2.x += Math.sin(st.t * 0.9 + i * 2 + j) * 0.12;
        tr.position.copy(_a2);
        tr.visible = true;
        standPose(tr, _a2.clone().normalize(), _a3);
        setRope(p.ropes[j], p.pod.position, tr.position);
      });
    });

    // 舰队随行：机队锁定在编队正上方，与泡机/气垫艇同步开赴战场
    updateFleetLock(_a1, seaR + SOCCO.skimHeight + 2.5 + 16);
    if (k >= 1) st.phase = "insert";
  }

  // --------------------------------------------------------------- insert --
  function updateInsert(dt) {
    let battleReady = true;

    // ---- 泡机：飞到索降点悬停 → 放绳 → 依次滑降（6 名）
    for (const p of st.pods) {
      if (p.state === "form" || p.state === "move") {
        _a1.copy(p.dropDir);
        const gr = gh(_a1);
        _a2.copy(_a1).multiplyScalar(gr + VANGUARD_ASSAULT.podHoverHeight + Math.sin(st.t * 0.8) * 0.2);
        p.state = "move";
        if (chaseObj(p.pod, _a2, dt, 1.2, 0.5)) {
          p.state = "hover";
          p.t = 0;
        }
        battleReady = false;
        continue;
      }
      if (p.state === "done") continue;
      _a1.copy(p.dropDir);
      const gr = gh(_a1);
      p.pod.position.copy(_a1).multiplyScalar(gr + VANGUARD_ASSAULT.podHoverHeight);
      if (p.state === "hover") { p.state = "rappel"; p.t = 0; }
      p.t += dt;
      let podDone = true;
      p.troopers.forEach((tr, j) => {
        if (!tr || tr.userData.dead || tr.userData.onGround) return;
        podDone = false;
        battleReady = false;
        const t0 = j * VANGUARD_ASSAULT.rappelStagger;
        const prog = Math.max(0, Math.min(1, (p.t - t0) / VANGUARD_ASSAULT.rappelTime));
        const east = _a2.crossVectors(UP_Y, p.dropDir).normalize();
        const foot = _a3.copy(p.dropDir).multiplyScalar(gr);
        const hang = _a4.copy(p.pod.position).addScaledVector(
          _a5.set(0, 1, 0).applyQuaternion(p.pod.quaternion).normalize(),
          -VANGUARD_ASSAULT.hangLength);
        if (prog <= 0) {
          tr.position.copy(hang);
          tr.visible = true;
          setRope(p.ropes[j], p.pod.position, hang);
          return;
        }
        tr.position.lerpVectors(hang, foot, prog);
        tr.position.addScaledVector(east, (j - 0.5) * 0.9);
        tr.visible = true;
        standPose(tr, tr.position.clone().normalize(), east);
        setRope(p.ropes[j], p.pod.position, tr.position);
        if (prog >= 1) {
          tr.userData.onGround = true;
          tr.position.copy(foot).addScaledVector(east, (j - 0.5) * 0.9);
        }
      });
      if (podDone) {
        p.state = "done";
        p.ropes.forEach((r) => { r.visible = false; });
      }
    }

    // ---- 气垫艇：滩头停住 → 开尾门 → 放出重甲兵（不是索降）；看护留守艇旁
    for (const h of st.haulers) {
      if (h.state === "fly") {
        _a1.copy(h.beachDir);
        // 滩头悬停：seaR+skim 时跳板末端（-2.85）会探进海里——整体再抬 2.4
        _a2.copy(_a1).multiplyScalar(seaR + SOCCO.skimHeight + 2.4 + Math.sin(st.t * 0.9) * 0.12);
        if (chaseObj(h.craft, _a2, dt, 1.2, 0.4)) h.state = "ramp";
        // ⚠️ 不传 seaRadius：seaSkim 的径向钉制会与 chaseObj 的抬高目标打架
        //（每帧拉回旧高度，永远到不了 snap 距离）。此处只做气帘脉动。
        updateSoccoSeaSkim(h.craft, { t: st.t, speed: 0.4 });
        battleReady = false;
        continue;
      }
      if (h.state === "ramp") {
        updateSoccoSeaSkim(h.craft, { t: st.t, seaRadius: seaR, speed: 0 });
        h.ramp = Math.min(1, h.ramp + dt / VANGUARD_ASSAULT.rampOpenTime);
        setSoccoRamp(h.craft, h.ramp);
        if (soccoRampReady(h.craft)) h.state = "unload";
        battleReady = false;
        continue;
      }
      if (h.state === "closed") continue;
      if (h.state === "unload") {
        updateSoccoSeaSkim(h.craft, { t: st.t, seaRadius: seaR, speed: 0 });
        const seats = soccoSeatWorldPositions(h.craft);
        const rampFoot = soccoRampFootWorld(h.craft, new THREE.Vector3());
        const up = _a1.copy(h.beachDir).normalize();
        const east = _a2.crossVectors(UP_Y, up).normalize();
        const north = _a3.crossVectors(up, east).normalize();
        h.craft.updateWorldMatrix(true, false);
        let unloadDone = true;
        for (const e of h.exits) {
          const tr = e.tr;
          if (e.state === "done" || e.state === "guard") continue; // 看护交给哨位循环
          if (tr.userData.dead) { e.state = "done"; continue; }
          unloadDone = false;
          battleReady = false;
          e.t += dt;
          if (e.t < 0) continue; // 错相（0.45s，跳板上前后脚）
          // 岸上落点：艇左右各展开，向苔庭方向推 2.2（先乘半径再偏移）
          const targetDir = _a4.copy(up).multiplyScalar(R)
            .addScaledVector(east, ((e.seat % 4) - 1.5) * 1.15)
            .addScaledVector(north, 2.2 + Math.floor(e.seat / 4) * 0.8)
            .normalize();
          const targetR = gh(targetDir);
          if (e.state === "seat") {
            e.from = seats[e.seat % seats.length].clone();
            e.state = "walk";
          }
          tr.visible = true;
          const legT = Math.min(1, e.t / VANGUARD_ASSAULT.exitTime);
          if (legT < 0.45) {
            tr.position.lerpVectors(e.from, rampFoot, legT / 0.45);
          } else {
            const kk = (legT - 0.45) / 0.55;
            tr.position.lerpVectors(rampFoot, _a5.copy(targetDir).multiplyScalar(targetR), kk);
            if (kk > 0.4) tr.position.copy(targetDir).multiplyScalar(targetR);
          }
          standPose(tr, tr.position.clone().normalize(), north);
          // 出舱行走（真实人类动作）：腿摆 + 手臂反相摆
          {
            const ph = (tr.userData.uid ?? 0) * 0.7;
            const sw = Math.sin(st.t * 5 + ph) * 0.3;
            const parts = tr.userData.parts || {};
            if (parts.legL) parts.legL.rotation.x = sw;
            if (parts.legR) parts.legR.rotation.x = -sw;
            if (parts.armL) parts.armL.rotation.x = -sw * 0.55;
            if (parts.armR) parts.armR.rotation.x = sw * 0.55;
          }
          if (legT >= 1) {
            e.state = "done";
            tr.userData.onGround = true;
            tr.position.copy(targetDir).multiplyScalar(targetR);
            e.groundDir = targetDir.clone(); // 回撤集合点（withdraw 沿地表走回这里踏跳板）
            if (tr.userData.vehicleGuard) {
              // 看护：走到自己艇旁的哨位（面向苔庭，留守看护飞行器）
              e.state = "guard";
              e.posted = false;
            }
          }
        }
        // 看护哨位：贴着自己艇的侧后方站在地表
        for (const e of h.exits) {
          if (e.state !== "guard") continue;
          const tr = e.tr;
          if (!e.posted) {
            const up = _a1.copy(h.beachDir).normalize();
            const east = _a2.crossVectors(UP_Y, up).normalize();
            const postDir = _a3.copy(up).multiplyScalar(R)
              .addScaledVector(east, (tr.userData.uid ?? 0) === 20 ? -3.2 : 3.2)
              .normalize();
            e.postDir = postDir.clone();
            e.posted = true;
          }
          const arrived = walkOnGround(tr, e.postDir, VANGUARD_ASSAULT.withdrawSpeed, dt);
          if (arrived) {
            e.state = "done";
            tr.userData.onGround = true;
            tr.position.copy(e.postDir).multiplyScalar(gh(e.postDir));
            // 站哨：面向苔庭中枢，持枪警戒（不进战斗阵型）
            standPose(tr, tr.position.clone().normalize(), st.hub);
          }
          battleReady = false;
        }
        // 舱清空 → 收尾门
        if (unloadDone && h.exits.every((e) => e.state === "done" || e.tr.userData.dead)) {
          h.state = "closed";
          setSoccoRamp(h.craft, 0);
        }
      }
    }

    // 第一名落地即 deployed：箭矢目标池立刻包含他们（空中碎箭的代差画面）
    if (squad.userData.state !== "deployed" &&
        troopersOf().some((tr) => tr.userData.onGround && !tr.userData.dead)) {
      squad.userData.state = "deployed";
    }

    if (battleReady) {
      // 全员到位 → 结阵推进（看护留守，不进阵）
      st.anchor.copy(centroidOf(aliveTroopers().filter((tr) => !tr.userData.vehicleGuard))).normalize();
      st.baseRadius = gh(st.anchor);
      st.combatT = 0;
      st.phase = "combat";
    }
  }

  // --------------------------------------------------------------- combat --
  function centroidOf(list) {
    _a5.set(0, 0, 0);
    for (const tr of list) _a5.add(tr.position);
    return _a5.multiplyScalar(1 / Math.max(1, list.length)).clone();
  }

  function defendersCentroid() {
    const ds = (typeof getDefenders === "function" ? getDefenders() : []) || [];
    const live = ds.filter((s) => s?.parent && !s.userData?.dead);
    if (!live.length) return null;
    _a4.set(0, 0, 0);
    for (const s of live) _a4.add(s.getWorldPosition(new THREE.Vector3()));
    return _a4.multiplyScalar(1 / live.length).clone();
  }

  /** 看护哨兵：面向苔庭持枪警戒 + 呼吸微摆（每帧） */
  function updateGuards() {
    for (const tr of guardsOf()) {
      if (!tr.userData.onGround) continue;
      standPose(tr, tr.position.clone().normalize(), st.hub);
      const armL = tr.userData.parts?.armL;
      if (armL) armL.rotation.x = -0.9; // 持枪在身前
    }
  }

  /** 当前战斗目标（苔庭 = 红盔守军；巡演站 = 白名单外生物，湖沼之虎/红狐受保护） */
  function liveTargets() {
    if (st.isTour) {
      const list = (typeof getTourTargets === "function" ? getTourTargets() : []) || [];
      return list.filter((s) => s?.parent && !s.userData?.dead && !s.userData?.downed);
    }
    return liveDefenders();
  }

  /**
   * 优先打击名单（主人 2026-09-05）：正在攻击莫比斯机队的攻击者——
   * 红盔弓手或湖沼生物。顺带清掉阵亡/消失的条目。
   */
  function liveThreats() {
    if (!st.threats.size) return [];
    const out = [];
    for (const [obj, tHit] of st.threats) {
      if (!obj?.parent || obj.userData?.dead) {
        st.threats.delete(obj);
        continue;
      }
      out.push({ obj, tHit });
    }
    out.sort((a, b) => a.tHit - b.tHit); // 最早开始攻击的先挨打
    return out.map((x) => x.obj);
  }

  function targetsCentroid(list) {
    _a5.set(0, 0, 0);
    for (const s of list) _a5.add(s.getWorldPosition(_a4.set(0, 0, 0)));
    return _a5.multiplyScalar(1 / Math.max(1, list.length)).clone();
  }

  function updateCombat(dt) {
    st.combatT += dt;
    updateGuards();
    if (!aliveTroopers().length) { st.phase = "withdraw"; return; }

    const targets = liveTargets();
    // 主人 2026-09-05：阵型**优先朝攻击机队的攻击者推进**（主动靠近近身格斗），
    // 没有威胁记录才按守军质心缓慢推进。
    const threats = st.isTour ? [] : liveThreats();
    const aim = threats.length ? threats : targets;
    const c = aim.length ? targetsCentroid(aim) : null;
    // 苔庭：无守军立即撤；巡演站：无目标也驻留（降落—警戒—到点离开，不鬼畜拔营）
    if (!c && !st.isTour) { st.phase = "withdraw"; return; }
    let near = 0;
    if (c && !st.isTour) {
      _a1.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
      const ds = (typeof getDefenders === "function" ? getDefenders() : []) || [];
      for (const s of ds) {
        if (!s?.parent || s.userData?.dead) continue;
        if (s.getWorldPosition(_a2).distanceTo(_a1) <= VANGUARD_ASSAULT.withdrawRadius) near++;
      }
    }
    const fighters = aliveTroopers().filter((tr) => !tr.userData.vehicleGuard).length;
    // 撤离判定：苔庭按守军清空/超时/折损；巡演站按停留时长（到点全体上艇去下一站）
    const timeUp = st.isTour
      ? st.combatT >= VANGUARD_ASSAULT.tour.holdTime
      : st.combatT > VANGUARD_ASSAULT.maxCombatTime;
    if ((!st.isTour && near <= VANGUARD_ASSAULT.withdrawDefenders) || timeUp ||
        fighters <= 10) {
      st.phase = "withdraw";
      return;
    }

    // 三三制：阵型中心沿地表向守军质心缓慢推进（速度 = VANGUARD_FORMATION.advanceSpeed）；
    // 巡演站暂无目标 → 阵型原地警戒（仍逐帧贴地）
    if (c) {
      _a1.copy(c);
      _a2.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
      _a3.copy(_a1).sub(_a2);
      updateVanguardAdvance(squad, dt, {
        anchorDir: st.anchor,
        groundRadius: st.baseRadius,
        headingDir: _a3,
      });
    }
    // 逐帧贴地（铁律）：advance 用统一球面半径摆阵位，这里按各自方向的真实地表落回
    for (const tr of troopersOf()) {
      if (tr.userData.dead || tr.userData.vehicleGuard) continue;
      _a1.copy(tr.position).normalize();
      tr.position.copy(_a1).multiplyScalar(gh(_a1));
    }
  }

  // ------------------------------------------------------------- withdraw --
  function updateWithdraw(dt) {
    // 回程（主人 2026-09-05 修订）：**从后舱门返回，不是索降攀绳**。
    // 三艇飞回各自滩头贴海悬停 → 开尾门放坡 → 士兵沿地表走回集合点 →
    // 踏跳板回腹入座（与卸兵互为镜像）→ 收尾门贴海离场。
    let rampsReady = true;
    for (const h of st.haulers) {
      if (h.state === "done") continue;
      if (!h.retArrived) {
        // 飞回滩头贴海悬停（同投送：抬 2.4 防跳板探水）
        _a1.copy(h.beachDir);
        _a2.copy(_a1).multiplyScalar(seaR + SOCCO.skimHeight + 2.4 + Math.sin(st.t * 0.9) * 0.12);
        h.retArrived = chaseObj(h.craft, _a2, dt, 0.9, 0.4);
        // 同 fly：seaSkim 不钉高度，避免与抬高目标打架
        updateSoccoSeaSkim(h.craft, { t: st.t, speed: 0.3 });
        if (h.retArrived) h.ramp = 0;
        _a3.copy(h.craft.position).normalize();
        orientCraft(h.craft, _a4.copy(st.hub).sub(_a3), _a3);
      } else if (h.ramp < 1) {
        // 到位后开尾门放坡
        updateSoccoSeaSkim(h.craft, { t: st.t, seaRadius: seaR, speed: 0 });
        h.ramp = Math.min(1, h.ramp + dt / VANGUARD_ASSAULT.rampOpenTime);
        setSoccoRamp(h.craft, h.ramp);
      }
      if (!h.retArrived || h.ramp < 0.9) rampsReady = false;
    }

    // 士兵回撤：滩头集合点（卸兵时的岸上落点）→ 踏跳板 → 回腹入座
    // 回**自己乘来的那艘艇**（装载是按序分段的，不能按 uid 取模分配）
    let allAboard = true;
    for (const tr of aliveTroopers()) {
      if (tr.userData.aboard) continue;
      allAboard = false;
      let h = null;
      let e = null;
      for (const hh of st.haulers) {
        const found = hh.exits.find((x) => x.tr === tr);
        if (found) { h = hh; e = found; break; }
      }
      if (!h) {
        // 索降兵（没乘艇）：就近挂到一艘艇，集合点 = 该艇滩头岸上
        h = st.haulers[(tr.userData.uid ?? 0) % Math.max(1, st.haulers.length)];
        if (!h) continue;
        const up = _a4.copy(h.beachDir).normalize();
        const north = _a5.crossVectors(up, UP_Y).normalize();
        e = {
          tr, seat: (tr.userData.uid ?? 0) % 6, t: 0, from: null,
          state: "seat", posted: false,
          groundDir: up.clone().multiplyScalar(R).addScaledVector(north, 2.2).normalize(),
        };
        h.exits.push(e);
      }
      if (!e || !h.retArrived || h.ramp < 0.9) continue; // 自己的艇还没放好坡
      if (!e.ret) {
        // 阶段一：沿地表走回滩头集合点（沉重的行走，逐帧贴地）
        const arrived = walkOnGround(tr, e.groundDir, VANGUARD_ASSAULT.withdrawSpeed, dt);
        const near = tr.position.distanceTo(_a2.copy(e.groundDir).multiplyScalar(gh(e.groundDir))) < 0.8;
        if (arrived || near) {
          e.ret = { t: 0, from: tr.position.clone() };
        }
        continue;
      }
      // 阶段二：踏跳板回腹（集合点 → 跳板末端 → 座位）
      e.ret.t += dt;
      const seats = soccoSeatWorldPositions(h.craft);
      const rampFoot = soccoRampFootWorld(h.craft, new THREE.Vector3());
      const legT = Math.min(1, e.ret.t / VANGUARD_ASSAULT.exitTime);
      if (legT < 0.45) {
        tr.position.lerpVectors(e.ret.from, rampFoot, legT / 0.45);
      } else {
        tr.position.lerpVectors(rampFoot, seats[e.seat % seats.length], (legT - 0.45) / 0.55);
      }
      standPose(tr, tr.position.clone().normalize(), _a3.copy(h.craft.position).sub(tr.position));
      if (legT >= 1) {
        tr.userData.aboard = true;
        tr.visible = false;
        const seat = seats[e.seat % seats.length];
        if (seat) tr.position.copy(seat);
        st.aboardCount++;
      }
    }

    // 泡机：收拢到编队上空
    st.pods.forEach((p, i) => {
      if (!p.pod?.parent) return;
      const hc = st.haulers[i % Math.max(1, st.haulers.length)]?.craft;
      if (!hc?.parent) return;
      const slot = VANGUARD_ASSAULT.podSlots[i % VANGUARD_ASSAULT.podSlots.length];
      const up = _a5.copy(hc.position).normalize();
      const fwd = _a4.copy(st.start).projectOnPlane(up).normalize();
      const right = _a3.crossVectors(fwd, up).normalize();
      _a2.copy(hc.position)
        .addScaledVector(right, slot.side)
        .addScaledVector(up, slot.up)
        .addScaledVector(fwd, slot.back);
      chaseObj(p.pod, _a2, dt, 1.0, 0.6);
      orientCraft(p.pod, fwd, up);
      p.ropes.forEach((r) => { r.visible = false; });
    });

    if (allAboard && rampsReady) {
      st.haulers.forEach((h) => {
        setSoccoRamp(h.craft, 0);
        h.state = "done";
      });
      st.extractArc = 0;
      st.phase = "extract";
    }
  }

  // -------------------------------------------------------------- extract --
  function updateExtract(dt) {
    // 三艇贴海楔形加速离场，泡机随队
    st.extractArc += (VANGUARD_ASSAULT.approachSpeed * 1.2 * dt) / Math.max(1e-3, R);
    const axis = new THREE.Vector3().crossVectors(st.hub, UP_Y);
    if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
    axis.normalize();
    _aQ.setFromAxisAngle(axis, -st.extractArc);
    _a1.copy(st.extract).applyQuaternion(_aQ).normalize();
    _aQ.setFromAxisAngle(axis, -st.extractArc - 0.01);
    _a2.copy(st.extract).applyQuaternion(_aQ).normalize();
    _a3.copy(_a2).sub(_a1).normalize();
    _a4.crossVectors(_a3, _a1).normalize();

    st.haulers.forEach((h, i) => {
      if (!h.craft?.parent) return;
      const slot = VANGUARD_ASSAULT.haulerSlots[i % VANGUARD_ASSAULT.haulerSlots.length];
      _a5.copy(_a1).multiplyScalar(seaR + SOCCO.skimHeight)
        .addScaledVector(_a4, slot.side)
        .addScaledVector(_a3, slot.back);
      h.craft.position.copy(_a5);
      orientCraft(h.craft, _a3, _a1);
      updateSoccoSeaSkim(h.craft, { t: st.t, speed: 1 });
    });
    st.pods.forEach((p, i) => {
      if (!p.pod?.parent) return;
      const slot = VANGUARD_ASSAULT.podSlots[i % VANGUARD_ASSAULT.podSlots.length];
      _a5.copy(_a1).multiplyScalar(seaR + SOCCO.skimHeight)
        .addScaledVector(_a4, slot.side)
        .addScaledVector(_a1, slot.up)
        .addScaledVector(_a3, slot.back);
      chaseObj(p.pod, _a5, dt, 1.2, 0.6);
      orientCraft(p.pod, _a3, _a1);
    });

    // 舰队随行：离场时机队锁定在编队正上方一起飞——aircraft 飞哪泡机伴哪
    updateFleetLock(_a1, seaR + SOCCO.skimHeight + 16);
    if (st.extractArc >= VANGUARD_ASSAULT.extractArc) {
      // 巡演循环：还有下一站（湖沼）→ 整队再装填，直接开赴下一站；否则收队
      const tourAnchor = (typeof getTourAnchor === "function" ? getTourAnchor() : null);
      if (VANGUARD_ASSAULT.tour.enabled && tourAnchor) {
        setupMission(tourAnchor, true);
        return;
      }
      // 任务结束：泡机归队（世界变换保留，escort update 下帧接管）；机队解锁回航线
      st.pods.forEach((p) => {
        if (p.pod?.parent && st.escortWing && p.pod.parent !== st.escortWing) {
          st.escortWing.attach(p.pod);
        }
      });
      const fleet = typeof getFleet === "function" ? getFleet() : null;
      (fleet?.userData?.members || []).forEach((m) => {
        if (m.userData.missionLock) m.userData.missionLock.active = false;
      });
      st.haulers.forEach((h) => { h.craft.visible = false; });
      squad.visible = false;
      st.phase = "done";
    }
  }

  // ------------------------------------------- 扫描烧灰 + GatePod 麻醉炮 --
  /** 活着且没瘫倒的红盔（扫描/麻醉不打倒地目标） */
  function liveDefenders() {
    const ds = (typeof getDefenders === "function" ? getDefenders() : []) || [];
    return ds.filter((s) => s?.parent && !s.userData?.dead && !s.userData?.downed);
  }

  /**
   * 莫比斯 aircraft 扫描光线烧灰（主人 2026-09-05）：combat 期每 6s 一架机
   * 光束锁定射程内最近红盔，1.4s 后烧成灰烬（击杀字段 + 灰烟）。
   */
  function updateScanStrike(dt) {
    const s = st.scan;
    if (s.target) {
      s.t += dt;
      if (!s.aircraft?.parent || s.target.userData.dead || !s.target.parent) {
        s.target = null; s.line.visible = false; s.cd = 4; return;
      }
      s.aircraft.getWorldPosition(_a1);
      s.target.getWorldPosition(_a2);
      const attr = s.line.geometry.getAttribute("position");
      attr.setXYZ(0, _a1.x, _a1.y, _a1.z);
      attr.setXYZ(1, _a2.x, _a2.y, _a2.z);
      attr.needsUpdate = true;
      s.line.material.opacity = 0.55 + 0.35 * Math.sin(st.t * 40);
      if (s.t >= 1.4) {
        // 烧成灰烬：照抄 phalanx 击杀字段（尸体沉地机制接管收尾）
        const u = s.target.userData;
        u.dead = true; u.downed = true; u._dieT = 3.7; u._fallT = 0; u.scanBurned = true;
        const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
        if (smoke) {
          smoke(s.target.position);
          smoke(_a2.copy(s.target.position).addScaledVector(_a3.set(0, 1, 0), 0.7));
        }
        s.target = null; s.line.visible = false; s.cd = 6;
      }
      return;
    }
    if (st.phase !== "combat") return;
    s.cd -= dt;
    if (s.cd > 0) return;
    const members = (typeof getFleet === "function" ? getFleet() : null)?.userData?.members || [];
    const ds = liveTargets();
    if (!members.length || !ds.length) { s.cd = 2; return; }
    _a1.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
    let best = null;
    let bestD = Infinity;
    for (const d of ds) {
      const dDist = d.getWorldPosition(_a2).distanceTo(_a1);
      if (dDist < 45 && dDist < bestD) { bestD = dDist; best = d; }
    }
    if (!best) { s.cd = 2; return; }
    s.aircraft = members[Math.floor(vaHash(Math.floor(st.t), 7) * members.length) % members.length];
    s.target = best;
    s.t = 0;
    s.line.visible = true;
    s.line.material.opacity = 0.7;
  }

  /**
   * GatePodCraft 麻醉炮（主人 2026-09-05）：泡机在场即周期性向最近红盔发
   * 麻醉弹（追踪微坠），命中 5 发瘫倒——**倒地不动**（downed，非致命）。
   */
  function updateTranq(dt) {
    const t = st.tranq;
    // 发射（仅 insert 悬停后 / combat；撤离停火）
    t.cd -= dt;
    if (t.cd <= 0 && (st.phase === "insert" || st.phase === "combat")) {
      const shooters = st.pods.filter((p) =>
        (p.state === "hover" || p.state === "rappel" || p.state === "done") && p.pod?.parent);
      const ds = liveTargets();
      if (shooters.length && ds.length) {
        const idx = Math.floor(vaHash(Math.floor(st.t * 3), 5) * shooters.length) % shooters.length;
        const pod = shooters[idx];
        if (!pod?.pod?.parent) {
          console.error("[tranq] bad shooter idx", idx, "len", shooters.length,
            "states", st.pods.map((p) => p.state).join(","));
          t.cd = 0.5;
          return;
        }
        pod.pod.getWorldPosition(_a1);
        let best = null;
        let bestD = Infinity;
        for (const d of ds) {
          const dDist = d.getWorldPosition(_a2).distanceTo(_a1);
          if (dDist < 40 && dDist < bestD) { bestD = dDist; best = d; }
        }
        if (best) {
          const muzzle = pod.pod.userData.tranqMuzzle;
          const from = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : _a1.clone();
          const mesh = t.pool.find((m) => !m.visible);
          if (mesh) {
            mesh.visible = true;
            mesh.position.copy(from);
            t.shots.push({ mesh, target: best, speed: 26, t: 0 });
          }
        }
        t.cd = 2.2;
      } else {
        t.cd = 1;
      }
    }
    // 弹丸推进：追踪微坠 → 命中计数
    for (let i = t.shots.length - 1; i >= 0; i--) {
      const s = t.shots[i];
      s.t += dt;
      const alive = s.target?.parent && !s.target.userData.dead;
      if (!alive) { s.mesh.visible = false; t.shots.splice(i, 1); continue; }
      s.target.getWorldPosition(_a1);
      _a1.y += 0.7; // 瞄胸口
      _a2.copy(_a1).sub(s.mesh.position);
      const dist = _a2.length();
      if (dist < 1.25) {
        const u = s.target.userData;
        u.tranqHits = (u.tranqHits || 0) + 1;
        const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
        if (smoke) smoke(s.mesh.position); // 麻醉雾
        if (u.tranqHits >= 5 && !u.downed) {
          u.downed = true; u._fallT = 0; u.paralyzed = true; // 倒地不动（非致命）
        }
        s.mesh.visible = false;
        t.shots.splice(i, 1);
        continue;
      }
      _a2.normalize();
      s.mesh.position.addScaledVector(_a2, s.speed * dt);
      if (s.t > 3.5) { s.mesh.visible = false; t.shots.splice(i, 1); }
    }
  }

  // ------------------------------------------------- 舰队受击警报（触发核心） --
  /**
   * 苔庭之战触发核心（主人 2026-09-05）：**只要红盔攻击莫比斯 aircraft**（箭/标枪
   * 命中机队），舰队必须立即参战——攻击那些打击机队的士兵。
   *  - idle/done：整队开赴苔庭（首战或再战）；
   *  - 巡演/撤离/推进中：**中断当前动作，回防苔庭开战**；
   *  - combat 中：已在打，不重复装填。
   * phalanx 在箭/标枪命中机队时调用（带 3s 节流防箭雨重入）。
   * @param {THREE.Object3D} [attacker] 开火的士兵（可空；打击目标池本就是红盔全体）
   */
  function onFleetUnderAttack(attacker = null, hubDir = null) {
    // 威胁登记**不受节流限制**：每一发命中都把攻击者记进优先打击名单，
    // 否则 3s 窗口内其他弓手/生物的攻击会被吞掉，重甲兵报复不全。
    if (attacker?.parent && !attacker.userData?.dead) st.threats.set(attacker, st.t);
    if (st.retaliateCd > 0) return;
    st.retaliateCd = 3;
    const home = hubDir || st.homeHub;
    // ⚠️ home 必须是有效单位向量：st.hub 未初始化时是 (0,0,0)，用它装填会让整个
    // 任务坐标系退化到原点（艇飞进球心、east/north 全零）——2026-09-05 探针实锤。
    if (!home || home.lengthSq() < 1e-8) {
      console.warn("[assault] 受击警报缺苔庭方向，忽略本次触发");
      return;
    }
    if (st.phase === "idle" || st.phase === "done") {
      begin(home);
      return;
    }
    // ⚠️ 苔庭任务进行中（approach/insert/combat，非巡演）：**已经在开战**，
    // 绝不重置——否则进场上空的箭会每 3 秒打断一次装填，任务永远进不了 combat。
    if (st.isTour || st.phase === "withdraw" || st.phase === "extract") {
      // 巡演站/撤离途中受击：中断当前动作，全军回防苔庭
      setupMission(home, false);
    }
  }

  // ---------------------------------------------------------------- update --
  function update(dt, t = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.t = t;
    switch (st.phase) {
      case "approach": updateApproach(dt); break;
      case "insert": updateInsert(dt); break;
      case "combat": updateCombat(dt); break;
      case "withdraw": updateWithdraw(dt); break;
      case "extract": updateExtract(dt); break;
      default: break;
    }
    // 机队武器（苔庭之战全程）：扫描烧灰 + GatePod 麻醉炮
    updateScanStrike(dt);
    updateTranq(dt);
    if (st.retaliateCd > 0) st.retaliateCd -= dt;
  }

  /** 泡机是否由任务接管（updateIsland 据此跳过 updateGatePodEscort）。 */
  function controlsPods() {
    return st.phase !== "idle" && st.phase !== "done";
  }

  function triggerWithdraw() {
    if (st.phase === "combat") st.phase = "withdraw";
  }

  function phase() { return st.phase; }

  /** 调试/验收快照。 */
  function stats() {
    return {
      phase: st.phase,
      onGround: troopersOf().filter((tr) => tr.userData.onGround && !tr.userData.dead).length,
      aboard: st.aboardCount,
      alive: vanguardAlive(),
      guards: guardsOf().length,
      haulerStates: st.haulers.map((h) => `${h.state}@${h.craft.position.length().toFixed(0)}`).join(","),
    };
  }

  /**
   * 巡演站的当前可打生物（先锋兵近战/闪电炮的额外目标源）。
   * 非巡演态返回空——苔庭目标由 getDefenders（红盔）提供。
   * 白名单（湖沼之虎/红狐）已在 getTourTargets 侧过滤。
   */
  function tourTargets() {
    return st.isTour ? liveTargets() : [];
  }

  return { root, begin, update, phase, controlsPods, triggerWithdraw, stats, tourTargets, onFleetUnderAttack, threatTargets: liveThreats };
}
