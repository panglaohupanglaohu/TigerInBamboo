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

/**
 * 属性里「活着」的那一段。
 *
 * 压缩是**原地**做的：缓冲区长度永远不变，只有 count 收小，尾巴留着上一版的
 * 残数据。所以读几何一律按 count 切片，别直接 [...attr.array]——下游代码同理，
 * 按 array.length 读就会读到残数据（geometryMerge 踩过，见第 7b 组）。
 */
const live = (attr) => [...attr.array.subarray(0, attr.count * attr.itemSize)];

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
  assert.deepEqual(live(m.geometry.attributes.position), expect,
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
  const a = live(m.geometry.attributes.position);
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
  // 没命中时整条缓冲区（含尾巴）都不许动——这条仍然按 array 比，是故意的
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
  const after = live(m.geometry.attributes.position);
  assert.equal(dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0"), 0);
  assert.deepEqual(live(m.geometry.attributes.position), after);
}

// ---- 7b. 同一个实例、同一条缓冲区（画面冻死 + 显存漂移的两条根因） ----
//
// (1) 不许换 array。three 的 WebGLAttributes 按 attribute 实例记住 GPU buffer，
//     并存下首次上传的 array.byteLength，此后每次 needsUpdate 都校验
//     `data.size !== attribute.array.byteLength`。同一实例换更短的数组 →
//     每一帧 render 都 throw，抛在 projectObject 里 = render 半途中断：
//     声音照放、画面停住、编辑器点不动
//     （主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」）。
// (2) 也不许换 attribute 实例。那样能绕开校验，但旧实例的 GPU buffer 成了孤儿
//     ——three 只在 geometry.dispose() 释放 buffer，而这块几何还活着。
//     一次编辑几 MB，连续编辑攒成几百 MB 显存，就是「老是崩溃」。
//
// 所以这一组把两头都钉死：实例不变、array 不变、只有 count 与 drawRange 收小。
{
  const m = makeMerged(layout);
  const pos = m.geometry.attributes.position;
  const col = m.geometry.attributes.color;
  const posArr = pos.array;
  const posBytes = posArr.byteLength;
  const colBytes = col.array.byteLength;

  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");

  assert.equal(m.geometry.attributes.position, pos,
    "attribute 实例必须原样保留——换实例会把旧 GPU buffer 甩成孤儿，显存越编越多");
  assert.equal(m.geometry.attributes.position.array, posArr,
    "array 实例也必须原样保留——换 array 会让 three 每帧 throw，画面冻死");
  assert.equal(pos.array.byteLength, posBytes, "position 缓冲区长度必须不变");
  assert.equal(col.array.byteLength, colBytes, "color 缓冲区长度必须不变");
  assert.equal(pos.count, (TOTAL - 2) * 3, "只有 count 收小");
  assert.equal(col.count, (TOTAL - 2) * 3, "所有属性同步收 count");
  assert.equal(m.geometry.drawRange.count, (TOTAL - 2) * 3,
    "drawRange 必须跟着 count 收——否则尾巴上的残三角会被画出来");
  assert.ok(pos.array.length > pos.count * pos.itemSize,
    "尾巴确实留着（这正是下游必须按 count 读的原因）");
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
