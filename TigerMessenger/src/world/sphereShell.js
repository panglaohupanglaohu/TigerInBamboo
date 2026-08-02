// =====================================================================
//  球面壳段网格：同心球台面（曲面贴合）+ 土坡收口 + 壳体厚度
// =====================================================================
import * as THREE from "three";

/**
 * 在以 centerDir 为中心、right/forward 为切向轴的球面上，
 * 生成半宽 halfW×halfD、外半径 outerR、厚度 thickness 的曲面平台。
 * rampWidth > 0 时，边缘不再下拉成垂直侧壁，而是向外扩成连续土坡。
 *
 * 顶点：先在切平面偏移再 setLength → 贴合球面。
 * heightOffsetAt(u,v) 可让整块壳体沿径向形成连续凹坑（或隆起）。
 *
 * @returns {{ geometry: THREE.BufferGeometry, edgeGeometry: THREE.BufferGeometry }}
 */
export function createSphericalShellPatch({
  centerDir,
  right,
  forward,
  halfW,
  halfD,
  outerR,
  thickness,
  segsW = 12,
  segsD = 12,
  rockAmp = 0, // >0 时侧壁与底面加径向噪点，台面保持平整（碰撞不受影响）
  heightOffsetAt = null, // 可选：按切平面坐标对整块壳体做径向下挖/抬升
  rampWidth = 0, // >0 时把台面边缘向外摊成土坡，替代垂直断墙
  rampRadiusAt = null, // 土坡外缘的基础半径（heightOffsetAt 仍会叠加）
}) {
  const innerR = Math.max(0.05, outerR - thickness * 2);
  const nw = segsW + 1;
  const nd = segsD + 1;

  // 确定性伪随机（同一 u,v 永远同值，角点在相邻面间连续）
  function rockHash(u, v) {
    const s = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }
  // 噪声半径：围绕 innerR 起伏，仅用于底面与侧壁内圈
  const rocky = (u, v) => innerR + (rockHash(u, v) - 0.5) * 2 * rockAmp;

  // 每格：顶面 + 底面 各 nw*nd 点
  const topCount = nw * nd;
  const botCount = nw * nd;
  // 侧壁四边：各 (segs) 段 × 2（顶底）顶点，用条带索引
  const positions = [];
  const normals = [];
  const indices = [];

  const c = centerDir.clone().normalize();
  const rgt = right.clone().normalize();
  const fwd = forward.clone().normalize();

  function sample(u, v, radius, outP, outN) {
    const sampledRadius = radius + (heightOffsetAt ? heightOffsetAt(u, v) : 0);
    // 切平面偏移后投影到球面（曲面贴合关键）
    outP
      .copy(c)
      .multiplyScalar(sampledRadius)
      .addScaledVector(rgt, u)
      .addScaledVector(fwd, v);
    outP.setLength(sampledRadius);
    outN.copy(outP).normalize();
  }

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  // ---- 顶面（外表面）----
  const topStart = 0;
  for (let j = 0; j < nd; j++) {
    for (let i = 0; i < nw; i++) {
      const u = (i / segsW) * 2 * halfW - halfW;
      const v = (j / segsD) * 2 * halfD - halfD;
      sample(u, v, outerR, p, n);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < segsD; j++) {
    for (let i = 0; i < segsW; i++) {
      const a = topStart + j * nw + i;
      const b = a + 1;
      const c0 = a + nw;
      const d = c0 + 1;
      // 外侧朝外：看向球外
      indices.push(a, c0, b, b, c0, d);
    }
  }

  // ---- 底面（内表面）----
  const botStart = topCount;
  for (let j = 0; j < nd; j++) {
    for (let i = 0; i < nw; i++) {
      const u = (i / segsW) * 2 * halfW - halfW;
      const v = (j / segsD) * 2 * halfD - halfD;
      sample(u, v, rocky(u, v), p, n);
      positions.push(p.x, p.y, p.z);
      // 底面法线朝内（-径向）
      normals.push(-n.x, -n.y, -n.z);
    }
  }
  for (let j = 0; j < segsD; j++) {
    for (let i = 0; i < segsW; i++) {
      const a = botStart + j * nw + i;
      const b = a + 1;
      const c0 = a + nw;
      const d = c0 + 1;
      // 翻转绕序使法线朝内
      indices.push(a, b, c0, b, d, c0);
    }
  }

  // ---- 侧壁：四条边 ----
  function addSide(getTopUV, getRampUV, segs) {
    const base = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const topUV = getTopUV(t);
      const rampUV = rampWidth > 0 ? getRampUV(t) : topUV;
      const { u, v } = topUV;
      sample(u, v, outerR, p, n);
      positions.push(p.x, p.y, p.z);
      // 侧壁近似法线：切向外指
      const sideN = new THREE.Vector3().subVectors(
        p.clone().setLength(outerR),
        c.clone().multiplyScalar(outerR)
      );
      // better: horizontal in tangent from center
      const sn = rgt
        .clone()
        .multiplyScalar(u)
        .addScaledVector(fwd, v);
      if (sn.lengthSq() < 1e-8) sn.copy(rgt);
      sn.normalize();
      normals.push(sn.x, sn.y, sn.z);

      const bottomRadius = rampRadiusAt
        ? rampRadiusAt(rampUV.u, rampUV.v)
        : rocky(rampUV.u, rampUV.v);
      sample(rampUV.u, rampUV.v, bottomRadius, p, n);
      positions.push(p.x, p.y, p.z);
      normals.push(sn.x, sn.y, sn.z);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c0 = a + 2;
      const d = a + 3;
      indices.push(a, b, c0, b, d, c0);
    }
  }

  const outerW = halfW + rampWidth;
  const outerD = halfD + rampWidth;
  addSide(
    (t) => ({ u: -halfW + t * 2 * halfW, v: -halfD }),
    (t) => ({ u: -outerW + t * 2 * outerW, v: -outerD }),
    segsW,
  ); // -D
  addSide(
    (t) => ({ u: -halfW + t * 2 * halfW, v: halfD }),
    (t) => ({ u: -outerW + t * 2 * outerW, v: outerD }),
    segsW,
  ); // +D
  addSide(
    (t) => ({ u: -halfW, v: -halfD + t * 2 * halfD }),
    (t) => ({ u: -outerW, v: -outerD + t * 2 * outerD }),
    segsD,
  ); // -W
  addSide(
    (t) => ({ u: halfW, v: -halfD + t * 2 * halfD }),
    (t) => ({ u: outerW, v: -outerD + t * 2 * outerD }),
    segsD,
  ); // +W

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  // 顶面外轮廓线（勾边）
  const edgePos = [];
  const ring = [];
  for (let i = 0; i <= segsW; i++) {
    sample(-halfW + (i / segsW) * 2 * halfW, -halfD, outerR, p, n);
    ring.push(p.clone());
  }
  for (let i = 1; i <= segsD; i++) {
    sample(halfW, -halfD + (i / segsD) * 2 * halfD, outerR, p, n);
    ring.push(p.clone());
  }
  for (let i = 1; i <= segsW; i++) {
    sample(halfW - (i / segsW) * 2 * halfW, halfD, outerR, p, n);
    ring.push(p.clone());
  }
  for (let i = 1; i <= segsD; i++) {
    sample(-halfW, halfD - (i / segsD) * 2 * halfD, outerR, p, n);
    ring.push(p.clone());
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    edgePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));

  return { geometry, edgeGeometry };
}
