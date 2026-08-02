// =====================================================================
//  玩家动画：走 / 跳 / idle
//  主路径：智能体（isAgent）悬浮脉动 + 核心旋转
//  兼容旧接口：人形 / 竹虎（userData 四肢占位）
// =====================================================================
import * as THREE from "three";

export function updatePlayerAnim(player, messengerMesh, dt, moving) {
  const u = messengerMesh.userData;
  if (!u) return;

  const sprinting = Math.hypot(player.velocity.x, player.velocity.z) > 8;
  const speedScale = sprinting ? 1.35 : 1;
  const bodyBase = u.bodyBaseY ?? 0.95;
  const letterBase = u.letterBaseY ?? 1.05;
  const isAgent = !!u.isAgent;
  const isTiger = !!u.isTiger;

  // —— 智能体：无四肢，用悬浮起伏 + 头环自转表达运动 ——
  if (isAgent) {
    // 乘电车时安静坐窗边：微起伏、头环慢转（面朝窗外由 tramRide 设 forward）
    if (player.riding) {
      player.animPhase += dt * 1.2;
      const bob = Math.sin(player.animPhase) * 0.012;
      if (u.body) u.body.position.y = bodyBase + bob;
      if (u.head) {
        u.head.rotation.z += dt * 0.35;
        u.head.position.y = 2.0 + bob * 0.4;
        // 略微前倾，像贴近车窗向外看
        u.head.rotation.x = THREE.MathUtils.lerp(u.head.rotation.x || 0, 0.18, 0.12);
      }
      if (u.letter?.visible) {
        u.letter.position.y = letterBase + bob * 0.5;
      }
      return;
    }
    player.animPhase += dt * (moving ? 8 * speedScale : 2.2);
    const bob = moving
      ? 0.04 + Math.abs(Math.sin(player.animPhase * 1.6)) * 0.05
      : Math.sin(player.animPhase) * 0.025;
    const hover = !player.onGround ? 0.08 : 0;
    if (u.body) u.body.position.y = bodyBase + bob + hover;
    if (u.head) {
      u.head.rotation.z += dt * (moving ? 2.4 : 0.9);
      u.head.position.y = 2.0 + bob * 0.5 + hover;
      u.head.rotation.x = THREE.MathUtils.lerp(u.head.rotation.x || 0, 0, 0.1);
    }
    if (u.letter?.visible) {
      u.letter.position.y = letterBase + Math.sin(performance.now() * 0.006) * 0.04;
      u.letter.rotation.y += dt * 1.5;
    }
    return;
  }

  if (!u.legL) return;

  if (player.onGround && moving) {
    player.animPhase += dt * 10 * speedScale;
    const swing = Math.sin(player.animPhase) * (isTiger ? 0.45 : 0.55);
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    if (player.holdingLetter) {
      u.armL.rotation.x = -swing * 0.4;
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, isTiger ? -0.35 : -0.85, 0.2);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, isTiger ? 0.15 : -0.25, 0.2);
    } else {
      u.armL.rotation.x = -swing * (isTiger ? 0.9 : 0.7);
      u.armR.rotation.x = swing * (isTiger ? 0.9 : 0.7);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, 0, 0.2);
    }
    if (u.body) {
      u.body.position.y = bodyBase + Math.abs(Math.sin(player.animPhase * 2)) * 0.04;
    }
  } else if (!player.onGround) {
    u.legL.rotation.x = -0.35;
    u.legR.rotation.x = 0.25;
    u.armL.rotation.x = 0.45;
    u.armR.rotation.x = player.holdingLetter ? (isTiger ? -0.4 : -0.7) : 0.45;
    u.armR.rotation.z = player.holdingLetter && !isTiger ? -0.2 : 0;
  } else {
    player.animPhase += dt * 2;
    u.legL.rotation.x = THREE.MathUtils.lerp(u.legL.rotation.x, 0, 0.15);
    u.legR.rotation.x = THREE.MathUtils.lerp(u.legR.rotation.x, 0, 0.15);
    u.armL.rotation.x = THREE.MathUtils.lerp(u.armL.rotation.x, 0, 0.15);
    if (player.holdingLetter) {
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, isTiger ? -0.3 : -0.75, 0.15);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, isTiger ? 0.12 : -0.22, 0.15);
    } else {
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, 0, 0.15);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, 0, 0.15);
    }
    if (u.body) {
      u.body.position.y = bodyBase + Math.sin(player.animPhase) * 0.02;
    }
  }

  if (u.cape && u.cape.visible !== false) {
    const targetCapeX = !player.onGround
      ? isTiger
        ? 0.35
        : 0.55
      : moving
        ? (isTiger ? 0.22 : 0.35) + Math.sin(player.animPhase * 1.5) * 0.1
        : (isTiger ? 0.12 : 0.08) + Math.sin(player.animPhase * 0.8) * 0.04;
    u.cape.rotation.x = THREE.MathUtils.lerp(u.cape.rotation.x, targetCapeX, 0.18);
  }

  if (u.earL && u.earR) {
    const tw = Math.sin(player.animPhase * 1.7) * 0.06;
    u.earL.rotation.z = 0.28 + tw;
    u.earR.rotation.z = -0.28 - tw;
  }

  if (u.letter?.visible) {
    u.letter.position.y = letterBase + Math.sin(performance.now() * 0.006) * 0.05;
    u.letter.rotation.y += dt * 1.5;
  }
}
