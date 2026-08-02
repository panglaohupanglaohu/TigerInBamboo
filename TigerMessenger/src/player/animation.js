// =====================================================================
//  玩家动画：走 / 跳 / idle
//  兼容竹虎信使（四足 + 尾）与旧人形接口（披风 / 虎耳 / 持信）
// =====================================================================
import * as THREE from "three";

export function updatePlayerAnim(player, messengerMesh, dt, moving) {
  const u = messengerMesh.userData;
  if (!u?.legL) return;

  const sprinting = Math.hypot(player.velocity.x, player.velocity.z) > 8;
  const speedScale = sprinting ? 1.35 : 1;
  const bodyBase = u.bodyBaseY ?? 0.95;
  const letterBase = u.letterBaseY ?? 1.05;
  const isTiger = !!u.isTiger;

  if (player.onGround && moving) {
    player.animPhase += dt * 10 * speedScale;
    const swing = Math.sin(player.animPhase) * (isTiger ? 0.45 : 0.55);
    // 对角步态：左后+右前 / 右后+左前
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
    // idle
    player.animPhase += dt * 2;
    u.legL.rotation.x = THREE.MathUtils.lerp(u.legL.rotation.x, 0, 0.15);
    u.legR.rotation.x = THREE.MathUtils.lerp(u.legR.rotation.x, 0, 0.15);
    u.armL.rotation.x = THREE.MathUtils.lerp(u.armL.rotation.x, 0, 0.15);
    if (player.holdingLetter) {
      u.armR.rotation.x = THREE.MathUtils.lerp(
        u.armR.rotation.x,
        isTiger ? -0.3 : -0.75,
        0.15
      );
      u.armR.rotation.z = THREE.MathUtils.lerp(
        u.armR.rotation.z,
        isTiger ? 0.12 : -0.22,
        0.15
      );
    } else {
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, 0, 0.15);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, 0, 0.15);
    }
    if (u.body) {
      u.body.position.y = bodyBase + Math.sin(player.animPhase) * 0.02;
    }
  }

  // 尾 / 披风：跑跳后摆，idle 微晃
  if (u.cape) {
    const targetCapeX = !player.onGround
      ? isTiger
        ? 0.35
        : 0.55
      : moving
        ? (isTiger ? 0.22 : 0.35) + Math.sin(player.animPhase * 1.5) * 0.1
        : (isTiger ? 0.12 : 0.08) + Math.sin(player.animPhase * 0.8) * 0.04;
    u.cape.rotation.x = THREE.MathUtils.lerp(u.cape.rotation.x, targetCapeX, 0.18);
    // 虎尾轻微左右甩
    if (isTiger) {
      const yaw = moving ? Math.sin(player.animPhase * 0.9) * 0.18 : Math.sin(player.animPhase * 0.5) * 0.08;
      u.cape.rotation.y = THREE.MathUtils.lerp(u.cape.rotation.y, yaw, 0.12);
    }
  }

  // 虎耳 idle 颤动
  if (u.earL && u.earR) {
    const tw = Math.sin(player.animPhase * 1.7) * 0.06;
    u.earL.rotation.z = 0.28 + tw;
    u.earR.rotation.z = -0.28 - tw;
  }

  // 持信时信件微浮
  if (u.letter?.visible) {
    u.letter.position.y = letterBase + Math.sin(performance.now() * 0.006) * 0.05;
    u.letter.rotation.y += dt * 1.5;
  }
}
