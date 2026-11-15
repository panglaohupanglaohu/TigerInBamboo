// 维京远征 · 航行与下锚（2026-11-09，规划 §3.4，P3；三版：可跨铁轨 + 书店镇→苔庭固化航线）。
// 复用：warshipWaterRoutes 的 surface()（逐点取海面 / 海床 / 地面高度，含岛和建筑障碍）判断水深；
//   它自带的 berth / route 是为港内短航线设计的（远航一次 berth 搜索 13–20 s，会卡住页面），远航航线在这里算。
// 二版（用户问「船行驶路径都验证了吗」后实测：李白号去苔庭的实际航迹有 43 个采样点压在陆地上，最高压过圣城山体 12.8 m）：
//   1. 航线：大圆每 10 m 取点 + 侧向绕行之后，再按 2 m 逐段复核「船宽」走廊（中线 + 两舷各 margin 米）；
//      哪段碰到陆地就在那里插一个绕行点，反复直到全段通过（一版只查 10 m 一个点，点与点之间压过陆地 6 处）。
//   2. 驾船：改纯追踪（pure pursuit）——始终瞄准航线上「当前最近点往前 12 m」的位置，船贴着航线走；
//      一版是「对准下一个航点」，转弯半径大于点距时抄近路，实测偏离航线最大 23 m。
// 三版（2026-11-10 用户纠正「船可以跨过铁轨」）：
//   - 电车高架 / 铁轨 / 双层轨桥不算船障；岛体、山体、浅滩仍挡。
//   - 书店镇→苔庭改用带状网格 A*（planVoyageAstar）；实测可跨铁轨后李白 ~449 m、Duke ~323 m。
//   - 离港钉死：苔庭之战前约 10 分钟（VOYAGE_TIMING.departBeforeMossSec=600）；巡航 15 m/s（2026-11-10 由 0.75 提速），到锚地后 hold-moss 等开战。
import * as THREE from 'three';
import { MeshBVH } from '../../../vendor/jsm/libs/three-mesh-bvh.module.js';   // three-mesh-bvh 0.8.3（MIT）：大网格射线加速

const R = 160;

/** 用户明确：船可以跨过铁轨 / 电车高架。这些几何不挡航线（仍避开岛、山、陆地）。 */
export function isCrossableRailOrTram(o) {
  for (let x = o; x; x = x.parent) {
    const n = x.name || '';
    if (/^christchurch-tram-system$|^tram-|moebius-city-viaduct|moebius-trackside|citadel-coastal-tram|citadel-tram-|jakub-viaduct|jakub-rail-embankment|global-approach-support|citadel-target-double-deck|central-double-deck|newShore-double-deck/i.test(n)) return true;
  }
  return false;
}

/** 远征大船自己（及载具组）不当障碍，否则离港点会被自己的船体挡住。 */
export function isVoyageShipMesh(o) {
  for (let x = o; x; x = x.parent) {
    const n = x.name || '';
    if (n === 'bookshop-steam-parts-freighter' || n === 'duke-coastal-steam-freighter' || /^viking-voyage-carrier/.test(n)) return true;
    if (x.userData?.reaIgnore) return true;
  }
  return false;
}

/**
 * 战役时间常数（2026-11-10 用户：苔庭之战前约 10 分钟离开书店镇）。
 * 实测书店镇→苔庭 A*：李白 449 m、Duke 323 m；巡航 15 m/s → 约半分钟到锚地。
 * 集结实测约 6 分钟 → 集结启动 ≈ 开战 −（离港提前 + 集结预算）。
 */
export const VOYAGE_TIMING = Object.freeze({
  departBeforeMossSec: 600,   // 离港 = 苔庭开战 − 10 分钟（用户估算，已钉死）
  musterBudgetSec: 360,       // 集结预算（书店镇补员实测约 6 分钟）
  holdAfterArriveSec: 30,     // 无霸天同步时，到锚地后再等多久开打（测试用）
  cruiseSpeedMps: 15,         // 书店镇→苔庭巡航（2026-11-10 用户：0.75 → 5 → 15 m/s）；李白 449 m≈30 s、Duke 322 m≈21 s（另加加速 / 进锚地减速约 10 s）。?vikingSpeed= 可调
  dashSpeedMps: 15,           // 苔庭→圣城（2026-11-10 与巡航统一 15 m/s，原 7）
  avgBatianTargetSec: 180,    // 估算霸天每个目标耗时（用于反推集结启动）
  mossApproachSec: 70,        // 霸天开始打苔庭 → 旗舰开火触发开战的大约秒数
});

/**
 * 2026-11-10 实测固化：书店镇港 → 苔庭外锚地（可跨铁轨 A*，忽略本船）。
 * dirs = 单位方向航点；运行时仍会按船实际泊位重算 A*，这张表作对照与回退。
 */
export const BOOKSHOP_TO_MOSS_ROUTE = Object.freeze({
  measuredAt: '2026-11-10',
  crossRails: true,
  lee: Object.freeze({
    lengthM: 449.4,
    sailSecAtCruise: Math.round(449.4 / 15),
    anchorageDistM: 46.6,
    dirs: Object.freeze([
      Object.freeze([0.436287, -0.434502, 0.787948]),
      Object.freeze([-0.268275, 0.756058, 0.596997]),
      Object.freeze([-0.21317, 0.86898, 0.446579]),
      Object.freeze([-0.277499, 0.9544, 0.11007]),
      Object.freeze([-0.297768, 0.952407, 0.065227]),
      Object.freeze([-0.378551, 0.747242, -0.546195]),
    ]),
  }),
  duke: Object.freeze({
    lengthM: 322.5,
    sailSecAtCruise: Math.round(322.5 / 15),
    anchorageDistM: 60.9,
    dirs: Object.freeze([
      Object.freeze([-0.212698, -0.139687, 0.967082]),
      Object.freeze([-0.919541, 0.382435, -0.090484]),
      Object.freeze([-0.657902, 0.608667, -0.443496]),
    ]),
  }),
  mossDir: Object.freeze([-0.427143, 0.529916, -0.732624]),
});

/** 离港时刻 / 集结启动：按开战时刻反推（秒）。 */
export function scheduleBeforeMoss(battleEtaSec, timing = VOYAGE_TIMING) {
  const departAt = battleEtaSec - timing.departBeforeMossSec;
  const musterAt = departAt - timing.musterBudgetSec;
  return {
    battleEtaSec,
    departAtSec: departAt,
    musterAtSec: musterAt,
    departBeforeMossSec: timing.departBeforeMossSec,
    musterBudgetSec: timing.musterBudgetSec,
    sailBudgetSec: timing.departBeforeMossSec, // 巡航目标 ≈ 离港提前量
  };
}

/** 按霸天战役剩余目标粗算「距苔庭开战还有多久」。 */
export function estimateMossBattleEtaSec(batianSnapshot, targets, timing = VOYAGE_TIMING) {
  if (!batianSnapshot || !Array.isArray(targets)) return null;
  const order = targets.map((t) => t.id);
  const mossIdx = order.indexOf('moss');
  if (mossIdx < 0) return null;
  const done = new Set(batianSnapshot.completedTargets || []);
  const cur = batianSnapshot.target;
  let remaining = 0;
  for (let i = 0; i < mossIdx; i++) if (!done.has(order[i])) remaining++;
  // 当前正在打苔庭：只剩进场到开火
  if (cur === 'moss') {
    const phase = batianSnapshot.phase;
    if (['blockade', 'pincer', 'cannon', 'guard'].includes(phase)) return 0;
    if (phase === 'transit') return Math.max(5, timing.mossApproachSec * 0.5);
    if (phase === 'assemble') return timing.mossApproachSec;
    return timing.mossApproachSec;
  }
  // 当前目标在苔庭之前：剩余整目标 + 当前目标尾巴 + 苔庭进场
  let eta = remaining * timing.avgBatianTargetSec + timing.mossApproachSec;
  if (cur && order.includes(cur) && order.indexOf(cur) < mossIdx) {
    eta = Math.max(timing.mossApproachSec, (remaining - 0) * timing.avgBatianTargetSec + timing.mossApproachSec);
  }
  return eta;
}

/**
 * 全场景障碍索引（2026-11-09 二版实测后加；2026-11-10 默认可跨铁轨）：
 * warshipWaterRoutes 只认 4 组障碍（鲸鱼岛、圣城、旧港、苔庭地面），
 * 莫西斯湖岛、hills、起始营地等它都看不见，旧航迹会穿岛。
 * 这里把所有可见网格（排除天、云、水、阴影、星球海床、远征船自己、战场舞台、铁轨/电车高架）按包围球放进 20 m 的空间哈希；
 * 取样点竖直往下打一条射线：海面以上 0.3 m 到船高 clear 米之间碰到任何东西 = 挡路。
 */
export function createObstacleIndex(scene, { clear = 20, ignore = () => false, crossRails = true } = {}) {
  const SKIP = /sky|cloud|atmos|veil|fog|ocean|water|wave|foam|reflection|shadow|planet-surface|halo|glow|beam|debug|wake|spray|splash|rain|snow/i;
  const skipExtra = (o) => (crossRails && isCrossableRailOrTram(o)) || isVoyageShipMesh(o) || ignore(o);
  const CELL = 20, cells = new Map(), big = [], v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    for (let x = o; x; x = x.parent) if (!x.visible || x.userData?.reaBattleStage || x.userData?.reaIgnore || skipExtra(x)) return;
    if (SKIP.test(o.name || '') || SKIP.test(o.parent?.name || '')) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || m.visible === false || (m.transparent && m.opacity < 0.3)) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    const r = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis(); if (r < 0.8) return;
    v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    if (v.length() + r < 160) return;   // 整个在海面以下（海床、沉着的鲸鱼）
    const e = { o, c: v.clone(), r };
    if (r > 60) { big.push(e); return; }
    for (let x = Math.floor((v.x - r) / CELL); x <= Math.floor((v.x + r) / CELL); x++) for (let y = Math.floor((v.y - r) / CELL); y <= Math.floor((v.y + r) / CELL); y++) for (let z = Math.floor((v.z - r) / CELL); z <= Math.floor((v.z + r) / CELL); z++) { const k = `${x},${y},${z}`; let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(e); }
  });
  const ray = new THREE.Raycaster(), from = new THREE.Vector3(), down = new THREE.Vector3(), hits = [];
  const cache = new Map(), bvhs = new WeakMap(), inv = new THREE.Matrix4(), lr = new THREE.Ray();
  return {
    count: cells.size, big: big.length,
    /** 方向 dir 处（海面 seaR）有没有挡船的东西；返回挡住的物体或 null */
    blocked(dir, seaR = 160.35) {
      const d = dir.clone().normalize(), key = d.toArray().map((x) => x.toFixed(5)).join(',');
      if (cache.has(key)) return cache.get(key);
      const top = d.clone().multiplyScalar(seaR + clear), cand = new Set();
      for (const p of [top, d.clone().multiplyScalar(seaR)]) { const k = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`; for (const e of cells.get(k) || []) cand.add(e); }
      const list = []; for (const e of [...cand, ...big]) { // 包围球与竖直线段（海面 → 船高）相交才打
        const t = THREE.MathUtils.clamp(e.c.dot(d), seaR, seaR + clear); if (e.c.distanceTo(d.clone().multiplyScalar(t)) <= e.r) list.push(e.o); }
      let res = null;
      if (list.length) {
        from.copy(top); down.copy(d).negate(); ray.set(from, down); ray.far = clear - 0.3;
        const small = [];
        for (const o of list) {
          const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
          if (tris < 2000 || o.isInstancedMesh || o.isSkinnedMesh) { small.push(o); continue; }
          // 大网格：懒建 BVH（不改原几何），把射线换到网格局部坐标里求第一交点
          let bvh = bvhs.get(g); if (!bvh) { bvh = new MeshBVH(g); bvhs.set(g, bvh); }
          inv.copy(o.matrixWorld).invert(); lr.copy(ray.ray).applyMatrix4(inv);
          const h = bvh.raycastFirst(lr, THREE.DoubleSide);
          if (h) { const wp = h.point.applyMatrix4(o.matrixWorld); if (wp.distanceTo(from) <= ray.far) { res = o; break; } }
        }
        if (!res && small.length) { hits.length = 0; const h = ray.intersectObjects(small, false, hits)[0]; if (h) res = h.object; }
      }
      cache.set(key, res); return res;
    },
  };
}
let OBSTACLES = null;   // planVoyage 运行期间的全场景障碍索引

function wetAt(solver, dir, depth = 0.05) {
  if (OBSTACLES?.blocked(dir)) return false;   // 星球大部分海面只有半米多深（海床 ≈ 海面 -0.6 m），船是画面上浮着，只要求不压到陆地 / 岛
  const s = (solver.surfaceLoose || solver.surface)(dir.clone().normalize().multiplyScalar(R));   // 异步分帧算航线，用不因动画作废的取样
  return !!s && Math.max(s.ground, s.seabed) < s.water - depth;
}
function slerpDir(a, b, t) { const ang = a.angleTo(b); if (ang < 1e-6) return a.clone(); const axis = new THREE.Vector3().crossVectors(a, b).normalize(); return a.clone().applyAxisAngle(axis, ang * t).normalize(); }
/** 船宽走廊：中线点 + 两舷 margin 米都要有水 */
let ALONG = 0;   // 船头 / 船尾离船心的距离（planVoyage 按船长设）：转弯时 50 m 长的船头尾会甩出走廊，也要有水
function corridorWet(solver, p, fwd, margin) {
  if (!wetAt(solver, p)) return false; if (!margin) return true;
  const side = new THREE.Vector3().crossVectors(p, fwd).normalize(), f = fwd.clone().addScaledVector(p, -fwd.dot(p)).normalize();
  for (const sg of [1, -1]) if (!wetAt(solver, p.clone().multiplyScalar(R).addScaledVector(side, margin * sg).normalize())) return false;
  if (ALONG) for (const sg of [1, -1]) if (!wetAt(solver, p.clone().multiplyScalar(R).addScaledVector(f, ALONG * sg).normalize())) return false;
  return true;
}
function segmentDry(solver, a, b, margin, step = 2) {
  const n = Math.max(1, Math.ceil(a.angleTo(b) * R / step)), fwd = b.clone().sub(a).normalize();
  for (let k = 1; k < n; k++) { const q = slerpDir(a, b, k / n); if (!corridorWet(solver, q, fwd, margin)) return { k, n, q }; }
  return null;
}
function detour(solver, q, fwd, margin, maxSide) {
  const side = new THREE.Vector3().crossVectors(q, fwd).normalize();
  for (let d = 6; d <= maxSide; d += 4) for (const sg of [1, -1]) { const c = q.clone().multiplyScalar(R).addScaledVector(side, d * sg).normalize(); if (corridorWet(solver, c, fwd, margin)) return c; }
  return null;
}

/** 大圆航线 + 侧向绕行 + 2 m 船宽走廊复核；返回方向点列（单位向量） */
export async function planVoyage(solver, from, to, { step = 10, maxSide = 90, margin = 6, along = 0, obstacles = null, yieldMs = 25 } = {}) {
  ALONG = along; OBSTACLES = obstacles;
  // 异步：每算 25 ms 让一帧（长航线一次要 3–4 s，不能卡住游戏）
  let slice = performance.now(); const tick = async () => { if (performance.now() - slice > yieldMs) { await new Promise((r) => setTimeout(r, 0)); slice = performance.now(); } };
  const a = from.clone().normalize(), b = to.clone().normalize(), n = Math.max(2, Math.ceil(a.angleTo(b) * R / step)), pts = [a.clone()];
  let blocked = 0;
  for (let i = 1; i < n; i++) {
    await tick();
    const p = slerpDir(a, b, i / n), fwd = slerpDir(a, b, Math.min(1, (i + 1) / n)).sub(p).normalize();
    if (corridorWet(solver, p, fwd, margin)) { pts.push(p); continue; }
    const ok = detour(solver, p, fwd, margin, maxSide);
    if (ok) pts.push(ok); else blocked++;
  }
  pts.push(b.clone());
  // 平滑一遍（只在走廊仍有水时才挪）
  for (let i = 1; i < pts.length - 1; i++) { await tick(); const m = pts[i - 1].clone().add(pts[i + 1]).normalize(); const c = pts[i].clone().lerp(m, 0.5).normalize(); if (corridorWet(solver, c, pts[i + 1].clone().sub(pts[i - 1]).normalize(), margin)) pts[i] = c; }
  // 逐段 2 m 复核：碰陆就在碰的地方插绕行点（最多 200 次）
  let fixes = 0, unresolved = 0;
  for (let i = 1; i < pts.length && fixes < 200; i++) {
    await tick();
    const dry = segmentDry(solver, pts[i - 1], pts[i], margin); if (!dry) continue;
    const fwd = pts[i].clone().sub(pts[i - 1]).normalize(), c = detour(solver, dry.q, fwd, margin, maxSide);
    if (c && !pts.some((p) => p.angleTo(c) * R < 1)) { pts.splice(i, 0, c); fixes++; i--; } else unresolved++;
  }
  // 头尾两点本身（港口、锚地）不要求两舷有水
  let dryLegs = 0; for (let i = 1; i < pts.length; i++) if ((await tick(), segmentDry(solver, pts[i - 1], pts[i], i === 1 || i === pts.length - 1 ? 0 : margin))) dryLegs++;
  ALONG = 0; OBSTACLES = null;
  return { points: pts, blocked, fixes, unresolved, dryLegs, length: pts.slice(1).reduce((s, p, i) => s + pts[i].angleTo(p) * R, 0) };
}

/** 战场外的锚地：从战场中心朝来船方向往外，找第一处够深、离中心 ≥ minDist、船宽走廊有水的水面 */
export function findAnchorage(solver, centre, toward, { minDist = 48, maxDist = 160, margin = 8, obstacles = null } = {}) {
  OBSTACLES = obstacles;
  const c = centre.clone().normalize(), t = toward.clone().normalize();
  const fwd = t.clone().addScaledVector(c, -t.dot(c)).normalize(), side = new THREE.Vector3().crossVectors(c, fwd).normalize();
  for (let d = minDist; d <= maxDist; d += 6) for (const a of [0, 0.35, -0.35, 0.7, -0.7]) {
    const dir = fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    const p = c.clone().multiplyScalar(R).addScaledVector(dir, d).normalize();
    if (corridorWet(solver, p, side, margin) && corridorWet(solver, p, dir, margin)) return p;
  }
  return null;
}

/** 纯追踪驾船：沿方向点列行驶（bookshopBoarding 的 ship：carrier / rot / posWorld / bowWorld） */
export function createShipPilot(ship, points, { speed = 7, turnRate = null, lookahead = 12 } = {}) {
  // 2026-11-10 巡航 15 m/s：接住离港时已有的船速（不再从 0 起步），转向率随速度加大，保证 1 m 航线上不甩出去
  turnRate ??= Math.max(0.9, speed * 0.08);
  ship.voyage = true; let v = Math.max(0, ship.speed || 0), done = false, seg = 0, maxDev = 0;
  const q = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  // 航线按 1 m 重采样成折线，好算「最近点」与「前方 lookahead 米」
  const line = [points[0].clone()];
  for (let i = 1; i < points.length; i++) { const n = Math.max(1, Math.ceil(points[i - 1].angleTo(points[i]) * R)); for (let k = 1; k <= n; k++) line.push(slerpDir(points[i - 1], points[i], k / n)); }
  const apply = () => { ship.carrier.matrix.copy(ship.parentInv).multiply(m4.makeRotationFromQuaternion(ship.rot)).multiply(ship.parentWorld); ship.carrier.matrixWorldNeedsUpdate = true; };
  return {
    get done() { return done; }, get maxDeviation() { return maxDev; }, line,
    update(dt) {
      if (done) return;
      const up = ship.posWorld.clone().normalize();
      // 最近点（只往前找，避免回头）
      let best = seg, bd = 1e9; for (let k = seg; k < Math.min(line.length, seg + 60); k++) { const d = up.angleTo(line[k]); if (d < bd) { bd = d; best = k; } }
      seg = best; maxDev = Math.max(maxDev, bd * R);
      const remain = line.length - 1 - seg;
      if (remain <= 2 && bd * R < 4) { done = true; v = 0; return; }
      const target = line[Math.min(line.length - 1, seg + lookahead)];
      const want = target.clone().sub(up).addScaledVector(up, -target.clone().sub(up).dot(up)).normalize();
      const cur = ship.bowWorld.clone().addScaledVector(up, -ship.bowWorld.dot(up)).normalize();
      let ang = Math.atan2(new THREE.Vector3().crossVectors(cur, want).dot(up), cur.dot(want));
      ang = THREE.MathUtils.clamp(ang, -turnRate * dt, turnRate * dt);
      q.setFromAxisAngle(up, ang); ship.rot.premultiply(q); ship.bowWorld.applyQuaternion(q);
      const align = Math.max(0.15, cur.dot(want));   // 船头没对准就慢下来先转
      v = Math.min(speed * align, v + dt * Math.max(1.5, speed * 0.15), Math.max(1.2, remain * 0.25));
      ship.speed = v;
      const axis = new THREE.Vector3().crossVectors(up, ship.bowWorld).normalize();
      q.setFromAxisAngle(axis, (v * dt) / ship.posWorld.length()); ship.rot.premultiply(q); ship.posWorld.applyQuaternion(q); ship.bowWorld.applyQuaternion(q);
      apply();
    },
  };
}

/**
 * 三版航线（2026-11-09 10:4x）：带状网格 A*。
 * 二版「大圆 + 侧向绕行」在苔庭—圣城之间（岛、高架、浅滩交错）失效：实测航线拉到 2962 m、42 段解不开。
 * 做法：沿起终点大圆铺一条带（纵向 step 米一格，横向 ±band 米），格点可走 = 船心与周围一圈 clearance 米（船宽一半 + 余量）都有水且无障碍；
 *   A*（8 邻接，按真实距离计费）找通路，再用视线检查（逐 2 m 复核走廊）把折线拉直；找不到就把带加宽重来一次。
 *   起点 / 终点本身（港内泊位、锚地）不要求一圈都有水，只要求船心有水，并允许离开起点的头两格放宽。
 */
export async function planVoyageAstar(solver, from, to, { step = 6, band = 150, clearance = 9, obstacles = null, yieldMs = 25, maxNodes = 60000 } = {}) {
  OBSTACLES = obstacles;
  let slice = performance.now(); const tick = async () => { if (performance.now() - slice > yieldMs) { await new Promise((r) => setTimeout(r, 0)); slice = performance.now(); } };
  const a = from.clone().normalize(), b = to.clone().normalize(), len = a.angleTo(b) * R;
  const fwdAt = (u) => slerpDir(a, b, Math.min(1, u + 1e-3)).sub(slerpDir(a, b, u)).normalize();
  const nx = Math.max(2, Math.ceil(len / step)), ny = Math.ceil(band / step);
  const node = (i, j) => { const u = i / nx, c = slerpDir(a, b, u), f = fwdAt(u), side = new THREE.Vector3().crossVectors(c, f).normalize(); return c.multiplyScalar(R).addScaledVector(side, j * step).normalize(); };
  const freeCache = new Map();
  const ring = [];
  for (let k = 0; k < 8; k++) ring.push([Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
  const free = (i, j) => {
    const key = i * 10000 + j; if (freeCache.has(key)) return freeCache.get(key);
    const p = node(i, j); let ok = wetAt(solver, p);
    const nearEnds = i <= 2 || i >= nx - 2;
    if (ok && !nearEnds) { const f = fwdAt(i / nx), s = new THREE.Vector3().crossVectors(p, f).normalize(); for (const [x, y] of ring) { if (!wetAt(solver, p.clone().multiplyScalar(R).addScaledVector(f, x * clearance).addScaledVector(s, y * clearance).normalize())) { ok = false; break; } } }
    freeCache.set(key, ok); return ok;
  };
  // A*
  const open = [{ i: 0, j: 0, g: 0, f: len, prev: null }], best = new Map([[0, 0]]); let found = null, visits = 0;
  while (open.length && visits < maxNodes) {
    if ((visits & 63) === 0) await tick();
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0]; visits++;
    if (cur.i === nx && cur.j === 0) { found = cur; break; }
    for (const [di, dj] of [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1], [-1, 0], [-1, 1], [-1, -1]]) {
      const i = cur.i + di, j = cur.j + dj; if (i < 0 || i > nx || Math.abs(j) > ny) continue;
      if (!(i === nx && j === 0) && !free(i, j)) continue;
      const g = cur.g + step * Math.hypot(di, dj), key = i * 10000 + j;
      if (best.has(key) && best.get(key) <= g) continue; best.set(key, g);
      open.push({ i, j, g, f: g + Math.hypot((nx - i) * step, j * step), prev: cur });
    }
  }
  if (!found) { OBSTACLES = null; return { points: [a, b], ok: false, visits, reason: visits >= maxNodes ? 'search-limit' : 'no-path', length: len }; }
  const raw = []; for (let n = found; n; n = n.prev) raw.push(node(n.i, n.j)); raw.reverse(); raw[0] = a.clone(); raw[raw.length - 1] = b.clone();
  // 拉直：从当前点往后找最远的、整段走廊都通的点
  const pts = [raw[0]]; let k = 0;
  while (k < raw.length - 1) {
    let far = k + 1;
    for (let m = Math.min(raw.length - 1, k + 40); m > k + 1; m--) { await tick(); const end = m === raw.length - 1 || k === 0; if (!segmentDry(solver, raw[k], raw[m], end ? 0 : clearance * 0.8)) { far = m; break; } }
    pts.push(raw[far]); k = far;
  }
  OBSTACLES = null;
  return { points: pts, ok: true, visits, rawPoints: raw.length, length: pts.slice(1).reduce((s, p, i) => s + pts[i].angleTo(p) * R, 0) };
}

/** 远航用障碍：默认可跨铁轨，忽略本船。 */
export function createVoyageObstacles(scene, opts = {}) {
  return createObstacleIndex(scene, { clear: 20, crossRails: true, ...opts });
}

/**
 * 书店镇 → 苔庭锚地：优先运行时 A*（可跨铁轨）；失败则回退到 BOOKSHOP_TO_MOSS_ROUTE 固化航点。
 * 返回 { points, length, ok, source, sailSec, speed }
 */
export async function planBookshopToMoss(solver, from, to, { shipId = 'lee', obstacles = null, speed = VOYAGE_TIMING.cruiseSpeedMps, ...rest } = {}) {
  const clearance = shipId === 'duke' ? 7 : 9;
  const plan = await planVoyageAstar(solver, from, to, { step: 8, band: 200, clearance, obstacles, maxNodes: 100000, ...rest });
  if (plan.ok && plan.points?.length >= 2) {
    return { ...plan, source: 'astar', speed, sailSec: plan.length / speed };
  }
  const table = shipId === 'duke' ? BOOKSHOP_TO_MOSS_ROUTE.duke : BOOKSHOP_TO_MOSS_ROUTE.lee;
  const pts = table.dirs.map((d) => new THREE.Vector3(d[0], d[1], d[2]).normalize());
  // 头尾换成本次实际起终点，避免泊位微移
  pts[0] = from.clone().normalize();
  pts[pts.length - 1] = to.clone().normalize();
  const length = pts.slice(1).reduce((s, p, i) => s + pts[i].angleTo(p) * R, 0);
  return { points: pts, ok: true, source: 'fixed-table', length, visits: 0, speed, sailSec: length / speed, fallbackFrom: plan.reason || 'astar-failed' };
}
