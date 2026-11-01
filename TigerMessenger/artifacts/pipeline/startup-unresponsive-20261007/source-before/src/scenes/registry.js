// =====================================================================
//  场景注册表 + 加载器
//  - 新场景：写 scenes/<id>.js，在此 register
//  - URL：?scene=messenger,saihoji  或  ?scene=saihoji
//  - 默认：messenger + saihoji（送信岛 + 苔寺景观）
// =====================================================================
import { messengerIslandScene } from "./messengerIsland.js";
import { saihojiGardenScene } from "./saihojiGarden.js";

/** @type {Map<string, import("./sceneApi.js").SceneModule>} */
const REGISTRY = new Map();

function register(mod) {
  if (!mod?.id || typeof mod.load !== "function") {
    throw new Error(`[scene] invalid module: ${mod?.id}`);
  }
  REGISTRY.set(mod.id, mod);
}

register(messengerIslandScene);
register(saihojiGardenScene);

export function listScenes() {
  return [...REGISTRY.values()].map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description || "",
  }));
}

export function getSceneModule(id) {
  return REGISTRY.get(id) || null;
}

/** 默认组合：可玩送信岛 + 西芳寺景观 */
export const DEFAULT_SCENE_IDS = Object.freeze(["messenger", "saihoji"]);

/**
 * 从 location.search 解析场景 id 列表。
 * 支持：
 *   ?scene=messenger
 *   ?scene=saihoji
 *   ?scene=messenger,saihoji
 *   ?scene=all  → 全部已注册
 */
export function resolveSceneIdsFromUrl(search = typeof location !== "undefined" ? location.search : "") {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (q.get("scene") || q.get("scenes") || "").trim();
  if (!raw) return [...DEFAULT_SCENE_IDS];
  if (raw === "all") return [...REGISTRY.keys()];
  const ids = raw
    .split(/[,+\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 去重保序
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    if (!REGISTRY.has(id)) {
      console.warn(`[scene] unknown id "${id}", skip. known:`, [...REGISTRY.keys()]);
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : [...DEFAULT_SCENE_IDS];
}

/**
 * 按 id 列表加载场景模块。
 * @param {string[]} ids
 * @param {import("./sceneApi.js").SceneContext} ctx
 * @returns {import("./sceneApi.js").SceneHandle[]}
 */
export function loadScenes(ids, ctx) {
  const handles = [];
  for (const id of ids) {
    const mod = REGISTRY.get(id);
    if (!mod) {
      console.warn(`[scene] missing module: ${id}`);
      continue;
    }
    const t0 = performance.now?.() ?? 0;
    const handle = mod.load({ ...ctx, options: { ...(ctx.options || {}), ...(ctx.options?.[id] || {}) } });
    if (!handle) continue;
    handle.id = handle.id || mod.id;
    handles.push(handle);
    const ms = (performance.now?.() ?? t0) - t0;
    console.info(`[scene] loaded "${mod.id}" (${mod.name}) in ${ms.toFixed(0)}ms`);
  }
  return handles;
}

export { REGISTRY };
