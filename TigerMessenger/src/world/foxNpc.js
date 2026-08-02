// =====================================================================
//  阿狸互动：对话面板输入 · 跟随同行 · 漫步/睡眠
//  - 按 E 打开聊天后，E 提示消失，可打字说话
//  - 「一起走」跟随送信人；「回去休息」回家
// =====================================================================
import * as THREE from "three";
import { placeObjectOnSphere } from "./sphereMath.js";
import { groundLiftAt } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { showBubble, hideBubble, showToast } from "../ui/hud.js";

const TALK_RANGE = 2.8;
const WAKE_RANGE = 4.2;
const HOME_RADIUS = 2.8;
const WALK_SPEED = 1.15;
const FOLLOW_SPEED = 2.6;
const FOLLOW_DIST = 1.35; // 跟随时与玩家的理想水平距

const GREET_LINES = [
  "……嗯？送信的？我是阿狸～有什么想说的吗？",
  "醒啦……你想聊点什么？也可以叫我一起走走。",
  "草好软……不过既然你来了，我就陪你说说话。",
];

const DEFAULT_REPLIES = [
  "唔……我听着呢。想去哪都可以跟我说。",
  "嗯嗯，原来是这样呀。",
  "（尾巴轻轻摇了摇）我懂的。",
  "送信辛苦啦。路还长，慢慢来。",
  "月牙湖边的风很舒服，有空可以去码头看看。",
  "老人的八音盒很好听……我有时会被吵醒。",
  "……我在听。你也可以点下面「一起走」哦。",
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
    return { update() {}, dispose() {}, isNear: () => false, isChatOpen: () => false };
  }

  const parts = fox.userData.parts || {};
  const home = {
    x: fox.userData.flatX ?? fox.userData.homeFlat?.x ?? -8.6,
    z: fox.userData.flatZ ?? fox.userData.homeFlat?.z ?? 7.2,
  };
  let flatX = home.x;
  let flatZ = home.z;
  let yaw = fox.userData.yaw ?? 0.9;

  /** @type {"sleep"|"wake"|"walk"|"talk"|"follow"} */
  let state = "sleep";
  let stateT = 0;
  let walkTarget = { x: home.x, z: home.z };
  let chatOpen = false;
  let talkCooldown = 0;
  let bubbleTimer = 0;
  let bubbleText = "";
  const _bubble = new THREE.Vector3();
  const _look = new THREE.Vector3();

  // ---------- 对话面板 DOM ----------
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

  function setBubble(text, dur = 3.8) {
    bubbleText = text.startsWith("阿狸") ? text : `阿狸：${text}`;
    bubbleTimer = dur;
  }

  function distToPlayer() {
    return player.position.distanceTo(fox.position);
  }

  function nearTalk() {
    const range = P.talkRange ? Math.min(P.talkRange + 0.4, TALK_RANGE + 0.6) : TALK_RANGE;
    return distToPlayer() <= range;
  }

  function placeFox() {
    const lift = groundLiftAt(flatX, flatZ);
    placeObjectOnSphere(fox, flatX, flatZ, lift, planetRadius);
    fox.rotateY(yaw);
    fox.userData.flatX = flatX;
    fox.userData.flatZ = flatZ;
    fox.userData.yaw = yaw;
    if (fox.userData.collider?.position) {
      fox.userData.collider.position.copy(fox.position);
    }
  }

  function pickWalkTarget() {
    const a = Math.random() * Math.PI * 2;
    const d = 0.6 + Math.random() * HOME_RADIUS;
    walkTarget = {
      x: home.x + Math.cos(a) * d,
      z: home.z + Math.sin(a) * d,
    };
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    stateT = 0;
    fox.userData.sleeping = next === "sleep";
    fox.userData.following = next === "follow";
    if (parts.lids) {
      for (const lid of parts.lids) lid.visible = next === "sleep";
    }
    if (elStatus) {
      if (next === "follow") elStatus.textContent = "跟着你走中 · 可继续聊天";
      else if (next === "sleep") elStatus.textContent = "想睡觉了……";
      else elStatus.textContent = "可以打字聊天";
    }
  }

  function openChat() {
    if (!isGameStarted?.() || !nearTalk() || isElderNear()) return;
    chatOpen = true;
    panel.hidden = false;
    // 打开聊天后立刻关掉 E 提示
    if (elHint) elHint.classList.remove("show");

    if (state === "sleep" || fox.userData.sleeping) {
      setState("wake");
      showToast("阿狸揉了揉眼睛，抬起了头……", 1.6);
    }
    if (state !== "follow") setState("talk");

    if (elLog && !elLog.dataset.greeted) {
      elLog.dataset.greeted = "1";
      const g = GREET_LINES[(Math.random() * GREET_LINES.length) | 0];
      appendLog("ali", g);
      setBubble(g, 4);
    }

    // 聚焦输入
    window.setTimeout(() => elInput?.focus(), 30);
  }

  function closeChat() {
    chatOpen = false;
    panel.hidden = true;
    elInput?.blur();
    if (state === "talk") {
      // 未跟随则回 idle 醒着
      if (!fox.userData.following) setState("wake");
    }
  }

  function startFollow() {
    setState("follow");
    appendLog("ali", "好呀！我跟你一起走～走慢一点也没关系。");
    setBubble("好呀！我跟你一起走～", 3.2);
    showToast("阿狸跟上来了 · 再说「回去休息」可让她回家", 2.8);
    closeChat();
  }

  function goHomeRest() {
    setState("walk");
    walkTarget = { x: home.x, z: home.z };
    fox.userData.following = false;
    appendLog("ali", "那我回草坡晒太阳啦……你忙完再来找我。");
    setBubble("那我回草坡啦……", 3);
    showToast("阿狸回去休息了", 1.8);
    closeChat();
  }

  function stayHere() {
    setState("wake");
    fox.userData.following = false;
    appendLog("ali", "好，我就在这儿等你。");
    setBubble("我就在这儿等你。", 2.8);
    closeChat();
  }

  /** 根据玩家输入生成阿狸回复 */
  function replyTo(text) {
    const t = text.trim();
    if (!t) return null;
    const lower = t.toLowerCase();

    if (/一起走|跟着|跟我|出发|走吧|来吧|follow|走起来/.test(t) || lower.includes("follow")) {
      startFollow();
      return null; // 已由 startFollow 写日志
    }
    if (/回去|回家|休息|睡觉|待着|别跟|解散|home/.test(t)) {
      goHomeRest();
      return null;
    }
    if (/你好|嗨|哈喽|hello|hi|早|下午好|晚上好/.test(t)) {
      return "你好呀～送信人。今天路顺吗？";
    }
    if (/名字|你是谁|叫什么/.test(t)) {
      return "我叫阿狸。就住在这片草坡上，午睡专业户。";
    }
    if (/码头|渔船|船|湖|月牙/.test(t)) {
      return "月牙湖旁边有个老码头，吊车和木箱都在，很好玩。";
    }
    if (/八音盒|老人|弹琴|音乐/.test(t)) {
      return "老人的八音盒叮叮当当的……好听，也容易把我吵醒。";
    }
    if (/信|送信|任务/.test(t)) {
      return "送信是大事。我可以陪你走一段，路上不寂寞。";
    }
    if (/累|困|休息一下/.test(t)) {
      return "那就歇会儿吧。草很软……或者让我陪你慢慢走。";
    }
    if (/谢谢|感谢/.test(t)) {
      return "嘿嘿，不客气。尾巴都摇起来了。";
    }
    if (/再见|拜拜|走了/.test(t)) {
      return "再见～有空再来草坡找我。";
    }

    return DEFAULT_REPLIES[(Math.random() * DEFAULT_REPLIES.length) | 0];
  }

  function onPlayerSay(raw) {
    const text = (raw || "").trim();
    if (!text) return;
    appendLog("you", text);
    const reply = replyTo(text);
    if (reply) {
      appendLog("ali", reply);
      setBubble(reply, 4);
      if (state === "sleep") setState("wake");
      if (state !== "follow") setState("talk");
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
      if (cmd === "follow") startFollow();
      else if (cmd === "home") goHomeRest();
      else if (cmd === "stay") stayHere();
    });
  });

  function onKeyDown(e) {
    if (!isGameStarted?.()) return;

    // Esc 关聊天
    if (e.code === "Escape" && chatOpen) {
      e.preventDefault();
      closeChat();
      return;
    }

    // 输入框内不处理 E
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.code !== "KeyE" || e.repeat) return;
    if (isElderNear()) return;

    // 已打开聊天：不再用 E 推进，也不显示提示
    if (chatOpen) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if (!nearTalk()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openChat();
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function animatePose(dt, t, moving) {
    const p = parts;
    if (!p?.body || !p.base) return;
    const b = p.base;
    const breath =
      Math.sin(t * (state === "sleep" ? 1.6 : 2.8)) * (state === "sleep" ? 0.012 : 0.008);
    const walkBob = moving ? Math.sin(t * 10) * 0.02 : 0;

    p.body.position.y = b.bodyY + breath + walkBob;
    p.body.rotation.x = b.bodyRotX + (moving ? Math.sin(t * 10) * 0.04 : 0);

    let hx = b.headRot.x;
    let hy = b.headRot.y;
    let hz = b.headRot.z;
    if (state === "sleep") {
      hx = b.headRot.x + Math.sin(t * 0.7) * 0.03;
    } else if (state === "wake" || state === "talk" || chatOpen) {
      hx = b.headRot.x - 0.28 + Math.sin(t * 2) * 0.04;
      hy = b.headRot.y + Math.sin(t * 1.3) * 0.08;
    } else if (moving) {
      hx = b.headRot.x - 0.15;
    }
    if (p.head) {
      p.head.rotation.x = hx;
      p.head.rotation.y = hy;
      p.head.rotation.z = hz;
    }

    if (p.tail) {
      const wag =
        state === "sleep"
          ? Math.sin(t * 1.2) * 0.06
          : Math.sin(t * (moving ? 9 : 3.5)) * (moving ? 0.25 : 0.12);
      p.tail.rotation.y = b.tailRot.y + wag;
      p.tail.rotation.z = b.tailRot.z + Math.sin(t * 2.1) * 0.04;
    }

    if (p.ears) {
      for (let i = 0; i < p.ears.length; i++) {
        const ear = p.ears[i];
        const baseRot = ear.userData.baseRot || { x: 0, y: 0, z: 0 };
        const flick = Math.sin(t * 5 + i * 1.7) * (state === "sleep" ? 0.04 : 0.1);
        ear.rotation.x = baseRot.x + flick;
        ear.rotation.z = baseRot.z + flick * (i === 0 ? 1 : -1) * 0.5;
      }
    }

    if (p.paws && moving) {
      for (let i = 0; i < Math.min(2, p.paws.length); i++) {
        p.paws[i].position.y = 0.04 + Math.max(0, Math.sin(t * 10 + i * Math.PI)) * 0.03;
      }
    }
  }

  function updateBubble() {
    if (bubbleTimer <= 0 || !bubbleText) {
      if (!isQuestNear() && !chatOpen) hideBubble();
      return;
    }
    if (isQuestNear()) return;
    // 聊天面板打开时仍可显示头顶短句
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
    } else {
      hideBubble();
    }
  }

  function refreshHint() {
    if (!elHint) return;
    // 聊天中 / 刚打开对话后：不显示 E 提示
    const show =
      !!isGameStarted?.() &&
      nearTalk() &&
      !isElderNear() &&
      !chatOpen;
    elHint.classList.toggle("show", show);
    if (show) {
      if (state === "follow") {
        elHint.innerHTML = "[<kbd>E</kbd>] 和阿狸说话";
      } else if (state === "sleep") {
        elHint.innerHTML = "[<kbd>E</kbd>] 叫醒阿狸";
      } else {
        elHint.innerHTML = "[<kbd>E</kbd>] 与阿狸交谈";
      }
    }
  }

  function facePlayer(dt) {
    const pFlat = worldApproxFlat(player.position, planetRadius);
    if (!pFlat) return;
    const tdx = pFlat.x - flatX;
    const tdz = pFlat.z - flatZ;
    if (tdx * tdx + tdz * tdz < 0.04) return;
    const want = Math.atan2(tdx, tdz);
    let dy = want - yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    yaw += dy * Math.min(1, dt * 3.5);
    placeFox();
  }

  function updateFollow(dt) {
    const pFlat = worldApproxFlat(player.position, planetRadius);
    if (!pFlat) return;
    // 跟在玩家略后方：朝玩家移动，保持 FOLLOW_DIST
    const dx = pFlat.x - flatX;
    const dz = pFlat.z - flatZ;
    const dist = Math.hypot(dx, dz);
    if (dist > FOLLOW_DIST + 0.15) {
      const step = Math.min(dist - FOLLOW_DIST * 0.85, FOLLOW_SPEED * dt);
      flatX += (dx / dist) * step;
      flatZ += (dz / dist) * step;
      yaw = Math.atan2(dx, dz);
      placeFox();
      return true;
    }
    if (dist > 0.2) {
      yaw = Math.atan2(dx, dz);
      placeFox();
    }
    return dist > FOLLOW_DIST + 0.05;
  }

  function update(dt, t) {
    if (!fox?.parent) return;
    stateT += dt;
    if (talkCooldown > 0) talkCooldown -= dt;
    if (bubbleTimer > 0) {
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) {
        bubbleText = "";
        if (!isQuestNear()) hideBubble();
      }
    }

    // 聊天中走远则自动关面板
    if (chatOpen && !nearTalk() && state !== "follow") {
      closeChat();
      showToast("走远了，阿狸的对话关掉了", 1.6);
    }

    let moving = false;

    if (state === "follow") {
      moving = updateFollow(dt);
    } else if (state === "walk") {
      moving = true;
      const dx = walkTarget.x - flatX;
      const dz = walkTarget.z - flatZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        // 到家则睡，否则歇着
        if (Math.hypot(flatX - home.x, flatZ - home.z) < 0.4) {
          setState("sleep");
        } else if (Math.random() < 0.4) {
          flatX = home.x;
          flatZ = home.z;
          placeFox();
          setState("sleep");
        } else {
          setState("wake");
        }
        moving = false;
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        flatX += (dx / dist) * step;
        flatZ += (dz / dist) * step;
        yaw = Math.atan2(dx, dz);
        placeFox();
      }
    } else if ((state === "talk" || state === "wake" || chatOpen) && distToPlayer() < WAKE_RANGE) {
      facePlayer(dt);
    }

    // 醒着未跟随时偶尔闲逛（聊天中不走开）
    if (state === "wake" && !chatOpen && stateT > 5 + Math.random() * 4) {
      pickWalkTarget();
      setState("walk");
    }

    animatePose(dt, t, moving);
    updateBubble();
    refreshHint();
  }

  return {
    update,
    isNear: nearTalk,
    isChatOpen: () => chatOpen,
    isFollowing: () => state === "follow",
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
  return {
    x: Math.cos(phi) * dist,
    z: Math.sin(phi) * dist,
  };
}
