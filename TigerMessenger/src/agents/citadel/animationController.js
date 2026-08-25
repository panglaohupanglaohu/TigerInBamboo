// =====================================================================
//  步态姿态：速度驱动腿臂反相；持盾/长枪/火炬各有约束（G6）
//  只订阅运动与战斗事件，不判定命中。
// =====================================================================

export function gaitPose(agent) {
  const p = agent.gaitPhase;
  const amp = Math.min(1, Math.hypot(agent.velocity.x, agent.velocity.z) / agent.maxSpeed);
  const legL = Math.sin(p) * 0.55 * amp;
  const legR = Math.sin(p + Math.PI) * 0.55 * amp;
  const armR = agent.role === "spear-shield" ? 0.12 * amp : Math.sin(p) * 0.4 * amp;
  const armL =
    agent.role === "torch" ? 0.8 : agent.role === "spear-shield" ? 0.05 : Math.sin(p + Math.PI) * 0.4 * amp;
  return { legL, legR, armL, armR, amp };
}

export function attackPose(agent) {
  const phase = agent.attack?.phase || "idle";
  if (phase === "windup") return { spear: 0.35, shield: 0.2 };
  if (phase === "contact") return { spear: 1, shield: 0.45 };
  if (phase === "recover") return { spear: 0.15, shield: 0.3 };
  return { spear: 0, shield: agent.intent?.name === "block" ? 0.8 : 0.1 };
}
