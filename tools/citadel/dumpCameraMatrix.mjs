// 写出 25 组天气×镜头 SVG + JSON（G8/G12）
// 运行：node tools/citadel/dumpCameraMatrix.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = new URL("../../TigerMessenger/", import.meta.url);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { buildCameraMatrix } = await import(new URL("src/world/citadel/cameraMatrix.js", BASE).href);

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);
const shots = buildCameraMatrix(v4);
if (shots.length !== 25) throw new Error(`expected 25 shots, got ${shots.length}`);

const outDir = fileURLToPath(new URL("../out/citadel_v4_shots/", import.meta.url));
fs.mkdirSync(outDir, { recursive: true });
const index = [];
for (const shot of shots) {
  const name = shot.id.replace("/", "_");
  fs.writeFileSync(path.join(outDir, `${name}.svg`), shot.svg);
  index.push({ id: shot.id, weather: shot.weather, camera: shot.camera, params: shot.params, tokens: shot.tokens, local: shot.local });
}
fs.writeFileSync(
  fileURLToPath(new URL("../out/citadel_v4_camera_matrix.json", import.meta.url)),
  JSON.stringify({ count: index.length, shots: index }, null, 2)
);
console.log(`wrote ${index.length} shots → tools/out/citadel_v4_shots/`);
