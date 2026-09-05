// =====================================================================
// G-14 · 门 J：相邻角柱同名零件在共享面上顶点逐位相等；基座无 T 型接缝
// 用法：node tools/test_corner_seams.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const {
  HIGHLAND_TOWNSCAPER_TOWN_SPEC, levelsToGrid, CITADEL_GRID_SIZE,
} = await import(new URL("world/citadelTown.js", SRC).href);
const { cornerAllowedProtoIds, cornerGeometryParts } =
  await import(new URL("world/citadel/cornerPrototypes.js", SRC).href);
const { createCornerGraph } =
  await import(new URL("world/citadel/cornerGraphAdapter.js", SRC).href);

assert.ok(fs.existsSync(new URL("./out/corner_mask_table.json", import.meta.url)));

const CS = 2;
const CH = 2;
const GS = CITADEL_GRID_SIZE;
const round6 = (n) => n.toFixed(6);
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

function originOf(gx, gz, iy) {
  const half = (GS - 1) / 2;
  return {
    x: ((gx - 1) - half) * CS,
    y: (iy + 0.5) * CH,
    z: ((gz - 1) - half) * CS,
  };
}

function faceVertsByPart(parts, origin, axis, unitPlane) {
  const byPart = new Map();
  const put = (name, wx, wy, wz) => {
    if (!byPart.has(name)) byPart.set(name, new Set());
    byPart.get(name).add(`${round6(wx)},${round6(wy)},${round6(wz)}`);
  };
  const world = (x, y, z) => [origin.x + x * CS, origin.y + y * CH, origin.z + z * CS];
  for (const p of parts) {
    if (p.kind === "box") {
      const xs = [p.min[0], p.max[0]];
      const ys = [p.min[1], p.max[1]];
      const zs = [p.min[2], p.max[2]];
      for (const x of xs) for (const y of ys) for (const z of zs) {
        const u = axis === "x" ? x : axis === "y" ? y : z;
        if (Math.abs(u - unitPlane) > 1e-9) continue;
        const w = world(x, y, z);
        put(p.part, w[0], w[1], w[2]);
      }
    } else if (p.kind === "prism") {
      const ys = [p.y0 ?? p.yLo, p.y1 ?? p.yHi, p.base].filter((v) => Number.isFinite(v));
      for (const [x, z] of p.quad) {
        for (const y of ys) {
          const u = axis === "x" ? x : axis === "y" ? y : z;
          if (Math.abs(u - unitPlane) > 1e-9) continue;
          const w = world(x, y, z);
          put(p.part, w[0], w[1], w[2]);
        }
      }
    }
  }
  return byPart;
}

function planeOf(dir) {
  if (dir === "E") return { axis: "x", a: 1, b: 0 };
  if (dir === "W") return { axis: "x", a: 0, b: 1 };
  if (dir === "S") return { axis: "z", a: 1, b: 0 };
  if (dir === "N") return { axis: "z", a: 0, b: 1 };
  if (dir === "U") return { axis: "y", a: 1, b: 0 };
  if (dir === "D") return { axis: "y", a: 0, b: 1 };
  throw new Error(dir);
}

const grid = levelsToGrid(HIGHLAND_TOWNSCAPER_TOWN_SPEC.levels);
const graph = createCornerGraph(grid, {
  cols: GS, rows: GS, floors: HIGHLAND_TOWNSCAPER_TOWN_SPEC.floors ?? 12,
});

let pairs = 0;
let mismatch = 0;
let sameRole = 0;
let sameRoleMismatch = 0;
const samples = [];

for (const { index } of graph.cells()) {
  const a = graph.coordOf(index);
  const maskA = graph.maskOf(index);
  const allowA = cornerAllowedProtoIds(maskA);
  const originA = originOf(a.gx, a.gz, a.iy);
  for (const e of graph.neighborsOf(index)) {
    if (e.to < index) continue;
    const b = graph.coordOf(e.to);
    const maskB = graph.maskOf(e.to);
    const allowB = cornerAllowedProtoIds(maskB);
    const originB = originOf(b.gx, b.gz, b.iy);
    const pl = planeOf(e.direction);
    const ga = faceVertsByPart(cornerGeometryParts(maskA, allowA[0]), originA, pl.axis, pl.a);
    const gb = faceVertsByPart(cornerGeometryParts(maskB, allowB[0]), originB, pl.axis, pl.b);
    pairs++;
    for (const [name, va] of ga) {
      const vb = gb.get(name);
      if (!vb) continue;
      if (!sameSet(va, vb)) {
        mismatch++;
        if (samples.length < 6) samples.push(`${graph.cellId(index)} ${e.direction} ${graph.cellId(e.to)} part=${name}`);
        break;
      }
    }
    const common = allowA.find((id) => allowB.includes(id));
    if (common) {
      sameRole++;
      const sa = faceVertsByPart(cornerGeometryParts(maskA, common), originA, pl.axis, pl.a);
      const sb = faceVertsByPart(cornerGeometryParts(maskB, common), originB, pl.axis, pl.b);
      for (const [name, va] of sa) {
        const vb = sb.get(name);
        if (!vb) continue;
        if (!sameSet(va, vb)) {
          sameRoleMismatch++;
          if (samples.length < 6) samples.push(`同件 ${common} ${graph.cellId(index)}/${graph.cellId(e.to)}`);
          break;
        }
      }
    }
  }
}
if (samples.length) console.log(samples);
assert.equal(mismatch, 0, `${mismatch}/${pairs} 对同名零件不对齐`);
assert.equal(sameRoleMismatch, 0, `${sameRoleMismatch}/${sameRole} 对同件不对齐`);
console.log(`任意选件 ${pairs} 对同名零件对齐；同件 ${sameRole} 对对齐`);

{
  // 两格沿 X 相邻：共享格边在顶点 gx=6 上。基座画在角柱内部的顶点十字
  // （x=0.5 / z=0.5），不在相邻角柱的交界面（格心平面）上。T 缝判据是：
  // 同时含这两格的角柱里，左右两象限的 plinth 在 x=0.5 截面上顶点集合相等。
  // 贯通墙（shape=through）才允许 plinth 件：两列各两层。
  const two = new Map([
    ["5,0,5", "0"], ["6,0,5", "0"],
    ["5,1,5", "0"], ["6,1,5", "0"],
  ]);
  const g2 = createCornerGraph(two, { cols: 25, rows: 25, floors: 2 });
  let plinthPairs = 0;
  for (const { index } of g2.cells()) {
    const mask = g2.maskOf(index);
    const proto = cornerAllowedProtoIds(mask).find((id) => id.startsWith("plinth"));
    if (!proto) continue;
    const origin = originOf(g2.coordOf(index).gx, g2.coordOf(index).gz, g2.coordOf(index).iy);
    const parts = cornerGeometryParts(mask, proto);
    const left = [];
    const right = [];
    for (const p of parts) {
      if (p.kind !== "box" || !String(p.part).startsWith("plinth")) continue;
      const onCross = (p.min[0] <= 0.5 + 1e-9 && p.max[0] >= 0.5 - 1e-9);
      if (!onCross) continue;
      const bucket = p.max[0] <= 0.5 + 1e-9 ? left : p.min[0] >= 0.5 - 1e-9 ? right : null;
      if (!bucket) continue;
      const ys = [p.min[1], p.max[1]];
      const zs = [p.min[2], p.max[2]];
      for (const y of ys) for (const z of zs) {
        const w = `${round6(origin.x + 0.5 * CS)},${round6(origin.y + y * CH)},${round6(origin.z + z * CS)}`;
        bucket.push(w);
      }
    }
    if (!left.length || !right.length) continue;
    const va = new Set(left);
    const vb = new Set(right);
    assert.ok(sameSet(va, vb), `基座 T 缝 ${g2.cellId(index)} ${proto} L=${[...va]} R=${[...vb]}`);
    plinthPairs++;
  }
  assert.ok(plinthPairs > 0, "两格布局应至少有一根角柱同时含两侧基座");
  console.log(`S19 t=1.05 基座同名零件 ${plinthPairs} 对，无 T 型接缝`);
}

console.log("✅ test_corner_seams");
