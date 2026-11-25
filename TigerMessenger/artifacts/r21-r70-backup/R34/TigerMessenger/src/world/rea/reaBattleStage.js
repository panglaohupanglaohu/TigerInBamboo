// REA 战场舞台（2026-11-09，规划 docs/plans/2026-11-09-vikings-dragon-banner-citadel-ink.md §2，P0）。
// 把 REACodeRefactoring 的 Bad North 玩法层（vendor 副本 badnorth/battle.js，原样不改）放到星球上的某个场景里：
//   1. 舞台坐标系 = 场景中心处的局部切平面（y = 当地海面，+y = 星球「上」），放大 scale 倍挂进主场景（anchor）；
//   2. REA 网格（buildQuadGrid）每个格子中心沿「下」打射线到实景（只采地形 / 建筑，不采树、云、水），高度按 levelHeight 取整写进 REA World；
//      海面以下 = 0（海），长船从海上来；
//   3. Battle 需要的 view 接口用最小实现补齐（世界网格只作导航 / 通道判定，不显示）。
// 只是胶水：战斗、长船、寻路、旗、血、箭全是 REA 原逻辑。
import * as THREE from 'three';
export const REA_UNIT_HEIGHT = 0.18;   // REA battle.js 单位：身体 0–0.12 + 头球心 0.145 半径 0.035
export const SOLDIER_HEIGHT_M = 1.7;
import { buildQuadGrid } from '../../vendor/townscaper-rea-refactoring/src/core/grid.js';
import { decorateCells, buildCellIndex } from '../../vendor/townscaper-rea-refactoring/src/core/spatial.js';
import { World, MAX_LEVEL } from '../../vendor/townscaper-rea-refactoring/src/core/world.js';
import { WorldMesh } from '../../vendor/townscaper-rea-refactoring/src/world/worldmesh.js';
import { Battle } from '../../vendor/townscaper-rea-refactoring/src/badnorth/battle.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';
import { P } from '../../core/params.js';
import { isCrossableRailOrTram } from '../vikings/vikingVoyage.js';

const SKIP = /tram|rail|wire|cable|catenary|pine|tree|shrub|leaf|leaves|bush|flower|grass|tuft|cloud|beam|water|sea|ocean|foam|wave|eye|shine|particle|smoke|banner|lantern|glow|halo|shadow|ring/i;
const HOUSE = /house|hall|temple|shrine|pavilion|hut|tower|gate|building|roof|tea/i;

// 大网格（星球表面等）只截出离舞台中心 r 以内的三角形，做一个临时世界坐标网格给射线用（原网格不动）
function clipToStage(o, centre, r) {
  const g = o.geometry, pos = g.attributes.position, ix = g.index?.array, n = ix ? ix.length : pos.count, out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), r2 = r * r;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, ix ? ix[i] : i).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, ix ? ix[i + 1] : i + 1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, ix ? ix[i + 2] : i + 2).applyMatrix4(o.matrixWorld);
    if (a.distanceToSquared(centre) > r2 && b.distanceToSquared(centre) > r2 && c.distanceToSquared(centre) > r2) continue;
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  if (!out.length) return null;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.name = o.name; m.userData.clippedFrom = o; m.updateMatrixWorld(true);
  return m;
}

export class ReaBattleStage {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene 主场景
   * @param {THREE.Object3D} o.site 要采样地形的场景根（苔庭 leviathanGroup、圣城 castle…）
   * @param {THREE.Vector3} o.dir 场景中心方向（单位向量）
   * @param {THREE.Camera} o.camera 主相机（REA 单位精灵朝向用）
   * @param {number} [o.scale] 舞台 1 单位 = 多少米（REA 一格约 1 单位）
   * @param {number} [o.gridRadius] REA 网格半径（格）
   */
  constructor({ scene, site = scene, dir, camera, scale = 3.5, gridRadius = 14, levelHeight = 0.5, name = 'rea-battle', houseFilter = HOUSE, sampleRadius = null, unitHeightM = null }) {
    this.name = name; this.scale = scale; this.L = levelHeight; this.site = site; this.camera = camera;
    const up = dir.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
    const north = up.clone().cross(east).normalize();   // 右手系：x = east, y = up, z = north → det = +1
    const seaR = 160 + officialOceanLevelAt(up);
    this.anchor = new THREE.Group(); this.anchor.name = `${name}-anchor`; this.anchor.userData.reaBattleStage = true;
    this.anchor.matrixAutoUpdate = false;
    this.anchor.matrix.makeBasis(east, up, north.clone().negate()).scale(new THREE.Vector3(scale, scale, scale)).setPosition(up.clone().multiplyScalar(seaR));
    this.anchor.matrixWorldNeedsUpdate = true;
    scene.add(this.anchor); this.anchor.updateMatrixWorld(true);
    this.up = up; this.east = east; this.north = north; this.seaR = seaR;
    // 2026-11-10 用户截图「小船飞在空中 / 海面算错了」：舞台原来是星球上的一块平切面，圣城舞台半径 ~112 m，
    // 离切点越远平面比球面越高（112 m 处高出约 35 m）→ 长船、尾迹、远处的兵悬在天上。
    // 现在舞台坐标改成「贴球」坐标：x,z = 沿球面的弧长方向（舞台单位），y = 离海面的径向高度；采样与画都按这个映射（toWorld / worldToStage / 着色器 tmWarpWorld）。
    this.warpUniforms = { uTmWarpInv: { value: new THREE.Matrix4() }, uTmWarpStage: { value: new THREE.Matrix4() }, uTmWarpR: { value: seaR / scale } };
    this.warpUniforms.uTmWarpStage.value.copy(this.anchor.matrixWorld); this.warpUniforms.uTmWarpInv.value.copy(this.anchor.matrixWorld).invert();

    // REA 世界：从实景采样
    this.grid = decorateCells(buildQuadGrid({ radius: gridRadius, hexSize: 1 }));
    this.index = buildCellIndex(this.grid);
    this.world = new World(this.grid);
    this.report = this.#sample(site, houseFilter, sampleRadius ?? gridRadius * 2 * scale);

    // Battle 的 view 接口（最小实现）
    this.worldMesh = new WorldMesh(this.world, { levelHeight });
    this.worldMesh.rebuild();
    this.mesh = new THREE.Mesh(this.worldMesh.geometry, new THREE.MeshBasicMaterial({ visible: false }));
    this.mesh.name = `${name}-nav-surface`; this.mesh.raycast = () => {};
    this.anchor.add(this.mesh);
    const wind = new THREE.Vector3();
    this.view = {
      scene: this.anchor, levelHeight, index: this.index, mesh: this.mesh, worldMesh: this.worldMesh, navLayer: null,
      effects: { fireSources: [], showFire() {} }, smoke: { sources: [] },
      atmosphere: { sample: () => { const a = THREE.MathUtils.degToRad(P.windDir ?? 45), s = 0.6 + (P.windSpeed ?? 0.8); return wind.set(Math.cos(a) * s, 0, Math.sin(a) * s); } },
      camera, debugState: {}, goreOff: false, flowDebug: false,
      // 2026-11-10 用户：士兵按真实身高画（默认 1.7 m）。REA 单位高 0.18 格 → 放大倍数 = 身高 /(0.18 × scale)；长船同倍放大
      unitScale: unitHeightM ? unitHeightM / (REA_UNIT_HEIGHT * scale) : 1,
      // 画单位 / 旗时的高度修正：实景地面高 − REA 层高（圣城一层 4 m，取整后人会埋进地面或悬空；只改画的位置，不改战斗逻辑）
      // 2026-11-10：再细到每个人脚下（细网格双线性，四点都有才用；否则退回格心高度）
      visualOffset: (x, z) => { const c = this.index.cellAt(x, z); if (!c) return 0; const top = this.world.top(c); if (!top) return 0; const f = this.fineAt(x, z), ty = f ?? this.trueY.get(c.id); return ty == null ? 0 : ty - top * levelHeight; },
    };
    this.battle = new Battle(this.view);
    this.battle.hud.style.top = '128px';
    this.running = false;
  }

  /** 实景 → REA World：每格中心向下打射线，取最高的实景面；高度按层取整 */
  #sample(site, houseFilter, radius) {
    const meshes = [], centre = this.up.clone().multiplyScalar(160), bc = new THREE.Vector3();
    site.updateWorldMatrix(true, true);
    site.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o === this.mesh) return;
      // 只采舞台范围内的东西（按包围球与舞台中心的距离）
      const g = o.geometry; if (!g?.attributes?.position) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      bc.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      if (bc.distanceTo(centre) - g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > radius) return;
      const big = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > radius;
      for (let p = o; p; p = p.parent) if (!p.visible || p.userData.reaBattleStage || p.userData.reaIgnore) return;   // reaIgnore：远征大船等临时物体   // 不采别的战场舞台里的船 / 兵
      const path = `${o.name}<${o.parent?.name || ''}`;
      if (SKIP.test(path)) return;
      // 2026-11-10 用户截图「红袍为何站在空中」：圣城双层轨桥 / 高架被采成了地面。一格 8 m 只取格心一个高度，
      // 格心落在桥面上 → 整格都是桥面高 → 站在格子靠桥外那部分的兵就悬在半空。桥 / 高架不是战场地面，不采。
      if (isCrossableRailOrTram(o) || /bridge|viaduct|double-deck|aqueduct/i.test(path)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.visible === false) return;
      if (big) { const clip = clipToStage(o, centre, radius + 6); if (clip) meshes.push(clip); return; }   // 星球表面那种大网格：只截舞台范围内的三角形
      meshes.push(o);
    });
    // 采样（2026-11-09 二版）：所有候选网格的三角形先一次性换到舞台局部坐标、按水平格子分桶；
    // 每格「从上往下」的射线在局部坐标里就是竖直线，只查这个桶里的三角形（二维点在三角形内 + 插值高度）。
    // 第一版用 Raycaster 逐格打全部网格：圣城 2700 个网格、2516 格要 30 s。
    const inv = this.anchor.matrixWorld.clone().invert(), t0 = performance.now();
    const BIN = 1, bins = new Map(), objs = [], isHouse = [];
    let tris = new Float32Array(1 << 20), nt = 0;   // 三角形表用可增长的 Float32Array（普通数组存 200 万三角要 ~160 MB，测试页曾因此崩溃）
    const push10 = (a) => { if (nt + 10 > tris.length) { const g = new Float32Array(tris.length * 2); g.set(tris); tris = g; } tris.set(a, nt); const k = nt; nt += 10; return k; };
    const tmp10 = new Float32Array(10);
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), m = new THREE.Matrix4();
    const R2 = (radius / this.scale + 2) ** 2;
    for (const o of meshes) {
      const g = o.geometry, pos = g.attributes.position, ix = g.index?.array, n = ix ? ix.length : pos.count, oi = objs.push(o) - 1;
      isHouse[oi] = !!houseFilter && houseFilter.test(`${o.name}<${o.parent?.name || ''}<${o.parent?.parent?.name || ''}`);
      m.copy(o.matrixWorld);
      for (let i = 0; i < n; i += 3) {
        this.worldToStage(va.fromBufferAttribute(pos, ix ? ix[i] : i).applyMatrix4(m), va); this.worldToStage(vb.fromBufferAttribute(pos, ix ? ix[i + 1] : i + 1).applyMatrix4(m), vb); this.worldToStage(vc.fromBufferAttribute(pos, ix ? ix[i + 2] : i + 2).applyMatrix4(m), vc);
        if (va.x * va.x + va.z * va.z > R2 && vb.x * vb.x + vb.z * vb.z > R2 && vc.x * vc.x + vc.z * vc.z > R2) continue;
        tmp10[0] = va.x; tmp10[1] = va.y; tmp10[2] = va.z; tmp10[3] = vb.x; tmp10[4] = vb.y; tmp10[5] = vb.z; tmp10[6] = vc.x; tmp10[7] = vc.y; tmp10[8] = vc.z; tmp10[9] = oi;
        const k = push10(tmp10);
        const x0 = Math.floor(Math.min(va.x, vb.x, vc.x) / BIN), x1 = Math.floor(Math.max(va.x, vb.x, vc.x) / BIN), z0 = Math.floor(Math.min(va.z, vb.z, vc.z) / BIN), z1 = Math.floor(Math.max(va.z, vb.z, vc.z) / BIN);
        if ((x1 - x0) * (z1 - z0) > 400) continue;   // 罕见的超大三角形（已截过大网格）跳过
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = x * 100003 + z; let b = bins.get(key); if (!b) bins.set(key, (b = [])); b.push(k); }
      }
    }
    const heightAt = (x, z) => {
      const b = bins.get(Math.floor(x / BIN) * 100003 + Math.floor(z / BIN)); if (!b) return null;
      let best = -Infinity, bo = -1, house = null;
      for (const k of b) {
        const ax = tris[k], ay = tris[k + 1], az = tris[k + 2], bx = tris[k + 3], by = tris[k + 4], bz = tris[k + 5], cx = tris[k + 6], cy = tris[k + 7], cz = tris[k + 8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * ay + l2 * by + l3 * cy; if (y >= 60 / this.scale) continue;
        if (isHouse[tris[k + 9]]) { house = objs[tris[k + 9]]; continue; }   // 房子不当地形：单位走在房子脚下的地上，房子格记为 REA 小屋
        if (y > best) { best = y; bo = tris[k + 9]; }
      }
      return bo < 0 ? null : { y: best, object: objs[bo], house };
    };
    let land = 0, maxLv = 0, rays = 0; const houses = []; this.trueY = new Map();
    for (const c of this.grid.cells) {
      const hit = heightAt(c.cx, c.cz); rays++;
      if (!hit) continue;
      if (hit.y * this.scale < 0.25) continue;                         // 实景高出海面不到 25 cm = 海
      const lv = Math.min(MAX_LEVEL, Math.max(1, Math.round(hit.y / this.L)));   // 露出海面的地至少 1 层（苔庭这种低岛）
      this.world.fill(c, lv, { rock: true }); land++; maxLv = Math.max(maxLv, lv); this.trueY.set(c.id, hit.y);
      if (hit.house) houses.push({ c, lv });
    }
    this.sampleTris = nt / 10;
    // 画单位用的细网格地面高（每 0.5 舞台单位一个点，圣城 = 4 m）：一格只有格心一个高度，格子边缘（崖边、桥边）的人会悬空 / 埋地。
    // 只在陆地格的包围盒里采，点数约陆地格数 × 4；没采到（空洞 / 海）就退回格心高度。
    const FS = 0.5; this.fineStep = FS; this.fineY = new Map();
    for (const c of this.grid.cells) {
      if (!this.trueY.has(c.id)) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const q of c.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
      for (let i = Math.floor(x0 / FS); i <= Math.ceil(x1 / FS); i++) for (let j = Math.floor(z0 / FS); j <= Math.ceil(z1 / FS); j++) {
        const key = i * 100003 + j; if (this.fineY.has(key)) continue;
        const h = heightAt(i * FS, j * FS); this.fineY.set(key, h && h.y * this.scale >= 0.25 ? h.y : null);
      }
    }
    // 平岛补一层台地：REA 守军在 2 层以上的台地集结（Bad North 的岛都是「一圈滩 + 台地」）。
    // 苔庭这种不到 2 米高的平园，临海一圈留 1 层当滩，内陆抬到 2 层；本来就高的地方不动。
    if (maxLv < 2) {
      const raise = [];
      for (const c of this.grid.cells) {
        if (!this.world.top(c)) continue;
        let coast = false; for (let i = 0; i < c.n; i++) { const nb = this.world.neighbor(c, i); if (!nb || !this.world.top(nb)) { coast = true; break; } }
        if (!coast) raise.push(c);
      }
      for (const c of raise) this.world.fill(c, 2, { rock: true });
      if (raise.length) maxLv = 2;
      this.plateauRaised = raise.length;
    }
    // 小屋：命中建筑的格子里挑最高的几个（彼此不相邻）当 REA 小屋（失守判定用）；
    // 场景里没有可识别建筑（例如十二门徒这种纯海蚀岩群）时退回最高台地，否则 bnHouses 为空、
    // HUD 显示「小屋 0/0」，Bad North 的防守目标就不存在。
    houses.sort((a, b) => b.lv - a.lv);
    const picked = [];
    for (const h of houses) { if (picked.length >= 4) break; if (picked.every((p) => Math.hypot(p.cx - h.c.cx, p.cz - h.c.cz) > 2.5)) picked.push(h.c); }
    if (!picked.length) {
      const cand = [];
      for (const c of this.grid.cells) { const lv = this.world.top(c); if (lv) cand.push({ c, lv }); }
      cand.sort((a, b) => b.lv - a.lv);
      for (const h of cand) { if (picked.length >= 4) break; if (picked.every((p) => Math.hypot(p.cx - h.c.cx, p.cz - h.c.cz) > 3)) picked.push(h.c); }
      if (picked.length) this.housesFromPlateau = picked.length;
    }
    this.world.bnHouses = picked;
    this.world.touch();
    return { tris: this.sampleTris, rays, plateauRaised: this.plateauRaised || 0, ms: Math.round(performance.now() - t0), meshes: meshes.length, cells: this.grid.cells.length, land, maxLevel: maxLv, houses: picked.length, grid: (() => { const out = [], hs = new Set(picked); for (const c of this.grid.cells) { const lv = this.world.top(c); if (lv) out.push([+c.cx.toFixed(2), +c.cz.toFixed(2), lv, hs.has(c) ? 1 : 0]); } return out; })() };
  }

  /** 细网格地面高（舞台局部 y）；四角缺任一个 → null */
  fineAt(x, z) {
    const F = this.fineStep, M = this.fineY; if (!M) return null;
    const i = Math.floor(x / F), j = Math.floor(z / F), u = x / F - i, v = z / F - j;
    const a = M.get(i * 100003 + j), b = M.get((i + 1) * 100003 + j), c = M.get(i * 100003 + j + 1), d = M.get((i + 1) * 100003 + j + 1);
    if (a == null || b == null || c == null || d == null) return null;
    if (Math.max(a, b, c, d) - Math.min(a, b, c, d) > this.L * 1.5) return Math.max(...[[a, (1 - u) * (1 - v)], [b, u * (1 - v)], [c, (1 - u) * v], [d, u * v]].sort((p, q) => q[1] - p[1]).slice(0, 1).map((p) => p[0]));   // 跨崖：取最近角，不在崖面上插值
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  start() { this.battle.start(this.world); this.running = true; this.warpMaterials(); return this; }
  stop() { this.battle.stop(); this.running = false; }
  update(dt) { if (this.running) { this.battle.update(Math.min(dt, 0.1)); this.warpMaterials(); } }
  /** 舞台局部坐标 → 星球世界坐标 */
  toWorld(x, y, z, out = new THREE.Vector3()) {
    // 贴球舞台坐标 → 世界：弧长 ρ 对应球心角 ρ·scale / seaR，y 是离海面的径向高度
    const rho = Math.hypot(x, z), th = rho * this.scale / this.seaR, R = this.seaR + y * this.scale;
    if (rho < 1e-9) return out.copy(this.up).multiplyScalar(R);
    const tx = this.east.x * x / rho - this.north.x * z / rho, ty = this.east.y * x / rho - this.north.y * z / rho, tz = this.east.z * x / rho - this.north.z * z / rho;
    const c = Math.cos(th), sn = Math.sin(th);
    return out.set((this.up.x * c + tx * sn) * R, (this.up.y * c + ty * sn) * R, (this.up.z * c + tz * sn) * R);
  }
  /** 世界 → 贴球舞台坐标（out 可与 w 同一个向量） */
  worldToStage(w, out = new THREE.Vector3()) {
    const r = Math.hypot(w.x, w.y, w.z) || 1, nx = w.x / r, ny = w.y / r, nz = w.z / r;
    const d = Math.max(-1, Math.min(1, nx * this.up.x + ny * this.up.y + nz * this.up.z)), th = Math.acos(d);
    let hx = nx - this.up.x * d, hy = ny - this.up.y * d, hz = nz - this.up.z * d; const hl = Math.hypot(hx, hy, hz);
    const rho = th * this.seaR / this.scale, y = (r - this.seaR) / this.scale;
    if (hl < 1e-12) return out.set(0, y, 0);
    hx /= hl; hy /= hl; hz /= hl;
    return out.set((hx * this.east.x + hy * this.east.y + hz * this.east.z) * rho, y, -(hx * this.north.x + hy * this.north.y + hz * this.north.z) * rho);
  }
  /** 舞台里所有可见物（单位、旗、血、箭、长船、尾迹…）的材质顶点阶段加贴球映射；新出现的材质每帧补上。投影关掉（深度材质不弯）。 */
  warpMaterials() {
    const U = this.warpUniforms;
    this.anchor.traverse((o) => {
      if (o === this.mesh || !(o.isMesh || o.isPoints || o.isLine)) return;
      o.frustumCulled = false; o.castShadow = false;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!mat || mat.userData.tmWarp) continue;
        mat.userData.tmWarp = true;
        const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
        mat.onBeforeCompile = (sh, r) => {
          prev?.call(mat, sh, r);
          Object.assign(sh.uniforms, U);
          const head = 'uniform mat4 uTmWarpInv; uniform mat4 uTmWarpStage; uniform float uTmWarpR;\nvec4 tmWarpWorld(vec4 w){ vec3 s=(uTmWarpInv*w).xyz; float rho=length(s.xz); float th=rho/uTmWarpR; vec2 d=rho>1e-6?s.xz/rho:vec2(0.0); float rad=uTmWarpR+s.y; return uTmWarpStage*vec4(d.x*rad*sin(th), rad*cos(th)-uTmWarpR, d.y*rad*sin(th), 1.0); }\n';
          if (sh.vertexShader.includes('#include <project_vertex>')) {
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + head)
              .replace('#include <project_vertex>', 'vec4 tmLp = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n tmLp = instanceMatrix * tmLp;\n#endif\nvec4 mvPosition = viewMatrix * tmWarpWorld( modelMatrix * tmLp );\ngl_Position = projectionMatrix * mvPosition;');
          } else {
            sh.vertexShader = head + sh.vertexShader.replace(/projectionMatrix\s*\*\s*modelViewMatrix\s*\*\s*vec4\(\s*position\s*,\s*1\.0?\s*\)/g, 'projectionMatrix * viewMatrix * tmWarpWorld( modelMatrix * vec4( position, 1.0 ) )');
          }
        };
        mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|tmwarp';
        mat.needsUpdate = true;
      }
    });
  }
  dispose() { this.stop(); this.anchor.removeFromParent(); this.battle.hud?.remove(); }
}
