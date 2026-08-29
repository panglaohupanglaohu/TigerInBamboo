// =====================================================================
// Local highland citadel hero clouds.  The planet-V8 impostor compiler pins
// clusters to geodesic landmarks; the player standing at the obelisk is on
// the authored mountain-valley citadel.  This module places the same catalog
// (cap / ring / forest scatter) in citadel-local XZ, hugging the continuous
// mountain grid, and parents the impostor mesh to the castle group.
// =====================================================================

import { HERO_CLOUD_SPECS } from "../render/clouds/heroCloudCatalog.js?v=shared-impostor-s12-v1";
import { createCloudImpostorSystem } from "../render/clouds/cloudImpostorSystem.js?v=shared-impostor-s12-v1";
import { highlandTerrainSurfaceHeight } from "./highlandCitadelDesign.js?v=20260828-reference-light-v9";

const RIDGE_PEAKS = Object.freeze([
  Object.freeze([0, -34]),
  Object.freeze([49, -18]),
  Object.freeze([-48, -13]),
]);

function lerp(a, b, t) { return a + (b - a) * t; }
function mix2(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
function hypot2(x, z) { return Math.hypot(x, z); }

function cardJitter(index, [min, max], salt = 0) {
  const t = ((Math.imul(index + 1 + salt, 2654435761) >>> 0) / 4294967296);
  return min + t * (max - min);
}

function occupiesCastle(x, z) {
  return Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5) < 1.05;
}

function blocksCastleView(x, z, y) {
  if (occupiesCastle(x, z) && y < 38) return true;
  // 湖面上方（z > 24）是开阔水面，低空云不挡城堡视野，允许存在
  if (z > 24) return false;
  return z > -6 && Math.abs(x) < 16 && y < 40;
}

function bakeLocalPath(x, z, y, { tangentX = 1, tangentZ = 0, lift = 0.6, clearance = 0.9, span = 7 } = {}) {
  const points = [];
  for (let index = 0; index < 10; index++) {
    const t = index / 9;
    const centered = t - 0.5;
    const roll = Math.sin(t * Math.PI);
    const px = x + tangentX * centered * span;
    const pz = z + tangentZ * centered * span;
    const terrain = highlandTerrainSurfaceHeight(px, pz);
    const py = Math.max(y, terrain + clearance) + roll * lift;
    points.push({
      position: [px, py, pz],
      direction: [0, 1, 0],
      altitude: py,
      terrainHeight: terrain,
      terrainClearance: clearance,
      lift,
      curl: 0,
    });
  }
  return points;
}

function makeInstance({
  id, role, spec, x, z, y, scale, lowLayer = false, hugRidge = false, climateBand, type, shape = "cloud",
}) {
  // S12: tree canopies share the impostor pipeline with the clouds.  Their
  // path is a single static point (no drift, no altitude roll), so the
  // billboard stays planted while the cloud cards keep floating.
  const pathPoints = shape === "canopy"
    ? Array.from({ length: 10 }, () => ({
        position: [x, y, z],
        direction: [0, 1, 0],
        altitude: y,
        terrainHeight: y - 0.8,
        terrainClearance: 0.8,
        lift: 0,
        curl: 0,
      }))
    : bakeLocalPath(x, z, y, {
        tangentX: role === "cap" ? 0.92 : 1,
        tangentZ: role === "cap" ? 0.38 : 0,
        lift: hugRidge ? 0.35 : 0.7,
        clearance: hugRidge ? 0.45 : 0.9,
        span: hugRidge ? 11 : 6,
      });
  const phase = cardJitter(id.length, [0, 1], role.length);
  return {
    cellIndex: id,
    cartesian: true,
    position: [x, y, z],
    anchor: [0, 1, 0],
    altitude: y,
    type,
    climateBand,
    cloudBase: y,
    lowLayer,
    chainBand: role === "forest-scatter" || shape === "canopy" ? null : "highland-citadel",
    oceanFetch: 0.72,
    slope: 0.5,
    windward: 0.64,
    rainShadow: 0.12,
    humidity: 0.58,
    pathPoints,
    ridgeTangent: [0.92, 0, 0.38],
    terrainClearance: hugRidge ? 0.45 : 0.9,
    lift: hugRidge ? 0.35 : 0.7,
    landformClass: "volcanic-snow-massif",
    scale,
    rotation: phase * Math.PI * 2,
    inDir: [1, 0, 0],
    outDir: [0, 0, 1],
    timeOffset: shape === "canopy" ? 0.5 : phase,
    speed: shape === "canopy" ? 0 : spec.driftSpeed,
    phase: shape === "canopy" ? 0.5 : phase,
    shape,
    cameraKeepout: false,
    lod: role === "cap" ? "cluster-detail" : "octa-impostor",
    shadowMode: "projected-low-resolution",
    authored: true,
    heroRole: role,
    landmarkId: "highland-citadel",
    hugRidge,
    dayPhaseWeight: spec.dayPhaseWeight,
    source: "hero-landmark-local",
  };
}

export function compileHighlandLocalHeroClouds({ spec = HERO_CLOUD_SPECS.highlandCitadel, radius = 160 } = {}) {
  const peakHeights = RIDGE_PEAKS.map(([x, z]) => highlandTerrainSurfaceHeight(x, z, radius));
  const peakHeight = Math.max(...peakHeights);
  // 主人验收（2026-08-26）：默认视角（湖岸看向城堡）看不到贴峰顶的 cap 云
  // （被城堡/山峰遮挡）。cap 移到城堡正上方（本地 x=0,z=0，城堡高 36，
  // 云底 y=43）——默认镜头直接可见一朵大白云；山腰 ring 云海保持。
  const capX = 0;
  const capZ = 0;
  // cap 在城堡正上方（城堡顶 36 上方 2u），scale 加大到 26——飞艇/地面
  // 平视视角均可见（Sprite 面向相机）。
  const capY = 38;
  const instances = [];
  instances.push(makeInstance({
    id: "hero:highland-citadel:local-cap",
    role: "cap",
    spec,
    x: capX,
    z: capZ,
    y: capY,
    scale: spec.cardWorldScale * spec.capCard.scale * 1.45,
    hugRidge: false,
    climateBand: "snowline-crown",
    type: "orographic",
  }));
  // 2026-08-27 飞艇验收：ring「山腰云海」原先 10 朵、scale 5–9、高度
  // 33–42（低于主峰 60，北侧被挡）→ 改为 18 朵、scale 8.6–14、高度
  // 0.52–0.88×peakHeight（≈31–53，主峰方向的云抬到山峰以上），
  // 形成环绕城堡的可见云海带。
  const ringRadius = (spec.ringRadiusRatio ?? 0.62) * 90;
  // 2026-08-27 云海重做：ring 24 朵 + 半径 ±6 微扰 → 相邻云重叠成
  // 环绕山腰的连续云海带（飞艇鸟瞰可见成片白云），不再是稀疏单朵。
  const RING_COUNT = 32;
  for (let index = 0; index < RING_COUNT; index++) {
    const azimuth = index / RING_COUNT * Math.PI * 2;
    const rr = ringRadius + (cardJitter(index, [0, 1], 53) - 0.5) * 12;
    // 2026-08-27 云海重做：ring 改圆形环（原 z 椭圆压缩 + 中心 -16 导致
    // 前方云贴城堡半径仅 13–20）。中心 (0,-10)、半径均匀，全部在 45–66。
    const x = Math.cos(azimuth) * rr;
    const z = -10 + Math.sin(azimuth) * rr;
    const towardCap = Math.max(0, 1 - hypot2(x - capX, z - capZ) / 80);
    // 主峰在北侧（z 负），其方向的 ring 抬到山峰以上避免遮挡
    const northBoost = z < -20 ? 0.16 : 0;
    const heightRatio = 0.52
      + (0.88 - 0.52) * cardJitter(index, [0, 1], 17)
      + towardCap * 0.1
      + northBoost;
    const y = peakHeight * heightRatio;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-ring:${index}`,
      role: "ring",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 0.9),
      scale: spec.cardWorldScale * cardJitter(index, [1.2, 1.95], 9),
      climateBand: "snowline-crown",
      type: "orographic",
    }));
  }
  // 2026-08-27 飞艇验收：城堡正上方 cap 之外，再加两组低空云——
  // ① 城堡环云：紧贴城堡上空（半径 18，y=38），飞艇环绕城堡时平视可见；
  // ② 内环云：城堡外 32–44、高度 22–34（飞艇巡航常见高度带），
  //    任何飞艇高度在水平方向都能看到白云。
  for (let index = 0; index < 4; index++) {
    const azimuth = index / 4 * Math.PI * 2 + 0.6;
    const x = Math.cos(azimuth) * 18;
    const z = Math.sin(azimuth) * 18;
    const y = 38;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-castle-cloud:${index}`,
      role: "castle-cloud",
      spec,
      x,
      z,
      y,
      scale: spec.cardWorldScale * 1.55,
      climateBand: "snowline-crown",
      type: "fair-weather",
    }));
  }
  for (let index = 0; index < 8; index++) {
    const azimuth = index / 8 * Math.PI * 2 + 1.1;
    const r = 32 + cardJitter(index, [0, 1], 31) * 12;
    const x = Math.cos(azimuth) * r;
    const z = -6 + Math.sin(azimuth) * r * 0.85;
    const y = 22 + cardJitter(index, [0, 1], 29) * 12;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-inner-cloud:${index}`,
      role: "inner-cloud",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 1.2),
      scale: spec.cardWorldScale * (0.9 + cardJitter(index, [0, 1], 13) * 0.5),
      climateBand: "open-sky-edge",
      type: "fair-weather",
    }));
  }
  // 2026-08-27 飞艇验收：云必须出现在山脉轮廓外的天空——原布局全部在
  // 半径 ≤56 内（山脉范围内）。新增外环云：半径 74–108（山脉外缘/海上），
  // 高度 46–68（高空的云），飞艇视角在山脉轮廓外可见成片白云。
  for (let index = 0; index < 20; index++) {
    const azimuth = index / 20 * Math.PI * 2 + 0.35;
    const r = 72 + cardJitter(index, [0, 1], 37) * 36;
    const x = Math.cos(azimuth) * r;
    const z = -4 + Math.sin(azimuth) * r * 0.82;
    const y = 46 + cardJitter(index, [0, 1], 43) * 22;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-outer-cloud:${index}`,
      role: "outer-cloud",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 1.5),
      scale: spec.cardWorldScale * (1.15 + cardJitter(index, [0, 1], 21) * 0.55),
      climateBand: "open-sky-edge",
      type: "fair-weather",
    }));
  }
  // 2026-08-27 全高度云带：低空云（湖面上方 y 16–24，飞艇低空平视可见）
  // + 高空云（半径 65–95、y 62–78，飞艇爬升到顶时俯视/平视可见）——
  // 与 cap/castle/inner/ring/outer 一起覆盖 y 16–78 全带，任何飞艇高度
  // 都有白云在视野内。
  for (let index = 0; index < 8; index++) {
    const x = -24 + (index % 4) * 14;
    const z = 26 + Math.floor(index / 4) * 16;
    const y = 16 + cardJitter(index, [0, 1], 59) * 8;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-low-cloud:${index}`,
      role: "low-cloud",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 1.5),
      scale: spec.cardWorldScale * (1.1 + cardJitter(index, [0, 1], 61) * 0.5),
      climateBand: "open-sky-edge",
      type: "fair-weather",
    }));
  }
  for (let index = 0; index < 8; index++) {
    const azimuth = index / 8 * Math.PI * 2 + 0.8;
    const r = 66 + cardJitter(index, [0, 1], 67) * 30;
    const x = Math.cos(azimuth) * r;
    const z = -4 + Math.sin(azimuth) * r * 0.85;
    const y = 62 + cardJitter(index, [0, 1], 71) * 16;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-high-cloud:${index}`,
      role: "high-cloud",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 2),
      scale: spec.cardWorldScale * (1.2 + cardJitter(index, [0, 1], 73) * 0.5),
      climateBand: "snowline-crown",
      type: "fair-weather",
    }));
  }
  const forest = spec.forestScatter;
  if (forest?.count > 0) {
    for (let index = 0; index < forest.count; index++) {
      const x = -32 - index * 6;
      const z = -8 + index * 3;
      const y = peakHeight * lerp(forest.heightBand[0], forest.heightBand[1], cardJitter(index, [0, 1], 23));
      if (blocksCastleView(x, z, y)) continue;
      instances.push(makeInstance({
        id: `hero:highland-citadel:local-forest:${index}`,
        role: "forest-scatter",
        spec,
        x,
        z,
        y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 0.7),
        scale: spec.cardWorldScale * forest.scale,
        lowLayer: true,
        climateBand: "open-sky-edge",
        type: "fair-weather",
      }));
    }
  }
  // S12: tree canopies share the impostor pipeline with the clouds.  A ring
  // of canopy cards hugs the citadel foothills — same atlas, same shader
  // family, same draw call as the cloud-sea frame above the ridge.
  const canopy = spec.canopyScatter ?? {
    count: 10,
    minRadius: 30,
    maxRadius: 58,
    scale: 0.42,
    scaleJitter: [0.9, 1.2],
    heightLift: 0.35,
  };
  if (canopy.count > 0) {
    for (let index = 0; index < canopy.count; index++) {
      const azimuth = index / canopy.count * Math.PI * 2 + 0.7;
      const ringRadius = canopy.minRadius
        + (canopy.maxRadius - canopy.minRadius) * cardJitter(index, [0, 1], 41);
      const x = Math.cos(azimuth) * ringRadius;
      const z = -10 + Math.sin(azimuth) * ringRadius * 0.8;
      const terrain = highlandTerrainSurfaceHeight(x, z, radius);
      const y = terrain + canopy.heightLift;
      if (blocksCastleView(x, z, y)) continue;
      instances.push(makeInstance({
        id: `hero:highland-citadel:local-canopy:${index}`,
        role: "canopy-scatter",
        shape: "canopy",
        spec,
        x,
        z,
        y,
        scale: spec.cardWorldScale * canopy.scale * cardJitter(index, canopy.scaleJitter, 7),
        lowLayer: true,
        climateBand: "open-sky-edge",
        type: "tree-canopy",
      }));
    }
  }
  return {
    kind: "highland-local-hero-clouds-v1",
    instances,
    instanceCount: instances.length,
    heroCount: instances.length,
    peakHeight,
    cap: { x: capX, z: capZ, y: instances[0].position[1] },
  };
}

// =====================================================================
// 体积云团（主人验收 2026-08-27 重做）： impostor 卡片云形状雷同、有卡格
// 纹、无风感——替换为合体几何的卡通体积云团：
//   · 形状多样：每团由确定种子布置的 5–10 个噪声扰动球泡融合，姿态/
//     非均匀缩放各异，剪影互不相同；
//   · 气候性：迎风坡（x<0）云低且厚、背风坡（x>0）云高且薄、主峰
//     雪线冠云、湖面低空 fair-weather、山脉外缘高空云；
//   · 沿山脉分布：山脊簇沿 RIDGE_PEAKS 切向拉长并贴 terrain 顶面；
//   · 流动感/聚散感：update(t) 沿风矢漂移（越界回绕）、整团缓慢
//     涨缩（聚/散）+ 起伏 + 慢自转。
// =====================================================================

function clusterRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const CLOUD_COLOR_TOP = [0.972, 0.984, 0.992];
const CLOUD_COLOR_BOTTOM = [0.702, 0.776, 0.827];

function mergePuffGeometries(THREE, target, puff) {
  const { geometry, offsetX, offsetY, offsetZ, tint } = puff;
  const pos = geometry.getAttribute("position");
  const base = target.positions.length / 3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offsetX;
    const y = pos.getY(i) + offsetY;
    const z = pos.getZ(i) + offsetZ;
    target.positions.push(x, y, z);
    // 顶点色：泡体上部亮白、底部青灰（flat 体积感），tint 做团间微差
    const t = THREE.MathUtils.clamp(y / 1.6 + 0.5, 0, 1);
    target.colors.push(
      lerp(CLOUD_COLOR_BOTTOM[0], CLOUD_COLOR_TOP[0], t) * tint,
      lerp(CLOUD_COLOR_BOTTOM[1], CLOUD_COLOR_TOP[1], t) * tint,
      lerp(CLOUD_COLOR_BOTTOM[2], CLOUD_COLOR_TOP[2], t) * tint
    );
  }
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i++) target.indices.push(base + index.getX(i));
  } else {
    for (let i = 0; i < pos.count; i++) target.indices.push(base + i);
  }
}

/** 一团体积云的融合几何：puffs 个噪声扰动的低多边形球泡，横向铺开。 */
function buildCloudBlobGeometry(THREE, seed, puffCount, spread, rBase) {
  const rng = clusterRng(seed);
  const target = { positions: [], colors: [], indices: [] };
  for (let i = 0; i < puffCount; i++) {
    const r = rBase * (0.5 + rng() * 0.7);
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const pos = geo.getAttribute("position");
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v), vy = pos.getY(v), vz = pos.getZ(v);
      // 确定性噪声扰动：破开球面规整感（去网格纹的关键之一）
      const bump = 1
        + Math.sin(vx * 2.3 + seed) * 0.07
        + Math.cos(vy * 1.9 + seed * 0.7) * 0.06
        + Math.sin(vz * 2.6 + seed * 1.3) * 0.05;
      pos.setXYZ(v, vx * bump, vy * bump * 0.82, vz * bump);
    }
    mergePuffGeometries(THREE, target, {
      geometry: geo,
      offsetX: (i - (puffCount - 1) / 2) * rBase * 0.95 * spread + (rng() - 0.5) * rBase * 0.7,
      offsetY: (rng() - 0.35) * rBase * 0.7,
      offsetZ: (rng() - 0.5) * rBase * 1.1,
      tint: 0.96 + rng() * 0.05,
    });
    geo.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(target.positions, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(target.colors, 3));
  merged.setIndex(target.indices);
  merged.computeVertexNormals();
  return merged;
}

const BLOB_CLOUD_WIND = { x: 0.42, z: 0.16 };

function wrapOffset(value, span) {
  const period = span * 2;
  return ((value % period) + period * 1.5) % period - span;
}

/**
 * 山脉气候布局：山脊簇沿 RIDGE_PEAKS 切向贴地；迎风厚、背风薄；
 * 外缘高空 + 湖面低空保住飞艇全高度带的可见性。
 */
function buildCloudClusterPlan({ radius = 160 } = {}) {
  const plan = [];
  const addCluster = (entry) => plan.push(entry);
  const peakHeights = RIDGE_PEAKS.map(([x, z]) => highlandTerrainSurfaceHeight(x, z, radius));
  const peakHeight = Math.max(...peakHeights);
  // cap：城堡正上方的大积云团（多泡融合，替代原单卡片）
  addCluster({
    id: "cap", role: "cap", x: 0, z: 0, y: 38,
    puffs: 9, spread: 1.7, rBase: 2.4, scale: 1.9,
    climate: "snowline-crown", locked: true,
  });
  // 山脊攀升链（主人验收 2026-08-28）：每条山脊从山脚向峰顶布置一串
  // 贴地云团——沿山脊背向上攀升（截图反馈：云不能飘在半空，要爬山）。
  RIDGE_PEAKS.forEach(([px, pz], ridgeIndex) => {
    const seed = 7301 + ridgeIndex * 131;
    const rng = clusterRng(seed);
    // 山脊方向：峰顶 → 城堡中轴反方向 = 下山方向；链从山脚排到峰顶
    const towardCenter = Math.hypot(px, pz + 10) > 1
      ? [(px) / Math.hypot(px, pz + 10), (pz + 10) / Math.hypot(px, pz + 10)]
      : [0, -1];
    const STEPS = 5;
    for (let k = 0; k < STEPS; k++) {
      const t = 0.18 + (k / (STEPS - 1)) * 0.72; // 0.18 山脚 → 0.9 近峰
      const x = px + towardCenter[0] * (1 - t) * 30 + (rng() - 0.5) * 5;
      const z = pz + 10 + towardCenter[1] * (1 - t) * 30 - 10 + (rng() - 0.5) * 5;
      const terrain = highlandTerrainSurfaceHeight(x, z, radius);
      if (terrain < 1.0) continue; // 山脊链不落水盆（贴地才有意义）
      const nearPeak = t > 0.7;
      addCluster({
        id: `ridge:${ridgeIndex}:${k}`, role: "ridge",
        x, z, y: Math.max(terrain + 2.4, 6.5), // 贴脊爬升（参考图云擦崖壁）
        puffs: nearPeak ? 6 : 4 + (k % 2), spread: nearPeak ? 1.8 : 1.4, rBase: nearPeak ? 1.8 : 1.4,
        scale: (nearPeak ? 1.45 : 1.0 + rng() * 0.4),
        climate: "snowline-crown", stretchAlongRidge: true,
      });
    }
  });
  // 侧坡贴崖低雾带（参考图 2026-08-28：云擦着崖壁/坡面）：西/南坡低空小团
  for (let i = 0; i < 12; i++) {
    const seed = 14341 + i * 53;
    const rng = clusterRng(seed);
    // 近山两侧带（探针：地形 ≥0.8 全通过），东西交替
    const west = i % 2 === 0;
    const x = (west ? -1 : 1) * (18 + rng() * 28);
    const z = -30 + rng() * 46;
    const terrain = highlandTerrainSurfaceHeight(x, z, radius);
    if (terrain < 0.8) continue;
    addCluster({
      id: `flank-mist:${i}`, role: "flank-mist",
      x, z, y: Math.max(terrain + 1.7, 5.2),
      puffs: 3 + (i % 2), spread: 1.15, rBase: 1.15, scale: 0.72 + rng() * 0.3,
      climate: "open-sky-edge",
    });
  }
  // 横穿城堡的云（主人验收 2026-08-28）：城堡正前方低空小团，随风漂移
  // 时会横穿城面——豁免 blocksCastleView 遮挡剔除。
  for (let i = 0; i < 3; i++) {
    const seed = 12721 + i * 67;
    const rng = clusterRng(seed);
    addCluster({
      id: `crossing:${i}`, role: "crossing",
      x: -15 + i * 14, z: 9 + (i % 2) * 6, y: 11.5 + rng() * 4,
      puffs: 4, spread: 1.25, rBase: 1.35, scale: 0.85 + rng() * 0.3,
      climate: "open-sky-edge", crossing: true,
    });
  }
  // 气候带：迎风（西 x<0）低厚、背风（东 x>0）高薄
  for (let i = 0; i < 4; i++) {
    const seed = 8821 + i * 97;
    const rng = clusterRng(seed);
    const x = -62 + rng() * 26;
    const z = -30 + rng() * 44;
    addCluster({
      id: `windward:${i}`, role: "windward",
      x, z, y: Math.max(highlandTerrainSurfaceHeight(x, z, radius) + 5.5, 24 + rng() * 10),
      puffs: 8, spread: 1.8, rBase: 2.0, scale: 1.5 + rng() * 0.5,
      climate: "orographic-windward",
    });
  }
  for (let i = 0; i < 3; i++) {
    const seed = 9377 + i * 83;
    const rng = clusterRng(seed);
    const x = 34 + rng() * 26;
    const z = -26 + rng() * 40;
    addCluster({
      id: `leeward:${i}`, role: "leeward",
      x, z, y: Math.max(highlandTerrainSurfaceHeight(x, z, radius) + 9, 44 + rng() * 14),
      puffs: 4, spread: 1.3, rBase: 1.3, scale: 0.85 + rng() * 0.35,
      climate: "rain-shadow",
    });
  }
  // 湖面低空 fair-weather（开阔水面上的小团）
  for (let i = 0; i < 3; i++) {
    const seed = 10429 + i * 71;
    const rng = clusterRng(seed);
    const x = -18 + rng() * 30;
    const z = 30 + rng() * 22;
    addCluster({
      id: `lake-low:${i}`, role: "lake-low",
      x, z, y: 17 + rng() * 8,
      puffs: 4, spread: 1.2, rBase: 1.2, scale: 0.8 + rng() * 0.3,
      climate: "open-sky-edge",
    });
  }
  // 山脉外缘/海上的高空云（轮廓之外的天空仍有云）
  for (let i = 0; i < 4; i++) {
    const seed = 11261 + i * 89;
    const rng = clusterRng(seed);
    const azimuth = (i / 4) * Math.PI * 2 + 0.45;
    const r = 74 + rng() * 30;
    const x = Math.cos(azimuth) * r;
    const z = -4 + Math.sin(azimuth) * r * 0.82;
    addCluster({
      id: `outer-high:${i}`, role: "outer-high",
      x, z, y: 50 + rng() * 20,
      puffs: 5, spread: 1.5, rBase: 1.8, scale: 1.15 + rng() * 0.45,
      climate: "open-sky-edge",
    });
  }
  return { plan, peakHeight };
}

function mountHighlandBlobClouds(THREE, citadel, { radius = 160 } = {}) {
  const { plan } = buildCloudClusterPlan({ radius });
  const group = new THREE.Group();
  group.name = "highland-hero-cloud-blobs";
  group.userData.kind = "highland-hero-clouds";
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });
  const clusters = [];
  plan.forEach((entry, index) => {
    // 横穿城堡的云豁免遮挡剔除（主人验收：云可以横穿城堡）
    if (!entry.locked && !entry.crossing && blocksCastleView(entry.x, entry.z, entry.y)) return;
    const seed = 31337 + index * 331;
    const geometry = buildCloudBlobGeometry(THREE, seed, entry.puffs, entry.spread, entry.rBase);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `highland-hero-cloud-blob-${entry.id}`;
    mesh.renderOrder = 6;
    mesh.userData.heroRole = entry.role;
    mesh.userData.climateBand = entry.climate;
    const rng = clusterRng(seed + 5);
    const scaleJitter = 0.9 + rng() * 0.25;
    const cluster = {
      mesh,
      base: { x: entry.x, y: entry.y, z: entry.z },
      scale: entry.scale * scaleJitter,
      stretch: entry.stretchAlongRidge ? { x: 1.25, z: 0.9 } : { x: 1, z: 1 },
      spanX: 9 + rng() * 9,
      spanZ: 7 + rng() * 7,
      speed: 0.6 + rng() * 0.9,
      phase: rng() * 100,
      bobAmp: 0.8 + rng() * 1.4,
      bobSpeed: 0.7 + rng() * 0.7,
      breathAmp: 0.05 + rng() * 0.06,
      breathSpeed: 0.6 + rng() * 0.8,
      spinDir: rng() > 0.5 ? 1 : -1,
      rot0: rng() * Math.PI * 2,
    };
    cluster.mesh.position.set(cluster.base.x, cluster.base.y, cluster.base.z);
    cluster.mesh.scale.set(
      cluster.scale * cluster.stretch.x,
      cluster.scale,
      cluster.scale * cluster.stretch.z
    );
    group.add(mesh);
    clusters.push(cluster);
  });
  group.userData.clusterCount = clusters.length;
  group.userData.update = (t) => {
    const time = Number.isFinite(t) ? t : 0;
    for (const cluster of clusters) {
      cluster.mesh.position.x = cluster.base.x + wrapOffset(cluster.phase + time * BLOB_CLOUD_WIND.x * cluster.speed, cluster.spanX);
      cluster.mesh.position.z = cluster.base.z + wrapOffset(cluster.phase * 0.7 + time * BLOB_CLOUD_WIND.z * cluster.speed, cluster.spanZ);
      cluster.mesh.position.y = cluster.base.y + Math.sin(time * 0.11 * cluster.bobSpeed + cluster.phase) * cluster.bobAmp;
      const breathe = 1 + Math.sin(time * 0.07 * cluster.breathSpeed + cluster.phase * 1.7) * cluster.breathAmp;
      cluster.mesh.scale.set(
        cluster.scale * cluster.stretch.x * breathe,
        cluster.scale * (2 - breathe),
        cluster.scale * cluster.stretch.z * breathe
      );
      cluster.mesh.rotation.y = cluster.rot0 + time * 0.012 * cluster.spinDir;
    }
  };
  citadel.add(group);
  citadel.userData.highlandCloudBlobs = group;
  return group;
}

export function mountHighlandLocalHeroClouds(THREE, citadel, { radius = 160 } = {}) {
  if (!THREE || !citadel) return null;
  const existing = citadel.getObjectByName("highland-hero-cloud-impostors");
  if (existing) {
    existing.removeFromParent();
    existing.geometry?.dispose?.();
    existing.material?.dispose?.();
  }
  const clusters = compileHighlandLocalHeroClouds({ radius });
  // 2026-08-27 云可见性修复（飞艇验收根因）：ShaderMaterial billboard 在
  // 实际 GPU 上渲染不稳定（顶点 NaN / 材质 program 缓存失败 → 永远不可见）。
  // 云改为 THREE.Sprite（SpriteMaterial + 云块纹理，THREE 自动面向相机，
  // 标准可靠路径）；树冠卡片保留原 InstancedBufferGeometry（S12 共享管线）。
  const renderer = createCloudImpostorSystem(THREE, citadel, {
    ...clusters,
    instances: clusters.instances.filter((instance) => instance.shape === "canopy"),
  }, { radius });
  renderer.mesh.name = "highland-hero-cloud-impostors";
  renderer.mesh.renderOrder = 6;
  renderer.mesh.userData.kind = "highland-hero-clouds";
  renderer.mesh.userData.heroCount = clusters.heroCount;
  renderer.mesh.userData.cap = clusters.cap;
  // 2026-08-27 云层重做（主人验收）：impostor 卡片 Sprite 形状雷同、有卡格
  // 纹、无风感 → 换成合体几何体积云团（形状多样/气候分布/风漂/聚散）。
  // 树冠卡片保留原 InstancedBufferGeometry（S12 共享管线）。
  try {
    const blobGroup = mountHighlandBlobClouds(THREE, citadel, { radius });
    const canopyUpdate = renderer.update;
    renderer.update = (t) => {
      canopyUpdate?.(t);
      blobGroup.userData.update?.(t);
    };
    blobGroup.userData.blobCount = blobGroup.userData.clusterCount;
  } catch (error) {
    console.warn("[citadel] cloud blobs skipped:", error?.message);
  }
  // S12: the hero layer shares one impostor pipeline between cloud cards and
  // tree-canopy cards (same atlas, same material family, one draw call).
  renderer.mesh.userData.sharedImpostor = renderer.mesh.userData.sharedImpostor === true;
  renderer.mesh.userData.canopyCount = clusters.instances.filter((instance) => instance.shape === "canopy").length;
  renderer.mesh.userData.cloudCount = clusters.instances.filter((instance) => instance.shape !== "canopy").length;
  citadel.userData.highlandHeroClouds = renderer;
  citadel.userData.highlandHeroCloudCount = clusters.heroCount;
  citadel.userData.highlandCanopyImpostorCount = renderer.mesh.userData.canopyCount;
  return renderer;
}
