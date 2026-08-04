// =====================================================================
//  赤道风暴积雨云墙 · createDynamicMoebiusClouds()（GPU 形变合并版）
//
//  性能重构：每塔 30+ 颗云球合并为「单一网格 + 单一描边壳」，
//  整墙 draw call 从 ~1700 降到 48；形变/滚动/龙卷风吹开全部移入
//  顶点着色器（逐顶点属性 + 全局 uTime + 逐塔 uScatterK），
//  CPU 每帧零形变、零 buffer 上传。
//
//  视觉规格沿用风起云涌版：
//  1) 大跨度低频 3D 噪声宏观形变（time*0.4 / v*0.15 海浪级起伏）
//  2) 切线环形滚动（rotation.x = t*rollX + rotation.z 弱摇摆）
//  3) 阴雨暗流冷暖对冲材质（凹陷深蓝灰 ↔ 迎光暖橘，硬边分带）
//  4) 云底阴雨粒子带（手绘斜向雨丝倾泻）
//  5) 龙卷风随机吹开云墙（概率 1/3，云团横向外散让出缺口）
//  6) 相机进入云塔包围球时隐藏整塔（防乘航空艇穿云画面全黑）
// =====================================================================
import * as THREE from "three";
import { addOutline, INK_COLOR } from "../assets/toon.js";
import { quatYToDir } from "./sphereMath.js";

/* ---------------- 暴风雨调色板 ---------------- */
const STORM_DARK = 0x2c3e50; // 阴雨核心：乌云深蓝灰（凹陷暗流）
const STORM_MID = 0x34495e; // 云体主体蓝灰（过渡）
const STORM_LIT = 0xbdc3c7; // 受光突起：闪电感光浅灰
const STORM_WARM = 0xd9b38c; // 迎光暖橘
const STORM_FLASH = 0xd8dee6; // 闪电自发光色（微暖白）
const OUTLINE_THICK = 0.02;
const OUTLINE_DRY = 0.06;

/* ---------------- 赤道环布参数 ---------------- */
const TOWERS = 24; // 每 15° 一座
const THETA_JITTER_DEG = 9;
const RADIUS_MIN = 45; // 云底半径（距球面 5）
const RADIUS_MAX = 50; // （距球面 10）

/* ---------------- 形变 / 雨带参数 ---------------- */
const CLOUD_DETAIL = 2; // 细分（焊接后 162 唯一顶点）
const RAIN_COUNT = 1400; // 雨丝数量（密密麻麻）
const RAIN_TOP = 45.0; // 雨带顶（紧贴滚动乌云底）
const RAIN_FLOOR = 39.0; // 雨带底
const RAIN_BAND_Y = 2.6; // 雨带在赤道面上下厚度
const RAIN_COLOR = 0x10141a; // 近黑手绘雨丝

/* ---------------- 龙卷风（随机吹开云墙） ---------------- */
const TORNADO_CHANCE = 1 / 3;
const TORNADO_CHECK_SEC = 2.0;
const TORNADO_MAX = 3;
const TORNADO_OPEN_SEC = 1.0;
const TORNADO_HOLD_SEC = 2.6;
const TORNADO_CLOSE_SEC = 1.3;
const TORNADO_SCATTER = 7.5;

/* ---------------- 相机穿云隐藏（仅相机真正进入云团体积时） ---------------- */
const HIDE_CENTER_K = 12; // 包围球中心 = 塔基 + 径向 * 12*scale
const HIDE_RADIUS_K = 14; // 包围球半径 = 14*scale（云球体积内才隐藏）
const BOUND_MARGIN = 20; // 视锥包围球余量（形变 ±8 + 吹开 ~11）

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
 *  共享 uniform：uTime 全局时间 / uScatterK 逐塔吹开强度
 * ===================================================================== */
const uTimeU = { value: 0 };
const uScatterU = { value: 0 };

/* ---------------- GPU 形变 GLSL（body 与描边共用） ---------------- */
const DEFORM_DECLS = `
uniform float uTime;
uniform float uScatterK;
attribute vec3 aOrig;
attribute vec3 aCenter;
attribute vec4 aRot;
attribute vec4 aMisc;
`;
// 与旧 CPU 版逐位对应：wave/breathe → 缩放 → Rz→Ry→Rx 滚动 → 塔内平移 → 吹开
const DEFORM_BODY = `
  float cT = uTime * aMisc.z + aMisc.x;
  float cTS = cT * 0.4;
  float cWave = sin(aOrig.x * 0.15 + cTS) * cos(aOrig.z * 0.15 + cTS) * 1.5;
  float cBreath = sin(aOrig.y * 0.12 + cTS * 0.7) * 0.9;
  vec3 cLocal = aOrig + normal * ((cWave + cBreath) * aMisc.y);
  cLocal.y *= aMisc.w;
  float cAX = uTime * aRot.x;
  float cAZ = sin(uTime * 0.2 + aRot.z) * aRot.w;
  float cX = cos(cAX), sX = sin(cAX);
  float cY = cos(aRot.y), sY = sin(aRot.y);
  float cZ = cos(cAZ), sZ = sin(cAZ);
  vec3 cQ = cLocal;
  cQ = vec3(cZ*cQ.x - sZ*cQ.y, sZ*cQ.x + cZ*cQ.y, cQ.z);
  cQ = vec3(cY*cQ.x + sY*cQ.z, cQ.y, -sY*cQ.x + cY*cQ.z);
  cQ = vec3(cQ.x, cX*cQ.y - sX*cQ.z, sX*cQ.y + cX*cQ.z);
  vec2 cH = aCenter.xz;
  float cHL = length(cH);
  vec2 cDir = cHL > 0.3 ? cH / cHL : vec2(cos(aMisc.x * 7.13), sin(aMisc.x * 7.13));
  float cRand = fract(sin(aMisc.x * 91.7) * 43758.5453);
  cQ += vec3(cDir.x, 0.0, cDir.y) * (uScatterK * ${TORNADO_SCATTER.toFixed(1)} * (0.7 + cRand * 0.6));
  cQ.y += uScatterK * (fract(cRand * 7.31) - 0.3) * 3.0;
  transformed = cQ + aCenter;
`;
// 描边壳：同形变 + 沿滚动后法线外扩（提按笔宽）
const DEFORM_OUTLINE = `
  vec3 cN = normal;
  cN = vec3(cZ*cN.x - sZ*cN.y, sZ*cN.x + cZ*cN.y, cN.z);
  cN = vec3(cY*cN.x + sY*cN.z, cN.y, -sY*cN.x + cY*cN.z);
  cN = vec3(cN.x, cX*cN.y - sX*cN.z, sX*cN.y + cX*cN.z);
  vBrushPos = position;
  float cHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  transformed += cN * (${OUTLINE_THICK.toFixed(4)} * (0.65 + 0.6 * cHash));
`;

/* =====================================================================
 *  暴风雨材质：乌云暗部 ↔ 闪电亮面 · 逐切面高频交错
 * ===================================================================== */
let _cloudMat = null;
let _cloudUniforms = null;

function getStormCloudMaterial() {
  if (_cloudMat) return _cloudMat;
  const mat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: getCloudGradient(),
  });
  mat.flatShading = true;
  mat.needsUpdate = true;
  mat.customProgramCacheKey = () => "storm-cloud-v2";

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCloudSunDir = { value: new THREE.Vector3(0.5, 0.8, 0.3) };
    shader.uniforms.uStormDark = { value: new THREE.Color(STORM_DARK) };
    shader.uniforms.uStormMid = { value: new THREE.Color(STORM_MID) };
    shader.uniforms.uStormLit = { value: new THREE.Color(STORM_LIT) };
    shader.uniforms.uStormWarm = { value: new THREE.Color(STORM_WARM) };
    shader.uniforms.uFlashColor = { value: new THREE.Color(STORM_FLASH) };
    shader.uniforms.uCloudGlow = { value: 0.07 };
    shader.uniforms.uTime = uTimeU;
    shader.uniforms.uScatterK = uScatterU;
    _cloudUniforms = shader.uniforms;

    shader.vertexShader = shader.vertexShader
      .replace("void main() {", DEFORM_DECLS + "\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + DEFORM_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 uCloudSunDir;
uniform vec3 uStormDark;
uniform vec3 uStormMid;
uniform vec3 uStormLit;
uniform vec3 uStormWarm;
uniform vec3 uFlashColor;
uniform float uCloudGlow;
void main() {`
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
  vec3 cSunV = normalize((viewMatrix * vec4(uCloudSunDir, 0.0)).xyz);
  float cNdL = dot(normal, cSunV);
  vec3 cStorm = mix(uStormDark, uStormMid, smoothstep(-0.7, -0.1, cNdL));
  cStorm = mix(cStorm, uStormLit, smoothstep(0.04, 0.42, cNdL));
  cStorm = mix(cStorm, uStormWarm, smoothstep(0.42, 0.74, cNdL));
  diffuseColor.rgb = cStorm;`
      )
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
 *  云墙专用描边材质：反向壳 + 飞白 + GPU 形变同步
 * ===================================================================== */
let _stormOutlineMat = null;

function getStormOutlineMaterial() {
  if (_stormOutlineMat) return _stormOutlineMat;
  const mat = new THREE.MeshBasicMaterial({ color: INK_COLOR, side: THREE.BackSide });
  mat.customProgramCacheKey = () => "storm-cloud-outline-v2";
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeU;
    shader.uniforms.uScatterK = uScatterU;
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        DEFORM_DECLS + "varying vec3 vBrushPos;\nvoid main() {"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + DEFORM_BODY + DEFORM_OUTLINE
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying vec3 vBrushPos;\nvoid main() {")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
  float tmDry = fract(sin(dot(floor(vBrushPos * 36.0).xy, vec2(12.9898, 78.233))) * 43758.5453);
  if (tmDry < ${OUTLINE_DRY.toFixed(3)}) discard;`
      );
  };
  _stormOutlineMat = mat;
  return mat;
}

/* =====================================================================
 *  几何：Icosahedron → 焊接为唯一顶点索引网格（供 lifecycle 复用）
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
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* =====================================================================
 *  单塔合并几何：所有云球烘焙进一个索引网格 + 逐顶点形变属性
 * ===================================================================== */
function buildTowerGeometry(rnd) {
  const positions = [];
  const normals = [];
  const origs = [];
  const centers = [];
  const rots = [];
  const miscs = [];
  const indices = [];
  let vOff = 0;

  function pushBlob(radius, squash, x, y, z) {
    const src = weldIcosahedron(radius);
    const p = src.attributes.position;
    const nrm = src.attributes.normal;
    const idx = src.index;

    const seed = rnd() * 100;
    const amp = 1.1 + radius * 0.42;
    const speed = 0.9 + rnd() * 0.2;
    const rollX = 0.12 + rnd() * 0.06;
    const ry = rnd() * Math.PI * 2;
    const rollZPhase = rnd() * Math.PI * 2;
    const rollZSeed = 0.08 + rnd() * 0.05;

    for (let i = 0; i < p.count; i++) {
      const ox = p.getX(i);
      const oy = p.getY(i);
      const oz = p.getZ(i);
      // 烘焙仅含平移 + Y 向压扁（滚动/形变全部在 GPU）
      positions.push(x + ox, y + oy * squash, z + oz);
      normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      origs.push(ox, oy, oz);
      centers.push(x, y, z);
      rots.push(rollX, ry, rollZPhase, rollZSeed);
      miscs.push(seed, amp, speed, squash);
    }
    for (let j = 0; j < idx.count; j++) indices.push(idx.getX(j) + vOff);
    vOff += p.count;
    src.dispose();
  }

  // 火山口积雨云塔布局：底盘大而扁 → 中段渐宽 → 顶部喷涌
  const n = 30 + Math.floor(rnd() * 9);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    let radius, spread, squash, step;
    if (p < 0.28) {
      radius = 3.0 + rnd() * 1.8;
      spread = 3.2 + rnd() * 1.6;
      squash = 0.4 + rnd() * 0.16;
      step = 0.5 + rnd() * 0.3;
    } else if (p < 0.6) {
      const k = (p - 0.28) / 0.32;
      radius = 2.2 + rnd() * 1.2;
      spread = 2.6 + k * 1.8 + rnd() * 0.6;
      squash = 0.62 + rnd() * 0.2;
      step = 0.62 + rnd() * 0.34;
    } else {
      radius = 3.0 + rnd() * 1.9;
      spread = 3.0 + rnd() * 1.7;
      squash = 0.58 + rnd() * 0.2;
      step = 0.6 + rnd() * 0.34;
    }
    y += step;
    const ang = rnd() * Math.PI * 2;
    pushBlob(radius, squash, Math.cos(ang) * spread, y, Math.sin(ang) * spread);
  }
  // 火山口核心
  const coreR = 4.2 + rnd() * 1.3;
  pushBlob(coreR, 0.6, (rnd() - 0.5) * 1.4, y + coreR * 0.42, (rnd() - 0.5) * 1.4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("aOrig", new THREE.Float32BufferAttribute(origs, 3));
  geo.setAttribute("aCenter", new THREE.Float32BufferAttribute(centers, 3));
  geo.setAttribute("aRot", new THREE.Float32BufferAttribute(rots, 4));
  geo.setAttribute("aMisc", new THREE.Float32BufferAttribute(miscs, 4));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += BOUND_MARGIN; // 形变 + 吹开余量，防视锥误裁
  return geo;
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
      dx: Math.cos(theta),
      dz: Math.sin(theta),
      tx: -Math.sin(theta),
      tz: Math.cos(theta),
      y: (rnd() - 0.5) * 2 * RAIN_BAND_Y,
      len: 1.2 + rnd() * 1.1,
      slant: 0.3 + rnd() * 0.35,
      speed: 6 + rnd() * 3.5,
      phase: rnd() * (RAIN_TOP - RAIN_FLOOR),
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: RAIN_COLOR, transparent: true, opacity: 0.62 })
  );
  rain.name = "storm-rain";
  rain.frustumCulled = false;
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
    const rTop = RAIN_TOP - ((t * s.speed + s.phase) % span);
    const rBot = rTop - s.len;
    const o = i * 6;
    arr[o] = s.dx * rTop;
    arr[o + 1] = s.y;
    arr[o + 2] = s.dz * rTop;
    arr[o + 3] = s.dx * rBot + s.tx * s.slant;
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
const _camPos = new THREE.Vector3();
const _sphereC = new THREE.Vector3();

export function createDynamicMoebiusClouds(scene, planetRadius = 40) {
  const group = new THREE.Group();
  group.name = "equatorialClouds";

  const material = getStormCloudMaterial();
  const outlineMat = getStormOutlineMaterial();
  const towers = [];

  for (let i = 0; i < TOWERS; i++) {
    const theta =
      (i / TOWERS) * Math.PI * 2 +
      (Math.random() - 0.5) * THREE.MathUtils.degToRad(THETA_JITTER_DEG);
    const radius = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
    _dir.set(Math.cos(theta), 0, Math.sin(theta));

    const tower = new THREE.Group();
    tower.name = "cloud-tower";
    tower.position.copy(_dir).multiplyScalar(radius);
    tower.quaternion.copy(quatYToDir(_dir, _q));
    tower.rotateY(Math.random() * Math.PI * 2);
    const s = 0.8 + Math.random() * 0.35;
    tower.scale.setScalar(s);
    tower.userData.scatterK = 0;

    const geo = buildTowerGeometry(Math.random);
    const body = new THREE.Mesh(geo, material);
    body.onBeforeRender = () => {
      uScatterU.value = tower.userData.scatterK || 0;
    };
    const outline = new THREE.Mesh(geo, outlineMat);
    outline.raycast = () => {};
    outline.userData.isOutline = true;
    outline.onBeforeRender = () => {
      uScatterU.value = tower.userData.scatterK || 0;
    };
    tower.add(body, outline);

    group.add(tower);
    towers.push(tower);
  }

  buildStormRain(group, Math.random);

  group.userData.towers = towers;
  group.userData.planetRadius = planetRadius;
  group.userData.uniforms = () => _cloudUniforms;
  group.userData.storm = { flash: 0, next: 2.5, lastT: 0 };
  group.userData.tornadoes = [];
  group.userData.nextTornadoCheck = 0;
  group.userData.lastT = 0;
  scene.add(group);
  return group;
}

/* =====================================================================
 *  龙卷风：随机在云墙上"吹开"一个缺口（GPU 吹开：uScatterK）
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

function makeTornadoFunnel() {
  const geo = new THREE.CylinderGeometry(4.0, 0.9, 9, 18, 5, true);
  geo.translate(0, -4.5, 0);
  const funnel = new THREE.Mesh(geo, getFunnelMaterial());
  addOutline(funnel, 0.03, INK_COLOR, 0.05);
  return funnel;
}

function spawnWallTornado(group, towerIndex) {
  const tower = group.userData.towers[towerIndex];
  if (!tower) return;
  const funnel = makeTornadoFunnel();
  funnel.scale.setScalar(0.01);
  tower.add(funnel);
  group.userData.tornadoes.push({
    tower,
    towerIndex,
    funnel,
    state: "open",
    stateT: 0,
    disposed: false,
  });
}

function disposeWallTornado(group, tor) {
  if (tor.disposed) return;
  tor.disposed = true;
  tor.tower.userData.scatterK = 0;
  tor.funnel.geometry.dispose();
  tor.tower.remove(tor.funnel);
}

function updateWallTornadoes(group, t, dt) {
  const tornadoes = group.userData.tornadoes;

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

  for (const tor of tornadoes) {
    if (tor.disposed) continue;
    tor.stateT += dt;
    const funnel = tor.funnel;

    if (tor.state === "open") {
      const k = Math.min(1, tor.stateT / TORNADO_OPEN_SEC);
      const e = k * k * (3 - 2 * k);
      tor.tower.userData.scatterK = e;
      funnel.scale.setScalar(0.01 + e * 0.99);
      funnel.rotation.y += dt * (6 + e * 8);
      if (tor.stateT >= TORNADO_OPEN_SEC) {
        tor.state = "hold";
        tor.stateT = 0;
      }
    } else if (tor.state === "hold") {
      tor.tower.userData.scatterK = 1;
      funnel.rotation.y += dt * 15;
      funnel.scale.setScalar(1 + Math.sin(tor.stateT * 13) * 0.05);
      if (tor.stateT >= TORNADO_HOLD_SEC) {
        tor.state = "close";
        tor.stateT = 0;
      }
    } else if (tor.state === "close") {
      const k = Math.min(1, tor.stateT / TORNADO_CLOSE_SEC);
      const e = k * k * (3 - 2 * k);
      tor.tower.userData.scatterK = 1 - e;
      funnel.scale.setScalar(Math.max(0.01, 1 - e));
      funnel.rotation.y += dt * (15 - e * 10);
      if (tor.stateT >= TORNADO_CLOSE_SEC) {
        disposeWallTornado(group, tor);
      }
    }
  }
  group.userData.tornadoes = tornadoes.filter((x) => !x.disposed);
}

/* =====================================================================
 *  旧版 CPU 形变 API（lifecycleClouds 等外部复用，本系统不再使用）
 * ===================================================================== */
export function deformBlob(blob, t) {
  const d = blob.userData.deform;
  const attr = blob.geometry.attributes.position;
  const arr = attr.array;
  const orig = d.orig;
  const na = blob.geometry.attributes.normal.array;
  const T = t * d.speed + d.seed;
  const timeScale = T * 0.4;
  const amp = d.amp;
  for (let i = 0; i < arr.length; i += 3) {
    const ox = orig[i];
    const oy = orig[i + 1];
    const oz = orig[i + 2];
    const wave =
      Math.sin(ox * 0.15 + timeScale) * Math.cos(oz * 0.15 + timeScale) * 1.5;
    const breathe = Math.sin(oy * 0.12 + timeScale * 0.7) * 0.9;
    const disp = (wave + breathe) * amp;
    arr[i] = ox + na[i] * disp;
    arr[i + 1] = oy + na[i + 1] * disp;
    arr[i + 2] = oz + na[i + 2] * disp;
  }
  attr.needsUpdate = true;
}

export function rollBlob(blob, t) {
  const d = blob.userData.deform;
  blob.rotation.x = t * d.rollX;
  blob.rotation.z = Math.sin(t * 0.2 + d.rollZPhase) * d.rollZSeed;
}

/* =====================================================================
 *  每帧更新：uTime 驱动 + 太阳受光 + 闪电频闪 + 龙卷风 + 雨带 + 穿云隐藏
 * ===================================================================== */
export function updateDynamicMoebiusClouds(group, t, sun, camera) {
  if (!group) return;
  const dt = THREE.MathUtils.clamp(t - (group.userData.lastT || t), 0, 0.1);
  group.userData.lastT = t;
  uTimeU.value = t;

  // ---------- 太阳方向 + 闪电频闪 ----------
  const uni = group.userData.uniforms?.();
  if (uni && sun) {
    _sunDir.copy(sun.position).normalize();
    uni.uCloudSunDir.value.copy(_sunDir);
  }
  const storm = group.userData.storm;
  if (uni && storm) {
    if (t >= storm.next) {
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

  // ---------- 相机穿云隐藏：防乘航空艇入云画面全黑 ----------
  if (camera) {
    camera.getWorldPosition(_camPos);
    const towers = group.userData.towers;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const s = tower.scale.x;
      _dir.copy(tower.position).normalize();
      _sphereC.copy(tower.position).addScaledVector(_dir, HIDE_CENTER_K * s);
      const r = HIDE_RADIUS_K * s;
      tower.visible = _sphereC.distanceToSquared(_camPos) > r * r;
    }
  }
}
