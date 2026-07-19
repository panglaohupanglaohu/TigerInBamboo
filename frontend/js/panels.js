// 面板推拉收合：面板滑出画外仅留竖柄，点击竖柄推回展开；状态记入 localStorage
const KEY = "ui.collapsed";
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { store = {}; }

document.querySelectorAll(".panel-handle").forEach((btn) => {
  const panel = document.getElementById(btn.dataset.target);
  if (!panel) return;
  panel.classList.toggle("collapsed", !!store[panel.id]);
  btn.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", collapsed);
    store[panel.id] = collapsed;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式忽略 */ }
  });
});
