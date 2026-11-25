/** 903647529203634176 "Spears are so weird to implement" —— 伤害数字（本轮补）。
 *
 *  逐帧（654 帧，第 46 轮全核 + 本轮原尺寸 0300 与 5 倍放大裁切 dmg-plus4-crop.png）：
 *   · 近战每挨一刀，被**实际打到的那一个**单位头顶跳一个白色「+4」（奶油白、约 8px 高、
 *     带一点深色投影，屏幕正立不倾斜、不随单位旋转）；
 *   · 挨得近的三个敌人几乎同时各跳一个「+4」，**不会合并成一个 +12** → 合并只能发生在同一单位身上；
 *   · 击杀另有金色「+10」飘字（839067977781768193）。第 60 轮起它走**同一个池**（kind='kill'），
 *     不再是 squad-hud 页里那套独立 canvas 飘字 —— 字号 / 描边 / 上浮 / 遮挡与 "+4" 一致，只换颜色。
 *
 *  所以这里的口径是「实际掉血多少 → 显示多少」：`damageValue()` 只读扣血前后的 hp，
 *  没掉血（被格挡 / 已死）就返回 0，不给数字。1 点血 = 片中那个 "+4"，是本仓本地词汇，
 *  不是原作数值表。
 */

/** 1 点血 = 片中的 "+4"（本地词汇，非原作数值）。 */
export const DMG_PER_HP = 4;

/** 击杀奖励（squad-hud 的 "+10"）：第 60 轮把它并进同一套飘字 —— 同池、同字号、同上浮、同遮挡。 */
export const KILL_VALUE = 10;

/** 一次命中的飘字数值：只按真实掉血算。 */
export function damageValue(hpBefore, hpAfter, per = DMG_PER_HP) {
  if (!Number.isFinite(hpBefore) || !Number.isFinite(hpAfter)) throw new RangeError('invalid hp');
  if (!Number.isFinite(per) || per <= 0) throw new RangeError('invalid per-hp value');
  const lost = hpBefore - hpAfter;
  if (!(lost > 0)) return 0;                 // 没掉血：不给数字
  return Math.max(1, Math.round(lost * per));
}

/**
 * 追加一条飘字。`kind='damage'` 只合并**同一个单位**在 mergeWindow 内的连续命中（连击 → "+8"），
 * 不同单位各自一条（片子里相邻三个敌人各跳各的 "+4"）。
 * `kind='kill'` 是击杀奖励 "+10"（第 60 轮并进来，原先只有 squad-hud 页里一套 canvas 飘字，和战斗里的 Sprite 池互不知情）；
 * 它按**距离**合并（同一瞬间被砍死的两个人才折成 "+20"），并且与伤害数字共用同一套字号 / 上浮 / 淡出。
 * `sx` 是横向错位：同帧多个飘字挨得太近时各让开一点，密集命中才不会叠成一坨。
 */
export function addDamageNumber(list, { unitId = -1, x = 0, y = 0, z = 0, value = 0, kind = 'damage' } = {}, { mergeWindow = 0.1, mergeRadius = 0.12, killRadius = 0.55 } = {}) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError('invalid damage value');
  if (kind !== 'damage' && kind !== 'kill') throw new RangeError('unknown damage kind');
  const radius = kind === 'kill' ? killRadius : mergeRadius;
  for (const p of list) {
    if (p.kind !== kind) continue;
    if (kind === 'damage' && p.unitId !== unitId) continue;      // 不同单位的伤害数字不合并
    if (p.age > mergeWindow) continue;
    if (Math.hypot(p.x - x, p.y - y, p.z - z) > radius) continue;
    p.value += value;
    p.text = '+' + p.value;
    p.age = 0;
    p.merges += 1;
    return p;
  }
  // 横向错位：先试正中；已被占则左右交替让开（最多 5 档）
  const crowded = (cand) => list.some((p) => p.age < 0.35 && Math.abs(p.x + (p.sx || 0) - (x + cand)) < 0.07 && Math.abs(p.z - z) < 0.07);
  let sx = 0;
  if (crowded(0)) {
    for (let k = 1; k <= 5; k++) {
      const cand = (k % 2 ? 1 : -1) * 0.06 * Math.ceil(k / 2);
      if (!crowded(cand)) { sx = cand; break; }
    }
  }
  const p = { unitId, x, y, z, y0: y, value, text: '+' + value, age: 0, merges: 1, kind, sx };
  list.push(p);
  return p;
}

/** 推进所有数字；返回本帧要画的快照（屏幕正立，靠 sprite 自身朝向相机）。 */
export function stepDamageNumbers(list, dt, { rise = 0.55, life = 0.9, fadeFrom = 0.45 } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('invalid dt');
  const out = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    p.y += rise * dt;
    if (p.age >= life) { list.splice(i, 1); continue; }
    const t = p.age / life;
    out.push({ ...p, alpha: t < fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / (1 - fadeFrom)), lifted: p.y - p.y0 });
  }
  return out;
}

/**
 * 第 56 批 C02（903647529203634176）：按受击方向甩一下 + 击杀 "+10" 独立上浮速度。
 * 只是给已有飘字加字段，不改 add/step 的旧口径（battle 默认不调用）。
 * kick：沿「攻击者 → 受击者」方向一个初速度，指数衰减，叠一小段阻尼抖动（片中数字是被打出来的，不是原地冒）。
 */
export function kickDamageNumber(p, dx, dz, { speed = 0.9, shake = 0.018 } = {}) {
  if (!p || ![dx, dz, speed, shake].every(Number.isFinite)) throw new RangeError('invalid kick');
  const l = Math.hypot(dx, dz);
  if (l < 1e-9) return p;
  p.kx = (dx / l) * speed; p.kz = (dz / l) * speed; p.kdx = dx / l; p.kdz = dz / l; p.shake = shake; p.kick0 = p.age;
  return p;
}
/** 每帧推进 kick 与击杀额外上浮（在 stepDamageNumbers 之后调用）。killRise 是**额外**的，"+10" 总上浮 = rise + killRise。 */
export function stepDamageKick(list, dt, { damp = 9, killRise = 0.35 } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('invalid dt');
  const k = Math.exp(-damp * dt);
  for (const p of list) {
    if (p.kind === 'kill') p.y += killRise * dt;
    if (p.kx === undefined) continue;
    p.x += p.kx * dt; p.z += p.kz * dt;
    p.kx *= k; p.kz *= k;
    // 抖动：沿受击方向的阻尼正弦，写进横向错位之外的 jx/jz（渲染时叠加）
    const a = p.age - (p.kick0 || 0), env = Math.exp(-a * 10);
    const j = Math.sin(a * 48) * p.shake * env;
    p.jx = p.kdx * j; p.jz = p.kdz * j;
  }
  return list;
}

/** 外观：伤害数字是奶油白 + 深色描边（片子里是带阴影的白字，不是纯 #fff 的硬白）；击杀奖励是金色。 */
export const DAMAGE_STYLE = Object.freeze({ fill: '#fff6e2', stroke: 'rgba(48,24,20,.85)', heightPx: 15, weight: 700 });
export const KILL_STYLE = Object.freeze({ fill: '#ffd23a', stroke: 'rgba(52,32,6,.88)', heightPx: 15, weight: 700 });
export const styleFor = (kind) => (kind === 'kill' ? KILL_STYLE : DAMAGE_STYLE);
