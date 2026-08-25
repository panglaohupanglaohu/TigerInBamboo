// =====================================================================
//  V4 取代表（主人 2026-08-22：删除旧真源、做标记）
//  网格/攻城文件暂留：V4 还没有等价 Three 网格与完整日夜攻城。
//  新逻辑只进 citadel/ 与 agents/citadel/，禁止往 @legacy 文件加玩法。
// =====================================================================

export const CITADEL_LEGACY = Object.freeze({
  "src/world/citadelTown.js": {
    role: "Townscaper 网格装配",
    replace: "src/world/citadel/moduleResolver.js + incrementalBuilder.js",
    status: "legacy-mesh",
  },
  "src/world/citadelRange.js": {
    role: "外围地形 / walkLift / 瀑布 / 木马",
    replace: "src/world/citadel/surfaceProvider.js + terrainGenerator.js",
    status: "legacy-mesh",
  },
  "src/world/saihojiPhalanx.js": {
    role: "日间攻城状态机",
    replace: "src/agents/citadel/siegeDirector.js + combatSim.js",
    status: "legacy-gameplay",
  },
  "src/world/citadelInfiltration.js": {
    role: "深夜木马巡查",
    replace: "src/agents/citadel/siegeDirector.js makeTrojanWave",
    status: "legacy-gameplay",
  },
  "src/world/citadelTacticalGraph.js": {
    role: "V2 环采样战术图",
    replace: "src/world/citadel/surfaceGraph.js",
    status: "legacy-nav",
  },
});

export const LEGACY_BANNER = Object.freeze(
  "@legacy 禁止追加新玩法。V4 真源：src/world/citadel/ 与 src/agents/citadel/。见 docs/citadel-v4-legacy.md"
);
