import { buildCloudImpostorAtlas, createThreeCloudAtlasTexture } from "./impostorAtlasBuilder.js";
import { createCloudImpostorMaterial } from "./cloudImpostorMaterial.js";
import { CLOUD_RIDGE_PATH_POINTS } from "./cloudClusterCompiler.js";

function heroWeightForClock(day, weights) {
  if (!weights) return 1;
  if (day <= 0.15) return weights.night;
  if (day <= 0.4) return weights.dawn;
  if (day <= 0.8) return weights.noon;
  return weights.dusk;
}

function instancePosition(item, radius) {
  if (item.cartesian && item.position) return item.position;
  return (item.anchor || [0, 1, 0]).map((value) => value * (radius + (item.altitude || 0)));
}

function pathSamplePosition(point, item, radius) {
  if (point?.position) return point.position;
  if (item.cartesian && item.position) return item.position;
  const direction = point?.direction || item.anchor || [0, 1, 0];
  const altitude = point?.altitude ?? item.altitude ?? 0;
  return direction.map((value) => value * (radius + altitude));
}

export function createCloudImpostorSystem(THREE, scene, clusters, { atlas = buildCloudImpostorAtlas(), radius = 160 } = {}) {
  if (!THREE?.PlaneGeometry || !scene) throw new Error("cloud impostor system requires THREE and scene");
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const name of ["position", "uv"]) geometry.setAttribute(name, base.getAttribute(name));
  const instances = clusters?.instances || [];
  geometry.instanceCount = instances.length;
  const anchor = new Float32Array(instances.length * 3);
  const scale = new Float32Array(instances.length);
  const rotation = new Float32Array(instances.length);
  const inDir = new Float32Array(instances.length * 3);
  const outDir = new Float32Array(instances.length * 3);
  const timeOffset = new Float32Array(instances.length);
  const speed = new Float32Array(instances.length);
  const hero = new Float32Array(instances.length);
  // Keep ten points in the generated snapshot, but upload six representative
  // samples so WebGL1 devices remain below their guaranteed attribute budget.
  const gpuPathIndices = [0, 2, 4, 6, 8, 9];
  const path = Array.from({ length: gpuPathIndices.length }, () => new Float32Array(instances.length * 3));
  for (let i = 0; i < instances.length; i++) {
    const item = instances[i];
    anchor.set(instancePosition(item, radius), i * 3); scale[i] = item.scale; rotation[i] = item.rotation;
    inDir.set(item.inDir, i * 3); outDir.set(item.outDir, i * 3);
    timeOffset[i] = item.timeOffset; speed[i] = item.speed;
    hero[i] = item.authored ? 1 : 0;
    for (let pointIndex = 0; pointIndex < gpuPathIndices.length; pointIndex++) {
      const point = item.pathPoints?.[gpuPathIndices[pointIndex]] || item;
      path[pointIndex].set(pathSamplePosition(point, item, radius), i * 3);
    }
  }
  geometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchor, 3));
  geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scale, 1));
  geometry.setAttribute("aRotation", new THREE.InstancedBufferAttribute(rotation, 1));
  geometry.setAttribute("aInDir", new THREE.InstancedBufferAttribute(inDir, 3));
  geometry.setAttribute("aOutDir", new THREE.InstancedBufferAttribute(outDir, 3));
  geometry.setAttribute("aTimeOffset", new THREE.InstancedBufferAttribute(timeOffset, 1));
  geometry.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speed, 1));
  geometry.setAttribute("aHero", new THREE.InstancedBufferAttribute(hero, 1));
  for (let pointIndex = 0; pointIndex < gpuPathIndices.length; pointIndex++) geometry.setAttribute(`aPath${pointIndex}`, new THREE.InstancedBufferAttribute(path[pointIndex], 3));
  const texture = createThreeCloudAtlasTexture(THREE, atlas);
  const material = createCloudImpostorMaterial(THREE, { atlas: texture });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "planet-v8-cloud-impostors";
  mesh.userData.cloudAlgorithm = clusters?.cloudChain?.algorithm || "oskar-semantic-five-band-cloud-chain-v1";
  mesh.userData.lowLayerInstances = instances.filter((instance) => instance.lowLayer).length;
  mesh.userData.heroCloudCount = instances.filter((instance) => instance.authored).length;
  mesh.userData.heroRoles = [...new Set(instances.filter((instance) => instance.heroRole).map((instance) => instance.heroRole))].sort();
  mesh.userData.impostorShape = atlas?.shape || "stacked-lowpoly-puffs-sdf";
  mesh.userData.heroDayPhaseWeight = instances.find((instance) => instance.dayPhaseWeight)?.dayPhaseWeight || null;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    atlas,
    clusters,
    update(time, wind = [1, 0], weather = 0, day = 1) {
      material.uniforms.uTime.value = time;
      material.uniforms.uWind.value = wind;
      material.uniforms.uWeather.value = weather;
      material.uniforms.uDay.value = day;
      const weights = mesh.userData.heroDayPhaseWeight;
      material.uniforms.uHeroDayWeight.value = heroWeightForClock(day, weights);
    },
    dispose() {
      geometry.dispose(); base.dispose(); material.dispose(); texture?.dispose?.(); mesh.removeFromParent();
    },
  };
}
