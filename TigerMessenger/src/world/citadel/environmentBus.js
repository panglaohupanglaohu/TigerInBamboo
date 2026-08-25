// =====================================================================
//  环境状态发布：昼夜/天气只读；音频按 surface 语义订阅（G8/G11）
// =====================================================================

import { createEventBus } from "../../core/eventBus.js";
import { finalColor, torchFlicker } from "./visualTheme.js";

export function createEnvironmentBus() {
  const bus = createEventBus();
  let state = { weather: "clear", timeBand: "day", timeOfDay: 0.5 };
  return {
    get state() {
      return { ...state };
    },
    set(next) {
      state = { ...state, ...next };
      bus.emit("environment", state);
    },
    on: bus.on,
    color(token) {
      return finalColor(token, state);
    },
    footstep(semantic) {
      if (semantic === "waterfall" || semantic === "shore") return "wet";
      if (semantic === "cell" || semantic === "building") return "stone";
      return "grass";
    },
    torch(tick, seed) {
      return torchFlicker(tick, seed);
    },
  };
}
