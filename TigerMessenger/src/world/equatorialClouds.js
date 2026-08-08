// =====================================================================
//  城头六组穿行云线 · megaCloudWall
//
//  布局（默认）：双子要塞城头之上 6 组细线云沿轨穿行
//    · 单锚点居中 · 与城门同锚/同高/同长
//    · 朵数增多、每朵体积 1/3 · 原滚筒涌动 · 无龙卷风
//  可选 opts.corridor：恢复书店→峡谷轨旁落地云塔
// =====================================================================
import * as THREE from "three";
import { addOutline, INK_COLOR } from "../assets/toon.js";
import { latLonToDir, flatToWorld } from "./sphereMath.js";
import { CANYON, canyonOffsetDir } from "./canyon.js";
import { PLANET_RADIUS } from "./planet.js";
import { WORLD_SCALE } from "./worldScale.js";
import { findGateSeatU } from "./abandonedGate.js";
import { sfxThunder } from "../audio/sfx.js";

/** 雷声定位用临时量 */
const _thunderPos = new THREE.Vector3();

/* ---------------- 插画白蓝 / 暖边 ---------------- */
const CLOUD_COLOR = 0xf5f7fb; // Demo 基色：干净近白
const RIM_COLOR = 0xfff2cf; // 边缘暖光
const FUNNEL_COLOR = 0xc5d8e8;
const STORM_COLOR = 0x4a5568; // 阴云密布时的铅灰积雨云

/* ---------------- 城头云墙天气循环（晴朗 ↔ 阴云密布 + 电闪雷鸣） ---------------- */
const WEATHER_PHASES = Object.freeze({
  clear: { next: "gathering", min: 38, span: 42 },     // 晴朗
  gathering: { next: "storm", min: 9, span: 6 },       // 聚云转阴
  storm: { next: "clearing", min: 24, span: 26 },      // 阴云密布 + 电闪雷鸣
  clearing: { next: "clear", min: 11, span: 8 },       // 云开雨收
});
/** 风暴期落雷间隔（秒） */
const STRIKE_MIN = 1.6;
const STRIKE_SPAN = 3.6;

/* ---------------- 云墙密度（轨道两侧） ---------------- */
const BOOKSHOP_FLAT = { x: 11.5 * WORLD_SCALE, z: 5.5 * WORLD_SCALE }; // 与 messengerIsland 一致
const CORRIDOR_STATIONS = 22; // 沿走廊采样站数（仅 opts.corridor 旧模式）
const SIDE_LATERAL = [7.2, 11.0]; // 距轨面横向距离（两层纵深）
const HEIGHT_ROWS = 4; // 高度层
const CLUSTER_SKIP = 0.08;
// 单簇 puff 数增多；体积缩为 1/3 → 线尺寸 ×∛(1/3)
const PUFFS_MIN = 9;
const PUFFS_MAX = 14;
const CLOUD_VOLUME_SCALE = Math.cbrt(1 / 3); // ≈ 0.693

/* ---------------- 城头六组穿行云线 ---------------- */
/**
 * 城头默认高度（= abandonedGate.GATE.wallTop ≈ 44）；可由 opts.crownY 覆盖。
 * 6 组细线云沿轨穿行于双子要塞城头之上；朵数多、单体小、保留滚筒涌动。
 * 龙卷风模式已关闭。
 */
const CROWN_Y_DEFAULT = 44.0;
/**
 * 沿轨方向（本地 X）铺开半幅。默认覆盖整座门长 GATE_DEPTH≈28.6：
 * 16.3 × 2 × 0.88(scale 下界) ≈ 28.7。opts.spanX 可覆盖。
 */
const CAP_X_HALF = 16.3;
const CAP_SCALE_FLOOR = 0.88;
/** 6 组线 · 每组沿轨簇数（总簇 ≈ 72，远多于旧 14） */
const LINE_GROUPS = 6;
const CLUSTERS_PER_GROUP = 12;
/** 6 组跨轨车道（覆盖双子塔顶连线） */
const LINE_LANE_Z = [-4.2, -2.5, -0.85, 0.85, 2.5, 4.2];
/** 相对城头高度与组间层差 */
const LINE_Y0 = 2.0;
const LINE_Y_LANE_STEP = 0.55;
const LINE_Y_JITTER = 0.9;
/** 截屏视角下避免云线沿视线竖直堆叠：绕门顶法线横向换向 90°。 */
const CAP_DIRECTION_YAW = Math.PI / 2;
/**
 * 背景层解耦：整堵云墙沿轨向（本地 Z / 旅行方向）统一后退 13.5，
 * 完整退到双子要塞巨塔正后方作纯背景层，杜绝横向穿模切断塔腰。
 */
const CLOUD_BACKDROP_OFFSET = 13.5;
/** 沿轨条状拉伸 */
const LINE_STRETCH = [1.6, 2.6];
const LINE_SMALL_RATIO = 0.55;
// 簇尺度仍按原量级传给 makeCloudClusterMesh；体积 1/3 在 mesh 内统一 ×∛(1/3)
const LINE_SMALL_SCALE = [1.0, 1.7];
const LINE_BIG_SCALE = [2.0, 3.2];
/** 穿行：沿轨传送带速度（单位/秒）与环路半宽余量 */
const PARADE_SPEED = 3.2;
const PARADE_MARGIN = 4.0;
/** 风向漂移：沿一线轻颤 */
const CAP_DRIFT_AMP = 1.1;
const CAP_DRIFT_FREQ = 0.11;
const PUFF_DETAIL = 3;
const OUTLINE_THICK = 0.035;

/* ---------------- 切线滚筒翻滚（原涌动 · 整簇不改顶点） ---------------- */
const ROLL_X_SPEED = 0.055;
const ROLL_Z_SWAY = 0.05;
const ROLL_Z_FREQ = 0.11;
const BREATH_AMP = 0.035;
const BREATH_FREQ = 0.32;

/* ---------------- 雨带 / 穿云（龙卷已取消） ---------------- */
const RAIN_COUNT = 1100;
const RAIN_TOP = 45.0;
const RAIN_FLOOR = 39.0;
const RAIN_BAND_Y = 2.6;
const RAIN_COLOR = 0x1a2430;

const HIDE_CENTER_K = 16;
const HIDE_RADIUS_K = 20;

/* =====================================================================
 *  轻量 ImprovedNoise（经典 Ken Perlin 置换表 · 无需 three/addons）
 * ===================================================================== */
class SimpleNoise {
  constructor(seed = 0) {
    const p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let s = (seed * 16807 + 1) >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) >>> 0;
      const j = s % (i + 1);
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    this.p = p;
  }
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  lerp(t, a, b) {
    return a + t * (b - a);
  }
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  /** @returns {number} ≈ [-1, 1] */
  noise(x, y, z) {
    const p = this.p;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
        this.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))
      ),
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad(p[AA + 1], x, y, z - 1),
          this.grad(p[BA + 1], x - 1, y, z - 1)
        ),
        this.lerp(
          u,
          this.grad(p[AB + 1], x, y - 1, z - 1),
          this.grad(p[BB + 1], x - 1, y - 1, z - 1)
        )
      )
    );
  }
}

const _noise = new SimpleNoise(42);
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

/* =====================================================================
 *  云朵几何：噪声径向位移的 Icosahedron（创建一次，永不炸裂）
 * ===================================================================== */
function makeCloudPuffGeometry(radius, seed, noise = _noise) {
  // 索引共享；沿法线径向位移后仍 manifold
  const geo = new THREE.IcosahedronGeometry(radius, PUFF_DETAIL);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    _n.copy(_v).normalize();
    const bump =
      noise.noise(_n.x * 1.1 + seed, _n.y * 1.1 + seed, _n.z * 1.1 + seed) * 0.55 +
      noise.noise(_n.x * 3.5 + seed, _n.y * 3.5 + seed, _n.z * 3.5 + seed) * 0.22;
    const displaced = radius + Math.max(bump, -0.15) * radius * 0.5;
    _v.copy(_n).multiplyScalar(displaced);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** lifecycle 复用：焊接二十面体 */
export function weldIcosahedron(radius, detail = 2) {
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
 *  材质：Toon 三色阶 + 边缘暖光（对齐 Demo）
 * ===================================================================== */
let _cloudGradient = null;
let _cloudMat = null;
let _cloudUniforms = null;

export function getCloudGradient() {
  if (_cloudGradient) return _cloudGradient;
  // 暗→中→亮：抬高暗部，避免水泥死灰
  const data = new Uint8Array([120, 190, 255]);
  _cloudGradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  _cloudGradient.minFilter = THREE.NearestFilter;
  _cloudGradient.magFilter = THREE.NearestFilter;
  _cloudGradient.generateMipmaps = false;
  _cloudGradient.needsUpdate = true;
  return _cloudGradient;
}

function getMegaCloudMaterial() {
  if (_cloudMat) return _cloudMat;
  const mat = new THREE.MeshToonMaterial({
    color: CLOUD_COLOR,
    gradientMap: getCloudGradient(),
  });
  // Demo 用平滑法线的噪声球；flatShading 会削掉有机感 → 关闭
  mat.flatShading = false;
  mat.needsUpdate = true;
  mat.customProgramCacheKey = () => "mega-cloud-demo-v3";

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(RIM_COLOR) };
    shader.uniforms.uCloudSunDir = { value: new THREE.Vector3(0.45, 0.85, 0.28) };
    shader.uniforms.uCloudGlow = { value: 0.06 };
    // 阴云密布：0 = 晴朗白云，1 = 铅灰积雨云
    shader.uniforms.uCloudDark = { value: 0 };
    shader.uniforms.uStormColor = { value: new THREE.Color(STORM_COLOR) };
    _cloudUniforms = shader.uniforms;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 rimColor;
uniform float uCloudGlow;
uniform float uCloudDark;
uniform vec3 uStormColor;`
      )
      .replace(
        "#include <dithering_fragment>",
        `// 阴云密布：整体压向铅灰，并按朝下程度加重（云底更暗，云顶仍受光）
  float downward = clamp(-normalize(vNormal).y * 0.5 + 0.5, 0.0, 1.0);
  vec3 stormTint = uStormColor * (0.62 + 0.38 * (1.0 - downward));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, stormTint, uCloudDark * (0.55 + 0.45 * downward));
  // 边缘暖光：参考 Demo rim（阴天削弱暖边）
  float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
  rim = pow(clamp(rim, 0.0, 1.0), 2.2);
  gl_FragColor.rgb += rimColor * rim * 0.5 * (1.0 - uCloudDark * 0.7);
  // 闪电：整片云被内部照亮（越暗的云越明显）
  gl_FragColor.rgb += rimColor * uCloudGlow * 0.15;
  gl_FragColor.rgb += vec3(0.78, 0.86, 1.0) * uCloudGlow * uCloudDark * 0.9;
  #include <dithering_fragment>`
      );
  };

  _cloudMat = mat;
  return mat;
}

/* =====================================================================
 *  合并多颗 puff 为单 mesh（一簇 = 一次 draw · 拓扑完好）
 * ===================================================================== */
function mergePuffGeometries(geos) {
  let vCount = 0;
  let iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(vCount * 3);
  const normals = new Float32Array(vCount * 3);
  const indices = new Uint32Array(iCount);
  let vOff = 0;
  let iOff = 0;
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _nr = new THREE.Vector3();

  for (const g of geos) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const mat = g.userData._bakeMatrix;
    if (mat) _m.copy(mat);
    else _m.identity();

    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_m);
      positions[(vOff + i) * 3] = _p.x;
      positions[(vOff + i) * 3 + 1] = _p.y;
      positions[(vOff + i) * 3 + 2] = _p.z;
      if (nrm) {
        _nr.fromBufferAttribute(nrm, i).transformDirection(_m).normalize();
        normals[(vOff + i) * 3] = _nr.x;
        normals[(vOff + i) * 3 + 1] = _nr.y;
        normals[(vOff + i) * 3 + 2] = _nr.z;
      }
    }
    if (g.index) {
      for (let j = 0; j < g.index.count; j++) {
        indices[iOff + j] = g.index.getX(j) + vOff;
      }
      iOff += g.index.count;
    } else {
      for (let j = 0; j < pos.count; j++) indices[iOff + j] = vOff + j;
      iOff += pos.count;
    }
    vOff += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 一簇云 = 多个噪声球重叠后合并成单一 Mesh
 * 体称/体积为原先 1/3：线尺寸 × CLOUD_VOLUME_SCALE，puff 数量增多。
 * @returns {THREE.Mesh}
 */
function makeCloudClusterMesh(scale, material, noise) {
  const puffCount = PUFFS_MIN + Math.floor(Math.random() * (PUFFS_MAX - PUFFS_MIN + 1));
  const s = scale * CLOUD_VOLUME_SCALE;
  const geos = [];
  for (let i = 0; i < puffCount; i++) {
    const r = (1.15 + Math.random() * 1.55) * s;
    const geo = makeCloudPuffGeometry(r, Math.random() * 100, noise);
    const ox = (Math.random() - 0.5) * 2.6 * s;
    const oy = (Math.random() - 0.5) * 1.1 * s;
    const oz = (Math.random() - 0.5) * 2.6 * s;
    const e = new THREE.Euler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(ox, oy, oz),
      new THREE.Quaternion().setFromEuler(e),
      new THREE.Vector3(1, 1, 1)
    );
    geo.userData._bakeMatrix = m;
    geos.push(geo);
  }
  const merged = mergePuffGeometries(geos);
  for (const g of geos) g.dispose();

  const mesh = new THREE.Mesh(merged, material);
  addOutline(mesh, OUTLINE_THICK, INK_COLOR, 0.05);
  return mesh;
}

/* =====================================================================
 *  lifecycle 兼容：CPU 低频径向形变（仅小云系统用，云墙不用）
 * ===================================================================== */
export function deformBlob(blob, t) {
  const d = blob.userData.deform;
  if (!d?.orig) return;
  const attr = blob.geometry.attributes.position;
  const arr = attr.array;
  const orig = d.orig;
  const timeScale = t * 0.35 * (d.speed ?? 1) + (d.seed ?? 0);
  const amp = (d.amp ?? 1) * 0.55; // lifecycle 用更小振幅
  const sp = 0.06;
  for (let i = 0; i < arr.length; i += 3) {
    const ox = orig[i];
    const oy = orig[i + 1];
    const oz = orig[i + 2];
    const len = Math.hypot(ox, oy, oz) || 1;
    const wave =
      Math.sin(ox * sp + timeScale) * Math.cos(oz * sp + timeScale) * amp;
    arr[i] = ox + (ox / len) * wave;
    arr[i + 1] = oy + (oy / len) * wave;
    arr[i + 2] = oz + (oz / len) * wave;
  }
  attr.needsUpdate = true;
}

export function rollBlob(blob, t) {
  const d = blob.userData.deform;
  if (!d) return;
  const phase = d.seed ?? 0;
  blob.rotation.x = t * ROLL_X_SPEED * (d.rollX ?? 1) + phase * 0.37;
  blob.rotation.y = d.baseRy ?? 0;
  blob.rotation.z = Math.sin(t * ROLL_Z_FREQ + phase) * ROLL_Z_SWAY * (d.rollZ ?? 1);
}

/* =====================================================================
 *  雨带：只在走廊云塔附近倾泻（不再环赤道）
 * ===================================================================== */
function buildStormRain(group, rnd, towers) {
  const positions = new Float32Array(RAIN_COUNT * 6);
  const streaks = [];
  const nT = Math.max(1, towers?.length || 1);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const tw = towers[(i * 7) % nT];
    const base = tw?.position || new THREE.Vector3(0, 0, 40);
    const up = base.clone().normalize();
    // 切平面内随机偏移
    const tmp = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    tmp.addScaledVector(up, -tmp.dot(up));
    if (tmp.lengthSq() < 1e-8) tmp.set(1, 0, 0).addScaledVector(up, -up.x);
    tmp.normalize();
    const lateral = tmp.multiplyScalar((rnd() - 0.5) * 10);
    const origin = base.clone().add(lateral);
    const dir = origin.clone().normalize();
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    if (right.lengthSq() < 1e-6) {
      right.crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize();
    }
    streaks.push({
      dir,
      right,
      len: 1.2 + rnd() * 1.1,
      slant: 0.3 + rnd() * 0.35,
      speed: 6 + rnd() * 3.5,
      phase: rnd() * (RAIN_TOP - RAIN_FLOOR),
      r0: origin.length(),
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: RAIN_COLOR, transparent: true, opacity: 0.45 })
  );
  rain.name = "storm-rain";
  rain.frustumCulled = false;
  group.add(rain);
  group.userData.rain = rain;
  group.userData.rainStreaks = streaks;
}

function updateStormRain(group, t) {
  const rain = group.userData.rain;
  const streaks = group.userData.rainStreaks;
  if (!rain || !streaks) return;
  const arr = rain.geometry.attributes.position.array;
  const span = RAIN_TOP - RAIN_FLOOR;
  for (let i = 0; i < streaks.length; i++) {
    const s = streaks[i];
    // 沿径向从高到低「落下」（世界坐标）
    const rTop = s.r0 + 2 - ((t * s.speed + s.phase) % span) * 0.35;
    const rBot = rTop - s.len;
    const o = i * 6;
    const d = s.dir;
    const rt = s.right;
    arr[o] = d.x * rTop;
    arr[o + 1] = d.y * rTop;
    arr[o + 2] = d.z * rTop;
    arr[o + 3] = d.x * rBot + rt.x * s.slant;
    arr[o + 4] = d.y * rBot + rt.y * s.slant;
    arr[o + 5] = d.z * rBot + rt.z * s.slant;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}

/* =====================================================================
 *  龙卷风：已关闭（保留空实现，避免外部误调用）
 * ===================================================================== */
function updateWallTornadoes() {
  /* no-op：城头云墙不再生成龙卷 */
}

/* =====================================================================
 *  走廊路径：书店 → 峡谷（沿电车轨或合成引桥）
 * ===================================================================== */
const _dir = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _sphereC = new THREE.Vector3();
const _p = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/** 无电车曲线时：书店山 → 南岸 → G 引桥 → 峡谷谷心 的合成走廊 */
function buildSyntheticCorridorCurve(R) {
  const pts = [
    flatToWorld(BOOKSHOP_FLAT.x, 0.4, BOOKSHOP_FLAT.z, R, new THREE.Vector3()),
    flatToWorld(9.0 * WORLD_SCALE, 0.5, -2.0 * WORLD_SCALE, R, new THREE.Vector3()),
    flatToWorld(2.0 * WORLD_SCALE, 0.6, -12.0 * WORLD_SCALE, R, new THREE.Vector3()),
    flatToWorld(-5.5 * WORLD_SCALE, 0.8, -16.5 * WORLD_SCALE, R, new THREE.Vector3()),
    latLonToDir(-10, -60, new THREE.Vector3()).multiplyScalar(R + 0.5),
    latLonToDir(-28, -90, new THREE.Vector3()).multiplyScalar(R + 1.2),
    latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3()).multiplyScalar(R + 2.0),
    latLonToDir(CANYON.lat - 4, CANYON.lon + 18, new THREE.Vector3()).multiplyScalar(R + 1.5),
  ];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

/**
 * 从闭合/开放电车曲线中截取「书店 → 峡谷」段。
 * 优先选经过 G 引桥（跨赤道入南）的那条弧。
 */
function extractBookshopToCanyonStations(curve, R, stationCount) {
  const N = 360;
  const bookshop = flatToWorld(BOOKSHOP_FLAT.x, 0, BOOKSHOP_FLAT.z, R, new THREE.Vector3());
  const canyon = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3()).multiplyScalar(R);
  const gBridge = latLonToDir(-10, -60, new THREE.Vector3()).multiplyScalar(R);

  const pts = [];
  let iBook = 0;
  let iCan = 0;
  let iG = 0;
  let dBook = Infinity;
  let dCan = Infinity;
  let dG = Infinity;
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(i / N, new THREE.Vector3());
    pts.push(p);
    const db = p.distanceToSquared(bookshop);
    const dc = p.distanceToSquared(canyon);
    const dg = p.distanceToSquared(gBridge);
    if (db < dBook) {
      dBook = db;
      iBook = i;
    }
    if (dc < dCan) {
      dCan = dc;
      iCan = i;
    }
    if (dg < dG) {
      dG = dg;
      iG = i;
    }
  }

  const onArc = (from, to, step) => {
    const idx = [];
    let i = from;
    idx.push(i);
    while (i !== to) {
      i = (i + step + N) % N;
      idx.push(i);
      if (idx.length > N + 2) break;
    }
    return idx;
  };

  const fwd = onArc(iBook, iCan, 1);
  const bak = onArc(iBook, iCan, -1);
  const fwdHasG = fwd.includes(iG);
  const bakHasG = bak.includes(iG);
  let pathIdx;
  if (fwdHasG && !bakHasG) pathIdx = fwd;
  else if (bakHasG && !fwdHasG) pathIdx = bak;
  else pathIdx = fwd.length <= bak.length ? fwd : bak;

  // 略向峡谷深处多走一截，电车入城仍夹在云墙中
  const extra = Math.floor(pathIdx.length * 0.12);
  const last = pathIdx[pathIdx.length - 1];
  const step = pathIdx.length >= 2
    ? Math.sign(((pathIdx[1] - pathIdx[0] + N) % N) - N / 2) || 1
    : 1;
  // step 简化：用 path 前两站的走向
  let dirStep = 1;
  if (pathIdx.length >= 2) {
    const d = (pathIdx[1] - pathIdx[0] + N) % N;
    dirStep = d <= N / 2 ? 1 : -1;
  }
  for (let e = 1; e <= extra; e++) {
    pathIdx.push((last + dirStep * e + N) % N);
  }

  // 均匀抽站
  const stations = [];
  const n = Math.max(2, stationCount);
  for (let s = 0; s < n; s++) {
    const u = s / (n - 1);
    const pi = pathIdx[Math.min(pathIdx.length - 1, Math.floor(u * (pathIdx.length - 1)))];
    const t = pi / N;
    curve.getPointAt(t, _p);
    curve.getTangentAt(t, _fwd).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd);
    if (_right.lengthSq() < 1e-8) {
      _right.crossVectors(_up, new THREE.Vector3(0, 1, 0));
    }
    _right.normalize();
    // 保证 right 与 fwd 正交且手性稳定
    _fwd.crossVectors(_right, _up).normalize();
    stations.push({
      position: _p.clone(),
      up: _up.clone(),
      forward: _fwd.clone(),
      right: _right.clone(),
      t,
    });
  }
  return stations;
}

/** 在曲线参数 u 处构造一个云塔站位（正交基与电车/城门同一套构造顺序） */
function stationAtCurveU(curve, u) {
  curve.getPointAt(u, _p);
  curve.getTangentAt(u, _fwd).normalize();
  _up.copy(_p).normalize();
  _right.crossVectors(_up, _fwd);
  if (_right.lengthSq() < 1e-8) _right.crossVectors(_up, new THREE.Vector3(0, 1, 0));
  _right.normalize();
  _fwd.crossVectors(_right, _up).normalize();
  return {
    position: _p.clone(),
    up: _up.clone(),
    forward: _fwd.clone(),
    right: _right.clone(),
    t: u,
  };
}

/**
 * 单站城头云线锚点：与 abandonedGate 共用同一落座逻辑。
 * 优先 findGateSeatU（门长范围内几乎不横移的直段）；
 * 找不到时回退「入谷点前回退 setback」。
 * @returns {object[]} 命中则返回单元素数组，否则空数组
 */
function extractCanyonEntryStation(curve, R, setback = 6, anchorU = null) {
  const totalLen = curve.getLength();
  if (!(totalLen > 1)) return [];
  // 显式锚点（开发者菜单 / main 传入）优先
  if (Number.isFinite(anchorU)) {
    return [stationAtCurveU(curve, ((anchorU % 1) + 1) % 1)];
  }
  // 与 buildAbandonedGate 默认一致：先找直段门座
  const seatU = findGateSeatU(curve, R);
  if (Number.isFinite(seatU)) {
    return [stationAtCurveU(curve, ((seatU % 1) + 1) % 1)];
  }
  // 回退：草地→峡谷入谷点前回退 setback
  const N = 1200;
  let entryU = -1;
  let prevDrop = 0;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    curve.getPointAt(u, _p);
    _up.copy(_p).normalize();
    const drop = canyonOffsetDir(_up);
    if (i > 0 && prevDrop === 0 && drop < 0) {
      entryU = u;
      break;
    }
    prevDrop = drop;
  }
  if (entryU < 0) return [];
  const u = entryU - setback / totalLen;
  if (u <= 0) return [];
  return [stationAtCurveU(curve, ((u % 1) + 1) % 1)];
}

function fillSixLineGroups(tower, material, noise, scale, capXHalf = CAP_X_HALF) {
  const clusters = [];
  const span = capXHalf * 2 + PARADE_MARGIN * 2; // 环路长度（含门前/后余量）
  const xMin = -capXHalf - PARADE_MARGIN;

  for (let g = 0; g < LINE_GROUPS; g++) {
    const laneZ = LINE_LANE_Z[g] ?? (g - (LINE_GROUPS - 1) / 2) * 1.6;
    const laneY = LINE_Y0 + (g % 3) * LINE_Y_LANE_STEP;
    // 组间相位错开，6 组如传送带分段穿行
    const groupPhase = (g / LINE_GROUPS) * span;
    const groupSpeed = PARADE_SPEED * (0.85 + (g % 3) * 0.08);

    for (let i = 0; i < CLUSTERS_PER_GROUP; i++) {
      const u = CLUSTERS_PER_GROUP === 1 ? 0.5 : i / (CLUSTERS_PER_GROUP - 1);
      // 组内沿轨均匀分布（初始相位）
      const localX = xMin + ((u * span + groupPhase) % span);
      const z =
        laneZ +
        Math.sin(u * Math.PI * 2 + g) * 0.35 +
        (Math.random() - 0.5) * 0.55;
      const y =
        laneY +
        Math.sin(u * Math.PI * 1.4 + g * 0.7) * 0.4 +
        (Math.random() - 0.5) * LINE_Y_JITTER;

      const small = Math.random() < LINE_SMALL_RATIO;
      const band = small ? LINE_SMALL_SCALE : LINE_BIG_SCALE;
      const clScale =
        (band[0] + Math.random() * (band[1] - band[0])) * scale;

      const mesh = makeCloudClusterMesh(clScale, material, noise);
      mesh.position.set(localX, y, z);
      const stretch =
        LINE_STRETCH[0] + Math.random() * (LINE_STRETCH[1] - LINE_STRETCH[0]);
      mesh.userData.stretch = new THREE.Vector3(
        stretch,
        0.52 + Math.random() * 0.16,
        0.7 + Math.random() * 0.22
      );
      mesh.scale.copy(mesh.userData.stretch);
      mesh.userData.home = mesh.position.clone();
      mesh.userData.lineGroup = g;
      mesh.userData.paradeX0 = localX;
      mesh.userData.paradeSpan = span;
      mesh.userData.paradeMin = xMin;
      mesh.userData.paradeSpeed = groupSpeed * (0.92 + Math.random() * 0.16);
      mesh.userData.rollSeed = Math.random() * 100;
      mesh.userData.baseScale = 1;
      mesh.userData.driftSeed = Math.random() * Math.PI * 2;
      mesh.userData.driftRate = 0.65 + Math.random() * 0.7;
      // 原涌动强度（滚筒翻滚）
      mesh.userData.rollX = 0.55 + Math.random() * 0.35;
      mesh.userData.rollZ = 0.5 + Math.random() * 0.4;
      tower.add(mesh);
      clusters.push(mesh);
    }
  }
  return clusters;
}

function fillTowerClusters(tower, material, noise, scale, stationIndex, sideSign) {
  const clusters = [];
  for (let d = 0; d < SIDE_LATERAL.length; d++) {
    const scaleByDepth = 1.12 - d * 0.1;
    for (let row = 0; row < HEIGHT_ROWS; row++) {
      if (Math.random() < CLUSTER_SKIP) continue;
      const y =
        1.5 +
        row * 9.2 +
        Math.sin(stationIndex * 0.65 + d + sideSign) * 2.6 +
        (Math.random() - 0.5) * 2.0;
      // 塔本地：Y=径向外（天空），X=沿轨切向，Z=轨旁横向（在 place 时已把 right 对齐）
      const x =
        (Math.random() - 0.5) * 6.5 +
        Math.sin(row * 1.05 + stationIndex) * 1.3;
      const z = (Math.random() - 0.5) * 2.4 + sideSign * d * 0.4;

      const clScale = (2.3 + Math.random() * 1.5) * scaleByDepth * scale;
      const mesh = makeCloudClusterMesh(clScale, material, noise);
      mesh.position.set(x, y, z);
      mesh.userData.home = mesh.position.clone();
      mesh.userData.rollSeed = Math.random() * 100;
      mesh.userData.baseScale = 1;
      mesh.userData.rollX = 0.75 + Math.random() * 0.5;
      mesh.userData.rollZ = 0.7 + Math.random() * 0.55;
      tower.add(mesh);
      clusters.push(mesh);
    }
  }
  return clusters;
}

/**
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {number} [planetRadius=PLANET_RADIUS]
 * @param {{ trackCurve?: THREE.Curve, assetScale?: number }} [opts]
 */
export function createDynamicMoebiusClouds(scene, planetRadius = PLANET_RADIUS, opts = {}) {
  const group = new THREE.Group();
  group.name = "equatorialClouds";

  const megaCloudWall = new THREE.Group();
  megaCloudWall.name = "megaCloudWall";
  group.add(megaCloudWall);

  const material = getMegaCloudMaterial();
  const noise = new SimpleNoise(Math.floor(Math.random() * 10000));
  const towers = [];
  const clusters = [];
  // 云簇是玩家可读的局部资产：R 变大只改变世界锚点，不把城门云盖放大。
  // corridor 与 cap 都可由调用方显式传入 assetScale，但默认保持 1。
  const scale = Number.isFinite(opts.assetScale) ? Math.max(0.1, opts.assetScale) : 1;

  const curve =
    opts.trackCurve ||
    group.userData.trackCurve ||
    buildSyntheticCorridorCurve(planetRadius);

  // 云墙只保留一处：锚在入谷阈值（与废弃城门同点），沿走廊铺 22 站的旧行为已停用。
  // 需要恢复整条走廊时传 opts.corridor = true。
  const stations = opts.corridor
    ? extractBookshopToCanyonStations(curve, planetRadius, CORRIDOR_STATIONS)
    : extractCanyonEntryStation(
        curve,
        planetRadius,
        Number.isFinite(opts.setback) ? opts.setback : 6,
        Number.isFinite(opts.anchorU) ? opts.anchorU : null
      );

  // 城头一线模式（默认）：单锚点压在门顶，沿轨排成一条云脊
  // 走廊模式（opts.corridor）：仍为轨旁落地云塔
  const capMode = !opts.corridor;
  const crownY = Number.isFinite(opts.crownY) ? opts.crownY : CROWN_Y_DEFAULT;
  const capXHalf =
    Number.isFinite(opts.spanX) && opts.spanX > 0
      ? opts.spanX / 2 / CAP_SCALE_FLOOR
      : CAP_X_HALF;

  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];

    if (capMode) {
      // —— 城头一条线：居中锚在城门顶，不左右分塔 ——
      const dir = st.position.clone().normalize();
      const groundR = planetRadius + canyonOffsetDir(dir);
      const anchor = dir.clone().multiplyScalar(groundR + crownY);

      const tower = new THREE.Group();
      tower.name = "cloud-crown-line";
      tower.position.copy(anchor);
      // 本地：+Y = up，+X = forward（沿轨一线），+Z = right（跨轨，压薄）
      const yAxis = st.up.clone().normalize();
      const xAxis = st.forward.clone().normalize();
      xAxis.addScaledVector(yAxis, -xAxis.dot(yAxis)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      tower.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      );
      // 云线改为横跨门顶，避免当前视角把沿轨方向看成竖直云柱。
      tower.rotateY(CAP_DIRECTION_YAW);
      // 背景层：整墙沿轨向（Z 轴旅行方向）后退 13.5，退到双子塔正后方
      tower.position.addScaledVector(xAxis, CLOUD_BACKDROP_OFFSET);
      tower.userData.scatterK = 0;
      tower.userData.side = 0;
      tower.userData.station = s;

      const localClusters = fillSixLineGroups(tower, material, noise, 1, capXHalf);
      tower.userData.clusters = localClusters;
      for (const c of localClusters) clusters.push(c);
      megaCloudWall.add(tower);
      towers.push(tower);
    } else {
      // —— 走廊旧模式：轨旁左右云塔 ——
      for (const side of [-1, 1]) {
        const lateral =
          SIDE_LATERAL[0] +
          (SIDE_LATERAL[1] - SIDE_LATERAL[0]) * 0.35 +
          (Math.random() - 0.5) * 1.2;
        const anchor = st.position
          .clone()
          .addScaledVector(st.right, side * lateral)
          .addScaledVector(st.up, 1.2 + Math.random() * 1.5);

        const tower = new THREE.Group();
        tower.name = "cloud-tower";
        tower.position.copy(anchor);
        const zAxis = st.right.clone().multiplyScalar(side).normalize();
        const xAxis = st.forward.clone().normalize();
        const yAxis = st.up.clone().normalize();
        xAxis.crossVectors(yAxis, zAxis).normalize();
        zAxis.crossVectors(xAxis, yAxis).normalize();
        tower.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
        );
        tower.scale.setScalar((0.88 + Math.random() * 0.28) * scale);
        tower.userData.scatterK = 0;
        tower.userData.side = side;
        tower.userData.station = s;

        const localClusters = fillTowerClusters(
          tower,
          material,
          noise,
          1,
          s,
          side
        );
        tower.userData.clusters = localClusters;
        for (const c of localClusters) clusters.push(c);
        megaCloudWall.add(tower);
        towers.push(tower);
      }
    }
  }

  // 城头一线重定位：只改锚点位姿
  if (capMode) {
    group.userData.relocate = (u) => {
      if (!Number.isFinite(u)) return false;
      const st = stationAtCurveU(curve, ((u % 1) + 1) % 1);
      const dir = st.position.clone().normalize();
      const groundR = planetRadius + canyonOffsetDir(dir);
      const tw = towers[0];
      if (!tw) return false;
      const yAxis = st.up.clone().normalize();
      const xAxis = st.forward.clone().normalize();
      xAxis.addScaledVector(yAxis, -xAxis.dot(yAxis)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      tw.position
        .copy(dir)
        .multiplyScalar(groundR + crownY)
        // 背景层：与创建时一致，整墙沿轨向后退 13.5 退到双子塔正后方
        .addScaledVector(xAxis, CLOUD_BACKDROP_OFFSET);
      tw.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      );
      tw.rotateY(CAP_DIRECTION_YAW);
      return true;
    };
  }

  buildStormRain(group, Math.random, towers);

  group.userData.megaCloudWall = megaCloudWall;
  group.userData.towers = towers;
  group.userData.clusters = clusters;
  group.userData.blobs = clusters;
  group.userData.components = clusters;
  group.userData.planetRadius = planetRadius;
  group.userData.trackCurve = curve;
  group.userData.uniforms = () => _cloudUniforms;
  // 城头云墙天气状态机：晴朗 → 聚云 → 阴云密布(电闪雷鸣) → 云开 → 晴朗
  group.userData.storm = { flash: 0, next: 2.5, lastT: 0 };
  group.userData.weather = {
    phase: "clear",
    // 首次进入风暴前先晴一段，避免开局就雷雨
    phaseEnd: WEATHER_PHASES.clear.min * 0.5 + Math.random() * 10,
    dark: 0,        // 0..1 阴云程度（驱动 uCloudDark / 雨量）
    nextStrike: 0,  // 下次落雷时间
    strikes: 0,     // 累计落雷次数（验收用）
  };
  // 龙卷风模式已取消
  group.userData.tornadoes = [];
  group.userData.nextTornadoCheck = Infinity;
  group.userData.lastT = 0;

  scene.add(group);
  return group;
}

/* =====================================================================
 *  每帧：整簇翻滚 + 微呼吸 · 绝不碰顶点拓扑
 * ===================================================================== */
/**
 * 城头云墙天气循环：晴朗 ↔ 阴云密布（电闪雷鸣）。
 *
 * 相位机：clear → gathering → storm → clearing → clear，各段时长随机。
 *   · dark 0→1 平滑过渡：驱动云体铅灰化(uCloudDark) 与雨量
 *   · storm 期随机落雷：uCloudGlow 尖峰照亮云内 + sfxThunder 按距离延迟发声
 * 光先到声后到由 sfxThunder 内部按距离处理，这里只负责触发。
 */
function updateCloudWallWeather(group, t, dt, camera) {
  const w = group.userData.weather;
  const storm = group.userData.storm;
  const uni = group.userData.uniforms?.();
  if (!w) return;

  // ---- 相位推进 ----
  if (t >= w.phaseEnd) {
    const cfg = WEATHER_PHASES[w.phase] || WEATHER_PHASES.clear;
    w.phase = cfg.next;
    const nextCfg = WEATHER_PHASES[w.phase];
    w.phaseEnd = t + nextCfg.min + Math.random() * nextCfg.span;
    if (w.phase === "storm") w.nextStrike = t + 0.6 + Math.random() * 1.4;
  }

  // ---- 阴云程度：向目标值平滑逼近（避免天气突变） ----
  const target =
    w.phase === "storm" ? 1 : w.phase === "clear" ? 0 : w.phase === "gathering" ? 0.85 : 0.15;
  const rate = w.phase === "gathering" ? 0.16 : w.phase === "clearing" ? 0.12 : 0.5;
  w.dark += (target - w.dark) * Math.min(1, rate * dt * 3);

  // ---- 落雷（仅风暴期） ----
  if (storm) {
    if (w.phase === "storm" && w.dark > 0.55 && t >= w.nextStrike) {
      storm.flash = 0.55 + Math.random() * 0.5;
      w.nextStrike = t + STRIKE_MIN + Math.random() * STRIKE_SPAN;
      w.strikes++;
      // 雷声：按听者到云墙的水平距离延迟与衰减
      const towers = group.userData.towers;
      if (camera && towers?.length) {
        const anchor = towers[(Math.random() * towers.length) | 0];
        _thunderPos.setFromMatrixPosition(anchor.matrixWorld);
        sfxThunder({ distance: _thunderPos.distanceTo(camera.position) });
      } else {
        sfxThunder({ distance: 14 });
      }
    }
    storm.flash *= Math.exp(-6.5 * dt);
    if (uni?.uCloudGlow) uni.uCloudGlow.value = 0.06 + storm.flash;
  }

  if (uni?.uCloudDark) uni.uCloudDark.value = w.dark;

  // ---- 雨带：随阴云程度显隐 ----
  const rain = group.userData.rain;
  if (rain) {
    const wet = Math.max(0, (w.dark - 0.35) / 0.65); // dark<0.35 完全无雨
    rain.visible = wet > 0.02;
    if (rain.material) rain.material.opacity = 0.1 + wet * 0.42;
  }
}

export function updateDynamicMoebiusClouds(group, t, sun, camera) {
  if (!group) return;
  const dt = THREE.MathUtils.clamp(t - (group.userData.lastT || t), 0, 0.1);
  group.userData.lastT = t;

  const clusters = group.userData.clusters;
  if (clusters) {
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      if (c.parent && !c.parent.visible) continue;
      const seed = c.userData.rollSeed ?? 0;
      const rollX = c.userData.rollX ?? 1;
      const rollZ = c.userData.rollZ ?? 1;
      // 原涌动：切线滚筒翻滚
      c.rotation.x = t * ROLL_X_SPEED * rollX + seed * 0.31;
      c.rotation.z = Math.sin(t * ROLL_Z_FREQ + seed) * ROLL_Z_SWAY * rollZ;
      // 微呼吸 + 条状拉伸
      const breath =
        1 + Math.sin(t * BREATH_FREQ + seed * 0.7) * BREATH_AMP * (0.8 + (rollX % 1) * 0.4);
      const bs = c.userData.baseScale ?? 1;
      const k = bs * breath;
      const stretch = c.userData.stretch;
      if (stretch) c.scale.set(stretch.x * k, stretch.y * k, stretch.z * k);
      else c.scale.setScalar(k);

      const home = c.userData.home;
      if (home) {
        const dr = c.userData.driftRate ?? 1;
        const ph = c.userData.driftSeed ?? 0;
        // 6 组沿轨穿行（传送带环绕城头）
        if (Number.isFinite(c.userData.paradeSpeed)) {
          const span = c.userData.paradeSpan || 40;
          const xMin = c.userData.paradeMin ?? -20;
          const x0 = c.userData.paradeX0 ?? home.x;
          let x = x0 + t * c.userData.paradeSpeed;
          x = xMin + ((((x - xMin) % span) + span) % span);
          c.position.x = x;
        } else {
          c.position.x = home.x;
        }
        // 跨轨 / 高度轻颤
        c.position.z =
          home.z + Math.sin(t * CAP_DRIFT_FREQ * dr + ph) * CAP_DRIFT_AMP * 0.35;
        c.position.y =
          home.y + Math.sin(t * CAP_DRIFT_FREQ * 0.7 + ph * 1.3) * 0.45;
      }
    }
  }

  const uni = group.userData.uniforms?.();
  if (uni && sun) {
    _sunDir.copy(sun.position).normalize();
    if (uni.uCloudSunDir) uni.uCloudSunDir.value.copy(_sunDir);
  }
  updateCloudWallWeather(group, t, dt, camera);

  // 龙卷风模式已取消 —— 不再调用 updateWallTornadoes
  updateStormRain(group, t);

  if (camera) {
    camera.getWorldPosition(_camPos);
    const towers = group.userData.towers;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const sc = tower.scale.x;
      _dir.copy(tower.position).normalize();
      _sphereC.copy(tower.position).addScaledVector(_dir, HIDE_CENTER_K * sc);
      const r = HIDE_RADIUS_K * sc;
      tower.visible = _sphereC.distanceToSquared(_camPos) > r * r;
    }
  }
}
