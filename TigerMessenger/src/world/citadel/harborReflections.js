import * as THREE from 'three';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';

// Authored waterfront window/lantern projections, in west-city local coordinates.
// These are reflection sources, not additional lights or collision objects.
const SOURCES = [
  [25.7, 4, 9.2, .66], [36.8, 10, 11.8, .80],
  [25.7, 17, 10.6, .57], [36.8, 25, 13.0, .85],
  [25.7, 32, 10.0, .70], [36.8, 39, 11.5, .70],
  [25.7, 46, 12.5, .81], [37.2, 54, 9.5, .68],
  [29.6, 56, 11.2, .90], [37.0, 61, 9.0, .72],
];

/**
 * One transparent draw call, no textures/lights/reflection render targets.
 * Add directly to the same parent as west-city-water-channel, without a transform.
 * Call userData.update(timeOfDay) alongside citadel-new-city-lighting's update.
 * Rendering also reads that sibling's nightWeight when available.
 */
export function buildHarborReflections(waterHeight) {
  const root = new THREE.Group();
  root.name = 'citadel-harbor-reflections';
  const positions = [], uvs = [], indices = [];
  for (let iz = 0; iz <= 24; iz++) for (let ix = 0; ix <= 6; ix++) {
    const z = -4 + iz * 68 / 24;
    const width = z >= 52 && z <= 62 ? 18.8 : 12.5;
    const x = 25 + ix * width / 6;
    positions.push(x, waterHeight(x, z) + .085, z);
    uvs.push(ix / 6, iz / 24);
    if (ix < 6 && iz < 24) {
      const a = iz * 7 + ix;
      indices.push(a, a + 7, a + 1, a + 1, a + 7, a + 8);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const uniforms = {
    uTime: {value: 0}, uNight: {value: 0},
    uCameraLocal: {value: new THREE.Vector3()},
    uSources: {value: SOURCES.map(s => new THREE.Vector4(...s))},
    uGold: {value: new THREE.Color(0xffb457)},
    uAmber: {value: new THREE.Color(0xff743b)},
  };
  const material = new THREE.ShaderMaterial({
    name: 'citadel-harbor-broken-gold-reflection', uniforms,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `
      varying vec2 vLocal;
      varying vec2 vWaterUv;
      void main() {
        vLocal = position.xz;
        vWaterUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime, uNight;
      uniform vec3 uCameraLocal, uGold, uAmber;
      uniform vec4 uSources[10];
      varying vec2 vLocal;
      varying vec2 vWaterUv;
      void main() {
        if (uNight < 0.003) discard;
        // The UV follows the actual flared channel boundary, not a rectangle.
        float shore = smoothstep(0.015, 0.08, vWaterUv.x)
          * (1.0 - smoothstep(0.92, 0.985, vWaterUv.x))
          * smoothstep(0.0, 0.015, vWaterUv.y)
          * (1.0 - smoothstep(0.98, 1.0, vWaterUv.y));
        float light = 0.0;
        for (int i = 0; i < 10; i++) {
          vec4 source = uSources[i];
          vec2 delta = uCameraLocal.xz - source.xy;
          vec2 direction = delta / max(length(delta), 0.001);
          vec2 side = vec2(-direction.y, direction.x);
          vec2 p = vLocal - source.xy;
          float along = dot(p, direction);
          float progress = along / source.z;
          float across = dot(p, side);
          float seed = float(i) * 1.731;
          float ripple = sin(along * 8.5 - uTime * 1.45 + seed)
            + 0.44 * sin(along * 18.7 + across * 2.4 + uTime * 0.9 + seed);
          float broken = smoothstep(0.12, 0.86, ripple);
          float wobble = sin(along * 3.1 + uTime * 0.8 + seed) * 0.20;
          float width = source.w * (0.45 + clamp(progress, 0.0, 1.0) * 0.8);
          float crossFade = 1.0 - smoothstep(width * 0.20, width, abs(across + wobble));
          float endFade = smoothstep(-0.3, 0.65, along)
            * (1.0 - smoothstep(0.12, 1.0, progress));
          light += crossFade * endFade * (0.025 + 0.975 * broken);
        }
        float alpha = min(light * 0.82, 0.88) * shore * uNight;
        if (alpha < 0.002) discard;
        vec3 color = mix(uAmber, uGold, clamp(light * 0.8, 0.0, 1.0));
        gl_FragColor = vec4(color * 1.65, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'citadel-harbor-gold-streaks';
  mesh.renderOrder = 8;
  mesh.frustumCulled = false;
  mesh.userData.dynamicWaterOnly = true;
  root.add(mesh);
  const cameraPosition = new THREE.Vector3();
  let sourceLighting = null;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    sourceLighting ||= root.parent?.getObjectByName('citadel-new-city-lighting');
    const weight = sourceLighting?.userData.nightWeight;
    if (Number.isFinite(weight)) uniforms.uNight.value = weight;
    camera.getWorldPosition(cameraPosition);
    root.worldToLocal(cameraPosition);
    uniforms.uCameraLocal.value.copy(cameraPosition);
    uniforms.uTime.value = performance.now() * .001;
    // The effect lies just above the global ocean's <= .067 m wave envelope.
    // Never read the retired local cap or reintroduce its translated sphere.
  };
  root.userData.update = phase => {
    const weight = nightWeightAt(phase);
    uniforms.uNight.value = weight;
    root.userData.nightWeight = weight;
    mesh.visible = weight > .003;
  };
  root.userData.reflectionCount = SOURCES.length;
  root.userData.drawCalls = 1;
  root.userData.surface = 'official-world-ocean';
  root.userData.artTechnique = 'view-directed-authored-streaks-not-planar-reflection';
  root.userData.dispose = () => {geometry.dispose(); material.dispose(); root.removeFromParent();};
  return root;
}
