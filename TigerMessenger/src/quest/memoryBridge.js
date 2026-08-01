// =====================================================================
//  主站四层记忆桥接（#13b）
//  动态加载 frontend/js/memory/MemoryCore；失败则静默退回本机信袋。
//  路径候选覆盖：GitHub Pages（仓库根 sibling）与本地 8931（frontend 挂在 /）。
// =====================================================================

export const MESSENGER_CREATURE_ID = "messenger";

/** @type {null | { ok: boolean, source: string, core?: import("../../../frontend/js/memory/memory-core.js").MemoryCore, error?: string }} */
let bridgeState = null;
let loadPromise = null;

/**
 * 解析候选 URL（按环境优先，减少 404 噪音）
 * @returns {string[]}
 */
function candidateUrls() {
  const urls = [];
  const host = location.hostname || "";
  const onLocal = host === "localhost" || host === "127.0.0.1";
  const onPages = host.endsWith("github.io");

  // 本地 8931：frontend 挂在站点根 → /js/memory/
  if (onLocal) {
    try {
      urls.push(new URL("/js/memory/memory-core.js", location.origin).href);
    } catch {
      /* ignore */
    }
  }

  // GitHub Pages / 仓库静态：TigerMessenger 与 frontend 同级
  if (onPages || !onLocal) {
    try {
      urls.push(new URL("../../../frontend/js/memory/memory-core.js", import.meta.url).href);
    } catch {
      /* ignore */
    }
    try {
      const base = location.pathname.replace(/\/TigerMessenger\/?.*$/, "/");
      urls.push(
        new URL(base.replace(/\/?$/, "/") + "frontend/js/memory/memory-core.js", location.origin).href
      );
    } catch {
      /* ignore */
    }
  }

  // 其它环境兜底（未知部署）
  if (!onLocal && !onPages) {
    try {
      urls.push(new URL("/js/memory/memory-core.js", location.origin).href);
    } catch {
      /* ignore */
    }
  }

  return [...new Set(urls)];
}

/**
 * 先探测 URL 是否真是 JS 模块（避免 404 HTML 触发 import MIME error 污染控制台）
 * @param {string} url
 */
async function isJsModuleUrl(url) {
  try {
    const res = await fetch(url, { method: "GET", cache: "force-cache" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("html")) return false;
    // 部分静态服不带正确 MIME，再 sniff 正文
    const head = (await res.clone().text()).slice(0, 80).trimStart();
    if (head.startsWith("<!DOCTYPE") || head.startsWith("<html") || head.startsWith("<!doctype")) {
      return false;
    }
    // 接受 js / 空 content-type / text/plain 且像模块
    if (
      ct.includes("javascript") ||
      ct.includes("ecmascript") ||
      ct.includes("text/plain") ||
      ct === "" ||
      head.startsWith("import ") ||
      head.startsWith("//") ||
      head.startsWith("export ")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 懒加载 MemoryCore；只尝试一次（成功或全失败都缓存）
 * @returns {Promise<{ ok: boolean, source: string, core?: any, error?: string }>}
 */
export function ensureMemoryBridge() {
  if (bridgeState) return Promise.resolve(bridgeState);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tried = [];
    for (const url of candidateUrls()) {
      tried.push(url);
      try {
        if (!(await isJsModuleUrl(url))) {
          continue;
        }
        const mod = await import(/* @vite-ignore */ url);
        const MemoryCore = mod.MemoryCore || mod.default?.MemoryCore;
        if (typeof MemoryCore !== "function") {
          throw new Error("MemoryCore export missing");
        }
        const core = new MemoryCore(MESSENGER_CREATURE_ID);
        bridgeState = { ok: true, source: url, core };
        console.info("[TigerMessenger] 四层记忆已桥接:", url);
        return bridgeState;
      } catch (err) {
        // 继续试下一个（不 console.error，避免验收噪音）
        console.debug("[TigerMessenger] memory bridge miss:", url, err?.message || err);
      }
    }
    bridgeState = {
      ok: false,
      source: "none",
      error: `无法加载主站记忆模块（尝试 ${tried.length} 个路径）`,
    };
    console.info("[TigerMessenger] 四层记忆未接入，仅用本机信袋。", bridgeState.error);
    return bridgeState;
  })();

  return loadPromise;
}

export function getBridgeStatus() {
  return bridgeState;
}

/**
 * 接信：日志 + 感知 + 意图（prospective）+ 情绪
 * @param {{ letter: string, from: string, to: string, id?: string }} p
 */
export async function memoryOnPickup(p) {
  const st = await ensureMemoryBridge();
  if (!st.ok || !st.core) return null;
  const { core } = st;
  const t = Date.now();
  const letter = p.letter || "";
  const from = p.from || "";
  const to = p.to || "";

  core.perception.perceive({
    t,
    modality: "vision",
    payload: { event: "pickup", letter, from, to, questId: p.id || null },
  });

  core.log.append({
    t,
    subject: MESSENGER_CREATURE_ID,
    action: "接信",
    detail: `从 ${from} 接过「${letter}」，要送给 ${to}`,
    place: "夜色二次元",
    importance: 6,
    tags: ["信使", "接信", "TigerMessenger", letter, from, to],
  });

  const intention = core.intentions.add({
    creator: from,
    instruction: `把「${letter}」送给 ${to}`,
    trigger: `靠近收件人 ${to}`,
    provenance: {
      saidAt: t,
      context: "TigerMessenger 送信任务",
      confidence: "normal",
    },
    timeoutPolicy: "keep",
  });

  core.affect.feel("使命", 0.45, 0.25, 0.55, t);
  return { intentionId: intention?.id || null };
}

/**
 * 送达：日志 + 感知 + 确认意图 + 情绪
 * @param {{ letter: string, from: string, to: string, id?: string }} p
 */
export async function memoryOnDeliver(p) {
  const st = await ensureMemoryBridge();
  if (!st.ok || !st.core) return null;
  const { core } = st;
  const t = Date.now();
  const letter = p.letter || "";
  const from = p.from || "";
  const to = p.to || "";

  core.perception.perceive({
    t,
    modality: "vision",
    payload: { event: "deliver", letter, from, to, questId: p.id || null },
  });

  core.log.append({
    t,
    subject: MESSENGER_CREATURE_ID,
    action: "送达",
    detail: `「${letter}」已从 ${from} 送到 ${to}`,
    place: "夜色二次元",
    importance: 8,
    tags: ["信使", "送达", "TigerMessenger", letter, from, to],
  });

  // 确认匹配的 pending 意图
  const needle = `「${letter}」`;
  const pending = core.intentions.pending(t);
  for (const it of pending) {
    if (
      (it.instruction && it.instruction.includes(needle)) ||
      (it.instruction && to && it.instruction.includes(to))
    ) {
      core.intentions.confirm(it.id, t);
      break;
    }
  }

  core.affect.feel("欣慰", 0.6, 0.5, 0.35, t);
  return true;
}

/**
 * 从四层记忆拉最近送达事件（若桥接成功），供信袋展示增强
 * @param {number} k
 * @returns {Promise<Array<{ letter: string, from: string, to: string, at: number, source: string }>>}
 */
export async function recallDeliveriesFromMemory(k = 20) {
  const st = await ensureMemoryBridge();
  if (!st.ok || !st.core) return [];
  const hits = st.core.log.recall("送达", k);
  return hits
    .map(({ event }) => {
      // detail 形如：`「竹林邀请函」已从 小虎 送到 阿竹`
      const d = event.detail || "";
      const m = d.match(/「([^」]+)」.*?从\s*(.+?)\s*送到\s*(.+)$/);
      return {
        letter: m?.[1] || event.detail || "信件",
        from: m?.[2] || "?",
        to: m?.[3] || "?",
        at: event.t,
        source: "memory",
        tone: null,
      };
    })
    .filter(Boolean);
}

/** 当前语气提示（情绪残留） */
export async function memoryToneHint() {
  const st = await ensureMemoryBridge();
  if (!st.ok || !st.core) return "";
  try {
    return st.core.affect.toneHint() || "";
  } catch {
    return "";
  }
}
