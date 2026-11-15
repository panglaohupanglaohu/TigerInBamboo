/**
 * fire-coupling.js — 火光 ↔ 烟体积耦合曲线（纯函数，无 three 依赖，node 可直接测）。
 *
 * 依据：837027901853810688（514 帧 / 32.885 fps，townscaper 式登陆战，小屋被点着）。
 *   第 86 轮量出的三条曲线（同一片、同一火源、逐帧像素统计）：
 *     · 烟像素   frame-0078 → 0084：5066 → 11777（**面积 2.30×**，t(0084)−t(0078)=0.180s）
 *     · 火光     frame-0084 峰 1987 → 0090 1155 → 0096 450（**0.180s 剩 58.1%、0.390s 剩 22.6%**）
 *   两条曲线**不同步**：火在 0.4s 内掉到两成，烟的体积却在前 0.18s 就翻了一倍多，之后不再回落。
 *   这正是原片观感——「一声爆燃把火点亮，烟被这一下顶起来，火先灭、烟不缩」。
 *
 * 为什么用折线表而不是拟合指数：三点拟合不出单一指数（0.180s 要 58.1% → τ≈0.332；
 *   0.390s 要 22.6% → τ≈0.263，差 26%）。硬套一个 τ 会在中段偏差 8–16%，
 *   所以这里直接存**实测点**线性插值，表尾（>0.390s）再按 e^{-t/τ_tail} 收尾。
 *   这样表内三个点与实测**严格相等**（测试按 0 容差断言），表外只保证单调衰减。
 *
 * 口径（供 smoke.js 使用）：
 *   light    —— 火光强度（1 = 爆燃当刻），驱动照明/自发光；
 *   sizeMul  —— 烟卡线性尺寸倍率（1 = 常态）；点火后 0.18s 到 1.494（面积 2.23×，实测 2.30×，差 3%）；
 *   area     —— sizeMul²，直接和「烟像素面积」那一条对照。
 */

/** 火光衰减：实测折线（秒 → 相对峰值）。首点必须 (0,1)。 */
const LIGHT_TABLE = Object.freeze([[0, 1], [0.18, 0.581], [0.39, 0.226]]);

export const FIRE_COUPLING = Object.freeze({
  // 表尾指数收尾：0.390s 之后继续衰减，0.78s ≈ 5%
  lightTailTau: 0.30,
  // 烟体积爬升时间常数（s）：单点实测 0.18s 到面积 2.30× → 线性 1.517×
  smokeTau: 0.06,
  // 烟线性尺寸上界：√2.30 − 1 = 0.517 → 取 0.52（面积 2.31×）
  smokeGain: 0.52,
  // 已存在的烟卡向当前倍率靠拢的时间常数（s）：让整条柱跟着一起变粗，而不是只有新生儿粗。
  // 0.40 实测只把覆盖面积推到 1.22×（原片 0.180s 就到 2.30×），整条柱太「懒」；
  // 收到 0.12 后 0.180s 卡片线性倍率到 1.38（面积 1.90×），差原片 17%。
  easeTau: 0.12,
  // 第 90 轮补的「爆燃团」：柱身变粗这条路在 alpha 覆盖面积上是**饱和**的（卡片互相重叠，
  // 尺寸 1.35× 只换来覆盖 1.40×）。原片 0084 那一帧多出来的那部分不是柱身变粗，
  // 是爆燃当刻另顶出一团新烟 —— 所以这里单独吐 count 张大卡（fm=sizeMul、寿命 lifeMul、
  // 在源点周围 radius 的圆环上错开、加一点抬升），把这团烟做成独立的一次性事件。
  // 第 91 轮：从「柱脚一大坨」改成分层的三组（原片 0084 多出来的那团不是一个球，
  // 是**整根柱同时在高度上膨开、顶上还有一卷**）。单层 18 张全部堆在 dy≈0.1–0.6，
  // 画面上就是柱脚一团胖蘑菇；分层后同口径 alpha 覆盖仍 ≈2.3×，但多出来的像素往上走了。
  // 层高 dy 用**世界单位**（fine 口径柱身 vyMin 0.55 × lifeMin 4.4 ≈ 2.4 单位 = 整柱高）。
  burst: Object.freeze({
    count: 16,       // 总张数（= 三组之和，见 burstPlan()）
    sizeMul: 2.80,   // 兼容字段：单层老口径用的线性尺寸（无 layers 时生效）
    radius: 0.46,    // 兼容字段：源点周围铺开的半径
    lift: 0.30,      // 兼容字段：抛起高度
    lifeMul: 0.55,   // 兼容字段
    riseMul: 0.65,   // 兼容字段
    layers: Object.freeze([
      // 柱脚：最大张、最粗，铺得最开（半格宽内）
      Object.freeze({ name: 'base', count: 7, sizeMul: 2.75, radius: 0.55, dy: 0.10, lifeMul: 0.55, riseMul: 0.62 }),
      // 柱身中段：细一档，沿高度接上去（补「整柱膨开」那一段）
      Object.freeze({ name: 'shaft', count: 5, sizeMul: 2.15, radius: 0.34, dy: 0.70, lifeMul: 0.60, riseMul: 0.70 }),
      // 顶部翻卷：最小张但升得最快、活得久一点，形成柱顶那一卷
      Object.freeze({ name: 'roll', count: 4, sizeMul: 1.80, radius: 0.28, dy: 1.35, lifeMul: 0.75, riseMul: 0.95 }),
    ]),
  }),
});

/** 爆燃团分层展开（纯函数，第 91 轮）：把 cfg.layers 归一成「每组要吐几张、多大、多高」。
 *  没给 layers 时退回第 90 轮的单层口径（count/sizeMul/radius/lift），老测试与老调用照样成立。 */
export function burstPlan(cfg = FIRE_COUPLING.burst) {
  const layers = Array.isArray(cfg?.layers) && cfg.layers.length
    ? cfg.layers.map((l) => ({
        name: l.name ?? 'layer',
        count: Math.max(0, Math.round(l.count ?? 0)),
        sizeMul: l.sizeMul ?? 1,
        radius: l.radius ?? 0,
        dy: l.dy ?? 0,
        lifeMul: l.lifeMul ?? 1,
        riseMul: l.riseMul ?? 1,
      }))
    : [{
        name: 'single',
        count: Math.max(0, Math.round(cfg?.count ?? 0)),
        sizeMul: cfg?.sizeMul ?? 1,
        radius: cfg?.radius ?? 0,
        dy: cfg?.lift ?? 0,
        lifeMul: cfg?.lifeMul ?? 1,
        riseMul: cfg?.riseMul ?? 1,
      }];
  const total = layers.reduce((a, l) => a + l.count, 0);
  const dys = layers.filter((l) => l.count > 0).map((l) => l.dy);
  const sizes = layers.filter((l) => l.count > 0).map((l) => l.sizeMul);
  return {
    layers,
    total,
    yMin: dys.length ? Math.min(...dys) : 0,
    yMax: dys.length ? Math.max(...dys) : 0,
    sizeMin: sizes.length ? Math.min(...sizes) : 1,
    sizeMax: sizes.length ? Math.max(...sizes) : 1,
  };
}

/** 火光强度：t（秒，自点火起算）→ 相对峰值。表内严格等于实测点，表外指数收尾。 */
export function fireLight(t) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError('Invalid fire time');
  const T = LIGHT_TABLE;
  if (t <= T[T.length - 1][0]) {
    for (let i = 1; i < T.length; i++) {
      if (t === T[i][0]) return T[i][1];      // 端点直接返回实测值，避免插值浮点误差（测试零容差断这点）
      if (t < T[i][0]) {
        const [t0, v0] = T[i - 1], [t1, v1] = T[i];
        const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * k;
      }
    }
  }
  const [tEnd, vEnd] = T[T.length - 1];
  return vEnd * Math.exp(-(t - tEnd) / FIRE_COUPLING.lightTailTau);
}

/** 烟卡线性尺寸倍率：1 → 1 + smokeGain（单调不减，火灭了也不缩）。 */
export function smokeSizeMul(t) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError('Invalid fire time');
  const { smokeGain, smokeTau } = FIRE_COUPLING;
  return 1 + smokeGain * (1 - Math.exp(-t / smokeTau));
}

/** 一次取全：{ t, light, sizeMul, area }。area = sizeMul²，与「烟像素面积」同口径。 */
export function igniteCurve(t) {
  const sizeMul = smokeSizeMul(t);
  return { t, light: fireLight(t), sizeMul, area: sizeMul * sizeMul };
}

/** 已存在烟卡的单帧靠拢（指数缓动）：给定当前倍率、目标倍率与 dt，返回新倍率。 */
export function easeSizeMul(cur, target, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid timestep');
  if (!Number.isFinite(cur) || !Number.isFinite(target)) throw new RangeError('Invalid size multiplier');
  const k = 1 - Math.exp(-dt / FIRE_COUPLING.easeTau);
  return cur + (target - cur) * k;
}

export const FIRE_COUPLING_TABLE = LIGHT_TABLE;
