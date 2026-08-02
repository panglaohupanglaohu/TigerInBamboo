// =====================================================================
//  自然点缀（从星球实验页并入主游戏）：远侧 toon 资产 + 漂移云环
//  游玩区在北极附近（lat ≥ ~55°），装饰放在远侧，纯视觉无碰撞
// =====================================================================
import * as THREE from "three";
import {
  createLowPolyTree,
  createLowPolyHouse,
  createLowPolyRock,
  createLowPolyFlower,
  createLowPolyCloud,
  createLowPolySignpost,
  createLowPolyStreetLamp,
  createLowPolyUtilityPole,
  placeOnSphere,
  INK_FLOWER_COLORS,
} from "../assets/lowPoly.js";
import { placeObjectOnSphere } from "./sphereMath.js";
import { createAncientPineTree, createCraneOnRock } from "../assets/ancient.js";
import { LAKE } from "./lake.js";
import { QUEST_DEFS } from "../quest/questSystem.js";
import { groundLiftAt } from "./hills.js";

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 远侧（lat -20°..45°）点缀树/岩/花/房：装饰 + 碰撞体 */
export function decorateFarSide(scene, planetRadius, seed = 20260802) {
  const rnd = lcg(seed);
  const meshes = [];
  const colliders = [];
  // 远侧同步水墨色系（沉绿树 / 焦墨岩 / 低饱和花）
  const defs = [
    [createLowPolyTree, 24],
    [createLowPolyRock, 10],
    [
      () => createLowPolyFlower(INK_FLOWER_COLORS[(rnd() * INK_FLOWER_COLORS.length) | 0]),
      16,
    ],
    [createLowPolyHouse, 0], // 房屋已删除；工厂已水墨化备用
  ];
  for (const [make, count] of defs) {
    for (let i = 0; i < count; i++) {
      const lat = -20 + rnd() * 65;
      const lon = rnd() * 360 - 180;
      const obj = placeOnSphere(make(), lat, lon, planetRadius);
      obj.rotateY(rnd() * Math.PI * 2);
      obj.scale.multiplyScalar(0.85 + rnd() * 0.4);
      scene.add(obj);
      meshes.push(obj);
      pushCollider(colliders, obj);
    }
  }
  return { meshes, colliders };
}

/** 收集单个放置物的碰撞体（花草 0.15 以下忽略） */
function pushCollider(colliders, obj) {
  const cr = obj.userData.collideRadius ?? 0.4;
  if (cr >= 0.25) {
    colliders.push({ position: obj.position.clone(), radius: cr * obj.scale.x });
  }
}

/** 云环：距球面 height 的低空，updateClouds 驱动绕心公转 + 径向起伏 */
export function createCloudRing(scene, planetRadius, { count = 10, height = 8, seed = 7 } = {}) {
  const rnd = lcg(seed);
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const lat = 20 + rnd() * 65; // 覆盖游玩区上空，抬头可见
    const lon = rnd() * 360 - 180;
    const obj = placeOnSphere(createLowPolyCloud(), lat, lon, planetRadius + height);
    obj.rotateY(rnd() * Math.PI * 2);
    obj.scale.multiplyScalar(0.8 + rnd() * 0.8);
    obj.userData.drift = {
      axis: new THREE.Vector3(rnd() - 0.5, rnd() * 0.4 + 0.6, rnd() - 0.5).normalize(),
      speed: 0.04 + rnd() * 0.08, // rad/s
      bobAmp: 0.25 + rnd() * 0.35,
      bobSpeed: 0.4 + rnd() * 0.6,
      phase: rnd() * Math.PI * 2,
      baseR: planetRadius + height,
    };
    scene.add(obj);
    clouds.push(obj);
  }
  return clouds;
}

/**
 * 小世界设计（Small World Design）布局：带最小安全距离的约束随机。
 *  - 绝对量纲：玩家 1.7m 为 1 单位；树 = 玩家 2~3 倍；房 ≈ 1.4 倍（克制）
 *  - Min Distance：同类间距 + 对房子间距，采样拒绝保证
 *  - 空间克制：主岛建筑 ≤ 3 栋，树 ≤ 12，岩 ≤ 4，花 ≤ 12
 * 参考：主人转述 Sujal Talreja 对《Messenger》的设计拆解（Medium）
 */
const LAYOUT_RULES = {
  houses: { count: 0, minGap: 8.0, gapVsHouse: 8.0, ring: [5, 12], scale: [0.9, 1.05] }, // 房屋已删除（主人 2026-08-02）
  trees: { count: 12, minGap: 4.0, gapVsHouse: 4.5, ring: [3.5, 15.5], scale: [0.85, 1.15] },
  rocks: { count: 4, minGap: 5.0, gapVsHouse: 3.5, ring: [5, 15], scale: [0.8, 1.2] },
  flowers: { count: 12, minGap: 2.5, gapVsHouse: 2.5, ring: [3, 14], scale: [0.9, 1.2] },
};

// 街道资产点位（Grok）：路牌 / 街灯 / 电线杆
const ISLAND_LAYOUT = {
  street: [
    { make: "sign", xz: [2.5, 9.5] },
    { make: "sign", xz: [-7.5, 4] },
    { make: "lamp", xz: [8, 5] },
    { make: "lamp", xz: [-5, -8] },
    { make: "pole", xz: [12, -2] },
    { make: "pole", xz: [-11, 9] },
  ],
};

export function decoratePlayZone(scene, planetRadius, seed = 11) {
  const rnd = lcg(seed);
  const meshes = [];
  const colliders = [];

  // 关键落点保持净空（NPC 收发点 + 出生点）
  const keepClear = [];
  for (const q of QUEST_DEFS) {
    keepClear.push({ x: q.sender.pos[0], z: q.sender.pos[2], r: 3.2 });
    keepClear.push({ x: q.receiver.pos[0], z: q.receiver.pos[2], r: 3.2 });
  }
  keepClear.push({ x: 0, z: 6, r: 4 }); // 出生点
  keepClear.push({ x: LAKE.x, z: LAKE.z, r: LAKE.pathOuter + 0.6 }); // 月亮湖及小径净空
  const isClear = (x, z) =>
    keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.r);

  const groups = [
    ["houses", createLowPolyHouse], // 工厂水墨化；count=0 不摆
    ["trees", createAncientPineTree], // 分形水墨古松
    ["rocks", createLowPolyRock], // 焦墨岩
    [
      "flowers",
      () => createLowPolyFlower(INK_FLOWER_COLORS[(rnd() * INK_FLOWER_COLORS.length) | 0]),
    ],
  ];

  const placedHouses = []; // 房对房的克制 + 他类对房的间距
  for (const [kind, make] of groups) {
    const rule = LAYOUT_RULES[kind];
    const placedSame = [];
    for (let i = 0; i < rule.count; i++) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const ang = rnd() * Math.PI * 2;
        const rad = rule.ring[0] + rnd() * (rule.ring[1] - rule.ring[0]);
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        if (!isClear(x, z)) continue;
        // Min Distance：同类
        if (!placedSame.every((p) => Math.hypot(x - p.x, z - p.z) >= rule.minGap)) continue;
        // Min Distance：对房子（房子自身也受此约束 → 同屏克制）
        if (!placedHouses.every((p) => Math.hypot(x - p.x, z - p.z) >= rule.gapVsHouse)) continue;

        const obj = make();
        placeObjectOnSphere(obj, x, z, groundLiftAt(x, z), planetRadius); // 岛面+土坡真实抬升
        obj.rotateY(rnd() * Math.PI * 2);
        obj.scale.multiplyScalar(rule.scale[0] + rnd() * (rule.scale[1] - rule.scale[0]));
        scene.add(obj);
        meshes.push(obj);
        pushCollider(colliders, obj);
        placedSame.push({ x, z });
        if (kind === "houses") placedHouses.push({ x, z });
        break;
      }
    }
  }

  // 水墨点缀：仙鹤立黑岩 ×2 —— 月亮湖水域旁边（湖心沿小径外侧两点）
  const craneAngles = [0.6, 3.4]; // 湖心方位角：东南岸 / 西岸
  const craneR = LAKE.pathOuter + 0.8; // 紧贴小径外缘，临水而立
  for (const a of craneAngles) {
    const x = LAKE.x + Math.cos(a) * craneR + (rnd() - 0.5) * 0.4;
    const z = LAKE.z + Math.sin(a) * craneR + (rnd() - 0.5) * 0.4;
    if (!isClear(x, z)) continue;
    const obj = createCraneOnRock();
    placeObjectOnSphere(obj, x, z, groundLiftAt(x, z), planetRadius);
    obj.rotateY(rnd() * Math.PI * 2);
    scene.add(obj);
    meshes.push(obj);
    pushCollider(colliders, obj);
  }

  // 驿站山脊（北脊土坡）上再来几棵古松，引导视线
  for (const [x, z] of [[-1.5, -13.2], [1.6, -11.4], [0.2, -13.6]]) {
    if (!isClear(x, z)) continue;
    const obj = createAncientPineTree();
    placeObjectOnSphere(obj, x, z, groundLiftAt(x, z), planetRadius);
    obj.scale.multiplyScalar(0.55 + rnd() * 0.15); // 高台树稍小，避免压迫
    scene.add(obj);
    meshes.push(obj);
    pushCollider(colliders, obj);
  }

  // 街道资产：路牌 / 街灯 / 电线杆
  const streetMake = {
    sign: createLowPolySignpost,
    lamp: createLowPolyStreetLamp,
    pole: createLowPolyUtilityPole,
  };
  for (const { make, xz } of ISLAND_LAYOUT.street) {
    const [sx, sz] = xz;
    const x = sx + (rnd() - 0.5) * 0.4;
    const z = sz + (rnd() - 0.5) * 0.4;
    if (!isClear(x, z)) continue;
    const factory = streetMake[make];
    if (!factory) continue;
    const obj = factory();
    placeObjectOnSphere(obj, x, z, groundLiftAt(x, z), planetRadius);
    obj.rotateY(rnd() * Math.PI * 2);
    scene.add(obj);
    meshes.push(obj);
    pushCollider(colliders, obj);
  }

  return { meshes, colliders };
}
