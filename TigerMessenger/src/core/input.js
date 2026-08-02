// =====================================================================
//  输入：键盘 + 滚轮/中键缩放与环绕
// =====================================================================

/**
 * @param {{
 *   onZoom?: (delta: number) => void,
 *   onOrbit?: (dx: number) => void,
 *   onOrbitPitch?: (dy: number) => void,
 *   onMidDrag?: (on: boolean) => void,
 *   onRightDrag?: (on: boolean) => void,
 *   isActive?: () => boolean,
 * }} [hooks]
 */
export function createInput(hooks = {}) {
  const keys = Object.create(null);
  const {
    onZoom = () => {},
    onOrbit = () => {},
    onOrbitPitch = () => {},
    onMidDrag = () => {},
    onRightDrag = () => {},
    isActive = () => true,
  } = hooks;

  function isTypingTarget(el) {
    if (!el || !(el instanceof Element)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return !!el.closest?.("[contenteditable='true']");
  }

  window.addEventListener("keydown", (e) => {
    // 聊天/输入框聚焦时不驱动 WASD 等游戏键
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
      // 松键时清掉，避免输入前按住的键卡住
      keys[e.code] = false;
      return;
    }
    keys[e.code] = false;
  });

  // 滚轮缩放（非 passive，才能 preventDefault 避免页面滚动）
  window.addEventListener(
    "wheel",
    (e) => {
      if (!isActive()) return;
      e.preventDefault();
      const step = Math.sign(e.deltaY) * 0.7;
      if (step !== 0) onZoom(step);
    },
    { passive: false }
  );

  let midDrag = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener("mousedown", (e) => {
    if (!isActive()) return;
    if (e.button !== 1) return; // 中键
    e.preventDefault();
    midDrag = true;
    lastX = e.clientX;
    lastY = e.clientY;
    onMidDrag(true);
  });

  window.addEventListener("mousemove", (e) => {
    if (!midDrag) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // 左右环绕，上下缩放
    if (dx !== 0) onOrbit(dx * 0.005);
    if (dy !== 0) onZoom(dy * 0.02);
  });

  function endMidDrag() {
    if (!midDrag) return;
    midDrag = false;
    onMidDrag(false);
  }

  window.addEventListener("mouseup", (e) => {
    if (e.button === 1) endMidDrag();
  });
  window.addEventListener("blur", endMidDrag);
  window.addEventListener("mouseleave", endMidDrag);

  // 右键拖拽环视：左右 yaw + 上下 pitch（松开后由相机侧回弹）
  let rightDrag = false;
  let rLastX = 0;
  let rLastY = 0;

  window.addEventListener("contextmenu", (e) => e.preventDefault()); // 屏蔽右键菜单
  window.addEventListener("mousedown", (e) => {
    if (!isActive() || e.button !== 2) return;
    e.preventDefault();
    rightDrag = true;
    rLastX = e.clientX;
    rLastY = e.clientY;
    onRightDrag(true);
  });
  window.addEventListener("mousemove", (e) => {
    if (!rightDrag) return;
    const dx = e.clientX - rLastX;
    const dy = e.clientY - rLastY;
    rLastX = e.clientX;
    rLastY = e.clientY;
    if (dx !== 0) onOrbit(dx * 0.005);
    if (dy !== 0) onOrbitPitch(dy * 0.004);
  });
  function endRightDrag() {
    if (!rightDrag) return;
    rightDrag = false;
    onRightDrag(false);
  }
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) endRightDrag();
  });
  window.addEventListener("blur", endRightDrag);

  // 禁止中键默认的自动滚动（autoscroll）
  window.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  return keys;
}
