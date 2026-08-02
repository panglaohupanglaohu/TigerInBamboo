// =====================================================================
//  程序化 Low-Poly 资产：树 / 房 / 石 / 花 / 栅栏 / 桥（纯基础几何体）
//  约定：Cel 卡通材质（2 阶梯 gradientMap）+ facet() 平直法线；
//        主体件附黑边描边；Group 底部中心在局部 (0,0,0)
// =====================================================================
import * as THREE from "three";
import { toonMat, outlineAs, getToonGradient } from "./toon.js";

/** 平直化：非索引 + 逐面法线（flatShading 的几何等价物，硬边水墨色块） */
export function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

/**
 * 低多边松树：基干 + 多层圆锥松冠，
 * 层与层之间用分形侧枝（黄金角螺旋 + 自相似收缩）连接。
 */
export function createLowPolyTree() {
  const g = new THREE.Group();
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  // 水墨：焦褐干 + 沉绿冠（远侧与宣纸底相称）
  const barkInk = toonMat(0x3a322c);
  const greens = [0x1a3024, 0x243828, 0x2c4030, 0x344838, 0x3c5040, 0x465848];

  // 基干
  const trunkH = 0.85;
  const trunk = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.1, 0.16, trunkH, 5)),
    barkInk
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  outlineAs(trunk, "treeTrunk");
  g.add(trunk);

  // 5~6 层圆锥，自下而上半径/高度按比例收缩（自相似）
  const layerN = 5 + ((Math.random() * 2) | 0);
  let yCursor = trunkH * 0.72;
  let phase = Math.random() * Math.PI * 2;
  let prevR = 0.72;

  for (let L = 0; L < layerN; L++) {
    const t = layerN <= 1 ? 0 : L / (layerN - 1);
    // 自相似：半径 / 高度按 ratio^L 收缩
    const ratio = 0.78;
    const r = 0.72 * Math.pow(ratio, L) * (0.92 + Math.random() * 0.12);
    const h = 0.55 * Math.pow(ratio, L * 0.85) * (0.9 + Math.random() * 0.15);
    const col = greens[Math.min(L, greens.length - 1)];

    // 层间主轴短枝（连接上下冠层）
    if (L > 0) {
      const gap = 0.12 + (1 - t) * 0.06;
      const bridge = new THREE.Mesh(
        facet(new THREE.CylinderGeometry(0.04 * (1 - t * 0.4), 0.055 * (1 - t * 0.3), gap, 5)),
        barkInk
      );
      bridge.position.y = yCursor + gap / 2;
      bridge.castShadow = true;
      outlineAs(bridge, "treeTrunk");
      g.add(bridge);
      yCursor += gap;
    }

    // 本层圆锥松叶
    const cone = new THREE.Mesh(facet(new THREE.ConeGeometry(r, h, 6)), toonMat(col));
    cone.position.y = yCursor + h * 0.38; // 层间重叠，松树塔状
    cone.castShadow = true;
    outlineAs(cone, "treeCrown");
    g.add(cone);

    // 分形侧枝：从层腰螺旋伸出，连接相邻冠缘
    const arms = Math.max(2, 5 - L);
    const armLen = prevR * 0.55 * (0.85 + Math.random() * 0.2);
    for (let a = 0; a < arms; a++) {
      const yaw = phase + a * GOLDEN + L * 0.3;
      const branch = new THREE.Group();
      branch.position.y = yCursor + h * 0.2;
      branch.rotation.order = "YXZ";
      branch.rotation.y = yaw;
      branch.rotation.x = 0.85 - t * 0.35; // 下倾
      const stem = new THREE.Mesh(
        facet(
          new THREE.CylinderGeometry(
            0.02 * (1 - t * 0.4),
            0.035 * (1 - t * 0.3),
            armLen,
            4
          )
        ),
        barkInk
      );
      stem.position.y = armLen / 2;
      stem.castShadow = true;
      outlineAs(stem, "treeTrunk");
      branch.add(stem);
      // 枝端小圆锥（二级自相似）
      const tipR = r * 0.28;
      const tipH = h * 0.35;
      const tip = new THREE.Mesh(facet(new THREE.ConeGeometry(tipR, tipH, 5)), toonMat(col));
      tip.position.y = armLen + tipH * 0.25;
      tip.castShadow = true;
      outlineAs(tip, "treeCrown");
      branch.add(tip);
      g.add(branch);
    }

    yCursor += h * 0.42;
    prevR = r;
    phase += GOLDEN * 1.5;
  }

  g.scale.setScalar(1.6); // 小世界量纲：~4.3m ≈ 玩家 2.5 倍
  g.userData.collideRadius = 0.38; // 局部值，世界半径随总缩放
  return g;
}

/**
 * 低多边房子 · 水墨化：
 * 墙宣纸白、瓦黛青/墨灰、门焦褐、窗淡墨青（备用工厂，布局 count 可为 0）
 */
export function createLowPolyHouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.6, 1.0, 1.4)),
    toonMat(0xf2ebe0) // 宣纸白墙
  );
  body.position.y = 0.5;
  body.castShadow = true;
  outlineAs(body, "house");
  g.add(body);

  const roof = new THREE.Mesh(
    facet(new THREE.ConeGeometry(1.25, 0.7, 4)),
    toonMat(0x4a5560) // 黛青瓦
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.0 + 0.35;
  roof.castShadow = true;
  outlineAs(roof, "house");
  g.add(roof);

  const door = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.4, 0.62, 0.06)),
    toonMat(0x3a322c) // 焦褐门
  );
  door.position.set(0, 0.31, 0.71);
  g.add(door);

  const win = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.3, 0.3, 0.05)),
    toonMat(0x8a9aaa) // 淡墨窗
  );
  win.position.set(0.48, 0.6, 0.71);
  g.add(win);

  const chimney = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.18, 0.45, 0.18)),
    toonMat(0x5a5854) // 墨灰烟囱
  );
  chimney.position.set(0.45, 1.25, 0);
  chimney.castShadow = true;
  g.add(chimney);

  g.scale.setScalar(2.4); // 小世界量纲：墙 ~2.4m ≈ 玩家 1.4 倍
  g.userData.collideRadius = 0.95;
  return g;
}

/** 岩石：随机扰动二十面体顶点，制造不规则感（相同坐标的顶点共享同一扰动，避免裂缝） */
export function createLowPolyRock() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const jitterCache = new Map(); // 非索引几何体顶点按面重复，按坐标哈希共享扰动
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!jitterCache.has(key)) jitterCache.set(key, 0.72 + Math.random() * 0.56);
    v.multiplyScalar(jitterCache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rock = new THREE.Mesh(facet(geo), toonMat(0x3a3834)); // 焦墨岩
  rock.scale.set(1, 0.7, 0.9);
  rock.position.y = 0.28; // 底部贴地
  rock.castShadow = true;
  outlineAs(rock, "rock");
  rock.receiveShadow = true;
  g.add(rock);
  g.scale.setScalar(1.6);
  g.userData.collideRadius = 0.5;
  return g;
}

/**
 * 草坪山丘：可贴地的低多边草丘（与 hills 色系一致：草绿 + 坡顶土褐）
 * 底部中心在局部 (0,0,0)，地图/场景 placeObjectOnSphere 即可。
 * @param {{ scale?: number, seed?: number }} [opts]
 */
export function createLowPolyLawnHill(opts = {}) {
  const scale = opts.scale ?? 1;
  const seed = (opts.seed ?? 11) >>> 0;
  // 简易 LCG，保证同 seed 外形可复现
  let s = seed || 1;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const g = new THREE.Group();
  g.name = "lawn-hill";

  // 半球丘体：phi 0→π/2，底面在 y=0 圆盘
  const geo = new THREE.SphereGeometry(1, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // 极点附近少扰动，山脚略起伏
    const h = Math.max(0, v.y);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!cache.has(key)) {
      const j = 0.92 + rnd() * 0.16 + h * 0.08;
      cache.set(key, j);
    }
    v.multiplyScalar(cache.get(key));
    // 压扁成缓丘
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const faceted = facet(geo);
  // 顶点色：低处草绿、高处土褐（同 hills.js）
  const grass = new THREE.Color(0x55875f);
  const soil = new THREE.Color(0x8a7a56);
  const c = new THREE.Color();
  const colors = new Float32Array(faceted.attributes.position.count * 3);
  const p2 = faceted.attributes.position;
  let maxY = 0.001;
  for (let i = 0; i < p2.count; i++) maxY = Math.max(maxY, p2.getY(i));
  for (let i = 0; i < p2.count; i++) {
    const t = THREE.MathUtils.clamp(p2.getY(i) / maxY, 0, 1);
    c.copy(grass).lerp(soil, t * t * 0.85);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  faceted.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mound = new THREE.Mesh(
    faceted,
    new THREE.MeshToonMaterial({
      color: 0xffffff,
      gradientMap: getToonGradient(),
      vertexColors: true,
    })
  );
  mound.scale.set(2.8 * scale, 1.35 * scale, 2.6 * scale);
  mound.castShadow = true;
  mound.receiveShadow = true;
  outlineAs(mound, "rock");
  g.add(mound);

  // 坡脚一圈青苔扁斑，软化与地面交界
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd() * 0.2;
    const rr = (2.1 + rnd() * 0.35) * scale;
    const patch = new THREE.Mesh(
      facet(new THREE.SphereGeometry(0.35 + rnd() * 0.15, 6, 4)),
      toonMat(0x4e8849)
    );
    patch.scale.set(1.4, 0.22, 1.2);
    patch.position.set(Math.cos(a) * rr, 0.06 * scale, Math.sin(a) * rr);
    patch.receiveShadow = true;
    g.add(patch);
  }

  g.userData.kind = "lawnHill";
  g.userData.assetType = "lawnHill";
  g.userData.factoryScale = scale;
  g.userData.factorySeed = seed;
  g.userData.collideRadius = 2.0 * scale;
  return g;
}

/** 低空软云：宣纸米色软球簇（不描边、不 Cel 硬阴影） */
export function createLowPolyCloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf5efe4,
    transparent: true,
    opacity: 0.88,
  });
  const puffs = [
    { r: 0.6, x: 0, y: 0.55, z: 0 },
    { r: 0.48, x: 0.55, y: 0.48, z: 0.08 },
    { r: 0.44, x: -0.52, y: 0.46, z: -0.05 },
    { r: 0.36, x: 0.12, y: 0.38, z: 0.4 },
    { r: 0.32, x: -0.1, y: 0.72, z: -0.08 },
  ];
  for (const p of puffs) {
    const m = new THREE.Mesh(facet(new THREE.SphereGeometry(p.r, 7, 5)), mat);
    m.position.set(p.x, p.y, p.z);
    g.add(m);
  }
  g.userData.isCloud = true;
  g.userData.collideRadius = 0; // 不挡路
  return g;
}

/** 水墨花色默认盘（低饱和） */
export const INK_FLOWER_COLORS = Object.freeze([
  0xc4a090, // 淡赭
  0xb8a878, // 枯黄
  0x9a8ab0, // 浅紫
  0x8a9aaa, // 淡墨青
]);

/** 花草：细茎 + 小花瓣盘（默认水墨低饱和） */
export function createLowPolyFlower(hue = 0xc4a090) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4)),
    toonMat(0x2c4030)
  );
  stem.position.y = 0.28;
  g.add(stem);

  const bloom = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.16, 6, 4)),
    toonMat(hue)
  );
  bloom.position.y = 0.58;
  bloom.castShadow = true;
  g.add(bloom);

  const leaf = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.12, 0.25, 4)),
    toonMat(0x344838)
  );
  leaf.rotation.z = 0.9;
  leaf.position.set(0.1, 0.25, 0);
  g.add(leaf);

  g.scale.setScalar(1.2);
  g.userData.collideRadius = 0.15; // 几乎可穿过
  return g;
}

/**
 * 木制路牌（街拍感）：立柱 + 斜向指路牌
 * 底部原点、Cel + 描边、collideRadius
 */
export function createLowPolySignpost() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6)),
    toonMat(0x3a322c) // 焦墨立柱
  );
  post.position.y = 0.8;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const board = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.7, 0.28, 0.06)),
    toonMat(0xf2ebe0) // 宣纸牌面
  );
  board.position.set(0.28, 1.25, 0);
  board.rotation.z = -0.08;
  outlineAs(board, "street");
  g.add(board);

  // 小箭头 · 朱砂点缀（低饱和）
  const arrow = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.08, 0.16, 4)),
    toonMat(0xa63a2e)
  );
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(0.58, 1.25, 0.02);
  g.add(arrow);

  g.userData.collideRadius = 0.28;
  return g;
}

/**
 * 街灯柱：细柱 + 弯臂 + 灯罩（日间关闭，造型点缀）
 */
export function createLowPolyStreetLamp() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6)),
    toonMat(0x3a3834) // 墨石柱
  );
  post.position.y = 1.1;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const arm = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.55, 0.06, 0.06)),
    toonMat(0x2a2824)
  );
  arm.position.set(0.25, 2.05, 0);
  outlineAs(arm, "street");
  g.add(arm);

  const lamp = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.14, 8, 6)),
    toonMat(0xf0e6d0, { emissive: 0xd8c8a0, emissiveIntensity: 0.12 }) // 弱暖纸灯
  );
  lamp.position.set(0.48, 1.95, 0);
  g.add(lamp);

  g.userData.collideRadius = 0.22;
  return g;
}

/**
 * 电线杆：高柱 + 横担 + 绝缘子（街拍感，非夜景霓虹）
 */
export function createLowPolyUtilityPole() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 6)),
    toonMat(0x3a322c) // 焦墨杆
  );
  post.position.y = 1.6;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const cross = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.1, 0.07, 0.07)),
    toonMat(0x2a2824)
  );
  cross.position.y = 2.85;
  outlineAs(cross, "street");
  g.add(cross);

  for (const x of [-0.4, 0, 0.4]) {
    const ins = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 5)),
      toonMat(0xc8c0b0) // 淡墨绝缘子
    );
    ins.position.set(x, 2.72, 0);
    g.add(ins);
  }

  g.userData.collideRadius = 0.3;
  return g;
}

/** 栅栏段：两柱 + 横梁 */
export function createLowPolyFence() {
  const g = new THREE.Group();
  const mat = toonMat(0x9a7048);
  for (const x of [-0.45, 0.45]) {
    const post = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.1, 0.7, 0.1)),
      mat
    );
    post.position.set(x, 0.35, 0);
    post.castShadow = true;
    g.add(post);
  }
  for (const y of [0.25, 0.5]) {
    const rail = new THREE.Mesh(
      facet(new THREE.BoxGeometry(1.0, 0.08, 0.06)),
      mat
    );
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  g.userData.collideRadius = 0.55;
  return g;
}

/** 小桥：桥面 + 两侧栏 */
export function createLowPolyBridge() {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    facet(new THREE.BoxGeometry(2.4, 0.12, 0.9)),
    toonMat(0xb8956a)
  );
  deck.position.y = 0.35;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // 拱脚
  for (const z of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.2, 0.35, 0.9)),
      toonMat(0x8a7a6a)
    );
    leg.position.set(z, 0.18, 0);
    g.add(leg);
  }

  const railMat = toonMat(0x6a5a4a);
  for (const side of [-0.4, 0.4]) {
    const rail = new THREE.Mesh(
      facet(new THREE.BoxGeometry(2.2, 0.08, 0.06)),
      railMat
    );
    rail.position.set(0, 0.55, side);
    g.add(rail);
  }

  g.userData.collideRadius = 1.2;
  return g;
}

/**
 * 贴球面：position = dir × R，局部 +Y 对齐法线。
 */
export function placeOnSphere(obj, latDeg, lonDeg, radius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const dir = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
  obj.position.copy(dir).multiplyScalar(radius);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return obj;
}

/**
 * 在球面随机撒资产。
 * - 纬度按面积元加权：pdf ∝ cos(lat)（高纬不再偏密）
 * - minSpacing：与已放置点的最小弦长（失败重试 maxAttempts）
 *
 * @returns {{
 *   meshes: THREE.Object3D[],
 *   colliders: { position: THREE.Vector3, radius: number }[],
 *   clouds: THREE.Object3D[],
 * }}
 */
export function scatterOnSphere(scene, planetRadius, opts = {}) {
  const {
    seed = 42,
    trees = 28,
    rocks = 18,
    flowers = 40,
    fences = 8,
    houses = 4,
    bridges = 2,
    clouds = 10,
    treeMaker = createLowPolyTree,
    cloudHeight = 5, // 云朵距球面的低空高度
    latMax = 72,
    latMin = -40,
    minSpacing = 2.2,
    maxAttempts = 40,
  } = opts;

  // 简易 LCG
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  // 面积加权采样纬度：u ~ U(0,1) → sin(lat) 在 [sin latMin, sin latMax] 均匀
  const sinMin = Math.sin(THREE.MathUtils.degToRad(latMin));
  const sinMax = Math.sin(THREE.MathUtils.degToRad(latMax));
  function sampleLatLon() {
    const sinLat = sinMin + rnd() * (sinMax - sinMin);
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sinLat, -1, 1)));
    const lon = rnd() * 360 - 180;
    return { lat, lon };
  }

  const makers = [];
  for (let i = 0; i < trees; i++) makers.push(treeMaker);
  for (let i = 0; i < rocks; i++) makers.push(createLowPolyRock);
  for (let i = 0; i < flowers; i++) {
    makers.push(() =>
      createLowPolyFlower([0xff88aa, 0xffe08a, 0xc9a8ff, 0x9ec5ff][(rnd() * 4) | 0])
    );
  }
  for (let i = 0; i < fences; i++) makers.push(createLowPolyFence);
  for (let i = 0; i < houses; i++) makers.push(createLowPolyHouse);
  for (let i = 0; i < bridges; i++) makers.push(createLowPolyBridge);

  const meshes = [];
  const colliders = [];
  /** @type {THREE.Vector3[]} */
  const placed = [];
  const minSp2 = minSpacing * minSpacing;

  function farEnough(pos) {
    for (const q of placed) {
      if (pos.distanceToSquared(q) < minSp2) return false;
    }
    return true;
  }

  for (const make of makers) {
    let placedOk = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { lat, lon } = sampleLatLon();
      if (lat > 82) continue; // 远离北极出生点
      const obj = placeOnSphere(make(), lat, lon, planetRadius);
      if (!farEnough(obj.position)) {
        // 丢弃未入场景的对象几何
        obj.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
            else c.material.dispose();
          }
        });
        continue;
      }
      obj.rotateY(rnd() * Math.PI * 2);
      scene.add(obj);
      meshes.push(obj);
      placed.push(obj.position.clone());
      const cr = obj.userData.collideRadius ?? 0.4;
      if (cr >= 0.25) {
        colliders.push({ position: obj.position.clone(), radius: cr });
      }
      placedOk = true;
      break;
    }
    void placedOk; // 放不下就跳过该实例
  }

  // 云朵：低空空飘（不进碰撞、不做间距检查）；附带漂移参数
  /** @type {THREE.Object3D[]} */
  const cloudList = [];
  for (let i = 0; i < clouds; i++) {
    const { lat, lon } = sampleLatLon();
    const obj = placeOnSphere(createLowPolyCloud(), lat, lon, planetRadius + cloudHeight);
    obj.rotateY(rnd() * Math.PI * 2);
    obj.scale.setScalar(0.8 + rnd() * 0.8);
    // 绕球心缓慢公转 + 轻微径向起伏
    obj.userData.drift = {
      axis: new THREE.Vector3(rnd() - 0.5, rnd() * 0.4 + 0.6, rnd() - 0.5).normalize(),
      speed: 0.04 + rnd() * 0.08, // rad/s
      bobAmp: 0.25 + rnd() * 0.35,
      bobSpeed: 0.4 + rnd() * 0.6,
      phase: rnd() * Math.PI * 2,
      baseR: planetRadius + cloudHeight,
    };
    scene.add(obj);
    meshes.push(obj);
    cloudList.push(obj);
  }

  return { meshes, colliders, clouds: cloudList };
}

const _cloudSpin = new THREE.Quaternion();
const _cloudAxis = new THREE.Vector3();

/** 云朵漂移动画：绕球心缓慢公转 + 径向起伏 */
export function updateClouds(clouds, dt, t) {
  if (!clouds || !clouds.length) return;
  for (const c of clouds) {
    const d = c.userData.drift;
    if (!d) continue;
    _cloudAxis.copy(d.axis);
    _cloudSpin.setFromAxisAngle(_cloudAxis, d.speed * dt);
    c.position.applyQuaternion(_cloudSpin);
    // 径向起伏（保持大致云高）
    const r = d.baseR + Math.sin(t * d.bobSpeed + d.phase) * d.bobAmp;
    c.position.setLength(r);
    // 自转一点点
    c.rotateY(dt * 0.15);
  }
}
