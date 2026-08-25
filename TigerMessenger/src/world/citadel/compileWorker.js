// =====================================================================
//  纯数据编译宿主（G10）：Worker 可选；无 Worker 时同步返回同一 payload
//  Worker 不得操作 Three.js。
// =====================================================================

import { compileCitadelV4 } from "./pipeline.js";
import { hashHex } from "../../core/rng.js";

export function compileCitadelV4Payload(blueprint, seed = 1) {
  const v4 = compileCitadelV4(blueprint, seed);
  const moduleIds = v4.town.cells.map((c) => c.module.id);
  const payload = {
    seed,
    moduleIds,
    uv: v4.uv.stats,
    graph: { nodes: v4.graph.nodes.size, edges: v4.graph.edges.size },
    fallback: v4.town.fallbackCount,
  };
  payload.hash = hashHex(JSON.stringify({ m: moduleIds, uv: payload.uv, g: payload.graph }));
  return payload;
}

export function createCompileHost() {
  return {
    async compile(blueprint, seed = 1) {
      if (typeof Worker === "undefined") return compileCitadelV4Payload(blueprint, seed);
      return compileCitadelV4Payload(blueprint, seed);
    },
  };
}
