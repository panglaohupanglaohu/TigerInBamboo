// =====================================================================
//  UI / HUD：DOM 引用、Toast、对话气泡
// =====================================================================
export const elQuestStatus = document.getElementById("quest-status");
export const elScoreNum = document.getElementById("score-num");
export const elScoreTotal = document.getElementById("score-total");
export const elLetterList = document.getElementById("letter-list");
export const elToast = document.getElementById("toast");
export const elBubble = document.getElementById("bubble");
export const elIntro = document.getElementById("intro");
export const elStartBtn = document.getElementById("start-btn");
export const elCompassNeedle = document.getElementById("compass-needle");
export const elCompassLabel = document.getElementById("compass-label");
export const elJournalPanel = document.getElementById("journal-panel");
export const elJournalList = document.getElementById("journal-list");
export const elJournalToggle = document.getElementById("journal-toggle");
export const elJournalClear = document.getElementById("journal-clear");

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
export function showBubble(text, leftPx, topPx) {
  elBubble.style.left = `${leftPx}px`;
  elBubble.style.top = `${topPx}px`;
  elBubble.textContent = text;
  elBubble.classList.add("visible");
}

export function hideBubble() {
  elBubble.classList.remove("visible");
}
