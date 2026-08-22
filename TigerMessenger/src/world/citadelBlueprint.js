// ============================================================================
// Citadel Blueprint — 古堡的纯数据编译层
//
// 这里不创建 Three.js 对象，也不操作场景。所有编辑器输入、存档输入和
// 默认布局先编译成一个不可变蓝图，再交给 terrain/town/object/presentation
// 四个装配阶段消费。这样古堡的“在哪里建、建几层、哪些位置可承重”和
// “如何画成网格、屋顶、瀑布”彻底分开。
// ============================================================================
import {
  CITADEL_CASTLE_FLOORS,
  CITADEL_GRID_SIZE,
  CITADEL_TERRACE_COUNT,
  CITADEL_TOWN_SPEC,
  normalizeCitadelTerraceLayout,
} from "./citadelTown.js";

export const CITADEL_BLUEPRINT_VERSION = 1;
export const CITADEL_BUILD_STAGES = Object.freeze([
  "foundation",
  "terraces",
  "waterfalls",
  "town",
  "terrain-objects",
  "presentation",
]);

const TERRAIN_OBJECT_TYPES = new Set(["watchtower", "elderTree", "trojanHorse"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

/**
 * 统一台地数据：台地数组始终按鸟瞰顺序排列，0 是最高层，4 是最低层。
 * 这是蓝图层的唯一地形输入格式，避免各个渲染函数各自解释旧存档。
 */
export function normalizeCitadelBlueprintTerrain(input = {}) {
  const source = Array.isArray(input?.terraces)
    ? input.terraces
    : Array.from({ length: input?.layerCount ?? CITADEL_TERRACE_COUNT }, (_, index) => {
      const reverse = (input?.layerCount ?? CITADEL_TERRACE_COUNT) - 1 - index;
      return {
        radius: (input?.baseRadius ?? 24) * (input?.shrink ?? 0.9) ** reverse,
        height: input?.layerHeight ?? 2,
      };
    });
  const minHeight = CITADEL_TOWN_SPEC.cellHeight;
  const terraces = source.slice(0, CITADEL_TERRACE_COUNT).map((entry, index) => ({
    radius: Math.max(3, Number(entry?.radius) || 8 + index * 3),
    height: Math.max(minHeight, Number(entry?.height) || 2),
  }));
  while (terraces.length < CITADEL_TERRACE_COUNT) {
    const previous = terraces.at(-1) ?? { radius: 12, height: 2 };
    terraces.push({ radius: previous.radius + 2.5, height: previous.height });
  }
  for (let index = 1; index < terraces.length; index++) {
    terraces[index].radius = Math.max(terraces[index].radius, terraces[index - 1].radius + 0.5);
  }

  const cascadeEnabled = input?.cascadeEnabled !== false;
  const cascadePoolsEnabled = input?.cascadePoolsEnabled !== false;
  const notchHalfRaw = Number(input?.notchHalf);
  const notchHalf = cascadeEnabled
    ? Number.isFinite(notchHalfRaw) && notchHalfRaw > 0
      ? Math.min(0.8, Math.max(0.08, notchHalfRaw))
      : 0.30
    : 0;
  const notchedRaw = Number(input?.notchedLayers);
  const notchedLayers = cascadeEnabled
    ? Math.min(
      terraces.length - 1,
      Number.isFinite(notchedRaw) && notchedRaw > 0 ? Math.round(notchedRaw) : 4
    )
    : 0;

  return Object.freeze({
    ...input,
    layerCount: terraces.length,
    terraces: freezeArray(terraces),
    radialSegments: input?.radialSegments ?? 12,
    cascadeEnabled,
    cascadePoolsEnabled,
    coreRadius: input?.coreRadius ?? 9,
    notchCenter: input?.notchCenter ?? 0.17,
    notchHalf,
    notchedLayers,
  });
}

/** 台地底/顶高程；保持和地形几何、编辑器、建筑基座同一套计算。 */
export function citadelBlueprintTerraceMetrics(terrain) {
  const metrics = Array(terrain.terraces.length);
  let cursorY = 2;
  for (let index = terrain.terraces.length - 1; index >= 0; index--) {
    const terrace = terrain.terraces[index];
    metrics[index] = {
      terraceIndex: index,
      radius: terrace.radius,
      height: terrace.height,
      bottom: cursorY,
      top: cursorY + terrace.height,
    };
    cursorY += terrace.height;
  }
  return freezeArray(metrics);
}

function normalizeTerrainObjects(input = []) {
  const source = Array.isArray(input) ? input : input?.objects;
  if (!Array.isArray(source)) return Object.freeze([]);
  return Object.freeze(source.flatMap((entry, index) => {
    if (!TERRAIN_OBJECT_TYPES.has(entry?.type)) return [];
    const terraceIndex = clamp(Math.round(Number(entry.terraceIndex) || 0), 0, 4);
    return [{
      id: String(entry.id || `${entry.type}-${terraceIndex}-${index}`),
      type: entry.type,
      terraceIndex,
      x: Number(entry.x) || 0,
      z: Number(entry.z) || 0,
      yaw: Number(entry.yaw) || 0,
      scale: Math.max(
        0.2,
        Math.min(
          1.5,
          Number(entry.scale)
            || (entry.type === "watchtower" ? 0.42
              : entry.type === "trojanHorse" ? 0.9 : 0.45)
        )
      ),
      grounded: entry.grounded !== undefined
        ? Boolean(entry.grounded)
        : entry.type === "elderTree",
    }];
  }).map((item) => Object.freeze(item)));
}

/**
 * 把所有外部输入编译成一个稳定蓝图。renderer 只接收这个结果，不再直接
 * 读取 options/spec/localStorage，从源头上消除“场景和编辑器各算一遍”的分叉。
 */
export function createCitadelBlueprint({
  spec = CITADEL_TOWN_SPEC,
  contour,
  floors = CITADEL_CASTLE_FLOORS,
  instanceId = null,
  skipOuterTerrain = false,
  townBaseLift = 0.6,
  terrainObjects = [],
} = {}) {
  const safeFloors = Math.min(20, Math.max(1, Math.round(Number(floors) || CITADEL_CASTLE_FLOORS)));
  const townLayout = normalizeCitadelTerraceLayout(spec, safeFloors);
  const terrain = normalizeCitadelBlueprintTerrain(contour);
  const metrics = citadelBlueprintTerraceMetrics(terrain);
  const objects = normalizeTerrainObjects(terrainObjects);
  const baseYs = metrics.map((metric) => metric.top - 0.06);
  const stages = CITADEL_BUILD_STAGES.map((id, index) => ({
    id,
    order: index,
    enabled: id === "terraces" || id === "waterfalls"
      ? !skipOuterTerrain
      : true,
  }));

  return Object.freeze({
    version: CITADEL_BLUEPRINT_VERSION,
    instanceId,
    floors: safeFloors,
    grid: Object.freeze({
      size: townLayout.gridSize ?? CITADEL_GRID_SIZE,
      cellSize: CITADEL_TOWN_SPEC.cellSize,
      cellHeight: CITADEL_TOWN_SPEC.cellHeight,
    }),
    terrain: Object.freeze({
      config: terrain,
      metrics,
      baseYs: Object.freeze(baseYs),
      topY: metrics[0]?.top ?? 0,
      skipOuterTerrain: Boolean(skipOuterTerrain),
    }),
    town: Object.freeze({
      layout: townLayout,
      terraceCount: townLayout.terraces.length,
    }),
    objects,
    presentation: Object.freeze({
      townBaseLift: Number(townBaseLift) || 0.6,
    }),
    stages: freezeArray(stages),
  });
}

export function citadelBlueprintSummary(blueprint) {
  return Object.freeze({
    version: blueprint.version,
    instanceId: blueprint.instanceId,
    floors: blueprint.floors,
    terraces: blueprint.town.terraceCount,
    gridSize: blueprint.grid.size,
    objectCount: blueprint.objects.length,
    stages: blueprint.stages.filter((stage) => stage.enabled).map((stage) => stage.id),
  });
}
