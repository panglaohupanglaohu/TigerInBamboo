// =====================================================================
// S12 (Oskar 2024-11-01): clouds and trees share the same impostor
// pipeline — one atlas, one material family, one draw call.  This test
// pins the shared cloud+canopy atlas, the per-instance shape routing and
// the citadel-local canopy cards that are visible in the default world.
// =====================================================================
import assert from "node:assert/strict";
import { buildSharedImpostorAtlas, buildCloudImpostorAtlas, createThreeCloudAtlasTexture } from "../TigerMessenger/src/render/clouds/impostorAtlasBuilder.js";
import { createSharedImpostorMaterial } from "../TigerMessenger/src/render/clouds/cloudImpostorMaterial.js";
import { createCloudImpostorSystem } from "../TigerMessenger/src/render/clouds/cloudImpostorSystem.js";
import { compileHighlandLocalHeroClouds } from "../TigerMessenger/src/world/highlandHeroClouds.js";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);

// --- 1. One atlas, two families ---------------------------------------
const atlasA = buildSharedImpostorAtlas({ cloudViews: 8, canopyViews: 6, size: 24, sourceHash: "test-s12" });
const atlasB = buildSharedImpostorAtlas({ cloudViews: 8, canopyViews: 6, size: 24, sourceHash: "test-s12" });
assert.equal(atlasA.hash, atlasB.hash, "shared atlas must be deterministic");
assert.ok(atlasA.hash.startsWith("shared-impostor-atlas:"), `hash prefix ${atlasA.hash}`);
assert.equal(atlasA.views, 14);
assert.equal(atlasA.cloudViews, 8);
assert.equal(atlasA.canopyViews, 6);
assert.equal(atlasA.colorAlpha.length, 14 * 24 * 24 * 4);
assert.equal(atlasA.distance.length, 14 * 24 * 24);
assert.equal(atlasA.shape, "cloud+canopy-shared-octa-impostor");
assert.deepEqual(atlasA.blockOf.slice(0, 8), Array(8).fill("cloud"));
assert.deepEqual(atlasA.blockOf.slice(8), Array(6).fill("canopy"));

// Cloud blocks are the same whitish family as the dedicated cloud atlas.
const cloudPx = atlasA.colorAlpha.subarray(0, 4);
assert.ok(cloudPx[0] > 200 && cloudPx[1] > 200 && cloudPx[2] > 200, `cloud rgb ${cloudPx[0]},${cloudPx[1]},${cloudPx[2]}`);
// Canopy blocks are green, and carry the brown trunk column under the crown.
const canopyBase = atlasA.cloudViews * atlasA.size * atlasA.size * 4;
const canopyPx = atlasA.colorAlpha.subarray(canopyBase, canopyBase + 4);
assert.ok(canopyPx[1] > canopyPx[0] && canopyPx[1] > canopyPx[2], `canopy green ${canopyPx[0]},${canopyPx[1]},${canopyPx[2]}`);
let trunkFound = false;
for (let i = 0; i < atlasA.colorAlpha.length; i += 4) {
  if (atlasA.colorAlpha[i] === 94 && atlasA.colorAlpha[i + 1] === 72 && atlasA.colorAlpha[i + 2] === 48) { trunkFound = true; break; }
}
assert.ok(trunkFound, "canopy block must contain trunk pixels");
// Legacy cloud atlas stays unchanged for the V8-only path (O3: default off).
const legacy = buildCloudImpostorAtlas({ views: 8, size: 24, sourceHash: "test-cloud-source" });
assert.equal(legacy.shape, "stacked-lowpoly-puffs-sdf");
assert.ok(legacy.hash.startsWith("cloud-atlas:"));

// --- 2. 共享 atlas + 树冠 instanced 管线（云 Sprite 层由 heroClouds 挂载）--
const texture = createThreeCloudAtlasTexture(THREE, atlasA);
assert.ok(texture, "atlas texture builds");
const sharedMaterial = createSharedImpostorMaterial(THREE, { atlas: texture, cloudViews: 8, totalViews: 14 });
assert.ok(sharedMaterial.uniforms.uCloudViews, "uCloudViews uniform");
assert.equal(sharedMaterial.uniforms.uCloudViews.value, 8);
assert.ok(sharedMaterial.uniforms.uTotalViews, "uTotalViews uniform");
assert.equal(sharedMaterial.uniforms.uTotalViews.value, 14);
// 2026-08-27 云可见性修复：云层改为 THREE.Sprite（可靠面向相机），
// 树冠保留 InstancedBufferGeometry 共享管线；同一共享 atlas 仍是真源。
import { extractCloudBlockTexture } from "../TigerMessenger/src/render/clouds/impostorAtlasBuilder.js";
const blockTex = extractCloudBlockTexture(THREE, atlasA);
assert.ok(blockTex, "cloud block texture extractable");
assert.equal(blockTex.image.width, 24, "block texture is one block");
assert.equal(blockTex.image.height, 24);

const clusters = compileHighlandLocalHeroClouds({ radius: 160 });
const canopies = clusters.instances.filter((instance) => instance.shape === "canopy");
const clouds = clusters.instances.filter((instance) => instance.shape !== "canopy");
assert.ok(canopies.length >= 5, `canopy cards ${canopies.length}`);
assert.ok(clouds.length >= 11, `cloud cards ${clouds.length}`);
// Canopies are planted, not drifting: static path, zero speed.
for (const canopy of canopies) {
  assert.equal(canopy.speed, 0);
  assert.equal(canopy.timeOffset, 0.5);
  assert.ok(canopy.pathPoints.length === 10 && canopy.pathPoints.every((p) => p.position[0] === canopy.position[0] && p.position[2] === canopy.position[2]), "canopy path must be a single static point");
  assert.equal(canopy.heroRole, "canopy-scatter");
  assert.equal(canopy.source, "hero-landmark-local");
}
// Canopy cards ring the citadel foothills outside the castle footprint.
const castleFootprint = (x, z) => Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5) < 1.05;
assert.ok(canopies.every((c) => !castleFootprint(c.position[0], c.position[2])), "canopy cards must not sit inside the castle");
assert.ok(canopies.every((c) => Math.hypot(c.position[0], c.position[2]) >= 24), "canopy cards must hug the outer slope ring");

const scene = new THREE.Group();
const renderer = createCloudImpostorSystem(THREE, scene, clusters, { radius: 160 });
assert.equal(scene.children.length, 1, "clouds+canopies must be ONE mesh / one draw call");
const mesh = renderer.mesh;
assert.equal(mesh.userData.sharedImpostor, true, "canopy present must switch the system to shared pipeline");
assert.equal(mesh.userData.canopyCount, canopies.length);
assert.equal(mesh.userData.cloudCount, clouds.length);
// 云 Sprite 层（heroClouds mount 挂载）：每朵云一个 Sprite，面向相机可靠可见
const citadelModule = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const spriteCastle = citadelModule.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spriteGroup = spriteCastle.getObjectByName("highland-hero-cloud-sprites");
assert.ok(spriteGroup, "云 Sprite 层已挂载");
assert.ok(spriteGroup.children.length >= 40, `云 Sprite ${spriteGroup.children.length} 朵`);
assert.ok(spriteGroup.children.every((s) => s.isSprite), "全部为 Sprite");
assert.ok(spriteGroup.children.some((s) => s.userData.heroRole === "cap"), "cap Sprite 存在");
const capSprite = spriteGroup.children.find((s) => s.userData.heroRole === "cap");
assert.ok(capSprite.position.y >= 36, `cap 在城堡上方 y=${capSprite.position.y}`);
assert.ok(spriteGroup.children.every((s) => s.material.map), "Sprite 使用云块纹理");
// aHero 编码：低位 authored，高位 shape（canopy=1）→ 云 0/1、树冠 3。
// 不新增 attribute —— 总 attribute 数必须 ≤ 16（WebGL MAX_VERTEX_ATTRIBS 下限）。
assert.equal(mesh.geometry.getAttribute("aShape"), undefined, "must not add aShape attribute (16-attribute budget)");
const heroAttr = mesh.geometry.getAttribute("aHero");
assert.ok(heroAttr, "aHero instanced attribute");
assert.equal(heroAttr.count, clusters.instances.length);
const attrBudget = 2 + 6 + 6 + 1 + 1 + 1 + 1 + 1 + 1;
const totalAttributes = Object.keys(mesh.geometry.attributes).length;
assert.ok(totalAttributes <= 16, `attribute budget: ${totalAttributes} (must be ≤ 16)`);
const canopyValues = new Set();
const cloudValues = new Set();
for (let i = 0; i < heroAttr.count; i++) {
  const v = heroAttr.getX(i);
  if (clusters.instances[i].shape === "canopy") canopyValues.add(v);
  else cloudValues.add(v);
}
assert.ok([...canopyValues].every((v) => v === 3), `canopy aHero codes ${[...canopyValues]}`);
assert.ok([...cloudValues].every((v) => v === 0 || v === 1), `cloud aHero codes ${[...cloudValues]}`);
assert.ok(mesh.geometry.instanceCount >= 16, `instanceCount ${mesh.geometry.instanceCount}`);
assert.equal(mesh.userData.impostorShape, "cloud+canopy-shared-octa-impostor");
assert.equal(renderer.atlas.shape, "cloud+canopy-shared-octa-impostor");
assert.equal(renderer.atlas.cloudViews + renderer.atlas.canopyViews, renderer.atlas.views);

// Pure-cloud clusters stay on the legacy pipeline (cloud material, same budget).
const cloudOnly = createCloudImpostorSystem(THREE, new THREE.Group(), { instances: clouds }, { radius: 160 });
assert.equal(cloudOnly.mesh.userData.sharedImpostor, false);
assert.equal(cloudOnly.mesh.userData.impostorShape, "stacked-lowpoly-puffs-sdf");
assert.equal(cloudOnly.mesh.material.uniforms.uViews.value, cloudOnly.atlas.views, "pure-cloud cards must sample one atlas block");
assert.match(cloudOnly.mesh.material.vertexShader, /cameraPosition/);
assert.match(cloudOnly.mesh.material.vertexShader, /length\(pathPosition\) > 0\.001/);
assert.ok(Object.keys(cloudOnly.mesh.geometry.attributes).length <= 16, "legacy cloud attribute budget");

renderer.dispose();
cloudOnly.dispose();

console.log(`✅ S12 shared impostor: atlas=${atlasA.hash}, clouds=${clouds.length} + canopies=${canopies.length} in one draw call, legacy cloud pipeline untouched`);
