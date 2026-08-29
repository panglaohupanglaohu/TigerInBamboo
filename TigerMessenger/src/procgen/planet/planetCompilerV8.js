// =====================================================================
// Planet V8 compiler vertical slice:
// manifest → geodesic main/dual grid → spherical WFC → global field → MC
// chart → semantic bake.  It returns serializable generation data and does
// not import Three.js, so it can run in a Worker.
// =====================================================================

import { createLandmarkManifest, createContinuousLandformManifest, validateLandmarkManifest, landmarkManifestHash, DEFAULT_LANDMARK_MANIFEST } from "../../world/planetV8/landmarkManifest.js";
import { buildGeodesicMainAndDualGrid, sampleBarycentricDirection } from "./geodesicGrid.js";
import { createTerrainTiles } from "./terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "./sphericalWfc.js";
import { createPlanetFieldRecipe, createRadialChartField } from "./planetFieldComposer.js";
import { bakeTerrainSemantic } from "./terrainSemanticBake.js?v=20260827-terrain-v11";
import { marchingCubes } from "../field/marchingCubes.js";
import { createEmptyPlanetSnapshot, createPlanetVersionManifest, validatePlanetSnapshot } from "./schema.js";
import { compileCurvedWater, validateCurvedWater } from "../../world/waterV8/curvedWaterCompiler.js?v=20260827-terrain-v11";
import { createSurfaceProviderV8 } from "../../world/planetV8/surfaceProviderV8.js";
import { compilePlanetNavigationV8, compileManifestPortals, validatePlanetNavigation } from "../../world/planetV8/navigationV8.js";
import { compileLandmarkTerrainRoutes, LANDFORM_CHAIN_ROUTE_DEFINITIONS } from "../../world/planetV8/terrainRoutesV8.js";
import { compilePlanetClouds } from "../../render/clouds/heroCloudCompiler.js";
import { solveHydrologyV10 } from "./hydrologyFieldV10.js";
import { solveClimateV10 } from "./climateFieldV10.js";
import { solveEcologyV10 } from "./ecologyFieldV10.js";
import { FIELD_DEPENDENCY_GRAPH_VERSION } from "./fieldDependencyGraphV10.js";
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

export function trianglesFromMesh(mesh, recipe) {
  const triangles = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    if (indices.some((index) => index == null)) continue;
    const points = indices.map((index) => [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]]);
    triangles.push({ a: points[0], b: points[1], c: points[2], semantic: recipe?.semanticAt?.(points[0]) || null });
  }
  return triangles;
}

function sampleV10At(grid, fieldV10, position) {
  if (!grid?.dual || !fieldV10?.cells) return null;
  const length = Math.hypot(position[0], position[1], position[2]) || 1;
  const direction = [position[0] / length, position[1] / length, position[2] / length];
  const hit = sampleBarycentricDirection(grid, direction);
  return fieldV10.cells[hit.cellIndex] || null;
}

function buildGlobalSphericalTerrain({ grid, surfaceGrid = grid, field, ecology, climate }) {
  const sourcePositions = surfaceGrid.main.positions;
  const positions = new Float32Array(sourcePositions.length * 3);
  for (let i = 0; i < sourcePositions.length; i++) {
    const source = sourcePositions[i];
    const length = Math.hypot(source[0], source[1], source[2]) || 1;
    const direction = [source[0] / length, source[1] / length, source[2] / length];
    const semantic = field.semanticAt(direction);
    const surfaceRadius = field.radius + semantic.height;
    positions[i * 3] = direction[0] * surfaceRadius;
    positions[i * 3 + 1] = direction[1] * surfaceRadius;
    positions[i * 3 + 2] = direction[2] * surfaceRadius;
  }

  const normals = new Float32Array(positions.length);
  const indices = [];
  for (const face of surfaceGrid.main.faces) {
    let [a, b, c] = face;
    const ax = positions[a * 3]; const ay = positions[a * 3 + 1]; const az = positions[a * 3 + 2];
    const bx = positions[b * 3]; const by = positions[b * 3 + 1]; const bz = positions[b * 3 + 2];
    const cx = positions[c * 3]; const cy = positions[c * 3 + 1]; const cz = positions[c * 3 + 2];
    const ab = [bx - ax, by - ay, bz - az];
    const ac = [cx - ax, cy - ay, cz - az];
    let cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const center = [ax + bx + cx, ay + by + cy, az + bz + cz];
    if (cross[0] * center[0] + cross[1] * center[1] + cross[2] * center[2] < 0) {
      [b, c] = [c, b];
      cross = cross.map((value) => -value);
    }
    indices.push(a, b, c);
    for (const vertex of [a, b, c]) {
      normals[vertex * 3] += cross[0];
      normals[vertex * 3 + 1] += cross[1];
      normals[vertex * 3 + 2] += cross[2];
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }

  const semantic = bakeTerrainSemantic({
    positions,
    normals,
    recipe: field,
    ecologyAt: (position) => sampleV10At(grid, ecology, position),
    climateAt: (position) => sampleV10At(grid, climate, position),
  });
  return {
    id: "planet-global-spherical-terrain-v10",
    kind: "global-spherical-terrain",
    centerDirection: [0, 1, 0],
    cellIndex: 0,
    mesh: {
      kind: "indexed-spherical-patch-terrain-v10",
      positions,
      normals,
      indices: Uint32Array.from(indices),
      stats: {
        vertexCount: positions.length / 3,
        triangleCount: indices.length / 3,
        source: "geodesic-main+WFC+continuous-field",
        sourceSubdivision: surfaceGrid.subdivision,
        topology: "spherical-closed",
      },
    },
    semantic,
  };
}

function ecologyLocksAt(grid, combatSurface, radius, field) {
  const keepouts = [];
  for (const zone of combatSurface?.zones || []) {
    for (const keepout of zone.keepouts || []) keepouts.push(keepout);
  }
  return (cellId) => {
    const index = grid.dual.indexOfId(cellId);
    if (index < 0) return {};
    const direction = grid.dual.directionOf(index);
    const position = direction.map((value) => value * (radius + field.heightAt(direction)));
    let combat = 0;
    for (const keepout of keepouts) {
      if (!keepout.position) continue;
      const distance = Math.hypot(
        position[0] - keepout.position[0],
        position[1] - keepout.position[1],
        position[2] - keepout.position[2],
      );
      if (distance < (keepout.radius || 0)) combat = 1;
    }
    return { combat };
  };
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
  const pipeline = [];
  const mark = (name) => { pipeline.push(name); };
  const field = createPlanetFieldRecipe({
    radius,
    seaLevel,
    grid,
    landmarks: manifest,
    assignment,
    transitionCollars: landformChain ? buildTransitionCollars(chainManifest, { radius }) : [],
  });
  mark("field");
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
  // Keep the WFC/navigation grid coarse enough for the existing chain solver,
  // but render the V9 ocean on the same denser geodesic surface as the land.
  // This removes the 20-face triangular water cap that previously read as a
  // flat blue card while preserving the field-backed shoreline semantics.
  const globalSurfaceGrid = landformChain
    ? buildGeodesicMainAndDualGrid({
      radius,
      // Keep the WFC solve on the cheap authoring grid, but present the
      // result on a denser geodesic shell so the Oskar-style patch seams
      // read as a continuous low-poly globe rather than five giant cards.
      subdivision: 3,
      seed,
      preserve: manifest.map((entry) => entry.direction),
    })
    : grid;
  const water = compileCurvedWater({ grid: landformChain ? globalSurfaceGrid : grid, radius, seaLevel, basins, harborAnchors, fieldRecipe: field });
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
  const hydrologyV10 = solveHydrologyV10({
    grid,
    elevationAt: (direction) => field.heightAt(direction),
    seaLevel,
    basinLocks: basins,
    radius,
  });
  mark("hydrology");
  const climateV10 = solveClimateV10({
    grid,
    hydrology: hydrologyV10,
    elevationAt: (direction) => field.heightAt(direction),
    wind: [1, 0, 0],
    radius,
  });
  mark("climate");
  const ecologyV10 = solveEcologyV10({
    grid,
    hydrology: hydrologyV10,
    climate: climateV10,
    elevationAt: (direction) => field.heightAt(direction),
    baseForestnessAt: (cellId) => {
      const index = grid.dual.indexOfId(cellId);
      if (index < 0) return 0.5;
      return field.semanticAt(grid.dual.directionOf(index)).forestness ?? 0.5;
    },
    locksAt: ecologyLocksAt(grid, combatSurface, radius, field),
  });
  mark("ecology");
  const clouds = compilePlanetClouds({
    cells: cloudCells,
    semantics: cloudSemantics,
    water,
    wind: climateV10.wind || [1, 0, 0],
    seed,
    landmarks: manifest,
    field,
    climate: climateV10,
  });
  mark("clouds");
  const charts = prepareCharts(grid, assignment, manifest, chartLimit).map((chart) => {
    const scalar = createChartScalarField(field, chart, { radialMin: -4, radialMax: 8, span: 10, resolution });
    const mesh = marchingCubes(scalar, { isoLevel: 0, normalMode: "gradient" });
    const semantic = bakeTerrainSemantic({
      positions: mesh.positions,
      normals: mesh.normals,
      recipe: field,
      ecologyAt: (position) => sampleV10At(grid, ecologyV10, position),
      climateAt: (position) => sampleV10At(grid, climateV10, position),
    });
    return { ...chart, mesh, semantic };
  });
  mark("charts");
  // V9 presents one closed spherical surface.  The selected MC charts remain
  // available for local landmarks/vegetation and for V8 compatibility, while
  // this global mesh prevents the runtime from showing isolated terrain cards.
  const globalTerrain = landformChain
    ? buildGlobalSphericalTerrain({ grid, surfaceGrid: globalSurfaceGrid, field, ecology: ecologyV10, climate: climateV10 })
    : null;
  const vegetationCharts = globalTerrain ? [globalTerrain] : charts;
  const vegetationByChart = vegetationCharts.map((chart) => {
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
      ecology: ecologyV10,
      climateHash: climateV10.hash,
      grid,
      chartId: chart.id,
    });
  });
  mark("vegetation");
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
  if (globalTerrain) snapshot.land.globalMeshHash = `${globalTerrain.mesh.stats.vertexCount}:${globalTerrain.mesh.stats.triangleCount}:${globalTerrain.mesh.stats.topology}`;
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
  snapshot.vegetation.ecologyHash = ecologyV10.hash;
  snapshot.vegetation.ecologySource = "ecology-v10";
  snapshot.vegetation.climateHash = climateV10.hash;
  snapshot.clouds.clusterHash = clouds.climateHash;
  snapshot.clouds.climateHash = climateV10.hash;
  snapshot.hydrologyHash = hydrologyV10.hash;
  snapshot.climateHash = climateV10.hash;
  snapshot.ecologyHash = ecologyV10.hash;
  snapshot.dependencyGraphVersion = FIELD_DEPENDENCY_GRAPH_VERSION;
  snapshot.clouds.heroHash = clouds.heroHash;
  snapshot.clouds.heroCount = clouds.heroCount;
  snapshot.clouds.instanceCount = clouds.instanceCount;
  snapshot.clouds.climateBands = [...new Set(clouds.instances.map((instance) => instance.climateBand))].sort();
  snapshot.clouds.climateSource = "climate-v10";
  mark("snapshot");
  const validation = validatePlanetSnapshot(snapshot);
  return { ok: validation.ok, stage: validation.ok ? "complete" : "snapshot", snapshot, pipeline, manifest, grid, wfc, field, water, surface, portals, navigation, terrainRoutes, routeMetadataReport, waterfallReport, chainReport, elevationReport, finalElevationReport, chainAdjacencyReport, bookshopReport, combatSurface, combatReport, vegetation: vegetationByChart, clouds, climate: climateV10, hydrology: hydrologyV10, ecology: ecologyV10, charts, globalTerrain, seamReport, globalReport, report: validation };
}

export { createChartScalarField };
