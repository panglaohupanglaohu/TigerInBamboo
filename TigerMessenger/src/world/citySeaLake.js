// =====================================================================
//  水晶城海水湖（City Seawater Lake）
//  - 建在莫比斯水晶城旁侧的大型海水湾，供气泡艇潜行
//  - 培育自湖沼的异星水生生物：白鲸、鳗、发光带鱼、管虫、贝壳
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { PLANET_RADIUS } from "./planet.js";
import { CANYON } from "./canyon.js";
import { GRAND_CRYSTAL } from "./moebiusCity.js";

/** 海水湖选址：水晶城旁侧大湾（经度偏开城心，纬度略靠赤道） */
export const CITY_SEA_LAKE = Object.freeze({
  lat: GRAND_CRYSTAL.lat + 7.5, // 约 -16.5°，城缘偏北
  lon: CANYON.lon + 24, // 城心东侧，避开塔林最密处
  angR: 0.34, // 角半径 ~19.5°，体量明显大于月牙湖
  waterLift: 0.14, // 水面相对球面抬升
  maxDive: 10, // 最大潜深（径向向球心，世界单位）
  shoreW: 0.045, // 岸带宽（角）
});

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function facet(geo) {
  // 简单硬边：不合并顶点
  return geo;
}

function part(geo, mat, outline = 0.02) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addOutline(m, outline);
  return m;
}

/* ---------- 湖沼移植生物（海水培育版） ---------- */

function buildSeaBeluga(rnd) {
  const whale = new THREE.Group();
  whale.name = "sea-beluga";
  const skin = new THREE.MeshBasicMaterial({ color: 0xe8f0e6, fog: false });
  const body = new THREE.Mesh(facet(new THREE.SphereGeometry(1, 12, 9)), skin);
  body.scale.set(1.6, 1.05, 3.0);
  body.castShadow = true;
  addOutline(body, 0.04);
  whale.add(body);
  const nose = new THREE.Mesh(facet(new THREE.SphereGeometry(0.55, 10, 8)), skin);
  nose.position.set(0, 0.1, 2.85);
  addOutline(nose, 0.03);
  whale.add(nose);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      facet(new THREE.SphereGeometry(0.14, 6, 5)),
      toonMat(0x1a1a1a)
    );
    eye.position.set(side * 0.85, 0.38, 2.55);
    whale.add(eye);
    const fin = new THREE.Mesh(facet(new THREE.ConeGeometry(0.5, 1.6, 3)), skin);
    fin.scale.set(1, 1, 0.24);
    fin.rotation.order = "ZXY";
    fin.rotation.z = side * (Math.PI / 2 - 0.45);
    fin.rotation.x = 0.25;
    fin.position.set(side * 1.5, -0.35, 0.5);
    addOutline(fin, 0.03);
    whale.add(fin);
  }
  const tail = new THREE.Mesh(facet(new THREE.ConeGeometry(0.48, 1.5, 6)), skin);
  tail.rotation.x = -Math.PI / 2 - 0.2;
  tail.position.set(0, 0.25, -3.4);
  addOutline(tail, 0.03);
  whale.add(tail);
  whale.userData.phase = rnd() * Math.PI * 2;
  whale.userData.kind = "sea-beluga";
  return whale;
}

function buildSeaEel(rnd) {
  const g = new THREE.Group();
  g.name = "sea-eel";
  const pts = [];
  const phase = rnd() * Math.PI * 2;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(
      new THREE.Vector3(
        t * 9 - 4.5,
        Math.sin(t * Math.PI * 2 + phase) * 0.9,
        Math.cos(t * Math.PI * 1.4 + phase) * 1.2
      )
    );
  }
  g.add(
    part(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.26, 6, false),
      toonMat(0xb8d94a, { flatShading: true }),
      0.018
    )
  );
  const head = part(
    new THREE.SphereGeometry(0.38, 7, 6),
    toonMat(0xb8d94a, { flatShading: true }),
    0.018
  );
  head.position.copy(pts[8]).add(new THREE.Vector3(0.3, 0, 0));
  head.scale.set(1.4, 0.9, 0.9);
  g.add(head);
  g.userData.phase = phase;
  g.userData.kind = "sea-eel";
  return g;
}

function buildSeaRibbonFish(rnd) {
  const g = new THREE.Group();
  g.name = "sea-ribbonfish";
  const geo = new THREE.PlaneGeometry(3.2, 0.5, 14, 1);
  const pos = geo.attributes.position;
  const baseX = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    baseX[i] = x;
    const taper = 0.3 + 0.7 * (0.5 + x / 3.2);
    pos.setY(i, pos.getY(i) * taper);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(
    geo,
    toonMat(0x7dffc8, { flatShading: true, side: THREE.DoubleSide })
  );
  g.add(body);
  g.add(
    part(
      new THREE.SphereGeometry(0.14, 5, 4),
      toonMat(0x7dffc8, { flatShading: true }),
      0.006
    )
  ).position.set(1.6, 0.04, 0);
  g.userData.bodyMesh = body;
  g.userData.baseX = baseX;
  g.userData.phase = rnd() * Math.PI * 2;
  g.userData.kind = "sea-ribbon";
  return g;
}

function buildSeaTubeWorms(rnd) {
  const g = new THREE.Group();
  g.name = "sea-tube-worms";
  const mat = toonMat(0xe07040, { flatShading: true });
  const n = 5 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const h = 0.9 + rnd() * 1.4;
    const worm = part(
      new THREE.CylinderGeometry(0.1 + rnd() * 0.06, 0.16 + rnd() * 0.06, h, 6),
      mat,
      0.012
    );
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.8;
    worm.position.set(Math.cos(a) * d, h * 0.5, Math.sin(a) * d);
    worm.rotation.z = (rnd() - 0.5) * 0.25;
    g.add(worm);
  }
  g.userData.kind = "sea-worms";
  return g;
}

function buildSeaShell(rnd) {
  const g = new THREE.Group();
  g.name = "sea-shell";
  const shell = part(
    new THREE.SphereGeometry(0.45 + rnd() * 0.2, 8, 5),
    toonMat(0xe8dcc4, { flatShading: true }),
    0.014
  );
  shell.scale.set(1, 0.32, 0.85);
  g.add(shell);
  g.userData.kind = "sea-shell";
  return g;
}

/**
 * 创建水晶城海水湖 + 培育生物。
 * @returns {{
 *   group: THREE.Group,
 *   centerDir: THREE.Vector3,
 *   centerWorld: THREE.Vector3,
 *   angR: number,
 *   surfaceR: number,
 *   maxDive: number,
 *   rFlat: number,
 *   containsWorldPos: (p: THREE.Vector3) => boolean,
 *   surfaceHeightAt: (p: THREE.Vector3) => number,
 *   diveDepthAt: (p: THREE.Vector3) => number,
 *   update: (dt: number, t: number) => void
 * }}
 */
export function createCitySeaLake(scene, planetRadius = PLANET_RADIUS, opts = {}) {
  const seed = opts.seed ?? 5521;
  const rnd = lcg(seed);
  const cfg = { ...CITY_SEA_LAKE, ...opts };

  latLonToDir(cfg.lat, cfg.lon, _dir);
  const centerDir = _dir.clone().normalize();
  const surfaceR = planetRadius + cfg.waterLift;
  const rFlat = planetRadius * Math.sin(cfg.angR);

  const group = new THREE.Group();
  group.name = "city-sea-lake";
  group.position.copy(centerDir).multiplyScalar(surfaceR);
  group.quaternion.copy(quatYToDir(centerDir, new THREE.Quaternion()));

  // ---- 海水面（深蓝青 · clearcoat 高光，无物理透射） ----
  // 性能硬约束：transmission > 0 会让 three.js 走 renderTransmissionPass，
  // 每帧把全部不透明物体二次渲染到 4x MSAA + 完整 mipmap 的 render target，
  // 再在片元里做屏幕空间采样。本湖水面是 rFlat≈13 的大圆盘（占屏面积极大），
  // 无头 SwiftShader（纯 CPU 光栅化）会直接 Context Lost / GPU 超时死锁。
  // 观感用 opacity 半透明 + clearcoat 高光复现，成本只剩一次正向渲染。
  // 同理去掉 ior / thickness（仅在 transmission > 0 时生效，留着是误导）。
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(rFlat, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x1a6a88,
      transparent: true,
      opacity: 0.72,
      roughness: 0.12,
      metalness: 0.05,
      transmission: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  water.renderOrder = 2;
  group.add(water);

  // 深水暗盘（视觉纵深）
  const deep = new THREE.Mesh(
    new THREE.CircleGeometry(rFlat * 0.72, 48),
    new THREE.MeshBasicMaterial({
      color: 0x0a3048,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = -0.08;
  group.add(deep);

  // 水下体积柱（潜行时可见的青蓝柱体）
  const volume = new THREE.Mesh(
    new THREE.CylinderGeometry(rFlat * 0.92, rFlat * 0.88, cfg.maxDive * 0.95, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x0d4a62,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  volume.position.y = -cfg.maxDive * 0.45;
  volume.renderOrder = 1;
  group.add(volume);

  // 岸砂环
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(rFlat * 0.97, rFlat * 1.08, 64),
    toonMat(0xd2c09a, { side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.04;
  rim.receiveShadow = true;
  group.add(rim);

  // 岸边礁石点缀
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.2;
    const d = rFlat * (0.94 + rnd() * 0.1);
    const rock = part(
      new THREE.DodecahedronGeometry(0.55 + rnd() * 0.7, 0),
      toonMat(0x6a7580, { flatShading: true }),
      0.02
    );
    rock.position.set(Math.cos(a) * d, 0.15 + rnd() * 0.3, Math.sin(a) * d);
    rock.rotation.set(rnd(), rnd(), rnd());
    rock.scale.set(1, 0.55 + rnd() * 0.4, 1);
    group.add(rock);
  }

  // 涟漪
  const ripples = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xb8e8f0,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(
      (rnd() - 0.5) * rFlat * 0.6,
      0.04,
      (rnd() - 0.5) * rFlat * 0.6
    );
    ring.userData = { phase: rnd() * 6, speed: 0.4 + rnd() * 0.25, maxR: 4 + rnd() * 5 };
    group.add(ring);
    ripples.push(ring);
  }

  /* ---------- 培育：湖沼动物迁入海水 ---------- */
  const whales = [];
  for (let i = 0; i < 3; i++) {
    const w = buildSeaBeluga(rnd);
    const sc = i === 0 ? 1.1 : 0.55 + rnd() * 0.25;
    w.scale.setScalar(sc);
    w.userData.orbitR = rFlat * (0.25 + rnd() * 0.45);
    w.userData.orbitY = -1.2 - rnd() * 3.5; // 水面下
    w.userData.speed = 0.12 + rnd() * 0.08;
    w.userData.phase = rnd() * Math.PI * 2;
    group.add(w);
    whales.push(w);
  }

  const eels = [];
  for (let i = 0; i < 5; i++) {
    const e = buildSeaEel(rnd);
    e.scale.setScalar(0.55 + rnd() * 0.35);
    e.userData.orbitR = rFlat * (0.2 + rnd() * 0.5);
    e.userData.orbitY = -2.5 - rnd() * 4;
    e.userData.speed = 0.2 + rnd() * 0.15;
    e.userData.phase = rnd() * Math.PI * 2;
    group.add(e);
    eels.push(e);
  }

  const fish = [];
  for (let i = 0; i < 8; i++) {
    const f = buildSeaRibbonFish(rnd);
    f.scale.setScalar(0.7 + rnd() * 0.5);
    f.userData.orbitR = rFlat * (0.15 + rnd() * 0.55);
    f.userData.orbitY = -0.8 - rnd() * 5;
    f.userData.speed = 0.28 + rnd() * 0.2;
    f.userData.phase = rnd() * Math.PI * 2;
    group.add(f);
    fish.push(f);
  }

  // 湖底管虫 / 贝壳
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * rFlat * 0.75;
    const worms = buildSeaTubeWorms(rnd);
    worms.position.set(Math.cos(a) * d, -cfg.maxDive * 0.85, Math.sin(a) * d);
    worms.scale.setScalar(0.8 + rnd() * 0.5);
    group.add(worms);
  }
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * rFlat * 0.9;
    const sh = buildSeaShell(rnd);
    sh.position.set(Math.cos(a) * d, -cfg.maxDive * 0.88 + rnd() * 0.3, Math.sin(a) * d);
    sh.rotation.y = rnd() * Math.PI * 2;
    group.add(sh);
  }

  group.userData.kind = "city-sea-lake";
  group.userData.whales = whales;
  group.userData.eels = eels;
  group.userData.fish = fish;
  group.userData.ripples = ripples;

  scene.add(group);

  const centerWorld = centerDir.clone().multiplyScalar(planetRadius);

  function containsWorldPos(p) {
    if (!p) return false;
    _up.copy(p).normalize();
    return _up.angleTo(centerDir) < cfg.angR;
  }

  /** 该方向上的水面半径（球心距） */
  function surfaceHeightAt(p) {
    return surfaceR;
  }

  /**
   * 当前位置相对水面的潜深（>0 在水下，单位世界）
   * 仅在湖内有效
   */
  function diveDepthAt(p) {
    if (!containsWorldPos(p)) return -1;
    const r = p.length();
    return surfaceR - r; // 正 = 已潜入
  }

  function update(dt, t) {
    // 涟漪
    for (const ring of ripples) {
      const ud = ring.userData;
      const u = ((t * ud.speed + ud.phase) % 3.2) / 3.2;
      const sc = 0.4 + u * ud.maxR;
      ring.scale.set(sc, sc, sc);
      const fade = u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88;
      ring.material.opacity = Math.max(0, fade) * 0.32;
    }
    // 水面呼吸
    if (water.material) {
      water.material.opacity = 0.62 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.55));
    }

    // 白鲸环游 + 换气昂首
    for (let i = 0; i < whales.length; i++) {
      const w = whales[i];
      const ph = w.userData.phase + t * w.userData.speed;
      const rr = w.userData.orbitR;
      w.position.set(Math.cos(ph) * rr, w.userData.orbitY + Math.sin(t * 0.5 + ph) * 0.35, Math.sin(ph) * rr);
      w.rotation.order = "YXZ";
      w.rotation.y = -ph + Math.PI / 2;
      // 周期破水换气
      const breathe = Math.sin(t * 0.28 + ph);
      w.rotation.x = -0.2 + breathe * 0.45;
      if (breathe > 0.7) w.position.y = Math.min(0.4, w.position.y + 0.4);
    }

    // 鳗蛇形绕游
    for (const e of eels) {
      const ph = e.userData.phase + t * e.userData.speed;
      const rr = e.userData.orbitR;
      e.position.set(
        Math.cos(ph) * rr,
        e.userData.orbitY + Math.sin(t * 1.2 + ph) * 0.5,
        Math.sin(ph) * rr
      );
      e.rotation.y = -ph + Math.PI / 2;
      e.rotation.z = Math.sin(t * 2 + ph) * 0.2;
    }

    // 带鱼摆尾环游
    for (const f of fish) {
      const ph = f.userData.phase + t * f.userData.speed;
      const rr = f.userData.orbitR;
      f.position.set(
        Math.cos(ph) * rr,
        f.userData.orbitY + Math.sin(t * 1.6 + ph) * 0.4,
        Math.sin(ph) * rr
      );
      f.rotation.y = -ph + Math.PI / 2;
      f.rotation.z = Math.sin(t * 3 + ph) * 0.15;
      // 顶点波动
      const mesh = f.userData.bodyMesh;
      const baseX = f.userData.baseX;
      if (mesh && baseX) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = baseX[i];
          pos.setZ(i, Math.sin(x * 2.2 + t * 6 + ph) * 0.12 * (0.5 + x / 3.2));
        }
        pos.needsUpdate = true;
      }
    }
  }

  return {
    group,
    centerDir,
    centerWorld,
    angR: cfg.angR,
    surfaceR,
    maxDive: cfg.maxDive,
    rFlat,
    waterLift: cfg.waterLift,
    planetRadius,
    containsWorldPos,
    surfaceHeightAt,
    diveDepthAt,
    update,
  };
}
