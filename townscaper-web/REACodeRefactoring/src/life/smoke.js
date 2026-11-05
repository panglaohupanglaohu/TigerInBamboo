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
 */

import * as THREE from 'three';
import { smokeDepthOrder } from '../core/smoke-order.js';

const N = 240;

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
  constructor({ scene, uTime, random = Math.random }) {
    this.random = random; this.serial = 0;
    this.uTime = uTime;
    this.sources = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aAge = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aDir = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.aFlow = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    geo.setAttribute('aFlow', this.aFlow);
    geo.setAttribute('aAge', this.aAge); geo.setAttribute('aSeed', this.aSeed); geo.setAttribute('aDir', this.aDir);
    const tex = noiseTexture();
    this.checkerTexture = noiseTexture(64, true);
    // Shared controls keep both passes identical; checker uses real mipmaps.
    const sampling = { uScroll: { value: 1 }, uMip: { value: 1 }, uChecker: { value: this.checkerTexture } };
    const mat = (pass) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uNoise: { value: tex }, uTime, uDebug: { value: 0 }, ...sampling },
      defines: { PASS: pass },
      vertexShader: /* glsl */ `
        attribute float aAge; attribute float aSeed; attribute float aDir; attribute vec2 aFlow;
        varying vec2 vFlow; varying vec2 vUv; varying float vAge; varying float vSeed; varying float vDir;
        void main() {
          vFlow = aFlow; vUv = uv; vAge = aAge; vSeed = aSeed; vDir = aDir;
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
        varying vec2 vFlow; varying vec2 vUv; varying float vAge; varying float vSeed; varying float vDir;
        void main() {
          // 1015149712469524480: one texture instruction per fragment/pass, not one GPU fetch per quad.
          // Rotate UV axes to the projected particle velocity, including camera orbit.
          vec2 centered = vUv - 0.5;
          vec2 aligned = vec2(dot(centered, vec2(vFlow.y, -vFlow.x)), dot(centered, vFlow)) + 0.5;
          vec2 nuv = aligned * 0.55 + vec2(vSeed * 7.13, vSeed * 3.71 + vDir * uTime * 0.35 * uScroll);
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
          float shape = (1.0 - r) + (n - 0.5) * mix(0.9, 0.5, vAge);
          // 阈值：底部硬、往上软（清楚 → 虚）
          float soft = mix(0.02, 0.45, vAge);
          float px = fwidth(shape);
          #if PASS == 0
            // 第一遍：黑，底部 alpha 满
            float a = smoothstep(0.0, soft + px, shape) * mix(1.0, 0.0, smoothstep(0.55, 1.0, vAge));
            gl_FragColor = vec4(vec3(0.08, 0.08, 0.1), a);
          #else
            // 第二遍：浅一些、底部更透明、阈值往里收 1 像素 → 第一遍露出一圈黑描边（1015142746372366336）
            float a = smoothstep(px, soft + 2.0 * px, shape) * mix(0.7, 0.95, smoothstep(0.0, 0.5, vAge)) * mix(1.0, 0.0, smoothstep(0.55, 1.0, vAge));
            vec3 col = mix(vec3(0.24, 0.23, 0.26), vec3(0.42, 0.41, 0.44), vAge) * (0.85 + 0.3 * n);
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
  clear() { this.p.length = 0; this.acc = 0; this.back.count = this.front.count = 0; }
  dispose() { this.group.parent?.remove(this.group); this.back.geometry.dispose(); this.back.material.uniforms.uNoise.value.dispose(); this.checkerTexture.dispose(); this.back.material.dispose(); this.front.material.dispose(); this.clear(); }

  update(dt = 0, wind, camera = null) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid smoke timestep');
    // Visual particles skip excess stall time, bounding emission/update work.
    dt = Math.min(dt, 0.1);
    const w = wind ?? new THREE.Vector3(1, 0, 0.3);
    if (this.sources.length) {
      this.acc += dt;
      while (this.acc > 0.05) {
        this.acc -= 0.05;
        for (const s of this.sources) {
          if (this.p.length >= N) break;
          this.p.push({ serial: this.serial++, x: s.x + (this.random() - 0.5) * 0.05, y: s.y, z: s.z + (this.random() - 0.5) * 0.05, age: 0, life: 3.2 + this.random(), seed: this.random(), dir: this.random() < 0.5 ? -1 : 1, vy: 0.42 + this.random() * 0.12 });
        }
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    this.p = this.p.filter((p) => (p.age += dt / p.life) < 1);
    for (const p of this.p) {
      p.y += p.vy * dt * (1 - p.age * 0.6);
      p.x += w.x * dt * 0.3 * p.age * 2; p.z += w.z * dt * 0.3 * p.age * 2;
    }
    // 1015142746372366336: two passes do not remove instance sorting needs.
    if (camera) camera.updateMatrixWorld();
    const ordered = camera ? smokeDepthOrder(this.p, camera.matrixWorldInverse.elements) : this.p;
    this.drawOrder = ordered.map(p => p.serial);
    for (const p of ordered) {
      const s = 0.24 + p.age * 0.95;
      m.compose(v.set(p.x, p.y, p.z), q, sc.set(s, s, s));
      this.back.setMatrixAt(n, m); this.front.setMatrixAt(n, m);
      // 1015149712469524480: scrolling follows trail motion in screen space.
      const vx = w.x * 0.6 * p.age, vy = p.vy * (1 - p.age * 0.6), vz = w.z * 0.6 * p.age;
      const e = camera?.matrixWorldInverse.elements;
      const fx = e ? e[0] * vx + e[4] * vy + e[8] * vz : 0;
      const fy = e ? e[1] * vx + e[5] * vy + e[9] * vz : 1;
      const len = Math.hypot(fx, fy);
      this.aFlow.setXY(n, len > 1e-6 ? fx / len : 0, len > 1e-6 ? fy / len : 1);
      this.aAge.setX(n, p.age); this.aSeed.setX(n, p.seed); this.aDir.setX(n, p.dir);
      n++;
    }
    this.back.count = this.front.count = n;
    this.back.instanceMatrix.needsUpdate = this.front.instanceMatrix.needsUpdate = true;
    this.aFlow.needsUpdate = this.aAge.needsUpdate = this.aSeed.needsUpdate = this.aDir.needsUpdate = true;
  }
}
