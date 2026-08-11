// =====================================================================
//  弹琴老人互动：靠近按 E 播放 / 停止原创八音盒旋律
//  老人现坐在圣城旧港码头起重机旁；距离用世界坐标（可能挂在码头子树下）
// =====================================================================
import * as THREE from "three";
import { toggleMusicBox, isMusicBoxPlaying, isMuted } from "../audio/sfx.js";
import { showToast } from "../ui/hud.js";

export const ELDER_MUSIC_RANGE = 3.2;

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {import("three").Object3D|null} deps.elder
 * @param {HTMLElement|null} deps.elHint
 * @param {() => boolean} deps.isGameStarted
 */
export function createElderMusicInteraction({ player, elder, elHint, isGameStarted }) {
  let notePulse = 0;
  const keys = elder?.userData?.musicKeys || null;
  const baseKeysY = keys?.position.y ?? 0;
  const _elderWorld = new THREE.Vector3();

  function nearElder() {
    // 老人可能挂在码头等子节点下，须用世界坐标判断近身
    if (!elder) return false;
    elder.getWorldPosition(_elderWorld);
    return player.position.distanceTo(_elderWorld) <= ELDER_MUSIC_RANGE;
  }

  function refreshHint() {
    if (!elHint) return;
    const show = !!isGameStarted?.() && nearElder();
    elHint.classList.toggle("show", show);
    if (show) {
      elHint.innerHTML = isMusicBoxPlaying()
        ? "[<kbd>E</kbd>] 停止八音盒"
        : "[<kbd>E</kbd>] 聆听八音盒";
    }
  }

  function onKeyDown(event) {
    if (event.code !== "KeyE" || event.repeat || !isGameStarted?.() || !nearElder()) return;
    // 捕获阶段接管老人附近的 E，避免与送信 NPC 同时触发。
    event.preventDefault();
    event.stopImmediatePropagation();

    if (isMuted()) {
      showToast("音效已关闭 · 按 M 开启后再听八音盒", 2.2);
      refreshHint();
      return;
    }

    const started = toggleMusicBox({
      onNote: () => { notePulse = 1; },
      onEnded: refreshHint,
    });
    showToast(
      started ? "老人轻轻转动发条，八音盒响了起来……" : "八音盒安静下来",
      started ? 3 : 1.8
    );
    notePulse = started ? 1 : 0;
    refreshHint();
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function update(dt, t) {
    refreshHint();
    if (!keys) return;
    notePulse = Math.max(0, notePulse - dt * 5.5);
    const playing = isMusicBoxPlaying();
    const sway = playing ? Math.sin(t * 9) * 0.005 : 0;
    keys.position.y = baseKeysY + sway + notePulse * 0.035;
    keys.rotation.z = playing ? Math.sin(t * 5.5) * 0.018 : 0;
  }

  return {
    update,
    isNear: nearElder,
    dispose() {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (elHint) elHint.classList.remove("show");
    },
  };
}
