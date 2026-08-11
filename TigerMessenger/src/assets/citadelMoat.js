// =====================================================================
//  高山圣城护城河（Citadel Moat）
//  平涂插画风环形水面：硬边多边形 · roughness=1 / Basic 无高光 ·
//  阶梯量化水波 · 方块浪花点缀。不改动五层台地几何，仅作为外围水体。
//
//  局部约定：+Y 向上，水面约 Y=waterY，环心在原点（与城堡台地圆心对齐）。
//  默认内径略大于 baseRadius(24)，外径约 33，环绕最外层台地墙脚。
// =====================================================================
import * as THREE from "three";
import { toonMat } from "./toon.js";
import {
  SHARED_WATER_COLOR,
  createCanalWaterMaterial,
  sweepPrism,
  CANAL_DEPTH,
  CANAL_WALL_THICK,
  CANAL_LIP_WIDTH,
  CANAL_LIP_THICK,
  CANAL_BANK_COLOR,
  CANAL_LIP_COLOR,
} from "../world/canalSystem.js";

/** 默认尺寸：紧贴第五层台地外侧，不侵入台面 */
export const CITADEL_MOAT_SPEC = Object.freeze({
  innerRadius: 26.4,
  outerRadius: 33.2,
  thetaSegments: 14,
  radialSegments: 3,
  wallDepth: 0.42,
  waterY: 0.16,
  /** 阶梯动画：每秒跳动次数（插画定格感） */
  stepHz: 3.5,
  foamCount: 18,
  /** 与星海运河同一水色（createCanalWaterMaterial） */
  waterColor: SHARED_WATER_COLOR,
  borderColor: 0xb8c0c2,
  foamColor: 0xf2f5f3,
});

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * 平涂水面材质：优先 Basic（完全不受光）；
 * 若调用方要求 Standard，则 roughness=1 杀掉高光。
 */
function makeWaterMaterial(color, { useBasic = true } = {}) {
  if (useBasic) {
    return new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      // 略透明让底下岸壁隐约可见，仍保持平涂
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
}

function makeBorderMaterial(color) {
  // 岸石：完全粗糙平涂，契合灰白建筑底座
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 1.0,
    metalness: 0.0,
  });
}

/**
 * 构建多边形环状护城河。
 * @param {{
 *   seed?: number,
 *   innerRadius?: number,
 *   outerRadius?: number,
 *   thetaSegments?: number,
 *   waterColor?: number|string,
 *   borderColor?: number|string,
 *   name?: string,
 * }} [opts]
 * @returns {THREE.Group}
 */
export function createCitadelMoat(opts = {}) {
  const seed = opts.seed ?? 8801;
  const random = lcg(seed);
  const innerR = opts.innerRadius ?? CITADEL_MOAT_SPEC.innerRadius;
  const outerR = opts.outerRadius ?? CITADEL_MOAT_SPEC.outerRadius;
  const segs = opts.thetaSegments ?? CITADEL_MOAT_SPEC.thetaSegments;
  const radialSegs = opts.radialSegments ?? CITADEL_MOAT_SPEC.radialSegments;
  const waterY = opts.waterY ?? CITADEL_MOAT_SPEC.waterY;
  const wallDepth = opts.wallDepth ?? CITADEL_MOAT_SPEC.wallDepth;
  const waterColor = opts.waterColor ?? CITADEL_MOAT_SPEC.waterColor;
  const borderColor = opts.borderColor ?? CITADEL_MOAT_SPEC.borderColor;
  const foamColor = opts.foamColor ?? CITADEL_MOAT_SPEC.foamColor;
  const stepHz = opts.stepHz ?? CITADEL_MOAT_SPEC.stepHz;
  const foamCount = opts.foamCount ?? CITADEL_MOAT_SPEC.foamCount;

  const group = new THREE.Group();
  group.name = opts.name ?? "citadel-moat";

  // 水面：与运河同一套 Physical 材质（色相+透明度+清漆），不再用 Basic 平涂
  const waterMat =
    opts.waterMaterial
    ?? (waterColor === SHARED_WATER_COLOR
      ? createCanalWaterMaterial()
      : makeWaterMaterial(waterColor, { useBasic: false }));
  const borderMat = makeBorderMaterial(borderColor);
  const foamMat = new THREE.MeshBasicMaterial({ color: foamColor });

  // ---------- 1. 运河同款剖面环扫：河床/水面/内外立壁/岸顶土埂 ----------
  // 与星海运河同一套护堤语言（立壁土色+岸顶土埂）；水系打通处
  // （opts.embankGapAt(lx,lz) 为 true 的弧段）仅护堤断开，水面/河床连续。
  const half = (outerR - innerR) * 0.5;
  const midR = (innerR + outerR) * 0.5;
  const ringSegs = Math.max(96, opts.thetaSegments ?? 240);
  // 河床基准局部高：水面 = waterY-0.035（略低于运河水面防共面闪），
  // 水深 0.585 与运河 WATER_FILL 同量级
  const bedLocalY = waterY - 0.62;
  const waterH = waterY - 0.035 - bedLocalY;
  const samples = [];
  for (let i = 0; i <= ringSegs; i++) {
    const th = (i / ringSegs) * Math.PI * 2;
    const sx = Math.sin(th), cz = Math.cos(th);
    const gapAt = typeof opts.embankGapAt === "function"
      ? opts.embankGapAt(sx * midR, cz * midR)
      : false;
    samples.push({
      p: new THREE.Vector3(sx * midR, bedLocalY, cz * midR),
      up: new THREE.Vector3(0, 1, 0),
      right: new THREE.Vector3(sx, 0, cz), // 朝环外
      gap: false,
      embankGap: !!gapAt,
    });
  }

  const bedMat = toonMat(0x3a2f26, { flatShading: true });
  const bankMat = toonMat(CANAL_BANK_COLOR, { flatShading: true });
  const lipMat = toonMat(CANAL_LIP_COLOR, { flatShading: true });

  const bed = sweepPrism(samples, -half, half, -0.02, 0.02, bedMat);
  bed.name = "citadel-moat-bed";
  bed.receiveShadow = true;
  group.add(bed);

  const water = sweepPrism(samples, -half + 0.04, half - 0.04, waterH - 0.02, waterH + 0.02, waterMat);
  water.name = "citadel-moat-water";
  water.renderOrder = 2;
  water.castShadow = false;
  water.receiveShadow = true;
  // 阶梯水波动画基高
  {
    const wp = water.geometry.attributes.position;
    const baseY = new Float32Array(wp.count);
    for (let i = 0; i < wp.count; i++) baseY[i] = wp.getY(i);
    water.geometry.userData.baseY = baseY;
  }
  group.add(water);

  // 内外立壁 + 岸顶土埂（护堤，打通处断开）
  const innerWall = sweepPrism(samples, -half - CANAL_WALL_THICK, -half, 0, CANAL_DEPTH, bankMat, "embankGap");
  innerWall.name = "citadel-moat-inner-wall";
  innerWall.receiveShadow = true;
  group.add(innerWall);
  const outerWall = sweepPrism(samples, half, half + CANAL_WALL_THICK, 0, CANAL_DEPTH, bankMat, "embankGap");
  outerWall.name = "citadel-moat-outer-wall";
  outerWall.receiveShadow = true;
  group.add(outerWall);
  const innerLip = sweepPrism(samples, -half - CANAL_LIP_WIDTH, -half - CANAL_WALL_THICK * 0.5, CANAL_DEPTH - CANAL_LIP_THICK * 0.2, CANAL_DEPTH + CANAL_LIP_THICK, lipMat, "embankGap");
  innerLip.name = "citadel-moat-inner-lip";
  group.add(innerLip);
  const outerLip = sweepPrism(samples, half + CANAL_WALL_THICK * 0.5, half + CANAL_LIP_WIDTH, CANAL_DEPTH - CANAL_LIP_THICK * 0.2, CANAL_DEPTH + CANAL_LIP_THICK, lipMat, "embankGap");
  outerLip.name = "citadel-moat-outer-lip";
  group.add(outerLip);

  // ---------- 3. 白色块状浪花（压扁方块，零星漂浮）----------
  const foams = new THREE.Group();
  foams.name = "citadel-moat-foam";
  const foamMeta = [];
  for (let i = 0; i < foamCount; i++) {
    const ang = random() * Math.PI * 2;
    const rr = THREE.MathUtils.lerp(innerR + 0.55, outerR - 0.55, 0.2 + random() * 0.6);
    const sx = 0.22 + random() * 0.28;
    const sz = 0.16 + random() * 0.22;
    const foam = new THREE.Mesh(
      new THREE.BoxGeometry(sx, 0.05 + random() * 0.03, sz),
      foamMat
    );
    foam.name = "citadel-moat-foam-chunk";
    foam.position.set(Math.cos(ang) * rr, waterY + 0.04, Math.sin(ang) * rr);
    foam.rotation.y = random() * Math.PI;
    foams.add(foam);
    foamMeta.push({
      mesh: foam,
      baseY: foam.position.y,
      phase: random() * Math.PI * 2,
      amp: 0.012 + random() * 0.02,
    });
  }
  group.add(foams);

  // ---------- 4. 阶梯量化水波动画 ----------
  const update = (_dt, t) => {
    const time = Number.isFinite(t) ? t : 0;
    const stepped = Math.floor(time * stepHz) / stepHz;
    const moatPos = water.geometry.attributes.position;
    const initial = water.geometry.userData.baseY;
    for (let i = 0; i < moatPos.count; i++) {
      const x = moatPos.getX(i);
      const z = moatPos.getZ(i);
      const radius = Math.sqrt(x * x + z * z);
      const wave =
        Math.sin(radius * 1.45 - stepped * 1.5) * 0.045 +
        Math.cos(x * 0.48 + stepped) * 0.028;
      moatPos.setY(i, (initial?.[i] ?? 0) + wave);
    }
    moatPos.needsUpdate = true;
    // 阶梯帧下偶发重算法线，维持块状明暗；每帧算太贵且会抹掉硬边感
    if (Math.floor(time * stepHz) !== Math.floor((time - (_dt || 0.016)) * stepHz)) {
      water.geometry.computeVertexNormals();
    }
    // 浪花极慢阶梯起伏
    const foamStep = Math.floor(time * 2) / 2;
    for (const entry of foamMeta) {
      entry.mesh.position.y =
        entry.baseY + Math.sin(foamStep * 1.1 + entry.phase) * entry.amp;
    }
  };

  group.userData.kind = "citadel-moat";
  group.userData.update = update;
  group.update = update;
  group.userData.moatSpec = {
    innerRadius: innerR,
    outerRadius: outerR,
    midRadius: (innerR + outerR) * 0.5,
    waterY,
    wallDepth,
    thetaSegments: segs,
  };
  /** 港口建议锚点：外岸前侧偏左（避开正前瀑布水道） */
  group.userData.harborPadLocal = moatHarborPadLocal(innerR, outerR);
  return group;
}

/**
 * 护城河外岸港口垫位置（局部 xz，朝向河心的 +X 方向）。
 * 前侧偏左，避开 notch 瀑布中轴（约 +z 方向 x≈3）。
 *
 * 旧港码头的渔船在局部 +X≈8；垫点放在 midR+8 的外岸，
 * 使栈桥伸入环带、船系泊在水面中线附近。
 */
export function moatHarborPadLocal(
  innerR = CITADEL_MOAT_SPEC.innerRadius,
  outerR = CITADEL_MOAT_SPEC.outerRadius
) {
  // θ 从 +Z 起算；取前侧偏左（-x），避开正前瀑布水道
  const theta = -0.72; // ≈ -41°
  const midR = (innerR + outerR) * 0.5;
  // 码头桩脚在外岸草地上；船局部 x≈8 朝河心 → 落在 midR
  const boatLocalX = 8.0;
  const bankR = Math.max(outerR + 1.2, midR + boatLocalX);
  const lx = Math.sin(theta) * bankR;
  const lz = Math.cos(theta) * bankR;
  // 朝向河心（圆心）的水平单位向量
  const toWaterX = -Math.sin(theta);
  const toWaterZ = -Math.cos(theta);
  return {
    lx,
    lz,
    toWaterX,
    toWaterZ,
    /** 船大致落在环带中线半径 */
    waterMidR: midR,
  };
}
