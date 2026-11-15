/**
 * seaStyle.js — 全球海面统一成莫西斯湖（Townscaper）水面的样子。莫西斯湖本身不动，高山圣城海湾保持原样。
 *
 * 用到的学习结果（学习工坊 → 能力库）：
 *   1849732997945110651  黄线 = 岸线，蓝线 = 外推并平滑的岸线，浪从蓝线走到黄线再退回一点      → 岸带距离场 + 浪带位置
 *   1849730611964973481  "loads of overlapping waves that each go through their own cycle"     → 多层浪各自周期、彼此错开
 *   1215644531221311488  彩色中间倒影 + "the wave skirt stretches further"                      → 倒影颜色取水色与物体色中点；宽岸裙
 *   1783792917183606829  球面海陆、近岸色块与浪边                                              → 按离岸距离分深浅水色
 *   REACodeRefactoring src/core/wave-cycle.js（waveCycleGLSL）、src/water/reflection.js（中间色倒影）
 *
 * 做法（都不改海面网格、不改地形）：
 *   1. 岸带距离场：从星球中心向六个方向各渲一次「最高地表半径」，转成经纬网格（默认 2048×1024，赤道约 0.5 米/格），
 *      陆地 = 地表高于海面；对海面格做 8 邻域倒角距离变换（米）再轻微平滑（蓝线）。
 *   2. 海面着色：在现有海面材质上叠一层（同一组 uniform，原材质与圣城海湾层都保留），按距离场画水色、岸边白沫与光晕、多层外推浪带。
 *   3. 倒影：岸边建筑按海面球面做径向镜像，颜色取水色与物体色的中点，随深度淡出；顶点投到海面上取深度，
 *      所以被前景陆地挡住的地方自然看不到（不需要模板缓冲）。
 */
import * as THREE from 'three';

export const SEA_FINAL_KEY = 'tm.sea.style.final.v1';
export const DEFAULT_SEA_STYLE = Object.freeze({
  field: { res: 2048, maxDist: 64 },
  bay: { keep: false },
  tint: { on: true, shallow: '#74b3b8', deep: '#4f8f99', near: 1.2, far: 26, light: 1 },
  foam: { on: true, rim: 0.9, halo: 5, haloStrength: 0.5 },
  waves: { on: true, layers: 3, period: 4.6, reach: 3.2, jitter: 0.6, strength: 0.7 },
  reflection: { on: true, colorMix: 0.5, opacity: 0.82, fade: 0.3, distortion: 0.018, maxMeshes: 220, maxTris: 300000, maxHeight: 12 },
});
const MARK = '/*tm-sea-style*/';
const LAYER = 31;

// REACodeRefactoring src/core/wave-cycle.js · waveCycleGLSL（同一段循环：进浪 → 撞岸 → 退回一点，两端透明，循环无缝）
const WAVE_CYCLE = `
vec3 tmSeaShoreCycle(float t) {
  const float hit = 0.68;
  if (t < hit) { float u=t/hit; float f=1.0-u*u*(3.0-2.0*u); float a=smoothstep(0.05,0.55,u)*(0.12+0.78*u*u); return vec3(f,0.0,a); }
  float u=(t-hit)/(1.0-hit); return vec3(0.0,0.22*sin(u*1.57079632679),0.90*(1.0-u)*(1.0-u));
}`;
const NOISE = `
float tmSeaHash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float tmSeaNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(tmSeaHash(i),tmSeaHash(i+vec3(1,0,0)),f.x),mix(tmSeaHash(i+vec3(0,1,0)),tmSeaHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(tmSeaHash(i+vec3(0,0,1)),tmSeaHash(i+vec3(1,0,1)),f.x),mix(tmSeaHash(i+vec3(0,1,1)),tmSeaHash(i+vec3(1,1,1)),f.x),f.y),f.z); }`;

const clone = (o) => JSON.parse(JSON.stringify(o));
export function mergeSeaStyle(base, patch) {
  const out = clone(base || DEFAULT_SEA_STYLE);
  for (const [k, v] of Object.entries(patch || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(out[k] || {}), ...v } : v;
  return out;
}

// 不参与「陆地」的东西：水、云、天空、船和角色等会动的东西（会动的东西留在场里会产生过时的浪圈）
// 按名字里的「词」判断（用 - _ . 空格切开），不做子串匹配：terrain 里有 rain、starting 里有 star、snow-massif 是真山
const SKIP_WORDS = new Set(['ocean', 'water', 'cloud', 'clouds', 'sky', 'skybox', 'skydome', 'star', 'stars', 'aurora', 'airship', 'airships', 'ship', 'ships', 'boat', 'boats', 'fleet',
  'flatcar', 'wagon', 'carriage', 'railcar', 'tramcar', 'player', 'tiger', 'fox', 'bird', 'birds', 'gull', 'gulls', 'robot', 'robots', 'npc', 'particle', 'particles', 'smoke', 'spray',
  'foam', 'wave', 'waves', 'skirt', 'reflection', 'reflections', 'gizmo', 'helper', 'marker', 'snowfall', 'raindrops']);
const nameSkipped = (name) => { if (!name) return false; const w = name.toLowerCase().split(/[^a-z0-9]+/); return w.some((x) => SKIP_WORDS.has(x)) || /lake-surface|tm-sea-reflection/.test(name); };
// 连同上几层父节点一起看（很多网格就叫 Mesh，真正的名字在父节点上，例如 apostle-reacode-shore-skirt）
const skipByName = (o) => { for (let p = o, i = 0; p && i < 4; p = p.parent, i++) if (nameSkipped(p.name)) return true; return false; };
const isWaterMat = (m) => !!m?.uniforms?.uWaterKind || /water|ocean|lake/i.test(m?.name || '');
function landCandidate(o, center, rCap) {
  if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return false;
  if (skipByName(o)) return false;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some(isWaterMat)) return false;
  if (mats.every((m) => m?.transparent && (m.opacity ?? 1) < 0.6)) return false;
  for (let p = o; p; p = p.parent) if (p.visible === false) return false;
  o.geometry.boundingSphere || o.geometry.computeBoundingSphere();
  const bs = o.geometry.boundingSphere; if (!bs) return false;
  const c = bs.center.clone().applyMatrix4(o.matrixWorld).sub(center);
  return !(c.length() - bs.radius * o.matrixWorld.getMaxScaleOnAxis() > rCap);
}

function heightMaterial(rMin, rMax, center) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uCenter: { value: center.clone() }, uRMin: { value: rMin }, uRMax: { value: rMax } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=vec4(position,1.0);
      #ifdef USE_INSTANCING
      w=instanceMatrix*w;
      #endif
      w=modelMatrix*w; vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCenter; uniform float uRMin; uniform float uRMax; varying vec3 vW;
      void main(){ float r=length(vW-uCenter); if(r>uRMax||r<uRMin) discard; float k=(r-uRMin)/(uRMax-uRMin);
        gl_FragDepth=1.0-k; float v=floor(k*65535.0); gl_FragColor=vec4(floor(v/256.0)/255.0, mod(v,256.0)/255.0, 1.0, 1.0); }`,
  });
}

/** 从星球中心向六个方向渲染「最高表面半径」，返回按方向取样的函数。 */
function captureRadial(renderer, scene, objects, center, { size, rMin, rMax }) {
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, depthBuffer: true });
  const cam = new THREE.PerspectiveCamera(90, 1, 0.5, rMax + 50); cam.layers.set(LAYER);
  const mat = heightMaterial(rMin, rMax, center);
  const faces = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]];
  const saved = { rt: renderer.getRenderTarget(), auto: renderer.autoClear, color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), ov: scene.overrideMaterial, bg: scene.background, fog: scene.fog, shadow: renderer.shadowMap.autoUpdate };
  for (const o of objects) o.layers.enable(LAYER);
  const out = [];
  try {
    renderer.autoClear = true; renderer.setClearColor(0x000000, 0); scene.overrideMaterial = mat; scene.background = null; scene.fog = null; renderer.shadowMap.autoUpdate = false;
    for (const f of faces) {
      cam.position.copy(center); cam.up.set(f[3], f[4], f[5]); cam.lookAt(center.x + f[0], center.y + f[1], center.z + f[2]); cam.updateMatrixWorld(true);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
      const buf = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      out.push({ axis: f, buf, vp: vp.elements });
    }
  } finally {
    for (const o of objects) o.layers.disable(LAYER);
    renderer.setRenderTarget(saved.rt); renderer.autoClear = saved.auto; renderer.setClearColor(saved.color, saved.alpha);
    scene.overrideMaterial = saved.ov; scene.background = saved.bg; scene.fog = saved.fog; renderer.shadowMap.autoUpdate = saved.shadow;
    rt.dispose(); mat.dispose();
  }
  // 方向 → 半径（没有表面时返回 NaN）
  return (x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    const fi = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
    const { buf, vp: e } = out[fi];
    const px = center.x + x, py = center.y + y, pz = center.z + z;
    const w = e[3] * px + e[7] * py + e[11] * pz + e[15];
    const nx = (e[0] * px + e[4] * py + e[8] * pz + e[12]) / w, ny = (e[1] * px + e[5] * py + e[9] * pz + e[13]) / w;
    const ix = Math.min(size - 1, Math.max(0, Math.floor((nx * 0.5 + 0.5) * size))), iy = Math.min(size - 1, Math.max(0, Math.floor((ny * 0.5 + 0.5) * size)));
    const i = (iy * size + ix) * 4; if (buf[i + 2] < 128) return NaN;
    return rMin + ((buf[i] * 256 + buf[i + 1]) / 65535) * (rMax - rMin);
  };
}

/** 岸带距离场（经纬网格，米）：R = 水深 /20，G = 离岸距离 / maxDist，A = 有效。 */
export function buildShoreField({ renderer, scene, ocean, res = 2048, maxDist = 64, faceSize = 1024 }) {
  const t0 = performance.now();
  ocean.updateWorldMatrix(true, false);
  const center = new THREE.Vector3().setFromMatrixPosition(ocean.matrixWorld);
  ocean.geometry.boundingSphere || ocean.geometry.computeBoundingSphere();
  const R = ocean.geometry.boundingSphere.radius * ocean.matrixWorld.getMaxScaleOnAxis();
  const rMin = R - 90, rMax = R + 160;
  const land = []; scene.traverse((o) => { if (o !== ocean && landCandidate(o, center, rMax)) land.push(o); });
  const landR = captureRadial(renderer, scene, land, center, { size: faceSize, rMin, rMax });
  const seaR = captureRadial(renderer, scene, [ocean], center, { size: 256, rMin, rMax });
  // 距离场放在海面自己的坐标系里（海面局部方向 → 世界方向再取样），星球根节点旋转也对得上
  const q = new THREE.Quaternion(); ocean.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); const v = new THREE.Vector3();
  const W = res, H = res >> 1, n = W * H;
  const dist = new Float32Array(n), depth = new Float32Array(n), isLand = new Uint8Array(n);
  let landCount = 0;
  for (let j = 0; j < H; j++) {
    const th = ((j + 0.5) / H) * Math.PI, sy = Math.cos(th), st = Math.sin(th);
    for (let i = 0; i < W; i++) {
      const ph = ((i + 0.5) / W - 0.5) * 2 * Math.PI, x = Math.cos(ph) * st, z = Math.sin(ph) * st, k = j * W + i;
      v.set(x, sy, z).applyQuaternion(q);
      const s = seaR(v.x, v.y, v.z), sea = Number.isFinite(s) ? s : R, l = landR(v.x, v.y, v.z);
      // 只比海面高一点点（0.5 米内）的平地，海面盖在它上面：算浅水，不算岸
      if (Number.isFinite(l) && l > sea + 0.5) { isLand[k] = 1; landCount++; dist[k] = 0; depth[k] = 0; }
      else { dist[k] = 1e9; depth[k] = Number.isFinite(l) ? Math.max(0, sea - l) : 20; }
    }
  }
  // 8 邻域倒角距离（米）：行距随纬度变化，经度方向首尾相接
  const dy = (Math.PI * R) / H;
  const rowDx = new Float32Array(H); for (let j = 0; j < H; j++) rowDx[j] = Math.max(0.05, (2 * Math.PI * R * Math.sin(((j + 0.5) / H) * Math.PI)) / W);
  const relax = (k, kk, c) => { const v = dist[kk] + c; if (v < dist[k]) dist[k] = v; };
  for (let j = 0; j < H; j++) { const dx = rowDx[j], dg = Math.hypot(dx, dy);
    for (let i = 0; i < W; i++) { const k = j * W + i; if (isLand[k]) continue; const l = (i + W - 1) % W;
      relax(k, j * W + l, dx); if (j > 0) { relax(k, (j - 1) * W + i, dy); relax(k, (j - 1) * W + l, dg); relax(k, (j - 1) * W + (i + 1) % W, dg); } } }
  for (let j = H - 1; j >= 0; j--) { const dx = rowDx[j], dg = Math.hypot(dx, dy);
    for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (isLand[k]) continue; const r = (i + 1) % W;
      relax(k, j * W + r, dx); if (j < H - 1) { relax(k, (j + 1) * W + i, dy); relax(k, (j + 1) * W + r, dg); relax(k, (j + 1) * W + (i + W - 1) % W, dg); } } }
  // 陆地一侧：每个陆地格离最近海水多远（倒影只挑贴着水边的建筑）
  const landDist = new Float32Array(n); for (let k = 0; k < n; k++) landDist[k] = isLand[k] ? 1e9 : 0;
  const relaxL = (k, kk, c) => { const v = landDist[kk] + c; if (v < landDist[k]) landDist[k] = v; };
  for (let j = 0; j < H; j++) { const dx = rowDx[j], dg = Math.hypot(dx, dy);
    for (let i = 0; i < W; i++) { const k = j * W + i; if (!isLand[k]) continue; const l = (i + W - 1) % W;
      relaxL(k, j * W + l, dx); if (j > 0) { relaxL(k, (j - 1) * W + i, dy); relaxL(k, (j - 1) * W + l, dg); relaxL(k, (j - 1) * W + (i + 1) % W, dg); } } }
  for (let j = H - 1; j >= 0; j--) { const dx = rowDx[j], dg = Math.hypot(dx, dy);
    for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (!isLand[k]) continue; const r = (i + 1) % W;
      relaxL(k, j * W + r, dx); if (j < H - 1) { relaxL(k, (j + 1) * W + i, dy); relaxL(k, (j + 1) * W + r, dg); relaxL(k, (j + 1) * W + (i + W - 1) % W, dg); } } }
  // 蓝线：只对海面格做两遍 3×3 平滑（陆地保持 0，岸线不被磨进陆地）
  for (let pass = 0; pass < 2; pass++) {
    const src = dist.slice();
    for (let j = 1; j < H - 1; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (isLand[k]) continue;
      let s = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += Math.min(src[(j + b) * W + (i + a + W) % W], maxDist * 2); dist[k] = Math.max(src[k] * 0.5, s / 9); }
  }
  const data = new Uint8Array(n * 4); let shore = 0;
  for (let k = 0; k < n; k++) { const d = Math.min(dist[k], maxDist); if (!isLand[k] && d < 2) shore++;
    data[k * 4] = Math.round(Math.min(1, depth[k] / 20) * 255); data[k * 4 + 1] = Math.round((d / maxDist) * 255); data[k * 4 + 2] = isLand[k] * 255; data[k * 4 + 3] = 255; }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.needsUpdate = true; texture.name = 'tm-sea-shore-field';
  // 世界方向 → { 海面离岸距离, 陆地离水距离 }（米）
  const qi = q.clone().invert(), vv = new THREE.Vector3();
  const near = (wx, wy, wz) => { vv.set(wx, wy, wz).normalize().applyQuaternion(qi);
    const j = Math.min(H - 1, Math.max(0, Math.floor((Math.acos(Math.max(-1, Math.min(1, vv.y))) / Math.PI) * H))), i = Math.min(W - 1, Math.max(0, Math.floor((Math.atan2(vv.z, vv.x) / (2 * Math.PI) + 0.5) * W))), k = j * W + i;
    return isLand[k] ? { sea: 0, land: landDist[k] } : { sea: Math.min(dist[k], maxDist), land: 0 }; };
  return { texture, center, R, maxDist, near, stats: { ms: Math.round(performance.now() - t0), res: [W, H], metersPerTexel: +((2 * Math.PI * R) / W).toFixed(2), landMeshes: land.length, landShare: +(landCount / n).toFixed(3), shoreTexels: shore } };
}

function patchOceanMaterial(original, u) {
  if (original.fragmentShader.includes(MARK)) return original;          // 已经叠过（例如圣城海湾在我们之后克隆了材质）
  const m = original.clone(); m.name = (original.name || 'ocean') + '+tm-sea-style';
  m.uniforms = { ...original.uniforms, ...u };                            // 保留原 uniform 引用（时间 / 昼夜由世界控制器更新）
  const vMark = 'gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);';
  if (!m.vertexShader.includes(vMark)) throw new Error('海面顶点着色器结构不认识，没有叠加');
  m.vertexShader = 'varying vec3 vTmSeaP;\n' + m.vertexShader.replace(vMark, 'vTmSeaP = p;\n ' + vMark);
  const fMark = /gl_FragColor\s*=\s*vec4\(\s*color\s*,\s*alpha\s*\)\s*;(?![\s\S]*gl_FragColor\s*=\s*vec4\(\s*color\s*,\s*alpha\s*\))/;
  if (!fMark.test(m.fragmentShader)) throw new Error('海面片元着色器结构不认识，没有叠加');
  const keepBay = m.fragmentShader.includes('float waterRegion') ? ' * (1.0 - waterRegion * uTmKeepBay)' : '';   // 高山圣城海湾：默认一起统一；uTmKeepBay=1 时保持原样
  const lightTerm = /float\s+light\s*=/.test(m.fragmentShader) ? 'mix(0.86, 1.0, light)' : '1.0';
  m.fragmentShader = `${MARK}
uniform sampler2D uTmSeaField; uniform float uTmSeaOn; uniform float uTmSeaMaxDist; uniform float uTmKeepBay;
uniform float uTmTintOn; uniform vec3 uTmShallow; uniform vec3 uTmDeep; uniform vec2 uTmTintRange; uniform float uTmLight;
uniform float uTmFoamOn; uniform float uTmRim; uniform float uTmHalo; uniform float uTmHaloStrength; uniform vec3 uTmFoam;
uniform float uTmWaveOn; uniform float uTmWaveLayers; uniform float uTmPeriod; uniform float uTmReach; uniform float uTmJitter; uniform float uTmWaveStrength;
varying vec3 vTmSeaP;
${WAVE_CYCLE}
${NOISE}
` + m.fragmentShader.replace(fMark, `{
  vec3 sd = normalize(vTmSeaP);
  vec2 suv = vec2(atan(sd.z, sd.x) * 0.15915494 + 0.5, acos(clamp(sd.y, -1.0, 1.0)) * 0.31830989);
  vec4 sf = texture2D(uTmSeaField, suv);
  float sDist = sf.g * uTmSeaMaxDist;
  float sKeep = uTmSeaOn * step(0.5, sf.a)${keepBay};
  float sLand = step(0.5, sf.b);   // 判为陆地、但海面还露着的地方（崖脚、贴海平面的平地）：只上水色，不画白沫和浪
  vec3 sCol = color;
  float sAA = max(fwidth(sDist), 0.03);
  if (uTmTintOn > 0.5) {
    vec3 base = mix(uTmShallow, uTmDeep, smoothstep(uTmTintRange.x, uTmTintRange.y, sDist));
    base += vec3(0.008, 0.012, 0.012) * (tmSeaNoise(sd * 90.0 + vec3(uTime * 0.05)) - 0.5);
    sCol = base * uTmLight * ${lightTerm} * mix(0.48, 1.0, uNight);
  }
  if (uTmFoamOn > 0.5) {
    float halo = (1.0 - smoothstep(0.0, uTmHalo, sDist)) * uTmHaloStrength * (1.0 - sLand);
    sCol = mix(sCol, mix(sCol, uTmFoam, 0.45), halo);
    float rim = (1.0 - smoothstep(0.0, uTmRim + sAA, sDist)) * (1.0 - sLand); rim *= rim;
    sCol = mix(sCol, uTmFoam * mix(0.5, 1.0, uNight), rim * 0.92);
  }
  if (uTmWaveOn > 0.5) {
    float wv = 0.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k); if (fk >= uTmWaveLayers) break;
      float per = uTmPeriod * (1.0 + 0.13 * fk);
      float t = fract(uTime / per + fk / max(uTmWaveLayers, 1.0) + tmSeaNoise(sd * 41.0 + vec3(fk * 5.3)) * uTmJitter);
      vec3 cy = tmSeaShoreCycle(t);
      float pos = (cy.x + cy.y) * uTmReach;
      float w = mix(0.07, 0.24, cy.x + cy.y) * uTmReach * 0.9 + sAA;
      float band = 1.0 - smoothstep(0.0, w, abs(sDist - pos));
      float cov = smoothstep(0.25, 0.6, tmSeaNoise(sd * 27.0 + vec3(fk * 3.1, 0.0, fk * 1.7)));
      wv = max(wv, band * cy.z * cov);
    }
    sCol = mix(sCol, uTmFoam * mix(0.5, 1.0, uNight), clamp(wv * uTmWaveStrength * (1.0 - sLand), 0.0, 1.0));
  }
  color = mix(color, sCol, sKeep);
  alpha = mix(alpha, max(alpha, 0.97), sKeep);
}
gl_FragColor = vec4(color, alpha);`);
  m.needsUpdate = true;
  return m;
}

function reflectionMaterial(shared, baseColor, vertexColors) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, vertexColors,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { ...shared, uBase: { value: baseColor } },
    vertexShader: `uniform vec3 uCenter; uniform float uSeaR; uniform float uTime; uniform float uDistortion; uniform vec3 uBase;
      varying vec3 vCol; varying float vDepth; varying float vOk;
      void main(){
        vec4 w=vec4(position,1.0);
        #ifdef USE_INSTANCING
        w=instanceMatrix*w;
        #endif
        w=modelMatrix*w;
        vec3 q=w.xyz-uCenter; float r=length(q); vec3 n=q/max(r,1e-4); float h=r-uSeaR; vDepth=h;
        vec3 t1=normalize(cross(n, abs(n.y)<0.95?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0))); vec3 t2=cross(n,t1); float d=max(h,0.0);
        // 径向镜像（海面是球面，物体竖直方向就是半径方向）+ 随深度增大的轻微摆动（reflection.js）
        vec3 m=n*(uSeaR-h)+t1*sin(h*3.0+uTime*1.3+dot(q,t1)*0.23)*uDistortion*d+t2*cos(h*2.3-uTime*1.1+dot(q,t2)*0.17)*uDistortion*0.66*d;
        // 沿视线投到海面上：屏幕位置就是镜像点的位置，深度取海面 → 被前景陆地挡住的倒影自然不画
        vec3 c=cameraPosition-uCenter; vec3 dir=m-c; float a=dot(dir,dir), b=2.0*dot(c,dir), rs=uSeaR+0.15, cc=dot(c,c)-rs*rs, disc=b*b-4.0*a*cc;
        float th=disc>0.0?(-b-sqrt(disc))/(2.0*a):1.0; vOk=(disc>0.0&&th>0.0&&th<=1.0)?1.0:0.0;
        vec3 s=uCenter+c+dir*clamp(th,0.0,1.0);
        #ifdef USE_COLOR
        vCol=color.rgb*uBase;
        #else
        vCol=uBase;
        #endif
        #ifdef USE_INSTANCING_COLOR
        vCol*=instanceColor;
        #endif
        gl_Position=projectionMatrix*viewMatrix*vec4(s,1.0);
      }`,
    fragmentShader: `uniform vec3 uWater; uniform float uNight; uniform float uMix; uniform float uOpacity; uniform float uFade; uniform float uOn; uniform float uMaxH;
      varying vec3 vCol; varying float vDepth; varying float vOk;
      void main(){
        // 只倒映水面以上 uMaxH 米以内的部分：高处的树冠、塔尖单独倒映会漂在离岸很远的水面上（它们下面的山崖不在倒影里）
        if(vDepth<0.0||vDepth>uMaxH||vOk<0.5||uOn<0.01) discard;
        vec3 mid=mix(uWater,vCol,uMix);   // 1215644531221311488：彩色的「中间色」倒影
        gl_FragColor=vec4(mid*mix(0.48,1.0,uNight), uOpacity*exp(-vDepth*uFade)*(1.0-smoothstep(uMaxH*0.7,uMaxH,vDepth))*uOn);
        #include <colorspace_fragment>
      }`,
  });
}

/** 岸边建筑的倒影：只挑底部贴近海面、露出水面的网格；莫西斯湖不参与。 */
function buildReflections({ scene, ocean, center, R, near, style, shared, isExcluded }) {
  const group = new THREE.Group(); group.name = 'tm-sea-reflections'; group.matrixAutoUpdate = false;
  const picks = []; const corner = new THREE.Vector3(), box = new THREE.Box3();
  scene.traverse((o) => {
    if (!o.isMesh || o === ocean || o.isSkinnedMesh || !o.geometry?.attributes?.position || skipByName(o)) return;
    for (let p = o; p; p = p.parent) { if (p.visible === false || isExcluded(p)) return; }
    const mats = Array.isArray(o.material) ? o.material : [o.material]; const mat = mats[0];
    if (!mat || isWaterMat(mat) || (mat.transparent && (mat.opacity ?? 1) < 0.9)) return;
    if (o.isInstancedMesh) { o.computeBoundingBox?.(); if (!o.boundingBox) return; box.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
    else { o.geometry.boundingBox || o.geometry.computeBoundingBox(); box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); }
    const size = box.getSize(corner).length(); if (size > 140 || size < 1.5) return;   // 细杆、灯柱不做倒影（会变成漂在水上的白条）
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 8; i++) { corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); const r = corner.distanceTo(center) - R; lo = Math.min(lo, r); hi = Math.max(hi, r); }
    if (lo > 2.5 || lo < -3 || hi < 1) return;                            // 底部贴着海面、露出水面
    box.getCenter(corner); const nb = near(corner.x - center.x, corner.y - center.y, corner.z - center.z);
    if (nb.land > 6 || nb.sea > 12) return;                               // 只要水边 6 米以内的建筑（或水里的桥墩、码头）
    const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    picks.push({ o, mat, lo: Math.max(0, lo), tris, size });
  });
  picks.sort((a, b) => b.size - a.size);   // 先大件（房子、城墙、码头），名额用完为止
  const cache = new Map(); let tris = 0, count = 0;
  for (const p of picks) {
    if (count >= style.maxMeshes || tris + p.tris > style.maxTris) continue;
    const col = p.mat.color ? p.mat.color.clone() : new THREE.Color(0.8, 0.8, 0.8);
    const vc = !!(p.mat.vertexColors && p.o.geometry.attributes.color);
    const key = col.getHexString() + (vc ? 'v' : '');
    let m = cache.get(key); if (!m) { m = reflectionMaterial(shared, col, vc); cache.set(key, m); }
    const r = p.o.isInstancedMesh ? new THREE.InstancedMesh(p.o.geometry, m, p.o.count) : new THREE.Mesh(p.o.geometry, m);
    if (p.o.isInstancedMesh) { r.instanceMatrix = p.o.instanceMatrix; if (p.o.instanceColor) r.instanceColor = p.o.instanceColor; }   // 每棵树自己的颜色
    r.matrixAutoUpdate = false; r.matrix.copy(p.o.matrixWorld); r.matrixWorld.copy(p.o.matrixWorld); r.frustumCulled = false; r.renderOrder = (ocean.renderOrder || 0) + 1;
    r.name = 'tm-sea-reflection'; r.raycast = () => {}; group.add(r); tris += p.tris; count++;
  }
  scene.add(group); group.updateMatrixWorld = () => {};                  // 镜像网格的矩阵是拷贝来的世界矩阵
  return { group, stats: { meshes: count, candidates: picks.length, tris: Math.round(tris), materials: cache.size },
    dispose() { scene.remove(group); for (const m of cache.values()) m.dispose(); } };
}

/**
 * 安装到游戏：返回 API 并挂到 globalThis.__tmSeaStyle。定稿（SEA_FINAL_KEY）在场景加载完成后自动应用。
 * isExcluded(obj)：不参与倒影的对象（莫西斯湖）。
 */
export function installSeaStyle({ scene, renderer, camera, getOcean = () => scene.getObjectByName('planet-v8-curved-ocean'), isExcluded = (o) => /^morris/i.test(o.name || ''), storage = globalThis.localStorage }) {
  let field = null, refl = null, applied = null, ocean = null, patchedFor = null, base = null, watch = null;
  const U = {
    uTmSeaField: { value: null }, uTmSeaOn: { value: 0 }, uTmSeaMaxDist: { value: 64 }, uTmKeepBay: { value: 0 },
    uTmTintOn: { value: 1 }, uTmShallow: { value: new THREE.Color() }, uTmDeep: { value: new THREE.Color() }, uTmTintRange: { value: new THREE.Vector2(1, 26) }, uTmLight: { value: 1 },
    uTmFoamOn: { value: 1 }, uTmRim: { value: 0.9 }, uTmHalo: { value: 5 }, uTmHaloStrength: { value: 0.5 }, uTmFoam: { value: new THREE.Color().setStyle('#f7fbfa', THREE.LinearSRGBColorSpace) },
    uTmWaveOn: { value: 1 }, uTmWaveLayers: { value: 3 }, uTmPeriod: { value: 4.6 }, uTmReach: { value: 3.2 }, uTmJitter: { value: 0.6 }, uTmWaveStrength: { value: 0.7 },
  };
  const RU = { uCenter: { value: new THREE.Vector3() }, uSeaR: { value: 160 }, uTime: { value: 0 }, uNight: { value: 1 }, uWater: { value: new THREE.Color('#74b3b8') }, uMix: { value: 0.5 }, uOpacity: { value: 0.82 }, uFade: { value: 0.3 }, uDistortion: { value: 0.018 }, uOn: { value: 0 }, uMaxH: { value: 12 } };
  // 海面统一是游戏的基础海面（默认开启）。本机定稿可以改参数；「关掉」存成 {off:true}；网址加 ?seaStyle=0 临时看原来的海。
  const urlOff = (() => { try { return new URLSearchParams(location.search).get('seaStyle') === '0'; } catch { return false; } })();
  const storedFinal = () => { try { return JSON.parse(storage.getItem(SEA_FINAL_KEY) || 'null'); } catch { return null; } };
  const readFinal = () => { if (urlOff) return null; const f = storedFinal(); return f?.off ? null : (f || clone(DEFAULT_SEA_STYLE)); };
  const hashOcean = (o) => { const a = o.geometry.attributes.position.array; let h = 2166136261; for (let i = 0; i < a.length; i += 97) h = Math.imul(h ^ Math.round(a[i] * 1000), 16777619); return (h >>> 0).toString(16) + ':' + a.length; };

  function ensurePatched() {
    ocean = getOcean(); if (!ocean) throw new Error('还没找到海面（planet-v8-curved-ocean）');
    if (ocean.material !== patchedFor && !ocean.material.fragmentShader?.includes(MARK)) { base = ocean.material; const m = patchOceanMaterial(base, U); ocean.material = m; patchedFor = m; }
    else if (ocean.material.fragmentShader?.includes(MARK)) { patchedFor = ocean.material; for (const k of Object.keys(U)) if (ocean.material.uniforms[k] !== U[k]) ocean.material.uniforms[k] = U[k]; }
    // 世界控制器只更新原 uniform 对象：倒影共用海面的时间 / 昼夜
    RU.uTime = ocean.material.uniforms.uTime || RU.uTime; RU.uNight = ocean.material.uniforms.uNight || RU.uNight;
    // 圣城海湾等之后可能再次替换海面材质：盯住，被替换后重新接上
    watch ||= setInterval(() => { try { const o = getOcean(); if (o && o.material !== patchedFor && applied) ensurePatched(); } catch {} }, 1500);
  }
  function setUniforms(s) {
    const st = mergeSeaStyle(DEFAULT_SEA_STYLE, s);
    U.uTmKeepBay.value = st.bay?.keep ? 1 : 0;
    U.uTmTintOn.value = st.tint.on ? 1 : 0; U.uTmShallow.value.setStyle(st.tint.shallow, THREE.LinearSRGBColorSpace); U.uTmDeep.value.setStyle(st.tint.deep, THREE.LinearSRGBColorSpace); RU.uWater.value.set(st.tint.shallow); U.uTmTintRange.value.set(st.tint.near, st.tint.far); U.uTmLight.value = st.tint.light;
    U.uTmFoamOn.value = st.foam.on ? 1 : 0; U.uTmRim.value = st.foam.rim; U.uTmHalo.value = st.foam.halo; U.uTmHaloStrength.value = st.foam.haloStrength;
    U.uTmWaveOn.value = st.waves.on ? 1 : 0; U.uTmWaveLayers.value = st.waves.layers; U.uTmPeriod.value = st.waves.period; U.uTmReach.value = st.waves.reach; U.uTmJitter.value = st.waves.jitter; U.uTmWaveStrength.value = st.waves.strength;
    RU.uMix.value = st.reflection.colorMix; RU.uOpacity.value = st.reflection.opacity; RU.uFade.value = st.reflection.fade; RU.uDistortion.value = st.reflection.distortion; RU.uMaxH.value = st.reflection.maxHeight ?? 12;
    return st;
  }
  async function apply(style, { rebuildReflections = true } = {}) {
    const st = setUniforms(style); ensurePatched();
    const before = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    const want = st.field || DEFAULT_SEA_STYLE.field;
    if (!field || field.res !== want.res || field.maxDist !== want.maxDist) {
      field?.texture.dispose();
      const f = buildShoreField({ renderer, scene, ocean, res: want.res, maxDist: want.maxDist });
      field = { ...f, res: want.res, maxDist: want.maxDist };
    }
    U.uTmSeaField.value = field.texture; U.uTmSeaMaxDist.value = field.maxDist; U.uTmSeaOn.value = 1;
    RU.uCenter.value.copy(field.center); RU.uSeaR.value = field.R;
    if (rebuildReflections) { refl?.dispose(); refl = st.reflection.on ? buildReflections({ scene, ocean, center: field.center, R: field.R, near: field.near, style: st.reflection, shared: RU, isExcluded }) : null; }
    RU.uOn.value = st.reflection.on ? 1 : 0;
    applied = st;
    return { style: st, field: field.stats, reflection: refl?.stats || { meshes: 0 }, before };
  }
  const api = {
    uniforms: U,   // 给按区域调色用（例如高山圣城暮色把海调深）：每帧可在 apply 写的值上再混色
    defaults: () => clone(DEFAULT_SEA_STYLE),
    final: readFinal,
    async preview(style) {
      const o = getOcean(); if (!o) throw new Error('还没找到海面');
      const geomBefore = hashOcean(o), t0 = performance.now();
      const r = await apply(style);
      const bay = !!getOcean().material.fragmentShader?.includes('float waterRegion');
      return { ...r, ms: Math.round(performance.now() - t0), geometryUnchanged: hashOcean(getOcean()) === geomBefore, citadelBay: !bay ? '这次没有圣城海湾层' : r.style.bay?.keep ? '保留原样（海湾矩形内不叠加）' : '一起统一（海湾矩形内也换成莫西斯湖效果，没有接缝）', morrisExcluded: true };
    },
    compare(on) { U.uTmSeaOn.value = on ? 0 : applied ? 1 : 0; RU.uOn.value = on ? 0 : applied?.reflection?.on ? 1 : 0; return { comparing: !!on }; },
    revert() { const f = readFinal(); if (f) return apply(f).then(() => ({ restored: 'final' })); U.uTmSeaOn.value = 0; RU.uOn.value = 0; refl?.dispose(); refl = null; applied = null; return { restored: 'original' }; },
    commit(style) { const st = mergeSeaStyle(DEFAULT_SEA_STYLE, style || applied); storage.setItem(SEA_FINAL_KEY, JSON.stringify(st)); return { saved: true, style: st }; },
    reset() { storage.setItem(SEA_FINAL_KEY, JSON.stringify({ off: true })); U.uTmSeaOn.value = 0; RU.uOn.value = 0; refl?.dispose(); refl = null; applied = null; return { reset: true }; },
    state() { return { applied, final: readFinal(), isDefault: !storedFinal(), off: !!storedFinal()?.off || urlOff, field: field?.stats || null, reflection: refl?.stats || null, ocean: !!getOcean() }; },
    async frameCost(ms = 1000) { const t = []; let last = performance.now(); return new Promise((res) => { const step = (now) => { t.push(now - last); last = now; if (t.reduce((a, b) => a + b, 0) < ms) requestAnimationFrame(step); else { t.shift(); t.sort((a, b) => a - b); res({ medianMs: +(t[t.length >> 1] || 0).toFixed(1), frames: t.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); } }; requestAnimationFrame(step); }); },
  };
  globalThis.__tmSeaStyle = api;
  // 定稿：等场景加载好（场景目标都登记、海面存在）再应用一次
  const final = readFinal();
  if (final) {
    let tries = 0; const wait = setInterval(() => {
      tries++; const ready = getOcean() && (globalThis.__tmSceneTargets?.().length || 0) > 1;
      if (ready || tries > 120) { clearInterval(wait); if (ready) setTimeout(() => apply(final).catch((e) => console.warn('海面统一定稿应用失败', e)), 1500); }
    }, 1000);
  }
  return api;
}
