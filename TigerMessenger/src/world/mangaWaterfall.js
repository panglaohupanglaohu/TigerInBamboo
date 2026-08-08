import * as THREE from "three";
import { addOutline, toonMat } from "../assets/toon.js";

const WATERFALL_SPEC = Object.freeze({
  curtainCount: 4,
  curtainWidth: 4.5,
  curtainHeight: 16.0,
  curtainDepthStep: 0.05,
  defaultTopY: 40.5,
  defaultWaterlineY: 25.0,
  waterlinePenetration: 0.5,
  mistCount: 20,
  rippleCount: 3,
  outline: 0.04,
});

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function outlinedMesh(geometry, material, name, outline = WATERFALL_SPEC.outline) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  addOutline(result, outline);
  return result;
}

/**
 * Build a headless-safe layered manga waterfall without mutating global state.
 * Defaults lock the authored 40.5 → 24.5 curtain. Deployment code may supply
 * another top/waterline pair; the source PlaneGeometry remains 4.5 × 16 and is
 * scaled vertically to meet the receiving pool exactly.
 *
 * @param {{topY?:number, waterlineY?:number, seed?:number}} [options]
 * @returns {THREE.Group & {update(dt:number,t:number):void}}
 */
export function createMangaWaterfall(options = {}) {
  const random = lcg(options.seed ?? 20260809);
  const topY = Number.isFinite(options.topY)
    ? options.topY
    : WATERFALL_SPEC.defaultTopY;
  const waterlineY = Number.isFinite(options.waterlineY)
    ? options.waterlineY
    : WATERFALL_SPEC.defaultWaterlineY;
  const curtainBottomY = waterlineY - WATERFALL_SPEC.waterlinePenetration;
  const fallHeight = Math.max(0.8, topY - curtainBottomY);
  const curtainCenterY = (topY + curtainBottomY) * 0.5;
  const curtainScaleY = fallHeight / WATERFALL_SPEC.curtainHeight;

  const waterfallGroup = new THREE.Group();
  waterfallGroup.name = "waterfallGroup";

  const curtainGroup = new THREE.Group();
  curtainGroup.name = "manga-waterfall-layered-curtains";
  const curtainMaterial = toonMat(0x93cfca, {
    flatShading: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const curtainGeometry = new THREE.PlaneGeometry(
    WATERFALL_SPEC.curtainWidth,
    WATERFALL_SPEC.curtainHeight
  );
  for (let i = 0; i < WATERFALL_SPEC.curtainCount; i++) {
    const curtain = outlinedMesh(
      curtainGeometry,
      curtainMaterial,
      `manga-waterfall-curtain-${i}`
    );
    curtain.position.set(
      Math.sin(i) * 0.1,
      curtainCenterY,
      i === 0 ? 0 : -i * WATERFALL_SPEC.curtainDepthStep
    );
    curtain.scale.y = curtainScaleY;
    curtain.renderOrder = 2 + i;
    curtain.userData.depthOffset = i === 0 ? 0 : -i * WATERFALL_SPEC.curtainDepthStep;
    curtainGroup.add(curtain);
  }
  waterfallGroup.add(curtainGroup);

  const streakGroup = new THREE.Group();
  streakGroup.name = "manga-waterfall-calligraphic-flow-streaks";
  const streakMaterial = toonMat(0xdff7ed, {
    flatShading: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 8; i++) {
    const width = 0.12 + random() * 0.2;
    const lengthRatio = 0.7 + random() * 0.28;
    const streak = outlinedMesh(
      new THREE.PlaneGeometry(width, WATERFALL_SPEC.curtainHeight),
      streakMaterial,
      `manga-waterfall-flow-streak-${i}`,
      0.012
    );
    streak.scale.y = curtainScaleY * lengthRatio;
    streak.position.set(
      -1.82 + (i / 7) * 3.64 + (random() - 0.5) * 0.16,
      topY - WATERFALL_SPEC.curtainHeight * streak.scale.y * 0.5
        - random() * Math.min(0.34, fallHeight * 0.06),
      0.035 + i * 0.002
    );
    streak.renderOrder = 7;
    streakGroup.add(streak);
  }
  waterfallGroup.add(streakGroup);

  const lipFoamGroup = new THREE.Group();
  lipFoamGroup.name = "manga-waterfall-cliff-lip-foam";
  const lipFoamMaterial = toonMat(0xf0fdf4, { flatShading: true });
  for (let i = 0; i < 7; i++) {
    const foam = outlinedMesh(
      new THREE.IcosahedronGeometry(0.25 + random() * 0.2, 0),
      lipFoamMaterial,
      `manga-waterfall-lip-foam-${i}`,
      0.018
    );
    foam.position.set(-2.15 + i * 0.72, topY - 0.08 + random() * 0.16, 0.08);
    foam.scale.set(1.25 + random() * 0.55, 0.48 + random() * 0.24, 0.7);
    foam.rotation.y = random() * Math.PI;
    lipFoamGroup.add(foam);
  }
  waterfallGroup.add(lipFoamGroup);

  const mistGroup = new THREE.Group();
  mistGroup.name = "manga-waterfall-billowing-mist";
  const mistMaterial = toonMat(0xf4f7ed, { flatShading: true });
  const mistParticles = [];
  for (let i = 0; i < WATERFALL_SPEC.mistCount; i++) {
    const radius = 0.5 + random() * 0.7;
    const puff = outlinedMesh(
      new THREE.IcosahedronGeometry(radius, 0),
      mistMaterial,
      `manga-waterfall-mist-${i}`
    );
    const angle = random() * Math.PI * 2;
    const spread = 0.35 + random() * 2.9;
    puff.position.set(
      Math.cos(angle) * spread * 1.2,
      waterlineY + 0.12 + random() * 1.4,
      Math.sin(angle) * spread * 0.42
    );
    puff.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    puff.scale.set(
      1.05 + random() * 0.75,
      0.48 + random() * 0.52,
      0.8 + random() * 0.55
    );
    puff.userData.baseY = puff.position.y;
    puff.userData.phase = random() * Math.PI * 2;
    mistParticles.push(puff);
    mistGroup.add(puff);
  }
  waterfallGroup.add(mistGroup);

  const rippleGroup = new THREE.Group();
  rippleGroup.name = "manga-waterfall-waterline-ripples";
  const rippleMaterial = toonMat(0xa9dfbf, {
    flatShading: true,
    transparent: true,
    opacity: 0.56,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const ripples = [];
  [2.7, 3.8, 5.0].forEach((radius, index) => {
    const ripple = outlinedMesh(
      new THREE.CircleGeometry(radius, 28),
      rippleMaterial,
      `manga-waterfall-ripple-${index}`
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = waterlineY + 0.01 + index * 0.006;
    ripple.scale.z = 0.58;
    ripple.renderOrder = 8 + index;
    ripple.userData.baseScale = 0.88 + index * 0.1;
    ripples.push(ripple);
    rippleGroup.add(ripple);
  });
  waterfallGroup.add(rippleGroup);

  const update = (_dt = 0, t = 0) => {
    mistParticles.forEach((puff, index) => {
      puff.position.y = puff.userData.baseY
        + Math.sin(t * 1.35 + puff.userData.phase) * (0.06 + (index % 3) * 0.015);
    });
    ripples.forEach((ripple, index) => {
      const pulse = ripple.userData.baseScale
        + 0.035 * Math.sin(t * 1.15 - index * 0.9);
      ripple.scale.x = pulse;
      ripple.scale.y = pulse;
    });
  };
  waterfallGroup.update = update;
  waterfallGroup.userData.update = update;
  waterfallGroup.userData.spec = WATERFALL_SPEC;
  waterfallGroup.userData.topY = topY;
  waterfallGroup.userData.waterlineY = waterlineY;
  waterfallGroup.userData.curtainBottomY = curtainBottomY;
  return waterfallGroup;
}

export { WATERFALL_SPEC };
