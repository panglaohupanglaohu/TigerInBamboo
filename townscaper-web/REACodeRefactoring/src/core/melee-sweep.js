/**
 * 第 55 批 G3 · REACode/src/combatfx.js 缺口：旋转武器扫掠、盾推力、3D 接触遮挡。
 *
 * 1022573208590057472 "The look and feel of the basic meat and potato melee combat is one of the things I'm most proud of"；
 * 870296307889573889 "Units can now get knocked off ledges"；903647529203634176（矛 = 世界里持续存在的线段，命中记 hitSet）。
 * 原版的矛是「一根线段在突刺窗口里平移」；斧 / 剑同理，只是线段绕握点**转**：
 *   · 扫掠：武器是 pivot→tip 的线段，在 duration 内从 a0 转到 a1。每帧扫过的扇形 [prev, cur] × [0, reach]
 *     里的敌人各命中一次（hitSet），快的大挥砍不会因为帧率跨过目标（连续判定，不是只看当帧角度）。
 *   · 3D 接触遮挡：每帧先查武器线段（胸高）有没有碰到实心体素（clear(a,b)），碰到 = 刃砍进墙里，扫掠就停在
 *     那个角度（clang），墙后的人不会被扫到；目标还要在武器那一层的高度带里（|dy| ≤ band）。
 *   · 盾推力：带盾的一方被正面（±shieldArc）打到时格挡：不掉血，攻击者被沿盾面法向推开 push（可能被推下崖，
 *     复用击退落崖那条路），格挡方只有很短的硬直；侧面 / 背后照常挨打。盾有冷却，连续挨打第二下挡不住。
 * 只返回结论，扣血 / 位移 / 落崖由 Battle 执行。
 */
const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU) % TAU;

/** dir: 朝向角（Battle 的 face = atan2(dx, dz)）。swing 从右肩扫到左肩：a0 = dir − arc/2 → a1 = dir + arc/2。 */
export function beginSweep(unit, dir, { reach = .3, arc = Math.PI * .85, duration = .26, side = 1 } = {}) {
  if (![dir, reach, arc, duration].every(Number.isFinite) || reach <= 0 || arc <= 0 || arc > TAU || duration <= 0) throw new RangeError('Invalid sweep');
  const a0 = dir - side * arc / 2, a1 = dir + side * arc / 2;
  return { a0, a1, angle: a0, prev: a0, age: 0, duration, reach, side, hitSet: new Set(), blockedAt: null, done: false, owner: unit };
}

/** 角 x 是否落在从 from 扫到 to（side 方向）的扇形里。 */
export function angleInSweep(x, from, to, side = 1) {
  const span = side * (to - from); if (span <= 0) return false;
  const d = wrap(side * (x - from));
  return d <= span + 1e-12;
}

/**
 * 推进一帧。units：候选；canHit(v)：阵营 / 状态过滤；clear(a, b)：两点间无实心（3D 遮挡），a/b = {x,y,z}。
 * 返回本帧命中的单位（每人每次挥砍最多一次）。
 */
export function stepSweep(sweep, units, dt, { canHit = () => true, clear = () => true, height = .1, band = .3, steps = 3 } = {}) {
  if (sweep.done) return [];
  const u = sweep.owner, prev = sweep.angle;
  sweep.age = Math.min(sweep.duration, sweep.age + dt);
  const k = sweep.age / sweep.duration, ease = k * k * (3 - 2 * k);   // 慢起快过慢收
  let cur = sweep.a0 + (sweep.a1 - sweep.a0) * ease;
  // 3D 接触遮挡：把本帧转过的角度细分，刃碰到实心就停在上一个干净角度
  const pivot = { x: u.x, y: u.y + height, z: u.z };
  for (let i = 1; i <= steps; i++) {
    const a = prev + (cur - prev) * i / steps, tip = { x: u.x + Math.sin(a) * sweep.reach, y: pivot.y, z: u.z + Math.cos(a) * sweep.reach };
    if (!clear(pivot, tip)) { cur = prev + (cur - prev) * (i - 1) / steps; sweep.blockedAt = cur; sweep.done = true; break; }
  }
  sweep.prev = prev; sweep.angle = cur;
  if (sweep.age >= sweep.duration) sweep.done = true;
  const hits = [];
  for (const v of units) {
    if (v === u || v.dead || sweep.hitSet.has(v) || !canHit(v)) continue;
    const dx = v.x - u.x, dz = v.z - u.z, d = Math.hypot(dx, dz), r = (v.radius ?? .055);
    if (d - r > sweep.reach || Math.abs(v.y - u.y) > band) continue;
    // 身体有半径：角度区间按 asin(r/d) 放宽
    const bearing = Math.atan2(dx, dz), pad = d > r ? Math.asin(Math.min(1, r / d)) : Math.PI;
    if (!angleInSweep(bearing, prev - sweep.side * pad, cur + sweep.side * pad, sweep.side)) continue;
    // 刃到目标那一下也要没被墙挡（目标在墙后：扫掠角到了，但刃根本碰不到）
    if (!clear(pivot, { x: v.x, y: v.y + height, z: v.z })) continue;
    sweep.hitSet.add(v); hits.push(v);
  }
  return hits;
}

/** 盾格挡判定：攻击来自防守方正面 ±arc/2、盾冷却好了、没在硬直里 → 挡下并给出推开向量。 */
export function shieldBlock(defender, attacker, { arc = Math.PI * .8, push = .09, cooldown = .9, now = 0 } = {}) {
  if (!defender.hasShield || defender.dead || defender.fall || (defender.stunRemaining ?? 0) > 0) return null;
  if ((defender.shieldReadyAt ?? -Infinity) > now) return null;
  const dx = attacker.x - defender.x, dz = attacker.z - defender.z, d = Math.hypot(dx, dz);
  if (d < 1e-9) return null;
  const facing = defender.face ?? 0, bearing = Math.atan2(dx, dz);
  let off = wrap(bearing - facing); if (off > Math.PI) off -= TAU;
  if (Math.abs(off) > arc / 2) return null;
  defender.shieldReadyAt = now + cooldown;
  return { nx: dx / d, nz: dz / d, push, off };
}
