// 原作长翼护航鸟：原几何、材质、双层折翼与关节引用。
import * as THREE from "three";
import { toonMat, addOutline, INK_COLOR } from "../toon.js";
export const GLIDER_COLORS = [0xeceff1, 0xf6f1e7];

/** 内翼：修长的 tapered 四边形薄壳（翼展 0.9） */
function makeInnerWingGeometry(side /* 1 = 左, -1 = 右 */) {
  const s = new THREE.Shape();
  s.moveTo(0.04 * side, 0.19); // 翼根前缘
  s.lineTo(0.04 * side, -0.17); // 翼根后缘
  s.lineTo(0.94 * side, -0.07); // 翼尖后缘（收窄）
  s.lineTo(0.94 * side, 0.09); // 翼尖前缘
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.011, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 外翼：尖削三角薄壳（翼展 1.05，相对内翼关节的局部坐标） */
function makeOuterWingGeometry(side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.09); // 关节前缘（与内翼尖缘衔接）
  s.lineTo(0, -0.07); // 关节后缘
  s.lineTo(1.05 * side, -0.015); // 羽尖（微后掠）
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.009, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 修长躯干：4 棱锥沿 Z 非等比极度拉长；细长锥尖 = 头喙，引领飞行 */
function makeTorsoGeometry() {
  const geo = new THREE.ConeGeometry(0.26, 1.5, 4); // radialSegments: 4 → 刚劲切面
  geo.rotateX(Math.PI / 2); // 锥尖 → +Z（头，朝飞行方向），基座 → −Z（尾）
  return geo;
}

export function createGliderGeometries() {
  return {
    torso: makeTorsoGeometry(),
    innerL: makeInnerWingGeometry(1),
    innerR: makeInnerWingGeometry(-1),
    outerL: makeOuterWingGeometry(1),
    outerR: makeOuterWingGeometry(-1),
  };
}

/**
 * 实时拼接的异星滑翔长翼鸟：
 * 体量约为峡谷小鸟 1.5 倍长；躯干 + 内翼 + 外翼全部 addOutline() 黑墨线。
 * @param {number} [color] 浅青灰 / 珍珠白
 * @param {ReturnType<typeof createGliderGeometries>} [geos] 共享几何体
 */
export function createLongWingGlider(color = GLIDER_COLORS[0], geos = createGliderGeometries()) {
  const bird = new THREE.Group();
  bird.name = "long-wing-glider";
  const mat = toonMat(color, { flatShading: true }); // 消光硬边 Cel

  // ---------- 修长躯干 ----------
  const torso = new THREE.Mesh(geos.torso, mat);
  torso.scale.set(0.8, 0.55, 1.3); // 沿 Z 非等比极度拉长
  addOutline(torso, 0.017, INK_COLOR, 0.05);

  const model = new THREE.Group(); // 侧倾层（不污染朝向四元数）
  model.add(torso);

  // ---------- 两级折叠长翼（身体 → 内翼 → 外翼） ----------
  function buildWing(side, innerGeo, outerGeo) {
    const inner = new THREE.Group(); // 内翼基座（低频大振幅）
    inner.position.set(0.14 * side, 0.02, 0.3); // 肩部：躯干前段
    const innerMesh = new THREE.Mesh(innerGeo, mat);
    addOutline(innerMesh, 0.017, INK_COLOR, 0.05);
    inner.add(innerMesh);

    const outer = new THREE.Group(); // 外翼尖端（相位延迟鞭打）
    outer.position.set(0.9 * side, 0, 0); // 内翼尖关节
    const outerMesh = new THREE.Mesh(outerGeo, mat);
    addOutline(outerMesh, 0.017, INK_COLOR, 0.05);
    outer.add(outerMesh);

    inner.add(outer);
    return { inner, outer };
  }
  const wingL = buildWing(1, geos.innerL, geos.outerL);
  const wingR = buildWing(-1, geos.innerR, geos.outerR);
  model.add(wingL.inner, wingR.inner);

  bird.add(model);
  bird.userData = {
    model,
    innerL: wingL.inner,
    outerL: wingL.outer,
    innerR: wingR.inner,
    outerR: wingR.outer,
  };
  return bird;
}

