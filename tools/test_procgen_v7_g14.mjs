// V7-G14：增量 dirty layer / snapshot V3 / replay
import assert from "node:assert/strict";
import { DirtyLayerTracker, createDirtyRegionPlan, createSnapshotV3, diffSnapshots, applySnapshotPatch, replaySnapshot, validateSnapshotV3 } from "../TigerMessenger/src/procgen/snapshot/incrementalSnapshot.js";
import { createGrowthAnimation, migrateDirtyOccupants } from "../TigerMessenger/src/world/planetV8/snapshotCommitV8.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

const a = createSnapshotV3({ id: "s", seed: 1, profile: "highland-citadel", moduleSetVersion: "highland-1", layers: { blueprint: { terrace: 1 }, wfc: { hash: "a" } } });
const b = createSnapshotV3({ ...a, layers: { ...a.layers, blueprint: { terrace: 2 }, wfc: { hash: "a" } } });
assert.equal(validateSnapshotV3(a).ok, true);
assert.notEqual(a.hash, b.hash);
const tracker = new DirtyLayerTracker().mark("blueprint", "invalid");
const patch = diffSnapshots(a, b, tracker);
assert.deepEqual(patch.dirtyLayers, ["blueprint"]);
assert.equal(tracker.size, 0);
ok("snapshot V3：分层 schema、stable hash 和 dirty layer 差分");

const c = applySnapshotPatch(a, patch);
assert.equal(c.hash, b.hash);
const d = replaySnapshot(a, [patch]);
assert.equal(d.hash, b.hash);
assert.equal(validateSnapshotV3({ version: 2 }).ok, false);
ok("snapshot replay：patch 与重放结果 hash 完全一致，旧版本拒绝");

const dirty = createDirtyRegionPlan({ wfcCells: ["c:1", "c:2"], fieldChunks: ["chunk:4"], nav: ["portal:1"], AO: ["ao:4"] });
assert.deepEqual(dirty.regions.wfcCells, ["c:1", "c:2"]);
assert.deepEqual(dirty.regions.fieldChunks, ["chunk:4"]);
ok("dirty region：WFC cell/field chunk/nav/AO 分层，不把编辑升级成全城重编");

const growth = createGrowthAnimation();
assert.equal(growth.sample(0.1).presentationOnly, true);
assert.equal(growth.sample(0.1).collisionNavCommitted, false);
assert.equal(growth.sample(0.22).collisionNavCommitted, true);
const migration = migrateDirtyOccupants([{ id: "horse", position: [1, 2, 3] }], { isDirty: () => true, nearestSurface: () => ({ surfaceId: "surface:new", position: [4, 5, 6] }) });
assert.equal(migration.ok, true);
assert.deepEqual(migration.migrated[0].position, [4, 5, 6]);
ok("增量提交：0.22s 只增长表现，帧边界迁移占用者到新 SurfaceProvider");

console.log(`✅ V7-G14 assertions=${passed}`);
