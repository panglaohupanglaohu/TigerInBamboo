// 正式页海壳清理：只关闭显式标记且完整沉在海壳内的静态子树。
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
  pruneTaggedOfficialOceanOccludeds,
  OFFICIAL_OCEAN_OCCLUSION_TAG,
} = await import(new URL("src/core/officialOceanOcclusionPruning.js", BASE).href);

function marker() {
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 6), new THREE.MeshBasicMaterial());
  ocean.userData.officialOcean = true;
  ocean.name = "official-ocean-marker";
  return ocean;
}

function taggedCube(radius, tag = true) {
  const root = new THREE.Group();
  if (tag) root.userData[OFFICIAL_OCEAN_OCCLUSION_TAG] = true;
  root.position.set(0, radius, 0);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial()));
  return root;
}

{
  const scene = new THREE.Scene();
  scene.add(marker());
  const submerged = taggedCube(8);
  const shore = taggedCube(10.65);
  const untagged = taggedCube(8, false);
  scene.add(submerged, shore, untagged);

  const result = pruneTaggedOfficialOceanOccludeds(scene, { radius: 10, margin: 0.24 });
  assert.equal(result.enabled, true, "正式海壳存在时启用");
  assert.equal(result.checked, 2, "只检查显式标记的子树");
  assert.equal(result.hidden, 1, "只关闭完整在海下的子树");
  assert.equal(submerged.visible, false, "深水静态副本关闭");
  assert.equal(submerged.parent, null, "从场景树摘除，动画无法重新提交绘制");
  assert.equal(shore.visible, true, "临海模型保留");
  assert.equal(untagged.visible, true, "未标记模型保留");
  assert.equal(submerged.userData.officialOceanOccluded, true, "记录清理原因供调试");
}

{
  const scene = new THREE.Scene();
  const submerged = taggedCube(8);
  scene.add(submerged);
  const result = pruneTaggedOfficialOceanOccludeds(scene, { radius: 10 });
  assert.equal(result.enabled, false, "非正式海壳场景保持 no-op");
  assert.equal(submerged.visible, true, "独立场景不受影响");
}

console.log("✅ official ocean occlusion pruning: tagged-only + fully-covered-only + non-official no-op");
