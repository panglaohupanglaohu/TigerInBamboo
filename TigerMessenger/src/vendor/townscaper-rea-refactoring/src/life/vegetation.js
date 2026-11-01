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
 *     1707490274425884929 "lil' shrubbery at the edges of things"  画面：崖顶边、路边一圈蓬松的灌木
 *     1191990107785572352 "shrubbery … anchored center vert to the billboards"  画面：贴着房子墙根的一圈灌木
 *   树
 *     1580158269267406849 "foliage from Marching Cubes-blobs"  画面：几团球融成的蓬松树冠，成片长在台地上，有墨线
 *     1849427564034498642 八角 impostor（远处大量树时用；这里树不多，直接画网格，留作下一步）
 *
 * 第 2 轮（第 1 小时）补的：
 *   1205420678859632640 "alpha is view angle modulated by leaf texture mapped to a sphere"
 *     → 灌木 / 树冠的轮廓处按"视角 × 叶片噪声"镂空，镂空边缘一圈深色 = 墨线（叶状的毛边，墨线自然贴合）
 *   小花（茎 + 彩色花头），草地上成簇 —— 没有专门的视频依据，按通用做法补的
 *   （946660607008403456 原文末尾提了一句 "pretty little flowers"，但画面是战斗：血、尸体、箭粘在船上，不是花）
 *   1590674061092212738 草的描边强度 = 站立处与背景的反差 → 只有崖边（背景是远处的低处）的草丛有墨线
 *   1241046107125399552 / 1290997501332525056 小镇后院：沿墙一排圆灌木、草坪上的小花；小径由 buildings.js 铺
 *
 * 做法：
 *   所有落点都从 World + 地形形状（shape.at）算，和地形网格严丝合缝：
 *     草丛：长在草 / 苔顶面上（不长在沙、河、房顶），在变形后的多边形里随机取点；靠崖边的格子更密。
 *     灌木：沿崖顶线（顶面边上邻居更低）每隔一段放一丛，往里收一点；房子墙根（建筑格旁边同高的地面）也放。
 *     树林：用低频噪声圈出"林地"，林地里离崖边、房子都有距离的草顶面上种树，每棵 1–3 个树冠。
 *   草丛是面向镜头的竖直广告牌（只绕 Y 轴转），中间那个顶点往镜头方向提一点（1191990107785572352 的"anchored center vert"）
 *   → 转镜头时不会显得是一张纸片。
 *   树冠 = 几个球融在一起：每个顶点的法线取"离整个树冠中心的方向"和自身法线的混合 → 像 Marching Cubes 团块那样一整团地受光。
 *   风：顶点着色器里按世界坐标 + 时间轻轻摆，越高摆得越多。
 *   墨线：灌木和树冠用反向外壳（和 world/outline.js 的墨线同一种），跟随面板「墨线」开关。
 */

import * as THREE from 'three';
import { fbm, hash01 } from '../core/noise.js';
import { ImpostorBaker, ImpostorField, cloudGeometry } from './impostor.js';

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

/** 一丛草：5 片叶，平面里的扇形；aTip = 0 底 / 1 顶（风和颜色用）。中心底点会在着色器里往镜头提。 */
function tuftGeometry() {
  const pos = [], tip = [];
  const blades = [[-0.05, 0.75, -0.35], [-0.022, 1.0, -0.12], [0.0, 0.9, 0.05], [0.025, 1.05, 0.18], [0.05, 0.7, 0.4]];
  for (const [x, h, lean] of blades) {
    const w = 0.016;
    pos.push(x - w, 0, 0, x + w, 0, 0, x + lean * 0.06, h * 0.085, 0);
    tip.push(0, 0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  return g;
}

/** 小花：两根茎 + 一个六瓣花头（aHead = 1 的顶点用实例颜色）。 */
function flowerGeometry() {
  const pos = [], tip = [], head = [];
  const tri = (a, b, c, t, h) => { pos.push(...a, ...b, ...c); tip.push(...t); head.push(h, h, h); };
  tri([-0.004, 0, 0], [0.004, 0, 0], [0.002, 0.085, 0], [0, 0, 1], 0);
  tri([0.012, 0, 0], [0.018, 0, 0], [0.02, 0.06, 0], [0, 0, 1], 0);
  for (const [cx, cy, r] of [[0.002, 0.088, 0.014], [0.02, 0.062, 0.01]]) {
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
      tri([cx, cy, 0], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 0], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0], [1, 1, 1], 1);
    }
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

const SHRUB = () => blobGeometry([[0, 0.032, 0, 0.034], [0.03, 0.024, 0.014, 0.027], [-0.028, 0.022, -0.01, 0.027], [0.008, 0.05, -0.016, 0.024], [-0.01, 0.026, 0.03, 0.024]], { detail: 1, puff: 0.5 });
const CROWNS = [
  () => blobGeometry([[0, 0.30, 0, 0.16], [0.11, 0.25, 0.04, 0.12], [-0.1, 0.26, -0.03, 0.12], [0.02, 0.40, -0.02, 0.11], [0.0, 0.24, 0.11, 0.1]], { detail: 2 }),
  () => blobGeometry([[0, 0.34, 0, 0.13], [0.06, 0.46, 0.02, 0.1], [-0.07, 0.28, 0.05, 0.1], [0.07, 0.26, -0.06, 0.09]], { detail: 2 }),
  () => blobGeometry([[0, 0.26, 0, 0.19], [0.14, 0.22, 0.05, 0.13], [-0.13, 0.22, 0.03, 0.13], [0.03, 0.36, 0.08, 0.12], [-0.04, 0.38, -0.08, 0.12], [0.08, 0.2, -0.12, 0.11]], { detail: 2 }),
];
function trunkGeometry() {
  const g = new THREE.CylinderGeometry(0.018, 0.028, 0.26, 6, 1).toNonIndexed();
  g.translate(0, 0.13, 0);
  g.setAttribute('aTip', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count), 1));
  return g;
}

/* ------------------------------------------------------------ 材质 */

/** 实例化的团块 / 树干：Lambert + 实例颜色 + 风（越高摆得越多）。 */
const LEAF_GLSL = /* glsl */ `
  float lhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float lnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(lhash(i), lhash(i + vec3(1,0,0)), f.x), mix(lhash(i + vec3(0,1,0)), lhash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(lhash(i + vec3(0,0,1)), lhash(i + vec3(1,0,1)), f.x), mix(lhash(i + vec3(0,1,1)), lhash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

/**
 * 叶状轮廓（1205420678859632640）：rim = 1 - |N·V|，叶片噪声贴在植物自己的坐标上（转镜头不游走）；
 * rim 超过阈值就镂空，阈值附近一圈画成墨色 → 毛茸茸的叶边 + 贴合的墨线。uLeafy = 0 时关掉。
 */
function swayMaterial(uTime, amount, uLeafy = null, leafScale = 60) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uLeafy = uLeafy ?? { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLeafP = position * ${leafScale.toFixed(1)};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLeafy;\nvarying vec3 vLeafP;' + LEAF_GLSL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float inkBand = 0.0;
        if (uLeafy > 0.5) {
          float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
          float leaf = lnoise(vLeafP) * 0.65 + lnoise(vLeafP * 2.3) * 0.35;
          float th = 0.52 + 0.4 * leaf;
          if (rim > th) discard;
          inkBand = smoothstep(th - 0.1, th - 0.04, rim);
        }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.12, 0.13, 0.1), inkBand * 0.85);');
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
function tuftMaterial(uTime, uLight, { ink = false, flower = false } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime, uLight },
    defines: { INK: ink ? 1 : 0, FLOWER: flower ? 1 : 0 },
    vertexShader: /* glsl */ `
      attribute float aTip;
      attribute vec3 aColor;
      attribute float aEdge;     // 背景反差（1590674061092212738）：0 = 背景就是身后的草地，1 = 身后是崖下 / 海
      attribute float aHead;     // 花头
      varying float vEdge;
      varying float vHead;
      uniform float uTime;
      varying vec3 vCol;
      varying float vTip;
      void main() {
        vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float scale = length(instanceMatrix[0].xyz);
        vec3 toCam = cameraPosition - origin; toCam.y = 0.0;
        vec3 fwd = normalize(toCam + vec3(1e-5));
        vec3 right = vec3(fwd.z, 0.0, -fwd.x);
        float sway = (sin(uTime * 1.8 + origin.x * 2.1 + origin.z * 1.7) * 0.6 + sin(uTime * 3.1 + origin.z * 3.3) * 0.4) * 0.018 * aTip;
        vec3 lp = position;
        #if INK
          lp.x *= 1.0 + 0.35 * (1.0 - aTip);   // 墨线层：叶片略加宽、往后推
          lp.y = lp.y * 1.06 + 0.002;
        #endif
        vec3 p = origin + right * (lp.x * scale + sway) + vec3(0.0, lp.y * scale, 0.0);
        p += fwd * (1.0 - abs(position.x) * 18.0) * 0.012 * scale * (1.0 - aTip);   // anchored center vert
        #if INK
          p -= fwd * 0.006;
        #endif
        vEdge = aEdge;
        vHead = aHead;
        vCol = aColor;
        vTip = aTip;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLight;
      varying vec3 vCol;
      varying float vTip;
      varying float vEdge;
      varying float vHead;
      void main() {
        #if INK
          if (vEdge < 0.5) discard;
          gl_FragColor = vec4(vCol * 0.32 * uLight, 1.0);   // 深色版的草色，不是纯黑
          #include <colorspace_fragment>
          return;
        #endif
        vec3 c = vCol * (0.78 + 0.42 * vTip) * uLight;
        #if FLOWER
          c = mix(vec3(0.33, 0.47, 0.25) * uLight, vCol * 1.1 * uLight, vHead);
        #endif
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------ 植被 */

const COLORS = {
  grass: ['#7f9a52', '#8aa45a', '#6f8c4c', '#93a862'],
  dry: ['#b49a62', '#c2a56a'],
  shrub: ['#5e8a4c', '#6c9752', '#53804a', '#78a05a'],
  shrubWarm: ['#9c9a52', '#a99d58', '#b08f56'],   // 原片崖边那圈偏暖，这里压成橄榄 / 赭色，不要像石头
  crown: ['#4f7c4a', '#5a8a52', '#47703f', '#628f56'],
  flower: ['#f4f1e6', '#f2d35b', '#e98fa6', '#f0f0f0', '#c8a8e8'],
  hedge: ['#4f7f4c', '#5b8c55', '#467445'],
  trunk: '#6e5443',
};

export class Vegetation {
  constructor({ scene, levelHeight = 0.5, uTime, max = { tufts: 5000, shrubs: 1200, crowns: 400 } } = {}) {
    this.L = levelHeight;
    this.uTime = uTime ?? { value: 0 };
    this.uLight = { value: 1 };
    this.max = max;
    this.group = new THREE.Group();
    this.stats = {};

    this.uLeafy = { value: 1 };
    const tg = tuftGeometry();
    this.tuftColor = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts * 3), 3);
    this.tuftEdge = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts), 1);
    tg.setAttribute('aColor', this.tuftColor);
    tg.setAttribute('aEdge', this.tuftEdge);
    tg.setAttribute('aHead', new THREE.Float32BufferAttribute(new Float32Array(tg.getAttribute('position').count), 1));
    this.tufts = new THREE.InstancedMesh(tg, tuftMaterial(this.uTime, this.uLight), max.tufts);
    this.tuftInk = new THREE.InstancedMesh(tg, tuftMaterial(this.uTime, this.uLight, { ink: true }), max.tufts);
    this.tuftInk.instanceMatrix = this.tufts.instanceMatrix;

    const fg = flowerGeometry();
    this.flowerColor = new THREE.InstancedBufferAttribute(new Float32Array(max.tufts * 3), 3);
    fg.setAttribute('aColor', this.flowerColor);
    fg.setAttribute('aEdge', new THREE.InstancedBufferAttribute(new Float32Array(max.tufts), 1));
    this.flowers = new THREE.InstancedMesh(fg, tuftMaterial(this.uTime, this.uLight, { flower: true }), max.tufts);

    const sg = SHRUB();
    this.shrubs = new THREE.InstancedMesh(sg, swayMaterial(this.uTime, 0.004, this.uLeafy, 70), max.shrubs);
    this.shrubInk = new THREE.InstancedMesh(sg, inkMaterial(this.uTime, 0.004, 0.006), max.shrubs);

    this.crowns = CROWNS.map((f) => {
      const g = f();
      const m = new THREE.InstancedMesh(g, swayMaterial(this.uTime, 0.02, this.uLeafy, 28), max.crowns);
      const ink = new THREE.InstancedMesh(g, inkMaterial(this.uTime, 0.02, 0.009), max.crowns);
      return { m, ink };
    });
    this.trunks = new THREE.InstancedMesh(trunkGeometry(), swayMaterial(this.uTime, 0.0), max.crowns * 3);

    for (const m of [this.tufts, this.tuftInk, this.flowers, this.shrubs, this.shrubInk, this.trunks, ...this.crowns.flatMap((c) => [c.m, c.ink])]) {
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
      const f = new ImpostorField(baker.rt.texture, baker.bake(cr.m.geometry), this.max.crowns, { uLight: this.uLight });
      f.mesh.visible = false;
      this.group.add(f.mesh);
      return f;
    });
    this.cloudBaked = baker.bake(cloudGeometry(), 256);   // 一团云只烘一次：近处的云和地平线阴云共用
    this.cloudField = new ImpostorField(baker.rt.texture, this.cloudBaked, 64, { cloud: true, uTime: this.uTime, uLight: this.uLight });
    this.group.add(this.cloudField.mesh);
    // 远处的阴云（1243228419162341379 "Some moody clouds"）：同一团云，放大很多、偏灰，围在地平线上
    this.backdrop = new ImpostorField(baker.rt.texture, this.cloudBaked, 48, { cloud: true, uTime: { value: 0 }, uLight: this.uLight });
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
    this.#syncInk();
  }
  set clouds(on) { if (this.cloudField) this.cloudField.mesh.visible = on; }
  set moody(on) { if (this.backdrop) this.backdrop.mesh.visible = on; }
  // 叶状轮廓打开时，墨线由镂空边缘画（贴着叶边）；关掉时退回反向外壳墨线
  #syncInk() {
    const hull = this.inkVisible && !this.leafy;
    this.shrubInk.visible = hull && this.layers.shrubs;
    for (const c of this.crowns) c.ink.visible = hull && this.layers.trees && !this.impostorOn;
    this.tuftInk.visible = this.inkVisible && this.layers.grass;
  }
  layers = { grass: true, shrubs: true, trees: true, flowers: true };
  set ink(on) { this.inkVisible = on; this.#syncInk(); }
  set leafyOn(on) { this.leafy = on; this.uLeafy.value = on ? 1 : 0; this.#syncInk(); }
  setLayer(name, on) {
    this.layers[name] = on;
    if (name === 'grass') this.tufts.visible = on;
    if (name === 'flowers') this.flowers.visible = on;
    if (name === 'shrubs') this.shrubs.visible = on;
    if (name === 'trees') {
      this.trunks.visible = on;
      for (const c of this.crowns) c.m.visible = on && !this.impostorOn;
      for (const f of this.impostorFields || []) f.mesh.visible = on && this.impostorOn;
    }
    this.#syncInk();
  }
  setTimeOfDay(mode) { this.uLight.value = mode === 'night' ? 0.35 : mode === 'dusk' ? 0.8 : 1; }

  /**
   * 从 World + 地形形状重新撒一遍。
   * @param world World
   * @param shape terrain/shape.js 的结果（at(p, 切面)）
   */
  refresh(world, shape, { yards = null, paths = null } = {}, seed = 11) {
    const t0 = performance.now();
    const L = this.L;
    const rnd = rng32(seed);
    const at = shape ? (p, s) => shape.at(p, s) : (p) => [p.x, p.z];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const pick = (a) => a[(rnd() * a.length) | 0];
    const cells = world.cells;

    // 每格：顶面类型（和 terrainmesh.js 的选色规则一致）
    const capKind = (c) => {
      const g = world.ground(c);
      if (!g || world.top(c) !== g || world.river[c.id]) return null;   // 上面有房子 / 河道 / 水
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
          cr.m.setColorAt(nCrown[variant], col.set(pick(COLORS.crown)));
          this.impostorFields?.[variant].set(nCrown[variant], m, col, yaw);
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
    // 一个点身后"背景"的反差：离"邻居更低"的边越近越高（镜头看过去，身后就是崖下 / 海）
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
      if (nF % 3 === 0) this.flowerSpots.push({ x, y, z });   // 蝴蝶的落点
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      m.compose(v.set(x, y, z), q, sc.setScalar(0.8 + rnd() * 0.5));
      this.flowers.setMatrixAt(nF, m);
      col.set(pick(COLORS.flower));
      this.flowerColor.setXYZ(nF, col.r, col.g, col.b);
      nF++;
    };
    for (const c of cells) {
      const kind = capKind(c);
      if (!kind || kind === 'sand') continue;
      const g = world.ground(c);
      const pts = c.pts.map((p) => at(p, g));
      // 坡上、崖边更密（1063115611289645057），林下稀
      const density = (kind === 'slope' ? 9 : kind === 'dry' ? 6 : 4) * (treeCells.has(c.id) ? 0.5 : 1);
      const patch = fbm(c.cx * 0.5 + 3, c.cz * 0.5 + 17, { octaves: 2, freq: 1.6, seed: 91 });
      const count = Math.round(density * (0.4 + patch));
      const palette = kind === 'dry' ? COLORS.dry : COLORS.grass;
      for (let t = 0; t < count && nT < this.max.tufts; t++) {
        const [x, z] = randomIn(pts);
        m.compose(v.set(x, g * L, z), q.identity(), sc.setScalar(0.8 + rnd() * 0.6));
        this.tufts.setMatrixAt(nT, m);
        col.set(pick(palette));
        this.tuftColor.setXYZ(nT, col.r, col.g, col.b);
        this.tuftEdge.setX(nT, edgeContrast(c, g, x, z));
        nT++;
      }
      // 小花：平坦草地上一小簇一小簇（无专门视频依据）
      if (kind === 'grass' && !treeCells.has(c.id)) {
        const fl = fbm(c.cx * 0.7 + 11, c.cz * 0.7 + 2, { octaves: 2, freq: 1.8, seed: 55 });
        if (fl > 0.6) {
          const [cx0, cz0] = randomIn(pts);
          const n = 2 + ((rnd() * 4) | 0);
          for (let t = 0; t < n; t++) addFlower(cx0 + (rnd() - 0.5) * 0.12, g * L, cz0 + (rnd() - 0.5) * 0.12);
        }
      }
    }

    /* ---- 3. 灌木：崖顶线 + 房子墙根 ---- */
    let nS = 0;
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
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        const og = o ? world.top(o) : 0;
        const houseWall = o && world.topIsBuilt(o) && og > g && world.ground(o) === g;   // 房子立在同一块台地上
        const cliffTop = og < g;
        if (!houseWall && !cliffTop) continue;
        if (cliffTop && hash01(c.id * 31 + i) > 0.45) continue;      // 不是每条崖边都长
        const [ax, az] = at(c.pts[i], g), [bx, bz] = at(c.pts[(i + 1) % c.n], g);
        // 往格子里收一点（崖边：别挂在外面；墙根：贴着墙）
        let nx = -(bz - az), nz = bx - ax;
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        if (nx * ((ax + bx) / 2 - c.cx) + nz * ((az + bz) / 2 - c.cz) < 0) { nx = -nx; nz = -nz; }
        const inset = houseWall ? 0.05 : 0.06;
        const len = Math.hypot(bx - ax, bz - az);
        const k = Math.max(1, Math.round(len / (houseWall ? 0.1 : 0.16)));
        const warm = !houseWall && fbm(c.cx * 0.3, c.cz * 0.3, { octaves: 1, freq: 1, seed: 7 }) > (kind === 'dry' ? 0.5 : 0.66);
        for (let t = 0; t < k; t++) {
          const u = (t + 0.5 + (rnd() - 0.5) * 0.5) / k;
          addShrub(ax + (bx - ax) * u - nx * inset, g * L, az + (bz - az) * u - nz * inset, warm);
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
    this.tuftInk.count = nT;
    this.tufts.count = nT; this.tuftColor.needsUpdate = true; this.tufts.instanceMatrix.needsUpdate = true;
    this.shrubs.count = this.shrubInk.count = nS;
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
          const puffs = 3 + ((crng() * 4) | 0);
          for (let j = 0; j < puffs && nC < 64; j++) {
            const yaw = crng() * Math.PI * 2;
            q.setFromAxisAngle(up, yaw);
            const s2 = 0.5 + crng() * 0.5;
            m.compose(v.set(bx + (crng() - 0.5) * 1.6, by + (crng() - 0.5) * 0.25, bz + (crng() - 0.5) * 1.0), q, sc.setScalar(s2));
            this.cloudField.set(nC++, m, null, yaw);
          }
        }
      }
      this.cloudField.commit(nC);
      // 地平线上的阴云带
      let nB = 0;
      if (Number.isFinite(minX)) {
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.max(maxX - minX, maxZ - minZ) * 0.5;
        const brng = rng32(seed * 13 + 1);
        const grey = new THREE.Color(0.72, 0.75, 0.8);
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2 + brng() * 0.1, r = R + 16 + brng() * 8;
          const yaw = brng() * Math.PI * 2;
          q.setFromAxisAngle(up, yaw);
          m.compose(v.set(cx + Math.cos(a) * r, 0.6 + brng() * 2.2, cz + Math.sin(a) * r), q, sc.setScalar(2.6 + brng() * 2.4));
          this.backdrop.set(nB++, m, grey.clone().multiplyScalar(0.9 + brng() * 0.15), yaw);
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
    this.stats = { tufts: nT, flowers: nF, shrubs: nS, trees: nCrown.reduce((a, b) => a + b, 0), ms: +(performance.now() - t0).toFixed(1) };
    return this.stats;
  }
}
