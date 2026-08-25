import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = [
  "tools/test_planet_v9_final_elevation.mjs",
  "tools/test_planet_v9_seed_gates.mjs",
  "tools/test_planet_v9_forest_grass.mjs",
  "tools/test_planet_v9_cloud_paths.mjs",
  "tools/test_highland_hero_clouds.mjs",
  "tools/test_planet_v9_water_topology.mjs",
  "tools/test_planet_v9_lake_surface.mjs",
  "tools/test_planet_v9_terrain_editor.mjs",
  "tools/test_planet_v9_runtime_wiring.mjs",
  "tools/test_planet_v10_coupled_systems.mjs",
];
const results = [];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(repo, script)], { encoding: "utf8" });
  assert.equal(result.status, 0, `${script}\n${result.stdout}\n${result.stderr}`);
  results.push({ script, ok: true, tail: result.stdout.trim().split("\n").at(-1) });
}
const audit = spawnSync(process.execPath, [path.join(repo, "tools/audit_planet_v8_oskar_gap.mjs")], { encoding: "utf8" });
assert.equal(audit.status, 0, audit.stderr);
const auditReport = JSON.parse(audit.stdout.slice(audit.stdout.indexOf("{")));
const ledgerHash = createHash("sha256").update(JSON.stringify(auditReport.ledger)).digest("hex");
const report = { version: 1, suite: "planet-v9-oskar", status: auditReport.verdict, ledgerHash, capabilities: auditReport.ledger.capabilities, tests: results };
const output = path.join(repo, "tools/out/planet-v9-capability-ledger.json");
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(`✅ Planet V9 Oskar suite: ${results.length} data/runtime gates passed, verdict=${report.status}, ledger=${output}`);
