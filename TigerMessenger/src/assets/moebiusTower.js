// =====================================================================
//  莫比斯复合水晶塔（createDetailedMoebiusTower）
//  多级尖塔 + 中腰水晶观景平台 + 外玻璃内暖光双层半球花厅（Bio-Domes）
//  花厅沿 Y 轴 2~3 层错落，暖橙红点光源照明；全件唐伯虎笔意描边
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

/** 冰川蓝外罩玻璃 */
const GLASS_SHELL = 0xd6eaf8;
/** 淡灰水晶平台 */
const PLATFORM_GLASS = 0xc5d5e0;
/** 花厅照明：橙黄 / 温馨淡粉 间隔搭配的点光源 */
const HALL_AMBER = 0xffb254; // 橙黄
const HALL_PINK = 0xffc7da; // 温馨淡粉
/** 花厅内核暖色基底（被点光源照亮，仅保留弱自发光） */
const HALL_CORE = 0xffb27a;
/** 第 index 层花厅的光色：按种子交错，避免相邻塔同色 */
export function hallLightColorAt(index, seed = 0) {
  return (index + (seed & 1)) % 2 === 0 ? HALL_AMBER : HALL_PINK;
}
const STEM = 0x3d8a4a;
const CANOPY = 0x2e8b7a; // 科幻伞冠改为青绿，避免误读成「红色楼板」
const GOLD = 0xd4af37;

function mesh(geo, mat, outline = 0.03) {
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (mat?.isMeshPhysicalMaterial) {
    // 物理玻璃：反向壳 + 棱边墨线，保证透光时仍有唐伯虎轮廓
    addOutline(m, outline * 0.55, 0x211e19, 0.03);
    addGlassEdgeInk(m, outline);
  } else {
    addOutline(m, outline, 0x211e19, 0.035);
  }
  return m;
}

/**
 * 玻璃件附加棱边墨线（与 addOutline 叠用，远景读边更干净）
 */
function addGlassEdgeInk(target, outline = 0.02) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(target.geometry, 18),
    new THREE.LineBasicMaterial({
      color: 0x211e19,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  edges.raycast = () => {};
  edges.userData.isOutline = true;
  edges.renderOrder = 3;
  target.add(edges);
  return edges;
}

function inkToon(color, options = {}) {
  return toonMat(color, { flatShading: true, ...options });
}

const _rodDir = new THREE.Vector3();
const _rodMid = new THREE.Vector3();
const _rodUp = new THREE.Vector3(0, 1, 0);
const _rodQuat = new THREE.Quaternion();

/** 在任意两点间拉一根五棱杆，用于栏杆、肢体与曲折植物茎。 */
function rodBetween(parent, a, b, radius, material, outline = 0.01) {
  _rodDir.subVectors(b, a);
  const length = _rodDir.length();
  if (length < 1e-5) return null;
  const rod = mesh(
    new THREE.CylinderGeometry(radius, radius * 1.08, length, 5),
    material,
    outline
  );
  _rodMid.addVectors(a, b).multiplyScalar(0.5);
  rod.position.copy(_rodMid);
  rod.quaternion.copy(_rodQuat.setFromUnitVectors(_rodUp, _rodDir.normalize()));
  parent.add(rod);
  return rod;
}

/**
 * 高透冰川蓝物理玻璃（外罩 / 观景平台）
 * @param {number} [color]
 * @param {{ transmission?: number, ior?: number, opacity?: number, thickness?: number }} [opts]
 */
function glassMat(color = GLASS_SHELL, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    transmission: opts.transmission ?? 0.92,
    opacity: opts.opacity ?? 1.0,
    transparent: true,
    roughness: opts.roughness ?? 0.04,
    metalness: 0.0,
    ior: opts.ior ?? 1.72,
    thickness: opts.thickness ?? 2.2,
    color: new THREE.Color(color),
    emissive: new THREE.Color(0x1a3344),
    emissiveIntensity: opts.emissiveIntensity ?? 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0x9bd8ea),
    attenuationDistance: 8,
    flatShading: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * 花厅内核材质：暖色基底 + 弱自发光（主照明交给点光源，不再用霓虹高强发光）
 * @param {number} lightColor 与本层点光源同色的弱自发光
 */
function hallCoreMat(lightColor) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(HALL_CORE).multiplyScalar(0.6),
    emissive: new THREE.Color(lightColor),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.9,
    roughness: 0.4,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}

/**
 * 水晶观景平台：半径 = 主楼体 × 1.3，淡灰/透明物理玻璃
 * @param {number} bodyRadius 当前腰部主楼半径
 * @param {number} [outline]
 */
function createCrystalPlatform(bodyRadius, outline = 0.028) {
  const r = bodyRadius * 1.3;
  const platform = mesh(
    new THREE.CylinderGeometry(r, r * 0.96, 0.14, 8),
    glassMat(PLATFORM_GLASS, {
      transmission: 0.78,
      ior: 1.55,
      thickness: 1.4,
      roughness: 0.12,
      emissiveIntensity: 0.18,
    }),
    outline
  );
  platform.name = "crystal-view-platform";
  platform.userData.radius = r;
  return platform;
}

/**
 * 双层花厅（Bio-Dome）
 * 外：冰川蓝半球物理玻璃；内：暖色半球 + 暖橙红 PointLight 主照明
 *
 * @param {object} o
 * @param {number} o.radius 外罩半径
 * @param {number} [o.lightColor] 点光源颜色（默认暖橙红）
 * @param {number} [o.lightIntensity]
 * @param {number} [o.lightDistance]
 * @returns {THREE.Group}
 */
function createNeonBioDome({
  radius = 1.6,
  lightColor = HALL_AMBER,
  lightIntensity = 2.8,
  lightDistance = 14,
} = {}) {
  const hall = new THREE.Group();
  hall.name = "neon-bio-dome";

  // ----- 外层清透玻璃罩（上半球）-----
  // SphereGeometry 上半：phiLength = π/2
  const shellGeo = new THREE.SphereGeometry(radius, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new THREE.Mesh(facet(shellGeo), glassMat(GLASS_SHELL, { transmission: 0.92, ior: 1.72 }));
  shell.name = "neon-dome-shell";
  shell.castShadow = true;
  shell.receiveShadow = true;
  addOutline(shell, 0.04, 0x211e19, 0.03);
  addGlassEdgeInk(shell, 0.04);
  hall.add(shell);

  // ----- 内层暖光核心（略小半球，与本层点光源同色弱自发光）-----
  const coreR = radius * 0.72;
  const coreGeo = new THREE.SphereGeometry(coreR, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const core = new THREE.Mesh(facet(coreGeo), hallCoreMat(lightColor));
  core.name = "neon-dome-core";
  core.position.y = 0.02;
  core.castShadow = false;
  addOutline(core, 0.022, 0x211e19, 0.025);
  hall.add(core);

  // 核心内再嵌一颗更小的「灯芯」球，强化体积光感
  const wick = new THREE.Mesh(
    facet(new THREE.SphereGeometry(coreR * 0.38, 8, 6)),
    new THREE.MeshBasicMaterial({
      color: lightColor,
      transparent: true,
      opacity: 0.92,
    })
  );
  wick.name = "neon-dome-wick";
  wick.position.y = coreR * 0.28;
  addOutline(wick, 0.012, 0x211e19, 0.02);
  hall.add(wick);

  // ----- 花厅主照明：暖橙红 PointLight -----
  const glow = new THREE.PointLight(lightColor, lightIntensity, lightDistance, 1.8);
  glow.name = "neon-dome-point-light";
  glow.position.set(0, coreR * 0.45, 0);
  hall.add(glow);

  hall.userData.shell = shell;
  hall.userData.core = core;
  hall.userData.glow = glow;
  hall.userData.lightColor = lightColor;
  hall.userData.radius = radius;
  return hall;
}

/**
 * 在塔身某高度挂一层：水晶平台 + 偏心暖光花厅
 * 平台中心仍在塔轴；花厅沿方位角探出，扎在平台边缘内侧
 *
 * @param {THREE.Group} parent
 * @param {object} cfg
 */
function attachBioDomeLayer(parent, cfg) {
  const {
    y,
    bodyRadius,
    domeRadius,
    lightColor = HALL_AMBER,
    yaw = 0,
    tilt = 0.18,
    lightIntensity,
    lightDistance,
  } = cfg;

  const layer = new THREE.Group();
  layer.name = "bio-dome-layer";
  layer.position.y = y;
  layer.rotation.y = yaw;
  parent.add(layer);

  // 1) 腰部水晶观景平台（半径 1.3× 主楼）
  const platform = createCrystalPlatform(bodyRadius, 0.03);
  platform.position.y = 0;
  layer.add(platform);
  const platR = platform.userData.radius;

  // 2) 花厅扎根在平台前缘（局部 +Z），略抬离板面
  const hall = createNeonBioDome({
    radius: domeRadius,
    lightColor,
    lightIntensity: lightIntensity ?? 2.6 + domeRadius * 0.35,
    lightDistance: lightDistance ?? 10 + domeRadius * 4,
  });
  // 半球底坐在平台上；整体略向外侧倾斜，像依附在大楼侧面
  const outward = platR * 0.42;
  hall.position.set(0, 0.08, outward);
  hall.rotation.x = -tilt; // 罩口略朝外上
  layer.add(hall);

  // 3) 平台外缘一圈矮栏（低多边，墨线），强化「观景台」层次
  const railMat = inkToon(0x2a3038);
  const posts = 10;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const post = mesh(new THREE.BoxGeometry(0.07, 0.38, 0.07), railMat, 0.007);
    post.position.set(Math.cos(a) * platR * 0.92, 0.22, Math.sin(a) * platR * 0.92);
    layer.add(post);
  }

  return { layer, platform, hall, glow: hall.userData.glow, core: hall.userData.core };
}

/**
 * 复合莫比斯水晶塔。
 * @param {object} o
 * @param {number} o.stages 塔身层数 2~3
 * @param {boolean} o.balcony 是否在最低花厅平台布置阳台社区
 * @param {boolean} o.goldScales 是否金色鳞片（沿轨塔群用）
 * @param {number} o.seed 随机种子
 */
export function createDetailedMoebiusTower({
  stages = 3,
  balcony = true,
  goldScales = false,
  seed = 1,
} = {}) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const g = new THREE.Group();
  g.name = "moebius-detailed-tower";
  const bodyMat = glassMat();

  // ---------- 1. 多级尖塔主体（记录每级腰部半径，供花厅挂载） ----------
  const stageDefs = [
    { r: 1.55, h: 6.4 },
    { r: 1.08, h: 7.6 },
    { r: 0.66, h: 8.8 },
  ].slice(0, THREE.MathUtils.clamp(stages | 0, 2, 3));

  /** @type {{ y0: number, y1: number, r: number, h: number }[]} */
  const stageMeta = [];
  let y = 0;
  for (const def of stageDefs) {
    const stage = mesh(new THREE.CylinderGeometry(def.r * 0.82, def.r, def.h, 6), bodyMat, 0.04);
    stage.position.y = y + def.h / 2;
    g.add(stage);
    stageMeta.push({ y0: y, y1: y + def.h, r: def.r, h: def.h });
    if (goldScales) {
      for (let k = 0; k < 3; k++) {
        const sc = mesh(
          new THREE.BoxGeometry(0.38, 0.56, 0.08),
          inkToon(GOLD, { emissive: 0x6a5400, emissiveIntensity: 0.35 }),
          0.012
        );
        const a = k * 2.1 + y * 0.5;
        sc.position.set(
          Math.cos(a) * def.r * 0.92,
          y + def.h * (0.25 + k * 0.25),
          Math.sin(a) * def.r * 0.92
        );
        sc.rotation.y = -a;
        g.add(sc);
      }
    }
    y += def.h;
  }
  const bodyTop = y;

  // 顶端细杆 + 避雷针尖
  const rodH = 5.0;
  const tipH = 1.25;
  const tipRod = mesh(new THREE.CylinderGeometry(0.055, 0.095, rodH, 5), bodyMat, 0.015);
  tipRod.position.y = y + rodH / 2;
  g.add(tipRod);
  const tip = mesh(
    new THREE.ConeGeometry(0.2, tipH, 5),
    inkToon(GOLD, { emissive: 0x8a6a10, emissiveIntensity: 0.5 }),
    0.015
  );
  tip.position.y = y + rodH + tipH / 2;
  g.add(tip);

  // ---------- 2. 沿 Y 轴错落的 2~3 层暖光花厅（Bio-Domes） ----------
  // 在指定高度取所在层的主楼半径（腰部）
  function bodyRadiusAt(height) {
    for (const st of stageMeta) {
      if (height >= st.y0 && height <= st.y1) {
        // 上收下扩：线性插值
        const t = (height - st.y0) / st.h;
        return THREE.MathUtils.lerp(st.r, st.r * 0.82, t);
      }
    }
    return stageMeta[stageMeta.length - 1]?.r ?? 1.0;
  }

  // 布局：低层巨型、中层、高层小花厅（2 级塔只放前两个）；
  // 光色按「橙黄 / 淡粉」逐层间隔，再按种子交错，相邻塔不同色
  const domePlan = [
    {
      // 约 1/4 高度 · 面向左侧 · 巨型暖光花厅
      frac: 0.26,
      sizeMul: 1.05,
      yaw: Math.PI * 0.55, // 偏左
      tilt: 0.2,
      lightIntensity: 3.4,
    },
    {
      // 约 1/2 高度 · 斜向
      frac: 0.52,
      sizeMul: 0.72,
      yaw: -Math.PI * 0.35,
      tilt: 0.22,
      lightIntensity: 2.6,
    },
    {
      // 约 2/3 高度 · 另一侧（仅 3 级塔）
      frac: 0.7,
      sizeMul: 0.58,
      yaw: Math.PI * 1.15,
      tilt: 0.16,
      lightIntensity: 2.4,
    },
  ];
  const domeCount = stageDefs.length >= 3 ? 3 : 2;
  const bioLayers = [];
  /** @type {THREE.PointLight[]} */
  const neonLights = [];
  /** @type {THREE.Mesh[]} */
  const neonCores = [];

  for (let i = 0; i < domeCount; i++) {
    const plan = domePlan[i];
    // 轻微种子扰动，避免塔塔同模
    const frac = plan.frac + (rnd() - 0.5) * 0.04;
    const height = THREE.MathUtils.clamp(bodyTop * frac, stageMeta[0].y0 + 1.2, bodyTop - 1.0);
    const br = bodyRadiusAt(height);
    // 花厅半径随平台走：约 0.95× 平台半径，再乘 sizeMul
    const platR = br * 1.3;
    const domeR = Math.max(0.55, platR * 0.78 * plan.sizeMul);
    const attached = attachBioDomeLayer(g, {
      y: height,
      bodyRadius: br,
      domeRadius: domeR,
      lightColor: hallLightColorAt(i, seed),
      yaw: plan.yaw + (rnd() - 0.5) * 0.25,
      tilt: plan.tilt,
      lightIntensity: plan.lightIntensity,
      lightDistance: 12 + domeR * 5,
    });
    bioLayers.push(attached);
    neonLights.push(attached.glow);
    neonCores.push(attached.core);
  }

  // 主花厅引用（兼容旧 userData.parts）
  const primary = bioLayers[0];
  const dome = primary?.hall?.userData?.shell ?? null;
  const core = primary?.core ?? null;
  const glow = primary?.glow ?? null;
  const domeY = primary?.layer?.position.y ?? bodyTop * 0.26;

  // ---------- 3. 空中观景阳台社区（挂在最低花厅平台上） ----------
  if (balcony && primary) {
    const deckLayer = primary.layer;
    const platR = primary.platform.userData.radius;
    const deckY = 0.08; // 相对 layer
    // 小圆桌 ×2 + 椅子（坐在平台内侧，不挡花厅）
    for (const side of [-1, 1]) {
      const tx = side * platR * 0.35;
      const tz = -platR * 0.28; // 塔轴侧
      const tableTop = mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.06, 8),
        inkToon(0xd8cbb2),
        0.01
      );
      tableTop.position.set(tx, deckY + 0.48, tz);
      deckLayer.add(tableTop);
      const tableLeg = mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.42, 5),
        inkToon(0x4a5560),
        0.008
      );
      tableLeg.position.set(tx, deckY + 0.24, tz);
      deckLayer.add(tableLeg);
      for (const cs of [-1, 1]) {
        const chair = mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), inkToon(0x8a6a4a), 0.012);
        chair.position.set(tx + cs * 0.48, deckY + 0.18, tz);
        deckLayer.add(chair);
      }
      // 喝茶小人偶
      if (rnd() > 0.28) {
        const npc = new THREE.Group();
        const npcBody = mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 0.32, 5),
          inkToon(0x4a6a8a),
          0.012
        );
        npcBody.position.y = 0.28;
        npc.add(npcBody);
        const skinMat = inkToon(0xf0c8a0);
        const npcHead = mesh(new THREE.SphereGeometry(0.12, 6, 5), skinMat, 0.01);
        npcHead.position.y = 0.52;
        npc.add(npcHead);
        rodBetween(
          npc,
          new THREE.Vector3(-0.1, 0.4, 0),
          new THREE.Vector3(-0.02, 0.32, 0.15),
          0.04,
          skinMat,
          0.006
        );
        rodBetween(
          npc,
          new THREE.Vector3(0.1, 0.4, 0),
          new THREE.Vector3(0.03, 0.32, 0.15),
          0.04,
          skinMat,
          0.006
        );
        const legMat = inkToon(0x334b64);
        rodBetween(
          npc,
          new THREE.Vector3(-0.07, 0.16, 0),
          new THREE.Vector3(-0.09, 0.03, 0.14),
          0.05,
          legMat,
          0.007
        );
        rodBetween(
          npc,
          new THREE.Vector3(0.07, 0.16, 0),
          new THREE.Vector3(0.09, 0.03, 0.14),
          0.05,
          legMat,
          0.007
        );
        const cup = mesh(
          new THREE.CylinderGeometry(0.035, 0.045, 0.07, 5),
          inkToon(0xf4f7ed),
          0.006
        );
        cup.position.set(0.12, 0.34, 0.1);
        npc.add(cup);
        npc.position.set(tx + 0.48, deckY + 0.32, tz);
        npc.rotation.y = Math.PI * (0.85 + rnd() * 0.3);
        deckLayer.add(npc);
      }
    }
  }

  // ---------- 4. 巨型伞状科幻植物（底座 + 最低平台缝） ----------
  const plantSpots = [
    { x: 1.2, z: 0.4, y0: 0, h: 5.5, lean: 0.5 },
    { x: -1.1, z: -0.5, y0: 0, h: 4.5, lean: -0.55 },
  ];
  if (balcony && primary) {
    plantSpots.push({
      x: 0.35,
      z: -0.2,
      y0: domeY + 0.1,
      h: 2.8,
      lean: 0.35,
    });
  }
  const stemMat = inkToon(STEM);
  for (const p of plantSpots) {
    const root = new THREE.Vector3(p.x, p.y0, p.z);
    const k1 = new THREE.Vector3(p.x + p.lean * 0.45, p.y0 + p.h * 0.34, p.z + 0.18);
    const k2 = new THREE.Vector3(p.x - p.lean * 0.2, p.y0 + p.h * 0.68, p.z - 0.16);
    const top = new THREE.Vector3(p.x + p.lean * 0.62, p.y0 + p.h, p.z + 0.08);
    rodBetween(g, root, k1, 0.075, stemMat, 0.012);
    rodBetween(g, k1, k2, 0.06, stemMat, 0.011);
    rodBetween(g, k2, top, 0.05, stemMat, 0.01);
    const cap = mesh(new THREE.ConeGeometry(1.5, 0.5, 5), inkToon(CANOPY), 0.03);
    cap.position.copy(top).add(new THREE.Vector3(0, 0.14, 0));
    cap.rotation.z = Math.PI + p.lean * 0.1;
    cap.rotation.x = p.lean * 0.08;
    cap.scale.set(1, 0.48, 1);
    g.add(cap);
  }

  g.userData.collideRadius = 2.2;
  g.userData.height = bodyTop + rodH + tipH;
  g.userData.bioLayers = bioLayers;
  g.userData.neonLights = neonLights;
  g.userData.parts = {
    dome,
    core,
    glow,
    neonCores,
    neonLights,
    bioLayers,
    tail: null,
  };
  return g;
}
