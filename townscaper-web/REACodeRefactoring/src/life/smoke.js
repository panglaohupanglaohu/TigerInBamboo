/**
 * smoke.js — 浓烟（Bad North：着火的房子冒的黑烟）。
 *
 * 依据（四段连着的视频，同一个效果）：
 *   1015140880666300416 "Smoke effect. A full billowy base tied together by a crisp outline seamlessly transitioned to
 *     a blurry fade"   画面：着火的小屋冒出一股黑烟，底部翻滚饱满、外面一圈清楚的轮廓，往上越来越虚、被风吹斜。
 *   1015142746372366336 "drawing the effect in 2 passes. The first pass is black, and has a full alpha near the base.
 *     The second pass is lighter, more transparent towards the base, and has its cutoff pulled in 1 pixel
 *     (creating the crisp outline)"
 *   1015149712469524480 "I only sample my noise texture once per quad, but I scroll the UVs randomly forward or backward
 *     along the flow of the smoke"   画面：棋盘格调试贴图——每块的格子在沿烟的方向前后滑动。
 *   1015151731804721152 "I change the mip level of the noise texture throughout the smoke trail … crisp at the base to
 *     blurry at the tip"   画面：一块块方片，越往上贴图越糊。
 *
 * 实现：每个烟团是一张朝镜头的方片（InstancedMesh），属性 aAge（0 底 … 1 顶）、aSeed、aDir（UV 前 / 后滚）。
 *   形状 = 圆形衰减 × 噪声贴图（每个片元/每遍一次纹理指令，UV 沿流向滚），alpha 阈值化成硬边；
 *   噪声采样的 mip 偏移 = aAge × 4（越往上越糊）；阈值也随 aAge 变软 → "清楚 → 虚"。
 *   两遍：第一遍黑色、底部 alpha 满；第二遍浅灰、底部更透明、阈值往里收一个像素（fwidth）→ 黑色描边。
 *
 * 轮廓凹凸（第 55 轮补）：原片烟柱上边缘是 10–13 个各自鼓出的圆弧瓣，瓣间有凹陷缺口，
 *   不是一条光滑带。两条来源：① 每个烟团的噪声采样尺度按 seed 取 0.30–0.75（一卡只剩 1–2 个大瓣，
 *   边缘是圆滑的弧而不是细绒）；② 同一火源拆成 3 个错相子发射点，每 0.40s 成簇吐 3 片
 *   → 烟柱沿程自然分组，每组一团、组间留缝。关闭 lobes 回到「0.05s 单片、共用 UV 0.55」的旧观感。
 *
 * 第 63 轮（原尺寸 3 倍裁切 frame-0150 复核，纠正第 60 轮的「9 个偏小偏密」口径）：
 *   原片柱身是 **6–7 个直径≈柱宽的大圆瓣**，瓣与瓣之间只有浅浅一道缝，不是一串小点。
 *   本仓 `fine` 口径是「每 0.15s 一片 × 2 错相子发射点」→ 柱高 2.6 单位里塞 26 张卡，
 *   噪声尺度 0.30–0.75 只够 1–2 个小瓣 → 读起来是细绒。`big` 口径把发射间隔放到 0.36s、
 *   子发射点合 1、噪声尺度收到 0.12–0.30、尺寸离散度拉到 0.86–1.52 → 柱高只剩 9–11 张卡，
 *   每张卡 1 个大瓣，瓣径≈柱宽。两条口径都保留，靠 `setLobeStyle('fine'|'big')` 切换。
 *   ② 原片主柱顶端是**断开**的：柱身到某一高度就没了，上面另有一团独立的深色烟。
 *   机制是「分组发射」——每组 0.62s 吐 2–3 片、组间 0.16s 静默；静默窗在高度上留下一段真空，
 *   最上面那一组于是和柱身脱开成独立顶团（`setTopBreak(true)`，默认关）。
 *   ③ 两柱之间还有一层**低对比、完全模糊**的弥散薄雾，贴地 0.3–1.4 单位、横向铺 8–14 单位、
 *   alpha 只有 0.05–0.12、边缘没有描边（`setHaze(true)`，默认关）。
 */

import * as THREE from 'three';
import { smokeDepthOrder } from '../core/smoke-order.js';
import { FIRE_COUPLING, igniteCurve, easeSizeMul, burstPlan } from './fire-coupling.js';

const N = 240;
const NH = 8;   // 弥散薄雾层片数（每个火源最多 8 片，横向铺开）

/** 第 69 轮：薄雾厚宽的**实测标定**（第 68 轮只实核、没报数字）。
 *  量法：原片 1015142746372366336 frame-0100（400×400，天空 luma 158.8），在柱身中段 x=210…330 逐列取剖面 ——
 *    强烟 = luma < 天空−45 的行、淡边 = 天空−45 < luma < 天空−8 的行；
 *    强烟厚度均值 36.3 px，淡边（雾）厚度均值 32.9 px → **雾厚/柱厚 = 0.91**。
 *  所以薄雾不是「一层很厚的地面雾」，是**比柱身略薄、但横向铺得开得多**的一条带：
 *    竖向总高 ≈ 0.91 × 柱厚（本仓 fine 口径柱厚 ≈1.14 单位 → 雾带 ≈1.04：卡高 0.55–0.90 + 贴地 0.16–0.54），
 *    横向每片 4.6–8.0 单位（旧值 3.2–6.0 偏窄），alpha 仍 0.045–0.12（原片淡边几乎读不出边）。 */
export const HAZE_STYLE = Object.freeze({
  thicknessRatio: 0.91,     // 实测：雾厚 / 柱厚
  bandThickness: 1.14,      // fine 口径柱身厚度（LOBE_STYLE.fine.spreadMin+spreadSpan/2）
  yMin: 0.16, ySpan: 0.38,  // 贴地高度范围
  syMin: 0.55, sySpan: 0.35,// 单片竖向尺寸
  sxMin: 4.6, sxSpan: 3.4,  // 单片横向尺寸
  side: 3.2,                // 侧向抖动（格宽量级）
});

/** 第 72 轮：顶团（断口上方那一团）自己的尺寸与寿命。
 *  原片 1015142746372366336 frame-0150（400 宽原尺寸 3 倍裁切）：断口上方那一团不只是一个被切下来的柱段——
 *  它比柱身卡大一圈、升得更快、并且**在柱身那批卡都淡完之后仍然挂着**（frame-0170…0190 柱顶已经散开、
 *  上面那团边界还清楚）。第 64 轮只做了「+24% 尺寸」，寿命仍与柱身共用 `st.lifeMin/lifeSpan`，
 *  所以顶团比柱身早死，观感是「顶上那块塌下来」。这里给顶团独立寿命与独立上升速度：
 *    · scale   ：相对同卡尺寸的倍数（沿用第 64 轮实测 +24%，回归判据不动）；
 *    · lifeMul ：寿命倍数（1.45 → 顶团比柱身晚淡约半个周期）；
 *    · riseMul ：上升速度倍数（1.18 → 断口那团升得更快，缝拉得开）。 */
export const CROWN_STYLE = Object.freeze({ scale: 1.24, lifeMul: 1.45, riseMul: 1.18 });

/** 第 63 轮：两条瓣尺度口径。`fine` = 第 55/59 轮的旧观感（细绒、每卡 1–2 个小瓣）；
 *  `big` = 原片实测（每 0.36s 一片、每卡 1 个大瓣、瓣径≈柱宽）。
 *  第 77 轮（1015142746372366336 缺口 ①「瓣径/柱长偏胖 1.72×」）：按原片硬数字重标 `big`——
 *  原片 span 449px / 瓣径 66px = 0.147，本仓量得 0.253（diam 78.4 / span 309.2，同判据离屏 420×420）。
 *  差距拆成两半：卡片太胖（diam↓ ~0.63×）+ 爬升太短（span↑ ~1.2×）。
 *    · baseMin/baseAge 0.36/0.30 → 0.27/0.22、spreadMin/spreadSpan 0.68/0.96 → 0.62/0.78：中位直径 0.72×
 *    · vyMin/vySpan 0.55/0.12 → 0.66/0.14：同寿命下柱长 1.2×（fine 口径的上升速度保持原值不动）
 *  卡变小后根部会透空，所以 `big` 的 interval 同时收紧 0.24 → 0.19（单位高度上的卡数反而更多），
 *  `smoke-solid-base-browser` 的「根部不透空」判据继续成立。 */
const LOBE_STYLE = {
  fine: { interval: 0.15, subs: 2, uvMin: 0.30, uvSpan: 0.45, spreadMin: 0.78, spreadSpan: 0.72, baseMin: 0.30, baseAge: 0.26, lifeMin: 4.4, lifeSpan: 1.4, jitter: 0.14, vyMin: 0.55, vySpan: 0.12 },
  big: { interval: 0.19, subs: 1, uvMin: 0.14, uvSpan: 0.22, spreadMin: 0.62, spreadSpan: 0.78, baseMin: 0.335, baseAge: 0.26, lifeMin: 4.6, lifeSpan: 1.2, jitter: 0.24, vyMin: 0.72, vySpan: 0.14 },
};

function noiseTexture(size = 64, checker = false) {
  // 可平铺的值噪声（两层），带 mipmap
  const d = new Uint8Array(size * size * 4);
  const r = (x, y, s) => { const h = Math.sin((((x % s) + s) % s) * 127.1 + (((y % s) + s) % s) * 311.7) * 43758.5453; return h - Math.floor(h); };
  const vn = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = r(xi, yi, s), b = r(xi + 1, yi, s), c = r(xi, yi + 1, s), e = r(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = checker ? ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) : 0.65 * vn(x / 8, y / 8, size / 8) + 0.35 * vn(x / 4, y / 4, size / 4);
    const k = (y * size + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = (n * 255) | 0; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class Smoke {
  constructor({ scene, uTime, random = Math.random, lobes = true }) {
    this.random = random; this.serial = 0;
    this.uTime = uTime;
    this.sources = [];
    this.lobes = lobes;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aAge = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aDir = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aFlow = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    // 每卡自己的噪声采样尺度（0.30–0.75）：一卡只剩 1–2 个大瓣 → 边缘是弧，不是细绒
    this.aUv = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(0.55), 1);
    // 第 64 轮顶团：断口上方那一组要和柱身不同 —— 原片顶团更圆、边界更清楚、尺寸略大、也更暗。
    this.aCrown = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    // 实心核心长度（第 59 轮）：原片烟柱到很靠后才变淡，只有顶端一小截是虚的；
    // 旧值 0.55 让中段就已经透底，整条柱读起来是「一串小圆点」。
    this.core = 0.55;
    this.solidBase = true;
    // 第 89 轮：火光 × 烟体积耦合（曲线在 fire-coupling.js，纯函数可单测）。
    // 默认关 —— 打开会改变已有烟柱的卡片尺寸，会让 solid-base / lobe-size 两条回归判据失效。
    this.fireOn = false;
    geo.setAttribute('aFlow', this.aFlow);
    geo.setAttribute('aUv', this.aUv);
    geo.setAttribute('aCrown', this.aCrown);
    geo.setAttribute('aAge', this.aAge); geo.setAttribute('aSeed', this.aSeed); geo.setAttribute('aDir', this.aDir);
    const tex = noiseTexture();
    this.checkerTexture = noiseTexture(64, true);
    // Shared controls keep both passes identical; checker uses real mipmaps.
    const sampling = { uScroll: { value: 1 }, uMip: { value: 1 }, uChecker: { value: this.checkerTexture }, uLobe: { value: lobes ? 1 : 0 }, uCore: { value: 0.55 } };
    const mat = (pass) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uNoise: { value: tex }, uTime, uDebug: { value: 0 }, ...sampling },
      defines: { PASS: pass },
      vertexShader: /* glsl */ `
        attribute float aAge; attribute float aSeed; attribute float aDir; attribute vec2 aFlow; attribute float aUv; attribute float aCrown;
        varying vec2 vFlow; varying vec2 vUv; varying float vAge; varying float vSeed; varying float vDir; varying float vUvScale; varying float vCrown;
        void main() {
          vFlow = aFlow; vUv = uv; vAge = aAge; vSeed = aSeed; vDir = aDir; vUvScale = aUv; vCrown = aCrown;
          vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float s = length(instanceMatrix[0].xyz);
          // 朝镜头的方片
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = c + (right * position.x + up * position.y) * s;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform sampler2D uChecker;
        uniform float uScroll;
        uniform float uMip;
        uniform float uTime;
        uniform float uDebug;
        uniform float uLobe;
        uniform float uCore;
        varying vec2 vFlow; varying vec2 vUv; varying float vAge; varying float vSeed; varying float vDir; varying float vUvScale; varying float vCrown;
        void main() {
          // 1015149712469524480: one texture instruction per fragment/pass, not one GPU fetch per quad.
          // Rotate UV axes to the projected particle velocity, including camera orbit.
          vec2 centered = vUv - 0.5;
          vec2 aligned = vec2(dot(centered, vec2(vFlow.y, -vFlow.x)), dot(centered, vFlow)) + 0.5;
          vec2 nuv = aligned * vUvScale + vec2(vSeed * 7.13, vSeed * 3.71 + vDir * uTime * 0.35 * uScroll);
          // 1015151731804721152: bias adds to derivative-selected LOD, not an exact mip index.
          float bias = vAge * 4.0 * uMip;
          float n;
          if ((uDebug > 0.5 && uDebug < 1.5) || uDebug > 2.5) n = texture2D(uChecker, nuv, bias).r;
          else n = texture2D(uNoise, nuv, bias).r;
          // Raw square cards isolate sampling from shape/alpha fade.
          if (uDebug > 1.5) {
            gl_FragColor = vec4(vec3(n), 1.0);
            #include <colorspace_fragment>
            return;
          }
          float r = length(vUv - 0.5) * 2.0;
          // 低尺度噪声让单卡边缘成为 1–2 个大瓣；lobes 打开时再加大边界扰动幅度
          float shape = (1.0 - r) + (n - 0.5) * mix(0.9, 0.5, vAge) * mix(1.0, 1.55, uLobe);
          // 阈值：底部硬、往上软（清楚 → 虚）
          // 顶团例外：原片那团到快散掉时边界仍然是清楚的 → vCrown 把 soft 压回 0.015
          float soft = mix(mix(0.02, 0.45, vAge), 0.015, vCrown);
          // 顶团散得更晚（uCore +0.20）：脱开的那一团不会先于柱身变虚
          float core = mix(uCore, min(1.0, uCore + 0.20), vCrown);
          float px = fwidth(shape);
          #if PASS == 0
            // 第一遍：黑，底部 alpha 满
            float a = smoothstep(0.0, soft + px, shape) * mix(1.0, 0.0, smoothstep(core, 1.0, vAge));
            gl_FragColor = vec4(vec3(0.03, 0.03, 0.038), a);
          #else
            // 第二遍：比第一遍浅、底部更透明、阈值往里收 1 像素 → 第一遍露出一圈黑描边（1015142746372366336）
            // 明度按片子实测：烟体 sRGB ≈ 85（底部）→128（顶部），描边 ≈ 48（原实现 0.24/0.42 会亮到 170+，比天空还白）
            float a = smoothstep(px, soft + 2.0 * px, shape) * mix(0.7, 0.95, smoothstep(0.0, 0.5, vAge)) * mix(1.0, 0.0, smoothstep(core, 1.0, vAge));
            vec3 col = mix(vec3(0.10, 0.10, 0.115), vec3(0.22, 0.215, 0.24), vAge) * (0.9 + 0.2 * n) * mix(1.0, 0.80, vCrown);
            gl_FragColor = vec4(col, a);
          #endif
          #include <colorspace_fragment>
        }`,
    });
    this.back = new THREE.InstancedMesh(geo, mat(0), N);
    this.front = new THREE.InstancedMesh(geo, mat(1), N);
    this.back.renderOrder = 6; this.front.renderOrder = 7;
    this.back.frustumCulled = this.front.frustumCulled = false;
    this.back.count = this.front.count = 0;
    this.group = new THREE.Group();
    this.group.add(this.back, this.front);
    scene.add(this.group);
    this.setSolidBase(true);
    // 第 63 轮：瓣尺度 / 顶端断开 / 贴地薄雾三条口径，默认全关（= 第 62 轮及以前的观感，回归不动）
    this.lobeStyle = 'fine';
    this.topBreak = false;
    this.crownOn = true;
    this.crownCount = 0;
    this.clock = 0;
    this.#buildHaze(scene, tex);
    this.p = []; this.acc = 0;
  }

  set debugChecker(on) { this.setDebug(on ? 'checker' : 'off'); }
  setDebug(mode = 'off') {
    const value = { off: 0, checker: 1, noise: 2, cards: 3 }[mode];
    if (value === undefined) throw new RangeError('Unknown smoke debug mode');
    this.back.material.uniforms.uDebug.value = this.front.material.uniforms.uDebug.value = value;
  }
  setSampling({ scroll = true, mip = true } = {}) {
    this.back.material.uniforms.uScroll.value = scroll ? 1 : 0;
    this.back.material.uniforms.uMip.value = mip ? 1 : 0;
  }

  setPasses({ back = true, front = true } = {}) { this.back.visible = back; this.front.visible = front; }
  // 轮廓凹凸开关（第 55 轮）：关掉即回到「0.05s 单片、共用 UV 0.55」的旧观感，供对照与回归
  setLobes(on = true) {
    this.lobes = !!on;
    this.back.material.uniforms.uLobe.value = this.front.material.uniforms.uLobe.value = this.lobes ? 1 : 0;
    for (const s of this.sources) s.em = null;
  }
  clear() { this.p.length = 0; this.acc = 0; this.back.count = this.front.count = 0; }
  // 实心根部（第 59 轮）：原片根部是一整块近不透光的团，新生儿就有半个烟团大，
  // 相邻片互相压住 → 剪影闭合、没有透底的缝。关掉回到旧口径（新生儿 0.11、age 0.55 起淡）。
  setSolidBase(on = true) {
    this.solidBase = !!on;
    this.core = this.solidBase ? 0.76 : 0.55;
    this.back.material.uniforms.uCore.value = this.front.material.uniforms.uCore.value = this.core;
  }
  /** 贴地弥散薄雾（第 63 轮）：原片两根烟柱之间的低空有一层「完全模糊、低对比、无描边」的雾，
   *  横向能铺到 8–14 单位，纵向只有 0.8–1.6 单位。做法是 8 张大而扁的朝镜头方片，
   *  软径向衰减 × 极低 alpha（0.05–0.12），不做阈值化所以永远不会有硬边（和烟的 2 遍描边相反）。
   *  它自己的组、自己的 renderOrder（5，在所有烟之下），开关独立。 */
  #buildHaze(scene, tex) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.hazeSeedAttr = new THREE.InstancedBufferAttribute(new Float32Array(NH), 1);
    this.hazeKAttr = new THREE.InstancedBufferAttribute(new Float32Array(NH), 1);
    geo.setAttribute('aHazeSeed', this.hazeSeedAttr);
    geo.setAttribute('aHazeK', this.hazeKAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uNoise: { value: tex }, uTime: this.uTime, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aHazeSeed; attribute float aHazeK;
        varying vec2 vUv; varying float vSeed; varying float vK;
        void main(){
          vUv = uv; vSeed = aHazeSeed; vK = aHazeK;
          vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = c + (right * position.x * sx + up * position.y * sy);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise; uniform float uTime; uniform float uOpacity;
        varying vec2 vUv; varying float vSeed; varying float vK;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          // 两倍模糊的低频噪声：雾块之间只有明暗起伏，没有任何锐边
          float n = texture2D(uNoise, vUv * 0.55 + vec2(vSeed * 3.17, uTime * 0.012 * (vSeed - 0.5))).r;
          float a = pow(max(0.0, 1.0 - r), 2.2) * (0.55 + 0.45 * n) * (0.045 + 0.075 * vK);
          gl_FragColor = vec4(vec3(0.52, 0.55, 0.57), a * uOpacity);
          #include <colorspace_fragment>
        }`,
    });
    this.haze = new THREE.InstancedMesh(geo, mat, NH);
    this.haze.renderOrder = 5; this.haze.frustumCulled = false; this.haze.count = 0; this.haze.visible = false;
    this.hazeGroup = new THREE.Group();
    this.hazeGroup.add(this.haze);
    this.haze.material.uniforms.uTime = this.uTime;
    scene.add(this.hazeGroup);
    this.hazeOn = false;
    this.hazeStats = null;
  }
  /** 开关薄雾层；每帧按 sources 重新铺片（源变了才重铺）。 */
  setHaze(on = true) {
    this.hazeOn = !!on;
    this.haze.visible = this.hazeOn;
    this.haze.material.uniforms.uOpacity.value = this.hazeOn ? 1 : 0;
    if (this.hazeOn) this.#layoutHaze();
    return this.hazeOn;
  }
  #layoutHaze() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const seeds = [], ks = [];
    let n = 0;
    const keys = this.sources.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}`).join(';');
    // 源没动就整层跳过：否则每帧抽一次 random() 会让 8 片雾每帧换位置（闪）。
    if (keys === this.hazeKey && this.haze.count) return this.hazeStats;
    for (const s of this.sources) {
      for (let i = 0; i < NH; i++) {
        const t = i / NH;
        // 沿风向在下风侧铺开：0.6→5.6 单位，纵向贴地 0.3–1.4
        const along = 0.6 + t * 5.0 + (this.random() - 0.5) * 1.6;
        const side = (this.random() - 0.5) * HAZE_STYLE.side;
        // 第 69 轮：贴地高度与卡高按 HAZE_STYLE 的实测口径收窄（原片雾带 ≈0.91×柱厚）
        const y = s.y + HAZE_STYLE.yMin + this.random() * HAZE_STYLE.ySpan;
        const sx = HAZE_STYLE.sxMin + this.random() * HAZE_STYLE.sxSpan, sy = HAZE_STYLE.syMin + this.random() * HAZE_STYLE.sySpan;
        m.compose(v.set(s.x + along, y, s.z + side), q, sc.set(sx, sy, 1));
        this.haze.setMatrixAt(n, m);
        seeds.push(this.random()); ks.push(this.random());
        n++;
        if (n >= NH) break;
      }
      if (n >= NH) break;
    }
    this.haze.count = n;
    this.haze.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < n; i++) { this.hazeSeedAttr.setX(i, seeds[i]); this.hazeKAttr.setX(i, ks[i]); }
    this.hazeSeedAttr.needsUpdate = this.hazeKAttr.needsUpdate = true;
    this.hazeKey = keys;
    this.hazeStats = { quads: n, on: this.hazeOn, sxMin: +HAZE_STYLE.sxMin.toFixed(2), sxMax: +(HAZE_STYLE.sxMin + HAZE_STYLE.sxSpan).toFixed(2),
      syMin: HAZE_STYLE.syMin, syMax: +(HAZE_STYLE.syMin + HAZE_STYLE.sySpan).toFixed(2), thicknessRatio: HAZE_STYLE.thicknessRatio };
    return this.hazeStats;
  }
  /** 瓣尺度口径（第 63 轮）：'fine' 旧的细绒；'big' 原片的大圆瓣（每卡 1 瓣、瓣径≈柱宽）。 */
  setLobeStyle(style = 'fine') {
    if (!LOBE_STYLE[style]) throw new RangeError('Unknown smoke lobe style');
    this.lobeStyle = style;
    const st = LOBE_STYLE[style];
    this.style = st;
    for (const s of this.sources) s.em = null;   // 换口径要重排子发射点
    return st;
  }
  /** 顶端断开（第 63 轮）：分组发射，每组 0.62s 吐片、组间 0.16s 静默 → 高度上留真空，
   *  最上一组与柱身脱开成独立顶团（原片 frame-0150 上沿那条缝）。 */
  setTopBreak(on = true) { this.topBreak = !!on; for (const s of this.sources) s.em = null; return this.topBreak; }
  /** 顶团与柱身的差异（第 64 轮）：断口后复起的那一组更大 24%、边界更清楚、散得更晚、也更暗。
   *  关掉就回到「顶团只是位置脱开、外观与柱身一样」的第 63 轮观感（对照与回归用）。 */
  setCrown(on = true) {
    this.crownOn = !!on;
    if (!this.crownOn) for (const p of this.p) p.crown = 0;
    return this.crownOn;
  }
  /** 火光 × 烟体积耦合开关（第 89 轮，837027901853810688）。
   *  原片里「火」和「烟」是两条不同步的曲线：爆燃当刻火光最亮，0.18s 掉到 58%、0.39s 掉到 23%；
   *  而烟的体积在前 0.18s 就涨到 1.49×线性（面积 2.3×），之后**不回落**。
   *  所以耦合的方向是「火光当触发器、烟体积做积分」——火灭了烟还粗着，不是跟着火光一起缩。
   *  曲线本身在 `fire-coupling.js`（纯函数，`tests/fire-coupling.mjs` 按实测点零容差断言）。 */
  setFireCoupling(on = true) {
    this.fireOn = !!on;
    if (!this.fireOn) {
      for (const s of this.sources) { s.fireT = null; s.fireSize = 1; }
      for (const p of this.p) p.fm = 1;
    }
    return this.fireOn;
  }
  /** 点火：源 i 从此刻起计时。strength 只缩放光强（不缩放烟体积，体积按实测曲线走）。
   *  源还没铺（sources 为空）时返回 null —— 别静默吞掉，调用方要能判断没点着。 */
  ignite(i = 0, strength = 1) {
    const s = this.sources[i];
    if (!s) return null;
    if (!Number.isFinite(strength) || strength < 0) throw new RangeError('Invalid fire strength');
    this.fireOn = true;
    s.fireT = 0; s.fireStrength = strength; s.fireSize = 1;
    this.#burstPuff(s);            // 第 90 轮：爆燃当刻另吐一团新烟（不是柱身变粗）
    return this.fireAt(i);
  }
  /** 爆燃团参数（第 90 轮）。默认取 FIRE_COUPLING.burst；count=0 即关掉这团烟（回到第 89 轮的纯柱身版）。 */
  setFireBurst(cfg = null) {
    this.fireBurst = { ...FIRE_COUPLING.burst, ...(cfg || {}) };
    return this.fireBurst;
  }
  /** 爆燃团（第 90 轮起，837027901853810688）：点火当刻一次性吐 count 张卡铺在源点周围。
   *  为什么必须单独做：柱身卡片大量重叠，尺寸拉到 1.35× 时 alpha 覆盖面积只涨 1.40×（几何饱和），
   *  而原片 frame-0078 → 0084 是 5066 → 11777 px（2.30×）。多出来的是**新的一团烟**，不是老柱变粗。
   *  这批卡带 burst:1：不参与「向当前倍率靠拢」的缓动（否则 0.12s 内就被拉回 1.49）。
   *  第 91 轮：改成按高度分层（`burstPlan()`，柱脚 / 柱身中段 / 顶部翻卷三组），
   *  每组的 dy 是世界单位、直接加到源点 y 上 —— 原片多出来的不是柱脚一团球，是整根柱在高度上膨开。 */
  #burstPuff(s) {
    const cfg = this.fireBurst ?? FIRE_COUPLING.burst;
    const plan = burstPlan(cfg);
    const st = this.style ?? LOBE_STYLE[this.lobeStyle] ?? LOBE_STYLE.fine;
    const before = this.p.length;
    const perLayer = [];
    for (const L of plan.layers) {
      const n0 = this.p.length;
      for (let k = 0; k < L.count; k++) {
        if (this.p.length >= N) break;
        const a = (k / Math.max(1, L.count)) * Math.PI * 2 + this.random() * 0.6;
        const r = L.radius * (0.55 + this.random() * 0.55);
        const baseLife = st.lifeMin + this.random() * st.lifeSpan;
        this.p.push({
          crown: 0, serial: this.serial++, burst: 1, burstLayer: L.name,
          x: s.x + Math.cos(a) * r, y: s.y + L.dy * (0.72 + this.random() * 0.56), z: s.z + Math.sin(a) * r,
          age: cfg.age ?? 0.05, life: baseLife * L.lifeMul, l0: baseLife,
          v0: st.vyMin, seed: this.random(), dir: this.random() < 0.5 ? -1 : 1,
          vy: st.vyMin * L.riseMul, fm: L.sizeMul,
        });
      }
      perLayer.push({ name: L.name, cards: this.p.length - n0, dy: L.dy, sizeMul: L.sizeMul });
    }
    this.burstStats = { cards: this.p.length - before, layers: perLayer, planTotal: plan.total,
      yMin: plan.yMin, yMax: plan.yMax, at: +this.clock.toFixed(3), source: [s.x, s.y, s.z] };
    return this.burstStats;
  }
  /** 当前火光/体积倍率（不推进时间，纯读）。 */
  fireAt(i = 0) {
    const s = this.sources[i];
    if (!s || s.fireT == null) return { on: this.fireOn, t: null, light: 0, sizeMul: 1, area: 1 };
    const c = igniteCurve(s.fireT);
    return { on: this.fireOn, t: +s.fireT.toFixed(3), light: +(c.light * (s.fireStrength ?? 1)).toFixed(4),
      sizeMul: +c.sizeMul.toFixed(4), area: +c.area.toFixed(4) };
  }
  dispose() { this.group.parent?.remove(this.group); this.back.geometry.dispose(); this.back.material.uniforms.uNoise.value.dispose(); this.checkerTexture.dispose(); this.back.material.dispose(); this.front.material.dispose(); this.hazeGroup?.parent?.remove(this.hazeGroup); this.haze?.geometry.dispose(); this.haze?.material.dispose(); this.clear(); }

  update(dt = 0, wind, camera = null) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid smoke timestep');
    // Visual particles skip excess stall time, bounding emission/update work.
    dt = Math.min(dt, 0.1);
    const w = wind ?? new THREE.Vector3(1, 0, 0.3);
    this.clock += dt;
    const st = this.style ?? LOBE_STYLE[this.lobeStyle] ?? LOBE_STYLE.fine;
    // 发射：lobes 打开时每个源若干错相子发射点（相位差 1/N 周期），按口径决定间隔与子点数。
    //  fine：0.15s × 2 子点 → 柱高塞 26 张卡，读作细绒；
    //  big ：0.36s × 1 子点 → 柱高只剩 9–11 张卡，每卡 1 个大瓣、瓣径≈柱宽（原片 frame-0150）。
    const interval = this.lobes ? st.interval : 0.05;
    const burst = 1;
    const subs = this.lobes ? st.subs : 1;
    // 第 89 轮：先推进各源的点火计时，**再**发射 —— 新生儿要带着「点火后第几秒」的尺寸出生，
    // 否则第一批卡永远按常态尺寸出现，观感是「火先亮、烟两帧后才变粗」。
    let fireSizeMax = 1;
    if (this.fireOn) {
      for (const s of this.sources) {
        if (s.fireT == null) { s.fireSize = 1; continue; }
        s.fireT += dt;
        s.fireSize = igniteCurve(s.fireT).sizeMul;
        if (s.fireSize > fireSizeMax) fireSizeMax = s.fireSize;
      }
    } else for (const s of this.sources) s.fireSize = 1;
    this.fireSizeMax = fireSizeMax;
    if (this.sources.length) {
      for (const s of this.sources) {
        if (!s.em) {
          s.em = [];
          for (let i = 0; i < subs; i++) {
            const a = (i / subs) * Math.PI * 2;
            s.em.push({ acc: (i / subs) * interval, grp: (i / subs) * 0.32, ox: subs > 1 ? Math.cos(a) * 0.16 : 0, oz: subs > 1 ? Math.sin(a) * 0.16 : 0 });
          }
        }
        for (const em of s.em) {
          em.acc += dt;
          // 顶端断开：分组发射，静默窗在高度上留真空。静默期不吐片，acc 夹到一档避免恢复时连环爆。
          if (this.lobes && this.topBreak) {
            em.grp = (em.grp ?? 0) + dt;
            const T = 3.50 + 1.10;
            if (em.grp >= T) em.grp -= T;
            if (em.grp > 3.50) { if (em.acc > interval) em.acc = interval; continue; }
          }
          while (em.acc >= interval) {
            em.acc -= interval;
            for (let k = 0; k < burst; k++) {
              if (this.p.length >= N) break;
              const jitter = this.lobes ? st.jitter : 0.05;
              // 顶团标记：静默前那 0.5s 吐的一组（em.grp > 3.00，发射窗 3.50s）→ 它已经升到断口上方，
              // 更圆、边界更清楚、尺寸略大、更暗。复起的那组在柱脚，不算顶团。
              const crown = this.lobes && this.topBreak && this.crownOn !== false && em.grp > 3.00 ? 1 : 0;
              // 第 72 轮：顶团独立寿命 / 独立上升速度（CROWN_STYLE）。柱身仍用口径表里的 lifeMin/lifeSpan。
              const baseLife = this.lobes ? st.lifeMin + this.random() * st.lifeSpan : 3.2 + this.random();
              // 第 77 轮：上升速度进口径表（big 1.2×，为把柱长拉到原片的 span/瓣径 比）。
              const baseVy = this.lobes ? st.vyMin + this.random() * st.vySpan : 0.42 + this.random() * 0.12;
              this.p.push({ crown, serial: this.serial++, x: s.x + em.ox + (this.random() - 0.5) * jitter, y: s.y + (this.lobes ? (this.random() - 0.5) * 0.06 : 0), z: s.z + em.oz + (this.random() - 0.5) * jitter, age: 0, life: crown ? baseLife * CROWN_STYLE.lifeMul : baseLife, l0: baseLife, v0: baseVy, seed: this.random(), dir: this.random() < 0.5 ? -1 : 1, vy: crown ? baseVy * CROWN_STYLE.riseMul : baseVy, fm: s.fireSize ?? 1 });
            }
          }
        }
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0, crownCount = 0, crownLifeSum = 0, shaftLifeSum = 0, crownVySum = 0, shaftVySum = 0, shaftN = 0, lifeMulSum = 0, vyMulSum = 0;
    this.p = this.p.filter((p) => (p.age += dt / p.life) < 1);
    // 第 89 轮：已存在的卡也向当前火势靠拢（easeTau 0.12）——原片是整条柱一起变粗，
    // 不是只有新吐的卡粗、老的还细（那样柱身会出现一段「细腰」）。
    // 第 90 轮：burst 那团不参与缓动（它是爆燃当刻的一次性大团，不该被拉回柱身倍率）。
    if (this.fireOn && fireSizeMax > 1) for (const p of this.p) if (!p.burst) p.fm = easeSizeMul(p.fm ?? 1, fireSizeMax, dt);
    for (const p of this.p) {
      p.y += p.vy * dt * (1 - p.age * 0.6);
      p.x += w.x * dt * 0.3 * p.age * 2; p.z += w.z * dt * 0.3 * p.age * 2;
    }
    // 1015142746372366336: two passes do not remove instance sorting needs.
    if (camera) camera.updateMatrixWorld();
    const ordered = camera ? smokeDepthOrder(this.p, camera.matrixWorldInverse.elements) : this.p;
    this.drawOrder = ordered.map(p => p.serial);
    for (const p of ordered) {
      // solidBase：新生儿就有 0.26–0.37（旧口径 0.10–0.13），相邻片在根部互相压住 → 剪影闭合。
      // 尺寸离散度放宽到 0.78–1.50：个别团明显顶出去，剪影才是「各自鼓出的圆弧瓣」而不是均匀香肠。
      const s = this.lobes
        ? (this.solidBase ? st.baseMin + p.age * st.baseAge : 0.11 + p.age * 0.38)
          * (this.solidBase ? st.spreadMin + p.seed * st.spreadSpan : 0.88 + p.seed * 0.34)
        : 0.24 + p.age * 0.95;
      // 顶团尺寸略大（+24%，CROWN_STYLE.scale）：它和柱身脱开后不能还跟柱身一样宽。放在 CPU 侧 → 实例矩阵即真尺寸，可测。
      // 第 89 轮再乘火光耦合倍率 p.fm（常态 1，点着火 0.18s 后 ≈1.49）。
      const ss = (p.crown ? s * CROWN_STYLE.scale : s) * (p.fm ?? 1);
      m.compose(v.set(p.x, p.y, p.z), q, sc.set(ss, ss, ss));
      this.back.setMatrixAt(n, m); this.front.setMatrixAt(n, m);
      // 每卡独立噪声尺度：big 只取 0.12–0.30（一卡一个大瓣），fine 取 0.30–0.75（一卡 1–2 个小瓣）
      this.aUv.setX(n, this.lobes ? st.uvMin + p.seed * st.uvSpan : 0.55);
      // 1015149712469524480: scrolling follows trail motion in screen space.
      const vx = w.x * 0.6 * p.age, vy = p.vy * (1 - p.age * 0.6), vz = w.z * 0.6 * p.age;
      const e = camera?.matrixWorldInverse.elements;
      const fx = e ? e[0] * vx + e[4] * vy + e[8] * vz : 0;
      const fy = e ? e[1] * vx + e[5] * vy + e[9] * vz : 1;
      const len = Math.hypot(fx, fy);
      this.aFlow.setXY(n, len > 1e-6 ? fx / len : 0, len > 1e-6 ? fy / len : 1);
      this.aAge.setX(n, p.age); this.aSeed.setX(n, p.seed); this.aDir.setX(n, p.dir);
      this.aCrown.setX(n, p.crown || 0);
      if (p.crown) { crownCount++; crownLifeSum += p.life; crownVySum += p.vy; lifeMulSum += p.life / p.l0; vyMulSum += p.vy / p.v0; } else { shaftLifeSum += p.life; shaftVySum += p.vy; shaftN++; }
      n++;
    }
    this.back.count = this.front.count = n;
    this.back.instanceMatrix.needsUpdate = this.front.instanceMatrix.needsUpdate = true;
    this.aFlow.needsUpdate = this.aAge.needsUpdate = this.aSeed.needsUpdate = this.aDir.needsUpdate = this.aUv.needsUpdate = this.aCrown.needsUpdate = true;
    this.crownCount = crownCount;
    // 第 72 轮：顶团寿命是「真的比柱身长」还是只是 flag —— 这个统计让测试能直接量（不靠肉眼）。
    this.crownStats = { cards: n, crown: crownCount, lifeCrown: crownCount ? +(crownLifeSum / crownCount).toFixed(3) : 0,
      lifeShaft: shaftN ? +(shaftLifeSum / shaftN).toFixed(3) : 0,
      lifeRatio: crownCount && shaftN ? +((crownLifeSum / crownCount) / (shaftLifeSum / shaftN)).toFixed(3) : 0,
      vyCrown: crownCount ? +(crownVySum / crownCount).toFixed(4) : 0,
      vyShaft: shaftN ? +(shaftVySum / shaftN).toFixed(4) : 0,
      vyRatio: crownCount && shaftN ? +((crownVySum / crownCount) / (shaftVySum / shaftN)).toFixed(3) : 0,
      // 逐卡倍率（life/l0、vy/v0）：与随机抽样无关，直接量「顶团是不是自己的寿命/速度」
      lifeMulAvg: crownCount ? +(lifeMulSum / crownCount).toFixed(4) : 0,
      vyMulAvg: crownCount ? +(vyMulSum / crownCount).toFixed(4) : 0,
      style: { ...CROWN_STYLE } };
    if (this.hazeOn) this.#layoutHaze();
    // 第 89 轮：耦合状态做成可断言读数（不靠肉眼量截图）。
    this.fireStats = this.fireOn
      ? { on: true, gain: FIRE_COUPLING.smokeGain, cards: n,
          burstCards: this.p.filter((p) => p.burst).length,
          burstLayers: this.burstStats?.layers?.length ?? 0,
          meanFm: n ? +((ordered.reduce((a, p) => a + (p.fm ?? 1), 0)) / n).toFixed(4) : 1,
          maxFm: +fireSizeMax.toFixed(4),
          sources: this.sources.map((_, i) => this.fireAt(i)) }
      : null;
  }
}
