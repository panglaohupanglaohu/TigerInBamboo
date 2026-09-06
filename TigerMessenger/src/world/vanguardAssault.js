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
  fireflyTexture,
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
import { setFleetAssaultBgm } from "../audio/sfx.js";

/** 任务节奏常量（全部确定性，无 Math.random）。 */
export const VANGUARD_ASSAULT = Object.freeze({
  /** 索降泡机数 × 每台人数 = 6 */
  pods: 3,
  perPod: 2,
  /** 气垫运输艇数；每艇 7 名（6 参战 + 1 留守看护），3 艇满载 21 名 */
  haulers: 3,
  perHauler: 7,
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
  /** 绳索回收：单兵攀升用时（比滑降慢一点——重甲往上走费劲） */
  recoverTime: 2.6,
  recoverStagger: 0.45,
  /** 尾门全开用时 */
  rampOpenTime: 1.3,
  /** 卸兵：单兵出舱（座位→跳板→岸上）用时 / 错相 */
  exitTime: 2.6,
  exitStagger: 0.45,
  /** 撤离：地面走回滩头集合点的速度（从后舱门走回腹内） */
  withdrawSpeed: 1.6,
  /** 撤离触发：锚点附近存活目标 ≤ 此数，或战斗超时，或本队折损过半 */
  withdrawDefenders: 2,
  /** 折损撤离线：参战兵（24 名）掉到这个数以下就收队 */
  withdrawFighters: 12,
  /** 登陆艇撞击（主人 2026-09-06「用体重撞飞攻击者」）：艇体外缘判定半径（米） */
  ramRadius: 3.4,
  /** 撞飞初速（米/秒）与滞空（秒）——重艇撞轻兵，飞得远、落得沉 */
  ramLaunch: 15,
  ramAirTime: 0.95,
  /** 同一个目标的撞击冷却（秒）：防止贴着艇边被反复弹起，读起来像抽搐 */
  ramCooldown: 3.0,
  /** 一次撞击记几点近战伤害。saihojiPhalanx 的 KILL_MELEE = 2 → 一撞即毙。
   *  艇是靠体重撞的，不是刀砍，给满 */
  ramMelee: 2,
  /** 艇体撞击姿态的持续时间（秒）：侧倾 + 俯冲，然后改平 */
  ramPoseTime: 0.7,
  /** 撞点冲击波环的存活时间（秒） */
  ramRingTime: 0.55,
  withdrawRadius: 26,
  maxCombatTime: 90,
  /** 撤离兜底超时（秒）：超时强制收队，防一个人卡住钉死整支队 */
  withdrawTimeout: 45,
  // 机队已经走了却还在撤离 → 用更短的截止。主人 2026-09-05 的
  // `__tm.fleet()` 抓到 phase 一直是 'withdraw'、troopers 还 deployed：
  // 舰队早飞到湖沼，登陆队还在苔庭滩头慢慢走回艇上。
  withdrawChaseTimeout: 12,
  /** 离场：飞出这段弧长（弧度）后任务结束（泡机归队） */
  extractArc: 0.5,
  /** 作战期机队悬停在地面编队之上的高度（米）。approach/extract 段另有贴海口径 */
  combatHoverUp: 34,
  // 「巡演」这个配置块 2026-09-06 整个拆掉了。
  //
  // 它原本让登陆队自己排班：打完一站 → 挑下一站 → 把主舰一起拽过去。
  // 主人定的是反过来的：舰队围绕主舰。现在扫荡由主舰自己的航线完成——
  // 主舰飞到哪、在哪驻留，登陆队就在哪开局（见 requestStation 的三道闸）。
  // 白名单（湖沼之虎 / 红狐）仍然生效，由 getTourTargets 在场景侧过滤。
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
const _o3 = new THREE.Vector3(); // 主舰驻留跟踪专用（禁止与 _o1/_o2 复用）
const _o4 = new THREE.Vector3(); // fleetGroundDir 内部取世界坐标用
const _fleetDir = new THREE.Vector3(); // 全程锁机队用，禁止与 _a*/_o* 复用
const FLEET_COMBAT_UP = 34; // = VANGUARD_ASSAULT.combatHoverUp（模块级常量，热路径不查表）
/** 机队中心离作战锚点超过这个距离（米）就判定为「已飞离本站」，地面部队跟着撤 */
const FLEET_ABANDON_DIST = 220;
/** 主舰「停稳」判据：地面投影在这个半径内待满 STATION_SETTLE_TIME 秒 */
const STATION_SETTLE_RADIUS = 26;
const STATION_SETTLE_TIME = 3.0;
/** 同一个地方打完之后的冷却（秒）：期内不再开局，根治反复空降 */
const STATION_COOLDOWN = 150;
/** 「同一个地方」的判据：地面投影方向点积 */
const SAME_SPOT_DOT = 0.985;
/** 士兵在地面时最多能请求主舰延长驻留多久（秒） */
const HOLD_EXTEND_MAX = 120;
/** 气垫艇跟位的低通时间常数（秒）。主人 2026-09-06：「稳重如山」 */
const CRUISE_SMOOTH_TAU = 2.6;
/** 气垫艇跟位增益（1/s）。1.1 → 0.55：几十吨的东西不会说停就停 */
const CRUISE_FOLLOW_K = 0.55;
/** 单个阶段最长滞留（秒）。超了就强制收队——舰队散在原地比动画不完整难看得多。 */
const MISSION_STALL_LIMIT = 120;
/** 巡航时运输艇整体落在机队地面投影之后这么远（米）——是舰队不是并排飞行表演 */
const CRUISE_TRAIL = 26;
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();
const _c5 = new THREE.Vector3();
const _cQ = new THREE.Quaternion();
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
  // 命名不是装饰：测试要靠它判断「人是不是还挂在绳子上」，
  // 调试时也要能一眼在场景树里认出这几根绳（主人 2026-09-06 的硬要求：
  // 任何一帧都不许有人离地却没有绳子连着）。
  mesh.name = "vanguard-rope";
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
 * （getTourAnchor 于 2026-09-06 下线：下一站由主舰的航线决定，不再由登陆队排班）
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
    withdrawT: 0,  // 撤离兜底计时：有人卡住也不许把整支队困死在滩头
    extractArc: 0,
    retaliateCd: 0,   // 舰队受击警报节流（箭雨频发，防每帧重装填）
    homeHub: null,    // 回防点（首站中枢 = 苔庭）
    sweptHome: false, // 首站是否已经打完一轮（打完就别再原地空投第二批）
    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）
    lastPhase: "idle", // 看门狗：上一帧的阶段
    phaseT: 0,         // 看门狗：当前阶段已停留多久（秒）
    // 主舰驻留跟踪（主人 2026-09-06「主舰主导」）：只有主舰在一个地方停稳了，
    // 才允许开局——否则就是往空气里空投，也就是反复空降的来源。
    settleDir: null,   // 主舰地面投影的驻留中心
    settleT: 0,        // 已经在这个中心附近待了多久
    // 自己的单调时钟。冷却与驻留判定**不能**用外部传进来的 time：
    // 场景切换、存档重载、测试里分段喂帧，那个数都可能倒退，
    // 一倒退「最近打过」就失效，冷却形同虚设。
    clock: 0,
    sweptSpots: [],    // [{dir, t}] 最近打过的地方，冷却期内不再开局
    cruiseDir: null,  // 巡航期机队中心的上一帧方向，用来求航向切向
    cruiseFwd: null,
    cruiseSmooth: null,  // 巡航期航向（切向单位向量），机队几乎静止时沿用上一帧
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
    /** 被麻醉打下来、正在坠落的飞行生物（落地后交给重甲兵解决） */
    tranqFall: [],
    /** 被登陆艇撞飞、正在空中划弧的攻击者（落地即击倒，同样交给重甲兵） */
    rammed: [],
    ramRings: [],
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
  // 麻醉弹池：弹芯 + 萤火光晕（主人 2026-09-06：「麻醉弹添加萤火光芒」）。
  //
  // 光晕用的是重甲兵闪电枪那套萤火贴图（vanguardTrooper.fireflyTexture），
  // 加色混合、不写深度——两处共用同一个视觉语汇，各画各的迟早漂成两种萤火。
  // Sprite 永远面向镜头，弹丸怎么翻滚光晕都是圆的。
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    m.name = `tranq-dart-${i}`; // 命名不是装饰：测试与调试要认得出在飞的弹丸
    m.visible = false;
    m.frustumCulled = false;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fireflyTexture(),
      color: 0x9fe9ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.name = `tranq-dart-glow-${i}`;
    halo.scale.setScalar(1.15);
    halo.userData.transientFx = true; // 不进静态合并块
    m.add(halo);
    m.userData.halo = halo;
    root.add(m);
    st.tranq.pool.push(m);
  }
  const troopersOf = () => squad?.userData?.troopers || [];
  // ⚠️ `swallowed` 也要滤掉（主人 2026-09-06：鲸会把重甲兵吸进肚子里）。
  // 光靠 `visible` 不够：被吸进去的那两三秒人还在画面上挣扎，
  // 这边的推进逻辑一边把他往敌人那儿挪、鲸那边一边把他往嘴里拽，
  // 两个作者抢同一个 position，人就会在半空抽搐着原地不动。
  const aliveTroopers = () =>
    troopersOf().filter((tr) => tr.visible && !tr.userData.dead && !tr.userData.swallowed);
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
  /**
   * 主舰地面投影（编队中心 → 球面方向）。「战场在哪」的唯一依据。
   * @returns {THREE.Vector3|null} 单位向量；没有机队时 null
   */
  function fleetGroundDir(out = new THREE.Vector3()) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) return null;
    out.set(0, 0, 0);
    for (const m of members) out.add(m.getWorldPosition(_o4));
    out.multiplyScalar(1 / members.length);
    if (out.lengthSq() < 1e-8) return null;
    return out.normalize();
  }

  // ⚠️ 这里曾经有 holdFleetOnStation / releaseFleetHold：登陆队往主舰身上写
  //    missionLock.hold，请它「把这次驻留再延长一会儿」。
  //
  //    主人 2026-09-06 明确否掉：「不要 missionlock」。哪怕只是「请求驻留」，
  //    也仍然是地面部队伸手去动主舰的状态——主舰身上同时还有 whaleLock 和
  //    patrol，多一个写者就多一次「下一帧它到底听谁的」。主人反复看到的
  //    「主舰飞走了别人不跟」，根子就在这种多头写。
  //
  //    现在的关系干净了，一句话：**主舰只按自己的航线飞**。
  //      · 它在哪 → 战场就在哪（requestStation 取它的地面投影）；
  //      · 它走了 → fleetLeftStation 立刻把地面部队转入 withdraw 跟着撤。
  //    地面部队对主舰**只读不写**。
  //
  //    代价是一场作战的时长被主舰的驻留时长框住（P.aircraftHoldSec，默认 36s）。
  //    要打得更从容就调那个参数——那是主舰自己的参数，不是一把锁。

  /**
   * 泡机的索降点：**落到攻击者附近**（主人 2026-09-06：
   * 「泡机下来的重甲兵，是 2 制，前后型，突击作战，空降到攻击者附近，
   *   多以格斗解决对手」）。
   *
   * 旧做法是绕中枢横排三个固定点（±8 米），跟敌人在哪毫无关系——
   * 6 名突击兵落地之后还要自己走过去，「突击」两个字就没了。
   * 现在三台泡机围着威胁质心放：左 6 / 正前 / 右 6，正面那台再压近 5 米，
   * 落地就在刀口上，格斗距离（bladeRange=3）一步就到。
   *
   * 没有威胁记录（还没人开火）才退回中枢横排——那是兜底，不是常态。
   */
  function podDropDirs(east, north) {
    const list = liveThreats();
    const aim = list.length ? list : liveTargets();
    if (aim.length) {
      const c = targetsCentroid(aim);
      if (c.lengthSq() > 1e-8) {
        const cd = c.clone().normalize();
        const e = new THREE.Vector3().crossVectors(UP_Y, cd);
        if (e.lengthSq() < 1e-8) e.copy(east); else e.normalize();
        const nn = new THREE.Vector3().crossVectors(cd, e).normalize();
        // 球面偏移铁律：先乘半径再切向平移，最后归一化
        return [-6, 0, 6].map((dx, i) =>
          cd.clone().multiplyScalar(R)
            .addScaledVector(e, dx)
            .addScaledVector(nn, i === 1 ? -5 : 0)
            .normalize());
      }
    }
    return [-8, 0, 8].map((dx, i) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, i === 1 ? 4 : 0).normalize());
  }

  /**
   * 进场途中敌人会动。索降前重算一次落点，让「落到攻击者附近」在**落的那一刻**
   * 成立，而不是装填那一刻——装填到索降之间隔着整段 approach。
   */
  function refreshPodDrops() {
    if (st.hub.lengthSq() < 1e-8) return;
    const up = st.hub.clone();
    const east = new THREE.Vector3().crossVectors(UP_Y, up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();
    st.drops = podDropDirs(east, north);
    st.pods.forEach((p, i) => { p.dropDir = st.drops[i % st.drops.length]; });
  }

  /** 这个地方最近打过吗（冷却期内不再开局） */
  function recentlySwept(dir) {
    for (const s of st.sweptSpots) {
      if (st.clock - s.t < STATION_COOLDOWN && s.dir.dot(dir) > SAME_SPOT_DOT) return true;
    }
    return false;
  }

  /** 记一笔「这里打过了」，并淘汰过期条目 */
  function markSwept(dir) {
    st.sweptSpots = st.sweptSpots.filter((s) => st.clock - s.t < STATION_COOLDOWN * 2);
    st.sweptSpots.push({ dir: dir.clone(), t: st.clock });
  }

  /**
   * 每帧跟踪主舰是否「停稳」。停稳 = 地面投影在 STATION_SETTLE_RADIUS 米内
   * 连续待满 STATION_SETTLE_TIME 秒。主舰的 patrol 在两端各驻留
   * aircraftHoldSec（默认 36s），那就是它自己挑好的战场。
   */
  function trackSettle(dt) {
    const dir = fleetGroundDir(_o3);
    if (!dir) { st.settleDir = null; st.settleT = 0; return; }
    if (!st.settleDir) { st.settleDir = dir.clone(); st.settleT = 0; return; }
    const drift = st.settleDir.distanceTo(dir) * R;
    if (drift > STATION_SETTLE_RADIUS) {
      st.settleDir.copy(dir);
      st.settleT = 0;
    } else {
      st.settleT += dt;
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
   */
  function setupMission(centerDir) {
    st.sawFleet = false;
    st.withdrawT = 0;
    // 清上一轮绳索（防重入累积泄漏）
    st.pods.forEach((p) => p.ropes.forEach((r) => root.remove(r)));
    st.haulers.forEach((h) => h.ropes.forEach((r) => root.remove(r)));
    st.hub.copy(centerDir).normalize();
    // 回防点：首站中枢（苔庭）。舰队在巡演/撤离任何阶段受击，都回防这里开战
    if (!st.homeHub) st.homeHub = st.hub.clone();
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
    // 三台泡机的索降点：**攻击者附近**（主人 2026-09-06）
    st.drops = podDropDirs(east, north);
    // 三台气垫艇的滩头：苔庭靠海一侧横排三处
    st.beaches = [-9, 0, 9].map((dx) =>
      st.shore.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, -2).normalize());
    // 撤离悬停点：苔庭中枢偏北
    st.hovers = [-6, 6, 0].map((dx) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, 6).normalize());

    // 编组（主人 2026-09-06 的舰队编成）：uid 0..5 泡机突击对、6..26 三艇各 7 名。
    // 看护身份由 assignVanguardFireteams 按「每艇最后一个座位」定死，
    // 这里不再另写一条 uid 阈值——两处各定一次，迟早对不上。
    assignVanguardFireteams(squad);

    // 泡机编成：uid 0..5 → 3 台 × 各 2 名；脱离机队（保世界变换）
    const pods = (typeof getPods === "function" ? getPods() : []).slice(0, VANGUARD_ASSAULT.pods);
    // 僚机翼引用必须**稳**：优先直接问机队要，其次看泡机现在挂在谁下面，
    // 最后沿用上一轮记下的。原来只有第二种——上一轮任务没走完、泡机还留在
    // scene 下时，这一轮就会记成 null，从此再也还不回去，三台泡机永久失联。
    const fleetWing = (typeof getFleet === "function" ? getFleet() : null)
      ?.userData?.gatePodEscort || null;
    st.escortWing = fleetWing
      || (pods[0]?.parent && pods[0].parent !== scene ? pods[0].parent : null)
      || st.escortWing;
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
    // ⚠️ 这里原来还会给每架机写一份
    //    missionLock = { active: true, hubDir: st.hub, hoverRadius: … }，
    // 也就是任务一装填就把主舰拽到登陆队挑的站点上空。2026-09-06「主舰主导」
    // 之后这行是自相矛盾的残留：holdFleetOnStation 下一帧就会把它清掉，
    // 但中间那一帧主舰确实被抢了方向盘。整段删掉，站点只由主舰自己决定。
    //
    // BGM 也一起纠正：原来这里调 setLeviathanStormBgm(true)，等于**每一场
    // 舰队作战都放苔庭鲸那首 Terminator 2**。那首是鲸的故事线专属，
    // 由 saihojiGarden 按鲸起/落/终扫开关；登陆队在旁边又开一遍，
    // 把专属曲当成了通用战斗曲。现在整体舰队作战放《徐嘉良-战（大提琴版）》，
    // 由 update() 按「是否在任务中」逐帧维持，苔庭那首在响时自动让路。
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

    if (k >= 1) {
      // 索降前最后一次对表：敌人在 approach 这一路上是会动的
      refreshPodDrops();
      st.phase = "insert";
    }
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
    // 目标池合一（主人 2026-09-06：「一次打击，解决地面所有问题」）：
    // 守军（红盔）∪ 战场生物。旧代码按 st.isTour 二选一，那个开关取决于
    // 「谁把这次任务开起来的」，而不是「地上到底有什么」——同一片地上
    // 既有红盔又有野兽时，总有一半打不着。
    const out = [];
    const seen = new Set();
    const push = (list) => {
      for (const s of list || []) {
        if (!s?.parent || s.userData?.dead || s.userData?.downed) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
      }
    };
    push(liveDefenders());
    push(typeof getTourTargets === "function" ? getTourTargets() : []);
    return out;
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
    const threats = liveThreats();
    const aim = threats.length ? threats : targets;
    const c = aim.length ? targetsCentroid(aim) : null;
    // 地上清空了就撤——这是「一次打击解决所有问题」的收尾条件。
    if (!c) { st.phase = "withdraw"; return; }
    // 阵型附近还剩几个目标（守军 + 生物一起数，口径与目标池一致）
    let near = 0;
    {
      _a1.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
      for (const s of targets) {
        if (s.getWorldPosition(_a2).distanceTo(_a1) <= VANGUARD_ASSAULT.withdrawRadius) near++;
      }
    }
    const fighters = aliveTroopers().filter((tr) => !tr.userData.vehicleGuard).length;
    const timeUp = st.combatT > VANGUARD_ASSAULT.maxCombatTime;
    // 折损阈值随编成走：参战 24 人，打剩不到一半就收队
    if (near <= VANGUARD_ASSAULT.withdrawDefenders || timeUp ||
        fighters <= VANGUARD_ASSAULT.withdrawFighters) {
      st.phase = "withdraw";
      return;
    }

    // 三三制：阵型中心沿地表向目标质心缓慢推进（速度 = VANGUARD_FORMATION.advanceSpeed）
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
    st.withdrawT += dt;
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
        // 索降兵由**本泡机的绳索**收回（上面那段），不走登陆艇的后舱门。
        // 主人 2026-09-06 的设定里泡机就配着绳索，让他们徒步跑去登陆艇
        // 既不合设定，也正是「半空索降被丢下」那条故障的下游表现。
        if (tr.userData.vehicleSlot?.kind === "pod") continue;
        // 真正没有归属的（泡机缺编等兜底情形）才就近挂到一艘艇
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

    // ---- 泡机：绳索回收自己那 2 名索降兵（主人 2026-09-06 的硬要求）
    //
    // 这是索降的镜像动作：飞回自己那批人正上方 → 放绳 → 逐个绞上来。
    // 「自己那批人」不是就近取——花名册（vanguardRosterSlot）里 uid 段直接
    // 决定他上的是哪台泡机，所以谁的人由谁收，永远对得上号。
    //
    // 旧代码在这里只是把泡机往编队上空收拢，索降兵则被丢进下面那个
    // 「就近挂到一艘艇」的分支，走去登陆艇的后舱门——泡机明明有绳索。
    let podsRecovered = true;
    for (const p of st.pods) {
      if (p.state === "recovered") continue;
      if (!p.pod?.parent) { p.state = "recovered"; continue; }
      const mine = p.troopers.filter((tr) => tr && !tr.userData.dead && !tr.userData.aboard);
      if (!mine.length) {
        p.state = "recovered";
        p.ropes.forEach((r) => { r.visible = false; });
        continue;
      }
      podsRecovered = false;

      // 悬停点：自己那批人的质心正上方
      _a1.set(0, 0, 0);
      for (const tr of mine) _a1.add(tr.position);
      _a1.multiplyScalar(1 / mine.length).normalize();
      const gr = gh(_a1);
      _a2.copy(_a1).multiplyScalar(gr + VANGUARD_ASSAULT.podHoverHeight);
      const overhead = chaseObj(p.pod, _a2, dt, 1.2, 0.6);
      // 绳子先垂下来：人还站在地上，但已经挂上了——画面上先有连接再有攀升
      const up = _a3.set(0, 1, 0).applyQuaternion(p.pod.quaternion).normalize();
      _a4.copy(p.pod.position).addScaledVector(up, -VANGUARD_ASSAULT.hangLength);
      if (!overhead) {
        p.troopers.forEach((tr, j) => {
          if (!tr || tr.userData.dead || tr.userData.aboard) return;
          setRope(p.ropes[j], p.pod.position, tr.position);
        });
        continue;
      }
      if (p.state !== "recover") { p.state = "recover"; p.recT = 0; }
      p.recT += dt;
      p.troopers.forEach((tr, j) => {
        if (!tr || tr.userData.dead || tr.userData.aboard) return;
        // 攀绳中不出手（updateVanguardAdvance 按 onGround === false 跳过）
        if (!tr.userData._recFrom) tr.userData._recFrom = tr.position.clone();
        const t0 = j * VANGUARD_ASSAULT.recoverStagger;
        const prog = Math.max(0, Math.min(1, (p.recT - t0) / VANGUARD_ASSAULT.recoverTime));
        if (prog <= 0) { setRope(p.ropes[j], p.pod.position, tr.position); return; }
        tr.userData.onGround = false;
        tr.userData.climbing = true;
        tr.position.lerpVectors(tr.userData._recFrom, _a4, prog);
        tr.visible = true;
        setRope(p.ropes[j], p.pod.position, tr.position);
        if (prog >= 1) {
          tr.userData.aboard = true;
          tr.userData.climbing = false;
          tr.visible = false;   // 收进泡机腹内
          tr.userData._recFrom = null;
          st.aboardCount++;
        }
      });
    }

    // 兜底：撤离超时就强制收队。地面上有一个人卡住（走不到跳板/被挤在坡沿）
    // 就能把整支队钉死在滩头，而红盔的箭不会停——那正是「撤不走」的另一种形态。
    // 截止时间：机队还在头顶就按正常节奏收（45s），机队已经飞走就只给 12s
    // ——「跟着走」是主人定的第一原则，撤离动画再好看也不能让舰队散架。
    const chasing = st.sawFleet && (!fleetAlive() || fleetLeftStation());
    const limit = chasing
      ? VANGUARD_ASSAULT.withdrawChaseTimeout
      : VANGUARD_ASSAULT.withdrawTimeout;
    const overdue = st.withdrawT > limit;
    if (!allAboard && overdue) {
      for (const tr of aliveTroopers()) {
        if (tr.userData.aboard) continue;
        tr.userData.aboard = true;
        tr.visible = false;
      }
      allAboard = true;
    }
    // ⚠️ 超时也必须放行 rampsReady。旧代码只强制上人、不管坡门：
    // 只要有一艘艇飞不回滩头（retArrived 永远 false，比如滩头方向被
    // 场景切换改脏），rampsReady 就永远是 false，withdraw 这一段
    // **没有任何出口**——phase 永久停在 'withdraw'。而 onMission 为真
    // 时 update() 不调 releasePods()/enforceOffstage()，于是三台泡机
    // 挂在 scene 下不伴飞、运输艇不巡航、重甲兵留在原地。
    // 主人反复报的「泡机和登陆艇没去伴飞」「重甲兵源源不断」就是这个死角。
    if (overdue) {
      st.haulers.forEach((h) => {
        h.retArrived = true;
        h.ramp = 1;
      });
      rampsReady = true;
      // 泡机也一样：超时就直接算收完，绝不让一根没绞完的绳子把舰队钉在原地。
      // 注意仍然是「收进机腹」而不是「丢在地上」——半空遗弃在任何路径上都不许发生。
      for (const p of st.pods) {
        for (const tr of p.troopers || []) {
          if (!tr || tr.userData.dead || tr.userData.aboard) continue;
          tr.userData.aboard = true;
          tr.userData.climbing = false;
          tr.visible = false;
          tr.userData._recFrom = null;
          st.aboardCount++;
        }
        p.state = "recovered";
        p.ropes.forEach((r) => { r.visible = false; });
      }
      podsRecovered = true;
    }
    if (allAboard && rampsReady && podsRecovered) {
      st.haulers.forEach((h) => {
        setSoccoRamp(h.craft, 0);
        h.state = "done";
      });
      st.extractArc = 0;
      st.sweptHome = true; // 打过一轮了（配合 sweptSpots 的冷却）
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

    if (st.extractArc >= VANGUARD_ASSAULT.extractArc) {
      // 任务结束。
      //
      // 这里原来有一个「巡演传送口」：extract 一走完就 setupMission(下一站)，
      // 把整支登陆队连同主舰一起挪到下一个景点。那是主人 2026-09-06 明确否掉的
      // 反向指挥——而且它是「重甲兵反复空降」的主发动机：站点之间没有停顿，
      // 一站打完下一站立刻空投，多数站点又没有敌人（getTourTargets 为空），
      // 于是落地→没敌人→撤离→再落，无限循环。
      //
      // 现在扫荡由主舰自己的航线完成：主舰飞到哪、在哪驻留，登陆队就在哪开局。
      finishMission();
    }
  }

  /**
   * 收队：把舰队恢复成「跟着 aircraft 走」的常态（幂等，可以从任何阶段调）。
   *
   * 以前这段只写在 `updateExtract` 的成功出口上。任务有五个阶段、每个阶段
   * 都可能提前夭折（机队被打走、场景切换、存档重载、某艘艇飞不回来），
   * 少一条出口就会留下一支半截舰队：泡机停在半空、运输艇停在滩头、
   * 重甲兵站在原地当靶子。所以它必须是一个能被任何人调用的收尾函数。
   */
  function finishMission() {
    // 这个地方打过了：记一笔冷却，冷却期内不再开局。
    // 没有这条，主舰还停在原地时下一帧就能再空投一批——「重甲兵源源不断」。
    if (st.hub.lengthSq() > 1e-8) markSwept(st.hub);
    releasePods();
    // 收队时不需要「解锁主舰」了：从来就没锁过它（主人 2026-09-06「不要 missionlock」）
    for (const tr of aliveTroopers()) {
      tr.userData.aboard = true;
      tr.visible = false;
    }
    st.haulers.forEach((h) => { if (h.craft) h.craft.visible = false; });
    if (squad) squad.visible = false;
    st.phase = "done";
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
    t.cd -= dt;
    if (t.cd <= 0) {
      // 任务中：三台泡机对全体守军开火。
      // **不在任务中也要开火**（主人 2026-09-05 截屏：三台泡机在旁边干看着）——
      // 泡机本来就配麻醉炮，红盔在下面朝机队放箭时它们没有理由沉默。
      // 区别只在目标池：巡航期只打**正在攻击机队的人**（threats），不主动挑衅。
      const onMission = st.phase === "insert" || st.phase === "combat" ||
        st.phase === "approach" || st.phase === "withdraw";
      // 泡机只要在场就能开火——**不再要求它先飞到悬停位**。
      // 原来的 `state !== form/move` 过滤把整个 approach 段排除在外，
      // 于是「护送进场的一路上三台泡机一炮不发」，正是主人截屏里的样子。
      const shooters = onMission
        ? st.pods.filter((p) => p.pod?.parent).map((p) => p.pod)
        : ((typeof getPods === "function" ? getPods() : []) || []).filter((p) => p?.parent);
      // 射程按泡机离地远近分档：悬停/作战时贴得近，进场与巡航时高得多
      const range = (st.phase === "insert" || st.phase === "combat") ? 60 : 140;
      const ds = onMission ? liveTargets() : liveThreats();
      if (shooters.length && ds.length) {
        const idx = Math.floor(vaHash(Math.floor(st.t * 3), 5) * shooters.length) % shooters.length;
        const pod = shooters[idx] || shooters[0];
        pod.getWorldPosition(_a1);
        let best = null;
        let bestD = Infinity;
        for (const d of ds) {
          if (!d?.parent || d.userData?.dead || d.userData?.downed) continue;
          const dDist = d.getWorldPosition(_a2).distanceTo(_a1);
          if (dDist < range && dDist < bestD) { bestD = dDist; best = d; }
        }
        if (best) {
          const muzzle = pod.userData?.tranqMuzzle;
          const from = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : _a1.clone();
          const mesh = t.pool.find((m) => !m.visible);
          if (mesh) {
            mesh.visible = true;
            mesh.position.copy(from);
            t.shots.push({ mesh, target: best, speed: 26, t: 0 });
          }
        }
        t.cd = onMission ? 2.2 : 1.6;
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
          // 空中生物：麻醉满额 → **坠地**（主人 2026-09-06：「麻醉后坠地解决」）。
          // 地面红盔靠 saihojiPhalanx 的 _fallT 自己倒下去；飞行生物没有那套动画，
          // 不推它一把它会带着 downed 标志继续飞——而 downed 又把它从目标池里
          // 摘掉了，结果既不掉、也没人管，等于白麻醉。
          s.target.getWorldPosition(_a3);
          const dir = _a3.clone().normalize();
          if (_a3.length() > gh(dir) + 1.2) {
            u.tranqFalling = true;
            u.tranqFallV = 0;
            if (!st.tranqFall.includes(s.target)) st.tranqFall.push(s.target);
          } else {
            u.tranqGrounded = true; // 本来就在地上
          }
        }
        s.mesh.visible = false;
        t.shots.splice(i, 1);
        continue;
      }
      _a2.normalize();
      s.mesh.position.addScaledVector(_a2, s.speed * dt);
      // 萤火呼吸：飞行途中光晕明灭，命中前那一下最亮
      const halo = s.mesh.userData?.halo;
      if (halo) {
        const puls = 0.9 + 0.28 * Math.sin(s.t * 13.0);
        halo.scale.setScalar(1.15 * puls);
        halo.material.opacity = 0.62 + 0.3 * puls;
      }
      if (s.t > 3.5) { s.mesh.visible = false; t.shots.splice(i, 1); }
    }

    updateTranqFall(dt);
  }

  /**
   * 麻醉坠落：被打满 5 发的飞行生物沉下来，落地后标记 tranqGrounded，
   * 由重甲兵近身解决（见 tourTargets：瘫在地上的目标仍在打击池里）。
   *
   * 用「每帧往下压」而不是接管它的运动控制器：生物各自的 update 还在跑，
   * 抢控制权会打架。这里只保证**高度**单调下降，落地即停。
   */
  function updateTranqFall(dt) {
    if (!st.tranqFall.length) return;
    for (let i = st.tranqFall.length - 1; i >= 0; i--) {
      const o = st.tranqFall[i];
      const u = o?.userData;
      if (!o?.parent || !u || u.dead) { st.tranqFall.splice(i, 1); continue; }
      o.getWorldPosition(_a1);
      const dir = _a2.copy(_a1).normalize();
      const ground = gh(dir);
      u.tranqFallV = Math.min(26, (u.tranqFallV || 0) + 18 * dt); // 加速下坠，封顶
      const next = Math.max(ground + 0.1, _a1.length() - u.tranqFallV * dt);
      // 世界坐标 → 父级局部（生物可能挂在某个 group 下）
      _a3.copy(dir).multiplyScalar(next);
      if (o.parent) o.parent.worldToLocal(_a3);
      o.position.copy(_a3);
      // 翻滚：坠落的姿态不该还是平飞
      o.rotation.z += dt * 2.6;
      if (next <= ground + 0.12) {
        u.tranqFalling = false;
        u.tranqGrounded = true;
        st.tranqFall.splice(i, 1);
      }
    }
  }

  /**
   * 登陆艇撞击（主人 2026-09-06：「用体重撞飞攻击者」）。
   *
   * 判定很朴素：谁贴到艇体外缘（ramRadius）以内，就被沿「艇 → 人」的**切向**
   * 甩出去，同时给一个径向的抬升——切向决定往哪飞，径向决定飞得起来。
   * 球面世界里这两个方向必须分开算，直接拿世界向量当水平方向会把人甩进地里。
   *
   * 非致命：落地记 downed + tranqGrounded，和麻醉弹打下来的空中生物走同一条
   * 收尾路径（躺在地上，由重甲兵解决）。舰队整体是麻醉/击倒的路数，
   * 不在这儿单开一套致命判定。
   */
  function updateHaulerRam(dt) {
    // 主人 2026-09-06：「**但只是离开战场时使用**」。
    // extract 就是贴海离场那一段——艇满载着人往外开，谁挡道谁被掀翻。
    // 原来 insert/combat/withdraw 三段都在撞，那等于给登陆艇配了一门主炮，
    // 地面的仗就不用重甲兵打了，编成的意义就没了。
    const active = st.phase === "extract";
    if (active && st.haulers.length) {
      const pool = liveTargets();
      for (const h of st.haulers) {
        const craft = h.craft;
        if (!craft?.parent || !craft.visible) continue;
        craft.getWorldPosition(_a1);
        for (const s of pool) {
          const u = s.userData;
          if (!u || u.dead || u.rammedAir) continue;
          if (u.ramCd != null && st.clock < u.ramCd) continue;
          s.getWorldPosition(_a2);
          if (_a2.distanceTo(_a1) > VANGUARD_ASSAULT.ramRadius) continue;
          // 切向 = （艇→人）剥掉径向分量。球面上「水平」只能这么求。
          _a3.copy(_a2).sub(_a1);
          _a4.copy(_a2).normalize();               // 目标处的径向（天）
          _a3.addScaledVector(_a4, -_a3.dot(_a4));
          if (_a3.lengthSq() < 1e-6) _a3.copy(_a4).cross(UP_Y); // 正对着艇心：随便挑个切向
          _a3.normalize();
          u.ramCd = st.clock + VANGUARD_ASSAULT.ramCooldown;
          u.rammedAir = true;
          st.rammed.push({
            obj: s,
            dir: _a3.clone(),
            up: _a4.clone(),
            t: 0,
            r0: _a2.length(),
          });
          // ---- 伤害（主人 2026-09-06：「添加撞击损伤能力」）----
          // 口径对齐 saihojiPhalanx.applySoldierDamage：近战 ≥ KILL_MELEE(2) 即死。
          // 这里不去调那个函数（它是 phalanx 的内部实现，登陆队够不着），
          // 而是往同一批 userData 字段上记——两边读的是同一份账。
          u.meleeHits = (u.meleeHits || 0) + VANGUARD_ASSAULT.ramMelee;
          if ((u.meleeHits || 0) >= 2) {
            u.dead = true;
            u._dieT = 3.7;
          }
          u.downed = true;
          u._fallT = 0;
          // ---- 动画①：艇体撞击姿态（侧倾 + 俯冲，0.7s 内改平）----
          // 撞的那一侧压下去——「用体重撞」这四个字要在画面上看得见，
          // 光把人弹开、艇纹丝不动，读起来像是人自己蹦走的。
          h.ramPose = { t: 0, side: Math.sign(_a3.dot(_a4.clone().cross(UP_Y))) || 1 };
          const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
          if (smoke) smoke(_a2.clone()); // 撞击尘
          // ---- 动画②：撞点冲击波环 ----
          spawnRamRing(_a2, _a4);
        }
      }
    }
    // 空中划弧 → 落地击倒
    for (let i = st.rammed.length - 1; i >= 0; i--) {
      const r = st.rammed[i];
      const o = r.obj;
      const u = o?.userData;
      // ⚠️ 不许因为 `u.dead` 就把飞行中的条目摘掉。
      // 加了撞击伤害之后（主人 2026-09-06），被撞的人在起飞那一帧就已经是 dead 了——
      // 照旧筛 dead 的话，尸体会卡在艇边上不动，撞飞的动作一帧都看不到。
      // 死的照样要划完这条弧、落到地上；真正该摘的只有「已经不在场景里」。
      if (!o?.parent || !u) { st.rammed.splice(i, 1); continue; }
      r.t += dt;
      const T = VANGUARD_ASSAULT.ramAirTime;
      const k = Math.min(1, r.t / T);
      o.getWorldPosition(_a1);
      const dir = _a2.copy(_a1).normalize();
      const ground = gh(dir);
      // 抛物线：切向匀速远离，径向先上后下
      const along = VANGUARD_ASSAULT.ramLaunch * dt;
      const rise = Math.sin(k * Math.PI) * 2.6;
      _a3.copy(_a1).addScaledVector(r.dir, along);
      _a3.normalize().multiplyScalar(Math.max(ground + 0.05, ground + rise));
      if (o.parent) o.parent.worldToLocal(_a3);
      o.position.copy(_a3);
      o.rotation.x += dt * 5.2; // 翻滚
      if (k >= 1) {
        u.rammedAir = false;
        u.downed = true;
        u.paralyzed = true;
        u.tranqGrounded = true; // 躺在地上（撞死的也要有尸体停在那儿）
        u._fallT = 0;
        st.rammed.splice(i, 1);
      }
    }
    updateRamPose(dt);
    updateRamRings(dt);
  }

  /**
   * 撞击动画①：艇体姿态。
   *
   * 撞上的一瞬间把艇往撞击侧压下去（roll）并略微低头（pitch），
   * 然后在 ramPoseTime 内平滑改平。曲线用 sin(πk) —— 起手快、收得干净，
   * 读起来是「顶了一下」，不是「翻了个跟头」。
   */
  function updateRamPose(dt) {
    for (const h of st.haulers) {
      const pose = h.ramPose;
      if (!pose || !h.craft) continue;
      pose.t += dt;
      const k = Math.min(1, pose.t / VANGUARD_ASSAULT.ramPoseTime);
      const amp = Math.sin(k * Math.PI);
      const body = h.craft.userData?.hullPivot || h.craft;
      body.rotation.z = pose.side * amp * 0.34; // 撞击侧压下去
      body.rotation.x = -amp * 0.16;            // 略微低头（把体重压上去）
      if (k >= 1) {
        body.rotation.z = 0;
        body.rotation.x = 0;
        h.ramPose = null;
      }
    }
  }

  /**
   * 撞击动画②：撞点冲击波环。
   *
   * 一圈贴地的环，0.55s 内从 0.6 张到 5.2 并淡出。用 RingGeometry 而不是粒子：
   * 一次撞击只多一个 draw call，撞五个人也只有五个——这条线上性能是有前科的
   * （城堡构建那次崩溃）。环随用随建、用完 dispose，不进对象池。
   */
  function spawnRamRing(atPos, upDir) {
    const geo = new THREE.RingGeometry(0.55, 0.78, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfe6ff, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.name = "vanguard-ram-ring";
    ring.position.copy(atPos);
    // 环平面要贴着地面：默认 RingGeometry 在 XY 平面，法线是 +Z，
    // 把 +Z 转到当地的「天」方向即可
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), upDir.clone().normalize());
    root.add(ring);
    st.ramRings.push({ mesh: ring, t: 0 });
  }

  function updateRamRings(dt) {
    for (let i = st.ramRings.length - 1; i >= 0; i--) {
      const r = st.ramRings[i];
      r.t += dt;
      const k = Math.min(1, r.t / VANGUARD_ASSAULT.ramRingTime);
      const scale = 0.6 + k * 4.6;
      r.mesh.scale.set(scale, scale, scale);
      r.mesh.material.opacity = 0.85 * (1 - k) * (1 - k);
      if (k >= 1) {
        root.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        st.ramRings.splice(i, 1);
      }
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
  function onFleetUnderAttack(attacker = null, _hubDir = null) {
    // 威胁登记**不受节流限制**：每一发命中都把攻击者记进优先打击名单，
    // 否则 3s 窗口内其他弓手/生物的攻击会被吞掉，重甲兵报复不全。
    if (attacker?.parent && !attacker.userData?.dead) st.threats.set(attacker, st.t);
    if (st.retaliateCd > 0) return;
    st.retaliateCd = 3;
    // ⚠️ 第二个参数（旧的 hubDir）现在被忽略。主人 2026-09-06：
    // 「苔庭只是其中一个战役，一切以主舰为主」——开局方向只能是主舰的地面投影，
    // 不再回退到 st.homeHub（苔庭）。调用方还在传是为了不破坏既有签名。
    if (st.phase === "idle" || st.phase === "done") {
      // 首站已经扫过一轮就**不再原地空投第二批**——主人 2026-09-05：
      // 「我看到仍然有重甲士兵源源不断地赶来，而不是与莫比斯 aircraft 组成
      //   一个强大的陆海空舰队去扫荡一切景点」。红盔会一直朝天上放箭，
      //   而这条分支每次收队后都被箭重新触发一次，等于把苔庭刷成了刷兵点。
      // 现在：打完苔庭 → 整队开赴巡演下一站；只有还没打过才在这儿开局。
      // 主人 2026-09-06（第二轮）：**这是唯一的开局入口**。
      // 「只有莫比斯 aircraft 受到攻击才会产生空降」——
      // saihojiPhalanx 那条每帧 requestStation 的线已经砍掉，
      // 苔庭不再是「一到就打」的固定战役，它只是主舰航线上的一站。
      // 三道闸仍在（主舰在场 / 停稳 / 冷却），挡住「反复空降」。
      requestStation();
      return;
    }
    // ⚠️ 苔庭任务进行中（approach/insert/combat，非巡演）：**已经在开战**，
    // 绝不重置——否则进场上空的箭会每 3 秒打断一次装填，任务永远进不了 combat。
    //
    // ⚠️⚠️ 更要命的一条（主人 2026-09-05 第二张截屏）：**已经在这个地方了就别重装填**。
    // 原来 `withdraw` / `extract` 期间挨一箭就 `setupMission(home)`，可红盔本来就
    // 会一直朝天上放箭——于是每 3 秒把整支登陆队弹回进场起点重来一遍，
    // 运输艇一波接一波开进来，永远撤不走。撤离途中挨箭是常态，不是意外。
    // 任务进行中挨箭是常态，不是意外：绝不重置任务。
    // 旧代码在「人在巡演站」时会 setupMission(home) 把整支队弹回苔庭重来一遍，
    // 那是登陆队自己排班时代的补丁；现在站点由主舰决定，这条整个不需要了。
    // 该还击的由重甲兵的优先打击名单（st.threats）负责，已经在上面登记过。
  }

  /**
   * 把泡机交还护航编队（幂等，可以每帧调）。
   *
   * `setupMission` 会 `scene.attach(pod)` 把三台泡机从僚机翼里摘出来自己开，
   * 而只有 `updateExtract` 一路走到最后才还回去。任务只要没走完就被打断
   * ——撤离途中挨箭重装填、机队提前飞走、场景切换——泡机就永远留在 scene 下。
   * `updateGatePodEscort` 只遍历 `wing.children`，看不见它们，于是三台泡机
   * 停在最后一次任务的位置一动不动（主人 2026-09-05 截屏：
   * 「让这三个 GatePodCraft 别一直停在哪里，也去伴飞吧」）。
   *
   * 所以还翼这件事不能只写在 extract 的末尾那一个出口上，得每帧兜底。
   */
  function releasePods() {
    const wing = (typeof getFleet === "function" ? getFleet() : null)
      ?.userData?.gatePodEscort || st.escortWing;
    if (!wing) return;
    for (const p of st.pods) {
      const pod = p?.pod;
      if (pod?.parent && pod.parent !== wing) wing.attach(pod);
    }
    // 再扫一遍场景：只认 st.pods 是不够的——上一轮任务可能根本没把泡机记进
    // st.pods（getPods() 那一刻返回空），或者中途换过机队引用，那些泡机就会
    // 一直挂在 scene 下、`updateGatePodEscort` 只遍历 wing.children 看不见它们，
    // 于是永远停在原地不伴飞（主人 2026-09-05 两次点名）。
    // 认得出泡机的唯一凭据是 `userData.escortSlot`（mountGatePodEscort 打的）。
    if (scene) {
      const strays = [];
      for (const child of scene.children) {
        if (child?.userData?.escortSlot && child !== wing) strays.push(child);
      }
      for (const pod of strays) wing.attach(pod);
    }
  }

  /**
   * 不在任务中时，舰队的地面/海面成员一律不出现在画面里（主人 2026-09-05 定的规矩）：
   *
   *   「莫比斯 aircraft + GatePodCraft + gateHaulerCraft + 重甲兵是一个团队
   *     （海陆空舰队），随莫比斯 aircraft 扫荡式移动。只要 aircraft 移动走了，
   *     场景中就不要出现舰队相应成员。」
   *
   * 泡机是例外：它本来就挂在机队僚机翼下，跟着 aircraft 飞就是「跟着走」，
   * 不需要隐身（`releasePods` 负责把它送回翼下）。
   *
   * 这里做的是**兜底**，不是主逻辑：正常收队路径在 `updateExtract` 末尾已经
   * 隐了艇与兵。但任务可能从任何一个岔路提前结束（机队飞走、场景切换、
   * 存档重载），少一条出口就会在苔庭留下一排空运输艇。所以每帧钉一次。
   */
  function enforceOffstage(dt = 0) {
    // 重甲兵不在任务中就是**坐在艇腹里**，不该出现在画面上
    if (squad && squad.visible) squad.visible = false;

    const haulers = (typeof getHaulers === "function" ? getHaulers() : []) || [];
    if (!haulers.length) return;
    // 「有没有机队可跟」必须与 fleetAlive 用同一把尺子：机队整组被移出场景时，
    // 成员的 .parent 仍然指向那个已脱离场景的 Group，光看成员会误判成「还在」。
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleetAlive() ? (fleet.userData.members || []).filter((m) => m?.parent) : [];
    if (!members.length) {
      // 没有机队可跟 → 才真的收进后台（场景没加载 / 桩环境 / 机队已离场）
      for (const c of haulers) if (c && c.visible) c.visible = false;
      return;
    }

    // 机队中心的地面投影 = 舰队这一刻在哪
    _o1.set(0, 0, 0);
    for (const m of members) _o1.add(m.getWorldPosition(_fleetDir));
    _o1.multiplyScalar(1 / members.length);
    if (_o1.lengthSq() < 1e-8) return;
    _fleetDir.copy(_o1).normalize();

    // ---- 低通：气垫船「稳重如山」的全部实现（主人 2026-09-06）----
    // 跟的是机队中心的**平滑值**，不是每帧的瞬时值。
    // 苔庭鲸把主舰拽得上下俯冲时，瞬时投影每帧都在跳；照着它开，
    // 几十吨的气垫艇就变成了被绳子牵着的浮标——「跟着莫比斯 aircraft 癫狂」。
    // 时间常数 CRUISE_SMOOTH_TAU 秒：主舰的高频动作被滤掉，
    // 真正的转场（低频）照样跟得上。
    if (!st.cruiseSmooth) st.cruiseSmooth = _fleetDir.clone();
    {
      const a = dt > 0 ? 1 - Math.exp(-dt / CRUISE_SMOOTH_TAU) : 1;
      st.cruiseSmooth.lerp(_fleetDir, a).normalize();
      _fleetDir.copy(st.cruiseSmooth);
    }

    // 航向：取机队中心方向的逐帧位移在球面上的切向。机队悬停时位移趋零，
    // 这时沿用上一帧的航向，避免艇头乱转。
    if (!st.cruiseDir) st.cruiseDir = _fleetDir.clone();
    if (!st.cruiseFwd) st.cruiseFwd = new THREE.Vector3();
    _c2.copy(_fleetDir).sub(st.cruiseDir);
    _c2.addScaledVector(_fleetDir, -_c2.dot(_fleetDir)); // 投影到切平面
    if (_c2.lengthSq() > 1e-10) st.cruiseFwd.copy(_c2).normalize();
    if (st.cruiseFwd.lengthSq() < 1e-8) {
      // 首帧兜底：拿任一成员的机头方向
      members[0].getWorldQuaternion(_cQ);
      st.cruiseFwd.set(0, 0, 1).applyQuaternion(_cQ);
      st.cruiseFwd.addScaledVector(_fleetDir, -st.cruiseFwd.dot(_fleetDir));
      if (st.cruiseFwd.lengthSq() < 1e-8) st.cruiseFwd.set(1, 0, 0);
      st.cruiseFwd.normalize();
    }
    st.cruiseDir.copy(_fleetDir);

    // 楔形阵位：右舷 = fwd × up
    _c3.crossVectors(st.cruiseFwd, _fleetDir).normalize();
    const k = dt > 0 ? dt : 0.016;
    haulers.forEach((craft, i) => {
      if (!craft?.parent) return;
      craft.visible = true;
      const slot = VANGUARD_ASSAULT.haulerSlots[i % VANGUARD_ASSAULT.haulerSlots.length];
      // 球面偏移铁律：先乘半径，再切向平移
      _c4.copy(_fleetDir).multiplyScalar(seaR + SOCCO.skimHeight)
        .addScaledVector(_c3, slot.side)
        .addScaledVector(st.cruiseFwd, slot.back - CRUISE_TRAIL);
      chaseObj(craft, _c4, k, CRUISE_FOLLOW_K, 0.5);
      _c5.copy(craft.position).normalize();
      orientCraft(craft, st.cruiseFwd, _c5);
      updateSoccoSeaSkim(craft, { t: st.t, seaRadius: seaR, speed: 0.6 });
    });
  }

  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */
  function fleetAlive() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    if (!fleet?.parent) return false;
    return (fleet.userData?.members || []).some((m) => m?.parent);
  }

  /**
   * 机队是否已经飞离本站（主人 2026-09-05：「莫比斯 aircraft 都飞走了，
   * GatePodCraft 和 gateHaulerCraft 及重甲兵为啥还源源不断到来，
   * 而不是尾随莫比斯 aircraft 走开」）。
   *
   * 光靠 missionLock 锁不住所有情况：苔庭鲸对抗期机队归 whaleLock 管，
   * 那条故事线可以把机队「打走」（moebiusAircraft 的 depart）。所以这里不猜
   * 状态机，直接量距离——机队中心离作战锚点超过 FLEET_ABANDON_DIST 就是走了。
   */
  function fleetLeftStation() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) return false;   // 没机队可跟，别误判
    if (st.hub.lengthSq() < 1e-8) return false;
    _o1.set(0, 0, 0);
    for (const m of members) _o1.add(m.getWorldPosition(_fleetDir));
    _o1.multiplyScalar(1 / members.length);
    _fleetDir.copy(st.anchor.lengthSq() > 1e-8 ? st.anchor : st.hub)
      .normalize().multiplyScalar(Math.max(st.baseRadius, R));
    return _o1.distanceTo(_fleetDir) > FLEET_ABANDON_DIST;
  }

  // ---------------------------------------------------------------- update --
  function update(dt, t = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.t = t;
    st.clock += dt;
    const onMission = st.phase !== "idle" && st.phase !== "done";
    // 整体舰队作战 BGM（主人 2026-09-06）：在任务中就响，收队就淡出。
    // 逐帧维持而不是「开局点一次」——任务可能从任何一个岔路提前结束
    // （主舰飞走、场景切换、看门狗强制收队），少一条出口音乐就会一直响着。
    // 苔庭之战那首优先，sfx 内部会让路。
    try { setFleetAssaultBgm(onMission); } catch { /* 音频未就绪时静默 */ }
    // 不在任务中 → 泡机必须回到僚机翼去伴飞，一帧都不许滞留在 scene 下
    if (!onMission) { releasePods(); enforceOffstage(dt); }

    // 主人 2026-09-06：**对主舰只读不写**。这里原来每帧发一次驻留请求，
    // 现在一行都没有——主舰的航线是主舰自己的事。
    // 每帧跟踪主舰是否停稳——开局闸门要用，非任务期也要连续记
    trackSettle(dt);
    // 机队真的没了（被移出场景）：地面部队不许留在原地当活靶，立刻收队跟走。
    // ⚠️ 必须先「见过」机队才算数——测试与无机队的桩场景根本不传 getFleet，
    // 一上来就判定「机队没了」会让任务在 approach 段直接 withdraw。
    if (onMission) {
      if (fleetAlive()) st.sawFleet = true;
      const stranded = st.sawFleet && (!fleetAlive() || fleetLeftStation());
      if (stranded && st.phase !== "withdraw" && st.phase !== "extract") {
        // 机队走了 → 登陆队立刻收队尾随，绝不留在原地继续打
        st.phase = "withdraw";
      }
    }

    // 阶段看门狗：任何一段卡死超过 MISSION_STALL_LIMIT 秒就强制收队。
    // 上面 withdraw 的硬截止修的是**已知**的那个死角；这条守的是还没被发现的
    // 那些——舰队散在半路不动，是主人这几天反复看到的同一种画面，
    // 与其等下一次再抓一遍 `__tm.fleet()`，不如让状态机自己爬出来。
    if (onMission) {
      if (st.phase !== st.lastPhase) { st.lastPhase = st.phase; st.phaseT = 0; }
      else st.phaseT += dt;
      if (st.phaseT > MISSION_STALL_LIMIT) {
        finishMission();
        st.lastPhase = st.phase;
        st.phaseT = 0;
        return;
      }
    } else { st.lastPhase = st.phase; st.phaseT = 0; }

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
    updateHaulerRam(dt);
    if (st.retaliateCd > 0) st.retaliateCd -= dt;
  }

  /** 泡机是否由任务接管（updateIsland 据此跳过 updateGatePodEscort）。 */
  function controlsPods() {
    return st.phase !== "idle" && st.phase !== "done";
  }

  /**
   * 「要不要在这儿落」的唯一入口。saihojiPhalanx 每帧都会问一次。
   *
   * 主人 2026-09-06「主舰主导」之后，这里要过三道闸——三道都是为了根治
   * 「重甲兵反复空降」，而且每一道对应一个曾经真实发生过的故障：
   *
   *   ① 主舰得在场。没机队还空投，等于把人扔进空气里。
   *   ② 主舰得**就在这儿**、而且**停稳了**。旧代码拿调用方给的方向直接开局，
   *      主舰在不在那儿根本不问——于是登陆队先落地，再用 missionLock 把主舰
   *      拽过来。现在反过来：主舰停在哪，战场才在哪。
   *   ③ 这个地方最近没打过。旧代码 done 的下一帧就能再开一局，
   *      而 saihojiPhalanx 是**每帧**调这个函数的——一秒钟能开六十次。
   *
   * @param {THREE.Vector3} hubDir 调用方认为「这儿有敌人」的方向
   * @returns {boolean} 是否开局
   */
  function requestStation() {
    if (st.phase !== "idle" && st.phase !== "done") return false;

    // ① 主舰在场。没机队还空投，等于把人扔进空气里
    const here = fleetGroundDir(_o3);
    if (!here) return false;

    // ② 主舰**停稳了**。这一条是「不空降到主舰屁股后头」的保险：
    // 主舰不再为我们停留（主人否掉了 missionLock），所以只在它自己选择
    // 驻留的时候落地；它正在转场就别扔人下去，落地即被抛下。
    // 「停稳」必须当场核对，不能只信 settleT 这个累计值：
    // trackSettle 每帧才更新一次，主舰刚被挪走、update 还没跑的那一瞬间，
    // settleT 仍是上一处累积的大数——照信不误就会在刚飞到的地方立刻空投。
    if (!st.settleDir) return false;
    if (st.settleDir.distanceTo(here) * R > STATION_SETTLE_RADIUS) return false;
    if (st.settleT < STATION_SETTLE_TIME) return false; // 还在飞，没停稳

    // ③ 这个地方刚打过就别再落一批（「重甲兵反复空降」的最后一道闸）
    if (recentlySwept(here)) return false;

    // 战场 = **主舰的地面投影**，没有第二个来源。
    // 主人 2026-09-06：「苔庭只是其中一个战役，一切以主舰为主」——
    // 所以这里既不看调用方给的方向，也不回退到 st.homeHub（苔庭）。
    return begin(here.clone());
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
  /**
   * 交给重甲兵的打击池（saihojiPhalanx 喂给 updateVanguardCombat 的 soldiers）。
   *
   * 与 liveTargets() 的差别只有一条：**被麻醉打趴在地上的也算数**。
   * liveTargets 要把 downed 摘掉——不然泡机会对着一个已经躺平的目标继续倾泻麻醉弹；
   * 但主人的设定是「空中生物让泡机麻醉后坠地**解决**」，解决的是重甲兵。
   * 两个池子口径不同是有意的，不是漏筛。
   */
  /**
   * 曳光弹指示（主人 2026-09-06：侦察机「曳光弹 指示 需要攻击 物体」）。
   *
   * 只做一件事：把目标推进优先打击名单。**不**触发开局、**不**走
   * onFleetUnderAttack 的那套还击节流——指示不是「我们挨打了」，
   * 拿受击那条路顶替会带来两个副作用：3 秒的 retaliateCd 把指示吞掉，
   * 以及 homeHub 为空时每帧刷一行 console.warn。
   *
   * 分工制的落点就在这里：标出来之后，泡机（麻醉）/ 重甲兵（射击格斗）/
   * 登陆艇（撞飞）各自从这个名单里取目标。
   */
  function designateTarget(object) {
    if (!object?.parent || object.userData?.dead) return false;
    st.threats.set(object, st.t);
    return true;
  }

  function tourTargets() {
    const out = liveTargets();
    const seen = new Set(out);
    // 正在坠落的
    for (const o of st.tranqFall) {
      if (o?.parent && !o.userData?.dead && !seen.has(o)) { seen.add(o); out.push(o); }
    }
    // 已经落地瘫着的（不在 tranqFall 里了）：一直留在池子里，直到被解决
    scene?.traverse?.((o) => {
      if (o.userData?.tranqGrounded && !o.userData?.dead && o.parent && !seen.has(o)) {
        seen.add(o);
        out.push(o);
      }
    });
    return out;
  }

  return {
    root, begin, update, phase, controlsPods, triggerWithdraw, stats, tourTargets,
    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive, releasePods, designateTarget,
    requestStation, enforceOffstage,
    sweptHome: () => st.sweptHome,
  };
}
