// ============================================================================
//  Odyssey Citadel — five-layer, native Three.js landmark asset factory
//
//  Local convention: +Y = sky / planet normal, +Z = the player-facing facade.
//  Every visible primitive is assembled below `citadelAssembly`, outlined once,
//  and only then attached to the returned `castleContainer`.
// ============================================================================
import * as THREE from "three";
import { addOutline } from "../assets/toon.js";
import { PLAYER_HEIGHT } from "../core/constants.js";
import { canyonOffsetDir } from "./canyon.js";

const PALETTE = Object.freeze({
  cliff: 0x4a4a4a,
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
  foliageDark: 0x365c3b,
  foliageLight: 0x628253,
  bark: 0x59452d,
  contour: 0x555555,
  pilgrimageStone: 0x9aa4a6,
});

export const CITADEL = Object.freeze({
  layer0: { rockRadius: 6.5, rockCount: 7, centerY: 4.0 },
  layer1: { width: 24.0, height: 12.0, depth: 24.0, y: 10.0, z: 0.0 },
  layer2: { width: 16.0, height: 10.0, depth: 16.0, y: 21.0, z: -4.0 },
  layer3: { width: 9.0, height: 8.0, depth: 9.0, y: 30.0, z: -7.5 },
  bastion: { width: 4.5, height: 16.0, depth: 4.5, x: 9.0, y: 16.0, z: 5.0 },
  mainDome: { radius: 3.5, y: 34.0, z: -7.5, stretchY: 1.35 },
  secondaryDome: { radius: 2.2, localX: 6.5, localY: 5.0, localZ: 6.5 },
  outline: 0.055,
  finialHeight: PLAYER_HEIGHT * 2.0,
  mainCastleScale: 0.5,
  mainCastleLift: 12.0,
  contourTerrain: {
    layerCount: 5,
    layerHeight: 2.0,
    baseRadius: 24.0,
    shrink: 0.9,
    radialSegments: 12,
  },
  // Sink the complete five-layer assembly deeper into the loess summit so
  // cliff claws, gatehouse and flanking towers share one grounded datum.
  groundEmbed: 9.25,
});

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();

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

function addBifora(parent, geometry, material, x, y, z, rotationY = 0, name = "bifora") {
  const pair = new THREE.Group();
  pair.name = `${name}-pair`;
  pair.position.set(x, y, z);
  pair.rotation.y = rotationY;
  for (const sx of [-0.27, 0.27]) {
    const arch = mesh(geometry, material, `${name}-arch`, 0.022);
    arch.position.x = sx;
    pair.add(arch);
  }
  parent.add(pair);
  return pair;
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

function addCrenellatedRim(
  parent,
  material,
  { halfX, halfZ, baseY, name = "crenel", size = 0.5, height = 0.8, step = 1.0 }
) {
  const geometry = new THREE.BoxGeometry(size, height, size);
  let count = 0;
  // Four edges × unit stepping. The 0.5-wide merlon followed by 0.5 of air
  // creates the requested continuous solid/gap rhythm.
  for (let side = 0; side < 4; side++) {
    const alongX = side < 2;
    const sign = side % 2 === 0 ? 1 : -1;
    const halfRun = alongX ? halfX : halfZ;
    const units = Math.round((halfRun * 2) / step);
    for (let i = 0; i <= units; i++) {
      const u = -halfRun + i * step;
      const merlon = mesh(geometry, material, name, 0.032);
      merlon.position.set(
        alongX ? u : sign * halfX,
        baseY + height / 2,
        alongX ? sign * halfZ : u
      );
      parent.add(merlon);
      count++;
    }
  }
  return count;
}

function buildMinaret(name, x, z, materials) {
  const tower = new THREE.Group();
  tower.name = name;
  tower.position.set(x, 0, z);

  const lower = mesh(
    new THREE.CylinderGeometry(1.2, 1.45, 20.0, 6),
    materials.stone,
    `${name}-lower`
  );
  lower.position.y = 16.0;
  tower.add(lower);

  const balcony = mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 0.55, 6),
    materials.stone,
    `${name}-balcony`,
    0.04
  );
  balcony.position.y = 26.25;
  tower.add(balcony);

  const needle = mesh(
    new THREE.CylinderGeometry(0.42, 0.58, 7.0, 6),
    materials.stone,
    `${name}-upper`
  );
  needle.position.y = 30.0;
  tower.add(needle);

  const cap = buildHalfDome(1.05, materials.gold, `${name}-gold-cap`, 1.25);
  cap.position.y = 33.5;
  tower.add(cap);

  return tower;
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

function addDomeRibs(parent, material, radius, stretchY) {
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const curve = new THREE.QuadraticBezierCurve3(
      radial.clone().multiplyScalar(radius * 0.985),
      new THREE.Vector3(
        radial.x * radius * 0.72,
        radius * stretchY * 0.78,
        radial.z * radius * 0.72
      ),
      new THREE.Vector3(0, radius * stretchY, 0)
    );
    const rib = mesh(
      new THREE.TubeGeometry(curve, 8, 0.025, 4, false),
      material,
      "main-dome-rib",
      0.014
    );
    parent.add(rib);
  }
}

/** Add inverse-hull ink only after the complete five-layer assembly exists. */
function applyInkOutlines(assembly) {
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
 * Full-scale terrain apron around the half-scale sacred city. This remains a
 * sibling of the five architectural layers so the contour mountain and its
 * exposed pilgrimage stair keep their full dimensions when the city is 1/2.
 */
function buildOuterCitadelTerrain(materials) {
  const terrainSystem = new THREE.Group();
  terrainSystem.name = "citadel-outer-terrain-system";

  // Five hard-edged, twelve-sided contour shelves. Their two-unit slabs touch
  // exactly, avoiding both z-fighting and daylight gaps through the mountain.
  const contourGroup = new THREE.Group();
  contourGroup.name = "contour-step-terrain";
  const contourSpec = CITADEL.contourTerrain;
  for (let i = 0; i < contourSpec.layerCount; i++) {
    const radius = contourSpec.baseRadius * contourSpec.shrink ** i;
    const shelf = mesh(
      new THREE.CylinderGeometry(
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
    // fifth shelf lands exactly at Y=12 beneath the exposed pilgrimage route.
    shelf.position.y = 2.0 + contourSpec.layerHeight * (i + 0.5);
    shelf.rotation.y = (i % 2) * (Math.PI / contourSpec.radialSegments);
    shelf.userData.contourIndex = i;
    shelf.userData.contourRadius = radius;
    contourGroup.add(shelf);
  }
  terrainSystem.add(contourGroup);

  // Three legs create two explicit right-angle switchbacks. The stair blocks
  // climb continuously from the outer wall datum to the scaled main gate.
  const pilgrimageRamp = new THREE.Group();
  pilgrimageRamp.name = "winding-pilgrimage-ramp";
  const route = [
    new THREE.Vector2(-13.0, 12.2),
    new THREE.Vector2(-4.0, 12.2),
    new THREE.Vector2(-4.0, 4.8),
    new THREE.Vector2(0.0, 4.8),
  ];
  const stepsPerLeg = [12, 10, 10];
  const stepGeometry = new THREE.BoxGeometry(1.85, 0.24, 0.9);
  const totalSteps = stepsPerLeg.reduce((sum, count) => sum + count, 0);
  let stepIndex = 0;
  for (let leg = 0; leg < stepsPerLeg.length; leg++) {
    const from = route[leg];
    const to = route[leg + 1];
    const count = stepsPerLeg[leg];
    const dx = to.x - from.x;
    const dz = to.y - from.y;
    const yaw = Math.atan2(dx, dz);
    for (let i = 0; i < count; i++, stepIndex++) {
      const legT = count === 1 ? 0 : i / (count - 1);
      const climbT = stepIndex / (totalSteps - 1);
      const step = mesh(
        stepGeometry,
        materials.pilgrimageStone,
        `pilgrimage-step-${stepIndex}`,
        0.035
      );
      step.position.set(
        THREE.MathUtils.lerp(from.x, to.x, legT),
        THREE.MathUtils.lerp(12.0, 21.0, climbT),
        THREE.MathUtils.lerp(from.y, to.y, legT)
      );
      step.rotation.y = yaw;
      pilgrimageRamp.add(step);
    }
  }
  terrainSystem.add(pilgrimageRamp);

  terrainSystem.userData.contourLayerCount = contourSpec.layerCount;
  terrainSystem.userData.rampartSegmentCount = 0;
  terrainSystem.userData.buttressCount = 0;
  terrainSystem.userData.watchtowerCount = 0;
  terrainSystem.userData.watchtowerCrenelCount = 0;
  terrainSystem.userData.pilgrimageStepCount = totalSteps;
  terrainSystem.userData.rampTurnCount = route.length - 2;
  return terrainSystem;
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
 * }} [options]
 * @returns {THREE.Group & {update(dt:number, t:number):void}}
 */
export function buildOdysseyCitadel(options = {}) {
  const random = lcg(options.seed ?? 20260808);
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
    brick: makeToon(PALETTE.towerStone, gradientMap),
    brickShade: makeToon(PALETTE.towerShade, gradientMap),
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
    const spread = i === 0 ? 0 : 5.2 + random() * 2.3;
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
  // Layer 1 — 24 × 12 × 24 mega bastion, crenels, gate and timber portico
  // --------------------------------------------------------------------------
  const L1 = CITADEL.layer1;
  const bastionBase = mesh(
    new THREE.BoxGeometry(L1.width, L1.height, L1.depth),
    materials.stone,
    "mega-bastion-box"
  );
  bastionBase.position.set(0.0, 10.0, 0.0);
  layers[1].add(bastionBase);

  // Native-geometry masonry relief: shallow course bands, alternating corner
  // quoins and chipped scars break the otherwise perfectly smooth box without
  // textures, normal maps or global shader state.
  // Tall vertical buttresses replace the previous horizontal stripe courses.
  // Their uninterrupted rise gives the enceinte the reference image's load-
  // bearing rhythm instead of reading as stacked modern concrete slabs.
  for (const x of [-10.2, -7.3, -4.4, 4.4, 7.3, 10.2]) {
    const frontPilaster = mesh(
      new THREE.BoxGeometry(0.24, 10.4, 0.16),
      materials.weatherStone,
      "bastion-vertical-pilaster",
      0.018
    );
    frontPilaster.position.set(x, 10.0, 12.085);
    layers[1].add(frontPilaster);
  }
  for (const side of [-1, 1]) {
    for (const z of [-9.5, -5.5, -1.5, 2.5, 6.5, 10.0]) {
      const sidePilaster = mesh(
        new THREE.BoxGeometry(0.16, 10.4, 0.24),
        materials.weatherStone,
        "bastion-vertical-pilaster",
        0.018
      );
      sidePilaster.position.set(side * 12.085, 10.0, z);
      layers[1].add(sidePilaster);
    }
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 9; row++) {
      const wide = row % 2 === 0;
      const quoin = mesh(
        new THREE.BoxGeometry(wide ? 1.15 : 0.82, 0.62, 0.16),
        materials.stone,
        "bastion-corner-quoin",
        0.022
      );
      quoin.position.set(side * (wide ? 11.48 : 11.62), 5.0 + row * 1.22, 12.09);
      layers[1].add(quoin);
    }
  }
  for (let i = 0; i < 9; i++) {
    const scar = mesh(
      new THREE.BoxGeometry(0.48 + random() * 0.58, 0.09, 0.08),
      materials.weatherStone,
      "bastion-erosion-scar",
      0.012
    );
    scar.position.set(-8.8 + random() * 17.6, 6.0 + random() * 8.6, 12.088);
    scar.rotation.z = (random() - 0.5) * 0.7;
    layers[1].add(scar);
  }

  const merlonCount = addCrenellatedRim(layers[1], materials.stone, {
    halfX: 11.75,
    halfZ: 11.75,
    baseY: 16.0,
    name: "bastion-crenel",
    size: 0.5,
    height: 1.4,
    step: 1.0,
  });

  const gateRecess = mesh(
    new THREE.BoxGeometry(3.0, 4.8, 0.12),
    materials.ink,
    "gate-recess",
    0.03
  );
  gateRecess.position.set(0.0, 6.85, 14.826);
  layers[1].add(gateRecess);

  const lowerGatehouse = mesh(
    new THREE.BoxGeometry(5.4, 7.5, 4.0),
    materials.stone,
    "lower-ceremonial-gatehouse"
  );
  lowerGatehouse.position.set(0, 8.0, 12.78);
  layers[1].add(lowerGatehouse);
  const gatehouseCornice = mesh(
    new THREE.BoxGeometry(5.75, 0.28, 4.35),
    materials.weatherStone,
    "lower-gatehouse-cornice",
    0.024
  );
  gatehouseCornice.position.set(0, 11.68, 12.78);
  layers[1].add(gatehouseCornice);

  // Twin forward octagonal capped towers form the barbican (瓮城). They sit
  // proud of the curtain wall and leave a protected central gate throat.
  const barbicanTowerGeometry = new THREE.CylinderGeometry(2.35, 2.35, 9.2, 8);
  for (const side of [-1, 1]) {
    const x = side * 4.05;
    const tower = mesh(
      barbicanTowerGeometry,
      materials.stone,
      `barbican-${side < 0 ? "left" : "right"}-tower`
    );
    tower.position.set(x, 8.6, 14.0);
    tower.rotation.y = Math.PI / 8;
    layers[1].add(tower);

    const collar = mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 0.34, 8),
      materials.weatherStone,
      "barbican-tower-collar",
      0.028
    );
    collar.position.set(x, 13.18, 14.0);
    collar.rotation.y = Math.PI / 8;
    layers[1].add(collar);

    const cap = buildHalfDome(2.28, materials.gold, "barbican-golden-cap", 1.16);
    cap.position.set(x, 13.32, 14.0);
    layers[1].add(cap);

    const lookout = mesh(
      new THREE.BoxGeometry(0.72, 1.55, 0.08),
      materials.ink,
      "barbican-lookout-window",
      0.018
    );
    lookout.position.set(x, 10.4, 16.31);
    layers[1].add(lookout);
  }

  for (const x of [-1.35, 1.35]) {
    const column = mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 4.2, 5),
      materials.wood,
      "portico-column",
      0.035
    );
    column.position.set(x, 6.95, 15.72);
    layers[1].add(column);
  }

  const pediment = mesh(
    new THREE.ConeGeometry(2.2, 1.0, 4, 1, true),
    materials.wood,
    "inverted-portico-pediment",
    0.04
  );
  pediment.position.set(0.0, 9.45, 15.72);
  pediment.rotation.x = Math.PI;
  pediment.rotation.y = Math.PI / 4;
  layers[1].add(pediment);

  // A pair of shallow lintels makes the open four-sided pediment read as a
  // deliberately cantilevered wooden porch instead of a floating cone.
  for (const z of [15.12, 16.32]) {
    const lintel = mesh(
      new THREE.BoxGeometry(4.7, 0.22, 0.22),
      materials.wood,
      "portico-lintel",
      0.025
    );
    lintel.position.set(0, 8.95, z);
    layers[1].add(lintel);
  }

  // --------------------------------------------------------------------------
  // Layer 2 — recessed grand hall, half-hexagonal bays and bifora windows
  // --------------------------------------------------------------------------
  const L2 = CITADEL.layer2;
  const grandHall = mesh(
    new THREE.BoxGeometry(L2.width, L2.height, L2.depth),
    materials.stone,
    "grand-hall"
  );
  grandHall.position.set(0.0, 21.0, -4.0);
  layers[2].add(grandHall);

  for (const [y, width, depth] of [
    [16.18, 16.55, 16.55],
    [25.82, 16.35, 16.35],
  ]) {
    const cornice = mesh(
      new THREE.BoxGeometry(width, 0.32, depth),
      materials.weatherStone,
      "grand-hall-cornice",
      0.025
    );
    cornice.position.set(0, y, -4);
    layers[2].add(cornice);
  }

  const bayGeometry = new THREE.CylinderGeometry(
    1.2,
    1.2,
    8.0,
    6,
    1,
    false,
    -Math.PI / 2,
    Math.PI
  );
  for (const x of [-6.0, 6.0]) {
    const bay = mesh(bayGeometry, materials.stone, "ribbed-bay");
    bay.position.set(x, 21.0, 4.65);
    layers[2].add(bay);
  }

  const archGeometry = makeArchedWindowGeometry();
  let biforaCount = 0;
  for (const x of [-3.8, 0, 3.8]) {
    addBifora(layers[2], archGeometry, materials.ink, x, 19.0, 4.026);
    addBifora(layers[2], archGeometry, materials.ink, x, 22.4, 4.026);
    biforaCount += 2;
  }
  for (const x of [-6.0, 6.0]) {
    addBifora(layers[2], archGeometry, materials.ink, x, 19.1, 5.87, 0, "bay-bifora");
    addBifora(layers[2], archGeometry, materials.ink, x, 22.2, 5.87, 0, "bay-bifora");
    biforaCount += 2;
  }

  // Exact requested local (6.5, 5.0, 6.5) offset, nested under a terrace
  // datum whose world/local assembly base is Y=11; the dome therefore seats
  // onto the first-layer terrace at world-local Y=16.
  const terraceDatum = new THREE.Group();
  terraceDatum.name = "secondary-dome-terrace-datum";
  terraceDatum.position.y = 11.0;
  const secondaryDome = new THREE.Group();
  secondaryDome.name = "secondary-golden-dome";
  secondaryDome.position.set(
    CITADEL.secondaryDome.localX,
    CITADEL.secondaryDome.localY,
    CITADEL.secondaryDome.localZ
  );
  const secondaryDrum = mesh(
    new THREE.CylinderGeometry(1.85, 2.05, 0.65, 10),
    materials.stone,
    "secondary-dome-drum",
    0.04
  );
  secondaryDrum.position.y = 0.325;
  secondaryDome.add(secondaryDrum);
  const secondaryCap = buildHalfDome(2.2, materials.gold, "secondary-dome-cap", 1.12);
  secondaryCap.position.y = 0.65;
  secondaryDome.add(secondaryCap);
  terraceDatum.add(secondaryDome);
  layers[2].add(terraceDatum);

  // Asymmetric front chapel: a separate lower volume and dome establish the
  // reference painting's stepped near/mid/far silhouette instead of a single
  // centered wedding-cake stack.
  const frontChapel = mesh(
    new THREE.BoxGeometry(6.0, 7.0, 5.2),
    materials.stone,
    "front-chapel"
  );
  frontChapel.position.set(-4.9, 19.5, 5.35);
  layers[2].add(frontChapel);
  const frontChapelCornice = mesh(
    new THREE.BoxGeometry(6.35, 0.28, 5.55),
    materials.weatherStone,
    "front-chapel-cornice",
    0.024
  );
  frontChapelCornice.position.set(-4.9, 22.9, 5.35);
  layers[2].add(frontChapelCornice);
  const frontChapelDome = buildHalfDome(
    2.05,
    materials.gold,
    "front-chapel-dome",
    1.18
  );
  frontChapelDome.position.set(-4.9, 23.0, 5.35);
  layers[2].add(frontChapelDome);
  addBifora(
    layers[2],
    archGeometry,
    materials.ink,
    -4.9,
    19.25,
    7.976,
    0,
    "front-chapel-bifora"
  );
  biforaCount++;

  // A narrower right-rear gallery climbs between the grand hall and the
  // sanctuary, creating a second setback plane visible beside the red tower.
  const steppedGallery = mesh(
    new THREE.BoxGeometry(5.2, 7.0, 6.0),
    materials.stone,
    "stepped-upper-gallery"
  );
  steppedGallery.position.set(4.7, 27.0, -6.25);
  layers[2].add(steppedGallery);
  const galleryCornice = mesh(
    new THREE.BoxGeometry(5.55, 0.25, 6.35),
    materials.weatherStone,
    "stepped-upper-gallery-cornice",
    0.022
  );
  galleryCornice.position.set(4.7, 30.42, -6.25);
  layers[2].add(galleryCornice);

  // Greenery on the cliff claws and exposed terraces. All foliage remains
  // inside the asset and therefore follows the planet tangent frame.
  const shrubSpots = [
    { p: [-9.7, 9.0, 8.6], s: 2.15, layer: 0 },
    { p: [10.6, 8.2, -2.5], s: 1.9, layer: 0 },
    { p: [-8.7, 16.05, 2.2], s: 1.65, layer: 2 },
    { p: [7.8, 16.05, -3.8], s: 1.45, layer: 2 },
    { p: [-1.2, 16.05, 8.6], s: 1.3, layer: 2 },
    { p: [6.6, 24.05, -0.8], s: 1.1, layer: 2 },
    { p: [-8.5, 16.05, 7.2], s: 1.75, layer: 2 },
    { p: [7.2, 16.05, 7.6], s: 1.25, layer: 2 },
  ];
  shrubSpots.forEach(({ p, s, layer }, index) => {
    const shrub = buildCitadelShrub(`citadel-shrub-${index}`, s, materials, random);
    shrub.position.set(...p);
    layers[layer].add(shrub);
  });

  const topiarySpots = [
    { p: [-9.2, 16.12, 7.4], s: 1.0, layer: 1 },
    { p: [-6.3, 16.12, 9.6], s: 0.9, layer: 1 },
    { p: [6.4, 16.12, 8.8], s: 1.08, layer: 1 },
    { p: [9.4, 16.12, 1.2], s: 0.92, layer: 1 },
    { p: [-6.5, 26.1, -0.6], s: 0.95, layer: 2 },
    { p: [6.4, 26.1, -0.8], s: 1.0, layer: 2 },
    { p: [-7.4, 23.12, 6.4], s: 0.84, layer: 2 },
    { p: [2.3, 26.1, 1.8], s: 0.78, layer: 2 },
  ];
  topiarySpots.forEach(({ p, s, layer }, index) => {
    const topiary = buildCitadelRoundTopiary(
      `citadel-round-topiary-${index}`,
      s,
      materials,
      random
    );
    topiary.position.set(...p);
    layers[layer].add(topiary);
  });

  // --------------------------------------------------------------------------
  // Layer 3 — holy sanctuary and the warm-red rectangular brick bastion
  // --------------------------------------------------------------------------
  const L3 = CITADEL.layer3;
  const sanctuary = mesh(
    new THREE.BoxGeometry(L3.width, L3.height, L3.depth),
    materials.stone,
    "holy-sanctuary"
  );
  sanctuary.position.set(0.0, 30.0, -7.5);
  layers[3].add(sanctuary);

  const sanctuaryCornice = mesh(
    new THREE.BoxGeometry(9.45, 0.28, 9.45),
    materials.weatherStone,
    "sanctuary-roof-cornice",
    0.024
  );
  sanctuaryCornice.position.set(0, 33.88, -7.5);
  layers[3].add(sanctuaryCornice);

  const leftUpperKeep = mesh(
    new THREE.BoxGeometry(4.8, 7.4, 5.2),
    materials.stone,
    "left-upper-keep"
  );
  leftUpperKeep.position.set(-5.65, 28.9, -7.2);
  layers[3].add(leftUpperKeep);
  const leftKeepCornice = mesh(
    new THREE.BoxGeometry(5.15, 0.25, 5.55),
    materials.weatherStone,
    "left-upper-keep-cornice",
    0.022
  );
  leftKeepCornice.position.set(-5.65, 32.52, -7.2);
  layers[3].add(leftKeepCornice);
  const leftKeepDome = buildHalfDome(1.55, materials.gold, "left-upper-keep-dome", 1.2);
  leftKeepDome.position.set(-5.65, 32.62, -7.2);
  layers[3].add(leftKeepDome);

  const slitGeometry = new THREE.BoxGeometry(0.28, 1.65, 0.055);
  for (const x of [-2.2, 0, 2.2]) {
    const front = mesh(slitGeometry, materials.ink, "sanctuary-slit", 0.018);
    front.position.set(x, 30.0, -2.972);
    layers[3].add(front);
    const back = mesh(slitGeometry, materials.ink, "sanctuary-slit", 0.018);
    back.position.set(x, 30.0, -12.028);
    back.rotation.y = Math.PI;
    layers[3].add(back);
  }
  for (const z of [-9.7, -5.3]) {
    for (const side of [-1, 1]) {
      const slit = mesh(slitGeometry, materials.ink, "sanctuary-slit", 0.018);
      slit.position.set(side * 4.528, 30.0, z);
      slit.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      layers[3].add(slit);
    }
  }

  const B = CITADEL.bastion;
  const brickBastion = mesh(
    new THREE.BoxGeometry(B.width, B.height, B.depth),
    materials.brick,
    "brick-bastion"
  );
  brickBastion.position.set(9.0, 16.0, 5.0);
  layers[3].add(brickBastion);

  const bastionWindow = mesh(
    new THREE.BoxGeometry(2.6, 2.6, 0.12),
    materials.ink,
    "bastion-high-window",
    0.03
  );
  bastionWindow.position.set(9.0, 20.4, 7.256);
  layers[3].add(bastionWindow);

  const bastionBalcony = mesh(
    new THREE.BoxGeometry(3.6, 0.35, 1.25),
    materials.brick,
    "bastion-window-balcony",
    0.035
  );
  bastionBalcony.position.set(9.0, 18.92, 7.72);
  layers[3].add(bastionBalcony);

  // Shallow fired-brick course marks and damaged corner blocks create age
  // without adding textures or shader branches.
  for (let row = 0; row < 6; row++) {
    const course = mesh(
      new THREE.BoxGeometry(4.56, 0.08, 0.07),
      materials.brickShade,
      "bastion-brick-course",
      0.012
    );
    course.position.set(9.0, 10.7 + row * 2.25, 7.281);
    layers[3].add(course);
  }
  addCrenellatedRim(layers[3], materials.brick, {
    halfX: 2.0,
    halfZ: 2.0,
    baseY: 24.0,
    name: "brick-bastion-crenel",
    size: 0.48,
    height: 1.25,
    step: 1.0,
  });
  // The helper is centered on the origin; translate only these top merlons to
  // the locked bastion position after creation.
  layers[3].children
    .filter((child) => child.name === "brick-bastion-crenel")
    .forEach((child) => {
      child.position.x += B.x;
      child.position.z += B.z;
    });

  for (const [index, p] of [
    [topiarySpots.length, [9.0, 24.18, 5.0]],
    [topiarySpots.length + 1, [-3.7, 34.12, -6.2]],
    [topiarySpots.length + 2, [3.8, 34.12, -8.8]],
  ]) {
    const topiary = buildCitadelRoundTopiary(
      `citadel-round-topiary-${index}`,
      0.82,
      materials,
      random
    );
    topiary.position.set(...p);
    layers[3].add(topiary);
  }

  // Left-side octagonal defense tower: upright stone shaft, wider lookout
  // drum, three dark observation windows and an ivory cap. It balances the
  // right outwork without introducing a sunset-orange material accent.
  const leftDefense = new THREE.Group();
  leftDefense.name = "left-octagonal-defense-tower";
  leftDefense.position.set(-11.2, 0, 2.4);
  const leftDefenseShaft = mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 17.0, 8),
    materials.stone,
    "left-defense-tower-shaft"
  );
  leftDefenseShaft.position.y = 13.0;
  leftDefenseShaft.rotation.y = Math.PI / 8;
  leftDefense.add(leftDefenseShaft);
  const leftDefenseDrum = mesh(
    new THREE.CylinderGeometry(2.9, 2.9, 3.8, 8),
    materials.stone,
    "left-defense-tower-lookout-drum"
  );
  leftDefenseDrum.position.y = 23.35;
  leftDefenseDrum.rotation.y = Math.PI / 8;
  leftDefense.add(leftDefenseDrum);
  const leftWindowGeometry = new THREE.BoxGeometry(0.72, 1.45, 0.08);
  for (const [x, z, rotationY] of [
    [0, 2.93, 0],
    [-2.93, 0, -Math.PI / 2],
    [2.93, 0, Math.PI / 2],
  ]) {
    const window = mesh(
      leftWindowGeometry,
      materials.ink,
      "left-defense-lookout-window",
      0.017
    );
    window.position.set(x, 23.35, z);
    window.rotation.y = rotationY;
    leftDefense.add(window);
  }
  const leftDefenseCollar = mesh(
    new THREE.CylinderGeometry(3.08, 3.08, 0.32, 8),
    materials.weatherStone,
    "left-defense-tower-collar",
    0.028
  );
  leftDefenseCollar.position.y = 25.25;
  leftDefense.add(leftDefenseCollar);
  const leftDefenseCap = buildHalfDome(
    2.85,
    materials.gold,
    "left-defense-tower-ivory-cap",
    1.16
  );
  leftDefenseCap.position.y = 25.42;
  leftDefense.add(leftDefenseCap);
  layers[3].add(leftDefense);

  // Two slender flanking minarets remain subordinate to the central crown.
  layers[3].add(buildMinaret("minaret-left", -12.5, -6.5, materials));
  layers[3].add(buildMinaret("minaret-right", 12.5, -6.5, materials));

  // --------------------------------------------------------------------------
  // Layer 4 — three-step Byzantine crown, ink ribs and needle finial
  // --------------------------------------------------------------------------
  const domeCrown = new THREE.Group();
  domeCrown.name = "royal-dome-crown";
  domeCrown.position.set(0.0, 34.0, -7.5);

  // Open-looking dark drum with pale columns gives the crown a separate
  // architectural tier, matching the reference rotunda rather than placing a
  // dome directly on a plain cube.
  const rotundaCore = mesh(
    new THREE.CylinderGeometry(2.82, 2.95, 2.6, 12),
    materials.ink,
    "main-dome-rotunda-core",
    0.035
  );
  rotundaCore.position.y = 1.3;
  domeCrown.add(rotundaCore);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const column = mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 2.45, 5),
      materials.stone,
      "main-dome-rotunda-column",
      0.018
    );
    column.position.set(Math.cos(angle) * 2.72, 1.3, Math.sin(angle) * 2.72);
    domeCrown.add(column);
  }
  for (const y of [0.12, 2.5]) {
    const rotundaRing = mesh(
      new THREE.CylinderGeometry(3.12, 3.2, 0.3, 16),
      materials.stone,
      "main-dome-rotunda-ring",
      0.035
    );
    rotundaRing.position.y = y;
    domeCrown.add(rotundaRing);
  }

  const domeShell = new THREE.Group();
  domeShell.name = "main-dome-shell";
  domeShell.position.y = 2.62;

  const mainDome = buildHalfDome(
    CITADEL.mainDome.radius,
    materials.gold,
    "main-onion-dome",
    CITADEL.mainDome.stretchY
  );
  mainDome.position.y = 0.0;
  domeShell.add(mainDome);
  addDomeRibs(domeShell, materials.goldShade, 3.5, 1.35);
  domeCrown.add(domeShell);

  const finialBase = mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    materials.gold,
    "finial-golden-knot",
    0.025
  );
  finialBase.position.y = 7.24;
  domeCrown.add(finialBase);
  layers[4].add(domeCrown);

  const finial = mesh(
    new THREE.CylinderGeometry(0.025, 0.025, CITADEL.finialHeight, 6),
    materials.ink,
    "needle-finial",
    0.018
  );
  const finialStartY = 41.12;
  finial.position.set(0.0, finialStartY + CITADEL.finialHeight / 2, -7.5);
  layers[4].add(finial);

  for (const layer of layers) citadelAssembly.add(layer);
  citadelAssembly.scale.setScalar(CITADEL.mainCastleScale);
  citadelAssembly.position.y = CITADEL.mainCastleLift;
  const mainOutlinedSurfaceCount = applyInkOutlines(citadelAssembly);

  const outerTerrainSystem = buildOuterCitadelTerrain(materials);
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
  castleContainer.userData.layers = layers;
  castleContainer.userData.mainCastle = citadelAssembly;
  castleContainer.userData.outerTerrainSystem = outerTerrainSystem;
  castleContainer.userData.merlonCount = merlonCount;
  castleContainer.userData.biforaCount = biforaCount;
  castleContainer.userData.mainOutlinedSurfaceCount = mainOutlinedSurfaceCount;
  castleContainer.userData.terrainOutlinedSurfaceCount = terrainOutlinedSurfaceCount;
  castleContainer.userData.outlinedSurfaceCount =
    mainOutlinedSurfaceCount + terrainOutlinedSurfaceCount;
  castleContainer.userData.gradientMap = gradientMap;

  return castleContainer;
}
