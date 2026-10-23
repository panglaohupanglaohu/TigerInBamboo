import {applySwampCanopyInk,useSwampTargetFoliage} from './swampCoralCanopy.js';
import * as THREE from 'three';

// Local art direction for the moonlit lake. These are project choices, not
// purported Sable/Rollerdrome source code or a change to the global renderer.
export const GREG_LAKE_PALETTE = Object.freeze({
  ink: '#4a4960', water: '#41b8b9', waterDeep: '#258494',
  stone: '#e2977f', stoneShade: '#ab707b', wall: '#7c7f91', wallShade: '#62697e',
  bark: '#c48f9b', foliage: '#3d9483', foliageShade: '#246b63',
  foliageLight: '#a4c899', flower: '#ef9c88', warm: '#e7dcc4', path: '#e7dcc4',
});
// 2026-10-10 user (Moebius restraint): about 1 px close up, thinner beyond 10 m, no line beyond 20 m.
export const GREG_LAKE_LINE_PROFILE = Object.freeze({widthCss: .85, fadeStart: 10, fadeEnd: 20});
// Shared by every lake ink line: the swamp's inner frame (inverse world matrix) and the water level, so nothing
// below the water surface is ever outlined. waterY -1e9 = off until swampHandInk.js installs the real values.
export const GREG_INK_SHARED = { uSwInv: {value: new THREE.Matrix4()}, uWaterY: {value: -1e9} };

// Offsets in CSS pixels are invariant under camera distance, world scale and DPR.
export function gregInkClipOffset(normalXY, viewport, widthCss, dpr, clipW) {
  const x = normalXY[0] * viewport[0], y = normalXY[1] * viewport[1];
  const length = Math.hypot(x, y);
  if (length < 1e-8) return [0, 0];
  return [x / length * 2 * widthCss * dpr / viewport[0] * clipW,
    y / length * 2 * widthCss * dpr / viewport[1] * clipW];
}

export function createGregLakeInkMaterial(width = .85) {
  return new THREE.ShaderMaterial({
    name: 'greg-lake-screen-ink', side: THREE.BackSide, toneMapped: false,
    transparent: true, depthWrite: false,
    uniforms: { ink: {value: new THREE.Color(GREG_LAKE_PALETTE.ink)},
      viewport: {value: new THREE.Vector2(1280, 720)}, pixelWidth: {value: width},
      fadeRange: {value: new THREE.Vector2(GREG_LAKE_LINE_PROFILE.fadeStart, GREG_LAKE_LINE_PROFILE.fadeEnd)},
      uSwInv: GREG_INK_SHARED.uSwInv, uWaterY: GREG_INK_SHARED.uWaterY },
    vertexShader: `
      uniform vec2 viewport;
      uniform float pixelWidth;
      uniform vec2 fadeRange;
      uniform mat4 uSwInv;
      varying float inkFade;
      varying float inkLocalY;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          mat3 m = mat3(instanceMatrix);
          // Cofactors transform normals under the nonuniform crown scale.
          mat3 cof = mat3(cross(m[1],m[2]), cross(m[2],m[0]), cross(m[0],m[1]));
          n = cof * n;
          p = instanceMatrix * p;
        #endif
        vec4 viewPosition = modelViewMatrix * p;
        inkFade = 1.0 - smoothstep(fadeRange.x, fadeRange.y, length(viewPosition.xyz));
        inkLocalY = (uSwInv * (modelMatrix * p)).y;
        vec4 clip = projectionMatrix * viewPosition;
        vec2 direction = (projectionMatrix * vec4(normalize(normalMatrix * n), 0.0)).xy * viewport;
        float lengthPx = length(direction);
        if (lengthPx > 0.00001 && clip.w > 0.0) {
          // thinner with distance (full width up to fadeRange.x, about half where it disappears)
          clip.xy += direction / lengthPx * (2.0 * pixelWidth * mix(.45, 1.0, inkFade) / viewport) * clip.w;
        }
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 ink;
      uniform float uWaterY;
      varying float inkFade;
      varying float inkLocalY;
      void main() { if (inkFade < 0.01 || inkLocalY < uWaterY) discard;
        gl_FragColor = vec4(ink, inkFade);
        #include <colorspace_fragment>
      }`,
  });
}

export function attachScreenInk(source, width, report) {
  if (!source.geometry?.attributes.normal || source.userData.gregInk) return;
  const material = createGregLakeInkMaterial(width);
  let shell;
  if (source.isInstancedMesh) {
    shell = new THREE.InstancedMesh(source.geometry, material, source.count);
    shell.instanceMatrix = source.instanceMatrix;
    shell.count = source.count;
  } else shell = new THREE.Mesh(source.geometry, material);
  shell.name = 'greg-lake-outline';
  shell.userData.isOutline = true;
  shell.raycast = () => {};
  // No independent inflated bounding volume is needed for subpixel expansion.
  shell.frustumCulled = false;
  const viewport = new THREE.Vector4();
  shell.onBeforeRender = renderer => {
    renderer.getCurrentViewport(viewport);
    material.uniforms.viewport.value.set(Math.max(1, viewport.z), Math.max(1, viewport.w));
    material.uniforms.pixelWidth.value = width * renderer.getPixelRatio();
  };
  source.add(shell);
  source.userData.gregInk = true;
  report.outlineDraws++;
}

// Retain the authored light/dark planes while replacing their old hue. These
// environmental geometries can share attributes with retired outline meshes,
// so never rewrite their colour buffer in place.
function retainPlaneValues(node) {
  const color = node.geometry?.getAttribute('color');
  if (!color) return false;
  let maximum = 0, neutral = true;
  for (let i = 0; i < color.count; i++) {
    maximum = Math.max(maximum, color.getX(i), color.getY(i), color.getZ(i));
    if (Math.abs(color.getX(i) - color.getY(i)) > .001 || Math.abs(color.getY(i) - color.getZ(i)) > .001) neutral = false;
  }
  if (neutral) return true;
  const shades = new Float32Array(color.count * 3);
  for (let i = 0; i < color.count; i++) {
    const value = Math.max(color.getX(i), color.getY(i), color.getZ(i)) / Math.max(.001, maximum);
    // Only hue-bearing buffers already requiring a copy are quantized. Neutral
    // authored buffers remain shared, avoiding an extra geometry per plant.
    shades.fill(value < .65 ? .72 : value < .9 ? .86 : 1, i * 3, i * 3 + 3);
  }
  node.geometry = node.geometry.clone();
  node.geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));
  return true;
}

function flatMaterial(role, source, vertexColors) {
  const color = GREG_LAKE_PALETTE[role] || GREG_LAKE_PALETTE.stone;
  const material = new THREE.MeshBasicMaterial({color, side: source?.side ?? THREE.FrontSide,
    fog: false, toneMapped: false, vertexColors});
  material.name = 'greg-lake-' + role;
  return material;
}

// AA is only at discrete ink boundaries. fwidth also suppresses subpixel marks,
// so object-anchored lines cannot become a high-frequency screen-door at distance.
function linework(material, kind, waterlineY = 0) {
  const body = kind === 'wall' ? `
    // Water height is expressed in this mesh's coordinates, not inner-world Y.
    diffuseColor.rgb = mix(gregShade, gregFace, step(gregWaterline, gregLocal.y));
    float theta = atan(gregLocal.z, gregLocal.x);
    float layer = (gregLocal.y - gregWaterline) / 5.8 + sin(theta * 5.0) * 0.18 + sin(theta * 11.0) * 0.035;
    float stonePlane = step(0.68, fract(layer));
    diffuseColor.rgb = mix(diffuseColor.rgb, gregShade, stonePlane * 0.14);
    float phaseWidth = max(fwidth(layer), 0.0001);
    float bandInk = 1.0 - smoothstep(phaseWidth * 0.35, phaseWidth * 1.15, abs(fract(layer + 0.5) - 0.5));
    float detailLOD = 1.0 - smoothstep(0.12, 0.28, phaseWidth);
    float interrupted = step(-0.1, sin(theta * 3.0 + floor(layer) * 1.7));
    float strataLOD = 1.0 - smoothstep(25.0, 70.0, gregViewDepth);
    float crackPhase = theta * 3.5 + sin(gregLocal.y * 0.43 + theta) * 0.10;
    float crackWidth = max(fwidth(crackPhase), 0.0001);
    float crack = 1.0 - smoothstep(crackWidth * 0.30, crackWidth, abs(fract(crackPhase + 0.5) - 0.5));
    float crackBreak = smoothstep(0.45, 0.65, sin(gregLocal.y * 0.39 + floor(crackPhase + 0.5) * 1.9));
    float crackLOD = (1.0 - smoothstep(0.08, 0.20, crackWidth)) * gregDistanceInk;
    float rockInk = max(bandInk * interrupted * detailLOD * strataLOD * 0.30, crack * crackBreak * crackLOD * 0.32);
    diffuseColor.rgb = mix(diffuseColor.rgb, gregInk, rockInk);
  ` : kind === 'bark' ? `
    float phase = atan(gregLocal.z, gregLocal.x) * 1.6 + sin(gregLocal.y * 0.18) * 0.10;
    float footprint = max(fwidth(phase), 0.0001);
    float grain = 1.0 - smoothstep(footprint * 0.30, footprint * 1.0, abs(fract(phase + 0.5) - 0.5));
    float interrupted = step(0.45, sin(gregLocal.y * 0.35 + phase * 2.0));
    float detailLOD = 1.0 - smoothstep(0.10, 0.25, footprint);
    // Long irregular plates and sparse healed seams make old wood readable as
    // bark instead of a smooth pink tube. This is an object-attached project
    // treatment, not an assertion about a Sable shader.
    float platePhase=phase*.69+sin(gregLocal.y*.11+phase)*.16;
    float plate=step(.63,fract(platePhase));
    diffuseColor.rgb*=mix(1.0,.84,plate);
    float scarPhase=gregLocal.y*.105+sin(phase*2.3)*.28;
    float scarWidth=max(fwidth(scarPhase),.0001);
    float scar=(1.0-smoothstep(scarWidth*.3,scarWidth*1.1,abs(fract(scarPhase+.5)-.5)))
      *smoothstep(.48,.82,sin(phase*3.1+floor(scarPhase)*1.7))
      *(1.0-smoothstep(.08,.18,scarWidth));
    float fissure=max(grain*interrupted*detailLOD*.31,scar*.22)*gregDistanceInk;
    diffuseColor.rgb=mix(diffuseColor.rgb,gregInk,fissure);
  ` : `
    float top = step(0.45, gregLocalNormal.y);
    diffuseColor.rgb = mix(gregShade, gregFace, top);
  `;
  material.onBeforeCompile = shader => {
    shader.uniforms.gregInk = {value: new THREE.Color(GREG_LAKE_PALETTE.ink)};
    shader.uniforms.gregWaterline = {value: waterlineY};
    shader.uniforms.gregFace = {value: material.color.clone()};
    shader.uniforms.gregShade = {value: new THREE.Color(kind === 'wall' ? GREG_LAKE_PALETTE.wallShade :
      kind === 'path' ? GREG_LAKE_PALETTE.wall : GREG_LAKE_PALETTE.stoneShade)};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 gregLocal;\nvarying vec3 gregLocalNormal;\nvarying float gregViewDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngregLocal = position;\ngregLocalNormal = normal;')
      .replace('#include <project_vertex>', '#include <project_vertex>\ngregViewDepth = length(mvPosition.xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 gregInk;\nuniform vec3 gregFace;\nuniform vec3 gregShade;\nuniform float gregWaterline;\nvarying vec3 gregLocal;\nvarying vec3 gregLocalNormal;\nvarying float gregViewDepth;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat gregDistanceInk = 1.0 - smoothstep(12.0, 34.0, gregViewDepth);\n' + body);
  };
  material.customProgramCacheKey = () => 'greg-lake-v4-aged-bark-' + kind;
}

// Explicit extension for the shared, real fan-leaf canopy. No separate line
// mesh or outline shell: only a few radial veins, extinguished before distance
// turns them into screen noise. This runs once during material preparation.
function fanVeins(material) {
  applySwampCanopyInk(material);
}

export function applyGregLakeVisuals(swamp) {
  if (new URLSearchParams(globalThis.location?.search || '').get('gregLakeVisuals') === '0') return null;
  if (swamp.userData.gregLakeVisuals) return swamp.userData.gregLakeVisuals;
  const report = {version: 3, scope: 'moonlit-lake-only', palette: GREG_LAKE_PALETTE,
    changedMeshes: 0, outlineDraws: 0, planeValueMeshes: 0, retiredOpenSurfaceHulls: 0, preservedStoryActors: true};
  const nodes = [];
  const water = swamp.getObjectByName('swamp-underground-waterline');
  let sharedFanMaterial = null;
  swamp.traverse(node => nodes.push(node));
  for (const node of nodes) {
    // Retire duplicate model-space foliage hulls and the unbounded fine bark lines.
    if (['v2-central-crown-ink', 'v2-rim-crown-ink', 'v2-bark-line'].includes(node.name)) {
      node.visible = false;
      continue;
    }
    if (!node.isMesh || node.userData.isOutline) continue;
    let role = node.userData.gregVisualRole;
    const treePart = node.userData.swampTreePart;
    if (['trunk', 'branch', 'root', 'palm-trunk'].includes(treePart)) role = 'bark';
    if (treePart === 'palm-leaf') {
      role = 'foliage';
      // An open leaf has no enclosed back shell. The old opaque hull filled
      // its back face instead of producing a silhouette.
      for (const child of node.children) if (child.userData.isOutline && child.visible) {
        child.visible = false; report.retiredOpenSurfaceHulls++;
      }
    }
    if (node.name === 'swamp-sinkhole-wall') role = 'wall';
    if (node.name === 'swamp-lake-floor') role = 'waterDeep';
    if (['world-tree-trunk', 'v2-world-tree-branch', 'v2-floor-root', 'v2-rim-bowed-root', 'v2-curved-rim-branch'].includes(node.name)) role = 'bark';
    if (['v2-central-crown-batch', 'v2-rim-foliage-lobes', 'v2-world-tree-leaflets', 'v2-entry-fronds', 'v2-bank-ferns'].includes(node.name)) role = 'foliage';
    if (node.name === 'v2-bank-rock-shelves' || node.parent?.name === 'v2-entry-stone-cheeks') role = 'stone';
    if (node.name === 'v2-entrance-tread') role = 'path';
    if (node.name === 'v2-cupped-petal') role = 'flower';
    if (!role || !GREG_LAKE_PALETTE[role]) continue;
    const old = Array.isArray(node.material) ? node.material[0] : node.material;
    const planeValues = retainPlaneValues(node);
    if (role === 'foliage' && node.userData.gregFanVeins) {
      sharedFanMaterial ||= flatMaterial(role, old, planeValues);
      node.material = sharedFanMaterial;
    } else node.material = flatMaterial(role, old, planeValues);
    if (planeValues) report.planeValueMeshes++;
    if (role === 'wall' || role === 'bark') {
      const waterlineY = role === 'wall' && water ? node.worldToLocal(water.getWorldPosition(new THREE.Vector3())).y : 0;
      linework(node.material, role, waterlineY);
    }
    if (role === 'path' || role === 'stone') linework(node.material, role);
    if (role === 'foliage' && node.userData.gregFanVeins) fanVeins(node.material);
    if (role === 'foliage' && node.isInstancedMesh) {
      // Fan crowns: every leaf its own tone, deep / mid / light / a few warm, scattered by a hash (not stripes).
      // 2026-10-10: Moebius greens — saturated jade / emerald / yellow-green instead of the old grey mint.
      const colors = node.userData.gregFanVeins ? (useSwampTargetFoliage()?
        ['#3f706e','#548d80','#699d8d','#699d8d','#86ad98','#9fbaa1','#588d89']:
        ['#1f7f68', '#2f9a72', '#3fae74', '#3fae74', '#6cc46a', '#a3d257', '#2c9a8c']) :
        [GREG_LAKE_PALETTE.foliageShade, GREG_LAKE_PALETTE.foliage, GREG_LAKE_PALETTE.foliageLight, GREG_LAKE_PALETTE.foliage];
      // Instance colours are now the palette, not multiplied by a second tint.
      node.material.color.set(0xffffff);
      for (let i = 0; i < node.count; i++) node.setColorAt(i, new THREE.Color(colors[node.userData.gregFanVeins ? Math.floor((Math.sin(i * 12.9898 + 4.1) * 43758.5453 % 1 + 1) % 1 * colors.length) : i % colors.length]));
      if (node.instanceColor) node.instanceColor.needsUpdate = true;
    }
    if (['v2-central-crown-batch', 'v2-rim-foliage-lobes', 'world-tree-trunk'].includes(node.name)) attachScreenInk(node, .85, report);
    report.changedMeshes++;
  }
  if (water) {
    for (const child of water.children) if (child.userData.isOutline && child.visible) {
      child.visible = false; report.retiredOpenSurfaceHulls++;
    }
    // Keep animated geometry, transparency and the existing water ripple hook.
    water.material.color.set(GREG_LAKE_PALETTE.water);
    water.material.toneMapped = false;
  }
  swamp.userData.gregLakeVisuals = report;
  return report;
}
