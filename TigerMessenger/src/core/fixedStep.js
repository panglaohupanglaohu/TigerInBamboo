// =====================================================================
//  固定步长时钟（PLAN V4 G0）
//  玩法只在 1/60 步进里更新；渲染用 alpha 插值，不改模拟状态。
//  纯数据，不依赖 three。
// =====================================================================

export const FIXED_STEP = 1 / 60;
export const FIXED_STEP_MAX_FRAME = 0.1;

/**
 * @param {{ step?: number, maxFrame?: number }} [opts]
 */
export function createFixedStepClock(opts = {}) {
  const step = Number.isFinite(opts.step) && opts.step > 0 ? opts.step : FIXED_STEP;
  const maxFrame =
    Number.isFinite(opts.maxFrame) && opts.maxFrame > 0 ? opts.maxFrame : FIXED_STEP_MAX_FRAME;
  let tick = 0;
  let accumulator = 0;
  return {
    get tick() {
      return tick;
    },
    get alpha() {
      return accumulator / step;
    },
    get step() {
      return step;
    },
    /**
     * @param {number} realDt
     * @param {(dt: number, tick: number) => void} onStep
     * @returns {number} 本帧执行的步进次数
     */
    advance(realDt, onStep) {
      const dt = Number.isFinite(realDt) ? realDt : 0;
      accumulator += Math.min(Math.max(0, dt), maxFrame);
      let n = 0;
      while (accumulator >= step) {
        onStep(step, tick);
        tick += 1;
        accumulator -= step;
        n += 1;
      }
      return n;
    },
    reset() {
      tick = 0;
      accumulator = 0;
    },
  };
}
