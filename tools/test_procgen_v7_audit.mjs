// V7 补充审计测试（TODO 回填取证用）
// 只覆盖「实现已存在但 G4~G17 冒烟测试未断言」的条目；每块注释标注 TODO 行号。
// 诚实原则：实现不存在的条目不在这里伪造测试，由报告如实标注。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
// 与 G2 测试相同的桥接（moduleCatalog 依赖 three 包解析 + localStorage stub）
const bridgePkg = path.join(BASE, "node_modules/three/package.json");
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(path.dirname(bridgePkg), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const im = (p) => import(new URL(p, "file://" + BASE).href);
const { bitSetOf } = await im("src/procgen/core/bitSet.js");
const { hashHex } = await im("src/core/rng.js");
const { createRectGrid2D } = await im("src/procgen/graph/rectGrid2d.js");
const { createVoxelGrid3D } = await im("src/procgen/graph/voxelGrid3d.js");
const { createHalfEdgeGraph } = await im("src/procgen/graph/halfEdgeGraph.js");
const { compileVariants } = await im("src/procgen/wfc/socketCompiler.js");
const { compileCompatibilityTable } = await im("src/procgen/wfc/compatibilityTable.js");
const { createSimpleTiledModel, solveSimpleTiled, pin2D } = await im("src/procgen/wfc/simpleTiledModel.js");
const { createOverlappingModel2D } = await im("src/procgen/wfc/overlappingModel2d.js");
const { createVoxelModuleModel, validateVoxelAssignment } = await im("src/procgen/wfc/voxelModel3d.js");
const { solveWfc } = await im("src/procgen/wfc/solver.js");
const { validateConnectivity, validateWorldSolution } = await im("src/procgen/constraints/validators.js");
const { createScalarField } = await im("src/procgen/field/scalarField.js");
const { sdCylinderY, sdPlane, sdfUnion, sdfIntersection, sdfSubtract, smoothUnion } = await im("src/procgen/field/sdf.js");
const { createChunkField } = await im("src/procgen/field/chunkField.js");
const { marchingCubes } = await im("src/procgen/field/marchingCubes.js");
const { EDGE_TABLE, TRI_TABLE } = await im("src/procgen/field/marchingCubesTables.js");
const { cubeCase, ambiguityDecision, AMBIGUOUS_CASES } = await im("src/procgen/field/ambiguity.js");
const { validateChunkSeam } = await im("src/procgen/field/seamValidator.js");
const { runProcgenSurface } = await im("src/procgen/bridge/surfacePipeline.js");
const { createProcgenJob } = await im("src/procgen/worker/jobProtocol.js");
const { createWorkerHandler } = await im("src/procgen/worker/procgenWorker.js");
const { createHighlandProfile } = await im("src/procgen/profiles/castleProfiles.js");
const { canPromote, evaluateMigrationGate } = await im("src/procgen/migration/migrationGate.js");
const { buildCastleModuleSets } = await im("src/procgen/wfc/moduleSets.js");
const { createModuleCatalog } = await im("src/world/citadel/moduleCatalog.js");

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };
const F6 = (c) => ({ N: { connector: c, parity: "symmetric" }, E: { connector: c, parity: "symmetric" }, S: { connector: c, parity: "symmetric" }, W: { connector: c, parity: "symmetric" }, U: { connector: c, parity: "symmetric" }, D: { connector: c, parity: "symmetric" } });
const F4 = (c) => ({ N: { connector: c, parity: "symmetric" }, E: { connector: c, parity: "symmetric" }, S: { connector: c, parity: "symmetric" }, W: { connector: c, parity: "symmetric" } });

// ---------- G4 (TODO 1139)：2D 无解保留 pins 并输出结构化冲突，不静默换 floor ----------
{
  const tile = (id, c) => ({ id, family: "tile", weight: 1, orientationGroup: "NONE", faces: F4(c) });
  const model = createSimpleTiledModel({ prototypes: [tile("stone", "a"), tile("brick", "b")], graph: createRectGrid2D({ width: 2, height: 1 }) });
  const r = solveSimpleTiled({ model, seed: 1, pins: [pin2D(model, 0, 0, "stone@r0"), pin2D(model, 1, 0, "brick@r0")] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unsatisfiable");
  assert.equal(r.hardLocks.length, 2, "pins 原样保留在 failure 中");
  assert.ok(r.conflict.banChain.length >= 1 && r.suggestedRelaxations.length >= 1);
  ok("G4/1139：SimpleTiled 无解 → 结构化冲突 + pins 保留（无静默换 floor）");
}

// ---------- G4 (TODO 1132/1133/1134)：Overlapping 频率、增广开关、输入 provenance ----------
{
  const sample = [["a", "b", "a"], ["b", "a", "b"], ["a", "b", "a"]];
  const m0 = createOverlappingModel2D({ sample, N: 2, augmentSymmetry: false });
  assert.deepEqual(m0.compiled.variants.map((v) => v.weight).sort((x, y) => x - y), [2, 2], "pattern 频率=出现次数");
  assert.deepEqual(m0.sampleSize, { width: 3, height: 3 }, "provenance 指向项目内联样例");
  const m1 = createOverlappingModel2D({ sample: [["a", "a", "b"], ["b", "a", "a"], ["a", "b", "b"]], N: 2, augmentSymmetry: false });
  const m2 = createOverlappingModel2D({ sample: [["a", "a", "b"], ["b", "a", "a"], ["a", "b", "b"]], N: 2, augmentSymmetry: true });
  assert.ok(m2.compiled.variants.length >= m1.compiled.variants.length, "增广只增不减");
  // 同输入同构建两次 → 完全相同（确定性）
  const m1b = createOverlappingModel2D({ sample: [["a", "a", "b"], ["b", "a", "a"], ["a", "b", "b"]], N: 2, augmentSymmetry: false });
  assert.deepEqual(m1.compiled.variants.map((v) => v.key), m1b.compiled.variants.map((v) => v.key));
  // 1134：测试输入全部代码内联；实现源码不引用外部图片/网络/fs
  const src = fs.readFileSync(path.join(BASE, "src/procgen/wfc/overlappingModel2d.js"), "utf8");
  assert.ok(!/https?:|\.png|\.jpg|node:fs|from "fs"/.test(src), "overlapping 不消费外部样例图片");
  ok("G4/1132-1134：N×N 频率=权重、增广开关确定、输入 provenance 为代码内联样例");
}

// ---------- G4 (TODO 1137)：half-edge 变形视觉位置不改变逻辑解 hash ----------
{
  const faces = [["a", "b", "e", "d"], ["b", "c", "f", "e"], ["d", "e", "h", "g"], ["e", "f", "i", "h"]];
  const posA = { a: [0, 0], b: [1, 0], c: [2, 0], d: [0, 1], e: [1, 1], f: [2, 1], g: [0, 2], h: [1, 2], i: [2, 2] };
  const posB = { a: [0.3, -0.2], b: [1.4, 0.1], c: [2.6, -0.3], d: [-0.2, 1.2], e: [1.1, 0.9], f: [2.3, 1.4], g: [0.1, 2.5], h: [1.3, 2.2], i: [2.4, 2.6] };
  const gA = createHalfEdgeGraph({ faces, positions: posA });
  const gB = createHalfEdgeGraph({ faces, positions: posB });
  assert.deepEqual(gA.neighborsOf(0), gB.neighborsOf(0), "变形后邻接完全一致");
  const compiled = { variants: [{ key: "X", weight: 1 }, { key: "Y", weight: 1 }], variantIndex: new Map([["X", 0], ["Y", 1]]) };
  const compatibleFor = () => [bitSetOf(2, [1]), bitSetOf(2, [0])];
  const rA = solveWfc({ graph: gA, compiled, table: null, seed: 5, compatibleFor });
  const rB = solveWfc({ graph: gB, compiled, table: null, seed: 5, compatibleFor });
  assert.ok(rA.ok && rB.ok);
  assert.equal(rA.solutionHash, rB.solutionHash, "视觉位置变形不改变逻辑解 hash");
  ok("G4/1137：不规则 quad/half-edge 网格——位置变形邻接不变、解 hash 不变");
}

// ---------- G5 (TODO 1151)：悬空/错误支撑给出具体原因（cell + variant + code） ----------
{
  const proto = (id, below) => ({
    id, family: "fx", weight: 1, orientationGroup: "NONE",
    faces: { U: { connector: "stack", parity: "symmetric" }, D: { connector: "stack", parity: "symmetric" } },
    rules: below ? { requiresBelow: below } : {},
  });
  const graph = createVoxelGrid3D({ width: 1, height: 2, depth: 1 });
  const model = createVoxelModuleModel({ prototypes: [proto("base"), proto("tower", "base")], graph });
  // 悬空塔：tower 落在最底层（无 D 邻居）
  const bad = { ok: true, assignment: new Int32Array([1, 1]) };
  const check = validateVoxelAssignment(model, bad);
  assert.equal(check.ok, false);
  assert.ok(check.issues.some((i) => i.code === "missing-support" && i.cell === "v:0:0:0" && i.variant === "tower@r0"), "悬空塔报 missing-support + cell + variant");
  assert.ok(check.issues.some((i) => i.code === "wrong-support" && i.cell === "v:0:1:0"), "断支撑报 wrong-support");
  ok("G5/1151：悬空塔/断支撑 fixture 给出 code+cell+variant 的具体原因");
}

// ---------- G5 (TODO 1152)：城堡模块集默认只展开 Y4，无 CUBE24 污染 ----------
{
  const catalog = createModuleCatalog();
  const sets = buildCastleModuleSets(catalog.modules);
  for (const [name, set] of Object.entries(sets)) {
    const compiled = compileVariants(set.prototypes);
    const bad = compiled.variants.filter((v) => !/^r(0|90|180|270)$/.test(v.transformName));
    assert.equal(bad.length, 0, `${name} 存在非 Y4 变换：${bad.map((v) => v.key).join(",")}`);
  }
  ok("G5/1152：三城堡模块集全部只含 Y4 变换（r0/r90/r180/r270），CUBE24 零污染");
}

// ---------- G6 (TODO 1170/1166)：局部合法但全局断路；validator 列出具体 cell ----------
{
  const tile = (id, c) => ({ id, family: "tile", weight: 1, orientationGroup: "NONE", faces: F4(c) });
  const graph = createRectGrid2D({ width: 4, height: 1 });
  const model = createSimpleTiledModel({ prototypes: [tile("road", "r"), tile("grass", "r")], graph });
  const solved = solveSimpleTiled({ model, seed: 2 });
  assert.equal(solved.ok, true, "局部邻接全部合法（WFC 通过）");
  // 全局 validator：假想中间断一条边（如施工挖断），WFC 邻接永远抓不到
  const cut = validateConnectivity({ graph, sources: ["r:0:0"], targets: ["r:3:0"], edgeFilter: (from, e) => !(from === 1 && e.direction === "E") });
  assert.equal(cut.ok, false);
  assert.deepEqual(cut.issues, [{ code: "unreachable", cell: "r:3:0" }], "failure 列出具体 cell，非布尔");
  const world = validateWorldSolution({ graph, assignment: [...solved.assignment], locks: [{ cell: "r:0:0", variant: solved.assignment[0] }], sources: ["r:0:0"], targets: ["r:3:0"], occupied: [], waterCells: [] });
  assert.equal(world.ok, true);
  ok("G6/1170：局部合法全局断路 fixture——validator 抓到 WFC 邻接抓不到的问题");
}

// ---------- G7 (TODO 1176/1177/1178/1183/1186)：field 补充 ----------
{
  // 1176：函数 sampler 与离散 Float32Array sampler 输出一致
  const fn = (p) => p[0] * 2 - p[1] + p[2] * 0.5;
  const bounds = { min: [0, 0, 0], max: [2, 2, 2], resolution: 5 };
  const byFn = createScalarField({ ...bounds, sample: fn });
  const proto = createScalarField({ ...bounds, sample: () => 0 });
  const data = Array.from({ length: proto.count }, (_, i) => fn(proto.worldPosition(...proto.coords(i))));
  const byData = createScalarField({ ...bounds, data });
  assert.deepEqual([...byFn.data], [...byData.data], "函数/离散 sampler 逐点一致");
  // 1177/1178：cylinder/plane 符号约定 + 布尔运算 + 非法参数拒绝
  assert.ok(sdCylinderY([0, 0, 0], [0, 0, 0], 1, 1) < 0 && sdCylinderY([3, 0, 0], [0, 0, 0], 1, 1) > 0);
  assert.ok(sdPlane([0, 2, 0], [0, 1, 0], 0) > 0 && sdPlane([0, -2, 0], [0, 1, 0], 0) < 0);
  assert.equal(sdfUnion(2, -1), -1);
  assert.equal(sdfIntersection(2, -1), 2);
  assert.equal(sdfSubtract(-1, 2), -1);
  assert.equal(smoothUnion(0.1, 0.2, 0), 0.1, "k≤0 退化为硬 min，不产生 NaN");
  assert.throws(() => createScalarField({ min: [0, 0, 0], max: [0, 2, 2], resolution: 3 }), /greater than min/);
  assert.throws(() => createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 3, sample: () => NaN }), /non-finite/);
  // 1183：相邻 chunk halo 同源采样，共享平面值误差 ≤1e-7
  const sample = (p) => Math.sin(p[0]) + p[1] * 0.3 + p[2] * p[2];
  const left = createChunkField({ origin: [0, 0, 0], size: [1, 2, 2], resolution: 9, halo: 1, sample });
  const right = createChunkField({ origin: [1, 0, 0], size: [1, 2, 2], resolution: 9, halo: 1, sample });
  let maxDiff = 0;
  for (let z = 0; z <= 10; z++) for (let y = 0; y <= 10; y++) {
    maxDiff = Math.max(maxDiff, Math.abs(left.field.valueAt(9, y, z) - right.field.valueAt(1, y, z)));
  }
  assert.ok(maxDiff <= 1e-7, `halo 共享面采样最大误差 ${maxDiff}`);
  ok(`G7/1176-1183：双 sampler 一致 + SDF 符号/布尔/非法拒绝 + halo 同源（maxDiff=${maxDiff.toExponential(1)}）`);
}
{
  // 1186：field/constraints/bridge/worker/three 等目录静态扫描禁 Three.js import/DOM
  const forbidden = [/\bfrom\s+["']three["']/, /\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /\brequestAnimationFrame\b/];
  const dirs = ["field", "constraints", "bridge", "worker", "three", "inspector", "snapshot", "migration", "profiles"];
  const violations = [];
  for (const dir of dirs) {
    for (const file of fs.readdirSync(path.join(BASE, "src/procgen", dir))) {
      if (!file.endsWith(".js")) continue;
      const text = fs.readFileSync(path.join(BASE, "src/procgen", dir, file), "utf8");
      for (const re of forbidden) if (re.test(text)) violations.push(`${dir}/${file}: ${re}`);
    }
  }
  assert.deepEqual(violations, [], violations.join(";"));
  ok(`G7/1186 + G10/1232：${dirs.length} 个目录静态扫描 0 违规（field/worker 禁 Three/DOM）`);
}

// ---------- G8 (TODO 1193/1194/1202/1205)：MC 表完备性、caseIndex、256 case 扫描、接缝 ----------
{
  // 1193：表 hash 锁定（防漂移；布局见 marchingCubesTables.js 头注与 THIRD_PARTY_NOTICES）
  assert.equal(hashHex(EDGE_TABLE.join(",")), "f0ca1ea5");
  assert.equal(hashHex(TRI_TABLE.join(",")), "a2318509");
  // 1194：caseIndex 空 case 与单角
  assert.equal(cubeCase([1, 1, 1, 1, 1, 1, 1, 1]), 0);
  assert.equal(cubeCase([-1, -1, -1, -1, -1, -1, -1, -1]), 255);
  assert.equal(cubeCase([-1, 1, 1, 1, 1, 1, 1, 1]), 1);
  assert.equal(EDGE_TABLE[0], 0);
  assert.equal(EDGE_TABLE[255], 0);
  assert.notEqual(EDGE_TABLE[1], 0);
  // 1202：全部 256 case 扫描——edge mask 补集对称、三角形引用的边都在 mask 内、每 case ≤5 三角形
  const triCount = new Array(256).fill(0);
  let complementAsymmetry = 0;
  for (let c = 0; c < 256; c++) {
    assert.equal(EDGE_TABLE[c], EDGE_TABLE[255 - c], `edge mask 补集对称 @${c}`);
    const counts = (k) => { let n = 0; for (let i = 0; i < 16 && TRI_TABLE[k * 16 + i] !== -1; i += 3) n++; return n; };
    triCount[c] = counts(c);
    for (let i = 0; i < 16 && TRI_TABLE[c * 16 + i] !== -1; i++) {
      const e = TRI_TABLE[c * 16 + i];
      assert.ok(e >= 0 && e < 12 && (EDGE_TABLE[c] & (1 << e)) !== 0, `case ${c} 引用了不在 edgeMask 的边 ${e}`);
    }
    assert.ok(triCount[c] <= 5);
  }
  for (let c = 0; c < 128; c++) if (triCount[c] !== triCount[255 - c]) complementAsymmetry++;
  // 诚实记录：该表（three.js 布局）对歧义面做非对称三角化，补集三角形数不全都相等
  console.log(`    · 256 case 全扫：edge mask 补集全对称；补集三角形数不对称 case 对 ${complementAsymmetry}/128（歧义面约定，见表头注）`);
  assert.ok(complementAsymmetry > 0, "已知歧义面非对称应被记录而非消失");
  // 1203：歧义 case 集合与 asymptotic decider 诊断
  assert.ok(AMBIGUOUS_CASES.has(3) && AMBIGUOUS_CASES.has(240), "典型歧义 case 在册（3=face 歧义，240=其补集类）");
  assert.equal(AMBIGUOUS_CASES.size, 28);
  const d = ambiguityDecision([-1, 1, -1, 1, -1, 1, -1, 1]);
  assert.equal(d.code, 85);
  assert.equal(d.ambiguous, true);
  assert.equal(typeof d.connectInside, "boolean");
  ok("G8/1193-1203：表 hash 锁定 + caseIndex 边界 + 256 case 全扫 + 歧义诊断");
}
{
  // 1205/1336：2×2×2 相邻 chunk 接缝，容差 1e-5，未匹配 boundary edge=0
  const res = 6, halo = 1;
  const sample = (p) => Math.hypot(p[0] - 1, p[1] - 1, p[2] - 1) - 0.8;
  const meshAt = (cx, cy, cz) => {
    const chunk = createChunkField({ origin: [cx, cy, cz], size: [1, 1, 1], resolution: res, halo, sample });
    return marchingCubes(chunk.field, { cellRange: { min: [halo, halo, halo], max: [halo + res - 1, halo + res - 1, halo + res - 1] } });
  };
  const meshes = new Map();
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) meshes.set(`${i}${j}${k}`, meshAt(i, j, k));
  let pairs = 0;
  let totalShared = 0;
  for (let axis = 0; axis < 3; axis++) {
    for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const a = [0, j, k], b = [1, j, k];
      const ka = a.join(""), kb = b.join("");
      // 轴旋转到正确槽位
      const keyA = axis === 0 ? ka : axis === 1 ? [a[1], a[0], a[2]].join("") : [a[1], a[2], a[0]].join("");
      const keyB = axis === 0 ? kb : axis === 1 ? [b[1], b[0], b[2]].join("") : [b[1], b[2], b[0]].join("");
      const seam = validateChunkSeam(meshes.get(keyA), meshes.get(keyB), { axis, coordinate: 1, tolerance: 1e-5 });
      assert.ok(seam.ok, `axis${axis} seam ${keyA}/${keyB}: ${JSON.stringify(seam)}`);
      assert.ok(seam.shared > 0, "接缝确有共享顶点（非空通过）");
      assert.equal(seam.onlyLeft.length + seam.onlyRight.length, 0, "未匹配 boundary edge=0");
      pairs++;
      totalShared += seam.shared;
    }
  }
  ok(`G8/1205：2×2×2 chunk 接缝 ${pairs} 对全过（tolerance=1e-5，共享顶点 ${totalShared}，未匹配=0）`);
}
{
  // 1200/1201/1208：绕序朝外 + 退化=0 + 纯 typed arrays
  const { sdBox } = await im("src/procgen/field/sdf.js");
  for (const [name, sample] of [
    ["sphere", (p) => Math.hypot(...p) - 0.6],
    ["box", (p) => sdBox(p, [0, 0, 0], [0.4, 0.4, 0.4])],
  ]) {
    const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 12, sample });
    const mesh = marchingCubes(field);
    assert.ok(mesh.positions instanceof Float32Array && mesh.normals instanceof Float32Array && mesh.indices instanceof Uint32Array);
    assert.equal(mesh.stats.degenerateTriangles, 0, `${name} 退化三角形=0`);
    let inward = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (mesh.positions[i] * mesh.normals[i] + mesh.positions[i + 1] * mesh.normals[i + 1] + mesh.positions[i + 2] * mesh.normals[i + 2] <= 0) inward++;
    }
    assert.equal(inward, 0, `${name} 法线全部朝外`);
  }
  const mcSrc = fs.readFileSync(path.join(BASE, "src/procgen/field/marchingCubes.js"), "utf8");
  assert.ok(!mcSrc.includes("BufferGeometry"), "MC core 不创建 BufferGeometry");
  // 1195：近零分母/端点命中不产生 NaN
  const eps = createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 4, sample: () => 1 });
  eps.data[0] = -1e-13;
  eps.data[1] = 1e-13;
  const em = marchingCubes(eps);
  assert.ok([...em.positions].every(Number.isFinite) && [...em.normals].every(Number.isFinite));
  ok("G8/1200-1208：sphere/box 法线朝外、退化=0、typed arrays、近零分母无 NaN");
}

// ---------- G9 (TODO 1226)：bridge 同 seed 三次 hash 一致 + 失败不产生半成品 ----------
{
  const protos = [
    { id: "v.solid", family: "f", weight: 1, orientationGroup: "NONE", faces: F6("s") },
    { id: "v.other", family: "f", weight: 1, orientationGroup: "NONE", faces: F6("o") },
  ];
  const graph = createVoxelGrid3D({ width: 2, height: 2, depth: 2 });
  const compiled = compileVariants(protos);
  const table = compileCompatibilityTable(compiled);
  const runs = [1, 2, 3].map(() => runProcgenSurface({ graph, compiled, table, seed: 7 }));
  assert.ok(runs.every((r) => r.ok && r.phase === "complete"));
  assert.equal(runs[0].solution.solutionHash, runs[1].solution.solutionHash);
  assert.equal(runs[1].solution.solutionHash, runs[2].solution.solutionHash);
  assert.equal(runs[0].mesh.stats.triangleCount, runs[2].mesh.stats.triangleCount);
  const failed = runProcgenSurface({ graph, compiled, table, seed: 7, pins: [{ cell: "v:0:0:0", variant: "v.solid@r0" }, { cell: "v:1:0:0", variant: "v.other@r0" }] });
  assert.equal(failed.ok, false);
  assert.equal(failed.phase, "wfc", "失败停在 wfc 阶段，不产生半成品 mesh");
  assert.ok(!("mesh" in failed));
  ok("G9/1226：bridge 同 seed 三次 solution/triangles 一致；WFC 失败不输出半成品");
}

// ---------- G10 (TODO 1234)：取消语义——旧 job 结果不得覆盖新提交 ----------
{
  const messages = [];
  const handler = createWorkerHandler({ runSurface: async (p, { shouldCancel }) => (shouldCancel() ? null : p.v * 2) });
  handler.cancel("job-x");
  await handler(createProcgenJob({ id: "job-x", type: "surface", payload: { v: 1 }, seed: 1 }), (m) => messages.push(m));
  assert.equal(messages[0].error.code, "cancelled", "取消后旧 job 结果被丢弃");
  await handler(createProcgenJob({ id: "job-x", type: "surface", payload: { v: 21 }, seed: 1 }), (m) => messages.push(m));
  assert.equal(messages[1].ok, true, "同 id 重新提交不被旧取消污染（stale cancel 已消费）");
  assert.equal(messages[1].payload, 42);
  // 运行中取消：runner 的结果不得 post 为成功
  const late = [];
  const h2 = createWorkerHandler({ runSurface: async (p, { shouldCancel }) => { h2.cancel("job-y"); return shouldCancel() ? null : p.v; } });
  await h2(createProcgenJob({ id: "job-y", type: "surface", payload: { v: 9 }, seed: 1 }), (m) => late.push(m));
  assert.equal(late[0].error.code, "cancelled");
  ok("G10/1234：取消覆盖旧 job、同 id 重提交通行、运行中取消不出假成功");
}

// ---------- G11 (TODO 1249)：五层台地编号保持稳定 ----------
{
  const profile = createHighlandProfile();
  assert.equal(profile.routePolicy.destination, "castle-top", "现役终点 castle-top");
  assert.deepEqual(profile.routePolicy.interiorFloors, [1, 2, 3, 4, 5], "五层内部旋梯编号 1..5 稳定");
  assert.equal(profile.routePolicy.waterfallSide, "retired");
  assert.equal(profile.routePolicy.waterfallCount, 0);
  assert.equal(profile.version, 1);
  ok("G11/1249：高山 profile 内部旋梯编号与 castle-top 终点 schema 锁定");
}

// ---------- G16 (TODO 1347)：package.json type=module 消除 MODULE_TYPELESS 警告 ----------
{
  const pkg = JSON.parse(fs.readFileSync(path.join(BASE, "package.json"), "utf8"));
  assert.equal(pkg.type, "module");
  ok("G16/1347：TigerMessenger/package.json 声明 type=module");
}

// ---------- G17 (TODO 1359)：阶段门——WIRED+双签也不可越级，DEFAULT_ON 缺签被拦 ----------
{
  assert.equal(canPromote("TESTED", "WIRED"), true);
  assert.equal(canPromote("WIRED", "TESTED"), false, "等级不降级");
  const wired = evaluateMigrationGate({ capabilities: [{ id: "wfc", level: "WIRED" }], requestedFlags: { wfcCastleV1: "wfc" }, visualAccepted: true, perfAccepted: true });
  assert.equal(wired.ok, false, "WIRED + 双签仍不得 default-on（须先晋升 DEFAULT_ON 能力级）");
  const noVisual = evaluateMigrationGate({ capabilities: [{ id: "wfc", level: "DEFAULT_ON" }], requestedFlags: { wfcCastleV1: "wfc" }, visualAccepted: false, perfAccepted: true });
  assert.equal(noVisual.ok, false, "缺视觉签收被拦");
  ok("G17/1359：迁移门——WIRED 不越级、缺签拦截、等级单向");
}

console.log(`\n✅ V7 补充审计断言组=${passed}`);
