// =====================================================================
//  地图编辑器 · 可放置建筑目录
//  每种建筑：id / 显示名 / 工厂 / 默认朝向 / 碰撞半径 / 地图标记色
// =====================================================================
import { createHardToFindBookshop } from "../assets/bookshop.js";
import { createLowPolyHouse, createLowPolySignpost, createLowPolyStreetLamp, createLowPolyUtilityPole, createLowPolyRock } from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { createLowPolyHydrangeaBush } from "../assets/hydrangea.js";

/**
 * @typedef {object} BuildingDef
 * @property {string} id
 * @property {string} label
 * @property {() => import("three").Object3D} create
 * @property {number} [defaultYaw]
 * @property {number} [collideRadius]
 * @property {string} [color] 地图标记色
 */

/** @type {Record<string, BuildingDef>} */
export const BUILDING_CATALOG = {
  bookshop: {
    id: "bookshop",
    label: "Hard To Find 书店",
    create: (opts = {}) =>
      createHardToFindBookshop({
        bermEdgeY: 0.02,
        signLine1: opts.signLine1,
        signLine2: opts.signLine2,
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
    create: () => createAncientPineTree(),
    defaultYaw: 0,
    collideRadius: 0.55,
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
    create: () => {
      // 每次随机种子，花球疏密与色相略有变化
      const seed = (Math.random() * 1e6) | 0;
      const scale = 0.85 + Math.random() * 0.35;
      const bush = createLowPolyHydrangeaBush(scale, seed);
      // 可踩踏，几乎不挡路
      if (bush.userData.collideRadius == null) bush.userData.collideRadius = 0.2;
      return bush;
    },
    defaultYaw: 0,
    collideRadius: 0.2,
    color: "#9ec5ff",
  },
};

export function getBuildingDef(typeId) {
  return BUILDING_CATALOG[typeId] || null;
}

export function listBuildingTypes() {
  return Object.values(BUILDING_CATALOG);
}
