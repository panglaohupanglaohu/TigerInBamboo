// V5 K4/K5/K6：局部灯预算、bounce 默认关闭、调试指标
import assert from "node:assert/strict";
import { createLocalLightRegistry, selectLocalLights } from "../TigerMessenger/src/render/lighting/localLightRegistry.js";
import { composeBounceLighting } from "../TigerMessenger/src/render/lighting/lightingBounce.js";
import { summarizeLightingDebug } from "../TigerMessenger/src/render/lighting/lightingDebug.js";
import { composeLightingState } from "../TigerMessenger/src/render/lighting/lightingState.js";

const camera = { position: [0, 0, 0], forward: [0, 0, 1] };
const requests = Array.from({ length: 10 }, (_, i) => ({ id: `torch-${i}`, priority: 1, intensity: 1, radius: 5, position: [0, 0, i] }));
assert.equal(selectLocalLights(requests, camera, 4).length, 4);
const registry = createLocalLightRegistry();
registry.register({ id: "torch-a", owner: "soldier", intensity: 1, flicker: true });
assert.equal(registry.getDebugInfo().registered, 1);
assert.equal(composeBounceLighting().enabled, false);
assert.equal(composeBounceLighting({ enabled: true, intensity: 99, mix: 99 }).intensity, 0.18);
assert.equal(composeLightingState({ timeOfDay: 0.5 }).bounce.enabled, false);
const debug = summarizeLightingDebug({ luminance: [1, 2, 3, 4, 5], clipped: 0.2, dark: 3, localLights: registry.getDebugInfo(), gpu: { drawCalls: 2, triangles: 30, textures: 4 } });
assert.equal(debug.p50, 3);
assert.equal(debug.gpu.textures, 4);
console.log("  ✓ K4 budget/flicker registry、K5 bounce opt-in、K6 debug metrics");
console.log("✅ V5 K4/K5/K6 assertions=6");
