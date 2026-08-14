import * as THREE from "three";
import { createNightInfiltrationSoldier } from "../assets/harbor.js";
import { citadelTerraceMetrics } from "./odysseyCitadel.js";
import { setInfiltrationBgm, updateInfiltrationBgm } from "../audio/sfx.js";
import { tickObjectSedation } from "./tranquilizer.js";

// 一入夜即行动（与 dayNight 入夜≈0.85、窗户/鸟群夜栖≈0.82 对齐），
// 不再等到 0.93 深夜，留给攀爬/巡查更长时间。
const NIGHT_OPEN = 0.82;
const NIGHT_CLOSE = 0.22;
const DROP_DURATION = 2.8;
// 每组两根下降绳：两批各两名士兵同时下降，完成两批后全组落地。
const DROP_SEQUENCE_GAP = 3.15;
const DESCENT_BATCH_SIZE = 2;
const MOVE_DELAY = 0.45;
// 瀑布攀爬要留出完整的拉扯、推举、搀扶表现，再进入台面分散巡查。
const WATERFALL_MOVE_DURATION = 24;
const STAIR_MOVE_DURATION = 28;
// 快速巡查：阶梯组仍比瀑布组慢，保留两组行动节奏差异。
const WATERFALL_PATROL_DURATION = 12;
const STAIR_PATROL_DURATION = 18;
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
// 进场/攀爬纵队的士兵间距（身位）：2.5 个身长，前后不贴身、可看清拉/推/搀扶分工。
const APPROACH_SPACING = SOLDIER_BODY_LENGTH * 2.5;
const SOLDIER_BASE_PACE = 2.4;
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

/**
 * 用短线段沿同一台地表面重建路径，避免世界坐标直线在球面/台地上方形成
 * 悬空弦线。跨到石阶时只对“台面→第一阶”连接段使用这个投影，阶梯本身
 * 保留由 citadelRange 生成的真实踏步高程。
 */
function makeSurfacePath(points, terraceIndex, surfacePoint = null) {
  const safe = (Array.isArray(points) ? points : []).filter(Boolean).map((p) => p.clone());
  if (!surfacePoint || safe.length < 2) return makePath(safe);
  const grounded = [];
  const raw = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const append = (point) => {
    if (!grounded.length || grounded.at(-1).distanceToSquared(point) > 1e-6) {
      grounded.push(point.clone());
    }
  };
  for (let i = 0; i < safe.length - 1; i++) {
    const a = safe[i];
    const b = safe[i + 1];
    const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 1.5));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      raw.lerpVectors(a, b, t);
      const point = surfacePoint(
        { world: raw, terraceIndex },
        projected
      );
      append(point ? point : raw);
    }
  }
  const last = surfacePoint({ world: safe.at(-1), terraceIndex }, projected);
  append(last ? last : safe.at(-1));
  return makePath(grounded);
}

function setHeading(object, direction, up) {
  _forward.copy(direction).addScaledVector(up, -direction.dot(up));
  if (_forward.lengthSq() < 1e-8) return;
  _forward.normalize();
  // 局部 +X 朝向行进方向（与 harborLogistics.orientSoldier 同一约定），
  // 让 buildPorter 的 rotation.z 摆腿/前倾正好落在前后向，而不是侧向平移。
  _right.crossVectors(_forward, up).normalize();
  _basis.makeBasis(_forward, up, _right);
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
function buildDistributedCoverageTargets(
  targetsByTerrace,
  terraceIndices,
  up,
  right,
  surfacePoint = null
) {
  const forward = new THREE.Vector3().crossVectors(right, up).normalize();
  const coverageByTerrace = new Map();
  for (const terraceIndex of terraceIndices) {
    const gateTargets = targetsByTerrace.get(terraceIndex) || [];
    const coverage = [];
    for (const gateTarget of gateTargets) {
      for (const [rightOffset, forwardOffset] of PATROL_COVERAGE_DIRECTIONS) {
        const candidate = gateTarget.clone()
          .addScaledVector(right, rightOffset)
          .addScaledVector(forward, forwardOffset);
        const grounded = surfacePoint
          ? surfacePoint({ world: candidate, terraceIndex }, new THREE.Vector3())
          : candidate.addScaledVector(up, 0.02);
        if (grounded) coverage.push(grounded.clone());
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
  surfacePoint,
  patrolDuration,
}) {
  const coverageByTerrace = buildDistributedCoverageTargets(
    terraceTargets,
    patrolTerraces,
    up,
    right,
    surfacePoint
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
      // 每名士兵领一段「连续扇区」而非跨步取样：连续的点让路径贴着台面
      // 外缘走道顺序前进，避免跨扇区连线穿过建筑夹缝、走进死胡同。
      const perSoldier = Math.max(1, Math.ceil(safeCoverage.length / groupRecords.length));
      const offset = (recordIndex * perSoldier + terraceOrder * 2) % safeCoverage.length;
      for (let k = 0; k < perSoldier; k++) {
        const idx = (offset + k) % safeCoverage.length;
        const point = safeCoverage[idx];
        if (point && (!assigned.length || assigned[assigned.length - 1].distanceToSquared(point) > 1e-6)) {
          assigned.push(point.clone());
        }
      }
      return makeSurfacePath(
        [previousExit[recordIndex], ...assigned],
        terraceIndex,
        surfacePoint
      );
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
      // 先沿当前台面表面走到石阶下端，再沿真实石阶上行；不允许从
      // 台面门口直接拉一条跨空直线到上层台面。
      if (!stairPoints.length) {
        return makeSurfacePath([start], terraceIndex, surfacePoint);
      }
      const connector = makeSurfacePath(
        [start, stairPoints[0]],
        terraceIndex,
        surfacePoint
      );
      return makePath([
        ...connector.points,
        ...stairPoints.slice(1),
      ]);
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
 * 中间两名左手持盾、右手持长枪。落地后解除队列，分别沿瀑布和城堡折返阶梯向上；
 * 台面上四人分散跑步排查，瀑布攀爬时以拉、推、搀扶的手脚姿态快速互助，不使用队列连接绳。路线点已经
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
  // 站点右向量：build/rebuild 巡查计划专用。_right 会被 setHeading 当作
  // scratch 覆盖（见下），不能在下一次 rebuildPlans 时再依赖它。
  const _siteRight = _right.clone();

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
  // 可热重建的路线状态：地形编辑器改台地半径/瀑布/石阶后，由 citadelRange
  // 调 setRoutes() 刷新，避免士兵继续沿旧几何走空中。
  let _waterfallRoute = (waterfallRoute || []).slice();
  let _stairRoute = (stairRoute || []).slice();
  let _stairTransferRoutes = (stairTransferRoutes || []).slice();
  let _patrolSurfacePoint = patrolSurfacePoint || null;
  let terraceTargets = collectPatrolTargets(
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
    group.userData.patrolFormation = "dispersed-running-inspection";
    group.userData.climbingFormation = "mutual-support-no-queue";
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
      soldier.userData.queueSpacing = 0;
      soldier.userData.descentSpacing = SOLDIER_BODY_LENGTH;
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
        // 下降阶段仍记录绳索批次，但落地后的进场、攀爬和巡查不再按身长排队。
        queueDistance: 0,
        queueSpacing: 0,
        descentSpacing: SOLDIER_BODY_LENGTH,
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
      right: _siteRight,
      surfacePoint: patrolSurfacePoint,
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
          ? record.path.total / speed
          : record.moveDuration;
      })
    );
    group.userData.queueSpacing = 0;
    group.userData.descentSpacing = SOLDIER_BODY_LENGTH;
    group.userData.queueOrder = groupRecords.map((record) => record.soldier.name);
    group.userData.records = groupRecords;
  }

  /** 用当前路线状态重建各组的进场路径与分散巡查计划（地形热重建）。 */
  const rebuildPlans = () => {
    baseRoutes.waterfall = makePath([baseGround, ..._waterfallRoute]);
    baseRoutes.stairs = makePath([baseGround, ..._stairRoute]);
    terraceTargets = collectPatrolTargets(
      patrolCastle,
      [0, 1, 2, 3, 4],
      _up,
      _patrolSurfacePoint
    );
    for (const group of groups) {
      const route = baseRoutes[group.userData.route];
      const groupRecords = group.userData.records || [];
      if (!route || !groupRecords.length) continue;
      const patrolDuration = groupRecords[0].patrolDuration;
      const patrolTerraces = group.userData.patrolTerraces;
      for (const record of groupRecords) {
        const routePoints = route.points.map((point) => point.clone());
        routePoints[0].copy(record.dropTarget);
        record.path = makePath(routePoints);
      }
      const approachEnd = groupRecords[0].path.points.at(-1)?.clone()
        || baseGround.clone();
      const patrolPlan = buildDistributedPatrolPlan({
        groupRecords,
        patrolTerraces,
        terraceTargets,
        stairTransferRoutes: _stairTransferRoutes,
        approachEnd,
        up: _up,
        right: _siteRight,
        surfacePoint: _patrolSurfacePoint,
        patrolDuration,
      });
      for (const record of groupRecords) record.patrolPlan = patrolPlan;
      group.userData.patrolPlan = patrolPlan;
      group.userData.patrolTargetCount = [...patrolPlan.coverageByTerrace.values()]
        .reduce((count, targets) => count + targets.length, 0);
      group.userData.patrolTransferCount = patrolPlan.segments
        .filter((segment) => segment.kind === "stair-transfer")
        .length;
    }
  };

  /** 地形编辑器热重建后刷新路线（citadelRange 在 rebuildWaterTerraces 里调用）。 */
  const setRoutes = (next = {}) => {
    if (Array.isArray(next.waterfallRoute)) _waterfallRoute = next.waterfallRoute.slice();
    if (Array.isArray(next.stairRoute)) _stairRoute = next.stairRoute.slice();
    if (Array.isArray(next.stairTransferRoutes)) {
      _stairTransferRoutes = next.stairTransferRoutes.slice();
    }
    if (typeof next.patrolSurfacePoint === "function") {
      _patrolSurfacePoint = next.patrolSurfacePoint;
    }
    rebuildPlans();
  };

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

  const setMovementPose = (record, moving, climbing, clock, pace = 1) => {
    const parts = record.soldier.userData.parts;
    if (!parts) return;
    record.soldier.userData.climbing = !!climbing;
    const paceScale = THREE.MathUtils.clamp(Number(pace) || 1, 0.55, 1.65);
    const sprinting = moving && !climbing;
    const strideRate = moving
      ? (sprinting ? 6.4 + paceScale * 2.4 : 5.8 + paceScale * 2.0)
      : 0;
    const stridePhase = clock * strideRate + record.index * 0.9;
    const gait = moving ? Math.sin(stridePhase) : 0;
    const stride = moving ? Math.sin(stridePhase + Math.PI) : 0;
    const torchBearer = !!record.soldier.userData.torchBearer;
    record.soldier.userData.motionMode = moving
      ? (climbing ? "mutual-support-climb" : "sprint-inspection")
      : "idle";
    // buildPorter 的躯干是独立髋部节点；轻微起伏和前倾让脚步不再像整块
    // 几何被路径平移，而是形成纸偶式的小跑节奏。
    parts.body.position.y = 0.17 + (moving ? 0.012 * (0.5 - 0.5 * Math.cos(stridePhase * 2)) : 0);
    if (climbing) {
      // 队首拉、队尾推、中间搀扶：手臂大幅上伸 + 身体前倾，配合纵队间距
      // 让“拉-搀-推”的协作分工清晰可见，而不是挤成一团往上挪。
      const action = record.index === 0
        ? "pull"
        : record.index === 3
          ? "push"
          : "support";
      record.soldier.userData.assistAction = action;
      // 攀爬节奏：身体沿行进方向（+X）前倾，随步频起伏，模拟向上蹬踏
      parts.body.rotation.z = -0.26 + gait * 0.03;
      // 双臂上举：队首最高（拉岩点），队尾次之（推前方），中间平伸（搀扶）
      parts.armL.rotation.z = torchBearer
        ? 0.5 + gait * 0.08
        : action === "support"
          ? 1.0 + gait * 0.1
          : 0.92 + gait * 0.08;
      parts.armR.rotation.z = action === "pull"
        ? 1.28 + gait * 0.06
        : action === "push"
          ? 1.1 + gait * 0.06
          : 0.86 + gait * 0.08;
      // 双腿交替蹬踏（比跑步略收），贴合岩壁
      parts.legL.rotation.z = 0.34 + gait * 0.28;
      parts.legR.rotation.z = -0.3 - gait * 0.28;
      return;
    }
    record.soldier.userData.assistAction = "march";
    parts.body.rotation.z = moving
      ? (sprinting ? -0.16 + gait * 0.045 : -0.12 + gait * 0.035)
      : 0;
    // 左右手脚交叉摆动：左腿前摆时右臂后摆，火炬手左臂只做小幅护持。
    const armSwing = moving ? gait * (sprinting ? 0.62 : 0.5) : 0;
    const torchArmSwing = moving ? gait * 0.12 : 0;
    parts.armL.rotation.z = moving
      ? -0.38 + (torchBearer ? torchArmSwing : armSwing)
      : -0.38;
    parts.armR.rotation.z = moving ? 0.38 - armSwing : 0.38;
    const legSwing = sprinting ? 0.8 : 0.68;
    parts.legL.rotation.z = moving ? 0.12 - stride * legSwing : 0.08;
    parts.legR.rotation.z = moving ? -0.12 + stride * legSwing : -0.08;
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
    // 士兵回到木马腹内 → 结束任务 BGM（无论远近都停）
    setInfiltrationBgm(false, { fade: 1.0 });
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
    // 仅标记任务进行中；真正起播看玩家是否靠近场景
    setInfiltrationBgm(true, { fade: 0.6 });
  };

  const _bgmSource = new THREE.Vector3();
  /** 按玩家距离更新太鼓：靠近木马/圣城才响 */
  const tickInfiltrationBgm = (listener) => {
    if (!active && !returning) return;
    horse.getWorldPosition(_bgmSource);
    updateInfiltrationBgm(listener || null, _bgmSource);
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

  /**
   * @param {number} dt
   * @param {number} _time
   * @param {number} phase
   * @param {{ listener?: THREE.Vector3 }} [ctx] listener = 玩家世界坐标
   */
  const update = (dt, _time, phase, ctx = {}) => {
    const night = isNight(phase);
    if (night && !previousNight) startNight();
    if (!night && previousNight) startReturn();
    previousNight = night;
    // 距离门控：行动/回程期间每帧更新；远离场景不启播
    tickInfiltrationBgm(ctx.listener);
    if (returning) {
      updateReturn(dt);
      return;
    }
    if (!night || !active) return;

    elapsed += Math.max(0, Number(dt) || 0);
    horse.userData.setBellyOpen?.(smoothstep01(elapsed / 2.8));
    for (const record of records) {
      // 麻醉弹：卧倒僵直，跳过绳降/行军（倒计时结束后苏醒继续）
      if (record.soldier.visible && tickObjectSedation(record.soldier, dt)) {
        record.soldier.userData.motionMode = "sedated";
        continue;
      }
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

      // 每名士兵完成自己的绳降后立即出发，不等待整组排成一列；两批士兵
      // 仍按绳索批次落地，但落地后直接进入各自的快速攀登路径。
      const sortieElapsed = elapsed
        - record.batchIndex * DROP_SEQUENCE_GAP
        - DROP_DURATION
        - MOVE_DELAY;
      if (sortieElapsed <= 0) {
        _tmpB.copy(record.path.points[1] || record.dropTarget).sub(record.dropTarget);
        setMovementPose(record, false, false, elapsed);
        setRecordPose(record, record.dropTarget, _tmpB);
        continue;
      }

      // 进场/攀爬阶段恢复纵向间距：队首（index 0）领先，其余按 2-3 身位依次跟进。
      // 用「独立进度 + 时间延迟」而非固定距离偏移：尾兵虽然落后，但最终也走完全程
      // 进入巡查；否则 leaderDistance 到终点后被钳制，尾兵永远差 index*间距到不了终点、
      // 卡死在瀑布/石阶前。抵达台面后再切换到分散排查（巡查阶段不排队）。
      const ownProgress = THREE.MathUtils.clamp(
        sortieElapsed / Math.max(0.001, record.moveDuration)
          - record.index * APPROACH_SPACING / Math.max(1e-5, record.path.total),
        0,
        1
      );
      const ownApproachDistance = ownProgress * record.path.total;
      let climbing = false;
      if (ownApproachDistance < record.path.total) {
        const approachDistance = Math.max(0, ownApproachDistance);
        samplePathDistance(record.path, approachDistance, _tmpA);
        samplePathDistance(
          record.path,
          Math.min(record.path.total, approachDistance + 0.24),
          _tmpB
        );
        climbing = record.group.userData.route === "waterfall";
        const approachPace = THREE.MathUtils.clamp(
          record.path.total / Math.max(0.001, record.moveDuration) / SOLDIER_BASE_PACE,
          0.55,
          1.65
        );
        setMovementPose(record, true, climbing, sortieElapsed, approachPace);
      } else {
        // 每人独立开始巡查：不等队尾，不回到队列；分配到不同屋门/扇区的
        // patrolPath 会把四人自然拉开，台面段统一使用跑步姿态。
        const patrolElapsed = sortieElapsed - record.moveDuration;
        const segment = samplePatrolPlan(
          record.patrolPlan,
          patrolElapsed,
          record.index,
          _tmpA,
          _tmpB
        );
        const moving = segment?.kind === "terrace-patrol"
          || segment?.kind === "stair-transfer";
        const patrolPace = segment?.paths?.[record.index]
          ? segment.kind === "terrace-patrol"
            ? Math.max(
                1.35,
                THREE.MathUtils.clamp(
                  segment.paths[record.index].total
                    / Math.max(0.001, segment.duration)
                    / SOLDIER_BASE_PACE,
                  0.55,
                  1.65
                )
              )
            : THREE.MathUtils.clamp(
                segment.paths[record.index].total
                  / Math.max(0.001, segment.duration)
                  / SOLDIER_BASE_PACE,
                0.55,
                1.65
              )
          : 1;
        setMovementPose(record, moving, false, sortieElapsed, patrolPace);
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
  root.userData.queueSpacing = 0;
  root.userData.getState = () => ({
    active,
    returning,
    night: previousNight,
    activationPhase: NIGHT_OPEN,
    queueSpacing: 0,
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
      patrolFormation: group.userData.patrolFormation,
      climbingFormation: group.userData.climbingFormation,
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

  return { root, update, reset: resetForDay, setRoutes, getState: root.userData.getState };
}
