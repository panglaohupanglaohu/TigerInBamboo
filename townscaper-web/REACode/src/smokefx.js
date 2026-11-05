/**
 * smokefx.js — 烟雾与火焰卡片：两遍绘制 + 每片只采一次噪声 + 沿轨迹改 mip
 *
 * 五条原文（同一段 Bad North 特效期，2018-07 与 2018-10）：
 *
 * 1015140880666300416（2018-07-06）
 *   "Smoke effect. A full billowy base tied together by a crisp outline seamlessly
 *    transitioned to a blurry fade. The effect is probably a bit much for my current
 *    purposes, but I think it solves some interesting problems so I wanted to share it"
 * 1015142746372366336
 *   "I solve the problems of z-depth and draw order by drawing the effect in 2 passes.
 *    The first pass is black, and has a full alpha near the base. The second pass is
 *    lighter, more transparent towards the base, and has its cutoff pulled in 1 pixel
 *    (creating the crisp outline)"
 * 1015149712469524480
 *   "I only sample my noise texture once per quad, but I scroll the UVs randomly forward
 *    or backward along the flow of the smoke. This further breaks up the recognizability
 *    of individual blobs and it creates some of that cool multi layered flow feeling"
 * 1015151731804721152
 *   "I change the mip level of the noise texture throughout the smoke trail. This aids
 *    the transition from crisp at the base to blurry a the tip"
 * 1056990611738451968（2018-10-29）
 *   "New fire effect. For blend mode, I use Max instead of Add to have better control
 *    over my colors and to make the particles blend together and form a common silhouette."
 * 1056992291108413446
 *   "The quads above shrink way more than they are supposed to. This looks much better
 *    and breaks up the flame in a much more interesting way"
 *
 * ---- 画面观察（24 帧，640²，侧视） ----
 *
 * 烟雾（1015140880666300416）：底部是一团**实心的、边缘很硬的**白灰团；往上边缘
 *   越来越软，最后一截完全化开、只剩一点灰雾；整条不是圆柱，基部宽、越往上越细，
 *   而且**同一帧里**能数出 5~7 个大小不同的团叠在一起（多层流）。
 * 火焰（1056990611738451968）：一张卡片有明确的**轮廓线**（比内部亮一档），
 *   相邻卡片重叠的地方**不叠加变亮**，而是合成一个共同剪影 —— 这正是 MAX 的特征；
 *   如果是 ADD，重叠处会先饱和成一条白缝。
 *
 * ---- 为什么是这么做的 ----
 *
 * 1. **两遍**不是为了好看，是为了解决 alpha 混合的排序问题：一张卡片内部 alpha 从
 *    1 渐变到 0，半透明像素彼此之间没有正确顺序可言；先铺一遍"黑 + 基部全满"，
 *    把底压实（这一遍可以把 depthWrite 关掉但仍然吃 depthTest），再叠一遍"亮部 +
 *    基部透明"，轮廓就从第二遍的 cutoff 里长出来。原文说的"cutoff pulled in 1 pixel"
 *    在 shader 里就是**把圆角遮罩的阈值抬高一点点**（uEdge 偏移），差值那一条带
 *    就是描边。
 * 2. **每片只采一次噪声**：一根烟 40 片，每片每帧都采 3~4 次噪声是最常见的浪费。
 *    采一次，然后**沿流向滚动 UV**（vRoll 有正有负），片与片之间自然错开；
 *    滚动量随时间线性增长，所以看起来在"流"，而纹理本身的识别度被打散。
 * 3. **沿轨迹改 mip**：基部要锐（mip 0），尖端要糊（mip 3~4）。用片元着色器里
 *    `texture2D(tex, uv, bias)` 的第三参数做，比准备多张纹理便宜得多。
 * 4. **MAX 而不是 ADD**：ADD 在浅色底上会饱和（见 engine/blendlab.html），
 *    MAX 只取更亮的那个，卡片重叠处形成统一剪影，色相不会被吃掉。
 */

import * as THREE from 'three';
import { fbm } from '../engine/noise.js';

/* -------------------------------------------------------------------------- */
/*  noise                                                                      */
/* -------------------------------------------------------------------------- */

let noiseTex = null;

/** 128² 的可平铺噪声，带 mip 链 —— mip 就是"锐到糊"的那条轴。 */
function noiseTexture() {
  if (noiseTex) return noiseTex;
  const S = 128;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // 环形采样，保证左右上下能接上（卡片会滚动 UV，接缝必须看不见）
      const a = (x / S) * Math.PI * 2;
      const b = (y / S) * Math.PI * 2;
      const u = Math.cos(a) * 0.9;
      const v = Math.sin(a) * 0.9;
      const w = Math.cos(b) * 0.9;
      const z = Math.sin(b) * 0.9;
      let n = fbm(u * 1.7 + 3.1, z * 1.7 - 1.4, { octaves: 4, seed: 11 });
      n = 0.65 * n + 0.35 * fbm(v * 2.6 - 2.2, w * 2.6 + 5.0, { octaves: 3, seed: 29 });
      const k = Math.max(0, Math.min(255, Math.round((n - 0.18) * 240)));
      const d = (y * S + x) * 4;
      data[d] = data[d + 1] = data[d + 2] = k;
      data[d + 3] = 255;
    }
  }
  noiseTex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

/* -------------------------------------------------------------------------- */
/*  shaders                                                                    */
/* -------------------------------------------------------------------------- */

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute vec2 aSize;
attribute float aT;      // 0 = 基部, 1 = 尖端
attribute float aRoll;   // UV 滚动相位，有正有负
attribute float aSeed;
attribute float aShrink; // 卡片沿轨迹的收缩（1056992291108413446）

varying vec2 vUv;
varying float vT;
varying float vRoll;
varying float vSeed;

void main() {
  vUv = uv;
  vT = aT;
  vRoll = aRoll;
  vSeed = aSeed;

  vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
  // billboard：在视图空间里沿屏幕 x/y 展开，永远正对相机
  vec2 s = aSize * (1.0 - aShrink * aT);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uScroll;     // UV 滚动速度
uniform float uMipBias;    // 基部→尖端的 mip 跨度（1015151731804721152）
uniform float uEdge;       // 圆角遮罩宽度
uniform float uCut;        // cutoff 内缩量（1015142746372366336 的 "1 pixel"）
uniform float uPass;       // 0 = 黑底压实，1 = 亮部描边
uniform float uAlpha;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec2 vUv;
varying float vT;
varying float vRoll;
varying float vSeed;

void main() {
  // 每片只采一次噪声，但 UV 沿流向随机前后滚：
  //   vRoll 是**静态**偏移（打散片与片的相似度），
  //   uTime*uScroll*sign(vRoll) 是**动态**流速，方向由 vRoll 的符号决定 —— 所以
  //   有的片往上走、有的往下走，叠在一起才不像一整块地在平移。
  //
  // 这里千万不能对 uv.y 取 fract：quad 内部 uv.y 是 0→1.35，fract 会在中间某条线
  // 上把噪声切成两半，整根烟立刻变成一截一截的台阶（第一版就是这样）。
  // 滚动量只对"时间项"取模，RepeatWrapping 负责采样回绕。
  vec2 uv = vUv * vec2(1.0, 1.35);
  float dir = sign(vRoll);
  float sc = mod(uTime * uScroll, 1.0) * dir;
  uv.y += vRoll + sc;
  uv.x += vSeed * 0.37;

  // 沿轨迹改 mip：基部 0（锐），尖端 uMipBias（糊）
  float lod = vT * uMipBias;
  float n = texture2D(uNoise, uv, lod).r;

  // 圆角遮罩：竖着拉长的胶囊，基部宽、尖端收
  vec2 c = vUv - vec2(0.5, 0.5);
  c.x *= mix(1.0, 1.55, vT);
  float r = length(c);
  float mask = 1.0 - smoothstep(uEdge - uCut, uEdge, r);

  float body = mask * mix(1.0, n, 0.55);

  if (uPass < 0.5) {
    // 第一遍：黑，基部 alpha 全满 —— 把底压实，挡掉后面砖墙的细节
    float a = mask * mix(1.0, n, 0.30) * uAlpha;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  } else {
    // 第二遍：亮部，朝基部更透明，cutoff 内缩 → 外圈留一条亮描边
    float cut = smoothstep(0.02 + uCut * 1.6, 0.10 + uCut * 1.6, mask * mix(0.35, n, 0.8));
    vec3 col = mix(uColorA, uColorB, vT);
    float a = cut * uAlpha * (1.0 - 0.55 * vT);
    gl_FragColor = vec4(col, a);
  }
}
`;

/* -------------------------------------------------------------------------- */
/*  system                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULTS = {
  count: 42,           // 一根烟多少片
  span: 3.4,           // 沿轨迹的总长（世界单位）
  baseSize: 0.62,
  tipSize: 0.34,
  shrink: 0.55,        // 卡片往尖端收缩多少（1056992291108413446 的"缩得对")
  width: 0.26,         // 横向漂移幅度
  scroll: 0.11,
  mipBias: 3.2,
  seed: 7,
  colorA: '#ffb257',   // 基部暖
  colorB: '#cfd6da',   // 尖端冷灰
  alpha: 1.0,
};

/**
 * 建一根烟 / 一簇火。
 *
 * @param {object} o  { count, span, baseSize, tipSize, shrink, width, scroll,
 *                      mipBias, seed, colorA, colorB, alpha, maxBlend, twoPass }
 * @returns {{ group: THREE.Group, update(t):void, setMaxBlend(b):void,
 *             setTwoPass(b):void, dispose():void, materials }}
 */
export function makeSmoke(o = {}) {
  const p = { ...DEFAULTS, ...o };
  const group = new THREE.Group();

  const n = p.count;

  // ---- 一根烟的骨架：沿 +y 的曲线，带横向摆动 --------------------------
  const centres = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const sway = Math.sin(t * Math.PI * 2.1 + p.seed) * p.width * t
      + (fbm(t * 3.2 + p.seed, 1.7, { octaves: 2, seed: p.seed }) - 0.5) * p.width * 1.4 * t;
    centres.push(new THREE.Vector3(sway, t * p.span, (fbm(t * 2.4, 2.9, { octaves: 2, seed: p.seed + 3 }) - 0.5) * p.width * t));
  }

  // ---- 几何：每片一个单位 quad，属性全在顶点上 -------------------------
  const quad = new THREE.PlaneGeometry(1, 1);
  const base = quad.attributes.position.array;
  const uv = quad.attributes.uv.array;
  const index = quad.index.array;

  const vCount = n * 4;
  const pos = new Float32Array(vCount * 3);
  const uvA = new Float32Array(vCount * 2);
  const cen = new Float32Array(vCount * 3);
  const siz = new Float32Array(vCount * 2);
  const tA = new Float32Array(vCount);
  const roll = new Float32Array(vCount);
  const seedA = new Float32Array(vCount);
  const shrinkA = new Float32Array(vCount);
  const idx = [];

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const size = p.baseSize * (1 - t) + p.tipSize * t;
    // 随机前后滚：有正有负，打散个体识别度（1015149712469524480）
    const r = (fbm(i * 1.7 + p.seed, 0.5, { octaves: 2, seed: p.seed }) - 0.5) * 2.2;
    const sd = fbm(i * 0.9 + 4.1, 2.2, { octaves: 2, seed: p.seed + 9 });
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v;
      pos[k * 3] = base[v * 3];
      pos[k * 3 + 1] = base[v * 3 + 1];
      pos[k * 3 + 2] = base[v * 3 + 2];
      uvA[k * 2] = uv[v * 2];
      uvA[k * 2 + 1] = uv[v * 2 + 1];
      cen[k * 3] = centres[i].x;
      cen[k * 3 + 1] = centres[i].y;
      cen[k * 3 + 2] = centres[i].z;
      siz[k * 2] = size;
      siz[k * 2 + 1] = size;
      tA[k] = t;
      roll[k] = r;
      seedA[k] = sd;
      shrinkA[k] = p.shrink;
    }
    const o0 = i * 4;
    for (let q = 0; q < 6; q++) idx.push(o0 + index[q]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  geo.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 2));
  geo.setAttribute('aT', new THREE.BufferAttribute(tA, 1));
  geo.setAttribute('aRoll', new THREE.BufferAttribute(roll, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));
  geo.setAttribute('aShrink', new THREE.BufferAttribute(shrinkA, 1));
  geo.setIndex(idx);

  const tex = noiseTexture();

  const mk = (pass) => new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: tex },
      uTime: { value: 0 },
      uScroll: { value: p.scroll },
      uMipBias: { value: p.mipBias },
      uEdge: { value: 0.5 },
      uCut: { value: 0.055 },
      uPass: { value: pass },
      uAlpha: { value: p.alpha },
      uColorA: { value: new THREE.Color(p.colorA) },
      uColorB: { value: new THREE.Color(p.colorB) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const m0 = mk(0);
  const m1 = mk(1);

  // MAX 混合：重叠处取更亮的那个，合成共同剪影；ADD 会在浅底上糊成白缝
  const applyBlend = (mat, max) => {
    if (max) {
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneFactor;
      mat.blendEquation = THREE.MaxEquation;
    } else {
      mat.blending = THREE.NormalBlending;
    }
    mat.needsUpdate = true;
  };
  applyBlend(m1, true);   // 亮层用 MAX
  applyBlend(m0, false);  // 黑底用普通混合

  const mesh0 = new THREE.Mesh(geo, m0);
  const mesh1 = new THREE.Mesh(geo, m1);
  mesh0.renderOrder = 10;
  mesh1.renderOrder = 11;
  mesh0.frustumCulled = mesh1.frustumCulled = false;
  group.add(mesh0, mesh1);

  return {
    group,
    materials: { back: m0, front: m1 },
    geometry: geo,
    centres,
    params: p,
    update(t) {
      // 两个 pass 必须用同一个时间，否则 black 底和亮部描边会错位成两层重影
      m0.uniforms.uTime.value = t;
      m1.uniforms.uTime.value = t;
    },
    setMaxBlend(on) {
      applyBlend(m1, on);
    },
    setTwoPass(on) {
      mesh0.visible = on;
    },
    dispose() {
      geo.dispose();
      m0.dispose();
      m1.dispose();
    },
  };
}

/**
 * 一簇火焰：几张卡片围绕一条短轴，用 MAX 混合合成共同剪影。
 * 1056990611738451968 "New fire effect. For blend mode, I use Max instead of Add"
 */
export function makeFlame(o = {}) {
  // 注意：火焰用 cards 计数，makeSmoke 认的是 count —— 这里显式转一次，
  // 否则 {cards:26} 会被忽略、默默用默认的 42 片。
  const { cards = 9, ...rest } = o;
  const p = {
    count: cards, span: 0.9, baseSize: 0.5, tipSize: 0.12, shrink: 0.85,
    width: 0.12, scroll: 0.24, mipBias: 2.4, seed: 21,
    colorA: '#ffd36a', colorB: '#ff5f2e', alpha: 1.0, ...rest,
  };
  const s = makeSmoke(p);
  // 火焰不用黑底那遍：它没有"压在墙上的实心基部"，只有发光体
  s.group.children[0].visible = false;
  s.setTwoPass = () => {};
  return s;
}
