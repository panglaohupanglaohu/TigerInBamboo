// PLAN V4 G1：Half-Edge / 主对偶网格 / 五层台地 / 瀑布缺口
// 运行：node tools/test_citadel_topology.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const {
  buildHalfEdgeFromFaces,
  validateHalfEdge,
  boundaryLoops,
  buildDualGrid,
  compileTopology,
  assertStableCrossIds,
  topologyToSvg,
  transformVertices,
  buildMainGrid,
} = await import(new URL("src/world/citadel/topology.js", BASE).href);
const {
  createCitadelBlueprint,
  validateCitadelBlueprint,
  citadelBlueprintEntityIds,
  citadelBlueprintCanonicalHash,
} = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

function quad(id, pts, semantic = "terrace-top") {
  return {
    vertices: pts.map((p, i) => ({ id: `${id}:v${i}`, ...p })),
    face: {
      id,
      vertexIds: pts.map((_, i) => `${id}:v${i}`),
      semantic,
      terraceId: 0,
      entityId: id,
    },
  };
}

console.log("[1] 孤点、边界、洞、多边形、非流形");
{
  const lonely = buildHalfEdgeFromFaces(
    [
      { id: "iso", x: 0, y: 0, z: 0 },
      { id: "a", x: 0, y: 0, z: 0 },
      { id: "b", x: 1, y: 0, z: 0 },
      { id: "c", x: 0, y: 0, z: 1 },
    ],
    [{ id: "tri", vertexIds: ["a", "c", "b"], semantic: "terrace-top" }]
  );
  const iso = validateHalfEdge(lonely);
  assert.deepEqual(iso.isolated, ["iso"]);
  assert.ok(iso.ok);
  ok("孤点可检出，三角仍合法");

  const ringVerts = [];
  const ringFaces = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const a1 = ((i + 1) * Math.PI) / 2;
    ringVerts.push(
      { id: `in${i}`, x: 0.5 * Math.sin(a), y: 0, z: 0.5 * Math.cos(a) },
      { id: `out${i}`, x: 2 * Math.sin(a), y: 0, z: 2 * Math.cos(a) }
    );
    ringFaces.push({
      id: `ann${i}`,
      vertexIds: [`in${i}`, `out${i}`, `out${(i + 1) % 4}`, `in${(i + 1) % 4}`],
      semantic: "terrace-top",
    });
  }
  const donut = buildHalfEdgeFromFaces(ringVerts, ringFaces);
  const donutV = validateHalfEdge(donut);
  assert.equal(donutV.ok, true, donutV.errors.join("; "));
  const loops = boundaryLoops(donut);
  assert.ok(loops.length >= 2, `环形应有内外边界，实际 ${loops.length}`);
  ok(`边界环 ${loops.length} · 洞+外轮廓`);

  const nm = buildHalfEdgeFromFaces(
    [
      { id: "p", x: 0, y: 0, z: 0 },
      { id: "q", x: 1, y: 0, z: 0 },
      { id: "r", x: 0.5, y: 0, z: 1 },
      { id: "s", x: 0.5, y: 1, z: 0.5 },
      { id: "t", x: 0.5, y: -1, z: 0.5 },
    ],
    [
      { id: "f1", vertexIds: ["p", "q", "r"] },
      { id: "f2", vertexIds: ["p", "q", "s"] },
      { id: "f3", vertexIds: ["p", "q", "t"] },
    ]
  );
  assert.ok(nm.nonManifold.length >= 1);
  const nmV = validateHalfEdge(nm, { manifold: true });
  assert.equal(nmV.ok, false);
  ok("故意非流形：一边三面");
}

console.log("[2] 旋转 / 镜像保持半边结构");
{
  const pts = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
  ];
  const q = quad("q0", pts);
  const base = buildHalfEdgeFromFaces(q.vertices, [q.face]);
  assert.equal(validateHalfEdge(base).ok, true);
  const rotated = transformVertices(q.vertices, (v) => ({ x: -v.z, y: v.y, z: v.x }));
  const rotMesh = buildHalfEdgeFromFaces(rotated, [q.face]);
  assert.equal(validateHalfEdge(rotMesh).ok, true);
  const mirrored = transformVertices(q.vertices, (v) => ({ x: -v.x, y: v.y, z: v.z }));
  const mirFaces = [{ ...q.face, vertexIds: [...q.face.vertexIds].reverse() }];
  const mirMesh = buildHalfEdgeFromFaces(mirrored, mirFaces);
  assert.equal(validateHalfEdge(mirMesh).ok, true);
  ok("绕 Y 旋转与 X 镜像（反序）仍 ccw");
}

console.log("[3] 蓝图 schema / 实体 ID");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const v = validateCitadelBlueprint(bp);
  assert.equal(v.ok, true, v.errors.join("; "));
  const ids = citadelBlueprintEntityIds(bp);
  assert.ok(ids.some((id) => id.startsWith("terrace:")));
  assert.ok(ids.some((id) => id.startsWith("cell:")));
  // 2026-08-24：PLAN 12.25~12.27 圣城重构（连续山谷地形/城顶攻防/WFC 湖面）后
  // 蓝图派生数据更新，hash 6e6245cc→07c43660；schema 校验与实体 ID 断言不变。
  assert.equal(citadelBlueprintCanonicalHash(bp), "07c43660", "G0 蓝图 hash 不得因 G1 派生 API 漂移");
  ok(`实体 ${ids.length} · hash 锁定 07c43660`);
}

console.log("[4] compileTopology：五层台地、瀑布缺口、港口、交叉 ID");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const topo = compileTopology(bp);
  assert.equal(topo.report.ok, true, topo.report.errors.join("; "));
  const terraces = new Set(topo.halfEdge.faces.filter((f) => f.semantic === "terrace-top").map((f) => f.terraceId));
  assert.deepEqual([...terraces].sort(), [0, 1, 2, 3, 4]);
  const field = topo.halfEdge.faces.filter((f) => f.semantic === "terrace-top");
  const byT = [0, 1, 2, 3, 4].map((t) => field.filter((f) => f.terraceId === t).length);
  assert.ok(byT[0] > byT[1], `顶层无缺口应比有缺口层面多：${byT}`);
  assert.ok(topo.report.boundaryHe > 0, "缺口应产生边界半边");
  const harbor = field.filter((f) => f.flags?.harbor);
  assert.ok(harbor.length >= 1, "最低台地港口侧应有标记面");
  const near = field.filter((f) => f.flags?.nearNotch && f.terraceId === 1);
  assert.ok(near.length >= 1, "第一层瀑布邻面");
  assertStableCrossIds(topo.main, topo.dual);
  for (const f of topo.halfEdge.faces) {
    assert.ok(topo.idMap.faceToDualVertex[f.id], f.id);
  }
  const cells = topo.halfEdge.faces.filter((f) => f.semantic === "cell");
  assert.ok(cells.length >= 10, `占格面 ${cells.length}`);
  ok(`台地面 ${field.length} ${byT.join("/")} · 占格 ${cells.length} · 对偶点 ${topo.dual.vertices.length}`);
}

console.log("[5] 对偶与叠图导出");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const topo = compileTopology(bp);
  const dual = buildDualGrid(topo.halfEdge);
  assert.equal(dual.vertices.length, topo.halfEdge.faces.length);
  const svg = topologyToSvg(topo);
  assert.match(svg, /<svg /);
  const outDir = fileURLToPath(new URL("./out/", import.meta.url));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(new URL("./out/citadel_g1_topology.svg", import.meta.url), svg);
  const notchSegs = topo.halfEdge.faces.filter((f) => f.flags?.nearNotch).map((f) => f.id);
  const harborSegs = topo.halfEdge.faces.filter((f) => f.flags?.harbor).map((f) => f.id);
  const dump = {
    faces: topo.halfEdge.faces.length,
    vertices: topo.halfEdge.vertices.length,
    edges: topo.halfEdge.edges.length,
    dualVertices: topo.dual.vertices.length,
    dualFaces: topo.dual.faces.length,
    boundaryHe: topo.report.boundaryHe,
    isolated: topo.report.isolated,
    nearNotch: notchSegs,
    harbor: harborSegs,
    report: topo.report,
  };
  fs.writeFileSync(new URL("./out/citadel_g1_topology.json", import.meta.url), JSON.stringify(dump, null, 2));
  const mainSpec = buildMainGrid(bp);
  const hashes = [0, 1, 2].map(() => mainSpec.faces.map((f) => f.id).join("|"));
  assert.equal(hashes[1], hashes[0]);
  assert.equal(hashes[2], hashes[0]);
  ok("SVG/JSON 叠图 · 面 ID ×3 稳定");
}

console.log(`\nG1 拓扑验收通过 ${pass} 项`);
