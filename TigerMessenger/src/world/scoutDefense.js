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
const SCOUT_TURN_ACCEL = 30; // 转向加速度上限（u/s²）：产生大半径滑翔弧线，而非苍蝇抖动
const ATTACK_RANGE = 10.5;
const MIN_FORMATION_GAP = 7.2;
const SHOT_INTERVAL = 1.55;
const SHOT_FLIGHT_TIME = 0.28;
const BIRD_DOWN_TIME = 5.2;
const BIRD_COOLDOWN = 6.5;

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

  function scan(time) {
    targets.length = 0;
    if (zone === "city") addCityTargets(getCityBirdFlocks?.(), time);
    else addGateTargets(getGateBirdVortex?.(), time);
    targetCursor = targets.length ? targetCursor % targets.length : 0;
  }

  function orientAircraft(aircraft, forwardHint = null, bank = 0) {
    _up.copy(aircraft.position).normalize();
    _forward.copy(forwardHint || aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);
    _right.crossVectors(_up, _forward).normalize();
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

  function moveUnit(unit, desired, dt, speed = SCOUT_SPEED) {
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
    _forward.copy(unit.velocity);
    projectTangent(_forward, _up, unit.group.userData.forward);
    _axis.crossVectors(unit.group.userData.forward || _forward, _forward);
    const turn = _axis.dot(_up);
    const bankGoal = THREE.MathUtils.clamp(-turn * 5.2, -0.78, 0.78);
    unit.bank += (bankGoal - unit.bank) * Math.min(1, dt * 5);
    orientAircraft(unit.group, _forward, unit.bank);
    unit.group.userData.lastDistance = distance;
  }

  function updateUnits(dt, time) {
    const activeTargets = targets.filter((target) => !target.pending);
    const frame = zone === "city" ? cityHomeFrame() : gateHomeFrame();
    for (const unit of units) {
      unit.group.userData.update?.(time, dt);
      if (unit.manual) continue;
      unit.attackCd = Math.max(0, unit.attackCd - dt);
      unit.flashT = Math.max(0, unit.flashT - dt);
      const light = unit.group.userData.beaconLight;
      if (light) light.intensity = unit.flashT > 0 ? 1.4 : 0.55;

      if (activeTargets.length) {
        const target = activeTargets[
          (targetCursor + unit.index * 2 + volley) % activeTargets.length
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
    if (activeTargets.length) {
      targetCursor = (targetCursor + Math.max(1, Math.floor(dt * 3))) % activeTargets.length;
      volley = (volley + 1) % Math.max(1, activeTargets.length);
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
  root.userData.getStatus = () => ({ zone, targetCount: targets.length, count: units.length });

  return {
    root,
    units,
    update,
    setPilot,
    getZone: () => zone,
    getTargetCount: () => targets.length,
    getStatus: () => ({ zone, targetCount: targets.length, count: units.length }),
  };
}
