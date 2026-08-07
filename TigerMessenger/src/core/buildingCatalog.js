// =====================================================================
//  地图编辑器 · 可放置资产目录（与场景程序创建共用同一工厂）
//  约定：
//    - create 只调用 assets/* 已有工厂，不另写几何
//    - 默认参数与 messengerIsland / nature 等场景一致
//    - collideRadius 优先读 object.userData（工厂写入）
// =====================================================================
import * as THREE from "three";
import { createHardToFindBookshop, createGrassTuft } from "../assets/bookshop.js";
import {
  createLowPolyHouse,
  createLowPolySignpost,
  createLowPolyStreetLamp,
  createLowPolyUtilityPole,
  createLowPolyRock,
  createLowPolyFlower,
  createLowPolyLawnHill,
  createLowPolyTree,
  createLowPolyFence,
  createLowPolyBridge,
  createLowPolyCloud,
  INK_FLOWER_COLORS,
} from "../assets/lowPoly.js";
import {
  createAncientPineTree,
  createCraneNPC,
  createBlackRock,
  createCraneOnRock,
} from "../assets/ancient.js";
import {
  createLowPolyHydrangeaBush,
  createBookshopHydrangeas,
} from "../assets/hydrangea.js";
import { createLowPolyFox, createClassicAliFox } from "../assets/fox.js";
import {
  createFisherBoat,
  createHarborCrane,
  createStackedCrates,
  buildOldHarborScene,
} from "../assets/harbor.js";
import { createDetailedMoebiusTower } from "../assets/moebiusTower.js";
import { createMoebiusAirship } from "../assets/moebiusAirship.js";
import { createMoebiusAircraft } from "../assets/moebiusAircraft.js";
import { createChristchurchTram } from "../assets/tram.js";
import { createBubblePod } from "../assets/bubblePod.js";
import {
  createMoebiusSwampPlacement,
  createMoebiusSwampZone,
  SWAMP_COMPONENT_BUILDERS,
} from "../world/moebiusSwamp.js";
import { createMoebiusTiger } from "../world/moebiusTiger.js";
import { createLowPolyBird } from "../world/flock.js";
import { createLongWingGlider } from "../world/airshipEscort.js";
import { buildMoebiusCrystalMetropolis } from "../world/moebiusCity.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import { buildSaihojiPlanet } from "../world/saihoji.js";
import { createPlanet } from "../world/planet.js";
import { buildHills } from "../world/hills.js";
import { createMoonLake } from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { createDynamicMoebiusClouds } from "../world/equatorialClouds.js";
import { buildImpastoMossyGround } from "../world/mossyGround.js";
import { buildWorld } from "../world/platforms.js";
import { buildMessenger } from "../player/messenger.js";
import { buildAgentMessenger } from "../player/agentMessenger.js";

/**
 * @typedef {object} BuildingDef
 * @property {string} id
 * @property {string} label
 * @property {(opts?: object) => import("three").Object3D} create
 * @property {number} [defaultYaw]
 * @property {number} [collideRadius] 工厂未写 userData 时的兜底
 * @property {string} [color] 地图标记色
 * @property {boolean} [hasSign]
 * @property {string} [defaultSignLine1]
 * @property {string} [defaultSignLine2]
 * @property {boolean} [diorama] 场景结构类：地图编辑器中以半透明展示
 */

/** @type {Record<string, BuildingDef>} */
export const BUILDING_CATALOG = {
  bookshop: {
    id: "bookshop",
    label: "Hard To Find 书店",
    // 与 messengerIsland 一致：bermEdgeY 0.02
    create: (opts = {}) =>
      createHardToFindBookshop({
        bermEdgeY: 0.02,
        signLine1: opts.signLine1 ?? "HARD TO FIND",
        signLine2: opts.signLine2 ?? "BOOKSHOP",
      }),
    defaultYaw: -0.5,
    collideRadius: 3.2,
    color: "#c45a3a",
    hasSign: true,
    defaultSignLine1: "HARD TO FIND",
    defaultSignLine2: "BOOKSHOP",
  },
  house: {
    id: "house",
    label: "水墨小房",
    create: () => createLowPolyHouse(),
    defaultYaw: 0,
    collideRadius: 0.95,
    color: "#8a9aaa",
  },
  pine: {
    id: "pine",
    label: "古松",
    // 与 nature / startingCamp 相同工厂；可选 seed
    create: (opts = {}) => createAncientPineTree(opts.seed),
    defaultYaw: 0,
    collideRadius: 0.58,
    color: "#2a4030",
  },
  signpost: {
    id: "signpost",
    label: "路牌",
    create: () => createLowPolySignpost(),
    defaultYaw: 0,
    collideRadius: 0.28,
    color: "#a63a2e",
  },
  lamp: {
    id: "lamp",
    label: "街灯",
    create: () => createLowPolyStreetLamp(),
    defaultYaw: 0,
    collideRadius: 0.22,
    color: "#5a6570",
  },
  pole: {
    id: "pole",
    label: "电线杆",
    create: () => createLowPolyUtilityPole(),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#3a322c",
  },
  rock: {
    id: "rock",
    label: "焦墨岩",
    create: () => createLowPolyRock(),
    defaultYaw: 0,
    collideRadius: 0.5,
    color: "#4a4844",
  },
  hydrangea: {
    id: "hydrangea",
    label: "绣球花丛",
    // 与 hydrangea.js / 书店周边一致：scale=1 半人高量级；seed 可复现
    create: (opts = {}) => {
      const scale = opts.scale ?? 1;
      const seed = opts.seed ?? 7;
      return createLowPolyHydrangeaBush(scale, seed);
    },
    defaultYaw: 0,
    collideRadius: 0.35,
    color: "#9ec5ff",
  },
  flower: {
    id: "flower",
    label: "水墨小花",
    create: (opts = {}) => {
      const cols = INK_FLOWER_COLORS;
      const hue =
        opts.hue ?? cols[((opts.seed ?? 0) >>> 0) % cols.length] ?? cols[0];
      return createLowPolyFlower(hue);
    },
    defaultYaw: 0,
    collideRadius: 0.15,
    color: "#c4a090",
  },
  lawnHill: {
    id: "lawnHill",
    label: "草坪山丘",
    // 与 hills 草绿/土褐色系一致的可贴地草丘
    create: (opts = {}) =>
      createLowPolyLawnHill({
        scale: opts.scale ?? 1,
        seed: opts.seed ?? 11,
      }),
    defaultYaw: 0,
    collideRadius: 2.0,
    color: "#55875f",
  },
  fox: {
    id: "fox",
    label: "阿狸（小狐狸）",
    create: () => createLowPolyFox({ scale: 0.52 }),
    defaultYaw: 0.9,
    collideRadius: 0.55,
    color: "#E96A36",
  },
  fisherBoat: {
    id: "fisherBoat",
    label: "小渔船",
    create: () => createFisherBoat(),
    defaultYaw: 0.35,
    collideRadius: 1.4,
    color: "#2C96B4",
  },
  harborCrane: {
    id: "harborCrane",
    label: "港口起重机",
    create: () => createHarborCrane(),
    defaultYaw: -0.55,
    collideRadius: 1.2,
    color: "#37474F",
  },
  stackedCrates: {
    id: "stackedCrates",
    label: "货柜木箱堆",
    create: (opts = {}) => createStackedCrates({ seed: opts.seed ?? 11 }),
    defaultYaw: 0,
    collideRadius: 1.6,
    color: "#A2B5CD",
  },
  oldHarbor: {
    id: "oldHarbor",
    label: "修船厂码头",
    create: (opts = {}) => buildOldHarborScene({ seed: opts.seed ?? 8844 }).group,
    defaultYaw: 0.85,
    collideRadius: 4.0,
    color: "#8B7355",
  },
  moebiusSwamp: {
    id: "moebiusSwamp",
    label: "莫比斯湖沼",
    // 坑口地表（局部 Y=40）贴原点，向球心深挖 30 单位至湖底；水面 Y=25
    // 可选 seed / scale（默认 0.5）
    create: (opts = {}) =>
      createMoebiusSwampPlacement({
        seed: opts.seed ?? 7711,
        scale: opts.scale ?? 0.5,
      }),
    defaultYaw: 0.6,
    collideRadius: 0, // 可走入：不设碰撞墙，送信人可直接进入坑缘/跳入湖沼
    color: "#48C9B0",
  },

  // ==================== 新增器物（建筑/道具/载具/结构）====================
  moebiusTower: {
    id: "moebiusTower",
    label: "莫比斯塔",
    create: (opts = {}) =>
      createDetailedMoebiusTower({
        stages: opts.stages ?? 3,
        goldScales: opts.goldScales ?? false,
      }),
    defaultYaw: 0,
    collideRadius: 1.5,
    color: "#9C8B7A",
  },
  moebiusAirship: {
    id: "moebiusAirship",
    label: "莫比斯航空艇",
    create: () => createMoebiusAirship(),
    defaultYaw: 0,
    collideRadius: 2.5,
    color: "#B0C4DE",
  },
  moebiusAircraft: {
    id: "moebiusAircraft",
    label: "莫比斯飞碟",
    create: () => createMoebiusAircraft(),
    defaultYaw: 0,
    collideRadius: 2.0,
    color: "#E5EFF2",
  },
  tram: {
    id: "tram",
    label: "基督城电车",
    create: (opts = {}) =>
      createChristchurchTram({ variant: opts.variant ?? "red" }),
    defaultYaw: 0,
    collideRadius: 1.2,
    color: "#C0392B",
  },
  bubblePod: {
    id: "bubblePod",
    label: "气泡座舱",
    create: () => createBubblePod({}),
    defaultYaw: 0,
    collideRadius: 1.0,
    color: "#AED6F1",
  },
  fence: {
    id: "fence",
    label: "木栅栏",
    create: () => createLowPolyFence(),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#8B7355",
  },
  bridge: {
    id: "bridge",
    label: "木桥",
    create: () => createLowPolyBridge(),
    defaultYaw: 0,
    collideRadius: 0.8,
    color: "#A0522D",
  },
  lowPolyTree: {
    id: "lowPolyTree",
    label: "低多边形树",
    create: () => createLowPolyTree(),
    defaultYaw: 0,
    collideRadius: 0.45,
    color: "#3CB371",
  },
  cloud: {
    id: "cloud",
    label: "云朵",
    create: () => createLowPolyCloud({}),
    defaultYaw: 0,
    collideRadius: 0,
    color: "#F0F8FF",
  },
  blackRock: {
    id: "blackRock",
    label: "黑岩",
    create: () => createBlackRock(),
    defaultYaw: 0,
    collideRadius: 0.6,
    color: "#2F2F2F",
  },
  craneOnRock: {
    id: "craneOnRock",
    label: "岩上鹤",
    create: () => createCraneOnRock(),
    defaultYaw: 0,
    collideRadius: 0.8,
    color: "#D3D3D3",
  },

  // ==================== 新增生物（动物 / 角色 NPC）====================
  classicAliFox: {
    id: "classicAliFox",
    label: "阿狸（经典版）",
    create: () => createClassicAliFox(),
    defaultYaw: 0.5,
    collideRadius: 0.5,
    color: "#FF7F50",
  },
  moebiusTiger: {
    id: "moebiusTiger",
    label: "赛博水墨虎",
    create: () => createMoebiusTiger(),
    defaultYaw: 0,
    collideRadius: 1.0,
    color: "#FF6347",
  },
  bird: {
    id: "bird",
    label: "Boids 小鸟",
    create: () => createLowPolyBird(),
    defaultYaw: 0,
    collideRadius: 0.2,
    color: "#87CEEB",
  },
  longWingGlider: {
    id: "longWingGlider",
    label: "异星滑翔长翼鸟",
    create: () => createLongWingGlider(),
    defaultYaw: 0,
    collideRadius: 0.6,
    color: "#9370DB",
  },
  craneNPC: {
    id: "craneNPC",
    label: "丹顶鹤 NPC",
    create: () => createCraneNPC(),
    defaultYaw: 0,
    collideRadius: 0.5,
    color: "#F5F5DC",
  },
  messenger: {
    id: "messenger",
    label: "送信人（玩家）",
    create: () => buildMessenger(),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#4682B4",
  },
  agentMessenger: {
    id: "agentMessenger",
    label: "数字孪生送信人",
    create: () => buildAgentMessenger({}),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#5F9EA0",
  },

  // ==================== 新增植物 ====================
  bookshopHydrangeas: {
    id: "bookshopHydrangeas",
    label: "书店绣球",
    create: () => createBookshopHydrangeas(),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#6495ED",
  },
  grassTuft: {
    id: "grassTuft",
    label: "草丛",
    create: () => createGrassTuft(),
    defaultYaw: 0,
    collideRadius: 0.1,
    color: "#90EE90",
  },
  mossyGround: {
    id: "mossyGround",
    label: "厚涂苔藓地被",
    create: (opts = {}) =>
      buildImpastoMossyGround({ size: opts.size ?? 8, seed: opts.seed ?? 5 }),
    defaultYaw: 0,
    collideRadius: 0,
    color: "#556B2F",
  },

  // ==================== 莫比斯湖沼内部生态组件（可独立放置）====================
  swamp_whale: {
    id: "swamp_whale",
    label: "沼泽·白鲸",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.whale(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 1.5,
    color: "#F0F8FF",
  },
  swamp_worldTree: {
    id: "swamp_worldTree",
    label: "沼泽·世界树",
    create: (opts = {}) => {
      const g = new THREE.Group();
      SWAMP_COMPONENT_BUILDERS.worldTree(opts.rnd ?? Math.random, g);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 1.0,
    color: "#2E8B57",
  },
  swamp_nativeDoll: {
    id: "swamp_nativeDoll",
    label: "沼泽·原住民人偶",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.nativeDoll(opts.scale ?? 0.9),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#4A3728",
  },
  swamp_lotusLeafBoat: {
    id: "swamp_lotusLeafBoat",
    label: "沼泽·莲叶舟",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.lotusLeafBoat(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.8,
    color: "#3CB371",
  },
  swamp_eel: {
    id: "swamp_eel",
    label: "沼泽·黄绿鳗",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.swampEel(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#9ACD32",
  },
  swamp_tubeWorm: {
    id: "swamp_tubeWorm",
    label: "沼泽·橙红管虫丛",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.tubeWormCluster(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.5,
    color: "#FF4500",
  },
  swamp_mushroom: {
    id: "swamp_mushroom",
    label: "沼泽·紫蘑菇/珊瑚",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.moebiusMushroom(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#8A2BE2",
  },
  swamp_pinkHanger: {
    id: "swamp_pinkHanger",
    label: "沼泽·粉垂生物",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.pinkHanger(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#FF69B4",
  },
  swamp_bird: {
    id: "swamp_bird",
    label: "沼泽·沼泽鸟",
    create: (opts = {}) =>
      SWAMP_COMPONENT_BUILDERS.swampBird(opts.rnd ?? Math.random, opts.color ?? 0xeaf6ff),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#E0FFFF",
  },
  swamp_monkey: {
    id: "swamp_monkey",
    label: "沼泽·长尾猴",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.longTailMonkey(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.4,
    color: "#8B4513",
  },
  swamp_lizard: {
    id: "swamp_lizard",
    label: "沼泽·发光蜥蜴",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.glowLizard(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#00FA9A",
  },
  swamp_ribbonFish: {
    id: "swamp_ribbonFish",
    label: "沼泽·发光带鱼",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.ribbonFish(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#C8E860",
  },
  swamp_shell: {
    id: "swamp_shell",
    label: "沼泽·贝壳",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.shell(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#E8DCC4",
  },
  swamp_rimPalm: {
    id: "swamp_rimPalm",
    label: "沼泽·坑缘棕榈",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.rimPalm(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.5,
    color: "#228B22",
  },
  swamp_toweringTree: {
    id: "swamp_toweringTree",
    label: "沼泽·苍天巨树",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.toweringTree(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.8,
    color: "#556B2F",
  },
  swamp_canopy: {
    id: "swamp_canopy",
    label: "沼泽·树冠顶棚",
    create: (opts = {}) => {
      const g = new THREE.Group();
      SWAMP_COMPONENT_BUILDERS.canopyCeiling(opts.rnd ?? Math.random, g);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#6B8E23",
  },
  swamp_glowFlower: {
    id: "swamp_glowFlower",
    label: "沼泽·发光花蕊花",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.glowFlower(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#C8FFE8",
  },
  swamp_giantFlower: {
    id: "swamp_giantFlower",
    label: "沼泽·巨花",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.giantFlower(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.5,
    color: "#FFB6C1",
  },
  swamp_stamenSpike: {
    id: "swamp_stamenSpike",
    label: "沼泽·花蕊尖锥",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.stamenSpike(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.3,
    color: "#FFD9E8",
  },
  swamp_fishSchool: {
    id: "swamp_fishSchool",
    label: "沼泽·绿黑斑纹小鱼群",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.fishSchool(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0.8,
    color: "#2F8F6E",
  },
  swamp_fireflies: {
    id: "swamp_fireflies",
    label: "沼泽·萤火虫群",
    create: (opts = {}) => SWAMP_COMPONENT_BUILDERS.fireflies(opts.rnd ?? Math.random),
    defaultYaw: 0,
    collideRadius: 0,
    color: "#D8FF9A",
  },

  // ==================== 场景结构（diorama 缩影，可放置）====================
  swampZone: {
    id: "swampZone",
    label: "莫比斯湖沼生态区",
    create: (opts = {}) => createMoebiusSwampZone({ seed: opts.seed ?? 20260804 }),
    defaultYaw: 0,
    collideRadius: 0,
    color: "#48C9B0",
  },
  moebiusCity: {
    id: "moebiusCity",
    label: "莫比斯水晶城",
    create: (opts = {}) => {
      const g = new THREE.Group();
      buildMoebiusCrystalMetropolis(g, opts.R ?? 6, {});
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#FFD700",
  },
  startingCamp: {
    id: "startingCamp",
    label: "起始营地",
    create: (opts = {}) => {
      const g = new THREE.Group();
      buildStartingCamp(g, opts.R ?? 40);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#D2B48C",
  },
  saihoji: {
    id: "saihoji",
    label: "西芳寺·苔海",
    create: (opts = {}) => {
      const g = new THREE.Group();
      buildSaihojiPlanet(g, {});
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#8FBC8F",
  },
  planet: {
    id: "planet",
    label: "小星球本体",
    create: () => {
      const g = new THREE.Group();
      createPlanet(g);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#3F7A58",
  },
  hills: {
    id: "hills",
    label: "岛丘地形",
    create: (opts = {}) => {
      const g = new THREE.Group();
      buildHills(g, opts.R ?? 40);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#55875F",
  },
  moonLake: {
    id: "moonLake",
    label: "月牙湖",
    create: (opts = {}) => {
      const g = new THREE.Group();
      createMoonLake(g, opts.R ?? 40);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#2C96B4",
  },
  tramSystem: {
    id: "tramSystem",
    label: "电车轨道系统",
    create: (opts = {}) => {
      const g = new THREE.Group();
      buildChristchurchTramSystem(g, opts.R ?? 6, {});
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#C0392B",
  },
  equatorialClouds: {
    id: "equatorialClouds",
    label: "赤道风暴云墙",
    create: (opts = {}) => {
      const g = new THREE.Group();
      createDynamicMoebiusClouds(g, opts.R ?? 6);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#B0C4DE",
  },
  platforms: {
    id: "platforms",
    label: "平台土坡",
    create: () => {
      const g = new THREE.Group();
      buildWorld(g);
      return g;
    },
    defaultYaw: 0,
    collideRadius: 0,
    color: "#8FBC8F",
  },
};

// 场景结构类标记为 diorama：在地图编辑器中以半透明展示，
// 避免大型地形/系统遮挡底下实体物体。
for (const id of [
  "swampZone", "moebiusCity", "startingCamp", "saihoji", "planet",
  "hills", "moonLake", "tramSystem", "equatorialClouds", "platforms",
]) {
  if (BUILDING_CATALOG[id]) BUILDING_CATALOG[id].diorama = true;
}

/**
 * 程序与地图共用的创建入口：工厂 + 统一 assetType 标记。
 * @param {string} typeId
 * @param {object} [opts]
 * @returns {import("three").Object3D | null}
 */
export function createCatalogObject(typeId, opts = {}) {
  const def = BUILDING_CATALOG[typeId];
  if (!def?.create) return null;
  const object = def.create(opts);
  if (!object) return null;
  object.userData.assetType = typeId;
  object.userData.mapType = typeId;
  // 工厂未写碰撞时用目录兜底
  if (object.userData.collideRadius == null && def.collideRadius != null) {
    object.userData.collideRadius = def.collideRadius;
  }
  // 记录工厂参数，便于复制时一致
  object.userData.factoryOpts = { ...opts };
  return object;
}

export function getBuildingDef(typeId) {
  return BUILDING_CATALOG[typeId] || null;
}

export function listBuildingTypes() {
  return Object.values(BUILDING_CATALOG);
}
