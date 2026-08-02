// =====================================================================
//  阿狸互动：体型对齐送信人 · 呼吸/甩尾/漫步 · [E] 对话气泡
// =====================================================================
import * as THREE from "three";
import { placeObjectOnSphere } from "./sphereMath.js";
import { groundLiftAt } from "./hills.js";
import { PLANET_RADIUS } from "./planet.js";
import { P } from "../core/params.js";
import { showBubble, hideBubble, showToast } from "../ui/hud.js";

const TALK_RANGE = 2.8;
const WAKE_RANGE = 3.6;
const HOME_RADIUS = 2.8;
const WALK_SPEED = 1.15;

/** 阿狸台词（按 [E] 推进） */
const LINES_SLEEP = [
  "阿狸：……呼……（睡得很香）",
  "阿狸：……唔，草好软……再睡五分钟……",
];
const LINES_AWAKE = [
  "阿狸：嗯？送信的小信使吗？我是阿狸～",
  "阿狸：这片草坡下午最暖和，适合打个盹。",
  "阿狸：月牙湖边的码头有船，有空可以去看看。",
  "阿狸：老人的八音盒很好听……我有时会被吵醒。",
  "阿狸：你要是累了，也可以在这儿歇会儿。",
  "阿狸：信送到了就好。慢一点没关系，路还长呢。",
  "阿狸：……我再去晒一会儿太阳。有事再叫我～",
];

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {import("three").Object3D|null} deps.fox
 * @param {import("three").Camera} deps.camera
 * @param {() => boolean} deps.isGameStarted
 * @param {HTMLElement|null} [deps.elHint]
 * @param {number} [deps.planetRadius]
 * @param {() => boolean} [deps.isElderNear] 若靠近弹琴老人则不抢 E
 * @param {() => boolean} [deps.isQuestNear] 若任务 NPC 更优先则不抢气泡
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
    };
  }

  const parts = fox.userData.parts || {};
  const home = {
    x: fox.userData.flatX ?? fox.userData.homeFlat?.x ?? -8.6,
    z: fox.userData.flatZ ?? fox.userData.homeFlat?.z ?? 7.2,
  };
  let flatX = home.x;
  let flatZ = home.z;
  let yaw = fox.userData.yaw ?? 0.9;

  /** @type {"sleep"|"wake"|"walk"|"talk"} */
  let state = "sleep";
  let stateT = 0;
  let walkTarget = { x: home.x, z: home.z };
  let lineIndex = 0;
  let talking = false;
  let talkCooldown = 0;
  let bubbleTimer = 0;
  let bubbleText = "";
  const _bubble = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function distToPlayer() {
    return player.position.distanceTo(fox.position);
  }

  function nearTalk() {
    return distToPlayer() <= (P.talkRange ? Math.min(P.talkRange, TALK_RANGE) : TALK_RANGE);
  }

  function placeFox() {
    const lift = groundLiftAt(flatX, flatZ);
    placeObjectOnSphere(fox, flatX, flatZ, lift, planetRadius);
    fox.rotateY(yaw);
    fox.userData.flatX = flatX;
    fox.userData.flatZ = flatZ;
    fox.userData.yaw = yaw;
    // 同步碰撞球
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
    // 睡眼 / 醒眼
    if (parts.lids) {
      for (const lid of parts.lids) lid.visible = next === "sleep";
    }
  }

  function advanceDialogue() {
    if (!nearTalk() || !isGameStarted?.() || talkCooldown > 0) return;
    if (isElderNear()) return;

    talking = true;
    talkCooldown = 0.4;
    bubbleTimer = 4.5;

    if (state === "sleep" || fox.userData.sleeping) {
      setState("wake");
      showToast("阿狸揉了揉眼睛，抬起了头……", 1.8);
      bubbleText = "阿狸：……嗯？有人来了……我是阿狸～";
      lineIndex = 1; // 下一次从 LINES_AWAKE[1] 接
      setState("talk");
      return;
    }

    setState("talk");
    bubbleText = LINES_AWAKE[lineIndex % LINES_AWAKE.length];
    lineIndex += 1;
    if (lineIndex >= LINES_AWAKE.length) {
      lineIndex = 0;
      // 聊完一轮后去散步
      window.setTimeout(() => {
        if (state === "talk" || state === "wake") {
          talking = false;
          bubbleTimer = 0;
          pickWalkTarget();
          setState("walk");
        }
      }, 900);
    }
  }

  function onKeyDown(e) {
    if (e.code !== "KeyE" || e.repeat || !isGameStarted?.()) return;
    if (isElderNear()) return;
    if (!nearTalk()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    advanceDialogue();
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function animatePose(dt, t, moving) {
    const p = parts;
    if (!p?.body || !p.base) return;
    const b = p.base;
    const breath = Math.sin(t * (state === "sleep" ? 1.6 : 2.8)) * (state === "sleep" ? 0.012 : 0.008);
    const walkBob = moving ? Math.sin(t * 10) * 0.02 : 0;

    p.body.position.y = b.bodyY + breath + walkBob;
    p.body.rotation.x = b.bodyRotX + (moving ? Math.sin(t * 10) * 0.04 : 0);

    // 头：睡时埋，醒时抬，对话时看向玩家
    let hx = b.headRot.x;
    let hy = b.headRot.y;
    let hz = b.headRot.z;
    if (state === "sleep") {
      hx = b.headRot.x + Math.sin(t * 0.7) * 0.03;
    } else if (state === "wake" || state === "talk") {
      hx = b.headRot.x - 0.28 + Math.sin(t * 2) * 0.04;
      hy = b.headRot.y + Math.sin(t * 1.3) * 0.08;
    } else if (moving) {
      hx = b.headRot.x - 0.15;
      hy = b.headRot.y;
    }
    if (p.head) {
      p.head.rotation.x = hx;
      p.head.rotation.y = hy;
      p.head.rotation.z = hz;
    }

    // 尾巴甩动
    if (p.tail) {
      const wag =
        state === "sleep"
          ? Math.sin(t * 1.2) * 0.06
          : Math.sin(t * (moving ? 8 : 3.5)) * (moving ? 0.22 : 0.12);
      p.tail.rotation.y = b.tailRot.y + wag;
      p.tail.rotation.z = b.tailRot.z + Math.sin(t * 2.1) * 0.04;
    }

    // 耳朵轻颤
    if (p.ears) {
      for (let i = 0; i < p.ears.length; i++) {
        const ear = p.ears[i];
        const baseRot = ear.userData.baseRot || { x: 0, y: 0, z: 0 };
        const flick = Math.sin(t * 5 + i * 1.7) * (state === "sleep" ? 0.04 : 0.1);
        ear.rotation.x = baseRot.x + flick;
        ear.rotation.z = baseRot.z + flick * (i === 0 ? 1 : -1) * 0.5;
      }
    }

    // 爪子轻点（走动）
    if (p.paws && moving) {
      for (let i = 0; i < Math.min(2, p.paws.length); i++) {
        p.paws[i].position.y = 0.04 + Math.max(0, Math.sin(t * 10 + i * Math.PI)) * 0.03;
      }
    }
  }

  function updateBubble() {
    if (!talking || bubbleTimer <= 0 || !bubbleText) {
      if (!isQuestNear()) hideBubble();
      return;
    }
    // 任务 NPC 更近时不抢气泡
    if (isQuestNear()) return;

    _bubble.copy(fox.position);
    // 头顶略上（缩放后体高约 0.4–0.6）
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
    const show =
      !!isGameStarted?.() &&
      nearTalk() &&
      !isElderNear();
    elHint.classList.toggle("show", show);
    if (show) {
      elHint.innerHTML =
        state === "sleep"
          ? "[<kbd>E</kbd>] 叫醒阿狸"
          : "[<kbd>E</kbd>] 与阿狸交谈";
    }
  }

  function update(dt, t) {
    if (!fox?.parent) return;
    stateT += dt;
    if (talkCooldown > 0) talkCooldown -= dt;
    if (bubbleTimer > 0) {
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) {
        talking = false;
        if (!isQuestNear()) hideBubble();
        if (state === "talk") setState("wake");
      }
    }

    const dPlayer = distToPlayer();
    const moving = state === "walk";

    // 自动苏醒：玩家走近
    if (state === "sleep" && dPlayer < WAKE_RANGE && isGameStarted?.()) {
      // 仅靠近不强制醒；保持睡，E 才叫醒。偶尔耳朵动即可。
    }

    // 醒着时偶尔去散步
    if (state === "wake" && !talking && stateT > 4 + Math.random() * 3) {
      pickWalkTarget();
      setState("walk");
    }

    // 散步
    if (state === "walk") {
      const dx = walkTarget.x - flatX;
      const dz = walkTarget.z - flatZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        // 到点：歇一会或回家睡
        if (Math.random() < 0.35) {
          flatX = home.x;
          flatZ = home.z;
          placeFox();
          setState("sleep");
        } else {
          setState("wake");
        }
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        flatX += (dx / dist) * step;
        flatZ += (dz / dist) * step;
        yaw = Math.atan2(dx, dz);
        placeFox();
      }
      // 走太远拉回
      if (Math.hypot(flatX - home.x, flatZ - home.z) > HOME_RADIUS + 1.2) {
        walkTarget = { x: home.x, z: home.z };
      }
    }

    // 对话时面向玩家（切向近似：用平面差）
    if ((state === "talk" || state === "wake") && dPlayer < WAKE_RANGE) {
      // 用 flat 与玩家 flat 近似——从世界反推不稳，改用世界水平朝向
      // 简单：每帧微调 yaw 朝向玩家在切平面投影
      const toP = _look.copy(player.position).sub(fox.position);
      const up = fox.position.clone().normalize();
      toP.addScaledVector(up, -toP.dot(up));
      if (toP.lengthSq() > 1e-4) {
        // 当前 fox 的 local +Z 经 quaternion 后应对齐 toP
        // 用 flat 偏移更稳
        const pFlat = worldApproxFlat(player.position, planetRadius);
        if (pFlat) {
          const tdx = pFlat.x - flatX;
          const tdz = pFlat.z - flatZ;
          if (tdx * tdx + tdz * tdz > 0.04) {
            const want = Math.atan2(tdx, tdz);
            let dy = want - yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            yaw += dy * Math.min(1, dt * 3.5);
            placeFox();
          }
        }
      }
    }

    animatePose(dt, t, moving && state === "walk");
    updateBubble();
    refreshHint();
  }

  return {
    update,
    isNear: nearTalk,
    dispose() {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (elHint) elHint.classList.remove("show");
      hideBubble();
    },
  };
}

/** 世界位置 → 近似 flat XZ（与 sphereMath 约定一致） */
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
