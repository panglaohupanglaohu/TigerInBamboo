// =====================================================================
//  CitadelPresentation 数据层：消费 compile 结果，不改玩法（G8/G11）
//  Three overlay 见 presentationOverlay.js。
// =====================================================================

import { topologyToSvg } from "./topology.js";
import { finalColor, resolveBuildingTheme, TILE_ACCENTS } from "./visualTheme.js";
import { snapshotDebugLayers } from "./debugLayers.js";
import { buildClusterSample } from "./incrementalBuilder.js";
import { CITADEL_V4_WEATHERS, CITADEL_V4_CAMERAS } from "./baselineSpec.js";

export function createPresentationDump(v4, extras = {}) {
  const cluster = buildClusterSample("house:0:12:12", v4.seed || 7);
  return {
    seed: v4.seed,
    uv: v4.uv?.stats || {},
    town: {
      cells: v4.town?.cells.length ?? 0,
      fallback: v4.town?.fallbackCount ?? 0,
      gates: v4.town?.gateLocks ?? 0,
    },
    graph: {
      nodes: v4.graph?.nodes.size ?? 0,
      edges: v4.graph?.edges.size ?? 0,
    },
    cluster,
    tileAccents: TILE_ACCENTS,
    debug: snapshotDebugLayers(v4, extras),
    overviewSvg: topologyToSvg(v4.topo),
  };
}

export function weatherTintedSvg(v4, weather = "clear") {
  const wall = finalColor("castleWallChalk", { weather, timeBand: weather === "night" ? "night" : "day" });
  const water = finalColor("envWater", { weather, timeBand: weather === "night" ? "night" : "day" });
  let svg = topologyToSvg(v4.topo);
  svg = svg.replace(/#e7ece7/g, wall).replace(/#8eb8c8/g, water);
  return svg;
}

export function cameraShotId(weather, camera) {
  return `${weather}/${camera}`;
}

export function listPresentationShots() {
  return CITADEL_V4_WEATHERS.flatMap((weather) =>
    CITADEL_V4_CAMERAS.map((camera) => ({
      id: cameraShotId(weather, camera),
      weather,
      camera,
    }))
  );
}
