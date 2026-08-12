import * as THREE from "three";
import { createNightInfiltrationSoldier } from "../assets/harbor.js";
import { citadelTerraceMetrics } from "./odysseyCitadel.js";

// 0.93 已越过暮色，天空进入接近午夜的深蓝/黑色后才触发潜入。
const NIGHT_OPEN = 0.93;
const NIGHT_CLOSE = 0.22;
const DROP_DURATION = 2.8;
// 每组两根下降绳：两批各两名士兵同时下降，完成两批后全组落地。
const DROP_SEQUENCE_GAP = 3.15;
const DESCENT_BATCH_SIZE = 2;
const MOVE_DELAY = 0.45;
// 瀑布攀爬要留出完整的拉扯、推举、搀扶表现，再进入台面分散巡查。
const WATERFALL_MOVE_DURATION = 32;
const STAIR_MOVE_DURATION = 28;
const WATERFALL_PATROL_DURATION = 32;
const STAIR_PATROL_DURATION = 48;
const STAIR_TRANSFER_DURATION = 28;
const PATROL_COVERAGE_DIRECTIONS = Object.freeze([
  [0.0, -2.4],
  [1.8, -1.8],
  [2.8, -0.6],
  [3.1, 0.8],
  [2.3, 1.8],
  [0.8, 2.4],
  [-0.8, 2.4],
  [-2.3, 1.8],
  [-3.1, 0.8],
  [-2.8, -0.6],
  [-1.8, -1.8],
  [0.0, -2.4],
]);
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

/**
 * 收集指定台地的正门巡游点。目标由真实 town-gate 节点确定，再通过
 * surfacePoint 贴回对应台地表面，避免使用建筑中心或固定高度造成悬空。
 */
function collectPatrolTargets(castle, terraceIndices, up, surfacePoint = null) {
  const targetsByTerrace = new Map(terraceIndices.map((index) => [index, []]));
  if (!castle) return targetsByTerrace;
  const metrics = citadelTerraceMetrics(castle.userData?.contourSpec);
  castle.updateWorldMatrix(true, false);
  const local = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const placeOnTerraceSurface = (x, z, terraceIndex) => {
    if (surfacePoint) {
      return surfacePoint({ x, z, terraceIndex }, candidate)
        .clone()
        .addScaledVector(up, 0.1);
    }
    local.set(x, (metrics[terraceIndex]?.top ?? 0) + 0.14, z);
    return castle.localToWorld(local.clone()).addScaledVector(up, 0.08);
  };

  // 每个台地只认真正的正门节点；门外一点即为士兵的巡游/集合点。
  castle.traverse((object) => {
    if (object.name !== "town-gate") return;
    let parent = object;
    let terraceIndex = null;
    while (parent) {
      if (Number.isFinite(parent.userData?.terraceIndex)) {
        terraceIndex = parent.userData.terraceIndex | 0;
        break;
      }
      parent = parent.parent;
    }
    if (!targetsByTerrace.has(terraceIndex)) return;
    object.getWorldPosition(candidate);
    castle.worldToLocal(local.copy(candidate));
    local.z += 1.35; // town-gate 正面朝 castle-local +Z
    const target = placeOnTerraceSurface(local.x, local.z, terraceIndex);
    const points = targetsByTerrace.get(terraceIndex);
    if (points.some((point) => point.distanceToSquared(target) < 8.0)) return;
    points.push(target);
  });

  // 编辑器可能保存没有正门的空台地；用该台地前缘的表面点兜底，仍不允许悬空。
  for (const terraceIndex of terraceIndices) {
    const points = targetsByTerrace.get(terraceIndex);
    if (points?.length) continue;
    const metric = metrics[terraceIndex];
    if (!metric) continue;
    const frontZ = Math.max(2.5, metric.radius - 1.5);
    points.push(placeOnTerraceSurface(0, frontZ, terraceIndex));
  }
  return targetsByTerrace;
}

/**
 * 把每个台地的门口扩展为一圈逐步覆盖点。四名士兵各取一段不同方向，
 * 进入台地后不再保持队列，也不再沿同一条闭合巡游线重叠。
 */
function buildDistributedCoverageTargets(targetsByTerrace, terraceIndices, up, right) {
  const forward = new THREE.Vector3().crossVectors(right, up).normalize();
  const coverageByTerrace = new Map();
  for (const terraceIndex of terraceIndices) {
    const gateTargets = targetsByTerrace.get(terraceIndex) || [];
    const coverage = [];
    for (const gateTarget of gateTargets) {
      for (const [rightOffset, forwardOffset] of PATROL_COVERAGE_DIRECTIONS) {
        coverage.push(
          gateTarget.clone()
            .addScaledVector(right, rightOffset)
            .addScaledVector(forward, forwardOffset)
            .addScaledVector(up, 0.02)
        );
      }
    }
    coverageByTerrace.set(terraceIndex, coverage);
  }
  return coverageByTerrace;
}

function getStairTransfer(stairTransferRoutes, fromTerrace, toTerrace) {
  return (Array.isArray(stairTransferRoutes) ? stairTransferRoutes : []).find(
    (transfer) => transfer?.fromTerrace === fromTerrace
      && transfer?.toTerrace === toTerrace
      && Array.isArray(transfer.points)
      && transfer.points.length >= 2
  ) || null;
}

/**
 * 为每名士兵生成独立的台面覆盖段，并在相邻台面之间插入真实石阶段。
 * patrolPath 不闭合：一个台面覆盖完成后才会进入下一段阶梯，不会在当前台面
 * 无限绕圈，也不会把四人继续绑成一列。
 */
function buildDistributedPatrolPlan({
  groupRecords,
  patrolTerraces,
  terraceTargets,
  stairTransferRoutes,
  approachEnd,
  up,
  right,
  patrolDuration,
}) {
  const coverageByTerrace = buildDistributedCoverageTargets(
    terraceTargets,
    patrolTerraces,
    up,
    right
  );
  const segments = [];
  let previousExit = groupRecords.map(() => approachEnd.clone());

  for (let terraceOrder = 0; terraceOrder < patrolTerraces.length; terraceOrder++) {
    const terraceIndex = patrolTerraces[terraceOrder];
    const coverage = coverageByTerrace.get(terraceIndex) || [];
    const safeCoverage = coverage.length
      ? coverage
      : [approachEnd.clone()];
    const patrolPaths = groupRecords.map((record, recordIndex) => {
      const assigned = [];
      // 每名士兵从不同扇区开始，并以队伍人数为步长分担整个台面。
      for (let pointIndex = recordIndex; pointIndex < safeCoverage.length; pointIndex += groupRecords.length) {
        assigned.push(
          safeCoverage[(pointIndex + terraceOrder * 2) % safeCoverage.length].clone()
        );
      }
      return makePath([previousExit[recordIndex], ...assigned]);
    });
    segments.push({
      kind: "terrace-patrol",
      terraceIndex,
      duration: patrolDuration,
      paths: patrolPaths,
      coverageCount: coverage.length,
    });
    previousExit = patrolPaths.map((path) => path.points.at(-1)?.clone() || approachEnd.clone());

    const nextTerrace = patrolTerraces[terraceOrder + 1];
    if (!Number.isFinite(nextTerrace)) continue;
    const transfer = getStairTransfer(stairTransferRoutes, terraceIndex, nextTerrace);
    const stairPoints = transfer?.points?.map((point) => point.clone()) || [];
    const transferPaths = groupRecords.map((record, recordIndex) => {
      const start = previousExit[recordIndex];
      // 正常场景一定有 stairTransferRoutes；兜底只避免编辑器删掉阶梯时崩溃。
      return makePath([start, ...stairPoints]);
    });
    segments.push({
      kind: "stair-transfer",
      fromTerrace: terraceIndex,
      toTerrace: nextTerrace,
      duration: STAIR_TRANSFER_DURATION,
      paths: transferPaths,
      stair: !!transfer,
    });
    previousExit = transferPaths.map((path, recordIndex) =>
      path.points.at(-1)?.clone() || previousExit[recordIndex].clone()
    );
  }

  return {
    segments,
    coverageByTerrace,
    totalDuration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    terminalPoints: previousExit,
  };
}

function samplePatrolPlan(plan, elapsed, recordIndex, position, lookAhead) {
  if (!plan?.segments?.length) {
    position.set(0, 0, 0);
    lookAhead.copy(position);
    return null;
  }
  let remaining = Math.max(0, elapsed);
  for (const segment of plan.segments) {
    const duration = Math.max(0.001, segment.duration);
    if (remaining <= duration) {
      const path = segment.paths[recordIndex];
      const progress = THREE.MathUtils.clamp(remaining / duration, 0, 1);
      samplePath(path, progress, position);
      samplePathDistance(path, Math.min(path.total, progress * path.total + 0.28), lookAhead);
      return segment;
    }
    remaining -= duration;
  }
  const last = plan.segments.at(-1);
  const path = last.paths[recordIndex];
  samplePath(path, 1, position);
  lookAhead.copy(position);
  return last;
}

/**
 * 木马夜间潜入事件。
 *
 * 两组各四名纸士兵各用一根腹舱下降绳，按组内顺序依次下降：每组队首、队尾左手持火炬，
 * 中间两名左手持盾、右手持短剑。落地后保持一个士兵身长的队列间距，分别沿
 * 瀑布和城堡折返阶梯向上；攀爬时以拉、推、搀扶的姿态连接相邻队员。路线点已经
 * 由 citadelRange 按当前台地/瀑布/石阶几何计算为世界坐标，因此动画不会依赖旧的平面高度。
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
  stairTransferRoutes = [],
  patrolCastle = null,
  patrolSurfacePoint = null,
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
    _up,
    patrolSurfacePoint
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

  const descentRopeSpecs = groupSpecs.flatMap((spec, groupIndex) =>
    [0, 1].map((slot) => ({ spec, groupIndex, slot }))
  );
  // 腹舱左右两侧各两个绳降点：左侧给瀑布组，右侧给阶梯组。
  const descentAnchors = [-0.72, -0.24, 0.24, 0.72].map((x) =>
    horse.localToWorld(new THREE.Vector3(x, 2.46, 0))
  );
  const descentRopes = descentRopeSpecs.map(({ spec, groupIndex, slot }, ropeIndex) => {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1, 5),
      ropeMat
    );
    rope.name = `${spec.routeKey}-descent-rope-${slot + 1}`;
    rope.userData.groupIndex = groupIndex;
    rope.userData.ropeIndex = ropeIndex;
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
    group.userData.patrolTargetCount = 0;
    group.userData.patrolTargetSource = "town-gate-terrace-surface-distributed";
    group.userData.patrolMode = "distributed-coverage";
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

      const ropeSlot = i % DESCENT_BATCH_SIZE;
      const groupSide = groupIndex === 0 ? -1 : 1;
      const dropTarget = baseGround
        .clone()
        .addScaledVector(
          _right,
          groupSide * 0.38 + (ropeSlot === 0 ? -0.16 : 0.16)
        )
        .addScaledVector(_up, 0.02);
      const routePoints = spec.route.points.map((point) => point.clone());
      routePoints[0].copy(dropTarget);
      const approachPath = makePath(routePoints);
      const approachEnd = routePoints.at(-1)?.clone() || dropTarget.clone();
      const record = {
        soldier,
        group,
        groupIndex,
        index: i,
        ropeIndex: groupIndex * DESCENT_BATCH_SIZE + ropeSlot,
        batchIndex: Math.floor(i / DESCENT_BATCH_SIZE),
        anchor: descentAnchors[groupIndex * DESCENT_BATCH_SIZE + ropeSlot].clone(),
        dropTarget,
        path: approachPath,
        queueDistance: i * SOLDIER_BODY_LENGTH,
        queueSpacing: SOLDIER_BODY_LENGTH,
        moveDuration: spec.moveDuration,
        patrolDuration: spec.patrolDuration,
        patrolTerraces: spec.patrolTerraces,
        patrolPlan: null,
      };
      records.push(record);
      groupRecords.push(record);
    }
    const approachEnd = groupRecords[0]?.path.points.at(-1)?.clone()
      || baseGround.clone();
    const patrolPlan = buildDistributedPatrolPlan({
      groupRecords,
      patrolTerraces: spec.patrolTerraces,
      terraceTargets,
      stairTransferRoutes,
      approachEnd,
      up: _up,
      right: _right,
      patrolDuration: spec.patrolDuration,
    });
    for (const record of groupRecords) record.patrolPlan = patrolPlan;
    group.userData.patrolPlan = patrolPlan;
    group.userData.patrolTargetCount = [...patrolPlan.coverageByTerrace.values()]
      .reduce((count, targets) => count + targets.length, 0);
    group.userData.patrolTransferCount = patrolPlan.segments
      .filter((segment) => segment.kind === "stair-transfer")
      .length;
    group.userData.approachEndTime = Math.max(
      0,
      ...groupRecords.map((record) => {
        const speed = record.path.total / Math.max(0.001, record.moveDuration);
        return speed > 1e-5
          ? (record.path.total + record.queueDistance) / speed
          : record.moveDuration;
      })
    );
    group.userData.queueSpacing = SOLDIER_BODY_LENGTH;
    group.userData.queueOrder = groupRecords.map((record) => record.soldier.name);
    group.userData.records = groupRecords;
  }

  // 攀爬时只通过手臂姿势表现队首拉、队尾推和中间搀扶，
  // 不创建任何连接士兵的可见绳索，避免火炬手被“牵着走”。
  const assistanceRoot = new THREE.Group();
  assistanceRoot.name = "citadel-climbing-hand-support";
  assistanceRoot.userData.mode = "hand-to-hand-no-rope";
  assistanceRoot.visible = false;
  root.add(assistanceRoot);

  let active = false;
  let returning = false;
  let previousNight = false;
  let elapsed = 0;
  let returnElapsed = 0;
  let returnRecords = [];
  let returnRecordsByRope = [];

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

  const updateClimbingAssistance = () => {
    // 手臂动作由 setMovementPose 驱动；这里明确保持空节点隐藏。
    assistanceRoot.visible = false;
  };

  const hideDescentRopes = () => {
    for (const rope of descentRopes) rope.visible = false;
  };

  const updateDescentRopes = (dropElapsed) => {
    const allDropEnd = Math.max(
      0,
      ...groups.map((group) =>
        Math.max(
          0,
          Math.ceil((group.userData.records?.length || 0) / DESCENT_BATCH_SIZE) - 1
        ) * DROP_SEQUENCE_GAP
        + DROP_DURATION
      )
    );
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const groupRecords = groups[groupIndex].userData.records || [];
      for (let ropeSlot = 0; ropeSlot < DESCENT_BATCH_SIZE; ropeSlot++) {
        const rope = descentRopes[groupIndex * DESCENT_BATCH_SIZE + ropeSlot];
        const activeRecord = groupRecords.find(
          (record) => record.index % DESCENT_BATCH_SIZE === ropeSlot
        );
        if (!activeRecord) {
          rope.visible = false;
          continue;
        }
        const localTime = dropElapsed - activeRecord.batchIndex * DROP_SEQUENCE_GAP;
        if (localTime > 0 && localTime < DROP_DURATION) {
          const t = smoothstep01(localTime / DROP_DURATION);
          const ropeEnd = activeRecord.anchor.clone().lerp(activeRecord.dropTarget, t);
          ropeEnd.addScaledVector(_up, 0.34);
          updateRope(rope, activeRecord.anchor, ropeEnd);
          continue;
        }
        if (dropElapsed > DROP_DURATION && dropElapsed < allDropEnd + MOVE_DELAY) {
          const landedBatch = Math.min(
            Math.ceil(groupRecords.length / DESCENT_BATCH_SIZE) - 1,
            Math.max(
              0,
              Math.floor((dropElapsed - DROP_DURATION) / DROP_SEQUENCE_GAP)
            )
          );
          const landed = groupRecords.find(
            (record) =>
              record.batchIndex === landedBatch
              && record.index % DESCENT_BATCH_SIZE === ropeSlot
          );
          if (landed) {
            updateRope(
              rope,
              landed.anchor,
              landed.dropTarget.clone().addScaledVector(_up, 0.34)
            );
            continue;
          }
        }
        rope.visible = false;
      }
    }
  };

  const resetForDay = () => {
    active = false;
    returning = false;
    returnElapsed = 0;
    returnRecords = [];
    returnRecordsByRope = [];
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
    returnRecordsByRope = descentRopes.map(() => []);
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
        const ropeReturnRecords = returnRecordsByRope[record.ropeIndex];
        record.returnIndex = ropeReturnRecords.length;
        ropeReturnRecords.push(record);
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
      ...returnRecordsByRope.map((ropeRecords) => ropeRecords.length)
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
    for (let ropeIndex = 0; ropeIndex < descentRopes.length; ropeIndex++) {
      const rope = descentRopes[ropeIndex];
      const ropeReturnRecords = returnRecordsByRope[ropeIndex] || [];
      const ascendingRecord = ropeReturnRecords.find((record) => {
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
        && ropeReturnRecords.length
      ) {
        const returnedIndex = Math.min(
          ropeReturnRecords.length - 1,
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
          ropeReturnRecords[returnedIndex].anchor,
          ropeReturnRecords[returnedIndex].dropTarget.clone().addScaledVector(_up, 0.34)
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
    const allDropEnd = Math.max(
      0,
      ...groups.map((group) =>
        Math.max(
          0,
          Math.ceil((group.userData.records?.length || 0) / DESCENT_BATCH_SIZE) - 1
        ) * DROP_SEQUENCE_GAP
        + DROP_DURATION
      )
    );
    for (const record of records) {
      const localTime = elapsed - record.batchIndex * DROP_SEQUENCE_GAP;
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
      // 进场阶段仍保持一个士兵身长的纵向间距；队尾到达后，全队才同时
      // 分散进入台面覆盖段。frontApproachDistance 不截断，才能让队尾
      // 真正走完自己的间距后抵达台面。
      const frontApproachDistance =
        Math.max(0, sortieElapsed / record.moveDuration) * record.path.total;
      const ownApproachDistance = frontApproachDistance - record.queueDistance;
      let climbing = false;
      const groupApproachEndTime = record.group.userData.approachEndTime
        ?? record.moveDuration;
      if (ownApproachDistance < record.path.total) {
        const approachDistance = Math.max(0, ownApproachDistance);
        samplePathDistance(record.path, approachDistance, _tmpA);
        samplePathDistance(
          record.path,
          Math.min(record.path.total, approachDistance + 0.24),
          _tmpB
        );
        climbing = record.group.userData.route === "waterfall"
          && ownApproachDistance >= 0
          && ownApproachDistance < record.path.total;
        setMovementPose(record, true, climbing, sortieElapsed);
      } else if (sortieElapsed < groupApproachEndTime) {
        // 最后一名士兵落位前，已到台面的队员在入口等待，不抢先巡查。
        samplePath(record.path, 1, _tmpA);
        _tmpB.copy(_tmpA);
        setMovementPose(record, false, false, sortieElapsed);
      } else {
        const segment = samplePatrolPlan(
          record.patrolPlan,
          sortieElapsed - groupApproachEndTime,
          record.index,
          _tmpA,
          _tmpB
        );
        const moving = segment?.kind === "terrace-patrol"
          || segment?.kind === "stair-transfer";
        setMovementPose(record, moving, false, sortieElapsed);
        record.soldier.userData.patrolStage = segment?.kind || "patrol-complete";
        record.soldier.userData.patrolTerrace = segment?.terraceIndex
          ?? segment?.toTerrace
          ?? null;
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
  root.userData.patrolTargetsByTerrace = terraceTargets;
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
      patrolTargetSource: group.userData.patrolTargetSource,
      patrolMode: group.userData.patrolMode,
      patrolTransferCount: group.userData.patrolTransferCount,
      patrolSegments: group.userData.patrolPlan?.segments.map((segment) => ({
        kind: segment.kind,
        terraceIndex: segment.terraceIndex,
        fromTerrace: segment.fromTerrace,
        toTerrace: segment.toTerrace,
        duration: segment.duration,
        stair: segment.stair,
        coverageCount: segment.coverageCount,
      })),
      queueSpacing: group.userData.queueSpacing,
      queueOrder: group.userData.queueOrder,
      patrolDuration: group.userData.records?.[0]?.patrolDuration || 0,
    })),
    torchBearers: records.filter((record) => record.soldier.userData.torchBearer).length,
    torchQueueIndices: records
      .filter((record) => record.soldier.userData.torchBearer)
      .map((record) => `${record.group.userData.route}:${record.index}`),
    assistanceLinksVisible: 0,
    ropesVisible: descentRopes.filter((rope) => rope.visible).length,
    descentRopes: descentRopes.filter((rope) => rope.visible).length,
    descentOrder: records.map((record) => record.soldier.name),
  });

  return { root, update, reset: resetForDay, getState: root.userData.getState };
}
