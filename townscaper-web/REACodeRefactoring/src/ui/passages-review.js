/** 886199305522085890 · 窄道点线**通用调试层**的页面入口（不是 badnorth 战斗专用）。
 *
 * 片子里那条线是纯调试可视化：只在「两块实体之间那一格宽」的地方出现，点贴地、点距≈2×点径、
 * 被崖脊/屋檐挡住时逐点淡出。r54 之前它只长在 `src/badnorth/battle.js#refreshPassages()`，
 * 换场景开不了 —— 本页把那套东西搬到 `src/world/passage-overlay.js`，任何 World 都能挂。
 *
 * 世界：混合（三角+方格）或纯四方格，一格高的台地中间挖一圈沟，只留一条**一格宽**的桥 ——
 * 桥格在图上是 degree 2 且两侧不互通，正是 `narrowCells()` 认定的窄道。
 *
 * URL：`?world=quad` · `?dots=0`（关层）· `?size=screen`（旧口径：固定 7px 屏幕点）· `?spacing=0.4`
 * 探针：`window.passageReview.{stats(),measure(),setCamera(),rebuild(),overlay}`
 */
import * as THREE from 'three';
import { buildMixedGrid, buildQuadGrid } from '../core/grid.js';
import { World } from '../core/world.js';
import { buildNav } from '../world/navgraph.js';
import { PassageOverlay } from '../world/passage-overlay.js';

const Q = new URLSearchParams(location.search);
const spacing = +(Q.get('spacing') ?? 0.28);
const worldSize = Q.get('size') !== 'screen';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor('#c6d9d8');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight('#fff9df', '#536d82', 2.4));
const sun = new THREE.DirectionalLight('#ffedd8', 2.8);
sun.position.set(-6, 12, 4);
scene.add(sun);

const ground = new THREE.Group();
scene.add(ground);
let angle = 0.7, pitch = 1.02, distance = 16, drag = null;
if (Q.get('angle')) angle = +Q.get('angle');
if (Q.get('pitch')) pitch = +Q.get('pitch');
if (Q.get('dist')) distance = +Q.get('dist');

const overlay = new PassageOverlay({ levelHeight: 0.5, spacing, worldSize });
scene.add(overlay.object);
overlay.setVisible(Q.get('dots') !== '0');

let world, nav;

function rebuild() {
  for (const o of [...ground.children]) { ground.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
  const quad = Q.get('world') === 'quad';
  const grid = quad ? buildQuadGrid({ radius: 4, hexSize: 1, seed: 7 }) : buildMixedGrid({ radius: 4, hexSize: 1, mergeRate: 0.55, seed: 7 });
  world = new World(grid);
  for (const c of world.cells) world.fill(c, 1, { rock: true });
  // 一圈沟（0 层）只留 |cx|<1.15 的一条桥 → 桥上一格宽，图上 degree 2 且两侧不互通 = 窄道
  for (const c of world.cells) {
    const r = Math.hypot(c.cx, c.cz);
    if (r > 2.0 && r < 3.0 && Math.abs(c.cx) > 1.15) world.setSolid(c, 1, false);
  }
  // 一簇 4 层高塔（原片里是房子）：低机位从 +x/+z 看过来时，塔要能把桥上的点挡住 —— 遮挡淡出才有得验。
  for (const c of world.cells) {
    if (c.cx > 1.2 && c.cz > 0.5 && Math.hypot(c.cx, c.cz) < 2.4) world.fill(c, 4, { rock: true });
  }
  for (const c of world.cells) {
    const top = world.top(c);
    if (!(top > 0)) continue;
    const s = new THREE.Shape();
    c.pts.forEach((p, i) => (i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: top * 0.5, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c4d6a3', roughness: 1, flatShading: true }));
    ground.add(mesh);
  }
  nav = buildNav(world);
  overlay.refresh(world, nav);
  window.passageReview.world = world;
  window.passageReview.nav = nav;
  report();
}

function report() {
  const st = overlay.stats();
  const m = overlay.measure(camera);
  document.querySelector('#stats').textContent =
    `${Q.get('world') === 'quad' ? '四方格' : '混合网格'} · ${world.cells.length} 格 · 可走 ${nav.walk.reduce((a, b) => a + b, 0)} · `
    + `窄道 ${st.narrow} 格 / ${st.segments} 段 · 点 ${st.dots} 颗 · 点径 ${m.dotPx}px · 点距 ${m.pitchPx}px（比 ${m.ratio}）· 被遮 ${m.occluded}`;
  window.passageReview.last = { ...st, ...m };
}

window.passageReview = {
  overlay, world: null, nav: null, last: null, rebuild, camera,
  stats: () => overlay.stats(),
  measure: () => overlay.measure(camera),
  setCamera: ({ angle: a = angle, pitch: p = pitch, dist: d = distance } = {}) => { angle = a; pitch = p; distance = d; place(); overlay.update(camera, 1 / 60); report(); },
};

document.querySelector('#dots').onchange = (e) => { overlay.setVisible(e.target.checked); report(); };
document.querySelector('#dots').checked = overlay.object.visible;
document.querySelector('#size').onchange = (e) => {
  const on = e.target.value === 'world';
  overlay.worldSize = on;
  overlay.material.sizeAttenuation = on;
  overlay.material.size = on ? overlay.dotWorld : overlay.screenPx;
  overlay.material.needsUpdate = true;
  report();
};
document.querySelector('#size').value = worldSize ? 'world' : 'screen';

const canvas = renderer.domElement;
canvas.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
canvas.onpointermove = (e) => {
  if (!drag) return;
  angle -= (e.clientX - drag[0]) * 0.006;
  pitch = Math.max(0.18, Math.min(1.35, pitch + (e.clientY - drag[1]) * 0.006));
  drag = [e.clientX, e.clientY];
};
canvas.onpointerup = () => (drag = null);
canvas.onwheel = (e) => { e.preventDefault(); distance = Math.max(4, Math.min(40, distance + e.deltaY * 0.015)); };

function place() {
  camera.position.set(Math.sin(angle) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(angle) * Math.cos(pitch) * distance);
  camera.lookAt(0, 0.5, 0);
  camera.updateMatrixWorld(true);
}
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
rebuild();

renderer.setAnimationLoop(() => {
  place();
  if (overlay.object.visible) overlay.update(camera, 1 / 60);
  renderer.render(scene, camera);
  if (!window.__reviewDone && overlay.object.visible) { window.__reviewDone = true; report(); }
});
