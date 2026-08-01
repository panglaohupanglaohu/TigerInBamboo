// =====================================================================
//  玩家动画：走 / 跳 / idle + 披风 / 虎耳 / 持信
// =====================================================================
import * as THREE from "three";

export function updatePlayerAnim(player, messengerMesh, dt, moving) {
  const u = messengerMesh.userData;
  const sprinting =
    Math.hypot(player.velocity.x, player.velocity.z) > 8;
  const speedScale = sprinting ? 1.35 : 1;

  if (player.onGround && moving) {
    player.animPhase += dt * 10 * speedScale;
    const swing = Math.sin(player.animPhase) * 0.55;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    // 持信时右臂抬起托信，左臂仍摆动
    if (player.holdingLetter) {
      u.armL.rotation.x = -swing * 0.55;
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, -0.85, 0.2);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, -0.25, 0.2);
    } else {
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, 0, 0.2);
    }
    u.body.position.y = 0.95 + Math.abs(Math.sin(player.animPhase * 2)) * 0.04;
  } else if (!player.onGround) {
    u.legL.rotation.x = -0.35;
    u.legR.rotation.x = 0.25;
    u.armL.rotation.x = 0.5;
    u.armR.rotation.x = player.holdingLetter ? -0.7 : 0.5;
    u.armR.rotation.z = player.holdingLetter ? -0.2 : 0;
  } else {
    // idle
    player.animPhase += dt * 2;
    u.legL.rotation.x = THREE.MathUtils.lerp(u.legL.rotation.x, 0, 0.15);
    u.legR.rotation.x = THREE.MathUtils.lerp(u.legR.rotation.x, 0, 0.15);
    u.armL.rotation.x = THREE.MathUtils.lerp(u.armL.rotation.x, 0, 0.15);
    if (player.holdingLetter) {
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, -0.75, 0.15);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, -0.22, 0.15);
    } else {
      u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, 0, 0.15);
      u.armR.rotation.z = THREE.MathUtils.lerp(u.armR.rotation.z, 0, 0.15);
    }
    u.body.position.y = 0.95 + Math.sin(player.animPhase) * 0.02;
  }

  // 披风：跑/跳时后摆，idle 微晃
  if (u.cape) {
    const targetCapeX = !player.onGround
      ? 0.55
      : moving
        ? 0.35 + Math.sin(player.animPhase * 1.5) * 0.12
        : 0.08 + Math.sin(player.animPhase * 0.8) * 0.04;
    u.cape.rotation.x = THREE.MathUtils.lerp(u.cape.rotation.x, targetCapeX, 0.18);
  }

  // 虎耳 idle 颤动
  if (u.earL && u.earR) {
    const tw = Math.sin(player.animPhase * 1.7) * 0.06;
    u.earL.rotation.z = 0.25 + tw;
    u.earR.rotation.z = -0.25 - tw;
  }

  // 持信时信件微浮
  if (u.letter.visible) {
    u.letter.position.y = 1.05 + Math.sin(performance.now() * 0.006) * 0.05;
    u.letter.rotation.y += dt * 1.5;
  }
}
