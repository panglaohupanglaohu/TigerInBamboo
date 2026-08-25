// V6-G3：family builder + prop + 单簇样片（不默认全城换网格）
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

for (const rel of [
  "src/world/citadel/moduleFrame.js",
  "src/world/citadel/familyBuilders.js",
  "src/world/citadel/propPlacement.js",
  "src/world/citadel/clusterGeometry.js",
]) {
  const src = fs.readFileSync(fileURLToPath(new URL(rel, BASE)), "utf8");
  assert.equal(/from ["']three["']/.test(src), false, `${rel} 不得 import Three`);
}
const cityMesh = fs.readFileSync(fileURLToPath(new URL("src/world/citadel/presentationMesh.js", BASE)), "utf8");
assert.match(cityMesh, /BoxGeometry/);
assert.match(cityMesh, /ConeGeometry/);
assert.equal(cityMesh.includes("buildClusterSampleMesh"), false);
console.log("  ✓ 数据层无 Three；全城 presentation 仍是 Box/Cone");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { resolveBuildingTheme } = await import(new URL("src/world/citadel/visualTheme.js", BASE).href);
const { FAMILY_BUILDERS, STRUCTURAL_SEMANTICS, buildResolvedModule } = await import(
  new URL("src/world/citadel/familyBuilders.js", BASE).href
);
const { moduleFrameFromIrregularQuad } = await import(new URL("src/world/citadel/moduleFrame.js", BASE).href);
const { PROP_KINDS, placeProps, reconcileProps, propUsage } = await import(
  new URL("src/world/citadel/propPlacement.js", BASE).href
);
const {
  buildClusterSampleGeometry,
  clusterToSvg,
  exerciseAllBuilders,
  materializeCells,
  pickSampleCluster,
  unitQuad,
} = await import(new URL("src/world/citadel/clusterGeometry.js", BASE).href);
const { FEATURES, isCitadelTownV4 } = await import(new URL("src/core/params.js", BASE).href);
const { buildClusterSampleMesh } = await import(new URL("src/world/citadel/familyMesh.js", BASE).href);

assert.equal(FEATURES.citadelTownV4, false);
assert.equal(isCitadelTownV4(), false);

const theme = resolveBuildingTheme("cluster:g3", { seed: 7 });
const demo = exerciseAllBuilders(theme, 7);
assert.ok(Object.keys(FAMILY_BUILDERS).length >= 12);
for (const sem of STRUCTURAL_SEMANTICS) {
  assert.ok(demo.semantics.includes(sem), `missing semantic ${sem}`);
}
const balcony = demo.built.find((b) => b.family === "balcony");
assert.ok(balcony.walkSurfaces.some((w) => w.walkSurface === "flower-tile"));
assert.ok(!balcony.walkSurfaces.some((w) => w.walkSurface === "grass"));
assert.ok(balcony.structure.solids.some((s) => s.semantic === "balcony-tile" && s.material !== "#88A779"));
const win = demo.built.find((b) => b.family === "decor" && b.variant === "window");
assert.ok(win.structure.solids.some((s) => s.kind === "inset-opening" && s.inset >= 0.1 && s.cutout));
assert.ok(win.structure.solids.filter((s) => s.semantic === "jamb").length >= 2);
assert.ok(win.structure.solids.some((s) => s.semantic === "window-glass"));
const door = demo.built.find((b) => b.family === "gate");
assert.ok(door.structure.solids.some((s) => s.semantic === "door-opening" && s.inset >= 0.2 && s.cutout));
const fence = demo.built.find((b) => b.family === "fence");
assert.ok(fence.structure.solids.every((s) => s.semantic !== "wall" || s.exposed));
assert.ok(fence.structure.solids.some((s) => s.semantic === "fence" && s.exposed === "S"));
const roofs = ["hip", "gable", "dome", "flat"].map((v) => demo.built.find((b) => b.family === "roof" && b.variant === v));
assert.equal(new Set(roofs.map((r) => r.structure.solids[0].semantic)).size, 4);
console.log("  ✓ family builders 覆盖结构语义；阳台花砖；窗门内凹");

const frame = moduleFrameFromIrregularQuad(unitQuad(), { occupancy: { N: 0, E: 1, S: 1, W: 1, U: 0, D: 1 }, cellId: "cell:0:1:0:1" });
const built = buildResolvedModule({ occupancy: frame.occupancy, cellId: frame.cellId }, { module: { family: "floor", role: "base" } }, theme, frame);
assert.ok(built.structure.solids.length >= 2);

{
  const slots = Array.from({ length: 8 }, (_, i) => ({
    id: `facade:0:${i}`,
    kind: "facade",
    tags: ["lamp"],
    u: 0.1 * i,
    v: 1,
    h: 0.5,
    dir: "N",
    cellId: "cell:0:4:0:4",
    slope: 0.05,
    clearance: 0.4,
    occluded: false,
  }));
  const placed = placeProps(slots, { seed: 7 });
  const kinds = placed.map((p) => p.kind);
  for (let i = 0; i <= kinds.length - 4; i++) {
    assert.equal(kinds.slice(i, i + 4).every((k) => k === kinds[i]), false, "单 facade 不得连续 4 个相同");
  }
  const allKinds = PROP_KINDS.map((k, i) => ({
    id: `mix:${i}`,
    kind: "facade",
    tags: [k],
    u: i * 0.08,
    v: 0,
    h: 0.4,
    dir: "S",
    cellId: `cell:0:${i}:0:2`,
    slope: 0.04,
    clearance: 0.5,
    occluded: false,
  }));
  const mixed = placeProps(allKinds, { seed: 7 });
  const usage = propUsage(mixed);
  assert.equal(usage.neverSelected.length, 0);
  const blocked = { ...allKinds[0], slope: 0.9, id: "steep", tags: ["pot"] };
  assert.equal(placeProps([blocked], { seed: 1 }).length, 0);
  const occ = { ...allKinds[0], occluded: true, id: "hid" };
  assert.equal(placeProps([occ], { seed: 1 }).length, 0);
  const rec = reconcileProps(mixed, allKinds.slice(0, 5), { seed: 7 });
  assert.ok(rec.kept >= 1);
  assert.ok(rec.dirtySlotIds.length + rec.kept === rec.placed.length || rec.placed.length >= rec.kept);
  const a = placeProps(allKinds, { seed: 7 }).map((p) => p.kind).join();
  const b = placeProps(allKinds, { seed: 7 }).map((p) => p.kind).join();
  assert.equal(a, b);
  console.log(`  ✓ prop 过滤/去重/稳定/reconcile · 放置 ${mixed.length}`);
}

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);
assert.ok(v4.town.props?.placed);
assert.ok((v4.town.props.slots || []).length > 0);
const cluster = pickSampleCluster(v4.town);
assert.ok(cluster.length >= 6);
const sample = buildClusterSampleGeometry(v4.town, v4.topo, bp, 7);
const sample2 = buildClusterSampleGeometry(v4.town, v4.topo, bp, 7);
assert.equal(sample.hash, sample2.hash);
assert.ok(sample.solids.some((s) => s.kind === "inset-opening"));
assert.ok(sample.walkSurfaces.every((w) => w.walkSurface !== "grass"));
const again = materializeCells(cluster, v4.topo, bp, 7, sample.placed);
assert.ok(again.placed.length >= 1);

const outDir = fileURLToPath(new URL("./out/", import.meta.url));
fs.mkdirSync(outDir, { recursive: true });
const shots = {
  planDay: clusterToSvg(sample, { mode: "plan", weather: "clear", title: "cluster plan day" }),
  planNight: clusterToSvg(sample, { mode: "plan", weather: "night", title: "cluster plan night" }),
  elevDay: clusterToSvg(sample, { mode: "elev", weather: "clear", title: "cluster elev day" }),
  elevNight: clusterToSvg(sample, { mode: "elev", weather: "night", title: "cluster elev night" }),
  silhouette: clusterToSvg(sample, { mode: "elev", weather: "clear", silhouette: true, title: "cluster silhouette" }),
  structure: clusterToSvg(sample, { mode: "plan", weather: "clear", structure: true, title: "cluster structure" }),
  tiles: clusterToSvg(sample, { mode: "plan", weather: "clear", tiles: true, title: "cluster tiles" }),
};
for (const [k, svg] of Object.entries(shots)) {
  assert.match(svg, /<svg /);
  fs.writeFileSync(new URL(`./out/v6-g3-${k}.svg`, import.meta.url), svg);
}
const mesh = buildClusterSampleMesh(sample);
assert.equal(mesh.name, "citadel-v6-cluster-sample");
assert.ok(mesh.children.length >= 10);
assert.ok(mesh.children.some((c) => c.name === "sample-opening"));

const neverFam = Object.keys(v4.catalog.byFamily).filter((f) => !v4.town.props.familyUsage?.[f]);
fs.writeFileSync(
  new URL("./out/v6-g3-cluster.json", import.meta.url),
  JSON.stringify(
    {
      seed: 7,
      hash: sample.hash,
      cells: sample.cellCount,
      solids: sample.solids.length,
      props: sample.placed.length,
      usage: sample.usage,
      neverSelectedProps: sample.usage.props.neverSelected,
      neverSelectedFamilies: neverFam,
      demoSemantics: sample.demoSemantics,
      cityWideMesh: "still-box-cone",
      defaultOn: false,
    },
    null,
    2
  )
);
console.log(`  ✓ 簇样片 cells=${sample.cellCount} solids=${sample.solids.length} props=${sample.placed.length} hash=${sample.hash}`);
console.log("\nV6-G3 family/prop/簇样片验收通过（TESTED，未全城换网格，未 DEFAULT_ON）");
