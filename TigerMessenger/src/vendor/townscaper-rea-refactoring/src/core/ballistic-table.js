/** Shared zero-drag table from the existing Battle implementation.
 * Cost weight is editable, but not the original Inspector expression language.
 * Quantization selects an angle; velocity/time are solved for the exact target.
 */
export const PROJECTILE_GRAVITY=6;
export function createBallisticTable({impactWeight=.6}={}){
 if(!Number.isFinite(impactWeight)||impactWeight<0||impactWeight>4)throw new RangeError('impact weight must be 0..4');
 const solve=(dx,dy,th)=>{const c=Math.cos(th),den=2*c*c*(dx*Math.tan(th)-dy);if(den<=0||dx<.05)return null;const v=Math.sqrt(PROJECTILE_GRAVITY*dx*dx/den);if(v>9)return null;const time=dx/(v*c),impact=Math.atan2(PROJECTILE_GRAVITY*time-v*Math.sin(th),v*c),cost=time+impactWeight*Math.abs(impact-Math.PI/4);return{th,v,time,cost};};
 const best=(dx,dy)=>{let out=null;for(let a=10;a<=80;a+=2){const shot=solve(dx,dy,a*Math.PI/180);if(shot&&(!out||shot.cost<out.cost))out=shot;}return out;};
 const table=new Map();for(let d=0;d<=60;d++)for(let h=-30;h<=30;h++)table.set(d*100+h,best(d*.1,h*.1));
 return Object.freeze({impactWeight,lookup(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy)||dx<.05||dx>6||Math.abs(dy)>3)return null;const bin=table.get(Math.round(dx*10)*100+Math.round(dy*10));const shot=(bin&&solve(dx,dy,bin.th))||best(dx,dy);return shot?Object.freeze(shot):null;}});
}
export const defaultBallisticTable=createBallisticTable();

/* ------------------------------------------------------------------------------------------------
 * 第 53 批（G5）：987267068495003648 "Using inspector expressions, I can live tweak the cost function of my
 * projectile trajectory lookup tables"。REACode/src/ballistic.js 的三件事迁到共享弹道：
 *   ① 表达式字符串（Cost / Valid 两条，彼此独立）——白名单标识符，打错字直接报错，不静默选错弧；
 *   ② 烘好的轨迹表（速度 × 仰角），带线性阻力 drag，速度 Verlet 均值积分（原版修过的那一处）；
 *   ③ 候选列表（ranked），供页面画「一把扇子 + 最优那条」。
 * Battle 默认仍用上面的无阻力解析表；只有把 battle.projectileTable 换成这里的表时，箭才按烘好的折线飞
 * （projectileState 两种 shot 都认）。
 * ---------------------------------------------------------------------------------------------- */
export const BALLISTIC_EXPR_PARAMS = Object.freeze(['minDist', 'time', 'impactSpeed', 'range', 'apex', 'speed', 'angleDeg', 'drag', 'gravity']);
export function compileBallisticExpr(src) {
  if (typeof src !== 'string' || !src.trim()) throw new TypeError('expression string required');
  if (/[;{}\[\]=`'"\\]|=>|\bnew\b|\bthis\b/.test(src.replace(/[<>!=]=|&&|\|\|/g, ' '))) throw new Error('表达式里有不允许的语法: ' + src);
  const allowed = new Set([...BALLISTIC_EXPR_PARAMS, 'Math', 'true', 'false', 'abs', 'min', 'max', 'sqrt', 'pow', 'PI', 'exp', 'log', 'cos', 'sin', 'atan2']);
  const idents = src.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  const bad = [...new Set(idents.filter((id, i) => !allowed.has(id) && !(i > 0 && src.includes('Math.' + id))))];
  if (bad.length) throw new Error('表达式里有不认识的标识符: ' + bad.join(', '));
  // eslint-disable-next-line no-new-func
  const fn = new Function(...BALLISTIC_EXPR_PARAMS, '"use strict";return (' + src + ');');
  return (ctx) => {
    const v = fn(...BALLISTIC_EXPR_PARAMS.map((k) => ctx[k]));
    if (typeof v === 'boolean') return v;           // Valid 表达式原样放行（原版第一版把布尔压成 NaN 的坑）
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  };
}

/** 一条烘好的轨迹：起点 (0,0)，水平 h / 竖直 y，速度 Verlet（前后速度均值推位置，重力项精确）。 */
export function bakeBallisticArc({ speed, angleDeg, gravity = PROJECTILE_GRAVITY, drag = 0, dt = 1 / 60, maxTime = 4, minY = -3.2 }) {
  if (![speed, angleDeg, gravity, drag, dt, maxTime].every(Number.isFinite) || speed <= 0 || gravity <= 0 || drag < 0 || dt <= 0 || maxTime <= 0) throw new RangeError('invalid arc');
  const a = angleDeg * Math.PI / 180, k = Math.max(0, 1 - drag * dt);
  let h = 0, y = 0, vh = Math.cos(a) * speed, vy = Math.sin(a) * speed, t = 0, apex = 0;
  const pts = [{ h, y, t, vh, vy }];
  while (t < maxTime && y > minY) {
    const vh0 = vh, vy0 = vy;
    vh = vh0 * k; vy = vy0 * k - gravity * dt;
    h += (vh0 + vh) * .5 * dt; y += (vy0 + vy) * .5 * dt; t += dt;
    if (y > apex) apex = y;
    pts.push({ h, y, t, vh, vy });
  }
  return { speed, angleDeg, gravity, drag, pts, apex, range: h };
}

/** 折线最近点（按线段，不按采样点；原版实测阈值与采样间距同量级时按点会虚高）。 */
function closestOnBakedArc(arc, dx, dy) {
  let best = { d: Infinity, t: 0, i: 0, u: 0 };
  const P = arc.pts;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], vz = b.h - a.h, vy = b.y - a.y, wz = dx - a.h, wy = dy - a.y;
    if (a.h > dx + .5 && b.h > dx + .5) break;
    const l2 = vz * vz + vy * vy || 1e-12;
    const u = Math.max(0, Math.min(1, (wz * vz + wy * vy) / l2)), d = Math.hypot(wz - vz * u, wy - vy * u);
    if (d < best.d) best = { d, t: a.t + (b.t - a.t) * u, i, u };
  }
  return best;
}

export function createExpressionBallisticTable({
  costExpr = 'minDist + time * impactSpeed * 0.05', validExpr = 'minDist < 0.06',
  gravity = PROJECTILE_GRAVITY, drag = 0, minSpeed = 1, maxSpeed = 9, speedSteps = 33,
  minAngle = 8, maxAngle = 80, angleSteps = 37, dt = 1 / 60, maxTime = 4, maxValidRadius = 1.5,
} = {}) {
  const cost = compileBallisticExpr(costExpr), valid = compileBallisticExpr(validExpr);
  if (![minSpeed, maxSpeed, minAngle, maxAngle, maxValidRadius].every(Number.isFinite) || minSpeed <= 0 || maxSpeed < minSpeed || !Number.isInteger(speedSteps) || !Number.isInteger(angleSteps) || speedSteps < 1 || angleSteps < 1 || speedSteps * angleSteps > 4096) throw new RangeError('invalid table bounds');
  const arcs = [];
  for (let i = 0; i < speedSteps; i++) for (let j = 0; j < angleSteps; j++) {
    const speed = minSpeed + (maxSpeed - minSpeed) * (speedSteps > 1 ? i / (speedSteps - 1) : 0);
    const angleDeg = minAngle + (maxAngle - minAngle) * (angleSteps > 1 ? j / (angleSteps - 1) : 0);
    const arc = bakeBallisticArc({ speed, angleDeg, gravity, drag, dt, maxTime }); arc.id = arcs.length; arcs.push(arc);
  }
  const cache = new Map();
  const rank = (dx, dy) => {
    const out = [];
    for (const arc of arcs) {
      if (arc.range < dx - maxValidRadius) continue;
      const c = closestOnBakedArc(arc, dx, dy);
      if (c.d > maxValidRadius) continue;
      const a = arc.pts[c.i], b = arc.pts[c.i + 1] ?? a, vh = a.vh + (b.vh - a.vh) * c.u, vy = a.vy + (b.vy - a.vy) * c.u;
      const ctx = { minDist: c.d, time: c.t, impactSpeed: Math.hypot(vh, vy), range: arc.range, apex: arc.apex, speed: arc.speed, angleDeg: arc.angleDeg, drag, gravity };
      const ok = valid(ctx) === true, k = cost(ctx);
      out.push({ arc, ...ctx, ok: ok && Number.isFinite(k), cost: k });
    }
    out.sort((p, q) => (p.ok === q.ok ? p.cost - q.cost : p.ok ? -1 : 1));
    return out;
  };
  const toShot = (r) => {
    const arc = r.arc, T = r.time;
    return Object.freeze({ th: arc.angleDeg * Math.PI / 180, v: arc.speed, time: T, cost: r.cost, minDist: r.minDist, impactSpeed: r.impactSpeed, drag, arcId: arc.id,
      sample(tt) { return sampleBakedArc(arc, Math.max(0, Math.min(T, tt))); } });
  };
  return Object.freeze({
    costExpr, validExpr, drag, gravity, arcs,
    stats: Object.freeze({ arcs: arcs.length, samples: arcs.reduce((s, a) => s + a.pts.length, 0), maxRange: Math.max(...arcs.map((a) => a.range)) }),
    /** 候选（已按 Valid 优先、Cost 升序）：页面画扇子用；limit 截断。 */
    candidates(dx, dy, limit = 64) { if (![dx, dy].every(Number.isFinite)) return []; return rank(dx, dy).slice(0, limit).map((r) => ({ arcId: r.arc.id, speed: r.speed, angleDeg: r.angleDeg, minDist: r.minDist, time: r.time, impactSpeed: r.impactSpeed, cost: r.cost, ok: r.ok })); },
    /** accept(shot)=>bool：逐条候选过滤（Validity 契约用）。缓存的是 2cm 格里的 ranked 合法弧列表；
     *  最近点按真实目标重算（弧不变，到点时间跟着目标走），重算后 Valid 仍要真过，accept 再挑第一条放得行的。 */
    lookup(dx, dy, accept) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx < .05 || dx > 6.5 || Math.abs(dy) > 3) return null;
      const key = Math.round(dx * 50) + ':' + Math.round(dy * 50);
      let list = cache.get(key);
      if (list === undefined) { list = rank(dx, dy).filter((r) => r.ok).slice(0, 16); if (cache.size > 20000) cache.clear(); cache.set(key, list); }
      for (const r of list) {
        const c = closestOnBakedArc(r.arc, dx, dy);
        const ctx = { ...r, minDist: c.d, time: c.t };
        if (valid(ctx) !== true) continue;
        const shot = toShot(ctx);
        if (accept && !accept(shot)) continue;
        return shot;
      }
      return null;
    },
  });
}

export function sampleBakedArc(arc, t) {
  const P = arc.pts;
  let lo = 0, hi = P.length - 1;
  if (t <= 0) return { h: 0, y: 0, vh: P[0].vh, vy: P[0].vy };
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (P[m].t <= t) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
  return { h: a.h + (b.h - a.h) * u, y: a.y + (b.y - a.y) * u, vh: a.vh + (b.vh - a.vh) * u, vy: a.vy + (b.vy - a.vy) * u };
}

/** 箭在飞行时间 T 的世界位置 + 朝向参考点。无阻力解析 shot 与烘表 shot（带 sample）通用。 */
export function projectileState(from, to, shot, T, gravity = PROJECTILE_GRAVITY) {
  const dirx = to[0] - from[0], dirz = to[2] - from[2], dl = Math.hypot(dirx, dirz) || 1, ux = dirx / dl, uz = dirz / dl;
  if (typeof shot.sample === 'function') {
    const s = shot.sample(T);
    const x = from[0] + ux * s.h, y = from[1] + s.y, z = from[2] + uz * s.h;
    return { x, y, z, look: [x + ux * s.vh, y + s.vy, z + uz * s.vh] };
  }
  const t = shot.time > 0 ? T / shot.time : 1;
  const x = from[0] + dirx * t, z = from[2] + dirz * t;
  const vx0 = shot.v * Math.cos(shot.th), vy0 = shot.v * Math.sin(shot.th);
  const y = from[1] + vy0 * T - .5 * gravity * T * T;
  return { x, y, z, look: [x + ux * vx0, y + (vy0 - gravity * T), z + uz * vx0] };
}

/* ------------------------------------------------------------------------------------------------
 * 987267068495003648 补学（TigerMessenger 补学队列）：Validity 契约 —— 「什么算一条合法弹道」。
 * 原 Inspector 的 Valid 表达式只管「弧线离目标够不够近」，不管世界语义；这里补三件原作里就有的判据：
 *   ① 射程环：水平距离必须落在 [minRange, maxRange]（Bad North 弓手内外圈，太近不射、超程不射）；
 *   ② 遮挡：沿弧线按 projectileState 采样，任一点落进 blockedAt 就判 occluded
 *      （高抛弧可以越过矮墙，所以契约是「逐条弧判」，不是「一条视线判」——配合表达式表的 accept 换弧）；
 *   ③ 落点有效：groundAt 给出目标处地表高度，与瞄准点差超过 landingTolerance（或根本没有地表）即拒。
 * 契约与真实目标/碰撞校验是两层：它只在「射前」拦，不替换飞行中的 clearSegment 与落点命中判定。
 * ---------------------------------------------------------------------------------------------- */
export function createShotContract({ minRange = 0, maxRange = Infinity, blockedAt = null, groundAt = null, landingTolerance = .3, samples = 32 } = {}) {
  if (!Number.isFinite(minRange) || minRange < 0 || !(maxRange > minRange)) throw new RangeError('invalid range ring');
  if (!(landingTolerance >= 0) || !Number.isFinite(landingTolerance)) throw new RangeError('landingTolerance must be >= 0');
  if (!Number.isInteger(samples) || samples < 4 || samples > 512) throw new RangeError('samples must be an integer 4..512');
  if (blockedAt != null && typeof blockedAt !== 'function') throw new TypeError('blockedAt must be a function');
  if (groundAt != null && typeof groundAt !== 'function') throw new TypeError('groundAt must be a function');
  const validate = (from, to, shot, gravity = PROJECTILE_GRAVITY) => {
    if (!from || !to || ![from[0], from[1], from[2], to[0], to[1], to[2]].every(Number.isFinite)) return { ok: false, reason: 'invalid-input' };
    if (!shot || !(shot.time > 0)) return { ok: false, reason: 'no-solution' };
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    if (dist < minRange) return { ok: false, reason: 'inside-min-ring', dist };
    if (dist > maxRange) return { ok: false, reason: 'beyond-max-ring', dist };
    if (groundAt) {
      const g = groundAt(to[0], to[2]);
      if (!Number.isFinite(g) || Math.abs(to[1] - g) > landingTolerance) return { ok: false, reason: 'bad-landing', ground: Number.isFinite(g) ? g : null };
    }
    if (blockedAt) {
      for (let i = 1; i < samples; i++) {           // 端点不采：出射点贴着弓手自己、落点贴着目标/地面
        const T = shot.time * i / samples, p = projectileState(from, to, shot, T, gravity);
        if (blockedAt(p.x, p.y, p.z)) return { ok: false, reason: 'occluded', at: { x: p.x, y: p.y, z: p.z }, t: T };
      }
    }
    return { ok: true, dist };
  };
  return Object.freeze({ minRange, maxRange, landingTolerance, samples, validate });
}

/** 查表 + 契约一站完成。表达式表的 lookup(dx,dy,accept) 会按 accept 逐条候选过滤（墙挡住低抛就换高抛）；
 *  解析表等不认第三参的表：取回唯一解后兜底再验一次，契约照样生效，只是没有备选弧可换。 */
export function pickBallisticShot(table, dx, dy, accept) {
  if (!table || typeof table.lookup !== 'function') return null;
  const shot = table.lookup(dx, dy, accept);
  return shot && (!accept || accept(shot)) ? shot : null;
}
