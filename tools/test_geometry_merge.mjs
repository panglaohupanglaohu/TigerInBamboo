// 通用几何合并工具单元测试（node 直跑）
// 运行：node tools/test_geometry_merge.mjs
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { mergeStaticGroup, countMeshes } = await import(
  new URL("src/world/geometryMerge.js", BASE).href
);
const { toonMat, addOutline } = await import(new URL("src/assets/toon.js", BASE).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

// ---------- 夹具：树状 group，带嵌套变换 + 共享材质 + 描边 ----------
const root = new THREE.Group();
root.name = "test-forest";
root.position.set(3, -2, 7);
root.rotation.y = 0.7;
root.scale.set(1, 1, 1);

const trunkMat = toonMat(0x7d6b5d, { flatShading: true });
const canopyA = toonMat(0x1a3326, { flatShading: true });
const canopyB = toonMat(0x112219, { flatShading: true });

const trunk = new THREE.Group();
trunk.rotation.z = 0.18; // 嵌套旋转
root.add(trunk);
const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 6), trunkMat);
t1.position.set(0, 1.5, 0);
t1.castShadow = true;
addOutline(t1, 0.05);
trunk.add(t1);
const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2, 6), trunkMat);
t2.position.set(-0.4, 3.5, 0);
t2.castShadow = true;
addOutline(t2, 0.05);
trunk.add(t2);

for (let i = 0; i < 5; i++) {
  const pad = new THREE.Group();
  pad.position.set(i * 0.7, 4 + i * 0.3, (i % 2) * 0.5);
  pad.rotation.y = i * 0.4;
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    i % 2 ? canopyA : canopyB
  );
  blob.scale.set(1.4, 0.5, 0.9);
  blob.castShadow = true;
  addOutline(blob, 0.05);
  pad.add(blob);
  trunk.add(pad);
}
// 第二棵树（复制变换，验证多实例）
const root2 = root.clone();
root2.name = "test-forest-2";
root2.position.set(-6, 1, 4);
root2.rotation.y = -0.4;
// clone 会共享几何（good，验证 clone 后合并不破坏共享源）

// ---------- 合并前世界包围盒（逐顶点精确计算；setFromObject 对旋转几何会低估） ----------
const vertexBox = (o) => {
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  o.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      box.expandByPoint(v);
    }
  });
  return box;
};
const beforeBox = vertexBox(root);
const beforeCount = countMeshes(root);
assert(beforeCount > 10, `夹具网格数应 >10（实际 ${beforeCount}）`);
ok(`夹具 ${beforeCount} 网格`);

const result = mergeStaticGroup(root);
const afterCount = countMeshes(root);
const afterBox = vertexBox(root);
assert(afterCount < beforeCount, `合并后网格应更少（${beforeCount} → ${afterCount}）`);
assert(result.surfaces.length >= 3, `应有 3 组表面材质（实际 ${result.surfaces.length}）`);
assert(result.outlines.length >= 1, "描边应合并为 1+ 组");
ok(`合并后 ${afterCount} 网格（表面 ${result.surfaces.length} 组 + 描边 ${result.outlines.length} 组）`);

// 包围盒吻合（±5% 容差，toNonIndexed 后顶点不变）
const eps = 0.06;
const dims = (b) => [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
const bd = dims(beforeBox);
const ad = dims(afterBox);
for (let i = 0; i < 3; i++) {
  assert(Math.abs(ad[i] - bd[i]) < bd[i] * eps + 0.01,
    `包围盒第 ${i} 维偏差过大：${bd[i].toFixed(2)} → ${ad[i].toFixed(2)}`);
}
// 中心也应吻合
const center = (b) => [
  (b.max.x + b.min.x) / 2, (b.max.y + b.min.y) / 2, (b.max.z + b.min.z) / 2,
];
const bc = center(beforeBox);
const ac = center(afterBox);
for (let i = 0; i < 3; i++) {
  assert(Math.abs(ac[i] - bc[i]) < bd[i] * 0.05 + 0.01,
    `包围盒中心第 ${i} 维偏差过大：${bc[i].toFixed(2)} → ${ac[i].toFixed(2)}`);
}
ok("合并前后世界包围盒（尺寸+中心）吻合");

// 阴影标记继承
assert(result.surfaces.every((m) => m.castShadow === true), "阴影标记应继承");
ok("阴影/接收标记继承");

// 描边语义
assert(result.outlines.every((m) => m.userData.isOutline && typeof m.raycast === "function" && m.raycast() === undefined),
  "合并描边应保持 isOutline 且禁拾取");
ok("描边语义保留（BackSide 禁拾取）");

// root 自身变换保留
assert(Math.abs(root.rotation.y - 0.7) < 1e-9 && root.position.x === 3, "root 变换应保留");
ok("锚点 root 自身变换保留");

// faceToCell 回调：triStart 累计
let totalTri = 0;
let cbCalls = 0;
const root3 = root2;
const r3 = mergeStaticGroup(root3, {
  onSurface: (m, mat, src, triStart) => {
    assert(triStart === totalTri, `triStart 应连续累计（${triStart} vs ${totalTri}）`);
    totalTri += m.geometry.getAttribute("position").count / 3;
    cbCalls++;
  },
});
assert(cbCalls === r3.surfaces.length, "onSurface 每组合并调用一次");
ok(`面区间 triStart 连续累计（${r3.surfaces.length} 组表面）`);

console.log(`\n结果：${pass}/6 通过`);
process.exit(0);
