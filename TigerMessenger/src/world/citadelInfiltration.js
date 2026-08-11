import * as THREE from "three";
import { createNightInfiltrationSoldier } from "../assets/harbor.js";
import { citadelTerraceMetrics } from "./odysseyCitadel.js";

const NIGHT_OPEN = 0.82;
const NIGHT_CLOSE = 0.22;
const DROP_DURATION = 2.8;
// 同一根主绳：上一名落地后，下一名才从腹舱开始下降。
const DROP_SEQUENCE_GAP = 3.15;
const MOVE_DELAY = 0.45;
const WATERFALL_MOVE_DURATION = 19;
const STAIR_MOVE_DURATION = 22;
const PATROL_LOOP_DURATION = 32;
const RETURN_APPROACH_DURATION = 4.5;
const RETURN_DURATION = 2.6;
const RETURN_SEQUENCE_GAP = 3.0;

const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _tmpD = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _basis = new THREE.Matrix4();

function isNight(phase) {
  const p = ((Number(phase) || 0) + 1) % 1;
  return p >= NIGHT_OPEN || p < NIGHT_CLOSE;
}

function smoothstep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function makePath(points) {
  const safe = (Array.isArray(points) ? points : []).filter(Boolean).map((p) => p.clone());
  if (safe.length < 2) return { points: safe, lengths: [0], total: 0 };
  const lengths = [0];
  for (let i = 1; i < safe.length; i++) {
    lengths.push(lengths[i - 1] + safe[i - 1].distanceTo(safe[i]));
  }
  return { points: safe, lengths, total: lengths[lengths.length - 1] };
}

function samplePath(path, amount, out) {
  if (!path.points.length) return out.set(0, 0, 0);
  if (path.points.length === 1 || path.total < 1e-5) return out.copy(path.points[0]);
  const distance = THREE.MathUtils.clamp(amount, 0, 1) * path.total;
  let index = 1;
  while (index < path.lengths.length && path.lengths[index] < distance) index++;
  const a = path.points[Math.max(0, index - 1)];
  const b = path.points[Math.min(path.points.length - 1, index)];
  const start = path.lengths[Math.max(0, index - 1)];
  const span = Math.max(1e-5, path.lengths[Math.min(path.lengths.length - 1, index)] - start);
  return out.copy(a).lerp(b, (distance - start) / span);
}

function setHeading(object, direction, up) {
  _forward.copy(direction).addScaledVector(up, -direction.dot(up));
  if (_forward.lengthSq() < 1e-8) return;
  _forward.normalize();
  _right.crossVectors(up, _forward).normalize();
  _basis.makeBasis(_right, up, _forward);
  object.quaternion.setFromRotationMatrix(_basis);
}

function updateRope(rope, start, end) {
  _tmpA.copy(end).sub(start);
  const length = _tmpA.length();
  rope.visible = length > 0.015;
  if (!rope.visible) return;
  rope.position.copy(start).addScaledVector(_tmpA, 0.5);
  rope.scale.set(1, length, 1);
  rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _tmpA.normalize());
}

function shiftedPath(points, offset, side) {
  return points.map((point) => point.clone().addScaledVector(side, offset));
}

/** 收集指定台地的建筑旁巡游点，目标高度落在对应台面而不是建筑体内。 */
function collectPatrolTargets(castle, terraceIndices, up) {
  const targetsByTerrace = new Map(terraceIndices.map((index) => [index, []]));
  if (!castle) return targetsByTerrace;
  const metrics = citadelTerraceMetrics(castle.userData?.contourSpec);
  castle.updateWorldMatrix(true, false);
  const local = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  castle.traverse((object) => {
    if (!object.isMesh || object.name !== "town-cell") return;
    const terraceIndex = object.userData?.cell?.terraceIndex;
    if (!targetsByTerrace.has(terraceIndex)) return;
    object.getWorldPosition(candidate);
    castle.worldToLocal(local.copy(candidate));
    const radial = Math.hypot(local.x, local.z) || 1;
    // 建筑中心外推一个半单元，士兵巡游在建筑旁而不是穿过墙体。
    local.x += (local.x / radial) * 1.25;
    local.z += (local.z / radial) * 1.25;
    local.y = (metrics[terraceIndex]?.top ?? local.y) + 0.22;
    const target = castle.localToWorld(local.clone()).addScaledVector(up, 0.08);
    const points = targetsByTerrace.get(terraceIndex);
    if (points.some((point) => point.distanceToSquared(target) < 8.0)) return;
    points.push(target);
  });
  // 默认旧布局可能只在台面 1 有建筑，台面 5–3 会是空的；仍为这些台面
  // 生成贴着台面外圈的巡游点，确保分组路线不会跳过用户指定的层级。
  for (const terraceIndex of terraceIndices) {
    const points = targetsByTerrace.get(terraceIndex);
    if (points?.length) continue;
    const metric = metrics[terraceIndex];
    if (!metric) continue;
    const radius = Math.max(3, metric.radius - 1.4);
    for (let i = 0; i < 4; i++) {
      const phi = -2.35 + i * 1.25;
      local.set(
        radius * Math.sin(phi),
        metric.top + 0.22,
        radius * Math.cos(phi)
      );
      points.push(castle.localToWorld(local.clone()).addScaledVector(up, 0.08));
    }
  }
  return targetsByTerrace;
}

/**
 * 木马夜间潜入事件。
 *
 * 两组各四名纸士兵共用一根主绳，按顺序从腹舱下降：每组两名持盾、两名左手持火炬，
 * 全员落地后再分别沿瀑布和城堡折返阶梯向上。路线点已经由 citadelRange 按
 * 当前台地/瀑布几何计算为世界坐标，因此动画不会依赖旧的平面高度。
 */
export function createCitadelNightInfiltration({
  scene,
  horse,
  staticSquad,
  siteUp,
  siteRight,
  horseGround,
  waterfallRoute,
  stairRoute,
  patrolCastle = null,
}) {
  _up.copy(siteUp).normalize();
  _right.copy(siteRight).normalize();

  const root = new THREE.Group();
  root.name = "citadel-night-infiltration";
  root.visible = false;
  scene.add(root);

  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x24170f,
    roughness: 0.95,
    flatShading: true,
  });
  const baseGround = horseGround.clone().addScaledVector(_up, 0.08);
  const baseRoutes = {
    waterfall: makePath([baseGround, ...(waterfallRoute || [])]),
    stairs: makePath([baseGround, ...(stairRoute || [])]),
  };
  const terraceTargets = collectPatrolTargets(
    patrolCastle,
    [0, 1, 2, 3, 4],
    _up
  );
  const descentAnchor = horse.localToWorld(new THREE.Vector3(0, 2.46, 0));
  const descentRope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 1, 5),
    ropeMat
  );
  descentRope.name = "single-descent-rope";
  root.add(descentRope);

  const groups = [];
  const records = [];
  const groupSpecs = [
    {
      name: "waterfall-infiltration-group",
      routeKey: "waterfall",
      route: baseRoutes.waterfall,
      moveDuration: WATERFALL_MOVE_DURATION,
      patrolDuration: PATROL_LOOP_DURATION,
      patrolTerraces: [1, 0], // 台面 2、1 层
      lateralOffsets: [-0.34, -0.11, 0.11, 0.34],
    },
    {
      name: "stair-infiltration-group",
      routeKey: "stairs",
      route: baseRoutes.stairs,
      moveDuration: STAIR_MOVE_DURATION,
      patrolDuration: PATROL_LOOP_DURATION,
      patrolTerraces: [4, 3, 2], // 台面 5、4、3 层
      lateralOffsets: [-0.46, -0.15, 0.15, 0.46],
    },
  ];

  for (let groupIndex = 0; groupIndex < groupSpecs.length; groupIndex++) {
    const spec = groupSpecs[groupIndex];
    const group = new THREE.Group();
    group.name = spec.name;
    group.userData.route = spec.routeKey;
    group.userData.patrolTerraces = spec.patrolTerraces.slice();
    group.userData.patrolTargetCount = spec.patrolTerraces.reduce(
      (count, terraceIndex) => count + (terraceTargets.get(terraceIndex)?.length || 0),
      0
    );
    root.add(group);
    groups.push(group);

    for (let i = 0; i < 4; i++) {
      const torchLeft = i === 0 || i === 2;
      const soldier = createNightInfiltrationSoldier({ torchLeft });
      soldier.userData.group = spec.routeKey;
      soldier.userData.equipmentRole = torchLeft ? "torch" : "shield";
      group.add(soldier);

      const dropTarget = baseGround
        .clone()
        .addScaledVector(_right, spec.lateralOffsets[i])
        .addScaledVector(_up, 0.02);
      const routePoints = shiftedPath(
        spec.route.points,
        spec.lateralOffsets[i],
        _right
      );
      routePoints[0].copy(dropTarget);
      const patrolTargets = spec.patrolTerraces.flatMap(
        (terraceIndex) => terraceTargets.get(terraceIndex) || []
      );
      const shiftedPatrolTargets = shiftedPath(
        patrolTargets,
        spec.lateralOffsets[i],
        _right
      );
      const approachPath = makePath(routePoints);
      const approachEnd = routePoints.at(-1)?.clone() || dropTarget.clone();
      const record = {
        soldier,
        group,
        groupIndex,
        index: i,
        anchor: descentAnchor.clone(),
        dropTarget,
        path: approachPath,
        patrolPath: makePath([approachEnd, ...shiftedPatrolTargets, approachEnd]),
        moveDuration: spec.moveDuration,
        patrolDuration: spec.patrolDuration,
        patrolTerraces: spec.patrolTerraces,
      };
      records.push(record);
    }
  }

  let active = false;
  let returning = false;
  let previousNight = false;
  let elapsed = 0;
  let returnElapsed = 0;
  let returnRecords = [];

  const setRecordPose = (record, position, lookDirection) => {
    record.soldier.position.copy(position);
    setHeading(record.soldier, lookDirection, _up);
  };

  const resetForDay = () => {
    active = false;
    returning = false;
    returnElapsed = 0;
    returnRecords = [];
    elapsed = 0;
    root.visible = false;
    staticSquad.visible = true;
    horse.userData.setBellyOpen?.(0);
    descentRope.visible = false;
    for (const record of records) {
      record.soldier.visible = false;
      setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
    }
  };

  const startNight = () => {
    active = true;
    returning = false;
    returnElapsed = 0;
    returnRecords = [];
    elapsed = 0;
    root.visible = true;
    staticSquad.visible = false;
    descentRope.visible = false;
    for (const record of records) {
      record.soldier.visible = false;
      setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
    }
  };

  const startReturn = () => {
    active = false;
    returning = true;
    returnElapsed = 0;
    root.visible = true;
    staticSquad.visible = false;
    descentRope.visible = false;
    horse.userData.setBellyOpen?.(1);
    returnRecords = [];
    for (const record of records) {
      const deployed = record.soldier.visible;
      record.returnSkip = !deployed;
      record.returnStart = deployed
        ? record.soldier.getWorldPosition(new THREE.Vector3())
        : record.anchor.clone();
      if (deployed) {
        record.returnIndex = returnRecords.length;
        returnRecords.push(record);
      } else {
        record.returnIndex = -1;
        record.soldier.visible = false;
      }
    }
    if (!returnRecords.length) resetForDay();
  };

  const updateReturn = (dt) => {
    returnElapsed += Math.max(0, Number(dt) || 0);
    horse.userData.setBellyOpen?.(1);
    const allReturnEnd = RETURN_APPROACH_DURATION
      + Math.max(0, returnRecords.length - 1) * RETURN_SEQUENCE_GAP
      + RETURN_DURATION;
    let ascending = false;

    for (const record of records) {
      if (record.returnSkip) {
        record.soldier.visible = false;
        continue;
      }
      if (returnElapsed < RETURN_APPROACH_DURATION) {
        record.soldier.visible = true;
        const t = smoothstep01(returnElapsed / RETURN_APPROACH_DURATION);
        _tmpA.copy(record.returnStart).lerp(record.dropTarget, t);
        setRecordPose(record, _tmpA, _tmpB.copy(record.dropTarget).sub(record.returnStart));
        continue;
      }

      const localTime = returnElapsed
        - RETURN_APPROACH_DURATION
        - record.returnIndex * RETURN_SEQUENCE_GAP;
      if (localTime <= 0) {
        record.soldier.visible = true;
        setRecordPose(record, record.dropTarget, _tmpA.copy(record.anchor).sub(record.dropTarget));
        continue;
      }
      if (localTime < RETURN_DURATION) {
        ascending = true;
        record.soldier.visible = true;
        const t = smoothstep01(localTime / RETURN_DURATION);
        _tmpA.copy(record.dropTarget).lerp(record.anchor, t);
        setRecordPose(record, _tmpA, _tmpB.copy(record.anchor).sub(record.dropTarget));
        _tmpD.copy(_tmpA).addScaledVector(_up, 0.34);
        continue;
      }
      record.soldier.visible = false;
      setRecordPose(record, record.anchor, _tmpA.copy(record.anchor).sub(record.dropTarget));
    }

    if (ascending) {
      updateRope(descentRope, descentAnchor, _tmpD);
    } else if (returnElapsed >= RETURN_APPROACH_DURATION && returnElapsed < allReturnEnd + 0.35) {
      const returnedIndex = Math.min(
        returnRecords.length - 1,
        Math.max(
          0,
          Math.floor((returnElapsed - RETURN_APPROACH_DURATION - RETURN_DURATION) / RETURN_SEQUENCE_GAP)
        )
      );
      updateRope(
        descentRope,
        descentAnchor,
        _tmpD.copy(returnRecords[returnedIndex].dropTarget).addScaledVector(_up, 0.34)
      );
    } else {
      descentRope.visible = false;
    }

    if (returnElapsed >= allReturnEnd + 0.45) resetForDay();
  };

  const update = (dt, _time, phase) => {
    const night = isNight(phase);
    if (night && !previousNight) startNight();
    if (!night && previousNight) startReturn();
    previousNight = night;
    if (returning) {
      updateReturn(dt);
      return;
    }
    if (!night || !active) return;

    elapsed += Math.max(0, Number(dt) || 0);
    horse.userData.setBellyOpen?.(smoothstep01(elapsed / 2.8));
    const allDropEnd = (records.length - 1) * DROP_SEQUENCE_GAP + DROP_DURATION;
    let descending = false;

    for (const record of records) {
      const localTime = elapsed - record.index * DROP_SEQUENCE_GAP;
      const dropT = THREE.MathUtils.clamp(localTime / DROP_DURATION, 0, 1);
      if (localTime <= 0) {
        record.soldier.visible = false;
        setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
        continue;
      }

      record.soldier.visible = true;
      if (localTime < DROP_DURATION) {
        descending = true;
        const eased = smoothstep01(dropT);
        _tmpA.copy(record.anchor).lerp(record.dropTarget, eased);
        setRecordPose(record, _tmpA, _tmpB.copy(record.dropTarget).sub(record.anchor));
        _tmpD.copy(_tmpA).addScaledVector(_up, 0.34);
        continue;
      }

      // 所有人落地前，已经完成下降的士兵在木马旁等待，不提前分路行进。
      if (elapsed < allDropEnd + MOVE_DELAY) {
        _tmpB.copy(record.path.points[1] || record.dropTarget).sub(record.dropTarget);
        setRecordPose(record, record.dropTarget, _tmpB);
        continue;
      }

      const sortieElapsed = elapsed - allDropEnd - MOVE_DELAY;
      const approachT = THREE.MathUtils.clamp(
        sortieElapsed / record.moveDuration,
        0,
        1
      );
      if (approachT < 1 || record.patrolPath.total < 1e-5) {
        samplePath(record.path, smoothstep01(approachT), _tmpA);
        if (approachT < 1) {
          samplePath(record.path, Math.min(1, approachT + 0.015), _tmpB);
        } else {
          samplePath(record.path, Math.max(0, approachT - 0.015), _tmpB);
        }
      } else {
        const patrolElapsed = sortieElapsed - record.moveDuration;
        const patrolT = (patrolElapsed / record.patrolDuration) % 1;
        samplePath(record.patrolPath, patrolT, _tmpA);
        samplePath(record.patrolPath, (patrolT + 0.015) % 1, _tmpB);
      }
      setRecordPose(record, _tmpA, _tmpC.copy(_tmpB).sub(_tmpA));
    }

    if (descending) {
      updateRope(descentRope, descentAnchor, _tmpD);
    } else if (elapsed > 0 && elapsed < allDropEnd + MOVE_DELAY) {
      const landedIndex = Math.min(
        records.length - 1,
        Math.max(0, Math.floor((elapsed - DROP_DURATION) / DROP_SEQUENCE_GAP))
      );
      updateRope(
        descentRope,
        descentAnchor,
        _tmpD.copy(records[landedIndex].dropTarget).addScaledVector(_up, 0.34)
      );
    } else {
      descentRope.visible = false;
    }
  };

  resetForDay();
  root.userData.groups = groups;
  root.userData.soldiers = records.map((record) => record.soldier);
  root.userData.descentRope = descentRope;
  root.userData.getState = () => ({
    active,
    returning,
    night: previousNight,
    elapsed,
    returnElapsed,
    insideHorse: records.filter((record) => !record.soldier.visible).length,
    groups: groups.map((group) => ({
      name: group.name,
      count: group.children.length,
      patrolTerraces: group.userData.patrolTerraces,
      patrolTargetCount: group.userData.patrolTargetCount,
    })),
    torchBearers: records.filter((record) => record.soldier.userData.torchBearer).length,
    ropesVisible: descentRope.visible ? 1 : 0,
    descentRopes: descentRope.visible ? 1 : 0,
    descentOrder: records.map((record) => record.soldier.name),
  });

  return { root, update, reset: resetForDay, getState: root.userData.getState };
}
