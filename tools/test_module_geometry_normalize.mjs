// =====================================================================
// 模块几何规格化验收（2026-09-03）
//
// 合并块原地替换的前提：每格模块三角形数恒定（Oskar 的同构模块做法）。
// 补齐用退化三角形（三个索引都指向顶点 0），不产生像素，只占顶点带宽。
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
const {
  triangleCount, moduleSlotSize, padGeometryToTriangles,
  normalizeModuleGeometries, slotRange,
} = await import(new URL("src/world/citadel/moduleGeometryNormalize.js", BASE).href);

// 拱窗与平墙顶点数本来就不同 —— 这正是不能原地替换的原因
const wall = new THREE.BoxGeometry(1, 1, 1);        // 12 tris
const window_ = new THREE.PlaneGeometry(1, 1);      // 2 tris
const roof = new THREE.ConeGeometry(0.5, 1, 5);     // 更少

assert.equal(triangleCount(wall), 12);
assert.equal(triangleCount(window_), 2);

// 1. 槽位 = 最大者
const slot = moduleSlotSize([wall, window_, roof]);
assert.equal(slot, Math.max(triangleCount(wall), triangleCount(window_), triangleCount(roof)));

// 2. 补齐后三角形数一致
const geos = [wall.clone(), window_.clone(), roof.clone()];
const used = normalizeModuleGeometries(geos);
assert.equal(used, slot);
for (const g of geos) {
  assert.equal(triangleCount(g), slot, "规格化后每格三角形数必须相同");
}

// 3. 原有面不得被破坏：前 N 个索引与原几何逐字相同
const padded = window_.clone();
padGeometryToTriangles(padded, slot);
const src = window_.index ? [...window_.index.array] : [...Array(window_.attributes.position.count).keys()];
const got = [...padded.index.array].slice(0, src.length);
assert.deepEqual(got, src, "补齐不得改写原有索引");

// 4. 补出来的必须是退化三角形（三个索引相同 → 面积 0）
const tail = [...padded.index.array].slice(src.length);
assert.ok(tail.length > 0, "确实补了内容");
for (let i = 0; i < tail.length; i += 3) {
  assert.ok(tail[i] === tail[i + 1] && tail[i + 1] === tail[i + 2],
    `补出的三角形必须退化，实际 ${tail[i]},${tail[i + 1]},${tail[i + 2]}`);
}

// 5. 顶点属性不得增长：只动索引，属性数组保持原样
assert.equal(padded.attributes.position.count, window_.attributes.position.count,
  "补齐只改索引，不得复制顶点");

// 6. 已达标的不动，且返回 false（避免重复补齐把索引越拉越长）
const big = wall.clone();
padGeometryToTriangles(big, slot);
assert.equal(padGeometryToTriangles(big, slot), false, "已达槽位不得再补");
assert.equal(triangleCount(big), slot);

// 7. 槽位寻址：第 n 格的区间连续且不重叠
const r0 = slotRange(0, slot);
const r1 = slotRange(1, slot);
assert.equal(r0.triStart, 0);
assert.equal(r0.triCount, slot);
assert.equal(r1.triStart, slot, "相邻格区间必须首尾相接");

// 8. 边界：空输入 / 非法目标不炸
assert.equal(moduleSlotSize([]), 0);
assert.equal(padGeometryToTriangles(null, 10), false);
assert.equal(padGeometryToTriangles(wall.clone(), 0), false);

console.log(`✅ test_module_geometry_normalize（槽位 ${slot} 三角形）`);
