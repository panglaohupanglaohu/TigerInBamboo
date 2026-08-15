// =====================================================================
//  buildTownscaperBuilding —— Townscaper 画风模块化要塞建筑工厂
//
//  日系插画风不规则拼色要塞（The Townscaper Modular Citadel）：
//    · 双层内缩撞色主屋（薄荷绿 + 珊瑚橙红斜顶 + 奶黄退缩层）
//    · 露台边缘白色防空护栏（黑勾线）
//    · 悬空时底部焦黑交叉外骨骼铁质支架（Truss Support）
//    · 最底层青灰巨石防波堤地基（六棱柱，下切水体）
//    · 全网格唐伯虎笔意粗墨描边（addOutline 0.05）
//
//  所有几何故意做「非等比略带偏折」：通过错切矩阵微调顶点，消灭
//  完美死方块，产生手工搭积木的微弱非直角偏折感（Townscaper 气质）。
//
//  返回 THREE.Group，可直接 scene.add；材质全部走 toonMat 共享缓存，
//  描边走 addOutline，无外部贴图依赖，SwiftShader 无头环境零开销。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

// ---------- 锁死色板（用户规格，勿改） ----------
const C_MINT = 0x2ecc71; // 薄荷绿（底层墙面）
const C_CORAL = 0xe74c3c; // 珊瑚橙红（四棱锥屋顶）
const C_CREAM = 0xf4d03f; // 奶黄（中层退缩主殿）
const C_WHITE = 0xffffff; // 防空白色护栏
const C_IRON = 0x2c3e50; // 焦黑（外骨骼支架）
const C_STONE = 0x5d6d7e; // 青灰（巨石地基）
const OUTLINE = 0.05; // 唐伯虎笔意细描边厚度

// ---------- 非直角偏折错切矩阵 ----------
// 给每面墙一个微小的剪切角（~1.5°），四壁各自错切方向不同，
// 形成「手搭积木」的歪斜感；确定性（按种子），重建结果稳定。
const _shear = new THREE.Matrix4();
function shearMatrix(axis, k) {
  // 沿 axis 方向剪切：x' = x + k·y（或 z' = z + k·y），k 小则微偏折
  _shear.identity();
  if (axis === "x") {
    _shear.elements[4] = k; // 第 1 列第 2 行：x 随 y 偏移
  } else {
    _shear.elements[6] = k; // 第 1 列第 3 行：z 随 y 偏移
  }
  return _shear;
}

/**
 * 生成「略带偏折」的长方体几何：BoxGeometry 顶点经错切矩阵微调。
 * 四个竖向棱各自向内/外错开 k（~0.05–0.09），消灭完美直角。
 * @param {number} w 宽（x）
 * @param {number} h 高（y）
 * @param {number} d 深（z）
 * @param {number} [seed] 确定性种子（决定偏折方向）
 * @returns {THREE.BufferGeometry}
 */
function makeShearedBox(w, h, d, seed = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1], // 四壁的法线方向（x/z）
  ];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // 按顶点所在壁面选择错切方向（取绝对值最大分量决定归属）
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const k = 0.055 + ((seed + i) % 3) * 0.015; // 0.055–0.085
    if (ax >= az) {
      // x 壁：沿 z 错切（随高度偏折），方向由 x 符号 × 种子决定
      const sign = x >= 0 ? 1 : -1;
      const dir = (seed % 2 === 0 ? 1 : -1) * sign;
      pos.setZ(i, z + dir * k * (y / (h / 2)) * (d / 2));
    } else {
      // z 壁：沿 x 错切
      const sign = z >= 0 ? 1 : -1;
      const dir = (seed % 2 === 0 ? -1 : 1) * sign;
      pos.setX(i, x + dir * k * (y / (h / 2)) * (w / 2));
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * 独立 Townscaper 模块化要塞建筑工厂。
 *
 * @param {{
 *   seed?: number,          // 确定性种子（默认 20260808）
 *   withPlinth?: boolean,   // 底部巨石防波堤地基（默认 true）
 *   withTruss?: boolean,    // 悬空外骨骼支架（默认 true；离地高度 >0 时自动）
 *   withRailing?: boolean,  // 中层露台白色护栏（默认 true）
 *   withWater?: boolean,    // 地基下切水体 + 白涟漪片（默认 true）
 *   lift?: number,          // 建筑底部离地高度（>0 触发支架，默认 0）
 *   ambient?: number,       // 附带环境光强度（0 = 不加，默认 0）
 * }} [opts]
 * @returns {THREE.Group & { userData: object }}
 */
export function buildTownscaperBuilding(opts = {}) {
  const seed = opts.seed ?? 20260808;
  const withPlinth = opts.withPlinth !== false;
  const withTruss = opts.withTruss !== false;
  const withRailing = opts.withRailing !== false;
  const withWater = opts.withWater !== false;
  const lift = opts.lift ?? 0; // 底部离地高度（悬空检测）
  const ambient = opts.ambient ?? 0;

  const root = new THREE.Group();
  root.name = "townscaper-building";

  // ---------- 材质（toon 共享缓存） ----------
  const matMint = toonMat(C_MINT, { flatShading: true });
  const matCoral = toonMat(C_CORAL, { flatShading: true });
  const matCream = toonMat(C_CREAM, { flatShading: true });
  const matWhite = toonMat(C_WHITE, { flatShading: true });
  const matIron = toonMat(C_IRON, { flatShading: true });
  const matStone = toonMat(C_STONE, { flatShading: true });

  // =================================================================
  //  Layer 1 —— 薄荷绿主屋 + 珊瑚橙红斜顶
  // =================================================================
  const house = new THREE.Group();
  house.name = "modular-house";
  root.add(house);

  const wallGeo1 = makeShearedBox(4.0, 5.0, 4.0, seed);
  const wall1 = new THREE.Mesh(wallGeo1, matMint);
  wall1.name = "citadel-wall-layer1";
  wall1.position.y = lift + 2.5; // 底贴地面（含 lift）
  addOutline(wall1, OUTLINE);
  house.add(wall1);

  // 扁平微垂四棱锥屋顶：ConeGeometry(4 段) 旋转 45° 让棱线对格；
  // 顶点压低 + 底边四角微垂（二次元斜顶感）
  const roofGeo = new THREE.ConeGeometry(3.15, 1.15, 4, 1);
  roofGeo.rotateY(Math.PI / 4); // 45°：棱线对齐墙体对角
  const roofPos = roofGeo.attributes.position;
  for (let i = 0; i < roofPos.count; i++) {
    const y = roofPos.getY(i);
    if (y > 0.9) {
      // 顶点微垂：压平峰顶
      roofPos.setY(i, y * 0.82);
    } else if (Math.abs(y) < 0.01) {
      // 底边四角向下微垂（±小量）
      const x = roofPos.getX(i);
      const z = roofPos.getZ(i);
      roofPos.setY(i, -0.06 + (x * z > 0 ? 0.05 : -0.05) * 0.5);
    }
  }
  roofPos.needsUpdate = true;
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, matCoral);
  roof.name = "citadel-roof-layer1";
  roof.position.y = lift + 5.0 + 0.55;
  addOutline(roof, OUTLINE);
  house.add(roof);

  // =================================================================
  //  Layer 2 —— 奶黄退缩主殿 + 露台白色防空护栏
  // =================================================================
  const wallGeo2 = makeShearedBox(2.8, 4.0, 2.8, seed + 7);
  const wall2 = new THREE.Mesh(wallGeo2, matCream);
  wall2.name = "citadel-wall-layer2";
  wall2.position.y = lift + 5.0 + 2.0;
  addOutline(wall2, OUTLINE);
  house.add(wall2);

  // 中层屋顶：扁平珊瑚橙红（与底层撞色呼应，规格只锁底层顶，这里补同色）
  const roof2Geo = new THREE.ConeGeometry(2.2, 0.85, 4, 1);
  roof2Geo.rotateY(Math.PI / 4);
  const roof2 = new THREE.Mesh(roof2Geo, matCoral);
  roof2.name = "citadel-roof-layer2";
  roof2.position.y = lift + 5.0 + 4.0 + 0.42;
  addOutline(roof2, OUTLINE);
  house.add(roof2);

  // 露台护栏：底层屋顶外缘（4.0 宽）与中层（2.8 宽）之间的环形平台，
  // 用短方块拼一圈带黑勾线的白色栏杆（四边各 4 根立柱 + 通长横杆）
  if (withRailing) {
    const railing = new THREE.Group();
    railing.name = "citadel-railing";
    const postGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const railGeoX = new THREE.BoxGeometry(4.0 + 0.12, 0.1, 0.1);
    const railGeoZ = new THREE.BoxGeometry(0.1, 0.1, 4.0 + 0.12);
    const yBase = lift + 5.0 + 0.06;
    for (let i = 0; i < 4; i++) {
      const s = i % 2 === 0 ? 1 : -1;
      const a = i * Math.PI / 2;
      // 四角立柱
      const px = Math.cos(a) * 1.85;
      const pz = Math.sin(a) * 1.85;
      const post = new THREE.Mesh(postGeo, matWhite);
      post.position.set(px, yBase + 0.27, pz);
      addOutline(post, OUTLINE);
      railing.add(post);
      // 边中点立柱（每边 2 根，共 8 根，+ 角柱共 12 根围一圈）
      for (let m = 1; m <= 2; m++) {
        const t = (m / 3) * 2 - 1;
        const mid = new THREE.Mesh(postGeo, matWhite);
        if (i % 2 === 0) {
          mid.position.set(px * 0.98 * t, yBase + 0.27, pz);
        } else {
          mid.position.set(px, yBase + 0.27, pz * 0.98 * t);
        }
        addOutline(mid, OUTLINE);
        railing.add(mid);
      }
    }
    // 通长横杆（四边）
    for (let e = 0; e < 4; e++) {
      const horizontal = new THREE.Mesh(e % 2 === 0 ? railGeoX : railGeoZ, matWhite);
      const a = e * Math.PI / 2;
      horizontal.position.set(Math.cos(a) * 1.95, yBase + 0.42, Math.sin(a) * 1.95);
      horizontal.rotation.y = e % 2 === 0 ? 0 : Math.PI / 2;
      addOutline(horizontal, OUTLINE);
      railing.add(horizontal);
    }
    house.add(railing);
  }

  // =================================================================
  //  底部外骨骼交叉铁质金属支架（Truss Support）
  //  离地悬空（lift > 0）时自动生成：4 根焦黑多棱柱 + 中央 X/V 桁架
  // =================================================================
  if (withTruss && lift > 0) {
    const truss = new THREE.Group();
    truss.name = "truss-support";
    const legH = lift;
    const legGeo = new THREE.CylinderGeometry(0.09, 0.12, legH, 6);
    // 四角支撑柱（贴墙体内缘）
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const leg = new THREE.Mesh(legGeo, matIron);
      leg.position.set(sx * 1.7, legH / 2, sz * 1.7);
      addOutline(leg, OUTLINE);
      truss.add(leg);
    }
    // 中央 X 字形交叉桁架（4 根极细薄片：两根 X 对角 + 两根横向拉杆）
    const strutLen = Math.hypot(3.4, 3.4);
    const diagGeo = new THREE.BoxGeometry(0.06, 0.06, strutLen);
    const crossGeoX = new THREE.BoxGeometry(3.4, 0.06, 0.06);
    const crossGeoZ = new THREE.BoxGeometry(0.06, 0.06, 3.4);
    const midY = legH * 0.5;
    for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const diag = new THREE.Mesh(diagGeo, matIron);
      diag.position.set(sx * 1.7, midY, sz * 1.7);
      // 沿对角方向旋转 45°（绕 y）
      diag.rotation.y = Math.atan2(sz * 3.4, sx * 3.4) + (sx < 0 ? Math.PI : 0);
      diag.rotation.z = Math.PI / 2; // 薄片立起
      addOutline(diag, OUTLINE);
      truss.add(diag);
    }
    // 横向拉杆（V 字两点间的横向系杆）
    const tieX = new THREE.Mesh(crossGeoX, matIron);
    tieX.position.set(0, midY, 0);
    addOutline(tieX, OUTLINE);
    truss.add(tieX);
    const tieZ = new THREE.Mesh(crossGeoZ, matIron);
    tieZ.position.set(0, midY, 0);
    addOutline(tieZ, OUTLINE);
    truss.add(tieZ);
    root.add(truss);
  }

  // =================================================================
  //  底部风化青灰色巨石防波堤地基（The Stone Plinth）
  //  六棱柱，半径 = 主楼体 1.4 倍，厚度 1.5，下切水体
  // =================================================================
  if (withPlinth) {
    const plinthRadius = 4.0 * 1.4 / 2; // 主楼 4.0 宽 → 半径 2.8
    const plinthGeo = new THREE.CylinderGeometry(
      plinthRadius * 1.06, // 顶面略大（风化侵蚀感）
      plinthRadius * 1.14, // 底面更大（防波堤收分）
      1.5,
      6, // 六棱柱
      1
    );
    // 巨石咬合边缘微扰（风化）
    const pp = plinthGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i);
      const z = pp.getZ(i);
      const jit = 1 + ((seed + i * 7) % 5) * 0.012; // ±4.8% 边缘扰动
      pp.setX(i, x * jit);
      pp.setZ(i, z * jit);
    }
    pp.needsUpdate = true;
    plinthGeo.computeVertexNormals();
    const plinth = new THREE.Mesh(plinthGeo, matStone);
    plinth.name = "citadel-stone-plinth";
    plinth.position.y = lift - 0.75; // 中心在 lift 下方 0.75：下半嵌入水体
    addOutline(plinth, OUTLINE);
    root.add(plinth);
  }

  // =================================================================
  //  水际白色手绘涟漪（2 个极扁圆形片体，平铺在交界处）
  // =================================================================
  if (withWater && withPlinth) {
    const rippleGeo = new THREE.CircleGeometry(plinthRadiusFor(opts), 24);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 2; i++) {
      const ripple = new THREE.Mesh(rippleGeo, rippleMat);
      ripple.name = "citadel-ripple";
      ripple.rotation.x = -Math.PI / 2; // 平铺水面
      ripple.position.y = lift - 0.02 - i * 0.02; // 两层涟漪微错开
      ripple.scale.setScalar(1.12 + i * 0.14);
      root.add(ripple);
    }
  }

  // ---------- 返回元数据 ----------
  root.userData = {
    kind: "townscaper-building",
    seed,
    lift,
    withPlinth,
    withTruss,
    withRailing,
    ambient,
  };
  return root;
}

/** 涟漪半径：与地基顶半径一致（内部辅助） */
function plinthRadiusFor(opts) {
  return (4.0 * 1.4 / 2) * 1.06;
}

/**
 * 便利封装：给场景加一个 1.4 倍纯白环境光（SwiftShader 无头零开销）。
 * 工厂本身不加全局光（避免多实例叠加），由调用方按需调用一次。
 */
export function addTownscaperAmbient(scene, intensity = 1.4) {
  const light = new THREE.AmbientLight(0xffffff, intensity);
  light.name = "townscaper-ambient";
  scene.add(light);
  return light;
}
