// =====================================================================
//  任务系统：接信 → 送达
// =====================================================================
import * as THREE from "three";
import { P } from "../core/params.js";
import { createNpc, setNpcMarker, animateMarkers } from "./npc.js";
import {
  elQuestStatus,
  elScoreNum,
  elScoreTotal,
  elLetterList,
  elCompassNeedle,
  elCompassLabel,
  elJournalPanel,
  elJournalList,
  elJournalToggle,
  elJournalClear,
  showToast,
  showBubble,
  hideBubble,
  showNpcHint,
  hideNpcHint,
} from "../ui/hud.js";
import { sfxPickup, sfxDeliver, sfxWin } from "../audio/sfx.js";
import { WORLD_SCALE } from "../world/worldScale.js";
import {
  recordDelivery,
  recordPickup,
  journalCount,
  renderJournalList,
  clearJournal,
  warmMemoryBridge,
} from "./letterJournal.js";
import { withQuestWorldIds } from "../world/citadel/questAdapter.js";

/**
 * 信件任务：寄件人 → 收件人
 * pos 的 y 会被贴到平台顶面
 */
const QUEST_DEFS_BASE = [
  {
    id: "q1",
    letter: "竹林邀请函",
    sender: { name: "小虎", pos: [3, 0, 4], color: 0xff9e6b },
    receiver: { name: "阿竹", pos: [6, 1.2, -4], color: 0x7dffb2 },
  },
  {
    id: "q2",
    letter: "夜色明信片",
    sender: { name: "月见", pos: [-7, 1.5, -2], color: 0xc9a8ff },
    receiver: { name: "星野", pos: [-9, 4.2, 7], color: 0x9ec5ff },
  },
  {
    id: "q3",
    letter: "密信 · 检查点",
    sender: { name: "驿站", pos: [0, 2.0, -12], color: 0xffe08a },
    receiver: { name: "远方", pos: [7, 3.5, 11], color: 0xff8ab8 },
  },
  {
    id: "q4",
    letter: "月光回信",
    sender: { name: "阿竹", pos: [13, 3.6, -3], color: 0x7dffb2 },
    receiver: { name: "月影", pos: [-4, 4.8, -18], color: 0xa8d4ff },
  },
];

/** 任务 NPC 是主岛布局锚点：缩放 x/z，保留 y 高度与交互半径。 */
export const QUEST_DEFS = QUEST_DEFS_BASE.map((q) =>
  withQuestWorldIds({
    ...q,
    sender: {
      ...q.sender,
      pos: [q.sender.pos[0] * WORLD_SCALE, q.sender.pos[1], q.sender.pos[2] * WORLD_SCALE],
    },
    receiver: {
      ...q.receiver,
      pos: [q.receiver.pos[0] * WORLD_SCALE, q.receiver.pos[1], q.receiver.pos[2] * WORLD_SCALE],
    },
  })
);

/**
 * @param {object} deps
 * @param {THREE.Scene} deps.scene
 * @param {object[]} deps.platforms 世界平台（用于 NPC 贴地）
 * @param {object} deps.player 玩家状态（position / holdingLetter）
 * @param {THREE.Group} deps.messengerMesh 信使模型（切换 letter 道具可见性）
 * @param {THREE.PointLight} deps.holdAura 持信光环
 * @param {THREE.PerspectiveCamera} deps.camera 气泡投影用
 * @param {() => boolean} deps.isGameStarted 未开始前不交互
 */
export function createQuestSystem({ scene, platforms, player, messengerMesh, holdAura, camera, isGameStarted }) {
  let questIndex = 0;
  let deliveredCount = 0;
  /** @type {'idle'|'carry'} */
  let questPhase = "idle";

  /** @type {Map<string, THREE.Group>} */
  const npcGroups = new Map();

  // 为每个任务创建 sender / receiver NPC
  for (const q of QUEST_DEFS) {
    npcGroups.set(`${q.id}-sender`, createNpc(scene, platforms, q.sender, "sender"));
    npcGroups.set(`${q.id}-receiver`, createNpc(scene, platforms, q.receiver, "receiver"));
  }

  elScoreTotal.textContent = String(QUEST_DEFS.length);

  // ---------- 信使记忆（信袋） ----------
  // 信袋状态行（四层记忆桥接提示）
  let elJournalStatus = document.getElementById("journal-status");
  if (!elJournalStatus && elJournalPanel) {
    elJournalStatus = document.createElement("p");
    elJournalStatus.id = "journal-status";
    elJournalStatus.className = "journal-status";
    const h2 = elJournalPanel.querySelector("h2");
    if (h2 && h2.nextSibling) elJournalPanel.insertBefore(elJournalStatus, h2.nextSibling);
    else elJournalPanel.appendChild(elJournalStatus);
  }

  function refreshJournalUI() {
    renderJournalList(elJournalList, elJournalStatus);
    if (elJournalToggle) {
      const n = journalCount();
      elJournalToggle.textContent = n > 0 ? `信袋 · ${n}` : "信袋";
    }
  }

  // 预热主站记忆模块（不阻塞）
  warmMemoryBridge().catch(() => {});

  function toggleJournal(force) {
    if (!elJournalPanel) return;
    const open =
      typeof force === "boolean" ? force : !elJournalPanel.classList.contains("open");
    elJournalPanel.classList.toggle("open", open);
    if (open) refreshJournalUI();
  }

  if (elJournalToggle) {
    elJournalToggle.addEventListener("click", (e) => {
      e.preventDefault();
      toggleJournal();
    });
  }
  if (elJournalClear) {
    elJournalClear.addEventListener("click", (e) => {
      e.preventDefault();
      clearJournal();
      refreshJournalUI();
      showToast("信袋已清空", 1.6);
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyL" && !e.repeat && !e.metaKey && !e.ctrlKey) {
      toggleJournal();
    }
  });
  refreshJournalUI();

  function setCheckpointHere() {
    if (player.checkpoint) player.checkpoint.copy(player.position);
  }

  function refreshLetterList() {
    if (!elLetterList) return;
    elLetterList.innerHTML = "";
    for (let i = 0; i < QUEST_DEFS.length; i++) {
      const q = QUEST_DEFS[i];
      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      let label = q.letter;
      if (i < questIndex) {
        dot.classList.add("done");
        li.classList.add("muted");
      } else if (i === questIndex) {
        dot.classList.add("active");
        if (questPhase === "carry") label += ` → ${q.receiver.name}`;
        else label += ` @ ${q.sender.name}`;
      }
      li.appendChild(dot);
      li.appendChild(document.createTextNode(label));
      elLetterList.appendChild(li);
    }
  }

  function refreshNpcHighlights() {
    for (let i = 0; i < QUEST_DEFS.length; i++) {
      const q = QUEST_DEFS[i];
      const s = npcGroups.get(`${q.id}-sender`);
      const r = npcGroups.get(`${q.id}-receiver`);
      const isCurrent = i === questIndex;

      if (!isCurrent) {
        setNpcMarker(s, false);
        setNpcMarker(r, false);
      } else if (questPhase === "idle") {
        setNpcMarker(s, true);
        setNpcMarker(r, false);
      } else {
        setNpcMarker(s, false);
        setNpcMarker(r, true);
      }
    }
  }

  function updateQuestUI() {
    const q = QUEST_DEFS[questIndex];
    elScoreNum.textContent = String(deliveredCount);
    refreshLetterList();

    if (!q) {
      elQuestStatus.innerHTML =
        `<span class="done">全部送达！</span><br />夜色信使任务完成。`;
      if (elCompassLabel) elCompassLabel.textContent = "完成";
      return;
    }

    if (questPhase === "idle") {
      elQuestStatus.innerHTML =
        `任务 ${questIndex + 1}：接过 <strong>${q.letter}</strong><br />` +
        `前往寄件人 <strong>${q.sender.name}</strong>`;
      if (elCompassLabel) elCompassLabel.textContent = q.sender.name;
    } else {
      elQuestStatus.innerHTML =
        `任务 ${questIndex + 1}：送达 <strong>${q.letter}</strong><br />` +
        `交给收件人 <strong>${q.receiver.name}</strong>`;
      if (elCompassLabel) elCompassLabel.textContent = q.receiver.name;
    }
  }

  /** 罗盘：针尖指向当前目标（屏幕上为相对相机前向的水平角） */
  function updateCompass() {
    if (!elCompassNeedle) return;
    const q = QUEST_DEFS[questIndex];
    if (!q) {
      elCompassNeedle.style.transform = "rotate(0deg)";
      return;
    }
    const targetNpc =
      questPhase === "idle"
        ? npcGroups.get(`${q.id}-sender`)
        : npcGroups.get(`${q.id}-receiver`);
    if (!targetNpc) return;

    // 球面：目标在玩家切平面上的方向 vs 相机前向（均去掉径向）
    const up = new THREE.Vector3().copy(player.position).normalize();
    const toTarget = new THREE.Vector3()
      .subVectors(targetNpc.position, player.position)
      .addScaledVector(up, 0);
    toTarget.addScaledVector(up, -toTarget.dot(up));
    if (toTarget.lengthSq() < 1e-8) {
      elCompassNeedle.style.transform = "rotate(0deg)";
      return;
    }
    toTarget.normalize();

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.addScaledVector(up, -camDir.dot(up));
    if (camDir.lengthSq() < 1e-8) camDir.set(0, 0, -1);
    else camDir.normalize();

    const camRight = new THREE.Vector3().crossVectors(camDir, up).normalize();
    // 相对角：在切平面用 atan2(右分量, 前分量)
    const x = toTarget.dot(camRight);
    const z = toTarget.dot(camDir);
    const deg = (-Math.atan2(x, z) * 180) / Math.PI;
    elCompassNeedle.style.transform = `rotate(${deg}deg)`;
  }

  /** 球面世界：用欧氏距离（弦长）做靠近判定，阈值略放宽 */
  function horizontalDist(a, b) {
    return a.distanceTo(b);
  }

  function tryInteract() {
    if (!isGameStarted()) return;
    const q = QUEST_DEFS[questIndex];
    if (!q) return;

    if (questPhase === "idle") {
      const s = npcGroups.get(`${q.id}-sender`);
      if (horizontalDist(player.position, s.position) <= P.talkRange) {
        questPhase = "carry";
        player.holdingLetter = true;
        messengerMesh.userData.letter.visible = true;
        holdAura.intensity = 1.2;
        setCheckpointHere();
        recordPickup({
          id: q.id,
          letter: q.letter,
          from: q.sender.name,
          to: q.receiver.name,
        });
        sfxPickup();
        showToast(`已接过「${q.letter}」→ 去找 ${q.receiver.name}`);
        refreshNpcHighlights();
        updateQuestUI();
      }
    } else {
      const r = npcGroups.get(`${q.id}-receiver`);
      if (horizontalDist(player.position, r.position) <= P.talkRange) {
        player.holdingLetter = false;
        messengerMesh.userData.letter.visible = false;
        holdAura.intensity = 0;
        deliveredCount += 1;
        setCheckpointHere();
        recordDelivery({
          id: `${q.id}_${Date.now()}`,
          letter: q.letter,
          from: q.sender.name,
          to: q.receiver.name,
        });
        refreshJournalUI();
        sfxDeliver();
        showToast(`「${q.letter}」已送达 ${q.receiver.name}！`);
        questIndex += 1;
        questPhase = "idle";
        refreshNpcHighlights();
        updateQuestUI();
        if (questIndex >= QUEST_DEFS.length) {
          sfxWin();
          const total = journalCount();
          showToast(
            `全部信件送达 · 你是真正的夜色信使（信袋共 ${total} 封）`,
            4
          );
          toggleJournal(true);
        }
      }
    }
  }

  // E 键交互（规格对齐实验页）：靠近显示「[E] 与居民交谈」，按 E 接信/送达
  const _bubbleWorld = new THREE.Vector3();

  /** 当前可交互的目标 NPC（在对话距离内才返回） */
  function currentTarget() {
    const q = QUEST_DEFS[questIndex];
    if (!q) return null;
    const key = questPhase === "idle" ? `${q.id}-sender` : `${q.id}-receiver`;
    const g = npcGroups.get(key);
    return g && horizontalDist(player.position, g.position) <= P.talkRange ? g : null;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE" || e.repeat || !isGameStarted()) return;
    if (currentTarget()) tryInteract();
  });

  function updateInteraction() {
    if (!isGameStarted()) {
      hideBubble();
      hideNpcHint();
      return;
    }

    const q = QUEST_DEFS[questIndex];
    if (!q) {
      hideBubble();
      hideNpcHint();
      return;
    }

    const near = currentTarget();
    let text = "";
    if (near) {
      text =
        questPhase === "idle"
          ? `${q.sender.name}：这封「${q.letter}」拜托你了`
          : `${q.receiver.name}：是给我的信吗？`;
      _bubbleWorld.copy(near.position);
      _bubbleWorld.y += 2.6;
      _bubbleWorld.project(camera);
      if (_bubbleWorld.z < 1) {
        showBubble(
          text,
          (_bubbleWorld.x * 0.5 + 0.5) * window.innerWidth,
          (-_bubbleWorld.y * 0.5 + 0.5) * window.innerHeight
        );
      } else {
        hideBubble();
      }
      showNpcHint();
    } else {
      hideBubble();
      hideNpcHint();
    }
  }

  refreshNpcHighlights();
  updateQuestUI();

  return {
    updateQuestUI,
    updateInteraction,
    updateCompass,
    animateMarkers: (t) => animateMarkers(npcGroups, t),
  };
}
