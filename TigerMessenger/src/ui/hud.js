// =====================================================================
//  UI / HUD：DOM 引用、Toast、对话气泡、任务面板折叠
// =====================================================================
export const elQuestPanel = document.getElementById("quest-panel");
export const elQuestCollapse = document.getElementById("quest-collapse");
export const elQuestStatus = document.getElementById("quest-status");
export const elScoreNum = document.getElementById("score-num");
export const elScoreTotal = document.getElementById("score-total");
export const elLetterList = document.getElementById("letter-list");
export const elToast = document.getElementById("toast");
export const elBubble = document.getElementById("bubble");
export const elNpcHint = document.getElementById("npc-hint");
export const elIntro = document.getElementById("intro");
export const elStartBtn = document.getElementById("start-btn");
export const elCompassNeedle = document.getElementById("compass-needle");
export const elCompassLabel = document.getElementById("compass-label");
export const elJournalPanel = document.getElementById("journal-panel");
export const elJournalList = document.getElementById("journal-list");
export const elJournalToggle = document.getElementById("journal-toggle");
export const elJournalClear = document.getElementById("journal-clear");

const QUEST_COLLAPSE_KEY = "tm.questPanel.collapsed";

/** 任务面板收起/展开（状态写入 localStorage） */
export function setQuestPanelCollapsed(collapsed) {
  if (!elQuestPanel) return;
  elQuestPanel.classList.toggle("collapsed", !!collapsed);
  if (elQuestCollapse) {
    elQuestCollapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
    elQuestCollapse.setAttribute("aria-label", collapsed ? "展开任务面板" : "收起任务面板");
    elQuestCollapse.title = collapsed ? "展开任务面板（Tab）" : "收起任务面板（Tab）";
  }
  try {
    localStorage.setItem(QUEST_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function isQuestPanelCollapsed() {
  return !!(elQuestPanel && elQuestPanel.classList.contains("collapsed"));
}

export function toggleQuestPanelCollapsed() {
  setQuestPanelCollapsed(!isQuestPanelCollapsed());
}

/** 绑定折叠按钮 + Tab 快捷键；恢复上次状态 */
export function initQuestPanelCollapse() {
  if (!elQuestPanel || !elQuestCollapse) return;
  let saved = false;
  try {
    saved = localStorage.getItem(QUEST_COLLAPSE_KEY) === "1";
  } catch {
    /* ignore */
  }
  setQuestPanelCollapsed(saved);

  elQuestCollapse.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleQuestPanelCollapsed();
  });
  // 点标题栏空白也可切换
  const head = elQuestPanel.querySelector(".quest-head");
  if (head) {
    head.addEventListener("click", (e) => {
      if (e.target.closest("#quest-collapse")) return;
      // 收起态：点整条标题栏展开；展开态仅按钮收起，避免误触
      if (isQuestPanelCollapsed()) toggleQuestPanelCollapsed();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Tab") return;
    // 不抢输入框 / 开场遮罩
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (elIntro && !elIntro.classList.contains("hidden")) return;
    e.preventDefault();
    toggleQuestPanelCollapsed();
  });
}

let toastTimer = 0;

export function showToast(msg, duration = 2.4) {
  elToast.textContent = msg;
  elToast.classList.add("show");
  toastTimer = duration;
}

// 主循环每帧调用：倒计时结束后隐藏 toast
export function updateToast(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) elToast.classList.remove("show");
  }
}

// 气泡：由调用方把世界坐标投影成屏幕像素后传入
// opts.large：放大字号（湖沼虎灯谜等）
export function showBubble(text, leftPx, topPx, opts = {}) {
  if (!elBubble) return;
  elBubble.style.left = `${leftPx}px`;
  elBubble.style.top = `${topPx}px`;
  elBubble.textContent = text;
  elBubble.classList.toggle("bubble-lg", !!opts.large);
  elBubble.classList.add("visible");
}

export function hideBubble() {
  if (!elBubble) return;
  elBubble.classList.remove("visible");
  elBubble.classList.remove("bubble-lg");
}

// NPC 交谈提示（[E] 与居民交谈）
export function showNpcHint() {
  elNpcHint.classList.add("show");
}
export function hideNpcHint() {
  elNpcHint.classList.remove("show");
}
