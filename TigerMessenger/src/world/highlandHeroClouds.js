// =====================================================================
// Local highland citadel hero clouds.  The planet-V8 impostor compiler pins
// clusters to geodesic landmarks; the player standing at the obelisk is on
// the authored mountain-valley citadel.  This module places the same catalog
// (cap / ring / forest scatter) in citadel-local XZ, hugging the continuous
// mountain grid, and parents the impostor mesh to the castle group.
// =====================================================================

import { HERO_CLOUD_SPECS } from "../render/clouds/heroCloudCatalog.js?v=shared-impostor-s12-v1";
import { createCloudImpostorSystem } from "../render/clouds/cloudImpostorSystem.js?v=shared-impostor-s12-v1";
import { buildSharedImpostorAtlas, extractCloudBlockTexture } from "../render/clouds/impostorAtlasBuilder.js?v=shared-impostor-s12-v1";
import { highlandTerrainSurfaceHeight } from "./highlandCitadelDesign.js?v=shared-impostor-s12-v1";

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
  // Sprite 云层：每朵云一个 Sprite（面向相机，可靠可见）
  try {
    const atlas = buildSharedImpostorAtlas();
    const cloudTexture = extractCloudBlockTexture(THREE, atlas);
    const spriteGroup = new THREE.Group();
    spriteGroup.name = "highland-hero-cloud-sprites";
    spriteGroup.userData.kind = "highland-hero-clouds";
    const spriteMaterial = new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    const cloudInstances = clusters.instances.filter((instance) => instance.shape !== "canopy");
    for (const item of cloudInstances) {
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.name = `highland-hero-cloud-sprite-${item.id}`;
      sprite.position.set(item.position[0], item.position[1], item.position[2]);
      sprite.scale.set(item.scale, item.scale, 1);
      sprite.renderOrder = 6;
      sprite.userData.heroRole = item.heroRole;
      sprite.userData.cloudId = item.id;
      spriteGroup.add(sprite);
    }
    spriteGroup.userData.spriteCount = cloudInstances.length;
    citadel.add(spriteGroup);
    citadel.userData.highlandCloudSprites = spriteGroup;
  } catch (error) {
    console.warn("[citadel] cloud sprites skipped:", error?.message);
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
