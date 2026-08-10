// =====================================================================
//  高山圣城护城河（Citadel Moat）
//  平涂插画风环形水面：硬边多边形 · roughness=1 / Basic 无高光 ·
//  阶梯量化水波 · 方块浪花点缀。不改动五层台地几何，仅作为外围水体。
//
//  局部约定：+Y 向上，水面约 Y=waterY，环心在原点（与城堡台地圆心对齐）。
//  默认内径略大于 baseRadius(24)，外径约 33，环绕最外层台地墙脚。
// =====================================================================
import * as THREE from "three";

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
  /** 与星海运河统一的水面蓝（SHARED_WATER_COLOR = 0x3a86a0） */
  waterColor: 0x3a86a0,
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

  const waterMat = makeWaterMaterial(waterColor, { useBasic: true });
  const borderMat = makeBorderMaterial(borderColor);
  const foamMat = new THREE.MeshBasicMaterial({ color: foamColor });

  // ---------- 1. 多边形环状水面 ----------
  const moatGeo = new THREE.RingGeometry(innerR, outerR, segs, radialSegs);
  const pos = moatGeo.attributes.position;
  const baseZ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    // RingGeometry 在 XY 面，Z 为厚度向；先记原始 Z，再在平面内抖动折线
    baseZ[i] = pos.getZ(i);
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    // 内/外缘少抖，保持可辨的环带；中间折线更手绘
    const edge =
      Math.abs(r - innerR) < 0.35 || Math.abs(r - outerR) < 0.35 ? 0.06 : 0.22;
    pos.setX(i, x + (random() - 0.5) * edge);
    pos.setY(i, y + (random() - 0.5) * edge);
  }
  moatGeo.computeVertexNormals();
  moatGeo.userData.baseZ = baseZ;

  const water = new THREE.Mesh(moatGeo, waterMat);
  water.name = "citadel-moat-water";
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  water.receiveShadow = true;
  water.castShadow = false;
  water.renderOrder = 2;
  group.add(water);

  // ---------- 2. 内/外垂直岸壁（无顶盖低模圆柱）----------
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(innerR, innerR, wallDepth, segs, 1, true),
    borderMat
  );
  innerWall.name = "citadel-moat-inner-wall";
  innerWall.position.y = waterY - wallDepth * 0.35;
  innerWall.receiveShadow = true;
  group.add(innerWall);

  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(outerR, outerR, wallDepth, segs, 1, true),
    borderMat
  );
  outerWall.name = "citadel-moat-outer-wall";
  outerWall.position.y = waterY - wallDepth * 0.35;
  outerWall.receiveShadow = true;
  group.add(outerWall);

  // 河床底面（沉在水面下，避免“纸片水”）
  const bed = new THREE.Mesh(
    new THREE.RingGeometry(innerR * 0.995, outerR * 1.005, segs, 1),
    new THREE.MeshStandardMaterial({
      color: 0x7a8f8c,
      flatShading: true,
      roughness: 1.0,
      metalness: 0.0,
    })
  );
  bed.name = "citadel-moat-bed";
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = waterY - wallDepth * 0.72;
  bed.receiveShadow = true;
  group.add(bed);

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
    const initial = water.geometry.userData.baseZ;
    for (let i = 0; i < moatPos.count; i++) {
      const x = moatPos.getX(i);
      const y = moatPos.getY(i);
      const radius = Math.sqrt(x * x + y * y);
      const wave =
        Math.sin(radius * 1.45 - stepped * 1.5) * 0.045 +
        Math.cos(x * 0.48 + stepped) * 0.028;
      moatPos.setZ(i, (initial?.[i] ?? 0) + wave);
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
