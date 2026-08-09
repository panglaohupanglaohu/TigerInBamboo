// ============================================================================
//  Odyssey Citadel — Townscaper 式规则生成的高山圣城
//
//  Local convention: +Y = sky / planet normal, +Z = the player-facing facade.
//  建筑本体由 citadelTown.js 的单元格地图 + 邻接规则生成；本文件负责
//  断崖基岩、五层台地/折返石阶外围地势、水墨描边与球面放置。
// ============================================================================
import * as THREE from "three";
import { addOutline } from "../assets/toon.js";
import { PLAYER_HEIGHT } from "../core/constants.js";
import { canyonOffsetDir } from "./canyon.js";
import { CITADEL_TOWN_SPEC, buildCitadelTown } from "./citadelTown.js";

const PALETTE = Object.freeze({
  // 浅色系基岩与土坡：与黄土坡/白石梯湖的暖色盘统一，弃用深灰。
  cliff: 0xcfc5a2,
  stone: 0xe5eff2,
  weatherStone: 0xb8c5c9,
  ink: 0x2a2b2d,
  outline: 0x000000,
  wood: 0x8b5a2b,
  // Architecture owns no orange sunset color: illumination supplies it.
  domeIvory: 0xe6e3d7,
  domeShade: 0xbdc6c4,
  towerStone: 0xd6d8d4,
  towerShade: 0xaeb8b7,
  // 小镇字符配色：W 白石（stone）/ L 浅砂石 / B 淡砖角塔 / D 棕色正门。
  sandStone: 0xd9cfac,
  paleBrick: 0xcaa88c,
  roofTile: 0xb4694e, // 坡屋顶/尖顶瓦红（Townscaper 式暖陶瓦）
  water: 0x8fc7d6, // 水道水面（与梯湖水帘同色系）
  foliageDark: 0x365c3b,
  foliageLight: 0x628253,
  bark: 0x59452d,
  contour: 0xcfc49a,
  pilgrimageStone: 0xe3ddc7,
});

export const CITADEL = Object.freeze({
  layer0: { rockRadius: 2.3, rockCount: 7, centerY: 11.2 },
  outline: 0.055,
  finialHeight: PLAYER_HEIGHT * 2.0,
  // 规则生成的小镇按最终尺寸直接落地：基座底面咬入顶层台地（Y=12）0.06。
  townBaseY: 11.94,
  // 布局包围盒加深（后排离墙附屋 + 水巷）后 cz 居中让前排面/正门前移 1 格；
  // 整体 −2 补偿，保持正门与门廊平桥/折返石阶的原有对齐。
  townOffsetZ: -2.0,
  contourTerrain: {
    layerCount: 5,
    layerHeight: 2.0,
    baseRadius: 24.0,
    shrink: 0.9,
    radialSegments: 12,
    // 瀑布缺口：前四层台地在朝向梯湖/水帘的方位角扇区开槽，露出瀑布；
    // 缺口不切入 coreRadius 实心核，城堡基座始终落在实土上。
    coreRadius: 9.0,
    notchCenter: 0.17, // 方位角 φ（从 +z 朝 +x 量）≈ 10°，正对梯湖水道
    notchHalf: 0.56, // 半角 ≈ 32°，完整覆盖两座上级梯湖与水帘落点
    notchedLayers: 4, // 仅前四层开槽；顶层台地完整，托住城堡与门廊平桥
  },
  // Sink the complete town assembly deeper into the loess summit so
  // cliff claws and the gate threshold share one grounded datum.
  groundEmbed: 9.25,
});

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** 地形编辑器（圣城搭建面板）与主场景启动共用的台地参数存档键。 */
export const CITADEL_TERRAIN_KEY = "tm.citadel.terrain.v1";

/** 台地参数 → 镇体基座高度：顶层台面（Y = 2 + 层高×层数）咬入 0.06。 */
export function contourTownBaseY(contourSpec = CITADEL.contourTerrain) {
  return 2 + contourSpec.layerHeight * contourSpec.layerCount - 0.06;
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** A local, headless-safe three-band cel ramp. */
function makeThreeStepGradient() {
  const pixels = new Uint8Array([72, 168, 255]);
  const gradient = new THREE.DataTexture(pixels, 3, 1, THREE.RedFormat);
  gradient.name = "citadel-three-step-gradient";
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

function makeToon(color, gradientMap) {
  // Do not pass flatShading through setValues(): the Three.js revision bundled
  // by this project logs an avoidable warning for that constructor key.
  const material = new THREE.MeshToonMaterial({ color, gradientMap });
  // Keep this assignment explicit: older Three.js revisions only rebuild the
  // shader after flatShading is changed post-construction.
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

function mesh(geometry, material, name, outlineThickness = CITADEL.outline) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  result.userData.outlineThickness = outlineThickness;
  return result;
}

/**
 * Starts as the specified thin BoxGeometry and bends its upper vertices inward
 * on a sine/cosine shoulder, producing a hand-cut Byzantine pointed arch.
 */
function makeArchedWindowGeometry() {
  const geometry = new THREE.BoxGeometry(0.4, 1.5, 0.05, 4, 8, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) + 0.75; // [0, 1.5]
    if (y > 0.92) {
      const t = THREE.MathUtils.clamp((y - 0.92) / 0.58, 0, 1);
      const sineTaper = Math.cos(t * Math.PI * 0.5);
      position.setX(i, position.getX(i) * sineTaper);
    }
    position.setY(i, y);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function buildHalfDome(radius, material, name, stretchY = 1.0) {
  const dome = mesh(
    new THREE.SphereGeometry(
      radius,
      16,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    ),
    material,
    name
  );
  dome.scale.set(1.0, stretchY, 1.0);
  return dome;
}

function buildCitadelShrub(name, scale, materials, random) {
  const shrub = new THREE.Group();
  shrub.name = name;

  const trunk = mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.28 * scale, 5),
    materials.bark,
    `${name}-trunk`,
    0.012
  );
  trunk.position.y = 0.12 * scale;
  shrub.add(trunk);

  for (let i = 0; i < 6; i++) {
    const crown = mesh(
      new THREE.IcosahedronGeometry((0.42 + random() * 0.2) * scale, 0),
      i % 2 ? materials.foliageLight : materials.foliageDark,
      `${name}-crown`,
      0.018
    );
    const angle = (i / 6) * Math.PI * 2 + random() * 0.35;
    crown.position.set(
      Math.cos(angle) * (0.38 + random() * 0.25) * scale,
      (0.3 + random() * 0.28) * scale,
      Math.sin(angle) * (0.38 + random() * 0.25) * scale
    );
    crown.scale.y = 0.8 + random() * 0.35;
    shrub.add(crown);
  }
  return shrub;
}

function buildCitadelRoundTopiary(name, scale, materials, random) {
  const topiary = new THREE.Group();
  topiary.name = name;
  const trunk = mesh(
    new THREE.CylinderGeometry(0.045 * scale, 0.075 * scale, 0.34 * scale, 5),
    materials.bark,
    `${name}-trunk`,
    0.009
  );
  trunk.position.y = 0.15 * scale;
  topiary.add(trunk);
  const crown = mesh(
    new THREE.SphereGeometry((0.36 + random() * 0.12) * scale, 8, 6),
    random() > 0.45 ? materials.foliageLight : materials.foliageDark,
    `${name}-round-crown`,
    0.014
  );
  crown.position.y = (0.56 + random() * 0.08) * scale;
  topiary.add(crown);
  return topiary;
}

/** Add inverse-hull ink only after the complete town assembly exists. */
export function applyInkOutlines(assembly) {
  const surfaces = [];
  assembly.traverse((object) => {
    if (object.isMesh && !object.userData.isOutline) surfaces.push(object);
  });
  for (const surface of surfaces) {
    addOutline(
      surface,
      surface.userData.outlineThickness ?? CITADEL.outline,
      PALETTE.outline,
      0
    );
  }
  return surfaces.length;
}

/**
 * Annular terrace sector: a flat-topped ring slab from `innerRadius` to
 * `radius`, missing the waterfall notch wedge centered at
 * `notchCenter ± notchHalf`. Azimuth convention matches cylinder placement:
 * x = r·sinφ, z = r·cosφ (φ = 0 faces the facade / cascade channel).
 */
function makeTerraceRingGeometry(radius, innerRadius, height, notchCenter, notchHalf) {
  // Shape angle α relates to φ by α = φ - π/2 (extrude plane maps (sx, sy)
  // onto world (x, -z) after rotateX(-π/2)).
  const aStart = notchCenter + notchHalf - Math.PI / 2;
  const aEnd = notchCenter - notchHalf + Math.PI * 1.5;
  const shape = new THREE.Shape();
  shape.moveTo(radius * Math.cos(aStart), radius * Math.sin(aStart));
  shape.absarc(0, 0, radius, aStart, aEnd, false);
  shape.lineTo(innerRadius * Math.cos(aEnd), innerRadius * Math.sin(aEnd));
  shape.absarc(0, 0, innerRadius, aEnd, aStart, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 18,
  });
  geometry.rotateX(-Math.PI / 2); // 挤出方向转为 +Y，台板厚 [0, height]
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Full-scale terrain apron around the sacred city shrunk to 4/5 of its former
 * size. This remains a sibling of the five architectural layers so the
 * contour mountain and its exposed pilgrimage stair keep their full
 * dimensions when the city is scaled down.
 *
 * @param {Record<string, THREE.Material>} materials
 * @param {typeof CITADEL.contourTerrain} contourSpec 台地参数（地形编辑器可调）
 */
function buildOuterCitadelTerrain(materials, contourSpec = CITADEL.contourTerrain) {
  const terrainSystem = new THREE.Group();
  terrainSystem.name = "citadel-outer-terrain-system";

  // Five hard-edged, twelve-sided contour shelves. The lower four are ring
  // sectors with a front wedge notch toward the stepped lakes, so the four
  // waterfall curtains stay exposed instead of being buried under the slope;
  // a solid core (and the un-notched top shelf) keeps the citadel grounded.
  const contourGroup = new THREE.Group();
  contourGroup.name = "contour-step-terrain";
  for (let i = 0; i < contourSpec.layerCount; i++) {
    const radius = contourSpec.baseRadius * contourSpec.shrink ** i;
    const shelfBottom = 2.0 + contourSpec.layerHeight * i;
    const notched = i < contourSpec.notchedLayers;
    const shelf = mesh(
      notched
        ? makeTerraceRingGeometry(
            radius,
            contourSpec.coreRadius,
            contourSpec.layerHeight,
            contourSpec.notchCenter,
            contourSpec.notchHalf
          )
        : new THREE.CylinderGeometry(
            radius,
            radius,
            contourSpec.layerHeight,
            contourSpec.radialSegments
          ),
      materials.contour,
      `contour-step-${i}`
    );
    // The castleContainer is already buried into the summit. Starting these
    // shelves two units higher keeps their lower mass underground while the
    // fifth shelf lands exactly at Y=12 beneath the citadel gate threshold.
    shelf.position.y = notched ? shelfBottom : shelfBottom + contourSpec.layerHeight / 2;
    if (!notched) shelf.rotation.y = (i % 2) * (Math.PI / contourSpec.radialSegments);
    shelf.userData.contourIndex = i;
    shelf.userData.contourRadius = radius;
    contourGroup.add(shelf);
    if (notched) {
      // Solid core fills the notch's inner end: the castle footing and the
      // gate causeway always rest on real soil, never over the slot.
      const core = mesh(
        new THREE.CylinderGeometry(
          contourSpec.coreRadius,
          contourSpec.coreRadius,
          contourSpec.layerHeight,
          contourSpec.radialSegments
        ),
        materials.contour,
        `contour-step-${i}-core`
      );
      core.position.y = shelfBottom + contourSpec.layerHeight / 2;
      core.userData.contourIndex = i;
      core.userData.contourRadius = contourSpec.coreRadius;
      contourGroup.add(core);
    }
  }
  terrainSystem.add(contourGroup);

  // 之字形朝圣石阶：五段梯段一一对应五层台地，在左前坡（负方位角，避开
  // 瀑布缺口）左右折返，各段弧长不同 → 坡度各不相同，绝非直上直下。
  // 每级踏步向下落梁嵌入下层台面，顶段经平桥直抵棕色木门廊（正门）。
  const pilgrimageRamp = new THREE.Group();
  pilgrimageRamp.name = "winding-pilgrimage-ramp";
  const shelfTop = (k) => 2.0 + contourSpec.layerHeight * (k + 1); // 第 k 层台面
  const shelfRadius = (k) => contourSpec.baseRadius * contourSpec.shrink ** k;
  // φ：从 +z（正门/瀑布方向）朝 +x 量；负角 = 左前坡。
  const flights = [
    { from: -0.87, to: -1.5, shelf: 0, groundY: 1.0 },   // 山脚缓坡长段
    { from: -1.5, to: -0.91, shelf: 1 },                 // 折返
    { from: -0.91, to: -1.47, shelf: 2 },                // 折返
    { from: -1.47, to: -0.94, shelf: 3 },                // 折返
    { from: -0.94, to: -1.4, shelf: 4 },                 // 顶层较短较陡
  ];
  const stepGeometry = new THREE.BoxGeometry(1.85, 1, 1.45);
  let stepIndex = 0;
  for (const flight of flights) {
    const k = flight.shelf;
    const rho = shelfRadius(k) + 1.05; // 沿第 k 层立面外侧、下层台面的暴露环带
    const yTop = shelfTop(k) + 0.06;
    const yBottom = k === 0 ? flight.groundY : shelfTop(k - 1) + 0.06;
    const supportY = k === 0 ? -0.6 : shelfTop(k - 1) - 0.35; // 落梁嵌入下层台面
    const arc = rho * Math.abs(flight.to - flight.from);
    // 踏面沿行进方向互相交叠：整段读作实心石梯，而不是一排悬空立柱。
    const count = Math.max(6, Math.round(arc / 0.78));
    const sweep = Math.sign(flight.to - flight.from);
    for (let i = 0; i < count; i++, stepIndex++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const phi = THREE.MathUtils.lerp(flight.from, flight.to, t);
      const treadY = THREE.MathUtils.lerp(yBottom, yTop, t);
      const height = treadY - supportY;
      const step = mesh(
        stepGeometry,
        materials.pilgrimageStone,
        `pilgrimage-step-${stepIndex}`,
        0.02
      );
      step.scale.y = height;
      step.position.set(
        rho * Math.sin(phi),
        supportY + height / 2,
        rho * Math.cos(phi)
      );
      // 踏步长边垂直于行进方向（沿圆弧切向行走）
      step.rotation.y = Math.atan2(Math.cos(phi) * sweep, -Math.sin(phi) * sweep);
      pilgrimageRamp.add(step);
    }
    // 梯口平台：横跨台地边缘，把梯段端头接上本层台面。
    const landing = mesh(
      new THREE.BoxGeometry(2.7, 0.55, 2.8),
      materials.pilgrimageStone,
      `pilgrimage-landing-${k}`,
      0.04
    );
    landing.position.set(
      (rho - 1.15) * Math.sin(flight.to),
      yTop - 0.22,
      (rho - 1.15) * Math.cos(flight.to)
    );
    landing.rotation.y = flight.to;
    pilgrimageRamp.add(landing);
  }
  // 顶端平桥：从末段梯口跨越顶层台面；末端收窄成门槛条，穿过瓮城双塔
  // 直抵棕色木门廊柱前（门廊柱 z = 15.72×0.4 ≈ 6.29，门槛 ≈ Y 12.0）。
  const causewayFrom = new THREE.Vector2(
    15.4 * Math.sin(-1.4),
    15.4 * Math.cos(-1.4)
  );
  const causewayTo = new THREE.Vector2(0, 7.9);
  const causewayYaw = Math.atan2(
    causewayTo.x - causewayFrom.x,
    causewayTo.y - causewayFrom.y
  );
  const causewayLength = causewayFrom.distanceTo(causewayTo);
  const causewayCount = Math.round(causewayLength / 1.9);
  const causewayGeometry = new THREE.BoxGeometry(1.9, 0.55, 2.05);
  for (let i = 0; i < causewayCount; i++, stepIndex++) {
    const t = causewayCount === 1 ? 0 : i / (causewayCount - 1);
    const slab = mesh(
      causewayGeometry,
      materials.pilgrimageStone,
      `pilgrimage-step-${stepIndex}`,
      0.025
    );
    slab.position.set(
      THREE.MathUtils.lerp(causewayFrom.x, causewayTo.x, t),
      shelfTop(4) + 0.02,
      THREE.MathUtils.lerp(causewayFrom.y, causewayTo.y, t)
    );
    slab.rotation.y = causewayYaw;
    pilgrimageRamp.add(slab);
  }
  // 门槛条：宽 1.3 < 瓮城双塔喉道（±0.68），把平桥接到门廊柱跟前。
  const threshold = mesh(
    new THREE.BoxGeometry(1.3, 0.55, 1.5),
    materials.pilgrimageStone,
    `pilgrimage-step-${stepIndex++}`,
    0.025
  );
  threshold.position.set(0, shelfTop(4) + 0.02, 7.05);
  pilgrimageRamp.add(threshold);
  terrainSystem.add(pilgrimageRamp);

  terrainSystem.userData.contourLayerCount = contourSpec.layerCount;
  terrainSystem.userData.rampartSegmentCount = 0;
  terrainSystem.userData.buttressCount = 0;
  terrainSystem.userData.watchtowerCount = 0;
  terrainSystem.userData.watchtowerCrenelCount = 0;
  terrainSystem.userData.pilgrimageStepCount = stepIndex;
  terrainSystem.userData.pilgrimageFlightCount = flights.length;
  terrainSystem.userData.rampTurnCount = flights.length - 1;
  terrainSystem.userData.waterfallNotchLayers = contourSpec.notchedLayers;
  return terrainSystem;
}

/**
 * Townscaper 规则小镇的独立装配：创建全套 toon 材质与 gradientMap，按
 * `CITADEL.townBaseY` 摆好各 level 组（未做水墨描边——由调用方在装配
 * 完成后统一 `applyInkOutlines`，避免重复描边）。
 *
 * `buildOdysseyCitadel` 与 Townscaper 编辑器（townscaper.html）共用本函数，
 * 保证编辑器预览与主场景渲染走同一份材质/规则代码。
 *
 * @param {typeof CITADEL_TOWN_SPEC} spec 逐层 ASCII 布局
 * @param {{
 *   random?: () => number,
 *   materials?: Record<string, THREE.Material>, // 传入则复用，不再自建
 *   gradientMap?: THREE.DataTexture,
 *   baseY?: number, // 镇体基座高度（默认 CITADEL.townBaseY；地形改层高后跟随顶层台面）
 * }} [options]
 * @returns {{
 *   group: THREE.Group,      // 全部 level 组的容器（y 已就位）
 *   levels: THREE.Group[],   // 未归物理层的 level 组
 *   stats: object,
 *   materials: Record<string, THREE.Material>,
 *   gradientMap: THREE.DataTexture,
 * }}
 */
export function buildCitadelTownAssembly(spec, options = {}) {
  const random = options.random ?? lcg(20260808);
  const gradientMap = options.gradientMap ?? makeThreeStepGradient();

  const materials = options.materials ?? {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    ink: makeToon(PALETTE.ink, gradientMap),
    wood: makeToon(PALETTE.wood, gradientMap),
    gold: makeToon(PALETTE.domeIvory, gradientMap),
    goldShade: makeToon(PALETTE.domeShade, gradientMap),
    sand: makeToon(PALETTE.sandStone, gradientMap),
    brickPale: makeToon(PALETTE.paleBrick, gradientMap),
    roofTile: makeToon(PALETTE.roofTile, gradientMap),
    water: makeToon(PALETTE.water, gradientMap),
    foliageDark: makeToon(PALETTE.foliageDark, gradientMap),
    foliageLight: makeToon(PALETTE.foliageLight, gradientMap),
    bark: makeToon(PALETTE.bark, gradientMap),
    contour: makeToon(PALETTE.contour, gradientMap),
    pilgrimageStone: makeToon(PALETTE.pilgrimageStone, gradientMap),
  };
  if (materials.water) {
    materials.water.transparent = true;
    materials.water.opacity = 0.82;
  }

  const town = buildCitadelTown(spec, {
    mesh,
    materials: {
      W: materials.stone,
      L: materials.sand,
      B: materials.brickPale,
      D: materials.stone,
      gold: materials.gold,
      wood: materials.wood,
      ink: materials.ink,
      roofTile: materials.roofTile,
      water: materials.water,
    },
    shrubMaterials: materials,
    random,
    archWindowGeometry: makeArchedWindowGeometry(),
    buildHalfDome,
    buildShrub: buildCitadelShrub,
    buildTopiary: buildCitadelRoundTopiary,
    finialHeight: CITADEL.finialHeight,
  });

  const group = new THREE.Group();
  group.name = "citadel-town-assembly";
  const baseY = options.baseY ?? CITADEL.townBaseY;
  town.levels.forEach((levelGroup) => {
    levelGroup.position.y = baseY;
    levelGroup.position.z = CITADEL.townOffsetZ; // 正门对齐补偿（见 CITADEL 注释）
    group.add(levelGroup);
  });

  return { group, levels: town.levels, stats: town.stats, materials, gradientMap };
}

/**
 * Build the complete landmark without mutating global state.
 *
 * @param {{
 *   dir?: THREE.Vector3,
 *   faceDir?: THREE.Vector3,
 *   planetRadius?: number,
 *   groundRadius?: number,
 *   seed?: number,
 *   place?: boolean,
 *   spec?: typeof CITADEL_TOWN_SPEC, // 小镇布局覆盖（编辑器存档）；缺省用内置 SPEC
 *   contour?: typeof CITADEL.contourTerrain, // 台地参数覆盖（地形编辑器存档）
 * }} [options]
 * @returns {THREE.Group & {update(dt:number, t:number):void}}
 */
export function buildOdysseyCitadel(options = {}) {
  const random = lcg(options.seed ?? 20260808);
  const townSpec = options.spec ?? CITADEL_TOWN_SPEC;
  const contourSpec = options.contour ?? CITADEL.contourTerrain;
  const townBaseY = contourTownBaseY(contourSpec);
  const planetRadius = Number.isFinite(options.planetRadius) ? options.planetRadius : 160;
  const gradientMap = makeThreeStepGradient();

  const materials = {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    ink: makeToon(PALETTE.ink, gradientMap),
    wood: makeToon(PALETTE.wood, gradientMap),
    gold: makeToon(PALETTE.domeIvory, gradientMap),
    goldShade: makeToon(PALETTE.domeShade, gradientMap),
    sand: makeToon(PALETTE.sandStone, gradientMap),
    brickPale: makeToon(PALETTE.paleBrick, gradientMap),
    roofTile: makeToon(PALETTE.roofTile, gradientMap),
    water: makeToon(PALETTE.water, gradientMap),
    foliageDark: makeToon(PALETTE.foliageDark, gradientMap),
    foliageLight: makeToon(PALETTE.foliageLight, gradientMap),
    bark: makeToon(PALETTE.bark, gradientMap),
    contour: makeToon(PALETTE.contour, gradientMap),
    pilgrimageStone: makeToon(PALETTE.pilgrimageStone, gradientMap),
  };

  const castleContainer = new THREE.Group();
  castleContainer.name = "castleContainer";

  const citadelAssembly = new THREE.Group();
  citadelAssembly.name = "odyssey-citadel-five-layer-assembly";

  const layers = Array.from({ length: 5 }, (_, index) => {
    const layer = new THREE.Group();
    layer.name = `citadel-layer-${index}`;
    layer.userData.layerIndex = index;
    return layer;
  });

  // --------------------------------------------------------------------------
  // Layer 0 — primordial rocky understructure
  // --------------------------------------------------------------------------
  const rockGeometry = new THREE.IcosahedronGeometry(CITADEL.layer0.rockRadius, 0);
  for (let i = 0; i < CITADEL.layer0.rockCount; i++) {
    const rock = mesh(rockGeometry, materials.cliff, `primordial-cliff-rock-${i}`);
    const angle = (i / CITADEL.layer0.rockCount) * Math.PI * 2 + (random() - 0.5) * 0.45;
    const spread = i === 0 ? 0 : 2.2 + random() * 1.5;
    rock.position.set(
      Math.cos(angle) * spread,
      CITADEL.layer0.centerY + (random() - 0.5) * 0.8,
      Math.sin(angle) * spread
    );
    rock.scale.set(
      1.0 + random() * 0.4,
      0.8 + random() * 0.3,
      1.0 + random() * 0.4
    );
    rock.rotation.y = random() * Math.PI * 2;
    layers[0].add(rock);
  }

  // --------------------------------------------------------------------------
  // Layers 1–4 —— Townscaper 式规则生成小镇（citadelTown.js）
  // 布局只由 CITADEL_TOWN_SPEC 的逐层 ASCII 决定；体块/穹顶/城垛/拱窗/
  // 悬空拱/塔楼金顶/屋顶花园/棕色正门全部由邻接规则自动生成。
  // --------------------------------------------------------------------------
  // 复用与编辑器（townscaper.html）相同的装配入口；random 已被 Layer 0
  // 断崖消耗过，此处继续同一序列，保证渲染结果与重构前逐位一致。
  const townAssembly = buildCitadelTownAssembly(townSpec, {
    random,
    materials,
    gradientMap,
    baseY: townBaseY,
  });
  // 小镇两级并入一个物理层级分组（Layer 0 = 断崖基岩）
  townAssembly.levels.forEach((levelGroup, iy) => {
    layers[Math.min(4, 1 + Math.floor(iy / 2))].add(levelGroup);
  });

  for (const layer of layers) citadelAssembly.add(layer);
  const mainOutlinedSurfaceCount = applyInkOutlines(citadelAssembly);

  const outerTerrainSystem = buildOuterCitadelTerrain(materials, contourSpec);
  const terrainOutlinedSurfaceCount = applyInkOutlines(outerTerrainSystem);
  castleContainer.add(outerTerrainSystem);
  castleContainer.add(citadelAssembly);

  // Preserve the scene's update contract while keeping this architectural
  // landmark static and deterministic for headless screenshot comparisons.
  const update = () => {};
  castleContainer.update = update;
  castleContainer.userData.update = update;

  if (options.place !== false && options.dir) {
    _dir.copy(options.dir).normalize();
    _up.copy(_dir);
    if (options.faceDir) {
      _forward.copy(options.faceDir).normalize();
      _forward.addScaledVector(_up, -_forward.dot(_up));
      if (_forward.lengthSq() < 1e-8) _forward.set(0, 0, 1);
      _forward.normalize();
    } else {
      _forward.set(0, 0, 1).addScaledVector(_up, -_up.z);
      if (_forward.lengthSq() < 1e-8) _forward.set(1, 0, 0);
      _forward.normalize();
    }
    _right.crossVectors(_up, _forward).normalize();
    _basis.makeBasis(_right, _up, _forward);
    castleContainer.quaternion.setFromRotationMatrix(_basis);

    const groundRadius = Number.isFinite(options.groundRadius)
      ? options.groundRadius
      : planetRadius + canyonOffsetDir(_dir);
    castleContainer.position.copy(_dir).multiplyScalar(groundRadius - CITADEL.groundEmbed);
    castleContainer.userData.anchor = { dir: _dir.clone(), groundR: groundRadius };
  }

  castleContainer.userData.kind = "odyssey-citadel";
  castleContainer.userData.spec = CITADEL;
  castleContainer.userData.contourSpec = contourSpec;
  castleContainer.userData.townBaseY = townBaseY;
  castleContainer.userData.terrainMaterials = {
    contour: materials.contour,
    pilgrimageStone: materials.pilgrimageStone,
  };
  castleContainer.userData.layers = layers;
  castleContainer.userData.mainCastle = citadelAssembly;
  castleContainer.userData.outerTerrainSystem = outerTerrainSystem;
  castleContainer.userData.townSpec = townSpec;
  castleContainer.userData.townStats = townAssembly.stats;
  castleContainer.userData.mainOutlinedSurfaceCount = mainOutlinedSurfaceCount;
  castleContainer.userData.terrainOutlinedSurfaceCount = terrainOutlinedSurfaceCount;
  castleContainer.userData.outlinedSurfaceCount =
    mainOutlinedSurfaceCount + terrainOutlinedSurfaceCount;
  castleContainer.userData.gradientMap = townAssembly.gradientMap;

  return castleContainer;
}

/** 释放一组 town-level 组的几何与材质（描边材质在 toon.js 全局缓存，不动）。 */
function disposeTownLevels(levelGroups) {
  const geometries = new Set();
  const materials = new Set();
  for (const group of levelGroups) {
    group.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
  }
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

/**
 * 游戏内热重建：拆掉 castleContainer 物理层里的旧小镇，按新布局重新生成
 * （断崖基岩、外围台地/石阶/瀑布不动）。供圣城搭建面板（citadelEditorPanel）
 * 在编辑时即时刷新场景。
 *
 * @param {THREE.Group} castleContainer buildOdysseyCitadel 的返回值
 * @param {typeof CITADEL_TOWN_SPEC} spec 新布局
 * @returns {object|null} 新 stats；非圣城容器返回 null
 */
export function rebuildCitadelTown(castleContainer, spec) {
  const layers = castleContainer?.userData?.layers;
  if (!layers?.length) return null;

  const oldLevels = [];
  for (const layer of layers) {
    for (const child of [...layer.children]) {
      if (child.name?.startsWith("town-level-")) {
        layer.remove(child);
        oldLevels.push(child);
      }
    }
  }
  disposeTownLevels(oldLevels);

  // 新装配自带材质/gradientMap：旧小镇材质随旧组释放，断崖与外围地势的
  // 材质实例（cliff/contour/pilgrimageStone）仍归初始构建所有，不受影响。
  // 基座高度跟随当前台地参数（地形编辑器可能改过层高）。
  const assembly = buildCitadelTownAssembly(spec, {
    baseY: castleContainer.userData.townBaseY ?? CITADEL.townBaseY,
  });
  applyInkOutlines(assembly.group);
  assembly.levels.forEach((levelGroup, iy) => {
    layers[Math.min(4, 1 + Math.floor(iy / 2))].add(levelGroup);
  });
  castleContainer.userData.townStats = assembly.stats;
  castleContainer.userData.townSpec = spec;
  return assembly.stats;
}

/**
 * 游戏内地形热重建：按新参数整体替换外围台地/石阶（断崖基岩与小镇体块
 * 不动），并把镇体基座抬放到新顶层台面。供圣城搭建面板的「地形地貌」
 * 编辑器即时刷新场景。
 *
 * @param {THREE.Group} castleContainer buildOdysseyCitadel 的返回值
 * @param {typeof CITADEL.contourTerrain} contourSpec 新台地参数
 * @returns {THREE.Group|null} 新外围地势系统；非圣城容器返回 null
 */
export function rebuildCitadelTerrain(castleContainer, contourSpec) {
  const old = castleContainer?.userData?.outerTerrainSystem;
  if (!old) return null;

  // 只释放几何：contour / pilgrimageStone 材质归初始构建共享，不能 dispose
  const geometries = new Set();
  old.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (o.geometry) geometries.add(o.geometry);
  });
  castleContainer.remove(old);
  for (const g of geometries) g.dispose();

  const system = buildOuterCitadelTerrain(
    castleContainer.userData.terrainMaterials,
    contourSpec
  );
  const outlined = applyInkOutlines(system);
  castleContainer.add(system);
  castleContainer.userData.outerTerrainSystem = system;
  castleContainer.userData.contourSpec = contourSpec;
  castleContainer.userData.terrainOutlinedSurfaceCount = outlined;
  castleContainer.userData.outlinedSurfaceCount =
    castleContainer.userData.mainOutlinedSurfaceCount + outlined;

  // 镇体基座跟随新顶层台面
  const baseY = contourTownBaseY(contourSpec);
  castleContainer.userData.townBaseY = baseY;
  castleContainer.traverse((o) => {
    if (o.name?.startsWith("town-level-")) o.position.y = baseY;
  });
  return system;
}

const _supportOrigin = new THREE.Vector3();
const _supportDown = new THREE.Vector3();
const _supportRay = new THREE.Raycaster();

/**
 * 土坡支撑探测：从小镇局部坐标 (localX, localZ) 的高处竖直向下打射线，
 * 命中外围地势（台地/石阶/平桥）的最高面 → 换算成可放置的层级 iy
 * （该层体块底面 ≈ 台面）。无土坡支撑返回 -1（不可放置）。
 * 供搭建面板「落地」堆叠：只有土坡承重的柱位才允许落建筑块。
 *
 * @param {THREE.Group} castleContainer
 * @param {number} localX 小镇局部 x（level 组坐标系）
 * @param {number} localZ 小镇局部 z
 * @param {number} cellHeight 每层层高（默认 2）
 * @returns {number} 层级 iy（可为负 = 台地低于镇基，不可放置）；无支撑 -1
 */
export function terrainSupportLevel(castleContainer, localX, localZ, cellHeight = 2) {
  const terrain = castleContainer?.userData?.outerTerrainSystem;
  const ref = castleContainer?.getObjectByName?.("town-level-0");
  if (!terrain || !ref) return -1;
  ref.updateWorldMatrix(true, false);
  terrain.updateWorldMatrix(true, true); // 热重建后/无头环境下矩阵可能未刷新
  _supportOrigin.set(localX, 80, localZ);
  ref.localToWorld(_supportOrigin);
  _supportDown.set(0, -1, 0).transformDirection(ref.matrixWorld);
  _supportRay.set(_supportOrigin, _supportDown);
  const hits = _supportRay.intersectObject(terrain, true);
  if (!hits.length) return -1;
  const localY = ref.worldToLocal(hits[0].point.clone()).y;
  return Math.round(localY / cellHeight);
}
