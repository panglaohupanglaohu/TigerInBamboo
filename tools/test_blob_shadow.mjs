// =====================================================================
// S17 植被小阴影（blob shadow）：树/灌木根部圆形贴地暗斑——
// 数量与植被对齐、贴地（随 terrain 高度）、共享几何/材质、预算。
// =====================================================================
import assert from "node:assert/strict";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const d = await import(new URL("src/world/highlandCitadelDesign.js", BASE).href);

// --- 1. 圣城构建: 树/灌木 blob 数量对齐 ---------------------------------
const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const trees = [];
const treeBlobs = [];
const shrubs = [];
const shrubBlobs = [];
castle.traverse((o) => {
  if (o.userData?.kind === "highland-low-poly-round-tree") trees.push(o);
  if (o.userData?.role === "slope-shrub") shrubs.push(o);
  if (o.userData?.role === "vegetation-blob-shadow") {
    if (o.userData.host?.includes("highland-mountain-vegetation")) treeBlobs.push(o);
    else shrubBlobs.push(o);
  }
});
assert.equal(trees.length, 12, `树 12 株 ${trees.length}`);
assert.equal(treeBlobs.length, 12, `树 blob 与树对齐 ${treeBlobs.length}`);
assert.equal(shrubs.length, castle.getObjectByName("highland-slope-shrub-vegetation")?.userData?.shrubCount ?? 0, "灌木计数一致");
assert.equal(shrubBlobs.length, shrubs.length, `灌木 blob 对齐 ${shrubBlobs.length}`);

// --- 2. 贴地: blob y 与 terrain 高度一致(±0.1) --------------------------
for (const blob of [...treeBlobs, ...shrubBlobs]) {
  const x = blob.position.x, z = blob.position.z;
  const terrainY = d.highlandTerrainSurfaceHeight(x, z);
  assert.ok(
    Math.abs(blob.position.y - terrainY) < 0.1,
    `blob ${blob.userData.host} 贴地: blob.y=${blob.position.y.toFixed(2)} terrain=${terrainY.toFixed(2)}`
  );
}

// --- 3. 共享几何/材质(预算) ---------------------------------------------
const geos = new Set();
const mats = new Set();
for (const blob of [...treeBlobs, ...shrubBlobs]) {
  geos.add(blob.geometry);
  mats.add(blob.material);
}
assert.equal(geos.size, 2, `共享几何 ≤2(树/灌木各一) ${geos.size}`);
assert.equal(mats.size, 2, `共享材质 ≤2 ${mats.size}`);
assert.ok(blobSharedMaterialIsBasic(mats), "blob 用 Basic 材质(不受光)");

function blobSharedMaterialIsBasic(mats) {
  for (const mat of mats) {
    if (mat.type !== "MeshBasicMaterial") return false;
    if (mat.transparent !== true || mat.depthWrite !== false) return false;
  }
  return true;
}

// --- 4. blob 是圆形贴地片(旋转 -90°) ------------------------------------
for (const blob of treeBlobs.slice(0, 2)) {
  assert.ok(Math.abs(blob.rotation.x + Math.PI / 2) < 1e-6, "blob 平放贴地");
  assert.equal(blob.userData.skipInkOutline, true, "blob 不描边");
}

// --- 5. 预算 ------------------------------------------------------------
assert.ok(treeBlobs.length + shrubBlobs.length <= 80, `blob 总数 ${treeBlobs.length + shrubBlobs.length}`);
// 每 blob 14 面圆片: 总三角形 ≈ 14 * 54 = 756(极轻)

console.log(`✅ S17 blob shadow: 树 ${treeBlobs.length} + 灌木 ${shrubBlobs.length} = ${treeBlobs.length + shrubBlobs.length} 个贴地暗斑, 共享几何 ${geos.size} 份, 全部贴地`);
