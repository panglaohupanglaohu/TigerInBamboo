// =====================================================================
//  自然点缀（从星球实验页并入主游戏）：远侧 toon 资产 + 漂移云环
//  游玩区在北极附近（lat ≥ ~55°），装饰放在远侧，纯视觉无碰撞
// =====================================================================
import * as THREE from "three";
import {
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
import { placeObjectOnSphere, latLonToDir } from "./sphereMath.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { GREAT_LAKE } from "./lake.js";
import { QUEST_DEFS } from "../quest/questSystem.js";
import { groundLiftAt } from "./hills.js";
import { isInsideSaihojiReserve } from "./saihoji.js";

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 远侧（lat -20°..45°）点缀树/岩/花/房：装饰 + 碰撞体（背侧大湖水域净空） */
export function decorateFarSide(scene, planetRadius, seed = 20260802) {
  const rnd = lcg(seed);
  const meshes = [];
  const colliders = [];
  // 背侧大湖方向（水域不放资产）
  const lakeDir = latLonToDir(GREAT_LAKE.lat, GREAT_LAKE.lon, new THREE.Vector3());
  const lakeClear = GREAT_LAKE.angR + 0.1;
  const _d = new THREE.Vector3();
  // 远侧同步水墨色系（沉绿树 / 焦墨岩 / 低饱和花）
  const defs = [
    // 远侧也统一使用截图 1 的横向云片古松，避免再出现截图 2 的锥形树。
    [createAncientPineTree, 12],
    [createLowPolyRock, 10],
    [
      () => createLowPolyFlower(INK_FLOWER_COLORS[(rnd() * INK_FLOWER_COLORS.length) | 0]),
      16,
    ],
    [createLowPolyHouse, 0], // 房屋已删除；工厂已水墨化备用
  ];
  for (const [make, count] of defs) {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const lat = -20 + rnd() * 65;
        const lon = rnd() * 360 - 180;
        if (isInsideSaihojiReserve(lat, lon, 2.2)) continue;
        latLonToDir(lat, lon, _d);
        if (_d.angleTo(lakeDir) < lakeClear) continue; // 落在湖里，重采
        const obj = placeOnSphere(make(), lat, lon, planetRadius);
        obj.rotateY(rnd() * Math.PI * 2);
        obj.scale.multiplyScalar(0.85 + rnd() * 0.4);
        scene.add(obj);
        meshes.push(obj);
        pushCollider(colliders, obj);
        break;
      }
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

/**
 * 云环：多样形态/色调/高度层，updateClouds 驱动漂移
 * @param {number} [opts.count=16] 朵数（比原先更密一点）
 * @param {number} [opts.height=8] 基准离地高度
 */
export function createCloudRing(scene, planetRadius, { count = 16, height = 8, seed = 7 } = {}) {
  const rnd = lcg(seed);
  const clouds = [];
  const styles = ["puff", "streak", "wispy", "stack", "anvil"];
  for (let i = 0; i < count; i++) {
    // 多层高度：低掠云 / 中层 / 高薄云
    const band = rnd();
    const hOff =
      band < 0.35 ? -2 + rnd() * 2 : band < 0.75 ? 1 + rnd() * 4 : 5 + rnd() * 6;
    const lat = 12 + rnd() * 72; // 更宽纬度带
    const lon = rnd() * 360 - 180;
    const style = styles[i % styles.length]; // 轮转保证五形态都出现
    const cloudSeed = (seed * 997 + i * 131) >>> 0;
    const obj = placeOnSphere(
      createLowPolyCloud({ seed: cloudSeed, style }),
      lat,
      lon,
      planetRadius + height + hOff
    );
    obj.rotateY(rnd() * Math.PI * 2);
    // 尺度跨度更大：小絮 → 大积云
    const sc =
      style === "wispy"
        ? 0.55 + rnd() * 0.55
        : style === "anvil" || style === "stack"
          ? 1.1 + rnd() * 1.1
          : style === "streak"
            ? 0.9 + rnd() * 1.2
            : 0.7 + rnd() * 0.95;
    obj.scale.multiplyScalar(sc);
    obj.userData.drift = {
      axis: new THREE.Vector3(rnd() - 0.5, rnd() * 0.4 + 0.6, rnd() - 0.5).normalize(),
      speed: 0.03 + rnd() * 0.1,
      bobAmp: 0.2 + rnd() * 0.55,
      bobSpeed: 0.3 + rnd() * 0.75,
      phase: rnd() * Math.PI * 2,
      baseR: planetRadius + height + hOff,
      style,
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
  trees: { count: 8, minGap: 4.0, gapVsHouse: 4.5, ring: [3.5, 15.5], scale: [0.85, 1.15] },
  rocks: { count: 4, minGap: 5.0, gapVsHouse: 3.5, ring: [5, 15], scale: [0.8, 1.2] },
  flowers: { count: 12, minGap: 2.5, gapVsHouse: 2.5, ring: [3, 14], scale: [0.9, 1.2] },
};

// 起始视角改为庭园构图，主岛不再随机生成街灯、电线杆等现代街道资产。
const ISLAND_LAYOUT = {
  street: [],
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
  // 起始庭园由 startGarden.js 提供固定景物；随机资产不得穿进池水/瀑布构图。
  keepClear.push({ x: 0, z: 9.5, r: 7.0 });
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

  // 驿站山脊（北脊土坡）上再来几棵古松，引导视线
  for (const [x, z] of [[-1.5, -13.2], [1.6, -11.4]]) {
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
