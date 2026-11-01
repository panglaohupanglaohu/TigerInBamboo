/**
 * fusion.js — step 7 of the roadmap: terrain and houses in one place.
 *
 *   1579483114178768898  "combine an irregular grid (like in Townscaper) with
 *     multi-cell tiles (like in Bad North)"
 *   1584623053061099520  houses spliced into the terrain
 *   1447488323845509121  "combine seamless soft slopes with distinct sharp
 *     cliffs"
 *
 * What makes the fusion possible is step 1 next door (src/lighting.js): one
 * voxel field that both halves write into. So the scene is literally
 *
 *      land Town  ──terrainmesh──┐
 *                                 ├── one buildVoxelField() ── one AO texture
 *      house Town ──TownMesh────┘
 *
 * and the terrace darkens the houses standing on it, the same way it would in
 * the reference: light baking is shared, not per-mesh.
 *
 * The houses are built at level 1..n in their own Town and the whole mesh is
 * lifted by `terraceTop * levelHeight`. That is a deliberate simplification:
 * one buildable terrace height for now, so the house mesher (which assumes its
 * columns start at sea level) needs no changes at all.
 */

import * as THREE from 'three';
import { buildQuadGrid } from './quadgrid.js';
import { Town, decorateCells, buildCellIndex } from './town.js';
import { TownMesh } from './townmesh.js';
import { buildTerrainMesh, LAND } from './terrainmesh.js';
import { buildShore, makeSkirtMaterial, makeWaveMaterial } from './shore.js';
import { buildVoxelField, makeLightingUniforms, patchMaterial } from './lighting.js';
import { fbm } from '../engine/noise.js';

const LEVEL = 0.5;
const TERRACE = 3;          // the buildable level, in voxel levels
const RADIUS = 11;
const SEED = 20261031;

const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');
const toastEl = document.getElementById('toast');

/* ------------------------------------------------------------------ model */

const grid = decorateCells(buildQuadGrid({ radius: RADIUS, hexSize: 1.05, seed: SEED }));
const index = buildCellIndex(grid);

const land = new Town(grid);
const town = new Town(grid);

/** Island height per cell, quantised to voxel levels. 0 = sea. */
function generateIsland() {
  const cells = grid.cells;
  let maxD = 0;
  for (const c of cells) maxD = Math.max(maxD, Math.hypot(c.cx, c.cz));
  const h = new Int8Array(grid.cellCount);

  for (const c of cells) {
    const d = Math.hypot(c.cx, c.cz) / maxD;
    const n = fbm(c.cx * 0.10, c.cz * 0.10, { octaves: 3, freq: 1, seed: SEED });
    const v = (1 - d * 1.05) + (n - 0.5) * 0.36;
    let lv = 0;
    if (v > 0.30) lv = 1;
    if (v > 0.46) lv = 2;
    if (v > 0.62) lv = 3;
    h[c.id] = lv;
  }

  // Buildable terrace, plus the thing the clip actually asks for: "combine
  // seamless soft slopes with distinct sharp cliffs". The terrace rim drops two
  // levels straight into the shore — a cliff — except in two sectors where a
  // one-level step makes a walkable ramp.
  const RAMPS = [0.7, 3.6];
  for (const c of cells) {
    const d = Math.hypot(c.cx, c.cz);
    const wobble = (fbm(c.cx * 0.3, c.cz * 0.3, { seed: SEED + 9 }) - 0.5) * 1.1;
    if (d + wobble < 5.6) {
      h[c.id] = TERRACE;
    } else if (d + wobble < 7.0) {
      const ang = Math.atan2(c.cz, c.cx);
      const ramp = RAMPS.some((r) => {
        const diff = Math.abs(((ang - r + Math.PI * 2) % (Math.PI * 2)) - Math.PI);
        return Math.PI - diff < 0.36;
      });
      h[c.id] = ramp ? TERRACE - 1 : 1;
    }
    // Outside the beach the natural heights would grow a second ring of green
    // hills that competes with the town; flatten it to a low rock shelf and let
    // it run out to sea.
    if (d + wobble >= 7.0) h[c.id] = d + wobble < 8.9 ? Math.min(h[c.id], 1) : 0;
  }

  // "Erosion valid terrain with no local minimums" (1447488323845509121):
  // lift every pit that is walled in by higher ground, so no puddle sits in the
  // middle of a slope and no cell collects water with no way out.
  for (let pass = 0; pass < 3; pass++) {
    let changed = 0;
    for (const c of cells) {
      const t = h[c.id];
      if (t === 0) continue;
      let lowest = 99;
      let allHigher = true;
      for (let i = 0; i < 4; i++) {
        const nid = c.edgeNeighbors[i];
        const nt = nid < 0 ? 0 : h[nid];
        if (nt <= t) allHigher = false;
        lowest = Math.min(lowest, nt);
      }
      if (allHigher && lowest !== 99) { h[c.id] = lowest; changed++; }
    }
    if (!changed) break;
  }
  return h;
}

const heights = generateIsland();
for (const c of grid.cells) {
  const h = heights[c.id];
  if (h > 0) land.fill(c, h);
}

/** Houses: a few clusters on the terrace, a plaza left empty in the middle. */
function generateHouses() {
  for (const c of grid.cells) {
    if (heights[c.id] !== TERRACE) continue;
    const d = Math.hypot(c.cx, c.cz);
    if (d > 5.2) continue;
    const cluster = fbm(c.cx * 0.44 + 4, c.cz * 0.44, { octaves: 2, freq: 1, seed: SEED + 31 });
    if (cluster < 0.44) continue;
    const r = hash01(c.id * 977 + 3);
    if (r < 0.12) continue;                       // plaza / gap
    const h = r > 0.94 ? 4 : r > 0.55 ? 3 : 2;
    town.fill(c, h);
    town.setColor(c, (c.id * 7) % 6);
  }
}

function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

generateHouses();

/* ----------------------------------------------------------------- render */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#6aa8b0');
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);

const rig = { yaw: Math.PI * 0.26, pitch: 0.66, distance: 34, target: new THREE.Vector3(0, 1.2, 0) };
function updateCamera() {
  const cp = Math.cos(rig.pitch);
  camera.position.set(
    rig.target.x + Math.sin(rig.yaw) * cp * rig.distance,
    rig.target.y + Math.sin(rig.pitch) * rig.distance,
    rig.target.z + Math.cos(rig.yaw) * cp * rig.distance,
  );
  camera.lookAt(rig.target);
  camera.updateMatrixWorld();
}

const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const S = 20;
sun.shadow.camera.left = -S;
sun.shadow.camera.right = S;
sun.shadow.camera.top = S;
sun.shadow.camera.bottom = -S;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.025;
const sunDir = new THREE.Vector3(-9, 21, 15).normalize();
scene.add(sun, sun.target);
scene.add(new THREE.AmbientLight(0xfffbf2, 0.5));
scene.add(new THREE.HemisphereLight(0xf2fbff, 0x9fb9b4, 0.95));
const fill = new THREE.DirectionalLight(0xd9ecf6, 0.45);
fill.position.set(-16, 10, -12);
scene.add(fill);

/* water */
const waterUniforms = { uTime: { value: 0 } };
{
  const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...waterUniforms,
      uShallow: { value: new THREE.Color('#5f9fa8') },
      uDeep: { value: new THREE.Color('#4f8f99') },
      uSky: { value: new THREE.Color('#78b1b8') },
    },
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow, uDeep, uSky;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float n = sin(p.x * 0.35 + uTime * 0.21) * sin(p.y * 0.29 - uTime * 0.17)
                + 0.5 * sin((p.x - p.y) * 0.8 + uTime * 0.37);
        vec3 col = mix(uDeep, uShallow, 0.55 + 0.08 * n);
        col = mix(col, uSky, smoothstep(25.0, 140.0, length(p - cameraPosition.xz)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.renderOrder = -2;
  scene.add(water);

  const catcher = new THREE.Mesh(geo.clone(), new THREE.ShadowMaterial({ opacity: 0.2, depthWrite: false }));
  catcher.position.y = 0.002;
  catcher.receiveShadow = true;
  catcher.renderOrder = 4;
  scene.add(catcher);
}

/* the two halves ---------------------------------------------------------- */

const townMesh = new TownMesh(town, grid, { levelHeight: LEVEL });
townMesh.bake = false;            // AO comes from the shared field, on the GPU
townMesh.rebuild();

const houses = new THREE.Mesh(townMesh.geometry, null);
houses.position.y = TERRACE * LEVEL;   // the terrace top is the house Town's sea level
houses.castShadow = true;
houses.receiveShadow = true;
scene.add(houses);

let terrain = buildTerrainMesh({ town: land, grid, levelHeight: LEVEL, softSlopes: true });
const terrainMesh = new THREE.Mesh(terrain.geometry, null);
terrainMesh.castShadow = true;
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

/* the shared field -------------------------------------------------------- */

let field = null;
const houseMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });

// One uniform set for the whole scene. It is created once and its *values* are
// rewritten when the field is rebuilt — replacing the objects instead would
// leave the compiled shaders pointing at the old ones.
const dummyTex = new THREE.DataTexture(new Float32Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
dummyTex.needsUpdate = true;
const lightUniforms = makeLightingUniforms(null);
lightUniforms.uField.value = dummyTex;

const landColors = {
  quay: new THREE.Color(LAND.quay),
  rock: new THREE.Color(LAND.rock),
  cliff: new THREE.Color(LAND.cliff),
};

function applyField(next) {
  field = next;
  lightUniforms.uField.value = next.texture();
  lightUniforms.uFieldMin.value.set(next.minX, next.minZ);
  lightUniforms.uFieldSize.value.set(next.W, next.H);
  lightUniforms.uFieldRes.value = next.res;
  lightUniforms.uFieldLayers.value = next.L;
  lightUniforms.uLevelHeight.value = next.levelHeight;
  lightUniforms.uAOStrength.value = state.ao ? 0.62 : 0;
  lightUniforms.uBounce.value = state.ao ? 0.42 : 0;
}

function rebuildField() {
  const t0 = performance.now();
  applyField(buildVoxelField({
    grid,
    levelHeight: LEVEL,
    sets: [
      { town: land, y: 0, colorOf: (c, lv) => (lv <= 1 ? landColors.quay : lv % 2 ? landColors.rock : landColors.cliff) },
      { town, y: TERRACE * LEVEL, colorOf: (c) => townMesh.wallColor(c) },
    ],
  }));
  return { ms: +(performance.now() - t0).toFixed(1), stats: field.stats };
}

patchMaterial(houseMaterial, lightUniforms, { scale: 1.0 });
patchMaterial(landMaterial, lightUniforms, { scale: 1.05 });

houses.material = houseMaterial;
terrainMesh.material = landMaterial;

/* shoreline --------------------------------------------------------------- */

const skirtMaterial = makeSkirtMaterial(new THREE.Color('#9fd0d3'));
const skirt = new THREE.Mesh(new THREE.BufferGeometry(), skirtMaterial);
skirt.renderOrder = 2;
scene.add(skirt);
const waveMaterial = makeWaveMaterial();
waveMaterial.uniforms.uTime = waterUniforms.uTime;
const waves = new THREE.Mesh(new THREE.BufferGeometry(), waveMaterial);
waves.renderOrder = 3;
waves.frustumCulled = false;
scene.add(waves);

function rebuildShore() {
  const t0 = performance.now();
  const shore = buildShore(land, grid, index, { posts: [] });
  skirt.geometry.dispose();
  waves.geometry.dispose();
  skirt.geometry = shore.skirt;
  waves.geometry = shore.waves;
  return +(performance.now() - t0).toFixed(1);
}

/* field slice debug view -------------------------------------------------- */

let slice = null;
function rebuildSlice(layer = TERRACE) {
  if (slice) { scene.remove(slice); slice.geometry.dispose(); slice.material.dispose(); slice = null; }
  if (!field || field.W === 0) return;
  const cv = field.sliceCanvas(layer);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = (field.W - 1) * field.res;
  const h = (field.H - 1) * field.res;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  slice = new THREE.Mesh(geo, mat);
  slice.position.set(field.minX + w / 2, layer * LEVEL + 0.02, field.minZ + h / 2);
  slice.renderOrder = 6;
  slice.visible = false;
  scene.add(slice);
}

/* ------------------------------------------------------------------ toggles */

const state = { ao: true, slice: false, sliceLayer: TERRACE, houses: true, terrain: true, wire: false, shadows: true };

const listeners = new Map();
const ui = new Map();

function setToggle(name, on) {
  state[name] = on;
  switch (name) {
    case 'ao':
      lightUniforms.uAOStrength.value = on ? 0.62 : 0.0;
      lightUniforms.uBounce.value = on ? 0.42 : 0.0;
      break;
    case 'slice':
      rebuildSlice(state.sliceLayer);
      if (slice) slice.visible = on;
      break;
    case 'houses': houses.visible = on; break;
    case 'terrain': terrainMesh.visible = on; break;
    case 'wire':
      houseMaterial.wireframe = on;
      landMaterial.wireframe = on;
      break;
    case 'shadows': sun.castShadow = on; break;
    case 'softslopes':
      rebuildTerrain(on);
      break;
    default: break;
  }
  listeners.get(name)?.forEach((fn) => fn(on));
  const el = ui.get(name);
  if (el) el.checked = on;
}

function rebuildTerrain(softSlopes) {
  const next = buildTerrainMesh({ town: land, grid, levelHeight: LEVEL, softSlopes });
  terrainMesh.geometry.dispose();
  terrainMesh.geometry = next.geometry;
  terrain = next;
  rebuildField();
}

let rebuildMs = 0;
rebuildMs = rebuildField().ms;
rebuildShore();
rebuildSlice(TERRACE);

function report() {
  const f = field.stats;
  statsEl.innerHTML = `
    <b>地形 + 房子 · 一个体素场</b><br>
    地形面 ${terrain.stats.faces} · 崖 ${terrain.stats.cliffs} · 坡 ${terrain.stats.slopes}<br>
    房子三角 ${townMesh.stats.triangles}（CPU 烘焙关闭）<br>
    体素场 ${f.W}×${f.H}×${f.layers} @${f.res} · ${f.voxels} 体素<br>
    栅格 ${f.rasterMs}ms · 模糊 ${f.blurMs}ms · AO 采样在顶点着色器`;
}
report();

/* -------------------------------------------------------------------- input */

let mode = null, lastX = 0, lastY = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  mode = e.button === 1 || e.altKey ? 'pan' : 'orbit';
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => { mode = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!mode) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (mode === 'orbit') {
    rig.yaw -= dx * 0.006;
    rig.pitch = Math.min(1.45, Math.max(0.08, rig.pitch + dy * 0.005));
  } else {
    const scale = rig.distance * 0.0016;
    rig.target.x -= Math.cos(rig.yaw) * dx * scale;
    rig.target.z += Math.sin(rig.yaw) * dx * scale;
    rig.target.z -= Math.cos(rig.yaw) * dy * scale;
    rig.target.x -= Math.sin(rig.yaw) * dy * scale;
  }
  updateCamera();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.distance = Math.min(90, Math.max(8, rig.distance * Math.exp(e.deltaY * 0.0011)));
  updateCamera();
}, { passive: false });

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------------------------------------------------------------------- run */

let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  waterUniforms.uTime.value = time;
  sun.target.position.copy(rig.target);
  sun.position.copy(rig.target).addScaledVector(sunDir, 30);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
updateCamera();
requestAnimationFrame(frame);

/* ------------------------------------------------------------------- wiring */

for (const id of ['ao', 'slice', 'houses', 'terrain', 'wire', 'shadows', 'softslopes']) {
  const el = document.getElementById(id);
  if (!el) continue;
  ui.set(id, el);
  el.addEventListener('change', () => setToggle(id, el.checked));
}

window.reaFusion = {
  grid, land, town, townMesh, terrainMesh, field: () => field,
  surfaceAt: (x, z) => terrain.surfaceAt(x, z),
  setToggle, rig, updateCamera, rebuildField, rebuildShore, report,
  terrainStats: () => terrain.stats,
};
