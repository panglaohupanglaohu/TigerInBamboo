// =====================================================================
//  CombatAgent：单兵数据 + 决策；运动/小队/姿态拆到独立文件（G6）
// =====================================================================

export { createSquadDirector } from "./squadDirector.js";
export { updateMovement } from "./movementMotor.js";
export { gaitPose, attackPose } from "./animationController.js";

export const AGENT_ROLES = Object.freeze(["spear-shield", "torch", "longbow"]);
export const INTENTS = Object.freeze([
  "idle",
  "move",
  "form",
  "brace",
  "aim",
  "attack",
  "block",
  "recover",
  "stagger",
  "down",
  "retreat",
  "climb",
  "assist",
  "wait",
]);

const HYSTERESIS = 0.12;

export function createCombatAgent(opts) {
  return {
    id: opts.id,
    role: opts.role || "spear-shield",
    side: opts.side || "blue",
    skin: opts.skin || opts.role || "spear-shield",
    radius: opts.radius ?? 0.35,
    height: 0.7,
    strideLength: 0.72,
    maxSpeed: opts.role === "torch" ? 1.7 : 2.2,
    accel: 8,
    stamina: 1,
    courage: 0.7,
    position: { ...opts.position },
    velocity: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    gaitPhase: 0,
    intent: { name: "idle", score: 0 },
    path: { ids: [], points: [], index: 0, currentSurfaceId: opts.surfaceId || null },
    blackboard: { order: null, slot: null, localThreats: [] },
    blockedT: 0,
    repathAt: -1,
    decideAt: -1,
    attack: { phase: "idle", t: 0 },
    shield: { forward: { x: 0, y: 0, z: 1 }, coverCos: 0.35 },
    weapon: { reach: 2.2, tip: { x: 0, y: 0.9, z: 1.1 } },
    downed: false,
    dead: false,
  };
}

function scoreAll(agent, world) {
  const threats = agent.blackboard.localThreats || [];
  const hasPath = agent.path.points.length > agent.path.index + 1;
  return [
    { name: "retreat", score: agent.stamina < 0.15 || agent.courage < 0.2 ? 0.9 : 0.05 },
    { name: "assist", score: threats.some((t) => t.allyDown) ? 0.7 : 0.04 },
    { name: "block", score: threats.length && agent.role === "spear-shield" ? 0.55 : 0.05 },
    { name: "attack", score: threats.some((t) => t.range < 2.4) ? 0.8 : 0.1 },
    { name: "climb", score: agent.path.points[agent.path.index]?.edgeType === "waterfall-climb" ? 0.75 : 0.02 },
    { name: "move", score: hasPath ? 0.5 : 0.1 },
    { name: "wait", score: agent.blockedT > 0.4 ? 0.4 : 0.08 },
    { name: "idle", score: 0.05 },
  ];
}

export function maxWithHysteresis(candidates, current, h = HYSTERESIS) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));
  const best = sorted[0];
  if (current && current.name !== best.name && best.score < (current.score || 0) + h) return current;
  return best;
}

export function decideAgent(agent, world, tick, bus) {
  if (tick < agent.decideAt) return agent.intent;
  agent.decideAt = tick + 8; // 8 Hz at 60 tick
  const next = maxWithHysteresis(scoreAll(agent, world), agent.intent, HYSTERESIS);
  if (next.name !== agent.intent.name) bus?.emit("agent.intent", { id: agent.id, from: agent.intent.name, to: next.name });
  agent.intent = next;
  return next;
}

export function assignClimbAssist(climbers) {
  const sorted = [...climbers].sort((a, b) => a.position.y - b.position.y || (a.id < b.id ? -1 : 1));
  const pairs = [];
  const used = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      const dy = Math.abs(sorted[j].position.y - sorted[i].position.y);
      const dlat = Math.hypot(sorted[j].position.x - sorted[i].position.x, sorted[j].position.z - sorted[i].position.z);
      if (dy < 1.1 && dlat < 0.8 && sorted[i].stamina > 0.2) {
        const lower = sorted[i];
        const upper = sorted[j];
        const kind = upper.courage < 0.5 ? "push-pull" : "brace-reach";
        pairs.push({ lower: lower.id, upper: upper.id, kind });
        used.add(lower.id);
        used.add(upper.id);
        break;
      }
    }
  }
  return pairs;
}
