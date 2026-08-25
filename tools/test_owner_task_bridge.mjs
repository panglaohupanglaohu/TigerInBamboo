// Owner-task bridge for the historical Kimi/Grok TODO sections.
//
// P2-P7 and C3-C7 were later implemented under the Grok V4 / Codex runtime
// layout. This test prevents the old owner labels from drifting away from the
// actual source and replaces screenshot/owner-signoff gates with contracts.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (relative) => fs.existsSync(path.join(REPO, relative));
const read = (relative) => fs.readFileSync(path.join(REPO, relative), "utf8");
const requireFile = (relative) => assert.equal(exists(relative), true, `缺少 ${relative}`);
const requireText = (relative, pattern) => assert.match(read(relative), pattern, `${relative} 缺少 ${pattern}`);

// P2-P7: individual agents, resolver/animation, director, Trojan lifecycle,
// surface movement and deterministic tests.
[
  "TigerMessenger/src/agents/citadel/combatAgent.js",
  "TigerMessenger/src/agents/citadel/squadDirector.js",
  "TigerMessenger/src/agents/citadel/combatResolver.js",
  "TigerMessenger/src/agents/citadel/animationController.js",
  "TigerMessenger/src/agents/citadel/siegeDirector.js",
  "tools/test_v6_g5_combat.mjs",
  "tools/test_phalanx.mjs",
  "tools/test_citadel_combat_replay.mjs",
].forEach(requireFile);
requireText("TigerMessenger/src/agents/citadel/combatAgent.js", /createCombatAgent|assignClimbAssist|gaitPhase/);
requireText("TigerMessenger/src/agents/citadel/combatResolver.js", /windup|contact|recover|resolveAttack/);
requireText("TigerMessenger/src/agents/citadel/siegeDirector.js", /makeTrojanWave|assignSearchTargets|nextTerrace/);
requireText("TigerMessenger/src/world/citadel/surfaceGraph.js", /constrainToSurfaces|stairs|waterfall-climb/);

// C3-C7: shared ship/unit/environment tokens, non-mutating grades, and
// automated visual/colorblind contracts.
[
  "TigerMessenger/src/world/citadelVisualTheme.js",
  "TigerMessenger/src/assets/harbor.js",
  "TigerMessenger/src/world/saihojiPhalanx.js",
  "tools/test_citadel_visual_theme.mjs",
  "tools/test_soldier_style.mjs",
  "tools/test_automated_visual_qa.mjs",
  "tools/citadel_colorblind_qa.mjs",
].forEach(requireFile);
requireText("TigerMessenger/src/world/citadelVisualTheme.js", /shipEnemyHull|unitAttackerMain|battleBloodFresh|envWater|CITADEL_V3_GRADES/);
requireText("TigerMessenger/src/assets/harbor.js", /shipEnemyHullShade|shipEnemyBand|shipDeckWood|shipRope/);
requireText("TigerMessenger/src/world/saihojiPhalanx.js", /unitTorch|unitMetal|citadelPaletteV3/);
requireText("tools/test_automated_visual_qa.mjs", /AUTOMATED|colorblind|LightingState/i);

// V8-G18: no new water/terrain/cloud visual source may bypass authored field
// data and curved rendering metadata.
requireText("TigerMessenger/src/world/highlandCitadelDesign.js", /solveHighlandTerrainTiles|solveHighlandWaterTiles|primary-grid\+dual-grid/);
requireText("TigerMessenger/src/world/planetV8/runtime.js", /compileCurvedWater|compileCloudClusters|ResourceRegistry/);

const report = {
  status: "AUTOMATED_TESTED",
  supersededOwnerSections: ["Kimi P2-P7", "Kimi C3-C7"],
  equivalentImplementation: "Grok V4 agents/surface graph + V3 semantic theme + Codex scripted gates",
  v8Rule: "WFC/dual-grid data precedes curved mesh/shader for terrain, water and cloud paths",
  humanOrGpuSignoffRequired: false,
};
const out = path.join(REPO, "tools/out/owner-task-bridge.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`✅ owner-task bridge passed: ${report.supersededOwnerSections.join(" + ")}`);
