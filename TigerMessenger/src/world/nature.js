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

import { QUEST_DEFS } from "../quest/questSystem.js";
import { groundLiftAt } from "./hills.js";
import { isInsideSaihojiReserve } from "./saihoji.js";
import { WORLD_SCALE } from "./worldScale.js";

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
  // 原「背侧大湖水域净空」判定已移除：该湖已删除，此处不再需要避让水面。
  const _d = new THREE.Vector3();
  // 远侧同步水墨色系（沉绿树 / 焦墨岩 / 低饱和花）
  // 第三位 = settle 标记：地形后建（苔丘等）可能埋住资产，加载收尾时重新落地
  const defs = [
    // 古松已集中到西芳寺（正常尺寸）；远侧不再散点缩小松
    [createLowPolyRock, 10, true, 1],
    // 水墨花已清理（用户认为花模型不好看）
    [createLowPolyHouse, 0, undefined, 1], // 房屋已删除；工厂已水墨化备用
  ];
  for (const [make, count, settle, extraScale = 1] of defs) {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const lat = -20 + rnd() * 65;
        const lon = rnd() * 360 - 180;
        if (isInsideSaihojiReserve(lat, lon, 2.2)) continue;
        latLonToDir(lat, lon, _d);
        const obj = placeOnSphere(make(), lat, lon, planetRadius);
        obj.rotateY(rnd() * Math.PI * 2);
        obj.scale.multiplyScalar(0.85 + rnd() * 0.4);
        obj.scale.multiplyScalar(extraScale);
        if (settle) obj.userData.settle = true;
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
  houses: { count: 0, minGap: 8.0 * WORLD_SCALE, gapVsHouse: 8.0 * WORLD_SCALE, ring: [5 * WORLD_SCALE, 12 * WORLD_SCALE], scale: [0.9, 1.05] },
  // 古松已集中到西芳寺（正常尺寸）；主岛游玩区不再随机缩小松
  trees: { count: 0, minGap: 4.0 * WORLD_SCALE, gapVsHouse: 4.5 * WORLD_SCALE, ring: [3.5 * WORLD_SCALE, 15.5 * WORLD_SCALE], scale: [1, 1] },
  rocks: { count: 4, minGap: 5.0 * WORLD_SCALE, gapVsHouse: 3.5 * WORLD_SCALE, ring: [5 * WORLD_SCALE, 15 * WORLD_SCALE], scale: [0.8, 1.2] },
  flowers: { count: 0, minGap: 2.5 * WORLD_SCALE, gapVsHouse: 2.5 * WORLD_SCALE, ring: [3 * WORLD_SCALE, 14 * WORLD_SCALE], scale: [0.9, 1.2] }, // 水墨花已清理
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
  keepClear.push({ x: 0, z: 6 * WORLD_SCALE, r: 4 * WORLD_SCALE }); // 出生点
  // 起始庭园由 startGarden.js 提供固定景物；随机资产不得穿进池水/瀑布构图。
  keepClear.push({ x: 0, z: 9.5 * WORLD_SCALE, r: 7.0 * WORLD_SCALE });
  const isClear = (x, z) =>
    keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.r);

  const groups = [
    ["houses", createLowPolyHouse], // 工厂水墨化；count=0 不摆
    // trees 已迁西芳寺（LAYOUT_RULES.trees.count=0）
    ["rocks", createLowPolyRock], // 焦墨岩
    // 水墨花已清理（用户认为花模型不好看）：flowers 组移除
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
        if (kind === "trees" || kind === "rocks") obj.userData.settle = true;
        scene.add(obj);
        meshes.push(obj);
        pushCollider(colliders, obj);
        placedSame.push({ x, z });
        if (kind === "houses") placedHouses.push({ x, z });
        break;
      }
    }
  }

  // 驿站北脊古松已并入西芳寺集中布置（正常尺寸）

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

/**
 * 安置沉降 pass（全部地形建完后调用）：把标记 userData.settle 的资产
 * （树/石）沿径向射线找回真实地表，被埋的抬到面上、悬空的下落到面上。
 * 修复：苔丘/书店土坡/营地等后建地形埋住先种的树；丘陵被轨道走廊
 * 压平后岩石悬空。只认地形类网格，不会把树抬到电车/建筑上。
 * @param {THREE.Scene} scene
 * @param {{position: THREE.Vector3, radius: number}[]} [colliders] 同步更新的碰撞体列表
 * @returns {number} 移动的资产数
 */
export function settleBuriedAssets(scene, colliders = []) {
  const targets = [];
  scene.traverse((o) => {
    if (o.userData?.settle) targets.push(o);
  });
  if (!targets.length) return 0;
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const _up = new THREE.Vector3();
  const _origin = new THREE.Vector3();
  const _down = new THREE.Vector3();
  const TERRAIN_RE = /hill|mossy|berm|soil|ground|island|camp|platform|skirt|terrain/;
  // 只对 Mesh 射线：Sprite 在无 camera 时 raycast 会抛
  // 「Raycaster.camera needs to be set」并读 null.matrixWorld 导致启动失败。
  const meshCandidates = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSprite) return;
    if (!o.visible) return;
    // 跳过描边壳 / 半透明特效，减少误命中
    if (o.userData?.isOutline) return;
    meshCandidates.push(o);
  });
  let moved = 0;
  for (const obj of targets) {
    _up.copy(obj.position).normalize();
    const baseR = obj.position.length();
    _origin.copy(_up).multiplyScalar(baseR + 14);
    _down.copy(_up).negate();
    ray.set(_origin, _down);
    ray.far = 20;
    const hits = ray.intersectObjects(meshCandidates, false);
    let surfaceR = null;
    for (const h of hits) {
      let o = h.object;
      let self = false;
      let nm = "";
      while (o) {
        if (o === obj) { self = true; break; }
        if (o.name && !nm) nm = o.name;
        o = o.parent;
      }
      if (self) continue;
      if (!TERRAIN_RE.test(nm.toLowerCase())) continue;
      // 营地薄装饰色块（沙滩/浅海，lift 低于岛面）不作地表，否则会把树压到色块下
      if (h.object.name === "camp-flat-patch") continue;
      surfaceR = h.point.length(); // 径向最高地表 = 该处的“地面”
      break;
    }
    if (surfaceR === null) continue;
    const delta = surfaceR + 0.02 - baseR;
    if (Math.abs(delta) < 0.06) continue; // 已贴地，不动
    if (delta > 6 || delta < -3) continue; // 异常值安全网（防误抬上高空/沉入球体）
    const oldPos = obj.position.clone();
    obj.position.addScaledVector(_up, delta);
    obj.updateMatrixWorld(true);
    // 同步最近的碰撞体（碰撞表在 load 早期已克隆坐标）
    let best = null;
    let bestD = 0.8;
    for (const c of colliders) {
      const d = c.position.distanceTo(oldPos);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) best.position.copy(obj.position);
    moved++;
  }
  return moved;
}
