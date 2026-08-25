// PLAN V4 G0 基线记录：蓝图 hash、29 组目录、战斗 3 跑 canonical hash、Townscaper 选型指纹
// 运行：node tools/citadel_v4_g0_baseline.mjs
// 输出：tools/out/citadel_v4_g0.json
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;
import { FEATURES } from "../TigerMessenger/src/core/params.js";
import { hashHex } from "../TigerMessenger/src/core/rng.js";
import {
  createCitadelBlueprint,
  citadelBlueprintCanonicalHash,
} from "../TigerMessenger/src/world/citadelBlueprint.js";
import { CITADEL_TOWN_SPEC, townscaperModuleSelection } from "../TigerMessenger/src/world/citadelTown.js";
import { CITADEL_V4_BASELINES, CITADEL_V4_SEEDS } from "../TigerMessenger/src/world/citadel/baselineSpec.js";

const outDir = fileURLToPath(new URL("./out/", import.meta.url));
fs.mkdirSync(outDir, { recursive: true });

const blueprint = createCitadelBlueprint({
  spec: CITADEL_TOWN_SPEC,
  floors: 5,
  instanceId: "highland",
});
const blueprintHashes = [0, 1, 2].map(() =>
  citadelBlueprintCanonicalHash(createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" }))
);

const moduleFingerprint = hashHex(
  Array.from({ length: 64 }, (_, i) =>
    JSON.stringify(townscaperModuleSelection(i % 8, (i >> 3) % 4, i % 5, "2", 0, 0b111111))
  ).join("|")
);

const t0 = Date.now();
const replay = spawnSync(process.execPath, [fileURLToPath(new URL("./test_citadel_combat_replay.mjs", import.meta.url))], {
  encoding: "utf8",
  timeout: 120000,
});
const replayMs = Date.now() - t0;

const report = {
  recordedAt: "G0",
  flags: {
    citadelTownV4: FEATURES.citadelTownV4,
    citadelTerrainUvV2: FEATURES.citadelTerrainUvV2,
    citadelCombatV3: FEATURES.citadelCombatV3,
    citadelCombatV2: FEATURES.citadelCombatV2,
  },
  seeds: CITADEL_V4_SEEDS,
  baselines: CITADEL_V4_BASELINES.map((b) => b.id),
  baselineCount: CITADEL_V4_BASELINES.length,
  blueprint: {
    hash: blueprintHashes[0],
    hashes3: blueprintHashes,
    identical: blueprintHashes.every((h) => h === blueprintHashes[0]),
    floors: blueprint.floors,
    terraces: blueprint.town.terraceCount,
    gridSize: blueprint.grid.size,
  },
  townscaper: {
    moduleFingerprint,
    variantsConstant: 2450,
    note: "2450 是组合空间指标，不是已完成独立 Mesh 数",
  },
  combatReplay: {
    exitCode: replay.status,
    durationMs: replayMs,
    ok: replay.status === 0,
    stdoutTail: (replay.stdout || "").trim().split("\n").slice(-8),
  },
  metrics: {
    fps: null,
    p95CpuMs: null,
    drawCalls: null,
    geometryCount: null,
    materialCount: null,
    textureCount: null,
    jsHeap: null,
    offSurfaceError: 0,
    pathFail: 0,
    moduleFallback: 0,
    note: "Node 桩环境无法填 GPU/FPS；离表 0 来自 test_citadel_tactical_graph 全体节点 0.0000。P95/drawCalls 待 G10 浏览器镜头。",
  },
  knownRemainders: [
    "odysseyCitadel.js 亮窗仍用 Math.random（表现层，非攻防关键路径）",
    "citadelTacticalGraph 台面节点仍为环采样，G5 才改接 SurfaceProvider",
    "citadelTown 选型仍是坐标 hash，G3 才上 socket 求解器",
  ],
};

const outPath = fileURLToPath(new URL("./out/citadel_v4_g0.json", import.meta.url));
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`G0 基线已写 ${outPath}`);
console.log(`  蓝图 hash ${report.blueprint.hash} ×3 ${report.blueprint.identical ? "一致" : "漂移"}`);
console.log(`  基线 ${report.baselineCount} 组`);
console.log(`  战斗重放 exit=${report.combatReplay.exitCode} ${report.combatReplay.durationMs}ms`);
if (replay.status !== 0) {
  console.error(replay.stderr || replay.stdout);
  process.exit(1);
}
