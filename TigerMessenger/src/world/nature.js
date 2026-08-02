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
} from "../assets/lowPoly.js";
import { placeObjectOnSphere } from "./sphereMath.js";
import { QUEST_DEFS } from "../quest/questSystem.js";

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
  const defs = [
    [createLowPolyTree, 24],
    [createLowPolyRock, 10],
    [
      () =>
        createLowPolyFlower(
          [0xff88aa, 0xffe08a, 0xc9a8ff, 0x9ec5ff][(rnd() * 4) | 0]
        ),
      16,
    ],
    [createLowPolyHouse, 3],
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
 * 游玩区场景布局（手工排布，非随机）：主岛小村庄。
 *  - 房子 ×3 聚在出生点东北成村；树沿岛缘成环 + 院内点缀
 *  - 花草沿路成簇；岩石点缀；全部避开 NPC 收发点与出生点
 *  - 平台/任务布局不动（关卡本体）
 */
const ISLAND_LAYOUT = {
  houses: [
    [6.5, 7.5], // 村东
    [-5, 8.5], // 村西北
    [9, -1], // 村南
  ],
  trees: [
    [-2, 14.5], [4, 13.8], [10.5, 10], // 北缘
    [13.5, 4], [15, -6], [11, -9], // 东缘
    [-13, 6], [-14, 0], [-12, -7], // 西缘
    [-6, -11], [3, -14], // 南缘
    [-3, 11], // 院内点缀
  ],
  rocks: [
    [-9, 12], [12, 8], [-14.5, -3],
  ],
  flowers: [
    [5.5, 6.5], [7.2, 6.2], [-4, 7], [-6, 9.5], [8.5, 1.5],
    [3, 12], [-8, 3], [1, -9], [-4, -6], [10, -5],
  ],
  // 街拍感：路牌 / 街灯 / 电线杆（主岛路边）
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
  const isClear = (x, z) =>
    keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.r);

  const flowerCols = [0xff88aa, 0xffe08a, 0xc9a8ff, 0x9ec5ff];
  const groups = [
    [createLowPolyHouse, ISLAND_LAYOUT.houses, 0.95],
    [createLowPolyTree, ISLAND_LAYOUT.trees, 1.0],
    [createLowPolyRock, ISLAND_LAYOUT.rocks, 0.95],
    [() => createLowPolyFlower(flowerCols[(rnd() * 4) | 0]), ISLAND_LAYOUT.flowers, 1.0],
  ];

  for (const [make, spots, scaleBase] of groups) {
    for (const [sx, sz] of spots) {
      // 小幅抖动避免机械感；越界/压点则跳过该点
      const x = sx + (rnd() - 0.5) * 0.8;
      const z = sz + (rnd() - 0.5) * 0.8;
      if (!isClear(x, z)) continue;
      const obj = make();
      placeObjectOnSphere(obj, x, z, 0.6, planetRadius); // 主岛台面抬升 0.6
      obj.rotateY(rnd() * Math.PI * 2);
      obj.scale.multiplyScalar(scaleBase * (0.9 + rnd() * 0.2));
      scene.add(obj);
      meshes.push(obj);
      pushCollider(colliders, obj);
    }
  }

  // 驿站高台（[0,2,-12]，5x4）上再来几棵，引导视线
  for (const [x, z] of [[-1.5, -13.2], [1.6, -11.4], [0.2, -13.6]]) {
    if (!isClear(x, z)) continue;
    const obj = createLowPolyTree();
    placeObjectOnSphere(obj, x, z, 2.0, planetRadius);
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
    placeObjectOnSphere(obj, x, z, 0.6, planetRadius);
    obj.rotateY(rnd() * Math.PI * 2);
    scene.add(obj);
    meshes.push(obj);
    pushCollider(colliders, obj);
  }

  return { meshes, colliders };
}
