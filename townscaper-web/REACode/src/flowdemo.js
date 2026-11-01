/**
 * flowdemo.js — 独立验证页：同一张体素场，三件非光照用途。
 *
 * 只读 `src/lighting.js` 的 `buildVoxelField()`，三件工具来自新文件
 * `src/voxelflow.js`（碰撞 / 风 / 地形软法线）。这个页面存在的意义是**验收**：
 * 每一条都能单独开关，并且给出可复核的数字。
 */

import * as THREE from 'three';
import { buildQuadGrid } from './quadgrid.js';
import { Town, buildCellIndex, decorateCells } from './town.js';
import { buildTerrainMesh } from './terrainmesh.js';
import { buildVoxelField } from './lighting.js';
import { fieldFlow } from './voxelflow.js';
import { TownMesh } from './townmesh.js';
import { fbm } from '../engine/noise.js';

const LEVEL = 0.5;
const TERRACE = 3;
const SEED = 20261031;
const RADIUS = 11;

const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');

/* ---------------------------------------------------------------- 模型 */

const grid = decorateCells(buildQuadGrid({ radius: RADIUS, hexSize: 1.05, seed: SEED }));
buildCellIndex(grid);
const land = new Town(grid);
const houses = new Town(grid);

function generateIsland() {
  let maxD = 0;
  for (const c of grid.cells) maxD = Math.max(maxD, Math.hypot(c.cx, c.cz));
  const h = new Int8Array(grid.cellCount);
  for (const c of grid.cells) {
    const d = Math.hypot(c.cx, c.cz) / maxD;
    const n = fbm(c.cx * 0.10, c.cz * 0.10, { octaves: 3, freq: 1, seed: SEED });
    const v = (1 - d * 1.05) + (n - 0.5) * 0.36;
    h[c.id] = v > 0.30 ? 1 : 0;
    if (v > 0.46) h[c.id] = 2;
    if (v > 0.62) h[c.id] = 3;
  }
  // 一级台地 + 两处坡道（和 fusion.html 同一套读法：一格=软坡，两格=崖）
  const RAMPS = [0.7, 3.6];
  for (const c of grid.cells) {
    const d = Math.hypot(c.cx, c.cz);
    const wob = (fbm(c.cx * 0.3, c.cz * 0.3, { seed: SEED + 9 }) - 0.5) * 1.1;
    if (d + wob < 5.6) h[c.id] = TERRACE;
    else if (d + wob < 7.0) {
      const ang = Math.atan2(c.cz, c.cx);
      const ramp = RAMPS.some((r) => {
        const diff = Math.abs(((ang - r + Math.PI * 2) % (Math.PI * 2)) - Math.PI);
        return Math.PI - diff < 0.36;
      });
      h[c.id] = ramp ? TERRACE - 1 : 1;
    } else h[c.id] = d + wob < 8.9 ? Math.min(h[c.id], 1) : 0;
  }
  for (const c of grid.cells) if (h[c.id] > 0) land.fill(c, h[c.id]);
}

/** 三丛房子，用来给风制造"挡风墙"和一条窄巷。 */
function generateHouses() {
  const CLUSTERS = [[3.4, 0.9], [-2.6, 3.1], [-3.0, -2.4]];
  for (const c of grid.cells) {
    if (land.top(c) !== TERRACE) continue;
    const near = CLUSTERS.some(([x, z]) => Math.hypot(c.cx - x, c.cz - z) < 2.2);
    if (!near) continue;
    // 中间挖一条一格宽的巷子：这是"风绕流"最直观的地方
    if (Math.abs(c.cx - 0.4) < 0.45) continue;
    houses.fill(c, 2 + ((c.id * 7) % 2));
    houses.setColor(c, (c.id * 5) % 6);
  }
}

generateIsland();
generateHouses();

/* ---------------------------------------------------------------- 场景 */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7fb3bb');
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
const rig = { yaw: 0.7, pitch: 0.62, distance: 30, target: new THREE.Vector3(0, 1.2, 0) };

function updateCamera() {
  const cp = Math.cos(rig.pitch);
  camera.position.set(
    rig.target.x + Math.sin(rig.yaw) * cp * rig.distance,
    rig.target.y + Math.sin(rig.pitch) * rig.distance,
    rig.target.z + Math.cos(rig.yaw) * cp * rig.distance,
  );
  camera.lookAt(rig.target);
}

scene.add(new THREE.HemisphereLight(0xdff2ff, 0xc9c3b4, 1.15));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-11, 16, 9);
scene.add(sun);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: '#3f7f8c', roughness: 0.9 }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

/* ---------------------------------------------------------------- 地形 */

let terrain = buildTerrainMesh({ town: land, grid, levelHeight: LEVEL, softSlopes: true });
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
const terrainMesh = new THREE.Mesh(terrain.geometry, terrainMat);
scene.add(terrainMesh);

// 房子要真的建出来：风"绕开墙"这件事得有墙才看得见
const townMesh = new TownMesh(houses, grid, { levelHeight: LEVEL });
townMesh.bake = false;
townMesh.rebuild();
const houseMesh = new THREE.Mesh(
  townMesh.geometry,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
);
houseMesh.position.y = TERRACE * LEVEL;      // 和体素场里 set.y 一致
scene.add(houseMesh);

/* ---------------------------------------------------------------- 体素场 */

// 房子必须带 `y` 抬到台地顶上：不带的话它们会被烘进地形内部，风场里等于没有墙，
// 测出来的风处处满速（第一次就是这么错的：开阔 1.8 / 巷子 1.8 / 贴墙 1.845）。
const sets = [{ town: land }, { town: houses, y: TERRACE * LEVEL }];
let field = buildVoxelField({
  grid, levelHeight: LEVEL,
  sets,
});
// 碰撞要二值体积 → 把同一批 sets 传进去（不是拿模糊场凑合）
let flow = fieldFlow(field, { windSpeed: 1.8, sets });

/* ------------------------------------------------- 风场箭头（可开关） */

let windGroup = null;
function buildWindArrows() {
  if (windGroup) {
    scene.remove(windGroup);
    windGroup.geometry.dispose();
    windGroup.material.dispose();
  }
  const pts = [];
  const cols = [];
  const cA = new THREE.Color('#9fe8ff');   // 弱
  const cB = new THREE.Color('#ffd166');   // 强
  const step = 1.05;
  for (let x = -9; x <= 9; x += step) {
    for (let z = -9; z <= 9; z += step) {
      const hit = flow.collide(x, z);
      if (!hit) continue;
      const y = hit.y + 0.35;
      const w = flow.windAt(x, y, z);
      const sp = Math.hypot(w[0], w[1], w[2]);
      if (sp < 0.02) continue;
      const len = Math.min(1.8, sp * 1.9);
      const dx = (w[0] / sp) * len, dy = (w[1] / sp) * len, dz = (w[2] / sp) * len;
      pts.push(x, y, z, x + dx, y + dy, z + dz);
      const t = Math.min(1, sp / 2.0);
      const c = cA.clone().lerp(cB, t);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  windGroup = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  scene.add(windGroup);
}

/* ------------------------------------------------- 碰撞探针（鼠标） */

const probe = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 12, 8),
  new THREE.MeshBasicMaterial({ color: '#ff5f7e' }),
);
probe.visible = false;
scene.add(probe);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let probeInfo = null;

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(terrainMesh, false)[0];
  if (!hit) { probe.visible = false; probeInfo = null; report(); return; }
  const { x, z } = hit.point;
  const c = flow.collide(x, z);
  if (!c) { probe.visible = false; probeInfo = null; report(); return; }
  probe.position.set(x, c.y + 0.02, z);
  probe.visible = true;
  const w = flow.windAt(x, c.y + 0.6, z);
  probeInfo = {
    x: +x.toFixed(2), z: +z.toFixed(2),
    ground: +hit.point.y.toFixed(3),     // 画出来的面（含软坡）
    collide: +c.y.toFixed(3),            // 场里量到的（体素格）
    layer: c.layer,
    wind: +Math.hypot(w[0], w[1], w[2]).toFixed(2),
  };
  report();
});

/* ---------------------------------------------------------------- 统计 */

let softOn = false;
let windOn = true;
let baseNormals = null;

function applyToggle(id, on) {
  if (id === 'soft') {
    softOn = on;
    const nrm = terrain.geometry.getAttribute('normal');
    if (on) {
      if (!baseNormals) baseNormals = new Float32Array(nrm.array);
      const info = flow.bakeSoftNormals(terrain.geometry, { blend: 0.6 });
      window.__flow.softInfo = info;
    } else if (baseNormals) {
      nrm.array.set(baseNormals);
      nrm.needsUpdate = true;
    }
  }
  if (id === 'wind') {
    windOn = on;
    if (on) { buildWindArrows(); windGroup.visible = true; }
    else if (windGroup) windGroup.visible = false;
  }
  if (id === 'houses') houseMesh.visible = on;
  if (id === 'terrain') terrainMesh.visible = on;
  report();
}

/** 数值验收：碰撞 vs 体素列顶面；开阔处 vs 巷子里的风。 */
function audit() {
  const samples = [];
  for (const c of grid.cells) {
    const lt = land.top(c);
    const ht = houses.top(c);
    // 真值 = 这一列的**最高**实心处（房子在台地顶上，要算上）
    const y = Math.max(lt ? lt * LEVEL : 0, ht ? TERRACE * LEVEL + ht * LEVEL : 0);
    samples.push({ x: c.cx, z: c.cz, y: y > 0 ? y : null });
  }
  const collide = flow.auditCollide(samples);

  // 风：开阔海面（岛外）vs 一格宽的巷子（x≈0.4 那条被挖空的带）
  let openSum = 0, openN = 0, laneSum = 0, laneN = 0, wallSum = 0, wallN = 0;
  for (let z = -4; z <= 4; z += 0.5) {
    const sea = flow.collide(-11.5, z);
    const y = (sea ? sea.y : 0) + 1.2;
    openSum += flow.windSpeedAt(-11.5, y, z); openN++;
    const lane = flow.collide(0.4, z);
    if (lane) { laneSum += flow.windSpeedAt(0.4, lane.y + 0.3, z); laneN++; }
    // 紧贴房子北墙外侧一格（屋檐高度，风被挡得最狠的位置）
    const wall = flow.collide(3.4, z);
    if (wall) { wallSum += flow.windSpeedAt(3.4, wall.y + 0.3, z); wallN++; }
  }
  return {
    collide,
    wind: {
      open: +(openSum / Math.max(1, openN)).toFixed(3),
      lane: +(laneSum / Math.max(1, laneN)).toFixed(3),
      nearWall: +(wallSum / Math.max(1, wallN)).toFixed(3),
    },
  };
}

const auditData = audit();

function report() {
  const f = field.stats;
  statsEl.innerHTML = `
    <b>一张体素场 · 三件用途</b><br>
    体素场 ${f.W}×${f.H}×${f.layers} @${f.res} · ${f.voxels} 体素<br>
    碰撞 ${auditData.collide.samples} 点：中位误差 ${auditData.collide.median} · p90 ${auditData.collide.p90}
      · 漏 ${auditData.collide.misses}（${(auditData.collide.missRate * 100).toFixed(1)}%）<br>
    风 开阔 ${auditData.wind.open} · 巷子 ${auditData.wind.lane} · 贴墙 ${auditData.wind.nearWall}
      <span style="opacity:.6">（巷子/开阔 = ${(auditData.wind.lane / Math.max(1e-3, auditData.wind.open)).toFixed(2)}）</span><br>
    软法线 ${softOn ? '开（blend 0.6）' : '关'}<br>
    ${probeInfo ? `<span style="color:#ffb3c1">探针 (${probeInfo.x}, ${probeInfo.z}) · 画面 ${probeInfo.ground} · 场 ${probeInfo.collide} (层 ${probeInfo.layer}) · 风 ${probeInfo.wind}</span>`
                : '<span style="opacity:.55">把鼠标移到地形上读碰撞高度</span>'}
  `;
}

/* ---------------------------------------------------------------- 输入 */

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  rig.yaw -= (e.clientX - drag.x) * 0.006;
  rig.pitch = Math.min(1.4, Math.max(0.08, rig.pitch + (e.clientY - drag.y) * 0.005));
  drag = { x: e.clientX, y: e.clientY };
  updateCamera();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.distance = Math.min(70, Math.max(8, rig.distance * (1 + Math.sign(e.deltaY) * 0.08)));
  updateCamera();
}, { passive: false });

for (const el of document.querySelectorAll('#ctl input')) {
  el.addEventListener('change', () => applyToggle(el.id, el.checked));
}

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

resize();
updateCamera();
buildWindArrows();
report();

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__flow = {
  grid, land, houses, field: () => field, flow: () => flow,
  terrainMesh, auditData, applyToggle,
  probeAt: (x, z) => ({ collide: flow.collide(x, z), wind: flow.windAt(x, (flow.collide(x, z) || { y: 0 }).y + 0.6, z), normal: flow.softNormal(x, flow.collide(x, z)?.y ?? 0, z) }),
};
