// =====================================================================
//  故事板白名单：从 BUILDING_CATALOG 派生「可用于故事板」的条目 + 分类
//  - 排除整景/系统类 diorama（城市、星球本体、轨道系统等不适合当故事道具）
//  - 附中文标签供模型理解语义；id 是模型唯一允许输出的标识
// =====================================================================
import { BUILDING_CATALOG } from "../core/buildingCatalog.js";

/** 整景/系统类：不适合当「单个物品」随手摆 */
const EXCLUDE = new Set([
  "moebiusCity", "planet", "hills", "moonLake", "tramSystem",
  "equatorialClouds", "platforms", "startingCamp", "saihoji", "swampZone",
]);

const SWAMP_ANIMALS = new Set([
  "swamp_whale", "swamp_eel", "swamp_bird", "swamp_monkey", "swamp_lizard",
  "swamp_ribbonFish", "swamp_fishSchool", "swamp_fireflies", "swamp_shell",
  "swamp_tubeWorm",
]);
const SWAMP_PLANTS = new Set([
  "swamp_mushroom", "swamp_glowFlower", "swamp_giantFlower", "swamp_stamenSpike",
  "swamp_rimPalm", "swamp_toweringTree", "swamp_worldTree", "swamp_lotusLeafBoat",
  "swamp_canopy", "swamp_pinkHanger",
]);
const ANIMALS = new Set([
  "fox", "classicAliFox", "moebiusTiger", "bird", "longWingGlider",
  "craneNPC", "craneOnRock",
]);
const PLANTS = new Set([
  "pine", "lowPolyTree", "flower", "hydrangea", "bookshopHydrangeas", "grassTuft",
]);
const BUILDINGS = new Set([
  "bookshop", "house", "oldHarbor", "moebiusTower", "tram", "moebiusAirship",
  "moebiusAircraft", "bridge", "fence", "signpost", "lamp", "pole",
  "bubblePod", "fisherBoat", "harborCrane", "stackedCrates", "moebiusSwamp",
  "mossyGround", "lawnHill",
]);

function categoryOf(id) {
  if (id.startsWith("swamp_")) {
    if (SWAMP_ANIMALS.has(id)) return "动物";
    if (SWAMP_PLANTS.has(id)) return "植物";
    return "环境";
  }
  if (ANIMALS.has(id)) return "动物";
  if (PLANTS.has(id)) return "植物";
  if (BUILDINGS.has(id)) return "建筑/载具";
  return "物品";
}

/**
 * 故事板可用条目
 * @returns {{ id: string, label: string, category: string }[]}
 */
export function getStoryCatalog() {
  return Object.entries(BUILDING_CATALOG)
    .filter(([id, def]) => !EXCLUDE.has(id) && !def.diorama)
    .map(([id, def]) => ({ id, label: def.label, category: categoryOf(id) }));
}

/** 白名单 id 集合（引擎二次校验用） */
export function getStoryCatalogIds() {
  return new Set(getStoryCatalog().map((c) => c.id));
}

/** 场景里已存在、可被「引用」而非「新建」的角色 */
export const KNOWN_ACTORS = ["fox", "elder", "moebiusTiger", "messenger", "player"];

/** 引擎支持的时间线动作（同样发给模型，约束它只能用这些动词） */
export const STORY_ACTIONS = [
  "spawn",        // { type:"spawn", uid }
  "say",          // { type:"say", actor, text }
  "moveTo",       // { type:"moveTo", actor, target:"near_player"|uid, speed? }
  "wait",         // { type:"wait", seconds }
  "focusCamera",  // { type:"focusCamera", target:uid, seconds? }
  "toast",        // { type:"toast", text }
  "weather",      // { type:"weather", value:"clear"|"rain"|"snow" }
];

/** 天气字面量 → P.weather（0 晴 / 1 雨 / 2 雪） */
export const WEATHER_VALUE = Object.freeze({ clear: 0, rain: 1, snow: 2 });
