// =====================================================================
// mixed-source guard（V7-G10，TODO 1243）
// V7 visual 与 V6/legacy collision/nav 混用是非法混合态：数据层判定
// 函数 + overlay 所需结构化错误；渲染侧只负责展示 overlay 内容。
// =====================================================================

export const SNAPSHOT_SOURCE_ENGINES = Object.freeze(["v7", "v6", "legacy"]);

/**
 * sources: { visual, collision, nav }，取值 v7 / v6 / legacy。
 * 非法组合：V7 画面配非 V7 碰撞/导航；V6 画面配 legacy 碰撞/导航；
 * collision 与 nav 不同源。
 */
export function checkSourceMix(sources = {}) {
  const { visual, collision, nav } = sources;
  for (const [role, value] of Object.entries({ visual, collision, nav })) {
    if (!SNAPSHOT_SOURCE_ENGINES.includes(value)) throw new Error(`unknown source for ${role}: ${value}`);
  }
  const reasons = [];
  if (visual === "v7" && (collision !== "v7" || nav !== "v7")) reasons.push("V7 画面不得搭配 V6/legacy 碰撞/导航");
  if (visual === "v6" && (collision === "legacy" || nav === "legacy")) reasons.push("V6 画面不得搭配 legacy 碰撞/导航");
  if (collision !== nav) reasons.push("collision 与 nav 必须同源");
  if (!reasons.length) return { ok: true, error: null };
  return {
    ok: false,
    error: {
      code: "mixed-source",
      message: `mixed-source: visual=${visual} collision=${collision} nav=${nav}`,
      sources: Object.freeze({ visual, collision, nav }),
      overlay: Object.freeze({
        title: "Snapshot 数据源混用",
        lines: Object.freeze([`visual=${visual}`, `collision=${collision}`, `nav=${nav}`, ...reasons]),
        blocking: true,
      }),
    },
  };
}

export function assertCompatibleSources(sources) {
  const check = checkSourceMix(sources);
  if (!check.ok) {
    const error = new Error(check.error.message);
    error.code = check.error.code;
    error.sources = check.error.sources;
    error.overlay = check.error.overlay;
    throw error;
  }
  return true;
}
