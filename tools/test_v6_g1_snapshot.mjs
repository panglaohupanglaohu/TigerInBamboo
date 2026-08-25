// V6-G1：CitadelWorldSnapshot + 真实开关 + 帧边界提交 + 回滚
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const srcSnap = fs.readFileSync(fileURLToPath(new URL("src/world/citadel/worldSnapshot.js", BASE)), "utf8");
const srcCommit = fs.readFileSync(fileURLToPath(new URL("src/world/citadel/snapshotCommit.js", BASE)), "utf8");
assert.equal(/from ["']three["']|from ["']three\//.test(srcSnap), false, "worldSnapshot 不得 import Three");
assert.equal(/from ["']three["']/.test(srcCommit), false, "snapshotCommit 不得 import Three");
console.log("  ✓ 数据层无 Three.js");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const {
  SNAPSHOT_LAYERS,
  compileWorldSnapshot,
  assertSnapshotConsistent,
  assertNoMixedSources,
  snapshotSources,
  migrateOccupants,
  censusCitadelGraph,
  detectMixedState,
  projectOnSnapshot,
  propsOnSnapshot,
  snapshotVisualOracle,
  mixedStateDump,
} = await import(new URL("src/world/citadel/worldSnapshot.js", BASE).href);
const { createSnapshotCommitQueue, bindRidersToSnapshot } = await import(
  new URL("src/world/citadel/snapshotCommit.js", BASE).href
);
const { attachCitadelV4Runtime, wrapWalkLift, selectWalkLift } = await import(
  new URL("src/world/citadel/runtimeAdapter.js", BASE).href
);
const { FEATURES, applyUrlOverrides, isCitadelTownV4 } = await import(new URL("src/core/params.js", BASE).href);
const { syncTownPresentation, restoreLegacyTownPresentation } = await import(
  new URL("src/world/citadel/presentationMesh.js", BASE).href
);
const { syncMixedStateOverlay } = await import(new URL("src/world/citadel/presentationOverlay.js", BASE).href);
const { createSurfaceRider } = await import(new URL("src/world/surfaceRider.js", BASE).href);

applyUrlOverrides("?citadelTownV4=0&citadelTerrainUvV2=0&citadelCombatV3=0");
assert.equal(isCitadelTownV4(), false);
assert.equal(FEATURES.citadelTownV4, false);

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const flagsOff = { town: false, uv: false, combat: false };
const flagsTown = { town: true, uv: false, combat: false };

const a = compileWorldSnapshot(bp, 7, flagsOff);
const b = compileWorldSnapshot(bp, 7, flagsOff);
assert.equal(a.hash, b.hash);
assert.deepEqual([...SNAPSHOT_LAYERS].sort(), Object.keys(a.layers).sort());
assertSnapshotConsistent(a);
assert.equal(a.sources.visual, "legacy");
assert.equal(a.sources.walk, "legacy");
assert.equal(a.surfaces, a.compiled.surfaces);
assert.equal(a.graph, a.compiled.graph);
assert.ok(a.layers.mesh.cellCount > 100);
assert.equal(a.layers.mesh.kind, "legacy-town-terrace");
assert.equal(a.layers.mesh.cellCount, a.layers.module.cellCount);
assert.equal(a.layers.surface.walkable, a.layers.nav.nodeCount);
assert.ok(Array.isArray(propsOnSnapshot(a).slots));
console.log(`  ✓ snapshot seed=7 hash=${a.hash} cells=${a.layers.mesh.cellCount}`);

const v6 = compileWorldSnapshot(bp, 7, flagsTown, { compiled: a.compiled, version: 2 });
assert.notEqual(v6.hash, a.hash, "flags 进入 fingerprint");
assert.equal(v6.sources.visual, "v6");
assert.equal(v6.sources.walk, "v6");
assert.equal(v6.layers.mesh.kind, "v4-box-cone");
assert.equal(v6.compiled, a.compiled);

const walk0 = a.surfaces.walkable()[0];
assert.equal(a.graph.nodes.size, a.layers.nav.nodeCount);
assert.ok(a.graph.edges.size > 0, "snapshot.graph 有边");
let node0 = null;
let link = null;
for (const n of a.graph.nodes.values()) {
  const adj = a.graph.adj.get(n.id) || [];
  if (adj.length) {
    node0 = n;
    link = adj[0];
    break;
  }
}
assert.ok(node0 && link, "snapshot.graph 有邻接");
const ids = a.graph.aStar(node0.id, link.to);
assert.ok(ids?.length >= 2, "路径走同一 snapshot.graph");
const hit = projectOnSnapshot(a, node0.pos);
assert.ok(hit?.surfaceId);
console.log("  ✓ mesh/surface/uv/nav/module/prop/combat 投射同一 snapshot");

assert.throws(() => assertNoMixedSources({ visual: "v6", walk: "legacy" }), /mixed-state/);
assert.equal(mixedStateDump(snapshotSources(flagsTown)).mixedVisualCollision, false);
assert.equal(snapshotSources({ town: true }).walk, "v6", "town 开则碰撞也走 snapshot");
assert.equal(snapshotSources({ town: false, uv: true }).visual, "legacy");
assert.equal(snapshotSources({ town: false, uv: true }).walk, "v6");
console.log("  ✓ 禁止 V6 外观 + legacy 碰撞");

const occ = migrateOccupants(a, v6, [
  { id: "player", kind: "player", pos: { x: 9999, y: 0, z: 9999 }, surfaceId: "gone", snapshotVersion: 1 },
  { id: "tram", kind: "tram", pos: { ...walk0.centroid }, surfaceId: walk0.id, snapshotVersion: 1 },
  { id: "boat", kind: "boat", pos: { ...walk0.centroid }, surfaceId: walk0.id, snapshotVersion: 1 },
  { id: "horse", kind: "horse", pos: { ...walk0.centroid }, surfaceId: walk0.id, snapshotVersion: 1 },
  { id: "soldier", kind: "soldier", pos: { x: 9999, y: 4, z: 9999 }, surfaceId: "gone", snapshotVersion: 1, cellId: "dirty" },
], ["dirty"]);
assert.equal(occ.length, 5);
assert.ok(occ.every((o) => o.ok && o.surfaceId && Number.isFinite(o.pos.y)));
assert.ok(occ[0].migratedFrom === 1);
const rider = createSurfaceRider("player", a.surfaces, { x: 9999, y: 0, z: 9999 });
bindRidersToSnapshot({ player: rider }, a, v6);
assert.ok(Number.isFinite(rider.position.y));
assert.equal(rider.provider, v6.surfaces);
console.log("  ✓ player/tram/boat/horse/士兵 dirty 区投射到最近合法面");

const q = createSnapshotCommitQueue();
assert.equal(q.current(), null);
q.enqueue(a);
assert.equal(q.current(), null, "入队未提交");
assert.equal(q.pending(), a);
let applied = 0;
q.commitAtFrameBoundary(() => {
  applied += 1;
});
assert.equal(applied, 1);
assert.equal(q.current(), a);
q.enqueue(v6);
assert.equal(q.current(), a, "第二份仍等帧边界");
q.commitAtFrameBoundary(() => {
  applied += 1;
});
assert.equal(applied, 2);
assert.equal(q.current(), v6);
console.log("  ✓ 编译+一致性后才在帧边界原子替换");

const fallback = () => 4.2;
assert.equal(selectWalkLift(fallback, a), fallback);
const exclusive = wrapWalkLift(fallback, a.compiled);
const yV6 = exclusive(walk0.centroid.x, walk0.centroid.z);
assert.ok(Number.isFinite(yV6));
assert.notEqual(yV6, 4.2, "V6 walkLift 不得回落 legacy 高度");
console.log("  ✓ flags off 不包 walkLift；on 时高度只来自 snapshot");

const castle = {
  name: "odyssey-citadel",
  children: [],
  userData: { blueprint: bp, townStats: { v4: false, gates: [] } },
  getObjectByName(name) {
    let found = null;
    this.traverse((o) => {
      if (!found && o.name === name) found = o;
    });
    return found;
  },
  traverse(fn) {
    fn(this);
    for (const c of this.children) {
      if (typeof c.traverse === "function") c.traverse(fn);
      else fn(c);
    }
  },
  add(o) {
    this.children.push(o);
    o.parent = this;
    o.removeFromParent = () => {
      this.children = this.children.filter((x) => x !== o);
    };
  },
};
const terrace = { name: "town-terrace-0-level-0", visible: true, children: [], userData: {}, isMesh: true };
const lamp = { name: "legacy-lamp", isLight: true, visible: true, children: [], userData: { isLight: true } };
castle.add(terrace);
castle.add(lamp);

restoreLegacyTownPresentation(castle);
const c0 = censusCitadelGraph(castle);
assert.equal(c0.v4Town, 0);
assert.equal(c0.legacyTerraceVisible, 1);
assert.equal(c0.lights, 1);
const oracle0 = snapshotVisualOracle(a, c0);

syncTownPresentation(castle, a.compiled, v6.sources);
const c1 = censusCitadelGraph(castle);
assert.equal(c1.v4Town, 1, "v6 挂 citadel-v4-town");
assert.equal(c1.legacyTerraceVisible, 0);
assert.equal(c1.legacyTerraceHidden, 1);
assert.equal(c1.lights, 1, "切 V6 不新增灯");
assert.deepEqual(detectMixedState({ sources: v6.sources, census: c1 }), []);

syncTownPresentation(castle, a.compiled, a.sources);
const c2 = censusCitadelGraph(castle);
assert.equal(c2.v4Town, 0);
assert.equal(c2.legacyTerraceVisible, 1);
assert.equal(c2.lights, 1);
const oracle2 = snapshotVisualOracle(a, c2);
assert.equal(oracle2.hash, oracle0.hash);
assert.equal(oracle2.visual, oracle0.visual);
assert.equal(c2.v4Town, c0.v4Town);
assert.equal(c2.lights, c0.lights);
console.log("  ✓ legacy↔V6 对象数/灯数/碰撞源回滚一致");

syncMixedStateOverlay(castle, { visual: "v6", walk: "legacy" });
assert.equal(censusCitadelGraph(castle).mixedOverlay, 1);
syncMixedStateOverlay(castle, v6.sources);
assert.equal(censusCitadelGraph(castle).mixedOverlay, 0);
console.log("  ✓ mixed-state debug overlay 仅混合态可见");

const runtimeOff = attachCitadelV4Runtime({
  odysseyCitadel: { userData: { blueprint: bp } },
  seed: 7,
  walkLift: fallback,
  flags: flagsOff,
});
assert.equal(runtimeOff.sources.walk, "legacy");
assert.equal(runtimeOff.walkLift, fallback);
assert.ok(runtimeOff.snapshot.hash);
assert.equal(runtimeOff.pending(), null);
assert.ok(runtimeOff.riders.player && runtimeOff.riders.tram && runtimeOff.riders.boat && runtimeOff.riders.horse);

runtimeOff.recompile({ flags: flagsTown, seed: 7 });
assert.ok(runtimeOff.pending(), "recompile 只入队");
assert.equal(runtimeOff.sources.walk, "legacy");
runtimeOff.flushCommit();
assert.equal(runtimeOff.sources.walk, "v6");
assert.notEqual(runtimeOff.walkLift, fallback);
runtimeOff.recompile({ flags: flagsOff, seed: 7 });
runtimeOff.flushCommit();
assert.equal(runtimeOff.sources.walk, "legacy");
assert.equal(runtimeOff.walkLift, fallback);
console.log("  ✓ attach 真实开关：关=legacy walk，开=snapshot walk，可来回切");

const commits = [];
const rt = attachCitadelV4Runtime({
  odysseyCitadel: castle,
  seed: 7,
  walkLift: fallback,
  flags: flagsOff,
  onCommit(_prev, next) {
    syncTownPresentation(castle, next.compiled, next.sources);
    commits.push(next.sources.visual);
  },
});
assert.ok(commits.length >= 1);
const before = censusCitadelGraph(castle);
rt.recompile({ flags: flagsTown });
rt.flushCommit();
const mid = censusCitadelGraph(castle);
rt.recompile({ flags: flagsOff });
rt.flushCommit();
const after = censusCitadelGraph(castle);
assert.equal(before.v4Town, 0);
assert.equal(mid.v4Town, 1);
assert.equal(after.v4Town, 0);
assert.equal(after.lights, before.lights);
assert.equal(after.legacyTerraceVisible, before.legacyTerraceVisible);
console.log("  ✓ onCommit 表现层与 snapshot 同步，回滚截图 oracle 一致");

assert.equal(FEATURES.citadelTownV4, false);
applyUrlOverrides("?citadelTownV4=0");
assert.equal(isCitadelTownV4(), false);

const out = {
  recordedAt: "2026-08-22",
  seed: 7,
  schemaVersion: a.schemaVersion,
  hashLegacy: a.hash,
  hashTown: v6.hash,
  cells: a.layers.mesh.cellCount,
  walkable: a.layers.surface.walkable,
  navNodes: a.layers.nav.nodeCount,
  propSlots: a.layers.prop.slots.length,
  defaultOn: false,
  tests: "tools/test_v6_g1_snapshot.mjs",
};
const outPath = fileURLToPath(new URL("./out/v6-g1-snapshot.json", import.meta.url));
fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`  ✓ wrote ${outPath}`);
console.log("\nV6-G1 snapshot 验收通过（TESTED，未 DEFAULT_ON）");
