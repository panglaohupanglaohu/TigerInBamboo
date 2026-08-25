// V6-G4：field → 低多边形表面 + L1 瀑布样片（不替换 citadelRange）
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

for (const rel of ["src/world/citadel/terrainExtract.js", "src/world/citadel/terrainSample.js"]) {
  const src = fs.readFileSync(fileURLToPath(new URL(rel, BASE)), "utf8");
  assert.equal(/from ["']three["']/.test(src), false, `${rel} 不得 import Three`);
}
const loadCitadel = fs.readFileSync(fileURLToPath(new URL("src/scenes/messenger/loadCitadel.js", BASE)), "utf8");
assert.match(loadCitadel, /buildCitadelRange/);
assert.equal(loadCitadel.includes("buildTerrainSampleMesh"), false);
console.log("  ✓ 数据层无 Three；生产仍走 citadelRange");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { extractLowPolySurface, axisAlignedCoverPatches, isAxisAlignedQuad, HEIGHT_EPS, COLOR_DE00 } = await import(
  new URL("src/world/citadel/terrainExtract.js", BASE).href
);
const { attachOnSemanticSurface, buildTerrainSamplePack, writeTerrainSampleSvgs } = await import(
  new URL("src/world/citadel/terrainSample.js", BASE).href
);
const { waterfallVMonotonic, waterfallVStrict } = await import(new URL("src/world/citadel/terrainUvCompiler.js", BASE).href);
const { FEATURES } = await import(new URL("src/core/params.js", BASE).href);
const { buildTerrainSampleMesh } = await import(new URL("src/world/citadel/terrainMesh.js", BASE).href);

assert.equal(FEATURES.citadelTerrainUvV2, false);

const box = [
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 2, y: 0, z: 2 },
  { x: 0, y: 0, z: 2 },
];
assert.equal(isAxisAlignedQuad(box), true);
const polar = [
  { x: 4, y: 0, z: 0 },
  { x: 3.4, y: 0, z: 2.1 },
  { x: 5.2, y: 0, z: 3.1 },
  { x: 6, y: 0, z: 0.4 },
];
assert.equal(isAxisAlignedQuad(polar), false);
assert.equal(
  axisAlignedCoverPatches(
    [{ id: "g", semantic: "grass", vertexIds: ["a", "b", "c", "d"] }],
    [
      { id: "a", ...box[0] },
      { id: "b", ...box[1] },
      { id: "c", ...box[2] },
      { id: "d", ...box[3] },
    ]
  ).length,
  1
);
console.log("  ✓ 轴对齐方块边可检出；极坐标扇面不是矩形补丁");

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);
assert.ok(v4.terrain.extract?.hash);
const pack = buildTerrainSamplePack(v4.topo, v4.terrain.field, v4.graph);
const pack2 = buildTerrainSamplePack(v4.topo, v4.terrain.field, v4.graph);
assert.equal(pack.hash, pack2.hash);
const faces = pack.extract.faces;
const sem = new Set(faces.map((f) => f.semantic));
assert.ok(sem.has("terrace-top"));
assert.ok(sem.has("cliff") || sem.has("waterfall"));
assert.ok(faces.some((f) => f.terraceId === 0) && faces.some((f) => f.terraceId === 1), "样片含相邻两台面");
assert.ok(faces.some((f) => f.semantic === "waterfall" || f.flags?.nearNotch), "第一层瀑布");
assert.equal(pack.aabb.length, 0, "样片地被无 AABB 补丁");
assert.equal(pack.extract.report.degenerate, 0);
assert.ok(pack.extract.report.colorJump === 0, `colorJump ${pack.extract.report.colorJump}`);
assert.ok(pack.waterfallStrict, "瀑布 V 严格单调");
assert.equal(waterfallVMonotonic(pack.uv, 1) || waterfallVMonotonic(v4.uv, 1), true);
assert.ok(pack.extract.report.heightJump === 0, `heightJump ${pack.extract.report.heightJump} (eps ${HEIGHT_EPS})`);
console.log(`  ✓ extract faces=${faces.length} hash=${pack.hash} ΔE门槛 ${COLOR_DE00}`);

const walk = pack.provider.walkable();
assert.ok(walk.length >= 2);
const hit = pack.provider.sample(walk[0].centroid) || pack.provider.nearest(walk[0].centroid);
assert.ok(hit?.surfaceId);
const kinds = ["vegetation", "rock", "blood", "unit", "prop", "spray"];
for (const k of kinds) {
  const a = attachOnSemanticSurface(pack.provider, walk[0].centroid, k, [k]);
  assert.equal(a.ok, true, k);
  assert.ok(a.surfaceId);
}
console.log("  ✓ SurfaceProvider=extract 真源；植被/石/血/单位/道具/水沫均贴 semantic surface");

const mesh = buildTerrainSampleMesh(pack.extract);
assert.equal(mesh.name, "citadel-v6-terrain-sample");
assert.ok(mesh.children.length >= 8);

const svgs = writeTerrainSampleSvgs(pack);
fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
for (const [k, svg] of Object.entries(svgs)) {
  assert.match(svg, /<svg /);
  fs.writeFileSync(new URL(`./out/v6-g4-${k}.svg`, import.meta.url), svg);
}
fs.writeFileSync(
  new URL("./out/v6-g4-terrain.json", import.meta.url),
  JSON.stringify(
    {
      seed: 7,
      hash: pack.hash,
      extractHash: pack.extract.hash,
      faces: faces.length,
      semantics: pack.extract.report.semantics,
      aabbPatches: pack.aabb.length,
      waterfallStrict: pack.waterfallStrict,
      attach: kinds,
      rangeStillProduction: true,
      defaultOn: false,
    },
    null,
    2
  )
);
console.log("  ✓ geometry/UV/surface/nav 四层叠图已写");
console.log("\nV6-G4 地形样片验收通过（TESTED，未替换 Range，未 DEFAULT_ON）");
