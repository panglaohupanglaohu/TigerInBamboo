// =====================================================================
//  水晶城海水湖（City Seawater Lake）
//  - 建在莫比斯水晶城旁侧的大型海水湾，供气泡艇潜行
//  - 培育自湖沼的异星水生生物：白鲸、鳗、发光带鱼、管虫、贝壳
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { PLANET_RADIUS } from "./planet.js";
import { CANYON, canyonOffsetDir } from "./canyon.js";
import { groundLiftAt, worldToFlatXZ } from "./hills.js";


/**
 * 海水湖选址：沉入莫比斯大峡谷底、位于花厅塔正下方。
 * 原址 (lat -16.5, lon -88) 水面平贴海平面，且距轨道仅 8.3、距最近拱门 3。
 * 现改为随花厅塔运行时定位（见 createCitySeaLake 的 centerDir/baseRadius）：
 * 水面沉到塔基高度，母塔自湖心拔起，电车在十余单位上方的高架桥凌空掠过。
 * 下方 lat/lon 仅作无塔可用时的兜底（= 母塔方位）。
 *
 * 注：峡谷水城模式下（messengerIsland 传入 angR 0.75 + fixedLevel），
 * 湖心改为峡谷中心、水面沉到 R-WATER_CITY_WATER_DROP——此处常量仅为小湖兜底。
 */
export const CITY_SEA_LAKE = Object.freeze({
  lat: -24, // 母塔纬度
  lon: -112, // 母塔经度（= CANYON.lon）
  // 角半径 0.34→0.22（r 13.3→8.7）：花厅塔两两间距实测仅 21.3，
  // 两湖半径之和必须小于该值才不重叠，同时避免湖面漫过阶梯谷壁。
  angR: 0.22,
  waterLift: 0.14, // 水面相对球面抬升
  maxDive: 10, // 最大潜深（径向向球心，世界单位）
  shoreW: 0.045, // 岸带宽（角）
});

/**
 * 峡谷水城（Water City）参数——湖面覆盖整个水晶城城区。
 *  - 城区足迹半径 = min(0.77, 0.85·(1-5/7)·3) = 0.7286 rad；
 *  - 水面下沉 24 单位后，与阶梯台地相交于第 2/3 阶地边界（湖岸角距 0.486）：
 *    第 1/2 环（0.486 之外）成干燥岛环，第 3 环起全部入水；
 *  - 被淹建筑由 moebiusCity 按水位抬根 + 水线石台（防波堤语汇）。
 */
export const WATER_CITY_WATER_DROP = 24;
export const WATER_CITY_ANG_R = 0.75;

/**
 * 水位对应的湖岸角距：水面与阶梯台地相交的阶地边界（谷心角距，rad）。
 * 例：drop=24 → ceil(24/8.571)=3 → 岸在 rim·(1-3/7)=0.4857（第 2/3 阶地边界）。
 */
export function waterCityShoreAng(drop = WATER_CITY_WATER_DROP) {
  const stepDepth = CANYON.depth / CANYON.steps;
  const stepsBelow = Math.ceil(drop / stepDepth);
  return CANYON.rim * (1 - stepsBelow / CANYON.steps);
}

/**
 * 峡谷水城的水晶城运河航点：谷心切平面系 az=-40°、角距 0.2 的开阔水面。
 * 原锚点在花厅塔上（高架穿塔 + 落差梯道撞塔岛）；此航点避开三座花厅塔
 * （最近塔距 ≥0.2 rad）与母塔岛丘，梯道/升船机落在开阔水面上方。
 */
/**
 * 湖沼迁入水晶城峡谷的锚点方向：水城湖岸外侧、峡谷东侧阶地。
 * 角距略大于水城岸线，保证在谷内、又不压母塔岛。
 */
export function crystalCanyonSwampDir(out = new THREE.Vector3()) {
  const c = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const e = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), c).normalize();
  const n = new THREE.Vector3().crossVectors(c, e).normalize();
  const az = THREE.MathUtils.degToRad(72);
  const d = waterCityShoreAng(WATER_CITY_WATER_DROP) + 0.06;
  return out
    .copy(c)
    .multiplyScalar(Math.cos(d))
    .addScaledVector(e, Math.cos(az) * Math.sin(d))
    .addScaledVector(n, Math.sin(az) * Math.sin(d))
    .normalize();
}

export function waterCityCanalWaypointDir(out = new THREE.Vector3()) {
  const c = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const e = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), c).normalize();
  const n = new THREE.Vector3().crossVectors(c, e).normalize();
  const az = THREE.MathUtils.degToRad(-40);
  const d = 0.2;
  return out
    .copy(c)
    .multiplyScalar(Math.cos(d))
    .addScaledVector(e, Math.cos(az) * Math.sin(d))
    .addScaledVector(n, Math.sin(az) * Math.sin(d))
    .normalize();
}

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

  // 湖心：优先用调用方给的花厅塔方向，否则用 lat/lon 兜底
  if (opts.centerDir) _dir.copy(opts.centerDir).normalize();
  else latLonToDir(cfg.lat, cfg.lon, _dir);
  const centerDir = _dir.clone().normalize();
  // 水底基准：优先用花厅塔 root（水面与塔基齐平），否则按峡谷阶梯沉降落到谷底。
  // 若仍用 planetRadius，水面会平贴海平面、悬在谷底上方约 15 单位。
  const baseR = Number.isFinite(opts.baseRadius)
    ? opts.baseRadius
    : planetRadius + canyonOffsetDir(centerDir);
  // let 而非 const：relocate() 需要改写它，且 containsWorldPos / diveDepthAt
  // 等闭包要能读到新值（否则搬迁后潜水判定仍按旧水面高度算）
  let surfaceR = baseR + cfg.waterLift;
  // 湖盘贴合水面球（半径 surfaceR）：切平面半径按水面球计算，
  // 盘缘角距 == cfg.angR（旧版用 planetRadius 计算，水面下沉后盘缘会外扩）。
  const rFlat = surfaceR * Math.sin(cfg.angR);
  // 湖岸角距（水面与阶梯台地的交线）：岸砂环/礁石/湖底装饰都以它为准，
  // 避免把岸线画到干燥阶地之下或悬在深水之上。
  const shoreAng = waterCityShoreAng(planetRadius - surfaceR);
  const shoreChord = surfaceR * Math.sin(shoreAng);
  // 深潭半径：湖心开阔水域（角距 0.24 内无建筑，白鲸/鱼群在此巡游）
  const deepChord = surfaceR * Math.sin(0.24);
  const waterSeg = rFlat > 60 ? 128 : 64;

  const group = new THREE.Group();
  group.name = "city-sea-lake";
  group.position.copy(centerDir).multiplyScalar(surfaceR);
  group.quaternion.copy(quatYToDir(centerDir, new THREE.Quaternion()));

  /**
   * 球面贴合的圆盘几何：湖面（及深水盘/岸砂环）不再用平面 CircleGeometry——
   * 平面盘在球面曲率下边缘会高出/低于球面 r²/2R（rFlat≈35 → 约 3.8 单位），
   * 湖缘「翘边/悬空」。这里把每个顶点沿球面下陷：
   *   local z = -(sphereR - sqrt(sphereR² - r²))，中心贴水面、边缘随球面垂落。
   * @param {number} radius 圆盘半径（局部切平面）
   * @param {number} segments 圆周分段
   * @param {number} sphereR 贴合的球面半径（= surfaceR）
   * @param {number} [baseDrop] 额外基础下沉（deep/rim 分层用）
   */
  const makeSphericalDisc = (radius, segments, sphereR, baseDrop = 0) => {
    const geo = new THREE.CircleGeometry(radius, segments);
    const pos = geo.attributes.position;
    const rr2 = sphereR * sphereR;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r2 = x * x + y * y;
      const drop = r2 > 0 ? sphereR - Math.sqrt(Math.max(rr2 - r2, 0)) : 0;
      pos.setZ(i, -(drop + baseDrop));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  // ---- 海水面（深蓝青 · clearcoat 高光，无物理透射） ----
  // 性能硬约束：transmission > 0 会让 three.js 走 renderTransmissionPass，
  // 每帧把全部不透明物体二次渲染到 4x MSAA + 完整 mipmap 的 render target，
  // 再在片元里做屏幕空间采样。湖面是大圆盘（占屏面积极大），
  // 无头 SwiftShader（纯 CPU 光栅化）会直接 Context Lost / GPU 超时死锁。
  // 观感用 opacity 半透明 + clearcoat 高光复现，成本只剩一次正向渲染。
  // 同理去掉 ior / thickness（仅在 transmission > 0 时生效，留着是误导）。
  const water = new THREE.Mesh(
    makeSphericalDisc(rFlat, waterSeg, surfaceR),
    new THREE.MeshStandardMaterial({
      color: 0x1a6a88,
      transparent: true,
      opacity: 0.72,
      roughness: 0.14,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  water.renderOrder = 2;
  group.add(water);

  // 深水暗盘（视觉纵深）：大湖时收在湖岸之内，不漫上浅滩
  const deep = new THREE.Mesh(
    makeSphericalDisc(
      Math.min(rFlat * 0.72, shoreChord * 0.88),
      waterSeg,
      surfaceR,
      0.08
    ),
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

  // 水下体积柱（潜行时可见的青蓝柱体）：大湖时收在湖岸之内
  const volume = new THREE.Mesh(
    new THREE.CylinderGeometry(
      Math.min(rFlat * 0.92, shoreChord * 0.94) * 0.98,
      Math.min(rFlat * 0.88, shoreChord * 0.94) * 0.94,
      cfg.maxDive * 0.95,
      48,
      1,
      true
    ),
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

  // 岸砂环（球面贴合：与水面同一曲率，不翘边）
  // 大湖模式：湖岸 = 阶地崖壁水线，砂环贴在水线处（崖壁前的浅水带）；
  // 小湖模式：湖岸 = 盘缘，砂环如旧贴盘缘。
  {
    const rimInner = Math.min(rFlat * 0.97, shoreChord * 0.98);
    const rimOuter = rimInner + Math.min(rFlat * 0.11, shoreChord * 0.05);
    const rimGeo = new THREE.RingGeometry(rimInner, rimOuter, waterSeg);
    const pos = rimGeo.attributes.position;
    const rr2 = surfaceR * surfaceR;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r2 = x * x + y * y;
      const drop = r2 > 0 ? surfaceR - Math.sqrt(Math.max(rr2 - r2, 0)) : 0;
      pos.setZ(i, -(drop + 0.04));
    }
    pos.needsUpdate = true;
    rimGeo.computeVertexNormals();
    const rim = new THREE.Mesh(rimGeo, toonMat(0xd2c09a, { side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2;
    rim.receiveShadow = true;
    group.add(rim);
  }

  // 岸边礁石点缀：大湖时收在湖岸水线，避免埋进干燥阶地
  const rockBandInner = Math.min(rFlat * 0.94, shoreChord * 0.97);
  const rockBandOuter = Math.min(rFlat * 1.04, shoreChord * 1.03);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.2;
    const d = rockBandInner + (rockBandOuter - rockBandInner) * rnd();
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
  // 大湖模式：巡游半径收进深潭（角距 0.24 内无建筑、水深充足），
  // 避免生物游进浅滩穿进阶地崖壁。
  const whales = [];
  for (let i = 0; i < 3; i++) {
    const w = buildSeaBeluga(rnd);
    const sc = i === 0 ? 1.1 : 0.55 + rnd() * 0.25;
    w.scale.setScalar(sc);
    w.userData.orbitR = Math.min(rFlat * (0.25 + rnd() * 0.45), deepChord * 0.9);
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
    e.userData.orbitR = Math.min(rFlat * (0.2 + rnd() * 0.5), deepChord * 0.85);
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
    f.userData.orbitR = Math.min(rFlat * (0.15 + rnd() * 0.55), deepChord * 0.8);
    f.userData.orbitY = -0.8 - rnd() * 5;
    f.userData.speed = 0.28 + rnd() * 0.2;
    f.userData.phase = rnd() * Math.PI * 2;
    group.add(f);
    fish.push(f);
  }

  // 湖底管虫 / 贝壳：贴真实湖底（阶梯阶地面）摆放，不悬在半水。
  // 局部切平面 (x,z) → 世界方向 → 峡谷阶地面半径 → 换算回组内径向偏移。
  const _t1 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centerDir);
  if (_t1.lengthSq() < 1e-8) _t1.set(1, 0, 0);
  _t1.normalize();
  const _t2 = new THREE.Vector3().crossVectors(centerDir, _t1).normalize();
  const floorLocalYAt = (x, z) => {
    const dir = _tmp
      .copy(centerDir)
      .addScaledVector(_t1, x / surfaceR)
      .addScaledVector(_t2, z / surfaceR)
      .normalize();
    return planetRadius + canyonOffsetDir(dir) - surfaceR + 0.06;
  };
  const decorRadius = Math.min(rFlat * 0.75, shoreChord * 0.9);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * decorRadius;
    const worms = buildSeaTubeWorms(rnd);
    worms.position.set(Math.cos(a) * d, floorLocalYAt(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d);
    worms.scale.setScalar(0.8 + rnd() * 0.5);
    group.add(worms);
  }
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * decorRadius;
    const sh = buildSeaShell(rnd);
    sh.position.set(Math.cos(a) * d, floorLocalYAt(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d);
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

  /**
   * 把整片湖（水面 / 深水盘 / 体积柱 / 白鲸鳗鱼等全部生物）搬到新方向。
   * 只改 group 位姿 + 水面高度，不重建任何几何。
   *
   * 搬离水晶城可显著减负：实测本湖 283 个可绘制对象、15556 三角面，
   * 分别是水晶城的 45% 与 105%（面数比整座城还多），且原湖心与花厅塔重合，
   * 看城市时必然同屏渲染。
   *
   * @param {THREE.Vector3} dir 新湖心方向
   * @param {number} [baseRadius] 水底基准半径；缺省按新位置地形自动求（岛面/峡谷）
   */
  function relocate(dir, baseRadius) {
    if (!dir) return false;
    centerDir.copy(dir).normalize(); // 原地改写 → 闭包看到新值
    let nextBase = baseRadius;
    if (fixedLevel) {
      // 峡谷水城：水位恒定（R-WATER_CITY_WATER_DROP），搬迁只移动湖心
      nextBase = surfaceR - cfg.waterLift;
    } else if (!Number.isFinite(nextBase)) {
      const flat = worldToFlatXZ(centerDir, planetRadius);
      nextBase = flat
        ? planetRadius + groundLiftAt(flat.x, flat.z)
        : planetRadius + canyonOffsetDir(centerDir);
    }
    surfaceR = nextBase + cfg.waterLift;
    group.position.copy(centerDir).multiplyScalar(surfaceR);
    group.quaternion.copy(quatYToDir(centerDir, new THREE.Quaternion()));
    centerWorld.copy(centerDir).multiplyScalar(planetRadius);
    // 同步给外部快照字段：bubblePodRide 每帧读 sea.surfaceR 判定潜水
    api.surfaceR = surfaceR;
    api.baseRadius = nextBase;
    return true;
  }

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

  // 具名对象：relocate() 要改写 api.surfaceR，外部（bubblePodRide）持有同一引用
  const fixedLevel = !!opts.fixedLevel;
  const api = {
    group,
    centerDir,
    centerWorld,
    angR: cfg.angR,
    surfaceR,
    baseRadius: baseR,
    defaultCenterDir: centerDir.clone(), // 出厂位置，供「恢复默认」回退
    defaultBaseRadius: baseR,
    maxDive: cfg.maxDive,
    rFlat,
    waterLift: cfg.waterLift,
    waterDrop: planetRadius - surfaceR,
    shoreAng,
    fixedLevel,
    planetRadius,
    containsWorldPos,
    surfaceHeightAt,
    diveDepthAt,
    update,
    relocate,
  };
  return api;
}
