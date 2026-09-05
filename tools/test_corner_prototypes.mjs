// =====================================================================
// C9 · 角落分段目录自检（Claude 侧规格的机器判据；G-13 派单前必须绿）
//
// 证四件事：
//   ① 每件都能过 V7 的 validateModulePrototype
//   ② 256 个 mask **每一个**都至少允许一件（允许集为空 = 目录缺件）
//   ③ 允许集是 D4 不变量（同一 classId 里所有 mask 的允许集逐字相同）——
//      G-13 才能按 classId 建 bans，而不必逐 mask
//   ④ **接缝零间隙**（门 J 的地基）：相邻两个角柱在共享面上的截面逐位相等。
//      这里用 mask 直接构造相邻对：节点 A 的 E 面 bit == 节点 B 的 W 面 bit，
//      且两侧几何在该平面上的顶点集合逐位相等。
//
// 运行：node tools/test_corner_prototypes.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const {
  CORNER_PROTOTYPES, cornerAllowedProtoIds, cornerBuildAllowedClasses,
  cornerGeometryParts, cornerFaceBits, cornerShapeOf, lowerNibble, upperNibble,
  nibbleOrbit, cornerBit,
} = await import(new URL("world/citadel/cornerPrototypes.js", SRC).href);
const { validateModulePrototype } = await import(new URL("procgen/wfc/moduleSchema.js", SRC).href);

// ---------- ① schema ----------
for (const p of CORNER_PROTOTYPES) {
  const v = validateModulePrototype(p);
  assert.ok(v.ok, `${p.id}: ${v.errors?.join(",")}`);
}
const ids = CORNER_PROTOTYPES.map((p) => p.id);
assert.equal(new Set(ids).size, ids.length, "prototype id 重复");
console.log(`✓ ① ${CORNER_PROTOTYPES.length} 件全部过 validateModulePrototype`);

// ---------- ② 覆盖率 ----------
const empty = [];
const bySize = new Map();
for (let mask = 0; mask < 256; mask++) {
  const allowed = cornerAllowedProtoIds(mask);
  if (!allowed.length) empty.push(mask);
  bySize.set(allowed.length, (bySize.get(allowed.length) ?? 0) + 1);
}
assert.equal(empty.length, 0,
  `${empty.length} 个 mask 没有任何件可用（目录缺件，不要在适配器里兜底）：${empty.slice(0, 12).join(",")}`);
const sizes = [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}件×${c}`).join(" ");
console.log(`✓ ② 256 个 mask 全部有解；允许集大小分布 ${sizes}`);

// 形态分布（人看的，出问题时定位快）
const shapeCount = new Map();
for (let mask = 0; mask < 256; mask++) {
  const s = cornerShapeOf(mask);
  shapeCount.set(s, (shapeCount.get(s) ?? 0) + 1);
}
console.log(`  形态分布 ${[...shapeCount.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);

// ---------- ③ D4 不变 ----------
const tablePath = new URL("./out/corner_mask_table.json", import.meta.url);
assert.ok(fs.existsSync(tablePath), "先跑 node tools/gen_corner_mask_table.mjs 生成 corner_mask_table.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8"));
const rows = table.table ?? table;
assert.equal(rows.length, 256, "mask 表必须 256 行");
const byProto = cornerBuildAllowedClasses(rows);   // 内部会在不变量被破坏时抛
const classCount = new Set(rows.map((r) => r.classId)).size;
assert.equal(classCount, 55, `D4 类数应为 55，实际 ${classCount}`);
const perProto = [...byProto.entries()].map(([id, set]) => `${id}=${set.size}`).join(" ");
console.log(`✓ ③ 允许集是 D4 不变量；55 类；每件覆盖类数 ${perProto}`);
for (const [id, set] of byProto) {
  assert.ok(set.size > 0, `${id} 一个 mask 类都不允许 —— 死件，要么删要么放宽`);
}

// ---------- ④ 接缝零间隙 ----------
// 造一对相邻角柱：A 在 (gx,gz)，B 在 (gx+1,gz)。它们共享 A 的 E 面 / B 的 W 面，
// 也就是共享「A 的 dx=1 那两格」== 「B 的 dx=0 那两格」（上下层各两个）。
// 于是给定 8 格 × 2 列的占用，两个 mask 完全确定。
const bit = cornerBit;
function pairMasks(a00, a10, a01, a11, b10, b11, hiA00, hiA10, hiA01, hiA11, hiB10, hiB11) {
  // A 覆盖列 x∈{0,1}，B 覆盖列 x∈{1,2}；共享列 x=1
  const A =
    (a00 << bit(0, 0, 0)) | (a10 << bit(1, 0, 0)) | (a01 << bit(0, 1, 0)) | (a11 << bit(1, 1, 0)) |
    (hiA00 << bit(0, 0, 1)) | (hiA10 << bit(1, 0, 1)) | (hiA01 << bit(0, 1, 1)) | (hiA11 << bit(1, 1, 1));
  const B =
    (a10 << bit(0, 0, 0)) | (b10 << bit(1, 0, 0)) | (a11 << bit(0, 1, 0)) | (b11 << bit(1, 1, 0)) |
    (hiA10 << bit(0, 0, 1)) | (hiB10 << bit(1, 0, 1)) | (hiA11 << bit(0, 1, 1)) | (hiB11 << bit(1, 1, 1));
  return [A, B];
}

/**
 * 取零件表里落在给定 x 平面上的顶点，**按零件名分组**。
 *
 * 为什么不是「整体顶点集合相等」：相邻两个角柱可以合法地扮演不同角色——
 * 一边是屋顶转角、另一边是更高体块的内部。那时两侧本来就该长得不一样，
 * 而且交界埋在实体里，根本看不见。真正该守的是**同名零件必须对齐**：
 * 一堵墙、一段基座、一块楼板，只要两侧都出了，截面就必须逐位相同——
 * 否则就是 S19 t=1.05 那种「基座在两格之间露缝」。
 */
function faceVertsByPart(parts, xPlane, shift = 0) {
  const byPart = new Map();
  const put = (name, x, y, z) => {
    if (!byPart.has(name)) byPart.set(name, new Set());
    byPart.get(name).add(`${(x + shift).toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`);
  };
  for (const p of parts) {
    if (p.kind === "box") {
      for (const x of [p.min[0], p.max[0]]) {
        if (Math.abs(x - xPlane) > 1e-9) continue;
        for (const y of [p.min[1], p.max[1]]) for (const z of [p.min[2], p.max[2]]) put(p.part, x, y, z);
      }
    } else if (p.kind === "prism") {
      for (const [x, z] of p.quad) {
        if (Math.abs(x - xPlane) > 1e-9) continue;
        for (const y of [p.base, p.yLo, p.yHi]) put(p.part, x, y, z);
      }
    }
  }
  return byPart;
}

const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

let checked = 0;
let seamMismatch = 0;
let sameRoleChecked = 0;
let sameRoleMismatch = 0;
const samples = [];
// 枚举共享列的 4 个 bit（上下层 × dz 两格）+ 两侧各自外侧列的 4 个 bit
for (let shared = 0; shared < 16; shared++) {
  for (let outA = 0; outA < 16; outA++) {
    for (let outB = 0; outB < 16; outB++) {
      const s = (i) => (shared >> i) & 1;   // 0:lo,dz0 1:lo,dz1 2:hi,dz0 3:hi,dz1
      const oa = (i) => (outA >> i) & 1;
      const ob = (i) => (outB >> i) & 1;
      const [A, B] = pairMasks(
        oa(0), s(0), oa(1), s(1),
        ob(0), ob(1),
        oa(2), s(2), oa(3), s(3),
        ob(2), ob(3)
      );
      assert.equal(cornerFaceBits(A, "E"), cornerFaceBits(B, "W"), `共享面 bit 不一致 A=${A} B=${B}`);
      const allowA = cornerAllowedProtoIds(A);
      const allowB = cornerAllowedProtoIds(B);

      // ④a 任意选件：同名零件必须对齐
      const ga = faceVertsByPart(cornerGeometryParts(A, allowA[0]), 1, 0);
      const gb = faceVertsByPart(cornerGeometryParts(B, allowB[0]), 0, 1);
      checked++;
      for (const [name, va] of ga) {
        const vb = gb.get(name);
        if (!vb) continue;                       // 一侧没出这个零件：合法（角色不同）
        if (!sameSet(va, vb)) {
          seamMismatch++;
          if (samples.length < 6) samples.push(`A=${A}(${allowA[0]}) B=${B}(${allowB[0]}) 零件 ${name} 不对齐`);
          break;
        }
      }

      // ④b 两侧选同一件（socket 会逼出这种情况）：全部零件逐位相等
      const common = allowA.find((id) => allowB.includes(id));
      if (common) {
        sameRoleChecked++;
        const sa = faceVertsByPart(cornerGeometryParts(A, common), 1, 0);
        const sb = faceVertsByPart(cornerGeometryParts(B, common), 0, 1);
        for (const [name, va] of sa) {
          const vb = sb.get(name);
          if (!vb) continue;
          if (!sameSet(va, vb)) {
            sameRoleMismatch++;
            if (samples.length < 6) samples.push(`同件 ${common}：A=${A} B=${B} 零件 ${name} 不对齐`);
            break;
          }
        }
      }
    }
  }
}
console.log(`✓ ④a 任意选件 ${checked} 对：同名零件截面不对齐 ${seamMismatch} 对`);
console.log(`✓ ④b 同件 ${sameRoleChecked} 对：截面不对齐 ${sameRoleMismatch} 对`);
if (samples.length) console.log(samples.join("\n"));
assert.equal(seamMismatch, 0, "相邻角柱的同名零件必须在共享面上逐位相等（门 J 的地基）");
assert.equal(sameRoleMismatch, 0, "两侧选同一件时截面必须逐位相等");

console.log("✅ test_corner_prototypes（目录可派单：G-13 的 allowedClassesOf 直接用 cornerBuildAllowedClasses）");
