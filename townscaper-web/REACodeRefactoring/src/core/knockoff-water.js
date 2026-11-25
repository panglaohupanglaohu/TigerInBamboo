/**
 * knockoff-water.js — 击退出崖 → 空中翻滚 → 落水（2026-11-10 从待重构 REACode 搬入；2026-11-16 上游化为 opt-in 模块）
 *
 * opt-in：battle.js 只有 `view.knockoffWater === true` 才接这组函数；不接时行为与本仓旧版完全一致
 *   （近战击退 0.05、落水按 resolveFallLanding 标记死亡，没有水花 / drownStats / 矛轴推）。
 *
 * 来源：townscaper-web/REACode/src/combatfx.js（未改原文件），按 REACodeRefactoring battle.js 的单位接口改写：
 *   REACode 用 u.state = WALK/AIR/FALL/LAND/DROWN 状态机；Refactoring 只有 u.fall（{vx,vy,vz,from}）+ #fallStep，
 *   落地 / 摔死已有，缺的是「推到不可走的地方就掉」和「掉进水里 = 溺水」。这里只补这两样，外加长矛「顶着走」。
 *
 * [870296307889573889] "Units can now get knocked off ledges"
 *   关键不是加冲量，而是冲量把单位推到格子外时脚下没有落脚点 → 从 WALK 切到 AIRBORNE，重力接管、翻滚、落地或落水。
 *   combatfx.stepUnits：!world.walkable(x,z) → FALL；FALL 中 y < waterY − 0.2 → DROWN（掉到水面以下就结束，不用等到底）。
 *   combatfx.knockback：vy = 0.45·power（轻微上抛，让离地看得见），spin = (rand − 0.5)·9（翻滚）。
 * [903647529203634176] "Spears are so weird to implement"
 *   combatfx.thrust：命中后目标被沿矛方向「顶着走」而不是被弹开（t.vx += ux·push）。
 *
 * REA World 约定：格子 top = 0 即海（Bad North 岛外一圈都是水）；网格外也是海。水面 y = 0。
 */

/** 这个位置是不是水（网格外 = 海；top 0 = 海）。 */
export function isWaterAt(index, world, x, z) {
  const c = index.cellAt(x, z);
  return !c || world.top(c) <= 0;
}

/**
 * 挨打后的推移方向与距离。
 * 长矛（thrust 存在）：沿矛轴「顶着走」0.12；其他近战：沿两人连线后退 0.05（REA 原值）。
 */
export function hitShove(v, by, thrust) {
  if (thrust && Number.isFinite(thrust.dx)) return { nx: thrust.dx, nz: thrust.dz, dist: 0.12, spear: true };
  const dx = v.x - by.x, dz = v.z - by.z, d = Math.hypot(dx, dz) || 1;
  return { nx: dx / d, nz: dz / d, dist: 0.05, spear: false };
}

/**
 * 推完以后要不要掉下水：脚下已是水，或往推的方向再 0.3 是水。
 * 长矛顶到水边必掉（combatfx：推到不可走就 FALL，没有概率）；普通近战沿用 REA 崖边 60% 的手感。
 */
export function shouldFallIntoWater(index, world, v, shove, rnd = Math.random) {
  if (isWaterAt(index, world, v.x, v.z)) return true;
  if (!isWaterAt(index, world, v.x + shove.nx * 0.3, v.z + shove.nz * 0.3)) return false;
  return shove.spear ? true : rnd() < 0.6;
}

/** 起跳：combatfx.knockback 的上抛 + 翻滚，换成 REA 的 u.fall 结构。 */
export function beginKnockoff(v, shove, fromFloor, power = 2) {
  v.fall = { vx: shove.nx * 0.45 * power, vz: shove.nz * 0.45 * power, vy: 0.35 * power, from: fromFloor, spin: (Math.random() - 0.5) * 9, age: 0, water: true };
  return v.fall;
}

/** 入水：不留尸体、不流血（血滴会落在水面以下）；记一个溺水计时给表现层下沉用。 */
export function beginDrown(u) {
  u.fall = null;
  u.dead = true; u.hp = 0; u.stunRemaining = 0;
  u.drowned = true;
  u.drown = { t: 0, spin: (Math.random() - 0.5) * 2 };
  u.y = 0;
}

export const DROWN_SINK_SEC = 1.6;   // 下沉多久后不再画

/** 水花：两圈扩散白环（表现层用；pool 里的对象 {mesh, t}）。 */
export function stepSplashes(splashes, dt) {
  for (const s of splashes) {
    s.t += dt;
    const k = s.t / s.dur;
    s.mesh.visible = k < 1;
    if (k >= 1) continue;
    const r = s.r0 + (s.r1 - s.r0) * Math.sqrt(k);
    s.mesh.scale.set(r, r, r);
    s.mesh.material.opacity = 0.85 * (1 - k);
  }
}
