// =====================================================================
//  @legacy 日间攻城状态机（禁止追加新玩法）
//  V4 真源：src/agents/citadel/siegeDirector.js · combatAgent.js · combatSim.js
//  本文件暂留：完整运兵/弓箭/拔河仍在这里。见 docs/citadel-v4-legacy.md
//
//  西芳寺罗马方阵：鼓声平息 + 苔庭鲸升空后，战船一艘艘运兵上岸，
//  长矛围边、短剑盾第二层、核心英格兰长弓，对莫比斯 aircraft 攒箭。
//  鲸起即告警 → 全营整队：长弓手在北翼排成两列，矛/盾结成护壁；
//  aircraft 悬停盘顶吸食，羽箭逐箭削弱其吸取力；绳索小队抛绳挂上
//  鲸身两侧，拔河式把苔庭鲸拉回地面（低级文明 vs 高级文明的拉锯）。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { SAIHOJI_HUB } from "./saihoji.js";
import { CITADEL_CASCADE_POOL_SPECS } from "./odysseyCitadel.js";
import { citadelWalkFlights, citadelWalkMetrics } from "./citadelRange.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import {
  isInfiltrationMissionActive,
  cuePhalanxAlarmOnce,
  rearmPhalanxAlarm,
  setSiegeAssaultBgm,
  allowSiegeAssaultBgmHandoff,
} from "../audio/sfx.js";
import {
  createFisherBoat,
  createHarborPatrolSoldier,
  createCitadelMeleeSoldier,
  createLongbowSoldier,
  updateLongbowShot,
  updateWarshipOars,
  paintSoldierHelm,
  paintBoatCrewCrest,
  emptyBoatCrew,
} from "../assets/harbor.js";
import { P, isCitadelPaletteV3 } from "../core/params.js";
import { v3TokenInt } from "./citadelVisualTheme.js";
import { createRng } from "../core/rng.js";
import { projectWorldObjectToPlanetSurface } from "./planetV8/riderProjection.js";
import {
  applyVanguardHit,
  updateVanguardCombat,
  deployVanguardSquad,
  createBoltArcFx,
  VANGUARD_COMBAT,
} from "./vanguardTrooper.js";

const SHIP_COUNT = 2;
const SHIP_GAP = 16;
const GRID = 5;
const CELL = 0.72;
// 羽箭池上限：机队中箭数只做计数，吸取力由 moebiusAircraft 逐箭渐进计算
const ARROW_POOL = 150;
// 攻城战深夜清场：红盔守军路口站位（也作木马兵巡查点）、蓝盔残部数、木马巡查兵数
const RED_POSTS = Object.freeze([
  [0.055, 0],
  [-0.055, 0],
  [0, 0.055],
  [0, -0.055],
  [0.042, 0.042],
  [-0.042, 0.042],
]);
// 一层台地前沿哨位：攻城梯扇区（x 0.6~6.6）两翼的台面 x 带（城堡局部坐标，
// 柱高运行时射线实测）；RED_POSTS 方向仅作桩环境兜底
const RED_POST_SIEGE_X = Object.freeze([-1.6, -3.6, -5.6, 8.6, 10.6, 12.6]);
const STRAGGLER_COUNT = 5; // 深夜仍滞留的蓝盔残部（被木马兵驱赶的对象）
const TROJAN_PATROL_COUNT = 6; // 木马腹里出来的深夜巡查兵
const PATROL_PACE = 1.7; // 木马兵巡查步速（世界单位/秒）
const STRAGGLER_FLEE_PACE = 2.3; // 残部逃跑步速
const STRAGGLER_ESCAPE_DIST = 14; // 残部逃离滞留点 ≥14 单位即没入夜色消失
// 攻城路线：苔庭战船 → 纳沃纳广场集结 → 中央突破 → 逐层瀑布攻城梯 → 夺取台地建筑
const SIEGE_LADDER_COUNT = 6; // 总梯数保持 6：首波 4 架覆盖四个层间落差，增援再用 2 架
const SIEGE_LADDER_FIRST_WAVE = 4; // 首波蓝盔使用的梯数；梯 4/5 留给第二波增援
// 台地数组按高→低排列；攻城从地面向上，所以瀑布顺序必须反向。
// 2、2、1、1 的分配既保留 6 架梯，又保证每个层间瀑布至少有一架。
const SIEGE_LADDER_CASCADE_SEQUENCE = Object.freeze([3, 2, 1, 0, 3, 2]);
const SIEGE_GATHER_SEC = 5; // 纳沃纳广场集结时长（秒后中央突破）
const BOARD_HOLD_SEC = 3.2; // 苔庭战役后换蓝缨原地列队时长（秒，看得见换缨再登船）
const SIEGE_ADVANCE_PACE = 2.6; // 突破推进步速（跑步，广场→瀑布约 30 秒）
const SIEGE_CLIMB_SEC = 4.2; // 单人爬梯耗时
const LADDER_QUEUE_CAP = 8; // 每架攻城梯的排队上限：排满的士兵改走瀑布攀爬道
const WATERFALL_CLIMB_LANES = 3; // 瀑布攀爬道数量（没有攻城梯也能沿瀑布水帘攀上城）
const WATERFALL_CLIMB_SEC = 6.5; // 攀瀑比爬梯更慢更危险（无梯登城的险路）
const STAIR_ASSAULT_PACE = 2.9; // 无梯时沿真实朝圣石阶小跑上行
const STAIR_QUEUE_GAP_SEC = 0.42; // 阶梯入口排队间隔，避免士兵互相重叠
/** 深夜抵达时强制拨回傍晚后，至少演完这么久再进深夜清场 */
const SIEGE_MIN_DAY_SEC = 62;
const RED_LONGBOW_COUNT = 4; // 红盔长弓手（少量，居高俯射防守）
// 攻城战斗数值（Bad North 式兵种克制，红蓝双方同规则）：
//  瘫倒 = 1 次近战（短剑）或 2 支羽箭 —— 倒地失去战斗力，仍可见可被补刀
//  击杀 = 2 次近战（短剑）或 4 支羽箭 —— 倒地淡出消失
//  克制关系（参考 Bad North：盾兵克弓 / 长矛站桩克冲锋 / 弓箭居高压制）：
//   · 盾步兵（短剑+圆盾 gladius）隔箭挡箭：未陷入近战、未爬梯时，
//     每两支羽箭挡下一支（盾一次只能挡一个威胁）；爬梯时盾在背后挡不了
//   · 长矛（spear）站桩封路：静止防守时一击即击杀冲锋者（pike=2 次近战），
//     但移动中（advance）不能出手 —— 梯口/路口的矛墙是攻方噩梦
//   · 长弓居高：射手站位比目标高时射速加快（高台箭雨压梯压船）
const MELEE_RANGE = 1.7; // 贴身近战距离
const MELEE_COOLDOWN = 1.15; // 近战出手间隔（秒）
const STAGGER_ARROW = 2;
const STAGGER_MELEE = 1;
const KILL_ARROW = 4;
// 近战击杀阈值（红盔内战：1 瘫 2 死）。先锋兵武器走专用点数：
// 闪电枪 "vanguardBolt"（+2，2 枪毙命）/ 激光剑 "pike"（+2，1 剑毙命）。
const KILL_MELEE = 2;
const HIGHGROUND_SHOT_FACTOR = 0.72; // 居高射箭冷却倍率（<1 = 更快）

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpD = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _basis = new THREE.Matrix4();
const _toolOrigin = new THREE.Vector3();
const _toolTarget = new THREE.Vector3();
const _toolDir = new THREE.Vector3();
const _toolAxis = new THREE.Vector3(0, 1, 0);
const _toolParentQ = new THREE.Quaternion();
const _toolAimQ = new THREE.Quaternion();

function hubDir(out = new THREE.Vector3()) {
  return latLonToDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, out);
}

/** 苔庭方向（模块级，供 updateIsland 的湖沼受击回调使用） */
export function saihoujiHubDir(out = new THREE.Vector3()) {
  return hubDir(out);
}

function surfaceBasis(dir, face, outUp, outFwd, outRight) {
  outUp.copy(dir).normalize();
  outFwd.copy(face);
  outFwd.addScaledVector(outUp, -outFwd.dot(outUp));
  if (outFwd.lengthSq() < 1e-8) {
    outFwd.set(0, 0, 1).addScaledVector(outUp, -outUp.z);
  }
  outFwd.normalize();
  outRight.crossVectors(outUp, outFwd).normalize();
  outFwd.crossVectors(outRight, outUp).normalize();
}

function placeOnSphere(obj, dir, lift, face) {
  surfaceBasis(dir, face, _up, _fwd, _right);
  obj.position.copy(_up).multiplyScalar(PLANET_RADIUS + lift);
  obj.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
}

function roleAt(ix, iz) {
  const c = (GRID - 1) / 2;
  const cheb = Math.max(Math.abs(ix - c), Math.abs(iz - c));
  const man = Math.abs(ix - c) + Math.abs(iz - c);
  if (cheb >= 2) return "spear";
  if (man === 2) return "gladius";
  return "longbow";
}

// Bad North 式小队簇：不再是阅兵式刚性网格，每个站位带确定性抖动，
// 25 人挤成一小簇「乌合之众」（抖动由格子坐标哈希生成，测试可复现）
function slotJitter(gx, gz, axis) {
  const h = Math.sin(gx * 127.1 + gz * 311.7 + axis * 74.7) * 43758.5453;
  return (h - Math.floor(h) - 0.5) * 0.34; // ±0.17
}

const _axisX = new THREE.Vector3(1, 0, 0);

// 箭矢池 150 支，每支原本各造 5 个几何 + 5 个材质 = 750 + 750 个实例。
// 箭之间除了变换以外完全一样，几何可全共享；材质里只有拖尾两件被逐箭改
// opacity（见 update 里的速度痕起伏），其余三件从不改，可共享。
// 共享后 mergeStaticGroup 也不会再把 150 支箭拆成 150 组。
let _arrowShared = null;
function arrowShared() {
  const v3 = isCitadelPaletteV3();
  if (_arrowShared?.v3 === v3) return _arrowShared;
  _arrowShared = {
    v3,
    shaftGeo: new THREE.CylinderGeometry(0.02, 0.02, 0.92, 5),
    headGeo: new THREE.ConeGeometry(0.045, 0.14, 5),
    fletchGeo: new THREE.BoxGeometry(0.14, 0.11, 0.016),
    trailGeo: new THREE.BoxGeometry(0.62, 0.034, 0.034),
    trailCoreGeo: new THREE.BoxGeometry(0.3, 0.024, 0.024),
    shaftMat: new THREE.MeshBasicMaterial({ color: v3 ? v3TokenInt("shipDeckWood") : 0x9a7a4a }),
    headMat: new THREE.MeshBasicMaterial({ color: v3 ? v3TokenInt("unitSteel") : 0xcfd6da }),
    fletchMat: new THREE.MeshBasicMaterial({ color: 0xe04c3e }),
  };
  return _arrowShared;
}

function makeArrow() {
  const g = new THREE.Group();
  g.name = "phalanx-arrow";
  const S = arrowShared();
  // 与长弓上搭箭同尺度（fig×2 后约 0.68），撒放时才不会突然变短；
  // 放大 1.5 倍 + 加色拖尾：长距离攒射在空中清晰可见
  const shaft = new THREE.Mesh(S.shaftGeo, S.shaftMat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(S.headGeo, S.headMat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.52;
  g.add(head);
  const fletch = new THREE.Mesh(S.fletchGeo, S.fletchMat);
  fletch.position.x = -0.36;
  g.add(fletch);
  // Bad North 式朴素箭矢：去掉流星火焰核与光剑长拖尾，
  // 只留一条短而淡的米白速度痕（普通透明混合，不加色发光）
  // 拖尾材质逐箭独立：update 里按各自飞行进度改 opacity，共享会让全体一起闪。
  const trail = new THREE.Mesh(
    S.trailGeo,
    new THREE.MeshBasicMaterial({
      color: 0xf5f2e8,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
  );
  trail.name = "arrow-trail";
  trail.userData.isTrail = true;
  trail.position.x = -0.78;
  g.add(trail);
  const trailCore = new THREE.Mesh(
    S.trailCoreGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  trailCore.name = "arrow-trail-core";
  trailCore.position.x = -0.58;
  g.add(trailCore);
  g.userData.fly = 0;
  g.userData.from = new THREE.Vector3();
  g.userData.to = new THREE.Vector3();
  g.userData.arcUp = new THREE.Vector3(0, 1, 0);
  g.userData.miss = 0;
  g.visible = false;
  return g;
}

/** 长枪（投掷标枪）：比箭长一倍、更粗，枪头 + 红缨 + 加色拖尾 */
let _javelinShared = null;
function javelinShared() {
  const v3 = isCitadelPaletteV3();
  if (_javelinShared?.v3 === v3) return _javelinShared;
  _javelinShared = {
    v3,
    shaftGeo: new THREE.CylinderGeometry(0.032, 0.032, 1.3, 5),
    headGeo: new THREE.ConeGeometry(0.055, 0.18, 5),
    bandGeo: new THREE.CylinderGeometry(0.034, 0.034, 0.16, 5),
    trailGeo: new THREE.BoxGeometry(0.55, 0.03, 0.03),
    shaftMat: new THREE.MeshBasicMaterial({ color: v3 ? v3TokenInt("shipDeckWood") : 0x6b4f2a }),
    headMat: new THREE.MeshBasicMaterial({ color: v3 ? v3TokenInt("unitSteel") : 0xc9d1d6 }),
    bandMat: new THREE.MeshBasicMaterial({ color: 0xb83028 }),
  };
  return _javelinShared;
}

function makeJavelin() {
  const g = new THREE.Group();
  g.name = "phalanx-javelin";
  const S = javelinShared();
  const shaft = new THREE.Mesh(S.shaftGeo, S.shaftMat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(S.headGeo, S.headMat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.72;
  g.add(head);
  const band = new THREE.Mesh(S.bandGeo, S.bandMat);
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.34;
  g.add(band);
  // 长矛本体即可，不再附加夸张亮色光柱（避免尾部大光带夸大形状）。
  // 仅保留极轻微的短拖影以提示飞行方向，几乎不可见。
  // 拖尾材质逐枪独立：update 里按各自飞行进度改 opacity。
  const trail = new THREE.Mesh(
    S.trailGeo,
    new THREE.MeshBasicMaterial({
      color: 0xd8ecff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  trail.name = "javelin-trail";
  trail.position.x = -0.55;
  g.add(trail);
  g.userData.fly = 0;
  g.userData.from = new THREE.Vector3();
  g.userData.to = new THREE.Vector3();
  g.userData.arcUp = new THREE.Vector3(0, 1, 0);
  g.userData.miss = 0;
  g.visible = false;
  return g;
}

/**
 * @param {object} opts
 * @param {THREE.Scene} opts.scene
 * @param {() => boolean} opts.isWhaleRisen
 * @param {() => THREE.Group|null} opts.getSquad
 * @param {() => object|null} [opts.getTram] 电车系统（redTram/blueTram 实时位置）——
 *   白天源源不断的电车运兵：电车掠过苔庭附近时士兵下车、步行入阵
 * @param {object|null} [opts.oldHarbor] 旧港场景构建结果或 old-harbor-scene Group
 * @param {() => object|null} [opts.getOldHarbor] 动态取得旧港（编辑器重建后仍有效）
 * @param {boolean} [opts.disableSiegeLadders] 调试/编辑器开关：禁用实体攻城梯，
 *   强制验证朝圣石阶备用寻路
 * @param {object|null} [opts.surfaceProvider] V8 provider-owned terrain surface
 * @param {boolean} [opts.surfaceProjectionEnabled] opt-in unit projection gate
 */
export function createSaihojiPhalanxBattle({
  scene,
  isWhaleRisen,
  getSquad,
  /** 先锋重甲兵中队（随莫比斯 aircraft 出行，落地后参战）。返回 vanguard-squad 根节点 */
  getVanguards = null,
  /** 先锋兵到场—作战—撤离任务状态机（vanguardAssault）。给了就不走旧的瞬时落地 */
  vanguardAssault = null,
  getTram,
  oldHarbor = null,
  getOldHarbor = null,
  getTimeOfDay = null,
  getNightInfiltration = null,
  disableSiegeLadders = false,
  surfaceProvider = null,
  surfaceProjectionEnabled = false,
  seed = 1, // P0 · 攻防 V2：注入式种子随机源；同 seed 同输入 → 同事件序列
  rng: rngOpt = null,
  events = null, // 可选 CombatEventLog（P0 事件记录/重放）
} = {}) {
  const rng = rngOpt || createRng(seed);
  const rand = rng.next;
  const root = new THREE.Group();
  root.name = "saihoji-phalanx-battle";
  root.userData.combatSeed = rng.seed;
  root.userData.combatEvents = events; // P0 事件日志（可为 null）
  root.userData.siegeLaddersDisabled = !!disableSiegeLadders;
  root.userData.surfaceProjectionEnabled = !!surfaceProjectionEnabled;

  // 旧港是独立的即时交战区：红缨战斗单位一旦进入港区就切换为战斗状态，
  // 不再被当作普通巡查/运输单位。港区判定基于 old-harbor-scene 的本地
  // 椭圆范围，避免球面旋转后用世界 AABB 误判。
  const harborCombatInside = new Set();
  const harborCombatEntered = new Set();
  const harborCombat = {
    active: false,
    redEntered: 0,
    engagements: 0,
    lastAttackerUid: null,
    lastDefenderUid: null,
    _inside: harborCombatInside,
    getState: () => ({
      active: harborCombat.active,
      redEntered: harborCombat.redEntered,
      engagements: harborCombat.engagements,
      insideCount: harborCombatInside.size,
      lastAttackerUid: harborCombat.lastAttackerUid,
      lastDefenderUid: harborCombat.lastDefenderUid,
    }),
  };
  root.userData.oldHarborCombat = harborCombat;
  scene.add(root);

  // ---------- P0 事件记录：simT 为仿真时钟（update 累加 dt），与渲染 t 无关 ----------
  let simT = 0;
  let nextUid = 1; // 士兵稳定 ID：事件流跨运行可比对
  const logEvent = (kind, data) => {
    if (events) events.record(simT, kind, data);
  };
  const logCommand = (name, data) => {
    if (events) events.command(simT, name, data);
  };
  const setPhase = (next) => {
    if (phase !== next) {
      logEvent("phase", { from: phase, to: next });
      phase = next;
    }
  };

  /**
   * 完整故事线状态机：
   *  atCastle（高山圣城，鼓声控制）→ 鼓声结束发船
   *  → sailOut（运兵：城堡 → 运河交汇处城堡 → 苔庭下岸）
   *  → fight（整队成阵，鲸起才攒箭对 aircraft 射击）
   *  → return（苔庭鲸恢复原位后，全员换蓝盔、撤阵登船经运河去纳沃纳广场）
   *  → siege（广场集结 → 由攻城梯或山路/阶梯登城，夺取古堡顶层；
   *          红盔原地防守（梯顶/城顶）+ 少量红盔长弓手俯射，
   *          红盔战船经运河不断增援，人数不限；蓝盔长弓箭雨点名）
   *  → siegeNight（深夜主力消失，木马腹中红盔兵出腹巡查、驱赶蓝盔残部回运河）
   *  → done（残部驱离殆尽、巡查兵回木马腹，故事线落幕）
   */
  let phase = "atCastle";
  let quietT = 0;
  let shipIdx = 0;
  let nextShipIn = 0;
  let returnRequested = false;
  let siegeNightT = 0;
  let redRoot = null;
  const redSoldiers = [];
  const redPostWorld = []; // 城顶防守哨位实测锚点（null = 桩环境旧方向兜底）
  // 攻城战：红盔战船经运河从交汇处不断增援圣城（人数不限，战船到岸即增援 4 人小队）
  const redShips = []; // { boat, u, unloaded }
  let redReinforceT = 0;
  const RED_SHIP_SAIL_TIME = 14; // 交汇处 → 圣城航程（秒）
  // 蓝盔第二波增援：攻城打响后再从运河交汇处运两船蓝缨兵（满编 5×5）
  const blueShips = []; // { wave, u, arrived, side }
  let blueReinforced = false;
  const BLUE_REINFORCE_AT = 16; // 攻城开始后 16 秒从交汇处出发
  const BLUE_REINFORCE_SHIPS = 2;
  const BLUE_SHIP_SAIL_TIME = 22; // 交汇处 → 纳沃纳广场航程（秒）
  // 山脚至古堡顶层的攻城梯（蓝盔中央突破通道）
  let ladderRoot = null;
  const siegeLadders = []; // { group, base, top, x }
  root.userData.siegeLadders = siegeLadders; // 自动验收/调试：路线终点必须为 castle-top
  // 旧瀑布攀爬道仅保留给 latestDesign=false 的兼容场景；新圣城不生成。
  const siegeWaterfallClimbs = []; // { base, top, capture, x }
  // 无攻城梯时的山路/石阶路线：从山脚连续抵达古堡顶层。
  const siegeStairRoutes = []; // { points, base, top, capture, terraces }
  root.userData.siegeWaterfallClimbs = siegeWaterfallClimbs; // 测试/调试句柄
  root.userData.siegeStairRoutes = siegeStairRoutes; // 测试/调试句柄
  let siegeGatherT = 0;
  let siegeElapsed = 0;
  let siegeForceDay = false;
  // 深夜清场：木马士兵巡查驱赶蓝盔残部
  let patrolRoot = null;
  const trojanPatrol = []; // { s, wpIndex }
  let stragglersMarked = false;
  let wasWhaleUp = false;
  const waves = [];
  const arrows = [];
  for (let i = 0; i < ARROW_POOL; i++) {
    const a = makeArrow();
    root.add(a);
    arrows.push(a);
  }
  let arrowI = 0;
  // 长枪兵的投枪池：比箭更长更粗，掷向盘顶机队
  const javelins = [];
  for (let i = 0; i < 44; i++) {
    const j = makeJavelin();
    root.add(j);
    javelins.push(j);
  }
  let javelinI = 0;
  // 命中火花/受创烟：池化小网格（加色火花 + 半透明烟）
  const sparkPool = [];
  const smokePool = [];
  for (let i = 0; i < 22; i++) {
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.MeshBasicMaterial({
        color: isCitadelPaletteV3() ? v3TokenInt("unitTorch", { torch: true }) : 0xffe8a0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sp.visible = false;
    root.add(sp);
    sparkPool.push(sp);
  }
  for (let i = 0; i < 14; i++) {
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.MeshBasicMaterial({
        color: 0x2a2a30,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    sm.visible = false;
    root.add(sm);
    smokePool.push(sm);
  }
  let sparkI = 0;
  let smokeI = 0;

  const landDir = hubDir(new THREE.Vector3());
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), landDir).normalize();
  landDir.addScaledVector(east, 0.11).normalize();
  // 出发港：高山圣城（castleContainer）；中转：运河交汇处城堡（水上城堡）
  const castleDir = (() => {
    const c = scene.getObjectByName("castleContainer");
    if (c) return c.position.clone().normalize();
    return latLonToDir(24.1, 36.05, new THREE.Vector3());
  })();
  const castleEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), castleDir).normalize();
  const castleNorth = new THREE.Vector3().crossVectors(castleDir, castleEast).normalize();
  const junctionDir = (() => {
    const j = scene.getObjectByName("canal-junction-box");
    if (j?.userData?.up) return j.userData.up.clone().normalize();
    return latLonToDir(30.05, -63.02, new THREE.Vector3());
  })();
  // 高山圣城局部系（瀑布缺口朝向 = 容器局部 +Z，notchCenter≈0.17 略偏 +X）：
  // 攻城梯/台地落点需要在「含台地高度」的世界坐标插值，不能只做球面归一。
  const castleObj = scene.getObjectByName("castleContainer");
  const latestAssault = castleObj?.userData?.highlandAssaultAnchors ?? null;
  const ladderPolicyDisabled = !!(
    disableSiegeLadders || latestAssault?.ladderPolicy === "disabled"
  );
  root.userData.siegeLaddersDisabled = ladderPolicyDisabled;
  root.userData.siegeLadderPolicy = latestAssault?.ladderPolicy
    ?? (disableSiegeLadders ? "disabled" : "legacy");
  const castleQuat = castleObj?.quaternion?.clone() ?? new THREE.Quaternion();
  const castlePos = castleObj
    ? castleObj.position.clone()
    : castleDir.clone().multiplyScalar(PLANET_RADIUS);
  function castleLocalPoint(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(castleQuat).add(castlePos);
  }
  function latestAssaultPoint(tuple, out = new THREE.Vector3()) {
    if (!Array.isArray(tuple) || tuple.length < 3) return null;
    return castleLocalPoint(tuple[0], tuple[1], tuple[2], out);
  }
  // 圣城局部 +Y（台地法向）与 +Z（瀑布/正立面朝向）的世界向量
  const castleUpWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(castleQuat);
  const castleFwdWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(castleQuat);
  // 集结点：纳沃纳广场（木马也摆在这里）；无存档/无场景时回落圣城运河侧
  const plazaDir = (() => {
    const p = scene.getObjectByName("citadel-navona-canal-plaza");
    if (p) {
      p.updateWorldMatrix(true, false);
      return p.getWorldPosition(new THREE.Vector3()).normalize();
    }
    return castleDir
      .clone()
      .addScaledVector(castleEast, 0.0)
      .addScaledVector(castleNorth, -0.14)
      .normalize();
  })();
  // 去程：城堡 → 交汇处城堡（稍作停留）→ 苔庭下岸；
  // 回程：苔庭 → 交汇处 → 纳沃纳广场（攻城部队在广场下船集结）
  const OUT_LEGS = [
    [castleDir, junctionDir, 0.44],
    [junctionDir, junctionDir, 0.12],
    [junctionDir, landDir, 0.44],
  ];
  const BACK_LEGS = [
    [landDir, junctionDir, 0.44],
    [junctionDir, junctionDir, 0.12],
    [junctionDir, plazaDir, 0.44],
  ];
  const SAIL_TIME = 34; // 单程运兵时长（两段航程 + 交汇处停留）
  function pathDirAt(legs, u) {
    let acc = 0;
    for (const [a, b, w] of legs) {
      if (u <= acc + w) {
        const t = THREE.MathUtils.clamp((u - acc) / Math.max(1e-6, w), 0, 1);
        return a.clone().lerp(b, t).normalize();
      }
      acc += w;
    }
    return legs[legs.length - 1][1].clone().normalize();
  }

  function spawnSoldier(role) {
    const s =
      role === "longbow"
        ? createLongbowSoldier({ rand })
        : role === "gladius"
          ? createCitadelMeleeSoldier()
          : createHarborPatrolSoldier();
    s.userData.uid = nextUid++; // P0 稳定士兵 ID（事件流比对用）
    s.userData.phalanxRole = role;
    // 苔庭方阵原本就是红盔；完成鲸拉回任务、随船返回圣城攻城时才换蓝盔
    // （beginSiege 中逐个 paintSoldierHelm(s, "blue")，蓝盔人数 = 完成任务人数）
    paintSoldierHelm(s, "red");
    if (role === "longbow") {
      const order = ["reach", "nock", "draw", "hold", "follow", "recover"];
      const holdFor = 0.18 + rand() * 0.16;
      s.userData.bowCycle = {
        phase: order[Math.floor(rand() * order.length)],
        t: rand() * 0.12,
        draw: 0,
        holdFor,
        seed: rand() * Math.PI * 2,
      };
      updateLongbowShot(s, 0, rand);
    }
    s.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    return s;
  }

  function spawnWave(index, grid = GRID, ringIndex = null) {
    logEvent("wave", { index, grid, ringIndex });
    const boat = createFisherBoat();
    boat.name = `saihoji-troopship-${index}`;
    boat.scale.setScalar(1.7);
    boat.userData.kind = "saihoji-troopship";
    root.add(boat);

    const cohort = new THREE.Group();
    cohort.name = `saihoji-cohort-${index}`;
    cohort.visible = false;
    const soldiers = [];
    for (let iz = 0; iz < grid; iz++) {
      for (let ix = 0; ix < grid; ix++) {
        const role = roleAt(ix, iz);
        const s = spawnSoldier(role);
        s.userData.gx = ix;
        s.userData.gz = iz;
        cohort.add(s);
        soldiers.push(s);
      }
    }
    root.add(cohort);
    waves.push({
      boat,
      cohort,
      soldiers,
      u: 0,
      state: "sailOut",
      ringIndex, // 补给船下岸到环绕苔庭槽位；故事主阵 null = 中央
    });
  }

  function placeCohort(wave, origin, face) {
    surfaceBasis(origin, face, _up, _fwd, _right);
    const c = (GRID - 1) / 2;
    for (const s of wave.soldiers) {
      const lx = (s.userData.gx - c) * CELL + slotJitter(s.userData.gx, s.userData.gz, 0);
      const lz = (s.userData.gz - c) * CELL + slotJitter(s.userData.gx, s.userData.gz, 1);
      _tmp.copy(_up).multiplyScalar(PLANET_RADIUS + groundLift(_up))
        .addScaledVector(_right, lx)
        .addScaledVector(_fwd, -lz);
      s.position.copy(_tmp);
      s.userData.formationPos = _tmp.clone(); // 鲸起时的归位点
      s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
    }
    wave.cohort.visible = true;
    wave.boat.visible = false;
  }

  // ---------- 纳沃纳广场集结落位：站在广场铺装甲板上，而不是球面贴地 ----------
  // 广场在圣城黄土坡的抬升地形上，苔庭地面采样（groundLift）在这里会失准、
  // 会把士兵埋进坡体；改为对广场网格做径向射线，取真实甲板/水盆高度。
  const _plazaRay = new THREE.Raycaster();
  let _plazaCache = null; // { meshes, pos, r }
  function plazaDeckInfo() {
    if (_plazaCache) return _plazaCache;
    const p = scene.getObjectByName("citadel-navona-canal-plaza");
    const meshes = [];
    let pos = null;
    if (p) {
      p.updateWorldMatrix(true, true);
      p.traverse((o) => {
        if (o.isMesh && o.visible && typeof o.raycast === "function") meshes.push(o);
      });
      pos = p.getWorldPosition(new THREE.Vector3());
    }
    _plazaCache = { meshes, pos, r: pos ? pos.length() : PLANET_RADIUS };
    return _plazaCache;
  }
  // 径向向下射线取广场甲板高度；未命中返回 null（调用方走球面兜底）
  function plazaDeckPoint(right, fwd, lx, lz, up, out) {
    const { meshes, r } = plazaDeckInfo();
    if (!meshes.length) return null;
    _tmp.copy(up).multiplyScalar(r + 5).addScaledVector(right, lx).addScaledVector(fwd, lz);
    _plazaRay.set(_tmp, _tmpB.copy(up).multiplyScalar(-1));
    _plazaRay.far = 12;
    const hits = _plazaRay.intersectObjects(meshes, false);
    if (!hits.length) return null;
    return out.copy(hits[0].point);
  }
  // ---------- 圣城一带地表实测：行军贴地 + 台地台面/水面采样 ----------
  // 五层台地重建后，城堡局部坐标的旧 y 值整体失准：梯底/梯顶/驻守点/路口哨位
  // 全被埋进坡体或台地实体（「士兵走到草地就不见了」）。统一改为径向射线实测：
  //   可站立面 = contour-step 台地 + citadel-range 山体 + 星面 + 广场甲板
  //   涉水钳制 = citadel 系水面（护城河/接水湖），最多没腰，不没顶
  // 桩环境（测试）无任何命中网格 → citadelSurfaceR 返回 null，调用方走旧坐标兜底。
  const _marchRay = new THREE.Raycaster();
  _marchRay.far = 30;
  const _marchDir = new THREE.Vector3();
  const _marchO = new THREE.Vector3();
  const _marchNeg = new THREE.Vector3();
  let _groundSets = null; // { ground, water } | null（桩环境为 null）
  let _groundSetsAt = -Infinity; // 负结果也要短期缓存：桩环境每帧全场景重扫是主要热点
  function citadelGroundSets() {
    // 2 秒 TTL：编辑器热重建最多 2 秒内生效；桩环境则免去每帧全场景扫描
    if (simT - _groundSetsAt < 2) return _groundSets;
    _groundSetsAt = simT;
    const ground = [];
    const castle = scene.getObjectByName?.("castleContainer");
    if (castle) {
      castle.updateWorldMatrix(true, true);
      castle.traverse((o) => {
        if (
          o.isMesh
          && o.visible
          && ((o.name || "").startsWith("contour-step") || o.userData.isCitadelTerrain === true)
        ) ground.push(o);
      });
    }
    for (const n of ["citadel-range", "planet-surface"]) {
      const m = scene.getObjectByName?.(n);
      if (m && m.isMesh && m.visible) ground.push(m);
    }
    ground.push(...plazaDeckInfo().meshes);
    _groundSets = ground.length ? { ground, water: [] } : null;
    if (!_groundSets) return null;
    const water = [];
    scene.traverse?.((o) => {
      if (!o.isMesh || !o.visible) return;
      const n = o.name || "";
      if (n.startsWith("citadel-") && n.includes("water")) water.push(o);
    });
    _groundSets.water = water;
    return _groundSets;
  }
  /** pos 所在柱的最顶可站立面半径（无脚底偏移）；桩环境/无命中返回 null */
  function citadelSurfaceR(pos) {
    const sets = citadelGroundSets();
    if (!sets) return null;
    _marchDir.copy(pos).normalize();
    _marchO.copy(_marchDir).multiplyScalar(PLANET_RADIUS + 15);
    _marchRay.set(_marchO, _marchNeg.copy(_marchDir).multiplyScalar(-1));
    const hit = _marchRay.intersectObjects(sets.ground, false)[0];
    return hit ? hit.point.length() : null;
  }
  const _marchCache = new Map();
  /** 行军贴地半径：地表 +0.22 脚底偏移；遇水面时最多没腰（-0.6）。方向量化缓存。 */
  function siegeMarchGroundR(pos) {
    _marchDir.copy(pos).normalize();
    const sets = citadelGroundSets();
    if (!sets) return groundHeightAt(_marchDir); // 桩：苔庭采样/球面兜底
    const key = `${Math.round(_marchDir.x * 512)},${Math.round(_marchDir.y * 512)},${Math.round(
      _marchDir.z * 512
    )}`;
    let r = _marchCache.get(key);
    if (r === undefined) {
      if (_marchCache.size > 600) _marchCache.clear();
      _marchO.copy(_marchDir).multiplyScalar(PLANET_RADIUS + 15);
      _marchRay.set(_marchO, _marchNeg.copy(_marchDir).multiplyScalar(-1));
      const hit = _marchRay.intersectObjects(sets.ground, false)[0];
      r = hit ? hit.point.length() + 0.22 : PLANET_RADIUS + 0.3;
      if (sets.water.length) {
        const wh = _marchRay.intersectObjects(sets.water, false)[0];
        if (wh) r = Math.max(r, wh.point.length() - 0.6); // 涉水：胸部出水
      }
      _marchCache.set(key, r);
    }
    return r;
  }
  /** 城堡局部 (x,z) 柱的真实台面世界点；桩环境返回 null → 调用方用旧坐标兜底 */
  function groundAtLocal(x, z, lift = 0.05) {
    const p = castleLocalPoint(x, 0, z, new THREE.Vector3());
    const r = citadelSurfaceR(p);
    return r == null ? null : p.normalize().multiplyScalar(r + lift);
  }

  const _deckPt = new THREE.Vector3();
  function placeCohortOnPlaza(wave, centerDir, face) {
    surfaceBasis(centerDir, face, _up, _fwd, _right);
    const c = (GRID - 1) / 2;
    for (const s of wave.soldiers) {
      const lx = (s.userData.gx - c) * CELL + slotJitter(s.userData.gx, s.userData.gz, 0);
      const lz = (s.userData.gz - c) * CELL + slotJitter(s.userData.gx, s.userData.gz, 1);
      if (plazaDeckPoint(_right, _fwd, lx, -lz, _up, _deckPt)) {
        s.position.copy(_deckPt).addScaledVector(_up, 0.06);
      } else {
        // 甲板射线未命中（广场边缘/测试桩）：贴真实地形（圣城山脉+星面），
        // 不再用球面裸半径——坡地上会把士兵埋进黄土坡
        _tmp
          .copy(_up)
          .multiplyScalar(PLANET_RADIUS)
          .addScaledVector(_right, lx)
          .addScaledVector(_fwd, -lz);
        s.position.copy(_tmp.normalize()).multiplyScalar(siegeMarchGroundR(_tmp));
      }
      s.userData.formationPos = s.position.clone();
      s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
    }
    wave.cohort.visible = true; // 不藏战船：船就泊在广场水盆边
    emptyBoatCrew(wave.boat); // 士兵全部离船登岸 → 战船应为空船
  }

  function fireArrow(from, toAc) {
    root.userData._fireCalls = (root.userData._fireCalls || 0) + 1;
    logEvent("arrow", { from: from.userData.uid ?? 0, to: toAc?.userData?.uid ?? -1 });
    const a = arrows[arrowI % arrows.length];
    arrowI++;
    if (a.parent !== root) root.attach(a);
    a.userData.stuck = false;
    a.userData.miss = 0;
    a.visible = true;
    a.userData.fly = 0;
    a.userData.target = toAc;
    const nock = from.userData.equipment?.nockedArrow;
    if (nock) {
      nock.getWorldPosition(_tmp);
    } else {
      from.getWorldPosition(_tmp);
      from.getWorldQuaternion(_q);
      _tmp.add(_tmpB.set(0.25, 0.38, 0).applyQuaternion(_q));
    }
    a.position.copy(_tmp);
    from.getWorldQuaternion(_q);
    a.userData.arcUp.set(0, 1, 0).applyQuaternion(_q).normalize();
    // 目标点：成员当前位置 + 固定散布（世界偏移，随成员移动）
    toAc.getWorldPosition(_tmpB);
    a.userData.aimOff = new THREE.Vector3(
      (rand() - 0.5) * 6,
      (rand() - 0.5) * 3,
      (rand() - 0.5) * 6
    );
    _tmpB.add(a.userData.aimOff);
    a.userData.from.copy(a.position);
    a.userData.to.copy(_tmpB);
    _tmpB.sub(a.position);
    if (_tmpB.lengthSq() > 1e-8) {
      a.quaternion.setFromUnitVectors(_axisX, _tmpB.normalize());
    }
  }

  const _sparkTmp = new THREE.Vector3();
  const _smokeUp = new THREE.Vector3(0, 1, 0);

  function spawnSpark(worldPos) {
    const sp = sparkPool[sparkI % sparkPool.length];
    sparkI++;
    sp.visible = true;
    sp.position.copy(worldPos);
    sp.scale.setScalar(1.1 + rand() * 1.1);
    sp.userData.t = 0;
  }

  function spawnSmoke(worldPos) {
    const sm = smokePool[smokeI % smokePool.length];
    smokeI++;
    sm.visible = true;
    sm.position.copy(worldPos);
    sm.scale.setScalar(0.8 + rand() * 1.1);
    sm.userData.t = 0;
    sm.userData.up = worldPos.clone().normalize();
  }

  function updateArrows(dt) {
    for (const a of arrows) {
      if (!a.visible) continue;
      const u = a.userData;
      if (u.stuck) {
        // 扎在机身上的箭：微颤（受创感）
        if (u.wobble > 0) {
          u.wobble -= dt;
          a.position.x += Math.sin(u.wobble * 31) * 0.01 * u.wobble;
        }
        continue;
      }
      if (u.miss > 0) {
        // 脱靶：箭沿径向坠落（球面世界下坠方向 = 指向球心）
        u.miss += dt / 0.75;
        a.position.addScaledVector(
          _tmp.copy(a.position).normalize(),
          -dt * 5.5
        );
        a.rotation.x += dt * 4;
        const m = Math.min(1, u.miss);
        a.scale.setScalar(1 - m * 0.5);
        if (m >= 1) {
          a.visible = false;
          a.scale.setScalar(1);
        }
        continue;
      }
      // 追踪飞行：目标点每帧跟随成员（带滞后），箭弧优美追射
      const ac = u.target;
      let tgt = null;
      if (ac?.parent) {
        ac.getWorldPosition(_sparkTmp);
        if (u.aimOff) _sparkTmp.add(u.aimOff);
        u.to.lerp(_sparkTmp, Math.min(1, dt * 2.1));
        tgt = _sparkTmp;
      } else {
        u.miss = 0.01; // 目标没了：直接坠落
        continue;
      }
      u.fly += dt / 1.15;
      const p = Math.min(1, u.fly);
      a.position.lerpVectors(u.from, u.to, p);
      a.position.addScaledVector(u.arcUp, Math.sin(p * Math.PI) * 3.2);
      // 箭身顺飞行方向
      _tmp.copy(u.to).sub(u.from).normalize();
      a.quaternion.setFromUnitVectors(_axisX, _tmp);
      // 拖尾随速度轻微起伏（Bad North 朴素速度痕：短、淡、不发光）
      const trail = a.children.find((c) => c.userData?.isTrail) || a.getObjectByName?.("arrow-trail");
      if (trail?.material) trail.material.opacity = 0.1 + 0.2 * Math.sin(p * Math.PI);
      const trailCore = a.getObjectByName?.("arrow-trail-core");
      if (trailCore?.material) trailCore.material.opacity = 0.28 + 0.18 * Math.sin(p * Math.PI);
      // 代差感（主人 2026-09-05）：飞向先锋重甲兵的箭，大半在空中就被击碎——
      // 重甲对冷兵器不是"挨不挨得住"，是"根本近不了身"。
      if (
        !u.deflected && p >= 0.78 && ac?.parent &&
        ac.userData.unitClass === "vanguard-trooper" && rand() < 0.55
      ) {
        u.deflected = true;
        u.miss = 0.01;
        spawnSpark(a.position);
        root.userData.vanguardDeflects = (root.userData.vanguardDeflects || 0) + 1;
        logEvent("vanguardDeflect", { by: "arrow", uid: ac.userData.uid ?? 0, midair: true });
        continue;
      }
      if (p < 1) continue;
      // 落地判定：命中判定圈 = 成员半径（散布+滞后决定脱靶率）
      const tip = a.position.clone();
      const acPos = _sparkTmp.clone();
      // 判定圈按目标体型给：机队成员是庞然大物（4.8），先锋兵只有 1.45 高的人形，
      // 沿用 4.8 会变成"箭射到旁边也算中"，20 箭一次损伤的口径就名存实亡。
      const hitR = ac?.userData?.unitClass === "vanguard-trooper" ? 1.1 : 4.8;
      if (ac?.parent && tip.distanceTo(acPos) < hitR) {
        if (ac.userData.unitClass === "vanguard-trooper") {
          // 重甲代差：箭在甲面碎裂，从不钉进装甲。20 箭 = 1 次损伤的口径不变。
          u.miss = 0.01;
          spawnSpark(tip);
          root.userData.vanguardDeflects = (root.userData.vanguardDeflects || 0) + 1;
          logEvent("vanguardDeflect", { by: "arrow", uid: ac.userData.uid ?? 0, contact: true });
          const r = applyVanguardHit(ac, "arrow");
          if (r.wounded) {
            root.userData.vanguardWounds = (root.userData.vanguardWounds || 0) + 1;
            logEvent("vanguardWound", { uid: ac.userData.uid ?? 0, by: "arrow", life: r.life, dead: r.dead });
          }
          continue;
        }
        if (ac.userData.phalanxRole && shieldBlocksArrow(ac)) {
          // Bad North 盾挡箭：箭在盾面弹开、沿径向坠落，不计伤害
          u.miss = 0.01;
          spawnSpark(tip);
          continue;
        }
        // 命中：箭头扎进机体（随机姿态），计数 + 火花 + 烟 + 冲击
        ac.attach(a);
        u.stuck = true;
        u.wobble = 1.6 + rand() * 0.8;
        a.scale.setScalar(0.9 + rand() * 0.25);
        if (ac.userData.phalanxRole) applySoldierDamage(ac, "arrow"); // 攻城：士兵中箭
        else if (ac.userData.unitClass === "vanguard-trooper") {
          // 先锋兵：20 箭才算一次损伤（用户 2026-09-04 裁定的不对称口径）
          const r = applyVanguardHit(ac, "arrow");
          if (r.wounded) {
            root.userData.vanguardWounds = (root.userData.vanguardWounds || 0) + 1;
            logEvent("vanguardWound", { uid: ac.userData.uid ?? 0, by: "arrow", life: r.life, dead: r.dead });
          }
        } else {
          ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1; // 机队成员
          // 舰队受击警报（主人 2026-09-05）：红盔攻击莫比斯 aircraft → 泡机/艇/重甲兵
          // 全员立即参战，攻击打击机队的士兵
          vanguardAssault?.onFleetUnderAttack?.(ac, hubDir(_tmp).clone());
        }
        spawnSpark(tip);
        if (rand() < 0.5) spawnSmoke(tip);
      } else {
        u.miss = 0.01; // 脱靶：坠落
      }
    }
    // 火花/烟 寿命
    for (const sp of sparkPool) {
      if (!sp.visible) continue;
      sp.userData.t += dt;
      const e = Math.min(1, sp.userData.t / 0.28);
      sp.scale.multiplyScalar(1 + dt * 6);
      sp.material.opacity = 0.95 * (1 - e);
      if (e >= 1) sp.visible = false;
    }
    for (const sm of smokePool) {
      if (!sm.visible) continue;
      sm.userData.t += dt;
      const e = Math.min(1, sm.userData.t / 1.4);
      sm.position.addScaledVector(
        sm.userData.up || _smokeUp,
        dt * 1.6
      );
      sm.scale.multiplyScalar(1 + dt * 0.9);
      sm.material.opacity = 0.4 * (1 - e);
      if (e >= 1) sm.visible = false;
    }
  }

  // 投枪专用临时向量（与箭矢共用 _sparkTmp/_axisX，但飞行用独立向量避免互踩）
  const _jvTmpA = new THREE.Vector3();
  const _jvTmpB = new THREE.Vector3();
  const _jvUp = new THREE.Vector3(0, 1, 0);

  /** 长枪兵掷出手中的长枪（从枪尖所在的手位出手，飞向机队成员） */
  function throwJavelin(from, toAc) {
    logEvent("javelin", { from: from.userData.uid ?? 0, to: toAc?.userData?.uid ?? -1 });
    const j = javelins[javelinI % javelins.length];
    javelinI++;
    if (j.parent !== root) root.attach(j);
    j.userData.stuck = false;
    j.userData.miss = 0;
    j.visible = true;
    j.userData.fly = 0;
    j.userData.target = toAc;
    const spear = from.userData.equipment?.spear;
    if (spear) {
      spear.getWorldPosition(_tmp);
    } else {
      from.getWorldPosition(_tmp);
      from.getWorldQuaternion(_q);
      _tmp.add(_tmpB.set(0.3, 0.45, 0).applyQuaternion(_q));
    }
    j.position.copy(_tmp);
    from.getWorldQuaternion(_q);
    j.userData.arcUp.set(0, 1, 0).applyQuaternion(_q).normalize();
    toAc.getWorldPosition(_tmpB);
    j.userData.aimOff = new THREE.Vector3(
      (rand() - 0.5) * 6.4,
      (rand() - 0.5) * 3.2,
      (rand() - 0.5) * 6.4
    );
    _tmpB.add(j.userData.aimOff);
    j.userData.from.copy(j.position);
    j.userData.to.copy(_tmpB);
    _tmpB.sub(j.position);
    if (_tmpB.lengthSq() > 1e-8) {
      j.quaternion.setFromUnitVectors(_axisX, _tmpB.normalize());
    }
  }

  /** 投枪运动：追踪飞行（更重更慢、弧更高）→ 命中扎入机队 / 脱靶坠落 */
  function updateJavelins(dt) {
    for (const j of javelins) {
      if (!j.visible) continue;
      const u = j.userData;
      if (u.stuck) {
        if (u.wobble > 0) {
          u.wobble -= dt;
          j.position.x += Math.sin(u.wobble * 27) * 0.012 * u.wobble;
        }
        continue;
      }
      if (u.miss > 0) {
        u.miss += dt / 0.9;
        j.position.addScaledVector(_jvTmpA.copy(j.position).normalize(), -dt * 6);
        j.rotation.x += dt * 3;
        const m = Math.min(1, u.miss);
        j.scale.setScalar(1 - m * 0.5);
        if (m >= 1) {
          j.visible = false;
          j.scale.setScalar(1);
        }
        continue;
      }
      const ac = u.target;
      if (ac?.parent) {
        ac.getWorldPosition(_sparkTmp);
        if (u.aimOff) _sparkTmp.add(u.aimOff);
        u.to.lerp(_sparkTmp, Math.min(1, dt * 1.7));
      } else {
        u.miss = 0.01;
        continue;
      }
      u.fly += dt / 1.5;
      const p = Math.min(1, u.fly);
      j.position.lerpVectors(u.from, u.to, p);
      j.position.addScaledVector(u.arcUp, Math.sin(p * Math.PI) * 4.5);
      _jvTmpB.copy(u.to).sub(u.from).normalize();
      j.quaternion.setFromUnitVectors(_axisX, _jvTmpB);
      const trail = j.getObjectByName?.("javelin-trail");
      if (trail?.material) trail.material.opacity = 0.25 + 0.3 * Math.sin(p * Math.PI);
      if (p < 1) {
        // 标枪也会在半空被先锋兵的重甲/力场击碎（火更大，代差感更狠）
        if (
          !u.deflected && p >= 0.8 && ac?.parent &&
          ac.userData.unitClass === "vanguard-trooper" && rand() < 0.4
        ) {
          u.deflected = true;
          u.miss = 0.01;
          spawnSpark(j.position);
          if (rand() < 0.5) spawnSmoke(j.position);
          root.userData.vanguardDeflects = (root.userData.vanguardDeflects || 0) + 1;
          logEvent("vanguardDeflect", { by: "javelin", uid: ac.userData.uid ?? 0, midair: true });
        }
        continue;
      }
      const tip = j.position.clone();
      const acPos = _sparkTmp.clone();
      const jHitR = ac?.userData?.unitClass === "vanguard-trooper" ? 1.2 : 5.0;
      if (ac?.parent && tip.distanceTo(acPos) < jHitR) {
        if (ac.userData.unitClass === "vanguard-trooper") {
          // 重甲代差：标枪砸在装甲上弹碎，从不钉进去。10 支 = 1 次损伤口径不变。
          u.miss = 0.01;
          spawnSpark(tip);
          if (rand() < 0.6) spawnSmoke(tip);
          root.userData.vanguardDeflects = (root.userData.vanguardDeflects || 0) + 1;
          logEvent("vanguardDeflect", { by: "javelin", uid: ac.userData.uid ?? 0, contact: true });
          const r = applyVanguardHit(ac, "javelin");
          if (r.wounded) {
            root.userData.vanguardWounds = (root.userData.vanguardWounds || 0) + 1;
            logEvent("vanguardWound", { uid: ac.userData.uid ?? 0, by: "javelin", life: r.life, dead: r.dead });
          }
          continue;
        }
        ac.attach(j);
        u.stuck = true;
        u.wobble = 1.8 + rand() * 0.8;
        j.scale.setScalar(0.95 + rand() * 0.2);
        if (ac.userData.phalanxRole) {
          ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1; // 原行为：士兵扛标枪按箭账
        } else {
          // 舰队受击警报（主人 2026-09-05）：标枪命中莫比斯 aircraft → 全员参战
          ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1;
          vanguardAssault?.onFleetUnderAttack?.(ac, hubDir(_tmp).clone());
        }
        spawnSpark(tip);
        if (rand() < 0.6) spawnSmoke(tip);
      } else {
        u.miss = 0.01;
      }
    }
  }

  /** 方阵是否已整队成阵（运兵船全部下岸）——苔庭鲸以此作为升空循环条件 */
  function isAssembled() {
    if (phase === "siege" || phase === "siegeNight") return false;
    return (
      phase === "fight" ||
      garrison.length > 0 || // 电车运兵驻军也算就位（白天鲸可随时被扫描唤起）
      (shipIdx >= SHIP_COUNT && waves.length >= SHIP_COUNT && waves.every((w) => w.state !== "sailOut"))
    );
  }

  /** 硬重置（调试/热重载）：士兵撤阵清场，回到 atCastle 等下一轮鼓息运兵 */
  function resetBattle() {
    detachRopes();
    resetFightFormation();
    clearRedGarrison();
    for (const s of harborCombatInside) {
      if (s?.userData) {
        s.userData.harborCombat = false;
        s.userData.harborCombatIntent = null;
        s.userData.harborCombatTargetUid = null;
      }
    }
    harborCombatInside.clear();
    harborCombatEntered.clear();
    harborCombat.active = false;
    harborCombat.redEntered = 0;
    harborCombat.engagements = 0;
    harborCombat.lastAttackerUid = null;
    harborCombat.lastDefenderUid = null;
    siegeNightT = 0;
    root.userData.siegeAssaultBgm = false;
    setSiegeAssaultBgm(false, { fade: 0.4 });
    for (const w of waves) {
      root.remove(w.boat);
      root.remove(w.cohort);
    }
    waves.length = 0;
    shipIdx = 0;
    setPhase("atCastle");
    quietT = 0;
    for (const g of garrison) {
      for (const s of g.soldiers) root.remove(s);
    }
    garrison.length = 0;
    for (const a of arrows) {
      if (a.parent && a.parent !== root) a.parent.remove(a);
      a.visible = false;
      a.userData.stuck = false;
    }
    for (const j of javelins) {
      if (j.parent && j.parent !== root) j.parent.remove(j);
      j.visible = false;
      j.userData.stuck = false;
    }
    for (const sp of sparkPool) sp.visible = false;
    for (const sm of smokePool) sm.visible = false;
  }

  // ---------- 白天源源不断的运兵（电车下车 + 战船补给） ----------
  // 鼓声只控制故事大波次；白天（鼓息）苔庭驻军由两条补给线持续补充：
  //  - 有轨电车掠过苔庭附近（~27 单位航线）时，士兵下车步行入阵；
  //  - 故事部署期（下岸整队后）战船每 ~30s 补一小队（3×3）。
  const GARRISON_SQUAD = 5;
  const GARRISON_CAP = 16; // 源源不断：环绕苔庭两圈（12+4 槽）
  const TRAM_DROP_RADIUS = 42;
  const TRAM_CHECK_INTERVAL = 3;
  const REINFORCE_INTERVAL = 30;
  const RING_PER_RING = 12; // 每圈槽位数
  const RING_BASE_RADIUS = 12; // 内圈半径（半尺寸苔庭板缘 ~6.25 之外）
  const RING_STEP = 4; // 外圈每圈外扩
  const garrison = [];
  let nextTramDrop = 5;
  let nextReinforce = 20;
  let waveSerial = 100;
  let ringCursor = 0; // 槽位游标：黄金角散列 → 排布永不重复
  const landingWorld = landDir.clone().multiplyScalar(PLANET_RADIUS);
  const ringNorth = new THREE.Vector3().crossVectors(landDir, east).normalize();

  /** 环绕苔庭的槽位方向：黄金角散列 + 逐圈外扩，永不重复 */
  function ringSlotDir(index, out) {
    const ring = (index / RING_PER_RING) | 0;
    const i = index % RING_PER_RING;
    const angle = i * 2.399963 + ring * 0.31; // 黄金角
    const radius = RING_BASE_RADIUS + ring * RING_STEP;
    const d = radius / PLANET_RADIUS;
    return out
      .copy(landDir)
      .multiplyScalar(Math.cos(d))
      .addScaledVector(east, Math.cos(angle) * Math.sin(d))
      .addScaledVector(ringNorth, Math.sin(angle) * Math.sin(d))
      .normalize();
  }

  function slerpDir(a, b, t, out) {
    const omega = a.angleTo(b);
    if (omega < 1e-5) return out.copy(a);
    const so = Math.sin(omega);
    return out
      .copy(a)
      .multiplyScalar(Math.sin((1 - t) * omega) / so)
      .addScaledVector(b, Math.sin(t * omega) / so)
      .normalize();
  }

  function spawnGarrisonSquad(fromWorld) {
    // 环绕苔庭槽位：黄金角散列，每个小队一个不重复的位置
    const slotIndex = ringCursor++;
    const slotDir = ringSlotDir(slotIndex, new THREE.Vector3());
    surfaceBasis(slotDir, landDir, _up, _fwd, _right);
    // spawnSoldier 内部会用模块临时向量（弓循环等），先拷出基向量
    const rightN = _right.clone();
    const fwdN = _fwd.clone();
    const soldiers = [];
    for (let i = 0; i < GARRISON_SQUAD; i++) {
      const s = spawnSoldier(i < 3 ? "longbow" : i < 4 ? "gladius" : "spear");
      const offR = (i - 2) * 0.8;
      const offF = ((i % 2) - 0.5) * 0.8;
      // 下车点贴地（电车在轨上，士兵落到地面后步行）
      const fromDir = fromWorld.clone().normalize();
      const from = fromDir
        .clone()
        .multiplyScalar(PLANET_RADIUS + groundLift(fromDir))
        .addScaledVector(rightN, offR)
        .addScaledVector(fwdN, offF);
      // 目标 = 槽位 + 队内偏移
      const target = slotDir
        .clone()
        .multiplyScalar(PLANET_RADIUS + groundLift(slotDir))
        .addScaledVector(rightN, offR)
        .addScaledVector(fwdN, offF);
      s.userData.garrisonFrom = from.clone();
      s.userData.garrisonTo = target.clone();
      s.userData.formationPos = target.clone(); // 鲸起时的归位点
      s.userData.garrisonSeed = (slotIndex * GARRISON_SQUAD + i + 1) * 17;
      s.position.copy(from);
      root.add(s);
      soldiers.push(s);
    }
    garrison.push({ soldiers, u: 0, index: slotIndex });
  }

  function tryTramDrop() {
    if (garrison.length >= GARRISON_CAP) return;
    const tram = typeof getTram === "function" ? getTram() : null;
    const cars = [tram?.redTram, tram?.blueTram].filter((c) => c?.parent);
    if (!cars.length) return;
    let best = null;
    let bestD = Infinity;
    for (const car of cars) {
      car.getWorldPosition(_tmpB);
      const d = _tmpB.distanceTo(landingWorld);
      if (d < bestD) {
        bestD = d;
        best = _tmpB.clone();
      }
    }
    if (!best || bestD > TRAM_DROP_RADIUS) return;
    spawnGarrisonSquad(best);
  }

  /** 苔庭内随机巡查点（地壳板 25×14 内缩） */
  function patrolPoint(out) {
    const lx = (rand() - 0.5) * 22;
    const lz = (rand() - 0.5) * 11;
    return out
      .copy(landDir)
      .addScaledVector(east, lx / PLANET_RADIUS)
      .addScaledVector(ringNorth, lz / PLANET_RADIUS)
      .normalize()
      .multiplyScalar(PLANET_RADIUS + groundLift(out));
  }

  /**
   * 地面抬升：苔庭地壳板（含苔丘，板面 R+0.3 + 苔 0.1）上的士兵站到苔面上，
   * 板外贴地（R+0.08）——草坪不能埋住士兵。
   * @param {THREE.Vector3} dir 球面方向（单位向量）
   */
  // ---------- 真实地形采样：士兵站在苔丘/地壳板/星面之上 + 脚底偏移 ----------
  // 苔庭周围是起伏苔丘（mossyGround bump），球面固定高度会把士兵埋进丘里。
  // 从上方沿径向向下射线，命中最近地面网格取真实高度；同一位置缓存（地形静态）。
  const groundMeshes = [];
  let groundCollected = false;
  const groundCache = new Map();
  const _groundRay = new THREE.Raycaster();
  function groundHeightAt(dir) {
    const key = `${(dir.x * 8192) | 0},${(dir.y * 8192) | 0},${(dir.z * 8192) | 0}`;
    const cached = groundCache.get(key);
    if (cached !== undefined) return cached;
    if (groundCache.size > 800) groundCache.clear();
    if (!groundCollected) {
      groundCollected = true;
      scene.traverse((o) => {
        if (!o.isMesh || !o.raycast || !o.visible) return;
        const n = o.name || "";
        const pn = o.parent?.name || "";
        if (
          n === "planet-surface" ||
          n === "mossy-terrain" ||
          n === "leviathan-crust-plate" ||
          n === "leviathan-terrain-topography" ||
          n.startsWith("leviathan-moss-bed") ||
          pn === "mossyGround"
        ) {
          groundMeshes.push(o);
        }
      });
    }
    _groundRay.set(
      dir.clone().multiplyScalar(PLANET_RADIUS + 14),
      dir.clone().multiplyScalar(-1)
    );
    const hits = _groundRay.intersectObjects(groundMeshes, false);
    let h = PLANET_RADIUS + 0.08;
    if (hits.length) h = hits[0].point.length();
    h += 0.22; // 脚底偏移（地面之上）
    groundCache.set(key, h);
    return h;
  }

  function groundLift(dir) {
    return groundHeightAt(dir) - PLANET_RADIUS;
  }

  /**
   * 落位士兵的两态行为：
   *  - 鲸未升起：在苔庭内分散巡查（随机漫步点，人人相位不同）；
   *  - 鲸升起：告警整队——长弓手奔向北翼两列、矛/盾结成护壁（整理队伍）。
   * @param {THREE.Object3D} s 士兵（须已存 formationPos = 阵位）
   */
  function patrolSoldier(s, dt, whaleUp) {
    if (!s.userData.formationPos) return;
    // 战斗期（fightFormed 在拔河全程锁定，鲸被拽到半空也保持列阵）或鲸起
    const inFight = whaleUp || fightFormed;
    const u = s.userData.patrol || (s.userData.patrol = {
      t: 0,
      wait: 4 + rand() * 5,
      from: null,
      to: null,
      returning: false,
    });
    if (inFight) {
      if (!u.returning) {
        u.returning = true;
        u.t = 0;
        u.from = s.position.clone();
      }
      // 目标：战斗站位（长弓两列 / 矛盾护壁）；未分配则先分配
      if (!s.userData.fightPos) assignFightStation(s);
      const goal = s.userData.fightPos || s.userData.formationPos;
      const dist = u.from.distanceTo(goal);
      u.t = Math.min(1, u.t + dt / Math.max(5, dist * 0.32)); // 告警奔跑列阵
      const e = u.t * u.t * (3 - 2 * u.t);
      slerpDir(
        u.from.clone().normalize(),
        goal.clone().normalize(),
        e,
        _tmp
      );
      _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
      s.position.copy(_tmp);
      // 行军时面向目的地；到站后姿态交给射击循环（仰望机队）——
      // 不再每帧整设，否则会把射手的仰射姿态打回水平（长弓手瞄地）
      if (u.t < 1) {
        surfaceBasis(_tmp.normalize(), landDir, _up, _fwd, _right);
        s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      }
      return;
    }
    u.returning = false;
    u.t += dt;
    if (!u.to || u.t >= u.wait) {
      u.t = 0;
      u.wait = 4 + rand() * 5;
      u.from = s.position.clone();
      patrolPoint((u.to = u.to || new THREE.Vector3()));
    }
    const e = Math.min(1, u.t / Math.max(1, u.wait));
    slerpDir(u.from.clone().normalize(), u.to.clone().normalize(), e, _tmp);
    _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
    s.position.copy(_tmp);
    surfaceBasis(_tmp.normalize(), u.to.clone().normalize(), _up, _fwd, _right);
    s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
  }

  // ---------- 战斗列阵：告警后长弓北翼两列、矛/盾护壁（整理队伍） ----------
  // 鲸身总长 72（半长 36）、半宽 17.6：战斗列阵必须排在鲸身侧缘之外，
  // 北翼（ringNorth）距中心 19/22 两列长弓、27/30 两行护壁，全部面向盘顶机队。
  const FIGHT_LINE_Y = [19, 22]; // 长弓两列（北距）
  const FIGHT_LINE_X = 24; // 列半宽
  const FIGHT_LINE_SPACE = 2.4;
  const FIGHT_SHIELD_Y = [27, 30]; // 矛/盾两行
  const FIGHT_SHIELD_X = 30;
  const FIGHT_SHIELD_SPACE = 3.0;
  let fightSlotLongbow = 0;
  let fightSlotShield = 0;
  let fightFormed = false;

  function fightStationDir(slotIdx, role, out) {
    let y, x;
    if (role === "longbow") {
      const perCol = Math.floor((FIGHT_LINE_X * 2) / FIGHT_LINE_SPACE) + 1; // 21
      const col = Math.min(FIGHT_LINE_Y.length - 1, (slotIdx / perCol) | 0);
      const i = slotIdx % perCol;
      y = FIGHT_LINE_Y[col];
      x = -FIGHT_LINE_X + i * FIGHT_LINE_SPACE;
    } else {
      const perRow = Math.floor((FIGHT_SHIELD_X * 2) / FIGHT_SHIELD_SPACE) + 1; // 21
      const row = Math.min(FIGHT_SHIELD_Y.length - 1, (slotIdx / perRow) | 0);
      const i = slotIdx % perRow;
      y = FIGHT_SHIELD_Y[row];
      x = -FIGHT_SHIELD_X + i * FIGHT_SHIELD_SPACE;
    }
    const r = Math.sqrt(x * x + y * y);
    const d = r / PLANET_RADIUS;
    return out
      .copy(landDir)
      .multiplyScalar(Math.cos(d))
      .addScaledVector(east, (x / r) * Math.sin(d))
      .addScaledVector(ringNorth, (y / r) * Math.sin(d))
      .normalize();
  }

  function assignFightStation(s) {
    const role = s.userData.phalanxRole;
    const isBow = role === "longbow";
    const dir = fightStationDir(
      isBow ? fightSlotLongbow++ : fightSlotShield++,
      isBow ? "longbow" : "shield",
      new THREE.Vector3()
    );
    s.userData.fightPos = dir
      .clone()
      .multiplyScalar(PLANET_RADIUS + 0.08);
    s.userData.fightSlot = isBow ? fightSlotLongbow : fightSlotShield;
  }

  function resetFightFormation() {
    fightFormed = false;
    fightSlotLongbow = 0;
    fightSlotShield = 0;
  }

  function castleOffsetDir(e, n, out = new THREE.Vector3()) {
    return out
      .copy(castleDir)
      .addScaledVector(castleEast, e)
      .addScaledVector(castleNorth, n)
      .normalize();
  }

  function readTimeOfDay() {
    if (typeof getTimeOfDay === "function") {
      const v = Number(getTimeOfDay());
      if (Number.isFinite(v)) return ((v % 1) + 1) % 1;
    }
    const v = Number(P.timeOfDay);
    return Number.isFinite(v) ? ((v % 1) + 1) % 1 : 0.45;
  }

  function clearRedGarrison() {
    if (redRoot) {
      root.remove(redRoot);
      redRoot = null;
    }
    redSoldiers.length = 0;
    // 红盔援军战船一并清场
    for (const rs of redShips) root.remove(rs.boat);
    redShips.length = 0;
    redReinforceT = 0;
    // 木马巡查兵一并清场（reset/新一轮攻城）
    if (patrolRoot) {
      root.remove(patrolRoot);
      patrolRoot = null;
    }
    trojanPatrol.length = 0;
    stragglersMarked = false;
    // 攻城梯一并清场（reset/新一轮攻城）
    if (ladderRoot) {
      root.remove(ladderRoot);
      ladderRoot = null;
    }
    siegeLadders.length = 0;
    siegeStairRoutes.length = 0;
    siegeGatherT = 0;
    siegeElapsed = 0;
    siegeForceDay = false;
    if (castleObj?.userData) {
      castleObj.userData.capturedFloors = [];
      castleObj.userData.capturedTopFloor = -1;
    }
  }

  function isSiegeLadderAvailable(lane) {
    return !!(
      lane?.group?.parent &&
      lane.group.visible !== false &&
      ladderRoot?.visible !== false
    );
  }

  function hasAvailableSiegeLadder() {
    return siegeLadders.some(isSiegeLadderAvailable);
  }

  function markCastleFloorCaptured(floorIndex) {
    if (!castleObj?.userData || !Number.isFinite(floorIndex)) return;
    const floors = new Set(Array.isArray(castleObj.userData.capturedFloors)
      ? castleObj.userData.capturedFloors
      : []);
    floors.add(floorIndex | 0);
    castleObj.userData.capturedFloors = [...floors].sort((a, b) => a - b);
    castleObj.userData.capturedTopFloor = Math.max(
      Number(castleObj.userData.capturedTopFloor ?? -1),
      floorIndex | 0
    );
    logEvent("castleFloorCaptured", {
      floor: floorIndex | 0,
      capturedFloors: castleObj.userData.capturedFloors.slice(),
    });
  }

  // ---------- 瀑布攻城梯：架在层叠瀑布缺口（圣城局部 +Z 扇区）， ----------
  // ---------- 蓝盔中央突破后由此登上一层台地（最外圈建筑层） ----------
  function createSiegeLadder(len) {
    const g = new THREE.Group();
    g.name = "siege-ladder";
    const wood = new THREE.MeshToonMaterial({
      color: isCitadelPaletteV3() ? v3TokenInt("shipDeckWood") : 0x8a5a33,
    });
    const railGeo = new THREE.BoxGeometry(0.09, len, 0.09);
    for (const sx of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(railGeo, wood);
      rail.position.x = sx;
      g.add(rail);
    }
    const rungGeo = new THREE.BoxGeometry(0.62, 0.07, 0.07);
    const n = Math.max(4, Math.floor(len / 0.42));
    for (let i = 0; i < n; i++) {
      const rung = new THREE.Mesh(rungGeo, wood);
      rung.position.y = -len / 2 + 0.24 + (i * (len - 0.48)) / (n - 1);
      g.add(rung);
    }
    g.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    return g;
  }

  function spawnSiegeLadders() {
    if (ladderRoot) return;
    ladderRoot = new THREE.Group();
    ladderRoot.name = "siege-ladders";
    root.add(ladderRoot);
    if (ladderPolicyDisabled) {
      ladderRoot.userData.disabled = true;
      ladderRoot.userData.policy = latestAssault?.ladderPolicy ?? "disabled";
      ladderRoot.userData.waterfallCoverage = [];
      ladderRoot.userData.destination = latestAssault?.destination ?? "legacy-terraces";
      spawnWaterfallClimbs();
      spawnSiegeStairRoutes();
      logEvent("ladders", {
        count: 0,
        waterfalls: [],
        disabled: true,
        destination: ladderRoot.userData.destination,
      });
      return;
    }
    const _axisY = new THREE.Vector3(0, 1, 0);
    if (latestAssault && !ladderPolicyDisabled) {
      const lanes = Array.isArray(latestAssault.ladderLanes)
        ? latestAssault.ladderLanes.slice(0, SIEGE_LADDER_COUNT)
        : [];
      ladderRoot.userData.waterfallCoverage = [];
      ladderRoot.userData.destination = "castle-top";
      ladderRoot.userData.routeSystem = "mountain-valley-assault";
      for (let i = 0; i < lanes.length; i++) {
        const laneSpec = lanes[i];
        const base = latestAssaultPoint(laneSpec.base);
        const top = latestAssaultPoint(laneSpec.top);
        const capture = latestAssaultPoint(laneSpec.capture);
        if (!base || !top || !capture) continue;
        const len = base.distanceTo(top) + 0.5;
        const ladder = createSiegeLadder(len);
        ladder.name = laneSpec.id || `castle-top-ladder-${i}`;
        ladder.position.copy(base).lerp(top, 0.5);
        ladder.quaternion.setFromUnitVectors(_axisY, _tmp.copy(top).sub(base).normalize());
        ladder.userData.destination = "castle-top";
        ladder.userData.routeSystem = "mountain-valley-assault";
        ladder.userData.laneIndex = i;
        ladderRoot.add(ladder);
        siegeLadders.push({
          group: ladder,
          base,
          top,
          capture,
          x: Number(laneSpec.top?.[0]) || 0,
          destination: "castle-top",
          laneIndex: i,
        });
      }
      spawnSiegeStairRoutes();
      logEvent("ladders", {
        count: siegeLadders.length,
        waterfalls: [],
        destination: "castle-top",
      });
      return;
    }
    const cascadeRoot = scene.getObjectByName("citadel-pilgrimage-layered-cascades");
    const cascades = new Map();
    for (const waterfall of cascadeRoot?.children || []) {
      const sequence = Number(waterfall.userData?.sequence);
      if (Number.isInteger(sequence)) cascades.set(sequence, waterfall);
    }
    const usedPerCascade = new Map();
    const fallbackPoint = (x, z, lift) =>
      groundAtLocal(x, z, lift) || castleLocalPoint(x, lift, z, new THREE.Vector3());
    ladderRoot.userData.waterfallCoverage = [];
    for (let i = 0; i < SIEGE_LADDER_COUNT; i++) {
      const cascadeSequence = SIEGE_LADDER_CASCADE_SEQUENCE[i];
      const waterfall = cascades.get(cascadeSequence);
      const slot = usedPerCascade.get(cascadeSequence) || 0;
      usedPerCascade.set(cascadeSequence, slot + 1);
      const slotCount = SIEGE_LADDER_CASCADE_SEQUENCE.filter((s) => s === cascadeSequence).length;
      const sideOffset = (slot - (slotCount - 1) * 0.5) * 0.78;
      let x = 0.6 + i * 2.0;
      let base;
      let top;
      let capture;
      let captureX = x;
      let captureZ = 19.6;

      if (waterfall) {
        // 瀑布组原点就是该落差的下游水面；actualDrop 是严格的相邻台地落差。
        waterfall.updateWorldMatrix(true, false);
        const waterfallBase = waterfall.getWorldPosition(new THREE.Vector3());
        const drop = Math.max(1.2, Number(waterfall.userData?.actualDrop) || 4);
        base = waterfallBase
          .clone()
          .addScaledVector(castleUpWorld, 0.12)
          .addScaledVector(castleEast, sideOffset);
        top = waterfallBase
          .clone()
          .addScaledVector(castleUpWorld, drop + 0.28)
          .addScaledVector(castleEast, sideOffset);
        const rangeLocal = waterfall.userData?.rangeLocal;
        if (rangeLocal) {
          x = rangeLocal.lx + sideOffset;
          captureX = x;
          captureZ = rangeLocal.lz - 2.1;
          capture = fallbackPoint(captureX, captureZ, 0.05);
        }
        if (!capture) capture = top.clone().addScaledVector(castleFwdWorld, -2.1);
      } else {
        // 桩环境/旧场景没有瀑布组时，仍按同一四层拓扑生成可测试的兜底梯位。
        const upper = CITADEL_CASCADE_POOL_SPECS[cascadeSequence];
        const lower = CITADEL_CASCADE_POOL_SPECS[cascadeSequence + 1];
        const centerX = upper && lower ? (upper.x + lower.x) * 0.5 : x;
        const centerZ = upper && lower ? (upper.z + lower.z) * 0.5 + 0.3 : 22.0;
        x = centerX + sideOffset;
        captureX = x;
        const baseZ = centerZ + (lower?.rz ?? 2.4) * 0.62;
        const topZ = centerZ - (upper?.rz ?? 2.1) * 0.62;
        captureZ = topZ - Math.max(1.4, (upper?.rz ?? 2.1) * 0.75);
        base = fallbackPoint(x, baseZ, 0.02);
        top = fallbackPoint(x, topZ, 0.05);
        capture = fallbackPoint(captureX, captureZ, 0.05);
      }
      const len = base.distanceTo(top) + 0.5;
      const ladder = createSiegeLadder(len);
      ladder.position.copy(base).lerp(top, 0.5);
      ladder.quaternion.setFromUnitVectors(_axisY, _tmp.copy(top).sub(base).normalize());
      ladder.userData.cascadeSequence = cascadeSequence;
      ladder.userData.upperTerraceIndex = cascadeSequence;
      ladder.userData.lowerTerraceIndex = cascadeSequence + 1;
      ladder.userData.localX = x;
      ladder.userData.captureX = captureX;
      ladder.userData.captureZ = captureZ;
      ladderRoot.add(ladder);
      siegeLadders.push({
        group: ladder,
        base,
        top,
        capture,
        x,
        cascadeSequence,
        upperTerraceIndex: cascadeSequence,
        lowerTerraceIndex: cascadeSequence + 1,
      });
      if (!ladderRoot.userData.waterfallCoverage.includes(cascadeSequence)) {
        ladderRoot.userData.waterfallCoverage.push(cascadeSequence);
      }
    }
    ladderRoot.userData.waterfallCoverage.sort((a, b) => a - b);
    logEvent("ladders", {
      count: siegeLadders.length,
      waterfalls: ladderRoot.userData.waterfallCoverage.slice(),
    });
    spawnWaterfallClimbs();
    spawnSiegeStairRoutes();
  }

  // 瀑布攀爬道：沿层叠瀑布水帘（x≈2.4 水道）的徒手上攀线，与攻城梯共用
  // 台面射线校正逻辑；无实体梯子——士兵直接在瀑布里攀，更慢更危险
  function spawnWaterfallClimbs() {
    if (siegeWaterfallClimbs.length) return;
    if (latestAssault) {
      logEvent("waterfallClimbs", {
        count: 0,
        disabled: true,
        reason: "latest-design-has-no-waterfalls",
      });
      return;
    }
    for (let i = 0; i < WATERFALL_CLIMB_LANES; i++) {
      const x = 1.3 + i * 1.1; // 瀑布水道内（攻城梯间隙偏水帘侧，层叠梯湖 x≈2.2~2.6）
      const base = castleLocalPoint(x, 0.05, 26.2, new THREE.Vector3());
      const top = castleLocalPoint(x, 2.2, 23.2, new THREE.Vector3()); // 一层台地顶沿
      const capture = castleLocalPoint(x * 1.25, 2.25, 19.6, new THREE.Vector3()); // 台地建筑旁
      const gBase = groundAtLocal(x, 25.2, 0.02); // 四层梯湖水潭边，涉水起攀
      if (gBase) base.copy(gBase);
      let gTop = null;
      for (const z of [20.2, 19.6, 19.0]) {
        const g = groundAtLocal(x, z, 0.05);
        if (g && (!gTop || g.length() > gTop.length())) gTop = g;
      }
      if (gTop) top.copy(gTop);
      const gCap = groundAtLocal(x * 1.25, 19.2, 0.05);
      if (gCap) capture.copy(gCap);
      siegeWaterfallClimbs.push({ base, top, capture, x });
    }
    logEvent("waterfallClimbs", { count: siegeWaterfallClimbs.length });
  }

  // 真实朝圣石阶路线：直接复用 citadelRange 的 walkFlights，和碰撞/视觉
  // 使用同一组 rho、from/to、yA/yB 参数。士兵逐点走过每一段，而不是把
  // 位置从地面直线插值到高台，因此没有攻城梯时也不会悬空穿过台地。
  function spawnSiegeStairRoutes() {
    if (siegeStairRoutes.length) return;
    if (latestAssault) {
      const points = (latestAssault.stairRoute || [])
        .map((tuple) => latestAssaultPoint(tuple))
        .filter(Boolean);
      const floorRoutes = [];
      for (const route of latestAssault.interiorFloorRoutes || []) {
        const routePoints = (route.points || [])
          .map((tuple) => latestAssaultPoint(tuple))
          .filter(Boolean);
        if (!routePoints.length) continue;
        const start = points.length;
        points.push(...routePoints);
        floorRoutes.push({
          floor: Number(route.floor) || 0,
          start,
          end: points.length - 1,
          surface: route.surface || "interior-rotating-stairs",
        });
      }
      const capture = latestAssaultPoint(latestAssault.keepTop)
        || points.at(-1)?.clone();
      if (points.length && capture) {
        siegeStairRoutes.push({
          points,
          base: points[0].clone(),
          top: points.at(-1).clone(),
          capture,
          terraces: [],
          destination: "castle-top",
          routeSystem: "mountain-valley-assault",
          captureMode: latestAssault.captureMode || "interior-rotating-stairs",
          floorRoutes,
        });
      }
      logEvent("stairs", {
        routes: siegeStairRoutes.length,
        points: points.length,
        terraces: [],
        destination: "castle-top",
        floorRoutes: floorRoutes.map((route) => ({ floor: route.floor, start: route.start, end: route.end })),
      });
      return;
    }
    const flights = citadelWalkFlights();
    const metrics = citadelWalkMetrics();
    const points = [];
    const terraces = [];
    const sampleCount = 8;
    const hasStairGeometry = !!scene.getObjectByName?.("winding-pilgrimage-ramp");
    for (const flight of flights) {
      if (!flight || !Number.isFinite(flight.rho)) continue;
      for (let i = 0; i < sampleCount; i++) {
        const t = sampleCount === 1 ? 0 : i / (sampleCount - 1);
        const phi = THREE.MathUtils.lerp(flight.from, flight.to, t);
        const localY = THREE.MathUtils.lerp(flight.yA, flight.yB, t) + 0.22;
        const localX = flight.rho * Math.sin(phi);
        const localZ = flight.rho * Math.cos(phi);
        const rawPoint = castleLocalPoint(localX, localY, localZ, new THREE.Vector3());
        // 没有真实城堡网格的回放桩只剩 planet-surface；将路线投影到可行走
        // 表面，避免 siegeMarchGroundR 把局部高程点反复拉回另一条半径。
        const point = !hasStairGeometry
          ? groundAtLocal(localX, localZ, 0.22) || rawPoint
          : rawPoint;
        if (!points.length || points[points.length - 1].distanceTo(point) > 0.05) {
          points.push(point);
          terraces.push(flight.terraceIndex);
        }
      }
    }
    // 桩场景或旧存档可能没有 walkFlights；仍给寻路一个可行的逐段坡道，
    // 这样“删掉攻城梯”不会退化成士兵永远停在广场。
    if (!points.length) {
      const fallback = [
        [5.8, 0.22, 28.0],
        [5.0, 1.1, 24.8],
        [4.2, 2.0, 21.8],
        [3.4, 2.9, 18.9],
        [2.4, 3.8, 15.8],
        [0.0, 4.7, 9.9],
      ];
      for (const [x, y, z] of fallback) {
        points.push(castleLocalPoint(x, y, z, new THREE.Vector3()));
        terraces.push(-1);
      }
    }
    const topMetric = metrics[0];
    const capture = castleLocalPoint(
      0,
      (topMetric?.top ?? 4.7) + 0.22,
      9.9,
      new THREE.Vector3()
    );
    siegeStairRoutes.push({
      points,
      base: points[0].clone(),
      top: points[points.length - 1].clone(),
      capture,
      terraces,
    });
    logEvent("stairs", {
      routes: siegeStairRoutes.length,
      points: points.length,
      terraces: [...new Set(terraces.filter((n) => n >= 0))],
    });
  }

  // 指定世界坐标生成一名红盔守军（攻城梯顶部/台地高处的防守哨位）
  function spawnRedAt(role, worldPos, faceWorld) {
    const s = spawnSoldier(role);
    paintSoldierHelm(s, "red");
    s.userData.dead = false;
    s.userData.downed = false;
    s.userData.arrowHits = 0;
    s.userData.meleeHits = 0;
    s.userData._meleeCd = 0;
    s.userData.gx = 0;
    s.userData.gz = 0;
    s.position.copy(worldPos);
    _up.copy(castleUpWorld);
    _fwd.copy(faceWorld).addScaledVector(_up, -faceWorld.dot(_up));
    if (_fwd.lengthSq() < 1e-8) _fwd.copy(castleFwdWorld);
    _fwd.normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _fwd.crossVectors(_right, _up).normalize();
    s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
    s.userData.holdPos = worldPos.clone(); // 防守哨位：不追击，贴身才还击
    redRoot.add(s);
    redSoldiers.push(s);
    return s;
  }

  // 移动朝向（近圣城区域用球面法向近似即可，台地高差相对半径可忽略）
  function faceMoving(s, moveDir, k = 0.14) {
    _up.copy(s.position).normalize();
    _fwd.copy(moveDir).addScaledVector(_up, -moveDir.dot(_up));
    if (_fwd.lengthSq() < 1e-8) return;
    _fwd.normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _fwd.crossVectors(_right, _up).normalize();
    s.quaternion.slerp(_q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)), k);
  }

  // 身体朝向和武器朝向是两件事：士兵模型会先转身，但短剑/长枪仍挂在
  // 纸偶局部坐标里。近战锁定时把武器的握持轴（模型局部 +Y）转向目标，
  // 避免出现“人已经面对敌人，枪尖/剑刃却斜向别处”的视觉错误。
  function aimCombatToolAt(s, target, strength = 0.72) {
    if (!s || !target) return;
    const equipment = s.userData?.equipment || {};
    const tool =
      equipment.spear?.visible !== false
        ? equipment.spear
        : equipment.gladius?.visible !== false
          ? equipment.gladius
          : null;
    if (!tool?.parent) return;
    target.getWorldPosition(_toolTarget);
    tool.getWorldPosition(_toolOrigin);
    _toolDir.copy(_toolTarget).sub(_toolOrigin);
    if (_toolDir.lengthSq() < 1e-8) return;
    _toolDir.normalize();
    tool.parent.getWorldQuaternion(_toolParentQ).invert();
    _toolDir.applyQuaternion(_toolParentQ).normalize();
    _toolAimQ.setFromUnitVectors(_toolAxis, _toolDir);
    tool.quaternion.slerp(
      _toolAimQ,
      THREE.MathUtils.clamp(strength, 0, 1)
    );
    s.userData.combatTargetUid = target.userData?.uid ?? null;
  }

  function faceCombatTarget(s, target, strength = 0.5) {
    if (!s || !target) return;
    target.getWorldPosition(_toolTarget);
    s.getWorldPosition(_toolOrigin);
    _toolDir.copy(_toolTarget).sub(_toolOrigin);
    if (_toolDir.lengthSq() < 1e-8) return;
    faceMoving(s, _toolDir, strength);
    s.userData.combatTargetUid = target.userData?.uid ?? null;
  }

  function resolveOldHarborGroup() {
    const ref = typeof getOldHarbor === "function" ? getOldHarbor() : oldHarbor;
    const group = ref?.group || ref || scene?.getObjectByName?.("old-harbor-scene");
    if (!group?.isObject3D) return null;
    group.updateWorldMatrix(true, false);
    return group;
  }

  function isInsideOldHarbor(s, group) {
    if (!s || !group) return false;
    s.getWorldPosition(_tmp);
    group.worldToLocal(_tmpB.copy(_tmp));
    const zone = group.userData?.combatZone;
    if (zone) {
      const dx = (_tmpB.x - zone.centerX) / Math.max(0.001, zone.radiusX);
      const dz = (_tmpB.z - zone.centerZ) / Math.max(0.001, zone.radiusZ);
      return dx * dx + dz * dz <= 1;
    }
    // 兼容旧港热重载/测试桩：没有 combatZone 时按旧港碰撞半径退化。
    const r = Number(group.userData?.collideRadius) || 4;
    return _tmpB.x * _tmpB.x + _tmpB.z * _tmpB.z <= (r + 1.2) * (r + 1.2);
  }

  function isHarborCombatant(o) {
    const ud = o?.userData;
    if (!ud || (ud.helmSide !== "red" && ud.helmSide !== "blue")) return false;
    if (ud.combatant === false || ud.dead || ud.downed || o.visible === false) return false;
    // 明确标记优先；phalanxRole 兼容已有战斗兵和外部战斗挂接点。
    return ud.combatant === true || !!ud.phalanxRole;
  }

  function collectOldHarborCombatants(group) {
    const list = [];
    scene?.traverse?.((o) => {
      if (o === group || o === scene || o === root || o === harborCombat) return;
      if (!isHarborCombatant(o) || !isInsideOldHarbor(o, group)) return;
      list.push(o);
    });
    return list;
  }

  function updateOldHarborCombat(dt) {
    const group = resolveOldHarborGroup();
    if (!group) return;

    const current = collectOldHarborCombatants(group);
    const currentSet = new Set(current);
    for (const s of harborCombatInside) {
      if (currentSet.has(s)) continue;
      s.userData.harborCombat = false;
      s.userData.harborCombatIntent = null;
      s.userData.harborCombatTargetUid = null;
    }
    harborCombatInside.clear();
    for (const s of current) {
      harborCombatInside.add(s);
      s.userData.harborCombat = true;
      s.userData.harborCombatIntent = "engage-on-contact";
      if (s.userData.helmSide === "red" && !harborCombatEntered.has(s)) {
        harborCombatEntered.add(s);
        harborCombat.redEntered += 1;
        logEvent("oldHarborCombatEnter", { uid: s.userData.uid ?? 0, side: "red" });
      }
    }

    const reds = current.filter((s) => s.userData.helmSide === "red");
    const blues = current.filter((s) => s.userData.helmSide === "blue");
    harborCombat.active = reds.length > 0;
    if (!reds.length || !blues.length) return;

    // 港内优先最近敌人：进入旧港即锁定港内对手，不会隔着城堡追击远处单位。
    for (const red of reds) {
      if (red.userData.downed || red.userData.dead) continue;
      red.getWorldPosition(_tmp);
      let foe = null;
      let best = Infinity;
      for (const blue of blues) {
        if (blue.userData.downed || blue.userData.dead) continue;
        blue.getWorldPosition(_tmpB);
        const d2 = _tmpB.distanceToSquared(_tmp);
        if (d2 < best) {
          best = d2;
          foe = blue;
        }
      }
      if (!foe || best > MELEE_RANGE * MELEE_RANGE * 1.6) continue;

      red.userData.harborCombatIntent = "attack";
      foe.userData.harborCombat = true;
      foe.userData.harborCombatIntent = "defend-old-harbor";
      red.userData.harborCombatTargetUid = foe.userData.uid ?? null;
      foe.userData.harborCombatTargetUid = red.userData.uid ?? null;
      faceCombatTarget(red, foe, 0.35);
      faceCombatTarget(foe, red, 0.35);

      if (red.userData.phalanxRole === "longbow") {
        red.userData._shotCd = (red.userData._shotCd || 0) - dt;
        if (red.userData._shotCd <= 0 && updateLongbowShot(red, dt, rand)) {
          red.userData._shotCd = 1.5 + rand() * 0.6;
          fireArrow(red, foe);
          harborCombat.engagements += 1;
          harborCombat.lastAttackerUid = red.userData.uid ?? null;
          harborCombat.lastDefenderUid = foe.userData.uid ?? null;
          logEvent("oldHarborCombatAttack", {
            attacker: red.userData.uid ?? 0,
            defender: foe.userData.uid ?? 0,
            kind: "arrow",
          });
        }
        continue;
      }

      red.userData._meleeCd = (red.userData._meleeCd || 0) - dt;
      if (red.userData._meleeCd > 0) continue;
      red.userData._meleeCd = MELEE_COOLDOWN;
      aimCombatToolAt(red, foe, 1);
      markMeleeEngaged(red, foe);
      applySoldierDamage(foe, "melee");
      harborCombat.engagements += 1;
      harborCombat.lastAttackerUid = red.userData.uid ?? null;
      harborCombat.lastDefenderUid = foe.userData.uid ?? null;
      logEvent("oldHarborCombatAttack", {
        attacker: red.userData.uid ?? 0,
        defender: foe.userData.uid ?? 0,
        kind: "melee",
      });
    }

    // 蓝缨守港兵在同一近战距离内回击，保持旧港是双方交战而不是单向触发。
    for (const blue of blues) {
      if (blue.userData.downed || blue.userData.dead) continue;
      blue.getWorldPosition(_tmp);
      let foe = null;
      let best = Infinity;
      for (const red of reds) {
        if (red.userData.downed || red.userData.dead) continue;
        red.getWorldPosition(_tmpB);
        const d2 = _tmpB.distanceToSquared(_tmp);
        if (d2 < best) {
          best = d2;
          foe = red;
        }
      }
      if (!foe || best > MELEE_RANGE * MELEE_RANGE * 1.6) continue;
      blue.userData._meleeCd = (blue.userData._meleeCd || 0) - dt;
      if (blue.userData._meleeCd > 0) continue;
      blue.userData._meleeCd = MELEE_COOLDOWN;
      aimCombatToolAt(blue, foe, 1);
      markMeleeEngaged(blue, foe);
      applySoldierDamage(foe, "melee");
      harborCombat.engagements += 1;
      harborCombat.lastAttackerUid = blue.userData.uid ?? null;
      harborCombat.lastDefenderUid = foe.userData.uid ?? null;
      logEvent("oldHarborCombatAttack", {
        attacker: blue.userData.uid ?? 0,
        defender: foe.userData.uid ?? 0,
        kind: "counter-melee",
      });
    }
  }

  function beginSiege() {
    clearRedGarrison();
    siegeNightT = 0;
    siegeGatherT = 0;
    siegeElapsed = 0;
    blueReinforced = false; // 第二波增援随本次攻城重新计
    blueShips.length = 0;
    setPhase("siege");
    root.userData.helmSide = "blue";
    root.userData.siegeNight = false;
    root.userData.siegeAssaultBgm = false;
    // 剧情时间校准：苔庭战役+返程常把游戏内时间耗到深夜（≥0.88），
    // 而攻城要集结→突破→爬梯→混战、持续到深夜才清场（约需 60 秒），
    // 深夜抵达则拨回傍晚 0.60，并用内部计时保证至少演完白天攻城，
    // 否则第一帧 updateSiege 就进深夜清场，玩家看不到集结与进攻。
    const todNow = readTimeOfDay();
    siegeForceDay = todNow >= 0.84 || todNow < 0.2;
    if (siegeForceDay) P.timeOfDay = 0.6;
    // 战船停靠纳沃纳广场水侧；士兵上岸集结
    // （蓝盔在苔庭战役结束撤阵登船时已换好：多少人参加苔庭战争，
    //   就有多少人换蓝盔并被战船运来）
    const plazaStagger = [
      [0, 0],
      [0.035, 0.025],
      [-0.03, 0.03],
      [0.02, -0.03],
    ];
    // 先建立所有可用登城通道，再给每名士兵分配路线；否则“无梯模式”
    // 会在分配时误拿到不存在的梯号，直到更新循环才发现 lane=null。
    _groundSets = null;
    _groundSetsAt = -Infinity;
    _marchCache.clear();
    spawnSiegeLadders();
    let wi = 0;
    let gi = 0;
    const wfQueue = Array.from({ length: WATERFALL_CLIMB_LANES }, () => 0); // 各瀑布攀爬道的上攀排队计数
    for (const w of waves) {
      w.state = "siege";
      w.boat.visible = true;
      paintBoatCrewCrest(w.boat, "blue"); // 幂等：集结泊船仍是蓝缨桨手
      const bd = plazaDir
        .clone()
        .addScaledVector(castleEast, (wi - 0.5) * 0.03)
        .addScaledVector(castleNorth, -0.02)
        .normalize();
      // 战船泊进广场水盆：对广场网格射线取真实水面高度，不埋进抬升地形
      surfaceBasis(bd, castleDir, _up, _fwd, _right);
      if (plazaDeckPoint(_right, _fwd, 0, 0, _up, _deckPt)) {
        w.boat.position.copy(_deckPt).addScaledVector(_up, 0.1);
        w.boat.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      } else {
        placeOnSphere(w.boat, bd, 0.18, castleDir);
      }
      for (const s of w.soldiers) {
        paintSoldierHelm(s, "blue");
        s.userData.dead = false;
        s.userData.downed = false;
        s.userData._fell = false;
        s.userData.arrowHits = 0;
        s.userData.meleeHits = 0;
        s.userData._meleeCd = 0;
        s.visible = true;
        s.userData.ropeTeam = null;
        // 集结 → 按真实可用通道分配路线：有梯优先上梯；新圣城中梯子
        // 排满或被摧毁后改走山路/阶梯，所有路线都收束到古堡顶层。
        s.userData.siegeStage = "gather";
        const li = gi % SIEGE_LADDER_FIRST_WAVE;
        const lq = Math.floor(gi / SIEGE_LADDER_FIRST_WAVE);
        const stairRoute = siegeStairRoutes.length ? gi % siegeStairRoutes.length : -1;
        const ladderAvailable = hasAvailableSiegeLadder();
        if (!ladderPolicyDisabled && ladderAvailable && lq < LADDER_QUEUE_CAP && isSiegeLadderAvailable(siegeLadders[li])) {
          s.userData.siegeRoute = "ladder";
          s.userData.ladder = li;
          s.userData.waterfall = -1;
          s.userData.queueIdx = lq;
        } else if (!latestAssault && ladderAvailable && siegeWaterfallClimbs.length) {
          s.userData.siegeRoute = "waterfall";
          const lane = gi % WATERFALL_CLIMB_LANES;
          s.userData.ladder = -1;
          s.userData.waterfall = lane;
          s.userData.queueIdx = wfQueue[lane]++;
        } else {
          s.userData.siegeRoute = "stairs";
          s.userData.ladder = -1;
          s.userData.waterfall = -1;
          s.userData.stairRoute = Math.max(0, stairRoute);
          s.userData.stairPointIndex = 0;
          s.userData.stairWaitT = gi * STAIR_QUEUE_GAP_SEC;
          s.userData.queueIdx = gi;
        }
        gi++;
      }
      const off = plazaStagger[wi % plazaStagger.length];
      placeCohortOnPlaza(
        w,
        plazaDir
          .clone()
          .addScaledVector(castleEast, off[0])
          .addScaledVector(castleNorth, off[1])
          .normalize(),
        castleDir
      );
      wi++;
    }
    // 红盔守军：路口小队（原地防守）+ 攻城梯顶部阻击 + 少量长弓手居高俯射
    redRoot = new THREE.Group();
    redRoot.name = "citadel-red-garrison";
    root.add(redRoot);
    // 新圣城守军全部在古堡顶层设防；旧场景才保留一层台地实测兜底。
    redPostWorld.length = 0;
    for (let i = 0; i < RED_POSTS.length; i++) {
      let anchor = null;
      if (latestAssault) {
        const lane = siegeLadders[i % Math.max(1, siegeLadders.length)];
        anchor = lane?.capture?.clone()
          .addScaledVector(castleEast, ((i % 3) - 1) * 0.62)
          .addScaledVector(castleFwdWorld, Math.floor(i / 3) * 0.48) || null;
      } else {
        for (const z of [20.2, 19.6, 19.0]) {
          const g = groundAtLocal(RED_POST_SIEGE_X[i % RED_POST_SIEGE_X.length], z, 0.05);
          if (g && (!anchor || g.length() > anchor.length())) anchor = g;
        }
      }
      redPostWorld.push(anchor);
    }
    for (let p = 0; p < RED_POSTS.length; p++) spawnRedSquadAt(p);
    for (const ladder of siegeLadders) {
      for (const dx of [-0.7, 0.7]) {
        // 每个瀑布落差的梯顶都在对应上层台面设防，不能再把所有守军
        // 锚到最低层的 19.2 旧坐标。
        const post = ladder.capture.clone().addScaledVector(castleEast, dx);
        spawnRedAt(dx < 0 ? "spear" : "gladius", post, castleFwdWorld);
      }
    }
    for (let i = 0; i < RED_LONGBOW_COUNT; i++) {
      // 少量红盔长弓手：在古堡顶层居高俯射爬梯的蓝盔。
      const lx = siegeLadders[i % siegeLadders.length]?.x ?? 0.6 + i * 2.0;
      let bow = null;
      if (latestAssault) {
        bow = latestAssaultPoint(latestAssault.keepTop)?.addScaledVector(
          castleEast,
          (i - (RED_LONGBOW_COUNT - 1) * 0.5) * 0.72
        );
      } else {
        for (const z of [18.4, 17.8, 17.2]) {
          const g = groundAtLocal(lx, z, 0.05);
          if (g && (!bow || g.length() > bow.length())) bow = g;
        }
      }
      spawnRedAt(
        "longbow",
        bow || castleLocalPoint(lx, 4.3, 18.8, new THREE.Vector3()),
        castleFwdWorld
      );
    }
    // 红盔战船不限量增援：首批援军 8 秒后从运河交汇处出发
    redReinforceT = 8;
  }

  // 在某个哨位落一组 4 人红盔小队（守军与援军战船卸兵共用）：
  // 优先用攻城开始时的实测台面锚点（redPostWorld，一层台地前沿），
  // 桩环境/缺场景退回旧的方向偏移 + 球面裸半径。
  function spawnRedSquadAt(p) {
    logEvent("redSquad", { post: p });
    const anchor = redPostWorld[p] || null;
    const origin = castleOffsetDir(RED_POSTS[p][0], RED_POSTS[p][1], new THREE.Vector3());
    surfaceBasis(anchor ? anchor.clone().normalize() : origin, castleDir, _up, _fwd, _right);
    for (let i = 0; i < 4; i++) {
      const role = i % 2 === 0 ? "spear" : "gladius";
      const s = spawnSoldier(role);
      paintSoldierHelm(s, "red");
      s.userData.dead = false;
      s.userData.downed = false;
      s.userData.arrowHits = 0;
      s.userData.meleeHits = 0;
      s.userData._meleeCd = 0;
      s.userData.gx = i % 2;
      s.userData.gz = (i / 2) | 0;
      if (anchor) {
        // 沿台面前沿横向排开，逐兵射线贴台面（曲面台地，不能共用一个高度）
        _tmp
          .copy(anchor)
          .addScaledVector(_right, (i - 1.5) * 0.62)
          .addScaledVector(_fwd, p % 2 === 0 ? 0.2 : -0.2);
        const rr = citadelSurfaceR(_tmp);
        if (rr != null) _tmp.copy(_tmp.normalize()).multiplyScalar(rr + 0.05);
      } else {
        _tmp
          .copy(_up)
          .multiplyScalar(PLANET_RADIUS + 0.08)
          .addScaledVector(_right, (i - 1.5) * 0.62)
          .addScaledVector(_fwd, (p % 2 === 0 ? 0.2 : -0.2));
      }
      s.position.copy(_tmp);
      s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      s.userData.holdPos = s.position.clone(); // 路口哨位：原地防守不追击
      redRoot.add(s);
      redSoldiers.push(s);
    }
  }

  // ---------- 红盔援军战船：从运河交汇处驶向高山圣城，到岸即增援 ----------
  function spawnRedShip() {
    logEvent("redShip", { n: redShips.length });
    const boat = createFisherBoat();
    boat.name = `red-reinforce-ship-${redShips.length}`;
    boat.scale.setScalar(1.7);
    boat.userData.kind = "red-reinforce-ship";
    root.add(boat);
    redShips.push({ boat, u: 0, unloaded: false });
  }

  function updateRedShips(dt) {
    for (const rs of redShips) {
      if (rs.unloaded) continue;
      rs.u = Math.min(1, rs.u + dt / RED_SHIP_SAIL_TIME);
      const e = rs.u * rs.u * (3 - 2 * rs.u);
      _tmp.copy(junctionDir).lerp(castleDir, e).normalize();
      _tmpB.copy(junctionDir).lerp(castleDir, Math.min(1, e + 0.02)).normalize();
      placeOnSphere(rs.boat, _tmp, 0.18, _tmpB);
      updateWarshipOars?.(rs.boat, dt, 0.85);
      if (rs.u >= 1) {
        // 战船到岸：卸下 4 人红盔小队投入战斗（随机路口），船没入港内
        rs.unloaded = true;
        rs.boat.visible = false;
        spawnRedSquadAt(Math.floor(rand() * RED_POSTS.length));
      }
    }
  }

  // ---------- 蓝盔第二波增援：攻城打响后再运两船蓝缨兵来攻 ----------
  // 与红盔援军同来路（运河交汇处 → 纳沃纳广场），到岸全员下船编入攻城：
  // 集结即转入中央突破，战船清空（士兵离船即空船）。
  function spawnBlueReinforcements() {
    if (blueReinforced) return;
    blueReinforced = true;
    logEvent("blueReinforce", { ships: BLUE_REINFORCE_SHIPS });
    for (let i = 0; i < BLUE_REINFORCE_SHIPS; i++) {
      spawnWave(200 + i); // 满编 5×5 方阵 + 战船（spawnSoldier 默认红缨）
      const w = waves[waves.length - 1];
      w.state = "blueReinforce"; // 不进 sailOut/return 状态机，由 updateBlueShips 驾驶
      paintBoatCrewCrest(w.boat, "blue"); // 航行中船上就是蓝缨
      const side = i === 0 ? 1 : -1;
      const d0 = junctionDir.clone().addScaledVector(castleEast, side * 0.03).normalize();
      placeOnSphere(w.boat, d0, 0.18, plazaDir); // 出发点：运河交汇处
      let k = 0;
      for (const s of w.soldiers) {
        paintSoldierHelm(s, "blue"); // 苔庭战役后的换装部队：出征即蓝缨
        s.userData.dead = false;
        s.userData.downed = false;
        s.userData._fell = false;
        s.userData.arrowHits = 0;
        s.userData.meleeHits = 0;
        s.userData._meleeCd = 0;
        s.userData.ropeTeam = null;
        s.userData.siegeStage = "gather"; // 到岸即编入攻城流程
        const reinforcementLadder = SIEGE_LADDER_FIRST_WAVE + i;
        const ladderAvailable = hasAvailableSiegeLadder();
        if (!ladderPolicyDisabled && ladderAvailable && isSiegeLadderAvailable(siegeLadders[reinforcementLadder])) {
          s.userData.siegeRoute = "ladder";
          s.userData.ladder = reinforcementLadder; // 船 0→梯 4，船 1→梯 5
          s.userData.waterfall = -1;
          s.userData.queueIdx = 2 + ((k / 3) % 5 | 0);
        } else if (!latestAssault && ladderAvailable && siegeWaterfallClimbs.length) {
          s.userData.siegeRoute = "waterfall";
          s.userData.ladder = -1;
          s.userData.waterfall = k % WATERFALL_CLIMB_LANES;
          s.userData.queueIdx = (k / WATERFALL_CLIMB_LANES) | 0;
        } else {
          s.userData.siegeRoute = "stairs";
          s.userData.ladder = -1;
          s.userData.waterfall = -1;
          s.userData.stairRoute = siegeStairRoutes.length
            ? k % siegeStairRoutes.length
            : 0;
          s.userData.stairPointIndex = 0;
          s.userData.stairWaitT = k * STAIR_QUEUE_GAP_SEC;
          s.userData.queueIdx = k;
        }
        k++;
      }
      blueShips.push({ wave: w, u: 0, arrived: false, side });
    }
  }

  function updateBlueShips(dt, lateNight = false) {
    for (const bs of blueShips) {
      if (bs.arrived) continue;
      bs.u = Math.min(1, bs.u + dt / BLUE_SHIP_SAIL_TIME);
      const e = bs.u * bs.u * (3 - 2 * bs.u);
      _tmp
        .copy(junctionDir)
        .lerp(plazaDir, e)
        .addScaledVector(castleEast, bs.side * 0.03)
        .normalize();
      _tmpB.copy(junctionDir).lerp(plazaDir, Math.min(1, e + 0.02)).normalize();
      placeOnSphere(bs.wave.boat, _tmp, 0.18, _tmpB);
      updateWarshipOars?.(bs.wave.boat, dt, 0.9);
      if (bs.u >= 1) {
        bs.arrived = true;
        // 深夜清场后才到岸：援军没入夜色直接退场（cohort 保持隐藏）
        if (lateNight) {
          bs.wave.boat.visible = false;
          continue;
        }
        // 泊进广场水盆（射线取真实水面），两船左右错开
        surfaceBasis(_tmp, castleDir, _up, _fwd, _right);
        if (plazaDeckPoint(_right, _fwd, bs.side * 1.2, 0.4, _up, _deckPt)) {
          bs.wave.boat.position.copy(_deckPt).addScaledVector(_up, 0.1);
          bs.wave.boat.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
        }
        // 全员下岸（空船）→ 直接编入攻城：集结落位后随大流转入中央突破
        const center = plazaDir
          .clone()
          .addScaledVector(castleEast, bs.side * 0.045)
          .addScaledVector(castleNorth, -0.035)
          .normalize();
        placeCohortOnPlaza(bs.wave, center, castleDir);
        bs.wave.state = "siege";
      }
    }
  }

  // ---------- 攻城伤害模型（Bad North 克制，红蓝同规则） ----------
  // 瘫倒：1 次近战（短剑）或 2 支羽箭 → 倒地失去战斗力（仍可见）
  // 击杀：2 次近战或 4 支羽箭 → 倒地后淡出消失（瘫倒可被补刀）
  // pike：长矛站桩的封路一击（=2 次近战，冲锋者撞上矛墙即阵亡）
  // 死亡呈现（Bad North 式）：0.28s 倒平（瘫倒半倒 0.95rad / 击杀全倒 1.45rad）
  //  → 尸体原地躺 2.6s（死在哪一目了然）→ 1.1s 沉入地面消失
  function applySoldierDamage(s, kind) {
    if (!s || s.userData.dead) return;
    if (kind === "arrow") s.userData.arrowHits = (s.userData.arrowHits || 0) + 1;
    // vanguardBolt：先锋兵闪电枪光圈（主人 2026-09-05：2 枪毙命口径——
    // strikeLands 2 枪才报 1 次 wound，此处一次 wound 记 2 点近战 ≥ KILL_MELEE 即死）
    else s.userData.meleeHits = (s.userData.meleeHits || 0) + (kind === "pike" || kind === "vanguardBolt" ? 2 : 1);
    const ah = s.userData.arrowHits || 0;
    const mh = s.userData.meleeHits || 0;
    if (ah >= KILL_ARROW || mh >= KILL_MELEE) {
      s.userData.dead = true;
      s.userData.downed = true;
      s.userData._dieT = 3.7; // 躺 2.6s + 沉地 1.1s
      s.userData._fallT = 0; // 重新触发倒平动画（瘫倒→击杀会再倒到底）
    } else if (!s.userData.downed && (ah >= STAGGER_ARROW || mh >= STAGGER_MELEE)) {
      s.userData.downed = true; // 瘫倒
      s.userData._fallT = 0;
    }
    logEvent("hit", {
      uid: s.userData.uid ?? 0,
      side: s.userData.helmSide || (redSoldiers.includes(s) ? "red" : "blue"),
      kind,
      ah,
      mh,
      downed: !!s.userData.downed,
      dead: !!s.userData.dead,
    });
  }

  // Bad North「盾一次只能挡一个威胁」：盾步兵未陷入近战、未爬梯时，
  // 每两支羽箭挡下一支（确定性交替，测试可复现）；挡下的箭弹开坠落不计数。
  function shieldBlocksArrow(s) {
    if (!s || s.userData.dead || s.userData.downed) return false;
    if (s.userData.phalanxRole !== "gladius") return false; // 仅短剑盾兵持盾
    if (s.userData.siegeStage === "climb") return false; // 爬梯时盾在背后
    if ((s.userData._meleeEngagedT || 0) > 0) return false; // 被近战缠住腾不出盾
    s.userData._arrowParity = (s.userData._arrowParity || 0) + 1;
    return (s.userData._arrowParity & 1) === 0;
  }

  // 近战互殴标记：双方 1.4 秒内视为「陷入近战」（盾挡不了箭的时间窗）
  function markMeleeEngaged(a, b) {
    if (a) a.userData._meleeEngagedT = 1.4;
    if (b) b.userData._meleeEngagedT = 1.4;
  }

  function updateSiege(dt, t) {
    const livingReds = redSoldiers.filter((s) => s.visible && !s.userData.dead);
    // 蓝军只算「已到岸编入攻城」的波次：增援船在途时士兵隐身于舱内，
    // 不能被红缨长弓当目标、也不能提前行军
    const blues = waves
      .filter((w) => w.state === "siege")
      .flatMap((w) => w.soldiers)
      .filter((s) => s.visible && !s.userData.dead);
    // 攻城期不受夜间潜入任务（太鼓）信号支配：那套信号一激活会把全体蓝盔
    // 拽去运河交汇（chase 逃跑），刚集结完的攻城军每夜都会被扯散——
    // 攻城故事的收尾只由「深夜清场 + 木马兵驱赶残部」（下方 lateNight 分支）负责。
    const chase = false;
    siegeElapsed += dt;
    const tod = readTimeOfDay();
    const lateNight = siegeForceDay
      ? siegeElapsed >= SIEGE_MIN_DAY_SEC
      : tod >= 0.88 || tod < 0.16;

    // 红盔战船不限量增援：只要还在攻城（未到深夜），运河上不断有战船开来
    if (!lateNight) {
      redReinforceT -= dt;
      if (redReinforceT <= 0) {
        redReinforceT = 18 + rand() * 10;
        spawnRedShip();
      }
      // 蓝盔第二波：攻城 16 秒后两船蓝缨增援从运河交汇处开来
      if (siegeElapsed >= BLUE_REINFORCE_AT) spawnBlueReinforcements();
    }
    updateRedShips(dt);
    updateBlueShips(dt, lateNight);

    // 近战缠斗标记随时间消退（盾兵脱战后才能重新用盾挡箭）
    for (const s of [...livingReds, ...blues]) {
      if ((s.userData._meleeEngagedT || 0) > 0) s.userData._meleeEngagedT -= dt;
    }

    for (const s of livingReds) {
      // 防守姿态：不追出哨位，贴身（攻城梯必经之处）才挥砍
      if (s.userData.downed) continue; // 瘫倒不起
      if (s.userData.phalanxRole === "longbow") continue; // 长弓手只俯射，不近战
      let foe = null;
      let best = MELEE_RANGE * MELEE_RANGE * 1.4;
      s.getWorldPosition(_tmp);
      for (const b of blues) {
        b.getWorldPosition(_tmpB);
        const d2 = _tmpB.distanceToSquared(_tmp);
        if (d2 < best) {
          best = d2;
          foe = b;
        }
      }
      if (foe) {
        // 贴身近战：短剑挥砍（补刀瘫倒目标也算）；
        // 长矛守军站桩封路：Bad North 矛墙——只惩罚「冲锋中」的敌人
        // （蓝缨还在 advance/climb 即撞矛一击击杀；站稳互殴仍按 1 击瘫倒/2 击击杀）
        const foeStage = foe.userData.siegeStage || "gather";
        const pikeWall =
          s.userData.phalanxRole === "spear" &&
          (foeStage === "advance" || foeStage === "climb");
        foe.getWorldPosition(_tmpB);
        _fwd.copy(_tmpB).sub(_tmp);
        if (_fwd.lengthSq() > 1e-6) {
          surfaceBasis(_tmp, _fwd, _up, _fwd, _right);
          s.quaternion.slerp(
            _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
            0.12
          );
        }
        aimCombatToolAt(s, foe, 1);
        s.userData._meleeCd = (s.userData._meleeCd || 0) - dt;
        if (s.userData._meleeCd <= 0) {
          s.userData._meleeCd = MELEE_COOLDOWN * (0.8 + rand() * 0.5);
          markMeleeEngaged(s, foe);
          applySoldierDamage(foe, pikeWall ? "pike" : "melee");
        }
      } else if (
        s.userData.holdPos &&
        s.position.distanceToSquared(s.userData.holdPos) > 0.25
      ) {
        // 被挤离哨位则归位（路口/梯顶防守位置不乱）
        _tmpB.copy(s.userData.holdPos).sub(s.position);
        const d = _tmpB.length();
        _tmpB.normalize();
        s.position.addScaledVector(_tmpB, Math.min(0.8 * dt, d));
        faceMoving(s, _tmpB, 0.1);
      }
    }

    // 红盔长弓手（少量）：居高俯射，优先点名爬梯的蓝盔（必经之处）
    if (!chase) {
      const climbers = blues.filter(
        (b) => !b.userData.downed && b.userData.siegeStage === "climb"
      );
      const bluePool = climbers.length
        ? climbers
        : blues.filter((b) => !b.userData.downed);
      for (const s of livingReds) {
        if (s.userData.phalanxRole !== "longbow" || s.userData.downed) continue;
        if ((s.userData._shotCd || 0) > 0) s.userData._shotCd -= dt;
        const released = updateLongbowShot(s, dt, rand);
        if (!released || (s.userData._shotCd || 0) > 0 || !bluePool.length) continue;
        const tgt = bluePool[Math.floor(rand() * bluePool.length)];
        faceCombatTarget(s, tgt, 0.9);
        // Bad North 居高箭术：站位高于目标（球面半径更大）→ 俯射冷却加快
        let cd = 1.7 + rand() * 0.9;
        if (tgt && s.position.length() - tgt.position.length() > 0.5) {
          cd *= HIGHGROUND_SHOT_FACTOR;
        }
        s.userData._shotCd = cd;
        fireArrow(s, tgt);
      }
    }

    // 蓝盔攻城流程：纳沃纳广场集结 → 选择攻城梯/瀑布/朝圣石阶 → 逐层夺取台面
    if (!chase && (siegeLadders.length || siegeWaterfallClimbs.length || siegeStairRoutes.length)) {
      siegeGatherT += dt;
      const advancing = siegeGatherT > SIEGE_GATHER_SEC;
      if (advancing && !root.userData.siegeAssaultBgm) {
        root.userData.siegeAssaultBgm = true;
        setSiegeAssaultBgm(true);
      }
      for (const s of blues) {
        if (s.userData.downed) continue;
        let stage = s.userData.siegeStage || "gather";
        if (stage === "gather") {
          if (!advancing) continue; // 集结中（长弓手照常攒箭）
          stage = s.userData.siegeStage = "advance";
        }
        // 登城通道：攻城梯 → 山路/石阶。旧瀑布路线只服务历史场景。
        // 即使所有攻城梯被删掉，士兵也会继续寻路到古堡顶层。
        let route = s.userData.siegeRoute;
        if (!route) {
          route = (s.userData.ladder ?? -1) >= 0
            ? "ladder"
            : (s.userData.waterfall ?? -1) >= 0
              ? "waterfall"
              : "stairs";
        }
        let lane = route === "stairs"
          ? siegeStairRoutes[s.userData.stairRoute || 0]
          : route === "ladder"
            ? siegeLadders[s.userData.ladder]
            : siegeWaterfallClimbs[s.userData.waterfall || 0];
        if (route === "ladder" && !isSiegeLadderAvailable(lane)) lane = null;
        if (!lane && siegeStairRoutes.length) {
          route = s.userData.siegeRoute = "stairs";
          s.userData.ladder = -1;
          s.userData.waterfall = -1;
          s.userData.stairRoute = 0;
          s.userData.stairPointIndex = 0;
          lane = siegeStairRoutes[0];
        }
        if (!lane) continue;
        const q = s.userData.queueIdx || 0;
        if (stage === "advance") {
          // 中央突破：梯/瀑布走到入口；石阶则走到第一块真实踏面。
          _tmp.copy(lane.base);
          if (route !== "stairs") {
            _tmp.addScaledVector(castleFwdWorld, 0.6 + (q % 6) * 0.55);
          }
          _tmpB.copy(_tmp).sub(s.position);
          const d = _tmpB.length();
          if (d < 0.35) {
            s.userData.siegeStage = "climb";
            if (route === "stairs") {
              s.userData.stairPointIndex = 0;
              s.userData.stairWaitT = q * STAIR_QUEUE_GAP_SEC;
            } else {
              s.userData.climbT = -q * 0.7; // 梯下/潭边排队，依次上攀
            }
          } else {
            _tmpB.normalize();
            s.position.addScaledVector(_tmpB, Math.min(SIEGE_ADVANCE_PACE * dt, d));
            // 行军贴地：广场→瀑布横穿黄土坡/绿地起伏，两点直线插值会把士兵
            // 埋进中段坡脊（「走到草地就不见了」）；降频径向射线实测取高。
            s.userData._grndT = (s.userData._grndT || 0) - dt;
            if (s.userData._grndT <= 0) {
              s.userData._grndT = 0.12;
              s.userData._grndR = siegeMarchGroundR(s.position);
            }
            if (s.userData._grndR) {
              s.position.normalize().multiplyScalar(s.userData._grndR);
            }
            faceMoving(s, _tmpB);
          }
        } else if (stage === "climb") {
          if (route === "stairs") {
            s.userData.stairWaitT = Math.max(0, (s.userData.stairWaitT || 0) - dt);
            if (s.userData.stairWaitT > 0) continue;
            const points = lane.points;
            const pointIndex = Math.min(
              points.length - 1,
              Math.max(0, s.userData.stairPointIndex || 0)
            );
            const stairTarget = points[pointIndex];
            _tmpB.copy(stairTarget).sub(s.position);
            const stairDistance = _tmpB.length();
            if (stairDistance <= 0.28) {
              const floorCapture = lane.floorRoutes?.find((entry) => entry.end === pointIndex);
              if (floorCapture) {
                s.userData.siegeFloor = floorCapture.floor;
                markCastleFloorCaptured(floorCapture.floor);
              }
              if (pointIndex >= points.length - 1) {
                s.userData.siegeStage = "capture";
              } else {
                s.userData.stairPointIndex = pointIndex + 1;
              }
              continue;
            }
            _tmpB.normalize();
            s.position.addScaledVector(
              _tmpB,
              Math.min(STAIR_ASSAULT_PACE * dt, stairDistance)
            );
            faceMoving(s, _tmpB, 0.2);
            continue;
          }
          s.userData.climbT = (s.userData.climbT ?? -q * 0.7) + dt;
          if (s.userData.climbT < 0) continue; // 排队等待
          // 攀瀑比爬梯更慢；水帘中左右腾挪（无梯登城的险路）
          const climbingFall = (s.userData.waterfall ?? -1) >= 0;
          const climbSec = climbingFall ? WATERFALL_CLIMB_SEC : SIEGE_CLIMB_SEC;
          const p = Math.min(1, s.userData.climbT / climbSec);
          s.position.lerpVectors(lane.base, lane.top, p);
          if (climbingFall) {
            s.position.addScaledVector(
              castleEast,
              Math.sin(s.userData.climbT * 3.1 + (s.userData.uid || 0)) * 0.12
            );
          }
          _tmpB.copy(lane.top).sub(lane.base).normalize();
          faceMoving(s, _tmpB, 0.2);
          if (p >= 1) s.userData.siegeStage = "capture";
        } else if (stage === "capture") {
          // 最终夺取古堡顶层：所有通道在同一顶层目标区域收束。
          _tmp
            .copy(lane.capture)
            .addScaledVector(castleFwdWorld, -(q % 4) * 0.5)
            .add(
              _tmpD
                .copy(castleUpWorld)
                .cross(castleFwdWorld)
                .normalize()
                .multiplyScalar(((q * 7) % 5 - 2) * 0.55)
            );
          _tmpB.copy(_tmp).sub(s.position);
          const d = _tmpB.length();
          if (d > 0.25) {
            _tmpB.normalize();
            s.position.addScaledVector(_tmpB, Math.min(0.9 * dt, d));
            faceMoving(s, _tmpB);
          } else {
            const finalFloor = lane.floorRoutes?.at(-1)?.floor;
            if (Number.isFinite(finalFloor)) {
              s.userData.siegeFloor = finalFloor;
              markCastleFloorCaptured(finalFloor);
            }
            faceMoving(s, castleFwdWorld.clone().negate(), 0.08); // 驻守：面向城内
          }
        }
      }
    }

    // 蓝盔矛/盾手原地反击：红盔贴身即回砍（长弓手只攒箭；爬梯中无法还手；
    // Bad North 长矛移动中不能出手——只有站稳（gather/驻守 capture）才挺矛，
    // 站稳的矛对贴身红盔同样是矛墙一击）
    if (!chase) {
      for (const s of blues) {
        const role = s.userData.phalanxRole;
        if (role === "longbow" || s.userData.downed) continue;
        const stage = s.userData.siegeStage || "gather";
        if (stage === "climb") continue;
        if (role === "spear" && stage === "advance") continue; // 行军中的矛兵不出手
        s.userData._meleeCd = (s.userData._meleeCd || 0) - dt;
        if (s.userData._meleeCd > 0) continue;
        s.getWorldPosition(_tmp);
        let foe = null;
        let best = MELEE_RANGE * MELEE_RANGE;
        for (const r of livingReds) {
          r.getWorldPosition(_tmpB);
          const d2 = _tmpB.distanceToSquared(_tmp);
          if (d2 < best) {
            best = d2;
            foe = r;
          }
        }
        if (!foe) continue;
        s.userData._meleeCd = MELEE_COOLDOWN * (0.8 + rand() * 0.5);
        foe.getWorldPosition(_tmpB);
        _fwd.copy(_tmpB).sub(_tmp);
        if (_fwd.lengthSq() > 1e-6) {
          surfaceBasis(_tmp, _fwd, _up, _fwd, _right);
          s.quaternion.slerp(
            _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
            0.2
          );
        }
        aimCombatToolAt(s, foe, 1);
        markMeleeEngaged(s, foe);
        // 蓝缨长矛站稳后贴身仍按 1 击瘫倒/2 击击杀（矛墙加成只给防守方）
        applySoldierDamage(foe, "melee");
      }
    }

    if (chase) {
      for (const s of blues) {
        s.getWorldPosition(_tmp);
        _tmpB.copy(junctionDir).multiplyScalar(PLANET_RADIUS + 0.08);
        s.position.lerp(_tmpB, Math.min(1, dt * 0.18));
        surfaceBasis(s.position, junctionDir, _up, _fwd, _right);
        s.quaternion.slerp(_q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)), 0.1);
      }
    }

    if (!chase && livingReds.length) {
      // 箭雨优先覆盖仍能战斗的红盔；只剩瘫倒者时补刀
      const standingReds = livingReds.filter((r) => !r.userData.downed);
      const targetPool = standingReds.length ? standingReds : livingReds;
      for (const s of blues) {
        if (s.userData.phalanxRole !== "longbow" || s.userData.downed) continue;
        if (s.userData.siegeStage === "climb") continue; // 爬梯中无法开弓
        if ((s.userData._shotCd || 0) > 0) {
          s.userData._shotCd -= dt;
        }
        const released = updateLongbowShot(s, dt, rand);
        if (!released || (s.userData._shotCd || 0) > 0) continue;
        const tgt = targetPool[(s.userData.gx + s.userData.gz) % targetPool.length];
        faceCombatTarget(s, tgt, 0.9);
        // Bad North 居高箭术：蓝缨长弓登上台地后居高临下，冷却加快
        let cd = 1.4 + rand() * 0.8;
        if (tgt && s.position.length() - tgt.position.length() > 0.5) {
          cd *= HIGHGROUND_SHOT_FACTOR;
        }
        s.userData._shotCd = cd;
        if (tgt) fireArrow(s, tgt);
      }
    }

    // 死亡呈现（Bad North 式）：倒地动画 → 尸体躺地留痕 → 沉入地面消失
    for (const s of [...redSoldiers, ...waves.flatMap((w) => w.soldiers)]) {
      const ud = s.userData;
      // 倒地动画：0.28s easeOut 倒到目标角（瘫倒半倒 / 击杀全倒贴地）
      if (ud._fallT != null && ud._fallT < 0.28) {
        ud._fallT += dt;
        const e = Math.min(1, ud._fallT / 0.28);
        const target = ud.dead ? 1.45 : 0.95;
        s.rotation.z = target * (1 - (1 - e) * (1 - e));
      }
      if (!ud.dead || !s.visible) continue;
      ud._dieT = (ud._dieT ?? 3.7) - dt;
      if (ud._dieT <= 1.1) {
        // 沉入地面：沿当地法线缓缓下沉（尸体不是凭空消失）
        _tmp.copy(s.position).normalize();
        s.position.addScaledVector(_tmp, -dt * 0.55);
      }
      if (ud._dieT <= 0) s.visible = false;
    }

    if (lateNight) {
      // 深夜清场：主力（含红盔守军）隐入夜色；少数蓝盔残部滞留，
      // 留给木马士兵巡查驱赶（siegeNight 阶段）
      if (!stragglersMarked) {
        stragglersMarked = true;
        const living = blues
          .filter((s) => !s.userData.downed) // 瘫倒者不算残部（倒在地上跑不了）
          .slice()
          .sort(
            (a, b) =>
              (b.userData.phalanxRole === "longbow" ? 1 : 0) -
              (a.userData.phalanxRole === "longbow" ? 1 : 0)
          );
        for (let i = 0; i < Math.min(STRAGGLER_COUNT, living.length); i++) {
          living[i].userData.straggler = true;
          living[i].userData.dead = false;
          living[i].userData.fleeFrom = living[i].position.clone(); // 逃离距离从此计
        }
      }
      siegeNightT += dt;
      const k = Math.max(0, 1 - siegeNightT / 3.2);
      for (const s of [...blues, ...redSoldiers]) {
        if (s.userData.straggler) continue; // 残部不缩，保持可见
        s.scale.setScalar(Math.max(0.04, k));
        if (k < 0.08) s.visible = false;
      }
      if (siegeNightT > 3.2) {
        setPhase("siegeNight");
        root.userData.siegeNight = true;
        // 攻城曲继续播，直到夜晚太鼓真正响起再让出声道
        allowSiegeAssaultBgmHandoff();
        for (const w of waves) {
          // 注意：不能整组藏 cohort —— 蓝盔残部是 cohort 子节点，要保持可见
          w.boat.visible = false;
        }
        // 红盔援军战船深夜撤退（在途船只没入夜色）
        for (const rs of redShips) {
          rs.boat.visible = false;
          rs.unloaded = true;
        }
        if (redRoot) redRoot.visible = false;
        const inf =
          typeof getNightInfiltration === "function" ? getNightInfiltration() : null;
        inf?.userData && (inf.userData.chaseBlues = true);
        // 木马士兵出腹巡查：把滞留的蓝盔残部赶出圣城
        spawnTrojanPatrol();
      }
    }
  }

  // ---------- 深夜清场：木马腹中红盔兵出马腹巡查，把蓝盔残部赶向运河 ----------
  // 残部逃远即没入夜色（撤回运河）；残部驱离殆尽后巡查兵回木马腹，故事线落幕。
  function spawnTrojanPatrol() {
    if (patrolRoot) return;
    patrolRoot = new THREE.Group();
    patrolRoot.name = "trojan-night-patrol";
    root.add(patrolRoot);
    const horse = scene?.getObjectByName?.("citadel-trojan-horse");
    const home = new THREE.Vector3();
    if (horse) horse.getWorldPosition(home);
    else home.copy(castleDir).multiplyScalar(PLANET_RADIUS + 0.08);
    for (let i = 0; i < TROJAN_PATROL_COUNT; i++) {
      const s = createHarborPatrolSoldier();
      s.name = `trojan-patrol-soldier-${i}`;
      paintSoldierHelm(s, "red"); // 守城方盔色
      s.userData.dead = false;
      s.userData.phalanxRole = "spear";
      s.traverse((o) => {
        if (o.isMesh) o.frustumCulled = false;
      });
      s.position.copy(home);
      surfaceBasis(home.clone().normalize(), castleDir, _up, _fwd, _right);
      s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      patrolRoot.add(s);
      trojanPatrol.push({ s, wpIndex: i % RED_POSTS.length, home: home.clone(), fadeT: -1 });
    }
  }

  function updateTrojanPatrol(dt) {
    if (!trojanPatrol.length) return;
    const stragglers = [];
    for (const w of waves) {
      for (const s of w.soldiers) {
        if (s.visible && s.userData.straggler && !s.userData.dead) stragglers.push(s);
      }
    }

    // 残部逃向运河交汇处：木马兵逼近则加速；逃得够远即没入夜色消失
    for (const s of stragglers) {
      s.getWorldPosition(_tmpD);
      const pressed = trojanPatrol.some(
        (p) => p.s.visible && p.s.position.distanceToSquared(_tmpD) < 36
      );
      const pace = pressed ? STRAGGLER_FLEE_PACE * 1.5 : STRAGGLER_FLEE_PACE * 0.6;
      _tmpB.copy(junctionDir).multiplyScalar(PLANET_RADIUS + 0.08).sub(_tmpD);
      const fleeDist = _tmpB.length();
      if (fleeDist > 1e-6) {
        _tmpB.normalize();
        s.position.addScaledVector(_tmpB, Math.min(pace * dt, fleeDist));
        // 逃路横穿台地/坡地/水面：贴实测地表（涉水钳制），不沉坡不没顶
        s.userData._grndT = (s.userData._grndT || 0) - dt;
        if (s.userData._grndT <= 0) {
          s.userData._grndT = 0.15;
          s.userData._grndR = siegeMarchGroundR(s.position);
        }
        if (s.userData._grndR) s.position.normalize().multiplyScalar(s.userData._grndR);
        surfaceBasis(s.position.clone().normalize(), _tmpB, _up, _fwd, _right);
        s.quaternion.slerp(
          _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
          0.1
        );
      }
      // 逃离滞留点足够远（往运河方向）即没入夜色消失
      if (
        s.userData.fleeFrom &&
        s.position.distanceToSquared(s.userData.fleeFrom) >
          STRAGGLER_ESCAPE_DIST * STRAGGLER_ESCAPE_DIST
      ) {
        s.userData.straggler = false;
        s.userData.dead = true;
        s.visible = false; // 逃远，没入夜色（撤回运河方向）
      }
    }

    for (const p of trojanPatrol) {
      if (!p.s.visible) continue;
      // 目标：有残部 → 驱赶最近残部；残部清空 → 立即回木马腹落幕；
      // 否则在各路口（红盔守军站位）之间巡回巡查
      let target = null;
      let headingHome = false;
      if (stragglers.length) {
        let best = Infinity;
        for (const s of stragglers) {
          const d2 = s.position.distanceToSquared(p.s.position);
          if (d2 < best) {
            best = d2;
            target = s.position;
          }
        }
      }
      if (!target && !stragglers.length) {
        target = p.home;
        headingHome = true;
        if (p.fadeT < 0) p.fadeT = 0;
      }
      if (!target) {
        // 巡查点 = 一层台地前沿哨位（实测锚点）；桩环境退回旧方向偏移
        const wpw = redPostWorld[p.wpIndex];
        if (wpw) {
          target = wpw;
        } else {
          const wp = castleOffsetDir(RED_POSTS[p.wpIndex][0], RED_POSTS[p.wpIndex][1], _tmpE);
          target = _tmpB.copy(wp).multiplyScalar(PLANET_RADIUS + 0.08);
        }
        if (p.s.position.distanceToSquared(target) < 0.36) {
          p.wpIndex = (p.wpIndex + 1) % RED_POSTS.length;
        }
      }
      _tmpB.copy(target).sub(p.s.position);
      const dist = _tmpB.length();
      if (dist > 0.2) {
        _tmpB.normalize();
        p.s.position.addScaledVector(_tmpB, Math.min(PATROL_PACE * dt, dist));
        // 巡查横穿台地/坡地：贴实测地表（涉水钳制），不沉坡
        p.gT = (p.gT || 0) - dt;
        if (p.gT <= 0) {
          p.gT = 0.25;
          p.gR = siegeMarchGroundR(p.s.position);
        }
        if (p.gR) p.s.position.normalize().multiplyScalar(p.gR);
        surfaceBasis(p.s.position.clone().normalize(), _tmpB, _up, _fwd, _right);
        p.s.quaternion.slerp(
          _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
          0.1
        );
      }
      if (headingHome) {
        p.fadeT += dt;
        if (dist < 0.6 || p.fadeT > 4) p.s.visible = false; // 回到木马腹
      }
    }

    // 收束：残部被驱离殆尽 + 巡查兵全部回腹 → 故事线落幕（不等黎明）
    if (!stragglers.length && trojanPatrol.every((p) => !p.s.visible)) {
      setPhase("done");
      allowSiegeAssaultBgmHandoff();
    }
  }

  function projectCombatUnitsToSurface() {
    if (!surfaceProjectionEnabled || !surfaceProvider?.sample) return;
    const units = [
      ...redSoldiers,
      ...garrison.flatMap((group) => group.soldiers || []),
      ...waves
        .filter((wave) => wave.state === "ashore" || wave.state === "fight" || wave.state === "return")
        .flatMap((wave) => wave.soldiers || []),
      ...trojanPatrol.map((patrol) => patrol.s),
    ];
    let projected = 0;
    let rejected = 0;
    for (const unit of units) {
      if (!unit?.visible || unit.userData?.ropeTeam) continue;
      const result = projectWorldObjectToPlanetSurface(surfaceProvider, unit, { lift: 0.08, allowWater: false });
      if (result.ok) projected++;
      else if (result.reason !== "water-disallowed") rejected++;
    }
    root.userData.surfaceProjectionStats = { projected, rejected, at: simT };
  }

  function updateGarrison(dt, whaleUp) {
    for (const g of garrison) {
      const arrived = g.u >= 1;
      if (!arrived) g.u = Math.min(1, g.u + dt / 20);
      const e = g.u * g.u * (3 - 2 * g.u);
      for (const s of g.soldiers) {
        if (s.userData.ropeTeam) continue;
        if (arrived) {
          // 落位：鲸未升起 → 苔庭内分散巡查；鲸起 → 列阵/护壁
          patrolSoldier(s, dt, whaleUp);
          continue;
        }
        slerpDir(
          s.userData.garrisonFrom.clone().normalize(),
          s.userData.garrisonTo.clone().normalize(),
          e,
          _tmp
        );
        _tmp.multiplyScalar(PLANET_RADIUS + 0.08);
        s.position.copy(_tmp);
        // 面向苔庭中心（环绕排布，人人朝内）
        surfaceBasis(_tmp.normalize(), landDir, _up, _fwd, _right);
        s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      }
    }
  }

  // ---------- 绳索小队：告警后抛绳挂鲸身、拔河式拉回地面 ----------
  // 4 队（东/西/北/南）× 3 人：锚点在地面、绳头挂在鲸身中腰侧缘
  // （绳路避开鲸体，整段可见）；拉力汇入 root.userData.ropePull01 供苔庭鲸
  // 与机队吸取力做拉锯。
  const ROPE_TEAMS = 4;
  const ROPE_AXES = [1, -1, 1, -1]; // 东/西/北/南 符号
  const ROPE_HALF = [36, 36, 17.6, 17.6]; // 鲸身中腰半长/半宽（与 leviathanIsland 锁死几何一致）
  const ROPE_ANCHOR_DIST = [41, 41, 21.5, 21.5]; // 地面锚点距
  const ropeTeams = [];
  let ropesDispatched = false;
  const ropeMat = new THREE.MeshBasicMaterial({
    color: 0xc8a06a,
    side: THREE.DoubleSide,
  });
  const _ropeUp = new THREE.Vector3(0, 1, 0);
  const _ropeMid = new THREE.Vector3();
  const _ropeDir = new THREE.Vector3();
  const _ropeTgt = new THREE.Vector3();
  const _ropeTmpA = new THREE.Vector3();
  const _ropeTmpB = new THREE.Vector3();
  const _ropeTmpC = new THREE.Vector3();

  function ropeAxisDir(i, out) {
    if (i < 2) return out.copy(east).multiplyScalar(ROPE_AXES[i]);
    return out.copy(ringNorth).multiplyScalar(ROPE_AXES[i]);
  }

  function ensureRope(team) {
    if (team.rope) return team.rope;
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 5, 1, true),
      ropeMat
    );
    rope.name = "saihoji-rope";
    rope.visible = false;
    root.add(rope);
    team.rope = rope;
    return rope;
  }

  /** 绳头目标：鲸身中腰侧缘（随鲸升降） */
  function ropeTarget(i, out) {
    const lev = scene.getObjectByName("leviathanGroup");
    const anchorR = lev ? lev.position.length() : PLANET_RADIUS + 24;
    const alt = anchorR - 4.4; // 鲸体中腰高度
    ropeAxisDir(i, _ropeTmpA);
    return out
      .copy(landDir)
      .multiplyScalar(alt)
      .addScaledVector(_ropeTmpA, ROPE_HALF[i] + 1.5);
  }

  function setRopePose(team, vis) {
    const rope = ensureRope(team);
    const i = team.teamIdx;
    ropeTarget(i, _ropeTgt);
    rope.visible = vis;
    _ropeMid.copy(team.anchor).add(_ropeTgt).multiplyScalar(0.5);
    rope.position.copy(_ropeMid);
    _ropeDir.copy(_ropeTgt).sub(team.anchor);
    const len = Math.max(0.05, _ropeDir.length());
    _ropeDir.normalize();
    rope.quaternion.setFromUnitVectors(_ropeUp, _ropeDir);
    rope.scale.set(1, len, 1);
  }

  function detachRopes() {
    for (const team of ropeTeams) {
      if (team.rope?.parent) root.remove(team.rope);
      for (const s of team.soldiers) {
        s.userData.ropeTeam = undefined;
        s.userData.ropeLean = 0;
      }
    }
    ropeTeams.length = 0;
    ropesDispatched = false;
    root.userData.ropePull01 = 0;
  }

  function dispatchRopeTeams(allSoldiers) {
    if (ropesDispatched) return;
    ropesDispatched = true;
    // 优先矛兵（不射箭），其次剑盾，最后长弓
    const pool = allSoldiers.filter((s) => !s.userData.ropeTeam);
    const pick = (role) => {
      const i = pool.findIndex(
        (s) => s.userData.phalanxRole === role && !s.userData.ropeTeam
      );
      if (i < 0) return null;
      const s = pool[i];
      s.userData.ropeTeam = true;
      pool.splice(i, 1);
      return s;
    };
    for (let i = 0; i < ROPE_TEAMS; i++) {
      const aDir = ropeAxisDir(i, new THREE.Vector3());
      const d = ROPE_ANCHOR_DIST[i] / PLANET_RADIUS;
      const anchor = landDir
        .clone()
        .multiplyScalar(Math.cos(d))
        .addScaledVector(aDir, Math.sin(d))
        .normalize()
        .multiplyScalar(PLANET_RADIUS + 0.3);
      const team = {
        teamIdx: i,
        soldiers: [],
        anchor,
        state: "walk",
        t: 0,
        rope: null,
        pullT: 0,
      };
      for (let k = 0; k < 3; k++) {
        const s = pick("spear") || pick("gladius") || pick("longbow");
        if (!s) break;
        team.soldiers.push(s);
        s.userData.ropeOff = new THREE.Vector3((k - 1) * 1.1, 0, 0);
        s.userData.ropeStart = s.position.clone();
      }
      if (team.soldiers.length) ropeTeams.push(team);
    }
  }

  function updateRopeTeams(dt, t) {
    let pullSum = 0;
    for (const team of ropeTeams) {
      const lead = team.soldiers[0];
      if (!lead) continue;
      if (team.state === "walk") {
        // 全队跑向锚点（保持小横队）
        const dist = lead.position.distanceTo(team.anchor);
        team.t += dt / Math.max(3, dist * 0.3);
        const e = Math.min(1, team.t);
        const ee = e * e * (3 - 2 * e);
        for (const s of team.soldiers) {
          const off = s.userData.ropeOff;
          slerpDir(
            s.userData.ropeStart.clone().normalize(),
            team.anchor.clone().normalize(),
            ee,
            _tmp
          );
          _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
          s.position.copy(_tmp);
          surfaceBasis(_tmp.normalize(), team.anchor.clone().normalize(), _up, _fwd, _right);
          s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
          // 队内横排偏移（绕锚点切向）
          if (off) {
            _ropeTmpB.copy(_tmp).normalize();
            _ropeTmpC.crossVectors(_ropeTmpB, landDir).normalize();
            s.position.addScaledVector(_ropeTmpC, off.x);
          }
        }
        if (e >= 1) {
          team.state = "throw";
          team.t = 0;
        }
      } else if (team.state === "throw") {
        // 抛绳：0.9s 内绳从锚点伸到鲸身
        team.t += dt / 0.9;
        const e = Math.min(1, team.t);
        setRopePose(team, e > 0.15);
        if (e >= 1) {
          team.state = "pull";
          team.t = 0;
        }
      } else {
        // 拉拽：拉力爬升 + 士兵后仰（拔河）；鲸每下一档（stepPulse）猛拽一记
        team.pullT = Math.min(1, team.pullT + dt / 3.5);
        setRopePose(team, true);
        const sp = root.userData.stepPulse;
        const jerk = sp ? 0.45 * sp.t : 0;
        const lean = 0.5 + Math.sin(t * 2.3 + team.teamIdx * 1.7) * 0.1 + jerk;
        for (const s of team.soldiers) {
          s.userData.ropeLean = lean;
          // 面向鲸身
          surfaceBasis(s.position.clone().normalize(), landDir, _up, _fwd, _right);
          s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
        }
        pullSum += team.pullT;
      }
    }
    root.userData.ropePull01 = ropeTeams.length ? pullSum / ROPE_TEAMS : 0;
  }

  function update(dt, t) {
    simT += dt; // P0 仿真时钟：事件记录以此为准
    const drums = isInfiltrationMissionActive();
    if (drums) quietT = 0;
    else quietT += dt;
    const whaleUp = typeof isWhaleRisen === "function" ? !!isWhaleRisen() : false;

    // 循环条件（苔庭鲸 ↔ 机队交互）契约：root.userData.assembled 供鲸读，
    // whaleReturned 由鲸在恢复原位后调用。鼓声只控制 atCastle 的发船，
    // 士兵离城后不再受鼓声逻辑控制，直到返回高山圣城。
    root.userData.assembled = isAssembled();
    root.userData.phase = phase;
    if (root.userData.resetRequested) {
      root.userData.resetRequested = false;
      logCommand("reset");
      resetBattle();
      return;
    }
    // 旧港触发器必须先于各故事阶段的 early-return（尤其 atCastle）运行，
    // 否则红缨兵在城堡待机阶段踏入旧港会被漏掉。
    updateOldHarborCombat(dt);
    // 苔庭鲸恢复原位 → 撤阵登船返回高山圣城（离城期不受鼓声影响）
    if (
      returnRequested &&
      (phase === "fight" ||
        waves.some((w) => w.state === "fight" || w.state === "ashore"))
    ) {
      returnRequested = false;
      setPhase("return");
      for (const w of waves) {
        // 苔庭鲸战役一结束就换蓝缨：多少人参加苔庭战争，
        // 就有多少人换缨并被战船运往纳沃纳广场集结攻城。
        // 先在队列里换缨、原地列队 BOARD_HOLD_SEC 秒（肉眼可见缨穗变色），
        // 随后才撤阵入舱——避免「红缨消失、空船开走」看不见换装。
        for (const s of w.soldiers) paintSoldierHelm(s, "blue");
        // 甲板上的剪纸桨手也换蓝缨——玩家在船上看到的士兵是他们
        paintBoatCrewCrest(w.boat, "blue");
        w.state = "board";
        w.boardT = BOARD_HOLD_SEC;
        w.u = 0;
        w.boat.visible = true; // 战船已靠岸，排队等候登船
        placeOnSphere(w.boat, landDir, 0.18, landDir);
      }
      // 残箭回收：撤阵时把扎在机队上的箭/枪取回
      for (const a of arrows) {
        if (a.parent && a.parent !== root) a.parent.remove(a);
        a.visible = false;
        a.userData.stuck = false;
      }
      for (const j of javelins) {
        if (j.parent && j.parent !== root) j.parent.remove(j);
        j.visible = false;
        j.userData.stuck = false;
      }
    }

    if (phase === "atCastle") {
      // 高山圣城 · 受鼓声控制：鼓声结束后才发船
      if (quietT > 1.6) {
        setPhase("sailOut");
        shipIdx = 0;
        nextShipIn = 0.4;
      }
      return;
    }

    if (phase === "sailOut") {
      nextShipIn -= dt;
      if (shipIdx < SHIP_COUNT && nextShipIn <= 0) {
        spawnWave(shipIdx);
        shipIdx++;
        nextShipIn = SHIP_GAP;
      }
      let allLanded = shipIdx >= SHIP_COUNT;
      for (const w of waves) {
        if (w.state !== "sailOut") continue;
        allLanded = false;
        w.u = Math.min(1, w.u + dt / SAIL_TIME);
        const u = w.u * w.u * (3 - 2 * w.u);
        _tmp.copy(pathDirAt(OUT_LEGS, u));
        _tmpB.copy(pathDirAt(OUT_LEGS, Math.min(1, u + 0.02)));
        placeOnSphere(w.boat, _tmp, 0.18, _tmpB);
        updateWarshipOars?.(w.boat, dt, 0.85);
        if (w.u >= 1) {
          w.state = "ashore";
          logEvent("waveAshore", { index: w.boat.name });
          if (Number.isFinite(w.ringIndex)) {
            // 补给船：下岸到环绕苔庭槽位（面朝苔庭中心）
            placeCohort(w, ringSlotDir(w.ringIndex, new THREE.Vector3()), landDir);
          } else {
            placeCohort(w, landDir, east);
          }
        }
      }
      if (allLanded && waves.every((w) => w.state === "ashore" || w.state === "fight")) {
        setPhase("fight");
        for (const w of waves) w.state = "fight";
      }
    }

    if (phase === "return") {
      let allHome = true;
      for (const w of waves) {
        // 换缨列队（看得见缨穗变色）→ 倒计时结束才撤阵入舱
        if (w.state === "board") {
          allHome = false;
          w.boardT -= dt;
          if (w.boardT <= 0) {
            w.state = "return";
            w.u = 0;
            w.cohort.visible = false; // 登船撤阵（入舱隐身）
          }
          continue;
        }
        if (w.state !== "return") continue;
        allHome = false;
        w.u = Math.min(1, w.u + dt / SAIL_TIME);
        const u = w.u * w.u * (3 - 2 * w.u);
        _tmp.copy(pathDirAt(BACK_LEGS, u));
        _tmpB.copy(pathDirAt(BACK_LEGS, Math.min(1, u + 0.02)));
        placeOnSphere(w.boat, _tmp, 0.18, _tmpB);
        updateWarshipOars?.(w.boat, dt, 0.85);
        if (w.u >= 1) {
          w.state = "done";
          w.boat.visible = false;
        }
      }
      if (allHome) {
        // 拉回任务完成：战船抵纳沃纳广场，蓝盔上岸集结攻打高山圣城
        beginSiege();
      }
    }

    if (phase === "siege") {
      updateSiege(dt, t);
    }

    if (phase === "siegeNight") {
      // 深夜：木马腹中红盔兵巡查驱赶蓝盔残部（驱离殆尽即收队 → done）
      updateTrojanPatrol(dt);
    }

    // —— 白天源源不断的运兵（鼓声暂停全线；电车下车 + 战船补给）——
    if (!drums) {
      nextTramDrop -= dt;
      if (nextTramDrop <= 0) {
        nextTramDrop = TRAM_CHECK_INTERVAL;
        tryTramDrop();
      }
      const deployed =
        phase !== "siege" &&
        phase !== "siegeNight" &&
        (phase === "fight" ||
          waves.some((w) => w.state === "ashore" || w.state === "fight"));
      if (deployed) {
        nextReinforce -= dt;
        if (nextReinforce <= 0) {
          nextReinforce = REINFORCE_INTERVAL;
          if (waves.length < SHIP_COUNT + 6) {
            spawnWave(waveSerial++, 3, ringCursor++);
            nextShipIn = 0;
          }
        }
      }
    }
    updateGarrison(dt, whaleUp);
    // The opt-in gate is deliberately last: all legacy movement paths finish,
    // then the provider-owned surface becomes the final placement authority
    // for visible ground combatants.
    projectCombatUnitsToSurface();

    // 故事波次（主阵/补给）落位后同样两态：鲸未升起 → 苔庭内分散巡查
    for (const w of waves) {
      if (w.state !== "ashore" && w.state !== "fight") continue;
      for (const s of w.soldiers) {
        if (s.userData.ropeTeam) continue;
        patrolSoldier(s, dt, whaleUp);
      }
    }

    // ---------- 告警 + 整队：鲸起瞬间响号角，全营奔向北翼列阵 ----------
    if (whaleUp && !wasWhaleUp) {
      cuePhalanxAlarmOnce();
    }
    if (whaleUp && !fightFormed) {
      fightFormed = true;
      fightSlotLongbow = 0;
      fightSlotShield = 0;
    }
    // 注：fightFormed/绳索小队在战斗期内保持（鲸被拽到半空不算落回，
    // 避免拔河拉锯时反复解散重排）；鲸落回地面后由 whaleReturned/reset 解散。
    wasWhaleUp = whaleUp;

    const squad = typeof getSquad === "function" ? getSquad() : null;
    const members = squad?.userData?.members || [];
    // 先锋兵**落地之后**才进箭矢/标枪的目标池：还在机腹下伴飞时打不到。
    const vanguardRoot = typeof getVanguards === "function" ? getVanguards() : null;
    const vanguardTroopers =
      vanguardRoot?.userData?.state === "deployed"
        ? (vanguardRoot.userData.troopers || []).filter((v) => v.parent && !v.userData.dead)
        : [];
    const live = [...members.filter((m) => m.parent), ...vanguardTroopers];

    // ---------- 绳索小队：抛绳挂鲸、拔河拉回（告警后稍候出发） ----------
    if (whaleUp && !ropesDispatched && fightFormed) {
      const allS = [
        ...waves
          .filter((w) => w.state === "fight" || w.state === "ashore")
          .flatMap((w) => w.soldiers),
        ...garrison.flatMap((g) => g.soldiers),
      ];
      if (allS.length >= 4) dispatchRopeTeams(allS);
    }
    updateRopeTeams(dt, t);
    // 绳索士兵的后仰姿态（拔河）
    for (const team of ropeTeams) {
      for (const s of team.soldiers) {
        if (!s.userData.ropeLean) continue;
        s.rotateX(-s.userData.ropeLean);
      }
    }

    const shooters = [
      ...waves
        .filter((w) => w.state === "fight" || w.state === "ashore")
        .flatMap((w) => w.soldiers),
      ...garrison.flatMap((g) => g.soldiers),
    ];

    // ---------- aircraft 反击脉冲：光束闪爆推倒光束落点附近的士兵 ----------
    const gp = squad?.userData?.groundPulse;
    if (gp && whaleUp) {
      for (const s of shooters) {
        if (s.userData.ropeTeam) continue;
        s.getWorldPosition(_tmp);
        if (_tmp.distanceTo(gp.center) < gp.radius) {
          s.userData._stunT = 1.5;
          s.userData.patrol = null; // 打乱阵位，重新整队
          _tmpB.copy(_tmp).sub(gp.center).normalize().multiplyScalar(3.4);
          s.position.add(_tmpB);
          if (s.userData.bowCycle) s.userData.bowCycle.phase = "reach";
        }
      }
    }

    // ---------- 长弓手攒射：整理队伍后按列齐射，箭矢追射盘顶机队 ----------
    // 战斗期用 fightFormed 锁定（鲸被拽到半空也不停箭），直到鲸落回地面
    if ((whaleUp || fightFormed) && shooters.length && live.length) {
      for (const s of shooters) {
        if (s.userData.ropeTeam) continue;
        // 冲击眩晕：跳过射击
        if (s.userData._stunT > 0) {
          s.userData._stunT -= dt;
          continue;
        }
        s.getWorldPosition(_tmp);
        // 面向机队（盘顶悬停位）：完整三维瞄准——机队在空中，箭手必须仰射
        _fwd.copy(squad.userData?._patrolCenter || _tmp).sub(_tmp);
        if (_fwd.lengthSq() > 1e-4) {
          _fwd.normalize();
          // 右手 = fwd × 径向（侧向），再正交化出体轴（含仰角，不再投影成水平）
          _right.crossVectors(_fwd, _tmp.clone().normalize());
          if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0).addScaledVector(_fwd, -_fwd.x);
          _right.normalize();
          _up.crossVectors(_right, _fwd).normalize();
          s.quaternion.slerp(
            _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
            0.08
          );
        }
        // 长枪兵：投掷手中的长枪（抬手 → 掷出 → 收手，掷完冷却再掷）
        if (s.userData.phalanxRole === "spear") {
          const th = s.userData.throwState || (s.userData.throwState = { t: -4, phase: "rest" });
          const armR = s.userData.parts?.armR;
          if (th.phase === "rest") {
            th.t -= dt;
            if (th.t <= 0) {
              th.phase = "wind";
              th.t = 0;
            }
          } else if (th.phase === "wind") {
            th.t += dt / 0.5; // 0.5s 抬手
            const u = Math.min(1, th.t);
            if (armR) armR.rotation.z = 1.28 + (-0.9 - 1.28) * u;
            if (u >= 1) {
              const tgt = live[javelinI % live.length];
              throwJavelin(s, tgt);
              th.phase = "recover";
              th.t = 0;
              th.cd = 11 + rand() * 7; // 投枪沉重：11~18s 一掷
            }
          } else {
            th.t += dt / 0.6; // 0.6s 收手
            if (armR) armR.rotation.z = THREE.MathUtils.lerp(-0.9, 1.28, Math.min(1, th.t));
            if (th.t >= 1) {
              th.phase = "rest";
              th.t = -th.cd;
            }
          }
          continue;
        }
        if (s.userData.phalanxRole !== "longbow") continue;
        // 撒放即射：短冷却每帧递减（脉冲同步后错峰），只挡下一次撒放
        const cd0 = s.userData._shotCd || 0;
        if (cd0 > 0) s.userData._shotCd = cd0 - dt;
        const released = updateLongbowShot(s, dt, rand);
        root.userData._relCalls = (root.userData._relCalls || 0) + 1;
        if (released) {
          root.userData._relTrue = (root.userData._relTrue || 0) + 1;
          s.userData._relCount = (s.userData._relCount || 0) + 1;
        }
        if (!released) continue;
        if ((s.userData._shotCd || 0) > 0) continue;
        s.userData._shotCd = 2.6 + rand() * 1.6;
        // 目标轮转：五架轮流挨箭（全编队可见中箭）
        const tgt = live[arrowI % live.length];
        fireArrow(s, tgt);
      }
    }
    // ---------- 先锋兵到场：鲸起 + 方阵成形 = 苔庭之战开打 ----------
    // 2026-09-05：不再瞬移落地。先锋兵由 vanguardAssault 状态机护送到场——
    // 3 台 GatePodCraft 索降 6 名 + SOCCO 运输艇贴海送 14 名，逐人采样苔庭地表落地。
    // 落地半径、战斗推进、绳索撤离全归它管；这里只负责扣响发令枪。
    root.userData.groundHeightAt = groundHeightAt;
    root.userData.getDefenders = () => shooters.filter((s) => s?.parent && !s.userData?.dead);
    root.userData.spawnSmoke = spawnSmoke; // 灰烬/麻醉雾复用现成烟池
    if (vanguardRoot && whaleUp && fightFormed &&
        (vanguardRoot.userData.state === "aboard" || vanguardRoot.userData.state === "done")) {
      // 2026-09-05：done（巡演收队）后再次鲸起也能重新触发
      const hd = hubDir(_tmp).clone();
      if (vanguardAssault?.begin) {
        vanguardAssault.begin(hd);
      } else {
        // 无突击模块（如 V3 后端）：退回旧的瞬时落地（已修球面浮高）
        const gr = groundHeightAt(hd) ?? PLANET_RADIUS + 0.3;
        deployVanguardSquad(vanguardRoot, hd, gr + 0.05);
      }
      logCommand("vanguardDeploy");
    }

    // ---------- 先锋兵反击：激光刀 1 刀（先破盾）/ 闪电炮光圈 2 炮 损伤目标 ----------
    // 只做"够不够一次损伤"的判定；真正扣血仍走 applySoldierDamage，
    // 瘫倒/击杀阈值与事件日志只有它知道，不在这里另开第二套账。
    // 主人 2026-09-05：巡演站的非保护生物也进打击池（闪电枪 2 枪/激光剑 1 剑毙命）。
    const tourTargets = vanguardAssault?.tourTargets?.() || [];
    if (vanguardTroopers.length && (shooters.length || tourTargets.length)) {
      let boltFx = root.userData.__boltFx || null;
      if (!boltFx) {
        boltFx = createBoltArcFx();
        root.userData.__boltFx = boltFx;
        scene.add(boltFx.root);
      }
      boltFx.update(dt);
      const vs = updateVanguardCombat(vanguardRoot, dt, t, {
        soldiers: shooters.concat(tourTargets),
        // 主人 2026-09-05：谁在打莫比斯机队就先瞄准谁、面对谁、近战谁
        prefer: vanguardAssault?.threatTargets?.() || [],
        onWound: (soldier, weapon) => {
          // 主人 2026-09-05 口径：激光剑 1 剑毙命（pike +2）/ 闪电枪 2 枪毙命
          //（vanguardBolt +2：strikeLands 已按 2 枪折 1 次 wound，此处一次 wound 直接致死）
          applySoldierDamage(soldier, weapon === "blade" ? "pike" : "vanguardBolt");
          root.userData.vanguardKills = (root.userData.vanguardKills || 0) + (soldier.userData.dead ? 1 : 0);
          logEvent("vanguardStrike", {
            target: soldier.userData.uid ?? 0,
            weapon,
            dead: !!soldier.userData.dead,
          });
        },
        // 闪电炮放电弧光（充电→放电的"悬念"可视化）
        onBoltArc: (from, to) => boltFx.spawn(from, to),
        // 激光刀劈盾：盾网格当场消失——普通盾牌对激光刀等于没有（代差感）
        onShieldBroken: (soldier) => {
          const sh = soldier?.userData?.equipment?.shield;
          if (sh) sh.visible = false;
          soldier.userData.shieldBroken = true;
          root.userData.vanguardShieldBreaks = (root.userData.vanguardShieldBreaks || 0) + 1;
          logEvent("vanguardShieldBreak", { target: soldier.userData.uid ?? 0 });
          spawnSpark(soldier.getWorldPosition(new THREE.Vector3()));
        },
      });
      root.userData.vanguardBladeSwings = (root.userData.vanguardBladeSwings || 0) + vs.blade;
      root.userData.vanguardBoltShots = (root.userData.vanguardBoltShots || 0) + vs.bolt;
    }

    // 箭矢/投枪运动（飞行/命中/脱靶坠落/火花烟）始终推进，鲸落也不冻结
    updateArrows(dt);
    updateJavelins(dt);
    // 调试/验收：累计发射箭数
    root.userData.arrowsFired = arrowI;
  }

  // 苔庭鲸故事线通过 root.userData 与此方阵松耦合：
  // 读 assembled（是否整队）作升空循环条件；终扫收束后置 resetRequested 撤阵。
  // 苔庭鲸故事线松耦合契约：
  //  - 鲸读 root.userData.assembled（是否整队）作升空循环条件；
  //  - 鲸恢复原位后调 root.userData.whaleReturned()，士兵撤阵登船返回高山圣城。
  root.userData.whaleReturned = () => {
    logCommand("whaleReturned");
    detachRopes();
    resetFightFormation();
    rearmPhalanxAlarm();
    returnRequested = true;
  };
  // 调试直跳攻城（无头实拍/验收用）：波次未发则立即补齐，视为苔庭战役已结束
  // 直接 beginSiege——换蓝缨/架梯/攀爬道/守军配置都在 beginSiege 内完成；
  // 鼓息发船与航程链路另有 test_phalanx 覆盖，此处跳过只为快速到达攻城画面
  root.userData.debugSiege = () => {
    logCommand("debugSiege");
    while (shipIdx < SHIP_COUNT) {
      spawnWave(shipIdx);
      shipIdx++;
    }
    returnRequested = false;
    beginSiege();
  };
  root.userData.reset = () => {
    root.userData.resetRequested = true;
  };
  return {
    root,
    update,
    isAssembled,
    reset: resetBattle,
    /** 苔庭之战数值口径（先锋兵不对称伤害），供 UI / 测试读，不许在别处硬编码第二份 */
    combatRules: VANGUARD_COMBAT,
  };
}
