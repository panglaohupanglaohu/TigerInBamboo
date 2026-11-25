// 山形候选（2026-11-22）：用户「高山圣城没有山的模样；轨道保留，其他可编辑」。
// 游戏侧只做三件事：① 把实景采成规则高度网格 + 分类掩码（地形 / 建筑 / 轨道 / 海）交给工坊 Worker；
// ② 把 Worker 算好的山形（mountain/capabilities.js，能力来自学习库）建成 low poly 网格贴回球面；
// ③ 对照 / 放弃 / 采用。原地形网格只隐藏不改，建筑与轨道不动，植被按高差抬落。
//   mountain.probe / preview / compare / revert / commit / state（pipeline-bridge）
import { PALETTES } from '../../system-workshop/mountain/palettes.js';
import * as THREE from 'three';
import { ReaBattleStage } from './reaBattleStage.js';
import { isCrossableRailOrTram } from '../vikings/vikingVoyage.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';

const PRESETS = { citadel: { half: 150, step: 3 } };
export const MOUNTAIN_SCENES = Object.keys(PRESETS);
const ADOPT_KEY = (id) => `tm.mountain.adopted.v1:${id}`;
// 圣城：走路 / 建筑读的是平滑原山面 oskar-grid-mountain-surface（材质已隐藏），画面上是它的体素化显示层 citadel-voxel-mountain + 台地草皮。
// 采样取平滑原山面；预览时隐藏显示层。
const TERRAIN = /oskar-grid-mountain-surface$/i;
const OVERLAY = /voxel-mountain|bench-turf|backlit-highlight|cliff-seal/i;
const VEG = /pine|tree|shrub|leaf|leaves|bush|flower|grass|tuft|canopy|foliage|plant|cypress|trunk/i;
const FX = /cloud|beam|water|sea|ocean|foam|wave|particle|smoke|glow|halo|shadow|ring|sky|mist|fog|bird|rea-battle|rea-terrain|mountain-candidate/i;
const RAIL = /tram|(^|[^d])rail|wire|cable|catenary|viaduct|double-deck|aqueduct|track|sleeper/i;
const pathOf = (o) => `${o.name}<${o.parent?.name || ''}<${o.parent?.parent?.name || ''}`;

let cur = null;

/** 贴球图表：x,z = 沿球面弧长（米），y = 离海面高度（米）。复用 ReaBattleStage 已验证过的映射。 */
function chartFor(dir) {
  const c = Object.create(ReaBattleStage.prototype), up = dir.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
  Object.assign(c, { up, east, north: up.clone().cross(east).normalize(), seaR: 160 + officialOceanLevelAt(up), scale: 1 });
  return c;
}
function classify(o) {
  for (let p = o; p; p = p.parent) if (!p.visible || p.userData.reaBattleStage || p.userData.reaIgnore || p.userData.mountainCandidate) return null;
  const path = pathOf(o);
  if (OVERLAY.test(o.name)) return 'overlay';
  if (TERRAIN.test(o.name)) return 'terrain';
  if (FX.test(path)) return null;
  if (VEG.test(path)) return 'veg';
  if (isCrossableRailOrTram(o) || RAIL.test(path)) return 'rail';
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false) return null;
  return 'structure';
}

/** 实景 → 高度网格 + 掩码。cls：0 可改地形 1 建筑 2 轨道；h 为 null = 没有地形（海 / 图表外） */
function sample(site, chart, { half, step }) {
  const n = Math.round(half * 2 / step) + 1, N = n * n, h = new Float32Array(N).fill(NaN), cls = new Uint8Array(N), railY = new Float32Array(N).fill(NaN);
  const meshes = { terrain: [], overlay: [], veg: [], rail: [], structure: [] }, names = {};
  const centre = chart.up.clone().multiplyScalar(160), bc = new THREE.Vector3(), reach = half * 1.6;
  site.updateWorldMatrix(true, true);
  site.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const k = classify(o); if (!k) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    bc.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    if (!o.isInstancedMesh && bc.distanceTo(centre) - g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > reach) return;
    meshes[k].push(o); if (k !== 'veg') names[k + ':' + (o.name || o.parent?.name || '?').replace(/[-_]?\d+$/, '')] = (names[k + ':' + (o.name || o.parent?.name || '?').replace(/[-_]?\d+$/, '')] || 0) + 1;
  });
  const ci = (v) => Math.round((v + half) / step), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const mark = (x0, x1, z0, z1, k, y) => { for (let j = Math.max(0, ci(z0)); j <= Math.min(n - 1, ci(z1)); j++) for (let i = Math.max(0, ci(x0)); i <= Math.min(n - 1, ci(x1)); i++) { const q = j * n + i; if (k === 2) { cls[q] = 2; if (!(railY[q] <= y)) railY[q] = y; } else if (cls[q] !== 2) cls[q] = 1; } };
  const eachTri = (o, fn) => {
    const pos = o.geometry.attributes.position, ix = o.geometry.index?.array, cnt = ix ? ix.length : pos.count;
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => { o.getMatrixAt(i, m4); return m4.clone().premultiply(o.matrixWorld); }) : [o.matrixWorld];
    for (const m of mats) for (let i = 0; i < cnt; i += 3) {
      chart.worldToStage(va.fromBufferAttribute(pos, ix ? ix[i] : i).applyMatrix4(m), va); chart.worldToStage(vb.fromBufferAttribute(pos, ix ? ix[i + 1] : i + 1).applyMatrix4(m), vb); chart.worldToStage(vc.fromBufferAttribute(pos, ix ? ix[i + 2] : i + 2).applyMatrix4(m), vc);
      const x0 = Math.min(va.x, vb.x, vc.x), x1 = Math.max(va.x, vb.x, vc.x), z0 = Math.min(va.z, vb.z, vc.z), z1 = Math.max(va.z, vb.z, vc.z);
      if (x1 < -half || x0 > half || z1 < -half || z0 > half) continue;
      fn(x0, x1, z0, z1);
    }
  };
  let tris = 0; const big = [];
  const foot = (o, k) => { let a = 0, X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity; eachTri(o, (x0, x1, z0, z1) => { X0 = Math.min(X0, x0); X1 = Math.max(X1, x1); Z0 = Math.min(Z0, z0); Z1 = Math.max(Z1, z1); a++; }); if (a && (X1 - X0) * (Z1 - Z0) > 400) big.push({ k, name: pathOf(o).slice(0, 70), tris: a, box: [X0, X1, Z0, Z1].map(Math.round) }); };
  for (const k of ['structure', 'rail', 'overlay']) for (const o of meshes[k]) foot(o, k);
  for (const o of meshes.terrain) eachTri(o, (x0, x1, z0, z1) => {
    tris++;
    const d = (vb.z - vc.z) * (va.x - vc.x) + (vc.x - vb.x) * (va.z - vc.z); if (Math.abs(d) < 1e-12) return;
    for (let j = Math.max(0, Math.ceil((z0 + half) / step)); j <= Math.min(n - 1, Math.floor((z1 + half) / step)); j++) for (let i = Math.max(0, Math.ceil((x0 + half) / step)); i <= Math.min(n - 1, Math.floor((x1 + half) / step)); i++) {
      const x = i * step - half, z = j * step - half, l1 = ((vb.z - vc.z) * (x - vc.x) + (vc.x - vb.x) * (z - vc.z)) / d, l2 = ((vc.z - va.z) * (x - vc.x) + (va.x - vc.x) * (z - vc.z)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * va.y + l2 * vb.y + l3 * vc.y, q = j * n + i; if (!(h[q] >= y)) h[q] = y;
    }
  });
  // 掩码按三角形真实投影标：小三角用包围盒，大三角走三条边 + 内部点测试（墙是竖直面，投影面积为 0，只有边）
  const cover = (k) => (x0, x1, z0, z1) => {
    const y = Math.min(va.y, vb.y, vc.y);
    if (x1 - x0 <= step * 1.5 && z1 - z0 <= step * 1.5) return mark(x0, x1, z0, z1, k, y);
    for (const [p, q] of [[va, vb], [vb, vc], [vc, va]]) { const len = Math.hypot(q.x - p.x, q.z - p.z), m = Math.max(1, Math.ceil(len / (step * 0.5))); for (let a = 0; a <= m; a++) { const x = p.x + (q.x - p.x) * a / m, z = p.z + (q.z - p.z) * a / m; mark(x, x, z, z, k, y); } }
    const d = (vb.z - vc.z) * (va.x - vc.x) + (vc.x - vb.x) * (va.z - vc.z); if (Math.abs(d) < 1e-9) return;
    for (let j = Math.max(0, Math.ceil((z0 + half) / step)); j <= Math.min(n - 1, Math.floor((z1 + half) / step)); j++) for (let i = Math.max(0, Math.ceil((x0 + half) / step)); i <= Math.min(n - 1, Math.floor((x1 + half) / step)); i++) {
      const x = i * step - half, z = j * step - half, l1 = ((vb.z - vc.z) * (x - vc.x) + (vc.x - vb.x) * (z - vc.z)) / d, l2 = ((vc.z - va.z) * (x - vc.x) + (va.x - vc.x) * (z - vc.z)) / d;
      if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) mark(x, x, z, z, k, y);
    }
  };
  for (const o of meshes.structure) eachTri(o, cover(1));
  for (const o of meshes.rail) eachTri(o, cover(2));
  big.sort((a, b) => (b.box[1] - b.box[0]) * (b.box[3] - b.box[2]) - (a.box[1] - a.box[0]) * (a.box[3] - a.box[2]));
  return { n, step, half, h, cls, railY, meshes, names, tris, big: big.slice(0, 40) };
}

const round2 = (a) => Array.from(a, (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null));

export function probeMountain({ scene, id = 'citadel' } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象` };
  if (!PRESETS[id]) return { ok: false, reason: `场景 ${id} 还没有山形管线预设` };
  if (cur && cur.id !== id) revertMountain();
  if (!cur) {
    const t0 = performance.now(), chart = chartFor(t.dir), s = sample(t.root, chart, PRESETS[id]);
    cur = { id, label: t.label || id, scene, chart, ...s, ms: Math.round(performance.now() - t0), mesh: null, hidden: [], moved: [], plan: null };
  }
  const c = cur; let land = 0, sea = 0, prot = 0, rail = 0, top = -Infinity, free = 0;
  for (let q = 0; q < c.h.length; q++) { if (!Number.isFinite(c.h[q])) { sea++; continue; } if (c.h[q] > 0.3) { land++; if (!c.cls[q]) free++; } else sea++; if (c.cls[q] === 1) prot++; if (c.cls[q] === 2) rail++; top = Math.max(top, c.h[q]); }
  return {
    ok: true, id, label: c.label, previewing: !!c.mesh,
    site: { n: c.n, step: c.step, half: c.half, land, free, sea, overlays: c.meshes.overlay.map((o) => o.name), structureCells: prot, railCells: rail, top: +top.toFixed(1), tris: c.tris, ms: c.ms, terrainMeshes: c.meshes.terrain.map((o) => o.name), big: c.big, vegMeshes: c.meshes.veg.length, names: Object.fromEntries(Object.entries(c.names).sort((a, b) => b[1] - a[1]).slice(0, 24)) },
    field: { n: c.n, step: c.step, h: round2(c.h), cls: Array.from(c.cls), railY: round2(c.railY) },
  };
}

// 配色表：0 原配色 · 1 Bad North 夏（badnorth/theme.js BN_PAL.summer）· 2 Townscaper（core/palette.js）
function buildMesh(c, plan) {
  const { n, step, half, chart } = c, { h, jx, jz, mat, shade } = plan, pos = [], col = [], P = new THREE.Vector3(), PALETTE = PALETTES[plan.style?.palette ?? 0] || PALETTES[0];
  const vert = (i, j) => { const q = j * n + i; chart.toWorld(i * step - half + (jx?.[q] || 0), h[q], j * step - half + (jz?.[q] || 0), P); pos.push(P.x, P.y, P.z); };
  let t = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
    if (h[a] == null || h[b] == null || h[d] == null || h[e] == null) { t += 2; continue; }
    const flip = (i + j) & 1, tri = flip ? [[i, j], [i, j + 1], [i + 1, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]];
    for (let k = 0; k < 6; k++) { vert(tri[k][0], tri[k][1]); const f = t + (k >= 3 ? 1 : 0), p = PALETTE[mat?.[f] ?? 1], s = shade?.[f] ?? 1; col.push(p[0] * s, p[1] * s, p[2] * s); }
    t += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.name = `mountain-candidate-${c.id}`; mesh.userData.mountainCandidate = true; mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}
/** 植被跟着地面走：按所在格的高差沿当地「上」方向平移（InstancedMesh 逐实例） */
function moveVegetation(c, plan) {
  const { n, step, half, chart } = c, w = new THREE.Vector3(), s = new THREE.Vector3(), m4 = new THREE.Matrix4(), inv = new THREE.Matrix4(), moved = [];
  const delta = (world) => { chart.worldToStage(world, s); const i = Math.round((s.x + half) / step), j = Math.round((s.z + half) / step); if (i < 0 || j < 0 || i >= n || j >= n) return 0; const q = j * n + i; return Number.isFinite(c.h[q]) && plan.h[q] != null ? plan.h[q] - c.h[q] : 0; };
  for (const o of c.meshes.veg) {
    if (o.isInstancedMesh) {
      const keep = o.instanceMatrix.array.slice(); let any = false; inv.copy(o.matrixWorld).invert();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); w.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); const d = delta(w); if (Math.abs(d) < 0.05) continue; const lp = w.clone().addScaledVector(w.clone().normalize(), d).applyMatrix4(inv); m4.setPosition(lp); o.setMatrixAt(i, m4); any = true; }
      if (any) { o.instanceMatrix.needsUpdate = true; moved.push({ o, keep }); }
    } else {
      const g = o.geometry; w.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld); const d = delta(w); if (Math.abs(d) < 0.05 || !o.parent) continue;
      const keep = o.position.clone(), base = o.getWorldPosition(new THREE.Vector3()), target = base.clone().add(w.clone().normalize().multiplyScalar(d));
      o.position.copy(o.parent.worldToLocal(target)); o.updateMatrixWorld(true); moved.push({ o, position: keep });
    }
  }
  return moved;
}
function clearPreview() {
  const c = cur; if (!c) return;
  if (c.mesh) { c.mesh.removeFromParent(); c.mesh.geometry.dispose(); c.mesh.material.dispose(); c.mesh = null; }
  for (const o of c.hidden) o.visible = true; c.hidden = [];
  for (const m of c.moved) { if (m.keep) { m.o.instanceMatrix.array.set(m.keep); m.o.instanceMatrix.needsUpdate = true; } else { m.o.position.copy(m.position); m.o.updateMatrixWorld(true); } } c.moved = [];
}
export function previewMountain({ scene, id = 'citadel', plan } = {}) {
  const r = probeMountain({ scene, id }); if (!r.ok) return r;
  const c = cur;
  if (!plan || !Array.isArray(plan.h) || plan.h.length !== c.n * c.n) return { ok: false, reason: '山形计划与采样网格不一致，请重新扫描后执行' };
  clearPreview();
  c.mesh = buildMesh(c, plan); scene.add(c.mesh);
  for (const o of [...c.meshes.terrain, ...c.meshes.overlay]) if (o.visible) { o.visible = false; c.hidden.push(o); }
  c.moved = moveVegetation(c, plan); c.plan = plan; c.comparing = false;
  return { ok: true, id, triangles: c.mesh.geometry.attributes.position.count / 3, hiddenMeshes: c.hidden.map((o) => o.name), vegetationMoved: c.moved.length };
}
export function compareMountain(on) {
  const c = cur; if (!c?.mesh) return { ok: false, reason: '没有正在预览的山形候选' };
  c.mesh.visible = !on; for (const o of c.hidden) o.visible = !!on; c.comparing = !!on;
  return { ok: true, original: !!on };
}
export function revertMountain() { if (!cur) return { reverted: false }; clearPreview(); cur = null; return { reverted: true }; }
export function commitMountain(id, plan) {
  try { localStorage.setItem(ADOPT_KEY(id), JSON.stringify({ plan, at: Date.now() })); } catch (e) { return { ok: false, reason: '本机存储写入失败：' + e.message }; }
  return { ok: true, adopted: id, note: '山形已存本机；带 ?citadelMountain=adopted 进游戏时部署。玩家地面碰撞仍是原地形，未重建。' };
}
export function adoptedMountain(id) { try { return JSON.parse(localStorage.getItem(ADOPT_KEY(id)) || 'null'); } catch { return null; } }
export function mountainState() {
  const c = cur; if (!c) return { active: false };
  return { active: true, id: c.id, previewing: !!c.mesh, comparing: !!c.comparing, triangles: c.mesh ? c.mesh.geometry.attributes.position.count / 3 : 0, hidden: c.hidden.length, vegetationMoved: c.moved.length };
}
