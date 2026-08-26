// =====================================================================
// Optional production caller for Planet V8.  It compiles a bounded set of
// landmark charts at scene load, submits typed arrays to Three, and leaves
// the legacy world untouched until every V8 gate is explicitly enabled.
// =====================================================================

import * as THREE from "three";
import {
  getPlanetPresentationVersion,
  isCloudImpostorV1,
  isCurvedWaterV1,
  isPlanetTerrainV1,
  isPlanetSurfaceRidersV1,
  isTerrainSemanticShaderV1,
} from "../../core/params.js";
import { compilePlanetV8 } from "../../procgen/planet/planetCompilerV8.js";
import { createBufferGeometryFromMesh } from "../../procgen/three/bufferGeometryAdapter.js";
import { compileCurvedWater } from "../waterV8/curvedWaterCompiler.js";
import {
  compileOfficialOcean,
  OFFICIAL_OCEAN_SEA_LEVEL,
  OFFICIAL_OCEAN_COLOR,
  OFFICIAL_OCEAN_OPACITY,
} from "../waterV8/officialOcean.js";
import { buildCloudImpostorAtlas } from "../../render/clouds/impostorAtlasBuilder.js";
import { createCloudImpostorSystem } from "../../render/clouds/cloudImpostorSystem.js";
import { createSemanticTerrainMaterial } from "../../render/terrain/semanticTerrainMaterial.js";
import { createCurvedWaterMaterial, createCurvedLakeMaterial } from "../../render/water/curvedWaterMaterial.js";
import { paintPlanetOceanBed } from "../planet.js";
import { createVegetationRuntime } from "../../render/vegetation/vegetationRuntime.js";
import { createWaterSurfaceEventBuffer, createWaterWakeRibbonBuffer } from "../waterV8/waterSurfaceEvents.js";
import { createResourceRegistry } from "../../core/resourceRegistry.js";
import { createPlanetSnapshotCommitQueue } from "./snapshotCommitV8.js";
import { validatePlanetSnapshot } from "../../procgen/planet/schema.js";

export function planetRendererOwnership(features = {}) {
  return {
    terrain: features.planetTerrainV1 === true,
    water: features.curvedWaterV1 === true,
    clouds: features.cloudImpostorV1 === true,
    vegetation: features.planetPresentationVersion === "v9" && features.planetTerrainV1 === true,
  };
}

export function selectPlanetV9LOD({ cameraDistance = 160, landmarkImportance = 1 } = {}) {
  const distance = Number.isFinite(cameraDistance) ? Math.max(0, cameraDistance) : 160;
  if (landmarkImportance >= 0.8 && distance < 90) return { subdivision: 2, resolution: 32, chartLimit: 6, tier: "near" };
  if (distance < 220) return { subdivision: 1, resolution: 24, chartLimit: 6, tier: "mid" };
  return { subdivision: 1, resolution: 12, chartLimit: 4, tier: "far" };
}

function trackLogicalResource(registry, kind, key) {
  registry.retain(kind, key, () => ({ dispose() {} }));
}

function meshFromData(data, material) {
  return createBufferGeometryFromMesh(THREE, data, { material });
}

function waterMesh(data, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const vertexCount = data.positions.length / 3;
  geometry.setAttribute("waterData0", new THREE.BufferAttribute(data.waterData0 || new Float32Array(vertexCount * 4), 4));
  geometry.setAttribute("waterData1", new THREE.BufferAttribute(data.waterData1 || new Float32Array(vertexCount * 4), 4));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function createPlanetV8Runtime({ scene, planet = null, radius = 160, seed = 1, features = {} } = {}) {
  const enabledTerrain = features.planetTerrainV1 ?? isPlanetTerrainV1();
  const enabledWater = features.curvedWaterV1 ?? isCurvedWaterV1();
  const enabledClouds = features.cloudImpostorV1 ?? isCloudImpostorV1();
  const enabledSemanticShader = features.terrainSemanticShaderV1 ?? isTerrainSemanticShaderV1();
  const presentationVersion = ["v8", "v9"].includes(features.planetPresentationVersion)
    ? features.planetPresentationVersion
    : getPlanetPresentationVersion();
  const isV9 = presentationVersion === "v9";
  const lod = selectPlanetV9LOD({ cameraDistance: features.planetCameraDistance ?? 160, landmarkImportance: features.planetLandmarkImportance ?? 1 });
  const root = new THREE.Group();
  root.name = `planet-${presentationVersion}-runtime`;
  root.visible = enabledTerrain || enabledWater || enabledClouds;
  root.userData.worldVersion = presentationVersion;
  root.userData.landformChain = isV9;
  root.userData.pipeline = isV9 ? "oskar-continuous-chain-v9" : "planet-sphere-baseline-v8";
  const state = {
    root,
    snapshot: null,
    compiler: null,
    water: null,
    clouds: null,
    vegetation: null,
    waterEvents: createWaterSurfaceEventBuffer({ capacity: features.waterEventCapacity ?? 64 }),
    waterWakes: createWaterWakeRibbonBuffer({ capacity: features.waterWakeCapacity ?? 48 }),
    resourceRegistry: features.resourceRegistry || createResourceRegistry(),
    lod,
    compiled: false,
    commitQueue: features.commitQueue || createPlanetSnapshotCommitQueue({ validate: validatePlanetSnapshot }),
    surfaceProjectionEnabled: enabledTerrain && (features.planetSurfaceRidersV1 ?? isPlanetSurfaceRidersV1()),
  };
  if (!root.visible) return state;
  scene.add(root);
  // V8/V9 地形替换实心球时才隐藏 planet。正式页峡谷刻在 planet 上，只能盖海洋、不能关可见。
  if (enabledWater && enabledTerrain && planet) planet.visible = false;

  if (enabledTerrain || enabledWater || enabledClouds) {
    const compiled = compilePlanetV8({
      seed,
      radius,
      landformChain: isV9,
      subdivision: features.planetSubdivision ?? lod.subdivision,
      chartLimit: enabledTerrain ? (features.planetChartLimit ?? lod.chartLimit) : (features.planetChartLimit ?? 0),
      resolution: enabledTerrain ? (features.planetResolution ?? lod.resolution) : (features.planetResolution ?? 3),
    });
    state.compiler = compiled;
    if (!compiled.ok) {
      root.userData.v8Error = compiled.report || compiled.stage;
      root.visible = false;
      return state;
    }
    const queued = state.commitQueue.enqueue(compiled.snapshot);
    if (!queued.ok) {
      root.userData.v8Error = queued.result || "snapshot-commit";
      root.visible = false;
      return state;
    }
    const committed = state.commitQueue.commitAtFrameBoundary();
    if (!committed.ok) {
      root.userData.v8Error = committed.result || "snapshot-commit";
      root.visible = false;
      return state;
    }
    state.snapshot = committed.snapshot;
    const material = enabledSemanticShader
      ? createSemanticTerrainMaterial(THREE)
      : new THREE.MeshStandardMaterial({ color: 0x6d8f65, roughness: 0.96, metalness: 0, flatShading: true });
    if (enabledTerrain) {
      for (const chart of compiled.charts) {
        const mesh = meshFromData(chart.mesh, material);
        mesh.name = `planet-v8-terrain-${chart.id}`;
        mesh.userData.semantic = chart.semantic;
        if (enabledSemanticShader) {
          mesh.geometry.setAttribute("terrainData0", new THREE.BufferAttribute(chart.semantic.terrainData0, 4));
          mesh.geometry.setAttribute("terrainData1", new THREE.BufferAttribute(chart.semantic.terrainData1, 4));
          mesh.geometry.setAttribute("flowData", new THREE.BufferAttribute(chart.semantic.flowData, 4));
          if (chart.semantic.climateData1) mesh.geometry.setAttribute("climateData1", new THREE.BufferAttribute(chart.semantic.climateData1, 4));
          if (chart.semantic.ecologyData0) mesh.geometry.setAttribute("ecologyData0", new THREE.BufferAttribute(chart.semantic.ecologyData0, 4));
          if (chart.semantic.uv) mesh.geometry.setAttribute("uv", new THREE.BufferAttribute(chart.semantic.uv, 2));
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        trackLogicalResource(state.resourceRegistry, "terrain", chart.id);
      }
      if (isV9) {
        state.vegetation = createVegetationRuntime(THREE, root, compiled.vegetation, compiled.charts, {
          resourceRegistry: state.resourceRegistry,
        });
      }
    }
    if (planet) planet.userData.planetV8Snapshot = compiled.snapshot;
  }

  if (enabledWater && enabledTerrain && state.compiler?.grid) {
    const basins = state.compiler.manifest.filter((entry) => entry.waterNeeds === "closed-lake-basin").map((entry) => ({ direction: entry.direction, angularRadius: entry.angularRadius, level: 0.08 }));
    const water = state.compiler.water || compileCurvedWater({ grid: state.compiler.grid, radius, seaLevel: 0, basins, fieldRecipe: state.compiler.field });
    state.water = water;
    const ocean = waterMesh(water.ocean, createCurvedWaterMaterial(THREE, { color: 0x1c5972, opacity: 0.92, kind: "ocean" }));
    ocean.name = "planet-v8-curved-ocean";
    ocean.receiveShadow = true;
    root.add(ocean);
    trackLogicalResource(state.resourceRegistry, "water", "ocean");
    for (let i = 0; i < water.lakes.length; i++) {
      const lake = waterMesh(water.lakes[i], createCurvedLakeMaterial(THREE, { color: 0x5b9da0, opacity: 0.86 }));
      lake.name = `planet-v8-curved-lake-${i}`;
      root.add(lake);
      trackLogicalResource(state.resourceRegistry, "water", `lake-${i}`);
    }
  } else if (enabledWater && !enabledTerrain) {
    const official = compileOfficialOcean({
      radius,
      seaLevel: features.oceanSeaLevel ?? OFFICIAL_OCEAN_SEA_LEVEL,
    });
    state.water = { ocean: official.ocean, lakes: [], radius: official.radius, official: true };
    const ocean = waterMesh(official.ocean, createCurvedWaterMaterial(THREE, {
      color: OFFICIAL_OCEAN_COLOR,
      opacity: OFFICIAL_OCEAN_OPACITY,
      kind: "ocean",
      depthWrite: true,
      polygonOffset: true,
    }));
    ocean.name = "planet-v8-curved-ocean";
    ocean.userData.officialOcean = true;
    ocean.receiveShadow = true;
    root.add(ocean);
    trackLogicalResource(state.resourceRegistry, "water", "ocean");
    if (planet) {
      paintPlanetOceanBed(planet);
      planet.visible = true;
    }
  }

  if (enabledClouds && state.compiler?.clouds) {
    const clusters = state.compiler.clouds;
    state.clouds = { atlas: buildCloudImpostorAtlas(), clusters };
    state.clouds.renderer = createCloudImpostorSystem(THREE, root, state.clouds.clusters, { atlas: state.clouds.atlas, radius });
    trackLogicalResource(state.resourceRegistry, "cloud", `planet-${presentationVersion}`);
    root.userData.cloudImpostor = state.clouds;
  }
  state.compiled = true;
  return state;
}

export function updatePlanetV8Runtime(state, time = 0, wind = [1, 0]) {
  if (!state?.compiled) return;
  state.root.traverse((object) => {
    if (object.material?.uniforms?.uTime) {
      object.material.uniforms.uTime.value = time;
      if (object.material.uniforms.uWind) object.material.uniforms.uWind.value = wind;
    }
  });
  state.waterEvents?.update?.(Math.max(0, time - (state._lastTime ?? time)));
  state.waterWakes?.update?.(Math.max(0, time - (state._lastTime ?? time)));
  state._lastTime = time;
  state.vegetation?.update?.(time);
  state.clouds?.renderer?.update?.(time, wind);
}

export function disposePlanetV8Runtime(state) {
  if (!state?.root) return;
  state.root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  state.clouds?.renderer?.dispose?.();
  state.vegetation?.dispose?.();
  state.resourceRegistry?.disposeAll?.();
  state.root.removeFromParent();
}
