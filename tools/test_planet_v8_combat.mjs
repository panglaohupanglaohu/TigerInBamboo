import assert from "node:assert/strict";
import { createLandmarkManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import {
  compileCombatSurfaceV8,
  projectCombatUnitToSurface,
} from "../TigerMessenger/src/world/planetV8/combatSurfaceV8.js";

const manifest = createLandmarkManifest({ seed: 42 });
const surface = {
  field: { heightAt: () => 1.5 },
  sample(position) {
    const direction = position.map((value) => value / (Math.hypot(...position) || 1));
    return {
      position: direction.map((value) => value * 160),
      normal: direction,
      surfaceId: "planet-land:combat-surface",
      isWater: false,
    };
  },
};

const combat = compileCombatSurfaceV8({ manifest, surface, radius: 160 });
assert.equal(combat.zones.length, 2);
assert.ok(combat.zones.every((zone) => zone.keepouts.length > 0));
assert.ok(combat.zones.every((zone) => zone.offSurfacePolicy === "reject-and-reproject"));

const projected = projectCombatUnitToSurface(surface, { position: [0, 0, 160] }, {
  zoneId: combat.zones[0].id,
  lift: 0.08,
});
assert.equal(projected.ok, true);
assert.equal(projected.zoneId, combat.zones[0].id);
assert.equal(projected.offSurface, false);
assert.ok(projected.position[2] > 160);

assert.equal(
  projectCombatUnitToSurface(null, { position: [0, 0, 0] }).ok,
  false,
  "missing provider must fail closed",
);

console.log("✅ Planet V8 combat surface: zones, keepouts, surface projection and fail-closed guard passed");
