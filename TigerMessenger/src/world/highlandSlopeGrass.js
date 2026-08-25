// Default highland citadel slope grass.  Vertex-colored mountain meshes only
// swap green; this InstancedMesh is a low-end billboard stand-in for Oskar's
// contrast-aware grass (S5): silhouette/cliff edges get more ink, interiors
// less, and blades bend in the vertex shader.  Independent of V8 flags.

import { highlandTerrainSurfaceHeight, isHighlandWaterfrontCutout } from "./highlandCitadelDesign.js";

const TREE_KEEPOUTS = Object.freeze([
  [-21, 8], [-19, -4], [-17, -16],
  [18, 9], [20, -5], [17, -17],
  [-10, -23], [9, -24],
  [-35, -8], [36, -10], [-43, 15], [44, 16],
]);

function occupiesCastle(x, z) {
  return Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5) < 1.08;
}

function nearTree(x, z) {
  return TREE_KEEPOUTS.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 2.4);
}

export function compileHighlandSlopeGrass({
  seed = 20260826,
  step = 1.55,
  maxInstances = 640,
} = {}) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const instances = [];
  for (let z = -40; z <= 16 && instances.length < maxInstances; z += step) {
    for (let x = -52; x <= 52 && instances.length < maxInstances; x += step) {
      const jx = x + (next() - 0.5) * step * 0.55;
      const jz = z + (next() - 0.5) * step * 0.55;
      if (occupiesCastle(jx, jz)) continue;
      if (isHighlandWaterfrontCutout(jx, jz)) continue;
      if (nearTree(jx, jz)) continue;
      const y = highlandTerrainSurfaceHeight(jx, jz);
      if (y < 2.4 || y > 38) continue;
      const slope = Math.hypot(
        highlandTerrainSurfaceHeight(jx + 1.1, jz) - y,
        highlandTerrainSurfaceHeight(jx, jz + 1.1) - y,
      );
      if (slope > 0.85) continue;
      if (next() > 0.88 + (1 - Math.min(1, slope)) * 0.08) continue;
      instances.push({
        position: [jx, y + 0.04, jz],
        scale: 0.55 + next() * 0.5,
        phase: next(),
        slope,
        kind: "grass-billboard",
      });
    }
  }
  return {
    kind: "highland-slope-grass-v1",
    instances,
    instanceCount: instances.length,
    contrastAware: true,
    billboard: true,
  };
}

function grassBillboardMaterial(THREE) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x6f8f68,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  material.userData.grassBillboard = true;
  material.userData.contrastAwareOutline = true;
  material.userData.windShader = null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = { value: 0 };
    shader.vertexShader = `uniform float uGrassTime;\nattribute float aSlope;\nvarying float vContrastAwareOutline;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
float windBend = sin(uGrassTime * 1.7 + transformed.y * 8.5 + transformed.x * 3.6) * 0.05 * transformed.y;
transformed.x += windBend;
transformed.z += windBend * 0.5;
float ndv = abs(dot(normalize(normal), vec3(0.0, 1.0, 0.2)));
vContrastAwareOutline = (1.0 - smoothstep(0.10, 0.52, ndv)) * mix(0.35, 1.0, smoothstep(0.18, 0.58, aSlope));`,
    );
    shader.fragmentShader = `varying float vContrastAwareOutline;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
float contrastAwareOutline = vContrastAwareOutline;
gl_FragColor.rgb *= mix(1.04, 0.74, contrastAwareOutline);`,
    );
    material.userData.windShader = shader;
  };
  return material;
}

export function mountHighlandSlopeGrass(THREE, parent, options = {}) {
  if (!THREE?.InstancedMesh || !parent) return null;
  const existing = parent.getObjectByName("highland-slope-grass-billboards");
  if (existing) {
    existing.removeFromParent();
    existing.geometry?.dispose?.();
    existing.material?.dispose?.();
  }
  const compiled = compileHighlandSlopeGrass(options);
  if (!compiled.instanceCount) return null;
  const geometry = new THREE.ConeGeometry(0.045, 0.32, 3, 1, false);
  const material = grassBillboardMaterial(THREE);
  const mesh = new THREE.InstancedMesh(geometry, material, compiled.instanceCount);
  mesh.name = "highland-slope-grass-billboards";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.kind = "grass-detail-cluster";
  mesh.userData.grassBillboard = true;
  mesh.userData.contrastAwareOutline = true;
  mesh.userData.instanceCount = compiled.instanceCount;
  mesh.userData.skipInkOutline = true;
  const dummy = new THREE.Object3D();
  const slopes = new Float32Array(compiled.instanceCount);
  compiled.instances.forEach((instance, index) => {
    dummy.position.set(instance.position[0], instance.position[1], instance.position[2]);
    dummy.rotation.set(0, instance.phase * Math.PI * 2, (instance.phase - 0.5) * 0.18);
    dummy.scale.setScalar(instance.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    slopes[index] = instance.slope;
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute("aSlope", new THREE.InstancedBufferAttribute(slopes, 1));
  parent.add(mesh);
  const runtime = {
    mesh,
    instanceCount: compiled.instanceCount,
    update(time = 0) {
      if (material.userData.windShader) material.userData.windShader.uniforms.uGrassTime.value = time;
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.removeFromParent();
    },
  };
  parent.userData.highlandSlopeGrass = runtime;
  return runtime;
}
