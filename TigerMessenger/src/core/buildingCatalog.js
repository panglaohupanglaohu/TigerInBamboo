// =====================================================================
//  地图编辑器 · 可放置资产目录（与场景程序创建共用同一工厂）
//  约定：
//    - create 只调用 assets/* 已有工厂，不另写几何
//    - 默认参数与 messengerIsland / nature 等场景一致
//    - collideRadius 优先读 object.userData（工厂写入）
// =====================================================================
import { createHardToFindBookshop } from "../assets/bookshop.js";
import {
  createLowPolyHouse,
  createLowPolySignpost,
  createLowPolyStreetLamp,
  createLowPolyUtilityPole,
  createLowPolyRock,
  createLowPolyFlower,
  createLowPolyLawnHill,
  INK_FLOWER_COLORS,
} from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { createLowPolyHydrangeaBush } from "../assets/hydrangea.js";

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
};

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
