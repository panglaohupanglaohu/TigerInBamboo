import os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardTrooper.js")
s = open(p).read()

# ---------- 1. 常量段：闪电炮放电模型 + 编成 ----------
anchor = "/** 一队的规模（用户要 20 个）。 */\nexport const VANGUARD_SQUAD_SIZE = 20;"
assert anchor in s
new_consts = anchor + """

/**
 * 闪电炮的**充电—放电**模型（主人 2026-09-04：「别上来一顿突突，要出现充电过程，
 * 让战斗出现悬念」）。
 *
 * 这不是给开火加个 cooldown 就完事。真正让画面出现悬念的是三件事：
 *   ① **充电可见**：枪口先亮起来、越来越亮，观众知道"要放了"，也知道**还没放**；
 *   ② **命中率跟充电度走**：没充满就放 = 大概率打空。所以士兵有机会在充电窗口里
 *      移动、举盾、冲上来——战斗才有来回，而不是单方面点名；
 *   ③ **放电是一瞬**：0.18s 的弧光，不是持续光束。持续光束会让"2 炮毙命"变成秒杀扫射。
 *
 * 四个阶段循环：idle → charging(chargeTime) → discharge(dischargeTime) → cooldown(cooldown)
 */
export const VANGUARD_BOLT = Object.freeze({
  /** 充电时长（秒）：这段时间枪口辉光从 0 涨到 1 */
  chargeTime: 1.55,
  /** 放电时长（秒）：弧光可见的一瞬 */
  dischargeTime: 0.18,
  /** 放电后的冷却（秒） */
  cooldown: 0.85,
  /** 满充命中率（近距离） */
  hitFull: 0.86,
  /** 零充命中率（被打断/抢射时的下限） */
  hitEmpty: 0.06,
  /** 命中率随距离衰减到一半的距离 */
  halfRange: 9.5,
  /** 最大射程（超出不开火） */
  maxRange: 16,
  /** 弧光折线段数（放电函数的采样数） */
  arcSegments: 9,
  /** 弧光横向抖动幅度（相对射程的比例） */
  arcJitter: 0.075,
  /** 2 炮毙命——与 VANGUARD_COMBAT.boltHitsPerWound 同一个数，别写第二份 */
  get shotsToKill() { return 2; },
});

/**
 * 编成（主人 2026-09-04）：20 人 = **2 组 × 10**；
 * 每组 = **1 名组长 + 3 个三人子小组**（三三制）。
 */
export const VANGUARD_FORMATION = Object.freeze({
  groups: 2,
  perGroup: 10,
  teamsPerGroup: 3,
  perTeam: 3,
  /** 推进速度（米/秒）——「缓慢沉稳推进」，比普通士兵慢一截 */
  advanceSpeed: 0.85,
  /** 子小组三角的边长 */
  teamSpacing: 1.5,
  /** 子小组之间的间距 */
  teamGap: 4.2,
  /** 两个组之间的间距 */
  groupGap: 9.0,
});"""
s = s.replace(anchor, new_consts)

# ---------- 2. 尾部追加：编组 / 放电函数 / 推进 ----------
s += '''

// ============================================================================
//  三三制编组（主人 2026-09-04）
//
//  20 人 = 2 组 × 10；每组 = 1 名组长 + 3 个三人子小组。
//  编组是**确定性**的：uid → (group, team, slot)，没有随机，重开一局站位一样。
//  组长不进子小组（他是第 10 个人），站在本组三个小组的几何中心稍前。
// ============================================================================

/**
 * 给中队分组。幂等：重复调用结果相同。
 * @returns {{groups: Array<{index:number, leader:object, teams:object[][], all:object[]}>}}
 */
export function assignVanguardFireteams(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  const { groups: G, perGroup, teamsPerGroup, perTeam } = VANGUARD_FORMATION;
  const groups = [];
  for (let g = 0; g < G; g++) {
    const slice = troopers.slice(g * perGroup, (g + 1) * perGroup);
    const teams = [];
    for (let ti = 0; ti < teamsPerGroup; ti++) teams.push([]);
    let leader = null;
    slice.forEach((tr, i) => {
      tr.userData.group = g;
      if (i === 0) {
        // 每组第一个人当组长
        tr.userData.role = "leader";
        tr.userData.team = -1;
        tr.userData.slot = -1;
        leader = tr;
        return;
      }
      const k = i - 1;                       // 0..8
      const ti = Math.floor(k / perTeam);    // 0/1/2
      const slot = k % perTeam;              // 0/1/2
      tr.userData.role = "member";
      tr.userData.team = ti;
      tr.userData.slot = slot;
      teams[ti].push(tr);
    });
    groups.push({ index: g, leader, teams, all: slice });
  }
  squadRoot.userData.formation = { groups };
  return { groups };
}

/**
 * 三三制阵位（相对推进方向的局部偏移，单位：米）。
 *
 * 布局：组长在前，三个子小组呈**倒品字**跟在后面（左前、右前、中后），
 * 每个子小组内部也是一个小三角（组员 0 在前，1/2 在后左右）。
 * 这样从空中看，一个组是"大三角里套三个小三角"——三三制的画面标志。
 *
 * @returns {{right:number, forward:number}} 局部偏移
 */
export function vanguardFormationOffset(trooper) {
  const { teamSpacing, teamGap, groupGap } = VANGUARD_FORMATION;
  const g = trooper.userData.group ?? 0;
  const groupOff = (g - (VANGUARD_FORMATION.groups - 1) / 2) * groupGap;
  if (trooper.userData.role === "leader") {
    return { right: groupOff, forward: teamGap * 0.55 };
  }
  const ti = trooper.userData.team ?? 0;
  const slot = trooper.userData.slot ?? 0;
  // 子小组锚点：左前 / 右前 / 中后
  const TEAM_ANCHOR = [
    { right: -teamGap * 0.5, forward: 0 },
    { right: teamGap * 0.5, forward: 0 },
    { right: 0, forward: -teamGap * 0.8 },
  ][ti % 3];
  // 小组内三角：0 在前，1 左后，2 右后
  const SLOT = [
    { right: 0, forward: teamSpacing * 0.6 },
    { right: -teamSpacing * 0.55, forward: -teamSpacing * 0.35 },
    { right: teamSpacing * 0.55, forward: -teamSpacing * 0.35 },
  ][slot % 3];
  return {
    right: groupOff + TEAM_ANCHOR.right + SLOT.right,
    forward: TEAM_ANCHOR.forward + SLOT.forward,
  };
}

// ============================================================================
//  闪电炮：放电函数
// ============================================================================

/**
 * 充电度 → 命中率。**二次曲线**，不是线性：
 * 半充时只有 ~25% 命中率，逼着他们把电充满才开火——这就是"悬念"的来源。
 * 再乘一个距离衰减（halfRange 处减半）。
 *
 * @param {number} charge 0..1
 * @param {number} dist 目标距离
 */
export function boltHitChance(charge, dist) {
  const u = Math.max(0, Math.min(1, charge));
  const { hitFull, hitEmpty, halfRange } = VANGUARD_BOLT;
  const byCharge = hitEmpty + (hitFull - hitEmpty) * u * u;
  const byDist = 1 / (1 + Math.max(0, dist) / Math.max(1e-3, halfRange));
  return byCharge * byDist;
}

/** 确定性抖动（禁止 Math.random；同一发弹每帧画出来必须是同一条弧） */
function boltNoise(seed, i) {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff - 0.5;   // −0.5 .. 0.5
}

/**
 * 放电轨迹：一条**折线**，不是直线。
 * 主干沿 from→to，每个采样点在垂直平面上按 `boltNoise` 抖开，
 * 两端收窄（起点在枪口、终点在目标，必须钉死，否则弧光会飘出枪口）。
 *
 * @param {{x:number,y:number,z:number}} from
 * @param {{x:number,y:number,z:number}} to
 * @param {number} seed 同一发弹用同一个 seed
 * @param {number} [segments]
 * @returns {number[][]} 折线点（含首尾），长度 = segments + 1
 */
export function boltArcPath(from, to, seed, segments = VANGUARD_BOLT.arcSegments) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  // 任取两个与主干垂直的方向
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(dy / len) > 0.9) { ax = 1; ay = 0; az = 0; }
  // u = normalize(cross(d, a))
  let ux = dy * az - dz * ay;
  let uy = dz * ax - dx * az;
  let uz = dx * ay - dy * ax;
  const ul = Math.hypot(ux, uy, uz) || 1e-6;
  ux /= ul; uy /= ul; uz /= ul;
  // v = normalize(cross(d, u))
  let vx = dy * uz - dz * uy;
  let vy = dz * ux - dx * uz;
  let vz = dx * uy - dy * ux;
  const vl = Math.hypot(vx, vy, vz) || 1e-6;
  vx /= vl; vy /= vl; vz /= vl;

  const amp = len * VANGUARD_BOLT.arcJitter;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // 两端收窄：sin(πt) 在 t=0/1 处为 0，中段最大
    const w = Math.sin(Math.PI * t) * amp;
    const nu = boltNoise(seed, i * 2) * 2 * w;
    const nv = boltNoise(seed, i * 2 + 1) * 2 * w;
    pts.push([
      from.x + dx * t + ux * nu + vx * nv,
      from.y + dy * t + uy * nu + vy * nv,
      from.z + dz * t + uz * nu + vz * nv,
    ]);
  }
  return pts;
}

/**
 * 推进闪电炮的四阶段状态机。**只管状态与充电度**，开不开火由调用方决定
 * （它才知道有没有目标、够不够射程）。
 *
 * @param {object} trooper
 * @param {number} dt
 * @param {boolean} wantFire 有目标且在射程内
 * @returns {{phase:string, charge:number, fired:boolean}} fired 只在进入 discharge 的那一帧为 true
 */
export function updateBoltCharge(trooper, dt, wantFire) {
  const u = trooper.userData;
  u.boltPhase = u.boltPhase || "idle";
  u.boltT = u.boltT || 0;
  u.boltCharge = u.boltCharge || 0;
  let fired = false;
  const B = VANGUARD_BOLT;

  switch (u.boltPhase) {
    case "idle":
      u.boltCharge = 0;
      if (wantFire) { u.boltPhase = "charging"; u.boltT = 0; }
      break;
    case "charging":
      u.boltT += dt;
      u.boltCharge = Math.min(1, u.boltT / B.chargeTime);
      if (!wantFire) {
        // 目标没了：泄电回 idle，不空放（空放会变成"一顿突突"）
        u.boltPhase = "idle";
        u.boltT = 0;
      } else if (u.boltCharge >= 1) {
        u.boltPhase = "discharge";
        u.boltT = 0;
        fired = true;
      }
      break;
    case "discharge":
      u.boltT += dt;
      if (u.boltT >= B.dischargeTime) { u.boltPhase = "cooldown"; u.boltT = 0; }
      break;
    case "cooldown":
      u.boltT += dt;
      u.boltCharge = Math.max(0, 1 - u.boltT / B.cooldown);
      if (u.boltT >= B.cooldown) { u.boltPhase = "idle"; u.boltT = 0; u.boltCharge = 0; }
      break;
    default:
      u.boltPhase = "idle";
  }
  return { phase: u.boltPhase, charge: u.boltCharge, fired };
}

// ============================================================================
//  激光刀破盾（主人 2026-09-04：「近距离格斗时，激光刀对盾牌的破坏力」）
// ============================================================================

/**
 * 一刀砍在盾上会发生什么：**盾直接被切开**，不是弹开。
 * 这就是代差感——普通士兵的盾对箭有效，对激光刀等于没有。
 *
 * 调用方（saihojiPhalanx）负责真正摘掉盾网格与记事件；这里只裁定结果，
 * 免得判定口径散成两份。
 *
 * @param {object} soldier 被砍的普通士兵
 * @returns {{shieldBroken:boolean, wounded:boolean}}
 */
export function bladeVsShield(soldier) {
  const eq = soldier?.userData?.equipment;
  const hasShield = !!(eq?.shield && !soldier.userData.shieldBroken);
  if (hasShield) {
    // 第一刀劈盾：盾没了，人这一刀不算受伤（他还举着残柄退了一步）
    return { shieldBroken: true, wounded: false };
  }
  // 无盾：1 刀 = 1 次损伤（VANGUARD_COMBAT.bladeHitsPerWound）
  return { shieldBroken: false, wounded: true };
}

// ============================================================================
//  缓慢沉稳推进
// ============================================================================

const _adA = new THREE.Vector3();
const _adB = new THREE.Vector3();
const _adUp = new THREE.Vector3();
const _adFwd = new THREE.Vector3();
const _adRight = new THREE.Vector3();
const _adBasis = new THREE.Matrix4();

/**
 * 按三三制阵位向 `targetDir` 推进一帧。
 *
 * 球面世界：`up` = 单位径向，前进方向是切平面里从当前朝向指向目标的那一支。
 * **速度是常量**（`VANGUARD_FORMATION.advanceSpeed`），不做加速度——
 * 「缓慢沉稳」的画面感来自匀速 + 阵型不散，不是来自缓动曲线。
 *
 * @param {object} squadRoot
 * @param {number} dt
 * @param {{anchorDir:THREE.Vector3, groundRadius:number, headingDir?:THREE.Vector3, speed?:number}} opts
 *   anchorDir 是阵型中心当前所在的球面方向（会被本函数就地推进）
 * @returns {{advanced:number}} 本帧推进的弧长
 */
export function updateVanguardAdvance(squadRoot, dt, opts = {}) {
  const troopers = squadRoot?.userData?.troopers || [];
  if (!troopers.length) return { advanced: 0 };
  const {
    anchorDir,
    groundRadius,
    headingDir = null,
    speed = VANGUARD_FORMATION.advanceSpeed,
  } = opts;
  if (!anchorDir || !Number.isFinite(groundRadius)) return { advanced: 0 };

  _adUp.copy(anchorDir).normalize();
  // 前进方向：切平面里指向 headingDir 的分量
  if (headingDir) {
    _adFwd.copy(headingDir).addScaledVector(_adUp, -headingDir.dot(_adUp));
    if (_adFwd.lengthSq() < 1e-10) _adFwd.set(0, 0, 1);
    _adFwd.normalize();
  } else {
    _adFwd.set(0, 0, 1).addScaledVector(_adUp, -_adUp.z).normalize();
  }
  _adRight.crossVectors(_adFwd, _adUp).normalize();

  // 阵型中心沿切向走一步，再重新归一化回球面
  const step = speed * dt;
  if (step > 0) {
    anchorDir.addScaledVector(_adFwd, step / Math.max(1e-3, groundRadius)).normalize();
    _adUp.copy(anchorDir);
    _adRight.crossVectors(_adFwd, _adUp).normalize();
    _adFwd.crossVectors(_adUp, _adRight).normalize();
  }

  for (const tr of troopers) {
    if (tr.userData.dead) continue;
    const off = vanguardFormationOffset(tr);
    _adA.copy(_adUp).multiplyScalar(groundRadius)
      .addScaledVector(_adRight, off.right)
      .addScaledVector(_adFwd, off.forward);
    // 站到球面上：位置归一化到 groundRadius，姿态用局部基底
    _adB.copy(_adA).normalize().multiplyScalar(groundRadius);
    tr.position.copy(_adB);
    const up2 = _adB.clone().normalize();
    const right2 = _adRight.clone().addScaledVector(up2, -_adRight.dot(up2)).normalize();
    const fwd2 = new THREE.Vector3().crossVectors(up2, right2).normalize();
    _adBasis.makeBasis(right2, up2, fwd2);
    tr.quaternion.setFromRotationMatrix(_adBasis);
    tr.visible = true;
    // 走路：腿部小幅摆动（相位按 uid 错开，20 个人不同步）
    const phase = (tr.userData.uid ?? 0) * 0.7;
    const sw = Math.sin((squadRoot.userData._advT = (squadRoot.userData._advT || 0)) * 3.4 + phase) * 0.22;
    if (tr.userData.parts?.legL) tr.userData.parts.legL.rotation.x = sw;
    if (tr.userData.parts?.legR) tr.userData.parts.legR.rotation.x = -sw;
  }
  squadRoot.userData._advT = (squadRoot.userData._advT || 0) + dt;
  return { advanced: step };
}
'''
open(p, "w").write(s)
print("ok", len(s))
