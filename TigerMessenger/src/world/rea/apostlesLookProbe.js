/**
 * apostlesLookProbe.js — 十二门徒地形候选的实景采样与检查（游戏页面里运行，只读；唯一会动的是编辑镜头）。
 *   R29 sampleApostleState / setApostleView：等网格稳定出现（stable-wait.js）后读状态；四个机位（全景 / 侧面 / 俯视 / 崖脚特写），每个机位做遮挡检查
 *   R29 + R30 checkApostlesSurface：岩体材质不透明、水线以上破面、植被贴地、岸线白沫跟随（apostles-surface-checks.js）
 *   R31 probeApostlesLook：给「十二门徒地形」管线的扫描输入（每块岩体的格子中心、层高、陆地相邻边、顶面 / 崖壁平均色）
 * 不改岩体 World、不写存档、不写 localStorage。镜头改动只换编辑镜头（与右键拖动 / 滚轮一样），回到玩家视角即恢复。
 * 管线桥接命令：apostles.look.state / apostles.look.probe / apostles.look.checks / apostles.look.view（scene-authoring/pipeline-bridge.js）。
 */
import * as THREE from 'three';
import { morrisViewer } from '../morrisViewer.js';
import { APOSTLES_LOOK } from '../apostlesLook.js';
import { createViewportOrbit } from '../../scene-authoring/viewport-orbit.js';
import { sampleApostleScene } from './stable-wait.js?v=apt-r1';
import { meshIntegrity, materialAudit, buildSurfaceIndex, plantDeltas, classifyPlants, nearestDistances, classifyFoam, surfaceChecks, worst } from './apostles-surface-checks.js?v=apt-r1';

/** 与 twelveApostlesTarget.js 的 APOSTLE_MASSES 同序（apostlesReacode.js 里 seed = 7300 + 序号 × 101）；tests/apostles-terrain-pipeline.test.mjs 核对这个顺序。 */
export const APOSTLE_MASS_ORDER = ['back-left', 'back-right', 'back-tower', 'front-left', 'front-right', 'bay-1', 'bay-2', 'bay-3', 'bay-4'];
export const VIEWS = ['overview', 'side', 'top', 'cliff-foot'];
export const VIEW_NAMES = { overview: '全景', side: '侧面', top: '俯视', 'cliff-foot': '崖脚特写' };

const sceneOf = () => morrisViewer.scene || globalThis.__tm?.scene || null;
export function apostleRocks(scene = sceneOf()) { const out = []; scene?.traverse?.((o) => { if (o.isMesh && o.userData?.apostleMass) out.push(o); }); return out; }
const lookInfo = () => ({ id: APOSTLES_LOOK.id, soft: APOSTLES_LOOK.soft, palette: APOSTLES_LOOK.palette, latest: APOSTLES_LOOK.latest });

/** 一次采样（给 stable-wait 用）：场景 uuid + 岩体网格数 + 当前候选。 */
export function sampleApostleState() {
  const s = sampleApostleScene(sceneOf(), APOSTLES_LOOK.id);
  return s ? { ...s, orbit: !!morrisViewer.orbitInput, planetCamera: morrisViewer.planetCamera?.scene ?? null } : null;
}

// 岩体的局部几何：rock.userData.reacode = { world, grid, scale S }；seaStack.seaAnchor = 海面锚点（长度 = 海面半径 Rw）
function massInfo(rock) {
  const r = rock.userData.reacode || {}, S = r.scale || rock.getWorldScale(new THREE.Vector3()).y || 1;
  const anchor = rock.userData.seaStack?.seaAnchor, Rw = anchor ? Math.hypot(...anchor) : 160;
  return { id: String(rock.userData.apostleMass), S, Rw, bend: S / (2 * Rw), world: r.world || null, grid: r.grid || null, up: new THREE.Vector3(...(rock.userData.seaStack?.worldUp || [0, 1, 0])).normalize() };
}

const _c = new THREE.Color();
function meanColors(geo, stride = 7) {
  const col = geo.attributes.color, nor = geo.attributes.normal; if (!col || !nor) return null;
  const acc = { top: [0, 0, 0, 0], wall: [0, 0, 0, 0] };
  for (let i = 0; i < col.count; i += stride) { const ny = nor.getY(i), k = ny > 0.8 ? 'top' : Math.abs(ny) < 0.35 ? 'wall' : null; if (!k) continue; acc[k][0] += col.getX(i); acc[k][1] += col.getY(i); acc[k][2] += col.getZ(i); acc[k][3]++; }
  const hex = (a) => a[3] ? '#' + _c.setRGB(a[0] / a[3], a[1] / a[3], a[2] / a[3], THREE.LinearSRGBColorSpace).getHexString() : null;
  return { top: hex(acc.top), wall: hex(acc.wall) };
}

/** R31 扫描输入。网格还没出现时 ok:false（调用方用 stable-wait 先等稳定）。 */
export function probeApostlesLook() {
  const rocks = apostleRocks();
  if (!rocks.length) return { ok: false, reason: '十二门徒岩体网格还没出现（场景可能正在重建），稍后再扫描' };
  const masses = [];
  for (const rock of rocks) {
    const m = massInfo(rock), order = APOSTLE_MASS_ORDER.indexOf(m.id);
    if (!m.world || !m.grid) { masses.push({ id: m.id, order, missing: '岩体没有 World 数据' }); continue; }
    const cells = m.grid.cells, xz = new Array(cells.length * 2), lv = new Array(cells.length), edges = [];
    for (const c of cells) { xz[2 * c.id] = +c.cx.toFixed(4); xz[2 * c.id + 1] = +c.cz.toFixed(4); lv[c.id] = m.world.top(c) | 0; }
    for (const c of cells) if (lv[c.id] > 0) for (const o of c.edgeNeighbors || []) if (o > c.id && lv[o] > 0) edges.push(c.id, o);
    masses.push({ id: m.id, order, seed: 7300 + Math.max(0, order) * 101, spire: m.S < 1.5, scale: +m.S.toFixed(4), xz, lv, edges, colors: meanColors(rock.geometry) });
  }
  masses.sort((a, b) => a.order - b.order);
  return { ok: true, scene: 'apostles', look: lookInfo(), masses, sampledAt: Date.now() };
}

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
function evenly(n, k) { const out = []; if (n <= 0) return out; const step = Math.max(1, n / k); for (let x = 0; x < n && out.length < k; x += step) out.push(Math.floor(x)); return out; }

/** R29 + R30：每块岩体的材质、破面、植被、白沫检查 + 汇总 totals（给 compareToBaseline）。 */
export function checkApostlesSurface({ plantsPerMesh = 60, coastMax = 4000 } = {}) {
  const rocks = apostleRocks(); if (!rocks.length) return { ok: false, reason: '十二门徒岩体网格还没出现' };
  const masses = [], totals = { masses: 0, considered: 0, inverted: 0, openEdges: 0, transparentRock: 0, plants: 0, plantBad: 0, foam: 0, foamStray: 0, coast: 0, foamUncovered: 0 };
  for (const rock of rocks) {
    const m = massInfo(rock), group = rock.parent, geo = rock.geometry, pos = geo.attributes.position;
    rock.updateWorldMatrix(true, true); _inv.copy(rock.matrixWorld).invert();
    // 材质
    const rows = []; group?.traverse((o) => { if (!(o.isMesh || o.isInstancedMesh)) return; const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (!mat) return;
      const kind = o === rock ? 'rock' : /shore-skirt/.test(o.name) ? 'foam' : /shore-waves/.test(o.name) ? 'waves' : o.isInstancedMesh ? 'plant' : o.material?.depthWrite === false && o.renderOrder >= 5 ? 'hover' : 'other';
      rows.push({ name: o.name || kind, kind, transparent: !!mat.transparent, opacity: mat.opacity, alphaTest: mat.alphaTest || 0 }); });
    const materials = materialAudit(rows);
    // 破面（水线以上 0.3 米）
    const integrity = meshIntegrity({ position: pos.array, normal: geo.attributes.normal?.array || null, index: geo.index?.array || null, bend: m.bend, waterY: 0.3 / m.S });
    // 植被：实例位置换到岩体局部坐标
    const surface = buildSurfaceIndex({ position: pos.array, index: geo.index?.array || null, bin: 1 });
    const plantPts = [], byMesh = {};
    const veg = group?.getObjectByName('apostle-reacode-vegetation');
    veg?.traverse((o) => { if (!o.isInstancedMesh || !o.count) return; o.updateWorldMatrix(true, false); const pts = [];
      for (const i of evenly(o.count, plantsPerMesh)) { o.getMatrixAt(i, _m); _p.setFromMatrixPosition(_m).applyMatrix4(o.matrixWorld).applyMatrix4(_inv); pts.push([_p.x, _p.y, _p.z]); }
      byMesh[o.name || 'plants'] = classifyPlants(plantDeltas(surface, pts), { scale: m.S }); plantPts.push(...pts); });
    const plants = plantPts.length ? classifyPlants(plantDeltas(surface, plantPts), { scale: m.S }) : null;
    // 白沫：skirt 顶点 vs 岩体水线点
    const skirt = group?.getObjectByName('apostle-reacode-shore-skirt'); let foam = null;
    if (skirt?.geometry?.attributes?.position) {
      skirt.updateWorldMatrix(true, false); const sp = skirt.geometry.attributes.position, foamXZ = [];
      for (const i of evenly(sp.count, 3000)) { _q.fromBufferAttribute(sp, i).applyMatrix4(skirt.matrixWorld).applyMatrix4(_inv); foamXZ.push([_q.x, _q.z]); }
      const coast = []; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), yu = pos.getY(i) + m.bend * (x * x + z * z); if (yu <= 0.5 / m.S) coast.push([x, z]); }
      const coastXZ = evenly(coast.length, coastMax).map((i) => coast[i]);
      foam = classifyFoam({ foamToCoast: nearestDistances(foamXZ, coastXZ), coastToFoam: nearestDistances(coastXZ, foamXZ) }, { scale: m.S });
    }
    const checks = surfaceChecks({ materials, integrity, plants, foam });
    masses.push({ id: m.id, scale: +m.S.toFixed(3), materials, integrity, plants, plantsByMesh: byMesh, foam, checks, status: worst(checks.map((c) => c.status)) });
    totals.masses++; totals.considered += integrity.considered; totals.inverted += integrity.inverted; totals.openEdges += integrity.openEdges; totals.transparentRock += materials.transparentRock.length;
    if (plants) { totals.plants += plants.count; totals.plantBad += plants.count - plants.ok; }
    if (foam) { totals.foam += foam.foam; totals.foamStray += foam.strayed; totals.coast += foam.coast; totals.foamUncovered += foam.uncovered; }
  }
  totals.plantBadShare = totals.plants ? +(totals.plantBad / totals.plants).toFixed(4) : 0;
  totals.foamStrayShare = totals.foam ? +(totals.foamStray / totals.foam).toFixed(4) : 0;
  totals.foamUncoveredShare = totals.coast ? +(totals.foamUncovered / totals.coast).toFixed(4) : 1;
  // 反面三角最多的那块岩体的第一个位置：崖脚特写可以对准它
  const worstMass = [...masses].sort((a, b) => b.integrity.inverted - a.integrity.inverted)[0];
  const defect = worstMass?.integrity.inverted ? { massId: worstMass.id, at: worstMass.integrity.invertedAt[0], kind: 'inverted' } : null;
  return { ok: true, look: lookInfo(), masses: masses.sort((a, b) => APOSTLE_MASS_ORDER.indexOf(a.id) - APOSTLE_MASS_ORDER.indexOf(b.id)), totals, defect, status: worst(masses.map((x) => x.status)) };
}

// ── 机位 ────────────────────────────────────────────────────────────────────────────
const ray = new THREE.Raycaster();
function occluder(rocks, from, to) {
  const d = to.clone().sub(from), len = d.length(); if (len < 1e-3) return null;
  ray.set(from, d.normalize()); ray.near = 1.2; ray.far = len - 1;
  const hit = ray.intersectObjects(rocks, false)[0]; return hit ? { mass: hit.object.userData.apostleMass, distance: +hit.distance.toFixed(2) } : null;
}
function placeCamera(camera, target, dir, distance, up) {
  camera.position.copy(target).addScaledVector(dir, distance); camera.up.copy(up); camera.lookAt(target); camera.fov = 40; camera.far = Math.max(camera.far, distance * 8); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const orbit = createViewportOrbit({ camera, target, minDistance: 4, maxDistance: 900 }); morrisViewer.orbitInput = orbit; morrisViewer.applyTownCamera = orbit.apply;
}

/**
 * 把编辑镜头放到一个机位，并检查机位是否有效：镜头在海面以上、镜头到目标之间没有岩体挡住（有就绕 up 轴转、再不行拉近）。
 * name：overview / side / top / cliff-foot。opts.massId：崖脚特写对准哪块（默认 front-left）；opts.at：岩体局部坐标里的一个点（例如破面位置）。
 */
export function setApostleView(name, { massId = 'front-left', at = null } = {}) {
  const camera = morrisViewer.camera; if (!camera) return { ok: false, reason: '游戏镜头未就绪' };
  const rocks = apostleRocks(); if (!rocks.length) return { ok: false, reason: '十二门徒岩体网格还没出现' };
  if (!VIEWS.includes(name)) return { ok: false, reason: '未知机位 ' + name };
  const box = new THREE.Box3(); for (const r of rocks) { r.updateWorldMatrix(true, false); r.geometry.computeBoundingBox?.(); box.union(r.geometry.boundingBox.clone().applyMatrix4(r.matrixWorld)); }
  const center = box.getCenter(new THREE.Vector3()), up = center.clone().normalize(), radius = box.getSize(new THREE.Vector3()).length() / 2;
  const seaR = Math.hypot(...(rocks[0].userData.seaStack?.seaAnchor || [0, 160, 0]));
  // 水平参考方向：当前镜头相对场景中心的方向投到切平面（与场景切换后的初始镜头一致）
  const h0 = camera.position.clone().sub(center); h0.addScaledVector(up, -h0.dot(up)); if (h0.lengthSq() < 1e-6) h0.set(1, 0, 0).addScaledVector(up, -up.x); h0.normalize();
  let target = center.clone(), yaw = 0, pitch = 0.8, distance = Math.max(60, radius * 1.7);
  if (name === 'side') yaw = Math.PI / 2;
  if (name === 'top') { pitch = 1.25; distance = Math.max(70, radius * 1.9); }
  if (name === 'cliff-foot') {
    const preferred = rocks.find((r) => r.userData.apostleMass === (at?.massId || massId)) || rocks[0];
    let rock = preferred, local = null;
    if (Array.isArray(at?.at)) local = new THREE.Vector3(...at.at);
    else { // 离当前镜头最近的「水线穿越点」：低模崖面顶点稀疏，水线处可能没有顶点，取三角边与水平面的交点
      const order = [preferred, ...rocks.filter((r) => r !== preferred)];
      for (const cand of order) {
        const cm = massInfo(cand), cp = cand.geometry.attributes.position, idx = cand.geometry.index;
        const camL = camera.position.clone().applyMatrix4(new THREE.Matrix4().copy(cand.matrixWorld).invert());
        const triCount = idx ? idx.count / 3 : cp.count / 3; let best = Infinity, found = null;
        const yu = (i) => { const x = cp.getX(i), z = cp.getZ(i); return cp.getY(i) + cm.bend * (x * x + z * z); };
        const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
        for (let t = 0; t < triCount; t++) {
          for (let k = 0; k < 3; k++) {
            const a = vi(t, k), b = vi(t, (k + 1) % 3), ya = yu(a), yb = yu(b);
            if (ya === yb || (ya > 0) === (yb > 0)) continue;
            const f = ya / (ya - yb), x = cp.getX(a) + (cp.getX(b) - cp.getX(a)) * f, z = cp.getZ(a) + (cp.getZ(b) - cp.getZ(a)) * f, y = cp.getY(a) + (cp.getY(b) - cp.getY(a)) * f;
            const d = (x - camL.x) ** 2 + (z - camL.z) ** 2;
            if (d < best) { best = d; found = new THREE.Vector3(x, y, z); }
          }
        }
        if (found) { rock = cand; local = found; break; }
      }
    }
    if (!local) return { ok: false, reason: preferred.userData.apostleMass + ' 等岩体都找不到水线上的崖脚点' };
    target = local.applyMatrix4(rock.matrixWorld);
    const massC = new THREE.Box3().setFromObject(rock).getCenter(new THREE.Vector3()), out = target.clone().sub(massC); out.addScaledVector(up, -out.dot(up));
    if (out.lengthSq() > 1e-6) { out.normalize(); yaw = Math.atan2(out.clone().cross(h0).dot(up) * -1, out.dot(h0)); }
    pitch = 0.22; distance = 26;
  }
  const dirFor = (yw, p) => h0.clone().applyAxisAngle(up, yw).multiplyScalar(Math.cos(p)).addScaledVector(up, Math.sin(p)).normalize();
  let tries = 0, occ = null, dir = dirFor(yaw, pitch), dist = distance;
  for (; tries < 14; tries++) {
    dir = dirFor(yaw + (tries % 7) * 0.4 * (tries % 2 ? -1 : 1), pitch); dist = distance * (tries < 7 ? 1 : 0.7);
    const cam = target.clone().addScaledVector(dir, dist);
    occ = occluder(rocks, target.clone().addScaledVector(dir, 1.5), cam);
    if (!occ && cam.length() > seaR + 1) break;
  }
  placeCamera(camera, target, dir, dist, up);
  const valid = !occ && camera.position.length() > seaR + 1;
  return { ok: true, view: name, label: VIEW_NAMES[name], valid, tries, occluder: occ, target: target.toArray().map((v) => +v.toFixed(2)), distance: +dist.toFixed(1), heightAboveSea: +(camera.position.length() - seaR).toFixed(1), look: lookInfo() };
}
