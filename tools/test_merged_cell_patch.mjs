// =====================================================================
// 合并块区间压缩验收（2026-09-03，Option C 第 2 步）
//
// 核心不变量：摘掉 dirty 格之后，**没被摘的顶点数据必须逐位不变**。
// 只要这条成立，非 dirty 格就不需要重新生成模块——那才是省时间的地方。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { dropCellsFromMerged, mergedTriangleCount } =
  await import(new URL("src/world/citadel/mergedCellPatch.js", BASE).href);

/** 造一个非索引化合并几何：每格 2 个三角形，顶点值按格编号，便于逐位比对 */
function makeMerged(cellTriCounts) {
  const tris = cellTriCounts.reduce((n, c) => n + c.tris, 0);
  const pos = new Float32Array(tris * 3 * 3);
  const col = new Float32Array(tris * 3 * 3);
  const faceToCell = [];
  let t = 0;
  for (const c of cellTriCounts) {
    if (c.cell) faceToCell.push({ triStart: t, triCount: c.tris, cell: c.cell });
    for (let i = 0; i < c.tris; i++, t++) {
      for (let v = 0; v < 3; v++) {
        const o = (t * 3 + v) * 3;
        pos[o] = c.tag; pos[o + 1] = t; pos[o + 2] = v;
        col[o] = c.tag; col[o + 1] = 0.5; col[o + 2] = 0.25;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  mesh.userData.faceToCell = faceToCell;
  mesh.userData.mergedGeometry = true;
  return mesh;
}

const C = (ix, iy, iz) => ({ ix, iy, iz });
const key = (c) => `${c.ix},${c.iy},${c.iz}`;

// 布局：A(2) | 无主(3) | B(2) | C(4) | 无主(1)
// 「无主」段模拟没有 userData.cell 的装饰/地形几何——它们必须被留住
const layout = [
  { tris: 2, tag: 10, cell: C(1, 0, 0) },
  { tris: 3, tag: 99, cell: null },
  { tris: 2, tag: 20, cell: C(2, 0, 0) },
  { tris: 4, tag: 30, cell: C(3, 0, 0) },
  { tris: 1, tag: 98, cell: null },
];
const TOTAL = 12;

// ---- 1. 摘中间一格：数量对、faceToCell 重编号对 ----
{
  const m = makeMerged(layout);
  assert.equal(mergedTriangleCount(m), TOTAL);
  const removed = dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");
  assert.equal(removed, 2, "应摘掉 B 的 2 个三角形");
  assert.equal(mergedTriangleCount(m), TOTAL - 2);
  const f = m.userData.faceToCell;
  assert.equal(f.length, 2, "B 的条目应被移除");
  assert.deepEqual(f.map((s) => [key(s.cell), s.triStart, s.triCount]),
    [["1,0,0", 0, 2], ["3,0,0", 5, 4]], "C 的起点应前移 2");
}

// ---- 2. 关键不变量：保留下来的顶点数据逐位不变 ----
{
  const before = makeMerged(layout);
  const src = [...before.geometry.attributes.position.array];
  const m = makeMerged(layout);
  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");
  // 被摘的是三角形 5..6（B），保留 0..4 与 7..11
  const expect = [...src.slice(0, 5 * 9), ...src.slice(7 * 9)];
  assert.deepEqual([...m.geometry.attributes.position.array], expect,
    "未被摘的顶点必须逐位不变——否则非 dirty 格还是得重建");
  // color 属性同样要跟着搬，不能只搬 position
  assert.equal(m.geometry.attributes.color.count, m.geometry.attributes.position.count,
    "所有属性必须同步压缩");
}

// ---- 3. 无主区间（没有 cell 的几何）不得被误摘 ----
{
  const m = makeMerged(layout);
  dropCellsFromMerged(m, () => true); // 摘掉所有认领了的格
  const tags = new Set();
  const a = m.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) tags.add(a[i]);
  assert.deepEqual([...tags].sort((x, y) => x - y), [98, 99],
    "只剩两段无主几何，说明无主区间被保住了");
  assert.equal(mergedTriangleCount(m), 4);
}

// ---- 4. 摘相邻两格：区间合并，不留空洞 ----
{
  const m = makeMerged(layout);
  const removed = dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0" || key(s.cell) === "3,0,0");
  assert.equal(removed, 6);
  assert.equal(mergedTriangleCount(m), TOTAL - 6);
  assert.deepEqual(m.userData.faceToCell.map((s) => [key(s.cell), s.triStart]), [["1,0,0", 0]]);
}

// ---- 5. 没命中就一个字节都不许动（热路径每帧都会问一遍） ----
{
  const m = makeMerged(layout);
  const before = [...m.geometry.attributes.position.array];
  const f0 = m.userData.faceToCell;
  assert.equal(dropCellsFromMerged(m, () => false), 0);
  assert.deepEqual([...m.geometry.attributes.position.array], before);
  assert.equal(m.userData.faceToCell, f0, "没动就不该重建 faceToCell 数组");
}

// ---- 6. 边界：无 faceToCell / 空网格不炸 ----
{
  assert.equal(dropCellsFromMerged(null, () => true), 0);
  const bare = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  assert.equal(dropCellsFromMerged(bare, () => true), 0, "没有 faceToCell 的网格不得被动");
}

// ---- 7. 幂等：摘过的格再摘一次没有副作用 ----
{
  const m = makeMerged(layout);
  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");
  const after = [...m.geometry.attributes.position.array];
  assert.equal(dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0"), 0);
  assert.deepEqual([...m.geometry.attributes.position.array], after);
}

// ---- 8. 跨格构件：按 cells 列表命中（屋顶分量/花园/晾衣绳） ----
{
  const m = makeMerged(layout);
  m.userData.faceToCell[2].cells = ["9,9,9", "3,0,0"];   // C（4 tris）换成跨格归属
  delete m.userData.faceToCell[2].cell;
  const removed = dropCellsFromMerged(m, (s) => s.cells?.includes("9,9,9"));
  assert.equal(removed, 4, "跨格构件应整体被摘");
  assert.equal(mergedTriangleCount(m), TOTAL - 4);
}

console.log("✅ test_merged_cell_patch（8 组）");
