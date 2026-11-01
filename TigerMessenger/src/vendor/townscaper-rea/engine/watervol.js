/**
 * watervol.js — water as a stack of planes, not a single surface.
 *
 * Source note (x.com/OskSta/status/1758251637280268481):
 *
 *   "It's simply a stack of planes sampling an SDF I had laying around. Gives a
 *    much more fluid vibe than the basic flipped mesh approach in Bad North and
 *    Townscaper"
 *
 * The reference is the earlier "flipped mesh" trick: mirror the island under the
 * water and let the water plane cut it off. That gives a sharp, glassy reflection
 * and a hard waterline, which is exactly what the note is moving away from.
 *
 * A stack of horizontal slices has no reflection at all — instead you get a
 * volume. Each slice is a fraction more transparent than the one above it, so
 * looking through the surface you see depth rather than a mirror, and the
 * silhouettes of anything sunk into it soften with every layer.
 *
 * The note samples an SDF; here the same role is played by a cheap procedural
 * field in the fragment shader, because shipping a texture for a look this
 * diffuse would be the wrong trade (and the engine has no texture pipeline yet).
 */

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBob;

  varying vec2 vXZ;
  varying float vDepth;

  void main() {
    vec3 p = position;
    // each slice bobs slightly out of phase, which is what stops the stack from
    // reading as a set of flat sheets
    p.z += sin(uTime * 0.55 + uPhase + position.x * 0.13) * uBob
         + cos(uTime * 0.41 + uPhase * 1.7 + position.y * 0.11) * uBob * 0.6;
    vXZ = position.xy;
    vDepth = uPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColour;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uExtent;
  uniform float uChest;      // 0 for the top slice, 1 for the deepest

  varying vec2 vXZ;
  varying float vDepth;

  // cheap value noise: the "SDF I had laying around", replaced by something the
  // shader can evaluate on its own
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    // a soft blotchy field, drifting slowly
    float n = noise(vXZ * 0.55 + vec2(uTime * 0.03, -uTime * 0.02));
    n = n * 0.6 + noise(vXZ * 1.7 - vec2(uTime * 0.05)) * 0.4;

    // fade out towards the rim so the slab has no visible edge
    float rim = 1.0 - smoothstep(uExtent * 0.55, uExtent, length(vXZ));

    float a = uAlpha * rim * (0.55 + 0.45 * n);
    if (a <= 0.003) discard;

    gl_FragColor = vec4(uColour, a);
    #include <colorspace_fragment>
  }`;

/**
 * @returns {{group: THREE.Group, update(t:number):void, dispose():void}}
 */
export function createWaterVolume({
  colour = '#2d6b7d',
  planes = 7,
  top = -0.05,
  bottom = -1.6,
  extent = 90,
  baseAlpha = 0.055,
  bob = 0.02,
} = {}) {
  const group = new THREE.Group();
  const materials = [];

  for (let i = 0; i < planes; i++) {
    const t = planes === 1 ? 0 : i / (planes - 1);
    const y = top + (bottom - top) * t;

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: t * 3.1 },
        uBob: { value: bob * (0.4 + t) },
        uColour: { value: new THREE.Color(colour).convertSRGBToLinear() },
        // deeper slices are dimmer, so the volume darkens with depth
        uAlpha: { value: baseAlpha * (1.0 - t * 0.65) },
        uExtent: { value: extent },
        uChest: { value: t },
      },
      vertexShader,
      fragmentShader,
    });
    materials.push(material);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2, extent * 2, 1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.renderOrder = 1;
    mesh.userData.overlayOnly = true;
    group.add(mesh);
  }

  return {
    group,
    update(t) {
      for (const m of materials) m.uniforms.uTime.value = t;
    },
    dispose() {
      for (const m of materials) m.dispose();
    },
  };
}
