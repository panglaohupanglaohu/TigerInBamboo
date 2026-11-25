// 山形候选（2026-11-22）：用户「高山圣城没有山的模样；轨道保留，其他可编辑」。
// 游戏侧只做三件事：① 把实景采成规则高度网格 + 分类掩码（地形 / 建筑 / 轨道 / 海）交给工坊 Worker；
// ② 把 Worker 算好的山形（mountain/capabilities.js，能力来自学习库）建成 low poly 网格贴回球面；
// ③ 对照 / 放弃 / 采用。原地形网格只隐藏不改，建筑与轨道不动，植被按高差抬落。
//   mountain.probe / preview / compare / revert / commit / state（pipeline-bridge）
// R25 预览 / 采用的山形同时接管玩家地面（globalThis.__tmMountainGround，main.js samplePlayerLocalGround 最后一道）：自由地形格按新山面，建筑 / 轨道格仍走原地面链。
// R26 固定机位 mountain.camera；R27 实景换配色 mountain.palette；R28 采用记录 v2 + 进游戏自动换上（autoDeployAdoptedMountain）+ 一键回原（mountain.unadopt）。
import { PALETTES } from '../../system-workshop/mountain/palettes.js';
import { createHeightfieldGround } from '../../system-workshop/mountain/ground.js?v=ground-r25';
import { adoptKey, adoptRecord, fieldSignature, shouldAutoDeploy } from '../../system-workshop/mountain/adopt.js?v=adopt-r28';
import { morrisViewer } from '../morrisViewer.js';
import * as THREE from 'three';
import { ReaBattleStage } from './reaBattleStage.js';
import { isCrossableRailOrTram } from '../vikings/vikingVoyage.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';

const PRESETS = { citadel: { half: 150, step: 3 } };
export const MOUNTAIN_SCENES = Object.keys(PRESETS);
const ADOPT_KEY = adoptKey;
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
function buildMesh(c, plan, palette = plan.style?.palette ?? 0) {
  const { n, step, half, chart } = c, { h, jx, jz, mat, shade } = plan, pos = [], col = [], P = new THREE.Vector3(), PALETTE = PALETTES[palette] || PALETTES[0];
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
/** R25 玩家地面：自由地形格（cls 0）按新山面回答；建筑 / 轨道格先用原地面链（base），原链没答案时才用山面（保护区里山面 = 原高）。对照原样时让回原地面。 */
function installGround(c, plan) {
  const g = createHeightfieldGround(plan, { half: c.half }), s = new THREE.Vector3(), { n, step, half, chart } = c; let queries = 0, used = 0;
  const fn = (position, base) => {
    if (cur !== c || !c.mesh || c.comparing || !position?.isVector3) return base;
    queries++; chart.worldToStage(position, s);
    const i = Math.round((s.x + half) / step), j = Math.round((s.z + half) / step); if (i < 0 || j < 0 || i >= n || j >= n) return base;
    if (c.cls[j * n + i] !== 0 && base != null) return base;
    const y = g.heightAt(s.x, s.z); if (y == null) return base;
    used++; return chart.seaR + y * chart.scale;
  };
  globalThis.__tmMountainGround = fn; c.ground = { g, fn, stats: () => ({ queries, used }) };
}
function uninstallGround(c) { if (c?.ground && globalThis.__tmMountainGround === c.ground.fn) delete globalThis.__tmMountainGround; if (c) c.ground = null; }
function clearPreview() {
  const c = cur; if (!c) return;
  uninstallGround(c);
  if (c.mesh) { c.mesh.removeFromParent(); c.mesh.geometry.dispose(); c.mesh.material.dispose(); c.mesh = null; }
  for (const o of c.hidden) o.visible = true; c.hidden = [];
  for (const m of c.moved) { if (m.keep) { m.o.instanceMatrix.array.set(m.keep); m.o.instanceMatrix.needsUpdate = true; } else { m.o.position.copy(m.position); m.o.updateMatrixWorld(true); } } c.moved = [];
}
export function previewMountain({ scene, id = 'citadel', plan } = {}) {
  const r = probeMountain({ scene, id }); if (!r.ok) return r;
  const c = cur;
  if (!plan || !Array.isArray(plan.h) || plan.h.length !== c.n * c.n) return { ok: false, reason: '山形计划与采样网格不一致，请重新扫描后执行' };
  clearPreview();
  c.palette = null; c.mesh = buildMesh(c, plan); scene.add(c.mesh); c.scene = scene;
  for (const o of [...c.meshes.terrain, ...c.meshes.overlay]) if (o.visible) { o.visible = false; c.hidden.push(o); }
  c.moved = moveVegetation(c, plan); c.plan = plan; c.comparing = false; c.auto = false;
  installGround(c, plan);
  return { ok: true, id, triangles: c.mesh.geometry.attributes.position.count / 3, hiddenMeshes: c.hidden.map((o) => o.name), vegetationMoved: c.moved.length, ground: true };
}
export function compareMountain(on) {
  const c = cur; if (!c?.mesh) return { ok: false, reason: '没有正在预览的山形候选' };
  c.mesh.visible = !on; for (const o of c.hidden) o.visible = !!on; c.comparing = !!on;
  return { ok: true, original: !!on };
}
export function revertMountain() { if (!cur) return { reverted: false }; clearPreview(); cur = null; return { reverted: true }; }
export function commitMountain(id, plan) {
  const c = cur; if (!c || c.id !== id) return { ok: false, reason: '先扫描并预览这个场景的山形，再采用' };
  let rec, palette = null;
  try {
    if (c.palette != null && c.plan && Array.isArray(c.plan.h) && c.plan.h.length === plan.h.length) { palette = c.palette; plan = { ...plan, style: { ...(plan.style || {}), palette } }; }
    rec = adoptRecord(plan, { n: c.n, step: c.step, h: Array.from(c.h, (v) => (Number.isFinite(v) ? v : null)), cls: c.cls });
    localStorage.setItem(ADOPT_KEY(id), JSON.stringify(rec));
  } catch (e) { return { ok: false, reason: '采用失败：' + e.message }; }
  const pn = { 0: '原配色', 1: 'Bad North 夏季', 2: 'Townscaper' }[plan.style?.palette ?? 0] || '';
  return { ok: true, adopted: id, v: rec.v, autoDeploy: true, palette: plan.style?.palette ?? 0,
    note: `山形已采用（存本机，配色 ${pn}${palette != null ? '，按实景当前配色' : ''}）：之后进游戏自动换上；玩家地面随新山形重建。想回原山形：点「回到原山形」，或网址加 ?mountainAdopted=0 只看一次原样。` };
}
/** R28 一键回原：删掉采用记录 + 撤下正在显示的山形（原地形、植被、地面全部恢复） */
export function unadoptMountain(id = 'citadel') {
  let removed = false; try { removed = localStorage.getItem(ADOPT_KEY(id)) != null; localStorage.removeItem(ADOPT_KEY(id)); } catch {}
  const reverted = !!cur?.mesh; if (cur) revertMountain();
  if (globalThis.__tmMountainAuto?.id === id) Object.assign(globalThis.__tmMountainAuto, { status: 'removed', reason: '用户回到原山形', at: Date.now() });
  return { ok: true, id, removed, reverted, note: removed ? '已回到原山形：采用记录已删除，下次进游戏也是原山形。' : '本来就没有采用记录；实景已是原山形。' };
}
export function adoptedState(id = 'citadel') {
  const rec = adoptedMountain(id);
  return { id, adopted: !!rec, v: rec?.v ?? null, at: rec?.at ?? null, autoDeploy: rec?.autoDeploy === true, sig: rec?.sig || null, palette: rec?.plan?.style?.palette ?? null,
    gate: shouldAutoDeploy(rec, { search: globalThis.location?.search || '' }), auto: globalThis.__tmMountainAuto || null, deployedNow: !!(cur?.id === id && cur.mesh && cur.auto) };
}
/**
 * R28 进游戏自动换上（main.js 启动后调用一次）。只认 v2 采用记录；场景要等异步建好：先等 firstWaitMs，再每 retryMs 试一次，最多 tries 次。
 * 每次都重新采样实景，指纹和采用时对得上才换；工坊里正在预览别的候选时不覆盖。状态在 globalThis.__tmMountainAuto。
 */
export function autoDeployAdoptedMountain({ getScene = () => globalThis.__tm?.scene, id = 'citadel', search = globalThis.location?.search || '', firstWaitMs = 20000, retryMs = 15000, tries = 8 } = {}) {
  const st = (globalThis.__tmMountainAuto = { id, status: 'checking', reason: '', tries: 0, at: Date.now() });
  const rec = adoptedMountain(id), pre = shouldAutoDeploy(rec, { search });
  if (!pre.deploy) { Object.assign(st, { status: 'skipped', reason: pre.reason }); return st; }
  const later = (reason, mismatch = false) => { st.reason = reason; if (st.tries >= tries) { st.status = mismatch ? 'mismatch' : 'gave-up'; return; } st.status = 'waiting'; setTimeout(attempt, retryMs); };
  function attempt() {
    if (st.status === 'removed') return;
    st.tries++; const scene = getScene();
    // 场景没就绪（玩家还没去高山圣城）不算失败次数：一直低频等，进了场景就换
    if (!scene || !globalThis.__tmSceneTargets?.().some((t) => t.id === id && t.root)) { st.tries--; st.waits = (st.waits || 0) + 1; st.status = 'waiting'; st.reason = '场景还没就绪（等进入高山圣城）'; setTimeout(attempt, retryMs); return; }
    if (cur?.mesh) { Object.assign(st, { status: 'skipped', reason: '工坊里正在预览别的山形候选：不覆盖' }); return; }
    revertMountain();
    let r; try { r = probeMountain({ scene, id }); } catch (e) { return later('采样失败：' + e.message); }
    if (!r.ok) return later(r.reason);
    const d = shouldAutoDeploy(rec, { search, sig: fieldSignature(r.field) });
    if (!d.deploy) { revertMountain(); return later(d.reason, true); }
    const p = previewMountain({ scene, id, plan: rec.plan }); if (!p.ok) return later(p.reason);
    cur.auto = true; Object.assign(st, { status: 'deployed', reason: d.reason, at: Date.now(), triangles: p.triangles });
  }
  setTimeout(attempt, firstWaitMs);
  return st;
}
/** R27 实景换配色（只换顶点色，不动形状与地面）：palette 0 原 / 1 Bad North 夏季 / 2 Townscaper；null = 回到计划里的配色 */
export function paletteMountain(palette) {
  const c = cur; if (!c?.mesh || !c.plan) return { ok: false, reason: '没有正在预览的山形候选' };
  const p = palette == null ? null : Number(palette); if (p != null && !PALETTES[p]) return { ok: false, reason: '没有这套配色' };
  const old = c.mesh, mesh = buildMesh(c, c.plan, p ?? c.plan.style?.palette ?? 0); mesh.visible = old.visible;
  old.parent?.add(mesh); old.removeFromParent(); old.geometry.dispose(); old.material.dispose(); c.mesh = mesh; c.palette = p;
  return { ok: true, palette: p ?? c.plan.style?.palette ?? 0, override: p != null };
}
/** 正在预览的计划（带实景当前配色）+ 采样（给工坊的配色对照、缩略图用） */
export function currentMountain() {
  const c = cur; if (!c?.plan) return { ok: false, reason: '没有正在预览的山形候选' };
  const plan = c.palette != null ? { ...c.plan, style: { ...(c.plan.style || {}), palette: c.palette } } : c.plan;
  return { ok: true, id: c.id, plan, field: { n: c.n, step: c.step, h: round2(c.h), cls: Array.from(c.cls) }, palette: plan.style?.palette ?? 0 };
}
/** R26 固定机位（贴球舞台坐标，原点在场景中心海面；米）。同一组机位拍原样和候选，才能逐张对照。 */
let fixedPrev = null;
export const CAMERA_VIEWS = {
  front: { label: '正面', pos: [0, 150, 310], at: [0, 25, 0] },
  side: { label: '侧面', pos: [310, 135, 0], at: [0, 25, 0] },
  top: { label: '俯视', pos: [0, 520, 0.5], at: [0, 0, 0] },
  oblique: { label: '斜后', pos: [-230, 190, -230], at: [0, 25, 0] },
};
function walkSpot(c) {
  const plan = c.plan, { n, step, half } = c, g = c.ground?.g; if (!plan || !g) return null; let best = null;
  for (let j = 3; j < n - 3; j++) for (let i = 3; i < n - 3; i++) {
    let ok = true; for (let b = -2; b <= 2 && ok; b++) for (let a = -2; a <= 2 && ok; a++) { const q = (j + b) * n + i + a; if (c.cls[q] !== 0 || !(plan.h[q] > 0.3) || !(c.h[q] > 0.3)) ok = false; }
    if (!ok) continue; const q = j * n + i, sl = Math.hypot(plan.h[q + 1] - plan.h[q - 1], plan.h[q + n] - plan.h[q - n]) / (4 * step); if (sl > Math.tan(25 * Math.PI / 180)) continue;
    if (!best || plan.h[q] > best.y) best = { i, j, x: i * step - half, z: j * step - half, y: g.heightAt(i * step - half, j * step - half) ?? plan.h[q] };
  }
  return best;
}
export function cameraView({ view = 'front' } = {}) {
  const camera = morrisViewer.camera || globalThis.__tm?.camera;
  // 'free' = 放开固定机位，还原进入固定机位之前的镜头控制（城镇 / 星球环绕）
  if (view === 'free') { const p = fixedPrev; if (!p) return { ok: true, view, restored: false }; morrisViewer.planetCamera = p.planetCamera; morrisViewer.applyTownCamera = p.apply; morrisViewer.orbitInput = p.orbit;
    if (camera && p.fov) { camera.fov = p.fov; camera.near = p.near; camera.updateProjectionMatrix(); } fixedPrev = null; return { ok: true, view, restored: true }; }
  const c = cur; if (!c) return { ok: false, reason: '先扫描高山圣城' }; if (!camera) return { ok: false, reason: '游戏镜头未就绪' };
  let v = CAMERA_VIEWS[view];
  if (view === 'eye') { const s = walkSpot(c); if (!s) return { ok: false, reason: '新山上找不到可站的平缓处（需要先预览候选）' }; let top = null; for (let q = 0; q < c.n * c.n; q++) if (c.cls[q] === 0 && c.plan.h[q] > (top?.y ?? -1)) top = { y: c.plan.h[q], x: (q % c.n) * c.step - c.half, z: ((q / c.n) | 0) * c.step - c.half };
    v = { label: '玩家视角（站在新山上，眼高 1.7 m，朝最高处）', pos: [s.x, s.y + 1.7, s.z], at: top && Math.hypot(top.x - s.x, top.z - s.z) > 6 ? [top.x, top.y, top.z] : [0, s.y, 0] }; }
  if (!v) return { ok: false, reason: '没有这个机位：' + view };
  const P = c.chart.toWorld(...v.pos, new THREE.Vector3()), A = c.chart.toWorld(...v.at, new THREE.Vector3());
  const up = view === 'top' ? c.chart.toWorld(0, 0, -10, new THREE.Vector3()).sub(c.chart.toWorld(0, 0, 0, new THREE.Vector3())).normalize() : P.clone().normalize();
  const apply = () => { camera.position.copy(P); camera.up.copy(up); camera.lookAt(A); camera.fov = view === 'eye' ? 60 : 40; camera.near = view === 'eye' ? 0.1 : Math.min(camera.near, 0.5); camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  fixedPrev ||= { planetCamera: morrisViewer.planetCamera, apply: morrisViewer.applyTownCamera, orbit: morrisViewer.orbitInput, fov: camera.fov, near: camera.near };
  apply(); morrisViewer.orbitInput = null; morrisViewer.planetCamera = { scene: c.id, fixedView: view }; morrisViewer.applyTownCamera = apply;
  return { ok: true, view, label: v.label, stage: { pos: v.pos, at: v.at } };
}
/**
 * R25 走一圈检验（实景）：
 *   samples  自由地形格上取点：新山面 heightAt、玩家真用的地面链 __tm.samplePlayerLocalGround、射线打候选网格，三者对比
 *   recheck  轨道格 / 建筑格的计划高度与原采样之差（轨道净空、建筑高差复检，应为 0）
 *   path     穿过新山最高处的一条直线，每 1.5 m 取一次地面：洞数与相邻最大落差
 *   placePlayer: true → 把玩家放到新山上一处平缓地（高 1.2 m 处、速度 0、不着地，让物理自己落地）
 *   readPlayer: true → 读玩家离地面多远（玩家脚下的新山面高度 vs 玩家半径）
 */
export function walkCheck({ placePlayer = false, readPlayer = false } = {}) {
  const c = cur; if (!c?.mesh || !c.ground) return { ok: false, reason: '没有正在预览的山形（或地面没接管）' };
  const { n, step, half, chart, plan } = c, g = c.ground.g, seaR = chart.seaR, chain = globalThis.__tm?.samplePlayerLocalGround, ray = new THREE.Raycaster(), W = new THREE.Vector3(), U = new THREE.Vector3(), S = new THREE.Vector3();
  const out = { ok: true, chainAvailable: typeof chain === 'function', comparing: !!c.comparing };
  if (placePlayer || readPlayer) {
    const player = globalThis.__tm?.player; if (!player?.position) return { ok: false, reason: '游戏没有暴露玩家（__tm.player）' };
    if (placePlayer) { const s = walkSpot(c); if (!s) return { ok: false, reason: '新山上找不到可站的平缓处' };
      chart.toWorld(s.x, s.y + 1.2, s.z, W); player.position.copy(W); player.velocity?.set?.(0, 0, 0); player.onGround = false; player.checkpoint?.copy?.(W);
      out.placed = { cell: [s.i, s.j], stage: [s.x, s.z], groundY: +s.y.toFixed(2) }; }
    chart.worldToStage(player.position, S); const gy = g.heightAt(S.x, S.z), i = Math.round((S.x + half) / step), j = Math.round((S.z + half) / step);
    out.player = { radius: +player.position.length().toFixed(3), groundR: gy == null ? null : +(seaR + gy).toFixed(3), aboveGround: gy == null ? null : +(player.position.length() - seaR - gy).toFixed(3), onGround: !!player.onGround, stage: [+S.x.toFixed(2), +S.z.toFixed(2)], cls: i >= 0 && j >= 0 && i < n && j < n ? c.cls[j * n + i] : null, chainR: typeof chain === 'function' ? chain(player.position.clone()) : null };
    return out;
  }
  let count = 0, holes = 0, agree = 0, higher = 0, lower = 0, nulls = 0, maxChainErr = 0, maxMeshErr = 0;
  const free = []; for (let j = 1; j < n - 2; j++) for (let i = 1; i < n - 2; i++) { const q = j * n + i; if (c.cls[q] === 0 && c.h[q] > 0.3 && plan.h[q] > 0.3) free.push([i, j]); }
  const stride = Math.max(1, Math.floor(free.length / 500));
  for (let k = 0; k < free.length; k += stride) {
    const [i, j] = free[k], x = i * step - half + step * 0.37, z = j * step - half + step * 0.29, y = g.heightAt(x, z); count++;
    if (y == null) { holes++; continue; }
    chart.toWorld(x, y + 25, z, W); U.copy(W).normalize();
    if (typeof chain === 'function') { const r = chain(W.clone()); if (r == null || !Number.isFinite(r)) nulls++; else { const e = r - (seaR + y); if (Math.abs(e) <= 0.05) agree++; else if (e > 0) higher++; else lower++; maxChainErr = Math.max(maxChainErr, Math.abs(e)); } }
    ray.set(W, U.clone().negate()); ray.far = 80; const hit = ray.intersectObject(c.mesh, false)[0]; if (hit) maxMeshErr = Math.max(maxMeshErr, Math.abs(hit.point.length() - (seaR + y)));
  }
  out.samples = { count, holes, chainAgree: agree, chainHigher: higher, chainLower: lower, chainNull: nulls, maxChainErr: +maxChainErr.toFixed(3), maxMeshErr: +maxMeshErr.toFixed(3) };
  let railCells = 0, railDiff = 0, bCells = 0, bDiff = 0;
  for (let q = 0; q < n * n; q++) { if (!Number.isFinite(c.h[q]) || plan.h[q] == null) continue; if (c.cls[q] === 2) { railCells++; railDiff = Math.max(railDiff, Math.abs(plan.h[q] - c.h[q])); } else if (c.cls[q] === 1) { bCells++; bDiff = Math.max(bDiff, Math.abs(plan.h[q] - c.h[q])); } }
  out.recheck = { railCells, railDiff: +railDiff.toFixed(3), structureCells: bCells, structureDiff: +bDiff.toFixed(3) };
  let top = 0; for (let q = 1; q < n * n; q++) if (c.cls[q] === 0 && plan.h[q] > (plan.h[top] ?? -1)) top = q;
  const tx = (top % n) * step - half, tz = ((top / n) | 0) * step - half, len = Math.hypot(tx, tz) || 1, dx = tx / len, dz = tz / len;
  let steps = 0, pHoles = 0, maxJump = 0, prev = null;
  for (let t = -half; t <= half; t += 1.5) { const x = dx * t, z = dz * t, i = Math.round((x + half) / step), j = Math.round((z + half) / step); if (i < 0 || j < 0 || i >= n || j >= n || c.cls[j * n + i] !== 0 || !(c.h[j * n + i] > 0.3)) { prev = null; continue; }
    steps++; const y = g.heightAt(x, z); if (y == null) { pHoles++; prev = null; continue; } if (prev != null) maxJump = Math.max(maxJump, Math.abs(y - prev)); prev = y; }
  out.path = { steps, holes: pHoles, maxJump: +maxJump.toFixed(2), through: [+tx.toFixed(1), +tz.toFixed(1)] };
  out.pass = holes === 0 && pHoles === 0 && out.recheck.railDiff <= 0.011 && out.recheck.structureDiff <= 0.011 && maxMeshErr <= 0.05 && (!out.chainAvailable || (agree > 0 && lower === 0 && nulls === 0));
  return out;
}
export function adoptedMountain(id) { try { return JSON.parse(localStorage.getItem(ADOPT_KEY(id)) || 'null'); } catch { return null; } }
export function mountainState() {
  const c = cur; if (!c) return { active: false, auto: globalThis.__tmMountainAuto || null };
  return { active: true, id: c.id, previewing: !!c.mesh, comparing: !!c.comparing, triangles: c.mesh ? c.mesh.geometry.attributes.position.count / 3 : 0, hidden: c.hidden.length, vegetationMoved: c.moved.length,
    ground: c.ground ? { installed: globalThis.__tmMountainGround === c.ground.fn, active: !!c.mesh && !c.comparing, ...c.ground.stats() } : null,
    palette: c.mesh ? c.palette ?? c.plan?.style?.palette ?? 0 : null, paletteOverride: c.palette != null, autoDeployed: !!c.auto, auto: globalThis.__tmMountainAuto || null };
}
