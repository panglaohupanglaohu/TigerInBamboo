/**
 * view-c10.js — 第 56 批 C10（水 / 展示）接进 View 的开关，全部默认关。
 * 打开：URL `?c10=foammask,fluid`，或运行时 `rea.c10.set('foammask', true)`。挂钩只有 app.js 一行。
 *
 *   foammask  1849732997945110651「a global water mask texture that adds extra foam around rocks and stuff」
 *             water/foam-mask.js buildFoamMask → 单通道 DataTexture 铺一张覆盖全岛的水面平面；片元里再用随时间
 *             滚动的值噪声把遮罩切碎成斑块（不是整圈实心白边），叠在岸浪带下面、反射上面。
 *   fluid     1664565063552847873「shader based fluid simulation」的绕岛色场：water/foam-mask.js ObstacleFlow
 *             （陆地固壁、MAC 压力投影得到的绕岛无散度来流、半拉格朗日、入流色带边界、可选 f16 存储），每帧 CPU 推进后上传 RGB 纹理。
 *             CPU 替代 GPU 计算，原因见模块头；GPU 精度对表在 world/float-advect-gpu.js（r55）。
 *   shoreclamp 1849732997945110651「The waves travel from the blue line to the yellow」的防穿岸：shore.js 的蓝线点在窄水道里
 *             会按 march 上限推进到对岸陆地里（auditShore 实测 town 17% / terrain 12% 的浪带顶点路径穿岸）。每次岸浪
 *             几何重建后，把穿岸顶点的蓝线点收回到碰陆之前，aIn/aOut 同比缩放（water/foam-mask.js clampWavePaths）。
 */
import * as THREE from 'three';
import { rasterLand, buildFoamMask, ObstacleFlow, auditWavePaths, clampWavePaths } from '../water/foam-mask.js';

export const C10_KEYS = Object.freeze(['foammask', 'fluid', 'shoreclamp']);
export function parseC10(s) { return new Set(String(s || '').split(',').map((x) => x.trim()).filter((x) => C10_KEYS.includes(x))); }

function landRaster(view, res, pad = 2.5) {
  const town = view.town, shape = view.worldMesh?.shape;
  const ptsOf = shape ? (c) => c.pts.map((p) => { const [x, z] = shape.at(p, 0); return { x, z }; }) : (c) => c.pts;
  return rasterLand(view.grid.cells, (c) => town.isSolid(c, 1), ptsOf, { res, pad });
}
function planeFor(R, y) {
  const w = (R.W - 1) * R.res, h = (R.H - 1) * R.res, g = new THREE.PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2); g.translate(R.minX + w / 2, y, R.minZ + h / 2);
  // PlaneGeometry 转平后 uv.y=1 在 -z 一侧；改成 v 随 z 增大，直接对上栅格行号
  const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return g;
}

class FoamMaskLayer {
  constructor(view) {
    this.view = view; this.version = -1;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMask: { value: null }, uTime: view.waterUniforms.uTime, uFoam: { value: new THREE.Color('#f4fbfa') }, uTexel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; varying vec2 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: /* glsl */ `
        uniform sampler2D uMask; uniform float uTime; uniform vec3 uFoam; varying vec2 vUv; varying vec2 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          float m = texture2D(uMask, vUv).r;
          if (m < 0.01) discard;
          // 两层反向漂移的值噪声：遮罩越强，越多噪声值过阈值 → 岩石边一簇簇碎泡沫
          float n = 0.6 * vn(vW * 7.0 + vec2(uTime * 0.11, -uTime * 0.07)) + 0.4 * vn(vW * 15.0 - vec2(uTime * 0.05, uTime * 0.13));
          float th = 1.0 - 1.25 * m; float a = smoothstep(th, th + 0.2, n) * min(1.0, m * 2.0);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uFoam, a * 0.85);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 2; this.mesh.frustumCulled = false; view.scene.add(this.mesh);
  }
  refresh() {
    const v = this.view; if (this.version === v.town.version) return;
    const t0 = performance.now(), R = landRaster(v, 0.06), M = buildFoamMask(R, { falloff: 0.4, radius: 1.4 });
    this.version = v.town.version;
    if (!M) { this.mesh.visible = false; return; }
    const data = new Uint8Array(M.W * M.H * 4);
    for (let k = 0; k < M.foam.length; k++) { const b = Math.round(M.foam[k] * 255); data[k * 4] = b; data[k * 4 + 1] = b; data[k * 4 + 2] = b; data[k * 4 + 3] = 255; }
    const tex = new THREE.DataTexture(data, M.W, M.H); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    this.mat.uniforms.uMask.value?.dispose(); this.mat.uniforms.uMask.value = tex;
    this.mesh.geometry.dispose(); this.mesh.geometry = planeFor(M, 0.009);
    this.stats = { ...M.stats, ms: Math.round(performance.now() - t0) };
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mat.uniforms.uMask.value?.dispose(); this.mat.dispose(); }
}

class FluidLayer {
  constructor(view, { storage = 'f32', angle = 0.6 } = {}) {
    this.view = view; this.version = -1; this.opts = { storage, angle };
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 2; this.mesh.frustumCulled = false; view.scene.add(this.mesh);
  }
  refresh() {
    const v = this.view; if (this.version === v.town.version) return;
    const R = landRaster(v, 0.12, 7); this.version = v.town.version;
    if (!R) { this.mesh.visible = false; return; }
    const tp = performance.now();
    this.flow = new ObstacleFlow(R, { speed: 2.2, angle: this.opts.angle, storage: this.opts.storage });
    this.flow.seed(6); this.projectMs = Math.round(performance.now() - tp);
    this.rgba = new Uint8Array(R.W * R.H * 4);
    // 圆形渐隐边（片子是一圆盘色场，不要方形硬边）
    this.fade = new Uint8Array(R.W * R.H);
    for (let j = 0; j < R.H; j++) for (let i = 0; i < R.W; i++) { const r = Math.hypot(i / (R.W - 1) - .5, j / (R.H - 1) - .5) * 2; this.fade[j * R.W + i] = 255 * Math.min(1, Math.max(0, (1 - r) / .25)); }
    this.tex?.dispose(); this.tex = new THREE.DataTexture(this.rgba, R.W, R.H); this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace; this.mat.map = this.tex; this.mat.needsUpdate = true;
    this.mesh.geometry.dispose(); this.mesh.geometry = planeFor(R, 0.011);
    this.upload();
  }
  upload() {
    const { dye, raster } = this.flow, out = this.rgba;
    for (let k = 0; k < raster.W * raster.H; k++) {
      out[k * 4] = dye[k * 3] * 255; out[k * 4 + 1] = dye[k * 3 + 1] * 255; out[k * 4 + 2] = dye[k * 3 + 2] * 255;
      out[k * 4 + 3] = raster.mask[k] ? 0 : this.fade[k];
    }
    this.tex.needsUpdate = true;
  }
  update(dt) {
    this.refresh(); if (!this.flow) return;
    const t0 = performance.now();
    this.flow.step(Math.min(dt, 1 / 20)); this.upload();
    this.stats = { W: this.flow.raster.W, H: this.flow.raster.H, t: +this.flow.time.toFixed(2), stepMs: +(performance.now() - t0).toFixed(1), storage: this.flow.storage, wallFlux: this.flow.stats.wallFlux, divBefore: +this.flow.stats.divBefore.toFixed(3), divAfter: +this.flow.stats.divAfter.toFixed(3), projectMs: this.projectMs };
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.tex?.dispose(); this.mat.dispose(); }
}

export function installC10(view, spec = '') {
  if (view.c10) return view.c10;
  const state = Object.fromEntries(C10_KEYS.map((k) => [k, false])), layers = {};
  const orig = view.render.bind(view);
  let clampedGeo = null;
  function clampShore() {
    const g = view.waves?.geometry, A = (n) => g?.getAttribute(n);
    if (!g || g === clampedGeo || !A('aShore') || !A('aSea')) return;
    clampedGeo = g; saved = { g, arr: ['aSea', 'aIn', 'aOut'].map((k) => A(k).array.slice()) };
    const before = auditWavePaths(landRaster(view, 0.04), A('aShore').array, A('aSea').array);
    const n = clampWavePaths(landRaster(view, 0.04), A('aShore').array, A('aSea').array, A('aIn').array, A('aOut').array);
    for (const k of ['aSea', 'aIn', 'aOut']) A(k).needsUpdate = true;
    const after = auditWavePaths(landRaster(view, 0.04), A('aShore').array, A('aSea').array);
    shoreStats = { clamped: n, before: before.ratio, after: after.ratio };
  }
  let shoreStats = null, saved = null;
  view.render = (dt) => {
    orig(dt);
    if (state.shoreclamp) clampShore();
    if (state.foammask) layers.foammask.refresh();
    if (state.fluid) layers.fluid.update(dt || 1 / 60);
  };
  function set(name, on) {
    if (!C10_KEYS.includes(name)) throw new RangeError('unknown c10 switch ' + name);
    on = !!on; state[name] = on;
    if (name === 'shoreclamp') {   // 关掉 = 让 View 重建一次原始岸浪几何
      if (!on && saved && saved.g === view.waves.geometry) ['aSea', 'aIn', 'aOut'].forEach((k, i) => { const a = saved.g.getAttribute(k); a.array.set(saved.arr[i]); a.needsUpdate = true; });
      if (!on) { clampedGeo = null; saved = null; }
      return on;
    }
    if (on) {
      layers[name] ??= name === 'foammask' ? new FoamMaskLayer(view) : new FluidLayer(view);
      layers[name].mesh.visible = true; layers[name].refresh();
    } else if (layers[name]) layers[name].mesh.visible = false;
    return on;
  }
  for (const k of parseC10(spec)) set(k, true);
  /** 审计当前岸浪带每个顶点 蓝线→黄线 的直线路径是否穿过陆地（只读，不改几何）。 */
  function auditShore(res = 0.04) {
    const g = view.waves?.geometry, a = g?.getAttribute('aShore'), b = g?.getAttribute('aSea');
    if (!a || !b) return null;
    return auditWavePaths(landRaster(view, res), a.array, b.array);
  }
  view.c10 = { set, state, layers, auditShore, get stats() { return { ...Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, l.stats])), shoreclamp: shoreStats }; } };
  return view.c10;
}
