// =====================================================================
//  手机 / 触控遥控杆
//  左：移动摇杆 → WASD；右：跳/E/F + 环视拖板（模拟右键环视）
//  可收起；展开时收起屏幕中央按键提示
// =====================================================================

const STORAGE_KEY = "tm.touchPad.open";
const MOVE_CODES = ["KeyW", "KeyA", "KeyS", "KeyD"];

function isCoarsePointer() {
  try {
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches ||
      navigator.maxTouchPoints > 0
    );
  } catch {
    return false;
  }
}

function readOpenPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* private */
  }
  // 默认：触控设备展开，桌面收起
  return isCoarsePointer();
}

function writeOpenPref(open) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* private */
  }
}

/**
 * 派发一次键盘事件（给只监听 keydown 的 E/F 系统用）
 * @param {string} code
 * @param {"keydown"|"keyup"} type
 */
function fireKey(code, type = "keydown") {
  const ev = new KeyboardEvent(type, {
    code,
    key: code === "Space" ? " " : code.replace(/^Key/, "").toLowerCase(),
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(ev);
}

/**
 * @param {object} deps
 * @param {Record<string, boolean>} deps.keys  与 createInput 同一对象
 * @param {() => boolean} deps.isGameStarted
 * @param {(dx: number) => void} deps.onOrbit
 * @param {(dy: number) => void} deps.onOrbitPitch
 * @param {(on: boolean) => void} [deps.onRightDrag]
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 */
export function createTouchControls({
  keys,
  isGameStarted,
  onOrbit,
  onOrbitPitch,
  onRightDrag = () => {},
  toast = () => {},
}) {
  // ---------- DOM ----------
  const root = document.createElement("div");
  root.id = "touch-controls";
  root.innerHTML = `
    <button type="button" id="touch-toggle" aria-label="展开遥控杆" title="遥控杆" aria-pressed="false">
      <span class="touch-toggle-icon">🕹️</span>
      <span class="touch-toggle-label">遥控</span>
    </button>
    <div id="touch-pad" hidden>
      <div class="touch-zone touch-zone-left">
        <div class="touch-stick" id="touch-move" aria-label="移动">
          <div class="touch-stick-base"></div>
          <div class="touch-stick-knob" id="touch-move-knob"></div>
          <span class="touch-stick-hint">移动</span>
        </div>
      </div>
      <div class="touch-zone touch-zone-right">
        <div class="touch-look" id="touch-look" aria-label="环视">
          <span class="touch-look-hint">环视</span>
        </div>
        <div class="touch-btns">
          <button type="button" class="touch-btn" data-action="jump" aria-label="跳跃">跳</button>
          <button type="button" class="touch-btn touch-btn-e" data-action="interact" aria-label="交互 E">E</button>
          <button type="button" class="touch-btn touch-btn-f" data-action="tram" aria-label="电车 F">F</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const elToggle = root.querySelector("#touch-toggle");
  document.querySelector("#touch-toggle-slot")?.appendChild(elToggle);
  const elPad = root.querySelector("#touch-pad");
  const elMove = root.querySelector("#touch-move");
  const elKnob = root.querySelector("#touch-move-knob");
  const elLook = root.querySelector("#touch-look");

  let open = false;
  let moveId = null;
  let lookId = null;
  let lookLastX = 0;
  let lookLastY = 0;

  function clearMoveKeys() {
    for (const c of MOVE_CODES) keys[c] = false;
  }

  function setMoveFromVector(nx, ny) {
    // nx, ny in [-1,1]，屏幕 y 向下为正 → W 为 -ny
    const dead = 0.28;
    clearMoveKeys();
    if (nx * nx + ny * ny < dead * dead) return;
    if (ny < -dead) keys.KeyW = true;
    if (ny > dead) keys.KeyS = true;
    if (nx < -dead) keys.KeyA = true;
    if (nx > dead) keys.KeyD = true;
  }

  function setOpen(next, { silent = false } = {}) {
    open = !!next;
    elPad.hidden = !open;
    elToggle.classList.toggle("is-active", open);
    elToggle.setAttribute("aria-pressed", open ? "true" : "false");
    elToggle.setAttribute("aria-label", open ? "收起遥控杆并显示操作提示" : "展开遥控杆并收起操作提示");
    document.body.classList.toggle("touch-pad-open", open);
    writeOpenPref(open);
    if (!open) {
      clearMoveKeys();
      keys.Space = false;
      if (elKnob) {
        elKnob.style.transform = "translate(-50%, -50%)";
      }
      onRightDrag(false);
    } else if (!silent) {
      toast("遥控杆已开 · 左移右环视 · 可再点收起", 2.2);
    }
  }

  // ---------- 移动摇杆 ----------
  function onMoveStart(e) {
    if (!isGameStarted?.() || !open) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches ? e.changedTouches[0] : e;
    moveId = t.identifier ?? "mouse";
    elMove.setPointerCapture?.(e.pointerId);
    updateMove(t.clientX, t.clientY);
  }

  function onMoveMove(e) {
    if (moveId == null) return;
    e.preventDefault();
    if (e.changedTouches) {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId || moveId === "mouse") {
          updateMove(t.clientX, t.clientY);
          break;
        }
      }
    } else {
      updateMove(e.clientX, e.clientY);
    }
  }

  function onMoveEnd(e) {
    if (moveId == null) return;
    if (e.changedTouches) {
      let hit = false;
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) hit = true;
      }
      if (!hit && moveId !== "mouse") return;
    }
    moveId = null;
    clearMoveKeys();
    if (elKnob) elKnob.style.transform = "translate(-50%, -50%)";
  }

  function updateMove(cx, cy) {
    const rect = elMove.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    let dx = cx - ox;
    let dy = cy - oy;
    const maxR = rect.width * 0.38;
    const len = Math.hypot(dx, dy) || 1;
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    if (elKnob) {
      elKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    setMoveFromVector(dx / maxR, dy / maxR);
  }

  elMove.addEventListener("pointerdown", onMoveStart);
  elMove.addEventListener("pointermove", onMoveMove);
  elMove.addEventListener("pointerup", onMoveEnd);
  elMove.addEventListener("pointercancel", onMoveEnd);
  elMove.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && moveId != null) onMoveEnd(e);
  });

  // ---------- 环视板（右键拖拽） ----------
  function onLookStart(e) {
    if (!isGameStarted?.() || !open) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches ? e.changedTouches[0] : e;
    lookId = t.identifier ?? "mouse";
    lookLastX = t.clientX;
    lookLastY = t.clientY;
    onRightDrag(true);
    elLook.classList.add("is-dragging");
    elLook.setPointerCapture?.(e.pointerId);
  }

  function onLookMove(e) {
    if (lookId == null) return;
    e.preventDefault();
    let cx;
    let cy;
    if (e.changedTouches) {
      let found = null;
      for (const t of e.changedTouches) {
        if (t.identifier === lookId || lookId === "mouse") found = t;
      }
      if (!found) return;
      cx = found.clientX;
      cy = found.clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    const dx = cx - lookLastX;
    const dy = cy - lookLastY;
    lookLastX = cx;
    lookLastY = cy;
    // 略放大触控灵敏度
    if (dx !== 0) onOrbit(dx * 0.008);
    if (dy !== 0) onOrbitPitch(dy * 0.006);
  }

  function onLookEnd(e) {
    if (lookId == null) return;
    if (e.changedTouches) {
      let hit = false;
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) hit = true;
      }
      if (!hit && lookId !== "mouse") return;
    }
    lookId = null;
    onRightDrag(false);
    elLook.classList.remove("is-dragging");
  }

  elLook.addEventListener("pointerdown", onLookStart);
  elLook.addEventListener("pointermove", onLookMove);
  elLook.addEventListener("pointerup", onLookEnd);
  elLook.addEventListener("pointercancel", onLookEnd);

  // ---------- 动作键 ----------
  root.querySelectorAll(".touch-btn").forEach((btn) => {
    const action = btn.getAttribute("data-action");
    btn.addEventListener("pointerdown", (e) => {
      if (!isGameStarted?.() || !open) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("is-down");
      btn.setPointerCapture?.(e.pointerId);
      if (action === "jump") {
        keys.Space = true;
        fireKey("Space", "keydown");
      } else if (action === "interact") {
        fireKey("KeyE", "keydown");
      } else if (action === "tram") {
        fireKey("KeyF", "keydown");
      }
    });
    const end = (e) => {
      btn.classList.remove("is-down");
      if (action === "jump") {
        keys.Space = false;
        fireKey("Space", "keyup");
      } else if (action === "interact") {
        fireKey("KeyE", "keyup");
      } else if (action === "tram") {
        fireKey("KeyF", "keyup");
      }
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("pointerleave", (e) => {
      if (btn.classList.contains("is-down")) end(e);
    });
  });

  elToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  });
  // 开场后按偏好展开
  const preferOpen = readOpenPref();
  // 先不 toast，等用户点开始再提示一次可选
  setOpen(preferOpen, { silent: true });

  // 防止触控滑动整页
  root.addEventListener(
    "touchmove",
    (e) => {
      if (open) e.preventDefault();
    },
    { passive: false }
  );

  return {
    isOpen: () => open,
    setOpen,
    /** 游戏开始时可 toast 一次引导 */
    onGameStart() {
      if (open && isCoarsePointer()) {
        toast("左侧移动 · 右侧环视 / 跳·E·F · 可点「遥控」收起", 3.2);
      } else if (!open && isCoarsePointer()) {
        toast("点右下角「遥控」可打开触控摇杆", 2.8);
      }
    },
    dispose() {
      clearMoveKeys();
      keys.Space = false;
      elToggle.remove();
      root.remove();
      document.body.classList.remove("touch-pad-open");
    },
  };
}
