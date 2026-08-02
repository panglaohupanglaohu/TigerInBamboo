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
      obj.scale.setScalar(0.85 + rnd() * 0.4);
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
    obj.scale.setScalar(0.8 + rnd() * 0.8);
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
 * 游玩区可见范围点缀：直接撒在主岛台面（平面设计坐标），
 * 避让 NPC 与出生点；玩家出生即可见植物/房屋。
 */
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
  const defs = [
    [createLowPolyTree, 10],
    [createLowPolyHouse, 3],
    [createLowPolyRock, 6],
    [() => createLowPolyFlower(flowerCols[(rnd() * 4) | 0]), 10],
  ];
  for (const [make, count] of defs) {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const ang = rnd() * Math.PI * 2;
        const rad = 3.5 + rnd() * 12.5; // 主岛半径 ~16.5，留边缘余量
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        if (!isClear(x, z)) continue;
        const obj = make();
        placeObjectOnSphere(obj, x, z, 0.6, planetRadius); // 主岛台面抬升 0.6
        obj.rotateY(rnd() * Math.PI * 2);
        obj.scale.setScalar(0.85 + rnd() * 0.35);
        scene.add(obj);
        meshes.push(obj);
        pushCollider(colliders, obj);
        break;
      }
    }
  }

  // 驿站高台（[0,2,-12]，5x4）上再来几棵，引导视线
  for (let i = 0; i < 3; i++) {
    const x = -1.8 + rnd() * 3.6;
    const z = -13.4 + rnd() * 2.8;
    if (!isClear(x, z)) continue;
    const obj = createLowPolyTree();
    placeObjectOnSphere(obj, x, z, 2.0, planetRadius);
    obj.scale.setScalar(0.8 + rnd() * 0.3);
    scene.add(obj);
    meshes.push(obj);
    pushCollider(colliders, obj);
  }
  return { meshes, colliders };
}
