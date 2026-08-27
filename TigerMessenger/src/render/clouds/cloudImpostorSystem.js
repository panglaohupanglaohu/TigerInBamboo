import { buildCloudImpostorAtlas, buildSharedImpostorAtlas, createThreeCloudAtlasTexture } from "./impostorAtlasBuilder.js";
import { createCloudImpostorMaterial, createSharedImpostorMaterial } from "./cloudImpostorMaterial.js";
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

export function createCloudImpostorSystem(THREE, scene, clusters, { atlas = null, radius = 160 } = {}) {
  if (!THREE?.PlaneGeometry || !scene) throw new Error("cloud impostor system requires THREE and scene");
  const instances = clusters?.instances || [];
  // S12: any instance with shape "canopy" switches the whole system to the
  // shared cloud+canopy pipeline — one atlas, one material family, one mesh.
  const hasCanopy = instances.some((instance) => instance.shape === "canopy");
  const resolvedAtlas = atlas ?? (hasCanopy ? buildSharedImpostorAtlas() : buildCloudImpostorAtlas());
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const name of ["position", "uv"]) geometry.setAttribute(name, base.getAttribute(name));
  geometry.instanceCount = instances.length;
  const scale = new Float32Array(instances.length);
  const rotation = new Float32Array(instances.length);
  const timeOffset = new Float32Array(instances.length);
  const speed = new Float32Array(instances.length);
  // aHero 编码：低位 = authored（0/1），高位 = shape（canopy=1）。
  // 云 0/1、树冠 3 —— 不新增 attribute，保证总 attribute 数 ≤ 16
  // （WebGL MAX_VERTEX_ATTRIBS 最小 16；新增 aShape 会把整个共享 mesh
  // 顶出上限，云和树冠一起消失）。
  const hero = new Float32Array(instances.length);
  // Keep ten points in the generated snapshot, but upload six representative
  // samples so WebGL1 devices remain below their guaranteed attribute budget.
  const gpuPathIndices = [0, 2, 4, 6, 8, 9];
  const path = Array.from({ length: gpuPathIndices.length }, () => new Float32Array(instances.length * 3));
  for (let i = 0; i < instances.length; i++) {
    const item = instances[i];
    scale[i] = item.scale; rotation[i] = item.rotation;
    timeOffset[i] = item.timeOffset; speed[i] = item.speed;
    hero[i] = (item.authored ? 1 : 0) + (item.shape === "canopy" ? 2 : 0);
    for (let pointIndex = 0; pointIndex < gpuPathIndices.length; pointIndex++) {
      const point = item.pathPoints?.[gpuPathIndices[pointIndex]] || item;
      path[pointIndex].set(pathSamplePosition(point, item, radius), i * 3);
    }
  }
  geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scale, 1));
  geometry.setAttribute("aRotation", new THREE.InstancedBufferAttribute(rotation, 1));
  geometry.setAttribute("aTimeOffset", new THREE.InstancedBufferAttribute(timeOffset, 1));
  geometry.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speed, 1));
  geometry.setAttribute("aHero", new THREE.InstancedBufferAttribute(hero, 1));
  for (let pointIndex = 0; pointIndex < gpuPathIndices.length; pointIndex++) geometry.setAttribute(`aPath${pointIndex}`, new THREE.InstancedBufferAttribute(path[pointIndex], 3));
  const texture = createThreeCloudAtlasTexture(THREE, resolvedAtlas);
  const material = hasCanopy
    ? createSharedImpostorMaterial(THREE, {
        atlas: texture,
        cloudViews: resolvedAtlas.cloudViews ?? 0,
        totalViews: resolvedAtlas.views ?? resolvedAtlas.cloudViews ?? 1,
      })
    : createCloudImpostorMaterial(THREE, { atlas: texture, views: resolvedAtlas.views });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "planet-v8-cloud-impostors";
  mesh.userData.cloudAlgorithm = clusters?.cloudChain?.algorithm || "oskar-semantic-five-band-cloud-chain-v1";
  mesh.userData.lowLayerInstances = instances.filter((instance) => instance.lowLayer).length;
  mesh.userData.heroCloudCount = instances.filter((instance) => instance.authored).length;
  mesh.userData.heroRoles = [...new Set(instances.filter((instance) => instance.heroRole).map((instance) => instance.heroRole))].sort();
  mesh.userData.impostorShape = resolvedAtlas?.shape || "stacked-lowpoly-puffs-sdf";
  mesh.userData.sharedImpostor = hasCanopy;
  mesh.userData.canopyCount = instances.filter((instance) => instance.shape === "canopy").length;
  mesh.userData.cloudCount = instances.filter((instance) => instance.shape !== "canopy").length;
  mesh.userData.heroDayPhaseWeight = instances.find((instance) => instance.dayPhaseWeight)?.dayPhaseWeight || null;
  mesh.frustumCulled = false;
  // 云/树冠卡片不参与拾取（否则会挡住城堡/地面点击）
  mesh.raycast = () => {};
  scene.add(mesh);
  return {
    mesh,
    atlas: resolvedAtlas,
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
