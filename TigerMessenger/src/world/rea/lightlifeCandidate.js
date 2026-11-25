// 光影与生命 · 实景候选（R66–R70，Guide §10 R61–R70）。任何注册在 __tmSceneTargets 里、有根对象的场景都能用。
// 游戏侧只做四件事：
//   ① probe   把实景采成规则网格（贴球舞台坐标）：每格最高面的高度 / 是不是建筑 / 顶面色 + 植物网格清单 → 交给工坊 Worker（lightlife 能力库）；
//   ② preview 用 Worker 算好的遮蔽 + 彩色反弹网格（plan.light）改顶点色（几何体与材质都是克隆，原件保留），再加一个可撤的生命图层：风线、烟团、小动物；
//             植物图集只登记 globalThis.__tmSharedPlantAtlas（游戏的植物材质还没换成读这张图集）；
//   ③ compare 对照原样（换回原几何与材质、藏生命图层）/ revert 撤掉一切；
//   ④ cameraPose 固定机位（正面 / 侧面 / 俯视 / 斜后，按场景半径算；之前 / 之后同一组机位）。
// 不写存档、不写 localStorage、不改湖上建筑、不设默认；InstancedMesh（植被等）不改色，如实计数。
//   lightlife.probe / preview / compare / revert / state / camera（pipeline-bridge）
import * as THREE from 'three';
import { morrisViewer } from '../morrisViewer.js';
import { ReaBattleStage } from './reaBattleStage.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';
import { shadeFactor, posesFor, frameAt, puffAt, POSE_ORDER } from './lightlife-shade.js?v=light-r66';

const FX = /cloud|beam|water|sea|ocean|foam|wave|particle|smoke|glow|halo|shadow|ring|sky|mist|fog|bird|rea-battle|rea-terrain|mountain-candidate|lightlife-/i;
const VEG = /pine|tree|shrub|leaf|leaves|bush|flower|grass|tuft|canopy|foliage|plant|cypress|trunk|fern|reed|bamboo|moss|hedge/i;
const BUILD = /house|home|roof|wall|build|tower|church|shop|window|door|chimney|castle|bridge|hut|cottage|inn|keep|temple|stall|tavern|mill|barn/i;
const N = 48, MAX_TRIS = 600000, MAX_VERTS = 1200000;
const pathOf = (o) => `${o.name}<${o.parent?.name || ''}<${o.parent?.parent?.name || ''}`;
let cur = null;

function chartFor(dir) {
  const c = Object.create(ReaBattleStage.prototype), up = dir.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
  Object.assign(c, { up, east, north: up.clone().cross(east).normalize(), seaR: 160 + officialOceanLevelAt(up), scale: 1 });
  return c;
}
function classify(o) {
  for (let p = o; p; p = p.parent) if (!p.visible || p.userData.reaBattleStage || p.userData.reaIgnore || p.userData.mountainCandidate || p.userData.lightlifeLife) return null;
  const path = pathOf(o);
  if (FX.test(path)) return null;
  if (VEG.test(path)) return 'veg';
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false || m.transparent && m.opacity < 0.5) return null;
  return BUILD.test(path) ? 'build' : 'terrain';
}
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

function sample(t) {
  const chart = chartFor(t.dir), root = t.root, meshes = { terrain: [], build: [], veg: [] }, flora = {};
  root.updateWorldMatrix(true, true);
  const bc = new THREE.Vector3(), st = new THREE.Vector3(); let ext = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const k = classify(o); if (!k) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    bc.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld); chart.worldToStage(bc, st);
    if (k === 'veg') { const name = (o.name || o.parent?.name || 'plant').replace(/[-_]?\d+$/, ''); flora[name] = (flora[name] || 0) + (o.isInstancedMesh ? o.count : 1); meshes.veg.push(o); return; }
    const r = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (Math.hypot(st.x, st.z) - r > 260) return;
    meshes[k].push(o); if (!o.isInstancedMesh) ext = Math.max(ext, Math.min(260, Math.abs(st.x) + r), Math.min(260, Math.abs(st.z) + r));
  });
  const half = Math.max(24, Math.min(180, ext || 60)), step = (2 * half) / N, NN = N * N, h = new Float32Array(NN).fill(-Infinity), kind = new Uint8Array(NN), col = new Array(NN).fill('#5d9fae');
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), m4 = new THREE.Matrix4(), color = new THREE.Color();
  let tris = 0, clipped = false;
  for (const k of ['terrain', 'build']) for (const o of meshes[k]) {
    const pos = o.geometry.attributes.position, ix = o.geometry.index?.array, cnt = ix ? ix.length : pos.count, vcol = o.geometry.attributes.color;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material, base = mat?.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
    const mats = o.isInstancedMesh ? Array.from({ length: Math.min(o.count, 256) }, (_, i) => { o.getMatrixAt(i, m4); return m4.clone().premultiply(o.matrixWorld); }) : [o.matrixWorld];
    for (const M of mats) for (let i = 0; i < cnt; i += 3) {
      if (++tris > MAX_TRIS) { clipped = true; break; }
      const a = ix ? ix[i] : i, b = ix ? ix[i + 1] : i + 1, c = ix ? ix[i + 2] : i + 2;
      chart.worldToStage(va.fromBufferAttribute(pos, a).applyMatrix4(M), va); chart.worldToStage(vb.fromBufferAttribute(pos, b).applyMatrix4(M), vb); chart.worldToStage(vc.fromBufferAttribute(pos, c).applyMatrix4(M), vc);
      const x0 = Math.min(va.x, vb.x, vc.x), x1 = Math.max(va.x, vb.x, vc.x), z0 = Math.min(va.z, vb.z, vc.z), z1 = Math.max(va.z, vb.z, vc.z);
      if (x1 < -half || x0 > half || z1 < -half || z0 > half) continue;
      const d = (vb.z - vc.z) * (va.x - vc.x) + (vc.x - vb.x) * (va.z - vc.z); if (Math.abs(d) < 1e-9) continue;
      for (let j = Math.max(0, Math.ceil((z0 + half) / step - 0.5)); j <= Math.min(N - 1, Math.floor((z1 + half) / step - 0.5)); j++) for (let ii = Math.max(0, Math.ceil((x0 + half) / step - 0.5)); ii <= Math.min(N - 1, Math.floor((x1 + half) / step - 0.5)); ii++) {
        const x = (ii + 0.5) * step - half, z = (j + 0.5) * step - half, l1 = ((vb.z - vc.z) * (x - vc.x) + (vc.x - vb.x) * (z - vc.z)) / d, l2 = ((vc.z - va.z) * (x - vc.x) + (va.x - vc.x) * (z - vc.z)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * va.y + l2 * vb.y + l3 * vc.y, q = j * N + ii;
        if (y > h[q]) { h[q] = y; kind[q] = k === 'build' ? 2 : 1; color.copy(base); if (vcol) color.multiply(new THREE.Color().fromBufferAttribute(vcol, a)); col[q] = hex(color); }
      }
    }
  }
  const hh = Array.from(h, (v) => (Number.isFinite(v) && v > 0.05 ? Math.round(v * 100) / 100 : 0)), maxH = Math.max(1, ...hh);
  for (let q = 0; q < NN; q++) if (!hh[q]) kind[q] = 0;
  const site = { scene: { id: t.id, label: t.label || t.id }, source: 'probe', n: N, step: Math.round(step * 1000) / 1000, L: Math.round(Math.max(step * 0.6, maxH / 11) * 1000) / 1000, x0: -half, z0: -half, h: hh, kind: Array.from(kind), col, flora, seed: 1 };
  return { chart, half, site, meshes, tris, clipped };
}

export function probeLightLife({ id } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象` };
  if (cur && cur.id !== id) revertLightLife();
  if (!cur) { const t0 = performance.now(), s = sample(t); cur = { id, label: t.label || id, ...s, ms: Math.round(performance.now() - t0), swapped: [], life: null, comparing: false, raf: 0 }; }
  const c = cur, land = c.site.h.filter((v) => v > 0).length, build = c.site.kind.filter((k) => k === 2).length;
  return { ok: true, id, label: c.label, previewing: !!c.swapped.length || !!c.life, site: c.site,
    info: { half: c.half, n: N, land, build, tris: c.tris, clipped: c.clipped, ms: c.ms, meshes: c.meshes.terrain.length + c.meshes.build.length, veg: c.meshes.veg.length, flora: Object.keys(c.site.flora).length } };
}

function applyShade(c, light) {
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), s = new THREE.Vector3(), nm = new THREE.Matrix3(), offset = light.offset ?? 0.3 * light.L;
  let verts = 0, skipped = 0;
  for (const o of [...c.meshes.terrain, ...c.meshes.build]) {
    if (o.isInstancedMesh) { skipped++; continue; }
    const g0 = o.geometry, m0 = o.material, cnt = g0.attributes.position.count;
    if (verts + cnt > MAX_VERTS) { skipped++; continue; }
    const g = g0.clone(); if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nrm = g.attributes.normal, base = g.attributes.color, out = new Float32Array(cnt * 3);
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); nn.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      chart(c).worldToStage(v.addScaledVector(nn, offset), s);
      const f = shadeFactor(light, s.x, s.y, s.z);
      for (let k = 0; k < 3; k++) out[i * 3 + k] = (base ? base.getComponent(i, k) : 1) * f[k];
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(out, 3));
    const cl = (m) => { const x = m.clone(); x.vertexColors = true; x.needsUpdate = true; return x; }, m = Array.isArray(m0) ? m0.map(cl) : cl(m0);
    o.geometry = g; o.material = m; c.swapped.push({ o, g0, m0, g, m }); verts += cnt;
  }
  return { meshes: c.swapped.length, vertices: verts, skipped };
}
const chart = (c) => c.chart;
const toW = (c, x, y, z, out = new THREE.Vector3()) => c.chart.toWorld(x, y, z, out);

function buildLife(c, plan, scene) {
  const group = new THREE.Group(); group.name = 'lightlife-life-' + c.id; group.userData.lightlifeLife = true; const parts = {};
  if (plan.wind?.lines?.length) {
    const pts = []; for (const line of plan.wind.lines) for (let k = 0; k + 1 < line.length; k++) { pts.push(toW(c, ...line[k]), toW(c, ...line[k + 1])); }
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fc7e8, transparent: true, opacity: 0.55, depthWrite: false }));
    lines.name = 'lightlife-wind'; group.add(lines); parts.wind = plan.wind.lines.length;
  }
  if (plan.smoke?.puffs?.length) {
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xdedad2, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 }), plan.smoke.puffs.length);
    mesh.name = 'lightlife-smoke'; mesh.frustumCulled = false; group.add(mesh); parts.smoke = plan.smoke.puffs.length; c.smokeMesh = mesh;
  }
  if (plan.animals?.frames?.length && plan.animals.agents) {
    const s = c.site.step * 0.3, mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(s, s * 0.6, s * 1.3), new THREE.MeshStandardMaterial({ color: 0xc0583c, roughness: 0.8 }), plan.animals.agents);
    mesh.name = 'lightlife-animals'; mesh.frustumCulled = false; group.add(mesh); parts.animals = plan.animals.agents; c.animalMesh = mesh;
  }
  scene.add(group);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), P = new THREE.Vector3(), up = c.chart.up;
  const t0 = performance.now();
  const tick = () => {
    if (!cur || cur.life !== group) return;
    const t = (performance.now() - t0) / 1000;
    if (c.smokeMesh) { plan.smoke.puffs.forEach((p, i) => { const a = puffAt(p, plan.smoke.sources[p.src], t); toW(c, a.x, a.y, a.z, P); sc.setScalar(a.r); m4.compose(P, q, sc); c.smokeMesh.setMatrixAt(i, m4); }); c.smokeMesh.instanceMatrix.needsUpdate = true; }
    if (c.animalMesh) { const f = frameAt(plan.animals.frames, t); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); f.forEach((p, i) => { toW(c, p[0], p[1] + c.site.step * 0.1, p[2], P); sc.setScalar(1); m4.compose(P, q, sc); c.animalMesh.setMatrixAt(i, m4); }); c.animalMesh.instanceMatrix.needsUpdate = true; }
    c.raf = requestAnimationFrame(tick);
  };
  c.life = group; tick();
  return parts;
}

export function previewLightLife({ scene, id, plan } = {}) {
  if (!plan || typeof plan !== 'object' || plan.persist !== false) return { ok: false, reason: '候选无效（必须是 persist:false 的光影计划）' };
  const r = probeLightLife({ id }); if (!r.ok) return r;
  revertLightLife({ keep: true });
  const c = cur, out = { ok: true, id, shade: null, life: null };
  if (plan.light?.occ?.length) { if (plan.light.n !== c.site.n) return { ok: false, reason: '候选网格与当前采样不一致，请重新扫描' }; out.shade = applyShade(c, plan.light); }
  out.life = buildLife(c, plan, scene || globalThis.__tm?.scene);
  if (plan.plants) { const A = globalThis.__tmSharedPlantAtlas ||= { hash: plan.plants.atlasHash, size: plan.plants.size, scenes: {} }; A.scenes[id] = plan.plants.used; out.plants = { hash: A.hash, used: plan.plants.used.length }; }
  c.comparing = false; c.plan = plan;
  return out;
}
export function compareLightLife(on) {
  const c = cur; if (!c || (!c.swapped.length && !c.life)) return { ok: false, reason: '没有正在预览的光影候选' };
  for (const s of c.swapped) { s.o.geometry = on ? s.g0 : s.g; s.o.material = on ? s.m0 : s.m; }
  if (c.life) c.life.visible = !on; c.comparing = !!on;
  return { ok: true, showing: on ? 'original' : 'candidate' };
}
export function revertLightLife({ keep = false } = {}) {
  const c = cur; if (!c) return { ok: true, reverted: false };
  for (const s of c.swapped) { s.o.geometry = s.g0; s.o.material = s.m0; s.g.dispose(); for (const m of [].concat(s.m)) m.dispose(); }
  c.swapped = [];
  if (c.raf) cancelAnimationFrame(c.raf); c.raf = 0;
  if (c.life) { c.life.parent?.remove(c.life); c.life.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); c.life = null; c.smokeMesh = c.animalMesh = null; }
  const A = globalThis.__tmSharedPlantAtlas; if (A?.scenes) { delete A.scenes[c.id]; if (!Object.keys(A.scenes).length) delete globalThis.__tmSharedPlantAtlas; }
  c.plan = null; c.comparing = false;
  if (!keep) cur = null;
  return { ok: true, reverted: true };
}
export function lightLifeState() {
  const c = cur; if (!c) return { ok: true, id: null, previewing: false };
  return { ok: true, id: c.id, previewing: !!c.swapped.length || !!c.life, comparing: c.comparing, meshes: c.swapped.length, life: c.life ? c.life.children.map((x) => x.name) : [], plants: globalThis.__tmSharedPlantAtlas?.hash || null, half: c.half };
}

/** 固定机位（之前 / 之后同一组）；pose = 'free' 还原进入固定机位之前的镜头控制。 */
let fixedPrev = null;
export function cameraPose({ pose = 'front', id = globalThis.__tmCurrentScene } = {}) {
  const camera = morrisViewer.camera || globalThis.__tm?.camera;
  if (pose === 'free') { const p = fixedPrev; if (!p) return { ok: true, pose, restored: false }; morrisViewer.planetCamera = p.planetCamera; morrisViewer.applyTownCamera = p.apply; morrisViewer.orbitInput = p.orbit; if (camera && p.fov) { camera.fov = p.fov; camera.near = p.near; camera.updateProjectionMatrix(); } fixedPrev = null; return { ok: true, pose, restored: true }; }
  if (!cur) { const r = probeLightLife({ id }); if (!r.ok) return r; }
  if (!camera) return { ok: false, reason: '游戏镜头未就绪' };
  const v = posesFor(cur.half)[pose]; if (!v) return { ok: false, reason: '没有这个机位：' + pose + '（可选 ' + POSE_ORDER.join(' / ') + '）' };
  const P = toW(cur, ...v.pos), A = toW(cur, ...v.at);
  const up = pose === 'top' ? toW(cur, 0, 0, -10).sub(toW(cur, 0, 0, 0)).normalize() : P.clone().normalize();
  const apply = () => { camera.position.copy(P); camera.up.copy(up); camera.lookAt(A); camera.fov = 40; camera.near = Math.min(camera.near, 0.5); camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  fixedPrev ||= { planetCamera: morrisViewer.planetCamera, apply: morrisViewer.applyTownCamera, orbit: morrisViewer.orbitInput, fov: camera.fov, near: camera.near };
  apply(); morrisViewer.orbitInput = null; morrisViewer.planetCamera = { scene: cur.id, fixedView: 'lightlife-' + pose }; morrisViewer.applyTownCamera = apply;
  return { ok: true, pose, label: v.label, stage: { pos: v.pos, at: v.at }, half: cur.half };
}
