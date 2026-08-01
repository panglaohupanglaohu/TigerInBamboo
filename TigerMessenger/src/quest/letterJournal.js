// =====================================================================
//  信使记忆：本机信袋（localStorage）+ 可选主站四层记忆桥接（#13b）
// =====================================================================

import {
  ensureMemoryBridge,
  memoryOnDeliver,
  memoryOnPickup,
  recallDeliveriesFromMemory,
  memoryToneHint,
  getBridgeStatus,
} from "./memoryBridge.js";

const STORAGE_KEY = "tm.letterJournal.v1";
const MAX_ENTRIES = 80;

/**
 * @typedef {{ id: string, letter: string, from: string, to: string, at: number }} LetterEntry
 */

/** @returns {LetterEntry[]} */
export function loadJournal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

/** @param {LetterEntry[]} entries */
function saveJournal(entries) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, updatedAt: Date.now(), entries })
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * 接信：写入主站意图/日志（若桥接可用）
 * @param {{ id?: string, letter: string, from: string, to: string }} payload
 */
export function recordPickup(payload) {
  // fire-and-forget；不阻塞玩法
  memoryOnPickup(payload).catch(() => {});
}

/**
 * 记录一封送达的信（本机信袋必写；四层记忆尽力写入）
 * @param {{ id?: string, letter: string, from: string, to: string }} payload
 */
export function recordDelivery(payload) {
  const entries = loadJournal();
  const entry = {
    id: payload.id || `d_${Date.now().toString(36)}`,
    letter: payload.letter,
    from: payload.from,
    to: payload.to,
    at: Date.now(),
  };
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  saveJournal(entries);
  memoryOnDeliver(payload).catch(() => {});
  return entries;
}

export function clearJournal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function journalCount() {
  return loadJournal().length;
}

/** 预热桥接（开场可调用） */
export function warmMemoryBridge() {
  return ensureMemoryBridge();
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 把清单画进 DOM 列表（本机信袋为主；异步叠加四层记忆语气与状态）
 * @param {HTMLElement|null} el
 * @param {HTMLElement|null} [statusEl] 可选状态行
 */
export function renderJournalList(el, statusEl = null) {
  if (!el) return;
  const entries = loadJournal();
  el.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "还没有送达记录。去送信吧。";
    el.appendChild(li);
  } else {
    for (const e of [...entries].reverse()) {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="dot done"></span>` +
        `<span><strong>${escapeHtml(e.letter)}</strong> · ${escapeHtml(e.from)}→${escapeHtml(e.to)}` +
        `<br /><span class="muted" style="text-decoration:none;opacity:0.55;font-size:10px">${fmtTime(e.at)}</span></span>`;
      el.appendChild(li);
    }
  }

  if (statusEl) {
    statusEl.textContent = "记忆：检测中…";
    ensureMemoryBridge().then(async (st) => {
      if (st.ok) {
        const tone = await memoryToneHint();
        statusEl.textContent = tone
          ? `四层记忆已连接 · ${tone}`
          : "四层记忆已连接（creature: messenger）";
        statusEl.dataset.bridge = "on";
      } else {
        statusEl.textContent = "四层记忆未连接 · 仅本机信袋";
        statusEl.dataset.bridge = "off";
      }
      // 若本机为空但记忆层有送达史，补一行提示
      if (!entries.length) {
        const fromMem = await recallDeliveriesFromMemory(5);
        if (fromMem.length) {
          el.innerHTML = "";
          for (const e of fromMem) {
            const li = document.createElement("li");
            li.innerHTML =
              `<span class="dot done"></span>` +
              `<span><strong>${escapeHtml(e.letter)}</strong> · ${escapeHtml(e.from)}→${escapeHtml(e.to)}` +
              `<br /><span class="muted" style="text-decoration:none;opacity:0.55;font-size:10px">${fmtTime(e.at)} · 记忆层</span></span>`;
            el.appendChild(li);
          }
        }
      }
    });
  } else {
    // 仍预热，方便下次打开
    ensureMemoryBridge().catch(() => {});
  }
}

export { getBridgeStatus };
