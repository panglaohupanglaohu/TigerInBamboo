import { cloudDepth } from '../core/cloud-depth.js';
import { nearCloudDepth, CLOUD_WIND_AMT } from '../core/cloud-motion.js';
import { levelFloraSpecies, levelFloraRanks, RAIN_CROWN } from '../core/level-flora.js';
import { CLOUD_SHADOW_GLSL } from '../light/cloud-shadow.js';

/**
 * 1243228419162341379：植被（灌木 / 树冠 / 树干）也接收云影。
 * View 构造时把 cloudShadow.uniforms 传进来（同一批 uniform 对象，每帧由 CloudShadow 写值）；
 * 没传就退化成原来的「只吃光照」，不影响其它页面。
 */
let CLOUD_UNIFORMS = null;
export function setCloudShadowUniforms(u) { CLOUD_UNIFORMS = u ?? null; return !!CLOUD_UNIFORMS; }
/**
 * vegetation.js — 植被管线：落点 → 地被（草丛）→ 边缘灌木 → 树林 → 风 + 描边。
 *
 * 依据（原文 + 逐帧看到的）：
 *   落点
 *     959752525867036672  Bad North：三角网格的对偶（顶点格）"a suitable place to start with foliage placement"
 *     1178731576982724611 Townscaper："grassy plots … Eventually, they'll grow some trees"
 *   地被
 *     959530111187013632  "multiple grass types per level"
 *     1063115611289645057 "added grass to slopes to make navigability easier to read"
 *     1590669875869286400 "grass billboards … a completely new kind of shape and detail frequency"
 *       画面：成簇的小草丛，坡上和崖脚更密
 *   灌木
 *     1707490274425884929 "lil' shrubbery at the edges of things"  画面：崖肩/墙根的暖色纹理灌木（342帧复核），本地球团为近似
 *     1191990107785572352 "shrubbery … anchored center vert to the billboards"  画面：贴着房子墙根的一圈灌木
 *   树
 *     1580158269267406849 "foliage from Marching Cubes-blobs"  画面：几团球融成的蓬松树冠，成片长在台地上，有墨线
 *     1849427564034498642 八角 impostor（远处大量树时用；这里树不多，直接画网格，留作下一步）
 *
 * 第 2 轮（第 1 小时）补的：
 *   1205420678859632640 "alpha is view angle modulated by leaf texture mapped to a sphere"
 *     → 本轮补真实32²角落纹理的球面UV与视角alpha；原三维噪声保留对照，不等同原作手绘素材。
 *   小花（茎 + 彩色花头），草地上成簇 —— 没有专门的视频依据，按通用做法补的
 *   （946660607008403456 原文末尾提了一句 "pretty little flowers"，但画面是战斗：血、尸体、箭粘在船上，不是花）
 *   1590674061092212738 草的描边强度 = 站立处与背景的反差 → 只有崖边（背景是远处的低处）的草丛有墨线
 *   1241046107125399552 / 1290997501332525056 小镇后院：沿墙一排圆灌木、草坪上的小花；小径由 buildings.js 铺
 *
 * 做法：
 *   落点从 World + 地形形状（shape.at）算；锚点在格内不等于整个植被体积不越界：
 *     草丛：长在草 / 苔顶面上（不长在沙、河、房顶），在变形后的多边形里随机取点；靠崖边的格子更密。
 *     灌木：沿崖顶线（顶面边上邻居更低）每隔一段放一丛，往里收一点；房子墙根（建筑格旁边同高的地面）也放。
 *     树林：用低频噪声圈出"林地"，林地里离崖边、房子都有距离的草顶面上种树，每棵 1–3 个树冠。
 *   草丛是面向镜头的竖直广告牌（只绕 Y 轴转），旧模式中心随镜头偏移；新增可选中心按实例轴固定的对照（1191990107785572352，局部重建并非原着色器）
 *   → 转镜头时不会显得是一张纸片。
 *   旧球团近似（现仅用于灌木）：每个顶点的法线取"离整个树冠中心的方向"和自身法线的混合 → 像 Marching Cubes 团块那样一整团地受光。
 *   风：顶点着色器里按世界坐标 + 时间轻轻摆，越高摆得越多。
 *   墨线：灌木和树冠用反向外壳（和 world/outline.js 的墨线同一种），跟随面板「墨线」开关。
 */

import { anchoredBillboardGLSL, foldedCard } from '../core/anchored-billboard.js';
import * as THREE from 'three';
import {insetEdgeAnchor} from '../core/edge-inset.js';
import {makeLeafSurface,LEAF_SURFACE_GLSL,LEAF_NOISE_GLSL} from './leaf-surface.js';
import {makeLeafDepthMaterial} from './leaf-depth.js';
import {LeafImpostorField} from './leaf-impostor.js';
import { fbm, hash01 } from '../core/noise.js';
import { buildCanopy } from '../core/canopy.js';
import { ImpostorBaker, ImpostorField, cloudGeometry } from './impostor.js';
import { fluffyCloudGeometry, patchBakedCloudColor, useUnlitVertexColors } from './impostor-c09.js';

/* ------------------------------------------------------------ 随机 */
function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ 几何 */

/**
 * 一丛草 = 一张朝镜头的小卡片（1590669875869286400 "grass billboards … a completely new kind of shape"）。
 * 原片的草不是一根根草叶，而是一团团"扇贝边"的叶丛：轮廓由几片圆形叶瓣叠成，叶瓣之间有弧形墨线，
 * 一簇簇堆在崖脚、崖顶和坡上（暖橙 / 橄榄 / 绿）。形状在片元着色器里用"圆的并集"算，
 * 卡片只负责占位：x ∈ [-1, 1]，y ∈ [0, 1]，aTip = y（风只吹上半部）。
 */
const TUFT_W = 0.14, TUFT_H = 0.165;
function tuftGeometry() {
  const pos = [], tip = [], ctr = [];
  const v = (x, y, c = 0) => { pos.push(x, y, 0); tip.push(y); ctr.push(c); };
  // 四个三角围着一个中心点（anchored center vert，1191990107785572352 "Adding an anchored center vert to the
  // billboards makes them a bit less flat and gives them directionality without messing with the rotation"）：
  // 中心点在着色器里往镜头推，卡片就鼓起来一点，有了朝向感；四个角仍然正对镜头。
  const C = [0, 0.45];
  const ring = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) { const a = ring[i], b = ring[(i + 1) % 4]; v(a[0], a[1]); v(b[0], b[1]); v(C[0], C[1], 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(ctr, 1));
  return g;
}

/**
 * 小花 = 白色小点（Bad North 959530111187013632：草地上一大片一大片的白色碎点，不是带茎的彩色花）。
 * 一个朝镜头的小六边形，贴着地面；aHead 保留给材质（= 1）。
 */
function flowerGeometry() {
  const pos = [], tip = [], head = [];
  const r = 0.0075, cy = 0.012;
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
    pos.push(0, cy, 0, Math.cos(a0) * r, cy + Math.sin(a0) * r, 0, Math.cos(a1) * r, cy + Math.sin(a1) * r, 0);
    tip.push(0, 0, 0); head.push(1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setAttribute('aHead', new THREE.Float32BufferAttribute(head, 1));
  return g;
}

/**
 * 团块：几个低多边形球融成一团，法线朝整团的中心外（Marching Cubes 团块那样整团受光）。
 * @param blobs [[x, y, z, r], …]
 */
function blobGeometry(blobs, { detail = 1, puff = 0.65 } = {}) {
  const parts = [];
  let cx = 0, cy = 0, cz = 0, wsum = 0;
  for (const [x, y, z, r] of blobs) { cx += x * r; cy += y * r; cz += z * r; wsum += r; }
  cx /= wsum; cy /= wsum; cz /= wsum;
  for (const [x, y, z, r] of blobs) {
    const s = new THREE.IcosahedronGeometry(r, detail).toNonIndexed();
    s.translate(x, y, z);
    parts.push(s);
  }
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), h = new Float32Array(total);
  let o = 0;
  let maxY = 0;
  for (const [, y, , r] of blobs) maxY = Math.max(maxY, y + r);
  for (const g of parts) {
    const p = g.getAttribute('position');
    g.computeVertexNormals();
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++, o++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos.set([x, y, z], o * 3);
      const dx = x - cx, dy = (y - cy) * 0.8, dz = z - cz;
      const l = Math.hypot(dx, dy, dz) || 1;
      const nx = n.getX(i) * (1 - puff) + (dx / l) * puff, ny = n.getY(i) * (1 - puff) + (dy / l) * puff + 0.15, nz = n.getZ(i) * (1 - puff) + (dz / l) * puff;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nor.set([nx / nl, ny / nl, nz / nl], o * 3);
      h[o] = y / maxY;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('aTip', new THREE.BufferAttribute(h, 1));
  return out;
}

/** REACode shrubcard.js: wall-base shrub as a camera-facing folded card (centre vertex pushed toward
 * the camera). Non-indexed so each of the 4 triangles keeps its own fold normal (directional shading). */
export function wallCardGeometry({ width = .13, height = .1, depth = .28 } = {}) {
  const c = foldedCard({ width: 1, height: 1, depth }), P = [], N = [], U = [];
  for (let t = 0; t < 12; t += 3) {
    const v = [0, 1, 2].map((k) => c.positions.slice(c.index[t + k] * 3, c.index[t + k] * 3 + 3));
    const a = v[1].map((x, i) => x - v[0][i]), b = v[2].map((x, i) => x - v[0][i]);
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...n); n = n.map((x) => x / l * (n[2] < 0 ? -1 : 1));
    for (const k of [0, 1, 2]) { P.push(v[k][0] * width, (v[k][1] + .5) * height, v[k][2] * width); N.push(...n); U.push(...c.uv.slice(c.index[t + k] * 2, c.index[t + k] * 2 + 2)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aFold', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return g;
}
function wallCardMaterial(uLight) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { uLight, uSun: { value: new THREE.Vector3(.45, .35, .82).normalize() } },
    vertexShader: /* glsl */ `attribute vec3 aFold; attribute vec3 aCardColor; varying vec3 vCol; varying vec2 vUv; varying float vShade; uniform vec3 uSun;
      void main() {
        vec3 origin = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz; float s = length((instanceMatrix * vec4(1., 0., 0., 0.)).xyz);
        vec3 to = cameraPosition - origin; vec2 f = normalize(to.xz + vec2(1e-5, 0.)); vec3 fwd = vec3(f.x, 0., f.y), right = vec3(f.y, 0., -f.x), up = vec3(0., 1., 0.);
        vec3 p = origin + (right * position.x + up * position.y + fwd * position.z) * s;     // rotation unchanged: always faces camera
        vec3 n = normalize(right * aFold.x + up * aFold.y + fwd * aFold.z);
        vShade = .55 + .45 * max(0., dot(n, normalize(uSun))); vCol = aCardColor; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: /* glsl */ `uniform float uLight; varying vec3 vCol; varying vec2 vUv; varying float vShade;
      void main() { vec2 d = vUv - .5; float a = atan(d.y, d.x); float r = length(d) / (.42 + .06 * sin(a * 5.) + .04 * sin(a * 9. + 1.3));
        if (r > 1. || vUv.y < .04) discard; gl_FragColor = vec4(vCol * vShade * uLight, 1.);
        #include <colorspace_fragment>
      }`,
  });
}
const SHRUB = () => blobGeometry([[0, 0.032, 0, 0.034], [0.03, 0.024, 0.014, 0.027], [-0.028, 0.022, -0.01, 0.027], [0.008, 0.05, -0.016, 0.024], [-0.01, 0.026, 0.03, 0.024]], { detail: 1, puff: 0.5 });
function canopyGeometry(blobs) {
  const mesh=buildCanopy(blobs.map(([x,y,z,r])=>({x,y,z,r})),{resolution:16});
  const geometry=new THREE.BufferGeometry(),maxY=Math.max(...mesh.positions.map(p=>p[1]));
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions.flat(),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals.flat(),3));
  geometry.setAttribute('aTip',new THREE.Float32BufferAttribute(mesh.positions.map(p=>Math.max(0,Math.min(1,p[1]/maxY))),1));
  geometry.setIndex(mesh.triangles.flat());geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.canopy=mesh.stats;
  return geometry;
}
const CROWNS = [
  () => canopyGeometry([[0, 0.30, 0, 0.16], [0.11, 0.25, 0.04, 0.12], [-0.1, 0.26, -0.03, 0.12], [0.02, 0.40, -0.02, 0.11], [0.0, 0.24, 0.11, 0.1]]),
  () => canopyGeometry([[0, 0.34, 0, 0.13], [0.06, 0.46, 0.02, 0.1], [-0.07, 0.28, 0.05, 0.1], [0.07, 0.26, -0.06, 0.09]]),
  () => canopyGeometry([[0, 0.26, 0, 0.19], [0.14, 0.22, 0.05, 0.13], [-0.13, 0.22, 0.03, 0.13], [0.03, 0.36, 0.08, 0.12], [-0.04, 0.38, -0.08, 0.12], [0.08, 0.2, -0.12, 0.11]]),
];
function trunkGeometry() {
  const g = new THREE.CylinderGeometry(0.018, 0.028, 0.26, 6, 1).toNonIndexed();
  g.translate(0, 0.13, 0);
  g.setAttribute('aTip', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count), 1));
  return g;
}

/* ------------------------------------------------------------ 材质 */

/** 实例化的团块 / 树干：Lambert + 实例颜色 + 风（越高摆得越多）。
 * 噪声函数单一来源在 leaf-surface.js（LEAF_NOISE_GLSL），深度材质同源复用。 */
const LEAF_GLSL = LEAF_NOISE_GLSL;

/**
 * 叶状轮廓（1205420678859632640）：rim = 1 - |N·V|，叶片噪声贴在植物自己的坐标上（转镜头不游走）；
 * 保留旧噪声阈值对照，默认新增球面atlas+视角alpha，uLeafy = 0 时关掉。
 */
function swayMaterial(uTime, amount, uLeafy = null, leafScale = 60, surface = null, center = new THREE.Vector3()) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.alphaToCoverage = !!surface;
  m.customProgramCacheKey = () => `leaf-surface-${amount}-${leafScale}-${!!surface}-${!!CLOUD_UNIFORMS}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uLeafy = uLeafy ?? { value: 0 };
    shader.uniforms.uLeafAtlas = surface?.uniform ?? {value:null};
    shader.uniforms.uLeafAtlasOn = surface?.on ?? {value:0};
    shader.uniforms.uLeafCenter = {value:center};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLeafCenter;\nvarying vec3 vLeafSphere;\nvarying vec3 vLeafP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLeafSphere = position - uLeafCenter;\nvLeafP = position * ${leafScale.toFixed(1)};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLeafy;\nvarying vec3 vLeafP;' + LEAF_GLSL + LEAF_SURFACE_GLSL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float inkBand = 0.0;
        float leafAlpha = 1.0;
        if (uLeafy > 0.5) {
          float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
          float leaf = lnoise(vLeafP) * 0.65 + lnoise(vLeafP * 2.3) * 0.35;
          float th = 0.52 + 0.4 * leaf;
          if (uLeafAtlasOn > .5) {
            float pattern = leafPattern(vLeafSphere);
            leafAlpha = leafCoverage(1.0-rim,pattern);
            inkBand = (1.0-leafCoverage(1.0-rim-.06,pattern));
            if (leafAlpha <= .001) discard;
          } else {
            if (rim > th) discard;
            inkBand = smoothstep(th - 0.1, th - 0.04, rim);
          }
        }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.12, 0.13, 0.1), inkBand * 0.85);\ngl_FragColor.a *= leafAlpha;');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aTip;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp0 = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sway = sin(uTime * 1.3 + wp0.x * 1.7 + wp0.z * 1.3) * 0.6 + sin(uTime * 2.1 + wp0.z * 2.3) * 0.4;
        transformed.x += sway * ${amount.toFixed(4)} * aTip * aTip;
        transformed.z += sway * ${(amount * 0.6).toFixed(4)} * aTip * aTip;`);
    // 底部压暗一点（团块的下半部在自己的阴影里）
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTip;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.72 + 0.28 * vTip;');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vTip;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = aTip;');
    // 1243228419162341379：云影接收（和主材质/水面同一份 uniform，关掉云影时 uCloudStrength=0 自动退化为 1.0）
    if (CLOUD_UNIFORMS) {
      Object.assign(shader.uniforms, CLOUD_UNIFORMS);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCldW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n        vCldW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCldW;\n' + CLOUD_SHADOW_GLSL)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= cloudShadowTone(vCldW);');
    }
  };
  return m;
}

/** 反向外壳墨线（实例化）。 */
function inkMaterial(uTime, amount, width) {
  const m = new THREE.MeshBasicMaterial({ color: '#2a2a22', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aTip;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp0 = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sway = sin(uTime * 1.3 + wp0.x * 1.7 + wp0.z * 1.3) * 0.6 + sin(uTime * 2.1 + wp0.z * 2.3) * 0.4;
        transformed += normalize(normal) * ${width.toFixed(4)};
        transformed.x += sway * ${amount.toFixed(4)} * aTip * aTip;
        transformed.z += sway * ${(amount * 0.6).toFixed(4)} * aTip * aTip;`);
  };
  return m;
}

/** 草丛：只绕 Y 轴转向镜头的广告牌；中心底点往镜头提（立体感）；顶部随风摆、颜色变浅。 */
function tuftMaterial(uTime, uLight, { flower = false, uInk = { value: 1 }, uTuftAnchor = { value: 0 } } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime, uLight, uInk, uTuftAnchor },
    defines: { FLOWER: flower ? 1 : 0, TW: TUFT_W.toFixed(4), TH: TUFT_H.toFixed(4) },
    vertexShader: /* glsl */ `
      attribute float aTip;
      attribute vec3 aColor;
      attribute float aCenter;   // 锚定中心点（1191990107785572352）
      attribute float aEdge;     // Local static cliff-proximity proxy, NOT the source contrast-texture/background-ray method.
      varying float vEdge;
      varying vec2 vUv;
      varying float vSeed;
      uniform float uTime;
      varying vec3 vCol;
      uniform float uTuftAnchor;
      ${anchoredBillboardGLSL}
      void main() {
        vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float scale = length(instanceMatrix[0].xyz);
        vec3 toCam = cameraPosition - origin; toCam.y = 0.0;
        vec3 fwd = dot(toCam, toCam) > 1e-8 ? normalize(toCam) : vec3(0.0, 0.0, 1.0);
        vec3 right = vec3(fwd.z, 0.0, -fwd.x);
        float sway = (sin(uTime * 1.8 + origin.x * 2.1 + origin.z * 1.7) * 0.6 + sin(uTime * 3.1 + origin.z * 3.3) * 0.4) * 0.012 * aTip;
        #if FLOWER
          vec3 p = origin + right * position.x * scale + vec3(0.0, position.y * scale, 0.0);
        #else
          vec3 axis = length(instanceMatrix[2].xyz) > 1e-4 ? normalize(instanceMatrix[2].xyz) : vec3(0.0, 0.0, 1.0);
          vec3 p = anchoredCard(origin, fwd, right, axis, position.xy, scale, aCenter, uTuftAnchor, sway);
        #endif
        vEdge = aEdge;
        vUv = position.xy;
        vSeed = fract(sin(dot(origin.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vCol = aColor;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLight;
      uniform float uInk;
      varying vec3 vCol;
      varying float vEdge;
      varying vec2 vUv;
      varying float vSeed;
      float h1(float x) { return fract(sin(x * 91.17 + vSeed * 37.3) * 4375.85); }
      void main() {
        #if FLOWER
          gl_FragColor = vec4(vCol * uLight, 1.0);
          #include <colorspace_fragment>
          return;
        #else
        // 叶瓣：5 个圆，中间高两边低；序号大的在前面
        vec2 p = vec2(vUv.x * (TW / TH), vUv.y);
        float d = 1e3, line = 1e3;
        float dl[5];
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float t = (fi - 2.0) / 2.0;                       // -1 … 1
          vec2 c = vec2(t * 0.52 * (TW / TH) + (h1(fi) - 0.5) * 0.12, 0.30 + (1.0 - t * t) * 0.22 + h1(fi + 7.0) * 0.08);
          float r = 0.25 + (1.0 - t * t) * 0.10 + h1(fi + 3.0) * 0.06;
          dl[i] = length(p - c) - r;
          d = min(d, dl[i]);
        }
        d = max(d, -p.y);                                   // 底边平
        if (d > 0.0) discard;
        // 叶瓣之间的弧线：叶瓣 i 的边缘、且不被它前面的叶瓣挡住
        for (int i = 0; i < 4; i++) {
          float front = 1e3;
          for (int k = i + 1; k < 5; k++) front = min(front, dl[k]);
          if (front > 0.0 && p.y > 0.12) line = min(line, abs(dl[i]));
        }
        float wOut = mix(0.035, 0.07, vEdge);              // 外轮廓：背景反差大的地方更粗
        float ink = uInk * max(1.0 - smoothstep(wOut * 0.6, wOut, -d), 0.8 * (1.0 - smoothstep(0.012, 0.024, line)));
        vec3 c = vCol * (0.80 + 0.32 * vUv.y) * uLight;
        c = mix(c, vCol * 0.38 * uLight, ink);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #endif
      }`,
  });
}

/* ------------------------------------------------------------ 植被 */

const COLORS = {
  // 叶丛：原片崖脚一圈偏暖（橙 / 赭），台地上橄榄绿
  grass: ['#8fa85a', '#9fb465', '#7e9c50', '#a9b86a'],
  dry: ['#d0995c', '#c98c55', '#b9a160', '#d7a96a'],
  shrub: ['#5e8a4c', '#6c9752', '#53804a', '#78a05a'],
  shrubWarm: ['#9c9a52', '#a99d58', '#b08f56'],   // 原片崖边那圈偏暖，这里压成橄榄 / 赭色，不要像石头
  crown: ['#4f7c4a', '#5a8a52', '#47703f', '#628f56'],
  crownRain: [...RAIN_CROWN],   // 帧 109+ 雨景生态的紫树冠（近似，floraEcology='rain' 时用）
  flower: ['#f6f4ea', '#ffffff', '#f2efe0', '#f6f4ea', '#f1e7b8'],   // 白色碎点为主，偶尔一点淡黄
  hedge: ['#4f7f4c', '#5b8c55', '#467445'],
  trunk: '#6e5443',
};

export class Vegetation {
  constructor({ scene, levelHeight = 0.5, uTime, cloud = null, max = { tufts: 5000, shrubs: 1200, crowns: 400 } } = {}) {
    this.L = levelHeight;
    this.uTime = uTime ?? { value: 0 };
    setCloudShadowUniforms(cloud);
    this.uLight = { value: 1 };
    this.max = max;
    this.group = new THREE.Group();
    this.stats = {};

    this.uLeafy = { value: 1 };
    // 1241046107125399552：图集纹理是全场景共享单例（life/leaf-surface.js），
    // 灌木 + 三种树冠材质绑同一个纹理对象；TownSkin 开时 uniform 指到全城 TownColor。
    this.leafSurface = makeLeafSurface();
    const tg = tuftGeometry();
    this.tuftColor = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts * 3), 3);
    this.tuftEdge = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts), 1);
    tg.setAttribute('aColor', this.tuftColor);
    tg.setAttribute('aEdge', this.tuftEdge);
    tg.setAttribute('aHead', new THREE.Float32BufferAttribute(new Float32Array(tg.getAttribute('position').count), 1));
    this.uTuftAnchor = { value: 0 }; // Optional fixed-center A/B mode; legacy look stays default.
    this.uTuftInk = { value: 1 };   // 草丛的墨线画在同一个着色器里（外轮廓 + 叶瓣弧线）
    this.tufts = new THREE.InstancedMesh(tg, tuftMaterial(this.uTime, this.uLight, { uInk: this.uTuftInk, uTuftAnchor: this.uTuftAnchor }), max.tufts);

    const fg = flowerGeometry();
    this.flowerColor = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts * 3), 3);
    fg.setAttribute('aColor', this.flowerColor);
    fg.setAttribute('aEdge', new THREE.InstancedBufferAttribute(new Float32Array(max.tufts), 1));
    fg.setAttribute('aCenter', new THREE.Float32BufferAttribute(new Float32Array(fg.getAttribute('position').count), 1));
    this.flowers = new THREE.InstancedMesh(fg, tuftMaterial(this.uTime, this.uLight, { flower: true }), max.tufts);

    const sg = SHRUB();
    sg.computeBoundingBox();
    this.shrubs = new THREE.InstancedMesh(sg, swayMaterial(this.uTime, 0.004, this.uLeafy, 70, this.leafSurface, sg.boundingBox.getCenter(new THREE.Vector3())), max.shrubs);
    this.shrubInk = new THREE.InstancedMesh(sg, inkMaterial(this.uTime, 0.004, 0.006), max.shrubs);
    const wcg = wallCardGeometry();
    this.wallCardColor = new THREE.InstancedBufferAttribute(new Float32Array(max.shrubs * 3), 3);
    wcg.setAttribute('aCardColor', this.wallCardColor);
    this.wallCards = new THREE.InstancedMesh(wcg, wallCardMaterial(this.uLight), max.shrubs);
    this.wallShrubCards = false;   // opt-in: wall-base shrubs as folded cards instead of blobs (not browser-verified)

    this.crowns = CROWNS.map((f) => {
      const g = f();
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      const m = new THREE.InstancedMesh(g, swayMaterial(this.uTime, 0.02, this.uLeafy, 28, this.leafSurface, c), max.crowns);
      // 匹配的阴影 caster：与彩色材质同源的深度材质（leaf-depth.js）——
      // 同一份共享图集、同一视角 alpha 判据、同一风摆，否则影子是实心团块且不跟摆。
      m.customDepthMaterial = makeLeafDepthMaterial({ uTime: this.uTime, uLeafy: this.uLeafy, surface: this.leafSurface, center: c, amount: 0.02, leafScale: 28 });
      const ink = new THREE.InstancedMesh(g, inkMaterial(this.uTime, 0.02, 0.009), max.crowns);
      return { m, ink };
    });
    // 远景替身：共享 32² 图集的交叉面片（leaf-impostor.js，不需 renderer 烘焙）。
    // 默认 count=0 / 隐藏；updateCrownLOD 把距离阈值外的树搬到这里。
    this.farFields = this.crowns.map((cr) => {
      const f = new LeafImpostorField(this.leafSurface, max.crowns, { source: cr.m.geometry, uLight: this.uLight });
      f.mesh.visible = false;
      return f;
    });
    this.crownLodDistance = 0;   // 世界单位：>0 时距离外树冠换成交叉面片替身
    this.crownLodCamera = null;
    this.crownPlacements = [];
    this.trunks = new THREE.InstancedMesh(trunkGeometry(), swayMaterial(this.uTime, 0.0), max.crowns * 3);

    for (const m of [this.tufts, this.flowers, this.shrubs, this.shrubInk, this.wallCards, this.trunks, ...this.crowns.flatMap((c) => [c.m, c.ink]), ...this.farFields.map((f) => f.mesh)]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    for (const m of [this.trunks, ...this.crowns.map((c) => c.m)]) m.castShadow = true;   // 灌木太多，不投影（太小也看不出）
    this.inkVisible = true;
    this.leafy = true;
    if (scene) scene.add(this.group);
  }

  set visible(on) { this.group.visible = on; }

  /**
   * 八方位 impostor（1849427564034498642）+ 共用 impostor 的云（1852334860137849222）。
   * 启动时用渲染器把三种树冠和一团云各烘 8 个方位进图集（core/atlas.js 分配格子）。
   */
  initImpostors(renderer) {
    const baker = new ImpostorBaker(renderer, 2048);
    this.impostorFields = this.crowns.map((cr) => {
      const f = new ImpostorField(baker.rt.texture, baker.bake(cr.m.geometry), this.max.crowns, { uLight: this.uLight, baker });
      f.mesh.visible = false;
      this.group.add(f.mesh);
      return f;
    });
    this.cloudBaked = baker.bake(cloudGeometry(), 256);   // 一团云只烘一次：近处的云和地平线阴云共用
    // 1852334860137849222 r214：近云换菜花状蓬松云（impostor-c09 顶点色烘焙管线——光照/灰蓝底已在顶点色里，
    // Baker 须用无光照 vertexColors 材质烘，不然 Lambert 再照一遍全白）+ 裁判云风材质（uWindAmt=0.6）+前景深度视差层；
    // 远景阴云仍共用旧 cloudGeometry。原片云形为美术资产（卡点·B），此为更贴近的程序近似。
    useUnlitVertexColors(baker);
    this.nearCloudBaked = baker.bake(fluffyCloudGeometry(7), 256, { vertexColors: true });
    this.cloudField = new ImpostorField(baker.rt.texture, this.nearCloudBaked, 64, { cloud: true, uTime: this.uTime, uLight: this.uLight, baker, windAmt: CLOUD_WIND_AMT, cloudParallax: 1 });
    this.cloudField.material.fragmentShader = patchBakedCloudColor(this.cloudField.material.fragmentShader);
    this.cloudField.material.needsUpdate = true;
    this.group.add(this.cloudField.mesh);
    // 远处的阴云（1243228419162341379 "Some moody clouds"）：同一团云，放大很多、偏灰，围在地平线上
    this.backdrop = new ImpostorField(baker.rt.texture, this.cloudBaked, 48, { cloud: true, horizon: true, uTime: this.uTime, uLight: this.uLight, baker });
    this.backdrop.mesh.visible = false;
    this.backdrop.mesh.renderOrder = -2;
    this.group.add(this.backdrop.mesh);
    this.atlas = baker.atlas;
    this.bakeRT = baker.rt;
    this.impostorOn = false;
  }

  /** 树冠用 impostor（true）还是网格（false）。 */
  set impostor(on) {
    this.impostorOn = on;
    if (!this.impostorFields) return;
    for (const f of this.impostorFields) f.mesh.visible = on && this.layers.trees;
    for (const c of this.crowns) c.m.visible = !on && this.layers.trees;
    this.#syncFar();
    this.#syncInk();
  }

  /** 远景交叉面片可见性：trees 层开着、距离 LOD 生效、且没切到烘焙 impostor。 */
  #syncFar() {
    const on = this.layers.trees && this.crownLodDistance > 0 && !this.impostorOn;
    for (const f of this.farFields || []) f.mesh.visible = on;
  }

  /**
   * 距离阈值 LOD：离镜头 > distance 的树冠换成共享图集交叉面片替身
   * （leaf-impostor.js），阈值内仍画网格；distance<=0 或缺 camera 时全部回网格。
   * 与八方位烘焙 impostor 正交：impostorOn 时全场烘焙替身优先，本划分只在
   * 「网格 / 面片」两档间做（farFields 隐藏，数据仍按划分写好）。
   * 无迟滞带：阈值是硬边界，边界来回的树每帧只在相机越过阈值时换档。
   * @param {THREE.Camera|THREE.Vector3|{x,y,z}} camera 镜头或视点
   * @param {number} [distance] 不传则沿用 crownLodDistance
   * @returns {{near:number,far:number}}
   */
  updateCrownLOD(camera, distance = this.crownLodDistance) {
    if (distance !== undefined) {
      if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) throw new RangeError('crown LOD distance must be a finite number >= 0');
      this.crownLodDistance = distance;
    }
    const cam = camera?.position ?? camera ?? null;
    this.crownLodCamera = cam;
    // 相机没移动且树位/阈值没变 → 直接回上次结果（避免每帧重写实例缓冲）
    const key = `${cam ? `${cam.x.toFixed(3)},${cam.y.toFixed(3)},${cam.z.toFixed(3)}` : 'nocam'}|${this.crownLodDistance}|${this.#placementsVersion}`;
    if (key === this.#lodKey && this.#lodResult) return this.#lodResult;
    const near = [[], [], []], far = [[], [], []];
    for (const p of this.crownPlacements) {
      const d = cam && this.crownLodDistance > 0 ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
      (d > this.crownLodDistance ? far : near)[p.variant].push(p);
    }
    let nTrunk = 0;
    const trunkCol = new THREE.Color(COLORS.trunk);
    for (let v = 0; v < 3; v++) {
      const cr = this.crowns[v];
      near[v].forEach((p, i) => { cr.m.setMatrixAt(i, p.matrix); cr.m.setColorAt(i, p.color); cr.ink.setMatrixAt(i, p.matrix); });
      cr.m.count = cr.ink.count = near[v].length;
      cr.m.instanceMatrix.needsUpdate = cr.ink.instanceMatrix.needsUpdate = true;
      if (cr.m.instanceColor) cr.m.instanceColor.needsUpdate = true;
      // 远树只画面片（卡片自身已含冠形剪影，树干在远处分辨不出）
      this.farFields?.[v].commit(far[v].length);
    }
    for (const p of this.crownPlacements) {
      const d = cam && this.crownLodDistance > 0 ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
      if (d > this.crownLodDistance || nTrunk >= this.max.crowns * 3) continue;
      this.trunks.setMatrixAt(nTrunk, p.matrix);
      this.trunks.setColorAt(nTrunk, trunkCol);
      nTrunk++;
    }
    this.trunks.count = nTrunk;
    this.trunks.instanceMatrix.needsUpdate = true;
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true;
    this.#syncFar();
    const n = near[0].length + near[1].length + near[2].length, f = far[0].length + far[1].length + far[2].length;
    this.#lodKey = key; this.#lodResult = { near: n, far: f };
    return { near: n, far: f };
  }
  #lodKey = null;
  #lodResult = null;
  #placementsVersion = 0;
  setTuftAnchor(on) { if(typeof on!=='boolean')throw new TypeError('Tuft anchor toggle'); this.uTuftAnchor.value=on?1:0; }
  set clouds(on) { if (this.cloudField) this.cloudField.mesh.visible = on; }
  setCloudDepthMotion(on) { if(typeof on!=='boolean')throw new TypeError('cloud depth toggle');if(this.backdrop)this.backdrop.material.uniforms.uDepthMotion.value=on?1:0; }
  set moody(on) { if (this.backdrop) this.backdrop.mesh.visible = on; }
  // 叶状轮廓打开时，墨线由镂空边缘画（贴着叶边）；关掉时退回反向外壳墨线
  #syncInk() {
    const hull = this.inkVisible && !this.leafy;
    this.shrubInk.visible = hull && this.layers.shrubs;
    for (const c of this.crowns) c.ink.visible = hull && this.layers.trees && !this.impostorOn;
    this.uTuftInk.value = this.inkVisible ? 1 : 0;
  }
  layers = { grass: true, shrubs: true, trees: true, flowers: true };
  floraEcology = 'meadow';      // 'rain' = 帧 109+ 紫/灰白生态色组近似（只换色，不换物种键/形状/落点）
  levelFloraShapes = false;     // opt-in：levelFlora 开时草丛按物种形状做各向异性缩放（关时矩阵逐字节不变）
  set ink(on) { this.inkVisible = on; this.#syncInk(); }
  set leafAtlasOn(on) { this.leafSurface.on.value = on ? 1 : 0; }
  set leafyOn(on) { this.leafy = on; this.uLeafy.value = on ? 1 : 0; this.#syncInk(); }
  setLayer(name, on) {
    this.layers[name] = on;
    if (name === 'grass') this.tufts.visible = on;
    if (name === 'flowers') this.flowers.visible = on;
    if (name === 'shrubs') this.shrubs.visible = this.wallCards.visible = on;
    if (name === 'trees') {
      this.trunks.visible = on;
      for (const c of this.crowns) c.m.visible = on && !this.impostorOn;
      for (const f of this.impostorFields || []) f.mesh.visible = on && this.impostorOn;
      this.#syncFar();
    }
    this.#syncInk();
  }
  setTimeOfDay(mode) { this.uLight.value = mode === 'night' ? 0.35 : mode === 'rain' ? 0.62 : mode === 'dusk' ? 0.8 : 1; }

  /**
   * 从 World + 地形形状重新撒一遍。
   * @param world World
   * @param shape terrain/shape.js 的结果（at(p, 切面)）
   */
  refresh(world, shape, { yards = null, paths = null } = {}, seed = 11) {
    const t0 = performance.now();
    const L = this.L;
    const rnd = rng32(seed);
    this.crownPlacements = [];   // 树位留底：距离 LOD（updateCrownLOD）按它重新分近网格/远面片
    const at = shape ? (p, s) => shape.at(p, s) : (p) => [p.x, p.z];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const pick = (a) => a[(rnd() * a.length) | 0];
    const cells = world.cells;

    // 每格：顶面类型（和 terrainmesh.js 的选色规则一致）
    const capKind = (c) => {
      const g = world.ground(c);
      if (!g || world.top(c) !== g || world.river[c.id]) return null;   // 上面有房子 / 河道 / 水
      if (world.footprintSplicesC09?.cells?.has(c.id)) return null;     // r56 C09：任意轮廓房屋拼进的格（splice-polygon-c09.js），不再种树草
      if (g <= 1) return 'sand';
      let flat = true, drop = 0;
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        const og = o ? world.top(o) : 0;
        if (og !== g) flat = false;
        drop = Math.max(drop, g - og);
      }
      return flat ? 'grass' : drop >= 2 ? 'dry' : 'slope';
    };
    const nearBuilt = (c) => c.edgeNeighbors.some((id) => id >= 0 && world.topIsBuilt(cells[id])) || c.cornerNeighbors.some((id) => world.topIsBuilt(cells[id]));

    // 变形后多边形里的随机点（扇形三角按面积选）
    const randomIn = (pts) => {
      const tris = [];
      let area = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[0], b = pts[i], c = pts[i + 1];
        const A = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
        tris.push([a, b, c, A]); area += A;
      }
      let r = rnd() * area, tri = tris[0];
      for (const t of tris) { if (r <= t[3]) { tri = t; break; } r -= t[3]; }
      let u = rnd(), w = rnd();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const [a, b, c] = tri;
      return [a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * w, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * w];
    };

    /* ---- 1. 树林：低频噪声圈出林地 ---- */
    const crownPal = this.floraEcology === 'rain' ? COLORS.crownRain : COLORS.crown;   // 雨生态紫冠（近似）
    let nCrown = [0, 0, 0], nTrunk = 0;
    const treeCells = new Set();
    for (const c of cells) {
      const kind = capKind(c);
      if (kind !== 'grass') continue;
      if (nearBuilt(c)) continue;
      const wood = fbm(c.cx * 0.16 + 40, c.cz * 0.16 + 9, { octaves: 2, freq: 1.4, seed: 303 });
      if (wood < 0.47 || hash01(c.id * 7 + 1) > (wood - 0.42) * 3.2) continue;
      // 离崖边至少一格：邻居都同高
      treeCells.add(c.id);
      const g = world.ground(c);
      const pts = c.pts.map((p) => at(p, g));
      const k = 1 + (hash01(c.id * 13) < 0.35 ? 1 : 0);
      for (let t = 0; t < k; t++) {
        const [x, z] = k === 1 ? [c.cx * 0.6 + pts.reduce((s, p) => s + p[0], 0) / pts.length * 0.4, c.cz * 0.6 + pts.reduce((s, p) => s + p[1], 0) / pts.length * 0.4] : randomIn(pts);
        const variant = (rnd() * 3) | 0;
        const s = 0.75 + rnd() * 0.5;
        const y = g * L;
        q.setFromAxisAngle(up, rnd() * Math.PI * 2);
        m.compose(v.set(x, y, z), q, sc.setScalar(s));
        const cr = this.crowns[variant];
        if (nCrown[variant] < this.max.crowns) {
          const yaw = rnd() * Math.PI * 2;
          q.setFromAxisAngle(up, yaw);
          m.compose(v.set(x, y, z), q, sc.setScalar(s));
          cr.m.setMatrixAt(nCrown[variant], m); cr.ink.setMatrixAt(nCrown[variant], m);
          cr.m.setColorAt(nCrown[variant], col.set(pick(crownPal)));
          this.impostorFields?.[variant].set(nCrown[variant], m, col, yaw);
          this.crownPlacements.push({ variant, matrix: m.clone(), color: col.clone(), x, y, z });
          nCrown[variant]++;
        }
        if (nTrunk < this.max.crowns * 3) {
          this.trunks.setMatrixAt(nTrunk, m);
          this.trunks.setColorAt(nTrunk, col.set(COLORS.trunk));
          nTrunk++;
        }
      }
    }

    /* ---- 2. 地被：草丛（+ 背景反差）+ 小花 ---- */
    let nT = 0, nF = 0;
    // Static cliff-distance heuristic. Camera-independent: no contrast texture or background ray sampling yet.
    const edgeContrast = (c, g, x, z) => {
      let best = 1e9;
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        if (o && world.top(o) >= g) continue;
        const [ax, az] = at(c.pts[i], g), [bx, bz] = at(c.pts[(i + 1) % c.n], g);
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
      return best < 0.11 ? 1 : 0;
    };
    this.flowerSpots = [];
    const addFlower = (x, y, z) => {
      if (nF >= this.max.tufts) return;
      if (nF % 12 === 0) this.flowerSpots.push({ x, y, z });   // 蝴蝶的落点
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      m.compose(v.set(x, y, z), q, sc.setScalar(0.7 + rnd() * 0.6));
      this.flowers.setMatrixAt(nF, m);
      col.set(pick(COLORS.flower));
      this.flowerColor.setXYZ(nF, col.r, col.g, col.b);
      nF++;
    };
    // 一簇叶丛：中心点附近 3–6 团，大的在后、小的在前
    // shapeScale（FLORA_SHAPE_SCALE，opt-in levelFloraShapes）按物种形状做各向异性缩放：
    // blade/fan 高挑或宽、dots 贴地、conifer 最高——草型就是层高图例；默认 null → 矩阵与旧版逐字节一致。
    const addClump = (x, z, y, palette, edge, size = 1, shapeScale = null) => {
      const n = 3 + ((rnd() * 4) | 0);
      const sx = shapeScale ? shapeScale.xz : 1, sy = shapeScale ? shapeScale.y : 1;
      for (let t = 0; t < n && nT < this.max.tufts; t++) {
        const a = rnd() * Math.PI * 2, r = rnd() * 0.07 * size;
        const s = (0.55 + rnd() * 0.6) * size;
        m.compose(v.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r), q.identity(), shapeScale ? sc.set(s * sx, s * sy, s * sx) : sc.setScalar(s));
        this.tufts.setMatrixAt(nT, m);
        col.set(pick(palette));
        this.tuftColor.setXYZ(nT, col.r, col.g, col.b);
        this.tuftEdge.setX(nT, edge);
        nT++;
      }
    };
    this.floraSpecies = [];
    const floraRanks = levelFloraRanks(cells.map((c) => { const k = capKind(c); return k && k !== 'sand' ? world.ground(c) : 0; }));
    for (const c of cells) {
      const kind = capKind(c);
      if (!kind || kind === 'sand') continue;
      const g = world.ground(c);
      const pts = c.pts.map((p) => at(p, g));
      const y = g * L;
      // 959530111187013632 / REACode levelflora: one species per cell cluster, species set bound to terrace rank.
      const species = this.levelFlora ? levelFloraSpecies(floraRanks.get(g) ?? 0, c.id, { seed, ecology: this.floraEcology }) : null;
      if (species) this.floraSpecies.push({ cell: c.id, level: g, key: species.key, shape: species.shape, ecology: species.ecology });
      const ss = this.levelFloraShapes && species ? species.size : null;
      const palette = species ? species.colors : kind === 'dry' ? COLORS.dry : COLORS.grass;
      // 叶丛长在"东西的边上"：崖顶边（身后是崖下 → 外轮廓加粗）、崖脚（贴着更高的邻居）、坡上
      // （1590669875869286400 画面：一簇簇堆在崖脚和崖顶；1063115611289645057：坡上撒小团帮助读出可走的地方）
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        const og = o ? world.top(o) : 0;
        const lower = og < g, higher = og > g && o && !world.topIsBuilt(o);
        if (!lower && !higher) continue;
        if (rnd() > (higher ? 1 : 0.5)) continue;
        const [ax, az] = at(c.pts[i], g), [bx, bz] = at(c.pts[(i + 1) % c.n], g);
        // 崖脚连成一条带：两簇；崖顶边：一簇
        for (const t of higher ? [0.28 + rnd() * 0.1, 0.62 + rnd() * 0.1] : [0.3 + rnd() * 0.4]) {
        const ex = ax + (bx - ax) * t, ez = az + (bz - az) * t;
        // 往格子里收一点
        const ccx = pts.reduce((a, p) => a + p[0], 0) / pts.length, ccz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const k = higher ? 0.18 : 0.12;
        addClump(ex + (ccx - ex) * k, ez + (ccz - ez) * k, y, higher && !this.levelFlora ? COLORS.dry.concat(palette) : palette, lower ? 1 : 0, higher ? 1.3 : 0.95, ss);
        }
      }
      if (kind === 'slope' && rnd() < 0.7) { const [x, z] = randomIn(pts); addClump(x, z, y, this.levelFlora ? palette : COLORS.grass, 0, 0.8, ss); }
      // 开阔草地上偶尔一簇（林下更少）
      if (kind === 'grass' && rnd() < (treeCells.has(c.id) ? 0.05 : 0.12)) { const [x, z] = randomIn(pts); addClump(x, z, y, palette, 0, 0.85, ss); }
      // 小花：Bad North 式的白色碎点，一大片一大片（959530111187013632）
      if ((kind === 'grass' || kind === 'slope') && !treeCells.has(c.id)) {
        const fl = fbm(c.cx * 0.45 + 11, c.cz * 0.45 + 2, { octaves: 2, freq: 1.5, seed: 55 });
        if (fl > 0.56) {
          const n = Math.round(10 + (fl - 0.56) * 120);
          for (let t = 0; t < n; t++) { const [x, z] = randomIn(pts); addFlower(x, y, z); }
        }
      }
    }

    /* ---- 3. 灌木：崖顶线 + 房子墙根 ---- */
    let nS = 0, nW = 0;
    this.shrubEdgeAnchors = [];
    const addWallCard = (x, y, z) => {
      if (nW >= this.max.shrubs) return;
      const s = .85 + rnd() * .5;
      m.compose(v.set(x, y, z), q.identity(), sc.setScalar(s));
      this.wallCards.setMatrixAt(nW, m);
      col.set(pick(COLORS.shrub)); this.wallCardColor.setXYZ(nW, col.r, col.g, col.b);
      nW++;
    };
    const addShrub = (x, y, z, warm) => {
      if (nS >= this.max.shrubs) return;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      m.compose(v.set(x, y, z), q, sc.set(0.8 + rnd() * 0.6, 0.7 + rnd() * 0.5, 0.8 + rnd() * 0.6));
      this.shrubs.setMatrixAt(nS, m); this.shrubInk.setMatrixAt(nS, m);
      this.shrubs.setColorAt(nS, col.set(pick(warm ? COLORS.shrubWarm : COLORS.shrub)));
      nS++;
    };
    for (const c of cells) {
      const kind = capKind(c);
      if (!kind || kind === 'sand') continue;
      const g = world.ground(c);
      const poly=c.pts.map(p=>at(p,g));
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        const og = o ? world.top(o) : 0;
        const houseWall = o && world.topIsBuilt(o) && og > g && world.ground(o) === g;   // 房子立在同一块台地上
        const cliffTop = og < g;
        if (!houseWall && !cliffTop) continue;
        if (cliffTop && hash01(c.id * 31 + i) > 0.45) continue;      // 不是每条崖边都长
        const [ax, az] = at(c.pts[i], g), [bx, bz] = at(c.pts[(i + 1) % c.n], g);
        const inset = houseWall ? 0.05 : 0.06;
        const len = Math.hypot(bx - ax, bz - az);
        const k = Math.max(1, Math.round(len / (houseWall ? 0.1 : 0.16)));
        const warm = !houseWall && fbm(c.cx * 0.3, c.cz * 0.3, { octaves: 1, freq: 1, seed: 7 }) > (kind === 'dry' ? 0.5 : 0.66);
        for (let t = 0; t < k; t++) {
          const u = (t + 0.5 + (rnd() - 0.5) * 0.5) / k;
          const anchor=insetEdgeAnchor(poly,i,u,inset);
          if(!anchor)continue;
          if(houseWall&&this.wallShrubCards){addWallCard(anchor.point[0],g*L,anchor.point[1]);continue;}
          const before=nS;
          addShrub(anchor.point[0],g*L,anchor.point[1],warm);
          if(nS>before)this.shrubEdgeAnchors.push({instance:before,cell:c.id,edge:i,poly,point:anchor.point,distance:anchor.distance});
        }
      }
    }

    /* ---- 4. 小镇后院：沿墙一排圆灌木 + 草坪上的小花（1241046107125399552、1290997501332525056） ---- */
    if (yards) {
      for (const id of yards) {
        if (paths?.has(id)) continue;
        const c = cells[id];
        const y = L + 0.006;
        for (let i = 0; i < c.n; i++) {
          const o = world.neighbor(c, i);
          if (!o || world.top(o) < 2) continue;              // 只沿着墙（邻居是房子）
          const a = c.pts[i], b = c.pts[(i + 1) % c.n];
          let nx = -(b.z - a.z), nz = b.x - a.x;
          const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
          if (nx * ((a.x + b.x) / 2 - c.cx) + nz * ((a.z + b.z) / 2 - c.cz) < 0) { nx = -nx; nz = -nz; }
          const k = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.11));
          for (let t = 0; t < k; t++) {
            if (nS >= this.max.shrubs) break;
            const u = (t + 0.5) / k;
            q.setFromAxisAngle(up, rnd() * Math.PI * 2);
            const r = 1.05 + rnd() * 0.35;
            m.compose(v.set(a.x + (b.x - a.x) * u - nx * 0.06, y, a.z + (b.z - a.z) * u - nz * 0.06), q, sc.set(r, r * 1.05, r));
            this.shrubs.setMatrixAt(nS, m); this.shrubInk.setMatrixAt(nS, m);
            this.shrubs.setColorAt(nS, col.set(pick(COLORS.hedge)));
            nS++;
          }
        }
        if (hash01(id * 17) < 0.5) {
          const n = 2 + ((rnd() * 3) | 0);
          for (let t = 0; t < n; t++) addFlower(c.cx + (rnd() - 0.5) * 0.18, y, c.cz + (rnd() - 0.5) * 0.18);
        }
      }
    }

    // 收尾
    this.tuftEdge.needsUpdate = true;
    this.flowers.count = nF; this.flowerColor.needsUpdate = true; this.flowers.instanceMatrix.needsUpdate = true;
    this.tufts.count = nT; this.tuftColor.needsUpdate = true; this.tufts.instanceMatrix.needsUpdate = true;
    this.shrubs.count = this.shrubInk.count = nS;
    this.wallCards.count = nW; this.wallCards.instanceMatrix.needsUpdate = true; this.wallCardColor.needsUpdate = true;
    for (const mm of [this.shrubs, this.shrubInk]) mm.instanceMatrix.needsUpdate = true;
    if (this.shrubs.instanceColor) this.shrubs.instanceColor.needsUpdate = true;
    this.impostorFields?.forEach((f, i) => f.commit(nCrown[i]));

    /* ---- 5. 云：同一套 impostor，放大、半透明，绕着岛成带状（1852334860137849222） ---- */
    if (this.cloudField) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxTop = 0;
      for (const c of cells) {
        const t = world.top(c);
        if (!t) continue;
        minX = Math.min(minX, c.cx); maxX = Math.max(maxX, c.cx); minZ = Math.min(minZ, c.cz); maxZ = Math.max(maxZ, c.cz);
        maxTop = Math.max(maxTop, t);
      }
      let nC = 0;
      if (Number.isFinite(minX)) {
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.max(maxX - minX, maxZ - minZ) * 0.55;
        const crng = rng32(seed * 7 + 3);
        for (let k = 0; k < 7; k++) {
          const a = crng() * Math.PI * 2, r = R * (1.0 + crng() * 0.5);
          const bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r, by = Math.max(5, (maxTop + 4) * L) + crng() * 1.5;
          // 前景云层次：一团云一个深度（内缘 1 → 外缘 1.8），着色器按 1/cd 放慢漂移与起伏（uCloudParallax）
          const depth = nearCloudDepth(r, R);
          const puffs = 3 + ((crng() * 4) | 0);
          for (let j = 0; j < puffs && nC < 64; j++) {
            const yaw = crng() * Math.PI * 2;
            q.setFromAxisAngle(up, yaw);
            const s2 = 0.5 + crng() * 0.5;
            m.compose(v.set(bx + (crng() - 0.5) * 1.6, by + (crng() - 0.5) * 0.25, bz + (crng() - 0.5) * 1.0), q, sc.setScalar(s2));
            this.cloudField.set(nC++, m, null, yaw, depth);
          }
        }
      }
      this.cloudField.commit(nC);
      // 地平线上的阴云带
      let nB = 0;
      if (Number.isFinite(minX)) {
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.max(maxX - minX, maxZ - minZ) * 0.5;
        const brng = rng32(seed * 13 + 1);
        this.backdrop.material.uniforms.uOrbit.value.set(cx, cz, .002);
        const grey = new THREE.Color(0.72, 0.75, 0.8);
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2 + brng() * 0.1, r = R + 16 + brng() * 8;
          const yaw = brng() * Math.PI * 2;
          q.setFromAxisAngle(up, yaw);
          m.compose(v.set(cx + Math.cos(a) * r, 0.6 + brng() * 2.2, cz + Math.sin(a) * r), q, sc.setScalar(2.6 + brng() * 2.4));
          this.backdrop.set(nB, m, grey.clone().multiplyScalar(0.9 + brng() * 0.15), yaw, cloudDepth(nB));
          nB++;
        }
      }
      this.backdrop.commit(nB);
    }

    this.crowns.forEach((cr, i) => {
      cr.m.count = cr.ink.count = nCrown[i];
      cr.m.instanceMatrix.needsUpdate = cr.ink.instanceMatrix.needsUpdate = true;
      if (cr.m.instanceColor) cr.m.instanceColor.needsUpdate = true;
    });
    this.trunks.count = nTrunk; this.trunks.instanceMatrix.needsUpdate = true;
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true;
    // 树位变了：距离 LOD 重新划分（阈值 0 / 无相机时全部回网格、远面片清空）
    this.#placementsVersion++;
    this.#lodKey = null;
    this.updateCrownLOD(this.crownLodCamera);
    this.stats = { tufts: nT, flowers: nF, shrubs: nS, trees: nCrown.reduce((a, b) => a + b, 0), ms: +(performance.now() - t0).toFixed(1) };
    return this.stats;
  }
}
