// =====================================================================
//  送信任务：idle → carry → idle；送达后随机下一对 NPC
// =====================================================================
import * as THREE from "three";
import { findNearbyNpc } from "./npcs.js";

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {object[]} deps.npcs
 * @param {() => void} [deps.onScore]
 * @param {(carrying: boolean) => void} [deps.onCarryChange]
 */
export function createLetterQuest({ player, npcs, onScore, onCarryChange }) {
  /** @type {'idle'|'carry'} */
  let state = "idle";
  /** @type {object|null} */
  let giver = null;
  /** @type {object|null} */
  let receiver = null;

  function pickPair(excludeGiver = null) {
    if (!npcs || npcs.length < 2) return;
    let a = (Math.random() * npcs.length) | 0;
    let b = (Math.random() * npcs.length) | 0;
    let guard = 0;
    while ((a === b || (excludeGiver && npcs[a].def === excludeGiver.def)) && guard++ < 24) {
      a = (Math.random() * npcs.length) | 0;
      b = (Math.random() * npcs.length) | 0;
      if (a === b) b = (b + 1) % npcs.length;
    }
    giver = npcs[a];
    receiver = npcs[b];
  }

  // 首局：红方发、绿方收（与验收一致）；之后随机
  giver = npcs.find((n) => n.def.name === "红方") || npcs[0] || null;
  receiver = npcs.find((n) => n.def.name === "绿方") || npcs[1] || null;
  if (giver && receiver && giver === receiver) pickPair();

  function setCarry(on) {
    state = on ? "carry" : "idle";
    if (onCarryChange) onCarryChange(on);
  }

  /**
   * @returns {{ text: string, completed: boolean } | null}
   */
  function tryTalk() {
    const near = findNearbyNpc(player, npcs);
    if (!near) return null;

    if (state === "idle" && giver && near.def === giver.def) {
      setCarry(true);
      const toName = receiver?.def?.name || "对方";
      return {
        text: `请把这封信送给 ${toName}`,
        completed: false,
      };
    }
    if (state === "carry" && receiver && near.def === receiver.def) {
      setCarry(false);
      if (onScore) onScore();
      const fromName = giver?.def?.name || "寄件人";
      // 下一对：排除刚当过收件人的，尽量换新鲜组合
      const prevReceiver = receiver;
      pickPair(prevReceiver);
      const nextHint =
        giver && receiver
          ? `下一封：去找 ${giver.def.name} 接信 → 送给 ${receiver.def.name}`
          : "";
      return {
        text: nextHint ? `谢谢你！任务完成。${nextHint}` : "谢谢你！任务完成",
        completed: true,
      };
    }
    if (state === "carry" && giver && near.def === giver.def) {
      return { text: "信还在你手里，快去送给收件人吧！", completed: false };
    }
    if (state === "idle" && near.def !== giver?.def) {
      const who = giver?.def?.name || "发信人";
      return { text: `去找 ${who} 接信吧`, completed: false };
    }
    return null;
  }

  return {
    tryTalk,
    getState: () => state,
    getGiver: () => giver,
    getReceiver: () => receiver,
    isCarrying: () => state === "carry",
  };
}

/**
 * 玩家头顶信件道具（携信时显示）
 * @param {THREE.Object3D} playerMesh 玩家 mesh / group
 */
export function createCarryLetterVisual(playerMesh) {
  const group = new THREE.Group();
  const letter = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.22, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xaa8844,
      emissiveIntensity: 0.5,
      roughness: 0.5,
      flatShading: true,
    })
  );
  letter.position.y = 1.35;
  group.add(letter);

  const glow = new THREE.PointLight(0xffe08a, 0.9, 4, 2);
  glow.position.y = 1.4;
  group.add(glow);

  group.visible = false;
  playerMesh.add(group);

  return {
    setCarrying(on) {
      group.visible = !!on;
      glow.intensity = on ? 0.9 : 0;
    },
    update(t) {
      if (!group.visible) return;
      letter.position.y = 1.35 + Math.sin(t * 3) * 0.06;
      letter.rotation.y += 0.02;
    },
  };
}
