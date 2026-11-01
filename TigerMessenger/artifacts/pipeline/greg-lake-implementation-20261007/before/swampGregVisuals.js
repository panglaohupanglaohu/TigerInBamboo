import * as THREE from 'three';

// Local art direction for the moonlit lake. These are project choices, not
// purported Sable/Rollerdrome source code or a change to the global renderer.
export const GREG_LAKE_PALETTE = Object.freeze({
  ink: '#17445e', water: '#46b5c1', waterDeep: '#164967',
  stone: '#75a7b1', stoneShade: '#37687e', wall: '#245f7e',
  bark: '#287c91', foliage: '#298c94', foliageShade: '#226475',
  foliageLight: '#53afa6', flower: '#d6a9c2', warm: '#ead4ac', path: '#9cc4ba',
});
export const GREG_LAKE_LINE_PROFILE = Object.freeze({widthCss: .85, fadeStart: 32, fadeEnd: 85});

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
      fadeRange: {value: new THREE.Vector2(GREG_LAKE_LINE_PROFILE.fadeStart, GREG_LAKE_LINE_PROFILE.fadeEnd)} },
    vertexShader: `
      uniform vec2 viewport;
      uniform float pixelWidth;
      uniform vec2 fadeRange;
      varying float inkFade;
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
        vec4 clip = projectionMatrix * viewPosition;
        vec2 direction = (projectionMatrix * vec4(normalize(normalMatrix * n), 0.0)).xy * viewport;
        float lengthPx = length(direction);
        if (lengthPx > 0.00001 && clip.w > 0.0) {
          clip.xy += direction / lengthPx * (2.0 * pixelWidth / viewport) * clip.w;
        }
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 ink;
      varying float inkFade;
      void main() { if (inkFade < 0.01) discard;
        gl_FragColor = vec4(ink, inkFade);
        #include <colorspace_fragment>
      }`,
  });
}

function attachScreenInk(source, width, report) {
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
    shades.fill(THREE.MathUtils.clamp(value, .48, 1), i * 3, i * 3 + 3);
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
function linework(material, kind) {
  const body = kind === 'wall' ? `
    float band = floor((gregLocal.y + 15.0) / 10.0);
    diffuseColor.rgb *= band < 1.0 ? 0.70 : (band < 2.0 ? 0.86 : 1.0);
    float theta = atan(gregLocal.z, gregLocal.x);
    float layer = (gregLocal.y + 15.0) / 5.0 + sin(theta * 9.0) * 0.14;
    float phaseWidth = max(fwidth(layer), 0.0001);
    float bandInk = 1.0 - smoothstep(phaseWidth * 0.35, phaseWidth * 1.15, abs(fract(layer + 0.5) - 0.5));
    float detailLOD = 1.0 - smoothstep(0.12, 0.28, phaseWidth);
    diffuseColor.rgb = mix(diffuseColor.rgb, gregInk, bandInk * detailLOD * gregDistanceInk * 0.50);
  ` : kind === 'bark' ? `
    float phase = atan(gregLocal.z, gregLocal.x) * 3.1 + sin(gregLocal.y * 0.22) * 0.10;
    float footprint = max(fwidth(phase), 0.0001);
    float grain = 1.0 - smoothstep(footprint * 0.30, footprint * 1.0, abs(fract(phase + 0.5) - 0.5));
    float interrupted = step(0.12, sin(gregLocal.y * 0.55 + phase * 2.0));
    float detailLOD = 1.0 - smoothstep(0.10, 0.25, footprint);
    diffuseColor.rgb = mix(diffuseColor.rgb, gregInk, grain * interrupted * detailLOD * gregDistanceInk * 0.52);
  ` : `
    float top = step(0.45, gregLocalNormal.y);
    diffuseColor.rgb *= mix(0.75, 1.0, top);
  `;
  material.onBeforeCompile = shader => {
    shader.uniforms.gregInk = {value: new THREE.Color(GREG_LAKE_PALETTE.ink)};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 gregLocal;\nvarying vec3 gregLocalNormal;\nvarying float gregViewDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngregLocal = position;\ngregLocalNormal = normal;')
      .replace('#include <project_vertex>', '#include <project_vertex>\ngregViewDepth = length(mvPosition.xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 gregInk;\nvarying vec3 gregLocal;\nvarying vec3 gregLocalNormal;\nvarying float gregViewDepth;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat gregDistanceInk = 1.0 - smoothstep(18.0, 48.0, gregViewDepth);\n' + body);
  };
  material.customProgramCacheKey = () => 'greg-lake-v2-' + kind;
}

export function applyGregLakeVisuals(swamp) {
  if (new URLSearchParams(globalThis.location?.search || '').get('gregLakeVisuals') === '0') return null;
  if (swamp.userData.gregLakeVisuals) return swamp.userData.gregLakeVisuals;
  const report = {version: 2, scope: 'moonlit-lake-only', palette: GREG_LAKE_PALETTE,
    changedMeshes: 0, outlineDraws: 0, planeValueMeshes: 0, retiredOpenSurfaceHulls: 0, preservedStoryActors: true};
  const nodes = [];
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
    if (!role || !GREG_LAKE_PALETTE[role]) continue;
    const old = Array.isArray(node.material) ? node.material[0] : node.material;
    const planeValues = retainPlaneValues(node);
    node.material = flatMaterial(role, old, planeValues);
    if (planeValues) report.planeValueMeshes++;
    if (role === 'wall' || role === 'bark') linework(node.material, role);
    if (role === 'path' || role === 'stone') linework(node.material, 'planes');
    if (role === 'foliage' && node.isInstancedMesh) {
      const colors = [GREG_LAKE_PALETTE.foliageShade, GREG_LAKE_PALETTE.foliage, GREG_LAKE_PALETTE.foliageLight, GREG_LAKE_PALETTE.foliage];
      // Instance colours are now the palette, not multiplied by a second tint.
      node.material.color.set(0xffffff);
      for (let i = 0; i < node.count; i++) node.setColorAt(i, new THREE.Color(colors[i % colors.length]));
      if (node.instanceColor) node.instanceColor.needsUpdate = true;
    }
    if (['v2-central-crown-batch', 'v2-rim-foliage-lobes', 'world-tree-trunk'].includes(node.name)) attachScreenInk(node, .85, report);
    report.changedMeshes++;
  }
  const water = swamp.getObjectByName('swamp-underground-waterline');
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
