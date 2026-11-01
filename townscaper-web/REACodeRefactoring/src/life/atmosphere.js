/**
 * atmosphere.js — 风场、雪、雾、远处的阴云（Bad North 的环境系统，第三个项目也沿用）。
 *
 * 依据：
 *   926903893866541057 "Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders"
 *     画面：岛周围一整片三维格点上的风向箭头，碰到岛就绕开、贴着崖壁转向。
 *   943230624369868800 "the snow flakes are affected by the wind system and thus flow around the island"
 *     画面：雪花顺着风绕岛流动，台地顶上积着白雪。
 *   906207980802252801 "new fog … For background effects, subtlety is key."
 *     画面：岛的四周一圈淡淡的雾，越远越浓，缓慢流动。
 *   1243228419162341379 "Some moody clouds"  画面：小镇身后的地平线上一排大片的灰白云。
 *
 * 风场：按层（每层 = 体素层高）存一张 2D 网格。每层先把"这一层是实心的格子"栅格化再模糊 → 阻挡度 b；
 *   风 = 基础风向 − 法向分量 × b（贴着障碍物只剩切向分量，绕着走）+ 一点向上（被岛挡住时往上抬）。
 *   sample(x, y, z) 三线性插值；uniform uWind（基础风向）给着色器用（旗子、云飘的方向）。
 * 雪：几千个点，每帧沿风场平流 + 下落；落进实心里或出界就从上风处重新生成；台地顶积雪由 World 着色时加白。
 * 雾：岛周围一张大圆盘，alpha 随半径增大、叠缓慢流动的噪声；颜色取背景色。
 */

import * as THREE from 'three';
import { pointInQuad } from '../core/spatial.js';

const RES = 0.45;

export class Atmosphere {
  constructor({ scene, levelHeight = 0.5, uTime }) {
    this.scene = scene;
    this.L = levelHeight;
    this.uTime = uTime;
    this.uWind = { value: new THREE.Vector3(1, 0, 0.35).normalize() };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.field = null;

    // 风向箭头（调试）
    this.arrows = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
    this.arrows.visible = false;
    this.arrows.frustumCulled = false;
    this.group.add(this.arrows);

    // 雪
    this.snowN = 3000;
    const sg = new THREE.BufferGeometry();
    this.snowPos = new Float32Array(this.snowN * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.snow.visible = false;
    this.snow.frustumCulled = false;
    this.group.add(this.snow);

    // 雾：一张大圆盘
    this.uFog = { value: new THREE.Color('#dfe6e8') };
    this.fogParams = { value: new THREE.Vector4(0, 0, 8, 24) };   // 中心 x, z, 内半径, 外半径
    const fg = new THREE.CircleGeometry(1, 96);
    fg.rotateX(-Math.PI / 2);
    this.fog = new THREE.Mesh(fg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime, uColor: this.uFog, uP: this.fogParams },
      vertexShader: /* glsl */ `
        uniform vec4 uP;
        varying vec2 vXZ;
        void main() {
          vec3 p = vec3(position.x * uP.w + uP.x, 0.28, position.z * uP.w + uP.y);
          vXZ = p.xz;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec4 uP;
        varying vec2 vXZ;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          float r = length(vXZ - uP.xy);
          float ring = smoothstep(uP.z, uP.w, r);
          float drift = n2(vXZ * 0.18 + vec2(uTime * 0.05, uTime * 0.02)) * 0.6 + n2(vXZ * 0.45 - vec2(uTime * 0.03, 0.0)) * 0.4;
          float a = ring * (0.55 + 0.45 * drift) * 0.85;     // 背景效果，宁淡勿浓
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
    }));
    this.fog.renderOrder = 8;
    this.fog.frustumCulled = false;
    this.fog.visible = false;
    this.group.add(this.fog);
  }

  set showArrows(on) { this.arrows.visible = on; }
  set showSnow(on) { this.snow.visible = on; if (on) this.#seedSnow(); }
  set showFog(on) { this.fog.visible = on; }
  setFogColor(hex) { this.uFog.value.set(hex).lerp(new THREE.Color('#ffffff'), 0.35); }

  /** 城镇 / 地形变了：重算风场、箭头、雾的范围。 */
  rebuild(world, index) {
    const cells = world.cells;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxTop = 0;
    for (const c of cells) {
      if (!world.top(c)) continue;
      minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
      maxTop = Math.max(maxTop, world.top(c));
    }
    if (!Number.isFinite(minX)) { minX = minZ = -4; maxX = maxZ = 4; }
    const pad = 4;
    const x0 = minX - pad, z0 = minZ - pad, x1 = maxX + pad, z1 = maxZ + pad;
    const W = Math.ceil((x1 - x0) / RES) + 1, H = Math.ceil((z1 - z0) / RES) + 1, LV = maxTop + 4;
    const cellAt = (x, z) => { for (const c of index.at(x, z)) if (pointInQuad(c.pts, x, z)) return c; return null; };
    // 地面高度图（格子顶），雪和风都要
    const ground = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = cellAt(x0 + i * RES, z0 + j * RES);
      ground[j * W + i] = c ? world.top(c) * this.L : 0;
    }
    // 每层阻挡度：实心 = 1，再模糊两遍
    const vx = new Float32Array(W * H * LV), vz = new Float32Array(W * H * LV), vy = new Float32Array(W * H * LV);
    const base = this.uWind.value;
    const occ = new Float32Array(W * H), tmp = new Float32Array(W * H);
    const blur = (a) => {
      const R = 3;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const ii = i + k; if (ii < 0 || ii >= W) continue; s += a[j * W + ii]; n++; } tmp[j * W + i] = s / n; }
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const jj = j + k; if (jj < 0 || jj >= H) continue; s += tmp[jj * W + i]; n++; } a[j * W + i] = s / n; }
      }
    };
    for (let lv = 0; lv < LV; lv++) {
      const y = (lv + 0.5) * this.L;
      for (let k = 0; k < W * H; k++) occ[k] = ground[k] > y ? 1 : 0;
      blur(occ);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const gx = (occ[j * W + Math.min(W - 1, i + 1)] - occ[j * W + Math.max(0, i - 1)]) / (2 * RES);
        const gz = (occ[Math.min(H - 1, j + 1) * W + i] - occ[Math.max(0, j - 1) * W + i]) / (2 * RES);
        const gl = Math.hypot(gx, gz);
        let wx = base.x, wz = base.z;
        const b = occ[k];
        if (gl > 1e-4) {
          const nx = -gx / gl, nz = -gz / gl;               // 指离障碍物
          const dot = wx * nx + wz * nz;
          if (dot < 0) { wx -= nx * dot * Math.min(1, b * 2.2); wz -= nz * dot * Math.min(1, b * 2.2); }   // 去掉"撞向障碍物"的分量 → 绕着走
          const sp = 1 + b * 0.6;                            // 贴边处加速
          wx *= sp; wz *= sp;
        }
        const o = lv * W * H + k;
        vx[o] = wx * (1 - b * 0.6); vz[o] = wz * (1 - b * 0.6);
        vy[o] = b * 0.55;                                    // 被挡住的气流往上抬
      }
    }
    this.field = { x0, z0, W, H, LV, vx, vy, vz, ground, maxTop };
    this.#buildArrows();
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.max(maxX - minX, maxZ - minZ) / 2;
    this.fogParams.value.set(cx, cz, R + 2.5, R + 22);
    if (this.snow.visible) this.#seedSnow();
  }

  /** 风场采样（世界坐标）。 */
  sample(x, y, z, out = new THREE.Vector3()) {
    const f = this.field;
    if (!f) return out.copy(this.uWind.value);
    const fi = Math.max(0, Math.min(f.W - 1.001, (x - f.x0) / RES)), fj = Math.max(0, Math.min(f.H - 1.001, (z - f.z0) / RES));
    const fl = Math.max(0, Math.min(f.LV - 1.001, y / this.L - 0.5));
    const i = fi | 0, j = fj | 0, l = fl | 0, tx = fi - i, tz = fj - j, tl = fl - l;
    const S = f.W * f.H;
    const g = (a) => {
      const at = (ll) => {
        const o = ll * S + j * f.W + i;
        return (a[o] * (1 - tx) + a[o + 1] * tx) * (1 - tz) + (a[o + f.W] * (1 - tx) + a[o + f.W + 1] * tx) * tz;
      };
      return at(l) * (1 - tl) + at(Math.min(f.LV - 1, l + 1)) * tl;
    };
    return out.set(g(f.vx), g(f.vy), g(f.vz));
  }

  groundAt(x, z) {
    const f = this.field;
    if (!f) return 0;
    const i = Math.round((x - f.x0) / RES), j = Math.round((z - f.z0) / RES);
    if (i < 0 || j < 0 || i >= f.W || j >= f.H) return 0;
    return f.ground[j * f.W + i];
  }

  #buildArrows() {
    const f = this.field, pos = [];
    const v = new THREE.Vector3();
    for (const lv of [1, Math.max(2, Math.floor(f.maxTop * 0.6))]) {
      const y = (lv + 0.5) * this.L;
      for (let j = 0; j < f.H; j += 2) for (let i = 0; i < f.W; i += 2) {
        const x = f.x0 + i * RES, z = f.z0 + j * RES;
        if (this.groundAt(x, z) > y) continue;
        this.sample(x, y, z, v);
        const s = 0.32;
        pos.push(x, y, z, x + v.x * s, y + v.y * s, z + v.z * s);
        // 箭头尖：一小段往回折
        const hx = -v.x * 0.08 - v.z * 0.04, hz = -v.z * 0.08 + v.x * 0.04;
        pos.push(x + v.x * s, y + v.y * s, z + v.z * s, x + v.x * s + hx, y + v.y * s, z + v.z * s + hz);
      }
    }
    this.arrows.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.arrows.geometry = g;
  }

  #spawn(k, anywhere) {
    const f = this.field;
    if (!f) return;
    const w = this.uWind.value;
    const spanX = f.W * RES, spanZ = f.H * RES;
    let x = f.x0 + Math.random() * spanX, z = f.z0 + Math.random() * spanZ;
    if (!anywhere) { // 从上风边进来
      if (Math.random() < Math.abs(w.x) / (Math.abs(w.x) + Math.abs(w.z))) x = w.x > 0 ? f.x0 : f.x0 + spanX;
      else z = w.z > 0 ? f.z0 : f.z0 + spanZ;
    }
    this.snowPos[k * 3] = x; this.snowPos[k * 3 + 1] = Math.random() * (f.maxTop + 4) * this.L + 0.3; this.snowPos[k * 3 + 2] = z;
  }
  #seedSnow() { for (let k = 0; k < this.snowN; k++) this.#spawn(k, true); }

  update(dt) {
    if (!this.snow.visible || !this.field) return;
    dt = Math.min(dt, 0.05);
    const v = new THREE.Vector3(), f = this.field, P = this.snowPos, t = this.uTime.value;
    for (let k = 0; k < this.snowN; k++) {
      const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
      this.sample(x, y, z, v);
      const flutter = Math.sin(t * 2.3 + k * 1.7) * 0.15;
      const nx = x + (v.x * 0.9 + flutter) * dt, ny = y + (v.y * 0.6 - 0.32) * dt, nz = z + (v.z * 0.9 + Math.cos(t * 1.9 + k) * 0.12) * dt;
      if (ny < this.groundAt(nx, nz) + 0.02 || ny < 0 || nx < f.x0 || nz < f.z0 || nx > f.x0 + f.W * RES || nz > f.z0 + f.H * RES) { this.#spawn(k, false); continue; }
      P[k * 3] = nx; P[k * 3 + 1] = ny; P[k * 3 + 2] = nz;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
  }
}
