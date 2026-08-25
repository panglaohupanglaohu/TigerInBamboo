// =====================================================================
//  Combat V3 运行时样片：表面图 + 固定步长，不替换旧 phalanx（G7/G11）
// =====================================================================

import { createFixedStepClock } from "../../core/fixedStep.js";
import { createEventBus } from "../../core/eventBus.js";
import { createCombatAgent, decideAgent, updateMovement } from "./combatAgent.js";
import { tickAttack, resolveAttack } from "./combatResolver.js";
import { createSiegeDirector } from "./siegeDirector.js";

export function createCombatV3Sim(v4, { count = 12, seed = 7 } = {}) {
  const walk = v4.surfaces.walkable();
  const n = Math.min(count, walk.length);
  const agents = [];
  for (let i = 0; i < n; i++) {
    const s = walk[i];
    agents.push(
      createCombatAgent({
        id: `v3:${String(i).padStart(3, "0")}`,
        role: i % 5 === 0 ? "torch" : "spear-shield",
        position: { ...s.centroid },
        surfaceId: s.id,
      })
    );
  }
  const bus = createEventBus();
  const director = createSiegeDirector();
  const clock = createFixedStepClock();
  let maxOff = 0;
  return {
    agents,
    director,
    bus,
    get maxOff() {
      return maxOff;
    },
    tick(dt) {
      clock.advance(dt, (step, tick) => {
        for (let i = 0; i < agents.length; i++) {
          const a = agents[i];
          if (a.path.points.length < 2) {
            const goal = walk[(tick + i) % walk.length];
            const path = v4.graph.findPath(a.position, goal.centroid, v4.surfaces);
            if (path) {
              a.path.points = path.points;
              a.path.index = 0;
            }
          }
          decideAgent(a, {}, tick, bus);
          const r = updateMovement(a, step, v4.surfaces);
          maxOff = Math.max(maxOff, r.off || 0);
          if (r.brake && a.blockedT > 1.2) {
            a.path.points = [];
            a.path.index = 0;
          }
          tickAttack(a, step);
        }
        if (agents.length >= 2 && agents[0].attack.phase === "contact") {
          const ev = resolveAttack(agents[0], agents[1], tick);
          if (ev) bus.emit("combat", ev);
        }
      });
    },
  };
}
