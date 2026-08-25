// =====================================================================
// Grok automated acceptance matrix
//
// 把原来依赖浏览器/GPU/主人手工确认的“阻塞门”改成可重复脚本：
// 1) HTTP/CORS/module 依赖图；2) 固定 seed/路线/海陆数据；
// 3) 灰度/CVD/光照/色板数值门；4) CPU 代理性能与资源回收；
// 5) rollback/default-on 防越级。
//
// 本脚本不伪造硬件 FPS。它输出的是 AUTOMATED_TESTED；显卡差异只以
// shader/预算/资源代理指标记录，避免把 SwiftShader 或 Node 时间冒充真实 GPU。
// =====================================================================

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createResourceRegistry } from "../TigerMessenger/src/core/resourceRegistry.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.join(REPO, "TigerMessenger");
const OUT = path.join(REPO, "tools", "out", "grok-acceptance-matrix.json");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

function runScript(script) {
  const result = spawnSync(process.execPath, [path.join(REPO, script)], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${script} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return { script, status: result.status, tail: result.stdout.trim().split("\n").slice(-1)[0] || "" };
}

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function httpModuleGraphGate() {
  const server = await startStaticServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const queue = ["/shot-harness.html", "/index.html", "/src/main.js"];
  const visited = new Set();
  const fetched = [];
  try {
    while (queue.length) {
      const requestPath = queue.shift();
      if (visited.has(requestPath)) continue;
      visited.add(requestPath);
      assert.ok(!requestPath.startsWith("file:"), `file URL leaked: ${requestPath}`);
      const response = await fetch(origin + requestPath);
      assert.equal(response.status, 200, `${requestPath} must be served over HTTP`);
      const body = await response.text();
      fetched.push(requestPath);
      // index.html deliberately contains a user-facing explanation of the
      // file:// fallback; it is not a module URL leak. Keep the strict check
      // for harness/module sources where file URLs would be a real failure.
      if (requestPath !== "/index.html") {
        assert.equal(body.includes("file://"), false, `${requestPath} contains file://`);
      }
      const base = new URL(requestPath, origin + "/");
      const imports = [...body.matchAll(/(?:from\s+|import\s*\(?\s*)["']([^"']+)["']/g)].map((match) => match[1]);
      for (const specifier of imports) {
        if (!specifier.startsWith(".")) continue; // importmap package names are resolved by the browser.
        const target = new URL(specifier, base);
        assert.equal(target.origin, origin, `cross-origin module: ${specifier}`);
        // memoryBridge deliberately probes an optional sibling app at
        // /frontend; it is not part of the TigerMessenger static root.
        if (target.pathname.startsWith("/frontend/")) continue;
        queue.push(target.pathname);
      }
    }
    assert.ok(fetched.includes("/shot-harness.html"));
    assert.ok(fetched.includes("/index.html"));
    assert.ok(fetched.includes("/src/main.js"));
    assert.ok(fetched.includes("/src/ui/shotHarnessPanel.js"), "main system must resolve merged shot harness module");
    assert.ok(fetched.includes("/src/assets/moebiusTower.js"), "shot harness must resolve local tower module");
    return { origin, modules: fetched.length, cors: "same-origin-http" };
  } finally {
    server.close();
  }
}

function performanceAndResourceGate() {
  const compileMs = [];
  const hashes = [];
  for (const seed of [1, 7, 42, 884, 1000, 1001, 1002, 1003]) {
    const start = performance.now();
    const world = compilePlanetV8({ seed, subdivision: 1, chartLimit: 2, resolution: 5 });
    compileMs.push(performance.now() - start);
    assert.equal(world.ok, true, `planet compile seed=${seed}`);
    assert.equal(world.snapshot.seed, seed, `snapshot seed must survive compile seed=${seed}`);
    hashes.push(createHash("sha256").update(JSON.stringify(world.snapshot)).digest("hex"));
  }
  assert.equal(new Set(hashes).size, hashes.length, "different seeds should not collapse to one snapshot");
  const registry = createResourceRegistry();
  let disposed = 0;
  for (let cycle = 0; cycle < 20; cycle++) {
    registry.retain("geometry", `cycle:${cycle}`, () => ({ dispose: () => { disposed++; } }));
    registry.replace("geometry", `cycle:${cycle}`, () => ({ dispose: () => { disposed++; } }));
  }
  registry.disposeAll();
  assert.equal(registry.size(), 0, "resource registry must be empty after rollback simulation");
  assert.equal(disposed, 40, "all replaced/active resources must be disposed");
  return {
    seeds: compileMs.length,
    compileMs: { p50: +percentile(compileMs, 0.5).toFixed(3), p95: +percentile(compileMs, 0.95).toFixed(3) },
    resourceCycles: 20,
    disposed,
    note: "CPU/SwiftShader-independent proxy; not a hardware FPS claim",
  };
}

function flagAndShaderContractGate() {
  const params = fs.readFileSync(path.join(ROOT, "src/core/params.js"), "utf8");
  for (const flag of ["procgenEngineV1", "wfcCastleV1", "marchingTerrainV1", "planetTerrainV1", "curvedWaterV1", "cloudImpostorV1"]) {
    assert.match(params, new RegExp(`${flag}\\s*:\\s*false`), `${flag} must remain rollback-safe by default`);
  }
  assert.match(params, /planetOskarV1/);
  const auditProcess = spawnSync(process.execPath, [path.join(REPO, "tools/audit_planet_v8_oskar_gap.mjs")], { encoding: "utf8" });
  assert.equal(auditProcess.status, 0, `V9 capability audit failed\n${auditProcess.stderr}`);
  const audit = JSON.parse(auditProcess.stdout.slice(auditProcess.stdout.indexOf("{")));
  assert.equal(audit.ledger.validation.ok, true, "capability ledger evidence must validate");
  assert.ok(["RUNTIME_READY_OPT_IN", "COMPLETE_DEFAULT_ON"].includes(audit.verdict));
  if (!audit.productionEnabled) assert.notEqual(audit.verdict, "COMPLETE_DEFAULT_ON");
  const shaderRoots = [path.join(ROOT, "src/render"), path.join(ROOT, "src/procgen")];
  let shaderFiles = 0;
  for (const root of shaderRoots) {
    const files = fs.readdirSync(root, { recursive: true }).filter((file) => /\.(js|glsl)$/.test(file));
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const shaderSegments = [...source.matchAll(/`([\s\S]*?)`/g)]
        .map((match) => match[1])
        .filter((segment) => /gl_Position|gl_FragColor|void\s+main|#include|\buniform\b|\bvarying\b/.test(segment));
      if (shaderSegments.length) {
        shaderFiles++;
        assert.equal(shaderSegments.some((segment) => /\b(?:NaN|Infinity)\b/.test(segment)), false, `non-finite shader literal in ${file}`);
      }
    }
  }
  return { flags: "all-default-false", shaderFiles, webgl: "shader-source-contract", v9Verdict: audit.verdict, capabilityStates: audit.capabilities.map((entry) => `${entry.id}:${entry.status}`) };
}

const childScripts = [
  "tools/test_procgen_profiles_hard_routes.mjs",
  "tools/test_planet_v8_landform_chain.mjs",
  "tools/test_planet_v8_landform_tiles.mjs",
  "tools/test_planet_v8_landform_mc.mjs",
  "tools/test_planet_v8_chain_routes.mjs",
  "tools/test_planet_v8_cloud_climate_chain.mjs",
  "tools/test_planet_v8_water_routes.mjs",
  "tools/test_procgen_v7_castle_module_compiler.mjs",
  "tools/test_procgen_v7_rollout_plan.mjs",
  "tools/test_planet_v8_visual.mjs",
  "tools/test_automated_visual_qa.mjs",
  "tools/test_planet_v8_debug.mjs",
  "tools/test_planet_v9_final_elevation.mjs",
  "tools/test_planet_v9_forest_grass.mjs",
  "tools/test_planet_v9_cloud_paths.mjs",
  "tools/test_highland_hero_clouds.mjs",
  "tools/test_planet_v9_water_topology.mjs",
  "tools/test_planet_v9_lake_surface.mjs",
  "tools/test_planet_v9_terrain_editor.mjs",
  "tools/test_planet_v9_runtime_wiring.mjs",
  "tools/test_shot_harness_runtime.mjs",
  "tools/test_grok_completion_contract.mjs",
  "tools/test_v6_g5_combat.mjs",
  "tools/test_v6_g6_edit.mjs",
  "tools/test_citadel_v4_all.mjs",
  "tools/test_phalanx.mjs",
  "tools/test_fox_tram_ride.mjs",
  "tools/test_tram_ride_bgm_priority.mjs",
  "tools/test_theme_presets.mjs",
  "tools/test_lighting_presets.mjs",
  "tools/test_siege_assault_bgm.mjs",
  "tools/test_minimap.mjs",
  "tools/test_citadel_range.mjs",
];
const childResults = childScripts.map(runScript);
const httpGate = await httpModuleGraphGate();
const performanceGate = performanceAndResourceGate();
const contracts = flagAndShaderContractGate();

const report = {
  version: 1,
  status: "AUTOMATED_TESTED",
  generatedAt: new Date().toISOString(),
  gates: {
    browserHttpCorsModules: httpGate,
    visualColorblindLighting: childResults.filter((item) => /visual|automated/.test(item.script)),
    routeAndSeed: childResults.filter((item) => /profiles/.test(item.script)),
    landformChain: childResults.filter((item) => /landform|chain_routes/.test(item.script)),
    cloudClimate: childResults.filter((item) => /cloud/.test(item.script)),
    waterLogistics: childResults.filter((item) => /water_routes/.test(item.script)),
    castleModuleCompiler: childResults.filter((item) => /castle_module_compiler/.test(item.script)),
    performanceProxy: performanceGate,
    rollbackAndFlags: contracts,
    completionContract: childResults.filter((item) => /grok_completion_contract/.test(item.script)),
  },
  interpretation: {
    screenshotsRequired: false,
    manualOwnerApprovalRequired: false,
    hardwareFpsClaimed: false,
    gpuReplacement: "shader-source + budget/resource proxy; real hardware variance is not inferred",
  },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`✅ Grok automated acceptance matrix: HTTP modules=${httpGate.modules}, compileP95=${performanceGate.compileMs.p95}ms, shaderFiles=${contracts.shaderFiles}`);
console.log(`   report=${OUT}`);
