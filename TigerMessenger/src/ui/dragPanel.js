// =====================================================================
//  面板拖拽摆放：按住标题栏拖动 fixed 面板，位置写入 localStorage
// =====================================================================

/**
 * @param {HTMLElement} panel  position:fixed 的面板
 * @param {HTMLElement|null} handle  拖动手柄（默认 panel 自身）
 * @param {string} [storageKey]  持久化键；不传则不保存
 */
export function makePanelDraggable(panel, handle = null, storageKey = "") {
  if (!panel) return () => {};
  const grip = handle || panel;
  grip.style.cursor = "move";
  grip.style.userSelect = "none";
  grip.style.touchAction = "none";

  // 恢复上次位置
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const pos = JSON.parse(raw);
        if (Number.isFinite(pos?.left) && Number.isFinite(pos?.top)) {
          applyPos(panel, pos.left, pos.top);
        }
      }
    } catch {
      /* ignore */
    }
  }

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  function onPointerDown(e) {
    // 标题栏内按钮/输入不触发拖拽
    const t = e.target;
    if (
      t instanceof Element &&
      (t.closest("button") ||
        t.closest("input") ||
        t.closest("textarea") ||
        t.closest("select") ||
        t.closest("a") ||
        t.closest("label"))
    ) {
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    // 从 right/bottom 布局切到 left/top，避免拖动时跳动
    applyPos(panel, origLeft, origTop);
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const left = origLeft + dx;
    const top = origTop + dy;
    applyPos(panel, left, top);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      grip.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (storageKey) {
      const rect = panel.getBoundingClientRect();
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ left: rect.left, top: rect.top })
        );
      } catch {
        /* private mode */
      }
    }
  }

  grip.addEventListener("pointerdown", onPointerDown);
  grip.addEventListener("pointermove", onPointerMove);
  grip.addEventListener("pointerup", onPointerUp);
  grip.addEventListener("pointercancel", onPointerUp);

  return () => {
    grip.removeEventListener("pointerdown", onPointerDown);
    grip.removeEventListener("pointermove", onPointerMove);
    grip.removeEventListener("pointerup", onPointerUp);
    grip.removeEventListener("pointercancel", onPointerUp);
  };
}

/** 限制在视口内，并改为 left/top 定位 */
function applyPos(panel, left, top) {
  const margin = 8;
  const w = panel.offsetWidth || 280;
  const h = panel.offsetHeight || 200;
  const maxL = Math.max(margin, window.innerWidth - w - margin);
  const maxT = Math.max(margin, window.innerHeight - h - margin);
  const L = Math.min(Math.max(margin, left), maxL);
  const T = Math.min(Math.max(margin, top), maxT);
  panel.style.left = `${L}px`;
  panel.style.top = `${T}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}
