import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeTripleGateScoutPlacement } from "../TigerMessenger/src/world/planetV8/tripleGateScoutPlacement.js";

const asset = readFileSync(new URL("../TigerMessenger/src/world/planetV8/tripleGateScout.js", import.meta.url), "utf8");
const island = readFileSync(new URL("../TigerMessenger/src/scenes/messengerIsland.js", import.meta.url), "utf8");
const update = readFileSync(new URL("../TigerMessenger/src/scenes/messenger/updateIsland.js", import.meta.url), "utf8");
const harness = readFileSync(new URL("../TigerMessenger/shot-harness.html", import.meta.url), "utf8");

assert.match(asset, /triple-gate-scout-aircraft-v1/);
assert.match(asset, /triple-gate-scout-canopy/);
assert.match(asset, /ExtrudeGeometry/);
assert.match(asset, /mountTripleGateScoutAircraft/);
assert.match(island, /planetV8\.compiler\?\.manifest\?\.find\(\(entry\) => entry\.id === "triple-gate"\)/);
assert.match(island, /surfacePosition: tripleGateSample\?\.position/);
assert.match(island, /tripleGateScoutAircraft/);
assert.match(update, /s\.tripleGateScoutAircraft\?\.userData\?\.update/);
assert.match(harness, /tripleGateScoutAircraft/);

const sampled = computeTripleGateScoutPlacement({
  radius: 160,
  landmarkDirection: [-0.46, 0.88, 0.09],
  landmarkForward: [0, 0, 1],
  surfacePosition: [-72, 140, 15],
  hoverHeight: 9,
  forwardOffset: 4.5,
});
const norm = (v) => Math.hypot(...v);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
assert.equal(sampled.landmarkId, "triple-gate");
assert.equal(sampled.version, "triple-gate-scout-placement-v1");
assert.ok(norm(sampled.position) > norm(sampled.base), "scout must hover above the sampled surface");
assert.ok(Math.abs(dot(sampled.up, sampled.forward)) < 1e-6, "heading must stay tangent to the planet");
assert.ok(Math.abs(dot(sampled.up, sampled.right)) < 1e-6, "right axis must stay tangent to the planet");
assert.ok(Math.abs(dot(sampled.forward, sampled.right)) < 1e-6, "placement basis must be orthogonal");

const fallback = computeTripleGateScoutPlacement({ radius: 160 });
assert.ok(Math.abs(norm(fallback.base) - 160) < 1e-6, "fallback must remain radius-stable");
console.log("✅ Triple-gate scout aircraft: model contract, spherical anchor, tangent heading and live mount wiring verified");

