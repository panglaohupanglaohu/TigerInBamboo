import * as THREE from 'three';
import HF from '../../assets/citadelRidgeHeightfield.js';

// =====================================================================
// Holy-city ridge-flow clouds (user 2026-09-25: "clouds slowly flowing along
// the ridges"). Mist puffs are born on real ridge crests (baked heightfield of
// the current mountain meshes), drift with a gentle west wind along the ridge
// and spill down the lee slope, hugging the ground, growing and fading. They
// dissolve over built districts and open sea, so the cities stay clear.
// One instanced draw call of soft camera-facing sprites, tinted by the sky.
// =====================================================================

const COUNT = 1000;
const WIND = new THREE.Vector2(0.94, 0.34).normalize().multiplyScalar(0.85); // m/s, castle-local x/z
const SLOPE_PULL = 0.55;      // gentle lee-side spill per unit gradient
const ALONG = 0.9;            // share of wind redirected along the contour (ridge-following)
const MIN_SPEED = 0.35, MAX_SPEED = 1.5;

function sampler() {
  const {half, step, n, alt, cls} = HF;
  const at = (ix, iz) => alt[Math.max(0, Math.min(n - 1, iz)) * n + Math.max(0, Math.min(n - 1, ix))];
  const height = (x, z) => {
    const fx = (x + half) / step, fz = (z + half) / step;
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
    return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - v) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * v;
  };
  const kind = (x, z) => {
    const ix = Math.round((x + half) / step), iz = Math.round((z + half) / step);
    if (ix < 0 || iz < 0 || ix >= n || iz >= n) return 0;
    return cls[iz * n + ix];
  };
  const grad = (x, z) => [(height(x + 1.5, z) - height(x - 1.5, z)) / 3, (height(x, z + 1.5) - height(x, z - 1.5)) / 3];
  // Crest cells: mountain, high enough, and a local maximum across x or across z.
  const crests = [];
  for (let iz = 2; iz < n - 2; iz++) for (let ix = 2; ix < n - 2; ix++) {
    const i = iz * n + ix, a = alt[i];
    if (cls[i] !== 1 || a < 18) continue;
    const ridgeX = a >= at(ix - 2, iz) && a >= at(ix + 2, iz);
    const ridgeZ = a >= at(ix, iz - 2) && a >= at(ix, iz + 2);
    if (ridgeX || ridgeZ) crests.push({x: -half + ix * step, z: -half + iz * step, w: Math.pow(a, 1.6)});
  }
  let total = 0; for (const c of crests) total += c.w;
  return {height, kind, grad, crests, total};
}

export function puffTexture() {
  const size = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  // A few overlapping soft lobes read as a cloud tuft rather than a disc.
  const lobes = [[.5, .55, .42, 1], [.34, .5, .26, .8], [.66, .48, .28, .8], [.46, .38, .24, .7], [.6, .64, .22, .6]];
  for (const [cx, cy, r, a] of lobes) {
    const grd = g.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, r * size);
    grd.addColorStop(0, `rgba(255,255,255,${.55 * a})`);
    grd.addColorStop(.55, `rgba(255,255,255,${.28 * a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mountRidgeFlowClouds(castle, {radius = HF.radius, timeOfDay = () => 0.5} = {}) {
  if (!castle || typeof document === 'undefined') return null;
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelRidgeClouds') === '0') return null;
  const S = sampler();
  if (!S.crests.length) return null;
  // Planet centre in castle-local space: radial "up" at any local point.
  // (recomputed each frame: the castle is re-seated after load by the common frame)
  const centre = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const localPoint = (x, z, alt, out) => out.set(x, 0, z).sub(centre).normalize().multiplyScalar(radius + alt).add(centre);

  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.instanceCount = COUNT;
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  const iAlpha = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  const iRot = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iSize', iSize); geo.setAttribute('iAlpha', iAlpha); geo.setAttribute('iRot', iRot);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {map: {value: puffTexture()}, uTint: {value: new THREE.Color(1, 1, 1)}, uShade: {value: new THREE.Color(0.74, 0.8, 0.86)}, uOpacity: {value: 1}},
    vertexShader: `
      attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute float iRot;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vUv = uv; vAlpha = iAlpha;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(iRot), s = sin(iRot);
        vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        mv.xy += q * vec2(iSize * 1.35, iSize * 0.8);   // wider than tall: lying mist
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uTint; uniform vec3 uShade; uniform float uOpacity;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vec4 t = texture2D(map, vUv);
        float a = t.a * vAlpha * uOpacity;
        if (a < 0.004) discard;
        vec3 col = mix(uShade, vec3(1.0), smoothstep(0.15, 0.85, vUv.y)) * uTint;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'citadel-ridge-flow-clouds';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  castle.add(mesh);

  // Particle state.
  const px = new Float32Array(COUNT), pz = new Float32Array(COUNT), age = new Float32Array(COUNT), life = new Float32Array(COUNT), size = new Float32Array(COUNT), base = new Float32Array(COUNT), clear = new Float32Array(COUNT);
  let seed = 0x5eed1234 >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const spawn = (i, prewarmAge = 0) => {
    let r = rnd() * S.total, c = S.crests[0];
    for (const k of S.crests) { r -= k.w; if (r <= 0) { c = k; break; } }
    px[i] = c.x + (rnd() - .5) * 3; pz[i] = c.z + (rnd() - .5) * 3;
    life[i] = 40 + rnd() * 30; age[i] = prewarmAge;
    size[i] = 9 + rnd() * 9; base[i] = .22 + rnd() * .18; clear[i] = .4 + rnd() * 1.0;
    iRot.array[i] = rnd() * Math.PI * 2;
  };
  const step = (i, dt) => {
    const [gx, gz] = S.grad(px[i], pz[i]);
    // Contour direction (perpendicular to the gradient), oriented with the wind:
    // puffs slide along the ridge line, with a gentle spill down the lee side.
    const g = Math.hypot(gx, gz);
    let cx = 0, cz = 0;
    if (g > 1e-4) { cx = -gz / g; cz = gx / g; if (cx * WIND.x + cz * WIND.y < 0) { cx = -cx; cz = -cz; } }
    const w = WIND.length();
    let vx = cx * w * ALONG + WIND.x * (1 - ALONG) + WIND.x * 0.25 - gx * SLOPE_PULL;
    let vz = cz * w * ALONG + WIND.y * (1 - ALONG) + WIND.y * 0.25 - gz * SLOPE_PULL;
    const sp = Math.hypot(vx, vz) || 1, k = Math.min(MAX_SPEED, Math.max(MIN_SPEED, sp)) / sp;
    vx *= k; vz *= k;
    px[i] += vx * dt; pz[i] += vz * dt; age[i] += dt;
    const kd = S.kind(px[i], pz[i]);
    if ((kd === 2 || S.height(px[i], pz[i]) < 2) && life[i] - age[i] > 3) life[i] = age[i] + 3;  // dissolve over cities / sea
    if (age[i] >= life[i]) spawn(i);
  };
  for (let i = 0; i < COUNT; i++) spawn(i, 0);
  // Pre-warm so the flow is already established when the player arrives.
  for (let s = 0; s < 120; s++) for (let i = 0; i < COUNT; i++) step(i, .5);

  const sky = () => castle.parent && (castle.userData._skyMesh ||= (() => { let r = null; let o = castle; while (o.parent) o = o.parent; o.traverse(m => { if (!r && m.name === 'sky-background') r = m; }); return r; })());
  let lastT = null;
  const update = (t) => {
    const time = Number(t) || 0;
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    castle.updateWorldMatrix(true, false);
    castle.worldToLocal(centre.set(0, 0, 0));
    for (let i = 0; i < COUNT; i++) {
      if (dt > 0) step(i, dt);
      const u = age[i] / life[i];
      const grow = size[i] * (0.75 + 0.6 * u);
      const ground = Math.max(0, S.height(px[i], pz[i]));
      localPoint(px[i], pz[i], ground + clear[i] + grow * 0.2, _p);
      iPos.array[i * 3] = _p.x; iPos.array[i * 3 + 1] = _p.y; iPos.array[i * 3 + 2] = _p.z;
      iSize.array[i] = grow;
      const fadeIn = Math.min(1, age[i] / 5), fadeOut = Math.min(1, (life[i] - age[i]) / 9);
      iAlpha.array[i] = base[i] * fadeIn * fadeOut;
    }
    iPos.needsUpdate = iSize.needsUpdate = iAlpha.needsUpdate = true;
    // Tint follows the sky's cloud colour (dawn/dusk warmth); thinner at night.
    const skyMesh = sky();
    const cc = skyMesh?.material?.uniforms?.cloudColor?.value;
    if (cc) material.uniforms.uTint.value.copy(cc).lerp(new THREE.Color(1, 1, 1), 0.45);
    const tod = ((Number(timeOfDay()) || 0.5) % 1 + 1) % 1;
    const night = THREE.MathUtils.smoothstep(Math.abs(tod - 0.5), 0.3, 0.42);
    material.uniforms.uOpacity.value = 1 - 0.6 * night;
  };
  update(0);
  mesh.userData.update = update;
  mesh.userData.stats = {particles: COUNT, crestCells: S.crests.length};
  castle.userData.ridgeFlowClouds = mesh;
  return mesh;
}
