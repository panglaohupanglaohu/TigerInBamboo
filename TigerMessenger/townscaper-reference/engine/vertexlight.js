/**
 * vertexlight.js — lighting as one lookup in a low-res height map, in the vertex shader.
 *
 * Source note (x.com/OskSta/status/1791049306213912823):
 *
 *   "Trying out a new lighting solution. This one is just one lookup in the
 *    vertex shader of a low res cube map height map."
 *
 * What the clip shows: a white clay planet with no textures and no shadows, lit
 * by a single soft key. The terminator is smooth and slightly smeared, and the
 * bottoms of the carved river valleys sit in a gentle darkening that follows
 * the *shape* of the terrain rather than any cast shadow. The lighting reads as
 * plausible but soft — consistent with a height map sampled at a low resolution
 * and interpolated across big triangles.
 *
 * The whole point of the note is the budget: ONE lookup, per vertex, not per
 * pixel, on a map far coarser than the mesh. So this module bakes the town's
 * height field into a small texture (24×24 by default — a 19-cell-radius island
 * spans ~38 cells, so roughly two grid cells per texel) and the vertex shader
 * fetches it exactly once per vertex, using both channels of that one fetch:
 *
 *   r = highest column in that texel   (the local skyline)
 *   g = lowest column in that texel    (the local floor)
 *
 * A vertex that is below its texel's skyline is sitting under something — a
 * cliff foot, a well, the inside of a canyon — so it receives less of the sky.
 * That is not a shadow; it is the cheap stand-in the note is describing, and
 * because the map is coarse the darkening is broad and soft instead of crisp,
 * which is what makes it fit the style.
 *
 * Note on the "cube map": his map is a cube because his terrain is a planet.
 * Our island is flat, so a 2D map plays the identical role; the lookup and the
 * resolution trade-off are the parts that carry over.
 */

import * as THREE from 'three';

/**
 * Bake the height field into a small texture.
 * @returns {{texture:THREE.DataTexture, uniforms:object, dispose:Function, size:number}}
 */
export function createHeightLookup(town, grid, { res = 24, strength = 0.5, levelHeight = 0.42 } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 1;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
  }
  for (const c of grid.cells) maxH = Math.max(maxH, town.top(c));

  const spanX = Math.max(1e-4, maxX - minX);
  const spanZ = Math.max(1e-4, maxZ - minZ);

  const hi = new Float32Array(res * res);   // skyline per texel
  const lo = new Float32Array(res * res).fill(Infinity);
  const seen = new Uint8Array(res * res);

  for (const c of grid.cells) {
    const top = town.top(c);
    const h = top * 1.0;
    const x0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minX - minX) / spanX) * res)));
    const x1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxX - minX) / spanX) * res)));
    const z0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minZ - minZ) / spanZ) * res)));
    const z1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxZ - minZ) / spanZ) * res)));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const i = z * res + x;
        hi[i] = Math.max(hi[i], h);
        lo[i] = Math.min(lo[i], h);
        seen[i] = 1;
      }
    }
  }
  for (let i = 0; i < res * res; i++) if (!seen[i]) lo[i] = 0;

  const data = new Uint8Array(res * res * 4);
  const toByte = (v) => Math.round(Math.min(255, Math.max(0, (v / (maxH + 0.0001)) * 255)));
  for (let i = 0; i < res * res; i++) {
    data[i * 4 + 0] = toByte(hi[i]);
    data[i * 4 + 1] = toByte(lo[i] === Infinity ? 0 : lo[i]);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const uniforms = {
    uHeightMap: { value: texture },
    // xy = world min corner, zw = 1 / span
    uHeightXform: { value: new THREE.Vector4(minX, minZ, 1 / spanX, 1 / spanZ) },
    // world y -> 0..1 of maxH, so a vertex can be compared against the byte map
    uVertNorm: { value: 1 / (levelHeight * (maxH + 1e-3)) },
    uHeightOcc: { value: strength },
  };

  return {
    texture,
    uniforms,
    size: res,
    maxHeight: maxH,
    dispose() { texture.dispose(); },
  };
}

const VERT_DECL = /* glsl */ `
  uniform sampler2D uHeightMap;
  uniform vec4 uHeightXform;
  uniform float uVertNorm;
  uniform float uHeightOcc;
  varying float vSkyOcc;
`;

const VERT_BODY = /* glsl */ `
  // ONE fetch per vertex, coarse map, both channels of that fetch used.
  {
    vec3 wl = (modelMatrix * vec4(position, 1.0)).xyz;
    vec2 huv = clamp((wl.xz - uHeightXform.xy) * uHeightXform.zw, 0.0, 1.0);
    vec4 hs = texture2D(uHeightMap, huv);
    float skyline = hs.r;      // highest column in this texel, 0..1 of maxH
    float floorH = hs.g;       // lowest column in this texel
    float vert = clamp(wl.y * uVertNorm, 0.0, 1.0);
    // sitting under the local skyline -> less sky. Coarse map = broad, soft
    // darkening instead of a crisp cast shadow.
    float under = clamp((skyline - vert) * 1.35, 0.0, 1.0);
    // a texel that spans a lot of height is a cliff; darken its foot a nudge more
    float spread = clamp((skyline - floorH) * 1.1, 0.0, 1.0);
    vSkyOcc = clamp((under * 0.85 + spread * 0.35) * uHeightOcc, 0.0, 1.0);
  }
`;

const FRAG_DECL = /* glsl */`
  varying float vSkyOcc;
`;

const FRAG_BODY = /* glsl */`
  diffuseColor.rgb *= mix(1.0, 0.52, clamp(vSkyOcc, 0.0, 1.0));
`;

/**
 * Chain the lookup onto a material that already has its own onBeforeCompile
 * (surface.js). The single fetch is injected immediately after the world
 * position is known, so it runs once per vertex and never in the fragment.
 */
export function attachVertexLookup(material, lookup) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey;

  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, lookup.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY);
  };

  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+hl1';
  material.userData.heightLookup = lookup;
  return material;
}
