// =====================================================================
//  帧边界原子提交：编译 + 一致性检查后入队，渲染/导航/AI 同一拍切换。
//  纯数据，不 import Three.js。Three 交换由 onCommit 回调完成。
// =====================================================================

import { assertSnapshotConsistent, migrateOccupants } from "./worldSnapshot.js";

export function createSnapshotCommitQueue() {
  let current = null;
  let pending = null;
  return {
    current: () => current,
    pending: () => pending,
    enqueue(next) {
      assertSnapshotConsistent(next);
      // 未提交的脏补丁直接被新结果替换，半成品不交给运行时。
      pending = next;
      return next;
    },
    commitAtFrameBoundary(apply) {
      if (!pending || pending === current) {
        pending = null;
        return null;
      }
      const prev = current;
      const next = pending;
      pending = null;
      apply(prev, next);
      current = next;
      return next;
    },
    reset() {
      current = null;
      pending = null;
    },
  };
}

export function occupantsFromRiders(riders, snapshotVersion = 0) {
  return Object.entries(riders || {}).map(([kind, rider]) => ({
    id: kind,
    kind,
    pos: rider?.position ? { ...rider.position } : { x: 0, y: 0, z: 0 },
    surfaceId: null,
    snapshotVersion,
  }));
}

export function bindRidersToSnapshot(riders, prev, next) {
  const occ = migrateOccupants(prev, next, occupantsFromRiders(riders, prev?.version ?? 0));
  for (const o of occ) {
    const rider = riders[o.id] || riders[o.kind];
    if (!rider?.rebind) continue;
    rider.rebind(next.surfaces, o.ok ? o.pos : rider.position);
  }
  return occ;
}
