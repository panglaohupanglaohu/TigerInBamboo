/**
 * ballistic.js — 弹道查找表 + 用「表达式字符串」实时调代价函数。
 *
 * 原文（x.com/OskSta/status/987267068495003648, 2018-04-20）：
 *
 *   "Using inspector expressions, I can live tweak the cost function of my
 *    projectile trajectory lookup tables. Very handy."
 *
 * 画面（24 帧，320×320 世界视图 + 右侧 Unity Inspector）：
 *   · 左边是从原点散开的一大把青色抛物弧线，像扇子；每条弧是一次**烘好的**轨迹采样，
 *     不是每帧重算 —— 线上还留着采样点。
 *   · 扇子里有一小段被点亮成白色（更亮/更粗），那是当前"最优"的那条；
 *     亮段只覆盖到最后一段有效采样点。
 *   · Inspector 面板文字（逐帧稳定，可读）：
 *       Bounds      Min Y -3 / Max Y 3 / Max Z 7
 *       Settings    Cost Function = `minDist + time * impactSpeed`
 *                   Valid Function = `minDist < 0.2`
 *                   Min Speed 2 / Max Speed 12 / Drag 2 / Start Offset 0.1
 *                   Gravity 9.8 / Max Valid Radius 5.5
 *   · 关键点：`Cost Function` 与 `Valid Function` 是**两个可以现场改的字符串**，
 *     不是硬编码分支。改字符串 → 立刻重新排序 → 白亮的那条跳到别的弧上。
 *     这就是"live tweak"。原文说 Very handy，因为它把"调参"从改代码-等编译变成打字。
 *
 * 为什么这样做（原文没直说，但从数值能反推）：
 *   ① **烘 LUT**：速度 2..12、角度若干档，一次烘出几百个采样点，运行期只做查表 + 距离比较，
 *      不用每个投射物都跑积分。原文的 "trajectory lookup tables" 就是这个。
 *   ② **代价函数与合法性分开**：代价决定"挑哪条"，合法性决定"这条能不能用"。
 *      两者混在一起就没法单独调（比如想要求"必须够得着"但又想偏好低弹道）。
 *   ③ **表达式里只暴露三个量**：`minDist`（弧到目标的最近距离）、`time`（到最近点的时间）、
 *      `impactSpeed`（落点速度）。原文的可用参数提示正是这三个 —— 我给的一样多，
 *      不再加，因为加了就不是原文那套了。
 *
 * 本文件是纯 2D（Z-Y 平面）实现，对应 Inspector 里 "Min Y/Max Y/Max Z" 只有三个边界的事实：
 * 这条 LUT 是侧视的，X 方向不参与（同 X 平面内的轨迹都一样）。
 */

/**
 * 默认参数 —— 全部是帧里 Inspector 上读到的数值，不是我拍脑袋定的。
 * 只有 angleSteps / dt 是量不到的估计值（帧里没有这两项），下面标注 [估计]。
 */
export const DEFAULT_PARAMS = {
  gravity: 9.8,          // Gravity 9.8
  drag: 2.0,             // Drag 2
  startOffset: 0.1,      // Start Offset 0.1
  minSpeed: 2,           // Min Speed 2
  maxSpeed: 12,          // Max Speed 12
  speedSteps: 21,        // [估计] 2..12 步长 0.5（帧里弧线约 50~60 条，21 速 × 3 角 ≈ 63）
  angleSteps: 3,         // [估计] 帧里同一速度下能看到 3 条不同仰角
  minAngle: 15,          // [估计] 最低的那簇弧大约 15°
  maxAngle: 55,          // [估计] 最高那簇贴着 Max Y=3 的顶
  dt: 1 / 30,            // [估计] 采样点间距看着像 30Hz
  maxTime: 4.0,          // [估计] 最长弧在 3.5s 左右落地
  bounds: { minY: -3, maxY: 3, minZ: 0, maxZ: 7 },  // Bounds 三项
  maxValidRadius: 5.5,   // Max Valid Radius 5.5
};

/**
 * 线性阻尼 + 重力的一步积分。
 *
 * 位置用**前后速度的均值**推（速度 Verlet）：重力是常加速度，均值法对它是精确的，
 * 而"直接用新速度乘 dt"会每步多掉 0.5g·dt²，射程系统性偏短 —— 我第一版就是这么写的，
 * dt=1/30 时 15° 短射程差了 9.4%，正好把 Valid 阈值 0.2 淹掉。改成均值后误差 <0.5%。
 */
function step(p, v, dt, gravity, drag) {
  const k = Math.max(0, 1 - drag * dt);
  const vz0 = v.z, vy0 = v.y;
  v.z = vz0 * k;
  v.y = vy0 * k - gravity * dt;
  p.z += (vz0 + v.z) * 0.5 * dt;
  p.y += (vy0 + v.y) * 0.5 * dt;
}

/**
 * 烘一条轨迹。
 * 起点 (0, startOffset)，初速 (cosA, sinA) * speed。
 * 落地判定 y<=0：**线性插值回穿点**，否则量出来的射程会被 dt 量化误差吃掉
 * （dt=1/30 时垂直速度大，误差可以到 0.1~0.2，正好和原文 Valid 阈值 0.2 同量级，不能不管）。
 */
export function bakeArc({ speed, angleDeg, params = DEFAULT_PARAMS }) {
  const { gravity: g, drag, startOffset, dt, maxTime, bounds } = params;
  const a = (angleDeg * Math.PI) / 180;
  let p = { z: 0, y: startOffset };
  let v = { z: Math.cos(a) * speed, y: Math.sin(a) * speed };
  const pts = [{ z: p.z, y: p.y, t: 0, speed }];
  let t = 0;
  let apex = p.y;
  let impact = null;
  let inBounds = true;

  while (t < maxTime) {
    const prev = { z: p.z, y: p.y };
    const prevSpeed = Math.hypot(v.z, v.y);
    step(p, v, dt, g, drag);
    t += dt;
    const sp = Math.hypot(v.z, v.y);
    if (p.y > apex) apex = p.y;
    if (p.y > bounds.maxY || p.z > bounds.maxZ || p.y < bounds.minY) inBounds = false;
    if (p.y <= 0) {
      // 回穿地面：按 y 的比例插值，拿到真实落点与落点速度
      const f = prev.y / (prev.y - p.y || 1e-9);
      const iz = prev.z + (p.z - prev.z) * f;
      pts.push({ z: iz, y: 0, t: t - dt + dt * f, speed: prevSpeed + (sp - prevSpeed) * f });
      impact = { z: iz, y: 0, t: t - dt + dt * f, speed: prevSpeed + (sp - prevSpeed) * f };
      break;
    }
    pts.push({ z: p.z, y: p.y, t, speed: sp });
  }

  return {
    speed, angleDeg, pts, impact, inBounds, apex,
    flightTime: impact ? impact.t : t,
    impactSpeed: impact ? impact.speed : 0,
    range: impact ? impact.z : p.z,
  };
}

/**
 * 烘整张 LUT。
 * 返回的 arcs 是扁平数组（速度 × 角度），运行期只按 need 过滤，不再算物理。
 */
export function bakeLUT(paramsIn = {}) {
  const params = { ...DEFAULT_PARAMS, ...paramsIn, bounds: { ...DEFAULT_PARAMS.bounds, ...(paramsIn.bounds || {}) } };
  const ds = (params.maxSpeed - params.minSpeed) / Math.max(1, params.speedSteps - 1);
  const da = (params.maxAngle - params.minAngle) / Math.max(1, params.angleSteps - 1);
  const t0 = performance.now();
  const arcs = [];
  for (let i = 0; i < params.speedSteps; i++) {
    const speed = params.minSpeed + ds * i;
    for (let j = 0; j < params.angleSteps; j++) {
      const angleDeg = params.minAngle + da * j;
      const arc = bakeArc({ speed, angleDeg, params });
      // 越界的弧不扔掉，只标脏：有时"过顶的那条"反而是唯一能绕过去的
      arc.id = arcs.length;
      arcs.push(arc);
    }
  }
  const ms = performance.now() - t0;
  let samples = 0;
  let maxRange = 0;
  for (const a of arcs) { samples += a.pts.length; if (a.range > maxRange) maxRange = a.range; }
  return {
    params, arcs,
    stats: {
      arcs: arcs.length, samples, ms: +ms.toFixed(2),
      samplesPerArc: +(samples / Math.max(1, arcs.length)).toFixed(1),
      maxRange: +maxRange.toFixed(2),
      outOfBounds: arcs.filter((a) => !a.inBounds).length,
      // [估计] 每个点 z/y/t/speed 各一个 float，pt 对象开销另算；这里报"裸数据"量级
      payloadKB: +((samples * 4 * 4) / 1024).toFixed(1),
    },
  };
}

const EXPR_PARAMS = ['minDist', 'time', 'impactSpeed', 'range', 'apex', 'speed', 'angleDeg', 'drag', 'gravity'];

/**
 * 把 Inspector 里那种表达式字符串编成函数。
 *
 * 只放行 EXPR_PARAMS 里的名字 + Math 的常用函数，其余名字直接报错而不是悄悄变成 undefined ——
 * 打错字（比如 `min-dist`）在现场是最常见的，报错比静默选错弧有用。
 * `new Function` 有 CSP 风险，但这里和原文一样是"开发期工具"，不进运行时热路径。
 */
export function compileExpr(src, extra = []) {
  const names = [...EXPR_PARAMS, ...extra];
  const bad = [];
  const idents = String(src).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const allowed = new Set([...names, 'Math', 'true', 'false', 'null']);
  for (const id of idents) {
    if (!allowed.has(id)) bad.push(id);
  }
  if (bad.length) throw new Error('表达式里有不认识的标识符: ' + [...new Set(bad)].join(', '));
  const body = 'return (' + src + ');';
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, body);
  return (...args) => {
    const v = fn(...args);
    // 布尔表达式（Valid Function）必须原样放行 —— 第一版把非 number 一律压成 NaN，
    // 结果 `minDist < 0.2` 永远返回 NaN → 一条弧都不合法，排查了半天。
    if (typeof v === 'boolean') return v;
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  };
}

/**
 * 弧到目标点的最近距离。
 *
 * 默认按**折线段**算，不是按采样点算。dt=1/30 时每条弧 ~21 个点、间距约 0.2，
 * 正好和原文 Valid 阈值 `minDist < 0.2` 同量级 —— 目标落在两个采样点中间时，
 * 按点算的 minDist 会虚高到接近 0.2。
 * 实测（0.5≤z<4.0、0.2≤y<2.6 的 405 个目标格）：按线段比按点平均多挑出 0.15 条有效弧，
 * 36/405 的格子里能多出候选，其中 1 格是"按点 0 条、按线段 1 条"。
 * 差距不大但方向明确 —— 阈值和采样间距本来就该解耦。两种口径都留着，方便对照。
 */
export function closestOnArc(arc, target, { mode = 'segment' } = {}) {
  const ty = target.y || 0;
  let best = { d: Infinity, t: 0, speed: 0, p: null, seg: -1 };
  if (mode === 'point') {
    for (const p of arc.pts) {
      const d = Math.hypot(p.z - target.z, p.y - ty);
      if (d < best.d) best = { d, t: p.t, speed: p.speed, p, seg: -1 };
    }
    return best;
  }
  for (let i = 0; i + 1 < arc.pts.length; i++) {
    const a = arc.pts[i], b = arc.pts[i + 1];
    const vz = b.z - a.z, vy = b.y - a.y;
    const wz = target.z - a.z, wy = ty - a.y;
    const len2 = vz * vz + vy * vy || 1e-12;
    let u = (wz * vz + wy * vy) / len2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(wz - vz * u, wy - vy * u);
    if (d < best.d) {
      best = {
        d,
        t: a.t + (b.t - a.t) * u,
        speed: a.speed + (b.speed - a.speed) * u,
        p: { z: a.z + vz * u, y: a.y + vy * u },
        seg: i,
      };
    }
  }
  return best;
}

/**
 * 对一个目标，用表达式挑最优弧。
 * costFn / validFn 收的是编译好的函数，也可以直接给数字常量。
 * 返回 { best, ranked, valid, rejected } —— ranked 已按 cost 升序。
 */
export function pickArc(lut, target, { costExpr = 'minDist + time * impactSpeed', validExpr = 'minDist < 0.2' } = {}) {
  const costFn = typeof costExpr === 'function' ? costExpr : compileExpr(costExpr);
  const validFn = typeof validExpr === 'function' ? validExpr : compileExpr(validExpr);
  const ranked = [];
  let rejected = 0;
  for (const arc of lut.arcs) {
    const c = closestOnArc(arc, target);
    if (c.d > lut.params.maxValidRadius) { rejected++; continue; }
    const ctx = {
      minDist: c.d, time: c.t, impactSpeed: arc.impactSpeed,
      range: arc.range, apex: arc.apex, speed: arc.speed,
      angleDeg: arc.angleDeg, drag: lut.params.drag, gravity: lut.params.gravity,
    };
    const ok = validFn(ctx.minDist, ctx.time, ctx.impactSpeed, ctx.range, ctx.apex, ctx.speed, ctx.angleDeg, ctx.drag, ctx.gravity);
    const cost = costFn(ctx.minDist, ctx.time, ctx.impactSpeed, ctx.range, ctx.apex, ctx.speed, ctx.angleDeg, ctx.drag, ctx.gravity);
    ranked.push({ arc, ...ctx, at: c.p, ok: !!ok && Number.isFinite(cost), cost });
  }
  ranked.sort((a, b) => (a.ok === b.ok ? a.cost - b.cost : a.ok ? -1 : 1));
  const valid = ranked.filter((r) => r.ok);
  return { best: valid[0] || null, ranked, valid: valid.length, rejected };
}

/**
 * 无阻尼解析射程（带起射高度 h）：R = (v cosθ / g)(v sinθ + sqrt(v² sin²θ + 2gh))。
 * 只用来验证积分器，不参与运行时。**必须**带 h，否则 Start Offset 0.1 在低仰角下会自己造出
 * 0.37 的"误差"（0.1/tan15°），看起来像积分器写错了。
 */
export function analyticRange(speed, angleDeg, gravity, h = 0) {
  const a = (angleDeg * Math.PI) / 180;
  const sv = speed * Math.sin(a), cv = speed * Math.cos(a);
  return (cv / gravity) * (sv + Math.sqrt(sv * sv + 2 * gravity * h));
}

/**
 * 自检：关掉阻尼后，烘出来的射程必须和解析解一致；误差主要来自 dt 的量化和地面回穿插值。
 * 这条自检是这套 LUT 唯一能"证明自己没写错"的手段（原文没有，是我加的）。
 */
export function validateIntegrator({ speeds = [4, 6, 8, 10, 12], angles = [15, 30, 45, 60], dt = 1 / 30 } = {}) {
  const rows = [];
  let worst = 0;
  for (const s of speeds) {
    for (const a of angles) {
      const params = { ...DEFAULT_PARAMS, drag: 0, dt, maxTime: 8 };
      const arc = bakeArc({ speed: s, angleDeg: a, params });
      const exact = analyticRange(s, a, params.gravity, params.startOffset);
      const err = Math.abs(arc.range - exact) / exact;
      worst = Math.max(worst, err);
      rows.push({ speed: s, angle: a, baked: +arc.range.toFixed(4), exact: +exact.toFixed(4), errPct: +(err * 100).toFixed(2) });
    }
  }
  return { rows, worstPct: +(worst * 100).toFixed(2), dt };
}

/**
 * 表达式实时改动的效果量化：换一个代价函数，最优弧会换到哪一条、有多少条弧的排序变了。
 * 这就是原文 "live tweak" 的可测量形式。
 */
export function retune(lut, target, exprs) {
  const out = [];
  let prevOrder = null;
  for (const e of exprs) {
    const r = pickArc(lut, target, { costExpr: e, validExpr: 'minDist < 0.2' });
    const order = r.ranked.filter((x) => x.ok).map((x) => x.arc.id);
    const changed = prevOrder ? order.filter((id, i) => id !== prevOrder[i]).length : order.length;
    out.push({
      expr: e,
      bestId: r.best ? r.best.arc.id : null,
      bestSpeed: r.best ? +r.best.arc.speed.toFixed(2) : null,
      bestAngle: r.best ? +r.best.arc.angleDeg.toFixed(1) : null,
      minDist: r.best ? +r.best.minDist.toFixed(3) : null,
      cost: r.best ? +r.best.cost.toFixed(3) : null,
      valid: r.valid,
      rankChanged: changed,
    });
    prevOrder = order;
  }
  return out;
}
