// 面板推拉收合：面板滑出画外仅留竖柄，点击竖柄推回展开；状态记入 localStorage。
// 无历史偏好时：竹虎图（tiger.html）默认收起，寒梅图（plum-scene）保持原默认展开。
const KEY = "ui.collapsed";
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { store = {}; }

const defaultCollapsed = !document.body.classList.contains("plum-scene");

document.querySelectorAll(".panel-handle").forEach((btn) => {
  const panel = document.getElementById(btn.dataset.target);
  if (!panel) return;
  const initial = panel.id in store ? !!store[panel.id] : defaultCollapsed;
  panel.classList.toggle("collapsed", initial);
  btn.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", collapsed);
    store[panel.id] = collapsed;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式忽略 */ }
  });
});
