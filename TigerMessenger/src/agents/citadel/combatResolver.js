// =====================================================================
//  战斗结算：长枪 windup/contact/recover；盾牌覆盖角；事件驱动（G7）
// =====================================================================

export const SPEAR = Object.freeze({
  reach: 2.2,
  windup: 0.28,
  contact: 0.08,
  recover: 0.42,
  turnRadius: 1.1,
  meleePenalty: 0.55,
});

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function len(v) {
  return Math.hypot(v.x, v.y, v.z);
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function norm(v) {
  const l = len(v) || 1e-8;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function tickAttack(agent, dt) {
  if (agent.intent.name !== "attack") {
    agent.attack = { phase: "idle", t: 0 };
    return agent.attack;
  }
  agent.attack.t += dt;
  const { windup, contact, recover } = SPEAR;
  if (agent.attack.phase === "idle") agent.attack.phase = "windup";
  if (agent.attack.phase === "windup" && agent.attack.t >= windup) {
    agent.attack = { phase: "contact", t: 0 };
  } else if (agent.attack.phase === "contact" && agent.attack.t >= contact) {
    agent.attack = { phase: "recover", t: 0 };
  } else if (agent.attack.phase === "recover" && agent.attack.t >= recover) {
    agent.attack = { phase: "idle", t: 0 };
  }
  return agent.attack;
}

export function resolveAttack(attacker, defender, tick, los = true) {
  if (attacker.attack.phase !== "contact") return null;
  const to = sub(defender.position, attacker.position);
  const dist = len(to);
  const close = dist < 0.7;
  const reach = SPEAR.reach * (close ? SPEAR.meleePenalty : 1);
  if (dist > reach) return { type: "attack.miss", tick, attackerId: attacker.id, defenderId: defender.id, dist };
  if (!los) return { type: "attack.blocked", tick, attackerId: attacker.id, defenderId: defender.id, reason: "los" };
  const dir = norm(to);
  const shieldFacing = dot(defender.shield.forward, { x: -dir.x, y: -dir.y, z: -dir.z });
  const shieldCovers = defender.intent.name === "block" && shieldFacing > defender.shield.coverCos;
  const height = attacker.position.y - defender.position.y;
  if (shieldCovers) {
    return { type: "attack.blocked", tick, attackerId: attacker.id, defenderId: defender.id, shield: true, height };
  }
  return {
    type: "attack.hit",
    tick,
    attackerId: attacker.id,
    defenderId: defender.id,
    height,
    stagger: height > 0.4,
  };
}

export function applyCombatEvent(event, agentsById, provider) {
  if (event.type !== "attack.hit") return null;
  const def = agentsById.get(event.defenderId);
  if (!def) return null;
  def.stamina = Math.max(0, def.stamina - 0.35);
  if (event.stagger) def.intent = { name: "stagger", score: 1 };
  if (def.stamina <= 0) {
    def.downed = true;
    def.dead = true;
    const hit = provider.sample(def.position);
    return {
      kind: "blood",
      point: hit ? hit.point : def.position,
      surfaceId: hit?.surfaceId || null,
      token: "battleBloodFresh",
    };
  }
  return null;
}
