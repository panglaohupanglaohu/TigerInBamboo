/**
 * backlit.js — the rim you get when you look into the sun.
 *
 * Source note (x.com/OskSta/status/1751945034851570056):
 *
 *   "Some nice new highlights when the island is backlit. Achieved by simply
 *    adding another inverted mesh outline layer that shows up when looking into
 *    the sun. And masked by shadows, of course."
 *
 * Inverted hull: duplicate the geometry, expand every vertex along its normal,
 * draw back faces only. Because the shell is *behind* the object, the depth test
 * hides all of it except the silhouette — which is exactly the ring of light
 * along the edge, and it costs one extra draw call.
 *
 * The "look into the sun" term is the interesting half: the rim only appears
 * when the view direction is roughly the sun direction, so the island lights up
 * as the camera swings around, not as a constant outline.
 *
 * On shadow masking: the real thing multiplies the rim by the shadow map. Here
 * the occlusion is left to the depth test (a hull fragment behind something is
 * simply not drawn) and to the object's own back-facing test. That covers
 * silhouettes correctly but will still show a rim on a shadowed-to-the-camera
 * face; noted as a known gap rather than papered over.
 */

import * as THREE from 'three';

export function createBacklitRim(sourceMesh, {
  colour = '#ffd9a8',
  width = 0.035,
  strength = 2.1,
  sunDir = new THREE.Vector3(0.5, 0.7, 0.5),
} = {}) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSun: { value: sunDir.clone().normalize() },
      uColour: { value: new THREE.Color(colour).convertSRGBToLinear() },
      uWidth: { value: width },
      uStrength: { value: strength },
      uBias: { value: 0.42 },
    },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      varying vec3 vNormalW;
      varying vec3 vViewDir;

      void main() {
        // expand along the vertex normal: the hull must sit outside the surface
        vec3 p = position + normal * uWidth;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uColour;
      uniform float uStrength;
      uniform float uBias;

      varying vec3 vNormalW;
      varying vec3 vViewDir;

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(vViewDir);
        vec3 s = normalize(uSun);

        // 1 when the camera looks straight into the sun. v points from the
        // surface to the camera, so "into the sun" is v *opposing* s — the
        // first version had this sign flipped and the rim never appeared.
        float intoSun = smoothstep(uBias, 1.0, -dot(v, s));

        // only the faces turned away from the light contribute a rim
        // smoothstep needs edge0 < edge1; this is the inverted form of it
        float away = 1.0 - smoothstep(-0.55, 0.25, dot(n, s));

        // and the rim itself is strongest at grazing angles
        float graze = pow(1.0 - abs(dot(n, v)), 2.2);

        float rim = intoSun * away * graze;
        if (rim <= 0.002) discard;

        gl_FragColor = vec4(uColour * uStrength * rim, rim);
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(sourceMesh.geometry, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  mesh.userData.isBacklitRim = true;

  return {
    mesh,
    setSun(dir) { material.uniforms.uSun.value.copy(dir).normalize(); },
    setStrength(v) { material.uniforms.uStrength.value = v; },
    dispose() {
      mesh.parent?.remove(mesh);
      material.dispose();
    },
  };
}
