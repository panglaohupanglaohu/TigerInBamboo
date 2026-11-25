// 建筑候选（R57 高山圣城 · R58 水晶城 · R59 整体替换 / 撤回 · R60 接在山形候选后面跑）。
// 游戏侧只做四件事：① building.probe 把实景采成高度网格 + 已有建筑 / 轨道掩码（圣城直接复用山形的采样；
//   山形候选正在预览时，自由地形格的高度换成候选山形 —— 「地形 → 建筑」两段管线就在这里接上）；
//   ② building.preview 把 Worker 算好、验证过的建筑群建成一组独立网格贴在球面上（userData.reaIgnore，山形采样不会把它当建筑）；
//   ③ compare / revert：对照原样 = 隐藏这组网格；撤回 = 删掉这组网格。已有建筑、湖上建筑、用户存档一概不碰；
//   ④ commit：只写 tm.building.adopted.v1:<场景> 采用记录，进游戏不自动换上（P-R57-01 待用户决定）。
//   building.probe / preview / compare / revert / commit / unadopt / camera / state（pipeline-bridge）
import * as THREE from 'three';
import { morrisViewer } from '../morrisViewer.js';
import { ReaBattleStage } from './reaBattleStage.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';
import { canyonOffsetDir } from '../canyon.js';
import { WORLD_RADIUS } from '../worldScale.js';
import { probeMountain, currentMountain } from './mountainCandidate.js?v=mountain-r28';
import { buildingBoxes, crystalField, heightSig, adoptKey, adoptRecord } from './building-geom.js?v=building-r1';

export const BUILDING_SCENES = ['citadel', 'crystal'];
const CRYSTAL = { half: 120, step: 4 };
const SKIP = /cloud|beam|water|sea|ocean|foam|wave|particle|smoke|glow|halo|shadow|ring|sky|mist|fog|bird|flock|outline|rea-battle|mountain-candidate|building-candidate/i;
let cur = null;      // { id, label, chart, field, terrain, mountainSig, group, comparing, layout }

function chartFor(dir) {
  const c = Object.create(ReaBattleStage.prototype), up = dir.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
  Object.assign(c, { up, east, north: up.clone().cross(east).normalize(), seaR: 160 + officialOceanLevelAt(up), scale: 1 });
  return c;
}
const target = (id) => globalThis.__tmSceneTargets?.().find((x) => x.id === id);

/** 水晶城：地面 = 球半径 + 峡谷阶地沉降（canyon.js，与星球顶点改造同一套数学）；根对象下每个可见网格 / 实例的包围框标成已有建筑。 */
function sampleCrystal(t, chart) {
  const { half, step } = CRYSTAL, n = Math.round(half * 2 / step) + 1, P = new THREE.Vector3(), S = new THREE.Vector3(), box = new THREE.Box3(), m4 = new THREE.Matrix4(), corner = new THREE.Vector3();
  const groundAt = (x, z) => { chart.toWorld(x, 0, z, P); const d = P.clone().normalize(); return WORLD_RADIUS + canyonOffsetDir(d) - chart.seaR; };
  const structures = [], push = (b, mat) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 8; k++) { corner.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(mat); chart.worldToStage(corner, S); x0 = Math.min(x0, S.x); x1 = Math.max(x1, S.x); z0 = Math.min(z0, S.z); z1 = Math.max(z1, S.z); }
    if (x1 < -half || x0 > half || z1 < -half || z0 > half) return;
    if ((x1 - x0) * (z1 - z0) > 0.6 * (2 * half) * (2 * half)) return;   // 包住整座城的大网格（能量海 / 平台底座）不当建筑
    structures.push({ x0, x1, z0, z1 });
  };
  t.root.updateWorldMatrix(true, true);
  t.root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    for (let p = o; p; p = p.parent) if (!p.visible || p.userData?.reaIgnore || p.userData?.buildingCandidate) return;
    if (SKIP.test(`${o.name}<${o.parent?.name || ''}`)) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); box.copy(g.boundingBox);
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); push(box, m4); } }
    else push(box, o.matrixWorld);
  });
  const f = crystalField({ n, step, half, groundAt, structures });
  return { field: f, structures: structures.length };
}

function summarize(field) {
  let land = 0, free = 0, prot = 0, rail = 0, top = -Infinity; const sea = field.sea ?? 0.3;
  for (let q = 0; q < field.h.length; q++) { const v = field.h[q]; if (v == null || !(v > sea)) continue; land++; if (!field.cls[q]) free++; if (field.cls[q] === 1) prot++; if (field.cls[q] === 2) rail++; top = Math.max(top, v); }
  return { n: field.n, step: field.step, half: field.half, land, free, structureCells: prot, railCells: rail, top: Number.isFinite(top) ? +top.toFixed(1) : 0, sea };
}

/** 采样。圣城：山形采样 + （若山形候选在预览）候选高度；水晶城：解析阶地 + 足迹。 */
export function probeBuilding({ scene, id = 'citadel' } = {}) {
  if (!BUILDING_SCENES.includes(id)) return { ok: false, reason: `场景 ${id} 还没有建筑管线（目前只有高山圣城、水晶城）` };
  const t = target(id); if (!t?.dir || !t?.root || (t.dir.lengthSq && t.dir.lengthSq() < 1e-8)) return { ok: false, reason: `场景 ${id} 未注册、没有根对象或方向向量退化` };
  if (cur && cur.id !== id) revertBuilding();
  let field, terrain = 'original', mountainSig = null, notes = [];
  if (id === 'citadel') {
    const r = probeMountain({ scene, id }); if (!r.ok) return r;
    field = { ...r.field, half: r.site.half, sea: 0.3 };
    const m = currentMountain();
    if (m.ok && m.id === id && Array.isArray(m.plan?.h) && m.plan.h.length === field.h.length) {
      field.h = field.h.map((v, q) => (field.cls[q] === 0 && m.plan.h[q] != null ? m.plan.h[q] : v)); terrain = 'mountain-candidate'; mountainSig = heightSig(m.plan.h);
      notes.push('高度用正在预览的山形候选（自由地形格），建筑 / 轨道格仍是原采样');
    } else notes.push('高度用原地形（没有正在预览的山形候选）');
  } else {
    const s = sampleCrystal(t, chartFor(t.dir)); field = s.field; notes.push(`地面 = 峡谷阶地（canyon.js 解析）；根对象下 ${s.structures} 个网格 / 实例的包围框标成已有建筑（含用户搭建的晶塔）；最低一级阶地当能量海`);
  }
  const chart = chartFor(t.dir);
  const keep = cur && cur.id === id ? cur : null;
  cur = { id, label: t.label || id, chart, field, terrain, mountainSig, group: keep?.group || null, comparing: keep?.comparing || false, layout: keep?.layout || null, scene };
  return { ok: true, id, label: cur.label, terrain, mountainSig, previewing: !!cur.group, site: { ...summarize(field), notes }, field: { n: field.n, step: field.step, half: field.half, h: field.h, cls: Array.from(field.cls), sea: field.sea } };
}

function frameAt(chart, x, y, z) {
  const P = chart.toWorld(x, y, z, new THREE.Vector3()), up = P.clone().normalize(), E = chart.toWorld(x + 1, y, z, new THREE.Vector3()).sub(P);
  E.addScaledVector(up, -E.dot(up)).normalize(); const Z = new THREE.Vector3().crossVectors(E, up).normalize();
  return new THREE.Matrix4().makeBasis(E, up, Z).setPosition(P);
}
function buildGroup(c, layout) {
  const g = new THREE.Group(); g.name = `building-candidate-${c.id}`; g.userData.buildingCandidate = true; g.userData.reaIgnore = true;
  const mats = new Map(), mat = (hex) => { if (!mats.has(hex)) mats.set(hex, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.9, metalness: 0 })); return mats.get(hex); };
  const boxG = new THREE.BoxGeometry(1, 1, 1), roofG = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); roofG.rotateY(Math.PI / 4);
  let count = 0;
  for (const b of buildingBoxes(layout)) {
    const mesh = new THREE.Mesh(b.kind === 'roof' ? roofG : boxG, mat(b.color)), h = Math.max(0.05, b.y1 - b.y0);
    mesh.matrixAutoUpdate = false; mesh.matrixWorldNeedsUpdate = true; mesh.matrix.copy(frameAt(c.chart, b.x, (b.y0 + b.y1) / 2, b.z)).multiply(new THREE.Matrix4().makeScale(b.sx, h, b.sz));
    mesh.name = `building-candidate-${b.kind}-${b.n}`; mesh.castShadow = b.kind !== 'road'; mesh.receiveShadow = true; mesh.userData.buildingCandidate = true; mesh.userData.reaIgnore = true;
    g.add(mesh); count++;
  }
  g.userData.dispose = () => { boxG.dispose(); roofG.dispose(); for (const m of mats.values()) m.dispose(); };
  return { group: g, meshes: count };
}
function clearGroup() { const c = cur; if (!c?.group) return; c.group.removeFromParent(); c.group.userData.dispose?.(); c.group = null; c.comparing = false; c.layout = null; }

/** 预览（R57 / R58）：先撤掉旧候选，再建新的一组（= 整体放置；新种子再预览 = 整体替换，R59）。 */
export function previewBuilding({ scene, id = 'citadel', layout } = {}) {
  if (!cur || cur.id !== id) { const r = probeBuilding({ scene, id }); if (!r.ok) return r; }
  const c = cur;
  if (!layout?.placements?.length) return { ok: false, reason: '建筑群计划为空' };
  if (layout.W !== Math.floor(c.field.n / layout.k) || layout.step !== c.field.step) return { ok: false, reason: '建筑群计划与采样网格不一致，请重新扫描后执行' };
  if (c.terrain === 'mountain-candidate') { const m = currentMountain(); if (!m.ok || heightSig(m.plan.h) !== c.mountainSig) return { ok: false, reason: '山形候选在扫描之后变了（或已放弃）：建筑会悬空 / 埋进山里，请重新扫描建筑管线' }; }
  clearGroup();
  const { group, meshes } = buildGroup(c, layout); scene.add(group); c.group = group; c.layout = layout; c.comparing = false; c.scene = scene;
  return { ok: true, id, buildings: layout.placements.length, roads: layout.roads.length, meshes, terrain: c.terrain };
}
export function compareBuilding(on) { const c = cur; if (!c?.group) return { ok: false, reason: '没有正在预览的建筑候选' }; c.group.visible = !on; c.comparing = !!on; return { ok: true, original: !!on }; }
/** 撤回：删掉这组候选网格（场景里原有的东西本来就没动）。 */
export function revertBuilding() { if (!cur) return { reverted: false }; const had = !!cur.group; clearGroup(); return { reverted: had }; }
export function commitBuilding(id, layout) {
  try { const rec = adoptRecord({ id, layout, terrain: cur?.id === id ? cur.terrain : 'original', mountainSig: cur?.id === id ? cur.mountainSig : null }); localStorage.setItem(adoptKey(id), JSON.stringify(rec)); return { ok: true, note: `已记下采用（${rec.buildings} 栋，${rec.terrain === 'mountain-candidate' ? '站在山形候选上' : '站在原地形上'}）。只存候选记录，不改已有建筑和存档；进游戏不会自动换上（待你决定）。`, key: adoptKey(id) }; }
  catch (e) { return { ok: false, reason: e.message }; }
}
export function unadoptBuilding(id = 'citadel') { let had = false; try { had = localStorage.getItem(adoptKey(id)) != null; localStorage.removeItem(adoptKey(id)); } catch {} revertBuilding(); return { ok: true, removed: had, key: adoptKey(id) }; }
export function adoptedBuilding(id) { try { return JSON.parse(localStorage.getItem(adoptKey(id)) || 'null'); } catch { return null; } }

/** R-A6 / P-R57-01：进游戏自动摆上（用户在默认总栏点了「进游戏自动摆上」后 autoDeploy=true）。
 *  镜像 autoDeployAdoptedMountain：等场景就绪 → 指纹 / 地形一致性核对 → previewBuilding。
 *  如实报状态到 __tmBuildingAuto_<id>；失败不碰场景，只写 reason。 */
export function autoDeployAdoptedBuilding({ getScene = () => globalThis.__tm?.scene, id = 'citadel', firstWaitMs = 30000, retryMs = 15000, tries = 10 } = {}) {
  const st = (globalThis['__tmBuildingAuto_' + id] = { id, status: 'checking', reason: '', tries: 0, at: Date.now() });
  const rec = adoptedBuilding(id);
  if (!rec?.autoDeploy) { Object.assign(st, { status: 'skipped', reason: rec ? '采用记录在，但自动摆上没开（P-R57-01 选了手动或还没决定）' : '没有建筑采用记录' }); return st; }
  const later = (reason, mismatch = false) => { st.reason = reason; if (st.tries >= tries) { st.status = mismatch ? 'mismatch' : 'gave-up'; return; } st.status = 'waiting'; setTimeout(attempt, retryMs); };
  function attempt() {
    if (st.status === 'removed') return;
    st.tries++; const scene = getScene();
    if (!scene || !globalThis.__tmSceneTargets?.().some((t) => t.id === id && t.root)) { st.tries--; st.waits = (st.waits || 0) + 1; st.status = 'waiting'; st.reason = `场景还没就绪（等进入${id === 'crystal' ? '水晶城' : '高山圣城'}）`; setTimeout(attempt, retryMs); return; }
    if (cur?.group) { Object.assign(st, { status: 'skipped', reason: '工坊里正在预览别的建筑候选：不覆盖' }); return; }
    // 地形一致性：记录是站在山形候选上算的 → 山形候选必须在预览且指纹一致；记录按原地形算的 → 不能有山形候选在预览（会悬空）
    const m = currentMountain();
    if (rec.terrain === 'mountain-candidate' && (!m.ok || heightSig(m.plan.h) !== rec.mountainSig)) return later('采用记录站在山形候选上，但山形候选没摆上 / 指纹变了：等山形自动部署或回工坊重扫');
    if (rec.terrain === 'original' && m.ok) return later('采用记录按原地形算的，现在有山形候选在预览：回工坊重扫后再采用');
    const r = probeBuilding({ scene, id });
    if (!r.ok) return later(r.reason);
    const p = previewBuilding({ scene, id, layout: rec.layout }); if (!p.ok) return later(p.reason);
    Object.assign(st, { status: 'deployed', reason: `已按采用记录自动摆上 ${p.buildings} 栋`, at: Date.now(), buildings: p.buildings });
  }
  setTimeout(attempt, firstWaitMs);
  return st;
}

/** 固定机位（看建筑群窗口）：oblique 斜俯 / top 俯视 / free 还原。 */
let fixedPrev = null;
export function buildingCamera({ view = 'oblique' } = {}) {
  const camera = morrisViewer.camera || globalThis.__tm?.camera;
  if (view === 'free') { const p = fixedPrev; if (!p) return { ok: true, view, restored: false }; morrisViewer.planetCamera = p.planetCamera; morrisViewer.applyTownCamera = p.apply; morrisViewer.orbitInput = p.orbit; if (camera && p.fov) { camera.fov = p.fov; camera.near = p.near; camera.updateProjectionMatrix(); } fixedPrev = null; return { ok: true, view, restored: true }; }
  const c = cur; if (!c) return { ok: false, reason: '先扫描建筑管线' }; if (!camera) return { ok: false, reason: '游戏镜头未就绪' };
  const L = c.layout, cs = L?.cellSize || 6, w = L?.window || { i0: 0, j0: 0, w: Math.floor(c.field.n / 2), h: Math.floor(c.field.n / 2) };
  const k = L?.k || Math.max(1, Math.round(6 / c.field.step)), mid = (v) => (v * k + (k - 1) / 2) * c.field.step - (c.field.half ?? 0);
  const ax = mid(w.i0 + w.w / 2), az = mid(w.j0 + w.h / 2), span = Math.max(w.w, w.h) * cs; let ay = 0;
  if (L?.placements?.length) ay = L.placements.reduce((s, p) => s + p.base, 0) / L.placements.length;
  const pos = view === 'top' ? [ax, ay + span * 1.6, az + 0.5] : [ax - span * 0.75, ay + span * 0.85, az + span * 0.75];
  const P = c.chart.toWorld(...pos, new THREE.Vector3()), A = c.chart.toWorld(ax, ay, az, new THREE.Vector3());
  const up = view === 'top' ? c.chart.toWorld(ax, 0, az - 10, new THREE.Vector3()).sub(c.chart.toWorld(ax, 0, az, new THREE.Vector3())).normalize() : P.clone().normalize();
  const apply = () => { camera.position.copy(P); camera.up.copy(up); camera.lookAt(A); camera.fov = 40; camera.near = Math.min(camera.near, 0.5); camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  fixedPrev ||= { planetCamera: morrisViewer.planetCamera, apply: morrisViewer.applyTownCamera, orbit: morrisViewer.orbitInput, fov: camera.fov, near: camera.near };
  apply(); morrisViewer.orbitInput = null; morrisViewer.planetCamera = { scene: c.id, fixedView: 'building-' + view }; morrisViewer.applyTownCamera = apply;
  return { ok: true, view, stage: { pos, at: [ax, ay, az] } };
}

export function buildingState() {
  const c = cur, m = (() => { try { return currentMountain(); } catch { return { ok: false }; } })();
  if (!c) return { active: false, mountainPreviewing: !!m.ok };
  let meshes = 0; c.group?.traverse((o) => { if (o.isMesh) meshes++; });
  const stale = c.terrain === 'mountain-candidate' && (!m.ok || heightSig(m.plan.h) !== c.mountainSig);
  return { active: true, id: c.id, previewing: !!c.group, comparing: !!c.comparing, inScene: !!c.group?.parent, meshes, buildings: c.layout?.placements.length || 0, roads: c.layout?.roads.length || 0,
    terrain: c.terrain, mountainPreviewing: !!m.ok, terrainStale: stale, adopted: !!adoptedBuilding(c.id), seed: c.layout?.seed ?? null };
}
