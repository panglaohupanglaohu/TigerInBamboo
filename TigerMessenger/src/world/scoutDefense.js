// ============================================================================
//  小型侦察飞行器防卫队
//  - 5 架浅蓝侦察机驻守水晶城母塔与子塔之间
//  - 轮换巡检水晶城 / 叹息之门，发现中型黑灰伴飞鸟后集结拦截
//  - 命中采用现有鸟群的“坠落—复飞”生命循环，不会永久删除生态实体
// ============================================================================
import * as THREE from "three";
import { createTripleGateScoutAircraft } from "./planetV8/tripleGateScout.js";

const DEFAULT_COUNT = 5;
const ZONE_DWELL = 18;
const SCAN_INTERVAL = 0.32;
const SCOUT_SPEED = 21; // 速度感（2026-08-28）：巡航速度 13→21
const SCOUT_TURN_ACCEL = 38; // 转向加速度上限（u/s²）：滑翔弧线；侦察机「轻灵迅捷」，比运输/攻击平台利落
const ATTACK_RANGE = 10.5;
const MIN_FORMATION_GAP = 7.2;
const SHOT_INTERVAL = 1.55;
const SHOT_FLIGHT_TIME = 0.28;
const BIRD_DOWN_TIME = 5.2;
const BIRD_COOLDOWN = 6.5;

// ---- 舰队分队（主人 2026-09-06）----------------------------------------
/** 编入舰队的机在战场上空的巡航高度（米，地表之上） */
const FLEET_SCOUT_ALT = 46;
/** 环绕战场的盘旋半径（米）——「环绕战场飞行」要看得出是在绕圈，不是悬停 */
const FLEET_ORBIT_RADIUS = 62;
/** 盘旋角速度（弧度/秒） */
const FLEET_ORBIT_SPEED = 0.55;
/** 同一个目标被重复指示的冷却（秒）：曳光是指示，不是刷屏 */
const DESIGNATE_COOLDOWN = 4.5;
/**
 * 曳光指示的有效射程（米）。**这就是 standoff 的具体数值**：
 * 盘旋半径 ~52 + 高度 46 → 到战场中心的斜距约 70，到战场边缘约 85。
 * 给到 110 才能做到「在圈上指示、不下去贴脸」。
 * 对照：ATTACK_RANGE=10.5 是水晶城猎鸟用的**接敌**距离，两回事，别混。
 */
const DESIGNATE_RANGE = 110;
/** 硬性最低离地高度（米）。侦察机不许俯冲到地面高度——截屏那种贴地是事故 */
const FLEET_MIN_AGL = 30;
/** 俯仰限幅（弧度，≈23°）：机头跟速度矢量走，但侦察机不做垂直机动 */
const SCOUT_PITCH_LIMIT = 0.40;

const HOME_SLOTS = [
  { along: -0.9, side: 0, up: 0.8 },
  { along: -0.35, side: -1, up: 0.25 },
  { along: -0.35, side: 1, up: 0.25 },
  { along: 0.25, side: -1, up: -0.25 },
  { along: 0.25, side: 1, up: -0.25 },
];

// 拦截时保持“长机 + 左右僚机 + 后排支援”的疏开队形；偏移量是世界单位，
// 不会把五架机挤成一个点。后排略落后，转弯时能形成可读的战斗机协同姿态。
const ATTACK_FORMATION = [
  { forward: 1.5, side: 0, up: 2.2 },
  { forward: -1.6, side: -5.4, up: 1.0 },
  { forward: -1.6, side: 5.4, up: 1.0 },
  { forward: -5.1, side: -10.4, up: 0.2 },
  { forward: -5.1, side: 10.4, up: 0.2 },
];

const _pos = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _bankedUp = new THREE.Vector3();
const _shotPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _basis = new THREE.Matrix4();

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function projectTangent(value, normal, fallback = null) {
  value.addScaledVector(normal, -value.dot(normal));
  if (value.lengthSq() < 1e-8 && fallback) value.copy(fallback);
  if (value.lengthSq() < 1e-8) value.set(0, 0, 1).addScaledVector(normal, -normal.z);
  if (value.lengthSq() < 1e-8) value.set(1, 0, 0).addScaledVector(normal, -normal.x);
  return value.normalize();
}

function getWorldPosition(object, out) {
  if (!object?.getWorldPosition) return false;
  object.updateWorldMatrix?.(true, false);
  object.getWorldPosition(out);
  return out.lengthSq() > 1e-8;
}

/**
 * @param {{
 *   scene: THREE.Scene,
 *   radius?: number,
 *   moebius?: object,
 *   abandonedGate?: THREE.Object3D,
 *   getCityBirdFlocks?: () => object|null,
 *   getGateBirdVortex?: () => object|null,
 *   surfacePosition?: number[]|null,
 *   count?: number,
 *   onHit?: (zone: string) => void,
 * }} options
 */
export function createScoutDefenseSquad(options = {}) {
  const {
    scene,
    radius = 160,
    moebius = null,
    abandonedGate = null,
    getCityBirdFlocks = () => moebius?.birdFlocks || null,
    getGateBirdVortex = () => null,
    surfacePosition = null,
    count = DEFAULT_COUNT,
    onHit = () => {},
    // ---- 舰队分队（主人 2026-09-06）----
    /** 编入莫比斯舰队的架数；其余留守水晶城。0 = 全部留守（旧行为） */
    fleetCount = 0,
    /** 战场中心（主舰地面投影方向，单位向量）；null = 舰队不在场 */
    getFleetAnchor = () => null,
    /** 战场上待指示的目标（由 vanguardAssault 提供） */
    getFleetTargets = () => [],
    /** 曳光弹指示回调：把目标推给舰队的优先打击名单 */
    onDesignate = () => {},
  } = options;
  if (!scene) throw new Error("createScoutDefenseSquad requires scene");

  const R = Math.max(1, finite(radius, 160));
  const n = Math.max(1, Math.min(DEFAULT_COUNT, count | 0));
  const root = new THREE.Group();
  root.name = "crystal-scout-defense-squad";
  root.userData.kind = "crystal-scout-defense-squad";
  root.userData.role = "medium-black-grey-companion-bird-defense";
  root.userData.count = n;
  scene.add(root);

  const units = [];
  const shots = [];
  const targets = [];
  /** 战场目标（舰队分队专用）。与 targets 分开：两支分队打的是两件事 */
  const fleetTargets = [];
  const nFleet = Math.max(0, Math.min(count | 0, fleetCount | 0));
  let zone = "city";
  let zoneT = 0;
  let scanT = 0;
  let targetCursor = 0;
  let volley = 0;

  const shotGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const shotMat = new THREE.MeshBasicMaterial({
    color: 0xffd36a,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flashGeo = new THREE.SphereGeometry(0.22, 8, 6);

  function cityHomeFrame() {
    const grand = moebius?.grand;
    const satellites = moebius?.corridorTowers?.length
      ? moebius.corridorTowers
      : moebius?.crystals?.slice?.(1) || [];
    const child = satellites[0] || moebius?.crystals?.[1] || grand;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    if (!getWorldPosition(grand?.group, a)) {
      const dir = grand?.dir?.clone?.().normalize?.() || new THREE.Vector3(0, -1, 0);
      a.copy(dir).multiplyScalar(R + 30);
    }
    if (!getWorldPosition(child?.group, b)) b.copy(a).add(new THREE.Vector3(0, 0, 12));

    const center = a.clone().lerp(b, 0.5);
    const up = center.normalize();
    const forward = projectTangent(b.clone().sub(a), up);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    return { a, b, center, up, forward, right };
  }

  function gateHomeFrame() {
    const seat = abandonedGate?.userData?.seatRoot || abandonedGate;
    const origin = new THREE.Vector3();
    const q = new THREE.Quaternion();
    if (!getWorldPosition(seat, origin)) {
      if (Array.isArray(surfacePosition) && surfacePosition.length >= 3) origin.fromArray(surfacePosition);
      else origin.set(0, R + 1, 0);
      return {
        origin,
        center: origin.clone().add(new THREE.Vector3(0, 24, 0)),
        up: new THREE.Vector3(0, 1, 0),
        forward: new THREE.Vector3(0, 0, 1),
        right: new THREE.Vector3(1, 0, 0),
      };
    }
    seat.getWorldQuaternion?.(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
    projectTangent(forward, up);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    return {
      origin,
      center: origin.clone().addScaledVector(up, 24),
      up,
      forward,
      right,
    };
  }

  function homePosition(index, out = new THREE.Vector3()) {
    const frame = zone === "gate" ? gateHomeFrame() : cityHomeFrame();
    const slot = HOME_SLOTS[index % HOME_SLOTS.length];
    out
      .copy(frame.center)
      .addScaledVector(frame.forward, slot.along * 8)
      .addScaledVector(frame.right, slot.side * 8.4)
      .addScaledVector(frame.up, slot.up * 3.2);
    // 机群所在高度以两塔实际中心为准，避免在布局编辑后埋进塔身。
    if (out.length() < R + 7) out.normalize().multiplyScalar(R + 12);
    return out;
  }

  function addCityTargets(flocks, time) {
    for (const flock of flocks?.flocks || []) {
      for (const bird of flock?.birds || []) {
        if (!bird?.visible) continue;
        const ud = bird.userData || {};
        if (ud.scoutDefenseDownT > 0 || ud.scoutDefenseCooldownUntil > time) continue;
        bird.updateWorldMatrix?.(true, false);
        const position = new THREE.Vector3();
        bird.getWorldPosition(position);
        targets.push({
          zone: "city",
          kind: "medium-black-grey-companion-bird",
          object: bird,
          position,
          pending: false,
          hit(at) {
            if (!bird.visible || (bird.userData.scoutDefenseDownT || 0) > 0) return false;
            bird.userData.scoutDefenseDownT = BIRD_DOWN_TIME;
            bird.userData.scoutDefenseFallT = 0.95;
            bird.userData.scoutDefenseCooldownUntil = at + BIRD_COOLDOWN;
            return true;
          },
        });
      }
    }
  }

  function addGateTargets(vortex, time) {
    if (!vortex?.getBirdPosition || !vortex.root?.visible) return;
    const count = Math.max(0, vortex.count | 0);
    for (let i = 0; i < count; i++) {
      if ((vortex.sedateT?.[i] || 0) > 0) continue;
      const position = vortex.getBirdPosition(i, new THREE.Vector3());
      targets.push({
        zone: "gate",
        kind: "medium-black-grey-companion-bird",
        index: i,
        position,
        pending: false,
        hit() {
          if ((vortex.sedateT?.[i] || 0) > 0) return false;
          if (vortex.sedateT) vortex.sedateT[i] = BIRD_DOWN_TIME;
          return true;
        },
      });
    }
  }

  /**
   * 战场目标 → 指示记录。
   *
   * hit 回调**不造成伤害**：主人 2026-09-06 选的是分工制——侦察机只标记，
   * 标出来的东西交给舰队各打各的（空中生物归泡机麻醉、地面归重甲兵、
   * 贴到艇边的归登陆艇撞）。这里只把目标推进优先打击名单。
   */
  function addFleetTargets(time) {
    const list = getFleetTargets?.() || [];
    for (const object of list) {
      if (!object?.parent || object.userData?.dead) continue;
      const ud = object.userData || {};
      if ((ud.scoutDesignatedUntil || 0) > time) continue; // 指示冷却中
      const position = new THREE.Vector3();
      object.getWorldPosition(position);
      fleetTargets.push({
        zone: "fleet",
        kind: "fleet-designated",
        object,
        position,
        hit: (at) => {
          object.userData.scoutDesignatedUntil = at + DESIGNATE_COOLDOWN;
          object.userData.scoutDesignated = true;
          onDesignate(object);
          return true;
        },
      });
    }
  }

  /**
   * 舰队分队的巡航位：绕**战场中心**盘旋（主人：「前出侦查，环绕战场飞行」）。
   *
   * 战场中心 = 主舰的地面投影。这是「随主舰移动」在侦察机这一侧的落点：
   * 主舰飞到哪，这三架就绕到哪，不再回水晶城换岗。
   */
  function fleetOrbitPosition(index, time, anchorDir, out = new THREE.Vector3()) {
    const up = _up.copy(anchorDir).normalize();
    // 切平面基底（球面世界的老规矩：先取一个不与 up 平行的参考轴）
    _forward.set(0, 1, 0);
    if (Math.abs(_forward.dot(up)) > 0.95) _forward.set(1, 0, 0);
    projectTangent(_forward, up);
    _right.crossVectors(up, _forward).normalize();
    // 三架机在同一个圈上均分相位，读起来是一队在绕，不是三架各转各的
    const phase = time * FLEET_ORBIT_SPEED + (index / Math.max(1, nFleet)) * Math.PI * 2;
    // 真实的侦察盘旋圈不是节拍器：半径与高度都有缓慢起伏（换个角度看同一片地）。
    // 系数取自 index，确定性，不用 Math.random。
    const wob = index * 1.7;
    const radius = FLEET_ORBIT_RADIUS * (1 + Math.sin(phase * 0.5 + wob) * 0.14);
    const alt = FLEET_SCOUT_ALT + Math.sin(phase * 0.37 + wob) * 7;
    // 球面偏移铁律：**先乘半径再切向平移，最后归一化**
    out.copy(up).multiplyScalar(R + alt)
      .addScaledVector(_forward, Math.cos(phase) * radius)
      .addScaledVector(_right, Math.sin(phase) * radius);
    return out;
  }

  function scan(time) {
    targets.length = 0;
    if (zone === "city") addCityTargets(getCityBirdFlocks?.(), time);
    else addGateTargets(getGateBirdVortex?.(), time);
    targetCursor = targets.length ? targetCursor % targets.length : 0;
    // 舰队分队自己的目标池
    fleetTargets.length = 0;
    if (nFleet > 0 && getFleetAnchor?.()) addFleetTargets(time);
  }

  /**
   * 姿态：机头指速度矢量 + 协调转弯压坡度。
   *
   * 旧版把 forward 完全投影到切平面（projectTangent），俯仰恒为 0——
   * 爬升、俯冲、贴地平移，机身姿态一模一样，看起来就像在地面上滑行。
   * 现在保留一部分径向分量（限幅 SCOUT_PITCH_LIMIT ≈ 23°）：
   * 爬升抬头、下降低头，转弯时坡度和机头一起动，才像一架在飞的飞机。
   */
  function orientAircraft(aircraft, forwardHint = null, bank = 0) {
    _up.copy(aircraft.position).normalize();
    _forward.copy(forwardHint || aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
    if (_forward.lengthSq() < 1e-10) _forward.set(0, 0, 1);
    _forward.normalize();
    const vert = _forward.dot(_up);
    const maxVert = Math.sin(SCOUT_PITCH_LIMIT);
    if (Math.abs(vert) > maxVert) {
      // ⚠️ 不能只「削掉超限的径向分量再归一化」——那样在接近垂直时会失效：
      // 水平分量本来就很小，削完再归一化，径向占比反而被放大回去
      // （实测能到 79°）。正确做法是把水平/垂直**分别**摆到限幅上：
      // 水平分量拉到 cos(limit)、垂直分量设成 ±sin(limit)，航向不变。
      _right.copy(_forward).addScaledVector(_up, -vert); // 借 _right 当水平分量的暂存
      if (_right.lengthSq() < 1e-10) {
        // 正对着天顶/地心飞：没有航向可留，退回上一帧的航向
        _right.copy(aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
        _right.addScaledVector(_up, -_right.dot(_up));
        if (_right.lengthSq() < 1e-10) _right.set(1, 0, 0).addScaledVector(_up, -_up.x);
      }
      _right.normalize().multiplyScalar(Math.cos(SCOUT_PITCH_LIMIT));
      _forward.copy(_right).addScaledVector(_up, Math.sign(vert) * maxVert).normalize();
    }
    _right.crossVectors(_up, _forward);
    // forward 与 up 几乎共线时叉积退化：退回切平面版本，别让基底塌掉
    if (_right.lengthSq() < 1e-8) {
      _forward.copy(aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
      projectTangent(_forward, _up);
      _right.crossVectors(_up, _forward);
    }
    _right.normalize();
    _right.applyAxisAngle(_forward, THREE.MathUtils.clamp(bank, -0.72, 0.72));
    _bankedUp.crossVectors(_forward, _right).normalize();
    _basis.makeBasis(_right, _bankedUp, _forward);
    aircraft.quaternion.setFromRotationMatrix(_basis);
    aircraft.userData.forward = _forward.clone();
  }

  function makeShot(unit, target, time) {
    if (!target || target.pending) return false;
    target.pending = true;
    unit.attackCd = SHOT_INTERVAL + (unit.index % 3) * 0.12;
    unit.flashT = 0.22;
    unit.group.updateWorldMatrix?.(true, false);
    _targetPos.copy(target.position);
    const muzzleAnchors = unit.group.userData.gunMuzzles?.length
      ? unit.group.userData.gunMuzzles
      : [unit.group];
    const tracers = [];
    for (const muzzle of muzzleAnchors) {
      muzzle.getWorldPosition(_shotPos);
      const from = _shotPos.clone();
      const bolt = new THREE.Mesh(shotGeo, shotMat);
      bolt.position.copy(from);
      bolt.renderOrder = 20;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([from, _targetPos]);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({
          color: 0xffefaa,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      line.renderOrder = 19;
      const flash = new THREE.Mesh(
        flashGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfff4bd,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      flash.position.copy(from);
      flash.scale.set(1.5, 0.75, 1.5);
      flash.renderOrder = 21;
      root.add(bolt, line, flash);
      tracers.push({ bolt, line, flash, from });
    }
    shots.push({ tracers, to: _targetPos.clone(), t: 0, target, unit, time });
    return true;
  }

  function tickShots(dt, time) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.t += dt;
      const u = Math.min(1, shot.t / SHOT_FLIGHT_TIME);
      for (const tracer of shot.tracers) {
        tracer.bolt.position.lerpVectors(tracer.from, shot.to, u);
        const position = tracer.line.geometry.attributes.position;
        position.setXYZ(0, tracer.from.x, tracer.from.y, tracer.from.z);
        position.setXYZ(1, tracer.bolt.position.x, tracer.bolt.position.y, tracer.bolt.position.z);
        position.needsUpdate = true;
        tracer.line.material.opacity = 0.9 * (1 - u * 0.7);
        tracer.flash.material.opacity = 0.95 * Math.max(0, 1 - u * 8);
        tracer.flash.scale.setScalar(1.5 + u * 0.9);
      }
      if (u < 1) continue;

      const hit = shot.target.hit(time);
      shot.target.pending = false;
      if (hit) onHit(shot.target.zone);
      for (const tracer of shot.tracers) {
        root.remove(tracer.bolt, tracer.line, tracer.flash);
        tracer.line.geometry.dispose();
        tracer.line.material.dispose();
        tracer.flash.material.dispose();
      }
      shots.splice(i, 1);
    }
  }

  /**
   * @param {number} minAgl 硬性最低离地高度（米）。0 = 不限（水晶城守卫沿用旧行为）
   */
  function moveUnit(unit, desired, dt, speed = SCOUT_SPEED, minAgl = 0) {
    // 飞机感（主人验收 2026-08-28）：速度矢量 + 转向加速度上限——
    // 速度不能瞬变，只能沿有限加速度收敛 → 大半径滑翔弧线与压坡度，
    // 不再出现每帧瞬移方向的苍蝇抖动。
    if (!unit.velocity) unit.velocity = new THREE.Vector3(0, 0, 1).multiplyScalar(speed * 0.4);
    _pos.copy(unit.group.position);
    _axis.subVectors(desired, _pos);
    const distance = _axis.length();

    // 期望速度：朝目标点，接近时线性收敛到悬停（不打转）
    const desiredSpeed = Math.min(speed, distance * 1.6);
    _desired.copy(_axis).normalize().multiplyScalar(Number.isFinite(desiredSpeed) ? desiredSpeed : 0);

    // 转向加速度钳制（水平投影为主，垂直分量减半，飞行更沉稳）
    _axis.subVectors(_desired, unit.velocity);
    const steerClamp = SCOUT_TURN_ACCEL * dt;
    if (_axis.length() > steerClamp) _axis.setLength(steerClamp);
    unit.velocity.addScaledVector(_axis, 1);
    if (unit.velocity.lengthSq() < 1e-6) unit.velocity.set(0, 0, 0.01);

    unit.group.position.addScaledVector(unit.velocity, dt);
    _up.copy(unit.group.position).normalize();

    // ---- 硬性 AGL 下限：侦察机不许掉到地面高度 ----
    // 主人 2026-09-06 的截屏就是这条缺失的后果：三架机贴着地面停在红盔堆里。
    // 撞到下限时把**向下的速度分量**抹掉（不是弹回去），飞机会自然改平。
    if (minAgl > 0) {
      const minR = R + minAgl;
      if (unit.group.position.length() < minR) {
        unit.group.position.setLength(minR);
        const sink = unit.velocity.dot(_up);
        if (sink < 0) unit.velocity.addScaledVector(_up, -sink);
      }
    }

    // 机头跟速度矢量走（不再压平）：爬升抬头、下降低头，俯仰由 orientAircraft 限幅
    _forward.copy(unit.velocity);
    if (_forward.lengthSq() < 1e-10) _forward.copy(unit.group.userData.forward || _up);
    _forward.normalize();
    // 坡度只看**航向**的变化率，别把爬升/下降算成转弯
    _axis.copy(unit.group.userData.forward || _forward);
    _axis.crossVectors(_axis, _forward);
    const turn = _axis.dot(_up);
    const bankGoal = THREE.MathUtils.clamp(-turn * 5.2, -0.78, 0.78);
    unit.bank += (bankGoal - unit.bank) * Math.min(1, dt * 5);
    orientAircraft(unit.group, _forward, unit.bank);
    unit.group.userData.lastDistance = distance;
  }

  function updateUnits(dt, time) {
    const activeTargets = targets.filter((target) => !target.pending);
    const activeFleet = fleetTargets.filter((target) => !target.pending);
    const frame = zone === "city" ? cityHomeFrame() : gateHomeFrame();
    // 战场中心：有它，前 nFleet 架就是舰队分队；没有（舰队不在场）就全员守家
    const fleetAnchor = nFleet > 0 ? getFleetAnchor?.() : null;
    for (const unit of units) {
      unit.group.userData.update?.(time, dt);
      if (unit.manual) continue;
      unit.attackCd = Math.max(0, unit.attackCd - dt);
      unit.flashT = Math.max(0, unit.flashT - dt);
      const light = unit.group.userData.beaconLight;
      if (light) light.intensity = unit.flashT > 0 ? 1.4 : 0.55;

      // 编入舰队的那几架：目标池、巡航位都换成战场那一套
      const onFleet = !!fleetAnchor && unit.index < nFleet;
      unit.fleet = onFleet;
      const pool = onFleet ? activeFleet : activeTargets;

      if (onFleet) {
        // ================= 编入舰队的侦察机：standoff 盘旋 =================
        // 业界 ISR 机的基本盘：**在目标外侧保持一个盘旋圈，传感器内指**，
        // 机身自始至终不进入对方的近距。这里就是那个圈——不管圈里有没有目标，
        // 航迹都是同一个圈，指示靠射程（DESIGNATE_RANGE），不靠飞过去。
        //
        // 旧代码在这儿走的是水晶城猎鸟那套「飞到目标身上打」，
        // 目标又趴在地上，于是侦察机一头扎进红盔堆里贴地悬停（主人 2026-09-06 截屏）。
        const orbit = fleetOrbitPosition(unit.index, time, fleetAnchor, _desired);
        // 僚机间隔：在圈上也要互相让开，别叠在一起
        for (const other of units) {
          if (other === unit || !other.fleet) continue;
          _axis.subVectors(unit.group.position, other.group.position);
          const gap = _axis.length();
          if (gap > 1e-5 && gap < MIN_FORMATION_GAP) {
            orbit.addScaledVector(_axis.normalize(), (MIN_FORMATION_GAP - gap) * 1.8);
          }
        }
        // 「轻灵迅捷」：编入舰队的机比守家的快一档。三个舰种的质感要拉开——
        // 气垫船稳重如山、武装直升机沉着悬停、侦察机轻快地绕着圈跑。
        moveUnit(unit, orbit, dt, SCOUT_SPEED * 1.25, FLEET_MIN_AGL);
        // 曳光指示：够得着就打，够不着就等下一圈转过来——不许为了打而下高度
        if (unit.attackCd <= 0 && pool.length) {
          const target = pool[(targetCursor + unit.index * 2 + volley) % pool.length];
          if (target && unit.group.position.distanceTo(target.position) <= DESIGNATE_RANGE) {
            makeShot(unit, target, time);
          }
        }
        continue;
      }

      if (pool.length) {
        const target = pool[
          (targetCursor + unit.index * 2 + volley) % pool.length
        ];
        const slot = ATTACK_FORMATION[unit.index % ATTACK_FORMATION.length];
        _desired.copy(target.position);
        _up.copy(_desired).normalize();
        _forward.copy(frame.forward);
        projectTangent(_forward, _up, unit.group.userData.forward);
        _right.crossVectors(_up, _forward).normalize();
        if (_right.lengthSq() < 1e-8) _right.copy(frame.right);
        _desired
          .addScaledVector(_forward, slot.forward)
          .addScaledVector(_right, slot.side)
          .addScaledVector(_up, slot.up);
        // 编队间隔约束：每架机都对邻机保留安全半径，追击时仍会共同收拢，
        // 但不会因为目标移动或换区转场而相互穿插。
        for (const other of units) {
          if (other === unit) continue;
          _axis.subVectors(unit.group.position, other.group.position);
          const gap = _axis.length();
          if (gap > 1e-5 && gap < MIN_FORMATION_GAP) {
            _desired.addScaledVector(_axis.normalize(), (MIN_FORMATION_GAP - gap) * 1.8);
          }
        }
        moveUnit(unit, _desired, dt, SCOUT_SPEED + (unit.index % 2) * 0.8);
        if (
          unit.attackCd <= 0 &&
          unit.group.position.distanceTo(target.position) <= ATTACK_RANGE
        ) {
          makeShot(unit, target, time);
        }
      } else {
        const home = homePosition(unit.index, _desired, zone);
        moveUnit(unit, home, dt, SCOUT_SPEED * 0.7);
      }
    }
    const cursorPool = Math.max(activeTargets.length, activeFleet.length);
    if (cursorPool) {
      targetCursor = (targetCursor + Math.max(1, Math.floor(dt * 3))) % cursorPool;
      volley = (volley + 1) % Math.max(1, cursorPool);
    }
  }

  for (let i = 0; i < n; i++) {
    const group = createTripleGateScoutAircraft({ scale: 0.72 });
    group.userData.scoutIndex = i;
    group.userData.forward = new THREE.Vector3(0, 0, 1);
    group.position.copy(homePosition(i));
    orientAircraft(group, group.userData.forward);
    root.add(group);
    units.push({
      group,
      index: i,
      attackCd: i * 0.22,
      flashT: 0,
      bank: 0,
      velocity: new THREE.Vector3(0, 0, 1).multiplyScalar(SCOUT_SPEED * 0.4),
      manual: false,
    });
  }

  function setPilot(aircraft, manual) {
    const unit = units.find((item) => item.group === aircraft);
    if (!unit) return false;
    unit.manual = !!manual;
    unit.group.userData.manualPilot = !!manual;
    return true;
  }

  function update(dt = 0.016, time = 0) {
    const delta = Math.min(0.05, Math.max(0, Number(dt) || 0));
    zoneT += delta;
    scanT -= delta;
    if (zoneT >= ZONE_DWELL) {
      zoneT = 0;
      zone = zone === "city" ? "gate" : "city";
      targets.length = 0;
      scanT = 0;
    }
    if (scanT <= 0) {
      scanT = SCAN_INTERVAL;
      scan(time);
    }
    tickShots(delta, time);
    updateUnits(delta, time);
  }

  root.userData.members = units.map((unit) => unit.group);
  root.userData.units = units;
  root.userData.update = update;
  root.userData.setPilot = setPilot;
  root.userData.getZone = () => zone;
  root.userData.getTargetCount = () => targets.length;
  root.userData.getStatus = () => ({
    zone, targetCount: targets.length, count: units.length,
    fleetCount: nFleet, fleetTargets: fleetTargets.length,
  });

  return {
    root,
    units,
    update,
    setPilot,
    getZone: () => zone,
    getTargetCount: () => targets.length,
    getStatus: () => ({
      zone, targetCount: targets.length, count: units.length,
      fleetCount: nFleet, fleetTargets: fleetTargets.length,
    }),
    /** 编入舰队的那几架（测试/调试用） */
    fleetUnits: () => units.filter((u) => u.index < nFleet),
  };
}
