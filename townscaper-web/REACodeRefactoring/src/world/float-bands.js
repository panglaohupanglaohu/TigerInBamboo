/**
 * float-bands.js — 1664565063552847873 "shader based fluid simulation … needs 32 bit float render
 * targets … might also be a challenge to tweak, stylize, and feed back to CPU if needed"
 *
 * 片内 117 帧只有一件事：**一个被平流输运的连续标量场，按假彩色色带铺在岩台表面**。
 * 本仓 r55 已有能力面（`core/float-advect.js` 的存储/过滤对照、`world/float-probe.js` 的真
 * 16F/32F 读写），缺的是「把场画到真实 World 几何上」这一层 —— 本模块补的就是这层：
 *
 *   - 场：`core/float-advect.js#seedBlob + advect`（半拉格朗日、固定涡旋、clamp-to-edge），
 *     每帧推进 1 步；可切 `storage`（f32/f64/f16/u8）在 CPU 侧模拟写入精度。
 *   - 上传：RGBA float `DataTexture`（NearestFilter，片元里自己做四抽头双线性）——
 *     浮点目标不可线性过滤时正是这种接法（与 float-probe 的 f32/nearest 档对应）。
 *   - 贴面：**克隆真实 `view.worldMesh.geometry`**（同一批三角、同一套世界坐标），
 *     逐片元用该片元的世界 xz 采样场 → 色带；所以色带会随台地/崖壁起伏弯折，
 *     不会像全屏平板那样铺满天空。
 *   - 配色：5 段 plasma 近似，GPU（`paletteGLSL`）与 CPU（`paletteCPU`）同式，
 *     可逐点对表 —— 「画面里那块颜色确实是场值」这件事能量出来。
 *
 * 不是流体求解器；速度场是固定涡旋，没有 Navier–Stokes 的散度投影。
 * GPU 精度矩阵与跨平台可用性由 `float.html`（float-probe / float-advect-gpu）负责，不在此。
 */
import * as THREE from 'three';
import { advect, seedBlob, STORAGE } from '../core/float-advect.js';

/** plasma 近似停靠点（与片内色带同族：紫→品红→橙→黄）。 */
export const PLASMA_STOPS = Object.freeze([
  [0.0504, 0.0297, 0.5280], // 0.00 深紫
  [0.4940, 0.0120, 0.6580], // 0.25 紫红
  [0.7980, 0.2800, 0.4690], // 0.50 品红
  [0.9730, 0.5850, 0.2510], // 0.75 橙
  [0.9410, 0.9750, 0.1310], // 1.00 黄
]);

/** CPU 端调色板：分段线性（连续，无台阶）。t 会被夹到 [0,1]。 */
export function paletteCPU(t) {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const n = PLASMA_STOPS.length - 1, f = x * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
  const a = PLASMA_STOPS[i], b = PLASMA_STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** 同一段停靠点在 GLSL 里展开（与 paletteCPU 逐式对应）。 */
export const paletteGLSL = /* glsl */ `
vec3 paletteBands(float t){
  t = clamp(t, 0.0, 1.0) * 4.0;
  vec3 c0 = vec3(0.0504, 0.0297, 0.5280);
  vec3 c1 = vec3(0.4940, 0.0120, 0.6580);
  vec3 c2 = vec3(0.7980, 0.2800, 0.4690);
  vec3 c3 = vec3(0.9730, 0.5850, 0.2510);
  vec3 c4 = vec3(0.9410, 0.9750, 0.1310);
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  return mix(c3, c4, t - 3.0);
}`;

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uField;
uniform vec4 uBounds;   // minX, minZ, 1/spanX, 1/spanZ
uniform float uSize;    // 场的边长（纹素）
uniform float uQuant;   // 0 = 连续；>0 = 量化档数（A/B 用，模拟 8 位台阶）
uniform float uShade;   // 0 = 纯色带；1 = 叠一点法线明暗（片内色带随几何起伏）
uniform vec3 uLight;
varying vec3 vWorld;
varying vec3 vNormalW;
${paletteGLSL}
float texAt(vec2 uv){
  ivec2 p = ivec2(clamp(uv, vec2(0.0), vec2(1.0)) * (uSize - 1.0) + 0.5);
  return texelFetch(uField, p, 0).r;
}
float fieldAt(vec2 uv){
  vec2 g = clamp(uv, vec2(0.0), vec2(1.0)) * (uSize - 1.0);
  vec2 i0 = floor(g), f = g - i0;
  vec2 base = i0 / (uSize - 1.0);
  float t00 = texAt(base);
  float t10 = texAt(base + vec2(1.0 / (uSize - 1.0), 0.0));
  float t01 = texAt(base + vec2(0.0, 1.0 / (uSize - 1.0)));
  float t11 = texAt(base + vec2(1.0 / (uSize - 1.0), 1.0 / (uSize - 1.0)));
  return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
}
void main(){
  vec2 uv = (vWorld.xz - uBounds.xy) * uBounds.zw;
  float v = fieldAt(uv);
  if (uQuant > 0.5) v = floor(v * uQuant + 0.5) / uQuant;
  vec3 col = paletteBands(v);
  if (uShade > 0.5) {
    float d = clamp(dot(normalize(vNormalW), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    col *= mix(1.0, 0.70 + 0.30 * d, uShade);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * 片内那张场不是同心圆：色带在几处偏心的亮斑之间被拉长、被涡旋拧着走。
 * `seedBlob` 是正圆盘 —— 绕中心旋转是**不变量**，直接拿它做「场在动」的验收会假绿。
 * 本函数 = 正圆盘 + 两个偏心斑 + 一道斜向脊，同为确定式。
 */
export function seedField(size) {
  const base = seedBlob(size), a = new Float64Array(size * size);
  const blob = (x, y, cx, cy, r) => { const d = Math.hypot(x - cx, y - cy) / r; return Math.max(0, 1 - d) ** 2; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    const ridge = 0.28 * Math.max(0, Math.sin((u * 1.9 + v * 1.1) * Math.PI)) * Math.exp(-((u - 0.5) ** 2 + (v - 0.44) ** 2) / 0.06);
    a[y * size + x] = base[y * size + x] + 0.75 * blob(u, v, 0.66, 0.34, 0.26) + 0.55 * blob(u, v, 0.3, 0.72, 0.2) + ridge;
  }
  return a;
}

/** 世界 xz 包围盒 → 场采样区间（留 8% 边距，避免边界采样贴死）。 */
export function boundsOf(geometry, { pad = 0.08 } = {}) {
  const g = geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox, sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
  const m = Math.max(sx, sz) * pad;
  const minX = b.min.x - m, minZ = b.min.z - m;
  const spanX = Math.max(1e-6, sx + 2 * m), spanZ = Math.max(1e-6, sz + 2 * m);
  return { minX, minZ, spanX, spanZ, width: sx, depth: sz };
}

export function createFieldBands({ view, world, size = 128, storage = 'f32', dt = 0.02, spin = 0.35, quant = 0, shade = 1, field = null } = {}) {
  if (!view?.worldMesh?.geometry) throw new Error('createFieldBands 需要已构建的 view.worldMesh');
  if (!STORAGE[storage]) throw new RangeError('storage');
  if (!Number.isInteger(size) || size < 8 || size > 256) throw new RangeError('size 8..256');

  const geo = view.worldMesh.geometry.clone();
  const bounds = boundsOf(geo);
  const seed = field ?? seedField(size);
  let state = Float64Array.from(seed, STORAGE[storage]);
  const data = new Float32Array(size * size * 4);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uField: { value: tex },
      uBounds: { value: new THREE.Vector4(bounds.minX, bounds.minZ, 1 / bounds.spanX, 1 / bounds.spanZ) },
      uSize: { value: size },
      uQuant: { value: quant },
      uShade: { value: shade },
      uLight: { value: new THREE.Vector3(0.45, 0.82, 0.35).normalize() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  view.scene.add(mesh);

  function upload() {
    for (let i = 0; i < state.length; i++) {
      const v = state[i];
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 1;
    }
    tex.needsUpdate = true;
  }
  upload();

  /** 双线性采样（与片元着色器同口径，边缘 clamp）。 */
  function sampleCPU(x, z) {
    const u = (x - bounds.minX) / bounds.spanX, w = (z - bounds.minZ) / bounds.spanZ;
    const gx = Math.min(size - 1, Math.max(0, u * (size - 1)));
    const gz = Math.min(size - 1, Math.max(0, w * (size - 1)));
    const x0 = Math.floor(gx), z0 = Math.floor(gz), fx = gx - x0, fz = gz - z0;
    const x1 = Math.min(size - 1, x0 + 1), z1 = Math.min(size - 1, z0 + 1);
    const at = (i, j) => state[j * size + i];
    return (at(x0, z0) * (1 - fx) + at(x1, z0) * fx) * (1 - fz) + (at(x0, z1) * (1 - fx) + at(x1, z1) * fx) * fz;
  }

  const api = {
    mesh, material, tex, bounds, size, geo,
    get storage() { return storage; },
    get steps() { return api._steps || 0; },
    get field() { return state; },
    tris: geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3,
    /** 推进 n 步（默认 1），返回累计步数。 */
    advance(n = 1) {
      state = advect(state, { size, steps: n, dt, spin, storage });
      api._steps = (api._steps || 0) + n;
      upload();
      return api._steps;
    },
    reset() {
      state = Float64Array.from(seed, STORAGE[storage]);
      api._steps = 0;
      upload();
      return api;
    },
    stepTo(total) { const d = total - (api._steps || 0); if (d > 0) api.advance(d); return api._steps; },
    setQuant(n) { material.uniforms.uQuant.value = Math.max(0, Number(n) || 0); return material.uniforms.uQuant.value; },
    setShade(v) { material.uniforms.uShade.value = v ? 1 : 0; },
    sampleCPU,
    cpuColorAt(x, z) { return paletteCPU(sampleCPU(x, z)); },
    /** 某个世界点走完整条 GPU 链路后应该得到的颜色（shade=1 时按朝上法线算明暗系数）。 */
    cpuColorShaded(x, z, { upDotLight = 0.82 } = {}) {
      const c = paletteCPU(sampleCPU(x, z));
      const shade = material.uniforms.uShade.value;
      const d = Math.min(1, Math.max(0, upDotLight * 0.5 + 0.5));
      const k = shade ? 0.7 + 0.3 * d : 1;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
    /** 固定机位（片内是一条静止机位、只慢慢推近）。 */
    setCamera({ distance = 15, pitch = 0.62, yaw = 0.7 } = {}) {
      const v = view;
      v.target.set((bounds.minX + bounds.minX + bounds.spanX) / 2, 1.1, (bounds.minZ + bounds.minZ + bounds.spanZ) / 2);
      v.distance = distance; v.pitch = pitch; v.yaw = yaw;
      v.updateCamera();
      return api;
    },
    /** 只读账：色带分辨率、几何来源、当前量化档。 */
    stats() {
      const g = geo;
      return {
        fieldSize: size, storage, quant: material.uniforms.uQuant.value,
        shade: material.uniforms.uShade.value,
        texture: { type: 'float', format: 'RGBA', filter: 'nearest+bilerp' },
        bounds: { minX: +bounds.minX.toFixed(4), minZ: +bounds.minZ.toFixed(4), spanX: +bounds.spanX.toFixed(4), spanZ: +bounds.spanZ.toFixed(4) },
        geometry: { triangles: api.tris, vertices: g.attributes.position.count, source: 'view.worldMesh.geometry.clone()' },
        steps: api._steps || 0,
        fieldRange: [Math.min(...state), Math.max(...state)].map((v) => +v.toFixed(5)),
      };
    },
    dispose() { view.scene.remove(mesh); geo.dispose(); material.dispose(); tex.dispose(); },
  };
  api._steps = 0;
  return api;
}
