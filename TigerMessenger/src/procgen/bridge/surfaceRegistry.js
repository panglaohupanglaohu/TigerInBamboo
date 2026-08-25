// =====================================================================
// Surface 命名空间合并与共享 mesh 绑定（V7-G9，TODO 1220/1222）
// MC triangle surfaces 与 module semantic surfaces 合并进同一注册表，
// ID 强制带命名空间前缀，稳定且不重复；provider/visual/collision 默认
// 引用同一份 snapshot mesh data（同引用，不复制）。
// =====================================================================

import { createSurfaceProviderFromIndexedMesh } from "./surfaceProvider.js";

/**
 * 合并多来源 surface ID。sources: [{ namespace, ids }]；
 * 裸 ID 自动补 `${namespace}:` 前缀，重复 ID 计入 duplicates。
 * 输出顺序 = 输入顺序（纯函数，同输入同输出，ID 稳定）。
 */
export function mergeSurfaceNamespaces(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error("surface namespace sources required");
  const seen = new Set();
  const merged = [];
  const duplicates = [];
  for (const source of sources) {
    const namespace = source?.namespace;
    if (!/^[a-z0-9-]+$/.test(namespace || "")) throw new Error(`invalid surface namespace: ${namespace}`);
    for (const raw of source.ids || []) {
      const id = String(raw).startsWith(`${namespace}:`) ? String(raw) : `${namespace}:${raw}`;
      if (seen.has(id)) { duplicates.push(id); continue; }
      seen.add(id);
      merged.push(id);
    }
  }
  return { ok: duplicates.length === 0, ids: Object.freeze(merged), duplicates: Object.freeze(duplicates), count: merged.length };
}

/**
 * 由 MC chunk 与 module semantic surfaces 构造合并注册表：
 * MC → `mc:<chunkId>:<triIndex>`；module → `mod:<moduleId>:<surfaceId>`。
 */
export function mergeMcAndModuleSurfaces({ mc = [], modules = [] } = {}) {
  const sources = [];
  for (const chunk of mc) {
    const ids = [];
    for (let t = 0; t < (chunk.triangleCount ?? 0); t++) ids.push(`mc:${chunk.chunkId}:${t}`);
    sources.push({ namespace: "mc", ids });
  }
  for (const module of modules) {
    sources.push({ namespace: "mod", ids: (module.surfaces || []).map((surface) => `mod:${module.moduleId}:${surface.id ?? surface}`) });
  }
  return mergeSurfaceNamespaces(sources);
}

/** provider / visual / collision 绑定同一份 snapshot mesh data（同引用）。 */
export function createSharedMeshBindings(meshData, providerOptions = {}) {
  if (!meshData?.positions || !meshData?.indices) throw new Error("shared mesh data positions/indices required");
  const provider = createSurfaceProviderFromIndexedMesh(meshData, providerOptions);
  return Object.freeze({
    mesh: meshData,
    provider,
    visual: Object.freeze({ role: "visual", mesh: meshData }),
    collision: Object.freeze({ role: "collision", mesh: meshData }),
  });
}

/** 同引用断言：任何一路复制/替换 mesh 都视为破坏单一真源。 */
export function assertSharedMeshData(bindings) {
  const problems = [];
  if (bindings?.visual?.mesh !== bindings?.mesh) problems.push("visual");
  if (bindings?.collision?.mesh !== bindings?.mesh) problems.push("collision");
  if (bindings?.provider?.mesh !== bindings?.mesh) problems.push("provider");
  if (bindings?.provider?.positions !== bindings?.mesh?.positions) problems.push("provider-positions");
  if (problems.length) {
    const error = new Error(`snapshot mesh not shared: ${problems.join(",")}`);
    error.code = "mesh-not-shared";
    error.problems = problems;
    throw error;
  }
  return true;
}
