// =====================================================================
//  港口登陆 → 攻城梯/山路 → 古堡顶层交战样片（V6-G5）
//  纯数据。纸兵绑定走 paperBind；不替换默认 phalanx。
// =====================================================================

import { createFixedStepClock } from "../../core/fixedStep.js";
import { createEventBus } from "../../core/eventBus.js";
import { hashHex } from "../../core/rng.js";
import { createCombatAgent, decideAgent, assignClimbAssist } from "./combatAgent.js";
import { updateMovement } from "./movementMotor.js";
import { tickAttack, resolveAttack } from "./combatResolver.js";
import { createSiegeDirector, makeTrojanWave, TROJAN_RULES } from "./siegeDirector.js";
import { gaitPose, attackPose } from "./animationController.js";
import {
  LEGAL_CROSS,
  evaluateBattlefield,
  findHarbor,
  findKeep,
  nodesBy,
  pathCrossings,
} from "./battlefield.js";
import { applyPaperPose } from "./paperBind.js";

export function createCoverageMap(ids) {
  const seen = new Map((ids || []).map((id) => [id, false]));
  return {
    mark(id) {
      if (seen.has(id)) seen.set(id, true);
    },
    complete() {
      return [...seen.values()].every(Boolean);
    },
    remaining() {
      return [...seen.entries()].filter(([, v]) => !v).map(([id]) => id);
    },
    snapshot() {
      return Object.fromEntries(seen);
    },
  };
}

export function bindAgentVisual(agent, visual) {
  agent.visual = visual || { parts: {}, position: { ...agent.position } };
  return agent;
}

function recordCrossing(log, agent, point) {
  if (!point) return;
  log.push({
    agentId: agent.id,
    edgeType: point.edgeType || "walk",
    surfaceId: point.surfaceId || agent.path.currentSurfaceId,
    terraceId: point.terraceId,
  });
}

export function createHarborLandingSample(v4, opts = {}) {
  const seed = opts.seed ?? 7;
  const graph = v4.graph;
  const provider = v4.surfaces;
  const harbor = findHarbor(graph);
  const t0 = findKeep(graph, 0);
  const t1 = t0; // 兼容下方变量名；唯一战斗目标已收束为古堡顶层。
  const houses = nodesBy(graph, (n) => n.terrace === 0).slice(0, 6);
  const coverage = createCoverageMap(houses.map((h) => h.id));
  const fairness = evaluateBattlefield(v4, seed);
  const director = createSiegeDirector();
  director.issueAttack("land");
  const bus = createEventBus();
  const events = [];
  bus.on("agent.intent", (p) => events.push({ type: "intent", ...p }));
  bus.on("combat", (p) => events.push({ type: "combat", ...p }));
  bus.on("reason", (p) => events.push({ type: "reason", ...p }));
  bus.on("climb", (p) => events.push({ type: "climb", ...p }));

  const attackers = [];
  const defenders = [];
  const nAtk = opts.attackers ?? 6;
  const nDef = opts.defenders ?? 4;
  for (let i = 0; i < nAtk; i++) {
    const raw = { x: harbor.pos.x + (i % 3) * 0.35, y: harbor.pos.y, z: harbor.pos.z + Math.floor(i / 3) * 0.35 };
    const snapped = provider.sample(raw) || provider.nearest(raw);
    const pos = snapped ? { ...snapped.point } : { ...harbor.pos };
    const a = createCombatAgent({
      id: `atk:${String(i).padStart(2, "0")}`,
      role: i === 0 || i === nAtk - 1 ? "torch" : "spear-shield",
      side: "red",
      position: pos,
      surfaceId: snapped?.surfaceId || harbor.surfaceId || harbor.id,
    });
    const path = graph.findPath(pos, (houses[i % houses.length] || t1).pos, provider);
    if (path) {
      a.path.points = path.points;
      a.path.ids = path.ids;
      bus.emit("reason", { id: a.id, why: "land-harbor-castle-top", target: t0.id, edges: pathCrossings(path.points).rows });
    }
    bindAgentVisual(a, { parts: { legL: {}, legR: {}, armL: {}, armR: {}, spear: {}, shield: {}, torch: {} } });
    attackers.push(a);
  }
  for (let i = 0; i < nDef; i++) {
    const home = houses[i % houses.length] || t1;
    const d = createCombatAgent({
      id: `def:${String(i).padStart(2, "0")}`,
      role: "spear-shield",
      side: "blue",
      position: { ...home.pos },
      surfaceId: home.surfaceId || home.id,
    });
    bindAgentVisual(d, { parts: { legL: {}, legR: {}, armL: {}, armR: {}, spear: {}, shield: {} } });
    defenders.push(d);
  }

  const agents = [...attackers, ...defenders];
  const clock = createFixedStepClock();
  let maxOff = 0;
  let teleports = 0;
  let stuck = 0;
  let offSeg = 0;
  const crossings = [];

  function stepOne(a, step, tick) {
    if (a.side === "red" && a.path.points.length < 2) {
      const left = coverage.remaining();
      const candidates = houses.filter((h) => left.includes(h.id));
      candidates.sort((p, q) => Math.hypot(p.pos.x - a.position.x, p.pos.z - a.position.z) - Math.hypot(q.pos.x - a.position.x, q.pos.z - a.position.z));
      const goal = candidates[0] || t1;
      const path = graph.findPath(a.position, goal.pos, provider);
      if (path) {
        const cross = pathCrossings(path.points);
        if (!cross.ok) {
          bus.emit("reason", { id: a.id, why: "illegal-cross-rejected" });
          return;
        }
        a.path.points = path.points;
        a.path.index = 0;
        a.blockedT = 0;
        bus.emit("reason", { id: a.id, why: "repath-coverage", target: goal.id, edges: cross.rows });
      } else {
        a.blockedT = 0;
      }
    }
    decideAgent(a, { seed }, tick, bus);
    if (a.path.points.length < 2 || a.path.index >= a.path.points.length - 1) {
      applyPaperPose(a.visual?.parts, gaitPose(a), attackPose(a));
      if (a.visual) a.visual.position = { ...a.position };
      return;
    }
    const before = { ...a.position };
    const r = updateMovement(a, step, provider);
    let portalUsed = false;
    if (r.brake) {
      const next = a.path.points[Math.min(a.path.points.length - 1, a.path.index + 1)];
      if (next && LEGAL_CROSS.includes(next.edgeType) && a.blockedT > 0.35) {
        const portal = provider.projectTo(next.surfaceId, next) || provider.sample(next) || provider.nearest(next);
        if (portal) {
          a.position = { ...portal.point };
          a.path.currentSurfaceId = portal.surfaceId;
          a.path.index = Math.min(a.path.points.length - 1, a.path.index + 1);
          a.blockedT = 0;
          portalUsed = true;
          recordCrossing(crossings, a, next);
        }
      } else if (a.blockedT > 1.2) {
        a.path.points = [];
        a.path.index = 0;
      }
    }
    const jump = Math.hypot(a.position.x - before.x, a.position.y - before.y, a.position.z - before.z);
    if (!portalUsed && jump > a.maxSpeed * step * 2.5 + 0.35) teleports += 1;
    maxOff = Math.max(maxOff, r.off || 0);
    if ((r.off || 0) > 0.15) offSeg += 1;
    if (r.brake && a.blockedT > 8 && !a._stuckLogged) {
      stuck += 1;
      a._stuckLogged = true;
    }
    if (!r.brake) a._stuckLogged = false;
    const pt = a.path.points[a.path.index];
    if (pt && pt.terraceId !== undefined) recordCrossing(crossings, a, pt);
    const hid = houses.find((h) => Math.hypot(h.pos.x - a.position.x, h.pos.z - a.position.z) < 3.5);
    if (hid) coverage.mark(hid.id);
    tickAttack(a, step);
    applyPaperPose(a.visual?.parts, gaitPose(a), attackPose(a));
    if (a.visual) a.visual.position = { ...a.position };
  }

  const climbers = [0, 1].map((i) =>
    createCombatAgent({
      id: `cl:${i}`,
      role: "spear-shield",
      position: { x: t1.pos.x, y: t1.pos.y + i * 0.45, z: t1.pos.z },
      surfaceId: t1.surfaceId || t1.id,
    })
  );
  climbers[0].stamina = 0.9;
  climbers[1].courage = 0.35;
  const climbPairs = assignClimbAssist(climbers);
  for (const p of climbPairs) {
    const lo = climbers.find((a) => a.id === p.lower);
    const hi = climbers.find((a) => a.id === p.upper);
    bus.emit("climb", {
      ...p,
      contact: lo && hi ? { x: (lo.position.x + hi.position.x) / 2, y: (lo.position.y + hi.position.y) / 2, z: (lo.position.z + hi.position.z) / 2 } : null,
      events: p.kind === "push-pull" ? ["push", "pull"] : ["brace", "reach"],
    });
  }

  return {
    agents,
    attackers,
    defenders,
    director,
    bus,
    fairness,
    coverage,
    climbPairs,
    trojan: makeTrojanWave(TROJAN_RULES),
    legal: LEGAL_CROSS,
    get maxOff() {
      return maxOff;
    },
    get teleports() {
      return teleports;
    },
    get stuck() {
      return stuck;
    },
    get offSeg() {
      return offSeg;
    },
    crossings: () => crossings.slice(),
    events: () => events.slice(),
    replayHash() {
      return hashHex(JSON.stringify(events.map((e) => ({ t: e.type, id: e.id, to: e.to, why: e.why }))));
    },
    tick(dt) {
      clock.advance(dt, (step, tick) => {
        for (const a of agents) stepOne(a, step, tick);
        if (attackers[0] && defenders[0] && attackers[0].attack.phase === "contact") {
          const ev = resolveAttack(attackers[0], defenders[0], tick);
          if (ev) bus.emit("combat", ev);
        }
        if (coverage.complete() && t0 && director.attack !== "push") {
          director.issueAttack("push");
        }
      });
    },
    run(seconds) {
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) this.tick(1 / 60);
      return this.stats();
    },
    stats() {
      const illegal = crossings.filter((c) => c.edgeType && c.edgeType !== "walk" && !LEGAL_CROSS.includes(c.edgeType));
      return {
        seed,
        maxOff,
        teleports,
        stuck,
        offSeg,
        illegalCross: illegal.length,
        coverageLeft: coverage.remaining().length,
        replay: this.replayHash(),
        climbPairs: climbPairs.length,
        fairness: fairness.hash,
      };
    },
  };
}

export function selectCombatBackend(flags = {}) {
  return flags.combat === true ? "v3" : "legacy";
}
