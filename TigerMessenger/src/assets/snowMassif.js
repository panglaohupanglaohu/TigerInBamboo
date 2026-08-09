// =====================================================================
//  雪山单元（Snow Massif）
//  原 citadelRange 背景雪峰：多座独立峰 + 中央连鞍，封装为一组可摆放单元。
//  局部约定：+Y 向上，底脚约 Y=0（峰脚可微负以“扎进”地面）。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

const ROCK = 0x7893a1;
const SNOW = 0xf1f4ed;
const OUTLINE = 0x1c2523;

/** 圣城背后默认峰群（相对锚点局部 x/z；y=lift 为脚部下嵌） */
export const CITADEL_SNOW_MASSIF_PEAKS = Object.freeze([
  { x: -57.5, z: -18, r: 11, h: 52, lift: -1.4, seed: 7100 },
  { x: -33.5, z: 8, r: 16, h: 74, lift: -1.6, seed: 7101 },
  { x: -10.5, z: -2, r: 15, h: 86, lift: -1.8, seed: 7102 },
  { x: 10.5, z: 2, r: 20, h: 98, lift: -1.8, seed: 7103 },
  { x: 35.5, z: 6, r: 18, h: 88, lift: -1.7, seed: 7104 },
  { x: 59.5, z: -14, r: 12, h: 61, lift: -1.5, seed: 7105 },
]);

/** 锚点：圣城山脉局部坐标（placeRangeAsset 用） */
export const CITADEL_SNOW_MASSIF_ANCHOR = Object.freeze({ x: -0.5, z: -70 });

function part(geometry, material, name, outline = 0.04) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline, OUTLINE, 0);
  return mesh;
}

function makeMountainGeometry(radius, height, seed, segments = 10) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const levels = [0, 0.3, 0.57, 0.76, 0.9];
  const positions = [];
  for (let ring = 0; ring < levels.length; ring++) {
    const t = levels[ring];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const taper = Math.max(0.2, Math.pow(1 - t, 0.72));
      const jag = 0.82 + random() * 0.34;
      const r = radius * taper * jag;
      positions.push(
        Math.cos(angle) * r,
        height * t * (0.96 + random() * 0.06),
        Math.sin(angle) * r
      );
    }
  }
  const indices = [];
  for (let ring = 0; ring < levels.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = ring * segments + i;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + i;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const topCenter = positions.length / 3;
  positions.push(0, height * 0.88, 0);
  const topRing = levels.length - 1;
  for (let i = 0; i < segments; i++) {
    indices.push(topRing * segments + i, topCenter, topRing * segments + (i + 1) % segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeSnowCapGeometry(radius, height, seed, segments = 10) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1103515245, state) + 12345) >>> 0;
    return state / 0x100000000;
  };
  const positions = [];
  const topRing = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const t = 0.58 + random() * 0.13;
    const r = radius * Math.pow(1 - t, 0.72) * 1.04;
    positions.push(Math.cos(angle) * r, height * t, Math.sin(angle) * r);
    const topAngle = angle + 0.08 * Math.sin(i * 2.3);
    const topRadius = radius * (0.16 + random() * 0.05);
    topRing.push(
      Math.cos(topAngle) * topRadius,
      height * (0.875 + random() * 0.035),
      Math.sin(topAngle) * topRadius
    );
  }
  positions.push(...topRing);
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(i, segments + i, next, next, segments + i, segments + next);
  }
  const summitCenter = positions.length / 3;
  positions.push(0, height * 0.89, 0);
  for (let i = 0; i < segments; i++) {
    indices.push(segments + i, summitCenter, segments + (i + 1) % segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeConnectedSaddleGeometry(length, width, height) {
  const xs = [-length / 2, 0, length / 2];
  const ridgeY = [height * 0.82, height * 0.58, height * 0.9];
  const positions = [];
  for (let i = 0; i < xs.length; i++) {
    positions.push(xs[i], 0, -width / 2, xs[i], 0, width / 2);
    positions.push(xs[i], ridgeY[i], -width * 0.22, xs[i], ridgeY[i], width * 0.22);
  }
  const indices = [];
  for (let section = 0; section < 2; section++) {
    const a = section * 4;
    const b = (section + 1) * 4;
    indices.push(a, b, a + 2, a + 2, b, b + 2);
    indices.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
    indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 单座雪峰（岩体 + 雪帽）
 * @param {{ name?: string, radius?: number, height?: number, seed?: number }} [opts]
 */
export function createSnowMountainPeak(opts = {}) {
  const name = opts.name || "snow-mountain-peak";
  const radius = opts.radius ?? 16;
  const height = opts.height ?? 74;
  const seed = opts.seed ?? 7100;
  const rockMat = opts.rockMat || toonMat(ROCK, { flatShading: true });
  const snowMat = opts.snowMat || toonMat(SNOW, { flatShading: true });

  const mountain = new THREE.Group();
  mountain.name = name;
  mountain.add(
    part(makeMountainGeometry(radius, height, seed), rockMat, `${name}-rock`, 0.075)
  );
  mountain.add(
    part(
      makeSnowCapGeometry(radius, height, seed + 91),
      snowMat,
      `${name}-snow-cap`,
      0.055
    )
  );
  mountain.userData.kind = "snowMountainPeak";
  mountain.userData.radius = radius;
  mountain.userData.height = height;
  mountain.userData.seed = seed;
  return mountain;
}

/**
 * 中央双峰连鞍
 * @param {{ name?: string }} [opts]
 */
export function createSnowMassifSaddle(opts = {}) {
  const rockMat = opts.rockMat || toonMat(ROCK, { flatShading: true });
  const snowMat = opts.snowMat || toonMat(SNOW, { flatShading: true });
  const saddle = new THREE.Group();
  saddle.name = opts.name || "snow-massif-saddle";
  saddle.userData.connectsMountainIndices = [2, 3];
  const rock = part(
    makeConnectedSaddleGeometry(28, 15, 48),
    rockMat,
    "snow-massif-saddle-rock",
    0.055
  );
  saddle.add(rock);
  const snow = part(
    makeConnectedSaddleGeometry(28.4, 6.8, 48.6),
    snowMat,
    "snow-massif-saddle-cap",
    0.035
  );
  snow.position.y = 0.22;
  saddle.add(snow);
  saddle.userData.kind = "snowMassifSaddle";
  return saddle;
}

/**
 * 雪山组单元：默认圣城背后六峰 + 中央连鞍。
 * @param {{
 *   name?: string,
 *   peaks?: typeof CITADEL_SNOW_MASSIF_PEAKS,
 *   includeSaddle?: boolean,
 *   seed?: number,
 * }} [opts]
 */
export function createSnowMassif(opts = {}) {
  const group = new THREE.Group();
  group.name = opts.name || "snow-massif";
  const peaks = opts.peaks || CITADEL_SNOW_MASSIF_PEAKS;
  const rockMat = toonMat(ROCK, { flatShading: true });
  const snowMat = toonMat(SNOW, { flatShading: true });

  const seedBase = opts.seed ?? 0;
  peaks.forEach((spec, i) => {
    const mountain = createSnowMountainPeak({
      name: `snow-massif-peak-${i}`,
      radius: spec.r,
      height: spec.h,
      seed: (spec.seed ?? 7100) + seedBase,
      rockMat,
      snowMat,
    });
    // 局部平面布局：x/z 为峰位，y=lift 扎进地面
    mountain.position.set(spec.x, spec.lift ?? -1.6, spec.z);
    mountain.userData.composition = {
      height: spec.h,
      radius: spec.r,
      depth: spec.z,
      connectedCentralPeak: i === 2 || i === 3,
    };
    group.add(mountain);
  });

  if (opts.includeSaddle !== false) {
    const saddle = createSnowMassifSaddle({ rockMat, snowMat });
    saddle.position.set(0, -1.8, 0);
    group.add(saddle);
  }

  // 包围半径：供地图编辑器碰撞/选中
  let maxR = 40;
  for (const p of peaks) {
    maxR = Math.max(maxR, Math.hypot(p.x, p.z) + (p.r || 12));
  }
  group.userData.kind = "snowMassif";
  group.userData.assetType = "snowMassif";
  group.userData.collideRadius = maxR * 0.55;
  group.userData.peakCount = peaks.length;
  group.userData.seed = opts.seed ?? 7100;
  return group;
}
