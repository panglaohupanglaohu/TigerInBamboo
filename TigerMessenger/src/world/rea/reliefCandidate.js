// 地貌候选（R48，地形管线重做「圣城之外」的一个场景，默认旧港湾 old-port）：游戏侧只做三件事——
// ① relief.probe：把实景采成规则高度网格 + 分类（0 可改地形 / 1 建筑 / 2 轨道），交给工坊的地貌管线 Worker；
// ② relief.preview：把 Worker 算好、验证 Worker 复算过的计划（system-workshop/relief/plan-mesh.js）建成 low poly 网格 + 岩檐 + 梯子 / 等高线，贴回球面；
// ③ relief.compare / relief.revert / relief.state：对照原样、拆掉候选、读状态。
// 只是候选：原地形网格只隐藏不改，建筑 / 轨道不动；不写任何存档 / 本机存储，不改默认、不碰莫西斯湖上建筑。
// 原地形网格太大（包围球半径 > 采样半边长 × 2.5，多半是整块星球地面）时不隐藏它，改成「叠加」模式：候选只在比原地面高的地方看得见，状态里写 mode:'overlay'。
import * as THREE from 'three';
import { ReaBattleStage } from './reaBattleStage.js';
import { isCrossableRailOrTram } from '../vikings/vikingVoyage.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';
import { planMesh } from '../../system-workshop/relief/plan-mesh.js?v=relief-r1';

export const RELIEF_PRESETS = Object.freeze({ 'old-port': { half: 90, step: 3 }, moss: { half: 75, step: 3 } });
export const RELIEF_SCENES = Object.keys(RELIEF_PRESETS);
const TERRAIN_DEFAULT = /terrain|ground|island|cliff|rock|hill|mountain|land|shore|coast|beach|seabed|slope|bank|turf|dune|sand|earth|soil|quay-?bed|embank|walk|street|road|plaza|terrace|stair|planet-surface/i;
const VEG = /pine|tree|shrub|leaf|leaves|bush|flower|grass-?blade|tuft|canopy|foliage|plant|cypress|trunk|moss-?clump/i;
const FX = /cloud|beam|water|sea(?!bed)|ocean|foam|wave|particle|smoke|glow|halo|shadow|ring|sky|mist|fog|bird|rea-battle|rea-terrain|mountain-candidate|relief-candidate/i;
const RAIL = /tram|(^|[^d])rail|wire|cable|catenary|viaduct|track|sleeper/i;
const pathOf = (o) => `${o.name}<${o.parent?.name || ''}<${o.parent?.parent?.name || ''}`;
let cur = null;

function chartFor(dir) {
  const c = Object.create(ReaBattleStage.prototype), up = dir.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
  Object.assign(c, { up, east, north: up.clone().cross(east).normalize(), seaR: 160 + officialOceanLevelAt(up), scale: 1 });
  return c;
}
function classify(o, terrainRe) {
  for (let p = o; p; p = p.parent) if (!p.visible || p.userData.reaBattleStage || p.userData.reaIgnore || p.userData.mountainCandidate || p.userData.reliefCandidate) return null;
  const path = pathOf(o);
  if (FX.test(path)) return null;
  if (VEG.test(path)) return 'veg';
  if (isCrossableRailOrTram(o) || RAIL.test(path)) return 'rail';
  if (terrainRe.test(path)) return 'terrain';
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false) return null;
  return 'structure';
}

/** 实景 → 规则高度网格（米，离海面）+ 分类。地形三角按重心坐标逐格取最高；建筑 / 轨道三角按投影标格。 */
function sample(root, chart, { half, step }, terrainRe) {
  const n = Math.round(half * 2 / step) + 1, N = n * n, h = new Float32Array(N).fill(NaN), cls = new Uint8Array(N);
  const meshes = { terrain: [], veg: [], rail: [], structure: [] }, names = {}, centre = chart.up.clone().multiplyScalar(chart.seaR), bc = new THREE.Vector3(), reach = half * 1.6;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const k = classify(o, terrainRe); if (!k) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    bc.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const rad = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (!o.isInstancedMesh && bc.distanceTo(centre) - rad > reach) return;
    meshes[k].push(o); o.userData.__reliefRad = rad;
    const key = k + ':' + (o.name || o.parent?.name || '?').replace(/[-_]?\d+$/, ''); names[key] = (names[key] || 0) + 1;
  });
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const eachTri = (o, fn) => {
    const pos = o.geometry.attributes.position, ix = o.geometry.index?.array, cnt = ix ? ix.length : pos.count;
    const mats = o.isInstancedMesh ? Array.from({ length: Math.min(o.count, 4000) }, (_, i) => { o.getMatrixAt(i, m4); return m4.clone().premultiply(o.matrixWorld); }) : [o.matrixWorld];
    for (const m of mats) for (let i = 0; i + 2 < cnt; i += 3) {
      chart.worldToStage(va.fromBufferAttribute(pos, ix ? ix[i] : i).applyMatrix4(m), va); chart.worldToStage(vb.fromBufferAttribute(pos, ix ? ix[i + 1] : i + 1).applyMatrix4(m), vb); chart.worldToStage(vc.fromBufferAttribute(pos, ix ? ix[i + 2] : i + 2).applyMatrix4(m), vc);
      const x0 = Math.min(va.x, vb.x, vc.x), x1 = Math.max(va.x, vb.x, vc.x), z0 = Math.min(va.z, vb.z, vc.z), z1 = Math.max(va.z, vb.z, vc.z);
      if (x1 < -half || x0 > half || z1 < -half || z0 > half) continue;
      fn(x0, x1, z0, z1);
    }
  };
  const raster = (x0, x1, z0, z1, onCell) => {
    const d = (vb.z - vc.z) * (va.x - vc.x) + (vc.x - vb.x) * (va.z - vc.z), small = (x1 - x0) * (z1 - z0) < step * step * 4;
    for (let j = Math.max(0, Math.ceil((z0 + half) / step)); j <= Math.min(n - 1, Math.floor((z1 + half) / step)); j++) for (let i = Math.max(0, Math.ceil((x0 + half) / step)); i <= Math.min(n - 1, Math.floor((x1 + half) / step)); i++) {
      const x = i * step - half, z = j * step - half;
      if (Math.abs(d) < 1e-12) { if (small) onCell(j * n + i, Math.max(va.y, vb.y, vc.y)); continue; }
      const l1 = ((vb.z - vc.z) * (x - vc.x) + (vc.x - vb.x) * (z - vc.z)) / d, l2 = ((vc.z - va.z) * (x - vc.x) + (va.x - vc.x) * (z - vc.z)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) { if (small) onCell(j * n + i, Math.max(va.y, vb.y, vc.y)); continue; }
      onCell(j * n + i, l1 * va.y + l2 * vb.y + l3 * vc.y);
    }
  };
  let terrainTris = 0;
  for (const o of meshes.terrain) eachTri(o, (x0, x1, z0, z1) => { terrainTris++; raster(x0, x1, z0, z1, (q, y) => { if (!(h[q] >= y)) h[q] = y; }); });
  const cover = {};
  for (const [k, list] of [[1, meshes.structure], [2, meshes.rail]]) for (const o of list) { let marked = 0; eachTri(o, (x0, x1, z0, z1) => raster(x0, x1, z0, z1, (q) => { if ((k === 2 || cls[q] !== 2) && cls[q] !== k) marked++, cls[q] = k; })); if (marked) { const nm = (o.name || o.parent?.name || '?').replace(/[-_]?\d+$/, ''); cover[k + ':' + nm] = (cover[k + ':' + nm] || 0) + marked; } }
  const hh = Array.from(h, (v) => (Number.isFinite(v) && v > 0.05 ? +v.toFixed(3) : null));
  // 建筑 / 轨道压着但下面没采到地形的格（码头、栈桥下）：高度取相邻有地形格的均值（最多 3 轮），免得候选在建筑下画出一个海坑；仍是保护格，不改
  for (let pass = 0; pass < 3; pass++) {
    const fill = [];
    for (let q = 0; q < N; q++) { if (hh[q] != null || !cls[q]) continue; const i = q % n, j = (q - i) / n; let s2 = 0, c2 = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= n || b2 >= n) continue; const v = hh[b2 * n + a2]; if (v != null) { s2 += v; c2++; } } if (c2) fill.push([q, +(s2 / c2).toFixed(3)]); }
    if (!fill.length) break; for (const [q, v] of fill) hh[q] = v;
  }
  return { n, step, h: hh, cls: Array.from(cls), meshes, names, terrainTris, cover };
}

export function probeRelief({ scene, id = 'old-port', terrain = null } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象（先在系统工坊「当前场景」里切到它）` };
  const preset = RELIEF_PRESETS[id] || { half: 80, step: 3 };
  let re = TERRAIN_DEFAULT;
  if (typeof terrain === 'string' && terrain.length > 0 && terrain.length < 200) { try { re = new RegExp(terrain, 'i'); } catch { return { ok: false, reason: '地形网格名的正则写错了：' + terrain }; } }
  // 正在预览时原地形是隐藏的，采不到：先拆候选回原样再采（报告里写 revertedPreview）
  let revertedPreview = false;
  if (cur && (cur.id !== id || cur.previewing)) { revertedPreview = !!cur.previewing; revertRelief(); }
  const chart = chartFor(t.dir.clone()), s = sample(scene || t.root, chart, preset, re);
  const land = s.h.filter((v) => v != null).length, prot = s.cls.filter((c) => c).length;
  const top = (k) => Object.entries(s.names).filter(([x]) => x.startsWith(k + ':')).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x, c]) => `${x.slice(k.length + 1)}×${c}`);
  cur = { id, label: t.label || id, chart, sample: s, root: t.root, group: null, hidden: [], previewing: false, comparing: false, mode: null, plan: null };
  if (!s.meshes.terrain.length || !land) return { ok: false, reason: `${t.label || id}：没认出地形网格（按名字 ${re.source} 找的）。可以在 relief.probe 里传 terrain 正则重试`, names: { structure: top('structure'), veg: top('veg'), rail: top('rail') } };
  return {
    ok: true, scene: id, label: t.label || id, source: 'game', revertedPreview, n: s.n, cell: s.step, h: s.h, cls: s.cls, seed: 4100 + RELIEF_SCENES.indexOf(id),
    audit: { land, protected: prot, free: s.h.filter((v, i) => v != null && !s.cls[i]).length, terrainMeshes: s.meshes.terrain.length, terrainTris: s.terrainTris, structureMeshes: s.meshes.structure.length, railMeshes: s.meshes.rail.length, vegMeshes: s.meshes.veg.length, terrainNames: top('terrain'), structureNames: top('structure'),
      coverTop: Object.entries(s.cover).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x, c]) => `${x.slice(2)}×${c}`) },
  };
}

function buildGroup(c, plan, { lines = true } = {}) {
  const m = planMesh(plan, { cls: c.sample.cls, lines }), P = new THREE.Vector3(), group = new THREE.Group();
  group.name = `relief-candidate-${c.id}`; group.userData.reliefCandidate = true; group.userData.reaIgnore = true;
  const toWorld = (arr, lift = 0) => { const out = new Float32Array(arr.length); for (let i = 0; i < arr.length; i += 3) { c.chart.toWorld(arr[i], arr[i + 1] + lift, arr[i + 2], P); out[i] = P.x; out[i + 1] = P.y; out[i + 2] = P.z; } return out; };
  const meshOf = (pos, col, name, lift) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(toWorld(pos, lift), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
    mesh.name = name; mesh.userData.reliefCandidate = true; mesh.receiveShadow = true; mesh.castShadow = true; return mesh;
  };
  const lift = c.mode === 'overlay' ? 0.08 : 0;
  group.add(meshOf(m.positions, m.colors, 'relief-surface', lift));
  if (m.lipPositions.length) group.add(meshOf(m.lipPositions, m.lipColors, 'relief-lips', lift));
  if (lines && m.ladderLines.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(toWorld(m.ladderLines, lift), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6b4a2b })); l.name = 'relief-ladders'; group.add(l); }
  if (lines && m.contourLines.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(toWorld(m.contourLines, lift + 0.03), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.8 })); l.name = 'relief-contours'; group.add(l); }
  return { group, stats: { triangles: m.triangles, lips: m.lips, ladderSegs: m.ladderLines.length / 6, contourSegs: m.contourLines.length / 6 } };
}

export function previewRelief({ scene, id = 'old-port', plan, lines = true } = {}) {
  if (!scene) return { ok: false, reason: '游戏场景尚未就绪' };
  if (!cur || cur.id !== id) { const p = probeRelief({ scene, id }); if (!p.ok) return p; }
  if (!plan || plan.n !== cur.sample.n || !Array.isArray(plan.h) || plan.h.length !== plan.n * plan.n) return { ok: false, reason: '候选计划和实景采样对不上（网格大小不同）：先重新扫描再执行' };
  if (plan.persist !== false) return { ok: false, reason: '候选计划要求写存档（persist ≠ false），拒绝预览' };
  if (cur.group) { cur.group.removeFromParent(); disposeGroup(cur.group); cur.group = null; }
  if (!cur.previewing) {
    const limit = (RELIEF_PRESETS[id]?.half || 80) * 2.5, hide = cur.sample.meshes.terrain.filter((o) => o.userData.__reliefRad <= limit);
    cur.mode = hide.length === cur.sample.meshes.terrain.length ? 'replace' : hide.length ? 'partial' : 'overlay';
    for (const o of hide) { if (o.visible) { o.visible = false; cur.hidden.push(o); } }
  }
  const built = buildGroup(cur, plan, { lines }); cur.group = built.group; scene.add(built.group);
  cur.previewing = true; cur.comparing = false; cur.plan = { applied: plan.applied || [], lips: plan.lips?.length || 0, ladders: plan.ladders?.length || 0 };
  return { ok: true, scene: id, label: cur.label, previewing: true, mode: cur.mode, hiddenMeshes: cur.hidden.length, keptTerrainMeshes: cur.sample.meshes.terrain.length - cur.hidden.length, stats: built.stats, applied: cur.plan.applied };
}

/** on = true：看原样（候选藏起来、原地形放出来）；false：看候选 */
export function compareRelief({ on = true } = {}) {
  if (!cur?.group) return { ok: false, reason: '还没有预览候选' };
  cur.group.visible = !on; for (const o of cur.hidden) o.visible = !!on; cur.comparing = !!on;
  return { ok: true, comparing: cur.comparing, showing: on ? 'original' : 'candidate' };
}

function disposeGroup(g) { g.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.()); }); }
export function revertRelief() {
  if (!cur) return { ok: true, reverted: false };
  for (const o of cur.hidden) o.visible = true;
  if (cur.group) { cur.group.removeFromParent(); disposeGroup(cur.group); }
  const id = cur.id, restored = cur.hidden.length; cur = null;
  return { ok: true, reverted: true, scene: id, restoredMeshes: restored };
}

export function reliefState() {
  if (!cur) return { active: false, scenes: RELIEF_SCENES };
  return { active: true, scene: cur.id, label: cur.label, previewing: cur.previewing, comparing: cur.comparing, mode: cur.mode, hiddenMeshes: cur.hidden.length,
    candidateVisible: !!cur.group?.visible, candidateInScene: !!cur.group?.parent, applied: cur.plan?.applied || [], lips: cur.plan?.lips || 0, ladders: cur.plan?.ladders || 0, scenes: RELIEF_SCENES };
}

/** 编辑镜头对准采样区（斜 45° 俯看），只动镜头 */
export function reliefView({ camera, id = 'old-port', view = 'oblique' } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id); if (!t?.dir || !camera) return { ok: false, reason: '场景或镜头不可用' };
  const chart = cur?.id === id ? cur.chart : chartFor(t.dir.clone()), half = RELIEF_PRESETS[id]?.half || 80;
  const V = { oblique: [half * 1.1, half * 0.9, half * 1.1], top: [0, half * 2.2, 0.01], side: [half * 1.6, half * 0.35, 0] }[view];
  if (!V) return { ok: false, reason: '没有这个机位：' + view };
  const P = chart.toWorld(V[0], V[1], V[2], new THREE.Vector3()), A = chart.toWorld(0, 8, 0, new THREE.Vector3());
  camera.position.copy(P); camera.up.copy(P.clone().normalize()); camera.lookAt(A); camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  return { ok: true, view };
}
