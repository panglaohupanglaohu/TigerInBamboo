// V4 G12 总跑：G0 + G1 + G2–G11 管线 + 开关回退 + 三次 hash + 10 分钟贴地
// 运行：node tools/test_citadel_v4_all.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import fs from "node:fs";

const here = fileURLToPath(new URL(".", import.meta.url));
const run = (file) => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${file} exit ${r.status}`);
  }
  const tail = (r.stdout || "").trim().split("\n").slice(-2).join(" | ");
  console.log(`  ✓ ${file} · ${tail}`);
};

console.log("[G12] 回归套件");
run("./test_citadel_v4_g0.mjs");
run("./test_citadel_topology.mjs");
run("./test_citadel_v4_pipeline.mjs");
run("./test_citadel_blueprint.mjs");
run("./test_citadel_tactical_graph.mjs");

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;
const BASE = new URL("../TigerMessenger/", import.meta.url);
const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { FEATURES, applyUrlOverrides, isCitadelTownV4, isCitadelTerrainUvV2, isCitadelCombatV3 } = await import(
  new URL("src/core/params.js", BASE).href
);
const { topologyToSvg } = await import(new URL("src/world/citadel/topology.js", BASE).href);
const { finalColor } = await import(new URL("src/world/citadel/visualTheme.js", BASE).href);
const { updateMovement, createCombatAgent } = await import(new URL("src/agents/citadel/combatAgent.js", BASE).href);
const { buildCameraMatrix } = await import(new URL("src/world/citadel/cameraMatrix.js", BASE).href);
const { compileCitadelV4Payload } = await import(new URL("src/world/citadel/compileWorker.js", BASE).href);

console.log("[G12] 三次编译 hash");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const hashes = [0, 1, 2].map(() => {
    const v = compileCitadelV4(bp, 7);
    return v.town.cells.map((c) => c.module.id).join("|") + "/" + v.uv.stats.chartCount + "/" + v.graph.nodes.size;
  });
  assert.equal(hashes[1], hashes[0]);
  assert.equal(hashes[2], hashes[0]);
  console.log(`  ✓ 模块+UV+图 hash 稳定`);
}

console.log("[G12] 开关回退");
{
  assert.equal(isCitadelTownV4() || isCitadelTerrainUvV2() || isCitadelCombatV3(), false);
  applyUrlOverrides("?citadelTownV4=1&citadelTerrainUvV2=1&citadelCombatV3=1");
  assert.equal(FEATURES.citadelTownV4 && FEATURES.citadelTerrainUvV2 && FEATURES.citadelCombatV3, true);
  applyUrlOverrides("?citadelTownV4=0&citadelTerrainUvV2=0&citadelCombatV3=0");
  assert.equal(isCitadelTownV4() || isCitadelTerrainUvV2() || isCitadelCombatV3(), false);
  console.log("  ✓ 三开关开/关可逆，默认旧系统");
}

console.log("[G12] 10 分钟贴地巡逻");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const v4 = compileCitadelV4(bp, 7);
  const start = [...v4.graph.nodes.values()].find((n) => n.terrace === 4);
  const goal = [...v4.graph.nodes.values()].find((n) => n.terrace === 2);
  const path = v4.graph.findPath(start.pos, goal.pos, v4.surfaces);
  const ag = createCombatAgent({ id: "patrol", position: { ...start.pos }, surfaceId: start.surfaceId });
  ag.path.points = path.points;
  let maxOff = 0;
  const steps = 10 * 60 * 60;
  for (let i = 0; i < steps; i++) {
    if (ag.path.index >= ag.path.points.length - 1) ag.path.index = 0;
    const r = updateMovement(ag, 1 / 60, v4.surfaces);
    maxOff = Math.max(maxOff, r.off || 0);
  }
  assert.ok(maxOff <= 0.15, `离表 ${maxOff}`);
  console.log(`  ✓ 10min 离表 ${maxOff.toFixed(4)}`);
}

console.log("[G12] 五天气色板矩阵 + 25 镜头");
{
  const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
  const v4 = compileCitadelV4(bp, 7);
  const svg = topologyToSvg(v4.topo);
  fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
  const weathers = ["clear", "sunset", "rain", "snow", "night"];
  const matrix = {};
  for (const w of weathers) {
    matrix[w] = {
      wall: finalColor("castleWallChalk", { weather: w, timeBand: w === "night" ? "night" : "day" }),
      unit: finalColor("unitDefenderMain", { weather: w, timeBand: w === "night" ? "night" : "day" }),
      water: finalColor("envWater", { weather: w, timeBand: w === "night" ? "night" : "day" }),
    };
  }
  fs.writeFileSync(new URL("./out/citadel_v4_weather_matrix.json", import.meta.url), JSON.stringify(matrix, null, 2));
  fs.writeFileSync(new URL("./out/citadel_v4_overview.svg", import.meta.url), svg);
  const shots = buildCameraMatrix(v4);
  assert.equal(shots.length, 25);
  fs.mkdirSync(fileURLToPath(new URL("./out/citadel_v4_shots/", import.meta.url)), { recursive: true });
  const index = shots.map((shot) => {
    const file = new URL(`./out/citadel_v4_shots/${shot.id.replace("/", "_")}.svg`, import.meta.url);
    fs.writeFileSync(file, shot.svg);
    return { id: shot.id, weather: shot.weather, camera: shot.camera, tokens: shot.tokens, local: shot.local };
  });
  fs.writeFileSync(new URL("./out/citadel_v4_camera_matrix.json", import.meta.url), JSON.stringify({ count: index.length, shots: index }, null, 2));
  const a = compileCitadelV4Payload(bp, 7);
  const b = compileCitadelV4Payload(bp, 7);
  assert.equal(a.hash, b.hash);
  const islandLines = fs.readFileSync(fileURLToPath(new URL("../TigerMessenger/src/scenes/messengerIsland.js", import.meta.url)), "utf8").split(/\n/).length;
  assert.ok(islandLines <= 600, `messengerIsland.js ${islandLines} 行`);
  console.log(`  ✓ 天气矩阵 + 25 镜头 SVG · compile hash ${a.hash} · island ${islandLines} 行`);
}

console.log("\nG12 全部通过");
