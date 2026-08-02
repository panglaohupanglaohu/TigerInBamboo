// =====================================================================
//  程序化 Low-Poly 资产：树 / 房 / 石 / 花 / 栅栏 / 桥（纯基础几何体）
//  约定：Cel 卡通材质（2 阶梯 gradientMap）+ facet() 平直法线；
//        主体件附黑边描边；Group 底部中心在局部 (0,0,0)
// =====================================================================
import * as THREE from "three";
import { toonMat, outlineAs } from "./toon.js";

/** 平直化：非索引 + 逐面法线 */
function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

/** 低多边树：圆柱树干 + 三层圆锥树冠（总高约 2.7） */
export function createLowPolyTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 5)),
    toonMat(0x8a5a3a)
  );
  trunk.position.y = 0.4;
  trunk.castShadow = true;
  outlineAs(trunk, "treeTrunk");
  g.add(trunk);

  const layers = [
    { r: 0.7, h: 1.0, y: 1.1, c: 0x3f8f5a },
    { r: 0.55, h: 0.9, y: 1.7, c: 0x4aa566 },
    { r: 0.38, h: 0.75, y: 2.25, c: 0x5cba72 },
  ];
  for (const { r, h, y, c } of layers) {
    const cone = new THREE.Mesh(facet(new THREE.ConeGeometry(r, h, 6)), toonMat(c));
    cone.position.y = y;
    cone.castShadow = true;
    outlineAs(cone, "treeCrown");
    g.add(cone);
  }
  g.scale.setScalar(1.6); // 小世界量纲：~4.3m ≈ 玩家 2.5 倍
  g.userData.collideRadius = 0.38; // 局部值，世界半径随总缩放
  return g;
}

/** 低多边房子 */
export function createLowPolyHouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.6, 1.0, 1.4)),
    toonMat(0xe8d8b0)
  );
  body.position.y = 0.5;
  body.castShadow = true;
  outlineAs(body, "house");
  g.add(body);

  const roof = new THREE.Mesh(
    facet(new THREE.ConeGeometry(1.25, 0.7, 4)),
    toonMat(0xc45a4a)
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.0 + 0.35;
  roof.castShadow = true;
  outlineAs(roof, "house");
  g.add(roof);

  const door = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.4, 0.62, 0.06)),
    toonMat(0x6a4a3a)
  );
  door.position.set(0, 0.31, 0.71);
  g.add(door);

  const win = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.3, 0.3, 0.05)),
    toonMat(0x9ec5ff)
  );
  win.position.set(0.48, 0.6, 0.71);
  g.add(win);

  const chimney = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.18, 0.45, 0.18)),
    toonMat(0x8a8a96)
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
  const rock = new THREE.Mesh(facet(geo), toonMat(0x7a8494));
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

/** 低空日系软云：乳白软球簇（不描边、不 Cel 硬阴影，避免夜景感） */
export function createLowPolyCloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfffaf5,
    transparent: true,
    opacity: 0.92,
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

/** 花草：细茎 + 小花瓣盘 */
export function createLowPolyFlower(hue = 0xff88aa) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4)),
    toonMat(0x3d8f4a)
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
    toonMat(0x4aa55a)
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
    toonMat(0xb8956a)
  );
  post.position.y = 0.8;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const board = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.7, 0.28, 0.06)),
    toonMat(0xfff6e8)
  );
  board.position.set(0.28, 1.25, 0);
  board.rotation.z = -0.08;
  outlineAs(board, "street");
  g.add(board);

  // 小箭头
  const arrow = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.08, 0.16, 4)),
    toonMat(0xe76f51)
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
    toonMat(0x6a7580)
  );
  post.position.y = 1.1;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const arm = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.55, 0.06, 0.06)),
    toonMat(0x5a6570)
  );
  arm.position.set(0.25, 2.05, 0);
  outlineAs(arm, "street");
  g.add(arm);

  const lamp = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.14, 8, 6)),
    toonMat(0xfff4d0, { emissive: 0xffe08a, emissiveIntensity: 0.25 })
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
    toonMat(0x8a8070)
  );
  post.position.y = 1.6;
  post.castShadow = true;
  outlineAs(post, "street");
  g.add(post);

  const cross = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.1, 0.07, 0.07)),
    toonMat(0x7a7060)
  );
  cross.position.y = 2.85;
  outlineAs(cross, "street");
  g.add(cross);

  for (const x of [-0.4, 0, 0.4]) {
    const ins = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 5)),
      toonMat(0xd8e8f0)
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
  for (let i = 0; i < trees; i++) makers.push(createLowPolyTree);
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
