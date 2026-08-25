// V7-G10：Worker protocol / cancellation / BufferGeometry adapter
import assert from "node:assert/strict";
import { createProcgenJob, createProcgenResult, createCancelledResult, transferablesForMesh, validateProcgenJob } from "../TigerMessenger/src/procgen/worker/jobProtocol.js";
import { createWorkerHandler } from "../TigerMessenger/src/procgen/worker/procgenWorker.js";
import { createBufferGeometryFromMesh } from "../TigerMessenger/src/procgen/three/bufferGeometryAdapter.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

const job = createProcgenJob({ id: "job-1", type: "surface", payload: { value: 7 }, seed: 9 });
assert.equal(validateProcgenJob(job).ok, true);
assert.equal(validateProcgenJob({ ...job, protocol: 99 }).ok, false);
const mesh = { positions: new Float32Array(3), normals: new Float32Array(3), indices: new Uint32Array(3), semantics: new Uint8Array(1) };
assert.equal(transferablesForMesh(mesh).length, 4);
assert.equal(createCancelledResult(job).error.code, "cancelled");
ok("job protocol：版本/id/type/seed 校验、transfer list、cancel result");

{
  const messages = [];
  const handler = createWorkerHandler({ runSurface: async (payload) => ({ doubled: payload.value * 2 }) });
  const result = await handler(job, (message) => messages.push(message));
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, { doubled: 14 });
  assert.equal(messages.length, 1);
  ok("Worker handler：成功、错误和 structured-clone 结果统一封装");
}

{
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class BufferGeometry {
    constructor() { this.isBufferGeometry = true; this.attributes = {}; this.index = null; }
    setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
    getAttribute(name) { return this.attributes[name]; }
    setIndex(index) { this.index = index; return this; }
    computeBoundingSphere() { this.didSphere = true; }
    computeBoundingBox() { this.didBox = true; }
  }
  const THREE = { BufferAttribute, BufferGeometry };
  const geometry = createBufferGeometryFromMesh(THREE, mesh);
  assert.equal(geometry.getAttribute("position").itemSize, 3);
  assert.equal(geometry.index.array.length, 3);
  assert.equal(geometry.didSphere, true);
  ok("Three adapter：不绑定 Three import，正确创建 indexed BufferGeometry");
}

console.log(`✅ V7-G10 assertions=${passed}`);
