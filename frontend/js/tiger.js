// 猛虎：整体皮肤 SkinnedMesh（拟狩野山乐《竹虎图》的斑斓）
// 躯干/四肢/颈头为一张统一网格，骨骼驱动（脊椎三段 + 四肢三段 + 颈/头/下颌 + 尾三段）
// 皮毛：12 层壳层纹理（Shell Texturing）沿法线膨胀 + 高频噪声 alphaMap
// 物理：躯干是 kinematic 刚体，由巡游路径驱动，与竹/石的碰撞交给 Cannon 解算
import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { groundHeight } from "./environment.js";
import { GROUP } from "./physics.js";

const ORANGE = new THREE.Color(0xd27a24);
const ORANGE_DEEP = new THREE.Color(0xb5621a);
const DARK = new THREE.Color(0x1d140d);
const CREAM = new THREE.Color(0xf2e8d5);

// 在几何体上按局部坐标画虎皮：沿体长波浪斑纹 + 腹底留白（画谱"斑斓"意）
// 条纹窄而清晰，辅以高频断续调制（拟真虎纹的断裂下垂）
// legs：腿管归属表（与 buildBodyGeometry 一致），腿管单独画环纹、爪尖留白
const LEG_REGIONS = [
  { x: -0.26, z: 0.57 }, { x: 0.26, z: 0.57 },
  { x: -0.27, z: -0.57 }, { x: 0.27, z: -0.57 },
];
function legRegionAt(x, z, y) {
  if (y > 1.01) return false;
  for (const L of LEG_REGIONS) {
    if (Math.hypot(x - L.x, z - L.z) < 0.16) return true;
  }
  return false;
}

function paintTiger(geo, { freq = 14, belly = -0.25, axis = "z", contrast = 1, paws = false } = {}) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (axis === "z" && legRegionAt(x, z, y)) {
      // 腿管：橙底环纹（沿 y），爪尖留白
      const ring = Math.sin(y * 22 + Math.sin(Math.atan2(z, x) * 4) * 0.8);
      const shade = THREE.MathUtils.clamp(0.45 + y * 0.4, 0, 1);
      c.copy(ORANGE_DEEP).lerp(ORANGE, shade);
      if (y < 0.14) c.copy(CREAM);
      else if (ring > 0.35) c.lerp(DARK, THREE.MathUtils.smoothstep(ring, 0.35, 0.9) * 0.7 * contrast);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      continue;
    }
    const along = axis === "y" ? y : z;
    const across = axis === "y" ? Math.atan2(x, z) : Math.atan2(x, y + 1e-4);
    const w1 = Math.sin(along * freq + Math.sin(across * 3 + along * 0.7) * 1.3);
    const w2 = Math.sin(across * 7 + along * 2.3); // 断续：虎纹不成环、节节垂落
    const wave = w1 + w2 * 0.4;
    const shade = THREE.MathUtils.clamp(0.5 + y * 0.5, 0, 1);
    c.copy(ORANGE_DEEP).lerp(ORANGE, shade);
    if (paws && y < belly) {
      c.copy(CREAM);
    } else if (axis === "z" && y < belly) {
      c.copy(CREAM); // 腹底与下颌留白
    } else if (wave > 0.2) {
      const k = THREE.MathUtils.smoothstep(wave, 0.2, 0.85) * contrast;
      c.lerp(DARK, Math.min(k, 1));
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ---------- 骨骼层级 ----------
// 索引布局（权重写入要用）：
// 0 Root  1 Pelvis  2 Mid  3 Chest  4 Neck  5 Head  6 Jaw
// 7 FL1 8 FL2 9 FLfoot  10 FR1 11 FR2 12 FRfoot
// 13 BL1 14 BL2 15 BLfoot  16 BR1 17 BR2 18 BRfoot
// 19 Tail1 20 Tail2 21 Tail3
const BONE = {
  Root: 0, Pelvis: 1, Mid: 2, Chest: 3, Neck: 4, Head: 5, Jaw: 6,
  FL1: 7, FL2: 8, FLFoot: 9, FR1: 10, FR2: 11, FRFoot: 12,
  BL1: 13, BL2: 14, BLFoot: 15, BR1: 16, BR2: 17, BRFoot: 18,
  Tail1: 19, Tail2: 20, Tail3: 21,
};

function buildSkeleton() {
  const mk = (name, parent, x, y, z) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    return b;
  };
  // 骨骼局部坐标 = 虎组局部坐标（原点在地，+Z 朝前）
  const root = mk("Root", null, 0, 1.05, 0);          // 重心高度
  const pelvis = mk("Pelvis", root, 0, 0, -0.55);     // 骨盆 z=-0.55
  const mid = mk("Mid", pelvis, 0, 0, 0.55);          // 腰腹 z=0
  const chest = mk("Chest", mid, 0, 0, 0.55);         // 胸腔 z=+0.55
  const neck = mk("Neck", chest, 0, 0.07, 0.3);       // 颈（贴合网格中心线）
  const head = mk("Head", neck, 0, 0.03, 0.26);       // 头
  const jaw = mk("Jaw", head, 0, -0.1, 0.1);          // 下颌
  // 前肢（肩在胸腔两侧）
  const fl1 = mk("FL1", chest, -0.26, -0.15, 0.02);
  const fl2 = mk("FL2", fl1, 0, -0.4, 0);
  const flF = mk("FLFoot", fl2, 0, -0.35, 0.02);
  const fr1 = mk("FR1", chest, 0.26, -0.15, 0.02);
  const fr2 = mk("FR2", fr1, 0, -0.4, 0);
  const frF = mk("FRFoot", fr2, 0, -0.35, 0.02);
  // 后肢（胯在骨盆两侧）
  const bl1 = mk("BL1", pelvis, -0.27, -0.12, -0.02);
  const bl2 = mk("BL2", bl1, 0, -0.42, 0);
  const blF = mk("BLFoot", bl2, 0, -0.36, 0.02);
  const br1 = mk("BR1", pelvis, 0.27, -0.12, -0.02);
  const br2 = mk("BR2", br1, 0, -0.42, 0);
  const brF = mk("BRFoot", br2, 0, -0.36, 0.02);
  // 尾（自骨盆向后，覆盖到 z≈-1.65）
  const tail1 = mk("Tail1", pelvis, 0, 0.06, -0.2);
  const tail2 = mk("Tail2", tail1, 0, 0.0, -0.35);
  const tail3 = mk("Tail3", tail2, 0, -0.02, -0.35);

  const bones = [
    root, pelvis, mid, chest, neck, head, jaw,
    fl1, fl2, flF, fr1, fr2, frF,
    bl1, bl2, blF, br1, br2, brF,
    tail1, tail2, tail3,
  ];
  return { root, bones, skeleton: new THREE.Skeleton(bones) };
}

// ---------- 统一身体几何体 ----------
// 一条沿 Z 的高细分"管"，按解剖轮廓逐环缩放：颈细、胸隆、腹垂、胯圆、尾收
// 四肢为附接管（同一张几何体），权重写入见 _skinAll
function buildBodyGeometry() {
  const RADIAL = 24, RINGS = 64;
  // 轮廓表：z 位置 → [半径, 中心高度偏移]（虎组局部坐标）
  const profile = [
    [-1.65, 0.028, 0.92], // 尾尖
    [-1.45, 0.055, 0.94],
    [-1.25, 0.09, 0.97],
    [-1.05, 0.17, 1.00], // 尾根/胯后
    [-0.80, 0.34, 1.02], // 臀胯圆实
    [-0.45, 0.33, 0.98], // 后腹
    [-0.10, 0.34, 0.94], // 腰腹（略下垂）
    [0.25, 0.35, 0.98],  // 前腹
    [0.55, 0.36, 1.04],  // 胸腔隆起（肩）
    [0.80, 0.30, 1.08],  // 肩后颈起
    [1.00, 0.24, 1.12],  // 颈
    [1.18, 0.22, 1.16],  // 颈前/颅底
    [1.32, 0.19, 1.14],  // 吻部后
    [1.44, 0.10, 1.12],  // 吻尖
  ];
  const geos = [];
  // 主管：逐环生成（径向 24，保证圆润）
  const ringCount = profile.length;
  const positions = [], normals = [], uvs = [], indices = [];
  for (let r = 0; r < ringCount; r++) {
    const [z, rad, cy] = profile[r];
    for (let k = 0; k < RADIAL; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      const x = Math.cos(a) * rad * 1.05; // 横宽略大于竖高
      const y = cy + Math.sin(a) * rad * 0.95;
      positions.push(x, y, z);
      normals.push(Math.cos(a), Math.sin(a), 0);
      uvs.push(k / RADIAL, r / (ringCount - 1));
    }
  }
  // 相邻环插值加密（轮廓平滑的关键）：在相邻环间再插 3 环
  const densePos = [], denseNor = [], denseUv = [];
  const RING_INTERP = 3;
  const ringPts = (r, t) => {
    // 环 r 与 r+1 之间 t 处的一圈点
    const [z0, rad0, cy0] = profile[r];
    const [z1, rad1, cy1] = profile[r + 1];
    const z = z0 + (z1 - z0) * t, rad = rad0 + (rad1 - rad0) * t, cy = cy0 + (cy1 - cy0) * t;
    const pts = [];
    for (let k = 0; k < RADIAL; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      pts.push([Math.cos(a) * rad * 1.05, cy + Math.sin(a) * rad * 0.95, z, Math.cos(a), Math.sin(a)]);
    }
    return pts;
  };
  const ringsAll = [];
  for (let r = 0; r < ringCount - 1; r++) {
    for (let t = 0; t < RING_INTERP; t++) ringsAll.push(ringPts(r, t / RING_INTERP));
  }
  ringsAll.push(ringPts(ringCount - 2, 1)); // 末环
  const totalRings = ringsAll.length;
  for (let r = 0; r < totalRings; r++) {
    for (let k = 0; k < RADIAL; k++) {
      const [x, y, z, nx, ny] = ringsAll[r][k];
      densePos.push(x, y, z);
      denseNor.push(nx, ny, 0);
      denseUv.push(k / RADIAL, r / (totalRings - 1));
    }
  }
  const idx = [];
  for (let r = 0; r < totalRings - 1; r++) {
    for (let k = 0; k < RADIAL; k++) {
      const k2 = (k + 1) % RADIAL;
      const a = r * RADIAL + k, b = r * RADIAL + k2;
      const c = (r + 1) * RADIAL + k, d = (r + 1) * RADIAL + k2;
      idx.push(a, c, b, b, c, d);
    }
  }
  // 两端封口（尾尖、吻尖用扇形）
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute("position", new THREE.Float32BufferAttribute(densePos, 3));
  bodyGeo.setAttribute("normal", new THREE.Float32BufferAttribute(denseNor, 3));
  bodyGeo.setAttribute("uv", new THREE.Float32BufferAttribute(denseUv, 2));
  bodyGeo.setIndex(idx);
  geos.push(bodyGeo);

  // 四肢管（附接管，权重会绑到腿骨；上粗下细）
  const legDefs = [
    { x: -0.26, z: 0.57, front: true },  // 左前
    { x: 0.26, z: 0.57, front: true },   // 右前
    { x: -0.27, z: -0.57, front: false },// 左后
    { x: 0.27, z: -0.57, front: false }, // 右后
  ];
  for (const def of legDefs) {
    const topY = 1.0, pawY = 0.02;
    const legGeo = new THREE.CylinderGeometry(0.115, 0.07, topY - pawY, 14, 12);
    legGeo.translate(0, (topY + pawY) / 2, 0);
    // 爪：底端略宽
    const pawGeo = new THREE.SphereGeometry(0.085, 12, 8);
    pawGeo.scale(1.05, 0.55, 1.3);
    pawGeo.translate(0, pawY + 0.02, 0.03);
    const leg = BufferGeometryUtils.mergeGeometries([legGeo, pawGeo]);
    leg.translate(def.x, 0, def.z);
    geos.push(leg);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geos);
  merged.computeVertexNormals(); // 平滑着色：消除棱角
  return merged;
}

// ---------- 顶点权重：按解剖区间精确分配 ----------
// 主体按 z 分给脊椎三段；四肢管按（x,z）归属各腿骨；头颈/下颌/尾分区
function skinAll(geo) {
  const pos = geo.attributes.position;
  const skinIndices = new Uint16Array(pos.count * 4);
  const skinWeights = new Float32Array(pos.count * 4);

  // 腿管归属判定（与 buildBodyGeometry 的 legDefs 一致）
  const legs = [
    { x: -0.26, z: 0.57, b1: BONE.FL1, b2: BONE.FL2, bF: BONE.FLFoot, spine: BONE.Chest },
    { x: 0.26, z: 0.57, b1: BONE.FR1, b2: BONE.FR2, bF: BONE.FRFoot, spine: BONE.Chest },
    { x: -0.27, z: -0.57, b1: BONE.BL1, b2: BONE.BL2, bF: BONE.BLFoot, spine: BONE.Pelvis },
    { x: 0.27, z: -0.57, b1: BONE.BR1, b2: BONE.BR2, bF: BONE.BRFoot, spine: BONE.Pelvis },
  ];
  const legAt = (x, z, y) => {
    if (y > 1.01) return null; // 腿管顶端不超过 1.0
    for (const L of legs) {
      if (Math.hypot(x - L.x, z - L.z) < 0.16) return L;
    }
    return null;
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let i1 = BONE.Mid, w1 = 1, i2 = BONE.Root, w2 = 0;

    const leg = legAt(x, z, y);
    if (leg) {
      // 腿管：按高度 y 分给 大腿/小腿/爪，与躯干骨平滑过渡
      if (y > 0.85) { // 腿根：与躯干融合
        const t = (y - 0.85) / 0.15; // 0..1
        i1 = leg.b1; w1 = 1 - t * 0.6; i2 = leg.spine; w2 = t * 0.6;
      } else if (y > 0.55) { // 大腿（髋→膝）
        const t = (0.85 - y) / 0.3;
        i1 = leg.b1; w1 = 1 - t * 0.85; i2 = leg.b2; w2 = t * 0.85;
      } else if (y > 0.2) { // 小腿（膝→腕）
        const t = (0.55 - y) / 0.35;
        i1 = leg.b2; w1 = 1 - t * 0.85; i2 = leg.bF; w2 = t * 0.85;
      } else { // 爪
        i1 = leg.bF; w1 = 1; i2 = leg.bF; w2 = 0;
      }
    } else if (z < -1.25) {
      // 尾：三段渐给
      const t = THREE.MathUtils.clamp((-1.25 - z) / 0.3, 0, 1);
      i1 = BONE.Tail1; w1 = 1 - t; i2 = BONE.Tail3; w2 = t;
      if (t > 0.4) { i1 = BONE.Tail2; w1 = 1 - (t - 0.4) / 0.6; i2 = BONE.Tail3; w2 = (t - 0.4) / 0.6; }
    } else if (z < -0.55) {
      // 后躯：Pelvis ↔ Mid
      const t = (z + 1.25) / 0.7; // -1.25→0, -0.55→1
      i1 = BONE.Pelvis; w1 = 1 - t; i2 = BONE.Mid; w2 = t;
    } else if (z < 0.0) {
      // 腰腹：Pelvis/Mid 混合偏 Mid
      const t = (z + 0.55) / 0.55;
      i1 = BONE.Pelvis; w1 = 0.4 * (1 - t); i2 = BONE.Mid; w2 = 1 - w1;
    } else if (z < 0.55) {
      // 前腹：Mid ↔ Chest
      const t = z / 0.55;
      i1 = BONE.Mid; w1 = 1 - t; i2 = BONE.Chest; w2 = t;
    } else if (z < 1.0) {
      // 胸肩→颈：Chest ↔ Neck
      const t = (z - 0.55) / 0.45;
      i1 = BONE.Chest; w1 = 1 - t; i2 = BONE.Neck; w2 = t;
    } else if (z < 1.25) {
      // 颈→头：Neck ↔ Head
      const t = (z - 1.0) / 0.25;
      i1 = BONE.Neck; w1 = 1 - t; i2 = BONE.Head; w2 = t;
    } else {
      // 头/吻：Head 为主；下半给 Jaw（张嘴用）
      if (y < 1.06) { i1 = BONE.Jaw; w1 = 0.75; i2 = BONE.Head; w2 = 0.25; }
      else { i1 = BONE.Head; w1 = 0.85; i2 = BONE.Neck; w2 = 0.15; }
    }

    skinIndices[i * 4] = i1; skinIndices[i * 4 + 1] = i2;
    skinWeights[i * 4] = w1; skinWeights[i * 4 + 1] = w2;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
}

// ---------- 壳层皮毛 ----------
function makeFurNoiseTexture() {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const v = Math.random() * 255;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const FUR_LAYERS = 12;
const FUR_LEN = 0.048; // 毛尖最大外延（米）

/** 给 SkinnedMesh 克隆 layers 层壳，逐层沿法线膨胀并衰减透明度 */
function attachFurShells(group, baseMesh, geo, skeleton, noiseTex, { layers = FUR_LAYERS, lengthScale = 1 } = {}) {
  const shells = [];
  for (let i = 0; i < layers; i++) {
    const t = (i + 1) / layers; // 0..1
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      alphaMap: noiseTex,
      alphaTest: 0.08 + t * 0.55, // 越外层越稀疏
      opacity: 0.9 * (1 - t * 0.75),
      depthWrite: false,
    });
    // 顶点沿法线外扩：onBeforeCompile 注入偏移（骨骼蒙皮之后应用，毛随体动）
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFurOffset = { value: t * FUR_LEN * lengthScale };
      shader.vertexShader = "uniform float uFurOffset;\n" + shader.vertexShader
        .replace("#include <skinning_vertex>", `#include <skinning_vertex>
          transformed += normalize(objectNormal) * uFurOffset;`);
    };
    const shell = new THREE.SkinnedMesh(geo, mat);
    shell.bind(skeleton, baseMesh.bindMatrix);
    shell.castShadow = false;
    shell.renderOrder = 2 + i; // 由内向外绘制
    group.add(shell);
    shells.push(shell);
  }
  return shells;
}

export class Tiger {
  constructor(scene, config, physics) {
    this.scene = scene;
    this.config = config;
    this.group = new THREE.Group();
    this.state = "巡游";
    this.pathT = 0;
    this._speedCur = 0;
    this._pauseTimer = 14 + Math.random() * 8; // 首次驻足计时
    this._pauseLeft = 0;
    this._buildPath();
    this._buildSkinned();
    scene.add(this.group);

    // —— Cannon 刚体：躯干胶囊（球串近似），kinematic 由路径驱动 ——
    if (physics) {
      this.body = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: GROUP.TIGER,
        collisionFilterMask: GROUP.BAMBOO | GROUP.GROUND | GROUP.ROCK,
      });
      this.body.addShape(new CANNON.Sphere(0.42), new CANNON.Vec3(0, 1.0, 0.5));
      this.body.addShape(new CANNON.Sphere(0.4), new CANNON.Vec3(0, 1.0, -0.5));
      physics.addBody(this.body);
      this._physics = physics;
      const p0 = this.path.getPointAt(0);
      this.body.position.set(p0.x, groundHeight(p0.x, p0.z), p0.z);
    }
  }

  _buildSkinned() {
    const contrast = this.config.tiger.stripeContrast;
    // 1. 骨架
    const rig = buildSkeleton();
    this.bones = rig.bones;
    this.skeleton = rig.skeleton;
    this._boneByName = {};
    for (const b of this.bones) this._boneByName[b.name] = b;

    // 2. 统一网格 + 斑纹 + 权重
    const geo = buildBodyGeometry();
    paintTiger(geo, { freq: 9, belly: 0.82, contrast });
    skinAll(geo);

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0,
      flatShading: false, // 平滑着色
    });
    this.skin = new THREE.SkinnedMesh(geo, mat);
    this.skin.castShadow = true;
    this.skin.add(rig.root);
    this.skin.bind(rig.skeleton);
    this.group.add(this.skin);

    // 3. 头部细节（眼/鼻/耳挂在 Head 骨上，随骨动）
    this._buildHeadDetails();

    // 4. 壳层皮毛
    const noiseTex = makeFurNoiseTexture();
    this._furNoise = noiseTex;
    const furCfg = this.config.tiger;
    attachFurShells(this.group, this.skin, geo, rig.skeleton, noiseTex, {
      layers: Math.max(2, Math.min(24, Math.round(furCfg.furLayers ?? FUR_LAYERS))),
      lengthScale: furCfg.furLength ?? 1,
    });

    // 初始姿态
    this.group.position.set(0, 0, 0);
  }

  _buildHeadDetails() {
    const head = this._boneByName.Head;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x140f08, roughness: 0.25 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), eyeMat);
      eye.position.set(s * 0.115, 0.07, 0.1);
      head.add(eye);
      // 耳：小而圆，背黑前白（虎耳"白心"特征）
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.85 })
      );
      ear.scale.set(1, 1, 0.5);
      ear.position.set(s * 0.14, 0.17, -0.05);
      ear.rotation.z = s * -0.3;
      head.add(ear);
      const earInner = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.9 })
      );
      earInner.scale.set(1, 1, 0.4);
      earInner.position.set(s * 0.138, 0.165, 0.0);
      head.add(earInner);
    }
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.035, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x7a3b33, roughness: 0.6 })
    );
    nose.position.set(0, -0.02, 0.3);
    head.add(nose);
  }

  _buildPath() {
    const r = this.config.tiger.patrolRadius;
    const pts = [
      [-16, -8], [-8, 2], [-1, 9], [6, 12], [12, 5], [11, -6], [3, -13], [-8, -14],
    ].map(([x, z]) => new THREE.Vector3(x * r, 0, z * r));
    this.path = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.6);
    this.pathLength = this.path.getLength();
  }

  /** 每帧：grove 可为 null；传入了才做缠尾 */
  update(dt, time, grove) {
    const cfg = this.config.tiger;
    const baseSpeed = 1.15 * cfg.speed;

    // —— 行为层：巡游 / 驻足观望（内驱力计时器） ——
    let targetSpeed = baseSpeed;
    if (this._pauseLeft > 0) {
      this._pauseLeft -= dt;
      targetSpeed = 0;
      this.state = "驻足";
    } else {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pauseLeft = 2.4;
        this._pauseTimer = 16 + Math.random() * 10;
      }
      this.state = "巡游";
    }
    this._speedCur += (targetSpeed - this._speedCur) * Math.min(dt * 3, 1);
    const moving = THREE.MathUtils.clamp(this._speedCur / baseSpeed, 0, 1);

    // —— 运动层：沿巡游路径 ——
    this.pathT = (this.pathT + (this._speedCur * dt) / this.pathLength) % 1;
    const p = this.path.getPointAt(this.pathT);
    const tan = this.path.getTangentAt(this.pathT);
    const y = groundHeight(p.x, p.z);
    const ahead = this.path.getPointAt((this.pathT + 0.01) % 1);
    const slope = (groundHeight(ahead.x, ahead.z) - y) * 0.8;

    this.group.position.set(p.x, y, p.z);
    const targetYaw = Math.atan2(tan.x, tan.z);
    this.group.rotation.y += shortestAngle(this.group.rotation.y, targetYaw) * Math.min(dt * 4, 1);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, THREE.MathUtils.clamp(slope, -0.2, 0.2), 0.1);

    // 物理刚体随动：kinematic 体需要速度量才能正确推挤竹竿（限速防脉冲）
    if (this.body) {
      const bp = this.body.position;
      const inv = 1 / Math.max(dt, 1e-4);
      const vx = THREE.MathUtils.clamp((p.x - bp.x) * inv, -4, 4);
      const vz = THREE.MathUtils.clamp((p.z - bp.z) * inv, -4, 4);
      this.body.velocity.set(vx, 0, vz);
      bp.set(p.x, y, p.z);
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0);
    }

    // —— 骨骼动画 ——
    this._pose(dt, time, moving);
    // —— 尾：默认摆动 + 缠竹 ——
    this._updateTail(dt, time, grove, moving);
  }

  /** 骨骼姿态：步态（对角步态）、呼吸起伏、头颈扫视、驻足昂首 */
  _pose(dt, time, moving) {
    const B = this._boneByName;
    const gait = (this._gaitCyc = ((this._gaitCyc ?? 0) + (this._speedCur / 1.25) * dt) % 1);
    const t = time;

    // 脊椎：行进时沿体长轻微波动（S 形），呼吸浮动
    const wave = Math.sin(gait * Math.PI * 2);
    B.Pelvis.rotation.y = wave * 0.04 * moving;
    B.Mid.rotation.y = Math.sin(gait * Math.PI * 2 - 0.6) * 0.05 * moving;
    B.Chest.rotation.y = Math.sin(gait * Math.PI * 2 - 1.2) * 0.04 * moving;
    B.Root.position.y = 1.05 + Math.sin(t * 1.7) * 0.008 + Math.abs(wave) * 0.02 * moving;

    // 四肢：对角步态（左后0 → 左前0.25 → 右后0.5 → 右前0.75）
    // 猫科为趾行：前肢肘只向后弯；后肢呈 Z 形 —— 膝向前凸、飞节（踝）向后折
    // 约定 rotation.x 为正 = 腿向后摆、为负 = 向前摆
    const legs = [
      { k1: "FL1", k2: "FL2", kF: "FLFoot", phase: 0.25, front: true },
      { k1: "FR1", k2: "FR2", kF: "FRFoot", phase: 0.75, front: true },
      { k1: "BL1", k2: "BL2", kF: "BLFoot", phase: 0.0, front: false },
      { k1: "BR1", k2: "BR2", kF: "BRFoot", phase: 0.5, front: false },
    ];
    const SWING = 0.35; // 摆动期占比（支撑期 0.65，符合猫科行走占空比）
    for (const L of legs) {
      const p = ((gait + L.phase) % 1 + 1) % 1;
      let hipX, fold;
      if (p < SWING) {
        // 摆动期：腿由后向前摆（hipX +→−），关节主动折叠防爪蹭地
        const s = p / SWING;
        hipX = THREE.MathUtils.lerp(0.42, -0.48, Math.pow(s, 0.75));
        fold = Math.sin(Math.PI * s); // 0→1→0，摆动中段折叠最深
      } else {
        // 支撑期：爪钉地，腿整体由前向后蹬（hipX −→+），关节舒展
        const s = (p - SWING) / (1 - SWING);
        hipX = THREE.MathUtils.lerp(-0.48, 0.42, s);
        fold = 0;
      }
      hipX *= moving; fold *= moving;
      if (L.front) {
        // 前肢：肩前后摆；肘仅向后弯（摆动期折叠）；腕收放随爪
        B[L.k1].rotation.x = hipX * 0.65;
        B[L.k2].rotation.x = fold * 0.95;             // 肘向后折（绝不前凸）
        B[L.kF].rotation.x = fold * 0.4 - hipX * 0.25; // 腕：抬爪向后收、落地放平
      } else {
        // 后肢 Z 形：髋前后摆；膝向前凸（摆动期折叠）；飞节向后折
        B[L.k1].rotation.x = hipX * 0.55;
        B[L.k2].rotation.x = fold * 0.9;              // 膝屈曲 → 小腿后收、膝盖前凸
        B[L.kF].rotation.x = fold * 0.55;              // 飞节（踝）向后折
      }
    }

    // 头颈：巡游扫视；驻足昂首远眺
    if (this.state === "驻足") {
      B.Neck.rotation.y += (Math.sin(t * 0.9) * 0.4 - B.Neck.rotation.y) * Math.min(dt * 3, 1);
      B.Neck.rotation.x += (-0.18 - B.Neck.rotation.x) * Math.min(dt * 3, 1);
      B.Head.rotation.y += (Math.sin(t * 0.7) * 0.25 - B.Head.rotation.y) * Math.min(dt * 3, 1);
    } else {
      B.Neck.rotation.y += (Math.sin(t * 0.55) * 0.22 - B.Neck.rotation.y) * Math.min(dt * 2, 1);
      B.Neck.rotation.x += (0.03 - B.Neck.rotation.x) * Math.min(dt * 2, 1);
      B.Head.rotation.y += (Math.sin(t * 0.4) * 0.15 - B.Head.rotation.y) * Math.min(dt * 2, 1);
    }
    // 下颌：微张（呼吸）；驻足时偶发"咆哮"大张
    const roar = this.state === "驻足" && Math.sin(t * 0.8) > 0.85;
    const jawTarget = roar ? 0.45 : 0.03 + Math.sin(t * 1.7) * 0.015;
    B.Jaw.rotation.x += (jawTarget - B.Jaw.rotation.x) * Math.min(dt * 6, 1);
  }

  /** 尾：三段骨默认摆动 + 缠竹（配置 tiger.tailCurl 可开关） */
  _updateTail(dt, time, grove, moving) {
    const B = this._boneByName;
    // 默认：向两侧缓摆，随步态加速
    const swayT = time * (1.2 + moving * 1.2);
    let t1y = Math.sin(swayT) * 0.35;
    let t2y = Math.sin(swayT - 0.7) * 0.45;
    let t3y = Math.sin(swayT - 1.4) * 0.5;
    let t1x = 0.28 + Math.sin(swayT * 0.5) * 0.08; // 尾根上扬（趾行虎尾不拖地）

    // 缠竹：虎身侧后有竹时，尾尖卷向竹竿
    let curl = null;
    if (grove && this.config.tiger.tailCurl) {
      const hit = grove.nearestTo(this.group.position, 1.75);
      if (hit) {
        const b = hit.bamboo;
        const local = this.group.worldToLocal(new THREE.Vector3(b.x, b.baseY, b.z));
        if (local.z < 0.3 && local.z > -2.2 && Math.abs(local.x) < 1.4) {
          curl = { w: THREE.MathUtils.smoothstep(1.75 - hit.dist, 0, 0.9), side: Math.sign(local.x) || 1 };
        }
      }
    }
    this._curlW = THREE.MathUtils.lerp(this._curlW ?? 0, curl ? curl.w : 0, Math.min(dt * 5, 1));
    const w = this._curlW;
    if (w > 0.02 && curl) {
      // 尾中后段向竹侧卷（角速度目标直接叠加）
      t1y = THREE.MathUtils.lerp(t1y, curl.side * 0.6, w * 0.5);
      t2y = THREE.MathUtils.lerp(t2y, curl.side * 1.6, w);
      t3y = THREE.MathUtils.lerp(t3y, curl.side * 2.2, w);
    } else if (w > 0.02 && this._lastCurlSide) {
      t2y = THREE.MathUtils.lerp(t2y, this._lastCurlSide * 1.6, w);
      t3y = THREE.MathUtils.lerp(t3y, this._lastCurlSide * 2.2, w);
    }
    if (curl) this._lastCurlSide = curl.side;

    B.Tail1.rotation.y = t1y;
    B.Tail2.rotation.y = t2y;
    B.Tail3.rotation.y = t3y;
    B.Tail1.rotation.x = t1x;
  }
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
