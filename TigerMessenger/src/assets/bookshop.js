// =====================================================================
//  Hard To Find Bookshop（新西兰复古老书店）
//  基础几何体实时拼接：砖红主体 + 维多利亚八角凸窗 + 三角门廊
//  + 土坡台阶 + 黑底金边斜招牌；底部中心对齐局部 (0,0,0)
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const BRICK = 0xb87352; // 砖红
const TRIM = 0xf5f5f0; // 奶白（门廊/柱）
const GLASS = 0x2c3440; // 深色玻璃窗
const DOOR = 0x3a2c22; // 内凹门洞
const LAWN = 0x5a8f5a; // 草坪
const SIGN_BG = 0x111111; // 招牌黑底
const SIGN_EDGE = 0xd4af37; // 招牌金边
const O = 0.025; // 主体描边
const O_S = 0.015; // 细节描边

/**
 * 房屋底部的土坡连接器。
 *
 * 旧版本用一块等厚 BoxGeometry 当草坪底座，侧面会形成明显的“台面”
 * 和悬空黑边。这里把底座改成矩形台地向外收坡的环带：内圈承托房屋，
 * 外圈落到地面，保证房屋和球面地形之间有连续的土坡过渡。
 */
function soilBerm(edgeY = 0.02) {
  const group = new THREE.Group();
  group.name = "bookshop-soil-berm";

  const soil = toonMat(0x796244);
  const moss = toonMat(LAWN);
  const innerW = 2.58;
  const innerD = 2.08;
  const outerW = 3.82;
  const outerD = 3.34;
  const topY = 0.35;
  // 四边斜坡环带：每一面都是内圈高、外圈低的两个三角形。
  const vertices = [
    [-innerW, topY, -innerD], [innerW, topY, -innerD],
    [innerW, topY, innerD], [-innerW, topY, innerD],
    [-outerW, edgeY, -outerD], [outerW, edgeY, -outerD],
    [outerW, edgeY, outerD], [-outerW, edgeY, outerD],
  ];
  const positions = new Float32Array(vertices.flat());
  const indices = [
    0, 1, 5, 0, 5, 4, // 后坡
    1, 2, 6, 1, 6, 5, // 右坡
    2, 3, 7, 2, 7, 6, // 前坡
    3, 0, 4, 3, 4, 7, // 左坡
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ramp = new THREE.Mesh(geometry, soil);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  addOutline(ramp, O_S, 0x59452f, 0.04);
  group.add(ramp);

  // 内圈只保留薄薄的苔面，不再生成一块有厚度的平板。
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW * 2, innerD * 2),
    moss,
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = topY + 0.006;
  top.receiveShadow = true;
  group.add(top);
  return group;
}

function box(w, h, d, mat, outline = O) {
  const m = new THREE.Mesh(facet(new THREE.BoxGeometry(w, h, d)), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, outline);
  return m;
}

/** 草簇（山坡草地氛围）：三片小锥叶 */
export function createGrassTuft() {
  const g = new THREE.Group();
  const mat = toonMat(0x4a7a4a);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      facet(new THREE.ConeGeometry(0.05, 0.28 + Math.random() * 0.16, 3)),
      mat
    );
    blade.position.set((i - 1) * 0.07, 0.14, (i % 2) * 0.05);
    blade.rotation.z = (i - 1) * 0.22;
    g.add(blade);
  }
  return g;
}

/** 招牌烫金文字纹理（Canvas 实时绘制：HARD TO FIND / BOOKSHOP） */
function makeSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 224);
  ctx.fillStyle = "#D4AF37";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 60px Georgia, 'Times New Roman', serif";
  ctx.fillText("HARD TO FIND", 256, 84);
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText("BOOKSHOP", 256, 158);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function createHardToFindBookshop({ bermEdgeY = 0.02 } = {}) {
  const g = new THREE.Group();
  g.name = "hard-to-find-bookshop";
  const brick = toonMat(BRICK);
  const trim = toonMat(TRIM);
  const glass = toonMat(GLASS);
  const doorMat = toonMat(DOOR);
  const lawn = toonMat(LAWN);
  const signBg = toonMat(SIGN_BG);
  const signEdge = toonMat(SIGN_EDGE);

  // ---------- 房屋与地面：矩形土坡台地 + 两级台阶 ----------
  // 土坡的外圈落到球面地面，避免旧版厚草坪产生“悬空台面”。
  g.add(soilBerm(bermEdgeY));
  const step1 = box(1.5, 0.16, 0.5, trim, O_S);
  step1.position.set(0, 0.255, 2.15);
  g.add(step1);
  const step2 = box(1.7, 0.14, 0.5, trim, O_S);
  step2.position.set(0, 0.13, 2.55);
  g.add(step2);

  // ---------- 建筑主体（高 ≈ 玩家 4 倍） ----------
  const BODY_BOTTOM = 0.32; // 底部吃进草坪
  const body = box(4.6, 7.0, 3.6, brick);
  body.position.set(0, BODY_BOTTOM + 3.5, 0);
  g.add(body);
  // 檐口压顶（收轮廓）
  const cap = box(4.9, 0.28, 3.9, toonMat(0x8a5a42), O);
  cap.position.set(0, BODY_BOTTOM + 7.1, 0);
  g.add(cap);

  // ---------- 两侧八角凸窗（半八棱柱，radialSegments 严格 8 切半） ----------
  for (const side of [-1, 1]) {
    const bay = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(1.0, 1.0, 4.4, 8, 1, false, -Math.PI / 2, Math.PI)),
      brick
    );
    bay.castShadow = true;
    addOutline(bay, O);
    bay.position.set(side * 1.6, BODY_BOTTOM + 2.4, 1.55); // 平面嵌墙、弧面外凸
    g.add(bay);
    // 双层玻璃窗：错落三组扁平深色块
    for (const [wy, wz] of [[1.3, 2.42], [2.5, 2.42], [3.7, 2.42]]) {
      const win = box(0.5, 0.68, 0.06, glass, O_S);
      win.position.set(side * 1.6, BODY_BOTTOM + wy, wz);
      g.add(win);
    }
    for (const off of [-0.5, 0.5]) {
      const win = box(0.4, 0.62, 0.06, glass, O_S);
      win.position.set(side * (1.6 + off * 0.7), BODY_BOTTOM + 2.5, 2.18);
      win.rotation.y = -side * off * 0.6;
      g.add(win);
    }
  }

  // ---------- 三角形复古正门门廊 ----------
  // 内凹门洞（双层加深）
  const recess = box(1.0, 1.8, 0.12, doorMat, O_S);
  recess.position.set(0, BODY_BOTTOM + 0.9, 1.78);
  g.add(recess);
  const inner = box(0.8, 1.6, 0.1, toonMat(0x241a14), O_S);
  inner.position.set(0, BODY_BOTTOM + 0.8, 1.72);
  g.add(inner);
  // 两根细长白柱（5 分段）
  for (const side of [-1, 1]) {
    const col = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 5)),
      trim
    );
    col.castShadow = true;
    addOutline(col, O_S);
    col.position.set(side * 0.6, BODY_BOTTOM + 1.0, 2.25);
    g.add(col);
  }
  // 三角门廊顶：4 段圆锥旋 45° 压扁出三角形立面，奶白色
  const pediment = new THREE.Mesh(
    facet(new THREE.ConeGeometry(1.35, 0.85, 4)),
    trim
  );
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.set(1, 1, 0.55); // 压浅成探出的三角檐
  pediment.position.set(0, BODY_BOTTOM + 2.35, 2.05);
  pediment.castShadow = true;
  addOutline(pediment, O);
  g.add(pediment);

  // ---------- 黑底金边斜招牌（拱形顶，斜插草坪左前方） ----------
  const signG = new THREE.Group();
  const frame = box(1.85, 1.1, 0.07, signEdge, O_S); // 金边衬底
  frame.position.y = 0.55;
  signG.add(frame);
  const board = box(1.68, 0.94, 0.09, signBg, O_S); // 黑底面板
  board.position.set(0, 0.55, 0.02);
  signG.add(board);
  // 烫金店名（CanvasTexture 贴在面板正面）
  const namePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.66),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(), transparent: true })
  );
  namePlane.position.set(0, 0.55, 0.075);
  signG.add(namePlane);
  const arch = new THREE.Mesh( // 圆弧顶
    facet(new THREE.CylinderGeometry(0.92, 0.92, 0.07, 12, 1, false, 0, Math.PI)),
    signEdge
  );
  arch.rotation.z = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.set(0, 1.1, 0);
  addOutline(arch, O_S);
  signG.add(arch);
  // 两根短插脚
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 5)),
      signEdge
    );
    leg.position.set(side * 0.6, -0.15, 0);
    addOutline(leg, O_S);
    signG.add(leg);
  }
  // 招牌独立放到建筑左前方，避开凸窗和墙体遮挡，完整露出文字。
  signG.position.set(-3.25, 0.48, 2.65);
  signG.rotation.set(-0.08, 0.38, 0.1); // 微微斜插
  g.add(signG);

  // 碰撞：主体 + 招牌一体近似
  g.userData.collideRadius = 3.2;
  return g;
}
