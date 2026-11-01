/**
 * spherefusion.js — the planet page for step 8.
 *
 * Everything here is wiring: build a relaxed sphere grid, quantise a height per
 * cell, mesh it (src/spheretown.js), put a sea shell just under the coast, and
 * let the camera orbit. The interesting bits live in spheretown.js.
 */

import * as THREE from 'three';
import { buildSphereGrid, generateHeights, carveRivers, buildSphereMesh, buildShoreRibbon, buildSeaShell, SPHERE } from './spheretown.js';
import { buildSphereHouses } from './spherehouse.js';

const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#20323c');
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);

const rig = { yaw: 0.9, pitch: 0.32, distance: 33, spin: true };
function updateCamera() {
  const cp = Math.cos(rig.pitch);
  camera.position.set(Math.sin(rig.yaw) * cp * rig.distance, Math.sin(rig.pitch) * rig.distance, Math.cos(rig.yaw) * cp * rig.distance);
  camera.lookAt(0, 0, 0);
}

const sun = new THREE.DirectionalLight(0xfff1dc, 2.9);
sun.position.set(-14, 18, 12);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xfffbf2, 0.55));
scene.add(new THREE.HemisphereLight(0xdff1ff, 0x2a3a3a, 0.9));

// the planet spins inside this pivot so the camera can stay put
const pivot = new THREE.Group();
scene.add(pivot);
const sea = buildSeaShell(SPHERE.radius);
pivot.add(sea);

let grid = null;
let heights = null;
let values = null;
let baseHeights = null;
let riverStats = { carved: 0 };
let lastRiverSeed = -1;
let mesh = null;
let ribbon = null;
let houses = null;
let lastStats = {};

const state = { softSlopes: true, ao: true, wire: false, spin: true, houses: true, rivers: true, seed: 7, count: 5000 };

function rebuild({ newGrid = false } = {}) {
  const t0 = performance.now();
  if (newGrid || !grid) {
    grid = buildSphereGrid({ count: state.count, seed: state.seed });
    const gen = generateHeights(grid, { seed: state.seed });
    heights = gen.heights;
    values = gen.values;
    baseHeights = gen.heights;
  }
  // rivers first: the terrain mesh has to be built *after* the channels are cut
  if (newGrid || !state.rivers || lastRiverSeed !== state.seed) heights = baseHeights;
  riverStats = { carved: 0 };
  if (state.rivers) {
    const r = carveRivers(grid, baseHeights, values, {});
    heights = r.heights;
    riverStats = r;
    lastRiverSeed = state.seed;
  }

  const built = buildSphereMesh({ grid, heights, values, softSlopes: state.softSlopes, ao: state.ao });
  if (!mesh) {
    // no flatShading: the normals are already smoothed across cell borders by
    // smoothCoincidentNormals(), which is what makes it read as land and not glass
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, flatShading: false });
    mesh = new THREE.Mesh(built.geometry, mat);
    pivot.add(mesh);
  } else {
    mesh.geometry.dispose();
    mesh.geometry = built.geometry;
  }
  if (houses) { pivot.remove(houses); houses.geometry.dispose(); }
  const built2 = buildSphereHouses({ grid, heights, levelHeight: SPHERE.level, radius: SPHERE.radius });
  houses = new THREE.Mesh(built2.geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  houses.castShadow = true;
  houses.visible = state.houses;
  pivot.add(houses);

  if (ribbon) { pivot.remove(ribbon); ribbon.geometry.dispose(); }
  ribbon = buildShoreRibbon({ grid, heights });
  ribbon.renderOrder = 2;
  pivot.add(ribbon);
  mesh.material.wireframe = state.wire;
  lastStats = { ...built.stats, houses: built2.stats.houses, houseTris: built2.stats.triangles, totalMs: +(performance.now() - t0).toFixed(1) };
  report();
}

function report() {
  const g = grid.stageStats || {};
  statsEl.innerHTML = `
    <b>第 8 步 · 球面</b><br>
    格 ${grid.triangles ?? lastStats.cells} 三角 · 陆地格 ${lastStats.cells}<br>
    崖 ${lastStats.cliffs} 侧 · 坡 ${lastStats.slopes} 侧<br>
    面 ${lastStats.triangles} 三角 · 网格 ${lastStats.totalMs}ms<br>
    房子 ${lastStats.houses ?? 0} 栋 · ${lastStats.houseTris ?? 0} 三角<br>
    河 ${riverStats.carved} 格 · 湖 ${riverStats.lakes ?? 0} 格 · 最大流域 ${riverStats.maxArea ?? 0} 格<br>
    三角化最小角 ${g.minAngle != null ? g.minAngle.toFixed(2) + '°' : '-'} · 细长 ${g.thin ?? '-'}`;
}

/* -------------------------------------------------------------------- input */

let mode = null, lastX = 0, lastY = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  mode = 'orbit'; lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => { mode = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!mode) return;
  rig.yaw -= (e.clientX - lastX) * 0.006;
  rig.pitch = Math.min(1.35, Math.max(-1.35, rig.pitch + (e.clientY - lastY) * 0.005));
  lastX = e.clientX; lastY = e.clientY;
  updateCamera();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.distance = Math.min(90, Math.max(13, rig.distance * Math.exp(e.deltaY * 0.0011)));
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

/* ------------------------------------------------------------------ toggles */

function setToggle(name, on) {
  state[name] = on;
  if (name === 'wire') { mesh.material.wireframe = on; houses.material.wireframe = on; return; }
  if (name === 'houses') { houses.visible = on; return; }
  if (name === 'rivers') { rebuild(); return; }
  if (name === 'spin') { rig.spin = on; return; }
  if (name === 'softSlopes' || name === 'ao') rebuild();
}

for (const id of ['softSlopes', 'ao', 'wire', 'spin', 'houses', 'rivers']) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener('change', () => setToggle(id, el.checked));
}
document.getElementById('reroll')?.addEventListener('click', () => {
  state.seed = (state.seed * 31 + 7) % 9973;
  pivot.remove(mesh);
  mesh.geometry.dispose();
  mesh = null;
  rebuild({ newGrid: true });
});

/* ---------------------------------------------------------------------- run */

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (rig.spin) pivot.rotation.y += dt * 0.09;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
updateCamera();
rebuild({ newGrid: true });
requestAnimationFrame(frame);

window.reaSphere = {
  get grid() { return grid; },
  get mesh() { return mesh; },
  get stats() { return lastStats; },
  rig, state, setToggle, updateCamera, pivot,
  reroll: () => document.getElementById('reroll').click(),
};
