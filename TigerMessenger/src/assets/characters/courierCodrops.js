// =====================================================================
//  信使 · Codrops 方法论整体重建（tympanus 2019/10/14 教程学习实践）
//  「基础几何体 + 分层关节 + 扁平色块」——代码即模型，目标图为完整设定图
//  （TIGER MESSENGER · 信使角色目标图：酒红披肩 / 青绿袍 / 象牙袖 /
//    古金饰 / 深棕裤 / 缠绑皮靴 / 信使包 / 蜡封信）
// =====================================================================
import * as THREE from "three";
import { COURIER_SCALE } from "../../core/characterScale.js";
import head38 from "../../../assets/models/optimized/human-courier-production-v2/head-38/geometry.js";

// —— 设定图色板（严格对齐《信使 · Low Poly 面部目标》与全身设定图）——
export const COURIER_PALETTE = {
  wine: 0x8f3a30,          // 酒红披肩主色
  wine_light: 0xa8483c,    // 披肩亮部
  wine_shadow: 0x6a2620,   // 披肩暗部
  teal: 0x3e6e6a,          // 青绿战袍主色
  teal_light: 0x4e8580,    // 战袍高光
  teal_shadow: 0x2a4c49,   // 战袍褶皱暗部
  ivory: 0xf2ead9,         // 象牙白衬衣 / 袖子 / 信纸
  shirt_shadow: 0xd4cbb8,  // 象牙白阴影
  pants: 0x4a382c,         // 深棕修身裤
  leather: 0x4a382c,       // 复古深棕皮革（信使包 / 双层腰带 / 靴身）
  leather_light: 0xb08d57, // 土黄皮带 / 绑带 (tan)
  gold: 0xc9a05a,          // 古金饰件（金日徽12光芒 / 狐面浮雕扣 / 罗盘怀表 / 金绣边）
  sole: 0x24201c,          // 深色齿轮厚底
  paper: 0xf2ead9,         // 羊皮纸地图卷 / 信件纸张
  wax: 0xa63a2e,           // 火漆印章红
  skin: 0xc4936d,          // 皮肤基底暖色（目标图色卡 #c4936d）
  skin_shadow: 0x9e6b47,   // 皮肤暗部阴影（目标图色卡 #9e6b47）
  hair: 0x3d302a,          // 微卷长发/丸子头深炭棕（目标图色卡 #3d302a）
  hair_warm: 0x5c3d2e,     // 卷发暖棕高光分面（目标图色卡 #5c3d2e）
  beard: 0x3d302a,         // 下颌短胡茬与上唇胡（目标图色卡 #3d302a）
  iris: 0xa87834,          // 琥珀金瞳
  sclera: 0xf0ede6,        // 巩膜象牙白
  lip: 0xb57a6c,           // 嘴唇微红
  crease: 0x7c4e38,        // 结构阴影
  stubble: 0x4d3b32,       // 面部渐变胡茬基色
  // 目标图专属领口与搭扣色卡
  face_wine: 0x7c2d37,     // 目标图酒红斗篷色卡 (#7c2d37)
  face_teal: 0x2b4e4c,     // 目标图青绿内衬色卡 (#2b4e4c)
  face_gold: 0xb38c4c,     // 目标图古金搭扣色卡 (#b38c4c)
  face_ivory: 0xded3c2,    // 目标图象牙白领口色卡 (#ded3c2)
};

/**
 * 根据设定图材料名创建符合 PBR 与扁平质感的 MeshStandardMaterial
 */
function createCourierMaterial(name, matCache) {
  if (matCache[name]) return matCache[name];

  const P = COURIER_PALETTE;
  let hex = P[name];
  let metalness = 0;
  let roughness = 0.85;
  let side = THREE.FrontSide;

  if (name === "gold") {
    hex = P.gold; metalness = 0.65; roughness = 0.35;
  } else if (name === "wine") {
    hex = P.wine; roughness = 0.88; metalness = 0.05; side = THREE.DoubleSide;
  } else if (name === "wine_light") {
    hex = P.wine_light; roughness = 0.88; metalness = 0.05; side = THREE.DoubleSide;
  } else if (name === "wine_shadow") {
    hex = P.wine_shadow; roughness = 0.88; metalness = 0.05; side = THREE.DoubleSide;
  } else if (name === "teal") {
    hex = P.teal; roughness = 0.85; metalness = 0.05;
  } else if (name === "teal_light") {
    hex = P.teal_light; roughness = 0.85; metalness = 0.05;
  } else if (name === "teal_shadow") {
    hex = P.teal_shadow; roughness = 0.85; metalness = 0.05;
  } else if (name === "ivory") {
    hex = P.ivory; roughness = 0.85; metalness = 0;
  } else if (name === "shirt_shadow") {
    hex = P.shirt_shadow; roughness = 0.85; metalness = 0;
  } else if (name === "pants") {
    hex = P.pants; roughness = 0.82; metalness = 0.02;
  } else if (name === "leather") {
    hex = P.leather; roughness = 0.75; metalness = 0.1;
  } else if (name === "leather_light") {
    hex = P.leather_light; roughness = 0.75; metalness = 0.1;
  } else if (name === "sole") {
    hex = P.sole; roughness = 0.92; metalness = 0;
  } else if (name === "paper") {
    hex = P.paper; roughness = 0.95; metalness = 0;
  } else if (name === "wax") {
    hex = P.wax; roughness = 0.35; metalness = 0.12;
  } else if (name.includes("hair")) {
    if (name.includes(".001") || name.includes(".002")) {
      hex = P.hair_warm; roughness = 0.88; metalness = 0;
    } else {
      hex = P.hair; roughness = 0.9; metalness = 0;
    }
  } else if (name.includes("beard")) {
    hex = P.beard; roughness = 0.9; metalness = 0;
  } else if (name.includes("iris")) {
    hex = P.iris; roughness = 0.35; metalness = 0.05;
  } else if (name.includes("sclera")) {
    hex = P.sclera; roughness = 0.45; metalness = 0;
  } else if (name.includes("lip")) {
    hex = P.lip; roughness = 0.72; metalness = 0;
  } else if (name.includes("crease")) {
    hex = P.crease; roughness = 0.85; metalness = 0;
  } else if (name.startsWith("Anatomy_stubble_")) {
    // 目标图渐变胡茬色阶（从暖色皮肤阴影向深棕过渡）
    const num = parseInt(name.replace("Anatomy_stubble_", ""), 10) || 1;
    const t = Math.min(1, Math.max(0, (num - 1) / 10));
    const cSkin = new THREE.Color(P.skin_shadow);
    const cBeard = new THREE.Color(P.beard);
    const c = cSkin.lerp(cBeard, t * 0.78);
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.9, metalness: 0, flatShading: true,
    });
    matCache[name] = mat;
    return mat;
  } else if (name === "Anatomy_facet_3.002") {
    hex = P.skin_shadow; roughness = 0.85; metalness = 0;
  } else if (head38.materials && head38.materials[name]) {
    const raw = head38.materials[name];
    const c = new THREE.Color().setRGB(...raw.color);
    const m = new THREE.MeshStandardMaterial({
      color: c, roughness: raw.roughness ?? 0.85, metalness: raw.metalness || 0, flatShading: true,
    });
    matCache[name] = m;
    return m;
  } else if (name.includes("skin") || name.includes("facet")) {
    hex = P.skin; roughness = 0.8; metalness = 0;
  } else {
    hex = 0x888888;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: hex, roughness, metalness, side, flatShading: true,
  });
  matCache[name] = mat;
  return mat;
}

export function buildHumanCourierCodrops({ scale = COURIER_SCALE } = {}) {
  const root = new THREE.Group();
  root.name = "Courier";

  function joint(parent, name, x, y, z) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  // ================= 15 处核心分层关节契约（与 humanCourier 完全一致）=================
  const body = joint(root, "body", 0, .94, 0);
  const head = joint(body, "head", 0, .61, 0);
  const cape = joint(body, "cape", 0, .45, -.08);
  const legL = joint(root, "legL", .092, .93, 0);
  const legR = joint(root, "legR", -.092, .93, 0);
  const kneeL = joint(legL, "kneeL", .001, -.42, 0);
  const kneeR = joint(legR, "kneeR", -.001, -.42, 0);
  const armL = joint(body, "armL", .1155, .436, 0);
  const armR = joint(body, "armR", -.1155, .436, 0);
  const elbowL = joint(armL, "elbowL", .125, -.253, .015);
  const elbowR = joint(armR, "elbowR", -.125, -.253, .015);
  const handL = joint(elbowL, "handL", .0845, -.211, .034);
  const handR = joint(elbowR, "handR", -.0845, -.211, .034);
  const letter = joint(handR, "letter", .002, -.071, .039);

  const jointMap = {
    Courier: root, body, head, cape,
    armL, elbowL, handL, armR, elbowR, handR, letter,
    legL, kneeL, legR, kneeR,
  };
  const jointNames = Object.keys(jointMap);

  // ================= head-38 高精度雕刻资产完整映射到各关节 =================
  const matCache = {};
  const nodes = new Map();
  for (const n of head38.nodes) {
    const g = new THREE.Group();
    g.name = n.name;
    new THREE.Matrix4().fromArray(n.matrix).decompose(g.position, g.quaternion, g.scale);
    nodes.set(n.name, g);
  }
  for (const n of head38.nodes) {
    if (n.parent && nodes.has(n.parent)) {
      nodes.get(n.parent).add(nodes.get(n.name));
    }
  }
  const headRoot = nodes.get("Courier");
  headRoot.updateMatrixWorld(true);

  // 部件按所属关节与材质归批烘焙
  const batches = new Map();
  for (const n of head38.nodes) {
    // 跳过孤立错位的旧版冗余鼻体（Face 网格已内建完整精致鼻梁与鼻尖）
    if (!n.parts || n.name === "Nose") continue;
    // 过滤掉破坏低模面部雕刻美感的密集毛发微网格（目标图为精简利落的 Low Poly 分面雕刻）
    if (n.name.toLowerCase().includes("fiber")) continue;

    const obj = nodes.get(n.name);
    let jnt = obj.parent;
    while (jnt && !jointNames.includes(jnt.name)) jnt = jnt.parent;
    jnt = jnt || headRoot;

    const matrix = jnt.matrixWorld.clone().invert().multiply(obj.matrixWorld);

    for (const part of n.parts) {
      const positions = [];
      for (let i = 0; i < part.position.length; i += 3) {
        const v = new THREE.Vector3(part.position[i], part.position[i + 1], part.position[i + 2]).applyMatrix4(matrix);
        // 修正导出阶段眼窝深层顶点坐标（将负值偏移还原至面部眼眶深度）
        if (jnt.name === "head" && v.z < -1.0) v.z += 1.708;
        positions.push(v.x, v.y, v.z);
      }

      const key = `${jnt.name}:${part.material}`;
      if (!batches.has(key)) {
        batches.set(key, {
          jointName: jnt.name,
          material: createCourierMaterial(part.material, matCache),
          positions: [],
          normals: [],
        });
      }
      const b = batches.get(key);
      b.positions.push(...positions);
      b.normals.push(...part.normal);
    }
  }

  // 实例化各关节雕刻网格
  for (const [key, b] of batches) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.normals, 3));
    geo.computeBoundingSphere();

    const m = new THREE.Mesh(geo, b.material);
    m.name = key;
    m.castShadow = true;
    m.receiveShadow = true;

    const targetJoint = jointMap[b.jointName] || body;
    targetJoint.add(m);
  }

  // ================= 目标图核心细节强化 =================
  // 1. 高筒缠绑皮靴强化（目标图：多道土黄绑带交叉缠绑，古金搭扣，深色齿轮厚底）
  const tanMat = createCourierMaterial("leather_light", matCache);
  const goldMat = createCourierMaterial("gold", matCache);
  const soleMat = createCourierMaterial("sole", matCache);

  const strapRingGeo = new THREE.BoxGeometry(0.126, 0.022, 0.126);
  const crossStrapGeo = new THREE.BoxGeometry(0.02, 0.18, 0.128);
  const buckleGeo = new THREE.BoxGeometry(0.024, 0.032, 0.016);
  const soleLugGeo = new THREE.BoxGeometry(0.12, 0.016, 0.22);

  for (const sgn of [1, -1]) {
    const kn = sgn > 0 ? kneeL : kneeR;
    const outerX = sgn * 0.062;

    // 4-5 道水平绑带环绕靴筒
    const bandHeights = [-0.12, -0.18, -0.24, -0.30, -0.36];
    for (const y of bandHeights) {
      const ring = new THREE.Mesh(strapRingGeo, tanMat);
      ring.position.set(0, y, 0.005);
      ring.castShadow = true;
      kn.add(ring);

      // 外侧古金搭扣
      const buckle = new THREE.Mesh(buckleGeo, goldMat);
      buckle.position.set(outerX, y, 0.005);
      buckle.castShadow = true;
      kn.add(buckle);
    }

    // 交叉绑带（斜跨绑缚）
    const strapA = new THREE.Mesh(crossStrapGeo, tanMat);
    strapA.position.set(0, -0.24, 0.006);
    strapA.rotation.z = 0.35 * sgn;
    kn.add(strapA);

    const strapB = new THREE.Mesh(crossStrapGeo, tanMat);
    strapB.position.set(0, -0.24, 0.006);
    strapB.rotation.z = -0.35 * sgn;
    kn.add(strapB);

    // 齿轮厚底强化
    const soleLug = new THREE.Mesh(soleLugGeo, soleMat);
    soleLug.position.set(0, -0.495, 0.045);
    soleLug.receiveShadow = true;
    kn.add(soleLug);
  }

  // 2. 信使包内露出的蜡封信件叠（目标图：复古深棕皮革信使包内装有多封蜡封信件）
  const letterPaperMat = createCourierMaterial("paper", matCache);
  const letterWaxMat = createCourierMaterial("wax", matCache);

  const satchelLettersGroup = new THREE.Group();
  satchelLettersGroup.name = "SatchelInteriorLetters";
  satchelLettersGroup.position.set(0.208, -0.015, 0.046);
  satchelLettersGroup.rotation.set(-0.25, 0.15, -0.12);

  const envGeo = new THREE.BoxGeometry(0.12, 0.075, 0.008);
  const sealGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.006, 8);

  for (let i = 0; i < 3; i++) {
    const env = new THREE.Mesh(envGeo, letterPaperMat);
    env.position.set(i * 0.008, i * 0.012, -i * 0.015);
    env.rotation.z = (i - 1) * 0.1;
    env.castShadow = true;

    const seal = new THREE.Mesh(sealGeo, letterWaxMat);
    seal.rotation.x = Math.PI / 2;
    seal.position.set(0, 0, 0.005);
    env.add(seal);

    satchelLettersGroup.add(env);
  }
  body.add(satchelLettersGroup);

  // 3. 严格对齐《信使 · Low Poly 面部目标》：分面微卷垂颊发束、半扎丸子头束圈与斗篷翻领古金搭扣
  const hairDarkMat = createCourierMaterial("hair", matCache);
  const hairWarmMat = createCourierMaterial("hair_warm", matCache);
  const wineMat = createCourierMaterial("wine", matCache);
  const tealMat = createCourierMaterial("teal", matCache);
  const ivoryMat = createCourierMaterial("ivory", matCache);

  // 两侧垂颊微卷发束（目标图正面、侧面、3/4 视角中脸颊两旁醒目的波浪分面发绺）
  const sideLockGroup = new THREE.Group();
  sideLockGroup.name = "TargetLowPolySideLocks";
  for (const sgn of [-1, 1]) {
    // 侧鬓垂卷上段
    const upperLockGeo = new THREE.BoxGeometry(0.018, 0.075, 0.024);
    const upperLock = new THREE.Mesh(upperLockGeo, hairDarkMat);
    upperLock.position.set(sgn * 0.076, 0.065, 0.038);
    upperLock.rotation.set(0.18, sgn * -0.15, sgn * 0.22);
    sideLockGroup.add(upperLock);

    // 侧鬓垂卷中段（向内微扣，贴合高颧骨）
    const midLockGeo = new THREE.BoxGeometry(0.015, 0.068, 0.022);
    const midLock = new THREE.Mesh(midLockGeo, hairWarmMat);
    midLock.position.set(sgn * 0.074, 0.012, 0.046);
    midLock.rotation.set(0.24, sgn * -0.22, sgn * -0.18);
    sideLockGroup.add(midLock);

    // 垂发末梢（自然微扬下垂至下颌角）
    const tipLockGeo = new THREE.BoxGeometry(0.012, 0.052, 0.018);
    const tipLock = new THREE.Mesh(tipLockGeo, hairDarkMat);
    tipLock.position.set(sgn * 0.068, -0.038, 0.042);
    tipLock.rotation.set(0.12, sgn * -0.1, sgn * 0.15);
    sideLockGroup.add(tipLock);
  }
  head.add(sideLockGroup);

  // 脑后半扎丸子头束圈与发扣（目标图侧面与3/4视角中位于枕骨顶端的半扎丸子头）
  const bunRingGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.018, 6);
  const bunRing = new THREE.Mesh(bunRingGeo, hairWarmMat);
  bunRing.position.set(0, 0.182, -0.092);
  bunRing.rotation.x = Math.PI * 0.35;
  head.add(bunRing);

  // 颈部酒红斗篷折叠领口、青绿衬里与古金菱形搭扣（目标图下半身领口标志性特征）
  const cowlGroup = new THREE.Group();
  cowlGroup.name = "TargetLowPolyCowlBust";
  cowlGroup.position.set(0, -0.11, 0.01);

  // 酒红斗篷外领环
  const cowlOuterGeo = new THREE.CylinderGeometry(0.115, 0.145, 0.065, 8, 1, true);
  const cowlOuter = new THREE.Mesh(cowlOuterGeo, wineMat);
  cowlOuter.scale.set(1.0, 1.0, 0.88);
  cowlGroup.add(cowlOuter);

  // 青绿内衬折边
  const cowlInnerGeo = new THREE.CylinderGeometry(0.108, 0.138, 0.062, 8, 1, true);
  const cowlInner = new THREE.Mesh(cowlInnerGeo, tealMat);
  cowlInner.position.set(0, -0.005, 0.005);
  cowlInner.scale.set(0.96, 0.96, 0.84);
  cowlGroup.add(cowlInner);

  // 领口内露出的象牙白衬衣 V 领
  const shirtVGeo = new THREE.BoxGeometry(0.062, 0.045, 0.025);
  const shirtV = new THREE.Mesh(shirtVGeo, ivoryMat);
  shirtV.position.set(0, 0.015, 0.068);
  shirtV.rotation.x = -0.28;
  cowlGroup.add(shirtV);

  // 右侧古金菱形斗篷搭扣（目标图右侧肩颈处关键特征）
  const claspGeo = new THREE.BoxGeometry(0.034, 0.034, 0.012);
  const clasp = new THREE.Mesh(claspGeo, goldMat);
  clasp.position.set(0.078, 0.012, 0.072);
  clasp.rotation.set(-0.25, 0.35, Math.PI * 0.25); // 45° 旋转形成菱形搭扣
  const claspHoleGeo = new THREE.BoxGeometry(0.016, 0.016, 0.014);
  const claspHole = new THREE.Mesh(claspHoleGeo, soleMat);
  clasp.add(claspHole);
  cowlGroup.add(clasp);

  head.add(cowlGroup);

  // 手持蜡封信（初始隐藏，任务/手持状态下显现）
  letter.visible = false;

  // 阴影与图层遍历配置
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // 用户数据与关节句柄
  root.userData = {
    isHumanCourier: true,
    bodyBaseY: 0.94,
    body, head, cape,
    legL, legR, kneeL, kneeR,
    armL, armR, elbowL, elbowR,
    handL, handR, letter,
    palette: COURIER_PALETTE,
    source: "courierCodrops.js · Codrops 方法论整体重建（设定图）",
  };

  root.scale.setScalar(scale);
  root.position.y = -0.006999999620020403 * scale; // soles at the player foot origin
  return root;
}
