import * as THREE from "three";
import { createNightInfiltrationSoldier } from "../assets/harbor.js";
import { citadelTerraceMetrics } from "./odysseyCitadel.js";

// 0.93 已越过暮色，天空进入接近午夜的深蓝/黑色后才触发潜入。
const NIGHT_OPEN = 0.93;
const NIGHT_CLOSE = 0.22;
const DROP_DURATION = 2.8;
// 每组一根下降绳：组内上一名落地后，下一名才从该组绳索下降。
const DROP_SEQUENCE_GAP = 3.15;
const MOVE_DELAY = 0.45;
const WATERFALL_MOVE_DURATION = 19;
const STAIR_MOVE_DURATION = 28;
const WATERFALL_PATROL_DURATION = 32;
const STAIR_PATROL_DURATION = 48;
// PORTER_SCALE=2 的纸士兵，从脚到头约 0.7 个场景单位；队列按一个身长留空。
const SOLDIER_BODY_LENGTH = 0.72;
const RETURN_APPROACH_DURATION = 4.5;
const RETURN_DURATION = 2.6;
const RETURN_SEQUENCE_GAP = 3.0;

const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
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

function samplePathDistance(path, distance, out) {
  if (!path.total) return out.copy(path.points[0] || _tmpA.set(0, 0, 0));
  return samplePath(path, distance / path.total, out);
}

function wrapPathDistance(distance, total) {
  if (total < 1e-5) return 0;
  return ((distance % total) + total) % total;
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
 * 两组各四名纸士兵各用一根腹舱下降绳，按组内顺序依次下降：每组队首、队尾左手持火炬，
 * 中间两名左手持盾、右手持短剑。落地后保持一个士兵身长的队列间距，分别沿
 * 瀑布和城堡折返阶梯向上；攀爬时以拉、推、搀扶的姿态连接相邻队员。路线点已经
 * 由 citadelRange 按当前台地/瀑布几何计算为世界坐标，因此动画不会依赖旧的平面高度。
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
  // 腹舱两侧各开一个绳降点：左侧给瀑布组，右侧给阶梯组。
  const descentAnchors = [-0.58, 0.58].map((x) =>
    horse.localToWorld(new THREE.Vector3(x, 2.46, 0))
  );

  const groups = [];
  const records = [];
  const groupSpecs = [
    {
      name: "waterfall-infiltration-group",
      routeKey: "waterfall",
      route: baseRoutes.waterfall,
      moveDuration: WATERFALL_MOVE_DURATION,
      patrolDuration: WATERFALL_PATROL_DURATION,
      patrolTerraces: [1, 0], // 台面 2、1 层
    },
    {
      name: "stair-infiltration-group",
      routeKey: "stairs",
      route: baseRoutes.stairs,
      moveDuration: STAIR_MOVE_DURATION,
      patrolDuration: STAIR_PATROL_DURATION,
      patrolTerraces: [4, 3, 2], // 台面 5、4、3 层
    },
  ];

  const descentRopes = groupSpecs.map((spec, index) => {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1, 5),
      ropeMat
    );
    rope.name = `${spec.routeKey}-descent-rope`;
    rope.userData.groupIndex = index;
    rope.visible = false;
    root.add(rope);
    return rope;
  });

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

    const groupRecords = [];
    for (let i = 0; i < 4; i++) {
      // 队首和队尾举火把；中间两名持盾，形成首尾照明、中段防护的队形。
      const torchLeft = i === 0 || i === 3;
      const soldier = createNightInfiltrationSoldier({ torchLeft });
      soldier.userData.group = spec.routeKey;
      soldier.userData.equipmentRole = torchLeft ? "torch" : "shield";
      soldier.userData.queueIndex = i;
      soldier.userData.queueSpacing = SOLDIER_BODY_LENGTH;
      group.add(soldier);

      const dropTarget = baseGround.clone().addScaledVector(_up, 0.02);
      const routePoints = spec.route.points.map((point) => point.clone());
      routePoints[0].copy(dropTarget);
      const patrolTargets = spec.patrolTerraces.flatMap(
        (terraceIndex) => terraceTargets.get(terraceIndex) || []
      );
      const shiftedPatrolTargets = patrolTargets.map((point) => point.clone());
      const approachPath = makePath(routePoints);
      const approachEnd = routePoints.at(-1)?.clone() || dropTarget.clone();
      const record = {
        soldier,
        group,
        groupIndex,
        index: i,
        anchor: descentAnchors[groupIndex].clone(),
        dropTarget,
        path: approachPath,
        patrolPath: makePath([approachEnd, ...shiftedPatrolTargets, approachEnd]),
        queueDistance: i * SOLDIER_BODY_LENGTH,
        queueSpacing: SOLDIER_BODY_LENGTH,
        moveDuration: spec.moveDuration,
        patrolDuration: spec.patrolDuration,
        patrolTerraces: spec.patrolTerraces,
      };
      records.push(record);
      groupRecords.push(record);
    }
    group.userData.queueSpacing = SOLDIER_BODY_LENGTH;
    group.userData.queueOrder = groupRecords.map((record) => record.soldier.name);
    group.userData.records = groupRecords;
  }

  // 攀爬时用细绳/扶带把相邻士兵的肩背连接起来：队首向上拉、队尾向上推，
  // 中间队员彼此搀扶。辅助绳放在独立节点，避免污染每组的四名士兵计数。
  const assistanceRoot = new THREE.Group();
  assistanceRoot.name = "citadel-climbing-assistance";
  assistanceRoot.visible = false;
  root.add(assistanceRoot);
  const assistanceLinks = [];
  const assistanceMat = new THREE.MeshStandardMaterial({
    color: 0x705137,
    roughness: 0.95,
    flatShading: true,
  });
  for (const group of groups) {
    const groupRecords = group.userData.records || [];
    for (let i = 1; i < groupRecords.length; i++) {
      const link = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 1, 5),
        assistanceMat
      );
      link.name = `${group.userData.route}-climbing-assist-link-${i}`;
      link.userData.front = groupRecords[i - 1];
      link.userData.rear = groupRecords[i];
      assistanceRoot.add(link);
      assistanceLinks.push(link);
    }
  }

  let active = false;
  let returning = false;
  let previousNight = false;
  let elapsed = 0;
  let returnElapsed = 0;
  let returnRecords = [];
  let returnRecordsByGroup = [];

  const setRecordPose = (record, position, lookDirection) => {
    record.soldier.position.copy(position);
    setHeading(record.soldier, lookDirection, _up);
  };

  const setMovementPose = (record, moving, climbing, clock) => {
    const parts = record.soldier.userData.parts;
    if (!parts) return;
    record.soldier.userData.climbing = !!climbing;
    const gait = moving ? Math.sin(clock * 4.6 + record.index * 0.9) : 0;
    const torchBearer = !!record.soldier.userData.torchBearer;
    if (climbing) {
      // 队首右手拉住前方岩点，队尾右手推举前方队员，中间两人展开双臂搀扶。
      const action = record.index === 0
        ? "pull"
        : record.index === 3
          ? "push"
          : "support";
      record.soldier.userData.assistAction = action;
      parts.body.rotation.z = -0.16 + gait * 0.025;
      parts.armL.rotation.z = torchBearer
        ? 0.34 + gait * 0.06
        : 0.92 + gait * 0.08;
      parts.armR.rotation.z = action === "pull"
        ? 1.12 + gait * 0.05
        : action === "push"
          ? 0.98 + gait * 0.05
          : 0.78 + gait * 0.07;
      parts.legL.rotation.z = 0.28 + gait * 0.25;
      parts.legR.rotation.z = -0.24 - gait * 0.25;
      return;
    }
    record.soldier.userData.assistAction = "march";
    parts.body.rotation.z = moving ? -0.1 : 0;
    parts.armL.rotation.z = moving ? 0.35 + gait * 0.16 : 0.35;
    parts.armR.rotation.z = moving ? 0.35 - gait * 0.16 : 0.35;
    parts.legL.rotation.z = moving ? gait * 0.5 : 0;
    parts.legR.rotation.z = moving ? -gait * 0.5 : 0;
  };

  const assistA = new THREE.Vector3();
  const assistB = new THREE.Vector3();
  const assistDir = new THREE.Vector3();
  const assistUp = new THREE.Vector3(0, 1, 0);
  const updateClimbingAssistance = (climbing) => {
    let visible = false;
    for (const link of assistanceLinks) {
      const front = link.userData.front;
      const rear = link.userData.rear;
      if (!climbing || !front?.soldier.visible || !rear?.soldier.visible) {
        link.visible = false;
        continue;
      }
      front.soldier.getWorldPosition(assistA).addScaledVector(_up, 0.35);
      rear.soldier.getWorldPosition(assistB).addScaledVector(_up, 0.30);
      assistDir.copy(assistA).sub(assistB);
      const length = assistDir.length();
      if (length < 0.02) {
        link.visible = false;
        continue;
      }
      link.visible = true;
      visible = true;
      link.position.copy(assistA).add(assistB).multiplyScalar(0.5);
      link.scale.set(1, length, 1);
      link.quaternion.setFromUnitVectors(assistUp, assistDir.normalize());
    }
    assistanceRoot.visible = visible;
  };

  const hideDescentRopes = () => {
    for (const rope of descentRopes) rope.visible = false;
  };

  const updateDescentRopes = (dropElapsed) => {
    const allDropEnd = Math.max(
      0,
      ...groups.map((group) =>
        Math.max(0, (group.userData.records?.length || 0) - 1) * DROP_SEQUENCE_GAP
        + DROP_DURATION
      )
    );
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const rope = descentRopes[groupIndex];
      const groupRecords = groups[groupIndex].userData.records || [];
      let activeRecord = null;
      let activeLocalTime = 0;
      for (const record of groupRecords) {
        const localTime = dropElapsed - record.index * DROP_SEQUENCE_GAP;
        if (localTime > 0 && localTime < DROP_DURATION) {
          activeRecord = record;
          activeLocalTime = localTime;
          break;
        }
      }
      if (activeRecord) {
        const t = smoothstep01(activeLocalTime / DROP_DURATION);
        const ropeEnd = activeRecord.anchor.clone().lerp(activeRecord.dropTarget, t);
        ropeEnd.addScaledVector(_up, 0.34);
        updateRope(rope, activeRecord.anchor, ropeEnd);
        continue;
      }
      if (dropElapsed > DROP_DURATION && dropElapsed < allDropEnd + MOVE_DELAY) {
        const landedIndex = Math.min(
          groupRecords.length - 1,
          Math.max(0, Math.floor((dropElapsed - DROP_DURATION) / DROP_SEQUENCE_GAP))
        );
        const landed = groupRecords[landedIndex];
        updateRope(
          rope,
          landed.anchor,
          landed.dropTarget.clone().addScaledVector(_up, 0.34)
        );
        continue;
      }
      rope.visible = false;
    }
  };

  const resetForDay = () => {
    active = false;
    returning = false;
    returnElapsed = 0;
    returnRecords = [];
    returnRecordsByGroup = [];
    elapsed = 0;
    root.visible = false;
    staticSquad.visible = true;
    horse.userData.setBellyOpen?.(0);
    hideDescentRopes();
    assistanceRoot.visible = false;
    for (const record of records) {
      record.soldier.visible = false;
      setMovementPose(record, false, false, 0);
      setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
    }
  };

  const startNight = () => {
    active = true;
    returning = false;
    returnElapsed = 0;
    returnRecords = [];
    returnRecordsByGroup = groups.map(() => []);
    elapsed = 0;
    root.visible = true;
    staticSquad.visible = false;
    hideDescentRopes();
    assistanceRoot.visible = false;
    for (const record of records) {
      record.soldier.visible = false;
      setMovementPose(record, false, false, 0);
      setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
    }
  };

  const startReturn = () => {
    active = false;
    returning = true;
    returnElapsed = 0;
    root.visible = true;
    staticSquad.visible = false;
    hideDescentRopes();
    assistanceRoot.visible = false;
    horse.userData.setBellyOpen?.(1);
    returnRecords = [];
    for (const record of records) {
      const deployed = record.soldier.visible;
      record.returnSkip = !deployed;
      record.returnStart = deployed
        ? record.soldier.getWorldPosition(new THREE.Vector3())
        : record.anchor.clone();
      if (deployed) {
        const groupReturnRecords = returnRecordsByGroup[record.groupIndex];
        record.returnIndex = groupReturnRecords.length;
        groupReturnRecords.push(record);
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
    const maxGroupReturnCount = Math.max(
      0,
      ...returnRecordsByGroup.map((groupRecords) => groupRecords.length)
    );
    horse.userData.setBellyOpen?.(1);
    const allReturnEnd = RETURN_APPROACH_DURATION
      + Math.max(0, maxGroupReturnCount - 1) * RETURN_SEQUENCE_GAP
      + RETURN_DURATION;

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
        record.soldier.visible = true;
        const t = smoothstep01(localTime / RETURN_DURATION);
        _tmpA.copy(record.dropTarget).lerp(record.anchor, t);
        setRecordPose(record, _tmpA, _tmpB.copy(record.anchor).sub(record.dropTarget));
        continue;
      }
      record.soldier.visible = false;
      setRecordPose(record, record.anchor, _tmpA.copy(record.anchor).sub(record.dropTarget));
    }

    const returnRopeEnd = new THREE.Vector3();
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const rope = descentRopes[groupIndex];
      const groupReturnRecords = returnRecordsByGroup[groupIndex] || [];
      const ascendingRecord = groupReturnRecords.find((record) => {
        const localTime = returnElapsed
          - RETURN_APPROACH_DURATION
          - record.returnIndex * RETURN_SEQUENCE_GAP;
        return localTime > 0 && localTime < RETURN_DURATION;
      });
      if (ascendingRecord) {
        const localTime = returnElapsed
          - RETURN_APPROACH_DURATION
          - ascendingRecord.returnIndex * RETURN_SEQUENCE_GAP;
        const t = smoothstep01(localTime / RETURN_DURATION);
        returnRopeEnd
          .copy(ascendingRecord.dropTarget)
          .lerp(ascendingRecord.anchor, t)
          .addScaledVector(_up, 0.34);
        updateRope(rope, ascendingRecord.anchor, returnRopeEnd);
      } else if (
        returnElapsed >= RETURN_APPROACH_DURATION
        && returnElapsed < allReturnEnd + 0.35
        && groupReturnRecords.length
      ) {
        const returnedIndex = Math.min(
          groupReturnRecords.length - 1,
          Math.max(
            0,
            Math.floor(
              (returnElapsed - RETURN_APPROACH_DURATION - RETURN_DURATION)
              / RETURN_SEQUENCE_GAP
            )
          )
        );
        updateRope(
          rope,
          groupReturnRecords[returnedIndex].anchor,
          groupReturnRecords[returnedIndex].dropTarget.clone().addScaledVector(_up, 0.34)
        );
      } else {
        rope.visible = false;
      }
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
    for (const record of records) {
      const localTime = elapsed - record.index * DROP_SEQUENCE_GAP;
      const dropT = THREE.MathUtils.clamp(localTime / DROP_DURATION, 0, 1);
      if (localTime <= 0) {
        record.soldier.visible = false;
        setMovementPose(record, false, false, elapsed);
        setRecordPose(record, record.anchor, _tmpA.copy(record.dropTarget).sub(record.anchor));
        continue;
      }

      record.soldier.visible = true;
      if (localTime < DROP_DURATION) {
        const eased = smoothstep01(dropT);
        _tmpA.copy(record.anchor).lerp(record.dropTarget, eased);
        setMovementPose(record, false, false, elapsed);
        setRecordPose(record, _tmpA, _tmpB.copy(record.dropTarget).sub(record.anchor));
        continue;
      }

      // 所有人落地前，已经完成下降的士兵在木马旁等待，不提前分路行进。
      if (elapsed < allDropEnd + MOVE_DELAY) {
        _tmpB.copy(record.path.points[1] || record.dropTarget).sub(record.dropTarget);
        setMovementPose(record, false, false, elapsed);
        setRecordPose(record, record.dropTarget, _tmpB);
        continue;
      }

      const sortieElapsed = elapsed - allDropEnd - MOVE_DELAY;
      // 用队首的行进距离减去“一个士兵身长 × 队列序号”，让每人沿同一条路线
      // 保持前后间隔；队尾会自然晚于队首抵达台面，避免四人挤成一团。
      const frontApproachDistance = Math.min(
        record.path.total,
        Math.max(0, sortieElapsed / record.moveDuration) * record.path.total
      );
      const ownApproachDistance = frontApproachDistance - record.queueDistance;
      let climbing = false;
      if (ownApproachDistance < record.path.total || record.patrolPath.total < 1e-5) {
        const approachDistance = Math.max(0, ownApproachDistance);
        samplePathDistance(record.path, approachDistance, _tmpA);
        samplePathDistance(
          record.path,
          Math.min(record.path.total, approachDistance + 0.24),
          _tmpB
        );
        climbing = ownApproachDistance >= 0 && ownApproachDistance < record.path.total;
        setMovementPose(record, true, climbing, sortieElapsed);
      } else {
        const patrolLeaderDistance =
          Math.max(0, sortieElapsed - record.moveDuration)
          / record.patrolDuration
          * record.patrolPath.total;
        const ownPatrolDistance = patrolLeaderDistance - record.queueDistance;
        const patrolDistance = wrapPathDistance(
          ownPatrolDistance,
          record.patrolPath.total
        );
        samplePathDistance(record.patrolPath, patrolDistance, _tmpA);
        samplePathDistance(
          record.patrolPath,
          wrapPathDistance(patrolDistance + 0.24, record.patrolPath.total),
          _tmpB
        );
        setMovementPose(record, true, false, sortieElapsed);
      }
      setRecordPose(record, _tmpA, _tmpC.copy(_tmpB).sub(_tmpA));
      record.soldier.userData.climbing = climbing;
    }

    updateClimbingAssistance(
      records.some((record) => record.soldier.visible && record.soldier.userData.climbing)
    );

    updateDescentRopes(elapsed);
  };

  resetForDay();
  root.userData.groups = groups;
  root.userData.soldiers = records.map((record) => record.soldier);
  // 保留单数别名兼容旧调试入口；实际运行使用两根组绳。
  root.userData.descentRope = descentRopes[0];
  root.userData.descentRopes = descentRopes;
  root.userData.assistance = assistanceRoot;
  root.userData.activationPhase = NIGHT_OPEN;
  root.userData.queueSpacing = SOLDIER_BODY_LENGTH;
  root.userData.getState = () => ({
    active,
    returning,
    night: previousNight,
    activationPhase: NIGHT_OPEN,
    queueSpacing: SOLDIER_BODY_LENGTH,
    elapsed,
    returnElapsed,
    insideHorse: records.filter((record) => !record.soldier.visible).length,
    groups: groups.map((group) => ({
      name: group.name,
      count: group.children.length,
      patrolTerraces: group.userData.patrolTerraces,
      patrolTargetCount: group.userData.patrolTargetCount,
      queueSpacing: group.userData.queueSpacing,
      queueOrder: group.userData.queueOrder,
      patrolDuration: group.userData.records?.[0]?.patrolDuration || 0,
    })),
    torchBearers: records.filter((record) => record.soldier.userData.torchBearer).length,
    torchQueueIndices: records
      .filter((record) => record.soldier.userData.torchBearer)
      .map((record) => `${record.group.userData.route}:${record.index}`),
    assistanceLinksVisible: assistanceRoot.visible
      ? assistanceLinks.filter((link) => link.visible).length
      : 0,
    ropesVisible: descentRopes.filter((rope) => rope.visible).length,
    descentRopes: descentRopes.filter((rope) => rope.visible).length,
    descentOrder: records.map((record) => record.soldier.name),
  });

  return { root, update, reset: resetForDay, getState: root.userData.getState };
}
