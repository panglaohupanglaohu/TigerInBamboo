// =====================================================================
//  赤道风暴积雨云墙 · createDynamicMoebiusClouds()（暴风雨重构版）
//
//  1) 高频流体顶点形变（Vertex-level Fluid Morphing）：
//     每帧遍历每颗 Icosahedron(细分 2 → 焊接 92 顶点) 的顶点，
//     用时间高频加权的 3D 噪声沿法线暴力推拉：
//       noiseVal = sin(v.x·0.4 + t·2.5) · cos(v.z·0.4 + t·2.5) · sin(v.y·0.2 + t·1.5)
//     + 次级撕裂八度 → 形体快速撕裂、拉伸、翻滚，彻底击碎岩石感。
//     （CPU 形变 → addOutline 描边共享同一几何体，墨线随撕扯同步甩动，
//       零延迟、绝不穿模。）
//  2) 阴雨暗流材质：逐切面 dot(flatNormal, sunDir)——
//     凹陷背光 = 乌云深蓝灰(#2C3E50/#34495E)，受光突起 = 浅灰(#BDC3C7)
//     + 闪电发光脉冲（随机频闪的自发光暖白），高频交错闪烁。
//  3) 云底倾泻雨带：嵌套绑定在云墙组内的手绘斜向雨丝粒子带，
//     从云体底部直接砸向地表（与全局天气系统同一视觉语言，云锚定）。
//  4) 赤道环形锚定：Phi = π/2 每 15° 一座火山口积雨云塔，高低错落。
// =====================================================================
import * as THREE from "three";
import { addOutline, INK_COLOR } from "../assets/toon.js";
import { quatYToDir } from "./sphereMath.js";

/* ---------------- 暴风雨调色板 ---------------- */
const STORM_DARK = 0x2c3e50; // 阴雨核心：乌云深蓝灰
const STORM_MID = 0x34495e; // 云体主体蓝灰
const STORM_LIT = 0xbdc3c7; // 受光突起：闪电感光浅灰
const STORM_FLASH = 0xd8dee6; // 闪电自发光色（微暖白）
const OUTLINE_THICK = 0.02;
const OUTLINE_DRY = 0.06;

/* ---------------- 赤道环布参数 ---------------- */
const TOWERS = 24; // 每 15° 一座
const THETA_JITTER_DEG = 9;
const RADIUS_MIN = 45; // 云底半径（距球面 5）
const RADIUS_MAX = 50; // （距球面 10）

/* ---------------- 形变 / 雨带参数 ---------------- */
const CLOUD_DETAIL = 2; // 细分（焊接后 92 唯一顶点）
const DEFORM_STRIDE = 1; // 风暴模式：全群每帧形变（高频撕扯需要 60Hz）
const RAIN_COUNT = 800; // 雨丝数量
const RAIN_TOP = 45.2; // 雨带顶（云底）
const RAIN_FLOOR = 40.3; // 雨带底（地表之上）
const RAIN_BAND_Y = 2.3; // 雨带在赤道面上下厚度

/* ---------------- 龙卷风（随机吹开云墙） ---------------- */
const TORNADO_CHANCE = 1 / 3; // 每次生成判定的概率（主人指定 1/3）
const TORNADO_CHECK_SEC = 2.0; // 每隔多久做一次生成判定
const TORNADO_MAX = 3; // 同屏最多龙卷风数
const TORNADO_OPEN_SEC = 1.0; // 吹开云墙（云团外散）时长
const TORNADO_HOLD_SEC = 2.6; // 漏斗旋转保持时长
const TORNADO_CLOSE_SEC = 1.3; // 云墙合拢时长
const TORNADO_SCATTER = 7.5; // 云团被吹开的横向距离

let _cloudGradient = null;

/** 3 阶灰度梯度图：Nearest 采样锁死明暗交界（连环画硬边） */
export function getCloudGradient() {
  if (_cloudGradient) return _cloudGradient;
  const data = new Uint8Array([72, 178, 255]);
  _cloudGradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  _cloudGradient.minFilter = THREE.NearestFilter;
  _cloudGradient.magFilter = THREE.NearestFilter;
  _cloudGradient.generateMipmaps = false;
  _cloudGradient.needsUpdate = true;
  return _cloudGradient;
}

/* =====================================================================
 *  暴风雨材质：乌云暗部 ↔ 闪电亮面 · 逐切面高频交错
 * ===================================================================== */
let _cloudMat = null;
let _cloudUniforms = null;

function getStormCloudMaterial() {
  if (_cloudMat) return _cloudMat;
  const mat = new THREE.MeshToonMaterial({
    color: 0xffffff, // 片元内按切面朝向重写
    gradientMap: getCloudGradient(), // 亮度走 3 阶硬边分带
  });
  mat.flatShading = true; // 低多边形分面 + 逐切面法线（形变时法线高频变化）
  mat.needsUpdate = true;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCloudSunDir = { value: new THREE.Vector3(0.5, 0.8, 0.3) };
    shader.uniforms.uStormDark = { value: new THREE.Color(STORM_DARK) };
    shader.uniforms.uStormMid = { value: new THREE.Color(STORM_MID) };
    shader.uniforms.uStormLit = { value: new THREE.Color(STORM_LIT) };
    shader.uniforms.uFlashColor = { value: new THREE.Color(STORM_FLASH) };
    shader.uniforms.uCloudGlow = { value: 0.07 };
    _cloudUniforms = shader.uniforms;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 uCloudSunDir;
uniform vec3 uStormDark;
uniform vec3 uStormMid;
uniform vec3 uStormLit;
uniform vec3 uFlashColor;
uniform float uCloudGlow;
void main() {`
      )
      // flat 法线就绪后：两段式对冲 —— 凹陷背光沉淀为乌云深蓝灰，
      // 受光突起 lerp 向闪电感光浅灰；形变令法线高频变化 → 切面闪烁
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
  vec3 cSunV = normalize((viewMatrix * vec4(uCloudSunDir, 0.0)).xyz);
  float cNdL = dot(normal, cSunV);
  vec3 cStorm = mix(uStormDark, uStormMid, smoothstep(-0.62, -0.08, cNdL));
  cStorm = mix(cStorm, uStormLit, smoothstep(0.06, 0.58, cNdL));
  diffuseColor.rgb = cStorm;`
      )
      // 闪电发光：受光面自发光脉冲（uCloudGlow 由主循环随机频闪驱动）
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += uFlashColor * pow(clamp(cNdL, 0.0, 1.0), 1.5) * uCloudGlow;`
      );
  };

  _cloudMat = mat;
  return mat;
}

/* =====================================================================
 *  几何：Icosahedron → 焊接为唯一顶点索引网格
 *  @param {number} radius
 *  @param {number} [detail] 细分级；缺省 CLOUD_DETAIL(2)=92 顶点。
 *         detail 4 ≈ 3 倍面数（细腻云体用）
 * ===================================================================== */
export function weldIcosahedron(radius, detail = CLOUD_DETAIL) {
  const src = new THREE.IcosahedronGeometry(radius, detail);
  const pos = src.attributes.position;
  const map = new Map();
  const verts = [];
  const indices = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)}_${Math.round(y * 1e4)}_${Math.round(z * 1e4)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = verts.length / 3;
      map.set(key, idx);
      verts.push(x, y, z);
    }
    indices.push(idx);
  }
  src.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  // 球面 → 径向平滑法线：形变方向源 + 描边外扩方向；此后不再重算
  geo.computeVertexNormals();
  geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius *= 1.45; // 暴力形变余量，防视锥误裁
  return geo;
}

/* =====================================================================
 *  单颗云球：焊接球体 + 风暴形变参数 + 水墨勾线
 * ===================================================================== */
function puff(tower, material, blobs, radius, squash, x, y, z, rnd) {
  const geo = weldIcosahedron(radius);
  const blob = new THREE.Mesh(geo, material);
  blob.position.set(x, y, z);
  blob.scale.set(1, squash, 1);
  blob.rotation.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * 0.6);
  blob.userData.deform = {
    orig: geo.attributes.position.array.slice(), // 静止形态快照
    seed: rnd() * 100, // 相位去同步：塔内颗颗不同频
    // 振幅随半径缩放（规格 0.35 基准）：大云团翻涌、小云团暴烈
    amp: 0.35 * (0.5 + radius * 0.28),
    speed: 0.85 + rnd() * 0.3, // time 乘数微扰，防整塔同步脉动
  };
  // 描边共享同一几何引用 → 随高频形变同步甩动，绝不延迟穿模
  addOutline(blob, OUTLINE_THICK, INK_COLOR, OUTLINE_DRY);
  tower.add(blob);
  blobs.push(blob);
  return blob;
}

/* =====================================================================
 *  火山口积雨云塔：底盘大而扁 → 中段渐宽 → 顶部喷涌
 * ===================================================================== */
export function createStormCloudTower(material, rnd = Math.random) {
  const tower = new THREE.Group();
  tower.name = "cloud-tower";
  const blobs = [];

  const n = 30 + Math.floor(rnd() * 9); // 30–38 颗 + 云冠核心
  let y = 0;
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    let radius, spread, squash, step;
    if (p < 0.28) {
      // 底盘：极大、压扁
      radius = 3.0 + rnd() * 1.8;
      spread = 3.2 + rnd() * 1.6;
      squash = 0.4 + rnd() * 0.16;
      step = 0.5 + rnd() * 0.3;
    } else if (p < 0.6) {
      // 中段：渐宽蓄力柱
      const k = (p - 0.28) / 0.32;
      radius = 2.2 + rnd() * 1.2;
      spread = 2.6 + k * 1.8 + rnd() * 0.6;
      squash = 0.62 + rnd() * 0.2;
      step = 0.62 + rnd() * 0.34;
    } else {
      // 云冠：宽大团块喷涌
      radius = 3.0 + rnd() * 1.9;
      spread = 3.0 + rnd() * 1.7;
      squash = 0.58 + rnd() * 0.2;
      step = 0.6 + rnd() * 0.34;
    }
    y += step;
    const ang = rnd() * Math.PI * 2;
    puff(tower, material, blobs, radius, squash, Math.cos(ang) * spread, y, Math.sin(ang) * spread, rnd);
  }

  // 火山口核心
  const coreR = 4.2 + rnd() * 1.3;
  puff(
    tower,
    material,
    blobs,
    coreR,
    0.6,
    (rnd() - 0.5) * 1.4,
    y + coreR * 0.42,
    (rnd() - 0.5) * 1.4,
    rnd
  );

  tower.userData.blobs = blobs;
  return tower;
}

/* =====================================================================
 *  云底倾泻雨带（嵌套绑定在云墙组内 · 手绘斜向雨丝）
 * ===================================================================== */
function buildStormRain(group, rnd) {
  const positions = new Float32Array(RAIN_COUNT * 6);
  const streaks = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    const theta = rnd() * Math.PI * 2;
    streaks.push({
      dx: Math.cos(theta), // 径向单位（赤道面内）
      dz: Math.sin(theta),
      // 切向（雨丝斜向 = 风暴风向）
      tx: -Math.sin(theta),
      tz: Math.cos(theta),
      y: (rnd() - 0.5) * 2 * RAIN_BAND_Y, // 赤道面上下厚度
      len: 1.2 + rnd() * 1.1, // 雨丝长
      slant: 0.3 + rnd() * 0.35, // 斜切量
      speed: 6 + rnd() * 3.5, // 坠落速度
      phase: rnd() * (RAIN_TOP - RAIN_FLOOR), // 循环相位
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0x7d95ad, transparent: true, opacity: 0.5 })
  );
  rain.name = "storm-rain";
  rain.frustumCulled = false; // 环带横跨视锥，禁误裁
  group.add(rain);
  group.userData.rain = rain;
  group.userData.rainStreaks = streaks;
}

/** 每帧驱动雨丝坠落（径向落向地表 · 循环回绕） */
function updateStormRain(group, t) {
  const rain = group.userData.rain;
  const streaks = group.userData.rainStreaks;
  if (!rain || !streaks) return;
  const arr = rain.geometry.attributes.position.array;
  const span = RAIN_TOP - RAIN_FLOOR;
  for (let i = 0; i < streaks.length; i++) {
    const s = streaks[i];
    // 雨顶半径：从云底向地表循环坠落
    const rTop = RAIN_TOP - ((t * s.speed + s.phase) % span);
    const rBot = rTop - s.len;
    const o = i * 6;
    arr[o] = s.dx * rTop;
    arr[o + 1] = s.y;
    arr[o + 2] = s.dz * rTop;
    arr[o + 3] = s.dx * rBot + s.tx * s.slant; // 斜向收尾（手绘风丝）
    arr[o + 4] = s.y;
    arr[o + 5] = s.dz * rBot + s.tz * s.slant;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}

/* =====================================================================
 *  赤道环形部署
 * ===================================================================== */
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _sunDir = new THREE.Vector3();

/**
 * 横跨整条赤道线的风暴积雨云墙（直接挂入全局场景）。
 * @param {THREE.Scene} scene
 * @param {number} [planetRadius=40]
 * @returns {THREE.Group} equatorialClouds
 */
export function createDynamicMoebiusClouds(scene, planetRadius = 40) {
  const group = new THREE.Group();
  group.name = "equatorialClouds";

  const material = getStormCloudMaterial();
  const blobs = [];
  const towers = [];

  for (let i = 0; i < TOWERS; i++) {
    const theta =
      (i / TOWERS) * Math.PI * 2 +
      (Math.random() - 0.5) * THREE.MathUtils.degToRad(THETA_JITTER_DEG);
    const radius = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
    _dir.set(Math.cos(theta), 0, Math.sin(theta)); // 赤道方向（Phi = π/2）

    const tower = createStormCloudTower(material, Math.random);
    tower.position.copy(_dir).multiplyScalar(radius);
    tower.quaternion.copy(quatYToDir(_dir, _q)); // 局部 +Y = 球面法线
    tower.rotateY(Math.random() * Math.PI * 2);
    tower.scale.setScalar(0.8 + Math.random() * 0.35);
    group.add(tower);
    towers.push(tower);
    for (const b of tower.userData.blobs) blobs.push(b);
  }

  buildStormRain(group, Math.random);

  group.userData.blobs = blobs;
  group.userData.towers = towers;
  group.userData.planetRadius = planetRadius;
  group.userData.frame = 0;
  group.userData.uniforms = () => _cloudUniforms; // 首次编译后可用
  group.userData.storm = { flash: 0, next: 2.5, lastT: 0 }; // 闪电频闪状态
  // 龙卷风状态
  group.userData.tornadoes = [];
  group.userData.nextTornadoCheck = 0;
  group.userData.lastT = 0;
  scene.add(group);
  return group;
}

/* =====================================================================
 *  每帧驱动：高频流体形变 + 太阳受光 + 闪电频闪 + 雨带倾泻
 * ===================================================================== */

/**
 * 单颗云球流体形变：时间高频加权 3D 噪声沿法线暴力推拉。
 * 主项 = 规格公式 sin(x·0.4+t·2.5)·cos(z·0.4+t·2.5)·sin(y·0.2+t·1.5)，
 * 次级撕裂八度制造快速撕扯凹陷。
 */
export function deformBlob(blob, t) {
  const d = blob.userData.deform;
  const attr = blob.geometry.attributes.position;
  const arr = attr.array;
  const orig = d.orig;
  const na = blob.geometry.attributes.normal.array;
  const T = t * d.speed + d.seed;
  const amp = d.amp;

  for (let i = 0; i < arr.length; i += 3) {
    const ox = orig[i];
    const oy = orig[i + 1];
    const oz = orig[i + 2];
    // 高频流体噪声（规格公式）：沸腾撕扯的主形变场
    const noiseVal =
      Math.sin(ox * 0.4 + T * 2.5) *
      Math.cos(oz * 0.4 + T * 2.5) *
      Math.sin(oy * 0.2 + T * 1.5);
    // 次级撕裂八度：短波长高频，制造快速拉伸与凹陷
    const tear =
      Math.sin(ox * 0.9 + oz * 0.7 + T * 3.4) * Math.sin(oy * 0.8 - T * 2.9) * 0.38;
    const disp = (noiseVal + tear) * amp;
    arr[i] = ox + na[i] * disp;
    arr[i + 1] = oy + na[i + 1] * disp;
    arr[i + 2] = oz + na[i + 2] * disp;
  }
  attr.needsUpdate = true;
}

/* =====================================================================
 *  龙卷风：随机在云墙上"吹开"一个缺口
 *  - 概率 = TORNADO_CHANCE（1/3），每 TORNADO_CHECK_SEC 判定一次
 *  - 漏斗作为云塔子节点（继承朝向：局部 +Y = 外径向），从云底向地面伸出
 *  - 吹开 = 该塔云球沿"远离漏斗轴（局部 Y 轴）"方向外散，让出缺口；
 *    漏斗高速旋转；随后云球归位、云墙合拢。
 * ===================================================================== */
let _funnelMat = null;
function getFunnelMaterial() {
  if (_funnelMat) return _funnelMat;
  const mat = new THREE.MeshToonMaterial({
    color: STORM_MID,
    gradientMap: getCloudGradient(),
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  mat.flatShading = true;
  mat.needsUpdate = true;
  _funnelMat = mat;
  return mat;
}

/** 上宽下窄漏斗；局部 +Y = 轴向（宽口端在 y=0），沿 -Y 朝地面收窄 */
function makeTornadoFunnel() {
  const geo = new THREE.CylinderGeometry(4.0, 0.9, 9, 18, 5, true);
  geo.translate(0, -4.5, 0); // 宽口 y=0（云底），窄口 y=-9（朝地面）
  const funnel = new THREE.Mesh(geo, getFunnelMaterial());
  addOutline(funnel, 0.03, INK_COLOR, 0.05);
  return funnel;
}

/** 在 towerIndex 处生成一朵龙卷风，吹开该塔云墙 */
function spawnWallTornado(group, towerIndex) {
  const tower = group.userData.towers[towerIndex];
  if (!tower) return;
  const funnel = makeTornadoFunnel();
  funnel.scale.setScalar(0.01);
  tower.add(funnel); // 继承云塔朝向（局部 +Y = 外径向）

  // 记录每颗云球：基准位 → 吹开位（远离漏斗轴 = 局部 Y 轴的横向）
  const blobStates = [];
  for (const blob of tower.userData.blobs) {
    const base = blob.position.clone();
    let dirX = base.x;
    let dirZ = base.z;
    const horiz = Math.hypot(dirX, dirZ);
    if (horiz < 0.3) {
      const ra = Math.random() * Math.PI * 2; // 轴上云球：随机横向
      dirX = Math.cos(ra);
      dirZ = Math.sin(ra);
    } else {
      dirX /= horiz;
      dirZ /= horiz;
    }
    const dist = TORNADO_SCATTER * (0.7 + Math.random() * 0.6);
    const scatter = base
      .clone()
      .add(new THREE.Vector3(dirX * dist, (Math.random() - 0.3) * 3, dirZ * dist));
    blobStates.push({ blob, base, scatter });
  }

  group.userData.tornadoes.push({
    tower,
    towerIndex,
    funnel,
    blobStates,
    state: "open",
    stateT: 0,
    disposed: false,
  });
}

function disposeWallTornado(group, tor) {
  if (tor.disposed) return;
  tor.disposed = true;
  for (const s of tor.blobStates) s.blob.position.copy(s.base); // 云球归位
  tor.funnel.geometry.dispose();
  tor.tower.remove(tor.funnel);
}

/** 每帧：龙卷风状态机推进 + 概率生成 */
function updateWallTornadoes(group, t, dt) {
  const tornadoes = group.userData.tornadoes;

  // ---------- 概率生成：每 TORNADO_CHECK_SEC 以 TORNADO_CHANCE 掷一次 ----------
  if (t >= group.userData.nextTornadoCheck) {
    group.userData.nextTornadoCheck = t + TORNADO_CHECK_SEC;
    if (tornadoes.length < TORNADO_MAX && Math.random() < TORNADO_CHANCE) {
      const towers = group.userData.towers;
      const tornSet = new Set(tornadoes.map((x) => x.towerIndex));
      const candidates = [];
      for (let i = 0; i < towers.length; i++) if (!tornSet.has(i)) candidates.push(i);
      if (candidates.length) {
        spawnWallTornado(group, candidates[(Math.random() * candidates.length) | 0]);
      }
    }
  }

  // ---------- 状态机 ----------
  for (const tor of tornadoes) {
    if (tor.disposed) continue;
    tor.stateT += dt;
    const funnel = tor.funnel;

    if (tor.state === "open") {
      // 吹开云墙：云球基准位 → 吹开位，漏斗生长
      const k = Math.min(1, tor.stateT / TORNADO_OPEN_SEC);
      const e = k * k * (3 - 2 * k);
      for (const s of tor.blobStates) s.blob.position.lerpVectors(s.base, s.scatter, e);
      funnel.scale.setScalar(0.01 + e * 0.99);
      funnel.rotation.y += dt * (6 + e * 8);
      if (tor.stateT >= TORNADO_OPEN_SEC) {
        tor.state = "hold";
        tor.stateT = 0;
      }
    } else if (tor.state === "hold") {
      // 高速旋转蓄力
      funnel.rotation.y += dt * 15;
      funnel.scale.setScalar(1 + Math.sin(tor.stateT * 13) * 0.05);
      if (tor.stateT >= TORNADO_HOLD_SEC) {
        tor.state = "close";
        tor.stateT = 0;
      }
    } else if (tor.state === "close") {
      // 云墙合拢：云球归位，漏斗收缩
      const k = Math.min(1, tor.stateT / TORNADO_CLOSE_SEC);
      const e = k * k * (3 - 2 * k);
      for (const s of tor.blobStates) s.blob.position.lerpVectors(s.scatter, s.base, e);
      funnel.scale.setScalar(Math.max(0.01, 1 - e));
      funnel.rotation.y += dt * (15 - e * 10);
      if (tor.stateT >= TORNADO_CLOSE_SEC) {
        disposeWallTornado(group, tor);
      }
    }
  }
  group.userData.tornadoes = tornadoes.filter((x) => !x.disposed);
}

/**
 * 每帧更新。
 * @param {THREE.Group} group createDynamicMoebiusClouds 返回值
 * @param {number} t 全局时间（秒）
 * @param {THREE.DirectionalLight} [sun] 场景太阳
 */
export function updateDynamicMoebiusClouds(group, t, sun) {
  if (!group) return;
  const dt = THREE.MathUtils.clamp(t - (group.userData.lastT || t), 0, 0.1);
  group.userData.lastT = t;

  // ---------- 太阳方向 + 闪电频闪 ----------
  const uni = group.userData.uniforms?.();
  if (uni && sun) {
    _sunDir.copy(sun.position).normalize();
    uni.uCloudSunDir.value.copy(_sunDir);
  }
  const storm = group.userData.storm;
  if (uni && storm) {
    if (t >= storm.next) {
      // 一道闪电：自发光脉冲，随后指数衰减；间隔 3–9s 随机
      storm.flash = 0.45 + Math.random() * 0.3;
      storm.next = t + 3 + Math.random() * 6;
    }
    storm.flash *= Math.exp(-6.5 * dt);
    uni.uCloudGlow.value = 0.07 + storm.flash;
  }

  // ---------- 龙卷风：随机吹开云墙 ----------
  updateWallTornadoes(group, t, dt);

  // ---------- 雨带倾泻 ----------
  updateStormRain(group, t);

  // ---------- 高频流体形变（风暴模式全群每帧） ----------
  const blobs = group.userData.blobs;
  const frame = ++group.userData.frame;
  for (let bi = 0; bi < blobs.length; bi++) {
    if ((bi + frame) % DEFORM_STRIDE !== 0) continue;
    deformBlob(blobs[bi], t);
  }
}
