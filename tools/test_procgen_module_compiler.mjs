// V7-G2：模块 schema / 方向群 / socket 编译 / 兼容表 / 47 模块迁移 测试
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
const bridgePkg = path.join(BASE, "node_modules/three/package.json");
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(path.dirname(bridgePkg), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const { validateModulePrototype, createModuleSetManifest } = await import(
  new URL("src/procgen/wfc/moduleSchema.js", "file://" + BASE).href
);
const { orientationTransforms, validateOrientationGroup, applyTransformToFaces } = await import(
  new URL("src/procgen/wfc/orientationGroup.js", "file://" + BASE).href
);
const { expandPrototype, compileVariants } = await import(
  new URL("src/procgen/wfc/socketCompiler.js", "file://" + BASE).href
);
const { compileCompatibilityTable } = await import(
  new URL("src/procgen/wfc/compatibilityTable.js", "file://" + BASE).href
);
const { migrateCatalogModules } = await import(
  new URL("src/procgen/wfc/migrateCatalog.js", "file://" + BASE).href
);
const { buildCastleModuleSets } = await import(
  new URL("src/procgen/wfc/moduleSets.js", "file://" + BASE).href
);
const { createModuleCatalog, MODULE_COMBINATION_SPACE } = await import(
  new URL("src/world/citadel/moduleCatalog.js", "file://" + BASE).href
);

let passed = 0;
const ok = (msg) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

// ---------- orientation groups ----------
{
  assert.equal(orientationTransforms("NONE").length, 1);
  assert.equal(orientationTransforms("Y4").length, 4);
  assert.equal(orientationTransforms("D4").length, 8);
  assert.equal(orientationTransforms("CUBE24").length, 24);
  for (const g of ["NONE", "Y4", "D4", "CUBE24"]) {
    const v = validateOrientationGroup(g);
    assert.ok(v.ok, `${g}: ${v.errors.join(",")}`);
  }
  ok("方向群阶数 NONE=1 / Y4=4 / D4=8 / CUBE24=24，闭包+逆元+opposite 不变量全过");
}
{
  // 旋转面映射：r90 后 N 面 → E
  const t90 = orientationTransforms("Y4")[1];
  assert.equal(t90.name, "r90");
  const faces = { N: { connector: "a" }, E: { connector: "b" }, S: { connector: "c" }, W: { connector: "d" } };
  const rotated = applyTransformToFaces(faces, t90);
  assert.equal(rotated.E.connector, "a"); // 原 N → E
  assert.equal(rotated.S.connector, "b"); // 原 E → S
  // 镜像：r0m（perm=MX）后 E↔W，N/S 不动
  const tM = orientationTransforms("D4").find((t) => t.name === "r0m");
  const mirrored = applyTransformToFaces(faces, tM);
  assert.equal(mirrored.N.connector, "a"); // N 不动
  assert.equal(mirrored.W.connector, "b"); // W = 原 E
  assert.equal(mirrored.E.connector, "d"); // E = 原 W
  ok("applyTransformToFaces 旋转/镜像面映射语义正确");
}

// ---------- module schema ----------
{
  const good = {
    id: "wall.arch.v1",
    family: "wall",
    weight: 1.2,
    orientationGroup: "Y4",
    faces: {
      N: { connector: "wall-arch", parity: "normal" },
      S: { connector: "wall-arch", parity: "flipped" },
      E: { connector: "wall-solid", parity: "symmetric" },
      W: { connector: "wall-solid", parity: "symmetric" },
      U: { connector: "floor-bearing", parity: "symmetric" },
      D: { connector: "foundation-bearing", parity: "symmetric" },
    },
    builderKey: "wall:arch",
  };
  assert.ok(validateModulePrototype(good).ok);
  assert.ok(!validateModulePrototype({ ...good, weight: 0 }).ok); // weight ≤0 拒绝
  assert.ok(!validateModulePrototype({ ...good, weight: NaN }).ok); // NaN 拒绝（entropy 防污染）
  assert.ok(!validateModulePrototype({ ...good, weight: Infinity }).ok);
  assert.ok(!validateModulePrototype({ ...good, faces: { X: {} } }).ok); // 非法面
  assert.ok(
    !validateModulePrototype({ ...good, id: "door.x", family: "door", orientationGroup: "CUBE24" }).ok,
    "门禁止 CUBE24 倒置"
  );
  assert.ok(
    !validateModulePrototype({ ...good, id: "chimney.x", family: "chimney", orientationGroup: "CUBE24" }).ok,
    "烟囱禁止 CUBE24 倒置"
  );
  ok("schema 校验：weight 有限>0 / 面合法 / 门烟囱禁 CUBE24");
}

// ---------- socket compiler：parity / 去重 / 稳定 index ----------
{
  // 非对称楼梯：镜像后 parity 翻转
  const stairs = {
    id: "stairs.straight.v1",
    family: "stairs",
    weight: 1,
    orientationGroup: "Y4",
    faces: {
      N: { connector: "stairs", parity: "flipped" },
      S: { connector: "stairs", parity: "normal" },
      E: { connector: "wall", parity: "symmetric" },
      W: { connector: "wall", parity: "symmetric" },
    },
  };
  const { variants } = expandPrototype(stairs);
  assert.equal(variants.length, 4); // Y4 无去重（N/S 均非对称）
  const r0 = variants.find((v) => v.transformName === "r0");
  assert.equal(r0.faces.N.parity, "flipped");
  ok("socket 编译：旋转不变 parity");
}
{
  // 对称模块：四旋转等价 → 去重到 1
  const plain = {
    id: "plain.cube.v1",
    family: "floor",
    weight: 1,
    orientationGroup: "Y4",
    faces: {
      N: { connector: "wall", parity: "symmetric" },
      E: { connector: "wall", parity: "symmetric" },
      S: { connector: "wall", parity: "symmetric" },
      W: { connector: "wall", parity: "symmetric" },
    },
  };
  const { variants, equivalence } = expandPrototype(plain);
  assert.equal(variants.length, 1);
  assert.equal(equivalence.length, 3);
  assert.equal(equivalence[0].equivalentTo, "plain.cube.v1@r0");
  ok("旋转等价 variant 去重 + equivalence report 说明去重原因");
}
{
  // 稳定 index：模块加载顺序变化不改变 index/hash
  const a = {
    id: "a.sym.v1",
    family: "floor",
    faces: { N: { connector: "x", parity: "symmetric" }, E: { connector: "x", parity: "symmetric" }, S: { connector: "x", parity: "symmetric" }, W: { connector: "x", parity: "symmetric" } },
  };
  const b = {
    id: "b.sym.v1",
    family: "wall",
    faces: { N: { connector: "x", parity: "symmetric" }, E: { connector: "x", parity: "symmetric" }, S: { connector: "x", parity: "symmetric" }, W: { connector: "x", parity: "symmetric" } },
  };
  const c1 = compileVariants([a, b]);
  const c2 = compileVariants([b, a]); // 打乱加载顺序
  const key1 = c1.variants.map((v) => `${v.key}#${v.index}`).join(",");
  const key2 = c2.variants.map((v) => `${v.key}#${v.index}`).join(",");
  assert.equal(key1, key2);
  assert.equal(c1.variants[0].key, "a.sym.v1@r0");
  ok("variant 冻结 index：加载顺序变化不影响 index 与 key 序");
}

// ---------- compatibility table ----------
{
  // parity 互补规则：normal↔flipped 咬合；symmetric↔symmetric；
  // normal-normal / flipped-flipped / normal-symmetric 均拒绝。
  const A = {
    id: "A.v1",
    family: "wall",
    faces: { N: { connector: "c1", parity: "normal" }, S: { connector: "c1", parity: "flipped" } },
  };
  const B = {
    id: "B.v1",
    family: "wall",
    faces: { N: { connector: "c1", parity: "flipped" }, S: { connector: "c1", parity: "normal" } },
  };
  const sym = {
    id: "sym.v1",
    family: "wall",
    faces: { N: { connector: "c1", parity: "symmetric" }, S: { connector: "c1", parity: "symmetric" } },
  };
  const compiled = compileVariants([A, B, sym]);
  const table = compileCompatibilityTable(compiled);
  const idx = (k) => compiled.variantIndex.get(k);
  // A 的 N(normal) 朝北，北邻的 S 面必须 flipped：A.S=flipped ✓，B.S=normal ✗，sym.S=symmetric ✗
  assert.ok(table.isCompatible(idx("A.v1@r0"), "N", idx("A.v1@r0"))); // normal × flipped ✓
  assert.ok(table.isCompatible(idx("A.v1@r0"), "S", idx("A.v1@r0"))); // 对称方向 ✓
  assert.ok(!table.isCompatible(idx("A.v1@r0"), "N", idx("B.v1@r0"))); // normal × normal ✗
  assert.ok(!table.isCompatible(idx("A.v1@r0"), "N", idx("sym.v1@r0"))); // normal × symmetric ✗
  assert.ok(table.isCompatible(idx("sym.v1@r0"), "N", idx("sym.v1@r0"))); // symmetric × symmetric ✓
  ok("兼容表 parity 互补规则（normal↔flipped / symmetric↔symmetric）");
}
{
  // excludedNeighbors / walkable 要求
  const walker = {
    id: "walk.v1",
    family: "floor",
    faces: { N: { connector: "path", parity: "symmetric", walkable: true }, S: { connector: "path", parity: "symmetric", walkable: true } },
  };
  const nonWalker = {
    id: "solid.v1",
    family: "wall",
    faces: { N: { connector: "path", parity: "symmetric", walkable: false }, S: { connector: "path", parity: "symmetric", walkable: false } },
  };
  const excluder = {
    id: "excl.v1",
    family: "wall",
    faces: { N: { connector: "path", parity: "symmetric", excludedNeighbors: ["solid.v1"] }, S: { connector: "path", parity: "symmetric", excludedNeighbors: ["solid.v1"] } },
  };
  const compiled = compileVariants([walker, nonWalker, excluder]);
  const table = compileCompatibilityTable(compiled);
  const idx = (k) => compiled.variantIndex.get(k);
  assert.ok(!table.isCompatible(idx("walk.v1@r0"), "N", idx("solid.v1@r0")), "walkable 面拒绝不可走邻居");
  assert.ok(!table.isCompatible(idx("excl.v1@r0"), "N", idx("solid.v1@r0")), "显式排除生效");
  assert.ok(!table.isCompatible(idx("solid.v1@r0"), "N", idx("excl.v1@r0")), "反向排除对称生效");
  ok("兼容表 excludedNeighbors + walkable-neighbor 要求");
}
{
  // dead variant 构建报错：connector "solo" 只以 normal parity 出现，
  // 全 set 无 flipped 对应 → normal×normal 拒绝，lonely 无任何邻居。
  const lonely = {
    id: "lonely.v1",
    family: "wall",
    faces: { N: { connector: "solo", parity: "normal" } },
  };
  const friendly = {
    id: "friendly.v1",
    family: "wall",
    faces: { N: { connector: "ok", parity: "symmetric" } },
  };
  const compiled = compileVariants([lonely, friendly]);
  assert.throws(() => compileCompatibilityTable(compiled), /dead variants/);
  const report = compileCompatibilityTable(compiled, { onDeadVariant: "report" });
  assert.equal(report.deadVariants.length, 4); // 4 个朝向全部死
  assert.ok(report.deadVariants.every((d) => d.key.startsWith("lonely.v1@")));
  ok("dead variant：throw 模式构建报错 / report 模式登记");
}
{
  // boundary 连接器只与 graph 边界匹配，永不与其它 variant（哪怕同为 boundary）匹配
  const h = (c) => ({ connector: c, parity: "symmetric" });
  const ground = {
    id: "ground.v1",
    family: "foundation",
    faces: { N: h("ok"), E: h("ok"), S: h("ok"), W: h("ok"), D: { connector: "boundary", parity: "symmetric" } },
  };
  const other = {
    id: "other.v1",
    family: "wall",
    faces: { N: h("ok"), E: h("ok"), S: h("ok"), W: h("ok"), U: { connector: "boundary", parity: "symmetric" } },
  };
  const compiled = compileVariants([ground, other]);
  const table = compileCompatibilityTable(compiled);
  assert.equal(table.deadVariants.length, 0); // 水平面 ok 互通，不死
  const idx = (k) => compiled.variantIndex.get(k);
  // 水平方向 ok×ok 兼容
  assert.ok(table.isCompatible(idx("ground.v1@r0"), "N", idx("other.v1@r0")));
  // boundary 面永不匹配任何 variant
  assert.ok(!table.isCompatible(idx("ground.v1@r0"), "D", idx("other.v1@r0")));
  assert.ok(!table.isCompatible(idx("ground.v1@r0"), "D", idx("ground.v1@r0")));
  ok("boundary 连接器只与 graph 边界匹配（水平互通但竖直 boundary 永不合配）");
}

// ---------- 47 模块迁移 + 三 manifest ----------
{
  const catalog = createModuleCatalog();
  assert.equal(catalog.modules.length, 47);
  const { prototypes, report } = migrateCatalogModules(catalog.modules);
  assert.equal(report.oldModuleCount, 47);
  assert.equal(report.prototypeCount, 47);
  for (const p of prototypes) {
    const v = validateModulePrototype(p);
    assert.ok(v.ok, `${p.id}: ${v.errors.join(",")}`);
  }
  // 编译 variants + 兼容表：全量可用（无 dead variant）
  const compiled = compileVariants(prototypes);
  const table = compileCompatibilityTable(compiled);
  assert.equal(table.deadVariants.length, 0);
  assert.ok(compiled.stats.variants > 47, "展开后 variant 数 > prototype 数（旋转去重后）");
  assert.equal(MODULE_COMBINATION_SPACE, 2450);
  ok(
    `47 模块迁移 V7 schema：${compiled.stats.variants} variants（去重 ${compiled.stats.deduped}），0 dead，2450=旧组合指标口径保留`
  );
  // 三 manifest
  const sets = buildCastleModuleSets(catalog.modules);
  for (const [name, set] of Object.entries(sets)) {
    assert.ok(set.validation.ok, `${name}: ${set.validation.errors.join(",")}`);
    assert.ok(set.prototypes.length > 0);
    const sc = compileVariants(set.prototypes);
    const st = compileCompatibilityTable(sc);
    assert.equal(st.deadVariants.length, 0, `${name} dead variants`);
  }
  ok(`三 castle module-set manifest（highland/ancient/canal）全部可编译、0 dead variant`);
  // 兼容报告落盘（V7-G2 交付物 compatibility-report.json）
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const reportData = {
    generated: "2026-08-22",
    schemaVersion: 1,
    highland: {
      prototypes: 47,
      variants: compiled.stats.variants,
      deduped: compiled.stats.deduped,
      legacyCombinationSpace: MODULE_COMBINATION_SPACE,
      stats: { ...table.stats, deadVariantCount: table.deadVariants.length },
    },
    manifests: {
      highland: { version: sets.highland.moduleSetVersion, prototypes: sets.highland.prototypes.length },
      ancient: { version: sets.ancient.moduleSetVersion, prototypes: sets.ancient.prototypes.length },
      canal: { version: sets.canal.moduleSetVersion, prototypes: sets.canal.prototypes.length },
    },
  };
  fs.writeFileSync(path.join(outDir, "procgen-compatibility-report.json"), JSON.stringify(reportData, null, 2));
  ok("compatibility-report.json 落盘（方向密度/socket 使用/连通块统计）");
}

console.log(`\n全部通过：${passed} 项断言（V7-G2 module compiler）`);
