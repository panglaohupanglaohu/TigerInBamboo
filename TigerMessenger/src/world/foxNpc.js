// =====================================================================
//  阿狸互动核心：
//  - E：SLEEPING → FOLLOWING（standUp + 球面尾随）
//  - 聊天面板：一起走 / 回去休息 / 打字
//  - 主循环：updateFoxFollow（lerp + 贴球 + 四元数朝向）
// =====================================================================
import * as THREE from "three";
import { placeObjectOnSphere } from "./sphereMath.js";
import { groundLiftAt } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { showBubble, hideBubble, showToast } from "../ui/hud.js";
import { updateFoxFollow, FOX_FOLLOW_GAP, FOX_FOLLOW_LERP } from "../assets/fox.js";

const TALK_RANGE = 3.2;
const HOME_RADIUS = 2.8;
const WALK_SPEED = 1.15;

const GREET_LINES = [
  "……嗯？送信的？我是阿狸～走吧，我跟着你！",
  "醒啦！我站起来咯——带我去逛逛？",
  "草好软……不过既然你叫我，我就跟你走。",
];

const DEFAULT_REPLIES = [
  "唔……我听着呢。想去哪都可以跟我说。",
  "嗯嗯，原来是这样呀。",
  "（尾巴轻轻摇了摇）我懂的。",
  "送信辛苦啦。路还长，慢慢来。",
  "月牙湖边的码头有船，有空可以去看看。",
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

  // 确保 API 存在
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

  /** 内部玩法子状态：chat / wander（球面跟随由 fox.foxState 管） */
  let idleMode = "home"; // home | wander
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
    // 立刻隐藏 HTML 气泡与 E 提示、地面光圈
    clearBubble();
    if (elHint) elHint.classList.remove("show");
    if (fox.userData.glowRing) fox.userData.glowRing.visible = false;
    // 关聊天面板（E 直接跟随时）
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

  function placeFoxFlat() {
    const lift = groundLiftAt(flatX, flatZ) + 0.02;
    placeObjectOnSphere(fox, flatX, flatZ, lift, planetRadius);
    fox.rotateY(yaw);
    fox.userData.flatX = flatX;
    fox.userData.flatZ = flatZ;
    fox.userData.yaw = yaw;
    if (fox.userData.collider?.position) {
      fox.userData.collider.position.copy(fox.position);
    }
  }

  /**
   * 进入跟随：站立 + 隐藏 UI + 状态 FOLLOWING
   */
  function beginFollow(opts = {}) {
    const { toast = true, greet = true } = opts;
    fox.switchState?.("FOLLOWING");
    hideInteractionUI();
    idleMode = "follow";
    // 立刻贴当前地面，避免第一帧悬空
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
        : "好呀！我跟你一起走～";
      showToast(`阿狸：${line}（E 可再说话 · 聊天可让她回家）`, 2.8);
    }
  }

  /**
   * 回家睡觉
   */
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

    // 若还在睡，E 打开聊天时也站起来并跟随（符合“按 E 站立随从”）
    if (!isFollowing()) {
      beginFollow({ toast: true, greet: true });
    }

    if (elLog && !elLog.dataset.greeted) {
      elLog.dataset.greeted = "1";
      const g = GREET_LINES[(Math.random() * GREET_LINES.length) | 0];
      appendLog("ali", g);
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
    appendLog("ali", "好呀！我跟你一起走～");
    closeChat();
  }

  function stayHere() {
    // 站立但不强制贴玩家（仍保持 FOLLOWING 姿态，停在原地）
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
    if (/名字|你是谁|叫什么/.test(t)) return "我叫阿狸。现在可以跟着你环球跑哦。";
    if (/码头|渔船|船|湖|月牙/.test(t)) return "月牙湖旁边有个老码头，吊车和木箱都在。";
    if (/累|困/.test(t)) return "那就歇会儿吧。或者让我陪你慢慢走。";
    if (/谢谢|感谢/.test(t)) return "嘿嘿，不客气。短腿摇起来了。";
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

    // 核心：E → 站立并跟随；再按 E 打开聊天
    if (!isFollowing()) {
      beginFollow({ toast: true, greet: true });
      return;
    }
    // 已跟随：打开聊天（不重复 standUp）
    if (chatOpen) {
      closeChat();
      return;
    }
    openChat();
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function animatePose(dt, t, moving) {
    const p = parts;
    if (!p?.base) return;
    const following = isFollowing();
    const elapsed = t; // 与 clock.getElapsedTime() 等价（主循环秒）
    // 规范：hips.rotation.y = sin(t * 10) * 0.15（行走时扭臀带动大尾巴）
    const gait = elapsed * (moving ? 10 : 3.5);

    if (following && p.hips && p.chest) {
      // ---- 行走形态：扭屁股 + 胸腔反相微摆 ----
      if (moving) {
        p.hips.rotation.y = Math.sin(gait) * 0.15;
        p.chest.rotation.y = Math.sin(gait + Math.PI) * 0.06; // 反相更灵动
        p.hips.position.y = Math.sin(gait * 2) * 0.012; // 轻弹
      } else {
        // 站立待机：很轻的呼吸扭
        p.hips.rotation.y = Math.sin(elapsed * 2.2) * 0.04;
        p.chest.rotation.y = Math.sin(elapsed * 2.2 + 1) * 0.02;
        p.hips.position.y = 0;
      }

      // ---- 火炬火焰尾：多级链式相位延迟（S 形蛇行 + 火苗上蹿）----
      // 不整根 sin；j1…j5 逐级 time-phase offset，像随风拉伸的灵动火焰
      const joints = p.tailJoints;
      if (joints && joints.length) {
        // 奔跑更快更烈；待机仍保持轻柔火苗感
        const freq = moving ? 15 : 6.5;
        const ampScale = moving ? 1 : 0.38;
        const time = elapsed * freq;
        // 规范相位：0, -0.3, -0.6, -0.9,（第5节再滞后）
        const phaseY = [0, 0.3, 0.6, 0.9, 1.2];
        const ampY = [0.2, 0.25, 0.3, 0.35, 0.4];
        // 垂直火苗：交错 cos，尾尖更跳
        const phaseX = [0.2, 0.55, 0.9, 1.25, 1.6];
        const ampX = [0.06, 0.09, 0.12, 0.16, 0.2];

        for (let i = 0; i < joints.length; i++) {
          const j = joints[i];
          const br = j.userData.baseRot || { x: 0, y: 0, z: 0 };
          const py = phaseY[i] ?? i * 0.3;
          const px = phaseX[i] ?? i * 0.35;
          const ay = (ampY[i] ?? 0.25) * ampScale;
          const ax = (ampX[i] ?? 0.1) * ampScale;
          // S 形蛇摆（左右）
          j.rotation.y = br.y + Math.sin(time - py) * ay;
          // 火焰蹿动（上下微翘 / 起伏）
          j.rotation.x = br.x + Math.cos(time - px) * ax;
          // 轻微侧倾，避免平面纸片感
          j.rotation.z = br.z + Math.sin(time * 0.85 - py * 0.7) * ax * 0.45;
        }
        // 尾根附着：保持指向身后 + 微抬，整体不另加硬 sin
        if (p.tail) {
          p.tail.rotation.order = "ZYX";
          p.tail.rotation.z = Math.PI / 2;
          p.tail.rotation.x =
            THREE.MathUtils.degToRad(12) + Math.sin(time * 0.5) * (moving ? 0.04 : 0.02);
          p.tail.rotation.y = Math.sin(time * 0.35) * (moving ? 0.05 : 0.02);
        }
      }

      // 头轻点
      if (p.walkHead) {
        p.walkHead.rotation.x = Math.sin(elapsed * 2.5) * 0.04;
        p.walkHead.rotation.y = Math.sin(elapsed * 1.7) * 0.05;
      }

      // 耳朵
      if (p.walkHead) {
        p.walkHead.traverse((o) => {
          if (!o.userData?.baseRot) return;
          const br = o.userData.baseRot;
          o.rotation.x = br.x + Math.sin(elapsed * 5) * 0.08;
        });
      }

      // 四短腿对角步态（腿已挂在 chest/hips 上，扭臀会带动后腿）
      const legs = p.legMeshes || [];
      if (moving && legs.length) {
        for (let i = 0; i < legs.length; i++) {
          const phase = i === 0 || i === 3 ? 0 : Math.PI;
          legs[i].rotation.x = Math.sin(gait + phase) * 0.5;
          // 微抬脚，增强「在地上跑」的节奏
          const baseY = legs[i].userData.baseY;
          if (baseY == null) legs[i].userData.baseY = legs[i].position.y;
          const lift = Math.max(0, Math.sin(gait + phase)) * 0.04;
          legs[i].position.y = (legs[i].userData.baseY ?? legs[i].position.y) + lift;
        }
      } else if (legs.length) {
        for (const leg of legs) {
          leg.rotation.x = 0;
          if (leg.userData.baseY != null) leg.position.y = leg.userData.baseY;
        }
      }
      return;
    }

    // ---- 睡姿微动 ----
    if (p.body) {
      const breath = Math.sin(elapsed * 1.6) * 0.012;
      p.body.position.y = (p.base.bodyY || 0.19) + breath;
    }
    if (p.tail && p.sleepG?.visible !== false) {
      p.tail.rotation.y = Math.sin(elapsed * 1.1) * 0.04;
    }
  }

  function updateBubble() {
    if (bubbleTimer <= 0 || !bubbleText || isFollowing()) {
      // 跟随中不常驻气泡
      if (isFollowing() || bubbleTimer <= 0) {
        if (!isQuestNear()) hideBubble();
      }
      return;
    }
    if (isQuestNear()) return;
    _bubble.copy(fox.position);
    _look.copy(fox.position).normalize();
    _bubble.addScaledVector(_look, 0.85);
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
    // 聊天中 / 刚开始跟随时：隐藏 E 提示
    const show =
      !!isGameStarted?.() && nearTalk() && !isElderNear() && !chatOpen;
    elHint.classList.toggle("show", show);
    if (show) {
      elHint.innerHTML = isFollowing()
        ? "[<kbd>E</kbd>] 和阿狸说话"
        : "[<kbd>E</kbd>] 叫醒阿狸一起走";
    }
  }

  /**
   * 主循环入口
   */
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
      // ---------- 地面贴地尾随（平面插值 + groundLiftAt） ----------
      movingAnim = updateFoxFollow(fox, player.position, planetRadius, {
        gap: FOX_FOLLOW_GAP,
        lerp: FOX_FOLLOW_LERP,
        turn: 0.16,
      });
      if (fox.userData.flatX != null) {
        flatX = fox.userData.flatX;
        flatZ = fox.userData.flatZ;
      }
    } else if (isFollowing() && idleMode === "stay") {
      // 原地等待：仍贴地 + 播放待机动画（火苗尾轻摇）
      placeFoxFlat();
      movingAnim = false;
    } else if (!isFollowing() && idleMode === "wander") {
      // 未跟随的闲逛（仅 SLEEPING 前的 wake 路径已弱化；保留回家后安静）
      const dx = walkTarget.x - flatX;
      const dz = walkTarget.z - flatZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        idleMode = "home";
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        flatX += (dx / dist) * step;
        flatZ += (dz / dist) * step;
        yaw = Math.atan2(dx, dz);
        placeFoxFlat();
        movingAnim = true;
      }
    }

    // 聊天走远自动关
    if (chatOpen && !nearTalk()) {
      closeChat();
    }

    animatePose(dt, t, movingAnim);
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


