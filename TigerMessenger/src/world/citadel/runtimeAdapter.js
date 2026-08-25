// =====================================================================
//  V4/V6 运行时：有蓝图就编译成 CitadelWorldSnapshot。
//  开关只决定 visual/walk/combat 消费哪一层；关开关不再把 V4 高度混进 legacy 碰撞。
// =====================================================================

import { isCitadelTownV4, isCitadelTerrainUvV2, isCitadelCombatV3 } from "../../core/params.js";
import { createPresentationDump } from "./presentation.js";
import { createEnvironmentBus } from "./environmentBus.js";
import { createSurfaceRider, createMountable } from "../surfaceRider.js";
import { createCombatV3Sim } from "../../agents/citadel/combatSim.js";
import { compileWorldSnapshot } from "./worldSnapshot.js";
import { bindRidersToSnapshot, createSnapshotCommitQueue } from "./snapshotCommit.js";

export function readCitadelSnapshotFlags() {
  return {
    town: isCitadelTownV4(),
    uv: isCitadelTerrainUvV2(),
    combat: isCitadelCombatV3(),
  };
}

/** V6 walkLift：高度只来自 snapshot surfaces，禁止回落到 legacy y。 */
export function wrapWalkLift(_fallback, v4) {
  const surfaces = v4.surfaces || v4.compiled?.surfaces;
  return function v6WalkLift(lx, lz) {
    const hit = surfaces.sampleWalkLift(lx, lz) || surfaces.nearest({ x: lx, y: 0, z: lz });
    return hit ? hit.point.y : Number.NEGATIVE_INFINITY;
  };
}

export function selectWalkLift(legacyWalkLift, snapshot) {
  if (snapshot?.sources?.walk === "v6") return wrapWalkLift(legacyWalkLift, snapshot.compiled);
  return legacyWalkLift;
}

export function weatherFromParams(P) {
  if (!P) return { weather: "clear", timeBand: "day", timeOfDay: 0.5 };
  const weather = P.weather === 1 ? "rain" : P.weather === 2 ? "snow" : P.timeOfDay > 0.82 ? "night" : P.timeOfDay > 0.7 ? "sunset" : "clear";
  const timeBand = P.timeOfDay > 0.82 ? "night" : P.timeOfDay > 0.7 ? "dusk" : "day";
  return { weather, timeBand, timeOfDay: P.timeOfDay };
}

export function attachCitadelV4Runtime({
  odysseyCitadel,
  seed = 1,
  walkLift = null,
  P = null,
  flags = null,
  onCommit = null,
} = {}) {
  const blueprint = odysseyCitadel?.userData?.blueprint;
  if (!blueprint) return null;
  const queue = createSnapshotCommitQueue();
  const env = createEnvironmentBus();
  if (P) env.set(weatherFromParams(P));
  const runtime = {
    v4: null,
    snapshot: null,
    flags: null,
    sources: null,
    env,
    walkLift,
    presentation: null,
    combat: null,
    riders: {},
    queue,
    pending: () => queue.pending(),
    recompile({ seed: nextSeed, flags: nextFlags, dirtyRegion } = {}) {
      const f = nextFlags || runtime.flags || readCitadelSnapshotFlags();
      const s = nextSeed ?? runtime.snapshot?.seed ?? seed;
      const version = (runtime.snapshot?.version || 0) + 1;
      const next = compileWorldSnapshot(blueprint, s, f, { dirtyRegion, version });
      queue.enqueue(next);
      return next;
    },
    flushCommit() {
      return queue.commitAtFrameBoundary((prev, next) => applySnapshot(runtime, prev, next, walkLift, onCommit, odysseyCitadel));
    },
    update: (dt, t, Pnow) => {
      runtime.flushCommit();
      if (Pnow) env.set(weatherFromParams(Pnow));
      runtime.combat?.tick(dt);
      for (const rider of Object.values(runtime.riders)) rider.tick?.(dt);
    },
  };
  runtime.recompile({ seed, flags: flags || readCitadelSnapshotFlags() });
  runtime.flushCommit();
  odysseyCitadel.userData.v4Runtime = runtime;
  return runtime;
}

function applySnapshot(runtime, prev, next, legacyWalkLift, onCommit, castle) {
  runtime.snapshot = next;
  runtime.v4 = next.compiled;
  runtime.flags = next.flags;
  runtime.sources = next.sources;
  runtime.walkLift = selectWalkLift(legacyWalkLift, next);
  runtime.presentation = createPresentationDump(next.compiled);
  runtime.combat = next.flags.combat ? createCombatV3Sim(next.compiled, { seed: next.seed }) : null;
  if (!Object.keys(runtime.riders).length) {
    const harbor = [...next.graph.nodes.values()].find((n) => n.flags?.harbor) || [...next.graph.nodes.values()][0];
    if (harbor) {
      runtime.riders.player = createSurfaceRider("player", next.surfaces, harbor.pos);
      runtime.riders.tram = createMountable("tram", next.surfaces, harbor.pos);
      runtime.riders.boat = createMountable("boat", next.surfaces, harbor.pos);
      runtime.riders.horse = createMountable("horse", next.surfaces, harbor.pos);
    }
  } else {
    bindRidersToSnapshot(runtime.riders, prev, next);
  }
  if (castle) {
    castle.userData.v4 = next.compiled;
    castle.userData.snapshot = next;
    castle.userData.snapshotVersion = next.version;
  }
  onCommit?.(prev, next);
}

export { snapshotSources } from "./worldSnapshot.js";
