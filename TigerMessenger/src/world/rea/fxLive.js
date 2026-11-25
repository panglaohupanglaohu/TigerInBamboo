// 表现层 R37–R40 的实景预览（真实游戏场景里）：
//   火      life/effects.js 的 Effects 火粒子（Max 混合、往上收的火苗、跟着火苗量走的火光），每个点火处一套，按计划的 t0 依次点着
//   走廊    build/doodle-hallway.js makeHallway：在一座小屋旁放一段缩小的走廊样板（展开面贴图 + cove + 拱门 + 楼梯）
//   沉积    崖面上贴层带面片（岩性颜色 = sediment-bands-c09 BAND_COLORS × 岩石底色，交界细深线）
//   弹道    弹道折线 + 沿线循环飞的箭点
//   镜头    fx.camera 的路径真实驱动镜头飞一圈（每帧经 morrisViewer.applyTownCamera 覆盖镜头），停止 / 回退时还原进入前的镜头
// 四个函数按 Guide §7.2 第 4 条：previewSceneFxLive / compareSceneFxLive / revertSceneFxLive / commitSceneFxLive（只存本机草稿，不改存档、不设默认）。
// 依赖 battle.probe 建好的 __tmBattleStage（stage.toWorld 把贴球舞台坐标映到星球世界坐标）。
import * as THREE from 'three';
import { morrisViewer } from '../morrisViewer.js';
import { poseAt, sweepDeg, flightPlan } from '../../system-workshop/fx/camera-flight.js?v=fxe-r1';

const LIB = '../../../../townscaper-web/REACodeRefactoring/src/';
const EFFECTS = new URL(LIB + 'life/effects.js', import.meta.url).href;
const HALLWAY = new URL(LIB + 'build/doodle-hallway.js', import.meta.url).href;
const KEY = (id) => `tm.fx.live.v1:${id}`;
const PLAN_KEY = (id) => `tm.fx.plan.v1:${id}`;
const UP = new THREE.Vector3(0, 1, 0);
const ROCK = [0.62, 0.55, 0.46];
let live = null;     // 当前实景预览
let flight = null;   // 当前镜头飞行
let focusMode = null;
let saved = null;    // 进入飞行 / 特写机位前的镜头（只存一份，还原后清空）

const stageOf = () => globalThis.__tmBattleStage || null;
const cam = () => morrisViewer.camera || globalThis.__tm?.camera || null;
const topAt = (stage, x, z) => { const c = stage.index?.cellAt?.(x, z); const t = c ? stage.world.top(c) : 0; return (t || 0) * stage.L; };
const storedPlan = (id) => { try { return JSON.parse(localStorage.getItem(PLAN_KEY(id)) || 'null')?.plan ?? null; } catch { return null; } };
function holderAt(stage, x, y, z, scale) {
  const P = stage.toWorld(x, y, z, new THREE.Vector3()), g = new THREE.Group();
  g.position.copy(P); g.quaternion.setFromUnitVectors(UP, P.clone().normalize()); g.scale.setScalar(scale); return g;
}
const lineMat = (color, opacity = 0.9) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });

function disposeLive() {
  const L = live; if (!L) return false;
  live = null; cancelAnimationFrame(L.raf);
  for (const f of L.fires) { try { f.fx.dispose(); } catch { /* 已拆 */ } }
  try { L.hallway?.made.dispose(); } catch { /* 已拆 */ }
  L.root.traverse((o) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) m?.dispose?.(); });
  L.root.parent?.remove(L.root);
  return true;
}

// ── 火 ──
async function addFire(stage, L, f) {
  const { Effects } = await import(EFFECTS);
  for (const s of f.sources) {
    const y = Math.max(topAt(stage, s.x, s.z), s.y || 0) + 0.05;
    const holder = holderAt(stage, s.x, y, s.z, stage.scale); holder.name = 'tm-fx-fire'; L.root.add(holder);
    const fx = new Effects({ scene: holder, uTime: { value: 0 }, popUniforms: {} });
    fx.setFireAppearance({ blend: f.blend === 'add' ? 'add' : 'max', shrink: Math.min(6, Math.max(1, f.shrink || 2)) });
    fx.setFireSources([{ x: 0, y: 0, z: 0 }]); fx.showFire = false;
    if (fx.fireLight) fx.fireLight.distance = 3.5 * stage.scale;
    // 落点标记：橙圈（不受深度遮挡）——火苗被山挡住时也看得出哪几处着了
    const ring = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45)); }
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), lineMat(0xff7a2f, 0.95)); loop.renderOrder = 31; holder.add(loop);
    L.fires.push({ fx, holder, t0: s.t0 || 0, lit: false, k: stage.scale });
  }
  L.drawn.push(`火 ${f.sources.length} 处（life/effects.js 火粒子）`);
}
const aliveOf = (fx) => { let n = 0; for (let i = 0; i < fx.flife.length; i++) if (fx.flife[i] > 0) n++; return n; };

// ── 走廊样板 ──
async function addHallway(stage, L, h) {
  const { makeHallway } = await import(HALLWAY);
  const made = makeHallway({ seed: h.options?.seed ?? 7, density: h.options?.density ?? 1, mirror: h.options?.mirror !== false, doc: document, ppu: 96 });
  const y = Math.max(topAt(stage, h.host.x, h.host.z), h.host.y || 0) + 0.02, k = stage.scale * (h.fit || 2) / (made.plan.wallA || 4.2);
  const holder = holderAt(stage, h.host.x, y, h.host.z, k); holder.name = 'tm-fx-hallway';
  made.group.position.set(-made.plan.wallA / 2, 0, -0.3); holder.add(made.group); L.root.add(holder);
  L.hallway = { made, holder };
  L.drawn.push(`走廊样板 ${h.panels?.length ?? made.plan.panels.length} 块板（build/doodle-hallway.js）`);
}

// ── 崖面层带 ──
function addSediment(stage, L, s) {
  const pos = [], col = [], lines = [], P = new THREE.Vector3(), colors = s.colors || [[1, 1, 1]], off = 0.08, half = s.half || 0.5;
  const push = (x, y, z, c) => { stage.toWorld(x, y, z, P); pos.push(P.x, P.y, P.z); col.push(c[0], c[1], c[2]); };
  for (const f of s.faces) {
    const ex = -f.dz, ez = f.dx, cx = f.x + f.dx * off, cz = f.z + f.dz * off, ax = cx - ex * half, az = cz - ez * half, bx = cx + ex * half, bz = cz + ez * half;
    for (const b of f.bands) {
      const t = colors[b[0]] || [1, 1, 1], c = [Math.min(1, ROCK[0] * t[0]), Math.min(1, ROCK[1] * t[1]), Math.min(1, ROCK[2] * t[2])];
      push(ax, b[1], az, c); push(bx, b[1], bz, c); push(bx, b[2], bz, c);
      push(ax, b[1], az, c); push(bx, b[2], bz, c); push(ax, b[2], az, c);
      if (b[3]) { stage.toWorld(ax, b[1], az, P); lines.push(P.x, P.y, P.z); stage.toWorld(bx, b[1], bz, P); lines.push(P.x, P.y, P.z); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.name = 'tm-fx-sediment'; mesh.renderOrder = 31; L.root.add(mesh);
  if (lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3b2f25, transparent: true, opacity: 0.9 })); ls.renderOrder = 32; L.root.add(ls); }
  L.sediment = { faces: s.faces.length, triangles: pos.length / 9, lines: lines.length / 6 };
  L.drawn.push(`崖面层带 ${s.faces.length} 面`);
}

// ── 弹道 ──
function addProjectiles(stage, L, p) {
  const paths = [];
  for (const s of p.shots) {
    const pts = s.path.map((q) => stage.toWorld(q[0], q[1], q[2], new THREE.Vector3()));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0xf2c14e, 0.9)); line.renderOrder = 31; L.root.add(line);
    paths.push({ pts, time: Math.max(0.2, s.time || 1) });
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(paths.length * 3), 3));
  const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1c1, size: 7, sizeAttenuation: false, depthTest: false, transparent: true }));
  dots.renderOrder = 32; dots.frustumCulled = false; L.root.add(dots);
  L.arrows = { paths, dots, moved: 0 };
  L.drawn.push(`弹道 ${paths.length} 条`);
}
function moveArrows(L) {
  const a = L.arrows, arr = a.dots.geometry.attributes.position;
  a.paths.forEach((p, i) => {
    const cyc = p.time + 0.4, u = Math.min(1, (((L.t + i * 0.29) % cyc) / p.time)), f = u * (p.pts.length - 1), j = Math.min(p.pts.length - 2, Math.floor(f)), k = f - j;
    const A = p.pts[j], B = p.pts[j + 1]; arr.setXYZ(i, A.x + (B.x - A.x) * k, A.y + (B.y - A.y) * k, A.z + (B.z - A.z) * k);
  });
  arr.needsUpdate = true; a.moved++;
}

// ── 尾迹：真实泡沫粒子。plan.wake.points 的 l/r 端点当发射点，沿舷侧方向以 spread×shipV 外推，
// 3.6s 寿命循环重生（与 wake-sampling 的 spread 语义一致：泡沫每帧向外漂，不留在原地）。
const whash = (x) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
function addWake(stage, L, w) {
  const pts = (w.points || []).slice(0, 220); if (pts.length < 4) return;
  const [t0, t1] = w.track || [[0, 0], [1, 0]];
  const dx = t1[0] - t0[0], dz = t1[1] - t0[1], dl = Math.hypot(dx, dz) || 1;
  const px = -dz / dl, pz = dx / dl;
  const o = stage.toWorld(0, 0, 0, new THREE.Vector3());
  const dirW = (x, z) => stage.toWorld(x, 0, z, new THREE.Vector3()).sub(o);
  const speed = Math.max(.02, (w.spread || .18) * (w.shipV || 1));
  const K = 4, n = pts.length * K * 2;
  const base = new Float32Array(n * 3), dirv = new Float32Array(n * 3), seed = new Float32Array(n);
  let i = 0;
  const emit = (p, side) => {
    const a = stage.toWorld(p[0], topAt(stage, p[0], p[1]) + .18, p[1]);
    for (let k = 0; k < K; k++) {
      const j = i++, j3 = j * 3, jit = (whash(j * 7.13) - .5) * .35;
      base.set([a.x, a.y, a.z], j3);
      const d = dirW(px * side + jit * dx / dl, pz * side + jit * dz / dl).multiplyScalar(speed);
      dirv.set([d.x, .04, d.z], j3);
      seed[j] = whash(j * 3.71) * 3.6;
    }
  };
  for (const q of pts) { emit(q.l, -1); emit(q.r, 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 5, sizeAttenuation: false, transparent: true, opacity: .8, depthTest: false }));
  dots.name = 'tm-fx-wake'; dots.renderOrder = 32; dots.frustumCulled = false; L.root.add(dots);
  L.wake = { base, dirv, seed, dots, life: 3.6, count: n };
  L.drawn.push(`尾迹泡沫 ${n} 粒（live）`);
}
function tickWake(L) {
  const w = L.wake, arr = w.dots.geometry.attributes.position;
  for (let j = 0; j < w.count; j++) {
    const age = (L.t + w.seed[j]) % w.life, j3 = j * 3;
    arr.setXYZ(j, w.base[j3] + w.dirv[j3] * age, w.base[j3 + 1] + w.dirv[j3 + 1] * age, w.base[j3 + 2] + w.dirv[j3 + 2] * age);
  }
  arr.needsUpdate = true;
}

function tick(now) {
  const L = live; if (!L) return;
  const dt = Math.min(0.05, Math.max(0, (now - L.last) / 1000)); L.last = now; L.t += dt;
  for (const f of L.fires) {
    if (!f.lit && L.t >= f.t0) { f.fx.showFire = true; f.lit = true; }
    f.fx.uTime.value += dt;
    try { f.fx.update(dt); } catch (e) { L.errors.fire = e.message; }
    // 尺寸补偿：effects.js 的火粒子按「世界单位 0.13」定尺寸（gl_PointSize 不吃父节点缩放），舞台放大了 scale 倍，粒子也要跟着放大；
    // update() 每帧都从头算 fsize，所以这里乘一次不会累积。火光强度在 update 里已按未补偿的尺寸算好。
    if (f.lit) { const s = f.fx.fsize; for (let i = 0; i < s.length; i++) s[i] *= f.k; f.fx.fire.geometry.attributes.aSize.needsUpdate = true; L.peakLight = Math.max(L.peakLight, f.fx.fireLight?.intensity || 0); }
  }
  if (L.arrows) moveArrows(L);
  if (L.wake) tickWake(L);
  L.frames++;
  L.raf = requestAnimationFrame(tick);
}

export async function previewSceneFxLive({ scene, id = 'apostles', plan = null } = {}) {
  const stage = stageOf(); if (!stage) return { ok: false, reason: '没有舞台——先跑 battle.probe' };
  if (!plan) plan = storedPlan(id);
  if (!plan || typeof plan !== 'object') return { ok: false, reason: `没有 fx 计划（${PLAN_KEY(id)}），先在工坊执行` };
  disposeLive();
  const root = new THREE.Group(); root.name = 'tm-fx-live'; root.renderOrder = 31;
  (scene || stage.anchor?.parent)?.add(root);
  const L = live = { root, id, plan, fires: [], hallway: null, sediment: null, arrows: null, wake: null, errors: {}, drawn: [], t: 0, last: performance.now(), raf: 0, peakLight: 0, frames: 0 };
  if (plan.fire?.sources?.length) { try { await addFire(stage, L, plan.fire); } catch (e) { L.errors.fire = e.message; } }
  if (live !== L) return { ok: false, reason: '预览被新的预览替换' };
  if (plan.hallway?.host) { try { await addHallway(stage, L, plan.hallway); } catch (e) { L.errors.hallway = e.message; } }
  if (live !== L) return { ok: false, reason: '预览被新的预览替换' };
  if (plan.sediment?.faces?.length) { try { addSediment(stage, L, plan.sediment); } catch (e) { L.errors.sediment = e.message; } }
  if (plan.projectiles?.shots?.length) { try { addProjectiles(stage, L, plan.projectiles); } catch (e) { L.errors.projectiles = e.message; } }
  if (plan.wake?.points?.length) { try { addWake(stage, L, plan.wake); } catch (e) { L.errors.wake = e.message; } }
  const errs = Object.entries(L.errors).map(([k, v]) => `${k}：${v}`).join('；');
  if (!L.drawn.length) { disposeLive(); return { ok: false, reason: '计划里没有可放进实景的层（火 / 走廊 / 沉积 / 弹道 / 尾迹）' + (errs ? '；' + errs : '') }; }
  L.raf = requestAnimationFrame(tick);
  return { ok: true, id, drawn: L.drawn.join(' · '), errors: L.errors };
}
export function compareSceneFxLive(on) { if (!live) return { ok: false, reason: '没有实景预览' }; live.root.visible = !on; return { ok: true, hidden: !!on }; }
export function revertSceneFxLive() { const removed = disposeLive(); const camera = stopCameraFlight(); return { ok: true, removed, camera }; }
/** 采用 = 存本机草稿 tm.fx.live.v1:<场景>（四条线的计划 + 摘要）。不改存档、不设默认、不动湖上建筑。 */
export function commitSceneFxLive({ id = 'apostles', plan = null } = {}) {
  const p = plan || live?.plan || storedPlan(id); if (!p) return { ok: false, reason: '没有可存的计划' };
  const rec = { at: Date.now(), id, plan: { fire: p.fire || null, hallway: p.hallway || null, sediment: p.sediment || null, projectiles: p.projectiles || null, wake: p.wake || null, camera: p.camera ? { centre: p.camera.centre, radius: p.camera.radius, seconds: p.camera.seconds, path: p.camera.path } : null },
    summary: { fire: p.fire?.sources?.length || 0, hallway: p.hallway?.panels?.length || 0, sediment: p.sediment?.stats?.faces || 0, projectiles: p.projectiles?.stats?.shots || 0, wake: p.wake?.points?.length || 0 } };
  try { localStorage.setItem(KEY(id), JSON.stringify(rec)); } catch (e) { return { ok: false, reason: '本机存储失败：' + e.message }; }
  return { ok: true, key: KEY(id), summary: rec.summary, note: `实景能力草稿已存本机 ${KEY(id)}（不改存档、不设默认）` };
}
export function fxLiveState() {
  const L = live, fires = L ? L.fires.map((f) => ({ lit: f.lit, alive: aliveOf(f.fx), light: +(f.fx.fireLight?.intensity || 0).toFixed(3), visible: !!f.fx.fire?.visible })) : [];
  let hallMeshes = 0; L?.hallway?.holder.traverse((o) => { if (o.isMesh) hallMeshes++; });
  return { active: !!L, visible: !!L?.root.visible, t: L ? +L.t.toFixed(2) : 0, frames: L?.frames || 0, drawn: L?.drawn || [], errors: L?.errors || {},
    fire: { sources: fires.length, lit: fires.filter((x) => x.lit).length, alive: fires.reduce((s, x) => s + x.alive, 0), peakLight: +(L?.peakLight || 0).toFixed(3), rows: fires },
    hallway: { placed: !!L?.hallway, meshes: hallMeshes, panels: L?.hallway?.made.plan.panels.length || 0 },
    sediment: L?.sediment || { faces: 0, triangles: 0, lines: 0 },
    projectiles: { arcs: L?.arrows?.paths.length || 0, moved: L?.arrows?.moved || 0 },
    wake: { particles: L?.wake?.count || 0 },
    camera: cameraFlightState() };
}

// ── 镜头：保存 / 还原 ──
function saveCamera(camera) {
  if (!saved) saved = { planetCamera: morrisViewer.planetCamera, apply: morrisViewer.applyTownCamera, orbit: morrisViewer.orbitInput, pos: camera.position.clone(), quat: camera.quaternion.clone(), up: camera.up.clone(), fov: camera.fov, near: camera.near, far: camera.far };
  return saved;
}
export function stopCameraFlight() {
  const camera = cam(), F = flight; flight = null; const mode = focusMode; focusMode = null;
  if (!saved) return { ok: true, restored: false };
  const s = saved; saved = null;
  morrisViewer.planetCamera = s.planetCamera; morrisViewer.applyTownCamera = s.apply; morrisViewer.orbitInput = s.orbit;
  if (camera) { camera.position.copy(s.pos); camera.quaternion.copy(s.quat); camera.up.copy(s.up); camera.fov = s.fov; camera.near = s.near; camera.far = s.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
  return { ok: true, restored: true, mode, delta: camera ? +camera.position.distanceTo(s.pos).toFixed(6) : null, savedPos: s.pos.toArray().map((v) => +v.toFixed(3)),
    flown: F ? { u: +F.u.toFixed(3), frames: F.frames, sweep: sweepDeg(F.samples, F.centre).signed } : null };
}
export function cameraFlightState() {
  const F = flight;
  return { saved: !!saved, mode: F ? 'flight' : focusMode, flying: !!F && !F.done, done: !!F?.done, u: F ? +F.u.toFixed(3) : 0, seconds: F?.seconds || 0, frames: F?.frames || 0,
    sweep: F ? sweepDeg(F.samples, F.centre).signed : 0, expected: F?.fp.expectedSweep.signed ?? null, samples: F?.samples.length || 0 };
}
/** fx.camera 路径驱动真实镜头飞一圈。plan 省略时用当前实景预览的计划，再没有就读 tm.fx.plan.v1:<场景>。 */
export function startCameraFlight({ id = 'apostles', plan = null, seconds = null, autoRestore = false } = {}) {
  const stage = stageOf(); if (!stage) return { ok: false, reason: '没有舞台——先跑 battle.probe' };
  const camera = cam(); if (!camera) return { ok: false, reason: '游戏镜头未就绪' };
  plan = plan || live?.plan || storedPlan(id);
  let fp; try { fp = flightPlan(plan?.camera, { seconds }); } catch (e) { return { ok: false, reason: e.message }; }
  saveCamera(camera); focusMode = null;
  const path = plan.camera.path, [cx, cz] = fp.centre, lookY = (stage.report?.maxLevel || 4) * stage.L * 0.5;
  const A = stage.toWorld(cx, lookY, cz, new THREE.Vector3()), P = new THREE.Vector3(), S = new THREE.Vector3();
  const F = flight = { t0: performance.now(), seconds: fp.seconds, fp, samples: [], done: false, u: 0, frames: 0, centre: [cx, cz], autoRestore };
  const apply = () => {
    if (flight !== F) return;
    const u = Math.min(1, (performance.now() - F.t0) / 1000 / F.seconds); F.u = u;
    const q = poseAt(path, u); stage.toWorld(q.x, q.y, q.z, P);
    camera.position.copy(P); camera.up.copy(P).normalize(); camera.lookAt(A); camera.fov = 45; camera.near = Math.min(camera.near, 0.5); camera.far = Math.max(camera.far, 4000);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    F.frames++;
    // 记录的是镜头真实位置换回舞台坐标（不是路径本身），证明镜头确实跟着路径走
    if (F.samples.length < 4000) { stage.worldToStage(camera.position, S); F.samples.push([+S.x.toFixed(3), +S.z.toFixed(3)]); }
    if (u >= 1 && !F.done) { F.done = true; if (F.autoRestore) setTimeout(() => { if (flight === F) stopCameraFlight(); }, 0); }
  };
  morrisViewer.orbitInput = null; morrisViewer.planetCamera = { scene: id, fixedView: 'fx.camera' }; morrisViewer.applyTownCamera = apply; apply();
  return { ok: true, seconds: fp.seconds, laps: fp.laps, points: fp.points, expectedSweep: fp.expectedSweep.signed, centre: fp.centre };
}
/** 特写机位（端到端截图用）：对准某一层的第一个对象；stopCameraFlight / 回退还原。 */
export function focusSceneFxLive({ layer = 'fire', distance = 9 } = {}) {
  const stage = stageOf(), camera = cam(), L = live; if (!stage || !camera || !L) return { ok: false, reason: '没有实景预览或镜头' };
  let T = null;
  if (layer === 'fire' && L.fires[0]) T = L.fires[0].holder.position.clone();
  else if (layer === 'hallway' && L.hallway) T = L.hallway.holder.position.clone();
  else if (layer === 'sediment' && L.plan.sediment?.faces?.[0]) { const f = L.plan.sediment.faces[0]; T = stage.toWorld(f.x, (f.y0 + f.y1) / 2, f.z, new THREE.Vector3()); }
  else if (layer === 'projectiles' && L.arrows?.paths[0]) { const p = L.arrows.paths[0].pts; T = p[p.length >> 1].clone(); }
  if (!T) return { ok: false, reason: '这一层没有对象：' + layer };
  flight = null; saveCamera(camera); focusMode = 'focus:' + layer;
  const up = T.clone().normalize(), side = new THREE.Vector3(0, 1, 0).cross(up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
  const d = distance * stage.scale, P = T.clone().addScaledVector(up, d * 0.55).addScaledVector(side, d);
  const apply = () => { camera.position.copy(P); camera.up.copy(up); camera.lookAt(T); camera.fov = 40; camera.near = Math.min(camera.near, 0.5); camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  morrisViewer.orbitInput = null; morrisViewer.planetCamera = { scene: L.id, fixedView: focusMode }; morrisViewer.applyTownCamera = apply; apply();
  return { ok: true, layer, target: T.toArray().map((v) => +v.toFixed(2)) };
}
