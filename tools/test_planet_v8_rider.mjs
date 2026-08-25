import assert from "node:assert/strict";
import {
  projectObjectToPlanetSurface,
  projectWorldObjectToPlanetSurface,
} from "../TigerMessenger/src/world/planetV8/riderProjection.js";

const provider = {
  sample() {
    return { point: [10, 0, 0], normal: [1, 0, 0], isWater: false, surfaceId: "planet-land" };
  },
};
const object = {
  position: {
    value: [0, 0, 0],
    set(...values) { this.value = values; },
  },
};
const result = projectObjectToPlanetSurface(provider, object, { lift: 0.25 });
assert.equal(result.ok, true);
assert.deepEqual(object.position.value, [10.25, 0, 0]);
assert.equal(projectObjectToPlanetSurface(provider, { position: [0, 0, 0] }, { allowWater: false }).ok, true);

const local = {
  value: [0, 0, 0],
  clone() {
    return { x: this.value[0], y: this.value[1], z: this.value[2], set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  },
  copy(next) { this.value = [next.x, next.y, next.z]; },
  set(x, y, z) { this.value = [x, y, z]; },
};
const parent = {
  worldToLocal(point) { point.x -= 2; point.y -= 3; point.z -= 4; return point; },
};
const child = {
  position: local,
  parent,
  getWorldPosition(target) { target.x = 10; target.y = 0; target.z = 0; return target; },
};
const worldResult = projectWorldObjectToPlanetSurface(provider, child, { lift: 0.25 });
assert.equal(worldResult.ok, true);
assert.deepEqual(local.value, [8.25, -3, -4]);
console.log("✅ Planet V8 rider projection: provider-owned surface, parent-space conversion and rollback-safe opt-in passed");
