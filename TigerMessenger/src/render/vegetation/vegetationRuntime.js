// Low-poly vegetation runtime for Planet V8.
// Generation owns instance positions/species; this adapter owns only the
// batched Three.js presentation.  No tree object is created per instance.

function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
}

function buildTreeGeometry(THREE, species) {
  if (species === "pine") return new THREE.ConeGeometry(0.28, 1.55, 6, 1, false);
  if (species === "wetland") return new THREE.ConeGeometry(0.1, 0.9, 5, 1, false);
  if (species === "rock") return new THREE.DodecahedronGeometry(0.38, 0);
  return new THREE.IcosahedronGeometry(0.46, 0);
}

function treeMaterial(THREE, species) {
  const color = species === "pine" ? 0x3e766b
    : species === "wetland" ? 0x668c73
      : species === "rock" ? 0x766f68
        : 0x5d8a7d;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0, flatShading: true });
}

function grassBillboardMaterial(THREE) {
  const material = new THREE.MeshStandardMaterial({ color: 0x719d72, roughness: 1, metalness: 0, flatShading: true });
  material.userData.grassBillboard = true;
  material.userData.windShader = null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = { value: 0 };
    shader.vertexShader = `uniform float uGrassTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfloat windBend = sin(uGrassTime * 1.8 + transformed.y * 9.0 + transformed.x * 4.0) * 0.045 * transformed.y;\ntransformed.x += windBend;\ntransformed.z += windBend * 0.55;",
    );
    material.userData.windShader = shader;
  };
  return material;
}

function placeInstance(THREE, dummy, instance, scale = 1) {
  const position = instance.position || [0, 0, 0];
  const normal = normalize(position);
  dummy.position.set(position[0], position[1], position[2]);
  dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...normal));
  const size = (instance.scale || 1) * scale;
  dummy.scale.set(size, size, size);
  dummy.updateMatrix();
}

function chartKey(chart, index) {
  return chart?.chartId || `chart:${index}`;
}

function collectTrees(vegetationByChart = []) {
  const grouped = new Map();
  for (const chart of vegetationByChart) for (const [species, instances] of Object.entries(chart?.buckets || {})) {
    if (species === "grass") continue;
    const bucket = grouped.get(species) || [];
    bucket.push(...instances);
    grouped.set(species, bucket);
  }
  return grouped;
}

function collectGrassFromBuckets(vegetationByChart = [], maxInstances = 3500) {
  const grass = [];
  for (const chart of vegetationByChart) {
    for (const instance of chart?.buckets?.grass || []) {
      if (grass.length >= maxInstances) return grass;
      grass.push(instance);
    }
  }
  return grass;
}

function collectGrassLegacy(charts = [], { maxInstances = 3500 } = {}) {
  const grass = [];
  for (const chart of charts) {
    const positions = chart?.mesh?.positions || [];
    const terrain = chart?.semantic?.terrainData0 || [];
    const secondary = chart?.semantic?.terrainData1 || [];
    const ecology = chart?.semantic?.ecologyData0;
    for (let index = 0; index < positions.length / 3 && grass.length < maxInstances; index++) {
      const slope = terrain[index * 4 + 1] ?? 0;
      const forestness = ecology ? ecology[index * 4] : (secondary[index * 4] ?? 0);
      const grassness = ecology ? ecology[index * 4 + 1] : 0;
      const rockness = secondary[index * 4 + 1] ?? 0;
      if (slope > 0.58 || rockness > 0.72 || forestness > 0.78) continue;
      const stride = grassness > 0.4 || (terrain[index * 4 + 2] ?? 0) > 0.55 ? 5 : 8;
      if (index % stride !== 0) continue;
      grass.push({
        position: [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]],
        scale: 0.55 + ((index * 13) % 17) / 30,
        phase: ((index * 7) % 19) / 19,
      });
    }
  }
  return grass;
}

function usesEcologyGrass(vegetationByChart = []) {
  return vegetationByChart.some((chart) => chart?.ecologySource === "ecology-v10" || Array.isArray(chart?.buckets?.grass));
}

export function bindVegetationChunks(registry, vegetationByChart = [], { dirtyChartIds = null } = {}) {
  if (!registry) return [];
  const dirty = dirtyChartIds ? new Set(dirtyChartIds) : null;
  const keys = vegetationByChart.map((chart, index) => chartKey(chart, index));
  for (let index = 0; index < vegetationByChart.length; index++) {
    const key = keys[index];
    if (dirty && !dirty.has(key)) continue;
    const chart = vegetationByChart[index];
    registry.replace("vegetation", key, () => ({
      chartId: key,
      instanceCount: chart.instanceCount,
      dispose() {},
    }));
  }
  return keys;
}

function mountChartMeshes(THREE, dummy, vegetation, { maxGrass }) {
  const meshes = [];
  const group = new THREE.Group();
  group.name = `planet-v8-vegetation-${vegetation.chartId || "chart"}`;
  for (const [species, instances] of Object.entries(vegetation?.buckets || {})) {
    if (species === "grass" || !instances.length) continue;
    const geometry = buildTreeGeometry(THREE, species);
    const material = treeMaterial(THREE, species);
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    mesh.name = `planet-v8-${species}-clusters`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    instances.forEach((instance, index) => {
      placeInstance(THREE, dummy, instance, species === "pine" ? 1.2 : 1);
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.kind = "vegetation-cluster";
    mesh.userData.species = species;
    mesh.userData.lodRange = instances[0]?.lodRange || [0, 220];
    group.add(mesh);
    meshes.push(mesh);
  }
  const grassInstances = (vegetation?.buckets?.grass || []).slice(0, maxGrass);
  if (grassInstances.length) {
    const geometry = new THREE.ConeGeometry(0.035, 0.28, 3, 1, false);
    const material = grassBillboardMaterial(THREE);
    const mesh = new THREE.InstancedMesh(geometry, material, grassInstances.length);
    mesh.name = "planet-v8-grass-billboards";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    grassInstances.forEach((instance, index) => {
      placeInstance(THREE, dummy, instance, 0.45);
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.kind = "grass-detail-cluster";
    mesh.userData.instanceCount = grassInstances.length;
    group.add(mesh);
    meshes.push(mesh);
  }
  return {
    group,
    meshes,
    treeCount: meshes.filter((mesh) => mesh.userData.kind === "vegetation-cluster").reduce((sum, mesh) => sum + mesh.count, 0),
    grassCount: grassInstances.length,
    dispose() {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.removeFromParent();
      }
      group.removeFromParent();
    },
  };
}

export function createVegetationRuntime(THREE, root, vegetationByChart = [], charts = [], { maxGrass = 3500, resourceRegistry = null } = {}) {
  if (!THREE?.InstancedMesh || !root) throw new Error("vegetation runtime requires THREE and root");
  const group = new THREE.Group();
  group.name = "planet-v8-vegetation";
  const dummy = new THREE.Object3D();
  const chunks = new Map();
  const meshes = [];

  function refreshMeshes() {
    meshes.length = 0;
    for (const chunk of chunks.values()) meshes.push(...chunk.meshes);
  }

  function mountChart(vegetation, index) {
    const key = chartKey(vegetation, index);
    const chunk = mountChartMeshes(THREE, dummy, vegetation, { maxGrass });
    if (resourceRegistry) resourceRegistry.replace("vegetation", key, () => chunk);
    else chunks.get(key)?.dispose?.();
    group.add(chunk.group);
    chunks.set(key, chunk);
    refreshMeshes();
    return key;
  }

  if (usesEcologyGrass(vegetationByChart)) {
    vegetationByChart.forEach((vegetation, index) => mountChart(vegetation, index));
  } else {
    const combined = {
      chartId: "planet-v9",
      buckets: Object.fromEntries([...collectTrees(vegetationByChart)].map(([species, instances]) => [species, instances])),
    };
    combined.buckets.grass = collectGrassLegacy(charts, { maxInstances: maxGrass });
    mountChart(combined, 0);
  }

  root.add(group);
  return {
    group,
    meshes,
    chunks,
    treeCount: [...chunks.values()].reduce((sum, chunk) => sum + chunk.treeCount, 0),
    grassCount: [...chunks.values()].reduce((sum, chunk) => sum + chunk.grassCount, 0),
    replaceDirty(nextByChart = [], dirtyChartIds = []) {
      const dirty = new Set(dirtyChartIds);
      nextByChart.forEach((vegetation, index) => {
        const key = chartKey(vegetation, index);
        if (dirty.size && !dirty.has(key)) return;
        mountChart(vegetation, index);
      });
    },
    update(time = 0) {
      group.userData.windPhase = time;
      for (const mesh of meshes) if (mesh.material?.userData?.windShader) mesh.material.userData.windShader.uniforms.uGrassTime.value = time;
    },
    dispose() {
      if (resourceRegistry) {
        for (const key of chunks.keys()) resourceRegistry.release("vegetation", key);
      } else {
        for (const chunk of chunks.values()) chunk.dispose();
      }
      chunks.clear();
      meshes.length = 0;
      group.removeFromParent();
    },
  };
}

export { collectGrassFromBuckets, chartKey };
