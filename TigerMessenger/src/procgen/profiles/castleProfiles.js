// =====================================================================
// Castle profiles — 高山/古堡/运河统一入口（V7-G11~G13）
// profile 只描述生成 contract 与纯数据输入；Three 装配仍由现有 world
// renderer 负责。这样三种城堡共用 solver/field/MC，差异留在 profile。
// =====================================================================

import { createCitadelBlueprint, citadelBlueprintCanonicalHash } from "../../world/citadelBlueprint.js";
import { HIGHLAND_MINIMAL, ANCIENT_MINIMAL, CANAL_MINIMAL, castleFixtureHash } from "../fixtures/castleFixtures.js";
import { compileHighlandRoutePlan, compileAncientFortressPlan, compileCanalCitadelPlan } from "./profilePlanners.js";

export const CASTLE_PROFILE_VERSION = 1;

const common = Object.freeze({
  solver: Object.freeze({ maxBacktrack: 64, mode: "auto" }),
  terrain: Object.freeze({ fieldPadding: 1, isoLevel: 0, semanticChannel: true }),
  validation: Object.freeze({ requireConnectivity: true, requireSupport: true, requireWaterContinuity: false }),
});

export function createHighlandProfile(input = {}) {
  const blueprint = createCitadelBlueprint(input);
  return Object.freeze({
    version: CASTLE_PROFILE_VERSION,
    id: "highland-citadel",
    moduleSet: "highland-citadel",
    blueprint,
    blueprintHash: citadelBlueprintCanonicalHash(blueprint),
    fixtureHash: castleFixtureHash(HIGHLAND_MINIMAL),
    routePlan: compileHighlandRoutePlan({ seed: input.seed || 1, blueprint: { blueprintHash: citadelBlueprintCanonicalHash(blueprint) } }),
    routePolicy: Object.freeze({ terraces: blueprint.terrain.metrics.map((m) => m.terraceIndex), waterfallSide: "right-of-first-waterfall" }),
    ...common,
  });
}

export function createAncientProfile(input = {}) {
  const fixture = { ...ANCIENT_MINIMAL, ...input };
  return Object.freeze({
    version: CASTLE_PROFILE_VERSION,
    id: "ancient-fortress",
    moduleSet: "ancient-fortress",
    fixture: Object.freeze(fixture),
    fixtureHash: castleFixtureHash(fixture),
    routePlan: compileAncientFortressPlan({ seed: input.seed || 1, fixture }),
    routePolicy: Object.freeze({ gateToCourtyard: true, patrolLoopRequired: true }),
    ...common,
  });
}

export function createCanalProfile(input = {}) {
  const fixture = { ...CANAL_MINIMAL, ...input };
  return Object.freeze({
    version: CASTLE_PROFILE_VERSION,
    id: "canal-citadel",
    moduleSet: "canal-citadel",
    fixture: Object.freeze(fixture),
    fixtureHash: castleFixtureHash(fixture),
    routePlan: compileCanalCitadelPlan({ seed: input.seed || 1, fixture }),
    routePolicy: Object.freeze({ waterContinuous: true, bridgesHaveClearance: true }),
    ...common,
  });
}

export function createCastleProfile(kind, input = {}) {
  if (kind === "highland-citadel") return createHighlandProfile(input);
  if (kind === "ancient-fortress") return createAncientProfile(input);
  if (kind === "canal-citadel") return createCanalProfile(input);
  throw new Error(`unknown castle profile: ${kind}`);
}

export function validateCastleProfile(profile) {
  const errors = [];
  if (profile?.version !== CASTLE_PROFILE_VERSION) errors.push("version");
  if (!profile?.id || !profile?.moduleSet) errors.push("identity");
  if (!profile?.solver || !Number.isFinite(profile.solver.maxBacktrack)) errors.push("solver");
  if (!profile?.terrain || !Number.isFinite(profile.terrain.isoLevel)) errors.push("terrain");
  if (!profile?.routePolicy) errors.push("routePolicy");
  return { ok: errors.length === 0, errors };
}

export const CASTLE_PROFILE_FACTORIES = Object.freeze({
  "highland-citadel": createHighlandProfile,
  "ancient-fortress": createAncientProfile,
  "canal-citadel": createCanalProfile,
});
