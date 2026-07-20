// 寒梅归雁图 · 环境：金笺天光、雾、缓坡草岸、静水塘、前景山石与石径、四重远山、薄雪
// 与 environment.js（竹虎溪涧）同构接口：groundHeight / waterLevelAt / makeRandom，
// 溪涧查询换成水塘查询（pondQuery / distToPondEdge / shorePoint / waterPoint）
//
// 画幅构图（贴地 1.5m 机位，主干居画幅 1/4）：
//   第一层 · 梅左立峰群（高为梅 1/4~1/2，参差）+ 独立石 1~3 块（高 1/8~1/6，居画幅左 1/4~1/3）
//   第三层 · 入水缓坡（自左而右占画幅 2/3，塘岸直逼梅根一米）与栖雁
//   第四层 · 左侧大山石（占画幅左 1/3~1/2，高至梅 2/3）、放大静水塘、归雁居中为焦点
//   第五层 · 塘对岸起四重远山，如西湖层峦：缓丘相叠、无孤峰，由近及远渐大渐淡
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// ---------- 确定性随机 ----------
export function makeRandom(seed = 20260719) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 地形起伏（缓，草岸平远；五倍频叠加，地势多变） ----------
function baseHeight(x, z) {
  return (
    0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.045) +
    0.35 * Math.sin(x * 0.13 + 1.7) * Math.sin(z * 0.11 + 0.6) +
    0.22 * Math.sin(x * 0.23 + 0.4) * Math.cos(z * 0.19 + 2.1) +
    0.12 * Math.sin(x * 0.4 + z * 0.3) +
    0.06 * Math.sin(x * 0.7 + 1.1) * Math.sin(z * 0.6 + 2.7)
  );
}

// ---------- 水塘（放大静水，椭圆塘盆；北岸直逼梅根约 1 米） ----------
export const POND = { cx: 10, cz: -32, rx: 65, rz: 40, level: -0.12, bed: -3.5 };

/** 归一化椭圆距 e：<1 塘内，=1 岸线，>1 岸上 */
export function pondQuery(x, z) {
  const dx = (x - POND.cx) / POND.rx, dz = (z - POND.cz) / POND.rz;
  const e = Math.hypot(dx, dz);
  return { e, inside: e < 1 };
}

/** 到岸线的近似距离（米）：正=岸上，负=塘内 */
export function distToPondEdge(x, z) {
  return (pondQuery(x, z).e - 1) * Math.min(POND.rx, POND.rz);
}

// 从 (x,z) 沿"该点—塘心"方向取指定椭圆距上的点
function pointAtE(x, z, targetE) {
  const dx = x - POND.cx, dz = z - POND.cz;
  const e0 = Math.hypot(dx / POND.rx, dz / POND.rz) || 1e-4;
  const k = targetE / e0;
  return { x: POND.cx + dx * k, z: POND.cz + dz * k };
}

/** 最近岸点（e≈1.06，雁上岸处） */
export function shorePoint(x, z) { return pointAtE(x, z, 1.06); }
/** 塘内水点（e≈0.55，雁游水/降落处） */
export function waterPoint(x, z) { return pointAtE(x, z, 0.55); }

export function groundHeight(x, z) {
  let h = baseHeight(x, z);
  // 地势南高北低：向水塘长缓坡下行（入水缓坡自左而右横展）
  h += THREE.MathUtils.clamp((z + 20) * 0.012, -0.4, 0.9);
  const L = landField(x, z);
  // 岸带牵引：缓坡收至水线（按岸域场，含梅环湾）
  if (L < 18) {
    const t = THREE.MathUtils.clamp((18 - L) / 18, 0, 1);
    const k = t * t * (3 - 2 * t);
    h = THREE.MathUtils.lerp(h, POND.level + 0.22, k * 0.9);
  }
  // 塘床下切：入水渐深（近岸下切要陡过水线，环湾处方能积水成形）
  if (L < 0) {
    const t = THREE.MathUtils.clamp(-L / 8, 0, 1);
    const k = t * t * (3 - 2 * t);
    h = THREE.MathUtils.lerp(h, POND.bed, k);
  }
  return h;
}

export function waterLevelAt() { return POND.level; }

// 古梅立身处（坡顶偏左，居画幅 1/4 的画眼）
export const PLUM_TREE_POS = { x: -9, z: 9 };
export const PLUM_TREE_H = 55; // 梅高（十倍于旧），山石配比之基准

/**
 * 岸域场 L(x,z)：正=岸上，负=塘内，0=水线。
 * 椭圆塘盆 + 塘水环绕梅根：向塘一侧水面绕树成湾，背塘一侧仍连岸，
 * 梅根保留 1 米土地（L=1-dt 的环岛）。
 */
export function landField(x, z) {
  const dx = (x - POND.cx) / POND.rx, dz = (z - POND.cz) / POND.rz;
  const dE = (Math.hypot(dx, dz) - 1) * Math.min(POND.rx, POND.rz); // 椭圆岸距（近似，米）
  const tx = x - PLUM_TREE_POS.x, tz = z - PLUM_TREE_POS.z;
  const dt = Math.hypot(tx, tz);
  // 环绕权重：靠近梅根、且在"树→塘心"方向一侧才下挖
  const vcX = POND.cx - PLUM_TREE_POS.x, vcZ = POND.cz - PLUM_TREE_POS.z;
  const vl = Math.hypot(vcX, vcZ);
  const wrapAng = 0.5 + 0.5 * ((tx * vcX + tz * vcZ) / ((dt || 1e-3) * vl));
  const w = Math.exp(-(dt * dt) / (2 * 4 * 4)) * wrapAng;
  return Math.max(1 - dt, dE - w * 3);
}

// ---------- 太湖石（移植自 environment.js：瘦、皱、束腰） ----------
function taihuGeometry(seed, { stretch = 1.75, flareK = 0.35, flareFrom = 0.6, waist = 0.32, topSoft = 1.25, flatK = 0.35, pinch = 0.5 } = {}) {
  let geo = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(1, 3));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const w =
      0.30 * Math.sin(n.x * 5.3 + seed) * Math.sin(n.y * 4.1 + seed * 1.7) * Math.sin(n.z * 4.7 + seed * 0.6) +
      0.18 * Math.sin(n.x * 11.1 + n.y * 8.3 + seed * 2.1) +
      0.10 * Math.sin(n.z * 17.3 + n.x * 13.7 + seed * 3.7);
    const r = 1 + w;
    let y = n.y * r * stretch;
    if (y > topSoft) y = topSoft + (y - topSoft) * flatK;
    const waistF = 1 - waist * Math.exp(-((n.y / 0.45) ** 2));
    const topPinch = n.y > 0.55 ? 1 - (n.y - 0.55) * pinch : 1;
    const baseFlare = n.y < -flareFrom ? 1 + (-n.y - flareFrom) * flareK : 1;
    const xz = r * waistF * topPinch * baseFlare;
    pos.setXYZ(i, n.x * xz, y, n.z * xz);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x4a3b2a);
  const light = new THREE.Color(0xe8ddca);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    c.copy(light).lerp(dark, Math.pow(t, 1.5));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.translate(0, -bb.min.y, 0);
  geo.userData.height = bb.max.y - bb.min.y;
  return geo;
}

// 顺山石面的积雪壳（取顶部朝上面，沿法线微抬）
function snowCrust(geo, rand) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
  const H = geo.userData.height;
  const y0 = H * (0.55 + rand() * 0.2);
  const ok = new Uint8Array(pos.count);
  const verts = pos.array.slice();
  const nors = nor.array;
  for (let i = 0; i < pos.count; i++) {
    if (verts[i * 3 + 1] > y0 && nors[i * 3 + 1] > 0.35) {
      ok[i] = 1;
      verts[i * 3] += nors[i * 3] * 0.035;
      verts[i * 3 + 1] += nors[i * 3 + 1] * 0.035;
      verts[i * 3 + 2] += nors[i * 3 + 2] * 0.035;
    }
  }
  const tris = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (ok[a] && ok[b] && ok[c]) tris.push(a, b, c);
  }
  if (!tris.length) return null;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  sg.setIndex(tris);
  sg.computeVertexNormals();
  return sg;
}

// ---------- 场景环境 ----------
export class PlumEnvironment {
  constructor(scene, config, physics = null) {
    this.scene = scene;
    this.config = config;
    this.physics = physics;
    this.time = 0;
    this._buildSkyAndLight();
    this._buildGround();
    this._buildPath();      // 第一层：石径
    this._buildRocks();     // 第一/二/四层：山石
    this._buildPond();      // 第四层：静水塘
    this._buildMountains(); // 第五层：塘对岸山嶂与远山边缘线
    this._buildSnowfall();
  }

  _buildSkyAndLight() {
    const mist = this.config.plum?.mist ?? 0.55;
    const gold = this.config.scene?.goldBackground ?? true;
    const paper = gold ? new THREE.Color(0xe7d9b4) : new THREE.Color(0xdfe4e6);
    this.scene.background = paper;
    this.scene.fog = new THREE.FogExp2(paper, 0.002 + mist * 0.004); // 场景放大，薄雾留山形

    const sun = new THREE.DirectionalLight(0xffe8c4, 1.9);
    sun.position.set(-60, 80, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
    sun.shadow.camera.far = 320;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0xdde6ea, 0xb9a98a, 0.85));

    const rim = new THREE.DirectionalLight(0xcfe0e8, 0.5);
    rim.position.set(50, 30, 60);
    this.scene.add(rim);
  }

  _buildGround() {
    const RADIUS = 350, SEG = 220;
    const geo = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grassLo = new THREE.Color(0x96895f);   // 冬草阴处
    const grassHi = new THREE.Color(0xb5a87e);   // 冬草向阳
    const frost = new THREE.Color(0xd9d2ba);     // 薄霜
    const wet = new THREE.Color(0x8d8878);       // 岸线湿土
    const bed = new THREE.Color(0x6b6a58);       // 塘床
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      const L = landField(x, z);
      if (L < -0.5) {
        c.copy(bed);
      } else if (L < 4.3) {
        c.copy(wet);
      } else {
        const shade = THREE.MathUtils.clamp(0.5 + h * 0.5, 0, 1);
        c.copy(grassLo).lerp(grassHi, shade);
        // 薄霜：高处与背阴处星星点点
        const f = 0.5 + 0.5 * Math.sin(x * 0.55 + z * 0.75) * Math.sin(x * 0.2 - z * 0.36);
        if (f > 0.72) c.lerp(frost, (f - 0.72) * 1.2);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** 第一层 · 石径：自前景右下蜿蜒至梅下，石板错落没入草色 */
  _buildPath() {
    const pts = [
      new THREE.Vector3(14, 0, 38), new THREE.Vector3(6, 0, 29),
      new THREE.Vector3(-1, 0, 21), new THREE.Vector3(-6, 0, 14),
      new THREE.Vector3(-9, 0, 11),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const rand = makeRandom(31);
    const slabGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.09, 7);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x9b9484, roughness: 0.9, flatShading: true });
    const N = 20;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const p = curve.getPointAt(t);
      const x = p.x + (rand() - 0.5) * 0.5;
      const z = p.z + (rand() - 0.5) * 0.5;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      const s = 0.75 + rand() * 0.55;
      slab.scale.set(s, 1, s * (0.8 + rand() * 0.4));
      slab.position.set(x, groundHeight(x, z) + 0.02, z);
      slab.rotation.y = rand() * Math.PI;
      slab.castShadow = slab.receiveShadow = true;
      this.scene.add(slab);
    }
  }

  /** 山石：第一层梅左立峰群与独立石；梅根盘石；第四层左侧山嶂；岸边点景 */
  _buildRocks() {
    const rand = makeRandom(77);
    const rockTex = new THREE.TextureLoader().load("assets/textures/rocks_taihu.png");
    rockTex.colorSpace = THREE.SRGBColorSpace;
    rockTex.anisotropy = 4;
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, vertexColors: true, roughness: 0.95 });
    const facetMat = new THREE.MeshStandardMaterial({ map: rockTex, vertexColors: true, roughness: 0.95, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf6f8f6, roughness: 1 });
    const H = PLUM_TREE_H;

    const placeStone = (x, z, s, targetH, geo, mat, pose = null) => {
      const y = groundHeight(x, z);
      const sy = targetH / geo.userData.height;
      const rock = new THREE.Mesh(geo, mat);
      rock.scale.set(s, sy, s);
      rock.rotation.y = rand() * Math.PI * 2;
      if (pose === "lay") {
        rock.rotation.z = Math.PI / 2 + (rand() - 0.5) * 0.15;
        rock.position.set(x, y - 0.06 - s * 0.3, z);
      } else {
        rock.position.set(x, y - 0.06 - targetH / 3, z);
        if (pose) { rock.rotation.x = pose.x; rock.rotation.z = pose.z; }
      }
      rock.castShadow = rock.receiveShadow = true;
      this.scene.add(rock);
      if (pose !== "lay" && rand() < 0.6) {
        const sg = snowCrust(geo, rand);
        if (sg) {
          const snow = new THREE.Mesh(sg, snowMat);
          snow.receiveShadow = true;
          rock.add(snow);
        }
      }
      return rock;
    };

    // —— 第一层：梅左立峰群（高为梅 1/4~1/2 参差，群幅约为画幅 1/5） ——
    const peaks = [
      { x: -26, z: 4, h: H * 0.46, s: 5.5 },  // 主峰
      { x: -32, z: 0, h: H * 0.36, s: 4.2 },
      { x: -21, z: 0.5, h: H * 0.3, s: 3.4 },
      { x: -29, z: 8, h: H * 0.25, s: 2.8 },
    ];
    peaks.forEach((p, i) => {
      const lay = i === 3;
      placeStone(p.x, p.z, p.s, p.h,
        taihuGeometry(rand() * 100, i === 0
          ? { stretch: 1.6, flareK: 0.4, waist: 0.3 }
          : { stretch: 1.5, flareK: 0.35, waist: 0.32 }),
        rockMat, lay ? "lay" : { x: (rand() - 0.5) * 0.1, z: (rand() - 0.5) * 0.1 });
    });

    // —— 第一层·独立石：随机 1~3 块，高为梅 1/8~1/6 ——
    // 位置/下沉/右倾角均可配置（plum.rocks.solo*，默认即当前构图；峰顶放缓 pinch 小则不尖）
    const SOLO_DEFAULT = [
      { x: -3.5, z: 14.1, sink: 0, tilt: 0 },
      { x: -14, z: 19.3, sink: 0.33, tilt: 30 },   // 画面最左侧
      { x: -2.8, z: 18.5, sink: 0.33, tilt: 30 },  // 梅右前方
    ];
    const nSolo = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < nSolo; i++) {
      rand(); rand(); // 原随机落点作废（由配置接管），保持随机序列不变
      const h = H * (1 / 8 + rand() * (1 / 6 - 1 / 8));
      const ov = this.config.plum?.rocks?.["solo" + i] ?? SOLO_DEFAULT[i] ?? SOLO_DEFAULT[0];
      const rock = placeStone(ov.x, ov.z, h * 0.32, h,
        taihuGeometry(rand() * 100, { stretch: 1.5, flareK: 0.6, waist: 0.3, pinch: 0.16, flatK: 0.25 }), facetMat);
      if (ov.sink) rock.position.y -= h * ov.sink;                                  // 下沉（石高比例）
      if (ov.tilt) rock.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -ov.tilt * Math.PI / 180); // 右倾角（度）
    }

    // —— 梅根盘石：两三小块卧石护根 ——
    const rootStones = [];
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, d = 4 + rand() * 3.5;
      const x = PLUM_TREE_POS.x + Math.cos(a) * d, z = PLUM_TREE_POS.z + Math.sin(a) * d;
      const s = 1.6 + rand() * 1.4;
      rootStones.push(placeStone(x, z, s, s * 1.2, taihuGeometry(rand() * 100, { stretch: 1.2, flareK: 0.9, flareFrom: 0.4, waist: 0.2 }), facetMat, "lay"));
    }
    // 挪开距梅根最近的盘石，露出根部；移至画面左侧岸上浅水线
    let nearest = null, nd = Infinity;
    for (const r of rootStones) {
      const rd = Math.hypot(r.position.x - PLUM_TREE_POS.x, r.position.z - PLUM_TREE_POS.z);
      if (rd < nd) { nd = rd; nearest = r; }
    }
    if (nearest) {
      const rootOv = this.config.plum?.rocks?.root ?? { x: -18, z: 10, sink: 0, tilt: 0 }; // 落点/下沉/右倾角均可配
      const s = nearest.scale.x;
      nearest.position.set(
        rootOv.x,
        groundHeight(rootOv.x, rootOv.z) - 0.06 - s * 0.3 - s * 1.2 * (rootOv.sink ?? 0),
        rootOv.z);
      if (rootOv.tilt) nearest.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -rootOv.tilt * Math.PI / 180);
    }

    // —— 第四层：左侧山嶂（占画幅左 1/3~1/2，高至梅 2/3；塘扩后沿南岸退立） ——
    const wall = [
      { x: -38, z: -66, h: H * 0.66, s: 13 },
      { x: -26, z: -72, h: H * 0.55, s: 11 },
      { x: -12, z: -71, h: H * 0.45, s: 9 },
      { x: -48, z: -60, h: H * 0.5, s: 10 },
    ];
    for (const p of wall) {
      placeStone(p.x, p.z, p.s, p.h,
        taihuGeometry(rand() * 100, { stretch: 1.7, flareK: 0.45, waist: 0.26 }),
        rockMat, { x: (rand() - 0.5) * 0.08, z: (rand() - 0.5) * 0.08 });
    }

    // —— 岸边点景小石（贴着南岸水线） ——
    for (let i = 0; i < 7; i++) {
      const a = (0.2 + rand() * 0.6) * Math.PI;
      const px = POND.cx + Math.cos(a) * POND.rx * 1.08;
      const pz = POND.cz + Math.sin(a) * POND.rz * 1.08;
      const s = 0.5 + rand() * 0.9;
      placeStone(px, pz, s, s * (1.4 + rand() * 0.6),
        taihuGeometry(rand() * 100, { stretch: 1.3, flareK: 1.0, flareFrom: 0.35, waist: 0.2 }), facetMat);
    }
  }

  /** 第四层 · 静水塘：菲涅尔半透 + 微波 + 雁迹涟漪（uWaders[4]）；岸线由岸域场 L 勾出（含梅环湾） */
  _buildPond() {
    const geo = new THREE.CircleGeometry(1, 128);
    geo.rotateX(-Math.PI / 2);
    geo.scale(POND.rx * 1.15, 1, POND.rz * 1.15);
    geo.translate(POND.cx, POND.level, POND.cz);

    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-60, 80, -30).normalize() },
      uPond: { value: new THREE.Vector4(POND.cx, POND.cz, POND.rx, POND.rz) },
      uTree: { value: new THREE.Vector2(PLUM_TREE_POS.x, PLUM_TREE_POS.z) },
      uWaders: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0.55, 0)) }, // x,z / 半径 / 强度
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec4 uPond;  // cx, cz, rx, rz
        uniform vec2 uTree;
        uniform vec4 uWaders[4];
        varying vec2 vUv;
        varying vec3 vWorld;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float rip(vec2 p) { // 静水微波：两层噪声，缓漂移
          return vnoise(p * 2.6 + vec2(uTime * 0.05, uTime * 0.03)) * 0.62
               + vnoise(p * 6.4 + vec2(-uTime * 0.04, 31.7)) * 0.38;
        }

        void main() {
          // —— 雁迹涟漪：游水/降落处药环外扩 ——
          float ring = 0.0, foam = 0.0;
          vec2 ringGrad = vec2(0.0);
          for (int i = 0; i < 4; i++) {
            vec4 w = uWaders[i];
            if (w.w < 0.001) continue;
            vec2 dv = vWorld.xz - w.xy;
            float d = max(length(dv), 1e-3);
            float phase = d * 14.0 - uTime * 3.2;
            float att = exp(-d * 0.55) * w.w;
            ring += sin(phase) * att;
            ringGrad += (dv / d) * (14.0 * cos(phase)) * att;
            foam += smoothstep(1.1, 0.25, d) * 0.3 * w.w;
          }

          float h0 = rip(vWorld.xz * 0.55) + ring * 0.5;
          float e = 0.06;
          vec2 P = vWorld.xz * 0.55;
          float hx = rip(P + vec2(e, 0.0)) - rip(P - vec2(e, 0.0));
          float hz = rip(P + vec2(0.0, e)) - rip(P - vec2(0.0, e));
          vec3 N = normalize(vec3(-hx * 1.1 - ringGrad.x * 0.16, 1.0, -hz * 1.1 - ringGrad.y * 0.16));

          // —— 玻璃质半透：菲涅尔 + 日光镜面 ——
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 L = normalize(uSunDir);
          float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
          vec3 deep = vec3(0.22, 0.27, 0.25);    // 墨绿灰
          vec3 shallow = vec3(0.48, 0.51, 0.44); // 近岸茶褐
          float rim = smoothstep(0.55, 1.0, length(vUv - 0.5) * 2.0); // 0 心 → 1 岸
          vec3 base = mix(deep, shallow, rim) * (0.9 + h0 * 0.25);
          vec3 skyRef = vec3(0.91, 0.86, 0.72); // 金笺天光反射（水天一色）
          vec3 col = mix(base, skyRef, 0.22 + fres * 0.55);
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 140.0) * 1.2;
          col += spec * vec3(1.0, 0.96, 0.82);
          col += foam * vec3(0.8);
          float alpha = 0.52 + fres * 0.3 + foam * 0.25;
          // —— 岸域场（与 JS 侧 landField 一致）：水只现于场值 <0，梅环湾处岸线自然收束 ——
          vec2 dp = vWorld.xz - uPond.xy;
          float dE = (length(dp / uPond.zw) - 1.0) * min(uPond.z, uPond.w);
          vec2 dt2 = vWorld.xz - uTree;
          float dt = length(dt2);
          vec2 vc = normalize(uPond.xy - uTree);
          float wrapAng = 0.5 + 0.5 * dot(dt2 / max(dt, 1e-3), vc);
          float w = exp(-dt * dt / 32.0) * wrapAng;
          float landF = max(1.0 - dt, dE - w * 3.0);
          alpha *= smoothstep(0.08, -0.4, landF);
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
        }`,
    });
    const water = new THREE.Mesh(geo, mat);
    water.renderOrder = 2;
    this.scene.add(water);
  }

  /** 第五层 · 四重远山：西湖式层峦——长波缓起伏、轮廓无深谷尖峰，由近及远渐大渐淡 */
  _buildMountains() {
    const mkRidge = (z, baseY, amp, width, color, opacity, seed) => {
      const N = 160;
      const positions = [], indices = [];
      const rand = makeRandom(seed);
      const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
      for (let i = 0; i <= N; i++) {
        const x = -width / 2 + (i / N) * width;
        // 轮廓恒在 baseY~baseY+amp 之间缓滚：低丘相叠、无孤峰
        const h = baseY + amp * (
          0.46 +
          0.30 * Math.sin(x * 0.006 + ph[0]) +
          0.16 * Math.sin(x * 0.017 + ph[1]) +
          0.08 * Math.sin(x * 0.041 + ph[2]));
        positions.push(x, -5, z, x, h, z);
        if (i < N) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setIndex(indices);
      // 不依场景雾（远山在雾中会隐没）：透明度与色阶自带烟雨渐远之意
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, fog: false, side: THREE.DoubleSide,
      });
      this.scene.add(new THREE.Mesh(geo, mat));
    };
    // 远山抬高至画面约 4/5（画幅高≈梅高55m，4/5≈44m）：由近及远渐高，山嶂逼目
    mkRidge(-170, 18, 26, 700, 0x8f8a76, 0.85, 7);    // 塘对岸近山（顶 44m ≈ 画幅 4/5）
    mkRidge(-320, 26, 34, 1050, 0xa49e8a, 0.6, 13);  // 第二重（顶 60m）
    mkRidge(-500, 34, 44, 1500, 0xbab3a0, 0.42, 21); // 第三重 · 更大（顶 78m）
    mkRidge(-720, 44, 56, 2000, 0xcec7b4, 0.28, 33); // 第四重 · 最大最淡（顶 100m）
  }

  _buildSnowfall() {
    const COUNT = 1200;
    this.snowCount = COUNT;
    const positions = new Float32Array(COUNT * 3);
    const rand = makeRandom(7);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * 340;
      positions[i * 3 + 1] = rand() * 70;
      positions[i * 3 + 2] = (rand() - 0.5) * 340;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.16, transparent: true, opacity: 0.8,
      sizeAttenuation: true, depthWrite: false,
    }));
    this.scene.add(this.snow);
  }

  /** 雁迹涟漪：游水/降落的大雁位置（最多 4 个），强度平滑 */
  updateSwimmers(list) {
    const us = this.waterUniforms?.uWaders?.value;
    if (!us) return;
    for (let i = 0; i < us.length; i++) {
      const s = list[i];
      const target = s ? Math.min(s.strength ?? 1, 1) : 0;
      us[i].w += (target - us[i].w) * 0.08;
      if (s) { us[i].x = s.x; us[i].y = s.z; }
    }
  }

  update(dt) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;

    // 薄雪：缓、随风飘，触地重生；强度 0 时隐藏
    const { snowfall = 0.35, wind = 0.25 } = this.config.plum ?? {};
    this.snow.visible = snowfall > 0.02;
    if (!this.snow.visible) return;
    const dirDeg = this.config.plum?.windDirection ?? this.config.weather?.windDirection ?? 0;
    const dirRad = (dirDeg * Math.PI) / 180;
    const dirX = Math.sin(dirRad), dirZ = Math.cos(dirRad);
    const active = Math.max(1, Math.floor(this.snowCount * Math.min(snowfall / 2, 1)));
    this.snow.geometry.setDrawRange(0, active);
    const pos = this.snow.geometry.attributes.position;
    const speed = 1.4 * (0.7 + snowfall * 0.3);
    const drift = wind * 1.4;
    for (let i = 0; i < this.snowCount; i++) {
      let y = pos.getY(i) - dt * speed * (0.7 + (i % 7) * 0.08);
      let x = pos.getX(i) + dt * drift * dirX + dt * wind * 0.5 * Math.sin(this.time * 0.6 + i);
      let z = pos.getZ(i) + dt * drift * dirZ;
      if (y < this._groundY(x, z)) {
        y = 64 + Math.random() * 8;
        x = (Math.random() - 0.5) * 340;
        z = (Math.random() - 0.5) * 340;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  _groundY(x, z) {
    return this.physics ? this.physics.heightAt(x, z) : groundHeight(x, z);
  }
}
