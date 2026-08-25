// =====================================================================
// Planet V8 compiler vertical slice:
// manifest → geodesic main/dual grid → spherical WFC → global field → MC
// chart → semantic bake.  It returns serializable generation data and does
// not import Three.js, so it can run in a Worker.
// =====================================================================

import { createLandmarkManifest, createContinuousLandformManifest, validateLandmarkManifest, landmarkManifestHash, DEFAULT_LANDMARK_MANIFEST } from "../../world/planetV8/landmarkManifest.js";
import { buildGeodesicMainAndDualGrid } from "./geodesicGrid.js";
import { createTerrainTiles } from "./terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "./sphericalWfc.js";
import { createPlanetFieldRecipe, createRadialChartField } from "./planetFieldComposer.js";
import { bakeTerrainSemantic } from "./terrainSemanticBake.js";
import { marchingCubes } from "../field/marchingCubes.js";
import { createEmptyPlanetSnapshot, createPlanetVersionManifest, validatePlanetSnapshot } from "./schema.js";
import { compileCurvedWater, validateCurvedWater } from "../../world/waterV8/curvedWaterCompiler.js";
import { createSurfaceProviderV8 } from "../../world/planetV8/surfaceProviderV8.js";
import { compilePlanetNavigationV8, compileManifestPortals, validatePlanetNavigation } from "../../world/planetV8/navigationV8.js";
import { compileLandmarkTerrainRoutes, LANDFORM_CHAIN_ROUTE_DEFINITIONS } from "../../world/planetV8/terrainRoutesV8.js";
import { compilePlanetClouds } from "../../render/clouds/heroCloudCompiler.js";
import { validatePlanetTopology } from "./planetValidatorsV8.js";
import { validateChartSeams } from "./chartSeamValidator.js";
import { validatePlanetGlobalConstraints, measurePlanetArea } from "./globalConstraints.js";
import { validateBookshopHillChain } from "../../world/planetV8/profileValidators.js";
import { compileVegetationV9 } from "./vegetationCompilerV9.js";
import { compileCombatSurfaceV8 } from "../../world/planetV8/combatSurfaceV8.js";
import { validateChainCoverage, validateElevationNarrative, validateFinalElevationNarrative, validateChainAdjacency, landformChainHash, LANDFORM_CHAIN_VERSION, buildTransitionCollars } from "./landformChainV8.js";
import { validateHighlandWaterfallLanding, validateLandformRouteMetadata, validateCombatKeepouts } from "../../world/planetV8/landformGameplayContracts.js";

function createChartScalarField(recipe, chart, { radialMin = -4, radialMax = 8, span = 10, resolution = 24 } = {}) {
  const local = createRadialChartField(recipe, {
    centerDirection: chart.centerDirection,
    tangentU: chart.tangentU,
    tangentV: chart.tangentV,
    radialMin,
    radialMax,
    span,
    resolution,
  });
  const data = new Float32Array(resolution * resolution * resolution);
  const index = (x, y, z) => (z * resolution + y) * resolution + x;
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    data[index(x, y, z)] = local.sample(local.worldPosition(x, y, z));
  }
  return {
    min: local.min,
    max: local.max,
    resolution: { x: resolution, y: resolution, z: resolution },
    spacing: [
      (local.max[0] - local.min[0]) / (resolution - 1),
      (local.max[1] - local.min[1]) / (resolution - 1),
      (local.max[2] - local.min[2]) / (resolution - 1),
    ],
    data,
    index,
    valueAt(x, y, z) { return data[index(x, y, z)]; },
    worldPosition(x, y, z) { return local.worldPosition(x, y, z); },
    sampleWorld(position, outside = 0) { return recipe.sample(position) ?? outside; },
  };
}

function chartBasis(direction) {
  const up = direction.slice();
  const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross = [
    ref[1] * up[2] - ref[2] * up[1],
    ref[2] * up[0] - ref[0] * up[2],
    ref[0] * up[1] - ref[1] * up[0],
  ];
  const l = Math.hypot(...cross) || 1;
  const tangentU = cross.map((n) => n / l);
  const tangentV = [
    up[1] * tangentU[2] - up[2] * tangentU[1],
    up[2] * tangentU[0] - up[0] * tangentU[2],
    up[0] * tangentU[1] - up[1] * tangentU[0],
  ];
  return { tangentU, tangentV };
}

function lowerWaterfallDirection(landmark) {
  const direction = landmark.direction.slice();
  const forward = landmark.forward || [0, 0, 1];
  const projected = [
    forward[0] - direction[0] * (forward[0] * direction[0] + forward[1] * direction[1] + forward[2] * direction[2]),
    forward[1] - direction[1] * (forward[0] * direction[0] + forward[1] * direction[1] + forward[2] * direction[2]),
    forward[2] - direction[2] * (forward[0] * direction[0] + forward[1] * direction[1] + forward[2] * direction[2]),
  ];
  const length = Math.hypot(...projected) || 1;
  const offset = Math.max(0.08, landmark.angularRadius * 1.6);
  return direction.map((value, index) => value + projected[index] / length * offset)
    .map((value, index, values) => value / (Math.hypot(...values) || 1));
}

function prepareCharts(grid, assignment, landmarks, chartLimit) {
  const interesting = [];
  for (const landmark of landmarks) {
    let best = -1; let score = -Infinity;
    for (const cell of grid.dual.cells()) {
      const direction = grid.dual.directionOf(cell.index);
      const current = direction[0] * landmark.direction[0] + direction[1] * landmark.direction[1] + direction[2] * landmark.direction[2];
      if (current > score) { score = current; best = cell.index; }
    }
    if (best >= 0) interesting.push(best);
  }
  const selected = [...new Set(interesting)].slice(0, chartLimit);
  return selected.map((cellIndex, index) => {
    const centerDirection = grid.dual.directionOf(cellIndex);
    const { tangentU, tangentV } = chartBasis(centerDirection);
    return { id: `planet-chart:${index}`, cellIndex, centerDirection, tangentU, tangentV, assignment: assignment.get(grid.dual.cellId(cellIndex)) || null };
  });
}

function trianglesFromMesh(mesh, recipe) {
  const triangles = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    if (indices.some((index) => index == null)) continue;
    const points = indices.map((index) => [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]]);
    triangles.push({ a: points[0], b: points[1], c: points[2], semantic: recipe.semanticAt(points[0]) });
  }
  return triangles;
}

function landmarkForDirection(direction, landmarks) {
  return landmarks
    .map((landmark) => ({ landmark, score: landmark.direction[0] * direction[0] + landmark.direction[1] * direction[1] + landmark.direction[2] * direction[2] }))
    .sort((a, b) => b.score - a.score || a.landmark.id.localeCompare(b.landmark.id))[0]?.landmark || null;
}

export function compilePlanetV8({ seed = 1, radius = 160, subdivision = 1, chartLimit = 6, resolution = 24, landmarks = DEFAULT_LANDMARK_MANIFEST, seaLevel = 0, landformChain = false, stopAfter = null } = {}) {
  const manifest = landformChain
    ? createContinuousLandformManifest({ entries: landmarks, seed })
    : createLandmarkManifest({ entries: landmarks, seed });
  const manifestCheck = validateLandmarkManifest(manifest);
  if (!manifestCheck.ok) return { ok: false, stage: "manifest", report: manifestCheck };
  // The continuous chain owns the main landmass pins.  Legacy side landmarks
  // (old harbor/moon lake/white-whale lake) remain in the manifest for
  // cameras and water events, but must not compete for the same coarse WFC
  // cells and split the main chain.
  const chainManifest = landformChain ? manifest.filter((entry) => entry.chainOrder != null) : [];
  const solverLandmarks = landformChain ? chainManifest : manifest;
  const grid = buildGeodesicMainAndDualGrid({ radius, subdivision, seed, preserve: manifest.map((entry) => entry.direction) });
  const wfc = solveSphericalTerrain({ graph: grid.dual, landmarks: solverLandmarks, tiles: createTerrainTiles(), seed, maxBacktrack: 64 });
  if (!wfc.ok) return { ok: false, stage: "wfc", report: wfc };
  const assignment = new Map(Object.entries(terrainAssignmentMap(wfc)));
  const chainReport = landformChain ? validateChainCoverage({ chain: chainManifest, grid, assignment }) : null;
  const elevationReport = landformChain ? validateElevationNarrative({ chain: chainManifest }) : null;
  if (landformChain && (!chainReport.ok || !elevationReport.ok)) return { ok: false, stage: "landform-chain", report: { chainReport, elevationReport }, grid, wfc, manifest };
  const field = createPlanetFieldRecipe({
    radius,
    seaLevel,
    grid,
    landmarks: manifest,
    assignment,
    transitionCollars: landformChain ? buildTransitionCollars(chainManifest, { radius }) : [],
  });
  const finalElevationReport = landformChain ? validateFinalElevationNarrative({ field, chain: chainManifest }) : null;
  if (landformChain && !finalElevationReport.ok) return { ok: false, stage: "final-elevation", report: finalElevationReport, grid, wfc, field, manifest };
  // P0-2 (2026-08-24): the field-level chain adjacency gate.  It samples the
  // final field along every inter-landmark great arc and requires (1) the
  // saddle midpoint strictly between the two section cores, (2) no open ocean
  // notch (semantic water below shelf floor), (3) the triple-gate saddle
  // strictly between the highland terrace and the canyon floor.  Previously
  // this validator existed but was never called — every other gate passed
  // while the profile read as six bumps in shallow water.
  const chainAdjacencyReport = landformChain ? validateChainAdjacency({ field, chain: chainManifest }) : null;
  if (landformChain && !chainAdjacencyReport.ok) return { ok: false, stage: "chain-adjacency", report: chainAdjacencyReport, grid, wfc, field, manifest };
  const basins = manifest
    .filter((entry) => entry.waterNeeds === "closed-lake-basin" || entry.waterNeeds === "local-cistern" || entry.waterNeeds === "lower-waterfall-basin")
    .map((entry) => ({
      id: entry.waterNeeds === "lower-waterfall-basin" ? "highland-waterfall-l1-basin" : entry.id,
      direction: entry.waterNeeds === "lower-waterfall-basin" ? lowerWaterfallDirection(entry) : entry.direction,
      angularRadius: entry.waterNeeds === "lower-waterfall-basin" ? Math.min(0.1, entry.angularRadius * 0.55) : entry.angularRadius,
      level: seaLevel + (entry.waterNeeds === "lower-waterfall-basin" ? 0.02 : 0.08),
      semantic: entry.profile === "swamp-lake" ? "wetland" : entry.profile === "navona-water-court" ? "local-cistern" : entry.waterNeeds === "lower-waterfall-basin" ? "waterfall-basin" : "inland-water",
      globalRoute: entry.waterNeeds !== "local-cistern" && entry.waterNeeds !== "lower-waterfall-basin",
      elongation: entry.landformClass === "rift-long-lake" ? 2.4 : 1,
      islandCount: entry.landformClass === "rift-long-lake" ? 3 : 0,
    }));
  const harborAnchors = manifest.filter((entry) => entry.waterNeeds === "coast").map((entry) => ({
    id: entry.id,
    direction: entry.direction,
    clearance: 2.4,
    minWidth: 2.4,
    maxDraft: 0.8,
    surfaceId: "curved-ocean-shell-v8",
    landformClass: entry.landformClass || "coastal-water",
  }));
  const water = compileCurvedWater({ grid, radius, seaLevel, basins, harborAnchors, fieldRecipe: field });
  const waterReport = validateCurvedWater(water);
  if (!waterReport.ok) return { ok: false, stage: "water", report: waterReport, grid, wfc, field };
  const surface = createSurfaceProviderV8({ radius, field, water });
  const globalReport = validatePlanetGlobalConstraints({ grid, assignment, manifest: landformChain ? chainManifest : manifest, water });
  if (!globalReport.ok) return { ok: false, stage: "global-constraints", report: globalReport, grid, wfc, field, water };
  const portals = compileManifestPortals(grid, manifest);
  surface.registerPortals?.(portals);
  const navigation = compilePlanetNavigationV8({ grid, surface, portals, landmarks: manifest });
  const navReport = validatePlanetNavigation(navigation);
  if (!navReport.ok) return { ok: false, stage: "navigation", report: navReport, grid, wfc, field, water };
  const terrainRoutes = compileLandmarkTerrainRoutes({ navigation, manifest, definitions: landformChain ? LANDFORM_CHAIN_ROUTE_DEFINITIONS : undefined });
  if (!terrainRoutes.ok) return { ok: false, stage: "terrain-routes", report: terrainRoutes, grid, wfc, field, water, navigation };
  const routeMetadataReport = landformChain ? validateLandformRouteMetadata(terrainRoutes.routes) : { ok: true, errors: [] };
  if (!routeMetadataReport.ok) return { ok: false, stage: "terrain-route-metadata", report: routeMetadataReport, grid, wfc, field, water, navigation, terrainRoutes };
  const waterfallReport = landformChain
    ? validateHighlandWaterfallLanding({ field, water, manifest, radius })
    : null;
  if (landformChain && !waterfallReport.ok) return { ok: false, stage: "highland-waterfall-landing", report: waterfallReport, grid, wfc, field, water, navigation, terrainRoutes };
  const bookshopRoute = terrainRoutes.routes.find((route) => route.id === "route:bookshop-saihoji");
  const bookshop = manifest.find((entry) => entry.id === "bookshop-town");
  const bookshopLinks = globalReport.links.connections.find((link) => link.from === "bookshop-town" && link.to === "saihoji-moss-garden");
  const bookshopDoor = bookshop ? chartBasis(bookshop.direction).tangentV.map((value, index) => bookshop.direction[index] + value * 0.025) : null;
  const bookshopDoorSample = bookshopDoor ? surface.sample(bookshopDoor) : null;
  const bookshopBaseSample = bookshop ? surface.sample(bookshop.direction) : null;
  const bookshopDoorDistance = bookshopDoorSample && bookshopBaseSample
    ? Math.hypot(...bookshopDoorSample.position.map((value, index) => value - bookshopBaseSample.position[index]))
    : 1;
  const bookshopDoorSlope = bookshopDoorSample && bookshopBaseSample
    ? Math.abs(bookshopDoorSample.height - bookshopBaseSample.height) / Math.max(bookshopDoorDistance, 1e-6)
    : 0;
  const bookshopReport = validateBookshopHillChain({
    route: bookshopRoute?.points || [],
    doorSlope: bookshopDoorSlope,
    connected: !!bookshopLinks?.connected,
    saddle: !!bookshopLinks?.saddle,
    tramRoute: bookshopRoute?.mode === "walk-tram",
  });
  if (!bookshopReport.ok) return { ok: false, stage: "bookshop-hills", report: bookshopReport, grid, wfc, field, water, navigation, terrainRoutes };
  // 千 seed 路线门用的提前出口（V9 seed gates）：field/water/nav/routes/bookshop
  // 全部走生产代码路径，只跳过 chart MC/语义/云等重装配阶段。
  if (stopAfter === "routes") {
    return { ok: true, stage: "routes", grid, wfc, field, water, navigation, terrainRoutes, waterfallReport, bookshopReport, manifest };
  }
  const combatSurface = compileCombatSurfaceV8({ manifest, surface, radius });
  const combatReport = validateCombatKeepouts(combatSurface);
  if (!combatReport.ok) return { ok: false, stage: "combat-keepout", report: combatReport, grid, wfc, field, water, navigation, terrainRoutes, combatSurface };
  const topologyReport = validatePlanetTopology({ grid, assignment, manifest, water, navigation });
  if (!topologyReport.ok) return { ok: false, stage: "planet-topology", report: topologyReport, grid, wfc, field, water, navigation };
  const cloudCells = grid.dual.cells().map((cell) => ({ ...cell, direction: grid.dual.directionOf(cell.index) }));
  const cloudSemantics = new Map(cloudCells.map((cell) => {
    const nearest = landmarkForDirection(cell.direction, manifest);
    const cloudChainBand = {
      "bookshop-town": "bookshop-old-harbor",
      "swamp-lake": "swamp-white-whale-lake",
      "crystal-canyon": "crystal-canyon",
      "triple-gate": "triple-gate",
      "highland-citadel": "highland-citadel",
    }[nearest?.id] || null;
    return [cell.id, {
      ...field.semanticAt(cell.direction),
      landformClass: nearest?.landformClass || null,
      landmarkId: nearest?.id || null,
      cloudChainBand,
    }];
  }));
  const clouds = compilePlanetClouds({
    cells: cloudCells,
    semantics: cloudSemantics,
    water,
    seed,
    landmarks: manifest,
    field,
  });
  const charts = prepareCharts(grid, assignment, manifest, chartLimit).map((chart) => {
    const scalar = createChartScalarField(field, chart, { radialMin: -4, radialMax: 8, span: 10, resolution });
    const mesh = marchingCubes(scalar, { isoLevel: 0, normalMode: "gradient" });
    const semantic = bakeTerrainSemantic({ positions: mesh.positions, normals: mesh.normals, recipe: field });
    return { ...chart, mesh, semantic };
  });
  const vegetationByChart = charts.map((chart) => {
    const profileLandmark = landmarkForDirection(chart.centerDirection, manifest);
    const keepouts = manifest
      .filter((entry) => entry.id !== "saihoji-moss-garden")
      .map((entry) => ({
        id: entry.id,
        position: entry.direction.map((value, index) => value * (radius + field.heightAt(entry.direction))),
        radius: entry.angularRadius * radius * 0.35,
      }));
    for (const zone of combatSurface.zones) {
      for (const keepout of zone.keepouts) {
        keepouts.push({ id: `${zone.id}:${keepout.id}`, position: keepout.position, radius: keepout.radius });
      }
    }
    return compileVegetationV9({
      triangles: trianglesFromMesh(chart.mesh, field),
      profile: profileLandmark?.profile || "default",
      seed: seed + chart.cellIndex,
      keepouts,
      maxInstances: 240,
    });
  });
  surface.registerCharts?.(charts);
  const seamReport = validateChartSeams(charts.map((chart) => chart.mesh));
  const snapshot = createEmptyPlanetSnapshot({ seed });
  snapshot.graph.mainHash = grid.hash;
  snapshot.graph.dualHash = grid.hash;
  snapshot.graph.landmarkPins = manifest.map((entry) => ({ id: entry.id, direction: entry.direction, profile: entry.profile, hardLocks: entry.hardLocks }));
  snapshot.graph.landmarkHash = landmarkManifestHash(manifest);
  if (landformChain) {
    snapshot.graph.landformChainVersion = LANDFORM_CHAIN_VERSION;
    snapshot.graph.landformChainHash = landformChainHash(chainManifest);
  }
  snapshot.land.chunkManifest = charts.map((chart) => ({ id: chart.id, cellIndex: chart.cellIndex, meshHash: `${chart.mesh.stats.vertexCount}:${chart.mesh.stats.triangleCount}` }));
  snapshot.land.area = measurePlanetArea({ grid, assignment });
  snapshot.land.meshHash = charts.map((chart) => chart.mesh.stats.triangleCount).join(":");
  snapshot.land.semanticHash = charts.map((chart) => Object.keys(chart.semantic.histogram).sort().join(",")).join("|");
  snapshot.land.biomeStats = charts.reduce((out, chart) => { for (const [key, value] of Object.entries(chart.semantic.histogram)) out[key] = (out[key] || 0) + value; return out; }, {});
  snapshot.water.lakeBasins = basins.map((basin) => ({ direction: basin.direction, angularRadius: basin.angularRadius, level: basin.level }));
  snapshot.water.shorelineHash = water.shorelineHash;
  snapshot.water.routeHash = water.routes.map((route) => route.id).join("|");
  snapshot.nav.surfaceHash = navigation.hash;
  snapshot.nav.portalHash = `portals:${portals.length}`;
  snapshot.nav.routeHash = navigation.hash;
  snapshot.nav.terrainRouteHash = terrainRoutes.hash;
  snapshot.nav.combatHash = combatSurface.hash;
  snapshot.nav.combatKeepoutHash = combatSurface.zones
    .flatMap((zone) => zone.keepouts.map((keepout) => `${zone.id}:${keepout.id}:${keepout.radius.toFixed(3)}`))
    .join("|");
  snapshot.vegetation.instanceCounts = Object.fromEntries(vegetationByChart.map((vegetation, index) => ["chart:" + index, vegetation.instanceCount]));
  snapshot.vegetation.clusterHash = vegetationByChart.map((vegetation) => Object.entries(vegetation.buckets).map(([species, instances]) => species + ":" + instances.length).join(",")).join("|");
  snapshot.clouds.clusterHash = clouds.climateHash;
  snapshot.clouds.climateHash = clouds.climateHash;
  snapshot.clouds.heroHash = clouds.heroHash;
  snapshot.clouds.heroCount = clouds.heroCount;
  snapshot.clouds.instanceCount = clouds.instanceCount;
  snapshot.clouds.climateBands = [...new Set(clouds.instances.map((instance) => instance.climateBand))].sort();
  const validation = validatePlanetSnapshot(snapshot);
  return { ok: validation.ok, stage: validation.ok ? "complete" : "snapshot", snapshot, manifest, grid, wfc, field, water, surface, portals, navigation, terrainRoutes, routeMetadataReport, waterfallReport, chainReport, elevationReport, finalElevationReport, chainAdjacencyReport, bookshopReport, combatSurface, combatReport, vegetation: vegetationByChart, clouds, charts, seamReport, globalReport, report: validation };
}

export { createChartScalarField };
