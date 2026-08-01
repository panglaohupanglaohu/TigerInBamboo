// =====================================================================
//  输入：键盘 + 滚轮/中键缩放与环绕
// =====================================================================

/**
 * @param {{
 *   onZoom?: (delta: number) => void,
 *   onOrbit?: (dx: number) => void,
 *   onMidDrag?: (on: boolean) => void,
 *   isActive?: () => boolean,
 * }} [hooks]
 */
export function createInput(hooks = {}) {
  const keys = Object.create(null);
  const {
    onZoom = () => {},
    onOrbit = () => {},
    onMidDrag = () => {},
    isActive = () => true,
  } = hooks;

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
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

  // 禁止中键默认的自动滚动（autoscroll）
  window.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  return keys;
}
