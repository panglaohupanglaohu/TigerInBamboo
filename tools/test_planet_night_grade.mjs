// 星球夜相 grade 验收（2026-08-28 B·V8/C·V9 夜相对齐）
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
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){} }) };
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { applyPlanetNightGrade, PLANET_NIGHT_TINT } = await import(new URL("src/world/planet.js", BASE).href);
let pass = 0;
const ok = (m) => { pass += 1; console.log(`  ✓ ${m}`); };

const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
applyPlanetNightGrade(mat, 0);
assert.deepEqual(mat.color.toArray().map(v => +v.toFixed(2)), [1, 1, 1], "白天原色");
applyPlanetNightGrade(mat, 1);
assert.deepEqual(mat.color.toArray().map(v => +v.toFixed(2)), [PLANET_NIGHT_TINT.r, PLANET_NIGHT_TINT.g, PLANET_NIGHT_TINT.b], "深夜 tint");
applyPlanetNightGrade(mat, 0.5);
const half = mat.color.toArray().map(v => +v.toFixed(2));
assert.ok(half[0] > PLANET_NIGHT_TINT.r && half[0] < 1, "半夜介于两者（单调）");
applyPlanetNightGrade(mat, 5);
assert.ok(mat.color.r <= 1 && mat.color.g <= 1, "超界权重钳制");
applyPlanetNightGrade(mat, NaN);
assert.deepEqual(mat.color.toArray().map(v => +v.toFixed(2)), [1, 1, 1], "非法权重=白天");
ok("夜相 grade：0=原色 / 1=深蓝 tint / 单调 / 钳制 / 非法回落");
assert.match(fs.readFileSync(new URL("src/main.js", BASE), "utf8"), /applyPlanetNightGrade\(planet\.material, nightWeightAt\(P\.timeOfDay\)\)/, "main.js 每帧按 P.timeOfDay 驱动");
ok("main.js 接线：nightWeightAt(P.timeOfDay) 每帧驱动");
console.log(`✅ 星球夜相 grade 全过`);
console.log(`全部通过：${pass + 2} 组断言`);
