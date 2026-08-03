// =====================================================================
//  阿狸互动：E 叫醒跟随 · 聊天 · 经典四足碎步由 updateFoxFollow 驱动
// =====================================================================
import * as THREE from "three";
import { flatToWorld } from "./sphereMath.js";
import { groundLiftAt } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { showBubble, hideBubble, showToast } from "../ui/hud.js";
import {
  updateFoxFollow,
  animateFoxCompanion,
  FOX_FOLLOW_GAP,
  FOX_FOLLOW_LERP,
} from "../assets/fox.js";

const TALK_RANGE = 3.2;
const HOME_RADIUS = 2.8;
const WALK_SPEED = 1.15;

const GREET_LINES = [
  "……嗯？送信的？我是阿狸～走吧，我跟着你！",
  "醒啦！四条小短腿准备好了——带我去逛逛？",
  "草好软……不过既然你叫我，我就颠颠跟着你。",
];

const DEFAULT_REPLIES = [
  "唔……我听着呢。想去哪都可以跟我说。",
  "嗯嗯，原来是这样呀。",
  "（尾巴火苗轻轻摇）我懂的。",
  "送信辛苦啦。路还长，慢慢来。",
  "……我在听。再说「回去休息」我就回家睡。",
];

/**
 * @param {object} deps
 */
export function createFoxNpc({
  player,
  fox,
  camera,
  isGameStarted,
  elHint = null,
  planetRadius = PLANET_RADIUS,
  isElderNear = () => false,
  isQuestNear = () => false,
}) {
  if (!fox) {
    return {
      update() {},
      dispose() {},
      isNear: () => false,
      isChatOpen: () => false,
      isFollowing: () => false,
    };
  }

  if (typeof fox.switchState !== "function") {
    console.warn("[foxNpc] fox 缺少 switchState，请使用 createLowPolyFox()");
  }

  const parts = fox.userData.parts || {};
  const home = {
    x: fox.userData.flatX ?? fox.userData.homeFlat?.x ?? -8.6,
    z: fox.userData.flatZ ?? fox.userData.homeFlat?.z ?? 7.2,
  };
  let flatX = home.x;
  let flatZ = home.z;
  let yaw = fox.userData.yaw ?? 0.9;

  let idleMode = "home";
  let walkTarget = { x: home.x, z: home.z };
  let chatOpen = false;
  let bubbleTimer = 0;
  let bubbleText = "";
  let stateT = 0;
  let movingAnim = false;
  const _bubble = new THREE.Vector3();
  const _look = new THREE.Vector3();

  // ---------- 对话面板 ----------
  const panel = document.createElement("div");
  panel.id = "fox-chat";
  panel.className = "fox-chat";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="fox-chat-head">
      <strong>阿狸</strong>
      <span class="fox-chat-sub" id="fox-chat-status">可以打字聊天</span>
      <button type="button" id="fox-chat-close" title="关闭 (Esc)">✕</button>
    </div>
    <div class="fox-chat-log" id="fox-chat-log" aria-live="polite"></div>
    <div class="fox-chat-actions">
      <button type="button" data-cmd="follow">一起走</button>
      <button type="button" data-cmd="home">回去休息</button>
      <button type="button" data-cmd="stay">先歇会儿</button>
    </div>
    <form class="fox-chat-form" id="fox-chat-form">
      <input id="fox-chat-input" type="text" maxlength="100" placeholder="对阿狸说点什么…" autocomplete="off" />
      <button type="submit">发送</button>
    </form>
  `;
  document.body.appendChild(panel);

  const elLog = panel.querySelector("#fox-chat-log");
  const elInput = panel.querySelector("#fox-chat-input");
  const elStatus = panel.querySelector("#fox-chat-status");
  const elForm = panel.querySelector("#fox-chat-form");

  function appendLog(who, text) {
    if (!elLog) return;
    const row = document.createElement("div");
    row.className = who === "you" ? "fox-chat-row you" : "fox-chat-row ali";
    const name = document.createElement("span");
    name.className = "fox-chat-who";
    name.textContent = who === "you" ? "你" : "阿狸";
    const msg = document.createElement("span");
    msg.className = "fox-chat-msg";
    msg.textContent = text;
    row.append(name, msg);
    elLog.appendChild(row);
    elLog.scrollTop = elLog.scrollHeight;
  }

  function setBubble(text, dur = 3.2) {
    bubbleText = text.startsWith("阿狸") ? text : `阿狸：${text}`;
    bubbleTimer = dur;
  }

  function clearBubble() {
    bubbleTimer = 0;
    bubbleText = "";
    if (!isQuestNear()) hideBubble();
  }

  function hideInteractionUI() {
    clearBubble();
    if (elHint) elHint.classList.remove("show");
    if (fox.userData.glowRing) fox.userData.glowRing.visible = false;
    if (chatOpen) {
      chatOpen = false;
      panel.hidden = true;
      elInput?.blur();
    }
  }

  function distToPlayer() {
    return player.position.distanceTo(fox.position);
  }

  function nearTalk() {
    const range = P.talkRange ? Math.max(P.talkRange, TALK_RANGE) : TALK_RANGE;
    return distToPlayer() <= range;
  }

  function isFollowing() {
    return (fox.getState?.() ?? fox.userData.foxState) === "FOLLOWING";
  }

  const _placePos = new THREE.Vector3();
  const _placeUp = new THREE.Vector3();
  const _placeFwd = new THREE.Vector3();
  const _placeRight = new THREE.Vector3();
  const _placeM = new THREE.Matrix4();
  const _placeQ = new THREE.Quaternion();

  /**
   * 贴地放置：只写位置 + 一次合成朝向（不 placeObjectOnSphere 重置再 rotateY，防抖）
   */
  function placeFoxFlat() {
    const lift = groundLiftAt(flatX, flatZ) + 0.03;
    flatToWorld(flatX, lift, flatZ, planetRadius, _placePos);
    fox.position.copy(_placePos);
    // +Y 法线；yaw 绕法线：本地 +X 朝向
    _placeUp.copy(_placePos).normalize();
    // 平面 yaw：0 朝 +X 切向
    _placeFwd.set(Math.cos(yaw), 0, Math.sin(yaw));
    // 把平面前向投到切平面
    _placeFwd.addScaledVector(_placeUp, -_placeFwd.dot(_placeUp));
    if (_placeFwd.lengthSq() < 1e-8) {
      _placeFwd.set(0, 0, 1).addScaledVector(_placeUp, -_placeUp.z);
    }
    _placeFwd.normalize();
    _placeRight.crossVectors(_placeFwd, _placeUp).normalize();
    _placeFwd.crossVectors(_placeUp, _placeRight).normalize();
    _placeM.makeBasis(_placeFwd, _placeUp, _placeRight);
    _placeQ.setFromRotationMatrix(_placeM);
    fox.quaternion.copy(_placeQ);
    fox.userData.flatX = flatX;
    fox.userData.flatZ = flatZ;
    fox.userData.yaw = yaw;
    if (fox.userData.collider?.position) {
      fox.userData.collider.position.copy(fox.position);
    }
  }

  function beginFollow(opts = {}) {
    const { toast = true, greet = true } = opts;
    fox.switchState?.("FOLLOWING");
    hideInteractionUI();
    idleMode = "follow";
    {
      const f = worldApproxFlat(fox.position, planetRadius);
      if (f) {
        flatX = f.x;
        flatZ = f.z;
        placeFoxFlat();
      }
    }
    if (elStatus) elStatus.textContent = "跟着你走中";
    if (toast) {
      const line = greet
        ? GREET_LINES[(Math.random() * GREET_LINES.length) | 0]
        : "好呀！我跟着你颠颠跑～";
      showToast(`阿狸：${line}（E 可再说话 · 聊天可让她回家）`, 2.8);
    }
  }

  function goHomeRest() {
    fox.switchState?.("SLEEPING");
    hideInteractionUI();
    idleMode = "home";
    flatX = home.x;
    flatZ = home.z;
    placeFoxFlat();
    if (fox.userData.glowRing) fox.userData.glowRing.visible = true;
    if (elStatus) elStatus.textContent = "可以打字聊天";
    showToast("阿狸回去休息了", 1.8);
    closeChat();
  }

  function openChat() {
    if (!isGameStarted?.() || !nearTalk() || isElderNear()) return;
    chatOpen = true;
    panel.hidden = false;
    if (elHint) elHint.classList.remove("show");
    if (!isFollowing()) beginFollow({ toast: true, greet: true });
    if (elLog && !elLog.dataset.greeted) {
      elLog.dataset.greeted = "1";
      appendLog("ali", GREET_LINES[(Math.random() * GREET_LINES.length) | 0]);
    }
    window.setTimeout(() => elInput?.focus(), 30);
  }

  function closeChat() {
    chatOpen = false;
    panel.hidden = true;
    elInput?.blur();
  }

  function startFollowFromChat() {
    beginFollow({ toast: true, greet: false });
    appendLog("ali", "好呀！四条小短腿出发～");
    closeChat();
  }

  function stayHere() {
    fox.switchState?.("FOLLOWING");
    if (fox.userData.glowRing) fox.userData.glowRing.visible = false;
    idleMode = "stay";
    appendLog("ali", "好，我就在这儿等你。");
    showToast("阿狸在原地等你", 1.6);
    closeChat();
  }

  function replyTo(text) {
    const t = text.trim();
    if (!t) return null;
    if (/一起走|跟着|跟我|出发|走吧|来吧|follow/.test(t)) {
      startFollowFromChat();
      return null;
    }
    if (/回去|回家|休息|睡觉|待着|别跟|解散|home/.test(t)) {
      appendLog("ali", "那我回草坡晒太阳啦……");
      goHomeRest();
      return null;
    }
    if (/你好|嗨|哈喽|hello|hi/.test(t)) return "你好呀～送信人。今天路顺吗？";
    if (/名字|你是谁|叫什么/.test(t)) return "我叫阿狸。四条腿、大火炬尾巴，就是我～";
    if (/谢谢|感谢/.test(t)) return "嘿嘿，不客气。尾巴都摇成火苗了。";
    return DEFAULT_REPLIES[(Math.random() * DEFAULT_REPLIES.length) | 0];
  }

  function onPlayerSay(raw) {
    const text = (raw || "").trim();
    if (!text) return;
    appendLog("you", text);
    const reply = replyTo(text);
    if (reply) {
      appendLog("ali", reply);
      setBubble(reply, 3.5);
    }
  }

  elForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = elInput?.value || "";
    if (elInput) elInput.value = "";
    onPlayerSay(v);
    elInput?.focus();
  });
  panel.querySelector("#fox-chat-close")?.addEventListener("click", () => closeChat());
  panel.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-cmd");
      if (cmd === "follow") startFollowFromChat();
      else if (cmd === "home") {
        appendLog("ali", "那我回草坡啦……");
        goHomeRest();
      } else if (cmd === "stay") stayHere();
    });
  });

  function onKeyDown(e) {
    if (!isGameStarted?.()) return;
    if (e.code === "Escape" && chatOpen) {
      e.preventDefault();
      closeChat();
      return;
    }
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code !== "KeyE" || e.repeat) return;
    if (isElderNear()) return;
    if (!nearTalk()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!isFollowing()) {
      beginFollow({ toast: true, greet: true });
      return;
    }
    if (chatOpen) {
      closeChat();
      return;
    }
    openChat();
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function updateBubble() {
    if (bubbleTimer <= 0 || !bubbleText || isFollowing()) {
      if (isFollowing() || bubbleTimer <= 0) {
        if (!isQuestNear()) hideBubble();
      }
      return;
    }
    if (isQuestNear()) return;
    _bubble.copy(fox.position);
    _look.copy(fox.position).normalize();
    _bubble.addScaledVector(_look, 0.9);
    _bubble.project(camera);
    if (_bubble.z < 1) {
      showBubble(
        bubbleText,
        (_bubble.x * 0.5 + 0.5) * window.innerWidth,
        (-_bubble.y * 0.5 + 0.5) * window.innerHeight
      );
    } else hideBubble();
  }

  function refreshHint() {
    if (!elHint) return;
    const show =
      !!isGameStarted?.() && nearTalk() && !isElderNear() && !chatOpen;
    elHint.classList.toggle("show", show);
    if (show) {
      elHint.innerHTML = isFollowing()
        ? "[<kbd>E</kbd>] 和阿狸说话"
        : "[<kbd>E</kbd>] 叫醒阿狸一起走";
    }
  }

  function update(dt, t) {
    if (!fox?.parent) return;
    stateT += dt;
    if (bubbleTimer > 0) {
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) {
        bubbleText = "";
        if (!isQuestNear()) hideBubble();
      }
    }

    movingAnim = false;

    if (isFollowing() && idleMode !== "stay") {
      movingAnim = updateFoxFollow(fox, player.position, planetRadius, {
        gap: FOX_FOLLOW_GAP,
        lerp: FOX_FOLLOW_LERP,
        turn: 0.18,
        time: t,
        dt,
      });
      if (fox.userData.flatX != null) {
        flatX = fox.userData.flatX;
        flatZ = fox.userData.flatZ;
      }
    } else if (isFollowing() && idleMode === "stay") {
      placeFoxFlat();
      // 原地待命：优雅坐姿 + 头部灵动追视玩家 + 尾浪
      animateFoxCompanion(fox, {
        time: t,
        dt,
        moving: false,
        playerPos: player.position,
      });
      movingAnim = false;
    } else if (!isFollowing() && idleMode === "wander") {
      const dx = walkTarget.x - flatX;
      const dz = walkTarget.z - flatZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) idleMode = "home";
      else {
        const step = Math.min(dist, WALK_SPEED * dt);
        flatX += (dx / dist) * step;
        flatZ += (dz / dist) * step;
        yaw = Math.atan2(dx, dz);
        placeFoxFlat();
        movingAnim = true;
      }
    }

    if (chatOpen && !nearTalk()) closeChat();

    updateBubble();
    refreshHint();
  }

  return {
    update,
    isNear: nearTalk,
    isChatOpen: () => chatOpen,
    isFollowing,
    dispose() {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (elHint) elHint.classList.remove("show");
      hideBubble();
      panel.remove();
    },
  };
}

function worldApproxFlat(worldPos, R) {
  const dir = worldPos.clone().normalize();
  const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  const latDeg = THREE.MathUtils.radToDeg(lat);
  const theta = THREE.MathUtils.degToRad(90 - latDeg);
  const phi = Math.atan2(dir.z, dir.x);
  const dist = theta * R;
  return { x: Math.cos(phi) * dist, z: Math.sin(phi) * dist };
}
