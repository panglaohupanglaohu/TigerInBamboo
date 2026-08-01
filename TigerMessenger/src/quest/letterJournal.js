// =====================================================================
//  信使记忆（轻量彩蛋）：本机 localStorage 记下送达过的信
//  不依赖主站 frontend/js/memory/；若日后批准可再桥接四层记忆。
// =====================================================================

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
 * 记录一封送达的信
 * @param {{ id?: string, letter: string, from: string, to: string }} payload
 */
export function recordDelivery(payload) {
  const entries = loadJournal();
  entries.push({
    id: payload.id || `d_${Date.now().toString(36)}`,
    letter: payload.letter,
    from: payload.from,
    to: payload.to,
    at: Date.now(),
  });
  while (entries.length > MAX_ENTRIES) entries.shift();
  saveJournal(entries);
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

/** 格式化时间 */
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

/**
 * 把清单画进 DOM 列表
 * @param {HTMLElement|null} el
 */
export function renderJournalList(el) {
  if (!el) return;
  const entries = loadJournal();
  el.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "还没有送达记录。去送信吧。";
    el.appendChild(li);
    return;
  }
  // 最新在上
  for (const e of [...entries].reverse()) {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="dot done"></span>` +
      `<span><strong>${escapeHtml(e.letter)}</strong> · ${escapeHtml(e.from)}→${escapeHtml(e.to)}` +
      `<br /><span class="muted" style="text-decoration:none;opacity:0.55;font-size:10px">${fmtTime(e.at)}</span></span>`;
    el.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
