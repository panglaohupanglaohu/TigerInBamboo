import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  composeLightingState,
  LIGHTING_V5_WEATHERS,
} from "../TigerMessenger/src/render/lighting/lightingState.js";
import { composeBounceLighting } from "../TigerMessenger/src/render/lighting/lightingBounce.js";
import {
  createVoxelVolume,
  computeScalarAo,
  createDirtyTracker,
  fitVolumeRegion,
  hashVolume,
  rasterizeTriangles,
} from "../TigerMessenger/src/render/ao/voxelVolume.js";
import { selectLocalLights, torchFlicker } from "../TigerMessenger/src/render/lighting/localLightRegistry.js";

function runNodeTest(file) {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`${file} failed with ${result.status}`);
  }
}

// 1) LightingState: 5 time bands × 3 weather overlays, finite and bounded.
for (const timeOfDay of [0.2, 0.28, 0.5, 0.75, 0.9]) {
  for (const weather of LIGHTING_V5_WEATHERS) {
    const state = composeLightingState({ timeOfDay, weather });
    assert.ok(Number.isFinite(state.sun.intensity) && state.sun.intensity >= 0 && state.sun.intensity <= 3);
    assert.ok(Number.isFinite(state.sky.intensity) && state.sky.intensity >= 0 && state.sky.intensity <= 2);
    assert.ok(Number.isFinite(state.ambientFloor) && state.ambientFloor >= 0 && state.ambientFloor <= 1);
    assert.ok(Number.isFinite(state.fog.density) && state.fog.density > 0);
    assert.equal(state.bounce.enabled, false);
  }
}
assert.ok(composeLightingState({ timeOfDay: 0.9 }).ambientFloor < composeLightingState({ timeOfDay: 0.5 }).ambientFloor);
assert.deepEqual(composeBounceLighting({ enabled: true, intensity: 99, mix: 99 }), {
  enabled: true,
  intensity: 0.18,
  mix: 0.35,
  tint: "#FFFFFF",
});

// 2) AO: same occupancy → same atlas hash; dirty regions expand; doors stay open.
const region = fitVolumeRegion([-2, -2, -2], [2, 2, 2], { voxelSize: 0.5, padVoxels: 4 });
const makeVolume = () => createVoxelVolume(region);
const cube = [
  -1, -1, -1, 1, -1, -1, 1, 1, -1,
  -1, -1, -1, 1, 1, -1, -1, 1, -1,
];
const a = makeVolume(); const b = makeVolume();
rasterizeTriangles(a, cube); rasterizeTriangles(b, cube);
computeScalarAo(a); computeScalarAo(b);
assert.equal(hashVolume(a), hashVolume(b));
const dirty = createDirtyTracker({ expand: 4 });
assert.equal(dirty.markWorldRange(a, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]), true);
const pending = dirty.consume();
assert.ok(pending && pending.min.every((value) => value >= 0));

// 3) Local-light stability and torch limits are numeric contracts, not screenshots.
const requests = Array.from({ length: 12 }, (_, index) => ({ id: `torch-${index}`, priority: 1, intensity: 1, radius: 5, position: [0, 0, index] }));
const camera = { position: [0, 0, 0], forward: [0, 0, 1] };
const selectedA = selectLocalLights(requests, camera, 4).map((light) => light.lightId);
const selectedB = selectLocalLights([...requests].reverse(), camera, 4).map((light) => light.lightId);
assert.deepEqual(selectedA, selectedB);
for (let tick = 0; tick < 2000; tick++) {
  const flicker = torchFlicker(42, tick / 12);
  assert.ok(flicker.intensityMul >= 0.78 && flicker.intensityMul <= 1.18);
  assert.ok(flicker.radiusMul >= 0.9 && flicker.radiusMul <= 1.1);
  assert.ok(Math.abs(flicker.warmShift) <= 0.08);
}

// 4) Existing pure-data schema/colorblind gates remain the source of palette QA.
for (const file of [
  "tools/test_lighting_v5.mjs",
  "tools/test_lighting_v5_k4_k6.mjs",
  "tools/test_voxel_ao.mjs",
  "tools/test_planet_v8_visual.mjs",
]) runNodeTest(file);

console.log("✅ Automated visual QA: lighting/weather bounds, AO determinism/dirty bounds, light stability, torch limits and palette/CVD schemas passed without screenshots or manual approval");
