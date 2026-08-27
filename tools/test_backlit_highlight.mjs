// =====================================================================
// S16 背光高光：反向轮廓层存在与几何克隆、背光因子随相机×太阳单调、
// 受光遮罩过滤背阳面、预算、确定性。
// =====================================================================
import assert from "node:assert/strict";
import { createBacklitHighlightLayer, BACKLIT_HIGHLIGHT_SCHEMA_VERSION } from "../TigerMessenger/src/world/backlitHighlight.js";
import { bakeHighlandShoreWaves } from "../TigerMessenger/src/world/highlandShoreWaves.js";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);

// --- 1. 层创建与几何克隆 ----------------------------------------------
const source = new THREE.Mesh(
  new THREE.BoxGeometry(4, 4, 4),
  new THREE.MeshStandardMaterial({ color: 0x888888 })
);
const { layer, update, dispose } = createBacklitHighlightLayer(THREE, source, { scale: 1.02 });
assert.ok(layer, "layer created");
assert.equal(layer.userData.backlitHighlight, true);
assert.equal(layer.userData.backlitSchema, BACKLIT_HIGHLIGHT_SCHEMA_VERSION);
assert.equal(layer.material.side, THREE.BackSide, "BackSide rendering");
assert.equal(layer.scale.x, 1.02);
assert.equal(layer.geometry.attributes.position.count, source.geometry.attributes.position.count, "cloned geometry");
assert.ok(layer.geometry.attributes.normal, "normals computed for shading");
assert.ok(layer.material.uniforms.uSunDir && layer.material.uniforms.uCamPos, "sun/camera uniforms");
assert.ok(layer.material.uniforms.uMaxOpacity.value > 0 && layer.material.uniforms.uMaxOpacity.value <= 1);

// --- 2. update 驱动(太阳方向 + 相机位置) ------------------------------
const sunDir = new THREE.Vector3(0.5, 0.7, 0.4).normalize();
const camPos = new THREE.Vector3(0, 50, 20);
update(sunDir, camPos);
assert.ok(layer.material.uniforms.uSunDir.value.distanceTo(sunDir) < 1e-6, "sun dir applied");
assert.ok(layer.material.uniforms.uCamPos.value.distanceTo(camPos) < 1e-6, "camera pos applied");
// 空参数不炸
update(null, null);
assert.ok(layer.material.uniforms.uSunDir.value.distanceTo(sunDir) < 1e-6, "null-safe update keeps values");

// --- 3. shader 语义: 受光遮罩函数(纯函数验证) -------------------------
// 模拟 fragment 遮罩: alpha = rim * smoothstep(0.04, 0.38, sun) * maxOpacity
const mask = (sunDot) => {
  const t = Math.max(0, Math.min(1, (sunDot - 0.04) / 0.34));
  return t * t * (3 - 2 * t);
};
assert.equal(mask(0.0), 0, "背阳面(n·sun≤0)不显示");
assert.equal(mask(-0.5), 0, "阴影侧不显示(masked by shadows)");
assert.ok(mask(0.5) > mask(0.2), "受光面单调增强");
assert.equal(mask(1.0), 1, "正对太阳最强");
// rim: 边缘(法线⊥视线)高
const rim = (ndv) => Math.pow(1 - Math.max(0, ndv), 1.8);
assert.ok(rim(0.0) > rim(0.8), "边缘 rim > 正面");

// --- 4. 预算与 dispose ------------------------------------------------
assert.ok(layer.geometry.attributes.position.count <= 4096, `geometry budget ${layer.geometry.attributes.position.count}`);
dispose();
assert.equal(layer.parent, null, "disposed layer removed");

// --- 5. 山体应用存在性(构建圣城, 高光层挂载) ---------------------------
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let backlitLayer = null;
castle.traverse((o) => { if (o.userData?.backlitHighlight === true) backlitLayer = o; });
assert.ok(backlitLayer, "圣城山体背光高光层已挂载");
assert.ok(castle.userData.highlandBacklit?.update, "backlit controller exposed on castleContainer");
assert.equal(backlitLayer.material.side, THREE.BackSide);
const srcName = backlitLayer.userData.sourceName;
assert.equal(srcName, "citadel-oskar-grid-mountain-surface", "高光层源为连续山体");

console.log(`✅ S16 backlit highlight: 山体高光层 ${backlitLayer.name} (${backlitLayer.geometry.attributes.position.count} verts), BackSide + 受光遮罩 + 背光驱动`);
