// =====================================================================
//  低模漫画瀑布（Manga Waterfall）
//  flatShading 硬切面 · 分段顶点抖动 · 阶梯式时间量化动画 · 方块泡沫 InstancedMesh
// =====================================================================
import * as THREE from "three";
import { addOutline, toonMat } from "../assets/toon.js";

const WATERFALL_SPEC = Object.freeze({
  curtainCount: 4,
  curtainWidth: 4.5,
  curtainHeight: 16.0,
  curtainDepthStep: 0.05,
  /** 横向 / 纵向分段：多面硬切，便于阶梯波纹 */
  curtainSegW: 3,
  curtainSegH: 10,
  defaultTopY: 40.5,
  defaultWaterlineY: 25.0,
  waterlinePenetration: 0.5,
  mistCount: 20,
  rippleCount: 3,
  outline: 0.04,
  /** 动画步进频率（Hz）→ Math.floor(t * stepHz) / stepHz */
  stepHz: 8,
  foamCount: 28,
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
 * 分段水帘平面：边缘锁定、内部顶点抖动，形成有机低模切面。
 * 缓存 baseX/baseY/baseZ 供阶梯动画还原。
 */
function makeFacetedCurtainGeometry(width, height, segW, segH, random) {
  const geometry = new THREE.PlaneGeometry(width, height, segW, segH);
  const pos = geometry.attributes.position;
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const baseX = new Float32Array(pos.count);
  const baseY = new Float32Array(pos.count);
  const baseZ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    // 顶/底边与左右边锁死：落水端不得因抖动/波纹悬空出地表
    const edgeX = Math.abs(x) >= halfW - 1e-4;
    const edgeY = Math.abs(y) >= halfH - 1e-4;
    if (!edgeX && !edgeY) {
      x += (random() - 0.5) * 0.18;
      z += (random() - 0.5) * 0.12;
    }
    pos.setXYZ(i, x, y, z);
    baseX[i] = x;
    baseY[i] = y;
    baseZ[i] = z;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.userData.baseX = baseX;
  geometry.userData.baseY = baseY;
  geometry.userData.baseZ = baseZ;
  return geometry;
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

  // ---------- 多层水帘（分段 + 硬切面 + 阶梯波纹） ----------
  const curtainGroup = new THREE.Group();
  curtainGroup.name = "manga-waterfall-layered-curtains";
  // 深/浅两层色：后深前浅，增强低模水对比
  const curtainMats = [
    toonMat(0x4f9bb8, {
      flatShading: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
    toonMat(0x93cfca, {
      flatShading: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
  ];
  const animatedCurtains = [];
  for (let i = 0; i < WATERFALL_SPEC.curtainCount; i++) {
    // 每层独立几何，动画互不抢顶点
    const curtainGeometry = makeFacetedCurtainGeometry(
      WATERFALL_SPEC.curtainWidth,
      WATERFALL_SPEC.curtainHeight,
      WATERFALL_SPEC.curtainSegW,
      WATERFALL_SPEC.curtainSegH,
      random
    );
    const curtain = outlinedMesh(
      curtainGeometry,
      curtainMats[i % 2],
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
    curtain.userData.layerPhase = i * 0.7;
    animatedCurtains.push(curtain);
    curtainGroup.add(curtain);
  }
  waterfallGroup.add(curtainGroup);

  // ---------- 书法水丝（阶梯下落） ----------
  const streakGroup = new THREE.Group();
  streakGroup.name = "manga-waterfall-calligraphic-flow-streaks";
  const streaks = [];
  for (let i = 0; i < 8; i++) {
    const width = 0.12 + random() * 0.2;
    const lengthRatio = 0.7 + random() * 0.28;
    // 每丝独立材质：阶梯下落时透明度各自变化
    const streakMaterial = toonMat(0xdff7ed, {
      flatShading: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const streak = outlinedMesh(
      new THREE.PlaneGeometry(width, WATERFALL_SPEC.curtainHeight, 1, 6),
      streakMaterial,
      `manga-waterfall-flow-streak-${i}`,
      0.012
    );
    streak.scale.y = curtainScaleY * lengthRatio;
    const baseY =
      topY -
      WATERFALL_SPEC.curtainHeight * streak.scale.y * 0.5 -
      random() * Math.min(0.34, fallHeight * 0.06);
    streak.position.set(
      -1.82 + (i / 7) * 3.64 + (random() - 0.5) * 0.16,
      baseY,
      0.035 + i * 0.002
    );
    streak.renderOrder = 7;
    streak.userData.baseY = baseY;
    streak.userData.phase = random() * Math.PI * 2;
    streak.userData.fallSpan = Math.min(1.2, fallHeight * 0.12);
    streaks.push(streak);
    streakGroup.add(streak);
  }
  waterfallGroup.add(streakGroup);

  // ---------- 崖口泡沫 ----------
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

  // ---------- 底部几何方块飞沫（InstancedMesh · 阶梯重置） ----------
  const foamCount = WATERFALL_SPEC.foamCount;
  const foamGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const foamMat = toonMat(0xffffff, { flatShading: true });
  const foamInstanced = new THREE.InstancedMesh(foamGeo, foamMat, foamCount);
  foamInstanced.name = "manga-waterfall-box-foam";
  foamInstanced.castShadow = false;
  foamInstanced.receiveShadow = false;
  foamInstanced.frustumCulled = false;
  foamInstanced.count = foamCount;
  const foamDummy = new THREE.Object3D();
  const foamData = [];
  for (let i = 0; i < foamCount; i++) {
    foamData.push({
      x: (random() - 0.5) * 3.2,
      y: random() * 0.8,
      z: 0.25 + (random() - 0.5) * 0.9,
      speedY: 0.6 + random() * 1.4,
      speedX: (random() - 0.5) * 0.55,
      scale: 0.35 + random() * 0.75,
      phase: random() * Math.PI * 2,
    });
  }
  waterfallGroup.add(foamInstanced);

  // ---------- 雾气 ----------
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

  // ---------- 水线涟漪 ----------
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
      new THREE.CircleGeometry(radius, 12), // 少段硬切圆
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

  // 池底硬切八边形：缓慢阶梯起伏
  const basinGeo = new THREE.CylinderGeometry(2.6, 2.9, 0.12, 8);
  basinGeo.translate(0, 0, 0);
  const basinPos = basinGeo.attributes.position;
  const basinBaseY = new Float32Array(basinPos.count);
  for (let i = 0; i < basinPos.count; i++) {
    basinBaseY[i] = basinPos.getY(i);
  }
  basinGeo.userData.baseY = basinBaseY;
  const basin = outlinedMesh(
    basinGeo,
    toonMat(0x6f9ea5, { flatShading: true, transparent: true, opacity: 0.55 }),
    "manga-waterfall-basin",
    0.02
  );
  basin.position.y = waterlineY - 0.04;
  basin.renderOrder = 1;
  waterfallGroup.add(basin);

  const stepHz = WATERFALL_SPEC.stepHz;
  let lastStep = -1;

  const update = (dt = 0, t = 0) => {
    // 阶梯时间：离散帧感，非流体平滑
    const stepTime = Math.floor(t * stepHz) / stepHz;
    const stepped = stepTime !== lastStep;
    lastStep = stepTime;

    // 水帘：沿下落方向推进的硬切波纹
    if (stepped) {
      for (const curtain of animatedCurtains) {
        const geo = curtain.geometry;
        const pos = geo.attributes.position;
        const { baseX, baseY, baseZ } = geo.userData;
        const phase = curtain.userData.layerPhase || 0;
        const halfH = WATERFALL_SPEC.curtainHeight * 0.5;
        for (let i = 0; i < pos.count; i++) {
          const y = baseY[i];
          // 底边锁死：落水端保持部署姿态，不参与纵深波纹
          const edgeY = Math.abs(y) >= halfH - 1e-4;
          if (edgeY) {
            pos.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
            continue;
          }
          // 波纹沿 -Y 流动（stepTime 增加时相位向下）
          const wave =
            Math.sin(y * 1.35 + stepTime * 5.2 + phase) * 0.07 +
            Math.sin(y * 3.1 - stepTime * 3.4 + phase * 1.3) * 0.03;
          pos.setX(i, baseX[i] + wave * 0.35);
          pos.setY(i, baseY[i]);
          pos.setZ(i, baseZ[i] + wave);
        }
        pos.needsUpdate = true;
        // flatShading 主要看面法线；每 2 步重算一次以省 CPU
        if ((Math.floor(t * stepHz) & 1) === 0) geo.computeVertexNormals();
      }

      // 池底慢波
      const bPos = basin.geometry.attributes.position;
      const bBase = basin.geometry.userData.baseY;
      for (let i = 0; i < bPos.count; i++) {
        const x = bPos.getX(i);
        const z = bPos.getZ(i);
        const wobble =
          Math.sin(x * 1.2 + stepTime * 1.6) * 0.025 +
          Math.cos(z * 1.4 - stepTime * 1.1) * 0.02;
        bPos.setY(i, bBase[i] + wobble);
      }
      bPos.needsUpdate = true;
      if ((Math.floor(t * stepHz) & 1) === 0) basin.geometry.computeVertexNormals();
    }

    // 水丝：阶梯式下落循环
    const streakStep = Math.floor(t * (stepHz * 1.25)) / (stepHz * 1.25);
    for (const streak of streaks) {
      const cycle = (streakStep * 0.9 + streak.userData.phase) % 1;
      streak.position.y =
        streak.userData.baseY - cycle * streak.userData.fallSpan;
      streak.material.opacity = 0.35 + (1 - cycle) * 0.35;
    }

    // 方块泡沫：重力 + 水线下重置
    const dtClamped = Math.min(0.05, Math.max(0, dt || 1 / 60));
    for (let i = 0; i < foamCount; i++) {
      const data = foamData[i];
      data.y += data.speedY * dtClamped;
      data.x += data.speedX * dtClamped;
      data.speedY -= 4.2 * dtClamped;
      if (data.y < -0.15) {
        data.x = (random() - 0.5) * 3.0;
        data.y = 0.05 + random() * 0.35;
        data.z = 0.2 + (random() - 0.5) * 0.85;
        data.speedY = 0.7 + random() * 1.5;
        data.speedX = (random() - 0.5) * 0.55;
        data.scale = 0.35 + random() * 0.75;
      }
      const sc = data.scale * Math.max(0.15, Math.min(1.2, data.speedY * 0.55 + 0.35));
      foamDummy.position.set(data.x, waterlineY + data.y, data.z);
      foamDummy.scale.setScalar(sc);
      foamDummy.rotation.set(data.phase, data.phase * 0.7, data.phase * 0.3);
      foamDummy.updateMatrix();
      foamInstanced.setMatrixAt(i, foamDummy.matrix);
    }
    foamInstanced.instanceMatrix.needsUpdate = true;

    // 雾气 / 涟漪：用阶梯时间，观感更「咔哒」
    const mistT = stepTime;
    mistParticles.forEach((puff, index) => {
      puff.position.y =
        puff.userData.baseY +
        Math.sin(mistT * 1.35 + puff.userData.phase) *
          (0.08 + (index % 3) * 0.02);
      puff.rotation.y += dtClamped * (0.4 + (index % 4) * 0.1);
    });
    ripples.forEach((ripple, index) => {
      const pulse =
        ripple.userData.baseScale +
        0.05 * Math.sin(mistT * 1.15 - index * 0.9);
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
